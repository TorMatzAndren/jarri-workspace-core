import { WORKSPACE_COLOR_FIELDS } from "../core/colorTokens";
import {
  WorkspaceSelect,
  type WorkspaceSelectOption,
} from "../core/WorkspaceSelect";
import type {
  PanelBodyProps,
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
  { value: "pink-sparkle", label: "Pink Sparkle" },
  { value: "chronogit", label: "ChronoGit" },
];

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
