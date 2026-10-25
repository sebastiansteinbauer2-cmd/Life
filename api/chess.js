// Volitelná serverless proxy pro Chess.com PubAPI (Vercel Function).
// Potřeba jen tehdy, když přímé volání z prohlížeče nefunguje (CORS / blokace).
// Použití: https://<tvoje-app>.vercel.app/api/chess?path=player/<jmeno>/stats

const ALLOWED = /^player\/[A-Za-z0-9_-]{1,40}\/(stats|games\/archives|games\/\d{4}\/\d{2})$/;

export default async function handler(req, res) {
  const path = String(req.query.path || '');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!ALLOWED.test(path)) {
    res.status(400).json({ error: 'Neplatná cesta' });
    return;
  }
  try {
    const r = await fetch(`https://api.chess.com/pub/${path}`, {
      headers: { 'User-Agent': 'questy-zivota (osobní aplikace)', Accept: 'application/json' },
    });
    res.setHeader('Cache-Control', 's-maxage=300');
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(await r.text());
  } catch {
    res.status(502).json({ error: 'Chess.com není dostupný' });
  }
}
