# Changelog

## v0.4.0 — Release Candidate (unreleased)

Workspace Core 0.4.0 is a source-only release candidate. It has not been tagged
or published. See [the user-facing release notes](docs/releases/0.4.0.md).

First-party Core source is licensed under MPL-2.0. See `LICENSE` and the
third-party provenance and licensing inventory in
`docs/third-party-notices.md`; dependency and asset licenses remain separate
where applicable.

### Workspace navigation and discovery

- Added persistent per-panel Organize Lock to Frame Controls. Locked frames
  remain fixed during Preserve Sizes organization, constrain arranged panels
  with the configured grid-unit gap, and remain fully available for manual
  movement and resizing. Minimized panels retain their existing overlap-only
  obstacle behavior.
- Integrated canvas-aware Preserve Sizes organization with a bounded spatial
  search for up to eight eligible panels and a validated deterministic shelf
  fallback. Invalid plans are rejected without partial geometry changes;
  Uniform currently remains a preference without a live arrangement result.
- Added workspace-wide Open Panel search and a searchable Add Panel catalogue
  for registered modules and panels.
- Added spatial catalogue controls, viewport-anchored placement, resizing,
  module-group rearrangement, manual column layout, and saved catalogue
  preferences. Catalogue layout uses browser local storage, separately from the
  persisted workspace document.
- Added configurable tab-strip overflow: horizontal scroll or multi-row wrap,
  optional compact tab buttons, accessible horizontal scrollbar behavior, and
  pointer-based tab reordering. Tab ordering reuses the existing tabs array and
  preserves active tab identity.
- Added a persistent panel corner-radius preference and moved its control into
  Themes / Colours.
- Added Dashboard Night (UX Planet), a community theme contributed by
  **Sh0ken (Kenny)**. The supplied palette is dark-only; independent
  Light/System variations have not been implemented.
- Added the Core Calendar panel with ISO week labels, editable calendar items,
  and calendar copy workflows. The Core clock can open the Calendar.
- Added generic external-URL opening support through Core's host integration.
- Added complete logical Workspace screenshot capture and individual frame
  screenshot capability, with image clipboard publication owned by Workspace.
- Added relative geometry hardening for persisted panels and panel interaction
  improvements around wheel ownership and frame typography.
- Added an adopted native-surface host and lifecycle cleanup/recovery paths.
  This integration is experimental and currently has Linux-specific
  implementation; it is not a supported cross-platform panel plugin system.

### Appearance and workspace customization

- Added theme-independent glass appearance controls, including surface policy,
  opacity, blur, saturation, border intensity, and reduced effects.
- Added viewport-fixed gradient canvas wallpaper with configurable colors and
  angle, independent of the selected theme.
- Removed obsolete Panel Menu Arrangement Settings controls; catalogue
  organization and preferences are available through Add Panel.
- Preserved existing theme behavior and normalized legacy appearance values.

### Runtime, Diagnostics, and lifecycle

- Added generic panel lifecycle coordination for actual workspace membership,
  selected-tab presentation, and minimization changes. It remains observational;
  it does not implement background-service policies or automatic offscreen
  unmounting.
- Added runtime timing, bounded trace and aggregate history, trace selection,
  active observation-lease tracking, and exact-known resource-byte evidence
  registries.
- Promoted Runtime Diagnostics, Runtime Events, and Runtime Inspector into the
  first-party Workspace Diagnostics module and its own Add Panel catalogue
  group. These panels display available Core runtime evidence; Core has no
  backend observation producer or physical memory provider.
- Migrated the exact legacy `core/runtime-*` panel identities to
  `workspace-diagnostics/runtime-*` when the module is registered. Layout
  migration preserves panel IDs, state, geometry, tab placement, selection
  channels, Events virtualization/scroll preferences, and surface presentation
  memory. Missing-module restore retains legacy identity for recovery. Templates
  migrate identity and geometry but continue to omit panel state.

### Architecture and compatibility

- Consolidated Core runtime services into one bootstrapped `WorkspaceRuntime`
  shared by the shell, timing, observation, resource-evidence, and selection
  services.
