// Tahová bitva na mřížce 7 × 9. Hráč dole, nepřátelé nahoře.
// Každá jednotka se za tah může jednou pohnout a jednou zaútočit (útokem tah končí).
// Všechny akce zapisují události (pohyb, útok, smrt…), podle kterých UI přehrává animace.
import { ENEMIES, campScale, type Camp, type UnitStats } from './data';

export const W = 7;
export const H = 9;
export const MAX_TURNS = 30;
export const HERO_COOLDOWN = 3;

export interface BUnit extends UnitStats {
  id: string;
  side: 'me' | 'foe';
  kind: string; // UnitId | 'hero' | EnemyId
  name: string;
  icon: string;
  maxHp: number;
  x: number;
  y: number;
  moved: boolean;
  acted: boolean;
  steps: number; // kolik polí ušla tento tah (rytíř: nájezd)
  cd: number; // hrdina: kolik kol zbývá do další schopnosti
}

export type Fx = 'melee' | 'arrow' | 'magic' | 'fire' | 'strike';
export type BattleEvent =
  | { t: 'move'; id: string; x: number; y: number }
  | { t: 'hit'; id: string; target: string; dmg: number; fx: Fx; crit?: boolean; note?: string }
  | { t: 'heal'; id: string; amount: number }
  | { t: 'death'; id: string };

export interface Battle {
  units: BUnit[];
  rocks: string[]; // 'x,y'
  turn: number;
  log: string[];
  events: BattleEvent[];
  over: 'win' | 'lose' | null;
  seed: number;
}

export interface ArmyUnit { kind: string; name: string; icon: string; stats: UnitStats }

/** Schopnosti jednotek – popisy pro UI. */
export const TRAITS: Record<string, string> = {
  hero: `⚡ Mocný úder: dvojnásobné poškození cíli a polovina nepřátelům kolem (jednou za ${HERO_COOLDOWN} kola)`,
  warrior: '🛡️ Štít: o 30 % menší poškození od střelců a kouzel',
  archer: '🎯 Odstřelovač: +30 % poškození na cíl 3 pole daleko',
  mage: '🔥 Ohnivá koule: zasáhne i nepřátele vedle cíle (50 %)',
  knight: '🐎 Nájezd: +50 % poškození, když se předtím pohne aspoň o 3 pole',
  troll: '💚 Regenerace: každé kolo si vyléčí 10 % životů',
  dragon: '🔥 Dračí dech: zasáhne i jednotky vedle cíle (50 %)',
  shaman: '✨ Léčitel: když nemá na koho útočit, vyléčí spojence',
  darkKnight: '🐎 Nájezd: +50 % poškození po pohybu o 3 pole',
};

/** Deterministický generátor (mulberry32) – stav je v bitvě, takže jde bitvu uložit a obnovit. */
export function rand(b: Battle): number {
  b.seed = (b.seed + 0x6d2b79f5) | 0;
  let t = b.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const key = (x: number, y: number) => `${x},${y}`;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const alive = (b: Battle, side?: BUnit['side']) => b.units.filter((u) => u.hp > 0 && (!side || u.side === side));
export const unitAt = (b: Battle, x: number, y: number) => b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
const clone = (b: Battle): Battle => structuredClone(b);

/** Rozestavení do řad: bojovníci na blízko vepředu, střelci vzadu, od středu do stran. */
function place(list: ArmyUnit[], front: number, back: number, rocks: Set<string>): { x: number; y: number }[] {
  const order = [3, 2, 4, 1, 5, 0, 6];
  const used = new Set<string>();
  const take = (row: number, alt: number) => {
    for (const r of [row, alt]) {
      for (const x of order) {
        if (!used.has(key(x, r)) && !rocks.has(key(x, r))) {
          used.add(key(x, r));
          return { x, y: r };
        }
      }
    }
    throw new Error('Na bojiště se nevejde tolik jednotek');
  };
  return list.map((u) => (u.stats.range > 1 ? take(back, front) : take(front, back)));
}

export function createBattle(army: ArmyUnit[], camp: Camp, seed = Date.now()): Battle {
  const rocks = new Set(camp.rocks.map(([x, y]) => key(x, y)));
  const k = campScale(camp.id);
  const foes: ArmyUnit[] = camp.enemies.map((id) => {
    const e = ENEMIES[id];
    return { kind: id, name: e.name, icon: e.icon, stats: { ...e, hp: Math.round(e.hp * k.hp), atk: Math.round(e.atk * k.atk) } };
  });
  const mePos = place(army, H - 2, H - 1, rocks);
  const foePos = place(foes, 1, 0, rocks);
  const mk = (u: ArmyUnit, side: BUnit['side'], i: number, p: { x: number; y: number }): BUnit => ({
    id: `${side}${i}`, side, kind: u.kind, name: u.name, icon: u.icon,
    hp: u.stats.hp, maxHp: u.stats.hp, atk: u.stats.atk, move: u.stats.move, range: u.stats.range,
    x: p.x, y: p.y, moved: false, acted: false, steps: 0, cd: 0,
  });
  return {
    units: [...army.map((u, i) => mk(u, 'me', i, mePos[i])), ...foes.map((u, i) => mk(u, 'foe', i, foePos[i]))],
    rocks: [...rocks], turn: 1, log: [], events: [], over: null, seed,
  };
}

/** Pole, kam se jednotka může tento tah dostat (včetně místa, kde stojí). */
export function reachable(b: Battle, u: BUnit): { x: number; y: number; d: number }[] {
  if (u.moved || u.acted) return [{ x: u.x, y: u.y, d: 0 }];
  const rocks = new Set(b.rocks);
  const seen = new Map<string, number>([[key(u.x, u.y), 0]]);
  const queue = [{ x: u.x, y: u.y, d: 0 }];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.d === u.move) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      const k = key(nx, ny);
      if (!inside(nx, ny) || rocks.has(k) || seen.has(k) || unitAt(b, nx, ny)) continue;
      seen.set(k, c.d + 1);
      queue.push({ x: nx, y: ny, d: c.d + 1 });
    }
  }
  return [...seen.entries()].map(([k, d]) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y, d };
  });
}

