import { createPanelLifecycleCoordinator } from "./panelLifecycleCoordinator";
import { projectWorkspacePanelLifecycle } from "./workspacePanelLifecycle";
import type { PanelInstance, WorkspaceState } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function panel(id: string, mode: "normal" | "minimized" = "normal"): PanelInstance {
  return {
    id,
    moduleId: id === "missing" ? "unavailable-module" : "test",
    panelType: "example",
    title: id,
    geometry: { x: 0, y: 0, width: 300, height: 200 },
    focusOrder: 0,
    stateVersion: 1,
    panelState: { unchanged: true },
    dirty: {
      isDirty: true,
      reason: "Unsaved test data",
      canSave: true,
      canDiscard: true,
    },
    display: { mode },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const workspace = {
  schemaVersion: 2,
  workspaceId: "workspace",
  activeTabId: "first",
  tabs: [
    { id: "first", panels: [panel("visible"), panel("minimized", "minimized"), panel("missing")] },
    { id: "second", panels: [panel("background")] },
  ],
  preferences: {} as WorkspaceState["preferences"],
  surfacePresentationMemory: {},
} as WorkspaceState;

const lifecycle = projectWorkspacePanelLifecycle(workspace, (item) =>
  item.moduleId === "test" ? { runtimeRetention: "keep-alive" } : undefined,
);
assert(lifecycle.panelIds.join(",") === "visible,minimized,missing,background", "all tabs and minimized panels remain members");
assert(lifecycle.activePanelIds.join(",") === "visible,missing", "active tab excludes minimized panel from presentation-active set");
assert(lifecycle.capabilitiesByPanelId.visible?.runtimeRetention === "keep-alive", "panel definition policies flow into lifecycle registration");
assert(!lifecycle.capabilitiesByPanelId.missing, "missing definitions safely use Core defaults");

const coordinator = createPanelLifecycleCoordinator();
coordinator.reconcilePanels(lifecycle.panelIds, lifecycle.capabilitiesByPanelId);
coordinator.reconcileActivePanels(lifecycle.activePanelIds);
assert(coordinator.getPanelState("missing") === "active", "unavailable module panels remain recoverable workspace members");
assert(coordinator.getPanelState("minimized") === "framed", "never activated minimized panel remains framed");
assert(coordinator.getSnapshot().panels.background.state === "framed", "inactive tab panel remains registered");
assert(coordinator.getSnapshot().panels.visible.capabilities.runtimeRetention === "keep-alive", "declared retention policy is exposed without executing it");

const restoredWorkspace = { ...workspace, tabs: workspace.tabs.map((tab) => ({
  ...tab,
  panels: tab.panels.map((item) => item.id === "minimized" ? panel(item.id) : item),
})) };
const restored = projectWorkspacePanelLifecycle(restoredWorkspace);
coordinator.reconcilePanels(restored.panelIds, restored.capabilitiesByPanelId);
coordinator.reconcileActivePanels(restored.activePanelIds);
assert(coordinator.getPanelState("minimized") === "active", "restore reactivates the panel body without mutating persisted panel data");
assert(workspace.tabs[0].panels[1].display?.mode === "minimized", "lifecycle projection leaves source workspace state untouched");
assert(workspace.tabs[0].panels[0].dirty?.isDirty, "lifecycle reconciliation preserves dirty panel state");

const switched = projectWorkspacePanelLifecycle({ ...workspace, activeTabId: "second" });
coordinator.reconcilePanels(switched.panelIds, switched.capabilitiesByPanelId);
coordinator.reconcileActivePanels(switched.activePanelIds);
assert(coordinator.getPanelState("background") === "active", "active tab switch activates its panel");
assert(coordinator.getPanelState("visible") === "suspended", "previous tab panel suspends");
assert(switched.panelIds.includes("background"), "hidden native-hosted panel identity remains in workspace membership");
coordinator.dispose();

console.log("Workspace panel-lifecycle workspace integration tests passed.");
