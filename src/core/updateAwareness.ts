export type UpdateState =
  | "checking"
  | "current"
  | "available"
  | "unavailable"
  | "offline"
  | "error";

export type UpdateProviderCapabilities = {
  checkForUpdates: boolean;
  installUpdate: boolean;
  restartAfterUpdate: boolean;
};

export type UpdateProviderDescriptor = {
  providerId: string;
  displayName: string;
  capabilities: UpdateProviderCapabilities;
};

export type UpdateProviderStatus<Context = undefined> =
  UpdateProviderDescriptor & {
    state: UpdateState;
    currentVersion: string | null;
    availableVersion: string | null;
    updateAvailable: boolean | null;
    lastSuccessfulCheck: string | null;
    releaseUrl: string | null;
    message: string | null;
    context?: Context;
  };

export type UpdateProvider<Context = undefined> = UpdateProviderDescriptor & {
  check: () => Promise<UpdateProviderStatus<Context>>;
};

export type UpdateAwarenessSnapshot<Context = undefined> = {
  revision: number;
  status: UpdateProviderStatus<Context>;
};

export type UpdateAwarenessService<Context = undefined> = {
  getSnapshot: () => UpdateAwarenessSnapshot<Context>;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  dispose: () => void;
};

const NO_PROVIDER: UpdateProviderDescriptor = {
  providerId: "none",
  displayName: "No update provider",
  capabilities: {
    checkForUpdates: false,
    installUpdate: false,
    restartAfterUpdate: false,
  },
};

function unavailableStatus<Context>(
  descriptor: UpdateProviderDescriptor,
  message: string,
): UpdateProviderStatus<Context> {
  return {
    ...descriptor,
    state: "unavailable",
    currentVersion: null,
    availableVersion: null,
    updateAvailable: null,
    lastSuccessfulCheck: null,
    releaseUrl: null,
    message,
  };
}

export function createUpdateAwarenessService<Context = undefined>(
  provider: UpdateProvider<Context> | null,
): UpdateAwarenessService<Context> {
  const descriptor = provider ?? NO_PROVIDER;
  const listeners = new Set<() => void>();
  let revision = 0;
  let generation = 0;
  let disposed = false;
  let status = unavailableStatus<Context>(
    descriptor,
    provider ? "Update status has not been checked." : "No update provider is configured.",
  );

  function publish(nextStatus: UpdateProviderStatus<Context>) {
    status = nextStatus;
    revision += 1;
    for (const listener of [...listeners]) listener();
  }

  return {
    getSnapshot() {
      return { revision, status };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async refresh() {
      if (!provider || disposed) return;

      const requestGeneration = ++generation;
      const previous = status;
      publish({
        ...previous,
        ...descriptor,
        state: "checking",
        message: null,
      });

      try {
        const result = await provider.check();
        if (disposed || requestGeneration !== generation) return;
        publish({
          ...result,
          lastSuccessfulCheck:
            result.lastSuccessfulCheck ?? previous.lastSuccessfulCheck,
        });
      } catch (error) {
        if (disposed || requestGeneration !== generation) return;
        publish({
          ...previous,
          ...descriptor,
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      listeners.clear();
    },
  };
}
