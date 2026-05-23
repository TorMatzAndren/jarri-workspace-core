import { useEffect, useMemo, useState } from "react";
import { createId, nowIso } from "../core/id";
import {
  createDefaultWorkspace,
  loadWorkspace,
  resetWorkspaceStorage,
  saveWorkspace,
} from "../core/layoutPersistence";
import type { PanelGeometry, PanelInstance, WorkspaceState } from "../core/types";
import { registry } from "../panels/registry";
import { TabBar } from "../tabs/TabBar";
import { WorkspaceCanvas } from "../workspace/WorkspaceCanvas";

function nextFocusOrder(panels: PanelInstance[]) {
  return Math.max(0, ...panels.map((panel) => panel.focusOrder)) + 1;
}

export function WorkspaceShell() {
  const [initialReport] = useState(() => loadWorkspace());
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialReport.state);
  const activeTab = useMemo(
    () =>
      workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ??
      workspace.tabs[0],
    [workspace],
  );

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  function updateActiveTab(mutator: (panels: PanelInstance[]) => PanelInstance[]) {
    const now = nowIso();
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.id === current.activeTabId
          ? { ...tab, panels: mutator(tab.panels), updatedAt: now }
          : tab,
      ),
    }));
  }

  function addPanel(moduleId: string, panelType: string) {
    const definition = registry.getPanel(moduleId, panelType);
    if (!definition) {
      return;
    }

    const now = nowIso();
    updateActiveTab((panels) => [
      ...panels,
      {
        id: createId("panel"),
        moduleId,
        panelType,
        title: definition.title,
        geometry: {
          ...definition.defaultGeometry,
          x: definition.defaultGeometry.x + panels.length * 24,
          y: definition.defaultGeometry.y + panels.length * 24,
          minWidth: definition.minGeometry.width,
          minHeight: definition.minGeometry.height,
        },
        focusOrder: nextFocusOrder(panels),
        stateVersion: definition.stateVersion,
        panelState: definition.createInitialState({ now }),
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  function createTab() {
    const now = nowIso();
    const id = createId("tab");
    setWorkspace((current) => ({
      ...current,
      activeTabId: id,
      tabs: [
        ...current.tabs,
        {
          id,
          title: `Tab ${current.tabs.length + 1}`,
          panels: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  }

  function closeTab(tabId: string) {
    setWorkspace((current) => {
      if (current.tabs.length <= 1) {
        return current;
      }
      const tabs = current.tabs.filter((tab) => tab.id !== tabId);
      return {
        ...current,
        tabs,
        activeTabId:
          current.activeTabId === tabId ? tabs[0]?.id ?? null : current.activeTabId,
      };
    });
  }

  function focusPanel(panelId: string) {
    updateActiveTab((panels) => {
      const nextFocus = nextFocusOrder(panels);
      return panels.map((panel) =>
        panel.id === panelId ? { ...panel, focusOrder: nextFocus } : panel,
      );
    });
  }

  function closePanel(panelId: string) {
    updateActiveTab((panels) => panels.filter((panel) => panel.id !== panelId));
  }

  function updateGeometry(panelId: string, geometry: PanelGeometry) {
    const now = nowIso();
    updateActiveTab((panels) =>
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, geometry, updatedAt: now } : panel,
      ),
    );
  }

  function updatePanelState(panelId: string, panelState: unknown) {
    const now = nowIso();
    updateActiveTab((panels) =>
      panels.map((panel) =>
        panel.id === panelId ? { ...panel, panelState, updatedAt: now } : panel,
      ),
    );
  }

  function resetLayout() {
    resetWorkspaceStorage();
    setWorkspace(createDefaultWorkspace());
  }

  const panels = registry.listPanels().filter((panel) => panel.moduleId !== "core");

  return (
    <main className="workspace-shell">
      <header className="workspace-shell__header">
        <div>
          <span className="eyebrow">Jarri Workspace Core</span>
          <h1>Reusable Projection Workspace</h1>
        </div>
        <div className="workspace-shell__truth">
          <span>Schema v{workspace.schemaVersion}</span>
          <span>{initialReport.report.repaired ? "layout repaired" : "layout clean"}</span>
          <span>truth/advisory separated</span>
        </div>
      </header>

      <TabBar
        tabs={workspace.tabs}
        activeTabId={workspace.activeTabId}
        onSelectTab={(tabId) => setWorkspace((current) => ({ ...current, activeTabId: tabId }))}
        onCreateTab={createTab}
        onCloseTab={closeTab}
      />

      <section className="workspace-shell__actions">
        <div className="panel-picker">
          {panels.map((panel) => (
            <button
              key={`${panel.moduleId}:${panel.panelType}`}
              type="button"
              onClick={() => addPanel(panel.moduleId, panel.panelType)}
            >
              + {panel.title}
            </button>
          ))}
        </div>
        <button type="button" className="reset-button" onClick={resetLayout}>
          Reset Layout
        </button>
      </section>

      <WorkspaceCanvas
        title={activeTab.title}
        panels={activeTab.panels}
        onFocusPanel={focusPanel}
        onClosePanel={closePanel}
        onGeometryChange={updateGeometry}
        onPanelStateChange={updatePanelState}
      />
    </main>
  );
}

