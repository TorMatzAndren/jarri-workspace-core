# Documentation Index

This index identifies the repository's documentation and its intended use.
For current 0.4.0 behavior, use the README, release notes, architecture and
layout contracts, and the spatial workspace contract. The dated devlogs and
investigations preserve historical implementation context; their proposals,
verification results, and statements about what was not yet implemented apply
to the point in time described, not automatically to the current tree.

## Current visitor and release information

| Document | Purpose and current relevance |
| --- | --- |
| [MPL-2.0 license](../LICENSE) | Complete Mozilla Public License 2.0 text for covered Core source. It does not establish the license of every asset or dependency. |
| [README](../README.md) | First-time visitor overview, implemented features, prerequisites, development commands, limitations, and licensing status. |
| [Third-party notices](third-party-notices.md) | Known third-party attributions, dependency-license boundaries, bundled assets, and unresolved provenance questions. |
| [Contributing](../CONTRIBUTING.md) | Contribution and licensing guidance for changes and independent modules. |
| [CHANGELOG](../CHANGELOG.md) | Version-by-version implementation history; 0.4.0 remains an unpublished release candidate. |
| [0.4.0 release notes](releases/0.4.0.md) | User-facing summary, compatibility notes, limitations, source-update guidance, and explicitly planned work. |
| [Spatial Workspace Architecture](spatial-workspace.md) | Current geometry, Preserve Sizes, Organize Lock, persistence, and spatial validation behavior. |
| [Core Geometry Migration](core-geometry-migration.md) | Historical Frame Font and responsive-geometry migration record; not a general current feature list. |
| [Workspace Core demo image](workspace-core-demo.png) | Tracked visual illustration used by the README. |

## Architecture and behavior contracts

| Document | Purpose and current relevance |
| --- | --- |
| [000001 — Workspace Core Architecture](contracts/000001-workspace-core-architecture.md) | Workspace ownership boundaries, current runtime and module composition, native boundaries, and architectural doctrine. Distinguishes implemented Core services from extension contracts. |
| [000002 — Panel Contract](contracts/000002-panel-contract.md) | Panel identity, state, frame controls, panel/module boundaries, lifecycle, missing-panel behavior, and generic input contracts. |
| [000003 — Layout Persistence Contract](contracts/000003-layout-persistence-contract.md) | Current local layout persistence, normalization, signed geometry, identity migration, tab templates, Organize Lock, and presentation-memory boundaries. |
| [000004 — Update Awareness Contract](contracts/000004-update-awareness-contract.md) | Source-release metadata checks; no source checkout update, binary installation, or restart. |
| [000005 — Panel Lifecycle Contract](contracts/000005-panel-lifecycle-contract.md) | Runtime-only observational lifecycle coordinator and the policies it does not execute. |

## Engineering records

### Devlogs

These records explain implementation campaigns and selected design choices.
Later work may supersede their statements about the current state.

| Document | Historical subject |
| --- | --- |
| [000001 — Semantic Frame Architecture](devlog/000001-semantic-frame-architecture.md) | Semantic projections, frame capabilities, and the initial Core boundary. |
| [000002 — Settings Presentation Memory and Placement](devlog/000002-settings-presentation-memory-and-placement.md) | Settings presentation memory and deterministic panel placement. |
| [000003 — Logical Workspace Screenshot](devlog/000003-logical-workspace-screenshot.md) | Logical-canvas and frame screenshot ownership and native capture path. |
| [000004 — Tab-Local Canvas Viewport](devlog/000004-tab-local-canvas-viewport.md) | Canvas viewport ownership and tab-local presentation. |
| [000005 — Theme and Colour Subsystem](devlog/000005-theme-and-colour-subsystem.md) | Theme tokens, presets, colour controls, and appearance behavior. |
| [000006 — Camera State Foundation](devlog/000006-camera-state-foundation.md) | Initial persisted camera model; its deferred-runtime statements are superseded by later spatial-navigation work. |
| [000007 — Spatial Navigation and Generic Media Controls](devlog/000007-spatial-navigation-and-generic-media-controls.md) | Camera/navigation controls, generic inputs, and Image Viewer promotion; its pre-File-Browser statements are historical. |
| [000008 — Core File Browser and Camera Resize Hardening](devlog/000008-core-file-browser-and-camera-resize-hardening.md) | Core-owned filesystem browser and canvas/camera resize hardening. |
| [000009 — Panel Lifecycle Coordinator](devlog/000009-panel-lifecycle-coordinator.md) | Runtime-owned observational lifecycle coordination and limits. |

### Investigations

These are audit snapshots, risk reviews, or hardening records. Recommendations
in them are not a current roadmap unless repeated by the release notes or a
current contract.

| Document | Historical subject |
| --- | --- |
| [000001 — Workspace Core Source Audit](investigations/000001-workspace-core-source-audit.md) | Early source comparison and Core foundations; includes a 0.4.0 source-reality addendum. |
| [000002 — Workspace Core Entropy Risks](investigations/000002-workspace-core-entropy-risks.md) | Initial coupling and architecture risk assessment. |
| [000003 — Workspace Core Structural Hardening](investigations/000003-workspace-core-structural-hardening.md) | Early module/runtime and structural hardening. |
| [000004 — Panel Menu, Grid, and Settings Hardening](investigations/000004-workspace-core-panel-menu-grid-settings.md) | Panel catalogue and settings hardening at that checkpoint. |
| [000005 — Theme and Panel Menu Arrangement](investigations/000005-workspace-core-theme-and-panel-menu-arrangement.md) | Appearance and catalogue arrangement investigation. |
| [000006 — Panel Lifecycle, Smart Fill, and Bug Investigation](investigations/000006-workspace-core-panel-lifecycle-smart-fill-bugs.md) | Pre-lifecycle implementation risk review; its proposed blockers were evaluated by later work. |
| [000007 — Geometry and Scale Hardening](investigations/000007-workspace-core-geometry-scale-hardening.md) | Earlier geometry hardening review; some present-tense status and tracked-build observations have since changed. |
| [000008 — Manual UX Hardening](investigations/000008-workspace-core-manual-ux-hardening.md) | Earlier settings, tabs, themes, and templates usability pass. |

## Repository metadata coverage

The repository now includes the complete MPL-2.0 license and first-party
package metadata uses `MPL-2.0`. It has no `SECURITY`, code-of-conduct,
GitHub issue/PR templates, or GitHub workflow files. The repository does not
define a verified cross-platform support matrix. Third-party asset provenance
and licensing questions are recorded in the notices document.
