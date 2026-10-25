import type { Difficulty, ModuleId, StatId } from '../data/types';

/** XP potřebné na postup z levelu L na L+1. */
export const xpForNext = (level: number) => 100 * level;

/** Celkové XP potřebné k dosažení levelu L (level 1 = 0 XP). */
export const totalXpForLevel = (level: number) => (100 * level * (level - 1)) / 2;

export interface LevelInfo {
  level: number;
  intoLevel: number; // XP nasbírané v aktuálním levelu
  needed: number; // XP potřebné na další level
  progress: number; // 0..1
}

export function levelFromXp(xp: number, scale = 100): LevelInfo {
  const safe = Math.max(0, xp);
  let level = 1;
  let rest = safe;
  while (rest >= scale * level) {
    rest -= scale * level;
    level++;
  }
  const needed = scale * level;
  return { level, intoLevel: rest, needed, progress: rest / needed };
}

const TITLES: [number, string][] = [
  [1, 'Nováček'],
  [3, 'Učeň'],
  [5, 'Tovaryš'],
  [8, 'Bojovník'],
  [12, 'Veterán'],
  [17, 'Mistr'],
  [23, 'Velmistr'],
  [30, 'Legenda'],
];

export function titleForLevel(level: number): string {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) t = name;
  return t;
}

export function nextTitle(level: number): { level: number; title: string } | null {
  const n = TITLES.find(([min]) => min > level);
  return n ? { level: n[0], title: n[1] } : null;
}

export const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50, epic: 100 };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Snadný', medium: 'Střední', hard: 'Těžký', epic: 'Epický',
};

export const STATS: { id: StatId; label: string; icon: string; color: string }[] = [
  { id: 'int', label: 'Inteligence', icon: '🧠', color: 'var(--c-int)' },
  { id: 'str', label: 'Síla', icon: '💪', color: 'var(--c-str)' },
  { id: 'dis', label: 'Disciplína', icon: '🛡️', color: 'var(--c-dis)' },
  { id: 'chess', label: 'Šachy', icon: '♞', color: 'var(--c-chess)' },
];
export const STAT_LABEL = Object.fromEntries(STATS.map((s) => [s.id, s.label])) as Record<StatId, string>;

export const MODULES: { id: ModuleId; label: string; icon: string; route: string }[] = [
  { id: 'math', label: 'Matematika', icon: '∑', route: '/math' },
  { id: 'training', label: 'Trénink', icon: '🏋️', route: '/training' },
  { id: 'chess', label: 'Šachy', icon: '♞', route: '/chess' },
  { id: 'discover', label: 'Objevy', icon: '🔭', route: '/discover' },
];
export const MODULE_LABEL: Record<ModuleId, string> = {
  core: 'Obecné', math: 'Matematika', training: 'Trénink', chess: 'Šachy', discover: 'Objevy',
};

/** Bonusy za sérii dní v řadě. */
export const STREAK_BONUSES: { days: number; xp: number }[] = [
  { days: 7, xp: 50 },
  { days: 30, xp: 200 },
  { days: 100, xp: 500 },
];
