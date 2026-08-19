import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createDefaultWorkspace } from "../core/defaultWorkspace";
import { createLayoutPersistence } from "../core/layoutPersistence";
import {
  isPanelFrameControlEnabled,
  panelFrameControlKey,
  WORKSPACE_FRAME_CONTROL_CATALOG,
} from "../core/frameControls";
import { useWorkspaceController } from "../core/workspaceController";
import { workspaceRuntime } from "../bootstrap/workspaceRuntime";
import { TabBar } from "../tabs/TabBar";
import { WorkspaceCanvas } from "../workspace/WorkspaceCanvas";
import type { PanelDefinition, WorkspaceModuleDefinition } from "../core/types";
import type { OpenResourceRequest, OpenResourceResult } from "../core/resources";
import jarriWorkspaceLogo from "../assets/jarri-workspace.png";
import { WorkspaceClock } from "./WorkspaceClock";

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
  const [frameControlsMenuOpen, setFrameControlsMenuOpen] = useState(false);
  const [collapsedFrameControlGroups, setCollapsedFrameControlGroups] = useState<
    Record<string, boolean>
  >({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const systemSurfaceDragRef = useRef<{
    surface: "addPanel" | "frameSettings";
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
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

  function beginSystemSurfaceDrag(
    surface: "addPanel" | "frameSettings",
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    const position = preferences.systemSurfacePositions[surface];

    systemSurfaceDragRef.current = {
      surface,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveSystemSurfaceDrag(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = systemSurfaceDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    controller.updatePreferences({
      systemSurfacePositions: {
        ...preferences.systemSurfacePositions,
        [drag.surface]: {
          x: Math.max(
            0,
            Math.round(
              drag.startX +
                (event.clientX - drag.startPointerX),
            ),
          ),
          y: Math.max(
            0,
            Math.round(
              drag.startY +
                (event.clientY - drag.startPointerY),
            ),
          ),
        },
      },
    });
  }

  function endSystemSurfaceDrag(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = systemSurfaceDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    systemSurfaceDragRef.current = null;
  }

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

  const frameControlColumns = WORKSPACE_FRAME_CONTROL_CATALOG;
  const frameControlGroups = panelGroups;

  function toggleFrameControlGroup(moduleId: string) {
    setCollapsedFrameControlGroups((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  }

  function setFrameControlVisibility(
    moduleId: string,
    panelType: string,
    controlId: string,
    enabled: boolean,
  ) {
    const key = panelFrameControlKey(moduleId, panelType, controlId);

    controller.updatePreferences({
      frameControls: {
        ...preferences.frameControls,
        visibility: {
          ...preferences.frameControls.visibility,
          [key]: enabled,
        },
      },
    });
  }

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

        <div className="workspace-shell__actions">
          <button
            type="button"
            className="workspace-shell__action"
            onClick={() => {
              setPanelMenuOpen(false);
              setFrameControlsMenuOpen((open) => !open);
            }}
          >
            Frame Controls
          </button>

          <button
            type="button"
            className="workspace-shell__action"
            onClick={() => {
              setPanelMenuOpen(false);
              setFrameControlsMenuOpen(false);

              const settingsPanel = controller.activeTab.panels.find(
                (panel) =>
                  panel.moduleId === "core" &&
                  panel.panelType === "settings",
              );

              if (settingsPanel) {
                controller.closePanel(settingsPanel.id);
                return;
              }

              controller.createPanel("core", "settings", {
                initialPosition:
                  preferences.systemSurfacePositions.settings,
              });
            }}
          >
            Settings
          </button>

          <WorkspaceClock preferences={preferences.clock} />
        </div>
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

      <div
        className="workspace-shell__floating-panel-menu"
        style={{
          left: `${preferences.systemSurfacePositions.addPanel.x}px`,
          top: `${preferences.systemSurfacePositions.addPanel.y}px`,
          right: "auto",
        }}
      >
        <div className="panel-menu">
          {panelMenuOpen ? (
            <div className="panel-menu__content">
              <div
                className="panel-menu__header panel-menu__header--draggable"
                onPointerDown={(event) =>
                  beginSystemSurfaceDrag("addPanel", event)
                }
                onPointerMove={moveSystemSurfaceDrag}
                onPointerUp={endSystemSurfaceDrag}
                onPointerCancel={endSystemSurfaceDrag}
              >
                <strong>Add Panel</strong>
                <button
                  type="button"
                  className="panel-menu__close"
                  onClick={() => setPanelMenuOpen(false)}
                  aria-label="Close Add Panel menu"
                >
                  ×
                </button>
              </div>

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

      <div
        className="workspace-shell__floating-panel-menu"
        style={{
          left: `${preferences.systemSurfacePositions.frameSettings.x}px`,
          top: `${preferences.systemSurfacePositions.frameSettings.y}px`,
        }}
      >
        <div className="panel-menu">
          {frameControlsMenuOpen ? (
            <div className="panel-menu__content panel-menu__content--frame-settings">
              <div
                className="panel-menu__header panel-menu__header--draggable"
                onPointerDown={(event) =>
                  beginSystemSurfaceDrag("frameSettings", event)
                }
                onPointerMove={moveSystemSurfaceDrag}
                onPointerUp={endSystemSurfaceDrag}
                onPointerCancel={endSystemSurfaceDrag}
              >
                <strong>Frame Settings</strong>
                <button
                  type="button"
                  className="panel-menu__close"
                  onClick={() => setFrameControlsMenuOpen(false)}
                  aria-label="Close Frame Settings"
                >
                  ×
                </button>
              </div>

              {frameControlColumns.length === 0 ? (
                <p className="panel-menu__frame-settings-empty">
                  No frame controls are currently registered.
                </p>
              ) : null}

              {frameControlGroups.map((group) => {
                const collapsed =
                  collapsedFrameControlGroups[group.module.moduleId] ?? false;

                return (
                  <section
                    className="panel-menu__group"
                    key={group.module.moduleId}
                  >
                    <button
                      type="button"
                      className="panel-menu__group-toggle"
                      onClick={() =>
                        toggleFrameControlGroup(group.module.moduleId)
                      }
                      aria-expanded={!collapsed}
                    >
                      <strong>{group.module.title}</strong>
                      <span>{collapsed ? "Expand" : "Collapse"}</span>
                    </button>

                    {!collapsed ? (
                      <div className="panel-menu__frame-settings-scroll">
                        <div
                          className="panel-menu__frame-settings-matrix"
                          style={
                            {
                              "--frame-control-column-count":
                                frameControlColumns.length,
                            } as CSSProperties
                          }
                        >
                          <div className="panel-menu__frame-settings-header">
                            <strong>Panel</strong>
                            {frameControlColumns.map((control) => (
                              <strong key={control.controlId}>
                                {control.label}
                              </strong>
                            ))}
                          </div>

                          {group.panels.map((panel) => (
                            <div
                              key={`${panel.moduleId}:${panel.panelType}`}
                              className="panel-menu__frame-settings-row"
                            >
                              <span
                                className="panel-menu__frame-settings-panel"
                                title={panel.description}
                              >
                                {panel.title}
                              </span>

                              {frameControlColumns.map((control) => {
                                const key = panelFrameControlKey(
                                  panel.moduleId,
                                  panel.panelType,
                                  control.controlId,
                                );
                                const enabled = isPanelFrameControlEnabled({
                                  control,
                                  key,
                                  preferences: preferences.frameControls,
                                });

                                return (
                                  <label
                                    key={control.controlId}
                                    className="panel-menu__frame-settings-control"
                                    title={`${control.label} for ${panel.title}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      aria-label={`${control.label} for ${panel.title}`}
                                      onChange={(event) =>
                                        setFrameControlVisibility(
                                          panel.moduleId,
                                          panel.panelType,
                                          control.controlId,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <WorkspaceCanvas
        registry={runtime.registry}
        tabId={controller.activeTab.id}
        title={controller.activeTab.title}
        panels={controller.activeTab.panels}
        canvasBounds={controller.activeTab.canvasBounds}
        preferences={preferences}
        modules={modules}
        onOpenPanelsMenu={() => {
          setFrameControlsMenuOpen(false);
          setPanelMenuOpen((open) => !open);
        }}
        onFocusPanel={controller.focusPanel}
        onClosePanel={controller.closePanel}
        onTogglePanelMinimized={controller.togglePanelMinimized}
        onGeometryChange={controller.updatePanelGeometry}
        onPanelStateChange={controller.updatePanelState}
        onPanelViewPreferencesChange={controller.updatePanelViewPreferences}
        onCanvasBoundsChange={controller.updateActiveTabCanvasBounds}
        onPreferencesChange={controller.updatePreferences}
        onOpenResource={openResource}
      />
    </main>
  );
}
