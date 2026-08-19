# Devlog 000004 — Tab-Local Canvas Viewport

Date: 2026-08-19

## Purpose

Workspace Core now treats the visible canvas viewport as tab-local transient
presentation state.

The Workspace shell itself is constrained to the native application viewport.
Spatial scrolling belongs to the canvas surface rather than to the document or
application chrome.

## Ownership contract

The viewport hierarchy is:

    native window
      -> Workspace shell
        -> fixed Workspace chrome
          -> active tab canvas viewport
            -> logical Workspace canvas

The native window owns the application extent.

The Workspace shell owns application chrome and does not participate in
spatial scrolling.

The canvas surface owns spatial scrolling.

Each tab owns its current transient canvas viewport position.

The logical canvas continues to own logical Workspace coordinates and bounds.

## Shell scroll containment

The document root, body, and React root are constrained to the native viewport
and do not expose document-level scrolling.

The Workspace shell fills that viewport and hides overflow outside its owned
layout.

The canvas remains the shrinking grid region through `minmax(0, 1fr)` and
`min-height: 0`.

The canvas surface remains the explicit scroll owner through `overflow: auto`.

As a result, scrolling around a large Workspace moves only the desktop area.
Application chrome such as the header, tab bar, and canvas toolbar remains
visible.

## Tab-local viewport memory

`WorkspaceCanvas` receives the active `tabId`.

Viewport positions are held in transient in-memory state keyed by that tab ID:

    tabId -> { scrollLeft, scrollTop }

The canvas surface records its viewport whenever the actual scroll position
changes.

This is intentionally stronger than attempting to infer the departing tab's
position during a later tab-transition effect. Recording the position at
scroll time means the active tab still unambiguously owns the observed
viewport.

When the active tab changes, the canvas restores that tab's remembered
viewport on the next animation frame.

A tab without remembered viewport state begins at the logical origin.

## Navigation independence

Because viewport memory observes the canvas surface's actual scroll event, it
does not depend on a particular navigation mechanism.

Scrollbar movement, ordinary scrolling, and canvas panning all converge on the
same transient viewport memory whenever they change the scroll surface.

## Persistence boundary

Tab viewport position is session presentation memory.

It is deliberately not part of:

- `WorkspaceState`;
- layout persistence;
- tab templates;
- surface presentation memory;
- panel state;
- logical canvas geometry.

Restarting Workspace may therefore reset viewport positions without changing
the persisted Workspace layout.

This is intentional.

## Relationship to logical canvas geometry

Viewport position and logical Workspace geometry are separate concepts.

Panel geometry and canvas bounds remain logical coordinates.

Viewport scrolling changes only which portion of those logical coordinates is
currently visible.

Workspace zoom remains a visual transformation and does not redefine logical
geometry.

## Relationship to Screenshot

Canvas-level Screenshot remains independent of viewport position.

Screenshot captures the complete logical Workspace tab rather than the visible
canvas viewport.

Therefore:

    viewport scroll -> changes what the operator currently sees
    Screenshot      -> captures the complete logical tab

This distinction is intentional.

## Lab comparison

Workspace Lab already contained tab-local viewport restoration and explicit
shell/canvas scroll containment.

During the Core port, the viewport-memory ownership was tightened.

Rather than recording the departing tab's position during the tab-transition
effect, Core records viewport position when the canvas surface actually
scrolls and uses tab transition only for restoration.

This avoids transition-time ambiguity if rendering the incoming tab changes
or clamps the shared scroll surface before the previous position is observed.

Lab should be brought to parity with this stronger ownership rule as a
separate bounded change.

## Manual verification

The implementation was manually exercised in the native Workspace Core host.

Observed behavior:

1. Scrolling a large Workspace moves only the desktop/canvas area.

2. Workspace chrome remains visible while navigating the logical canvas.

3. A tab scrolled away from the logical origin remembers its viewport when
   another tab is selected.

4. Returning to that tab restores its previous viewport.

5. Different tabs can retain different viewport positions.

6. A tab without remembered viewport state begins at the logical origin.

7. Existing logical-canvas Screenshot behavior remains conceptually
   independent of viewport position.

## Non-goals

This change does not:

- persist viewport positions across application restarts;
- change logical canvas bounds;
- change panel geometry;
- change Workspace zoom semantics;
- introduce controller-owned viewport state;
- introduce viewport state into layout persistence;
- change Screenshot capture bounds;
- change panel presentation memory.

## Verification

Before commit, verify:

- TypeScript typecheck;
- frontend production build;
- `git diff --check`;
- native tab-switch viewport restoration;
- native shell scroll containment.
