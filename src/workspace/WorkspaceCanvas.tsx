import { useEffect, useRef, useState } from "react";
import type {
  PanelGeometry,
  PanelInstance,
  PanelViewPreferences,
   WorkspaceCanvasBounds,
  WorkspaceModuleDefinition,
  WorkspacePreferences,
} from "../core/types";
import type { PanelRegistry } from "../core/panelRegistry";
import type { OpenResourceRequest, OpenResourceResult } from "../core/resources";
import { PanelFrame } from "./PanelFrame";

const CANVAS_GRID_SIZE = 24;
const MIN_CANVAS_WIDTH = 900;
const MIN_CANVAS_HEIGHT = 700;

type ResizeMode = "width" | "height" | "both";

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
  title: string;
  panels: PanelInstance[];
  canvasBounds: WorkspaceCanvasBounds;
  preferences: WorkspacePreferences;
  modules: Array<Pick<WorkspaceModuleDefinition, "moduleId" | "title">>;
  onOpenPanelsMenu: () => void;
  onFocusPanel: (panelId: string) => void;
  onClosePanel: (panelId: string) => void;
  onTogglePanelMinimized: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
  onPanelViewPreferencesChange: (
    moduleId: string,
    panelType: string,
    preferences: PanelViewPreferences,
  ) => void;
  onCanvasBoundsChange: (bounds: WorkspaceCanvasBounds) => void;
  onPreferencesChange: (preferences: Partial<WorkspacePreferences>) => void;
  onOpenResource: (request: OpenResourceRequest) => OpenResourceResult;
};

