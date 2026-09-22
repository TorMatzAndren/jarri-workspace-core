export type WorkspaceScreenshotCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkspaceCanvasScreenshotSource = {
  element: HTMLElement;
  bounds: WorkspaceScreenshotCanvasBounds;
};

export type WorkspaceScreenshotCompositionLayout = {
  width: number;
  height: number;
  shellWidth: number;
  shellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasX: number;
  canvasY: number;
};

export type WorkspaceScreenshotCaptureMode = "single-shot" | "tiled";

export type WorkspaceScreenshotPreflight = {
  mode: WorkspaceScreenshotCaptureMode;
  tileWidth: number;
  tileHeight: number;
  tileColumns: number;
  tileRows: number;
  tileCount: number;
  totalPixels: number;
};

export const WORKSPACE_SCREENSHOT_TILE_SIZE = 2048;
export const WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_DIMENSION = 4096;
export const WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_PIXELS = 16_000_000;
export const WORKSPACE_SCREENSHOT_NATIVE_MAX_DIMENSION = 32_767;
export const WORKSPACE_SCREENSHOT_NATIVE_MAX_PIXELS = 268_000_000;

export function normalizeWorkspaceCanvasOrigin(
  bounds: Pick<WorkspaceScreenshotCanvasBounds, "x" | "y">,
): { x: number; y: number } {
  return {
    x: -bounds.x,
    y: -bounds.y,
  };
}

function pixelCount(width: number, height: number): number {
  return width * height;
}

function isSafeDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function createWorkspaceScreenshotCompositionLayout(
  shellWidth: number,
  shellHeight: number,
  canvasBounds: WorkspaceScreenshotCanvasBounds,
): WorkspaceScreenshotCompositionLayout {
  const dimensions = [
    shellWidth,
    shellHeight,
    canvasBounds.width,
    canvasBounds.height,
  ];

  if (
    dimensions.some(
      (dimension) => !Number.isFinite(dimension) || dimension <= 0,
    )
  ) {
    throw new Error("Entire Workspace screenshot has invalid dimensions.");
  }

  const normalizedShellWidth = Math.ceil(shellWidth);
  const normalizedShellHeight = Math.ceil(shellHeight);
  const canvasWidth = Math.ceil(canvasBounds.width);
  const canvasHeight = Math.ceil(canvasBounds.height);

  return {
    width: Math.max(normalizedShellWidth, canvasWidth),
    height: normalizedShellHeight + canvasHeight,
    shellWidth: normalizedShellWidth,
    shellHeight: normalizedShellHeight,
    canvasWidth,
    canvasHeight,
    canvasX: 0,
    canvasY: normalizedShellHeight,
  };
}

export function preflightWorkspaceScreenshot(
  layout: WorkspaceScreenshotCompositionLayout,
): WorkspaceScreenshotPreflight {
  const dimensions = [
    layout.width,
    layout.height,
    layout.shellWidth,
    layout.shellHeight,
    layout.canvasWidth,
    layout.canvasHeight,
  ];

  if (dimensions.some((dimension) => !isSafeDimension(dimension))) {
    throw new Error("Entire Workspace screenshot has unsafe native dimensions.");
  }

  const totalPixels = pixelCount(layout.width, layout.height);
  const shellCaptureSafe =
    layout.shellWidth <= WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_DIMENSION &&
    layout.shellHeight <= WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_DIMENSION &&
    pixelCount(layout.shellWidth, layout.shellHeight) <=
      WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_PIXELS;
  if (!shellCaptureSafe) {
    throw new Error(
      "Workspace shell chrome exceeds the bounded capture surface: " +
        layout.shellWidth +
        "×" +
        layout.shellHeight +
        ".",
    );
  }
  if (
    layout.width > WORKSPACE_SCREENSHOT_NATIVE_MAX_DIMENSION ||
    layout.height > WORKSPACE_SCREENSHOT_NATIVE_MAX_DIMENSION ||
    totalPixels > WORKSPACE_SCREENSHOT_NATIVE_MAX_PIXELS
  ) {
    throw new Error(
      "Entire Workspace screenshot is too large for native assembly: " +
        layout.width +
        "×" +
        layout.height +
        " (" +
        totalPixels.toLocaleString() +
        " pixels). Maximum supported size is " +
        WORKSPACE_SCREENSHOT_NATIVE_MAX_DIMENSION +
        "×" +
        WORKSPACE_SCREENSHOT_NATIVE_MAX_DIMENSION +
        " and " +
        WORKSPACE_SCREENSHOT_NATIVE_MAX_PIXELS.toLocaleString() +
        " pixels.",
    );
  }

  const singleShotSafe =
    dimensions.every(
      (dimension) =>
        dimension <= WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_DIMENSION,
    ) &&
    pixelCount(layout.width, layout.height) <=
      WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_PIXELS &&
    pixelCount(layout.canvasWidth, layout.canvasHeight) <=
      WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_PIXELS;

  const tileWidth = Math.min(
    WORKSPACE_SCREENSHOT_TILE_SIZE,
    layout.canvasWidth,
  );
  const tileHeight = Math.min(
    WORKSPACE_SCREENSHOT_TILE_SIZE,
    layout.canvasHeight,
  );
  const tileColumns = Math.ceil(layout.canvasWidth / tileWidth);
  const tileRows = Math.ceil(layout.canvasHeight / tileHeight);

  return {
    mode: singleShotSafe ? "single-shot" : "tiled",
    tileWidth,
    tileHeight,
    tileColumns,
    tileRows,
    tileCount: tileColumns * tileRows,
    totalPixels,
  };
}
