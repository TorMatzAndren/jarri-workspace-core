import { measureSpatialLayout, type SpatialLayoutMetrics } from "./spatialLayoutMetrics";
import type { PanelGeometry } from "./types";

type SpatialRectangle = Pick<PanelGeometry, "x" | "y" | "width" | "height"> & {
  id: string;
  minWidth?: number;
  minHeight?: number;
};

type Viewport = { width: number; height: number };
type CanvasBounds = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Strategy = "area-first" | "long-side-first";
type ScoringApproach = "weighted" | "near-optimal-area";

type SearchOptions = {
  gridSize?: number;
  gapGridUnits?: number;
  viewport?: Viewport;
  canvasBounds?: CanvasBounds;
  camera?: Point;
  scale?: number;
  beamWidth?: number;
  placementsPerState?: number;
  scoringApproach?: ScoringApproach;
  areaQualityTolerance?: number;
  /** Hard placement limits. When supplied, all generated frames remain inside these logical bounds. */
  containerBounds?: CanvasBounds;
  /** Fixed geometry that candidates may not overlap. */
  obstacles?: readonly PanelGeometry[];
};

type SpatialLayoutScore = {
  quality: number;
  viewportOverflowArea: number;
  boundingArea: number;
  emptyArea: number;
  enclosedVoidArea: number;
  fragmentation: number;
  perimeter: number;
  compactness: number;
  targetAspect: number | null;
  actualAspect: number;
  aspectError: number | null;
  scoringApproach: ScoringApproach;
};

type SearchResult = {
  geometries: Map<string, PanelGeometry>;
  camera: Point;
  scale: number;
  metrics: SpatialLayoutMetrics;
  score: SpatialLayoutScore;
  candidateCount: number;
  elapsedMs: number;
  strategy: Strategy;
  scoringApproach: ScoringApproach;
  approachResults: Array<{
    approach: ScoringApproach;
    strategy: Strategy;
    candidateCount: number;
    score: SpatialLayoutScore;
  }>;
  strategyResults: Array<{
    strategy: Strategy;
    candidateCount: number;
    score: SpatialLayoutScore;
  }>;
};

type Placed = { id: string; geometry: PanelGeometry };
type BeamState = { placed: Placed[]; estimate: number; signature: string };

const EPSILON = 1e-8;
const DEFAULT_BEAM_WIDTH = 20;
const DEFAULT_PLACEMENTS_PER_STATE = 20;
const MAX_BEAM_WIDTH = 32;
const MAX_PLACEMENTS_PER_STATE = 40;
const MAX_AXIS_ANCHORS = 64;

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function alignUp(value: number, grid: number): number {
  const aligned = Math.ceil(value / grid - EPSILON) * grid;
  return aligned === 0 ? 0 : aligned;
}

function normalizeRectangles(
  rectangles: readonly SpatialRectangle[],
  grid: number,
): SpatialRectangle[] {
  const ids = new Set<string>();
  return rectangles.map((rect) => {
    if (!rect.id || ids.has(rect.id)) throw new Error("Spatial rectangle IDs must be unique and non-empty");
    ids.add(rect.id);
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
      throw new Error(`Invalid spatial rectangle: ${rect.id}`);
    }
    const minWidth = rect.minWidth ?? 0;
    const minHeight = rect.minHeight ?? 0;
    if (![minWidth, minHeight].every(Number.isFinite) || minWidth < 0 || minHeight < 0) {
      throw new Error(`Invalid spatial minimum dimensions: ${rect.id}`);
    }
    return {
      ...rect,
      width: alignUp(Math.max(rect.width, minWidth), grid),
      height: alignUp(Math.max(rect.height, minHeight), grid),
      ...(rect.minWidth === undefined ? {} : { minWidth }),
      ...(rect.minHeight === undefined ? {} : { minHeight }),
    };
  });
}

function overlaps(a: PanelGeometry, b: PanelGeometry): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

