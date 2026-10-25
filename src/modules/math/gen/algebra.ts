import {
  ADV, ALL, approx, frac, fracAns, fadd, fdiv, fmul, ftex, fval, gcd, intAns, intervalAns, iv, lcm, ntex,
  numAns, par, poly, setAns, sg, surdTex, tupleAns, xm, type Template,
} from '../core';
import { evaluate } from '../parse';

// ───────────── Výrazy, mocniny, odmocniny ─────────────

const powers: Template = {
  id: 'vyrazy-mocniny', topic: 'vyrazy', name: 'Počítání s mocninami', levels: ALL,
  generate(r, level) {
    // 2^a · 4^b : 8^c = 2^(a + 2b - 3c)
    const base = r.pick([2, 3]);
    const a = r.int(-3, 5), b = r.int(-2, 3), c = r.int(-2, 2);
    const e = level === 'zaklad' ? a + b - c : a + 2 * b - 3 * c;
    if (Math.abs(e) > 6) return powers.generate(r, level);
    const b2 = level === 'zaklad' ? base : base * base;
    const b3 = level === 'zaklad' ? base : base * base * base;
    const value = Math.pow(base, e);
    const f = e >= 0 ? frac(value) : frac(1, Math.pow(base, -e));
    const kb = level === 'zaklad' ? 1 : 2, kc = level === 'zaklad' ? 1 : 3;
    return {
      question: `Vypočítej: $${base}^{${a}} \\cdot ${b2}^{${b}} : ${b3}^{${c}}$`,
      answer: fracAns(f),
      solution: [
        level === 'zaklad' ? `Všechny mocniny mají základ $${base}$.` : `Převeď na základ ${base}: $${b2} = ${base}^{2}$, $${b3} = ${base}^{3}$.`,
        `Exponenty sečti/odečti: $${a} + ${kb}\\cdot${par(b)} - ${kc}\\cdot${par(c)} = ${e}$.`,
        `$${base}^{${e}} = ${ftex(f)}$`,
      ],
      verify: () => approx(Math.pow(base, a) * Math.pow(b2, b) / Math.pow(b3, c), fval(f)),
    };
  },
};

const roots: Template = {
  id: 'vyrazy-odmocniny', topic: 'vyrazy', name: 'Částečné odmocňování', levels: ALL,
  generate(r) {
    const m = r.pick([2, 3, 5, 6, 7]);
    const ks = r.distinct(3, 1, 6);
    const signs = [1, r.sign(), r.sign()];
    const parts = ks.map((k) => k * k * m);
    const total = ks.reduce((s, k, i) => s + signs[i] * k, 0);
    const res = surdTex(total, m);
    const q = parts.map((p, i) => `${i === 0 ? '' : signs[i] > 0 ? ' + ' : ' - '}\\sqrt{${p}}`).join('');
    return {
      question: `Zjednoduš: $${q}$`,
      answer: numAns(total * Math.sqrt(m), res.input, res.tex),
      solution: [
        ...parts.map((p, i) => `$\\sqrt{${p}} = \\sqrt{${ks[i] * ks[i]}\\cdot ${m}} = ${ks[i]}\\sqrt{${m}}$`),
        `Sečti: $(${ks.map((k, i) => `${i === 0 ? '' : signs[i] > 0 ? '+' : '-'}${k}`).join('')})\\sqrt{${m}} = ${res.tex}$`,
      ],
      verify: () => approx(parts.reduce((s, p, i) => s + signs[i] * Math.sqrt(p), 0), evaluate(res.input).re),
    };
  },
};

