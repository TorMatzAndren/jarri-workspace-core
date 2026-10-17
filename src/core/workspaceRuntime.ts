import {
  createWorkspaceModuleRuntime,
  type WorkspaceModuleRuntime,
} from "./moduleRuntime";
import type { WorkspaceModuleDefinition } from "./types";
import {
  createPanelLifecycleCoordinator,
  type PanelLifecycleCoordinator,
} from "./panelLifecycleCoordinator";
import {
  createRuntimeTiming,
  type RuntimeTiming,
} from "./runtimeTiming";
import { createRuntimeObservationRegistry, type RuntimeObservationRegistry } from "./runtimeObservation";
import { createRuntimeResourceEvidenceRegistry, type RuntimeResourceEvidenceRegistry } from "./runtimeResourceEvidence";
import { createRuntimeTraceSelection, type RuntimeTraceSelection } from "./runtimeTraceSelection";

export type WorkspaceRuntime = WorkspaceModuleRuntime & {
  lifecycle: PanelLifecycleCoordinator;
  timing: RuntimeTiming;
  observations: RuntimeObservationRegistry;
  resourceEvidence: RuntimeResourceEvidenceRegistry;
  traceSelection: RuntimeTraceSelection;
  registerCleanup: (cleanup: () => void) => void;
  dispose: () => void;
};

export type WorkspaceRuntimeContributor = (
  runtime: WorkspaceRuntime,
) => void | (() => void);

export type WorkspaceRuntimeComposition = {
  modules?: readonly WorkspaceModuleDefinition[];
  contributors?: readonly WorkspaceRuntimeContributor[];
};

export function createWorkspaceRuntime(): WorkspaceRuntime {
  const modules = createWorkspaceModuleRuntime();
  const lifecycle = createPanelLifecycleCoordinator();
  const timing = createRuntimeTiming({ logCompleted: false });
  const observations = createRuntimeObservationRegistry();
  const resourceEvidence = createRuntimeResourceEvidenceRegistry();
  const traceSelection = createRuntimeTraceSelection();
  const cleanups: Array<() => void> = [];
  let disposed = false;
  cleanups.push(() => lifecycle.dispose());
  cleanups.push(() => timing.dispose());
  cleanups.push(() => traceSelection.dispose());
  cleanups.push(() => observations.dispose());
  cleanups.push(() => resourceEvidence.dispose());

  const runtime: WorkspaceRuntime = {
    ...modules,
    lifecycle,
    timing,
    observations,
    resourceEvidence,
    traceSelection,
    registerCleanup(cleanup) {
      if (disposed) {
        throw new Error("Cannot register cleanup on a disposed Workspace Runtime.");
      }

      cleanups.push(cleanup);
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      let firstError: unknown;

      for (let index = cleanups.length - 1; index >= 0; index -= 1) {
        try {
          cleanups[index]();
        } catch (error) {
          firstError ??= error;
        }
      }

      cleanups.length = 0;

      if (firstError) {
        throw firstError;
      }
    },
  };

  return runtime;
}

export function bootstrapWorkspaceRuntime({
  modules = [],
  contributors = [],
}: WorkspaceRuntimeComposition = {}): WorkspaceRuntime {
  const runtime = createWorkspaceRuntime();
  const startupTrace = runtime.timing.start("workspace-startup", "bootstrap");

  try {
    for (const module of modules) {
      runtime.registerModule(module);
    }

    for (const contribute of contributors) {
      const cleanup = contribute(runtime);

      if (cleanup) {
        runtime.registerCleanup(cleanup);
      }
    }
    runtime.timing.annotate(startupTrace, { modules: modules.length, contributors: contributors.length, outcome: "complete" });
    runtime.timing.finish(startupTrace);
  } catch (error) {
    runtime.timing.annotate(startupTrace, { modules: modules.length, contributors: contributors.length, outcome: "rollback" });
    runtime.timing.finish(startupTrace);
    try {
      runtime.dispose();
    } catch {
      // The composition error is authoritative during rollback.
    }

    throw error;
  }

  return runtime;
}
