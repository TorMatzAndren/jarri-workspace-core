import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const panels = readFileSync(new URL("../src/modules/workspace-diagnostics/RuntimePanels.tsx", import.meta.url), "utf8");
const presentation = css.slice(css.lastIndexOf("/* Core Runtime Diagnostics:"));
const requirements = [
  ["Runtime surfaces must follow the configurable frame radius", /border-radius:\s*var\(--workspace-panel-radius,\s*8px\)/],
  ["Dense Runtime text must scale relative to the frame typography", /font-size:\s*\.7\d*em/],
  ["History rows must use theme tokens for active and hover states", /\.runtime-diagnostics__row\[aria-pressed="true"\][\s\S]*?background:\s*var\(--color-button-hover\)/],
  ["Virtual and regular rows must use the same table column geometry", /\.runtime-diagnostics__table-head,[\s\S]*?\.runtime-diagnostics__row\s*\{[\s\S]*?grid-template-columns:\s*var\(--workspace-table-columns\)/],
  ["Small panels must reflow using their content container width", /@container\s*\(max-width:\s*760px\)/],
  ["The history viewport must preserve bounded row presentation", /\.runtime-diagnostics__virtual-item\s*>\s*\.runtime-diagnostics__row\s*\{[\s\S]*?height:\s*2\.55em/],
];
for (const [message, pattern] of requirements) {
  if (!pattern.test(presentation)) throw new Error(message);
}
if (!/function TimingTable\(/.test(panels) || (panels.match(/<TimingTable\s+rows=/g) ?? []).length !== 2) {
  throw new Error("Diagnostics and Events must share one operation-table implementation.");
}
if (!/virtual=\{virtual\}/.test(panels) || !/\.runtime-diagnostics__row:focus-visible/.test(presentation)) {
  throw new Error("Virtual history must use the shared keyboard-operable operation row.");
}
if (/#[0-9a-f]{3,8}\b|\brgb\(/i.test(presentation)) {
  throw new Error("Runtime panel rules must use Core theme tokens rather than hardcoded theme colors.");
}
console.log("Runtime diagnostics presentation contract guard passed");
