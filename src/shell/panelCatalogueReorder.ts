
export type CatalogueColumns = string[][];

export function reconcileCatalogueColumns(
  visibleIds: readonly string[],
  countInput: number,
  saved: unknown,
  weights: Readonly<Record<string, number>> = {},
): CatalogueColumns {
  const count = Math.max(
    1,
    Math.min(6, Math.floor(countInput) || 1),
  );

  const result: CatalogueColumns =
    Array.from({ length: count }, () => []);

  const allowed = new Set(visibleIds);
  const seen = new Set<string>();

  if (Array.isArray(saved)) {
    saved.forEach((column, sourceIndex) => {
      if (!Array.isArray(column)) return;

      const target = Math.min(sourceIndex, count - 1);

      for (const id of column) {
        if (
          typeof id === "string" &&
          allowed.has(id) &&
          !seen.has(id)
        ) {
          result[target].push(id);
          seen.add(id);
        }
      }
    });
  }

  for (const id of visibleIds) {
    if (seen.has(id)) continue;

    let shortest = 0;
    let minimum = Number.POSITIVE_INFINITY;

    result.forEach((column, index) => {
      const height = column.reduce(
        (sum, item) =>
          sum + Math.max(1, weights[item] ?? 1),
        0,
      );

      if (height < minimum) {
        minimum = height;
        shortest = index;
      }
    });

    result[shortest].push(id);
    seen.add(id);
  }

  return result;
}

export function moveCatalogueModule(
  source: readonly (readonly string[])[],
  moduleId: string,
  targetColumn: number,
  targetIndex: number,
): CatalogueColumns {
  if (
    !Number.isInteger(targetColumn) ||
    targetColumn < 0 ||
    targetColumn >= source.length
  ) {
    return source as CatalogueColumns;
  }

  const sourceColumn = source.findIndex((column) =>
    column.includes(moduleId),
  );

  if (sourceColumn === -1) {
    return source as CatalogueColumns;
  }

  const originalIndex =
    source[sourceColumn].indexOf(moduleId);

  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex > source[targetColumn].length
  ) {
    return source as CatalogueColumns;
  }

  const next = source.map((column) => [...column]);

  next[sourceColumn].splice(originalIndex, 1);

  let insertionIndex = targetIndex;

  // Drop indices describe positions BEFORE source removal.
  if (
    sourceColumn === targetColumn &&
    originalIndex < targetIndex
  ) {
    insertionIndex--;
  }

  next[targetColumn].splice(
    insertionIndex,
    0,
    moduleId,
  );

  if (JSON.stringify(next) === JSON.stringify(source)) {
    return source as CatalogueColumns;
  }

  return next;
}

export function mergeCatalogueModuleOrder(
  existing: readonly string[],
  visibleIds: readonly string[],
  columns: readonly (readonly string[])[],
): string[] {
  const visible = new Set(visibleIds);
  const ordered = [...new Set(
    columns.flat().filter((id) => visible.has(id)),
  )];

  for (const id of visibleIds) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  let cursor = 0;

  const result = existing.map((id) =>
    visible.has(id) ? ordered[cursor++] : id,
  );

  while (cursor < ordered.length) {
    result.push(ordered[cursor++]);
  }

  return result;
}


/**
 * Present canonical columns at a smaller column count.
 * Never mutate the underlying arrangement.
 */
export function projectCatalogueColumns(
  canonical: readonly (readonly string[])[],
  requestedCount: number,
): string[][] {
  const count = Math.max(
    1,
    Math.min(
      canonical.length || 1,
      Math.floor(requestedCount) || 1,
    ),
  );

  const result: string[][] =
    Array.from({ length: count }, () => []);

  canonical.forEach((column, index) => {
    result[Math.min(index, count - 1)].push(...column);
  });

  return result;
}

/**
 * Convert a visible insertion point into canonical coordinates.
 */
export function resolveCatalogueDrop(
  canonical: readonly (readonly string[])[],
  visible: readonly (readonly string[])[],
  visibleColumn: number,
  visibleIndex: number,
): { column: number; index: number } | null {
  const items = visible[visibleColumn];

  if (
    !items ||
    visibleIndex < 0 ||
    visibleIndex > items.length
  ) {
    return null;
  }

  const following = items[visibleIndex];

  if (following !== undefined) {
    const column = canonical.findIndex((list) =>
      list.includes(following),
    );
    if (column < 0) return null;

    return {
      column,
      index: canonical[column].indexOf(following),
    };
  }

  const last = items[items.length - 1];

  if (last !== undefined) {
    const column = canonical.findIndex((list) =>
      list.includes(last),
    );
    if (column < 0) return null;

    return {
      column,
      index: canonical[column].indexOf(last) + 1,
    };
  }

  if (visibleColumn >= canonical.length) return null;

  return {
    column: visibleColumn,
    index: canonical[visibleColumn].length,
  };
}
