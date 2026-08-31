import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signShopify,
} from '../utils';

describe('Shopify webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'shopify';
  const secret = 'shpfa_shared_secret';
  const rawBody = JSON.stringify({ id: 123, topic: 'orders/create' });

  it('accepts a validly signed Shopify webhook', async () => {
    const env = createEnv();
    const apiKey = 'shp_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Hmac-SHA256': signShopify(secret, rawBody),
          'X-Shopify-Topic': 'orders/create',
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Shopify signature', async () => {
    const env = createEnv();
    const apiKey = 'shp_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Hmac-SHA256': signShopify('other', rawBody),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a tampered Shopify body', async () => {
    const env = createEnv();
    const apiKey = 'shp_tamper';
    await seedToken(apiKey, { source, signingSecret: secret });
    const sig = signShopify(secret, rawBody);
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-SHA256': sig },
        body: JSON.stringify({ id: 999 }),
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Shopify webhook with no signature header', async () => {
    const env = createEnv();
    const apiKey = 'shp_nohdr';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Shopify webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'shp_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Hmac-SHA256': signShopify('any', rawBody),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('no signing_secret');
  });
});
