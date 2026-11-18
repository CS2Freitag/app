import React, { useRef, useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Globe,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode,
  FolderTree,
  Sparkles,
  Gamepad2,
} from 'lucide-react';
import { MapData, Language, Theme } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  favorites: string[];
  lang: Language;
  onToggleLanguage: () => void;
  onExportFullBackup: () => void;
  onImportFullBackup: (fileOrFiles: File | FileList) => void;
  onExportSingleMap: (map: MapData) => void;
  onImportSingleMapFile: (file: File) => void;
  onResetDefaults: () => void;
  currentUser: any;
  onLogin: () => void;
  onLogout: () => void;
  onUploadToCloud: () => void;
  onDownloadFromCloud: () => void;
  isAutosaveEnabled?: boolean;
  onToggleAutosave?: () => void;
  isAutoCloudSyncEnabled?: boolean;
  onToggleAutoCloudSync?: () => void;
  connectedFileName?: string;
  lastAutosaveTs?: number;
  onChooseSaveLocation?: () => Promise<boolean>;
  onManualSaveNow?: () => Promise<boolean>;
  onLoadFromFileLocation?: () => Promise<boolean>;
  onDisconnectFileLocation?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  maps,
  favorites,
  lang,
  onToggleLanguage,
  onExportFullBackup,
  onImportFullBackup,
  onExportSingleMap,
  onImportSingleMapFile,
  onResetDefaults,
  currentUser,
  onLogin,
  onLogout,
  onUploadToCloud,
  onDownloadFromCloud,
  isAutosaveEnabled = true,
  onToggleAutosave,
  isAutoCloudSyncEnabled = true,
  onToggleAutoCloudSync,
  connectedFileName = '',
  lastAutosaveTs = 0,
  onChooseSaveLocation,
  onManualSaveNow,
  onLoadFromFileLocation,
  onDisconnectFileLocation,
}) => {
  const isDe = lang === 'de';
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();

  const [selectedMapToExportId, setSelectedMapToExportId] = useState<string>(
    maps[0]?.id || ''
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [showUploadConflict, setShowUploadConflict] = useState<boolean>(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState<boolean>(false);
  const [isCheckingUploadConflict, setIsCheckingUploadConflict] = useState<boolean>(false);

  const fullBackupInputRef = useRef<HTMLInputElement>(null);
  const singleMapInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 4000);
  };

  const handleTriggerUpload = async () => {
    if (!currentUser) return;
    setIsCheckingUploadConflict(true);
    try {
      onUploadToCloud();
      showNotification(isDe ? 'Daten erfolgreich in die Cloud hochgeladen!' : 'Data uploaded to cloud successfully!');
    } catch (err) {
      showNotification(isDe ? 'Fehler beim Hochladen in die Cloud.' : 'Failed to upload to cloud.', true);
    } finally {
      setIsCheckingUploadConflict(false);
    }
  };

  const handleFullBackupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        if (files.length > 1) {
          onImportFullBackup(files);
        } else {
          onImportFullBackup(files[0]);
        }
        showNotification(isDe ? 'Gesamtes Backup wurde erfolgreich geladen!' : 'Full backup restored successfully!');
      } catch (err) {
        showNotification(isDe ? 'Fehler beim Laden des Backups!' : 'Failed to parse backup file.', true);
      }
      e.target.value = '';
    }
  };

  const handleSingleMapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSingleMapFile(file);
      e.target.value = '';
    }
  };

  const handleExportSelectedSingleMap = () => {
    const targetMap = maps.find((m) => m.id === selectedMapToExportId);
    if (targetMap) {
      onExportSingleMap(targetMap);
      showNotification(
        isDe
          ? `Karte "${targetMap.name}" wurde exportiert!`
          : `Map "${targetMap.name}" exported!`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-700">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white">
                {isDe ? 'Einstellungen & Backup' : 'Settings & Backups'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isDe
                  ? 'Karten, Callouts und Daten sichern, teilen und wiederherstellen'
                  : 'Backup, share, and restore maps and tactical callouts'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold animate-in fade-in-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <input
          type="file"
          ref={fullBackupInputRef}
          accept=".json,.zip,application/json,application/zip"
          onChange={handleFullBackupChange}
          className="hidden"
        />
        <input
          type="file"
          ref={folderInputRef}
          //@ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFullBackupChange}
          className="hidden"
        />
        <input
          type="file"
          ref={singleMapInputRef}
          accept=".json,.zip,application/json,application/zip"
          onChange={handleSingleMapChange}
          className="hidden"
        />

        <div className="space-y-5 text-xs">
          {/* 1. LOKALE DATEN & DATEISYSTEM-VERKNÜPFUNG (AUTOSAVE) */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'Lokale Datei & Autosave' : 'Local File & Autosave'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                  connectedFileName
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}>
                  {connectedFileName
                    ? (isDe ? `Verknüpft: ${connectedFileName}` : `Linked: ${connectedFileName}`)
                    : (isDe ? 'Keine Datei verknüpft' : 'No file linked')}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'Verknüpfe eine lokale Backup-Datei auf deinem PC oder Tablet, damit alle Änderungen direkt in diese Datei geschrieben werden. Alternativ sichert Autosave deine Daten im Browser-Speicher.'
                : 'Link a local backup file on your PC or tablet so changes write directly into it. Alternatively, Autosave keeps data safe in browser storage.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={async () => {
                  if (onChooseSaveLocation) {
                    const ok = await onChooseSaveLocation();
                    if (ok) {
                      showNotification(isDe ? 'Backup-Datei erfolgreich verknüpft!' : 'Backup file linked successfully!');
                    }
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
                title={isDe ? 'Datei auswählen, in die direkt gespeichert werden soll' : 'Choose file to write changes directly'}
              >
                <FolderTree className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>{isDe ? '📁 Datei verknüpfen' : '📁 Link File'}</span>
              </button>

              <button
                onClick={async () => {
                  if (onManualSaveNow) {
                    const ok = await onManualSaveNow();
                    if (ok) {
                      showNotification(isDe ? 'Erfolgreich in Datei gespeichert!' : 'Saved to file successfully!');
                    } else {
                      showNotification(isDe ? 'Bitte zuerst eine Datei verknüpfen.' : 'Please link a file first.', true);
                    }
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold transition-all shadow-xs cursor-pointer text-xs"
                title={isDe ? 'Jetzt manuell in die verknüpfte Datei schreiben' : 'Write now to linked file'}
              >
                <Download className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>{isDe ? '💾 Manuell speichern' : '💾 Save Now'}</span>
              </button>

              <button
                onClick={async () => {
                  if (onLoadFromFileLocation) {
                    const ok = await onLoadFromFileLocation();
                    if (ok) {
                      showNotification(isDe ? 'Daten erfolgreich aus der Datei geladen!' : 'Data loaded from file successfully!');
                    } else {
                      showNotification(isDe ? 'Konnte nicht aus der Datei geladen werden.' : 'Could not load from file.', true);
                    }
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold transition-all shadow-xs cursor-pointer text-xs"
                title={isDe ? 'Aktuellen Stand aus der verknüpften Backup-Datei einlesen' : 'Reload latest state from connected backup file'}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                <span>{isDe ? '🔄 Aus Datei laden' : '🔄 Load File'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[10px] text-zinc-400 space-y-1">
              <p>
                <strong className="text-zinc-300">{isDe ? '💡 Hinweis zu PC & Smartphone:' : '💡 Note for PC & Mobile:'}</strong>{' '}
                {isDe
                  ? 'Auf PCs und Android (Chrome/Edge) wird die Datei über die Dateisystem-Schnittstelle direkt an deinem gewählten Speicherort aktualisiert. Auf Apple iOS (Safari) oder Browsern ohne direkten Ordnerzugriff sichert Autosave alles lückenlos im Offline-Speicher (PWA Storage) dieses Geräts.'
                  : 'On PC and Android (Chrome/Edge), files write directly to your chosen folder. On Apple iOS (Safari), Autosave saves in offline PWA storage.'}
              </p>
            </div>
          </div>

          {/* 2. CLOUD SYNC */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>{isDe ? 'Cloud-Synchronisierung' : 'Cloud Synchronization'}</span>
                {currentUser ? (
                  isAutoCloudSyncEnabled ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold normal-case">
                      {isDe ? 'Alles aktiviert' : 'All Active'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold normal-case">
                      {isDe ? 'Angemeldet (ohne Auto-Abgleich)' : 'Signed In (No Auto-Sync)'}
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold normal-case">
                    {isDe ? 'Nicht angemeldet' : 'Not Signed In'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-300 hidden sm:inline">
                  {isDe ? 'Auto-Abgleich beim Anmelden' : 'Auto-Sync on Login'}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase ${isAutoCloudSyncEnabled ? 'text-sky-400' : 'text-zinc-500'}`}>
                  {isAutoCloudSyncEnabled ? (isDe ? 'Aktiviert' : 'Active') : (isDe ? 'Deaktiviert' : 'Disabled')}
                </span>
                <button
                  type="button"
                  onClick={onToggleAutoCloudSync}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoCloudSyncEnabled ? 'bg-sky-500' : 'bg-zinc-700'
                  }`}
                  role="switch"
                  aria-checked={isAutoCloudSyncEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutoCloudSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? isAutoCloudSyncEnabled
                  ? 'Beim Anmelden werden deine Karten, Callouts und Favoriten automatisch abgeglichen. Über die Knöpfe unten kannst du auch jederzeit manuell hoch- oder herunterladen.'
                  : 'Automatischer Abgleich ist deaktiviert.'
                : isAutoCloudSyncEnabled
                  ? 'On sign-in, your maps, callouts, and favorites are automatically synced.'
                  : 'Auto-sync is disabled.'}
            </p>

            {!currentUser ? (
              <div className="pt-1">
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-sky-600" />
                  <span>{isDe ? 'Mit Google anmelden' : 'Sign in with Google'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <img
                    src={currentUser.photoURL || ''}
                    alt="User"
                    className="w-8 h-8 rounded-full border border-zinc-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">{currentUser.displayName}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={onLogout}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    {isDe ? 'Abmelden' : 'Logout'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleTriggerUpload}
                    disabled={isCheckingUploadConflict}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {isCheckingUploadConflict
                        ? isDe ? 'Prüfe Cloud...' : 'Checking cloud...'
                        : isDe ? 'Daten hochladen' : 'Upload to Cloud'}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowDownloadConfirm(true)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isDe ? 'Cloud-Stand laden' : 'Fetch from Cloud'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. KOMPLETTES BACKUP (ALLES SPEICHERN & LADEN ALS ZIP ODER ORDNER) */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>{isDe ? 'Gesamtes Backup (JSON / ZIP)' : 'Full Backup (JSON / ZIP)'}</span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'Sichere alle deine Karten, Callouts, Favoriten und Einstellungen als vollständiges Backup-Archiv oder spiele eine Sicherung ein.'
                : 'Backup all maps, callouts, favorites, and settings or restore from a backup file.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={onExportFullBackup}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold transition-all shadow-xs cursor-pointer text-xs"
              >
                <Download className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{isDe ? 'Gesamtes Backup exportieren' : 'Export Full Backup'}</span>
              </button>

              <button
                onClick={() => fullBackupInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
              >
                <Upload className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{isDe ? 'Backup wiederherstellen' : 'Restore Backup'}</span>
              </button>
            </div>
          </div>

          {/* 4. EINZELNE KARTE EXPORTIEREN / IMPORTIEREN */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
              <FileCode className="w-4 h-4 text-sky-400" />
              <span>{isDe ? 'Einzelne Karte exportieren / importieren' : 'Export / Import Single Map'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <select
                value={selectedMapToExportId}
                onChange={(e) => setSelectedMapToExportId(e.target.value)}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-xs font-medium"
              >
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.callouts.length} Callouts)
                  </option>
                ))}
              </select>

              <button
                onClick={handleExportSelectedSingleMap}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold transition-all shadow-xs cursor-pointer text-xs whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>{isDe ? 'Exportieren' : 'Export'}</span>
              </button>
            </div>

            <div className="pt-1">
              <button
                onClick={() => singleMapInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold transition-all shadow-xs cursor-pointer text-xs"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isDe ? 'Einzelne Map-Datei importieren (.json)' : 'Import Single Map File'}</span>
              </button>
            </div>
          </div>

          {/* 5. STANDARDWERTE WIEDERHERSTELLEN */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-rose-300 text-xs uppercase tracking-wide">
                  {isDe ? 'Auf Standardwerte zurücksetzen' : 'Reset to Default Maps'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isDe
                    ? 'Setzt alle Karten auf die offiziellen CS2-Standardwerte zurück. Eigene Änderungen gehen verloren.'
                    : 'Resets all maps to official CS2 defaults. Custom changes will be lost.'}
                </p>
              </div>
              <button
                onClick={() => setShowResetModal(true)}
                className="px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-colors cursor-pointer shrink-0"
              >
                {isDe ? 'Zurücksetzen' : 'Reset'}
              </button>
            </div>
          </div>

          {/* Impressum */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
              <div>
                <span className="font-bold text-zinc-200">Impressum: </span>
                <span className="text-zinc-400">Community-Projekt (callmebythecolor)</span>
              </div>
              <a
                href="https://steamcommunity.com/profiles/76561198014156077"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                Steam Profil ↗
              </a>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {isDe
                ? 'CS2Freitag ist ein inoffizielles Community-Projekt für Taktik-Analysen in Counter-Strike 2. Alle Marken, Grafiken und Kartenassets gehören der Valve Corporation.'
                : 'CS2Freitag is an unofficial community project for tactical analysis in Counter-Strike 2. All game assets belong to Valve Corporation.'}
            </p>
          </div>
        </div>

        {/* Modal: Reset Confirmation */}
        {showResetModal && (
          <div className="fixed inset-0 z-65 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-rose-500/50 bg-zinc-900 p-6 shadow-2xl text-zinc-100 space-y-4">
              <h3 className="text-base font-bold text-rose-400">
                {isDe ? 'Wirklich auf Standardwerte zurücksetzen?' : 'Reset to Default Maps?'}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Dadurch werden alle Karten und Callouts auf den Auslieferungszustand zurückgesetzt. Deine manuell gespeicherten Änderungen und Favoriten werden gelöscht.'
                  : 'This will reset all maps and callouts to factory defaults. Your custom edits and favorites will be cleared.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    onResetDefaults();
                    showNotification(isDe ? 'Auf Standardwerte zurückgesetzt!' : 'Reset to defaults successful!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow"
                >
                  {isDe ? 'Ja, zurücksetzen' : 'Yes, Reset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Download Confirm */}
        {showDownloadConfirm && (
          <div className="fixed inset-0 z-65 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-sky-500/50 bg-zinc-900 p-6 shadow-2xl text-zinc-100 space-y-4">
              <h3 className="text-base font-bold text-sky-400">
                {isDe ? 'Cloud-Stand laden?' : 'Fetch From Cloud?'}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Dadurch werden lokale Daten auf diesem Gerät mit dem Stand aus der Google Cloud überschrieben.'
                  : 'This will overwrite local data on this device with the state stored in Google Cloud.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDownloadConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    setShowDownloadConfirm(false);
                    onDownloadFromCloud();
                    showNotification(isDe ? 'Cloud-Stand erfolgreich geladen!' : 'Cloud state fetched successfully!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer shadow"
                >
                  {isDe ? 'Ja, laden' : 'Yes, Fetch'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
