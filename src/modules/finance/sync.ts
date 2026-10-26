import { game, store } from '../../app/context';
import type { FinanceDividend, FinanceTx, FinanceTxType } from '../../data/types';
import { dateKey, monthKey } from '../../lib/date';
import {
  DIVIDEND_XP, MILESTONE_XP, STREAK_MONTH_BONUSES, depositXp, milestoneIndex, monthStreak, netByMonth,
} from './logic';
import {
  loadCreds, nextPageParams, t212, T212Error,
  type Page, type RawCash, type RawDividend, type RawInfo, type RawPosition, type RawTx,
} from './t212Api';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TX_TYPES: FinanceTxType[] = ['DEPOSIT', 'WITHDRAW', 'FEE', 'TRANSFER'];
// Historie má limit 6 dotazů za minutu
const HISTORY_GAP_MS = 10_500;

export interface FinanceSyncResult {
  firstSync: boolean;
  newDeposits: number;
  newDividends: number;
  xp: number;
  milestones: number;
}

async function readMeta<T>(id: string, fallback: T): Promise<T> {
  return ((await store.col('meta').get(id))?.value as T | undefined) ?? fallback;
}

export async function syncFinance(onProgress: (msg: string) => void = () => undefined): Promise<FinanceSyncResult> {
  const creds = loadCreds();
  if (!creds?.key) throw new T212Error('Nejdřív zadej API klíč Trading 212.');
  const profile = await game.getProfile();
  const proxy = profile.financeProxyUrl || undefined;
  const lastSync = await readMeta<number | null>('financeLastSync', null);
  const firstSync = !lastSync;

  onProgress('Načítám účet…');
  const info = await t212<RawInfo>('equity/account/info', {}, creds, proxy);
  await sleep(1100);
  const cash = await t212<RawCash>('equity/account/cash', {}, creds, proxy);
  await sleep(1100);
  onProgress('Načítám pozice…');
  const portfolio = await t212<RawPosition[]>('equity/portfolio', {}, creds, proxy);
  const currency = info.currencyCode;

  await store.col('financeSnapshots').put({
    id: dateKey(), ts: Date.now(), currency,
    total: cash.total, invested: cash.invested, ppl: cash.ppl, free: cash.free,
    positions: portfolio.map((p) => ({
      ticker: p.ticker, quantity: p.quantity, averagePrice: p.averagePrice, currentPrice: p.currentPrice, ppl: p.ppl,
    })),
  });

  // Historie vkladů – stránkuj, dokud nenarazíš na už známý záznam
  const knownTx = new Set((await store.col('financeTx').all()).map((t) => t.id));
  const freshTx: FinanceTx[] = [];
  let params: Record<string, string | number | undefined> | null = { limit: 50 };
  for (let page = 0; params && page < (firstSync ? 4 : 2); page++) {
    if (page) await sleep(HISTORY_GAP_MS);
    onProgress(`Načítám vklady${page ? ` (strana ${page + 1})` : ''}…`);
    const res: Page<RawTx> = await t212<Page<RawTx>>('history/transactions', params, creds, proxy);
    let hitKnown = false;
    for (const t of res.items) {
      if (knownTx.has(t.reference)) { hitKnown = true; continue; }
      if (!TX_TYPES.includes(t.type as FinanceTxType)) continue;
      freshTx.push({ id: t.reference, type: t.type as FinanceTxType, amount: t.amount, ts: Date.parse(t.dateTime) });
    }
    params = hitKnown ? null : nextPageParams(res.nextPagePath);
  }

  await sleep(HISTORY_GAP_MS);
  onProgress('Načítám dividendy…');
  const knownDiv = new Set((await store.col('financeDividends').all()).map((d) => d.id));
  const divPage = await t212<Page<RawDividend>>('history/dividends', { limit: 50 }, creds, proxy);
  const freshDiv: FinanceDividend[] = divPage.items
    .filter((d) => !knownDiv.has(d.reference))
    .map((d) => ({ id: d.reference, ticker: d.ticker, amount: d.amount, ts: Date.parse(d.paidOn) }));

  if (freshTx.length) await store.col('financeTx').bulkPut(freshTx);
  if (freshDiv.length) await store.col('financeDividends').bulkPut(freshDiv);

  // XP jen za novinky od poslední synchronizace (první načtení = import historie)
  let xp = 0;
  const goal = profile.financeGoal;
  const newDeposits = firstSync ? [] : freshTx.filter((t) => t.type === 'DEPOSIT' && t.ts > (lastSync ?? 0));
  const depXp = newDeposits.reduce((s, t) => s + depositXp(Math.abs(t.amount), goal), 0);
  if (depXp) {
    await game.award({ amount: depXp, stat: 'dis', module: 'finance', label: `Investice: ${newDeposits.length}× vklad` });
    xp += depXp;
  }
  const newDivs = firstSync ? [] : freshDiv;
  if (newDivs.length) {
    await game.award({ amount: DIVIDEND_XP * newDivs.length, stat: 'dis', module: 'finance', label: `Dividendy: ${newDivs.length}×` });
    xp += DIVIDEND_XP * newDivs.length;
  }

  // Milníky hodnoty portfolia
  const idx = milestoneIndex(cash.total, currency);
  const prevIdx = await readMeta<number | null>('financeMilestone', null);
  let milestones = 0;
  if (prevIdx === null || idx > prevIdx) {
    if (prevIdx !== null) {
      milestones = idx - prevIdx;
      await game.award({ amount: MILESTONE_XP * milestones, stat: 'dis', module: 'finance', label: 'Nový milník portfolia' });
      xp += MILESTONE_XP * milestones;
    }
    await store.col('meta').put({ id: 'financeMilestone', value: idx });
  }

  // Měsíční quest a série měsíců
  const allTx = await store.col('financeTx').all();
  const byMonth = netByMonth(allTx);
  if ((byMonth[monthKey()] ?? 0) >= goal) await game.progressQuest('finance-monthly', { setTo: 1 });
  const streak = monthStreak(byMonth, goal);
  const best = await readMeta<number>('financeBestStreak', 0);
  if (streak.current > best) await store.col('meta').put({ id: 'financeBestStreak', value: streak.current });
  for (const b of STREAK_MONTH_BONUSES) {
    if (streak.current < b.months || !streak.start) continue;
    const key = `finStreak:${b.months}:${streak.start}`;
    if (await store.col('meta').get(key)) continue;
    await store.col('meta').put({ id: key, value: Date.now() });
    await game.award({ amount: b.xp, stat: 'dis', module: 'finance', label: `Investuješ ${b.months} měsíců v řadě` });
    xp += b.xp;
  }

  await store.col('meta').put({ id: 'financeLastSync', value: Date.now() });
  await game.checkAchievements();
  return { firstSync, newDeposits: newDeposits.length, newDividends: newDivs.length, xp, milestones };
}
