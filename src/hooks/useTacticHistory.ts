import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Callout,
  MapData,
  PlayerToken,
  TacticLayer,
  TacticPreset,
  TacticSnapshot,
  TacticalDrawingLine,
  UtilityMarker,
} from '../types';
import { isAusgangsversion } from '../components/TacticalHistoryPanel';

export interface EditorHistoryState {
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  callouts: Callout[];
  layers: TacticLayer[];
}

interface UseTacticHistoryOptions {
  mapData: MapData;
  isDe: boolean;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  layers: TacticLayer[];
  tacticPresets: TacticPreset[];
  setDrawings: React.Dispatch<React.SetStateAction<TacticalDrawingLine[]>>;
  setUtilities: React.Dispatch<React.SetStateAction<UtilityMarker[]>>;
  setPlayers: React.Dispatch<React.SetStateAction<PlayerToken[]>>;
  setLayers: React.Dispatch<React.SetStateAction<TacticLayer[]>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCalloutIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCallout: React.Dispatch<React.SetStateAction<Callout | null>>;
  setHighlightedCalloutId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setHasChangesInSession: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateMap: (updatedMap: MapData, skipCloudSync?: boolean) => void;
}

export function useTacticHistory({
  mapData,
  isDe,
  drawings,
  utilities,
  players,
  layers,
  tacticPresets,
  setDrawings,
  setUtilities,
  setPlayers,
  setLayers,
  setSelectedElementIds,
  setSelectedCalloutIds,
  setSelectedCallout,
  setHighlightedCalloutId,
  setContextMenu,
  setHasChangesInSession,
  onUpdateMap,
}: UseTacticHistoryOptions) {
  const [historyUndoStack, setHistoryUndoStack] = useState<EditorHistoryState[]>([]);
  const [historyRedoStack, setHistoryRedoStack] = useState<EditorHistoryState[]>([]);
  const dragInitialHistoryRef = useRef<EditorHistoryState | null>(null);
  const eraserInitialHistoryRef = useRef<EditorHistoryState | null>(null);

  useEffect(() => {
    setHistoryUndoStack([]);
    setHistoryRedoStack([]);
  }, [mapData.id]);

  const createEditorSnapshot = useCallback(
    (): EditorHistoryState => ({
      drawings: JSON.parse(JSON.stringify(drawings)),
      utilities: JSON.parse(JSON.stringify(utilities)),
      players: JSON.parse(JSON.stringify(players)),
      callouts: JSON.parse(JSON.stringify(mapData.callouts)),
      layers: JSON.parse(JSON.stringify(layers)),
    }),
    [drawings, utilities, players, mapData.callouts, layers]
  );

  const pushHistorySnapshot = useCallback(
    (customSnapshot?: EditorHistoryState) => {
      const snap = customSnapshot || createEditorSnapshot();
      setHistoryUndoStack((prev) => [...prev.slice(-39), snap]);
      setHistoryRedoStack([]);
    },
    [createEditorSnapshot]
  );

  // Map Version History Snapshots (max 5 saved user versions per map + Ausgangsversion in localStorage)
  const [snapshots, setSnapshots] = useState<TacticSnapshot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`cs2_map_history_${mapData.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .filter((s) => s && Array.isArray(s.callouts))
            .map((s) => ({
              ...s,
              drawings:
                Array.isArray(s.drawings) && s.drawings.length > 0
                  ? s.drawings
                  : mapData.tacticData?.drawings || [],
              utilities:
                Array.isArray(s.utilities) && s.utilities.length > 0
                  ? s.utilities
                  : mapData.tacticData?.utilities || [],
              players:
                Array.isArray(s.players) && s.players.length > 0
                  ? s.players
                  : mapData.tacticData?.players || [],
            }))
            .slice(0, 5);
          if (valid.length > 0) return valid;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: `map_snap_init_${Date.now()}`,
        timestamp: Date.now(),
        label: isDe ? 'Ausgangsversion' : 'Initial map',
        changedCount: mapData.callouts.length,
        callouts: JSON.parse(JSON.stringify(mapData.callouts)),
        drawings: JSON.parse(JSON.stringify(mapData.tacticData?.drawings || [])),
        utilities: JSON.parse(JSON.stringify(mapData.tacticData?.utilities || [])),
        players: JSON.parse(JSON.stringify(mapData.tacticData?.players || [])),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(`cs2_map_history_${mapData.id}`, JSON.stringify(snapshots.slice(0, 5)));
    } catch {
      // ignore
    }
  }, [snapshots, mapData.id]);

  const handleSaveSnapshot = useCallback(
    (customLabel?: string, overrideCallouts?: Callout[]) => {
      const targetCallouts = overrideCallouts || mapData.callouts;
      const serialized = JSON.stringify(targetCallouts);
      const serializedDrawings = JSON.stringify(drawings);
      const serializedUtilities = JSON.stringify(utilities);
      const serializedPlayers = JSON.stringify(players);
      setSnapshots((prev) => {
        if (
          prev.length > 0 &&
          JSON.stringify(prev[0].callouts) === serialized &&
          JSON.stringify(prev[0].drawings ?? []) === serializedDrawings &&
          JSON.stringify(prev[0].utilities ?? []) === serializedUtilities &&
          JSON.stringify(prev[0].players ?? []) === serializedPlayers
        ) {
          return prev;
        }
        const areaCount = targetCallouts.filter((c) => Boolean(c.area)).length;
        const newSnap: TacticSnapshot = {
          id: `map_snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          label:
            customLabel ||
            `${mapData.name} ${isDe ? 'gesichert' : 'saved'} (${targetCallouts.length} / ${areaCount})`,
          changedCount: targetCallouts.length,
          callouts: JSON.parse(serialized),
          drawings: JSON.parse(serializedDrawings),
          utilities: JSON.parse(serializedUtilities),
          players: JSON.parse(serializedPlayers),
        };
        const userSnaps = prev.filter((s) => !isAusgangsversion(s));
        const initSnap = prev.find((s) => isAusgangsversion(s));
        const nextUserSnaps = [newSnap, ...userSnaps].slice(0, 5);
        return initSnap ? [...nextUserSnaps, initSnap] : nextUserSnaps;
      });
    },
    [mapData.callouts, mapData.name, isDe, drawings, utilities, players]
  );

  const handleDeleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId || isAusgangsversion(s)));
  }, []);

  const handleClearHistory = useCallback(() => {
    setSnapshots((prev) => {
      const userSnaps = prev.filter((s) => !isAusgangsversion(s));
      const initSnap = prev.find((s) => isAusgangsversion(s));
      const keptUserSnap = userSnaps[0] ? [userSnaps[0]] : [];
      return initSnap ? [...keptUserSnap, initSnap] : keptUserSnap;
    });
  }, []);

  const handleRestoreSnapshot = useCallback(
    (snap: TacticSnapshot) => {
      pushHistorySnapshot();
      const currentSerialized = JSON.stringify(mapData.callouts);
      const targetSerialized = JSON.stringify(snap.callouts || []);
      const currentDrawingsStr = JSON.stringify(drawings);
      const currentUtilsStr = JSON.stringify(utilities);
      const currentPlayersStr = JSON.stringify(players);
      if (
        currentSerialized !== targetSerialized ||
        (snap.drawings && currentDrawingsStr !== JSON.stringify(snap.drawings)) ||
        (snap.utilities && currentUtilsStr !== JSON.stringify(snap.utilities)) ||
        (snap.players && currentPlayersStr !== JSON.stringify(snap.players))
      ) {
        const safetyBackup: TacticSnapshot = {
          id: `map_snap_pre_restore_${Date.now()}`,
          timestamp: Date.now(),
          label: isDe ? 'Sicherung vor Wiederherstellung' : 'Backup before restore',
          changedCount: mapData.callouts.length,
          callouts: JSON.parse(currentSerialized),
          drawings: JSON.parse(currentDrawingsStr),
          utilities: JSON.parse(currentUtilsStr),
          players: JSON.parse(currentPlayersStr),
        };
        setSnapshots((prev) => {
          const userSnaps = prev.filter((s) => !isAusgangsversion(s));
          const initSnap = prev.find((s) => isAusgangsversion(s));
          const nextUserSnaps = [safetyBackup, ...userSnaps].slice(0, 5);
          return initSnap ? [...nextUserSnaps, initSnap] : nextUserSnaps;
        });
      }

      const restoredCallouts: Callout[] = JSON.parse(targetSerialized);
      const nextDrawings = snap.drawings ? JSON.parse(JSON.stringify(snap.drawings)) : drawings;
      const nextUtilities = snap.utilities ? JSON.parse(JSON.stringify(snap.utilities)) : utilities;
      const nextPlayers = snap.players ? JSON.parse(JSON.stringify(snap.players)) : players;

      if (snap.drawings) setDrawings(nextDrawings);
      if (snap.utilities) setUtilities(nextUtilities);
      if (snap.players) setPlayers(nextPlayers);

      onUpdateMap(
        {
          ...mapData,
          callouts: restoredCallouts,
          tacticData: {
            ...(mapData.tacticData || {}),
            drawings: nextDrawings,
            utilities: nextUtilities,
            players: nextPlayers,
            layers,
            presets: tacticPresets,
          },
          updatedAt: Date.now(),
        },
        true
      );
      setSelectedCallout(null);
      setSelectedCalloutIds([]);
      setHighlightedCalloutId(undefined);
      setHasChangesInSession(true);
    },
    [
      pushHistorySnapshot,
      mapData,
      onUpdateMap,
      isDe,
      drawings,
      utilities,
      players,
      layers,
      tacticPresets,
      setDrawings,
      setUtilities,
      setPlayers,
      setSelectedCallout,
      setSelectedCalloutIds,
      setHighlightedCalloutId,
      setHasChangesInSession,
    ]
  );

  const handleUndo = useCallback(() => {
    if (historyUndoStack.length === 0) return;
    const prevState = historyUndoStack[historyUndoStack.length - 1];
    const currentSnap = createEditorSnapshot();

    setHistoryUndoStack((prev) => prev.slice(0, -1));
    setHistoryRedoStack((prev) => [...prev.slice(-39), currentSnap]);

    setDrawings(prevState.drawings);
    setUtilities(prevState.utilities);
    setPlayers(prevState.players);
    setLayers(prevState.layers);
    setSelectedElementIds([]);
    setSelectedCalloutIds([]);
    setSelectedCallout(null);
    setHighlightedCalloutId(undefined);
    setContextMenu(null);

    onUpdateMap(
      {
        ...mapData,
        callouts: prevState.callouts,
        tacticData: {
          ...(mapData.tacticData || {}),
          drawings: prevState.drawings,
          utilities: prevState.utilities,
          players: prevState.players,
          layers: prevState.layers,
          presets: tacticPresets,
        },
        updatedAt: Date.now(),
      },
      true
    );
    setHasChangesInSession(true);
  }, [
    historyUndoStack,
    createEditorSnapshot,
    mapData,
    tacticPresets,
    onUpdateMap,
    setDrawings,
    setUtilities,
    setPlayers,
    setLayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setHighlightedCalloutId,
    setContextMenu,
    setHasChangesInSession,
  ]);

  const handleRedo = useCallback(() => {
    if (historyRedoStack.length === 0) return;
    const nextState = historyRedoStack[historyRedoStack.length - 1];
    const currentSnap = createEditorSnapshot();

    setHistoryRedoStack((prev) => prev.slice(0, -1));
    setHistoryUndoStack((prev) => [...prev.slice(-39), currentSnap]);

    setDrawings(nextState.drawings);
    setUtilities(nextState.utilities);
    setPlayers(nextState.players);
    setLayers(nextState.layers);
    setSelectedElementIds([]);
    setSelectedCalloutIds([]);
    setSelectedCallout(null);
    setHighlightedCalloutId(undefined);
    setContextMenu(null);

    onUpdateMap(
      {
        ...mapData,
        callouts: nextState.callouts,
        tacticData: {
          ...(mapData.tacticData || {}),
          drawings: nextState.drawings,
          utilities: nextState.utilities,
          players: nextState.players,
          layers: nextState.layers,
          presets: tacticPresets,
        },
        updatedAt: Date.now(),
      },
      true
    );
    setHasChangesInSession(true);
  }, [
    historyRedoStack,
    createEditorSnapshot,
    mapData,
    tacticPresets,
    onUpdateMap,
    setDrawings,
    setUtilities,
    setPlayers,
    setLayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setHighlightedCalloutId,
    setContextMenu,
    setHasChangesInSession,
  ]);

  return {
    canUndo: historyUndoStack.length > 0,
    canRedo: historyRedoStack.length > 0,
    dragInitialHistoryRef,
    eraserInitialHistoryRef,
    createEditorSnapshot,
    pushHistorySnapshot,
    handleUndo,
    handleRedo,
    snapshots,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearHistory,
    handleRestoreSnapshot,
  };
}
