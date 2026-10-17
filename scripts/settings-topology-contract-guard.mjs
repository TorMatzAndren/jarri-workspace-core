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
  /\.settings-panel__section--interface\s*\{[^}]*grid-template-areas:\s*"heading heading heading"\s*"display layout surfaces"\s*"display clock surfaces";[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(min-content,\s*1fr\)\);[^}]*overflow-x:\s*auto;/s,
  "Interface cards keep the authored three-column composition and scroll when intrinsic tracks cannot fit",
);
assert.doesNotMatch(
  styles,
  /\.settings-panel__section--interface\s*\{[^}]*grid-template-columns:\s*repeat\(auto-(?:fit|fill)/s,
  "Interface semantic cards do not auto-fit or auto-fill into new topologies",
);

const settingsTopologySelector =
  /\.settings-panel(?:\b|__|[\s.#:>+~])|\.settings-panel__group(?:\b|--)/;
for (const atRule of ["@container", "@media"]) {
  for (const block of atRuleBlocks(styles, atRule)) {
    assert.doesNotMatch(
      block,
      settingsTopologySelector,
      `Settings topology is not changed by ${atRule} rules`,
    );
  }
}

assert.doesNotMatch(
  settingsPanel,
  /matchMedia|ResizeObserver|clientWidth|offsetWidth|innerWidth/,
  "Settings does not select topology from runtime width measurements",
);

console.log("Settings topology contract guard passed");
