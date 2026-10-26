// Kontrola požadavku na odeslání notifikace (sdílené s testy).

// Notifikace smí jít jen na push služby prohlížečů – funkce tak nejde zneužít k posílání jinam.
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
const B64URL = /^[A-Za-z0-9_-]+$/;

/** Vrací chybovou hlášku, nebo null když je požadavek v pořádku. */
export function validatePush(body) {
  const { subscription: s, vapid: v, payload: p } = body || {};
  let host;
  try {
    const u = new URL(s?.endpoint);
    if (u.protocol !== 'https:') return 'Neplatný endpoint';
    host = u.hostname;
  } catch {
    return 'Chybí endpoint';
  }
  if (!PUSH_HOSTS.some((re) => re.test(host))) return 'Nepodporovaná push služba';
  if (!B64URL.test(s.keys?.p256dh || '') || !B64URL.test(s.keys?.auth || '')) return 'Chybí klíče odběru';
  if (!B64URL.test(v?.publicKey || '') || !B64URL.test(v?.privateKey || '')) return 'Chybí klíče VAPID';
  if (!p || typeof p.title !== 'string' || JSON.stringify(p).length > 2000) return 'Neplatný obsah';
  return null;
}
