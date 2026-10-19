import { normalizeGeometry } from "./layoutEngine";
import {
  resolvePanelCreationGeometry,
  closeWorkspacePanel,
  shouldPersistWorkspaceAfterLoad,
} from "./workspaceController";
import type { PanelGeometry, PanelInstance } from "./types";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertGeometry(
  actual: PanelGeometry,
  expected: PanelGeometry,
  message: string,
) {
  assertEqual(actual.x, expected.x, `${message} x`);
  assertEqual(actual.y, expected.y, `${message} y`);
  assertEqual(actual.width, expected.width, `${message} width`);
  assertEqual(actual.height, expected.height, `${message} height`);
}

function testRepairedInitialLoadWaitsForUserMutationBeforeSaving() {
  const initialState = {} as never;
  assertEqual(
    shouldPersistWorkspaceAfterLoad(initialState, initialState, true),
    false,
    "repaired normalized state is not silently persisted on mount",
  );
  assertEqual(
    shouldPersistWorkspaceAfterLoad({} as never, initialState, true),
    true,
    "an explicit workspace state change is persisted after repaired load",
  );
  assertEqual(
    shouldPersistWorkspaceAfterLoad(initialState, initialState, false),
    true,
    "clean initial load retains normal persistence behavior",
  );
}

function testGeometryNormalizationKeepsCreationDefaultAndAllowsPersistedSignedMode() {
  const input = { ...canonicalGeometry, x: -24, y: -36 };
  const defaultGeometry = normalizeGeometry(input, canonicalGeometry);
  const signedGeometry = normalizeGeometry(input, canonicalGeometry, {
    allowNegativePosition: true,
  });

  assertEqual(defaultGeometry.x, 0, "default geometry normalization keeps its nonnegative creation contract");
  assertEqual(defaultGeometry.y, 0, "default geometry normalization keeps its nonnegative creation contract");
  assertEqual(signedGeometry.x, -24, "signed persistence normalization retains negative x");
  assertEqual(signedGeometry.y, -36, "signed persistence normalization retains negative y");
}

const canvasBounds = {
  x: 0,
  y: 0,
  width: 1800,
  height: 1100,
};

const canonicalGeometry: PanelGeometry = {
  x: 924,
  y: 408,
  width: 1020,
  height: 540,
  minWidth: 360,
  minHeight: 336,
};

function resolve({
  seededGeometry = canonicalGeometry,
  hasRememberedGeometry = false,
  initialPosition,
  preferredGeometry,
  existingPanels = [],
  bounds = canvasBounds,
}: {
  seededGeometry?: PanelGeometry;
  hasRememberedGeometry?: boolean;
  initialPosition?: { x: number; y: number };
  preferredGeometry?: { width?: number; height?: number };
  existingPanels?: PanelInstance[];
  bounds?: typeof canvasBounds;
} = {}) {
  return resolvePanelCreationGeometry({
    seededGeometry,
    hasRememberedGeometry,
    initialPosition,
    preferredGeometry,
    existingPanels,
    canvasBounds: bounds,
    panelSpacing: 0,
  });
}

function testExplicitPositionOwnsFirstSummon() {
  const geometry = resolve({
    initialPosition: { x: 120, y: 160 },
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 120,
        y: 160,
      },
      canonicalGeometry,
    ),
    "explicit position owns first summon after geometry normalization",
  );
}

function testRememberedPositionSurvivesPreferredOpeningSize() {
  const remembered: PanelGeometry = {
    x: 410,
    y: 275,
    width: 860,
    height: 690,
    minWidth: 360,
    minHeight: 336,
  };

  const geometry = resolve({
    seededGeometry: remembered,
    hasRememberedGeometry: true,
    initialPosition: { x: 120, y: 160 },
    preferredGeometry: { width: 1300, height: 700 },
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...remembered,
        width: 1300,
        height: 700,
      },
      remembered,
    ),
    "preferred geometry overrides remembered size while preserving remembered position",
  );
}

function testRememberedGeometryNeedsNoExplicitPosition() {
  const remembered: PanelGeometry = {
    x: 555,
    y: 333,
    width: 900,
    height: 620,
    minWidth: 360,
    minHeight: 336,
  };

  const geometry = resolve({
    seededGeometry: remembered,
    hasRememberedGeometry: true,
  });

  assertGeometry(
    geometry,
    remembered,
    "remembered geometry survives ordinary reopen",
  );
}

function testAutomaticPlacementRemainsFallback() {
  const geometry = resolve();

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 0,
        y: 0,
      },
      canonicalGeometry,
    ),
    "automatic placement uses canonical size at empty-tab origin",
  );
}

function testSourcePanelPlacementRemainsCausal() {
  const sourcePanel = {
    id: "panel-source",
    moduleId: "core",
    panelType: "notes",
    title: "Source",
    geometry: normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 240,
        y: 168,
        width: 720,
        height: 480,
      },
      canonicalGeometry,
    ),
    focusOrder: 1,
    stateVersion: 1,
    panelState: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies PanelInstance;

  const geometry = resolvePanelCreationGeometry({
    seededGeometry: canonicalGeometry,
    hasRememberedGeometry: false,
    existingPanels: [sourcePanel],
    canvasBounds,
    sourcePanelId: sourcePanel.id,
    panelSpacing: 24,
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: sourcePanel.geometry.x + sourcePanel.geometry.width + 24,
        y: sourcePanel.geometry.y,
      },
      canonicalGeometry,
    ),
    "source-panel opening remains causal placement",
  );
}

