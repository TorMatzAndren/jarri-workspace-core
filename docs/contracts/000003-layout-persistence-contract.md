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
- `workspace` contains tabs, panels, preferences, and panel-local projection state.
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

Version changes are not required when:

- visual styling changes.
- new panel definitions are added.
- domain service response shapes change outside persisted panel state.
- non-persisted runtime behavior changes.

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
7. Normalize tabs.
8. Normalize panel instances.
9. Normalize panel state through registered panel definitions.
10. Repair active tab and focus order.
11. Emit repair warnings.
12. Save repaired document if repair changed persisted state.

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
