import {
  horizontalScrollbarGeometry,
  shouldShowTabStripScrollbar,
} from "./horizontalScrollbarGeometry";

function assertEqual(actual: number | boolean, expected: number | boolean, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function testNoOverflowAndInvalidGeometryAreHidden() {
  assertEqual(
    horizontalScrollbarGeometry(
      { clientWidth: 500, scrollWidth: 500, scrollLeft: 0 },
      200,
    ).visible,
    false,
    "no overflow hides scrollbar",
  );
  assertEqual(
    horizontalScrollbarGeometry(
      { clientWidth: 0, scrollWidth: 100, scrollLeft: 0 },
      200,
    ).visible,
    false,
    "zero viewport is safe",
  );
  assertEqual(
    horizontalScrollbarGeometry(
      { clientWidth: Number.NaN, scrollWidth: 100, scrollLeft: 0 },
      200,
    ).visible,
    false,
    "invalid viewport is safe",
  );
  assertEqual(
    horizontalScrollbarGeometry(
      { clientWidth: 100, scrollWidth: 200, scrollLeft: 0 },
      Number.NaN,
    ).visible,
    false,
    "invalid track is safe",
  );
  assertEqual(
    horizontalScrollbarGeometry(
      { clientWidth: 100, scrollWidth: 200, scrollLeft: 0 },
      0,
    ).visible,
    false,
    "zero track is safe",
  );
}

function testThumbUsesProportionalGeometryAndTracksScrollPosition() {
  const left = horizontalScrollbarGeometry(
    { clientWidth: 400, scrollWidth: 800, scrollLeft: 0 },
    200,
  );
  assertEqual(left.visible, true, "overflow shows scrollbar");
  assertClose(left.thumbWidth, 100, "thumb width is proportional");
  assertClose(left.thumbLeft, 0, "left edge starts at zero");

  const middle = horizontalScrollbarGeometry(
    { clientWidth: 400, scrollWidth: 800, scrollLeft: 200 },
    200,
  );
  assertClose(middle.thumbLeft, 50, "middle scroll position maps proportionally");

  const right = horizontalScrollbarGeometry(
    { clientWidth: 400, scrollWidth: 800, scrollLeft: 400 },
    200,
  );
  assertClose(right.thumbLeft, 100, "right edge reaches maximum offset");
}

function testMinimumThumbAndScrollOffsetAreClamped() {
  const minimum = horizontalScrollbarGeometry(
    { clientWidth: 10, scrollWidth: 1000, scrollLeft: 0 },
    100,
  );
  assertClose(minimum.thumbWidth, 8, "minimum thumb is eight percent of track");

  const clamped = horizontalScrollbarGeometry(
    { clientWidth: 100, scrollWidth: 300, scrollLeft: 500 },
    120,
  );
  assertClose(clamped.thumbLeft, 80, "scroll offset clamps at track end");
}

function testScrollbarVisibilityHonorsOverflowMode() {
  const overflowing = horizontalScrollbarGeometry(
    { clientWidth: 100, scrollWidth: 200, scrollLeft: 0 },
    100,
  );
  assertEqual(shouldShowTabStripScrollbar("scroll", overflowing), true, "scroll mode shows indicator when overflowing");
  assertEqual(shouldShowTabStripScrollbar("wrap", overflowing), false, "wrap mode never shows indicator");
  assertEqual(
    shouldShowTabStripScrollbar(
      "scroll",
      horizontalScrollbarGeometry(
        { clientWidth: 100, scrollWidth: 100, scrollLeft: 0 },
        100,
      ),
    ),
    false,
    "scroll mode hides indicator without overflow",
  );
}

testNoOverflowAndInvalidGeometryAreHidden();
testThumbUsesProportionalGeometryAndTracksScrollPosition();
testMinimumThumbAndScrollOffsetAreClamped();
testScrollbarVisibilityHonorsOverflowMode();
console.log("Horizontal scrollbar geometry tests passed.");
