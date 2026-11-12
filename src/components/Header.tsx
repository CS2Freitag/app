import React from 'react';
import { Globe, Crosshair, Settings, Cloud, CloudOff, Smartphone, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { Language, Theme } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppVersion } from '../services/versionService';

interface HeaderProps {
  theme?: Theme;
  onToggleTheme?: () => void;
  lang: Language;
  onToggleLanguage: () => void;
  totalMapsCount: number;
  totalCalloutsCount: number;
  onOpenSettings?: () => void;
  onOpenTacticsHelp?: () => void;
  isLoggedIn?: boolean;
  isAutoCloudSyncEnabled?: boolean;
  installedVersion?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLanguage,
  totalMapsCount,
  totalCalloutsCount,
  onOpenSettings,
  isLoggedIn = false,
  isAutoCloudSyncEnabled = true,
  installedVersion: propInstalledVersion,
  latestVersion: propLatestVersion,
  hasUpdate: propHasUpdate,
}) => {
  const isDe = lang === 'de';
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const infoRef = React.useRef<HTMLDivElement>(null);

  // Online / Offline & PWA App Installation Status
  const isOnline = useOnlineStatus();
  const { isInstalled } = usePWAInstall();

  // App Version & Update Status
  const versionState = useAppVersion();
  const curInstalledVersion = propInstalledVersion || versionState.installedVersion;
  const curLatestVersion = propLatestVersion || versionState.latestVersion;
  const curHasUpdate = propHasUpdate !== undefined ? propHasUpdate : versionState.hasUpdate;

  // Symbol 1: Cloud-Sync Status (Rot = Nicht angemeldet | Orange = Angemeldet ohne Auto-Abgleich | Grün = Alles aktiviert)
  let cloudColorClasses = 'border-rose-500/50 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 shadow-[0_0_8px_rgba(244,63,94,0.25)]';
  let cloudTooltip = isDe
    ? 'Google Cloud-Sync: Nicht angemeldet (Rot)'
    : 'Google Cloud Sync: Not signed in (Red)';

  if (isLoggedIn) {
    if (isAutoCloudSyncEnabled) {
      cloudColorClasses = 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.25)]';
      cloudTooltip = isDe
        ? 'Google Cloud-Sync: Alles aktiviert (Angemeldet & Auto-Abgleich an)'
        : 'Google Cloud Sync: Fully active (Signed in & Auto-sync on)';
    } else {
      cloudColorClasses = 'border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 shadow-[0_0_8px_rgba(251,191,36,0.2)]';
      cloudTooltip = isDe
        ? 'Google Cloud-Sync: Angemeldet (Ohne Auto-Abgleich beim Anmelden)'
        : 'Google Cloud Sync: Signed in (Without auto-sync on login)';
    }
  }

  // Symbol 2: App-Installation (Installiert / Nicht installiert)
  const installColorClasses = isInstalled
    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.25)]'
    : 'border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 shadow-[0_0_8px_rgba(251,191,36,0.2)]';

  const installTooltip = isInstalled
    ? (isDe ? 'App-Status: Als App installiert (PWA)' : 'App Status: Installed as app (PWA)')
    : (isDe ? 'App-Status: Nicht installiert (Im Browser geöffnet)' : 'App Status: Not installed (Running in browser)');

  // Symbol 3: App-Version & Updates (Grün = Aktuell / Orange = Update verfügbar)
  const versionColorClasses = curHasUpdate
    ? 'border-amber-400 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.4)]'
    : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.25)]';

  const versionTooltip = curHasUpdate
    ? (isDe ? `Neues Update verfügbar: v${curLatestVersion} (Installiert: v${curInstalledVersion})` : `New update available: v${curLatestVersion} (Installed: v${curInstalledVersion})`)
    : (isDe ? `App-Version: v${curInstalledVersion} (Aktuell)` : `App Version: v${curInstalledVersion} (Up to date)`);

  // Close tooltip on outside click or escape key
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setIsTooltipOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTooltipOpen(false);
      }
    };

    if (isTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTooltipOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo combined with interactive Info Trigger */}
        <div className="flex items-center gap-3">
          <div
            ref={infoRef}
            className="relative"
            onMouseEnter={() => setIsTooltipOpen(true)}
            onMouseLeave={() => setIsTooltipOpen(false)}
          >
            <button
              type="button"
              onClick={() => setIsTooltipOpen((prev) => !prev)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                isTooltipOpen
                  ? 'border-amber-400 text-amber-400 bg-amber-400/20 ring-2 ring-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'bg-zinc-900 border-zinc-700 text-white hover:text-amber-400 hover:border-amber-400 hover:bg-amber-400/10 hover:shadow-[0_0_12px_rgba(251,191,36,0.25)] active:text-amber-400 active:border-amber-400 active:bg-amber-400/20'
              }`}
              title={isDe ? 'Taktik-Info anzeigen' : 'Show tactical info'}
              aria-label={isDe ? 'Informationen zu Callouts und Karten' : 'Information about callouts and maps'}
              aria-expanded={isTooltipOpen}
            >
              <Crosshair className="w-5 h-5 transition-colors" />
            </button>

            {/* Tooltip Popup */}
            {isTooltipOpen && (
              <div
                role="tooltip"
                className="fixed sm:absolute top-16 left-3 right-3 sm:top-full sm:left-0 sm:right-auto sm:mt-2.5 z-50 sm:w-80 max-w-sm mx-auto sm:mx-0 p-3.5 rounded-lg border border-amber-500/40 bg-zinc-950/95 shadow-2xl shadow-black/90 backdrop-blur-md text-left transition-all animate-in fade-in-50 zoom-in-95 duration-150"
              >
                {/* Arrow pointing to the top-left crosshair icon */}
                <div className="hidden sm:block absolute -top-1.5 left-3.5 w-3 h-3 bg-zinc-950 border-t border-l border-amber-500/40 rotate-45" />

                <div className="relative">
                  {/* Header accent */}
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px] tracking-wide">
                      <span className="text-amber-400 font-bold">★</span>
                      <span>{isDe ? 'Taktik- & Karten-Hub' : 'Tactics & Maps Hub'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTooltipOpen(false);
                      }}
                      className="sm:hidden text-zinc-400 hover:text-white p-0.5 rounded text-[11px]"
                      aria-label="Schließen"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tooltip body with exact requested text */}
                  <p className="text-zinc-200 text-xs leading-relaxed font-normal">
                    {isDe
                      ? 'Passe bestehende Callouts flexibel an oder erstelle komplett eigene Karten-Callouts, die du speichern und teilen kannst – maßgeschneidert nur für dich und dein Team.'
                      : 'Customize existing callouts flexibly or create completely custom map callouts that you can share and save – tailored just for you and your team.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-base uppercase text-white">
                CS2<span className="text-zinc-400 font-light">Freitag</span>
              </span>
              {/* Tactical PWA badge: hidden on mobile, visible on desktop */}
              <span className="hidden sm:inline-flex text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400 items-center gap-1.5">
                Tactical PWA
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <span>{totalMapsCount} {isDe ? 'Karten' : 'Maps'}</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span>{totalCalloutsCount}+ Callouts</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>

              {/* Individual Status Icons: Cloud-Sync & App Installation (no text, compact to match text size) */}
              <div className="inline-flex items-center gap-1 ml-0.5">
                {/* 1. Cloud-Sync Symbol (Online: Grün / Offline: Orange) */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={cloudTooltip}
                  aria-label={cloudTooltip}
                  className={`w-4.5 h-4.5 sm:w-[19px] sm:h-[19px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs active:scale-90 ${cloudColorClasses}`}
                >
                  {isLoggedIn ? (
                    <Cloud className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.2} />
                  ) : (
                    <CloudOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.2} />
                  )}
                </button>

                {/* 2. App Installation Symbol (Installiert: Grün / Nicht installiert: Orange) */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={installTooltip}
                  aria-label={installTooltip}
                  className={`w-4.5 h-4.5 sm:w-[19px] sm:h-[19px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs active:scale-90 ${installColorClasses}`}
                >
                  <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.2} />
                </button>

                {/* 3. App-Version / Update-Status Symbol (Grün = Aktuell / Orange = Update verfügbar) */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={versionTooltip}
                  aria-label={versionTooltip}
                  className={`w-4.5 h-4.5 sm:w-[19px] sm:h-[19px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs active:scale-90 ${versionColorClasses}`}
                >
                  {curHasUpdate ? (
                    <ArrowUpCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.4} />
                  ) : (
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              title={isDe ? 'Einstellungen & Backup' : 'Settings & Backup'}
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{isDe ? 'Einstellungen' : 'Settings'}</span>
            </button>
          )}

          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            title={isDe ? 'Sprache wechseln (DE / EN)' : 'Switch language (EN / DE)'}
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono uppercase font-bold">{lang.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
