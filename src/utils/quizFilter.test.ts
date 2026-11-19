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

test('getMinimumCalloutsForQuizMode returns 5 for short modes and 10 for classic modes', () => {
  assert.equal(getMinimumCalloutsForQuizMode('mode1_classic'), 10);
  assert.equal(getMinimumCalloutsForQuizMode('mode3_mapclick_classic'), 10);
  assert.equal(getMinimumCalloutsForQuizMode('mode2_short'), 5);
  assert.equal(getMinimumCalloutsForQuizMode('mode4_mapclick_short'), 5);
});

test('maps with fewer than 5 callouts are never shown, and maps with fewer than 10 callouts are hidden in 10-question modes', () => {
  const sampleMaps: MapData[] = [
    makeMap('zero', 0),
    makeMap('four', 4),
    makeMap('five', 5),
    makeMap('nine', 9),
    makeMap('ten', 10),
    makeMap('fifteen', 15),
  ];

  const tenQuestionModes: QuizMode[] = ['mode1_classic', 'mode3_mapclick_classic'];
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
