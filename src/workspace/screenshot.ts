import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { domToBlob } from "modern-screenshot";
import {
  createWorkspaceScreenshotCompositionLayout,
  preflightWorkspaceScreenshot,
  type WorkspaceScreenshotCanvasBounds,
  type WorkspaceScreenshotPreflight,
} from "./workspaceScreenshotComposition";

export type WorkspaceScreenshotTarget =
  | {
      kind: "workspace";
      element: HTMLElement;
      width: number;
      height: number;
    }
  | {
      kind: "frame";
      element: HTMLElement;
    }
  | {
      kind: "entire-workspace";
      shellElement: HTMLElement;
      chromeElements: readonly HTMLElement[];
      canvasElement: HTMLElement;
      canvasBounds: WorkspaceScreenshotCanvasBounds;
      onProgress?: (message: string) => void;
    };

type WorkspaceFrameScreenshotRequest = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function screenshotNodeFilter(node: Node): boolean {
  if (!(node instanceof Element)) {
    return true;
  }

  if (node.classList.contains("workspace-canvas__resize-handle")) {
    return false;
  }

  if (node.closest("[data-workspace-screenshot-exclude]")) {
    return false;
  }

  /*
   * DevChron commit markers contain invisible SVG <title> metadata.
   * Large chronologies have previously caused modern-screenshot /
   * WebKitGTK rasterization to collapse to a black image when those
   * nodes are serialized.
   *
   * They contribute no visible pixels, so logical Workspace screenshot
   * capture excludes them consistently.
   */
  if (
    node.tagName.toLowerCase() === "title" &&
    node.closest(".development-chronology-panel__svg")
  ) {
    return false;
  }

  return true;
}

async function renderLogicalWorkspaceScreenshot(
  target: Extract<WorkspaceScreenshotTarget, { kind: "workspace" }>,
): Promise<Blob> {
  if (target.element.dataset.wallpaperRendered === "true") {
    const sourceShell = target.element.closest<HTMLElement>(".workspace-shell");
    if (!sourceShell) throw new Error("Workspace screenshot could not resolve theme owner.");
    const themeHost = createScreenshotThemeHost(sourceShell, target.width, target.height);
    const replica = target.element.cloneNode(true) as HTMLElement;
    synchronizeCaptureReplica(target.element, replica);
    // Logical captures keep their established canvas crop, excluding the viewport backdrop.
    replica.removeAttribute("data-wallpaper-rendered");
    replica.style.position = "relative";
    replica.style.left = "0";
    replica.style.top = "0";
    replica.style.width = `${target.width}px`;
    replica.style.height = `${target.height}px`;
    replica.style.margin = "0";
    replica.style.transform = "none";
    replica.style.transformOrigin = "top left";
    replica.style.pointerEvents = "none";
    themeHost.appendChild(replica);
    const staging = document.createElement("div");
    staging.style.cssText = `position:absolute;left:0;top:${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.scrollY + window.innerHeight) + 64}px;width:${target.width}px;height:${target.height}px;overflow:visible;margin:0;padding:0;pointer-events:none;z-index:-2147483647`;
    staging.appendChild(themeHost);
    document.body.appendChild(staging);
    try {
      await waitForCaptureLayout();
      const captured = await domToBlob(themeHost, {
        width: target.width, height: target.height, scale: 1,
        style: { transform: "none", transformOrigin: "top left" },
        filter: screenshotNodeFilter,
        features: { copyScrollbar: true, removeAbnormalAttributes: true, removeControlCharacter: true, fixSvgXmlDecode: true, restoreScrollPosition: true },
      });
      if (!captured) throw new Error("Workspace screenshot produced no image data.");
      return captured;
    } finally {
      staging.remove();
    }
  }
  const captured = await domToBlob(target.element, {
    width: target.width,
    height: target.height,
    style: {
      transform: "none",
      transformOrigin: "top left",
    },
    scale: 1,
    filter: screenshotNodeFilter,
    features: {
      copyScrollbar: true,
      removeAbnormalAttributes: true,
      removeControlCharacter: true,
      fixSvgXmlDecode: true,
      restoreScrollPosition: true,
    },
  });

  if (!captured) {
    throw new Error("Workspace screenshot produced no image data.");
  }

  return captured;
}

type WorkspaceScreenshotTile = {
  x: number;
  y: number;
  width: number;
  height: number;
  png: number[];
};

function screenshotNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function reportScreenshotProgress(
  onProgress: ((message: string) => void) | undefined,
  message: string,
): void {
  onProgress?.(message);
  console.info("[Workspace screenshot] " + message);
}

