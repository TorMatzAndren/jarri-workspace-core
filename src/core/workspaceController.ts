import { useEffect, useMemo, useState } from "react";
import { createId, nowIso } from "./id";
import {
  geometryFromPanelDefinition,
  nextFocusOrder,
} from "./layoutEngine";
import type { LayoutPersistence } from "./layoutPersistence";
import type { PanelRegistry } from "./panelRegistry";
import type {
  PanelGeometry,
  PanelInstance,
  WorkspacePreferences,
  WorkspaceState,
} from "./types";

type WorkspaceControllerDependencies = {
  registry: PanelRegistry;
  persistence: LayoutPersistence;
  defaultWorkspaceFactory: () => WorkspaceState;
};

export type WorkspaceController = {
  workspace: WorkspaceState;
  activeTab: WorkspaceState["tabs"][number];
  initialRepairLabel: string;
  availablePanels: ReturnType<PanelRegistry["listPanels"]>;
  selectTab: (tabId: string) => void;
  createTab: () => void;
  closeTab: (tabId: string) => void;
  createPanel: (moduleId: string, panelType: string) => void;
  closePanel: (panelId: string) => void;
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
}: WorkspaceControllerDependencies): WorkspaceController {
  const [initialLoad] = useState(() => persistence.loadWorkspace());
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialLoad.state);

  useEffect(() => {
    persistence.saveWorkspace(workspace);
  }, [persistence, workspace]);

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

  function focusPanel(panelId: string) {
    updateActiveTab((panels) => {
      const nextFocus = nextFocusOrder(panels);
      return panels.map((panel) =>
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
    closeTab,
    createPanel,
    closePanel: (panelId) =>
      updateActiveTab((panels) => panels.filter((panel) => panel.id !== panelId)),
    focusPanel,
    updatePanelGeometry,
    updatePanelState,
    updatePreferences,
    resetWorkspace,
  };
}

