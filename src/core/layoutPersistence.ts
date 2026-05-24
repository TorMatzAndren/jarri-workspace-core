import { createId, nowIso } from "./id";
import { normalizeGeometry, repairFocusOrder } from "./layoutEngine";
import type { PanelRegistry } from "./panelRegistry";
import type {
  LayoutRepairReport,
  PanelGeometry,
  PanelInstance,
  PersistedModuleRecord,
  PersistedWorkspaceDocument,
  WorkspaceColorTokens,
  WorkspacePreferences,
  WorkspaceState,
  WorkspaceTab,
} from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

const STORAGE_KEY = "jarri.workspace.core.layout.v1";
const LEGACY_STORAGE_KEYS: string[] = [];
const DOCUMENT_KIND = "jarri.workspace.layout";
const SAFE_PANEL_GEOMETRY: PanelGeometry = {
  x: 32,
  y: 32,
  width: 420,
  height: 260,
  minWidth: 280,
  minHeight: 180,
};

export type LayoutStorageProvider = {
  load: (workspaceId: string) => PersistedWorkspaceDocument | null;
  save: (workspaceId: string, document: PersistedWorkspaceDocument) => void;
  remove: (workspaceId: string) => void;
};

export type LayoutPersistence = {
  loadWorkspace: () => {
    state: WorkspaceState;
    report: LayoutRepairReport;
  };
  saveWorkspace: (state: WorkspaceState) => void;
  resetWorkspaceStorage: () => void;
};

type LayoutPersistenceDependencies = {
  registry: PanelRegistry;
  storageProvider?: LayoutStorageProvider;
  defaultWorkspaceFactory: () => WorkspaceState;
  getModuleRecords: () => PersistedModuleRecord[];
  workspaceId?: string;
};

export function createLocalStorageProvider(): LayoutStorageProvider {
  return {
    load() {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as PersistedWorkspaceDocument;
      }

      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = window.localStorage.getItem(legacyKey);
        if (legacyRaw) {
          return JSON.parse(legacyRaw) as PersistedWorkspaceDocument;
        }
      }

      return null;
    },
    save(_workspaceId, document) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
    },
    remove() {
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };
}

export function createLayoutPersistence({
  registry,
  storageProvider = createLocalStorageProvider(),
  defaultWorkspaceFactory,
  getModuleRecords,
  workspaceId = "default",
}: LayoutPersistenceDependencies): LayoutPersistence {
  function normalizeWorkspace(input: unknown): {
    state: WorkspaceState;
    report: LayoutRepairReport;
  } {
    const warnings: string[] = [];

    if (!isRecord(input)) {
      return {
        state: defaultWorkspaceFactory(),
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
      ? input.tabs.map((tab, index) =>
          normalizeTab(tab, index, seenTabIds, warnings, registry),
        )
      : [];

    if (tabs.length === 0) {
      tabs = defaultWorkspaceFactory().tabs;
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
            : workspaceId,
        activeTabId,
        tabs,
        preferences: normalizePreferences(input.preferences),
        registryVersion:
          typeof input.registryVersion === "string" ? input.registryVersion : "runtime-v1",
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

  return {
    loadWorkspace() {
      try {
        const document = storageProvider.load(workspaceId);
        if (
          !document ||
          !isRecord(document) ||
          document.kind !== DOCUMENT_KIND ||
          !isRecord(document.workspace)
        ) {
          return normalizeWorkspace(null);
        }
        return normalizeWorkspace(document.workspace);
      } catch (error) {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const backupKey = `${STORAGE_KEY}.corrupted.${Date.now()}`;
            window.localStorage.setItem(backupKey, raw);
          }
          console.error("[workspace-persistence] Failed to load persisted workspace.", error);
        } catch (backupError) {
          console.error("[workspace-persistence] Failed to preserve corrupted workspace.", backupError);
        }

        return normalizeWorkspace(null);
      }
    },
    saveWorkspace(state) {
      const document: PersistedWorkspaceDocument = {
        kind: DOCUMENT_KIND,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        savedAt: nowIso(),
        workspace: state,
        modules: getModuleRecords(),
      };

      storageProvider.save(workspaceId, document);
    },
    resetWorkspaceStorage() {
      storageProvider.remove(workspaceId);
    },
  };
}

function normalizePreferences(input: unknown): WorkspacePreferences {
  const raw = isRecord(input) ? input : {};
  const density = raw.density === "comfortable" ? "comfortable" : "compact";
  const themeMode =
    raw.themeMode === "light" || raw.themeMode === "dark" ? raw.themeMode : "system";
  const fontFamily =
    raw.fontFamily === "humanist" ||
    raw.fontFamily === "serif" ||
    raw.fontFamily === "mono" ||
    raw.fontFamily === "compact"
      ? raw.fontFamily
      : "system";
  const themePreset =
    raw.themePreset === "graphite" ||
    raw.themePreset === "contrast" ||
    raw.themePreset === "blueprint"
      ? raw.themePreset
      : "neutral";

  return {
    scale: clamp(finiteNumber(raw.scale, 1), 0.75, 1.35),
    fontSize: clamp(finiteNumber(raw.fontSize, 14), 12, 18),
    showGrid: typeof raw.showGrid === "boolean" ? raw.showGrid : true,
    canvasBounds: normalizeCanvasBounds(raw.canvasBounds),
    density,
    themeMode,
    fontFamily,
    themePreset,
    colorOverrides: normalizeColorOverrides(raw.colorOverrides),
    panelMenu: normalizePanelMenuPreferences(raw.panelMenu),
  };
}

function normalizePanelMenuPreferences(input: unknown): WorkspacePreferences["panelMenu"] {
  const raw = isRecord(input) ? input : {};
  const moduleOrder = Array.isArray(raw.moduleOrder)
    ? raw.moduleOrder.filter((entry): entry is string => typeof entry === "string")
    : ["core", "demo"];
  const hiddenModuleIds = Array.isArray(raw.hiddenModuleIds)
    ? raw.hiddenModuleIds.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    moduleOrder,
    hiddenModuleIds,
    panelSort: raw.panelSort === "title" ? "title" : "registered",
  };
}

function normalizeCanvasBounds(input: unknown): WorkspacePreferences["canvasBounds"] {
  const raw = isRecord(input) ? input : {};
  return {
    width: clamp(finiteNumber(raw.width, 1800), 900, 12000),
    height: clamp(finiteNumber(raw.height, 1100), 700, 12000),
  };
}

function normalizeColorOverrides(input: unknown): Partial<WorkspaceColorTokens> {
  if (!isRecord(input)) {
    return {};
  }

  const keys: Array<keyof WorkspaceColorTokens> = [
    "page",
    "canvas",
    "panel",
    "panelHeader",
    "text",
    "muted",
    "border",
    "button",
    "menu",
  ];
  const result: Partial<WorkspaceColorTokens> = {};

  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
      result[key] = value;
    }
  }

  return result;
}

