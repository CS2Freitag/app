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
        updated.pinOffsetX = updated.pinOffsetX ?? 0;
        updated.pinOffsetY = updated.pinOffsetY ?? 25;
        if (!(updated as any).__shifted) {
          updated.y = Math.round((updated.y - 1.5) * 10) / 10;
          if (updated.area) {
            updated.area = {
              ...updated.area,
              y: Math.round((updated.area.y - 1.5) * 10) / 10,
              points: updated.area.points ? updated.area.points.map(p => ({ ...p, y: Math.round((p.y - 1.5) * 10) / 10 })) : undefined
            };
          }
          (updated as any).__shifted = true;
        }
      }
      const name = (updated.name || '').toLowerCase();
      const id = updated.id || '';
      const zone = updated.zone || '';
      const isCT =
        zone === 'ct_spawn' ||
        id.endsWith('_ct_spawn') ||
        name.includes('ct spawn') ||
        name === 'ct-spawn';
      const isT =
        zone === 't_spawn' ||
        id.endsWith('_t_spawn') ||
        name.includes('t spawn') ||
        name === 't-spawn';

      if (isCT) {
        if (!updated.customImage || updated.customImage === '/ct.png' || updated.customImage === 'ct.png' || updated.customImage.startsWith('/ct.png')) {
          updated.displayMode = updated.displayMode || 'image';
          updated.customImage = 'ct.png';
          updated.imageSize = updated.imageSize || 36;
        }
      }
      if (isT) {
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

export function loadStoredMaps(): MapData[] {
  if (!isBrowser) {
    return applyDefaultSpawnImages(INITIAL_MAPS);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAPS);
    const deletedIds = loadDeletedMapIds();
    const initialMapMap = new Map(INITIAL_MAPS.map(m => [m.id, m]));

    if (raw) {
      let parsed: MapData[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Update with INITIAL_MAPS (backup) versions to ensure all backup updates are active
        parsed = parsed.map(m => {
          const defaultVersion = initialMapMap.get(m.id);
          if (defaultVersion) {
            return defaultVersion;
          }
          return {
            ...m,
            image: m.image && m.image.startsWith('/') ? m.image.substring(1) : m.image,
            lowerImage: m.lowerImage && m.lowerImage.startsWith('/') ? m.lowerImage.substring(1) : m.lowerImage
          };
        });

        // Add any missing maps from INITIAL_MAPS
        const existingIds = new Set(parsed.map(m => m.id));
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

export function loadFavorites(): string[] {
  if (!isBrowser) return INITIAL_SETTINGS.favorites || ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis'];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES) || localStorage.getItem('cs2freitag_favorites_v5_backup');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
  return INITIAL_SETTINGS.favorites || ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis'];
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
  const cleanDefaults = INITIAL_MAPS;
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
