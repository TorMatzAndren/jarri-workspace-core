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
  const clip = geometry.visibleClip;

  return [
    geometry.x,
    geometry.y,
    geometry.width,
    geometry.height,
    clip?.x ?? "",
    clip?.y ?? "",
    clip?.width ?? "",
    clip?.height ?? "",
  ].join(",");
}

export function readWorkspaceNativeSurfaceGeometry(
  element: HTMLElement,
  scaleFactor: number,
): WorkspaceNativeSurfaceGeometry {
  const rect = element.getBoundingClientRect();

  const canvasSurface = element.closest<HTMLElement>(
    ".workspace-canvas__surface",
  );

  const canvasRect = canvasSurface?.getBoundingClientRect() ?? rect;

  const canvasLeft = canvasRect.left + (canvasSurface?.clientLeft ?? 0);

  const canvasTop = canvasRect.top + (canvasSurface?.clientTop ?? 0);

  const canvasRight = canvasLeft + (canvasSurface?.clientWidth ?? rect.width);

  const canvasBottom = canvasTop + (canvasSurface?.clientHeight ?? rect.height);

  const left = Math.max(rect.left, canvasLeft);
  const top = Math.max(rect.top, canvasTop);
  const right = Math.min(rect.right, canvasRight);
  const bottom = Math.min(rect.bottom, canvasBottom);

  return {
    x: Math.round(rect.left * scaleFactor),
    y: Math.round(rect.top * scaleFactor),
    width: Math.max(1, Math.round(rect.width * scaleFactor)),
    height: Math.max(1, Math.round(rect.height * scaleFactor)),
    visibleClip: {
      x: Math.round(left * scaleFactor),
      y: Math.round(top * scaleFactor),
      width: Math.max(0, Math.round(Math.max(0, right - left) * scaleFactor)),
      height: Math.max(0, Math.round(Math.max(0, bottom - top) * scaleFactor)),
    },
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

    if (surfaceRef.current && lastGeometryRef.current === nextGeometryKey) {
      return;
    }

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
      } else {
        await updateWorkspaceNativeSurface(
          surfaceRef.current.surfaceId,
          geometry,
        );
      }

      lastGeometryRef.current = nextGeometryKey;

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

    let canvasSurface: HTMLElement | null = null;

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

      canvasSurface?.removeEventListener("scroll", scheduleGeometry);

      window.removeEventListener("resize", scheduleGeometry);

      currentWindowUnlisten?.();

      const currentSurface = surfaceRef.current;

      if (currentSurface) {
        void setWorkspaceNativeSurfaceVisible(
          currentSurface.surfaceId,
          false,
        ).catch(() => {});
      }
    };
  }, [panelId, scheduleGeometry, synchronizeGeometry]);

  useEffect(() => {
    const currentSurface = surfaceRef.current;

    if (!currentSurface) {
      return;
    }

    void setWorkspaceNativeSurfaceVisible(currentSurface.surfaceId, true).catch(
      (cause) => {
        if (!disposedRef.current) {
          setError(String(cause));
        }
      },
    );
  }, [surface]);

  return {
    mountRef,
    surface,
    error,
    refreshGeometry: scheduleGeometry,
  };
}
