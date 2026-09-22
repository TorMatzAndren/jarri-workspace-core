import {
  createWorkspaceScreenshotCompositionLayout,
  normalizeWorkspaceCanvasOrigin,
  preflightWorkspaceScreenshot,
} from "./workspaceScreenshotComposition";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function testWideCanvasDoesNotStretchShellChrome() {
  const layout = createWorkspaceScreenshotCompositionLayout(
    3580,
    180,
    { x: 0, y: 0, width: 10000, height: 7200 },
  );

  assertEqual(layout.width, 10000, "wide canvas determines final width");
  assertEqual(layout.height, 7380, "canvas follows shell chrome vertically");
  assertEqual(layout.shellWidth, 3580, "shell keeps its rendered width");
  assertEqual(layout.canvasX, 0, "normalized canvas starts at the left edge");
  assertEqual(layout.canvasY, 180, "canvas starts after shell chrome");
}

function testNarrowCanvasLeavesShellAsTheWidthOwner() {
  const layout = createWorkspaceScreenshotCompositionLayout(
    3580,
    180,
    { x: 0, y: 0, width: 1200, height: 900 },
  );

  assertEqual(layout.width, 3580, "shell determines final width");
}

function testCanvasOriginNormalizesNegativeAndPositiveBounds() {
  const negativeOrigin = normalizeWorkspaceCanvasOrigin({
    x: -240,
    y: -120,
  });
  const positiveOrigin = normalizeWorkspaceCanvasOrigin({
    x: 64,
    y: 32,
  });

  assertEqual(negativeOrigin.x, 240, "negative x origin is normalized");
  assertEqual(negativeOrigin.y, 120, "negative y origin is normalized");
  assertEqual(positiveOrigin.x, -64, "positive x origin is normalized");
  assertEqual(positiveOrigin.y, -32, "positive y origin is normalized");
}

function testInvalidDimensionsFailInsteadOfCropping() {
  let failed = false;

  try {
    createWorkspaceScreenshotCompositionLayout(
      3580,
      180,
      { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 7200 },
    );
  } catch {
    failed = true;
  }

  assertEqual(failed, true, "invalid canvas bounds are rejected");
}

testWideCanvasDoesNotStretchShellChrome();
testNarrowCanvasLeavesShellAsTheWidthOwner();
testCanvasOriginNormalizesNegativeAndPositiveBounds();
testInvalidDimensionsFailInsteadOfCropping();

function testLargeCanvasSelectsBoundedTiles() {
  const layout = createWorkspaceScreenshotCompositionLayout(
    3580,
    180,
    { x: 0, y: 0, width: 10000, height: 7200 },
  );
  const plan = preflightWorkspaceScreenshot(layout);

  assertEqual(plan.mode, "tiled", "large canvas selects tiled capture");
  assertEqual(plan.tileWidth, 2048, "large capture uses bounded tile width");
  assertEqual(plan.tileHeight, 2048, "large capture uses bounded tile height");
  assertEqual(plan.tileColumns, 5, "tile columns cover the full canvas");
  assertEqual(plan.tileRows, 4, "tile rows cover the full canvas");
  assertEqual(plan.tileCount, 20, "tile metadata includes every tile");
}

function testSmallCanvasKeepsSingleShotPath() {
  const layout = createWorkspaceScreenshotCompositionLayout(
    1600,
    160,
    { x: 0, y: 0, width: 1200, height: 900 },
  );
  const plan = preflightWorkspaceScreenshot(layout);

  assertEqual(plan.mode, "single-shot", "small canvas keeps simple capture");
  assertEqual(plan.tileCount, 1, "single-shot still reports one logical tile");
}

function testOversizedNativeCompositionFailsBeforeCapture() {
  let failed = false;

  try {
    preflightWorkspaceScreenshot(
      createWorkspaceScreenshotCompositionLayout(
        3580,
        180,
        { x: 0, y: 0, width: 20000, height: 20000 },
      ),
    );
  } catch {
    failed = true;
  }

  assertEqual(failed, true, "unsupported native size fails during preflight");
}

testLargeCanvasSelectsBoundedTiles();
testSmallCanvasKeepsSingleShotPath();
testOversizedNativeCompositionFailsBeforeCapture();
