import { MapData } from '../types';

export type QuizMode =
  | 'mode1_classic'
  | 'mode2_short'
  | 'mode3_mapclick_classic'
  | 'mode4_mapclick_short';

/**
 * Returns the minimum number of callouts a map must have to appear in a given quiz mode:
 * - Maps with < 5 callouts are never shown in any quiz mode.
 * - Maps with < 10 callouts are excluded from the two 10-question quiz modes.
 */
export function getMinimumCalloutsForQuizMode(mode: QuizMode): number {
  if (mode === 'mode2_short' || mode === 'mode4_mapclick_short') {
    return 5;
  }
  return 10;
}

/**
 * Filters maps eligible for the selected quiz mode based on callout count.
 */
export function getEligibleMapsForQuiz(maps: MapData[], mode: QuizMode): MapData[] {
  const minCallouts = getMinimumCalloutsForQuizMode(mode);
  return maps.filter((m) => (m.callouts?.length || 0) >= minCallouts);
}
