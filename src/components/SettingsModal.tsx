import React, { useRef, useState } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  RotateCcw,
  Globe,
  Smartphone,
  CheckCircle2,
  FileJson,
  Layers,
  X,
  Share2,
  AlertCircle,
  Monitor,
  ExternalLink,
  FileCode,
  Save,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Gamepad2,
} from 'lucide-react';
import { MapData, Language, Theme } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FAVICON_ICO_BASE64 } from '../data/embeddedIcoBase64';
import { loadUserCloudData } from '../services/firebase';
import { UploadConflictModal } from './UploadConflictModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  favorites: string[];
  theme?: Theme;
  onToggleTheme?: () => void;
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
  connectedFileName?: string;
  lastAutosaveTs?: number;
  onChooseSaveLocation?: () => Promise<boolean>;
  onManualSaveNow?: () => Promise<boolean>;
  onLoadFromFileLocation?: () => Promise<boolean>;
  onDisconnectFileLocation?: () => Promise<void>;
  onStartQuiz?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  maps,
  favorites,
  theme,
  onToggleTheme,
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
  connectedFileName = '',
  lastAutosaveTs = 0,
  onChooseSaveLocation,
  onManualSaveNow,
  onLoadFromFileLocation,
  onDisconnectFileLocation,
  onStartQuiz,
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

  // Conflict-checked manual upload
  const handleTriggerUpload = async () => {
    if (!currentUser) return;
    setIsCheckingUploadConflict(true);
    try {
      const { cloudMaps } = await loadUserCloudData(currentUser.uid);
      let hasConflict = false;
      for (const localMap of maps) {
        const cloudMap = cloudMaps.find((cm) => cm.id === localMap.id);
        if (cloudMap && cloudMap.updatedAt) {
          const localTs = localMap.updatedAt || 0;
          if (
            cloudMap.updatedAt > localTs &&
            JSON.stringify(cloudMap.callouts) !== JSON.stringify(localMap.callouts)
          ) {
            hasConflict = true;
            break;
          }
        }
      }

      if (hasConflict) {
        setShowUploadConflict(true);
        return;
      }

      // No conflict -> normal upload
      await onUploadToCloud();
      showNotification(
        isDe ? 'Daten erfolgreich in die Cloud hochgeladen!' : 'Data successfully uploaded to cloud!'
      );
    } catch (err) {
      console.error('Upload error:', err);
      showNotification(isDe ? 'Upload fehlgeschlagen!' : 'Upload failed!', true);
    } finally {
      setIsCheckingUploadConflict(false);
    }
  };

  const handleForceOverwriteCloud = async () => {
    setShowUploadConflict(false);
    try {
      await onUploadToCloud();
      showNotification(
        isDe
          ? 'Cloud erfolgreich mit deinem lokalen Stand überschrieben!'
          : 'Cloud successfully overwritten with your local version!'
      );
    } catch (err) {
      showNotification(isDe ? 'Fehler beim Überschreiben der Cloud!' : 'Failed to overwrite cloud!', true);
    }
  };

  const handleSaveLocallyAndDownloadCloud = async () => {
    setShowUploadConflict(false);
    try {
      onExportFullBackup();
      await onDownloadFromCloud();
      showNotification(
        isDe
          ? 'Lokaler Stand als Backup gesichert & neuester Stand aus der Cloud geladen!'
          : 'Local data backed up & latest cloud version loaded!'
      );
    } catch (err) {
      showNotification(isDe ? 'Fehler beim Laden aus der Cloud!' : 'Failed to load from cloud!', true);
    }
  };

  const handleKeepLocallyAndSkip = () => {
    setShowUploadConflict(false);
    showNotification(
      isDe
        ? 'Änderungen lokal behalten. Cloud wurde nicht überschrieben.'
        : 'Local changes kept. Cloud not overwritten.'
    );
  };

  const handleConfirmDownloadCloud = async () => {
    setShowDownloadConfirm(false);
    try {
      await onDownloadFromCloud();
      showNotification(
        isDe ? 'Daten erfolgreich aus der Cloud geladen!' : 'Data successfully fetched from cloud!'
      );
    } catch (err) {
      showNotification(isDe ? 'Fehler beim Laden aus der Cloud!' : 'Failed to download from cloud!', true);
    }
  };

  const handleDownloadWindowsLauncher = () => {
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-mkiapnqfs3whcrnq7ubhwi-408525611466.europe-west3.run.app/';
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-mkiapnqfs3whcrnq7ubhwi-408525611466.europe-west3.run.app';
      const iconUrl = `${origin}/launcher-icon.ico`;

      // Split base64 ico string into batch-safe chunks (<1200 chars per line)
      const chunkSize = 1200;
      const chunks: string[] = [];
      for (let i = 0; i < FAVICON_ICO_BASE64.length; i += chunkSize) {
        chunks.push(FAVICON_ICO_BASE64.slice(i, i + chunkSize));
      }

      const b64WriteLines = chunks
        .map((chunk, idx) => (idx === 0 ? `> "%DIR%\\icon.b64" echo ${chunk}\r\n` : `>> "%DIR%\\icon.b64" echo ${chunk}\r\n`))
        .join('');

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
        `if not exist "%ICO_PATH%" (\r\n` +
        b64WriteLines +
        `)\r\n` +
        `\r\n` +
        `powershell -NoProfile -ExecutionPolicy Bypass -Command ^\r\n` +
        `  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^\r\n` +
        `  "if (-not (Test-Path '%ICO_PATH%')) { try { (New-Object System.Net.WebClient).DownloadFile('%ICON_URL%', '%ICO_PATH%') } catch {} };" ^\r\n` +
        `  "if ((Test-Path '%DIR%\\icon.b64') -and (-not (Test-Path '%ICO_PATH%'))) { try { $raw = Get-Content '%DIR%\\icon.b64' -Raw; $b64 = $raw -replace '\s+',''; [System.IO.File]::WriteAllBytes('%ICO_PATH%', [System.Convert]::FromBase64String($b64)) } catch {} };" ^\r\n` +
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
      showNotification(isDe ? 'CS2Freitag-App.bat heruntergeladen! Startet die App im eigenständigen Fenster.' : 'CS2Freitag-App.bat downloaded! Launches app in standalone window.');
    } catch {
      showNotification(isDe ? 'Download fehlgeschlagen' : 'Download failed', true);
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
        showNotification(
          isDe
            ? 'Gesamtes Backup wurde erfolgreich geladen!'
            : 'Full backup restored successfully!'
        );
      } catch (err) {
        showNotification(
          isDe ? 'Fehler beim Laden des Backups!' : 'Failed to parse backup file.',
          true
        );
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
          ? `Karte "${targetMap.name}" wurde als ZIP-Paket exportiert!`
          : `Map "${targetMap.name}" exported as ZIP package!`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
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
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
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

        {/* Hidden File Inputs */}
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
          {/* 1. PWA & DESKTOP APP CENTER */}
          <div className="p-4 rounded-xl bg-zinc-950/70 dark:bg-zinc-950/70 border border-amber-500/30 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-200 dark:text-zinc-200">
                <Monitor className="w-4 h-4 text-sky-400" />
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>{isDe ? 'App-Installation (PC & Smartphone)' : 'App Installation (PC & Mobile)'}</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                isInstalled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {isInstalled 
                  ? (isDe ? 'Installiert (Standalone)' : 'Installed (Standalone)') 
                  : (isDe ? 'Bereit zur Installation' : 'Ready to install')}
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'CS2Freitag kann auf Windows-PCs, Android-Smartphones und iPhones wie eine vollwertige native App mit eigenem Desktop-/Home-Icon und 100% Offline-Funktion installiert werden.'
                : 'CS2Freitag can be installed on Windows PCs, Android phones, and iPhones as a standalone native app with offline support.'}
            </p>

            {/* If inside an iframe (like AI Studio preview pane), show a direct breakout notice */}
            {isInIframe && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{isDe ? 'Eingebettete Vorschau (iFrame) aktiv' : 'Embedded preview (iFrame) active'}</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {isDe
                    ? 'Browser sperren automatische Installationsdialoge innerhalb von Vorschau-iFrames. Öffne die Seite in einem regulären Tab, um die native 1-Klick-Installation zu nutzen:'
                    : 'Browsers block install prompts inside iframes. Open directly in a new tab for 1-click installation:'}
                </p>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Im neuen Browser-Tab öffnen' : 'Open in new tab'}</span>
                </a>
              </div>
            )}

            {/* Native 1-Click PWA Install Button */}
            {!isInstalled ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      if (isInstallable) {
                        const accepted = await install();
                        if (!accepted) setShowInstallGuide((prev) => !prev);
                      } else {
                        setShowInstallGuide((prev) => !prev);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all shadow-md active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isInstallable
                        ? (isDe ? 'Jetzt als App installieren (1-Klick)' : 'Install as App now (1-click)')
                        : (isDe ? 'Installations-Anleitung & Browser-Dialog' : 'Installation Guide & Browser Dialog')}
                    </span>
                  </button>
                </div>

                {/* Extended Platform Instructions */}
                {showInstallGuide && (
                  <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3 animate-in fade-in-50 text-[11px]">
                    <div className="space-y-2 text-zinc-300">
                      {/* Windows Chrome/Edge */}
                      <div className="p-2.5 rounded-md bg-zinc-950 border border-zinc-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Monitor className="w-3.5 h-3.5 text-sky-400" />
                          <span>{isDe ? 'Windows PC (Google Chrome & Microsoft Edge):' : 'Windows PC (Chrome & Edge):'}</span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">
                          {isDe
                            ? 'Klicke in der Adressleiste des Browsers ganz rechts auf das Symbol "App installieren" (⊕ oder Monitor-Symbol). Alternativ im Browsermenü (⋮) auf "CS2Freitag installieren" (Chrome) bzw. "Apps -> Diese Website als App installieren" (Edge) klicken.'
                            : 'Click the install icon (⊕ or computer icon) in the browser address bar, or click Menu -> "Install CS2Freitag".'}
                        </p>
                      </div>

                      {/* Windows Firefox Notice */}
                      <div className="p-2.5 rounded-md bg-zinc-950 border border-zinc-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isDe ? 'Hinweis zu Mozilla Firefox auf dem PC:' : 'Note for Mozilla Firefox on PC:'}</span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">
                          {isDe
                            ? 'Mozilla Firefox auf Desktop-PCs unterstützt herstellerseitig generell keine PWA-Installation. Nutze auf Windows bitte unsere untenstehende 1-Klick-Starter-Datei (.bat) oder öffne die Seite in Edge/Chrome.'
                            : 'Mozilla Firefox Desktop does not natively support PWAs. Use our Windows App Starter (.bat) below or open in Edge/Chrome.'}
                        </p>
                      </div>

                      {/* Android */}
                      <div className="p-2.5 rounded-md bg-zinc-950 border border-zinc-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Android (Chrome / Samsung / Edge):' : 'Android (Chrome / Samsung):'}</span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">
                          {isDe
                            ? 'Tippe im Browsermenü oben rechts (⋮) auf "App installieren" oder "Zum Startbildschirm hinzufügen".'
                            : 'Tap menu (⋮) -> "Install app" or "Add to Home screen".'}
                        </p>
                      </div>

                      {/* iOS Safari */}
                      <div className="p-2.5 rounded-md bg-zinc-950 border border-zinc-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-purple-400">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Apple iOS (iPhone / iPad Safari):' : 'Apple iOS (Safari):'}</span>
                        </div>
                        <p className="text-zinc-400 leading-relaxed">
                          {isDe
                            ? 'Tippe in der Safari-Symbolleiste unten auf den "Teilen"-Button (Viereck mit Pfeil nach oben), scrolle etwas nach unten und wähle "Zum Home-Bildschirm".'
                            : 'Tap Share icon in Safari toolbar -> "Add to Home Screen".'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isDe 
                    ? 'CS2Freitag ist bereits als PWA auf diesem Gerät installiert und läuft im eigenständigen Fenster.' 
                    : 'CS2Freitag is already installed as a PWA on this device.'}
                </span>
              </div>
            )}

            {/* DEDICATED WINDOWS PC SOLUTIONS (Direct .bat App Starter & .url Shortcut) */}
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <span>{isDe ? 'Direkte Windows-Lösungen (Desktop & Starter)' : 'Direct Windows Solutions'}</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {isDe
                  ? 'Falls dein Browser den nativen Installationsdialog nicht anbietet, kannst du hier mit einem Klick einen direkten Windows-Desktop-Starter herunterladen:'
                  : 'If your browser does not offer the native prompt, download a direct Windows launcher:'}
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                {/* 1. Windows App Window Launcher .bat */}
                <button
                  onClick={handleDownloadWindowsLauncher}
                  className="flex flex-col items-start p-2.5 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 hover:border-sky-500 text-left transition-all group shadow-sm"
                  title={isDe ? 'Startet CS2Freitag als rahmenloses App-Fenster' : 'Launches CS2Freitag in standalone app window'}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white group-hover:text-sky-400 transition-colors">
                    <FileCode className="w-4 h-4 text-sky-400" />
                    <span>{isDe ? 'Windows App-Starter (.bat)' : 'Windows App Launcher (.bat)'}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 leading-snug">
                    {isDe 
                      ? 'Doppelklick startet die App direkt im separaten Vollfenster ohne Browserleisten.' 
                      : 'Double-click opens standalone window without browser UI.'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. AUTOSAVE & EIGENER SPEICHERORT (PC & SMARTPHONE) */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-emerald-500/30 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-200">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>{isDe ? 'Autosave & Eigener Speicherort' : 'Autosave & Custom Storage Location'}</span>
              </div>

              {/* Autosave Toggle Switch */}
              <div className="flex items-center gap-2">
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
                  title={isDe ? 'Autosave ein- oder ausschalten' : 'Toggle autosave on/off'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutosaveEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'Mit Autosave werden deine Karten, Callouts, Marker und Taktiken automatisch gesichert. Du kannst eine Datei an einem von dir gewählten Ort (z.B. Dokumente, Cloud-Ordner, USB) verknüpfen, in die jede Änderung automatisch direkt geschrieben wird.'
                : 'With Autosave, all your map edits, callouts, and tactics are automatically saved. You can connect a file at a custom folder of your choice (e.g. Documents, Cloud folder, USB) so changes write directly to it.'}
            </p>

            {/* File Connection Status Box */}
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-2 rounded-lg ${connectedFileName ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                    <Save className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-zinc-200 truncate flex items-center gap-1.5">
                      <span>{connectedFileName ? `📁 ${connectedFileName}` : (isDe ? 'Keine Datei verknüpft' : 'No file linked')}</span>
                      {connectedFileName && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          {isDe ? 'Verbunden' : 'Connected'}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {lastAutosaveTs && lastAutosaveTs > 0
                        ? `${isDe ? 'Zuletzt automatisch gesichert: ' : 'Last autosaved: '} ${new Date(lastAutosaveTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : (isDe ? 'Wartet auf erste Speicherung...' : 'Waiting for first save...')}
                    </p>
                  </div>
                </div>

                {connectedFileName && (
                  <button
                    onClick={async () => {
                      if (onDisconnectFileLocation) await onDisconnectFileLocation();
                      showNotification(isDe ? 'Datei-Verknüpfung getrennt.' : 'File unlinked.');
                    }}
                    className="text-[10px] font-bold text-zinc-400 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 cursor-pointer"
                  >
                    {isDe ? 'Trennen' : 'Unlink'}
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons: Choose Location, Manual Save Now, Load from File */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* 1. Choose Location */}
              <button
                onClick={async () => {
                  if (onChooseSaveLocation) {
                    const success = await onChooseSaveLocation();
                    if (success) {
                      showNotification(isDe ? 'Speicherort erfolgreich gewählt & Backup gespeichert!' : 'File location selected & backup saved!');
                    }
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer text-xs"
                title={isDe ? 'Dateidialog öffnen und Speicherort auf PC oder Handy wählen' : 'Open file picker to select custom save location'}
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{isDe ? '📁 Ort wählen' : '📁 Choose File'}</span>
              </button>

              {/* 2. Manual Save Now */}
              <button
                onClick={async () => {
                  if (onManualSaveNow) {
                    const ok = await onManualSaveNow();
                    if (ok) {
                      showNotification(isDe ? 'Stand erfolgreich in Datei gesichert!' : 'Saved to file successfully!');
                    }
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black transition-all shadow-md active:scale-[0.98] cursor-pointer text-xs"
                title={isDe ? 'Aktuellen Stand jetzt sofort in die Datei sichern' : 'Save current state to file immediately'}
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>{isDe ? '💾 Speichern' : '💾 Save Now'}</span>
              </button>

              {/* 3. Load from File */}
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

            {/* Info Box about PC & Mobile File System Access */}
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[10px] text-zinc-400 space-y-1">
              <p>
                <strong className="text-zinc-300">{isDe ? '💡 Hinweis zu PC & Smartphone:' : '💡 Note for PC & Mobile:'}</strong>{' '}
                {isDe
                  ? 'Auf PCs und Android (Chrome/Edge) wird die Datei über die Dateisystem-Schnittstelle direkt an deinem gewählten Speicherort aktualisiert. Auf Apple iOS (Safari) oder Browsern ohne direkten Ordnerzugriff sichert Autosave alles lückenlos im Offline-Speicher (PWA Storage) dieses Geräts, und über "Jetzt manuell speichern" kannst du die Datei jederzeit in deinen Dateien/Downloads abspeichern.'
                  : 'On PC and Android (Chrome/Edge), files write directly to your chosen folder. On Apple iOS (Safari), Autosave saves in offline PWA storage, and "Save Manually Now" downloads to your files.'}
              </p>
            </div>
          </div>

          {/* 3. CLOUD SYNC */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono uppercase font-bold text-zinc-400">
                {isDe ? 'Cloud-Synchronisierung' : 'Cloud Synchronization'}
              </h3>
              {currentUser && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  {isDe ? 'Angemeldet' : 'Logged In'}
                </span>
              )}
            </div>

            {!currentUser ? (
              <div className="space-y-3">
                <p className="text-[11px] text-zinc-400">
                  {isDe
                    ? 'Melde dich an, um deine Karten, Callouts und Favoriten automatisch zwischen PC und Smartphone zu synchronisieren.'
                    : 'Sign in to automatically sync your maps, callouts, and favorites between PC and smartphone.'}
                </p>
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm"
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
                    className="px-2 py-1 text-[10px] font-bold rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    {isDe ? 'Abmelden' : 'Logout'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleTriggerUpload}
                    disabled={isCheckingUploadConflict}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    title={isDe ? 'Aktuelle lokale Daten prüfen & in die Cloud hochladen' : 'Check & upload current local data to cloud'}
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
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs cursor-pointer"
                    title={isDe ? 'Daten aus der Cloud auf dieses Gerät laden' : 'Download data from cloud'}
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
              <FileJson className="w-4 h-4 text-amber-400" />
              <span>{isDe ? 'Komplettes Backup (ZIP & Ordner)' : 'Full System Backup (ZIP & Folder)'}</span>
            </div>

            <p className="text-[11px] text-zinc-400">
              {isDe
                ? 'Speichert alle Einstellungen, Favoriten und Karten inklusive aller Radar-Bilder als ZIP-Archiv oder lädt sie aus einer ZIP-Datei bzw. einem Ordner.'
                : 'Saves all settings, favorites, and maps including radar images as a ZIP archive or restores from ZIP/folder.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={onExportFullBackup}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'Als ZIP sichern' : 'Export ZIP Backup'}</span>
              </button>

              <button
                onClick={() => fullBackupInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs"
              >
                <Upload className="w-4 h-4 text-sky-400" />
                <span>{isDe ? 'ZIP / JSON laden' : 'Load ZIP/JSON'}</span>
              </button>

              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all shadow-xs"
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{isDe ? 'Ordner wählen' : 'Select Folder'}</span>
              </button>
            </div>
          </div>

          {/* 4. EINZELNE KARTE SPEICHERN & LADEN (TEILEN MIT ANDEREN) */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 font-mono uppercase font-bold text-zinc-300">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>{isDe ? 'Einzelne Karte teilen / einspielen (ZIP)' : 'Share / Import Single Map (ZIP)'}</span>
            </div>

            <p className="text-[11px] text-zinc-400">
              {isDe
                ? 'Exportiere eine ausgewählte Karte inklusive aller Callouts und Radar-Bilder als ZIP-Archiv, um sie mit anderen zu teilen. Beim Einspielen wirst du gefragt, ob eine bestehende Karte überschrieben oder als neue Variante (-Neu1) angelegt werden soll.'
                : 'Export a selected map including all callouts and radar images as a ZIP archive to share with friends. When importing, you can choose to overwrite or create a new copy (-Neu1).'}
            </p>

            {/* Single Map Import Button */}
            <div className="space-y-2">
              <button
                onClick={() => singleMapInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold transition-all shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>{isDe ? 'Einzelne Karte importieren (ZIP / JSON)' : 'Import Single Map (ZIP / JSON)'}</span>
              </button>
            </div>

            {/* Single Map Export Picker */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <label className="block text-[11px] font-semibold uppercase text-zinc-400">
                {isDe ? 'Karte zum Exportieren auswählen:' : 'Select map to export:'}
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <select
                  value={selectedMapToExportId}
                  onChange={(e) => setSelectedMapToExportId(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-xs font-semibold"
                >
                  {maps.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.callouts.length} Callouts)
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleExportSelectedSingleMap}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white font-bold transition-colors shrink-0 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Als ZIP herunterladen' : 'Export as ZIP'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. CALLOUT TRAINER / LERN-QUIZ */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 font-mono uppercase font-bold text-amber-400">
              <Gamepad2 className="w-4 h-4" />
              <span>{isDe ? 'Callout-Trainer / Lern-Quiz' : 'Callout Trainer / Quiz'}</span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isDe
                ? 'Teste dein Wissen und lerne die Callouts aller CS2-Karten im interaktiven Quiz auswendig. Wähle eine Map mit mindestens 6 Callouts und versuche, die höchsten Punkte zu erreichen!'
                : 'Test your knowledge and memorize callouts for all CS2 maps in an interactive quiz. Choose any map with at least 6 callouts to start!'}
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onStartQuiz) onStartQuiz();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{isDe ? '🎯 Quiz-Modus starten' : '🎯 Start Quiz Mode'}</span>
            </button>
          </div>

          {/* 6. IMPRESSUM & DATENSCHUTZERKLÄRUNG */}
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
                className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors font-medium underline decoration-amber-400/50 hover:decoration-amber-300 underline-offset-2 shrink-0"
                title="Steam Profil: callmebythecolor"
              >
                <span>Steam Profil ansehen</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Datenschutz-Hinweis */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Datenschutzerklärung & Speicherung</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                {isDe
                  ? '• Lokale Speicherung: Alle Karten, Callouts und Einstellungen werden lokal im Browser (LocalStorage & IndexedDB) deines Geräts gespeichert.\n• Google-Login (Firebase): Bei der optionalen Anmeldung verarbeitet Google Firebase deine E-Mail-Adresse, Anzeigenamen und User-ID ausschließlich zur Sicherung deiner persönlichen Cloud-Backups. Es findet keine Datenweitergabe an Dritte statt.'
                  : '• Local Storage: All maps, callouts, and settings are saved locally in your browser (LocalStorage & IndexedDB).\n• Google Login (Firebase): When signing in optionally, Google Firebase processes your email address, display name, and User-ID solely to manage your personal cloud backups. No data is shared with third parties.'}
              </p>
            </div>

            {/* Valve Disclaimer */}
            <p className="text-[10px] text-zinc-500 leading-relaxed pt-1 border-t border-zinc-800/60">
              {isDe
                ? 'Disclaimer: CS2Freitag ist ein kostenloses, inoffizielles Community-Fan-Projekt und steht in keiner Verbindung zu Valve Corporation. Counter-Strike, CS2, Logos und Kartenbilder sind Marken oder eingetragene Marken der Valve Corporation.'
                : 'Disclaimer: CS2Freitag is a free, unofficial community fan project and is not affiliated with Valve Corporation. Counter-Strike, CS2, logos, and radar images are trademarks or registered trademarks of Valve Corporation.'}
            </p>
          </div>

          {/* 6. FACTORY RESET */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isDe ? 'Auf Standardkarten zurücksetzen' : 'Reset to Default Maps'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
              {isDe ? 'Schließen' : 'Close'}
            </button>
          </div>
        </div>
      </div>

      {/* RESET WARNING & BACKUP MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-4">
              <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {isDe ? 'Achtung: Auf Standard zurücksetzen' : 'Warning: Reset to Defaults'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {isDe ? 'Unwiderrufliche Datenlöschung' : 'Irreversible data deletion'}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Alle benutzerdefinierten Karten, Callout-Änderungen, Rotationen und Zonenbereiche werden gelöscht und durch die offiziellen Standardwerte ersetzt.'
                  : 'All custom maps, callout edits, rotations, and zone areas will be deleted and reset to official defaults.'}
              </p>

              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                <span className="font-bold uppercase font-mono text-zinc-400 block">
                  {isDe ? 'Sicherheitshalber vorher sichern:' : 'Secure backup options before reset:'}
                </span>

                <button
                  onClick={() => {
                    onExportFullBackup();
                    showNotification(isDe ? 'Vollständiges Backup exportiert!' : 'Full backup exported!');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>{isDe ? 'Komplettes Backup erstellen (Empfohlen)' : 'Export Full System Backup'}</span>
                </button>

                <button
                  onClick={handleExportSelectedSingleMap}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sky-300 font-bold transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>{isDe ? `Ausgewählte Karte (${maps.find(m => m.id === selectedMapToExportId)?.name || ''}) sichern` : 'Export Selected Map'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        isDe
                          ? 'Bist du absolut sicher? Alle nicht gesicherten Änderungen gehen verloren!'
                          : 'Are you absolutely sure? All unsaved changes will be lost!'
                      )
                    ) {
                      onResetDefaults();
                      setShowResetModal(false);
                      onClose();
                      showNotification(
                        isDe ? 'Auf Standardkarten zurückgesetzt!' : 'Reset to default maps successfully!'
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg"
                >
                  {isDe ? 'Ja, alles unwiderruflich zurücksetzen' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD CONFLICT MODAL */}
      <UploadConflictModal
        isOpen={showUploadConflict}
        onOverwriteCloud={handleForceOverwriteCloud}
        onSaveLocallyAndDownloadCloud={handleSaveLocallyAndDownloadCloud}
        onKeepLocallyAndSkip={handleKeepLocallyAndSkip}
        onCancel={() => setShowUploadConflict(false)}
        lang={lang}
      />

      {/* DOWNLOAD FROM CLOUD CONFIRMATION MODAL */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 scale-in-95 animate-in">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-4">
              <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  {isDe ? 'CLOUD-STAND LADEN?' : 'LOAD CLOUD DATA?'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {isDe ? 'Lokale Daten überschreiben' : 'Overwrite local device data'}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Achtung: Dies überschreibt deine lokalen Daten bedingungslos mit dem Stand aus der Cloud. Fortfahren?'
                  : 'Warning: This will unconditionally overwrite your local device data with the version from the cloud. Continue?'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleConfirmDownloadCloud}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isDe
                    ? 'Ja, Cloud-Stand jetzt laden'
                    : 'Yes, load cloud version now'}
                </span>
              </button>
              <button
                onClick={() => setShowDownloadConfirm(false)}
                className="w-full text-center py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
