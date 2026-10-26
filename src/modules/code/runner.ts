import type { PyTask } from './tasks';

export type TestResult = { ok: boolean; got?: string; error?: string; line?: number | null };
export type RunResult =
  | { kind: 'done'; results: TestResult[]; stdout: string }
  | { kind: 'error'; error: string; line: number | null; stdout: string }
  | { kind: 'timeout' }
  | { kind: 'failed'; error: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (m: { ok: boolean; result?: unknown; error?: string }) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./py.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

function send(msg: object, timeoutMs: number): Promise<{ ok: boolean; result?: unknown; error?: string } | 'timeout'> {
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // zaseknuté řešení – worker zahodit (příště se vytvoří nový)
      w.terminate();
      if (worker === w) worker = null;
      pending.forEach((fn) => fn({ ok: false, error: 'Přerušeno' }));
      pending.clear();
      resolve('timeout');
    }, timeoutMs);
    pending.set(id, (m) => {
      clearTimeout(timer);
      resolve(m);
    });
    w.postMessage({ id, ...msg });
  });
}

let loaded = false;
export const pythonLoaded = () => loaded;

/** Načte Python (poprvé stahuje cca 10 MB). */
export async function loadPython(): Promise<void> {
  const r = await send({ type: 'load' }, 120_000);
  if (r === 'timeout' || !r.ok) {
    throw new Error('Python se nepodařilo načíst – zkontroluj internet (poprvé se stahuje asi 10 MB).');
  }
  loaded = true;
}

/** Spustí řešení na testech úlohy. */
export async function runTask(task: PyTask, code: string, timeoutMs = 8000): Promise<RunResult> {
  try {
    await loadPython();
  } catch (e) {
    return { kind: 'failed', error: (e as Error).message };
  }
  const r = await send({ type: 'run', code, fn: task.fn, tests: JSON.stringify(task.tests) }, timeoutMs);
  if (r === 'timeout') {
    loaded = false;
    return { kind: 'timeout' };
  }
  if (!r.ok) return { kind: 'failed', error: r.error ?? 'Neznámá chyba' };
  const res = r.result as { results?: TestResult[]; error?: string; line?: number | null; stdout: string };
  if (res.error) return { kind: 'error', error: res.error, line: res.line ?? null, stdout: res.stdout };
  return { kind: 'done', results: res.results ?? [], stdout: res.stdout };
}
