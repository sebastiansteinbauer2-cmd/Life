import { describe, expect, it } from 'vitest';
import { buildPlan, currentPlanWeek } from './plan';

describe('tréninkový plán na Ironman', () => {
  const plan = buildPlan('full', '2027-06-27', '2026-10-26', 6);

  it('pokryje týdny až do závodu', () => {
    expect(plan[0].monday).toBe('2026-10-26');
    expect(plan[plan.length - 1].phase).toBe('race');
    expect(plan[plan.length - 1].monday).toBe('2027-06-21');
    expect(plan.length).toBe(35);
  });

  it('fáze jdou ve správném pořadí a ladí 2 týdny', () => {
    const order = ['base', 'build', 'peak', 'taper', 'race'];
    const phases = plan.map((w) => order.indexOf(w.phase));
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(plan.filter((w) => w.phase === 'taper')).toHaveLength(2);
  });

  it('objem roste k vrcholu, každý 4. týden je lehčí a ladění objem snižuje', () => {
    const train = plan.filter((w) => !['taper', 'race'].includes(w.phase));
    expect(train[0].hours).toBe(6);
    expect(Math.max(...plan.map((w) => w.hours))).toBe(14);
    expect(plan[3].recovery).toBe(true);
    expect(plan[3].hours).toBeLessThan(plan[2].hours);
    const peakH = Math.max(...plan.map((w) => w.hours));
    for (const w of plan.filter((x) => x.phase === 'taper')) expect(w.hours).toBeLessThan(peakH);
    expect(Math.max(...plan.map((w) => w.longRunKm))).toBe(30);
  });

  it('70.3 a krátký čas do závodu', () => {
    const half = buildPlan('half', '2026-11-15', '2026-10-26', 5);
    expect(half.map((w) => w.phase)).toEqual(['peak', 'taper', 'race']); // 3 týdny: 26.10., 2.11., 9.11.
    expect(buildPlan('full', '2026-01-01', '2026-10-26')).toEqual([]);
    expect(currentPlanWeek(plan, '2026-10-29')?.index).toBe(1);
  });
});
