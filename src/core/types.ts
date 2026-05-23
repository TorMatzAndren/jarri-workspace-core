import type { ComponentType } from "react";

export const WORKSPACE_SCHEMA_VERSION = 1;

export type WorkspacePreferences = {
  scale: number;
  density: "compact" | "comfortable";
  themeMode: "system" | "light" | "dark";
};

export type WorkspaceState = {
  schemaVersion: number;
  workspaceId: string;
  activeTabId: string | null;
  tabs: WorkspaceTab[];
  preferences: WorkspacePreferences;
  registryVersion?: string;
};

export type WorkspaceTab = {
  id: string;
  title: string;
  panels: PanelInstance[];
  createdAt: string;
  updatedAt: string;
};

export type PanelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};

export type DirtyStateSnapshot = {
  isDirty: boolean;
  reason?: string;
  resourceLabel?: string;
  resourceUri?: string;
  canSave: boolean;
  canDiscard: boolean;
};

export type PanelInstance = {
  id: string;
  moduleId: string;
  panelType: string;
  title: string;
  geometry: PanelGeometry;
  focusOrder: number;
  stateVersion: number;
  panelState: unknown;
  dirty?: DirtyStateSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type PanelCategory =
  | "core"
  | "domain"
  | "observability"
  | "temporal"
  | "advisory";

export type PanelCapabilities = {
  closable: boolean;
  resizable: boolean;
  movable: boolean;
  renameable: boolean;
  canBeDirty: boolean;
  usesTruthProvider?: string;
  usesAdvisoryProvider?: string;
  usesPreflightProvider?: string;
  usesTemporalProvider?: string;
};

export type PanelCreateContext = {
  now: string;
};

export type PanelNormalizeContext = {
  now: string;
};

export type PanelNormalizeResult = {
  state: unknown;
  repaired: boolean;
  warnings: string[];
};

export type PanelBodyProps = {
  panel: PanelInstance;
  updatePanelState: (panelState: unknown) => void;
};

export type PanelDefinition = {
  moduleId: string;
  panelType: string;
  title: string;
  description: string;
  category: PanelCategory;
  defaultGeometry: PanelGeometry;
  minGeometry: {
    width: number;
    height: number;
  };
  stateVersion: number;
  capabilities: PanelCapabilities;
  createInitialState: (context: PanelCreateContext) => unknown;
  normalizeState: (
    input: unknown,
    context: PanelNormalizeContext,
  ) => PanelNormalizeResult;
  Component: ComponentType<PanelBodyProps>;
};

export type PersistedModuleRecord = {
  moduleId: string;
  version: string;
  registeredPanelTypes: string[];
};

export type PersistedWorkspaceDocument = {
  kind: "jarri.workspace.layout";
  schemaVersion: number;
  savedAt: string;
  workspace: WorkspaceState;
  modules: PersistedModuleRecord[];
};

export type LayoutRepairReport = {
  migrated: boolean;
  repaired: boolean;
  fromSchemaVersion?: number;
  toSchemaVersion: number;
  warnings: string[];
};

