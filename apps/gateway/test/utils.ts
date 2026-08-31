import { createClient, type Client } from '@libsql/client';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { __setTestClient } from '../src/db';
import { normalizeHubSpotUri } from '../src/connectors/hubspot';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_SQL = readFileSync(join(__dirname, '../schema.sql'), 'utf8');

/** Shared in-memory libsql client. All worker.fetch calls use this via the
 * test injection hook, so seed data and assertions read the same database. */
export let db: Client;

/** Fresh in-memory DB per test for isolation. */
export async function setupTestDb(): Promise<void> {
  // @libsql/client treats `:memory:` as a private per-client database, so we
  // inject one shared instance via __setTestClient instead of letting the
  // worker create its own.
  db = createClient({ url: ':memory:' });
  // Strip `-- ...` line comments before splitting on `;` so semicolons inside
  // comments (e.g. "NULL = active") don't break statement boundaries.
  const stripped = SCHEMA_SQL.replace(/--[^\n]*/g, '');
  for (const stmt of stripped.split(';')) {
    const trimmed = stmt.trim();
    if (trimmed) {
      await db.execute(trimmed);
    }
  }
  __setTestClient(db);
}

export function createEnv() {
  return {
    // Stub D1 binding — real queries go through the injected test client; the
    // stub is only touched when a test exercises the initDb(env.DB) path.
    DB: {} as D1Database,
    INTERNAL_SQL_SECRET: 'test-secret',
    API_VERSION: 'test',
  };
}

/** Seed a subscription + user + token row. Returns the subscriptionId. */
export async function seedToken(
  apiKey: string,
  opts: {
    role?: 'webhook' | 'consumer';
    rateLimit?: number;
    subscriptionId?: string;
    userId?: string;
    disabled?: number;
    userDisabled?: number;
    source?: string;
    signingSecret?: string | null;
    plan?: 'custom';
    consumeOnRead?: number;
    instructions?: string;
  } = {}
): Promise<{ subscriptionId: string; userId: string }> {
  const subscriptionId = opts.subscriptionId ?? 'sub_1';
  const userId = opts.userId ?? 'user_1';
  const role = opts.role ?? 'webhook';
  const rateLimit = opts.rateLimit ?? 10;
  const source = opts.source ?? 'custom';
  const signingSecret = opts.signingSecret ?? null;
  const plan = opts.plan ?? 'custom';
  const consumeOnRead = opts.consumeOnRead ?? 1;
  const now = Math.floor(Date.now() / 1000);

  await db.execute({
    sql: `INSERT INTO eg_users (id, email, provider, provider_id, is_admin, plan, disabled, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, `${userId}@example.com`, 'email', userId, 0, plan, opts.userDisabled ?? 0, now],
  });

  await db.execute({
    sql: `INSERT INTO eg_subscriptions (id, user_id, source, label, signing_secret, consume_on_read, instructions, created_at, disabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [subscriptionId, userId, source, null, signingSecret, consumeOnRead, opts.instructions ?? '', now, opts.disabled ?? 0],
  });

  await db.execute({
    sql: `INSERT INTO eg_tokens (id, user_id, subscription_id, role, label, api_key, rate_limit, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), userId, subscriptionId, role, null, apiKey, rateLimit, now],
  });

  return { subscriptionId, userId };
}

/** Compute the GitHub-style signature header for a body + secret. */
export function signGitHub(secret: string, rawBody: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Linear: hex HMAC-SHA256 over the raw body. */
export function signLinear(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Stripe: `t=<ts>,v1=<hex>` over `${ts}.${body}`. */
export function signStripe(secret: string, rawBody: string, ts: number): string {
  const v1 = createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex');
  return `t=${ts},v1=${v1}`;
}

/** Slack: `v0=<hex>` over `v0:${ts}:${body}`. */
export function signSlack(secret: string, rawBody: string, ts: number): string {
  const sig = createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`, 'utf8').digest('hex');
  return `v0=${sig}`;
}

/** Shopify: base64 HMAC-SHA256 over the raw body. */
export function signShopify(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
}

/** HubSpot v3: base64 HMAC-SHA256 over `${method}${uri}${body}${ts}` (ts in ms). */
export function signHubSpot(
  secret: string,
  method: string,
  url: string,
  rawBody: string,
  tsMs: number
): string {
  const signed = `${method}${normalizeHubSpotUri(url)}${rawBody}${tsMs}`;
  return createHmac('sha256', secret).update(signed, 'utf8').digest('base64');
}

/** Calendly: `t=<ts>,v1=<hex>` over `${ts}.${body}`. */
export function signCalendly(secret: string, rawBody: string, ts: number): string {
  const v1 = createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex');
  return `t=${ts},v1=${v1}`;
}

/** Typeform: `sha256=<base64>` over the raw body. */
export function signTypeform(secret: string, rawBody: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
}

/** Insert a pending event row directly. */
export async function seedEvent(
  subscriptionId: string,
  messageId: string,
  payload: unknown = {},
  timestamp = Date.now()
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO eg_events (id, subscription_id, payload, created_at)
          VALUES (?, ?, ?, ?)`,
    args: [messageId, subscriptionId, JSON.stringify(payload), timestamp],
  });
}

export function emptyCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

/** Build a fake libsql client that returns queued results in order. */
export function fakeClient(responses: Array<{ rows: Array<Record<string, unknown>> }>): Client {
  let index = 0;
  return {
    execute: async () => {
      const response = responses[index++] ?? { rows: [] };
      return response;
    },
  } as unknown as Client;
}
