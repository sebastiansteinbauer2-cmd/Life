// Klient Stravy. Tokeny se ukládají jen v tomto zařízení (localStorage) – nejsou v exportu zálohy.
// Výměnu a obnovu tokenů dělá tvůj Vercel server (api/strava.js), protože potřebuje klientské tajemství.

export interface StravaTokens { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number; firstname?: string } }

const KEY = 'questy.strava';

export function loadTokens(): StravaTokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StravaTokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(t: StravaTokens | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    // úložiště nedostupné
  }
}

export class StravaError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

/** Po návratu ze Stravy: přečte tokeny / chybu z URL (#/ironman?strava=…) a URL vyčistí. */
export function consumeCallback(): { ok: boolean; error?: string } | null {
  const q = location.hash.split('?')[1];
  if (!q) return null;
  const params = new URLSearchParams(q);
  const enc = params.get('strava');
  const err = params.get('strava_error');
  if (!enc && !err) return null;
  history.replaceState(null, '', `${location.pathname}${location.search}#/ironman`);
  if (err) return { ok: false, error: err };
  try {
    const b64 = enc!.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
    saveTokens(JSON.parse(json) as StravaTokens);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Odpověď ze Stravy se nepodařilo přečíst.' };
  }
}

export async function serverConfigured(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/api/strava?action=config`);
    return r.ok && ((await r.json()) as { configured: boolean }).configured;
  } catch {
    return false;
  }
}

/** Adresa, kam se po přihlášení vrátit (aktuální aplikace). */
export const appReturnUrl = () => `${location.origin}${location.pathname}`;
export const loginUrl = (base: string) => `${base}/api/strava?action=login&return=${encodeURIComponent(appReturnUrl())}`;

async function freshToken(base: string): Promise<string> {
  const t = loadTokens();
  if (!t) throw new StravaError('Nejdřív propoj Stravu.');
  if (t.expires_at * 1000 > Date.now() + 60_000) return t.access_token;
  const r = await fetch(`${base}/api/strava?action=refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh_token }),
  });
  if (!r.ok) throw new StravaError('Přihlášení ke Stravě vypršelo – propoj ji znovu.', r.status);
  const n = (await r.json()) as Pick<StravaTokens, 'access_token' | 'refresh_token' | 'expires_at'>;
  saveTokens({ ...t, ...n });
  return n.access_token;
}

export interface RawActivity {
  id: number;
  name: string;
  sport_type?: string;
  type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
}

/** Aktivity od data `after` (unix s), stránkuje po 100. */
export async function fetchActivities(base: string, after: number, maxPages = 5): Promise<RawActivity[]> {
  const out: RawActivity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const token = await freshToken(base);
    let r: Response;
    try {
      r = await fetch(`${base}/api/strava?action=activities&after=${after}&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new StravaError('Nepodařilo se spojit se serverem. Jsi online?');
    }
    if (r.status === 401) throw new StravaError('Strava odmítla přístup – propoj ji znovu.', 401);
    if (r.status === 429) throw new StravaError('Strava teď omezuje počet dotazů, zkus to za 15 minut.', 429);
    if (!r.ok) throw new StravaError(`Strava odpověděla chybou ${r.status}.`, r.status);
    const list = (await r.json()) as RawActivity[];
    out.push(...list);
    if (list.length < 100) break;
  }
  return out;
}
