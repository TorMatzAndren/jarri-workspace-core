import {
  canTransitionPanelPresentation,
  panelLifecycleCapabilities,
  type PanelLifecycleCapabilities,
  type PanelPresentationState,
} from "./panelLifecycle";

export type PanelLifecycleIdentity = Readonly<{
  panelId: string;
  generation: number;
}>;

export type PanelLifecycleReference = string | PanelLifecycleIdentity;

export type PanelLifecycleRecord = Readonly<{
  panelId: string;
  generation: number;
  state: PanelPresentationState;
  revision: number;
  capabilities: Readonly<PanelLifecycleCapabilities>;
}>;

export type PanelLifecycleSnapshot = Readonly<{
  revision: number;
  panels: Readonly<Record<string, PanelLifecycleRecord>>;
}>;

export type PanelLifecycleCoordinator = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PanelLifecycleSnapshot;
  getPanelState: (panel: PanelLifecycleReference) => PanelPresentationState | null;
  getPanelIdentity: (panelId: string) => PanelLifecycleIdentity | null;
  registerPanel: (
    panelId: string,
    capabilities?: Partial<PanelLifecycleCapabilities>,
  ) => PanelLifecycleIdentity;
  activatePanel: (panel: PanelLifecycleReference) => boolean;
  suspendPanel: (panel: PanelLifecycleReference) => boolean;
  disposePanel: (panel: PanelLifecycleReference) => boolean;
  reconcilePanels: (
    panelIds: readonly string[],
    capabilitiesByPanelId?: Readonly<Record<string, Partial<PanelLifecycleCapabilities>>>,
  ) => void;
  reconcileActivePanels: (
    panelIds: readonly string[],
    activationAllowed?: boolean,
  ) => void;
  dispose: () => void;
};

function immutableSnapshot(
  revision: number,
  records: ReadonlyMap<string, PanelLifecycleRecord>,
): PanelLifecycleSnapshot {
  const panels = Object.fromEntries(
    [...records.entries()].map(([panelId, record]) => [
      panelId,
      Object.freeze({
        ...record,
        capabilities: Object.freeze({ ...record.capabilities }),
      }),
    ]),
  );
  return Object.freeze({ revision, panels: Object.freeze(panels) });
}

function sameCapabilities(
  left: Readonly<PanelLifecycleCapabilities>,
  right: PanelLifecycleCapabilities,
) {
  return (
    left.projectionRetention === right.projectionRetention &&
    left.runtimeRetention === right.runtimeRetention &&
    left.backgroundActivity === right.backgroundActivity
  );
}

