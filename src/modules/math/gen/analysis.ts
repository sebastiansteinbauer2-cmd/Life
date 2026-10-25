import {
  ADV, ALL, approx, frac, fracAns, fadd, fmul, ftex, fval, intAns, intervalAns, iv, ntex, numAns, par, piTex,
  poly, q23, setAns, setAnsItems, surd, surdTex, tupleAns, xm, type Frac, type Q23, type Template,
} from '../core';
import { evaluate } from '../parse';

const inIvs = (x: number, ivs: { lo: number; hi: number; loC: boolean; hiC: boolean }[]) =>
  ivs.some((I) => (x > I.lo || (I.loC && x === I.lo)) && (x < I.hi || (I.hiC && x === I.hi)));

// ───────────── Funkce ─────────────

const linThrough: Template = {
  id: 'funkce-linearni', topic: 'funkce', name: 'Lineární funkce dvěma body', levels: ALL,
  generate(r, level) {
    const k = level === 'zaklad' ? frac(r.nz(-4, 4)) : frac(r.nz(-6, 6), r.pick([1, 2, 3]));
    const q = r.int(-8, 8);
    const x1 = r.int(-4, 2) * k.d, x2 = x1 + r.int(1, 3) * k.d;
    const y1 = fval(k) * x1 + q, y2 = fval(k) * x2 + q;
    return {
      question: `Graf lineární funkce $f(x) = kx + q$ prochází body $A[${x1}; ${y1}]$ a $B[${x2}; ${y2}]$. Urči $k$ a $q$ (zapiš $k; q$).`,
      answer: tupleAns([fval(k), q], ['k', 'q']),
      solution: [
        `$k = \\frac{y_B - y_A}{x_B - x_A} = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = ${ftex(k)}$`,
        `Dosaď bod $A$: $${y1} = ${ftex(k)}\\cdot${par(x1)} + q \\Rightarrow q = ${q}$`,
      ],
      verify: () => approx(fval(k) * x1 + q, y1) && approx(fval(k) * x2 + q, y2),
    };
  },
};

const vertex: Template = {
  id: 'funkce-vrchol', topic: 'funkce', name: 'Vrchol paraboly', levels: ALL,
  generate(r) {
    const a = r.pick([1, -1, 2, -2, 3]), m = r.int(-5, 5), n = r.int(-9, 9);
    const B = -2 * a * m, Cc = a * m * m + n;
    const f = (x: number) => a * x * x + B * x + Cc;
    return {
      question: `Urči souřadnice vrcholu paraboly $y = ${poly([a, B, Cc])}$ (zapiš $x; y$).`,
      answer: tupleAns([m, n], ['x', 'y']),
      solution: [
        `$x_V = -\\frac{b}{2a} = -\\frac{${B}}{${2 * a}} = ${m}$`,
        `$y_V = f(${m}) = ${n}$ (nebo doplněním na čtverec: $y = ${a === 1 ? '' : a === -1 ? '-' : a}(${xm(m)})^2 ${n < 0 ? '-' : '+'} ${Math.abs(n)}$)`,
      ],
      verify: () => approx(f(m), n) && approx(f(m + 1.3), f(m - 1.3)),
    };
  },
};

const range: Template = {
  id: 'funkce-obor-hodnot', topic: 'funkce', name: 'Obor hodnot kvadratické funkce', levels: ALL,
  generate(r) {
    const a = r.pick([1, -1, 2, -3]), m = r.int(-5, 5), n = r.int(-9, 9);
    const B = -2 * a * m, Cc = a * m * m + n;
    const ans = intervalAns([a > 0 ? iv(n, Infinity, true) : iv(-Infinity, n, false, true)]);
    return {
      question: `Urči obor hodnot funkce $f(x) = ${poly([a, B, Cc])}$.`,
      answer: ans,
      solution: [
        `Vrchol: $x_V = ${m}$, $y_V = f(${m}) = ${n}$`,
        `Parabola je otevřená ${a > 0 ? 'nahoru → minimum' : 'dolů → maximum'} $${n}$.`,
        `$H(f) = ${ans.tex}$`,
      ],
      verify: () => {
        const f = (x: number) => a * x * x + B * x + Cc;
        return approx(f(m), n) && [m - 3, m + 2, m + 7].every((x) => (a > 0 ? f(x) > n : f(x) < n));
      },
    };
  },
};

