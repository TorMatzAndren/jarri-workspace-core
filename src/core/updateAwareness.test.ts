import { createCoreSourceReleaseProvider } from "./sourceReleaseUpdateProvider";
import type { DeveloperStatus } from "./developerStatus";
import { createUpdateAwarenessService } from "./updateAwareness";

function assertEqual<T>(actual: T, expected: T, message = "Values should match") {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertMatch(actual: string, pattern: RegExp, message = "Value should match") {
  if (!pattern.test(actual)) throw new Error(`${message}: ${actual}`);
}

const developerStatus: DeveloperStatus = {
  applicationVersion: "0.4.0",
  sourceRepository: {
    available: true,
    branch: "main",
    detachedHead: false,
    shortCommit: "abc1234",
    workingTreeClean: true,
    error: null,
  },
  releaseAvailability: {
    state: "notChecked",
    latestVersion: null,
    releaseUrl: null,
    checkedAt: null,
    error: null,
  },
};

function makeProvider(options: {
  metadataUrl?: string;
  developerStatus?: DeveloperStatus;
  fetchMetadata?: typeof fetch;
  isOffline?: () => boolean;
}) {
  return createCoreSourceReleaseProvider({
    metadataUrl: options.metadataUrl ?? "https://releases.example.test/core.json",
    getDeveloperStatus: async () => options.developerStatus ?? developerStatus,
    fetchMetadata: options.fetchMetadata,
    isOffline: options.isOffline,
    now: () => new Date("2026-01-02T03:04:05.000Z"),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const currentMetadata = { schemaVersion: 1, version: "0.4.0" };

{
  const result = await makeProvider({
    fetchMetadata: async () => jsonResponse(currentMetadata),
  }).check();
  assertEqual(result.state, "current");
  assertEqual(result.currentVersion, "0.4.0");
  assertEqual(result.availableVersion, "0.4.0");
  assertEqual(result.updateAvailable, false);
  assertEqual(result.lastSuccessfulCheck, "2026-01-02T03:04:05.000Z");
}

{
  const result = await makeProvider({
    fetchMetadata: async () =>
      jsonResponse({ schemaVersion: 1, version: "0.5.0", releaseUrl: "https://example.test/0.5.0" }),
  }).check();
  assertEqual(result.state, "available");
  assertEqual(result.updateAvailable, true);
  assertEqual(result.availableVersion, "0.5.0");
}

{
  let fetched = false;
  const result = await makeProvider({
    metadataUrl: "",
    fetchMetadata: async () => {
      fetched = true;
      return jsonResponse(currentMetadata);
    },
  }).check();
  assertEqual(result.state, "unavailable");
  assertEqual(fetched, false);
}

{
  const service = createUpdateAwarenessService(null);
  assertEqual(service.getSnapshot().status.state, "unavailable");
  assertEqual(service.getSnapshot().status.capabilities.checkForUpdates, false);
  await service.refresh();
  assertEqual(service.getSnapshot().status.providerId, "none");
}

{
  const result = await makeProvider({
    fetchMetadata: async () => {
      throw new TypeError("network disconnected");
    },
    isOffline: () => true,
  }).check();
  assertEqual(result.state, "offline");
}

{
  const result = await makeProvider({
    fetchMetadata: async () => jsonResponse({}, 503),
    isOffline: () => false,
  }).check();
  assertEqual(result.state, "error");
  assertMatch(result.message ?? "", /HTTP 503/);
}

{
  for (const body of [
    { schemaVersion: 2, version: "0.5.0" },
    { schemaVersion: 1, version: "not-semver" },
    { schemaVersion: 1, version: "0.5.0", releaseUrl: "javascript:alert(1)" },
  ]) {
    const result = await makeProvider({
      fetchMetadata: async () => jsonResponse(body),
    }).check();
    assertEqual(result.state, "error");
    assertMatch(result.message ?? "", /malformed/);
  }
}

{
  const modifiedStatus: DeveloperStatus = {
    ...developerStatus,
    sourceRepository: {
      ...developerStatus.sourceRepository,
      workingTreeClean: false,
    },
  };
  const missingGitStatus: DeveloperStatus = {
    ...developerStatus,
    sourceRepository: {
      available: false,
      branch: null,
      detachedHead: false,
      shortCommit: null,
      workingTreeClean: null,
      error: { code: "gitUnavailable", message: "Git is unavailable." },
    },
  };

  for (const status of [modifiedStatus, missingGitStatus]) {
    const result = await makeProvider({
      developerStatus: status,
      fetchMetadata: async () => jsonResponse({ schemaVersion: 1, version: "0.5.0" }),
    }).check();
    assertEqual(result.state, "available");
    assertEqual(result.updateAvailable, true);
  }
}

{
  let resolveFirst!: (value: ReturnType<typeof makeStatus>) => void;
  function makeStatus(version: string) {
    return {
      providerId: "test-provider",
      displayName: "Test provider",
      capabilities: { checkForUpdates: true, installUpdate: false, restartAfterUpdate: false },
      state: "current" as const,
      currentVersion: version,
      availableVersion: version,
      updateAvailable: false,
      lastSuccessfulCheck: null,
      releaseUrl: null,
      message: null,
    };
  }

  let checkCount = 0;
  const service = createUpdateAwarenessService({
    providerId: "test-provider",
    displayName: "Test provider",
    capabilities: { checkForUpdates: true, installUpdate: false, restartAfterUpdate: false },
    check: () => {
      checkCount += 1;
      if (checkCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(makeStatus("newer-result"));
    },
  });

  const first = service.refresh();
  const second = service.refresh();
  await second;
  resolveFirst(makeStatus("stale-result"));
  await first;
  assertEqual(service.getSnapshot().status.currentVersion, "newer-result");
  service.dispose();
}

console.log("Update-awareness tests passed.");
