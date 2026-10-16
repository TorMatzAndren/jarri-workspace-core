import {
  filterPanelMenuGroups,
  type PanelMenuGroup,
} from "./panelMenu";

function assert(condition: boolean, label: string) {
  if (!condition) {
    throw new Error(label);
  }
}

const groups = [
  {
    module: { moduleId: "core", title: "Workspace Core" },
    panels: [
      {
        moduleId: "core",
        panelType: "calendar",
        title: "Calendar",
        category: "Utility",
      },
      {
        moduleId: "core",
        panelType: "settings",
        title: "Settings",
        category: "System",
      },
    ],
  },
  {
    module: { moduleId: "example", title: "Example Module" },
    panels: [
      {
        moduleId: "example",
        panelType: "chart",
        title: "Chart",
        category: "Visual",
      },
    ],
  },
] as unknown as PanelMenuGroup[];

assert(
  filterPanelMenuGroups(groups, "") === groups,
  "empty query preserves original projection",
);

assert(
  filterPanelMenuGroups(groups, "  ") === groups,
  "whitespace query preserves original projection",
);

const calendar = filterPanelMenuGroups(groups, "CALENDAR");

assert(
  calendar.length === 1 &&
    calendar[0].panels.length === 1 &&
    calendar[0].panels[0].panelType === "calendar",
  "case-insensitive panel title matching",
);

const moduleResults = filterPanelMenuGroups(
  groups,
  "workspace core",
);

assert(
  moduleResults.length === 1 &&
    moduleResults[0].panels.length === 2,
  "matching module includes its panels",
);

const categoryResults = filterPanelMenuGroups(
  groups,
  "visual",
);

assert(
  categoryResults.length === 1 &&
    categoryResults[0].panels[0].panelType === "chart",
  "category matching",
);

const typeResults = filterPanelMenuGroups(groups, "settings");

assert(
  typeResults.length === 1 &&
    typeResults[0].panels[0].panelType === "settings",
  "panel type matching",
);

assert(
  filterPanelMenuGroups(groups, "does-not-exist").length === 0,
  "unknown query produces no results",
);

assert(
  groups[0].panels.length === 2 &&
    groups[1].panels.length === 1,
  "filtering does not mutate existing groups",
);

console.log("Add Panel search tests passed.");
