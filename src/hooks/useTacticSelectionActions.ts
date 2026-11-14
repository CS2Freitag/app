import { useCallback } from 'react';
import {
  Callout,
  MapData,
  PlayerToken,
  TacticalDrawingLine,
  UtilityMarker,
} from '../types';
import { SelectedElementsPatch } from '../components/TacticalLayersPanel';

interface UseTacticSelectionActionsOptions {
  mapData: MapData;
  isDe: boolean;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  selectedElementIds: string[];
  selectedCalloutIds: string[];
  isLayerLocked: (layerId?: string) => boolean;
  pushHistorySnapshot: () => void;
  setDrawings: React.Dispatch<React.SetStateAction<TacticalDrawingLine[]>>;
  setUtilities: React.Dispatch<React.SetStateAction<UtilityMarker[]>>;
  setPlayers: React.Dispatch<React.SetStateAction<PlayerToken[]>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCalloutIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCallout: React.Dispatch<React.SetStateAction<Callout | null>>;
  setHighlightedCalloutId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setShowContextColorPicker: React.Dispatch<React.SetStateAction<boolean>>;
  setShowContextColorSubmenu: React.Dispatch<React.SetStateAction<boolean>>;
  setHasChangesInSession: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateMap: (updatedMap: MapData, skipCloudSync?: boolean) => void;
}

