import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signTypeform,
} from '../utils';

describe('Typeform webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'typeform';
  const secret = 'typeform_webhook_secret';
  const rawBody = JSON.stringify({ event_id: '01HM3K8N2P9X4ABC', event_type: 'form_response' });

  it('accepts a validly signed Typeform webhook', async () => {
    const env = createEnv();
    const apiKey = 'tf_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Typeform-Signature': signTypeform(secret, rawBody),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Typeform signature', async () => {
    const env = createEnv();
    const apiKey = 'tf_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Typeform-Signature': signTypeform('other', rawBody),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a tampered Typeform body', async () => {
    const env = createEnv();
    const apiKey = 'tf_tamper';
    await seedToken(apiKey, { source, signingSecret: secret });
    const sig = signTypeform(secret, rawBody);
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Typeform-Signature': sig,
        },
        body: JSON.stringify({ event_id: 'tampered' }),
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a Typeform webhook missing the signature header', async () => {
    const env = createEnv();
    const apiKey = 'tf_nohdr';
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

  it('rejects a Typeform webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'tf_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Typeform-Signature': signTypeform('any', rawBody),
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

  it('rejects a malformed Typeform signature header', async () => {
    const env = createEnv();
    const apiKey = 'tf_malformed';
    await seedToken(apiKey, { source, signingSecret: secret });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Typeform-Signature': 'not-sha256=abc' },
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
