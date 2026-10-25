import type { ChessGame, ChessResult, ChessTimeClass } from '../../data/types';

// Veřejné Chess.com PubAPI (bez přihlášení). Posílá hlavičku Access-Control-Allow-Origin: *,
// takže jde volat přímo z prohlížeče. Pro jistotu umíme i záložní proxy (api/chess.js na Vercelu).
const BASE = 'https://api.chess.com/pub/';

export async function fetchChess<T>(path: string, proxyUrl?: string): Promise<T> {
  try {
    const r = await fetch(BASE + path);
    if (r.status === 404) throw new Error('Hráč nenalezen – zkontroluj uživatelské jméno.');
    if (!r.ok) throw new Error(`Chess.com odpověděl chybou ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    // TypeError = síťová chyba / CORS → zkus proxy
    if (!(e instanceof TypeError) || !proxyUrl) throw e;
    const r = await fetch(`${proxyUrl.replace(/\/$/, '')}?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`Proxy odpověděla chybou ${r.status}`);
    return (await r.json()) as T;
  }
}

export interface RawSide { username: string; rating: number; result: string }
export interface RawGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string;
  rules: string;
  eco?: string;
  white: RawSide;
  black: RawSide;
}
export interface RawStats {
  chess_rapid?: { last: { rating: number } };
  chess_blitz?: { last: { rating: number } };
  chess_bullet?: { last: { rating: number } };
  chess_daily?: { last: { rating: number } };
  tactics?: { highest?: { rating: number } };
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

export function resultOf(code: string): ChessResult {
  if (code === 'win') return 'win';
  if (DRAWS.has(code)) return 'draw';
  return 'loss';
}

/** Název zahájení z URL typu https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Bg5 */
export function openingName(ecoUrl?: string): string {
  if (!ecoUrl) return 'Neznámé zahájení';
  const slug = decodeURIComponent(ecoUrl.split('/openings/')[1] ?? '').split('?')[0];
  if (!slug) return 'Neznámé zahájení';
  // odstraň tahy na konci (…-3.Nf3-Nc6)
  const words = slug.split('-');
  const cut = words.findIndex((w) => /^\d+\./.test(w) || /^\d+\.\.\./.test(w));
  return (cut > 0 ? words.slice(0, cut) : words).join(' ');
}

/** Rodina zahájení (např. „Sicilian Defense“) pro souhrnné statistiky. */
export function openingFamily(name: string): string {
  const m = /^(.*?\b(Defense|Defence|Opening|Game|Gambit|Attack|System))\b/.exec(name);
  return m ? m[1] : name.split(' ').slice(0, 2).join(' ');
}

export function parseGame(g: RawGame, username: string): ChessGame | null {
  if (g.rules !== 'chess') return null;
  const me = username.toLowerCase();
  const color = g.white.username.toLowerCase() === me ? 'white' : g.black.username.toLowerCase() === me ? 'black' : null;
  if (!color) return null;
  const mine = g[color];
  const opp = g[color === 'white' ? 'black' : 'white'];
  const eco = /\[ECO "([A-E]\d\d)"\]/.exec(g.pgn ?? '')?.[1] ?? '';
  const tc = (['rapid', 'blitz', 'bullet', 'daily'] as ChessTimeClass[]).includes(g.time_class as ChessTimeClass)
    ? (g.time_class as ChessTimeClass) : 'blitz';
  return {
    id: g.url,
    endTime: g.end_time * 1000,
    timeClass: tc,
    timeControl: g.time_control,
    rated: g.rated,
    color,
    result: resultOf(mine.result),
    myRating: mine.rating,
    opponent: opp.username,
    opponentRating: opp.rating,
    eco,
    opening: openingName(g.eco),
  };
}

const BASE_XP: Record<ChessTimeClass, number> = { rapid: 15, daily: 10, blitz: 6, bullet: 3 };

/** XP za partii: víc za rapid než blitz, bonus za výhru (+50 %), polovina za remízu. */
export function gameXp(g: Pick<ChessGame, 'timeClass' | 'result'>): number {
  const base = BASE_XP[g.timeClass];
  return g.result === 'win' ? Math.round(base * 1.5) : g.result === 'draw' ? Math.round(base * 1.2) : base;
}

export const RECORD_XP = 30;
export const ANALYSIS_XP = 20;

/** Partie, které se počítají do týdenního questu (15+10 nebo 30+0). */
export const isQuestRapid = (g: ChessGame) => g.timeClass === 'rapid' && (g.timeControl === '900+10' || g.timeControl === '1800');

/** Měsíční archivy, které je potřeba stáhnout (první synchronizace = posledních 6 měsíců). */
export function archivesToFetch(archives: string[], lastSync: number | null): string[] {
  if (!lastSync) return archives.slice(-6);
  const d = new Date(lastSync);
  const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return archives.filter((url) => url.slice(-7) >= key);
}

export interface Score { games: number; win: number; draw: number; loss: number; score: number }
export function scoreOf(games: ChessGame[]): Score {
  const win = games.filter((g) => g.result === 'win').length;
  const draw = games.filter((g) => g.result === 'draw').length;
  const loss = games.length - win - draw;
  return { games: games.length, win, draw, loss, score: games.length ? (win + draw / 2) / games.length : 0 };
}
