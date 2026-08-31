import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signSlack,
} from '../utils';

describe('Slack webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'slack';
  const secret = 'slack_signing_secret';
  const rawBody = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
  const now = () => Math.floor(Date.now() / 1000);

  it('accepts a validly signed Slack webhook', async () => {
    const env = createEnv();
    const apiKey = 'sl_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const ts = now();
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': signSlack(secret, rawBody, ts),
          'X-Slack-Request-Timestamp': String(ts),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Slack signature', async () => {
    const env = createEnv();
    const apiKey = 'sl_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const ts = now();
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': signSlack('other', rawBody, ts),
          'X-Slack-Request-Timestamp': String(ts),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Slack webhook with a stale timestamp', async () => {
    const env = createEnv();
    const apiKey = 'sl_stale';
    await seedToken(apiKey, { source, signingSecret: secret });
    const oldTs = now() - 600;
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': signSlack(secret, rawBody, oldTs),
          'X-Slack-Request-Timestamp': String(oldTs),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Slack webhook missing the timestamp header', async () => {
    const env = createEnv();
    const apiKey = 'sl_nots';
    await seedToken(apiKey, { source, signingSecret: secret });
    const ts = now();
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': signSlack(secret, rawBody, ts),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Slack webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'sl_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });
    const ts = now();

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': signSlack('any', rawBody, ts),
          'X-Slack-Request-Timestamp': String(ts),
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

  it('rejects a malformed Slack signature header', async () => {
    const env = createEnv();
    const apiKey = 'sl_malformed';
    await seedToken(apiKey, { source, signingSecret: secret });
    const ts = now();

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Signature': 'not-v0=abc',
          'X-Slack-Request-Timestamp': String(ts),
        },
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
