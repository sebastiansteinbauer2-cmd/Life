import { useState } from 'react';
import { store, useProfile, useQuery } from '../app/context';
import { PixelAvatar } from '../components/PixelAvatar';
import { Modal } from '../components/ui';
import { dateKey } from '../lib/date';
import { solvedIds } from '../modules/code/logic';
import { PY_TASKS } from '../modules/code/tasks';
import { buildCastles, heroIndex, type Castle } from '../game/worldMap';
import { levelFromXp, titleTier } from '../game/xp';

const ROW = 128; // výška jednoho úseku cesty

/** Mapa světa – velké cíle jako hrady na cestě, hrdina stojí u nejbližšího nedobytého. */
export default function WorldMap() {
  const p = useProfile();
  const [open, setOpen] = useState<Castle | null>(null);
  const castles = useQuery(async () => {
    const [boss, acts, snaps, books, attempts, meta] = await Promise.all([
      store.col('bossResults').all(), store.col('activities').all(), store.col('financeSnapshots').all(),
      store.col('readBooks').all(), store.col('codeAttempts').all(), store.col('meta').all(),
    ]);
    return buildCastles({
      profile: p,
      bossBest: Math.max(0, ...boss.map((b) => b.score)),
      acts,
      snapshot: snaps.sort((a, b) => b.ts - a.ts)[0],
      books,
      codeSolved: solvedIds(attempts).size,
      codeTotal: PY_TASKS.length,
      budgetMonths: meta.filter((m) => m.id.startsWith('budgetMonth:') && m.value === true).length,
      today: dateKey(),
    });
  }, [p]);
  if (!castles) return null;

  // cesta vede zdola nahoru, hrady střídavě vlevo a vpravo
  const n = castles.length;
  const height = (n + 1) * ROW;
  const pos = (i: number) => ({ x: i % 2 === 0 ? 28 : 72, y: height - (i + 1) * ROW - 30 });
  const start = { x: 50, y: height - 40 };
  const pts = [start, ...castles.map((_, i) => pos(i))];
  const path = pts.map((pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const my = (prev.y + pt.y) / 2;
    return `C ${prev.x} ${my}, ${pt.x} ${my}, ${pt.x} ${pt.y}`;
  }).join(' ');
  const hero = heroIndex(castles);
  const done = castles.filter((c) => c.progress >= 1).length;
  const heroPos = pos(hero);

  return (
    <div>
      <h1>🗺️ Mapa světa</h1>
      <p className="small muted">Tvoje cesta k velkým cílům. Dobyto {done} z {n} hradů – klepni na hrad pro detail.</p>
      <div className="world-map" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="world-path" aria-hidden>
          <path d={path} fill="none" stroke="rgba(245,197,66,0.25)" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeDasharray="2 10" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </svg>
        <div className="world-start" style={{ left: `${start.x}%`, top: start.y }}>🏕️ Start</div>
        {castles.map((c, i) => {
          const { x, y } = pos(i);
          const won = c.progress >= 1;
          return (
            <button key={c.id} className={`castle ${won ? 'won' : ''}`} style={{ left: `${x}%`, top: y }} onClick={() => setOpen(c)}
              aria-label={`${c.title}: ${Math.floor(c.progress * 100)} %`}>
              <span className="ring" style={{ background: `conic-gradient(var(--gold) ${c.progress * 360}deg, var(--border) 0)` }}>
                <span className="ic">{won ? '🏰' : c.icon}</span>
              </span>
              {won && <span className="flag">🚩</span>}
              <span className="nm">{c.title}</span>
              <span className="pct">{won ? 'Dobyto!' : `${Math.floor(c.progress * 100)} %`}</span>
            </button>
          );
        })}
        <div className="world-hero" style={{ left: `${heroPos.x + (hero % 2 === 0 ? 22 : -22)}%`, top: heroPos.y - 6 }}>
          <PixelAvatar tier={titleTier(levelFromXp(p.xp).level)} size={44} />
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.icon} ${open.title}` : ''}>
        {open && (
          <div className="stack">
            <div className="pixel" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}>{Math.floor(open.progress * 100)} %</div>
            <p style={{ margin: 0 }}>{open.detail}</p>
            <a className="btn primary btn-block" href={`#${open.route}`} onClick={() => setOpen(null)}>Jít na to ›</a>
          </div>
        )}
      </Modal>
    </div>
  );
}
