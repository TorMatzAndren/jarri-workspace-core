import { createRuntimeTiming } from "./runtimeTiming";

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

function makeClock() {
  let value = 0;

  return () => {
    const current = value;
    value += 10;
    return current;
  };
}

function testTraceLifecycle() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  const trace = timing.start("test", "operation");

  timing.mark(trace, "middle");
  const result = timing.finish(trace, "done");

  assert(result, "completed trace is returned");
  assertEqual(result.marks.length, 2, "trace contains both marks");
  assertEqual(result.marks[0].label, "middle", "first mark is retained");
  assertEqual(result.marks[0].elapsedMs, 10, "first mark timing is retained");
  assertEqual(result.marks[1].label, "done", "completion mark is retained");

  const snapshot = timing.getSnapshot();

  assertEqual(snapshot.completed.length, 1, "completed trace enters history");
  assertEqual(
    snapshot.completed[0].category,
    "test",
    "history preserves trace category",
  );
  assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.completed) && Object.isFrozen(snapshot.completed[0]), "timing snapshots are immutable");
  assert(Object.isFrozen(snapshot.completed[0].marks), "timing marks are immutable");
}

function testNamedTrace() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  timing.startNamed("tab-switch", "presentation", "A → B");
  timing.markNamed("tab-switch", "committed");

  const result = timing.finishNamed(
    "tab-switch",
    "painted",
  );

  assert(result, "named trace completes");
  assertEqual(result.label, "A → B", "named trace preserves label");
  assertEqual(result.marks.length, 2, "named trace keeps marks");
}

function testSubscribersReceiveCompletedTrace() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  let notifications = 0;

  const unsubscribe = timing.subscribe(() => {
    notifications += 1;
  });

  const trace = timing.start("runtime", "job");
  timing.finish(trace);

  unsubscribe();

  assertEqual(
    notifications,
    1,
    "completed trace publishes one snapshot update",
  );
}

function testHistoryLimit() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    historyLimit: 2,
    logCompleted: false,
  });

  for (const label of ["one", "two", "three"]) {
    const trace = timing.start("test", label);
    timing.finish(trace);
  }

  const snapshot = timing.getSnapshot();

  assertEqual(snapshot.completed.length, 2, "history is bounded");
  assertEqual(
    snapshot.completed[0].label,
    "two",
    "oldest trace is evicted first",
  );
  assertEqual(
    snapshot.completed[1].label,
    "three",
    "newest trace is retained",
  );
}

function testExternalMeasurement() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  const result = timing.record(
    "panel-render",
    "eq-log/monster-statistics",
    {
      durationMs: 123.45,
      startedAt: 1000,
      completedAt: 1200,
      metadata: {
        phase: "mount",
        baseDurationMs: 150,
      },
    },
  );

  assertEqual(
    result.durationMs,
    123.5,
    "external measurement duration is normalized",
  );
  assertEqual(
    result.startedAt,
    1000,
    "external measurement preserves source start time",
  );
  assertEqual(
    result.metadata?.phase,
    "mount",
    "external measurement preserves metadata",
  );
  assertEqual(
    timing.getSnapshot().completed.length,
    1,
    "external measurement enters timing history",
  );
}

function testAggregateStatistics() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  for (const durationMs of [10, 20, 30]) {
    timing.record(
      "panel-render",
      "eq-log/pulls",
      {
        durationMs,
        metadata: {
          moduleId: "eq-log",
          panelType: "pulls",
          phase: "mount",
        },
      },
    );
  }

  const aggregates = timing.getSnapshot().aggregates;

  assertEqual(
    aggregates.length,
    1,
    "matching operations share one aggregate",
  );

  const aggregate = aggregates[0];

  assertEqual(aggregate.count, 3, "aggregate counts observations");
  assertEqual(aggregate.minimumMs, 10, "aggregate tracks minimum");
  assertEqual(aggregate.averageMs, 20, "aggregate tracks average");
  assertEqual(aggregate.maximumMs, 30, "aggregate tracks maximum");
  assertEqual(aggregate.lastMs, 30, "aggregate tracks latest");
}

function testAggregateSeparatesPanelPhases() {
  const timing = createRuntimeTiming({
    now: makeClock(),
    logCompleted: false,
  });

  timing.record("panel-render", "eq-log/pulls", {
    durationMs: 100,
    metadata: {
      moduleId: "eq-log",
      panelType: "pulls",
      phase: "mount",
    },
  });

  timing.record("panel-render", "eq-log/pulls", {
    durationMs: 5,
    metadata: {
      moduleId: "eq-log",
      panelType: "pulls",
      phase: "update",
    },
  });

  assertEqual(
    timing.getSnapshot().aggregates.length,
    2,
    "mount and update remain separate aggregates",
  );
}

function testAggregateCardinalityIsBoundedAndDisposalReleasesActiveWork() {
  const timing = createRuntimeTiming({ now: makeClock(), aggregateLimit: 1, activeLimit: 1, logCompleted: false });
  const stale = timing.start("test", "stale");
  const current = timing.start("test", "current");
  assertEqual(timing.finish(stale), null, "old active traces are deterministically evicted");
  timing.finish(current);
  timing.record("other", "unaggregated", { durationMs: 5 });
  assertEqual(timing.getSnapshot().aggregates.length, 1, "aggregate cardinality is bounded");
  const beforeDispose = timing.getSnapshot();
  let notifications = 0;
  timing.subscribe(() => { notifications += 1; });
  timing.dispose();
  timing.start("after", "dispose");
  timing.record("after", "dispose", { durationMs: 1 });
  assertEqual(timing.getSnapshot(), beforeDispose, "disposal preserves immutable history and rejects new records");
  assertEqual(notifications, 0, "disposal releases timing subscribers");
}

function testProfilerMeasurementsAggregateByPhaseAndBoundMarks() {
  const timing = createRuntimeTiming({ now: makeClock(), marksLimit: 1, logCompleted: false });
  for (const phase of ["mount", "update"]) {
    timing.record("react-profiler", "core/calendar", { durationMs: 4, startedAt: 10, completedAt: 14, metadata: { moduleId: "core", panelType: "calendar", phase } });
  }
  const id = timing.start("long", "operation");
  timing.mark(id, "first");
  timing.mark(id, "bounded-away");
  const trace = timing.finish(id);
  assertEqual(timing.getSnapshot().aggregates.filter(({ category }) => category === "react-profiler").length, 2, "Profiler phases remain distinct aggregates");
  assertEqual(trace?.marks.length, 1, "marks are bounded per active trace");
}

testTraceLifecycle();
testNamedTrace();
testSubscribersReceiveCompletedTrace();
testHistoryLimit();
testExternalMeasurement();
testAggregateStatistics();
testAggregateSeparatesPanelPhases();
testAggregateCardinalityIsBoundedAndDisposalReleasesActiveWork();
testProfilerMeasurementsAggregateByPhaseAndBoundMarks();

console.log("Workspace Runtime Timing tests passed.");
