// Parser a vyhodnocovač odpovědí. Podporuje zlomky, desetinná čísla (tečka i čárka),
// √, π, mocniny, komplexní čísla (i), proměnné x/y, intervaly a množiny kořenů.

export interface C { re: number; im: number }
export const cx = (re: number, im = 0): C => ({ re, im });

const add = (a: C, b: C) => cx(a.re + b.re, a.im + b.im);
const sub = (a: C, b: C) => cx(a.re - b.re, a.im - b.im);
const mul = (a: C, b: C) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a: C, b: C) => {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
const csqrt = (a: C): C => {
  if (a.im === 0) return a.re >= 0 ? cx(Math.sqrt(a.re)) : cx(0, Math.sqrt(-a.re));
  const r = Math.hypot(a.re, a.im);
  const re = Math.sqrt((r + a.re) / 2);
  const im = Math.sign(a.im) * Math.sqrt((r - a.re) / 2);
  return cx(re, im);
};
function cpow(a: C, b: C): C {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let r = cx(1);
    for (let k = 0; k < Math.abs(b.re); k++) r = mul(r, a);
    return b.re < 0 ? div(cx(1), r) : r;
  }
  if (a.im === 0 && b.im === 0 && a.re >= 0) return cx(Math.pow(a.re, b.re));
  if (a.im === 0 && b.im === 0 && a.re < 0) {
    // reálná lichá odmocnina záporného čísla, např. (-8)^(1/3)
    const inv = 1 / b.re;
    if (Number.isInteger(inv) && inv % 2 !== 0) return cx(-Math.pow(-a.re, b.re));
  }
  const r = Math.hypot(a.re, a.im);
  if (r === 0) return cx(0);
  const th = Math.atan2(a.im, a.re);
  const lnr = Math.log(r);
  const mag = Math.exp(b.re * lnr - b.im * th);
  const ang = b.im * lnr + b.re * th;
  return cx(mag * Math.cos(ang), mag * Math.sin(ang));
}

type Vars = Record<string, number>;
type Node = (v: Vars) => C;

export class ParseError extends Error {}

/** Sjednocení zápisu – unicode znaky, mezery, slova. */
export function normalize(s: string): string {
  return s
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[·×⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\bpi\b/gi, 'π')
    .replace(/sqrt/gi, '√')
    .replace(/\s+/g, '');
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const num = /^(\d+(\.\d+)?|\.\d+)/.exec(s.slice(i));
    if (num) {
      out.push(num[0]);
      i += num[0].length;
    } else if ('+-*/^()√πixy|:'.includes(ch)) {
      out.push(ch === ':' ? '/' : ch);
      i++;
    } else {
      throw new ParseError(`Nerozumím znaku „${ch}“`);
    }
  }
  return out;
}

