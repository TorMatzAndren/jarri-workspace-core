/** Exact compatibility aliases for Runtime panels registered before their module split. */
const LEGACY_RUNTIME_PANEL_TYPES = new Set([
  "runtime-diagnostics",
  "runtime-events",
  "runtime-inspector",
]);

export function migrateLegacyRuntimeDiagnosticIdentity(
  moduleId: string,
  panelType: string,
): { moduleId: "workspace-diagnostics"; panelType: string } | null {
  if (moduleId !== "core" || !LEGACY_RUNTIME_PANEL_TYPES.has(panelType)) {
    return null;
  }
  return { moduleId: "workspace-diagnostics", panelType };
}
