import {
  ADV, ALL, approx, cTex, frac, fracAns, ftex, fval, intAns, ntex, numAns, par, piTex, poly, setAnsItems,
  sg, surd, surdTex, tupleAns, type Frac, type Template,
} from '../core';
import { cx, evaluate } from '../parse';

// ───────────── Posloupnosti a řady ─────────────

const arith: Template = {
  id: 'posl-aritmeticka', topic: 'posloupnosti', name: 'Aritmetická posloupnost', levels: ALL,
  generate(r, level) {
    const a1 = r.int(-10, 15), d = r.nz(-5, 6);
    const an = (n: number) => a1 + (n - 1) * d;
    if (level === 'zaklad' && r.next() < 0.5) {
      const n = r.int(8, 30);
      return {
        question: `V aritmetické posloupnosti je $a_1 = ${a1}$ a $d = ${d}$. Vypočítej $a_{${n}}$.`,
        answer: intAns(an(n)),
        solution: [`$a_n = a_1 + (n-1)d$`, `$a_{${n}} = ${a1} + ${n - 1}\\cdot${par(d)} = ${an(n)}$`],
        verify: () => Array.from({ length: n - 1 }).reduce<number>((v) => v + d, a1) === an(n),
      };
    }
    const [m, k] = r.distinct(2, 2, 12).sort((x, y) => x - y);
    return {
      question: `V aritmetické posloupnosti je $a_{${m}} = ${an(m)}$ a $a_{${k}} = ${an(k)}$. Urči $a_1$ a $d$ (zapiš $a_1; d$).`,
      answer: tupleAns([a1, d], ['a_1', 'd']),
      solution: [
        `$a_{${k}} - a_{${m}} = (${k} - ${m})d \\Rightarrow ${an(k) - an(m)} = ${k - m}d \\Rightarrow d = ${d}$`,
        `$a_1 = a_{${m}} - ${m - 1}d = ${an(m)} - ${m - 1}\\cdot${par(d)} = ${a1}$`,
      ],
      verify: () => a1 + (m - 1) * d === an(m) && a1 + (k - 1) * d === an(k),
    };
  },
};

const arithSum: Template = {
  id: 'posl-soucet', topic: 'posloupnosti', name: 'Součet aritmetické posloupnosti', levels: ALL,
  generate(r) {
    const a1 = r.int(-5, 12), d = r.nz(-3, 5), n = r.int(5, 25);
    const an = a1 + (n - 1) * d;
    const s = (n * (a1 + an)) / 2;
    return {
      question: `Vypočítej součet prvních $${n}$ členů aritmetické posloupnosti, kde $a_1 = ${a1}$, $d = ${d}$.`,
      answer: intAns(s),
      solution: [`$a_{${n}} = ${a1} + ${n - 1}\\cdot${par(d)} = ${an}$`, `$s_n = \\frac{n(a_1 + a_n)}{2} = \\frac{${n}(${a1} + ${par(an)})}{2} = ${s}$`],
      verify: () => Array.from({ length: n }, (_, i) => a1 + i * d).reduce((x, y) => x + y, 0) === s,
    };
  },
};

const geom: Template = {
  id: 'posl-geometricka', topic: 'posloupnosti', name: 'Geometrická posloupnost', levels: ALL,
  generate(r, level) {
    const qf: Frac = level === 'zaklad' ? frac(r.pick([2, 3, -2])) : r.pick([frac(2), frac(3), frac(-2), frac(1, 2), frac(-1, 2), frac(1, 3)]);
    const a1 = level === 'zaklad' ? r.int(1, 5) : r.pick([1, 2, 3, 4, 8, 16, 27, 81, -2, -3]);
    const pw = (f: Frac, n: number) => frac(f.n ** n, f.d ** n);
    const ask = r.pick(['an', 'sn', 'q'] as const);
    if (ask === 'an') {
      const n = r.int(3, 7);
      const res = frac(a1 * qf.n ** (n - 1), qf.d ** (n - 1));
      return {
        question: `Geometrická posloupnost má $a_1 = ${a1}$ a kvocient $q = ${ftex(qf)}$. Vypočítej $a_{${n}}$.`,
        answer: fracAns(res),
        solution: [`$a_n = a_1 q^{n-1}$`, `$a_{${n}} = ${a1}\\cdot\\left(${ftex(qf)}\\right)^{${n - 1}} = ${ftex(res)}$`],
        verify: () => approx(Array.from({ length: n - 1 }).reduce<number>((v) => v * fval(qf), a1), fval(res)),
      };
    }
    if (ask === 'sn') {
      const n = r.int(3, 6);
      // s_n = a1 (q^n - 1)/(q - 1)
      const qn = pw(qf, n);
      const res = frac(a1 * (qn.n - qn.d) * qf.d, qn.d * (qf.n - qf.d));
      return {
        question: `Vypočítej součet prvních $${n}$ členů geometrické posloupnosti s $a_1 = ${a1}$ a $q = ${ftex(qf)}$.`,
        answer: fracAns(res),
        solution: [`$s_n = a_1\\frac{q^n - 1}{q - 1}$`, `$s_{${n}} = ${a1}\\cdot\\frac{(${ftex(qf)})^{${n}} - 1}{${ftex(qf)} - 1} = ${ftex(res)}$`],
        verify: () => approx(Array.from({ length: n }, (_, i) => a1 * fval(qf) ** i).reduce((x, y) => x + y, 0), fval(res)),
      };
    }
    const qi = r.pick([2, 3, -2, -3]);
    const b = r.pick([1, 2, 3, -1]);
    return {
      question: `V geometrické posloupnosti je $a_2 = ${b * qi}$ a $a_5 = ${b * qi ** 4}$. Urči kvocient $q$.`,
      answer: intAns(qi),
      solution: [`$\\frac{a_5}{a_2} = q^3 = \\frac{${b * qi ** 4}}{${b * qi}} = ${qi ** 3}$`, `$q = \\sqrt[3]{${qi ** 3}} = ${qi}$`],
      verify: () => b * qi * qi ** 3 === b * qi ** 4,
    };
  },
};