/** Zkompiluje výraz na funkci proměnných. */
export function compile(input: string): Node {
  const tokens = tokenize(normalize(input).replace(/,/g, '.'));
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const startsAtom = (t?: string) => t !== undefined && (/^[\d.]/.test(t) || '(√πixy|'.includes(t));

  function expr(): Node {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = term();
      const l = left;
      left = op === '+' ? (v) => add(l(v), right(v)) : (v) => sub(l(v), right(v));
    }
    return left;
  }
  function term(): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t === '*' || t === '/') {
        next();
        const right = unary();
        const l = left;
        left = t === '*' ? (v) => mul(l(v), right(v)) : (v) => div(l(v), right(v));
      } else if (startsAtom(t) && !(t === '|' && absDepth > 0)) {
        const right = power();
        const l = left;
        left = (v) => mul(l(v), right(v));
      } else break;
    }
    return left;
  }
  function unary(): Node {
    if (peek() === '-') {
      next();
      const f = unary();
      return (v) => sub(cx(0), f(v));
    }
    if (peek() === '+') {
      next();
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek() === '^') {
      next();
      const exp = unary();
      return (v) => cpow(base(v), exp(v));
    }
    return base;
  }
  let absDepth = 0;
  function atom(): Node {
    const t = next();
    if (t === undefined) throw new ParseError('Výraz je neúplný');
    if (/^[\d.]/.test(t)) {
      const n = Number(t);
      return () => cx(n);
    }
    if (t === 'π') return () => cx(Math.PI);
    if (t === 'i') return () => cx(0, 1);
    if (t === 'x' || t === 'y') return (v) => {
      if (!(t in v)) throw new ParseError(`Proměnná ${t} sem nepatří`);
      return cx(v[t]);
    };
    if (t === '(') {
      const e = expr();
      if (next() !== ')') throw new ParseError('Chybí závorka )');
      return e;
    }
    if (t === '|') {
      absDepth++;
      const e = expr();
      absDepth--;
      if (next() !== '|') throw new ParseError('Chybí uzavírací |');
      return (v) => {
        const z = e(v);
        return cx(Math.hypot(z.re, z.im));
      };
    }
    if (t === '√') {
      const a = power();
      return (v) => csqrt(a(v));
    }
    throw new ParseError(`Nečekaný znak „${t}“`);
  }

  const node = expr();
  if (pos < tokens.length) throw new ParseError(`Nečekaný znak „${tokens[pos]}“`);
  return node;
}

export function evaluate(input: string, vars: Vars = {}): C {
  const v = compile(input)(vars);
  if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) throw new ParseError('Výsledek není číslo');
  return v;
}

export function evalReal(input: string): number {
  const v = evaluate(input);
  if (Math.abs(v.im) > 1e-9) throw new ParseError('Očekávám reálné číslo');
  return v.re;
}

/** Tolerance podle počtu desetinných míst, která uživatel napsal (0,33 ≈ 1/3). */
export function toleranceFor(input: string): number {
  const decs = [...input.matchAll(/\d[.,](\d+)/g)].map((m) => m[1].length);
  const d = decs.length ? Math.max(...decs) : 0;
  return d >= 2 ? 0.51 * Math.pow(10, -d) + 1e-9 : DEFAULT_TOL;
}

const DEFAULT_TOL = 1e-6;

/** Porovnání: výchozí tolerance je relativní, u zaokrouhlených vstupů absolutní. */
export function close(a: C, b: C, tol: number = DEFAULT_TOL): boolean {
  const scale = tol <= DEFAULT_TOL ? Math.max(1, Math.abs(b.re), Math.abs(b.im)) : 1;
  return Math.abs(a.re - b.re) <= tol * scale + 1e-12 && Math.abs(a.im - b.im) <= tol * scale + 1e-12;
}

const EMPTY_WORDS = /^(∅|\{\}|ø|nemářešení|nemareseni|žádné|zadne|žádnéřešení|zadnereseni|prázdnámnožina|prazdnamnozina)$/i;

/** Rozdělí seznam hodnot: preferuje středník, jinak čárku. */
export function splitList(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  // Desetinnou čárku v seznamu jde použít jen se středníkem jako oddělovačem.
  const parts = t.includes(';') ? t.split(';') : t.split(',');
  return parts.map((p) => p.trim()).filter(Boolean);
}

const stripName = (s: string) => s.replace(/^[a-zA-Z][a-zA-Z0-9₀-₉_,]*\s*=\s*/, '');

export function parseSet(input: string): C[] {
  let s = input.trim().replace(/^\s*K\s*=\s*/i, '');
  if (EMPTY_WORDS.test(s.replace(/\s+/g, ''))) return [];
  s = s.replace(/^\{/, '').replace(/\}$/, '').replace(/\s+nebo\s+/gi, ';');
  if (EMPTY_WORDS.test(s.replace(/\s+/g, ''))) return [];
  const out: C[] = [];
  for (const raw of splitList(s)) {
    const p = stripName(raw);
    if (p.startsWith('±')) {
      const v = evaluate(p.slice(1));
      out.push(v, cx(-v.re, -v.im));
    } else if (/^[^±]+±/.test(p)) {
      const [a, b] = p.split('±');
      const va = evaluate(a);
      const vb = evaluate(b);
      out.push(add(va, vb), sub(va, vb));
    } else out.push(evaluate(p));
  }
  return out;
}

