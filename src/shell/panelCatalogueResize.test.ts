import {
  projectCatalogueColumns,
  resolveCatalogueDrop,
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

const canonical = [
  ["a", "b"],
  ["c"],
  ["d", "e"],
  ["f"],
  ["g"],
  ["h"],
];

const folded = projectCatalogueColumns(canonical, 3);

equal(
  folded,
  [
    ["a", "b"],
    ["c"],
    ["d", "e", "f", "g", "h"],
  ],
  "Fold six columns into three",
);

equal(
  projectCatalogueColumns(canonical, 6),
  canonical,
  "Expand restores all six columns",
);

equal(
  projectCatalogueColumns(canonical, 1),
  [["a", "b", "c", "d", "e", "f", "g", "h"]],
  "One-column projection",
);

equal(
  resolveCatalogueDrop(canonical, folded, 2, 3),
  { column: 4, index: 0 },
  "Insert before item in a folded column",
);

equal(
  resolveCatalogueDrop(canonical, folded, 2, 5),
  { column: 5, index: 1 },
  "Append to final canonical column",
);

equal(
  canonical[5],
  ["h"],
  "Canonical layout remains unchanged",
);

console.log("Catalogue resize tests passed.");
