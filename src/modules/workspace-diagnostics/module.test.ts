import { bootstrapWorkspaceRuntime } from "../../bootstrap/workspaceRuntime";
import { createDefaultWorkspace } from "../../core/defaultWorkspace";
import { createLayoutPersistence, type LayoutStorageProvider } from "../../core/layoutPersistence";
import { createPanelRegistry } from "../../core/panelRegistry";
import { normalizeTemplateDocument, tabFromTemplate } from "../../core/tabTemplates";
import type { PersistedWorkspaceDocument } from "../../core/types";
import { migrateLegacyRuntimeDiagnosticIdentity } from "../../core/runtimeDiagnosticIdentity";
import { coreModule } from "../../panels/corePanels";
import { filterPanelMenuGroups, projectPanelMenuGroups } from "../../core/panelMenu";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}
function storageFor(workspace: Record<string, unknown>): LayoutStorageProvider {
  let document = { kind: "jarri.workspace.layout", schemaVersion: 1, savedAt: "2026-10-17T00:00:00Z", workspace, modules: [] } as unknown as PersistedWorkspaceDocument;
  return {
    load: () => document,
    save: (_id, next) => { document = next; },
    remove() {},
  };
}
function legacyPanel(id: string, panelType: string, panelState: unknown, focusOrder: number) {
  return {
    id, moduleId: "core", panelType, title: `Saved ${panelType}`,
    geometry: { x: 120 + (focusOrder - 1) * 12, y: 240 + (focusOrder - 1) * 12, width: 760, height: 440, minWidth: 400, minHeight: 320 },
    focusOrder, stateVersion: 1, panelState,
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
  };
}

