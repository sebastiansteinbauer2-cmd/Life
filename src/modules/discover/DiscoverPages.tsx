import { useMemo, useState } from 'react';
import { game, store, useQuery } from '../../app/context';
import { useQuests } from '../../app/hooks';
import { WIKI_RANDOM } from '../../app/seed';
import { QuestList } from '../../components/Quests';
import { Empty, Modal, Tabs } from '../../components/ui';
import type { Discovery, Resource } from '../../data/types';
import { dateKey, daysBetween, formatDate, uid } from '../../lib/date';
import { pickQuizEntries } from './quiz';
import { EXTRA_XP, saveDiscovery } from './save';
import { VideoOfDay, VideosPage } from './Videos';

const TABS = [
  { path: '/discover', label: 'Objev dne' },
  { path: '/discover/videos', label: '📺 Videa' },
  { path: '/discover/journal', label: 'Deník' },
  { path: '/discover/library', label: 'Knihovna' },
  { path: '/discover/quiz', label: 'Kvíz' },
];
const PRESET_TAGS = ['historie', 'věda', 'matematika', 'technologie', 'příroda', 'vesmír', 'společnost', 'přemýšlení', 'umění', 'zdraví'];

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

function DiscoverToday() {
  const quests = useQuests('discover');
  const data = useQuery(async () => {
    const [entries, resources] = await Promise.all([store.col('discoveries').all(), store.col('resources').all()]);
    return { entries: entries.sort((a, b) => b.ts - a.ts), resources };
  });
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [customTag, setCustomTag] = useState('');
  if (!data) return null;
  const today = dateKey();
  const todays = data.entries.filter((e) => e.date === today);
  const allTags = [...new Set([...PRESET_TAGS, ...data.entries.flatMap((e) => e.tags)])];
  const tip = data.resources[(new Date().getDate() + data.resources.length) % data.resources.length];

  const save = async () => {
    if (!text.trim()) return;
    const extraTag = customTag.trim().toLowerCase();
    await saveDiscovery({ text, tags: [...new Set([...tags, ...(extraTag ? [extraTag] : [])])], sourceId: source || undefined });
    setText(''); setTags([]); setSource(''); setCustomTag('');
  };

  return (
    <div>
      <h1>🔭 Objevy</h1>
      <Tabs items={TABS} active="/discover" />
      <QuestList quests={quests ?? []} />
      <VideoOfDay />
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Nebo zapiš jiný objev</h2>
        <div className="field">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400}
            placeholder="Jednou větou, např.: Chobotnice mají tři srdce a modrou krev." aria-label="Objev" />
        </div>
        <div className="field">
          <label>Štítky</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {allTags.map((t) => (
              <button key={t} className={`chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
            ))}
          </div>
          <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="vlastní štítek" style={{ marginTop: 8 }} />
        </div>
        <div className="field">
          <label>Zdroj (nepovinné)</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {data.resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            <option value="wiki">Wikipedie</option>
          </select>
        </div>
        <button className="primary btn-block" onClick={save} disabled={!text.trim()}>Zapsat objev ✍️</button>
        {todays.length > 0 && <p className="small muted center">Dnes zapsáno: {todays.length}. Každý další objev +{EXTRA_XP} XP.</p>}
      </section>
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Nevíš, co objevit?</h3>
        <div className="grid2">
          <a className="btn" href={WIKI_RANDOM} {...ext}>🎲 Náhodný článek</a>
          {tip && <a className="btn" href={tip.url} {...ext}>{tip.title} ↗</a>}
        </div>
      </section>
      {data.entries.length > 0 && (
        <>
          <h2>Poslední objevy</h2>
          <section className="panel">{data.entries.slice(0, 3).map((e) => <EntryRow key={e.id} e={e} resources={data.resources} />)}</section>
        </>
      )}
    </div>
  );
}

function EntryRow({ e, resources, onTag }: { e: Discovery; resources: Resource[]; onTag?: (t: string) => void }) {
  const src = e.sourceId === 'wiki' ? 'Wikipedie' : resources.find((r) => r.id === e.sourceId)?.title;
  return (
    <div className="list-item">
      <div>{e.text}</div>
      {e.videoId && (
        <a className="small" href={`https://www.youtube.com/watch?v=${e.videoId}`} target="_blank" rel="noopener noreferrer">📺 {e.videoTitle ?? 'Video'}</a>
      )}
      <div className="row wrap small muted" style={{ gap: 6, marginTop: 4 }}>
        <span>{formatDate(e.date)}</span>
        {src && <span>· {src}</span>}
        {e.tags.map((t) => (
          <button key={t} className="chip" onClick={() => onTag?.(t)} disabled={!onTag} style={{ minHeight: 0 }}>#{t}</button>
        ))}
      </div>
    </div>
  );
}

function Journal() {
  const data = useQuery(async () => {
    const [entries, resources] = await Promise.all([store.col('discoveries').all(), store.col('resources').all()]);
    return { entries: entries.sort((a, b) => b.ts - a.ts), resources };
  });
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  if (!data) return null;
  const tags = [...new Set(data.entries.flatMap((e) => e.tags))].sort();
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const list = data.entries.filter((e) => (!tag || e.tags.includes(tag)) && (!q || norm(e.text + ' ' + e.tags.join(' ')).includes(norm(q))));
  return (
    <div>
      <h1>Deník znalostí</h1>
      <Tabs items={TABS} active="/discover/journal" />
      <div className="field"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Hledat v objevech…" aria-label="Hledat" /></div>
      {tags.length > 0 && (
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          <button className={`chip ${!tag ? 'on' : ''}`} onClick={() => setTag('')}>vše ({data.entries.length})</button>
          {tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>)}
        </div>
      )}
      <section className="panel">
        {list.length ? list.map((e) => <EntryRow key={e.id} e={e} resources={data.resources} onTag={setTag} />) : <Empty>{data.entries.length ? 'Nic nenalezeno.' : 'Deník je zatím prázdný. Zapiš svůj první objev!'}</Empty>}
      </section>
    </div>
  );
}

