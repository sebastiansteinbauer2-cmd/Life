import type { CodeAttempt } from '../../data/types';
import { dateKey } from '../../lib/date';
import { PY_TASKS, type PyTask, type TaskLevel } from './tasks';

/** Hodnota z JSON zapsaná jako v Pythonu (True, None, 'text'). */
export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(', ')}]`;
  if (typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(', ')}}`;
  return String(v);
}

/** Volání funkce s argumenty, např. maximum(1, 2, 3). */
export const callRepr = (fn: string, args: unknown[]) => `${fn}(${args.map(pyRepr).join(', ')})`;

export const solvedIds = (attempts: CodeAttempt[]) => new Set(attempts.filter((a) => a.passed && a.taskId.startsWith('py:')).map((a) => a.taskId));

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Úloha dne: nevyřešená z nejlehčí úrovně, kde ještě něco zbývá (stabilní během dne). */
export function dailyTask(solved: Set<string>, today: string = dateKey(), tasks: PyTask[] = PY_TASKS): PyTask {
  for (const level of ['e', 'm', 'h'] as TaskLevel[]) {
    const open = tasks.filter((t) => t.level === level && !solved.has(t.id));
    if (open.length) return open[hash(today) % open.length];
  }
  return tasks[hash(today) % tasks.length];
}

/** Odsazení nového řádku v editoru: jako předchozí, po dvojtečce o 4 mezery víc. */
export function newlineIndent(textBefore: string): string {
  const line = textBefore.slice(textBefore.lastIndexOf('\n') + 1);
  const indent = line.match(/^ */)![0];
  return `\n${indent}${/:\s*(#.*)?$/.test(line) ? '    ' : ''}`;
}
