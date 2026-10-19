import type { PanelGeometry } from "./types";

export type SpatialLayoutMetrics = {
  boundingWidth: number;
  boundingHeight: number;
  boundingArea: number;
  panelArea: number;
  emptyArea: number;
  utilization: number;
  enclosedVoidArea: number;
  enclosedVoidCount: number;
  occupiedPerimeter: number;
  adjacentPairs: number;
  clusterCount: number;
};

type Rectangle = Pick<
  PanelGeometry, "x" | "y" | "width" | "height"
>;

function intersect(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function adjacent(a: Rectangle, b: Rectangle, gap: number): boolean {
  const horizontalOverlap =
    Math.min(a.x + a.width, b.x + b.width) -
    Math.max(a.x, b.x);

  const verticalOverlap =
    Math.min(a.y + a.height, b.y + b.height) -
    Math.max(a.y, b.y);

  const horizontalDistance = Math.max(
    0,
    b.x - (a.x + a.width),
    a.x - (b.x + b.width),
  );

  const verticalDistance = Math.max(
    0,
    b.y - (a.y + a.height),
    a.y - (b.y + b.height),
  );

  return (
    (verticalOverlap > 0 && horizontalDistance <= gap) ||
    (horizontalOverlap > 0 && verticalDistance <= gap)
  );
}

/**
 * Deterministic evaluation of non-overlapping panel rectangles.
 *
 * Enclosed voids are measured using coordinate compression, rather than
 * a pixel-sized raster. The algorithm works with exact rectangle edges.
 *
 * Panels are solid obstacles. Configured clearance is counted as empty
 * area; it is not silently subtracted from the result.
 */
export function measureSpatialLayout(
  rectangles: readonly Rectangle[],
  adjacencyGap = 24,
): SpatialLayoutMetrics {
  if (!Number.isFinite(adjacencyGap) || adjacencyGap < 0) {
    throw new Error("Invalid adjacency gap");
  }

  if (rectangles.length === 0) {
    return {
      boundingWidth: 0,
      boundingHeight: 0,
      boundingArea: 0,
      panelArea: 0,
      emptyArea: 0,
      utilization: 0,
      enclosedVoidArea: 0,
      enclosedVoidCount: 0,
      occupiedPerimeter: 0,
      adjacentPairs: 0,
      clusterCount: 0,
    };
  }

  for (const rect of rectangles) {
    if (
      ![rect.x, rect.y, rect.width, rect.height]
        .every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      throw new Error("Invalid spatial rectangle");
    }
  }

  const count = rectangles.length;
  const connections: number[][] =
    Array.from({ length: count }, () => []);

  let adjacentPairs = 0;

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (intersect(rectangles[i], rectangles[j])) {
        throw new Error("Spatial rectangles overlap");
      }

      if (adjacent(rectangles[i], rectangles[j], adjacencyGap)) {
        adjacentPairs++;
        connections[i].push(j);
        connections[j].push(i);
      }
    }
  }

  const visitedPanels = new Set<number>();
  let clusterCount = 0;

  for (let i = 0; i < count; i++) {
    if (visitedPanels.has(i)) continue;

    clusterCount++;
    const queue = [i];
    visitedPanels.add(i);

    for (let head = 0; head < queue.length; head++) {
      for (const next of connections[queue[head]]) {
        if (!visitedPanels.has(next)) {
          visitedPanels.add(next);
          queue.push(next);
        }
      }
    }
  }

  const left = Math.min(...rectangles.map(r => r.x));
  const top = Math.min(...rectangles.map(r => r.y));
  const right = Math.max(...rectangles.map(r => r.x + r.width));
  const bottom = Math.max(...rectangles.map(r => r.y + r.height));

  const boundingWidth = right - left;
  const boundingHeight = bottom - top;
  const boundingArea = boundingWidth * boundingHeight;
  const panelArea = rectangles.reduce(
    (sum, r) => sum + r.width * r.height, 0,
  );

  const xs = [...new Set(rectangles.flatMap(
    r => [r.x, r.x + r.width],
  ))].sort((a, b) => a - b);

  const ys = [...new Set(rectangles.flatMap(
    r => [r.y, r.y + r.height],
  ))].sort((a, b) => a - b);

  const columns = xs.length - 1;
  const rows = ys.length - 1;

  const occupied: boolean[][] = Array.from(
    { length: rows },
    () => Array<boolean>(columns).fill(false),
  );

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      occupied[y][x] = rectangles.some(r =>
        xs[x] >= r.x &&
        xs[x + 1] <= r.x + r.width &&
        ys[y] >= r.y &&
        ys[y + 1] <= r.y + r.height
      );
    }
  }

  const seen = new Set<number>();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let enclosedVoidArea = 0;
  let enclosedVoidCount = 0;
  let occupiedPerimeter = 0;

  // Perimeter of the combined occupied shape, excluding shared edges.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!occupied[y][x]) continue;

      const width = xs[x + 1] - xs[x];
      const height = ys[y + 1] - ys[y];

      if (x === 0 || !occupied[y][x - 1])
        occupiedPerimeter += height;
      if (x === columns - 1 || !occupied[y][x + 1])
        occupiedPerimeter += height;
      if (y === 0 || !occupied[y - 1][x])
        occupiedPerimeter += width;
      if (y === rows - 1 || !occupied[y + 1][x])
        occupiedPerimeter += width;
    }
  }

  // A void is enclosed only if no cell in its connected free region
  // touches the bounding rectangle's exterior.
  for (let startY = 0; startY < rows; startY++) {
    for (let startX = 0; startX < columns; startX++) {
      const first = startY * columns + startX;
      if (occupied[startY][startX] || seen.has(first))
        continue;

      const queue: Array<[number, number]> = [[startX, startY]];
      seen.add(first);

      let area = 0;
      let touchesExterior = false;

      for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head];

        area += (xs[x + 1] - xs[x]) *
          (ys[y + 1] - ys[y]);

        if (
          x === 0 || y === 0 ||
          x === columns - 1 ||
          y === rows - 1
        ) {
          touchesExterior = true;
        }

        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx < 0 || nx >= columns ||
            ny < 0 || ny >= rows ||
            occupied[ny][nx]
          ) continue;

          const index = ny * columns + nx;
          if (seen.has(index)) continue;

          seen.add(index);
          queue.push([nx, ny]);
        }
      }

      if (!touchesExterior) {
        enclosedVoidCount++;
        enclosedVoidArea += area;
      }
    }
  }

  return {
    boundingWidth,
    boundingHeight,
    boundingArea,
    panelArea,
    emptyArea: boundingArea - panelArea,
    utilization: panelArea / boundingArea,
    enclosedVoidArea,
    enclosedVoidCount,
    occupiedPerimeter,
    adjacentPairs,
    clusterCount,
  };
}
