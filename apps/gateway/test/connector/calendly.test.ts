import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signCalendly,
} from '../utils';

describe('Calendly webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'calendly';
  const secret = 'CL_WEBHOOK_SIGNING_KEY';
  const rawBody = JSON.stringify({ event: 'invitee.created', payload: {} });
  const now = () => Math.floor(Date.now() / 1000);

  it('accepts a validly signed Calendly webhook', async () => {
    const env = createEnv();
    const apiKey = 'cal_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Calendly-Webhook-Signature': signCalendly(secret, rawBody, now()),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Calendly signature', async () => {
    const env = createEnv();
    const apiKey = 'cal_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Calendly-Webhook-Signature': signCalendly('other', rawBody, now()),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Calendly webhook with a stale timestamp', async () => {
    const env = createEnv();
    const apiKey = 'cal_stale';
    await seedToken(apiKey, { source, signingSecret: secret });
    const oldTs = now() - 600;
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Calendly-Webhook-Signature': signCalendly(secret, rawBody, oldTs),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Calendly webhook with no signature header', async () => {
    const env = createEnv();
    const apiKey = 'cal_nohdr';
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

  it('rejects a Calendly webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'cal_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Calendly-Webhook-Signature': signCalendly('any', rawBody, now()),
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

  it('rejects a malformed Calendly signature header', async () => {
    const env = createEnv();
    const apiKey = 'cal_malformed';
    await seedToken(apiKey, { source, signingSecret: secret });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Calendly-Webhook-Signature': 't=123' },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('malformed');
  });
});
