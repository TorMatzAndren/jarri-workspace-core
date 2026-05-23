import type { PanelDefinition, WorkspaceModuleDefinition } from "../core/types";
import { MissingPanel } from "./MissingPanel";
import { SettingsPanel } from "./SettingsPanel";

const missingPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "missing",
  title: "Missing Panel",
  description: "Inert projection for unavailable panel definitions.",
  category: "core",
  defaultGeometry: { x: 40, y: 40, width: 420, height: 240 },
  minGeometry: { width: 320, height: 180 },
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
  Component: MissingPanel,
};

const settingsPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "settings",
  title: "Settings",
  description: "Framework-level Workspace Core preferences.",
  category: "core",
  defaultGeometry: { x: 920, y: 410, width: 420, height: 360 },
  minGeometry: { width: 340, height: 300 },
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
  Component: SettingsPanel,
};

export const coreModule: WorkspaceModuleDefinition = {
  moduleId: "core",
  title: "Workspace Core",
  version: "1.0.0",
  panels: [missingPanelDefinition, settingsPanelDefinition],
};

