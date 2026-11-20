export type QuizMode =
  | 'mode1_classic'
  | 'mode2_short'
  | 'mode3_mapclick_classic'
  | 'mode4_mapclick_short'
  | 'mode5_c4_challenge'
  | 'mode6_weak_spots';

import { MapData } from '../types';

export interface WeakCalloutEntry {
  errorCount: number;
  consecutiveCorrect: number;
}

const WEAK_CALLOUTS_STORAGE_KEY = 'cs2_weak_callouts';

function normalizeEntry(val: any): WeakCalloutEntry {
  if (typeof val === 'number') {
    return { errorCount: val, consecutiveCorrect: 0 };
  }
  if (val && typeof val === 'object') {
    return {
      errorCount: Number(val.errorCount) || 0,
      consecutiveCorrect: Number(val.consecutiveCorrect) || 0,
    };
  }
  return { errorCount: 0, consecutiveCorrect: 0 };
}

export function getWeakCalloutsRecord(): Record<string, WeakCalloutEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WEAK_CALLOUTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const result: Record<string, WeakCalloutEntry> = {};
    for (const key of Object.keys(parsed)) {
      result[key] = normalizeEntry(parsed[key]);
    }
    return result;
  } catch {
    return {};
  }
}

export function getWeakCalloutsMap(): Record<string, number> {
  const record = getWeakCalloutsRecord();
  const map: Record<string, number> = {};
  for (const id of Object.keys(record)) {
    if (record[id].errorCount > 0 && record[id].consecutiveCorrect < 3) {
      map[id] = record[id].errorCount;
    }
  }
  return map;
}

export function isWeakCallout(calloutId: string): boolean {
  const record = getWeakCalloutsRecord();
  const entry = record[calloutId];
  if (!entry) return false;
  return entry.errorCount > 0 && entry.consecutiveCorrect < 3;
}

export function recordCalloutResult(calloutId: string, isCorrect: boolean): void {
  if (typeof window === 'undefined' || !calloutId) return;
  try {
    const record = getWeakCalloutsRecord();
    const entry = record[calloutId] || { errorCount: 0, consecutiveCorrect: 0 };

    if (!isCorrect) {
      entry.errorCount += 1;
      entry.consecutiveCorrect = 0; // Fehler setzt den fehlerfreien Zähler sofort auf 0
      record[calloutId] = entry;
    } else {
      // Wenn dieser Callout aktuell ein Fehler ist, fehlerfreie Serie erhöhen
      if (entry.errorCount > 0) {
        entry.consecutiveCorrect += 1;
        // Erst wenn man 3 mal den Callout richtig und kein mal falsch hatte, wird er entfernt
        if (entry.consecutiveCorrect >= 3) {
          delete record[calloutId];
        } else {
          record[calloutId] = entry;
        }
      }
    }
    localStorage.setItem(WEAK_CALLOUTS_STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn('Failed to record callout result:', e);
  }
}

export function getTotalQuizErrors(): number {
  const record = getWeakCalloutsRecord();
  let total = 0;
  for (const id in record) {
    if (record[id].errorCount > 0 && record[id].consecutiveCorrect < 3) {
      total += record[id].errorCount;
    }
  }
  return total;
}

export function getMapWeakCalloutsCount(map: MapData): number {
  if (!map.callouts) return 0;
  return map.callouts.filter((c) => isWeakCallout(c.id)).length;
}

export function getMinimumCalloutsForQuizMode(mode: QuizMode): number {
  if (mode === 'mode6_weak_spots') {
    return 1;
  }
  if (mode === 'mode2_short' || mode === 'mode4_mapclick_short') {
    return 5;
  }
  return 10;
}

export interface QuizFilterSettings {
  quizMode: QuizMode;
  onlyTenOrMoreCallouts: boolean;
  onlyFavorites: boolean;
}

const QUIZ_FILTER_SETTINGS_STORAGE_KEY = 'cs2_quiz_filter_settings';

const VALID_QUIZ_MODES: QuizMode[] = [
  'mode1_classic',
  'mode2_short',
  'mode3_mapclick_classic',
  'mode4_mapclick_short',
  'mode5_c4_challenge',
  'mode6_weak_spots',
];

const DEFAULT_QUIZ_FILTER_SETTINGS: QuizFilterSettings = {
  quizMode: 'mode1_classic',
  onlyTenOrMoreCallouts: false,
  onlyFavorites: false,
};

export function loadQuizFilterSettings(): QuizFilterSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_QUIZ_FILTER_SETTINGS };
  try {
    const raw = localStorage.getItem(QUIZ_FILTER_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QUIZ_FILTER_SETTINGS };
    const parsed = JSON.parse(raw);
    const quizMode = VALID_QUIZ_MODES.includes(parsed?.quizMode)
      ? (parsed.quizMode as QuizMode)
      : DEFAULT_QUIZ_FILTER_SETTINGS.quizMode;
    return {
      quizMode,
      onlyTenOrMoreCallouts: Boolean(parsed?.onlyTenOrMoreCallouts),
      onlyFavorites: Boolean(parsed?.onlyFavorites),
    };
  } catch {
    return { ...DEFAULT_QUIZ_FILTER_SETTINGS };
  }
}