export function createPanelLifecycleCoordinator(): PanelLifecycleCoordinator {
  const records = new Map<string, PanelLifecycleRecord>();
  const listeners = new Set<() => void>();
  const disposedRecords = new Set<string>();
  let revision = 0;
  let nextGeneration = 1;
  let disposed = false;
  let snapshot = immutableSnapshot(revision, records);

  function assertUsable() {
    if (disposed) {
      throw new Error("Panel lifecycle coordinator has been disposed.");
    }
  }

  function publish() {
    revision += 1;
    snapshot = immutableSnapshot(revision, records);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A subscriber cannot interrupt lifecycle transitions for other panels.
      }
    }
  }

  function pruneDisposedRecords() {
    if (disposedRecords.size === 0) return;
    for (const panelId of disposedRecords) records.delete(panelId);
    disposedRecords.clear();
    publish();
  }

  function resolve(reference: PanelLifecycleReference): PanelLifecycleRecord | null {
    const panelId = typeof reference === "string" ? reference : reference.panelId;
    const record = records.get(panelId);
    if (!record) return null;
    if (typeof reference !== "string" && reference.generation !== record.generation) {
      return null;
    }
    return record;
  }

  function transition(record: PanelLifecycleRecord, nextState: PanelPresentationState) {
    if (record.state === nextState) return false;
    if (!canTransitionPanelPresentation(record.state, nextState)) {
      throw new Error(
        `Invalid panel lifecycle transition for ${record.panelId}: ${record.state} -> ${nextState}`,
      );
    }
    records.set(record.panelId, {
      ...record,
      state: nextState,
      revision: record.revision + 1,
    });
    if (nextState === "disposed") disposedRecords.add(record.panelId);
    publish();
    return true;
  }

  function registerPanel(
    panelId: string,
    declaredCapabilities?: Partial<PanelLifecycleCapabilities>,
  ): PanelLifecycleIdentity {
    assertUsable();
    pruneDisposedRecords();
    const normalizedPanelId = panelId.trim();
    if (!normalizedPanelId) {
      throw new Error("Panel lifecycle registration requires a panel ID.");
    }
    const capabilities = panelLifecycleCapabilities(declaredCapabilities);
    const current = records.get(normalizedPanelId);
    if (current) {
      if (!sameCapabilities(current.capabilities, capabilities)) {
        records.set(normalizedPanelId, {
          ...current,
          capabilities,
          revision: current.revision + 1,
        });
        publish();
      }
      return Object.freeze({ panelId: current.panelId, generation: current.generation });
    }
    const record: PanelLifecycleRecord = {
      panelId: normalizedPanelId,
      generation: nextGeneration++,
      state: "framed",
      revision: 1,
      capabilities,
    };
    records.set(normalizedPanelId, record);
    publish();
    return Object.freeze({ panelId: record.panelId, generation: record.generation });
  }

  function activatePanel(reference: PanelLifecycleReference): boolean {
    assertUsable();
    pruneDisposedRecords();
    let record = resolve(reference);
    if (!record && typeof reference === "string") {
      registerPanel(reference);
      record = resolve(reference);
    }
    if (!record) return false;
    if (record.state === "active" || record.state === "activating") return false;
    if (record.state !== "framed" && record.state !== "suspended") {
      throw new Error(`Panel cannot activate from ${record.state}: ${record.panelId}`);
    }
    transition(record, "activating");
    record = records.get(record.panelId)!;
    transition(record, "active");
    return true;
  }

  function suspendPanel(reference: PanelLifecycleReference): boolean {
    assertUsable();
    pruneDisposedRecords();
    const record = resolve(reference);
    if (!record) return false;
    if (record.state === "framed" || record.state === "suspended" || record.state === "suspending") {
      return false;
    }
    if (record.state !== "active" && record.state !== "activating") {
      throw new Error(`Panel cannot suspend from ${record.state}: ${record.panelId}`);
    }
    transition(record, "suspending");
    transition(records.get(record.panelId)!, "suspended");
    return true;
  }

  function disposePanel(reference: PanelLifecycleReference): boolean {
    assertUsable();
    pruneDisposedRecords();
    const record = resolve(reference);
    if (!record) return false;
    return transition(record, "disposed");
  }

  function reconcilePanels(
    panelIds: readonly string[],
    capabilitiesByPanelId: Readonly<Record<string, Partial<PanelLifecycleCapabilities>>> = {},
  ) {
    assertUsable();
    pruneDisposedRecords();
    const members = new Set(panelIds.map((id) => id.trim()).filter(Boolean));
    for (const id of members) registerPanel(id, capabilitiesByPanelId[id]);
    for (const [panelId, record] of [...records]) {
      if (!members.has(panelId)) disposePanel({ panelId, generation: record.generation });
    }
  }

  function reconcileActivePanels(panelIds: readonly string[], activationAllowed = true) {
    assertUsable();
    pruneDisposedRecords();
    const active = new Set(panelIds);
    for (const panelId of active) {
      const record = records.get(panelId);
      if (!record || record.state === "disposed") continue;
      if (activationAllowed) {
        activatePanel({ panelId, generation: record.generation });
      } else if (record.state === "active" || record.state === "activating") {
        suspendPanel({ panelId, generation: record.generation });
      }
    }
    for (const [panelId, record] of [...records]) {
      if (!active.has(panelId) && (record.state === "active" || record.state === "activating")) {
        suspendPanel({ panelId, generation: record.generation });
      }
    }
  }

  function dispose() {
    if (disposed) return;
    for (const [panelId, record] of [...records]) {
      if (record.state !== "disposed") {
        if (!canTransitionPanelPresentation(record.state, "disposed")) {
          throw new Error(`Invalid panel lifecycle teardown transition for ${panelId}`);
        }
        records.set(panelId, { ...record, state: "disposed", revision: record.revision + 1 });
      }
    }
    if (records.size > 0) publish();
    records.clear();
    disposedRecords.clear();
    disposed = true;
    if (snapshot.panels && Object.keys(snapshot.panels).length > 0) {
      revision += 1;
      snapshot = immutableSnapshot(revision, records);
    }
    listeners.clear();
  }

  return {
    subscribe(listener) {
      assertUsable();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot() { return snapshot; },
    getPanelState(reference) { return resolve(reference)?.state ?? null; },
    getPanelIdentity(panelId) {
      const record = records.get(panelId);
      return record && record.state !== "disposed"
        ? Object.freeze({ panelId: record.panelId, generation: record.generation })
        : null;
    },
    registerPanel,
    activatePanel,
    suspendPanel,
    disposePanel,
    reconcilePanels,
    reconcileActivePanels,
    dispose,
  };
}
