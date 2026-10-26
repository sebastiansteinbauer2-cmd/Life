import { useState } from 'react';
import { game, store, useProfile, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { BarChart } from '../../components/Charts';
import { QuestList } from '../../components/Quests';
import { Empty, MiniBar, Modal, Tabs } from '../../components/ui';
import type { ReadBook } from '../../data/types';
import { dateKey, formatDate, uid } from '../../lib/date';
import { bookDoneXp, logId, movePage, pagesByDay, pagesOn, pagesXp, quoteOfDay, yearGoal } from './logic';

const TABS = [
  { path: '/reading', label: 'Přehled' },
  { path: '/reading/books', label: 'Knihovna' },
  { path: '/reading/quotes', label: 'Citáty' },
];
const STATUS_LABEL: Record<ReadBook['status'], string> = { reading: '📖 Čtu', want: '🔖 Chci číst', done: '✅ Přečteno' };

function useBooks() {
  return useQuery(async () => (await store.col('readBooks').all()).sort((a, b) => b.createdAt - a.createdAt));
}

/** Zapíše posun v knize: stránky do deníku, XP, quest a případné dočtení. */
async function setPage(book: ReadBook, page: number) {
  const today = dateKey();
  const u = movePage(book, page, today);
  await store.col('readBooks').put(u.book);
  if (u.delta > 0) {
    const id = logId(today, book.id);
    const prev = await store.col('readLog').get(id);
    await store.col('readLog').put({ id, date: today, bookId: book.id, pages: (prev?.pages ?? 0) + u.delta });
    await game.award({ amount: pagesXp(u.delta), stat: 'int', module: 'reading', label: `${book.title}: ${u.delta} stran` });
    const log = await store.col('readLog').all();
    await game.progressQuest('read-daily', { setTo: pagesOn(log, today) });
  }
  if (u.finished) await game.award({ amount: bookDoneXp(book.pages), stat: 'int', module: 'reading', label: `Dočteno: ${book.title}` });
  return u;
}

function Stars({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <span aria-label={`Hodnocení ${value ?? 0} z 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} role={onChange ? 'button' : undefined} onClick={() => onChange?.(i)}
          style={{ cursor: onChange ? 'pointer' : undefined, fontSize: onChange ? '1.4rem' : undefined, opacity: (value ?? 0) >= i ? 1 : 0.25 }}>⭐</span>
      ))}
    </span>
  );
}

function ReadingCard({ book }: { book: ReadBook }) {
  const [page, setPageText] = useState('');
  const [msg, setMsg] = useState('');
  const save = async (p: number) => {
    const u = await setPage(book, p);
    setPageText('');
    setMsg(u.finished ? '🎉 Kniha dočtena!' : u.delta ? `+${u.delta} stran` : 'Uloženo');
  };
  const pct = book.pages ? book.page / book.pages : 0;
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <b>{book.title}</b>
          <div className="small muted">{book.author}</div>
        </div>
        <span className="pixel" style={{ color: 'var(--m-reading)' }}>{Math.round(pct * 100)} %</span>
      </div>
      <div style={{ margin: '8px 0' }}><MiniBar value={pct} color="var(--m-reading)" /></div>
      <div className="small muted">Strana {book.page} / {book.pages || '?'}</div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <input inputMode="numeric" placeholder="Jsem na straně…" value={page} onChange={(e) => setPageText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && Number(page) && save(Number(page))} style={{ flex: 1, minWidth: 0 }} />
        <button className="primary" disabled={!Number(page)} onClick={() => save(Number(page))}>Uložit</button>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        {[5, 10, 20].map((n) => <button key={n} className="btn-sm" onClick={() => save(book.page + n)}>+{n}</button>)}
      </div>
      {msg && <p className="small" style={{ color: 'var(--green)', marginBottom: 0 }}>{msg}</p>}
    </section>
  );
}

const knih = (n: number) => (n === 1 ? 'kniha' : n >= 2 && n <= 4 ? 'knihy' : 'knih');

function goalText(g: ReturnType<typeof yearGoal>): string {
  const left = g.goal - g.done;
  if (left <= 0) return '🏆 Roční cíl splněn!';
  if (g.ahead >= 0) return `✅ Jsi v plánu${g.ahead >= 1 ? ` (o ${Math.floor(g.ahead)} napřed)` : ''}`;
  const today = new Date();
  const days = Math.max(1, Math.ceil((new Date(today.getFullYear() + 1, 0, 1).getTime() - today.getTime()) / 86_400_000));
  return `📅 Do konce roku ${left >= 2 && left <= 4 ? 'zbývají' : 'zbývá'} ${left} ${knih(left)} – jedna zhruba každých ${Math.max(1, Math.round(days / left))} dní.`;
}

function ReadingHome() {
  const p = useProfile();
  const books = useBooks();
  const log = useQuery(() => store.col('readLog').all());
  const quests = useQuests('reading');
  const [editGoal, setEditGoal] = useState(false);
  if (!books || !log) return null;
  const reading = books.filter((b) => b.status === 'reading');
  const g = yearGoal(books, p.readingGoal);
  const days = pagesByDay(log, 14);
  const quote = quoteOfDay(books);
  return (
    <div>
      <h1>📚 Čtení</h1>
      <Tabs items={TABS} active="/reading" />
      <section className="panel gold">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>Cíl {new Date().getFullYear()}</b>
          <button className="btn-sm" onClick={() => setEditGoal(!editGoal)}>✏️</button>
        </div>
        {editGoal ? (
          <div className="row wrap" style={{ gap: 6, margin: '8px 0' }}>
            {[6, 12, 24, 36, 52].map((n) => (
              <button key={n} className={`chip ${p.readingGoal === n ? 'on' : ''}`} onClick={() => { game.saveProfile({ readingGoal: n }); setEditGoal(false); }}>{n} knih</button>
            ))}
          </div>
        ) : (
          <>
            <div className="pixel" style={{ fontSize: '1.4rem', color: 'var(--m-reading)', margin: '6px 0' }}>{g.done} / {g.goal} knih</div>
            <MiniBar value={Math.min(1, g.done / Math.max(1, g.goal))} color="var(--m-reading)" />
            <p className="small" style={{ marginBottom: 0 }}>
              {goalText(g)}
            </p>
          </>
        )}
      </section>
      <QuestList quests={quests ?? []} />
      <h2>Právě čtu</h2>
      {!reading.length && <Empty>Nic nečteš. <a href="#/reading/books">Přidej knihu</a> a začni.</Empty>}
      {reading.map((b) => <ReadingCard key={b.id} book={b} />)}
      {quote && (
        <section className="panel">
          <div className="small muted">💬 Citát dne</div>
          <p style={{ fontStyle: 'italic', margin: '6px 0' }}>„{quote.text}“</p>
          <div className="small muted">— {quote.book.title}{quote.page ? `, str. ${quote.page}` : ''}</div>
        </section>
      )}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Stránky za 14 dní</h2>
        <BarChart labels={days.map((d) => d.date.slice(8).replace(/^0/, ''))} values={days.map((d) => d.pages)} colors={days.map(() => '#fb923c')} height={180} />
        <p className="small muted" style={{ marginBottom: 0 }}>Celkem {days.reduce((n, d) => n + d.pages, 0)} stran · 1 XP za 5 stran, za dočtenou knihu 100+ XP</p>
      </section>
    </div>
  );
}

function BookForm({ initial, onDone }: { initial?: ReadBook; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [pages, setPages] = useState(initial?.pages ? String(initial.pages) : '');
  const [status, setStatus] = useState<ReadBook['status']>(initial?.status ?? 'reading');
  const save = async () => {
    const n = Math.max(0, Math.round(Number(pages) || 0));
    const base: ReadBook = initial ?? { id: uid(), title: '', author: '', pages: 0, page: 0, status, quotes: [], createdAt: Date.now() };
    const next = { ...base, title: title.trim(), author: author.trim(), pages: n, page: Math.min(base.page, n || base.page), status };
    if (status === 'reading' && !next.startedAt) next.startedAt = dateKey();
    if (status === 'done' && base.status !== 'done') {
      next.finishedAt = dateKey();
      next.page = n;
    }
    await store.col('readBooks').put(next);
    if (status === 'done' && base.status !== 'done' && initial) {
      await game.award({ amount: bookDoneXp(n), stat: 'int', module: 'reading', label: `Dočteno: ${next.title}` });
    } else {
      await game.checkAchievements();
    }
    onDone();
  };
  return (
    <div className="stack">
      <div className="field"><label>Název</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
      <div className="grid2">
        <div className="field"><label>Autor</label><input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
        <div className="field"><label>Počet stran</label><input inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} /></div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {(Object.keys(STATUS_LABEL) as ReadBook['status'][]).map((s) => (
          <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      <button className="primary btn-block" disabled={!title.trim()} onClick={save}>Uložit</button>
    </div>
  );
}

function BookModal({ book, onClose }: { book: ReadBook | null; onClose: () => void }) {
  const [edit, setEdit] = useState(false);
  const [quote, setQuote] = useState('');
  const [qPage, setQPage] = useState('');
  if (!book) return null;
  const addQuote = async () => {
    if (!quote.trim()) return;
    await store.col('readBooks').put({ ...book, quotes: [...book.quotes, { text: quote.trim(), page: Number(qPage) || undefined }] });
    setQuote('');
    setQPage('');
  };
  return (
    <Modal open onClose={onClose} title={book.title}>
      {edit ? <BookForm initial={book} onDone={() => setEdit(false)} /> : (
        <div className="stack">
          <div className="small muted">{book.author} · {book.pages} stran · {STATUS_LABEL[book.status]}</div>
          {book.startedAt && <div className="small">Začátek: {formatDate(book.startedAt)}{book.finishedAt && <> · dočteno {formatDate(book.finishedAt)}</>}</div>}
          {book.status === 'done' && (
            <div>Hodnocení: <Stars value={book.rating} onChange={(rating) => store.col('readBooks').put({ ...book, rating })} /></div>
          )}
          <h3 style={{ marginBottom: 0 }}>Citáty</h3>
          {!book.quotes.length && <p className="small muted">Zatím žádné.</p>}
          {book.quotes.map((q, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="small" style={{ fontStyle: 'italic' }}>„{q.text}“{q.page && <span className="muted"> (str. {q.page})</span>}</span>
              <button className="btn-sm" onClick={() => store.col('readBooks').put({ ...book, quotes: book.quotes.filter((_, j) => j !== i) })} aria-label="Smazat citát">✕</button>
            </div>
          ))}
          <textarea rows={2} placeholder="Nový citát…" value={quote} onChange={(e) => setQuote(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <input inputMode="numeric" placeholder="Strana" value={qPage} onChange={(e) => setQPage(e.target.value)} style={{ width: 90 }} />
            <button className="grow" disabled={!quote.trim()} onClick={addQuote}>+ Přidat citát</button>
          </div>
          <div className="grid2">
            <button onClick={() => setEdit(true)}>✏️ Upravit</button>
            <button className="btn-danger" onClick={async () => { if (confirm('Smazat knihu?')) { await store.col('readBooks').delete(book.id); onClose(); } }}>Smazat</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReadingBooks() {
  const books = useBooks();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (!books) return null;
  return (
    <div>
      <h1>📚 Čtení</h1>
      <Tabs items={TABS} active="/reading/books" />
      <button className="primary btn-block" onClick={() => setAdding(true)} style={{ marginBottom: 12 }}>+ Přidat knihu</button>
      {!books.length && <Empty>Knihovna je prázdná.</Empty>}
      {(['reading', 'want', 'done'] as const).map((s) => {
        const list = books.filter((b) => b.status === s);
        if (!list.length) return null;
        return (
          <section key={s} className="panel">
            <h2 style={{ marginTop: 0 }}>{STATUS_LABEL[s]} ({list.length})</h2>
            {list.map((b) => (
              <button key={b.id} className="btn-block" style={{ textAlign: 'left', marginBottom: 6, display: 'block' }} onClick={() => setOpen(b.id)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span><b>{b.title}</b> <span className="small muted">{b.author}</span></span>
                  <span className="small">{s === 'done' ? <Stars value={b.rating} /> : s === 'reading' ? `${b.page}/${b.pages}` : ''}</span>
                </div>
              </button>
            ))}
          </section>
        );
      })}
      <Modal open={adding} onClose={() => setAdding(false)} title="Nová kniha">
        <BookForm onDone={() => setAdding(false)} />
      </Modal>
      <BookModal key={open ?? ''} book={books.find((b) => b.id === open) ?? null} onClose={() => setOpen(null)} />
    </div>
  );
}

function ReadingQuotes() {
  const books = useBooks();
  const [q, setQ] = useState('');
  if (!books) return null;
  const all = books.flatMap((b) => b.quotes.map((x) => ({ ...x, book: b })))
    .filter((x) => !q || `${x.text} ${x.book.title} ${x.book.author}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1>📚 Čtení</h1>
      <Tabs items={TABS} active="/reading/quotes" />
      <input placeholder="🔍 Hledat v citátech…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      {!all.length && <Empty>Citáty si ukládáš u knihy v Knihovně.</Empty>}
      {all.map((x, i) => (
        <section key={i} className="panel">
          <p style={{ fontStyle: 'italic', margin: 0 }}>„{x.text}“</p>
          <div className="small muted" style={{ marginTop: 6 }}>— {x.book.title}{x.book.author && `, ${x.book.author}`}{x.page ? ` (str. ${x.page})` : ''}</div>
        </section>
      ))}
    </div>
  );
}

export default function ReadingPages({ route }: { route: string }) {
  if (route === '/reading/books') return <ReadingBooks />;
  if (route === '/reading/quotes') return <ReadingQuotes />;
  return <ReadingHome />;
}
