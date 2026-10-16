import { searchOpenPanels } from "./openPanelSearchModel";

const modules = [
  {
    moduleId: "jarri-workspace",
    title: "Jarri Workspace",
  },
  {
    moduleId: "clipboard-register",
    title: "Clipboard",
  },
];

const definitions = [
  {
    moduleId: "jarri-workspace",
    panelType: "file-browser",
    title: "File Browser",
  },
  {
    moduleId: "jarri-workspace",
    panelType: "text-document",
    title: "Text Document",
  },
  {
    moduleId: "clipboard-register",
    panelType: "statistics",
    title: "Clipboard Statistics",
  },
];

const tabs = [
  {
    id: "dev",
    title: "Development",
    panels: [
      {
        id: "file-browser-1",
        moduleId: "jarri-workspace",
        panelType: "file-browser",
        title: "Workspace Source",
      },
      {
        id: "readme",
        moduleId: "jarri-workspace",
        panelType: "text-document",
        title: "README.md",
      },
    ],
  },
  {
    id: "docs",
    title: "Documentation",
    panels: [
      {
        id: "docs-browser",
        moduleId: "jarri-workspace",
        panelType: "file-browser",
        title: "Jarri Docs",
        display: {
          mode: "minimized",
        },
      },
      {
        id: "devlog",
        moduleId: "jarri-workspace",
        panelType: "text-document",
        title: "000112.md",
      },
    ],
  },
  {
    id: "ops",
    title: "Operations",
    panels: [
      {
        id: "clipboard-statistics",
        moduleId: "clipboard-register",
        panelType: "statistics",
        title: "Clipboard Statistics",
      },
    ],
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const empty = searchOpenPanels(tabs, definitions, modules, "");
assert(empty.length === 0, "empty query should return no results");

const docs = searchOpenPanels(
  tabs,
  definitions,
  modules,
  "docs",
);

assert(docs.length === 1, "docs should return one result");
assert(docs[0].panelId === "docs-browser", "docs should find docs-browser");
assert(docs[0].tabId === "docs", "docs result should belong to docs tab");
assert(docs[0].minimized === true, "docs-browser should be minimized");

const documents = searchOpenPanels(
  tabs,
  definitions,
  modules,
  "text document",
);

assert(documents.length === 2, "text document should return both instances");
const documentTabs = new Set(documents.map((result) => result.tabId));
assert(
  documentTabs.has("dev") && documentTabs.has("docs"),
  "text document results should span dev and docs tabs",
);

const clipboard = searchOpenPanels(
  tabs,
  definitions,
  modules,
  "clipboard",
);

assert(clipboard.length === 1, "clipboard should return one result");
assert(
  clipboard[0].tabTitle === "Operations",
  "clipboard result should identify Operations tab",
);

console.log("openPanelSearch.test.ts: PASS");
