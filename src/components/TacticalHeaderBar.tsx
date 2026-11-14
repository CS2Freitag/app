import React from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  Crosshair,
  Edit3,
  HelpCircle,
  Layers,
  ListFilter,
  Maximize2,
  Minimize2,
  Palette,
  Redo2,
  Share2,
  Shield,
  Trash2,
  Undo2,
} from 'lucide-react';
import { ColorMode, Language, ZoneType } from '../types';

interface TacticalHeaderBarProps {
  lang: Language;
  mapName: string;
  mapCategory: string;
  hasLowerImage: boolean;
  currentLevel: 'upper' | 'lower' | 'both';
  onChangeLevel: (lvl: 'upper' | 'lower' | 'both') => void;
  selectedZoneFilter: ZoneType | 'all';
  onChangeZoneFilter: (z: ZoneType | 'all') => void;
  hasChangesInSession: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasBoardElements: boolean;
  onClearTactics: () => void;
  presetCount: number;
  onOpenPresets: () => void;
  onShare: () => void;
  isEditActive: boolean;
  onEditAction: () => void;
  isTabletLayersOpen: boolean;
  onToggleTabletLayers: () => void;
  colorMode: ColorMode;
  onChangeColorMode: (mode: ColorMode) => void;
  customSelectedCount: number;
  isCustomSelectionActive: boolean;
  onToggleCustomSelection: () => void;
  onOpenHelp: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onTryBack: () => void;
}

