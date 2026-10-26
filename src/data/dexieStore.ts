import Dexie, { type Table } from 'dexie';
import { COLLECTION_NAMES, type CollectionName } from './types';
import { DataStore, type Collection, type SyncEntry, type SyncLog } from './store';

// Kolekce první verze databáze – neměnit (Dexie podle nich staví upgrade).
const V1_COLLECTIONS = [
  'profile', 'xpLog', 'quests', 'questProgress', 'achievements', 'meta',
  'mathAttempts', 'topicSrs', 'bossResults', 'exercises', 'workouts', 'weights',
  'chessGames', 'chessRatings', 'books', 'discoveries', 'resources',
] as const;

// v2 = v1 + Finance. Také neměnit.
const V2_COLLECTIONS = [...V1_COLLECTIONS, 'financeSnapshots', 'financeTx', 'financeDividends'] as const;
// v3 = v2 + aktivity ze Stravy. Také neměnit.
const V3_COLLECTIONS = [...V2_COLLECTIONS, 'activities'] as const;

// v4 = v3 + deník změn pro synchronizaci. Také neměnit.
const V4_COLLECTIONS = V3_COLLECTIONS;

class QuestyDb extends Dexie {
  constructor() {
    super('questy-zivota');
    const schema = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, 'id']));
    this.version(1).stores(schema(V1_COLLECTIONS));
    // v2: modul Finance (Trading 212)
    this.version(2).stores(schema(V2_COLLECTIONS));
    // v3: aktivity ze Stravy
    this.version(3).stores(schema(V3_COLLECTIONS));
    // v4: deník změn pro synchronizaci s cloudem
    this.version(4).stores({ ...schema(V4_COLLECTIONS), _sync: 'id, dirty' });
    // v5: rozpočet, programování, čtení
    this.version(5).stores({ ...schema(COLLECTION_NAMES), _sync: 'id, dirty' });
  }
}

function tableCollection<T extends { id: string }>(table: Table<T, string>): Collection<T> {
  return {
    all: () => table.toArray(),
    get: (id) => table.get(id),
    put: async (item) => { await table.put(item); },
    bulkPut: async (items) => { await table.bulkPut(items); },
    delete: (id) => table.delete(id),
    clear: () => table.clear(),
  };
}

/** Implementace úložiště nad IndexedDB pomocí knihovny Dexie. */
export class DexieStore extends DataStore {
  private db = new QuestyDb();
  private cache = new Map<string, Collection<{ id: string }>>();
  private log?: SyncLog;

  protected raw(name: CollectionName): Collection<{ id: string }> {
    if (!this.cache.has(name)) this.cache.set(name, tableCollection(this.db.table(name) as Table<{ id: string }, string>));
    return this.cache.get(name)!;
  }

  protected syncLog(): SyncLog {
    if (!this.log) {
      const table = this.db.table('_sync') as Table<SyncEntry, string>;
      this.log = { ...tableCollection(table), dirty: () => table.where('dirty').equals(1).toArray() };
    }
    return this.log;
  }

  protected atomic<T>(fn: () => Promise<T>): Promise<T> {
    // (typ přes unknown – plné typy Dexie jsou pro TypeScript příliš hluboké)
    const db = this.db as unknown as { transaction(mode: 'rw', tables: unknown[], fn: () => Promise<unknown>): Promise<unknown> };
    return db.transaction('rw', this.db.tables, fn) as Promise<T>;
  }
}
