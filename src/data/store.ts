import { COLLECTION_NAMES, type CollectionName, type Collections } from './types';

/**
 * Abstraktní úložiště. Aplikace pracuje jen s tímto rozhraním,
 * takže IndexedDB (Dexie) jde později vyměnit např. za Supabase:
 * stačí napsat novou třídu implementující `DataStore`.
 */
export interface Collection<T extends { id: string }> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  bulkPut(items: T[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export type Backup = {
  app: 'questy-zivota';
  version: number;
  exportedAt: string;
  data: { [K in CollectionName]?: Collections[K][] };
};

/** Záznam v deníku změn pro synchronizaci (jeden na každý záznam dat). */
export type SyncEntry = {
  id: string; // `${col}/${rid}`
  col: CollectionName;
  rid: string;
  ts: number; // čas poslední změny (ms)
  dirty: 0 | 1; // změna ještě neodeslaná do cloudu
  deleted: 0 | 1;
};

/** Řádek v cloudu. */
export type RemoteRow = {
  col: CollectionName;
  id: string;
  data: unknown | null;
  deleted: boolean;
  client_ts: number;
  updated_at?: string;
};

export interface SyncLog extends Collection<SyncEntry> {
  dirty(): Promise<SyncEntry[]>;
}

/** Mezipaměť videí se mezi zařízeními neposílá. */
export const isLocalOnly = (col: CollectionName, id: string) => col === 'meta' && id.startsWith('yt:');

const syncKey = (col: CollectionName, id: string) => `${col}/${id}`;
const isCollection = (c: unknown): c is CollectionName => COLLECTION_NAMES.includes(c as CollectionName);

export abstract class DataStore {
  private listeners = new Set<() => void>();
  private wrapped = new Map<string, Collection<{ id: string }>>();
  private lastTs = 0;

  /** Přímý přístup k datům – bez upozornění UI a bez zápisu do deníku změn. */
  protected abstract raw(name: CollectionName): Collection<{ id: string }>;
  protected abstract syncLog(): SyncLog;
  /** Provede zápisy atomicky (pokud to úložiště umí). */
  protected atomic<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  col<K extends CollectionName>(name: K): Collection<Collections[K]> {
    if (!this.wrapped.has(name)) {
      const raw = this.raw(name);
      const write = async (fn: () => Promise<unknown>, ids: string[], deleted: 0 | 1) => {
        await this.atomic(async () => {
          await fn();
          await this.track(name, ids, deleted);
        });
        this.notify();
      };
      this.wrapped.set(name, {
        all: () => raw.all(),
        get: (id) => raw.get(id),
        put: (item) => write(() => raw.put(item), [item.id], 0),
        bulkPut: (items) => write(() => raw.bulkPut(items), items.map((i) => i.id), 0),
        delete: (id) => write(() => raw.delete(id), [id], 1),
        clear: async () => {
          const ids = (await raw.all()).map((x) => x.id);
          await write(() => raw.clear(), ids, 1);
        },
      });
    }
    return this.wrapped.get(name) as unknown as Collection<Collections[K]>;
  }

  /** Rostoucí časová značka – dvě změny nikdy nedostanou stejný čas. */
  private tick(): number {
    this.lastTs = Math.max(Date.now(), this.lastTs + 1);
    return this.lastTs;
  }

  private async track(col: CollectionName, ids: string[], deleted: 0 | 1) {
    const entries = ids
      .filter((id) => !isLocalOnly(col, id))
      .map((rid): SyncEntry => ({ id: syncKey(col, rid), col, rid, ts: this.tick(), dirty: 1, deleted }));
    if (entries.length) await this.syncLog().bulkPut(entries);
  }

  /** Odběr změn – UI se po každém zápisu znovu načte. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected notify() {
    this.listeners.forEach((fn) => fn());
  }

  // ---------- synchronizace ----------

  /** Změny čekající na odeslání do cloudu. */
  syncDirty(): Promise<SyncEntry[]> {
    return this.syncLog().dirty();
  }

  /** Řádky k odeslání pro dané změny. */
  async syncRows(entries: SyncEntry[]): Promise<RemoteRow[]> {
    return Promise.all(entries.map(async (e) => {
      const data = e.deleted ? undefined : await this.raw(e.col).get(e.rid);
      return { col: e.col, id: e.rid, data: data ?? null, deleted: data === undefined, client_ts: e.ts };
    }));
  }

  /** Označí změny jako odeslané – jen pokud se mezitím znovu nezměnily. */
  async syncMarkClean(entries: SyncEntry[]): Promise<void> {
    const log = this.syncLog();
    await this.atomic(async () => {
      const done: SyncEntry[] = [];
      for (const e of entries) {
        const cur = await log.get(e.id);
        if (cur && cur.ts === e.ts && cur.dirty) done.push({ ...cur, dirty: 0 });
      }
      if (done.length) await log.bulkPut(done);
    });
  }

  /**
   * Zapíše řádky z cloudu. Vyhrává novější změna (podle času změny);
   * vlastní novější neodeslané změny zůstanou. Vrací počet použitých řádků.
   */
  async applyRemote(rows: RemoteRow[]): Promise<number> {
    const log = this.syncLog();
    let applied = 0;
    await this.atomic(async () => {
      for (const r of rows) {
        if (!isCollection(r.col) || isLocalOnly(r.col, r.id)) continue;
        const key = syncKey(r.col, r.id);
        const local = await log.get(key);
        if (local && local.ts >= r.client_ts) continue;
        if (r.deleted || r.data == null) await this.raw(r.col).delete(r.id);
        else await this.raw(r.col).put({ ...(r.data as object), id: r.id });
        await log.put({ id: key, col: r.col, rid: r.id, ts: r.client_ts, dirty: 0, deleted: r.deleted ? 1 : 0 });
        this.lastTs = Math.max(this.lastTs, r.client_ts);
        applied++;
      }
    });
    if (applied) this.notify();
    return applied;
  }

  /** Smaže místní data i deník změn (před stažením dat z cloudu). */
  async syncWipeLocal(): Promise<void> {
    await this.atomic(async () => {
      for (const name of COLLECTION_NAMES) await this.raw(name).clear();
      await this.syncLog().clear();
    });
    this.notify();
  }

  /** Vytvoří deník změn znovu: všechna místní data se odešlou. */
  async syncMarkAllDirty(): Promise<SyncEntry[]> {
    const entries: SyncEntry[] = [];
    await this.atomic(async () => {
      await this.syncLog().clear();
      for (const col of COLLECTION_NAMES) {
        for (const { id } of await this.raw(col).all()) {
          if (!isLocalOnly(col, id)) entries.push({ id: syncKey(col, id), col, rid: id, ts: this.tick(), dirty: 1, deleted: 0 });
        }
      }
      if (entries.length) await this.syncLog().bulkPut(entries);
    });
    return entries;
  }

  /** Zapíše smazání záznamů, které jsou v cloudu navíc. */
  async syncMarkDeleted(keys: { col: CollectionName; id: string }[]): Promise<void> {
    for (const k of keys) if (isCollection(k.col)) await this.track(k.col, [k.id], 1);
  }

  /** Zapomene deník změn (po odpojení od cloudu). */
  async syncForget(): Promise<void> {
    await this.syncLog().clear();
  }

  // ---------- záloha ----------

  async exportAll(): Promise<Backup> {
    const data: Backup['data'] = {};
    for (const name of COLLECTION_NAMES) {
      (data as Record<string, unknown[]>)[name] = await this.col(name).all();
    }
    return { app: 'questy-zivota', version: 1, exportedAt: new Date().toISOString(), data };
  }

  async importAll(backup: Backup): Promise<void> {
    if (backup?.app !== 'questy-zivota' || typeof backup.data !== 'object') {
      throw new Error('Soubor není záloha aplikace Questy života.');
    }
    for (const name of COLLECTION_NAMES) {
      const items = (backup.data as Record<string, { id: string }[] | undefined>)[name];
      const c = this.col(name) as Collection<{ id: string }>;
      await c.clear();
      if (Array.isArray(items) && items.length) await c.bulkPut(items);
    }
    this.notify();
  }

  async wipe(): Promise<void> {
    for (const name of COLLECTION_NAMES) await this.col(name).clear();
    this.notify();
  }
}

/** Kolekce v paměti (Map) – pro testy. */
function memoryCollection<T extends { id: string }>(m: Map<string, T>): Collection<T> {
  const clone = <X,>(x: X): X => structuredClone(x);
  return {
    all: async () => [...m.values()].map(clone),
    get: async (id) => (m.has(id) ? clone(m.get(id)!) : undefined),
    put: async (item) => { m.set(item.id, clone(item)); },
    bulkPut: async (items) => { items.forEach((i) => m.set(i.id, clone(i))); },
    delete: async (id) => { m.delete(id); },
    clear: async () => { m.clear(); },
  };
}

/** Úložiště v paměti – pro testy (a jako vzor pro další implementace). */
export class MemoryStore extends DataStore {
  private maps = new Map<string, Map<string, { id: string }>>();
  private log = new Map<string, SyncEntry>();
  private logCol: SyncLog = { ...memoryCollection(this.log), dirty: async () => [...this.log.values()].filter((e) => e.dirty).map((e) => ({ ...e })) };

  protected raw(name: CollectionName): Collection<{ id: string }> {
    if (!this.maps.has(name)) this.maps.set(name, new Map());
    return memoryCollection(this.maps.get(name)!);
  }

  protected syncLog(): SyncLog {
    return this.logCol;
  }
}
