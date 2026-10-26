import { game, store } from '../../app/context';
import type { Discovery } from '../../data/types';
import { dateKey, uid } from '../../lib/date';

export const EXTRA_XP = 5;

/** Uloží objev; první objev dne splní quest, každý další dá malý bonus. */
export async function saveDiscovery(input: Pick<Discovery, 'text' | 'tags' | 'sourceId' | 'videoId' | 'videoTitle'>) {
  const d: Discovery = { id: uid(), ts: Date.now(), date: dateKey(), ...input, text: input.text.trim() };
  await store.col('discoveries').put(d);
  const completed = await game.progressQuest('discover-daily');
  if (!completed) await game.award({ amount: EXTRA_XP, stat: 'int', module: 'discover', label: 'Další objev' });
}
