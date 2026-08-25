# Changelog

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
