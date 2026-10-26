import type { DataStore, RemoteRow } from '../data/store';
import { COLLECTION_NAMES, type CollectionName } from '../data/types';

/** Řádky aplikace (v cloudu jsou i jiné – např. nastavení připomínek). */
const isData = (k: { col: string; deleted: boolean }) => !k.deleted && COLLECTION_NAMES.includes(k.col as CollectionName);

/** Cloud, se kterým se synchronizuje (Supabase, v testech paměť). */
export interface SyncRemote {
  /** Uloží řádky; v cloudu vyhrává novější `client_ts`. */
  push(rows: RemoteRow[]): Promise<void>;
  /** Řádky změněné po `since` (seřazené podle `updated_at`), stránkovaně. */
  pull(since: string | null, offset: number, limit: number): Promise<RemoteRow[]>;
  /** Všechny klíče v cloudu (i smazané). */
  keys(): Promise<{ col: CollectionName; id: string; deleted: boolean }[]>;
}

export const PUSH_BATCH = 250;
export const PULL_PAGE = 1000;
/** Kvůli souběžným zápisům se stahuje i kousek před posledním stažením. */
export const PULL_OVERLAP_MS = 2 * 60_000;

/** Odešle místní změny. Vrací počet odeslaných záznamů. */
export async function pushChanges(store: DataStore, remote: SyncRemote): Promise<number> {
  const dirty = await store.syncDirty();
  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const chunk = dirty.slice(i, i + PUSH_BATCH);
    await remote.push(await store.syncRows(chunk));
    await store.syncMarkClean(chunk);
  }
  return dirty.length;
}

/** Stáhne změny z cloudu. Vrací počet použitých řádků a nový ukazatel. */
export async function pullChanges(store: DataStore, remote: SyncRemote, since: string | null): Promise<{ applied: number; cursor: string | null }> {
  const from = since ? new Date(Date.parse(since) - PULL_OVERLAP_MS).toISOString() : null;
  let applied = 0;
  let cursor = since;
  for (let offset = 0; ; offset += PULL_PAGE) {
    const rows = await remote.pull(from, offset, PULL_PAGE);
    applied += await store.applyRemote(rows);
    for (const r of rows) if (r.updated_at && (!cursor || Date.parse(r.updated_at) > Date.parse(cursor))) cursor = r.updated_at;
    if (rows.length < PULL_PAGE) break;
  }
  return { applied, cursor };
}

/** Kolik živých (nesmazaných) záznamů je v cloudu. */
export async function remoteCount(remote: SyncRemote): Promise<number> {
  return (await remote.keys()).filter(isData).length;
}

/**
 * První propojení zařízení s cloudem.
 * - `download`: místní data se nahradí daty z cloudu,
 * - `upload`: cloud se nahradí daty z tohoto zařízení.
 */
export async function linkDevice(store: DataStore, remote: SyncRemote, mode: 'download' | 'upload'): Promise<string | null> {
  if (mode === 'download') {
    await store.syncWipeLocal();
    return (await pullChanges(store, remote, null)).cursor;
  }
  const local = await store.syncMarkAllDirty();
  const have = new Set(local.map((e) => e.id));
  const extra = (await remote.keys()).filter((k) => isData(k) && !have.has(`${k.col}/${k.id}`));
  await store.syncMarkDeleted(extra);
  await pushChanges(store, remote);
  return (await pullChanges(store, remote, null)).cursor;
}

/** Jedno kolo synchronizace: odeslat, pak stáhnout. */
export async function syncOnce(store: DataStore, remote: SyncRemote, since: string | null) {
  const pushed = await pushChanges(store, remote);
  const { applied, cursor } = await pullChanges(store, remote, since);
  return { pushed, applied, cursor };
}

/** Cloud v paměti se stejnými pravidly jako tabulka v Supabase – pro testy. */
export class MemoryRemote implements SyncRemote {
  rows = new Map<string, Required<RemoteRow>>();
  private clock = Date.parse('2026-01-01T00:00:00Z');

  async push(rows: RemoteRow[]) {
    for (const r of rows) {
      const key = `${r.col}/${r.id}`;
      const old = this.rows.get(key);
      if (old && r.client_ts < old.client_ts) continue;
      this.rows.set(key, { ...structuredClone(r), updated_at: new Date(++this.clock).toISOString() });
    }
  }

  async pull(since: string | null, offset: number, limit: number) {
    return [...this.rows.values()]
      .filter((r) => !since || r.updated_at > since)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      .slice(offset, offset + limit)
      .map((r) => structuredClone(r));
  }

  async keys() {
    return [...this.rows.values()].map((r) => ({ col: r.col, id: r.id, deleted: r.deleted }));
  }
}
