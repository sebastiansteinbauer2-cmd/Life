// Web Worker s Pythonem (Pyodide). Běží mimo hlavní vlákno – nekonečný cyklus
// v řešení nezasekne aplikaci, worker se po limitu prostě ukončí.
import { HARNESS } from './harness';
import { PYODIDE_BASE } from './pyodide';

type Py = { runPython(code: string): string; globals: { set(k: string, v: unknown): void } };
let ready: Promise<Py> | null = null;

function load(): Promise<Py> {
  ready ??= import(/* @vite-ignore */ `${PYODIDE_BASE}pyodide.mjs`)
    .then(async (m: { loadPyodide(o: { indexURL: string }): Promise<Py> }) => {
      const py = await m.loadPyodide({ indexURL: PYODIDE_BASE });
      py.runPython(HARNESS);
      return py;
    })
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

self.onmessage = async (e: MessageEvent<{ id: number; type: 'load' | 'run'; code?: string; fn?: string; tests?: string }>) => {
  const { id, type, code, fn, tests } = e.data;
  try {
    const py = await load();
    if (type === 'load') return self.postMessage({ id, ok: true });
    py.globals.set('__c', code);
    py.globals.set('__f', fn);
    py.globals.set('__t', tests);
    self.postMessage({ id, ok: true, result: JSON.parse(py.runPython('__run(__c, __f, __t)')) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
