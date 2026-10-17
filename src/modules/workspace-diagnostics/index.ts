import type { WorkspaceModuleDefinition } from "../../core/types";
import { runtimePanelDefinitions } from "./RuntimePanels";

export const workspaceDiagnosticsModule: WorkspaceModuleDefinition = {
  moduleId: "workspace-diagnostics",
  title: "Workspace Diagnostics",
  version: "0.4.0",
  panels: runtimePanelDefinitions,
};
