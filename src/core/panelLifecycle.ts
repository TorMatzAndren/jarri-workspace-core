export type PanelPresentationState =
  | "framed"
  | "activating"
  | "active"
  | "suspending"
  | "suspended"
  | "disposed";

export type ProjectionRetentionPolicy = "discard-on-detach" | "retain";

export type RuntimeRetentionPolicy =
  | "discard-on-detach"
  | "suspend"
  | "keep-alive";

export type BackgroundActivityPolicy =
  | "stop-when-hidden"
  | "pause-when-hidden"
  | "continue";

export type PanelLifecycleCapabilities = {
  projectionRetention: ProjectionRetentionPolicy;
  runtimeRetention: RuntimeRetentionPolicy;
  backgroundActivity: BackgroundActivityPolicy;
};

export const DEFAULT_PANEL_LIFECYCLE_CAPABILITIES: PanelLifecycleCapabilities = {
  projectionRetention: "discard-on-detach",
  runtimeRetention: "discard-on-detach",
  backgroundActivity: "stop-when-hidden",
};

const VALID_TRANSITIONS: Readonly<
  Record<PanelPresentationState, readonly PanelPresentationState[]>
> = {
  framed: ["activating", "disposed"],
  activating: ["active", "suspending", "disposed"],
  active: ["suspending", "disposed"],
  suspending: ["suspended", "disposed"],
  suspended: ["activating", "disposed"],
  disposed: [],
};

export function canTransitionPanelPresentation(
  from: PanelPresentationState,
  to: PanelPresentationState,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function panelLifecycleCapabilities(
  declared?: Partial<PanelLifecycleCapabilities>,
): PanelLifecycleCapabilities {
  return { ...DEFAULT_PANEL_LIFECYCLE_CAPABILITIES, ...declared };
}
