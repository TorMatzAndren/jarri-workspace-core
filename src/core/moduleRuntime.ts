import { createPanelRegistry } from "./panelRegistry";
import type {
  PanelDefinition,
  PersistedModuleRecord,
  WorkspaceModuleDefinition,
} from "./types";

export type WorkspaceModuleRuntime = {
  registerModule: (module: WorkspaceModuleDefinition) => void;
  registerPanel: (definition: PanelDefinition) => void;
  registry: ReturnType<typeof createPanelRegistry>;
  listModules: () => WorkspaceModuleDefinition[];
  getModuleRecords: () => PersistedModuleRecord[];
};

export function createWorkspaceModuleRuntime(): WorkspaceModuleRuntime {
  const registry = createPanelRegistry();
  const modules = new Map<string, WorkspaceModuleDefinition>();

  return {
    registry,
    registerModule(module) {
      if (modules.has(module.moduleId)) {
        throw new Error(`Duplicate module registration: ${module.moduleId}`);
      }
      modules.set(module.moduleId, module);
      for (const panel of module.panels) {
        registry.registerPanel(panel);
      }
    },
    registerPanel(definition) {
      registry.registerPanel(definition);
    },
    listModules() {
      return [...modules.values()];
    },
    getModuleRecords() {
      return [...modules.values()].map((module) => ({
        moduleId: module.moduleId,
        version: module.version,
        registeredPanelTypes: module.panels.map((panel) => panel.panelType),
      }));
    },
  };
}