const series: Template = {
  id: 'posl-rada', topic: 'posloupnosti', name: 'Nekonečná geometrická řada', levels: ADV,
  generate(r) {
    const q = r.pick([frac(1, 2), frac(-1, 2), frac(1, 3), frac(-1, 3), frac(2, 3), frac(1, 4), frac(3, 4), frac(-2, 3)]);
    const a1 = r.pick([1, 2, 3, 4, 6, 8, 9, 12, 18, 24]);
    const s = frac(a1 * q.d, q.d - q.n);
    const t2 = frac(a1 * q.n, q.d), t3 = frac(a1 * q.n * q.n, q.d * q.d);
    return {
      question: `Vypočítej součet řady $${a1} ${t2.n < 0 ? '-' : '+'} ${ftex(frac(Math.abs(t2.n), t2.d))} + ${ftex(t3)} ${q.n < 0 ? '-' : '+'} \\dots$`,
      answer: fracAns(s),
      solution: [`Kvocient $q = \\frac{a_2}{a_1} = ${ftex(q)}$, $|q| < 1$ ⇒ řada konverguje.`, `$s = \\frac{a_1}{1 - q} = \\frac{${a1}}{1 - ${par(ftex(q))}} = ${ftex(s)}$`],
      verify: () => approx(Array.from({ length: 200 }, (_, i) => a1 * fval(q) ** i).reduce((x, y) => x + y, 0), fval(s), 1e-6),
    };
  },
};

// ───────────── Analytická geometrie ─────────────

const distance: Template = {
  id: 'ag-vzdalenost', topic: 'analyticka', name: 'Vzdálenost bodů', levels: ALL,
  generate(r) {
    const A = [r.int(-6, 6), r.int(-6, 6)], dx = r.nz(-7, 7), dy = r.int(-7, 7);
    const B = [A[0] + dx, A[1] + dy];
    const N = dx * dx + dy * dy;
    const { k, m } = surd(N);
    const res = surdTex(k, m);
    return {
      question: `Vypočítej vzdálenost bodů $A[${A[0]}; ${A[1]}]$ a $B[${B[0]}; ${B[1]}]$.`,
      answer: numAns(Math.sqrt(N), res.input, res.tex),
      solution: [`$|AB| = \\sqrt{(${B[0]} - ${par(A[0])})^2 + (${B[1]} - ${par(A[1])})^2} = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${N}}$`, `$|AB| = ${res.tex}$`],
      verify: () => approx(evaluate(res.input).re, Math.hypot(B[0] - A[0], B[1] - A[1])),
    };
  },
};

const midpoint: Template = {
  id: 'ag-stred', topic: 'analyticka', name: 'Střed úsečky', levels: ['zaklad'],
  generate(r) {
    const A = [r.int(-8, 8), r.int(-8, 8)], B = [r.int(-8, 8), r.int(-8, 8)];
    const S = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    return {
      question: `Urči souřadnice středu úsečky $AB$, kde $A[${A[0]}; ${A[1]}]$, $B[${B[0]}; ${B[1]}]$ (zapiš $x; y$).`,
      answer: tupleAns(S, ['x', 'y']),
      solution: [`$S = \\left[\\frac{x_A + x_B}{2}; \\frac{y_A + y_B}{2}\\right] = [${ntex(S[0])}; ${ntex(S[1])}]$`],
      verify: () => approx(Math.hypot(S[0] - A[0], S[1] - A[1]), Math.hypot(S[0] - B[0], S[1] - B[1])) && approx(S[0] * 2, A[0] + B[0]),
    };
  },
};

const lineEq: Template = {
  id: 'ag-primka', topic: 'analyticka', name: 'Obecná rovnice přímky', levels: ALL,
  generate(r) {
    const A = [r.int(-6, 6), r.int(-6, 6)];
    let u = [r.int(-5, 5), r.int(-5, 5)];
    if (!u[0] && !u[1]) u = [1, 2];
    const B = [A[0] + u[0], A[1] + u[1]];
    // normálový vektor n = (u2, -u1)
    const a = u[1], b = -u[0], c = -(a * A[0] + b * A[1]);
    const lin = `${poly([a, 0])}${b ? ` ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y` : ''}${c ? ` ${sg(c)}` : ''} = 0`.replace(/^0 /, '');
    return {
      question: `Napiš obecnou rovnici přímky procházející body $A[${A[0]}; ${A[1]}]$ a $B[${B[0]}; ${B[1]}]$.`,
      answer: { kind: 'line', coef: [a, b, c], input: lin.replace(/\s/g, '').replace(/^0\+/, ''), tex: lin },
      solution: [
        `Směrový vektor $\\vec{u} = B - A = (${u[0]}; ${u[1]})$, normálový $\\vec{n} = (${u[1]}; ${-u[0]})$`,
        `$${a}x ${sg(b)}y + c = 0$, dosaď $A$: $c = ${c}$`,
        `$p: ${lin}$`,
      ],
      verify: () => a * A[0] + b * A[1] + c === 0 && a * B[0] + b * B[1] + c === 0 && (a !== 0 || b !== 0),
    };
  },
};

