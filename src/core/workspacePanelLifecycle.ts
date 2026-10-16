import type {
  PanelInstance,
  WorkspaceState,
} from "./types";
import type { PanelLifecycleCapabilities } from "./panelLifecycle";

export type WorkspacePanelLifecycleProjection = Readonly<{
  panelIds: readonly string[];
  activePanelIds: readonly string[];
  capabilitiesByPanelId: Readonly<
    Record<string, Partial<PanelLifecycleCapabilities>>
  >;
}>;

/**
 * Projects actual workspace membership and presentation into lifecycle inputs.
 * A panel is presentation-active when its tab is selected and it is not
 * minimized. Every panel remains a workspace member, including hidden and
 * minimized panels, so generic native-surface reconciliation can remain
 * independent of presentation lifecycle.
 */
export function projectWorkspacePanelLifecycle(
  workspace: Pick<WorkspaceState, "tabs" | "activeTabId">,
  capabilitiesForPanel?: (
    panel: Pick<PanelInstance, "moduleId" | "panelType">,
  ) => Partial<PanelLifecycleCapabilities> | undefined,
): WorkspacePanelLifecycleProjection {
  const members = workspace.tabs.flatMap((tab) => tab.panels);
  const activeTab =
    workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ??
    workspace.tabs[0];
  const capabilitiesByPanelId: Record<
    string,
    Partial<PanelLifecycleCapabilities>
  > = {};

  for (const panel of members) {
    const capabilities = capabilitiesForPanel?.(panel);
    if (capabilities) capabilitiesByPanelId[panel.id] = capabilities;
  }

  return Object.freeze({
    panelIds: Object.freeze(members.map((panel) => panel.id)),
    activePanelIds: Object.freeze(
      (activeTab?.panels ?? [])
        .filter((panel) => panel.display?.mode !== "minimized")
        .map((panel) => panel.id),
    ),
    capabilitiesByPanelId: Object.freeze(capabilitiesByPanelId),
  });
}
