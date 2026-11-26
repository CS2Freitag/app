import React from 'react';
import {
  Info,
  Edit3,
  Move,
  Users,
  Copy,
  Lock,
  Unlock,
  Palette,
  RotateCcw,
  Spline,
  GitBranch,
  Trash2,
  X,
  Check,
  SquarePlus,
} from 'lucide-react';
import {
  Callout,
  Language,
  PlayerToken,
  TacticalDrawingLine,
  UtilityMarker,
  UtilityThrowType,
  UtilityType,
} from '../types';
import { THROW_TYPE_META, UTILITY_THROW_TYPES, formatThrowTypeFull, getThrowTypeLabel } from '../utils/utilityThrowGeometry';
import { SelectedElementsPatch } from './TacticalLayersPanel';

interface TacticalSelectionBarProps {
  lang: Language;
  selectedElementIds: string[];
  selectedCalloutIds: string[];
  callouts: Callout[];
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  colors: string[];
  movingAreaCalloutId: string | null;
  movingUtilityId?: string | null;
  showContextColorPicker: boolean;
  onToggleContextColorPicker: () => void;
  onShowCalloutInfo: (callout: Callout) => void;
  onEditCallout: (callout: Callout, e: React.MouseEvent) => void;
  onToggleMoveArea: (callout: Callout) => void;
  onCreateArea: (callout: Callout) => void;
  onShowUtilityInfo?: (util: UtilityMarker) => void;
  onEditUtility?: (util: UtilityMarker) => void;
  onMoveUtility?: (util: UtilityMarker) => void;
  onGroupSelected: () => void;
  onDuplicateSelected: () => void;
  onToggleLockSelected: () => void;
  onUpdateColor: (color: string) => void;
  onUpdateSelectedElementsProps?: (patch: SelectedElementsPatch) => void;
  onBranchFromUtilityOrigin?: (origin: { x: number; y: number }, utilType: UtilityType) => void;
  onOpenCustomColor: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onFinish?: () => void;
}

