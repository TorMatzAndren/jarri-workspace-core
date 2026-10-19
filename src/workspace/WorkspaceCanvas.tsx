import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  PanelGeometry,
  PanelInstance,
  PanelViewPreferences,
  WorkspaceCanvasCamera,
  WorkspaceCanvasBounds,
  WorkspaceModuleDefinition,
  WorkspacePreferences,
} from "../core/types";
import type { PanelRegistry } from "../core/panelRegistry";
import type { OpenResourceRequest, OpenResourceResult } from "../core/resources";
import {
  cameraOriginFromScroll,
  clampScroll,
  nextCanvasScaleFromWheel,
  panelNavigationAnchor,
  scrollForCameraOrigin,
  scrollForAnchor,
  viewportSizesMatch,
  zoomAnchorForMode,
  type WorkspaceViewportAnchor,
} from "../core/cameraMath";
import { localWheelReservation } from "../core/panelInteractions";
import { PanelFrame } from "./PanelFrame";
import { canvasWallpaperPresentation } from "./canvasWallpaperPresentation";
import { copyWorkspaceScreenshot } from "./screenshot";
import { normalizeWorkspaceCanvasOrigin, type WorkspaceCanvasScreenshotSource } from "./workspaceScreenshotComposition";
import {
  MIN_WORKSPACE_CANVAS_HEIGHT,
  MIN_WORKSPACE_CANVAS_WIDTH,
  normalizeWorkspaceCanvasBounds,
} from "../core/workspaceCanvasBounds";

const MIN_CANVAS_WIDTH = MIN_WORKSPACE_CANVAS_WIDTH;
const MIN_CANVAS_HEIGHT = MIN_WORKSPACE_CANVAS_HEIGHT;

type ResizeMode = "left" | "top" | "right" | "bottom" | "both";

type CanvasResizeState = {
  mode: ResizeMode;
  startX: number;
  startY: number;
  startBounds: WorkspaceCanvasBounds;
};

type CanvasPanState = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

type Props = {
  registry: PanelRegistry;
  tabId: string;
  title: string;
  panels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  canvasScale: number;
  canvasCamera: WorkspaceCanvasCamera;
  preferences: WorkspacePreferences;
  modules: Array<Pick<WorkspaceModuleDefinition, "moduleId" | "title">>;
  fileOperationClipboard: unknown;
  setFileOperationClipboard: (clipboard: unknown) => void;
  onOpenPanelsMenu: () => void;
  screenshotToolbarRef?: (element: HTMLDivElement | null) => void;
  onScreenshotSourceChange?: (source: WorkspaceCanvasScreenshotSource | null) => void;
  navigationRequest?: {
    panelId: string;
    requestId: number;
  } | null;
  onFocusPanel: (panelId: string) => void;
  organizeRequestId: number;
  onToggleOrganize: (
    viewport: { width: number; height: number },
  ) => void;
  onClosePanel: (panelId: string) => void;
  onTogglePanelMinimized: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
  onPanelViewPreferencesChange: (
    panelId: string,
    preferences: PanelViewPreferences,
  ) => void;
  onCanvasBoundsChange: (bounds: WorkspaceCanvasBounds) => void;
  onCanvasScaleChange: (canvasScale: number) => void;
  onCanvasCameraChange: (camera: WorkspaceCanvasCamera) => void;
  onPreferencesChange: (preferences: Partial<WorkspacePreferences>) => void;
  onOpenPanel: (
    moduleId: string,
    panelType: string,
    sourcePanelId?: string,
    panelState?: unknown,
  ) => string | null;
  onOpenResource: (request: OpenResourceRequest) => OpenResourceResult;
};

