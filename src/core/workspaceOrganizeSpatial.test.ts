import { createDefaultWorkspace } from "./defaultWorkspace";
import { createPanelRegistry } from "./panelRegistry";
import {
  organizeWorkspaceState,
  planPreserveSizesArrangement,
  PRESERVE_SPATIAL_SEARCH_MAX_PANELS,
  restoreWorkspaceState,
} from "./workspaceController";
import { measureSpatialLayout } from "./spatialLayoutMetrics";
import { normalizeWorkspaceCanvasBounds } from "./workspaceCanvasBounds";
import { searchSpatialLayout } from "./spatialLayoutSearch";
import type { PanelGeometry, PanelInstance, WorkspaceState } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const stamp = "2026-01-01T00:00:00.000Z";
const benchmark = [
  [1416, 1416], [1152, 1488], [768, 624], [1512, 1080], [528, 624], [1488, 1080],
] as const;
function panel(index: number, [width, height]: readonly [number, number], x = 100 + index * 120, y = 80 + index * 80): PanelInstance {
  return {
    id: `p${index}`, moduleId: "test", panelType: `panel-${index}`, title: `Panel ${index}`,
    geometry: { x, y, width, height, minWidth: Math.min(360, width), minHeight: Math.min(336, height) },
    focusOrder: index + 1, stateVersion: 1, panelState: {}, createdAt: stamp, updatedAt: stamp,
  };
}
function state(panels = benchmark.map((size, index) => panel(index, size))): WorkspaceState {
  const workspace = createDefaultWorkspace(createPanelRegistry());
  const tab = workspace.tabs[0];
  tab.canvasBounds = { x: -2400, y: -1200, width: 7008, height: 3504 };
  tab.canvasCamera = { x: -2200, y: -1000 };
  tab.canvasScale = 0.5;
  tab.panels = panels;
  return workspace;
}
function positions(panels: PanelInstance[]) { return panels.map(({ id, geometry }) => [id, geometry.x, geometry.y]); }
function gapsAreValid(geometries: PanelGeometry[], gap: number) {
  for (let i = 0; i < geometries.length; i++) for (let j = i + 1; j < geometries.length; j++) {
    const a = geometries[i], b = geometries[j];
    const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    const xGap = Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width);
    const yGap = Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height);
    assert(!overlap, "organized panels do not overlap");
    if (gap > 0) assert(xGap >= gap || yGap >= gap, "configured clearance is maintained");
  }
}
function hasTouchingFrames(geometries: PanelGeometry[]) {
  for (let i = 0; i < geometries.length; i++) for (let j = i + 1; j < geometries.length; j++) {
    const a = geometries[i], b = geometries[j];
    const xTouch = a.x + a.width === b.x || b.x + b.width === a.x;
    const yTouch = a.y + a.height === b.y || b.y + b.height === a.y;
    const yOverlap = Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
    const xOverlap = Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x);
    if (xTouch && yOverlap || yTouch && xOverlap) return true;
  }
  return false;
}

function testLivePreserveUsesSpatialSearchAndCanvasAspect() {
  const square = state();
  const organized = organizeWorkspaceState(square, { width: 3440, height: 910 }, stamp).tabs[0];
  equal(JSON.stringify(organized.canvasBounds), JSON.stringify(square.tabs[0].canvasBounds), "Organize preserves logical canvas bounds");
  assert(organized.organizeSnapshot, "first operation captures a restore snapshot");
  assert(organized.panels.some((item, i) => item.geometry.y !== square.tabs[0].panels[i].geometry.y), "spatial planner interlocks panels in two dimensions");
  const m = measureSpatialLayout(organized.panels.map((item) => item.geometry));
  assert(m.boundingWidth / m.boundingHeight > 1, "actual 2:1 canvas preference yields a landscape cluster");
  const wideState = state();
  wideState.tabs[0].canvasBounds = { x: -2400, y: -1200, width: 11232, height: 2808 };
  const wide = organizeWorkspaceState(wideState, { width: 3440, height: 910 }, stamp).tabs[0];
  const wideMetrics = measureSpatialLayout(wide.panels.map((item) => item.geometry));
  assert(wideMetrics.boundingWidth / wideMetrics.boundingHeight > m.boundingWidth / m.boundingHeight, "wider logical canvas favors a wider arrangement");
  equal(organized.canvasCamera.x, -2200, "camera x is preserved");
  equal(organized.canvasCamera.y, -1000, "camera y is preserved");
  equal(organized.canvasScale, 0.5, "zoom is preserved");
  assert(organized.panels.every((item, i) => item.geometry.width === square.tabs[0].panels[i].geometry.width && item.geometry.height === square.tabs[0].panels[i].geometry.height), "panel dimensions are preserved exactly from live pre-operation geometry");
  assert(organized.panels.every((item) => item.geometry.width >= (item.geometry.minWidth ?? 0) && item.geometry.height >= (item.geometry.minHeight ?? 0)), "minimum dimensions are retained");
  gapsAreValid(organized.panels.map((item) => item.geometry), 0);
  assert(organized.panels.some((item) => item.geometry.x < 0 || item.geometry.y < 0), "negative logical positions are supported");
}

