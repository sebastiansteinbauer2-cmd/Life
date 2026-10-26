// Proxy pro nejnovější videa YouTube kanálu (Vercel Function).
// Prohlížeč nemůže RSS YouTube číst přímo (CORS), tahle funkce ho přepošle jako JSON.
// Použití: https://<tvoje-app>.vercel.app/api/yt?handle=kurzgesagt

import { HANDLE_RE, parseChannelId, parseFeed } from './_youtube.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (questy-zivota)',
  'Accept-Language': 'en-US,en;q=0.8',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const handle = String(req.query.handle || '').replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) {
    res.status(400).json({ error: 'Neplatný kanál' });
    return;
  }
  try {
    const page = await fetch(`https://www.youtube.com/@${handle}`, { headers: HEADERS });
    const channelId = page.ok ? parseChannelId(await page.text()) : null;
    if (!channelId) {
      res.status(404).json({ error: 'Kanál nenalezen' });
      return;
    }
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: HEADERS });
    if (!feed.ok) {
      res.status(502).json({ error: 'YouTube neodpověděl' });
      return;
    }
    const { channelTitle, videos } = parseFeed(await feed.text());
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ handle, channelId, channelTitle, videos });
  } catch {
    res.status(502).json({ error: 'YouTube není dostupný' });
  }
}
