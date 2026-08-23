import {
  shouldReserveLocalWheel,
  WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE,
  WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE,
} from "./panelInteractions";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const surfaceSelector =
  `[${WORKSPACE_LOCAL_WHEEL_SURFACE_ATTRIBUTE}="true"]`;
const panelSelector =
  `[${WORKSPACE_LOCAL_WHEEL_PANEL_ATTRIBUTE}="true"]`;

const ownedSurface = {
  closest(selector: string) {
    return selector === panelSelector ? { panel: true } : null;
  },
};

const nestedInOwnedSurface = {
  closest(selector: string) {
    return selector === surfaceSelector ? ownedSurface : null;
  },
};

const ordinaryPanelContent = {
  closest() {
    return null;
  },
};

const unownedSurface = {
  closest(selector: string) {
    if (selector === surfaceSelector) {
      return {
        closest() {
          return null;
        },
      };
    }

    return null;
  },
};

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: nestedInOwnedSurface as unknown as EventTarget,
  }),
  true,
  "plain wheel inside opted-in local wheel surface is reserved",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: true,
    target: nestedInOwnedSurface as unknown as EventTarget,
  }),
  false,
  "Ctrl+wheel is not claimed by local wheel ownership",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: ordinaryPanelContent as unknown as EventTarget,
  }),
  false,
  "wheel outside local wheel surface is not reserved",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: unownedSurface as unknown as EventTarget,
  }),
  false,
  "local wheel surface requires opted-in panel ownership",
);

assertEqual(
  shouldReserveLocalWheel({
    ctrlKey: false,
    target: null,
  }),
  false,
  "missing target is not reserved",
);

console.log("workspace panel interaction tests passed");
