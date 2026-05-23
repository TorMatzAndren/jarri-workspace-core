import { createId, nowIso } from "./id";
import { normalizeGeometry, repairFocusOrder } from "./layoutEngine";
import type { PanelRegistry } from "./panelRegistry";
import type {
  PanelGeometry,
  PanelInstance,
  SavedPanelTemplate,
  SavedTabTemplate,
  WorkspaceTab,
  WorkspaceTabTemplateDocument,
} from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

export const TAB_TEMPLATE_SCHEMA_VERSION = 1;
export const TAB_TEMPLATE_KIND = "jarri.workspace.tabs";

const TAB_TEMPLATE_STORAGE_KEY = "jarri.workspace.core.tabTemplates.v1";
const SAFE_PANEL_GEOMETRY: PanelGeometry = {
  x: 24,
  y: 24,
  width: 480,
  height: 300,
  minWidth: 280,
  minHeight: 180,
};

export type TabTemplateStorage = {
  load: () => SavedTabTemplate[];
  save: (templates: SavedTabTemplate[]) => void;
};

export function createLocalTabTemplateStorage(): TabTemplateStorage {
  return {
    load() {
      const raw = window.localStorage.getItem(TAB_TEMPLATE_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return normalizeTemplateDocument(JSON.parse(raw)).templates;
    },
    save(templates) {
      const document = createTemplateDocument(templates);
      window.localStorage.setItem(TAB_TEMPLATE_STORAGE_KEY, JSON.stringify(document));
    },
  };
}

export function createTemplateFromTab(tab: WorkspaceTab): SavedTabTemplate {
  const now = nowIso();

  return {
    id: createId("template"),
    title: tab.title,
    sourceTitle: tab.title,
    panels: tab.panels.map((panel) => ({
      moduleId: panel.moduleId,
      panelType: panel.panelType,
      title: panel.title,
      geometry: normalizeGeometry(panel.geometry, SAFE_PANEL_GEOMETRY),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function createTemplateDocument(
  templates: SavedTabTemplate[],
): WorkspaceTabTemplateDocument {
  return {
    kind: TAB_TEMPLATE_KIND,
    schemaVersion: TAB_TEMPLATE_SCHEMA_VERSION,
    exportedAt: nowIso(),
    templates: templates.map(normalizeTemplate),
  };
}

export function normalizeTemplateDocument(input: unknown): WorkspaceTabTemplateDocument {
  if (!isRecord(input) || input.kind !== TAB_TEMPLATE_KIND) {
    return createTemplateDocument([]);
  }

  const templates = Array.isArray(input.templates)
    ? input.templates.map(normalizeTemplate).filter((template) => template.panels.length > 0)
    : [];

  return {
    kind: TAB_TEMPLATE_KIND,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : nowIso(),
    templates,
  };
}

export function tabFromTemplate(
  template: SavedTabTemplate,
  registry: PanelRegistry,
  title = template.sourceTitle || template.title,
): WorkspaceTab {
  const now = nowIso();
  const panels = template.panels.map((panel, index) =>
    panelFromTemplate(panel, index, registry, now),
  );

  return {
    id: createId("tab"),
    title: title.trim() || "Imported Tab",
    panels: repairFocusOrder(panels),
    createdAt: now,
    updatedAt: now,
  };
}

function panelFromTemplate(
  panel: SavedPanelTemplate,
  index: number,
  registry: PanelRegistry,
  now: string,
): PanelInstance {
  const definition = registry.getPanel(panel.moduleId, panel.panelType);

  if (!definition) {
    return {
      id: createId("panel"),
      moduleId: "core",
      panelType: "missing",
      title: panel.title.trim() || "Missing Panel",
      geometry: normalizeGeometry(
        panel.geometry,
        offsetGeometry(SAFE_PANEL_GEOMETRY, index),
      ),
      focusOrder: index + 1,
      stateVersion: 1,
      panelState: {
        missing: true,
        moduleId: panel.moduleId,
        panelType: panel.panelType,
        originalState: null,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    id: createId("panel"),
    moduleId: definition.moduleId,
    panelType: definition.panelType,
    title: panel.title.trim() || definition.title,
    geometry: normalizeGeometry(panel.geometry, {
      ...definition.defaultGeometry,
      minWidth: definition.minGeometry.width,
      minHeight: definition.minGeometry.height,
    }),
    focusOrder: index + 1,
    stateVersion: definition.stateVersion,
    panelState: definition.createInitialState({ now }),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTemplate(input: unknown): SavedTabTemplate {
  const raw = isRecord(input) ? input : {};
  const now = nowIso();
  const title =
    typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Saved Tab";
  const sourceTitle =
    typeof raw.sourceTitle === "string" && raw.sourceTitle.trim()
      ? raw.sourceTitle.trim()
      : title;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : createId("template"),
    title,
    sourceTitle,
    panels: Array.isArray(raw.panels)
      ? raw.panels.map(normalizePanelTemplate)
      : [],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

function normalizePanelTemplate(input: unknown): SavedPanelTemplate {
  const raw = isRecord(input) ? input : {};
  return {
    moduleId: typeof raw.moduleId === "string" && raw.moduleId.trim()
      ? raw.moduleId
      : "core",
    panelType: typeof raw.panelType === "string" && raw.panelType.trim()
      ? raw.panelType
      : "missing",
    title: typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Panel",
    geometry: normalizeGeometry(
      isRecord(raw.geometry) ? raw.geometry : undefined,
      SAFE_PANEL_GEOMETRY,
    ),
  };
}

function offsetGeometry(geometry: PanelGeometry, index: number): PanelGeometry {
  return {
    ...geometry,
    x: geometry.x + index * 24,
    y: geometry.y + index * 24,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
