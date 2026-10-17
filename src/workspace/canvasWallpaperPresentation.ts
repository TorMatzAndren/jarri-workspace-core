import type { WorkspaceCanvasAppearancePreferences } from "../core/types";

export type CanvasWallpaperPresentation = {
  sourceKind: WorkspaceCanvasAppearancePreferences["wallpaper"]["kind"];
  rendered: boolean;
  backgroundImage: string | null;
  backgroundPosition: string;
  anchor: "viewport";
};

/**
 * Produces only the viewport paint description. Managed images deliberately
 * remain a safe no-wallpaper fallback until the native asset path exists.
 */
export function canvasWallpaperPresentation(
  appearance: WorkspaceCanvasAppearancePreferences,
): CanvasWallpaperPresentation {
  const wallpaper = appearance.wallpaper;
  if (wallpaper.kind !== "gradient") {
    return {
      sourceKind: wallpaper.kind,
      rendered: false,
      backgroundImage: null,
      backgroundPosition: "50% 50%",
      anchor: "viewport",
    };
  }

  return {
    sourceKind: "gradient",
    rendered: true,
    backgroundImage: `linear-gradient(${wallpaper.angle}deg, ${wallpaper.from}, ${wallpaper.to})`,
    backgroundPosition: `${appearance.position.x * 100}% ${appearance.position.y * 100}%`,
    anchor: "viewport",
  };
}
