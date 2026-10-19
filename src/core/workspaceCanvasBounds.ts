import type { PanelInstance, WorkspaceCanvasBounds } from "./types";

export const WORKSPACE_CANVAS_GRID_SIZE = 24;
export const MIN_WORKSPACE_CANVAS_WIDTH = 900;
export const MIN_WORKSPACE_CANVAS_HEIGHT = 700;

function snapToCanvasGrid(value: number) {
  return Math.ceil(value / WORKSPACE_CANVAS_GRID_SIZE) * WORKSPACE_CANVAS_GRID_SIZE;
}

/**
 * Preserve the current canvas extent while expanding it for outlying panels.
 * Callers that want to contract the canvas must pass the user's proposed
 * bounds; panel removal/resizing alone intentionally does not contract it.
 */
export function normalizeWorkspaceCanvasBounds(
  bounds: WorkspaceCanvasBounds,
  panels: readonly PanelInstance[],
): WorkspaceCanvasBounds {
  // The minimum-size rectangle is relative to the proposed canvas origin.
  // Logical coordinate zero is ordinary workspace space, not a required edge.
  const minimumRight = bounds.x + MIN_WORKSPACE_CANVAS_WIDTH;
  const minimumBottom = bounds.y + MIN_WORKSPACE_CANVAS_HEIGHT;
  const required = panels.reduce(
    (current, panel) => ({
      x: Math.min(current.x, panel.geometry.x),
      y: Math.min(current.y, panel.geometry.y),
      right: Math.max(current.right, panel.geometry.x + panel.geometry.width),
      bottom: Math.max(current.bottom, panel.geometry.y + panel.geometry.height),
    }),
    {
      x: bounds.x,
      y: bounds.y,
      right: minimumRight,
      bottom: minimumBottom,
    },
  );
  const x = Math.min(bounds.x, required.x);
  const y = Math.min(bounds.y, required.y);
  const right = Math.max(
    bounds.x + bounds.width,
    required.right,
    x + MIN_WORKSPACE_CANVAS_WIDTH,
  );
  const bottom = Math.max(
    bounds.y + bounds.height,
    required.bottom,
    y + MIN_WORKSPACE_CANVAS_HEIGHT,
  );
  return {
    x,
    y,
    width: snapToCanvasGrid(right - x),
    height: snapToCanvasGrid(bottom - y),
  };
}