const runtime = bootstrapWorkspaceRuntime();
try {
  const modules = runtime.listModules();
  assert(migrateLegacyRuntimeDiagnosticIdentity("core", "runtime-other") === null, "migration excludes unrelated Core panel types");
  assert(migrateLegacyRuntimeDiagnosticIdentity("other-module", "runtime-events") === null, "migration excludes similarly named panels in other modules");
  equal(modules.map(({ moduleId }) => moduleId).join(","), "core,workspace-diagnostics", "standard bootstrap registers Diagnostics as a separate module");
  equal(modules[1].title, "Workspace Diagnostics", "module metadata exposes the expected title");
  assert(!coreModule.panels.some(({ panelType }) => panelType.startsWith("runtime-")), "Core module must not own Runtime panel definitions");
  for (const panelType of ["runtime-diagnostics", "runtime-events", "runtime-inspector"]) {
    assert(runtime.registry.hasPanel("workspace-diagnostics", panelType), `standard bootstrap registers ${panelType} under Workspace Diagnostics`);
    assert(!runtime.registry.hasPanel("core", panelType), `Core does not retain the legacy ${panelType} identity`);
  }
  const groups = projectPanelMenuGroups(modules, runtime.registry.listPanels(), {
    moduleOrder: ["core", "workspace-diagnostics"], hiddenModuleIds: [], panelSort: "registered", expandedModuleIds: ["core", "workspace-diagnostics"],
  });
  assert(groups.some(({ module }) => module.moduleId === "core" && module.title === "Workspace Core"), "catalogue retains the Core group");
  assert(groups.some(({ module, panels }) => module.moduleId === "workspace-diagnostics" && module.title === "Workspace Diagnostics" && panels.length === 3), "catalogue exposes a distinct Diagnostics group");
  assert(filterPanelMenuGroups(groups, "Workspace Diagnostics").some(({ module }) => module.moduleId === "workspace-diagnostics"), "Diagnostics module and panels remain searchable");

  const state = createDefaultWorkspace(runtime.registry);
  const base = state.tabs[0];
  const secondTab = { ...base, id: "tab-diagnostics", title: "Saved Diagnostics", panels: [
    legacyPanel("event-instance", "runtime-events", { virtualHistory: true, historyScrollTop: 128, selectionChannel: "diagnostic-link" }, 1),
    legacyPanel("inspector-instance", "runtime-inspector", { selectionChannel: "diagnostic-link" }, 2),
    legacyPanel("diagnostics-instance", "runtime-diagnostics", { selectionChannel: "diagnostic-link" }, 3),
    legacyPanel("settings-instance", "settings", {}, 4),
  ] };
  const rawWorkspace = {
    ...state,
    activeTabId: "tab-diagnostics",
    tabs: [base, secondTab],
    surfacePresentationMemory: {
      "panel:core:runtime-events": { kind: "panel", moduleId: "core", panelType: "runtime-events", geometry: { x: 28, y: 36, width: 780, height: 460 }, panelState: { virtualHistory: true, historyScrollTop: 128, selectionChannel: "diagnostic-link" }, display: { mode: "normal" }, stateVersion: 1, updatedAt: "2026-10-02T00:00:00Z" },
    },
  } as unknown as Record<string, unknown>;
  const persistence = createLayoutPersistence({
    registry: runtime.registry,
    storageProvider: storageFor(rawWorkspace),
    defaultWorkspaceFactory: () => createDefaultWorkspace(runtime.registry),
    getModuleRecords: runtime.getModuleRecords,
  });
  runtime.traceSelection.select("diagnostic-link", "trace", "42");
  const result = persistence.loadWorkspace();
  const migratedTab = result.state.tabs.find(({ id }) => id === "tab-diagnostics");
  assert(migratedTab, "migration preserves the saved tab");
  equal(result.state.activeTabId, "tab-diagnostics", "migration preserves active tab placement");
  const events = migratedTab.panels.find(({ id }) => id === "event-instance");
  const inspector = migratedTab.panels.find(({ id }) => id === "inspector-instance");
  const diagnostics = migratedTab.panels.find(({ id }) => id === "diagnostics-instance");
  const settings = migratedTab.panels.find(({ id }) => id === "settings-instance");
  assert(events && inspector && diagnostics && settings, "migration preserves each panel instance");
  equal(events.moduleId, "workspace-diagnostics", "legacy events identity migrates");
  equal(events.id, "event-instance", "panel instance id is preserved");
  equal(events.geometry.x, 120, "panel geometry is preserved");
  equal(events.focusOrder, 1, "tab order is preserved");
  equal((events.panelState as { virtualHistory: boolean }).virtualHistory, true, "opt-in virtualization preference is preserved");
  equal((events.panelState as { historyScrollTop: number }).historyScrollTop, 128, "history scroll restoration is preserved");
  equal((events.panelState as { selectionChannel: string }).selectionChannel, "diagnostic-link", "legacy selection channel is preserved");
  equal((inspector!.panelState as { selectionChannel: string }).selectionChannel, "diagnostic-link", "Inspector remains linked to the migrated Events channel");
  equal(diagnostics!.moduleId, "workspace-diagnostics", "Diagnostics identity migrates independently");
  equal(settings!.moduleId, "core", "unrelated Core identity does not change");
  equal(result.state.surfacePresentationMemory["panel:workspace-diagnostics:runtime-events"]?.moduleId, "workspace-diagnostics", "surface presentation memory identity migrates");
  assert(!result.state.surfacePresentationMemory["panel:core:runtime-events"], "legacy surface key is removed after canonical migration");
  equal(runtime.traceSelection.getSnapshot().selections.find(({ channel }) => channel === "diagnostic-link")?.id, "42", "linked trace selection remains on its independent channel");
  assert(result.report.migrated, "identity migration is reported as migration");

  const collisionWorkspace = {
    ...rawWorkspace,
    surfacePresentationMemory: {
      "panel:core:runtime-events": { kind: "panel", moduleId: "core", panelType: "runtime-events", geometry: { x: 120, y: 132, width: 780, height: 460 }, panelState: { selectionChannel: "legacy-memory" }, display: { mode: "normal" }, stateVersion: 1, updatedAt: "2026-10-02T00:00:00Z" },
      "panel:workspace-diagnostics:runtime-events": { kind: "panel", moduleId: "workspace-diagnostics", panelType: "runtime-events", geometry: { x: 240, y: 252, width: 780, height: 460 }, panelState: { selectionChannel: "canonical-memory" }, display: { mode: "normal" }, stateVersion: 1, updatedAt: "2026-10-03T00:00:00Z" },
    },
  } as unknown as Record<string, unknown>;
  const collisionResult = createLayoutPersistence({
    registry: runtime.registry,
    storageProvider: storageFor(collisionWorkspace),
    defaultWorkspaceFactory: () => createDefaultWorkspace(runtime.registry),
    getModuleRecords: runtime.getModuleRecords,
  }).loadWorkspace();
  equal(collisionResult.state.surfacePresentationMemory["panel:workspace-diagnostics:runtime-events"]?.panelState && (collisionResult.state.surfacePresentationMemory["panel:workspace-diagnostics:runtime-events"]?.panelState as { selectionChannel: string }).selectionChannel, "canonical-memory", "canonical surface memory wins a key collision");
  equal(collisionResult.state.surfacePresentationMemory["panel:core:runtime-events"]?.panelState && (collisionResult.state.surfacePresentationMemory["panel:core:runtime-events"]?.panelState as { selectionChannel: string }).selectionChannel, "legacy-memory", "colliding legacy surface memory remains recoverable");
  assert(collisionResult.report.warnings.some((warning) => warning.includes("retained colliding legacy memory")), "surface-memory collision is reported rather than silently discarded");

  const templateDoc = normalizeTemplateDocument({ kind: "jarri.workspace.tabs", schemaVersion: 1, templates: [{ id: "saved-template", title: "Saved", sourceTitle: "Saved", panels: [{ moduleId: "core", panelType: "runtime-events", title: "Saved Events", geometry: { x: 96, y: 120, width: 780, height: 440 } }] }] });
  const templatePanel = templateDoc.templates[0].panels[0];
  equal(templatePanel.moduleId, "workspace-diagnostics", "legacy template identity migrates without registry-dependent repair");
  const restored = tabFromTemplate(templateDoc.templates[0], runtime.registry);
  equal(restored.panels[0].moduleId, "workspace-diagnostics", "template restores into the Diagnostics module");
  equal(restored.panels[0].panelType, "runtime-events", "template retains stable panel type");
  equal(restored.panels[0].geometry.x, 96, "template preserves panel geometry");
  assert((restored.panels[0].panelState as { virtualHistory?: boolean }).virtualHistory !== true, "template retains its existing no-panel-state contract and defaults virtualization off");

  const noDiagnostics = createPanelRegistry();
  coreModule.panels.forEach((panel) => noDiagnostics.registerPanel(panel));
  const missingTemplateTab = tabFromTemplate(templateDoc.templates[0], noDiagnostics);
  equal(missingTemplateTab.panels[0].panelType, "missing", "template restoration keeps ordinary missing-module behavior");
  const missingTemplateState = missingTemplateTab.panels[0].panelState as { moduleId: string; panelType: string };
  equal(missingTemplateState.moduleId, "workspace-diagnostics", "missing template records the migrated module identity");
  equal(missingTemplateState.panelType, "runtime-events", "missing template records the stable Runtime panel type");
  const missingWorkspace = {
    ...state,
    tabs: [{ ...base, panels: [legacyPanel("legacy-missing", "runtime-events", { virtualHistory: true }, 1)] }],
  } as unknown as Record<string, unknown>;
  const missingPersistence = createLayoutPersistence({
    registry: noDiagnostics,
    storageProvider: storageFor(missingWorkspace),
    defaultWorkspaceFactory: () => createDefaultWorkspace(noDiagnostics),
    getModuleRecords: () => [],
  });
  const missingResult = missingPersistence.loadWorkspace();
  const placeholder = missingResult.state.tabs[0].panels[0];
  equal(placeholder.panelType, "missing", "unavailable Diagnostics module follows ordinary missing-panel restoration");
  const original = placeholder.panelState as { moduleId: string; panelType: string; originalState: { virtualHistory: boolean } };
  equal(original.moduleId, "core", "missing placeholder records the original legacy module identity");
  equal(original.panelType, "runtime-events", "missing placeholder records the original legacy panel type");
  equal(original.originalState.virtualHistory, true, "missing placeholder keeps recoverable legacy panel state");
} finally {
  runtime.dispose();
}

console.log("Workspace Diagnostics module and identity migration tests passed.");
