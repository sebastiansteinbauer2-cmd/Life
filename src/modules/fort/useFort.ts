import { useEffect, useState } from 'react';
import { store, useProfile, useQuery } from '../../app/context';
import type { FortState, StatId, XpEntry } from '../../data/types';
import { computeStreak } from '../../game/streaks';
import { STATS, levelFromXp } from '../../game/xp';
import { dateKey } from '../../lib/date';
import type { Res } from './data';
import { balance, earned, finishUpgrade, lifeBuffs, newFort, normalizeFort, pending, resolveRaids, type LifeBuff, type Raid } from './economy';

export interface FortCtx {
  fort: FortState | null; // null = pevnost ještě nezaložená
  bal: Res;
  got: Res; // suroviny z XP celkem
  pend: Res; // čekají na sebrání
  heroLevel: number;
  statLevels: Record<StatId, number>;
  buffs: LifeBuff[];
  activeToday: boolean;
  /** Odkud pochází čekající suroviny (posledních pár zápisů XP od sebrání). */
  sources: XpEntry[];
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
  const log = await store.col('xpLog').all();
  await saveFort(newFort(Date.now(), dateKey(), earned(log)));
}

const MIND = new Set(['math', 'code', 'reading', 'discover', 'chess']);
const BODY = new Set(['training', 'ironman']);

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
    let s = finishUpgrade(normalizeFort(fort, earned(log), Date.now()), Date.now());
    const r = resolveRaids(s, active, today);
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
    return { fort: fort ?? null, log };
  });
  if (!data) return undefined;
  const got = earned(data.log);
  const fort = data.fort ? normalizeFort(data.fort, got, Date.now()) : null;
  const today = dateKey();
  const todays = data.log.filter((e) => e.date === today && e.amount > 0);
  const statLevels = Object.fromEntries(STATS.map((s) => [s.id, levelFromXp(p.statXp[s.id] ?? 0).level])) as Record<StatId, number>;
  const streak = computeStreak(data.log.filter((e) => e.amount > 0).map((e) => e.date), today).current;
  return {
    fort,
    bal: fort ? balance(fort) : { wood: 0, stone: 0, crystal: 0 },
    got,
    pend: fort ? pending(fort, got) : { wood: 0, stone: 0, crystal: 0 },
    heroLevel: levelFromXp(p.xp).level,
    statLevels,
    buffs: lifeBuffs({
      trained: todays.some((e) => BODY.has(e.module)),
      mind: todays.some((e) => MIND.has(e.module)),
      discipline: todays.some((e) => e.stat === 'dis'),
      streak,
    }),
    activeToday: todays.length > 0,
    sources: fort ? data.log.filter((e) => e.amount > 0 && e.ts > (fort.collectedAt ?? 0)).sort((a, b) => b.ts - a.ts) : [],
    save: saveFort,
  };
}
