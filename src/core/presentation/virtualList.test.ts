import {
  WORKSPACE_VIRTUAL_LIST_OVERSCAN_VIEWPORTS,
  createVirtualListGeometry,
  selectVirtualListWindow,
} from "./virtualList";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(
  actual: T,
  expected: T,
  message: string,
) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function renderedIndices(
  sizes: readonly number[],
  scrollTop: number,
  viewportSize: number,
  gap = 0,
): string {
  const geometry = createVirtualListGeometry({
    itemSizes: sizes,
    estimatedItemSize: 100,
    gap,
  });

  return selectVirtualListWindow(
    geometry,
    scrollTop,
    viewportSize,
  ).items
    .map((item) => item.index)
    .join(",");
}

function testOverscanPolicyIsExactlyOneViewport() {
  assertEqual(
    WORKSPACE_VIRTUAL_LIST_OVERSCAN_VIEWPORTS,
    1,
    "Core policy retains exactly one viewport of presentation overscan",
  );
}

function testEmptyCollectionProducesEmptyWindow() {
  const geometry = createVirtualListGeometry({
    itemSizes: [],
    estimatedItemSize: 100,
  });

  const window = selectVirtualListWindow(
    geometry,
    0,
    300,
  );

  assertEqual(window.renderedCount, 0, "empty collection renders nothing");
  assertEqual(window.totalSize, 0, "empty collection has zero extent");
}

function testTopRendersVisiblePageAndNextPage() {
  assertEqual(
    renderedIndices(
      Array.from({ length: 10 }, () => 100),
      0,
      200,
    ),
    "0,1,2,3",
    "top of collection renders current and next viewport only",
  );
}

function testMiddleRendersPreviousCurrentAndNextPages() {
  assertEqual(
    renderedIndices(
      Array.from({ length: 10 }, () => 100),
      400,
      200,
    ),
    "2,3,4,5,6,7",
    "middle of collection renders previous current and next viewports",
  );
}

function testBottomRendersPreviousAndCurrentPages() {
  assertEqual(
    renderedIndices(
      Array.from({ length: 10 }, () => 100),
      800,
      200,
    ),
    "6,7,8,9",
    "bottom of collection renders previous and current viewport only",
  );
}

function testVariableHeightItemsUseMeasuredGeometry() {
  assertEqual(
    renderedIndices(
      [50, 150, 80, 220],
      200,
      100,
      10,
    ),
    "1,2,3",
    "variable-height items are selected by physical extent",
  );
}

function testLargeItemCanSpanEntirePresentationWindow() {
  assertEqual(
    renderedIndices(
      [500],
      200,
      100,
    ),
    "0",
    "one large item remains rendered while intersecting presentation window",
  );
}

function testUnknownItemSizeUsesEstimate() {
  const geometry = createVirtualListGeometry({
    itemSizes: [100, null, 200],
    estimatedItemSize: 75,
    gap: 10,
  });

  assertEqual(
    geometry.itemSizes[1],
    75,
    "unknown item uses deterministic estimated size",
  );

  assertEqual(
    geometry.itemOffsets[2],
    195,
    "estimated size participates in following item geometry",
  );

  assertEqual(
    geometry.totalSize,
    395,
    "estimated item contributes to total collection extent",
  );
}

function testRemeasurementChangesFollowingGeometry() {
  const before = createVirtualListGeometry({
    itemSizes: [100, 100, 100],
    estimatedItemSize: 100,
  });

  const after = createVirtualListGeometry({
    itemSizes: [100, 200, 100],
    estimatedItemSize: 100,
  });

  assertEqual(
    before.itemOffsets[2],
    200,
    "initial geometry places third item from initial measurements",
  );

  assertEqual(
    after.itemOffsets[2],
    300,
    "remeasured geometry deterministically moves following item",
  );

  assertEqual(
    after.totalSize,
    400,
    "remeasurement updates total collection extent",
  );
}

function testSourceMeasurementsAreNotMutated() {
  const sizes: Array<number | null> = [100, null, 200];
  const before = JSON.stringify(sizes);

  createVirtualListGeometry({
    itemSizes: sizes,
    estimatedItemSize: 80,
  });

  assert(
    JSON.stringify(sizes) === before,
    "geometry construction does not mutate source measurements",
  );
}

testOverscanPolicyIsExactlyOneViewport();
testEmptyCollectionProducesEmptyWindow();
testTopRendersVisiblePageAndNextPage();
testMiddleRendersPreviousCurrentAndNextPages();
testBottomRendersPreviousAndCurrentPages();
testVariableHeightItemsUseMeasuredGeometry();
testLargeItemCanSpanEntirePresentationWindow();
testUnknownItemSizeUsesEstimate();
testRemeasurementChangesFollowingGeometry();
testSourceMeasurementsAreNotMutated();

console.log(
  "Workspace virtual list geometry contract tests passed.",
);
