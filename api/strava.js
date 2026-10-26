// Propojení se Stravou (Vercel Function). Klientské tajemství je jen tady na serveru
// v proměnných prostředí STRAVA_CLIENT_ID a STRAVA_CLIENT_SECRET.
//
//   GET  /api/strava?action=config                 → je Strava nastavená?
//   GET  /api/strava?action=login&return=<appUrl>  → přesměrování na přihlášení Stravy
//   GET  /api/strava?action=callback&code=…        → výměna kódu za tokeny a návrat do aplikace
//   POST /api/strava?action=refresh {refresh_token} → nový access token
//   GET  /api/strava?action=activities&after=…&page=…  (Authorization: Bearer …) → aktivity

import { encodeTokens, isAllowedReturn, returnUrl } from './_strava.js';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

async function tokenRequest(params) {
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = String(req.query.action || '');
  const self = `https://${req.headers['x-forwarded-host'] || req.headers.host}/api/strava`;

  if (action === 'config') return res.status(200).json({ configured: !!(CLIENT_ID && CLIENT_SECRET) });
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(503).json({ error: 'Strava není na serveru nastavená (chybí STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).' });

  if (action === 'login') {
    const back = String(req.query.return || '');
    if (!isAllowedReturn(back)) return res.status(400).json({ error: 'Neplatná návratová adresa' });
    const q = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: `${self}?action=callback`, response_type: 'code',
      approval_prompt: 'auto', scope: 'read,activity:read_all', state: back,
    });
    res.setHeader('Location', `https://www.strava.com/oauth/mobile/authorize?${q}`);
    return res.status(302).end();
  }

  if (action === 'callback') {
    const back = String(req.query.state || '');
    if (!isAllowedReturn(back)) return res.status(400).send('Neplatná návratová adresa');
    if (req.query.error || !req.query.code) {
      res.setHeader('Location', returnUrl(back, { strava_error: 'Přihlášení ke Stravě bylo zrušeno.' }));
      return res.status(302).end();
    }
    if (!String(req.query.scope || '').includes('activity:read')) {
      res.setHeader('Location', returnUrl(back, { strava_error: 'Povol prosím přístup k aktivitám (zaškrtni „aktivity“).' }));
      return res.status(302).end();
    }
    const t = await tokenRequest({ code: String(req.query.code), grant_type: 'authorization_code' });
    const target = t.ok ? returnUrl(back, { strava: encodeTokens(t.data) }) : returnUrl(back, { strava_error: `Strava odmítla přihlášení (${t.status}).` });
    res.setHeader('Location', target);
    return res.status(302).end();
  }

  if (action === 'refresh' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!body.refresh_token) return res.status(400).json({ error: 'Chybí refresh_token' });
    const t = await tokenRequest({ refresh_token: String(body.refresh_token), grant_type: 'refresh_token' });
    return res.status(t.ok ? 200 : t.status).json(t.ok ? { access_token: t.data.access_token, refresh_token: t.data.refresh_token, expires_at: t.data.expires_at } : t.data);
  }

  if (action === 'activities') {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Chybí token' });
    const q = new URLSearchParams({ per_page: '100', page: String(Number(req.query.page) || 1) });
    if (req.query.after) q.set('after', String(Number(req.query.after) || 0));
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?${q}`, { headers: { Authorization: auth } });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.status).send(await r.text());
  }

  return res.status(400).json({ error: 'Neznámá akce' });
}
