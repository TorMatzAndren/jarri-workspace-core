# Workspace Core Panel Lifecycle, Smart Fill, And Bug Investigation

## Scope

Investigation-only review of Workspace Core panel lifecycle, minimization, smart tab fill, and obvious implementation bugs/risks.

Source truth reviewed:

- `docs/investigations/000001-workspace-core-source-audit.md`
- `docs/investigations/000002-workspace-core-entropy-risks.md`
- `docs/investigations/000003-workspace-core-structural-hardening.md`
- `docs/investigations/000004-workspace-core-panel-menu-grid-settings.md`
- `docs/investigations/000005-workspace-core-theme-and-panel-menu-arrangement.md`
- `docs/contracts/000001-workspace-core-architecture.md`
- `docs/contracts/000002-panel-contract.md`
- `docs/contracts/000003-layout-persistence-contract.md`

Current implementation files inspected:

- `src/core/types.ts`
- `src/core/workspaceController.ts`
- `src/core/layoutEngine.ts`
- `src/core/layoutPersistence.ts`
- `src/workspace/PanelFrame.tsx`
- `src/workspace/WorkspaceCanvas.tsx`
- `src/shell/WorkspaceShell.tsx`
- `src/panels/SettingsPanel.tsx`
- `src/styles.css`

## Executive Findings

Workspace Core should not add minimization or smart fill until layout mutation and panel lifecycle are made more explicit.

The most important distinction: minimized is not closed. Closed removes a panel instance from the tab. Minimized should preserve the panel instance, dirty state, identity, and layout restore geometry while changing its presentation/activation state.

Smart Tab Fill should not be a naïve equal split. Workspace Core panels already imply different roles: truth panels, timelines, logs, settings, utility surfaces, and future domain primary panels need different geometry. A deterministic grid-aware heuristic needs metadata from `PanelDefinition` before it can be reliable.

The largest current implementation risks are:

- panel geometry is persisted while drag is in progress
- `transform: scale(...)` on panels can desynchronize pointer coordinates and visible geometry
- scaled panels keep unscaled absolute layout coordinates, creating overlap and hit-testing issues
- focus order can grow indefinitely
- panel lifecycle is still close/filter only
- dirty state is typed but not enforced
- persisted old preference shapes are repaired, but future panel lifecycle fields will need explicit migration
- hiding Core in the panel menu can hide Settings from future discovery
- `dist` is tracked and build churn produces noisy source diffs

## Panel Minimization Model

### Meaning

Minimized should mean "panel instance is still part of the tab, but not occupying its normal canvas rectangle."

It is distinct from closed:

- Closed: remove panel instance from `WorkspaceTab.panels`.
- Minimized: keep panel instance in `WorkspaceTab.panels`, preserve state, preserve dirty snapshot, preserve module/panel identity, and preserve restore geometry.

Recommended state shape:

```ts
type PanelDisplayState = {
  mode: "normal" | "minimized";
  restoreGeometry?: PanelGeometry;
  minimizedAt?: string;
};
```

This should be part of `PanelInstance`, not `panelState`. Minimized is framework layout state, not domain panel state.

### Persistence

Persist minimized state as layout preference.

Minimum persisted fields:

- `display.mode`
- `display.restoreGeometry`
- `focusOrder`
- normal `geometry`

When minimized, `geometry` can either represent the minimized strip tile geometry or the last normal geometry. Prefer explicit `restoreGeometry` to avoid ambiguity.

### Where Minimized Panels Should Appear

Use a tab-local minimized strip/dock, not the panel menu.

Recommended first model:

- minimized panels appear in a bottom or top strip inside the active tab canvas
- each minimized item shows title and module/panel type
- clicking restores the panel
- closing from minimized state still follows dirty-state rules

Do not mix minimized panels into the Panels menu. The Panels menu creates new panel instances; minimized panels are existing instances.

### Mounted vs Dormant

Default should be dormant/unmounted for minimized panels unless a panel definition explicitly requires background activity.

Reasons:

- avoids hidden subscriptions
- reduces expensive temporal/log/truth refresh work
- makes minimized a real resource-saving state
- prevents hidden UI from mutating presentation state unexpectedly

Required metadata:

```ts
type PanelCapabilities = {
  canRunMinimized?: boolean;
  minimizeBehavior?: "dormant" | "mounted";
};
```

For v1, default all panels to dormant.

### Dirty-State Implications

Minimization must not discard dirty data.

Rules:

- Dirty panel can be minimized without prompt.
- Dirty state must remain visible in minimized strip.
- Close from minimized state must run the same dirty close flow as normal panels.
- Save/discard hooks must not depend on the panel being mounted.

This implies dirty state cannot live only inside panel component local state. The controller/runtime needs an authoritative dirty snapshot.

### Focus / Z-Order

Minimized panels should not compete in normal z-order.

Recommended rules:

