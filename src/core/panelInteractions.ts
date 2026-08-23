export type PanelInteractionCapabilities = {
  localWheel?: boolean;
};

export const WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE =
  "data-workspace-local-wheel";

export const WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE =
  "data-workspace-local-wheel-surface";

type ClosestCapableTarget = {
  closest?: (selector: string) => unknown;
};

function closest(target: unknown, selector: string): unknown {
  if (
    typeof target !== "object" ||
    target === null ||
    typeof (target as ClosestCapableTarget).closest !== "function"
  ) {
    return null;
  }

  return (target as ClosestCapableTarget).closest!(selector);
}

export function shouldReserveLocalWheel(
  event: Pick<WheelEvent, "ctrlKey" | "target">,
): boolean {
  if (event.ctrlKey) {
    return false;
  }

  const surfaceSelector =
    `[${WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE}="true"]`;
  const panelSelector =
    `[${WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE}="true"]`;

  const surface = closest(event.target, surfaceSelector);
  if (!surface) {
    return false;
  }

  return Boolean(closest(surface, panelSelector));
}
