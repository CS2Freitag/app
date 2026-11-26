import React, { useState } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  ChevronDown,
  ChevronRight,
  Sliders,
  Trash2,
  X,
  Volume2,
  Flame,
  Crosshair,
  Square,
  Type,
  Check,
  PanelRightClose,
  Spline,
  RotateCcw,
  ArrowLeftRight,
  Copy,
  Info,
  Move,
  Palette,
} from 'lucide-react';
import {
  Callout,
  ColorMode,
  DangerLevel,
  Language,
  PlayerToken,
  TacticLayer,
  TacticalDrawingLine,
  UtilityAimSlotId,
  UtilityMarker,
  UtilityThrowType,
  UtilityType,
  ZoneType,
} from '../types';
import { playTTS } from '../utils/tts';
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
import { UTILITY_META, UtilitySymbol } from './UtilitySymbol';

export interface SelectedElementsPatch {
  type?: UtilityType;
  color?: string;
  resetColor?: boolean;
  opacity?: number;
  locked?: boolean;
  throwType?: UtilityThrowType;
  label?: string;
  notes?: string;
  curveBend?: number;
  lineScale?: number;
  resetLineScale?: boolean;
  spotScale?: number;
  resetSpotScale?: boolean;
  removeThrowFrom?: boolean;
  addDefaultThrowFrom?: boolean;
  resetCurve?: boolean;
  aimSpots?: UtilityMarker['aimSpots'];
  activeAimSpot?: UtilityAimSlotId;
  fontSize?: number;
  skipHistory?: boolean;
}

