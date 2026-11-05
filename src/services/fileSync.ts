import { MapData, Theme, Language } from '../types';

export interface BackupPayload {
  type: string;
  version: number;
  exportedAt: string;
  app: string;
  settings: {
    theme: Theme;
    lang: Language;
    favorites: string[];
  };
  maps: MapData[];
}

const DB_NAME = 'cs2freitag_fs_db';
const DB_VERSION = 1;
const STORE_NAME = 'file_handles';
const HANDLE_KEY = 'autosave_handle';

const AUTOSAVE_SETTINGS_KEY = 'cs2freitag_autosave_enabled_v1';
const AUTOSAVE_FILENAME_KEY = 'cs2freitag_autosave_filename_v1';
const AUTOSAVE_TIMESTAMP_KEY = 'cs2freitag_autosave_last_ts_v1';

// Open or create IndexedDB store for structured cloning of FileSystemFileHandle
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTOSAVE_FILENAME_KEY, handle.name);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to store FileSystemFileHandle in IndexedDB:', err);
  }
}

export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function removeStoredFileHandle(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(AUTOSAVE_FILENAME_KEY);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete file handle from IndexedDB:', err);
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export function loadAutosaveEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(AUTOSAVE_SETTINGS_KEY);
  return val !== null ? val === 'true' : true; // Enabled by default
}

export function saveAutosaveEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTOSAVE_SETTINGS_KEY, String(enabled));
  }
}

export function loadAutosaveFilename(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(AUTOSAVE_FILENAME_KEY) || '';
}

export function loadLastAutosaveTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(AUTOSAVE_TIMESTAMP_KEY);
  return raw ? Number(raw) : 0;
}

export function saveLastAutosaveTimestamp(ts: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTOSAVE_TIMESTAMP_KEY, String(ts));
  }
}

export function createBackupPayload(
  maps: MapData[],
  settings: { theme: Theme; lang: Language; favorites: string[] }
): BackupPayload {
  return {
    type: 'cs2freitag_full_backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'CS2Freitag',
    settings,
    maps,
  };
}

export async function pickSaveFileLocation(): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'cs2freitag_backup.json',
      types: [
        {
          description: 'CS2Freitag Backup JSON',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });
    if (handle) {
      await storeFileHandle(handle);
    }
    return handle;
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Error picking save file:', err);
    }
    return null;
  }
}

export async function pickOpenFileLocation(): Promise<{ handle: FileSystemFileHandle; data: BackupPayload } | null> {
  if (typeof window === 'undefined' || !('showOpenFilePicker' in window)) return null;
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'CS2Freitag Backup JSON',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
      multiple: false,
    });
    if (!handle) return null;
    await storeFileHandle(handle);
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text) as BackupPayload;
    return { handle, data };
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Error opening file:', err);
    }
    return null;
  }
}

export async function writeBackupToFile(
  handle: FileSystemFileHandle,
  payload: BackupPayload
): Promise<boolean> {
  try {
    // Check or request permission if needed
    const query = await (handle as any).queryPermission?.({ mode: 'readwrite' });
    if (query !== 'granted') {
      const request = await (handle as any).requestPermission?.({ mode: 'readwrite' });
      if (request !== 'granted') {
        return false;
      }
    }

    const writable = await (handle as any).createWritable();
    const jsonString = JSON.stringify(payload, null, 2);
    await writable.write(jsonString);
    await writable.close();
    saveLastAutosaveTimestamp(Date.now());
    return true;
  } catch (err) {
    console.warn('Failed to write backup to file handle:', err);
    return false;
  }
}

export async function readBackupFromFile(handle: FileSystemFileHandle): Promise<BackupPayload | null> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as BackupPayload;
  } catch (err) {
    console.warn('Failed to read from file handle:', err);
    return null;
  }
}

// Fallback manual download when File System Access is not supported or not connected
export function downloadBackupJsonFile(payload: BackupPayload, filename?: string): void {
  try {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `cs2freitag_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    saveLastAutosaveTimestamp(Date.now());
  } catch (err) {
    console.error('Failed to trigger manual backup download:', err);
  }
}
