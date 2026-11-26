import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUp,
  BoxSelect,
  Check,
  Copy,
  Eraser,
  Info,
  Lock,
  MousePointer2,
  Move,
  Palette,
  PanelLeftClose,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Spline,
  Trash2,
  Undo2,
  Unlock,
  Users,
} from 'lucide-react';
import {
  Language,
  TacticalTool,
  UtilityMarker,
  UtilityPlacementMode,
  UtilityThrowType,
  UtilityType,
} from '../types';
import { resolveAssetPath } from '../utils/assets';
import {
  DEFAULT_UTILITY_LINE_SCALE,
  DEFAULT_UTILITY_SPOT_SCALE,
  getEffectiveUtilityLineScale,
  getEffectiveUtilitySpotScale,
} from '../utils/utilityDisplay';
import {
  THROW_TYPE_META,
  UTILITY_THROW_TYPES,
  formatThrowTypeFull,
  getDefaultCurveBend,
} from '../utils/utilityThrowGeometry';
import { SelectedElementsPatch } from './TacticalLayersPanel';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';

export interface UtilityDraftConfig {
  label: string;
  fontSize: number;
  notes: string;
  color?: string;
  opacity: number;
}

const LEFT_SIDEBAR_WIDTH_KEY = 'cs2_left_sidebar_width';
const DEFAULT_LEFT_SIDEBAR_WIDTH = 268;
const MAX_LEFT_SIDEBAR_WIDTH = 320; // matches right sidebar width (w-80)

function getMinLeftSidebarWidth(): number {
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return 224; // matches previous lg:w-56
  }
  return 208; // matches previous md:w-52
}

function clampLeftSidebarWidth(width: number): number {
  const minW = getMinLeftSidebarWidth();
  return Math.round(Math.max(minW, Math.min(MAX_LEFT_SIDEBAR_WIDTH, width)));
}