- minimizing removes panel from visible z-stack but keeps its last `focusOrder`
- restoring brings panel to front by assigning a new focus order
- minimized strip order should be deterministic, probably minimize time or previous focus order
- focus order should be compacted periodically to prevent runaway values

## Smart Tab Fill Concept

Smart Tab Fill should arrange currently open, non-minimized panels into a usable workspace layout.

It should:

- only mutate layout geometry/display state
- preserve panel identity and state
- ignore or separately place minimized panels
- operate deterministically
- stay grid-aligned
- avoid crossing minimum useful sizes

### Why 50/50 Splitting Is Insufficient

Simple equal splitting fails because panels have different cognitive roles.

Examples:

- Timeline wants horizontal space and moderate height.
- Log/advisory panel can be narrower or shorter.
- Settings is utility and should not dominate a tab.
- Future primary investigation panels need dominant space.
- Truth/status panels can be compact but should remain visible.
- Some panels become unreadable below their minimum useful width.

Equal splitting also breaks with 3, 5, or 7 panels and ignores aspect ratios. It creates layouts that are mathematically tidy but operationally poor.

## Required Panel Layout Metadata

Add metadata to `PanelDefinition`, not `PanelInstance`.

Recommended shape:

```ts
type PanelLayoutMetadata = {
  preferredSize: { width: number; height: number };
  minimumUsefulSize: { width: number; height: number };
  idealAspectRatio?: number;
  role:
    | "primary"
    | "support"
    | "supporting"
    | "utility"
    | "log"
    | "timeline";
  groupingAffinity?: string[];
  fillWeight?: number;
};
```

Definitions:

- `preferredSize`: best default size for adding panel and smart fill.
- `minimumUsefulSize`: below this size, smart fill should avoid placing the panel.
- `idealAspectRatio`: helps choose wide vs tall placement.
- `role`: influences priority and zone.
- `groupingAffinity`: hints that related panels should be adjacent.
- `fillWeight`: optional tie-breaker within role.

Current `defaultGeometry` and `minGeometry` are not enough. They describe initial placement and hard minimums, not useful layout intent.

## Deterministic Layout Heuristics

Recommended first heuristic: grid-aware deterministic shelf/bin packing with role zones.

Inputs:

- canvas available width/height
- grid size
- non-minimized panels
- panel layout metadata
- existing tab order
- module/panel identity

Steps:

1. Reserve minimized strip if minimized panels exist.
2. Sort visible panels by role priority:
   - primary
   - timeline
   - support/supporting
   - utility
   - log
3. Assign primary panel(s) first to largest region.
4. Place timeline panels in wide shelves.
5. Place support/utility/log panels in side or lower shelves.
6. Snap every coordinate and size to grid.
7. Clamp each panel to `minimumUsefulSize`.
8. If panels cannot fit, overflow into deterministic stacked rows below the viewport instead of shrinking below useful size.
9. Compact focus order after layout.

Determinism requirements:

- same inputs produce same layout
- no dependence on current browser timing
- stable tie-breakers: role, module order, panel definition order, panel id
- smart fill should be undoable later, but undo is not required for v1

Potential layout zones:

- primary zone: left/center dominant area
- support zone: right column
- timeline zone: wide lower band
- log zone: lower/right utility band
- minimized strip: fixed edge strip

## Obvious Bugs / Risks

### Workspace Scale + Absolute Positioning

Current panels use absolute `left/top/width/height` and CSS `transform: scale(var(--workspace-scale))`.

Risk:

- visual panel size changes, but layout coordinates remain unscaled
- panels can visually overlap while geometry says they do not
- hit areas and bounds can feel wrong
- smart fill would compute unscaled geometry but display scaled panels

Recommendation: before minimization/smart fill, decide whether scale changes layout coordinate space or only visual zoom. Prefer wrapping the canvas content in a scaled layer with transformed coordinate mapping, or keep geometry unscaled and avoid per-panel transform.

### Transformed Panels vs Pointer Coordinates

Pointer deltas use raw `event.clientX/Y`. With transformed panels, visual movement and persisted geometry may diverge from pointer movement.

At scale 1.35, a 135px visible drag may persist as roughly 100px expected visual movement, depending on transform behavior. At scale 0.75, the reverse can happen.

Recommendation: pointer deltas must be divided by scale if the coordinate system remains unscaled.

### Persistence Of Scaled Geometry

Current persisted geometry is unscaled, which is correct if geometry represents logical canvas units. But transform makes displayed size scaled. This needs to be explicit before smart fill.

Recommendation: persist logical geometry only. Treat scale as viewport/canvas zoom and keep smart fill operating in logical grid units.

### Off-Grid Repair

`normalizeGeometry` snaps to grid now, which is good. However, repair of old geometry can resize panels unexpectedly if existing values were close to grid boundaries.

Recommendation: record repair warnings for snapped geometry if diagnostics matter. Not urgent.

### Viewport Overflow

Canvas has `min-height: 760px` and `overflow: auto`, but smart fill needs actual available dimensions. Hard-coded height will be wrong for small screens or shell chrome changes.