const domain: Template = {
  id: 'funkce-def-obor', topic: 'funkce', name: 'Definiční obor', levels: ALL,
  generate(r, level) {
    const variant = level === 'zaklad' ? 0 : r.int(0, 2);
    if (variant === 2) {
      const c = r.int(1, 6);
      const ivs = [iv(-Infinity, -c), iv(c, Infinity)];
      const ans = intervalAns(ivs);
      return {
        question: `Urči definiční obor funkce $f(x) = \\dfrac{1}{\\sqrt{x^2 - ${c * c}}}$.`,
        answer: ans,
        solution: [`Pod odmocninou ve jmenovateli musí být kladné číslo: $x^2 - ${c * c} > 0$`, `$|x| > ${c}$, tedy $D(f) = ${ans.tex}$`],
        verify: () => [-c - 1, -c, 0, c, c + 0.5].every((x) => (x * x - c * c > 0) === inIvs(x, ivs)),
      };
    }
    const a = r.int(-6, 4);
    const b = a + r.int(1, 5);
    const flip = variant === 1;
    // flip: √(b - x)/(x - a), jinak √(x - a)/(x - b)
    const ivs = flip ? [iv(-Infinity, a), iv(a, b, false, true)] : [iv(a, b, true, false), iv(b, Infinity)];
    const ans = intervalAns(ivs);
    const ok = (x: number) => (flip ? b - x >= 0 && x !== a : x - a >= 0 && x !== b);
    return {
      question: flip
        ? `Urči definiční obor funkce $f(x) = \\dfrac{\\sqrt{${poly([-1, b])}}}{${xm(a)}}$.`
        : `Urči definiční obor funkce $f(x) = \\dfrac{\\sqrt{${xm(a)}}}{${xm(b)}}$.`,
      answer: ans,
      solution: flip
        ? [`Odmocnina: $${poly([-1, b])} \\ge 0 \\Rightarrow x \\le ${b}$`, `Jmenovatel: $x \\ne ${a}$`, `$D(f) = ${ans.tex}$`]
        : [`Odmocnina: $${xm(a)} \\ge 0 \\Rightarrow x \\ge ${a}$`, `Jmenovatel: $x \\ne ${b}$`, `$D(f) = ${ans.tex}$`],
      verify: () => [a - 1, a, (a + b) / 2, b, b + 1].every((x) => ok(x) === inIvs(x, ivs)),
    };
  },
};

const inverse: Template = {
  id: 'funkce-inverzni', topic: 'funkce', name: 'Inverzní funkce', levels: ALL,
  generate(r, level) {
    if (level === 'zaklad') {
      const a = r.nz(-5, 5), b = r.int(-9, 9), x0 = r.int(-6, 6);
      const c = a * x0 + b;
      return {
        question: `Je dána funkce $f(x) = ${poly([a, b])}$. Vypočítej $f^{-1}(${c})$.`,
        answer: intAns(x0),
        solution: [`$f^{-1}(${c})$ je takové $x$, pro které $f(x) = ${c}$.`, `$${poly([a, b])} = ${c} \\Rightarrow x = ${x0}$`],
        verify: () => a * x0 + b === c,
      };
    }
    // f(x) = (p·x + 1)/(x - s): f^{-1}(c) = (s·c + 1)/(c - p)
    const p = r.int(1, 4), s = r.int(1, 5);
    let c = r.int(-6, 8);
    if (c === p) c = p + 1;
    const x0 = frac(s * c + 1, c - p);
    return {
      question: `Je dána funkce $f(x) = \\dfrac{${poly([p, 1])}}{${xm(s)}}$. Vypočítej $f^{-1}(${c})$.`,
      answer: fracAns(x0),
      solution: [
        `Řeš $\\frac{${poly([p, 1])}}{${xm(s)}} = ${c}$`,
        `$${poly([p, 1])} = ${c}x - ${par(c * s)}$`,
        `$x(${p} - ${par(c)}) = ${-c * s} - 1 \\Rightarrow x = ${ftex(x0)}$`,
      ],
      verify: () => approx((p * fval(x0) + 1) / (fval(x0) - s), c),
    };
  },
};

