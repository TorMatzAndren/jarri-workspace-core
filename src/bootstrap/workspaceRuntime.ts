import { bootstrapWorkspaceRuntime as bootstrapCoreWorkspaceRuntime } from "../core/workspaceRuntime";
import { coreModule } from "../panels/corePanels";
import { demoModule } from "../panels/demoModule";
import { steamModule } from "../modules/steam/module";

export function bootstrapWorkspaceRuntime() {
  return bootstrapCoreWorkspaceRuntime({
    modules: [coreModule, demoModule, steamModule],
  });
}

export const workspaceRuntime = bootstrapWorkspaceRuntime();
