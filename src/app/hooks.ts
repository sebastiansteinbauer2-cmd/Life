import type { ModuleId } from '../data/types';
import { questsForDate, withProgress, type QuestView } from '../game/quests';
import { computeStreak, type StreakInfo } from '../game/streaks';
import { addDays, dateKey } from '../lib/date';
import { game, store, useQuery } from './context';

export function useQuests(module?: ModuleId): QuestView[] | undefined {
  return useQuery(async () => {
    const [custom, progress] = await Promise.all([store.col('quests').all(), store.col('questProgress').all()]);
    const all = withProgress(questsForDate(custom), progress);
    return module ? all.filter((q) => q.module === module) : all;
  }, [module]);
}

export function useStreaks(): (Record<ModuleId | 'all', StreakInfo> & { week: { date: string; on: boolean }[] }) | undefined {
  return useQuery(async () => {
    const log = await store.col('xpLog').all();
    const pos = log.filter((e) => e.amount > 0);
    const days = (m?: ModuleId) => pos.filter((e) => !m || e.module === m).map((e) => e.date);
    const active = new Set(days());
    const today = dateKey();
    return {
      week: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6);
        return { date, on: active.has(date) };
      }),
      all: computeStreak(days()),
      core: computeStreak(days('core')),
      math: computeStreak(days('math')),
      training: computeStreak(days('training')),
      chess: computeStreak(days('chess')),
      discover: computeStreak(days('discover')),
      finance: computeStreak(days('finance')),
    };
  });
}

export { game };
