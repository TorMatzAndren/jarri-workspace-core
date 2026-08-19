import { createId, nowIso } from "./id";
import { geometryFromPanelDefinition } from "./layoutEngine";
import type { PanelRegistry } from "./panelRegistry";
import type { PanelInstance, WorkspaceState } from "./types";
import { DEFAULT_WORKSPACE_SYSTEM_SURFACE_POSITIONS } from "./types";
import { WORKSPACE_SCHEMA_VERSION } from "./types";

export function createDefaultWorkspace(registry: PanelRegistry): WorkspaceState {
  const now = nowIso();
  const definitions = [
    registry.getPanel("demo", "truth"),
    registry.getPanel("demo", "timeline"),
    registry.getPanel("demo", "advisory-log"),
  ].filter((definition) => definition !== null);

  const panels = definitions.map((definition, index): PanelInstance => ({
    id: createId("panel"),
    moduleId: definition.moduleId,
    panelType: definition.panelType,
    title: definition.title,
    geometry: geometryFromPanelDefinition(definition),
    focusOrder: index + 1,
    stateVersion: definition.stateVersion,
    panelState: definition.createInitialState({ now }),
    createdAt: now,
    updatedAt: now,
  }));

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: "default",
    activeTabId: "home",
    tabs: [
      {
        id: "home",
        title: "Core Demo",
        canvasBounds: {
          width: 1800,
          height: 1100,
        },
        panels,
        createdAt: now,
        updatedAt: now,
      },
    ],
    surfacePresentationMemory: {},
    preferences: {
      scale: 1,
      fontSize: 14,
      showGrid: true,
      panelSpacing: 0,
      systemSurfacePositions: {
        settings: { ...DEFAULT_WORKSPACE_SYSTEM_SURFACE_POSITIONS.settings },
        addPanel: { ...DEFAULT_WORKSPACE_SYSTEM_SURFACE_POSITIONS.addPanel },
        frameSettings: { ...DEFAULT_WORKSPACE_SYSTEM_SURFACE_POSITIONS.frameSettings },
      },
      clock: {
        enabled: true,
        timeFormat: "24h",
        dateFormat: "text",
      },
      density: "compact",
      themeMode: "system",
      fontFamily: "system",
      themePreset: "neutral",
      colorOverrides: {},
      panelMenu: {
        moduleOrder: ["core", "demo"],
        hiddenModuleIds: [],
        panelSort: "registered",
      },
      frameControls: {
        visibility: {},
      },
      panelViews: {},
    },
    registryVersion: "runtime-v1",
  };
}
