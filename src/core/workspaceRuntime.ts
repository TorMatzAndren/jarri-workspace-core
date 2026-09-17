import {
  createWorkspaceModuleRuntime,
  type WorkspaceModuleRuntime,
} from "./moduleRuntime";
import type { WorkspaceModuleDefinition } from "./types";

export type WorkspaceRuntime = WorkspaceModuleRuntime & {
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
  const cleanups: Array<() => void> = [];
  let disposed = false;

  const runtime: WorkspaceRuntime = {
    ...modules,
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
  } catch (error) {
    try {
      runtime.dispose();
    } catch {
      // The composition error is authoritative during rollback.
    }

    throw error;
  }

  return runtime;
}
