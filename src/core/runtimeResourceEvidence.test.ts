import { createRuntimeObservationRegistry } from "./runtimeObservation";
import {
  createPanelResourceEvidencePublisher,
  createRuntimeResourceEvidenceRegistry,
} from "./runtimeResourceEvidence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function throws(action: () => unknown, message: string) {
  let didThrow = false;
  try { action(); } catch { didThrow = true; }
  assert(didThrow, message);
}

const knownBytes = (quantity: number, resourceKey = "cache", resourceClass = "projection-cache") => ({
  resourceClass,
  resourceKey,
  evidenceKind: "exact-known" as const,
  quantity,
  unit: "bytes" as const,
});

function testClaimLifecycleAndStableReads() {
  const registry = createRuntimeResourceEvidenceRegistry();
  let notifications = 0;
  registry.subscribe(() => { notifications += 1; });
  const emptySnapshot = registry.getSnapshot();
  equal(registry.getSnapshot(), emptySnapshot, "read reuses snapshot without mutation");
  equal(notifications, 0, "reads do not publish");

  const lease = registry.acquire({ ...knownBytes(6_606_028), owner: { kind: "panel", id: "panel-a" } });
  equal(registry.getSnapshot().claims.length, 1, "acquire creates exactly one current claim");
  equal(registry.getSnapshot().claims[0]?.unit, "bytes", "unit is preserved");
  equal(registry.getSnapshot().claims[0]?.evidenceKind, "exact-known", "evidence semantics are preserved");
  lease.update(7);
  equal(registry.getSnapshot().claims.length, 1, "update does not create another claim");
  equal(registry.getSnapshot().claims[0]?.quantity, 7, "update changes current quantity");
  lease.release();
  lease.release();
  equal(registry.getSnapshot().claims.length, 0, "release removes claim and is idempotent");
  equal(notifications, 3, "only visible acquire/update/release mutations publish");
}

function testIdentityAndDuplicateLeaseSemantics() {
  const registry = createRuntimeResourceEvidenceRegistry();
  const a = registry.acquire({ ...knownBytes(10), owner: { kind: "panel", id: "panel-a" } });
  const duplicate = registry.acquire({ ...knownBytes(10), owner: { kind: "panel", id: "panel-a" } });
  equal(registry.getSnapshot().claims.length, 1, "duplicate identity is one canonical claim");
  throws(() => registry.acquire({ ...knownBytes(11), owner: { kind: "panel", id: "panel-a" } }), "conflicting duplicate evidence is rejected");
  duplicate.release();
  equal(registry.getSnapshot().claims.length, 1, "claim remains until last duplicate lease releases");
  a.release();
  equal(registry.getSnapshot().claims.length, 0, "last lease removes canonical claim");

  const one = registry.acquire({ ...knownBytes(1, "one"), owner: { kind: "panel", id: "panel-a" } });
  const two = registry.acquire({ ...knownBytes(2, "two"), owner: { kind: "panel", id: "panel-a" } });
  const otherPanel = registry.acquire({ ...knownBytes(3, "one"), owner: { kind: "panel", id: "panel-b" } });
  equal(registry.getSnapshot().claims.length, 3, "distinct keys and owners coexist");
  one.release(); two.release(); otherPanel.release();
}

function testInputValidationAndUnknownAbsence() {
  const registry = createRuntimeResourceEvidenceRegistry();
  const base = { ...knownBytes(1), owner: { kind: "panel" as const, id: "panel-a" } };
  throws(() => registry.acquire({ ...base, owner: { kind: "panel", id: " " } }), "empty owner rejected");
  throws(() => registry.acquire({ ...base, resourceClass: " " }), "empty class rejected");
  throws(() => registry.acquire({ ...base, resourceKey: " " }), "empty key rejected");
  throws(() => registry.acquire({ ...base, quantity: -1 }), "negative quantity rejected");
  throws(() => registry.acquire({ ...base, quantity: Number.NaN }), "NaN quantity rejected");
  equal(registry.getSnapshot().claims.length, 0, "missing evidence remains absent, not coerced to zero");
}

function testPanelPublisherDisposalAndObservationIsolation() {
  const registry = createRuntimeResourceEvidenceRegistry();
  const observations = createRuntimeObservationRegistry();
  const publisher = createPanelResourceEvidencePublisher(registry, "panel-a");
  const lease = publisher.acquire(knownBytes(12));
  equal(registry.getSnapshot().claims.length, 1, "active panel publisher holds its current claim");
  equal(observations.getSnapshot().observations.length, 0, "resource claims do not change observation registry");
  publisher.dispose(); // React panel provider runs this on unmount/deactivation.
  equal(registry.getSnapshot().claims.length, 0, "panel scope disposal releases claims");
  lease.release();
  publisher.dispose();
  throws(() => publisher.acquire(knownBytes(1)), "disposed panel publisher cannot acquire claims");
  publisher.activate(); // React StrictMode replays effect setup after cleanup in development.
  const replayLease = publisher.acquire(knownBytes(1));
  equal(registry.getSnapshot().claims.length, 1, "effect replay can reactivate the same empty panel scope");
  publisher.dispose();
  replayLease.release();
}

testClaimLifecycleAndStableReads();
testIdentityAndDuplicateLeaseSemantics();
testInputValidationAndUnknownAbsence();
testPanelPublisherDisposalAndObservationIsolation();
