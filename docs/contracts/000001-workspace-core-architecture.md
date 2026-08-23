# Workspace Core Architecture Contract

## Scope

This document defines the first architecture contract for Jarri Workspace Core. It is a contract, not an implementation plan for a specific app. React, Tauri, persistence providers, and domain modules may evolve, but the boundaries in this document should remain stable unless a later contract supersedes them.

Workspace Core exists to provide a reusable workspace substrate:

- shell
- tabs
- panel canvas
- panel registry
- layout state
- dirty-state coordination
- domain/module registration
- doctrine primitives for truth, advisory output, preflight, and temporal replay

Workspace Core must not own domain truth. Domain services own runtime truth. Workspace Core owns presentation state and user layout preference.

## Doctrine

The core rules are:

- Panels are projections.
- Runtime truth belongs to domain services.
- Layout is user preference.
- Persisted workspace state must be versioned and repairable.
- LLM output is advisory, not truth.
- Truth must be visible before action.
- Risky mutation must pass through preflight.
- Temporal/replay surfaces are reusable primitives, not Git-only concepts.

## Architectural Layers

### Workspace Core

Workspace Core owns generic workspace behavior:

- workspace state model
- tab management
- panel instance lifecycle
- panel registry and domain registration
- panel geometry, focus order, and layout persistence
- dirty-state and close/save coordination
- standard primitive contracts
- migration and repair rules for persisted state

Workspace Core may ship standard panels such as Browser, Editor, Audit, Log, Truth Strip, Preflight, and Timeline, but those panels must still consume truth through service contracts instead of embedding domain state in layout state.

### Domain Modules

Domain modules own runtime truth and actions for a specific subject area, such as Git, Observatory, Spooty, GTI, or system control.

A domain module may register:

- panel definitions
- commands/actions
- truth providers
- advisory providers
- preflight providers
- temporal/replay providers
- default workspace presets
- migrations for its own panel state

A domain module must not mutate Workspace Core internals directly.

### Domain Services

Domain services are the source of runtime truth. They may be local Tauri commands, HTTP APIs, filesystem-backed services, process monitors, or in-memory adapters for tests.

Domain services return truth snapshots and action results. They do not persist panel geometry or tab layout.

## Core State Model

The canonical state objects are `WorkspaceState`, `WorkspaceTab`, and `PanelInstance`.

```ts
type WorkspaceState = {
  schemaVersion: number;
  workspaceId: string;
  activeTabId: string | null;
  tabs: WorkspaceTab[];
  preferences: WorkspacePreferences;
  registryVersion?: string;
};

type WorkspacePreferences = {
  scale: number;
  fontSize: number;
  showGrid: boolean;
  gridSize: number;
  panelSpacing: number;
  workspaceZoomIncrement: number;
  workspaceZoomAnchorMode:
    | "viewport-center"
    | "active-panel-center"
    | "active-panel-top-left"
    | "pointer";
  panelNavigationAlignment:
    | "panel-center"
    | "panel-top-left";
  systemSurfacePositions: WorkspaceSystemSurfacePositions;
  clock: WorkspaceClockPreferences;
  density: "compact" | "comfortable";
  themeMode: "system" | "light" | "dark";
  fontFamily: "system" | "humanist" | "serif" | "mono" | "compact";
  themePreset:
    | "neutral"
    | "graphite"
    | "contrast"
    | "blueprint"
    | "pink-sparkle";
  colorOverrides: Partial<WorkspaceColorTokens>;
  panelMenu: PanelMenuPreferences;
  frameControls: WorkspaceFrameControlPreferences;
  panelViews: WorkspacePanelViewPreferences;
};

type WorkspaceColorTokens = {
  page: string;
  canvas: string;
  panel: string;
  panelHeader: string;
  text: string;
  muted: string;
  border: string;
  button: string;
  control: string;
  menu: string;
};

type WorkspaceTab = {
  id: string;
  title: string;
  canvasBounds: WorkspaceCanvasBounds;
  canvasScale: number;
  panels: PanelInstance[];
  createdAt: string;
  updatedAt: string;
};

type WorkspaceCanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PanelInstance = {
  id: string;
  moduleId: string;
  panelType: string;
  title: string;
  geometry: PanelGeometry;
  focusOrder: number;
  stateVersion: number;
  panelState: unknown;
  dirty?: DirtyStateSnapshot;
  createdAt: string;
  updatedAt: string;
};

type PanelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};
```

Field rules:

- `schemaVersion` is the Workspace Core layout schema version.
- `workspaceId` identifies the persisted workspace profile.
- `activeTabId` must either reference an existing tab or be repaired to the first tab.
- `tabs` must never be persisted as an empty array after repair.
- `preferences` are user preferences, not runtime truth.
- `preferences.scale` is the global Workspace presentation scale currently
  consumed by shell/canvas rendering.
- `preferences.gridSize`, `preferences.workspaceZoomIncrement`,
  `preferences.workspaceZoomAnchorMode`, and
  `preferences.panelNavigationAlignment` are persisted camera/navigation
  preferences. They are schema-owned but not yet consumed by runtime behavior.
- `WorkspaceTab.canvasBounds` is the tab-local logical canvas extent. It is
  origin-aware and uses `{ x, y, width, height }`.
- `WorkspaceTab.canvasScale` is tab-local camera scale and defaults to `1`.
- `moduleId` and `panelType` resolve a panel through the registry.
- `panelState` is panel-local presentation state only.
- `focusOrder` controls z-order/focus ordering without relying on array order.
- `dirty` is a snapshot used by the shell to coordinate close/save/discard prompts.