export function parseTuple(input: string): number[] {
  let s = input.trim().replace(/^[A-Za-z]\s*=\s*/, '').replace(/^\[\s*[a-z]\s*[;,]\s*[a-z]\s*\]\s*=\s*/i, '');
  if (/^[([<⟨]/.test(s) && /[)\]>⟩]$/.test(s)) s = s.slice(1, -1);
  return splitList(s).map((p) => evalReal(stripName(p)));
}

export interface Interval { lo: number; hi: number; loC: boolean; hiC: boolean }

const INF = /^\+?(∞|inf|oo|nekonečno|nekonecno)$/i;
const NINF = /^-(∞|inf|oo|nekonečno|nekonecno)$/i;
const endpoint = (s: string) => (INF.test(s) ? Infinity : NINF.test(s) ? -Infinity : evalReal(s));

export function parseIntervals(input: string): Interval[] {
  const s = input.trim().replace(/^\s*(K|D\(f\)|H\(f\)|x∈|x\s*∈)\s*=?\s*/i, '').replace(/\s+/g, '');
  if (/^(R|ℝ|\(-∞[;,]∞\))$/.test(s)) return [{ lo: -Infinity, hi: Infinity, loC: false, hiC: false }];
  if (EMPTY_WORDS.test(s)) return [];
  const parts = s.split(/∪|U|u/).filter(Boolean);
  const out: Interval[] = parts.map((p) => {
    const m = /^([([<⟨])(.+)([)\]>⟩])$/.exec(p);
    if (!m) throw new ParseError(`Interval „${p}“ zapiš se závorkami, např. (-∞; 2⟩`);
    const inner = m[2];
    const sep = inner.includes(';') ? ';' : ',';
    const pieces = inner.split(sep);
    if (pieces.length !== 2) throw new ParseError('Interval má mít dvě meze oddělené středníkem');
    const lo = endpoint(pieces[0]);
    const hi = endpoint(pieces[1]);
    if (lo > hi) throw new ParseError('Dolní mez je větší než horní');
    return { lo, hi, loC: m[1] !== '(' && Number.isFinite(lo), hiC: m[3] !== ')' && Number.isFinite(hi) };
  });
  return mergeIntervals(out);
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.lo - b.lo || Number(b.loC) - Number(a.loC));
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && (iv.lo < last.hi || (iv.lo === last.hi && (iv.loC || last.hiC)))) {
      if (iv.hi > last.hi || (iv.hi === last.hi && iv.hiC)) {
        last.hi = iv.hi;
        last.hiC = iv.hiC || (iv.hi === last.hi && last.hiC);
      }
    } else out.push({ ...iv });
  }
  return out;
}

function sameIntervals(a: Interval[], b: Interval[], tol: number): boolean {
  if (a.length !== b.length) return false;
  const eq = (x: number, y: number) => (x === y) || Math.abs(x - y) <= tol;
  return a.every((iv, k) => {
    const jv = b[k];
    return eq(iv.lo, jv.lo) && eq(iv.hi, jv.hi) && (!Number.isFinite(iv.lo) || iv.loC === jv.loC) && (!Number.isFinite(iv.hi) || iv.hiC === jv.hiC);
  });
}

export type Answer =
  | { kind: 'num'; value: C; input: string; tex: string }
  | { kind: 'set'; values: C[]; input: string; tex: string }
  | { kind: 'tuple'; values: number[]; names: string[]; input: string; tex: string }
  | { kind: 'interval'; value: Interval[]; input: string; tex: string }
  | { kind: 'expr'; f: (x: number) => number; input: string; tex: string }
  | { kind: 'line'; coef: [number, number, number]; input: string; tex: string };