const fractions: Template = {
  id: 'vyrazy-zlomky', topic: 'vyrazy', name: 'Počítání se zlomky', levels: ALL,
  generate(r) {
    const A = frac(r.nz(-5, 5), r.int(2, 6));
    const B = frac(r.int(1, 5), r.int(2, 7));
    const Cf = frac(r.nz(-6, 6), r.int(2, 5));
    const D = frac(r.int(1, 4), r.int(2, 5));
    const prod = fmul(B, Cf);
    const quot = fdiv(prod, D);
    const res = fadd(A, quot);
    if (res.d > 60) return fractions.generate(r, 'zaklad');
    return {
      question: `Vypočítej a zapiš v základním tvaru: $${ftex(A)} + ${ftex(B)} \\cdot ${Cf.n < 0 ? `\\left(${ftex(Cf)}\\right)` : ftex(Cf)} : ${ftex(D)}$`,
      answer: fracAns(res),
      solution: [
        `Nejdřív násobení a dělení zleva: $${ftex(B)} \\cdot ${ftex(Cf)} = ${ftex(prod)}$`,
        `$${ftex(prod)} : ${ftex(D)} = ${ftex(prod)} \\cdot ${ftex(frac(D.d, D.n))} = ${ftex(quot)}$`,
        `$${ftex(A)} ${quot.n < 0 ? '-' : '+'} ${ftex(frac(Math.abs(quot.n), quot.d))} = ${ftex(res)}$`,
      ],
      verify: () => approx(fval(A) + (fval(B) * fval(Cf)) / fval(D), fval(res)),
    };
  },
};

const rational: Template = {
  id: 'vyrazy-lomene', topic: 'vyrazy', name: 'Úprava lomeného výrazu', levels: ALL,
  generate(r) {
    // (x² - a²) / (x² + (a+b)x + ab) = (x - a)/(x + b)
    const a = r.int(1, 6);
    let b = r.nz(-6, 6);
    if (b === a || b === -a) b = a + 1;
    const num = [1, 0, -a * a];
    const den = [1, a + b, a * b];
    return {
      question: `Zjednoduš výraz (pro přípustná $x$): $$\\frac{${poly(num)}}{${poly(den)}}$$`,
      answer: { kind: 'expr', f: (x) => (x - a) / (x + b), input: `(x-${a})/(x+${par(b)})`, tex: `\\frac{${xm(a)}}{${xm(-b)}}` },
      solution: [
        `Čitatel je rozdíl čtverců: $${poly(num)} = (${xm(a)})(${xm(-a)})$`,
        `Jmenovatel rozlož (Vietovy vzorce): $${poly(den)} = (${xm(-a)})(${xm(-b)})$`,
        `Zkrať $(${xm(-a)})$: $\\frac{${xm(a)}}{${xm(-b)}}$, podmínky $x \\ne ${-a}$, $x \\ne ${-b}$.`,
      ],
      verify: () => [0.3, 1.7, 9.1].every((x) => approx((x * x - a * a) / (x * x + (a + b) * x + a * b), (x - a) / (x + b))),
    };
  },
};

const nsn: Template = {
  id: 'vyrazy-nsn', topic: 'vyrazy', name: 'NSD a NSN', levels: ['zaklad'],
  generate(r) {
    const g = r.int(2, 12);
    const [p, q] = r.distinct(2, 2, 9);
    const x = g * p, y = g * q;
    const ask = r.pick(['NSD', 'NSN'] as const);
    const ans = ask === 'NSD' ? gcd(x, y) : lcm(x, y);
    return {
      question: `Urči ${ask === 'NSD' ? 'největší společný dělitel' : 'nejmenší společný násobek'} čísel $${x}$ a $${y}$.`,
      answer: intAns(ans),
      solution: [
        `Rozklad: $${x} = ${g}\\cdot${p}$, $${y} = ${g}\\cdot${q}$ (případně dál na prvočísla).`,
        `NSD$(${x}, ${y}) = ${gcd(x, y)}$, NSN$ = \\frac{${x}\\cdot${y}}{${gcd(x, y)}} = ${lcm(x, y)}$.`,
      ],
      verify: () => (ask === 'NSD' ? x % ans === 0 && y % ans === 0 && gcd(x / ans, y / ans) === 1 : ans % x === 0 && ans % y === 0 && gcd(ans / x, ans / y) === 1),
    };
  },
};

const fracPowers: Template = {
  id: 'vyrazy-exponent', topic: 'vyrazy', name: 'Mocniny s racionálním exponentem', levels: ADV,
  generate(r) {
    // a^(p/q) · ∛(a^m) / √a  → exponent
    const p = r.int(1, 5), q = r.pick([2, 3, 4]);
    const m = r.int(1, 4), n = r.pick([2, 3]);
    const e = fadd(fadd(frac(p, q), frac(m, n)), frac(-1, 2));
    return {
      question: `Výraz $a^{\\frac{${p}}{${q}}} \\cdot \\sqrt[${n}]{a^{${m}}} : \\sqrt{a}$ (pro $a>0$) zapiš jako $a^r$. Urči $r$.`,
      answer: fracAns(e),
      solution: [
        `$\\sqrt[${n}]{a^{${m}}} = a^{\\frac{${m}}{${n}}}$, $\\sqrt{a} = a^{\\frac12}$`,
        `$r = \\frac{${p}}{${q}} + \\frac{${m}}{${n}} - \\frac12 = ${ftex(e)}$`,
      ],
      verify: () => approx(Math.pow(2.3, p / q) * Math.pow(Math.pow(2.3, m), 1 / n) / Math.sqrt(2.3), Math.pow(2.3, fval(e))),
    };
  },
};