function respectsGap(a: PanelGeometry, b: PanelGeometry, gap: number): boolean {
  if (overlaps(a, b)) return false;
  if (gap === 0) return true;
  const horizontalClearance = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
  const verticalClearance = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height));
  return horizontalClearance >= gap || verticalClearance >= gap;
}

function rectKey(placed: readonly Placed[], origin: Point): string {
  return placed.map(({ geometry }) => `${geometry.x - origin.x},${geometry.y - origin.y},${geometry.width},${geometry.height}`)
    .join(";");
}

function bounds(placed: readonly Placed[]) {
  if (!placed.length) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const left = Math.min(...placed.map(({ geometry: g }) => g.x));
  const top = Math.min(...placed.map(({ geometry: g }) => g.y));
  const right = Math.max(...placed.map(({ geometry: g }) => g.x + g.width));
  const bottom = Math.max(...placed.map(({ geometry: g }) => g.y + g.height));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function estimatePartial(
  placed: readonly Placed[],
  gap: number,
  viewport: Viewport | undefined,
  camera: Point,
  scale: number,
  targetAspect: number | undefined,
  approach: ScoringApproach,
  totalCount: number,
): number {
  if (!placed.length) return 0;
  const box = bounds(placed);
  const area = box.width * box.height;
  const panelArea = placed.reduce((sum, item) => sum + item.geometry.width * item.geometry.height, 0);
  const viewportWidth = viewport ? viewport.width / scale : Number.POSITIVE_INFINITY;
  const viewportHeight = viewport ? viewport.height / scale : Number.POSITIVE_INFINITY;
  const viewRight = camera.x + viewportWidth;
  const viewBottom = camera.y + viewportHeight;
  const overflowWidth = Math.max(0, camera.x - box.left) + Math.max(0, box.right - viewRight);
  const overflowHeight = Math.max(0, camera.y - box.top) + Math.max(0, box.bottom - viewBottom);
  const overflow = overflowWidth * box.height + overflowHeight * box.width;
  let adjacentPairs = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i].geometry;
      const b = placed[j].geometry;
      const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      const xGap = Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width);
      const yGap = Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height);
      if ((yOverlap > 0 && xGap <= gap) || (xOverlap > 0 && yGap <= gap)) adjacentPairs++;
    }
  }
  const perimeterEstimate = 2 * (box.width + box.height);
  const emptyArea = Math.max(0, area - panelArea);
  const fragmentation = Math.max(0, placed.length - 1 - adjacentPairs);
  // With canvas-aware scoring, zoom/viewport are deliberately excluded from
  // selection. The canvas ratio is the only source of shape preference.
  if (targetAspect && approach === "weighted") {
    const actualAspect = box.width / box.height;
    const aspectError = Math.abs(Math.log(actualAspect / targetAspect));
    const progress = placed.length / totalCount;
    return 0.62 * emptyArea / Math.max(1, panelArea) +
      0.38 * aspectError * progress +
      fragmentation / Math.max(1, placed.length) * 0.1;
  }
  // A low-cost area pruning heuristic. Complete candidates use exact metrics.
  return area + (targetAspect ? 0 : overflow * 0.3) + emptyArea * 0.04 +
    fragmentation * Math.max(1, gap * gap) * 0.2 + perimeterEstimate * Math.max(1, gap) * 0.015;
}

function viewportOverflowArea(
  rectangles: readonly PanelGeometry[],
  viewport: Viewport | undefined,
  camera: Point,
  scale: number,
): number {
  if (!viewport) return 0;
  const right = camera.x + viewport.width / scale;
  const bottom = camera.y + viewport.height / scale;
  return rectangles.reduce((sum, rect) => {
    const insideWidth = Math.max(0, Math.min(rect.x + rect.width, right) - Math.max(rect.x, camera.x));
    const insideHeight = Math.max(0, Math.min(rect.y + rect.height, bottom) - Math.max(rect.y, camera.y));
    return sum + rect.width * rect.height - insideWidth * insideHeight;
  }, 0);
}

