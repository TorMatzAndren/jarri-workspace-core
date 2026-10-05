import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefCallback,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ensureWorkspaceNativeSurfaceForPanel,
  setWorkspaceNativeSurfaceVisible,
  updateWorkspaceNativeSurface,
  type WorkspaceNativeSurface,
  type WorkspaceNativeSurfaceGeometry,
} from "./nativeSurface";

function geometryKey(geometry: WorkspaceNativeSurfaceGeometry): string {
  const clips =
    geometry.visibleClips ??
    (geometry.visibleClip ? [geometry.visibleClip] : []);

  return [
    geometry.x,
    geometry.y,
    geometry.width,
    geometry.height,
    ...clips.flatMap((clip) => [clip.x, clip.y, clip.width, clip.height]),
  ].join(",");
}

type SurfaceRectangle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function rectangleWidth(rectangle: SurfaceRectangle): number {
  return Math.max(0, rectangle.right - rectangle.left);
}

function rectangleHeight(rectangle: SurfaceRectangle): number {
  return Math.max(0, rectangle.bottom - rectangle.top);
}

function intersectRectangles(
  left: SurfaceRectangle,
  right: SurfaceRectangle,
): SurfaceRectangle | null {
  const intersection = {
    left: Math.max(left.left, right.left),
    top: Math.max(left.top, right.top),
    right: Math.min(left.right, right.right),
    bottom: Math.min(left.bottom, right.bottom),
  };

  if (rectangleWidth(intersection) <= 0 || rectangleHeight(intersection) <= 0) {
    return null;
  }

  return intersection;
}

function subtractRectangle(
  source: SurfaceRectangle,
  occluder: SurfaceRectangle,
): SurfaceRectangle[] {
  const overlap = intersectRectangles(source, occluder);

  if (!overlap) {
    return [source];
  }

  const result: SurfaceRectangle[] = [];

  if (overlap.top > source.top) {
    result.push({
      left: source.left,
      top: source.top,
      right: source.right,
      bottom: overlap.top,
    });
  }

  if (overlap.bottom < source.bottom) {
    result.push({
      left: source.left,
      top: overlap.bottom,
      right: source.right,
      bottom: source.bottom,
    });
  }

  if (overlap.left > source.left) {
    result.push({
      left: source.left,
      top: overlap.top,
      right: overlap.left,
      bottom: overlap.bottom,
    });
  }

  if (overlap.right < source.right) {
    result.push({
      left: overlap.right,
      top: overlap.top,
      right: source.right,
      bottom: overlap.bottom,
    });
  }

  return result.filter(
    (rectangle) =>
      rectangleWidth(rectangle) > 0 && rectangleHeight(rectangle) > 0,
  );
}

function elementVisiblyOccupiesSpace(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const style = window.getComputedStyle(element);

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || "1") !== 0
  );
}

function panelFrameZIndex(frame: HTMLElement): number {
  const inline = Number(frame.style.zIndex);

  if (Number.isFinite(inline)) {
    return inline;
  }

  const computed = Number(window.getComputedStyle(frame).zIndex);

  return Number.isFinite(computed) ? computed : 0;
}