async function timedScreenshotStage<T>(
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = screenshotNow();
  console.info("[Workspace screenshot] " + label + " started");
  try {
    return await action();
  } finally {
    console.info(
      "[Workspace screenshot] " +
        label +
        " finished in " +
        Math.round(screenshotNow() - startedAt) +
        "ms",
    );
  }
}

async function renderLogicalWorkspaceTileScreenshot(
  target: {
    element: HTMLElement;
    bounds: WorkspaceScreenshotCanvasBounds;
  },
  tile: Pick<WorkspaceScreenshotTile, "x" | "y" | "width" | "height">,
): Promise<Blob> {
  const sourceShell = target.element.closest<HTMLElement>(".workspace-shell");
  if (!sourceShell) {
    throw new Error("Workspace tile screenshot could not resolve theme owner.");
  }

  const themeHost = createScreenshotThemeHost(
    sourceShell,
    tile.width,
    tile.height,
  );
  const viewport = document.createElement("div");
  viewport.className = "workspace-canvas__surface";
  viewport.style.position = "relative";
  viewport.style.width = tile.width + "px";
  viewport.style.height = tile.height + "px";
  viewport.style.minWidth = tile.width + "px";
  viewport.style.minHeight = tile.height + "px";
  viewport.style.overflow = "hidden";
  viewport.style.margin = "0";
  viewport.style.padding = "0";

  const replica = target.element.cloneNode(true) as HTMLElement;
  synchronizeCaptureReplica(target.element, replica);
  replica.removeAttribute("data-wallpaper-rendered");
  replica.style.position = "absolute";
  replica.style.left = -tile.x + "px";
  replica.style.top = -tile.y + "px";
  replica.style.width = target.bounds.width + "px";
  replica.style.height = target.bounds.height + "px";
  replica.style.margin = "0";
  replica.style.transform = "none";
  replica.style.transformOrigin = "top left";
  replica.style.pointerEvents = "none";
  viewport.appendChild(replica);
  themeHost.appendChild(viewport);

  const staging = document.createElement("div");
  staging.setAttribute("data-workspace-canvas-tile-capture", "true");
  const stagingTop =
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.scrollY + window.innerHeight,
    ) + 64;
  staging.style.position = "absolute";
  staging.style.left = "0";
  staging.style.top = stagingTop + "px";
  staging.style.width = tile.width + "px";
  staging.style.height = tile.height + "px";
  staging.style.overflow = "visible";
  staging.style.margin = "0";
  staging.style.padding = "0";
  staging.style.pointerEvents = "none";
  staging.style.zIndex = "-2147483647";
  staging.appendChild(themeHost);
  document.body.appendChild(staging);

  try {
    await waitForCaptureLayout();
    await waitForCaptureImages(themeHost);
    const captured = await domToBlob(themeHost, {
      width: tile.width,
      height: tile.height,
      style: {
        transform: "none",
        transformOrigin: "top left",
      },
      scale: 1,
      filter: screenshotNodeFilter,
      features: {
        copyScrollbar: true,
        removeAbnormalAttributes: true,
        removeControlCharacter: true,
        fixSvgXmlDecode: true,
        restoreScrollPosition: true,
      },
    });
    if (!captured) {
      throw new Error("Workspace canvas tile produced no image data.");
    }
    return captured;
  } finally {
    staging.remove();
  }
}
async function waitForCaptureLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function synchronizeCaptureReplica(
  source: HTMLElement,
  replica: HTMLElement,
): void {
  const sourceInputs = source.querySelectorAll("input");
  const replicaInputs = replica.querySelectorAll("input");

  sourceInputs.forEach((input, index) => {
    const clone = replicaInputs.item(index);

    if (!(clone instanceof HTMLInputElement)) {
      return;
    }

    clone.value = input.value;
    clone.checked = input.checked;
  });

  const sourceTextareas = source.querySelectorAll("textarea");
  const replicaTextareas = replica.querySelectorAll("textarea");

  sourceTextareas.forEach((textarea, index) => {
    const clone = replicaTextareas.item(index);

    if (clone instanceof HTMLTextAreaElement) {
      clone.value = textarea.value;
      clone.textContent = textarea.value;
    }
  });

  const sourceSelects = source.querySelectorAll("select");
  const replicaSelects = replica.querySelectorAll("select");

  sourceSelects.forEach((select, index) => {
    const clone = replicaSelects.item(index);

    if (clone instanceof HTMLSelectElement) {
      clone.value = select.value;
    }
  });

  const sourceCanvases = source.querySelectorAll("canvas");
  const replicaCanvases = replica.querySelectorAll("canvas");

  sourceCanvases.forEach((canvas, index) => {
    const clone = replicaCanvases.item(index);

    if (!(clone instanceof HTMLCanvasElement)) {
      return;
    }

    clone.width = canvas.width;
    clone.height = canvas.height;

    const context = clone.getContext("2d");
    if (context) {
      context.drawImage(canvas, 0, 0);
    }
  });

  const sourceScrollers = [
    source,
    ...Array.from(source.querySelectorAll<HTMLElement>("*")),
  ];

  const replicaScrollers = [
    replica,
    ...Array.from(replica.querySelectorAll<HTMLElement>("*")),
  ];

  sourceScrollers.forEach((element, index) => {
    const clone = replicaScrollers[index];

    if (!clone) {
      return;
    }

    clone.scrollLeft = element.scrollLeft;
    clone.scrollTop = element.scrollTop;
  });
}

