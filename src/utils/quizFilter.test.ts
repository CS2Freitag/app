import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEligibleMapsForQuiz,
  getMinimumCalloutsForQuizMode,
  QuizMode,
} from './quizFilter';
import { MapData } from '../types';

function makeMap(id: string, calloutCount: number): MapData {
  return {
    id,
    name: `Map ${id}`,
    slug: id,
    category: 'active',
    image: '/maps/test.png',
    descriptionDe: '',
    descriptionEn: '',
    callouts: Array.from({ length: calloutCount }, (_, idx) => ({
      id: `${id}_c_${idx}`,
      name: `Callout ${idx + 1}`,
      x: 0,
      y: 0,
      zone: 'other',
      danger: 'low',
      descriptionDe: '',
      descriptionEn: '',
      tacticalTipDe: '',
      tacticalTipEn: '',
      commonAnglesDe: '',
      commonAnglesEn: '',
    })),
  };
}

test('getMinimumCalloutsForQuizMode returns 5 for short modes and 10 for classic & C4 modes', () => {
  assert.equal(getMinimumCalloutsForQuizMode('mode1_classic'), 10);
  assert.equal(getMinimumCalloutsForQuizMode('mode3_mapclick_classic'), 10);
  assert.equal(getMinimumCalloutsForQuizMode('mode5_c4_challenge'), 10);
  assert.equal(getMinimumCalloutsForQuizMode('mode2_short'), 5);
  assert.equal(getMinimumCalloutsForQuizMode('mode4_mapclick_short'), 5);
});

test('maps with fewer than 5 callouts are never shown, and maps with fewer than 10 callouts are hidden in 10-question and C4 modes', () => {
  const sampleMaps: MapData[] = [
    makeMap('zero', 0),
    makeMap('four', 4),
    makeMap('five', 5),
    makeMap('nine', 9),
    makeMap('ten', 10),
    makeMap('fifteen', 15),
  ];

  const tenQuestionModes: QuizMode[] = ['mode1_classic', 'mode3_mapclick_classic', 'mode5_c4_challenge'];
  for (const mode of tenQuestionModes) {
    const ids = getEligibleMapsForQuiz(sampleMaps, mode).map((m) => m.id);
    assert.deepEqual(ids, ['ten', 'fifteen']);
  }

  const fiveQuestionModes: QuizMode[] = ['mode2_short', 'mode4_mapclick_short'];
  for (const mode of fiveQuestionModes) {
    const ids = getEligibleMapsForQuiz(sampleMaps, mode).map((m) => m.id);
    assert.deepEqual(ids, ['five', 'nine', 'ten', 'fifteen']);
  }
});

test('weak callout requires 3 consecutive correct answers without mistakes to be removed', async () => {
  const { recordCalloutResult, isWeakCallout, getMapWeakCalloutsCount, getEligibleMapsForQuiz } = await import('./quizFilter');
  
  // Set up mock localStorage and window in node environment
  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
  (globalThis as any).window = globalThis;

  const mapA = makeMap('mapA', 5);
  const callout1 = mapA.callouts[0].id;
  const callout2 = mapA.callouts[1].id;

  // Initially neither is weak
  assert.equal(isWeakCallout(callout1), false);
  assert.equal(getMapWeakCalloutsCount(mapA), 0);

  // User misses callout1 twice and callout2 once
  recordCalloutResult(callout1, false);
  recordCalloutResult(callout1, false);
  recordCalloutResult(callout2, false);

  assert.equal(isWeakCallout(callout1), true);
  assert.equal(isWeakCallout(callout2), true);
  // Distinct wrong callouts count on mapA should be 2, even though callout1 was missed twice!
  assert.equal(getMapWeakCalloutsCount(mapA), 2);

  // Eligible maps for mode6_weak_spots includes mapA
  const eligible1 = getEligibleMapsForQuiz([mapA], 'mode6_weak_spots');
  assert.equal(eligible1.length, 1);

  // 1st correct answer for callout1 -> still weak!
  recordCalloutResult(callout1, true);
  assert.equal(isWeakCallout(callout1), true);

  // 2nd correct answer for callout1 -> still weak!
  recordCalloutResult(callout1, true);
  assert.equal(isWeakCallout(callout1), true);

  // Another mistake -> resets streak
  recordCalloutResult(callout1, false);
  assert.equal(isWeakCallout(callout1), true);

  // Now answer 3 times correctly in a row
  recordCalloutResult(callout1, true); // 1/3
  assert.equal(isWeakCallout(callout1), true);
  recordCalloutResult(callout1, true); // 2/3
  assert.equal(isWeakCallout(callout1), true);
  recordCalloutResult(callout1, true); // 3/3 -> now mastered!
  assert.equal(isWeakCallout(callout1), false);

  // Only callout2 remains weak on mapA
  assert.equal(getMapWeakCalloutsCount(mapA), 1);

  // Answer callout2 correctly 3 times
  recordCalloutResult(callout2, true);
  recordCalloutResult(callout2, true);
  recordCalloutResult(callout2, true);
  assert.equal(isWeakCallout(callout2), false);

  // MapA now has 0 weak callouts and is removed from mode6_weak_spots
  assert.equal(getMapWeakCalloutsCount(mapA), 0);
  const eligible2 = getEligibleMapsForQuiz([mapA], 'mode6_weak_spots');
  assert.equal(eligible2.length, 0);
});

