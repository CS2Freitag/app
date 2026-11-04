import React, { useState } from 'react';
import { Download, Smartphone, X, ExternalLink, CheckCircle2, Wifi, WifiOff, Monitor, FileCode } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Language } from '../types';
import { FAVICON_ICO_BASE64 } from '../data/embeddedIcoBase64';

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, hasSW, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showModal, setShowModal] = useState(false);

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
    } catch (e) {
      console.warn('Download error:', e);
    }
  };

  // If already running as an installed standalone app, show small badge
  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>PWA</span>
      </span>
    );
  }

  const isDe = lang === 'de';

  const handleClick = () => {
    if (isInstallable) {
      install().then((accepted) => {
        if (!accepted) {
          setShowModal(true);
        }
      });
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        title={
          isDe
            ? 'CS2Freitag als PWA installieren (online & offline nutzbar)'
            : 'Install CS2Freitag as PWA (works online & offline)'
        }
      >
        <Download className="w-3.5 h-3.5 text-amber-500" />
        <span>{isDe ? 'App Installieren' : 'Install App'}</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isDe ? 'PWA App-Installation' : 'PWA App Installation'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {isDe
                      ? 'Nativ auf PC & Smartphone ausführbar • 100% offline fähig'
                      : 'Runs natively on PC & smartphone • 100% offline capable'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct 1-Click Install Button if browser supports it directly */}
            {isInstallable && (
              <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent border border-amber-500/40">
                <div className="font-semibold text-xs text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>{isDe ? 'Bereit zur Installation:' : 'Ready to install:'}</span>
                </div>
                <button
                  onClick={async () => {
                    const success = await install();
                    if (success) setShowModal(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDe ? 'Jetzt auf diesem Gerät installieren' : 'Install on this device now'}</span>
                </button>
              </div>
            )}

            {/* Status Badges */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {isOnline ? (isDe ? 'Online' : 'Online') : (isDe ? 'Offline-Modus' : 'Offline')}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {isDe ? 'Verbindung' : 'Connection'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {hasSW ? (isDe ? 'Service Worker aktiv' : 'Service Worker active') : (isDe ? 'Bereit' : 'Ready')}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {isDe ? 'Offline-Cache aktiv' : 'Offline cache active'}
                  </div>
                </div>
              </div>
            </div>

            {/* Direct Open in New Tab if inside an iframe */}
            {isInIframe && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <span>ℹ️ {isDe ? 'Eingebettete Vorschau erkannt' : 'Preview detected'}</span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2.5">
                  {isDe
                    ? 'In iframes blockieren Desktop-Browser native Installations-Popups. Öffne die App in einem regulären Tab, um sie per Adressleisten-Icon oder 1-Klick zu installieren:'
                    : 'Browsers restrict native install prompts inside iframes. Open the app in a tab to install directly:'}
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

            {/* Instructions per Platform */}
            <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
              {/* Desktop Chrome / Edge */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-500" />
                  <span>{isDe ? 'Computer / Desktop (Chrome, Edge, Brave)' : 'Desktop (Chrome, Edge, Brave)'}</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Klicke oben rechts in der Adressleiste auf das Installations-Symbol (⊕ oder Monitor-Symbol) oder im Browsermenü (⋮) auf "CS2Freitag installieren". Die App öffnet sich als eigenständiges Fenster auf deinem PC.'
                    : 'Click the install icon (⊕ or computer icon) in the browser address bar, or click menu (⋮) -> "Install CS2Freitag".'}
                </p>
              </div>

              {/* Android */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>{isDe ? 'Android (Chrome / Edge / Samsung)' : 'Android (Chrome)'}</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Tippe im Browsermenü (⋮) auf "App installieren" oder "Zum Startbildschirm hinzufügen".'
                    : 'Tap the menu (⋮) and select "Install app" or "Add to Home screen".'}
                </p>
              </div>

              {/* iOS Safari */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  <span>{isDe ? 'Apple iOS (iPhone / iPad Safari)' : 'Apple iOS (Safari)'}</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {isDe
                    ? '1. Tippe in Safari unten auf den "Teilen"-Button (Viereck mit Pfeil). 2. Scrolle nach unten und wähle "Zum Home-Bildschirm".'
                    : '1. Tap Share in Safari toolbar. 2. Tap "Add to Home Screen".'}
                </p>
              </div>
              {/* Direct Windows Solutions */}
              <div className="p-3 rounded-xl bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/30 space-y-2">
                <div className="font-bold text-sky-900 dark:text-sky-300 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-500" />
                  <span>{isDe ? 'Direkte Windows-Lösungen (Desktop-Starter)' : 'Direct Windows Desktop Solutions'}</span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {isDe
                    ? 'Falls dein Browser den nativen Installationsdialog nicht anzeigt (z. B. Firefox auf PC), lade einen Starter mit 1 Klick herunter:'
                    : 'If your browser does not show the install icon, download a 1-click Windows desktop starter:'}
                </p>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    onClick={handleDownloadWindowsLauncher}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-sky-500 text-left transition-colors text-xs font-semibold text-zinc-900 dark:text-white"
                  >
                    <FileCode className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="truncate">{isDe ? 'App-Starter (.bat)' : 'App Launcher (.bat)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                PWA: Standalone / 100% Offline
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold transition-colors"
              >
                {isDe ? 'Schließen' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
