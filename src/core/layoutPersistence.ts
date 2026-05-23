import { registry } from "../panels/registry";
import { createId, nowIso } from "./id";
import type {
  LayoutRepairReport,
  PanelGeometry,
  PanelInstance,
  PersistedWorkspaceDocument,
  WorkspacePreferences,
  WorkspaceState,
  WorkspaceTab,
} from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

const STORAGE_KEY = "jarri.workspace.core.layout.v1";
const DOCUMENT_KIND = "jarri.workspace.layout";
const SAFE_PANEL_GEOMETRY: PanelGeometry = {
  x: 32,
  y: 32,
  width: 420,
  height: 260,
  minWidth: 280,
  minHeight: 180,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizePreferences(input: unknown): WorkspacePreferences {
  const raw = isRecord(input) ? input : {};
  const density = raw.density === "comfortable" ? "comfortable" : "compact";
  const themeMode =
    raw.themeMode === "light" || raw.themeMode === "dark" ? raw.themeMode : "system";

  return {
    scale: clamp(finiteNumber(raw.scale, 1), 0.75, 1.35),
    density,
    themeMode,
  };
}

function normalizeGeometry(
  input: unknown,
  fallback: PanelGeometry,
  warnings: string[],
): PanelGeometry {
  const raw = isRecord(input) ? input : {};
  const minWidth = finiteNumber(raw.minWidth, fallback.minWidth ?? 260);
  const minHeight = finiteNumber(raw.minHeight, fallback.minHeight ?? 160);
  const geometry = {
    x: Math.max(0, Math.round(finiteNumber(raw.x, fallback.x))),
    y: Math.max(0, Math.round(finiteNumber(raw.y, fallback.y))),
    width: Math.max(minWidth, Math.round(finiteNumber(raw.width, fallback.width))),
    height: Math.max(minHeight, Math.round(finiteNumber(raw.height, fallback.height))),
    minWidth,
    minHeight,
  };

  if (!isRecord(input)) {
    warnings.push("Repaired missing panel geometry.");
  }

  return geometry;
}

function missingPanelState(moduleId: string, panelType: string, originalState: unknown) {
  return {
    missing: true,
    moduleId,
    panelType,
    originalState,
  };
}

function normalizePanel(
  input: unknown,
  index: number,
  seenIds: Set<string>,
  warnings: string[],
): PanelInstance {
  const raw = isRecord(input) ? input : {};
  const moduleId = typeof raw.moduleId === "string" ? raw.moduleId : "core";
  const panelType = typeof raw.panelType === "string" ? raw.panelType : "missing";
  const definition = registry.getPanel(moduleId, panelType);
  const now = nowIso();
  let id = typeof raw.id === "string" && raw.id.trim() ? raw.id : createId("panel");

  if (seenIds.has(id)) {
    id = createId("panel");
    warnings.push("Repaired duplicate panel id.");
  }
  seenIds.add(id);

  if (!definition) {
    warnings.push(`Repaired unknown panel definition: ${moduleId}:${panelType}.`);
    return {
      id,
      moduleId: "core",
      panelType: "missing",
      title: typeof raw.title === "string" ? raw.title : "Missing Panel",
      geometry: normalizeGeometry(raw.geometry, {
        ...SAFE_PANEL_GEOMETRY,
        x: SAFE_PANEL_GEOMETRY.x + index * 24,
        y: SAFE_PANEL_GEOMETRY.y + index * 24,
      }, warnings),
      focusOrder: finiteNumber(raw.focusOrder, index + 1),
      stateVersion: 1,
      panelState: missingPanelState(moduleId, panelType, raw.panelState),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
      updatedAt: now,
    };
  }

  const normalizedState = definition.normalizeState(raw.panelState, { now });
  warnings.push(...normalizedState.warnings);

  const fallbackGeometry = {
    ...definition.defaultGeometry,
    minWidth: definition.minGeometry.width,
    minHeight: definition.minGeometry.height,
  };

  return {
    id,
    moduleId: definition.moduleId,
    panelType: definition.panelType,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : definition.title,
    geometry: normalizeGeometry(raw.geometry, fallbackGeometry, warnings),
    focusOrder: finiteNumber(raw.focusOrder, index + 1),
    stateVersion: definition.stateVersion,
    panelState: normalizedState.state,
    dirty: undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: now,
  };
}

function normalizeTab(
  input: unknown,
  index: number,
  seenTabIds: Set<string>,
  warnings: string[],
): WorkspaceTab {
  const raw = isRecord(input) ? input : {};
  const now = nowIso();
  let id = typeof raw.id === "string" && raw.id.trim() ? raw.id : createId("tab");

  if (seenTabIds.has(id)) {
    id = createId("tab");
    warnings.push("Repaired duplicate tab id.");
  }
  seenTabIds.add(id);

  const panelIds = new Set<string>();
  const panels = Array.isArray(raw.panels)
    ? raw.panels.map((panel, panelIndex) =>
        normalizePanel(panel, panelIndex, panelIds, warnings),
      )
    : [];

  return {
    id,
    title: typeof raw.title === "string" && raw.title.trim()
      ? raw.title
      : `Tab ${index + 1}`,
    panels: repairFocusOrder(panels),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: now,
  };
}

function repairFocusOrder(panels: PanelInstance[]) {
  return [...panels]
    .sort((a, b) => a.focusOrder - b.focusOrder)
    .map((panel, index) => ({ ...panel, focusOrder: index + 1 }));
}

export function createDefaultWorkspace(): WorkspaceState {
  const now = nowIso();
  const definitions = [
    registry.getPanel("demo", "truth"),
    registry.getPanel("demo", "timeline"),
    registry.getPanel("demo", "advisory-log"),
  ].filter((definition) => definition !== null);

  const panels = definitions.map((definition, index): PanelInstance => ({
    id: createId("panel"),
    moduleId: definition.moduleId,
    panelType: definition.panelType,
    title: definition.title,
    geometry: {
      ...definition.defaultGeometry,
      minWidth: definition.minGeometry.width,
      minHeight: definition.minGeometry.height,
    },
    focusOrder: index + 1,
    stateVersion: definition.stateVersion,
    panelState: definition.createInitialState({ now }),
    createdAt: now,
    updatedAt: now,
  }));

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: "default",
    activeTabId: "home",
    tabs: [
      {
        id: "home",
        title: "Core Demo",
        panels,
        createdAt: now,
        updatedAt: now,
      },
    ],
    preferences: {
      scale: 1,
      density: "compact",
      themeMode: "system",
    },
    registryVersion: "demo-v1",
  };
}