Canvas-bound rules:

- Negative `WorkspaceCanvasBounds.x` and `WorkspaceCanvasBounds.y` are valid
  logical canvas origins.
- Panel geometry remains nonnegative in the current freeform panel model.
- Runtime ctrl-wheel zoom, panning, navigation alignment, and Settings exposure
  for the new camera preferences are deferred to later phases.

## Panel Registry

The panel registry is the extension point between Workspace Core and modules.

```ts
type PanelDefinition = {
  moduleId: string;
  panelType: string;
  title: string;
  description: string;
  defaultGeometry: PanelGeometry;
  minGeometry: Pick<PanelGeometry, "width" | "height">;
  stateVersion: number;
  capabilities: PanelCapabilities;
  createInitialState: (context: PanelCreateContext) => unknown;
  normalizeState: (input: unknown, context: PanelNormalizeContext) => PanelNormalizeResult;
};

type PanelRegistry = {
  registerModule(module: WorkspaceModuleDefinition): void;
  registerPanel(definition: PanelDefinition): void;
  getPanel(moduleId: string, panelType: string): PanelDefinition | null;
  listPanels(filter?: PanelRegistryFilter): PanelDefinition[];
};
```

Registry rules:

- `moduleId + panelType` is the stable identity of a panel definition.
- Registrations must be deterministic.
- Duplicate registrations are errors unless a test registry explicitly allows replacement.
- Unknown panel instances are repaired to an inert "missing panel" projection, not deleted silently.
- Panel definitions declare state normalization so layout repair can happen without rendering the panel.

## Module Registration

```ts
type WorkspaceModuleDefinition = {
  moduleId: string;
  title: string;
  version: string;
  panels: PanelDefinition[];
  truthProviders?: TruthProviderDefinition[];
  advisoryProviders?: AdvisoryProviderDefinition[];
  preflightProviders?: PreflightProviderDefinition[];
  temporalProviders?: TemporalProviderDefinition[];
  defaultTabs?: WorkspaceTabPreset[];
};
```

Module rules:

- Modules may register panels and service adapters.
- Modules may provide default tab presets, but presets must compile to normal `WorkspaceTab` and `PanelInstance` objects.
- Modules must not store runtime truth in `WorkspaceState`.
- Modules must expose migrations for panel-local persisted state when state shape changes.
- Module registration must be complete before persisted layout repair runs.

## Truth And Advisory Separation

Truth is canonical domain state from domain services. Advisory output is interpretation, explanation, annotation, or model output.

Truth examples:

- Git status, branch, remote divergence, changed files.
- Observatory index values from a data service.
- Archive file listing from a filesystem service.
- System process health from a runtime service.

Advisory examples:

- LLM explanation of a diff.
- Human-readable risk labels derived for display.
- Suggested next action.
- Narrative summaries.

Rules:

- Advisory output must never overwrite truth.
- Advisory panels must identify source, timestamp, model/tool if applicable, and input context.
- Actions must operate on fresh truth or a validated truth snapshot, not on advisory summaries.
- A panel may display truth and advisory output together, but it must preserve the distinction in data contracts.

## Preflight Doctrine

Preflight is required before actions that can destroy data, rewrite history, publish changes, sync remote state, perform irreversible repair, or materially alter canonical domain truth.

A preflight contract must include:

- action identity
- current truth snapshot or truth snapshot reference
- proposed operation
- affected resources
- risk classification
- reversible/irreversible flag
- required confirmation mode
- expected result
- failure modes

Preflight must be domain-provided and core-mediated. Workspace Core shows the preflight and enforces the required confirmation flow; the domain service performs the action.

## Temporal / Replay Boundary

Workspace Core defines generic temporal primitives, but domain modules provide temporal truth.

Core owns:

- timeline selection state
- temporal panel frame and controls
- comparison UI contracts
- replay cursor contracts
- selected range contracts
- restore/preflight bridge

Domains own:

- event history
- commit history
- file lineage
- metric samples
- archive versions
- replay semantics
- restore execution

Temporal panels must be able to answer:

- what happened
- when it happened
- what changed
- what can be compared
- what can be restored or replayed
- what preflight is required before restoration

## Component Boundaries

Workspace Core components should follow these ownership boundaries:

- Shell: global status, module actions, preferences, tabs, command entry points.
- TabBar: tab create/select/rename/close.
- Canvas: panel placement surface and add-panel entry point.
- PanelFrame: chrome, focus, drag, resize, close, dirty coordination, toolbar slots.
- PanelBody: domain or standard panel rendering.
- Registry: panel discovery and construction metadata.
- Persistence: serialize, migrate, repair, and store layout state.
- Domain Adapter: truth/action/preflight/temporal service calls.

No component should own both long-lived domain truth and layout persistence.

## Initial Non-Goals

- No React scaffold in this contract.
- No package installation.
- No full docking tree model.
- No domain-specific GTI implementation.
- No direct copying from source projects.
- No global store decision beyond the state contracts.

## Challenge Notes

- Freeform panels are enough for v1, but the contract should not block future dock/split layouts.
- `panelState: unknown` is intentional at the core level; typed panel state belongs to panel definitions and module packages.
- A generic "missing panel" repair path is mandatory because modules may be unavailable when loading old layouts.
- Preflight must not be reduced to a confirm dialog. It is a domain truth review boundary.
