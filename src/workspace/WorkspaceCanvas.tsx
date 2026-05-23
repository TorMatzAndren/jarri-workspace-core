import type { PanelGeometry, PanelInstance } from "../core/types";
import { PanelFrame } from "./PanelFrame";

type Props = {
  title: string;
  panels: PanelInstance[];
  onFocusPanel: (panelId: string) => void;
  onClosePanel: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
};

export function WorkspaceCanvas({
  title,
  panels,
  onFocusPanel,
  onClosePanel,
  onGeometryChange,
  onPanelStateChange,
}: Props) {
  return (
    <section className="workspace-canvas" aria-label="Workspace canvas">
      <div className="workspace-canvas__toolbar">
        <strong>{title}</strong>
        <span>{panels.length} panels</span>
      </div>
      <div className="workspace-canvas__surface">
        {panels.map((panel) => (
          <PanelFrame
            key={panel.id}
            panel={panel}
            onFocus={onFocusPanel}
            onClose={onClosePanel}
            onGeometryChange={onGeometryChange}
            onPanelStateChange={onPanelStateChange}
          />
        ))}
        {panels.length === 0 ? (
          <div className="workspace-empty">
            <strong>No panels in this tab</strong>
            <span>Add a registered demo panel from the shell.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