export function useTacticSelectionActions({
  mapData,
  isDe,
  drawings,
  utilities,
  players,
  selectedElementIds,
  selectedCalloutIds,
  isLayerLocked,
  pushHistorySnapshot,
  setDrawings,
  setUtilities,
  setPlayers,
  setSelectedElementIds,
  setSelectedCalloutIds,
  setSelectedCallout,
  setHighlightedCalloutId,
  setContextMenu,
  setShowContextColorPicker,
  setShowContextColorSubmenu,
  setHasChangesInSession,
  onUpdateMap,
}: UseTacticSelectionActionsOptions) {
  const handleSelectElement = useCallback(
    (elementId: string, multiKey = false) => {
      setSelectedCallout(null);
      const foundGroup =
        drawings.find((d) => d.id === elementId)?.groupId ||
        utilities.find((u) => u.id === elementId)?.groupId ||
        players.find((p) => p.id === elementId)?.groupId;

      const groupElementIds = foundGroup
        ? [
            ...drawings.filter((d) => d.groupId === foundGroup).map((d) => d.id),
            ...utilities.filter((u) => u.groupId === foundGroup).map((u) => u.id),
            ...players.filter((p) => p.groupId === foundGroup).map((p) => p.id),
          ]
        : [elementId];
      const groupCalloutPeers = foundGroup
        ? mapData.callouts.filter((c) => c.groupId === foundGroup).map((c) => c.id)
        : [];

      if (!multiKey) {
        setSelectedCalloutIds(groupCalloutPeers);
      } else if (groupCalloutPeers.length > 0) {
        setSelectedCalloutIds((prev) => Array.from(new Set([...prev, ...groupCalloutPeers])));
      }

      setSelectedElementIds((prev) => {
        if (multiKey) {
          const allAlready = groupElementIds.every((id) => prev.includes(id));
          if (allAlready) {
            return prev.filter((id) => !groupElementIds.includes(id));
          }
          return Array.from(new Set([...prev, ...groupElementIds]));
        }
        return groupElementIds;
      });
    },
    [
      drawings,
      utilities,
      players,
      mapData.callouts,
      setSelectedCallout,
      setSelectedCalloutIds,
      setSelectedElementIds,
    ]
  );

  const handleSelectCalloutMulti = useCallback(
    (callout: Callout, multiKey = false, openInspector = true) => {
      const groupCalloutIds = callout.groupId
        ? mapData.callouts.filter((c) => c.groupId === callout.groupId).map((c) => c.id)
        : [callout.id];
      const groupElIds = callout.groupId
        ? [
            ...drawings.filter((d) => d.groupId === callout.groupId).map((d) => d.id),
            ...utilities.filter((u) => u.groupId === callout.groupId).map((u) => u.id),
            ...players.filter((p) => p.groupId === callout.groupId).map((p) => p.id),
          ]
        : [];

      if (multiKey) {
        setSelectedCalloutIds((prev) => {
          const allSelected = groupCalloutIds.every((id) => prev.includes(id));
          const next = allSelected
            ? prev.filter((id) => !groupCalloutIds.includes(id))
            : Array.from(new Set([...prev, ...groupCalloutIds]));
          if (next.length === 1 && openInspector) {
            const single = mapData.callouts.find((c) => c.id === next[0]) || null;
            setSelectedCallout(single);
            setHighlightedCalloutId(single?.id);
          } else {
            setSelectedCallout(null);
            setHighlightedCalloutId(next.length === 1 ? next[0] : undefined);
          }
          return next;
        });
        if (groupElIds.length > 0) {
          setSelectedElementIds((prev) => Array.from(new Set([...prev, ...groupElIds])));
        }
      } else {
        setSelectedCalloutIds(groupCalloutIds);
        setSelectedElementIds(groupElIds);
        if (openInspector && groupCalloutIds.length <= 1 && groupElIds.length === 0) {
          setSelectedCallout(callout);
          setHighlightedCalloutId(callout.id);
        } else {
          setSelectedCallout(null);
          setHighlightedCalloutId(callout.id);
        }
      }
    },
    [
      mapData.callouts,
      drawings,
      utilities,
      players,
      setSelectedCalloutIds,
      setSelectedElementIds,
      setSelectedCallout,
      setHighlightedCalloutId,
    ]
  );

  const handleDuplicateSelected = useCallback(() => {
    const hasElements = selectedElementIds.length > 0;
    const hasCallouts = selectedCalloutIds.length > 0;
    if (!hasElements && !hasCallouts) return;
    pushHistorySnapshot();

    const offset = 2.8;
    const newElIds: string[] = [];

    if (hasElements) {
      const clonedDrawings: TacticalDrawingLine[] = drawings
        .filter((d) => selectedElementIds.includes(d.id))
        .map((d, i) => {
          const nid = `draw_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...d,
            id: nid,
            groupId: undefined,
            locked: false,
            points: d.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
          };
        });

      const clonedUtilities: UtilityMarker[] = utilities
        .filter((u) => selectedElementIds.includes(u.id))
        .map((u, i) => {
          const nid = `util_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...u,
            id: nid,
            groupId: undefined,
            locked: false,
            x: Math.round((u.x + offset) * 10) / 10,
            y: Math.round((u.y + offset) * 10) / 10,
            ...(u.throwFrom
              ? {
                  throwFrom: {
                    x: Math.round((u.throwFrom.x + offset) * 10) / 10,
                    y: Math.round((u.throwFrom.y + offset) * 10) / 10,
                  },
                }
              : {}),
          };
        });

      const clonedPlayers: PlayerToken[] = players
        .filter((p) => selectedElementIds.includes(p.id))
        .map((p, i) => {
          const nid = `player_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...p,
            id: nid,
            groupId: undefined,
            locked: false,
            x: p.x + offset,
            y: p.y + offset,
          };
        });

      if (clonedDrawings.length > 0) setDrawings((prev) => [...prev, ...clonedDrawings]);
      if (clonedUtilities.length > 0) setUtilities((prev) => [...prev, ...clonedUtilities]);
      if (clonedPlayers.length > 0) setPlayers((prev) => [...prev, ...clonedPlayers]);
      setSelectedElementIds(newElIds);
    }

    if (hasCallouts) {
      const newCalloutIds: string[] = [];
      const clonedCallouts: Callout[] = mapData.callouts
        .filter((c) => selectedCalloutIds.includes(c.id))
        .map((c, i) => {
          const cid = `custom_dup_${Date.now()}_${i}`;
          newCalloutIds.push(cid);
          return {
            ...c,
            id: cid,
            name: `${c.name} (${isDe ? 'Kopie' : 'Copy'})`,
            x: Math.round(Math.min(48, c.x + offset) * 10) / 10,
            y: Math.round(Math.min(48, c.y + offset) * 10) / 10,
            groupId: undefined,
            locked: false,
            isCustom: true,
            area: c.area
              ? {
                  ...c.area,
                  x: Math.round((c.area.x + offset) * 10) / 10,
                  y: Math.round((c.area.y + offset) * 10) / 10,
                  points: c.area.points
                    ? c.area.points.map((pt) => ({
                        x: Math.round((pt.x + offset) * 10) / 10,
                        y: Math.round((pt.y + offset) * 10) / 10,
                      }))
                    : undefined,
                }
              : undefined,
          };
        });
      if (clonedCallouts.length > 0) {
        onUpdateMap({ ...mapData, callouts: [...mapData.callouts, ...clonedCallouts] }, true);
        setSelectedCalloutIds(newCalloutIds);
      }
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [
    pushHistorySnapshot,
    selectedElementIds,
    selectedCalloutIds,
    drawings,
    utilities,
    players,
    mapData,
    onUpdateMap,
    isDe,
    setDrawings,
    setUtilities,
    setPlayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setContextMenu,
    setHasChangesInSession,
  ]);

  const handleGroupSelected = useCallback(() => {
    const totalCount = selectedElementIds.length + selectedCalloutIds.length;
    if (totalCount < 2) return;
    pushHistorySnapshot();

    const selectedGroups = new Set([
      ...drawings.filter((d) => selectedElementIds.includes(d.id)).map((d) => d.groupId),
      ...utilities.filter((u) => selectedElementIds.includes(u.id)).map((u) => u.groupId),
      ...players.filter((p) => selectedElementIds.includes(p.id)).map((p) => p.groupId),
      ...mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id)).map((c) => c.groupId),
    ]);
    const shouldUngroup = selectedGroups.size === 1 && !selectedGroups.has(undefined);
    const nextGroupId = shouldUngroup ? undefined : `grp_${Date.now()}`;

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.map((d) => (selectedElementIds.includes(d.id) ? { ...d, groupId: nextGroupId } : d))
      );
      setUtilities((prev) =>
        prev.map((u) => (selectedElementIds.includes(u.id) ? { ...u, groupId: nextGroupId } : u))
      );
      setPlayers((prev) =>
        prev.map((p) => (selectedElementIds.includes(p.id) ? { ...p, groupId: nextGroupId } : p))
      );
    }

    if (selectedCalloutIds.length > 0) {
      const updatedCallouts = mapData.callouts.map((c) =>
        selectedCalloutIds.includes(c.id) ? { ...c, groupId: nextGroupId } : c
      );
      onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [
    pushHistorySnapshot,
    selectedElementIds,
    selectedCalloutIds,
    drawings,
    utilities,
    players,
    mapData,
    onUpdateMap,
    setDrawings,
    setUtilities,
    setPlayers,
    setContextMenu,
    setHasChangesInSession,
  ]);

  const handleToggleLockSelected = useCallback(() => {
    if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;
    pushHistorySnapshot();

    const anyUnlocked =
      drawings.some((d) => selectedElementIds.includes(d.id) && !d.locked) ||
      utilities.some((u) => selectedElementIds.includes(u.id) && !u.locked) ||
      players.some((p) => selectedElementIds.includes(p.id) && !p.locked) ||
      mapData.callouts.some((c) => selectedCalloutIds.includes(c.id) && !c.locked);
    const nextLock = anyUnlocked;

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.map((d) => (selectedElementIds.includes(d.id) ? { ...d, locked: nextLock } : d))
      );
      setUtilities((prev) =>
        prev.map((u) => (selectedElementIds.includes(u.id) ? { ...u, locked: nextLock } : u))
      );
      setPlayers((prev) =>
        prev.map((p) => (selectedElementIds.includes(p.id) ? { ...p, locked: nextLock } : p))
      );
    }

    if (selectedCalloutIds.length > 0) {
      const updatedCallouts = mapData.callouts.map((c) =>
        selectedCalloutIds.includes(c.id) ? { ...c, locked: nextLock } : c
      );
      onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [
    pushHistorySnapshot,
    selectedElementIds,
    selectedCalloutIds,
    drawings,
    utilities,
    players,
    mapData,
    onUpdateMap,
    setDrawings,
    setUtilities,
    setPlayers,
    setContextMenu,
    setHasChangesInSession,
  ]);

  const handleDeleteSelectedElements = useCallback(() => {
    if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;
    pushHistorySnapshot();

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.filter((d) => !(selectedElementIds.includes(d.id) && !d.locked && !isLayerLocked(d.layerId)))
      );
      setUtilities((prev) =>
        prev.filter(
          (u) => !(selectedElementIds.includes(u.id) && !u.locked && !isLayerLocked(u.layerId || 'layer_util'))
        )
      );
      setPlayers((prev) =>
        prev.filter(
          (p) =>
            !(
              selectedElementIds.includes(p.id) &&
              !p.locked &&
              !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
            )
        )
      );
      setSelectedElementIds([]);
    }

    if (selectedCalloutIds.length > 0) {
      const remainingCallouts = mapData.callouts.filter(
        (c) => !(selectedCalloutIds.includes(c.id) && !c.locked)
      );
      onUpdateMap({ ...mapData, callouts: remainingCallouts }, true);
      setSelectedCalloutIds([]);
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
    }

    setContextMenu(null);
    setShowContextColorPicker(false);
    setShowContextColorSubmenu(false);
    setHasChangesInSession(true);
  }, [
    pushHistorySnapshot,
    selectedElementIds,
    selectedCalloutIds,
    isLayerLocked,
    mapData,
    onUpdateMap,
    setDrawings,
    setUtilities,
    setPlayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setHighlightedCalloutId,
    setContextMenu,
    setShowContextColorPicker,
    setShowContextColorSubmenu,
    setHasChangesInSession,
  ]);

  const handleUpdateSelectedElementsProps = useCallback(
    (patch: SelectedElementsPatch) => {
      if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;
      if (patch.label === undefined) {
        pushHistorySnapshot();
      }

      if (selectedElementIds.length > 0) {
        setDrawings((prev) =>
          prev.map((d) =>
            selectedElementIds.includes(d.id)
              ? {
                  ...d,
                  ...(patch.color !== undefined ? { color: patch.color } : {}),
                  ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                  ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
                }
              : d
          )
        );
        setUtilities((prev) =>
          prev.map((u) => {
            if (!selectedElementIds.includes(u.id)) return u;
            const next: UtilityMarker = {
              ...u,
              ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
              ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
              ...(patch.throwType !== undefined ? { throwType: patch.throwType } : {}),
              ...(patch.label !== undefined ? { label: patch.label || undefined } : {}),
              ...(patch.curveBend !== undefined ? { curveBend: patch.curveBend } : {}),
            };
            if (patch.removeThrowFrom) {
              delete next.throwFrom;
              delete next.curveBend;
              delete next.throwType;
            } else if (patch.addDefaultThrowFrom && !next.throwFrom) {
              next.throwFrom = {
                x: Math.max(-46, Math.min(46, Math.round((next.x - 14) * 10) / 10)),
                y: Math.max(-46, Math.min(46, Math.round((next.y + 14) * 10) / 10)),
              };
            }
            if (patch.resetCurve) {
              delete next.curveBend;
            }
            return next;
          })
        );
        setPlayers((prev) =>
          prev.map((p) =>
            selectedElementIds.includes(p.id)
              ? {
                  ...p,
                  ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                  ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
                }
              : p
          )
        );
      }

      if (selectedCalloutIds.length > 0 && patch.color !== undefined) {
        const updatedCallouts = mapData.callouts.map((c) => {
          if (!selectedCalloutIds.includes(c.id)) return c;
          if (c.area) {
            return { ...c, area: { ...c.area, customColor: patch.color } };
          }
          const w = 10;
          const h = 10;
          return {
            ...c,
            area: {
              x: Math.max(-50, Math.min(50 - w, Math.round((c.x - w / 2) * 10) / 10)),
              y: Math.max(-50, Math.min(50 - h, Math.round((c.y - h / 2) * 10) / 10)),
              width: w,
              height: h,
              shape: 'rect' as const,
              customColor: patch.color,
            },
          };
        });
        onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
      }

      setHasChangesInSession(true);
    },
    [
      pushHistorySnapshot,
      selectedElementIds,
      selectedCalloutIds,
      mapData,
      onUpdateMap,
      setDrawings,
      setUtilities,
      setPlayers,
      setHasChangesInSession,
    ]
  );

  return {
    handleSelectElement,
    handleSelectCalloutMulti,
    handleDuplicateSelected,
    handleGroupSelected,
    handleToggleLockSelected,
    handleDeleteSelectedElements,
    handleUpdateSelectedElementsProps,
  };
}