/**
 * Full objective evaluation, intentionally separated from placement generation
 * and beam pruning so weights and priorities can be evaluated independently.
 */
export function scoreSpatialLayout(
  rectangles: readonly PanelGeometry[],
  metrics: SpatialLayoutMetrics,
  options: Pick<SearchOptions, "viewport" | "camera" | "scale" | "gridSize" | "canvasBounds" | "scoringApproach" | "areaQualityTolerance"> = {},
): SpatialLayoutScore {
  const scale = Number.isFinite(options.scale) && (options.scale ?? 0) > 0 ? options.scale! : 1;
  const camera = options.camera ?? { x: 0, y: 0 };
  const gridArea = Math.max(1, (options.gridSize ?? 1) ** 2);
  const overflow = viewportOverflowArea(rectangles, options.viewport, camera, scale);
  const fragmentation = Math.max(0, metrics.clusterCount - 1) * 4 +
    Math.max(0, rectangles.length - 1 - metrics.adjacentPairs) * 0.5;
  const perimeter = metrics.occupiedPerimeter;
  const actualAspect = metrics.boundingHeight > 0
    ? metrics.boundingWidth / metrics.boundingHeight : 0;
  const targetAspect = options.canvasBounds && options.canvasBounds.height > 0
    ? options.canvasBounds.width / options.canvasBounds.height : null;
  const aspectError = targetAspect && actualAspect > 0
    ? Math.abs(Math.log(actualAspect / targetAspect)) : null;
  const panelArea = Math.max(1, metrics.panelArea);
  const normalizedWaste = metrics.emptyArea / panelArea;
  const normalizedVoids = metrics.enclosedVoidArea / panelArea;
  const perimeterRatio = perimeter / (2 * Math.sqrt(panelArea));
  const compactness = normalizedWaste + normalizedVoids * 0.15 +
    fragmentation / Math.max(1, rectangles.length) * 0.1 + perimeterRatio * 0.03;
  const scoringApproach = options.scoringApproach ?? "weighted";
  // Bounding area is the main objective. Smaller terms trade a little area
  // against viewport escape, enclosed cavities, disconnected/sparsely linked
  // clusters, and jagged combined outlines. These coefficients are exposed in
  // this one objective function for independent benchmark tuning.
  const quality = targetAspect && aspectError !== null
    ? scoringApproach === "weighted"
      ? 0.62 * normalizedWaste + 0.38 * aspectError +
        0.1 * normalizedVoids +
        0.1 * fragmentation / Math.max(1, rectangles.length) +
        0.03 * perimeterRatio
      : compactness
    : metrics.boundingArea + overflow * 0.3 +
      metrics.enclosedVoidArea * 0.25 +
      fragmentation * gridArea * 4 + perimeter * Math.sqrt(gridArea) * 0.015;
  return {
    quality,
    viewportOverflowArea: overflow,
    boundingArea: metrics.boundingArea,
    emptyArea: metrics.emptyArea,
    enclosedVoidArea: metrics.enclosedVoidArea,
    fragmentation,
    perimeter,
    compactness,
    targetAspect,
    actualAspect,
    aspectError,
    scoringApproach,
  };
}

function compareFinal(
  a: { score: SpatialLayoutScore; signature: string },
  b: { score: SpatialLayoutScore; signature: string },
): number {
  return a.score.quality - b.score.quality ||
    a.score.boundingArea - b.score.boundingArea ||
    a.score.enclosedVoidArea - b.score.enclosedVoidArea ||
    a.score.fragmentation - b.score.fragmentation ||
    a.score.perimeter - b.score.perimeter ||
    (a.score.targetAspect === null
      ? a.score.viewportOverflowArea - b.score.viewportOverflowArea
      : 0) ||
    compareText(a.signature, b.signature);
}

