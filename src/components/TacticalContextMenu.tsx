import React from 'react';
import {
  Edit3,
  RotateCw,
  Move,
  Users,
  Copy,
  Lock,
  Unlock,
  Palette,
  ChevronRight,
  RotateCcw,
  Spline,
  Trash2,
} from 'lucide-react';
import {
  Callout,
  Language,
  PlayerToken,
  TacticalDrawingLine,
  UtilityMarker,
  UtilityThrowType,
} from '../types';
import { THROW_TYPE_META, UTILITY_THROW_TYPES, formatThrowTypeFull } from '../utils/utilityThrowGeometry';
import { SelectedElementsPatch } from './TacticalLayersPanel';

interface TacticalContextMenuProps {
  lang: Language;
  position: { x: number; y: number };
  selectedElementIds: string[];
  selectedCalloutIds: string[];
  callouts: Callout[];
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  colors: string[];
  movingAreaCalloutId: string | null;
  showColorSubmenu: boolean;
  onToggleColorSubmenu: () => void;
  onEditCallout: (callout: Callout, e: React.MouseEvent) => void;
  onRotateCalloutText: (callout: Callout) => void;
  onToggleMoveArea: (callout: Callout) => void;
  onGroupSelected: () => void;
  onDuplicateSelected: () => void;
  onToggleLockSelected: () => void;
  onUpdateColor: (color: string) => void;
  onUpdateSelectedElementsProps?: (patch: SelectedElementsPatch) => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

export const TacticalContextMenu: React.FC<TacticalContextMenuProps> = ({
  lang,
  position,
  selectedElementIds,
  selectedCalloutIds,
  callouts,
  drawings,
  utilities,
  players,
  colors,
  movingAreaCalloutId,
  showColorSubmenu,
  onToggleColorSubmenu,
  onEditCallout,
  onRotateCalloutText,
  onToggleMoveArea,
  onGroupSelected,
  onDuplicateSelected,
  onToggleLockSelected,
  onUpdateColor,
  onUpdateSelectedElementsProps,
  onDeleteSelected,
  onClose,
}) => {
  const isDe = lang === 'de';
  const totalCount = selectedElementIds.length + selectedCalloutIds.length;
  const singleCtxCallout =
    selectedCalloutIds.length === 1 && selectedElementIds.length === 0
      ? callouts.find((c) => c.id === selectedCalloutIds[0]) || null
      : null;
  const singleCtxUtil =
    selectedElementIds.length === 1 && selectedCalloutIds.length === 0
      ? utilities.find((u) => u.id === selectedElementIds[0]) || null
      : null;

  const selectedGroupSet = new Set([
    ...drawings.filter((d) => selectedElementIds.includes(d.id) && d.groupId).map((d) => d.groupId),
    ...utilities.filter((u) => selectedElementIds.includes(u.id) && u.groupId).map((u) => u.groupId),
    ...players.filter((p) => selectedElementIds.includes(p.id) && p.groupId).map((p) => p.groupId),
    ...callouts.filter((c) => selectedCalloutIds.includes(c.id) && c.groupId).map((c) => c.groupId),
  ]);
  const isGrouped = selectedGroupSet.size > 0;

  const allLocked =
    totalCount > 0 &&
    drawings.filter((d) => selectedElementIds.includes(d.id)).every((d) => d.locked) &&
    utilities.filter((u) => selectedElementIds.includes(u.id)).every((u) => u.locked) &&
    players.filter((p) => selectedElementIds.includes(p.id)).every((p) => p.locked) &&
    callouts.filter((c) => selectedCalloutIds.includes(c.id)).every((c) => c.locked);

  const menuLeft =
    typeof window !== 'undefined' ? Math.min(position.x, window.innerWidth - 260) : position.x;
  const menuTop =
    typeof window !== 'undefined'
      ? Math.min(position.y, window.innerHeight - (singleCtxCallout ? 430 : 300))
      : position.y;

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ left: `${Math.max(12, menuLeft)}px`, top: `${Math.max(12, menuTop)}px` }}
      className="fixed z-[110] w-60 rounded-xl bg-zinc-900/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md text-xs text-zinc-100 overflow-hidden print:hidden"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-950/60">
        <span className="font-semibold text-zinc-100 truncate">
          {singleCtxCallout
            ? singleCtxCallout.name.replace(/\n/g, ' ')
            : totalCount === 1
            ? isDe
              ? '1 Element ausgewählt'
              : '1 element selected'
            : isDe
            ? `${totalCount} Elemente ausgewählt`
            : `${totalCount} elements selected`}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
            isGrouped
              ? 'border-sky-400/70 bg-sky-500/20 text-sky-300'
              : 'border-sky-500/40 bg-sky-500/10 text-sky-300/80'
          }`}
        >
          {isDe ? 'Gruppe' : 'Group'}
        </span>
      </div>

      {/* Action Rows */}
      <div className="p-1.5 space-y-0.5">
        {singleCtxCallout && (
          <>
            <button
              type="button"
              onClick={(e) => {
                onEditCallout(singleCtxCallout, e);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span className="font-medium">
                  {isDe ? 'Callout bearbeiten' : 'Edit callout'}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRotateCalloutText(singleCtxCallout);
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <RotateCw className="w-4 h-4 text-sky-400" />
                <span className="font-medium">
                  {isDe ? 'Text drehen (+45°)' : 'Rotate text (+45°)'}
                </span>
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {singleCtxCallout.textRotation !== undefined
                  ? singleCtxCallout.textRotation
                  : singleCtxCallout.rotation || 0}
                °
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMoveArea(singleCtxCallout);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Move className="w-4 h-4 text-amber-400" />
                <span className="font-medium">
                  {movingAreaCalloutId === singleCtxCallout.id
                    ? isDe
                      ? 'Bereich-Verschieben beenden'
                      : 'Stop moving area'
                    : isDe
                    ? 'Bereich verschieben'
                    : 'Move area'}
                </span>
              </span>
            </button>

            <div className="my-1 border-t border-zinc-800" />
          </>
        )}

        {singleCtxUtil && onUpdateSelectedElementsProps && (
          <>
            <button
              type="button"
              onClick={() => {
                onUpdateSelectedElementsProps(
                  singleCtxUtil.throwFrom ? { removeThrowFrom: true } : { addDefaultThrowFrom: true }
                );
                onClose();
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Spline className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">
                  {singleCtxUtil.throwFrom
                    ? isDe
                      ? 'Wurflinie entfernen'
                      : 'Remove throw line'
                    : isDe
                    ? 'Wurflinie hinzufügen'
                    : 'Add throw line'}
                </span>
              </span>
            </button>

            {singleCtxUtil.throwFrom && (
              <>
                <div className="px-2.5 py-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {isDe ? 'Wurfart:' : 'Throw type:'}
                    </span>
                    <span className="text-[10px] font-semibold text-sky-300 truncate">
                      {formatThrowTypeFull(singleCtxUtil.throwType || 'left', lang)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {UTILITY_THROW_TYPES.map((tt: UtilityThrowType) => {
                      const meta = THROW_TYPE_META[tt];
                      const active = (singleCtxUtil.throwType || 'left') === tt;
                      return (
                        <button
                          key={tt}
                          type="button"
                          onClick={() => onUpdateSelectedElementsProps({ throwType: tt })}
                          className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                            active
                              ? 'bg-sky-500 text-zinc-950 border-sky-400'
                              : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:text-white'
                          }`}
                          title={formatThrowTypeFull(tt, lang)}
                        >
                          {meta.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {singleCtxUtil.curveBend !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSelectedElementsProps({ resetCurve: true });
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-sky-400" />
                    <span className="font-medium">
                      {isDe ? 'Kurvenbogen zurücksetzen' : 'Reset curve arc'}
                    </span>
                  </button>
                )}
              </>
            )}

            <div className="my-1 border-t border-zinc-800" />
          </>
        )}

        <button
          type="button"
          disabled={totalCount < 2 && !isGrouped}
          onClick={onGroupSelected}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
            totalCount >= 2 || isGrouped
              ? 'hover:bg-zinc-800 text-zinc-100 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-zinc-300" />
            <span className="font-medium">
              {isGrouped
                ? isDe
                  ? 'Gruppe aufheben'
                  : 'Ungroup'
                : isDe
                ? 'Gruppieren'
                : 'Group'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onDuplicateSelected}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Copy className="w-4 h-4 text-zinc-300" />
            <span className="font-medium">{isDe ? 'Duplizieren' : 'Duplicate'}</span>
          </span>
          <span className="text-[11px] font-mono text-zinc-500">Ctrl+D</span>
        </button>

        <button
          type="button"
          onClick={onToggleLockSelected}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            {allLocked ? (
              <Unlock className="w-4 h-4 text-amber-400" />
            ) : (
              <Lock className="w-4 h-4 text-zinc-300" />
            )}
            <span className="font-medium">
              {allLocked ? (isDe ? 'Entsperren' : 'Unlock') : isDe ? 'Sperren' : 'Lock'}
            </span>
          </span>
        </button>

        {/* Farbe ändern > */}
        <div>
          <button
            type="button"
            onClick={onToggleColorSubmenu}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Palette className="w-4 h-4 text-zinc-300" />
              <span className="font-medium">{isDe ? 'Farbe ändern' : 'Change color'}</span>
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                showColorSubmenu ? 'rotate-90' : ''
              }`}
            />
          </button>
          {showColorSubmenu && (
            <div className="px-2.5 py-2 mt-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800 flex items-center justify-between gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdateColor(c)}
                  style={{ backgroundColor: c }}
                  className="w-5 h-5 rounded-full border border-zinc-600 hover:scale-120 transition-transform cursor-pointer"
                  title={c}
                />
              ))}
            </div>
          )}
        </div>

        <div className="my-1 border-t border-zinc-800" />

        <button
          type="button"
          onClick={onDeleteSelected}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span className="font-medium">{isDe ? 'Löschen' : 'Delete'}</span>
        </button>
      </div>
    </div>
  );
};
