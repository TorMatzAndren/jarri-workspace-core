import { useEffect, useRef, useState } from "react";
import {
  beginGeometryInteraction,
  cancelGeometryInteraction,
  commitGeometryInteraction,
  previewGeometryInteraction,
  type GeometryInteraction,
} from "../core/layoutEngine";
import type { PanelRegistry } from "../core/panelRegistry";
import type { OpenResourceRequest, OpenResourceResult } from "../core/resources";
import type {
  PanelGeometry,
  PanelInstance,
  WorkspaceModuleDefinition,
  WorkspacePreferences,
} from "../core/types";

type Props = {
  registry: PanelRegistry;
  panel: PanelInstance;
  preferences: WorkspacePreferences;
  modules: Array<Pick<WorkspaceModuleDefinition, "moduleId" | "title">>;
  onFocus: (panelId: string) => void;
  onClose: (panelId: string) => void;
  onToggleMinimized: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
  onPreferencesChange: (preferences: Partial<WorkspacePreferences>) => void;
  onOpenResource: (request: OpenResourceRequest) => OpenResourceResult;
};

export function PanelFrame({
  registry,
  panel,
  preferences,
  modules,
  onFocus,
  onClose,
  onToggleMinimized,
  onGeometryChange,
  onPanelStateChange,
  onPreferencesChange,
  onOpenResource,
}: Props) {
  const [dragState, setDragState] = useState<GeometryInteraction | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<PanelGeometry | null>(
    null,
  );
  const previewGeometryRef = useRef<PanelGeometry | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const definition = registry.getPanel(panel.moduleId, panel.panelType);
  const Component = definition?.Component;
  const isMinimized = panel.display?.mode === "minimized";
  const baseGeometry = isMinimized
    ? {
        ...panel.geometry,
        height: 46,
      }
    : panel.geometry;
  const effectiveGeometry = previewGeometry ?? baseGeometry;

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      const nextPreview = previewGeometryInteraction(
        activeDrag,
        event.clientX,
        event.clientY,
      );
      previewGeometryRef.current = nextPreview;
      setPreviewGeometry(nextPreview);
    }

    function handlePointerUp() {
      const committed = commitGeometryInteraction(
        previewGeometryRef.current ?? activeDrag.startGeometry,
      );
      previewGeometryRef.current = null;
      setPreviewGeometry(null);
      setDragState(null);
      onGeometryChange(panel.id, committed);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      previewGeometryRef.current = null;
      setPreviewGeometry(cancelGeometryInteraction(activeDrag));
      window.setTimeout(() => setPreviewGeometry(null), 0);
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragState, onGeometryChange, panel.id]);

  function beginDrag(event: React.PointerEvent, mode: "move" | "resize") {
    if (isMinimized && mode === "resize") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onFocus(panel.id);
    previewGeometryRef.current = baseGeometry;
    setPreviewGeometry(baseGeometry);
    setDragState(
      beginGeometryInteraction(
        mode,
        {
          ...panel,
          geometry: baseGeometry,
        },
        event.clientX,
        event.clientY,
        preferences.scale,
      ),
    );
  }

  return (
    <article
      className={`panel-frame ${isMinimized ? "panel-frame--minimized" : ""}`}
      ref={panelRef}
      style={{
        left: effectiveGeometry.x,
        top: effectiveGeometry.y,
        width: effectiveGeometry.width,
        height: effectiveGeometry.height,
        zIndex: panel.focusOrder,
      }}
      onPointerDown={() => onFocus(panel.id)}
    >
      <header className="panel-frame__header" onPointerDown={(event) => beginDrag(event, "move")}>
        <div className="panel-frame__title">
          <span className={`panel-kind panel-kind--${definition?.category ?? "core"}`} />
          <div>
            <strong>{panel.title}</strong>
            <span>{panel.moduleId} / {panel.panelType}</span>
          </div>
        </div>
        <div className="panel-frame__controls">
          <button
            type="button"
            className="panel-frame__minimize"
            aria-label={isMinimized ? `Restore ${panel.title}` : `Minimize ${panel.title}`}
            title={isMinimized ? "Restore" : "Minimize"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggleMinimized(panel.id)}
          >
            {isMinimized ? "▣" : "–"}
          </button>
          <button
            type="button"
            className="panel-frame__close"
            aria-label={`Close ${panel.title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onClose(panel.id)}
          >
            ×
          </button>
        </div>
      </header>
      {!isMinimized ? (
        <>
          <div className="panel-frame__body">
            {Component ? (
              <Component
                panel={panel}
                preferences={preferences}
                modules={modules}
                updatePanelState={(panelState) => onPanelStateChange(panel.id, panelState)}
                updatePreferences={onPreferencesChange}
                openResource={(request) =>
                  onOpenResource({ ...request, sourcePanelId: request.sourcePanelId ?? panel.id })
                }
              />
            ) : null}
          </div>
          <span
            className="panel-frame__resize"
            aria-hidden="true"
            onPointerDown={(event) => beginDrag(event, "resize")}
          />
        </>
      ) : null}
    </article>
  );
}
