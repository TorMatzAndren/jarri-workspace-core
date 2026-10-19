import { measureSpatialLayout } from "./spatialLayoutMetrics";
import { searchSpatialLayout } from "./spatialLayoutSearch";
import { planSizePreservingArrangement } from "./panelArrangementPreserve";
import type { PanelGeometry, PanelInstance } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function overlaps(a: PanelGeometry, b: PanelGeometry) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function boxes(result: ReturnType<typeof searchSpatialLayout>) {
  return [...result.geometries.values()];
}
function signature(result: ReturnType<typeof searchSpatialLayout>) {
  return [...result.geometries].map(([id, g]) => `${id}:${g.x},${g.y},${g.width},${g.height}`).join("|");
}
function assertLegal(result: ReturnType<typeof searchSpatialLayout>, input: Array<{ id: string; width: number; height: number; minWidth?: number; minHeight?: number }>, grid: number, gap: number) {
  const output = result.geometries;
  equal(output.size, input.length, "all rectangles returned");
  for (const rect of input) {
    const g = output.get(rect.id);
    assert(g, `geometry exists for ${rect.id}`);
    assert(g.width >= Math.max(rect.width, rect.minWidth ?? 0), `${rect.id} width is not shrunk`);
    assert(g.height >= Math.max(rect.height, rect.minHeight ?? 0), `${rect.id} height is not shrunk`);
    equal(g.width, Math.ceil(Math.max(rect.width, rect.minWidth ?? 0) / grid) * grid, `${rect.id} width only rounds up to grid`);
    equal(g.height, Math.ceil(Math.max(rect.height, rect.minHeight ?? 0) / grid) * grid, `${rect.id} height only rounds up to grid`);
    equal(g.x % grid, 0, `${rect.id} x grid alignment`);
    equal(g.y % grid, 0, `${rect.id} y grid alignment`);
  }
  const values = boxes(result);
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    assert(!overlaps(values[i], values[j]), "no rectangles overlap");
    const a = values[i], b = values[j];
    const dx = Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width);
    const dy = Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height);
    assert(dx >= gap || dy >= gap || dx === 0 && dy === 0, "configured clearance is respected");
  }
}

function testInterlockingPlacementAndPreservedView() {
  const input = [
    { id: "wide", x: -120, y: -60, width: 240, height: 120, minWidth: 200, minHeight: 100 },
    { id: "small-a", x: -120, y: -60, width: 120, height: 60 },
    { id: "small-b", x: -120, y: -60, width: 120, height: 60 },
  ];
  const result = searchSpatialLayout(input, { gridSize: 12, gapGridUnits: 0, camera: { x: -120, y: -60 }, scale: 0.5, viewport: { width: 640, height: 360 } });
  assertLegal(result, input, 12, 0);
  equal(result.camera.x, -120, "negative camera x retained");
  equal(result.camera.y, -60, "negative camera y retained");
  equal(result.scale, 0.5, "scale retained");
  const wide = result.geometries.get("wide")!;
  const underWide = input.filter((item) => item.id.startsWith("small")).map((item) => result.geometries.get(item.id)!);
  assert(underWide.every((small) => small.y === wide.y + wide.height), "smaller panels stack beneath the wide panel");
  equal(underWide[0].x + underWide[0].width, underWide[1].x, "smaller panels interlock without a gap");
}

function testZeroAndMultipleGridGaps() {
  const input = [
    { id: "a", x: 0, y: 0, width: 120, height: 72 },
    { id: "b", x: 0, y: 0, width: 84, height: 96 },
    { id: "c", x: 0, y: 0, width: 72, height: 48 },
    { id: "round-up", x: 0, y: 0, width: 121, height: 61, minWidth: 127, minHeight: 65 },
  ];
  for (const gapUnits of [0, 2]) {
    const result = searchSpatialLayout(input, { gridSize: 12, gapGridUnits: gapUnits });
    assertLegal(result, input, 12, gapUnits * 12);
  }
}

function testIdenticalSizesAndIdentityIndependentQuality() {
  const input = [
    { id: "c", x: 0, y: 0, width: 120, height: 96 },
    { id: "a", x: 0, y: 0, width: 120, height: 96 },
    { id: "b", x: 0, y: 0, width: 120, height: 96 },
    { id: "tall", x: 0, y: 0, width: 72, height: 180 },
  ];
  const options = {
    gridSize: 12,
    gapGridUnits: 1,
    canvasBounds: { x: -120, y: -72, width: 1800, height: 900 },
  };
  const first = searchSpatialLayout(input, options);
  const permuted = searchSpatialLayout([...input].reverse(), options);
  const renamed = searchSpatialLayout(input.map((item) => ({ ...item, id: `renamed-${item.id}` })), options);
  equal(first.score.quality, permuted.score.quality, "permutation does not alter geometric quality");
  equal(first.score.quality, renamed.score.quality, "identities do not alter geometric quality");
  equal(signature(first), signature(permuted), "stable IDs provide deterministic final assignment");
  assertLegal(first, input, 12, 12);
}

