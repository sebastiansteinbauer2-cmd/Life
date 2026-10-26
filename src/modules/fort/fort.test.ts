import { describe, expect, it } from 'vitest';
import { attackUnit, autoTurn, createBattle, endTurn, H, moveUnit, reachable, stars, targetsFrom, type Battle } from './battle';
import { CAMPS, buildingDef, unitDef } from './data';
import {
  applyBattle, balance, battleArmy, canTrain, canUpgrade, earned, finishUpgrade, newFort, resolveRaids, speedUp, speedUpCost,
  startUpgrade, train, unlockedCamp, type FortState,
} from './economy';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const stats = { int: 1, str: 1, dis: 1, chess: 1, end: 1 };
const rich = { wood: 99999, stone: 99999, crystal: 9999 };

/** Odehraje bitvu za hráče pomocí AI. */
function simulate(b0: Battle): Battle {
  let b = b0;
  while (!b.over) b = endTurn(autoTurn(b));
  return b;
}

/** Podíl výher ze 40 pokusů. */
function winRate(fort: FortState, heroLevel: number, campId: number) {
  let wins = 0;
  for (let seed = 1; seed <= 40; seed++) if (simulate(createBattle(battleArmy(fort, heroLevel), CAMPS[campId - 1], seed)).over === 'win') wins++;
  return wins / 40;
}

describe('pevnost – ekonomika', () => {
  it('suroviny z XP podle statistik', () => {
    expect(earned([{ amount: 50, stat: 'str' }, { amount: 30, stat: 'end' }, { amount: 40, stat: 'int' }, { amount: -10, stat: 'int' }, { amount: 7, stat: 'dis' }]))
      .toEqual({ wood: 80, stone: 30, crystal: 7 });
  });

  it('stavba s časovačem, jeden stavitel, limit podle Radnice a urychlení', () => {
    let s = newFort(NOW, '2026-10-26');
    const bal = balance(s, rich);
    expect(canUpgrade(s, 'barracks', balance(s, { wood: 0, stone: 0, crystal: 0 }))).toEqual({ ok: true }); // startovní bonus stačí
    expect(canUpgrade({ ...s, delta: { wood: 0, stone: 0, crystal: 0 } }, 'barracks', { wood: 0, stone: 0, crystal: 0 })).toMatchObject({ ok: false, reason: 'Nemáš dost surovin.' });
    s = startUpgrade(s, 'barracks', bal, NOW);
    expect(s.upgrade).toMatchObject({ id: 'barracks', to: 2, endsAt: NOW + 5 * 60_000 });
    expect(s.delta.wood).toBe(150 - buildingDef('barracks').cost(2).wood);
    expect(canUpgrade(s, 'walls', bal)).toMatchObject({ ok: false });
    expect(finishUpgrade(s, NOW + 60_000).buildings.barracks).toBe(1);
    s = finishUpgrade(s, NOW + 5 * 60_000);
    expect(s.buildings.barracks).toBe(2);
    expect(canUpgrade(s, 'barracks', bal)).toMatchObject({ ok: false, reason: 'Nejdřív vylepši Radnici na level 2.' });
    s = startUpgrade(s, 'hall', bal, NOW);
    expect(speedUpCost(s, NOW)).toBe(1); // 5 min = 1 × započatých 15 min
    s = speedUp(s, bal, NOW);
    expect(s.buildings.hall).toBe(2);
  });

  it('výcvik hlídá kasárna, statistiky ze života a kapacitu', () => {
    let s = newFort(NOW, '2026-10-26');
    expect(canTrain(s, 'archer', rich, stats)).toMatchObject({ ok: false, reason: 'Potřebuješ Kasárna level 2.' });
    s = { ...s, buildings: { ...s.buildings, barracks: 3 } };
    expect(canTrain(s, 'archer', rich, stats)).toMatchObject({ ok: false });
    expect(canTrain(s, 'archer', rich, { ...stats, dis: 2 })).toEqual({ ok: true });
    s = train(s, 'warrior', rich, stats);
    expect(s.army.warrior).toBe(5);
    expect(s.delta.wood).toBe(150 - unitDef('warrior').cost.wood);
    s = { ...s, army: { ...s.army, warrior: 6 } };
    expect(canTrain(s, 'warrior', rich, stats)).toMatchObject({ ok: false, reason: 'Armáda je plná – vylepši Kasárna.' });
  });

  it('nájezdy jen za neaktivní dny, ochrana skladu, max 5 dní', () => {
    const s = { ...newFort(NOW, '2026-10-20'), raidChecked: '2026-10-20' };
    const got = { wood: 2000, stone: 300, crystal: 50 };
    const r = resolveRaids(s, got, new Set(['2026-10-20', '2026-10-22']), '2026-10-24');
    expect(r.raids.map((x) => x.date)).toEqual(['2026-10-21', '2026-10-23']);
    expect(r.state.raidChecked).toBe('2026-10-24');
    for (const x of r.raids.filter((y) => !y.win)) expect(x.stolen.crystal).toBe(0);
    const lost = r.raids.filter((y) => !y.win);
    if (lost.length) expect(balance(r.state, got).stone).toBeGreaterThanOrEqual(250);
    expect(resolveRaids(r.state, got, new Set(), '2026-10-24').raids).toHaveLength(0);
    expect(resolveRaids({ ...s, raidChecked: '2026-01-01', createdDate: '2026-01-01' }, got, new Set(), '2026-10-24').raids).toHaveLength(5);
  });

  it('nájezdy nezačnou před založením pevnosti', () => {
    const s = { ...newFort(NOW, '2026-10-24'), raidChecked: '2026-10-20' };
    expect(resolveRaids(s, rich, new Set(), '2026-10-25').raids.map((x) => x.date)).toEqual(['2026-10-24']);
  });
});

