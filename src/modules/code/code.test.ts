import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C_QUESTIONS, isCorrect, normalizeOut, wrapC } from './cquiz';
import { HARNESS } from './harness';
import { PY_TASKS } from './tasks';

const has = (cmd: string) => spawnSync(cmd, ['--version']).status === 0;
const dir = mkdtempSync(join(tmpdir(), 'questy-code-'));

/** Spustí harness v CPythonu pro všechny úlohy s daným kódem. */
function runAll(codeOf: (t: (typeof PY_TASKS)[number]) => string) {
  const jobs = PY_TASKS.map((t) => ({ id: t.id, code: codeOf(t), fn: t.fn, tests: JSON.stringify(t.tests) }));
  const file = join(dir, 'run.py');
  writeFileSync(file, `${HARNESS}\nimport json, sys\nfor j in json.load(sys.stdin):\n    print(json.dumps({"id": j["id"], "r": json.loads(__run(j["code"], j["fn"], j["tests"]))}))\n`);
  const out = execFileSync('python3', [file], { input: JSON.stringify(jobs), encoding: 'utf8', timeout: 60_000 });
  return out.trim().split('\n').map((l) => JSON.parse(l) as { id: string; r: { results?: { ok: boolean }[]; error?: string } });
}

describe('úlohy v Pythonu', () => {
  it('mají jedinečná id, správné úrovně a dost testů', () => {
    expect(new Set(PY_TASKS.map((t) => t.id)).size).toBe(PY_TASKS.length);
    for (const t of PY_TASKS) {
      expect(t.id.startsWith(`py:${t.level}-`)).toBe(true);
      expect(t.tests.length).toBeGreaterThanOrEqual(4);
      expect(t.solution).toContain(`def ${t.fn}(`);
    }
    expect(PY_TASKS.length).toBeGreaterThanOrEqual(40);
  });

  it.runIf(has('python3'))('vzorová řešení projdou všemi testy', () => {
    for (const { id, r } of runAll((t) => t.solution)) {
      expect(r.error, id).toBeUndefined();
      expect(r.results!.map((x) => x.ok), id).toEqual(r.results!.map(() => true));
    }
  });

  it.runIf(has('python3'))('prázdná šablona neprojde a chyby se hlásí', () => {
    for (const { id, r } of runAll((t) => t.starter)) expect(r.results!.every((x) => x.ok), id).toBe(false);
    const [syntax] = runAll(() => 'def f(:\n  pass');
    expect(syntax.r.error).toMatch(/SyntaxError/);
    const [missing] = runAll(() => 'x = 1');
    expect(missing.r.error).toMatch(/Chybí funkce/);
  });
});

describe('kvíz C', () => {
  it('jedinečná id a porovnání odpovědí', () => {
    expect(new Set(C_QUESTIONS.map((q) => q.id)).size).toBe(C_QUESTIONS.length);
    const q = C_QUESTIONS.find((x) => x.id === 'c:printf-width')!;
    expect(isCorrect(q, '[   42][7  ][005]\n')).toBe(true);
    expect(normalizeOut('  1  2\n3 ')).toBe('1 2 3');
  });

  it.runIf(has('gcc'))('odpovědi odpovídají skutečnému výstupu programů', () => {
    for (const q of C_QUESTIONS) {
      const src = join(dir, `${q.id.slice(2)}.c`);
      const bin = join(dir, q.id.slice(2));
      writeFileSync(src, wrapC(q));
      execFileSync('gcc', ['-std=c11', '-w', '-o', bin, src]);
      const out = execFileSync(bin, { encoding: 'utf8' });
      expect(normalizeOut(out), q.id).toBe(normalizeOut(q.answer));
    }
  });
});
