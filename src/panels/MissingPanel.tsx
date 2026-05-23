import type { PanelBodyProps } from "../core/types";

export function MissingPanel({ panel }: PanelBodyProps) {
  const state = panel.panelState as {
    moduleId?: string;
    panelType?: string;
  };

  return (
    <div className="panel-body missing-panel">
      <strong>Missing Panel Definition</strong>
      <p>
        The saved layout references{" "}
        <code>
          {state.moduleId ?? "unknown"}:{state.panelType ?? "unknown"}
        </code>
        , but that module is not registered.
      </p>
      <p>The original layout projection is preserved so it can recover later.</p>
    </div>
  );
}

