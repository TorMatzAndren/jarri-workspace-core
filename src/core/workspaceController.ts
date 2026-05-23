import { useEffect, useMemo, useState } from "react";
import { createId, nowIso } from "./id";
import {
  geometryFromPanelDefinition,
  nextFocusOrder,
  repairFocusOrder,
} from "./layoutEngine";
import type { LayoutPersistence } from "./layoutPersistence";
import type { PanelRegistry } from "./panelRegistry";
import {
  createLocalTabTemplateStorage,
  createTemplateDocument,
  createTemplateFromTab,
  normalizeTemplateDocument,
  tabFromTemplate,
  type TabTemplateStorage,
} from "./tabTemplates";
import type {
  PanelDefinition,
  PanelGeometry,
  PanelInstance,
  SavedTabTemplate,
  WorkspacePreferences,
  WorkspaceState,
} from "./types";

const FOCUS_ORDER_COMPACT_THRESHOLD = 500;

type WorkspaceControllerDependencies = {
  registry: PanelRegistry;
  persistence: LayoutPersistence;
  defaultWorkspaceFactory: () => WorkspaceState;
  tabTemplateStorage?: TabTemplateStorage;
};

export type WorkspaceController = {
  workspace: WorkspaceState;
  activeTab: WorkspaceState["tabs"][number];
  initialRepairLabel: string;
  availablePanels: PanelDefinition[];
  selectTab: (tabId: string) => void;
  createTab: () => void;
  renameTab: (tabId: string, title: string) => void;
  closeTab: (tabId: string) => void;
  savedTabTemplates: SavedTabTemplate[];
  saveActiveTabTemplate: () => void;
  loadTabTemplate: (templateId: string) => void;
  exportTabsJson: () => string;
  importTabsJson: (json: string) => { imported: number; warnings: string[] };
  createPanel: (moduleId: string, panelType: string) => void;
  closePanel: (panelId: string) => void;
  togglePanelMinimized: (panelId: string) => void;
  focusPanel: (panelId: string) => void;
  updatePanelGeometry: (panelId: string, geometry: PanelGeometry) => void;
  updatePanelState: (panelId: string, panelState: unknown) => void;
  updatePreferences: (preferences: Partial<WorkspacePreferences>) => void;
  resetWorkspace: () => void;
};

