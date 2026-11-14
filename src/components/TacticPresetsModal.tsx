import React, { useState } from 'react';
import {
  Bookmark,
  Plus,
  Play,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Image as ImageIcon,
  Clock,
} from 'lucide-react';
import {
  Language,
  MapData,
  PlayerToken,
  TacticLayer,
  TacticPreset,
  TacticalDrawingLine,
  UtilityMarker,
} from '../types';
import { resolveAssetPath } from '../utils/assets';
import { UTILITY_META } from './UtilitySymbol';

interface TacticPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  mapData: MapData;
  activeImage: string;
  presets: TacticPreset[];
  currentDrawings: TacticalDrawingLine[];
  currentUtilities: UtilityMarker[];
  currentPlayers: PlayerToken[];
  currentLayers: TacticLayer[];
  onSavePreset: (name: string, notes?: string) => void;
  onLoadPreset: (preset: TacticPreset) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  onOverwritePreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onOpenPngPreview: (preset: TacticPreset) => void;
}

const SUGGESTION_CHIPS_DE = ['A-Execute', 'B-Split', 'Mid-Control', 'Eco-Setup', 'Pistol-Strat', 'Retake'];
const SUGGESTION_CHIPS_EN = ['A-Execute', 'B-Split', 'Mid-Control', 'Eco-Setup', 'Pistol-Strat', 'Retake'];

