# Devlog 000003 — Workspace Screenshot Architecture

Date: 2026-08-19
Updated: 2026-08-31

## Purpose

Workspace Core supports two image-capture operations with deliberately
different presentation semantics:

1. complete logical Workspace-tab screenshot;
2. individual Workspace frame screenshot.

Both operations publish PNG image data to the native image clipboard.

They remain separate from the existing panel-frame semantic `Copy` operation,
which publishes structured textual Workspace Projections rather than pixels.

The ownership rule is:

    Workspace owns screenshot capability.
    WorkspaceCanvas owns the logical-tab capture boundary.
    PanelFrame owns the individual-frame capture boundary.
    Panels own their body presentation.

Panels do not implement their own screenshot mechanisms.

## Screenshot target model

The shared frontend screenshot service exposes two target kinds:

    workspace
    frame

A Workspace target supplies:

- the logical Workspace element;
- the effective logical width;
- the effective logical height.

A frame target supplies:

- the existing Workspace-owned PanelFrame element.

The two targets deliberately use different rendering strategies because they
represent different presentation contracts.

## Logical Workspace screenshot

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

### Logical capture implementation

Logical Workspace capture uses `modern-screenshot` against the logical
Workspace canvas element.

Capture explicitly removes the canvas visual scale transform so the image is
rendered in logical canvas coordinates at scale 1.

Capture dimensions come from the effective logical canvas bounds.

The resulting PNG bytes are converted to a Tauri image and written through the
native clipboard manager.

This DOM-based route remains appropriate for logical Workspace capture because
the requested image intentionally extends beyond the currently rendered native
WebView viewport.

## Frame screenshot

Every Workspace frame receives the global default-enabled `Screenshot` frame
control.

Activating it captures the complete PanelFrame presentation boundary:

- Workspace frame chrome;
- frame header;
- enabled global frame controls;
- panel body;
- the complete configured frame width and height.

The capture boundary belongs to `PanelFrame`, not to the panel implementation.

This means a panel receives screenshot support automatically when projected
inside Workspace without adding panel-specific screenshot code.

The resulting PNG is written directly to the native image clipboard.

Transient frame-control feedback reports:

- `Copied`;
- `Copy failed`.

No screenshot bytes are added to Workspace state or layout persistence.

## Why frame capture does not use the logical DOM rasterizer

Early frame-capture implementation reused `modern-screenshot`.

That route worked for ordinary and moderately complex panels, including
SVG-heavy Workspace content, but exposed two scaling and platform limits when
tested against the Core File Browser.

### Serialization scaling

The large File Browser contained approximately 24,000 mounted descendant
elements.

Initial foreignObject SVG serialization reached roughly 116 MB even though the
requested frame image was only approximately 1016 × 2098 pixels.

Profiling showed most of that size came from copied computed CSS.

Restricting copied CSS reduced serialization substantially.

Pruning descendants that were completely outside clipping ancestors reduced
the serialized tree from approximately:

    24,363 elements
    ~116 MB initial serialized representation

to approximately:

    1,391 elements
    ~1.9 MB serialized representation

This established an important general rule:

    screenshot serialization cost should scale with visible presentation,
    not with all mounted hidden DOM.

However, serialization size was not the final failure.

### WebKit foreignObject canvas boundary

On the Linux WebKitGTK runtime, SVG containing XHTML through `foreignObject`
could:

- load successfully;
- draw successfully onto a canvas.

The resulting canvas could not be exported through `canvas.toBlob()`.

WebKitGTK returned:

    SecurityError: The operation is insecure.

Therefore the browser foreignObject path is not a reliable foundational
frame-screenshot transport on this runtime.

Frame capture was moved to the native renderer rather than adding further
browser-specific workarounds.

## Native frame rasterization

On Linux, Workspace Core uses the WebKitGTK renderer that already presents the
application.

Direct native dependencies expose:

- `webkit2gtk::WebViewExt`;
- `SnapshotRegion::FullDocument`;
- Cairo image surfaces and PNG encoding.

The Tauri host exposes the underlying WebKit WebView through
`with_webview(...)`.

The native command therefore performs:

    WebKit FullDocument snapshot
        ->
    Cairo surface
        ->
    crop requested rectangle
        ->
    PNG byte vector
        ->
    frontend Tauri image
        ->
    native clipboard

This avoids browser canvas export and foreignObject security restrictions.

## Flicker-free off-screen frame replica

A native FullDocument snapshot only includes real document geometry.

Workspace normally keeps its large logical canvas inside a bounded application
viewport, so an off-screen or oversized PanelFrame does not automatically
increase the native WebKit document dimensions.

An early proof temporarily promoted the live frame into document geometry.
That successfully captured the complete File Browser, but visibly changed
Workspace presentation during capture.

Visible capture staging is not acceptable as the production interaction model.

The production frame path therefore leaves the live Workspace untouched.

Before native capture, the frontend:

1. clones the selected PanelFrame DOM;
2. synchronizes live presentation state that `cloneNode(true)` does not
   necessarily preserve;
3. creates a temporary Workspace theme owner around the replica;
4. copies Workspace theme attributes and active CSS custom properties;
5. places the replica below the visible viewport;
6. lets that replica contribute genuine document geometry;
7. requests a WebKit FullDocument snapshot;
8. removes the temporary replica in a `finally` cleanup path.

