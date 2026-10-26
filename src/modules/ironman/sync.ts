import { game, store } from '../../app/context';
import type { Activity, StatId } from '../../data/types';
import { dateKey, parseDateKey, weekStart } from '../../lib/date';
import { activityStat, activityXp, brickDays, disciplineOf, records, sportIcon } from './sports';
import { fetchActivities, type RawActivity } from './strava';

const PR_XP = 20;

export interface StravaSyncResult { firstSync: boolean; added: number; xp: number; prs: string[] }

/** Lokální datum aktivity (start_date_local je místní čas zapsaný jako UTC). */
function toActivity(a: RawActivity): Activity {
  const local = a.start_date_local.slice(0, 10);
  return {
    id: String(a.id), ts: Date.parse(a.start_date), date: local, sport: a.sport_type || a.type, name: a.name,
    distance: a.distance, movingTime: a.moving_time, elevation: a.total_elevation_gain, avgHr: a.average_heartrate,
  };
}

export async function syncStrava(base: string): Promise<StravaSyncResult> {
  const lastSync = ((await store.col('meta').get('stravaLastSync'))?.value as number | undefined) ?? null;
  const firstSync = !lastSync;
  const existing = await store.col('activities').all();
  const known = new Set(existing.map((a) => a.id));
  const latest = Math.max(0, ...existing.map((a) => a.ts));
  // první načtení: posledních 120 dní; pak jen nové (s rezervou 2 dní na pozdě nahrané aktivity)
  const after = Math.floor((latest ? latest - 2 * 86_400_000 : Date.now() - 120 * 86_400_000) / 1000);
  const fresh = (await fetchActivities(base, after)).map(toActivity).filter((a) => !known.has(a.id));

  const before = records(existing);
  let xp = 0;
  const prs: string[] = [];
  if (!firstSync) {
    for (const a of fresh) a.xp = activityXp(a);
    // XP po statistikách (posilovna → Síla, zbytek → Vytrvalost)
    const byStat = new Map<StatId, Activity[]>();
    for (const a of fresh) byStat.set(activityStat(a.sport), [...(byStat.get(activityStat(a.sport)) ?? []), a]);
    for (const [stat, list] of byStat) {
      const amount = list.reduce((n, a) => n + (a.xp ?? 0), 0);
      const label = list.length === 1 ? `${sportIcon(list[0].sport)} ${list[0].name}` : `${list.length} aktivit ze Stravy`;
      await game.award({ amount, stat, module: 'ironman', label });
      xp += amount;
    }
  }
  if (fresh.length) await store.col('activities').bulkPut(fresh);

  // osobní rekordy (jen při dalších synchronizacích)
  if (!firstSync && fresh.length) {
    const after2 = records([...existing, ...fresh]);
    const check = (key: keyof typeof after2, label: string) => {
      const b = before[key];
      const n = after2[key];
      if (n && (!b || n.id !== b.id) && fresh.some((f) => f.id === n.id)) prs.push(label);
    };
    check('fastest5k', 'nejrychlejší běh 5+ km');
    check('fastest10k', 'nejrychlejší běh 10+ km');
    check('fastestSwim', 'nejrychlejší plavání');
    check('fastestRide', 'nejrychlejší kolo');
    for (const label of prs) {
      await game.award({ amount: PR_XP, stat: 'end', module: 'ironman', label: `Osobní rekord: ${label}` });
      xp += PR_XP;
    }
  }

  // týdenní questy podle aktivit tohoto týdne
  const all = [...existing, ...fresh];
  const monday = weekStart();
  const mondayTs = parseDateKey(monday).getTime();
  const thisWeek = all.filter((a) => parseDateKey(a.date).getTime() >= mondayTs);
  const count = (d: string) => thisWeek.filter((a) => disciplineOf(a.sport) === d).length;
  if (count('swim')) await game.progressQuest('im-swim', { setTo: count('swim') });
  if (count('bike')) await game.progressQuest('im-bike', { setTo: count('bike') });
  if (count('run')) await game.progressQuest('im-run', { setTo: count('run') });
  const bricks = brickDays(all);
  for (const d of bricks) if (!(await store.col('meta').get(`brick:${d}`))) await store.col('meta').put({ id: `brick:${d}`, value: true });
  if (bricks.some((d) => parseDateKey(d).getTime() >= mondayTs)) await game.progressQuest('im-brick', { setTo: 1 });
  // dnešní aktivita = splněný denní trénink
  if (all.some((a) => a.date === dateKey())) await game.progressQuest('train-workout', { setTo: 1 });

  await store.col('meta').put({ id: 'stravaLastSync', value: Date.now() });
  await game.checkAchievements();
  return { firstSync, added: fresh.length, xp, prs };
}
