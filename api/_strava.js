// Sdílené funkce pro api/strava.js (soubory s _ Vercel nezveřejňuje).

/** Kam se smí po přihlášení vrátit – jen GitHub Pages, Vercel nebo localhost (ochrana proti přesměrování jinam). */
export function isAllowedReturn(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return u.protocol === 'https:' && (/\.github\.io$/.test(u.hostname) || /\.vercel\.app$/.test(u.hostname));
  } catch {
    return false;
  }
}

/** Tokeny pro aplikaci – base64url JSON, předává se ve fragmentu URL (#), který neodchází na žádný server. */
export function encodeTokens(t) {
  const json = JSON.stringify({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
    athlete: t.athlete ? { id: t.athlete.id, firstname: t.athlete.firstname } : undefined,
  });
  return Buffer.from(json).toString('base64url');
}

/** URL pro návrat do aplikace (hash router: #/ironman?strava=… nebo ?strava_error=…). */
export function returnUrl(base, params) {
  const clean = base.split('#')[0];
  const q = new URLSearchParams(params).toString();
  return `${clean}#/ironman?${q}`;
}
