# Layout Persistence Contract

## Scope

This document defines how Jarri Workspace Core persists, loads, migrates, repairs, and validates workspace layout state.

Layout persistence stores user preference and panel projection state. It does not store canonical runtime truth.

Semantic projection documents, publication leases, frame-control runtime payloads,
and clipboard text are runtime-only. Layout persistence may store frame-control
visibility preferences and panel-view presentation preferences such as font
scale, but not the semantic content those controls consume.

## Persistence Doctrine

- Persisted layout is user preference.
- Runtime truth belongs to domain services.
- Persisted state must be versioned.
- Invalid persisted state must be repaired or rejected predictably.
- Unknown panels must survive as missing-panel projections.
- Advisory output may be persisted only as advisory log/panel state, never as truth.

## Persisted Document Shape

```ts
type PersistedWorkspaceDocument = {
  kind: "jarri.workspace.layout";
  schemaVersion: number;
  savedAt: string;
  workspace: WorkspaceState;
  modules: PersistedModuleRecord[];
};

type PersistedModuleRecord = {
  moduleId: string;
  version: string;
  registeredPanelTypes: string[];
};
```

Rules:

- `kind` must match exactly.
- `schemaVersion` controls Workspace Core migrations.
- `savedAt` is metadata only.
- `workspace` contains tabs, panels, preferences, panel-local projection state, and Workspace-owned surface presentation memory.
- `workspace.tabs[].canvasBounds` is persisted as `{ x, y, width, height }`.
- `workspace.tabs[].canvasScale` is persisted separately from global
  `workspace.preferences.scale`.
- `workspace.surfacePresentationMemory` stores opted-in presentation memory independently of live panel instances.
- Panel surface presentation memory uses stable panel-type identity derived from `moduleId + panelType`.
- `workspace.preferences.frameControls` stores frame-control visibility by stable panel-type/control key.
- `workspace.preferences.panelViews` stores Workspace-owned presentation preferences by stable panel-type key.
- `modules` records what was known when the layout was saved.

## Storage Providers

The persistence contract must support multiple storage providers.

```ts
type LayoutStorageProvider = {
  load(workspaceId: string): Promise<PersistedWorkspaceDocument | null>;
  save(workspaceId: string, document: PersistedWorkspaceDocument): Promise<void>;
  backup?(workspaceId: string, document: PersistedWorkspaceDocument): Promise<void>;
};
```

Initial acceptable providers:

- browser `localStorage`
- Tauri-backed JSON file
- in-memory test provider

Provider rules:

- Provider failure must not corrupt current in-memory state.
- Save should be debounced by the implementation, but the contract only requires eventual persistence after state changes.
- Backup is recommended before major migrations or destructive repair.
- The browser storage namespace remains `jarri.workspace.core.layout.v1`.

## Workspace Schema Versioning

Workspace Core owns `schemaVersion`.

Version changes are required when:

- `WorkspaceState` shape changes incompatibly.
- `WorkspaceTab` shape changes incompatibly.
- `PanelInstance` shape changes incompatibly.
- geometry model changes.
- dirty-state persistence changes.
- registry identity rules change.

Adding backward-compatible preference surfaces with deterministic defaults does
not require changing the public application version.

Additive repair inside the current Workspace schema is allowed when old
documents omit newly optional fields that have deterministic defaults. Current
schema-2 Core layouts without tab-local camera fields or camera preferences
normalize additively to include them without a schema bump.

Version changes are not required when:

- visual styling changes.
- new panel definitions are added.
- domain service response shapes change outside persisted panel state.
- non-persisted runtime behavior changes.
- additive fields are normalized with deterministic defaults inside the current
  schema.

## Panel State Versioning

Each panel definition owns `stateVersion` for its own `panelState`.

Rules:

- Panel state migration belongs to the panel definition or module.
- Workspace Core calls `normalizeState` for every panel instance during load/repair.
- If a module is unavailable, Workspace Core preserves the raw panel state under the missing-panel projection.
- If a panel migration fails, the panel is repaired to a safe default and the warning is recorded.

## Load Pipeline

The load pipeline is:

1. Read persisted document from provider.
2. If no document exists, create default workspace.
3. Validate document envelope.
4. Run Workspace Core schema migrations.
5. Ensure module registry is loaded.
6. Normalize workspace preferences.
7. Normalize surface presentation memory.
8. Normalize tabs.
9. Normalize panel instances.
10. Normalize panel state through registered panel definitions.
11. Repair active tab and focus order.
12. Emit repair warnings.
13. Save repaired document if repair changed persisted state.

Load must never execute domain mutation.

## Migration Rules

Workspace migrations must be deterministic and side-effect free except for producing the migrated document.

Migration rules:

- Migrations run in ascending version order.
- Migrations should preserve unknown fields only when they are explicitly allowed extension fields.
- Migrations must not fetch runtime truth.
- Migrations must not call LLM/advisory providers.
- Migrations must not execute domain actions.
- Failed migrations fall back to default workspace only after preserving a backup when a backup provider exists.

