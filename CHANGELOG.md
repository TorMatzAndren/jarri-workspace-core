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
