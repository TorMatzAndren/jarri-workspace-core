import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const canvas = readFileSync("src/workspace/WorkspaceCanvas.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const screenshot = readFileSync("src/workspace/screenshot.ts", "utf8");
const presentation = readFileSync("src/workspace/canvasWallpaperPresentation.ts", "utf8");
const appearance = readFileSync("src/panels/ThemeColorsPanel.tsx", "utf8");
assert.ok(/data-wallpaper-rendered=\{wallpaperPresentation\.rendered\}[\s\S]*?backgroundAttachment: "scroll"/.test(canvas), "Wallpaper paints on the scroll viewport surface");
assert.ok(/\.workspace-canvas__surface\s*\{[\s\S]*?background-attachment: scroll/.test(styles), "Wallpaper remains viewport attached");
assert.ok(presentation.includes("linear-gradient(") && presentation.includes('anchor: "viewport"'), "Gradient presentation is viewport scoped");
assert.ok(
  /\.workspace-shell\[data-grid-visible="true"\]\s+\.workspace-canvas__logical::before\s*\{[^}]*content:\s*"";[^}]*pointer-events:\s*none;[^}]*z-index:\s*1;[^}]*linear-gradient\(var\(--color-border\)[^}]*background-size:\s*var\(--workspace-grid-size,\s*12px\)\s+var\(--workspace-grid-size,\s*12px\)/s.test(styles),
  "Enabled canvas grid uses a noninteractive overlay, theme border colour, and configured spacing",
);
assert.ok(
  /\.workspace-shell\[data-grid-visible="false"\]\s+\.workspace-canvas__logical\[data-wallpaper-rendered="true"\]\s*\{\s*background:\s*transparent;/s.test(styles),
  "Grid-off mode preserves the wallpaper",
);
assert.doesNotMatch(
  styles,
  /JARRI TEMPORARY GRID LAYER DIAGNOSTIC|rgba\(255, 0, 255, 0\.85\)|--workspace-grid-line/,
  "Temporary grid diagnostic and contrast override are removed",
);
assert.ok(screenshot.includes('replica.removeAttribute("data-wallpaper-rendered")'), "Logical screenshots retain their original crop semantics");
assert.ok(appearance.includes('aria-label="Wallpaper gradient start color"') && appearance.includes('aria-label="Wallpaper gradient angle"'), "Gradient controls preserve color and angle configuration");
assert.ok(!appearance.includes('type: "image"') && !appearance.includes("Image (not rendered)"), "Image wallpaper imports are outside this migration");
console.log("Workspace wallpaper contract guard passed");
