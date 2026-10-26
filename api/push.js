// Odeslání notifikace (Vercel Function). Volá ji Supabase (připomínky) nebo aplikace.
// Klíče VAPID přicházejí v požadavku z tvého Supabase – tady se nic neukládá.

import webpush from 'web-push';
import { validatePush } from './_push.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Použij POST' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const error = validatePush(body);
  if (error) return res.status(400).json({ error });
  const { subscription, vapid, payload } = body;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 6 * 3600,
      vapidDetails: { subject: 'mailto:questy@example.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    // 404/410 = odběr už neplatí (aplikace se přihlásí znovu)
    res.status(e.statusCode || 500).json({ error: e.body || e.message });
  }
}
