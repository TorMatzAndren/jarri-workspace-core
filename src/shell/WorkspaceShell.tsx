import { useMemo, type CSSProperties } from "react";
import { createDefaultWorkspace } from "../core/defaultWorkspace";
import { createLayoutPersistence } from "../core/layoutPersistence";
import { useWorkspaceController } from "../core/workspaceController";
import { workspaceRuntime } from "../bootstrap/workspaceRuntime";
import { TabBar } from "../tabs/TabBar";
import { WorkspaceCanvas } from "../workspace/WorkspaceCanvas";

export function WorkspaceShell() {
  const runtime = workspaceRuntime;
  const defaultWorkspaceFactory = useMemo(
    () => () => createDefaultWorkspace(runtime.registry),
    [runtime.registry],
  );
  const persistence = useMemo(
    () =>
      createLayoutPersistence({
        registry: runtime.registry,
        defaultWorkspaceFactory,
        getModuleRecords: runtime.getModuleRecords,
      }),
    [defaultWorkspaceFactory, runtime],
  );
  const controller = useWorkspaceController({
    registry: runtime.registry,
    persistence,
    defaultWorkspaceFactory,
  });
  const preferences = controller.workspace.preferences;

  return (
    <main
      className="workspace-shell"
      data-density={preferences.density}
      data-font-family={preferences.fontFamily}
      data-theme-mode={preferences.themeMode}
      data-theme-preset={preferences.themePreset}
      style={{ "--workspace-scale": preferences.scale } as CSSProperties}
    >
      <header className="workspace-shell__header">
        <div>
          <span className="eyebrow">Jarri Workspace Core</span>
          <h1>Reusable Projection Workspace</h1>
        </div>
        <div className="workspace-shell__truth">
          <span>Schema v{controller.workspace.schemaVersion}</span>
          <span>{controller.initialRepairLabel}</span>
          <span>truth/advisory separated</span>
        </div>
      </header>

      <TabBar
        tabs={controller.workspace.tabs}
        activeTabId={controller.workspace.activeTabId}
        onSelectTab={controller.selectTab}
        onCreateTab={controller.createTab}
        onCloseTab={controller.closeTab}
      />

      <section className="workspace-shell__actions">
        <div className="panel-picker">
          {controller.availablePanels.map((panel) => (
            <button
              key={`${panel.moduleId}:${panel.panelType}`}
              type="button"
              onClick={() => controller.createPanel(panel.moduleId, panel.panelType)}
            >
              + {panel.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="reset-button"
          onClick={controller.resetWorkspace}
        >
          Reset Layout
        </button>
      </section>

      <WorkspaceCanvas
        registry={runtime.registry}
        title={controller.activeTab.title}
        panels={controller.activeTab.panels}
        preferences={preferences}
        onFocusPanel={controller.focusPanel}
        onClosePanel={controller.closePanel}
        onGeometryChange={controller.updatePanelGeometry}
        onPanelStateChange={controller.updatePanelState}
        onPreferencesChange={controller.updatePreferences}
      />
    </main>
  );
}
