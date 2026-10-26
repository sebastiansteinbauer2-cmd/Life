import { store } from '../../app/context';
import type { Profile, Resource } from '../../data/types';
import { dateKey } from '../../lib/date';

export interface Video { id: string; title: string; published: string; views: number }
export interface ChannelVideos {
  handle: string; resourceId: string; category: string; channelTitle: string; videos: Video[]; ts: number;
  /** Poslední pokus o obnovu ze serveru selhal – zobrazují se uložená videa. */
  stale?: boolean;
}

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
  if (!base) return cached ? { ...cached, stale: true } : null;
  try {
    const res = await fetch(`${base}/api/yt?handle=${encodeURIComponent(handle)}`);
    if (!res.ok) return cached ? { ...cached, stale: true } : null;
    const json = (await res.json()) as { channelTitle: string; videos: Video[] };
    const value: ChannelVideos = {
      handle, resourceId: r.id, category: r.category, channelTitle: json.channelTitle || r.title, videos: json.videos.slice(0, 30), ts: Date.now(),
    };
    await store.col('meta').put({ id: cacheId, value });
    return value;
  } catch {
    return cached ? { ...cached, stale: true } : null; // offline → poslední známý seznam
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

/**
 * Video dne: z nezhlédnutých videí (zhlédnutí se počítá už spuštěním), pořadí zamíchané podle dne.
 * Po zhlédnutí se automaticky nabídne další.
 */
export function pickVideoOfDay<T extends { video: Video }>(all: T[], watched: Set<string>, day: string = dateKey(), skip = 0): T | null {
  const pool = all.filter((x) => !watched.has(x.video.id));
  const list = dailyShuffle(pool.length ? pool : all, day);
  if (!list.length) return null;
  return list[skip % list.length];
}

/** Deterministické „zamíchání“ podle dne – každý den jiné pořadí, během dne stabilní. */
export function dailyShuffle<T extends { video: Video }>(items: T[], day: string = dateKey()): T[] {
  const key = (id: string) => {
    let h = 2166136261;
    for (const ch of day + id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h;
  };
  return [...items].sort((a, b) => key(a.video.id) - key(b.video.id));
}

export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
