import React from 'react';
import {
  ArrowUp,
  BoxSelect,
  Eraser,
  ListChecks,
  MousePointer2,
  Palette,
  PanelLeftClose,
  Pencil,
  Spline,
  Users,
} from 'lucide-react';
import { Language, TacticalTool, UtilityPlacementMode, UtilityThrowType, UtilityType } from '../types';
import { resolveAssetPath } from '../utils/assets';
import { THROW_TYPE_META, UTILITY_THROW_TYPES, formatThrowTypeFull, getThrowTypeLabel } from '../utils/utilityThrowGeometry';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';

interface TacticalMobileToolbarProps {
  lang: Language;
  activeTool: TacticalTool;
  penWithArrow: boolean;
  isMultiSelectMode: boolean;
  penColor: string;
  colors: string[];
  showColorPicker: boolean;
  selectedUtility: UtilityType;
  utilityPlacementMode: UtilityPlacementMode;
  selectedThrowType: UtilityThrowType;
  selectedPlayerSide: 'ct' | 't';
  onHideToolbar: () => void;
  onSelectTool: (tool: TacticalTool) => void;
  onToggleMultiSelect: () => void;
  onToolPress: (tool: TacticalTool, withArrow: boolean) => void;
  onToggleColorPicker: () => void;
  onSelectColor: (c: string) => void;
  onOpenCustomColor: () => void;
  onSelectUtility: (u: UtilityType) => void;
  onSelectUtilityPlacementMode: (mode: UtilityPlacementMode) => void;
  onSelectThrowType: (t: UtilityThrowType) => void;
  onSelectPlayerSide: (s: 'ct' | 't') => void;
}

