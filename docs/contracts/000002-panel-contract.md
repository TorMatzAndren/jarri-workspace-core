# Panel Contract

## Scope

This document defines how panels are registered, instantiated, rendered, focused, updated, marked dirty, closed, and removed in Jarri Workspace Core.

Panels are projections over domain truth. A panel may cache presentation state, but canonical runtime truth belongs to domain services.

## Terms

- Panel Definition: registry metadata and lifecycle hooks for one panel type.
- Panel Instance: one user-created panel in one tab.
- Panel State: persisted presentation state for a panel instance.
- Panel Frame: Workspace-owned chrome and isolation boundary around a panel body.
- Panel Body: module-owned rendered content inside a frame.
- Semantic Projection: runtime-only document describing the panel's current meaningful content for Workspace capabilities.
- Frame Capability: Workspace-owned action exposed in frame chrome, such as whole-panel Copy or font scaling.
- Runtime Truth: canonical state fetched from a domain service.
- Advisory Output: interpretation or model-generated content that must not be treated as truth.
- Dirty State: panel-held unsaved local changes requiring save/discard/cancel before close.

## Panel Instance Contract

```ts
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

type DirtyStateSnapshot = {
  isDirty: boolean;
  reason?: string;
  resourceLabel?: string;
  resourceUri?: string;
  canSave: boolean;
  canDiscard: boolean;
};
```

Panel instance rules:

- `id` is unique within a workspace.
- `moduleId + panelType` resolves to exactly one `PanelDefinition`.
- `title` may be user-facing and editable if the definition allows it.
- `geometry` is layout preference only.
- `focusOrder` is the canonical focus/z-order value.
- `stateVersion` is the definition-specific panel state version.
- `panelState` must not contain canonical runtime truth.
- `dirty` must be present or queryable when unsaved local changes exist.
- Semantic projection documents, publication leases, frame-control payloads, and clipboard text must never be stored on a `PanelInstance`.

## Panel Definition Contract

```ts
type PanelDefinition = {
  moduleId: string;
  panelType: string;
  title: string;
  description: string;
  category: "core" | "domain" | "observability" | "temporal" | "advisory";
  defaultGeometry: PanelGeometry;
  minGeometry: {
    width: number;
    height: number;
  };
  stateVersion: number;
  capabilities: PanelCapabilities;
  createInitialState: (context: PanelCreateContext) => unknown;
  normalizeState: (input: unknown, context: PanelNormalizeContext) => PanelNormalizeResult;
  semanticStrategy: PanelSemanticStrategy;
  surfacePresentationMemory?: PanelSurfacePresentationMemoryPolicy;
  lifecycle?: PanelLifecycleHooks;
};

type PanelSemanticStrategy =
  | { kind: "static"; buildInitial: (context: PanelSemanticContext) => WorkspaceProjectionDocument }
  | { kind: "dynamic"; buildInitial: (context: PanelSemanticContext) => WorkspaceProjectionDocument }
  | { kind: "unavailable"; buildInitial: (context: PanelSemanticContext) => WorkspaceProjectionDocument }
  | { kind: "pending"; reason: string };

type PanelCapabilities = {
  closable: boolean;
  resizable: boolean;
  movable: boolean;
  renameable: boolean;
  canBeDirty: boolean;
  usesTruthProvider?: string;
  usesAdvisoryProvider?: string;
  usesPreflightProvider?: string;
  usesTemporalProvider?: string;
};

type PanelNormalizeResult = {
  state: unknown;
  repaired: boolean;
  warnings: string[];
};
```

Definition rules:

- Definitions are domain-neutral at the core boundary.
- Definitions must provide deterministic initial state.
- Definitions must normalize old or malformed panel state.
- Definitions must declare whether dirty state is possible.
- Definitions must declare provider dependencies by stable provider ID.
- Definitions must not perform destructive work in creation or normalization hooks.
- Definitions must declare an explicit semantic strategy.
- Definitions may opt into Workspace-owned surface presentation memory.
- Surface presentation memory is keyed by stable panel type identity, not by one live panel instance.
- Opted-in presentation memory may preserve geometry after the live instance is closed.
- Presentation memory must contain only presentation state and must never become canonical runtime or domain truth.
- `static`, `dynamic`, `unavailable`, and `pending` semantic states are distinct.
- `pending` means semantic migration is incomplete and cannot emit placeholder projection content.
- `unavailable` is a truthful content state with reason and recovery, not an incomplete migration marker.

## Frame, Body, Projection, And Capability Boundary

