import { useEffect, useRef, useState } from "react";
import {
  beginGeometryInteraction,
  previewGeometryInteraction,
  type GeometryInteraction,
} from "../core/layoutEngine";
import type { PanelRegistry } from "../core/panelRegistry";
import type {
  PanelGeometry,
  PanelInstance,
  WorkspacePreferences,
} from "../core/types";

type Props = {
  registry: PanelRegistry;
  panel: PanelInstance;
  preferences: WorkspacePreferences;
  onFocus: (panelId: string) => void;
  onClose: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
  onPreferencesChange: (preferences: Partial<WorkspacePreferences>) => void;
};

export function PanelFrame({
  registry,
  panel,
  preferences,
  onFocus,
  onClose,
  onGeometryChange,
  onPanelStateChange,
  onPreferencesChange,
}: Props) {
  const [dragState, setDragState] = useState<GeometryInteraction | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const definition = registry.getPanel(panel.moduleId, panel.panelType);
  const Component = definition?.Component;

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      onGeometryChange(
        panel.id,
        previewGeometryInteraction(activeDrag, event.clientX, event.clientY),
      );
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, onGeometryChange, panel.id]);

  function beginDrag(event: React.PointerEvent, mode: "move" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    onFocus(panel.id);
    setDragState(beginGeometryInteraction(mode, panel, event.clientX, event.clientY));
  }

  return (
    <article
      className="panel-frame"
      ref={panelRef}
      style={{
        left: panel.geometry.x,
        top: panel.geometry.y,
        width: panel.geometry.width,
        height: panel.geometry.height,
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
        <button
          type="button"
          className="panel-frame__close"
          aria-label={`Close ${panel.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onClose(panel.id)}
        >
          ×
        </button>
      </header>
      <div className="panel-frame__body">
        {Component ? (
          <Component
            panel={panel}
            preferences={preferences}
            updatePanelState={(panelState) => onPanelStateChange(panel.id, panelState)}
            updatePreferences={onPreferencesChange}
          />
        ) : null}
      </div>
      <span
        className="panel-frame__resize"
        aria-hidden="true"
        onPointerDown={(event) => beginDrag(event, "resize")}
      />
    </article>
  );
}