export const TacticalMobileToolbar: React.FC<TacticalMobileToolbarProps> = ({
  lang,
  activeTool,
  penWithArrow,
  isMultiSelectMode,
  penColor,
  colors,
  showColorPicker,
  selectedUtility,
  utilityPlacementMode,
  selectedThrowType,
  selectedPlayerSide,
  onHideToolbar,
  onSelectTool,
  onToggleMultiSelect,
  onToolPress,
  onToggleColorPicker,
  onSelectColor,
  onOpenCustomColor,
  onSelectUtility,
  onSelectUtilityPlacementMode,
  onSelectThrowType,
  onSelectPlayerSide,
}) => {
  const isDe = lang === 'de';

  return (
    <div className="md:hidden border-b border-zinc-800 bg-zinc-900/95 px-1.5 py-1 flex flex-col gap-1 shrink-0 print:hidden z-30">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={onHideToolbar}
          className="p-1.5 min-h-[34px] rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer transition-colors"
          title={isDe ? 'Werkzeugleiste ausblenden' : 'Hide toolbar'}
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSelectTool('select')}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'select'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <MousePointer2 className="w-3.5 h-3.5" />
          <span>{isDe ? 'Auswahl' : 'Select'}</span>
        </button>

        <button
          onClick={() => onSelectTool('marquee')}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'marquee'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <BoxSelect className="w-3.5 h-3.5" />
          <span>{isDe ? 'Bereich' : 'Area'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMultiSelect}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            isMultiSelectMode
              ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400 shadow-xs'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
          title={
            isDe
              ? 'Mehrfachauswahl-Modus (tippe mehrere Elemente nacheinander an)'
              : 'Multi-select mode (tap multiple items sequentially)'
          }
        >
          <ListChecks className="w-3.5 h-3.5" />
          <span>{isDe ? 'Mehrfach' : 'Multi'}</span>
        </button>

        <button
          onClick={() => onToolPress('pen', false)}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'pen' && !penWithArrow
              ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>{isDe ? 'Linie' : 'Line'}</span>
        </button>

        <button
          onClick={() => onToolPress('arrow', true)}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'arrow'
              ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <ArrowUp className="w-3.5 h-3.5 rotate-45" />
          <span>{isDe ? 'Pfeil' : 'Arrow'}</span>
        </button>

        <button
          onClick={() => onSelectTool('eraser')}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'eraser'
              ? 'bg-red-500/25 text-red-200 border border-red-500/60'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>{isDe ? 'Radierer' : 'Eraser'}</span>
        </button>

        <button
          onClick={() => onSelectTool('utility')}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'utility'
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <UtilitySymbol type={selectedUtility} size="xs" />
          <span>Utility</span>
        </button>

        <button
          onClick={() => onSelectTool('player')}
          className={`flex items-center gap-1 px-2 min-h-[34px] rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
            activeTool === 'player'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50'
              : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>T / CT</span>
        </button>

        <button
          onClick={onToggleColorPicker}
          className="flex items-center gap-1 px-2 min-h-[34px] rounded-lg bg-zinc-950/60 border border-zinc-800 shrink-0 cursor-pointer"
          title={isDe ? 'Farbe wählen' : 'Color'}
        >
          <span
            className="w-4 h-4 rounded-full border border-white/50"
            style={{ backgroundColor: penColor }}
          />
        </button>
      </div>

      {showColorPicker && (
        <div className="flex items-center gap-2 px-1 py-1 bg-zinc-950/90 rounded-lg border border-zinc-800 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-zinc-400 shrink-0">{isDe ? 'Farbe:' : 'Color:'}</span>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSelectColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full border shrink-0 cursor-pointer ${
                penColor === c ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105' : 'border-zinc-700'
              }`}
            />
          ))}
          <button
            type="button"
            onClick={onOpenCustomColor}
            className="px-2 h-6 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Palette className="w-3 h-3" />
            <span>{isDe ? 'Eigene' : 'Custom'}</span>
          </button>
        </div>
      )}

      {activeTool === 'utility' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map((u) => {
              const meta = UTILITY_META[u];
              return (
                <button
                  key={u}
                  onClick={() => onSelectUtility(u)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold uppercase shrink-0 cursor-pointer border ${
                    selectedUtility === u
                      ? `${meta.bgClass} ${meta.borderClass}`
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                  }`}
                >
                  <UtilitySymbol type={u} size="xs" />
                  <span>{u === 'molotov' ? 'Molo' : u}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onSelectUtilityPlacementMode('point')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 cursor-pointer border ${
                utilityPlacementMode === 'point'
                  ? 'bg-zinc-100 text-zinc-950 border-white'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800'
              }`}
            >
              {isDe ? 'Nur Spot' : 'Spot'}
            </button>
            <button
              type="button"
              onClick={() => onSelectUtilityPlacementMode('throw')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 cursor-pointer border ${
                utilityPlacementMode === 'throw'
                  ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/70'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800'
              }`}
            >
              <Spline className="w-3 h-3" />
              <span>{isDe ? '2-Punkt Wurf' : 'Throw Arc'}</span>
            </button>
            {utilityPlacementMode === 'throw' && (
              <>
                {UTILITY_THROW_TYPES.map((tt) => {
                  const meta = THROW_TYPE_META[tt];
                  return (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => onSelectThrowType(tt)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 cursor-pointer border ${
                        selectedThrowType === tt
                          ? 'bg-sky-500/25 text-sky-200 border-sky-400/70'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                      title={formatThrowTypeFull(tt, lang)}
                    >
                      {meta.short}
                    </button>
                  );
                })}
                <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[10px] font-semibold text-sky-300 shrink-0 whitespace-nowrap">
                  → {getThrowTypeLabel(selectedThrowType, lang)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {activeTool === 'player' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelectPlayerSide('ct')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border ${
              selectedPlayerSide === 'ct'
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800'
            }`}
          >
            <img src={resolveAssetPath('ct.png')} alt="CT" className="w-4 h-4 object-contain" />
            <span>CT-Spieler</span>
          </button>
          <button
            onClick={() => onSelectPlayerSide('t')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border ${
              selectedPlayerSide === 't'
                ? 'bg-amber-600 text-zinc-950 border-amber-400'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800'
            }`}
          >
            <img src={resolveAssetPath('T.png')} alt="T" className="w-4 h-4 object-contain" />
            <span>T-Spieler</span>
          </button>
        </div>
      )}
    </div>
  );
};