const compose: Template = {
  id: 'funkce-slozena', topic: 'funkce', name: 'Složená funkce', levels: ALL,
  generate(r) {
    const a = r.nz(-4, 4), b = r.int(-6, 6), c = r.int(-5, 5), v = r.int(-4, 4);
    const f = (x: number) => a * x + b;
    const g = (x: number) => x * x + c;
    const ans = a * (v * v + c) + b;
    return {
      question: `$f(x) = ${poly([a, b])}$, $g(x) = ${poly([1, 0, c])}$. Vypočítej $f(g(${v}))$.`,
      answer: intAns(ans),
      solution: [`$g(${v}) = ${par(v)}^2 ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${g(v)}$`, `$f(${g(v)}) = ${a}\\cdot${par(g(v))} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${ans}$`],
      verify: () => f(g(v)) === ans,
    };
  },
};

// ───────────── Exponenciály a logaritmy ─────────────

const expEq: Template = {
  id: 'explog-exp-rovnice', topic: 'explog', name: 'Exponenciální rovnice', levels: ALL,
  generate(r, level) {
    const b = r.pick([2, 3, 5]);
    if (level === 'zaklad') {
      const x0 = r.int(-3, 4), m = r.pick([1, 2, -1]), n = r.int(-3, 3);
      const E = m * x0 + n;
      if (Math.abs(E) > 4) return expEq.generate(r, level);
      const rhs = E >= 0 ? String(b ** E) : `\\frac{1}{${b ** -E}}`;
      return {
        question: `Řeš v $\\mathbb{R}$: $${b}^{${poly([m, n])}} = ${rhs}$`,
        answer: setAns([x0]),
        solution: [`Pravou stranu zapiš jako mocninu ${b}: $${rhs} = ${b}^{${E}}$`, `Porovnej exponenty: $${poly([m, n])} = ${E} \\Rightarrow x = ${x0}$`],
        verify: () => approx(b ** (m * x0 + n), b ** E),
      };
    }
    // (b^p)^(x + u) = (b^q)^(x + w)
    const [p, q] = r.distinct(2, 1, 3);
    const u = r.int(-3, 3), w = r.int(-3, 3);
    const x0 = frac(q * w - p * u, p - q);
    return {
      question: `Řeš v $\\mathbb{R}$: $${b ** p}^{${xm(-u)}} = ${b ** q}^{${xm(-w)}}$`,
      answer: setAns([fval(x0)]),
      solution: [
        `Převeď na základ ${b}: $${b}^{${p}(${xm(-u)})} = ${b}^{${q}(${xm(-w)})}$`,
        `$${p}(${xm(-u)}) = ${q}(${xm(-w)})$`,
        `$x = ${ftex(x0)}$`,
      ],
      verify: () => approx(Math.log(b ** p) * (fval(x0) + u), Math.log(b ** q) * (fval(x0) + w)),
    };
  },
};

const expSubst: Template = {
  id: 'explog-substituce', topic: 'explog', name: 'Exponenciální rovnice substitucí', levels: ADV,
  generate(r, level) {
    const b = r.pick([2, 3, 5]);
    const e1 = r.int(-1, 3);
    let e2 = r.int(-1, 3);
    if (e2 === e1) e2 = e1 + 1;
    const t1 = b ** e1;
    // na FIT někdy jeden kořen t < 0 (bez řešení)
    const negative = level === 'fit' && r.next() < 0.4;
    const t2 = negative ? -r.int(1, 4) : b ** e2;
    const S = t1 + t2, P = t1 * t2;
    if (!Number.isInteger(S) || !Number.isInteger(P) || Math.abs(P) > 200) return expSubst.generate(r, level);
    const xs = negative ? [e1] : [e1, e2];
    const ans = setAns(xs);
    return {
      question: `Řeš v $\\mathbb{R}$: $${b * b}^{x} ${S > 0 ? '-' : '+'} ${Math.abs(S)}\\cdot ${b}^{x} ${P < 0 ? '-' : '+'} ${Math.abs(P)} = 0$`,
      answer: ans,
      solution: [
        `Substituce $t = ${b}^x > 0$: $t^2 ${S > 0 ? '-' : '+'} ${Math.abs(S)}t ${P < 0 ? '-' : '+'} ${Math.abs(P)} = 0$`,
        `$t_1 = ${t1}$, $t_2 = ${t2}$`,
        negative ? `$t_2 < 0$ nevyhovuje. $${b}^x = ${t1} \\Rightarrow x = ${e1}$` : `$${b}^x = ${t1} \\Rightarrow x = ${e1}$; $${b}^x = ${ntex(t2)} \\Rightarrow x = ${e2}$`,
      ],
      verify: () => xs.every((x) => approx((b * b) ** x - S * b ** x + P, 0)),
    };
  },
};

