# Panel Lifecycle Coordination — Workspace Core 0.4.0 Work

> Engineering record for the 0.4.0 lifecycle implementation; see the
> [lifecycle contract](../contracts/000005-panel-lifecycle-contract.md) for
> current behavior and limits.

## Status

The generic panel lifecycle foundation is implemented in Core. It adapts the
tested state and coordinator contracts from Workspace Lab while keeping Lab's
application services, demand lifecycle binding, and runtime orchestration out
of Core.

## Core Integration

`WorkspaceRuntime` owns one coordinator and disposes it with the runtime.
`WorkspaceShell` reconciles it against every panel in every workspace tab and
marks only non-minimized panels in the selected tab as presentation-active.
The lifecycle projection is in-memory only and does not affect persisted
workspace documents.

The coordinator records immutable revisions, validates transitions, notifies
subscribers, treats repeated transitions as no-ops, and uses generation-bearing
identities to reject stale references after a panel ID is reused. Removed
records are pruned during subsequent mutations so closed-panel history does
not grow without bound.

## Deliberately Observational

Core already unmounts non-selected tab canvases and minimized panel bodies.
This work does not add further unmounting, service suspension, projection
retention, or background work control. The retention policies provide a
generic declaration point for later work; policy execution needs explicit
runtime and native-surface safety contracts first.

Projection publication remains under the existing generation-safe frame
publication controller. Native-surface reconciliation still observes all
workspace panel IDs, including panels whose presentation lifecycle is
suspended. Dirty panel data and the persistence schema are unchanged.

See [`../contracts/000005-panel-lifecycle-contract.md`](../contracts/000005-panel-lifecycle-contract.md)
for transitions, ownership, safety boundaries, and non-goals.