const vectors: Template = {
  id: 'ag-vektory', topic: 'analyticka', name: 'Skalární součin a kolmost', levels: ALL,
  generate(r) {
    const u = [r.nz(-6, 6), r.nz(-6, 6)];
    if (r.next() < 0.4) {
      const v = [r.int(-6, 6), r.int(-6, 6)];
      const dot = u[0] * v[0] + u[1] * v[1];
      return {
        question: `Vypočítej skalární součin vektorů $\\vec{u} = (${u[0]}; ${u[1]})$ a $\\vec{v} = (${v[0]}; ${v[1]})$.`,
        answer: intAns(dot),
        solution: [`$\\vec{u}\\cdot\\vec{v} = u_1v_1 + u_2v_2 = ${par(u[0])}\\cdot${par(v[0])} + ${par(u[1])}\\cdot${par(v[1])} = ${dot}$`],
        verify: () => approx(Math.hypot(...u) * Math.hypot(...v) * Math.cos(Math.atan2(v[1], v[0]) - Math.atan2(u[1], u[0])), dot),
      };
    }
    // u ⊥ (t; k) ⇔ u1·t + u2·k = 0
    const k = r.nz(-6, 6);
    const t = frac(-u[1] * k, u[0]);
    return {
      question: `Pro jaké $t$ je vektor $\\vec{u} = (${u[0]}; ${u[1]})$ kolmý na $\\vec{v} = (t; ${k})$?`,
      answer: fracAns(t),
      solution: [`Kolmost ⇔ $\\vec{u}\\cdot\\vec{v} = 0$: $${u[0]}t ${sg(u[1] * k)} = 0$`, `$t = ${ftex(t)}$`],
      verify: () => approx(u[0] * fval(t) + u[1] * k, 0),
    };
  },
};

const pointLine: Template = {
  id: 'ag-bod-primka', topic: 'analyticka', name: 'Vzdálenost bodu od přímky', levels: ADV,
  generate(r) {
    const [p, q, h] = r.pick([[3, 4, 5], [5, 12, 13], [8, 6, 10]] as const);
    const a = p * r.sign(), b = q * r.sign(), c = r.int(-12, 12);
    const P = [r.int(-5, 5), r.int(-5, 5)];
    const res = frac(Math.abs(a * P[0] + b * P[1] + c), h);
    return {
      question: `Vypočítej vzdálenost bodu $P[${P[0]}; ${P[1]}]$ od přímky $p: ${poly([a, 0])} ${b < 0 ? '-' : '+'} ${Math.abs(b)}y ${sg(c)} = 0$.`.replace(' + 0 = 0', ' = 0'),
      answer: fracAns(res),
      solution: [`$v = \\frac{|ax_0 + by_0 + c|}{\\sqrt{a^2 + b^2}} = \\frac{|${a}\\cdot${par(P[0])} ${sg(b)}\\cdot${par(P[1])} ${sg(c)}|}{\\sqrt{${a * a} + ${b * b}}} = ${ftex(res)}$`],
      verify: () => {
        // pata kolmice a vzdálenost přímo
        const tt = -(a * P[0] + b * P[1] + c) / (a * a + b * b);
        return approx(Math.hypot(a * tt, b * tt), fval(res));
      },
    };
  },
};

const circle: Template = {
  id: 'ag-kruznice', topic: 'analyticka', name: 'Střed a poloměr kružnice', levels: ALL,
  generate(r) {
    const m = r.int(-6, 6), n = r.int(-6, 6), rad = r.int(1, 7);
    const D = -2 * m, E = -2 * n, F = m * m + n * n - rad * rad;
    const terms = `x^2 + y^2${D ? ` ${D < 0 ? '-' : '+'} ${Math.abs(D)}x` : ''}${E ? ` ${E < 0 ? '-' : '+'} ${Math.abs(E)}y` : ''}${F ? ` ${sg(F)}` : ''} = 0`;
    return {
      question: `Urči střed $S[m; n]$ a poloměr $r$ kružnice $${terms}$ (zapiš $m; n; r$).`,
      answer: tupleAns([m, n, rad], ['m', 'n', 'r']),
      solution: [
        `Doplň na čtverce: $(x ${sg(-m)})^2 + (y ${sg(-n)})^2 = ${m * m} + ${n * n} ${sg(-F)}$`.replace(/\(x \+ 0\)/, 'x').replace(/\(y \+ 0\)/, 'y'),
        `$S[${m}; ${n}]$, $r = \\sqrt{${rad * rad}} = ${rad}$`,
      ],
      verify: () => [0, 1, 2].every((k) => {
        const th = k * 2.1;
        const x = m + rad * Math.cos(th), y = n + rad * Math.sin(th);
        return approx(x * x + y * y + D * x + E * y + F, 0, 1e-9);
      }),
    };
  },
};

