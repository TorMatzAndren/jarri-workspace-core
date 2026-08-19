import {
  createWorkspaceProjectionPublicationController,
  type WorkspaceProjectionDocument,
} from "./projection";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function tick() {
  return Promise.resolve();
}

function exporter(label: string) {
  return () => ({
    sections: [{ title: label, items: [{ label: "Value", value: label }] }],
  });
}

function documentExporter(document: WorkspaceProjectionDocument) {
  return () => document;
}

function testStaleReleaseCannotClearNewerPublication() {
  const controller = createWorkspaceProjectionPublicationController();
  const first = exporter("first");
  const second = exporter("second");

  const firstLease = controller.publish(first);
  controller.publish(second);
  firstLease.release();

  assertEqual(
    controller.getSnapshot(),
    second,
    "stale release cannot clear newer publication",
  );
}

function testCurrentReleaseRestoresInitial() {
  const controller = createWorkspaceProjectionPublicationController();
  const initial = exporter("initial");
  const ready = exporter("ready");
  controller.reset(initial);

  const lease = controller.publish(ready);
  lease.release();

  assertEqual(
    controller.getSnapshot(),
    initial,
    "current release falls back to frame initial projection",
  );
}

function testResetInvalidatesPriorLease() {
  const controller = createWorkspaceProjectionPublicationController();
  const firstLease = controller.publish(exporter("first"));
  const second = exporter("second");

  controller.reset();
  controller.publish(second);
  firstLease.release();

  assertEqual(
    controller.getSnapshot(),
    second,
    "reset lease cannot clear newer generation",
  );
}

function testControllerInstancesAreIsolated() {
  const firstController = createWorkspaceProjectionPublicationController();
  const secondController = createWorkspaceProjectionPublicationController();
  const first = exporter("first");
  const second = exporter("second");

  const firstLease = firstController.publish(first);
  secondController.publish(second);
  firstLease.release();

  assert(
    firstController.getSnapshot() !== second,
    "first controller falls back independently",
  );
  assertEqual(
    secondController.getSnapshot(),
    second,
    "second controller remains current",
  );
}

async function testEquivalentPublicationDoesNotNotifySubscriber() {
  const controller = createWorkspaceProjectionPublicationController();
  let count = 0;
  const unsubscribe = controller.subscribe(() => {
    count += 1;
  });
  const first = exporter("same");
  const equivalent = exporter("same");

  controller.publish(first);
  await tick();
  controller.publish(equivalent);
  await tick();
  unsubscribe();

  assertEqual(count, 1, "equivalent publication is idempotent");
  assertEqual(
    controller.getSnapshot(),
    first,
    "equivalent publication does not replace snapshot identity",
  );
}

async function testOrderingDifferencesRemainSemanticChanges() {
  const controller = createWorkspaceProjectionPublicationController();
  let count = 0;
  const unsubscribe = controller.subscribe(() => {
    count += 1;
  });
  const base = documentExporter({
    sections: [
      {
        title: "First",
        items: [
          { label: "A", value: 1 },
          { label: "B", value: 2 },
        ],
      },
      {
        title: "Second",
        items: [{ label: "C", value: true }],
      },
    ],
  });
  const reordered = documentExporter({
    sections: [
      {
        title: "Second",
        items: [{ label: "C", value: true }],
      },
      {
        title: "First",
        items: [
          { label: "B", value: 2 },
          { label: "A", value: 1 },
        ],
      },
    ],
  });

  controller.publish(base);
  await tick();
  controller.publish(reordered);
  await tick();
  unsubscribe();

  assertEqual(count, 2, "ordering differences are semantic changes");
}

async function main() {
  testStaleReleaseCannotClearNewerPublication();
  testCurrentReleaseRestoresInitial();
  testResetInvalidatesPriorLease();
  testControllerInstancesAreIsolated();
  await testEquivalentPublicationDoesNotNotifySubscriber();
  await testOrderingDifferencesRemainSemanticChanges();
  console.log("workspace projection publication tests passed");
}

void main();
