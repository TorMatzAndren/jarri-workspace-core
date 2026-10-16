export type SettingsSection = "updates";

export type SettingsSectionNavigationSnapshot = {
  revision: number;
  requestedSection: SettingsSection | null;
};

let snapshot: SettingsSectionNavigationSnapshot = {
  revision: 0,
  requestedSection: null,
};
const listeners = new Set<() => void>();

export function getSettingsSectionNavigationSnapshot() {
  return snapshot;
}

export function subscribeSettingsSectionNavigation(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestSettingsSection(section: SettingsSection) {
  snapshot = { revision: snapshot.revision + 1, requestedSection: section };
  for (const listener of [...listeners]) listener();
}

export function consumeSettingsSectionRequest(revision: number) {
  if (snapshot.revision !== revision || snapshot.requestedSection === null) return;
  snapshot = { revision: snapshot.revision + 1, requestedSection: null };
  for (const listener of [...listeners]) listener();
}

export function openSettingsUpdates(openSettings: () => void) {
  requestSettingsSection("updates");
  openSettings();
}
