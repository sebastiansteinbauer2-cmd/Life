import { describe, expect, it } from 'vitest';
import { encodeTokens, isAllowedReturn, returnUrl } from './_strava.js';

describe('Strava server', () => {
  it('povolí návrat jen do vlastní aplikace', () => {
    expect(isAllowedReturn('https://sebastiansteinbauer2-cmd.github.io/Life/')).toBe(true);
    expect(isAllowedReturn('https://life-l2k6.vercel.app/')).toBe(true);
    expect(isAllowedReturn('http://localhost:5173/')).toBe(true);
    expect(isAllowedReturn('https://evil.example.com/')).toBe(false);
    expect(isAllowedReturn('https://github.io.evil.com/')).toBe(false);
    expect(isAllowedReturn('javascript:alert(1)')).toBe(false);
  });

  it('tokeny ve fragmentu URL a zpět', () => {
    const enc = encodeTokens({ access_token: 'a', refresh_token: 'r', expires_at: 123, athlete: { id: 7, firstname: 'Seb', city: 'x' } });
    const url = returnUrl('https://x.github.io/Life/#/finance', { strava: enc });
    expect(url.startsWith('https://x.github.io/Life/#/ironman?strava=')).toBe(true);
    const back = JSON.parse(Buffer.from(new URLSearchParams(url.split('?')[1]).get('strava'), 'base64url').toString());
    expect(back).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: 123, athlete: { id: 7, firstname: 'Seb' } });
  });
});