Workspace Core renders normal panels through one synchronous `PanelFrame`.

Ownership rules:

- The frame owns title chrome, focus, movement, resize, minimize/restore, close controls, body loading boundary, body failure boundary, whole-panel semantic Copy, clipboard transport, frame-control feedback, and panel font scaling.
- The panel body owns substantive content, local interaction, panel-local presentation state, domain reads, and semantic projection meaning.
- Semantic projection is the runtime document consumed by Workspace-owned frame capabilities. It is not the DOM and it is not persisted panel state.
- Frame capabilities are generic Workspace controls. Panels may publish runtime payloads for a control, but panels do not own the Workspace catalog, labels, visibility preferences, transport, or feedback.

Copy rules:

- Whole-panel Copy consumes the current semantic projection through the frame-owned publication controller.
- Copy must not scrape DOM text.
- Copy must not fall back to raw `panelState`, provider JSON, or generic text extraction.
- The frame formats the common `Workspace Projection` envelope.
- Panel bodies publish only semantic content.

Dynamic publication rules:

- `PanelFrame` creates one semantic publication controller per panel identity.
- Dynamic bodies publish through `PanelBodyProps.semanticPublisher`.
- `publish(exporter)` returns a lease.
- `lease.release()` clears only the publication owned by that lease.
- Stale releases cannot clear newer publications.
- Duplicate panel instances have independent publication controllers.
- Body render failures publish a safe error projection for that frame only.
- Released or absent dynamic publications fall back to the definition's initial semantic document.

Frame-control rules:

- Workspace owns the frame-control catalog and stable control IDs.
- Current generic controls are `semantic-copy`, `font-decrease`, and `font-increase`.
- Frame-control visibility preferences are keyed by `moduleId:panelType:controlId`.
- Font scaling is Workspace presentation state keyed by panel type, not document/editor/domain state.
- Runtime frame-control payloads are per panel instance and are never persisted.

## Panel Registry Contract

```ts
type PanelRegistry = {
  registerPanel(definition: PanelDefinition): void;
  unregisterPanel?(moduleId: string, panelType: string): void;
  getPanel(moduleId: string, panelType: string): PanelDefinition | null;
  listPanels(): PanelDefinition[];
  hasPanel(moduleId: string, panelType: string): boolean;
};
```

Registry rules:

- Duplicate `moduleId + panelType` registrations are errors.
- A panel definition must be registered before instances are created.
- Persisted instances may reference missing definitions; these are repaired into missing-panel projections.
- The registry is the only supported path for module panels to enter Workspace Core.

## Lifecycle

The panel lifecycle is:

1. Registered
2. Created
3. Mounted
4. Focused
5. Updated
6. Dirty or clean
7. Preflighted when needed
8. Closed or removed
9. Unmounted

```ts
type PanelLifecycleHooks = {
  onCreate?: (context: PanelCreateContext) => unknown;
  onMount?: (context: PanelRuntimeContext) => void | Promise<void>;
  onFocus?: (context: PanelRuntimeContext) => void;
  onBlur?: (context: PanelRuntimeContext) => void;
  onBeforeClose?: (context: PanelRuntimeContext) => BeforeCloseResult | Promise<BeforeCloseResult>;
  onSave?: (context: PanelRuntimeContext) => SaveResult | Promise<SaveResult>;
  onDiscard?: (context: PanelRuntimeContext) => DiscardResult | Promise<DiscardResult>;
  onUnmount?: (context: PanelRuntimeContext) => void;
};
```

Lifecycle rules:

- Creation produces a `PanelInstance` and initial `panelState`.
- Mounting may subscribe to truth providers, but truth data is not written into `WorkspaceState`.
- Focusing updates `focusOrder`.
- Geometry updates are layout updates only.
- Panel state updates must be local presentation state.
- Dirty panels must block close until saved, discarded, or cancelled.
- Removing a panel deletes the live panel instance and its instance-local state, not domain truth.
- Removing an instance does not erase opted-in Workspace-owned surface presentation memory.
- Recreating an opted-in panel may restore remembered presentation independently of the lifetime of the previous instance.

## Panel Creation And Presentation Memory

Panel creation separates live instance lifetime from remembered Workspace
presentation.

For panel definitions that opt into surface presentation memory, Workspace Core
may remember presentation geometry under the stable panel surface identity
derived from `moduleId + panelType`.

Geometry ownership during creation is deterministic:

1. Valid remembered geometry owns an ordinary reopen.
2. Without remembered geometry, an explicit invocation position owns the
   first summon position.
