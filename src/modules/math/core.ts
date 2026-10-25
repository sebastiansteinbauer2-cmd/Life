import type { MathLevel } from '../../data/types';
import { cx, type Answer, type C, type Interval } from './parse';

/** Deterministický generátor náhodných čísel (mulberry32) – testy jdou zopakovat. */
export class Rng {
  private s: number;
  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  /** Nenulové celé číslo z <a; b>. */
  nz(a: number, b: number): number {
    let v = 0;
    while (v === 0) v = this.int(a, b);
    return v;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign(): 1 | -1 {
    return this.next() < 0.5 ? 1 : -1;
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** k různých hodnot z <a; b>. */
  distinct(k: number, a: number, b: number, exclude: number[] = []): number[] {
    const out: number[] = [];
    while (out.length < k) {
      const v = this.int(a, b);
      if (!out.includes(v) && !exclude.includes(v)) out.push(v);
    }
    return out;
  }
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);

export interface Frac { n: number; d: number }
export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error('dělení nulou');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
export const fval = (f: Frac) => f.n / f.d;
export const fadd = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fsub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fmul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
export const fdiv = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);

export function ftex(f: Frac): string {
  if (f.d === 1) return String(f.n);
  return `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`;
}
export const fin = (f: Frac) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

/** Číslo jako zlomek (pro hodnoty, o kterých víme, že jsou racionální s malým jmenovatelem). */
export function toFrac(x: number, maxDen = 1000): Frac {
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return frac(n, d);
  }
  throw new Error(`${x} není hezký zlomek`);
}
export const ntex = (x: number) => ftex(toFrac(x));
export const nin = (x: number) => fin(toFrac(x));

/** Odmocnina ve tvaru k√m (m bez čtverců). */
export function surd(n: number): { k: number; m: number } {
  let k = 1;
  let m = n;
  for (let f = 2; f * f <= m; f++) while (m % (f * f) === 0) { m /= f * f; k *= f; }
  return { k, m };
}
/** (k·√m)/d jako TeX a vstup. */
export function surdTex(k: number, m: number, d = 1): { tex: string; input: string } {
  const g = gcd(k, d);
  k /= g; d /= g;
  if (d < 0) { k = -k; d = -d; }
  const sgn = k < 0 ? '-' : '';
  const ak = Math.abs(k);
  if (m === 1) {
    const f = frac(k, d);
    return { tex: ftex(f), input: fin(f) };
  }
  const coefTex = ak === 1 ? '' : String(ak);
  const num = `${coefTex}\\sqrt{${m}}`;
  const tex = d === 1 ? `${sgn}${num}` : `${sgn}\\frac{${num}}{${d}}`;
  const input = `${sgn}${ak === 1 ? '' : ak}√${m}${d === 1 ? '' : `/${d}`}`;
  return { tex, input };
}

/** Násobek π: (n/d)·π */
export function piTex(f: Frac): { tex: string; input: string } {
  if (f.n === 0) return { tex: '0', input: '0' };
  const sgn = f.n < 0 ? '-' : '';
  const an = Math.abs(f.n);
  const num = an === 1 ? '\\pi' : `${an}\\pi`;
  return {
    tex: f.d === 1 ? `${sgn}${num}` : `${sgn}\\frac{${num}}{${f.d}}`,
    input: `${sgn}${an === 1 ? '' : an}π${f.d === 1 ? '' : `/${f.d}`}`,
  };
}

/** Komplexní číslo a + bi (racionální složky). */
export function cTex(re: number, im: number): { tex: string; input: string } {
  const r = toFrac(re);
  const i = toFrac(im);
  if (i.n === 0) return { tex: ftex(r), input: fin(r) };
  const imAbs = frac(Math.abs(i.n), i.d);
  const imTex = imAbs.n === 1 && imAbs.d === 1 ? 'i' : `${ftex(imAbs)}i`;
  const imIn = imAbs.n === 1 && imAbs.d === 1 ? 'i' : imAbs.d === 1 ? `${imAbs.n}i` : `${imAbs.n}i/${imAbs.d}`;
  if (r.n === 0) return { tex: `${i.n < 0 ? '-' : ''}${imTex}`, input: `${i.n < 0 ? '-' : ''}${imIn}` };
  const op = i.n < 0 ? '-' : '+';
  return { tex: `${ftex(r)} ${op} ${imTex}`, input: `${fin(r)}${op}${imIn}` };
}

/** Polynom s koeficienty od nejvyšší mocniny: poly([1,-3,2]) = "x^2 - 3x + 2" */
export function poly(coefs: number[], v = 'x'): string {
  const deg = coefs.length - 1;
  let out = '';
  coefs.forEach((c, k) => {
    if (c === 0) return;
    const p = deg - k;
    const abs = Math.abs(c);
    const varPart = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    const coef = abs === 1 && p !== 0 ? '' : String(abs);
    const term = `${coef}${varPart}`;
    if (!out) out = (c < 0 ? '-' : '') + term;
    else out += ` ${c < 0 ? '-' : '+'} ${term}`;
  });
  return out || '0';
}

/** Polynom se zlomkovými koeficienty. */
export function polyF(coefs: Frac[], v = 'x'): string {
  const deg = coefs.length - 1;
  let out = '';
  coefs.forEach((c, k) => {
    if (c.n === 0) return;
    const p = deg - k;
    const abs = frac(Math.abs(c.n), c.d);
    const varPart = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    const coef = abs.n === 1 && abs.d === 1 && p !== 0 ? '' : ftex(abs);
    const term = `${coef}${varPart}`;
    if (!out) out = (c.n < 0 ? '-' : '') + term;
    else out += ` ${c.n < 0 ? '-' : '+'} ${term}`;
  });
  return out || '0';
}