function testRepeatedOptimizationDoesNotDrift() {
  const input = [
    { id: "a", x: -36, y: -24, width: 132, height: 120 },
    { id: "b", x: -36, y: -24, width: 108, height: 84 },
    { id: "c", x: -36, y: -24, width: 84, height: 60 },
  ];
  const options = {
    gridSize: 12,
    gapGridUnits: 1,
    camera: { x: -36, y: -24 },
    scale: 0.75,
    canvasBounds: { x: -36, y: -24, width: 2400, height: 1600 },
  };
  const first = searchSpatialLayout(input, options);
  const second = searchSpatialLayout(input.map((item) => ({ ...item, ...first.geometries.get(item.id)! })), options);
  equal(signature(first), signature(second), "same arrangement is a fixed point");
}

function testInvalidGapRejected() {
  let rejected = false;
  try { searchSpatialLayout([{ id: "a", x: 0, y: 0, width: 10, height: 10 }], { gapGridUnits: 1.5 }); } catch { rejected = true; }
  assert(rejected, "non-integer gap multiplier is rejected");
}

function testBoundedLargerPanelSet() {
  const input = Array.from({ length: 24 }, (_, index) => ({
    id: `panel-${String(index).padStart(2, "0")}`,
    x: -480,
    y: -240,
    width: 120 + (index * 37 % 11) * 12,
    height: 96 + (index * 53 % 9) * 12,
    minWidth: 96,
    minHeight: 72,
  }));
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = searchSpatialLayout(input, { gridSize: 12, gapGridUnits: 1, camera: { x: -480, y: -240 }, viewport: { width: 1800, height: 1100 }, beamWidth: 12, placementsPerState: 12 });
  const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
  assertLegal(result, input, 12, 12);
  equal(result.geometries.size, 24, "larger search returns every panel");
  assert(result.candidateCount < 500_000, "search candidate count is explicitly bounded in practice");
  assert(elapsed < 5000, `24-panel search completes within test budget (took ${elapsed.toFixed(1)}ms)`);
  console.log("LARGE-PANEL SEARCH", JSON.stringify({ panelCount: input.length, candidateCount: result.candidateCount, elapsedMs: Number(elapsed.toFixed(2)) }));
}

