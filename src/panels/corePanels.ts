import type { PanelDefinition, WorkspaceModuleDefinition } from "../core/types";
import {
  panelSummarySemantic,
  unavailableSemantic,
} from "../core/panelSemantics";
import { MissingPanel } from "./MissingPanel";
import { SettingsPanel } from "./SettingsPanel";

const missingPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "missing",
  title: "Missing Panel",
  description: "Inert projection for unavailable panel definitions.",
  category: "core",
  defaultGeometry: { x: 48, y: 48, width: 420, height: 240 },
  minGeometry: { width: 324, height: 180 },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  createInitialState: () => ({ missing: true }),
  normalizeState: (input) => ({
    state: input && typeof input === "object" ? input : { missing: true },
    repaired: false,
    warnings: [],
  }),
  semanticStrategy: unavailableSemantic(
    "The saved layout references a panel definition that is not registered.",
    "Restore the module or close this placeholder panel.",
  ),
  Component: MissingPanel,
};

const settingsPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "settings",
  title: "Settings",
  description: "Framework-level Workspace Core preferences.",
  category: "core",
  defaultGeometry: { x: 924, y: 408, width: 1020, height: 540 },
  minGeometry: { width: 360, height: 336 },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  createInitialState: () => ({}),
  normalizeState: () => ({ state: {}, repaired: false, warnings: [] }),
  semanticStrategy: panelSummarySemantic(
    "Ready",
    "Workspace-level preferences are available in this panel.",
  ),
  surfacePresentationMemory: {},
  Component: SettingsPanel,
};

export const coreModule: WorkspaceModuleDefinition = {
  moduleId: "core",
  title: "Workspace Core",
  version: "1.0.0",
  panels: [missingPanelDefinition, settingsPanelDefinition],
};
