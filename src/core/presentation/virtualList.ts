export const WORKSPACE_VIRTUAL_LIST_OVERSCAN_VIEWPORTS = 1;

export type VirtualListGeometry = {
  itemCount: number;
  itemOffsets: readonly number[];
  itemSizes: readonly number[];
  totalSize: number;
  gap: number;
};

export type VirtualListWindowItem = {
  index: number;
  top: number;
  size: number;
};

export type VirtualListWindow = {
  startIndex: number;
  endIndexExclusive: number;
  renderedCount: number;
  renderStart: number;
  renderEnd: number;
  totalSize: number;
  items: readonly VirtualListWindowItem[];
};

export function isNewVirtualListScrollRequest(
  previousRequest: unknown,
  nextRequest: unknown,
): boolean {
  return nextRequest != null && !Object.is(previousRequest, nextRequest);
}

export type CreateVirtualListGeometryOptions = {
  itemSizes: readonly (number | null | undefined)[];
  estimatedItemSize: number;
  gap?: number;
};

function finiteNonnegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createVirtualListGeometry({
  itemSizes,
  estimatedItemSize,
  gap = 0,
}: CreateVirtualListGeometryOptions): VirtualListGeometry {
  const safeEstimatedItemSize =
    finitePositive(estimatedItemSize, 1);
  const safeGap = finiteNonnegative(gap);

  const resolvedSizes = itemSizes.map((size) =>
    typeof size === "number"
      ? finitePositive(size, safeEstimatedItemSize)
      : safeEstimatedItemSize,
  );

  const itemOffsets = new Array<number>(resolvedSizes.length);

  let offset = 0;

  for (let index = 0; index < resolvedSizes.length; index += 1) {
    itemOffsets[index] = offset;
    offset += resolvedSizes[index];

    if (index < resolvedSizes.length - 1) {
      offset += safeGap;
    }
  }

  return {
    itemCount: resolvedSizes.length,
    itemOffsets,
    itemSizes: resolvedSizes,
    totalSize: offset,
    gap: safeGap,
  };
}

function firstItemEndingAfter(
  geometry: VirtualListGeometry,
  position: number,
): number {
  let low = 0;
  let high = geometry.itemCount;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const end =
      geometry.itemOffsets[middle] +
      geometry.itemSizes[middle];

    if (end > position) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

function firstItemStartingAtOrAfter(
  geometry: VirtualListGeometry,
  position: number,
): number {
  let low = 0;
  let high = geometry.itemCount;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (geometry.itemOffsets[middle] >= position) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

export function selectVirtualListWindow(
  geometry: VirtualListGeometry,
  scrollTop: number,
  viewportSize: number,
): VirtualListWindow {
  const safeScrollTop = finiteNonnegative(scrollTop);
  const safeViewportSize = finiteNonnegative(viewportSize);

  if (
    geometry.itemCount === 0 ||
    geometry.totalSize <= 0 ||
    safeViewportSize <= 0
  ) {
    return {
      startIndex: 0,
      endIndexExclusive: 0,
      renderedCount: 0,
      renderStart: 0,
      renderEnd: 0,
      totalSize: geometry.totalSize,
      items: [],
    };
  }

  const overscanSize =
    safeViewportSize *
    WORKSPACE_VIRTUAL_LIST_OVERSCAN_VIEWPORTS;

  const visibleStart = Math.min(
    safeScrollTop,
    geometry.totalSize,
  );
  const visibleEnd = Math.min(
    geometry.totalSize,
    safeScrollTop + safeViewportSize,
  );

  const renderStart = Math.max(
    0,
    visibleStart - overscanSize,
  );
  const renderEnd = Math.min(
    geometry.totalSize,
    visibleEnd + overscanSize,
  );

  const startIndex =
    firstItemEndingAfter(geometry, renderStart);
  const endIndexExclusive =
    firstItemStartingAtOrAfter(geometry, renderEnd);

  const items: VirtualListWindowItem[] = [];

  for (
    let index = startIndex;
    index < endIndexExclusive;
    index += 1
  ) {
    items.push({
      index,
      top: geometry.itemOffsets[index],
      size: geometry.itemSizes[index],
    });
  }

  return {
    startIndex,
    endIndexExclusive,
    renderedCount: items.length,
    renderStart,
    renderEnd,
    totalSize: geometry.totalSize,
    items,
  };
}