const ellipse: Template = {
  id: 'ag-elipsa', topic: 'analyticka', name: 'Elipsa – excentricita', levels: ADV,
  generate(r) {
    const [b0, e0, a0] = r.pick([[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17]] as const);
    const k = r.int(1, 3);
    const a = a0 * k, b = b0 * k, e = e0 * k;
    return {
      question: `Urči excentricitu (vzdálenost ohniska od středu) elipsy $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$.`,
      answer: intAns(e),
      solution: [`$a = ${a}$, $b = ${b}$`, `$e = \\sqrt{a^2 - b^2} = \\sqrt{${a * a} - ${b * b}} = ${e}$`],
      verify: () => {
        // součet vzdáleností bodu [0; b] od ohnisek = 2a
        return approx(2 * Math.hypot(e, b), 2 * a);
      },
    };
  },
};

const intersect: Template = {
  id: 'ag-prusecik', topic: 'analyticka', name: 'Průsečík přímek', levels: ['rozsireny', 'fit'],
  generate(r) {
    const x = r.int(-5, 5), y = r.int(-5, 5);
    const k1 = r.nz(-4, 4);
    let k2 = r.nz(-4, 4);
    if (k2 === k1) k2 = -k1 || 1;
    const q1 = y - k1 * x, q2 = y - k2 * x;
    return {
      question: `Urči průsečík přímek $p: y = ${poly([k1, q1])}$ a $q: y = ${poly([k2, q2])}$ (zapiš $x; y$).`,
      answer: tupleAns([x, y], ['x', 'y']),
      solution: [`$${poly([k1, q1])} = ${poly([k2, q2])}$`, `$${poly([k1 - k2, 0])} = ${q2 - q1} \\Rightarrow x = ${x}$`, `$y = ${y}$`],
      verify: () => k1 * x + q1 === y && k2 * x + q2 === y,
    };
  },
};

// ───────────── Planimetrie a stereometrie ─────────────

const PT: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20]];

const rightTri: Template = {
  id: 'geo-pravouhly', topic: 'geometrie', name: 'Pravoúhlý trojúhelník', levels: ALL,
  generate(r) {
    const [a, b, c] = r.pick(PT);
    const ask = r.pick(['c', 'b', 'S', 'v'] as const);
    if (ask === 'c') return {
      question: `Pravoúhlý trojúhelník má odvěsny $a = ${a}$ cm a $b = ${b}$ cm. Vypočítej přeponu $c$ (cm).`,
      answer: intAns(c), solution: [`Pythagorova věta: $c = \\sqrt{a^2 + b^2} = \\sqrt{${a * a} + ${b * b}} = ${c}$`],
      verify: () => a * a + b * b === c * c,
    };
    if (ask === 'b') return {
      question: `Pravoúhlý trojúhelník má přeponu $c = ${c}$ cm a odvěsnu $a = ${a}$ cm. Vypočítej odvěsnu $b$ (cm).`,
      answer: intAns(b), solution: [`$b = \\sqrt{c^2 - a^2} = \\sqrt{${c * c} - ${a * a}} = ${b}$`],
      verify: () => a * a + b * b === c * c,
    };
    if (ask === 'S') return {
      question: `Pravoúhlý trojúhelník má přeponu $${c}$ cm a jednu odvěsnu $${a}$ cm. Vypočítej jeho obsah (cm²).`,
      answer: intAns((a * b) / 2), solution: [`Druhá odvěsna: $\\sqrt{${c * c} - ${a * a}} = ${b}$`, `$S = \\frac{ab}{2} = \\frac{${a}\\cdot${b}}{2} = ${(a * b) / 2}$`],
      verify: () => a * a + b * b === c * c,
    };
    const v = frac(a * b, c);
    return {
      question: `Pravoúhlý trojúhelník má odvěsny $${a}$ cm a $${b}$ cm. Vypočítej výšku na přeponu (cm).`,
      answer: fracAns(v), solution: [`$c = ${c}$, obsah $S = \\frac{ab}{2} = \\frac{c\\,v_c}{2}$`, `$v_c = \\frac{ab}{c} = \\frac{${a * b}}{${c}} = ${ftex(v)}$`],
      verify: () => approx(0.5 * c * fval(v), 0.5 * a * b),
    };
  },
};

const circleArea: Template = {
  id: 'geo-kruh', topic: 'geometrie', name: 'Kruh a kružnice', levels: ALL,
  generate(r) {
    const rad = r.int(2, 15);
    if (r.next() < 0.5) {
      const S = piTex(frac(rad * rad));
      return {
        question: `Obvod kruhu je $${piTex(frac(2 * rad)).tex}$ cm. Vypočítej jeho obsah (cm², vyjádři pomocí $\\pi$).`,
        answer: numAns(Math.PI * rad * rad, S.input, S.tex),
        solution: [`$o = 2\\pi r \\Rightarrow r = ${rad}$`, `$S = \\pi r^2 = ${S.tex}$`],
        verify: () => approx(evaluate(S.input).re, Math.PI * (((2 * rad * Math.PI) / (2 * Math.PI)) ** 2)),
      };
    }
    const deg = r.pick([30, 45, 60, 90, 120, 150, 270]);
    const S = piTex(frac(rad * rad * deg, 360));
    return {
      question: `Vypočítej obsah kruhové výseče s poloměrem $${rad}$ cm a středovým úhlem $${deg}^\\circ$ (pomocí $\\pi$).`,
      answer: numAns((Math.PI * rad * rad * deg) / 360, S.input, S.tex),
      solution: [`$S = \\pi r^2 \\cdot \\frac{\\alpha}{360^\\circ} = \\pi\\cdot${rad * rad}\\cdot\\frac{${deg}}{360} = ${S.tex}$`],
      verify: () => approx(evaluate(S.input).re, 0.5 * rad * rad * ((deg * Math.PI) / 180)),
    };
  },
};

