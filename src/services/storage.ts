import { MapData, Language, Theme } from '../types';
import { INITIAL_MAPS, INITIAL_SETTINGS } from '../data/mapsData';

const STORAGE_KEYS = {
  MAPS: 'cs2freitag_maps_v6_integrated',
  FAVORITES: 'cs2freitag_favorites_v6_integrated',
  THEME: 'cs2freitag_theme_v6_integrated',
  LANGUAGE: 'cs2freitag_lang_v6_integrated',
  CUSTOM_GROUPS: 'cs2freitag_custom_groups_v6_integrated',
  DELETED_MAPS: 'cs2freitag_deleted_maps_v6_integrated',
};

function ensureCenteredCoordinates(maps: MapData[]): MapData[] {
  return (maps || []).map((map) => {
    // If map already has verified centered coordinates, retain all callouts, areas, and polygons as-is
    if ((map as any).isCenteredCoords) return map;

    const callouts = map.callouts || [];

    if (callouts.length > 0) {
      const avgX = callouts.reduce((sum, c) => sum + (c.x || 0), 0) / callouts.length;
      const avgY = callouts.reduce((sum, c) => sum + (c.y || 0), 0) / callouts.length;
      if (avgX < -35 && avgY < -35) {
        return {
          ...map,
          callouts: callouts.map((c) => ({
            ...c,
            x: Math.round(((c.x || 0) + 50) * 10) / 10,
            y: Math.round(((c.y || 0) + 50) * 10) / 10,
            area: c.area
              ? {
                  ...c.area,
                  x: Math.round(((c.area.x || 0) + 50) * 10) / 10,
                  y: Math.round(((c.area.y || 0) + 50) * 10) / 10,
                  points: c.area.points
                    ? c.area.points.map((p) => ({
                        x: Math.round(((p.x || 0) + 50) * 10) / 10,
                        y: Math.round(((p.y || 0) + 50) * 10) / 10,
                      }))
                    : undefined,
                }
              : undefined,
          })),
          isCenteredCoords: true,
        };
      }
    }

    const isAlreadyCentered = callouts.some(
      (c) => (c.x || 0) < 0 || (c.y || 0) < 0 || (c.area && ((c.area.x || 0) < 0 || (c.area.y || 0) < 0))
    );

    if (isAlreadyCentered) {
      return {
        ...map,
        isCenteredCoords: true,
      };
    }

    return {
      ...map,
      callouts: callouts.map((c) => {
        const newX = Math.round(((c.x || 0) - 50) * 10) / 10;
        const newY = Math.round(((c.y || 0) - 50) * 10) / 10;
        let newArea = c.area
          ? {
              ...c.area,
              x: Math.round(((c.area.x || 0) - 50) * 10) / 10,
              y: Math.round(((c.area.y || 0) - 50) * 10) / 10,
              points: c.area.points
                ? c.area.points.map((p) => ({
                    x: Math.round(((p.x || 0) - 50) * 10) / 10,
                    y: Math.round(((p.y || 0) - 50) * 10) / 10,
                  }))
                : undefined,
            }
          : undefined;

        return {
          ...c,
          x: newX,
          y: newY,
          area: newArea,
        };
      }),
      isCenteredCoords: true,
    };
  });
}

