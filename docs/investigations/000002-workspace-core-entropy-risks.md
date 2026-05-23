# Workspace Core Entropy Risks

## Scope

Investigation of architectural entropy risks in the current minimal Jarri Workspace Core scaffold.

This is not a feature plan and not a UI redesign. The goal is to identify where the current clean scaffold is likely to accumulate coupling as GTI, real domain modules, temporal data, and advisory/LLM surfaces are added.

Sources inspected:

- `src/shell/WorkspaceShell.tsx`
- `src/workspace/WorkspaceCanvas.tsx`
- `src/workspace/PanelFrame.tsx`
- `src/core/layoutPersistence.ts`
- `src/core/panelRegistry.ts`
- `src/core/types.ts`
- `src/panels/registry.ts`
- `src/panels/demoPanels.tsx`

Contract references:

- `docs/contracts/000001-workspace-core-architecture.md`
- `docs/contracts/000002-panel-contract.md`
- `docs/contracts/000003-layout-persistence-contract.md`

## Executive Findings

The scaffold is intentionally small and currently coherent. The main entropy risk is not current complexity; it is that the most convenient next edits all point toward `WorkspaceShell.tsx` and `layoutPersistence.ts`. If domain work starts by adding GTI actions, async truth fetching, preflight modals, event streams, and timeline sync directly to those files, Workspace Core will quickly become another product shell rather than a reusable substrate.

The highest-risk areas are:

- shell orchestration accumulation
- persistence depending on a global registry singleton
- geometry updates firing as whole-workspace state writes during drag
- panel lifecycle being mostly implicit
- no module-loading boundary beyond static imports
- no event/state propagation contract for truth, advisory output, preflight, or temporal cursors
- temporal demo state being local projection only, with no sync model for real replay timelines

The next architectural work should extract boundaries before adding GTI. Do not add domain behavior until shell commands, layout mutations, panel lifecycle, module registration, and event propagation have clear ownership.

## Current Shape

The app currently has a simple ownership chain:

- `WorkspaceShell` loads workspace state, saves state, mutates tabs, creates panels, closes panels, focuses panels, updates geometry, updates panel state, and renders shell controls.
- `TabBar` is presentational and delegates tab actions upward.
- `WorkspaceCanvas` is presentational and delegates panel actions upward.
- `PanelFrame` owns pointer tracking for move/resize and delegates geometry changes upward.
- `layoutPersistence` owns default workspace creation, localStorage loading/saving, normalization, repair, and registry lookup during repair.
- `registry` is a static singleton populated by direct imports from demo panels.
- Demo panels are static components and mutate only their own `panelState`.

This is a valid v0 scaffold. It becomes risky when domain modules and async workflows arrive.

## Shell Orchestration Accumulation

### Risk

`WorkspaceShell.tsx` is already the orchestration center for:

- loading workspace state
- saving workspace state
- tab lifecycle
- panel lifecycle
- panel creation
- panel focus order
- panel close
- geometry updates
- panel state updates
- shell actions
- registry panel listing
- reset behavior

This is acceptable at the current size, but it is the most likely entropy sink. Future additions will naturally try to add:

- command palette
- module loading
- truth refresh
- advisory logs
- preflight modals
- dirty-state prompts
- domain action routing
- temporal synchronization
- keyboard shortcuts
- layout import/export
- error toasts
- status strip truth

If these land in the shell directly, the shell will become both application controller and core framework.

### Failure Mode

Workspace Core becomes product-specific through incremental convenience. GTI behavior, Git behavior, Observatory behavior, and system-control behavior would all accumulate in shell conditionals and action handlers.

### Containment

Before adding GTI, introduce a `WorkspaceController` or equivalent state/action boundary. The shell should render and dispatch; it should not own all mutation logic.

Target split:

- Shell: render global UI and dispatch user intent.
- Workspace state controller: tab/panel/layout mutations.
- Command bus: route shell and panel commands.
- Module runtime: register panels/providers/actions.
- Persistence adapter: save/load layout state.
- Preflight coordinator: own risky action review flow.

## Panel Lifecycle Ownership

### Risk

The panel lifecycle contract exists in docs, but the implementation currently has only implicit lifecycle:

- create panel in `WorkspaceShell.addPanel`
- mount by React render
- focus through `onPointerDown`
- update through prop callbacks
- close by filtering from active tab

