import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { generateVapid } from './push';

describe('klíče VAPID', () => {
  it('vygenerované klíče přijme knihovna web-push (na Vercelu)', async () => {
    const keys = await generateVapid();
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(keys.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
    };
    const req = webpush.generateRequestDetails(subscription, JSON.stringify({ title: 'x' }), {
      vapidDetails: { subject: 'mailto:questy@example.com', publicKey: keys.publicKey, privateKey: keys.privateKey },
    });
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(req.body.length).toBeGreaterThan(0);
  });
});
