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

export abstract class DataStore {
  private listeners = new Set<() => void>();

  abstract col<K extends CollectionName>(name: K): Collection<Collections[K]>;

  /** Odběr změn – UI se po každém zápisu znovu načte. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected notify() {
    this.listeners.forEach((fn) => fn());
  }

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

/** Úložiště v paměti – pro testy (a jako vzor pro další implementace). */
export class MemoryStore extends DataStore {
  private maps = new Map<string, Map<string, unknown>>();

  col<K extends CollectionName>(name: K): Collection<Collections[K]> {
    if (!this.maps.has(name)) this.maps.set(name, new Map());
    const m = this.maps.get(name)! as Map<string, Collections[K]>;
    const clone = <T,>(x: T): T => structuredClone(x);
    return {
      all: async () => [...m.values()].map(clone),
      get: async (id) => (m.has(id) ? clone(m.get(id)!) : undefined),
      put: async (item) => { m.set(item.id, clone(item)); this.notify(); },
      bulkPut: async (items) => { items.forEach((i) => m.set(i.id, clone(i))); this.notify(); },
      delete: async (id) => { m.delete(id); this.notify(); },
      clear: async () => { m.clear(); this.notify(); },
    };
  }
}
