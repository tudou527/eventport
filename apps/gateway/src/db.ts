/**
 * Database access layer — all SQL and D1 client management lives here.
 *
 * Usage:
 *   - Production: call `initDb(env.DB)` at the top of fetch() — wraps the D1 binding.
 *   - Tests: call `__setTestClient(client)` to inject an in-memory libsql client.
 *   - All SQL functions use the module-level client internally — no `db` parameter needed.
 */

import { type ApiKeyMetadata } from './utils/env';
import {
  PLANS,
  REJECTED_EVENTS_RETENTION_SECONDS,
  normalizePlan,
} from './plans';

/** Internal event representation. */
export interface GatewayEvent {
  subscriptionId: string;
  messageId: string;
  payload: unknown;
  timestamp: number;
}

/** Re-export for convenience — canonical definition lives in utils/env.ts. */
export type { ApiKeyMetadata };

/** A single parameterized SQL statement. */
export interface DbStatement {
  sql: string;
  args: unknown[];
}

/** Result shape shared by the D1 adapter and the libsql test client. */
export interface DbResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

/**
 * Minimal database client interface — libsql-Client-shaped so tests can keep
 * injecting an in-memory `@libsql/client` instance, while production wraps
 * the D1 binding behind the same `execute({ sql, args })` call style.
 */
export interface DbClient {
  execute(stmt: DbStatement): Promise<DbResult>;
  batch(stmts: DbStatement[], mode?: 'write'): Promise<unknown>;
}

/** Rate-limit counters are kept for 2 hours (last 120 minute buckets). */
const RATE_LIMIT_RETENTION_SECONDS = 60 * 60 * 2;

/** Module-level database client. Set by initDb() in production, __setTestClient() in tests. */
let db: DbClient;
let testClient: DbClient | null = null;

/** Wrap a D1 binding in the libsql-shaped DbClient interface. */
function d1Adapter(d1: D1Database): DbClient {
  return {
    async execute({ sql, args }) {
      const result = await d1.prepare(sql).bind(...args).all();
      return {
        rows: (result.results ?? []) as Record<string, unknown>[],
        rowsAffected: result.meta?.changes ?? 0,
      };
    },
    async batch(stmts) {
      // D1 batch runs as an implicit transaction.
      await d1.batch(stmts.map((s) => d1.prepare(s.sql).bind(...s.args)));
    },
  };
}

/** Create the DbClient from the D1 binding. Skipped when a test client is already injected. */
export function initDb(d1: D1Database): void {
  if (testClient) {
    return;
  }
  db = d1Adapter(d1);
}

/** Test-only hook: inject a shared in-memory client for unit tests. */
export function __setTestClient(client: unknown): void {
  testClient = client as DbClient | null;
  db = client as DbClient;
}

/** Run a single statement against the active client. Used by /internal/sql. */
export function dbExecute(stmt: DbStatement): Promise<DbResult> {
  return db.execute(stmt);
}

/** Run multiple statements atomically. Used by /internal/sql batch mode. */
export async function dbBatch(stmts: DbStatement[]): Promise<void> {
  await db.batch(stmts, 'write');
}

/** Resolve an API key to its subscription metadata. Returns null if invalid. */
export async function resolveApiKey(apiKey: string): Promise<ApiKeyMetadata | null> {
  const row = await db.execute({
    sql: `SELECT t.subscription_id AS subscriptionId, t.user_id AS userId,
                 t.role AS role,
                 s.source AS source, s.signing_secret AS signingSecret,
                 s.consume_on_read AS consumeOnRead,
                 s.instructions AS instructions,
                 u.plan AS plan
          FROM eg_tokens t
          JOIN eg_subscriptions s ON s.id = t.subscription_id
          JOIN eg_users u ON u.id = t.user_id
          WHERE t.api_key = ? AND t.revoked_at IS NULL`,
    args: [apiKey],
  });

  const first = row.rows[0];
  if (!first) {
    return null;
  }

  return {
    subscriptionId: String(first.subscriptionId),
    userId: String(first.userId),
    plan: normalizePlan(first.plan),
    role: first.role === 'webhook' || first.role === 'consumer' ? first.role : 'webhook',
    source: String(first.source ?? 'custom'),
    signingSecret: first.signingSecret == null ? null : String(first.signingSecret),
    consumeOnRead: first.consumeOnRead == null ? true : first.consumeOnRead === 1,
    instructions: first.instructions == null ? '' : String(first.instructions),
  };
}

/** Check whether a user has been disabled. */
export async function isUserDisabled(userId: string): Promise<boolean> {
  const row = await db.execute({
    sql: 'SELECT disabled FROM eg_users WHERE id = ?',
    args: [userId],
  });
  const first = row.rows[0];
  return first?.disabled === 1;
}