export function normalizeWorkspace(input: unknown): {
  state: WorkspaceState;
  report: LayoutRepairReport;
} {
  const warnings: string[] = [];

  if (!isRecord(input)) {
    return {
      state: createDefaultWorkspace(),
      report: {
        migrated: false,
        repaired: true,
        toSchemaVersion: WORKSPACE_SCHEMA_VERSION,
        warnings: ["Created default workspace because persisted state was missing."],
      },
    };
  }

  const fromSchemaVersion = finiteNumber(input.schemaVersion, 0);
  const seenTabIds = new Set<string>();
  let tabs = Array.isArray(input.tabs)
    ? input.tabs.map((tab, index) => normalizeTab(tab, index, seenTabIds, warnings))
    : [];

  if (tabs.length === 0) {
    tabs = createDefaultWorkspace().tabs;
    warnings.push("Repaired empty tab list with default tab.");
  }

  const activeTabId =
    typeof input.activeTabId === "string" &&
    tabs.some((tab) => tab.id === input.activeTabId)
      ? input.activeTabId
      : tabs[0].id;

  if (activeTabId !== input.activeTabId) {
    warnings.push("Repaired invalid active tab id.");
  }

  return {
    state: {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      workspaceId:
        typeof input.workspaceId === "string" && input.workspaceId.trim()
          ? input.workspaceId
          : "default",
      activeTabId,
      tabs,
      preferences: normalizePreferences(input.preferences),
      registryVersion:
        typeof input.registryVersion === "string" ? input.registryVersion : "demo-v1",
    },
    report: {
      migrated: fromSchemaVersion !== WORKSPACE_SCHEMA_VERSION,
      repaired: warnings.length > 0,
      fromSchemaVersion,
      toSchemaVersion: WORKSPACE_SCHEMA_VERSION,
      warnings,
    },
  };
}

export function loadWorkspace(): {
  state: WorkspaceState;
  report: LayoutRepairReport;
} {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return normalizeWorkspace(null);
  }

  try {
    const parsed = JSON.parse(raw) as PersistedWorkspaceDocument;
    if (!isRecord(parsed) || parsed.kind !== DOCUMENT_KIND || !isRecord(parsed.workspace)) {
      return normalizeWorkspace(null);
    }
    return normalizeWorkspace(parsed.workspace);
  } catch {
    return normalizeWorkspace(null);
  }
}

export function saveWorkspace(state: WorkspaceState) {
  const document: PersistedWorkspaceDocument = {
    kind: DOCUMENT_KIND,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    savedAt: nowIso(),
    workspace: state,
    modules: [
      {
        moduleId: "demo",
        version: "1.0.0",
        registeredPanelTypes: registry
          .listPanels()
          .filter((panel) => panel.moduleId === "demo")
          .map((panel) => panel.panelType),
      },
    ],
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export function resetWorkspaceStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}

