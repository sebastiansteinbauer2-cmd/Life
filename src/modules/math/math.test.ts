import { describe, expect, it } from 'vitest';
import type { MathLevel } from '../../data/types';
import { Rng } from './core';
import { TEMPLATES, buildBossTest, generateProblem, topicsFor } from './generator';
import { checkAnswer, evaluate, parseIntervals, parseSet } from './parse';

const LEVELS: MathLevel[] = ['zaklad', 'rozsireny', 'fit'];
const RUNS = 250;

describe('parser odpovědí', () => {
  it('vyhodnocuje čísla v různých zápisech', () => {
    expect(evaluate('1/2').re).toBeCloseTo(0.5);
    expect(evaluate('0,5').re).toBeCloseTo(0.5);
    expect(evaluate('2√3').re).toBeCloseTo(2 * Math.sqrt(3));
    expect(evaluate('√12').re).toBeCloseTo(2 * Math.sqrt(3));
    expect(evaluate('5π/6').re).toBeCloseTo((5 * Math.PI) / 6);
    expect(evaluate('-√2/2').re).toBeCloseTo(-Math.SQRT2 / 2);
    expect(evaluate('2^-3').re).toBeCloseTo(1 / 8);
    expect(evaluate('3+4i')).toEqual({ re: 3, im: 4 });
    expect(evaluate('(1+i)(1-i)').re).toBeCloseTo(2);
    expect(evaluate('|−3|').re).toBe(3);
  });

  it('toleruje ekvivalentní zápisy', () => {
    const half = { kind: 'num' as const, value: { re: 0.5, im: 0 }, input: '1/2', tex: '' };
    for (const s of ['1/2', '0.5', '0,5', '2/4', 'x = 1/2']) expect(checkAnswer(half, s).ok).toBe(true);
    expect(checkAnswer(half, '0.6').ok).toBe(false);
    const third = { kind: 'num' as const, value: { re: 1 / 3, im: 0 }, input: '1/3', tex: '' };
    expect(checkAnswer(third, '0.33').ok).toBe(true);
    expect(checkAnswer(third, '0.3').ok).toBe(false);
  });

  it('množiny kořenů nezávisle na pořadí', () => {
    const ans = { kind: 'set' as const, values: [{ re: -3, im: 0 }, { re: 2, im: 0 }], input: '', tex: '' };
    for (const s of ['2; -3', '-3;2', 'x1 = 2, x2 = -3', '{-3; 2}', '2 nebo -3']) expect(checkAnswer(ans, s).ok).toBe(true);
    expect(checkAnswer(ans, '2').ok).toBe(false);
    expect(parseSet('±2').map((c) => c.re)).toEqual([2, -2]);
    expect(parseSet('nemá řešení')).toEqual([]);
  });

  it('intervaly v české i anglické notaci', () => {
    const a = parseIntervals('(-∞; 2) ∪ ⟨3; ∞)');
    const b = parseIntervals('(-inf, 2) U [3, inf)');
    expect(a).toEqual(b);
    expect(a).toEqual([
      { lo: -Infinity, hi: 2, loC: false, hiC: false },
      { lo: 3, hi: Infinity, loC: true, hiC: false },
    ]);
    expect(parseIntervals('<1;5>')).toEqual([{ lo: 1, hi: 5, loC: true, hiC: true }]);
  });

  it('výrazy a rovnice přímek', () => {
    const expr = { kind: 'expr' as const, f: (x: number) => (x - 1) / (x + 2), input: '', tex: '' };
    expect(checkAnswer(expr, '(x-1)/(x+2)').ok).toBe(true);
    expect(checkAnswer(expr, '(1-x)/(-x-2)').ok).toBe(true);
    expect(checkAnswer(expr, '(x+1)/(x+2)').ok).toBe(false);
    const line = { kind: 'line' as const, coef: [2, -3, 5] as [number, number, number], input: '', tex: '' };
    expect(checkAnswer(line, '2x - 3y + 5 = 0').ok).toBe(true);
    expect(checkAnswer(line, '-4x+6y-10=0').ok).toBe(true);
    expect(checkAnswer(line, 'y = 2/3x + 5/3').ok).toBe(true);
    expect(checkAnswer(line, 'y = 2x + 5').ok).toBe(false);
  });
});

describe('generátor příkladů', () => {
  it('každé téma má šablony pro každou úroveň (kromě komplexních čísel v základu)', () => {
    expect(topicsFor('zaklad')).toHaveLength(9);
    expect(topicsFor('rozsireny')).toHaveLength(10);
    expect(topicsFor('fit')).toHaveLength(10);
  });

  for (const tpl of TEMPLATES) {
    for (const level of tpl.levels) {
      it(`${tpl.id} [${level}] – správné a čitelné výsledky`, () => {
        const rng = new Rng(12345 + tpl.id.length * 97 + level.length);
        const seen = new Set<string>();
        for (let i = 0; i < RUNS; i++) {
          const g = tpl.generate(rng, level);
          // 1) nezávislá kontrola výsledku (dosazením / z definice)
          expect(g.verify(), `${g.question} → ${g.answer.input}`).toBe(true);
          // 2) kanonický zápis odpovědi projde kontrolou odpovědí
          const res = checkAnswer(g.answer, g.answer.input);
          expect(res.ok, `${g.question} → ${g.answer.input} (${res.error ?? ''})`).toBe(true);
          // 3) žádné NaN / undefined / Infinity v textu
          const text = g.question + g.solution.join(' ') + g.answer.tex + g.answer.input;
          expect(text, g.question).not.toMatch(/NaN|undefined|Infinity(?!\})/);
          // 4) „hezká“ čísla – žádná dlouhá desetinná čísla
          expect(g.answer.input, g.question).not.toMatch(/\d\.\d{3,}/);
          expect(g.solution.length).toBeGreaterThan(0);
          seen.add(g.question);
        }
        // 5) příklady se neopakují
        expect(seen.size).toBeGreaterThanOrEqual(12);
      });
    }
  }

  it('špatná odpověď se nepřijme', () => {
    const rng = new Rng(7);
    let checked = 0;
    for (const level of LEVELS) for (const topic of topicsFor(level)) for (let i = 0; i < 10; i++) {
      const p = generateProblem(topic, level, rng);
      if (p.answer.kind === 'num' && p.answer.value.im === 0) {
        expect(checkAnswer(p.answer, String(p.answer.value.re + 1)).ok).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('boss fight pokryje všechna témata', () => {
    for (const level of LEVELS) {
      const test = buildBossTest(level, new Rng(99));
      expect(test).toHaveLength(20);
      expect(new Set(test.map((p) => p.topic)).size).toBe(topicsFor(level).length);
    }
  });
});