interface TacticalLeftSidebarProps {
  lang: Language;
  activeTool: TacticalTool;
  penWithArrow: boolean;
  penColor: string;
  colors: string[];
  selectedUtility: UtilityType;
  utilityPlacementMode: UtilityPlacementMode;
  selectedThrowType: UtilityThrowType;
  keepUtilityOrigin: boolean;
  utilityLineScale: number;
  utilitySpotScale: number;
  selectedPlayerSide: 'ct' | 't';
  canUndo: boolean;
  canRedo: boolean;
  hasBoardElements: boolean;
  selectedSingleUtility: UtilityMarker | null;
  utilityDraft: UtilityDraftConfig;
  utilityFocusTrigger?: number;
  onChangeUtilityDraft: (patch: Partial<UtilityDraftConfig>) => void;
  onUpdateSelectedElementsProps: (patch: SelectedElementsPatch) => void;
  onOpenUtilityInfo: (util: UtilityMarker) => void;
  onOpenUtilityCustomColor: (target: { utilityId: string } | 'utilityDraft') => void;
  onMoveUtility: (util: UtilityMarker) => void;
  onBranchFromUtilityOrigin: (origin: { x: number; y: number }, utilType: UtilityType) => void;
  onDuplicateSelected: () => void;
  onDeleteElement: (id: string) => void;
  onFinishUtilityEdit: () => void;
  onCreateNewCallout: () => void;
  onHideToolbar: () => void;
  onSelectTool: (tool: TacticalTool) => void;
  onToolPress: (tool: TacticalTool, withArrow: boolean) => void;
  onSelectUtility: (u: UtilityType) => void;
  onSelectUtilityPlacementMode: (mode: UtilityPlacementMode) => void;
  onSelectThrowType: (t: UtilityThrowType) => void;
  onToggleKeepUtilityOrigin: () => void;
  onChangeUtilityLineScale: (scale: number) => void;
  onChangeUtilitySpotScale: (scale: number) => void;
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
  keepUtilityOrigin,
  utilityLineScale,
  utilitySpotScale,
  selectedPlayerSide,
  canUndo,
  canRedo,
  hasBoardElements,
  selectedSingleUtility,
  utilityDraft,
  utilityFocusTrigger = 0,
  onChangeUtilityDraft,
  onUpdateSelectedElementsProps,
  onOpenUtilityInfo,
  onOpenUtilityCustomColor,
  onMoveUtility,
  onBranchFromUtilityOrigin,
  onDuplicateSelected,
  onDeleteElement,
  onFinishUtilityEdit,
  onCreateNewCallout,
  onHideToolbar,
  onSelectTool,
  onToolPress,
  onSelectUtility,
  onSelectUtilityPlacementMode,
  onSelectThrowType,
  onToggleKeepUtilityOrigin,
  onChangeUtilityLineScale,
  onChangeUtilitySpotScale,
  onSelectPlayerSide,
  onSelectColor,
  onOpenCustomColor,
  onUndo,
  onRedo,
  onClearTactics,
}) => {
  const isDe = lang === 'de';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const utilitySectionRef = useRef<HTMLDivElement | null>(null);
  const [localUtilityClickTick, setLocalUtilityClickTick] = useState(0);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_LEFT_SIDEBAR_WIDTH;
    try {
      const saved = Number(localStorage.getItem(LEFT_SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(saved) && saved > 0) {
        return clampLeftSidebarWidth(saved);
      }
    } catch {
      // ignore storage issues
    }
    return clampLeftSidebarWidth(DEFAULT_LEFT_SIDEBAR_WIDTH);
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Clamp sidebar width on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      setSidebarWidth((prev) => clampLeftSidebarWidth(prev));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Windows-style horizontal edge resize via Pointer events (PC mouse & Tablet touch/pen)
  useEffect(() => {
    if (!isResizing) return;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (e: PointerEvent) => {
      if (!resizeStateRef.current) return;
      const dx = e.clientX - resizeStateRef.current.startX;
      setSidebarWidth(clampLeftSidebarWidth(resizeStateRef.current.startWidth + dx));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizing]);

  // Persist custom width after drag settles
  useEffect(() => {
    if (isResizing) return;
    try {
      localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // ignore storage issues
    }
  }, [sidebarWidth, isResizing]);

  const isUtilityPanelOpen = activeTool === 'utility' || Boolean(selectedSingleUtility);

  // Auto-scroll so "Utility" aligns directly below the pinned "WERKZEUGE" header
  useEffect(() => {
    if (!isUtilityPanelOpen) return;
    const raf = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const target = utilitySectionRef.current;
      if (!container || !target) return;
      const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({
        top: Math.max(0, container.scrollTop + delta - 6),
        behavior: 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isUtilityPanelOpen, selectedSingleUtility?.id, utilityFocusTrigger, localUtilityClickTick]);

  const su = selectedSingleUtility;
  const activeUtilType: UtilityType = su ? su.type : selectedUtility;
  const activeUtilMeta = UTILITY_META[activeUtilType] || UTILITY_META.smoke;
  const hasThrow = su ? Boolean(su.throwFrom) : utilityPlacementMode === 'throw';
  const effSpotScale = su
    ? getEffectiveUtilitySpotScale(su, utilitySpotScale)
    : utilitySpotScale;
  const effLineScale = su
    ? getEffectiveUtilityLineScale(su, utilityLineScale)
    : utilityLineScale;
  const activeUtilColor = su
    ? su.color || activeUtilMeta.colorHex || '#38bdf8'
    : utilityDraft.color || activeUtilMeta.colorHex || '#38bdf8';
  const currentUtilLabel = su ? su.label || '' : utilityDraft.label;
  const currentUtilFontSize = su ? su.fontSize || 12 : utilityDraft.fontSize || 12;
  const currentUtilNotes = su ? su.notes || '' : utilityDraft.notes;
  const currentUtilOpacity = su ? su.opacity ?? 1 : utilityDraft.opacity ?? 1;
  const currentBend =
    su && su.throwFrom
      ? su.curveBend !== undefined
        ? su.curveBend
        : getDefaultCurveBend(su.throwFrom, su)
      : 0;

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="hidden md:flex relative flex-col border-r border-zinc-800 bg-zinc-950 shrink-0 print:hidden z-30"
    >
      {/* Pinned Top Header ("WERKZEUGE") so auto-scroll aligns Utility right underneath */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950 shrink-0">
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

      {/* Scrollable Body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col justify-between"
      >
        <div className="space-y-3">
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
              type="button"
              onClick={onCreateNewCallout}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer bg-zinc-900/50 border-zinc-800/80 text-zinc-200 hover:text-white hover:bg-emerald-500/15 hover:border-emerald-500/50"
              title={
                isDe
                  ? 'Neuen Callout / Bereich direkt auf der Karte erstellen'
                  : 'Create a new callout / area directly on the map'
              }
            >
              <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isDe ? 'Neuer Callout' : 'New Callout'}</span>
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

            {/* Utility Tool + Full Utility Editor/Creator (mirrors right-panel optics & features) */}
            <div ref={utilitySectionRef} className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setLocalUtilityClickTick((t) => t + 1);
                  onSelectTool('utility');
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isUtilityPanelOpen
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <UtilitySymbol type={activeUtilType} size="sm" />
                  <span>Utility</span>
                </span>
                <span className="text-[10px] font-mono uppercase text-zinc-400">
                  {activeUtilType === 'molotov' ? 'Molo' : activeUtilType}
                </span>
              </button>

              {isUtilityPanelOpen && (
                <div className="space-y-3 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                  {/* Summary Header + Info / Fertig */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${activeUtilMeta.bgClass} ${activeUtilMeta.borderClass}`}
                      >
                        <UtilitySymbol type={activeUtilType} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {isDe ? activeUtilMeta.labelDe : activeUtilMeta.labelEn}
                          </span>
                          {su?.locked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {su
                            ? su.label ||
                              (su.throwFrom
                                ? isDe
                                  ? '2-Punkt-Lineup'
                                  : '2-point lineup'
                                : isDe
                                ? 'Einzelner Spot'
                                : 'Single spot')
                            : utilityDraft.label.trim() ||
                              (utilityPlacementMode === 'throw'
                                ? isDe
                                  ? 'Neues 2-Punkt-Lineup'
                                  : 'New 2-point lineup'
                                : isDe
                                ? 'Neuer Spot (1 Klick)'
                                : 'New single spot')}
                        </span>
                      </div>
                    </div>

                    {su ? (
                      <button
                        type="button"
                        onClick={() => onOpenUtilityInfo(su)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-semibold cursor-pointer transition-colors shrink-0"
                        title={
                          isDe
                            ? 'Utility-Info & Screenshots öffnen'
                            : 'Open Utility Info & Screenshots'
                        }
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Info</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onFinishUtilityEdit}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-bold cursor-pointer transition-colors shrink-0"
                        title={
                          isDe
                            ? 'Fertig & zum Auswählen-Werkzeug wechseln'
                            : 'Done & switch to Select tool'
                        }
                      >
                        <Check className="w-3 h-3" />
                        <span>{isDe ? 'Fertig' : 'Done'}</span>
                      </button>
                    )}
                  </div>

                  {/* Utility-Typ */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400 block">
                      {isDe ? 'Utility-Typ' : 'Utility Type'}
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map(
                        (uType) => {
                          const tMeta = UTILITY_META[uType];
                          const isAct = activeUtilType === uType;
                          return (
                            <button
                              key={uType}
                              type="button"
                              onClick={() => {
                                if (su) {
                                  onUpdateSelectedElementsProps({ type: uType });
                                } else {
                                  onSelectUtility(uType);
                                }
                              }}
                              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-lg border text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                                isAct
                                  ? `${tMeta.bgClass} ${tMeta.borderClass}`
                                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                              }`}
                              title={isDe ? tMeta.labelDe : tMeta.labelEn}
                            >
                              <UtilitySymbol type={uType} size="sm" />
                              <span>{uType === 'molotov' ? 'Molo' : uType}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Placement Mode & Throw Pinning (when placing new Utility) */}
                  {!su && (
                    <div className="pt-2 border-t border-zinc-800/70 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectUtilityPlacementMode('point')}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            utilityPlacementMode === 'point'
                              ? 'bg-zinc-100 text-zinc-950 border-white'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                          title={
                            isDe
                              ? '1 Klick: Nur Landeplatz setzen'
                              : '1 click: Place landing spot only'
                          }
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
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center gap-1">
                            {UTILITY_THROW_TYPES.map((tt) => {
                              const meta = THROW_TYPE_META[tt];
                              return (
                                <button
                                  key={tt}
                                  type="button"
                                  onClick={() => onSelectThrowType(tt)}
                                  className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                    selectedThrowType === tt
                                      ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                  }`}
                                  title={formatThrowTypeFull(tt, lang)}
                                >
                                  {meta.short}
                                </button>
                              );
                            })}
                          </div>
                          <div className="px-2 py-1 rounded bg-zinc-950/90 border border-zinc-800/90 flex items-center justify-between gap-1 text-[10px]">
                            <span className="text-zinc-400 shrink-0">
                              {isDe ? 'Wurfart:' : 'Throw:'}
                            </span>
                            <span className="font-semibold text-sky-300 truncate">
                              {formatThrowTypeFull(selectedThrowType, lang)}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-pressed={keepUtilityOrigin}
                            onClick={onToggleKeepUtilityOrigin}
                            className={`w-full flex items-center justify-between gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              keepUtilityOrigin
                                ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white'
                            }`}
                            title={
                              isDe
                                ? 'Startpunkt fixieren, um mehrere Lineup-Pfeile von einer Wurfposition zu zeichnen'
                                : 'Keep throw origin locked to draw multiple lineup arrows from one spot'
                            }
                          >
                            <span className="truncate">
                              {isDe ? 'Startpunkt fixieren' : 'Keep origin'}
                            </span>
                            <span className="font-mono text-[9px] px-1 rounded bg-zinc-900 border border-zinc-700/80">
                              {keepUtilityOrigin ? (isDe ? 'AN' : 'ON') : isDe ? 'AUS' : 'OFF'}
                            </span>
                          </button>
                          <p className="text-[10px] leading-tight text-zinc-400 px-0.5">
                            {isDe
                              ? 'Tipp: Vorhandenen Startpunkt klicken für weitere Pfeile.'
                              : 'Tip: Click an existing origin to add more arrows.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name / Beschriftung, Schriftgröße & Notiz */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/70">
                    <div>
                      <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        {isDe
                          ? 'Name / Beschriftung (auf Karte sichtbar)'
                          : 'Label (shown on map)'}
                      </span>
                      <input
                        type="text"
                        maxLength={32}
                        value={currentUtilLabel}
                        onChange={(e) => {
                          if (su) {
                            onUpdateSelectedElementsProps({ label: e.target.value });
                          } else {
                            onChangeUtilityDraft({ label: e.target.value });
                          }
                        }}
                        placeholder={
                          isDe ? 'z. B. CT Smoke von T-Ramp' : 'e.g. CT Smoke from T Ramp'
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-zinc-400">
                          {isDe ? 'Schriftgröße' : 'Font Size'}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-zinc-300">
                          {currentUtilFontSize}px
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[10, 12, 14, 16, 18, 22, 28].map((fs) => {
                          const active = currentUtilFontSize === fs;
                          return (
                            <button
                              key={fs}
                              type="button"
                              onClick={() => {
                                if (su) {
                                  onUpdateSelectedElementsProps({ fontSize: fs });
                                } else {
                                  onChangeUtilityDraft({ fontSize: fs });
                                }
                              }}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                                active
                                  ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                              }`}
                            >
                              {fs}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                        {isDe ? 'Notiz / Lineup-Anleitung' : 'Lineup Notes'}
                      </span>
                      <textarea
                        rows={2}
                        maxLength={400}
                        value={currentUtilNotes}
                        onChange={(e) => {
                          if (su) {
                            onUpdateSelectedElementsProps({ notes: e.target.value });
                          } else {
                            onChangeUtilityDraft({ notes: e.target.value });
                          }
                        }}
                        placeholder={
                          isDe
                            ? 'Standpunkt, Zielpunkt, Timing oder Hinweise...'
                            : 'Standpoint, aim point, timing...'
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 resize-y"
                      />
                    </div>
                  </div>

                  {/* Farbe Swatches + Standard + Eigene */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {isDe ? 'Farbe' : 'Color'}
                      </span>
                      {(su ? Boolean(su.color) : Boolean(utilityDraft.color)) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (su) {
                              onUpdateSelectedElementsProps({ resetColor: true });
                            } else {
                              onChangeUtilityDraft({ color: undefined });
                            }
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-amber-300 cursor-pointer"
                          title={
                            isDe
                              ? 'Standardfarbe wiederherstellen'
                              : 'Reset to default color'
                          }
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>{isDe ? 'Standard' : 'Default'}</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            if (su) {
                              onUpdateSelectedElementsProps({ color: c });
                            } else {
                              onChangeUtilityDraft({ color: c });
                            }
                          }}
                          className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                            activeUtilColor.toLowerCase() === c.toLowerCase()
                              ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 border-white scale-110'
                              : 'border-zinc-700'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          onOpenUtilityCustomColor(
                            su ? { utilityId: su.id } : 'utilityDraft'
                          )
                        }
                        className="px-2 h-5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Palette className="w-3 h-3" />
                        <span>{isDe ? 'Eigene' : 'Custom'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Deckkraft, Spot-Größe & Linienstärke */}
                  <div className="space-y-2.5 pt-2 border-t border-zinc-800/70">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">
                          {isDe ? 'Deckkraft' : 'Opacity'}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-zinc-200">
                          {Math.round(currentUtilOpacity * 100)} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        aria-label={isDe ? 'Utility Deckkraft' : 'Utility opacity'}
                        value={Math.round(currentUtilOpacity * 100)}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value) / 100;
                          if (su) {
                            onUpdateSelectedElementsProps({
                              opacity: nextVal,
                              skipHistory: true,
                            });
                          } else {
                            onChangeUtilityDraft({ opacity: nextVal });
                          }
                        }}
                        style={{ touchAction: 'pan-x' }}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-300">
                          {isDe ? 'Spot-Größe' : 'Spot Size'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-300 tabular-nums">
                            {Math.round(effSpotScale * 100)}%
                          </span>
                          {su && su.spotScale !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSelectedElementsProps({ resetSpotScale: true })
                              }
                              className="px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-[9px] text-amber-300 cursor-pointer"
                            >
                              Global
                            </button>
                          )}
                          {!su && Math.abs(utilitySpotScale - DEFAULT_UTILITY_SPOT_SCALE) > 0.01 && (
                            <button
                              type="button"
                              onClick={() =>
                                onChangeUtilitySpotScale(DEFAULT_UTILITY_SPOT_SCALE)
                              }
                              className="px-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] font-mono text-amber-300 cursor-pointer"
                              title={
                                isDe
                                  ? 'Spot-Größe zurücksetzen (100%)'
                                  : 'Reset spot size (100%)'
                              }
                            >
                              1×
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={500}
                        step={1}
                        aria-label={isDe ? 'Utility Spot-Größe' : 'Utility spot size'}
                        value={Math.round(effSpotScale * 100)}
                        onChange={(e) => {
                          const scaleVal = Number(e.target.value) / 100;
                          if (su) {
                            onUpdateSelectedElementsProps({
                              spotScale: scaleVal,
                              skipHistory: true,
                            });
                          } else {
                            onChangeUtilitySpotScale(scaleVal);
                          }
                        }}
                        style={{ touchAction: 'pan-x' }}
                        className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                      />
                    </div>

                    {hasThrow && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-zinc-300">
                            {isDe ? 'Linienstärke' : 'Line Width'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sky-300 tabular-nums">
                              {Math.round(effLineScale * 100)}%
                            </span>
                            {su && su.lineScale !== undefined && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateSelectedElementsProps({ resetLineScale: true })
                                }
                                className="px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-[9px] text-amber-300 cursor-pointer"
                              >
                                Global
                              </button>
                            )}
                            {!su && Math.abs(utilityLineScale - DEFAULT_UTILITY_LINE_SCALE) > 0.01 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onChangeUtilityLineScale(DEFAULT_UTILITY_LINE_SCALE)
                                }
                                className="px-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[9px] font-mono text-amber-300 cursor-pointer"
                                title={
                                  isDe
                                    ? 'Linienstärke zurücksetzen (50%)'
                                    : 'Reset line width (50%)'
                                }
                              >
                                50%
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={200}
                          step={1}
                          aria-label={
                            isDe ? 'Utility Linienstärke' : 'Utility line thickness'
                          }
                          value={Math.round(effLineScale * 100)}
                          onChange={(e) => {
                            const scaleVal = Number(e.target.value) / 100;
                            if (su) {
                              onUpdateSelectedElementsProps({
                                lineScale: scaleVal,
                                skipHistory: true,
                              });
                            } else {
                              onChangeUtilityLineScale(scaleVal);
                            }
                          }}
                          style={{ touchAction: 'pan-x' }}
                          className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Selected Utility: Throw Curve, Throw Type & Quick Actions */}
                  {su && (
                    <>
                      <div className="pt-2 border-t border-zinc-800/70 space-y-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                            <Spline className="w-3.5 h-3.5" />
                            <span>{isDe ? 'Wurflinie' : 'Throw Curve'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSelectedElementsProps(
                                su.throwFrom
                                  ? { removeThrowFrom: true }
                                  : { addDefaultThrowFrom: true }
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                              su.throwFrom
                                ? 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25'
                                : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/30'
                            }`}
                          >
                            {su.throwFrom
                              ? isDe
                                ? 'Entfernen'
                                : 'Remove'
                              : isDe
                              ? '+ Hinzufügen'
                              : '+ Add Line'}
                          </button>
                        </div>

                        {su.throwFrom && (
                          <>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400">
                                  {isDe ? 'Kurvenbogen' : 'Curve Arc'}
                                </span>
                                <span className="font-mono font-bold text-zinc-200 tabular-nums">
                                  {currentBend > 0 ? `+${currentBend}` : currentBend}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={-45}
                                max={45}
                                step={0.5}
                                aria-label={isDe ? 'Kurvenbogen' : 'Curve arc'}
                                value={currentBend}
                                onChange={(e) =>
                                  onUpdateSelectedElementsProps({
                                    curveBend: Number(e.target.value),
                                    skipHistory: true,
                                  })
                                }
                                style={{ touchAction: 'pan-x' }}
                                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSelectedElementsProps({
                                      curveBend: Math.round(-currentBend * 10) / 10,
                                    })
                                  }
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
                                >
                                  <ArrowLeftRight className="w-2.5 h-2.5 text-sky-400" />
                                  <span>{isDe ? 'Umkehren' : 'Flip'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateSelectedElementsProps({ curveBend: 0 })
                                  }
                                  className="flex-1 py-1 rounded text-[10px] font-semibold bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
                                >
                                  {isDe ? 'Gerade' : 'Straight'}
                                </button>
                                {su.curveBend !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSelectedElementsProps({ resetCurve: true })
                                    }
                                    className="px-2 py-1 rounded text-[10px] font-semibold bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-amber-300 cursor-pointer"
                                    title={
                                      isDe ? 'Bogen zurücksetzen' : 'Reset curve arc'
                                    }
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="text-zinc-400">
                                  {isDe ? 'Wurfart' : 'Throw Type'}
                                </span>
                                <span className="font-semibold text-sky-300 truncate">
                                  {formatThrowTypeFull(su.throwType || 'left', lang)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {UTILITY_THROW_TYPES.map((tt) => {
                                  const meta = THROW_TYPE_META[tt];
                                  const active = (su.throwType || 'left') === tt;
                                  return (
                                    <button
                                      key={tt}
                                      type="button"
                                      onClick={() =>
                                        onUpdateSelectedElementsProps({ throwType: tt })
                                      }
                                      className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                                        active
                                          ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                                      }`}
                                      title={formatThrowTypeFull(tt, lang)}
                                    >
                                      {meta.short}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-800/70 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenUtilityInfo(su)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span>
                            {isDe
                              ? 'Utility-Info & Screenshots'
                              : 'Utility Info & Screenshots'}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          {!su.locked && (
                            <button
                              type="button"
                              onClick={() => onMoveUtility(su)}
                              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              <Move className="w-3.5 h-3.5" />
                              <span>{isDe ? 'Verschieben' : 'Move'}</span>
                            </button>
                          )}

                          {su.throwFrom && (
                            <button
                              type="button"
                              onClick={() =>
                                onBranchFromUtilityOrigin(su.throwFrom!, su.type)
                              }
                              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              <Spline className="w-3.5 h-3.5" />
                              <span>{isDe ? '+ Wurf von hier' : '+ Throw here'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={onDuplicateSelected}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{isDe ? 'Duplizieren' : 'Duplicate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSelectedElementsProps({ locked: !su.locked })
                            }
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                              su.locked
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                            }`}
                          >
                            {su.locked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                            <span>
                              {su.locked
                                ? isDe
                                  ? 'Entsperren'
                                  : 'Unlock'
                                : isDe
                                ? 'Sperren'
                                : 'Lock'}
                            </span>
                          </button>
                        </div>

                        {!su.locked && (
                          <button
                            type="button"
                            onClick={() => onDeleteElement(su.id)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              {isDe ? 'Utility löschen' : 'Delete Utility'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={onFinishUtilityEdit}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Fertig' : 'Done'}</span>
                        </button>
                      </div>
                    </>
                  )}
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
                    <img
                      src={resolveAssetPath('ct.png')}
                      alt="CT"
                      className="w-3.5 h-3.5 object-contain"
                    />
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
                    <img
                      src={resolveAssetPath('T.png')}
                      alt="T"
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>T</span>
                  </button>
                </div>
              )}
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
                    title={
                      isDe
                        ? 'Board leeren (entsperrte Linien, Utilitys & Spieler löschen)'
                        : 'Clear board'
                    }
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
      </div>

      {/* Windows-style Right-Edge Horizontal Resize Handle (PC & Tablet) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={
          isDe ? 'Werkzeugleiste in der Breite anpassen' : 'Resize tools sidebar width'
        }
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.preventDefault();
          e.stopPropagation();
          resizeStateRef.current = { startX: e.clientX, startWidth: sidebarWidth };
          setIsResizing(true);
        }}
        className="hidden md:flex absolute top-0 right-0 bottom-0 w-2.5 translate-x-1/2 z-40 cursor-ew-resize touch-none items-center justify-center group"
        title={
          isDe
            ? 'Gedrückt halten & nach links/rechts ziehen (Breite anpassen)'
            : 'Hold & drag left/right to resize'
        }
      >
        <div
          className={`w-[3px] h-full transition-colors ${
            isResizing ? 'bg-sky-400' : 'bg-transparent group-hover:bg-sky-400/75'
          }`}
        />
      </div>
    </aside>
  );
};
