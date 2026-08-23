import {
  cameraOriginFromScroll,
  clampScroll,
  logicalPointAtViewport,
  logicalViewportFromScroll,
  nextCanvasScaleFromWheel,
  panelNavigationAnchor,
  scrollDeltaForCanvasOriginChange,
  scrollForCameraOrigin,
  scrollForAnchor,
  zoomAnchorForMode,
} from "./cameraMath";
import type { PanelInstance, WorkspaceCanvasBounds } from "./types";

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

const bounds: WorkspaceCanvasBounds = {
  x: -480,
  y: -240,
  width: 1800,
  height: 1100,
};

const viewport = {
  width: 1000,
  height: 800,
};

const scroll = {
  scrollLeft: 1250,
  scrollTop: 1020,
};

const panels: PanelInstance[] = [
  {
    id: "first",
    moduleId: "test",
    panelType: "panel",
    title: "First",
    geometry: {
      x: 120,
      y: 96,
      width: 300,
      height: 200,
      minWidth: 120,
      minHeight: 120,
    },
    focusOrder: 1,
    stateVersion: 1,
    panelState: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  },
  {
    id: "focused",
    moduleId: "test",
    panelType: "panel",
    title: "Focused",
    geometry: {
      x: 720,
      y: 360,
      width: 480,
      height: 240,
      minWidth: 120,
      minHeight: 120,
    },
    focusOrder: 2,
    stateVersion: 1,
    panelState: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  },
];

function testLogicalViewportPreservesNegativeOrigin() {
  const logical = logicalViewportFromScroll(bounds, viewport, scroll, 2);

  assertClose(logical.x, -355, "viewport x includes negative canvas origin");
  assertClose(logical.y, -130, "viewport y includes negative canvas origin");
  assertClose(logical.width, 500, "viewport width is camera-scaled");
  assertClose(logical.height, 400, "viewport height is camera-scaled");
}

function testPointerZoomAnchorRoundTripsThroughScroll() {
  const anchor = zoomAnchorForMode({
    mode: "pointer",
    panels,
    pointer: { x: 250, y: 320 },
    bounds,
    viewport,
    scroll,
    canvasScale: 2,
  });

  assertClose(anchor.logicalX, -230, "pointer anchor logical x");
  assertClose(anchor.logicalY, 30, "pointer anchor logical y");
  assertEqual(anchor.viewportX, 250, "pointer anchor viewport x");
  assertEqual(anchor.viewportY, 320, "pointer anchor viewport y");

  const nextScroll = scrollForAnchor(anchor, bounds, viewport, 1);
  const logicalAfterZoom = logicalPointAtViewport(
    anchor.viewportX,
    anchor.viewportY,
    bounds,
    viewport,
    nextScroll,
    1,
  );

  assertClose(
    logicalAfterZoom.x,
    anchor.logicalX,
    "anchor-preserving zoom scroll keeps logical x under pointer",
  );
  assertClose(
    logicalAfterZoom.y,
    anchor.logicalY,
    "anchor-preserving zoom scroll keeps logical y under pointer",
  );
}

function testActivePanelAnchorUsesFocusedPanelOnlyForNavigationMath() {
  const anchor = zoomAnchorForMode({
    mode: "active-panel-center",
    panels,
    pointer: { x: 0, y: 0 },
    bounds,
    viewport,
    scroll,
    canvasScale: 1,
  });

  assertEqual(anchor.logicalX, 960, "active panel center x");
  assertEqual(anchor.logicalY, 480, "active panel center y");
  assertEqual(anchor.viewportX, 500, "active panel center viewport x");
  assertEqual(anchor.viewportY, 400, "active panel center viewport y");
}

function testPanelNavigationAlignment() {
  const center = panelNavigationAnchor(
    panels[1],
    "panel-center",
    viewport,
  );
  const topLeft = panelNavigationAnchor(
    panels[1],
    "panel-top-left",
    viewport,
  );

  assertEqual(center.logicalX, 960, "panel-center logical x");
  assertEqual(center.logicalY, 480, "panel-center logical y");
  assertEqual(center.viewportX, 500, "panel-center viewport x");
  assertEqual(center.viewportY, 400, "panel-center viewport y");
  assertEqual(topLeft.logicalX, 720, "panel-top-left logical x");
  assertEqual(topLeft.logicalY, 360, "panel-top-left logical y");
  assertEqual(topLeft.viewportX, 0, "panel-top-left viewport x");
  assertEqual(topLeft.viewportY, 0, "panel-top-left viewport y");
}

