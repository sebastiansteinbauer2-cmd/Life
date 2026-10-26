// Volitelná serverless proxy pro Trading 212 API (Vercel Function).
// Prohlížeč nesmí volat Trading 212 přímo (CORS), proto dotaz přepošle tato funkce.
// API klíč posílá aplikace v hlavičce Authorization; proxy ho nikam neukládá.
// Použití: https://<tvoje-app>.vercel.app/api/t212?env=live&path=equity/account/cash

const ALLOWED = new Set([
  'equity/account/info',
  'equity/account/cash',
  'equity/portfolio',
  'history/transactions',
  'history/dividends',
]);
const PASS_PARAMS = ['limit', 'cursor', 'time', 'ticker'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  const path = String(req.query.path || '');
  const env = req.query.env === 'demo' ? 'demo' : 'live';
  const auth = req.headers.authorization;
  if (req.method !== 'GET' || !ALLOWED.has(path) || !auth) {
    res.status(400).json({ error: 'Neplatný požadavek' });
    return;
  }
  const qs = new URLSearchParams();
  for (const k of PASS_PARAMS) if (req.query[k]) qs.set(k, String(req.query[k]));
  try {
    const r = await fetch(`https://${env}.trading212.com/api/v0/${path}${qs.size ? `?${qs}` : ''}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(await r.text());
  } catch {
    res.status(502).json({ error: 'Trading 212 není dostupný' });
  }
}