## Repair Rules

Repair is distinct from migration. Migration changes old valid schemas to new schemas. Repair handles malformed or incomplete data.

Required repair behavior:

- Missing or invalid `WorkspaceState` -> default workspace.
- Missing or invalid `tabs` -> default tab.
- Empty `tabs` -> default tab.
- Invalid `activeTabId` -> first tab ID.
- Missing tab title -> generated title.
- Missing tab `canvasScale` -> `1`.
- Missing tab `canvasBounds.x`/`canvasBounds.y` -> origin-aware defaults.
- Legacy width/height-only tab canvas bounds -> origin-aware canvas bounds.
- Duplicate tab IDs -> stable regenerated IDs for duplicates.
- Missing panel ID -> generated panel ID.
- Duplicate panel IDs -> stable regenerated IDs for duplicates.
- Invalid geometry -> default geometry from panel definition or safe fallback.
- Width/height below minimum -> clamp to minimum.
- Negative x/y -> clamp to zero.
- Invalid focus order -> recompute sequential focus order.
- Unknown panel definition -> missing-panel projection.
- Invalid panel state -> panel definition normalizes or resets it.
- Invalid dirty snapshot -> clear dirty snapshot unless panel definition can repair it.
- Missing legacy `surfacePresentationMemory` -> normalize to empty presentation memory.
- Malformed surface presentation entries -> discard or repair deterministically.
- Invalid remembered geometry -> normalize through the same geometry rules used for panel geometry.
- Missing Workspace preference fields such as panel spacing or system-surface positions -> restore deterministic defaults.
- Missing camera preference fields such as `gridSize`,
  `workspaceZoomIncrement`, `workspaceZoomAnchorMode`, and
  `panelNavigationAlignment` -> restore deterministic defaults.

Repairs must be recorded as warnings for diagnostics.

## Geometry Contract

Persisted geometry is user preference.

```ts
type PanelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};
```

Geometry rules:

- Values are numbers in workspace canvas coordinates.
- `x` and `y` must be zero or positive after repair.
- `width` and `height` must be clamped to panel minimums.
- Layout engine may snap values before persistence.
- Future dock/split layout must either migrate this shape or add a new layout mode with explicit schema versioning.

## Canvas Bounds Contract

Persisted canvas bounds are tab-local logical canvas extents.

