import { useEffect, useState } from "react";
import type { useWorkspaceController } from "../core/workspaceController";
import { OpenPanelSearch } from "./OpenPanelSearch";
import type {
  OpenPanelSearchModule,
  OpenPanelSearchResult,
} from "./openPanelSearchModel";

type Controller = ReturnType<typeof useWorkspaceController>;

type NavigationTarget = {
  tabId: string;
  panelId: string;
};

export function CoreOpenPanelSearch({
  controller,
  modules,
  onNavigateToPanel,
}: {
  controller: Controller;
  modules: OpenPanelSearchModule[];
  onNavigateToPanel: (panelId: string) => void;
}) {
  const [target, setTarget] = useState<NavigationTarget | null>(null);

  function navigate(result: OpenPanelSearchResult) {
    setTarget({ tabId: result.tabId, panelId: result.panelId });

    if (controller.workspace.activeTabId !== result.tabId) {
      controller.selectTab(result.tabId);
    }
  }

  useEffect(() => {
    if (!target || controller.workspace.activeTabId !== target.tabId) {
      return;
    }

    const panel = controller.activeTab.panels.find(
      candidate => candidate.id === target.panelId,
    );

    if (!panel) {
      setTarget(null);
      return;
    }

    if (panel.display?.mode === "minimized") {
      controller.togglePanelMinimized(panel.id);
      return;
    }

    controller.focusPanel(panel.id);
    onNavigateToPanel(panel.id);
    setTarget(null);
  }, [
    target,
    controller.workspace.activeTabId,
    controller.activeTab.panels,
    controller.focusPanel,
    controller.togglePanelMinimized,
  ]);

  return (
    <OpenPanelSearch
      tabs={controller.workspace.tabs}
      definitions={controller.availablePanels}
      modules={modules}
      onNavigate={navigate}
    />
  );
}
