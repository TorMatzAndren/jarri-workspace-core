import { planSizePreservingArrangement } from "./panelArrangementPreserve";
import type { PanelInstance, PanelGeometry } from "./types";

const viewport = { width: 3440, height: 910 };
const camera = { x: -2828, y: -320 };
const scale = 0.25;
const gridSize = 24;
const gap = 5;

function panel(
  id: string,
  moduleId: string,
  panelType: string,
  geometry: PanelGeometry,
): PanelInstance {
  return {
    id,
    moduleId,
    panelType,
    title: id,
    geometry,
    focusOrder: 1,
    stateVersion: 1,
    panelState: {},
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
  };
}

// Captured from the user's active Tab 2 after File Browser resizing.
// This is the current arranged geometry, NOT the older restore snapshot.
const panels: PanelInstance[] = [
  panel("settings", "core", "settings", {
    x: -2784, y: -288, width: 1416, height: 1416,
    minWidth: 360, minHeight: 336,
  }),
  panel("themes", "core", "theme-colors", {
    x: -1344, y: -288, width: 1152, height: 1488,
    minWidth: 456, minHeight: 312,
  }),
  panel("events", "workspace-diagnostics", "runtime-events", {
    x: 2640, y: 24, width: 768, height: 624,
    minWidth: 408, minHeight: 324,
  }),
  panel("diagnostics", "workspace-diagnostics", "runtime-diagnostics", {
    x: 24, y: 2064, width: 1512, height: 1080,
    minWidth: 408, minHeight: 324,
  }),
  panel("inspector", "workspace-diagnostics", "runtime-inspector", {
    x: 3432, y: 24, width: 528, height: 624,
    minWidth: 408, minHeight: 336,
  }),
  panel("files", "core", "file-browser", {
    x: 1560, y: 2064, width: 1488, height: 1080,
    minWidth: 528, minHeight: 360,
  }),
];

function measure(geometries: Map<string, PanelGeometry>) {
  const boxes = [...geometries.values()];
  const left = Math.min(...boxes.map(g => g.x));
  const top = Math.min(...boxes.map(g => g.y));
  const right = Math.max(...boxes.map(g => g.x + g.width));
  const bottom = Math.max(...boxes.map(g => g.y + g.height));

  const width = right - left;
  const height = bottom - top;
  const boundingArea = width * height;
  const panelArea = boxes.reduce(
    (sum, g) => sum + g.width * g.height, 0,
  );

  let collisions = 0;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        collisions++;
      }
    }
  }

  return {
    width,
    height,
    boundingArea,
    panelArea,
    emptyArea: boundingArea - panelArea,
    utilizationPercent: Number(
      (100 * panelArea / boundingArea).toFixed(2),
    ),
    visibleWidthPx: Number((width * scale).toFixed(1)),
    visibleHeightPx: Number((height * scale).toFixed(1)),
    collisions,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const input = new Map(
  panels.map(p => [p.id, p.geometry]),
);

const args = {
  panels,
  viewport,
  origin: camera,
  scale,
  gridSize,
  gap,
};

const plan = planSizePreservingArrangement(args);
const repeated = planSizePreservingArrangement(args);

assert(plan.geometries.size === panels.length,
  "All six visible panels must be arranged");

assert(JSON.stringify([...plan.geometries]) ===
  JSON.stringify([...repeated.geometries]),
  "Identical inputs must produce identical geometry");

assert(plan.scale === scale,
  "Preserve mode must retain zoom");

assert(
  plan.camera.x === camera.x && plan.camera.y === camera.y,
  "Preserve mode must retain camera",
);

for (const p of panels) {
  const next = plan.geometries.get(p.id);
  assert(Boolean(next), `Missing panel: ${p.id}`);
  if (!next) continue;

  assert(next.x % gridSize === 0 && next.y % gridSize === 0,
    `Grid alignment: ${p.id}`);

  assert(next.width >= p.geometry.width &&
    next.height >= p.geometry.height,
    `Preserve dimensions: ${p.id}`);

  assert(next.width % gridSize === 0 &&
    next.height % gridSize === 0,
    `Aligned dimensions: ${p.id}`);
}

const before = measure(input);
const after = measure(plan.geometries);

assert(after.collisions === 0, "Planner must not overlap panels");

console.log("\n===== CAPTURED WORKSPACE =====");
console.log(JSON.stringify({
  viewport,
  logicalViewport: {
    width: viewport.width / scale,
    height: viewport.height / scale,
  },
  camera,
  scale,
  gridSize,
  requestedGap: gap,
  before,
  after,
}, null, 2));

console.log("\n===== SHELF PLANNER RESULT =====");

for (const p of panels) {
  const g = plan.geometries.get(p.id)!;
  console.log(
    `${p.id.padEnd(12)} ` +
    `x=${String(g.x).padStart(6)} ` +
    `y=${String(g.y).padStart(6)} ` +
    `w=${String(g.width).padStart(5)} ` +
    `h=${String(g.height).padStart(5)}`,
  );
}

console.log("\nPASS: Real-layout benchmark captured");
console.log("PASS: Determinism, geometry and collision contracts");
