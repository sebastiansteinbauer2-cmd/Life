import type { FinancePosition, FinanceTx } from '../../data/types';
import { addMonths, monthKey } from '../../lib/date';

export const monthOf = (ms: number) => monthKey(new Date(ms));

/** Čisté vklady po měsících (vklady − výběry; poplatky a převody se nepočítají). */
export function netByMonth(txs: FinanceTx[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    const sign = t.type === 'DEPOSIT' ? 1 : t.type === 'WITHDRAW' ? -1 : 0;
    if (!sign) continue;
    const m = monthOf(t.ts);
    out[m] = (out[m] ?? 0) + sign * Math.abs(t.amount);
  }
  return out;
}

export interface MonthStreak { current: number; start: string | null; doneThisMonth: boolean }

/**
 * Série měsíců v řadě, kdy čisté vklady dosáhly cíle. Pokud tento měsíc cíl
 * ještě splněný není, série z minulého měsíce pořád platí.
 */
export function monthStreak(byMonth: Record<string, number>, goal: number, current: string = monthKey()): MonthStreak {
  const ok = (m: string) => (byMonth[m] ?? 0) >= goal && goal > 0;
  const doneThisMonth = ok(current);
  let cursor = doneThisMonth ? current : addMonths(current, -1);
  let count = 0;
  let start: string | null = null;
  while (ok(cursor)) {
    count++;
    start = cursor;
    cursor = addMonths(cursor, -1);
  }
  return { current: count, start, doneThisMonth };
}

export const STREAK_MONTH_BONUSES = [
  { months: 3, xp: 100 },
  { months: 6, xp: 250 },
  { months: 12, xp: 500 },
];

/** XP za vklad: poměrem k měsíčnímu cíli, 10–100 XP. */
export function depositXp(amount: number, goal: number): number {
  if (amount <= 0) return 0;
  const g = goal > 0 ? goal : 1000;
  return Math.max(10, Math.min(100, Math.round((50 * amount) / g)));
}

export const DIVIDEND_XP = 5;
export const MILESTONE_XP = 100;

/** Milníky hodnoty portfolia podle měny účtu. */
export const MILESTONES: Record<string, number[]> = {
  CZK: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  DEFAULT: [500, 2_000, 5_000, 10_000, 25_000, 50_000],
};
export const milestonesFor = (currency: string) => MILESTONES[currency] ?? MILESTONES.DEFAULT;

/** Kolik milníků hodnota portfolia překonala (0–6). */
export function milestoneIndex(value: number, currency: string): number {
  return milestonesFor(currency).filter((t) => value >= t).length;
}

/** "AAPL_US_EQ" → "AAPL", "VUSAl_EQ" → "VUSA" (malé l značí Londýn). */
export const shortTicker = (t: string) => t.replace(/_.*$/, '').replace(/[a-z]$/, '');

/** Výnos pozice v % podle ceny (bez vlivu kurzu měny). */
export const positionReturn = (p: FinancePosition) => (p.averagePrice > 0 ? p.currentPrice / p.averagePrice - 1 : 0);

export function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency', currency, maximumFractionDigits: currency === 'CZK' ? 0 : 2,
    }).format(v);
  } catch {
    return `${Math.round(v * 100) / 100} ${currency}`;
  }
}

export const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')} %`;
