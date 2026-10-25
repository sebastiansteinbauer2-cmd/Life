import { useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { LineChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Modal, Tabs } from '../../components/ui';
import type { Book, ChessGame, ChessTimeClass } from '../../data/types';
import { uid } from '../../lib/date';
import { ANALYSIS_XP, openingFamily, scoreOf } from './chessApi';
import { syncChess } from './sync';

const TABS = [
  { path: '/chess', label: 'Přehled' },
  { path: '/chess/games', label: 'Partie' },
  { path: '/chess/stats', label: 'Statistiky' },
  { path: '/chess/books', label: 'Knihy' },
];
const TC_LABEL: Record<ChessTimeClass, string> = { rapid: 'Rapid', blitz: 'Blitz', bullet: 'Bullet', daily: 'Daily' };
const RES_LABEL = { win: 'Výhra', draw: 'Remíza', loss: 'Prohra' };
const CHAPTER_XP = 30;
const BOOK_XP = 150;

function useGames() {
  return useQuery(async () => (await store.col('chessGames').all()).sort((a, b) => b.endTime - a.endTime));
}

function SyncButton() {
  const p = useProfile();
  const last = useQuery(async () => (await store.col('meta').get('chessLastSync'))?.value as number | undefined);
  const [state, setState] = useState<{ busy: boolean; msg?: string; err?: boolean }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const r = await syncChess();
      setState({
        busy: false,
        msg: r.firstSync
          ? `Načteno ${r.newGames} partií z historie. XP se počítá od teď za nové partie.`
          : r.newGames ? `${r.newGames} nových partií, +${r.xp} XP${r.record ? `, nový rekord ${r.record}!` : ''}` : 'Žádné nové partie.',
      });
    } catch (e) {
      const m = (e as Error).message;
      setState({ busy: false, err: true, msg: m === 'Failed to fetch' ? 'Nepodařilo se spojit s Chess.com (offline?). Případně nastav proxy v Nastavení.' : m });
    }
  };
  if (!p.chessUsername) {
    return <a className="btn btn-gold btn-block" href="#/settings">Zadat jméno na Chess.com</a>;
  }
  return (
    <div>
      <button className="primary btn-block" onClick={run} disabled={state.busy}>{state.busy ? 'Synchronizuji…' : `⟳ Synchronizovat (${p.chessUsername})`}</button>
      <div className="small muted center" style={{ marginTop: 4 }}>
        {last ? `Poslední partie: ${new Date(last).toLocaleString('cs-CZ')}` : 'Zatím nesynchronizováno'}
      </div>
      {state.msg && <p className="center small" style={{ color: state.err ? 'var(--red)' : 'var(--green)' }}>{state.msg}</p>}
    </div>
  );
}

function RatingChart({ games, tc }: { games: ChessGame[]; tc: ChessTimeClass }) {
  const list = games.filter((g) => g.timeClass === tc && g.rated).sort((a, b) => a.endTime - b.endTime);
  if (list.length < 2) return <Empty>Pro graf ratingu ({TC_LABEL[tc]}) zatím není dost partií.</Empty>;
  return (
    <LineChart
      labels={list.map((g) => new Date(g.endTime).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }))}
      series={[{ label: TC_LABEL[tc], data: list.map((g) => g.myRating), color: '#4ade80', fill: true }]}
    />
  );
}

function ChessHome() {
  const p = useProfile();
  const quests = useQuests('chess');
  const games = useGames();
  const ratings = useQuery(async () => (await store.col('chessRatings').all()).sort((a, b) => b.ts - a.ts)[0]);
  const [tc, setTc] = useState<ChessTimeClass>('rapid');
  return (
    <div>
      <h1>♞ Šachy</h1>
      <Tabs items={TABS} active="/chess" />
      <section className="panel gold">
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
          {[['FIDE', p.fideRating], ['Rapid', ratings?.rapid], ['Blitz', ratings?.blitz], ['Puzzle', ratings?.puzzles]].map(([l, v]) => (
            <div key={l} className="center">
              <div className="pixel" style={{ color: 'var(--c-chess)', fontSize: '0.9rem' }}>{v ?? '–'}</div>
              <div className="small muted">{l}</div>
            </div>
          ))}
        </div>
        <SyncButton />
      </section>
      <h2>Týdenní plán</h2>
      <QuestList quests={quests ?? []} />
      <div className="row wrap">
        <a className="btn btn-sm" href="https://www.chess.com/puzzles/rated" target="_blank" rel="noopener noreferrer">🧩 Puzzle ↗</a>
        <a className="btn btn-sm" href="https://www.chess.com/play/online" target="_blank" rel="noopener noreferrer">♟ Hrát rapid ↗</a>
        <a className="btn btn-sm" href="https://www.chess.com/practice/drills/all-endgame-drills" target="_blank" rel="noopener noreferrer">👑 Koncovky ↗</a>
      </div>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="tabs">
          {(Object.keys(TC_LABEL) as ChessTimeClass[]).map((t) => (
            <button key={t} className={t === tc ? 'active' : ''} onClick={() => setTc(t)}>{TC_LABEL[t]}</button>
          ))}
        </div>
        <RatingChart games={games ?? []} tc={tc} />
      </section>
    </div>
  );
}

