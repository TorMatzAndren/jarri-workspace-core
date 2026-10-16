import {
  bootstrapWorkspaceRuntime,
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from "./workspaceRuntime";
import type { WorkspaceModuleDefinition } from "./types";

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

function testBareRuntimeHasNoDistributionModules() {
  const runtime = createWorkspaceRuntime();

  assertEqual(
    runtime.listModules().length,
    0,
    "bare runtime does not inherit distribution modules",
  );
  assertEqual(
    runtime.registry.listPanels().length,
    0,
    "bare runtime does not inherit distribution panels",
  );

  runtime.dispose();
}

function module(moduleId: string): WorkspaceModuleDefinition {
  return {
    moduleId,
    title: moduleId,
    version: "1.0.0",
    panels: [],
  };
}

function testCompositionRegistersModulesAndCleansUpExactlyOnce() {
  const events: string[] = [];
  let runtimeFromContributor: WorkspaceRuntime | undefined;

  const runtime = bootstrapWorkspaceRuntime({
    modules: [module("base")],
    contributors: [
      (contributedRuntime) => {
        runtimeFromContributor = contributedRuntime;
        contributedRuntime.registerModule(module("contributed"));
        events.push("contributor-start");

        return () => {
          events.push("contributor-dispose");
        };
      },
      () => {
        events.push("second-contributor-start");

        return () => {
          events.push("second-contributor-dispose");
        };
      },
    ],
  });

  assertEqual(runtimeFromContributor, runtime, "contributors receive the runtime");
  assertEqual(
    runtime.listModules().map(({ moduleId }) => moduleId).join(","),
    "base,contributed",
    "composition registers supplied and contributed modules",
  );

  runtime.lifecycle.registerPanel("runtime-owned-panel");
  let disposedSnapshotObserved = false;
  const unsubscribeLifecycle = runtime.lifecycle.subscribe(() => {
    disposedSnapshotObserved =
      runtime.lifecycle.getSnapshot().panels["runtime-owned-panel"]?.state ===
      "disposed";
  });

  runtime.dispose();
  runtime.dispose();
  unsubscribeLifecycle();

  assertEqual(
    Object.keys(runtime.lifecycle.getSnapshot().panels).length,
    0,
    "runtime disposal releases lifecycle records and subscriptions",
  );
  assert(
    disposedSnapshotObserved,
    "runtime teardown notifies lifecycle subscribers of panel disposal",
  );

  assertEqual(
    events.join(","),
    "contributor-start,second-contributor-start,second-contributor-dispose,contributor-dispose",
    "contributor cleanup runs in deterministic reverse order exactly once",
  );
}

function testFailedCompositionRollsBackWithoutMaskingOriginalError() {
  const events: string[] = [];
  const compositionError = new Error("composition failed");
  const cleanupError = new Error("cleanup failed");
  let caughtError: unknown;

  try {
    bootstrapWorkspaceRuntime({
      contributors: [
        () => {
          events.push("first-start");

          return () => {
            events.push("first-dispose");
          };
        },
        () => {
          events.push("second-start");

          return () => {
            events.push("second-dispose");
            throw cleanupError;
          };
        },
        () => {
          events.push("third-start");

          return () => {
            events.push("third-dispose");
          };
        },
        () => {
          events.push("failing-start");
          throw compositionError;
        },
      ],
    });
  } catch (error) {
    caughtError = error;
  }

  assertEqual(
    caughtError,
    compositionError,
    "failed composition preserves the original contributor error",
  );
  assertEqual(
    events.join(","),
    "first-start,second-start,third-start,failing-start,third-dispose,second-dispose,first-dispose",
    "failed composition cleans up successful contributors in reverse order exactly once",
  );
}

testBareRuntimeHasNoDistributionModules();
testCompositionRegistersModulesAndCleansUpExactlyOnce();
testFailedCompositionRollsBackWithoutMaskingOriginalError();

console.log("Workspace runtime composition tests passed.");
