import { useEffect, useRef, useState } from "react";
import type {
  PanelGeometry,
  PanelInstance,
  SavedTabTemplate,
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
  savedTabTemplates: SavedTabTemplate[];
  preferences: WorkspacePreferences;
  modules: Array<Pick<WorkspaceModuleDefinition, "moduleId" | "title">>;
  onOpenPanelsMenu: () => void;
  onOpenSettings: () => void;
  onResetLayout: () => void;
  onSavePanelSetup: () => void;
  onLoadPanelSetup: (templateId: string) => void;
  onExportPanelSetups: () => void;
  onImportPanelSetups: () => void;
  onFocusPanel: (panelId: string) => void;
  onClosePanel: (panelId: string) => void;
  onTogglePanelMinimized: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
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
  savedTabTemplates,
  preferences,
  modules,
  onOpenPanelsMenu,
  onOpenSettings,
  onResetLayout,
  onSavePanelSetup,
  onLoadPanelSetup,
  onExportPanelSetups,
  onImportPanelSetups,
  onFocusPanel,
  onClosePanel,
  onTogglePanelMinimized,
  onGeometryChange,
  onPanelStateChange,
  onPreferencesChange,
  onOpenResource,
}: Props) {
  const [resizeState, setResizeState] = useState<CanvasResizeState | null>(null);
  const [panState, setPanState] = useState<CanvasPanState | null>(null);
  const [previewBounds, setPreviewBounds] = useState<WorkspaceCanvasBounds | null>(null);
  const previewBoundsRef = useRef<WorkspaceCanvasBounds | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const effectiveBounds = normalizeBounds(
    previewBounds ?? preferences.canvasBounds,
    panels,
  );

  useEffect(() => {
    const normalized = normalizeBounds(preferences.canvasBounds, panels);
    if (
      normalized.width !== preferences.canvasBounds.width ||
      normalized.height !== preferences.canvasBounds.height
    ) {
      onPreferencesChange({ canvasBounds: normalized });
    }
  }, [panels, preferences.canvasBounds, onPreferencesChange]);

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
      onPreferencesChange({ canvasBounds: committed });
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
  }, [resizeState, panels, preferences.scale, onPreferencesChange]);

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

  function beginCanvasResize(event: React.PointerEvent, mode: ResizeMode) {
    event.preventDefault();
    event.stopPropagation();

    const bounds = normalizeBounds(preferences.canvasBounds, panels);
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

        <div className="workspace-canvas__toolbar-actions">
          <button type="button" onClick={onOpenPanelsMenu}>
            Panels
          </button>
          <button type="button" onClick={onOpenSettings}>
            Settings
          </button>
          <button type="button" onClick={onSavePanelSetup}>
            Save Panel Setup
          </button>
          <select
            aria-label="Saved panel setups"
            disabled={savedTabTemplates.length === 0}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) {
                onLoadPanelSetup(event.target.value);
                event.target.value = "";
              }
            }}
          >
            <option value="">Load Panel Setup</option>
            {savedTabTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={onExportPanelSetups}>
            Export Setups
          </button>
          <button type="button" onClick={onImportPanelSetups}>
            Import Setups
          </button>
          <button type="button" className="reset-button" onClick={onResetLayout}>
            Reset Layout
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
              preferences={preferences}
              modules={modules}
              onFocus={onFocusPanel}
              onClose={onClosePanel}
              onToggleMinimized={onTogglePanelMinimized}
              onGeometryChange={onGeometryChange}
              onPanelStateChange={onPanelStateChange}
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
