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
  "version": "0.5.0",
  "releaseUrl": "https://example.invalid/releases/0.5.0"
}
```

`releaseUrl` is optional and, when supplied, must be HTTPS. Versions use Semantic Versioning. Failed HTTP/JSON/schema checks report `error`; a rejected request reports `offline` when the browser reports an offline connection and otherwise `error`. Successful checks update `lastSuccessfulCheck`.

This contract only reports status. It does not fetch Git data, change source files or Git state, install dependencies, build, or restart the application. Future UI can subscribe to `updateAwareness` from `src/bootstrap/updateAwareness.ts` and call `refresh()` on an explicit user action or controlled schedule.
