import { useEffect, useMemo, useRef, useState } from "react";
import { createId, nowIso } from "./id";
import {
  GRID_SIZE,
  geometryFromPanelDefinition,
  nextFocusOrder,
  normalizeGeometry,
  repairFocusOrder,
} from "./layoutEngine";
import type { LayoutPersistence } from "./layoutPersistence";
import { reorderWorkspaceTabs } from "./tabOrder";
import { planSizePreservingArrangement } from "./panelArrangementPreserve";
import { searchSpatialLayout } from "./spatialLayoutSearch";
import { normalizeWorkspaceCanvasBounds } from "./workspaceCanvasBounds";
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
  PreferredPanelSize,
  PanelViewPreferences,
  SavedTabTemplate,
  WorkspaceCanvasCamera,
  WorkspaceCanvasBounds,
  WorkspacePreferences,
  WorkspaceState,
} from "./types";
import {
  DEFAULT_WORKSPACE_CANVAS_BOUNDS,
  panelSurfacePresentationKey,
} from "./types";

const FOCUS_ORDER_COMPACT_THRESHOLD = 500;
// The six-panel reference takes about 14–20 ms in the current benchmark.
// Larger tabs retain the deterministic shelf planner before search cost can
// approach the measured half-second at 24 panels.
export const PRESERVE_SPATIAL_SEARCH_MAX_PANELS = 8;

type PreservePlan = ReturnType<typeof planSizePreservingArrangement>;

function eligibleArrangementPanels(
  panels: PanelInstance[],
  viewport: { width: number; height: number },
  origin: { x: number; y: number },
  scale: number,
): PanelInstance[] {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const area = {
    x: origin.x,
    y: origin.y,
    width: viewport.width / safeScale,
    height: viewport.height / safeScale,
  };
  return panels.filter((panel) => {
    const g = panel.geometry;
    return panel.display?.mode !== "minimized" &&
      [g.x, g.y, g.width, g.height].every(Number.isFinite) &&
      g.width > 0 && g.height > 0 &&
      g.x < area.x + area.width && g.x + g.width > area.x &&
      g.y < area.y + area.height && g.y + g.height > area.y;
  });
}

function validateArrangementPlan(
  panels: PanelInstance[],
  eligible: PanelInstance[],
  geometries: Map<string, PanelGeometry>,
  gridSize: number,
  gap: number,
  canvasBounds: WorkspaceCanvasBounds,
  camera: { x: number; y: number },
  scale: number,
  planCamera: { x: number; y: number },
  planScale: number,
): boolean {
  if (![canvasBounds.x, canvasBounds.y, canvasBounds.width, canvasBounds.height].every(Number.isFinite) ||
    canvasBounds.width <= 0 || canvasBounds.height <= 0) return false;
  if (geometries.size !== eligible.length || eligible.some((panel) => !geometries.has(panel.id))) return false;
  const eligibleIds = new Set(eligible.map((panel) => panel.id));
  if (planCamera.x !== camera.x || planCamera.y !== camera.y || planScale !== scale) return false;
  const placed = panels.map((panel) => ({
    panel,
    geometry: geometries.get(panel.id) ?? panel.geometry,
    moved: eligibleIds.has(panel.id),
  }));
  const grid = Math.max(1, Math.round(gridSize));
  const left = canvasBounds.x, top = canvasBounds.y;
  const right = left + canvasBounds.width, bottom = top + canvasBounds.height;
  for (const { panel, geometry: g, moved } of placed) {
    if (![g.x, g.y, g.width, g.height].every(Number.isFinite) ||
      g.width <= 0 || g.height <= 0 ||
      g.x < left || g.y < top || g.x + g.width > right || g.y + g.height > bottom) return false;
    if (!moved) continue;
    const source = panel.geometry;
    const alignedWidth = Math.ceil(Math.max(source.width, source.minWidth ?? 0) / grid) * grid;
    const alignedHeight = Math.ceil(Math.max(source.height, source.minHeight ?? 0) / grid) * grid;
    if (Math.abs(g.x / grid - Math.round(g.x / grid)) > 1e-7 ||
      Math.abs(g.y / grid - Math.round(g.y / grid)) > 1e-7 ||
      (g.width !== source.width && g.width !== alignedWidth) ||
      (g.height !== source.height && g.height !== alignedHeight) ||
      g.width < Math.max(source.width, source.minWidth ?? 0) ||
      g.height < Math.max(source.height, source.minHeight ?? 0)) return false;
  }
  const finalPanels = placed.map(({ panel, geometry }) => ({ ...panel, geometry }));
  const normalizedBounds = normalizeWorkspaceCanvasBounds(canvasBounds, finalPanels);
  if (normalizedBounds.x !== canvasBounds.x || normalizedBounds.y !== canvasBounds.y ||
    normalizedBounds.width !== canvasBounds.width || normalizedBounds.height !== canvasBounds.height) return false;
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i].geometry, b = placed[j].geometry;
    const xGap = Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width);
    const yGap = Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height);
    if (a.x < b.x + b.width && a.x + a.width > b.x &&
      a.y < b.y + b.height && a.y + a.height > b.y) return false;
    if (placed[i].moved && placed[j].moved && gap > 0 && xGap < gap && yGap < gap) return false;
  }
  return true;
}

