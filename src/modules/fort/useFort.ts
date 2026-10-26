import { useEffect, useState } from 'react';
import { store, useProfile, useQuery } from '../../app/context';
import type { FortState, StatId } from '../../data/types';
import { STATS, levelFromXp } from '../../game/xp';
import { dateKey } from '../../lib/date';
import { balance, earned, finishUpgrade, newFort, resolveRaids, type Raid } from './economy';
import type { Res } from './data';

export interface FortCtx {
  fort: FortState | null; // null = pevnost ještě nezaložená
  bal: Res;
  heroLevel: number;
  statLevels: Record<StatId, number>;
  save: (s: FortState) => Promise<void>;
}

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const saveFort = (s: FortState) => store.col('fort').put(s);

export async function createFort() {
  await saveFort(newFort(Date.now(), dateKey()));
}

/** Vyhodnotí dokončené stavby a nájezdy za vynechané dny. Vrací nové nájezdy (pro hlášení). */
let checking = false;
export async function checkFort(): Promise<Raid[]> {
  if (checking) return [];
  checking = true;
  try {
    const fort = await store.col('fort').get('me');
    if (!fort) return [];
    const log = await store.col('xpLog').all();
    const today = dateKey();
    const active = new Set(log.filter((e) => e.amount > 0).map((e) => e.date));
    let s = finishUpgrade(fort, Date.now());
    const r = resolveRaids(s, earned(log), active, today);
    const fresh: Raid[] = [];
    for (const raid of r.raids) {
      const id = `raid:${raid.date}`;
      if (await store.col('fortLog').get(id)) continue; // už vyhodnoceno na jiném zařízení
      fresh.push(raid);
      await store.col('fortLog').put({
        id, ts: Date.now(), date: raid.date, kind: 'raid', win: raid.win,
        title: raid.win ? 'Nájezd odražen' : 'Nájezd – pevnost vyrabována',
        res: { wood: -raid.stolen.wood, stone: -raid.stolen.stone, crystal: 0 },
      });
    }
    // ztráty se odečtou jen za nově vyhodnocené dny
    const stolen = fresh.reduce((a, x) => ({ wood: a.wood + x.stolen.wood, stone: a.stone + x.stolen.stone }), { wood: 0, stone: 0 });
    s = { ...s, raidChecked: r.state.raidChecked, delta: { ...s.delta, wood: s.delta.wood - stolen.wood, stone: s.delta.stone - stolen.stone } };
    if (JSON.stringify(s) !== JSON.stringify(fort)) await saveFort(s);
    return fresh;
  } finally {
    checking = false;
  }
}

export function useFort(): FortCtx | undefined {
  const p = useProfile();
  const data = useQuery(async () => {
    const [fort, log] = await Promise.all([store.col('fort').get('me'), store.col('xpLog').all()]);
    return { fort: fort ?? null, got: earned(log) };
  });
  if (!data) return undefined;
  const statLevels = Object.fromEntries(STATS.map((s) => [s.id, levelFromXp(p.statXp[s.id] ?? 0).level])) as Record<StatId, number>;
  return {
    fort: data.fort,
    bal: data.fort ? balance(data.fort, data.got) : { wood: 0, stone: 0, crystal: 0 },
    heroLevel: levelFromXp(p.xp).level,
    statLevels,
    save: saveFort,
  };
}