/** Nepřátelé v dosahu z daného místa. */
export function targetsFrom(b: Battle, u: BUnit, x = u.x, y = u.y): BUnit[] {
  return alive(b).filter((t) => t.side !== u.side && dist(t, { x, y }) <= u.range);
}

function checkOver(b: Battle) {
  if (!alive(b, 'foe').length) b.over = 'win';
  else if (!alive(b, 'me').length) b.over = 'lose';
}

function log(b: Battle, line: string) {
  b.log.push(line);
  if (b.log.length > 60) b.log.splice(0, b.log.length - 60);
}

const fxOf = (u: BUnit): Fx => (u.kind === 'mage' || u.kind === 'shaman' ? 'magic' : u.kind === 'dragon' ? 'fire' : u.range > 1 ? 'arrow' : 'melee');

/** Poškození jednoho zásahu (schopnosti, kritický zásah, štít). */
function damage(b: Battle, a: BUnit, t: BUnit, mult: number): { dmg: number; crit: boolean; note?: string } {
  let m = mult * (0.85 + rand(b) * 0.3);
  let note: string | undefined;
  if ((a.kind === 'knight' || a.kind === 'darkKnight') && a.steps >= 3) {
    m *= 1.5;
    note = 'Nájezd!';
  }
  if (a.kind === 'archer' && dist(a, t) >= 3) {
    m *= 1.3;
    note = 'Přesná střela!';
  }
  if (t.kind === 'warrior' && a.range > 1) m *= 0.7;
  const crit = rand(b) < 0.1;
  if (crit) m *= 1.5;
  return { dmg: Math.max(1, Math.round(a.atk * m)), crit, note };
}

function applyHit(b: Battle, a: BUnit, t: BUnit, mult: number, fx: Fx) {
  const { dmg, crit, note } = damage(b, a, t, mult);
  t.hp = Math.max(0, t.hp - dmg);
  b.events.push({ t: 'hit', id: a.id, target: t.id, dmg, fx, crit, note });
  log(b, `${a.icon} ${a.name} → ${t.icon} ${t.name}: −${dmg}${crit ? ' (kritický zásah!)' : ''}${note ? ` (${note})` : ''}${t.hp === 0 ? ' ☠️' : ''}`);
  if (t.hp === 0) b.events.push({ t: 'death', id: t.id });
}

/** Útok včetně plošného poškození (mág, drak, Mocný úder). */
function strike(b: Battle, a: BUnit, t: BUnit, power = false) {
  const splash = power || a.kind === 'mage' || a.kind === 'dragon';
  const around = splash ? alive(b).filter((o) => o.side === t.side && o.id !== t.id && dist(o, t) === 1) : [];
  applyHit(b, a, t, power ? 2 : 1, power ? 'strike' : fxOf(a));
  for (const o of around) applyHit(b, a, o, power ? 0.5 : 0.5, power ? 'strike' : fxOf(a));
}

/** Pohyb hráčovy jednotky. */
export function moveUnit(b0: Battle, id: string, x: number, y: number): Battle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id)!;
  const to = reachable(b, u).find((p) => p.x === x && p.y === y);
  if (b.over || u.side !== 'me' || !to) return b0;
  u.x = x;
  u.y = y;
  u.steps = to.d;
  u.moved = true;
  b.events.push({ t: 'move', id, x, y });
  return b;
}

/** Útok hráčovy jednotky – tím její tah končí. `power` = Mocný úder hrdiny. */
export function attackUnit(b0: Battle, id: string, targetId: string, power = false): Battle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id)!;
  const t = b.units.find((v) => v.id === targetId)!;
  if (b.over || u.side !== 'me' || u.acted || u.hp <= 0 || t.hp <= 0 || dist(u, t) > u.range) return b0;
  if (power && (u.kind !== 'hero' || u.cd > 0)) return b0;
  strike(b, u, t, power);
  if (power) u.cd = HERO_COOLDOWN;
  u.acted = true;
  u.moved = true;
  checkOver(b);
  return b;
}

