import type { PanelDefinition, WorkspaceModuleDefinition } from "../core/types";
import {
  panelSummarySemantic,
  unavailableSemantic,
} from "../core/panelSemantics";
import { MissingPanel } from "./MissingPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeColorsPanel } from "./ThemeColorsPanel";
import {
  ColorPickerPanel,
  normalizeColorPickerState,
} from "./ColorPickerPanel";
import {
  ImageViewerPanel,
  normalizeImageViewerState,
} from "./ImageViewerPanel";

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

const themeColorsPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "theme-colors",
  title: "Themes / Colours",
  description: "Workspace appearance themes and semantic color overrides.",
  category: "core",
  defaultGeometry: { x: 960, y: 460, width: 760, height: 430 },
  minGeometry: { width: 440, height: 300 },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  createInitialState: () => ({}),
  normalizeState: () => ({
    state: {},
    repaired: false,
    warnings: [],
  }),
  semanticStrategy: panelSummarySemantic(
    "Ready",
    "Workspace themes and color overrides are available in this panel.",
  ),
  surfacePresentationMemory: {},
  Component: ThemeColorsPanel,
};

const colorPickerPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "color-picker",
  title: "Colour Picker",
  description: "Workspace-native semantic colour selection.",
  category: "core",
  defaultGeometry: { x: 1040, y: 520, width: 430, height: 390 },
  minGeometry: { width: 340, height: 300 },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  createInitialState: () => ({ colorToken: "page" }),
  normalizeState: (input) => {
    const state = normalizeColorPickerState(input);

    return {
      state,
      repaired:
        !input ||
        typeof input !== "object" ||
        !("colorToken" in input) ||
        (input as { colorToken?: unknown }).colorToken !== state.colorToken,
      warnings: [],
    };
  },
  semanticStrategy: panelSummarySemantic(
    "Ready",
    "Workspace-native semantic colour selection is available.",
  ),
  surfacePresentationMemory: {},
  Component: ColorPickerPanel,
};

const imageViewerPanelDefinition: PanelDefinition = {
  moduleId: "core",
  panelType: "image-viewer",
  title: "Image Viewer",
  description: "Read-only image resource viewer.",
  category: "core",
  defaultGeometry: { x: 232, y: 232, width: 900, height: 640 },
  minGeometry: { width: 420, height: 300 },
  stateVersion: 1,
  capabilities: {
    closable: true,
    resizable: true,
    movable: true,
    renameable: false,
    canBeDirty: false,
  },
  interactionCapabilities: {
    localWheel: true,
  },
  createInitialState: () => ({ resourceUri: "" }),
  normalizeState: (input) => ({
    state: normalizeImageViewerState(input),
    repaired: false,
    warnings: [],
  }),
  semanticStrategy: panelSummarySemantic(
    "Ready",
    "Image resources open in this Workspace Core panel.",
  ),
  surfacePresentationMemory: {
    rememberPanelState: false,
  },
  Component: ImageViewerPanel,
};

export const coreModule: WorkspaceModuleDefinition = {
  moduleId: "core",
  title: "Workspace Core",
  version: "1.0.0",
  panels: [
    missingPanelDefinition,
    settingsPanelDefinition,
    themeColorsPanelDefinition,
    colorPickerPanelDefinition,
    imageViewerPanelDefinition,
  ],
};
