import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../data/store';
import { GameEngine } from '../game/engine';
import { MemoryRemote, PULL_PAGE, linkDevice, remoteCount, syncOnce } from './engine';

const ex = (id: string, name: string) => ({ id, name, unit: 'reps', group: 'upper', max: 10, builtin: false }) as never;

async function device(remote: MemoryRemote, mode: 'download' | 'upload') {
  const store = new MemoryStore();
  let cursor = await linkDevice(store, remote, mode);
  const sync = async () => {
    const r = await syncOnce(store, remote, cursor);
    cursor = r.cursor;
    return r;
  };
  return { store, sync };
}

describe('synchronizace', () => {
  it('změna na jednom zařízení se objeví na druhém (i smazání)', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    const b = await device(remote, 'download');
    await a.store.col('exercises').put(ex('e1', 'Kliky'));
    await a.sync();
    await b.sync();
    expect((await b.store.col('exercises').get('e1'))?.name).toBe('Kliky');

    await b.store.col('exercises').delete('e1');
    await b.sync();
    await a.sync();
    expect(await a.store.col('exercises').get('e1')).toBeUndefined();
  });

  it('po synchronizaci nezůstanou neodeslané změny a další kolo nic nedělá', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    await a.store.col('weights').put({ id: 'd', date: '2026-10-26', kg: 88 });
    expect((await a.sync()).pushed).toBe(1);
    expect(await a.store.syncDirty()).toHaveLength(0);
    expect(await a.sync()).toMatchObject({ pushed: 0, applied: 0 });
  });

  it('vyhrává novější změna, i když se starší odešle později', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    const b = await device(remote, 'download');
    await b.store.col('exercises').put(ex('e1', 'starší'));
    await new Promise((r) => setTimeout(r, 5));
    await a.store.col('exercises').put(ex('e1', 'novější'));
    await a.sync();
    await b.sync(); // b posílá starší změnu až teď – cloud ji odmítne a b převezme novější
    await a.sync();
    expect((await a.store.col('exercises').get('e1'))?.name).toBe('novější');
    expect((await b.store.col('exercises').get('e1'))?.name).toBe('novější');
    expect((await remote.pull(null, 0, 10)).find((r) => r.id === 'e1')?.data).toMatchObject({ name: 'novější' });
  });

  it('XP získané na dvou zařízeních se sečte', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    const b = await device(remote, 'download');
    const ga = new GameEngine(a.store);
    const gb = new GameEngine(b.store);
    await ga.award({ amount: 30, stat: 'int', module: 'math', label: 'a' });
    await a.sync();
    await b.sync();
    await gb.award({ amount: 20, stat: 'str', module: 'training', label: 'b' }); // offline
    await ga.award({ amount: 5, stat: 'int', module: 'math', label: 'a2' });
    await a.sync();
    await b.sync();
    await gb.recomputeTotals();
    await b.sync();
    await a.sync();
    await ga.recomputeTotals();
    for (const g of [ga, gb]) {
      const p = await g.getProfile();
      expect(p.xp).toBe(55);
      expect(p.statXp).toMatchObject({ int: 35, str: 20 });
    }
  });

  it('nahrání přepíše cloud, stažení nahradí místní data', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    await a.store.col('exercises').bulkPut([ex('e1', 'A'), ex('e2', 'B')]);
    await a.sync();

    const c = new MemoryStore();
    await c.col('exercises').put(ex('e3', 'C'));
    await linkDevice(c, remote, 'upload');
    expect(await remoteCount(remote)).toBe(1);
    await a.sync();
    expect((await a.store.col('exercises').all()).map((e) => e.id)).toEqual(['e3']);

    const d = new MemoryStore();
    await d.col('exercises').put(ex('e9', 'místní'));
    await linkDevice(d, remote, 'download');
    expect((await d.col('exercises').all()).map((e) => e.id)).toEqual(['e3']);
  });

  it('mezipaměť videí se neposílá', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    await a.store.col('meta').put({ id: 'yt:kanal', value: 1 });
    await a.store.col('meta').put({ id: 'ytWatched', value: ['x'] });
    await a.sync();
    expect((await remote.keys()).map((k) => k.id)).toEqual(['ytWatched']);
  });

  it('stahuje po stránkách', async () => {
    const remote = new MemoryRemote();
    const a = await device(remote, 'upload');
    const n = PULL_PAGE + 7;
    await a.store.col('weights').bulkPut(Array.from({ length: n }, (_, i) => ({ id: `w${i}`, date: `d${i}`, kg: i })));
    await a.sync();
    const b = await device(remote, 'download');
    expect(await b.store.col('weights').all()).toHaveLength(n);
  });
});