function GameModal({ g, onClose }: { g: ChessGame | null; onClose: () => void }) {
  const [note, setNote] = useState(g?.note ?? '');
  if (!g) return null;
  const save = async (analyzed: boolean) => {
    const wasAnalyzed = !!g.analyzed;
    await store.col('chessGames').put({ ...g, note: note.trim() || undefined, analyzed: g.analyzed || analyzed });
    if (analyzed && !wasAnalyzed) {
      await game.award({ amount: ANALYSIS_XP, stat: 'chess', module: 'chess', label: `Rozbor partie vs ${g.opponent}` });
      await game.progressQuest('chess-analysis');
    }
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${RES_LABEL[g.result]} vs ${g.opponent}`}>
      <p className="small muted">{new Date(g.endTime).toLocaleString('cs-CZ')} · {TC_LABEL[g.timeClass]} {g.timeControl} · {g.color === 'white' ? 'bílými' : 'černými'} · {g.eco} {g.opening}</p>
      <a className="btn btn-sm" href={g.id} target="_blank" rel="noopener noreferrer">Otevřít partii na Chess.com ↗</a>
      <div className="field" style={{ marginTop: 12 }}>
        <label>Co jsem pokazil / co jsem se naučil</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="např. 18. Jxe5? přehlédl jsem vidličku na f7" />
      </div>
      <div className="grid2">
        <button onClick={() => save(false)}>Uložit poznámku</button>
        <button className="primary" onClick={() => save(true)} disabled={g.analyzed}>{g.analyzed ? 'Rozebráno ✓' : `Rozbor hotový (+${ANALYSIS_XP})`}</button>
      </div>
      <p className="small muted">Rozbor dělej bez enginu – sám najdi kritické momenty, teprve potom si to případně ověř.</p>
    </Modal>
  );
}

function ChessGames() {
  const games = useGames();
  const [tc, setTc] = useState<ChessTimeClass | 'all'>('rapid');
  const [open, setOpen] = useState<ChessGame | null>(null);
  if (!games) return null;
  const list = games.filter((g) => tc === 'all' || g.timeClass === tc).slice(0, 60);
  return (
    <div>
      <h1>Partie</h1>
      <Tabs items={TABS} active="/chess/games" />
      <div className="tabs">
        {(['all', ...Object.keys(TC_LABEL)] as (ChessTimeClass | 'all')[]).map((t) => (
          <button key={t} className={t === tc ? 'active' : ''} onClick={() => setTc(t)}>{t === 'all' ? 'Vše' : TC_LABEL[t]}</button>
        ))}
      </div>
      <section className="panel">
        {list.length ? list.map((g) => (
          <button key={g.id} className="list-item btn-ghost" onClick={() => setOpen(g)}
            style={{ width: '100%', border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0, justifyContent: 'flex-start', textAlign: 'left', padding: '10px 0' }}>
            <span className={`chip tag-${g.result}`} style={{ minWidth: 58, justifyContent: 'center' }}>{RES_LABEL[g.result]}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span>{g.color === 'white' ? '♔' : '♚'} {g.opponent} <span className="muted small">({g.opponentRating})</span></span>
              <span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.eco} {g.opening}</span>
            </span>
            <span className="small muted">{g.analyzed ? '🔍' : g.note ? '📝' : ''} {new Date(g.endTime).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}</span>
          </button>
        )) : <Empty>Žádné partie. Synchronizuj v přehledu.</Empty>}
      </section>
      {open && <GameModal key={open.id} g={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ScoreRow({ label, s }: { label: string; s: ReturnType<typeof scoreOf> }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{s.games}</td>
      <td className="num" style={{ color: 'var(--green)' }}>{s.win}</td>
      <td className="num">{s.draw}</td>
      <td className="num" style={{ color: 'var(--red)' }}>{s.loss}</td>
      <td className="num"><b>{Math.round(s.score * 100)} %</b></td>
    </tr>
  );
}

function ChessStats() {
  const games = useGames();
  const [tc, setTc] = useState<ChessTimeClass | 'all'>('rapid');
  const [group, setGroup] = useState<'family' | 'eco'>('family');
  if (!games) return null;
  const list = games.filter((g) => tc === 'all' || g.timeClass === tc);
  const head = <thead><tr><th></th><th className="num">P</th><th className="num">V</th><th className="num">R</th><th className="num">P</th><th className="num">Skóre</th></tr></thead>;
  const groups = new Map<string, ChessGame[]>();
  for (const g of list) {
    const key = `${g.color === 'white' ? '♔' : '♚'} ${group === 'family' ? openingFamily(g.opening) : g.eco || '?'}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const openings = [...groups.entries()].map(([k, gs]) => ({ k, s: scoreOf(gs) })).filter((o) => o.s.games >= 2)
    .sort((a, b) => b.s.loss - a.s.loss || a.s.score - b.s.score).slice(0, 15);
  return (
    <div>
      <h1>Statistiky</h1>
      <Tabs items={TABS} active="/chess/stats" />
      <div className="tabs">
        {(['all', ...Object.keys(TC_LABEL)] as (ChessTimeClass | 'all')[]).map((t) => (
          <button key={t} className={t === tc ? 'active' : ''} onClick={() => setTc(t)}>{t === 'all' ? 'Vše' : TC_LABEL[t]}</button>
        ))}
      </div>
      {!list.length ? <Empty>Žádné partie pro tento filtr.</Empty> : (
        <>
          <section className="panel">
            <h3 style={{ marginTop: 0 }}>Podle barvy</h3>
            <table>{head}<tbody>
              <ScoreRow label="♔ Bílé" s={scoreOf(list.filter((g) => g.color === 'white'))} />
              <ScoreRow label="♚ Černé" s={scoreOf(list.filter((g) => g.color === 'black'))} />
              <ScoreRow label="Celkem" s={scoreOf(list)} />
            </tbody></table>
          </section>
          <section className="panel">
            <div className="row between">
              <h3 style={{ margin: 0 }}>Kde ztrácím nejvíc</h3>
              <select value={group} onChange={(e) => setGroup(e.target.value as 'family' | 'eco')} style={{ width: 'auto' }} aria-label="Seskupit">
                <option value="family">zahájení</option><option value="eco">ECO kód</option>
              </select>
            </div>
            <p className="small muted">Seřazeno podle počtu proher (min. 2 partie).</p>
            <table>{head}<tbody>{openings.map((o) => <ScoreRow key={o.k} label={o.k} s={o.s} />)}</tbody></table>
          </section>
        </>
      )}
    </div>
  );
}

function ChessBooks() {
  const books = useQuery(async () => (await store.col('books').all()).sort((a, b) => Number(b.builtIn) - Number(a.builtIn)));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapters, setChapters] = useState(10);
  if (!books) return null;

  const chapterDone = async (b: Book) => {
    if (b.done >= b.chapters) return;
    const next = { ...b, done: b.done + 1 };
    await store.col('books').put(next);
    await game.award({ amount: CHAPTER_XP, stat: 'chess', module: 'chess', label: `${b.title}: kapitola ${next.done}` });
    if (next.done === b.chapters) await game.award({ amount: BOOK_XP, stat: 'chess', module: 'chess', label: `Dočteno: ${b.title}` });
  };
  const editChapters = async (b: Book) => {
    const v = Number(prompt(`Počet kapitol v knize „${b.title}“:`, String(b.chapters)));
    if (v > 0) await store.col('books').put({ ...b, chapters: Math.round(v), done: Math.min(b.done, Math.round(v)) });
  };
  const add = async () => {
    if (!title.trim()) return;
    await store.col('books').put({ id: `book-${uid()}`, title: title.trim(), author: author.trim(), chapters: Math.max(1, chapters), done: 0, builtIn: false });
    setTitle(''); setAuthor(''); setAdding(false);
  };

  return (
    <div>
      <h1>Knihy</h1>
      <Tabs items={TABS} active="/chess/books" />
      <p className="small muted">Dlouhodobé questy: +{CHAPTER_XP} XP za kapitolu, +{BOOK_XP} XP za dočtení. Počet kapitol si uprav podle svého vydání (klepni na číslo).</p>
      {books.map((b) => (
        <section key={b.id} className={`panel ${b.done >= b.chapters ? 'gold' : ''}`}>
          <div className="row between">
            <div className="grow"><b>{b.title}</b><div className="small muted">{b.author}</div></div>
            <button className="btn-sm" onClick={() => editChapters(b)} aria-label="Upravit počet kapitol">{b.done}/{b.chapters}</button>
          </div>
          <div style={{ margin: '8px 0' }}><MiniBar value={b.done / b.chapters} color="var(--c-chess)" /></div>
          <div className="row">
            {b.done > 0 && <button className="btn-sm btn-ghost" onClick={() => store.col('books').put({ ...b, done: b.done - 1 })}>↩</button>}
            <span className="grow" />
            {b.done < b.chapters ? <button className="btn-sm primary" onClick={() => chapterDone(b)}>✓ Kapitola {b.done + 1} hotová</button> : <span className="pixel small" style={{ color: 'var(--gold)' }}>Dočteno 🏆</span>}
          </div>
        </section>
      ))}
      <button className="btn-block" onClick={() => setAdding(true)}>+ Přidat knihu</button>
      <Modal open={adding} onClose={() => setAdding(false)} title="Nová kniha">
        <div className="field"><label>Název</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Autor</label><input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
        <div className="field"><label>Počet kapitol</label><input type="number" value={chapters} onChange={(e) => setChapters(Number(e.target.value))} /></div>
        <button className="primary btn-block" onClick={add} disabled={!title.trim()}>Přidat</button>
      </Modal>
    </div>
  );
}

export default function ChessPages({ route }: { route: string }) {
  if (route === '/chess/games') return <ChessGames />;
  if (route === '/chess/stats') return <ChessStats />;
  if (route === '/chess/books') return <ChessBooks />;
  return <ChessHome />;
}
