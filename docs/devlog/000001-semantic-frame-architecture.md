# Semantic Frame Architecture Promotion

Date: 2026-08-19

## Scope

This pass promotes the generic Workspace semantic/frame substrate from
`/home/dretski/projects/workspace-lab` into Core without syncing Lab domain
modules.

Core HEAD at start: `05a1a07 Workspace Core: add Jarri Workspace branding`.

## Lab Sources Inspected

- `cc10300 Establish Workspace visual language and component ownership`
- `ae07a20 Add Workspace semantic presentation and panel Copy`
- `5c315e5 Add universal frame controls and isolate panel projections`
- `1d93e70 Workspace: complete semantic Copy and local zoom ownership`
- Lab contracts and architecture notes for visual language, semantic
  presentation, panel Copy migration, and panel/frame ownership.

## Promoted

- `projection` document formatting and frame-owned publication controller.
- `panelSemantics` helpers and mandatory `PanelDefinition.semanticStrategy`.
- `frameControls` catalog, stable keys, preference normalization, runtime
  publication center, Copy dispatch, and deterministic font-scale steps.
- `PanelProjectionHost` as a Core-native body boundary with Suspense fallback,
  render-failure isolation, semantic initial setup, and publisher injection.
- Frame-owned whole-panel Copy using semantic projection, not DOM text.
- Workspace-owned panel font scaling stored under panel-view preferences.
- Truthful minimal semantics for current Core and demo panels.
- Deterministic specs for semantic completeness, projection formatting,
  publication ownership, stale lease protection, instance isolation,
  frame-control ownership, preference normalization, runtime payload
  availability, Copy dispatch, independent Font controls, and font stepping.

## Left Lab-Only

- Tauri integration.
- Runtime execution infrastructure.
- Runtime timing/profiling and observation providers.
- Command Launcher, Clipboard Register, File Browser, Editor, System Stats,
  screenshots, spatial invocation, presentation memory, and module-specific
  semantic migrations.
- ChronoGit-specific styling and all Lab/domain panels.

## Ownership Decision

`frame != panel body != semantic projection != frame capability`.

The frame is Workspace-owned chrome and isolation. The panel body is
module-owned content. The semantic projection is a runtime document describing
meaningful panel content. A frame capability is a Workspace-owned control that
may consume a semantic projection or a runtime payload.

Keeping those boundaries separate prevents panel bodies from owning generic
frame chrome, prevents Workspace from inferring domain truth from DOM or
persisted state, and lets future Workspace-owned panels adopt Copy and frame
controls before their feature-specific implementations are migrated.

## Runtime-Only Publication

Semantic publication remains runtime-only because it can contain current domain
truth, visible filters, selected rows, body failure state, and other ephemeral
content. Persisting it would blur layout preference with runtime truth and make
stale copied content appear authoritative after reload.

The frame owns the publication controller. Dynamic panel bodies publish an
exporter and receive a lease. Releasing an old lease cannot clear a newer
publication, and duplicate panel instances do not share controllers.

## Core 0.3.0 Prerequisite

Command Launcher, Clipboard History, Editor, File Browser, System Stats,
screenshots, and later frame capabilities need one generic frame substrate
before their domain features are promoted. This pass establishes that substrate
while leaving those feature migrations out of scope.