export const ANSWER_HINT: Record<Answer['kind'], string> = {
  num: 'Číslo, zlomek nebo výraz: 3/4, 0,75, 2√3, 5π/6, 3+4i',
  set: 'Všechna řešení odděl středníkem: 2; -3 (žádné řešení: ∅)',
  tuple: 'Hodnoty v pořadí odděl středníkem: 2; -1',
  interval: 'Interval: (-∞; 2) ∪ ⟨3; ∞), ⟨ = <, ⟩ = >, ℝ = R',
  expr: 'Výraz v proměnné x: (x-1)/(x+2)',
  line: 'Rovnice přímky: 2x - 3y + 5 = 0 nebo y = 2x + 1',
};

export interface CheckResult { ok: boolean; error?: string }

/** Ověří odpověď uživatele vůči očekávané odpovědi, toleruje ekvivalentní zápisy. */
export function checkAnswer(ans: Answer, input: string): CheckResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Napiš odpověď' };
  const tol = toleranceFor(raw);
  try {
    switch (ans.kind) {
      case 'num': {
        const v = evaluate(stripName(raw));
        return { ok: close(v, ans.value, tol) };
      }
      case 'set': {
        const vals = parseSet(raw);
        const uniq: C[] = [];
        for (const v of vals) if (!uniq.some((u) => close(u, v, 1e-9))) uniq.push(v);
        if (uniq.length !== ans.values.length) return { ok: false };
        const used = new Set<number>();
        const ok = ans.values.every((e) => {
          const k = uniq.findIndex((u, j) => !used.has(j) && close(u, e, tol));
          if (k < 0) return false;
          used.add(k);
          return true;
        });
        return { ok };
      }
      case 'tuple': {
        const vals = parseTuple(raw);
        if (vals.length !== ans.values.length) return { ok: false, error: `Očekávám ${ans.values.length} hodnoty` };
        return { ok: vals.every((v, k) => close(cx(v), cx(ans.values[k]), tol)) };
      }
      case 'interval':
        return { ok: sameIntervals(parseIntervals(raw), ans.value, tol) };
      case 'expr': {
        const body = raw.includes('=') ? raw.slice(raw.lastIndexOf('=') + 1) : raw;
        const f = compile(body);
        const pts = [-2.7, -1.3, 0.37, 1.9, 3.3, 5.1, 7.7];
        let matched = 0;
        for (const x of pts) {
          const e = ans.f(x);
          if (!Number.isFinite(e)) continue;
          const u = f({ x });
          if (Math.abs(u.im) > 1e-9 || Math.abs(u.re - e) > 1e-6 * Math.max(1, Math.abs(e))) return { ok: false };
          matched++;
        }
        return { ok: matched >= 3 };
      }
      case 'line': {
        const [l, r = '0'] = raw.split('=');
        const L = compile(l);
        const R = compile(r);
        const f = (x: number, y: number) => sub(L({ x, y }), R({ x, y })).re;
        const c = f(0, 0);
        const a = f(1, 0) - c;
        const b = f(0, 1) - c;
        if (Math.abs(f(2, 3) - (2 * a + 3 * b + c)) > 1e-9 || Math.abs(f(-1, 5) - (-a + 5 * b + c)) > 1e-9) {
          return { ok: false, error: 'To není rovnice přímky' };
        }
        const [A, B, Cc] = ans.coef;
        const cross = (p: number, q: number, s: number, t: number) => Math.abs(p * t - q * s) < 1e-6 * Math.max(1, Math.abs(p * t));
        const ok = (a !== 0 || b !== 0) && cross(a, b, A, B) && cross(a, c, A, Cc) && cross(b, c, B, Cc);
        return { ok };
      }
    }
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message };
    return { ok: false, error: 'Odpověď se nepodařilo přečíst' };
  }
}
