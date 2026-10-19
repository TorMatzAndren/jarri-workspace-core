# Update awareness contract

Update awareness is runtime-only status. It is not part of saved workspace layouts, panel state, or workspace persistence.

## Provider boundary

`src/core/updateAwareness.ts` defines a typed provider descriptor, capabilities, state, status, and a refreshable observable service. Providers can report `checking`, `current`, `available`, `unavailable`, `offline`, or `error`. Capabilities make checking, installation, and restart behavior explicit. The Core source-release provider supports checks only; installation and restart are false.

The service does not prescribe how an application distributes updates. A derivative application can supply another provider without adding its distribution implementation to Core. A missing provider reports `unavailable`. Concurrent refreshes are generation-guarded so only the latest request can publish.

## Core source-release provider

`src/core/sourceReleaseUpdateProvider.ts` reads the running version and local repository facts from the existing `developer_status` Tauri command, then checks an explicitly configured metadata URL. Configure it with `VITE_WORKSPACE_CORE_RELEASE_METADATA_URL`. The URL must use HTTPS. No URL means no request and an `unavailable` result. Repository availability and working-tree cleanliness are included as context and do not determine whether a release is available.

The metadata document is JSON with this shape:

```json
{
  "schemaVersion": 1,
  "version": "1.2.3",
  "releaseUrl": "https://example.invalid/releases/1.2.3"
}
```

The values above are format examples only and do not announce a Core release.

`releaseUrl` is optional and, when supplied, must be HTTPS. Versions use Semantic Versioning. Failed HTTP/JSON/schema checks report `error`; a rejected request reports `offline` when the browser reports an offline connection and otherwise `error`. Successful checks update `lastSuccessfulCheck`.

This provider checks only the configured JSON document. It does not consume or
verify Jarri-Distribution's signed publication-event stream. Jarri-Distribution
schema 2 is the separate source-publication system: its signed, sequential,
immutable events are created by a publication operation, not by a local Core
commit or GitHub push. Core's Update Awareness UI does not currently integrate
with that event stream.

This contract only reports status. It does not fetch Git data, change source files or Git state, install dependencies, build, or restart the application.

## Current Core presentation

`src/panels/UpdateSettingsSection.tsx` subscribes to the runtime-only service
and exposes a **Check for updates** button. Core does not schedule a check
automatically. The shell's version indicator opens Settings at the Updates
section; it shows an availability marker only after a confirmed available
status. Settings displays the provider state and, when supplied by the metadata,
an external release-information link. There is no release-message body,
dismissible notification, or in-app update prompt in the current Core UI.

The 0.4.0 user-facing release copy lives in
[`docs/releases/0.4.0.md`](../releases/0.4.0.md). Once a release is genuinely
published, the configured metadata `releaseUrl` can point to its published
release page or notes. Until then, no release is advertised by this mechanism.
The metadata endpoint is deployment configuration, not a repository-local
announcement. The provider capabilities explicitly disable installation and
restart, and the UI preserves the existing Settings navigation behavior.