const cuboid: Template = {
  id: 'geo-kvadr', topic: 'geometrie', name: 'Kvádr a krychle', levels: ALL,
  generate(r) {
    const [a, b, c, u] = r.pick([[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [3, 4, 12, 13], [2, 10, 11, 15]] as const);
    const ask = r.pick(['u', 'S', 'V'] as const);
    if (ask === 'u') return {
      question: `Kvádr má rozměry $${a}$, $${b}$ a $${c}$ cm. Vypočítej délku tělesové úhlopříčky (cm).`,
      answer: intAns(u), solution: [`$u = \\sqrt{a^2 + b^2 + c^2} = \\sqrt{${a * a} + ${b * b} + ${c * c}} = ${u}$`],
      verify: () => a * a + b * b + c * c === u * u,
    };
    const S = 2 * (a * b + b * c + a * c), V = a * b * c;
    return {
      question: `Kvádr má rozměry $${a}$, $${b}$ a $${c}$ cm. Vypočítej jeho ${ask === 'S' ? 'povrch (cm²)' : 'objem (cm³)'}.`,
      answer: intAns(ask === 'S' ? S : V),
      solution: ask === 'S' ? [`$S = 2(ab + bc + ac) = 2(${a * b} + ${b * c} + ${a * c}) = ${S}$`] : [`$V = abc = ${V}$`],
      verify: () => (ask === 'S' ? [a * b, a * b, b * c, b * c, a * c, a * c].reduce((x, y) => x + y) === S : V === a * b * c),
    };
  },
};

const solids: Template = {
  id: 'geo-rotacni', topic: 'geometrie', name: 'Válec, kužel, koule', levels: ALL,
  generate(r, level) {
    const kind = level === 'zaklad' ? r.pick(['valec', 'koule'] as const) : r.pick(['valec', 'kuzel', 'koule', 'kuzelS'] as const);
    if (kind === 'valec') {
      const rad = r.int(1, 8), v = r.int(2, 12);
      const ask = r.pick(['V', 'S'] as const);
      const val = ask === 'V' ? frac(rad * rad * v) : frac(2 * rad * rad + 2 * rad * v);
      const p = piTex(val);
      return {
        question: `Válec má poloměr podstavy $${rad}$ cm a výšku $${v}$ cm. Vypočítej jeho ${ask === 'V' ? 'objem (cm³)' : 'povrch (cm²)'} pomocí $\\pi$.`,
        answer: numAns(fval(val) * Math.PI, p.input, p.tex),
        solution: ask === 'V' ? [`$V = \\pi r^2 v = \\pi\\cdot${rad * rad}\\cdot${v} = ${p.tex}$`] : [`$S = 2\\pi r^2 + 2\\pi r v = 2\\pi\\cdot${rad * rad} + 2\\pi\\cdot${rad}\\cdot${v} = ${p.tex}$`],
        verify: () => approx(evaluate(p.input).re, ask === 'V' ? Math.PI * rad ** 2 * v : 2 * Math.PI * rad * (rad + v)),
      };
    }
    if (kind === 'koule') {
      const rad = r.pick([1, 2, 3, 3, 6, 9]);
      const val = frac(4 * rad ** 3, 3);
      const p = piTex(val);
      return {
        question: `Vypočítej objem koule o poloměru $${rad}$ cm (pomocí $\\pi$).`,
        answer: numAns(fval(val) * Math.PI, p.input, p.tex),
        solution: [`$V = \\frac{4}{3}\\pi r^3 = \\frac{4}{3}\\pi\\cdot${rad ** 3} = ${p.tex}$`],
        verify: () => approx(evaluate(p.input).re, (4 / 3) * Math.PI * rad ** 3),
      };
    }
    const [rad, v, s] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 6, 10]] as const);
    if (kind === 'kuzel') {
      const p = piTex(frac(rad * rad * v, 3));
      return {
        question: `Kužel má poloměr podstavy $${rad}$ cm a výšku $${v}$ cm. Vypočítej jeho objem (pomocí $\\pi$).`,
        answer: numAns((Math.PI * rad * rad * v) / 3, p.input, p.tex),
        solution: [`$V = \\frac13\\pi r^2 v = \\frac13\\pi\\cdot${rad * rad}\\cdot${v} = ${p.tex}$`],
        verify: () => approx(evaluate(p.input).re, (Math.PI * rad * rad * v) / 3),
      };
    }
    const p = piTex(frac(rad * (rad + s)));
    return {
      question: `Kužel má poloměr podstavy $${rad}$ cm a výšku $${v}$ cm. Vypočítej jeho povrch (pomocí $\\pi$).`,
      answer: numAns(Math.PI * rad * (rad + s), p.input, p.tex),
      solution: [`Strana kužele: $s = \\sqrt{r^2 + v^2} = \\sqrt{${rad * rad} + ${v * v}} = ${s}$`, `$S = \\pi r^2 + \\pi r s = \\pi\\cdot${rad}(${rad} + ${s}) = ${p.tex}$`],
      verify: () => rad * rad + v * v === s * s && approx(evaluate(p.input).re, Math.PI * rad * rad + Math.PI * rad * s),
    };
  },
};

