import { MapData, Language, Theme } from '../types';
import { INITIAL_MAPS } from '../data/mapsData';

const STORAGE_KEYS = {
  MAPS: 'cs2freitag_maps_v3',
  FAVORITES: 'cs2freitag_favorites_v3',
  THEME: 'cs2freitag_theme_v3',
  LANGUAGE: 'cs2freitag_lang_v3',
  CUSTOM_GROUPS: 'cs2freitag_custom_groups_v3',
  DELETED_MAPS: 'cs2freitag_deleted_maps_v3',
};

// Initial default favorites: popular active duty maps
const DEFAULT_FAVORITES = ['mirage', 'inferno', 'dust2', 'nuke'];

function ensureCenteredCoordinates(maps: MapData[]): MapData[] {
  return maps.map((map) => {
    const callouts = map.callouts || [];

    // Helper to check if map callouts are severely over-shifted to top-left (e.g. avgX < -35 and avgY < -35)
    if (callouts.length > 0) {
      const avgX = callouts.reduce((sum, c) => sum + c.x, 0) / callouts.length;
      const avgY = callouts.reduce((sum, c) => sum + c.y, 0) / callouts.length;
      if (avgX < -35 && avgY < -35) {
        // Repair double-shifted coordinates by adding 50 back
        return {
          ...map,
          callouts: callouts.map((c) => ({
            ...c,
            x: Math.round((c.x + 50) * 10) / 10,
            y: Math.round((c.y + 50) * 10) / 10,
            area: c.area
              ? {
                  ...c.area,
                  x: Math.round((c.area.x + 50) * 10) / 10,
                  y: Math.round((c.area.y + 50) * 10) / 10,
                }
              : undefined,
          })),
          isCenteredCoords: true,
        };
      }
    }

    if ((map as any).isCenteredCoords) return map;

    // Check if callouts are ALREADY centered (e.g. any coordinate is negative)
    const isAlreadyCentered = callouts.some(
      (c) => c.x < 0 || c.y < 0 || (c.area && (c.area.x < 0 || c.area.y < 0))
    );

    if (isAlreadyCentered) {
      return {
        ...map,
        isCenteredCoords: true,
      };
    }

    // Otherwise convert legacy 0..100 coordinates to centered -50..+50 coordinates
    return {
      ...map,
      callouts: callouts.map((c) => {
        const newX = Math.round((c.x - 50) * 10) / 10;
        const newY = Math.round((c.y - 50) * 10) / 10;
        let newArea = c.area
          ? {
              ...c.area,
              x: Math.round((c.area.x - 50) * 10) / 10,
              y: Math.round((c.area.y - 50) * 10) / 10,
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
  return centeredMaps.map((map) => ({
    ...map,
    callouts: map.callouts.map((c) => {
      const isCT =
        c.zone === 'ct_spawn' ||
        c.id.endsWith('_ct_spawn') ||
        c.name.toLowerCase().includes('ct spawn') ||
        c.name.toLowerCase() === 'ct-spawn';
      const isT =
        c.zone === 't_spawn' ||
        c.id.endsWith('_t_spawn') ||
        c.name.toLowerCase().includes('t spawn') ||
        c.name.toLowerCase() === 't-spawn';

      if (isCT) {
        if (!c.customImage || c.customImage === '/ct.png' || c.customImage.startsWith('/ct.png')) {
          return {
            ...c,
            displayMode: c.displayMode || 'image',
            customImage: '/ct.png',
            imageSize: c.imageSize || 36,
          };
        }
      }
      if (isT) {
        if (!c.customImage || c.customImage === '/T.png' || c.customImage === '/t.png' || c.customImage.startsWith('/T.png') || c.customImage.startsWith('/t.png')) {
          return {
            ...c,
            displayMode: c.displayMode || 'image',
            customImage: '/T.png',
            imageSize: c.imageSize || 36,
          };
        }
      }
      return c;
    }),
  }));
}

export function loadStoredMaps(): MapData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MAPS);
    const deletedIds = loadDeletedMapIds();

    if (raw) {
      let parsed: MapData[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Remove arms race maps, poseidon, and deleted maps
        parsed = parsed.filter(
          (m) =>
            m.category !== 'armsrace' &&
            m.id !== 'baggage' &&
            m.id !== 'shoots' &&
            m.id !== 'poseidon' &&
            !deletedIds.has(m.id)
        );

        // Ensure hostage maps are categorized under 'hostage'
        parsed = parsed.map((m) => {
          if (['office', 'italy', 'agency', 'assault'].includes(m.id)) {
            return { ...m, category: 'hostage' };
          }
          return m;
        });

        // Merge missing default maps (respecting deleted list)
        const existingIds = new Set(parsed.map((m) => m.id));
        const missingDefaults = INITIAL_MAPS.filter(
          (m) => m.id !== 'poseidon' && !existingIds.has(m.id) && !deletedIds.has(m.id)
        );
        if (missingDefaults.length > 0) {
          parsed = [...parsed, ...missingDefaults];
        }

        // Apply default spawn emblems (ct.png and T.png)
        parsed = applyDefaultSpawnImages(parsed);
        saveStoredMaps(parsed);
        return parsed;
      }
    }

    // Fallback: Return INITIAL_MAPS filtered by deleted IDs and poseidon
    const filteredDefaults = INITIAL_MAPS.filter(m => m.id !== 'poseidon' && !deletedIds.has(m.id));
    return applyDefaultSpawnImages(filteredDefaults);
  } catch (e) {
    console.error('Failed to load maps from storage:', e);
  }
  return applyDefaultSpawnImages(INITIAL_MAPS.filter(m => m.id !== 'poseidon'));
}

export function loadCustomGroups(): string[] {
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
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_GROUPS, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save custom groups:', e);
  }
}

export function saveStoredMaps(maps: MapData[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MAPS, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to save maps to storage:', e);
  }
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
  return DEFAULT_FAVORITES;
}

export function saveFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
}

export function loadTheme(): Theme {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.THEME);
    if (val === 'light' || val === 'dark') return val;
  } catch (e) {
    // fallback
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    // fallback
  }
}

export function loadLanguage(): Language {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (val === 'de' || val === 'en') return val;
  } catch (e) {
    // fallback
  }
  return 'de';
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch (e) {
    // fallback
  }
}

export function resetToDefaults(): MapData[] {
  try {
    localStorage.removeItem(STORAGE_KEYS.MAPS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_MAPS);
  } catch (e) {
    //
  }
  const cleanDefaults = INITIAL_MAPS.filter(m => m.id !== 'poseidon');
  saveStoredMaps(cleanDefaults);
  return cleanDefaults;
}

export function loadDeletedMapIds(): Set<string> {
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
  try {
    const deleted = loadDeletedMapIds();
    deleted.add(mapId);
    localStorage.setItem(STORAGE_KEYS.DELETED_MAPS, JSON.stringify(Array.from(deleted)));
  } catch (e) {}
}
