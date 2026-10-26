import { store } from '../../app/context';
import type { Profile, Resource } from '../../data/types';
import { dateKey } from '../../lib/date';

export interface Video { id: string; title: string; published: string; views: number }
export interface ChannelVideos { handle: string; resourceId: string; category: string; channelTitle: string; videos: Video[]; ts: number }

const MAX_AGE_MS = 3 * 3600_000;

/** Handle YouTube kanálu z odkazu typu https://www.youtube.com/@kurzgesagt */
export function youtubeHandle(url: string): string | null {
  const m = /youtube\.com\/@([A-Za-z0-9._-]{2,40})/.exec(url);
  return m ? m[1] : null;
}

/** Adresa vlastního Vercel serveru: z nastavení, z proxy Trading 212, nebo když appka běží přímo na Vercelu. */
export function serverBase(p: Pick<Profile, 'serverUrl' | 'financeProxyUrl'>): string | null {
  const tryOrigin = (u: string) => {
    try {
      return u ? new URL(u).origin : null;
    } catch {
      return null;
    }
  };
  return tryOrigin(p.serverUrl) ?? tryOrigin(p.financeProxyUrl)
    ?? (typeof location !== 'undefined' && location.hostname.endsWith('.vercel.app') ? location.origin : null);
}

/** Videa kanálu – z mezipaměti, nebo čerstvě přes server (api/yt). */
export async function loadChannel(base: string | null, r: Resource, force = false): Promise<ChannelVideos | null> {
  const handle = youtubeHandle(r.url);
  if (!handle) return null;
  const cacheId = `yt:${handle.toLowerCase()}`;
  const cached = (await store.col('meta').get(cacheId))?.value as ChannelVideos | undefined;
  if (cached && !force && Date.now() - cached.ts < MAX_AGE_MS) return cached;
  if (!base) return cached ?? null;
  try {
    const res = await fetch(`${base}/api/yt?handle=${encodeURIComponent(handle)}`);
    if (!res.ok) return cached ?? null;
    const json = (await res.json()) as { channelTitle: string; videos: Video[] };
    const value: ChannelVideos = {
      handle, resourceId: r.id, category: r.category, channelTitle: json.channelTitle || r.title, videos: json.videos.slice(0, 15), ts: Date.now(),
    };
    await store.col('meta').put({ id: cacheId, value });
    return value;
  } catch {
    return cached ?? null; // offline → poslední známý seznam
  }
}

export async function loadWatched(): Promise<Set<string>> {
  return new Set(((await store.col('meta').get('ytWatched'))?.value as string[] | undefined) ?? []);
}

export async function markWatched(videoId: string) {
  const w = await loadWatched();
  w.add(videoId);
  await store.col('meta').put({ id: 'ytWatched', value: [...w].slice(-2000) });
}

/** Video dne: stabilní pro daný den, přednostně nezhlédnuté a novější. */
export function pickVideoOfDay<T extends { video: Video }>(all: T[], watched: Set<string>, day: string = dateKey(), skip = 0): T | null {
  const pool = all.filter((x) => !watched.has(x.video.id));
  const list = (pool.length ? pool : all).slice().sort((a, b) => a.video.id.localeCompare(b.video.id));
  if (!list.length) return null;
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(h + skip) % list.length];
}

export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
