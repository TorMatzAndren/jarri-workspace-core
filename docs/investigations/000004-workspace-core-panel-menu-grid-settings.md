# Workspace Core Panel Menu, Grid, And Settings Hardening

## Scope

This document records the Workspace Core hardening pass for panel menu UX, grid doctrine, and framework-level settings.

No GTI, ChronoGit, Spooty, or domain-specific behavior was added.

## Panel Menu

The flat shell action button list was replaced with a grouped Panels menu in `WorkspaceShell`.

The menu is built from `WorkspaceModuleRuntime` module records:

- each group maps to a registered module
- each item maps to a registered panel definition
- the missing-panel projection is excluded
- selecting an item creates the panel through `WorkspaceController`

This keeps panel discovery module-aware without letting the shell become a growing list of direct domain imports.

## Grid Doctrine

Default panel geometry was corrected to be grid-native.

The current grid is 12 px. Default panel positions, dimensions, and minimum sizes now use grid-aligned values. New panels also open with a grid-aligned offset because `WorkspaceController.createPanel()` calls `geometryFromPanelDefinition()` with a 24 px offset.

The `LayoutEngine` now snaps normalized persisted geometry to the grid as well, so repaired layouts do not drift into off-grid values.

Full docking is still intentionally not implemented.

## Settings Panel

The framework Settings panel remains a core panel registered through the module runtime.

Settings now supports:

- font family presets: system UI, humanist, compact sans, serif, monospace
- separate font size
- UI density
- theme mode: system, dark, light
- theme presets: neutral, graphite, contrast, blueprint
- workspace scale
- optional advanced color overrides

Advanced color overrides cover:

- page background
- canvas background
- panel background
- panel header
- text
- muted text
- borders
- buttons

Overrides are stored as optional `WorkspaceState.preferences.colorOverrides` values. They are layered over presets and can be cleared individually or all at once. They do not mutate the preset definitions.

## Theme Tokens

Theme behavior is centralized in CSS custom properties in `src/styles.css`.

The shell sets:

- `data-font-family`
- `data-density`
- `data-theme-mode`
- `data-theme-preset`
- `data-has-custom-*` flags
- `--workspace-scale`
- `--workspace-font-size`
- optional `--override-*` custom properties

CSS resolves those into framework tokens:

- `--theme-*` preset tokens
- `--color-*` effective tokens
- `--font-family-active`
- density padding
- scaled shell/canvas/panel chrome

Light and dark mode are defined for every preset. `system` mode follows `prefers-color-scheme` while still respecting the selected preset.

## Persistence

All settings are stored in `WorkspaceState.preferences`.

Persistence normalization now repairs and clamps:

- workspace scale
- font size
- font family
- density
- theme mode
- theme preset
- custom color override values

Runtime truth is still not persisted in `panelState`.

## What Stayed Intentionally Simple

- The Panels menu is a small shell menu, not a command palette.
- Settings are framework-level only.
- Color overrides are raw color inputs, not a full theme editor.
- Workspace scale uses CSS tokens and transforms; it does not introduce a new layout coordinate system.
- No domain-specific theme presets were added.
- No GTI panels or data services were added.

## GTI Readiness

This pass prepares for GTI by making panel discovery module-grouped and by keeping settings framework-owned. A future GTI module can register panels through `WorkspaceModuleRuntime` without changing persistence or adding shell-specific GTI buttons.

GTI should still wait for provider contracts before domain implementation:

- truth providers
- advisory providers
- temporal providers
- preflight coordinator
- dirty/lifecycle enforcement

## Verification

Commands run:

- `npm run typecheck`
- `npm run build`

Both passed.

