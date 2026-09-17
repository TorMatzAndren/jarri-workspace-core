import { bootstrapWorkspaceRuntime as bootstrapCoreWorkspaceRuntime } from "../core/workspaceRuntime";
import { coreModule } from "../panels/corePanels";
import { demoModule } from "../panels/demoModule";

export function bootstrapWorkspaceRuntime() {
  return bootstrapCoreWorkspaceRuntime({
    modules: [coreModule, demoModule],
  });
}

export const workspaceRuntime = bootstrapWorkspaceRuntime();
