import { useEffect, useMemo, useState } from "react";
import { createId, nowIso } from "./id";
import {
  GRID_SIZE,
  geometryFromPanelDefinition,
  nextFocusOrder,
  normalizeGeometry,
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
  PanelViewPreferences,
  SavedTabTemplate,
  WorkspaceCanvasBounds,
  WorkspacePreferences,
  WorkspaceState,
} from "./types";
import {
  DEFAULT_WORKSPACE_CANVAS_BOUNDS,
  panelSurfacePresentationKey,
  panelTypePreferenceKey,
} from "./types";

const FOCUS_ORDER_COMPACT_THRESHOLD = 500;

function panelGeometriesOverlap(
  a: PanelGeometry,
  b: PanelGeometry,
  gap = 0,
) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

export function resolveInitialPanelGeometry({
  geometry,
  preferredGeometry,
  existingPanels,
  canvasBounds,
  sourcePanelId,
  panelSpacing = 0,
}: {
  geometry: PanelGeometry;
  preferredGeometry?: {
    width?: number;
    height?: number;
  };
  existingPanels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  sourcePanelId?: string;
  panelSpacing?: number;
}): PanelGeometry {
  const sized = normalizeGeometry(
    {
      ...geometry,
      width: preferredGeometry?.width ?? geometry.width,
      height: preferredGeometry?.height ?? geometry.height,
      minWidth: geometry.minWidth,
      minHeight: geometry.minHeight,
    },
    geometry,
  );

  // The first surface establishes the tab from the canonical origin.
  if (existingPanels.length === 0) {
    return normalizeGeometry(
      {
        ...sized,
        x: 0,
        y: 0,
      },
      sized,
    );
  }

  // Causal opening wins over ordinary free-space placement.
  // Align the new surface with its caller and place it directly beside it.
  // Other panels are deliberately not treated as obstacles here.
  const sourcePanel = sourcePanelId
    ? existingPanels.find((panel) => panel.id === sourcePanelId)
    : undefined;

  if (sourcePanel) {
    return normalizeGeometry(
      {
        ...sized,
        x:
          sourcePanel.geometry.x +
          sourcePanel.geometry.width +
          panelSpacing,
        y: sourcePanel.geometry.y,
      },
      sized,
    );
  }

  // Ordinary creation uses the first grid-aligned free rectangle available
  // inside the current logical canvas.
  const maxX = canvasBounds.width - sized.width;
  const maxY = canvasBounds.height - sized.height;

  if (maxX >= 0 && maxY >= 0) {
    for (let y = 0; y <= maxY; y += GRID_SIZE) {
      for (let x = 0; x <= maxX; x += GRID_SIZE) {
        const candidate = {
          ...sized,
          x,
          y,
        };

        const occupied = existingPanels.some((panel) =>
          panelGeometriesOverlap(
            candidate,
            panel.geometry,
            panelSpacing,
          ),
        );

        if (!occupied) {
          return normalizeGeometry(candidate, sized);
        }
      }
    }
  }

  // If no free rectangle exists, retain a readable deterministic cascade.
  // WorkspaceCanvas can grow the logical canvas around the new panel.
  const firstPanel = existingPanels[0];
  const cascadeStep =
    GRID_SIZE * 2 * Math.max(1, existingPanels.length);

  return normalizeGeometry(
    {
      ...sized,
      x: firstPanel.geometry.x + cascadeStep,
      y: firstPanel.geometry.y + cascadeStep,
    },
    sized,
  );
}

export function resolvePanelCreationGeometry({
  seededGeometry,
  hasRememberedGeometry,
  initialPosition,
  preferredGeometry,
  existingPanels,
  canvasBounds,
  sourcePanelId,
  panelSpacing,
}: {
  seededGeometry: PanelGeometry;
  hasRememberedGeometry: boolean;
  initialPosition?: {
    x: number;
    y: number;
  };
  preferredGeometry?: {
    width?: number;
    height?: number;
  };
  existingPanels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  sourcePanelId?: string;
  panelSpacing: number;
}): PanelGeometry {
  if (hasRememberedGeometry) {
    return seededGeometry;
  }

  if (initialPosition) {
    return normalizeGeometry(
      {
        ...seededGeometry,
        x: initialPosition.x,
        y: initialPosition.y,
      },
      seededGeometry,
    );
  }

  return resolveInitialPanelGeometry({
    geometry: seededGeometry,
    preferredGeometry,
    existingPanels,
    canvasBounds,
    sourcePanelId,
    panelSpacing,
  });
}

type WorkspaceControllerDependencies = {
  registry: PanelRegistry;
  persistence: LayoutPersistence;
  defaultWorkspaceFactory: () => WorkspaceState;
  tabTemplateStorage?: TabTemplateStorage;
};

