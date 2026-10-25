import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../../data/types';
import { WEEK_PLAN, setPoints, suggestTarget, workoutXp } from './plan';

const kliky: Exercise = { id: 'kliky', name: 'Kliky', unit: 'reps', category: 'upper', builtIn: true, max: 30, xp: 0 };
const w = (sets: number[], ts: number): Workout => ({ id: String(ts), ts, date: '', entries: [{ exerciseId: 'kliky', sets }], xp: 0, prs: [] });

describe('trénink', () => {
  it('plán má horní/dolní/core a 2 dny volna', () => {
    expect(WEEK_PLAN).toHaveLength(7);
    expect(WEEK_PLAN.filter((d) => d.kind === 'rest')).toHaveLength(2);
  });

  it('první návrh vychází z maxima podle cíle', () => {
    expect(suggestTarget(kliky, 'vytrvalost', [])).toMatchObject({ sets: 3, value: 24 });
    expect(suggestTarget(kliky, 'sila', [])).toMatchObject({ sets: 5, value: 18 });
  });

  it('po splněném tréninku přidá opakování, po nesplněném drží', () => {
    expect(suggestTarget(kliky, 'vytrvalost', [w([24, 24, 24], 1)]).value).toBe(25);
    expect(suggestTarget(kliky, 'vytrvalost', [w([24, 20, 18], 1)]).value).toBe(24);
    // síla: přidává jen každý druhý trénink (≈ +1 týdně)
    expect(suggestTarget(kliky, 'sila', [w([18, 18], 1)]).value).toBe(18);
    expect(suggestTarget(kliky, 'sila', [w([18, 18], 1), w([18, 18], 2)]).value).toBe(19);
  });

  it('návrh nepřekročí maximum', () => {
    expect(suggestTarget(kliky, 'vytrvalost', [w([30, 30, 30], 1)]).value).toBe(30);
  });

  it('XP podle objemu', () => {
    expect(workoutXp(0)).toBe(0);
    expect(workoutXp(80)).toBe(20);
    expect(workoutXp(10_000)).toBe(120);
    expect(setPoints('sec', 60)).toBe(20);
  });
});
