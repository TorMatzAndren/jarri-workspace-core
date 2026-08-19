# Devlog 000003 — Logical Workspace Screenshot

Date: 2026-08-19

## Purpose

Workspace Core now supports copying the complete logical Workspace tab to the
native image clipboard.

This is a canvas-level presentation operation. It is intentionally distinct
from the existing frame-level semantic Copy operation.

## User-visible behavior

The Workspace canvas toolbar exposes a `Screenshot` action.

Activating it captures the complete logical canvas for the active tab rather
than the currently visible application viewport.

The capture therefore remains independent of:

- the current scroll position;
- which part of the logical canvas is visible on screen;
- the current visual Workspace zoom.

Panels positioned outside the visible viewport remain part of the captured
image when they lie within the logical canvas bounds.

The canvas resize handle is excluded from the image because it is Workspace
interaction chrome rather than Workspace content.

The resulting image is written directly to the native system clipboard.

Transient button feedback reports:

- `Copying…`
- `Copied`
- `Copy failed`

No screenshot bytes are added to Workspace state or layout persistence.

## Clipboard ownership

Workspace Core now has two deliberately separate clipboard operations.

### Panel Copy

Panel-frame `Copy` publishes the panel's semantic Workspace Projection as text.

The existing semantic Copy path remains panel-owned and represents structured
meaning rather than pixels.

Manual verification during this campaign confirmed semantic text output from
both Timeline Demo and Advisory Log Demo after Screenshot support was added.

### Workspace Screenshot

Canvas-level `Screenshot` renders the active tab's complete logical canvas as
an image and writes that image to the native clipboard.

It does not replace, modify, or reinterpret panel semantic Copy.

The distinction is:

    Panel Copy          -> semantic text projection
    Workspace Screenshot -> logical canvas image

This separation is intentional.

## Implementation boundary

The frontend capture uses `modern-screenshot` against the logical Workspace
canvas element.

Capture explicitly removes the canvas visual scale transform so the image is
rendered in logical canvas coordinates at scale 1.

The capture dimensions come from the effective logical canvas bounds.

The logical canvas resize handle is filtered from capture.

The resulting image bytes cross the Tauri boundary through
`@tauri-apps/api/image` and are written with
`@tauri-apps/plugin-clipboard-manager`.

The native host enables Tauri PNG image support and registers the clipboard
manager plugin.

The default desktop capability grants only the image-write clipboard
permission required by this feature:

    clipboard-manager:allow-write-image

## Manual verification

The feature was manually exercised with multiple Workspace layouts.

Observed behavior:

1. A tab containing a panel near the logical origin produced an image of the
   complete logical canvas rather than only the visible viewport.

2. A tab containing panels near the upper-left and another panel substantially
   farther down and right captured all of those panels in one image.

3. The captured panels appeared in logical canvas scale rather than inheriting
   the current viewport zoom.

4. The logical canvas resize handle was absent from the resulting image.

5. The resulting image could be pasted from the native clipboard.

6. Existing panel semantic Copy continued to produce structured textual
   Workspace Projections after Screenshot support was enabled.

These observations establish that Screenshot is a logical-tab capture rather
than an operating-system window screenshot or viewport screenshot.

## Non-goals

This change does not:

- crop captures to panel/content bounds;
- add a viewport-only screenshot mode;
- save screenshots to disk;
- persist screenshot data;
- add screenshot behavior to individual panel frames;
- alter semantic Copy;
- change logical canvas sizing;
- change Workspace zoom semantics.

A future content-bounds screenshot would be a separate feature and should not
change the complete-logical-canvas contract established here.

## Dependencies introduced

Frontend:

- `@tauri-apps/api`
- `@tauri-apps/plugin-clipboard-manager`
- `modern-screenshot`

Native:

- Tauri `image-png` feature
- `tauri-plugin-clipboard-manager`

## Verification

Before committing this feature, verify:

- deterministic Core tests;
- TypeScript typecheck;
- frontend production build;
- Rust `cargo check`;
- `git diff --check`;
- manual native clipboard image capture.

The manual native behavior was verified before this devlog was written.
