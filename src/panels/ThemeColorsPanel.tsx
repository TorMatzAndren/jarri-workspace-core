import { WORKSPACE_COLOR_FIELDS } from "../core/colorTokens";
import {
  WorkspaceSelect,
  type WorkspaceSelectOption,
} from "../core/WorkspaceSelect";
import { DEFAULT_WORKSPACE_CANVAS_APPEARANCE } from "../core/types";
import type {
  PanelBodyProps,
  WorkspaceGlassAppearancePreferences,
  WorkspaceColorTokens,
  WorkspacePreferences,
} from "../core/types";

const themeModeOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["themeMode"]
>> = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const themePresetOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["themePreset"]
>> = [
  { value: "neutral", label: "Neutral" },
  { value: "graphite", label: "Graphite" },
  { value: "contrast", label: "Contrast" },
  { value: "blueprint", label: "Blueprint" },
  { value: "chronogit", label: "ChronoGit" },
  { value: "pink-sparkle", label: "Pink Sparkle" },
  { value: "dashboard-night", label: "Dashboard Night (UX Planet)" },
  { value: "jarri-glass", label: "Jarri Glass palette (legacy)" },
];

const glassModeOptions: Array<WorkspaceSelectOption<
  WorkspaceGlassAppearancePreferences["mode"]
>> = [
  { value: "clear", label: "Clear" },
  { value: "frosted", label: "Frosted" },
  { value: "solid", label: "Solid" },
];

const panelContentPolicyOptions: Array<WorkspaceSelectOption<
  WorkspaceGlassAppearancePreferences["surfaces"]["panelContent"]
>> = [
  { value: "glass", label: "Frosted (default)" },
  { value: "solid", label: "Solid" },
];

const wallpaperModeOptions: Array<WorkspaceSelectOption<"none" | "gradient">> = [
  { value: "none", label: "Disabled" },
  { value: "gradient", label: "Gradient" },
];

const DEFAULT_GRADIENT = {
  kind: "gradient" as const,
  from: "#102030",
  to: "#3467a3",
  angle: 135,
};

