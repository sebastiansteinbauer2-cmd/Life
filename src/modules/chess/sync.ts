import { game, store } from '../../app/context';
import type { ChessGame } from '../../data/types';
import { dateKey, weekStart } from '../../lib/date';
import { parseDateKey } from '../../lib/date';
import {
  RECORD_XP, archivesToFetch, fetchChess, gameXp, isQuestRapid, parseGame, type RawGame, type RawStats,
} from './chessApi';

export interface SyncResult { newGames: number; xp: number; record: number | null; firstSync: boolean }

/** Stáhne nové partie a ratingy z Chess.com a připíše XP za partie od poslední synchronizace. */
export async function syncChess(): Promise<SyncResult> {
  const profile = await game.getProfile();
  const user = profile.chessUsername.trim();
  if (!user) throw new Error('Nejdřív zadej uživatelské jméno Chess.com v Nastavení.');
  const proxy = profile.chessProxyUrl || undefined;
  const lastSync = ((await store.col('meta').get('chessLastSync'))?.value as number | undefined) ?? null;

  const stats = await fetchChess<RawStats>(`player/${encodeURIComponent(user.toLowerCase())}/stats`, proxy);
  await store.col('chessRatings').put({
    id: dateKey(), ts: Date.now(),
    rapid: stats.chess_rapid?.last.rating, blitz: stats.chess_blitz?.last.rating,
    bullet: stats.chess_bullet?.last.rating, daily: stats.chess_daily?.last.rating,
    puzzles: stats.tactics?.highest?.rating,
  });

  const { archives } = await fetchChess<{ archives: string[] }>(`player/${encodeURIComponent(user.toLowerCase())}/games/archives`, proxy);
  const existing = await store.col('chessGames').all();
  const known = new Set(existing.map((g) => g.id));
  const prevMaxRapid = Math.max(0, ...existing.filter((g) => g.timeClass === 'rapid').map((g) => g.myRating));

  const fresh: ChessGame[] = [];
  for (const url of archivesToFetch(archives, lastSync)) {
    const path = url.split('/pub/')[1];
    const { games } = await fetchChess<{ games: RawGame[] }>(path, proxy);
    for (const raw of games) {
      const g = parseGame(raw, user);
      if (g && !known.has(g.id)) fresh.push(g);
    }
  }

  // XP jen za partie po poslední synchronizaci (první načtení je jen import historie)
  let xp = 0;
  const scoring = lastSync ? fresh.filter((g) => g.endTime > lastSync) : [];
  for (const g of scoring) {
    g.xp = gameXp(g);
    xp += g.xp;
  }
  if (fresh.length) await store.col('chessGames').bulkPut(fresh);

  const newMaxRapid = Math.max(0, ...scoring.filter((g) => g.timeClass === 'rapid').map((g) => g.myRating));
  const record = lastSync && prevMaxRapid && newMaxRapid > prevMaxRapid ? newMaxRapid : null;

  // značka = konec poslední známé partie, aby se žádná partie mezi synchronizacemi neztratila
  const latest = fresh.length ? Math.max(lastSync ?? 0, ...fresh.map((g) => g.endTime)) : (lastSync ?? Date.now());
  await store.col('meta').put({ id: 'chessLastSync', value: latest });

  if (xp) {
    const wins = scoring.filter((g) => g.result === 'win').length;
    await game.award({ amount: xp, stat: 'chess', module: 'chess', label: `${scoring.length} partií (${wins} výher)` });
  }
  if (record) await game.award({ amount: RECORD_XP, stat: 'chess', module: 'chess', label: `Rekordní rapid rating ${record}` });

  // týdenní quest: rapid 15+10 / 30+0 odehrané tento týden
  const monday = parseDateKey(weekStart()).getTime();
  const all = [...existing, ...fresh];
  const rapidThisWeek = all.filter((g) => g.endTime >= monday && isQuestRapid(g)).length;
  if (rapidThisWeek) await game.progressQuest('chess-rapid', { setTo: rapidThisWeek });
  else await game.checkAchievements();

  return { newGames: fresh.length, xp, record, firstSync: !lastSync };
}
