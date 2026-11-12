import React, { useState, useEffect, useRef } from 'react';
import {
  loadStoredMaps,
  saveStoredMaps,
  loadFavorites,
  saveFavorites,
  loadTheme,
  saveTheme,
  loadLanguage,
  saveLanguage,
  loadCustomGroups,
  saveCustomGroups,
  resetToDefaults,
  saveDeletedMapId,
} from './services/storage';
import { MapData, Theme, Language } from './types';
import { Header } from './components/Header';
import { FavoritesSection } from './components/FavoritesSection';
import { SearchBar } from './components/SearchBar';
import { MapGrid } from './components/MapGrid';
import { MapEditorModal } from './components/MapEditorModal';
import { TacticalMapView } from './components/TacticalMapView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsModal } from './components/SettingsModal';
import { CalloutQuizModal } from './components/CalloutQuizModal';
import { MapImportConflictModal } from './components/MapImportConflictModal';
import { ShareTacticModal } from './components/ShareTacticModal';
import { ExternalLink, ArrowUp, Check, Save } from 'lucide-react';
import JSZip from 'jszip';
import LZString from 'lz-string';
import { decodeCompactTactic } from './utils/tacticCodec';
import { 
  auth, 
  loginWithGoogle, 
  logout, 
  syncUserSettings, 
  syncUserMap, 
  deleteUserMapSync, 
  loadUserCloudData 
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  isFileSystemAccessSupported,
  loadAutosaveEnabled,
  saveAutosaveEnabled,
  loadAutoCloudSyncEnabled,
  saveAutoCloudSyncEnabled,
  loadAutosaveFilename,
  loadLastAutosaveTimestamp,
  saveLastAutosaveTimestamp,
  getStoredFileHandle,
  removeStoredFileHandle,
  pickSaveFileLocation,
  pickOpenFileLocation,
  writeBackupToFile,
  readBackupFromFile,
  downloadBackupJsonFile,
  createBackupPayload,
} from './services/fileSync';

