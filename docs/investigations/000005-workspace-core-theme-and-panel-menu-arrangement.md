# Workspace Core Theme And Panel Menu Arrangement

## Scope

This investigation note records the fixes for Workspace Core theme preset behavior and Panels menu arrangement settings.

No GTI, ChronoGit, Spooty, or new domain modules were implemented.

## Theme Preset Fixes

Theme behavior was strengthened in `src/styles.css`.

The preset/mode model now composes as:

- base dark neutral tokens
- dark preset overrides
- light mode neutral overrides
- light preset overrides
- system mode follows `prefers-color-scheme`
- custom color overrides are layered last

Theme tokens now clearly affect:

- page
- shell
- canvas
- panel
- panel header
- borders
- text
- muted text
- buttons
- menu background

The presets are intentionally more visually distinct:

- Neutral: quiet default workspace palette.
- Graphite: warmer gray/tan graphite surface set.
- Contrast: high-contrast black/white surface set.
- Blueprint: blue operational surface set.

Light mode has explicit variants for every preset. Custom colors still override presets without mutating preset definitions.

## Custom Color Overrides

`WorkspaceState.preferences.colorOverrides` remains optional.

Added menu background override support:

- `menu`

Existing overrides remain:

- page
- canvas
- panel
- panel header
- text
- muted text
- border
- button

The shell applies `data-has-custom-*` flags and `--override-*` CSS variables. CSS maps those to effective `--color-*` tokens after preset/mode resolution.

## Panel Menu Arrangement

Added persisted panel menu preferences:

```ts
panelMenu: {
  moduleOrder: string[];
  hiddenModuleIds: string[];
  panelSort: "registered" | "title";
}
```

The Panels menu now respects:

- user-controlled module order
- hidden/visible module selection
- panel sorting by registered order or title

Settings exposes this through a deterministic section:

- module visibility checkbox
- Up/Down buttons for module order
- select control for panel sort

No drag-and-drop was added.

## Persistence

`layoutPersistence` now normalizes and repairs:

- `panelMenu.moduleOrder`
- `panelMenu.hiddenModuleIds`
- `panelMenu.panelSort`
- menu color override

Existing layouts without these fields repair to defaults.

## What Stayed Simple

- Module arrangement is by Up/Down controls only.
- Panel sorting is global for the menu, not per-module.
- Hidden modules are hidden only from the Panels menu; existing panels from hidden modules remain on the canvas.
- Custom colors are raw color inputs, not a full theme designer.
- No domain settings or GTI settings were added.

## Verification

Commands run:

- `npm run typecheck`
- `npm run build`

Both passed.

