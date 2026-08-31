import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signLinear,
} from '../utils';

describe('Linear webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'linear';
  const secret = 'lin_secret_abc';
  const rawBody = JSON.stringify({ action: 'create', data: { id: 'ISSUE-1' } });

  it('accepts a validly signed Linear webhook', async () => {
    const env = createEnv();
    const apiKey = 'lin_valid';
    await seedToken(apiKey, { source, signingSecret: secret });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/lin_valid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Linear-Signature': signLinear(secret, rawBody) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Linear signature', async () => {
    const env = createEnv();
    const apiKey = 'lin_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request('http://localhost/hooks/lin_wrong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Linear-Signature': signLinear('other', rawBody) },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Linear webhook with no signature header', async () => {
    const env = createEnv();
    const apiKey = 'lin_nohdr';
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

  it('rejects a tampered Linear body', async () => {
    const env = createEnv();
    const apiKey = 'lin_tamper';
    await seedToken(apiKey, { source, signingSecret: secret });
    const sig = signLinear(secret, rawBody);
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Linear-Signature': sig },
        body: JSON.stringify({ action: 'delete' }),
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Linear webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'lin_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Linear-Signature': signLinear('any_secret', rawBody),
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

  it('rejects a Linear signature with the wrong length', async () => {
    const env = createEnv();
    const apiKey = 'lin_length';
    await seedToken(apiKey, { source, signingSecret: secret });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Linear-Signature': 'short' },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
  });
});