function sortedPanelOrder(rectangles: SpatialRectangle[], strategy: Strategy): SpatialRectangle[] {
  const byArea = (a: SpatialRectangle, b: SpatialRectangle) =>
    b.width * b.height - a.width * a.height ||
    Math.max(b.width, b.height) - Math.max(a.width, a.height) ||
    Math.min(b.width, b.height) - Math.min(a.width, a.height) ||
    b.width - a.width || b.height - a.height || compareText(a.id, b.id);
  const byLongSide = (a: SpatialRectangle, b: SpatialRectangle) =>
    Math.max(b.width, b.height) - Math.max(a.width, a.height) ||
    b.width * b.height - a.width * a.height ||
    Math.min(b.width, b.height) - Math.min(a.width, a.height) ||
    b.width - a.width || b.height - a.height || compareText(a.id, b.id);
  return [...rectangles].sort(strategy === "area-first" ? byArea : byLongSide);
}

function candidateAnchors(values: Set<number>, grid: number): number[] {
  const sorted = [...values].map((value) => alignUp(value, grid)).sort((a, b) => a - b);
  const unique = sorted.filter((value, index) => index === 0 || value !== sorted[index - 1]);
  if (unique.length <= MAX_AXIS_ANCHORS) return unique;
  const chosen = new Set<number>([unique[0], unique[unique.length - 1]]);
  for (let index = 1; index < MAX_AXIS_ANCHORS - 1; index++) {
    chosen.add(unique[Math.round(index * (unique.length - 1) / (MAX_AXIS_ANCHORS - 1))]);
  }
  return [...chosen].sort((a, b) => a - b);
}

function runStrategy(
  rectangles: SpatialRectangle[],
  strategy: Strategy,
  options: SearchOptions,
  grid: number,
  gap: number,
  camera: Point,
  scale: number,
  targetAspect: number | undefined,
  approach: ScoringApproach,
): { placedCandidates: Placed[][]; candidateCount: number } {
  const ordered = sortedPanelOrder(rectangles, strategy);
  const beamWidth = Math.max(2, Math.min(MAX_BEAM_WIDTH, Math.floor(options.beamWidth ?? DEFAULT_BEAM_WIDTH)));
  const placementsPerState = Math.max(2, Math.min(MAX_PLACEMENTS_PER_STATE, Math.floor(options.placementsPerState ?? DEFAULT_PLACEMENTS_PER_STATE)));
  let beam: BeamState[] = [{ placed: [], estimate: 0, signature: "" }];
  let candidateCount = 0;

  for (const panel of ordered) {
    const expanded: BeamState[] = [];
    for (const state of beam) {
      const xValues = new Set<number>([alignUp(camera.x, grid)]);
      const yValues = new Set<number>([alignUp(camera.y, grid)]);
      if (options.containerBounds) {
        const box = options.containerBounds;
        xValues.add(alignUp(box.x, grid));
        xValues.add(Math.floor((box.x + box.width - panel.width) / grid) * grid);
        yValues.add(alignUp(box.y, grid));
        yValues.add(Math.floor((box.y + box.height - panel.height) / grid) * grid);
      }
      for (const obstacle of options.obstacles ?? []) {
        xValues.add(obstacle.x - panel.width - gap);
        xValues.add(obstacle.x + obstacle.width + gap);
        yValues.add(obstacle.y - panel.height - gap);
        yValues.add(obstacle.y + obstacle.height + gap);
      }
      for (const item of state.placed) {
        const g = item.geometry;
        xValues.add(g.x);
        xValues.add(g.x + g.width + gap);
        xValues.add(g.x - panel.width - gap);
        yValues.add(g.y);
        yValues.add(g.y + g.height + gap);
        yValues.add(g.y - panel.height - gap);
      }
      const xs = candidateAnchors(xValues, grid);
      const ys = candidateAnchors(yValues, grid);
      const candidates: BeamState[] = [];
      for (const y of ys) {
        for (const x of xs) {
          const geometry: PanelGeometry = {
            x, y, width: panel.width, height: panel.height,
            ...(panel.minWidth === undefined ? {} : { minWidth: panel.minWidth }),
            ...(panel.minHeight === undefined ? {} : { minHeight: panel.minHeight }),
          };
          const container = options.containerBounds;
          if (container && (
            geometry.x < container.x || geometry.y < container.y ||
            geometry.x + geometry.width > container.x + container.width ||
            geometry.y + geometry.height > container.y + container.height
          )) continue;
          if ((options.obstacles ?? []).some((obstacle) => overlaps(obstacle, geometry))) continue;
          if (state.placed.some((item) => !respectsGap(item.geometry, geometry, gap))) continue;
          candidateCount++;
          const placed = [...state.placed, { id: panel.id, geometry }];
          const signature = rectKey(placed, camera);
          const estimate = estimatePartial(
            placed,
            gap,
            options.viewport,
            camera,
            scale,
            targetAspect,
            approach,
            ordered.length,
          );
          candidates.push({ placed, estimate, signature });
        }
      }
      candidates.sort((a, b) => a.estimate - b.estimate || compareText(a.signature, b.signature));
      for (const candidate of candidates.slice(0, placementsPerState)) expanded.push(candidate);
    }

    const unique = new Map<string, BeamState>();
    for (const state of expanded) {
      const existing = unique.get(state.signature);
      if (!existing || state.estimate < existing.estimate) unique.set(state.signature, state);
    }
    const next = [...unique.values()].sort((a, b) => a.estimate - b.estimate || compareText(a.signature, b.signature));
    // Keep a small amount of bbox diversity so a narrow partial state does not
    // erase all candidates that can close a later interlocking pocket.
    const selected: BeamState[] = [];
    const buckets = new Set<string>();
    for (const state of next) {
      const box = bounds(state.placed);
      const bucket = `${Math.ceil(box.width / (grid * 4))}:${Math.ceil(box.height / (grid * 4))}`;
      if (buckets.has(bucket)) continue;
      buckets.add(bucket);
      selected.push(state);
      if (selected.length >= beamWidth) break;
    }
    if (selected.length < beamWidth) {
      for (const state of next) {
        if (selected.includes(state)) continue;
        selected.push(state);
        if (selected.length >= beamWidth) break;
      }
    }
    beam = selected;
    if (!beam.length) throw new Error("Spatial search could not find a non-overlapping layout");
  }
  return { placedCandidates: beam.map((state) => state.placed), candidateCount };
}