function testSixPanelLegacyCandidateAndRepairedCommit() {
  const source = state();
  const tab = source.tabs[0];
  const legacyCandidate = searchSpatialLayout(tab.panels.map((item) => ({ id: item.id, ...item.geometry })), {
    gridSize: source.preferences.gridSize,
    gapGridUnits: 0,
    canvasBounds: tab.canvasBounds,
    camera: tab.canvasCamera,
    scale: tab.canvasScale,
  });
  const right = tab.canvasBounds.x + tab.canvasBounds.width;
  const bottom = tab.canvasBounds.y + tab.canvasBounds.height;
  assert([...legacyCandidate.geometries.values()].some((g) =>
    g.x < tab.canvasBounds.x || g.y < tab.canvasBounds.y ||
    g.x + g.width > right || g.y + g.height > bottom),
  "unconstrained Milestone 4 spatial candidate reproduces the out-of-canvas failure");

  const committed = organizeWorkspaceState(source, { width: 3440, height: 910 }, stamp).tabs[0];
  equal(JSON.stringify(committed.canvasBounds), JSON.stringify(tab.canvasBounds), "repaired six-panel commit retains original canvas geometry");
  equal(committed.canvasCamera.x, tab.canvasCamera.x, "repaired commit retains camera x");
  equal(committed.canvasCamera.y, tab.canvasCamera.y, "repaired commit retains camera y");
  equal(committed.canvasScale, tab.canvasScale, "repaired commit retains zoom");
  assert(committed.panels.every((item, index) =>
    item.geometry.width === tab.panels[index].geometry.width &&
    item.geometry.height === tab.panels[index].geometry.height),
  "repaired commit retains every live panel dimension");
  assert(committed.panels.every((item) =>
    item.geometry.x >= tab.canvasBounds.x && item.geometry.y >= tab.canvasBounds.y &&
    item.geometry.x + item.geometry.width <= right && item.geometry.y + item.geometry.height <= bottom),
  "repaired commit keeps all six panels inside original bounds");
  gapsAreValid(committed.panels.map((item) => item.geometry), 0);
}

function testSpatialCandidateDoesNotCoverStationaryObstacle() {
  const source = state();
  const tab = source.tabs[0];
  const candidate = planPreserveSizesArrangement({
    panels: tab.panels, viewport: { width: 3440, height: 910 }, origin: tab.canvasCamera,
    scale: tab.canvasScale, canvasBounds: tab.canvasBounds, gridSize: source.preferences.gridSize,
    organizeGapUnits: 0,
  }).plan.geometries;
  const target = candidate.get(tab.panels[0].id)!;
  const obstacle: PanelInstance = {
    ...panel(100, [600, 500], target.x, target.y),
    display: { mode: "minimized", restoreGeometry: { ...target } },
  };
  tab.panels.push(obstacle);
  const organized = organizeWorkspaceState(source, { width: 3440, height: 910 }, stamp).tabs[0];
  assert(organized.organizeActive, "a complete obstacle-safe candidate is committed");
  const moved = organized.panels.filter((item) => item.id !== obstacle.id);
  assert(moved.every((item) => !overlap(item.geometry, obstacle.geometry)), "arranged panels do not overlap a stationary minimized obstacle");
  assert(organized.panels.find((item) => item.id === obstacle.id)?.geometry === obstacle.geometry, "stationary geometry remains unchanged");
  const bounds = tab.canvasBounds;
  assert(organized.panels.every((item) => item.geometry.x >= bounds.x && item.geometry.y >= bounds.y &&
    item.geometry.x + item.geometry.width <= bounds.x + bounds.width &&
    item.geometry.y + item.geometry.height <= bounds.y + bounds.height), "participating and stationary frames remain inside original canvas bounds");
}

