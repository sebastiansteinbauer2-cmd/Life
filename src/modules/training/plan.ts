import type { Exercise, ExerciseCategory, TrainingGoal, Workout } from '../../data/types';
import { weekdayIndex } from '../../lib/date';

export type PlanDay = { kind: 'train'; focus: ExerciseCategory[]; label: string } | { kind: 'rest'; label: string };

/** Týdenní plán: horní / dolní / core + dny volna. Index 0 = pondělí. */
export const WEEK_PLAN: PlanDay[] = [
  { kind: 'train', focus: ['upper'], label: 'Horní část těla' },
  { kind: 'train', focus: ['lower'], label: 'Dolní část těla' },
  { kind: 'train', focus: ['core'], label: 'Core' },
  { kind: 'rest', label: 'Regenerace' },
  { kind: 'train', focus: ['upper'], label: 'Horní část těla' },
  { kind: 'train', focus: ['lower', 'core'], label: 'Nohy + core' },
  { kind: 'rest', label: 'Regenerace' },
];

export const planForDate = (d: Date = new Date()) => WEEK_PLAN[weekdayIndex(d)];

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  upper: 'Horní část', lower: 'Dolní část', core: 'Core',
};

export const GOAL_LABEL: Record<TrainingGoal, string> = {
  sila: 'Síla', vytrvalost: 'Vytrvalost', svaly: 'Svaly (objem)', spalovani: 'Spalování tuku',
};

export const BUILTIN_EXERCISES: Omit<Exercise, 'max' | 'xp'>[] = [
  { id: 'kliky', name: 'Kliky', unit: 'reps', category: 'upper', builtIn: true },
  { id: 'shyby', name: 'Shyby / přítahy', unit: 'reps', category: 'upper', builtIn: true },
  { id: 'dipy', name: 'Dipy', unit: 'reps', category: 'upper', builtIn: true },
  { id: 'drepy', name: 'Dřepy', unit: 'reps', category: 'lower', builtIn: true },
  { id: 'vypady', name: 'Výpady', unit: 'reps', category: 'lower', builtIn: true },
  { id: 'sedy', name: 'Sedy-lehy', unit: 'reps', category: 'core', builtIn: true },
  { id: 'plank', name: 'Plank', unit: 'sec', category: 'core', builtIn: true },
];

export const DEFAULT_MAX: Record<string, number> = {
  kliky: 30, shyby: 8, dipy: 15, drepy: 40, vypady: 20, sedy: 30, plank: 60,
};

/** Objemové body jedné série (sekundy se přepočítávají). */
export const setPoints = (unit: Exercise['unit'], value: number) => (unit === 'sec' ? value / 3 : value);

/** XP za trénink podle celkového objemu. */
export function workoutXp(points: number): number {
  if (points <= 0) return 0;
  return Math.max(5, Math.min(120, Math.round(points / 4)));
}

export const exerciseLevelScale = 50; // level cviku: další level = 50 × level bodů objemu

interface GoalParams { sets: number; pct: number; inc: number; everyOther: boolean }
const GOAL_PARAMS: Record<TrainingGoal, GoalParams> = {
  sila: { sets: 5, pct: 0.6, inc: 1, everyOther: true },
  svaly: { sets: 4, pct: 0.7, inc: 1, everyOther: true },
  vytrvalost: { sets: 3, pct: 0.8, inc: 1, everyOther: false },
  spalovani: { sets: 4, pct: 0.75, inc: 1, everyOther: false },
};

export interface Suggestion { sets: number; value: number; reason: string }

/**
 * Automatická progrese: vychází z maxima a posledního tréninku.
 * Při 2 trénincích týdně na partii to dává cca +1 (síla/svaly) až +2 (vytrvalost/spalování)
 * opakování za týden. U planku se přidává po 5 sekundách.
 */
export function suggestTarget(ex: Exercise, goal: TrainingGoal, history: Workout[]): Suggestion {
  const p = GOAL_PARAMS[goal];
  const step = ex.unit === 'sec' ? 5 * p.inc : p.inc;
  const base = Math.max(1, Math.round(ex.max * p.pct));
  const sessions = history
    .filter((w) => w.entries.some((e) => e.exerciseId === ex.id && e.sets.length))
    .sort((a, b) => b.ts - a.ts);
  const last = sessions[0]?.entries.find((e) => e.exerciseId === ex.id);
  if (!last) return { sets: p.sets, value: base, reason: `Start: ${Math.round(p.pct * 100)} % maxima` };
  const lastMin = Math.min(...last.sets);
  const bump = !p.everyOther || sessions.length % 2 === 0;
  if (lastMin >= base) {
    const value = Math.min(ex.max, lastMin + (bump ? step : 0));
    return {
      sets: p.sets,
      value: Math.max(value, base),
      reason: bump ? `Minule ${lastMin} ve všech sériích → přidej ${step}` : `Zopakuj ${lastMin}, příště přidáš`,
    };
  }
  return { sets: p.sets, value: base, reason: `Minule nejméně ${lastMin} → drž ${base}` };
}
