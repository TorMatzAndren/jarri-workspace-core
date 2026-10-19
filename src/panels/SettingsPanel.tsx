import { useEffect, useState } from "react";
import {
  WorkspaceSelect,
  type WorkspaceSelectOption,
} from "../core/WorkspaceSelect";
import { WorkspaceNumberInput } from "../core/WorkspaceNumberInput";
import type {
  PanelBodyProps,
  WorkspacePreferences,
} from "../core/types";
import {
  consumeSettingsSectionRequest,
  getSettingsSectionNavigationSnapshot,
  subscribeSettingsSectionNavigation,
} from "../core/settingsSectionNavigation";
import { UpdateSettingsSection } from "./UpdateSettingsSection";

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

const tabStripOverflowOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["tabStripOverflow"]
>> = [
  { value: "scroll", label: "Scrollable single row" },
  { value: "wrap", label: "Wrap to multiple rows" },
];

const organizeModeOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["organizeMode"]
>> = [
  { value: "preserve", label: "Preserve sizes (grid-aligned)" },
  { value: "uniform", label: "Uniform grid (equal sizes)" },
];

const zoomAnchorOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["workspaceZoomAnchorMode"]
>> = [
  { value: "viewport-center", label: "Viewport center" },
  { value: "active-panel-center", label: "Active panel center" },
  { value: "active-panel-top-left", label: "Active panel top-left" },
  { value: "pointer", label: "Pointer" },
];

const panelNavigationAlignmentOptions: Array<WorkspaceSelectOption<
  WorkspacePreferences["panelNavigationAlignment"]
>> = [
  { value: "panel-center", label: "Panel center" },
  { value: "panel-top-left", label: "Panel top-left" },
];

