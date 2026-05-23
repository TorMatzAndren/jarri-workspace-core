import { createPanelRegistry } from "../core/panelRegistry";
import type { PanelDefinition } from "../core/types";
import { demoPanelDefinitions } from "./demoPanels";
import { MissingPanel } from "./MissingPanel";

export const registry = createPanelRegistry();

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

registry.registerPanel(missingPanelDefinition);
for (const definition of demoPanelDefinitions) {
  registry.registerPanel(definition);
}