/** Check whether a subscription has been disabled (subscription-level kill switch). */
export async function isSubscriptionDisabled(subscriptionId: string): Promise<boolean> {
  const row = await db.execute({
    sql: 'SELECT disabled FROM eg_subscriptions WHERE id = ?',
    args: [subscriptionId],
  });
  const first = row.rows[0];
  return first?.disabled === 1;
}

/**
 * Increment the per-token rate-limit counter and return whether the limit is exceeded.
 * Uses `INSERT ... ON CONFLICT DO UPDATE` for atomicity.
 */
export async function isRateLimitExceeded(
  subscriptionId: string,
  role: string,
  limit: number
): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);

  const row = await db.execute({
    sql: `INSERT INTO eg_rate_limits (subscription_id, role, minute, count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(subscription_id, role, minute) DO UPDATE SET count = count + 1
          RETURNING count`,
    args: [subscriptionId, role, minute],
  });

  const first = row.rows[0];
  if (!first) {
    return true;
  }
  return Number(first.count) > limit;
}

/** Insert a new event row. */
export async function pushEvent(event: GatewayEvent): Promise<void> {
  await db.execute({
    sql: `INSERT INTO eg_events (id, subscription_id, payload, created_at)
          VALUES (?, ?, ?, ?)`,
    args: [event.messageId, event.subscriptionId, JSON.stringify(event.payload), event.timestamp],
  });
}

/**
 * Pull events for a subscription (cursor-based pagination).
 * When consumeOnRead is true (default), events are deleted on read.
 * When false, events persist (e.g. for game replay / multi-consumer scenarios).
 */
export async function listEvents(
  subscriptionId: string,
  afterId: string | null,
  limit = 100,
  consumeOnRead = true
): Promise<GatewayEvent[]> {
  const rows = afterId
    ? await db.execute({
      sql: `SELECT id, payload, created_at
              FROM eg_events
              WHERE subscription_id = ?
                AND (created_at, id) > (
                  SELECT created_at, id FROM eg_events WHERE id = ?
                )
              ORDER BY created_at ASC, id ASC
              LIMIT ?`,
      args: [subscriptionId, afterId, limit],
    })
    : await db.execute({
      sql: `SELECT id, payload, created_at
              FROM eg_events
              WHERE subscription_id = ?
              ORDER BY created_at ASC, id ASC
              LIMIT ?`,
      args: [subscriptionId, limit],
    });

  const events = rows.rows.map(rowToGatewayEvent(subscriptionId));

  // Delete the rows we just returned only when consumeOnRead is enabled.
  if (consumeOnRead && events.length > 0) {
    const ids = events.map((e) => e.messageId);
    const placeholders = ids.map(() => '?').join(', ');
    await db.execute({
      sql: `DELETE FROM eg_events WHERE subscription_id = ? AND id IN (${placeholders})`,
      args: [subscriptionId, ...ids],
    });
  }

  return events;
}

/** Map a libsql row to a GatewayEvent. */
function rowToGatewayEvent(subscriptionId: string) {
  return (row: Record<string, unknown>): GatewayEvent => {
    const payload =
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return {
      subscriptionId,
      messageId: String(row.id),
      payload,
      timestamp: Number(row.created_at),
    };
  };
}

/** Count pending events for a subscription (used for backlog protection). */
export async function countPendingEvents(subscriptionId: string): Promise<number> {
  const row = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM eg_events WHERE subscription_id = ?`,
    args: [subscriptionId],
  });
  return Number(row.rows[0]?.n ?? 0);
}

/**
 * Record a rejected event (maxBacklog exceeded) by incrementing the per-hour
 * counter. Used by the dashboard to show users their real traffic volume.
 */
export async function recordRejectedEvent(subscriptionId: string): Promise<void> {
  const hour = Math.floor(Date.now() / (60 * 60 * 1000)) * (60 * 60);
  await db.execute({
    sql: `INSERT INTO eg_rejected_events_hourly (subscription_id, hour, count)
          VALUES (?, ?, 1)
          ON CONFLICT(subscription_id, hour) DO UPDATE SET count = count + 1`,
    args: [subscriptionId, hour],
  });
}

/**
 * Hard-delete expired events and stale counters.
 *
 * Events TTL is 15 minutes (custom plan), so we delete events whose created_at
 * is older than the cutoff.
 *
 * Also cleans up stale rate-limit counters and old rejected-event hourly stats.
 */
export async function cleanupExpiredData(): Promise<void> {
  const now = Date.now();
  const rlCutoff = Math.floor((now - RATE_LIMIT_RETENTION_SECONDS * 1000) / 60_000);
  const rejectedCutoff = Math.floor((now - REJECTED_EVENTS_RETENTION_SECONDS * 1000) / 1000);

  const eventCutoff = now - PLANS.custom.eventTtlSeconds * 1000;
  await db.execute({
    sql: 'DELETE FROM eg_events WHERE created_at < ?',
    args: [eventCutoff],
  });

  await db.execute({
    sql: 'DELETE FROM eg_rate_limits WHERE minute < ?',
    args: [rlCutoff],
  });
  await db.execute({
    sql: 'DELETE FROM eg_rejected_events_hourly WHERE hour < ?',
    args: [rejectedCutoff],
  });

  await db.execute({
    sql: 'DELETE FROM eg_task_executors WHERE task_id IN (SELECT id FROM eg_tasks WHERE expires_at < ?)',
    args: [now],
  });
  await db.execute({
    sql: 'DELETE FROM eg_tasks WHERE expires_at < ?',
    args: [now],
  });
}

/** Count a user's active (pending + not expired) tasks. */
export async function countActiveUserTasks(userId: string, now: number): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM eg_tasks
          WHERE user_id = ? AND status = 'pending' AND expires_at > ?`,
    args: [userId, now],
  });
  /* c8 ignore next */
  return Number(result.rows[0]?.n ?? 0);
}