test('formatMinutesAndSeconds and recordC4Highscore track best score and fastest measured time per map', async () => {
  const { formatMinutesAndSeconds, recordC4Highscore, getC4HighscoreForMap } = await import('./quizFilter');

  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
  (globalThis as any).window = globalThis;

  assert.equal(formatMinutesAndSeconds(5), '00:05 Min.');
  assert.equal(formatMinutesAndSeconds(40), '00:40 Min.');
  assert.equal(formatMinutesAndSeconds(75), '01:15 Min.');

  // 0-score timeout is not recorded as a personal highscore
  assert.equal(recordC4Highscore('mirage', 40, 0, 10), false);
  assert.equal(getC4HighscoreForMap('mirage'), null);

  // First valid score is recorded
  assert.equal(recordC4Highscore('mirage', 38, 6, 10), true);
  assert.equal(getC4HighscoreForMap('mirage')?.timeSeconds, 38);
  assert.equal(getC4HighscoreForMap('mirage')?.score, 6);

  // Same score with slower time does not overwrite
  assert.equal(recordC4Highscore('mirage', 39, 6, 10), false);
  assert.equal(getC4HighscoreForMap('mirage')?.timeSeconds, 38);

  // Same score with faster time overwrites
  assert.equal(recordC4Highscore('mirage', 27, 6, 10), true);
  assert.equal(getC4HighscoreForMap('mirage')?.timeSeconds, 27);

  // Higher score overwrites even if time is longer
  assert.equal(recordC4Highscore('mirage', 35, 8, 10), true);
  assert.equal(getC4HighscoreForMap('mirage')?.score, 8);
  assert.equal(getC4HighscoreForMap('mirage')?.timeSeconds, 35);
});

test('quiz filter settings persist across sessions and apply >10 callout and favorite filters', async () => {
  const {
    loadQuizFilterSettings,
    saveQuizFilterSettings,
    getFilteredMapsForQuiz,
    getEffectiveMinimumCallouts,
  } = await import('./quizFilter');

  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
  (globalThis as any).window = globalThis;

  // Defaults on clean storage
  assert.deepEqual(loadQuizFilterSettings(), {
    quizMode: 'mode1_classic',
    onlyTenOrMoreCallouts: false,
    onlyFavorites: false,
  });

  // Save and reload settings
  saveQuizFilterSettings({
    quizMode: 'mode2_short',
    onlyTenOrMoreCallouts: true,
    onlyFavorites: true,
  });
  assert.deepEqual(loadQuizFilterSettings(), {
    quizMode: 'mode2_short',
    onlyTenOrMoreCallouts: true,
    onlyFavorites: true,
  });

  // Corrupted storage falls back safely
  store['cs2_quiz_filter_settings'] = '{invalid-json';
  assert.equal(loadQuizFilterSettings().quizMode, 'mode1_classic');

  assert.equal(getEffectiveMinimumCallouts('mode2_short', false), 5);
  assert.equal(getEffectiveMinimumCallouts('mode2_short', true), 10);

  const maps = [makeMap('small', 6), makeMap('ten', 10), makeMap('big_fav', 18)];
  assert.deepEqual(
    getFilteredMapsForQuiz(maps, 'mode2_short', { onlyTenOrMoreCallouts: true, onlyFavorites: false }).map((m) => m.id),
    ['ten', 'big_fav']
  );
  assert.deepEqual(
    getFilteredMapsForQuiz(maps, 'mode2_short', { onlyTenOrMoreCallouts: true, onlyFavorites: true }, ['small', 'big_fav']).map((m) => m.id),
    ['big_fav']
  );
});