export function WorkspaceCanvas({
  registry,
  tabId,
  title,
  panels,
  canvasBounds,
  canvasScale,
  canvasCamera,
  preferences,
  modules,
  fileOperationClipboard,
  setFileOperationClipboard,
  onOpenPanelsMenu,
  screenshotToolbarRef,
  onScreenshotSourceChange,
  navigationRequest,
  onFocusPanel,
  organizeRequestId,
  onToggleOrganize,
  onClosePanel,
  onTogglePanelMinimized,
  onGeometryChange,
  onPanelStateChange,
  onPanelViewPreferencesChange,
  onCanvasBoundsChange,
  onCanvasScaleChange,
  onCanvasCameraChange,
  onPreferencesChange,
  onOpenPanel,
  onOpenResource,
}: Props) {
  const [resizeState, setResizeState] = useState<CanvasResizeState | null>(null);
  const [panState, setPanState] = useState<CanvasPanState | null>(null);
  const [previewBounds, setPreviewBounds] = useState<WorkspaceCanvasBounds | null>(null);
  const [cameraViewportSize, setCameraViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [screenshotState, setScreenshotState] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  const previewBoundsRef = useRef<WorkspaceCanvasBounds | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const logicalRef = useRef<HTMLDivElement | null>(null);
  const pendingCanvasZoomAnchorRef =
    useRef<WorkspaceViewportAnchor | null>(null);
  const restoringCameraRef = useRef(false);
  const cameraViewportReadyRef = useRef(false);
  const measuredCameraViewportRef = useRef({
    width: 0,
    height: 0,
  });

  const effectiveBounds = normalizeWorkspaceCanvasBounds(
    previewBounds ?? canvasBounds,
    panels,
  );
  const normalizedContentsOrigin = normalizeWorkspaceCanvasOrigin(effectiveBounds);
  const wallpaperPresentation = canvasWallpaperPresentation(preferences.canvasAppearance);

  useLayoutEffect(() => {
    const element = logicalRef.current;
    if (element) onScreenshotSourceChange?.({ element, bounds: effectiveBounds });
    return () => onScreenshotSourceChange?.(null);
  }, [effectiveBounds.height, effectiveBounds.width, effectiveBounds.x, effectiveBounds.y, onScreenshotSourceChange]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (
      !surface ||
      pendingCanvasZoomAnchorRef.current ||
      cameraViewportSize.width <= 0 ||
      cameraViewportSize.height <= 0
    ) {
      return;
    }

    const targetScroll = scrollForCameraOrigin(
      canvasCamera,
      effectiveBounds,
      cameraViewportSize,
      canvasScale,
    );
    const nextScroll = clampScroll(targetScroll, {
      scrollLeft: surface.scrollWidth - surface.clientWidth,
      scrollTop: surface.scrollHeight - surface.clientHeight,
    });

    const scrollAlreadyRestored =
      Math.abs(surface.scrollLeft - nextScroll.scrollLeft) < 0.5 &&
      Math.abs(surface.scrollTop - nextScroll.scrollTop) < 0.5;

    restoringCameraRef.current = true;
    cameraViewportReadyRef.current = false;

    if (!scrollAlreadyRestored) {
      surface.scrollLeft = nextScroll.scrollLeft;
      surface.scrollTop = nextScroll.scrollTop;
    }

    const frameId = window.requestAnimationFrame(() => {
      restoringCameraRef.current = false;
      cameraViewportReadyRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      restoringCameraRef.current = false;
      cameraViewportReadyRef.current = false;
    };
  }, [
    tabId,
    canvasCamera.x,
    canvasCamera.y,
    canvasScale,
    effectiveBounds.x,
    effectiveBounds.y,
    effectiveBounds.width,
    effectiveBounds.height,
    cameraViewportSize.width,
    cameraViewportSize.height,
  ]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return undefined;
    }

    const measuredSurface = surface;

    function measureCameraViewport() {
      const next = {
        width: Math.max(1, measuredSurface.clientWidth),
        height: Math.max(1, measuredSurface.clientHeight),
      };

      const measured = measuredCameraViewportRef.current;

      if (measured.width === next.width && measured.height === next.height) {
        return;
      }

      measuredCameraViewportRef.current = next;
      cameraViewportReadyRef.current = false;
      setCameraViewportSize(next);
    }

    measureCameraViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureCameraViewport);
      return () =>
        window.removeEventListener("resize", measureCameraViewport);
    }

    const observer = new ResizeObserver(measureCameraViewport);
    observer.observe(measuredSurface);

    return () => observer.disconnect();
  }, []);

  function toggleOrganizeVisiblePanels() {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    onToggleOrganize({
      width: surface.clientWidth,
      height: surface.clientHeight,
    });
  }

  useEffect(() => {
    if (organizeRequestId > 0) {
      toggleOrganizeVisiblePanels();
    }
    // Requests originate in the title bar, but viewport measurement
    // remains owned by the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizeRequestId]);

  function rememberViewport() {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const currentViewport = {
      width: surface.clientWidth,
      height: surface.clientHeight,
    };
    const viewportMeasurementCurrent = viewportSizesMatch(
      measuredCameraViewportRef.current,
      currentViewport,
    );

    if (
      restoringCameraRef.current ||
      !cameraViewportReadyRef.current ||
      !viewportMeasurementCurrent
    ) {
      cameraViewportReadyRef.current = false;
      return;
    }

    const nextCamera = cameraOriginFromScroll(
      effectiveBounds,
      currentViewport,
      { scrollLeft: surface.scrollLeft, scrollTop: surface.scrollTop },
      canvasScale,
    );

    onCanvasCameraChange(
      nextCamera,
    );
  }

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return undefined;
    }

    const canvasSurface = surface;

    function handleWorkspaceWheel(event: WheelEvent) {
      if (event.ctrlKey) {
        event.preventDefault();

        const currentScale = canvasScale;
        const nextScale = nextCanvasScaleFromWheel(
          currentScale,
          event.deltaY,
          preferences.workspaceZoomIncrement,
        );

        if (nextScale === currentScale) {
          return;
        }

        const surfaceRect = canvasSurface.getBoundingClientRect();
        const pointerX = Math.min(
          canvasSurface.clientWidth,
          Math.max(0, event.clientX - surfaceRect.left),
        );
        const pointerY = Math.min(
          canvasSurface.clientHeight,
          Math.max(0, event.clientY - surfaceRect.top),
        );

        pendingCanvasZoomAnchorRef.current = zoomAnchorForMode({
          mode: preferences.workspaceZoomAnchorMode,
          panels,
          pointer: { x: pointerX, y: pointerY },
          bounds: effectiveBounds,
          viewport: {
            width: canvasSurface.clientWidth,
            height: canvasSurface.clientHeight,
          },
          scroll: {
            scrollLeft: canvasSurface.scrollLeft,
            scrollTop: canvasSurface.scrollTop,
          },
          canvasScale: currentScale,
        });

        onCanvasScaleChange(nextScale);
        return;
      }

      const localWheel = localWheelReservation(event);

      if (localWheel === "native") {
        /*
         * Browser-native overflow scrolling owns this wheel event.
         * Do not preventDefault(): the local surface must be allowed
         * to perform its normal scroll.
         *
         * Ctrl+wheel never reaches this branch because local wheel
         * reservation deliberately yields that gesture to Workspace.
         */
        return;
      }

      if (localWheel === "custom") {
        /*
         * A panel-local wheel handler owns this event. Suppress native
         * scrolling while allowing propagation to the local handler.
         */
        event.preventDefault();
        return;
      }
    }

    function handleWorkspaceScroll() {
      rememberViewport();
    }

    canvasSurface.addEventListener("wheel", handleWorkspaceWheel, {
      passive: false,
    });
    canvasSurface.addEventListener("scroll", handleWorkspaceScroll, {
      passive: true,
    });

    return () => {
      canvasSurface.removeEventListener("wheel", handleWorkspaceWheel);
      canvasSurface.removeEventListener("scroll", handleWorkspaceScroll);
    };
  }, [
    canvasScale,
    effectiveBounds.x,
    effectiveBounds.y,
    panels,
    preferences.workspaceZoomIncrement,
    preferences.workspaceZoomAnchorMode,
    onCanvasScaleChange,
  ]);

  useLayoutEffect(() => {
    const anchor = pendingCanvasZoomAnchorRef.current;
    const surface = surfaceRef.current;

    if (!anchor || !surface) {
      return;
    }

    const targetScroll = scrollForAnchor(
      anchor,
      effectiveBounds,
      { width: surface.clientWidth, height: surface.clientHeight },
      canvasScale,
    );
    const nextScroll = clampScroll(targetScroll, {
      scrollLeft: surface.scrollWidth - surface.clientWidth,
      scrollTop: surface.scrollHeight - surface.clientHeight,
    });

    surface.scrollLeft = nextScroll.scrollLeft;
    surface.scrollTop = nextScroll.scrollTop;
    pendingCanvasZoomAnchorRef.current = null;
    rememberViewport();
  }, [
    canvasScale,
    effectiveBounds.x,
    effectiveBounds.y,
    effectiveBounds.width,
    effectiveBounds.height,
  ]);

  useEffect(() => {
    const normalized = normalizeWorkspaceCanvasBounds(canvasBounds, panels);
    if (
      normalized.x !== canvasBounds.x ||
      normalized.y !== canvasBounds.y ||
      normalized.width !== canvasBounds.width ||
      normalized.height !== canvasBounds.height
    ) {
      onCanvasBoundsChange(normalized);
    }
  }, [panels, canvasBounds, onCanvasBoundsChange]);

  useEffect(() => {
    if (!resizeState) {
      return undefined;
    }

    const activeResize = resizeState;

    function previewFromPointer(event: PointerEvent) {
      const deltaX = (event.clientX - activeResize.startX) / canvasScale;
      const deltaY = (event.clientY - activeResize.startY) / canvasScale;

      const start = activeResize.startBounds;
      const startRight = start.x + start.width;
      const startBottom = start.y + start.height;

      let nextX = start.x;
      let nextY = start.y;
      let nextRight = startRight;
      let nextBottom = startBottom;

      if (activeResize.mode === "left") {
        nextX = Math.min(startRight - MIN_CANVAS_WIDTH, start.x + deltaX);
      }

      if (activeResize.mode === "top") {
        nextY = Math.min(startBottom - MIN_CANVAS_HEIGHT, start.y + deltaY);
      }

      if (activeResize.mode === "right" || activeResize.mode === "both") {
        nextRight = Math.max(start.x + MIN_CANVAS_WIDTH, startRight + deltaX);
      }

      if (activeResize.mode === "bottom" || activeResize.mode === "both") {
        nextBottom = Math.max(start.y + MIN_CANVAS_HEIGHT, startBottom + deltaY);
      }

      const nextBounds = normalizeWorkspaceCanvasBounds(
        {
          x: nextX,
          y: nextY,
          width: nextRight - nextX,
          height: nextBottom - nextY,
        },
        panels,
      );

      previewBoundsRef.current = nextBounds;
      setPreviewBounds(nextBounds);
    }

    function commitResize() {
      const committed = normalizeWorkspaceCanvasBounds(
        previewBoundsRef.current ?? activeResize.startBounds,
        panels,
      );
      previewBoundsRef.current = null;
      setPreviewBounds(null);
      setResizeState(null);
      onCanvasBoundsChange(committed);
    }

    function cancelResize(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      previewBoundsRef.current = null;
      setPreviewBounds(null);
      setResizeState(null);
    }

    window.addEventListener("pointermove", previewFromPointer);
    window.addEventListener("pointerup", commitResize);
    window.addEventListener("keydown", cancelResize);

    return () => {
      window.removeEventListener("pointermove", previewFromPointer);
      window.removeEventListener("pointerup", commitResize);
      window.removeEventListener("keydown", cancelResize);
    };
  }, [resizeState, panels, canvasScale, onCanvasBoundsChange]);

  useEffect(() => {
    if (!panState) {
      return undefined;
    }

    const activePan = panState;

    function panFromPointer(event: PointerEvent) {
      if (event.pointerId !== activePan.pointerId) {
        return;
      }

      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      surface.scrollLeft = activePan.startScrollLeft - (event.clientX - activePan.startX);
      surface.scrollTop = activePan.startScrollTop - (event.clientY - activePan.startY);
    }

    function commitPan(event: PointerEvent) {
      if (event.pointerId !== activePan.pointerId) {
        return;
      }

      setPanState(null);
    }

    function cancelPan(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      const surface = surfaceRef.current;
      if (surface) {
        surface.scrollLeft = activePan.startScrollLeft;
        surface.scrollTop = activePan.startScrollTop;
      }

      setPanState(null);
    }

    window.addEventListener("pointermove", panFromPointer);
    window.addEventListener("pointerup", commitPan);
    window.addEventListener("keydown", cancelPan);

    return () => {
      window.removeEventListener("pointermove", panFromPointer);
      window.removeEventListener("pointerup", commitPan);
      window.removeEventListener("keydown", cancelPan);
    };
  }, [panState]);

  function beginCanvasPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 1) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        ".panel-frame, .workspace-canvas__resize-handle, button, input, select, textarea, a",
      )
    ) {
      return;
    }

    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    setPanState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: surface.scrollLeft,
      startScrollTop: surface.scrollTop,
    });
  }

  function positionPanelInViewport(panel: PanelInstance) {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const targetScroll = scrollForAnchor(
      panelNavigationAnchor(
        panel,
        preferences.panelNavigationAlignment,
        { width: surface.clientWidth, height: surface.clientHeight },
      ),
      effectiveBounds,
      { width: surface.clientWidth, height: surface.clientHeight },
      canvasScale,
    );
    const nextScroll = clampScroll(targetScroll, {
      scrollLeft: surface.scrollWidth - surface.clientWidth,
      scrollTop: surface.scrollHeight - surface.clientHeight,
    });

    surface.scrollTo({
      left: nextScroll.scrollLeft,
      top: nextScroll.scrollTop,
      behavior: "auto",
    });
    rememberViewport();
  }


  const handledSearchNavigationRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!navigationRequest) return;
    if (handledSearchNavigationRef.current === navigationRequest.requestId) {
      return;
    }

    const target = panels.find(
      (panel) => panel.id === navigationRequest.panelId,
    );

    if (!target || target.display?.mode === "minimized") return;

    if (!surfaceRef.current) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (
          handledSearchNavigationRef.current ===
          navigationRequest.requestId
        ) {
          return;
        }

        handledSearchNavigationRef.current = navigationRequest.requestId;
        positionPanelInViewport(target);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    navigationRequest?.panelId,
    navigationRequest?.requestId,
    tabId,
    panels,
    cameraViewportSize.width,
    cameraViewportSize.height,
  ]);

  function focusPanel(panel: PanelInstance, navigation: "none" | "panel-bar") {
    onFocusPanel(panel.id);

    if (navigation === "panel-bar") {
      positionPanelInViewport(panel);
    }
  }

  function beginCanvasResize(event: React.PointerEvent, mode: ResizeMode) {
    event.preventDefault();
    event.stopPropagation();

    const bounds = normalizeWorkspaceCanvasBounds(canvasBounds, panels);
    previewBoundsRef.current = bounds;
    setPreviewBounds(bounds);
    setResizeState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBounds: bounds,
    });
  }

  async function captureWorkspaceScreenshot() {
    const logical = logicalRef.current;
    if (!logical || screenshotState === "copying") {
      return;
    }

    setScreenshotState("copying");

    try {
      await copyWorkspaceScreenshot({
        kind: "workspace",
        element: logical,
        width: effectiveBounds.width,
        height: effectiveBounds.height,
      });

      setScreenshotState("copied");
      window.setTimeout(() => {
        setScreenshotState((current) =>
          current === "copied" ? "idle" : current
        );
      }, 1600);
    } catch (error) {
      console.error("Workspace screenshot failed", error);
      setScreenshotState("failed");

      window.setTimeout(() => {
        setScreenshotState((current) =>
          current === "failed" ? "idle" : current
        );
      }, 2400);
    }
  }

  return (
    <section className="workspace-canvas" aria-label="Workspace canvas">
      <div className="workspace-canvas__toolbar" ref={screenshotToolbarRef}>
        <div className="workspace-canvas__toolbar-info">
          <strong>{title}</strong>
          <span>
            {panels.length} panels · {effectiveBounds.width}×{effectiveBounds.height}
          </span>
        </div>

        <div
          className="workspace-canvas__panel-taskbar"
          aria-label="Active tab panels"
        >
          {panels.map((panel) => {
            const minimized = panel.display?.mode === "minimized";
            const focused =
              !minimized &&
              panel.focusOrder ===
                Math.max(...panels.map((candidate) => candidate.focusOrder));

            return (
              <button
                key={panel.id}
                type="button"
                className={[
                  "workspace-canvas__panel-task",
                  focused ? "workspace-canvas__panel-task--focused" : "",
                  minimized ? "workspace-canvas__panel-task--minimized" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={`${minimized ? "Restore" : "Focus"} ${panel.title}`}
                aria-pressed={focused}
                onClick={() => {
                  if (minimized) {
                    onTogglePanelMinimized(panel.id);
                  }

                  focusPanel(panel, "panel-bar");
                }}
              >
                {panel.title}
              </button>
            );
          })}
        </div>

        <div className="workspace-canvas__toolbar-actions">

          <button
            type="button"
            onClick={captureWorkspaceScreenshot}
            disabled={screenshotState === "copying"}
            title="Copy the complete logical Workspace tab as an image"
          >
            {screenshotState === "copying"
              ? "Copying…"
              : screenshotState === "copied"
                ? "Copied"
                : screenshotState === "failed"
                  ? "Copy failed"
                  : "Screenshot"}
          </button>
          <button type="button" onClick={onOpenPanelsMenu}>
            + New Panel
          </button>
        </div>
      </div>

      <div
        className={`workspace-canvas__surface ${panState ? "workspace-canvas__surface--panning" : ""}`}
        data-wallpaper-kind={wallpaperPresentation.sourceKind}
        data-wallpaper-rendered={wallpaperPresentation.rendered}
        ref={surfaceRef}
        style={{
          "--workspace-canvas-scale": canvasScale,
          ...(wallpaperPresentation.rendered ? {
            backgroundImage: wallpaperPresentation.backgroundImage ?? undefined,
            backgroundPosition: wallpaperPresentation.backgroundPosition,
            backgroundAttachment: "scroll",
          } : {}),
        } as React.CSSProperties}
        onPointerDownCapture={beginCanvasPan}
      >
        <div
          className="workspace-canvas__world"
          style={{
            "--workspace-camera-pad-x": `${cameraViewportSize.width}px`,
            "--workspace-camera-pad-y": `${cameraViewportSize.height}px`,
            "--workspace-scaled-canvas-width":
              `${effectiveBounds.width * canvasScale}px`,
            "--workspace-scaled-canvas-height":
              `${effectiveBounds.height * canvasScale}px`,
          } as React.CSSProperties}
        >
        <div
          className="workspace-canvas__logical"
          data-wallpaper-rendered={wallpaperPresentation.rendered}
          ref={logicalRef}
          style={{
            "--workspace-canvas-width": `${effectiveBounds.width}px`,
            "--workspace-canvas-height": `${effectiveBounds.height}px`,
            "--workspace-grid-size": `${preferences.gridSize}px`,
          } as React.CSSProperties}
        >
          <div
            className="workspace-canvas__contents"
            style={{
              left: `${normalizedContentsOrigin.x}px`,
              top: `${normalizedContentsOrigin.y}px`,
            } as React.CSSProperties}
          >
          {panels.map((panel) => (
            <PanelFrame
              key={panel.id}
              registry={registry}
              panel={panel}
              canvasSurfaceRef={surfaceRef}
              canvasScale={canvasScale}
              preferences={preferences}
              modules={modules}
              fileOperationClipboard={fileOperationClipboard}
              setFileOperationClipboard={setFileOperationClipboard}
              onFocus={(_panelId, navigation = "none") =>
                focusPanel(panel, navigation)
              }
              onClose={onClosePanel}
              onToggleMinimized={onTogglePanelMinimized}
              onGeometryChange={onGeometryChange}
              onPanelStateChange={onPanelStateChange}
              onPanelViewPreferencesChange={onPanelViewPreferencesChange}
              onPreferencesChange={onPreferencesChange}
              onOpenPanel={onOpenPanel}
              onOpenResource={onOpenResource}
            />
          ))}
          </div>

          {panels.length === 0 ? (
            <div className="workspace-empty">
              <strong>No panels in this tab</strong>
              <span>Add a registered panel from the toolbar.</span>
            </div>
          ) : null}

          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--right"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "right")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--left"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "left")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--top"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "top")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--bottom"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "bottom")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--corner"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "both")}
          />
        </div>
        </div>
      </div>
    </section>
  );
}