export default function App() {
  // Theme & Language
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [lang, setLang] = useState<Language>(() => loadLanguage());

  // Maps & Favorites
  const [maps, setMaps] = useState<MapData[]>(() => loadStoredMaps());
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null);
  const [highlightedCalloutId, setHighlightedCalloutId] = useState<string | undefined>(undefined);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [mapToEdit, setMapToEdit] = useState<MapData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isGlobalLoadTacticOpen, setIsGlobalLoadTacticOpen] = useState<boolean>(false);

  // Custom Map Groups / Pools
  const [customGroups, setCustomGroups] = useState<string[]>(() => loadCustomGroups());

  // Single Map Import Conflict State
  const [isConflictOpen, setIsConflictOpen] = useState<boolean>(false);
  const [conflictIncomingMap, setConflictIncomingMap] = useState<MapData | null>(null);
  const [conflictExistingMap, setConflictExistingMap] = useState<MapData | null>(null);

  // Incoming Shared Tactic Notification State
  const [sharedTacticNotification, setSharedTacticNotification] = useState<{
    tacticMap: MapData;
    tacticTitle: string;
  } | null>(null);

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);

  // Autosave & File System Access State
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState<boolean>(() => loadAutosaveEnabled());
  const [isAutoCloudSyncEnabled, setIsAutoCloudSyncEnabled] = useState<boolean>(() => loadAutoCloudSyncEnabled());
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [connectedFileName, setConnectedFileName] = useState<string>(() => loadAutosaveFilename());
  const [lastAutosaveTs, setLastAutosaveTs] = useState<number>(() => loadLastAutosaveTimestamp());
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);

  const handleToggleAutoCloudSync = () => {
    setIsAutoCloudSyncEnabled((prev) => {
      const next = !prev;
      saveAutoCloudSyncEnabled(next);
      return next;
    });
  };

  // Retrieve stored FileSystemFileHandle on startup and auto-sync latest data from file
  useEffect(() => {
    if (isFileSystemAccessSupported()) {
      getStoredFileHandle().then(async (handle) => {
        if (handle) {
          setFileHandle(handle);
          setConnectedFileName(handle.name);
          try {
            // Check if read permission is already granted from previous session
            const perm = await (handle as any).queryPermission?.({ mode: 'read' });
            if (perm === 'granted') {
              const payload = await readBackupFromFile(handle);
              if (payload && Array.isArray(payload.maps) && payload.maps.length > 0) {
                parseAndApplyBackup(JSON.stringify(payload), true);
                console.log('Autosave: Automatically synced data from connected file on startup.');
              }
            }
          } catch (e) {
            console.warn('Auto-sync from file on startup skipped:', e);
          }
        }
      });
    }
  }, []);

  // Parse shared tactic from URL hash on app start (e.g. #tactic=... or #t=...)
  useEffect(() => {
    const parseUrlHashTactic = () => {
      const hash = window.location.hash;
      if (!hash) return;

      const prefixMatch = hash.match(/^#(?:tactic|t)=(.+)$/);
      if (!prefixMatch || !prefixMatch[1]) return;

      try {
        const decoded = decodeCompactTactic(prefixMatch[1]);
        if (!decoded) return;

        const targetMapId = decoded.mapId;
        const baseMap = maps.find((m) => m.id === targetMapId || m.name.toLowerCase() === (decoded.name || '').toLowerCase()) || maps[0];

        if (baseMap) {
          const tacticTitle = decoded.name || `${baseMap.name} - Taktik`;
          const tacticMapInstance: MapData = {
            ...baseMap,
            id: `shared_temp_${Date.now()}`,
            name: `${baseMap.name} - ${tacticTitle}`,
            isCustomTactic: true,
            baseMapId: baseMap.id,
            tacticData: {
              drawings: decoded.drawings,
              utilities: decoded.utilities,
              players: decoded.players,
            },
          };

          // Open directly into tactical map view
          setSelectedMap(tacticMapInstance);
          setSharedTacticNotification({
            tacticMap: tacticMapInstance,
            tacticTitle,
          });

          // Clean hash from browser URL without reloading
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (err) {
        console.warn('Could not parse shared tactic from URL hash:', err);
      }
    };

    parseUrlHashTactic();
  }, [maps]);

  // Debounced Autosave effect whenever maps, favorites, theme, or lang changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isAutosaveEnabled) return;

    if (fileHandle) {
      const timer = setTimeout(async () => {
        try {
          setIsAutosaving(true);
          const payload = createBackupPayload(maps, { theme, lang, favorites });
          const ok = await writeBackupToFile(fileHandle, payload);
          if (ok) {
            setLastAutosaveTs(Date.now());
          }
        } catch (e) {
          console.warn('Autosave to file error:', e);
        } finally {
          setIsAutosaving(false);
        }
      }, 1500);

    }
  }, [maps, favorites, theme, lang, isAutosaveEnabled, fileHandle]);

  // Scroll to Top state & listener
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Monitor Auth State & Auto-sync latest cloud data on startup / sign-in (if enabled)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && loadAutoCloudSyncEnabled()) {
        try {
          const { cloudMaps, cloudSettings } = await loadUserCloudData(u.uid);

          if (cloudSettings) {
            if (cloudSettings.lang) {
              setLang(cloudSettings.lang);
              saveLanguage(cloudSettings.lang);
            }
            if (Array.isArray(cloudSettings.favorites)) {
              setFavorites(cloudSettings.favorites);
              saveFavorites(cloudSettings.favorites);
            }
          }

          if (cloudMaps && cloudMaps.length > 0) {
            setMaps(cloudMaps);
            saveStoredMaps(cloudMaps);
          }
        } catch (err) {
          console.warn('Auto cloud sync on startup/login failed or offline:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await loginWithGoogle();
      if (res?.user && loadAutoCloudSyncEnabled()) {
        try {
          const { cloudMaps, cloudSettings } = await loadUserCloudData(res.user.uid);
          if (cloudSettings) {
            if (cloudSettings.lang) {
              setLang(cloudSettings.lang);
              saveLanguage(cloudSettings.lang);
            }
            if (Array.isArray(cloudSettings.favorites)) {
              setFavorites(cloudSettings.favorites);
              saveFavorites(cloudSettings.favorites);
            }
          }
          if (cloudMaps && cloudMaps.length > 0) {
            setMaps(cloudMaps);
            saveStoredMaps(cloudMaps);
          }
        } catch (e) {
          console.warn('Initial download after login error:', e);
        }
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorCode = err?.code || 'unknown';
      const errorMessage = err?.message || (lang === 'de' ? 'Unbekannter Fehler' : 'Unknown error');
      alert((lang === 'de' ? 'Anmeldung fehlgeschlagen!\nCode: ' : 'Login failed!\nCode: ') + errorCode + '\n' + errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleUploadToCloud = async () => {
    if (!user) return;
    const now = Date.now();
    try {
      // 1. Sync Settings
      await syncUserSettings(user.uid, {
        theme,
        lang,
        favorites
      });

      // 2. Sync all maps with updated timestamp
      const updatedMaps = maps.map((m) => ({ ...m, updatedAt: now }));
      setMaps(updatedMaps);
      saveStoredMaps(updatedMaps);

      for (const m of updatedMaps) {
        await syncUserMap(user.uid, m);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    }
  };

  const handleDownloadFromCloud = async () => {
    if (!user) return;
    try {
      const { cloudMaps, cloudSettings } = await loadUserCloudData(user.uid);

      if (cloudSettings) {
        setTheme(cloudSettings.theme);
        setLang(cloudSettings.lang);
        setFavorites(cloudSettings.favorites);
        saveTheme(cloudSettings.theme);
        saveLanguage(cloudSettings.lang);
        saveFavorites(cloudSettings.favorites);
      }

      if (cloudMaps && cloudMaps.length > 0) {
        setMaps(cloudMaps);
        saveStoredMaps(cloudMaps);
      }
    } catch (err) {
      console.error('Download failed:', err);
      throw err;
    }
  };

  // Hidden File input ref for single map import from home grid
  const homeSingleMapInputRef = useRef<HTMLInputElement>(null);

  // Enforce permanent Dark Mode (Light mode removed)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    root.classList.remove('light');
    saveTheme('dark');
  }, []);

  // Sync language
  const handleToggleLanguage = () => {
    const nextLang: Language = lang === 'de' ? 'en' : 'de';
    setLang(nextLang);
    saveLanguage(nextLang);
  };

  // Toggle favorite
  const handleToggleFavorite = (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(mapId) ? prev.filter((id) => id !== mapId) : [...prev, mapId];
      saveFavorites(next);
      return next;
    });
  };

  // Save / Update map
  const handleSaveMap = (updatedMap: MapData, skipCloudSync = false) => {
    const mapWithFlag = { ...updatedMap, isCenteredCoords: true };
    setMaps((prev) => {
      const index = prev.findIndex((m) => m.id === mapWithFlag.id);
      let next: MapData[];
      if (index >= 0) {
        next = [...prev];
        next[index] = mapWithFlag;
      } else {
        next = [mapWithFlag, ...prev];
      }
      saveStoredMaps(next);
      return next;
    });

    if (selectedMap?.id === mapWithFlag.id) {
      setSelectedMap(mapWithFlag);
    }
  };

  // Save tactical map into "Eigene Taktiken" category
  const handleSaveAsMyTactic = (
    baseMap: MapData,
    tacticTitle: string,
    tacticState: { drawings: any[]; utilities: any[]; players: any[] }
  ) => {
    const newTacticId = `tactic_${Date.now()}`;
    const newTacticMap: MapData = {
      ...baseMap,
      id: newTacticId,
      name: tacticTitle,
      category: 'custom',
      isCustom: true,
      isCustomTactic: true,
      baseMapId: baseMap.baseMapId || baseMap.id,
      tacticData: tacticState,
      updatedAt: Date.now(),
    };

    setMaps((prev) => {
      const next = [newTacticMap, ...prev];
      saveStoredMaps(next);
      return next;
    });

    // Also update selectedMap if currently open
    setSelectedMap(newTacticMap);
    setSharedTacticNotification(null);

    alert(
      lang === 'de'
        ? `Taktik "${tacticTitle}" wurde erfolgreich unter "Eigene Taktiken" gespeichert!`
        : `Tactic "${tacticTitle}" saved to "My Tactics" successfully!`
    );
  };

  // Delete map
  const handleDeleteMap = async (mapId: string) => {
    // Record deletion if it's an official map
    saveDeletedMapId(mapId);

    setMaps((prev) => {
      const next = prev.filter((m) => m.id !== mapId);
      saveStoredMaps(next);
      return next;
    });
    setFavorites((prev) => {
      const next = prev.filter((id) => id !== mapId);
      saveFavorites(next);
      return next;
    });

    // Cloud Sync Deletion
    if (user) {
      try {
        await deleteUserMapSync(user.uid, mapId);
      } catch (err) {
        console.error('Failed to sync map deletion to cloud:', err);
      }
    }
  };

  // Navigation & History Management for Hardware / Smartphone Back Button
  const handleSelectMap = (map: MapData, calloutId?: string) => {
    setSelectedMap(map);
    setHighlightedCalloutId(calloutId);
    window.history.pushState({ view: 'map', mapId: map.id }, '');
  };

  const handleCloseMap = () => {
    if (window.history.state?.view) {
      window.history.back();
    } else {
      setSelectedMap(null);
      setHighlightedCalloutId(undefined);
    }
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    window.history.pushState({ view: 'settings' }, '');
  };

  const handleCloseSettings = () => {
    if (window.history.state?.view) {
      window.history.back();
    } else {
      setIsSettingsOpen(false);
    }
  };

  const handleOpenEditor = (mapToEditArg?: MapData | null) => {
    setMapToEdit(mapToEditArg || null);
    setIsEditorOpen(true);
    window.history.pushState({ view: 'editor' }, '');
  };

  const handleCloseEditor = () => {
    if (window.history.state?.view) {
      window.history.back();
    } else {
      setIsEditorOpen(false);
      setMapToEdit(null);
    }
  };

  // Hardware Back Button (Smartphone / Browser popstate event)
  useEffect(() => {
    const handlePopState = () => {
      if (isEditorOpen) {
        setIsEditorOpen(false);
        setMapToEdit(null);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isConflictOpen) {
        setIsConflictOpen(false);
        setConflictIncomingMap(null);
        setConflictExistingMap(null);
      } else if (selectedMap) {
        setSelectedMap(null);
        setHighlightedCalloutId(undefined);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedMap, isSettingsOpen, isEditorOpen, isConflictOpen]);

  // Open map editor for editing
  const handleEditMap = (map: MapData, e: React.MouseEvent) => {
    e.stopPropagation();
    handleOpenEditor(map);
  };

  // Open map editor to create a new one
  const handleAddNewMap = () => {
    handleOpenEditor(null);
  };

  // Change Map Category / Pool
  const handleUpdateMapCategory = (mapId: string, newCategory: string) => {
    setMaps((prev) => {
      const next = prev.map((m) => (m.id === mapId ? { ...m, category: newCategory } : m));
      saveStoredMaps(next);
      return next;
    });

    if (selectedMap?.id === mapId) {
      setSelectedMap((prev) => (prev ? { ...prev, category: newCategory } : null));
    }
  };

  // Add custom group / category
  const handleAddCustomGroup = (groupName: string) => {
    setCustomGroups((prev) => {
      if (prev.includes(groupName)) return prev;
      const next = [...prev, groupName];
      saveCustomGroups(next);
      return next;
    });
  };

  // Delete custom group / category
  const handleDeleteCustomGroup = (groupName: string) => {
    setCustomGroups((prev) => {
      const next = prev.filter((g) => g !== groupName);
      saveCustomGroups(next);
      return next;
    });
    // Reassign any maps in this group to community
    setMaps((prev) => {
      const next = prev.map((m) => (m.category === groupName ? { ...m, category: 'community' } : m));
      saveStoredMaps(next);
      return next;
    });
  };

  // Select callout from search autocomplete
  const handleSelectCalloutMatch = (map: MapData, calloutId: string) => {
    handleSelectMap(map, calloutId);
  };

  // Reset to original official maps
  const handleResetDefaults = () => {
    if (
      window.confirm(
        lang === 'de'
          ? 'Möchtest du alle Karten und Callouts auf die offiziellen Standardwerte zurücksetzen?'
          : 'Do you want to reset all maps and callouts to official default values?'
      )
    ) {
      const defs = resetToDefaults();
      setMaps(defs);
    }
  };

  const parseAndApplyBackup = (text: string, silent = false) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.maps)) {
        setMaps(parsed.maps);
        saveStoredMaps(parsed.maps);

        if (Array.isArray(parsed.settings?.favorites)) {
          setFavorites(parsed.settings.favorites);
          saveFavorites(parsed.settings.favorites);
        }
        if (parsed.settings?.theme === 'dark' || parsed.settings?.theme === 'light') {
          setTheme(parsed.settings.theme);
          saveTheme(parsed.settings.theme);
        }
        if (parsed.settings?.lang === 'de' || parsed.settings?.lang === 'en') {
          setLang(parsed.settings.lang);
          saveLanguage(parsed.settings.lang);
        }
        if (!silent) {
          alert(lang === 'de' ? 'Gesamtes Backup wurde erfolgreich geladen!' : 'Full backup loaded successfully!');
        }
      } else {
        if (!silent) {
          alert(lang === 'de' ? 'Ungültiges Dateiformat. Keine Karten im Backup gefunden.' : 'Invalid backup format.');
        }
      }
    } catch (err) {
      if (!silent) {
        alert(lang === 'de' ? 'Fehler beim Parsen der Backup-Daten.' : 'Error parsing backup data.');
      }
    }
  };

  // Autosave & File Sync Action Handlers
  const handleToggleAutosave = () => {
    setIsAutosaveEnabled((prev) => {
      const next = !prev;
      saveAutosaveEnabled(next);
      return next;
    });
  };

  const handleChooseSaveLocation = async (): Promise<boolean> => {
    const handle = await pickSaveFileLocation();
    if (handle) {
      setFileHandle(handle);
      setConnectedFileName(handle.name);
      setIsAutosaveEnabled(true);
      saveAutosaveEnabled(true);
      // Immediately write initial full backup into the file
      const payload = createBackupPayload(maps, { theme, lang, favorites });
      const ok = await writeBackupToFile(handle, payload);
      if (ok) {
        setLastAutosaveTs(Date.now());
      }
      return true;
    }
    return false;
  };

  const handleManualSaveNow = async (): Promise<boolean> => {
    const payload = createBackupPayload(maps, { theme, lang, favorites });
    if (fileHandle) {
      const ok = await writeBackupToFile(fileHandle, payload);
      if (ok) {
        setLastAutosaveTs(Date.now());
        return true;
      }
    }
    // If no direct file handle or on mobile without direct file system access, download JSON file
    downloadBackupJsonFile(payload, connectedFileName || `cs2freitag_backup_${new Date().toISOString().slice(0, 10)}.json`);
    setLastAutosaveTs(Date.now());
    return true;
  };

  const handleLoadFromFileLocation = async (): Promise<boolean> => {
    if (fileHandle) {
      try {
        const query = await (fileHandle as any).queryPermission?.({ mode: 'read' });
        if (query !== 'granted') {
          const req = await (fileHandle as any).requestPermission?.({ mode: 'read' });
          if (req !== 'granted') {
            return false;
          }
        }
        const payload = await readBackupFromFile(fileHandle);
        if (payload && Array.isArray(payload.maps) && payload.maps.length > 0) {
          parseAndApplyBackup(JSON.stringify(payload), true);
          return true;
        }
      } catch (err) {
        console.warn('Error reading from existing fileHandle, attempting file picker:', err);
      }
    }
    const opened = await pickOpenFileLocation();
    if (opened) {
      setFileHandle(opened.handle);
      setConnectedFileName(opened.handle.name);
      if (opened.data && Array.isArray(opened.data.maps)) {
        parseAndApplyBackup(JSON.stringify(opened.data), true);
        return true;
      }
    }
    return false;
  };

  const handleDisconnectFileLocation = async () => {
    await removeStoredFileHandle();
    setFileHandle(null);
    setConnectedFileName('');
  };

  // FULL BACKUP EXPORT AS ZIP (Containing JSON + Radar Images folder)
  const handleExportFullBackup = React.useCallback(async () => {
    const zip = new JSZip();
    const backupData = {
      type: 'cs2freitag_full_backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'CS2Freitag',
      settings: {
        theme,
        lang,
        favorites,
      },
      maps,
    };
    zip.file('backup.json', JSON.stringify(backupData, null, 2));

    const imgFolder = zip.folder('radar_images');
    if (imgFolder) {
      for (const m of maps) {
        if (m.image) {
          try {
            const res = await fetch(m.image);
            const blob = await res.blob();
            imgFolder.file(`${m.id}_upper.png`, blob);
          } catch (e) {}
        }
        if (m.lowerImage) {
          try {
            const res = await fetch(m.lowerImage);
            const blob = await res.blob();
            imgFolder.file(`${m.id}_lower.png`, blob);
          } catch (e) {}
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CS2Freitag_Backup_ZIP_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [maps, theme, lang, favorites]);

  // FULL BACKUP IMPORT (Supports .json, .zip or folder selection)
  const handleImportFullBackup = async (fileOrFiles: File | FileList) => {
    if (fileOrFiles instanceof FileList || (Array.isArray(fileOrFiles) && fileOrFiles.length > 1)) {
      const files = Array.from(fileOrFiles as FileList);
      const jsonFile = files.find(f => f.name.endsWith('.json'));
      if (!jsonFile) {
        alert(isDe ? 'Keine JSON-Datei im ausgewählten Ordner gefunden.' : 'No JSON file found in selected folder.');
        return;
      }
      const text = await jsonFile.text();
      parseAndApplyBackup(text);
      return;
    }

    const file = fileOrFiles as File;
    if (file.name.endsWith('.zip') || file.type.includes('zip')) {
      try {
        const zip = new JSZip();
        const loaded = await zip.loadAsync(file);
        const jsonEntry = loaded.file('backup.json') || loaded.file('map.json') || Object.values(loaded.files).find(f => f.name.endsWith('.json'));
        if (jsonEntry) {
          const text = await jsonEntry.async('text');
          parseAndApplyBackup(text);
        } else {
          alert(isDe ? 'Keine Backup-JSON im ZIP-Archiv gefunden.' : 'No backup JSON found in ZIP.');
        }
      } catch (err) {
        alert(isDe ? 'Fehler beim Entpacken des ZIP-Archivs.' : 'Error extracting ZIP archive.');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => parseAndApplyBackup(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  // SINGLE MAP EXPORT AS ZIP (Containing map.json + radar images folder)
  const handleExportSingleMap = async (targetMap: MapData) => {
    try {
      const zip = new JSZip();
      const payload = {
        type: 'cs2freitag_single_map',
        version: 1,
        exportedAt: new Date().toISOString(),
        map: targetMap,
      };
      zip.file('map.json', JSON.stringify(payload, null, 2));

      const imgFolder = zip.folder('radar_images');
      if (imgFolder) {
        if (targetMap.image) {
          try {
            if (targetMap.image.startsWith('data:')) {
              const base64Data = targetMap.image.split(',')[1];
              imgFolder.file(`${targetMap.id}_upper.png`, base64Data, { base64: true });
            } else {
              const res = await fetch(targetMap.image);
              const blob = await res.blob();
              imgFolder.file(`${targetMap.id}_upper.png`, blob);
            }
          } catch (e) {
            console.warn('Could not bundle upper image:', e);
          }
        }
        if (targetMap.lowerImage) {
          try {
            if (targetMap.lowerImage.startsWith('data:')) {
              const base64Data = targetMap.lowerImage.split(',')[1];
              imgFolder.file(`${targetMap.id}_lower.png`, base64Data, { base64: true });
            } else {
              const res = await fetch(targetMap.lowerImage);
              const blob = await res.blob();
              imgFolder.file(`${targetMap.id}_lower.png`, blob);
            }
          } catch (e) {
            console.warn('Could not bundle lower image:', e);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CS2Freitag_Karte_${targetMap.slug || targetMap.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert(
        lang === 'de'
          ? 'Fehler beim Erstellen der ZIP-Datei.'
          : 'Error generating map ZIP file.'
      );
    }
  };

  const processImportedMap = (mapObj: MapData) => {
    // Check if map already exists by ID or by matching name
    const existing = maps.find(
      (m) =>
        m.id === mapObj.id ||
        m.name.trim().toLowerCase() === mapObj.name.trim().toLowerCase()
    );

    if (existing) {
      // Open conflict dialog (Overwrite vs Create New with -Neu1)
      setConflictIncomingMap(mapObj);
      setConflictExistingMap(existing);
      setIsConflictOpen(true);
    } else {
      // Add directly!
      const newMap: MapData = {
        ...mapObj,
        isCustom: mapObj.isCustom ?? true,
      };
      const next = [newMap, ...maps];
      setMaps(next);
      saveStoredMaps(next);
      alert(
        lang === 'de'
          ? `Karte "${newMap.name}" mit ${newMap.callouts.length} Callouts wurde erfolgreich importiert!`
          : `Map "${newMap.name}" with ${newMap.callouts.length} callouts imported successfully!`
      );
    }
  };

  // SINGLE MAP IMPORT (Supports both .zip and .json)
  const handleImportSingleMapFile = async (file: File) => {
    try {
      if (file.name.endsWith('.zip') || file.type.includes('zip')) {
        const zip = new JSZip();
        const loaded = await zip.loadAsync(file);
        const jsonEntry =
          loaded.file('map.json') ||
          loaded.file('backup.json') ||
          Object.values(loaded.files).find((f) => f.name.endsWith('.json'));

        if (!jsonEntry) {
          alert(
            lang === 'de'
              ? 'Keine Kartendatei (map.json) im ZIP-Archiv gefunden.'
              : 'No map JSON file found in ZIP archive.'
          );
          return;
        }

        const text = await jsonEntry.async('text');
        const parsed = JSON.parse(text);
        let mapObj: MapData | undefined = parsed?.map || (parsed?.callouts ? parsed : undefined);

        if (!mapObj || !mapObj.name || !Array.isArray(mapObj.callouts)) {
          alert(
            lang === 'de'
              ? 'Ungültige Kartendaten im ZIP-Archiv.'
              : 'Invalid map data in ZIP archive.'
          );
          return;
        }

        // Restore radar images from the ZIP if present
        const upperImg =
          loaded.file(`radar_images/${mapObj.id}_upper.png`) ||
          Object.values(loaded.files).find(
            (f) =>
              (f.name.toLowerCase().includes('upper') ||
                (f.name.toLowerCase().endsWith('.png') && !f.name.toLowerCase().includes('lower'))) &&
              !f.dir
          );
        const lowerImg =
          loaded.file(`radar_images/${mapObj.id}_lower.png`) ||
          Object.values(loaded.files).find(
            (f) => f.name.toLowerCase().includes('lower') && !f.dir
          );

        if (upperImg) {
          const base64 = await upperImg.async('base64');
          mapObj = { ...mapObj, image: `data:image/png;base64,${base64}` };
        }
        if (lowerImg) {
          const base64 = await lowerImg.async('base64');
          mapObj = { ...mapObj, lowerImage: `data:image/png;base64,${base64}` };
        }

        processImportedMap(mapObj);
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const mapObj: MapData | undefined = parsed?.map || (parsed?.callouts ? parsed : undefined);

        if (!mapObj || !mapObj.name || !Array.isArray(mapObj.callouts)) {
          alert(
            lang === 'de'
              ? 'Ungültige Kartendatei. Keine gültigen CS2-Kartendaten gefunden.'
              : 'Invalid map file. No valid CS2 map data found.'
          );
          return;
        }

        processImportedMap(mapObj);
      }
    } catch (err) {
      console.error('Import error:', err);
      alert(
        lang === 'de'
          ? 'Fehler beim Lesen der Kartendatei oder des ZIP-Archivs.'
          : 'Error parsing map file or ZIP archive.'
      );
    }
  };

  // RESOLVE CONFLICT: OVERWRITE
  const handleResolveOverwrite = () => {
    if (conflictIncomingMap && conflictExistingMap) {
      const next = maps.map((m) =>
        m.id === conflictExistingMap.id
          ? {
              ...conflictIncomingMap,
              id: conflictExistingMap.id,
              name: conflictExistingMap.name,
            }
          : m
      );
      setMaps(next);
      saveStoredMaps(next);
      setIsConflictOpen(false);
      setConflictIncomingMap(null);
      setConflictExistingMap(null);
      alert(
        lang === 'de'
          ? `Karte "${conflictExistingMap.name}" wurde erfolgreich überschrieben!`
          : `Map "${conflictExistingMap.name}" overwritten successfully!`
      );
    }
  };

  // RESOLVE CONFLICT: CREATE NEW COPY (e.g. [Name]-Neu1)
  const handleResolveCreateNew = (customName: string) => {
    if (conflictIncomingMap) {
      const newMap: MapData = {
        ...conflictIncomingMap,
        id: `custom_${Date.now()}`,
        name: customName,
        slug: customName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        isCustom: true,
      };
      const next = [newMap, ...maps];
      setMaps(next);
      saveStoredMaps(next);
      setIsConflictOpen(false);
      setConflictIncomingMap(null);
      setConflictExistingMap(null);
      alert(
        lang === 'de'
          ? `Neue Karte "${newMap.name}" wurde erfolgreich angelegt!`
          : `New map "${newMap.name}" created successfully!`
      );
    }
  };

  const handleReorderFavorites = (newFavoriteIds: string[]) => {
    setFavorites(newFavoriteIds);
    saveFavorites(newFavoriteIds);
  };

  // Compute favorite maps in user-defined order
  const favoriteMaps = favorites
    .map((id) => maps.find((m) => m.id === id))
    .filter((m): m is MapData => m !== undefined);

  // Compute total callout count
  const totalCalloutsCount = maps.reduce((acc, m) => acc + m.callouts.length, 0);

  const isDe = lang === 'de';

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      {/* Hidden File Input for Single Map Import from Grid */}
      <input
        type="file"
        ref={homeSingleMapInputRef}
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportSingleMapFile(file);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Offline Mode Indicator */}
      <OfflineIndicator lang={lang} />

      {/* Main Fullscreen Tactical Map View if a map is selected */}
      {selectedMap ? (
        <div className="relative w-full h-full">
          {/* Incoming Shared Tactic Notification Banner */}
          {sharedTacticNotification && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950/95 border-2 border-sky-400 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200">
              <span className="text-xs text-zinc-200 font-medium">
                {isDe
                  ? `Taktik geladen: "${sharedTacticNotification.tacticTitle}". Möchtest du sie dauerhaft speichern?`
                  : `Tactic loaded: "${sharedTacticNotification.tacticTitle}". Do you want to save it permanently?`}
              </span>
              <button
                type="button"
                onClick={() => {
                  handleSaveAsMyTactic(
                    sharedTacticNotification.tacticMap,
                    sharedTacticNotification.tacticTitle,
                    sharedTacticNotification.tacticMap.tacticData || { drawings: [], utilities: [], players: [] }
                  );
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isDe ? 'Dauerhaft speichern' : 'Save permanently'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSharedTacticNotification(null)}
                className="text-xs text-zinc-400 hover:text-white px-1.5 py-1"
              >
                {isDe ? 'Ausblenden' : 'Dismiss'}
              </button>
            </div>
          )}

          <TacticalMapView
            mapData={selectedMap}
            onBack={handleCloseMap}
            onGoHome={handleCloseMap}
            onUpdateMap={handleSaveMap}
            onSaveAsMyTactic={handleSaveAsMyTactic}
            onSyncMap={async (m) => {
              // Trigger manual cloud sync if requested via the exit prompt
              if (user) {
                await syncUserMap(user.uid, m);
              }
            }}
            currentUser={user}
            lang={lang}
            initialHighlightedCalloutId={highlightedCalloutId}
          />
        </div>
      ) : (
        /* Home Page / Overview */
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <Header
            lang={lang}
            onToggleLanguage={handleToggleLanguage}
            totalMapsCount={maps.length}
            totalCalloutsCount={totalCalloutsCount}
            onOpenSettings={handleOpenSettings}
            isLoggedIn={user !== null}
            isAutoCloudSyncEnabled={isAutoCloudSyncEnabled}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* 1. Favorites Section at top */}
            <FavoritesSection
              favoriteMaps={favoriteMaps}
              onSelectMap={(map) => handleSelectMap(map)}
              onToggleFavorite={handleToggleFavorite}
              onReorderFavorites={handleReorderFavorites}
              lang={lang}
            />

            {/* 2. Tactical Search Bar directly under favorites */}
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              allMaps={maps}
              onSelectCalloutMatch={handleSelectCalloutMatch}
              onSelectMap={(map) => handleSelectMap(map)}
              lang={lang}
            />

            <MapGrid
              maps={maps}
              favorites={favorites}
              onSelectMap={(map) => handleSelectMap(map)}
              onToggleFavorite={handleToggleFavorite}
              onEditMap={handleEditMap}
              onDeleteMap={handleDeleteMap}
              onAddNewMap={handleAddNewMap}
              onImportSingleMap={() => homeSingleMapInputRef.current?.click()}
              onLoadTactic={() => setIsGlobalLoadTacticOpen(true)}
              onExportSingleMap={(map, e) => {
                e.stopPropagation();
                handleExportSingleMap(map);
              }}
              customGroups={customGroups}
              lang={lang}
              filterQuery={searchQuery}
            />
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950/60 py-6 text-xs text-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-950/60 light:border-zinc-200 light:bg-white print:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="font-bold text-zinc-300 dark:text-zinc-300 light:text-zinc-700">
                    CS2Freitag
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{isDe ? 'Inoffizielles Community-Projekt' : 'Unofficial Community Project'}</span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  {isDe
                    ? 'Nicht mit Valve Corp. verbunden. CS2 & Kartenbilder sind Marken der Valve Corp.'
                    : 'Not affiliated with Valve Corp. CS2 & map assets are trademarks of Valve Corp.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
                <a
                  href="https://steamcommunity.com/profiles/76561198014156077"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-amber-400 transition-colors text-xs"
                  title="Steam Profil: callmebythecolor"
                >
                  <span className="text-zinc-500">Impressum:</span>
                  <span className="font-semibold text-zinc-300 hover:text-amber-400 underline decoration-zinc-700 hover:decoration-amber-400 underline-offset-2">callmebythecolor</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </a>

                <span className="text-zinc-700 hidden sm:inline" aria-hidden="true">·</span>

                <button
                  onClick={handleOpenSettings}
                  className="text-zinc-400 hover:text-white underline decoration-zinc-700 underline-offset-2 transition-colors text-xs"
                >
                  {isDe ? 'Einstellungen & Legal' : 'Settings & Legal'}
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Map Editor / Add Modal (with integrated Map Pool & Group Management) */}
      <MapEditorModal
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        mapToEdit={mapToEdit}
        onSaveMap={handleSaveMap}
        onDeleteMap={handleDeleteMap}
        customGroups={customGroups}
        onAddCustomGroup={handleAddCustomGroup}
        onDeleteCustomGroup={handleDeleteCustomGroup}
        lang={lang}
      />

      {/* Settings & Full Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        maps={maps}
        favorites={favorites}
        lang={lang}
        onToggleLanguage={handleToggleLanguage}
        onExportFullBackup={handleExportFullBackup}
        onImportFullBackup={handleImportFullBackup}
        onExportSingleMap={handleExportSingleMap}
        onImportSingleMapFile={handleImportSingleMapFile}
        onResetDefaults={handleResetDefaults}
        currentUser={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onUploadToCloud={handleUploadToCloud}
        onDownloadFromCloud={handleDownloadFromCloud}
        isAutosaveEnabled={isAutosaveEnabled}
        onToggleAutosave={handleToggleAutosave}
        isAutoCloudSyncEnabled={isAutoCloudSyncEnabled}
        onToggleAutoCloudSync={handleToggleAutoCloudSync}
        connectedFileName={connectedFileName}
        lastAutosaveTs={lastAutosaveTs}
        onChooseSaveLocation={handleChooseSaveLocation}
        onManualSaveNow={handleManualSaveNow}
        onLoadFromFileLocation={handleLoadFromFileLocation}
        onDisconnectFileLocation={handleDisconnectFileLocation}
        onStartQuiz={() => setIsQuizOpen(true)}
      />

      {/* Global Load & QR Scan Modal for Eigene Taktiken */}
      {isGlobalLoadTacticOpen && (
        <ShareTacticModal
          isOpen={isGlobalLoadTacticOpen}
          onClose={() => setIsGlobalLoadTacticOpen(false)}
          mapData={maps[0]}
          shareUrl={`${window.location.origin}${window.location.pathname}`}
          defaultTitle={lang === 'de' ? 'Neue Taktik' : 'New Tactic'}
          tacticState={{ drawings: [], utilities: [], players: [] }}
          onSaveAsMyTactic={(title) => {}}
          onLoadTacticState={(loadedState, title) => {
            setIsGlobalLoadTacticOpen(false);
            const baseMap = maps[0];
            const tacticTitle = title || `${baseMap.name} - Taktik`;
            const tacticMapInstance: MapData = {
              ...baseMap,
              id: `shared_temp_${Date.now()}`,
              name: `${baseMap.name} - ${tacticTitle}`,
              isCustomTactic: true,
              baseMapId: baseMap.id,
              tacticData: loadedState,
            };
            setSelectedMap(tacticMapInstance);
            setSharedTacticNotification({
              tacticMap: tacticMapInstance,
              tacticTitle,
            });
          }}
          lang={lang}
        />
      )}

      {/* Callout Trainer / Quiz Modal */}
      <CalloutQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        maps={maps}
        lang={lang}
      />

      {/* Single Map Import Conflict Modal (Overwrite vs. Rename with -Neu1) */}
      {conflictIncomingMap && conflictExistingMap && (
        <MapImportConflictModal
          isOpen={isConflictOpen}
          onClose={() => {
            setIsConflictOpen(false);
            setConflictIncomingMap(null);
            setConflictExistingMap(null);
          }}
          incomingMap={conflictIncomingMap}
          existingMap={conflictExistingMap}
          onOverwrite={handleResolveOverwrite}
          onCreateNew={handleResolveCreateNew}
          lang={lang}
        />
      )}
      {/* Scroll to Top Floating Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/60 hover:bg-amber-500 text-zinc-300 hover:text-zinc-950 border border-zinc-700/60 hover:border-amber-400 shadow-xl backdrop-blur-md opacity-70 hover:opacity-100 transition-all duration-300 active:scale-95 group cursor-pointer animate-in fade-in zoom-in-75 ring-1 ring-white/10 print:hidden"
          title={lang === 'de' ? 'Nach oben scrollen' : 'Scroll to top'}
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
        </button>
      )}
    </div>
  );
}
