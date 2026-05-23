import { useEffect, useRef, useState } from "react";
import { registry } from "../panels/registry";
import type { PanelGeometry, PanelInstance } from "../core/types";

type DragState =
  | null
  | {
      mode: "move" | "resize";
      startX: number;
      startY: number;
      startGeometry: PanelGeometry;
    };

type Props = {
  panel: PanelInstance;
  onFocus: (panelId: string) => void;
  onClose: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
};

const GRID = 12;

function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

export function PanelFrame({
  panel,
  onFocus,
  onClose,
  onGeometryChange,
  onPanelStateChange,
}: Props) {
  const [dragState, setDragState] = useState<DragState>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const definition = registry.getPanel(panel.moduleId, panel.panelType);
  const Component = definition?.Component;

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - activeDrag.startX;
      const deltaY = event.clientY - activeDrag.startY;
      const minWidth =
        panel.geometry.minWidth ?? definition?.minGeometry.width ?? 260;
      const minHeight =
        panel.geometry.minHeight ?? definition?.minGeometry.height ?? 160;

      if (activeDrag.mode === "move") {
        onGeometryChange(panel.id, {
          ...panel.geometry,
          x: Math.max(0, snap(activeDrag.startGeometry.x + deltaX)),
          y: Math.max(0, snap(activeDrag.startGeometry.y + deltaY)),
        });
        return;
      }

      onGeometryChange(panel.id, {
        ...panel.geometry,
        width: Math.max(minWidth, snap(activeDrag.startGeometry.width + deltaX)),
        height: Math.max(minHeight, snap(activeDrag.startGeometry.height + deltaY)),
      });
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
  }, [definition, dragState, onGeometryChange, panel]);

  function beginDrag(event: React.PointerEvent, mode: "move" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    onFocus(panel.id);
    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: panel.geometry,
    });
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
            updatePanelState={(panelState) => onPanelStateChange(panel.id, panelState)}
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