- Added opt-in Workspace virtual-list presentation primitives with deterministic
  geometry, overscan, dynamic row measurement, scroll requests, and a standalone
  development benchmark supporting up to 100,000 materialized records. This is
  a utility, not automatic virtualization or an application retention policy.
- Kept the adopted native-surface host experimental and Linux-specific; it does
  not expand Core's documented cross-platform support matrix.
- Kept source distribution distinct from local Tauri bundle capability. No
  binary feed, auto-installer, or automatic restart/update path is included.

### Fixes and hardening

- Hardened adopted native-surface occlusion and stale-window recovery, and
  release adopted surfaces during application shutdown.
- Separated the native-surface engine from its Tauri command boundary.
- Added relative geometry architecture and hardened panel interaction, wheel,
  and frame-font ownership contracts.
- Kept tab-order updates within canonical workspace state, preserving the
  active-tab reference.
- Preserved legacy appearance preferences and missing-panel recovery while
  migrating Diagnostics to its first-party module.

- Restored canvas grid visibility above gradient wallpapers with a
  noninteractive overlay, retaining the theme's border colour and configured
  grid spacing.
- Prevented ChronoGit's generic button styling from changing the Jarri logo
  background.
- Refined Settings control alignment, consistent input heights, and fixed
  numeric value-column geometry.

### Release candidate status and limitations

- Runtime diagnostics show React Profiler `actualDuration` for non-diagnostics
  panels, not wall-clock latency. Resource rows are explicit byte claims, not
  total process RAM or GPU memory. Empty registries indicate missing producers,
  not zero activity.
- Runtime Events history virtualization is user-selectable and persisted per
  panel; normal rendering remains the default. Other Core panels are not
  automatically virtualized.
- Clean-machine native build and desktop integration review remain release
  checks. Jarri-Distribution
  schema 2 has been independently verified for staging publications, but Core
  0.4.0 has not been published through it. A local commit or GitHub push does
  not create a publication event. No final release, tag, or binary publication
  is implied.

---

## v0.3.0 — Release Candidate (unreleased)

Workspace Core 0.3.0 promotes the mature generic Workspace behavior developed
across Workspace Lab into a reusable, domain-neutral Core.

The release remains **unreleased** until the current release candidate passes a
clean-machine Linux reproducibility test from public repository state.

### Added

- Semantic panel projection architecture with explicit truth, advisory,
  preflight, and temporal/replay boundaries.
- Workspace-owned panel frame behavior and generic frame controls.
- Surface presentation memory for reusable panel presentation state.
- Deterministic panel placement and panel-source-aware opening behavior.
- Logical whole-workspace screenshot capture.
- Tab-local logical canvas bounds, zoom, camera, and viewport state.
- Configurable spatial navigation behavior:
  - workspace zoom increment;
  - zoom anchor mode;
  - panel navigation alignment;
  - pan behavior.
- Workspace-native generic controls:
  - `WorkspaceSelect`;
  - `WorkspaceNumberInput`;
  - workspace-native colour selection.
- Theme and colour subsystem with semantic colour tokens and advanced overrides.
- Multiple theme presets, including ChronoGit, Graphite, and Pink Sparkle.
- Core-owned Image Viewer with local zoom/pan interaction.
- Core-owned Text Viewer.
- Core-owned native File Browser backed by Tauri filesystem operations.
- Native filesystem support for:
  - directory enumeration;
  - bounded recursive search;
  - cancellation;
  - rename;
  - delete;
  - folder creation;
  - copy/cut workflow;
  - bounded text and binary reads.
- Semantic file-type and icon classification.
- Content-aware text-resource detection for otherwise-unclassified and
  extensionless files.
- Preferred initial panel sizing for Text Viewer and Image Viewer resources.
- Regression guards preventing accidental reintroduction of native HTML number
  and select controls.

### Changed

- Workspace camera state is now explicit and tab-local rather than incidental
  scroll state.
- Ctrl+wheel workspace zoom and panel-navigation behavior are separated into
  explicit generic preferences.
- File Browser recursive search now originates from the directory currently
  being browsed.
- Clicking/navigating directories updates File Browser navigation state
  cognitively rather than leaving search rooted in an unrelated historic path.
