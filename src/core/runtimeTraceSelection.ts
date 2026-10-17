export type RuntimeTraceSelectionValue = Readonly<{
  channel: string;
  kind: "trace" | "aggregate";
  id: string;
}>;

export type RuntimeTraceSelectionSnapshot = Readonly<{
  revision: number;
  selections: readonly RuntimeTraceSelectionValue[];
}>;

export type RuntimeTraceSelection = {
  select: (channel: string, kind: "trace" | "aggregate", id: string) => void;
  clear: (channel: string) => void;
  getSnapshot: () => RuntimeTraceSelectionSnapshot;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
};

export function createRuntimeTraceSelection(): RuntimeTraceSelection {
  const selections = new Map<string, RuntimeTraceSelectionValue>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let snapshot: RuntimeTraceSelectionSnapshot = Object.freeze({ revision, selections: Object.freeze([]) });
  let disposed = false;
  const publish = () => {
    revision += 1;
    snapshot = Object.freeze({ revision, selections: Object.freeze([...selections.values()]) });
    listeners.forEach((listener) => listener());
  };
  return {
    select(channel, kind, id) {
      if (disposed) return;
      if (!channel.trim() || !id.trim()) return;
      selections.set(channel, Object.freeze({ channel, kind, id }));
      publish();
    },
    clear(channel) {
      if (disposed) return;
      if (selections.delete(channel)) publish();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      selections.clear();
      listeners.clear();
      revision += 1;
      snapshot = Object.freeze({ revision, selections: Object.freeze([]) });
    },
  };
}
