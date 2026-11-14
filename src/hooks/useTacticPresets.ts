import { useState, useCallback, useEffect } from 'react';
import {
  Callout,
  MapData,
  PlayerToken,
  TacticLayer,
  TacticPreset,
  TacticalDrawingLine,
  UtilityMarker,
} from '../types';

function mergeMapPresets(mapId: string, cloudPresets: TacticPreset[]): TacticPreset[] {
  if (typeof window === 'undefined') return cloudPresets;
  try {
    const stored = localStorage.getItem(`cs2_tactic_presets_${mapId}`);
    const localPresets: TacticPreset[] = stored ? JSON.parse(stored) : [];
    const merged = new Map<string, TacticPreset>();
    for (const p of cloudPresets) {
      if (p?.id) merged.set(p.id, p);
    }
    for (const p of localPresets) {
      if (p?.id) {
        const ex = merged.get(p.id);
        if (!ex || (p.updatedAt || 0) >= (ex.updatedAt || 0)) merged.set(p.id, p);
      }
    }
    return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return cloudPresets;
  }
}

interface UseTacticPresetsOptions {
  mapData: MapData;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  layers: TacticLayer[];
  setDrawings: React.Dispatch<React.SetStateAction<TacticalDrawingLine[]>>;
  setUtilities: React.Dispatch<React.SetStateAction<UtilityMarker[]>>;
  setPlayers: React.Dispatch<React.SetStateAction<PlayerToken[]>>;
  setLayers: React.Dispatch<React.SetStateAction<TacticLayer[]>>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCalloutIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedCallout: React.Dispatch<React.SetStateAction<Callout | null>>;
  setContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setHasChangesInSession: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateMap: (updatedMap: MapData, skipCloudSync?: boolean) => void;
  onBeforeLoadPreset: () => void;
}

export function useTacticPresets({
  mapData,
  drawings,
  utilities,
  players,
  layers,
  setDrawings,
  setUtilities,
  setPlayers,
  setLayers,
  setSelectedElementIds,
  setSelectedCalloutIds,
  setSelectedCallout,
  setContextMenu,
  setHasChangesInSession,
  onUpdateMap,
  onBeforeLoadPreset,
}: UseTacticPresetsOptions) {
  const [tacticPresets, setTacticPresets] = useState<TacticPreset[]>(() => {
    const cloudPresets = Array.isArray(mapData.tacticData?.presets)
      ? mapData.tacticData.presets
      : [];
    return mergeMapPresets(mapData.id, cloudPresets);
  });

  useEffect(() => {
    const cloudPresets = Array.isArray(mapData.tacticData?.presets)
      ? mapData.tacticData.presets
      : [];
    setTacticPresets(mergeMapPresets(mapData.id, cloudPresets));
  }, [mapData.id]);

  const persistTacticPresets = useCallback(
    (nextPresets: TacticPreset[]) => {
      setTacticPresets(nextPresets);
      try {
        localStorage.setItem(`cs2_tactic_presets_${mapData.id}`, JSON.stringify(nextPresets));
      } catch {
        // ignore storage quota errors
      }
      onUpdateMap(
        {
          ...mapData,
          tacticData: {
            ...(mapData.tacticData || {}),
            drawings,
            utilities,
            players,
            layers,
            presets: nextPresets,
          },
          updatedAt: Date.now(),
        },
        true
      );
      setHasChangesInSession(true);
    },
    [mapData, drawings, utilities, players, layers, onUpdateMap, setHasChangesInSession]
  );

  const handleSavePreset = useCallback(
    (name: string, notes?: string) => {
      const now = Date.now();
      const newPreset: TacticPreset = {
        id: `preset_${now}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        notes,
        createdAt: now,
        updatedAt: now,
        drawings: JSON.parse(JSON.stringify(drawings)),
        utilities: JSON.parse(JSON.stringify(utilities)),
        players: JSON.parse(JSON.stringify(players)),
        layers: JSON.parse(JSON.stringify(layers)),
      };
      persistTacticPresets([newPreset, ...tacticPresets]);
    },
    [drawings, utilities, players, layers, tacticPresets, persistTacticPresets]
  );

  const handleLoadPreset = useCallback(
    (preset: TacticPreset) => {
      onBeforeLoadPreset();
      const nextDrawings: TacticalDrawingLine[] = JSON.parse(
        JSON.stringify(preset.drawings || [])
      );
      const nextUtilities: UtilityMarker[] = JSON.parse(JSON.stringify(preset.utilities || []));
      const nextPlayers: PlayerToken[] = JSON.parse(JSON.stringify(preset.players || []));
      const nextLayers: TacticLayer[] =
        preset.layers && preset.layers.length > 0
          ? JSON.parse(JSON.stringify(preset.layers))
          : layers;

      setDrawings(nextDrawings);
      setUtilities(nextUtilities);
      setPlayers(nextPlayers);
      if (preset.layers && preset.layers.length > 0) {
        setLayers(nextLayers);
      }
      setSelectedElementIds([]);
      setSelectedCalloutIds([]);
      setSelectedCallout(null);
      setContextMenu(null);
      onUpdateMap(
        {
          ...mapData,
          tacticData: {
            ...(mapData.tacticData || {}),
            drawings: nextDrawings,
            utilities: nextUtilities,
            players: nextPlayers,
            layers: nextLayers,
            presets: tacticPresets,
          },
          updatedAt: Date.now(),
        },
        true
      );
      setHasChangesInSession(true);
    },
    [
      onBeforeLoadPreset,
      layers,
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
      setContextMenu,
      setHasChangesInSession,
    ]
  );

  const handleRenamePreset = useCallback(
    (presetId: string, newName: string) => {
      const next = tacticPresets.map((p) =>
        p.id === presetId ? { ...p, name: newName, updatedAt: Date.now() } : p
      );
      persistTacticPresets(next);
    },
    [tacticPresets, persistTacticPresets]
  );

  const handleOverwritePreset = useCallback(
    (presetId: string) => {
      const next = tacticPresets.map((p) =>
        p.id === presetId
          ? {
              ...p,
              updatedAt: Date.now(),
              drawings: JSON.parse(JSON.stringify(drawings)),
              utilities: JSON.parse(JSON.stringify(utilities)),
              players: JSON.parse(JSON.stringify(players)),
              layers: JSON.parse(JSON.stringify(layers)),
            }
          : p
      );
      persistTacticPresets(next);
    },
    [tacticPresets, drawings, utilities, players, layers, persistTacticPresets]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      persistTacticPresets(tacticPresets.filter((p) => p.id !== presetId));
    },
    [tacticPresets, persistTacticPresets]
  );

  return {
    tacticPresets,
    handleSavePreset,
    handleLoadPreset,
    handleRenamePreset,
    handleOverwritePreset,
    handleDeletePreset,
  };
}
