/**
 * CS2Freitag Version Management & Controlled App Update Service
 *
 * Rules:
 * - Version format: MAJOR.PATCH (e.g. 2.174)
 * - Minor updates (callout fixes, default dataset changes): PATCH increments (e.g. 174 -> 175)
 * - Major updates (major redesigns/features): MAJOR increments (e.g. 2 -> 3)
 * - Updates are ONLY applied when the user explicitly clicks "Update durchführen" / "Jetzt aktualisieren".
 * - Cloud-Sync and Autosave continue functioning continuously without interruption.
 */

import { useState, useEffect, useCallback } from 'react';

export const CURRENT_BUILD_VERSION = '3.119';
export const VERSION_STORAGE_KEY = 'cs2_installed_version';
export const PREVIOUS_VERSION_STORAGE_KEY = 'cs2_previous_version';
export const SIMULATED_VERSION_KEY = 'cs2_simulated_version';

export interface VersionHistoryEntry {
  version: string;
  releaseDate?: string;
  title?: string;
  changes: string[];
}

export interface VersionManifest {
  version: string;
  major: number;
  patch: number;
  releaseDate?: string;
  title?: string;
  description?: string;
  changes?: string[];
  history?: VersionHistoryEntry[];
}

/**
 * Parses and compares two version strings (e.g. "2.174" vs "2.175")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = (v1 || '0.0').replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = (v2 || '0.0').replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);

  const major1 = parts1[0] ?? 0;
  const patch1 = parts1[1] ?? 0;

  const major2 = parts2[0] ?? 0;
  const patch2 = parts2[1] ?? 0;

  if (major1 > major2) return 1;
  if (major1 < major2) return -1;
  if (patch1 > patch2) return 1;
  if (patch1 < patch2) return -1;
  return 0;
}

/**
 * Get installed app version stored on this device/browser
 */
export function getInstalledVersion(): string {
  if (typeof window === 'undefined') return CURRENT_BUILD_VERSION;
  try {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY)?.trim();
    if (stored && stored.length > 0) {
      // If the currently executing bundle is strictly newer than localStorage (e.g. initial SW migration
      // or hard browser cache bypass), sync localStorage to the actually running bundle version.
      if (compareVersions(CURRENT_BUILD_VERSION, stored) > 0) {
        localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_BUILD_VERSION);
        return CURRENT_BUILD_VERSION;
      }
      return stored;
    }
    // Initialize with current build version
    localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_BUILD_VERSION);
    return CURRENT_BUILD_VERSION;
  } catch {
    return CURRENT_BUILD_VERSION;
  }
}

/**
 * Save installed app version
 */
export function setInstalledVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch (e) {
    console.warn('Failed to save installed version in localStorage:', e);
  }
}

/**
 * Get previously installed version before the last manual update (if any)
 */
export function getPreviousVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PREVIOUS_VERSION_STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Fetch latest version manifest from server (public/version.json)
 */
export async function fetchRemoteVersion(): Promise<VersionManifest> {
  // Check if a test/simulated version is active in localStorage
  if (typeof window !== 'undefined') {
    const simulated = localStorage.getItem(SIMULATED_VERSION_KEY);
    if (simulated) {
      const parts = simulated.replace(/^v/, '').split('.');
      return {
        version: simulated,
        major: parseInt(parts[0], 10) || 2,
        patch: parseInt(parts[1], 10) || 175,
        releaseDate: new Date().toISOString().split('T')[0],
        title: `Update auf Version ${simulated}`,
        description: 'Neue Callout-Anpassungen und optimierter Standard-Datenbestand bereit zur Installation.',
        changes: [
          'Aktualisierte Callouts & Positionen',
          'Taktik-Verbesserungen',
          'Bereit zur sofortigen Übernahme'
        ]
      };
    }
  }

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = `${cleanBase}version.json?t=${Date.now()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (netErr) {
    // Fallback attempt to root /version.json
    try {
      response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
    } catch {
      throw netErr;
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch version manifest: ${response.status}`);
  }

  const data = (await response.json()) as VersionManifest;
  return data;
}

/**
 * Execute the app update ONLY when explicitly triggered by the user:
 * 1. Store the new version in localStorage
 * 2. Check for & promote any waiting prompt Service Worker via SKIP_WAITING
 * 3. Clear stale static/dev caches so fresh UI loads cleanly
 * 4. Reload cleanly to apply new assets
 */
