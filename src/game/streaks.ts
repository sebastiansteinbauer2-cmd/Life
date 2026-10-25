import { addDays, dateKey } from '../lib/date';

export interface StreakInfo {
  current: number;
  start: string | null; // první den aktuální série
  activeToday: boolean;
}

/**
 * Série dní v řadě. Pokud dnes ještě nic neproběhlo, série ze včerejška
 * stále platí (uživatel ji dnes může prodloužit).
 */
export function computeStreak(days: Iterable<string>, today: string = dateKey()): StreakInfo {
  const set = new Set(days);
  const activeToday = set.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  if (!set.has(cursor)) return { current: 0, start: null, activeToday };
  let count = 0;
  let start = cursor;
  while (set.has(cursor)) {
    count++;
    start = cursor;
    cursor = addDays(cursor, -1);
  }
  return { current: count, start, activeToday };
}

export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