// ───────────── Rovnice a nerovnice ─────────────

const linear: Template = {
  id: 'rovnice-linearni', topic: 'rovnice', name: 'Lineární rovnice', levels: ALL,
  generate(r) {
    // a(x - p) + b = c·x + d, řešení x0 celé
    const x0 = r.int(-9, 9);
    const a = r.nz(-6, 6), p = r.int(-5, 5), b = r.int(-9, 9);
    let c = r.int(-5, 5);
    if (c === a) c = a + 1;
    const d = a * (x0 - p) + b - c * x0;
    return {
      question: `Řeš v $\\mathbb{R}$: $${a}(${xm(p)}) ${sg(b)} = ${poly([c, d])}$`,
      answer: setAns([x0]),
      solution: [
        `Roznásob: $${poly([a, -a * p + b])} = ${poly([c, d])}$`,
        `Převeď $x$ na jednu stranu: $${poly([a - c, 0])} = ${d + a * p - b}$`,
        `$x = \\frac{${d + a * p - b}}{${a - c}} = ${x0}$`,
      ],
      verify: () => a * (x0 - p) + b === c * x0 + d,
    };
  },
};

const quadratic: Template = {
  id: 'rovnice-kvadraticka', topic: 'rovnice', name: 'Kvadratická rovnice', levels: ALL,
  generate(r, level) {
    const k = level === 'zaklad' ? 1 : r.pick([1, 2, 3, -1, -2]);
    const lead = level === 'fit' ? r.pick([2, 3]) : 1;
    // k·(lead·x - p)(x - q) = 0
    const q = r.int(-7, 7);
    let p = r.int(-7, 7);
    if (lead === 1 && p === q) p = q + 1;
    const A = k * lead, B = -k * (lead * q + p), Cc = k * p * q;
    const disc = B * B - 4 * A * Cc;
    const roots = [p / lead, q];
    const ans = setAns(roots);
    return {
      question: `Řeš v $\\mathbb{R}$: $${poly([A, B, Cc])} = 0$`,
      answer: ans,
      solution: [
        `Diskriminant: $D = b^2 - 4ac = ${par(B)}^2 - 4\\cdot${par(A)}\\cdot${par(Cc)} = ${disc}$`,
        `$x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{${-B} \\pm ${Math.sqrt(disc)}}{${2 * A}}$`,
        `$K = ${ans.tex}$`,
      ],
      verify: () => roots.every((x) => approx(A * x * x + B * x + Cc, 0)) && disc >= 0,
    };
  },
};

const quadIneq: Template = {
  id: 'rovnice-kv-nerovnice', topic: 'rovnice', name: 'Kvadratická nerovnice', levels: ALL,
  generate(r) {
    const [x1, x2] = r.distinct(2, -8, 8).sort((a, b) => a - b);
    const k = r.pick([1, -1, 2]);
    const rel = r.pick(['<', '>', '\\le', '\\ge'] as const);
    const A = k, B = -k * (x1 + x2), Cc = k * x1 * x2;
    // znaménko k·(x-x1)(x-x2): mezi kořeny opačné než k
    const wantNeg = rel === '<' || rel === '\\le';
    const closed = rel === '\\le' || rel === '\\ge';
    const inside = (k > 0) === wantNeg;
    const ivs = inside ? [iv(x1, x2, closed, closed)] : [iv(-Infinity, x1, false, closed), iv(x2, Infinity, closed, false)];
    const ans = intervalAns(ivs);
    const test = (x: number) => {
      const v = A * x * x + B * x + Cc;
      return rel === '<' ? v < 0 : rel === '>' ? v > 0 : rel === '\\le' ? v <= 0 : v >= 0;
    };
    return {
      question: `Řeš v $\\mathbb{R}$: $${poly([A, B, Cc])} ${rel} 0$`,
      answer: ans,
      solution: [
        `Kořeny rovnice $${poly([A, B, Cc])} = 0$: $x_1 = ${x1}$, $x_2 = ${x2}$`,
        `Parabola je otevřená ${k > 0 ? 'nahoru' : 'dolů'}, výraz je ${k > 0 ? 'záporný' : 'kladný'} mezi kořeny.`,
        `$K = ${ans.tex}$`,
      ],
      verify: () => [x1 - 1.5, x1, (x1 + x2) / 2, x2, x2 + 1.5].every((x) => test(x) === ivs.some((I) => (x > I.lo || (I.loC && x === I.lo)) && (x < I.hi || (I.hiC && x === I.hi)))),
    };
  },
};

