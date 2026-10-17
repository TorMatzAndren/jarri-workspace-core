import { canvasWallpaperPresentation } from "./canvasWallpaperPresentation";
import type { WorkspaceCanvasAppearancePreferences } from "../core/types";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const defaults: WorkspaceCanvasAppearancePreferences = {
  wallpaper: { kind: "none" }, fit: "cover", position: { x: 0.5, y: 0.5 }, anchor: "viewport",
};

const none = canvasWallpaperPresentation(defaults);
assertEqual(none.rendered, false, "none leaves theme surface paint available");

const appearance: WorkspaceCanvasAppearancePreferences = {
  ...defaults,
  wallpaper: { kind: "gradient", from: "#102030", to: "#abcdef", angle: 217 },
  position: { x: 0.2, y: 0.8 },
};
const first = canvasWallpaperPresentation(appearance);
const afterThemeChange = canvasWallpaperPresentation(appearance);
assertEqual(first.rendered, true, "gradient activates wallpaper paint");
assertEqual(first.backgroundImage, "linear-gradient(217deg, #102030, #abcdef)", "gradient preserves colors and angle");
assertEqual(first.backgroundPosition, "20% 80%", "position maps deterministically");
assertEqual(first.anchor, "viewport", "gradient remains viewport anchored");
assertEqual(afterThemeChange.backgroundImage, first.backgroundImage, "theme changes do not affect wallpaper presentation");
console.log("canvas wallpaper presentation tests passed");