const polygons: Template = {
  id: 'geo-mnohouhelniky', topic: 'geometrie', name: 'Obsahy rovinných útvarů', levels: ['zaklad', 'rozsireny'],
  generate(r) {
    const kind = r.pick(['lichobeznik', 'kosoctverec', 'uhly'] as const);
    if (kind === 'lichobeznik') {
      const a = r.int(5, 15), c = r.int(2, a - 1), v = r.int(2, 10);
      const S = frac((a + c) * v, 2);
      return {
        question: `Lichoběžník má základny $${a}$ cm a $${c}$ cm a výšku $${v}$ cm. Vypočítej jeho obsah (cm²).`,
        answer: fracAns(S), solution: [`$S = \\frac{(a + c)v}{2} = \\frac{(${a} + ${c})\\cdot${v}}{2} = ${ftex(S)}$`],
        verify: () => approx(a * v - ((a - c) * v) / 2, fval(S)),
      };
    }
    if (kind === 'kosoctverec') {
      const [p, q, s] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]] as const);
      return {
        question: `Kosočtverec má úhlopříčky $${2 * p}$ cm a $${2 * q}$ cm. Vypočítej délku jeho strany (cm).`,
        answer: intAns(s), solution: [`Úhlopříčky se půlí a jsou kolmé: $a = \\sqrt{${p}^2 + ${q}^2} = ${s}$`],
        verify: () => p * p + q * q === s * s,
      };
    }
    const n = r.pick([5, 6, 8, 9, 10, 12, 15, 18, 20]);
    const ang = ((n - 2) * 180) / n;
    return {
      question: `Jak velký je vnitřní úhel pravidelného ${n}-úhelníku (ve stupních)?`,
      answer: fracAns(frac((n - 2) * 180, n)),
      solution: [`Součet vnitřních úhlů: $(n-2)\\cdot180^\\circ = ${(n - 2) * 180}^\\circ$`, `Jeden úhel: $\\frac{${(n - 2) * 180}}{${n}} = ${ntex(ang)}^\\circ$`],
      verify: () => approx(180 - 360 / n, ang),
    };
  },
};

// ───────────── Kombinatorika, pravděpodobnost, statistika ─────────────

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const comb = (n: number, k: number) => Math.round(fact(n) / (fact(k) * fact(n - k)));

const counting: Template = {
  id: 'komb-pocitani', topic: 'kombinatorika', name: 'Permutace, variace, kombinace', levels: ALL,
  generate(r) {
    const kind = r.pick(['perm', 'var', 'komb'] as const);
    if (kind === 'perm') {
      const n = r.int(4, 7);
      return {
        question: `Kolika způsoby lze seřadit ${n} různých knih na polici?`,
        answer: intAns(fact(n)),
        solution: [`Permutace bez opakování: $P(${n}) = ${n}! = ${fact(n)}$`],
        verify: () => Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1) === fact(n),
      };
    }
    const n = r.int(6, 12), k = r.int(2, 4);
    if (kind === 'var') {
      const v = fact(n) / fact(n - k);
      return {
        question: `Ve finále je ${n} běžců. Kolika způsoby mohou být obsazena první ${k} místa (na pořadí záleží)?`,
        answer: intAns(v),
        solution: [`Variace bez opakování: $V(${k}, ${n}) = \\frac{${n}!}{${n - k}!} = ${Array.from({ length: k }, (_, i) => n - i).join('\\cdot')} = ${v}$`],
        verify: () => Array.from({ length: k }, (_, i) => n - i).reduce((a, b) => a * b, 1) === v,
      };
    }
    const c = comb(n, k);
    return {
      question: `Ze třídy ${n} žáků vybíráme ${k}členné družstvo. Kolik je možností?`,
      answer: intAns(c),
      solution: [`Kombinace: $\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!\\,${n - k}!} = ${c}$`],
      verify: () => {
        // Pascalův vzorec jako nezávislá kontrola
        const row = [1];
        for (let i = 0; i < n; i++) row.push(0);
        for (let i = 1; i <= n; i++) for (let j = i; j > 0; j--) row[j] += row[j - 1];
        return row[k] === c;
      },
    };
  },
};

