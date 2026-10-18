import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");
const settingsPanel = readFileSync("src/panels/SettingsPanel.tsx", "utf8");
const updateSettingsSection = readFileSync("src/panels/UpdateSettingsSection.tsx", "utf8");

function indexInOrder(source, values, description) {
  let previous = -1;
  for (const value of values) {
    const index = source.indexOf(value, previous + 1);
    assert.ok(index > previous, `${description}: ${value} remains in semantic order`);
    previous = index;
  }
}

function atRuleBlocks(source, atRule) {
  const blocks = [];
  const matcher = new RegExp(`${atRule}\\b`, "g");
  for (const match of source.matchAll(matcher)) {
    const open = source.indexOf("{", match.index);
    if (open < 0) continue;
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(match.index, index + 1));
        break;
      }
    }
  }
  return blocks;
}

indexInOrder(
  settingsPanel,
  [
    "<UpdateSettingsSection />",
    "settings-panel__section--interface",
    "settings-panel__group--display",
    "settings-panel__group--layout",
    "settings-panel__group--surfaces",
    "settings-panel__group--clock",
    "settings-panel__section--appearance",
  ],
  "Settings semantic regions remain in stable document order",
);
assert.match(
  updateSettingsSection,
  /className="settings-panel__section settings-panel__section--updates"/,
  "Updates is a dedicated Settings section",
);

assert.match(
  styles,
  /\.settings-panel\s*\{[^}]*grid-template-areas:\s*"updates"\s*"interface"\s*"appearance";[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
  "Settings sections occupy one explicit, ordered column",
);
assert.match(
  styles,
  /\.settings-panel__section--interface\s*\{[^}]*grid-template-areas:\s*"heading heading heading"\s*"display layout surfaces"\s*"display clock surfaces";[^}]*grid-template-columns:\s*minmax\(16em,\s*0\.9fr\)\s*minmax\(24em,\s*1\.3fr\)\s*minmax\(20em,\s*1fr\);[^}]*overflow-x:\s*auto;/s,
  "Interface cards preserve three proportioned columns and scroll when their minimum widths cannot fit",
);
assert.doesNotMatch(
  styles,
  /\.settings-panel__section--interface\s*\{[^}]*grid-template-columns:\s*repeat\(auto-(?:fit|fill)/s,
  "Interface semantic cards do not auto-fit or auto-fill into new topologies",
);

for (const atRule of ["@container", "@media"]) {
  for (const block of atRuleBlocks(styles, atRule)) {
    assert.doesNotMatch(
      block,
      /\.settings-panel__section--interface\s*\{|grid-template-areas:|grid-area:\s*(?:display|layout|surfaces|clock)\b/,
      `Settings semantic card topology is not changed by ${atRule} rules`,
    );
  }
}

assert.match(
  styles,
  /container:\s*settings-interface\s*\/\s*inline-size/,
  "Settings controls respond to Interface section width rather than viewport size",
);
assert.match(
  styles,
  /--settings-control-height:\s*2\.25em/,
  "Settings defines one font-scaled control height",
);
assert.match(
  styles,
  /\.settings-panel__group \.workspace-select__trigger,\s*\.settings-panel__group \.workspace-number-input\s*\{[^}]*height:\s*var\(--settings-control-height\)[^}]*min-height:\s*var\(--settings-control-height\)/s,
  "Workspace Select and Workspace Number Input share an explicit Settings height",
);
assert.match(
  styles,
  /\.settings-panel__group input\[type="checkbox"\]\s*\{[^}]*width:\s*1\.05em[^}]*height:\s*1\.05em[^}]*margin:\s*0/s,
  "Settings checkboxes have consistent size and vertical alignment",
);
assert.match(
  styles,
  /@container settings-interface \(max-width:\s*36rem\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto[\s\S]*?grid-column:\s*1 \/ -1/,
  "Settings labels stack within existing cards at narrower widths",
);
assert.match(
  styles,
  /\.settings-panel__group \.workspace-number-input__buttons\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*var\(--settings-stepper-button-width\)\)/s,
  "Numeric stepper buttons share the same Settings hit width as the compact scale buttons",
);
assert.match(
  styles,
  /\.settings-surface-grid\s*\{[^}]*grid-template-columns:\s*minmax\(6\.25em,\s*1fr\) repeat\(2,\s*7em\)/s,
  "System Surface coordinate controls use compact font-relative widths",
);

assert.doesNotMatch(
  settingsPanel,
  /matchMedia|ResizeObserver|clientWidth|offsetWidth|innerWidth/,
  "Settings does not select topology from runtime width measurements",
);

console.log("Settings topology contract guard passed");
