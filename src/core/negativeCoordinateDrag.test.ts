import {
  beginGeometryInteraction,
  previewGeometryInteraction,
  commitGeometryInteraction,
} from "./layoutEngine";
import type { PanelGeometry, PanelInstance } from "./types";

function check(actual: number, expected: number, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const geometry: PanelGeometry = {
  x: 24,
  y: 24,
  width: 768,
  height: 624,
  minWidth: 408,
  minHeight: 324,
};

const panel = { geometry } as PanelInstance;

// At 25% zoom, a 30-pixel pointer movement represents
// 120 logical canvas units.
const drag = beginGeometryInteraction(
  "move", panel, 100, 100, 0.25, 24,
);

const preview = previewGeometryInteraction(drag, 70, 64);

check(preview.x, -96, "leftward preview crosses zero");
check(preview.y, -120, "upward preview crosses zero");

const committed = commitGeometryInteraction(preview, 24);

check(committed.x, -96, "negative X survives commit");
check(committed.y, -120, "negative Y survives commit");

// Existing negative coordinates must remain movable.
const negativePanel = {
  geometry: { ...geometry, x: -288, y: -192 },
} as PanelInstance;

const secondDrag = beginGeometryInteraction(
  "move", negativePanel, 100, 100, 0.25, 24,
);

const secondPreview = previewGeometryInteraction(secondDrag, 70, 76);
const secondCommit = commitGeometryInteraction(secondPreview, 24);

check(secondCommit.x, -408, "existing negative X can move left");
check(secondCommit.y, -288, "existing negative Y can move up");

// Normal positive-coordinate behavior must remain unchanged.
const positiveDrag = beginGeometryInteraction(
  "move", panel, 100, 100, 1, 24,
);

const positivePreview = previewGeometryInteraction(
  positiveDrag, 148, 124,
);

check(positivePreview.x, 72, "positive horizontal movement");
check(positivePreview.y, 48, "positive vertical movement");

console.log("PASS: Negative-coordinate drag regression tests");
