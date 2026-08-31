import {
  localWheelReservation,
  shouldReserveLocalWheel,
  WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE,
  WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE,
} from "./panelInteractions";

function assertEqual(
  actual: unknown,
  expected: unknown,
  label: string,
) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const surfaceSelector =
  `[${WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE}]`;

const panelSelector =
  `[${WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE}="true"]`;

function makeSurface(
  mode: "native" | "true",
  customPanelOwned: boolean,
) {
  const panel = {
    closest(selector: string) {
      return selector === panelSelector ? panel : null;
    },
  };

  const localSurface = {
    getAttribute(name: string) {
      return name === WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE
        ? mode
        : null;
    },

    closest(selector: string) {
      if (selector === surfaceSelector) {
        return localSurface;
      }

      if (
        selector === panelSelector &&
        customPanelOwned
      ) {
        return panel;
      }

      return null;
    },
  };

  const nested = {
    closest(selector: string) {
      if (selector === surfaceSelector) {
        return localSurface;
      }

      return null;
    },
  };

  return { localSurface, nested };
}

const native = makeSurface("native", false);
const customOwned = makeSurface("true", true);
const customUnowned = makeSurface("true", false);

const ordinaryCanvasContent = {
  closest() {
    return null;
  },
};

assertEqual(
  localWheelReservation({
    ctrlKey: false,
    target: native.nested as unknown as EventTarget,
  }),
  "native",
  "native panel body owns ordinary wheel without panel capability",
);

assertEqual(
  localWheelReservation({
    ctrlKey: true,
    target: native.nested as unknown as EventTarget,
  }),
  "none",
  "Ctrl+wheel over native panel body belongs to Workspace",
);

assertEqual(
  localWheelReservation({
    ctrlKey: false,
    target: customOwned.nested as unknown as EventTarget,
  }),
  "custom",
  "custom surface owns ordinary wheel when panel opts in",
);

assertEqual(
  localWheelReservation({
    ctrlKey: false,
    target: customUnowned.nested as unknown as EventTarget,
  }),
  "none",
  "custom surface without panel capability is rejected",
);

assertEqual(
  localWheelReservation({
    ctrlKey: false,
    target: ordinaryCanvasContent as unknown as EventTarget,
  }),
  "none",
  "ordinary canvas remains Workspace-owned",
);

assertEqual(
  localWheelReservation({
    ctrlKey: false,
    target: null,
  }),
  "none",
  "missing target has no local owner",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: native.nested as unknown as EventTarget,
  }),
  true,
  "compatibility helper reserves native wheel",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: customOwned.nested as unknown as EventTarget,
  }),
  true,
  "compatibility helper reserves custom wheel",
);

console.log("workspace panel interaction tests passed");
