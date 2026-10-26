import { describe, expect, it } from 'vitest';
import type { FinanceTx } from '../../data/types';
import {
  avgMonthlyDeposit, depositXp, formatDuration, milestoneIndex, monthStreak, monthlyIncome, monthsToTarget, netByMonth,
  positionReturn, requiredCapital, shortTicker,
} from './logic';
import { authHeader, nextPageParams } from './t212Api';

const tx = (id: string, type: FinanceTx['type'], amount: number, date: string): FinanceTx => ({ id, type, amount, ts: new Date(date).getTime() });

describe('finance', () => {
  it('čisté vklady po měsících', () => {
    const m = netByMonth([
      tx('a', 'DEPOSIT', 2000, '2026-08-05T10:00:00'),
      tx('b', 'DEPOSIT', 500, '2026-08-20T10:00:00'),
      tx('c', 'WITHDRAW', -300, '2026-08-25T10:00:00'),
      tx('d', 'FEE', -10, '2026-08-25T10:00:00'),
      tx('e', 'DEPOSIT', 1000, '2026-09-01T10:00:00'),
    ]);
    expect(m).toEqual({ '2026-08': 2200, '2026-09': 1000 });
  });

  it('série měsíců se splněným cílem', () => {
    const by = { '2026-07': 2000, '2026-08': 2500, '2026-09': 2000, '2026-10': 100 };
    // říjen ještě nesplněn → série ze září platí
    expect(monthStreak(by, 2000, '2026-10')).toEqual({ current: 3, start: '2026-07', doneThisMonth: false });
    expect(monthStreak({ ...by, '2026-10': 2000 }, 2000, '2026-10').current).toBe(4);
    expect(monthStreak(by, 2000, '2026-12').current).toBe(0);
    // přes přelom roku
    expect(monthStreak({ '2025-12': 3000, '2026-01': 3000 }, 2000, '2026-01').current).toBe(2);
  });

  it('XP za vklad a milníky', () => {
    expect(depositXp(2000, 2000)).toBe(50);
    expect(depositXp(100, 2000)).toBe(10);
    expect(depositXp(100000, 2000)).toBe(100);
    expect(depositXp(-5, 2000)).toBe(0);
    expect(milestoneIndex(9_999, 'CZK')).toBe(0);
    expect(milestoneIndex(120_000, 'CZK')).toBe(3);
    expect(milestoneIndex(6_000, 'EUR')).toBe(3);
  });

  it('tickery a výnos', () => {
    expect(shortTicker('AAPL_US_EQ')).toBe('AAPL');
    expect(shortTicker('VUSAl_EQ')).toBe('VUSA');
    expect(positionReturn({ ticker: 'X', quantity: 1, averagePrice: 100, currentPrice: 125, ppl: 25 })).toBeCloseTo(0.25);
  });

  it('API: autorizace a stránkování', () => {
    expect(authHeader({ key: 'k', secret: '', env: 'live' })).toBe('k');
    expect(authHeader({ key: 'k', secret: 's', env: 'live' })).toBe(`Basic ${btoa('k:s')}`);
    expect(nextPageParams('/api/v0/history/transactions?limit=50&cursor=abc')).toEqual({ limit: '50', cursor: 'abc' });
    expect(nextPageParams(null)).toBeNull();
  });

  it('velké cíle: potřebný kapitál a pasivní příjem (pravidlo 4 %)', () => {
    expect(requiredCapital({ kind: 'value', target: 6_631_197 }, 4)).toBe(6_631_197);
    expect(requiredCapital({ kind: 'income', target: 50_000 }, 4)).toBe(15_000_000);
    expect(monthlyIncome(15_000_000, 4)).toBe(50_000);
  });

  it('odhad doby do cíle', () => {
    expect(monthsToTarget(100, 0, 7, 50)).toBe(0);
    // bez výnosu: 0 + 1000/měs → 12 000 za 12 měsíců
    expect(monthsToTarget(0, 1000, 0, 12_000)).toBe(12);
    // s výnosem je to rychlejší
    expect(monthsToTarget(0, 1000, 7, 12_000)!).toBeLessThanOrEqual(12);
    // ověř složené úročení: 10 000 při 7 % ročně se zdvojnásobí za ~10,2 roku
    const m = monthsToTarget(10_000, 0, 7, 20_000)!;
    expect(m).toBeGreaterThanOrEqual(122);
    expect(m).toBeLessThanOrEqual(124);
    expect(monthsToTarget(0, 0, 0, 1)).toBeNull();
  });

  it('průměrný vklad za ukončené měsíce', () => {
    const by = { '2026-07': 3000, '2026-08': 1000, '2026-09': 2000, '2026-10': 9999 };
    expect(avgMonthlyDeposit(by, '2026-10')).toBe(2000); // 7–9, aktuální měsíc se nepočítá
    expect(avgMonthlyDeposit({ '2026-10': 500 }, '2026-10')).toBe(500);
    expect(avgMonthlyDeposit({}, '2026-10')).toBe(0);
  });

  it('formát doby', () => {
    expect(formatDuration(0)).toBe('už teď');
    expect(formatDuration(3)).toBe('3 měsíce');
    expect(formatDuration(12)).toBe('1 rok');
    expect(formatDuration(30)).toBe('2 roky a 6 měsíců');
    expect(formatDuration(65)).toBe('5 let a 5 měsíců');
  });
});
