import { describe, expect, it } from 'vitest';
import { validatePush } from './_push.js';

const ok = {
  subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BAbc-_1', auth: 'xyz' } },
  vapid: { publicKey: 'BPub', privateKey: 'priv' },
  payload: { title: 'Questy života', body: 'Ahoj' },
};

describe('kontrola notifikace', () => {
  it('přijme platný požadavek', () => {
    expect(validatePush(ok)).toBeNull();
    expect(validatePush({ ...ok, subscription: { ...ok.subscription, endpoint: 'https://web.push.apple.com/x' } })).toBeNull();
  });
  it('odmítne cizí servery a chybějící klíče', () => {
    expect(validatePush({ ...ok, subscription: { ...ok.subscription, endpoint: 'https://evil.com/fcm.googleapis.com' } })).toMatch(/Nepodporovaná/);
    expect(validatePush({ ...ok, subscription: { ...ok.subscription, endpoint: 'https://fcm.googleapis.com.evil.com/x' } })).toMatch(/Nepodporovaná/);
    expect(validatePush({ ...ok, vapid: {} })).toMatch(/VAPID/);
    expect(validatePush({ ...ok, payload: { title: 'x'.repeat(3000) } })).toMatch(/obsah/);
    expect(validatePush(null)).toMatch(/endpoint/);
  });
});