type CreatePanelOptions = {
  title?: string;
  panelState?: unknown;
  preferredGeometry?: {
    width?: number;
    height?: number;
  };
  sourcePanelId?: string;
  initialPosition?: {
    x: number;
    y: number;
  };
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
  createPanel: (
    moduleId: string,
    panelType: string,
    options?: CreatePanelOptions,
  ) => string | null;
  closePanel: (panelId: string) => void;
  togglePanelMinimized: (panelId: string) => void;
  focusPanel: (panelId: string) => void;
  updatePanelGeometry: (panelId: string, geometry: PanelGeometry) => void;
  updatePanelState: (panelId: string, panelState: unknown) => void;
  updatePanelViewPreferences: (
    moduleId: string,
    panelType: string,
    preferences: PanelViewPreferences,
  ) => void;
  updatePreferences: (preferences: Partial<WorkspacePreferences>) => void;
  updateActiveTabCanvasBounds: (bounds: WorkspaceCanvasBounds) => void;
  updateActiveTabCanvasScale: (canvasScale: number) => void;
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

  function createPanel(
    moduleId: string,
    panelType: string,
    options: CreatePanelOptions = {},
  ) {
    const definition = registry.getPanel(moduleId, panelType);
    if (!definition) {
      return null;
    }

    const now = nowIso();
    const panelId = createId("panel");

    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => {
        if (tab.id !== current.activeTabId) {
          return tab;
        }

        const normalized =
          options.panelState === undefined
            ? definition.createInitialState({ now })
            : definition.normalizeState(options.panelState, { now }).state;

        const canonicalGeometry = geometryFromPanelDefinition(definition);
        const surfaceMemory = definition.surfacePresentationMemory
          ? current.surfacePresentationMemory?.[
              panelSurfacePresentationKey(moduleId, panelType)
            ]
          : undefined;
        const rememberedGeometry = surfaceMemory?.geometry;

        const seededGeometry = rememberedGeometry
          ? normalizeGeometry(
              {
                ...rememberedGeometry,
                width:
                  options.preferredGeometry?.width ??
                  rememberedGeometry.width,
                height:
                  options.preferredGeometry?.height ??
                  rememberedGeometry.height,
              },
              canonicalGeometry,
            )
          : normalizeGeometry(
              {
                ...canonicalGeometry,
                width:
                  options.preferredGeometry?.width ??
                  canonicalGeometry.width,
                height:
                  options.preferredGeometry?.height ??
                  canonicalGeometry.height,
              },
              canonicalGeometry,
            );

        const geometry = resolvePanelCreationGeometry({
          seededGeometry,
          hasRememberedGeometry: rememberedGeometry !== undefined,
          initialPosition: options.initialPosition,
          preferredGeometry: options.preferredGeometry,
          existingPanels: tab.panels,
          canvasBounds: tab.canvasBounds,
          sourcePanelId: options.sourcePanelId,
          panelSpacing: current.preferences.panelSpacing,
        });

        return {
          ...tab,
          panels: [
            ...tab.panels,
            {
              id: panelId,
              moduleId,
              panelType,
              title: options.title?.trim() || definition.title,
              geometry,
              focusOrder: nextFocusOrder(tab.panels),
              stateVersion: definition.stateVersion,
              panelState: normalized,
              createdAt: now,
              updatedAt: now,
            },
          ],
          updatedAt: now,
        };
      }),
    }));

    return panelId;
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
          canvasBounds: { ...DEFAULT_WORKSPACE_CANVAS_BOUNDS },
          canvasScale: 1,
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

    setWorkspace((current) => {
      const activeTab = current.tabs.find(
        (tab) => tab.id === current.activeTabId,
      );
      const targetPanel = activeTab?.panels.find(
        (panel) => panel.id === panelId,
      );

      if (!targetPanel) {
        return current;
      }

      const definition = registry.getPanel(
        targetPanel.moduleId,
        targetPanel.panelType,
      );

      const tabs = current.tabs.map((tab) => {
        if (tab.id !== current.activeTabId) {
          return tab;
        }

        return {
          ...tab,
          panels: tab.panels.map((panel) => {
            if (panel.id !== panelId) {
              return panel;
            }

            if (panel.display?.mode === "minimized") {
              return {
                ...panel,
                geometry,
                display: {
                  ...panel.display,
                  restoreGeometry: {
                    ...(panel.display.restoreGeometry ?? panel.geometry),
                    x: geometry.x,
                    y: geometry.y,
                  },
                },
                updatedAt: now,
              };
            }

            return { ...panel, geometry, updatedAt: now };
          }),
          updatedAt: now,
        };
      });

      if (!definition?.surfacePresentationMemory) {
        return {
          ...current,
          tabs,
        };
      }

      const surfaceId = panelSurfacePresentationKey(
        targetPanel.moduleId,
        targetPanel.panelType,
      );

      return {
        ...current,
        tabs,
        surfacePresentationMemory: {
          ...current.surfacePresentationMemory,
          [surfaceId]: {
            kind: "panel",
            moduleId: targetPanel.moduleId,
            panelType: targetPanel.panelType,
            geometry,
            updatedAt: now,
          },
        },
      };
    });
  }

  function updatePanelState(panelId: string, panelState: unknown) {
    const now = nowIso();
    updateActiveTab((panels) =>
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, panelState, updatedAt: now } : panel,
      ),
    );
  }

  function updateActiveTabCanvasBounds(bounds: WorkspaceCanvasBounds) {
    const now = nowIso();
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId
          ? { ...tab, canvasBounds: bounds, updatedAt: now }
          : tab,
      ),
    }));
  }

  function updateActiveTabCanvasScale(canvasScale: number) {
    const now = nowIso();
    const nextScale = Math.min(
      2,
      Math.max(0.25, Number.isFinite(canvasScale) ? canvasScale : 1),
    );

    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId
          ? { ...tab, canvasScale: nextScale, updatedAt: now }
          : tab,
      ),
    }));
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

  function updatePanelViewPreferences(
    moduleId: string,
    panelType: string,
    preferences: PanelViewPreferences,
  ) {
    const key = panelTypePreferenceKey(moduleId, panelType);
    setWorkspace((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        panelViews: {
          ...current.preferences.panelViews,
          [key]: preferences,
        },
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
    updatePanelViewPreferences,
    updatePreferences,
    updateActiveTabCanvasBounds,
    updateActiveTabCanvasScale,
    resetWorkspace,
  };
}