export function useWorkspaceController({
  registry,
  persistence,
  defaultWorkspaceFactory,
  tabTemplateStorage,
}: WorkspaceControllerDependencies): WorkspaceController {
  const [initialLoad] = useState(() => persistence.loadWorkspace());
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialLoad.state);
  const [templateStorage] = useState(
    () => tabTemplateStorage ?? createLocalTabTemplateStorage(),
  );
  const [savedTabTemplates, setSavedTabTemplates] = useState<SavedTabTemplate[]>(
    () => templateStorage.load(),
  );

  useEffect(() => {
    persistence.saveWorkspace(workspace);
  }, [persistence, workspace]);

  useEffect(() => {
    templateStorage.save(savedTabTemplates);
  }, [savedTabTemplates, templateStorage]);

  const activeTab = useMemo(
    () =>
      workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ??
      workspace.tabs[0],
    [workspace],
  );

  function updateActiveTab(mutator: (panels: PanelInstance[]) => PanelInstance[]) {
    const now = nowIso();
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId
          ? { ...tab, panels: mutator(tab.panels), updatedAt: now }
          : tab,
      ),
    }));
  }

  function createPanel(moduleId: string, panelType: string) {
    const definition = registry.getPanel(moduleId, panelType);
    if (!definition) {
      return;
    }

    const now = nowIso();
    updateActiveTab((panels) => [
      ...panels,
      {
        id: createId("panel"),
        moduleId,
        panelType,
        title: definition.title,
        geometry: geometryFromPanelDefinition(definition, panels.length * 24),
        focusOrder: nextFocusOrder(panels),
        stateVersion: definition.stateVersion,
        panelState: definition.createInitialState({ now }),
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  function createTab() {
    const now = nowIso();
    const id = createId("tab");
    setWorkspace((current) => ({
      ...current,
      activeTabId: id,
      tabs: [
        ...current.tabs,
        {
          id,
          title: `Tab ${current.tabs.length + 1}`,
          panels: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  }

  function renameTab(tabId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    const now = nowIso();
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, title: nextTitle, updatedAt: now } : tab,
      ),
    }));
  }

  function closeTab(tabId: string) {
    setWorkspace((current) => {
      if (current.tabs.length <= 1) {
        return current;
      }

      const tabs = current.tabs.filter((tab) => tab.id !== tabId);
      return {
        ...current,
        tabs,
        activeTabId:
          current.activeTabId === tabId ? tabs[0]?.id ?? null : current.activeTabId,
      };
    });
  }

  function saveActiveTabTemplate() {
    const tab = activeTab;
    if (!tab) {
      return;
    }

    setSavedTabTemplates((current) => [...current, createTemplateFromTab(tab)]);
  }

  function loadTabTemplate(templateId: string) {
    const template = savedTabTemplates.find((candidate) => candidate.id === templateId);
    if (!template) {
      return;
    }

    const tab = tabFromTemplate(template, registry);
    setWorkspace((current) => ({
      ...current,
      activeTabId: tab.id,
      tabs: [...current.tabs, tab],
    }));
  }

  function exportTabsJson() {
    const currentTabTemplates = workspace.tabs.map(createTemplateFromTab);
    return JSON.stringify(
      createTemplateDocument([...savedTabTemplates, ...currentTabTemplates]),
      null,
      2,
    );
  }

  function importTabsJson(json: string) {
    const warnings: string[] = [];

    try {
      const document = normalizeTemplateDocument(JSON.parse(json));
      const templates = document.templates;
      if (templates.length === 0) {
        warnings.push("No valid panel setups were found.");
      }
      setSavedTabTemplates((current) => [...current, ...templates]);
      return { imported: templates.length, warnings };
    } catch {
      return { imported: 0, warnings: ["Import failed because JSON was invalid."] };
    }
  }


  function togglePanelMinimized(panelId: string) {
    const now = nowIso();

    updateActiveTab((panels) =>
      panels.map((panel) => {
        if (panel.id !== panelId) {
          return panel;
        }

        if (panel.display?.mode === "minimized") {
          return {
            ...panel,
            geometry: panel.display.restoreGeometry ?? panel.geometry,
            display: {
              mode: "normal",
            },
            updatedAt: now,
          };
        }

        return {
          ...panel,
          display: {
            mode: "minimized",
            restoreGeometry: panel.geometry,
            minimizedAt: now,
          },
          updatedAt: now,
        };
      }),
    );
  }

  function focusPanel(panelId: string) {
    updateActiveTab((panels) => {
      const basePanels =
        nextFocusOrder(panels) > FOCUS_ORDER_COMPACT_THRESHOLD
          ? repairFocusOrder(panels)
          : panels;
      const nextFocus = nextFocusOrder(basePanels);
      return basePanels.map((panel) =>
        panel.id === panelId ? { ...panel, focusOrder: nextFocus } : panel,
      );
    });
  }

  function updatePanelGeometry(panelId: string, geometry: PanelGeometry) {
    const now = nowIso();
    updateActiveTab((panels) =>
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, geometry, updatedAt: now } : panel,
      ),
    );
  }

  function updatePanelState(panelId: string, panelState: unknown) {
    const now = nowIso();
    updateActiveTab((panels) =>
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, panelState, updatedAt: now } : panel,
      ),
    );
  }

  function updatePreferences(preferences: Partial<WorkspacePreferences>) {
    setWorkspace((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...preferences,
      },
    }));
  }

  function resetWorkspace() {
    persistence.resetWorkspaceStorage();
    setWorkspace(defaultWorkspaceFactory());
  }

  return {
    workspace,
    activeTab,
    initialRepairLabel: initialLoad.report.repaired ? "layout repaired" : "layout clean",
    availablePanels: registry
      .listPanels()
      .filter((panel) => panel.panelType !== "missing"),
    selectTab: (tabId) => setWorkspace((current) => ({ ...current, activeTabId: tabId })),
    createTab,
    renameTab,
    closeTab,
    savedTabTemplates,
    saveActiveTabTemplate,
    loadTabTemplate,
    exportTabsJson,
    importTabsJson,
    createPanel,
    closePanel: (panelId) =>
      updateActiveTab((panels) =>
        repairFocusOrder(panels.filter((panel) => panel.id !== panelId)),
      ),
    togglePanelMinimized,
    focusPanel,
    updatePanelGeometry,
    updatePanelState,
    updatePreferences,
    resetWorkspace,
  };
}