const logValue: Template = {
  id: 'explog-hodnota', topic: 'explog', name: 'Výpočet logaritmů', levels: ALL,
  generate(r, level) {
    const terms: { coef: number; base: number; e: Frac; argTex: string }[] = [];
    const n = level === 'zaklad' ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const base = r.pick([2, 3, 5, 10]);
      const coef = i === 0 ? 1 : r.pick([1, -1, 2]);
      let e: Frac;
      let argTex: string;
      if (level !== 'zaklad' && r.next() < 0.35) {
        const k = r.int(1, 3);
        e = frac(k, 2);
        argTex = k === 1 ? `\\sqrt{${base}}` : `\\sqrt{${base ** k}}`;
      } else {
        const k = r.int(-3, base === 10 ? 3 : 4);
        e = frac(k);
        argTex = k >= 0 ? String(base ** k) : `\\frac{1}{${base ** -k}}`;
      }
      terms.push({ coef, base, e, argTex });
    }
    const total = terms.reduce((s, t) => fadd(s, fmul(frac(t.coef), t.e)), frac(0));
    const logT = (t: (typeof terms)[number]) => (t.base === 10 ? `\\log ${t.argTex}` : `\\log_{${t.base}} ${t.argTex}`);
    const q = terms.map((t, i) => `${i === 0 ? '' : t.coef < 0 ? ' - ' : ' + '}${Math.abs(t.coef) === 1 ? '' : Math.abs(t.coef)}${logT(t)}`).join('');
    return {
      question: `Vypočítej: $${q}$`,
      answer: fracAns(total),
      solution: [
        ...terms.map((t) => `$${logT(t)} = ${ftex(t.e)}$, protože $${t.base}^{${ftex(t.e)}} = ${t.argTex}$`),
        `Celkem: $${ftex(total)}$`,
      ],
      verify: () => {
        const v = terms.reduce((s, t) => s + t.coef * (Math.log(t.base ** fval(t.e)) / Math.log(t.base)), 0);
        return approx(v, fval(total), 1e-9);
      },
    };
  },
};

const logEq: Template = {
  id: 'explog-log-rovnice', topic: 'explog', name: 'Logaritmická rovnice', levels: ALL,
  generate(r, level) {
    const b = r.pick([2, 3, 5]);
    if (level === 'zaklad') {
      const k = r.int(0, b === 5 ? 2 : 4), a = r.int(-6, 6);
      const x0 = b ** k - a;
      return {
        question: `Řeš v $\\mathbb{R}$: $\\log_{${b}}(${xm(-a)}) = ${k}$`,
        answer: setAns([x0]),
        solution: [`Z definice: $${xm(-a)} = ${b}^{${k}} = ${b ** k}$`, `$x = ${x0}$ (zkouška: argument $${b ** k} > 0$ ✓)`],
        verify: () => approx(Math.log(x0 + a) / Math.log(b), k),
      };
    }
    const k = r.int(2, b === 2 ? 6 : 3);
    const N = b ** k;
    const divs = [];
    for (let d = 1; d <= N; d++) if (N % d === 0 && d !== N / d) divs.push(d);
    const x0 = r.pick(divs);
    const a = N / x0 - x0;
    return {
      question: `Řeš v $\\mathbb{R}$: $\\log_{${b}} x + \\log_{${b}}(${xm(-a)}) = ${k}$`,
      answer: setAns([x0]),
      solution: [
        `Podmínky: $x > 0$, $${xm(-a)} > 0$`,
        `$\\log_{${b}} [x(${xm(-a)})] = ${k} \\Rightarrow ${poly([1, a, 0])} = ${N}$`,
        `$${poly([1, a, -N])} = 0 \\Rightarrow x_1 = ${x0}$, $x_2 = ${-N / x0}$`,
        `$x_2$ nesplňuje podmínky, $K = \\{${x0}\\}$`,
      ],
      verify: () => x0 > 0 && x0 + a > 0 && approx((Math.log(x0) + Math.log(x0 + a)) / Math.log(b), k) && -N / x0 <= 0,
    };
  },
};

