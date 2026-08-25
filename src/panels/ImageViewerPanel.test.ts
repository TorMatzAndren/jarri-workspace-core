import { shouldReserveLocalWheel } from "../core/panelInteractions";
import { coreModule } from "./corePanels";
import {
  clampImageViewerZoom,
  IMAGE_VIEWER_MAX_ZOOM,
  IMAGE_VIEWER_MIN_ZOOM,
  imageBinaryToDataUrl,
  imageMimeTypeForPath,
  nextImageViewerViewportFromWheel,
  normalizeImageViewerState,
} from "./ImageViewerPanel";

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

function assertClose(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function testNormalizeImageViewerState() {
  assertEqual(
    normalizeImageViewerState({
      resourceUri: "file:///home/dretski/image.png",
    }).resourceUri,
    "file:///home/dretski/image.png",
    "valid image resource URI survives normalization",
  );

  assertEqual(
    normalizeImageViewerState({
      selectedPath: "/home/dretski/image.webp",
    }).resourceUri,
    "file:///home/dretski/image.webp",
    "legacy selectedPath migrates to a resource URI",
  );

  assertEqual(
    normalizeImageViewerState({
      resourceUri: "file:///home/dretski/readme.md",
    }).resourceUri,
    "",
    "non-image resource URI is discarded",
  );

  assertEqual(
    normalizeImageViewerState({
      selectedPath: "relative.png",
    }).resourceUri,
    "",
    "malformed legacy selectedPath is discarded",
  );

  assertEqual(
    normalizeImageViewerState(null).resourceUri,
    "",
    "missing state normalizes to no image",
  );
}

function testNativeImageTransportSemantics() {
  assertEqual(
    imageMimeTypeForPath("/tmp/image.png"),
    "image/png",
    "PNG receives image/png MIME",
  );
  assertEqual(
    imageMimeTypeForPath("/tmp/PHOTO.JPEG"),
    "image/jpeg",
    "JPEG MIME classification is case-insensitive",
  );
  assertEqual(
    imageMimeTypeForPath("/tmp/vector.svg"),
    "image/svg+xml",
    "SVG receives SVG image MIME",
  );
  assertEqual(
    imageMimeTypeForPath("/tmp/readme.md"),
    null,
    "non-image path is rejected by Image Viewer transport",
  );

  assertEqual(
    imageBinaryToDataUrl("/tmp/image.png", "iVBORw0KGgo="),
    "data:image/png;base64,iVBORw0KGgo=",
    "native PNG bytes become an in-memory data URL",
  );
  assertEqual(
    imageBinaryToDataUrl("/tmp/not-image.txt", "YWJj"),
    null,
    "unsupported binary content does not become an image URL",
  );
}

function testZoomBoundsAndPointerAnchoring() {
  assertEqual(
    clampImageViewerZoom(0.01),
    IMAGE_VIEWER_MIN_ZOOM,
    "image zoom clamps to minimum",
  );

  assertEqual(
    clampImageViewerZoom(100),
    IMAGE_VIEWER_MAX_ZOOM,
    "image zoom clamps to maximum",
  );

  const current = { zoom: 1, panX: 0, panY: 0 };
  const next = nextImageViewerViewportFromWheel(
    current,
    -120,
    75,
    80,
    200,
    100,
  );

  assert(next.zoom > 1, "negative wheel delta zooms in");
  assert(next.panX !== 0, "off-center pointer updates horizontal pan");
  assert(next.panY !== 0, "off-center pointer updates vertical pan");

  const clamped = nextImageViewerViewportFromWheel(
    { zoom: IMAGE_VIEWER_MAX_ZOOM, panX: 3, panY: 4 },
    -120,
    75,
    80,
    200,
    100,
  );

  assertClose(
    clamped.zoom,
    IMAGE_VIEWER_MAX_ZOOM,
    "already-max image zoom remains at maximum",
  );
  assertClose(clamped.panX, 3, "clamped zoom preserves pan x");
  assertClose(clamped.panY, 4, "clamped zoom preserves pan y");
}

function testCoreRegistration() {
  const definition = coreModule.panels.find(
    (panel) =>
      panel.moduleId === "core" && panel.panelType === "image-viewer",
  );

  assert(definition, "Image Viewer is registered as a Core panel");
  assertEqual(
    definition.interactionCapabilities?.localWheel,
    true,
    "Image Viewer declares local wheel ownership",
  );
}

function testLocalWheelOwnershipShape() {
  const panelSelector = "[data-workspace-local-wheel=\"true\"]";
  const surfaceSelector =
    "[data-workspace-local-wheel-surface=\"true\"]";

  const imageViewerSurface = {
    closest(selector: string) {
      return selector === panelSelector ? { panel: true } : null;
    },
  };

  const imageContent = {
    closest(selector: string) {
      return selector === surfaceSelector ? imageViewerSurface : null;
    },
  };

  assertEqual(
    shouldReserveLocalWheel({
      ctrlKey: false,
      target: imageContent as unknown as EventTarget,
    }),
    true,
    "ordinary wheel inside Image Viewer local surface is owned locally",
  );

  assertEqual(
    shouldReserveLocalWheel({
      ctrlKey: true,
      target: imageContent as unknown as EventTarget,
    }),
    false,
    "Ctrl+wheel over Image Viewer remains global camera input",
  );
}

testNormalizeImageViewerState();
testNativeImageTransportSemantics();
testZoomBoundsAndPointerAnchoring();
testCoreRegistration();
testLocalWheelOwnershipShape();

console.log("image viewer tests passed");