```ts
type WorkspaceCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

Canvas-bound rules:

- Values are numbers in workspace canvas coordinates.
- `x` and `y` may be negative. Negative canvas origins are valid.
- `width` and `height` must be repaired to safe minimum extents.
- Bounds must expand to contain current panel geometry plus the Workspace
  canvas margin.
- Legacy width/height-only bounds normalize by adding origin fields rather than
  by changing the storage namespace.
- Panel geometry remains nonnegative in the current freeform panel model even
  when the owning canvas has a negative origin.

## Camera Preferences

Workspace Core persists camera preference fields before runtime consumption:

- `gridSize`
- `workspaceZoomIncrement`
- `workspaceZoomAnchorMode`
- `panelNavigationAlignment`

These fields are distinct from `preferences.scale`. `preferences.scale` remains
the global presentation scale currently consumed by Workspace rendering.

Runtime ctrl-wheel zoom, canvas panning behavior, navigation alignment behavior,
and Settings UI exposure for the camera preferences are explicitly deferred.

## Tab Templates

Tab templates are stored under `jarri.workspace.core.tabTemplates.v1` and use:

```ts
type WorkspaceTabTemplateDocument = {
  kind: "jarri.workspace.tabs";
  schemaVersion: number;
  exportedAt: string;
  templates: SavedTabTemplate[];
};
```

Template schema remains version `1`.

The richer `SavedTabTemplate.canvasBounds` shape is additive inside that schema:
old width/height-only bounds normalize to `{ x, y, width, height }`.

Restored template tabs start with `canvasScale: 1` regardless of the source
tab's current scale. Template bounds and panel geometry are layout preference,
not runtime truth.

## Surface Presentation Memory

Surface presentation memory is Workspace-owned persisted presentation state
whose lifetime may extend beyond one live panel instance.

For panel surfaces, the stable memory identity is derived from the registered
`moduleId + panelType`. The memory may contain normalized geometry and, when
explicitly permitted by the panel definition, narrow panel/display
presentation state.

Rules:

- Presentation memory is opt-in through the panel definition.
- Remembered geometry is distinct from geometry on a currently instantiated
  `PanelInstance`.
- Closing a live panel may leave its opted-in presentation memory intact.
- Reopening may restore valid remembered geometry.
- Legacy layouts without presentation memory normalize to an empty memory map.
- Malformed or unsupported memory entries are repaired or discarded
  deterministically.
- Remembered geometry is normalized before use.
- Presentation memory must never contain canonical runtime/domain truth,
  semantic publication documents, runtime frame-control payloads, or mutation
  authority.

Panel creation geometry precedence is:

1. remembered geometry when valid and applicable;
2. explicit invocation position when there is no remembered geometry;
3. deterministic automatic placement otherwise.

This precedence preserves user presentation intent while keeping ordinary
first-summon placement causal and deterministic.

Workspace preferences also persist generic presentation configuration,
including appearance and placement preferences.

Persistent appearance preferences include theme mode, theme preset, semantic
colour overrides, font presentation, density, and related Workspace-level
display choices.

Persistent placement preferences include panel spacing and Settings/Add
Panel/Frame Settings surface positions.

Missing, malformed, or unsupported legacy preference fields receive
deterministic defaults during normalization.

## Focus Order Contract

`focusOrder` determines z-order.

Rules:

- Higher `focusOrder` means closer to front.
- Bringing a panel to front increments beyond the current maximum.
- Repair recomputes duplicate or invalid focus order.
- Array order must not be the only source of z-order truth.

## Dirty-State Persistence

Dirty state may be persisted as a snapshot, but content persistence is panel-specific.

Rules:

- Dirty snapshot must not be trusted as the only source of unsaved content.
- Panels that persist dirty drafts must define where the draft is stored.
- Closing dirty panels must still ask the panel for current dirty state at runtime.
- Invalid dirty snapshots are cleared during repair unless the panel can normalize them.

## Truth And Advisory Persistence

Runtime truth must not be stored in layout state.

Allowed in layout/panel state:

- selected item IDs
- expanded group IDs
- visible mode
- scroll/collapse preferences
- selected time range
- comparison target references
- advisory log entries if the panel is explicitly an advisory/log panel

Not allowed in layout/panel state:

- canonical Git status
- canonical remote state
- canonical metric values as source of truth
- canonical archive listings
- raw service state used for mutation authority
- LLM output presented as verified domain state

If a panel needs cached truth for performance, it must be marked as cache data and never used as mutation authority.

## Preflight Persistence

Preflight requests should generally be ephemeral.

Rules:

- Active preflight modal state may be restored only if the domain provider can revalidate it.
- Persisted preflight state must include action ID, domain, affected resources, and truth snapshot reference.
- Execution after reload requires revalidation.
- Critical preflight confirmations must not survive reload as already-confirmed.

## Temporal / Replay Persistence

Temporal panel state may persist:

- selected timeline entry ID
- selected range
- comparison left/right references
- replay cursor
- visible filters
- expanded lineage sections

Temporal panel state must not persist:

- canonical event history as the source of truth
- replay execution authority
- restore authority

Restore or replay mutations require fresh preflight after reload.

## Save Pipeline

The save pipeline is:

1. Accept in-memory `WorkspaceState`.
2. Strip non-persistable runtime handles.
3. Validate document envelope.
4. Normalize serializable shape.
5. Stamp `savedAt`.
6. Save through provider.
7. Report provider errors without mutating domain truth.

Save must not call domain mutation services.

## Diagnostics

Persistence should expose diagnostics:

```ts
type LayoutRepairReport = {
  migrated: boolean;
  repaired: boolean;
  fromSchemaVersion?: number;
  toSchemaVersion: number;
  warnings: string[];
};
```

Diagnostics are for logs and developer tools. They are advisory metadata, not domain truth.

## Challenge Notes

- `localStorage` is acceptable for a first implementation, but this contract keeps the provider swappable.
- Repair should prefer preserving user layout over strict rejection, except where persisted data is unsafe or incoherent.
- Missing modules are normal during development; layout persistence must degrade visibly and recover when modules return.
- Preflight confirmation state must be intentionally hard to persist because reload should not bypass risk review.

## Logical Camera Persistence

Workspace camera position is persisted per tab as logical coordinates:

    canvasCamera: { x, y }

`x/y` identify the logical Workspace coordinate at the viewport top-left.
Raw browser scroll offsets are not persisted as canonical camera truth.

Legacy/additive normalization rules:

- missing `canvasCamera` defaults to the normalized tab canvas origin;
- invalid/non-finite camera coordinates repair to the canvas origin;
- negative canvas origins are valid fallbacks;
- missing `canvasScale` defaults deterministically;
- missing camera/navigation preferences receive deterministic defaults;
- existing schema-2 layouts remain readable without an artificial schema
  break.

Multiple tabs retain independent camera positions and scales.
`preferences.scale` remains independent global interface presentation state.

Tabs created from reusable panel templates/setups begin from deterministic
camera state rather than inheriting an unrelated transient source-tab view.

During runtime restoration, logical camera state is converted to physical
scroll using current bounds, viewport dimensions, and `canvasScale`.
Programmatic restoration must not feed temporary scroll/clamping results
back into persisted camera truth.

## Appearance And Control Persistence Additions

`chronogit` is a valid persisted `themePreset` value.
Unknown theme preset values continue to normalize according to the existing
theme repair contract.

Workspace-owned control implementations do not change domain persistence:
`WorkspaceSelect` and `WorkspaceNumberInput` are presentation primitives.
Their owning preferences/state continue to persist through the existing
Workspace state model.
