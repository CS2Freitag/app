import React from 'react';
import {
  ArrowUp,
  BoxSelect,
  Eraser,
  MousePointer2,
  Palette,
  PanelLeftClose,
  Pencil,
  Redo2,
  Spline,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { Language, TacticalTool, UtilityPlacementMode, UtilityThrowType, UtilityType } from '../types';
import { resolveAssetPath } from '../utils/assets';
import { THROW_TYPE_META, UTILITY_THROW_TYPES, formatThrowTypeFull } from '../utils/utilityThrowGeometry';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';

interface TacticalLeftSidebarProps {
  lang: Language;
  activeTool: TacticalTool;
  penWithArrow: boolean;
  penColor: string;
  colors: string[];
  selectedUtility: UtilityType;
  utilityPlacementMode: UtilityPlacementMode;
  selectedThrowType: UtilityThrowType;
  selectedPlayerSide: 'ct' | 't';
  canUndo: boolean;
  canRedo: boolean;
  hasBoardElements: boolean;
  onHideToolbar: () => void;
  onSelectTool: (tool: TacticalTool) => void;
  onToolPress: (tool: TacticalTool, withArrow: boolean) => void;
  onSelectUtility: (u: UtilityType) => void;
  onSelectUtilityPlacementMode: (mode: UtilityPlacementMode) => void;
  onSelectThrowType: (t: UtilityThrowType) => void;
  onSelectPlayerSide: (s: 'ct' | 't') => void;
  onSelectColor: (c: string) => void;
  onOpenCustomColor: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearTactics: () => void;
}

export const TacticalLeftSidebar: React.FC<TacticalLeftSidebarProps> = ({
  lang,
  activeTool,
  penWithArrow,
  penColor,
  colors,
  selectedUtility,
  utilityPlacementMode,
  selectedThrowType,
  selectedPlayerSide,
  canUndo,
  canRedo,
  hasBoardElements,
  onHideToolbar,
  onSelectTool,
  onToolPress,
  onSelectUtility,
  onSelectUtilityPlacementMode,
  onSelectThrowType,
  onSelectPlayerSide,
  onSelectColor,
  onOpenCustomColor,
  onUndo,
  onRedo,
  onClearTactics,
}) => {
  const isDe = lang === 'de';

  return (
    <aside className="hidden md:flex flex-col justify-between w-52 lg:w-56 border-r border-zinc-800 bg-zinc-950 p-2.5 overflow-y-auto shrink-0 print:hidden z-30">
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between px-1.5 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {isDe ? 'Werkzeuge' : 'Tools'}
            </span>
            <button
              type="button"
              onClick={onHideToolbar}
              className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 cursor-pointer"
              title={isDe ? 'Werkzeugleiste ausblenden' : 'Hide toolbar'}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onSelectTool('select')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <MousePointer2 className="w-4 h-4 shrink-0" />
              <span>{isDe ? 'Auswählen' : 'Select'}</span>
            </button>

            <button
              onClick={() => onSelectTool('marquee')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                activeTool === 'marquee'
                  ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <BoxSelect className="w-4 h-4 shrink-0" />
              <span>{isDe ? 'Bereich' : 'Area Box'}</span>
            </button>

            <button
              onClick={() => onToolPress('pen', false)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                activeTool === 'pen' && !penWithArrow
                  ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Pencil className="w-4 h-4 shrink-0" />
                <span>{isDe ? 'Linie' : 'Line'}</span>
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/40"
                style={{ backgroundColor: penColor }}
              />
            </button>

            <button
              onClick={() => onToolPress('arrow', true)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                activeTool === 'arrow'
                  ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ArrowUp className="w-4 h-4 rotate-45 shrink-0" />
                <span>{isDe ? 'Pfeil (Rush)' : 'Arrow'}</span>
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/40"
                style={{ backgroundColor: penColor }}
              />
            </button>

            <button
              onClick={() => onSelectTool('eraser')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                activeTool === 'eraser'
                  ? 'bg-red-500/20 border-red-500/60 text-red-200'
                  : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Eraser className="w-4 h-4 shrink-0" />
              <span>{isDe ? 'Radierer' : 'Eraser'}</span>
            </button>

            {/* Utility Tool + Symbol Sub-Selector */}
            <div className="space-y-1">
              <button
                onClick={() => onSelectTool('utility')}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  activeTool === 'utility'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <UtilitySymbol type={selectedUtility} size="sm" />
                  <span>Utility</span>
                </span>
                <span className="text-[10px] font-mono uppercase text-zinc-400">
                  {selectedUtility === 'molotov' ? 'Molo' : selectedUtility}
                </span>
              </button>
              {activeTool === 'utility' && (
                <div className="space-y-1.5 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="grid grid-cols-3 gap-1">
                    {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map((u) => {
                      const meta = UTILITY_META[u];
                      return (
                        <button
                          key={u}
                          onClick={() => onSelectUtility(u)}
                          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded text-[10px] font-bold uppercase cursor-pointer border transition-colors ${
                            selectedUtility === u
                              ? `${meta.bgClass} ${meta.borderClass} shadow-xs`
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                          title={isDe ? meta.labelDe : meta.labelEn}
                        >
                          <UtilitySymbol type={u} size="sm" />
                          <span className="leading-none text-[9px]">{u === 'molotov' ? 'Molo' : u}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Placement Mode: Single Spot vs 2-Point Throw Curve */}
                  <div className="pt-1 border-t border-zinc-800/80 space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectUtilityPlacementMode('point')}
                        className={`py-1 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          utilityPlacementMode === 'point'
                            ? 'bg-zinc-100 text-zinc-950 border-white'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                        title={isDe ? '1 Klick: Nur Landeplatz setzen' : '1 click: Place landing spot only'}
                      >
                        {isDe ? 'Nur Spot' : 'Spot Only'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectUtilityPlacementMode('throw')}
                        className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          utilityPlacementMode === 'throw'
                            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/70'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                        title={
                          isDe
                            ? '2 Klicks: 1. Abwurf → 2. Ziel mit gebogener Linie'
                            : '2 clicks: 1. Throw origin → 2. Landing curve'
                        }
                      >
                        <Spline className="w-3 h-3 shrink-0" />
                        <span>{isDe ? 'Wurflinie' : 'Throw Arc'}</span>
                      </button>
                    </div>

                    {utilityPlacementMode === 'throw' && (
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {UTILITY_THROW_TYPES.map((tt) => {
                            const meta = THROW_TYPE_META[tt];
                            return (
                              <button
                                key={tt}
                                type="button"
                                onClick={() => onSelectThrowType(tt)}
                                className={`flex-1 min-w-[30px] py-0.5 px-1 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                                  selectedThrowType === tt
                                    ? 'bg-sky-500/25 text-sky-200 border-sky-400/70'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                }`}
                                title={formatThrowTypeFull(tt, lang)}
                              >
                                {meta.short}
                              </button>
                            );
                          })}
                        </div>
                        <div className="px-1.5 py-1 rounded bg-zinc-950/90 border border-zinc-800/90 flex items-center justify-between gap-1 text-[10px]">
                          <span className="text-zinc-400 shrink-0">{isDe ? 'Wurfart:' : 'Throw:'}</span>
                          <span className="font-semibold text-sky-300 truncate">
                            {formatThrowTypeFull(selectedThrowType, lang)}
                          </span>
                        </div>
                        <p className="text-[10px] leading-tight text-zinc-400 px-0.5">
                          {isDe
                            ? '1. Abwurf → 2. Ziel. Mitte ziehen für Kurve.'
                            : '1. Origin → 2. Target. Drag midpoint to curve.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Player Tokens (T / CT) */}
            <div className="space-y-1">
              <button
                onClick={() => onSelectTool('player')}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  activeTool === 'player'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                    : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>T / CT</span>
                </span>
                <span className="text-[10px] font-mono uppercase text-zinc-400">
                  {selectedPlayerSide.toUpperCase()}
                </span>
              </button>
              {activeTool === 'player' && (
                <div className="grid grid-cols-2 gap-1 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <button
                    onClick={() => onSelectPlayerSide('ct')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold cursor-pointer border ${
                      selectedPlayerSide === 'ct'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <img src={resolveAssetPath('ct.png')} alt="CT" className="w-3.5 h-3.5 object-contain" />
                    <span>CT</span>
                  </button>
                  <button
                    onClick={() => onSelectPlayerSide('t')}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold cursor-pointer border ${
                      selectedPlayerSide === 't'
                        ? 'bg-amber-600 text-zinc-950 border-amber-400'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <img src={resolveAssetPath('T.png')} alt="T" className="w-3.5 h-3.5 object-contain" />
                    <span>T</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zeichenfarbe Swatches & Aktionen */}
        <div className="pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between px-1.5 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              {isDe ? 'Farbe' : 'Color'}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{penColor}</span>
          </div>
          <div className="flex items-center justify-between gap-1 px-1">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onSelectColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                  penColor === c
                    ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110'
                    : 'border-zinc-700'
                }`}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2 px-1">
            <button
              type="button"
              onClick={onOpenCustomColor}
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Palette className="w-3 h-3" />
              <span>{isDe ? 'Eigene Farbe...' : 'Custom Color...'}</span>
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 px-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span>{isDe ? 'Aktionen' : 'Actions'}</span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                  canUndo
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 cursor-pointer shadow-xs'
                    : 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50'
                }`}
                title={isDe ? 'Rückgängig (Strg+Z)' : 'Undo (Ctrl+Z)'}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">{isDe ? 'Zurück' : 'Undo'}</span>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                  canRedo
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 cursor-pointer shadow-xs'
                    : 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed opacity-50'
                }`}
                title={isDe ? 'Wiederholen (Strg+Y)' : 'Redo (Ctrl+Y)'}
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">{isDe ? 'Vor' : 'Redo'}</span>
              </button>
              {hasBoardElements && (
                <button
                  type="button"
                  onClick={onClearTactics}
                  className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                  title={isDe ? 'Board leeren (entsperrte Linien, Utilitys & Spieler löschen)' : 'Clear board'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shortcut Hint Footer */}
      <div className="pt-3 mt-3 border-t border-zinc-800/80 px-1 text-xs text-zinc-200 leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-mono text-[11px] font-bold shadow-xs">
            Strg+Klick
          </kbd>
          <span className="text-zinc-300">{isDe ? 'Mehrfachauswahl' : 'Multi-select'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-sky-300 font-mono text-[11px] font-bold shadow-xs">
            Rechtsklick
          </kbd>
          <span className="text-zinc-300">{isDe ? 'Kontextmenü' : 'Context menu'}</span>
        </div>
      </div>
    </aside>
  );
};
