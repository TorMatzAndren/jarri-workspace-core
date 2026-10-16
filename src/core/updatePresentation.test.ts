import {
  hasConfirmedUpdate,
  repositoryStatusCompact,
  repositoryStatusDetail,
  repositoryStatusLabel,
  updateStateLabel,
} from "./updatePresentation";
import { openSettingsUpdates } from "./settingsSectionNavigation";
import { createUpdateAwarenessService } from "./updateAwareness";
import type { UpdateProviderStatus } from "./updateAwareness";

function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const descriptor = {
  providerId: "test-provider",
  displayName: "Test releases",
  capabilities: { checkForUpdates: true, installUpdate: false, restartAfterUpdate: false },
};

const status = (state: UpdateProviderStatus["state"], values: Partial<UpdateProviderStatus> = {}): UpdateProviderStatus => ({
  ...descriptor,
  state,
  currentVersion: "0.4.0",
  availableVersion: null,
  updateAvailable: null,
  lastSuccessfulCheck: null,
  releaseUrl: null,
  message: null,
  ...values,
});

{
  equal(updateStateLabel(status("checking")), "Checking for updates", "checking label");
  equal(updateStateLabel(status("current")), "Up to date", "current label");
  equal(updateStateLabel(status("available")), "Update available", "available label");
  equal(updateStateLabel(status("offline")), "Offline", "offline label");
  equal(updateStateLabel(status("error")), "Check failed", "error label");
  equal(
    updateStateLabel(status("unavailable", { message: "Update status has not been checked." })),
    "Not checked",
    "unverified status is not shown as current",
  );
  equal(
    updateStateLabel(status("unavailable", { message: "No source release metadata URL is configured." })),
    "Not configured",
    "missing configuration label",
  );
  equal(hasConfirmedUpdate(status("available", { updateAvailable: true })), true, "confirmed release badge");
  equal(hasConfirmedUpdate(status("error", { updateAvailable: true })), false, "error is not a release badge");
}

{
  const repository = {
    available: true,
    branch: "main",
    detachedHead: false,
    shortCommit: "12ab34cd",
    workingTreeClean: false,
    error: null,
  };
  equal(repositoryStatusLabel(repository), "Modified working tree", "dirty repository label");
  equal(repositoryStatusDetail(repository), "main · 12ab34cd · Modified working tree", "branch and commit detail");
  equal(repositoryStatusCompact(repository), "main * · 12ab34cd", "compact dirty title-bar status");
  equal(repositoryStatusLabel({ ...repository, detachedHead: true }), "Detached HEAD", "detached repository label");
  equal(repositoryStatusCompact({ ...repository, detachedHead: true, workingTreeClean: true }), "HEAD ✓ · 12ab34cd", "compact detached title-bar status");
  equal(repositoryStatusLabel({ ...repository, available: false }), "Repository unavailable", "missing repository label");
}

{
  let resolveCheck!: (result: UpdateProviderStatus) => void;
  let checks = 0;
  const service = createUpdateAwarenessService({
    ...descriptor,
    check: () => {
      checks += 1;
      return new Promise((resolve) => { resolveCheck = resolve; });
    },
  });
  let notifications = 0;
  const unsubscribe = service.subscribe(() => { notifications += 1; });
  const refresh = service.refresh();
  equal(checks, 1, "refresh invokes provider once");
  equal(service.getSnapshot().status.state, "checking", "refresh publishes checking state");
  resolveCheck(status("current", { lastSuccessfulCheck: "2026-01-01T00:00:00.000Z" }));
  await refresh;
  equal(service.getSnapshot().status.state, "current", "refresh publishes provider result");
  const countBeforeCleanup = notifications;
  unsubscribe();
  const secondRefresh = service.refresh();
  resolveCheck(status("current"));
  await secondRefresh;
  equal(notifications, countBeforeCleanup, "unsubscribed consumer receives no more updates");
  service.dispose();
}

{
  let opened = false;
  openSettingsUpdates(() => { opened = true; });
  equal(opened, true, "title-bar interaction opens Settings");
}

console.log("Update presentation and Settings navigation tests passed.");
