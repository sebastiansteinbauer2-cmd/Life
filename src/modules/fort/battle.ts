// Tahová bitva na mřížce 7 × 9. Hráč dole, nepřátelé nahoře.
// Každá jednotka se za tah může jednou pohnout a jednou zaútočit (útokem tah končí).
import { ENEMIES, campScale, type Camp, type UnitStats } from './data';

export const W = 7;
export const H = 9;
export const MAX_TURNS = 30;

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
}

export interface Battle {
  units: BUnit[];
  rocks: string[]; // 'x,y'
  turn: number;
  log: string[];
  over: 'win' | 'lose' | null;
  seed: number;
}

export interface ArmyUnit { kind: string; name: string; icon: string; stats: UnitStats }

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
    x: p.x, y: p.y, moved: false, acted: false,
  });
  return {
    units: [...army.map((u, i) => mk(u, 'me', i, mePos[i])), ...foes.map((u, i) => mk(u, 'foe', i, foePos[i]))],
    rocks: [...rocks], turn: 1, log: [], over: null, seed,
  };
}

/** Pole, kam se jednotka může tento tah dostat (včetně místa, kde stojí). */
export function reachable(b: Battle, u: BUnit): { x: number; y: number }[] {
  if (u.moved || u.acted) return [{ x: u.x, y: u.y }];
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
  return [...seen.keys()].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
}

/** Nepřátelé v dosahu z daného místa. */
export function targetsFrom(b: Battle, u: BUnit, x = u.x, y = u.y): BUnit[] {
  return alive(b).filter((t) => t.side !== u.side && dist(t, { x, y }) <= u.range);
}

const clone = (b: Battle): Battle => structuredClone(b);

function checkOver(b: Battle) {
  if (!alive(b, 'foe').length) b.over = 'win';
  else if (!alive(b, 'me').length) b.over = 'lose';
}

function hit(b: Battle, a: BUnit, t: BUnit) {
  const dmg = Math.max(1, Math.round(a.atk * (0.85 + rand(b) * 0.3)));
  t.hp = Math.max(0, t.hp - dmg);
  b.log.push(`${a.icon} ${a.name} → ${t.icon} ${t.name}: −${dmg}${t.hp === 0 ? ' ☠️' : ''}`);
  if (b.log.length > 60) b.log.splice(0, b.log.length - 60);
}

/** Pohyb hráčovy jednotky. */
export function moveUnit(b0: Battle, id: string, x: number, y: number): Battle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id)!;
  if (b.over || u.side !== 'me' || !reachable(b, u).some((p) => p.x === x && p.y === y)) return b0;
  u.x = x;
  u.y = y;
  u.moved = true;
  return b;
}

/** Útok hráčovy jednotky – tím její tah končí. */
export function attackUnit(b0: Battle, id: string, targetId: string): Battle {
  const b = clone(b0);
  const u = b.units.find((v) => v.id === id)!;
  const t = b.units.find((v) => v.id === targetId)!;
  if (b.over || u.side !== 'me' || u.acted || u.hp <= 0 || t.hp <= 0 || dist(u, t) > u.range) return b0;
  hit(b, u, t);
  u.acted = true;
  u.moved = true;
  checkOver(b);
  return b;
}

/** Tah jedné jednotky podle jednoduché AI: zaútoč, nebo se přibliž a zaútoč. */
function aiAct(b: Battle, u: BUnit) {
  const enemies = alive(b).filter((t) => t.side !== u.side);
  if (!enemies.length) return;
  const weakest = (list: BUnit[]) => list.sort((p, q) => p.hp - q.hp || dist(u, p) - dist(u, q))[0];
  let targets = targetsFrom(b, u);
  if (!targets.length) {
    // nejlepší pole: odkud dosáhne na cíl (střelci co nejdál), jinak co nejblíž k nejbližšímu nepříteli
    const options = reachable(b, u).map((p) => {
      const inRange = enemies.filter((t) => dist(t, p) <= u.range);
      const near = Math.min(...enemies.map((t) => dist(t, p)));
      return { p, score: inRange.length ? 1000 + (u.range > 1 ? near : -near) : -near };
    });
    options.sort((a, c) => c.score - a.score);
    u.x = options[0].p.x;
    u.y = options[0].p.y;
    targets = targetsFrom(b, u);
  }
  u.moved = true;
  if (targets.length) {
    hit(b, u, weakest(targets));
    u.acted = true;
  }
}

/** Konec tahu hráče: táhnou nepřátelé, pak začne další kolo. */
export function endTurn(b0: Battle): Battle {
  const b = clone(b0);
  if (b.over) return b;
  for (const f of alive(b, 'foe').sort((p, q) => q.y - p.y)) {
    if (b.over) break;
    aiAct(b, f);
    checkOver(b);
  }
  for (const u of b.units) {
    u.moved = false;
    u.acted = false;
  }
  if (!b.over) {
    b.turn++;
    if (b.turn > MAX_TURNS) {
      b.over = 'lose';
      b.log.push('⏳ Došel čas – nepřátelé se ubránili.');
    }
  }
  return b;
}

/** Celý tah hráče za AI (pro test vyváženosti a tlačítko „Automaticky“). */
export function autoTurn(b0: Battle): Battle {
  const b = clone(b0);
  for (const u of alive(b, 'me').sort((p, q) => p.y - q.y)) {
    if (b.over) break;
    if (u.acted) continue;
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
