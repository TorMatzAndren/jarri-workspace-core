export type RuntimeTimingMark = {
  label: string;
  elapsedMs: number;
};

export type RuntimeTimingMetadataValue =
  | string
  | number
  | boolean
  | null;

export type RuntimeTimingTrace = {
  id: number;
  category: string;
  label: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  marks: readonly RuntimeTimingMark[];
  metadata?: Record<string, RuntimeTimingMetadataValue>;
};

type ActiveRuntimeTimingTrace = Omit<RuntimeTimingTrace, "marks"> & {
  marks: RuntimeTimingMark[];
};

export type RuntimeTimingAggregate = {
  key: string;
  category: string;
  label: string;
  count: number;
  totalMs: number;
  minimumMs: number;
  averageMs: number;
  maximumMs: number;
  lastMs: number;
  firstObservedAt: number;
  lastObservedAt: number;
  metadata?: Record<string, RuntimeTimingMetadataValue>;
};

export type RuntimeTimingSnapshot = {
  revision: number;
  completed: readonly RuntimeTimingTrace[];
  aggregates: readonly RuntimeTimingAggregate[];
};

export type RuntimeTiming = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RuntimeTimingSnapshot;

  start: (
    category: string,
    label: string,
    metadata?: Record<string, RuntimeTimingMetadataValue>,
  ) => number;
  annotate: (
    traceId: number | null,
    metadata: Record<string, RuntimeTimingMetadataValue>,
  ) => void;
  mark: (traceId: number | null, label: string) => void;
  finish: (
    traceId: number | null,
    label?: string,
  ) => RuntimeTimingTrace | null;

  record: (
    category: string,
    label: string,
    measurement: {
      durationMs: number;
      startedAt?: number;
      completedAt?: number;
      metadata?: Record<string, RuntimeTimingMetadataValue>;
    },
  ) => RuntimeTimingTrace;

  startNamed: (
    name: string,
    category: string,
    label: string,
  ) => number;
  markNamed: (name: string, label: string) => void;
  finishNamed: (
    name: string,
    label?: string,
  ) => RuntimeTimingTrace | null;

  clearCompleted: () => void;
  setCompletedSink: (
    sink: ((trace: RuntimeTimingTrace) => void) | null,
  ) => void;
  dispose: () => void;
};

function roundMilliseconds(value: number): number {
  return Math.round(value * 10) / 10;
}