describe('pevnost – bitva', () => {
  it('rozestavení, pohyb a útok', () => {
    const b = createBattle(battleArmy(newFort(NOW, '2026-10-26'), 5), CAMPS[0], 7);
    const me = b.units.filter((u) => u.side === 'me');
    expect(me.every((u) => u.y >= H - 2)).toBe(true);
    expect(b.units.filter((u) => u.side === 'foe').every((u) => u.y <= 1)).toBe(true);
    const hero = me[0];
    expect(reachable(b, hero).length).toBeGreaterThan(1);
    expect(targetsFrom(b, hero)).toHaveLength(0);
    // nedosažitelné pole se ignoruje
    expect(moveUnit(b, hero.id, 0, 0)).toBe(b);
    const b2 = moveUnit(b, hero.id, hero.x, hero.y - 3);
    expect(b2.units[0]).toMatchObject({ y: hero.y - 3, moved: true });
    expect(moveUnit(b2, hero.id, hero.x, hero.y - 1)).toBe(b2);
    // útok mimo dosah nic neudělá
    expect(attackUnit(b2, hero.id, b2.units.find((u) => u.side === 'foe')!.id)).toBe(b2);
    const b3 = endTurn(b2);
    expect(b3.turn).toBe(2);
    expect(b3.units.every((u) => !u.moved && !u.acted)).toBe(true);
  });

  it('hvězdy a padlí', () => {
    const s = newFort(NOW, '2026-10-26');
    const b = simulate(createBattle(battleArmy(s, 5), CAMPS[0], 3));
    expect(b.over).toBe('win');
    const r = applyBattle(s, CAMPS[0], b);
    expect(r.stars).toBe(stars(b));
    expect(r.first).toBe(true);
    expect(r.loot.crystal).toBe(CAMPS[0].loot.crystal + 10);
    expect(unlockedCamp(r.state)).toBe(2);
    const again = applyBattle(r.state, CAMPS[0], b);
    expect(again.first).toBe(false);
    expect(again.loot.wood).toBe(Math.round(CAMPS[0].loot.wood * 0.4));
  });

  it('vyváženost: začátek jde vyhrát, drak se startovní armádou ne', () => {
    const start = newFort(NOW, '2026-10-26');
    expect(winRate(start, 3, 1)).toBeGreaterThanOrEqual(0.9);
    expect(winRate(start, 3, 12)).toBe(0);
    // silná pevnost na drakovi má šanci
    const strong: FortState = {
      ...start,
      buildings: { ...start.buildings, hall: 8, barracks: 9, forge: 9, academy: 9 },
      army: { warrior: 3, archer: 3, mage: 3, knight: 3 },
    };
    expect(winRate(strong, 25, 12)).toBeGreaterThan(0.5);
  });
});
