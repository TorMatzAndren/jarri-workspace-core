import { bootstrapWorkspaceRuntime as bootstrapCoreWorkspaceRuntime } from "../core/workspaceRuntime";
import { coreModule } from "../panels/corePanels";
import { workspaceDiagnosticsModule } from "../modules/workspace-diagnostics";

export function bootstrapWorkspaceRuntime() {
  return bootstrapCoreWorkspaceRuntime({
    modules: [coreModule, workspaceDiagnosticsModule],
  });
}

export const workspaceRuntime = bootstrapWorkspaceRuntime();
