export const SEMANTIC_COPY_CONTROL_ID = "semantic-copy";
export const FONT_DECREASE_CONTROL_ID = "font-decrease";
export const FONT_INCREASE_CONTROL_ID = "font-increase";

export const PANEL_FONT_SCALE_STEPS = [
  0.75,
  0.85,
  1,
  1.15,
  1.3,
  1.5,
  1.75,
  2,
] as const;

export type PanelFrameControlKind =
  | "copy"
  | "font-decrease"
  | "font-increase";

export type PanelFrameControlDefinition = {
  controlId: string;
  label: string;
  kind: PanelFrameControlKind;
  defaultEnabled: boolean;
};

export type PanelFrameControlRuntimePayload = {
  kind: "copy";
  copyText: () => string;
};

export type PanelFrameControlPublicationLease = {
  release: () => void;
};

export type PanelFrameControlPublisher = {
  publish: (
    controlId: string,
    payload: PanelFrameControlRuntimePayload,
  ) => PanelFrameControlPublicationLease;
};

export type PanelFrameControlCenter = PanelFrameControlPublisher & {
  getSnapshot: () => PanelFrameControlRuntimeSnapshot;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
};

export type PanelFrameControlRuntimeSnapshot = {
  payloads: ReadonlyMap<string, PanelFrameControlRuntimePayload>;
};

export type WorkspaceFrameControlPreferences = {
  visibility: Record<string, boolean>;
};

export type PanelFrameControlViewState = {
  definition: PanelFrameControlDefinition;
  key: string;
  enabled: boolean;
  available: boolean;
  status: "available" | "unavailable" | "disabled";
  payload: PanelFrameControlRuntimePayload | null;
};

const CONTROL_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export const WORKSPACE_FRAME_CONTROL_CATALOG:
  readonly PanelFrameControlDefinition[] = [
    {
      controlId: SEMANTIC_COPY_CONTROL_ID,
      label: "Copy",
      kind: "copy",
      defaultEnabled: true,
    },
    {
      controlId: FONT_DECREASE_CONTROL_ID,
      label: "Font -",
      kind: "font-decrease",
      defaultEnabled: true,
    },
    {
      controlId: FONT_INCREASE_CONTROL_ID,
      label: "Font +",
      kind: "font-increase",
      defaultEnabled: true,
    },
  ];

export function nextPanelFontScale(
  current: number,
  direction: "decrease" | "increase",
): number {
  if (direction === "increase") {
    return (
      PANEL_FONT_SCALE_STEPS.find((step) => step > current + 0.000001) ??
      PANEL_FONT_SCALE_STEPS[PANEL_FONT_SCALE_STEPS.length - 1]
    );
  }

  return (
    [...PANEL_FONT_SCALE_STEPS]
      .reverse()
      .find((step) => step < current - 0.000001) ??
    PANEL_FONT_SCALE_STEPS[0]
  );
}

export function panelFrameControlKey(
  moduleId: string,
  panelType: string,
  controlId: string,
): string {
  return `${moduleId}:${panelType}:${controlId}`;
}

export function normalizeFrameControlPreferences(
  input: unknown,
): WorkspaceFrameControlPreferences {
  if (!isRecord(input) || !isRecord(input.visibility)) {
    return { visibility: {} };
  }

  const visibility: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(input.visibility)) {
    if (typeof value === "boolean" && isValidFrameControlKey(key)) {
      visibility[key] = value;
    }
  }

  return { visibility };
}

export function isPanelFrameControlEnabled({
  control,
  key,
  preferences,
}: {
  control: PanelFrameControlDefinition;
  key: string;
  preferences: WorkspaceFrameControlPreferences;
}): boolean {
  return preferences.visibility[key] ?? control.defaultEnabled;
}

export function panelFrameControlViewStates({
  controls,
  moduleId,
  panelType,
  preferences,
  runtimeSnapshot,
}: {
  controls: readonly PanelFrameControlDefinition[];
  moduleId: string;
  panelType: string;
  preferences: WorkspaceFrameControlPreferences;
  runtimeSnapshot: PanelFrameControlRuntimeSnapshot;
}): PanelFrameControlViewState[] {
  return controls.map((definition) => {
    const key = panelFrameControlKey(moduleId, panelType, definition.controlId);
    const enabled = isPanelFrameControlEnabled({
      control: definition,
      key,
      preferences,
    });
    const payload = runtimeSnapshot.payloads.get(definition.controlId) ?? null;
    const requiresRuntimePayload = definition.kind === "copy";
    const available = enabled && (!requiresRuntimePayload || !!payload);

    return {
      definition,
      key,
      enabled,
      available,
      payload,
      status: !enabled ? "disabled" : available ? "available" : "unavailable",
    };
  });
}

export function enabledHeaderPanelFrameControls(
  controls: readonly PanelFrameControlViewState[],
): PanelFrameControlViewState[] {
  return controls.filter((control) => control.enabled);
}

export async function invokePanelFrameCopyControl(
  control: PanelFrameControlViewState,
  writeText: (text: string) => Promise<void>,
): Promise<void> {
  if (!control.payload) {
    throw new Error(`Frame control is unavailable: ${control.definition.controlId}`);
  }
  await writeText(control.payload.copyText());
}

export function createFrameControlCenter(): PanelFrameControlCenter {
  let generation = 0;
  let nextPublicationId = 1;
  let snapshot: PanelFrameControlRuntimeSnapshot = {
    payloads: new Map(),
  };
  const listeners = new Set<() => void>();
  let emitQueued = false;

  function publishSnapshot(
    nextPayloads: ReadonlyMap<string, PanelFrameControlRuntimePayload>,
  ) {
    snapshot = {
      payloads: new Map(nextPayloads),
    };
    emit();
  }

  function emit() {
    if (emitQueued) {
      return;
    }
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      for (const listener of listeners) {
        listener();
      }
    });
  }

  return {
    publish(controlId, payload) {
      const publication = {
        controlId,
        generation,
        publicationId: nextPublicationId++,
      };
      const nextPayloads = new Map(snapshot.payloads);
      nextPayloads.set(controlId, payload);
      publishSnapshot(nextPayloads);

      let released = false;
      return {
        release() {
          if (released) {
            return;
          }
          released = true;
          if (
            publication.generation !== generation ||
            publication.publicationId >= nextPublicationId
          ) {
            return;
          }
          const currentPayload = snapshot.payloads.get(controlId);
          if (currentPayload !== payload) {
            return;
          }
          const nextReleasePayloads = new Map(snapshot.payloads);
          nextReleasePayloads.delete(controlId);
          publishSnapshot(nextReleasePayloads);
        },
      };
    },
    getSnapshot() {
      return snapshot;
    },
    reset() {
      generation += 1;
      nextPublicationId = 1;
      publishSnapshot(new Map());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function isValidFrameControlKey(key: string): boolean {
  const parts = key.split(":");
  return (
    parts.length === 3 &&
    parts.every((part) => part.length > 0 && CONTROL_ID_PATTERN.test(part))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