function normalizePanelGeometry(
  input: unknown,
  fallback: PanelGeometry,
  warnings: string[],
): PanelGeometry {
  if (!isRecord(input)) {
    warnings.push("Repaired missing panel geometry.");
    return normalizeGeometry(undefined, fallback);
  }

  return normalizeGeometry(
    {
      x: finiteNumber(input.x, fallback.x),
      y: finiteNumber(input.y, fallback.y),
      width: finiteNumber(input.width, fallback.width),
      height: finiteNumber(input.height, fallback.height),
      minWidth: finiteNumber(input.minWidth, fallback.minWidth ?? 260),
      minHeight: finiteNumber(input.minHeight, fallback.minHeight ?? 160),
    },
    fallback,
  );
}


function normalizePanelDisplay(input: unknown): PanelInstance["display"] {
  if (!isRecord(input)) {
    return undefined;
  }

  const mode = input.mode === "minimized" ? "minimized" : "normal";
  const restoreGeometry = isRecord(input.restoreGeometry)
    ? normalizeGeometry(input.restoreGeometry, SAFE_PANEL_GEOMETRY)
    : undefined;

  if (mode === "minimized") {
    return {
      mode,
      restoreGeometry,
      minimizedAt: typeof input.minimizedAt === "string" ? input.minimizedAt : undefined,
    };
  }

  return {
    mode: "normal",
    restoreGeometry,
  };
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
  registry: PanelRegistry,
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
      geometry: normalizePanelGeometry(
        raw.geometry,
        {
          ...SAFE_PANEL_GEOMETRY,
          x: SAFE_PANEL_GEOMETRY.x + index * 24,
          y: SAFE_PANEL_GEOMETRY.y + index * 24,
        },
        warnings,
      ),
      focusOrder: finiteNumber(raw.focusOrder, index + 1),
      stateVersion: 1,
      panelState: missingPanelState(moduleId, panelType, raw.panelState),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
      updatedAt: now,
    };
  }

  const normalizedState = definition.normalizeState(raw.panelState, { now });
  warnings.push(...normalizedState.warnings);

  return {
    id,
    moduleId: definition.moduleId,
    panelType: definition.panelType,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : definition.title,
    geometry: normalizePanelGeometry(
      raw.geometry,
      {
        ...definition.defaultGeometry,
        minWidth: definition.minGeometry.width,
        minHeight: definition.minGeometry.height,
      },
      warnings,
    ),
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
  registry: PanelRegistry,
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
        normalizePanel(panel, panelIndex, panelIds, warnings, registry),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