const logDomain: Template = {
  id: 'explog-def-obor', topic: 'explog', name: 'Definiční obor logaritmu', levels: ADV,
  generate(r) {
    const [a, b] = r.distinct(2, -6, 6).sort((x, y) => x - y);
    const inside = r.next() < 0.5;
    const ivs = inside ? [iv(a, b)] : [iv(-Infinity, a), iv(b, Infinity)];
    const ans = intervalAns(ivs);
    const coefs = inside ? [-1, a + b, -a * b] : [1, -(a + b), a * b];
    const g = (x: number) => coefs[0] * x * x + coefs[1] * x + coefs[2];
    return {
      question: `Urči definiční obor funkce $f(x) = \\log(${poly(coefs)})$.`,
      answer: ans,
      solution: [`Argument logaritmu musí být kladný: $${poly(coefs)} > 0$`, `Kořeny: $${a}$ a $${b}$, parabola otevřená ${inside ? 'dolů' : 'nahoru'}.`, `$D(f) = ${ans.tex}$`],
      verify: () => [a - 1, a, (a + b) / 2, b, b + 1].every((x) => (g(x) > 0) === inIvs(x, ivs)),
    };
  },
};

// ───────────── Goniometrie ─────────────

type TrigF = 'sin' | 'cos' | 'tg';
const EXACT: { v: number; q: Q23 }[] = [];
for (const s of [1, -1]) {
  const add = (v: number, q: Q23) => EXACT.push({ v: s * v, q: q.map((f) => frac(s * f.n, f.d)) as Q23 });
  add(0.5, [frac(1, 2), frac(0), frac(0)]);
  add(1, [frac(1), frac(0), frac(0)]);
  add(Math.SQRT2 / 2, [frac(0), frac(1, 2), frac(0)]);
  add(Math.sqrt(3) / 2, [frac(0), frac(0), frac(1, 2)]);
  add(Math.sqrt(3) / 3, [frac(0), frac(0), frac(1, 3)]);
  add(Math.sqrt(3), [frac(0), frac(0), frac(1)]);
}
EXACT.push({ v: 0, q: [frac(0), frac(0), frac(0)] });
const exactOf = (x: number): Q23 => {
  const e = EXACT.find((e) => Math.abs(e.v - x) < 1e-9);
  if (!e) throw new Error(`není tabulková hodnota: ${x}`);
  return e.q;
};
const trig = (f: TrigF, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return f === 'sin' ? Math.sin(rad) : f === 'cos' ? Math.cos(rad) : Math.tan(rad);
};
const angleTex = (deg: number, rad: boolean) => (rad ? piTex(frac(deg, 180)).tex : `${deg}^\\circ`);