/**
 * Deterministic bounded beam search over grid-aligned edge placements.
 * Two dimension-only placement orders are evaluated; identity is used only
 * after all geometric keys tie, for stable mapping back to caller IDs.
 *
 * This is a heuristic, not an optimality proof: positions are drawn from
 * existing rectangle edges (up to 64 anchors per axis), and intermediate
 * states are pruned by a cheap partial score. A globally optimal placement
 * between those anchors can therefore be missed. Per added rectangle, each
 * beam state checks at most 64 × 64 anchor pairs, retains at most 40 children,
 * and the beam is capped at 32 states in each of two runs. Runtime grows with
 * panel count and overlap checks; this is intended for workspace-sized sets,
 * not industrial bin-packing workloads.
 *
 * When canvas bounds are supplied, their logical width/height ratio is the
 * only aspect target; viewport size and zoom do not affect shape selection.
 * `weighted` combines normalized empty-area cost (0.62) and symmetric
 * log-aspect error (0.38), with smaller void/fragmentation/perimeter terms.
 * `near-optimal-area` first limits bounding area to the best discovered area
 * plus `areaQualityTolerance`, then minimizes aspect error. The latter is
 * less sensitive to weight tuning and cannot spend more than its explicit
 * area allowance to chase the target ratio; weighted scoring makes a smoother
 * compactness/shape trade-off.
 */
