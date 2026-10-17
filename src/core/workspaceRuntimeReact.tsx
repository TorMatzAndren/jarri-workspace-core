import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { WorkspaceRuntime } from "./workspaceRuntime";

const RuntimeContext = createContext<WorkspaceRuntime | null>(null);

export function WorkspaceRuntimeProvider({ runtime, children }: { runtime: WorkspaceRuntime; children?: ReactNode }) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useWorkspaceRuntime(): WorkspaceRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("Workspace runtime diagnostics require WorkspaceRuntimeProvider.");
  return runtime;
}

export function useRuntimeTimingSnapshot() {
  const { timing } = useWorkspaceRuntime();
  return useSyncExternalStore(timing.subscribe, timing.getSnapshot, timing.getSnapshot);
}

export function useRuntimeObservationSnapshot() {
  const { observations } = useWorkspaceRuntime();
  return useSyncExternalStore(observations.subscribe, observations.getSnapshot, observations.getSnapshot);
}

export function useRuntimeResourceEvidenceSnapshot() {
  const { resourceEvidence } = useWorkspaceRuntime();
  return useSyncExternalStore(resourceEvidence.subscribe, resourceEvidence.getSnapshot, resourceEvidence.getSnapshot);
}

export function useRuntimeTraceSelectionSnapshot() {
  const { traceSelection } = useWorkspaceRuntime();
  return useSyncExternalStore(traceSelection.subscribe, traceSelection.getSnapshot, traceSelection.getSnapshot);
}
