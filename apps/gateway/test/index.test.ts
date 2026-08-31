import { describe, it, expect, beforeEach } from 'vitest';
import type { Client } from '@libsql/client';
import worker, {
  Env,
} from '../src/index';
import {
  type GatewayEvent,
  __setTestClient,
  cleanupExpiredData,
} from '../src/db';
import { normalizePlan, getPlanLimits, PLANS } from '../src/plans';
import {
  db,
  setupTestDb,
  createEnv,
  seedToken,
  seedEvent,
  emptyCtx,
  fakeClient,
} from './utils';

beforeEach(setupTestDb);

describe('health', () => {
  it('returns ok and version', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/health'),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'test' });
  });

  it('creates a real D1 client when no test client is injected', async () => {
    __setTestClient(null);
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/health'),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'test' });
  });
});

describe('routing', () => {
  it('returns 401 for unauthenticated requests to /hooks', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/test_key', { method: 'GET' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for unauthenticated requests to /events', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events', { method: 'POST' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });
});

describe('error handling', () => {
  it('returns 500 with the Error message when a handler throws', async () => {
    const fakeClient = {
      execute: async () => {
        throw new Error('db down');
      },
    } as unknown as Client;
    __setTestClient(fakeClient);

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: 'Bearer any' },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('db down');
  });

  it('returns 500 with a generic message when a handler throws a non-Error value', async () => {
    const fakeClient = {
      execute: async () => {
        throw 'db down';
      },
    } as unknown as Client;
    __setTestClient(fakeClient);

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: 'Bearer any' },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Internal error');
  });
});

describe('scheduled cleanup', () => {
  it('invokes cleanupExpiredData via waitUntil', async () => {
    const env = createEnv();
    let waited = false;
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waited = true;
        return p;
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    await worker.scheduled({} as ScheduledEvent, env, ctx);
    expect(waited).toBe(true);
  });
});