3. Without either, the normal deterministic placement engine owns placement.

Explicit preferred width or height participates in initial sizing where the
creation path permits it. Normal automatic placement may also use source-panel
causality and configured panel spacing.

Remembered geometry remains subject to the normal geometry normalization
contract. It is presentation preference, not a surviving panel instance and
not runtime/domain truth.

## Dirty-State Handling

Panels that can be dirty must expose a dirty snapshot and close handling.

Dirty examples:

- unsaved text editor content
- unsaved note content
- staged local draft for a generated document
- unsaved panel-local configuration

Dirty state is not:

- a changed Git worktree
- a remote divergence
- a failing service
- an LLM response still streaming

Close flow:

1. User requests close.
2. Workspace Core asks the panel for `DirtyStateSnapshot`.
3. If not dirty, close proceeds.
4. If dirty, shell presents save/discard/cancel options allowed by the snapshot.
5. Save calls the panel/domain save hook.
6. Discard calls the panel discard hook.
7. Cancel keeps the panel open and focused.

Rules:

- Dirty state must be explicit, not inferred from arbitrary panel data.
- Save/discard operations that mutate canonical domain truth may require preflight.
- Closing a panel must never silently discard dirty content.
- Dirty state must survive layout persistence when practical.

## Truth Panel Pattern

A truth panel displays canonical runtime state from a domain service.

Truth panel rules:

- Fetch or subscribe through a truth provider.
- Show timestamp/source for truth snapshots when relevant.
- Avoid persisting truth snapshots in layout state.
- Expose refresh and error states.
- Display advisory annotations separately.

Examples:

- Git current state.
- Observatory index truth.
- Archive browser listing.
- System health.

## Advisory Panel Pattern

An advisory panel displays explanations, suggestions, logs, or model output.

Advisory panel rules:

- Label source and timestamp.
- Preserve input context when needed for auditability.
- Never make advisory output the action authority.
- Avoid automatic mutation based only on advisory output.
- Support clearing/exporting advisory logs as panel or domain behavior.

Examples:

- LLM diff explanation.
- Suggested next step.
- Human-readable risk explanation.
- Session notes.

## Preflight Panel Pattern

A preflight panel reviews a proposed action before execution.

Required fields:

```ts
type PreflightRequest = {
  id: string;
  moduleId: string;
  actionType: string;
  title: string;
  truthSnapshotRef?: string;
  affectedResources: AffectedResource[];
  risk: "low" | "medium" | "high" | "critical";
  reversible: boolean;
  confirmationMode: "none" | "click" | "typed-token";
  summary: string;
  expectedResult: string;
  failureModes: string[];
};
```

Preflight rules:

- Destructive, publishing, syncing, restore, repair, and history-changing actions require preflight.
- Preflight must be generated from current domain truth or a validated truth snapshot.
- Execution must verify the preflight request is still valid or intentionally stale-tolerant.
- Typed-token confirmation is required for critical or irreversible operations.

## Temporal / Replay Panel Pattern

Temporal panels project history, replay, lineage, or comparison.

Temporal panel rules:

- Timeline state is presentation state.
- Event/history truth comes from temporal providers.
- Selection, range, comparison target, and replay cursor may be persisted as panel state.
- Restore/replay actions that mutate truth require preflight.
- Diff or comparison views must identify left/right sources clearly.

Generic temporal concepts:

- `TimelineEntry`
- `TemporalSelection`
- `TemporalRange`
- `ComparisonRequest`
- `ReplayCursor`
- `RestoreCandidate`

## Panel Boundaries

Panel bodies may:

- render truth snapshots
- render advisory output
- request refreshes
- request preflights
- update panel-local state
- update dirty state
- request layout actions through Workspace Core

Panel bodies must not:

- directly mutate tabs outside core APIs
- directly write persisted layout blobs
- treat advisory output as truth
- perform risky domain mutation without preflight
- hide canonical source state behind generated summaries

## Missing Panel Behavior

When a persisted panel references an unavailable definition:

- Workspace Core creates a missing-panel projection.
- Original `moduleId`, `panelType`, title, geometry, and panel state are preserved.
- The panel explains that the module or panel definition is unavailable.
- The user may close the panel.
- If the module becomes available later, repair may restore the original definition.

## Challenge Notes

- Dirty state belongs in this contract because close behavior is shell-level, even when save behavior is domain-specific.
- Panel-local state must remain narrow. A panel that wants to persist domain truth should instead define a domain storage contract.
- Missing panels should be visible rather than silently removed; silent removal breaks user trust in layout persistence.