/** Insert a new task row. */
export async function createTask(
  taskId: string,
  subscriptionId: string,
  userId: string,
  name: string,
  description: string | null,
  payload: unknown,
  now: number,
  expiresAt: number
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO eg_tasks (id, subscription_id, user_id, name, description, payload, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [taskId, subscriptionId, userId, name, description, JSON.stringify(payload), now, expiresAt],
  });
}

/**
 * List available tasks (pending + not expired) with cursor-based pagination.
 * Returns raw libsql rows; the caller handles field casting and JSON parsing.
 */
export async function listAvailableTasks(cursor: string | null, limit: number, now: number) {
  if (cursor) {
    return db.execute({
      sql: `SELECT id, name, description, payload, created_at, expires_at
            FROM eg_tasks
            WHERE status = 'pending' AND expires_at > ?
              AND (created_at, id) > (
                SELECT created_at, id FROM eg_tasks WHERE id = ?
              )
            ORDER BY created_at ASC, id ASC
            LIMIT ?`,
      args: [now, cursor, limit],
    });
  }
  return db.execute({
    sql: `SELECT id, name, description, payload, created_at, expires_at
          FROM eg_tasks
          WHERE status = 'pending' AND expires_at > ?
          ORDER BY created_at ASC, id ASC
          LIMIT ?`,
    args: [now, limit],
  });
}

/** Batch-count executors for a list of task IDs. Returns taskId → count. */
export async function batchCountExecutors(taskIds: string[]): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();
  if (taskIds.length === 0) {
    return countMap;
  }
  const placeholders = taskIds.map(() => '?').join(', ');
  const countRows = await db.execute({
    sql: `SELECT task_id, COUNT(*) AS n FROM eg_task_executors
          WHERE task_id IN (${placeholders})
          GROUP BY task_id`,
    args: taskIds,
  });
  for (const row of countRows.rows) {
    countMap.set(String(row.task_id), Number(row.n));
  }
  return countMap;
}

/** Record the caller's view of a task (INSERT OR IGNORE). */
export async function recordExecutorView(taskId: string, userId: string, now: number): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO eg_task_executors (task_id, executor_id, created_at)
          VALUES (?, ?, ?)`,
    args: [taskId, userId, now],
  });
}

/** Fetch a task row by ID. Returns null if not found. */
export async function getTask(taskId: string) {
  const rows = await db.execute({
    sql: `SELECT id, subscription_id, user_id, payload, status, expires_at
          FROM eg_tasks WHERE id = ?`,
    args: [taskId],
  });
  return rows.rows[0] ?? null;
}

/** Check whether an executor has claimed a task via GET /tasks. */
export async function hasExecutorClaim(taskId: string, userId: string): Promise<boolean> {
  const row = await db.execute({
    sql: `SELECT executor_id FROM eg_task_executors
          WHERE task_id = ? AND executor_id = ?`,
    args: [taskId, userId],
  });
  return !!row.rows[0];
}

/** Count total executors for a task. */
export async function countTaskExecutors(taskId: string): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM eg_task_executors WHERE task_id = ?`,
    args: [taskId],
  });
  /* c8 ignore next */
  return Number(result.rows[0]?.n ?? 0);
}

/** Mark a task as full (no longer accepting results). */
export async function markTaskFull(taskId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE eg_tasks SET status = 'full' WHERE id = ?`,
    args: [taskId],
  });
}
