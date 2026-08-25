import {
  imageDimensionsFromBase64,
  preferredImageViewerSizeFromDimensions,
  preferredTextViewerSizeFromContent,
} from "./preferredPanelSize";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function numberValue(value: number | undefined, message: string) {
  assert(typeof value === "number", message);
  return value;
}

function base64(bytes: number[]) {
  return btoa(String.fromCharCode(...bytes));
}

function testImageDimensionsProducePreferredSize() {
  const size = preferredImageViewerSizeFromDimensions({
    width: 640,
    height: 480,
  });

  assert(size, "valid image dimensions produce a preferred size");
  assertEqual(size.width, 664, "image preferred width includes frame allowance");
  assertEqual(size.height, 544, "image preferred height includes frame allowance");
}

function testPngHeaderDimensionsAreParsed() {
  const pngHeader = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x07, 0x80,
    0x00, 0x00, 0x04, 0x38,
  ];

  const dimensions = imageDimensionsFromBase64(
    "/tmp/screenshot.png",
    base64(pngHeader),
  );

  assert(dimensions, "PNG dimensions are parsed from the image header");
  assertEqual(dimensions.width, 1920, "PNG width");
  assertEqual(dimensions.height, 1080, "PNG height");
}

function testTextPreferredSizeScalesWithContent() {
  const short = preferredTextViewerSizeFromContent("one\ntwo\nthree");
  const longLine = preferredTextViewerSizeFromContent(
    "one\n" + "x".repeat(90) + "\nthree",
  );
  const manyLines = preferredTextViewerSizeFromContent(
    Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n"),
  );

  assert(
    numberValue(short.width, "short text width is present") < 900,
    "short text opens narrower than generic default",
  );
  assert(
    numberValue(short.height, "short text height is present") < 640,
    "tiny text proposes a small height before Workspace minimums apply",
  );
  assert(
    numberValue(short.width, "short text width is present") < 460,
    "tiny text proposes a width below Text Viewer panel minimum",
  );
  assert(
    numberValue(short.height, "short text height is present") < 320,
    "tiny text proposes a height below Text Viewer panel minimum",
  );
  assert(
    numberValue(longLine.width, "long-line text width is present") >
      numberValue(short.width, "short text width is present"),
    "long lines increase preferred width",
  );
  assertEqual(
    longLine.height,
    short.height,
    "long lines alone do not increase preferred height",
  );
  assert(
    numberValue(manyLines.height, "many-line text height is present") >
      numberValue(short.height, "short text height is present"),
    "many lines increase preferred height",
  );
}

function testTextPreferredSizeIsNotDocumentCapped() {
  const oldColumnCeiling = preferredTextViewerSizeFromContent(
    "x".repeat(140),
  );
  const beyondOldColumnCeiling = preferredTextViewerSizeFromContent(
    "x".repeat(220),
  );
  const oldLineCeiling = preferredTextViewerSizeFromContent(
    Array.from({ length: 42 }, () => "x").join("\n"),
  );
  const beyondOldLineCeiling = preferredTextViewerSizeFromContent(
    Array.from({ length: 90 }, () => "x").join("\n"),
  );
  const huge = preferredTextViewerSizeFromContent(
    Array.from({ length: 500 }, () => "x".repeat(500)).join("\n"),
  );

  assert(
    numberValue(
      beyondOldColumnCeiling.width,
      "wide text width is present",
    ) > numberValue(oldColumnCeiling.width, "old column-ceiling width is present"),
    "longest line increases preferred width beyond the old 140-column ceiling",
  );
  assert(
    numberValue(
      beyondOldLineCeiling.height,
      "tall text height is present",
    ) > numberValue(oldLineCeiling.height, "old line-ceiling height is present"),
    "line count increases preferred height beyond the old 42-line ceiling",
  );
  assert(
    numberValue(huge.width, "huge text width is present") > 1800,
    "very wide documents may propose dimensions wider than the ordinary Workspace",
  );
  assert(
    numberValue(huge.height, "huge text height is present") > 1100,
    "very tall documents may propose dimensions taller than the ordinary Workspace",
  );
}

testImageDimensionsProducePreferredSize();
testPngHeaderDimensionsAreParsed();
testTextPreferredSizeScalesWithContent();
testTextPreferredSizeIsNotDocumentCapped();

console.log("preferred panel size tests passed");