function immutableMetadata(
  metadata: Record<string, RuntimeTimingMetadataValue> | undefined,
) {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

export function createRuntimeTiming(options: {
  now?: () => number;
  historyLimit?: number;
  aggregateLimit?: number;
  activeLimit?: number;
  marksLimit?: number;
  logCompleted?: boolean;
} = {}): RuntimeTiming {
  const now = options.now ?? (() => performance.now());
  const historyLimit = Math.max(1, options.historyLimit ?? 100);
  const aggregateLimit = Math.max(1, options.aggregateLimit ?? 100);
  const activeLimit = Math.max(1, options.activeLimit ?? 1000);
  const marksLimit = Math.max(1, options.marksLimit ?? 100);
  const logCompleted = options.logCompleted ?? true;

  let nextTraceId = 1;
  let revision = 0;

  const active = new Map<number, ActiveRuntimeTimingTrace>();
  const named = new Map<string, number>();
  const completed: RuntimeTimingTrace[] = [];
  const aggregates = new Map<string, RuntimeTimingAggregate>();
  const listeners = new Set<() => void>();
  let completedSink: ((trace: RuntimeTimingTrace) => void) | null = null;
  let disposed = false;

  let snapshot: RuntimeTimingSnapshot = {
    revision,
    completed: Object.freeze([]),
    aggregates: Object.freeze([]),
  };

  function publish() {
    revision += 1;
    snapshot = Object.freeze({
      revision,
      completed: Object.freeze(
        completed.map((trace) => Object.freeze({
          ...trace,
          marks: Object.freeze(trace.marks.map((mark) => Object.freeze({ ...mark }))),
          metadata: immutableMetadata(trace.metadata),
        })),
      ),
      aggregates: Object.freeze(
        Array.from(aggregates.values(), (aggregate) => Object.freeze({
          ...aggregate,
          metadata: immutableMetadata(aggregate.metadata),
        })),
      ),
    });

    for (const listener of listeners) {
      listener();
    }
  }

  function start(
    category: string,
    label: string,
    metadata?: Record<string, RuntimeTimingMetadataValue>,
  ): number {
    if (disposed) return -1;
    const id = nextTraceId++;

    while (active.size >= activeLimit) {
      const oldest = active.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      active.delete(oldest);
      for (const [name, namedId] of named) if (namedId === oldest) named.delete(name);
    }

    active.set(id, {
      id,
      category,
      label,
      startedAt: now(),
      marks: [],
      metadata: metadata ? { ...metadata } : undefined,
    });

    return id;
  }

  function annotate(
    traceId: number | null,
    metadata: Record<string, RuntimeTimingMetadataValue>,
  ): void {
    if (disposed) return;
    if (traceId === null) {
      return;
    }

    const trace = active.get(traceId);

    if (!trace) {
      return;
    }

    trace.metadata = {
      ...trace.metadata,
      ...metadata,
    };
  }

  function mark(traceId: number | null, label: string): void {
    if (disposed) return;
    if (traceId === null) {
      return;
    }

    const trace = active.get(traceId);

    if (!trace) {
      return;
    }

    if (trace.marks.length < marksLimit) {
      trace.marks.push({
        label,
        elapsedMs: roundMilliseconds(now() - trace.startedAt),
      });
    }
  }

  function aggregateKey(trace: RuntimeTimingTrace): string {
    if (trace.category === "panel-render" || trace.category === "react-profiler") {
      const moduleId =
        typeof trace.metadata?.moduleId === "string"
          ? trace.metadata.moduleId
          : "";
      const panelType =
        typeof trace.metadata?.panelType === "string"
          ? trace.metadata.panelType
          : "";
      const phase =
        typeof trace.metadata?.phase === "string"
          ? trace.metadata.phase
          : "";

      return [
        trace.category,
        moduleId,
        panelType,
        phase,
      ].join("|");
    }

    return `${trace.category}|${trace.label}`;
  }

  function updateAggregate(trace: RuntimeTimingTrace): void {
    const durationMs = trace.durationMs;

    if (durationMs === undefined) {
      return;
    }

    const key = aggregateKey(trace);
    const observedAt = trace.completedAt ?? trace.startedAt;
    const previous = aggregates.get(key);

    if (!previous) {
      if (aggregates.size >= aggregateLimit) return;
      aggregates.set(key, {
        key,
        category: trace.category,
        label: trace.label,
        count: 1,
        totalMs: durationMs,
        minimumMs: durationMs,
        averageMs: durationMs,
        maximumMs: durationMs,
        lastMs: durationMs,
        firstObservedAt: observedAt,
        lastObservedAt: observedAt,
        metadata: trace.metadata
          ? { ...trace.metadata }
          : undefined,
      });
      return;
    }

    const count = previous.count + 1;
    const totalMs = previous.totalMs + durationMs;

    aggregates.set(key, {
      ...previous,
      count,
      totalMs,
      minimumMs: Math.min(previous.minimumMs, durationMs),
      averageMs: totalMs / count,
      maximumMs: Math.max(previous.maximumMs, durationMs),
      lastMs: durationMs,
      lastObservedAt: observedAt,
      metadata: trace.metadata
        ? { ...trace.metadata }
        : previous.metadata,
    });
  }

  function commitCompletedTrace(
    result: RuntimeTimingTrace,
  ): RuntimeTimingTrace {
    if (disposed) return result;
    updateAggregate(result);
    completed.push(result);

    while (completed.length > historyLimit) {
      completed.shift();
    }

    publish();

    if (logCompleted) {
      console.log(
        `[Workspace timing] ${result.category}: ${result.label}`,
        {
          durationMs: result.durationMs,
          marks: result.marks,
          metadata: result.metadata,
        },
      );
    }

    completedSink?.(result);

    return result;
  }

  function record(
    category: string,
    label: string,
    measurement: {
      durationMs: number;
      startedAt?: number;
      completedAt?: number;
      metadata?: Record<string, RuntimeTimingMetadataValue>;
    },
  ): RuntimeTimingTrace {
    const completedAt = measurement.completedAt ?? now();
    const startedAt =
      measurement.startedAt ??
      completedAt - measurement.durationMs;

    return commitCompletedTrace({
      id: nextTraceId++,
      category,
      label,
      startedAt,
      completedAt,
      durationMs: roundMilliseconds(measurement.durationMs),
      marks: [],
      metadata: measurement.metadata ? { ...measurement.metadata } : undefined,
    });
  }

  function finish(
    traceId: number | null,
    label = "complete",
  ): RuntimeTimingTrace | null {
    if (traceId === null) {
      return null;
    }

    const trace = active.get(traceId);

    if (!trace) {
      return null;
    }

    mark(traceId, label);

    const completedAt = now();
    const result: RuntimeTimingTrace = {
      ...trace,
      completedAt,
      durationMs: roundMilliseconds(completedAt - trace.startedAt),
      marks: [...trace.marks],
    };

    active.delete(traceId);

    return commitCompletedTrace(result);
  }

  function startNamed(
    name: string,
    category: string,
    label: string,
  ): number {
    if (disposed) return -1;
    const previous = named.get(name);

    if (previous !== undefined) {
      active.delete(previous);
    }

    const traceId = start(category, label);
    named.set(name, traceId);
    return traceId;
  }

  function markNamed(name: string, label: string): void {
    const traceId = named.get(name);

    if (traceId !== undefined) {
      mark(traceId, label);
    }
  }

  function finishNamed(
    name: string,
    label = "complete",
  ): RuntimeTimingTrace | null {
    const traceId = named.get(name);

    if (traceId === undefined) {
      return null;
    }

    named.delete(name);
    return finish(traceId, label);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    start,
    annotate,
    mark,
    finish,
    record,

    startNamed,
    markNamed,
    finishNamed,

    clearCompleted() {
      completed.length = 0;
      publish();
    },

    setCompletedSink(sink) {
      if (!disposed) completedSink = sink;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      active.clear();
      named.clear();
      completedSink = null;
      listeners.clear();
    },
  };
}
