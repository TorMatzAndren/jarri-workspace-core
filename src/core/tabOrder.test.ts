import { insertionIndexFromStripRects, reorderWorkspaceTabs } from "./tabOrder";
import type { WorkspaceState, WorkspaceTab } from "./types";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const tabs = ["a", "b", "c"].map((id) => ({ id, title: id })) as WorkspaceTab[];
const workspace = { tabs, activeTabId: "b" } as WorkspaceState;

function testReorderMovesLeftAndPreservesTabObjectsAndActiveId() {
  const reordered = reorderWorkspaceTabs(workspace, "c", 0);
  assertEqual(reordered.tabs.map((tab) => tab.id).join(","), "c,a,b", "left reorder");
  assertEqual(reordered.activeTabId, "b", "active tab remains unchanged");
  assertEqual(reordered.tabs[0], tabs[2], "tab object is reused");
  assertEqual(reordered.tabs[1], tabs[0], "other tab object is reused");
}

function testReorderMovesRightAndInvalidIdsAreNoOps() {
  const reordered = reorderWorkspaceTabs(workspace, "a", 3);
  assertEqual(reordered.tabs.map((tab) => tab.id).join(","), "b,c,a", "right reorder");
  assertEqual(reorderWorkspaceTabs(workspace, "missing", 1), workspace, "missing tab is safe");
  assertEqual(reorderWorkspaceTabs(workspace, "a", Number.NaN), workspace, "invalid slot is safe");
  assertEqual(reorderWorkspaceTabs(workspace, "b", 2), workspace, "insertion across the tab's own slot is a no-op");
}

function testPointerMapsToLogicalSlotsForRowsAndEdges() {
  const rects = [
    { left: 0, right: 40, top: 0, bottom: 30 },
    { left: 44, right: 84, top: 0, bottom: 30 },
    { left: 0, right: 40, top: 34, bottom: 64 },
    { left: 44, right: 84, top: 34, bottom: 64 },
  ];
  assertEqual(insertionIndexFromStripRects(rects, -4, 12), 0, "first slot");
  assertEqual(insertionIndexFromStripRects(rects, 70, 12), 2, "middle slot");
  assertEqual(insertionIndexFromStripRects(rects, 90, 50), 4, "last wrapped row slot");
  assertEqual(insertionIndexFromStripRects([], 0, 0), 0, "empty strip slot");
}

testReorderMovesLeftAndPreservesTabObjectsAndActiveId();
testReorderMovesRightAndInvalidIdsAreNoOps();
testPointerMapsToLogicalSlotsForRowsAndEdges();
console.log("Workspace tab order tests passed.");
