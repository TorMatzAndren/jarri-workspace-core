import { useEffect, useState } from "react";
import type { DeveloperStatus } from "../core/developerStatus";
import { getInitialDeveloperStatus } from "../core/developerStatusApi";
import { updateAwareness } from "../bootstrap/updateAwareness";
import { openSettingsUpdates } from "../core/settingsSectionNavigation";
import {
  hasConfirmedUpdate,
  repositoryStatusCompact,
  repositoryStatusDetail,
} from "../core/updatePresentation";

type DeveloperVersionIndicatorProps = {
  openSettings: () => void;
};

export function DeveloperVersionIndicator({
  openSettings,
}: DeveloperVersionIndicatorProps) {
  const [developerStatus, setDeveloperStatus] = useState<DeveloperStatus | null>(null);
  const [developerStatusFailed, setDeveloperStatusFailed] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(() =>
    updateAwareness.getSnapshot().status,
  );

  useEffect(() => {
    let mounted = true;
    void getInitialDeveloperStatus()
      .then((status) => {
        if (mounted) setDeveloperStatus(status);
      })
      .catch(() => {
        if (mounted) {
          setDeveloperStatus(null);
          setDeveloperStatusFailed(true);
        }
      });
    const unsubscribe = updateAwareness.subscribe(() => {
      setUpdateStatus(updateAwareness.getSnapshot().status);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const version = developerStatus?.applicationVersion ?? "Version unavailable";
  const repoDetail = developerStatusFailed
    ? "Git status unavailable"
    : repositoryStatusDetail(developerStatus?.sourceRepository ?? null);
  const updateAvailable = hasConfirmedUpdate(updateStatus);

  return (
    <button
      type="button"
      className="workspace-shell__developer-status"
      aria-label={`Open Settings Updates. ${version}. ${repoDetail}${updateAvailable ? ". Update available" : ""}`}
      title={`${version} · ${repoDetail}${updateAvailable ? " · Update available" : ""}`}
      onClick={() => openSettingsUpdates(openSettings)}
    >
      <span className="workspace-shell__developer-version">{version}</span>
      <span className="workspace-shell__developer-git">
        {developerStatusFailed
          ? "Git unavailable"
          : repositoryStatusCompact(developerStatus?.sourceRepository ?? null)}
      </span>
      {updateAvailable ? <span className="workspace-shell__update-dot" aria-label="Update available" /> : null}
    </button>
  );
}
