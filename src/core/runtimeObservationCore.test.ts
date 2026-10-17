import { createRuntimeObservationRegistry } from "./runtimeObservation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testObservationOwnership() {
  const registry = createRuntimeObservationRegistry();

  const edge = {
    observer: { kind: "panel" as const, id: "panel-a" },
    resource: { kind: "backend" as const, key: "service-a" },
  };

  let notifications = 0;
  const unsubscribe = registry.subscribe(() => {
    notifications += 1;
  });

  const first = registry.observe(edge);

  let snapshot = registry.getSnapshot();

  assert(snapshot.observations.length === 1,
    "First observation must create one edge");

  assert(snapshot.observations[0].count === 1,
    "First observation must have count one");

  const second = registry.observe(edge);

  snapshot = registry.getSnapshot();

  assert(snapshot.observations.length === 1,
    "Duplicate observers must share one edge");

  assert(snapshot.observations[0].count === 2,
    "Duplicate observation must increment reference count");

  first.release();

  snapshot = registry.getSnapshot();

  assert(snapshot.observations.length === 1,
    "One remaining lease must preserve observation");

  assert(snapshot.observations[0].count === 1,
    "Release must decrement observation count");

  second.release();

  assert(registry.getSnapshot().observations.length === 0,
    "Final release must remove observation");

  const third = registry.observe({
    observer: { kind: "panel", id: "panel-b" },
    resource: { kind: "projection", key: "projection-b" },
  });

  registry.clear();

  assert(registry.getSnapshot().observations.length === 0,
    "Clear must remove all observations");

  third.release();
  unsubscribe();

  assert(notifications > 0,
    "Subscribers must receive changes");

  registry.dispose();
  const disposedSnapshot = registry.getSnapshot();
  registry.observe(edge).release();
  assert(registry.getSnapshot() === disposedSnapshot,
    "disposed observation registries reject new leases and retain their snapshot");
}

testObservationOwnership();

console.log("Core runtime observation contract tests passed.");
