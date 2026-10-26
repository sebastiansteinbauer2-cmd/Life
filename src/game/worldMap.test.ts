import { describe, expect, it } from 'vitest';
import { buildCastles, heroIndex } from './worldMap';
import { defaultProfile } from './engine';

describe('mapa světa', () => {
  const base = { profile: defaultProfile(), bossBest: 0, acts: [], books: [], codeSolved: 0, codeTotal: 43, budgetMonths: 0, today: '2026-10-26' };

  it('obsahuje všechny cíle a Legendu na konci', () => {
    const c = buildCastles(base);
    expect(c.map((x) => x.id)).toEqual(expect.arrayContaining(['exam', 'ironman', 'fin-porsche', 'fin-income-50k', 'reading', 'code', 'budget', 'legend']));
    expect(c[c.length - 1].id).toBe('legend');
    expect(c.every((x) => x.progress >= 0 && x.progress <= 1)).toBe(true);
  });

  it('nejblíž je cíl s největším postupem; hrdina stojí u prvního nedobytého', () => {
    const c = buildCastles({
      ...base, bossBest: 84, codeSolved: 20,
      snapshot: { id: 'x', ts: 0, currency: 'CZK', total: 663_119.7, invested: 0, ppl: 0, free: 0, positions: [] },
    });
    expect(c[0]).toMatchObject({ id: 'exam', progress: 1 });
    expect(c[1].id).toBe('code');
    expect(heroIndex(c)).toBe(1);
    expect(c.find((x) => x.id === 'fin-porsche')!.progress).toBeCloseTo(0.1, 3);
  });
});
