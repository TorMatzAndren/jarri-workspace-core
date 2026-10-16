import { bootstrapWorkspaceRuntime as bootstrapCoreWorkspaceRuntime } from "../core/workspaceRuntime";
import { coreModule } from "../panels/corePanels";

export function bootstrapWorkspaceRuntime() {
  return bootstrapCoreWorkspaceRuntime({
    modules: [coreModule],
  });
}

export const workspaceRuntime = bootstrapWorkspaceRuntime();
