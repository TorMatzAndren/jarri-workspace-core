import type {
  PanelBodyProps,
  WorkspaceColorTokens,
  WorkspacePreferences,
} from "../core/types";

const fontOptions: Array<{
  value: WorkspacePreferences["fontFamily"];
  label: string;
}> = [
  { value: "system", label: "System UI" },
  { value: "humanist", label: "Humanist" },
  { value: "compact", label: "Compact Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
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
  { value: "blueprint", label: "Blueprint" },
];

const colorFields: Array<{
  key: keyof WorkspaceColorTokens;
  label: string;
}> = [
  { key: "page", label: "Page" },
  { key: "canvas", label: "Canvas" },
  { key: "panel", label: "Panel" },
  { key: "panelHeader", label: "Panel header" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "border", label: "Borders" },
  { key: "button", label: "Buttons" },
  { key: "menu", label: "Menu" },
];

export function SettingsPanel({
  preferences,
  modules,
  updatePreferences,
}: PanelBodyProps) {
  const arrangedModules = arrangeModules(modules, preferences.panelMenu.moduleOrder);

  function updateColor(key: keyof WorkspaceColorTokens, value: string) {
    updatePreferences({
      colorOverrides: {
        ...preferences.colorOverrides,
        [key]: value,
      },
    });
  }

  function clearColor(key: keyof WorkspaceColorTokens) {
    const next = { ...preferences.colorOverrides };
    delete next[key];
    updatePreferences({ colorOverrides: next });
  }

  function clearAllColors() {
    updatePreferences({ colorOverrides: {} });
  }

  function updateScale(delta: number) {
    const nextScale = Math.max(
      0.75,
      Math.min(1.35, Number((preferences.scale + delta).toFixed(2))),
    );
    updatePreferences({ scale: nextScale });
  }

  function updatePanelMenu(
    updates: Partial<WorkspacePreferences["panelMenu"]>,
  ) {
    updatePreferences({
      panelMenu: {
        ...preferences.panelMenu,
        ...updates,
      },
    });
  }

  function moveModule(moduleId: string, direction: -1 | 1) {
    const currentOrder = arrangedModules.map((module) => module.moduleId);
    const index = currentOrder.indexOf(moduleId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [item] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIndex, 0, item);
    updatePanelMenu({ moduleOrder: nextOrder });
  }

  function setModuleVisible(moduleId: string, visible: boolean) {
    const hidden = new Set(preferences.panelMenu.hiddenModuleIds);
    if (visible) {
      hidden.delete(moduleId);
    } else {
      hidden.add(moduleId);
    }
    updatePanelMenu({ hiddenModuleIds: [...hidden] });
  }

  return (
    <div className="panel-body settings-panel">
      <section className="settings-panel__section">
        <h3>Interface</h3>
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
          <span>Font size</span>
          <input
            max="18"
            min="12"
            step="1"
            type="range"
            value={preferences.fontSize}
            onChange={(event) =>
              updatePreferences({
                fontSize: Number.parseFloat(event.target.value),
              })
            }
          />
          <strong>{preferences.fontSize}px</strong>
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
          <span>Scale</span>
          <div className="settings-stepper">
            <button
              type="button"
              disabled={preferences.scale <= 0.75}
              onClick={() => updateScale(-0.05)}
            >
              -
            </button>
            <button
              type="button"
              disabled={preferences.scale >= 1.35}
              onClick={() => updateScale(0.05)}
            >
              +
            </button>
          </div>
          <strong>{Math.round(preferences.scale * 100)}%</strong>
        </label>

        <label>
          <span>Grid</span>
          <input
            type="checkbox"
            checked={preferences.showGrid}
            onChange={(event) =>
              updatePreferences({
                showGrid: event.target.checked,
              })
            }
          />
        </label>
      </section>

      <section className="settings-panel__section">
        <h3>Clock</h3>

        <label>
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={preferences.clock.enabled}
            onChange={(event) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  enabled: event.target.checked,
                },
              })
            }
          />
        </label>

        <label>
          <span>Time format</span>
          <select
            value={preferences.clock.timeFormat}
            disabled={!preferences.clock.enabled}
            onChange={(event) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  timeFormat: event.target.value as WorkspacePreferences["clock"]["timeFormat"],
                },
              })
            }
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </label>

        <label>
          <span>Date format</span>
          <select
            value={preferences.clock.dateFormat}
            disabled={!preferences.clock.enabled}
            onChange={(event) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  dateFormat: event.target.value as WorkspacePreferences["clock"]["dateFormat"],
                },
              })
            }
          >
            <option value="none">None</option>
            <option value="text">Text</option>
            <option value="numeric">Numeric (YYYY-MM-DD)</option>
          </select>
        </label>
      </section>

      <section className="settings-panel__section">
        <h3>Theme</h3>
        <label>
          <span>Mode</span>
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
          <span>Preset</span>
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
      </section>

      <section className="settings-panel__section settings-panel__section--colors">
        <div className="settings-panel__section-header">
          <h3>Advanced Colors</h3>
          <button type="button" onClick={clearAllColors}>
            Clear all
          </button>
        </div>
        {colorFields.map((field) => {
          const value = preferences.colorOverrides[field.key] ?? "#000000";
          const hasOverride = Boolean(preferences.colorOverrides[field.key]);

          return (
            <label className="settings-color-row" key={field.key}>
              <span>{field.label}</span>
              <input
                type="color"
                value={value}
                onChange={(event) => updateColor(field.key, event.target.value)}
              />
              <button
                type="button"
                disabled={!hasOverride}
                onClick={() => clearColor(field.key)}
              >
                Clear
              </button>
            </label>
          );
        })}
      </section>

      <section className="settings-panel__section">
        <h3>Panel Menu Arrangement</h3>
        <label>
          <span>Panel sort</span>
          <select
            value={preferences.panelMenu.panelSort}
            onChange={(event) =>
              updatePanelMenu({
                panelSort: event.target.value as WorkspacePreferences["panelMenu"]["panelSort"],
              })
            }
          >
            <option value="registered">Registered order</option>
            <option value="title">Title</option>
          </select>
        </label>

        <div className="settings-module-list">
          {arrangedModules.map((module, index) => {
            const hidden = preferences.panelMenu.hiddenModuleIds.includes(
              module.moduleId,
            );

            return (
              <div className="settings-module-row" key={module.moduleId}>
                <label>
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={(event) =>
                      setModuleVisible(module.moduleId, event.target.checked)
                    }
                  />
                  <span>{module.title}</span>
                </label>
                <div>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveModule(module.moduleId, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={index === arrangedModules.length - 1}
                    onClick={() => moveModule(module.moduleId, 1)}
                  >
                    Down
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function arrangeModules(
  modules: PanelBodyProps["modules"],
  moduleOrder: string[],
) {
  const orderIndex = new Map(
    moduleOrder.map((moduleId, index) => [moduleId, index]),
  );

  return [...modules].sort((a, b) => {
    const aIndex = orderIndex.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return a.title.localeCompare(b.title);
  });
}