export function SettingsPanel({
  preferences,
  updatePreferences,
  openPanel,
}: PanelBodyProps) {
  const [settingsNavigation, setSettingsNavigation] = useState(
    getSettingsSectionNavigationSnapshot,
  );

  useEffect(() => {
    const unsubscribe = subscribeSettingsSectionNavigation(() => {
      setSettingsNavigation(getSettingsSectionNavigationSnapshot());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (settingsNavigation.requestedSection !== "updates") return;
    document
      .getElementById("settings-updates-section")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
    consumeSettingsSectionRequest(settingsNavigation.revision);
  }, [settingsNavigation]);

  function updateScale(delta: number) {
    const nextScale = Math.max(
      0.75,
      Math.min(1.35, Number((preferences.scale + delta).toFixed(2))),
    );
    updatePreferences({ scale: nextScale });
  }

  return (
    <div className="panel-body settings-panel">
      <UpdateSettingsSection />
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
            className="workspace-range"
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
            <span>Tab overflow</span>
            <WorkspaceSelect
              value={preferences.tabStripOverflow}
              options={tabStripOverflowOptions}
              ariaLabel="Tab strip overflow"
              onChange={(tabStripOverflow) => updatePreferences({ tabStripOverflow })}
            />
          </label>
          <label>
            <span>Compress tab buttons</span>
            <input
              type="checkbox"
              checked={preferences.compressTabButtons}
              onChange={(event) =>
                updatePreferences({ compressTabButtons: event.target.checked })
              }
            />
          </label>
          <p className="settings-panel__help">
            Scroll keeps tabs in one row with a keyboard-accessible scrollbar. Wrap shows tabs on additional rows. Compression reduces each tab title’s minimum width.
          </p>
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
          <span>Grid size</span>
          <WorkspaceNumberInput
            min={1}
            step={1}
            ariaLabel="Grid size"
            value={preferences.gridSize}
            onChange={(value) =>
              updatePreferences({
                gridSize: Math.max(1, Math.round(value)),
              })
            }
          />
          <strong>{preferences.gridSize}px</strong>
          </label>

          <label>
            <span>Panel spacing</span>
            <WorkspaceNumberInput
              min={0}
              max={240}
              step={1}
              ariaLabel="Panel spacing"
              value={preferences.panelSpacing}
              onChange={(value) =>
                updatePreferences({
                  panelSpacing: Math.max(
                    0,
                    Math.min(
                      240,
                      Math.round(value),
                    ),
                  ),
                })
              }
            />
            <strong>{preferences.panelSpacing}px</strong>
          </label>

          <label>
            <span>Organize mode</span>
            <WorkspaceSelect
              value={preferences.organizeMode}
              options={organizeModeOptions}
              ariaLabel="Organize mode"
              onChange={(organizeMode) =>
                updatePreferences({ organizeMode })
              }
            />
          </label>

          <label>
            <span>Organize panel gap</span>
            <WorkspaceNumberInput
              min={0}
              max={4}
              step={1}
              ariaLabel="Organize panel gap in grid units"
              value={preferences.organizeGapUnits ?? 0}
              onChange={(value) =>
                updatePreferences({
                  organizeGapUnits: Math.max(
                    0,
                    Math.min(4, Math.round(value)),
                  ),
                })
              }
            />
            <strong>
              {(preferences.organizeGapUnits ?? 0) * preferences.gridSize}px
            </strong>
          </label>

          <label>
            <span>Zoom step</span>
            <WorkspaceNumberInput
              min={0.1}
              max={100}
              step={0.1}
              ariaLabel="Workspace zoom step"
              value={preferences.workspaceZoomIncrement}
              onChange={(value) =>
                updatePreferences({
                  workspaceZoomIncrement: Math.max(0.1, Math.min(100, value)),
                })
              }
            />
            <strong>{preferences.workspaceZoomIncrement}%</strong>
          </label>

          <label>
            <span>Zoom anchor</span>
            <WorkspaceSelect
              value={preferences.workspaceZoomAnchorMode}
              options={zoomAnchorOptions}
              ariaLabel="Workspace zoom anchor"
              onChange={(workspaceZoomAnchorMode) =>
                updatePreferences({ workspaceZoomAnchorMode })
              }
            />
          </label>

          <label>
            <span>Navigate to</span>
            <WorkspaceSelect
              value={preferences.panelNavigationAlignment}
              options={panelNavigationAlignmentOptions}
              ariaLabel="Panel navigation alignment"
              onChange={(panelNavigationAlignment) =>
                updatePreferences({ panelNavigationAlignment })
              }
            />
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
          <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Settings X"
            value={preferences.systemSurfacePositions.settings.x}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  settings: {
                    ...preferences.systemSurfacePositions.settings,
                    x: Math.max(
                      0,
                      Math.round(value),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Settings Y">
              <span className="settings-panel__visually-hidden">Settings Y</span>
              <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Settings Y"
            value={preferences.systemSurfacePositions.settings.y}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  settings: {
                    ...preferences.systemSurfacePositions.settings,
                    y: Math.max(
                      0,
                      Math.round(value),
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
              <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Add Panel X"
            value={preferences.systemSurfacePositions.addPanel.x}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  addPanel: {
                    ...preferences.systemSurfacePositions.addPanel,
                    x: Math.max(
                      0,
                      Math.round(value),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Add Panel Y">
              <span className="settings-panel__visually-hidden">Add Panel Y</span>
              <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Add Panel Y"
            value={preferences.systemSurfacePositions.addPanel.y}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  addPanel: {
                    ...preferences.systemSurfacePositions.addPanel,
                    y: Math.max(
                      0,
                      Math.round(value),
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
              <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Frame Settings X"
            value={preferences.systemSurfacePositions.frameSettings.x}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  frameSettings: {
                    ...preferences.systemSurfacePositions.frameSettings,
                    x: Math.max(
                      0,
                      Math.round(value),
                    ),
                  },
                },
              })
            }
          />
            </label>

            <label aria-label="Frame Settings Y">
              <span className="settings-panel__visually-hidden">Frame Settings Y</span>
              <WorkspaceNumberInput
            min={0}
            step={1}
            ariaLabel="Frame Settings Y"
            value={preferences.systemSurfacePositions.frameSettings.y}
            onChange={(value) =>
              updatePreferences({
                systemSurfacePositions: {
                  ...preferences.systemSurfacePositions,
                  frameSettings: {
                    ...preferences.systemSurfacePositions.frameSettings,
                    y: Math.max(
                      0,
                      Math.round(value),
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

        <label>
          <span>Week number</span>
          <input
            type="checkbox"
            checked={preferences.clock.showWeekNumber}
            disabled={!preferences.clock.enabled}
            onChange={(event) =>
              updatePreferences({
                clock: {
                  ...preferences.clock,
                  showWeekNumber: event.target.checked,
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

    </div>
  );
}
