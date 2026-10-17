import {
  moveCatalogueModule,
  reconcileCatalogueColumns,
  mergeCatalogueModuleOrder,
  projectCatalogueColumns,
  resolveCatalogueDrop,
} from "./panelCatalogueReorder";
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
  projectPanelMenuGroups,
  filterPanelMenuGroups,
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
import { CoreOpenPanelSearch } from "./CoreOpenPanelSearch";
import { DeveloperVersionIndicator } from "./DeveloperVersionIndicator";
import { copyWorkspaceScreenshot } from "../workspace/screenshot";
import { reconcileWorkspaceNativeSurfacePanels } from "../core/platform/nativeSurface";
import type { WorkspaceCanvasScreenshotSource } from "../workspace/workspaceScreenshotComposition";
import { projectWorkspacePanelLifecycle } from "../core/workspacePanelLifecycle";

const JARRI_SYSTEMS_URL = "http://jarri.systems/";

type WorkspaceScreenshotState = "idle" | "copying" | "copied" | "failed";

export function WorkspaceShell() {
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [panelMenuSearchQuery, setPanelMenuSearchQuery] = useState("");

  const [catalogueLayoutLocked, setCatalogueLayoutLocked] =
    useState(() => {
      try {
        const value = localStorage.getItem(
          "jarri.workspace.core.catalogueLayoutLocked.v1",
        );
        if (value !== null) return value !== "false";

        return localStorage.getItem(
          "jarri.workspace.core.addPanelLayoutLocked.v1",
        ) !== "false";
      } catch {
        return true;
      }
    });

  const [catalogueManualColumns, setCatalogueManualColumns] =
    useState<unknown>(() => {
      try {
        const raw = localStorage.getItem(
          "jarri.workspace.core.catalogueColumns.v1",
        );
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    });

  const [catalogueWidth, setCatalogueWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(
        "jarri.workspace.core.catalogueWidth.v1",
      );
      const saved = raw === null ? NaN : Number(raw);
      return Number.isFinite(saved) && saved >= 280
        ? saved : 960;
    } catch {
      return 960;
    }
  });

  const [catalogueViewportWidth, setCatalogueViewportWidth] =
    useState(() => window.innerWidth);

  useEffect(() => {
    const update = () => setCatalogueViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const catalogueResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);

  const catalogueDragRef = useRef<string | null>(null);
  const [catalogueDragId, setCatalogueDragId] =
    useState<string | null>(null);
  const [catalogueDropId, setCatalogueDropId] =
    useState<string | null>(null);

  function clampCatalogueWidth(value: number) {
    return Math.max(
      280,
      Math.min(
        value,
        Math.max(280, catalogueViewportWidth - 32),
      ),
    );
  }

  function persistCatalogueWidth(value: number) {
    try {
      localStorage.setItem(
        "jarri.workspace.core.catalogueWidth.v1",
        String(clampCatalogueWidth(value)),
      );
    } catch {
      // Resizing remains functional without storage.
    }
  }

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

  const [panelSearchNavigation, setPanelSearchNavigation] = useState<{
    panelId: string;
    requestId: number;
  } | null>(null);

  function navigateToSearchPanel(panelId: string) {
    setPanelSearchNavigation((current) => ({
      panelId,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }

  const panelLifecycleProjection = useMemo(
    () =>
      projectWorkspacePanelLifecycle(controller.workspace, (panel) =>
        runtime.registry.getPanel(panel.moduleId, panel.panelType)?.lifecycle,
      ),
    [controller.workspace, runtime.registry],
  );

  useEffect(() => {
    runtime.lifecycle.reconcilePanels(
      panelLifecycleProjection.panelIds,
      panelLifecycleProjection.capabilitiesByPanelId,
    );
    runtime.lifecycle.reconcileActivePanels(
      panelLifecycleProjection.activePanelIds,
    );
  }, [panelLifecycleProjection, runtime.lifecycle]);

  useEffect(
    () => () => {
      runtime.lifecycle.reconcilePanels([]);
    },
    [runtime.lifecycle],
  );

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

  function openSettingsFromDeveloperIndicator() {
    setPanelMenuOpen(false);
    setFrameControlsMenuOpen(false);
    const settingsPanel = controller.activeTab.panels.find(
      (panel) => panel.moduleId === "core" && panel.panelType === "settings",
    );
    if (!settingsPanel) {
      controller.createPanel("core", "settings", {
        initialPosition: preferences.systemSurfacePositions.settings,
      });
    }
  }

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

  const filteredPanelGroups = useMemo(
    () => filterPanelMenuGroups(panelGroups, panelMenuSearchQuery),
    [panelGroups, panelMenuSearchQuery],
  );

  const effectiveCatalogueWidth = Math.min(
    catalogueWidth,
    Math.max(280, catalogueViewportWidth - 32),
  );

  const masonryColumnCount = Math.max(
    1,
    Math.min(6, Math.floor(effectiveCatalogueWidth / 300)),
  );

  const catalogueCanonicalColumns = reconcileCatalogueColumns(
    panelGroups.map((group) => group.module.moduleId),
    6,
    catalogueManualColumns,
    Object.fromEntries(
      panelGroups.map((group) => [
        group.module.moduleId,
        1 + group.panels.length,
      ]),
    ),
  );

  const catalogueColumns = projectCatalogueColumns(
    catalogueCanonicalColumns,
    masonryColumnCount,
  );

  const masonryColumns = catalogueColumns.map((column) =>
    column.flatMap((moduleId) =>
      filteredPanelGroups.filter(
        (group) => group.module.moduleId === moduleId,
      ),
    ),
  );

  function insertCatalogueModule(
    movingId: string,
    visibleColumn: number,
    visibleIndex: number,
  ) {
    if (catalogueLayoutLocked || panelMenuSearchQuery.trim()) {
      return;
    }

    const destination = resolveCatalogueDrop(
      catalogueCanonicalColumns,
      catalogueColumns,
      visibleColumn,
      visibleIndex,
    );

    if (!destination) return;

    const next = moveCatalogueModule(
      catalogueCanonicalColumns,
      movingId,
      destination.column,
      destination.index,
    );

    if (next === catalogueCanonicalColumns) return;

    setCatalogueManualColumns(next);

    try {
      localStorage.setItem(
        "jarri.workspace.core.catalogueColumns.v1",
        JSON.stringify(next),
      );
    } catch {
      // In-memory arrangement still works.
    }

    const nextOrder = mergeCatalogueModuleOrder(
      preferences.panelMenu.moduleOrder,
      panelGroups.map((group) => group.module.moduleId),
      next,
    );

    controller.updatePreferences({
      panelMenu: {
        ...preferences.panelMenu,
        moduleOrder: nextOrder,
      },
    });
  }

  function resetCatalogueDrag() {
    catalogueDragRef.current = null;
    setCatalogueDragId(null);
    setCatalogueDropId(null);
  }

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
    "--workspace-panel-radius": `${preferences.panelRadius}px`,
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

        <CoreOpenPanelSearch
          controller={controller}
          modules={runtime.listModules()}
          onNavigateToPanel={navigateToSearchPanel}
        />

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

          <DeveloperVersionIndicator
            openSettings={openSettingsFromDeveloperIndicator}
          />

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
        className="workspace-shell__floating-panel-menu workspace-shell__floating-panel-menu--right"
        style={{
          right: "16px",
          top: "16px",
        }}
      >
        <div className="panel-menu">
          {panelMenuOpen ? (
            <div
              className="panel-menu__content panel-menu__content--masonry"
              data-workspace-native-occluder
              style={{ width: `${effectiveCatalogueWidth}px` }}
            >
              <div
                className="panel-menu__resize-left"
                role="separator"
                tabIndex={0}
                aria-label="Resize Add Panel"
                aria-orientation="vertical"
                aria-valuemin={280}
                aria-valuemax={Math.max(
                  280,
                  catalogueViewportWidth - 32,
                )}
                aria-valuenow={effectiveCatalogueWidth}
                title="Drag left to expand Add Panel"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;

                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);

                  catalogueResizeRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startWidth: effectiveCatalogueWidth,
                    currentWidth: effectiveCatalogueWidth,
                  };
                }}
                onPointerMove={(event) => {
                  const drag = catalogueResizeRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;

                  const next = clampCatalogueWidth(
                    drag.startWidth + drag.startX - event.clientX,
                  );

                  drag.currentWidth = next;
                  setCatalogueWidth(next);
                }}
                onPointerUp={(event) => {
                  const drag = catalogueResizeRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;

                  const next = clampCatalogueWidth(
                    drag.startWidth + drag.startX - event.clientX,
                  );

                  setCatalogueWidth(next);
                  persistCatalogueWidth(next);

                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }

                  catalogueResizeRef.current = null;
                }}
                onPointerCancel={() => {
                  catalogueResizeRef.current = null;
                }}
                onKeyDown={(event) => {
                  if (
                    event.key !== "ArrowLeft" &&
                    event.key !== "ArrowRight"
                  ) return;

                  event.preventDefault();

                  const next = clampCatalogueWidth(
                    effectiveCatalogueWidth +
                    (event.key === "ArrowLeft" ? 300 : -300),
                  );

                  setCatalogueWidth(next);
                  persistCatalogueWidth(next);
                }}
              />

              <div className="panel-menu__header">
                <strong>Add Panel</strong>

                <div className="panel-menu__header-actions">
                  <button
                    type="button"
                    className="panel-menu__collapse-all"
                    disabled={panelGroups.length === 0}
                    onClick={() =>
                      controller.updatePreferences({
                        panelMenu: {
                          ...preferences.panelMenu,
                          expandedModuleIds: panelGroups.every((group) =>
                            preferences.panelMenu.expandedModuleIds.includes(
                              group.module.moduleId,
                            ),
                          )
                            ? preferences.panelMenu.expandedModuleIds.filter(
                                (id) =>
                                  !panelGroups.some(
                                    (group) => group.module.moduleId === id,
                                  ),
                              )
                            : [
                                ...new Set([
                                  ...preferences.panelMenu.expandedModuleIds,
                                  ...panelGroups.map(
                                    (group) => group.module.moduleId,
                                  ),
                                ]),
                              ],
                        },
                      })
                    }
                  >
                    {panelGroups.length > 0 &&
                    panelGroups.every((group) =>
                      preferences.panelMenu.expandedModuleIds.includes(
                        group.module.moduleId,
                      ),
                    )
                      ? "Collapse all"
                      : "Expand all"}
                  </button>

                  <span
                    className="panel-menu__column-indicator"
                    title="Drag left edge to resize"
                  >
                    {masonryColumnCount} col
                  </span>
                  <button
                    type="button"
                    className="panel-menu__layout-lock"
                    aria-label={
                      catalogueLayoutLocked
                        ? "Unlock module arrangement"
                        : "Lock module arrangement"
                    }
                    aria-pressed={catalogueLayoutLocked}
                    title={
                      catalogueLayoutLocked
                        ? "Unlock module drag-and-drop"
                        : "Lock module drag-and-drop"
                    }
                    onClick={() => {
                      const next = !catalogueLayoutLocked;
                      setCatalogueLayoutLocked(next);
                      resetCatalogueDrag();
                      try {
                        localStorage.setItem(
                          "jarri.workspace.core.catalogueLayoutLocked.v1",
                          String(next),
                        );
                      } catch {
                        // Lock remains functional without storage.
                      }
                    }}
                  >
                    {catalogueLayoutLocked ? "🔒" : "🔓"}
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

              <div className="panel-menu__search">
                <input
                  type="search"
                  value={panelMenuSearchQuery}
                  placeholder="Search panels…"
                  aria-label="Search available panels"
                  onChange={(event) =>
                    setPanelMenuSearchQuery(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setPanelMenuSearchQuery("");
                    }
                  }}
                />
              </div>

              <div className="panel-menu__masonry">
                {masonryColumns.map((column, columnIndex) => (
                  <div
                    className="panel-menu__masonry-column"
                    key={columnIndex}
                  >
                    <div
                      className="panel-menu__masonry-width-probe"
                      aria-hidden="true"
                    >
                      {column.flatMap((group) =>
                        group.panels.map((panel) => (
                          <div
                            className="panel-menu__masonry-width-sample"
                            key={`${panel.moduleId}:${panel.panelType}`}
                          >
                            <strong>{panel.title}</strong>
                            <span>{panel.description}</span>
                          </div>
                        )),
                      )}
                      {column.map((group) => (
                        <div
                          className="panel-menu__masonry-heading-sample"
                          key={group.module.moduleId}
                        >
                          {group.module.title}
                        </div>
                      ))}
                    </div>
                    {column.map((group) => {
                const expanded =
                  Boolean(panelMenuSearchQuery.trim()) ||
                  preferences.panelMenu.expandedModuleIds.includes(
                    group.module.moduleId,
                  );

                return (
                  <section
                    className="panel-menu__group"
                    key={group.module.moduleId}
                    data-dragging={
                      catalogueDragId === group.module.moduleId
                    }
                    data-drop-target={
                      catalogueDropId?.startsWith(
                        `${group.module.moduleId}:`,
                      ) ?? false
                    }
                    onDragOver={(event) => {
                      if (
                        catalogueLayoutLocked ||
                        panelMenuSearchQuery.trim() ||
                        !catalogueDragRef.current
                      ) return;

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";

                      const rect =
                        event.currentTarget.getBoundingClientRect();

                      const side =
                        event.clientY < rect.top + rect.height / 2
                          ? "before" : "after";

                      setCatalogueDropId(
                        `${group.module.moduleId}:${side}`,
                      );
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )) setCatalogueDropId(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (catalogueDragRef.current) {
                        const rect =
                          event.currentTarget.getBoundingClientRect();

                        const after =
                          event.clientY >= rect.top + rect.height / 2;

                        const columnIndex = catalogueColumns.findIndex(
                          (column) =>
                            column.includes(group.module.moduleId),
                        );

                        if (columnIndex >= 0) {
                          const index = catalogueColumns[
                            columnIndex
                          ].indexOf(group.module.moduleId);

                          insertCatalogueModule(
                            catalogueDragRef.current,
                            columnIndex,
                            index + (after ? 1 : 0),
                          );
                        }
                      }

                      resetCatalogueDrag();
                    }}
                  >
                    <div className="panel-menu__group-heading">
                      <span
                        className="panel-menu__drag-grip"
                        role="button"
                        tabIndex={
                          catalogueLayoutLocked ||
                          Boolean(panelMenuSearchQuery.trim())
                            ? -1 : 0
                        }
                        draggable={
                          !catalogueLayoutLocked &&
                          !panelMenuSearchQuery.trim()
                        }
                        aria-label={`Reorder ${group.module.title}`}
                        aria-disabled={
                          catalogueLayoutLocked ||
                          Boolean(panelMenuSearchQuery.trim())
                        }
                        title={
                          catalogueLayoutLocked
                            ? "Unlock to reorder modules"
                            : "Drag or use Arrow Up / Arrow Down"
                        }
                        onDragStart={(event) => {
                          if (
                            catalogueLayoutLocked ||
                            panelMenuSearchQuery.trim()
                          ) {
                            event.preventDefault();
                            return;
                          }
                          catalogueDragRef.current =
                            group.module.moduleId;
                          setCatalogueDragId(group.module.moduleId);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain", group.module.moduleId,
                          );
                        }}
                        onDragEnd={resetCatalogueDrag}
                        onKeyDown={(event) => {
                          if (
                            catalogueLayoutLocked ||
                            panelMenuSearchQuery.trim()
                          ) return;

                          const direction = event.key;

                          if (![
                            "ArrowUp",
                            "ArrowDown",
                            "ArrowLeft",
                            "ArrowRight",
                          ].includes(direction)) return;

                          event.preventDefault();
                          event.stopPropagation();

                          const sourceColumn =
                            catalogueColumns.findIndex((column) =>
                              column.includes(group.module.moduleId),
                            );

                          if (sourceColumn < 0) return;

                          const index =
                            catalogueColumns[sourceColumn].indexOf(
                              group.module.moduleId,
                            );

                          let targetColumn = sourceColumn;
                          let targetIndex = index;

                          if (direction === "ArrowUp") {
                            targetIndex = index - 1;
                          } else if (direction === "ArrowDown") {
                            targetIndex = index + 2;
                          } else {
                            targetColumn +=
                              direction === "ArrowLeft" ? -1 : 1;

                            if (
                              targetColumn < 0 ||
                              targetColumn >= catalogueColumns.length
                            ) return;

                            targetIndex = Math.min(
                              index,
                              catalogueColumns[targetColumn].length,
                            );
                          }

                          if (
                            targetIndex < 0 ||
                            targetIndex >
                              catalogueColumns[targetColumn].length
                          ) return;

                          insertCatalogueModule(
                            group.module.moduleId,
                            targetColumn,
                            targetIndex,
                          );
                        }}
                      >
                        ⋮⋮
                      </span>
                    <button
                      type="button"
                      className="panel-menu__group-toggle"
                      onClick={() => togglePanelMenuModule(group.module.moduleId)}
                      aria-expanded={expanded}
                    >
                      <h2>{group.module.title}</h2>
                      <span>{expanded ? "Collapse" : "Expand"}</span>
                    </button>
                    </div>

                    {expanded ? (
                      <div className="panel-menu__group-panels">
                        {group.panels.map((panel) => (
                          <button
                            key={`${panel.moduleId}:${panel.panelType}`}
                            type="button"
                            className="panel-menu__panel-button"
                            onClick={() => {
                              const panelId = controller.createPanel(
                                panel.moduleId,
                                panel.panelType,
                              );
                              if (panelId) {
                                setPanelMenuSearchQuery("");
                                setPanelMenuOpen(false);
                              }
                            }}
                          >
                            <strong>{panel.title}</strong>
                            <span title={panel.description}>{panel.description}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
                    })}
                    <div
                      className="panel-menu__column-drop"
                      data-drop-target={
                        catalogueDropId ===
                        `column:${columnIndex}`
                      }
                      onDragOver={(event) => {
                        if (
                          catalogueLayoutLocked ||
                          panelMenuSearchQuery.trim() ||
                          !catalogueDragRef.current
                        ) return;

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setCatalogueDropId(
                          `column:${columnIndex}`,
                        );
                      }}
                      onDragLeave={() => setCatalogueDropId(null)}
                      onDrop={(event) => {
                        event.preventDefault();

                        if (catalogueDragRef.current) {
                          insertCatalogueModule(
                            catalogueDragRef.current,
                            columnIndex,
                            catalogueColumns[columnIndex].length,
                          );
                        }

                        resetCatalogueDrag();
                      }}
                    />
                  </div>
                ))}
              </div>
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
        navigationRequest={panelSearchNavigation}
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
