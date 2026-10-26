import { useEffect, useState } from 'react';
import { store, useProfile, useQuery } from '../../app/context';
import { Empty, Modal } from '../../components/ui';
import { saveDiscovery } from './save';
import {
  embedUrl, loadChannel, loadWatched, markWatched, pickVideoOfDay, serverBase, thumb, youtubeHandle,
  type ChannelVideos, type Video,
} from './videos';

export interface VideoItem { video: Video; channel: ChannelVideos }

/** Načte videa ze všech YouTube kanálů v knihovně zdrojů. */
export function useVideos(): { items: VideoItem[]; loading: boolean; hasServer: boolean; channels: ChannelVideos[]; reload: () => void } {
  const p = useProfile();
  const base = serverBase(p);
  const resources = useQuery(async () => (await store.col('resources').all()).filter((r) => youtubeHandle(r.url)));
  const [channels, setChannels] = useState<ChannelVideos[]>([]);
  const [loading, setLoading] = useState(true);
  const [force, setForce] = useState(0);

  useEffect(() => {
    if (!resources) return;
    let alive = true;
    setLoading(true);
    Promise.all(resources.map((r) => loadChannel(base, r, force > 0))).then((list) => {
      if (!alive) return;
      setChannels(list.filter((c): c is ChannelVideos => !!c));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [resources, base, force]);

  const items = channels.flatMap((c) => c.videos.map((video) => ({ video, channel: c })))
    .sort((a, b) => b.video.published.localeCompare(a.video.published));
  return { items, loading, hasServer: !!base, channels, reload: () => setForce((n) => n + 1) };
}

export function useWatched() {
  return useQuery(loadWatched) ?? new Set<string>();
}

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'dnes';
  if (days === 1) return 'včera';
  if (days < 30) return `před ${days} dny`;
  const m = Math.floor(days / 30);
  return m < 12 ? `před ${m} měs.` : `před ${Math.floor(m / 12)} r.`;
};

export function VideoCard({ item, watched, onPlay, big = false }: { item: VideoItem; watched: boolean; onPlay: () => void; big?: boolean }) {
  return (
    <button className={`video-card ${big ? 'big' : ''} ${watched ? 'watched' : ''}`} onClick={onPlay} aria-label={`Přehrát: ${item.video.title}`}>
      <span className="vthumb">
        <img src={thumb(item.video.id)} alt="" loading="lazy" />
        <span className="vplay" aria-hidden>▶</span>
        {watched && <span className="vseen">✓ zhlédnuto</span>}
      </span>
      <span className="vinfo">
        <span className="vtitle">{item.video.title}</span>
        <span className="small muted">{item.channel.channelTitle} · {ago(item.video.published)}</span>
      </span>
    </button>
  );
}

/** Přehrávač přímo v aplikaci + rychlý zápis objevu po zhlédnutí. */
export function PlayerModal({ item, onClose }: { item: VideoItem | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setText(''); setSaved(false); }, [item?.video.id]);
  if (!item) return null;

  const save = async () => {
    if (!text.trim()) return;
    await saveDiscovery({
      text, tags: [item.channel.category], sourceId: item.channel.resourceId, videoId: item.video.id, videoTitle: item.video.title,
    });
    await markWatched(item.video.id);
    setSaved(true);
  };

  return (
    <Modal open onClose={onClose} title="📺 Video">
      <div className="player">
        <iframe
          src={embedUrl(item.video.id)}
          title={item.video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p style={{ fontWeight: 600, margin: '10px 0 2px' }}>{item.video.title}</p>
      <p className="small muted">{item.channel.channelTitle}</p>
      {saved ? (
        <div className="center" style={{ padding: '10px 0' }}>
          <p className="feedback-ok">✔ Objev zapsán!</p>
          <button className="btn-block" onClick={onClose}>Zavřít</button>
        </div>
      ) : (
        <>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Co ses z videa dozvěděl? (jednou větou)</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="např. Neutronová hvězda má hustotu…" />
          </div>
          <div className="grid2">
            <button onClick={async () => { await markWatched(item.video.id); onClose(); }}>Jen zhlédnuto</button>
            <button className="primary" onClick={save} disabled={!text.trim()}>Zapsat objev ✍️</button>
          </div>
          <a className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} href={`https://www.youtube.com/watch?v=${item.video.id}`} target="_blank" rel="noopener noreferrer">Otevřít v aplikaci YouTube ↗</a>
        </>
      )}
    </Modal>
  );
}

export function NoServerHint() {
  return (
    <Empty>
      Pro seznam videí je potřeba tvůj Vercel server (stejný jako u Financí). Nastav ho v <a href="#/settings">Nastavení</a> nebo propoj Trading 212 s proxy.
    </Empty>
  );
}

/** Karta „Video dne“ na úvodní stránce Objevů. */
export function VideoOfDay() {
  const { items, loading, hasServer } = useVideos();
  const watched = useWatched();
  const [skip, setSkip] = useState(0);
  const [playing, setPlaying] = useState<VideoItem | null>(null);
  const pick = pickVideoOfDay(items, watched, undefined, skip);

  return (
    <section className="panel gold">
      <div className="row between">
        <h2 style={{ margin: 0 }}>📺 Video dne</h2>
        {pick && <button className="btn-sm btn-ghost" onClick={() => setSkip(skip + 1)}>Jiné ↻</button>}
      </div>
      <div style={{ marginTop: 10 }}>
        {pick ? <VideoCard item={pick} watched={watched.has(pick.video.id)} onPlay={() => setPlaying(pick)} big />
          : loading ? <div className="empty">Načítám videa…</div>
            : !hasServer ? <NoServerHint />
              : <Empty>Videa se nepodařilo načíst. Zkus to později.</Empty>}
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>Podívej se, napiš jednou větou, co ses dozvěděl, a splníš Objev dne.</p>
      <PlayerModal item={playing} onClose={() => setPlaying(null)} />
    </section>
  );
}

/** Záložka Videa: nejnovější videa ze všech kanálů s filtrem podle kategorie a kanálu. */
export function VideosPage() {
  const { items, loading, hasServer, channels, reload } = useVideos();
  const watched = useWatched();
  const [filter, setFilter] = useState('all');
  const [hideSeen, setHideSeen] = useState(false);
  const [playing, setPlaying] = useState<VideoItem | null>(null);
  const cats = [...new Set(channels.map((c) => c.category))];
  const list = items.filter((i) =>
    (filter === 'all' || i.channel.category === filter || i.channel.handle === filter) && (!hideSeen || !watched.has(i.video.id)));

  return (
    <div>
      <div className="tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Vše</button>
        {cats.map((c) => <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>{c}</button>)}
        {channels.map((c) => <button key={c.handle} className={filter === c.handle ? 'active' : ''} onClick={() => setFilter(c.handle)}>{c.channelTitle}</button>)}
      </div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={hideSeen} onChange={(e) => setHideSeen(e.target.checked)} /> Skrýt zhlédnuté
        </label>
        <button className="btn-sm btn-ghost" onClick={reload} disabled={loading}>{loading ? 'Načítám…' : '⟳ Obnovit'}</button>
      </div>
      {!hasServer && !items.length ? <NoServerHint />
        : list.length ? <div className="video-grid">{list.map((i) => <VideoCard key={i.video.id} item={i} watched={watched.has(i.video.id)} onPlay={() => setPlaying(i)} />)}</div>
          : <Empty>{loading ? 'Načítám videa…' : 'Žádná videa. Přidej YouTube kanál v Knihovně (odkaz ve tvaru youtube.com/@kanal).'}</Empty>}
      <PlayerModal item={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