function testReferenceBenchmarkAgainstShelfAndRowLayouts() {
  const viewport = { width: 3440, height: 910 };
  const camera = { x: -2828, y: -320 };
  const scale = 0.25;
  const gridSize = 24;
  const specs = [
    ["settings", 1416, 1416],
    ["themes", 1152, 1488],
    ["events", 768, 624],
    ["diagnostics", 1512, 1080],
    ["inspector", 528, 624],
    ["files", 1488, 1080],
  ] as const;
  const input = specs.map(([id, width, height]) => ({ id, x: camera.x, y: camera.y, width, height }));
  const result = searchSpatialLayout(input, { gridSize, gapGridUnits: 0, viewport, camera, scale });
  assertLegal(result, input, gridSize, 0);

  const panelArea = input.reduce((sum, panel) => sum + panel.width * panel.height, 0);
  const rowAreas: number[] = [];
  for (let mask = 0; mask < 1 << input.length; mask++) {
    if (popcount(mask) !== 3) continue;
    const first = input.filter((_, index) => mask & (1 << index));
    const second = input.filter((_, index) => !(mask & (1 << index)));
    const rowWidth = Math.max(first.reduce((s, p) => s + p.width, 0), second.reduce((s, p) => s + p.width, 0));
    const rowHeight = Math.max(...first.map((p) => p.height)) + Math.max(...second.map((p) => p.height));
    rowAreas.push(rowWidth * rowHeight);
  }
  const exhaustiveThreeByThreeArea = Math.min(...rowAreas);
  const rowUtilization = panelArea / exhaustiveThreeByThreeArea;

  const benchmarkPanels: PanelInstance[] = input.map((panel) => ({
    id: panel.id, moduleId: "benchmark", panelType: "benchmark", title: panel.id,
    geometry: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
    focusOrder: 0, stateVersion: 1, panelState: {}, createdAt: "", updatedAt: "",
  }));
  const shelf = planSizePreservingArrangement({ panels: benchmarkPanels, viewport, origin: camera, scale, gridSize, gap: 0 });
  const shelfMetrics = measureSpatialLayout([...shelf.geometries.values()], 0);
  const searchMetrics = result.metrics;
  assert(searchMetrics.boundingArea < shelfMetrics.boundingArea, "search beats the zero-gap shelf reference by bounding area");
  assert(searchMetrics.boundingArea < exhaustiveThreeByThreeArea, "search beats exhaustive two-row 3+3 packing by bounding area");
  const report = {
    reference: { viewport, camera, scale, gridSize, gapGridUnits: 0, panelArea },
    search: {
      strategy: result.strategy,
      strategies: result.strategyResults.map(({ strategy, candidateCount, score }) => ({ strategy, candidateCount, score })),
      candidateCount: result.candidateCount,
      elapsedMs: Number(result.elapsedMs.toFixed(2)),
      boundingArea: searchMetrics.boundingArea,
      utilization: Number(searchMetrics.utilization.toFixed(4)),
      emptyArea: searchMetrics.emptyArea,
      enclosedVoidArea: searchMetrics.enclosedVoidArea,
      enclosedVoidCount: searchMetrics.enclosedVoidCount,
      fragmentation: result.score.fragmentation,
      occupiedPerimeter: searchMetrics.occupiedPerimeter,
      adjacentPairs: searchMetrics.adjacentPairs,
      clusterCount: searchMetrics.clusterCount,
      coordinates: [...result.geometries],
    },
    shelfZeroGap: {
      boundingArea: shelfMetrics.boundingArea,
      utilization: Number(shelfMetrics.utilization.toFixed(4)),
      enclosedVoidArea: shelfMetrics.enclosedVoidArea,
      occupiedPerimeter: shelfMetrics.occupiedPerimeter,
      adjacentPairs: shelfMetrics.adjacentPairs,
      clusterCount: shelfMetrics.clusterCount,
    },
    exhaustiveThreeByThreeRows: {
      boundingArea: exhaustiveThreeByThreeArea,
      utilization: Number(rowUtilization.toFixed(4)),
      arrangementCount: rowAreas.length,
    },
    suppliedHistoricalReferences: { shelfOneGridGapUtilization: 0.7475, rowThreeByThreeUtilization: 0.8381 },
  };
  console.log("===== SPATIAL SEARCH REFERENCE BENCHMARK =====");
  console.log(JSON.stringify(report, null, 2));
  assert(searchMetrics.clusterCount === 1, "reference result forms one connected cluster");
}

