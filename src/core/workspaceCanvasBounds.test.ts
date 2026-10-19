import { normalizeWorkspaceCanvasBounds } from "./workspaceCanvasBounds";
import type { PanelInstance, WorkspaceCanvasBounds } from "./types";

function equal(actual: number, expected: number, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const base: WorkspaceCanvasBounds = { x: 0, y: 0, width: 1800, height: 4704 };
function panel(id: string, y: number, height: number): PanelInstance {
  return {
    id, moduleId: "test", panelType: id, title: id,
    geometry: { x: 0, y, width: 600, height, minWidth: 300, minHeight: 200 },
    focusOrder: 1, stateVersion: 1, panelState: {},
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function testLiveExtentEstablishesAndReleasesBoundsFloor() {
  const tall = panel("tall", 4000, 656);
  const atExtent = normalizeWorkspaceCanvasBounds(base, [tall]);
  equal(atExtent.height, 4704, "existing user canvas extent is retained during panel normalization");

  const resized = { ...tall, geometry: { ...tall.geometry, height: 200 } };
  const afterResize = normalizeWorkspaceCanvasBounds(
    { x: 0, y: 0, width: 1800, height: 700 },
    [resized],
  );
  equal(afterResize.height, 4200, "manual contraction reaches the actual resized panel edge");

  const afterRemoval = normalizeWorkspaceCanvasBounds(
    { x: 0, y: 0, width: 1800, height: 700 },
    [],
  );
  equal(afterRemoval.height, 720, "removing the extent-establishing geometry allows contraction to the rounded minimum");
}

function test4704FloorDoesNotSurviveManualContraction() {
  const tall = panel("tall", 4000, 656);

  const contracted = normalizeWorkspaceCanvasBounds(
    { x: 0, y: 0, width: 1800, height: 700 },
    [tall],
  );

  equal(
    contracted.height,
    4656,
    "4704px artificial floor removed; canvas contracts to actual panel bottom",
  );

  const smaller = {
    ...tall,
    geometry: { ...tall.geometry, height: 200 },
  };

  const afterPanelResize = normalizeWorkspaceCanvasBounds(
    { x: 0, y: 0, width: 1800, height: 700 },
    [smaller],
  );

  equal(
    afterPanelResize.height,
    4200,
    "later manual contraction uses current geometry, not historic extent",
  );
}

function testNegativeOriginContractionHasNoGlobalOriginFloor() {
  const contracted = normalizeWorkspaceCanvasBounds(
    { x: 0, y: -3984, width: 2832, height: 700 },
    [],
  );

  equal(contracted.x, 0, "negative-origin fixture keeps its proposed x origin");
  equal(contracted.y, -3984, "negative-origin fixture keeps its proposed y origin");
  equal(contracted.width, 2832, "existing width remains when greater than the minimum");
  equal(
    contracted.height,
    720,
    "700px minimum is rounded to the 24px grid relative to y=-3984 instead of forcing 4704px",
  );
}

function testNoPanelMinimumIsRelativeToProposedOrigin() {
  const normalized = normalizeWorkspaceCanvasBounds(
    { x: -1200, y: -3984, width: 100, height: 100 },
    [],
  );

  equal(normalized.x, -1200, "minimum width keeps the proposed negative x origin");
  equal(normalized.y, -3984, "minimum height keeps the proposed negative y origin");
  equal(normalized.width, 912, "no-panel minimum width is measured from proposed x and grid-rounded");
  equal(normalized.height, 720, "no-panel minimum height is measured from proposed y and grid-rounded");
}

function testPanelsRemainContainedDuringNegativeOriginContraction() {
  const outlying = {
    ...panel("outlying", -3200, 300),
    geometry: {
      ...panel("outlying", -3200, 300).geometry,
      x: -120,
      width: 600,
      height: 300,
    },
  };
  const contracted = normalizeWorkspaceCanvasBounds(
    { x: -240, y: -3984, width: 900, height: 700 },
    [outlying],
  );

  equal(contracted.x, -240, "panel within left edge does not move the proposed origin");
  equal(contracted.y, -3984, "panel within top edge does not move the proposed origin");
  equal(contracted.width, 912, "proposed minimum width is retained and grid-rounded");
  equal(contracted.height, 1104, "bottom edge expands only enough to contain the panel, rounded to the 24px grid");
  if (
    outlying.geometry.x < contracted.x ||
    outlying.geometry.y < contracted.y ||
    outlying.geometry.x + outlying.geometry.width > contracted.x + contracted.width ||
    outlying.geometry.y + outlying.geometry.height > contracted.y + contracted.height
  ) {
    throw new Error("contracted canvas must contain its live panel geometry");
  }
}

function testPanelResizeDoesNotAutomaticallyContractExistingCanvas() {
  const existing: WorkspaceCanvasBounds = {
    x: -720,
    y: -3984,
    width: 2832,
    height: 5472,
  };
  const smallPanel = panel("small", -100, 200);
  const normalized = normalizeWorkspaceCanvasBounds(existing, [smallPanel]);

  equal(normalized.x, existing.x, "panel resize does not contract existing x origin");
  equal(normalized.y, existing.y, "panel resize does not contract existing y origin");
  equal(normalized.width, existing.width, "panel resize does not contract canvas width automatically");
  equal(normalized.height, existing.height, "panel resize does not contract canvas height automatically");
}

testLiveExtentEstablishesAndReleasesBoundsFloor();
test4704FloorDoesNotSurviveManualContraction();
testNegativeOriginContractionHasNoGlobalOriginFloor();
testNoPanelMinimumIsRelativeToProposedOrigin();
testPanelsRemainContainedDuringNegativeOriginContraction();
testPanelResizeDoesNotAutomaticallyContractExistingCanvas();
console.log("Workspace canvas bounds expansion and contraction tests passed");
