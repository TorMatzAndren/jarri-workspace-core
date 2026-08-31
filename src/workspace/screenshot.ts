import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { domToBlob } from "modern-screenshot";

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
      restoreScrollPosition: false,
    },
  });

  if (!captured) {
    throw new Error("Workspace screenshot produced no image data.");
  }

  return captured;
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
  } else {
    bytes = await renderNativeFrameScreenshot(target);
  }

  const image = await Image.fromBytes(bytes);

  try {
    await writeImage(image);
  } finally {
    await image.close();
  }
}