function hideScreenshotExcludedNodes(replica: HTMLElement): void {
  if (replica.matches("[data-workspace-screenshot-exclude]")) {
    replica.style.visibility = "hidden";
    return;
  }

  replica
    .querySelectorAll<HTMLElement>("[data-workspace-screenshot-exclude]")
    .forEach((element) => {
      element.style.visibility = "hidden";
    });
}

async function waitForCaptureImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(
    images.map(async (image) => {
      if (!image.src) {
        return;
      }

      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error(`Screenshot image failed to load: ${image.src}`)),
            { once: true },
          );
        });
      }

      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        throw new Error(`Screenshot image has no rendered dimensions: ${image.src}`);
      }
    }),
  );
}
function createScreenshotThemeHost(
  sourceShell: HTMLElement,
  width: number,
  height: number,
): HTMLElement {
  const themeHost = document.createElement("div");
  themeHost.className = sourceShell.className;

  for (const attribute of sourceShell.attributes) {
    if (attribute.name === "class" || attribute.name === "style") {
      continue;
    }

    themeHost.setAttribute(attribute.name, attribute.value);
  }

  const sourceStyle = window.getComputedStyle(sourceShell);
  for (const property of sourceStyle) {
    if (!property.startsWith("--")) {
      continue;
    }

    const value = sourceStyle.getPropertyValue(property);
    if (value) {
      themeHost.style.setProperty(property, value);
    }
  }

  themeHost.style.position = "relative";
  themeHost.style.display = "block";
  themeHost.style.width = `${width}px`;
  themeHost.style.height = `${height}px`;
  themeHost.style.minWidth = "0";
  themeHost.style.minHeight = "0";
  themeHost.style.overflow = "hidden";
  themeHost.style.margin = "0";
  themeHost.style.padding = "0";
  themeHost.style.backgroundColor = sourceStyle.backgroundColor;
  themeHost.style.color = sourceStyle.color;
  themeHost.style.fontFamily = sourceStyle.fontFamily;
  themeHost.style.fontSize = sourceStyle.fontSize;

  return themeHost;
}

type ChromePlacement = {
  element: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
};

