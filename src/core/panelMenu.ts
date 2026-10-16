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


/**
 * Move a visible module relative to another without removing
 * hidden or temporarily unavailable module IDs.
 *
 * Missing visible IDs are appended before moving. Reordering
 * never changes the available-module projection itself.
 */
export function movePanelMenuModule(
  currentOrder: string[],
  visibleModuleIds: string[],
  movingId: string,
  targetId: string,
): string[] {
  const visible = new Set(visibleModuleIds);

  if (
    movingId === targetId ||
    !visible.has(movingId) ||
    !visible.has(targetId)
  ) {
    return currentOrder;
  }

  const order = [...new Set(currentOrder)];

  for (const id of visibleModuleIds) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  const sourceIndex = order.indexOf(movingId);
  if (sourceIndex < 0) return currentOrder;

  order.splice(sourceIndex, 1);

  const targetIndex = order.indexOf(targetId);
  if (targetIndex < 0) return currentOrder;

  order.splice(targetIndex, 0, movingId);

  return order.every((id, index) => id === currentOrder[index]) &&
    order.length === currentOrder.length
    ? currentOrder
    : order;
}
