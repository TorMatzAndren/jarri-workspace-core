# Panel Lifecycle Contract

## Scope

This contract defines generic, in-memory presentation lifecycle coordination
for panel instances. It does not replace the workspace controller, layout
persistence, panel renderer, projection publication controller, or module
runtime.

## State Model

The lifecycle state is runtime-only:

| State | Meaning |
| --- | --- |
| `framed` | Panel belongs to the workspace but has not been activated in this runtime. |
| `activating` | Synchronous transition marker before `active`. It does not promise asynchronous readiness. |
| `active` | Panel is in the selected tab and is not minimized. It does not mean it owns focus. |
| `suspending` | Synchronous transition marker before `suspended`. |
| `suspended` | Panel remains a workspace member but is not currently presented. |
| `disposed` | The panel identity has left the workspace or its runtime is being torn down. |

Allowed transitions are `framed -> activating -> active`,
`active -> suspending -> suspended`, `suspended -> activating`, and disposal
from any non-disposed state. `disposed` is terminal for that lifecycle
identity. Repeated operations that already match the requested state are
idempotent.

The coordinator exposes monotonically revisioned frozen snapshots. Registration
returns a generation-bearing identity token; work holding an older token
cannot act on a later panel that happens to reuse the same panel ID. String
references intentionally address the current registration and are intended
for synchronous workspace reconciliation.

## Capabilities And Retention Policies

Panel definitions may declare generic lifecycle capabilities:

- projection retention: `discard-on-detach` or `retain`;
- runtime retention: `discard-on-detach`, `suspend`, or `keep-alive`;
- background activity: `stop-when-hidden`, `pause-when-hidden`, or `continue`.

Defaults are conservative: discard detached projections and runtimes, and stop
background activity when hidden. These values are descriptive contracts in
this phase. The coordinator does not unmount panel bodies, retain projections,
suspend services, or stop background work based on policy values.

## Ownership And Persistence

The workspace owns panel membership, selected tab, minimized display state,
panel data, and dirty state. The lifecycle coordinator observes membership and
presentation derived from that workspace. It is not a second state authority.
Lifecycle states, revisions, and identities are not written into
`WorkspaceState`, panel state, templates, or saved layouts; no persistence
schema migration is required.

Every panel in every tab remains registered as a member, including minimized
panels. Only non-minimized panels in the selected tab are presentation-active.
Closing a panel disposes its lifecycle record. Runtime teardown disposes the
coordinator and clears its records and subscriptions.

## Projection Publication

Panel semantic projections remain owned by each `PanelFrame` publication
controller. Its generation and publication leases remain authoritative for
stale publication and release handling. Lifecycle transitions do not reset,
publish, retain, or discard projection data. Current React unmount cleanup and
projection-controller isolation continue to govern projection lifetime.

## Native-Surface Safety

Native-surface reconciliation continues to receive all panel IDs in all tabs.
Lifecycle suspension does not destroy or detach an adopted native window.
Closing/removing a panel remains the existing native-surface reconciler's
responsibility. A future runtime suspension feature must first define how a
suspended native-hosted panel relinquishes and later reacquires its native
surface without orphaning the adopted window.

## Implemented Behavior And Future Capabilities

Implemented behavior is observational reconciliation from actual workspace
membership, selected-tab changes, and minimization/restoration. A tab switch
suspends the prior tab's presentation records and activates the selected
tab's non-minimized panels. Minimization suspends a panel after the existing
frame behavior removes its body; restoration makes it presentation-active
again. Missing module definitions remain members and can recover through the
existing registry/reload path.

This is panel lifecycle coordination, not complete offscreen rendering
virtualization. Core currently mounts only the selected tab's canvas, and a
minimized panel's body is already unmounted by existing frame behavior. The
coordinator adds no new rendering or runtime policy action.

## Non-Goals

- No dirty-state close preflight or save/discard workflow.
- No panel lifecycle callbacks such as `onFocus`, `onBeforeClose`, or `onSave`.
- No demand-source or service start/stop binding.
- No automatic panel-body unmounting or offscreen virtualization.
- No projection retention implementation.
- No native-surface destruction on suspension.
- No application-specific lifecycle policy or module dependency.
- No asynchronous readiness promise; `activating` and `suspending` are
  synchronous observable transition markers only.
