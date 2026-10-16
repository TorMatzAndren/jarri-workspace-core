import { projectPanelMenuGroups, movePanelMenuModule } from "./panelMenu";
import { panelSummarySemantic } from "./panelSemantics";
import type {
  PanelDefinition,
  PanelMenuPreferences,
  WorkspaceModuleDefinition,
} from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function panel(panelType: string, title: string): PanelDefinition {
  return {
    moduleId: "core",
    panelType,
    title,
    description: `${title} panel`,
    category: "core",
    defaultGeometry: { x: 0, y: 0, width: 320, height: 240 },
    minGeometry: { width: 240, height: 160 },
    stateVersion: 1,
    capabilities: {
      closable: true,
      resizable: true,
      movable: true,
      renameable: false,
      canBeDirty: false,
    },
    createInitialState: () => ({}),
    normalizeState: () => ({ state: {}, repaired: false, warnings: [] }),
    semanticStrategy: panelSummarySemantic("Ready", `${title} is available.`),
    Component: () => null,
  };
}

function preferences(
  overrides: Partial<PanelMenuPreferences> = {},
): PanelMenuPreferences {
  return {
    moduleOrder: ["core"],
    hiddenModuleIds: [],
    panelSort: "registered",
    expandedModuleIds: ["core"],
    ...overrides,
  };
}

function testNewRegisteredCorePanelReachesPanelMenuProjection() {
  const modules: WorkspaceModuleDefinition[] = [
    {
      moduleId: "core",
      title: "Workspace Core",
      version: "1.0.0",
      panels: [],
    },
  ];
  const panels = [
    panel("settings", "Settings"),
    panel("new-visible-panel", "New Visible Panel"),
  ];

  const groups = projectPanelMenuGroups(modules, panels, preferences());
  const coreGroup = groups.find((group) => group.module.moduleId === "core");

  assert(coreGroup, "Core group reaches the panel-menu projection");
  assert(
    coreGroup.panels.some(
      (definition) =>
        definition.moduleId === "core" &&
        definition.panelType === "new-visible-panel",
    ),
    "Newly registered visible Core panel reaches the panel-menu projection",
  );
}

function testHiddenModulePreferencesStillHideModulePanels() {
  const modules: WorkspaceModuleDefinition[] = [
    {
      moduleId: "core",
      title: "Workspace Core",
      version: "1.0.0",
      panels: [],
    },
  ];

  const groups = projectPanelMenuGroups(
    modules,
    [panel("file-browser", "File Browser")],
    preferences({ hiddenModuleIds: ["core"] }),
  );

  assertEqual(
    groups.length,
    0,
    "Explicit hidden-module preferences remain respected",
  );
}

testNewRegisteredCorePanelReachesPanelMenuProjection();
testHiddenModulePreferencesStillHideModulePanels();


function testModuleReordering() {
  const original = ["core", "hidden", "media", "development"];

  const moved = movePanelMenuModule(
    original,
    ["core", "media", "development"],
    "development",
    "core",
  );

  assertEqual(
    moved.join(","),
    "development,core,hidden,media",
    "Moving a module preserves hidden entries",
  );

  assertEqual(
    original.join(","),
    "core,hidden,media,development",
    "Original ordering remains unchanged",
  );

  const noOp = movePanelMenuModule(
    original,
    ["core", "media"],
    "hidden",
    "media",
  );

  assert(
    noOp === original,
    "Hidden modules cannot be dragged from the visible catalogue",
  );

  const appended = movePanelMenuModule(
    ["core", "hidden"],
    ["core", "media"],
    "media",
    "core",
  );

  assertEqual(
    appended.join(","),
    "media,core,hidden",
    "Newly registered modules can be reordered",
  );

  const same = movePanelMenuModule(
    original,
    ["core", "media"],
    "core",
    "core",
  );

  assert(
    same === original,
    "Dropping onto itself is a no-op",
  );
}

testModuleReordering();

console.log("panel menu projection tests passed");
