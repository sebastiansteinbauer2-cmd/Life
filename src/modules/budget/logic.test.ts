import { describe, expect, it } from 'vitest';
import type { Expense } from '../../data/types';
import { categoryOf, lastMonths, monthInBudget, monthLabel, monthSummary, parseAmount, savingsRate } from './logic';

const e = (date: string, amount: number, category = 'food', kind: Expense['kind'] = 'out'): Expense => ({ id: `${date}${amount}${category}`, ts: 0, date, amount, kind, category, note: '' });

describe('rozpočet', () => {
  const list = [e('2026-10-01', 30000, 'salary', 'in'), e('2026-10-02', 250), e('2026-10-02', 1200, 'groceries'), e('2026-10-15', 300), e('2026-09-30', 999)];

  it('sečte měsíc podle kategorií', () => {
    const s = monthSummary(list, '2026-10');
    expect(s).toMatchObject({ income: 30000, spent: 1750, left: 28250, entries: 4, daysLogged: 3 });
    expect(s.byCategory).toEqual({ food: 550, groceries: 1200 });
    expect(savingsRate(s)).toBeCloseTo(0.9417, 3);
  });

  it('bez zapsaného příjmu použije plánovaný', () => {
    expect(monthSummary([e('2026-09-30', 999)], '2026-09', 20000)).toMatchObject({ income: 20000, left: 19001 });
    expect(savingsRate(monthSummary([], '2026-09'))).toBeNull();
  });

  it('měsíc v rozpočtu', () => {
    const many = Array.from({ length: 10 }, (_, i) => e(`2026-10-${String(i + 1).padStart(2, '0')}`, 100));
    expect(monthInBudget(monthSummary(many, '2026-10'), { food: 1000 })).toBe(true);
    expect(monthInBudget(monthSummary(many, '2026-10'), { food: 999 })).toBe(false);
    expect(monthInBudget(monthSummary(many.slice(0, 9), '2026-10'), { food: 1000 })).toBe(false);
    expect(monthInBudget(monthSummary(many, '2026-10'), {})).toBe(false);
  });

  it('pomocné funkce', () => {
    expect(parseAmount('1 250,50')).toBe(1250.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(lastMonths(3, '2026-01')).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(monthLabel('2026-10')).toBe('říjen 2026');
    expect(categoryOf('neexistuje').id).toBe('other');
  });
});