export const TacticPresetsModal: React.FC<TacticPresetsModalProps> = ({
  isOpen,
  onClose,
  lang,
  mapData,
  activeImage,
  presets,
  currentDrawings,
  currentUtilities,
  currentPlayers,
  onSavePreset,
  onLoadPreset,
  onRenamePreset,
  onOverwritePreset,
  onDeletePreset,
  onOpenPngPreview,
}) => {
  const isDe = lang === 'de';
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasCurrentElements =
    currentDrawings.length > 0 || currentUtilities.length > 0 || currentPlayers.length > 0;
  const chips = isDe ? SUGGESTION_CHIPS_DE : SUGGESTION_CHIPS_EN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed, newNotes.trim() || undefined);
    setNewName('');
    setNewNotes('');
  };

  const formatTime = (ts: number) => {
    try {
      return new Intl.DateTimeFormat(isDe ? 'de-DE' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return '';
    }
  };

  return (
    <div
      data-no-map-click="true"
      onClick={onClose}
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-zinc-900 border border-zinc-700/90 rounded-2xl p-4 sm:p-6 shadow-2xl text-zinc-100 my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>
                  {isDe ? `Taktik-Vorlagen (${mapData.name})` : `Tactic Presets (${mapData.name})`}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {presets.length}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {isDe
                  ? 'Speichere dauerhafte Taktik-Vorlagen pro Karte und lade sie jederzeit per Klick.'
                  : 'Save persistent tactic presets per map and load them anytime with one click.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save Current Tactic Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 mb-4 space-y-2.5 shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              {isDe ? 'Aktuelle Taktik als Vorlage speichern' : 'Save current tactic as preset'}
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {currentDrawings.length} {isDe ? 'Linien' : 'Lines'} · {currentUtilities.length} Util ·{' '}
              {currentPlayers.length} {isDe ? 'Spieler' : 'Players'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNewName(chip)}
                className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[10px] font-semibold text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isDe ? 'Name der Vorlage (z. B. A-Execute)' : 'Preset name (e.g. A-Execute)'}
              maxLength={60}
              className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder={isDe ? 'Kurze Notiz (optional)' : 'Short note (optional)'}
              maxLength={100}
              className="sm:w-52 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!newName.trim() || !hasCurrentElements}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                newName.trim() && hasCurrentElements
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              title={
                !hasCurrentElements
                  ? isDe
                    ? 'Zeichne oder platziere zuerst Elemente auf der Karte'
                    : 'Draw or place elements on the map first'
                  : undefined
              }
            >
              <Plus className="w-4 h-4" />
              <span>{isDe ? 'Vorlage speichern' : 'Save Preset'}</span>
            </button>
          </div>
          {!hasCurrentElements && (
            <p className="text-[11px] text-zinc-500">
              {isDe
                ? 'Hinweis: Platziere Linien, Utilitys oder Spieler auf der Karte, um eine neue Vorlage zu speichern.'
                : 'Tip: Draw lines or place utilities/players on the map to save a new preset.'}
            </p>
          )}
        </form>

        {/* Presets List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
              <Bookmark className="w-9 h-9 text-zinc-600 mb-2 stroke-[1.5]" />
              <p className="text-sm font-bold text-zinc-300 mb-1">
                {isDe ? `Noch keine Vorlagen für ${mapData.name}` : `No presets for ${mapData.name} yet`}
              </p>
              <p className="text-xs text-zinc-500 max-w-md">
                {isDe
                  ? 'Erstelle oben deine erste Taktik-Vorlage (z. B. A-Execute oder Eco-Setup). Sie bleibt dauerhaft gespeichert und wird über deinen Account mit synchronisiert.'
                  : 'Create your first tactic preset above. It stays saved persistently per map and syncs with your account.'}
              </p>
            </div>
          ) : (
            presets.map((preset) => {
              const isEditing = editingId === preset.id;
              const isConfirmOverwrite = confirmOverwriteId === preset.id;
              return (
                <div
                  key={preset.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  {/* Left: Mini radar thumbnail + Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
                      <img
                        src={resolveAssetPath(activeImage)}
                        alt={preset.name}
                        className="w-full h-full object-cover opacity-75"
                      />
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="-50 -50 100 100"
                        preserveAspectRatio="none"
                      >
                        {preset.drawings.map((d) => (
                          <polyline
                            key={`p_${d.id}`}
                            points={d.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                            fill="none"
                            stroke={d.color || '#ffffff'}
                            strokeWidth={2.2}
                            strokeLinecap="round"
                          />
                        ))}
                        {preset.utilities.map((u) => (
                          <circle
                            key={`p_${u.id}`}
                            cx={u.x}
                            cy={u.y}
                            r={3}
                            fill={UTILITY_META[u.type]?.colorHex || '#38bdf8'}
                          />
                        ))}
                        {preset.players.map((p) => (
                          <circle
                            key={`p_${p.id}`}
                            cx={p.x}
                            cy={p.y}
                            r={3}
                            fill={p.side === 'ct' ? '#2563eb' : '#d97706'}
                          />
                        ))}
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingName.trim()) {
                                onRenamePreset(preset.id, editingName.trim());
                                setEditingId(null);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-zinc-900 border border-amber-400 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingName.trim()) {
                                onRenamePreset(preset.id, editingName.trim());
                              }
                              setEditingId(null);
                            }}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white truncate">
                            {preset.name}
                          </span>
                        </div>
                      )}

                      {preset.notes && (
                        <p className="text-[11px] text-zinc-400 truncate">{preset.notes}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-400">
                        <span>{preset.drawings.length} {isDe ? 'Linien' : 'Lines'}</span>
                        <span>·</span>
                        <span>{preset.utilities.length} Util</span>
                        <span>·</span>
                        <span>{preset.players.length} {isDe ? 'Spieler' : 'Players'}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(preset.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadPreset(preset);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                      title={isDe ? 'Vorlage auf Karte laden (Rückgängig verfügbar)' : 'Load preset onto map'}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isDe ? 'Laden' : 'Load'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPngPreview(preset)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sky-300 hover:text-white transition-colors cursor-pointer"
                      title={isDe ? 'PNG-Vorschau öffnen' : 'Open PNG preview'}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>

                    {hasCurrentElements && (
                      isConfirmOverwrite ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOverwritePreset(preset.id);
                            setConfirmOverwriteId(null);
                          }}
                          onMouseLeave={() => setConfirmOverwriteId(null)}
                          className="px-2 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-[10px] font-bold cursor-pointer"
                          title={isDe ? 'Klicken zum Überschreiben bestätigen' : 'Click to confirm overwrite'}
                        >
                          {isDe ? 'Bestätigen?' : 'Confirm?'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmOverwriteId(preset.id)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                          title={isDe ? 'Mit aktueller Taktik aktualisieren' : 'Update with current tactic'}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(preset.id);
                        setEditingName(preset.name);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title={isDe ? 'Umbenennen' : 'Rename'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeletePreset(preset.id)}
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/20 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                      title={isDe ? 'Vorlage löschen' : 'Delete preset'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
