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

export type LocalWheelReservation = "none" | "custom" | "native";

export function localWheelReservation(
  event: Pick<WheelEvent, "ctrlKey" | "target">,
): LocalWheelReservation {
  if (event.ctrlKey) {
    return "none";
  }

  const surfaceSelector =
    `[${WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE}]`;

  const surface = closest(event.target, surfaceSelector);
  if (!surface) {
    return "none";
  }

  const mode =
    typeof surface === "object" &&
    surface !== null &&
    "getAttribute" in surface &&
    typeof (surface as Element).getAttribute === "function"
      ? (surface as Element).getAttribute(
          WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE,
        )
      : null;

  if (mode === "native") {
    return "native";
  }

  const panelSelector =
    `[${WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE}="true"]`;

  return closest(surface, panelSelector)
    ? "custom"
    : "none";
}

export function shouldReserveLocalWheel(
  event: Pick<WheelEvent, "ctrlKey" | "target">,
): boolean {
  return localWheelReservation(event) !== "none";
}