function applyDefaultSpawnImages(maps: MapData[]): MapData[] {
  const centeredMaps = ensureCenteredCoordinates(maps);
  return (centeredMaps || []).map((map) => ({
    ...map,
    callouts: (map.callouts || []).map((c) => {
      let updated = { ...c };
      if (!!updated.hidePin) {
        updated.pinOffsetX = 0;
        updated.pinOffsetY = 0;
      } else {
        const hadExplicitPinOffset = updated.pinOffsetY !== undefined;
        updated.pinOffsetX = updated.pinOffsetX ?? 0;
        updated.pinOffsetY = updated.pinOffsetY ?? 25;
        if (!(updated as any).__shifted && !hadExplicitPinOffset && !(updated.id || '').startsWith('callout_')) {
          updated.y = Math.round((updated.y - 1.5) * 10) / 10;
          if (updated.area) {
            updated.area = {
              ...updated.area,
              y: Math.round((updated.area.y - 1.5) * 10) / 10,
              points: updated.area.points ? updated.area.points.map(p => ({ ...p, y: Math.round((p.y - 1.5) * 10) / 10 })) : undefined
            };
          }
        }
        (updated as any).__shifted = true;
      }
      const name = (updated.name || '').trim().toLowerCase();
      const id = updated.id || '';
      const isExplicitTextMode = updated.displayMode === 'text';
      const isCT =
        id.endsWith('_ct_spawn') ||
        name === 'ct spawn' ||
        name === 'ct-spawn' ||
        name.startsWith('ct spawn ') ||
        name === 'ct';
      const isT =
        id.endsWith('_t_spawn') ||
        name === 't spawn' ||
        name === 't-spawn' ||
        name.startsWith('t spawn ') ||
        name === 't';

      if (!isExplicitTextMode && isCT) {
        if (!updated.customImage || updated.customImage === '/ct.png' || updated.customImage === 'ct.png' || updated.customImage.startsWith('/ct.png')) {
          updated.displayMode = updated.displayMode || 'image';
          updated.customImage = 'ct.png';
          updated.imageSize = updated.imageSize || 36;
        }
      }
      if (!isExplicitTextMode && isT) {
        if (!updated.customImage || updated.customImage === '/T.png' || updated.customImage === '/t.png' || updated.customImage === 'T.png' || updated.customImage === 't.png' || updated.customImage.startsWith('/T.png') || updated.customImage.startsWith('/t.png')) {
          updated.displayMode = updated.displayMode || 'image';
          updated.customImage = 'T.png';
          updated.imageSize = updated.imageSize || 36;
        }
      }
      return updated;
    }),
  }));
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function mergeDefaultCallouts(map: MapData, defaultMap?: MapData): MapData {
  if (!defaultMap) return map;

  const existingCalloutIds = new Set((map.callouts || []).map((c) => c.id));
  const existingCalloutKeys = new Set(
    (map.callouts || []).map((c) => `${(c.name || '').trim().toLowerCase()}_${c.zone || ''}`)
  );

  const mergedCallouts = [...(map.callouts || [])];
  for (const defCallout of defaultMap.callouts || []) {
    const key = `${(defCallout.name || '').trim().toLowerCase()}_${defCallout.zone || ''}`;
    if (!existingCalloutIds.has(defCallout.id) && !existingCalloutKeys.has(key)) {
      mergedCallouts.push(defCallout);
      existingCalloutIds.add(defCallout.id);
      existingCalloutKeys.add(key);
    }
  }

  return {
    ...map,
    callouts: mergedCallouts,
  };
}

export function loadStoredMaps(): MapData[] {
  if (!isBrowser) {
    return applyDefaultSpawnImages(INITIAL_MAPS);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAPS);
    const deletedIds = loadDeletedMapIds();
    const initialMapMap = new Map(INITIAL_MAPS.map((m) => [m.id, m]));

    if (raw) {
      let parsed: MapData[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Upgrade standard maps if defaultVersion has a newer updatedAt timestamp, while preserving user tactic presets
        parsed = parsed.map((m) => {
          const defaultVersion = initialMapMap.get(m.id);
          const isOutdatedCobblestone =
            m.id === 'cobblestone' &&
            defaultVersion &&
            (!m.image?.startsWith('data:image/jpeg') ||
              (m.callouts || []).some((c) => c.id === 'cbble_sniper_tower'));
          const hasNewerDefault =
            Boolean(defaultVersion) &&
            (m.updatedAt || 0) < (defaultVersion?.updatedAt || 0);

          if (defaultVersion && (hasNewerDefault || isOutdatedCobblestone)) {
            const existingPresets = m.tacticData?.presets || [];
            const defaultPresets = defaultVersion.tacticData?.presets || [];
            const presetMap = new Map<string, any>();
            for (const p of defaultPresets) {
              presetMap.set(p.id, p);
            }
            for (const p of existingPresets) {
              const prev = presetMap.get(p.id);
              if (!prev || (p.updatedAt || 0) >= (prev.updatedAt || 0)) {
                presetMap.set(p.id, p);
              }
            }
            const mergedPresets = Array.from(presetMap.values());

            return {
              ...defaultVersion,
              tacticData: {
                drawings: (defaultVersion.tacticData?.drawings?.length ? defaultVersion.tacticData.drawings : m.tacticData?.drawings) || [],
                utilities: (defaultVersion.tacticData?.utilities?.length ? defaultVersion.tacticData.utilities : m.tacticData?.utilities) || [],
                players: (defaultVersion.tacticData?.players?.length ? defaultVersion.tacticData.players : m.tacticData?.players) || [],
                layers: defaultVersion.tacticData?.layers || m.tacticData?.layers,
                presets: mergedPresets,
              },
              image: defaultVersion.image && defaultVersion.image.startsWith('/') ? defaultVersion.image.substring(1) : defaultVersion.image,
              lowerImage: defaultVersion.lowerImage && defaultVersion.lowerImage.startsWith('/') ? defaultVersion.lowerImage.substring(1) : defaultVersion.lowerImage,
            };
          }
          const merged = defaultVersion ? mergeDefaultCallouts(m, defaultVersion) : m;
          return {
            ...merged,
            image: merged.image && merged.image.startsWith('/') ? merged.image.substring(1) : merged.image,
            lowerImage: merged.lowerImage && merged.lowerImage.startsWith('/') ? merged.lowerImage.substring(1) : merged.lowerImage,
          };
        });

        // Add any missing maps from INITIAL_MAPS (e.g. newly added standard maps)
        const existingIds = new Set(parsed.map((m) => m.id));
        for (const defaultMap of INITIAL_MAPS) {
          if (!existingIds.has(defaultMap.id) && !deletedIds.has(defaultMap.id)) {
            parsed.push(defaultMap);
          }
        }

        parsed = parsed.filter(
          (m) =>
            m.category !== 'armsrace' &&
            m.id !== 'baggage' &&
            m.id !== 'shoots' &&
            m.id !== 'poseidon' &&
            m.id !== 'custom_1793729592299' &&
            !(m.name === 'Poseidon' && (!m.callouts || m.callouts.length === 0)) &&
            !deletedIds.has(m.id)
        );

        parsed = parsed.map((m) => {
          if (['office', 'italy', 'agency', 'assault'].includes(m.id)) {
            return { ...m, category: 'hostage' };
          }
          return m;
        });

        parsed = applyDefaultSpawnImages(parsed);
        saveStoredMaps(parsed);
        return parsed;
      }
    }

    const filteredDefaults = INITIAL_MAPS.filter(m => !deletedIds.has(m.id));
    const processed = applyDefaultSpawnImages(filteredDefaults);
    saveStoredMaps(processed);
    return processed;
  } catch (e) {
    console.error('Failed to load maps from storage:', e);
  }
  return applyDefaultSpawnImages(INITIAL_MAPS);
}

