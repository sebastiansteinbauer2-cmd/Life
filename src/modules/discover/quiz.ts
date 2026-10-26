import type { Discovery } from '../../data/types';
import { daysBetween } from '../../lib/date';

export const QUIZ_SIZE = 5;
export const QUIZ_MIN_AGE = 2;

/**
 * Vybere starší zápisy k opakování. Přednost mají ty, které se dlouho neopakovaly
 * (váha roste s dobou od posledního opakování), pořadí je náhodné, ale deterministické podle seedu.
 */
export function pickQuizEntries(entries: Discovery[], today: string, seed = 0.5, size = QUIZ_SIZE): Discovery[] {
  const old = entries.filter((e) => daysBetween(e.date, today) >= QUIZ_MIN_AGE);
  let s = Math.floor(seed * 2 ** 31) || 1;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const scored = old.map((e) => {
    const since = daysBetween(e.lastReviewed ?? e.date, today);
    return { e, key: Math.pow(rnd(), 1 / (1 + since)) }; // vážený náhodný výběr
  });
  return scored.sort((a, b) => b.key - a.key).slice(0, size).map((x) => x.e);
}