function snapToCanvasGrid(value: number) {
  return Math.ceil(value / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE;
}

function requiredBoundsForPanels(panels: PanelInstance): WorkspaceCanvasBounds;
function requiredBoundsForPanels(panels: PanelInstance[]): WorkspaceCanvasBounds;
function requiredBoundsForPanels(panels: PanelInstance | PanelInstance[]): WorkspaceCanvasBounds {
  const list = Array.isArray(panels) ? panels : [panels];
  return list.reduce(
    (bounds, panel) => ({
      width: Math.max(bounds.width, panel.geometry.x + panel.geometry.width + CANVAS_GRID_SIZE * 2),
      height: Math.max(bounds.height, panel.geometry.y + panel.geometry.height + CANVAS_GRID_SIZE * 2),
    }),
    { width: MIN_CANVAS_WIDTH, height: MIN_CANVAS_HEIGHT },
  );
}

function normalizeBounds(
  bounds: WorkspaceCanvasBounds,
  panels: PanelInstance[],
): WorkspaceCanvasBounds {
  const required = requiredBoundsForPanels(panels);

  return {
    width: snapToCanvasGrid(Math.max(MIN_CANVAS_WIDTH, required.width, bounds.width)),
    height: snapToCanvasGrid(Math.max(MIN_CANVAS_HEIGHT, required.height, bounds.height)),
  };
}

export function WorkspaceCanvas({
  registry,
  title,
  panels,
  canvasBounds,
  preferences,
  modules,
  onOpenPanelsMenu,
  onFocusPanel,
  onClosePanel,
  onTogglePanelMinimized,
  onGeometryChange,
  onPanelStateChange,
  onPanelViewPreferencesChange,
  onCanvasBoundsChange,
  onPreferencesChange,
  onOpenResource,
}: Props) {
  const [resizeState, setResizeState] = useState<CanvasResizeState | null>(null);
  const [panState, setPanState] = useState<CanvasPanState | null>(null);
  const [previewBounds, setPreviewBounds] = useState<WorkspaceCanvasBounds | null>(null);
  const previewBoundsRef = useRef<WorkspaceCanvasBounds | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const effectiveBounds = normalizeBounds(
    previewBounds ?? canvasBounds,
    panels,
  );

  useEffect(() => {
    const normalized = normalizeBounds(canvasBounds, panels);
    if (
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
      const deltaX = (event.clientX - activeResize.startX) / preferences.scale;
      const deltaY = (event.clientY - activeResize.startY) / preferences.scale;

      const nextBounds = normalizeBounds(
        {
          width:
            activeResize.mode === "width" || activeResize.mode === "both"
              ? activeResize.startBounds.width + deltaX
              : activeResize.startBounds.width,
          height:
            activeResize.mode === "height" || activeResize.mode === "both"
              ? activeResize.startBounds.height + deltaY
              : activeResize.startBounds.height,
        },
        panels,
      );

      previewBoundsRef.current = nextBounds;
      setPreviewBounds(nextBounds);
    }

    function commitResize() {
      const committed = normalizeBounds(
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
  }, [resizeState, panels, preferences.scale, onCanvasBoundsChange]);

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

  function revealPanelInViewport(panel: PanelInstance) {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const scale = preferences.scale;
    const margin = 24;

    const panelLeft = panel.geometry.x * scale;
    const panelTop = panel.geometry.y * scale;
    const panelWidth = panel.geometry.width * scale;
    const panelHeight = panel.geometry.height * scale;
    const panelRight = panelLeft + panelWidth;
    const panelBottom = panelTop + panelHeight;

    const viewportLeft = surface.scrollLeft;
    const viewportTop = surface.scrollTop;
    const viewportRight = viewportLeft + surface.clientWidth;
    const viewportBottom = viewportTop + surface.clientHeight;

    const usableWidth = Math.max(0, surface.clientWidth - margin * 2);
    const usableHeight = Math.max(0, surface.clientHeight - margin * 2);

    let nextLeft = viewportLeft;
    let nextTop = viewportTop;

    if (panelWidth > usableWidth) {
      if (
        panelLeft < viewportLeft + margin ||
        panelLeft > viewportRight - margin
      ) {
        nextLeft = panelLeft - margin;
      }
    } else if (panelLeft < viewportLeft + margin) {
      nextLeft = panelLeft - margin;
    } else if (panelRight > viewportRight - margin) {
      nextLeft = panelRight - surface.clientWidth + margin;
    }

    if (panelHeight > usableHeight) {
      if (
        panelTop < viewportTop + margin ||
        panelTop > viewportBottom - margin
      ) {
        nextTop = panelTop - margin;
      }
    } else if (panelTop < viewportTop + margin) {
      nextTop = panelTop - margin;
    } else if (panelBottom > viewportBottom - margin) {
      nextTop = panelBottom - surface.clientHeight + margin;
    }

    nextLeft = Math.max(0, nextLeft);
    nextTop = Math.max(0, nextTop);

    if (
      nextLeft === viewportLeft &&
      nextTop === viewportTop
    ) {
      return;
    }

    surface.scrollTo({
      left: nextLeft,
      top: nextTop,
      behavior: "auto",
    });
  }

  function beginCanvasResize(event: React.PointerEvent, mode: ResizeMode) {
    event.preventDefault();
    event.stopPropagation();

    const bounds = normalizeBounds(canvasBounds, panels);
    previewBoundsRef.current = bounds;
    setPreviewBounds(bounds);
    setResizeState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBounds: bounds,
    });
  }

  return (
    <section className="workspace-canvas" aria-label="Workspace canvas">
      <div className="workspace-canvas__toolbar">
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

                  onFocusPanel(panel.id);
                  revealPanelInViewport(panel);
                }}
              >
                {panel.title}
              </button>
            );
          })}
        </div>

        <div className="workspace-canvas__toolbar-actions">
          <button type="button" onClick={onOpenPanelsMenu}>
            + New Panel
          </button>
        </div>
      </div>

      <div
        className={`workspace-canvas__surface ${panState ? "workspace-canvas__surface--panning" : ""}`}
        ref={surfaceRef}
        onPointerDown={beginCanvasPan}
      >
        <div
          className="workspace-canvas__logical"
          style={{
            "--workspace-canvas-width": `${effectiveBounds.width}px`,
            "--workspace-canvas-height": `${effectiveBounds.height}px`,
          } as React.CSSProperties}
        >
          {panels.map((panel) => (
            <PanelFrame
              key={panel.id}
              registry={registry}
              panel={panel}
              canvasSurfaceRef={surfaceRef}
              preferences={preferences}
              modules={modules}
              onFocus={onFocusPanel}
              onClose={onClosePanel}
              onToggleMinimized={onTogglePanelMinimized}
              onGeometryChange={onGeometryChange}
              onPanelStateChange={onPanelStateChange}
              onPanelViewPreferencesChange={onPanelViewPreferencesChange}
              onPreferencesChange={onPreferencesChange}
              onOpenResource={onOpenResource}
            />
          ))}

          {panels.length === 0 ? (
            <div className="workspace-empty">
              <strong>No panels in this tab</strong>
              <span>Add a registered panel from the toolbar.</span>
            </div>
          ) : null}

          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--right"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "width")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--bottom"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "height")}
          />
          <span
            className="workspace-canvas__resize-handle workspace-canvas__resize-handle--corner"
            aria-hidden="true"
            onPointerDown={(event) => beginCanvasResize(event, "both")}
          />
        </div>
      </div>
    </section>
  );
}
