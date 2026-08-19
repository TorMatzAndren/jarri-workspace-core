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
import { WORKSPACE_SCHEMA_VERSION } from "./types";

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
          width: 1800,
          height: 1100,
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
      panelSpacing: 0,
      systemSurfacePositions: {
        settings: { x: 924, y: 408 },
        addPanel: { x: 16, y: 100 },
        frameSettings: { x: 16, y: 100 },
      },
      clock: {
        enabled: true,
        timeFormat: "24h",
        dateFormat: "text",
      },
      density: "compact",
      themeMode: "system",
      fontFamily: "system",
      themePreset: "neutral",
      colorOverrides: {},
      panelMenu: {
        moduleOrder: ["core", "demo"],
        hiddenModuleIds: [],
        panelSort: "registered",
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
  const document = {
    kind: "jarri.workspace.layout",
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    savedAt: "2026-08-19T00:00:00.000Z",
    workspace,
    modules: [],
  } as unknown as PersistedWorkspaceDocument;

  return {
    load: () => document,
    save: () => {},
    remove: () => {},
  };
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

function main() {
  testLegacyWorkspaceGetsEmptyPresentationMemory();
  testValidPresentationMemorySurvivesNormalization();
  console.log("layout persistence presentation-memory tests passed");
}

main();
