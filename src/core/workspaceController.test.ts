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
  existingPanels = [],
}: {
  seededGeometry?: PanelGeometry;
  hasRememberedGeometry?: boolean;
  initialPosition?: { x: number; y: number };
  existingPanels?: PanelInstance[];
} = {}) {
  return resolvePanelCreationGeometry({
    seededGeometry,
    hasRememberedGeometry,
    initialPosition,
    existingPanels,
    canvasBounds,
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

function testRememberedGeometryOwnsReopen() {
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
  });

  assertGeometry(
    geometry,
    remembered,
    "remembered geometry overrides summon position",
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

function main() {
  testExplicitPositionOwnsFirstSummon();
  testRememberedGeometryOwnsReopen();
  testRememberedGeometryNeedsNoExplicitPosition();
  testAutomaticPlacementRemainsFallback();
  console.log("workspace controller geometry tests passed");
}

main();
