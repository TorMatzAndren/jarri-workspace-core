# Devlog 000006 — Camera State Foundation

Date: 2026-08-23

## Purpose

Workspace Core now has the persisted state foundation for tab-local camera
work.

This checkpoint records the data contracts and normalization behavior only. It
does not advance runtime zoom, pan, navigation, or Settings behavior.

## Canvas Bounds

`WorkspaceCanvasBounds` is now origin-aware:

```ts
type WorkspaceCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Negative canvas origins are valid. This lets a tab's logical canvas grow left
or upward without pretending that the logical origin must always be zero.

Current panel geometry remains nonnegative after repair. The richer canvas
bounds contract therefore expands the canvas coordinate model without changing
the existing freeform panel geometry rules.

Legacy width/height-only canvas bounds normalize to the richer shape by adding
origin fields.

## Tab Camera State

`WorkspaceTab.canvasScale` now exists and defaults to `1`.

This is tab-local camera state. It is distinct from
`WorkspacePreferences.scale`, which remains the global Workspace presentation
scale currently used by rendering.

Restored tabs created from tab templates also start at `canvasScale: 1`.

## Camera Preferences

Workspace preferences now include persisted camera/navigation settings:

- `gridSize`
- `workspaceZoomIncrement`
- `workspaceZoomAnchorMode`
- `panelNavigationAlignment`

These fields are normalized and saved as Core layout preference. They are not
yet consumed by runtime behavior.

Ctrl+wheel zoom, pan behavior, panel navigation alignment, and Settings
exposure for these preferences remain deferred to later phases.

## Persistence Compatibility

The Core layout schema remains schema `2`.

Old schema-2 Core layouts that lack the camera foundation fields normalize
additively:

- missing `canvasScale` becomes `1`;
- missing camera preferences receive deterministic defaults;
- width/height-only canvas bounds become origin-aware;
- malformed camera values repair to supported defaults or clamps.

This additive repair does not require a schema bump.

The Core browser storage namespace remains:

    jarri.workspace.core.layout.v1

## Tab Template Compatibility

Tab-template documents remain:

    kind: jarri.workspace.tabs
    schemaVersion: 1

The richer template `canvasBounds` shape is additive within schema `1`.

Templates preserve normalized canvas bounds and panel geometry. They do not
persist the source tab's current camera scale into restored tabs.

The tab-template storage namespace remains:

    jarri.workspace.core.tabTemplates.v1

## Deferred Runtime Work

This checkpoint does not implement:

- ctrl-wheel zoom behavior;
- persisted pan or viewport-camera runtime behavior;
- navigation behavior that consumes `panelNavigationAlignment`;
- runtime use of `workspaceZoomAnchorMode`;
- Settings controls for the camera preferences;
- any Lab-to-Core runtime behavior promotion beyond the state foundation.

## Verification

Before commit, verify:

- `npx tsx src/core/layoutPersistence.test.ts`;
- `npx tsx src/core/tabTemplates.test.ts`;
- `npx tsx src/core/workspaceController.test.ts`;
- `npm run typecheck`;
- `npm run build`;
- `git diff --check`.
