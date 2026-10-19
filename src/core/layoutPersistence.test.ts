import {
  createLayoutPersistence,
  type LayoutStorageProvider,
} from "./layoutPersistence";
import { normalizeGeometry } from "./layoutEngine";
import { createPanelRegistry } from "./panelRegistry";
import type {
  PersistedWorkspaceDocument,
  WorkspaceState,
} from "./types";
import { DEFAULT_WORKSPACE_CANVAS_APPEARANCE, DEFAULT_WORKSPACE_GLASS_APPEARANCE, WORKSPACE_SCHEMA_VERSION } from "./types";

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

function createDefaultWorkspace(): WorkspaceState {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: "default",
    activeTabId: "home",
    tabs: [
      {
        id: "home",
        title: "Core Demo",
        canvasBounds: {
          x: 0,
          y: 0,
          width: 1800,
          height: 1100,
        },
        canvasScale: 1,
        canvasCamera: {
          x: 0,
          y: 0,
        },
        panels: [],
        createdAt: "2026-08-19T00:00:00.000Z",
        updatedAt: "2026-08-19T00:00:00.000Z",
      },
    ],
    preferences: {
      scale: 1,
      fontSize: 14,
      showGrid: true,
      gridSize: 12,
      panelSpacing: 0,
      organizeMode: "preserve",
      organizeGapUnits: 0,
      workspaceZoomIncrement: 10,
      workspaceZoomAnchorMode: "active-panel-center",
      panelNavigationAlignment: "panel-center",
      systemSurfacePositions: {
        settings: { x: 924, y: 408 },
        addPanel: { x: 16, y: 100 },
        frameSettings: { x: 16, y: 100 },
      },
      clock: {
        enabled: true,
        timeFormat: "24h",
        dateFormat: "text",
        showWeekNumber: true,
      },
      density: "compact",
      tabStripOverflow: "scroll",
      compressTabButtons: false,
      themeMode: "system",
      fontFamily: "system",
      themePreset: "neutral",
      canvasAppearance: { ...DEFAULT_WORKSPACE_CANVAS_APPEARANCE, wallpaper: { kind: "none" }, position: { x: 0.5, y: 0.5 } },
      glassAppearance: { ...DEFAULT_WORKSPACE_GLASS_APPEARANCE, surfaces: { ...DEFAULT_WORKSPACE_GLASS_APPEARANCE.surfaces } },
      colorOverrides: {},
      panelRadius: 8,
      panelMenu: {
        moduleOrder: ["core", "demo"],
        hiddenModuleIds: [],
        panelSort: "registered",
        expandedModuleIds: ["core", "demo"],
      },
      frameControls: {
        visibility: {},
      },
      panelViews: {},
    },
    surfacePresentationMemory: {},
    registryVersion: "runtime-v1",
  };
}

function createStorage(
  workspace: Record<string, unknown>,
): LayoutStorageProvider {
  let document = {
    kind: "jarri.workspace.layout",
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    savedAt: "2026-08-19T00:00:00.000Z",
    workspace,
    modules: [],
  } as unknown as PersistedWorkspaceDocument;

  return {
    load: () => document,
    save: (_workspaceId, nextDocument) => {
      document = nextDocument;
    },
    remove: () => {},
  };
}

function testPanelInstanceFrameFontPreferenceRoundTrips() {
  const workspace = basePersistedWorkspace();
  const tab = (workspace.tabs as Array<Record<string, unknown>>)[0];
  tab.panels = ["instance-a", "instance-b", "instance-new"].map((id, index) => ({
    id,
    moduleId: "core",
    panelType: "settings",
    title: `Settings ${index + 1}`,
    geometry: { x: index * 420, y: 0, width: 420, height: 260 },
    focusOrder: index + 1,
    stateVersion: 1,
    panelState: {},
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  }));
  const preferences = workspace.preferences as Record<string, unknown>;
  preferences.panelViews = {
    "instance-a": { fontScale: 0.9 },
    "instance-b": { fontScale: 1.6 },
  };
  const storage = createStorage(workspace);
  const persistence = createLayoutPersistence({
    registry: createPanelRegistry(),
    storageProvider: storage,
    defaultWorkspaceFactory: createDefaultWorkspace,
    getModuleRecords: () => [],
  });

  const initial = persistence.loadWorkspace().state;
  persistence.saveWorkspace(initial);
  const roundTrip = persistence.loadWorkspace().state.preferences.panelViews;

  assertEqual(roundTrip["instance-a"]?.fontScale, 0.9, "first instance scale survives persistence round-trip");
  assertEqual(roundTrip["instance-b"]?.fontScale, 1.6, "second instance scale survives persistence round-trip");
  assert(roundTrip["instance-new"] === undefined, "new instance begins without inherited Frame Font preference");
}

