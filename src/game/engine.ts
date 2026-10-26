import type { DataStore } from '../data/store';
import type { ModuleId, Profile, QuestProgress, StatId, XpEntry } from '../data/types';
import { dateKey, uid } from '../lib/date';
import { ACHIEVEMENTS, type AchievementCtx, type AchievementDef } from './achievements';
import { findQuest, periodKey, progressId } from './quests';
import { ironmanReady, isRide, isRun, isSwim } from '../modules/ironman/sports';
import { computeStreak } from './streaks';
import { DIFFICULTY_XP, MODULE_LABEL, STREAK_BONUSES, levelFromXp, titleForLevel } from './xp';

export type GameEvent =
  | { type: 'xp'; amount: number; stat: StatId; label: string }
  | { type: 'levelup'; level: number; title: string }
  | { type: 'achievement'; achievement: AchievementDef }
  | { type: 'streak'; days: number; xp: number; module: ModuleId };

export interface AwardInput {
  amount: number;
  stat: StatId;
  module: ModuleId;
  label: string;
}

export function defaultProfile(): Profile {
  return {
    id: 'me',
    name: 'Hrdina',
    onboarded: false,
    createdAt: Date.now(),
    xp: 0,
    statXp: { int: 0, str: 0, dis: 0, chess: 0, end: 0 },
    bestStreak: 0,
    heightCm: 183,
    weightKg: 88,
    trainingGoal: 'svaly',
    equipment: ['hrazda'],
    chessUsername: '',
    chessProxyUrl: '',
    fideRating: 1980,
    mathLevel: 'rozsireny',
    examDate: '',
    financeGoal: 2000,
    financeProxyUrl: '',
    financeTargets: [
      // základní cena dle konfigurátoru Porsche ČR (vč. DPH, bez výbavy)
      { id: 'porsche', kind: 'value', title: 'Porsche 911 GT3 RS', icon: '🏎️', target: 6_631_197 },
      { id: 'income-50k', kind: 'income', title: '50 000 Kč měsíčně', icon: '💸', target: 50_000 },
    ],
    financeReturn: 7,
    financeWithdrawal: 4,
    serverUrl: '',
    ironmanDate: '',
    ironmanWeeklyHours: 6,
    ironmanRace: 'full',
    navPinned: ['math', 'ironman', 'discover', 'finance'],
    budgetIncome: 0,
    budgetLimits: {},
    readingGoal: 12,
    shopRewards: [
      { id: 'serial', title: 'Večer seriálu', icon: '🎬', price: 50 },
      { id: 'hry', title: 'Hodina hraní', icon: '🎮', price: 40 },
      { id: 'cheat', title: 'Cheat meal', icon: '🍕', price: 100 },
      { id: 'volno', title: 'Den volna od questů', icon: '😴', price: 200 },
      { id: 'radost', title: 'Něco pro radost', icon: '🛍️', price: 500 },
    ],
  };
}

/**
 * Herní jádro: připisování XP, levely, questy, streaky a achievementy.
 * Všechny zápisy běží přes frontu, aby se souběžné akce nepřepisovaly.
 */
export class GameEngine {
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(e: GameEvent) => void>();

  constructor(public store: DataStore, private now: () => Date = () => new Date()) {}

