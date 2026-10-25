import Dexie, { type Table } from 'dexie';
import { COLLECTION_NAMES, type CollectionName, type Collections } from './types';
import { DataStore, type Collection } from './store';

class QuestyDb extends Dexie {
  constructor() {
    super('questy-zivota');
    const schema: Record<string, string> = {};
    for (const name of COLLECTION_NAMES) schema[name] = 'id';
    this.version(1).stores(schema);
  }
}

/** Implementace úložiště nad IndexedDB pomocí knihovny Dexie. */
export class DexieStore extends DataStore {
  private db = new QuestyDb();
  private cache = new Map<string, Collection<{ id: string }>>();

  col<K extends CollectionName>(name: K): Collection<Collections[K]> {
    if (!this.cache.has(name)) {
      const table = this.db.table(name) as Table<{ id: string }, string>;
      this.cache.set(name, {
        all: () => table.toArray(),
        get: (id) => table.get(id),
        put: async (item) => { await table.put(item); this.notify(); },
        bulkPut: async (items) => { await table.bulkPut(items); this.notify(); },
        delete: async (id) => { await table.delete(id); this.notify(); },
        clear: async () => { await table.clear(); this.notify(); },
      });
    }
    return this.cache.get(name) as unknown as Collection<Collections[K]>;
  }
}