const linIneq: Template = {
  id: 'rovnice-lin-nerovnice', topic: 'rovnice', name: 'Lineární nerovnice', levels: ['zaklad', 'rozsireny'],
  generate(r) {
    const a = r.nz(-6, 6), x0 = frac(r.int(-12, 12), r.pick([1, 1, 2, 3]));
    const b = -a * fval(x0);
    if (!Number.isInteger(b)) return linIneq.generate(r, 'zaklad');
    const rel = r.pick(['<', '>', '\\le', '\\ge'] as const);
    const closed = rel === '\\le' || rel === '\\ge';
    // a·x + b rel 0 → x rel' x0 (otočení pro a < 0)
    const greater = (rel === '>' || rel === '\\ge') === a > 0;
    const v = fval(x0);
    const ans = intervalAns([greater ? iv(v, Infinity, closed) : iv(-Infinity, v, false, closed)]);
    const c = r.int(-5, 5);
    return {
      question: `Řeš v $\\mathbb{R}$: $${poly([a + c, b])} ${rel} ${poly([c, 0])}$`,
      answer: ans,
      solution: [
        `Převeď vše na levou stranu: $${poly([a, b])} ${rel} 0$`,
        `Vyděl číslem $${a}$${a < 0 ? ' (záporné → otoč znak nerovnosti)' : ''}: $x ${greater ? (closed ? '\\ge' : '>') : closed ? '\\le' : '<'} ${ftex(x0)}$`,
        `$K = ${ans.tex}$`,
      ],
      verify: () => {
        const t = (x: number) => {
          const L = (a + c) * x + b, R = c * x;
          return rel === '<' ? L < R : rel === '>' ? L > R : rel === '\\le' ? L <= R : L >= R;
        };
        // hranice přesně: a·x0 + b = 0 (ve zlomcích, bez zaokrouhlení)
        return t(v + 0.5) === greater && t(v - 0.5) === !greater && a * x0.n + b * x0.d === 0;
      },
    };
  },
};

const lin2 = (a: number, b: number) => `${poly([a, 0])} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y`;

const system: Template = {
  id: 'rovnice-soustava', topic: 'rovnice', name: 'Soustava dvou rovnic', levels: ALL,
  generate(r) {
    const x = r.int(-6, 6), y = r.int(-6, 6);
    let a1 = r.nz(-5, 5), b1 = r.nz(-5, 5), a2 = r.nz(-5, 5), b2 = r.nz(-5, 5);
    if (a1 * b2 - a2 * b1 === 0) { a2 += 1; if (a2 === 0) a2 = 2; }
    if (a1 * b2 - a2 * b1 === 0) b2 += 1;
    const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
    const det = a1 * b2 - a2 * b1;
    return {
      question: `Řeš soustavu a zapiš $[x; y]$: $$\\begin{aligned} ${lin2(a1, b1)} &= ${c1} \\\\ ${lin2(a2, b2)} &= ${c2} \\end{aligned}$$`,
      answer: tupleAns([x, y], ['x', 'y']),
      solution: [
        `Determinant soustavy: $D = ${par(a1)}\\cdot${par(b2)} - ${par(a2)}\\cdot${par(b1)} = ${det}$`,
        `$x = \\frac{${c1}\\cdot${par(b2)} - ${c2}\\cdot${par(b1)}}{${det}} = ${x}$, $y = \\frac{${par(a1)}\\cdot${c2} - ${par(a2)}\\cdot${c1}}{${det}} = ${y}$`,
        `(Stejně dobře funguje sčítací nebo dosazovací metoda.)`,
      ],
      verify: () => a1 * x + b1 * y === c1 && a2 * x + b2 * y === c2 && det !== 0,
    };
  },
};