describe('webhook', () => {
  it('rejects missing api key', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid api key', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/bad_key', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('accepts webhook and stores event', async () => {
    const env = createEnv();
    const apiKey = 'test_key_1';
    await seedToken(apiKey);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/test_key_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'push' }),
      }),
      env,
      emptyCtx()
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; messageId: string };
    expect(body.ok).toBe(true);
    expect(body.messageId).toBeDefined();

    const rows = await db.execute({
      sql: 'SELECT payload FROM eg_events WHERE id = ?',
      args: [body.messageId],
    });
    expect(rows.rows.length).toBe(1);
    expect(JSON.parse(String(rows.rows[0].payload))).toEqual({ action: 'push' });
  });

  it('rejects webhook for disabled user', async () => {
    const env = createEnv();
    const apiKey = 'test_key_2';
    await seedToken(apiKey, { userDisabled: 1 });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/test_key_2', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('rejects webhook for disabled agent', async () => {
    const env = createEnv();
    const apiKey = 'test_key_3';
    await seedToken(apiKey, { disabled: 1 });

    const res = await worker.fetch(
      new Request('http://localhost/hooks/test_key_3', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('falls back to bearer header for hooks', async () => {
    const env = createEnv();
    const apiKey = 'test_key_bearer';
    await seedToken(apiKey);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('accepts a non-JSON webhook body and wraps it as raw', async () => {
    const env = createEnv();
    const apiKey = 'test_key_raw';
    await seedToken(apiKey);

    const res = await worker.fetch(
      new Request('http://localhost/hooks/test_key_raw', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not-json',
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
    expect(rows.rows.length).toBe(1);
    expect(JSON.parse(String(rows.rows[0].payload))).toEqual({ raw: 'not-json' });
  });

  it('rejects webhook token on poll endpoint', async () => {
    const env = createEnv();
    const apiKey = 'test_key_webhook_only';
    await seedToken(apiKey, { role: 'webhook' });

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('falls back unknown token roles and null source', async () => {
    // The DB schema enforces role IN ('webhook', 'consumer') and source has a
    // default, so we use a fake client to simulate malformed metadata rows.
    __setTestClient(
      fakeClient([
        {
          rows: [
            {
              subscriptionId: 'sub_fake',
              userId: 'user_fake',
              role: 'invalid',
              source: null,
              signingSecret: null,
              consumeOnRead: 1,
              plan: 'custom',
            },
          ],
        },
        { rows: [{ disabled: 0 }] },
        { rows: [{ disabled: 0 }] },
        { rows: [{ count: 1 }] },
        { rows: [{ n: 0 }] },
        { rows: [] },
      ])
    );

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/fake_key', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });

  it('returns 429 when rate-limit insert returns no row', async () => {
    __setTestClient(
      fakeClient([
        {
          rows: [
            {
              subscriptionId: 'sub_fake',
              userId: 'user_fake',
              role: 'webhook',
              source: 'custom',
              signingSecret: null,
              consumeOnRead: 1,
              plan: 'custom',
            },
          ],
        },
        { rows: [{ disabled: 0 }] },
        { rows: [{ disabled: 0 }] },
        { rows: [] }, // rate_limits RETURNING empty
      ])
    );

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/fake_key', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(429);
  });

  it('treats a missing COUNT column as zero backlog', async () => {
    __setTestClient(
      fakeClient([
        {
          rows: [
            {
              subscriptionId: 'sub_fake',
              userId: 'user_fake',
              role: 'webhook',
              source: 'custom',
              signingSecret: null,
              consumeOnRead: 1,
              plan: 'custom',
            },
          ],
        },
        { rows: [{ disabled: 0 }] },
        { rows: [{ disabled: 0 }] },
        { rows: [{ count: 1 }] }, // rate limit OK
        { rows: [{}] }, // COUNT(*) missing n
        { rows: [] }, // pushEvent
      ])
    );

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/hooks/fake_key', { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
  });
});

describe('poll', () => {
  it('rejects missing bearer', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events'),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid bearer', async () => {
    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: 'Bearer bad_key' },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('returns empty list when no events', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_1';
    await seedToken(apiKey, { role: 'consumer' });

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], cursor: null });
  });

  it('returns unacknowledged events', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_2';
    await seedToken(apiKey, { role: 'consumer' });

    await seedEvent('sub_1', 'msg_1', { x: 1 }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body.events).toHaveLength(1);
    expect(body.events[0].messageId).toBe('msg_1');
    expect(body.cursor).toBe('msg_1');
  });

  it('renders subscription instructions into text', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_text';
    await seedToken(apiKey, {
      role: 'consumer',
      instructions: 'Review PR on {{repository.full_name}} (msg {{messageId}})',
    });

    await seedEvent('sub_1', 'msg_text', { repository: { full_name: 'a/b' } }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ text?: string }> };
    expect(body.events[0].text).toBe('Review PR on a/b (msg msg_text)');
  });

  it('keeps unresolvable placeholders as-is', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_placeholder';
    await seedToken(apiKey, {
      role: 'consumer',
      instructions: 'repo {{repository.missing}} done',
    });

    await seedEvent('sub_1', 'msg_ph', { repository: {} }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ text?: string }> };
    expect(body.events[0].text).toBe('repo {{repository.missing}} done');
  });

  it('omits text when no instructions configured', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_notext';
    await seedToken(apiKey, { role: 'consumer' });

    await seedEvent('sub_1', 'msg_notext', { x: 1 }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<Record<string, unknown>> };
    expect(body.events[0]).not.toHaveProperty('text');
  });

  it('honors cursor', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_3';
    await seedToken(apiKey, { role: 'consumer' });

    await seedEvent('sub_1', 'msg_a', {}, 1);
    await seedEvent('sub_1', 'msg_b', {}, 2);

    const res = await worker.fetch(
      new Request('http://localhost/events?messageId=msg_a', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body = (await res.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body.events).toHaveLength(1);
    expect(body.events[0].messageId).toBe('msg_b');
  });

  it('rejects consumer token on webhook endpoint', async () => {
    const env = createEnv();
    const apiKey = 'poll_key_webhook_forbidden';
    await seedToken(apiKey, { role: 'consumer' });

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('honors ?limit=N to cap returned events', async () => {
    const env = createEnv();
    const apiKey = 'poll_limit_key';
    await seedToken(apiKey, { role: 'consumer' });

    // Seed 5 pending events.
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await seedEvent('sub_1', `msg_l${i}`, { i }, now + i);
    }

    // ?limit=2 should return only 2 events.
    const res = await worker.fetch(
      new Request('http://localhost/events?limit=2', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].messageId).toBe('msg_l0');
    expect(body.events[1].messageId).toBe('msg_l1');
  });

  it('clamps ?limit to 1-100 range', async () => {
    const env = createEnv();
    const apiKey = 'poll_limit_clamp_key';
    await seedToken(apiKey, { role: 'consumer' });

    const now = Date.now();

    // limit=0 clamps to 1 — seed 1 event, expect 1 returned (and deleted).
    await seedEvent('sub_1', 'msg_lo', {}, now);
    const res0 = await worker.fetch(
      new Request('http://localhost/events?limit=0', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body0 = (await res0.json()) as { events: GatewayEvent[] };
    expect(body0.events).toHaveLength(1);

    // limit=999 clamps to 100; seed 3 fresh events, expect all 3 returned.
    for (let i = 0; i < 3; i++) {
      await seedEvent('sub_1', `msg_hi_${i}`, {}, now + 100 + i);
    }
    const res999 = await worker.fetch(
      new Request('http://localhost/events?limit=999', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body999 = (await res999.json()) as { events: GatewayEvent[] };
    expect(body999.events).toHaveLength(3);
  });

  it('rejects poll when user is disabled', async () => {
    const env = createEnv();
    const apiKey = 'poll_disabled_user';
    await seedToken(apiKey, { role: 'consumer', userDisabled: 1 });

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('rejects poll when agent is disabled', async () => {
    const env = createEnv();
    const apiKey = 'poll_disabled_agent';
    await seedToken(apiKey, { role: 'consumer', disabled: 1 });

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(403);
  });

  it('returns events whose payload is already an object', async () => {
    // The DB stores payload as JSON text, but the mapper defensively handles
    // the case where it is already parsed. Cover that branch with a fake client.
    __setTestClient(
      fakeClient([
        {
          rows: [
            {
              subscriptionId: 'sub_fake',
              userId: 'user_fake',
              role: 'consumer',
              source: 'custom',
              signingSecret: null,
              consumeOnRead: 1,
              plan: 'custom',
            },
          ],
        },
        { rows: [{ disabled: 0 }] },
        { rows: [{ disabled: 0 }] },
        { rows: [{ count: 1 }] }, // consumer rate limit OK
        {
          rows: [
            {
              id: 'msg_obj',
              payload: { x: 1 },
              created_at: 1000,
            },
          ],
        },
        { rows: [] }, // DELETE consumed events
      ])
    );

    const env = createEnv();
    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: 'Bearer fake_key' },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: GatewayEvent[] };
    expect(body.events).toHaveLength(1);
    expect(body.events[0].payload).toEqual({ x: 1 });
  });

  it('persist mode: events are NOT deleted after poll when consumeOnRead=0', async () => {
    const env = createEnv();
    const apiKey = 'poll_persist_key';
    await seedToken(apiKey, { role: 'consumer', consumeOnRead: 0 });

    await seedEvent('sub_1', 'msg_persist_1', { action: 'round_1' }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body.events).toHaveLength(1);
    expect(body.events[0].messageId).toBe('msg_persist_1');

    // Verify the event is still in the database (not deleted).
    const rows = await db.execute({
      sql: 'SELECT id FROM eg_events WHERE subscription_id = ?',
      args: ['sub_1'],
    });
    expect(rows.rows).toHaveLength(1);
    expect(String(rows.rows[0].id)).toBe('msg_persist_1');
  });

  it('persist mode: events can be polled multiple times when consumeOnRead=0', async () => {
    const env = createEnv();
    const apiKey = 'poll_persist_replay';
    await seedToken(apiKey, { role: 'consumer', consumeOnRead: 0 });

    await seedEvent('sub_1', 'msg_replay_1', { round: 1 }, 1000);
    await seedEvent('sub_1', 'msg_replay_2', { round: 2 }, 2000);

    // First poll: get both events.
    const res1 = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body1 = (await res1.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body1.events).toHaveLength(2);
    expect(body1.events[0].messageId).toBe('msg_replay_1');
    expect(body1.events[1].messageId).toBe('msg_replay_2');

    // Second poll with cursor from first: should return same events (not deleted).
    const res2 = await worker.fetch(
      new Request(`http://localhost/events?messageId=${body1.events[0].messageId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body2 = (await res2.json()) as { events: GatewayEvent[]; cursor: string };
    expect(body2.events).toHaveLength(1);
    expect(body2.events[0].messageId).toBe('msg_replay_2');

    // Third poll: from beginning, both events should still be there.
    const res3 = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    const body3 = (await res3.json()) as { events: GatewayEvent[] };
    expect(body3.events).toHaveLength(2);
  });

  it('default mode: events ARE deleted after poll when consumeOnRead is default (1)', async () => {
    const env = createEnv();
    const apiKey = 'poll_default_key';
    await seedToken(apiKey, { role: 'consumer' }); // default consumeOnRead=1

    await seedEvent('sub_1', 'msg_consume', { action: 'one_shot' }, 1000);

    const res = await worker.fetch(
      new Request('http://localhost/events', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: GatewayEvent[] };
    expect(body.events).toHaveLength(1);

    // Verify the event is deleted from the database.
    const rows = await db.execute({
      sql: 'SELECT id FROM eg_events WHERE subscription_id = ?',
      args: ['sub_1'],
    });
    expect(rows.rows).toHaveLength(0);
  });
});

describe('plans', () => {
  it('normalizes the custom plan id', () => {
    expect(normalizePlan('custom')).toBe('custom');
  });

  it('falls back to custom for unknown or missing plan ids', () => {
    expect(normalizePlan('unknown')).toBe('custom');
    expect(normalizePlan(null)).toBe('custom');
    expect(normalizePlan(undefined)).toBe('custom');
    expect(normalizePlan(123)).toBe('custom');
  });

  it('returns limits for custom and falls back for anything else', () => {
    expect(getPlanLimits('custom')).toEqual(PLANS.custom);
    expect(getPlanLimits('unknown')).toEqual(PLANS.custom);
    expect(getPlanLimits(null)).toEqual(PLANS.custom);
  });
});

describe('rate limit', () => {
  it('blocks events beyond plan threshold (custom = 20/min)', async () => {
    const env = createEnv();
    const apiKey = 'rate_key_1';
    // custom plan allows 20 webhook calls per minute.
    await seedToken(apiKey, { plan: 'custom' });

    const post = () =>
      worker.fetch(
        new Request('http://localhost/hooks/rate_key_1', { method: 'POST', body: '{}' }),
        env,
        emptyCtx()
      );

    // First 20 requests succeed.
    for (let i = 0; i < 20; i++) {
      const res = await post();
      expect(res.status).toBe(200);
    }

    // 21st request exceeds the custom plan limit -> 429.
    const over = await post();
    expect(over.status).toBe(429);
  });
});

describe('cleanup', () => {
  it('hard-deletes expired events (TTL = 15min)', async () => {
    const env = createEnv();
    const apiKey = 'cleanup_key_1';
    await seedToken(apiKey, { role: 'consumer', plan: 'custom' });

    // Insert an event with an old timestamp (older than the 15min TTL).
    const ancientTimestamp = Date.now() - 7 * 60 * 60 * 1000;
    await seedEvent('sub_1', 'msg_old', {}, ancientTimestamp);
    await seedEvent('sub_1', 'msg_recent', {}, Date.now());

    await cleanupExpiredData();

    const rows = await db.execute({
      sql: 'SELECT id FROM eg_events WHERE subscription_id = ?',
      args: ['sub_1'],
    });
    const ids = rows.rows.map((r) => String(r.id));
    expect(ids).not.toContain('msg_old');
    expect(ids).toContain('msg_recent');
  });
});

describe('backlog protection', () => {
  it('rejects new events at maxBacklog (custom = 300) and records the rejection', async () => {
    const env = createEnv();
    const apiKey = 'backlog_key';
    await seedToken(apiKey, { plan: 'custom', subscriptionId: 'sub_backlog', userId: 'user_backlog' });

    // Fill the queue to exactly the custom plan's maxBacklog (300) by inserting
    // directly, bypassing the webhook path so we don't trip the webhook rate limit.
    const now = Date.now();
    for (let i = 0; i < 300; i++) {
      await seedEvent('sub_backlog', `pending_${i}`, {}, now);
    }

    // Next webhook must be rejected with 429 + backlog info.
    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { pending: number; limit: number };
    expect(body.pending).toBe(300);
    expect(body.limit).toBe(300);

    // The rejection should be recorded in the hourly counter for the dashboard.
    const rejected = await db.execute({
      sql: 'SELECT count FROM eg_rejected_events_hourly WHERE subscription_id = ?',
      args: ['sub_backlog'],
    });
    expect(rejected.rows.length).toBe(1);
    expect(Number(rejected.rows[0].count)).toBe(1);
  });

  it('accepts events while under maxBacklog', async () => {
    const env = createEnv();
    const apiKey = 'backlog_ok_key';
    await seedToken(apiKey, { plan: 'custom', subscriptionId: 'sub_backlog_ok', userId: 'user_backlog_ok' });

    // 299 pending events is under the 300 limit -> next webhook still accepted.
    const now = Date.now();
    for (let i = 0; i < 299; i++) {
      await seedEvent('sub_backlog_ok', `pending_${i}`, {}, now);
    }

    const res = await worker.fetch(
      new Request(`http://localhost/hooks/${apiKey}`, { method: 'POST', body: '{}' }),
      env,
      emptyCtx()
    );
    expect(res.status).toBe(200);

    // No rejection recorded.
    const rejected = await db.execute({
      sql: 'SELECT count FROM eg_rejected_events_hourly WHERE subscription_id = ?',
      args: ['sub_backlog_ok'],
    });
    expect(rejected.rows.length).toBe(0);
  });
});

describe('CLI consumer rate limit', () => {
  it('blocks poll beyond the uniform 60/min limit', async () => {
    const env = createEnv();
    const apiKey = 'cli_poll_key';
    await seedToken(apiKey, { role: 'consumer', plan: 'custom' });

    const poll = () =>
      worker.fetch(
        new Request('http://localhost/events', {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
        env,
        emptyCtx()
      );

    // First 60 polls succeed (uniform across plans).
    for (let i = 0; i < 60; i++) {
      const res = await poll();
      expect(res.status).toBe(200);
    }

    // 61st poll exceeds the consumer rate limit -> 429.
    const over = await poll();
    expect(over.status).toBe(429);
  });
});