function testLivePanelSizeDoesNotRoundUpToConfiguredOrganizeGrid() {
  const fileBrowser = panel(0, [713, 641], 100, 100);
  fileBrowser.title = "File Browser";
  fileBrowser.geometry.minWidth = 520;
  fileBrowser.geometry.minHeight = 360;
  const source = state([fileBrowser]);
  source.preferences.gridSize = 24;
  const expandedSearchInput = searchSpatialLayout([{ id: fileBrowser.id, ...fileBrowser.geometry }], {
    gridSize: 24,
    canvasBounds: source.tabs[0].canvasBounds,
    containerBounds: source.tabs[0].canvasBounds,
  });
  equal(expandedSearchInput.geometries.get(fileBrowser.id)?.width, 720, "search engine currently rounds the width up to its configured grid");
  equal(expandedSearchInput.geometries.get(fileBrowser.id)?.height, 648, "search engine currently rounds the height up to its configured grid");
  const committed = organizeWorkspaceState(source, { width: 3440, height: 910 }, stamp).tabs[0];
  equal(committed.panels[0].geometry.width, 713, "final File Browser width remains its live pre-operation width");
  equal(committed.panels[0].geometry.height, 641, "final File Browser height remains its live pre-operation height");
}

function overlap(a: PanelGeometry, b: PanelGeometry) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function testGapAndEligibility() {
  const source = state();
  source.tabs[0].canvasBounds.width = 10008;
  source.preferences.organizeGapUnits = 2;
  source.preferences.gridSize = 24;
  source.tabs[0].panels.push(panel(6, [400, 400], 7000, 1800));
  source.tabs[0].panels.push({ ...panel(7, [400, 400], 7000, 1400), display: { mode: "minimized" } });
  const result = planPreserveSizesArrangement({
    panels: source.tabs[0].panels.slice(0, 6),
    viewport: { width: 3440, height: 910 },
    origin: source.tabs[0].canvasCamera,
    scale: source.tabs[0].canvasScale,
    canvasBounds: source.tabs[0].canvasBounds,
    gridSize: 24,
    organizeGapUnits: 2,
  });
  equal(result.strategy, "spatial", "eligible six-panel set uses spatial search");
  equal(result.plan.geometries.size, 6, "visible viewport eligibility matches existing planner");
  gapsAreValid([...result.plan.geometries.values()], 48);
  const zero = planPreserveSizesArrangement({
    panels: source.tabs[0].panels.slice(0, 6), viewport: { width: 3440, height: 910 },
    origin: source.tabs[0].canvasCamera, scale: source.tabs[0].canvasScale,
    canvasBounds: source.tabs[0].canvasBounds, gridSize: 24, organizeGapUnits: 0,
  });
  equal(zero.strategy, "spatial", "zero gap uses spatial search");
  gapsAreValid([...zero.plan.geometries.values()], 0);
  assert(hasTouchingFrames([...zero.plan.geometries.values()]), "zero gap permits adjacent frames to touch");
  const finalState = organizeWorkspaceState(source, { width: 3440, height: 910 }, stamp).tabs[0];
  assert(finalState.organizeActive, "eligible panels are arranged while excluded panels remain stationary");
  for (const excluded of source.tabs[0].panels.slice(6)) {
    const after = finalState.panels.find((item) => item.id === excluded.id)!;
    equal(JSON.stringify(after.geometry), JSON.stringify(excluded.geometry), `${excluded.id} excluded geometry remains unchanged`);
  }
}

