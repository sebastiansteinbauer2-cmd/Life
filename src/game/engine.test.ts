import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../data/store';
import { GameEngine, type GameEvent } from './engine';
import { computeStreak, longestStreak } from './streaks';
import { levelFromXp, titleForLevel, totalXpForLevel } from './xp';

function setup(date = new Date(2026, 9, 26, 12)) {
  let now = date;
  const engine = new GameEngine(new MemoryStore(), () => now);
  const events: GameEvent[] = [];
  engine.on((e) => events.push(e));
  return { engine, events, setNow: (d: Date) => (now = d) };
}

describe('levely', () => {
  it('XP na další level = 100 × level', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, needed: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, intoLevel: 0, needed: 200 });
    expect(levelFromXp(299).level).toBe(2);
    expect(levelFromXp(300).level).toBe(3);
    for (let l = 1; l < 40; l++) expect(levelFromXp(totalXpForLevel(l)).level).toBe(l);
  });
  it('tituly', () => {
    expect(titleForLevel(1)).toBe('Nováček');
    expect(titleForLevel(3)).toBe('Učeň');
    expect(titleForLevel(12)).toBe('Veterán');
    expect(titleForLevel(99)).toBe('Legenda');
  });
});

describe('streaky', () => {
  it('počítá sérii a toleruje dnešek bez aktivity', () => {
    const days = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    expect(computeStreak(days, '2026-10-25')).toMatchObject({ current: 4, start: '2026-10-22', activeToday: true });
    expect(computeStreak(days, '2026-10-26')).toMatchObject({ current: 4, activeToday: false });
    expect(computeStreak(days, '2026-10-27').current).toBe(0);
    expect(longestStreak([...days, '2026-10-01'])).toBe(4);
  });
});

describe('engine', () => {
  it('připisuje XP do statistiky a hlásí level up', async () => {
    const { engine, events } = setup();
    await engine.award({ amount: 120, stat: 'int', module: 'math', label: 'test' });
    const p = await engine.getProfile();
    expect(p.xp).toBe(120);
    expect(p.statXp.int).toBe(120);
    expect(events.some((e) => e.type === 'levelup' && e.level === 2)).toBe(true);
    expect(events.some((e) => e.type === 'achievement' && e.achievement.id === 'first-xp')).toBe(true);
  });

  it('quest s cílem 10 se splní jen jednou', async () => {
    const { engine } = setup();
    for (let i = 0; i < 12; i++) await engine.progressQuest('math-daily');
    const p = await engine.getProfile();
    expect(p.xp).toBe(25);
    await engine.progressQuest('math-daily', { setTo: 10 });
    expect((await engine.getProfile()).xp).toBe(25);
  });

  it('undo vrátí XP', async () => {
    const { engine } = setup();
    await engine.progressQuest('chess-puzzles');
    expect((await engine.getProfile()).xp).toBe(10);
    await engine.undoQuest('chess-puzzles');
    expect((await engine.getProfile()).xp).toBe(0);
  });

  it('bonus za 7denní sérii se připíše jednou', async () => {
    const { engine, setNow } = setup();
    for (let d = 1; d <= 9; d++) {
      setNow(new Date(2026, 9, d, 12));
      await engine.award({ amount: 10, stat: 'int', module: 'math', label: 'den' });
    }
    const log = await engine.store.col('xpLog').all();
    const bonuses = log.filter((e) => e.label.startsWith('Série 7'));
    expect(bonuses).toHaveLength(2); // celková + modulová
    expect(bonuses.reduce((n, e) => n + e.amount, 0)).toBe(75);
    expect((await engine.getProfile()).bestStreak).toBe(9);
  });
});