const binom: Template = {
  id: 'komb-binom', topic: 'kombinatorika', name: 'Binomická věta', levels: ADV,
  generate(r) {
    const n = r.int(4, 7), a = r.nz(-3, 3), k = r.int(1, n - 1);
    const coef = comb(n, k) * a ** (n - k);
    return {
      question: `Urči koeficient u $x^{${k}}$ v rozvoji $(x ${sg(a)})^{${n}}$.`,
      answer: intAns(coef),
      solution: [`Člen s $x^{${k}}$: $\\binom{${n}}{${k}} x^{${k}} \\cdot ${par(a)}^{${n - k}}$`, `Koeficient: $${comb(n, k)}\\cdot${par(a ** (n - k))} = ${coef}$`],
      verify: () => {
        // roznásobení polynomu
        let p = [1];
        for (let i = 0; i < n; i++) {
          const q = new Array(p.length + 1).fill(0);
          p.forEach((c, j) => { q[j] += c * a; q[j + 1] += c; });
          p = q;
        }
        return p[k] === coef;
      },
    };
  },
};

const probability: Template = {
  id: 'komb-pravdepodobnost', topic: 'kombinatorika', name: 'Pravděpodobnost', levels: ALL,
  generate(r) {
    if (r.next() < 0.5) {
      const red = r.int(2, 6), blue = r.int(2, 6), k = 2;
      const both = r.pick(['red', 'mixed'] as const);
      const total = comb(red + blue, k);
      const fav = both === 'red' ? comb(red, 2) : red * blue;
      const P = frac(fav, total);
      return {
        question: `V osudí je ${red} červených a ${blue} modrých koulí. Náhodně vytáhneme 2 koule najednou. Jaká je pravděpodobnost, že ${both === 'red' ? 'obě budou červené' : 'každá bude jiné barvy'}?`,
        answer: fracAns(P),
        solution: [`Všech možností: $\\binom{${red + blue}}{2} = ${total}$`, `Příznivých: ${both === 'red' ? `$\\binom{${red}}{2} = ${fav}$` : `$${red}\\cdot${blue} = ${fav}$`}`, `$P = \\frac{${fav}}{${total}} = ${ftex(P)}$`],
        verify: () => {
          const balls = [...Array(red).fill('r'), ...Array(blue).fill('b')];
          let all = 0, good = 0;
          for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
            all++;
            if (both === 'red' ? balls[i] === 'r' && balls[j] === 'r' : balls[i] !== balls[j]) good++;
          }
          return approx(good / all, fval(P));
        },
      };
    }
    const s = r.int(3, 11);
    let fav = 0;
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (i + j === s) fav++;
    const P = frac(fav, 36);
    return {
      question: `Hodíme dvěma kostkami. Jaká je pravděpodobnost, že součet ok bude ${s}?`,
      answer: fracAns(P),
      solution: [`Všech výsledků: $6\\cdot6 = 36$`, `Příznivých dvojic se součtem ${s}: ${fav}`, `$P = \\frac{${fav}}{36} = ${ftex(P)}$`],
      verify: () => approx(fval(P), (6 - Math.abs(s - 7)) / 36),
    };
  },
};

const stats: Template = {
  id: 'komb-statistika', topic: 'kombinatorika', name: 'Statistika – průměr a medián', levels: ALL,
  generate(r) {
    const n = r.int(5, 8);
    const data = Array.from({ length: n }, () => r.int(1, 20));
    const ask = r.pick(['prumer', 'median'] as const);
    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const res = ask === 'prumer' ? frac(sum, n) : n % 2 ? frac(sorted[(n - 1) / 2]) : frac(sorted[n / 2 - 1] + sorted[n / 2], 2);
    return {
      question: `Urči ${ask === 'prumer' ? 'aritmetický průměr' : 'medián'} souboru: $${data.join(';\\ ')}$`,
      answer: fracAns(res),
      solution: ask === 'prumer'
        ? [`Součet: $${sum}$, počet: $${n}$`, `$\\bar{x} = \\frac{${sum}}{${n}} = ${ftex(res)}$`]
        : [`Seřaď: $${sorted.join(';\\ ')}$`, n % 2 ? `Prostřední hodnota: $${ftex(res)}$` : `Průměr dvou prostředních: $\\frac{${sorted[n / 2 - 1]} + ${sorted[n / 2]}}{2} = ${ftex(res)}$`],
      verify: () => {
        if (ask === 'prumer') return approx(data.reduce((s, x) => s + (x - fval(res)), 0), 0);
        const below = data.filter((x) => x < fval(res)).length, above = data.filter((x) => x > fval(res)).length;
        return below <= n / 2 && above <= n / 2;
      },
    };
  },
};

const factEq: Template = {
  id: 'komb-faktorial', topic: 'kombinatorika', name: 'Rovnice s faktoriály', levels: ADV,
  generate(r) {
    const n = r.int(3, 15);
    if (r.next() < 0.5) {
      const N = (n + 1) * n;
      return {
        question: `Řeš v $\\mathbb{N}$: $\\dfrac{(n+1)!}{(n-1)!} = ${N}$`,
        answer: intAns(n),
        solution: [`$\\frac{(n+1)!}{(n-1)!} = (n+1)n$`, `$n^2 + n - ${N} = 0 \\Rightarrow n = ${n}$ (záporný kořen $${-n - 1}$ nevyhovuje)`],
        verify: () => fact(n + 1) / fact(n - 1) === N,
      };
    }
    const N = (n * (n - 1)) / 2;
    return {
      question: `Řeš v $\\mathbb{N}$: $\\binom{n}{2} = ${N}$`,
      answer: intAns(n),
      solution: [`$\\binom{n}{2} = \\frac{n(n-1)}{2} = ${N}$`, `$n^2 - n - ${2 * N} = 0 \\Rightarrow n = ${n}$ (záporný kořen $${1 - n}$ nevyhovuje)`],
      verify: () => comb(n, 2) === N,
    };
  },
};