/** Plan Preserve Sizes without mutating workspace state; the hook commits only a complete valid plan. */
export function planPreserveSizesArrangement({
  panels, viewport, origin, scale, canvasBounds, gridSize, organizeGapUnits,
}: {
  panels: PanelInstance[];
  viewport: { width: number; height: number };
  origin: { x: number; y: number };
  scale: number;
  canvasBounds: WorkspaceCanvasBounds;
  gridSize: number;
  organizeGapUnits: number;
}): { plan: PreservePlan; strategy: "spatial" | "shelf" | "rejected"; reason?: string } {
  const gap = Math.max(0, organizeGapUnits) * gridSize;
  const eligible = eligibleArrangementPanels(panels, viewport, origin, scale);
  const emptyPlan: PreservePlan = { geometries: new Map(), camera: origin, scale };
  if (eligible.length === 0) return { plan: emptyPlan, strategy: "rejected", reason: "No eligible panels." };
  const valid = (plan: PreservePlan) => validateArrangementPlan(
    panels, eligible, plan.geometries, gridSize, gap, canvasBounds,
    origin, scale, plan.camera, plan.scale,
  );
  const preserveLiveDimensions = (plan: PreservePlan): PreservePlan => ({
    ...plan,
    geometries: new Map([...plan.geometries].map(([id, geometry]) => {
      const source = eligible.find((panel) => panel.id === id)!.geometry;
      return [id, { ...geometry, width: source.width, height: source.height }];
    })),
  });
  if (eligible.length <= PRESERVE_SPATIAL_SEARCH_MAX_PANELS) {
    try {
      const result = searchSpatialLayout(eligible.map((panel) => ({
        id: panel.id,
        ...panel.geometry,
      })), {
        gridSize,
        gapGridUnits: organizeGapUnits,
        canvasBounds,
        containerBounds: canvasBounds,
        obstacles: panels.filter((panel) => !eligible.some((item) => item.id === panel.id)).map((panel) => panel.geometry),
        camera: origin,
        scale,
      });
      const spatialPlan = preserveLiveDimensions({
        geometries: result.geometries,
        camera: result.camera,
        scale: result.scale,
      });
      if (valid(spatialPlan)) return { plan: spatialPlan, strategy: "spatial" };
    } catch (error) {
      console.warn("Spatial Organize candidate failed validation or search; trying the bounded shelf candidate.", error);
    }
  }
  const logicalViewport = {
    width: canvasBounds.width * scale,
    height: canvasBounds.height * scale,
  };
  const shelfPlan = preserveLiveDimensions(planSizePreservingArrangement({
    panels: eligible,
    viewport: logicalViewport,
    origin: { x: canvasBounds.x, y: canvasBounds.y },
    scale,
    gap,
    gridSize,
  }));
  if (valid(shelfPlan)) return { plan: shelfPlan, strategy: "shelf" };
  const reason = `No valid ${eligible.length > PRESERVE_SPATIAL_SEARCH_MAX_PANELS ? "bounded shelf" : "spatial or shelf"} arrangement fits the existing canvas without collisions.`;
  console.warn(`Organize was not applied. ${reason}`);
  return { plan: emptyPlan, strategy: "rejected", reason };
}

