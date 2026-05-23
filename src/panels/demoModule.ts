import type { WorkspaceModuleDefinition } from "../core/types";
import { demoPanelDefinitions } from "./demoPanels";

export const demoModule: WorkspaceModuleDefinition = {
  moduleId: "demo",
  title: "Workspace Core Demo",
  version: "1.0.0",
  panels: demoPanelDefinitions,
};

