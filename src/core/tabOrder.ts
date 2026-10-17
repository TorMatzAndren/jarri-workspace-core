import type { WorkspaceState } from "./types";

export type StripItemRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Move a tab to a logical insertion slot without changing tab identities or contents. */
export function reorderWorkspaceTabs(
  workspace: WorkspaceState,
  tabId: string,
  insertionIndex: number,
): WorkspaceState {
  const fromIndex = workspace.tabs.findIndex((tab) => tab.id === tabId);
  if (fromIndex < 0 || !Number.isFinite(insertionIndex)) return workspace;

  const tabs = [...workspace.tabs];
  const [tab] = tabs.splice(fromIndex, 1);
  const slot = Math.max(0, Math.min(workspace.tabs.length, Math.floor(insertionIndex)));
  const targetIndex = Math.max(0, Math.min(tabs.length, slot - (slot > fromIndex ? 1 : 0)));
  if (targetIndex === fromIndex) return workspace;
  tabs.splice(targetIndex, 0, tab);
  return { ...workspace, tabs };
}

/**
 * Convert a pointer coordinate into a linear insertion slot. Wrapped strips
 * are grouped by row geometry, then the chosen row is scanned left to right.
 */
export function insertionIndexFromStripRects(
  rects: StripItemRect[],
  x: number,
  y: number,
): number {
  if (rects.length === 0) return 0;

  const rows: Array<{ top: number; bottom: number; entries: Array<{ index: number; rect: StripItemRect }> }> = [];
  rects.forEach((rect, index) => {
    let row = rows.find((candidate) =>
      Math.abs((candidate.top + candidate.bottom) / 2 - (rect.top + rect.bottom) / 2) < 2,
    );
    if (!row) {
      row = { top: rect.top, bottom: rect.bottom, entries: [] };
      rows.push(row);
    }
    row.top = Math.min(row.top, rect.top);
    row.bottom = Math.max(row.bottom, rect.bottom);
    row.entries.push({ index, rect });
  });

  const nearestRow = rows.reduce((best, row) => {
    const distance = y < row.top ? row.top - y : y > row.bottom ? y - row.bottom : 0;
    const bestDistance = y < best.top ? best.top - y : y > best.bottom ? y - best.bottom : 0;
    return distance < bestDistance ? row : best;
  });
  nearestRow.entries.sort((a, b) => a.rect.left - b.rect.left);
  for (const entry of nearestRow.entries) {
    if (x < (entry.rect.left + entry.rect.right) / 2) return entry.index;
  }
  return nearestRow.entries[nearestRow.entries.length - 1].index + 1;
}
