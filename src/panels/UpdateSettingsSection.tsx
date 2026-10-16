import { useEffect, useState } from "react";
import { updateAwareness } from "../bootstrap/updateAwareness";
import type { DeveloperStatus } from "../core/developerStatus";
import { getInitialDeveloperStatus } from "../core/developerStatusApi";
import {
  hasConfirmedUpdate,
  repositoryStatusDetail,
  repositoryStatusLabel,
  updateStateLabel,
} from "../core/updatePresentation";

export function UpdateSettingsSection() {
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
        if (mounted) setDeveloperStatusFailed(true);
      });
    const unsubscribe = updateAwareness.subscribe(() => {
      setUpdateStatus(updateAwareness.getSnapshot().status);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const repository = developerStatus?.sourceRepository ?? null;
  const repositoryLabel = developerStatusFailed
    ? "Repository unavailable"
    : repositoryStatusLabel(repository);
  const repositoryDetail = developerStatusFailed
    ? "Local developer status is unavailable in this environment."
    : repositoryStatusDetail(repository);
  const version = developerStatus?.applicationVersion ?? updateStatus.currentVersion;
  const updateConfirmed = hasConfirmedUpdate(updateStatus);
  const checking = updateStatus.state === "checking";

  return (
    <section
      id="settings-updates-section"
      className="settings-panel__section settings-panel__section--updates"
      aria-labelledby="settings-updates-heading"
    >
      <h3 id="settings-updates-heading">Updates</h3>
      <div className="settings-update-summary">
        <div>
          <span className="settings-update-summary__label">Running version</span>
          <strong>{version ?? (developerStatusFailed ? "Unavailable in this environment" : "Loading…")}</strong>
        </div>
        <div>
          <span className="settings-update-summary__label">Source repository</span>
          <strong>{repositoryLabel}</strong>
          <small>{repositoryDetail}</small>
        </div>
        <div>
          <span className="settings-update-summary__label">Update provider</span>
          <strong>{updateStatus.displayName}</strong>
          <small>{updateStatus.providerId}</small>
        </div>
        <div>
          <span className="settings-update-summary__label">Release status</span>
          <strong role="status" aria-live="polite">{updateStateLabel(updateStatus)}</strong>
          {updateStatus.availableVersion ? (
            <small>
              Latest release: {updateStatus.availableVersion}
              {updateStatus.releaseUrl ? (
                <> · <a href={updateStatus.releaseUrl} target="_blank" rel="noreferrer">Release information</a></>
              ) : null}
            </small>
          ) : null}
          {updateStatus.message && updateStatus.state !== "current" && updateStatus.state !== "available" ? (
            <small>{updateStatus.message}</small>
          ) : null}
        </div>
        <div>
          <span className="settings-update-summary__label">Last successful check</span>
          <strong>
            {updateStatus.lastSuccessfulCheck
              ? new Date(updateStatus.lastSuccessfulCheck).toLocaleString()
              : "Never"}
          </strong>
        </div>
      </div>
      <div className="settings-update-actions">
        <button
          type="button"
          disabled={checking || !updateStatus.capabilities.checkForUpdates}
          onClick={() => void updateAwareness.refresh()}
        >
          {checking ? "Checking…" : "Check for updates"}
        </button>
        {updateConfirmed ? <span role="status">A newer release is available.</span> : null}
      </div>
    </section>
  );
}
