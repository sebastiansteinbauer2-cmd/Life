import type { Expense } from '../../data/types';
import { addMonths, monthKey } from '../../lib/date';

export interface Category { id: string; label: string; icon: string; color: string }

export const OUT_CATEGORIES: Category[] = [
  { id: 'food', label: 'Jídlo venku', icon: '🍔', color: '#f87171' },
  { id: 'groceries', label: 'Potraviny', icon: '🛒', color: '#fb923c' },
  { id: 'transport', label: 'Doprava', icon: '🚗', color: '#fbbf24' },
  { id: 'housing', label: 'Bydlení', icon: '🏠', color: '#a3e635' },
  { id: 'fun', label: 'Zábava', icon: '🎮', color: '#34d399' },
  { id: 'clothes', label: 'Oblečení', icon: '👕', color: '#22d3ee' },
  { id: 'subs', label: 'Předplatné', icon: '📱', color: '#60a5fa' },
  { id: 'sport', label: 'Sport', icon: '🏋️', color: '#818cf8' },
  { id: 'school', label: 'Vzdělání', icon: '📚', color: '#c084fc' },
  { id: 'gifts', label: 'Dárky', icon: '🎁', color: '#f472b6' },
  { id: 'other', label: 'Ostatní', icon: '📦', color: '#94a3b8' },
];

export const IN_CATEGORIES: Category[] = [
  { id: 'salary', label: 'Výplata', icon: '💼', color: '#4ade80' },
  { id: 'side', label: 'Přivýdělek', icon: '🚀', color: '#22d3ee' },
  { id: 'gift-in', label: 'Dar / kapesné', icon: '🎁', color: '#f472b6' },
  { id: 'other-in', label: 'Ostatní příjem', icon: '➕', color: '#94a3b8' },
];

const ALL = [...OUT_CATEGORIES, ...IN_CATEGORIES];
export const categoryOf = (id: string): Category => ALL.find((c) => c.id === id) ?? OUT_CATEGORIES[OUT_CATEGORIES.length - 1];

export interface MonthSummary {
  month: string;
  income: number;
  spent: number;
  left: number; // příjem − výdaje
  byCategory: Record<string, number>;
  entries: number;
  daysLogged: number;
}

/** Souhrn měsíce. Když nejsou zapsané příjmy, použije se zadaný měsíční příjem. */
export function monthSummary(list: Expense[], month: string, plannedIncome = 0): MonthSummary {
  const inMonth = list.filter((e) => e.date.startsWith(month));
  const byCategory: Record<string, number> = {};
  let income = 0;
  let spent = 0;
  for (const e of inMonth) {
    if (e.kind === 'in') income += e.amount;
    else {
      spent += e.amount;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }
  }
  if (!income) income = plannedIncome;
  return {
    month, income, spent, left: income - spent, byCategory,
    entries: inMonth.length, daysLogged: new Set(inMonth.map((e) => e.date)).size,
  };
}

/** Podíl ušetřených peněz (0..1), null bez příjmu. */
export const savingsRate = (s: Pick<MonthSummary, 'income' | 'left'>) => (s.income > 0 ? s.left / s.income : null);

export const totalLimit = (limits: Partial<Record<string, number>>) =>
  Object.values(limits).reduce<number>((n, v) => n + (v ?? 0), 0);

/** Měsíc „v rozpočtu“: limity nastavené, aspoň 10 zápisů a nepřekročený celkový limit. */
export function monthInBudget(s: MonthSummary, limits: Partial<Record<string, number>>): boolean {
  const total = totalLimit(limits);
  return total > 0 && s.entries >= 10 && s.spent <= total;
}

export const MONTH_BUDGET_XP = 100;

/** Posledních n měsíců (od nejstaršího) – pro graf. */
export function lastMonths(n: number, current: string = monthKey()): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(current, i - n + 1));
}

/** Dny v řadě se zápisem (do dneška nebo včerejška). */
export function loggedDays(list: Expense[], noneDays: string[] = []): Set<string> {
  return new Set([...list.map((e) => e.date), ...noneDays]);
}

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatKc(v: number): string {
  return `${Math.round(v).toLocaleString('cs-CZ')} Kč`;
}

/** Částka z textu: „1 250,50“ → 1250.5 */
export function parseAmount(text: string): number | null {
  const v = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}
