
import {
  reconcileCatalogueColumns,
  moveCatalogueModule,
  mergeCatalogueModuleOrder,
} from "./panelCatalogueReorder";

function equal(
  actual: unknown,
  expected: unknown,
  label: string,
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }
}

const initial = [
  ["core", "media"],
  ["git", "webradio"],
  ["brain", "terminal"],
];

equal(
  moveCatalogueModule(initial, "git", 2, 1),
  [
    ["core", "media"],
    ["webradio"],
    ["brain", "git", "terminal"],
  ],
  "Cross-column insertion",
);

equal(
  moveCatalogueModule(initial, "core", 1, 0),
  [
    ["media"],
    ["core", "git", "webradio"],
    ["brain", "terminal"],
  ],
  "Insert at start",
);

equal(
  moveCatalogueModule(initial, "git", 1, 2),
  [
    ["core", "media"],
    ["webradio", "git"],
    ["brain", "terminal"],
  ],
  "Move to end of same column",
);

equal(
  moveCatalogueModule(initial, "git", 1, 0),
  initial,
  "Self-drop does not change layout",
);

equal(
  moveCatalogueModule(initial, "missing", 0, 0),
  initial,
  "Unknown module rejected",
);

equal(
  moveCatalogueModule(initial, "core", 7, 0),
  initial,
  "Invalid destination rejected",
);

equal(
  initial,
  [
    ["core", "media"],
    ["git", "webradio"],
    ["brain", "terminal"],
  ],
  "Source remains immutable",
);

equal(
  reconcileCatalogueColumns(
    ["core", "git", "media", "new"],
    3,
    [["core"], ["git"], ["media"]],
    { core: 25, git: 8, media: 2, new: 1 },
  ),
  [["core"], ["git"], ["media", "new"]],
  "New module added to shortest column",
);

equal(
  reconcileCatalogueColumns(
    ["core", "git", "media"],
    2,
    [["core"], ["git"], ["media"]],
  ),
  [["core"], ["git", "media"]],
  "Reducing columns preserves modules",
);

equal(
  mergeCatalogueModuleOrder(
    ["core", "hidden", "git", "media"],
    ["core", "git", "media"],
    [["git"], ["media", "core"]],
  ),
  ["git", "hidden", "media", "core"],
  "Hidden module retains preference slot",
);

console.log("Spatial catalogue tests passed.");