const exactValues: Template = {
  id: 'gonio-hodnoty', topic: 'gonio', name: 'Hodnoty goniometrických funkcí', levels: ALL,
  generate(r, level) {
    const rad = level !== 'zaklad';
    const angles = level === 'zaklad' ? [0, 30, 45, 60, 90] : [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    const terms: { c: number; f: TrigF; d: number }[] = [];
    for (let i = 0; i < 2 + (level === 'fit' ? 1 : 0); i++) {
      const f = r.pick(['sin', 'cos', 'tg'] as TrigF[]);
      let d = r.pick(angles);
      while (f === 'tg' && d % 180 === 90) d = r.pick(angles);
      terms.push({ c: i === 0 ? 1 : r.pick([1, -1, 2]), f, d });
    }
    const total = terms.reduce<Q23>((acc, t) => {
      const q = exactOf(trig(t.f, t.d));
      return acc.map((a, k) => fadd(a, fmul(frac(t.c), q[k]))) as Q23;
    }, [frac(0), frac(0), frac(0)]);
    const res = q23(total);
    const fn = (f: TrigF) => (f === 'tg' ? '\\operatorname{tg}' : `\\${f}`);
    const q = terms.map((t, i) => `${i === 0 ? '' : t.c < 0 ? ' - ' : ' + '}${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${fn(t.f)} ${angleTex(t.d, rad)}`).join('');
    return {
      question: `Vypočítej přesně: $${q}$`,
      answer: numAns(res.value, res.input, res.tex),
      solution: [
        ...terms.map((t) => `$${fn(t.f)} ${angleTex(t.d, rad)} = ${q23(exactOf(trig(t.f, t.d))).tex}$`),
        `Výsledek: $${res.tex}$`,
      ],
      verify: () => approx(terms.reduce((s, t) => s + t.c * trig(t.f, t.d), 0), evaluate(res.input).re, 1e-9),
    };
  },
};

const degRad: Template = {
  id: 'gonio-stupne', topic: 'gonio', name: 'Stupně a radiány', levels: ['zaklad', 'rozsireny'],
  generate(r) {
    const d = r.pick([15, 30, 36, 45, 60, 72, 90, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330, 450]);
    const p = piTex(frac(d, 180));
    if (r.next() < 0.5) {
      return {
        question: `Převeď $${d}^\\circ$ na radiány.`,
        answer: numAns((d * Math.PI) / 180, p.input, p.tex),
        solution: [`$${d}^\\circ = ${d}\\cdot\\frac{\\pi}{180} = ${p.tex}$`],
        verify: () => approx(evaluate(p.input).re * (180 / Math.PI), d),
      };
    }
    return {
      question: `Převeď $${p.tex}$ rad na stupně (zapiš jen číslo).`,
      answer: intAns(d),
      solution: [`$${p.tex} \\cdot \\frac{180^\\circ}{\\pi} = ${d}^\\circ$`],
      verify: () => approx((d / 180) * Math.PI, evaluate(p.input).re),
    };
  },
};

const trigEq: Template = {
  id: 'gonio-rovnice', topic: 'gonio', name: 'Goniometrická rovnice', levels: ALL,
  generate(r, level) {
    const all = Array.from({ length: 24 }, (_, k) => k * 15).filter((d) => d % 30 === 0 || d % 45 === 0);
    const sols = (f: TrigF, v: number) => all.filter((d) => !(f === 'tg' && d % 180 === 90) && Math.abs(trig(f, d) - v) < 1e-9);
    const asSet = (degs: number[]) => setAnsItems([...new Set(degs)].map((d) => ({ value: (d * Math.PI) / 180, ...piTex(frac(d, 180)) })));
    if (level === 'fit' && r.next() < 0.6) {
      const f = r.pick(['sin', 'cos'] as TrigF[]);
      const [t1, t2] = r.shuffle([-1, -0.5, 0, 0.5, 1]).slice(0, 2);
      // 2(t - t1)(t - t2) = 2t² - 2(t1+t2)t + 2t1t2, případně ×2 pro celé koeficienty
      let A = 2, B = -2 * (t1 + t2), Cc = 2 * t1 * t2;
      if (!Number.isInteger(Cc) || !Number.isInteger(B)) { A *= 2; B *= 2; Cc *= 2; }
      const degs = [...sols(f, t1), ...sols(f, t2)];
      const ans = asSet(degs);
      const fx = `\\${f}`;
      return {
        question: `Řeš v intervalu $\\langle 0; 2\\pi)$: $${A}${fx}^2 x${B ? ` ${B < 0 ? '-' : '+'} ${Math.abs(B) === 1 ? '' : Math.abs(B)}${fx} x` : ''}${Cc ? ` ${Cc < 0 ? '-' : '+'} ${Math.abs(Cc)}` : ''} = 0$`,
        answer: ans,
        solution: [
          `Substituce $t = ${fx} x$: $${poly([A, B, Cc], 't')} = 0$`,
          `$t_1 = ${ntex(t1)}$, $t_2 = ${ntex(t2)}$`,
          `$${fx} x = ${ntex(t1)}$ nebo $${fx} x = ${ntex(t2)}$`,
          `$K = ${ans.tex}$`,
        ],
        verify: () => ans.kind === 'set' && ans.values.every((v) => approx(A * trig(f, (v.re * 180) / Math.PI) ** 2 + B * trig(f, (v.re * 180) / Math.PI) + Cc, 0)) && degs.length > 0,
      };
    }
    const f = level === 'zaklad' ? r.pick(['sin', 'cos'] as TrigF[]) : r.pick(['sin', 'cos', 'tg'] as TrigF[]);
    const values = f === 'tg' ? [1, -1, Math.sqrt(3), -Math.sqrt(3), Math.sqrt(3) / 3] : [0.5, -0.5, Math.SQRT2 / 2, -Math.SQRT2 / 2, Math.sqrt(3) / 2, -Math.sqrt(3) / 2, 1, 0];
    const v = r.pick(values);
    const degs = sols(f, v);
    const ans = asSet(degs);
    const fx = f === 'tg' ? '\\operatorname{tg}' : `\\${f}`;
    const vt = q23(exactOf(v)).tex;
    return {
      question: `Řeš v intervalu $\\langle 0; 2\\pi)$: $${fx}\\, x = ${vt}$`,
      answer: ans,
      solution: [
        `Základní úhel z tabulky: $${fx}\\, x_0 = ${q23(exactOf(Math.abs(v))).tex}$`,
        `Podle znaménka v kvadrantech: $K = ${ans.tex}$`,
      ],
      verify: () => degs.length > 0 && degs.every((d) => approx(trig(f, d), v)),
    };
  },
};

const SINS: Record<number, { k: number; m: number; d: number }> = {
  30: { k: 1, m: 1, d: 2 }, 150: { k: 1, m: 1, d: 2 }, 45: { k: 1, m: 2, d: 2 }, 135: { k: 1, m: 2, d: 2 },
  60: { k: 1, m: 3, d: 2 }, 120: { k: 1, m: 3, d: 2 }, 90: { k: 1, m: 1, d: 1 },
};

const sineRule: Template = {
  id: 'gonio-sinova', topic: 'gonio', name: 'Sinová věta', levels: ALL,
  generate(r) {
    const angles = Object.keys(SINS).map(Number);
    let al = r.pick(angles), be = r.pick(angles);
    while (al + be >= 180 || al === be) { al = r.pick(angles); be = r.pick(angles); }
    const a = r.int(2, 12);
    const sa = SINS[al], sb = SINS[be];
    // b = a·sinβ/sinα = a·(√mβ/dβ)/(√mα/dα) = a·dα·√(mα·mβ)/(dβ·mα)
    const { k, m } = surd(sa.m * sb.m);
    const res = surdTex(a * sa.d * k, m, sb.d * sa.m);
    return {
      question: `V trojúhelníku $ABC$ je $a = ${a}$ cm, $\\alpha = ${al}^\\circ$, $\\beta = ${be}^\\circ$. Vypočítej délku strany $b$ (v cm, přesně).`,
      answer: numAns((a * Math.sin((be * Math.PI) / 180)) / Math.sin((al * Math.PI) / 180), res.input, res.tex),
      solution: [
        `Sinová věta: $\\frac{a}{\\sin\\alpha} = \\frac{b}{\\sin\\beta} \\Rightarrow b = \\frac{a\\sin\\beta}{\\sin\\alpha}$`,
        `$b = \\frac{${a}\\cdot \\sin ${be}^\\circ}{\\sin ${al}^\\circ} = ${res.tex}$ cm`,
      ],
      verify: () => approx(evaluate(res.input).re / Math.sin((be * Math.PI) / 180), a / Math.sin((al * Math.PI) / 180)),
    };
  },
};

const cosineRule: Template = {
  id: 'gonio-kosinova', topic: 'gonio', name: 'Kosinová věta', levels: ALL,
  generate(r, level) {
    if (level !== 'zaklad' && r.next() < 0.5) {
      // úhel ze tří stran
      for (;;) {
        const b = r.int(2, 15), c = r.int(2, 15);
        const al = r.pick([60, 120]);
        const a2 = b * b + c * c + (al === 60 ? -b * c : b * c);
        const a = Math.round(Math.sqrt(a2));
        if (a * a !== a2 || b === c) continue;
        return {
          question: `Trojúhelník má strany $a = ${a}$, $b = ${b}$, $c = ${c}$. Urči velikost úhlu $\\alpha$ ve stupních.`,
          answer: intAns(al),
          solution: [
            `$\\cos\\alpha = \\frac{b^2 + c^2 - a^2}{2bc} = \\frac{${b * b} + ${c * c} - ${a2}}{${2 * b * c}} = ${al === 60 ? '\\frac12' : '-\\frac12'}$`,
            `$\\alpha = ${al}^\\circ$`,
          ],
          verify: () => approx(Math.cos((al * Math.PI) / 180), (b * b + c * c - a * a) / (2 * b * c)),
        };
      }
    }
    const b = r.int(2, 12), c = r.int(2, 12);
    const al = r.pick([60, 90, 120]);
    const N = b * b + c * c - 2 * b * c * Math.round(Math.cos((al * Math.PI) / 180) * 2) / 2;
    const { k, m } = surd(N);
    const res = surdTex(k, m);
    return {
      question: `V trojúhelníku je $b = ${b}$, $c = ${c}$ a $\\alpha = ${al}^\\circ$. Vypočítej stranu $a$ (přesně).`,
      answer: numAns(Math.sqrt(N), res.input, res.tex),
      solution: [
        `Kosinová věta: $a^2 = b^2 + c^2 - 2bc\\cos\\alpha$`,
        `$a^2 = ${b * b} + ${c * c} - 2\\cdot${b}\\cdot${c}\\cdot ${al === 60 ? '\\frac12' : al === 90 ? '0' : '(-\\frac12)'} = ${N}$`,
        `$a = \\sqrt{${N}} = ${res.tex}$`,
      ],
      verify: () => approx(evaluate(res.input).re ** 2, b * b + c * c - 2 * b * c * Math.cos((al * Math.PI) / 180)),
    };
  },
};

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];