interface TacticalLayersPanelProps {
  lang: Language;
  layers: TacticLayer[];
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onToggleLayerExpand: (layerId: string) => void;
  onAddLayer: (name: string, color: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onUpdateLayerProps: (layerId: string, patch: Partial<TacticLayer>) => void;
  // Elements & Selection
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  selectedElementIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateSelectedElementsProps: (patch: SelectedElementsPatch) => void;
  onDeleteElement: (id: string) => void;
  globalUtilityLineScale?: number;
  globalUtilitySpotScale?: number;
  colors?: string[];
  utilityEditTrigger?: number;
  onOpenUtilityInfo?: (util: UtilityMarker) => void;
  onOpenCustomColor?: (util: UtilityMarker) => void;
  onMoveUtility?: (util: UtilityMarker) => void;
  onBranchFromUtilityOrigin?: (origin: { x: number; y: number }, utilType: UtilityType) => void;
  onDuplicateSelected?: () => void;
  // Callouts visibility & inspector
  showAreas: boolean;
  onToggleShowAreas: () => void;
  showCalloutLabels: boolean;
  onToggleShowCalloutLabels: () => void;
  selectedCallout: Callout | null;
  onCloseCallout: () => void;
  colorMode: ColorMode;
  getZoneBadgeColor: (zone: ZoneType) => string;
  getDangerBadge: (danger: DangerLevel) => { label: string; classes: string; dot: string };
  // Optional close handler for tablet/mobile drawer
  onCloseDrawer?: () => void;
  // Optional minimalist collapse handler for desktop right panel
  onCollapsePanel?: () => void;
  // Phone-only fallback: right-side PC/Tablet sidebars keep Utility editing in Left Sidebar
  allowUtilityTab?: boolean;
}

const LAYER_COLORS = ['#eab308', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#ffffff'];

export const TacticalLayersPanel: React.FC<TacticalLayersPanelProps> = ({
  lang,
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onToggleLayerExpand,
  onAddLayer,
  onDeleteLayer,
  onUpdateLayerProps,
  drawings,
  utilities,
  players,
  selectedElementIds,
  onSelectElements,
  onUpdateSelectedElementsProps,
  onDeleteElement,
  globalUtilityLineScale = DEFAULT_UTILITY_LINE_SCALE,
  globalUtilitySpotScale = DEFAULT_UTILITY_SPOT_SCALE,
  colors = LAYER_COLORS,
  utilityEditTrigger = 0,
  onOpenUtilityInfo,
  onOpenCustomColor,
  onMoveUtility,
  onBranchFromUtilityOrigin,
  onDuplicateSelected,
  showAreas,
  onToggleShowAreas,
  showCalloutLabels,
  onToggleShowCalloutLabels,
  selectedCallout,
  onCloseCallout,
  getZoneBadgeColor,
  getDangerBadge,
  onCloseDrawer,
  onCollapsePanel,
  allowUtilityTab = false,
}) => {
  const isDe = lang === 'de';
  const [activeTab, setActiveTab] = useState<'layers' | 'callout' | 'utility'>('layers');
  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState('#38bdf8');

  // Determine properties target: selected elements on map vs active layer
  const selectedDrawings = drawings.filter((d) => selectedElementIds.includes(d.id));
  const selectedUtilities = utilities.filter((u) => selectedElementIds.includes(u.id));
  const selectedPlayers = players.filter((p) => selectedElementIds.includes(p.id));
  const hasSelection = selectedElementIds.length > 0;
  const selectedSingleUtility =
    selectedUtilities.length === 1 &&
    selectedDrawings.length === 0 &&
    selectedPlayers.length === 0
      ? selectedUtilities[0]
      : null;

  // Auto-switch right panel tab when Callout is selected (or single Utility on mobile-only sheet)
  React.useEffect(() => {
    if (selectedCallout) {
      setActiveTab('callout');
    } else if (allowUtilityTab && selectedSingleUtility) {
      setActiveTab('utility');
    } else {
      setActiveTab('layers');
    }
  }, [selectedCallout?.id, selectedSingleUtility?.id, utilityEditTrigger, allowUtilityTab]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const currentOpacity = hasSelection
    ? selectedDrawings[0]?.opacity ?? selectedUtilities[0]?.opacity ?? selectedPlayers[0]?.opacity ?? activeLayer?.opacity ?? 1
    : activeLayer?.opacity ?? 1;

  const currentColor =
    hasSelection && selectedDrawings.length > 0
      ? selectedDrawings[0].color
      : hasSelection && selectedUtilities.length > 0
      ? selectedUtilities[0].color || UTILITY_META[selectedUtilities[0].type]?.colorHex || '#38bdf8'
      : activeLayer?.color || '#eab308';

  const getLayerItems = (layerId: string) => {
    const items: { id: string; label: string; kind: 'line' | 'arrow' | 'util' | 'player'; color: string; locked?: boolean }[] = [];
    drawings.forEach((d, idx) => {
      if ((d.layerId || layers[0]?.id) === layerId) {
        items.push({
          id: d.id,
          label: d.label || (d.hasArrow ? `${isDe ? 'Pfeil' : 'Arrow'} #${idx + 1}` : `${isDe ? 'Linie' : 'Line'} #${idx + 1}`),
          kind: d.hasArrow ? 'arrow' : 'line',
          color: d.color,
          locked: d.locked,
        });
      }
    });
    utilities.forEach((u) => {
      if ((u.layerId || 'layer_util') === layerId) {
        const prefix = u.type.toUpperCase();
        const suffix = u.label ? ` · ${u.label}` : u.throwFrom ? (isDe ? ' (Wurflinie)' : ' (Throw)') : '';
        items.push({
          id: u.id,
          label: `${prefix}${suffix}`,
          kind: 'util',
          color:
            u.color ||
            UTILITY_META[u.type]?.colorHex ||
            '#38bdf8',
          locked: u.locked,
        });
      }
    });
    players.forEach((p) => {
      const defaultLayer = p.side === 'ct' ? 'layer_ct' : 'layer_t';
      if ((p.layerId || defaultLayer) === layerId) {
        items.push({
          id: p.id,
          label: `${p.side.toUpperCase()} #${p.number}${p.hasBomb ? ' (C4)' : ''}`,
          kind: 'player',
          color: p.side === 'ct' ? '#3b82f6' : '#f59e0b',
          locked: p.locked,
        });
      }
    });
    return items;
  };

  const handleCreateLayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLayerName.trim();
    if (!trimmed) return;
    onAddLayer(trimmed, newLayerColor);
    setNewLayerName('');
    setIsAddingLayer(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/95 text-zinc-100 select-none">
      {/* Top Tabs Header if Callout is Selected or Drawer Close is Provided */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 shrink-0">
        {selectedCallout ? (
          <div className="flex items-center gap-1 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('callout')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'callout'
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isDe ? 'Callout-Info' : 'Callout'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('layers')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'layers'
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isDe ? 'Ebenen' : 'Layers'}
            </button>
          </div>
        ) : allowUtilityTab && selectedSingleUtility ? (
          <div className="flex items-center gap-1 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('utility')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'utility'
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isDe ? 'Utility' : 'Utility'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('layers')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'layers'
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isDe ? 'Ebenen' : 'Layers'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>{isDe ? 'Ebenen & Eigenschaften' : 'Layers & Properties'}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {activeTab === 'layers' && (
            <button
              type="button"
              onClick={() => setIsAddingLayer((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
              title={isDe ? 'Neue Ebene hinzufügen' : 'Add new layer'}
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{isDe ? 'Ebene' : 'Layer'}</span>
            </button>
          )}
          {onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title={isDe ? 'Schließen' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {!onCloseDrawer && onCollapsePanel && (
            <button
              type="button"
              onClick={onCollapsePanel}
              className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              title={
                isDe
                  ? 'Callout-Info & Ebenen-Panel ausblenden'
                  : 'Hide Callout Info & Layers panel'
              }
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* CALLOUT INSPECTOR VIEW */}
      {activeTab === 'callout' && selectedCallout ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getZoneBadgeColor(
                      selectedCallout.zone
                    )}`}
                  >
                    {selectedCallout.zone.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      getDangerBadge(selectedCallout.danger).classes
                    }`}
                  >
                    {getDangerBadge(selectedCallout.danger).label}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white leading-tight">
                  {selectedCallout.name.replace(/\n/g, ' ')}
                </h2>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={onCloseCallout}
                  className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
                  title={isDe ? 'Auswahl schließen' : 'Close inspector'}
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => playTTS(selectedCallout.name)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all cursor-pointer active:scale-95"
                  title={isDe ? 'Callout auf Englisch vorlesen' : 'Speak callout name'}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Vorlesen' : 'Listen'}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-zinc-400 mb-1">
                {isDe ? 'Positionsbeschreibung' : 'Position Overview'}
              </span>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {isDe ? selectedCallout.descriptionDe : selectedCallout.descriptionEn}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span>{isDe ? 'Taktische Empfehlungen' : 'Tactical Briefing'}</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDe ? selectedCallout.tacticalTipDe : selectedCallout.tacticalTipEn}
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80">
              <span className="block text-[11px] font-semibold text-zinc-400 mb-1">
                {isDe ? 'Typische Blickwinkel & Gefahrenzonen' : 'Common Angles & Crossfires'}
              </span>
              <p className="text-xs font-mono text-zinc-300">
                {isDe ? selectedCallout.commonAnglesDe : selectedCallout.commonAnglesEn}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500">
            <span>
              {selectedCallout.x}% / {selectedCallout.y}%
              {selectedCallout.rotation ? ` · ${selectedCallout.rotation}°` : ''}
            </span>
            <button
              type="button"
              onClick={onCloseCallout}
              className="px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-sans font-semibold text-xs cursor-pointer"
            >
              {isDe ? 'Schließen' : 'Close'}
            </button>
          </div>
        </div>
      ) : allowUtilityTab && activeTab === 'utility' && selectedSingleUtility ? (
        /* FULL-HEIGHT SINGLE UTILITY EDITOR IN RIGHT SIDEBAR */
        (() => {
          const su = selectedSingleUtility;
          const uMeta = UTILITY_META[su.type] || UTILITY_META.smoke;
          const hasThrow = Boolean(su.throwFrom);
          const effLineScale = getEffectiveUtilityLineScale(su, globalUtilityLineScale);
          const effSpotScale = getEffectiveUtilitySpotScale(su, globalUtilitySpotScale);
          const currentBend = su.throwFrom
            ? su.curveBend !== undefined
              ? su.curveBend
              : getDefaultCurveBend(su.throwFrom, su)
            : 0;
          const activeColor = su.color || uMeta.colorHex || '#38bdf8';
          const paletteColors = colors && colors.length > 0 ? colors : LAYER_COLORS;

          return (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {/* Summary Header + Utility-Info Button */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${uMeta.bgClass} ${uMeta.borderClass}`}
                  >
                    <UtilitySymbol type={su.type} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {isDe ? uMeta.labelDe : uMeta.labelEn}
                      </span>
                      {su.locked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {su.label || (hasThrow ? (isDe ? '2-Punkt-Lineup' : '2-point lineup') : isDe ? 'Einzelner Spot' : 'Single spot')}
                    </span>
                  </div>
                </div>
                {onOpenUtilityInfo && (
                  <button
                    type="button"
                    onClick={() => onOpenUtilityInfo(su)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-semibold cursor-pointer transition-colors shrink-0"
                    title={isDe ? 'Utility-Info & Screenshots öffnen' : 'Open Utility Info & Screenshots'}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Info' : 'Info'}</span>
                  </button>
                )}
              </div>

              {/* Utility Type Switcher */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-400">
                  {isDe ? 'Utility-Typ' : 'Utility Type'}
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map((uType) => {
                    const tMeta = UTILITY_META[uType];
                    const isAct = su.type === uType;
                    return (
                      <button
                        key={uType}
                        type="button"
                        onClick={() => onUpdateSelectedElementsProps({ type: uType })}
                        className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-lg border text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                          isAct
                            ? `${tMeta.bgClass} ${tMeta.borderClass}`
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <UtilitySymbol type={uType} size="sm" />
                        <span>{uType === 'molotov' ? 'Molo' : uType}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label & Notes */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/70">
                <div>
                  <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                    {isDe ? 'Name / Beschriftung (auf Karte sichtbar)' : 'Label (shown on map)'}
                  </span>
                  <input
                    type="text"
                    maxLength={32}
                    value={su.label || ''}
                    onChange={(e) => onUpdateSelectedElementsProps({ label: e.target.value })}
                    placeholder={isDe ? 'z. B. CT Smoke von T-Ramp' : 'e.g. CT Smoke from T Ramp'}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">{isDe ? 'Schriftgröße' : 'Font Size'}</span>
                    <span className="font-mono text-xs text-zinc-300">{su.fontSize || 12}px</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[10, 12, 14, 16, 18, 22, 28].map((fs) => {
                      const active = (su.fontSize || 12) === fs;
                      return (
                        <button
                          key={fs}
                          type="button"
                          onClick={() => onUpdateSelectedElementsProps({ fontSize: fs })}
                          className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                            active
                              ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
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
                    value={su.notes || ''}
                    onChange={(e) => onUpdateSelectedElementsProps({ notes: e.target.value })}
                    placeholder={
                      isDe
                        ? 'Standpunkt, Zielpunkt, Timing oder Hinweise...'
                        : 'Standpoint, aim point, timing...'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>

              {/* Color Swatches + Standard + Custom */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {isDe ? 'Farbe' : 'Color'}
                  </span>
                  {su.color && (
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedElementsProps({ resetColor: true })}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-amber-300 cursor-pointer"
                      title={isDe ? 'Standardfarbe wiederherstellen' : 'Reset to default color'}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>{isDe ? 'Standard' : 'Default'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {paletteColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onUpdateSelectedElementsProps({ color: c })}
                      className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                        activeColor.toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 border-white scale-110'
                          : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {onOpenCustomColor && (
                    <button
                      type="button"
                      onClick={() => onOpenCustomColor(su)}
                      className="px-2 h-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Palette className="w-3 h-3" />
                      <span>{isDe ? 'Eigene' : 'Custom'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Opacity, Spot Size & Line Thickness */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-800/70">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">{isDe ? 'Deckkraft' : 'Opacity'}</span>
                    <span className="font-mono font-bold tabular-nums text-zinc-200">
                      {Math.round((su.opacity ?? 1) * 100)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={Math.round((su.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      onUpdateSelectedElementsProps({
                        opacity: Number(e.target.value) / 100,
                        skipHistory: true,
                      })
                    }
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
                      {su.spotScale !== undefined && (
                        <button
                          type="button"
                          onClick={() => onUpdateSelectedElementsProps({ resetSpotScale: true })}
                          className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[9px] text-amber-300 cursor-pointer"
                        >
                          Global
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={1}
                    aria-label={isDe ? 'Utility Spot-Größe rechts' : 'Right panel spot size'}
                    value={Math.round(effSpotScale * 100)}
                    onChange={(e) =>
                      onUpdateSelectedElementsProps({
                        spotScale: Number(e.target.value) / 100,
                        skipHistory: true,
                      })
                    }
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
                        {su.lineScale !== undefined && (
                          <button
                            type="button"
                            onClick={() => onUpdateSelectedElementsProps({ resetLineScale: true })}
                            className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[9px] text-amber-300 cursor-pointer"
                          >
                            Global
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={1}
                      aria-label={isDe ? 'Utility Linienstärke rechts' : 'Right panel line width'}
                      value={Math.round(effLineScale * 100)}
                      onChange={(e) =>
                        onUpdateSelectedElementsProps({
                          lineScale: Number(e.target.value) / 100,
                          skipHistory: true,
                        })
                      }
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Throw Curve & Throw Type */}
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
                        hasThrow ? { removeThrowFrom: true } : { addDefaultThrowFrom: true }
                      )
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                      hasThrow
                        ? 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/30'
                    }`}
                  >
                    {hasThrow
                      ? isDe
                        ? 'Entfernen'
                        : 'Remove'
                      : isDe
                      ? '+ Hinzufügen'
                      : '+ Add Line'}
                  </button>
                </div>

                {hasThrow && (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">{isDe ? 'Kurvenbogen' : 'Curve Arc'}</span>
                        <span className="font-mono font-bold text-zinc-200 tabular-nums">
                          {currentBend > 0 ? `+${currentBend}` : currentBend}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-45}
                        max={45}
                        step={0.5}
                        aria-label={isDe ? 'Kurvenbogen rechts' : 'Right panel curve arc'}
                        value={currentBend}
                        onChange={(e) =>
                          onUpdateSelectedElementsProps({
                            curveBend: Number(e.target.value),
                            skipHistory: true,
                          })
                        }
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
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-2.5 h-2.5 text-sky-400" />
                          <span>{isDe ? 'Umkehren' : 'Flip'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSelectedElementsProps({ curveBend: 0 })}
                          className="flex-1 py-1 rounded text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
                        >
                          {isDe ? 'Gerade' : 'Straight'}
                        </button>
                        {su.curveBend !== undefined && (
                          <button
                            type="button"
                            onClick={() => onUpdateSelectedElementsProps({ resetCurve: true })}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 cursor-pointer"
                            title={isDe ? 'Bogen zurücksetzen' : 'Reset curve arc'}
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-zinc-400">{isDe ? 'Wurfart' : 'Throw Type'}</span>
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
                              onClick={() => onUpdateSelectedElementsProps({ throwType: tt })}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                                active
                                  ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
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

              {/* Quick Utility Actions */}
              <div className="pt-2 border-t border-zinc-800/70 space-y-1.5">
                {onOpenUtilityInfo && (
                  <button
                    type="button"
                    onClick={() => onOpenUtilityInfo(su)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>
                      {isDe ? 'Utility-Info & Screenshots' : 'Utility Info & Screenshots'}
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {onMoveUtility && !su.locked && (
                    <button
                      type="button"
                      onClick={() => onMoveUtility(su)}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>{isDe ? 'Verschieben' : 'Move'}</span>
                    </button>
                  )}

                  {hasThrow && onBranchFromUtilityOrigin && (
                    <button
                      type="button"
                      onClick={() => onBranchFromUtilityOrigin(su.throwFrom!, su.type)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      <Spline className="w-3.5 h-3.5" />
                      <span>{isDe ? '+ Wurf von hier' : '+ Throw here'}</span>
                    </button>
                  )}

                  {onDuplicateSelected && (
                    <button
                      type="button"
                      onClick={onDuplicateSelected}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{isDe ? 'Duplizieren' : 'Duplicate'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onUpdateSelectedElementsProps({ locked: !su.locked })}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                      su.locked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    {su.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-zinc-400" />}
                    <span>{su.locked ? (isDe ? 'Entsperren' : 'Unlock') : isDe ? 'Sperren' : 'Lock'}</span>
                  </button>
                </div>

                {!su.locked && (
                  <button
                    type="button"
                    onClick={() => onDeleteElement(su.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Utility löschen' : 'Delete Utility'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* LAYERS & PROPERTIES VIEW */
        <div className="flex-1 flex flex-col min-h-0">
          {/* New Layer Input Form */}
          {isAddingLayer && (
            <form onSubmit={handleCreateLayerSubmit} className="p-3 border-b border-zinc-800 bg-zinc-900/60 space-y-2 shrink-0">
              <input
                type="text"
                autoFocus
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                placeholder={isDe ? 'Ebenen-Name (z. B. A-Split)...' : 'Layer name...'}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {LAYER_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewLayerColor(c)}
                      className={`w-4 h-4 rounded-sm border transition-transform cursor-pointer ${
                        newLayerColor === c ? 'border-white scale-115' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingLayer(false)}
                    className="px-2 py-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {isDe ? 'Abbrechen' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[11px] font-bold cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>{isDe ? 'Anlegen' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Scrollable Layers List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/70">
            {/* Base Radar Callouts Quick Visibility Rows */}
            <div className="px-3 py-2 bg-zinc-900/30 space-y-1">
              <div className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Square className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-medium">{isDe ? 'Callout-Bereiche' : 'Callout Areas'}</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleShowAreas}
                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                  title={showAreas ? (isDe ? 'Ausblenden' : 'Hide') : (isDe ? 'Einblenden' : 'Show')}
                >
                  {showAreas ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                </button>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Type className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-medium">{isDe ? 'Callout-Namen' : 'Callout Labels'}</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleShowCalloutLabels}
                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                  title={showCalloutLabels ? (isDe ? 'Ausblenden' : 'Hide') : (isDe ? 'Einblenden' : 'Show')}
                >
                  {showCalloutLabels ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                </button>
              </div>
            </div>

            {/* Tactical Layers */}
            {layers.map((layer) => {
              const isActive = layer.id === activeLayerId;
              const items = getLayerItems(layer.id);
              const isDefaultLayer = ['layer_ct', 'layer_t', 'layer_util', 'layer_retake'].includes(layer.id);

              return (
                <div key={layer.id} className={isActive ? 'bg-sky-950/20' : ''}>
                  <div
                    onClick={() => onSelectLayer(layer.id)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-zinc-900/70 ${
                      isActive ? 'text-white' : 'text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerExpand(layer.id);
                        }}
                        className="p-0.5 text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0"
                        title={isDe ? 'Elemente ein-/ausklappen' : 'Expand items'}
                      >
                        {items.length > 0 ? (
                          layer.isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <span className="w-3.5 inline-block" />
                        )}
                      </button>

                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
                        style={{ backgroundColor: layer.color }}
                      />

                      <span className={`text-xs truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                        {layer.name}
                      </span>

                      {items.length > 0 && (
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500 shrink-0">
                          {items.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerLock(layer.id);
                        }}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          layer.locked ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                        title={layer.locked ? (isDe ? 'Ebene entsperren' : 'Unlock layer') : (isDe ? 'Ebene sperren' : 'Lock layer')}
                      >
                        {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerVisibility(layer.id);
                        }}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          layer.visible ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={layer.visible ? (isDe ? 'Ebene ausblenden' : 'Hide layer') : (isDe ? 'Ebene einblenden' : 'Show layer')}
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {!isDefaultLayer && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLayer(layer.id);
                          }}
                          className="p-1 rounded text-zinc-600 hover:text-red-400 cursor-pointer"
                          title={isDe ? 'Ebene löschen' : 'Delete layer'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Sub-items */}
                  {layer.isExpanded && items.length > 0 && (
                    <div className="pb-2 pl-8 pr-3 space-y-1">
                      {items.map((item) => {
                        const isSel = selectedElementIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectElements([item.id])}
                            className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] cursor-pointer transition-colors ${
                              isSel
                                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-xs shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="truncate">{item.label}</span>
                              {item.locked && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteElement(item.id);
                              }}
                              className="p-0.5 text-zinc-600 hover:text-red-400 cursor-pointer"
                              title={isDe ? 'Löschen' : 'Delete'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PROPERTIES PANEL (Deckkraft & Farbe für aktive Ebene oder Mehrfachauswahl) */}
          <div className="p-3.5 border-t border-zinc-800 bg-zinc-950 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>{isDe ? 'Eigenschaften' : 'Properties'}</span>
              </div>
              <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[130px]">
                {hasSelection
                  ? isDe
                    ? `${selectedElementIds.length} ausgewählt`
                    : `${selectedElementIds.length} selected`
                  : activeLayer?.name}
              </span>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{isDe ? 'Deckkraft' : 'Opacity'}</span>
                <span className="font-mono font-bold tabular-nums text-zinc-200">
                  {Math.round(currentOpacity * 100)} %
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={Math.round(currentOpacity * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  if (hasSelection) {
                    onUpdateSelectedElementsProps({ opacity: val });
                  } else if (activeLayer) {
                    onUpdateLayerProps(activeLayer.id, { opacity: val });
                  }
                }}
                className="w-full h-1.5 bg-zinc-800 rounded-lg accent-sky-400 cursor-pointer"
              />
            </div>

            {/* Color Swatches */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400 shrink-0">{isDe ? 'Farbe' : 'Color'}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {LAYER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (hasSelection) {
                          onUpdateSelectedElementsProps({ color: c });
                        } else if (activeLayer) {
                          onUpdateLayerProps(activeLayer.id, { color: c });
                        }
                      }}
                      className={`w-4.5 h-4.5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                        currentColor.toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 border-white scale-110'
                          : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {selectedUtilities.length > 0 && selectedUtilities.some((u) => u.color) && (
                    <button
                      type="button"
                      onClick={() => onUpdateSelectedElementsProps({ resetColor: true })}
                      className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[9px] font-semibold text-amber-300 cursor-pointer"
                      title={isDe ? 'Standardfarbe wiederherstellen' : 'Reset to default color'}
                    >
                      Std
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
