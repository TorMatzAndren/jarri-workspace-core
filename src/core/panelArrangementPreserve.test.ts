import { planSizePreservingArrangement } from "./panelArrangementPreserve";
import type { PanelGeometry, PanelInstance } from "./types";

function check(value: unknown, description: string): asserts value {
  if (!value) throw new Error(description);
}

function panel(
  id: string,
  geometry: PanelGeometry,
  minimized = false,
): PanelInstance {
  return {
    id,
    moduleId: "test",
    panelType: "test",
    title: id,
    geometry,
    focusOrder: 1,
    stateVersion: 1,
    panelState: {},
    display: minimized ? { mode: "minimized" } : undefined,
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
  };
}

function overlaps(a: PanelGeometry, b: PanelGeometry) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

const original = [
  panel("large", {
    x: 12, y: 12, width: 500, height: 350,
    minWidth: 400, minHeight: 250,
  }),
  panel("small", {
    x: 80, y: 40, width: 230, height: 180,
  }),
  panel("tall", {
    x: 200, y: 110, width: 270, height: 490,
  }),
];

const plan = planSizePreservingArrangement({
  panels: original,
  viewport: { width: 900, height: 700 },
  origin: { x: 0, y: 0 },
  scale: 1,
  gap: 16,
});

check(plan.geometries.size === 3, "all visible panels arranged");
check(plan.scale === 1, "zoom unchanged");
check(plan.camera.x === 0 && plan.camera.y === 0, "camera unchanged");

for (const item of original) {
  const arranged = plan.geometries.get(item.id);
  check(arranged, `${item.id} present`);
  const alignUp = (value: number) => Math.ceil(value / 12) * 12;
  check(
    arranged.width === alignUp(
      Math.max(item.geometry.width, item.geometry.minWidth ?? 0),
    ),
    `${item.id} width aligned upward`,
  );
  check(
    arranged.height === alignUp(
      Math.max(item.geometry.height, item.geometry.minHeight ?? 0),
    ),
    `${item.id} height aligned upward`,
  );
  check(
    arranged.x % 12 === 0 && arranged.y % 12 === 0,
    `${item.id} position aligned to grid`,
  );
  check(
    arranged.minWidth === item.geometry.minWidth &&
      arranged.minHeight === item.geometry.minHeight,
    `${item.id} size constraints preserved`,
  );
}

const boxes = [...plan.geometries.values()];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    check(!overlaps(boxes[i], boxes[j]), "arranged panels do not overlap");
  }
}

const repeat = planSizePreservingArrangement({
  panels: original,
  viewport: { width: 900, height: 700 },
  origin: { x: 0, y: 0 },
  scale: 1,
  gap: 16,
});

check(
  JSON.stringify([...plan.geometries]) ===
    JSON.stringify([...repeat.geometries]),
  "arrangement is deterministic",
);

const offscreen = panel("far", {
  x: 5000, y: 5000, width: 300, height: 200,
});
const minimized = panel("hidden", {
  x: 30, y: 30, width: 300, height: 200,
}, true);

const selective = planSizePreservingArrangement({
  panels: [...original, offscreen, minimized],
  viewport: { width: 900, height: 700 },
  origin: { x: 0, y: 0 },
  scale: 1,
});

check(!selective.geometries.has("far"), "offscreen panel untouched");
check(!selective.geometries.has("hidden"), "minimized panel untouched");

const shifted = planSizePreservingArrangement({
  panels: [panel("shifted", {
    x: 2100, y: 1600, width: 350, height: 220,
  })],
  viewport: { width: 800, height: 600 },
  origin: { x: 2000, y: 1500 },
  scale: 1,
});

check(
  shifted.geometries.get("shifted")?.x === 2016 &&
    shifted.geometries.get("shifted")?.y === 1512,
  "camera-relative placement preserved",
);

const wide = planSizePreservingArrangement({
  panels: [panel("wide", {
    x: 0, y: 0, width: 1200, height: 300,
  })],
  viewport: { width: 800, height: 600 },
  origin: { x: 0, y: 0 },
  scale: 1,
});

check(wide.geometries.get("wide")?.width === 1200,
  "oversized panel is never shrunk");

const customGrid = planSizePreservingArrangement({
  panels: [panel("custom", {
    x: 0, y: 0, width: 403, height: 287,
    minWidth: 300, minHeight: 200,
  })],
  viewport: { width: 900, height: 700 },
  origin: { x: 0, y: 0 },
  scale: 1,
  gap: 10,
  gridSize: 24,
});

const aligned = customGrid.geometries.get("custom");
check(aligned, "custom-grid panel arranged");
check(aligned.width === 408, "custom grid aligns width upward");
check(aligned.height === 288, "custom grid aligns height upward");
check(aligned.x % 24 === 0, "custom grid aligns x");
check(aligned.y % 24 === 0, "custom grid aligns y");

console.log("size-preserving panel arrangement tests passed");