const absEq: Template = {
  id: 'rovnice-abs', topic: 'rovnice', name: 'Rovnice s absolutní hodnotou', levels: ADV,
  generate(r) {
    // |a·x + b| = c
    const a = r.pick([1, 2, 3, -2]), b = r.int(-8, 8), c = r.int(1, 9);
    const sols = [(c - b) / a, (-c - b) / a];
    if (!sols.every((s) => Number.isInteger(s * 2))) return absEq.generate(r, 'fit');
    const ans = setAns(sols);
    return {
      question: `Řeš v $\\mathbb{R}$: $|${poly([a, b])}| = ${c}$`,
      answer: ans,
      solution: [
        `$|V| = ${c}$ znamená $V = ${c}$ nebo $V = -${c}$.`,
        `$${poly([a, b])} = ${c} \\Rightarrow x = ${ntex(sols[0])}$`,
        `$${poly([a, b])} = -${c} \\Rightarrow x = ${ntex(sols[1])}$`,
        `$K = ${ans.tex}$`,
      ],
      verify: () => sols.every((s) => approx(Math.abs(a * s + b), c)),
    };
  },
};

const param: Template = {
  id: 'rovnice-parametr', topic: 'rovnice', name: 'Rovnice s parametrem', levels: ADV,
  generate(r) {
    // x² + p·x + m² = 0 má dvojnásobný kořen ⇔ p² = 4m²
    const m = r.int(1, 8);
    const kind = r.pick(['jeden', 'žádný'] as const);
    if (kind === 'jeden') {
      const ans = setAns([2 * m, -2 * m]);
      return {
        question: `Pro které hodnoty parametru $p \\in \\mathbb{R}$ má rovnice $x^2 + px + ${m * m} = 0$ právě jeden (dvojnásobný) kořen?`,
        answer: ans,
        solution: [`Jeden kořen ⇔ $D = 0$: $p^2 - 4\\cdot${m * m} = 0$`, `$p^2 = ${4 * m * m}$, tedy $p = \\pm ${2 * m}$`],
        verify: () => [2 * m, -2 * m].every((p) => p * p - 4 * m * m === 0),
      };
    }
    const ans = intervalAns([iv(-2 * m, 2 * m)]);
    return {
      question: `Pro které hodnoty parametru $p$ nemá rovnice $x^2 + px + ${m * m} = 0$ žádný reálný kořen? (zapiš interval)`,
      answer: ans,
      solution: [`Žádný reálný kořen ⇔ $D < 0$: $p^2 - ${4 * m * m} < 0$`, `$|p| < ${2 * m}$, tedy $p \\in ${ans.tex}$`],
      verify: () => [-2 * m + 0.1, 0, 2 * m - 0.1].every((p) => p * p - 4 * m * m < 0) && (2 * m) ** 2 - 4 * m * m === 0,
    };
  },
};

const fracEq: Template = {
  id: 'rovnice-lomena', topic: 'rovnice', name: 'Rovnice s neznámou ve jmenovateli', levels: ADV,
  generate(r) {
    // (x + a)/(x + b) = k → x = (k·b - a)/(1 - k)
    const k = r.pick([2, 3, -1, -2, 4]);
    const x0 = r.int(-6, 6);
    const b = r.int(-5, 5);
    if (x0 + b === 0) return fracEq.generate(r, 'fit');
    const a = k * (x0 + b) - x0;
    if (a === b) return fracEq.generate(r, 'fit');
    return {
      question: `Řeš v $\\mathbb{R}$: $\\dfrac{${xm(-a)}}{${xm(-b)}} = ${k}$`,
      answer: setAns([x0]),
      solution: [
        `Podmínka: $x \\ne ${-b}$`,
        `Vynásob jmenovatelem: $${xm(-a)} = ${k}(${xm(-b)})$`,
        `$${poly([1 - k, 0])} = ${k * b - a}$, tedy $x = ${x0}$ (vyhovuje podmínce).`,
      ],
      verify: () => x0 + b !== 0 && approx((x0 + a) / (x0 + b), k),
    };
  },
};

export const ALGEBRA: Template[] = [powers, roots, fractions, rational, nsn, fracPowers, linear, quadratic, quadIneq, linIneq, system, absEq, param, fracEq];
