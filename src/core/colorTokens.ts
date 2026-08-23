import type { WorkspaceColorTokens } from "./types";

export type WorkspaceColorTokenKey = keyof WorkspaceColorTokens;

export const WORKSPACE_COLOR_FIELDS: ReadonlyArray<{
  key: WorkspaceColorTokenKey;
  label: string;
  cssVariable: string;
}> = [
  { key: "page", label: "Page", cssVariable: "--color-page" },
  { key: "canvas", label: "Canvas", cssVariable: "--color-canvas" },
  { key: "panel", label: "Panel", cssVariable: "--color-panel" },
  {
    key: "panelHeader",
    label: "Panel header",
    cssVariable: "--color-panel-header",
  },
  { key: "text", label: "Text", cssVariable: "--color-text" },
  { key: "muted", label: "Muted text", cssVariable: "--color-muted" },
  { key: "border", label: "Borders", cssVariable: "--color-border" },
  { key: "button", label: "Buttons", cssVariable: "--color-button" },
  { key: "control", label: "Controls", cssVariable: "--color-control" },
  { key: "menu", label: "Menu", cssVariable: "--color-menu" },
];

export const WORKSPACE_COLOR_TOKEN_KEYS =
  WORKSPACE_COLOR_FIELDS.map((field) => field.key);

export function isWorkspaceColorTokenKey(
  value: unknown,
): value is WorkspaceColorTokenKey {
  return (
    typeof value === "string" &&
    WORKSPACE_COLOR_TOKEN_KEYS.includes(value as WorkspaceColorTokenKey)
  );
}

export function workspaceColorField(key: WorkspaceColorTokenKey) {
  return WORKSPACE_COLOR_FIELDS.find((field) => field.key === key)!;
}
