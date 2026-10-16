export type OpenPanelSearchPanel = {
  id: string;
  moduleId: string;
  panelType: string;
  title: string;
  display?: {
    mode?: string;
  };
};

export type OpenPanelSearchTab = {
  id: string;
  title: string;
  panels: OpenPanelSearchPanel[];
};

export type OpenPanelSearchDefinition = {
  moduleId: string;
  panelType: string;
  title: string;
};

export type OpenPanelSearchModule = {
  moduleId: string;
  title: string;
};

export type OpenPanelSearchResult = {
  tabId: string;
  tabTitle: string;
  panelId: string;
  title: string;
  definitionTitle: string;
  moduleId: string;
  moduleTitle: string;
  panelType: string;
  minimized: boolean;
  score: number;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchScore(value: string, query: string, weight: number): number {
  const candidate = normalize(value);

  if (!candidate) return 0;
  if (candidate === query) return weight * 4;
  if (candidate.startsWith(query)) return weight * 3;
  if (candidate.includes(query)) return weight * 2;

  const tokens = query.split(/\s+/).filter(Boolean);

  if (
    tokens.length > 1 &&
    tokens.every((token) => candidate.includes(token))
  ) {
    return weight;
  }

  return 0;
}

export function searchOpenPanels(
  tabs: OpenPanelSearchTab[],
  definitions: OpenPanelSearchDefinition[],
  modules: OpenPanelSearchModule[],
  query: string,
  limit = 12,
): OpenPanelSearchResult[] {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [];
  }

  const moduleTitles = new Map(
    modules.map((module) => [module.moduleId, module.title]),
  );

  const definitionTitles = new Map(
    definitions.map((definition) => [
      `${definition.moduleId}:${definition.panelType}`,
      definition.title,
    ]),
  );

  return tabs
    .flatMap((tab) =>
      tab.panels.map((panel) => {
        const definitionTitle =
          definitionTitles.get(`${panel.moduleId}:${panel.panelType}`) ??
          panel.title;

        const moduleTitle =
          moduleTitles.get(panel.moduleId) ?? panel.moduleId;

        const score =
          matchScore(panel.title, normalizedQuery, 120) +
          matchScore(definitionTitle, normalizedQuery, 100) +
          matchScore(moduleTitle, normalizedQuery, 55) +
          matchScore(panel.panelType, normalizedQuery, 30) +
          matchScore(panel.moduleId, normalizedQuery, 20) +
          matchScore(tab.title, normalizedQuery, 15);

        return {
          tabId: tab.id,
          tabTitle: tab.title,
          panelId: panel.id,
          title: panel.title,
          definitionTitle,
          moduleId: panel.moduleId,
          moduleTitle,
          panelType: panel.panelType,
          minimized: panel.display?.mode === "minimized",
          score,
        };
      }),
    )
    .filter((result) => result.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.title.localeCompare(b.title) ||
        a.tabTitle.localeCompare(b.tabTitle) ||
        a.panelId.localeCompare(b.panelId),
    )
    .slice(0, Math.max(0, limit));
}