export function ThemeColorsPanel({
  preferences,
  updatePreferences,
  openPanel,
}: PanelBodyProps) {
  function clearColor(key: keyof WorkspaceColorTokens) {
    const next = { ...preferences.colorOverrides };
    delete next[key];
    updatePreferences({ colorOverrides: next });
  }

  function clearAllColors() {
    updatePreferences({ colorOverrides: {} });
  }

  const wallpaper = preferences.canvasAppearance.wallpaper;
  const gradient = wallpaper.kind === "gradient" ? wallpaper : DEFAULT_GRADIENT;

  function updateGradient(changes: Partial<typeof DEFAULT_GRADIENT>) {
    updatePreferences({
      canvasAppearance: {
        ...preferences.canvasAppearance,
        wallpaper: { ...gradient, ...changes },
      },
    });
  }

  function updateWallpaperMode(mode: "none" | "gradient") {
    updatePreferences({
      canvasAppearance: {
        ...preferences.canvasAppearance,
        wallpaper:
          mode === "gradient"
            ? { ...gradient }
            : { kind: "none" },
      },
    });
  }

  function updateGlassAppearance(
    changes: Omit<Partial<WorkspaceGlassAppearancePreferences>, "surfaces"> & {
      surfaces?: Partial<WorkspaceGlassAppearancePreferences["surfaces"]>;
    },
  ) {
    updatePreferences({
      glassAppearance: {
        ...preferences.glassAppearance,
        ...changes,
        panelContentPolicyCustomized:
          changes.surfaces?.panelContent !== undefined
            ? true
            : preferences.glassAppearance.panelContentPolicyCustomized,
        surfaces: {
          ...preferences.glassAppearance.surfaces,
          ...changes.surfaces,
        },
      },
    });
  }

  return (
    <div className="panel-body theme-colors-panel">
      <section className="settings-panel__section">
        <h3>Theme</h3>

        <label>
          <span>Mode</span>
          <WorkspaceSelect
            value={preferences.themeMode}
            options={themeModeOptions}
            ariaLabel="Theme mode"
            onChange={(themeMode) =>
              updatePreferences({ themeMode })
            }
          />
        </label>
        {preferences.themePreset === "dashboard-night" ? (
          <p className="dashboard-night-attribution">
            Dashboard Night (UX Planet) — community theme contributed by Sh0ken (Kenny). Original palette preserved from his Jarri theme file. Suggested panel corner radius: 16 px; your radius setting remains independent.
          </p>
        ) : null}

        <label>
          <span>Preset</span>
          <WorkspaceSelect
            value={preferences.themePreset}
            options={themePresetOptions}
            ariaLabel="Theme preset"
            onChange={(themePreset) =>
              updatePreferences({ themePreset })
            }
          />
        </label>
      </section>

      <section className="settings-panel__section theme-colors-panel__panel-appearance">
        <h3>Panel Appearance</h3>
        <p className="settings-panel__hint">Panel frame radius control by Kenny / Sh0ken.</p>
        <div className="settings-panel__corner-radius">
          <label htmlFor="workspace-panel-corner-radius">
            <span>Panel Corner Radius</span>
            <strong>{preferences.panelRadius} px</strong>
          </label>
          <input
            id="workspace-panel-corner-radius"
            type="range"
            min={0}
            max={24}
            step={1}
            value={preferences.panelRadius}
            aria-label="Panel corner radius"
            onChange={(event) =>
              updatePreferences({ panelRadius: Number(event.target.value) })
            }
          />
          <div className="settings-panel__corner-radius-scale">
            <span>Square · 0 px</span>
            <span>Rounded · 24 px</span>
          </div>
        </div>
      </section>

      <section className="settings-panel__section theme-colors-panel__glass">
          <h3>Glass Effects</h3>
          <label className="theme-colors-panel__glass-enabled">
            <span>Enable glass effects</span>
            <input
              type="checkbox"
              checked={preferences.glassAppearance.enabled}
              aria-label="Enable glass effects"
              onChange={(event) => updateGlassAppearance({ enabled: event.target.checked })}
            />
          </label>
          <label>
            <span>Surface mode</span>
            <WorkspaceSelect
              value={preferences.glassAppearance.mode}
              options={glassModeOptions}
              ariaLabel="Glass surface mode"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(mode) => updateGlassAppearance({ mode })}
            />
          </label>
          <label>
            <span>Panel body surface</span>
            <WorkspaceSelect
              value={preferences.glassAppearance.surfaces.panelContent}
              options={panelContentPolicyOptions}
              ariaLabel="Panel body surface"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(panelContent) =>
                updateGlassAppearance({
                  surfaces: { panelContent },
                })
              }
            />
          </label>
          <label>
            <span>Surface opacity ({Math.round(preferences.glassAppearance.surfaceOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.01"
              value={preferences.glassAppearance.surfaceOpacity}
              aria-label="Glass surface opacity"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(event) => updateGlassAppearance({ surfaceOpacity: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Backdrop blur ({preferences.glassAppearance.backdropBlurRadius}px)</span>
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              value={preferences.glassAppearance.backdropBlurRadius}
              aria-label="Glass backdrop blur radius"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(event) => updateGlassAppearance({ backdropBlurRadius: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Saturation ({preferences.glassAppearance.saturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={preferences.glassAppearance.saturation}
              aria-label="Glass saturation"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(event) => updateGlassAppearance({ saturation: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Border intensity ({Math.round(preferences.glassAppearance.borderIntensity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={preferences.glassAppearance.borderIntensity}
              aria-label="Glass border intensity"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(event) => updateGlassAppearance({ borderIntensity: Number(event.target.value) })}
            />
          </label>
          <label className="theme-colors-panel__glass-reduced">
            <span>Reduced effects</span>
            <input
              type="checkbox"
              checked={preferences.glassAppearance.reducedEffects}
              aria-label="Reduced effects"
              disabled={!preferences.glassAppearance.enabled}
              onChange={(event) => updateGlassAppearance({ reducedEffects: event.target.checked })}
            />
          </label>
          <p className="settings-panel__hint">
            Ordinary panels use frosted bodies. Terminals, editors, WebGL, and dense telemetry stay opaque.
          </p>
      </section>

      <section className="settings-panel__section theme-colors-panel__wallpaper">
        <h3>Canvas Wallpaper</h3>
        <label>
          <span>Wallpaper</span>
          <WorkspaceSelect
            value={wallpaper.kind}
            options={wallpaperModeOptions}
            ariaLabel="Canvas wallpaper"
            onChange={updateWallpaperMode}
          />
        </label>
        {wallpaper.kind === "gradient" ? (
          <>
            <div className="theme-colors-panel__gradient-colors">
              <label>
                <span>Start color</span>
                <input
                  type="color"
                  value={gradient.from}
                  aria-label="Wallpaper gradient start color"
                  onChange={(event) => updateGradient({ from: event.target.value })}
                />
              </label>
              <label>
                <span>End color</span>
                <input
                  type="color"
                  value={gradient.to}
                  aria-label="Wallpaper gradient end color"
                  onChange={(event) => updateGradient({ to: event.target.value })}
                />
              </label>
            </div>
            <label>
              <span>Gradient angle ({gradient.angle}°)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={gradient.angle}
                aria-label="Wallpaper gradient angle"
                onChange={(event) => updateGradient({ angle: Number(event.target.value) })}
              />
            </label>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => updatePreferences({ canvasAppearance: {
            ...DEFAULT_WORKSPACE_CANVAS_APPEARANCE,
            wallpaper: { ...DEFAULT_WORKSPACE_CANVAS_APPEARANCE.wallpaper },
            position: { ...DEFAULT_WORKSPACE_CANVAS_APPEARANCE.position },
          } })}
        >
          Reset wallpaper
        </button>
      </section>

      <section className="settings-panel__section settings-panel__section--colors">
        <div className="settings-panel__section-header">
          <h3>Advanced Colors</h3>
          <button type="button" onClick={clearAllColors}>
            Clear all
          </button>
        </div>

        <div className="settings-color-grid">
          {WORKSPACE_COLOR_FIELDS.map((field) => {
            const override = preferences.colorOverrides[field.key];
            const hasOverride = Boolean(override);

            return (
              <div
                className="settings-color-token"
                data-has-override={hasOverride}
                key={field.key}
              >
                <span className="settings-color-token__label">
                  {field.label}
                </span>

                <button
                  type="button"
                  className="settings-color-token__swatch"
                  style={{
                    background: override ?? `var(${field.cssVariable})`,
                  }}
                  title={`Choose ${field.label} color`}
                  aria-label={`Choose ${field.label} color`}
                  onClick={() =>
                    openPanel("core", "color-picker", {
                      colorToken: field.key,
                    })
                  }
                />

                <button
                  type="button"
                  className="settings-color-token__clear"
                  disabled={!hasOverride}
                  onClick={() => clearColor(field.key)}
                  title={`Clear ${field.label} override`}
                  aria-label={`Clear ${field.label} override`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
