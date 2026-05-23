import type { PanelDefinition } from "./types";

export type PanelRegistry = {
  registerPanel: (definition: PanelDefinition) => void;
  getPanel: (moduleId: string, panelType: string) => PanelDefinition | null;
  listPanels: () => PanelDefinition[];
  hasPanel: (moduleId: string, panelType: string) => boolean;
};

function panelKey(moduleId: string, panelType: string) {
  return `${moduleId}:${panelType}`;
}

export function createPanelRegistry(): PanelRegistry {
  const panels = new Map<string, PanelDefinition>();

  return {
    registerPanel(definition) {
      const key = panelKey(definition.moduleId, definition.panelType);
      if (panels.has(key)) {
        throw new Error(`Duplicate panel registration: ${key}`);
      }
      panels.set(key, definition);
    },
    getPanel(moduleId, panelType) {
      return panels.get(panelKey(moduleId, panelType)) ?? null;
    },
    listPanels() {
      return [...panels.values()].sort((a, b) =>
        `${a.category}:${a.title}`.localeCompare(`${b.category}:${b.title}`),
      );
    },
    hasPanel(moduleId, panelType) {
      return panels.has(panelKey(moduleId, panelType));
    },
  };
}

