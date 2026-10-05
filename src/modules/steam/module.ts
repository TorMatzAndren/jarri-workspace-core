import type {
  PanelDefinition,
  WorkspaceModuleDefinition,
} from "../../core/types";
import { panelSummarySemantic } from "../../core/panelSemantics";
import { SteamClientPanel } from "./panels/SteamClientPanel";

const steamClientPanelDefinition: PanelDefinition = {
  moduleId: "steam",
  panelType: "client",
  title: "Steam",
  description: "Native Steam client hosted inside a Workspace panel.",
  category: "domain",
  defaultGeometry: {
    x: 180,
    y: 140,
    width: 1280,
    height: 820,
  },
  minGeometry: {
    width: 640,
    height: 440,
  },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  createInitialState: () => ({}),
  normalizeState: (input) => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return {
        state: {},
        repaired: input !== null && input !== undefined,
        warnings: [],
      };
    }

    const record = input as {
      windowId?: unknown;
      released?: unknown;
    };

    return {
      state: {
        ...(typeof record.windowId === "string"
          ? { windowId: record.windowId }
          : {}),
        ...(record.released === true ? { released: true } : {}),
      },
      repaired: false,
      warnings: [],
    };
  },
  surfacePresentationMemory: {
    rememberPanelState: true,
    rememberDisplay: true,
  },
  semanticStrategy: panelSummarySemantic(
    "Native host",
    "Steam is hosted through the Workspace native-surface architecture.",
  ),
  Component: SteamClientPanel,
};

export const steamModule: WorkspaceModuleDefinition = {
  moduleId: "steam",
  title: "Steam",
  version: "0.1.0",
  panels: [steamClientPanelDefinition],
};
