import { describe, expect, it } from 'vitest';
import type { Activity } from '../../data/types';
import {
  activityStat, activityXp, brickDays, disciplineOf, formatMinSec, ironmanReady, paceSec, readiness, records, swimPace100, weekVolume,
} from './sports';

let n = 0;
const act = (sport: string, km: number, minutes: number, date = '2026-10-21', hour = 8): Activity => ({
  id: String(++n), ts: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime(), date, sport, name: sport,
  distance: km * 1000, movingTime: minutes * 60, elevation: 0,
});

describe('Ironman', () => {
  it('rozpozná disciplíny', () => {
    expect(disciplineOf('Swim')).toBe('swim');
    expect(disciplineOf('VirtualRide')).toBe('bike');
    expect(disciplineOf('EBikeRide')).toBeNull(); // e-kolo se do tréninku nepočítá
    expect(disciplineOf('TrailRun')).toBe('run');
    expect(disciplineOf('Yoga')).toBeNull();
    expect(activityStat('WeightTraining')).toBe('str');
    expect(activityStat('Run')).toBe('end');
  });

  it('XP podle disciplíny a stropu', () => {
    expect(activityXp(act('Swim', 2, 45))).toBe(60);
    expect(activityXp(act('Run', 10, 50))).toBe(95);
    expect(activityXp(act('Ride', 50, 100))).toBe(100);
    expect(activityXp(act('Ride', 200, 400))).toBe(150);
    expect(activityXp(act('Yoga', 0, 1))).toBe(5);
  });

  it('tempa', () => {
    expect(formatMinSec(paceSec(act('Run', 10, 50)))).toBe('5:00');
    expect(formatMinSec(swimPace100(act('Swim', 2, 40)))).toBe('2:00');
    expect(formatMinSec(299.6)).toBe('5:00');
  });

  it('připravenost na Ironman', () => {
    const acts = [act('Swim', 1.9, 45), act('Ride', 90, 180), act('Run', 21.1, 120)];
    const half = readiness(acts, 'half');
    expect(half.total).toBeCloseTo(1, 2);
    const full = readiness(acts, 'full');
    expect(full.parts.map((p) => Math.round(p.pct * 100))).toEqual([50, 50, 50]);
    expect(ironmanReady(acts)).toBe(false);
    expect(ironmanReady([...acts, act('Swim', 3.8, 90), act('Ride', 180, 400), act('Run', 42.2, 260)])).toBe(true);
  });

  it('brick = kolo a do 3 hodin běh', () => {
    const ride = act('Ride', 40, 90, '2026-10-20', 8);
    expect(brickDays([ride, act('Run', 5, 25, '2026-10-20', 10)])).toEqual(['2026-10-20']);
    expect(brickDays([ride, act('Run', 5, 25, '2026-10-20', 18)])).toEqual([]);
    expect(brickDays([ride, act('Run', 5, 25, '2026-10-20', 6)])).toEqual([]); // běh před kolem se nepočítá
  });

  it('týdenní objem a rekordy', () => {
    const acts = [act('Swim', 2, 45, '2026-10-20'), act('Run', 10, 50, '2026-10-21'), act('Run', 5, 30, '2026-10-22'), act('Run', 8, 40, '2026-10-12')];
    const w = weekVolume(acts, '2026-10-19');
    expect(w.run).toEqual({ count: 2, km: 15 });
    expect(w.swim.count).toBe(1);
    expect(w.hours).toBeCloseTo(125 / 60);
    const r = records(acts);
    expect(r.fastest10k?.distance).toBe(10_000);
    expect(r.fastest5k?.distance).toBe(10_000); // 5:00/km je rychlejší než 6:00/km
  });
});
