import type { Activity, StatId } from '../../data/types';
import { weekStart } from '../../lib/date';

export type Discipline = 'swim' | 'bike' | 'run';

const RUNS = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide']);
const SWIMS = new Set(['Swim']);
const WALKS = new Set(['Walk', 'Hike']);
const STRENGTH = new Set(['WeightTraining', 'Workout', 'Crossfit']);

export const isRun = (sport: string) => RUNS.has(sport);
export const isRide = (sport: string) => RIDES.has(sport) && sport !== 'EBikeRide';
export const isSwim = (sport: string) => SWIMS.has(sport);

export function disciplineOf(sport: string): Discipline | null {
  if (isSwim(sport)) return 'swim';
  if (isRide(sport)) return 'bike';
  if (isRun(sport)) return 'run';
  return null;
}

/** Vzdálenosti závodů v km. */
export const RACES = {
  full: { name: 'Ironman', swim: 3.8, bike: 180, run: 42.195 },
  half: { name: 'Ironman 70.3', swim: 1.9, bike: 90, run: 21.0975 },
} as const;

export const DISCIPLINES: { id: Discipline; label: string; icon: string; color: string }[] = [
  { id: 'swim', label: 'Plavání', icon: '🏊', color: '#22d3ee' },
  { id: 'bike', label: 'Kolo', icon: '🚴', color: '#fbbf24' },
  { id: 'run', label: 'Běh', icon: '🏃', color: '#f87171' },
];

export const SPORT_LABEL: Record<string, string> = {
  Run: 'Běh', TrailRun: 'Trailový běh', VirtualRun: 'Běh (pás)', Walk: 'Chůze', Hike: 'Turistika',
  Ride: 'Kolo', VirtualRide: 'Kolo (trenažér)', GravelRide: 'Gravel', MountainBikeRide: 'MTB', EBikeRide: 'E-kolo',
  Swim: 'Plavání', WeightTraining: 'Posilovna', Workout: 'Trénink', Yoga: 'Jóga',
};

export const sportIcon = (sport: string) =>
  isSwim(sport) ? '🏊' : RIDES.has(sport) ? '🚴' : isRun(sport) ? '🏃' : WALKS.has(sport) ? '🚶' : '💪';

/** Posilovna jde do Síly, vše ostatní do Vytrvalosti. */
export const activityStat = (sport: string): StatId => (STRENGTH.has(sport) ? 'str' : 'end');

/**
 * XP za aktivitu (strop 150): plavání 30 XP/km, běh 8 XP/km, kolo 2 XP/km, chůze 3 XP/km,
 * ostatní podle času. Zhruba hodina tréninku = 50–80 XP v každé disciplíně.
 */
export function activityXp(a: Pick<Activity, 'sport' | 'distance' | 'movingTime'>): number {
  const km = a.distance / 1000;
  const min = a.movingTime / 60;
  let xp: number;
  if (isSwim(a.sport)) xp = km * 30;
  else if (isRun(a.sport)) xp = km * 8 + min * 0.3;
  else if (RIDES.has(a.sport)) xp = km * 2;
  else if (WALKS.has(a.sport)) xp = km * 3;
  else xp = min * 0.6;
  return Math.max(5, Math.min(150, Math.round(xp)));
}

/** Tempo běhu v s/km, plavání v s/100 m, rychlost kola v km/h. */
export const paceSec = (a: Pick<Activity, 'distance' | 'movingTime'>) => (a.distance > 0 ? a.movingTime / (a.distance / 1000) : Infinity);
export const swimPace100 = (a: Pick<Activity, 'distance' | 'movingTime'>) => (a.distance > 0 ? a.movingTime / (a.distance / 100) : Infinity);
export const speedKmh = (a: Pick<Activity, 'distance' | 'movingTime'>) => (a.movingTime > 0 ? a.distance / 1000 / (a.movingTime / 3600) : 0);

export function formatMinSec(sec: number): string {
  if (!Number.isFinite(sec)) return '–';
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export const kmText = (m: number) => (m / 1000).toFixed(m >= 100_000 ? 0 : 1).replace('.', ',');

/** Hlavní údaj aktivity: běh tempo, plavání tempo na 100 m, kolo km/h. */
export function activityStatText(a: Activity): string {
  if (isRun(a.sport)) return `${formatMinSec(paceSec(a))} /km`;
  if (isSwim(a.sport)) return `${formatMinSec(swimPace100(a))} /100 m`;
  if (RIDES.has(a.sport)) return `${speedKmh(a).toFixed(1).replace('.', ',')} km/h`;
  return formatTime(a.movingTime);
}

/** Nejdelší jednotlivá aktivita v disciplíně (km). */
export function longestKm(acts: Activity[], d: Discipline): number {
  return Math.max(0, ...acts.filter((a) => disciplineOf(a.sport) === d).map((a) => a.distance)) / 1000;
}

/**
 * Připravenost na závod: pro každou disciplínu nejdelší trénink / závodní vzdálenost (max 100 %),
 * celkově průměr. Je to jednoduchý ukazatel objemu, ne trenérský test.
 */
export function readiness(acts: Activity[], race: keyof typeof RACES) {
  const r = RACES[race];
  const parts = DISCIPLINES.map((d) => {
    const best = longestKm(acts, d.id);
    return { ...d, best, target: r[d.id], pct: Math.min(1, best / r[d.id]) };
  });
  return { parts, total: parts.reduce((s, p) => s + p.pct, 0) / parts.length };
}

export const ironmanReady = (acts: Activity[]) => readiness(acts, 'full').total >= 1;

/** Týdenní objem po disciplínách (hodiny a km) pro týden začínající pondělím `monday`. */
export function weekVolume(acts: Activity[], monday: string = weekStart()) {
  const week = acts.filter((a) => weekStart(new Date(a.ts)) === monday);
  const by = (d: Discipline) => week.filter((a) => disciplineOf(a.sport) === d);
  const sum = (list: Activity[], f: (a: Activity) => number) => list.reduce((n, a) => n + f(a), 0);
  return {
    hours: sum(week, (a) => a.movingTime) / 3600,
    swim: { count: by('swim').length, km: sum(by('swim'), (a) => a.distance) / 1000 },
    bike: { count: by('bike').length, km: sum(by('bike'), (a) => a.distance) / 1000 },
    run: { count: by('run').length, km: sum(by('run'), (a) => a.distance) / 1000 },
  };
}

/** Dny s „brickem“: kolo a po něm (do 3 hodin od konce kola) běh. */
export function brickDays(acts: Activity[]): string[] {
  const days = new Set<string>();
  const rides = acts.filter((a) => isRide(a.sport));
  const runs = acts.filter((a) => isRun(a.sport));
  for (const r of rides) {
    const end = r.ts + r.movingTime * 1000;
    if (runs.some((x) => x.ts >= r.ts && x.ts - end <= 3 * 3600_000)) days.add(r.date);
  }
  return [...days];
}

/** Osobní rekordy. */
export function records(acts: Activity[]) {
  const runs = acts.filter((a) => isRun(a.sport));
  const fastest = (min: number) => runs.filter((a) => a.distance >= min).sort((a, b) => paceSec(a) - paceSec(b))[0];
  const swims = acts.filter((a) => isSwim(a.sport) && a.distance >= 400).sort((a, b) => swimPace100(a) - swimPace100(b));
  const rides = acts.filter((a) => isRide(a.sport) && a.distance >= 20_000).sort((a, b) => speedKmh(b) - speedKmh(a));
  return { fastest5k: fastest(5000), fastest10k: fastest(10000), fastestSwim: swims[0], fastestRide: rides[0] };
}