export function loadCustomGroups(): string[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_GROUPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load custom groups:', e);
  }
  return [];
}

export function saveCustomGroups(groups: string[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_GROUPS, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save custom groups:', e);
  }
}

export function saveStoredMaps(maps: MapData[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.MAPS, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to save maps to storage:', e);
  }
}

const FAV_MIGRATION_KEY_V3110 = 'cs2freitag_fav_cobblestone_v3110';

export function loadFavorites(): string[] {
  const defaultFavorites = INITIAL_SETTINGS.favorites || ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis', 'cobblestone'];
  if (!isBrowser) return defaultFavorites;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES) || localStorage.getItem('cs2freitag_favorites_v5_backup');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (!localStorage.getItem(FAV_MIGRATION_KEY_V3110)) {
          localStorage.setItem(FAV_MIGRATION_KEY_V3110, '1');
          if (!parsed.includes('cobblestone')) {
            const next = [...parsed, 'cobblestone'];
            saveFavorites(next);
            return next;
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
  return defaultFavorites;
}

export function saveFavorites(favorites: string[]): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
}

export function loadTheme(): Theme {
  if (!isBrowser) return INITIAL_SETTINGS.theme || 'dark';
  try {
    const val = localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem('cs2freitag_theme_v5_backup');
    if (val === 'light' || val === 'dark') return val as Theme;
  } catch (e) {
    // fallback
  }
  return INITIAL_SETTINGS.theme || 'dark';
}

export function saveTheme(theme: Theme): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    // fallback
  }
}

export function loadLanguage(): Language {
  if (!isBrowser) return INITIAL_SETTINGS.lang || 'de';
  try {
    const val = localStorage.getItem(STORAGE_KEYS.LANGUAGE) || localStorage.getItem('cs2freitag_lang_v5_backup');
    if (val === 'de' || val === 'en') return val as Language;
  } catch (e) {
    // fallback
  }
  return INITIAL_SETTINGS.lang || 'de';
}

export function saveLanguage(lang: Language): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch (e) {
    // fallback
  }
}

export function resetToDefaults(): MapData[] {
  if (isBrowser) {
    try {
      localStorage.removeItem(STORAGE_KEYS.MAPS);
      localStorage.removeItem(STORAGE_KEYS.DELETED_MAPS);
      localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    } catch (e) {
      //
    }
  }
  const cleanDefaults = applyDefaultSpawnImages(INITIAL_MAPS);
  saveStoredMaps(cleanDefaults);
  return cleanDefaults;
}

export function loadDeletedMapIds(): Set<string> {
  if (!isBrowser) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_MAPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  return new Set();
}

export function saveDeletedMapId(mapId: string): void {
  if (!isBrowser) return;
  try {
    const deleted = loadDeletedMapIds();
    deleted.add(mapId);
    localStorage.setItem(STORAGE_KEYS.DELETED_MAPS, JSON.stringify(Array.from(deleted)));
  } catch (e) {}
}
