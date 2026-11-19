/**
 * Pure update-lock policy helpers and IndexedDB state bridge
 * shared conceptually between the window app and the Service Worker.
 *
 * Ensures an installed PWA or browser session NEVER auto-updates across
 * reloads, window closes/reopens, or background Service Worker checks
 * unless the user explicitly triggers "Update durchführen".
 */

export const LOCKED_SHELL_CACHE = 'cs2-locked-app-shell-v1';
export const MAP_IMAGE_CACHE = 'cs2-maps-cache-v3';
export const UPDATE_LOCK_DB_NAME = 'cs2-update-lock-db';
export const UPDATE_LOCK_STORE = 'meta';
export const UPDATE_AUTHORIZED_KEY = 'update_authorized';

/**
 * Determines whether a Service Worker install/activate lifecycle should
 * skip overwriting the locked app shell cache.
 */
export function shouldPreserveLockedShell(
  hasExistingLockedShell: boolean,
  isUpdateAuthorized: boolean
): boolean {
  return hasExistingLockedShell && !isUpdateAuthorized;
}

/**
 * Determines whether a cache storage bucket may be deleted during SW activate.
 * The locked app shell and offline map image caches must NEVER be deleted
 * during passive/automatic Service Worker activation.
 */
export function shouldDeleteCacheOnActivate(cacheName: string): boolean {
  if (!cacheName) return false;
  if (cacheName === LOCKED_SHELL_CACHE || cacheName === MAP_IMAGE_CACHE) {
    return false;
  }
  return (
    cacheName.startsWith('cs2-dev-app-') ||
    cacheName.startsWith('cs2-static-') ||
    cacheName.startsWith('workbox-precache-')
  );
}

function openUpdateLockDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB unavailable'));
    }
    const req = indexedDB.open(UPDATE_LOCK_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(UPDATE_LOCK_STORE)) {
        db.createObjectStore(UPDATE_LOCK_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open update lock DB'));
  });
}

export async function setUpdateAuthorized(authorized: boolean): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openUpdateLockDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(UPDATE_LOCK_STORE, 'readwrite');
      tx.objectStore(UPDATE_LOCK_STORE).put(Boolean(authorized), UPDATE_AUTHORIZED_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Could not persist update authorization flag:', err);
  }
}

export async function getUpdateAuthorized(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const db = await openUpdateLockDb();
    const value = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(UPDATE_LOCK_STORE, 'readonly');
      const req = tx.objectStore(UPDATE_LOCK_STORE).get(UPDATE_AUTHORIZED_KEY);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return false;
  }
}
