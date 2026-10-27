import { describe, expect, it } from 'vitest';
import { aiDepth, allMoves, attacked, bestMove, createBattle, fallen, H, movesOf, play, stars, type Battle, type Piece } from './battle';
import { CAMPS, buildingDef, unitDef } from './data';
import {
  applyBattle, balance, battleArmy, buffSum, canOpenChest, canTrain, canUpgrade, chestReward, collect, earned, finishUpgrade, lifeBuffs, newFort,
  normalizeFort, openChest, pending, resolveRaids, speedUp, speedUpCost, startUpgrade, train, unlockedCamp, type FortState,
} from './economy';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const stats = { int: 1, str: 1, dis: 1, chess: 1, end: 1 };
const rich = { wood: 99999, stone: 99999, crystal: 9999 };

/** Odehraje bitvu: hráče hraje AI s hloubkou `me`, nepřítele AI podle výpravy. */
function simulate(b0: Battle, campId: number, me = 2): Battle {
  let b = b0;
  while (!b.over) b = play(b, bestMove(b, b.toMove === 'me' ? me : aiDepth(campId))!);
  return b;
}
const fight = (fort: FortState, campId: number, me = 2) => simulate(createBattle(battleArmy(fort), CAMPS[campId - 1]), campId, me);

/** Malá ručně postavená bitva (bez kamenů). */
function mini(pieces: Omit<Piece, 'name' | 'icon'>[], toMove: 'me' | 'foe' = 'me'): Battle {
  return { pieces: pieces.map((p) => ({ ...p, name: p.kind, icon: '' })), captured: [], rocks: [], toMove, plies: 0, last: null, over: null, log: [] };
}

