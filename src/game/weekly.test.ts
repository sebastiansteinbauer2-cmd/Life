import { describe, expect, it } from 'vitest';
import type { XpEntry } from '../data/types';
import { backupDue, coinBalance, coinsEarned, pctChange, weekReport } from './weekly';

const xp = (date: string, amount: number, stat: XpEntry['stat'] = 'int', module: XpEntry['module'] = 'math'): XpEntry => ({
  id: `${date}-${amount}-${Math.random()}`, ts: new Date(`${date}T10:00:00`).getTime(), date, amount, stat, module, label: '',
});

describe('týdenní souhrn', () => {
  it('sečte týden po statistikách, modulech a dnech', () => {
    const log = [
      xp('2026-10-19', 30), xp('2026-10-19', 20, 'end', 'ironman'), xp('2026-10-21', 100, 'chess', 'chess'),
      xp('2026-10-25', 10, 'dis', 'core'), xp('2026-10-26', 999), xp('2026-10-18', 999),
    ];
    const progress = [{ id: 'a', questId: 'q', periodKey: 'x', count: 1, completedAt: new Date('2026-10-20T08:00:00').getTime() }];
    const ach = [{ id: 'first-xp', unlockedAt: new Date('2026-10-22T08:00:00').getTime() }, { id: 'old', unlockedAt: 0 }];
    const r = weekReport(log, progress, ach, '2026-10-19');
    expect(r.xp).toBe(160);
    expect(r.byStat).toMatchObject({ int: 30, end: 20, chess: 100, dis: 10 });
    expect(r.byModule).toEqual({ math: 30, ironman: 20, chess: 100, core: 10 });
    expect(r.activeDays).toBe(3);
    expect(r.bestDay).toEqual({ date: '2026-10-21', xp: 100 });
    expect(r.questsDone).toBe(1);
    expect(r.achievements).toEqual(['first-xp']);
    expect(r.daily).toHaveLength(7);
  });

  it('srovnání jen za stejný počet dní', () => {
    const log = [xp('2026-10-19', 50), xp('2026-10-22', 500)];
    expect(weekReport(log, [], [], '2026-10-19', 1).xp).toBe(50);
    expect(weekReport(log, [], [], '2026-10-19', 1).daily).toHaveLength(1);
    expect(weekReport(log, [], [], '2026-10-19').xp).toBe(550);
  });

  it('procentní změna', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(10, 0)).toBeNull();
  });
});

describe('zlaťáky a záloha', () => {
  it('1 zlaťák za 10 XP mínus nákupy', () => {
    expect(coinsEarned(1259)).toBe(125);
    expect(coinBalance(1259, [{ id: 'p', rewardId: 'r', title: '', icon: '', price: 100, ts: 0 }])).toBe(25);
  });

  it('připomínka zálohy', () => {
    const day = 86_400_000;
    const now = 100 * day;
    expect(backupDue(null, now - 1 * day, now)).toBe(false);
    expect(backupDue(null, now - 4 * day, now)).toBe(true);
    expect(backupDue(now - 2 * day, 0, now)).toBe(false);
    expect(backupDue(now - 8 * day, 0, now)).toBe(true);
  });
});
