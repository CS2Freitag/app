import { VersionHistoryEntry, VersionManifest, compareVersions } from '../services/versionService';

export interface DisplayedChangelogItem extends VersionHistoryEntry {
  status: 'pending' | 'last_installed';
}

/**
 * Selects ONLY:
 * 1. All not-yet-installed updates (> installedVersion and <= latestVersion)
 * 2. The single most recently completed/installed update (<= installedVersion, preferring exact match)
 *
 * Prevents dumping the full historical log (e.g. 3.109 -> current) under "Was ist neu".
 */
export function selectRelevantChangelogEntries(
  manifest: VersionManifest | null | undefined,
  installedVersion: string,
  latestVersion: string,
  hasUpdate: boolean
): DisplayedChangelogItem[] {
  const rawHistory = Array.isArray(manifest?.history) ? [...manifest.history] : [];

  // Sort descending by version (newest first)
  const sortedHistory = rawHistory.sort((a, b) => compareVersions(b.version, a.version));

  const pendingEntries: DisplayedChangelogItem[] = hasUpdate
    ? sortedHistory
        .filter(
          (entry) =>
            compareVersions(entry.version, installedVersion) > 0 &&
            compareVersions(entry.version, latestVersion) <= 0
        )
        .map((entry) => ({ ...entry, status: 'pending' as const }))
    : [];

  // Fallback if manifest has top-level changes for latestVersion not yet listed in history
  if (
    hasUpdate &&
    pendingEntries.length === 0 &&
    manifest?.changes &&
    manifest.changes.length > 0 &&
    compareVersions(latestVersion, installedVersion) > 0
  ) {
    pendingEntries.push({
      version: latestVersion,
      releaseDate: manifest.releaseDate,
      title: manifest.title,
      changes: manifest.changes,
      status: 'pending',
    });
  }

  // Only the single most recently installed update (<= installedVersion)
  const exactInstalled = sortedHistory.find(
    (entry) => compareVersions(entry.version, installedVersion) === 0
  );
  const lastCompleted =
    exactInstalled ||
    sortedHistory.find((entry) => compareVersions(entry.version, installedVersion) <= 0);

  const result: DisplayedChangelogItem[] = [...pendingEntries];
  if (lastCompleted && !result.some((e) => e.version === lastCompleted.version)) {
    result.push({ ...lastCompleted, status: 'last_installed' });
  }

  return result;
}