describe('pevnost – ekonomika', () => {
  it('suroviny z XP podle statistik', () => {
    expect(earned([{ amount: 50, stat: 'str' }, { amount: 30, stat: 'end' }, { amount: 40, stat: 'int' }, { amount: -10, stat: 'int' }, { amount: 7, stat: 'dis' }]))
      .toEqual({ wood: 80, stone: 30, crystal: 7 });
  });

  it('stavba s časovačem, jeden stavitel, limit podle Radnice a urychlení', () => {
    let s = newFort(NOW, '2026-10-26');
    const bal = rich;
    expect(canUpgrade(s, 'barracks', balance(s))).toEqual({ ok: true }); // startovní bonus stačí
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
    const s = { ...newFort(NOW, '2026-10-20'), raidChecked: '2026-10-20', delta: { wood: 2000, stone: 300, crystal: 50 } };
    const r = resolveRaids(s, new Set(['2026-10-20', '2026-10-22']), '2026-10-24');
    expect(r.raids.map((x) => x.date)).toEqual(['2026-10-21', '2026-10-23']);
    expect(r.state.raidChecked).toBe('2026-10-24');
    for (const x of r.raids.filter((y) => !y.win)) expect(x.stolen.crystal).toBe(0);
    const lost = r.raids.filter((y) => !y.win);
    if (lost.length) expect(balance(r.state).stone).toBeGreaterThanOrEqual(250);
    expect(resolveRaids(r.state, new Set(), '2026-10-24').raids).toHaveLength(0);
    expect(resolveRaids({ ...s, raidChecked: '2026-01-01', createdDate: '2026-01-01' }, new Set(), '2026-10-24').raids).toHaveLength(5);
  });

  it('nájezdy nezačnou před založením pevnosti', () => {
    const s = { ...newFort(NOW, '2026-10-24'), raidChecked: '2026-10-20' };
    expect(resolveRaids(s, new Set(), '2026-10-25').raids.map((x) => x.date)).toEqual(['2026-10-24']);
  });

  it('sbírání surovin z XP s bonusem sběrných budov', () => {
    let s = newFort(NOW, '2026-10-26', { wood: 500, stone: 100, crystal: 0 });
    expect(pending(s, { wood: 500, stone: 100, crystal: 0 })).toEqual({ wood: 0, stone: 0, crystal: 0 });
    const got = { wood: 600, stone: 150, crystal: 10 };
    expect(pending(s, got)).toEqual({ wood: 100, stone: 50, crystal: 10 });
    s = { ...s, buildings: { ...s.buildings, sawmill: 3 } };
    expect(pending(s, got).wood).toBe(120);
    const c = collect(s, got, NOW, 'wood');
    expect(balance(c).wood).toBe(150 + 120);
    expect(pending(c, got)).toEqual({ wood: 0, stone: 50, crystal: 10 });
    const all = collect(c, got, NOW);
    expect(balance(all)).toEqual({ wood: 270, stone: 200, crystal: 20 });
  });

  it('starší pevnost se převede bez ztráty surovin', () => {
    const old = { ...newFort(NOW, '2026-10-01'), collected: undefined, collectedAt: undefined, buildings: { hall: 2, barracks: 2, walls: 1, tower: 1, forge: 1, academy: 1, storage: 1 } } as unknown as FortState;
    const got = { wood: 300, stone: 200, crystal: 30 };
    const n = normalizeFort(old, got, NOW);
    expect(balance(n)).toEqual({ wood: 450, stone: 350, crystal: 40 });
    expect(n.buildings).toMatchObject({ hall: 2, sawmill: 1, quarry: 1, mine: 1 });
    expect(pending(n, got)).toEqual({ wood: 0, stone: 0, crystal: 0 });
    expect(normalizeFort(n, got, NOW)).toEqual(n);
  });

  it('denní truhla jen jednou a jen s dnešním XP', () => {
    const s = newFort(NOW, '2026-10-26');
    expect(canOpenChest(s, '2026-10-26', false)).toBe(false);
    expect(canOpenChest(s, '2026-10-26', true)).toBe(true);
    const o = openChest(s, '2026-10-26');
    expect(o.reward).toEqual(chestReward(1, '2026-10-26'));
    expect(o.reward.wood).toBeGreaterThanOrEqual(40);
    expect(canOpenChest(o.state, '2026-10-26', true)).toBe(false);
    expect(chestReward(5, '2026-10-26').wood).toBeGreaterThan(o.reward.wood);
  });

  it('posílení ze skutečného života', () => {
    const buffs = lifeBuffs({ trained: true, mind: true, discipline: true, streak: 8 });
    expect(buffs.map((b) => b.id)).toEqual(['trained', 'mind', 'dis', 'streak']);
    const s = { ...newFort(NOW, '2026-10-26'), army: { warrior: 1, archer: 1, mage: 0, knight: 0 } };
    expect(battleArmy(s).map((p) => p.kind)).toEqual(['hero', 'warrior', 'archer']);
    const boosted = battleArmy(s, buffs);
    expect(boosted.map((p) => p.kind)).toEqual(['hero', 'warrior', 'archer', 'warrior']);
    expect(boosted[3].temp).toBe(true);
    expect(boosted[0].rules).toEqual(['king2']);
    expect(buffSum(buffs, 'hints')).toBe(3);
    expect(buffSum(buffs, 'undos')).toBe(1);
    expect(lifeBuffs({ trained: false, mind: false, discipline: false, streak: 2 })).toEqual([]);
  });

  it('budovy učí figury nové tahy', () => {
    const s = newFort(NOW, '2026-10-26');
    const at = (b: Partial<FortState['buildings']>) => battleArmy({ ...s, buildings: { ...s.buildings, ...b }, army: { warrior: 1, archer: 1, mage: 1, knight: 1 } });
    expect(at({}).map((p) => p.rules)).toEqual([['king'], ['wazir'], ['bishop'], ['rook'], ['knight']]);
    expect(at({ forge: 6, academy: 7 }).map((p) => p.rules)).toEqual([['king'], ['king'], ['bishop', 'wazir'], ['queen'], ['knight', 'wazir']]);
    expect(at({ academy: 5 })[3].name).toBe('Arcimág');
  });
});

