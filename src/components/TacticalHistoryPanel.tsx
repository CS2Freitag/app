import React, { useState } from 'react';
import { History, RotateCcw, Plus, X, Info, Eye, Image as ImageIcon, Trash2 } from 'lucide-react';
import {
  Callout,
  Language,
  PlayerToken,
  TacticalDrawingLine,
  TacticSnapshot,
  UtilityMarker,
} from '../types';
import { resolveAssetPath } from '../utils/assets';
import { getThrowGeometry } from '../utils/utilityThrowGeometry';

export const isAusgangsversion = (s: TacticSnapshot): boolean =>
  s.id.includes('init') ||
  s.label.toLowerCase().includes('ausgangsversion') ||
  s.label.toLowerCase().includes('initial map');

interface TacticalHistoryPanelProps {
  lang: Language;
  snapshots: TacticSnapshot[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaveSnapshot: (customLabel?: string) => void;
  onRestoreSnapshot: (snapshot: TacticSnapshot) => void;
  onDeleteSnapshot?: (snapshotId: string) => void;
  onClearHistory?: () => void;
  onOpenPngPreview?: (snapshot: TacticSnapshot | null) => void;
  drawings?: TacticalDrawingLine[];
  utilities?: UtilityMarker[];
  players?: PlayerToken[];
  mapImage: string;
  isEmbeddedMobile?: boolean;
}

const getSnapshotCalloutColor = (c: Callout): string => {
  if (c.area?.customColor) return c.area.customColor;
  switch (c.zone) {
    case 'a_site':
      return '#ef4444';
    case 'b_site':
      return '#ef4444';
    case 'ct_spawn':
      return '#3b82f6';
    case 't_spawn':
      return '#b45309';
    case 'mid':
      return '#a855f7';
    default:
      return c.danger === 'high' ? '#ef4444' : c.danger === 'low' ? '#22c55e' : '#f59e0b';
  }
};

const getUtilityHex = (type: string): string => {
  switch (type) {
    case 'flash':
      return '#fcd34d';
    case 'molotov':
      return '#f97316';
    case 'he':
      return '#dc2626';
    case 'decoy':
      return '#9333ea';
    default:
      return '#0ea5e9';
  }
};

const SnapshotMiniRadarPreview: React.FC<{
  snapshot: TacticSnapshot;
  mapImage: string;
  sizeClass?: string;
  fallbackDrawings?: TacticalDrawingLine[];
  fallbackUtilities?: UtilityMarker[];
  fallbackPlayers?: PlayerToken[];
}> = ({
  snapshot,
  mapImage,
  sizeClass = 'w-28 h-28',
  fallbackDrawings = [],
  fallbackUtilities = [],
  fallbackPlayers = [],
}) => {
  const callouts = snapshot.callouts || [];
  const drawings =
    snapshot.drawings && snapshot.drawings.length > 0 ? snapshot.drawings : fallbackDrawings;
  const utilities =
    snapshot.utilities && snapshot.utilities.length > 0 ? snapshot.utilities : fallbackUtilities;
  const players =
    snapshot.players && snapshot.players.length > 0 ? snapshot.players : fallbackPlayers;

  return (
    <div
      className={`relative ${sizeClass} rounded-lg overflow-hidden border border-zinc-700/80 bg-zinc-950 shrink-0 shadow-inner`}
    >
      <img
        src={resolveAssetPath(mapImage)}
        alt="Map Version Mini Preview"
        className="w-full h-full object-cover opacity-90"
      />
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="-50 -50 100 100"
        preserveAspectRatio="none"
      >
        {/* Callout Areas (Polygons & Rectangles) */}
        {callouts.map((c) => {
          if (!c.area) return null;
          const color = getSnapshotCalloutColor(c);
          if (c.area.points && c.area.points.length >= 3) {
            return (
              <polygon
                key={`area_poly_${c.id}`}
                points={c.area.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={color}
                fillOpacity={0.35}
                stroke={color}
                strokeWidth={1.2}
              />
            );
          }
          const cx = c.area.x + c.area.width / 2;
          const cy = c.area.y + c.area.height / 2;
          return (
            <rect
              key={`area_rect_${c.id}`}
              x={c.area.x}
              y={c.area.y}
              width={c.area.width}
              height={c.area.height}
              fill={color}
              fillOpacity={0.35}
              stroke={color}
              strokeWidth={1.2}
              transform={c.rotation ? `rotate(${c.rotation} ${cx} ${cy})` : undefined}
            />
          );
        })}

        {/* Tactical Lines & Arrows */}
        {drawings.map((d) => {
          if (!d.points || d.points.length < 2) return null;
          return (
            <polyline
              key={`draw_${d.id}`}
              points={d.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={d.color || '#f59e0b'}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Utility Throw Arcs & Markers */}
        {utilities.map((u) => {
          const color = getUtilityHex(u.type);
          const geom = u.throwFrom ? getThrowGeometry(u.throwFrom, u, u.curveBend) : null;
          return (
            <g key={`util_${u.id}`}>
              {geom && (
                <>
                  <path
                    d={`M ${geom.from.x} ${geom.from.y} Q ${geom.cp.x} ${geom.cp.y} ${u.x} ${u.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeDasharray="2,1.4"
                    strokeOpacity={0.85}
                  />
                  <circle
                    cx={geom.from.x}
                    cy={geom.from.y}
                    r={1.2}
                    fill="#09090b"
                    stroke={color}
                    strokeWidth={0.7}
                  />
                </>
              )}
              <circle
                cx={u.x}
                cy={u.y}
                r={2.2}
                fill={color}
                stroke="#09090b"
                strokeWidth={0.6}
              />
            </g>
          );
        })}

        {/* Player Tokens */}
        {players.map((p) => (
          <circle
            key={`player_${p.id}`}
            cx={p.x}
            cy={p.y}
            r={2.4}
            fill={p.side === 'ct' ? '#2563eb' : '#ea580c'}
            stroke="#ffffff"
            strokeWidth={0.6}
          />
        ))}

        {/* Callout Pin Positions */}
        {callouts.map((c) => {
          const color = getSnapshotCalloutColor(c);
          return (
            <circle
              key={`pin_${c.id}`}
              cx={c.x}
              cy={c.y}
              r={1.6}
              fill={color}
              stroke="#09090b"
              strokeWidth={0.6}
            />
          );
        })}
      </svg>
    </div>
  );
};

export const TacticalHistoryPanel: React.FC<TacticalHistoryPanelProps> = ({
  lang,
  snapshots,
  isExpanded,
  onToggleExpand,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClearHistory,
  onOpenPngPreview,
  drawings = [],
  utilities = [],
  players = [],
  mapImage,
  isEmbeddedMobile = false,
}) => {
  const isDe = lang === 'de';
  // Ausgangsversion is permanent; user snapshots up to 5 + 1 Ausgangsversion = up to 6 total
  const visibleSnapshots = snapshots.slice(0, 6);
  const [previewSnapId, setPreviewSnapId] = useState<string | null>(null);

  const activePreviewSnap =
    visibleSnapshots.find((s) => s.id === previewSnapId) || visibleSnapshots[0] || null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString(isDe ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return isToday ? `${isDe ? 'Heute' : 'Today'}, ${timeStr}` : `${d.toLocaleDateString()} ${timeStr}`;
  };

  const countAreas = (snap: TacticSnapshot) =>
    (snap.callouts || []).filter((c) => Boolean(c.area)).length;

  const userSnapshotsCount = visibleSnapshots.filter((s) => !isAusgangsversion(s)).length;

  if (isEmbeddedMobile) {
    return (
      <div className="p-3 space-y-3 text-zinc-100">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <History className="w-4 h-4 text-amber-400" />
            <span>{isDe ? 'Karten-Verlauf' : 'Map History'}</span>
            <span className="text-[10px] text-zinc-400 font-mono">
              ({userSnapshotsCount}/5)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenPngPreview && (
              <button
                type="button"
                onClick={() => onOpenPngPreview(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold cursor-pointer transition-colors"
                title={isDe ? 'Aktuelle Karte mit allen Linien & Utilitys als PNG' : 'Current live map as PNG'}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isDe ? 'Live-PNG' : 'Live PNG'}</span>
              </button>
            )}
            {onClearHistory && userSnapshotsCount > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(isDe ? 'Verlauf leeren? Der aktuellste Stand und die Ausgangsversion bleiben erhalten.' : 'Clear history? The newest version and initial map will be kept.')) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-zinc-800 text-xs font-medium transition-colors cursor-pointer"
                title={isDe ? 'Verlauf leeren (aktuellster Stand & Ausgangsversion bleiben)' : 'Clear history'}
              >
                <Trash2 className="w-3 h-3" />
                <span>{isDe ? 'Leeren' : 'Clear'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSaveSnapshot()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isDe ? 'Sichern' : 'Save'}</span>
            </button>
          </div>
        </div>

        {activePreviewSnap && (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
            <SnapshotMiniRadarPreview
              snapshot={activePreviewSnap}
              mapImage={mapImage}
              sizeClass="w-20 h-20"
              fallbackDrawings={drawings}
              fallbackUtilities={utilities}
              fallbackPlayers={players}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-sky-400">
                {isAusgangsversion(activePreviewSnap)
                  ? (isDe ? 'Ausgangsversion (Dauerhaft)' : 'Initial Version (Permanent)')
                  : (isDe ? 'Karten-Vorschau' : 'Map Preview')}
              </div>
              <div className="text-xs font-bold text-white truncate">{activePreviewSnap.label}</div>
              <div className="text-[11px] font-mono tabular-nums text-zinc-400">
                {(activePreviewSnap.callouts || []).length} Callouts · {countAreas(activePreviewSnap)}{' '}
                {isDe ? 'Bereiche' : 'Areas'}
              </div>
              {onOpenPngPreview && (
                <button
                  type="button"
                  onClick={() => onOpenPngPreview(activePreviewSnap)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Vorschau-Bild (PNG)' : 'Preview Image (PNG)'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {visibleSnapshots.map((snap, idx) => {
            const isInit = isAusgangsversion(snap);
            return (
              <div
                key={snap.id}
                onClick={() => setPreviewSnapId(snap.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  activePreviewSnap?.id === snap.id
                    ? 'bg-sky-950/30 border-sky-500/50'
                    : 'bg-zinc-900/70 border-zinc-800'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-100 truncate">
                    <span>{idx + 1}. {snap.label}</span>
                    {isInit && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] shrink-0 font-bold border border-amber-500/30">
                        {isDe ? 'Ausgangsversion' : 'Permanent'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-zinc-400">
                    {formatTime(snap.timestamp)} · {(snap.callouts || []).length} Callouts
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenPngPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewSnapId(snap.id);
                        onOpenPngPreview(snap);
                      }}
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-zinc-700 cursor-pointer"
                      title={isDe ? 'Als PNG-Bild anzeigen' : 'View as PNG'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreSnapshot(snap);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-sky-500 hover:text-zinc-950 text-sky-300 border border-zinc-700 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{isDe ? 'Laden' : 'Restore'}</span>
                  </button>
                  {!isInit && onDeleteSnapshot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSnapshot(snap.id);
                      }}
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700 cursor-pointer transition-colors"
                      title={isDe ? 'Diesen Stand löschen' : 'Delete snapshot'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!isExpanded) return null;

  return (
    <div
      data-no-map-click="true"
      className="hidden md:flex flex-col border-t border-zinc-800 bg-zinc-950/98 text-zinc-100 shrink-0 shadow-2xl z-40 print:hidden"
    >
      {/* Header Row */}
      <div className="h-9 px-4 flex items-center justify-between gap-4 border-b border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-center gap-2.5">
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-white">
            {isDe ? 'Karten-Versionsverlauf (max. 5)' : 'Map Version History (max 5)'}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 ml-2">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {isDe
                ? 'Speichert bis zu 5 Stände. Ältester Stand wird bei neuem Stand überschrieben. Ausgangsversion bleibt immer.'
                : 'Stores up to 5 versions. Oldest is replaced when full. Initial map always remains.'}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPngPreview && (
            <button
              type="button"
              onClick={() => onOpenPngPreview(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
              title={isDe ? 'Aktuellen Stand mit allen Linien, Utilitys & Bereichen als PNG' : 'Export current live map as PNG'}
            >
              <ImageIcon className="w-3 h-3" />
              <span>{isDe ? 'Live-Taktik (PNG)' : 'Live Tactic (PNG)'}</span>
            </button>
          )}
          {onClearHistory && userSnapshotsCount > 1 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(isDe ? 'Verlauf leeren? Der aktuellste Stand und die Ausgangsversion bleiben erhalten.' : 'Clear history? The newest version and initial map will be kept.')) {
                  onClearHistory();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[11px] font-medium transition-colors cursor-pointer"
              title={isDe ? 'Verlauf leeren (aktuellster Stand & Ausgangsversion bleiben)' : 'Clear history'}
            >
              <Trash2 className="w-3 h-3" />
              <span>{isDe ? 'Verlauf leeren' : 'Clear History'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSaveSnapshot()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{isDe ? 'Kartenstand sichern' : 'Save Map Snapshot'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isDe ? 'Verlauf schließen' : 'Close history'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body: Map versions list + Live Mini-Radar & PNG Preview Card */}
      <div className="px-4 py-3 flex items-center gap-5 bg-zinc-950">
        {/* Timeline */}
        <div className="flex-1 space-y-1.5 min-w-0 max-h-48 overflow-y-auto pr-1">
          {visibleSnapshots.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              {isDe ? 'Noch keine gespeicherten Kartenstände vorhanden.' : 'No saved map versions yet.'}
            </div>
          ) : (
            visibleSnapshots.map((snap, idx) => {
              const isSelectedPreview = activePreviewSnap?.id === snap.id;
              const isInit = isAusgangsversion(snap);
              return (
                <div
                  key={snap.id}
                  onMouseEnter={() => setPreviewSnapId(snap.id)}
                  onClick={() => setPreviewSnapId(snap.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    isSelectedPreview
                      ? 'bg-sky-950/35 border-sky-500/50 text-zinc-100'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        idx === 0 ? 'bg-sky-400' : isInit ? 'bg-amber-400' : 'bg-zinc-500'
                      }`}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400 shrink-0">
                      {formatTime(snap.timestamp)}
                    </span>
                    <span className="font-semibold truncate">{snap.label}</span>
                    {idx === 0 && !isInit && (
                      <span className="text-[10px] font-mono uppercase text-sky-400 shrink-0">
                        · {isDe ? 'Aktuell' : 'Latest'}
                      </span>
                    )}
                    {isInit && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] shrink-0 font-bold border border-amber-500/30">
                        {isDe ? 'Ausgangsversion' : 'Permanent'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {onOpenPngPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewSnapId(snap.id);
                          onOpenPngPreview(snap);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sky-300 text-[11px] font-semibold cursor-pointer transition-colors"
                        title={isDe ? 'Als PNG-Vorschau öffnen' : 'Open as PNG preview'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isDe ? 'Vorschau' : 'Preview'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreSnapshot(snap);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isDe ? 'Wiederherstellen' : 'Restore'}</span>
                    </button>
                    {!isInit && onDeleteSnapshot && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSnapshot(snap.id);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={isDe ? 'Diesen Stand löschen' : 'Delete snapshot'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Mini-Map & PNG Preview Card */}
        {activePreviewSnap && (
          <div className="flex items-center gap-3.5 pl-5 border-l border-zinc-800 shrink-0 w-88">
            <SnapshotMiniRadarPreview
              snapshot={activePreviewSnap}
              mapImage={mapImage}
              sizeClass="w-28 h-28"
              fallbackDrawings={drawings}
              fallbackUtilities={utilities}
              fallbackPlayers={players}
            />
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                {isAusgangsversion(activePreviewSnap)
                  ? (isDe ? 'Ausgangsversion (Dauerhaft)' : 'Initial Version (Permanent)')
                  : (isDe ? 'Verlauf · Vorschau' : 'History · Preview')}
              </div>
              <div className="text-xs font-bold text-white truncate">{activePreviewSnap.label}</div>
              <div className="text-[11px] text-zinc-400 font-mono tabular-nums space-y-0.5">
                <div>{formatTime(activePreviewSnap.timestamp)}</div>
                <div>
                  {(activePreviewSnap.callouts || []).length} Callouts ·{' '}
                  {countAreas(activePreviewSnap)} {isDe ? 'Bereiche' : 'Areas'}
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                {onOpenPngPreview && (
                  <button
                    type="button"
                    onClick={() => onOpenPngPreview(activePreviewSnap)}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Vorschau-Bild (PNG)' : 'Preview Image (PNG)'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRestoreSnapshot(activePreviewSnap)}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-sky-500 hover:text-zinc-950 text-sky-300 border border-zinc-700 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isDe ? 'Diesen Stand laden' : 'Load this version'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
