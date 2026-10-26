// Sdílené funkce pro api/yt.js (soubory s _ Vercel nezveřejňuje jako endpoint).

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
export const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export const HANDLE_RE = /^[A-Za-z0-9._-]{2,40}$/;

/** ID kanálu ze stránky youtube.com/@handle – kanonický odkaz je spolehlivější než první "channelId" ve stránce. */
export function parseChannelId(html) {
  const canonical = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html);
  if (canonical) return canonical[1];
  const external = /"externalId":"(UC[\w-]{22})"/.exec(html);
  return external ? external[1] : null;
}

/** Videa z RSS kanálu (bez Shorts). */
export function parseFeed(xml) {
  const head = xml.split('<entry>')[0];
  const channelTitle = decode((/<title>([^<]*)<\/title>/.exec(head) || [])[1] || '');
  const videos = [];
  for (const chunk of xml.split('<entry>').slice(1)) {
    const id = (/<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(chunk) || [])[1];
    if (!id) continue;
    const link = (/<link rel="alternate" href="([^"]+)"/.exec(chunk) || [])[1] || '';
    if (link.includes('/shorts/')) continue;
    videos.push({
      id,
      title: decode((/<title>([^<]*)<\/title>/.exec(chunk) || [])[1] || ''),
      published: (/<published>([^<]+)<\/published>/.exec(chunk) || [])[1] || '',
      views: Number((/<media:statistics views="(\d+)"/.exec(chunk) || [])[1] || 0),
    });
  }
  return { channelTitle, videos };
}