export function saveQuizFilterSettings(settings: QuizFilterSettings): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized: QuizFilterSettings = {
      quizMode: VALID_QUIZ_MODES.includes(settings.quizMode)
        ? settings.quizMode
        : DEFAULT_QUIZ_FILTER_SETTINGS.quizMode,
      onlyTenOrMoreCallouts: Boolean(settings.onlyTenOrMoreCallouts),
      onlyFavorites: Boolean(settings.onlyFavorites),
    };
    localStorage.setItem(QUIZ_FILTER_SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Failed to save quiz filter settings:', e);
  }
}

export function getEffectiveMinimumCallouts(
  mode: QuizMode,
  onlyTenOrMoreCallouts: boolean
): number {
  const baseMin = getMinimumCalloutsForQuizMode(mode);
  return onlyTenOrMoreCallouts ? Math.max(baseMin, 10) : baseMin;
}

export function getEligibleMapsForQuiz(maps: MapData[], mode: QuizMode): MapData[] {
  if (mode === 'mode6_weak_spots') {
    return maps.filter((m) => getMapWeakCalloutsCount(m) > 0);
  }
  const minCallouts = getMinimumCalloutsForQuizMode(mode);
  return maps.filter((m) => (m.callouts?.length || 0) >= minCallouts);
}

export function getFilteredMapsForQuiz(
  maps: MapData[],
  mode: QuizMode,
  settings: Pick<QuizFilterSettings, 'onlyTenOrMoreCallouts' | 'onlyFavorites'>,
  favoriteMapIds: string[] = []
): MapData[] {
  let result = getEligibleMapsForQuiz(maps, mode);
  if (settings.onlyTenOrMoreCallouts) {
    result = result.filter((m) => (m.callouts?.length || 0) >= 10);
  }
  if (settings.onlyFavorites) {
    const favSet = new Set(favoriteMapIds);
    result = result.filter((m) => favSet.has(m.id));
  }
  return result;
}

export function isCalloutForLevel(
  callout: { id: string; name: string; zone?: string; level?: 'upper' | 'lower' | 'both' },
  targetLevel: 'upper' | 'lower',
  hasLowerMap: boolean = true
): boolean {
  if (!hasLowerMap) return targetLevel === 'upper';
  if (callout.level === 'both') return true;
  if (callout.level === 'upper') return targetLevel === 'upper';
  if (callout.level === 'lower') return targetLevel === 'lower';

  const lowerKeywords = [
    'lower', 'unten', 'b site', 'b_site', 'secret', 'ramp', 'vent', 'tunnels', 'subway', 'under', 'bombsite b', 'b-site', 'decon', 'dark'
  ];
  const nameAndZone = `${callout.name} ${callout.id} ${callout.zone || ''}`.toLowerCase();
  const seemsLower =
    lowerKeywords.some((kw) => nameAndZone.includes(kw)) ||
    /\bb\b/i.test(callout.name) ||
    callout.zone === 'b_site';
  return targetLevel === 'lower' ? seemsLower : !seemsLower;
}

export interface C4HighscoreEntry {
  timeSeconds: number; // gemessene Zeit in Sekunden
  score: number; // erreichte Treffer
  totalQuestions: number; // Callouts insgesamt
  timestamp: number;
}

const C4_HIGHSCORES_STORAGE_KEY = 'cs2_c4_highscores';

export function getC4HighscoresRecord(): Record<string, C4HighscoreEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(C4_HIGHSCORES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getC4HighscoreForMap(mapId: string): C4HighscoreEntry | null {
  const all = getC4HighscoresRecord();
  return all[mapId] || null;
}

export function formatMinutesAndSeconds(seconds: number): string {
  const safeSec = Math.max(0, Math.round(seconds));
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s} Min.`;
}

export function recordC4Highscore(
  mapId: string,
  timeSeconds: number,
  score: number,
  totalQuestions: number
): boolean {
  if (typeof window === 'undefined' || !mapId || score <= 0) return false;
  try {
    const all = getC4HighscoresRecord();
    const current = all[mapId];

    let isBetter = false;
    if (!current) {
      isBetter = true;
    } else if (score > current.score) {
      isBetter = true;
    } else if (score === current.score && timeSeconds < current.timeSeconds) {
      isBetter = true;
    }

    if (isBetter) {
      all[mapId] = {
        timeSeconds: Math.max(1, Math.round(timeSeconds)),
        score,
        totalQuestions,
        timestamp: Date.now(),
      };
      localStorage.setItem(C4_HIGHSCORES_STORAGE_KEY, JSON.stringify(all));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to record C4 highscore:', e);
    return false;
  }
}