There is no explicit lifecycle hook path for:

- `onCreate`
- `onMount`
- `onFocus`
- `onBlur`
- `onBeforeClose`
- `onSave`
- `onDiscard`
- `onUnmount`

Dirty state is typed, but not operational.

### Failure Mode

As panels become real, each panel will invent its own lifecycle side effects. Some will subscribe in component effects, some will write state directly, some will block close locally, and some will need shell-level dialogs. Dirty close and preflight flows will become inconsistent.

### Containment

Implement lifecycle through a single panel runtime boundary before adding editable or domain-mutating panels.

Required boundary:

- Core creates panel instance through definition factory.
- Core asks definition/runtime before close.
- Core owns dirty close decisions.
- Panel body reports dirty state through a typed channel.
- Panel runtime owns subscriptions and cleanup.

Do not let panel bodies directly define shell modal behavior.

## Geometry Ownership

### Risk

`PanelFrame` owns pointer events, grid snapping, drag/resize state, and minimum-size lookup. `WorkspaceShell` owns the actual geometry write. `layoutPersistence` owns geometry repair. This splits geometry across three places.

Current drag behavior calls `onGeometryChange` on every pointer move. That updates React workspace state, triggers persistence effect, and can save to localStorage repeatedly during active drag.

### Failure Mode

When snap-to-sibling, canvas bounds, dock zones, keyboard movement, persisted viewport state, and responsive constraints are added, geometry logic will spread across frame, shell, persistence, and CSS. Temporal replay or panel animations would then compete with layout mutation.

### Containment

Create a dedicated layout engine boundary before advanced geometry:

- `beginPanelMove`
- `previewPanelGeometry`
- `commitPanelGeometry`
- `cancelPanelGeometry`
- `bringPanelToFront`
- `normalizeGeometry`
- `repairGeometry`

Persist committed geometry, not every drag preview. Keep transient drag state out of `WorkspaceState`.

## Persistence Coupling

### Risk

`layoutPersistence.ts` imports the concrete global `registry` from `src/panels/registry.ts`. This makes persistence depend on current static app modules.

It also owns:

- storage key
- default workspace
- module record creation
- registry lookup
- missing-panel repair
- panel state normalization
- localStorage provider

This is pragmatic for v0 but violates the future module-loading boundary.

### Failure Mode

Persistence will become hard to test and hard to reuse because loading old layouts will require the current UI registry singleton to be initialized first. Dynamic modules, optional modules, and versioned module packages will be awkward because persistence already imports the static registry.

### Containment

Invert persistence dependencies:

- pass registry into `loadWorkspace`/`normalizeWorkspace`
- pass storage provider into persistence
- pass default workspace factory into persistence
- let module records be derived from a module runtime, not hard-coded

Persistence should not import concrete panels.

## Future Module-Loading Boundaries

### Risk

Current module registration is static:

- `src/panels/registry.ts` imports demo definitions
- definitions are registered at module evaluation time
- `layoutPersistence` assumes demo module records

There is no boundary for:

- async module discovery
- disabled modules
- unavailable modules
- module version conflicts
- module migrations
- provider registration
- command registration
- panel capability negotiation

### Failure Mode

GTI will likely be added by importing GTI panels into the central registry. That is fine once, but repeated domain additions will make core depend on every domain module. Workspace Core would stop being core.

### Containment

Define a `WorkspaceModuleRuntime` before adding real modules.

Minimum responsibilities:

- load core modules
- load domain modules
- register panels
- register truth providers
- register advisory providers
- register preflight providers
- register temporal providers
- expose module records for persistence
- provide missing-module diagnostics

The core app can still statically import modules initially, but the import should happen in a module bootstrap layer, not inside persistence or shell logic.

## Temporal Synchronization Scalability

### Risk

The timeline demo persists `selectedEntryId` as panel-local state. That is correct for a projection demo, but real temporal surfaces will need synchronization across:

- timeline panels
- detail panels
- diff panels
- replay cursors
- preflight restore panels
- advisory explanations
- domain truth snapshots

If each temporal panel owns its own selected cursor, multi-panel workflows will drift.

### Failure Mode

