import type { DeveloperStatusRepository } from "./developerStatus";
import type { UpdateProviderStatus } from "./updateAwareness";

export function repositoryStatusLabel(
  repository: DeveloperStatusRepository | null,
): string {
  if (!repository) return "Checking source repository";
  if (!repository.available) return "Repository unavailable";
  if (repository.detachedHead) return "Detached HEAD";
  if (repository.workingTreeClean === false) return "Modified working tree";
  if (repository.workingTreeClean === true) return "Clean working tree";
  return "Working-tree status unavailable";
}

export function repositoryStatusDetail(
  repository: DeveloperStatusRepository | null,
): string {
  if (!repository) return "Local source status has not loaded.";
  if (!repository.available) {
    return repository.error?.message ?? "Git repository metadata is unavailable.";
  }
  const commit = repository.shortCommit ? repository.shortCommit : "commit unknown";
  const ref = repository.detachedHead
    ? `Detached at ${commit}`
    : `${repository.branch ?? "Branch unknown"} · ${commit}`;
  const state = repositoryStatusLabel(repository);
  return `${ref} · ${state}`;
}

export function repositoryStatusCompact(
  repository: DeveloperStatusRepository | null,
): string {
  if (!repository) return "Git…";
  if (!repository.available) return "Git unavailable";
  const commit = repository.shortCommit ?? "?";
  const worktree = repository.workingTreeClean === true
    ? "✓"
    : repository.workingTreeClean === false
      ? "*"
      : "?";
  const ref = repository.detachedHead ? "HEAD" : repository.branch ?? "branch?";
  return `${ref} ${worktree} · ${commit}`;
}

export function updateStateLabel<Context>(status: UpdateProviderStatus<Context>): string {
  if (
    status.state === "unavailable" &&
    status.capabilities.checkForUpdates &&
    status.message === "Update status has not been checked."
  ) {
    return "Not checked";
  }
  switch (status.state) {
    case "checking":
      return "Checking for updates";
    case "current":
      return "Up to date";
    case "available":
      return "Update available";
    case "unavailable":
      return "Not configured";
    case "offline":
      return "Offline";
    case "error":
      return "Check failed";
  }
}

export function hasConfirmedUpdate<Context>(status: UpdateProviderStatus<Context>): boolean {
  return status.state === "available" && status.updateAvailable === true;
}