function testCanvasAspectBenchmarksAndInvariants() {
  const viewport = { width: 3440, height: 910 };
  const camera = { x: -2828, y: -320 };
  const scale = 0.25;
  const gridSize = 24;
  const specs = [
    ["settings", 1416, 1416],
    ["themes", 1152, 1488],
    ["events", 768, 624],
    ["diagnostics", 1512, 1080],
    ["inspector", 528, 624],
    ["files", 1488, 1080],
  ] as const;
  const input = specs.map(([id, width, height]) => ({ id, x: camera.x, y: camera.y, width, height }));
  const panelArea = input.reduce((sum, panel) => sum + panel.width * panel.height, 0);
  const ratios = [
    { name: "square", width: 7000, height: 7000 },
    { name: "landscape", width: 7000, height: 3500 },
    { name: "ultrawide", width: 14000, height: 3500 },
    { name: "portrait", width: 3500, height: 7000 },
  ];
  const results = new Map<string, ReturnType<typeof searchSpatialLayout>>();
  for (const ratio of ratios) {
    const result = searchSpatialLayout(input, {
      gridSize,
      gapGridUnits: 0,
      viewport,
      camera,
      scale,
      canvasBounds: { x: camera.x, y: camera.y, width: ratio.width, height: ratio.height },
    });
    results.set(ratio.name, result);
    assertLegal(result, input, gridSize, 0);
    equal(result.score.targetAspect, ratio.width / ratio.height, `${ratio.name} uses logical canvas ratio`);
    assert(result.score.aspectError !== null, `${ratio.name} reports aspect error`);
    assert(result.metrics.clusterCount === 1, `${ratio.name} forms one cluster`);
  }

  const report = ratios.map((ratio) => {
    const result = results.get(ratio.name)!;
    const actualAspect = result.metrics.boundingWidth / result.metrics.boundingHeight;
    return {
      canvas: ratio.name,
      targetAspect: ratio.width / ratio.height,
      boundingWidth: result.metrics.boundingWidth,
      boundingHeight: result.metrics.boundingHeight,
      actualAspect: Number(actualAspect.toFixed(4)),
      utilization: Number(result.metrics.utilization.toFixed(4)),
      enclosedVoids: result.metrics.enclosedVoidCount,
      enclosedVoidArea: result.metrics.enclosedVoidArea,
      clusterCount: result.metrics.clusterCount,
      aspectError: Number(result.score.aspectError!.toFixed(4)),
      selectedApproach: result.scoringApproach,
      approaches: result.approachResults.map((entry) => ({
        approach: entry.approach,
        strategy: entry.strategy,
        candidateCount: entry.candidateCount,
        boundingArea: entry.score.boundingArea,
        utilization: Number((panelArea / entry.score.boundingArea).toFixed(4)),
        actualAspect: Number(entry.score.actualAspect.toFixed(4)),
        aspectError: Number(entry.score.aspectError!.toFixed(4)),
      })),
      candidateCount: result.candidateCount,
      elapsedMs: Number(result.elapsedMs.toFixed(2)),
      coordinates: [...result.geometries],
    };
  });
  console.log("===== CANVAS-ASPECT REFERENCE BENCHMARKS =====");
  console.log(JSON.stringify({ logicalCanvasBounds: "synthetic ratio fixtures; no six-panel saved canvas bounds exist in current fixtures", results: report }, null, 2));

  const square = results.get("square")!;
  const landscape = results.get("landscape")!;
  const ultrawide = results.get("ultrawide")!;
  const portrait = results.get("portrait")!;
  assert(ultrawide.score.actualAspect > landscape.score.actualAspect, "ultrawide canvas selects a wider cluster than landscape");
  assert(landscape.score.actualAspect > square.score.actualAspect, "landscape canvas selects a wider cluster than square");
  assert(square.score.actualAspect > portrait.score.actualAspect, "square canvas selects a wider cluster than portrait");
  assert(portrait.score.actualAspect < 1.5, "portrait selection is not a horizontal strip");
  assert(square.score.actualAspect < 2, "square selection is not a horizontal strip");
  assert(ultrawide.score.boundingArea < 2 * square.score.boundingArea, "ultrawide ratio does not force a wasteful strip");

  const proportionallyScaled = searchSpatialLayout(input, {
    gridSize, gapGridUnits: 0, viewport, camera, scale,
    canvasBounds: { x: camera.x, y: camera.y, width: 14000, height: 14000 },
  });
  equal(signature(square), signature(proportionallyScaled), "proportional canvas scaling preserves shape and selection");
  equal(proportionallyScaled.score.targetAspect, square.score.targetAspect, "proportional canvas scaling preserves objective ratio");

  const zoomChanged = searchSpatialLayout(input, {
    gridSize, gapGridUnits: 0, viewport, camera, scale: 0.75,
    canvasBounds: { x: camera.x, y: camera.y, width: 7000, height: 7000 },
  });
  equal(signature(square), signature(zoomChanged), "zoom alone does not change selected geometry");

  const shifted = searchSpatialLayout(input, {
    gridSize, gapGridUnits: 0, viewport, camera, scale,
    canvasBounds: { x: camera.x + 240, y: camera.y - 120, width: 7000, height: 7000 },
  });
  for (const [id, geometry] of square.geometries) {
    const moved = shifted.geometries.get(id)!;
    equal(moved.x - geometry.x, 240, `${id} translates with canvas origin in x`);
    equal(moved.y - geometry.y, -120, `${id} translates with canvas origin in y`);
    equal(moved.width, geometry.width, `${id} relative width is unchanged`);
    equal(moved.height, geometry.height, `${id} relative height is unchanged`);
  }

  const nearOptimal = searchSpatialLayout(input, {
    gridSize, gapGridUnits: 0, viewport, camera, scale,
    canvasBounds: { x: camera.x, y: camera.y, width: 7000, height: 7000 },
    scoringApproach: "near-optimal-area",
    areaQualityTolerance: 0.4,
  });
  assert(nearOptimal.scoringApproach === "near-optimal-area", "near-optimal-area scoring can be selected");
  assert(nearOptimal.score.boundingArea <= square.score.boundingArea * 1.4, "near-optimal-area stays within its configured area tolerance");
  assert(nearOptimal.score.aspectError !== null, "near-optimal-area reports canvas aspect mismatch");
}

function popcount(value: number): number {
  let count = 0;
  for (let bits = value; bits; bits >>>= 1) count += bits & 1;
  return count;
}

testInterlockingPlacementAndPreservedView();
testZeroAndMultipleGridGaps();
testIdenticalSizesAndIdentityIndependentQuality();
testRepeatedOptimizationDoesNotDrift();
testInvalidGapRejected();
testBoundedLargerPanelSet();
testReferenceBenchmarkAgainstShelfAndRowLayouts();
testCanvasAspectBenchmarksAndInvariants();
console.log("PASS: spatial layout bounded search tests");