/** Pure state transition shared by the controller and integration tests. */
export function organizeWorkspaceState(
  current: WorkspaceState,
  viewport: { width: number; height: number },
  now: string,
): WorkspaceState {
  const activeTab = current.tabs.find((tab) => tab.id === current.activeTabId);
  if (!activeTab) return current;
  if (activeTab.organizeActive === true) {
    return {
      ...current,
      tabs: current.tabs.map((tab) => tab.id === activeTab.id
        ? { ...tab, organizeActive: false, updatedAt: now }
        : tab),
    };
  }
  if (![viewport.width, viewport.height].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return current;

  const arrangementInput = {
    panels: activeTab.panels,
    viewport,
    origin: activeTab.canvasCamera,
    scale: activeTab.canvasScale,
  };
  if (current.preferences.organizeMode === "uniform") {
    console.warn("Uniform Organize was not applied because its existing strategy resizes panels or changes camera state, which violates the position-only Organize contract.");
    return current;
  }
  const snapshot = activeTab.organizeSnapshot ?? {
    canvasBounds: { ...activeTab.canvasBounds },
    canvasScale: activeTab.canvasScale,
    canvasCamera: { ...activeTab.canvasCamera },
    geometries: Object.fromEntries(activeTab.panels.map((panel) => [panel.id, { ...panel.geometry }])),
  };
  const { plan, strategy } = planPreserveSizesArrangement({
    ...arrangementInput,
    canvasBounds: activeTab.canvasBounds,
    gridSize: current.preferences.gridSize,
    organizeGapUnits: current.preferences.organizeGapUnits ?? 0,
  });
  if (strategy === "rejected" || plan.geometries.size === 0) return current;
  return {
    ...current,
    tabs: current.tabs.map((tab) => tab.id !== activeTab.id ? tab : {
      ...tab,
      panels: tab.panels.map((panel) => {
        const geometry = plan.geometries.get(panel.id);
        return geometry ? { ...panel, geometry, updatedAt: now } : panel;
      }),
      organizeSnapshot: snapshot,
      organizeActive: true,
      updatedAt: now,
    }),
  };
}

export function restoreWorkspaceState(current: WorkspaceState, now: string): WorkspaceState {
  const activeTab = current.tabs.find((tab) => tab.id === current.activeTabId);
  const snapshot = activeTab?.organizeSnapshot;
  if (!activeTab || !snapshot) return current;
  return {
    ...current,
    tabs: current.tabs.map((tab) => tab.id !== activeTab.id ? tab : {
      ...tab,
      canvasBounds: { ...snapshot.canvasBounds },
      canvasScale: snapshot.canvasScale,
      canvasCamera: { ...snapshot.canvasCamera },
      panels: tab.panels.map((panel) => {
        const geometry = snapshot.geometries[panel.id];
        return geometry ? { ...panel, geometry: { ...geometry }, updatedAt: now } : panel;
      }),
      organizeSnapshot: null,
      organizeActive: false,
      updatedAt: now,
    }),
  };
}

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
  preferredGeometry?: PreferredPanelSize;
  existingPanels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  sourcePanelId?: string;
  panelSpacing?: number;
}): PanelGeometry {
  const sized = preferredGeometry
    ? clampOpeningGeometryToCanvasBounds(
        normalizeGeometry(
          {
            ...geometry,
            width: preferredGeometry.width ?? geometry.width,
            height: preferredGeometry.height ?? geometry.height,
            minWidth: geometry.minWidth,
            minHeight: geometry.minHeight,
          },
          geometry,
        ),
        canvasBounds,
      )
    : normalizeGeometry(
        {
          ...geometry,
          width: geometry.width,
          height: geometry.height,
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
    const placed = normalizeGeometry(
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
    return preferredGeometry
      ? clampOpeningGeometryToCanvasBounds(placed, canvasBounds)
      : placed;
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

export function clampOpeningGeometryToCanvasBounds(
  geometry: PanelGeometry,
  canvasBounds: WorkspaceCanvasBounds,
): PanelGeometry {
  const minWidth = geometry.minWidth ?? 260;
  const minHeight = geometry.minHeight ?? 160;
  const right = canvasBounds.x + canvasBounds.width;
  const bottom = canvasBounds.y + canvasBounds.height;
  const maxWidth = Math.max(minWidth, canvasBounds.width);
  const maxHeight = Math.max(minHeight, canvasBounds.height);
  const width = Math.min(geometry.width, maxWidth);
  const height = Math.min(geometry.height, maxHeight);
  const x = Math.max(0, Math.min(geometry.x, right - width));
  const y = Math.max(0, Math.min(geometry.y, bottom - height));

  return normalizeGeometry(
    {
      ...geometry,
      x,
      y,
      width,
      height,
      minWidth,
      minHeight,
    },
    geometry,
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
  preferredGeometry?: PreferredPanelSize;
  existingPanels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  sourcePanelId?: string;
  panelSpacing: number;
}): PanelGeometry {
  if (hasRememberedGeometry) {
    if (!preferredGeometry) {
      return seededGeometry;
    }

    return clampOpeningGeometryToCanvasBounds(
      normalizeGeometry(
        {
          ...seededGeometry,
          width: preferredGeometry.width ?? seededGeometry.width,
          height: preferredGeometry.height ?? seededGeometry.height,
        },
        seededGeometry,
      ),
      canvasBounds,
    );
  }

  if (initialPosition) {
    const positioned = normalizeGeometry(
      {
        ...seededGeometry,
        x: initialPosition.x,
        y: initialPosition.y,
      },
      seededGeometry,
    );
    return preferredGeometry
      ? clampOpeningGeometryToCanvasBounds(positioned, canvasBounds)
      : positioned;
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
  preferredGeometry?: PreferredPanelSize;
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
  reorderTab: (tabId: string, insertionIndex: number) => void;
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
  toggleActiveTabOrganize: (
    viewport: { width: number; height: number },
  ) => void;
  restoreActiveTabLayout: () => void;
  updatePanelState: (panelId: string, panelState: unknown) => void;
  updatePanelViewPreferences: (
    panelId: string,
    preferences: PanelViewPreferences,
  ) => void;
  updatePreferences: (preferences: Partial<WorkspacePreferences>) => void;
  updateActiveTabCanvasBounds: (bounds: WorkspaceCanvasBounds) => void;
  updateActiveTabCanvasScale: (canvasScale: number) => void;
  updateActiveTabCanvasCamera: (camera: WorkspaceCanvasCamera) => void;
  resetWorkspace: () => void;
};

export function shouldPersistWorkspaceAfterLoad(
  currentState: WorkspaceState,
  initialState: WorkspaceState,
  initialLoadWasRepaired: boolean,
) {
  return currentState !== initialState || !initialLoadWasRepaired;
}

export function useWorkspaceController({
  registry,
  persistence,
  defaultWorkspaceFactory,
  tabTemplateStorage,
}: WorkspaceControllerDependencies): WorkspaceController {
  const [initialLoad] = useState(() => persistence.loadWorkspace());
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialLoad.state);
  const initialWorkspaceRef = useRef(initialLoad.state);
  const [templateStorage] = useState(
    () => tabTemplateStorage ?? createLocalTabTemplateStorage(),
  );
  const [savedTabTemplates, setSavedTabTemplates] = useState<SavedTabTemplate[]>(
    () => templateStorage.load(),
  );

  useEffect(() => {
    // Do not overwrite the source document with a repaired in-memory copy on
    // mount. Keep the user's original bytes available until a deliberate
    // workspace change is made; clean migrations still persist as before.
    if (
      !shouldPersistWorkspaceAfterLoad(
        workspace,
        initialWorkspaceRef.current,
        initialLoad.report.repaired,
      )
    ) {
      return;
    }
    persistence.saveWorkspace(workspace);
  }, [initialLoad.report.repaired, persistence, workspace]);

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

  function closePanel(panelId: string) {
    const now = nowIso();
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId
          ? {
              ...tab,
              panels: repairFocusOrder(tab.panels.filter((panel) => panel.id !== panelId)),
              updatedAt: now,
            }
          : tab,
      ),
      preferences: {
        ...current.preferences,
        panelViews: Object.fromEntries(
          Object.entries(current.preferences.panelViews).filter(([id]) => id !== panelId),
        ),
      },
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
          ? normalizeGeometry(rememberedGeometry, canonicalGeometry)
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
          canvasCamera: {
            x: DEFAULT_WORKSPACE_CANVAS_BOUNDS.x,
            y: DEFAULT_WORKSPACE_CANVAS_BOUNDS.y,
          },
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
      const removedPanelIds = new Set(
        current.tabs
          .find((tab) => tab.id === tabId)
          ?.panels.map((panel) => panel.id) ?? [],
      );
      return {
        ...current,
        tabs,
        preferences: {
          ...current.preferences,
          panelViews: Object.fromEntries(
            Object.entries(current.preferences.panelViews).filter(
              ([id]) => !removedPanelIds.has(id),
            ),
          ),
        },
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

  function toggleActiveTabOrganize(
    viewport: { width: number; height: number },
  ) {
    const now = nowIso();

    setWorkspace((current) => organizeWorkspaceState(current, viewport, now));
  }

  function restoreActiveTabLayout() {
    const now = nowIso();
    setWorkspace((current) => restoreWorkspaceState(current, now));
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

  function updateActiveTabCanvasCamera(camera: WorkspaceCanvasCamera) {
    if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) {
      return;
    }

    const now = nowIso();

    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId &&
        (tab.canvasCamera.x !== camera.x || tab.canvasCamera.y !== camera.y)
          ? { ...tab, canvasCamera: camera, updatedAt: now }
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
    panelId: string,
    preferences: PanelViewPreferences,
  ) {
    setWorkspace((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        panelViews: {
          ...current.preferences.panelViews,
          ...(current.tabs.some((tab) =>
            tab.panels.some((panel) => panel.id === panelId),
          )
            ? { [panelId]: preferences }
            : {}),
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
    reorderTab: (tabId, insertionIndex) =>
      setWorkspace((current) =>
        reorderWorkspaceTabs(current, tabId, insertionIndex),
      ),
    savedTabTemplates,
    saveActiveTabTemplate,
    loadTabTemplate,
    exportTabsJson,
    importTabsJson,
    createPanel,
    closePanel,
    togglePanelMinimized,
    focusPanel,
    updatePanelGeometry,
    toggleActiveTabOrganize,
    restoreActiveTabLayout,
    updatePanelState,
    updatePanelViewPreferences,
    updatePreferences,
    updateActiveTabCanvasBounds,
    updateActiveTabCanvasScale,
    updateActiveTabCanvasCamera,
    resetWorkspace,
  };
}