export const TacticalHeaderBar: React.FC<TacticalHeaderBarProps> = ({
  lang,
  mapName,
  mapCategory,
  hasLowerImage,
  currentLevel,
  onChangeLevel,
  selectedZoneFilter,
  onChangeZoneFilter,
  hasChangesInSession,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasBoardElements,
  onClearTactics,
  presetCount,
  onOpenPresets,
  onShare,
  isEditActive,
  onEditAction,
  isTabletLayersOpen,
  onToggleTabletLayers,
  colorMode,
  onChangeColorMode,
  customSelectedCount,
  isCustomSelectionActive,
  onToggleCustomSelection,
  onOpenHelp,
  isFullscreen,
  onToggleFullscreen,
  onTryBack,
}) => {
  const isDe = lang === 'de';

  return (
    <header className="h-12 sm:h-14 border-b border-zinc-800 bg-zinc-950/95 px-1.5 sm:px-4 flex items-center justify-between gap-1 sm:gap-2 shrink-0 backdrop-blur-md print:hidden z-40 min-w-0">
      {/* Left: Back, Brand + Map Name, Floor Switcher */}
      <div className="flex items-center gap-1 sm:gap-3 shrink min-w-0">
        <button
          onClick={onTryBack}
          className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer shrink-0"
          title={isDe ? 'Kartenübersicht' : 'Overview'}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden lg:inline">{isDe ? 'Kartenübersicht' : 'Overview'}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-amber-400 font-black tracking-tight text-sm shrink-0">
          <Crosshair className="w-4 h-4" />
          <span className="hidden xl:inline text-white">CS2Freitag</span>
        </div>

        <div className="flex items-center gap-1 min-w-0">
          <h1 className="text-[11px] sm:text-sm font-extrabold uppercase tracking-wider text-white truncate max-w-[72px] sm:max-w-[160px] md:max-w-none">
            {mapName}
          </h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400 hidden xl:inline uppercase">
            {mapCategory}
          </span>
        </div>

        {/* Floor Switcher (Upper / Lower / Both) */}
        {hasLowerImage && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
            <button
              onClick={() => onChangeLevel('upper')}
              className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                currentLevel === 'upper'
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Nur Obere Ebene (O)' : 'Upper floor only (U)'}
            >
              {isDe ? 'O' : 'U'}
            </button>
            <button
              onClick={() => onChangeLevel('lower')}
              className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                currentLevel === 'lower'
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Nur Untere Ebene (U)' : 'Lower floor only (L)'}
            >
              {isDe ? 'U' : 'L'}
            </button>
            <button
              onClick={() => onChangeLevel('both')}
              className={`hidden md:inline-flex px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                currentLevel === 'both'
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Beide Ebenen nebeneinander (O + U)' : 'Both floors side-by-side'}
            >
              {isDe ? 'O + U' : 'U + L'}
            </button>
          </div>
        )}
      </div>

      {/* Center: Zone Filter + Local Session Indicator */}
      <div className="hidden xl:flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
          <button
            onClick={() => onChangeZoneFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
              selectedZoneFilter === 'all'
                ? 'bg-zinc-100 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {isDe ? 'Alle' : 'All'}
          </button>
          <button
            onClick={() => onChangeZoneFilter('a_site')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
              selectedZoneFilter === 'a_site'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            A
          </button>
          <button
            onClick={() => onChangeZoneFilter('b_site')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
              selectedZoneFilter === 'b_site'
                ? 'bg-sky-400 text-zinc-950 font-bold'
                : 'text-sky-400/80 hover:text-sky-300'
            }`}
          >
            B
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <CheckCircle2
            className={`w-3.5 h-3.5 ${hasChangesInSession ? 'text-amber-400' : 'text-emerald-400'}`}
          />
          <span>
            {hasChangesInSession
              ? isDe
                ? 'Änderungen offen'
                : 'Unsaved edits'
              : isDe
              ? 'Bereit'
              : 'Ready'}
          </span>
        </div>
      </div>

      {/* Right: Undo/Redo/Clear, Presets, Share, Edit/Done, Filter, Color Mode, Legend, Tablet Drawer, Fullscreen */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0 overflow-x-auto no-scrollbar shrink">
        {/* Undo / Redo / Clear Board (Mobil & Tablet: lg:hidden) */}
        <div className="flex lg:hidden items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-colors ${
              canUndo
                ? 'text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title={isDe ? 'Rückgängig (Strg+Z)' : 'Undo (Ctrl+Z)'}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-colors ${
              canRedo
                ? 'text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title={isDe ? 'Wiederholen (Strg+Y)' : 'Redo (Ctrl+Y)'}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          {hasBoardElements && (
            <button
              onClick={onClearTactics}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
              title={isDe ? 'Board leeren (entsperrte Elemente)' : 'Clear unlocked items'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tactic Presets Library Button */}
        <button
          type="button"
          onClick={onOpenPresets}
          className="relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          title={isDe ? 'Taktik-Vorlagen verwalten (pro Map)' : 'Manage Tactic Presets (per map)'}
        >
          <Bookmark className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold hidden md:inline">{isDe ? 'Vorlagen' : 'Presets'}</span>
          {presetCount > 0 && (
            <span className="min-w-[16px] h-[16px] px-1 text-[9px] font-mono font-bold rounded-full flex items-center justify-center bg-amber-500 text-zinc-950">
              {presetCount}
            </span>
          )}
        </button>

        {/* Share / Export */}
        <button
          onClick={onShare}
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          title={isDe ? 'Taktik teilen & exportieren' : 'Share & export tactic'}
        >
          <Share2 className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold hidden md:inline">{isDe ? 'Teilen' : 'Share'}</span>
        </button>

        {/* Bearbeiten / Fertig */}
        <button
          onClick={onEditAction}
          className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
            isEditActive
              ? 'border-amber-400 bg-amber-400 text-zinc-950 shadow-md'
              : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800'
          }`}
          title={isDe ? 'Callouts bearbeiten' : 'Edit callouts'}
        >
          {isEditActive ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">{isDe ? 'Fertig' : 'Done'}</span>
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{isDe ? 'Bearbeiten' : 'Edit'}</span>
            </>
          )}
        </button>

        {/* Tablet-Only Layers Slide-Over Trigger */}
        <button
          onClick={onToggleTabletLayers}
          className={`hidden md:inline-flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
            isTabletLayersOpen
              ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
              : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
          }`}
          title={isDe ? 'Ebenen & Eigenschaften' : 'Layers & Properties'}
        >
          <Layers className="w-4 h-4 text-sky-400" />
          <span>{isDe ? 'Ebenen' : 'Layers'}</span>
        </button>

        {/* Color Mode Toggle */}
        <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => onChangeColorMode('zone')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              colorMode === 'zone' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
            }`}
            title={isDe ? 'Zonen-Farben' : 'Zone colors'}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeColorMode('danger')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              colorMode === 'danger' ? 'bg-red-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            title={isDe ? 'Gefahren-Farben' : 'Danger levels'}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Meine Callout-Auswahl */}
        <button
          onClick={onToggleCustomSelection}
          className={`relative p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
            isCustomSelectionActive
              ? 'border-indigo-400 bg-indigo-500/25 text-indigo-300'
              : 'border-zinc-800 bg-zinc-900 text-indigo-400 hover:text-white'
          }`}
          title={isDe ? 'Meine Callout-Auswahl' : 'My Callout Selection'}
        >
          <ListFilter className="w-4 h-4" />
          {customSelectedCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 text-[9px] font-bold rounded-full flex items-center justify-center leading-none bg-indigo-500 text-white">
              {customSelectedCount}
            </span>
          )}
        </button>

        {/* Quick Help & App Guide */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-amber-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-colors"
          title={isDe ? 'Hilfe & App-Erklärungen' : 'Help & App Guide'}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Fullscreen (nur für die Karte) */}
        <button
          onClick={onToggleFullscreen}
          className={`p-1.5 rounded-lg border inline-flex cursor-pointer transition-colors ${
            isFullscreen
              ? 'border-amber-400 bg-amber-400 text-zinc-950'
              : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
          }`}
          title={
            isFullscreen
              ? isDe
                ? 'Karten-Vollbild beenden'
                : 'Exit map fullscreen'
              : isDe
              ? 'Karten-Vollbild (Menüs links/rechts ausblenden)'
              : 'Map fullscreen (hide sidebars)'
          }
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