Recommendation: smart fill should measure canvas viewport and reserve shell/tab/action chrome explicitly.

### Panel Menu Overflow

Panel menu has max height and overflow. Good. However it can still be hidden behind scaled or high z-index panels if z-index conventions drift.

Recommendation: reserve z-index ranges: shell/menu > panels > canvas.

### Theme / Light-Mode Cascade Issues

Theme tokens are more distinct now, but mode/preset composition is verbose and easy to regress. System light mode duplicates light preset rules.

Recommendation: if presets grow, move token data into a typed theme matrix or rigorously test CSS selectors.

### localStorage Migration From Old Preference Shapes

Current preference normalization repairs missing fields, including `panelMenu`. Good. But schema version remains `1` despite preference shape changes.

Risk:

- older documents are silently migrated without `schemaVersion` signal
- future incompatible panel display/minimize fields will be harder to distinguish

Recommendation: bump workspace schema when adding minimized/display state or smart-fill metadata persistence.

### dist Tracking Problem

`dist` is tracked. Every build changes hashed assets and produces noisy diffs/deleted old assets.

Recommendation: decide whether `dist` belongs in the repo. For normal Vite app development, it should usually be ignored.

### Panel Menu Hiding Core / Settings

Panel menu arrangement can hide the Core module, which hides Settings from the menu. Existing Settings panels remain usable, but a user could close Settings and then have no menu path back.

Recommendation: either prevent hiding Core, always expose Settings separately, or provide a reset/preferences fallback outside the Panels menu.

### Focus Order Runaway

`focusPanel` assigns max + 1 on every click. Repeated clicking can grow values indefinitely.

Recommendation: compact focus order when it crosses a threshold or after each close/smart-fill operation.

### Repeated localStorage Writes During Drag

Drag pointermove calls `updatePanelGeometry`, which updates workspace state. The `useEffect` persistence saves on every workspace change, so localStorage can be written many times per second.

Recommendation: split preview geometry from committed geometry. Persist on pointerup/commit, not every pointermove.

### Missing Module Behavior

Missing panel behavior exists in persistence, but after dynamic modules arrive, unavailable modules need clearer UX:

- module unavailable
- panel definition unavailable
- version mismatch
- state migration failed

Recommendation: keep missing panels visible and restorable. Do not silently delete.

## Dangerous Implementation Traps

- Implementing minimize as close plus saved panel template. That loses instance identity and dirty state.
- Storing minimized state inside `panelState`. That makes framework layout behavior panel-owned.
- Letting hidden/minimized panels keep active subscriptions by default.
- Smart fill that ignores panel role and minimum useful size.
- Smart fill that mutates minimized panels into normal geometry.
- Smart fill that writes geometry while reading transformed/scaled DOM sizes inconsistently.
- Using CSS transform scale without correcting pointer deltas.
- Adding a preflight/dirty modal per panel instead of a core lifecycle coordinator.
- Hiding Settings with no independent recovery route.
- Adding GTI panels before lifecycle, scale, focus, and persistence issues are resolved.

## Recommended Implementation Order

### Must Fix Before Minimization

1. Add explicit `PanelInstance.display` or equivalent framework display state.
2. Add lifecycle coordinator for close/minimize/restore.
3. Add dirty-state reporting and dirty close handling.
4. Define mounted vs dormant behavior in `PanelCapabilities`.
5. Add minimized strip/dock location and deterministic ordering.
6. Add schema migration for new panel display fields.
7. Provide a Settings recovery route if Core module can be hidden.

### Must Fix Before Smart Fill

1. Resolve workspace scale coordinate model.
2. Stop persisting drag preview updates.
3. Add panel layout metadata to `PanelDefinition`.
4. Add canvas measurement abstraction.
5. Add grid-aware layout engine entry point for smart fill.
6. Add focus-order compaction.
7. Decide how minimized panels reserve or do not reserve space.
8. Bump schema if smart-fill needs persisted layout mode/state.

### Can Wait

- Full docking/split tree.
- Drag-and-drop panel menu arrangement.
- Undo stack for smart fill.
- Per-module panel sort.
- Advanced temporal synchronization.
- Real preflight modal UX.
- GTI domain panels.
- Dynamic remote module loading.

## What Not To Implement Yet

- No GTI implementation.
- No new domain modules.
- No full docking system.
- No smart fill until layout metadata exists.
- No minimization until lifecycle/dirty semantics are enforced.
- No runtime truth persistence in `panelState`.
- No LLM/advisory execution.
- No heavy state-management library.
- No silent deletion of missing panels.

## Verification Notes

This investigation changed only documentation.

Requested verification commands:

- `npm run typecheck`
- `npm run build`
- `git status --short`

External source projects to verify:

- `/home/dretski/projects/spooty-hardened`
- `/opt/jarri/ui/workspace`
- `/home/dretski/projects/ChronoGit`

