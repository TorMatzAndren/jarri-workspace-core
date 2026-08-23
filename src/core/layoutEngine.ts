import type { PanelDefinition } from "./types";
import type { PanelGeometry, PanelInstance } from "./types";

export const GRID_SIZE = 12;

export type GeometryInteraction = {
  mode: "move" | "resize";
  panelId: string;
  startPointerX: number;
  startPointerY: number;
  startGeometry: PanelGeometry;
  scale: number;
  gridSize: number;
};

export function snapToGrid(value: number, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapUpToGrid(value: number, gridSize = GRID_SIZE) {
  return Math.ceil(value / gridSize) * gridSize;
}

export function normalizeGeometry(
  input: Partial<PanelGeometry> | undefined,
  fallback: PanelGeometry,
): PanelGeometry {
  const minWidth = snapUpToGrid(finiteNumber(input?.minWidth, fallback.minWidth ?? 260));
  const minHeight = snapUpToGrid(finiteNumber(input?.minHeight, fallback.minHeight ?? 160));

  return {
    x: Math.max(0, snapToGrid(finiteNumber(input?.x, fallback.x))),
    y: Math.max(0, snapToGrid(finiteNumber(input?.y, fallback.y))),
    width: Math.max(minWidth, snapToGrid(finiteNumber(input?.width, fallback.width))),
    height: Math.max(minHeight, snapToGrid(finiteNumber(input?.height, fallback.height))),
    minWidth,
    minHeight,
  };
}

export function geometryFromPanelDefinition(
  definition: PanelDefinition,
  offset = 0,
): PanelGeometry {
  return normalizeGeometry(
    {
      ...definition.defaultGeometry,
      x: definition.defaultGeometry.x + offset,
      y: definition.defaultGeometry.y + offset,
      minWidth: definition.minGeometry.width,
      minHeight: definition.minGeometry.height,
    },
    definition.defaultGeometry,
  );
}

export function enforceMinSize(
  geometry: PanelGeometry,
  gridSize = GRID_SIZE,
): PanelGeometry {
  const minWidth = snapUpToGrid(geometry.minWidth ?? 260, gridSize);
  const minHeight = snapUpToGrid(geometry.minHeight ?? 160, gridSize);

  return {
    ...geometry,
    width: snapToGrid(Math.max(minWidth, geometry.width), gridSize),
    height: snapToGrid(Math.max(minHeight, geometry.height), gridSize),
    minWidth,
    minHeight,
  };
}

export function nextFocusOrder(panels: PanelInstance[]) {
  return Math.max(0, ...panels.map((panel) => panel.focusOrder)) + 1;
}

export function repairFocusOrder(panels: PanelInstance[]) {
  return [...panels]
    .sort((a, b) => a.focusOrder - b.focusOrder)
    .map((panel, index) => ({ ...panel, focusOrder: index + 1 }));
}

export function beginGeometryInteraction(
  mode: GeometryInteraction["mode"],
  panel: PanelInstance,
  pointerX: number,
  pointerY: number,
  scale: number,
  gridSize = GRID_SIZE,
): GeometryInteraction {
  return {
    mode,
    panelId: panel.id,
    startPointerX: pointerX,
    startPointerY: pointerY,
    startGeometry: panel.geometry,
    scale: normalizeScale(scale),
    gridSize: Math.max(1, Math.round(gridSize)),
  };
}

export function previewGeometryInteraction(
  interaction: GeometryInteraction,
  pointerX: number,
  pointerY: number,
): PanelGeometry {
  const deltaX = (pointerX - interaction.startPointerX) / interaction.scale;
  const deltaY = (pointerY - interaction.startPointerY) / interaction.scale;

  if (interaction.mode === "move") {
    return {
      ...interaction.startGeometry,
      x: Math.max(
        0,
        snapToGrid(
          interaction.startGeometry.x + deltaX,
          interaction.gridSize,
        ),
      ),
      y: Math.max(
        0,
        snapToGrid(
          interaction.startGeometry.y + deltaY,
          interaction.gridSize,
        ),
      ),
    };
  }

  return enforceMinSize(
    {
      ...interaction.startGeometry,
      width: interaction.startGeometry.width + deltaX,
      height: interaction.startGeometry.height + deltaY,
    },
    interaction.gridSize,
  );
}

export function commitGeometryInteraction(
  geometry: PanelGeometry,
  gridSize = GRID_SIZE,
): PanelGeometry {
  return enforceMinSize(
    {
      ...geometry,
      x: Math.max(0, snapToGrid(geometry.x, gridSize)),
      y: Math.max(0, snapToGrid(geometry.y, gridSize)),
      width: snapToGrid(geometry.width, gridSize),
      height: snapToGrid(geometry.height, gridSize),
    },
    gridSize,
  );
}

export function cancelGeometryInteraction(
  interaction: GeometryInteraction,
): PanelGeometry {
  return interaction.startGeometry;
}

export function normalizeScale(scale: number) {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
