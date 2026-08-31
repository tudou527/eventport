import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../src/index';
import { normalizeHubSpotUri, verifyHubSpot } from '../../src/connectors/hubspot';
import {
  setupTestDb,
  createEnv,
  seedToken,
  emptyCtx,
  signHubSpot,
} from '../utils';

describe('HubSpot webhook signature verification', () => {
  beforeEach(setupTestDb);

  const source = 'hubspot';
  const secret = 'hubspot_client_secret';
  const rawBody = JSON.stringify([{ subscriptionType: 'contact.creation', objectId: 1 }]);
  const now = () => Date.now(); // HubSpot timestamps are in milliseconds.

  it('accepts a validly signed HubSpot webhook', async () => {
    const env = createEnv();
    const apiKey = 'hs_valid';
    await seedToken(apiKey, { source, signingSecret: secret });
    const url = `http://localhost/hooks/${apiKey}`;
    const ts = now();
    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': signHubSpot(secret, 'POST', url, rawBody, ts),
          'X-HubSpot-Request-Timestamp': String(ts),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('rejects a wrong HubSpot signature', async () => {
    const env = createEnv();
    const apiKey = 'hs_wrong';
    await seedToken(apiKey, { source, signingSecret: secret });
    const url = `http://localhost/hooks/${apiKey}`;
    const ts = now();
    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': signHubSpot('other', 'POST', url, rawBody, ts),
          'X-HubSpot-Request-Timestamp': String(ts),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a HubSpot webhook with a stale timestamp', async () => {
    const env = createEnv();
    const apiKey = 'hs_stale';
    await seedToken(apiKey, { source, signingSecret: secret });
    const url = `http://localhost/hooks/${apiKey}`;
    const oldTs = now() - 10 * 60 * 1000; // 10 minutes ago.
    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': signHubSpot(secret, 'POST', url, rawBody, oldTs),
          'X-HubSpot-Request-Timestamp': String(oldTs),
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a tampered HubSpot body', async () => {
    const env = createEnv();
    const apiKey = 'hs_tamper';
    await seedToken(apiKey, { source, signingSecret: secret });
    const url = `http://localhost/hooks/${apiKey}`;
    const ts = now();
    const sig = signHubSpot(secret, 'POST', url, rawBody, ts);
    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': sig,
          'X-HubSpot-Request-Timestamp': String(ts),
        },
        body: JSON.stringify([{ subscriptionType: 'contact.deletion' }]),
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects a HubSpot webhook missing signature or timestamp header', async () => {
    const env = createEnv();
    const apiKey = 'hs_missing_headers';
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

  it('rejects a HubSpot webhook with a non-numeric timestamp', async () => {
    const env = createEnv();
    const apiKey = 'hs_invalid_ts';
    await seedToken(apiKey, { source, signingSecret: secret });
    const url = `http://localhost/hooks/${apiKey}`;

    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': signHubSpot(secret, 'POST', url, rawBody, now()),
          'X-HubSpot-Request-Timestamp': 'not-a-number',
        },
        body: rawBody,
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toContain('invalid timestamp');
  });

  it('reports missing url or method when called directly', async () => {
    const result = await verifyHubSpot.verify({
      secret,
      rawBody,
      headers: new Headers({
        'X-HubSpot-Signature-v3': 'sig',
        'X-HubSpot-Request-Timestamp': String(now()),
      }),
      url: '',
      method: '',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing request url or method');
  });

  it('rejects a HubSpot webhook when subscription has no signing_secret', async () => {
    const env = createEnv();
    const apiKey = 'hs_no_secret';
    await seedToken(apiKey, { source, signingSecret: null });

    const url = `http://localhost/hooks/${apiKey}`;
    const ts = now();
    const res = await worker.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HubSpot-Signature-v3': signHubSpot('any', 'POST', url, rawBody, ts),
          'X-HubSpot-Request-Timestamp': String(ts),
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

describe('HubSpot URI normalization', () => {
  it('strips the fragment', () => {
    expect(normalizeHubSpotUri('https://h.example/hooks/x#frag')).toBe('https://h.example/hooks/x');
  });

  it('decodes the documented set of reserved characters', () => {
    // %2F -> /, %3A -> :, %3F -> ?, %40 -> @
    expect(normalizeHubSpotUri('https://h.example/a%2Fb%3Ac%3Fd%40e')).toBe('https://h.example/a/b:c?d@e');
  });

  it('leaves other percent-encoded sequences (e.g. %20) intact', () => {
    expect(normalizeHubSpotUri('https://h.example/a%20b')).toBe('https://h.example/a%20b');
  });

  it('is case-insensitive when matching encoded forms', () => {
    expect(normalizeHubSpotUri('https://h.example/a%2fb')).toBe('https://h.example/a/b');
  });
});
