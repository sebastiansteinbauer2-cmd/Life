import { game, store } from '../../app/context';
import type { MathLevel } from '../../data/types';
import { dateKey, uid } from '../../lib/date';
import { updateSrs, type Problem } from './generator';
import { TOPIC_SHORT } from './topics';

export const XP_PER_PROBLEM: Record<MathLevel, number> = { zaklad: 3, rozsireny: 4, fit: 5 };

/** Uloží pokus, aktualizuje opakování s rozestupy a případně připíše XP. */
export async function recordAttempt(p: Problem, correct: boolean, opts: { award?: boolean } = { award: true }) {
  const today = dateKey();
  await store.col('mathAttempts').put({
    id: uid(), ts: Date.now(), date: today, topic: p.topic, template: p.template, level: p.level, correct,
  });
  const prev = await store.col('topicSrs').get(p.topic);
  await store.col('topicSrs').put(updateSrs(prev, p.topic, correct, today));
  if (correct && opts.award) {
    await game.award({ amount: XP_PER_PROBLEM[p.level], stat: 'int', module: 'math', label: `Příklad: ${TOPIC_SHORT[p.topic]}` });
  }
  if (correct) await game.progressQuest('math-daily');
}