function Library() {
  const resources = useQuery(async () => store.col('resources').all());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', category: 'věda', description: '' });
  if (!resources) return null;
  const hiddenCount = resources.filter((r) => r.hidden).length;
  const visible = resources.filter((r) => !r.hidden);
  const cats = [...new Set(visible.map((r) => r.category))];
  const remove = async (r: Resource) => {
    if (!confirm(`${r.builtIn ? 'Skrýt' : 'Smazat'} „${r.title}“?`)) return;
    // vestavěné zdroje se jen skryjí, aby je aplikace znovu nepřidala
    if (r.builtIn) await store.col('resources').put({ ...r, hidden: true });
    else await store.col('resources').delete(r.id);
  };
  const add = async () => {
    if (!form.title.trim() || !/^https?:\/\//.test(form.url.trim())) return;
    await store.col('resources').put({ id: `res-${uid()}`, ...form, title: form.title.trim(), url: form.url.trim(), category: form.category.trim().toLowerCase() || 'ostatní', builtIn: false });
    setForm({ title: '', url: '', category: 'věda', description: '' });
    setAdding(false);
  };
  return (
    <div>
      <h1>Knihovna zdrojů</h1>
      <Tabs items={TABS} active="/discover/library" />
      <a className="btn btn-gold btn-block" href={WIKI_RANDOM} {...ext} style={{ marginBottom: 12 }}>🎲 Wikipedie – náhodný článek</a>
      {cats.map((c) => (
        <section key={c} className="panel">
          <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{c}</h3>
          {visible.filter((r) => r.category === c).map((r) => (
            <div key={r.id} className="row list-item">
              <a href={r.url} {...ext} className="grow" style={{ textDecoration: 'none' }}>
                <b>{r.title} ↗</b>
                {r.description && <div className="small muted">{r.description}</div>}
              </a>
              <button className="iconbtn btn-sm btn-ghost" aria-label={r.builtIn ? 'Skrýt zdroj' : 'Smazat zdroj'} onClick={() => remove(r)}>{r.builtIn ? '🙈' : '🗑'}</button>
            </div>
          ))}
        </section>
      ))}
      <button className="btn-block" onClick={() => setAdding(true)}>+ Přidat vlastní zdroj</button>
      {hiddenCount > 0 && (
        <button className="btn-block btn-ghost" style={{ marginTop: 8 }}
          onClick={() => store.col('resources').bulkPut(resources.filter((r) => r.hidden).map((r) => ({ ...r, hidden: false })))}>
          Zobrazit skryté zdroje ({hiddenCount})
        </button>
      )}
      <p className="small muted">Tip: YouTube kanál přidáš odkazem ve tvaru <code>https://www.youtube.com/@kanal</code> – jeho videa se objeví v záložce Videa.</p>
      <Modal open={adding} onClose={() => setAdding(false)} title="Nový zdroj">
        <div className="field"><label>Název</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Odkaz (https://…)</label><input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
        <div className="field"><label>Kategorie</label><input value={form.category} list="res-cats" onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <datalist id="res-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div className="field"><label>Popis</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <button className="primary btn-block" onClick={add} disabled={!form.title.trim() || !/^https?:\/\//.test(form.url.trim())}>Přidat</button>
      </Modal>
    </div>
  );
}

function Quiz() {
  const entries = useQuery(async () => store.col('discoveries').all());
  const [seed] = useState(() => Math.random());
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const picked = useMemo(() => (entries ? pickQuizEntries(entries, dateKey(), seed) : []), [entries === undefined, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entries) return null;
  if (!picked.length) {
    return (
      <div>
        <h1>Opakovací kvíz</h1>
        <Tabs items={TABS} active="/discover/quiz" />
        <Empty>Kvíz potřebuje aspoň jeden objev starší než 2 dny. Zapisuj objevy a za pár dní se vrať!</Empty>
      </div>
    );
  }

  const answer = async (remembered: boolean) => {
    const e = picked[idx];
    await store.col('discoveries').put({ ...e, lastReviewed: dateKey() });
    const s = score + (remembered ? 1 : 0);
    setScore(s);
    if (idx + 1 < picked.length) {
      setIdx(idx + 1);
      setRevealed(false);
    } else {
      setFinished(true);
      const meta = await store.col('meta').get('quizCount');
      await store.col('meta').put({ id: 'quizCount', value: Number(meta?.value ?? 0) + 1 });
      await game.progressQuest('discover-quiz');
    }
  };

  const e = picked[idx];
  const firstWords = e.text.split(/\s+/).slice(0, 3).join(' ');
  return (
    <div>
      <h1>Opakovací kvíz</h1>
      <Tabs items={TABS} active="/discover/quiz" />
      {finished ? (
        <section className="panel gold center">
          <div className="pixel" style={{ fontSize: '1.8rem', color: 'var(--gold)' }}>{score}/{picked.length}</div>
          <p>{score === picked.length ? 'Pamatuješ si všechno! 🐘' : 'Opakování je matka moudrosti. Za týden znovu!'}</p>
          <a className="btn btn-block" href="#/discover">Zpět</a>
        </section>
      ) : (
        <section className="panel">
          <div className="small muted">{idx + 1}/{picked.length} · {formatDate(e.date)} · před {daysBetween(e.date, dateKey())} dny {e.tags.map((t) => `#${t}`).join(' ')}</div>
          <h2>Pamatuješ si, co ses dozvěděl o… „{firstWords}…“?</h2>
          <p className="small muted">Zkus si to nejdřív vybavit, pak odkryj.</p>
          {revealed ? (
            <>
              <div className="panel" style={{ background: 'var(--bg)' }}>{e.text}</div>
              <div className="grid2">
                <button onClick={() => answer(false)}>😅 Zapomněl jsem</button>
                <button className="primary" onClick={() => answer(true)}>✔ Pamatoval jsem</button>
              </div>
            </>
          ) : (
            <button className="primary btn-block" onClick={() => setRevealed(true)}>Odkrýt</button>
          )}
        </section>
      )}
    </div>
  );
}

function Videos() {
  return (
    <div>
      <h1>📺 Videa</h1>
      <Tabs items={TABS} active="/discover/videos" />
      <VideosPage />
    </div>
  );
}

export default function DiscoverPages({ route }: { route: string }) {
  if (route === '/discover/videos') return <Videos />;
  if (route === '/discover/journal') return <Journal />;
  if (route === '/discover/library') return <Library />;
  if (route === '/discover/quiz') return <Quiz />;
  return <DiscoverToday />;
}
