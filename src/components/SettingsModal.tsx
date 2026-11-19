import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Globe,
  Upload,
  Download,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FolderTree,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Monitor,
  Unlink,
  Clock,
  Check,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { MapData, Language } from '../types';
import {
  useAppVersion,
  compareVersions,
} from '../services/versionService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  favorites: string[];
  lang: Language;
  onToggleLanguage: () => void;
  onExportFullBackup: () => void | Promise<void>;
  onExportFullBackupJson?: () => void | Promise<void>;
  onImportFullBackup: (fileOrFiles: File | FileList) => void;
  onExportSingleMap: (map: MapData) => void;
  onImportSingleMapFile: (file: File) => void;
  onResetDefaults: () => void;
  currentUser: any;
  onLogin: () => void | Promise<void>;
  onLogout: () => void;
  onUploadToCloud: () => void | Promise<void>;
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
  onOpenInstallationHelp?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  maps,
  favorites,
  lang,
  onToggleLanguage,
  onExportFullBackup,
  onExportFullBackupJson,
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
  onOpenInstallationHelp,
}) => {
  const isDe = lang === 'de';

  // Version management hook
  const {
    installedVersion,
    previousVersion,
    latestVersion,
    hasUpdate,
    isChecking,
    versionManifest,
    checkMessage,
    checkForUpdates,
    applyUpdateNow,
  } = useAppVersion();

  const [showChangelog, setShowChangelog] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedMapToExportId, setSelectedMapToExportId] = useState<string>(
    maps[0]?.id || ''
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isBackingUpAndResetting, setIsBackingUpAndResetting] = useState<boolean>(false);
  const [backupZipBeforeReset, setBackupZipBeforeReset] = useState<boolean>(true);
  const [backupLocalFileBeforeReset, setBackupLocalFileBeforeReset] = useState<boolean>(true);
  const [backupCloudBeforeReset, setBackupCloudBeforeReset] = useState<boolean>(Boolean(currentUser));
  const [showDownloadConfirm, setShowDownloadConfirm] = useState<boolean>(false);
  const [isCheckingUploadConflict, setIsCheckingUploadConflict] = useState<boolean>(false);

  const fullBackupInputRef = useRef<HTMLInputElement>(null);
  const singleMapInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showResetModal) {
      setBackupZipBeforeReset(true);
      setBackupLocalFileBeforeReset(true);
      setBackupCloudBeforeReset(Boolean(currentUser));
    }
  }, [showResetModal, currentUser]);

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

  const handlePerformUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyUpdateNow();
    } catch (e) {
      setIsUpdating(false);
      showNotification(isDe ? 'Fehler beim Durchführen des Updates.' : 'Failed to apply update.', true);
    }
  };

  const handleDownloadWindowsLauncher = () => {
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-mkiapnqfs3whcrnq7ubhwi-408525611466.europe-west3.run.app/';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-mkiapnqfs3whcrnq7ubhwi-408525611466.europe-west3.run.app';
      const iconUrl = `${origin}/favicon.ico`;

      const batContent = `@echo off\r\n` +
        `title CS2Freitag Tactical PWA Launcher\r\n` +
        `color 0B\r\n` +
        `set "URL=${currentUrl}"\r\n` +
        `set "ICON_URL=${iconUrl}"\r\n` +
        `set "DIR=%USERPROFILE%\\AppData\\Local\\CS2Freitag"\r\n` +
        `if not exist "%DIR%" mkdir "%DIR%"\r\n` +
        `if not "%~dp0"=="%DIR%\\" (\r\n` +
        `    copy /y "%~f0" "%DIR%\\CS2Freitag-App.bat" >nul\r\n` +
        `)\r\n` +
        `set "BAT_PATH=%DIR%\\CS2Freitag-App.bat"\r\n` +
        `set "ICO_PATH=%DIR%\\favicon.ico"\r\n` +
        `\r\n` +
        `powershell -NoProfile -ExecutionPolicy Bypass -Command ^\r\n` +
        `  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^\r\n` +
        `  "if (-not (Test-Path '%ICO_PATH%')) { try { (New-Object System.Net.WebClient).DownloadFile('%ICON_URL%', '%ICO_PATH%') } catch {} };" ^\r\n` +
        `  "$ws = New-Object -ComObject WScript.Shell;" ^\r\n` +
        `  "$desktop = [Environment]::GetFolderPath('Desktop');" ^\r\n` +
        `  "$scPath = Join-Path $desktop 'CS2Freitag.lnk';" ^\r\n` +
        `  "$sc = $ws.CreateShortcut($scPath);" ^\r\n` +
        `  "$sc.TargetPath = '%BAT_PATH%';" ^\r\n` +
        `  "$sc.WorkingDirectory = '%DIR%';" ^\r\n` +
        `  "if ((Test-Path '%ICO_PATH%') -and (Get-Item '%ICO_PATH%').Length -gt 100) { $sc.IconLocation = '%ICO_PATH%,0' };" ^\r\n` +
        `  "$sc.Description = 'CS2Freitag Tactical PWA';" ^\r\n` +
        `  "$sc.Save();"\r\n` +
        `\r\n` +
        `cls\r\n` +
        `echo ========================================================\r\n` +
        `echo   CS2Freitag - Counter-Strike 2 Tactical PWA\r\n` +
        `echo ========================================================\r\n` +
        `echo Starte App-Fenster...\r\n` +
        `start msedge --app="%URL%" 2>nul || start chrome --app="%URL%" 2>nul || start "" "%URL%"\r\n` +
        `exit\r\n`;

      const blob = new Blob([batContent], { type: 'application/x-bat' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CS2Freitag-App.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(isDe ? 'Windows-Starter (CS2Freitag-App.bat) heruntergeladen!' : 'Windows launcher downloaded!');
    } catch (e) {
      console.warn('Download error:', e);
      showNotification(isDe ? 'Fehler beim Herunterladen des Windows-Starters.' : 'Failed to download launcher.', true);
    }
  };

  const handleTriggerUpload = async () => {
    if (!currentUser) return;
    setIsCheckingUploadConflict(true);
    try {
      await onUploadToCloud();
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

  // Determine changelog entries to display
  const allVersionHistory = versionManifest?.history || [];
  const pendingChangelogEntries = allVersionHistory.filter((entry) => {
    return (
      compareVersions(entry.version, installedVersion) > 0 &&
      compareVersions(entry.version, latestVersion) <= 0
    );
  });

  const updatedChangelogEntries = allVersionHistory.filter((entry) => {
    if (!previousVersion) return entry.version === installedVersion;
    return (
      compareVersions(entry.version, previousVersion) > 0 &&
      compareVersions(entry.version, installedVersion) <= 0
    );
  });

  const displayedChangelogEntries = hasUpdate
    ? pendingChangelogEntries.length > 0
      ? pendingChangelogEntries
      : versionManifest?.changes
      ? [{ version: latestVersion, releaseDate: versionManifest.releaseDate, title: versionManifest.title, changes: versionManifest.changes }]
      : []
    : updatedChangelogEntries.length > 0
    ? updatedChangelogEntries
    : allVersionHistory.slice(0, 3);

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

        {/* Notifications */}
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
          {/* 0. APP-VERSION & MANUELLE UPDATE-STEUERUNG */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'App-Version & Updates' : 'App Version & Updates'}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold">
                  v{installedVersion}
                </span>

                {hasUpdate ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold animate-pulse">
                    ⚡ {isDe ? `Update v${latestVersion} verfügbar` : `Update v${latestVersion} available`}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    ✓ {isDe ? 'Aktuell' : 'Up to date'}
                  </span>
                )}

                <button
                  onClick={() => checkForUpdates(true)}
                  disabled={isChecking}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                  title={isDe ? 'Auf dem Server nach neuen Versionen suchen' : 'Check server for new versions'}
                >
                  <RefreshCw className={`w-3 h-3 text-sky-400 ${isChecking ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isDe ? 'Prüfen' : 'Check'}</span>
                </button>
              </div>
            </div>

            {checkMessage && (
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-300 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                <span>{checkMessage}</span>
              </div>
            )}

            {hasUpdate ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{isDe ? `Neues Update v${latestVersion} ist bereit!` : `New update v${latestVersion} is ready!`}</span>
                    </h4>
                    <p className="text-[11px] text-zinc-300 mt-0.5">
                      {isDe
                        ? 'Deine Karten, Callouts und Einstellungen bleiben beim Update vollständig erhalten.'
                        : 'Your maps, callouts, and settings will remain fully intact.'}
                    </p>
                  </div>

                  <button
                    onClick={handlePerformUpdate}
                    disabled={isUpdating}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? (isDe ? 'Aktualisiere...' : 'Updating...') : (isDe ? 'Update durchführen' : 'Update Now')}</span>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => setShowChangelog((prev) => !prev)}
                    className="flex items-center gap-1.5 text-xs text-amber-300/90 hover:text-amber-200 font-semibold cursor-pointer"
                  >
                    {showChangelog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>
                      {isDe
                        ? `Neuerungen ansehen (v${installedVersion} → v${latestVersion})`
                        : `View changelog (v${installedVersion} → v${latestVersion})`}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-zinc-400">
                  {isDe
                    ? `Installierte Version: v${installedVersion}. Die App ist auf dem neuesten Stand.`
                    : `Installed version: v${installedVersion}. The app is up to date.`}
                </span>
                <button
                  onClick={() => setShowChangelog((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 font-semibold cursor-pointer"
                >
                  {showChangelog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{isDe ? 'Was ist neu' : 'What is new'}</span>
                </button>
              </div>
            )}

            {/* Changelog Accordion */}
            {showChangelog && (
              <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-3.5 animate-in fade-in-50">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <span className="font-mono text-[11px] uppercase font-bold text-zinc-300">
                    {hasUpdate
                      ? isDe ? `Neuerungen (Update auf v${latestVersion}):` : `Changes in v${latestVersion}:`
                      : previousVersion
                      ? isDe ? `Alle Neuerungen (Update von v${previousVersion} auf v${installedVersion}):` : `Changes from v${previousVersion} to v${installedVersion}:`
                      : isDe ? `Versionsverlauf (v${installedVersion}):` : `Version history (v${installedVersion}):`}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {displayedChangelogEntries.length} {isDe ? 'Version(en)' : 'Version(s)'}
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto pr-2 scrollbar-left space-y-3.5 text-[11px]">
                  {displayedChangelogEntries.length > 0 ? (
                    displayedChangelogEntries.map((entry, idx) => (
                      <div key={entry.version || idx} className="space-y-1.5 pb-2 border-b border-zinc-800/40 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                            v{entry.version}
                          </span>
                          {entry.title && (
                            <span className="font-semibold text-zinc-200">
                              {entry.title}
                            </span>
                          )}
                          {entry.releaseDate && (
                            <span className="text-[10px] text-zinc-500 ml-auto font-mono">
                              {entry.releaseDate}
                            </span>
                          )}
                        </div>
                        {entry.changes && entry.changes.length > 0 && (
                          <ul className="list-disc list-inside text-zinc-400 space-y-1 pl-1 text-[11px]">
                            {entry.changes.map((change, cIdx) => (
                              <li key={cIdx} className="leading-relaxed">
                                {change}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-xs italic">
                      {isDe ? 'Keine Versionsdetails hinterlegt.' : 'No version details available.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 1. AUTOMATISCHE SPEICHERUNG & LOKALE DATEISYSTEM-VERKNÜPFUNG (AUTOSAVE) */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300 min-w-0">
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{isDe ? 'Automatische Speicherung & Lokale Datei' : 'Autosave & Local File'}</span>
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="text-[11px] font-semibold text-zinc-300 hidden sm:inline">
                  {isDe ? 'Autosave aktiv' : 'Autosave active'}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase ${isAutosaveEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {isAutosaveEnabled ? (isDe ? 'Aktiviert' : 'Active') : (isDe ? 'Deaktiviert' : 'Disabled')}
                </span>
                <button
                  type="button"
                  onClick={onToggleAutosave}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutosaveEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                  role="switch"
                  aria-checked={isAutosaveEnabled}
                  title={isDe ? 'Autosave ein- oder ausschalten' : 'Toggle autosave'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutosaveEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Status row: linked file & timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                  connectedFileName
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}>
                  {connectedFileName
                    ? (isDe ? `Verknüpft: ${connectedFileName}` : `Linked: ${connectedFileName}`)
                    : (isDe ? 'Keine Datei verknüpft' : 'No file linked')}
                </span>

                {connectedFileName && onDisconnectFileLocation && (
                  <button
                    onClick={async () => {
                      await onDisconnectFileLocation();
                      showNotification(isDe ? 'Dateiverknüpfung getrennt.' : 'File unlinked.');
                    }}
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-rose-400 font-semibold cursor-pointer"
                    title={isDe ? 'Dateiverknüpfung aufheben' : 'Unlink file'}
                  >
                    <Unlink className="w-3 h-3" />
                    <span>{isDe ? 'Trennen' : 'Unlink'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>
                  {lastAutosaveTs
                    ? isDe
                      ? `Zuletzt gespeichert: ${new Date(lastAutosaveTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : `Last saved: ${new Date(lastAutosaveTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : isDe
                    ? 'Noch kein Autosave in dieser Sitzung'
                    : 'No autosave yet this session'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'Verknüpfe eine lokale Backup-Datei auf deinem PC oder Tablet, damit alle Änderungen direkt in diese Datei geschrieben werden. Alternativ sichert Autosave deine Daten lückenlos im Browser-Speicher dieses Geräts.'
                : 'Link a local backup file on your PC or tablet so changes write directly into it. Alternatively, Autosave keeps data safe in offline browser storage.'}
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

            {/* Windows Launcher Download */}
            <div className="pt-1">
              <button
                onClick={handleDownloadWindowsLauncher}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold transition-all shadow-xs cursor-pointer text-xs"
                title={isDe ? 'Erstellt ein Desktop-Icon und startet CS2Freitag als eigenständige App im rahmenlosen Vollfenster (Edge/Chrome PWA)' : 'Creates a desktop shortcut and starts CS2Freitag as standalone PWA app'}
              >
                <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{isDe ? 'Windows-App-Starter (.bat) herunterladen' : 'Download Windows Launcher (.bat)'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[10px] text-zinc-400 space-y-1.5">
              <p>
                <strong className="text-zinc-300">{isDe ? '💡 Hinweis zu PC & Smartphone:' : '💡 Note for PC & Mobile:'}</strong>{' '}
                {isDe
                  ? 'Auf PCs und Android (Chrome/Edge) wird die Datei über die Dateisystem-Schnittstelle direkt an deinem gewählten Speicherort aktualisiert. In Firefox und Apple iOS (Safari) funktioniert „Lokale Backup-Datei“ (direkte Dateiverknüpfung) nicht – dort sichert Autosave im Offline-Speicher (PWA/Browser Storage) des Geräts.'
                  : 'On PC and Android (Chrome/Edge), files write directly to your chosen folder. "Local Backup File" (direct file linking) does not work in Firefox or Apple iOS (Safari) – Autosave keeps data in offline browser storage there.'}
              </p>
              {onOpenInstallationHelp && (
                <button
                  type="button"
                  onClick={onOpenInstallationHelp}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline decoration-amber-500/40 underline-offset-2 active:scale-[0.98] transition-all cursor-pointer text-left"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isDe
                      ? 'Hilfe zu Firefox (Lesezeichenleiste / App installieren), PWA & lokalen Backups öffnen'
                      : 'Open Help: Firefox (Bookmarks Bar / Install App), PWA & Local Backups'}
                  </span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* 2. CLOUD SYNC */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3.5 shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 font-mono uppercase font-bold text-zinc-300 min-w-0">
                <Globe className="w-4 h-4 text-sky-400 shrink-0" />
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

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-semibold text-zinc-300 text-left">
                  {isDe ? 'Auto-Abgleich beim Anmelden' : 'Auto-Sync on Login'}
                </span>
                <div className="flex items-center gap-2 ml-auto shrink-0">
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
                    aria-label={isDe ? 'Auto-Abgleich beim Anmelden' : 'Auto-Sync on Login'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isAutoCloudSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onExportFullBackup();
                    showNotification(isDe ? 'ZIP-Backup erfolgreich exportiert!' : 'ZIP backup exported successfully!');
                  } catch {
                    showNotification(isDe ? 'Fehler beim Erstellen des ZIP-Backups.' : 'Failed to export ZIP backup.', true);
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold transition-all shadow-xs cursor-pointer text-xs whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{isDe ? 'ZIP exportieren' : 'Export ZIP'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    if (onExportFullBackupJson) {
                      await onExportFullBackupJson();
                      showNotification(isDe ? 'JSON-Backup erfolgreich exportiert!' : 'JSON backup exported successfully!');
                    }
                  } catch {
                    showNotification(isDe ? 'Fehler beim Erstellen des JSON-Backups.' : 'Failed to export JSON backup.', true);
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold transition-all shadow-xs cursor-pointer text-xs whitespace-nowrap"
              >
                <FileCode className="w-4 h-4 shrink-0 text-sky-400" />
                <span>{isDe ? 'JSON exportieren' : 'Export JSON'}</span>
              </button>

              <button
                type="button"
                onClick={() => fullBackupInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer text-xs whitespace-nowrap"
              >
                <Upload className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{isDe ? 'Wiederherstellen' : 'Restore'}</span>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-rose-300 text-xs uppercase tracking-wide">
                  {isDe ? 'Auf Standardwerte zurücksetzen' : 'Reset to Default Maps'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isDe
                    ? 'Eigene Änderungen gehen verloren.'
                    : 'Custom changes will be lost.'}
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
                <span className="text-zinc-400">
                  Community-Projekt (
                  <span className="font-bold text-blue-400">callmebythecolor</span>)
                </span>
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
            <div className="w-full max-w-lg rounded-2xl border border-rose-500/50 bg-zinc-900 p-6 shadow-2xl text-zinc-100 space-y-4">
              <h3 className="text-base font-bold text-rose-400">
                {isDe ? 'Wirklich auf Standardwerte zurücksetzen?' : 'Reset to Default Maps?'}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Dadurch werden alle Karten und Callouts auf den Auslieferungszustand zurückgesetzt. Deine manuell gespeicherten Änderungen und Favoriten werden gelöscht.'
                  : 'This will reset all maps and callouts to factory defaults. Your custom edits and favorites will be cleared.'}
              </p>

              {/* Sicherungsoptionen vor dem Zurücksetzen */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  {isDe ? 'Vor dem Zurücksetzen sichern:' : 'Back up before resetting:'}
                </p>

                {/* 1. ZIP-Backup */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/90 hover:border-emerald-500/40 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupZipBeforeReset}
                    onChange={(e) => setBackupZipBeforeReset(e.target.checked)}
                    disabled={isBackingUpAndResetting}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-emerald-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>{isDe ? 'ZIP-Backup erstellen' : 'Create ZIP Backup'}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {isDe
                        ? 'Vollständiges ZIP-Archiv (JSON + Radarbilder) herunterladen'
                        : 'Download complete ZIP archive (JSON + radar images)'}
                    </p>
                  </div>
                </label>

                {/* 2. Speicherung Lokale Datei */}
                <label className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/90 hover:border-amber-500/40 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupLocalFileBeforeReset}
                    onChange={(e) => setBackupLocalFileBeforeReset(e.target.checked)}
                    disabled={isBackingUpAndResetting}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-amber-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>{isDe ? 'Speicherung Lokale Datei' : 'Save Local File'}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {connectedFileName
                        ? isDe
                          ? `In verknüpfte Datei speichern: ${connectedFileName}`
                          : `Save to linked file: ${connectedFileName}`
                        : isDe
                        ? 'Aktuellen Stand als lokale JSON-Datei speichern'
                        : 'Save current state as a local JSON file'}
                    </p>
                  </div>
                </label>

                {/* 3. Cloud-Synchronisierung */}
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/90 hover:border-sky-500/40 transition-colors">
                  <input
                    type="checkbox"
                    id="reset-backup-cloud-checkbox"
                    checked={backupCloudBeforeReset}
                    onChange={(e) => setBackupCloudBeforeReset(e.target.checked)}
                    disabled={isBackingUpAndResetting || !currentUser}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-sky-500 cursor-pointer disabled:opacity-40"
                  />
                  <label
                    htmlFor="reset-backup-cloud-checkbox"
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        <span>{isDe ? 'Cloud-Synchronisierung' : 'Cloud Synchronization'}</span>
                      </div>
                      {!currentUser && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onLogin();
                          }}
                          className="px-2 py-0.5 rounded bg-white text-zinc-950 hover:bg-zinc-200 text-[10px] font-bold cursor-pointer"
                        >
                          {isDe ? 'Mit Google anmelden' : 'Sign in with Google'}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {currentUser
                        ? isDe
                          ? `Vor dem Zurücksetzen in die Google Cloud hochladen (${currentUser.email || currentUser.displayName})`
                          : `Upload to Google Cloud before resetting (${currentUser.email || currentUser.displayName})`
                        : isDe
                        ? 'Nicht angemeldet – zum Cloud-Backup zuerst anmelden'
                        : 'Not signed in – sign in to enable cloud backup'}
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isBackingUpAndResetting}
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={
                    isBackingUpAndResetting ||
                    (!backupZipBeforeReset && !backupLocalFileBeforeReset && !(backupCloudBeforeReset && currentUser))
                  }
                  onClick={async () => {
                    setIsBackingUpAndResetting(true);
                    const completedParts: string[] = [];
                    try {
                      if (backupZipBeforeReset) {
                        await onExportFullBackup();
                        completedParts.push('ZIP');
                      }
                      if (backupLocalFileBeforeReset && onManualSaveNow) {
                        const saved = await onManualSaveNow();
                        if (!saved) {
                          throw new Error('Local file save failed');
                        }
                        completedParts.push(isDe ? 'Lokale Datei' : 'Local File');
                      }
                      if (backupCloudBeforeReset && currentUser) {
                        await onUploadToCloud();
                        completedParts.push('Cloud');
                      }
                      await new Promise((resolve) => setTimeout(resolve, 350));
                      setShowResetModal(false);
                      onResetDefaults();
                      showNotification(
                        isDe
                          ? `Sicherung (${completedParts.join(', ')}) erstellt & auf Standardwerte zurückgesetzt!`
                          : `Backup (${completedParts.join(', ')}) completed & reset to defaults!`
                      );
                    } catch (err) {
                      console.warn('Backup before reset failed:', err);
                      showNotification(
                        isDe
                          ? 'Fehler bei der Datensicherung. Zurücksetzen wurde abgebrochen.'
                          : 'Backup failed. Reset cancelled.',
                        true
                      );
                    } finally {
                      setIsBackingUpAndResetting(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer shadow disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isBackingUpAndResetting
                      ? isDe
                        ? 'Sichere...'
                        : 'Backing up...'
                      : backupZipBeforeReset && !backupLocalFileBeforeReset && !(backupCloudBeforeReset && currentUser)
                      ? isDe
                        ? 'ZIP-Backup & Zurücksetzen'
                        : 'ZIP Backup & Reset'
                      : isDe
                      ? 'Sichern & Zurücksetzen'
                      : 'Backup & Reset'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isBackingUpAndResetting}
                  onClick={() => {
                    setShowResetModal(false);
                    onResetDefaults();
                    showNotification(isDe ? 'Auf Standardwerte zurückgesetzt!' : 'Reset to defaults successful!');
                  }}
                  className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer shadow disabled:opacity-50"
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
