# Workspace Core Manual UX Hardening

## Scope

This pass addresses manual-testing issues in the framework shell without adding GTI behavior, minimization, smart fill, docking, or a new state-management layer. The work stays inside Workspace Core primitives: preferences, tabs, panel projections, theme tokens, grid visibility, and local panel setup data.

## Scale Flicker Fix

Workspace scale remains a persisted workspace preference, but Settings no longer applies scale through a continuously dragged range control. Scale now changes through explicit decrement/increment buttons in 5% steps between 75% and 135%.

The doctrine remains unchanged: persisted panel geometry is logical canvas geometry, while scale is visual zoom. Avoiding continuous scale writes prevents layout thrash while a pointer is active on the control.

## Grid Visibility Preference

`WorkspaceState.preferences.showGrid` controls whether the canvas grid is visible. Missing persisted values repair to `true`, preserving the default grid-visible behavior.

The shell exposes the preference through a `data-grid-visible` attribute and CSS switches the canvas surface from grid gradients to the plain canvas token when disabled.

## Theme And Preset Fix

Theme behavior remains centralized in CSS custom properties. Preset and mode composition now visibly affects page, shell, canvas, panels, panel headers, borders, text, muted text, buttons, and menu background.

Light mode has explicit token sets for Neutral, Graphite, Contrast, and Blueprint. System mode still follows `prefers-color-scheme`, with the same light-mode preset composition when the OS requests light.

Custom colors remain optional overrides. They override the computed preset/mode tokens without mutating the preset definitions.

## Status Pill Removal

The inert header badges were removed from the primary shell header:

- `Schema v1`
- `layout clean`
- `truth/advisory separated`

They were diagnostic labels, not controls or actionable state. If this information becomes useful later, it should live in a diagnostics/dev panel rather than permanently consuming header attention.

## Tab Rename Behavior

Tabs can now be renamed inline from the tab strip by double-clicking the tab title. Empty names are ignored. Renamed titles are stored on the existing `WorkspaceTab.title` field and persist through the normal workspace layout persistence path.

## Save And Load Panel Setup Behavior

The tab strip now includes Save Panel Setup and Load Panel Setup controls. Save Panel Setup creates a local reusable panel arrangement/projection setup from the active tab. The saved setup name defaults to the exact current tab title and does not append `Template`.

Saved panel setups store only projection data:

- module id
- panel type
- panel title
- logical panel geometry

Panel setups intentionally do not store runtime truth or existing panel ids. Loading a setup currently creates a new tab with fresh tab and panel ids. Known panels receive fresh initial panel state from their registered panel definitions. Unknown panels repair into the existing Core missing-panel projection.

## Import And Export JSON Format

Panel setup export produces a JSON document shaped as:

```json
{
  "kind": "jarri.workspace.tabs",
  "schemaVersion": 1,
  "exportedAt": "ISO timestamp",
  "templates": [
    {
      "id": "setup-id",
      "title": "Saved title",
      "sourceTitle": "Original tab title",
      "panels": [
        {
          "moduleId": "demo",
          "panelType": "timeline",
          "title": "Timeline Demo",
          "geometry": {
            "x": 576,
            "y": 24,
            "width": 564,
            "height": 360
          }
        }
      ],
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  ]
}
```

Export includes saved panel setups plus setups derived from current workspace tabs. Import validates the kind/schema shape and stores repaired setups locally for later Load Panel Setup use.

## Import Security And Repair Rules

Imported JSON is data only. Workspace Core does not execute imported code, dynamically import modules, or trust panel runtime state from the file.

Repair rules:

- Invalid JSON is rejected.
- Wrong `kind` imports no setups.
- Missing or malformed setup fields repair to deterministic defaults.
- Geometry is normalized through the grid-aware layout engine.
- Loaded panels always receive fresh ids.
- Known panels receive fresh initial state from the registry.
- Unknown module/panel references become Core missing-panel projections.

## Remaining Issues Before Minimization Or Smart Fill

Minimization still needs lifecycle doctrine for dormant vs mounted panels, focus/z-order behavior, dirty state, and where minimized projections live.

Smart fill should wait until panel definitions gain layout metadata such as preferred size, minimum useful size, role, grouping affinity, and ideal aspect ratio. The current panel setup work deliberately avoids automatic placement beyond normalized logical geometry.

Manual UX verification should still exercise scale, grid visibility, light/dark preset contrast, tab persistence, and unknown-panel import repair before building minimization or smart fill.