export const TacticalSelectionBar: React.FC<TacticalSelectionBarProps> = ({
  lang,
  selectedElementIds,
  selectedCalloutIds,
  callouts,
  drawings,
  utilities,
  players,
  colors,
  movingAreaCalloutId,
  movingUtilityId,
  showContextColorPicker,
  onToggleContextColorPicker,
  onShowCalloutInfo,
  onEditCallout,
  onToggleMoveArea,
  onCreateArea,
  onShowUtilityInfo,
  onEditUtility,
  onMoveUtility,
  onGroupSelected,
  onDuplicateSelected,
  onToggleLockSelected,
  onUpdateColor,
  onUpdateSelectedElementsProps,
  onBranchFromUtilityOrigin,
  onOpenCustomColor,
  onDeleteSelected,
  onClearSelection,
  onFinish,
}) => {
  const isDe = lang === 'de';
  const totalCount = selectedElementIds.length + selectedCalloutIds.length;
  if (totalCount === 0) return null;

  const singleSelectedCallout =
    selectedCalloutIds.length > 0
      ? callouts.find((c) => selectedCalloutIds.includes(c.id)) || null
      : null;

  const singleSelectedUtil =
    selectedElementIds.length === 1 && selectedCalloutIds.length === 0
      ? utilities.find((u) => u.id === selectedElementIds[0]) || null
      : null;
  const hasSelectedUtilities = utilities.some((u) => selectedElementIds.includes(u.id));

  const selectedGroupSet = new Set([
    ...drawings.filter((d) => selectedElementIds.includes(d.id) && d.groupId).map((d) => d.groupId),
    ...utilities.filter((u) => selectedElementIds.includes(u.id) && u.groupId).map((u) => u.groupId),
    ...players.filter((p) => selectedElementIds.includes(p.id) && p.groupId).map((p) => p.groupId),
    ...callouts.filter((c) => selectedCalloutIds.includes(c.id) && c.groupId).map((c) => c.groupId),
  ]);
  const isGrouped = selectedGroupSet.size > 0;

  const allLocked =
    drawings.filter((d) => selectedElementIds.includes(d.id)).every((d) => d.locked) &&
    utilities.filter((u) => selectedElementIds.includes(u.id)).every((u) => u.locked) &&
    players.filter((p) => selectedElementIds.includes(p.id)).every((p) => p.locked) &&
    callouts.filter((c) => selectedCalloutIds.includes(c.id)).every((c) => c.locked);

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1 px-2 py-1.5 sm:py-1 rounded-xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-md text-xs text-zinc-100 w-max max-w-[calc(100%-16px)] sm:max-w-[calc(100%-72px)] print:hidden"
    >
      <span className="px-2 py-1 sm:py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold tabular-nums shrink-0">
        {totalCount}
        <span className="hidden sm:inline"> {isDe ? 'gewählt' : 'selected'}</span>
      </span>

      {isGrouped && (
        <span className="px-1.5 py-0.5 rounded border border-sky-500/50 bg-sky-500/10 text-sky-300 text-[10px] font-bold shrink-0">
          {isDe ? 'Gruppe' : 'Group'}
        </span>
      )}

      {singleSelectedCallout && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowCalloutInfo(singleSelectedCallout);
          }}
          className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          title={
            isDe
              ? 'Callout-Info & Ebenen-Panel öffnen'
              : 'Open Callout Info & Layers panel'
          }
        >
          <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Info</span>
        </button>
      )}

      {singleSelectedCallout && (
        <button
          type="button"
          onClick={(e) => onEditCallout(singleSelectedCallout, e)}
          className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
          title={isDe ? 'Callout bearbeiten' : 'Edit callout'}
        >
          <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{isDe ? 'Bearbeiten' : 'Edit'}</span>
        </button>
      )}

      {singleSelectedCallout && (() => {
        const isMovingThis = movingAreaCalloutId === singleSelectedCallout.id;
        const hasCalloutMarker = Boolean(
          (singleSelectedCallout.name && singleSelectedCallout.name.trim().length > 0) || !singleSelectedCallout.hidePin
        );
        const hasArea = Boolean(singleSelectedCallout.area);
        const moveLabel = isMovingThis
          ? isDe
            ? 'Verschieben beenden'
            : 'Stop move'
          : hasCalloutMarker && hasArea
          ? isDe
            ? 'Verschieben'
            : 'Move'
          : hasArea
          ? isDe
            ? 'Bereich verschieben'
            : 'Move area'
          : isDe
          ? 'Callout verschieben'
          : 'Move callout';
        const moveTitle = isMovingThis
          ? isDe
            ? 'Verschieben beenden'
            : 'Stop moving'
          : hasCalloutMarker && hasArea
          ? isDe
            ? 'Callout, Bereich oder beides verschieben'
            : 'Move callout, area, or both'
          : hasArea
          ? isDe
            ? 'Bereich verschieben'
            : 'Move area'
          : isDe
          ? 'Callout verschieben'
          : 'Move callout';

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMoveArea(singleSelectedCallout);
            }}
            className={`flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
              isMovingThis
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                : 'hover:bg-zinc-800 text-zinc-200 hover:text-white'
            }`}
            title={moveTitle}
          >
            <Move className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{moveLabel}</span>
          </button>
        );
      })()}

      {singleSelectedCallout && !singleSelectedCallout.area && movingAreaCalloutId !== singleSelectedCallout.id && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCreateArea(singleSelectedCallout);
          }}
          className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          title={isDe ? 'Neuen Bereich erstellen' : 'Create new area'}
        >
          <SquarePlus className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-400" />
          <span className="hidden sm:inline">
            {isDe ? 'Bereich erstellen' : 'Create area'}
          </span>
        </button>
      )}

      {singleSelectedUtil && onUpdateSelectedElementsProps && (
        <>
          {onShowUtilityInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowUtilityInfo(singleSelectedUtil);
              }}
              className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 hover:text-white transition-colors shrink-0 cursor-pointer"
              title={isDe ? 'Utility-Info öffnen' : 'Open Utility Info'}
            >
              <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Info</span>
            </button>
          )}

          {onEditUtility && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditUtility(singleSelectedUtil);
              }}
              className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
              title={isDe ? 'Utility bearbeiten' : 'Edit utility'}
            >
              <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isDe ? 'Bearbeiten' : 'Edit'}</span>
            </button>
          )}

          {onMoveUtility && (() => {
            const isMovingThisUtil = movingUtilityId === singleSelectedUtil.id;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUtility(singleSelectedUtil);
                }}
                className={`flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                  isMovingThisUtil
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                    : 'hover:bg-zinc-800 text-zinc-200 hover:text-white'
                }`}
                title={
                  isMovingThisUtil
                    ? isDe
                      ? 'Verschieben beenden'
                      : 'Stop moving'
                    : isDe
                    ? 'Utility verschieben (Startpunkt, Endpunkt oder beides)'
                    : 'Move utility (Origin, Landing, or both)'
                }
              >
                <Move className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
                <span className="hidden sm:inline">
                  {isMovingThisUtil
                    ? isDe
                      ? 'Fertig'
                      : 'Done'
                    : isDe
                    ? 'Verschieben'
                    : 'Move'}
                </span>
              </button>
            );
          })()}

          {!singleSelectedUtil.throwFrom && (
            <button
              type="button"
              onClick={() => onUpdateSelectedElementsProps({ addDefaultThrowFrom: true })}
              className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg border hover:bg-zinc-800 border-transparent text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
              title={isDe ? 'Wurflinie hinzufügen' : 'Add throw line'}
            >
              <Spline className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {isDe ? '+ Wurflinie' : '+ Throw'}
              </span>
            </button>
          )}

          {singleSelectedUtil.throwFrom && (
            <>
              <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                {UTILITY_THROW_TYPES.map((tt: UtilityThrowType) => {
                  const meta = THROW_TYPE_META[tt];
                  const isAct = (singleSelectedUtil.throwType || 'left') === tt;
                  return (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => onUpdateSelectedElementsProps({ throwType: tt })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                        isAct ? 'bg-sky-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
                      }`}
                      title={formatThrowTypeFull(tt, lang)}
                    >
                      {meta.short}
                    </button>
                  );
                })}
                <span className="hidden sm:inline pl-1 pr-0.5 text-[10px] font-semibold text-sky-300 border-l border-zinc-700/80 whitespace-nowrap">
                  {getThrowTypeLabel(singleSelectedUtil.throwType || 'left', lang)}
                </span>
              </div>

              {singleSelectedUtil.curveBend !== undefined && (
                <button
                  type="button"
                  onClick={() => onUpdateSelectedElementsProps({ resetCurve: true })}
                  className="flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title={isDe ? 'Bogen zurücksetzen' : 'Reset curve'}
                >
                  <RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              )}

              {onBranchFromUtilityOrigin && (
                <button
                  type="button"
                  onClick={() =>
                    onBranchFromUtilityOrigin(singleSelectedUtil.throwFrom!, singleSelectedUtil.type)
                  }
                  className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 transition-colors shrink-0 cursor-pointer"
                  title={
                    isDe
                      ? 'Weiteres Lineup von diesem Abwurfpunkt zeichnen'
                      : 'Draw another lineup arrow from this throw origin'
                  }
                >
                  <GitBranch className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">
                    {isDe ? '+ Wurf von hier' : '+ Add lineup'}
                  </span>
                </button>
              )}
            </>
          )}
        </>
      )}

      {(totalCount >= 2 || isGrouped) && (
        <button
          type="button"
          onClick={onGroupSelected}
          className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
          title={isDe ? 'Elemente gruppieren / Gruppe auflösen' : 'Group / Ungroup'}
        >
          <Users className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-sky-400" />
          <span className="hidden sm:inline">
            {isGrouped ? (isDe ? 'Lösen' : 'Ungroup') : isDe ? 'Gruppieren' : 'Group'}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onDuplicateSelected}
        className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
        title={isDe ? 'Duplizieren (Strg+D)' : 'Duplicate (Ctrl+D)'}
      >
        <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">{isDe ? 'Duplizieren' : 'Duplicate'}</span>
      </button>

      <button
        type="button"
        onClick={onToggleLockSelected}
        className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
        title={isDe ? 'Auswahl sperren / entsperren' : 'Lock / Unlock'}
      >
        {allLocked ? (
          <Unlock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
        ) : (
          <Lock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
        )}
        <span className="hidden sm:inline">
          {allLocked ? (isDe ? 'Entsperren' : 'Unlock') : isDe ? 'Sperren' : 'Lock'}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleContextColorPicker}
        className={`flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
          showContextColorPicker
            ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50'
            : 'hover:bg-zinc-800 text-zinc-200 hover:text-white'
        }`}
        title={isDe ? 'Farbe ändern' : 'Change color'}
      >
        <Palette className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-purple-400" />
        <span className="hidden sm:inline">{isDe ? 'Farbe' : 'Color'}</span>
      </button>

      <button
        type="button"
        onClick={onDeleteSelected}
        className="flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 px-2 py-1 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors shrink-0 cursor-pointer"
        title={isDe ? 'Auswahl löschen (Entf)' : 'Delete selected (Del)'}
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">{isDe ? 'Löschen' : 'Delete'}</span>
      </button>

      {hasSelectedUtilities && onFinish && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFinish();
          }}
          className="flex items-center justify-center gap-1 min-h-[34px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-colors shrink-0 cursor-pointer shadow-sm"
          title={isDe ? 'Fertig & zum Auswählen-Werkzeug wechseln' : 'Done & switch to Select tool'}
        >
          <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span>{isDe ? 'Fertig' : 'Done'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        className="flex items-center justify-center min-w-[32px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
        title={isDe ? 'Auswahl aufheben' : 'Deselect'}
      >
        <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>

      {showContextColorPicker && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-zinc-900/95 border border-zinc-700 shadow-2xl flex flex-wrap items-center justify-center gap-1.5 z-50 w-max max-w-[92vw]">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdateColor(c)}
              style={{ backgroundColor: c }}
              className="w-6 h-6 rounded-full border border-zinc-600 hover:scale-115 transition-transform cursor-pointer shrink-0"
              title={c}
            />
          ))}
          {hasSelectedUtilities && onUpdateSelectedElementsProps && (
            <button
              type="button"
              onClick={() => {
                onUpdateSelectedElementsProps({ resetColor: true });
                onToggleContextColorPicker();
              }}
              className="px-2 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 text-[10px] font-semibold cursor-pointer flex items-center gap-1 shrink-0"
              title={isDe ? 'Standardfarbe wiederherstellen' : 'Reset to default color'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isDe ? 'Standard' : 'Default'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCustomColor}
            className="px-2 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 text-[10px] font-bold cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Palette className="w-3 h-3" />
            <span>{isDe ? 'Eigene' : 'Custom'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
