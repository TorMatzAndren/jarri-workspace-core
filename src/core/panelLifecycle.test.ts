import {
  canTransitionPanelPresentation,
  panelLifecycleCapabilities,
} from "./panelLifecycle";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(canTransitionPanelPresentation("framed", "activating"), "framed can activate");
assert(canTransitionPanelPresentation("suspended", "activating"), "suspended can resume");
assert(canTransitionPanelPresentation("active", "suspending"), "active can suspend");
assert(!canTransitionPanelPresentation("framed", "active"), "transitions cannot skip activation");
assert(!canTransitionPanelPresentation("disposed", "active"), "disposed is terminal");

const defaults = panelLifecycleCapabilities();
assert(defaults.projectionRetention === "discard-on-detach", "projection default is conservative");
assert(defaults.runtimeRetention === "discard-on-detach", "runtime default is conservative");
assert(defaults.backgroundActivity === "stop-when-hidden", "background default is conservative");
const declared = panelLifecycleCapabilities({ runtimeRetention: "keep-alive" });
assert(declared.runtimeRetention === "keep-alive", "declared runtime policy is retained");
assert(declared.backgroundActivity === defaults.backgroundActivity, "partial declarations receive defaults");

console.log("Workspace panel-lifecycle contract tests passed.");
