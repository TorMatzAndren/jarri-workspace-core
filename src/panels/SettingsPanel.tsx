import {
  WorkspaceSelect,
  type WorkspaceSelectOption,
} from "../core/WorkspaceSelect";
import type {
  PanelBodyProps,
  WorkspacePreferences,
} from "../core/types";

const fontOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["fontFamily"]
>> = [
  { value: "system", label: "System UI" },
  { value: "humanist", label: "Humanist" },
  { value: "compact", label: "Compact Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
];

const densityOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["density"]
>> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

export function SettingsPanel({
  preferences,
  modules,
  updatePreferences,
  openPanel,
}: PanelBodyProps) {
  const arrangedModules = arrangeModules(modules, preferences.panelMenu.moduleOrder);

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
      <section className="settings-panel__section settings-panel__section--interface">
        <h3>Interface</h3>

        <div className="settings-panel__group settings-panel__group--display">
          <h4>Display</h4>
          <label>
          <span>Font</span>
          <WorkspaceSelect
            value={preferences.fontFamily}
            options={fontOptions}
            ariaLabel="Font"
            onChange={(fontFamily) =>
              updatePreferences({ fontFamily })
            }
          />
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
          <WorkspaceSelect
            value={preferences.density}
            options={densityOptions}
            ariaLabel="Density"
            onChange={(density) =>
              updatePreferences({ density })
            }
          />
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
        </div>

        <div className="settings-panel__group settings-panel__group--layout">
          <h4>Layout</h4>
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

        <label>
          <span>Panel spacing</span>
          <input
            type="number"
            min="0"
            max="240"
            step="1"
            value={preferences.panelSpacing}
            onChange={(event) =>
              updatePreferences({
                panelSpacing: Math.max(
                  0,
                  Math.min(
                    240,
                    Math.round(Number.parseFloat(event.target.value) || 0),
                  ),
                ),
              })
            }
          />
          <strong>{preferences.panelSpacing}px</strong>
          </label>
        </div>

        <div className="settings-panel__group settings-panel__group--surfaces">
          <h4>System Surfaces</h4>
          <div className="settings-surface-grid">
            <strong>Surface</strong>
            <strong>X</strong>
            <strong>Y</strong>

            <span>Settings</span>
            <label aria-label="Settings X">
              <span className="settings-panel__visually-hidden">Settings X</span>
          <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.settings.x}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  settings: {
                    ...preferences.systemSurfacePositions.settings,
                    x: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Settings Y">
              <span className="settings-panel__visually-hidden">Settings Y</span>
              <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.settings.y}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  settings: {
                    ...preferences.systemSurfacePositions.settings,
                    y: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <span>Add Panel</span>
            <label aria-label="Add Panel X">
              <span className="settings-panel__visually-hidden">Add Panel X</span>
              <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.addPanel.x}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  addPanel: {
                    ...preferences.systemSurfacePositions.addPanel,
                    x: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Add Panel Y">
              <span className="settings-panel__visually-hidden">Add Panel Y</span>
              <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.addPanel.y}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  addPanel: {
                    ...preferences.systemSurfacePositions.addPanel,
                    y: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <span>Frame Settings</span>
            <label aria-label="Frame Settings X">
              <span className="settings-panel__visually-hidden">Frame Settings X</span>
              <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.frameSettings.x}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  frameSettings: {
                    ...preferences.systemSurfacePositions.frameSettings,
                    x: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Frame Settings Y">
              <span className="settings-panel__visually-hidden">Frame Settings Y</span>
              <input
            type="number"
            min="0"
            step="1"
            value={preferences.systemSurfacePositions.frameSettings.y}
            onChange={(event) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  frameSettings: {
                    ...preferences.systemSurfacePositions.frameSettings,
                    y: Math.max(
                      0,
                      Math.round(Number.parseFloat(event.target.value) || 0),
                    ),
                  },
                },
              })
            }
          />
            </label>
          </div>
        </div>

        <div className="settings-panel__group settings-panel__group--clock">
          <h4>Clock</h4>
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
          <WorkspaceSelect
            value={preferences.clock.timeFormat}
            disabled={!preferences.clock.enabled}
            ariaLabel="Time format"
            options={[
              { value: "24h", label: "24-hour" },
              { value: "12h", label: "12-hour" },
            ]}
            onChange={(timeFormat) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  timeFormat,
                },
              })
            }
          />
        </label>

        <label>
          <span>Date format</span>
          <WorkspaceSelect
            value={preferences.clock.dateFormat}
            disabled={!preferences.clock.enabled}
            ariaLabel="Date format"
            options={[
              { value: "none", label: "None" },
              { value: "text", label: "Text" },
              { value: "numeric", label: "Numeric (YYYY-MM-DD)" },
            ]}
            onChange={(dateFormat) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  dateFormat,
                },
              })
            }
          />
          </label>
        </div>
      </section>

      <section className="settings-panel__section settings-panel__section--appearance">
        <h3>Appearance</h3>
        <button
          type="button"
          onClick={() => openPanel("core", "theme-colors")}
        >
          Themes / Colours…
        </button>
      </section>

      <section className="settings-panel__section settings-panel__section--panel-menu">
        <h3>Panel Menu Arrangement</h3>
        <label>
          <span>Panel sort</span>
          <WorkspaceSelect
            value={preferences.panelMenu.panelSort}
            ariaLabel="Panel sort"
            options={[
              { value: "registered", label: "Registered order" },
              { value: "title", label: "Title" },
            ]}
            onChange={(panelSort) =>
              updatePanelMenu({ panelSort })
            }
          />
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
