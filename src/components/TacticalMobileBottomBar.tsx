import React from 'react';
import {
  ZoomOut,
  ZoomIn,
  Square,
  Grid3X3,
  Eye,
  EyeOff,
  Info,
  Layers,
} from 'lucide-react';
import { Language } from '../types';

interface TacticalMobileBottomBarProps {
  lang: Language;
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomChange: (z: number) => void;
  onFitZoom: () => void;
  showAreas: boolean;
  onToggleAreas: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showCalloutLabels: boolean;
  onToggleLabels: () => void;
  calloutScale: number;
  onChangeCalloutScale: React.Dispatch<React.SetStateAction<number>>;
  hasSelectedCallout: boolean;
  onOpenCalloutInfo: () => void;
  onOpenLayersSheet: () => void;
}

export const TacticalMobileBottomBar: React.FC<TacticalMobileBottomBarProps> = ({
  lang,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomChange,
  onFitZoom,
  showAreas,
  onToggleAreas,
  showGrid,
  onToggleGrid,
  showCalloutLabels,
  onToggleLabels,
  calloutScale,
  onChangeCalloutScale,
  hasSelectedCallout,
  onOpenCalloutInfo,
  onOpenLayersSheet,
}) => {
  const isDe = lang === 'de';

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="md:hidden absolute bottom-2 left-2 right-2 z-30 flex items-end justify-between gap-1.5 pointer-events-none print:hidden"
    >
      <div className="pointer-events-auto flex-1 min-w-0 flex flex-col gap-1 p-1.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md">
        {/* Zeile 1: Karten-Zoom + Fit + Bereiche + Raster */}
        <div className="flex flex-nowrap items-center gap-1" style={{ touchAction: 'pan-x' }}>
          <button
            type="button"
            onClick={onZoomOut}
            className="w-6 h-7 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer shrink-0"
            title="Zoom -"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="50"
            max="250"
            step="1"
            value={Math.round(zoom * 100)}
            onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
            onInput={(e) => onZoomChange(Number((e.target as HTMLInputElement).value) / 100)}
            style={{ touchAction: 'pan-x' }}
            className="flex-1 min-w-[40px] max-w-[110px] accent-sky-400 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            title={isDe ? 'Karten-Zoom anpassen' : 'Adjust map zoom'}
          />
          <span className="text-[10px] font-mono font-bold tabular-nums text-zinc-100 min-w-[28px] text-center shrink-0">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="w-6 h-7 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer shrink-0"
            title="Zoom +"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onFitZoom}
            className="px-1.5 h-7 rounded-lg text-[10px] font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer shrink-0"
            title={isDe ? 'Karte einpassen' : 'Fit map'}
          >
            Fit
          </button>
          <button
            type="button"
            onClick={onToggleAreas}
            className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
              showAreas
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
            title={isDe ? 'Bereiche' : 'Areas'}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleGrid}
            className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
              showGrid
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
            title={isDe ? 'Raster' : 'Grid'}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zeile 2: Schriftgröße + Fit */}
        <div className="flex flex-nowrap items-center gap-1" style={{ touchAction: 'pan-x' }}>
          <button
            type="button"
            onClick={onToggleLabels}
            className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
              showCalloutLabels
                ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
            }`}
            title={isDe ? 'Callout-Namen ein-/ausblenden' : 'Toggle labels'}
          >
            {showCalloutLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeCalloutScale((prev) => Math.max(0.4, Math.round((prev - 0.05) * 100) / 100))
            }
            className="px-1.5 h-7 rounded-lg text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 cursor-pointer shrink-0"
            title={isDe ? 'Schrift kleiner' : 'Smaller text'}
          >
            A-
          </button>
          <input
            type="range"
            min="40"
            max="200"
            step="1"
            value={Math.round(calloutScale * 100)}
            onChange={(e) => onChangeCalloutScale(Number(e.target.value) / 100)}
            onInput={(e) => onChangeCalloutScale(Number((e.target as HTMLInputElement).value) / 100)}
            style={{ touchAction: 'pan-x' }}
            className="flex-1 min-w-[40px] max-w-[120px] accent-amber-400 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            title={isDe ? 'Schriftgröße anpassen' : 'Adjust font size'}
          />
          <span className="text-[10px] font-mono font-bold tabular-nums text-zinc-200 min-w-[28px] text-center shrink-0">
            {Math.round(calloutScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeCalloutScale((prev) => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))
            }
            className="px-1.5 h-7 rounded-lg text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 cursor-pointer shrink-0"
            title={isDe ? 'Schrift größer' : 'Larger text'}
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => onChangeCalloutScale(0.6)}
            className="px-1.5 h-7 rounded-lg text-[10px] font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer shrink-0"
            title={isDe ? 'Schriftgröße zurücksetzen (60%)' : 'Reset font size (60%)'}
          >
            Fit
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {hasSelectedCallout && (
          <button
            type="button"
            onClick={onOpenCalloutInfo}
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-2xl cursor-pointer transition-colors shrink-0 animate-in fade-in"
            title={isDe ? 'Callout-Info anzeigen' : 'Show callout info'}
            aria-label={isDe ? 'Callout-Info' : 'Callout info'}
          >
            <Info className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLayersSheet}
          className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 shadow-2xl cursor-pointer transition-colors shrink-0"
          title={isDe ? 'Ebenen & Verlauf' : 'Layers & History'}
          aria-label={isDe ? 'Ebenen & Verlauf' : 'Layers & History'}
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
