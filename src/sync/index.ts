// Synchronizace mezi zařízeními přes Supabase.
// Nastavení (adresa projektu a veřejný klíč) je jen v tomto zařízení (localStorage).
import { game, store } from '../app/context';
import { linkDevice, remoteCount, syncOnce, type SyncRemote } from './engine';
import { supabaseClient, supabaseRemote } from './supabase';

const KEY = 'questy.sync';

export type SyncConfig = { url: string; key: string; linked: boolean; lastPull: string | null; lastSync?: number };
export type SyncStatus = {
  state: 'off' | 'login' | 'unlinked' | 'idle' | 'syncing' | 'error';
  email?: string;
  lastSync?: number;
  error?: string;
};

export function loadConfig(): SyncConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SyncConfig | null;
    return c?.url && c.key ? c : null;
  } catch {
    return null;
  }
}

function saveConfig(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch { /* nevadí */ }
}

export function cleanUrl(url: string) {
  return url.trim().replace(/[.\s/]+$/, '').replace(/\/rest\/v1$/, '');
}

export function setServer(url: string, key: string) {
  const prev = loadConfig();
  const next = { url: cleanUrl(url), key: key.trim() };
  if (prev && prev.url === next.url && prev.key === next.key) return;
  saveConfig({ ...next, linked: false, lastPull: null });
  refresh();
}

// ---------- odkaz pro další zařízení ----------

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function shareLink(): string | null {
  const c = loadConfig();
  if (!c) return null;
  return `${location.origin}${location.pathname}#/sync?c=${b64(JSON.stringify({ u: c.url, k: c.key }))}`;
}

