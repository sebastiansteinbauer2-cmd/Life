// Strategická bitva jako šachy: deska 8 × 8, žádná náhoda ani životy.
// Figuru sebereš vstupem na její pole. Vyhraješ sebráním nepřátelského vůdce 👑,
// prohraješ, když padne tvůj hrdina (nebo nemáš žádný tah).
import { ENEMIES, type Camp } from './data';

export const W = 8;
export const H = 8;
/** Po tolika tazích (obou stran) bitva končí – útočník nedobyl tábor. */
export const MAX_PLIES = 120;

export type RuleId = 'wazir' | 'ferz' | 'king' | 'king2' | 'rook' | 'rook3' | 'bishop' | 'bishop3' | 'queen' | 'knight';

type Dir = [number, number];
const ORTHO: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT: Dir[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

export const RULES: Record<RuleId, { dirs: Dir[]; range: number; jump?: boolean; text: string; value: number }> = {
  wazir: { dirs: ORTHO, range: 1, text: 'o 1 pole rovně', value: 1.5 },
  ferz: { dirs: DIAG, range: 1, text: 'o 1 pole šikmo', value: 1.5 },
  king: { dirs: [...ORTHO, ...DIAG], range: 1, text: 'o 1 pole kamkoli (jako král)', value: 3 },
  king2: { dirs: [...ORTHO, ...DIAG], range: 2, text: 'o 1–2 pole kamkoli', value: 4.5 },
  rook: { dirs: ORTHO, range: 8, text: 'rovně libovolně daleko (jako věž)', value: 5 },
  rook3: { dirs: ORTHO, range: 3, text: 'rovně až o 3 pole', value: 3.5 },
  bishop: { dirs: DIAG, range: 8, text: 'šikmo libovolně daleko (jako střelec)', value: 3.5 },
  bishop3: { dirs: DIAG, range: 3, text: 'šikmo až o 3 pole', value: 2.5 },
  queen: { dirs: [...ORTHO, ...DIAG], range: 8, text: 'kamkoli libovolně daleko (jako dáma)', value: 9 },
  knight: { dirs: KNIGHT, range: 1, jump: true, text: 'skokem do L, přes figury (jako jezdec)', value: 3 },
};

export const pieceValue = (rules: RuleId[]) => rules.reduce((n, r) => n + RULES[r].value, 0) * (rules.length > 1 ? 0.8 : 1);
export const rulesText = (rules: RuleId[]) => rules.map((r) => RULES[r].text).join(' + ');

export interface Piece {
  id: string;
  side: 'me' | 'foe';
  kind: string; // UnitId | 'hero' | EnemyId
  name: string;
  icon: string;
  rules: RuleId[];
  x: number;
  y: number;
  leader?: boolean; // nepřátelský vůdce – jeho sebráním bitva končí
  temp?: boolean; // posila jen na tuto bitvu (neztrácí se z armády)
}

export interface Move { id: string; x: number; y: number }

export interface Battle {
  pieces: Piece[]; // jen živé figury
  captured: Piece[];
  rocks: string[]; // 'x,y'
  toMove: 'me' | 'foe';
  plies: number;
  last: { from: { x: number; y: number }; to: { x: number; y: number }; capture?: string } | null;
  over: 'win' | 'lose' | null;
  reason?: string;
  log: string[];
}

export interface ArmyPiece { kind: string; name: string; icon: string; rules: RuleId[]; temp?: boolean }

const key = (x: number, y: number) => `${x},${y}`;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

/** Kameny a stromy z výpravy (navrženo pro mřížku 7 × 9) převedené na desku 8 × 8. */
const rocksFor = (camp: Camp) => [...new Set(camp.rocks.map(([x, y]) => key(Math.min(W - 1, x + (x >= 4 ? 1 : 0)), y <= 3 ? 3 : 4)))];

/** Rozestavení: dlouhé figury a hrdina vzadu, krátké vepředu – od středu do stran. */
function place(list: ArmyPiece[], back: number, front: number): { x: number; y: number }[] {
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const used = new Set<string>();
  const take = (rows: number[]) => {
    for (const r of rows) for (const x of order) if (!used.has(key(x, r))) { used.add(key(x, r)); return { x, y: r }; }
    throw new Error('Na desku se nevejde tolik figur');
  };
  const isBack = (p: ArmyPiece) => p.kind === 'hero' || p.rules.some((r) => RULES[r].range > 1 || RULES[r].jump);
  // nejdřív zadní řada (hrdina první, aby stál uprostřed), pak přední
  const res = new Array<{ x: number; y: number }>(list.length);
  list.forEach((p, i) => { if (isBack(p)) res[i] = take([back, front]); });
  list.forEach((p, i) => { if (!isBack(p)) res[i] = take([front, back]); });
  return res;
}

export function createBattle(army: ArmyPiece[], camp: Camp): Battle {
  const foes: ArmyPiece[] = camp.enemies.map((id) => ({ kind: id, name: ENEMIES[id].name, icon: ENEMIES[id].icon, rules: ENEMIES[id].rules }));
  const leaderIdx = foes.reduce((best, f, i) => (pieceValue(f.rules) > pieceValue(foes[best].rules) ? i : best), 0);
  const mePos = place(army, H - 1, H - 2);
  const foePos = place(foes, 0, 1);
  const pieces: Piece[] = [
    ...army.map((p, i) => ({ ...p, id: `me${i}`, side: 'me' as const, ...mePos[i] })),
    ...foes.map((p, i) => ({ ...p, id: `foe${i}`, side: 'foe' as const, ...foePos[i], leader: i === leaderIdx })),
  ];
  const occupied = new Set(pieces.map((p) => key(p.x, p.y)));
  return {
    pieces, captured: [], rocks: rocksFor(camp).filter((r) => !occupied.has(r)), toMove: 'me', plies: 0, last: null, over: null, log: [],
  };
}

type Board = { at: Map<string, Piece>; rocks: Set<string> };
const boardOf = (b: Battle): Board => ({ at: new Map(b.pieces.map((q) => [key(q.x, q.y), q])), rocks: new Set(b.rocks) });

function genMoves(bd: Board, p: Piece, out: Move[]) {
  const seen = new Set<string>();
  for (const r of p.rules) {
    const rule = RULES[r];
    for (const [dx, dy] of rule.dirs) {
      for (let k = 1; k <= rule.range; k++) {
        const x = p.x + dx * k;
        const y = p.y + dy * k;
        if (!inside(x, y)) break;
        const kk = key(x, y);
        if (bd.rocks.has(kk)) break;
        const q = bd.at.get(kk);
        if (q?.side === p.side) break;
        if (!seen.has(kk)) {
          seen.add(kk);
          out.push({ id: p.id, x, y });
        }
        if (q || rule.jump) break;
      }
    }
  }
}

/** Všechny tahy figury (včetně braní). */
export function movesOf(b: Battle, p: Piece): Move[] {
  const out: Move[] = [];
  genMoves(boardOf(b), p, out);
  return out;
}

export function allMoves(b: Battle, side: 'me' | 'foe'): Move[] {
  const bd = boardOf(b);
  const out: Move[] = [];
  for (const p of b.pieces) if (p.side === side) genMoves(bd, p, out);
  return out;
}

/** Je figura ohrožená (může ji soupeř hned sebrat)? */
export function attacked(b: Battle, p: Piece): boolean {
  const other = p.side === 'me' ? 'foe' : 'me';
  return allMoves(b, other).some((m) => m.x === p.x && m.y === p.y);
}

/** Provede tah (bez kontroly pravidel – volající bere tahy z movesOf). */
export function play(b0: Battle, m: Move): Battle {
  const p0 = b0.pieces.find((q) => q.id === m.id)!;
  const victim = b0.pieces.find((q) => q.x === m.x && q.y === m.y);
  const pieces = b0.pieces.filter((q) => q !== victim).map((q) => (q.id === m.id ? { ...q, x: m.x, y: m.y } : q));
  const b: Battle = {
    ...b0, pieces, captured: victim ? [...b0.captured, victim] : b0.captured,
    toMove: b0.toMove === 'me' ? 'foe' : 'me', plies: b0.plies + 1,
    last: { from: { x: p0.x, y: p0.y }, to: { x: m.x, y: m.y }, capture: victim?.id },
    log: [...b0.log.slice(-40), `${p0.icon} ${p0.name}${victim ? ` bere ${victim.icon} ${victim.name}` : ` → ${String.fromCharCode(97 + m.x)}${H - m.y}`}`],
  };
  if (victim?.leader) return { ...b, over: 'win', reason: `${victim.name} 👑 padl – tábor dobyt!` };
  if (victim?.kind === 'hero') return { ...b, over: 'lose', reason: 'Tvůj hrdina padl.' };
  if (!allMoves(b, b.toMove).length) {
    return { ...b, over: b.toMove === 'me' ? 'lose' : 'win', reason: b.toMove === 'me' ? 'Nemáš žádný tah.' : 'Nepřítel nemá kam táhnout.' };
  }
  if (b.plies >= MAX_PLIES) return { ...b, over: 'lose', reason: 'Došel čas – tábor se ubránil.' };
  return b;
}

// ---------- AI ----------
// Prohledávání alfa-beta nad zjednodušeným stavem (bez zápisu tahů), ať je AI rychlá i na telefonu.

const LEADER = 1000;
const WIN = 100_000;
const valueOf = (p: Piece) => (p.leader || p.kind === 'hero' ? LEADER : pieceValue(p.rules));

interface S { pieces: Piece[]; rocks: Set<string>; toMove: 'me' | 'foe'; plies: number; end: 'me' | 'foe' | null }

function sMoves(s: S, side: 'me' | 'foe'): Move[] {
  const bd: Board = { at: new Map(s.pieces.map((q) => [key(q.x, q.y), q])), rocks: s.rocks };
  const out: Move[] = [];
  for (const p of s.pieces) if (p.side === side) genMoves(bd, p, out);
  // braní nejcennějších figur první – alfa-beta pak víc řeže
  const score = (m: Move) => {
    const v = bd.at.get(key(m.x, m.y));
    return v ? valueOf(v) * 10 - valueOf(s.pieces.find((q) => q.id === m.id)!) : 0;
  };
  return out.map((m) => ({ m, v: score(m) })).sort((a, c) => c.v - a.v).map((x) => x.m);
}

function sPlay(s: S, m: Move): S {
  const victim = s.pieces.find((q) => q.x === m.x && q.y === m.y);
  const pieces = s.pieces.filter((q) => q !== victim).map((q) => (q.id === m.id ? { ...q, x: m.x, y: m.y } : q));
  const end = victim?.leader ? 'me' : victim?.kind === 'hero' ? 'foe' : null; // kdo vyhrál
  return { pieces, rocks: s.rocks, toMove: s.toMove === 'me' ? 'foe' : 'me', plies: s.plies + 1, end };
}

/** Hodnocení z pohledu strany na tahu: materiál a postup vpřed. */
function sEval(s: S): number {
  const side = s.toMove;
  let v = 0;
  for (const p of s.pieces) {
    const val = valueOf(p) === LEADER ? 0 : valueOf(p);
    const adv = p.side === 'me' ? (H - 1 - p.y) * 0.04 : p.y * 0.04;
    const center = 0.03 * (3.5 - Math.abs(p.x - 3.5));
    v += (p.side === side ? 1 : -1) * (val + adv + center);
  }
  return v;
}

function negamax(s: S, depth: number, alpha: number, beta: number): number {
  if (s.end) return (s.end === s.toMove ? WIN : -WIN) + (s.end === s.toMove ? -s.plies : s.plies);
  if (depth === 0) return sEval(s);
  const moves = sMoves(s, s.toMove);
  if (!moves.length) return -WIN + s.plies; // bez tahu = prohra
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(sPlay(s, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Nejlepší tah pro stranu na tahu (hloubka = kolik tahů dopředu AI přemýšlí). */
export function bestMove(b: Battle, depth: number): Move | null {
  const s: S = { pieces: b.pieces, rocks: new Set(b.rocks), toMove: b.toMove, plies: b.plies, end: null };
  let best: Move | null = null;
  let alpha = -Infinity;
  for (const m of sMoves(s, s.toMove)) {
    const v = -negamax(sPlay(s, m), depth - 1, -Infinity, -alpha);
    if (v > alpha || !best) {
      alpha = v;
      best = m;
    }
  }
  return best;
}

/** Jak hluboko přemýšlí soupeř na dané výpravě. */
export const aiDepth = (campId: number) => (campId <= 3 ? 1 : campId <= 7 ? 2 : 3);

/** Hvězdy za výhru: 3 = nikdo nepadl, 2 = padla nejvýš polovina, 1 = výhra. */
export function stars(b: Battle, armyCount: number): number {
  if (b.over !== 'win') return 0;
  const lost = b.captured.filter((p) => p.side === 'me').length;
  return lost === 0 ? 3 : lost <= armyCount / 2 ? 2 : 1;
}

/** Kdo z hráčovy armády padl (kromě hrdiny a dočasných posil). */
export const fallen = (b: Battle) => b.captured.filter((p) => p.side === 'me' && p.kind !== 'hero' && !p.temp).map((p) => p.kind);
