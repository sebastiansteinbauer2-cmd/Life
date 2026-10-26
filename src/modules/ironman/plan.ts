import { addDays, daysBetween, weekStart } from '../../lib/date';

export type Phase = 'base' | 'build' | 'peak' | 'taper' | 'race';

export const PHASE_LABEL: Record<Phase, string> = {
  base: 'Základ', build: 'Budování', peak: 'Vrchol', taper: 'Ladění', race: 'Závodní týden',
};
export const PHASE_INFO: Record<Phase, string> = {
  base: 'Hodně klidného tempa v zóně 2, technika plavání, budování objemu.',
  build: 'Delší tréninky, tempo blízko závodnímu, pravidelný brick.',
  peak: 'Nejdelší tréninky a závodní simulace. Hlídej spánek a jídlo.',
  taper: 'Objem dolů, krátké rychlé úseky. Tělo se zotavuje a sílí.',
  race: 'Jen lehké protažení, odpočinek, příprava výbavy. Hodně štěstí!',
};

export interface PlanWeek {
  monday: string;
  index: number; // 1…N
  phase: Phase;
  recovery: boolean;
  hours: number;
  longRideH: number;
  longRunKm: number;
  swims: number;
  brick: boolean;
}

const PEAK = {
  full: { hours: 14, ride: 5.5, run: 30, swims: 3 },
  half: { hours: 10, ride: 3.5, run: 18, swims: 3 },
} as const;
const START = { hours: 5, ride: 1.5, run: 8, swims: 2 };

const round = (x: number, step: number) => Math.round(x / step) * step;

/**
 * Jednoduchá periodizace k závodu: základ (≈45 %), budování (≈35 %), vrchol (≈20 %), ladění 2 týdny
 * (u 70.3 jeden), každý 4. týden lehčí. Start od aktuálního objemu, vrchol podle typu závodu.
 * Orientační plán – nenahrazuje trenéra.
 */
export function buildPlan(race: 'full' | 'half', raceDate: string, today: string, currentHours = START.hours): PlanWeek[] {
  const first = weekStart(new Date(`${today}T12:00:00`));
  const raceMonday = weekStart(new Date(`${raceDate}T12:00:00`));
  const n = Math.floor(daysBetween(first, raceMonday) / 7) + 1;
  if (n < 1) return [];
  const peak = PEAK[race];
  const taperWeeks = Math.min(race === 'full' ? 2 : 1, Math.max(0, n - 1));
  const trainWeeks = n - 1 - taperWeeks;
  const startH = Math.min(peak.hours * 0.8, Math.max(3, currentHours));
  const weeks: PlanWeek[] = [];

  for (let i = 0; i < n; i++) {
    const monday = addDays(first, i * 7);
    if (i === n - 1) {
      weeks.push({ monday, index: i + 1, phase: 'race', recovery: false, hours: round(peak.hours * 0.3, 0.5), longRideH: 0, longRunKm: 0, swims: 2, brick: false });
      continue;
    }
    if (i >= trainWeeks) {
      const k = i - trainWeeks; // 0 = první týden ladění
      const f = taperWeeks === 2 ? [0.7, 0.5][k] : 0.6;
      weeks.push({
        monday, index: i + 1, phase: 'taper', recovery: false, hours: round(peak.hours * f, 0.5),
        longRideH: round(peak.ride * f * 0.7, 0.5), longRunKm: round(peak.run * f * 0.6, 1), swims: peak.swims, brick: k === 0,
      });
      continue;
    }
    const t = trainWeeks > 1 ? i / (trainWeeks - 1) : 1; // 0 → 1 průběh tréninku
    const phase: Phase = t < 0.45 ? 'base' : t < 0.8 ? 'build' : 'peak';
    const recovery = (i + 1) % 4 === 0 && i < trainWeeks - 1;
    const f = recovery ? 0.7 : 1;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    weeks.push({
      monday, index: i + 1, phase, recovery,
      hours: round(lerp(startH, peak.hours) * f, 0.5),
      longRideH: round(lerp(START.ride, peak.ride) * f, 0.5),
      longRunKm: round(lerp(START.run, peak.run) * f, 1),
      swims: phase === 'base' ? START.swims + (t > 0.25 ? 1 : 0) : peak.swims,
      brick: phase !== 'base' && !recovery,
    });
  }
  return weeks;
}

export const currentPlanWeek = (plan: PlanWeek[], today: string) => {
  const monday = weekStart(new Date(`${today}T12:00:00`));
  return plan.find((w) => w.monday === monday) ?? null;
};
