# Changelog

## v0.2.0 — Generic Workspace Substrate Sync

### Added
- Persistent workspace state restoration
- Canvas movement/navigation improvements
- Resource-opening contract infrastructure
- Semantic file-link components
- Improved panel frame behavior
- Improved workspace canvas interaction
- Safer layout persistence handling

### Changed
- Minimized panels now restore to moved positions correctly
- Workspace state storage separated cleanly between Core/Lab environments
- Resource-aware navigation APIs introduced for future module federation

### Architecture
- Workspace Core now acts as a reusable cognitive workspace substrate
- Workspace Lab continues as the experimental federation environment

### Notes
This release syncs stable generic infrastructure improvements from Workspace Lab while excluding private/local Jarri integrations.

## 2026-08-25 — Native File Browser and camera resize hardening

- Added the first Core-owned native File Browser and filesystem provider.
- Added native directory enumeration, bounded recursive search, cancellation,
  filesystem operations and bounded text reading through Tauri.
- Added reusable file-type/icon classification and Core text-resource viewing.
- Added File Browser panel persistence and Workspace resource integration.
- Hardened Add Panel presentation for the expanded Core panel catalog.
- Fixed native resize/maximize camera corruption caused by publishing stale
  pre-resize scroll against new viewport dimensions.
- Added deterministic camera tests reproducing the observed `(-2200, -516)`
  synthetic camera failure and verifying resize preservation of arbitrary
  logical camera positions.
