import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import {
  db,
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signGitHub,
} from '../utils';

describe('GitHub webhook signature verification', () => {
  beforeEach(setupTestDb);

  it('accepts a validly signed GitHub webhook', async () => {
    const env = createEnv();
    const apiKey = 'gh_valid_key';
    const secret = 'whsec_my_github_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const rawBody = JSON.stringify({ action: 'opened', pull_request: { number: 1 } });
    const signature = signGitHub(secret, rawBody);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_valid_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Event': 'pull_request',
          'X-GitHub-Delivery': 'delivery-1',
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; messageId: string };
    expect(body.ok).toBe(true);

    const rows = await db.execute({
      sql: 'SELECT payload FROM eg_events WHERE id = ?',
      args: [body.messageId],
    });
    expect(JSON.parse(String(rows.rows[0].payload))).toEqual({
      action: 'opened',
      pull_request: { number: 1 },
    });
  });

  it('rejects a GitHub webhook with a wrong signature', async () => {
    const env = createEnv();
    const apiKey = 'gh_wrong_sig_key';
    const secret = 'whsec_real_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const rawBody = JSON.stringify({ action: 'opened' });
    // Sign with a different secret — should fail verification.
    const wrongSignature = signGitHub('whsec_wrong_secret', rawBody);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_wrong_sig_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': wrongSignature,
          'X-GitHub-Event': 'pull_request',
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe('Invalid signature');

    // Event must NOT have been stored.
    const rows = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM eg_events WHERE subscription_id = ?',
      args: ['sub_1'],
    });
    expect(Number(rows.rows[0].n)).toBe(0);
  });

  it('rejects a GitHub webhook with no signature header', async () => {
    const env = createEnv();
    const apiKey = 'gh_no_sig_header';
    const secret = 'whsec_some_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_no_sig_header', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opened' }),
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
  });

  it('rejects a GitHub webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'gh_no_secret_key';
    await seedToken(apiKey, { source: 'github', signingSecret: null });

    const rawBody = JSON.stringify({ action: 'opened' });
    // Even with a signature header present, we have no secret to verify against.
    const signature = signGitHub('whsec_anything', rawBody);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_no_secret_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Event': 'pull_request',
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.reason).toContain('no signing_secret');
  });

  it('skips verification for custom source (passthrough)', async () => {
    const env = createEnv();
    const apiKey = 'custom_passthrough_key';
    await seedToken(apiKey, { source: 'custom', signingSecret: null });

    // No signature header — custom source should still accept the event.
    const res = await worker.fetch(
      new Request('http://localhost/hooks/custom_passthrough_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'anything' }),
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; messageId: string };
    expect(body.ok).toBe(true);
  });

  it('treats tampered raw body as invalid signature', async () => {
    const env = createEnv();
    const apiKey = 'gh_tampered_key';
    const secret = 'whsec_tamper_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const signedBody = JSON.stringify({ action: 'opened' });
    const signature = signGitHub(secret, signedBody);
    // Send a DIFFERENT body with the old signature — must fail.
    const tamperedBody = JSON.stringify({ action: 'closed' });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_tampered_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Event': 'pull_request',
        },
        body: tamperedBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
  });

  it('rejects a malformed GitHub signature header', async () => {
    const env = createEnv();
    const apiKey = 'gh_malformed_key';
    const secret = 'whsec_malformed_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_malformed_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'notsha256=abc',
          'X-GitHub-Event': 'pull_request',
        },
        body: JSON.stringify({ action: 'opened' }),
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('malformed');
  });

  it('rejects a GitHub signature with the wrong length', async () => {
    const env = createEnv();
    const apiKey = 'gh_length_key';
    const secret = 'whsec_length_secret';
    await seedToken(apiKey, { source: 'github', signingSecret: secret });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/gh_length_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=tooshort',
          'X-GitHub-Event': 'pull_request',
        },
        body: JSON.stringify({ action: 'opened' }),
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('length mismatch');
  });
});