function measureShellChromeScreenshot(
  shellElement: HTMLElement,
  chromeElements: readonly HTMLElement[],
): { width: number; height: number; placements: ChromePlacement[] } {
  const shellRect = shellElement.getBoundingClientRect();
  const width = Math.ceil(shellRect.width);
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error("Workspace shell screenshot has invalid width.");
  }
  const placements: ChromePlacement[] = chromeElements.map((element) => {
    if (!shellElement.contains(element)) {
      throw new Error("Workspace shell screenshot target is outside the shell root.");
    }
    const rect = element.getBoundingClientRect();
    return {
      element,
      left: rect.left - shellRect.left,
      top: rect.top - shellRect.top,
      width: rect.width,
      height: rect.height,
    };
  });
  const height = Math.ceil(
    Math.max(
      0,
      ...placements.map((placement) => placement.top + placement.height),
    ),
  );
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Workspace shell screenshot has invalid height.");
  }
  return { width, height, placements };
}
async function renderShellChromeScreenshot(
  shellElement: HTMLElement,
  chromeElements: readonly HTMLElement[],
): Promise<{ blob: Blob; width: number; height: number }> {
  const measurement = measureShellChromeScreenshot(shellElement, chromeElements);
  const { width, height, placements } = measurement;
  const themeHost = createScreenshotThemeHost(shellElement, width, height);
  const staging = document.createElement("div");
  staging.setAttribute("data-workspace-shell-capture-replica", "true");

  const stagingTop =
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.scrollY + window.innerHeight,
    ) + 64;

  staging.style.position = "absolute";
  staging.style.left = "0";
  staging.style.top = `${stagingTop}px`;
  staging.style.width = `${width}px`;
  staging.style.height = `${height}px`;
  staging.style.overflow = "visible";
  staging.style.margin = "0";
  staging.style.padding = "0";
  staging.style.pointerEvents = "none";
  staging.style.zIndex = "-2147483647";

  for (const placement of placements) {
    const replica = placement.element.cloneNode(true) as HTMLElement;
    synchronizeCaptureReplica(placement.element, replica);
    hideScreenshotExcludedNodes(replica);
    replica.style.position = "absolute";
    replica.style.left = `${placement.left}px`;
    replica.style.top = `${placement.top}px`;
    replica.style.width = `${placement.width}px`;
    replica.style.height = `${placement.height}px`;
    replica.style.margin = "0";
    replica.style.pointerEvents = "none";
    themeHost.appendChild(replica);
  }

  themeHost.style.position = "relative";
  themeHost.style.display = "block";
  themeHost.style.width = `${width}px`;
  themeHost.style.height = `${height}px`;
  themeHost.style.margin = "0";
  themeHost.style.padding = "0";
  themeHost.style.overflow = "hidden";

  staging.appendChild(themeHost);
  document.body.appendChild(staging);

  try {
    await waitForCaptureLayout();
    await waitForCaptureImages(themeHost);

    const captured = await domToBlob(themeHost, {
      width,
      height,
      style: {
        transform: "none",
        transformOrigin: "top left",
      },
      scale: 1,
      features: {
        copyScrollbar: true,
        removeAbnormalAttributes: true,
        removeControlCharacter: true,
        fixSvgXmlDecode: true,
        restoreScrollPosition: true,
      },
    });

    if (!captured) {
      throw new Error("Workspace shell screenshot produced no image data.");
    }

    return { blob: captured, width, height };
  } finally {
    staging.remove();
  }
}

function decodeScreenshotBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    const objectUrl = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Screenshot image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

function readScreenshotBackgroundRgba(
  sourceShell: HTMLElement,
): [number, number, number, number] {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context = probe.getContext("2d");
  if (!context) {
    return [0, 0, 0, 0];
  }
  context.fillStyle = window.getComputedStyle(sourceShell).backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return [pixel[0], pixel[1], pixel[2], pixel[3]];
}

async function composeSingleShotWorkspaceScreenshot(
  shellBlob: Blob,
  canvasBlob: Blob,
  layout: ReturnType<typeof createWorkspaceScreenshotCompositionLayout>,
  sourceShell: HTMLElement,
  onProgress: ((message: string) => void) | undefined,
): Promise<Uint8Array> {
  let shellImage: HTMLImageElement | null = null;
  let canvasImage: HTMLImageElement | null = null;
  let outputCanvas: HTMLCanvasElement | null = null;
  try {
    [shellImage, canvasImage] = await Promise.all([
      decodeScreenshotBlob(shellBlob),
      decodeScreenshotBlob(canvasBlob),
    ]);
    if (
      shellImage.naturalWidth !== layout.shellWidth ||
      shellImage.naturalHeight !== layout.shellHeight
    ) {
      throw new Error("Shell chrome rendered at an unexpected size.");
    }
    if (
      canvasImage.naturalWidth !== layout.canvasWidth ||
      canvasImage.naturalHeight !== layout.canvasHeight
    ) {
      throw new Error("Logical canvas rendered at an unexpected size.");
    }

    reportScreenshotProgress(onProgress, "Composing final image…");
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = layout.width;
    outputCanvas.height = layout.height;
    const context = outputCanvas.getContext("2d");
    if (!context) {
      throw new Error("Native-size image surface could not be created.");
    }
    context.fillStyle = window.getComputedStyle(sourceShell).backgroundColor;
    context.fillRect(0, 0, layout.width, layout.height);
    context.drawImage(shellImage, 0, 0);
    context.drawImage(canvasImage, layout.canvasX, layout.canvasY);

    reportScreenshotProgress(onProgress, "Encoding PNG…");
    const composed = await new Promise<Blob | null>((resolve) => {
      outputCanvas?.toBlob(resolve, "image/png");
    });
    if (!composed || composed.size === 0) {
      throw new Error("Native-size PNG encoding returned no image data.");
    }
    return new Uint8Array(await composed.arrayBuffer());
  } finally {
    shellImage = null;
    canvasImage = null;
    if (outputCanvas) {
      outputCanvas.width = 0;
      outputCanvas.height = 0;
    }
  }
}

