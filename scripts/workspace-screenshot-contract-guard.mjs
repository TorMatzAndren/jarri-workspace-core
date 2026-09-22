import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const shell = read("../src/shell/WorkspaceShell.tsx");
const canvas = read("../src/workspace/WorkspaceCanvas.tsx");
const screenshot = read("../src/workspace/screenshot.ts");
const composition = read("../src/workspace/workspaceScreenshotComposition.ts");
const native = read("../src-tauri/src/lib.rs");
const styles = read("../src/styles.css");

const failures = [];
const requireContract = (condition, message) => {
  if (!condition) failures.push(message);
};

const logoIndex = shell.indexOf('alt="Jarri Workspace"');
const screenshotButtonIndex = shell.indexOf('title="Screenshot entire Workspace"');
const clockIndex = shell.indexOf("<WorkspaceClock");
requireContract(
  logoIndex >= 0 && screenshotButtonIndex > logoIndex && clockIndex > screenshotButtonIndex,
  "Entire Workspace screenshot control must sit in title-bar order after the Jarri logo and before the clock.",
);
requireContract(
  /data-workspace-screenshot-exclude[\s\S]*?title="Screenshot entire Workspace"/.test(shell),
  "The screenshot control must opt out of cloned screenshot output.",
);
requireContract(
  /aria-label="Screenshot entire Workspace"/.test(shell) &&
    /screenshotToolbarRef=\{canvasToolbarCaptureRefCallback\}/.test(shell),
  "The action must be accessible and shell-owned, with toolbar chrome captured separately.",
);
requireContract(
  /panels=\{controller\.activeTab\.panels\}/.test(shell) &&
    /canvasBounds=\{controller\.activeTab\.canvasBounds\}/.test(shell) &&
    /onScreenshotSourceChange=\{updateActiveCanvasScreenshotSource\}/.test(shell),
  "Capture source must be the mounted active tab and its authoritative logical bounds.",
);
requireContract(
  /onScreenshotSourceChange\?\.\(\{\s*element,\s*bounds:\s*effectiveBounds/.test(canvas),
  "WorkspaceCanvas must publish its logical canvas element and normalized model bounds.",
);
requireContract(
  /kind:\s*"entire-workspace"[\s\S]*?canvasElement:\s*HTMLElement[\s\S]*?canvasBounds:\s*WorkspaceScreenshotCanvasBounds/.test(screenshot),
  "Entire Workspace capture must target the complete logical canvas, not the viewport.",
);
requireContract(
  /querySelectorAll(?:<HTMLElement>)?\("\[data-workspace-screenshot-exclude\]"\)/.test(screenshot) &&
    /node\.closest\("\[data-workspace-screenshot-exclude\]"\)/.test(screenshot),
  "Capture exclusion must hide marked controls in cloned staging and filter them from rendering.",
);
const shellCaptureStart = screenshot.indexOf("async function renderShellChromeScreenshot");
const shellCaptureEnd = screenshot.indexOf("function decodeScreenshotBlob", shellCaptureStart);
const shellCapture = screenshot.slice(shellCaptureStart, shellCaptureEnd);
requireContract(
  shellCaptureStart >= 0 &&
    shellCaptureEnd > shellCaptureStart &&
    shellCapture.indexOf("document.body.appendChild(staging)") <
      shellCapture.indexOf("await waitForCaptureLayout()") &&
    shellCapture.indexOf("await waitForCaptureLayout()") <
      shellCapture.indexOf("domToBlob(themeHost") &&
    /finally \{[\s\S]*?staging\.remove\(\)/.test(shellCapture),
  "Shell chrome must be attached, laid out, rasterized, and removed through a finally cleanup.",
);
requireContract(
  /width:\s*Math\.max\(normalizedShellWidth,\s*canvasWidth\)/.test(composition) &&
    /canvasY:\s*normalizedShellHeight/.test(composition) &&
    /canvasX:\s*0/.test(composition),
  "Composition must retain native shell width and place the normalized canvas below it.",
);
requireContract(
  /async function renderNativeFrameScreenshot\(/.test(screenshot) && /renderNativeFrameScreenshot\(target\)/.test(screenshot),
  "Existing frame screenshot rendering must remain available.",
);
requireContract(
  /if \(target\.kind === "workspace"\) \{[\s\S]*?renderLogicalWorkspaceScreenshot\(target\)/.test(screenshot) &&
    /kind: "workspace"[\s\S]*?element: target\.canvasElement[\s\S]*?width: layout\.canvasWidth[\s\S]*?height: layout\.canvasHeight/.test(screenshot),
  "Existing logical-canvas capture must remain the source for the full Workspace composition.",
);
requireContract(
  /await waitForCaptureImages\(themeHost\)/.test(shellCapture),
  "Staged shell chrome images must be ready before rasterization.",
);
requireContract(
  /preflightWorkspaceScreenshot\(layout\)/.test(screenshot) &&
    /WORKSPACE_SCREENSHOT_SINGLE_SHOT_MAX_PIXELS/.test(composition) &&
    /WORKSPACE_SCREENSHOT_NATIVE_MAX_PIXELS/.test(composition),
  "Entire Workspace capture must preflight dimensions and pixel counts before rendering.",
);
requireContract(
  /renderLogicalWorkspaceTileScreenshot/.test(screenshot) &&
    /workspace_compose_entire_workspace_screenshot/.test(screenshot) &&
    /canvasWidth:\s*layout\.canvasWidth/.test(screenshot),
  "Large captures must use bounded tile metadata and native composition.",
);
requireContract(
  /document\.body\.appendChild\(staging\)[\s\S]*?staging\.remove\(\)/.test(screenshot) &&
    /finally \{[\s\S]*?staging\.remove\(\)/.test(screenshot),
  "Canvas tile staging must be cleaned up on every capture outcome.",
);
requireContract(
  /workspace_compose_entire_workspace_screenshot/.test(native) &&
    /ImageSurface::create_from_png/.test(native) &&
    /write_to_png/.test(native),
  "Native composition must decode tiles and encode the final PNG.",
);
requireContract(
  /onProgress:\s*setWorkspaceScreenshotProgress/.test(shell) &&
    /workspaceScreenshotProgress/.test(shell),
  "Entire Workspace capture must expose lightweight progress feedback.",
);
requireContract(
  !/--panel-font-scale/.test(shell),
  "Shell screenshot chrome must not consume Frame Font state.",
);
requireContract(
  /className="workspace-shell__screenshot-cluster"[\s\S]*?data-workspace-screenshot-exclude/.test(shell) &&
    /className="workspace-shell__screenshot-status"[\s\S]*?data-workspace-screenshot-exclude/.test(shell) &&
    /\.workspace-shell__screenshot-cluster[\s\S]*?position:\s*relative[\s\S]*?flex:\s*0 0 32px/.test(styles) &&
    /\.workspace-shell__screenshot-status[\s\S]*?position:\s*absolute/.test(styles),
  "Screenshot progress must be excluded and positioned outside stable title-bar flow.",
);

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workspace screenshot contracts passed.");
}