export function searchSpatialLayout(
  input: readonly SpatialRectangle[],
  options: SearchOptions = {},
): SearchResult {
  const started = monotonicNow();
  const grid = Number.isFinite(options.gridSize) && (options.gridSize ?? 0) > 0
    ? Math.max(1, Math.round(options.gridSize!)) : 12;
  const gapUnits = options.gapGridUnits ?? 0;
  if (!Number.isInteger(gapUnits) || gapUnits < 0 || gapUnits > 100) throw new Error("gapGridUnits must be an integer from 0 to 100");
  const gap = grid * gapUnits;
  const scale = Number.isFinite(options.scale) && (options.scale ?? 0) > 0 ? options.scale! : 1;
  const camera = {
    x: Number.isFinite(options.camera?.x) ? options.camera!.x : 0,
    y: Number.isFinite(options.camera?.y) ? options.camera!.y : 0,
  };
  if (options.viewport && (![options.viewport.width, options.viewport.height].every(Number.isFinite) || options.viewport.width <= 0 || options.viewport.height <= 0)) {
    throw new Error("viewport dimensions must be positive finite numbers");
  }
  if (options.canvasBounds && (
    ![options.canvasBounds.x, options.canvasBounds.y, options.canvasBounds.width, options.canvasBounds.height].every(Number.isFinite) ||
    options.canvasBounds.width <= 0 || options.canvasBounds.height <= 0
  )) {
    throw new Error("canvas bounds must have finite origin and positive dimensions");
  }
  if (options.containerBounds && (
    ![options.containerBounds.x, options.containerBounds.y, options.containerBounds.width, options.containerBounds.height].every(Number.isFinite) ||
    options.containerBounds.width <= 0 || options.containerBounds.height <= 0
  )) throw new Error("container bounds must have finite origin and positive dimensions");
  if ((options.obstacles ?? []).some((obstacle) =>
    ![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(Number.isFinite) ||
    obstacle.width <= 0 || obstacle.height <= 0
  )) throw new Error("obstacles must have finite origins and positive dimensions");
  const areaQualityTolerance = options.areaQualityTolerance ?? 0.4;
  if (!Number.isFinite(areaQualityTolerance) || areaQualityTolerance < 0 || areaQualityTolerance > 5) {
    throw new Error("areaQualityTolerance must be from 0 to 5");
  }
  const rectangles = normalizeRectangles(input, grid);
  const selectedApproach = options.scoringApproach ?? "weighted";
  const targetAspect = options.canvasBounds
    ? options.canvasBounds.width / options.canvasBounds.height
    : undefined;
  if (!rectangles.length) {
    const metrics = measureSpatialLayout([]);
    const score = scoreSpatialLayout([], metrics, { ...options, gridSize: grid, camera, scale, scoringApproach: selectedApproach });
    return {
      geometries: new Map(), camera, scale, metrics, score,
      candidateCount: 0, elapsedMs: monotonicNow() - started,
      strategy: "area-first", scoringApproach: selectedApproach,
      strategyResults: [], approachResults: [],
    };
  }

  type Candidate = {
    placed: Placed[];
    strategy: Strategy;
    score: SpatialLayoutScore;
    metrics: SpatialLayoutMetrics;
    signature: string;
  };
  const allCandidates: Record<ScoringApproach, Candidate[]> = {
    weighted: [],
    "near-optimal-area": [],
  };
  const searchCounts: Record<ScoringApproach, Record<Strategy, number>> = {
    weighted: { "area-first": 0, "long-side-first": 0 },
    "near-optimal-area": { "area-first": 0, "long-side-first": 0 },
  };
  for (const approach of ["weighted", "near-optimal-area"] as const) {
    for (const strategy of ["area-first", "long-side-first"] as const) {
      const placementOrigin = options.canvasBounds
        ? { x: options.canvasBounds.x, y: options.canvasBounds.y }
        : camera;
      const result = runStrategy(
        rectangles, strategy, options, grid, gap, placementOrigin, scale,
        targetAspect, approach,
      );
      searchCounts[approach][strategy] += result.candidateCount;
      const seen = new Set<string>();
      for (const placed of result.placedCandidates) {
        const signature = placed
          .map(({ geometry: g }) => `${g.width}x${g.height}@${g.x - placementOrigin.x},${g.y - placementOrigin.y}`)
          .sort()
          .join(";");
        if (seen.has(signature)) continue;
        seen.add(signature);
        const geometries = placed.map((item) => item.geometry);
        const metrics = measureSpatialLayout(geometries, gap);
        const score = scoreSpatialLayout(geometries, metrics, {
          ...options,
          gridSize: grid,
          camera,
          scale,
          scoringApproach: approach,
        });
        allCandidates[approach].push({ placed, strategy, score, metrics, signature });
      }
    }
  }

  const candidatesFor = (approach: ScoringApproach): Candidate[] => {
    const unique = new Map<string, Candidate>();
    for (const candidate of [...allCandidates.weighted, ...allCandidates["near-optimal-area"]]) {
      if (unique.has(candidate.signature)) continue;
      const geometries = candidate.placed.map((item) => item.geometry);
      unique.set(candidate.signature, {
        ...candidate,
        score: scoreSpatialLayout(geometries, candidate.metrics, {
          ...options,
          gridSize: grid,
          camera,
          scale,
          scoringApproach: approach,
        }),
      });
    }
    return [...unique.values()];
  };
  const candidatesByApproach = new Map<ScoringApproach, Candidate[]>([
    ["weighted", candidatesFor("weighted")],
    ["near-optimal-area", candidatesFor("near-optimal-area")],
  ]);

  const selectedFor = (approach: ScoringApproach): Candidate => {
    const candidates = candidatesByApproach.get(approach)!;
    if (!candidates.length) throw new Error("Spatial search did not produce a complete layout");
    if (approach === "weighted" || targetAspect === undefined) {
      return [...candidates].sort(compareFinal)[0];
    }
    const bestArea = Math.min(...candidates.map((candidate) => candidate.score.boundingArea));
    const eligible = candidates.filter((candidate) =>
      candidate.score.boundingArea <= bestArea * (1 + areaQualityTolerance) + 1e-12,
    );
    return [...eligible].sort((a, b) =>
      (a.score.aspectError ?? 0) - (b.score.aspectError ?? 0) ||
      a.score.compactness - b.score.compactness ||
      compareText(a.signature, b.signature),
    )[0];
  };

  const approachWinners = new Map<ScoringApproach, Candidate>();
  for (const approach of ["weighted", "near-optimal-area"] as const) {
    approachWinners.set(approach, selectedFor(approach));
  }
  const winner = approachWinners.get(selectedApproach)!;
  const geometries = new Map<string, PanelGeometry>();
  for (const item of winner.placed) geometries.set(item.id, item.geometry);
  const approachResults = (["weighted", "near-optimal-area"] as const).map((approach) => {
    const candidate = approachWinners.get(approach)!;
    return {
      approach,
      strategy: candidate.strategy,
    candidateCount: searchCounts[approach]["area-first"] + searchCounts[approach]["long-side-first"],
      score: candidate.score,
    };
  });
  const strategyResults = (["area-first", "long-side-first"] as const).map((strategy) => {
    const candidate = candidatesByApproach.get(selectedApproach)!
      .filter((item) => item.strategy === strategy)
      .sort(compareFinal)[0];
    return candidate
      ? { strategy, candidateCount: searchCounts[selectedApproach][strategy], score: candidate.score }
      : { strategy, candidateCount: searchCounts[selectedApproach][strategy], score: winner.score };
  });
  return {
    geometries,
    camera,
    scale,
    metrics: winner.metrics,
    score: winner.score,
    candidateCount: Object.values(searchCounts).reduce(
      (total, counts) => total + Object.values(counts).reduce((sum, count) => sum + count, 0),
      0,
    ),
    elapsedMs: monotonicNow() - started,
    strategy: winner.strategy,
    scoringApproach: selectedApproach,
    strategyResults,
    approachResults,
  };
}
