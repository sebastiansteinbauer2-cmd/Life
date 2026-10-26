import { describe, expect, it } from 'vitest';
import { callRepr, dailyTask, newlineIndent, pyRepr } from './logic';
import { PY_TASKS } from './tasks';

describe('programování – pomocné funkce', () => {
  it('zápis hodnot jako v Pythonu', () => {
    expect(pyRepr([1, 'a', true, null, [false]])).toBe("[1, 'a', True, None, [False]]");
    expect(pyRepr("it's")).toBe("'it\\'s'");
    expect(callRepr('f', [[1, 2], 'x'])).toBe("f([1, 2], 'x')");
  });

  it('úloha dne jde od lehkých a je stabilní během dne', () => {
    const a = dailyTask(new Set(), '2026-10-26');
    expect(a.level).toBe('e');
    expect(dailyTask(new Set(), '2026-10-26').id).toBe(a.id);
    const allEasy = new Set(PY_TASKS.filter((t) => t.level === 'e').map((t) => t.id));
    expect(dailyTask(allEasy, '2026-10-26').level).toBe('m');
    expect(dailyTask(new Set(PY_TASKS.map((t) => t.id)), '2026-10-26')).toBeDefined();
  });

  it('odsazení v editoru', () => {
    expect(newlineIndent('def f(x):')).toBe('\n    ');
    expect(newlineIndent('def f(x):\n    if x:  # komentář')).toBe('\n        ');
    expect(newlineIndent('    return x')).toBe('\n    ');
    expect(newlineIndent('')).toBe('\n');
  });
});
