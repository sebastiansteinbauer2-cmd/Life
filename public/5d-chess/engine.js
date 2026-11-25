/* 5D šachy – engine pravidel (multiverzum + cestování v čase).
 * Vlastní implementace, bez závislostí. Funguje v prohlížeči i v Node (testy).
 *
 * Souřadnice figury: (l, t, x, y)
 *   l – časová osa (0 = hlavní, +1.. větve vytvořené bílým, -1.. větve vytvořené černým)
 *   t – půltah (0 = bílý na tahu, 1 = černý, 2 = bílý…); deska s t sudým je na tahu bílého
 *   x, y – sloupec a řádek (y = 0 je první řada bílého)
 * Pohyb v čase se měří v „tazích“ (1 krok = 2 půltahy), aby figura zůstala na deskách téže barvy.
 */
(function (root) {
  'use strict';

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const VAL = [0, 1, 3, 3.2, 5, 9, 0];

  const VARIANTS = {
    standard: { name: 'Standardní 8×8', n: 8, back: [R, N, B, Q, K, B, N, R], castle: true },
    small: { name: 'Malé 5×5', n: 5, back: [R, N, B, Q, K], castle: false },
  };

  /* ---------- směry pohybu ve 4D: [dx, dy, dl, dt] ---------- */
  const KING = [], ROOK = [], BISHOP = [], KNIGHT = [];
  (function () {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dl = -1; dl <= 1; dl++)
          for (let dt = -1; dt <= 1; dt++) {
            const nz = (dx !== 0) + (dy !== 0) + (dl !== 0) + (dt !== 0);
            if (!nz) continue;
            const v = [dx, dy, dl, dt];
            KING.push(v); // všech 80 směrů = dáma (věž + střelec + jednorožec + drak)
            if (nz === 1) ROOK.push(v);
            else if (nz === 2) BISHOP.push(v);
          }
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        if (a === b) continue;
        for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
          const v = [0, 0, 0, 0];
          v[a] = 2 * sa; v[b] = sb;
          KNIGHT.push(v);
        }
      }
  })();

  /* ---------- pomocné funkce ---------- */
  const pType = (p) => p & 7;
  const pCol = (p) => (p >> 3) & 1;
  const mkPiece = (type, col, moved) => type | (col << 3) | (moved ? 16 : 0);

  function initialState(variant) {
    const v = VARIANTS[variant] || VARIANTS.standard;
    const n = v.n;
    const cells = new Int8Array(n * n);
    for (let x = 0; x < n; x++) {
      cells[x] = mkPiece(v.back[x], 0);
      cells[n + x] = mkPiece(P, 0);
      cells[(n - 1) * n + x] = mkPiece(v.back[x], 1);
      cells[(n - 2) * n + x] = mkPiece(P, 1);
    }
    return {
      n, variant: variant in VARIANTS ? variant : 'standard', castle: v.castle,
      tls: { 0: { l: 0, start: 0, parent: null, boards: [{ cells, ep: null }] } },
      ls: [0], nw: 0, nb: 0, posA: 0, negA: 0, info: null,
    };
  }

  const headT = (tl) => tl.start + tl.boards.length - 1;
  const isActive = (s, l) => l >= -s.negA && l <= s.posA;
  function boardAt(s, l, t) {
    const tl = s.tls[l];
    if (!tl) return null;
    return tl.boards[t - tl.start] || null;
  }
  /* obsah pole; -1 = pole/deska neexistuje nebo je neaktivní */
  function at(s, l, t, x, y) {
    const n = s.n;
    if (x < 0 || y < 0 || x >= n || y >= n) return -1;
    if (l < -s.negA || l > s.posA) return -1;
    const tl = s.tls[l];
    if (!tl) return -1;
    const b = tl.boards[t - tl.start];
    if (!b) return -1;
    return b.cells[y * n + x];
  }
  function activeHeads(s) {
    const out = [];
    for (const l of s.ls) if (isActive(s, l)) out.push({ l, t: headT(s.tls[l]) });
    return out;
  }
  function presentT(s) {
    let m = Infinity;
    for (const l of s.ls) if (isActive(s, l)) { const t = headT(s.tls[l]); if (t < m) m = t; }
    return m;
  }

  const mv = (col, fl, ft, fx, fy, dl, dt, dx, dy, cap, flag, pr) =>
    ({ col, fl, ft, fx, fy, dl, dt, dx, dy, cap, flag, pr: !!pr, pt: 0, pc: 0 });

  /* ---------- generování tahů (pseudo-legální – šachy řeší kontrola po tahu) ---------- */
  function slide(s, out, l, t, x, y, col, vecs, max) {
    for (let i = 0; i < vecs.length; i++) {
      const v = vecs[i];
      let nl = l, nt = t, nx = x, ny = y;
      for (let k = 0; k < max; k++) {
        nl += v[2]; nt += 2 * v[3]; nx += v[0]; ny += v[1];
        const q = at(s, nl, nt, nx, ny);
        if (q < 0) break;
        if (q === 0) { out.push(mv(col, l, t, x, y, nl, nt, nx, ny, 0, 0, false)); continue; }
        if (pCol(q) !== col) out.push(mv(col, l, t, x, y, nl, nt, nx, ny, q, 0, false));
        break;
      }
    }
  }
  function jump(s, out, l, t, x, y, col, vecs) {
    for (let i = 0; i < vecs.length; i++) {
      const v = vecs[i];
      const nl = l + v[2], nt = t + 2 * v[3], nx = x + v[0], ny = y + v[1];
      const q = at(s, nl, nt, nx, ny);
      if (q < 0) continue;
      if (q === 0) out.push(mv(col, l, t, x, y, nl, nt, nx, ny, 0, 0, false));
      else if (pCol(q) !== col) out.push(mv(col, l, t, x, y, nl, nt, nx, ny, q, 0, false));
    }
  }

  function pawn(s, out, l, t, x, y, col, p, fa, b) {
    const n = s.n, dir = col ? -1 : 1, last = col ? 0 : n - 1;
    const unmoved = (p & 16) === 0;
    if (!fa) {
      let q = at(s, l, t, x, y + dir);
      if (q === 0) {
        out.push(mv(col, l, t, x, y, l, t, x, y + dir, 0, 0, y + dir === last));
        if (unmoved && at(s, l, t, x, y + 2 * dir) === 0)
          out.push(mv(col, l, t, x, y, l, t, x, y + 2 * dir, 0, 1, y + 2 * dir === last));
      }
      q = at(s, l + dir, t, x, y);
      if (q === 0) {
        out.push(mv(col, l, t, x, y, l + dir, t, x, y, 0, 0, false));
        if (unmoved && at(s, l + 2 * dir, t, x, y) === 0)
          out.push(mv(col, l, t, x, y, l + 2 * dir, t, x, y, 0, 0, false));
      }
    }
    const caps = [[1, dir, 0, 0], [-1, dir, 0, 0], [0, dir, 0, 1], [0, dir, 0, -1],
                  [1, 0, dir, 0], [-1, 0, dir, 0], [0, 0, dir, 1], [0, 0, dir, -1]];
    for (let i = 0; i < 8; i++) {
      const c = caps[i];
      const nl = l + c[2], nt = t + 2 * c[3], nx = x + c[0], ny = y + c[1];
      const q = at(s, nl, nt, nx, ny);
      if (q > 0) {
        if (pCol(q) !== col) out.push(mv(col, l, t, x, y, nl, nt, nx, ny, q, 0, ny === last));
      } else if (q === 0 && !fa && c[2] === 0 && c[3] === 0 && c[1] === dir && b.ep && b.ep.x === nx && b.ep.y === ny) {
        out.push(mv(col, l, t, x, y, nl, nt, nx, ny, mkPiece(P, 1 - col, true), 2, ny === last));
      }
    }
  }

  function castling(s, out, l, t, x, y, col, b) {
    const n = s.n, home = col ? n - 1 : 0;
    if (y !== home || x !== 4) return;
    const c = b.cells;
    const isRook = (q) => q !== 0 && pType(q) === R && pCol(q) === col && (q & 16) === 0;
    const sides = [
      { rook: 7, empty: [5, 6], mid: 5, to: 6, flag: 3 },
      { rook: 0, empty: [1, 2, 3], mid: 3, to: 2, flag: 4 },
    ];
    let inCheck = null;
    for (const sd of sides) {
      if (!isRook(c[home * n + sd.rook])) continue;
      if (sd.empty.some((ex) => c[home * n + ex] !== 0)) continue;
      if (inCheck === null) inCheck = kingsAttacked(passState(s, col), 1 - col).length > 0;
      if (inCheck) return;
      const s2 = applyMove(s, mv(col, l, t, x, y, l, t, sd.mid, home, 0, 0, false));
      if (kingsAttacked(s2, 1 - col).length) continue;
      out.push(mv(col, l, t, x, y, l, t, sd.to, home, 0, sd.flag, false));
    }
  }

  /* fa = „forAttack“: jen tahy, které mohou brát (bez rošády, bez nebraných tahů pěšce) */
  function genPiece(s, l, t, x, y, out, fa) {
    const b = boardAt(s, l, t);
    const p = b.cells[y * s.n + x];
    const ty = pType(p), col = pCol(p);
    const st = out.length;
    switch (ty) {
      case P: pawn(s, out, l, t, x, y, col, p, fa, b); break;
      case N: jump(s, out, l, t, x, y, col, KNIGHT); break;
      case B: slide(s, out, l, t, x, y, col, BISHOP, 64); break;
      case R: slide(s, out, l, t, x, y, col, ROOK, 64); break;
      case Q: slide(s, out, l, t, x, y, col, KING, 64); break;
      case K:
        jump(s, out, l, t, x, y, col, KING);
        if (!fa && s.castle && (p & 16) === 0) castling(s, out, l, t, x, y, col, b);
        break;
    }
    for (let i = st; i < out.length; i++) out[i].pc = p;
    return out;
  }

  function playableHeads(s, col) {
    const res = [];
    for (const l of s.ls) {
      if (!isActive(s, l)) continue;
      const t = headT(s.tls[l]);
      if ((t & 1) === col) res.push({ l, t });
    }
    return res;
  }
  function allMoves(s, col) {
    const out = [], n = s.n;
    for (const h of playableHeads(s, col)) {
      const cells = boardAt(s, h.l, h.t).cells;
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (p !== 0 && pCol(p) === col) genPiece(s, h.l, h.t, i % n, (i / n) | 0, out, false);
      }
    }
    return out;
  }

  /* ---------- provedení tahu (vrací nový stav; původní se nemění) ---------- */
  function pushBoard(s2, l, board) {
    const tl = s2.tls[l];
    s2.tls[l] = { l: tl.l, start: tl.start, parent: tl.parent, boards: tl.boards.concat([board]) };
  }

  function applyMove(s, m) {
    const n = s.n, col = m.col;
    const srcTl = s.tls[m.fl];
    const srcB = srcTl.boards[m.ft - srcTl.start];
    const fi = m.fy * n + m.fx, di = m.dy * n + m.dx;
    const p = srcB.cells[fi];
    let np = (p & 7) | (col << 3) | 16;
    if (pType(p) === P && m.pr) np = (m.pt || Q) | (col << 3) | 16;
    const s2 = {
      n, variant: s.variant, castle: s.castle, tls: Object.assign({}, s.tls), ls: s.ls,
      nw: s.nw, nb: s.nb, posA: s.posA, negA: s.negA, info: null,
    };
    if (m.fl === m.dl && m.ft === m.dt) {
      const cells = srcB.cells.slice();
      cells[fi] = 0; cells[di] = np;
      let ep = null;
      if (m.flag === 1) ep = { x: m.dx, y: (m.fy + m.dy) / 2 };
      if (m.flag === 2) cells[m.fy * n + m.dx] = 0;
      if (m.flag === 3 || m.flag === 4) {
        const home = m.fy, rf = m.flag === 3 ? 7 : 0, rt = m.flag === 3 ? 5 : 3;
        cells[home * n + rf] = 0;
        cells[home * n + rt] = mkPiece(R, col, true);
      }
      pushBoard(s2, m.fl, { cells, ep });
      s2.info = { from: { l: m.fl, t: m.ft + 1 }, to: { l: m.fl, t: m.ft + 1 } };
      return s2;
    }
    // skok mezi deskami: zdrojová deska ztratí figuru, cílová ji získá
    const dstTl = s.tls[m.dl];
    const dstB = dstTl.boards[m.dt - dstTl.start];
    const c1 = srcB.cells.slice(); c1[fi] = 0;
    const c2 = dstB.cells.slice(); c2[di] = np;
    const dstIsHead = m.dt === headT(dstTl);
    pushBoard(s2, m.fl, { cells: c1, ep: null });
    s2.info = { from: { l: m.fl, t: m.ft + 1 }, to: null };
    if (dstIsHead) {
      pushBoard(s2, m.dl, { cells: c2, ep: null });
      s2.info.to = { l: m.dl, t: m.dt + 1 };
    } else {
      let idx;
      if (col === 0) { s2.nw = s.nw + 1; idx = s2.nw; } else { s2.nb = s.nb + 1; idx = -s2.nb; }
      s2.tls[idx] = { l: idx, start: m.dt + 1, parent: { l: m.dl, t: m.dt }, boards: [{ cells: c2, ep: null }] };
      s2.ls = s.ls.concat([idx]);
      s2.posA = Math.min(s2.nw, s2.nb + 1);
      s2.negA = Math.min(s2.nb, s2.nw + 1);
      s2.info.to = { l: idx, t: m.dt + 1, branch: true };
    }
    return s2;
  }

  /* hypotetické „vynechání tahu“ na deskách v přítomnosti (slouží k zobrazení šachu) */
  function passState(s, col) {
    const pt = presentT(s);
    const s2 = Object.assign({}, s, { tls: Object.assign({}, s.tls), info: null });
    if ((pt & 1) !== col) return s2;
    for (const l of s.ls) {
      if (!isActive(s, l)) continue;
      const tl = s.tls[l];
      if (headT(tl) === pt) pushBoard(s2, l, { cells: tl.boards[tl.boards.length - 1].cells, ep: null });
    }
    return s2;
  }

  /* tahy soupeře `att`, které by teď vzaly krále (na libovolné desce, i v minulosti) */
  function kingsAttacked(s, att) {
    const res = [], out = [], n = s.n;
    for (const h of playableHeads(s, att)) {
      const cells = boardAt(s, h.l, h.t).cells;
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (p === 0 || pCol(p) !== att) continue;
        out.length = 0;
        genPiece(s, h.l, h.t, i % n, (i / n) | 0, out, true);
        for (let k = 0; k < out.length; k++) {
          const m = out[k];
          if (m.cap && pType(m.cap) === K) res.push(m);
        }
      }
    }
    return res;
  }

  /* legální tahy jedné figury (po tahu, který dokončí kolo, nesmí být vlastní král v šachu) */
  function legalMovesFor(s, l, t, x, y) {
    const b = boardAt(s, l, t);
    const p = b.cells[y * s.n + x];
    const col = pCol(p), out = [], res = [];
    genPiece(s, l, t, x, y, out, false);
    for (const m of out) {
      const s2 = applyMove(s, m);
      if ((presentT(s2) & 1) === col) res.push(m);
      else if (kingsAttacked(s2, 1 - col).length === 0) res.push(m);
    }
    return res;
  }

  /* existuje pro hráče `col` aspoň jedno legální kolo? true / false / null (vyčerpán rozpočet) */
  function findTurn(s, col, budget, ms) {
    let nodes = 0;
    const deadline = Date.now() + (ms || 700);
    function dfs(st) {
      if (++nodes > budget || ((nodes & 7) === 0 && Date.now() > deadline)) throw 'budget';
      if ((presentT(st) & 1) !== col) return kingsAttacked(st, 1 - col).length === 0;
      const ms = allMoves(st, col);
      const cur = presentT(st);
      ms.sort((a, b) => ((b.ft === cur) - (a.ft === cur)) || ((b.cap ? 1 : 0) - (a.cap ? 1 : 0)));
      for (const m of ms) if (dfs(applyMove(st, m))) return true;
      return false;
    }
    try { return dfs(s); } catch (e) { if (e === 'budget') return null; throw e; }
  }

  function analyze(s, col, budget, ms) {
    const inCheck = kingsAttacked(passState(s, col), 1 - col).length > 0;
    const r = findTurn(s, col, budget || 4000, ms || 700);
    if (r === false) return { status: inCheck ? 'checkmate' : 'stalemate', inCheck };
    return { status: 'ok', inCheck };
  }

  /* ---------- jednoduchá AI ---------- */
  function material(s, col) {
    let sum = 0;
    for (const h of activeHeads(s)) {
      const cells = boardAt(s, h.l, h.t).cells;
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (p) sum += (pCol(p) === col ? 1 : -1) * VAL[pType(p)];
      }
    }
    return sum;
  }

  function isBranch(st, m) {
    return (m.fl !== m.dl || m.ft !== m.dt) && m.dt !== headT(st.tls[m.dl]);
  }

  function randomTurn(s, col, budget, deadline) {
    let nodes = 0;
    function dfs(st, seq) {
      if (++nodes > budget || Date.now() > deadline) return null;
      if ((presentT(st) & 1) !== col) return kingsAttacked(st, 1 - col).length ? null : { st, seq };
      const ms = allMoves(st, col);
      const cur = presentT(st);
      for (const m of ms) {
        m.pt = Q;
        m.sc = (m.cap ? VAL[pType(m.cap)] * 10 : 0) + Math.random() * 6 + (m.ft === cur ? 20 : 0)
          - (m.dl !== m.fl || m.dt !== m.ft ? 3 : 0) - (isBranch(st, m) ? (st.ls.length > 4 ? 40 : 6) : 0);
      }
      ms.sort((a, b) => b.sc - a.sc);
      const lim = Math.min(ms.length, 10);
      for (let i = 0; i < lim; i++) {
        const r = dfs(applyMove(st, ms[i]), seq.concat([ms[i]]));
        if (r) return r;
        if (nodes > budget || Date.now() > deadline) return null;
      }
      return null;
    }
    return dfs(s, []);
  }

  function evalTurn(st, col) {
    let danger = 0;
    for (const m of allMoves(st, 1 - col)) {
      if (m.cap) { const v = VAL[pType(m.cap)]; if (v > danger) danger = v; }
    }
    return material(st, col) - 0.7 * danger;
  }

  function aiTurn(s, col, opts) {
    const ms = (opts && opts.ms) || 800;
    const t0 = Date.now();
    const hard = t0 + ms * 4 + 1500; // tvrdý strop, aby se aplikace nikdy nezasekla
    let best = null, bestScore = -1e9, tries = 0;
    while ((Date.now() - t0 < ms || !best) && tries < 60 && Date.now() < hard) {
      tries++;
      const r = randomTurn(s, col, 700, hard);
      if (!r) continue;
      const sc = (Date.now() < hard ? evalTurn(r.st, col) : material(r.st, col)) + Math.random() * 0.6;
      if (sc > bestScore) { bestScore = sc; best = r.seq; }
    }
    return best;
  }

  /* ---------- zápis tahu ---------- */
  const LET = ['', '', 'N', 'B', 'R', 'Q', 'K'];
  function describe(m) {
    const sq = (x, y) => String.fromCharCode(97 + x) + (y + 1);
    let r = LET[pType(m.pc)] + sq(m.fx, m.fy) + (m.cap ? '×' : '→') + sq(m.dx, m.dy);
    if (m.flag === 3) r = 'O-O'; else if (m.flag === 4) r = 'O-O-O';
    if (m.fl !== m.dl || m.ft !== m.dt) r += ' [L' + (m.dl > 0 ? '+' : '') + m.dl + ' T' + (Math.floor(m.dt / 2) + 1) + (m.dt & 1 ? 'č' : 'b') + ']';
    return r;
  }

  const api = {
    P, N, B, R, Q, K, VAL, VARIANTS, KING, ROOK, BISHOP, KNIGHT,
    pType, pCol, mkPiece, initialState, headT, isActive, boardAt, at, activeHeads, presentT,
    genPiece, allMoves, playableHeads, applyMove, passState, kingsAttacked, legalMovesFor,
    findTurn, analyze, aiTurn, randomTurn, material, describe,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine5D = api;
})(typeof window !== 'undefined' ? window : globalThis);