function domRectRectangle(rect: DOMRect): SurfaceRectangle {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

function workspaceNativeSurfaceVisibleRectangles(
  element: HTMLElement,
): SurfaceRectangle[] {
  const ownFrame = element.closest<HTMLElement>(".panel-frame");

  const canvasSurface = element.closest<HTMLElement>(
    ".workspace-canvas__surface",
  );

  const elementRectangle = domRectRectangle(element.getBoundingClientRect());

  if (!canvasSurface) {
    return [elementRectangle];
  }

  const canvasRect = canvasSurface.getBoundingClientRect();

  const canvasRectangle: SurfaceRectangle = {
    left: canvasRect.left + canvasSurface.clientLeft,
    top: canvasRect.top + canvasSurface.clientTop,
    right:
      canvasRect.left + canvasSurface.clientLeft + canvasSurface.clientWidth,
    bottom:
      canvasRect.top + canvasSurface.clientTop + canvasSurface.clientHeight,
  };

  const canvasVisible = intersectRectangles(elementRectangle, canvasRectangle);

  if (!canvasVisible) {
    return [];
  }

  if (!ownFrame) {
    return [canvasVisible];
  }

  const ownZ = panelFrameZIndex(ownFrame);

  let visible = [canvasVisible];

  const frames = canvasSurface.querySelectorAll<HTMLElement>(".panel-frame");

  const higherFrames = [...frames]
    .filter((frame) => frame !== ownFrame && panelFrameZIndex(frame) > ownZ)
    .sort((left, right) => panelFrameZIndex(left) - panelFrameZIndex(right));

  for (const frame of higherFrames) {
    const frameRect = frame.getBoundingClientRect();

    if (frameRect.width <= 0 || frameRect.height <= 0) {
      continue;
    }

    const occluder = domRectRectangle(frameRect);

    visible = visible.flatMap((rectangle) =>
      subtractRectangle(rectangle, occluder),
    );

    if (visible.length === 0) {
      break;
    }
  }

  /*
   * Workspace-owned shell surfaces can live outside the canvas
   * panel hierarchy while still visually dominating native
   * content. Those surfaces opt in explicitly through this
   * generic marker.
   */
  const shellOccluders = document.querySelectorAll<HTMLElement>(
    "[data-workspace-native-occluder]",
  );

  for (const shellOccluder of shellOccluders) {
    if (!elementVisiblyOccupiesSpace(shellOccluder)) {
      continue;
    }

    const occluder = domRectRectangle(shellOccluder.getBoundingClientRect());

    visible = visible.flatMap((rectangle) =>
      subtractRectangle(rectangle, occluder),
    );

    if (visible.length === 0) {
      break;
    }
  }

  return visible;
}

export function readWorkspaceNativeSurfaceGeometry(
  element: HTMLElement,
  scaleFactor: number,
): WorkspaceNativeSurfaceGeometry {
  const rect = element.getBoundingClientRect();

  const visibleRectangles = workspaceNativeSurfaceVisibleRectangles(element);

  const visibleClips = visibleRectangles.map((rectangle) => ({
    x: Math.round(rectangle.left * scaleFactor),
    y: Math.round(rectangle.top * scaleFactor),
    width: Math.max(0, Math.round(rectangleWidth(rectangle) * scaleFactor)),
    height: Math.max(0, Math.round(rectangleHeight(rectangle) * scaleFactor)),
  }));

  return {
    x: Math.round(rect.left * scaleFactor),
    y: Math.round(rect.top * scaleFactor),
    width: Math.max(1, Math.round(rect.width * scaleFactor)),
    height: Math.max(1, Math.round(rect.height * scaleFactor)),
    visibleClips,
  };
}

export type WorkspaceNativeSurfaceMount = {
  mountRef: RefCallback<HTMLDivElement>;
  surface: WorkspaceNativeSurface | null;
  error: string | null;
  refreshGeometry: () => void;
};

export function useWorkspaceNativeSurfaceMount(
  panelId: string,
): WorkspaceNativeSurfaceMount {
  const elementRef = useRef<HTMLDivElement | null>(null);

  const surfaceRef = useRef<WorkspaceNativeSurface | null>(null);

  const scaleFactorRef = useRef(1);
  const lastGeometryRef = useRef("");
  const lastVisibleRef = useRef<boolean | null>(null);
  const animationFrameRef = useRef(0);
  const disposedRef = useRef(false);

  const [surface, setSurface] = useState<WorkspaceNativeSurface | null>(null);

  const [error, setError] = useState<string | null>(null);

  const synchronizeGeometry = useCallback(async () => {
    const element = elementRef.current;

    if (!element || disposedRef.current) {
      return;
    }

    const geometry = readWorkspaceNativeSurfaceGeometry(
      element,
      scaleFactorRef.current,
    );

    const nextGeometryKey = geometryKey(geometry);

    const nextVisible = (geometry.visibleClips?.length ?? 0) > 0;

    try {
      if (!surfaceRef.current) {
        const created = await ensureWorkspaceNativeSurfaceForPanel(
          panelId,
          geometry,
        );

        if (disposedRef.current) {
          void setWorkspaceNativeSurfaceVisible(created.surfaceId, false).catch(
            () => {},
          );

          return;
        }

        surfaceRef.current = created;
        setSurface(created);
        lastGeometryRef.current = nextGeometryKey;
      } else if (lastGeometryRef.current !== nextGeometryKey) {
        await updateWorkspaceNativeSurface(
          surfaceRef.current.surfaceId,
          geometry,
        );

        lastGeometryRef.current = nextGeometryKey;
      }

      const currentSurface = surfaceRef.current;

      if (currentSurface && lastVisibleRef.current !== nextVisible) {
        await setWorkspaceNativeSurfaceVisible(
          currentSurface.surfaceId,
          nextVisible,
        );

        lastVisibleRef.current = nextVisible;
      }

      setError(null);
    } catch (cause) {
      if (!disposedRef.current) {
        setError(String(cause));
      }
    }
  }, [panelId]);

  const scheduleGeometry = useCallback(() => {
    if (animationFrameRef.current !== 0) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = 0;
      void synchronizeGeometry();
    });
  }, [synchronizeGeometry]);

  const mountRef = useCallback<RefCallback<HTMLDivElement>>(
    (element) => {
      elementRef.current = element;

      if (element) {
        scheduleGeometry();
      }
    },
    [scheduleGeometry],
  );

  useEffect(() => {
    disposedRef.current = false;

    let resizeObserver: ResizeObserver | null = null;

    let mutationObserver: MutationObserver | null = null;
    let shellMutationObserver: MutationObserver | null = null;

    let canvasSurface: HTMLElement | null = null;
    let workspaceShell: HTMLElement | null = null;

    let currentWindowUnlisten: (() => void) | undefined;

    async function start() {
      try {
        scaleFactorRef.current = await getCurrentWindow().scaleFactor();
      } catch (cause) {
        if (!disposedRef.current) {
          setError(String(cause));
        }

        return;
      }

      if (disposedRef.current) {
        return;
      }

      const element = elementRef.current;

      if (!element) {
        return;
      }

      canvasSurface = element.closest<HTMLElement>(
        ".workspace-canvas__surface",
      );

      workspaceShell = element.closest<HTMLElement>(".workspace-shell");

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleGeometry);

        resizeObserver.observe(element);

        if (canvasSurface) {
          resizeObserver.observe(canvasSurface);
        }
      }

      if (typeof MutationObserver !== "undefined" && canvasSurface) {
        mutationObserver = new MutationObserver(scheduleGeometry);

        mutationObserver.observe(canvasSurface, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["style", "class"],
        });
      }

      if (typeof MutationObserver !== "undefined" && workspaceShell) {
        shellMutationObserver = new MutationObserver(scheduleGeometry);

        shellMutationObserver.observe(workspaceShell, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["style", "class"],
        });
      }

      canvasSurface?.addEventListener("scroll", scheduleGeometry, {
        passive: true,
      });

      window.addEventListener("resize", scheduleGeometry, {
        passive: true,
      });

      try {
        currentWindowUnlisten = await getCurrentWindow().onScaleChanged(
          ({ payload }) => {
            scaleFactorRef.current = payload.scaleFactor;

            lastGeometryRef.current = "";
            scheduleGeometry();
          },
        );
      } catch {
        // Geometry still works with the scale
        // observed when the mount started.
      }

      await synchronizeGeometry();
    }

    void start();

    return () => {
      disposedRef.current = true;

      if (animationFrameRef.current !== 0) {
        window.cancelAnimationFrame(animationFrameRef.current);

        animationFrameRef.current = 0;
      }

      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      shellMutationObserver?.disconnect();

      canvasSurface?.removeEventListener("scroll", scheduleGeometry);

      window.removeEventListener("resize", scheduleGeometry);

      currentWindowUnlisten?.();

      const currentSurface = surfaceRef.current;

      if (currentSurface) {
        lastVisibleRef.current = false;

        void setWorkspaceNativeSurfaceVisible(
          currentSurface.surfaceId,
          false,
        ).catch(() => {});
      }
    };
  }, [panelId, scheduleGeometry, synchronizeGeometry]);

  return {
    mountRef,
    surface,
    error,
    refreshGeometry: scheduleGeometry,
  };
}
