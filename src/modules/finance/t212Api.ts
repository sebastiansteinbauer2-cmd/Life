// Klient veřejného API Trading 212 (https://t212public-api-docs.redoc.ly/).
// Klíč je jen pro čtení a ukládá se pouze v tomto zařízení (localStorage) –
// NENÍ součástí exportované zálohy ani budoucí cloudové synchronizace.

export type T212Env = 'live' | 'demo';
export interface T212Creds { key: string; secret: string; env: T212Env }

const CREDS_KEY = 'questy.t212';

export function loadCreds(): T212Creds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? (JSON.parse(raw) as T212Creds) : null;
  } catch {
    return null;
  }
}

export function saveCreds(c: T212Creds | null) {
  try {
    if (c) localStorage.setItem(CREDS_KEY, JSON.stringify(c));
    else localStorage.removeItem(CREDS_KEY);
  } catch {
    // úložiště nedostupné (anonymní okno) – klíč se nezapamatuje
  }
}

/** Novější klíče mají i „secret“ (HTTP Basic), starší stačí poslat samotné. */
export const authHeader = (c: T212Creds) => (c.secret ? `Basic ${btoa(`${c.key}:${c.secret}`)}` : c.key);

export class T212Error extends Error {
  constructor(message: string, public cors = false, public status = 0) {
    super(message);
  }
}

/** Které oprávnění klíče potřebuje daný endpoint (pro srozumitelné chybové hlášky). */
function permissionFor(path: string): string {
  if (path.includes('dividends')) return 'History - Dividends';
  if (path.includes('transactions')) return 'History - Transactions';
  if (path.includes('positions') || path.includes('portfolio')) return 'Portfolio';
  return 'Account data';
}

type Params = Record<string, string | number | undefined>;

const qs = (p: Params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

async function handle<T>(r: Response, path: string): Promise<T> {
  if (r.status === 401) {
    throw new T212Error('Trading 212 nepřijal klíč (401). Zkontroluj, že máš vložený celý API key i API secret, bez mezer a ze stejného páru.', false, 401);
  }
  if (r.status === 403) {
    throw new T212Error(`Klíči chybí oprávnění „${permissionFor(path)}“ (403 u ${path}). Vytvoř nový klíč s tímto oprávněním.`, false, 403);
  }
  if (r.status === 429) throw new T212Error('Trading 212 omezuje počet dotazů. Zkus synchronizaci znovu za minutu.', false, 429);
  if (!r.ok) throw new T212Error(`Trading 212 odpověděl chybou ${r.status} (${path}).`, false, r.status);
  return (await r.json()) as T;
}

/**
 * GET na API Trading 212. Nejdřív zkusí přímé volání z prohlížeče;
 * pokud ho prohlížeč zablokuje (CORS), použije proxy (api/t212.js na Vercelu).
 */
export async function t212<T>(path: string, params: Params, creds: T212Creds, proxyUrl?: string): Promise<T> {
  const headers = { Authorization: authHeader(creds) };
  try {
    return await handle<T>(await fetch(`https://${creds.env}.trading212.com/api/v0/${path}${qs(params)}`, { headers }), path);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    if (!proxyUrl) {
      throw new T212Error('Trading 212 nedovolí přímé spojení z telefonu. Nasaď proxy na Vercel a vlož její adresu v Nastavení propojení (je tam návod).', true);
    }
    const url = `${proxyUrl.replace(/\/$/, '')}${qs({ ...params, path, env: creds.env })}`;
    try {
      return await handle<T>(await fetch(url, { headers }), path);
    } catch (e2) {
      if (e2 instanceof TypeError) throw new T212Error('Nepodařilo se spojit s proxy. Jsi online a je adresa proxy správně?');
      throw e2;
    }
  }
}

/**
 * Zkusí cesty postupně – Trading 212 v roce 2025 přejmenoval endpointy
 * (např. equity/portfolio → equity/positions), starší cesta je záloha při 404.
 */
export async function t212First<T>(paths: string[], params: Params, creds: T212Creds, proxyUrl?: string): Promise<{ path: string; data: T }> {
  let last: unknown;
  for (const path of paths) {
    try {
      return { path, data: await t212<T>(path, params, creds, proxyUrl) };
    } catch (e) {
      last = e;
      if (!(e instanceof T212Error) || (e.status !== 404 && e.status !== 400)) throw e;
    }
  }
  throw last;
}

/** Nové API: GET equity/account/summary */
export interface RawSummary {
  id: number;
  currency: string;
  totalValue: number;
  cash: { availableToTrade: number; reservedForOrders?: number; inPies?: number };
  investments: { currentValue: number; totalCost: number; realizedProfitLoss?: number; unrealizedProfitLoss: number };
}

/** Nové API: GET equity/positions */
export interface RawPositionV2 {
  averagePricePaid: number;
  currentPrice: number;
  quantity: number;
  instrument: { ticker: string; name?: string; currency?: string; isin?: string };
  walletImpact?: { currency?: string; currentValue?: number; totalCost?: number; unrealizedProfitLoss?: number; fxImpact?: number };
}

export interface RawCash { free: number; total: number; ppl: number; result: number; invested: number; pieCash?: number; blocked?: number }
export interface RawInfo { currencyCode: string; id: number }
export interface RawPosition { ticker: string; quantity: number; averagePrice: number; currentPrice: number; ppl: number; fxPpl?: number }
export interface RawTx { type: string; amount: number; reference: string; dateTime: string }
export interface RawDividend { ticker: string; amount: number; reference: string; paidOn: string }
export interface Page<T> { items: T[]; nextPagePath: string | null }

/** Z "/api/v0/history/transactions?limit=50&cursor=…" vytáhne parametry další stránky. */
export function nextPageParams(nextPagePath: string | null | undefined): Params | null {
  if (!nextPagePath) return null;
  const q = nextPagePath.split('?')[1];
  if (!q) return null;
  return Object.fromEntries(new URLSearchParams(q).entries());
}
