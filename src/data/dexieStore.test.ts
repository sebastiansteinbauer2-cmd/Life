import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { MemoryRemote, linkDevice, syncOnce } from '../sync/engine';
import { DexieStore } from './dexieStore';
import { COLLECTION_NAMES } from './types';

describe('DexieStore', () => {
  it('upgrade ze staré verze zachová data a synchronizace funguje', async () => {
    const old = new Dexie('questy-zivota');
    old.version(3).stores(Object.fromEntries(COLLECTION_NAMES.map((n) => [n, 'id'])));
    await old.table('weights').put({ id: 'w1', date: '2026-10-01', kg: 88 });
    old.close();

    const a = new DexieStore();
    expect(await a.col('weights').get('w1')).toMatchObject({ kg: 88 });
    await a.col('weights').put({ id: 'w2', date: '2026-10-02', kg: 87.5 });
    expect((await a.syncDirty()).map((e) => e.rid)).toEqual(['w2']);

    const remote = new MemoryRemote();
    let cursor = await linkDevice(a, remote, 'upload');
    expect(await a.syncDirty()).toHaveLength(0);
    expect((await remote.keys()).map((k) => k.id).sort()).toEqual(['w1', 'w2']);

    await remote.push([{ col: 'weights', id: 'w3', data: { id: 'w3', date: '2026-10-03', kg: 87 }, deleted: false, client_ts: Date.now() + 1000 }]);
    let notified = 0;
    a.subscribe(() => notified++);
    cursor = (await syncOnce(a, remote, cursor)).cursor;
    expect(await a.col('weights').get('w3')).toMatchObject({ kg: 87 });
    expect(notified).toBeGreaterThan(0);
    expect(await a.syncDirty()).toHaveLength(0);
  });
});
