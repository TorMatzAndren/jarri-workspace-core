# Workspace Core File Browser and Camera Resize Hardening

Date: 2026-08-25
Status: Implemented and verified

## Purpose

This campaign establishes the first native File Browser capability in Jarri
Workspace Core.

The goal is not to reproduce the Jarri Workspace Lab File Browser by importing
Lab or /opt/jarri ownership into Core. Core now owns a standalone filesystem
browser implementation with native Tauri filesystem operations and reusable
Workspace resource-opening semantics.

During native verification of the File Browser campaign, testing also exposed
and repaired a pre-existing Workspace camera lifecycle defect during native
window resize/maximize.

## Core File Browser

Workspace Core now registers a native `file-browser` panel.

The browser provides a filesystem-oriented Workspace surface including:

- absolute-path navigation;
- directory browsing;
- expandable directory-tree navigation;
- breadcrumbs;
- hidden-file visibility control;
- list/grid presentation;
- filesystem search;
- bounded recursive traversal;
- search cancellation;
- explicit incomplete/truncated search state;
- filesystem metadata projection;
- file-type icon classification;
- file selection;
- copy-path support;
- file and directory operations;
- text-file opening through Workspace resource semantics;
- a Core-owned text viewer;
- panel-state persistence required by the browser.

Filesystem authority remains native. The React panel presents filesystem state
and requests operations through the Core filesystem provider rather than
pretending that browser state itself is filesystem truth.

## Native Filesystem Boundary

The Tauri backend now owns Core filesystem operations required by the browser.

The native implementation includes directory enumeration, filesystem entry
description, bounded recursive search, cancellation, file operations and
bounded text reading.

Search deliberately exposes operational truth instead of presenting every
result set as necessarily exhaustive. Search results carry information about
result limits, traversal limits, skipped paths, cancellation and completeness.

Recursive search also avoids silently traversing filesystem mount boundaries.

This is a Core-native implementation. It does not require the `/opt/jarri`
Storage Watcher filesystem index in order to browse the filesystem.

That separation is intentional: Workspace Core must remain useful as a
standalone Workspace shell, while richer Jarri-specific observation and indexed
search capabilities may later be integrated through explicit subsystem
boundaries.

## Workspace Resource Integration

Filesystem files are opened through Workspace resource semantics rather than
through File Browser-specific frame ownership.

Text resources can therefore project into the Core text-viewer panel while the
File Browser remains responsible for filesystem interaction rather than owning
the lifetime or presentation contract of opened resources.

This preserves the existing Workspace rule that frames and projection
lifecycle belong to Workspace Core.

## File Semantics and Presentation

Core now contains reusable file classification/icon support rather than
embedding filename presentation rules directly in the File Browser panel.

The Add Panel surface was also hardened as part of exposing the new Core panel,
including grouped/collapsible module presentation.

The File Browser receives dedicated Core styling for its toolbar, controls,
tree, directory projection, breadcrumbs, selection state and grid/list
presentation.

## Camera Resize Failure

Native testing exposed a separate camera lifecycle defect.

The failure occurred when the native XFCE window changed viewport size,
especially when maximizing the window.

The persisted logical camera could correctly be:

    x = 0
    y = 0

while a resize caused the browser DOM to temporarily combine:

- the old viewport's scroll position; with
- the new viewport dimensions.

That transient combination was interpreted as user navigation and published
back into Workspace state.

In the reproduced 3440-pixel-wide maximized case this generated the synthetic
camera:

    x = -2200
    y = -516

The corrupted camera was then persisted, making a viewport lifecycle artifact
look like legitimate Workspace navigation.

## Camera Repair

Workspace camera restoration now distinguishes a viewport resize transition
from real user navigation.

Camera publication is suppressed while the measured viewport and current
viewport are inconsistent. Workspace first restores scroll for the existing
logical camera under the new viewport geometry and only then permits normal
scroll-to-camera publication again.

The repair preserves the architectural contract:

    persisted logical camera
        -> derive scroll for current viewport

rather than allowing:

    transient browser scroll during resize
        -> overwrite persisted logical camera

The repair applies to arbitrary logical camera positions, not only the default
origin.

## Verification

The campaign was verified with:

- TypeScript typecheck;
- Core test suite;
- native-select guard;
- native-number guard;
- production Vite build;
- Rust `cargo check`;
- `git diff --check`;
- native Tauri runtime testing.

Camera-specific tests reproduce the observed resize corruption mathematically
and verify preservation of both zero-origin and non-zero logical cameras.

Native lifecycle verification additionally covered:

1. clean persisted Workspace state;
2. normal Core startup;
3. native XFCE maximize/resize;
4. correct visual panel position after resize;
5. persisted camera remaining `{x: 0, y: 0}`;
6. process termination;
7. Core restart from persisted state;
8. correct restored Workspace position after restart.

## Architectural Boundary

This commit establishes a useful standalone Core File Browser, not the final
Jarri filesystem intelligence surface.

Future Jarri Workspace Lab work may combine Core's native browser capabilities
with Storage Watcher observation history, indexed search, filesystem knowledge,
provenance and other Jarri-specific intelligence.

Those capabilities should remain explicit integrations rather than hidden
dependencies of Workspace Core.

## Bounded Stopping Point

At this stopping point:

- Workspace Core has a native File Browser;
- Core can inspect and manipulate filesystem state without `/opt/jarri`;
- files can project into Core-owned resource viewers;
- file semantics/icons are reusable Core concepts;
- browser state participates in Workspace persistence;
- filesystem search is bounded and reports incomplete truth explicitly;
- the native maximize/resize camera corruption is repaired;
- camera state survives native restart correctly.

The next File Browser campaign can therefore build from a stable Core-owned
filesystem surface rather than continuing to extract behavior from Lab.
