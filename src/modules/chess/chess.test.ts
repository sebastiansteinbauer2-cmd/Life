import { describe, expect, it } from 'vitest';
import { archivesToFetch, gameXp, openingFamily, openingName, parseGame, resultOf, scoreOf, type RawGame } from './chessApi';

const raw: RawGame = {
  url: 'https://www.chess.com/game/live/1',
  pgn: '[Event "Live Chess"]\n[ECO "B90"]\n1. e4 c5',
  time_control: '900+10',
  end_time: 1_760_000_000,
  rated: true,
  time_class: 'rapid',
  rules: 'chess',
  eco: 'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Bg5-e6',
  white: { username: 'Soupeř', rating: 1900, result: 'checkmated' },
  black: { username: 'Ja_Hrac', rating: 1950, result: 'win' },
};

describe('Chess.com', () => {
  it('rozpozná barvu, výsledek, ECO a zahájení', () => {
    const g = parseGame(raw, 'ja_hrac')!;
    expect(g).toMatchObject({ color: 'black', result: 'win', myRating: 1950, opponentRating: 1900, eco: 'B90', timeClass: 'rapid' });
    expect(g.opening).toBe('Sicilian Defense Najdorf Variation');
    expect(openingFamily(g.opening)).toBe('Sicilian Defense');
    expect(g.endTime).toBe(1_760_000_000_000);
  });

  it('ignoruje varianty a cizí partie', () => {
    expect(parseGame({ ...raw, rules: 'chess960' }, 'ja_hrac')).toBeNull();
    expect(parseGame(raw, 'nekdo')).toBeNull();
  });

  it('výsledky a XP', () => {
    expect(resultOf('repetition')).toBe('draw');
    expect(resultOf('timeout')).toBe('loss');
    expect(gameXp({ timeClass: 'rapid', result: 'win' })).toBeGreaterThan(gameXp({ timeClass: 'blitz', result: 'win' }));
    expect(gameXp({ timeClass: 'rapid', result: 'win' })).toBeGreaterThan(gameXp({ timeClass: 'rapid', result: 'loss' }));
  });

  it('názvy zahájení', () => {
    expect(openingName('https://www.chess.com/openings/Queens-Gambit-Declined-3.Nc3')).toBe('Queens Gambit Declined');
    expect(openingFamily('Queens Gambit Declined')).toBe('Queens Gambit');
    expect(openingName(undefined)).toBe('Neznámé zahájení');
  });

  it('vybírá archivy od poslední synchronizace', () => {
    const a = ['2026/06', '2026/07', '2026/08', '2026/09', '2026/10'].map((m) => `https://api.chess.com/pub/player/x/games/${m}`);
    expect(archivesToFetch(a, Date.UTC(2026, 8, 15))).toHaveLength(2);
    expect(archivesToFetch(a, null)).toHaveLength(5);
  });

  it('skóre', () => {
    const g = parseGame(raw, 'ja_hrac')!;
    expect(scoreOf([g, { ...g, result: 'draw' }, { ...g, result: 'loss' }]).score).toBeCloseTo(0.5);
  });
});