export async function applyAppUpdate(newVersion?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  let waitingSwActivated = false;

  try {
    // Clear simulated version if any
    localStorage.removeItem(SIMULATED_VERSION_KEY);

    if (newVersion) {
      const prevInstalled = getInstalledVersion();
      if (prevInstalled && compareVersions(newVersion, prevInstalled) > 0) {
        localStorage.setItem(PREVIOUS_VERSION_STORAGE_KEY, prevInstalled);
      }
      setInstalledVersion(newVersion);
    }

    // Tell prompt service worker to check for new version and activate waiting worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});

          // If a new SW just started installing, wait briefly for it to reach 'installed'
          if (reg.installing && !reg.waiting) {
            await new Promise<void>((resolve) => {
              const installing = reg.installing;
              if (!installing) return resolve();
              const timer = window.setTimeout(resolve, 2500);
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' || installing.state === 'redundant') {
                  window.clearTimeout(timer);
                  resolve();
                }
              });
            });
          }

          if (reg.waiting) {
            await new Promise<void>((resolve) => {
              const timer = window.setTimeout(resolve, 2500);
              const onControllerChange = () => {
                window.clearTimeout(timer);
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                waitingSwActivated = true;
                resolve();
              };
              navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        }
      } catch (swErr) {
        console.warn('SW update error during update:', swErr);
      }
    }

    // Clear stale runtime/dev caches (keep map image cache and newly activated workbox precache)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => {
            if (
              name.includes('static') ||
              name.includes('resources') ||
              (!waitingSwActivated && name.startsWith('cs2-dev-app-'))
            ) {
              return caches.delete(name);
            }
            return Promise.resolve(true);
          })
        );
      } catch (cacheErr) {
        console.warn('Cache clear error during update:', cacheErr);
      }
    }
  } catch (err) {
    console.warn('Update preparation error:', err);
  } finally {
    // Perform clean reload to execute new version
    window.location.reload();
  }
}

/**
 * React hook to manage app version, update checking, and update execution
 */
export function useAppVersion() {
  const [installedVersion, setInstalledVer] = useState<string>(() => getInstalledVersion());
  const [previousVersion, setPreviousVer] = useState<string | null>(() => getPreviousVersion());
  const [latestVersion, setLatestVer] = useState<string>(() => getInstalledVersion());
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [versionManifest, setVersionManifest] = useState<VersionManifest | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const checkForUpdates = useCallback(async (isManual = false) => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      const manifest = await fetchRemoteVersion();
      setVersionManifest(manifest);
      setLatestVer(manifest.version);
      const curInstalled = getInstalledVersion();
      setInstalledVer(curInstalled);
      setPreviousVer(getPreviousVersion());

      const isNewer = compareVersions(manifest.version, curInstalled) > 0;
      setHasUpdate(isNewer);
      setLastChecked(Date.now());

      if (isManual) {
        if (isNewer) {
          setCheckMessage(`Neues Update gefunden: Version ${manifest.version}`);
        } else {
          setCheckMessage(`Die Version ist auf den neusten Stand (v${curInstalled})`);
        }
      }
    } catch (err) {
      console.warn('Version check error:', err);
      if (isManual) {
        const curInstalled = getInstalledVersion();
        setCheckMessage(`Die Version ist auf den neusten Stand (v${curInstalled})`);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check on initial load
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  const applyUpdateNow = useCallback(async () => {
    const target = latestVersion || versionManifest?.version || CURRENT_BUILD_VERSION;
    await applyAppUpdate(target);
  }, [latestVersion, versionManifest]);

  const simulateUpdateAvailable = useCallback((customVersion?: string) => {
    if (typeof window === 'undefined') return;
    const cur = getInstalledVersion();
    const parts = cur.replace(/^v/, '').split('.');
    const nextPatch = (parseInt(parts[1], 10) || 174) + 1;
    const nextVer = customVersion || `${parts[0] || 2}.${nextPatch}`;

    localStorage.setItem(SIMULATED_VERSION_KEY, nextVer);
    checkForUpdates(true);
  }, [checkForUpdates]);

  const resetSimulation = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SIMULATED_VERSION_KEY);
    checkForUpdates(true);
  }, [checkForUpdates]);

  return {
    installedVersion,
    previousVersion,
    latestVersion,
    hasUpdate,
    isChecking,
    lastChecked,
    versionManifest,
    checkMessage,
    checkForUpdates,
    applyUpdateNow,
    simulateUpdateAvailable,
    resetSimulation,
  };
}
