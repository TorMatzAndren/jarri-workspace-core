import { normalizeGeometry } from "./layoutEngine";
import { resolvePanelCreationGeometry } from "./workspaceController";
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