/** "+ 3" / "- 3" pro navazující člen */
export const sg = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
/** Číslo v závorce, pokud je záporné */
export const par = (n: number | string) => (typeof n === 'number' ? (n < 0 ? `(${n})` : String(n)) : n);
/** (x - a) se správným znaménkem */
export const xm = (a: number, v = 'x') => (a === 0 ? v : a > 0 ? `${v} - ${a}` : `${v} + ${-a}`);

export const deg2tex = (d: number) => `${d}^\\circ`;

export interface Generated {
  question: string;
  answer: Answer;
  solution: string[];
  /** Nezávislá kontrola výsledku (dosazením / z definice) – používají ji testy. */
  verify: () => boolean;
}

export interface Template {
  id: string;
  topic: string;
  name: string;
  levels: MathLevel[];
  generate: (r: Rng, level: MathLevel) => Generated;
}

export const ALL: MathLevel[] = ['zaklad', 'rozsireny', 'fit'];
export const ADV: MathLevel[] = ['rozsireny', 'fit'];

// Pomocné konstruktory odpovědí
export const numAns = (value: number | C, input: string, tex: string): Answer => ({
  kind: 'num', value: typeof value === 'number' ? cx(value) : value, input, tex,
});
export const fracAns = (f: Frac): Answer => numAns(fval(f), fin(f), ftex(f));
export const intAns = (n: number): Answer => numAns(n, String(n), String(n));
export function setAns(values: number[]): Answer {
  const u = [...new Set(values.map((v) => Math.round(v * 1e9) / 1e9))].sort((a, b) => a - b);
  if (!u.length) return { kind: 'set', values: [], input: '∅', tex: '\\emptyset' };
  return {
    kind: 'set', values: u.map((v) => cx(v)),
    input: u.map(nin).join('; '),
    tex: `\\{${u.map(ntex).join('; ')}\\}`,
  };
}
export function tupleAns(values: number[], names: string[]): Answer {
  return {
    kind: 'tuple', values, names,
    input: values.map(nin).join('; '),
    tex: `[${values.map(ntex).join('; ')}]`,
  };
}
const ivTex = (iv: Interval) =>
  `${iv.loC ? '\\langle' : '('}${iv.lo === -Infinity ? '-\\infty' : ntex(iv.lo)}; ${iv.hi === Infinity ? '\\infty' : ntex(iv.hi)}${iv.hiC ? '\\rangle' : ')'}`;
const ivIn = (iv: Interval) =>
  `${iv.loC ? '<' : '('}${iv.lo === -Infinity ? '-∞' : nin(iv.lo)}; ${iv.hi === Infinity ? '∞' : nin(iv.hi)}${iv.hiC ? '>' : ')'}`;
export function intervalAns(ivs: Interval[]): Answer {
  if (!ivs.length) return { kind: 'interval', value: [], input: '∅', tex: '\\emptyset' };
  return { kind: 'interval', value: ivs, input: ivs.map(ivIn).join(' ∪ '), tex: ivs.map(ivTex).join(' \\cup ') };
}
export const iv = (lo: number, hi: number, loC = false, hiC = false): Interval => ({
  lo, hi, loC: loC && Number.isFinite(lo), hiC: hiC && Number.isFinite(hi),
});

export const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
export const isNice = (x: number, maxDen = 100) => {
  try {
    return toFrac(x, maxDen).d <= maxDen;
  } catch {
    return false;
  }
};

/** Množina řešení s vlastním zápisem prvků (např. násobky π, komplexní čísla). */
export function setAnsItems(items: { value: number | C; input: string; tex: string }[]): Answer {
  const vals = items.map((i) => (typeof i.value === 'number' ? cx(i.value) : i.value));
  const order = vals.map((_, k) => k).sort((a, b) => vals[a].re - vals[b].re || vals[a].im - vals[b].im);
  if (!items.length) return { kind: 'set', values: [], input: '∅', tex: '\\emptyset' };
  return {
    kind: 'set',
    values: order.map((k) => vals[k]),
    input: order.map((k) => items[k].input).join('; '),
    tex: `\\left\\{${order.map((k) => items[k].tex).join('; ')}\\right\\}`,
  };
}

/** Hodnota a + b·√2 + c·√3 (racionální a, b, c) – pro přesné goniometrické hodnoty. */
export type Q23 = [Frac, Frac, Frac];
export function q23(v: Q23): { tex: string; input: string; value: number } {
  const parts: { tex: string; input: string; neg: boolean }[] = [];
  const [a, b, c] = v;
  if (a.n) parts.push({ tex: ftex(frac(Math.abs(a.n), a.d)), input: fin(frac(Math.abs(a.n), a.d)), neg: a.n < 0 });
  for (const [f, m] of [[b, 2], [c, 3]] as [Frac, number][]) {
    if (!f.n) continue;
    const s = surdTex(Math.abs(f.n), m, f.d);
    parts.push({ tex: s.tex, input: s.input, neg: f.n < 0 });
  }
  if (!parts.length) return { tex: '0', input: '0', value: 0 };
  const tex = parts.map((p, i) => (i === 0 ? (p.neg ? '-' : '') + p.tex : ` ${p.neg ? '-' : '+'} ${p.tex}`)).join('');
  const input = parts.map((p, i) => (i === 0 ? (p.neg ? '-' : '') + p.input : `${p.neg ? '-' : '+'}${p.input}`)).join('');
  return { tex, input, value: fval(a) + fval(b) * Math.SQRT2 + fval(c) * Math.sqrt(3) };
}
