import type { PanelBodyProps, WorkspacePreferences } from "../core/types";

const fontOptions: Array<{
  value: WorkspacePreferences["fontFamily"];
  label: string;
}> = [
  { value: "system", label: "System" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

const densityOptions: Array<{
  value: WorkspacePreferences["density"];
  label: string;
}> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

const themeModeOptions: Array<{
  value: WorkspacePreferences["themeMode"];
  label: string;
}> = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const themePresetOptions: Array<{
  value: WorkspacePreferences["themePreset"];
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "graphite", label: "Graphite" },
  { value: "contrast", label: "Contrast" },
];

export function SettingsPanel({ preferences, updatePreferences }: PanelBodyProps) {
  return (
    <div className="panel-body settings-panel">
      <label>
        <span>Font</span>
        <select
          value={preferences.fontFamily}
          onChange={(event) =>
            updatePreferences({
              fontFamily: event.target.value as WorkspacePreferences["fontFamily"],
            })
          }
        >
          {fontOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Density</span>
        <select
          value={preferences.density}
          onChange={(event) =>
            updatePreferences({
              density: event.target.value as WorkspacePreferences["density"],
            })
          }
        >
          {densityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Color Scheme</span>
        <select
          value={preferences.themeMode}
          onChange={(event) =>
            updatePreferences({
              themeMode: event.target.value as WorkspacePreferences["themeMode"],
            })
          }
        >
          {themeModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Theme</span>
        <select
          value={preferences.themePreset}
          onChange={(event) =>
            updatePreferences({
              themePreset: event.target.value as WorkspacePreferences["themePreset"],
            })
          }
        >
          {themePresetOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Scale</span>
        <input
          max="1.35"
          min="0.75"
          step="0.05"
          type="range"
          value={preferences.scale}
          onChange={(event) =>
            updatePreferences({
              scale: Number.parseFloat(event.target.value),
            })
          }
        />
        <strong>{Math.round(preferences.scale * 100)}%</strong>
      </label>
    </div>
  );
}