The user-visible Workspace is never repositioned, hidden, resized, transformed,
or reparented for frame capture.

This eliminates the capture flicker produced by live staging.

## Replica state synchronization

The off-screen capture replica synchronizes presentation state for:

- text inputs;
- checkbox state;
- textareas;
- native selects;
- descendant scroll offsets;
- canvas pixel buffers.

Ordinary HTML and SVG content are preserved through DOM cloning.

Raster images remain raster image content and are rendered natively by WebKit
inside the capture replica.

The replica is not a second Workspace panel instance and does not participate
in Workspace runtime state, lifecycle, persistence, focus ownership, or panel
registration.

It exists only for the duration of one screenshot transaction.

## Theme ownership

Workspace presentation variables are owned by `.workspace-shell`.

A cloned PanelFrame appended directly outside that ancestry falls back to
default presentation variables.

Frame screenshot therefore creates a temporary theme host that:

- carries the Workspace shell classes;
- carries semantic shell data attributes such as active theme and font;
- copies active Workspace CSS custom properties;
- deliberately neutralizes normal shell geometry.

This preserves theme presentation without cloning or mutating the live
Workspace shell.

Manual verification confirmed Pink Sparkle frame capture after this theme
inheritance boundary was added.

## Clipboard ownership

Workspace Core now has three deliberately separate clipboard publication
operations.

### Panel Copy

Panel-frame `Copy` publishes the panel's semantic Workspace Projection as text.

It represents structured meaning rather than pixels.

### Frame Screenshot

Panel-frame `Screenshot` publishes the complete visual PanelFrame as a PNG.

It represents the frame presentation boundary rather than panel semantics.

### Workspace Screenshot

Canvas-level `Screenshot` publishes the active tab's complete logical canvas as
a PNG.

The distinction is:

    Panel Copy           -> semantic text projection
    Frame Screenshot     -> one complete Workspace frame image
    Workspace Screenshot -> complete logical Workspace-tab image

This separation is intentional.

## Frame-control ownership

Screenshot is registered in the global Workspace frame-control catalog.

Its properties are:

- control ID: `screenshot`;
- label: `Screenshot`;
- kind: `screenshot`;
- default enabled: true.

Panel modules do not need to declare the control individually.

Core frame-control tests assert this catalog ownership and ensure Screenshot is
independent from semantic Copy availability.

## Manual verification

### Logical Workspace capture

The existing logical Workspace behavior was manually verified with multiple
Workspace layouts.

Observed behavior:

1. A tab containing a panel near the logical origin produced an image of the
   complete logical canvas rather than only the visible viewport.

2. A tab containing panels near the upper-left and another panel substantially
   farther down and right captured all of those panels in one image.

3. Captured panels appeared in logical canvas scale rather than inheriting the
   current viewport zoom.

4. The logical canvas resize handle was absent from the resulting image.

5. The resulting image could be pasted from the native clipboard.

6. Existing panel semantic Copy continued producing structured textual
   Workspace Projections.

### Frame capture

Frame capture was manually verified against substantially different Core
presentations.

#### Text Viewer

A small Text Viewer frame captured:

- complete frame chrome;
- panel body;
- textual content;
- correct configured frame dimensions.

#### Themes / Colours

The Themes / Colours frame verified:

- native controls;
- Workspace theme variables;
- Pink Sparkle presentation;
- advanced colour controls;
- complete frame chrome.

#### File Browser

The Core File Browser served as the large-frame regression case.

The tested frame was approximately 1016 × 2098 logical pixels and contained a
large mounted directory tree.

The final native replica path captured the complete frame beyond the physical
application viewport without visible Workspace mutation or capture flicker.

#### Image Viewer

An Image Viewer containing an existing raster screenshot of ChronoGit verified:

- large raster image preservation;
- detailed visual content;
- frame chrome;
- theme inheritance;
- full-frame native rendering.

This test validates cloned raster-image presentation. It does not by itself
establish behavior for continuously rendered WebGL, video, or other live
external rendering surfaces.

## Non-goals

This feature does not:

- replace semantic panel Copy;
- save screenshots to disk;
- persist screenshot data;
- make screenshot replicas part of Workspace runtime state;
- reparent live React-managed panel nodes;
- capture arbitrary operating-system windows;
- define video or continuously rendered external-surface capture semantics;
- change logical Workspace sizing;
- change Workspace zoom semantics.

A future viewport-only screenshot or external-surface capture mode would be a
separate capability.

## Dependencies

Frontend:

- `@tauri-apps/api`;
- `@tauri-apps/plugin-clipboard-manager`;
- `modern-screenshot`.

Native base:

- Tauri `image-png` feature;
- `tauri-plugin-clipboard-manager`.

Linux native frame capture:

- `webkit2gtk = 2.0.2`;
- `cairo-rs = 0.18.5` with PNG support.

The Cargo lockfile change for this campaign only adds the Core package's direct
references to the WebKitGTK and Cairo packages already selected by the Tauri
Linux stack. It does not include an unrelated Tauri/Wry dependency refresh.

## Verification

Before committing this feature, verify:

- deterministic Core tests;
- TypeScript typecheck;
- frontend production build;
- Rust `cargo check`;
- Rust formatting;
- `git diff --check`;
- no experimental backup files;
- no temporary screenshot diagnostics;
- manual native clipboard frame capture;
- manual logical Workspace capture.