async function composeTiledWorkspaceScreenshot(
  shellBlob: Blob,
  target: Extract<WorkspaceScreenshotTarget, { kind: "entire-workspace" }>,
  layout: ReturnType<typeof createWorkspaceScreenshotCompositionLayout>,
  plan: WorkspaceScreenshotPreflight,
): Promise<Uint8Array> {
  const tiles: WorkspaceScreenshotTile[] = [];
  const onProgress = target.onProgress;
  let tileNumber = 0;
  for (let row = 0; row < plan.tileRows; row += 1) {
    for (let column = 0; column < plan.tileColumns; column += 1) {
      tileNumber += 1;
      const x = column * plan.tileWidth;
      const y = row * plan.tileHeight;
      const width = Math.min(plan.tileWidth, layout.canvasWidth - x);
      const height = Math.min(plan.tileHeight, layout.canvasHeight - y);
      reportScreenshotProgress(
        onProgress,
        "Capturing canvas tile " + tileNumber + "/" + plan.tileCount + "…",
      );
      const tileBlob = await timedScreenshotStage(
        "canvas tile " + tileNumber + "/" + plan.tileCount,
        () =>
          renderLogicalWorkspaceTileScreenshot(
            {
              element: target.canvasElement,
              bounds: target.canvasBounds,
            },
            { x, y, width, height },
          ),
      );
      tiles.push({
        x,
        y,
        width,
        height,
        png: Array.from(new Uint8Array(await tileBlob.arrayBuffer())),
      });
    }
  }

  reportScreenshotProgress(onProgress, "Composing final image and encoding PNG…");
  const shellPng = Array.from(new Uint8Array(await shellBlob.arrayBuffer()));
  const nativeRequest = {
    width: layout.width,
    height: layout.height,
    canvasWidth: layout.canvasWidth,
    canvasHeight: layout.canvasHeight,
    canvasX: layout.canvasX,
    canvasY: layout.canvasY,
    backgroundRgba: readScreenshotBackgroundRgba(target.shellElement),
    shellPng,
    tiles,
  };
  return Uint8Array.from(
    await timedScreenshotStage(
      "native composition and PNG encode",
      () =>
        invoke<number[]>("workspace_compose_entire_workspace_screenshot", {
          request: nativeRequest,
        }),
    ),
  );
}