function testOrganizeLockPersistenceIsPerInstanceAndSeparateFromSurfaceMemory() {
  const workspace = basePersistedWorkspace();
  const tab = (workspace.tabs as Array<Record<string, unknown>>)[0];
  tab.panels = [
    { id: "settings-a", moduleId: "core", panelType: "settings", title: "Settings A",
      geometry: { x: 24, y: 24, width: 420, height: 360 }, focusOrder: 1, stateVersion: 1,
      panelState: {}, organizeLocked: true, createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" },
    { id: "settings-b", moduleId: "core", panelType: "settings", title: "Settings B",
      geometry: { x: 480, y: 24, width: 420, height: 360 }, focusOrder: 2, stateVersion: 1,
      panelState: {}, organizeLocked: false, createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" },
    { id: "missing-lock", moduleId: "removed", panelType: "gone", title: "Missing",
      geometry: { x: 936, y: 24, width: 420, height: 360 }, focusOrder: 3, stateVersion: 1,
      panelState: {}, organizeLocked: "yes", createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" },
    { id: "legacy-settings", moduleId: "core", panelType: "settings", title: "Legacy Settings",
      geometry: { x: 1392, y: 24, width: 420, height: 360 }, focusOrder: 4, stateVersion: 1,
      panelState: {}, createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" },
  ];
  const originalMemory = { "panel:core:settings": { kind: "panel", moduleId: "core", panelType: "settings",
    geometry: { x: 80, y: 90, width: 420, height: 360 }, panelState: { keep: true },
    updatedAt: "2026-08-19T00:00:00.000Z" } };
  workspace.surfacePresentationMemory = originalMemory;
  const storage = createStorage(workspace);
  const persistence = createLayoutPersistence({ registry: createPanelRegistry(), storageProvider: storage,
    defaultWorkspaceFactory: createDefaultWorkspace, getModuleRecords: () => [] });
  const loaded = persistence.loadWorkspace().state;
  assertEqual(loaded.tabs[0].panels[0].organizeLocked, true, "known panel's true lock persists");
  assertEqual(loaded.tabs[0].panels[1].organizeLocked, false, "false lock stays unlocked for same type instance");
  assertEqual(loaded.tabs[0].panels[2].organizeLocked, false, "invalid missing-panel lock normalizes to unlocked");
  assertEqual(loaded.tabs[0].panels[3].organizeLocked, false, "absent lock value normalizes to unlocked");
  const memoryBefore = JSON.stringify(loaded.surfacePresentationMemory);
  persistence.saveWorkspace(loaded);
  const reloaded = persistence.loadWorkspace().state;
  assertEqual(reloaded.tabs[0].panels[0].organizeLocked, true, "lock survives save and reload");
  assertEqual(reloaded.tabs[0].panels[1].organizeLocked, false, "unlocked instance remains independent");
  assertEqual(JSON.stringify(reloaded.surfacePresentationMemory), memoryBefore,
    "lock is not stored in or conflated with per-type surface presentation memory");
}

function testNegativePanelCoordinatesSurviveColdStartPersistenceRoundTrip() {
  const persisted = basePersistedWorkspace();
  const tab = (persisted.tabs as Array<Record<string, unknown>>)[0];
  tab.canvasBounds = { x: -720, y: -720, width: 1800, height: 1100 };
  tab.canvasCamera = { x: -480, y: -360 };
  tab.canvasScale = 0.25;
  tab.panels = [
    {
      id: "negative-panel-a",
      moduleId: "fixture",
      panelType: "missing-a",
      title: "Negative A",
      geometry: {
        x: -600,
        y: -600,
        width: 360,
        height: 240,
        minWidth: 240,
        minHeight: 180,
      },
      focusOrder: 1,
      stateVersion: 1,
      panelState: {},
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    },
    {
      id: "negative-panel-b",
      moduleId: "fixture",
      panelType: "missing-b",
      title: "Negative B",
      geometry: {
        x: -240,
        y: -600,
        width: 240,
        height: 240,
        minWidth: 240,
        minHeight: 180,
      },
      focusOrder: 2,
      stateVersion: 1,
      panelState: {},
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    },
  ];

  const storage = createStorage(persisted);
  const persistence = createLayoutPersistence({
    registry: createPanelRegistry(),
    storageProvider: storage,
    defaultWorkspaceFactory: createDefaultWorkspace,
    getModuleRecords: () => [],
  });
  const firstLoad = persistence.loadWorkspace().state;
  const firstTab = firstLoad.tabs[0];

  assertEqual(firstTab.canvasBounds.x, -720, "cold load preserves negative canvas x");
  assertEqual(firstTab.canvasBounds.y, -720, "cold load preserves negative canvas y");
  assertEqual(firstTab.canvasBounds.width, 1800, "cold load preserves canvas width");
  assertEqual(firstTab.canvasBounds.height, 1100, "cold load preserves canvas height");
  assertEqual(firstTab.canvasCamera.x, -480, "cold load preserves camera x");
  assertEqual(firstTab.canvasCamera.y, -360, "cold load preserves camera y");
  assertEqual(firstTab.canvasScale, 0.25, "cold load preserves zoom");
  assertEqual(firstTab.panels[0].geometry.x, -600, "cold load preserves panel A x");
  assertEqual(firstTab.panels[0].geometry.y, -600, "cold load preserves panel A y");
  assertEqual(firstTab.panels[0].geometry.width, 360, "cold load preserves panel A width");
  assertEqual(firstTab.panels[0].geometry.height, 240, "cold load preserves panel A height");
  assertEqual(firstTab.panels[1].geometry.x, -240, "cold load preserves distinct panel B x");
  assertEqual(firstTab.panels[1].geometry.y, -600, "cold load preserves panel B y");
  assertEqual(firstTab.panels[1].geometry.width, 240, "cold load preserves panel B width");
  assertEqual(firstTab.panels[1].geometry.height, 240, "cold load preserves panel B height");
  assertEqual(
    firstTab.panels[0].geometry.x + firstTab.panels[0].geometry.width,
    firstTab.panels[1].geometry.x,
    "negative-coordinate panels remain adjacent without overlap",
  );

  persistence.saveWorkspace(firstLoad);
  const secondTab = persistence.loadWorkspace().state.tabs[0];
  assertEqual(secondTab.canvasBounds.x, -720, "reload preserves canvas x");
  assertEqual(secondTab.canvasBounds.y, -720, "reload preserves canvas y");
  assertEqual(secondTab.canvasBounds.width, 1800, "reload preserves canvas width");
  assertEqual(secondTab.canvasBounds.height, 1100, "reload preserves canvas height");
  assertEqual(secondTab.canvasCamera.x, -480, "reload preserves camera x");
  assertEqual(secondTab.canvasCamera.y, -360, "reload preserves camera y");
  assertEqual(secondTab.canvasScale, 0.25, "reload preserves zoom");
  assertEqual(secondTab.panels[0].geometry.x, -600, "reload preserves panel A x");
  assertEqual(secondTab.panels[0].geometry.y, -600, "reload preserves panel A y");
  assertEqual(secondTab.panels[0].geometry.width, 360, "reload preserves panel A width");
  assertEqual(secondTab.panels[0].geometry.height, 240, "reload preserves panel A height");
  assertEqual(secondTab.panels[1].geometry.x, -240, "reload preserves panel B x");
  assertEqual(secondTab.panels[1].geometry.y, -600, "reload preserves panel B y");
  assertEqual(secondTab.panels[1].geometry.width, 240, "reload preserves panel B width");
  assertEqual(secondTab.panels[1].geometry.height, 240, "reload preserves panel B height");
}

function load(workspace: Record<string, unknown>) {
  const registry = createPanelRegistry();

  const persistence = createLayoutPersistence({
    registry,
    storageProvider: createStorage(workspace),
    defaultWorkspaceFactory: createDefaultWorkspace,
    getModuleRecords: () => [],
  });

  return persistence.loadWorkspace();
}

function basePersistedWorkspace(): Record<string, unknown> {
  const workspace = createDefaultWorkspace();

  return {
    ...workspace,
    tabs: workspace.tabs,
    preferences: workspace.preferences,
  };
}

function testLegacyWorkspaceGetsEmptyPresentationMemory() {
  const legacy = basePersistedWorkspace();
  delete legacy.surfacePresentationMemory;

  const result = load(legacy);

  assertEqual(
    Object.keys(result.state.surfacePresentationMemory).length,
    0,
    "legacy workspace receives empty presentation memory",
  );

  assertEqual(
    result.state.schemaVersion,
    WORKSPACE_SCHEMA_VERSION,
    "legacy workspace normalizes to current schema",
  );
}

function testValidPresentationMemorySurvivesNormalization() {
  const persisted = basePersistedWorkspace();

  persisted.surfacePresentationMemory = {
    "panel:core:settings": {
      kind: "panel",
      moduleId: "core",
      panelType: "settings",
      geometry: {
        x: 410,
        y: 275,
        width: 860,
        height: 690,
        minWidth: 360,
        minHeight: 336,
      },
      updatedAt: "2026-08-19T12:00:00.000Z",
    },
  };

  /*
   * Presentation memory is only valid for registered panel definitions.
   * Register the smallest definition necessary to establish ownership.
   */
  const registry = createPanelRegistry();

  registry.registerPanel({
    moduleId: "core",
    panelType: "settings",
    title: "Settings",
    description: "Test Settings panel.",
    category: "core",
    defaultGeometry: {
      x: 924,
      y: 408,
      width: 1020,
      height: 540,
    },
    minGeometry: {
      width: 360,
      height: 336,
    },
    stateVersion: 1,
    capabilities: {
      closable: true,
      resizable: true,
      movable: true,
      renameable: false,
      canBeDirty: false,
    },
    createInitialState: () => ({}),
    normalizeState: () => ({
      state: {},
      repaired: false,
      warnings: [],
    }),
    semanticStrategy: {
      kind: "pending",
      reason: "Persistence contract test.",
    },
    surfacePresentationMemory: {},
    Component: () => null,
  });

  const persistence = createLayoutPersistence({
    registry,
    storageProvider: createStorage(persisted),
    defaultWorkspaceFactory: createDefaultWorkspace,
    getModuleRecords: () => [],
  });

  const result = persistence.loadWorkspace();
  const remembered =
    result.state.surfacePresentationMemory["panel:core:settings"];

  assert(remembered !== undefined, "valid Settings memory should survive");
  assertEqual(remembered.kind, "panel", "remembered surface kind");

  if (remembered.kind !== "panel") {
    throw new Error("remembered Settings surface is not panel memory");
  }

  assert(remembered.geometry !== undefined, "remembered geometry should survive");

  const expectedGeometry = normalizeGeometry(
    {
      x: 410,
      y: 275,
      width: 860,
      height: 690,
      minWidth: 360,
      minHeight: 336,
    },
    {
      x: 924,
      y: 408,
      width: 1020,
      height: 540,
      minWidth: 360,
      minHeight: 336,
    },
  );

  assertEqual(remembered.geometry.x, expectedGeometry.x, "remembered x");
  assertEqual(remembered.geometry.y, expectedGeometry.y, "remembered y");
  assertEqual(
    remembered.geometry.width,
    expectedGeometry.width,
    "remembered width",
  );
  assertEqual(
    remembered.geometry.height,
    expectedGeometry.height,
    "remembered height",
  );
}

function testPinkSparkleThemePresetSurvivesNormalization() {
  const persisted = basePersistedWorkspace();
  const preferences = persisted.preferences as Record<string, unknown>;

  preferences.themePreset = "pink-sparkle";

  const result = load(persisted);

  assertEqual(
    result.state.preferences.themePreset,
    "pink-sparkle",
    "pink-sparkle theme preset survives normalization",
  );

  preferences.themePreset = "chronogit";
  assertEqual(
    load(persisted).state.preferences.themePreset,
    "chronogit",
    "chronogit theme preset survives normalization",
  );
}


function testPanelRadiusPersistence() {
  const persisted = basePersistedWorkspace();
  const preferences = persisted.preferences as Record<string, unknown>;

  preferences.panelRadius = 16;
  assertEqual(
    load(persisted).state.preferences.panelRadius,
    16,
    "custom panel radius persists",
  );

  preferences.panelRadius = 999;
  assertEqual(
    load(persisted).state.preferences.panelRadius,
    24,
    "radius clamps to 24",
  );

  preferences.panelRadius = -10;
  assertEqual(
    load(persisted).state.preferences.panelRadius,
    0,
    "radius clamps to zero",
  );

  preferences.panelRadius = "invalid";
  assertEqual(
    load(persisted).state.preferences.panelRadius,
    8,
    "invalid radius defaults to eight",
  );

  delete preferences.panelRadius;
  assertEqual(
    load(persisted).state.preferences.panelRadius,
    8,
    "legacy workspaces retain eight-pixel radius",
  );
}


function testDashboardNightThemePresetSurvivesNormalization() {
  const persisted = basePersistedWorkspace();
  const preferences = persisted.preferences as Record<string, unknown>;

  preferences.themePreset = "dashboard-night";
  preferences.panelRadius = 12;

  const result = load(persisted);

  assertEqual(
    result.state.preferences.themePreset,
    "dashboard-night",
    "Dashboard Night survives normalization",
  );

  assertEqual(
    result.state.preferences.panelRadius,
    12,
    "Dashboard Night does not replace custom radius",
  );
}

function testUnknownThemePresetRepairsToNeutral() {
  const persisted = basePersistedWorkspace();
  const preferences = persisted.preferences as Record<string, unknown>;

  preferences.themePreset = "future-theme-that-does-not-exist";

  const result = load(persisted);

  assertEqual(
    result.state.preferences.themePreset,
    "neutral",
    "unknown theme preset repairs to neutral",
  );
}

function testSchemaTwoCoreLayoutReceivesGenericCameraDefaults() {
  const persisted = basePersistedWorkspace();
  const tab = (persisted.tabs as Array<Record<string, unknown>>)[0];
  const preferences = persisted.preferences as Record<string, unknown>;

  tab.canvasBounds = {
    width: 1800,
    height: 1100,
  };
  delete tab.canvasScale;
  delete preferences.gridSize;
  delete preferences.workspaceZoomIncrement;
  delete preferences.workspaceZoomAnchorMode;
  delete preferences.panelNavigationAlignment;

  const result = load(persisted);
  const normalizedTab = result.state.tabs[0];

  assertEqual(
    result.state.schemaVersion,
    WORKSPACE_SCHEMA_VERSION,
    "schema-2 additive camera repair keeps current schema",
  );
  assertEqual(normalizedTab.canvasBounds.x, 0, "missing canvas x defaults to 0");
  assertEqual(normalizedTab.canvasBounds.y, 0, "missing canvas y defaults to 0");
  assertEqual(normalizedTab.canvasScale, 1, "missing canvasScale defaults to 1");
  assertEqual(normalizedTab.canvasCamera.x, 0, "missing camera x defaults to canvas x");
  assertEqual(normalizedTab.canvasCamera.y, 0, "missing camera y defaults to canvas y");
  assertEqual(result.state.preferences.gridSize, 12, "missing grid size default");
  assertEqual(
    result.state.preferences.workspaceZoomIncrement,
    10,
    "missing zoom increment default",
  );
  assertEqual(
    result.state.preferences.workspaceZoomAnchorMode,
    "active-panel-center",
    "missing zoom anchor default",
  );
  assertEqual(
    result.state.preferences.panelNavigationAlignment,
    "panel-center",
    "missing navigation alignment default",
  );
}

function testInvalidGenericCameraValuesRepairDeterministically() {
  const persisted = basePersistedWorkspace();
  const tab = (persisted.tabs as Array<Record<string, unknown>>)[0];
  const preferences = persisted.preferences as Record<string, unknown>;

  tab.canvasBounds = {
    x: Number.NaN,
    y: Number.POSITIVE_INFINITY,
    width: 120,
    height: "large",
  };
  tab.canvasScale = Number.NEGATIVE_INFINITY;
  tab.canvasCamera = {
    x: Number.NaN,
    y: "far down",
  };
  preferences.gridSize = Number.NaN;
  preferences.workspaceZoomIncrement = "large";
  preferences.workspaceZoomAnchorMode = "future-anchor";
  preferences.panelNavigationAlignment = "future-alignment";
  preferences.panelViews = {
    "instance-a": {
      fontScale: 1.5,
    },
    "instance-b": {
      fontScale: 1.75,
    },
    "deleted-instance": {
      fontScale: 1.25,
    },
    "demo:truth": {
      fontScale: 1.1,
    },
    "bad key": {
      fontScale: 1.75,
    },
  };
  tab.panels = ["instance-a", "instance-b"].map((id, index) => ({
    id,
    moduleId: "core",
    panelType: "settings",
    title: `Settings ${index + 1}`,
    geometry: { x: 0, y: 0, width: 420, height: 260 },
    focusOrder: index + 1,
    stateVersion: 1,
    panelState: {},
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  }));

  const result = load(persisted);
  const normalizedTab = result.state.tabs[0];

  assertEqual(normalizedTab.canvasBounds.x, 0, "invalid canvas x repairs to 0");
  assertEqual(normalizedTab.canvasBounds.y, 0, "invalid canvas y repairs to 0");
  assertEqual(
    normalizedTab.canvasBounds.width,
    900,
    "invalid/small canvas width repairs to minimum",
  );
  assertEqual(
    normalizedTab.canvasBounds.height,
    1100,
    "invalid canvas height repairs to fallback",
  );
  assertEqual(normalizedTab.canvasScale, 1, "invalid canvasScale repairs to 1");
  assertEqual(normalizedTab.canvasCamera.x, 0, "invalid camera x repairs to canvas x");
  assertEqual(normalizedTab.canvasCamera.y, 0, "invalid camera y repairs to canvas y");
  assertEqual(result.state.preferences.gridSize, 12, "invalid grid size repairs");
  assertEqual(
    result.state.preferences.workspaceZoomIncrement,
    10,
    "invalid zoom increment repairs",
  );
  assertEqual(
    result.state.preferences.workspaceZoomAnchorMode,
    "active-panel-center",
    "unknown zoom anchor repairs",
  );
  assertEqual(
    result.state.preferences.panelNavigationAlignment,
    "panel-center",
    "unknown navigation alignment repairs",
  );
  assertEqual(
    result.state.preferences.panelViews["instance-a"]?.fontScale,
    1.5,
    "first same-type instance retains its semantic font scale",
  );
  assertEqual(
    result.state.preferences.panelViews["instance-b"]?.fontScale,
    1.75,
    "second same-type instance retains an independent semantic font scale",
  );
  assert(
    result.state.preferences.panelViews["deleted-instance"] === undefined,
    "deleted panel instance preference is pruned",
  );
  assert(
    result.state.preferences.panelViews["demo:truth"] === undefined,
    "legacy type-scoped preference is no longer authoritative",
  );
  assert(
    result.state.preferences.panelViews["bad key"] === undefined,
    "invalid panelViews key remains discarded",
  );
}

function testCanvasBoundsPreserveNegativeOriginAndExpandAroundPanels() {
  const persisted = basePersistedWorkspace();
  const tab = (persisted.tabs as Array<Record<string, unknown>>)[0];

  tab.canvasBounds = {
    x: -240,
    y: -120,
    width: 1800,
    height: 1100,
  };
  delete tab.canvasCamera;
  tab.panels = [
    {
      id: "far-positive-panel",
      moduleId: "missing",
      panelType: "missing",
      title: "Far Positive Panel",
      geometry: {
        x: 1900,
        y: 1200,
        width: 300,
        height: 200,
      },
      focusOrder: 1,
      stateVersion: 1,
      panelState: {},
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    },
  ];

  const result = load(persisted);
  const normalizedTab = result.state.tabs[0];

  assertEqual(normalizedTab.canvasBounds.x, -240, "canvas preserves negative x origin");
  assertEqual(normalizedTab.canvasBounds.y, -120, "canvas preserves negative y origin");
  assertEqual(
    normalizedTab.canvasCamera.x,
    -240,
    "missing camera x defaults to negative canvas origin",
  );
  assertEqual(
    normalizedTab.canvasCamera.y,
    -120,
    "missing camera y defaults to negative canvas origin",
  );
  assertEqual(
    normalizedTab.canvasBounds.width,
    2436,
    "canvas width expands from negative origin around right panel extent",
  );
  assertEqual(
    normalizedTab.canvasBounds.height,
    1524,
    "canvas height expands around the actual grid-normalized panel extent without artificial clearance",
  );
}

function testRemovedApplicationPanelRemainsRecoverable() {
  const persisted = basePersistedWorkspace();
  const tab = (persisted.tabs as Array<Record<string, unknown>>)[0];
  const originalState = {
    windowId: "0x1234",
    released: true,
    applicationData: { preserve: "for recovery" },
  };
  tab.panels = [
    {
      id: "old-steam-client",
      moduleId: "steam",
      panelType: "client",
      title: "Steam",
      geometry: { x: 200, y: 160, width: 900, height: 600 },
      focusOrder: 1,
      stateVersion: 1,
      panelState: originalState,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    },
  ];

  const result = load(persisted);
  const recovered = result.state.tabs[0].panels[0];

  assertEqual(
    result.state.schemaVersion,
    WORKSPACE_SCHEMA_VERSION,
    "removed application panel does not change the workspace schema",
  );
  assertEqual(recovered.moduleId, "core", "removed module uses Core recovery panel");
  assertEqual(recovered.panelType, "missing", "removed panel uses missing placeholder");
  assertEqual(recovered.title, "Steam", "saved application panel title is retained");
  assertEqual(
    (recovered.panelState as { moduleId: string }).moduleId,
    "steam",
    "original module identity is retained",
  );
  assertEqual(
    JSON.stringify((recovered.panelState as { originalState: unknown }).originalState),
    JSON.stringify(originalState),
    "original application panel state remains recoverable",
  );
  assert(
    result.report.warnings.some((warning) => warning.includes("steam:client")),
    "load report explains the removed panel definition",
  );
}

function testCanvasCameraSurvivesNormalizationPerTab() {
  const persisted = basePersistedWorkspace();
  const baseTab = (persisted.tabs as Array<Record<string, unknown>>)[0];

  persisted.tabs = [
    {
      ...baseTab,
      id: "tab-a",
      canvasCamera: {
        x: -144,
        y: 288,
      },
    },
    {
      ...baseTab,
      id: "tab-b",
      canvasCamera: {
        x: 960,
        y: -72,
      },
      canvasScale: 1.5,
    },
  ];

  const result = load(persisted);
  const [tabA, tabB] = result.state.tabs;

  assertEqual(tabA.canvasCamera.x, -144, "tab A camera x survives");
  assertEqual(tabA.canvasCamera.y, 288, "tab A camera y survives");
  assertEqual(tabB.canvasCamera.x, 960, "tab B camera x survives");
  assertEqual(tabB.canvasCamera.y, -72, "tab B camera y survives");
  assertEqual(tabB.canvasScale, 1.5, "tab B zoom remains tab-local");
  assertEqual(
    result.state.preferences.scale,
    1,
    "global presentation scale remains independent",
  );
}

function testPanelMenuExpandedModulesNormalizeDeterministically() {
  const workspace = basePersistedWorkspace();
  const preferences = workspace.preferences as WorkspaceState["preferences"];
  preferences.panelMenu = {
    moduleOrder: ["demo", "core", "demo"],
    hiddenModuleIds: ["unused", "unused"],
    panelSort: "title",
    expandedModuleIds: ["demo", "core", 42, "demo"],
  } as unknown as WorkspaceState["preferences"]["panelMenu"];

  const panelMenu = load(workspace).state.preferences.panelMenu;

  assertEqual(
    panelMenu.moduleOrder.join(","),
    "demo,core",
    "Panel menu module order preserves unique string entries",
  );
  assertEqual(
    panelMenu.hiddenModuleIds.join(","),
    "unused",
    "Panel menu hidden modules preserve unique string entries",
  );
  assertEqual(
    panelMenu.panelSort,
    "title",
    "Panel menu sort survives expandedModuleIds normalization",
  );
  assertEqual(
    panelMenu.expandedModuleIds.join(","),
    "demo,core",
    "Expanded module ids preserve strings and discard malformed entries",
  );

  const missingExpanded = basePersistedWorkspace();
  delete (
    (missingExpanded.preferences as WorkspaceState["preferences"]).panelMenu as {
      expandedModuleIds?: unknown;
    }
  ).expandedModuleIds;

  assertEqual(
    load(missingExpanded).state.preferences.panelMenu.expandedModuleIds.join(","),
    "core,demo",
    "Missing expandedModuleIds defaults to discoverable Core and demo modules",
  );
}

function testAppearancePreferencesNormalizeAndPersistIndependently() {
  const legacy = basePersistedWorkspace();
  const legacyPreferences = legacy.preferences as Record<string, unknown>;
  delete legacyPreferences.canvasAppearance;
  delete legacyPreferences.glassAppearance;
  const defaults = load(legacy).state.preferences;
  assertEqual(defaults.glassAppearance.enabled, false, "legacy documents keep Glass disabled");
  assertEqual(defaults.canvasAppearance.wallpaper.kind, "none", "legacy documents have no wallpaper");

  const workspace = basePersistedWorkspace();
  const preferences = workspace.preferences as WorkspaceState["preferences"];
  preferences.glassAppearance.enabled = true;
  preferences.canvasAppearance.wallpaper = { kind: "gradient", from: "#102030", to: "#aabbcc", angle: 220 };
  preferences.colorOverrides = { panel: "#123456" };
  preferences.panelRadius = 17;
  const storage = createStorage(workspace);
  const persistence = createLayoutPersistence({
    registry: createPanelRegistry(), storageProvider: storage,
    defaultWorkspaceFactory: createDefaultWorkspace, getModuleRecords: () => [],
  });
  const state = persistence.loadWorkspace().state;
  state.preferences.themePreset = "chronogit";
  persistence.saveWorkspace(state);
  const switched = persistence.loadWorkspace().state.preferences;
  assertEqual(switched.glassAppearance.enabled, true, "Glass remains enabled across theme changes");
  assertEqual(switched.canvasAppearance.wallpaper.kind, "gradient", "gradient survives persistence");
  assertEqual(switched.colorOverrides.panel, "#123456", "semantic color override survives theme changes");
  assertEqual(switched.panelRadius, 17, "existing radius preference survives appearance persistence");

  const malformed = basePersistedWorkspace();
  const malformedPreferences = malformed.preferences as Record<string, unknown>;
  malformedPreferences.canvasAppearance = { wallpaper: { kind: "gradient", from: "bad", to: "#ffffff" } };
  malformedPreferences.glassAppearance = { enabled: "yes", mode: "bad", surfaceOpacity: 4 };
  const repaired = load(malformed).state.preferences;
  assertEqual(repaired.canvasAppearance.wallpaper.kind, "none", "invalid gradients repair to no wallpaper");
  assertEqual(repaired.glassAppearance.enabled, false, "malformed Glass enablement repairs disabled");
  assertEqual(repaired.glassAppearance.mode, "frosted", "malformed Glass mode repairs deterministically");
  assertEqual(repaired.glassAppearance.surfaceOpacity, 0.95, "Glass opacity clamps to its supported range");
}

function testTabStripPreferencesNormalizeAndRoundTrip() {
  const legacy = basePersistedWorkspace();
  const legacyPreferences = legacy.preferences as Record<string, unknown>;
  delete legacyPreferences.tabStripOverflow;
  delete legacyPreferences.compressTabButtons;
  const legacyNormalized = load(legacy).state.preferences;
  assertEqual(legacyNormalized.tabStripOverflow, "scroll", "legacy tab overflow defaults to scrolling");
  assertEqual(legacyNormalized.compressTabButtons, false, "legacy tab compression defaults off");

  const malformed = basePersistedWorkspace();
  const malformedPreferences = malformed.preferences as Record<string, unknown>;
  malformedPreferences.tabStripOverflow = "unsupported";
  malformedPreferences.compressTabButtons = "yes";
  const repaired = load(malformed).state.preferences;
  assertEqual(repaired.tabStripOverflow, "scroll", "invalid overflow repairs to scrolling");
  assertEqual(repaired.compressTabButtons, false, "invalid compression repairs off");

  const workspace = basePersistedWorkspace();
  const preferences = workspace.preferences as WorkspaceState["preferences"];
  preferences.tabStripOverflow = "wrap";
  preferences.compressTabButtons = true;
  const persistence = createLayoutPersistence({
    registry: createPanelRegistry(),
    storageProvider: createStorage(workspace),
    defaultWorkspaceFactory: createDefaultWorkspace,
    getModuleRecords: () => [],
  });
  const initial = persistence.loadWorkspace().state;
  const tabIds = initial.tabs.map((tab) => tab.id).join(",");
  persistence.saveWorkspace(initial);
  const roundTrip = persistence.loadWorkspace().state;
  assertEqual(roundTrip.preferences.tabStripOverflow, "wrap", "wrap mode persists");
  assertEqual(roundTrip.preferences.compressTabButtons, true, "compression persists");
  assertEqual(roundTrip.preferences.gridSize, initial.preferences.gridSize, "unrelated preferences remain intact");
  assertEqual(roundTrip.tabs.map((tab) => tab.id).join(","), tabIds, "presentation preferences do not lose tabs");
}

function testOrganizeSnapshotSurvivesNormalization() {
  const persisted = basePersistedWorkspace();
  const baseTab = (
    persisted.tabs as Array<Record<string, unknown>>
  )[0];

  const panelId = "organize-test-panel";
  const existingPanel = {
    id: panelId,
    moduleId: "core",
    panelType: "missing",
    title: "Organize test panel",
    geometry: {
      x: 48,
      y: 48,
      width: 420,
      height: 240,
      minWidth: 324,
      minHeight: 180,
    },
    focusOrder: 1,
    stateVersion: 1,
    panelState: {},
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
  };

  persisted.tabs = [
    {
      ...baseTab,
      panels: [existingPanel],
      organizeSnapshot: {
        canvasBounds: {
          x: -240,
          y: 0,
          width: 7728,
          height: 3384,
        },
        canvasScale: 0.5,
        canvasCamera: { x: 120, y: 48 },
        geometries: {
          [panelId]: {
            x: 48,
            y: 48,
            width: 420,
            height: 240,
            minWidth: 324,
            minHeight: 180,
          },
          removedPanel: {
            x: 12,
            y: 12,
            width: 400,
            height: 300,
          },
          invalidPanel: {
            x: "broken",
            y: 0,
            width: 10,
            height: 10,
          },
        },
      },
    },
  ];

  const result = load(persisted);
  const snapshot = result.state.tabs[0].organizeSnapshot;

  assert(snapshot, "Organize snapshot survives normalization");
  assertEqual(snapshot.canvasScale, 0.5, "Original zoom survives");
  assertEqual(snapshot.canvasCamera.x, 120, "Original camera survives");
  assertEqual(snapshot.canvasBounds.width, 7728, "Original bounds survive");
  assertEqual(
    snapshot.geometries[panelId].minWidth,
    324,
    "Original minimum width survives",
  );
  assert(
    !("removedPanel" in snapshot.geometries),
    "Deleted panel geometry is not retained",
  );
  assert(
    !("invalidPanel" in snapshot.geometries),
    "Invalid geometry is discarded",
  );
}

function main() {
  testPanelInstanceFrameFontPreferenceRoundTrips();
  testOrganizeLockPersistenceIsPerInstanceAndSeparateFromSurfaceMemory();
  testNegativePanelCoordinatesSurviveColdStartPersistenceRoundTrip();
  testLegacyWorkspaceGetsEmptyPresentationMemory();
  testValidPresentationMemorySurvivesNormalization();
  testPinkSparkleThemePresetSurvivesNormalization();
  testPanelRadiusPersistence();
  testDashboardNightThemePresetSurvivesNormalization();
  testUnknownThemePresetRepairsToNeutral();
  testSchemaTwoCoreLayoutReceivesGenericCameraDefaults();
  testInvalidGenericCameraValuesRepairDeterministically();
  testRemovedApplicationPanelRemainsRecoverable();
  testCanvasBoundsPreserveNegativeOriginAndExpandAroundPanels();
  testCanvasCameraSurvivesNormalizationPerTab();
  testPanelMenuExpandedModulesNormalizeDeterministically();
  testAppearancePreferencesNormalizeAndPersistIndependently();
  testTabStripPreferencesNormalizeAndRoundTrip();
  testOrganizeSnapshotSurvivesNormalization();
  console.log("layout persistence tests passed");
}

main();
