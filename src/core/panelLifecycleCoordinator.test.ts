import { createPanelLifecycleCoordinator } from "./panelLifecycleCoordinator";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function testActivationSuspensionAndRepeatedReconciliation() {
  const coordinator = createPanelLifecycleCoordinator();
  coordinator.reconcilePanels(["panel-a", "panel-b"]);
  coordinator.reconcileActivePanels(["panel-a"]);
  equal(coordinator.getPanelState("panel-a"), "active", "created active panel activates");
  equal(coordinator.getPanelState("panel-b"), "framed", "inactive new panel remains framed");
  const revision = coordinator.getSnapshot().revision;
  coordinator.reconcilePanels(["panel-a", "panel-b"]);
  coordinator.reconcileActivePanels(["panel-a"]);
  equal(coordinator.getSnapshot().revision, revision, "repeated reconciliation is idempotent");
  coordinator.reconcileActivePanels(["panel-b"]);
  equal(coordinator.getPanelState("panel-a"), "suspended", "old active panel suspends");
  equal(coordinator.getPanelState("panel-b"), "active", "new tab panel activates");
  coordinator.dispose();
}

function testMinimizeRestoreAndRapidTabSwitching() {
  const coordinator = createPanelLifecycleCoordinator();
  coordinator.reconcilePanels(["a", "b", "c"]);
  coordinator.reconcileActivePanels(["a", "b"]);
  coordinator.reconcileActivePanels(["b"]); // a is minimized or otherwise hidden
  equal(coordinator.getPanelState("a"), "suspended", "minimize suspends presentation state");
  coordinator.reconcileActivePanels(["a", "b"]);
  equal(coordinator.getPanelState("a"), "active", "restore resumes presentation state");
  coordinator.reconcileActivePanels(["c"]);
  coordinator.reconcileActivePanels(["a"]);
  coordinator.reconcileActivePanels(["c"]);
  equal(coordinator.getPanelState("a"), "suspended", "rapid tab switches converge to latest active set");
  equal(coordinator.getPanelState("c"), "active", "latest tab remains active");
  coordinator.dispose();
}

function testCloseDisposesAndStaleIdentityCannotAffectReopenedPanel() {
  const coordinator = createPanelLifecycleCoordinator();
  const oldIdentity = coordinator.registerPanel("same-id");
  coordinator.activatePanel(oldIdentity);
  coordinator.disposePanel(oldIdentity);
  equal(coordinator.getPanelState(oldIdentity), "disposed", "close publishes disposed state");
  assert(!coordinator.activatePanel(oldIdentity), "stale identity cannot reactivate a closed panel");
  coordinator.reconcileActivePanels(["same-id"]);
  equal(coordinator.getPanelState("same-id"), null, "stale active reconciliation cannot recreate a removed member");
  const nextIdentity = coordinator.registerPanel("same-id");
  assert(nextIdentity.generation > oldIdentity.generation, "reused panel ID gets a new generation");
  assert(!coordinator.activatePanel(oldIdentity), "old identity cannot activate the reopened panel");
  coordinator.activatePanel(nextIdentity);
  equal(coordinator.getPanelState(nextIdentity), "active", "new identity can activate");
  coordinator.dispose();
}

function testSnapshotRevisionsAreImmutableAndNotificationsCanUnsubscribe() {
  const coordinator = createPanelLifecycleCoordinator();
  let notifications = 0;
  const unsubscribe = coordinator.subscribe(() => { notifications += 1; });
  const before = coordinator.getSnapshot();
  coordinator.registerPanel("panel");
  const after = coordinator.getSnapshot();
  assert(after.revision > before.revision, "global snapshot revision advances");
  assert(after.panels.panel.revision > 0, "record has a revision");
  assert(Object.isFrozen(after) && Object.isFrozen(after.panels) && Object.isFrozen(after.panels.panel), "snapshots are immutable");
  assert(notifications > 0, "changes notify subscribers");
  unsubscribe();
  const priorNotifications = notifications;
  coordinator.activatePanel("panel");
  equal(notifications, priorNotifications, "unsubscribe removes subscriber");
  coordinator.dispose();
}

function testSubscriberFailureDoesNotInterruptStateChanges() {
  const coordinator = createPanelLifecycleCoordinator();
  coordinator.subscribe(() => { throw new Error("stale subscriber"); });
  coordinator.registerPanel("panel");
  coordinator.activatePanel("panel");
  equal(coordinator.getPanelState("panel"), "active", "one broken subscriber cannot interrupt transitions");
  coordinator.dispose();
}

testActivationSuspensionAndRepeatedReconciliation();
testMinimizeRestoreAndRapidTabSwitching();
testCloseDisposesAndStaleIdentityCannotAffectReopenedPanel();
testSnapshotRevisionsAreImmutableAndNotificationsCanUnsubscribe();
testSubscriberFailureDoesNotInterruptStateChanges();
console.log("Workspace panel-lifecycle coordinator tests passed.");