/** Tah jedné jednotky podle jednoduché AI: zaútoč, nebo se přibliž a zaútoč. */
function aiAct(b: Battle, u: BUnit) {
  const enemies = alive(b).filter((t) => t.side !== u.side);
  if (!enemies.length || u.acted) return;
  const weakest = (list: BUnit[]) => list.sort((p, q) => p.hp - q.hp || dist(u, p) - dist(u, q))[0];
  let targets = targetsFrom(b, u);
  if (!targets.length && !u.moved) {
    // nejlepší pole: odkud dosáhne na cíl (střelci co nejdál), jinak co nejblíž k nejbližšímu nepříteli
    const options = reachable(b, u).map((p) => {
      const inRange = enemies.filter((t) => dist(t, p) <= u.range);
      const near = Math.min(...enemies.map((t) => dist(t, p)));
      return { p, score: inRange.length ? 1000 + (u.range > 1 ? near : -near) + p.d * 0.01 : -near };
    });
    options.sort((a, c) => c.score - a.score);
    const best = options[0].p;
    if (best.x !== u.x || best.y !== u.y) {
      u.x = best.x;
      u.y = best.y;
      u.steps = best.d;
      b.events.push({ t: 'move', id: u.id, x: u.x, y: u.y });
    }
    targets = targetsFrom(b, u);
  }
  u.moved = true;
  if (targets.length) {
    const t = weakest(targets);
    // hrdina za AI použije Mocný úder, když je připravený
    strike(b, u, t, u.kind === 'hero' && u.cd === 0);
    if (u.kind === 'hero' && u.cd === 0) u.cd = HERO_COOLDOWN;
    u.acted = true;
  } else if (u.kind === 'shaman') {
    // šaman bez cíle léčí nejzraněnějšího spojence
    const hurt = alive(b, u.side).filter((o) => o.hp < o.maxHp).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
    if (hurt) {
      const amount = Math.min(hurt.maxHp - hurt.hp, Math.round(u.atk * 1.2));
      hurt.hp += amount;
      b.events.push({ t: 'heal', id: hurt.id, amount });
      log(b, `${u.icon} ${u.name} léčí ${hurt.icon} ${hurt.name}: +${amount}`);
      u.acted = true;
    }
  }
}

/** Pořadí nepřátel v jejich tahu (zepředu dozadu). */
export const enemyOrder = (b: Battle) => alive(b, 'foe').sort((p, q) => q.y - p.y).map((u) => u.id);

/** Tah jednoho nepřítele (pro animované přehrávání). */
export function enemyStep(b0: Battle, id: string): Battle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id);
  if (!u || u.hp <= 0 || b.over) return b0;
  aiAct(b, u);
  checkOver(b);
  return b;
}

/** Začátek nového kola: regenerace, odpočet schopností, reset tahů. */
export function newRound(b0: Battle): Battle {
  const b = clone(b0);
  if (b.over) return b;
  for (const u of b.units) {
    u.moved = false;
    u.acted = false;
    u.steps = 0;
    if (u.cd > 0) u.cd--;
    if (u.kind === 'troll' && u.hp > 0 && u.hp < u.maxHp) {
      const amount = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * 0.1));
      u.hp += amount;
      b.events.push({ t: 'heal', id: u.id, amount });
    }
  }
  b.turn++;
  if (b.turn > MAX_TURNS) {
    b.over = 'lose';
    log(b, '⏳ Došel čas – nepřátelé se ubránili.');
  }
  return b;
}

/** Konec tahu hráče najednou: táhnou všichni nepřátelé a začne další kolo. */
export function endTurn(b0: Battle): Battle {
  let b = b0;
  if (b.over) return b;
  for (const id of enemyOrder(b)) b = enemyStep(b, id);
  return newRound(b);
}

/** Celý tah hráče za AI (pro test vyváženosti a tlačítko „Auto“). */
export function autoTurn(b0: Battle): Battle {
  const b = clone(b0);
  for (const u of alive(b, 'me').sort((p, q) => p.y - q.y)) {
    if (b.over) break;
    aiAct(b, u);
    checkOver(b);
  }
  return b;
}

/** Hvězdy za výhru: 1 = výhra, 2 = přežila aspoň polovina, 3 = nikdo nepadl. */
export function stars(b: Battle): number {
  if (b.over !== 'win') return 0;
  const mine = b.units.filter((u) => u.side === 'me');
  const lost = mine.filter((u) => u.hp <= 0).length;
  return lost === 0 ? 3 : lost <= mine.length / 2 ? 2 : 1;
}

/** Kdo z hráčovy armády padl (kromě hrdiny). */
export const fallen = (b: Battle) => b.units.filter((u) => u.side === 'me' && u.hp <= 0 && u.kind !== 'hero').map((u) => u.kind);