/** Zpracuje otevřený odkaz `#/sync?c=…`. Vrací true, když šlo o odkaz na synchronizaci. */
export function handleSyncLink(): boolean {
  const m = location.hash.match(/^#\/sync\?c=([\w-]+)/);
  if (!m) return false;
  try {
    const { u, k } = JSON.parse(unb64(m[1])) as { u: string; k: string };
    if (u && k) setServer(u, k);
  } catch { /* neplatný odkaz */ }
  history.replaceState(null, '', `${location.pathname}#/settings`);
  return true;
}

// ---------- stav ----------

let status: SyncStatus = { state: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

async function session() {
  const c = loadConfig();
  if (!c) return null;
  const client = await supabaseClient(c.url, c.key);
  const { data } = await client.auth.getSession();
  return data.session ? { c, client, user: data.session.user } : null;
}

async function remote(): Promise<{ r: SyncRemote; c: SyncConfig } | null> {
  const s = await session();
  return s ? { r: supabaseRemote(s.client, s.user.id), c: s.c } : null;
}

/** Zjistí aktuální stav (přihlášení, propojení) a případně rovnou synchronizuje. */
export async function refresh(): Promise<void> {
  const c = loadConfig();
  if (!c) return setStatus({ state: 'off' });
  try {
    const s = await session();
    if (!s) return setStatus({ state: 'login' });
    const email = s.user.email;
    if (!c.linked) return setStatus({ state: 'unlinked', email });
    setStatus({ state: 'idle', email, lastSync: c.lastSync });
    await syncNow();
  } catch (e) {
    setStatus({ ...status, state: 'error', error: (e as Error).message });
  }
}

// ---------- přihlášení ----------

const czech = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return 'Špatný e‑mail nebo heslo.';
  if (/email not confirmed/i.test(msg)) return 'E‑mail ještě není potvrzený – klikni na odkaz v e‑mailu od Supabase (nebo v Supabase vypni „Confirm email“).';
  if (/already registered/i.test(msg)) return 'Účet s tímto e‑mailem už existuje – přihlas se.';
  if (/password/i.test(msg) && /6|short|weak/i.test(msg)) return 'Heslo je moc krátké (aspoň 6 znaků).';
  if (/failed to fetch|network/i.test(msg)) return 'Nepodařilo se spojit se serverem – zkontroluj adresu projektu a internet.';
  if (/invalid api key|no api key|jwt/i.test(msg)) return 'Neplatný klíč – zkopíruj znovu „anon / publishable“ klíč ze Supabase.';
  if (/relation .* does not exist|could not find the table/i.test(msg)) return 'V Supabase chybí tabulka – spusť SQL z návodu (SQL Editor → Run).';
  return msg;
};

export async function signIn(email: string, password: string, create: boolean): Promise<string | null> {
  const c = loadConfig();
  if (!c) return 'Nejdřív vyplň adresu projektu a klíč.';
  try {
    const client = await supabaseClient(c.url, c.key);
    const res = create
      ? await client.auth.signUp({ email: email.trim(), password })
      : await client.auth.signInWithPassword({ email: email.trim(), password });
    if (res.error) return czech(res.error.message);
    if (create && !res.data.session) return 'Účet vytvořen ✓ Potvrď e‑mail (odkaz ti přišel do schránky) a pak se přihlas.';
    await refresh();
    return null;
  } catch (e) {
    return czech((e as Error).message);
  }
}

/** Odpojí toto zařízení (data v něm i v cloudu zůstanou). */
export async function signOut(): Promise<void> {
  const c = loadConfig();
  if (c) {
    try {
      await (await supabaseClient(c.url, c.key)).auth.signOut({ scope: 'local' });
    } catch { /* nevadí */ }
    saveConfig({ ...c, linked: false, lastPull: null });
  }
  await store.syncForget();
  setStatus({ state: c ? 'login' : 'off' });
}

/** Úplně zapomene nastavení synchronizace. */
export async function forgetServer(): Promise<void> {
  await signOut();
  saveConfig(null);
  setStatus({ state: 'off' });
}

// ---------- propojení a synchronizace ----------

export async function cloudCount(): Promise<number> {
  const x = await remote();
  if (!x) throw new Error('Nejsi přihlášený.');
  try {
    return await remoteCount(x.r);
  } catch (e) {
    throw new Error(czech((e as Error).message));
  }
}

export async function link(mode: 'download' | 'upload'): Promise<string | null> {
  const x = await remote();
  if (!x) return 'Nejsi přihlášený.';
  setStatus({ ...status, state: 'syncing' });
  try {
    const lastPull = await linkDevice(store, x.r, mode);
    await game.recomputeTotals();
    saveConfig({ ...x.c, linked: true, lastPull, lastSync: Date.now() });
    await refresh();
    return null;
  } catch (e) {
    const error = czech((e as Error).message);
    setStatus({ ...status, state: 'error', error });
    return error;
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Odešle a stáhne změny. Souběžná volání se spojí. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const x = await remote();
      if (!x) return setStatus({ state: loadConfig() ? 'login' : 'off' });
      if (!x.c.linked) return;
      if (!navigator.onLine) return setStatus({ ...status, state: 'error', error: 'Jsi offline – synchronizuje se po připojení.' });
      setStatus({ ...status, state: 'syncing' });
      try {
        const r = await syncOnce(store, x.r, x.c.lastPull);
        if (r.applied && (await game.recomputeTotals())) again = true;
        const lastSync = Date.now();
        saveConfig({ ...x.c, lastPull: r.cursor, lastSync });
        setStatus({ state: 'idle', email: status.email, lastSync });
      } catch (e) {
        setStatus({ ...status, state: 'error', error: czech((e as Error).message) });
        return;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let started = false;

/** Spustí automatickou synchronizaci: při startu, po změně dat, při návratu do aplikace a každé 2 minuty. */
export function startSync() {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (status.state === 'idle' || status.state === 'error') syncNow();
    }, ms);
  };
  store.subscribe(() => soon(3000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(300);
    else if (status.state === 'idle') syncNow(); // odeslat před odchodem
  });
  window.addEventListener('online', () => soon(500));
  setInterval(() => {
    if (document.visibilityState === 'visible') soon(0);
  }, 2 * 60_000);
  refresh();
}