  on(fn: (e: GameEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent) {
    this.listeners.forEach((fn) => fn(e));
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn, fn);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async getProfile(): Promise<Profile> {
    const p = await this.store.col('profile').get('me');
    return p ? { ...defaultProfile(), ...p } : defaultProfile();
  }

  saveProfile(patch: Partial<Profile>): Promise<Profile> {
    return this.run(async () => {
      const p = { ...(await this.getProfile()), ...patch, id: 'me' as const };
      await this.store.col('profile').put(p);
      return p;
    });
  }

  /**
   * Přepočítá celkové XP a statistiky z historie XP.
   * Po synchronizaci tak sedí součty, i když se XP získávalo na dvou zařízeních.
   */
  recomputeTotals(): Promise<boolean> {
    return this.run(async () => {
      const [profile, log] = await Promise.all([this.getProfile(), this.store.col('xpLog').all()]);
      let xp = 0;
      const statXp = Object.fromEntries(Object.keys(profile.statXp).map((k) => [k, 0])) as Profile['statXp'];
      for (const e of log.sort((a, b) => a.ts - b.ts)) {
        xp = Math.max(0, xp + e.amount);
        statXp[e.stat] = Math.max(0, (statXp[e.stat] ?? 0) + e.amount);
      }
      if (xp === profile.xp && Object.entries(statXp).every(([k, v]) => profile.statXp[k as StatId] === v)) return false;
      await this.store.col('profile').put({ ...profile, xp, statXp });
      return true;
    });
  }

  award(input: AwardInput): Promise<void> {
    return this.run(() => this.awardInner(input, true));
  }

  private async awardInner(input: AwardInput, withBonuses: boolean): Promise<void> {
    const amount = Math.round(input.amount);
    if (!amount) return;
    const profile = await this.getProfile();
    const before = levelFromXp(profile.xp).level;
    profile.xp = Math.max(0, profile.xp + amount);
    profile.statXp = { ...profile.statXp, [input.stat]: Math.max(0, (profile.statXp[input.stat] ?? 0) + amount) };
    const now = this.now();
    const entry: XpEntry = {
      id: uid(), ts: now.getTime(), date: dateKey(now), amount, stat: input.stat, module: input.module, label: input.label,
    };
    await this.store.col('xpLog').put(entry);
    await this.store.col('profile').put(profile);
    this.emit({ type: 'xp', amount, stat: input.stat, label: input.label });
    const after = levelFromXp(profile.xp).level;
    if (after > before) this.emit({ type: 'levelup', level: after, title: titleForLevel(after) });
    if (withBonuses && amount > 0) await this.checkStreaks(input.module);
    await this.checkAchievements();
  }

  /** Aktivní dny (globálně nebo pro modul) – den s kladným ziskem XP. */
  async activeDays(module?: ModuleId): Promise<Set<string>> {
    const log = await this.store.col('xpLog').all();
    return new Set(log.filter((e) => e.amount > 0 && (!module || e.module === module)).map((e) => e.date));
  }

  private async checkStreaks(module: ModuleId) {
    const today = dateKey(this.now());
    const scopes: (ModuleId | undefined)[] = [undefined];
    if (module !== 'core') scopes.push(module);
    for (const scope of scopes) {
      const s = computeStreak(await this.activeDays(scope), today);
      if (!scope) {
        const profile = await this.getProfile();
        if (s.current > profile.bestStreak) await this.store.col('profile').put({ ...profile, bestStreak: s.current });
      }
      for (const b of STREAK_BONUSES) {
        if (s.current < b.days || !s.start) continue;
        const key = `streak:${scope ?? 'all'}:${b.days}:${s.start}`;
        if (await this.store.col('meta').get(key)) continue;
        await this.store.col('meta').put({ id: key, value: Date.now() });
        const xp = scope ? Math.round(b.xp / 2) : b.xp;
        const where = scope ? ` (${MODULE_LABEL[scope]})` : '';
        this.emit({ type: 'streak', days: b.days, xp, module: scope ?? 'core' });
        await this.awardInner({ amount: xp, stat: 'dis', module: scope ?? 'core', label: `Série ${b.days} dní${where}` }, false);
      }
    }
  }

  /**
   * Posune quest. `inc` přičte, `setTo` nastaví minimum (pro automatické questy,
   * kde se postup počítá z dat). Po dosažení cíle připíše XP.
   */
  progressQuest(questId: string, opts: { inc?: number; setTo?: number } = { inc: 1 }): Promise<boolean> {
    return this.run(async () => {
      const custom = await this.store.col('quests').all();
      const quest = findQuest(questId, custom);
      if (!quest) return false;
      const period = periodKey(quest.recurrence, this.now());
      const id = progressId(questId, period);
      const prev: QuestProgress = (await this.store.col('questProgress').get(id)) ?? { id, questId, periodKey: period, count: 0 };
      if (prev.completedAt) return false;
      let count = prev.count;
      if (opts.setTo !== undefined) count = Math.max(count, opts.setTo);
      if (opts.inc) count += opts.inc;
      count = Math.min(count, quest.target);
      if (count === prev.count) return false;
      const next: QuestProgress = { ...prev, count };
      const completed = count >= quest.target;
      if (completed) {
        next.completedAt = this.now().getTime();
        next.xpAwarded = DIFFICULTY_XP[quest.difficulty];
      }
      await this.store.col('questProgress').put(next);
      if (completed) {
        await this.awardInner({ amount: DIFFICULTY_XP[quest.difficulty], stat: quest.stat, module: quest.module, label: `Quest: ${quest.title}` }, true);
      }
      return completed;
    });
  }

  /** Vrátí poslední odškrtnutí ručního questu (i se strženým XP). */
  undoQuest(questId: string): Promise<void> {
    return this.run(async () => {
      const custom = await this.store.col('quests').all();
      const quest = findQuest(questId, custom);
      if (!quest) return;
      const id = progressId(questId, periodKey(quest.recurrence, this.now()));
      const prev = await this.store.col('questProgress').get(id);
      if (!prev || prev.count <= 0) return;
      const next: QuestProgress = { ...prev, count: prev.count - 1, completedAt: undefined, xpAwarded: undefined };
      await this.store.col('questProgress').put(next);
      if (prev.completedAt && prev.xpAwarded) {
        await this.awardInner({ amount: -prev.xpAwarded, stat: quest.stat, module: quest.module, label: `Zrušeno: ${quest.title}` }, false);
      }
    });
  }

  async achievementCtx(): Promise<AchievementCtx> {
    const s = this.store;
    const [profile, progress, attempts, boss, workouts, games, books, discoveries, meta, log, finTx, finDiv, finSnaps, acts] = await Promise.all([
      this.getProfile(), s.col('questProgress').all(), s.col('mathAttempts').all(), s.col('bossResults').all(),
      s.col('workouts').all(), s.col('chessGames').all(), s.col('books').all(), s.col('discoveries').all(),
      s.col('meta').all(), s.col('xpLog').all(), s.col('financeTx').all(), s.col('financeDividends').all(),
      s.col('financeSnapshots').all(), s.col('activities').all(),
    ]);
    const [expenses, codeAttempts, readBooks, readLog] = await Promise.all([
      s.col('expenses').all(), s.col('codeAttempts').all(), s.col('readBooks').all(), s.col('readLog').all(),
    ]);
    const solved = new Set(codeAttempts.filter((a) => a.passed && a.taskId.startsWith('py:')).map((a) => a.taskId));
    const runs = acts.filter((a) => isRun(a.sport));
    const longest = (f: (s: string) => boolean) => Math.max(0, ...acts.filter((a) => f(a.sport)).map((a) => a.distance)) / 1000;
    const metaNum = (id: string) => Number(meta.find((m) => m.id === id)?.value ?? 0);
    const lastSnap = finSnaps.sort((a, b) => b.ts - a.ts)[0];
    const today = dateKey(this.now());
    const modulesToday = new Set(log.filter((e) => e.date === today && e.amount > 0 && e.module !== 'core' && e.module !== 'finance').map((e) => e.module)).size;
    const done = progress.filter((p) => p.completedAt);
    return {
      level: levelFromXp(profile.xp).level,
      totalXp: profile.xp,
      bestStreak: profile.bestStreak,
      questsDone: done.length,
      mathCorrect: attempts.filter((a) => a.correct).length,
      bossBest: Math.max(0, ...boss.map((b) => b.score)),
      bossCount: boss.length,
      workouts: workouts.length,
      prs: workouts.reduce((n, w) => n + w.prs.length, 0),
      restDays: done.filter((p) => p.questId === 'train-rest').length,
      chessGames: games.length,
      chessAnalyzed: games.filter((g) => g.analyzed).length,
      booksDone: books.filter((b) => b.done >= b.chapters).length,
      chaptersDone: books.reduce((n, b) => n + b.done, 0),
      discoveries: discoveries.length,
      quizzes: metaNum('quizCount'),
      modulesToday,
      financeDeposits: finTx.filter((t) => t.type === 'DEPOSIT').length,
      financeDividends: finDiv.length,
      financeMilestone: metaNum('financeMilestone'),
      financePositions: lastSnap?.positions.length ?? 0,
      financeBestStreak: metaNum('financeBestStreak'),
      financeGoalsDone: meta.filter((m) => m.id.startsWith('goal:')).length,
      runs: runs.length,
      activities: acts.length,
      runKmTotal: runs.reduce((n, a) => n + a.distance, 0) / 1000,
      runLongestKm: longest(isRun),
      rideLongestKm: longest(isRide),
      swimLongestKm: longest(isSwim),
      bricks: meta.filter((m) => m.id.startsWith('brick:')).length,
      ironmanReady: ironmanReady(acts),
      expenseDays: new Set([...expenses.map((e) => e.date), ...meta.filter((m) => m.id.startsWith('budgetNone:')).map((m) => m.id)]).size,
      budgetMonths: meta.filter((m) => m.id.startsWith('budgetMonth:') && m.value === true).length,
      codeSolved: solved.size,
      codeHard: [...solved].filter((id) => id.startsWith('py:h-')).length,
      cQuizCorrect: codeAttempts.filter((a) => a.passed && a.taskId.startsWith('c:')).length,
      booksRead: readBooks.filter((b) => b.status === 'done').length,
      pagesRead: readLog.reduce((n, e) => n + e.pages, 0),
    };
  }

  async checkAchievements(): Promise<void> {
    const ctx = await this.achievementCtx();
    const unlocked = new Set((await this.store.col('achievements').all()).map((a) => a.id));
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id) || !a.check(ctx)) continue;
      await this.store.col('achievements').put({ id: a.id, unlockedAt: Date.now() });
      this.emit({ type: 'achievement', achievement: a });
    }
  }
}
