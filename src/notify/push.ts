// Připomínky přes notifikace. Odesílá je tvůj Supabase (kontrola každých 10 min)
// přes funkci api/push na tvém Vercelu – chodí i když je aplikace zavřená.
import { czech, session } from '../sync';
import { TABLE } from '../sync/supabase';

const KEY = 'questy.push';

export type PushSettings = { enabled: boolean; evening: number | null; morning: number | null };
export const DEFAULT_PUSH: PushSettings = { enabled: false, evening: 20, morning: null };

export function loadPush(): PushSettings {
  try {
    return { ...DEFAULT_PUSH, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_PUSH;
  }
}

function savePush(s: PushSettings & { day?: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* nevadí */ }
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

type Vapid = { publicKey: string; privateKey: string };

/** Nový pár klíčů VAPID (P‑256) – vytvoří se jednou a sdílí ho všechna tvoje zařízení. */
export async function generateVapid(): Promise<Vapid> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('raw', pair.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64url(pub), privateKey: jwk.d! };
}

async function ctx() {
  const s = await session();
  if (!s) throw new Error('Nejdřív zapni synchronizaci (Nastavení → Synchronizace zařízení) – připomínky posílá tvůj cloud.');
  return s;
}

async function vapidKeys(): Promise<Vapid> {
  const { client, user } = await ctx();
  const { data, error } = await client.from(TABLE).select('data').eq('col', 'pushKeys').eq('id', 'vapid').eq('deleted', false).maybeSingle();
  if (error) throw new Error(czech(error.message));
  if (data?.data) return data.data as Vapid;
  const keys = await generateVapid();
  const res = await client.from(TABLE).upsert({ user_id: user.id, col: 'pushKeys', id: 'vapid', data: keys, deleted: false, client_ts: Date.now() }, { onConflict: 'user_id,col,id' });
  if (res.error) throw new Error(czech(res.error.message));
  return keys;
}

/** Zapne nebo aktualizuje připomínky na tomto zařízení. */
export async function enablePush(settings: Omit<PushSettings, 'enabled'>, extra: { relay: string | null; name: string }): Promise<void> {
  if (!pushSupported()) throw new Error('Tento prohlížeč notifikace neumí. Na Androidu použij Chrome a appku si nainstaluj na plochu.');
  if (!extra.relay) throw new Error('Chybí adresa Vercel serveru (Nastavení → Server).');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifikace nejsou povolené. Povol je v nastavení telefonu: Aplikace → Questy / Chrome → Oznámení.');
  const { client, user } = await ctx();
  const keys = await vapidKeys();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const current = sub?.options.applicationServerKey;
  if (sub && (!current || b64url(current) !== keys.publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(keys.publicKey) });
  } catch (e) {
    const m = (e as Error).message;
    if (/permission/i.test(m)) throw new Error('Prohlížeč notifikace odmítl. Povol je: Nastavení telefonu → Aplikace → Chrome (a Questy) → Oznámení.');
    throw new Error(`Nepodařilo se přihlásit k notifikacím (${m}). Zkontroluj internet a aktualizuj Chrome.`);
  }
  const data = {
    subscription: sub.toJSON(), relay: extra.relay, name: extra.name,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague',
    evening: settings.evening, morning: settings.morning,
  };
  const { error } = await client.from(TABLE).upsert({ user_id: user.id, col: 'push', id: sub.endpoint, data, deleted: false, client_ts: Date.now() }, { onConflict: 'user_id,col,id' });
  if (error) throw new Error(czech(error.message));
  savePush({ enabled: true, ...settings, day: new Date().toDateString() });
}

/** Vypne připomínky na tomto zařízení. */
export async function disablePush(): Promise<void> {
  const reg = pushSupported() ? await navigator.serviceWorker.getRegistration() : undefined;
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const s = await session();
    if (s) await s.client.from(TABLE).upsert({ user_id: s.user.id, col: 'push', id: sub.endpoint, data: null, deleted: true, client_ts: Date.now() }, { onConflict: 'user_id,col,id' });
    await sub.unsubscribe();
  }
  savePush({ ...loadPush(), enabled: false });
}

/** Zkušební notifikace – projde celou cestou: Supabase → Vercel → telefon. */
export async function testPush(): Promise<void> {
  const { client } = await ctx();
  const { data, error } = await client.rpc('questy_push_test');
  if (error) {
    if (/questy_push_test|function/i.test(error.message)) throw new Error('V Supabase chybí SQL pro připomínky – spusť obě části z návodu.');
    throw new Error(czech(error.message));
  }
  if (!data) throw new Error('Nenašel jsem žádné zařízení s připomínkami – nejdřív je zapni.');
}

/** Jednou denně obnoví odběr (prohlížeč ho občas vymění). */
export async function refreshPush(extra: { relay: string | null; name: string }): Promise<void> {
  const s = loadPush() as PushSettings & { day?: string };
  if (!s.enabled || s.day === new Date().toDateString() || Notification.permission !== 'granted') return;
  try {
    await enablePush({ evening: s.evening, morning: s.morning }, extra);
  } catch { /* zkusí se příště */ }
}
