import type { CustomQuest, Difficulty, ModuleId, QuestProgress, Recurrence, StatId } from '../data/types';
import { dateKey, monthKey, weekKey } from '../lib/date';
import { planForDate } from '../modules/training/plan';

export interface Quest {
  id: string;
  title: string;
  description?: string;
  module: ModuleId;
  stat: StatId;
  difficulty: Difficulty;
  recurrence: Recurrence;
  target: number;
  /** Lze odškrtnout ručně? (automatické questy plní aplikace sama) */
  manual: boolean;
  custom: boolean;
  route?: string;
  icon?: string;
}

interface BuiltinQuest extends Quest {
  activeOn?: (d: Date) => boolean;
}

const isRestDay = (d: Date) => planForDate(d).kind === 'rest';

export const BUILTIN_QUESTS: BuiltinQuest[] = [
  {
    id: 'math-daily', title: 'Vyřeš 10 příkladů', description: 'Správně vyřešené příklady v modulu Matematika',
    module: 'math', stat: 'int', difficulty: 'medium', recurrence: 'daily', target: 10, manual: false, custom: false, route: '/math/practice',
  },
  {
    id: 'math-boss', title: 'Boss fight: simulace přijímaček', module: 'math', stat: 'int',
    difficulty: 'epic', recurrence: 'weekly', target: 1, manual: false, custom: false, route: '/math/boss',
  },
  {
    id: 'train-workout', title: 'Odcvič dnešní trénink', module: 'training', stat: 'str', difficulty: 'medium',
    recurrence: 'daily', target: 1, manual: false, custom: false, route: '/training/log',
    activeOn: (d) => !isRestDay(d),
  },
  {
    id: 'train-rest', title: 'Regenerace – den volna', description: 'Protáhni se, vyspi se, dej tělu odpočinout.',
    module: 'training', stat: 'dis', difficulty: 'easy', recurrence: 'daily', target: 1, manual: true, custom: false,
    activeOn: isRestDay,
  },
  {
    id: 'chess-puzzles', title: '10 puzzlí na Chess.com', module: 'chess', stat: 'chess', difficulty: 'easy',
    recurrence: 'daily', target: 1, manual: true, custom: false, route: '/chess',
  },
  {
    id: 'chess-rapid', title: 'Rapid partie 15+10 / 30+0', description: 'Načte se při synchronizaci, jde i odškrtnout.',
    module: 'chess', stat: 'chess', difficulty: 'hard', recurrence: 'weekly', target: 3, manual: true, custom: false, route: '/chess',
  },
  {
    id: 'chess-analysis', title: 'Rozbor partie bez enginu', description: 'Označ partii jako rozebranou v seznamu partií.',
    module: 'chess', stat: 'chess', difficulty: 'medium', recurrence: 'weekly', target: 3, manual: false, custom: false, route: '/chess',
  },
  {
    id: 'chess-endgames', title: '30 minut koncovek', module: 'chess', stat: 'chess', difficulty: 'medium',
    recurrence: 'weekly', target: 2, manual: true, custom: false,
  },
  {
    id: 'chess-gm', title: 'Komentovaná partie velmistra (hádání tahů)', module: 'chess', stat: 'chess',
    difficulty: 'medium', recurrence: 'weekly', target: 1, manual: true, custom: false,
  },
  {
    id: 'discover-daily', title: 'Objev dne', description: 'Podívej se / přečti si 1 věc a zapiš jednou větou, co ses dozvěděl.',
    module: 'discover', stat: 'int', difficulty: 'medium', recurrence: 'daily', target: 1, manual: false, custom: false, route: '/discover',
  },
  {
    id: 'discover-quiz', title: 'Týdenní opakovací kvíz', module: 'discover', stat: 'int', difficulty: 'medium',
    recurrence: 'weekly', target: 1, manual: false, custom: false, route: '/discover/quiz',
  },
  {
    id: 'im-swim', icon: '🏊', title: 'Plavání 2× týdně', description: 'Zapiš trénink nebo naimportuj ze Stravy.', module: 'ironman', stat: 'end',
    difficulty: 'hard', recurrence: 'weekly', target: 2, manual: false, custom: false, route: '/ironman',
  },
  {
    id: 'im-bike', icon: '🚴', title: 'Kolo 2× týdně', description: 'Zapiš trénink nebo naimportuj ze Stravy.', module: 'ironman', stat: 'end',
    difficulty: 'hard', recurrence: 'weekly', target: 2, manual: false, custom: false, route: '/ironman',
  },
  {
    id: 'im-run', icon: '🏃', title: 'Běh 3× týdně', description: 'Zapiš trénink nebo naimportuj ze Stravy.', module: 'ironman', stat: 'end',
    difficulty: 'hard', recurrence: 'weekly', target: 3, manual: false, custom: false, route: '/ironman',
  },
  {
    id: 'im-brick', icon: '🧱', title: 'Brick: kolo + hned běh', description: 'Obojí v jeden den – zvykání nohou na běh po kole.', module: 'ironman', stat: 'end',
    difficulty: 'epic', recurrence: 'weekly', target: 1, manual: false, custom: false, route: '/ironman',
  },
  {
    id: 'finance-monthly', title: 'Investuj svůj měsíční cíl', description: 'Splní se po synchronizaci s Trading 212, když vklady za měsíc dosáhnou cíle.',
    module: 'finance', stat: 'dis', difficulty: 'epic', recurrence: 'monthly', target: 1, manual: false, custom: false, route: '/finance',
  },
];

export function customToQuest(q: CustomQuest): Quest {
  return { ...q, manual: true, custom: true };
}

export function periodKey(rec: Recurrence, d: Date = new Date()): string {
  if (rec === 'daily') return dateKey(d);
  if (rec === 'weekly') return weekKey(d);
  if (rec === 'monthly') return monthKey(d);
  return 'once';
}

export const progressId = (questId: string, period: string) => `${questId}|${period}`;

export function questsForDate(custom: CustomQuest[], d: Date = new Date()): Quest[] {
  const builtins = BUILTIN_QUESTS.filter((q) => !q.activeOn || q.activeOn(d)).map(({ activeOn: _a, ...q }) => q);
  return [...builtins, ...custom.filter((c) => !c.archived).map(customToQuest)];
}

export function findQuest(id: string, custom: CustomQuest[]): Quest | undefined {
  const b = BUILTIN_QUESTS.find((q) => q.id === id);
  if (b) {
    const { activeOn: _a, ...q } = b;
    return q;
  }
  const c = custom.find((q) => q.id === id);
  return c ? customToQuest(c) : undefined;
}

export interface QuestView extends Quest {
  period: string;
  count: number;
  done: boolean;
}

export function withProgress(quests: Quest[], progress: QuestProgress[], d: Date = new Date()): QuestView[] {
  const byId = new Map(progress.map((p) => [p.id, p]));
  return quests.map((q) => {
    const period = periodKey(q.recurrence, d);
    const p = byId.get(progressId(q.id, period));
    return { ...q, period, count: p?.count ?? 0, done: !!p?.completedAt };
  });
}