function testOriginCompensationUsesCanvasScale() {
  const delta = scrollDeltaForCanvasOriginChange(
    { x: 0, y: 0 },
    { x: -240, y: -120 },
    1.5,
  );

  assertEqual(delta.scrollLeft, 360, "origin x compensation is scaled");
  assertEqual(delta.scrollTop, 180, "origin y compensation is scaled");
}

function testCameraOriginRestoresIndependentOfViewportSize() {
  const camera = {
    x: 320,
    y: 180,
  };
  const temporaryViewport = {
    width: 1,
    height: 1,
  };
  const finalViewport = {
    width: 1440,
    height: 900,
  };

  const temporaryScroll = scrollForCameraOrigin(
    camera,
    bounds,
    temporaryViewport,
    1.25,
  );
  const finalScroll = scrollForCameraOrigin(
    camera,
    bounds,
    finalViewport,
    1.25,
  );

  const temporaryRestored = cameraOriginFromScroll(
    bounds,
    temporaryViewport,
    temporaryScroll,
    1.25,
  );
  const finalRestored = cameraOriginFromScroll(
    bounds,
    finalViewport,
    finalScroll,
    1.25,
  );

  assertClose(temporaryRestored.x, camera.x, "temporary viewport restores camera x");
  assertClose(temporaryRestored.y, camera.y, "temporary viewport restores camera y");
  assertClose(finalRestored.x, camera.x, "final viewport restores camera x");
  assertClose(finalRestored.y, camera.y, "final viewport restores camera y");
}

function testCameraOriginPreservesGutterAndNegativeCanvasOrigin() {
  const negativeBounds = {
    x: -960,
    y: -480,
    width: 3000,
    height: 2200,
  };
  const camera = {
    x: -720,
    y: -300,
  };
  const scaledViewport = {
    width: 1200,
    height: 720,
  };
  const scale = 1.5;

  const scroll = scrollForCameraOrigin(
    camera,
    negativeBounds,
    scaledViewport,
    scale,
  );
  const restored = cameraOriginFromScroll(
    negativeBounds,
    scaledViewport,
    scroll,
    scale,
  );

  assertClose(scroll.scrollLeft, 1560, "scroll includes horizontal camera gutter");
  assertClose(scroll.scrollTop, 990, "scroll includes vertical camera gutter");
  assertClose(restored.x, camera.x, "negative-origin camera x round-trips");
  assertClose(restored.y, camera.y, "negative-origin camera y round-trips");
}

function testScaleAndScrollClamps() {
  assertClose(
    nextCanvasScaleFromWheel(1, -1, 10),
    1.1,
    "wheel up zooms in by configured increment",
  );
  assertClose(
    nextCanvasScaleFromWheel(1.1, 1, 10),
    1,
    "wheel down zooms out by configured increment",
  );
  assertEqual(
    nextCanvasScaleFromWheel(2, -1, 10),
    2,
    "canvas scale clamps high",
  );
  assertEqual(
    nextCanvasScaleFromWheel(0.25, 1, 10),
    0.25,
    "canvas scale clamps low",
  );

  const clamped = clampScroll(
    { scrollLeft: -10, scrollTop: 900 },
    { scrollLeft: 500, scrollTop: 600 },
  );

  assertEqual(clamped.scrollLeft, 0, "scroll clamps low");
  assertEqual(clamped.scrollTop, 600, "scroll clamps high");
}

testLogicalViewportPreservesNegativeOrigin();
testPointerZoomAnchorRoundTripsThroughScroll();
testActivePanelAnchorUsesFocusedPanelOnlyForNavigationMath();
testPanelNavigationAlignment();
testOriginCompensationUsesCanvasScale();
testCameraOriginRestoresIndependentOfViewportSize();
testCameraOriginPreservesGutterAndNegativeCanvasOrigin();
testScaleAndScrollClamps();

console.log("workspace camera math tests passed");
