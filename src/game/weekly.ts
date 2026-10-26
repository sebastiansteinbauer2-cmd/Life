import type { AchievementRecord, ModuleId, QuestProgress, StatId, XpEntry } from '../data/types';
import { addDays, dateKey, weekStart } from '../lib/date';

export interface WeekReport {
  monday: string;
  xp: number;
  byStat: Record<StatId, number>;
  byModule: Partial<Record<ModuleId, number>>;
  activeDays: number;
  bestDay: { date: string; xp: number } | null;
  questsDone: number;
  achievements: string[];
  daily: { date: string; xp: number }[];
}

/**
 * Souhrn týdne (pondělí–neděle) z deníku XP, questů a odznaků.
 * `dayCount` omezí souhrn na prvních N dní – pro férové srovnání rozběhnutého týdne s minulým.
 */
export function weekReport(log: XpEntry[], progress: QuestProgress[], achievements: AchievementRecord[], monday: string, dayCount = 7): WeekReport {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(monday, i));
  const inWeek = log.filter((e) => days.includes(e.date));
  const daily = days.map((date) => ({ date, xp: inWeek.filter((e) => e.date === date).reduce((n, e) => n + e.amount, 0) }));
  const byStat = { int: 0, str: 0, dis: 0, chess: 0, end: 0 } as Record<StatId, number>;
  const byModule: Partial<Record<ModuleId, number>> = {};
  for (const e of inWeek) {
    byStat[e.stat] = (byStat[e.stat] ?? 0) + e.amount;
    byModule[e.module] = (byModule[e.module] ?? 0) + e.amount;
  }
  const best = daily.reduce<{ date: string; xp: number } | null>((b, d) => (d.xp > 0 && (!b || d.xp > b.xp) ? d : b), null);
  const start = new Date(`${monday}T00:00:00`).getTime();
  const end = start + dayCount * 86_400_000;
  return {
    monday,
    xp: inWeek.reduce((n, e) => n + e.amount, 0),
    byStat,
    byModule,
    activeDays: daily.filter((d) => inWeek.some((e) => e.date === d.date && e.amount > 0)).length,
    bestDay: best,
    questsDone: progress.filter((p) => p.completedAt && p.completedAt >= start && p.completedAt < end).length,
    achievements: achievements.filter((a) => a.unlockedAt >= start && a.unlockedAt < end).map((a) => a.id),
    daily,
  };
}

export const thisMonday = () => weekStart();
export const lastMonday = () => addDays(weekStart(), -7);
/** Kolik dní aktuálního týdne už uběhlo (Po = 1 … Ne = 7). */
export const daysIntoWeek = (today: string = dateKey()) => Math.min(7, Math.max(1, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${weekStart()}T12:00:00`).getTime()) / 86_400_000) + 1));

/** Změna v procentech (null, když minulý týden nebylo s čím srovnávat). */
export const pctChange = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

// ───── Obchod: zlaťáky ─────

/** Za každých 10 XP jeden zlaťák. */
export const COIN_RATE = 10;
export const coinsEarned = (totalXp: number) => Math.floor(Math.max(0, totalXp) / COIN_RATE);

export interface Purchase { id: string; rewardId: string; title: string; icon: string; price: number; ts: number }
export const coinBalance = (totalXp: number, purchases: Purchase[]) => coinsEarned(totalXp) - purchases.reduce((n, p) => n + p.price, 0);

// ───── Připomínka zálohy ─────

/** Připomenout zálohu: nikdy nezálohováno a appka se používá 3+ dny, nebo poslední záloha starší než 7 dní. */
export function backupDue(lastBackup: number | null, firstUse: number, now = Date.now()): boolean {
  const day = 86_400_000;
  if (!lastBackup) return now - firstUse >= 3 * day;
  return now - lastBackup >= 7 * day;
}

export const todayKey = () => dateKey();
