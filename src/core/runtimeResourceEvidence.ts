/** Semantic application-owned resource claims. These are not physical process measurements. */
export type RuntimeResourceEvidenceKind = "exact-known";
export type RuntimeResourceEvidenceUnit = "bytes";

export type RuntimeResourceEvidenceClaim = Readonly<{
  owner: Readonly<{ kind: "panel"; id: string }>;
  resourceClass: string;
  resourceKey: string;
  evidenceKind: RuntimeResourceEvidenceKind;
  quantity: number;
  unit: RuntimeResourceEvidenceUnit;
}>;

export type RuntimeResourceEvidenceSnapshot = Readonly<{
  revision: number;
  claims: readonly RuntimeResourceEvidenceClaim[];
}>;

export type RuntimeResourceEvidenceLease = {
  update: (quantity: number) => void;
  release: () => void;
};

export type RuntimeResourceEvidenceRegistry = {
  acquire: (claim: Omit<RuntimeResourceEvidenceClaim, "owner"> & { owner: { kind: "panel"; id: string } }) => RuntimeResourceEvidenceLease;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RuntimeResourceEvidenceSnapshot;
};

export type RuntimeResourceEvidencePublisher = {
  acquire: (claim: Omit<RuntimeResourceEvidenceClaim, "owner">) => RuntimeResourceEvidenceLease;
};

function required(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  return normalized;
}

function validateQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Resource evidence quantity must be a finite non-negative number.");
  }
  return quantity;
}

function identity(ownerId: string, resourceClass: string, resourceKey: string) {
  return JSON.stringify([ownerId, resourceClass, resourceKey]);
}

/**
 * Keeps one current claim per panel/class/key. Duplicate acquisitions share that
 * canonical claim and must agree on evidence kind, unit, and initial quantity;
 * each lease releases one reference and the claim disappears after the last.
 */
export function createRuntimeResourceEvidenceRegistry(): RuntimeResourceEvidenceRegistry {
  const records = new Map<string, { claim: RuntimeResourceEvidenceClaim; references: number }>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let snapshot: RuntimeResourceEvidenceSnapshot = Object.freeze({ revision, claims: Object.freeze([]) });

  function publish() {
    revision += 1;
    snapshot = Object.freeze({
      revision,
      claims: Object.freeze([...records.values()].map(({ claim }) => claim)),
    });
    for (const listener of listeners) listener();
  }

  return {
    acquire(input) {
      const ownerId = required("Panel owner ID", input.owner.id);
      const resourceClass = required("Resource class", input.resourceClass);
      const resourceKey = required("Resource key", input.resourceKey);
      if (input.evidenceKind !== "exact-known") throw new Error("Unsupported resource evidence kind.");
      if (input.unit !== "bytes") throw new Error("Unsupported resource evidence unit.");
      const quantity = validateQuantity(input.quantity);
      const key = identity(ownerId, resourceClass, resourceKey);
      const existing = records.get(key);
      if (existing) {
        if (existing.claim.quantity !== quantity || existing.claim.unit !== input.unit || existing.claim.evidenceKind !== input.evidenceKind) {
          throw new Error(`Conflicting duplicate resource evidence claim: ${resourceClass}/${resourceKey}`);
        }
        existing.references += 1;
      } else {
        records.set(key, {
          references: 1,
          claim: Object.freeze({
            owner: Object.freeze({ kind: "panel", id: ownerId }),
            resourceClass,
            resourceKey,
            evidenceKind: input.evidenceKind,
            quantity,
            unit: input.unit,
          }),
        });
        publish();
      }

      let released = false;
      return {
        update(nextQuantity) {
          if (released) return;
          const record = records.get(key);
          if (!record) return;
          const normalized = validateQuantity(nextQuantity);
          if (record.claim.quantity === normalized) return;
          record.claim = Object.freeze({ ...record.claim, quantity: normalized });
          publish();
        },
        release() {
          if (released) return;
          released = true;
          const record = records.get(key);
          if (!record) return;
          record.references -= 1;
          if (record.references === 0) {
            records.delete(key);
            publish();
          }
        },
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/** A panel-body scope that releases all acquired claims on disposal. */
export function createPanelResourceEvidencePublisher(
  registry: RuntimeResourceEvidenceRegistry,
  ownerId: string,
): RuntimeResourceEvidencePublisher & { activate: () => void; dispose: () => void } {
  const leases = new Set<RuntimeResourceEvidenceLease>();
  let disposed = false;
  return {
    activate() {
      disposed = false;
    },
    acquire(claim) {
      if (disposed) throw new Error("Panel resource evidence publisher is disposed.");
      const lease = registry.acquire({ ...claim, owner: { kind: "panel", id: ownerId } });
      let released = false;
      const scopedLease = {
        update(quantity: number) {
          if (!released) lease.update(quantity);
        },
        release() {
          if (released) return;
          released = true;
          leases.delete(scopedLease);
          lease.release();
        },
      };
      leases.add(scopedLease);
      return scopedLease;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const lease of [...leases]) lease.release();
    },
  };
}