- Recursive search results can be opened directly without requiring their
  parent directory to have been loaded into the directory cache first.
- Generic control presentation now follows Workspace theme tokens rather than
  unrelated browser/WebKit-native popup or spinner styling.
- Text and image resources derive preferred opening size from their content,
  while remaining bounded by the current logical Workspace.
- Very small images receive a practical minimum viewer presentation rather than
  opening as unusably tiny panels.
- Fresh resource preferred width/height takes precedence over unrelated
  type-level remembered width/height.
- Type-level presentation memory may still contribute appropriate placement
  information without becoming resource identity.
- File resource routing now distinguishes filename classification from observed
  content capability.
- Conventional text filenames remain cheap routing hints, while arbitrary
  unknown files may prove textual capability through bounded content probing.
- Text Viewer independently validates textual content before projection.
- Known image classification remains authoritative and cannot be overridden by
  an explicit text-viewer route.

### Fixed

- Native resize/maximize could previously corrupt logical camera position by
  publishing stale pre-resize scroll values against new viewport dimensions.
- Panel opening could inherit unrelated previous viewer geometry instead of
  respecting resource-derived preferred dimensions.
- Large and small text/image resources could therefore open with unsuitable
  geometry.
- File Browser search could remain tied to `/` or another historical root after
  the user navigated elsewhere.
- Recursive search results could be visible but not directly openable because
  selection resolution depended on directory-cache membership.
- Extensionless textual files could be rejected solely because their filenames
  were not included in the text-extension classifier.
- Arbitrary binary files could otherwise be vulnerable to lossy UTF-8 decoding
  semantics at the native text-read boundary.

### Architecture

0.3.0 establishes clearer separation between:

- workspace geometry and visual scale;
- logical camera state and native viewport size;
- panel instance identity and panel type;
- resource identity and presentation memory;
- filename semantics and content capability;
- panel-owned body content and Workspace-owned frame behavior;
- runtime/domain truth and persisted Workspace presentation.

Workspace Core remains deliberately smaller than Workspace Lab.

Application-specific runtimes, observatories, Git intelligence, emulation,
audio, AI orchestration, and other domain systems remain outside Core unless
they establish reusable Workspace substrate requirements.

A formal generic runtime lifecycle system such as Workspace Lab's
activate/suspend/dispose coordinator is **not** part of Core 0.3.0. Core has not
yet demonstrated sufficient generic need to promote that architecture.

### Verification

The 0.3.0 release-candidate campaign has been verified with:

- Core regression suite;
- TypeScript typecheck;
- production Vite build;
- native-number regression guard;
- native-select regression guard;
- `git diff --check`;
- manual native workspace zoom and pan;
- manual panel navigation alignment;
- manual Image Viewer local zoom;
- manual File Browser navigation and recursive search;
- manual preferred-size Text Viewer and Image Viewer opening;
- manual opening of arbitrary extensionless UTF-8 text;
- manual rejection of `/bin/ls` as a binary resource.

### Release Gate

Before the final `v0.3.0` tag, Workspace Core and Workspace Lab will be cloned
onto a separate Linux machine and built/run from public repository state.

The purpose of that test is to expose hidden development-machine assumptions
such as:

- undocumented native dependencies;
- absolute local paths;
- untracked required resources;
- implicit environment variables;
- local build/cache dependencies;
- undeclared runtime services;
- repository-to-repository path assumptions.

The clean machine is treated as authoritative evidence of reproducibility.

---

## v0.2.0 — Generic Workspace Substrate Sync

### Added

- Persistent workspace state restoration.
- Canvas movement/navigation improvements.
- Resource-opening contract infrastructure.
- Semantic file-link components.
- Improved panel frame behavior.
- Improved workspace canvas interaction.
- Safer layout persistence handling.

### Changed

- Minimized panels restore to moved positions correctly.
- Workspace state storage is separated cleanly between Core and Lab
  environments.
- Resource-aware navigation APIs were introduced for future module federation.

### Architecture

- Workspace Core became the reusable cognitive workspace substrate.
- Workspace Lab remained the experimental federation environment.

### Notes

This release synchronized stable generic infrastructure improvements from
Workspace Lab while excluding private/local Jarri integrations.
