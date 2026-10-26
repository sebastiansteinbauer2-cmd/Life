import Dexie, { type Table } from 'dexie';
import { COLLECTION_NAMES, type CollectionName, type Collections } from './types';
import { DataStore, type Collection } from './store';

// Kolekce první verze databáze – neměnit (Dexie podle nich staví upgrade).
const V1_COLLECTIONS = [
  'profile', 'xpLog', 'quests', 'questProgress', 'achievements', 'meta',
  'mathAttempts', 'topicSrs', 'bossResults', 'exercises', 'workouts', 'weights',
  'chessGames', 'chessRatings', 'books', 'discoveries', 'resources',
] as const;

// v2 = v1 + Finance. Také neměnit.
const V2_COLLECTIONS = [...V1_COLLECTIONS, 'financeSnapshots', 'financeTx', 'financeDividends'] as const;

class QuestyDb extends Dexie {
  constructor() {
    super('questy-zivota');
    const schema = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, 'id']));
    this.version(1).stores(schema(V1_COLLECTIONS));
    // v2: modul Finance (Trading 212)
    this.version(2).stores(schema(V2_COLLECTIONS));
    // v3: aktivity ze Stravy
    this.version(3).stores(schema(COLLECTION_NAMES));
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
