# Settings Presentation Memory And Deterministic Placement

Date: 2026-08-19

## Scope

This pass brings the generic Settings surface and its supporting presentation
behavior in Jarri Workspace Core to a bounded, deterministic checkpoint.

The work is limited to Workspace-owned presentation and placement machinery.
It does not promote Lab domain modules, runtime truth providers, or
ChronoGit-specific presentation.

## Starting Point

Core already had persistent panel geometry, deterministic layout repair,
Workspace-owned frame controls, semantic projection ownership, and generic
panel placement.

Lab had a more developed Settings presentation and surface-presentation-memory
model. During the earlier semantic-frame promotion, presentation memory was
explicitly left Lab-only. That historical decision remains correct for that
checkpoint; this pass is the later bounded promotion and Core implementation
of the required generic behavior.

## Settings Promotion

The Core Settings panel now uses the developed Workspace Settings dashboard
presentation while retaining Core ownership boundaries.

Core does not adopt Lab's ChronoGit-specific theme preset.

Settings includes generic Workspace presentation controls including display,
layout, clock, panel spacing, and system-surface positioning.

The Settings panel default geometry was aligned with the developed Settings
dashboard rather than forcing the dashboard into the older smaller frame.

## System Surfaces

Workspace-owned system surfaces now have persisted positions for:

- Settings
- Add Panel
- Frame Settings

These positions remain Workspace preferences and are independent of domain
panel state.

## Surface Presentation Memory

Core now has generic surface presentation memory in `WorkspaceState`.

A panel definition may opt into this behavior through
`surfacePresentationMemory`.

For opted-in panel types, remembered presentation is keyed by stable panel
surface identity derived from `moduleId + panelType`. The memory lifetime is
therefore independent of one particular live `PanelInstance`.

Closing a panel destroys the live instance. It does not imply that opted-in
Workspace presentation memory must also be destroyed.

This distinction is intentional: presentation memory remembers how Workspace
presented a surface; it does not preserve runtime/domain truth or secretly keep
the previous panel instance alive.

## Deterministic Geometry Precedence

Panel creation now has an explicit geometry ownership order.

For an ordinary reopen with valid remembered geometry, remembered geometry
owns the presentation.

When there is no remembered geometry and the caller supplies an explicit
invocation position, that position owns the first summon.

When neither applies, the existing deterministic placement engine remains the
fallback.

In compact form:

`remembered geometry -> explicit first-summon position -> automatic placement`

All paths remain subject to normal Workspace geometry normalization.

This resolves the previous conflict where the Settings button's explicit
summon position could overwrite remembered user geometry on every reopen.

## Persistence And Repair

Surface presentation memory participates in layout persistence and
normalization.

Legacy workspace state without the new memory surface is treated as having
empty presentation memory.

Malformed presentation-memory entries are repaired or discarded
deterministically rather than trusted.

Remembered geometry remains presentation preference only. Canonical runtime
truth continues to belong to domain services and must not be persisted into
Workspace presentation memory.

## Regression Coverage

Deterministic tests were added for the panel-creation geometry contract and
layout-persistence presentation-memory behavior.

The geometry tests cover:

- explicit first-summon position;
- remembered geometry owning reopen;
- ordinary reopen without an explicit invocation position;
- automatic placement as the final fallback.

The persistence tests cover valid presentation-memory normalization and
legacy workspace state without presentation memory.

Test expectations intentionally use Workspace geometry normalization rather
than assuming raw requested coordinates survive snapping or clamping.

## Verification

At the implementation checkpoint:

- controller geometry contract tests pass;
- layout persistence presentation-memory tests pass;
- existing frame-control tests pass;
- existing panel-semantic tests pass;
- existing projection-publication tests pass;
- existing projection tests pass;
- TypeScript typecheck passes;
- production build passes;
- `git diff --check` passes.

Manual verification also confirmed that Settings can be closed and reopened,
and that its remembered size and position survive the instance lifecycle.

## Ownership Decision

Surface presentation memory is neither domain truth nor a hidden persistent
panel instance.

The ownership model is:

`live panel instance != remembered Workspace presentation != runtime truth`

This preserves deterministic Workspace behavior while allowing generic system
surfaces such as Settings to reopen where the user last presented them.

## Bounded Stopping Point

This pass establishes the generic Core contract required for Settings
presentation memory and deterministic summon/reopen placement.

Further Lab-to-Core feature promotion remains separate work.