const identity: Template = {
  id: 'gonio-vztahy', topic: 'gonio', name: 'Vztahy mezi funkcemi', levels: ADV,
  generate(r) {
    const [p, q, h] = r.pick(TRIPLES);
    const quad = r.int(1, 4);
    const [lo, hi] = [[0, '\\frac{\\pi}{2}'], ['\\frac{\\pi}{2}', '\\pi'], ['\\pi', '\\frac{3\\pi}{2}'], ['\\frac{3\\pi}{2}', '2\\pi']][quad - 1];
    const sinSign = quad <= 2 ? 1 : -1;
    const cosSign = quad === 1 || quad === 4 ? 1 : -1;
    const sinV = frac(sinSign * p, h), cosV = frac(cosSign * q, h);
    const ask = r.pick(['cos', 'tg'] as const);
    const res = ask === 'cos' ? cosV : frac(sinSign * cosSign * p, q);
    return {
      question: `Je dáno $\\sin\\alpha = ${ftex(sinV)}$ a $\\alpha \\in (${lo}; ${hi})$. Vypočítej $${ask === 'cos' ? '\\cos' : '\\operatorname{tg}'}\\,\\alpha$.`,
      answer: fracAns(res),
      solution: [
        `$\\cos^2\\alpha = 1 - \\sin^2\\alpha = 1 - \\frac{${p * p}}{${h * h}} = \\frac{${q * q}}{${h * h}}$`,
        `V ${quad}. kvadrantu je kosinus ${cosSign > 0 ? 'kladný' : 'záporný'}: $\\cos\\alpha = ${ftex(cosV)}$`,
        ...(ask === 'tg' ? [`$\\operatorname{tg}\\alpha = \\frac{\\sin\\alpha}{\\cos\\alpha} = ${ftex(res)}$`] : []),
      ],
      verify: () => approx(fval(sinV) ** 2 + fval(cosV) ** 2, 1) && (ask === 'cos' ? fval(res) === fval(cosV) : approx(fval(res), fval(sinV) / fval(cosV))),
    };
  },
};

export const ANALYSIS: Template[] = [linThrough, vertex, range, domain, inverse, compose, expEq, expSubst, logValue, logEq, logDomain, exactValues, degRad, trigEq, sineRule, cosineRule, identity];

