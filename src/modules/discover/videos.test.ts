import { describe, expect, it } from 'vitest';
import { dailyShuffle, pickVideoOfDay, serverBase, youtubeHandle } from './videos';

const items = Array.from({ length: 40 }, (_, i) => ({ video: { id: `vid${String(i).padStart(8, '0')}`, title: `V${i}`, published: '', views: 0 } }));

describe('videa', () => {
  it('handle z odkazu a adresa serveru', () => {
    expect(youtubeHandle('https://www.youtube.com/@kurzgesagt')).toBe('kurzgesagt');
    expect(youtubeHandle('https://waitbutwhy.com')).toBeNull();
    expect(serverBase({ serverUrl: '', financeProxyUrl: 'https://life-x.vercel.app/api/t212' })).toBe('https://life-x.vercel.app');
    expect(serverBase({ serverUrl: 'https://a.vercel.app', financeProxyUrl: '' })).toBe('https://a.vercel.app');
  });

  it('každý den jiné pořadí, během dne stejné', () => {
    const a = dailyShuffle(items, '2026-10-26').map((x) => x.video.id);
    const b = dailyShuffle(items, '2026-10-26').map((x) => x.video.id);
    const c = dailyShuffle(items, '2026-10-27').map((x) => x.video.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(items.map((x) => x.video.id));
  });

  it('video dne přeskočí zhlédnutá a po zhlédnutí nabídne jiné', () => {
    const watched = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const p = pickVideoOfDay(items, watched, '2026-10-26')!;
      expect(watched.has(p.video.id)).toBe(false);
      seen.add(p.video.id);
      watched.add(p.video.id);
    }
    expect(seen.size).toBe(10);
    // jiný den → jiné první video
    expect(pickVideoOfDay(items, new Set(), '2026-10-26')!.video.id).not.toBe(pickVideoOfDay(items, new Set(), '2026-10-28')!.video.id);
  });
});
