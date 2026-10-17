export type RuntimeObserver =
  | {
      kind: "panel";
      id: string;
    };

export type RuntimeObservedResource =
  | {
      kind: "backend";
      key: string;
    }
  | {
      kind: "execution";
      key: string;
    }
  | {
      kind: "projection";
      key: string;
    };

export type RuntimeObservationEdge = {
  observer: RuntimeObserver;
  resource: RuntimeObservedResource;
  count: number;
};

export type RuntimeObservationSnapshot = {
  revision: number;
  observations: readonly RuntimeObservationEdge[];
};

export type RuntimeObservationLease = {
  release: () => void;
};

export type RuntimeObservationRegistry = {
  observe: (edge: {
    observer: RuntimeObserver;
    resource: RuntimeObservedResource;
  }) => RuntimeObservationLease;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RuntimeObservationSnapshot;
  clear: () => void;
};

function normalizeLabel(label: string, value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} requires a non-empty value.`);
  }

  return normalized;
}

function normalizeObserver(observer: RuntimeObserver): RuntimeObserver {
  switch (observer.kind) {
    case "panel":
      return Object.freeze({
        kind: observer.kind,
        id: normalizeLabel("Panel observer", observer.id),
      });
  }
}

function normalizeResource(
  resource: RuntimeObservedResource,
): RuntimeObservedResource {
  switch (resource.kind) {
    case "backend":
    case "execution":
    case "projection":
      return Object.freeze({
        kind: resource.kind,
        key: normalizeLabel("Observed Runtime resource", resource.key),
      });
  }
}

function observerKey(observer: RuntimeObserver): string {
  switch (observer.kind) {
    case "panel":
      return `panel:${observer.id}`;
  }
}

function resourceKey(resource: RuntimeObservedResource): string {
  return `${resource.kind}:${resource.key}`;
}

function edgeKey(
  observer: RuntimeObserver,
  resource: RuntimeObservedResource,
): string {
  return `${observerKey(observer)}->${resourceKey(resource)}`;
}

function immutableSnapshot(
  revision: number,
  observations: ReadonlyMap<string, RuntimeObservationEdge>,
): RuntimeObservationSnapshot {
  return Object.freeze({
    revision,
    observations: Object.freeze(
      [...observations.values()]
        .sort((left, right) => {
          const leftKey = edgeKey(left.observer, left.resource);
          const rightKey = edgeKey(right.observer, right.resource);
          return leftKey.localeCompare(rightKey);
        })
        .map((edge) =>
          Object.freeze({
            observer: Object.freeze({ ...edge.observer }),
            resource: Object.freeze({ ...edge.resource }),
            count: edge.count,
          }),
        ),
    ),
  });
}

export function createRuntimeObservationRegistry():
  RuntimeObservationRegistry {
  const observations = new Map<string, RuntimeObservationEdge>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let snapshot = immutableSnapshot(revision, observations);

  function publish() {
    revision += 1;
    snapshot = immutableSnapshot(revision, observations);

    for (const listener of listeners) {
      listener();
    }
  }

  return {
    observe({ observer, resource }) {
      const normalizedObserver = normalizeObserver(observer);
      const normalizedResource = normalizeResource(resource);
      const key = edgeKey(normalizedObserver, normalizedResource);
      const existing = observations.get(key);

      observations.set(key, {
        observer: normalizedObserver,
        resource: normalizedResource,
        count: (existing?.count ?? 0) + 1,
      });
      publish();

      let released = false;

      return {
        release() {
          if (released) {
            return;
          }

          released = true;
          const current = observations.get(key);

          if (!current) {
            return;
          }

          if (current.count <= 1) {
            observations.delete(key);
          } else {
            observations.set(key, {
              ...current,
              count: current.count - 1,
            });
          }

          publish();
        },
      };
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    clear() {
      if (!observations.size) {
        return;
      }

      observations.clear();
      publish();
    },
  };
}
