import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");
const panelFrame = readFileSync("src/workspace/PanelFrame.tsx", "utf8");
const workspaceSelect = readFileSync("src/core/WorkspaceSelect.tsx", "utf8");

const frameStylesStart = styles.indexOf(".panel-frame {");
const panelBodyStart = styles.indexOf(".panel-frame__body {", frameStylesStart);
const panelBodyEnd = styles.indexOf("\n}", panelBodyStart) + 2;
const resizeHandleStart = styles.indexOf(".panel-frame__resize {", panelBodyEnd);
const resizeHandleEnd = styles.indexOf("\n}", resizeHandleStart) + 2;

assert.ok(
  frameStylesStart >= 0 && panelBodyStart > frameStylesStart &&
    panelBodyEnd > panelBodyStart && resizeHandleStart > panelBodyEnd &&
    resizeHandleEnd > resizeHandleStart,
  "Frame chrome and body CSS boundaries are present",
);

const frameChromeStyles =
  styles.slice(frameStylesStart, panelBodyStart) +
  styles.slice(resizeHandleStart, resizeHandleEnd);

assert.match(
  panelFrame,
  /"--panel-font-scale": panelViewPreferences\.fontScale/,
  "PanelFrame publishes its owned font-scale preference",
);
assert.match(
  styles,
  /\.workspace-shell\s*\{[^}]*font-size:\s*var\(--workspace-font-size\)/s,
  "Workspace Font remains the inherited font for shell and frame chrome",
);
assert.match(
  styles,
  /\.panel-frame__body\s*\{[^}]*font-size:\s*calc\(1rem\s*\*\s*var\(--panel-font-scale,\s*1\)\)/s,
  "Panel body is the effective font boundary for the frame scale",
);
assert.doesNotMatch(
  frameChromeStyles,
  /--panel-font-scale/,
  "Frame, header, title, controls, and resize handle do not consume the projection scale",
);
assert.doesNotMatch(
  styles,
  /\.panel-frame__title\s*\{[^}]*font-size\s*:/s,
  "Panel title inherits Workspace Font instead of setting its own font size",
);
assert.match(
  styles,
  /\.panel-frame__projection-copy\s*\{[^}]*font-size:\s*[\d.]+em/s,
  "Frame control typography follows Workspace Font without consuming Frame Font",
);
assert.match(
  styles,
  /button,\s*select,\s*input,\s*textarea\s*\{\s*font:\s*inherit;/,
  "Native controls inherit the effective panel typography",
);
assert.match(
  workspaceSelect,
  /"--panel-font-scale": panelFontScale/,
  "Portaled select options receive the owning frame scale",
);
assert.match(
  styles,
  /\.workspace-select__listbox\s*\{[^}]*font-size:\s*calc\(1rem\s*\*\s*var\(--panel-font-scale,\s*1\)\)/s,
  "Portaled select menu sizes text from its forwarded frame scale",
);

for (const [declaration, description] of [
  ["grid-template-rows: repeat(6, minmax(4.5em, 1fr));", "Calendar text rows scale with their labels"],
  ["grid-template-columns: 3.5em repeat(7, minmax(0, 1fr));", "Calendar week metadata column scales with its text"],
  ["min-height: 1.75em;", "File Browser text rows reserve font-relative height"],
  ["grid-template-columns: repeat(2, 1.75em);", "Numeric control buttons reserve font-relative width"],
  ["grid-template-columns: repeat(auto-fit, minmax(min(100%, 12em), 1fr));", "Settings groups reflow as font-relative minimum widths grow"],
]) {
  assert.ok(styles.includes(declaration), description);
}

console.log("Frame Font contract guard passed");
