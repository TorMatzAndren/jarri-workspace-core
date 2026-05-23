# Workspace Core Structural Hardening

## Scope

This document records the structural hardening pass performed before any GTI or other domain implementation.

Source truth:

- `docs/investigations/000001-workspace-core-source-audit.md`
- `docs/investigations/000002-workspace-core-entropy-risks.md`
- `docs/contracts/000001-workspace-core-architecture.md`
- `docs/contracts/000002-panel-contract.md`
- `docs/contracts/000003-layout-persistence-contract.md`

The pass intentionally avoided GTI, domain-specific panels, heavy state libraries, full docking, and UI redesign.

## What Was Extracted

### WorkspaceController

Added `src/core/workspaceController.ts`.

The controller now owns the workspace state mutation surface:

- tab select/create/close
- panel create/close/focus
- panel state updates
- panel geometry updates
- preference updates
- reset/default workspace
- persistence save on workspace changes

`WorkspaceShell.tsx` is now mostly render/dispatch. It wires runtime, persistence, controller, tab bar, panel picker, and canvas, but no longer implements the core tab/panel mutation logic directly.

### LayoutEngine

Added `src/core/layoutEngine.ts`.

The layout engine now owns:

- grid snapping
- geometry normalization
- min-size enforcement
- focus-order helpers
- `beginGeometryInteraction`
- `previewGeometryInteraction`
- `commitGeometryInteraction`

Full docking was intentionally not implemented. The current engine is a future-ready boundary for move/resize/dock behavior while preserving the existing freeform panel behavior.

### Dependency-Injected Persistence

Reworked `src/core/layoutPersistence.ts`.

Persistence no longer imports the concrete panel registry or demo panels. It now receives:

- `registry`
- `storageProvider`
- `defaultWorkspaceFactory`
- `getModuleRecords`
- optional `workspaceId`

The default storage remains localStorage through `createLocalStorageProvider()`. The existing storage key and persisted document kind were preserved to keep current layout compatibility where possible.

### WorkspaceModuleRuntime

Added `src/core/moduleRuntime.ts` and `src/bootstrap/workspaceRuntime.ts`.

The runtime owns module registration and exposes:

- panel registry
- module registration
- module records for persistence
- registered module list

Core and demo panels are now registered through module definitions:

- `src/panels/corePanels.ts`
- `src/panels/demoModule.ts`

The old concrete `src/panels/registry.ts` singleton was removed so persistence and shell do not grow direct imports for every future module.

### Event / Action Categories

Added `src/core/events.ts`.

The file defines typed event categories without introducing a complex event bus:

- layout
- panel lifecycle
- panel state
- domain truth
- advisory
- preflight
- temporal
- diagnostics

These types create a vocabulary for future routing without forcing a heavy architecture now.

## What Remained Intentionally Simple

- State still uses React local state in the controller.
- Persistence still saves to localStorage by default.
- Drag/resize still uses a simple freeform geometry model.
- Geometry preview still writes through the current React state path.
- Panel lifecycle hooks are not fully implemented yet.
- Dirty-state handling is still typed but not operationalized in the UI.
- Event categories are types only, not a runtime bus.
- Temporal synchronization is still panel-local in the demo.
- No command palette, preflight coordinator, or domain action router was added.

This keeps the scaffold small while removing the most immediate entropy paths.

## Settings Panel

Added a framework-level Settings panel:

- `src/panels/SettingsPanel.tsx`
- registered by `src/panels/corePanels.ts`
- bootstrapped through `WorkspaceModuleRuntime`

The Settings panel updates `WorkspaceState.preferences`, not panel-local runtime truth.

It supports:

- font family preset: system, serif, mono
- UI density: compact, comfortable
- color scheme mode: system, dark, light
- theme preset: neutral, graphite, contrast
- workspace scale

Settings persist through the existing workspace layout persistence because they are workspace preferences. They are not domain-specific and do not encode GTI, ChronoGit, Spooty, or Jarri Workspace themes.

Theme and density behavior is centralized in CSS custom properties in `src/styles.css`. The shell applies preference values as `data-*` attributes plus `--workspace-scale`, and CSS resolves those into framework tokens.

## GTI Module Readiness

This pass prepares Workspace Core for GTI as a module by establishing the expected insertion points:

- GTI panels should be provided as a `WorkspaceModuleDefinition`.
- GTI should register truth providers through the module runtime when provider contracts are implemented.
- GTI should not be imported by persistence.
- GTI should not add orchestration logic to `WorkspaceShell`.
- GTI layout should persist as normal `PanelInstance` projection state.
- GTI runtime truth must stay in GTI services/providers, not in `panelState`.
- GTI temporal state should use future temporal context boundaries instead of ad hoc panel-local sync.
- GTI risky actions should route through a future preflight coordinator.

The demo panels remain intentionally generic and continue to validate truth/advisory/temporal doctrine without becoming GTI.

## What Should Still Not Be Implemented Yet

Do not implement GTI yet.

Do not add:

- GTI panels
- GitHub API calls
- traffic ingestion
- domain-specific storage
- domain-specific settings
- full docking or split-tree layout
- LLM execution
- preflight modals as one-off panel dialogs
- a heavy global state library
- a complex event bus
- runtime truth persistence in `panelState`
- ChronoGit, Spooty, or Jarri Workspace code copies

The next safe implementation step is to define provider contracts for truth, advisory, preflight, and temporal data, or to add lifecycle/dirty-state enforcement. GTI should wait until those boundaries exist.

## Verification

Commands run:

- `npm run typecheck`
- `npm run build`

Both passed after the hardening changes.