async function renderEntireWorkspaceScreenshot(
  target: Extract<WorkspaceScreenshotTarget, { kind: "entire-workspace" }>,
): Promise<Uint8Array> {
  const onProgress = target.onProgress;
  reportScreenshotProgress(onProgress, "Preparing screenshot…");
  const shellRect = target.shellElement.getBoundingClientRect();
  const shellMeasurement = measureShellChromeScreenshot(
    target.shellElement,
    target.chromeElements,
  );
  const layout = createWorkspaceScreenshotCompositionLayout(
    shellRect.width,
    shellMeasurement.height,
    target.canvasBounds,
  );
  const plan = preflightWorkspaceScreenshot(layout);
  console.info(
    "[Workspace screenshot] dimensions " +
      layout.width +
      "x" +
      layout.height +
      ", pixels=" +
      plan.totalPixels +
      ", mode=" +
      plan.mode +
      ", tiles=" +
      plan.tileWidth +
      "x" +
      plan.tileHeight +
      ", grid=" +
      plan.tileColumns +
      "x" +
      plan.tileRows +
      ", count=" +
      plan.tileCount,
  );
  reportScreenshotProgress(onProgress, "Capturing shell chrome…");
  const shellChrome = await timedScreenshotStage(
    "shell capture",
    () => renderShellChromeScreenshot(target.shellElement, target.chromeElements),
  );
  if (plan.mode === "single-shot") {
    reportScreenshotProgress(onProgress, "Capturing logical canvas…");
    const canvasBlob = await timedScreenshotStage(
      "canvas capture",
      () =>
        renderLogicalWorkspaceScreenshot({
          kind: "workspace",
          element: target.canvasElement,
          width: layout.canvasWidth,
          height: layout.canvasHeight,
        }),
    );
    return composeSingleShotWorkspaceScreenshot(
      shellChrome.blob,
      canvasBlob,
      layout,
      target.shellElement,
      onProgress,
    );
  }

  return composeTiledWorkspaceScreenshot(shellChrome.blob, target, layout, plan);
}
async function renderNativeFrameScreenshot(
  target: Extract<WorkspaceScreenshotTarget, { kind: "frame" }>,
): Promise<Uint8Array> {
  const frame = target.element;
  const width = Math.ceil(frame.offsetWidth);
  const height = Math.ceil(frame.offsetHeight);

  if (
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new Error("Frame screenshot has invalid frame geometry.");
  }

  const replica = frame.cloneNode(true) as HTMLElement;
  synchronizeCaptureReplica(frame, replica);

  const sourceShell = frame.closest<HTMLElement>(".workspace-shell");
  if (!sourceShell) {
    throw new Error(
      "Frame screenshot could not resolve Workspace theme owner.",
    );
  }

  const themeHost = document.createElement("div");
  themeHost.className = sourceShell.className;

  for (const attribute of sourceShell.attributes) {
    if (
      attribute.name === "class" ||
      attribute.name === "style"
    ) {
      continue;
    }

    themeHost.setAttribute(attribute.name, attribute.value);
  }

  /*
   * Copy the Workspace-owned custom properties that establish active
   * theme/font/density presentation without inheriting shell geometry.
   */
  const sourceShellStyle = window.getComputedStyle(sourceShell);

  for (const property of sourceShellStyle) {
    if (property.startsWith("--")) {
      const value = sourceShellStyle.getPropertyValue(property);

      if (value) {
        themeHost.style.setProperty(property, value);
      }
    }
  }

  const staging = document.createElement("div");
  staging.setAttribute(
    "data-workspace-frame-capture-replica",
    "true",
  );

  /*
   * Keep the native capture replica outside the user's visible viewport.
   * It still contributes real document geometry, allowing WebKitGTK's
   * FullDocument snapshot to rasterize it without modifying Workspace.
   */
  const stagingTop =
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.scrollY + window.innerHeight,
    ) + 64;

  staging.style.position = "absolute";
  staging.style.left = "0";
  staging.style.top = `${stagingTop}px`;
  staging.style.width = `${width}px`;
  staging.style.height = `${height}px`;
  staging.style.overflow = "visible";
  staging.style.margin = "0";
  staging.style.padding = "0";
  staging.style.zIndex = "-2147483647";

  replica.style.position = "absolute";
  replica.style.left = "0";
  replica.style.top = "0";
  replica.style.width = `${width}px`;
  replica.style.height = `${height}px`;
  replica.style.margin = "0";
  replica.style.transform = "none";
  replica.style.zIndex = "0";

  /*
   * A copied frame control must not react to pointer/focus state while it
   * exists as a capture replica.
   */
  replica.style.pointerEvents = "none";

  /*
   * Keep Workspace semantic presentation ownership above the replica while
   * deliberately neutralizing the shell's normal viewport geometry.
   */
  themeHost.style.position = "relative";
  themeHost.style.display = "block";
  themeHost.style.width = `${width}px`;
  themeHost.style.height = `${height}px`;
  themeHost.style.minWidth = "0";
  themeHost.style.minHeight = "0";
  themeHost.style.overflow = "visible";
  themeHost.style.margin = "0";
  themeHost.style.padding = "0";

  themeHost.appendChild(replica);
  staging.appendChild(themeHost);
  document.body.appendChild(staging);

  try {
    await waitForCaptureLayout();

    const bytes = await invoke<number[]>(
      "workspace_capture_frame_screenshot",
      {
        request: {
          x: 0,
          y: stagingTop,
          width,
          height,
        },
      },
    );

    return Uint8Array.from(bytes);
  } finally {
    staging.remove();
  }
}

export async function copyWorkspaceScreenshot(
  target: WorkspaceScreenshotTarget,
): Promise<void> {
  let bytes: Uint8Array;

  if (target.kind === "workspace") {
    const captured = await renderLogicalWorkspaceScreenshot(target);
    bytes = new Uint8Array(await captured.arrayBuffer());
  } else if (target.kind === "entire-workspace") {
    bytes = await renderEntireWorkspaceScreenshot(target);
  } else {
    bytes = await renderNativeFrameScreenshot(target);
  }

  if (target.kind === "entire-workspace") {
    reportScreenshotProgress(target.onProgress, "Copying screenshot…");
  }
  const image = await Image.fromBytes(bytes);

  try {
    await writeImage(image);
  } finally {
    await image.close();
  }
}