Users select a point in one temporal panel, but adjacent panels show stale or different temporal context. Replay actions may target a different snapshot than advisory output or preflight review. This is especially dangerous for GTI if investigations depend on a selected time window, traffic snapshot, or replay cursor.

### Containment

Introduce a temporal context contract before real replay:

- temporal provider owns history truth
- core owns selected temporal context by scope
- panel state owns view preferences
- preflight uses validated temporal snapshot references
- advisory output records the temporal context it was generated from

Potential scopes:

- workspace temporal context
- tab temporal context
- panel-local temporal context
- linked-panel group temporal context

Do not assume one global timeline is enough.

## Event / State Propagation Risks

### Risk

Current propagation is direct prop callbacks from shell to canvas to panel frame to panel body. This is clean for three panels, but it will strain when events include:

- truth refresh
- service errors
- advisory log append
- preflight requested
- preflight approved/rejected
- panel dirty changed
- module loaded/unloaded
- temporal cursor changed
- command executed
- layout repaired
- persistence failed
- domain event streamed

### Failure Mode

Every new event becomes a prop or a shell function. Components become wired to global concerns they should not know about. Panels either over-render on unrelated state changes or invent local event channels.

### Containment

Introduce event categories and dispatch boundaries:

- layout events
- panel lifecycle events
- panel state events
- domain truth events
- advisory events
- preflight events
- temporal events
- diagnostics events

Not every category needs a complex event bus immediately. But the categories should exist so new events do not all collapse into shell props.

## Specific Risk Register

| Risk | Severity | Current Trigger | Why It Matters | Containment |
| --- | --- | --- | --- | --- |
| Shell becomes product controller | High | `WorkspaceShell` owns all mutations | GTI/domain behavior will accumulate there | Extract controller/actions before GTI |
| Persistence imports concrete registry | High | `layoutPersistence` imports `registry` | Blocks dynamic/optional modules | Inject registry/provider/default factory |
| Drag writes persisted state too often | Medium | pointer move updates workspace state | localStorage churn and future sync pressure | Preview geometry locally, commit on pointer up |
| Lifecycle hooks are not real yet | High | panel close is filter-only | dirty/preflight/subscriptions will diverge | Add panel runtime lifecycle coordinator |
| Geometry logic split across layers | Medium | frame, shell, persistence all touch geometry | docking/snap will fragment | Create layout engine boundary |
| Static module registry | High | demo panels registered by import side effect | core will absorb domains | Add module bootstrap/runtime layer |
| Temporal state is panel-local only | Medium | timeline demo selection lives in panel state | linked replay workflows drift | Add scoped temporal context |
| Event propagation is prop-only | Medium | shell callbacks passed downward | many future event types will bloat props | Define event/action categories |
| Dirty state typed but unused | Medium | `dirty` exists but close ignores it | silent data loss risk when editors arrive | Implement dirty close contract first |
| Repair warnings are not surfaced | Low | shell only shows repaired/clean | diagnostics are lost | Add diagnostics surface later |

## What Not To Do Next

- Do not add GTI panels directly to `WorkspaceShell`.
- Do not add domain API calls to `layoutPersistence`.
- Do not make timeline panels fetch and synchronize independently without a temporal context contract.
- Do not persist runtime truth in `panelState`.
- Do not add preflight as a panel-specific confirm dialog.
- Do not solve geometry by sprinkling more calculations into `PanelFrame`.
- Do not let module registration stay as a growing central import list.

## Recommended Next Contract / Refactor Task

Before GTI work, create a small architecture hardening task:

1. Extract `WorkspaceController` for tab, panel, focus, geometry, and panel-state mutations.
2. Extract `LayoutEngine` for geometry normalization, drag preview, commit, focus order, and min constraints.
3. Change persistence to accept `{ registry, storageProvider, defaultWorkspaceFactory }` as dependencies.
4. Add a `WorkspaceModuleRuntime` bootstrap layer that registers demo panels without persistence importing concrete panel modules.
5. Add event/action categories, even if implemented as simple typed functions at first.

This should remain a structural refactor only. Do not add GTI or new UI features in the same task.

## Challenge Notes

The current scaffold should stay small. The goal is not to prebuild an enterprise framework. The goal is to prevent the next useful feature from taking the easiest path into the shell and persistence files.

The contracts already have the right doctrine. The implementation now needs one thin enforcement layer between React components and state mutation before domain complexity arrives.

