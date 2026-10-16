import type {
  PanelDefinition,
  PanelMenuPreferences,
  WorkspaceModuleDefinition,
} from "./types";

export type PanelMenuGroup = {
  module: WorkspaceModuleDefinition;
  panels: PanelDefinition[];
};

export function projectPanelMenuGroups(
  modules: WorkspaceModuleDefinition[],
  panels: PanelDefinition[],
  preferences: PanelMenuPreferences,
): PanelMenuGroup[] {
  const orderIndex = new Map(
    preferences.moduleOrder.map((moduleId, index) => [moduleId, index]),
  );
  const hidden = new Set(preferences.hiddenModuleIds);

  return modules
    .filter((module) => !hidden.has(module.moduleId))
    .sort((a, b) => {
      const aIndex = orderIndex.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.title.localeCompare(b.title);
    })
    .map((module) => {
      const modulePanels = panels.filter((panel) => panel.moduleId === module.moduleId);
      return {
        module,
        panels:
          preferences.panelSort === "title"
            ? [...modulePanels].sort((a, b) => a.title.localeCompare(b.title))
            : modulePanels,
      };
    })
    .filter((group) => group.panels.length > 0);
}

export function isPanelMenuModuleExpanded(
  preferences: PanelMenuPreferences,
  moduleId: string,
) {
  return preferences.expandedModuleIds.includes(moduleId);
}


/**
 * Filter the existing panel-menu projection without changing
 * its module visibility, ordering, or panel ordering.
 */
export function filterPanelMenuGroups(
  groups: PanelMenuGroup[],
  query: string,
): PanelMenuGroup[] {
  const needle = query.trim().toLocaleLowerCase();

  if (!needle) {
    return groups;
  }

  return groups
    .map((group) => {
      const moduleMatches =
        group.module.title.toLocaleLowerCase().includes(needle) ||
        group.module.moduleId.toLocaleLowerCase().includes(needle);

      return {
        ...group,
        panels: group.panels.filter(
          (panel) =>
            moduleMatches ||
            [
              panel.title,
              panel.panelType,
              panel.moduleId,
              panel.category,
            ].some((value) =>
              typeof value === "string" &&
              value.toLocaleLowerCase().includes(needle),
            ),
        ),
      };
    })
    .filter((group) => group.panels.length > 0);
}
