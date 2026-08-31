import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signStripe,
} from '../utils';

describe('Stripe webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'stripe';
  const secret = 'whsec_stripe_secret';
  const rawBody = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
  const now = () => Math.floor(Date.now() / 1000);

  it('accepts a validly signed Stripe webhook', async () => {
    const env = createEnv();
    const apiKey = 'st_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signStripe(secret, rawBody, now()) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Stripe signature', async () => {
    const env = createEnv();
    const apiKey = 'st_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signStripe('whsec_other', rawBody, now()) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Stripe webhook with a stale timestamp', async () => {
    const env = createEnv();
    const apiKey = 'st_stale';
    await seedToken(apiKey, { source, signingSecret: secret });
    const oldTs = now() - 600; // 10 minutes ago — outside the 5-minute window.
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signStripe(secret, rawBody, oldTs) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('timestamp');
  });

  it('rejects a malformed Stripe-Signature header', async () => {
    const env = createEnv();
    const apiKey = 'st_malformed';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'nope' },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Stripe webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'st_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signStripe('any', rawBody, now()) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('no signing_secret');
  });

  it('rejects a Stripe webhook with a missing signature header', async () => {
    const env = createEnv();
    const apiKey = 'st_missing_header';
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
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('missing');
  });

  it('rejects a Stripe webhook with a non-numeric timestamp', async () => {
    const env = createEnv();
    const apiKey = 'st_invalid_ts';
    await seedToken(apiKey, { source, signingSecret: secret });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=NaN,v1=anything' },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('invalid timestamp');
  });
});
