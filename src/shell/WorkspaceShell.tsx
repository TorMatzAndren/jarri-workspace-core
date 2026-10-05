import {
  useCallback,
  useEffect,
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
import {
  isPanelMenuModuleExpanded,
  projectPanelMenuGroups,
} from "../core/panelMenu";
import {
  explicitTextViewerResourcePath,
  filePathBasename,
  resourceUriToImageFilePath,
  resourceUriToTextFilePath,
  type OpenResourceRequest,
  type OpenResourceResult,
} from "../core/resources";
import jarriWorkspaceLogo from "../assets/jarri-workspace.png";
import { openExternalUrl } from "../core/platform/openExternalUrl";
import { WorkspaceClock } from "./WorkspaceClock";
import { copyWorkspaceScreenshot } from "../workspace/screenshot";
import { reconcileWorkspaceNativeSurfacePanels } from "../core/platform/nativeSurface";
import type { WorkspaceCanvasScreenshotSource } from "../workspace/workspaceScreenshotComposition";

const JARRI_SYSTEMS_URL = "http://jarri.systems/";

type WorkspaceScreenshotState = "idle" | "copying" | "copied" | "failed";

export function WorkspaceShell() {
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [frameControlsMenuOpen, setFrameControlsMenuOpen] = useState(false);
  const [collapsedFrameControlGroups, setCollapsedFrameControlGroups] =
    useState<Record<string, boolean>>({});
  const [fileOperationClipboard, setFileOperationClipboard] =
    useState<unknown>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [workspaceScreenshotState, setWorkspaceScreenshotState] =
    useState<WorkspaceScreenshotState>("idle");
  const [workspaceScreenshotProgress, setWorkspaceScreenshotProgress] =
    useState("");
  const shellCaptureRef = useRef<HTMLElement | null>(null);
  const headerCaptureRef = useRef<HTMLElement | null>(null);
  const tabsCaptureRef = useRef<HTMLElement | null>(null);
  const canvasToolbarCaptureRef = useRef<HTMLDivElement | null>(null);
  const activeCanvasScreenshotSourceRef =
    useRef<WorkspaceCanvasScreenshotSource | null>(null);
  const updateActiveCanvasScreenshotSource = useCallback(
    (source: WorkspaceCanvasScreenshotSource | null) => {
      activeCanvasScreenshotSourceRef.current = source;
    },
    [],
  );
  const tabsCaptureRefCallback = useCallback((element: HTMLElement | null) => {
    tabsCaptureRef.current = element;
  }, []);
  const canvasToolbarCaptureRefCallback = useCallback(
    (element: HTMLDivElement | null) => {
      canvasToolbarCaptureRef.current = element;
    },
    [],
  );

  async function captureEntireWorkspaceScreenshot() {
    if (workspaceScreenshotState === "copying") return;
    const shellElement = shellCaptureRef.current;
    const canvasSource = activeCanvasScreenshotSourceRef.current;
    const chromeElements = [
      headerCaptureRef.current,
      tabsCaptureRef.current,
      canvasToolbarCaptureRef.current,
    ];
    if (
      !shellElement ||
      !canvasSource ||
      chromeElements.some((element) => element == null)
    ) {
      setWorkspaceScreenshotState("failed");
      setWorkspaceScreenshotProgress("Screenshot failed");
      window.setTimeout(() => {
        setWorkspaceScreenshotState("idle");
        setWorkspaceScreenshotProgress("");
      }, 2400);
      return;
    }
    setWorkspaceScreenshotState("copying");
    setWorkspaceScreenshotProgress("Preparing screenshot…");
    try {
      await copyWorkspaceScreenshot({
        kind: "entire-workspace",
        shellElement,
        chromeElements: chromeElements.filter(
          (element): element is HTMLElement => element != null,
        ),
        canvasElement: canvasSource.element,
        canvasBounds: canvasSource.bounds,
        onProgress: setWorkspaceScreenshotProgress,
      });
      setWorkspaceScreenshotProgress("Screenshot copied");
      setWorkspaceScreenshotState("copied");
      window.setTimeout(() => {
        setWorkspaceScreenshotState((state) =>
          state === "copied" ? "idle" : state,
        );
        setWorkspaceScreenshotProgress("");
      }, 1600);
    } catch (error) {
      console.error("Entire Workspace screenshot failed", error);
      setWorkspaceScreenshotProgress("Screenshot failed");
      setWorkspaceScreenshotState("failed");
      window.setTimeout(() => {
        setWorkspaceScreenshotState((state) =>
          state === "failed" ? "idle" : state,
        );
        setWorkspaceScreenshotProgress("");
      }, 2400);
    }
  }
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

  const nativeSurfacePanelIds = controller.workspace.tabs
    .flatMap((tab) => tab.panels)
    .map((panel) => panel.id)
    .sort();

  const nativeSurfacePanelKey = nativeSurfacePanelIds.join("\n");

  useEffect(() => {
    void reconcileWorkspaceNativeSurfacePanels(nativeSurfacePanelIds).catch(
      (error) => {
        const message = String(error);

        if (
          message.includes("native surfaces are not available on this platform")
        ) {
          return;
        }

        console.error("Workspace native surface reconciliation failed", error);
      },
    );
  }, [nativeSurfacePanelKey]);

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

  function moveSystemSurfaceDrag(event: ReactPointerEvent<HTMLDivElement>) {
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
            Math.round(drag.startX + (event.clientX - drag.startPointerX)),
          ),
          y: Math.max(
            0,
            Math.round(drag.startY + (event.clientY - drag.startPointerY)),
          ),
        },
      },
    });
  }

  function endSystemSurfaceDrag(event: ReactPointerEvent<HTMLDivElement>) {
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
      projectPanelMenuGroups(
        runtime.listModules(),
        controller.availablePanels,
        preferences.panelMenu,
      ),
    [controller.availablePanels, preferences.panelMenu, runtime],
  );

  const frameControlColumns = WORKSPACE_FRAME_CONTROL_CATALOG;
  const frameControlGroups = panelGroups;

  function toggleFrameControlGroup(moduleId: string) {
    setCollapsedFrameControlGroups((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  }

  function togglePanelMenuModule(moduleId: string) {
    const expandedModuleIds = new Set(preferences.panelMenu.expandedModuleIds);
    if (expandedModuleIds.has(moduleId)) {
      expandedModuleIds.delete(moduleId);
    } else {
      expandedModuleIds.add(moduleId);
    }

    controller.updatePreferences({
      panelMenu: {
        ...preferences.panelMenu,
        expandedModuleIds: [...expandedModuleIds],
      },
    });
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
    ...(preferences.colorOverrides.page
      ? { "--override-page": preferences.colorOverrides.page }
      : {}),
    ...(preferences.colorOverrides.canvas
      ? { "--override-canvas": preferences.colorOverrides.canvas }
      : {}),
    ...(preferences.colorOverrides.panel
      ? { "--override-panel": preferences.colorOverrides.panel }
      : {}),
    ...(preferences.colorOverrides.panelHeader
      ? { "--override-panel-header": preferences.colorOverrides.panelHeader }
      : {}),
    ...(preferences.colorOverrides.text
      ? { "--override-text": preferences.colorOverrides.text }
      : {}),
    ...(preferences.colorOverrides.muted
      ? { "--override-muted": preferences.colorOverrides.muted }
      : {}),
    ...(preferences.colorOverrides.border
      ? { "--override-border": preferences.colorOverrides.border }
      : {}),
    ...(preferences.colorOverrides.button
      ? { "--override-button": preferences.colorOverrides.button }
      : {}),
    ...(preferences.colorOverrides.control
      ? { "--override-control": preferences.colorOverrides.control }
      : {}),
    ...(preferences.colorOverrides.menu
      ? { "--override-menu": preferences.colorOverrides.menu }
      : {}),
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
    const imagePath = resourceUriToImageFilePath(request.uri);
    const textPath =
      resourceUriToTextFilePath(request.uri) ??
      explicitTextViewerResourcePath(request);

    if (imagePath || textPath) {
      const moduleId = request.preferredModuleId ?? "core";
      const panelType =
        request.preferredPanelType ??
        (imagePath ? "image-viewer" : "text-viewer");
      const expectedPanelType = imagePath ? "image-viewer" : "text-viewer";
      const resourcePath = imagePath ?? textPath ?? "";

      if (moduleId !== "core" || panelType !== expectedPanelType) {
        return {
          ok: false,
          error: `No ${imagePath ? "image" : "text"} opener is registered for ${moduleId}/${panelType}.`,
        };
      }

      const sameResourcePanel = controller.activeTab.panels.find(
        (panel) =>
          panel.moduleId === moduleId &&
          panel.panelType === panelType &&
          typeof panel.panelState === "object" &&
          panel.panelState !== null &&
          !Array.isArray(panel.panelState) &&
          (panel.panelState as { resourceUri?: unknown }).resourceUri ===
            request.uri,
      );

      if (sameResourcePanel && request.disposition !== "new-panel") {
        controller.focusPanel(sameResourcePanel.id);
        return { ok: true, panelId: sameResourcePanel.id };
      }

      const panelId = controller.createPanel(moduleId, panelType, {
        title: request.label?.trim() || filePathBasename(resourcePath),
        panelState: { resourceUri: request.uri },
        preferredGeometry: request.preferredGeometry,
        sourcePanelId: request.sourcePanelId,
      });

      if (panelId) {
        controller.focusPanel(panelId);
        return { ok: true, panelId };
      }

      return {
        ok: false,
        error: `Unable to create ${moduleId}/${panelType}.`,
      };
    }

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
      ref={shellCaptureRef}
      className="workspace-shell"
      data-density={preferences.density}
      data-font-family={preferences.fontFamily}
      data-theme-mode={preferences.themeMode}
      data-theme-preset={preferences.themePreset}
      data-grid-visible={preferences.showGrid}
      data-has-custom-page={Boolean(preferences.colorOverrides.page)}
      data-has-custom-canvas={Boolean(preferences.colorOverrides.canvas)}
      data-has-custom-panel={Boolean(preferences.colorOverrides.panel)}
      data-has-custom-panel-header={Boolean(
        preferences.colorOverrides.panelHeader,
      )}
      data-has-custom-text={Boolean(preferences.colorOverrides.text)}
      data-has-custom-muted={Boolean(preferences.colorOverrides.muted)}
      data-has-custom-border={Boolean(preferences.colorOverrides.border)}
      data-has-custom-button={Boolean(preferences.colorOverrides.button)}
      data-has-custom-control={Boolean(preferences.colorOverrides.control)}
      data-has-custom-menu={Boolean(preferences.colorOverrides.menu)}
      style={colorStyle}
    >
      <header className="workspace-shell__header" ref={headerCaptureRef}>
        <button
          type="button"
          className="workspace-shell__logo-link"
          title="Visit jarri.systems"
          aria-label="Visit jarri.systems in your web browser"
          onClick={() => {
            void openExternalUrl(JARRI_SYSTEMS_URL).catch((error) => {
              console.error("Failed to open jarri.systems", error);
            });
          }}
        >
          <img
            className="workspace-shell__logo"
            src={jarriWorkspaceLogo}
            alt="Jarri Workspace"
          />
        </button>

        <div className="workspace-shell__actions">
          <div
            className="workspace-shell__screenshot-cluster"
            data-workspace-screenshot-exclude
          >
            <button
              type="button"
              className={`workspace-shell__action ${
                workspaceScreenshotState === "copied"
                  ? "workspace-shell__action--ok"
                  : workspaceScreenshotState === "failed"
                    ? "workspace-shell__action--bad"
                    : ""
              }`}
              data-workspace-screenshot-exclude
              title="Screenshot entire Workspace"
              aria-label="Screenshot entire Workspace"
              disabled={workspaceScreenshotState === "copying"}
              onClick={() => void captureEntireWorkspaceScreenshot()}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </button>
            {workspaceScreenshotProgress ? (
              <span
                className="workspace-shell__screenshot-status"
                data-workspace-screenshot-exclude
                aria-live="polite"
                role="status"
              >
                {workspaceScreenshotProgress}
              </span>
            ) : null}
          </div>

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
                  panel.moduleId === "core" && panel.panelType === "settings",
              );

              if (settingsPanel) {
                controller.closePanel(settingsPanel.id);
                return;
              }

              controller.createPanel("core", "settings", {
                initialPosition: preferences.systemSurfacePositions.settings,
              });
            }}
          >
            Settings
          </button>

          <WorkspaceClock
            preferences={preferences.clock}
            onOpenCalendar={() => {
              const existing = controller.activeTab.panels.find(
                (panel) =>
                  panel.moduleId === "core" && panel.panelType === "calendar",
              );

              if (existing) {
                controller.closePanel(existing.id);
                return;
              }

              controller.createPanel("core", "calendar");
            }}
          />
        </div>
      </header>

      <TabBar
        captureRef={tabsCaptureRefCallback}
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
            <div className="panel-menu__content" data-workspace-native-occluder>
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
                <div className="panel-menu__header-actions">
                  <button
                    type="button"
                    className="panel-menu__collapse-all"
                    disabled={
                      !panelGroups.some((group) =>
                        isPanelMenuModuleExpanded(
                          preferences.panelMenu,
                          group.module.moduleId,
                        ),
                      )
                    }
                    onClick={() =>
                      controller.updatePreferences({
                        panelMenu: {
                          ...preferences.panelMenu,
                          expandedModuleIds: [],
                        },
                      })
                    }
                  >
                    Collapse all
                  </button>
                  <button
                    type="button"
                    className="panel-menu__close"
                    onClick={() => setPanelMenuOpen(false)}
                    aria-label="Close Add Panel menu"
                  >
                    ×
                  </button>
                </div>
              </div>

              {panelGroups.map((group) => {
                const expanded = isPanelMenuModuleExpanded(
                  preferences.panelMenu,
                  group.module.moduleId,
                );

                return (
                  <section
                    className="panel-menu__group"
                    key={group.module.moduleId}
                  >
                    <button
                      type="button"
                      className="panel-menu__group-toggle"
                      onClick={() =>
                        togglePanelMenuModule(group.module.moduleId)
                      }
                      aria-expanded={expanded}
                    >
                      <h2>{group.module.title}</h2>
                      <span>{expanded ? "Collapse" : "Expand"}</span>
                    </button>

                    {expanded ? (
                      <div className="panel-menu__group-panels">
                        {group.panels.map((panel) => (
                          <button
                            key={`${panel.moduleId}:${panel.panelType}`}
                            type="button"
                            className="panel-menu__panel-button"
                            onClick={() => {
                              controller.createPanel(
                                panel.moduleId,
                                panel.panelType,
                              );
                              setPanelMenuOpen(false);
                            }}
                          >
                            <strong>{panel.title}</strong>
                            <span>{panel.description}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
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
        canvasScale={controller.activeTab.canvasScale}
        canvasCamera={controller.activeTab.canvasCamera}
        preferences={preferences}
        modules={modules}
        fileOperationClipboard={fileOperationClipboard}
        setFileOperationClipboard={setFileOperationClipboard}
        screenshotToolbarRef={canvasToolbarCaptureRefCallback}
        onScreenshotSourceChange={updateActiveCanvasScreenshotSource}
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
        onCanvasScaleChange={controller.updateActiveTabCanvasScale}
        onCanvasCameraChange={controller.updateActiveTabCanvasCamera}
        onPreferencesChange={controller.updatePreferences}
        onOpenPanel={(moduleId, panelType, sourcePanelId, panelState) =>
          controller.createPanel(moduleId, panelType, {
            sourcePanelId,
            panelState,
          })
        }
        onOpenResource={openResource}
      />
    </main>
  );
}