function testSmallPreferredGeometryOwnsOpeningSize() {
  const geometry = resolve({
    seededGeometry: normalizeGeometry(
      {
        ...canonicalGeometry,
        width: 600,
        height: 420,
      },
      canonicalGeometry,
    ),
    preferredGeometry: { width: 600, height: 420 },
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 0,
        y: 0,
        width: 600,
        height: 420,
      },
      canonicalGeometry,
    ),
    "small preferred geometry replaces panel default size",
  );
}

function testPreferredGeometryBelowMinimumUsesMinimum() {
  const geometry = resolve({
    seededGeometry: normalizeGeometry(
      {
        ...canonicalGeometry,
        width: 120,
        height: 120,
      },
      canonicalGeometry,
    ),
    preferredGeometry: { width: 120, height: 120 },
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 0,
        y: 0,
        width: canonicalGeometry.minWidth,
        height: canonicalGeometry.minHeight,
      },
      canonicalGeometry,
    ),
    "preferred geometry below minimum is normalized to panel minimum",
  );
}

function testHugePreferredGeometryIsClampedToWorkspaceBounds() {
  const bounds = {
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
  };

  const geometry = resolve({
    seededGeometry: normalizeGeometry(
      {
        ...canonicalGeometry,
        width: 5000,
        height: 4000,
      },
      canonicalGeometry,
    ),
    preferredGeometry: { width: 5000, height: 4000 },
    bounds,
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
      },
      canonicalGeometry,
    ),
    "huge preferred geometry is clamped to current workspace bounds",
  );
  assertEqual(
    bounds.width,
    1600,
    "preferred-size clamp does not mutate workspace width",
  );
  assertEqual(
    bounds.height,
    900,
    "preferred-size clamp does not mutate workspace height",
  );
}

function testPreferredGeometryDoesNotClampOrdinaryCreation() {
  const geometry = resolve({
    seededGeometry: normalizeGeometry(
      {
        ...canonicalGeometry,
        width: 2000,
        height: 1300,
      },
      canonicalGeometry,
    ),
    bounds: { x: 0, y: 0, width: 1600, height: 900 },
  });

  assertGeometry(
    geometry,
    normalizeGeometry(
      {
        ...canonicalGeometry,
        x: 0,
        y: 0,
        width: 2000,
        height: 1300,
      },
      canonicalGeometry,
    ),
    "creation without preferred geometry preserves existing behavior",
  );
}

function main() {
  testRepairedInitialLoadWaitsForUserMutationBeforeSaving();
  testGeometryNormalizationKeepsCreationDefaultAndAllowsPersistedSignedMode();
  testExplicitPositionOwnsFirstSummon();
  testRememberedPositionSurvivesPreferredOpeningSize();
  testRememberedGeometryNeedsNoExplicitPosition();
  testAutomaticPlacementRemainsFallback();
  testSourcePanelPlacementRemainsCausal();
  testSmallPreferredGeometryOwnsOpeningSize();
  testPreferredGeometryBelowMinimumUsesMinimum();
  testHugePreferredGeometryIsClampedToWorkspaceBounds();
  testPreferredGeometryDoesNotClampOrdinaryCreation();
  console.log("workspace controller geometry tests passed");
}

main();


function testClosingPanelCapturesFinalGeometry() {
  const geometry: PanelGeometry = {
    x: -480,
    y: -240,
    width: 1008,
    height: 744,
    minWidth: 360,
    minHeight: 336,
  };

  const closingPanel = {
    id: "settings-instance",
    moduleId: "core",
    panelType: "settings",
    geometry,
    focusOrder: 1,
  } as PanelInstance;

  const remainingPanel = {
    ...closingPanel,
    id: "file-browser-instance",
    panelType: "file-browser",
    focusOrder: 2,
  };

  const workspace = {
    activeTabId: "tab-1",
    tabs: [
      {
        id: "tab-1",
        panels: [closingPanel, remainingPanel],
      },
    ],
    preferences: {
      panelViews: {
        "settings-instance": { fontScale: 1 },
        "file-browser-instance": { fontScale: 1 },
      },
    },
    surfacePresentationMemory: {},
  } as unknown as Parameters<typeof closeWorkspacePanel>[0];

  const closed = closeWorkspacePanel(
    workspace,
    closingPanel,
    "2026-10-19T00:00:00Z",
    true,
  );

  const remembered =
    closed.surfacePresentationMemory["panel:core:settings"];

  if (!remembered?.geometry) {
    throw new Error("Closing a supported panel must remember its geometry");
  }

  assertGeometry(
    remembered.geometry,
    geometry,
    "closing a panel preserves final signed geometry",
  );

  assertEqual(
    closed.tabs[0].panels.length,
    1,
    "closed panel is removed from active tab",
  );

  assertEqual(
    closed.tabs[0].panels[0].id,
    remainingPanel.id,
    "other panel instances remain open",
  );

  assertEqual(
    Object.keys(closed.preferences.panelViews).length,
    1,
    "closed instance preferences are removed",
  );

  const reopened = resolve({
    seededGeometry: normalizeGeometry(
      remembered.geometry,
      canonicalGeometry,
      { allowNegativePosition: true },
    ),
    hasRememberedGeometry: true,
  });

  assertGeometry(
    reopened,
    geometry,
    "reopen restores final signed geometry",
  );

  const withoutMemory = closeWorkspacePanel(
    workspace,
    closingPanel,
    "2026-10-19T00:00:00Z",
    false,
  );

  assertEqual(
    Object.keys(withoutMemory.surfacePresentationMemory).length,
    0,
    "panels without memory policy do not create memory",
  );
}

testClosingPanelCapturesFinalGeometry();
