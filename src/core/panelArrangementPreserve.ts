import type {
  PanelGeometry,
  PanelInstance,
  WorkspaceCanvasBounds,
} from "./types";
import type {
  ArrangementViewport,
  PanelArrangement,
} from "./panelArrangement";

/**
 * Arrange panels intersecting the current viewport without changing their
 * dimensions. Panels outside the view and minimized panels are untouched.
 *
 * The planner preserves the incoming zoom and camera, orders targets by their
 * original visual position, and uses deterministic shelf packing.
 *
 * If a panel is wider than the viewport, it occupies a row by itself.
 * The logical canvas can expand; panels are never resized to fit.
 */
export function planSizePreservingArrangement({
  panels,
  viewport,
  origin,
  scale,
  gap = 12,
  gridSize = 12,
}: {
  panels: PanelInstance[];
  viewport: ArrangementViewport;
  origin: { x: number; y: number };
  scale: number;
  gap?: number;
  gridSize?: number;
}): PanelArrangement {
  const camera = {
    x: Number.isFinite(origin.x) ? origin.x : 0,
    y: Number.isFinite(origin.y) ? origin.y : 0,
  };
  const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const geometries = new Map<string, PanelGeometry>();

  const result = { camera, scale: zoom, geometries };

  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return result;
  }

  const area: WorkspaceCanvasBounds = {
    x: camera.x,
    y: camera.y,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  };

  const grid = Number.isFinite(gridSize)
    ? Math.max(1, Math.round(gridSize))
    : 12;

  const alignUp = (value: number) =>
    Math.ceil(value / grid) * grid;

  const spacing = alignUp(
    Number.isFinite(gap)
      ? Math.max(0, Math.min(240, gap))
      : 12,
  );

  const targets = panels
    .filter((panel) => {
      if (panel.display?.mode === "minimized") return false;
      const box = panel.geometry;
      return (
        Number.isFinite(box.x) &&
        Number.isFinite(box.y) &&
        Number.isFinite(box.width) &&
        Number.isFinite(box.height) &&
        box.width > 0 &&
        box.height > 0 &&
        box.x < area.x + area.width &&
        box.x + box.width > area.x &&
        box.y < area.y + area.height &&
        box.y + box.height > area.y
      );
    })
    .sort(
      (a, b) =>
        a.geometry.y - b.geometry.y ||
        a.geometry.x - b.geometry.x ||
        a.id.localeCompare(b.id),
    );

  const left = alignUp(area.x + spacing);
  let x = left;
  let y = alignUp(area.y + spacing);
  let rowHeight = 0;
  const right = Math.floor(
    (area.x + area.width - spacing) / grid,
  ) * grid;

  for (const panel of targets) {
    const geometry = panel.geometry;

    const width = alignUp(
      Math.max(geometry.width, geometry.minWidth ?? 0),
    );
    const height = alignUp(
      Math.max(geometry.height, geometry.minHeight ?? 0),
    );

    if (rowHeight > 0 && x + width > right) {
      x = left;
      y = alignUp(y + rowHeight + spacing);
      rowHeight = 0;
    }

    geometries.set(panel.id, {
      ...geometry,
      x,
      y,
      width,
      height,
    });

    x = alignUp(x + width + spacing);
    rowHeight = Math.max(rowHeight, height);
  }

  return result;
}
