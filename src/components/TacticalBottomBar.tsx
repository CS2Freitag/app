import React from 'react';
import {
  Square,
  Grid3X3,
  Eye,
  EyeOff,
  ZoomOut,
  ZoomIn,
  History,
} from 'lucide-react';
import { Language } from '../types';

interface TacticalBottomBarProps {
  lang: Language;
  showAreas: boolean;
  onToggleAreas: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showCalloutLabels: boolean;
  onToggleLabels: () => void;
  calloutScale: number;
  onChangeCalloutScale: React.Dispatch<React.SetStateAction<number>>;
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomChange: (z: number) => void;
  onFitView: () => void;
  isHistoryExpanded: boolean;
  onToggleHistory: () => void;
  snapshotCount: number;
}

export const TacticalBottomBar: React.FC<TacticalBottomBarProps> = ({
  lang,
  showAreas,
  onToggleAreas,
  showGrid,
  onToggleGrid,
  showCalloutLabels,
  onToggleLabels,
  calloutScale,
  onChangeCalloutScale,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomChange,
  onFitView,
  isHistoryExpanded,
  onToggleHistory,
  snapshotCount,
}) => {
  const isDe = lang === 'de';

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="hidden md:flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-zinc-800 bg-zinc-950/95 text-xs text-zinc-200 shrink-0 print:hidden z-30"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onToggleAreas}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
            showAreas
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title={isDe ? 'Callout-Bereiche ein-/ausblenden' : 'Toggle areas'}
        >
          <Square className="w-3.5 h-3.5" />
          <span>{isDe ? 'Bereiche' : 'Areas'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleGrid}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
            showGrid
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title={isDe ? 'Koordinaten-Raster ein-/ausblenden' : 'Toggle grid'}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>{isDe ? 'Raster' : 'Grid'}</span>
        </button>

        <div className="h-4 w-px bg-zinc-800 shrink-0" />

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleLabels}
            className={`p-1 rounded-md border cursor-pointer transition-colors ${
              showCalloutLabels
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
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
            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
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
            className="w-16 lg:w-24 accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            title={isDe ? 'Schriftgröße anpassen' : 'Adjust font size'}
          />
          <span className="font-mono font-bold tabular-nums text-[11px] text-zinc-300 w-9 text-center">
            {Math.round(calloutScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeCalloutScale((prev) => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))
            }
            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
            title={isDe ? 'Schrift größer' : 'Larger text'}
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => {
              const defaultScale =
                typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 1.0;
              onChangeCalloutScale(defaultScale);
            }}
            className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
            title={isDe ? 'Schriftgröße zurücksetzen (100%)' : 'Reset font size'}
          >
            Fit
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
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
            className="w-20 lg:w-28 accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
          <span className="font-mono font-bold tabular-nums text-[11px] text-zinc-100 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
            title="Zoom +"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onFitView}
            className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
            title={isDe ? 'Auf Bildschirm einpassen' : 'Fit to screen'}
          >
            Fit
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-800 shrink-0" />

        <button
          type="button"
          onClick={onToggleHistory}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-colors cursor-pointer shrink-0 ${
            isHistoryExpanded
              ? 'bg-amber-500 text-zinc-950 border-amber-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white'
          }`}
          title={
            isDe
              ? 'Versionsverlauf öffnen/schließen (max. 5 Versionen mit Vorschau)'
              : 'Toggle version history (max 5 snapshots)'
          }
        >
          <History className="w-3.5 h-3.5" />
          <span>{isDe ? 'Verlauf' : 'History'}</span>
          <span
            className={`px-1 rounded text-[10px] font-mono tabular-nums ${
              isHistoryExpanded ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-amber-300'
            }`}
          >
            {Math.min(5, snapshotCount)}
          </span>
        </button>
      </div>
    </div>
  );
};
