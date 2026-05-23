# Workspace Core Geometry And Scale Hardening

## Scope

This document records the Workspace Core geometry/scale/layout-lifecycle hardening pass before minimization, smart fill, docking, or GTI.

Source truth:

- `docs/investigations/000006-workspace-core-panel-lifecycle-smart-fill-bugs.md`
- `docs/investigations/000005-workspace-core-theme-and-panel-menu-arrangement.md`
- `docs/investigations/000003-workspace-core-structural-hardening.md`
- `docs/contracts/000001-workspace-core-architecture.md`
- `docs/contracts/000002-panel-contract.md`
- `docs/contracts/000003-layout-persistence-contract.md`

No GTI, minimization, smart fill, or docking was implemented.

## Logical Geometry Doctrine

Workspace Core now treats panel geometry as logical canvas units.

Rules:

- Persisted geometry is always logical canvas geometry.
- Workspace scale is visual zoom only.
- Pointer deltas are corrected by workspace scale before becoming logical deltas.
- Scaled visual geometry is never persisted.
- Committed geometry remains grid-aligned.

The canvas now contains a logical layer that is visually scaled. Panels are positioned and sized in logical units inside that layer. This avoids the previous per-panel transform problem where size scaled but left/top positions did not scale consistently.

## Scale Behavior

`WorkspaceCanvas` renders panels inside `.workspace-canvas__logical`.

The logical layer uses:

- `transform: scale(var(--workspace-scale))`
- `transform-origin: top left`
- logical width/height compensated by scale

`PanelFrame` receives the current workspace scale through preferences. The layout engine divides pointer movement by scale, so a visual drag at 75%, 100%, and 135% maps back into stable logical deltas.

## Preview vs Commit Lifecycle

Drag/resize no longer writes workspace state on every pointer move.

Current lifecycle:

1. Pointer down calls `beginGeometryInteraction`.
2. `PanelFrame` stores local `previewGeometry`.
3. Pointer move updates local preview only.
4. Pointer up calls `commitGeometryInteraction`.
5. `WorkspaceController.updatePanelGeometry` updates workspace state once.
6. Persistence runs after the committed workspace state changes.
7. Escape cancels preview and restores the original geometry visually.

This gives future minimization and smart fill a stable distinction between transient interaction state and committed layout state.

## LayoutEngine Changes

`src/core/layoutEngine.ts` now owns:

- grid snapping
- snap-up behavior for minimum sizes
- scale normalization
- scale-aware pointer delta handling
- `beginGeometryInteraction`
- `previewGeometryInteraction`
- `commitGeometryInteraction`
- `cancelGeometryInteraction`
- deterministic grid-aligned committed geometry

Committed widths, heights, x, and y are snapped to the grid. Minimum sizes are snapped upward so min-size enforcement cannot produce off-grid committed geometry.

## Focus Compaction

Focus order previously used `max + 1` indefinitely.

`WorkspaceController.focusPanel` now compacts focus order with `repairFocusOrder` when the next focus value crosses a threshold. Closing a panel also compacts focus order.

This keeps z-index bounded and preserves deterministic visual ordering.

## Minor Fixes Made

### Settings Recovery

The shell now exposes a stable Settings button outside the Panels menu.

This prevents Settings from becoming unrecoverable if the Core module is hidden in the Panels menu arrangement settings.

### Panel Menu Z-Index

Panel focus order is now bounded, while the Panels menu remains at a high z-index. This keeps the menu above panels without relying on unbounded panel z-index values.

### Build Output

`.gitignore` already contains:

- `dist/`
- `*.tsbuildinfo`

However, `dist/index.html` is currently tracked, so production builds can still produce tracked build-output diffs. That should be handled separately if the project wants source-only commits.

## Remaining Blockers Before Minimization

Do not implement minimization until:

- `PanelInstance` has explicit display state, such as `normal` vs `minimized`.
- dirty-state reporting is operational, not only typed.
- close/minimize/restore lifecycle hooks are coordinated by core.
- mounted vs dormant minimized behavior is defined in panel capabilities.
- minimized strip/dock placement is designed.
- schema migration for display state is added.

## Remaining Blockers Before Smart Fill

Do not implement smart fill until:

- panel layout metadata exists on `PanelDefinition`
- canvas measurement abstraction exists
- minimized panels have defined participation rules
- layout engine has a smart-fill entry point
- focus compaction is tested with layout-wide mutations
- layout preview/commit semantics are used consistently

Recommended metadata still needed:

- preferred size
- minimum useful size
- ideal aspect ratio
- role
- grouping affinity
- fill weight

## Manual UX Checks To Perform

- Drag panel at scale 75%, 100%, 135%.
- Resize panel at scale 75%, 100%, 135%.
- Reload and confirm geometry persists only committed state.
- Change theme/preset/custom colors and confirm no layout drift.
- Open Panels menu and confirm it appears above panels.
- Confirm Settings remains recoverable even if Core is hidden.

## Verification

Commands run:

- `npm run typecheck`
- `npm run build`

Both passed.

