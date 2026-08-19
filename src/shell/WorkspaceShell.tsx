import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createDefaultWorkspace } from "../core/defaultWorkspace";
import { createLayoutPersistence } from "../core/layoutPersistence";
import { useWorkspaceController } from "../core/workspaceController";
import { workspaceRuntime } from "../bootstrap/workspaceRuntime";
import { TabBar } from "../tabs/TabBar";
import { WorkspaceCanvas } from "../workspace/WorkspaceCanvas";
import type { PanelDefinition, WorkspaceModuleDefinition } from "../core/types";
import type { OpenResourceRequest, OpenResourceResult } from "../core/resources";
import jarriWorkspaceLogo from "../assets/jarri-workspace.png";

type PanelMenuGroup = {
  module: WorkspaceModuleDefinition;
  panels: PanelDefinition[];
};

function arrangePanelGroups(
  modules: WorkspaceModuleDefinition[],
  panels: PanelDefinition[],
  preferences: ReturnType<typeof useWorkspaceController>["workspace"]["preferences"],
): PanelMenuGroup[] {
  const orderIndex = new Map(
    preferences.panelMenu.moduleOrder.map((moduleId, index) => [moduleId, index]),
  );
  const hidden = new Set(preferences.panelMenu.hiddenModuleIds);

  return modules
    .filter((module) => !hidden.has(module.moduleId))
    .sort((a, b) => {
      const aIndex = orderIndex.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.title.localeCompare(b.title);
    })
    .map((module) => {
      const modulePanels = panels.filter((panel) => panel.moduleId === module.moduleId);
      return {
        module,
        panels:
          preferences.panelMenu.panelSort === "title"
            ? [...modulePanels].sort((a, b) => a.title.localeCompare(b.title))
            : modulePanels,
      };
    })
    .filter((group) => group.panels.length > 0);
}

export function WorkspaceShell() {
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
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
  const modules = runtime.listModules().map((module) => ({
    moduleId: module.moduleId,
    title: module.title,
  }));

  const panelGroups = useMemo(
    () =>
      arrangePanelGroups(
        runtime.listModules(),
        controller.availablePanels,
        preferences,
      ),
    [controller.availablePanels, preferences, runtime],
  );

  const colorStyle = {
    "--workspace-scale": preferences.scale,
    "--workspace-font-size": `${preferences.fontSize}px`,
    ...(preferences.colorOverrides.page ? { "--override-page": preferences.colorOverrides.page } : {}),
    ...(preferences.colorOverrides.canvas ? { "--override-canvas": preferences.colorOverrides.canvas } : {}),
    ...(preferences.colorOverrides.panel ? { "--override-panel": preferences.colorOverrides.panel } : {}),
    ...(preferences.colorOverrides.panelHeader ? { "--override-panel-header": preferences.colorOverrides.panelHeader } : {}),
    ...(preferences.colorOverrides.text ? { "--override-text": preferences.colorOverrides.text } : {}),
    ...(preferences.colorOverrides.muted ? { "--override-muted": preferences.colorOverrides.muted } : {}),
    ...(preferences.colorOverrides.border ? { "--override-border": preferences.colorOverrides.border } : {}),
    ...(preferences.colorOverrides.button ? { "--override-button": preferences.colorOverrides.button } : {}),
    ...(preferences.colorOverrides.menu ? { "--override-menu": preferences.colorOverrides.menu } : {}),
  } as CSSProperties;

  function exportTabs() {
    const blob = new Blob([controller.exportTabsJson()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "workspace-core-panel-setups.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openResource(request: OpenResourceRequest): OpenResourceResult {
    return {
      ok: false,
      error: `No resource opener is registered in Workspace Core for ${request.uri}.`,
    };
  }

  function importTabs(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const report = controller.importTabsJson(result);
      if (report.warnings.length > 0) {
        window.alert(report.warnings.join("\n"));
      } else {
        window.alert(`Imported ${report.imported} panel setups.`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <main
      className="workspace-shell"
      data-density={preferences.density}
      data-font-family={preferences.fontFamily}
      data-theme-mode={preferences.themeMode}
      data-theme-preset={preferences.themePreset}
      data-grid-visible={preferences.showGrid}
      data-has-custom-page={Boolean(preferences.colorOverrides.page)}
      data-has-custom-canvas={Boolean(preferences.colorOverrides.canvas)}
      data-has-custom-panel={Boolean(preferences.colorOverrides.panel)}
      data-has-custom-panel-header={Boolean(preferences.colorOverrides.panelHeader)}
      data-has-custom-text={Boolean(preferences.colorOverrides.text)}
      data-has-custom-muted={Boolean(preferences.colorOverrides.muted)}
      data-has-custom-border={Boolean(preferences.colorOverrides.border)}
      data-has-custom-button={Boolean(preferences.colorOverrides.button)}
      data-has-custom-menu={Boolean(preferences.colorOverrides.menu)}
      style={colorStyle}
    >
      <header className="workspace-shell__header">
        <img
          className="workspace-shell__logo"
          src={jarriWorkspaceLogo}
          alt="Jarri Workspace"
        />
      </header>

      <TabBar
        tabs={controller.workspace.tabs}
        activeTabId={controller.workspace.activeTabId}
        onSelectTab={controller.selectTab}
        onCreateTab={controller.createTab}
        onRenameTab={controller.renameTab}
        onCloseTab={controller.closeTab}
      />

      <input
        ref={importInputRef}
        className="workspace-shell__file-input"
        type="file"
        accept="application/json"
        onChange={(event) => {
          importTabs(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="workspace-shell__floating-panel-menu">
        <div className="panel-menu">
          {panelMenuOpen ? (
            <div className="panel-menu__content">
              {panelGroups.map((group) => (
                <section className="panel-menu__group" key={group.module.moduleId}>
                  <h2>{group.module.title}</h2>
                  {group.panels.map((panel) => (
                    <button
                      key={`${panel.moduleId}:${panel.panelType}`}
                      type="button"
                      onClick={() => {
                        controller.createPanel(panel.moduleId, panel.panelType);
                        setPanelMenuOpen(false);
                      }}
                    >
                      <strong>{panel.title}</strong>
                      <span>{panel.description}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <WorkspaceCanvas
        registry={runtime.registry}
        title={controller.activeTab.title}
        panels={controller.activeTab.panels}
        savedTabTemplates={controller.savedTabTemplates}
        preferences={preferences}
        modules={modules}
        onOpenPanelsMenu={() => setPanelMenuOpen((open) => !open)}
        onOpenSettings={() => controller.createPanel("core", "settings")}
        onResetLayout={controller.resetWorkspace}
        onSavePanelSetup={controller.saveActiveTabTemplate}
        onLoadPanelSetup={controller.loadTabTemplate}
        onExportPanelSetups={exportTabs}
        onImportPanelSetups={() => importInputRef.current?.click()}
        onFocusPanel={controller.focusPanel}
        onClosePanel={controller.closePanel}
        onTogglePanelMinimized={controller.togglePanelMinimized}
        onGeometryChange={controller.updatePanelGeometry}
        onPanelStateChange={controller.updatePanelState}
        onPreferencesChange={controller.updatePreferences}
        onOpenResource={openResource}
      />
    </main>
  );
}
