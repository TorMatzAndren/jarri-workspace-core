import {
  beginGeometryInteraction,
  commitGeometryInteraction,
  previewGeometryInteraction,
} from "./layoutEngine";
import type { PanelInstance } from "./types";

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

const panel = {
  id: "grid-test-panel",
  moduleId: "test",
  panelType: "grid-test",
  title: "Grid Test",
  geometry: {
    x: 120,
    y: 120,
    width: 480,
    height: 360,
    minWidth: 120,
    minHeight: 120,
  },
  focusOrder: 1,
  stateVersion: 1,
  panelState: null,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
} as PanelInstance;

function testOnePixelMove() {
  const interaction = beginGeometryInteraction("move", panel, 0, 0, 1, 1);
  const preview = previewGeometryInteraction(interaction, 37, 53);

  assertEqual(preview.x, 157, "1px grid preserves pixel-resolution x");
  assertEqual(preview.y, 173, "1px grid preserves pixel-resolution y");
}

function testTwentyFourPixelMove() {
  const interaction = beginGeometryInteraction("move", panel, 0, 0, 1, 24);
  const preview = previewGeometryInteraction(interaction, 37, 53);

  assert(preview.x % 24 === 0, "24px grid snaps x to selected lattice");
  assert(preview.y % 24 === 0, "24px grid snaps y to selected lattice");
}

function testCanvasScaleControlsPointerDelta() {
  const interaction = beginGeometryInteraction("move", panel, 0, 0, 2, 12);
  const preview = previewGeometryInteraction(interaction, 48, 48);

  assertEqual(preview.x, 144, "2x canvas scale halves pointer x delta");
  assertEqual(preview.y, 144, "2x canvas scale halves pointer y delta");
}

function testGridCapturedForWholeInteraction() {
  const interaction = beginGeometryInteraction("move", panel, 0, 0, 1, 37);

  assertEqual(interaction.gridSize, 37, "interaction retains grid at drag start");
}

function testLargeGridResizeCommit() {
  const interaction = beginGeometryInteraction("resize", panel, 0, 0, 1, 1000);
  const preview = previewGeometryInteraction(interaction, 1700, 1400);
  const committed = commitGeometryInteraction(preview, interaction.gridSize);

  assertEqual(interaction.gridSize, 1000, "large grid is not clamped");
  assert(committed.width % 1000 === 0, "commit width uses selected grid");
  assert(committed.height % 1000 === 0, "commit height uses selected grid");
}

testOnePixelMove();
testTwentyFourPixelMove();
testCanvasScaleControlsPointerDelta();
testGridCapturedForWholeInteraction();
testLargeGridResizeCommit();

console.log("layout engine grid interaction tests passed");
