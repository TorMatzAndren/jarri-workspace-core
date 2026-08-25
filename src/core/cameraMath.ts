import type {
  WorkspaceCanvasCamera,
  PanelInstance,
  WorkspaceCanvasBounds,
  WorkspacePreferences,
} from "./types";

export type WorkspaceViewportSize = {
  width: number;
  height: number;
};

export type WorkspaceScrollPosition = {
  scrollLeft: number;
  scrollTop: number;
};

export type WorkspaceViewportAnchor = {
  logicalX: number;
  logicalY: number;
  viewportX: number;
  viewportY: number;
};

export type WorkspaceLogicalViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampCanvasScale(canvasScale: number) {
  return Math.min(
    2,
    Math.max(0.25, Number.isFinite(canvasScale) ? canvasScale : 1),
  );
}

export function nextCanvasScaleFromWheel(
  currentScale: number,
  deltaY: number,
  incrementPercent: number,
) {
  const zoomStep = 1 + incrementPercent / 100;
  const zoomFactor = deltaY < 0 ? zoomStep : 1 / zoomStep;
  return clampCanvasScale(currentScale * zoomFactor);
}

export function logicalPointAtViewport(
  viewportX: number,
  viewportY: number,
  bounds: WorkspaceCanvasBounds,
  viewport: WorkspaceViewportSize,
  scroll: WorkspaceScrollPosition,
  canvasScale: number,
) {
  return {
    x:
      bounds.x +
      (scroll.scrollLeft + viewportX - viewport.width) / canvasScale,
    y:
      bounds.y +
      (scroll.scrollTop + viewportY - viewport.height) / canvasScale,
  };
}

export function logicalViewportFromScroll(
  bounds: WorkspaceCanvasBounds,
  viewport: WorkspaceViewportSize,
  scroll: WorkspaceScrollPosition,
  canvasScale: number,
): WorkspaceLogicalViewport {
  return {
    x: bounds.x + (scroll.scrollLeft - viewport.width) / canvasScale,
    y: bounds.y + (scroll.scrollTop - viewport.height) / canvasScale,
    width: viewport.width / canvasScale,
    height: viewport.height / canvasScale,
  };
}

export function cameraOriginFromScroll(
  bounds: WorkspaceCanvasBounds,
  viewport: WorkspaceViewportSize,
  scroll: WorkspaceScrollPosition,
  canvasScale: number,
): WorkspaceCanvasCamera {
  const logical = logicalViewportFromScroll(
    bounds,
    viewport,
    scroll,
    canvasScale,
  );

  return {
    x: logical.x,
    y: logical.y,
  };
}

export function viewportSizesMatch(
  measured: WorkspaceViewportSize,
  current: WorkspaceViewportSize,
  tolerance = 0.5,
) {
  return (
    Math.abs(measured.width - current.width) <= tolerance &&
    Math.abs(measured.height - current.height) <= tolerance
  );
}

export function scrollForCameraOrigin(
  camera: WorkspaceCanvasCamera,
  bounds: WorkspaceCanvasBounds,
  viewport: WorkspaceViewportSize,
  canvasScale: number,
): WorkspaceScrollPosition {
  return scrollForAnchor(
    {
      logicalX: camera.x,
      logicalY: camera.y,
      viewportX: 0,
      viewportY: 0,
    },
    bounds,
    viewport,
    canvasScale,
  );
}

export function scrollForAnchor(
  anchor: WorkspaceViewportAnchor,
  bounds: WorkspaceCanvasBounds,
  viewport: WorkspaceViewportSize,
  canvasScale: number,
) {
  return {
    scrollLeft:
      viewport.width +
      (anchor.logicalX - bounds.x) * canvasScale -
      anchor.viewportX,
    scrollTop:
      viewport.height +
      (anchor.logicalY - bounds.y) * canvasScale -
      anchor.viewportY,
  };
}

export function clampScroll(
  scroll: WorkspaceScrollPosition,
  maxScroll: WorkspaceScrollPosition,
) {
  return {
    scrollLeft: Math.min(
      Math.max(0, maxScroll.scrollLeft),
      Math.max(0, scroll.scrollLeft),
    ),
    scrollTop: Math.min(
      Math.max(0, maxScroll.scrollTop),
      Math.max(0, scroll.scrollTop),
    ),
  };
}

export function scrollDeltaForCanvasOriginChange(
  previous: Pick<WorkspaceCanvasBounds, "x" | "y">,
  next: Pick<WorkspaceCanvasBounds, "x" | "y">,
  canvasScale: number,
) {
  return {
    scrollLeft: (previous.x - next.x) * canvasScale,
    scrollTop: (previous.y - next.y) * canvasScale,
  };
}

export function activePanelForCamera(panels: PanelInstance[]) {
  return panels
    .filter((panel) => panel.display?.mode !== "minimized")
    .reduce<PanelInstance | null>(
      (current, panel) =>
        !current || panel.focusOrder > current.focusOrder ? panel : current,
      null,
    );
}

export function zoomAnchorForMode({
  mode,
  panels,
  pointer,
  bounds,
  viewport,
  scroll,
  canvasScale,
}: {
  mode: WorkspacePreferences["workspaceZoomAnchorMode"];
  panels: PanelInstance[];
  pointer: { x: number; y: number };
  bounds: WorkspaceCanvasBounds;
  viewport: WorkspaceViewportSize;
  scroll: WorkspaceScrollPosition;
  canvasScale: number;
}): WorkspaceViewportAnchor {
  const activePanel = activePanelForCamera(panels);
  const viewportCenterX = viewport.width / 2;
  const viewportCenterY = viewport.height / 2;

  function viewportAnchor(x: number, y: number): WorkspaceViewportAnchor {
    const logical = logicalPointAtViewport(
      x,
      y,
      bounds,
      viewport,
      scroll,
      canvasScale,
    );

    return {
      logicalX: logical.x,
      logicalY: logical.y,
      viewportX: x,
      viewportY: y,
    };
  }

  switch (mode) {
    case "pointer":
      return viewportAnchor(pointer.x, pointer.y);

    case "viewport-center":
      return viewportAnchor(viewportCenterX, viewportCenterY);

    case "active-panel-top-left":
      if (activePanel) {
        return {
          logicalX: activePanel.geometry.x,
          logicalY: activePanel.geometry.y,
          viewportX: 0,
          viewportY: 0,
        };
      }
      return viewportAnchor(viewportCenterX, viewportCenterY);

    case "active-panel-center":
    default:
      if (activePanel) {
        return {
          logicalX: activePanel.geometry.x + activePanel.geometry.width / 2,
          logicalY: activePanel.geometry.y + activePanel.geometry.height / 2,
          viewportX: viewportCenterX,
          viewportY: viewportCenterY,
        };
      }
      return viewportAnchor(viewportCenterX, viewportCenterY);
  }
}

export function panelNavigationAnchor(
  panel: PanelInstance,
  alignment: WorkspacePreferences["panelNavigationAlignment"],
  viewport: WorkspaceViewportSize,
): WorkspaceViewportAnchor {
  if (alignment === "panel-top-left") {
    return {
      logicalX: panel.geometry.x,
      logicalY: panel.geometry.y,
      viewportX: 0,
      viewportY: 0,
    };
  }

  return {
    logicalX: panel.geometry.x + panel.geometry.width / 2,
    logicalY: panel.geometry.y + panel.geometry.height / 2,
    viewportX: viewport.width / 2,
    viewportY: viewport.height / 2,
  };
}