describe('pevnost – bitva (jako šachy)', () => {
  it('rozestavení: hráč dole, nepřítel nahoře, vůdce je nejcennější figura', () => {
    const b = createBattle(battleArmy({ ...newFort(NOW, '2026-10-26'), army: { warrior: 4, archer: 2, mage: 0, knight: 0 } }), CAMPS[2]);
    const me = b.pieces.filter((p) => p.side === 'me');
    expect(me.every((p) => p.y >= H - 2)).toBe(true);
    expect(me.find((p) => p.kind === 'hero')!.y).toBe(H - 1);
    expect(me.filter((p) => p.kind === 'warrior').every((p) => p.y === H - 2)).toBe(true);
    expect(b.pieces.filter((p) => p.side === 'foe').every((p) => p.y <= 1)).toBe(true);
    expect(b.pieces.find((p) => p.leader)!.kind).toBe('orc');
    expect(b.rocks.every((r) => !b.pieces.some((p) => `${p.x},${p.y}` === r))).toBe(true);
  });

  it('tahy figur: posuvné se zastaví o figury a kameny, jezdec přeskakuje', () => {
    const b = mini([
      { id: 'r', side: 'me', kind: 'mage', rules: ['rook'], x: 0, y: 7 },
      { id: 'w', side: 'me', kind: 'warrior', rules: ['wazir'], x: 0, y: 4 },
      { id: 'n', side: 'me', kind: 'knight', rules: ['knight'], x: 1, y: 7 },
      { id: 'blk', side: 'me', kind: 'warrior', rules: ['wazir'], x: 1, y: 6 },
      { id: 'f', side: 'foe', kind: 'goblin', rules: ['wazir'], x: 3, y: 7, leader: true },
    ]);
    const rook = movesOf(b, b.pieces[0]).map((m) => `${m.x},${m.y}`).sort();
    expect(rook).toEqual(['0,5', '0,6']); // vpravo blokuje jezdec, nahoru válečník
    const knight = movesOf(b, b.pieces[2]).map((m) => `${m.x},${m.y}`).sort();
    expect(knight).toEqual(['0,5', '2,5', '3,6']); // přes válečníka přeskočí
    const withRock = { ...b, rocks: ['0,6'] };
    expect(movesOf(withRock, withRock.pieces[0])).toHaveLength(0);
  });

  it('sebrání vůdce = výhra, sebrání hrdiny = prohra', () => {
    const b = mini([
      { id: 'h', side: 'me', kind: 'hero', rules: ['king'], x: 4, y: 7 },
      { id: 'r', side: 'me', kind: 'mage', rules: ['rook'], x: 0, y: 0 },
      { id: 'L', side: 'foe', kind: 'orc', rules: ['king'], x: 5, y: 0, leader: true },
      { id: 'g', side: 'foe', kind: 'goblin', rules: ['wazir'], x: 4, y: 6 },
    ]);
    const win = play(b, { id: 'r', x: 5, y: 0 });
    expect(win).toMatchObject({ over: 'win' });
    expect(win.captured.map((p) => p.id)).toEqual(['L']);
    const lose = play({ ...b, toMove: 'foe' }, { id: 'g', x: 4, y: 7 });
    expect(lose.over).toBe('lose');
    expect(attacked(b, b.pieces[0])).toBe(true);
  });

  it('AI vidí výhru a brání se', () => {
    // hráč může vzít vůdce hned – AI hráče to najde i s hloubkou 1
    const b = mini([
      { id: 'h', side: 'me', kind: 'hero', rules: ['king'], x: 4, y: 7 },
      { id: 'r', side: 'me', kind: 'mage', rules: ['rook'], x: 0, y: 3 },
      { id: 'L', side: 'foe', kind: 'orc', rules: ['king'], x: 6, y: 3, leader: true },
      { id: 'g', side: 'foe', kind: 'goblin', rules: ['wazir'], x: 2, y: 0 },
    ]);
    expect(bestMove(b, 1)).toEqual({ id: 'r', x: 6, y: 3 });
    // nepřítel na tahu se s hloubkou 2 dá z dosahu věže (neudělá tah, po kterém přijde o vůdce)
    const foeTurn = { ...b, toMove: 'foe' as const };
    const m = bestMove(foeTurn, 2)!;
    const after = play(foeTurn, m);
    const leader = after.pieces.find((p) => p.leader)!;
    expect(allMoves(after, 'me').some((mv) => mv.x === leader.x && mv.y === leader.y)).toBe(false);
  });

  it('hvězdy, ztráty a kořist', () => {
    const s = newFort(NOW, '2026-10-26');
    const b = fight(s, 1);
    expect(b.over).toBe('win');
    const r = applyBattle(s, CAMPS[0], b);
    expect(r.stars).toBe(stars(b, 4));
    expect(r.state.army.warrior).toBe(4 - fallen(b).length);
    expect(r.first).toBe(true);
    expect(r.loot.crystal).toBe(CAMPS[0].loot.crystal + 10);
    expect(unlockedCamp(r.state)).toBe(2);
    expect(applyBattle(r.state, CAMPS[0], b).loot.wood).toBe(Math.round(CAMPS[0].loot.wood * 0.4));
  });

  it('vyváženost: začátek jde vyhrát, drak se startovní armádou ne', () => {
    const start = newFort(NOW, '2026-10-26');
    expect(fight(start, 1).over).toBe('win');
    expect(fight(start, 2).over).toBe('win');
    expect(fight(start, 12).over).toBe('lose');
    const strong: FortState = {
      ...start,
      buildings: { ...start.buildings, hall: 8, barracks: 9, forge: 9, academy: 9 },
      army: { warrior: 3, archer: 3, mage: 3, knight: 3 },
    };
    expect(fight(strong, 10).over).toBe('win');
  }, 60_000);
});