function testRepeatUnlockRestoreAndUniformCompatibility() {
  const original = state();
  const organized = organizeWorkspaceState(original, { width: 3440, height: 910 }, stamp);
  const afterUnlock = organizeWorkspaceState(organized, { width: 3440, height: 910 }, stamp);
  const unlocked = afterUnlock.tabs[0];
  equal(unlocked.organizeActive, false, "Unlock clears active state");
  equal(JSON.stringify(unlocked.panels.map((item) => item.geometry)), JSON.stringify(organized.tabs[0].panels.map((item) => item.geometry)), "Unlock preserves arranged positions");
  const organizedAgain = organizeWorkspaceState(afterUnlock, { width: 3440, height: 910 }, stamp);
  equal(JSON.stringify(positions(organizedAgain.tabs[0].panels)), JSON.stringify(positions(organized.tabs[0].panels)), "repeated Organize uses captured original target ratio and does not drift");
  const restored = restoreWorkspaceState(organizedAgain, stamp).tabs[0];
  equal(JSON.stringify(restored.panels.map((item) => item.geometry)), JSON.stringify(original.tabs[0].panels.map((item) => item.geometry)), "Restore returns original geometry");
  equal(restored.canvasBounds.width, original.tabs[0].canvasBounds.width, "Restore returns original logical canvas bounds");
  const uniform = state();
  uniform.preferences.organizeMode = "uniform";
  const oldWarn = console.warn;
  console.warn = () => {};
  let uniformResult: WorkspaceState;
  try { uniformResult = organizeWorkspaceState(uniform, { width: 3440, height: 910 }, stamp); }
  finally { console.warn = oldWarn; }
  assert(uniformResult === uniform, "Uniform remains unchanged when its resize-based planner violates strict Organize invariants");
}

function testInteractiveBudgetFallsBackAboveThreshold() {
  const panels = Array.from({ length: PRESERVE_SPATIAL_SEARCH_MAX_PANELS + 2 }, (_, i) => panel(i, [360, 336]));
  const result = planPreserveSizesArrangement({
    panels, viewport: { width: 12000, height: 8000 }, origin: { x: 0, y: 0 }, scale: 1,
    canvasBounds: { x: 0, y: 0, width: 7008, height: 3504 }, gridSize: 24, organizeGapUnits: 0,
  });
  equal(result.strategy, "shelf", "large arrangements use bounded synchronous shelf fallback");
  equal(result.plan.geometries.size, panels.length, "fallback includes every eligible panel");
  gapsAreValid([...result.plan.geometries.values()], 0);

  const originalWarn = console.warn;
  let diagnosed = false;
  console.warn = () => { diagnosed = true; };
  let invalid;
  try {
    invalid = planPreserveSizesArrangement({
      panels: panels.slice(0, 2), viewport: { width: 12000, height: 8000 }, origin: { x: 0, y: 0 }, scale: 1,
      canvasBounds: { x: Number.NaN, y: 0, width: 7000, height: 3500 }, gridSize: 24, organizeGapUnits: 0,
    });
  } finally {
    console.warn = originalWarn;
  }
  assert(diagnosed, "invalid spatial input emits an appropriate diagnostic");
  equal(invalid.strategy, "rejected", "invalid canvas rejects both spatial and shelf candidates");
  equal(invalid.plan.geometries.size, 0, "invalid spatial and fallback candidates are not partially applied");
  const invalidState = state();
  invalidState.tabs[0].canvasBounds.x = Number.NaN;
  const originalPanels = JSON.stringify(invalidState.tabs[0].panels);
  const originalBounds = JSON.stringify(invalidState.tabs[0].canvasBounds);
  const oldWarn = console.warn;
  console.warn = () => {};
  let resultState: WorkspaceState;
  try { resultState = organizeWorkspaceState(invalidState, { width: 3440, height: 910 }, stamp); }
  finally { console.warn = oldWarn; }
  assert(resultState === invalidState, "invalid full-state candidates leave the workspace state reference unchanged");
  equal(JSON.stringify(resultState.tabs[0].panels), originalPanels, "invalid candidate leaves every final panel unchanged");
  equal(JSON.stringify(resultState.tabs[0].canvasBounds), originalBounds, "invalid candidate leaves bounds unchanged");

  const floorPanel = panel(500, [600, 656], 0, 4000);
  const floorBounds = normalizeWorkspaceCanvasBounds({ x: 0, y: 0, width: 1800, height: 700 }, [floorPanel]);
  equal(floorBounds.height, 4656, "live panel extents determine the canvas boundary without artificial clearance");
}

testLivePreserveUsesSpatialSearchAndCanvasAspect();
testSixPanelLegacyCandidateAndRepairedCommit();
testSpatialCandidateDoesNotCoverStationaryObstacle();
testLivePanelSizeDoesNotRoundUpToConfiguredOrganizeGrid();
testGapAndEligibility();
testRepeatUnlockRestoreAndUniformCompatibility();
testInteractiveBudgetFallsBackAboveThreshold();
console.log("Spatial Organize controller integration tests passed");
