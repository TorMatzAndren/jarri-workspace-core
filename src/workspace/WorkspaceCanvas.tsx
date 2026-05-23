import type { PanelGeometry, PanelInstance } from "../core/types";
import type { PanelRegistry } from "../core/panelRegistry";
import type { WorkspacePreferences } from "../core/types";
import { PanelFrame } from "./PanelFrame";

type Props = {
  registry: PanelRegistry;
  title: string;
  panels: PanelInstance[];
  preferences: WorkspacePreferences;
  onFocusPanel: (panelId: string) => void;
  onClosePanel: (panelId: string) => void;
  onGeometryChange: (panelId: string, geometry: PanelGeometry) => void;
  onPanelStateChange: (panelId: string, panelState: unknown) => void;
  onPreferencesChange: (preferences: Partial<WorkspacePreferences>) => void;
};

export function WorkspaceCanvas({
  registry,
  title,
  panels,
  preferences,
  onFocusPanel,
  onClosePanel,
  onGeometryChange,
  onPanelStateChange,
  onPreferencesChange,
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
            registry={registry}
            panel={panel}
            preferences={preferences}
            onFocus={onFocusPanel}
            onClose={onClosePanel}
            onGeometryChange={onGeometryChange}
            onPanelStateChange={onPanelStateChange}
            onPreferencesChange={onPreferencesChange}
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
