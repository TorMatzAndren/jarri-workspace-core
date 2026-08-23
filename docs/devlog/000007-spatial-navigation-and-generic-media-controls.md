# Devlog 000007 — Spatial Navigation And Generic Media Controls

## Summary

This campaign completed the generic Workspace camera/navigation runtime begun
by the camera-state foundation, exposed its operator preferences, established
Workspace-owned numeric input presentation, promoted Image Viewer to Core,
promoted the ChronoGit visual preset to Core, and closed the remaining generic
single-choice control parity gap.

The work intentionally remains inside Workspace Core ownership. Lab-specific
modules, providers, ChronoGit runtime behavior, GTI, Emulator, EQ Log,
Discovery, Clipboard, and other application functionality were not imported.

## Camera And Spatial Navigation

Workspace now distinguishes three separate concepts:

- global `preferences.scale` for overall Workspace/interface presentation;
- tab-local `canvasScale` for Workspace camera zoom;
- tab-local `canvasCamera` for logical camera position.

`canvasCamera.x/y` identify the logical Workspace coordinate at the viewport
top-left. Browser `scrollLeft` and `scrollTop` are rendering machinery rather
than canonical camera truth.

The runtime supports:

- middle-button Workspace panning;
- Ctrl+wheel tab-local camera zoom;
- configurable zoom step;
- viewport-center anchoring;
- active-panel-center anchoring;
- active-panel-top-left anchoring;
- pointer anchoring;
- anchor-preserving scroll compensation;
- panel-center navigation;
- panel-top-left navigation;
- configurable grid size and snapping.

Focus, explicit panel navigation, and zoom anchoring remain separate concepts.

## Deterministic Camera Restoration

The earlier runtime viewport model retained raw scroll coordinates only in
component memory. That was sufficient for tab switching inside one running
process but could not deterministically restore camera position after restart.

The final model persists:

    canvasCamera: { x, y }

per tab in logical Workspace coordinates.

On restoration, physical browser scroll is recomputed from logical camera
position, normalized canvas bounds, measured viewport dimensions, and
`canvasScale`.

Controlled restoration suppresses camera-memory updates caused by its own
programmatic scroll writes. This prevents a temporarily undersized startup
viewport or temporarily clamped scroll range from replacing the saved logical
camera before layout geometry settles.

Compatibility remains additive. Existing schema-2 layouts without
`canvasCamera` normalize to their tab canvas origin. Invalid/non-finite camera
coordinates repair deterministically to that origin.

Operator validation confirmed that the previously observed restart drift was
removed in Core.

## Camera Settings

Settings now exposes the camera/navigation preferences already owned by the
runtime.

The Layout presentation order is:

1. Grid
2. Grid size
3. Panel spacing
4. Zoom step
5. Zoom anchor
6. Navigate to

Zoom anchor and panel navigation alignment are independent policies.

Current camera zoom remains tab state rather than a global preference.

## WorkspaceNumberInput

Native browser numeric spinners exposed operating-system/WebKit presentation
that did not belong to Workspace semantic theming.

Core now owns `WorkspaceNumberInput`.

It provides:

- editable numeric text;
- Workspace-owned increment/decrement controls;
- configurable min/max/step;
- ArrowUp/ArrowDown stepping;
- Enter commit;
- Escape draft reset;
- disabled/focus presentation;
- intermediate blank/invalid drafts without destructive immediate coercion.

Feature owners continue to own value meaning, bounds, units, and persistence.

A source guard now prohibits native `input[type="number"]` controls under
`src/**/*.tsx`.

## WorkspaceSelect Completion

Core's generic `WorkspaceSelect` was brought to parity with the proven Lab
behavior.

Opened choice surfaces now:

- use trigger width as a minimum rather than a fixed width;
- grow intrinsically for long option content;
- keep normal options on one line;
- remain horizontally constrained to the visible viewport.

A source guard now prohibits native `<select>` and `<option>` markup under
`src/**/*.tsx`.

Core therefore machine-enforces both generic-control invariants.

## Local Wheel Ownership

Generic panel interaction now supports declared local-wheel surfaces.

Ordinary wheel may be consumed by a local panel interaction, while Ctrl+wheel
remains Workspace camera input.

This prevents local spatial/zoomable panels from having to reimplement or know
the Workspace camera subsystem.

## Core Image Viewer

Image Viewer is now registered as:

    core / image-viewer

Recognized image file resources route through Core's existing
`OpenResourceRequest` mechanism.

Canonical state records:

    { resourceUri }

Local image zoom/pan remain transient presentation state.

Ordinary wheel over the viewer changes local image zoom around the pointer.
Ctrl+wheel yields to Workspace camera zoom. Pointer dragging inside the viewer
pans the image without transferring Workspace frame-movement ownership.

Core intentionally does not import Lab's Jarri Workspace image provider or
base64 image-read endpoint. Local file resources are presented through the
Core/Tauri browser resource path.

### Manual verification limitation

Core does not currently ship a File Browser or another ordinary operator
surface from which to choose an image.

For that reason, real end-to-end manual image selection/rendering was not
performed during this campaign.

The following are nevertheless deterministically verified:

- image extension/resource recognition;
- resource URI conversion;
- Image Viewer panel registration;
- panel-state normalization;
- image zoom bounds and pointer-anchor math;
- local-wheel ownership;
- Ctrl+wheel yielding to Workspace camera input;
- TypeScript integration;
- production build.

Real image-opening verification is deferred until Core gains a suitable
file-opening surface.

## ChronoGit Theme

`chronogit` is now an intentional stock Core theme preset.

Only the visual identity migrated. No ChronoGit panels, Git providers, GTI,
repository runtime, development chronology behavior, or other ChronoGit domain
functionality migrated with it.

The preset is intentionally dark-oriented and applies through Workspace's
semantic colour architecture.

Generic shell, canvas, panel, header, button, control, menu, scrollbar, and
related presentation consume the preset while custom semantic colour overrides
continue to operate through the normal override system.

## Verification

The final campaign is verified through:

- Core bundled deterministic test suite;
- layout persistence tests;
- tab-template tests;
- Workspace controller tests;
- camera math tests;
- grid/layout interaction tests;
- panel interaction tests;
- WorkspaceNumberInput tests;
- resource tests;
- panel semantics/projection/publication tests;
- frame-control tests;
- Image Viewer tests;
- native-select source guard;
- native-number source guard;
- TypeScript typecheck;
- production build;
- `git diff --check`.

The operator additionally validated the new camera/pan/zoom behavior and
deterministic restart restoration in the running Core application.

## Follow-Up

The next planned Workspace feature work is outside this campaign.

A generic File Browser is expected to provide a natural operator path for
end-to-end Image Viewer testing later. The present Image Viewer architecture
does not depend on that future panel.
