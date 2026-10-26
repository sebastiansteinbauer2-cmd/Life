import { describe, expect, it } from 'vitest';
import type { Discovery } from '../../data/types';
import { pickQuizEntries } from './quiz';

const d = (id: string, date: string, lastReviewed?: string): Discovery => ({ id, ts: 0, date, text: id, tags: [], lastReviewed });

describe('opakovací kvíz', () => {
  it('vybírá jen starší zápisy a nejvýš 5', () => {
    const entries = [d('dnes', '2026-10-25'), d('vcera', '2026-10-24'), ...Array.from({ length: 8 }, (_, i) => d(`s${i}`, `2026-09-0${i + 1}`))];
    const picked = pickQuizEntries(entries, '2026-10-25', 0.3);
    expect(picked).toHaveLength(5);
    expect(picked.some((e) => e.id === 'dnes' || e.id === 'vcera')).toBe(false);
  });

  it('upřednostní dlouho neopakované zápisy', () => {
    const entries = [d('nove-opakovany', '2026-01-01', '2026-10-24'), d('zapomenuty', '2026-01-01')];
    let forgotten = 0;
    for (let i = 1; i < 200; i++) if (pickQuizEntries(entries, '2026-10-25', i / 200, 1)[0].id === 'zapomenuty') forgotten++;
    expect(forgotten).toBeGreaterThan(150);
  });
});
