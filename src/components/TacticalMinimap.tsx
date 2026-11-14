import React, { useRef, useState } from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import {
  Language,
  PlayerToken,
  TacticalDrawingLine,
  UtilityMarker,
} from '../types';
import { resolveAssetPath } from '../utils/assets';
import { getThrowGeometry } from '../utils/utilityThrowGeometry';
import { UTILITY_META } from './UtilitySymbol';

interface TacticalMinimapProps {
  lang: Language;
  activeImage: string;
  showMinimap: boolean;
  onToggleShowMinimap: (show: boolean) => void;
  mapContainerEl: HTMLDivElement | null;
  zoom: number;
  pan: { x: number; y: number };
  onSetPan: (pan: { x: number; y: number }) => void;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  isLayerVisible: (layerId?: string, defaultFallbackId?: string) => boolean;
}

export const TacticalMinimap: React.FC<TacticalMinimapProps> = ({
  lang,
  activeImage,
  showMinimap,
  onToggleShowMinimap,
  mapContainerEl,
  zoom,
  pan,
  onSetPan,
  drawings,
  utilities,
  players,
  isLayerVisible,
}) => {
  const isDe = lang === 'de';
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);

  const baseTileSize = mapContainerEl?.clientWidth || 720;
  const stageEl = mapContainerEl?.parentElement;
  const stageW = stageEl?.clientWidth || 900;
  const stageH = stageEl?.clientHeight || 700;
  const scaledW = Math.max(1, baseTileSize * zoom);
  const scaledH = Math.max(1, baseTileSize * zoom);
  const viewWFrac = Math.min(1, stageW / scaledW);
  const viewHFrac = Math.min(1, stageH / scaledH);
  const centerXFrac = 0.5 - pan.x / scaledW;
  const centerYFrac = 0.5 - pan.y / scaledH;
  const boxLeft = Math.max(0, Math.min(1 - viewWFrac, centerXFrac - viewWFrac / 2));
  const boxTop = Math.max(0, Math.min(1 - viewHFrac, centerYFrac - viewHFrac / 2));

  const panToMinimapEvent = (clientX: number, clientY: number) => {
    if (!minimapRef.current) return;
    const r = minimapRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    onSetPan({
      x: Math.round((0.5 - nx) * scaledW),
      y: Math.round((0.5 - ny) * scaledH),
    });
  };

  if (!showMinimap) {
    return (
      <button
        type="button"
        data-no-map-click="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleShowMinimap(true);
        }}
        className="hidden lg:flex items-center gap-1.5 absolute bottom-3 right-3 z-30 px-2.5 py-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-sky-500/50 text-xs font-bold text-zinc-200 hover:text-white shadow-2xl backdrop-blur-md cursor-pointer print:hidden"
        title={isDe ? 'Minikarte anzeigen' : 'Show minimap'}
      >
        <MapIcon className="w-3.5 h-3.5 text-sky-400" />
        <span>{isDe ? 'Minikarte' : 'Minimap'}</span>
      </button>
    );
  }

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="hidden lg:flex flex-col absolute bottom-3 right-3 z-30 w-[156px] rounded-xl bg-zinc-950/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md p-1.5 gap-1 print:hidden"
    >
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
          <MapIcon className="w-3 h-3 text-sky-400" />
          <span>{isDe ? 'Minikarte' : 'Minimap'}</span>
        </span>
        <button
          type="button"
          onClick={() => onToggleShowMinimap(false)}
          className="p-0.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
          title={isDe ? 'Minikarte ausblenden' : 'Hide minimap'}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div
        ref={minimapRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDraggingMinimap(true);
          panToMinimapEvent(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (!isDraggingMinimap) return;
          e.stopPropagation();
          panToMinimapEvent(e.clientX, e.clientY);
        }}
        onMouseUp={() => setIsDraggingMinimap(false)}
        onMouseLeave={() => setIsDraggingMinimap(false)}
        className="relative w-full aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 cursor-crosshair select-none"
        title={isDe ? 'Klicken oder ziehen zum Navigieren' : 'Click or drag to pan'}
      >
        <img
          src={resolveAssetPath(activeImage)}
          alt="Minimap"
          className="w-full h-full object-cover opacity-80 pointer-events-none"
          draggable={false}
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="-50 -50 100 100"
          preserveAspectRatio="none"
        >
          {drawings
            .filter((d) => isLayerVisible(d.layerId, 'layer_t'))
            .map((d) => (
              <polyline
                key={`mini_${d.id}`}
                points={d.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={d.color || '#ffffff'}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            ))}
          {utilities
            .filter((u) => isLayerVisible(u.layerId, 'layer_util'))
            .map((u) => {
              const color = UTILITY_META[u.type]?.colorHex || '#38bdf8';
              const geom = u.throwFrom ? getThrowGeometry(u.throwFrom, u, u.curveBend) : null;
              return (
                <g key={`mini_${u.id}`}>
                  {geom && (
                    <>
                      <path
                        d={`M ${geom.from.x} ${geom.from.y} Q ${geom.cp.x} ${geom.cp.y} ${u.x} ${u.y}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.3}
                        strokeDasharray="2,1.5"
                        strokeOpacity={0.9}
                      />
                      <circle
                        cx={geom.from.x}
                        cy={geom.from.y}
                        r={1.3}
                        fill="#09090b"
                        stroke={color}
                        strokeWidth={0.8}
                      />
                    </>
                  )}
                  <circle cx={u.x} cy={u.y} r={2.5} fill={color} />
                </g>
              );
            })}
          {players
            .filter((p) => isLayerVisible(p.layerId, p.side === 'ct' ? 'layer_ct' : 'layer_t'))
            .map((p) => (
              <circle
                key={`mini_${p.id}`}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={p.side === 'ct' ? '#2563eb' : '#d97706'}
              />
            ))}
        </svg>

        {/* Live Viewport Frame */}
        <div
          style={{
            left: `${boxLeft * 100}%`,
            top: `${boxTop * 100}%`,
            width: `${viewWFrac * 100}%`,
            height: `${viewHFrac * 100}%`,
          }}
          className="absolute border-[1.5px] border-sky-400 bg-transparent rounded-[2px] pointer-events-none"
        />
      </div>
    </div>
  );
};