// ───────────── Komplexní čísla ─────────────

const cmul = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const zTex = (z: [number, number]) => cTex(z[0], z[1]).tex;

const complexOps: Template = {
  id: 'kompl-operace', topic: 'komplexni', name: 'Počítání s komplexními čísly', levels: ADV,
  generate(r) {
    const z: [number, number] = [r.int(-6, 6), r.nz(-6, 6)];
    const w: [number, number] = [r.int(-5, 5), r.nz(-5, 5)];
    if (r.next() < 0.5) {
      const p = cmul(z, w);
      const res = cTex(p[0], p[1]);
      return {
        question: `Vypočítej $(${zTex(z)})(${zTex(w)})$ a zapiš v algebraickém tvaru.`,
        answer: numAns(cx(p[0], p[1]), res.input, res.tex),
        solution: [`Roznásob a použij $i^2 = -1$.`, `$= ${z[0] * w[0]} ${sg(z[0] * w[1])}i ${sg(z[1] * w[0])}i ${sg(-z[1] * w[1])} = ${res.tex}$`],
        verify: () => {
          const v = evaluate(`(${cTex(...z).input})*(${cTex(...w).input})`);
          return approx(v.re, p[0]) && approx(v.im, p[1]);
        },
      };
    }
    // u = z·w, ptáme se na u / w = z
    const u = cmul(z, w);
    const res = cTex(z[0], z[1]);
    const n2 = w[0] ** 2 + w[1] ** 2;
    return {
      question: `Vypočítej $\\dfrac{${zTex(u)}}{${zTex(w)}}$ a zapiš v algebraickém tvaru.`,
      answer: numAns(cx(z[0], z[1]), res.input, res.tex),
      solution: [
        `Rozšiř komplexně sdruženým jmenovatelem $${zTex([w[0], -w[1]])}$.`,
        `Jmenovatel: $${w[0] ** 2} + ${w[1] ** 2} = ${n2}$`,
        `Výsledek: $${res.tex}$`,
      ],
      verify: () => {
        const back = cmul(z, w);
        return back[0] === u[0] && back[1] === u[1];
      },
    };
  },
};

const modulus: Template = {
  id: 'kompl-absolutni', topic: 'komplexni', name: 'Absolutní hodnota a mocniny i', levels: ADV,
  generate(r) {
    if (r.next() < 0.5) {
      const [a, b, c] = r.pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]] as const);
      const z: [number, number] = [a * r.sign(), b * r.sign()];
      return {
        question: `Vypočítej $|${zTex(z)}|$.`,
        answer: intAns(c),
        solution: [`$|a + bi| = \\sqrt{a^2 + b^2} = \\sqrt{${a * a} + ${b * b}} = ${c}$`],
        verify: () => approx(Math.hypot(z[0], z[1]), c),
      };
    }
    const n = r.int(5, 99);
    const powers: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const p = powers[n % 4];
    const res = cTex(p[0], p[1]);
    return {
      question: `Vypočítej $i^{${n}}$.`,
      answer: numAns(cx(p[0], p[1]), res.input, res.tex),
      solution: [`Mocniny $i$ se opakují s periodou 4: $${n} = 4\\cdot${Math.floor(n / 4)} + ${n % 4}$`, `$i^{${n}} = i^{${n % 4}} = ${res.tex}$`],
      verify: () => {
        let z: [number, number] = [1, 0];
        for (let k = 0; k < n; k++) z = cmul(z, [0, 1]);
        return z[0] === p[0] && z[1] === p[1];
      },
    };
  },
};

const complexQuad: Template = {
  id: 'kompl-kvadraticka', topic: 'komplexni', name: 'Kvadratická rovnice v ℂ', levels: ADV,
  generate(r) {
    const a = r.int(-5, 5), b = r.int(1, 6);
    // (x - a)² + b² = 0 → x² - 2a x + a² + b² = 0
    const B = -2 * a, Cc = a * a + b * b;
    const ans = setAnsItems([cTex(a, b), cTex(a, -b)].map((t, k) => ({ value: cx(a, k ? -b : b), ...t })));
    return {
      question: `Řeš v $\\mathbb{C}$: $${poly([1, B, Cc])} = 0$`,
      answer: ans,
      solution: [`$D = ${B * B} - ${4 * Cc} = ${B * B - 4 * Cc}$`, `$\\sqrt{D} = ${2 * b}i$`, `$x_{1,2} = \\frac{${-B} \\pm ${2 * b}i}{2} = ${a} \\pm ${b === 1 ? '' : b}i$`],
      verify: () => [[a, b], [a, -b]].every(([re, im]) => {
        const z: [number, number] = [re, im];
        const z2 = cmul(z, z);
        return approx(z2[0] + B * re + Cc, 0) && approx(z2[1] + B * im, 0);
      }),
    };
  },
};

export const GEOMETRY: Template[] = [arith, arithSum, geom, series, distance, midpoint, lineEq, vectors, pointLine, circle, ellipse, intersect, rightTri, circleArea, cuboid, solids, polygons, counting, binom, probability, stats, factEq, complexOps, modulus, complexQuad];

