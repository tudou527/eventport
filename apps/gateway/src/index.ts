/**
 * EventPort — Cloudflare Workers entry point.
 *
 * Storage: Cloudflare D1 (SQLite). All state (users, subscriptions, tokens,
 * events, rate limits) lives in one D1 database, accessed via the `DB` binding.
 *
 * Tables (see apps/gateway/schema.sql):
 *   users            — dashboard users (managed by site)
 *   subscriptions    — one per webhook source; holds source + signing_secret
 *   tokens           — two per subscription: egw_* (webhook) / egc_* (consumer)
 *   events           — one row per webhook event; deleted on pull (consume-on-read)
 *   rate_limits      — per (subscription, role, minute) counter
 *
 * Routes:
 *   POST /hooks/{apiKey} — Receive a webhook, store event in D1.
 *   GET  /events         — Poll for new events, delete on read (Authorization: Bearer {apiKey}).
 *   POST /tasks          — Submit a token-sharing task (Authorization: Bearer {egc_*}).
 *   GET  /tasks          — List available tasks, record viewer (Authorization: Bearer {egc_*}).
 *   PUT  /tasks/{id}     — Submit task execution result (Authorization: Bearer {egc_*}).
 *   POST /internal/sql   — SQL proxy for the site (Authorization: Bearer {INTERNAL_SQL_SECRET}).
 *   GET  /health         — Health check, returns { ok, version }.
 *
 * Scheduled (cron "0 * * * *"):
 *   - Hard-deletes events older than EVENT_TTL_SECONDS (replaces KV expirationTtl).
 *   - Cleans up stale rate_limits rows older than RATE_LIMIT_RETENTION_SECONDS.
 */

import { getVerifier } from './connectors';
import {
  CONSUMER_RATE_LIMIT_PER_MINUTE,
  getPlanLimits,
} from './plans';
import { json } from './utils/http';
import { renderInstructions } from './utils/template';
import { initEnv, appEnv, setAuth } from './utils/env';
import {
  initDb,
  dbExecute,
  dbBatch,
  resolveApiKey,
  isUserDisabled,
  isSubscriptionDisabled,
  isRateLimitExceeded,
  pushEvent,
  listEvents,
  countPendingEvents,
  recordRejectedEvent,
  cleanupExpiredData,
  countActiveUserTasks,
  createTask,
  listAvailableTasks,
  batchCountExecutors,
  recordExecutorView,
  getTask,
  hasExecutorClaim,
  countTaskExecutors,
  markTaskFull,
  type GatewayEvent,
  type DbStatement,
} from './db';

/** Worker environment bindings. Secrets are injected via `wrangler secret put`. */
export interface Env {
  /** D1 database binding (see wrangler.jsonc d1_databases). */
  DB: D1Database;
  /** Shared secret authorizing the site's /internal/sql proxy requests. */
  INTERNAL_SQL_SECRET?: string;
  /** API version string returned by the /health endpoint. */
  API_VERSION: string;
  /** Max parallel tasks per user. Defaults to 3. */
  MAX_TASKS_PER_USER?: string;
  /** Max executors that can claim a single task. Defaults to 3. */
  MAX_EXECUTORS_PER_TASK?: string;
  /** Token-sharing task TTL in seconds. Defaults to 3 days. */
  DEFAULT_TASK_TTL_SECONDS?: string;
}


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { method, url } = request;
    const { pathname } = new URL(url);
    initEnv(env);
    initDb(env.DB);

    try {
      if (method === 'GET' && pathname === '/health') {
        return json({ ok: true, version: appEnv.apiVersion });
      }

      // Internal SQL proxy for the site — authenticated by shared secret,
      // not by API key, so it must be handled before the auth block below.
      if (method === 'POST' && pathname === '/internal/sql') {
        return await handleInternalSql(request);
      }

      // Auth: extract token, resolve key, check disabled, rate limit.
      const auth = request.headers.get('Authorization') ?? '';
      const match = auth.match(/^Bearer\s+(.+)$/i);
      let apiKey = match ? match[1] : null;

      if (!apiKey && method === 'POST' && pathname.startsWith('/hooks/')) {
        apiKey = decodeURIComponent(pathname.slice('/hooks/'.length));
      }

      if (!apiKey) {
        return json({ error: 'Missing API key' }, 401);
      }

      const resolved = await resolveApiKey(apiKey);
      if (!resolved) {
        return json({ error: 'Unauthorized' }, 401);
      }

      setAuth(resolved);

      if (await isUserDisabled(resolved.userId)) {
        return json({ error: 'User disabled' }, 403);
      }

      if (await isSubscriptionDisabled(resolved.subscriptionId)) {
        return json({ error: 'Subscription disabled' }, 403);
      }

      // Consumer rate limit only — webhook role has its own per-plan limit in handleWebhook.
      if (resolved.role === 'consumer') {
        const exceeded = await isRateLimitExceeded(resolved.subscriptionId, resolved.role, CONSUMER_RATE_LIMIT_PER_MINUTE);
        if (exceeded) {
          return json({ error: 'Rate limit exceeded' }, 429);
        }
      }

      if (method === 'POST' && pathname.startsWith('/hooks/')) {
        if (resolved.role !== 'webhook') {
          return json({ error: 'Forbidden' }, 403);
        }
        return await handleWebhook(request);
      }

      if (resolved.role !== 'consumer') {
        return json({ error: 'Forbidden' }, 403);
      }

      if (method === 'GET' && pathname === '/events') {
        return await handlePoll(request);
      }

      if (method === 'POST' && pathname === '/tasks') {
        return await handleCreateTask(request);
      }
      if (method === 'GET' && pathname === '/tasks') {
        return await handleListTasks(request);
      }
      if (method === 'PUT' && pathname.startsWith('/tasks/')) {
        const taskId = pathname.slice('/tasks/'.length);
        return await handlePutTaskResult(request, taskId);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return json({ error: message }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    initEnv(env);
    initDb(env.DB);
    ctx.waitUntil(cleanupExpiredData());
  },
};

/** Constant-time string comparison — avoids leaking secret length/prefix via timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

/**
 * POST /internal/sql — SQL proxy for the site (Vercel has no D1 binding).
 * Body: { mode: 'query' | 'execute' | 'batch', statements: [{ sql, args }] }.
 * query/execute run statements[0]; batch runs all atomically via D1 batch.
 */
async function handleInternalSql(request: Request): Promise<Response> {
  const secret = appEnv.internalSqlSecret;
  const auth = request.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!secret || !match || !timingSafeEqualStr(match[1], secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: { mode?: unknown; statements?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const rawStatements = Array.isArray(body.statements) ? body.statements : [];
  const statements: DbStatement[] = [];
  for (const s of rawStatements) {
    if (!s || typeof s.sql !== 'string' || !s.sql) {
      return json({ error: 'Invalid statement' }, 400);
    }
    statements.push({ sql: s.sql, args: Array.isArray(s.args) ? s.args : [] });
  }
  if (statements.length === 0) {
    return json({ error: 'Missing statements' }, 400);
  }

  if (body.mode === 'batch') {
    await dbBatch(statements);
    return json({ ok: true });
  }
  if (body.mode === 'query') {
    const result = await dbExecute(statements[0]);
    return json({ rows: result.rows });
  }
  if (body.mode === 'execute') {
    const result = await dbExecute(statements[0]);
    return json({ rowsAffected: result.rowsAffected });
  }
  return json({ error: 'Invalid mode' }, 400);
}

/** POST /hooks/{apiKey} — receive a webhook and store the event. */
async function handleWebhook(request: Request): Promise<Response> {
  const { subscriptionId, role, source, signingSecret, plan } = appEnv.auth!;
  const limits = getPlanLimits(plan);

  // Webhook rate limit: 20/min per subscription (custom plan).
  if (limits.webhookRateLimitPerMinute !== null) {
    if (await isRateLimitExceeded(subscriptionId, role, limits.webhookRateLimitPerMinute)) {
      return json({ error: 'Rate limit exceeded' }, 429);
    }
  }

  // Read the raw body once — signature verification must use the exact bytes
  // the upstream sent, so we cannot use request.json() (which would discard
  // the raw string). We re-parse the JSON after verification succeeds.
  const rawBody = await request.text();

  // Signature verification. Sources with a registered verifier (github,
  // linear, ...) MUST pass verification; sources without a verifier (custom,
  // or unregistered) skip verification and accept the event as-is.
  const verifier = getVerifier(source);
  if (verifier) {
    const result = await verifier.verify({
      secret: signingSecret,
      rawBody,
      headers: request.headers,
      // Some providers (HubSpot v3) include the URL and HTTP method in the
      // signed payload, so we forward the full request URL and method.
      url: request.url,
      method: request.method,
    });
    if (!result.valid) {
      return json({ error: 'Invalid signature', reason: result.reason }, 401);
    }
  }

  // Backlog protection: reject new events when unacked count exceeds the
  // plan's maxBacklog. Record the rejection so the dashboard can surface it.
  if (limits.maxBacklog !== null) {
    const pending = await countPendingEvents(subscriptionId);
    if (pending >= limits.maxBacklog) {
      await recordRejectedEvent(subscriptionId);
      return json({ error: 'Backlog limit exceeded', pending, limit: limits.maxBacklog }, 429);
    }
  }

  let bodyPayload: unknown;
  try {
    bodyPayload = JSON.parse(rawBody);
  } catch {
    // Not JSON — accept anyway so non-JSON payloads (rare, but possible) still
    // flow through. The consumer can decide what to do with them.
    bodyPayload = { raw: rawBody };
  }

  const messageId = crypto.randomUUID();
  const event: GatewayEvent = {
    subscriptionId,
    messageId,
    payload: bodyPayload,
    timestamp: Date.now(),
  };

  await pushEvent(event);

  return json({ ok: true, messageId: event.messageId });
}

/** GET /events — poll for unacknowledged events. */
async function handlePoll(request: Request): Promise<Response> {
  const { subscriptionId, consumeOnRead, instructions } = appEnv.auth!;
  const url = new URL(request.url);
  const lastId = url.searchParams.get('messageId');
  // Consumers can use ?limit=N to control fetch batch size (1-100, default 100).
  // Use limit=1 for serial processing; increase for parallel consumption.
  const limitParam = url.searchParams.get('limit');
  let limit = 100;
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10);
    if (Number.isFinite(parsed)) {
      limit = Math.min(Math.max(1, parsed), 100);
    }
  }
  const events = await listEvents(subscriptionId, lastId, limit, consumeOnRead);

  if (events.length > 0) {
    return json({
      events: events.map((e) => ({
        messageId: e.messageId,
        payload: e.payload,
        timestamp: e.timestamp,
        // Rendered only when the subscription configured an instruction
        // template; adapters pass it to the agent as-is when present.
        ...(instructions ? { text: renderInstructions(instructions, e) } : {}),
      })),
      cursor: events[events.length - 1].messageId,
    });
  }

  return json({ events: [], cursor: lastId });
}

/** POST /tasks — submit a new task to the token-sharing queue. */
async function handleCreateTask(
  request: Request
): Promise<Response> {
  const { source, userId, subscriptionId } = appEnv.auth!;
  if (source !== 'token_sharing') {
    return json({ error: 'A token_sharing subscription is required to submit tasks' }, 403);
  }

  // Enforce max parallel tasks per user.
  const now = Date.now();
  const active = await countActiveUserTasks(userId, now);
  if (active >= appEnv.maxTasksPerUser) {
    return json({ error: 'Too many active tasks', limit: appEnv.maxTasksPerUser }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return json({ error: 'Missing name' }, 400);
  }
  const description = typeof body.description === 'string' ? body.description : null;
  if (typeof body.model !== 'string' || !body.model) {
    return json({ error: 'Missing model' }, 400);
  }
  if (typeof body.prompt !== 'string' || !body.prompt) {
    return json({ error: 'Missing prompt' }, 400);
  }

  const { name: _n, description: _d, ...payloadFields } = body;
  const idChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const idArr = crypto.getRandomValues(new Uint8Array(12));
  let idStr = '';
  for (let i = 0; i < 12; i++) {
    idStr += idChars[idArr[i] % idChars.length];
  }
  const taskId = `task_${idStr}`;
  const expiresAt = now + appEnv.taskTtlSeconds * 1000;

  await createTask(taskId, subscriptionId, userId, name, description, payloadFields, now, expiresAt);

  return json({ ok: true, taskId }, 201);
}

/** GET /tasks — list available tasks, record the caller's view. */
async function handleListTasks(
  request: Request
): Promise<Response> {
  const { userId } = appEnv.auth!;
  const now = Date.now();
  const url = new URL(request.url);
  const cursor = url.searchParams.get('taskId');
  const limitParam = url.searchParams.get('limit');
  let limit = 100;
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10);
    if (Number.isFinite(parsed)) {
      limit = Math.min(Math.max(1, parsed), 100);
    }
  }

  const taskRows = await listAvailableTasks(cursor, limit, now);
  const tasks = taskRows.rows;

  // Fetch executor counts for all returned tasks in one query.
  const ids = tasks.map((t) => String(t.id));
  const countMap = await batchCountExecutors(ids);

  const tasksWithCounts: Array<{
    id: string;
    name: string;
    description: string | null;
    payload: unknown;
    createdAt: number;
    expiresAt: number;
    executorCount: number;
  }> = [];

  for (const task of tasks) {
    const id = String(task.id);
    const executorCount = countMap.get(id) ?? 0;
    if (executorCount >= appEnv.maxExecutorsPerTask) {
      continue;
    }
    tasksWithCounts.push({
      id,
      name: String(task.name),
      description: task.description == null ? null : String(task.description),
      payload: typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload,
      createdAt: Number(task.created_at),
      expiresAt: Number(task.expires_at),
      executorCount,
    });
  }

  // Record view for each task the caller sees.
  for (const task of tasksWithCounts) {
    await recordExecutorView(task.id, userId, now);
  }

  const lastCursor = tasksWithCounts.length > 0
    ? tasksWithCounts[tasksWithCounts.length - 1].id
    : (cursor ?? undefined);

  return json({ tasks: tasksWithCounts, cursor: lastCursor });
}

/** PUT /tasks/{taskId} — submit execution result for a task. */
async function handlePutTaskResult(
  request: Request,
  taskId: string
): Promise<Response> {
  const { userId } = appEnv.auth!;
  if (!taskId) {
    return json({ error: 'Missing task ID' }, 400);
  }

  const now = Date.now();

  // Look up the task.
  const task = await getTask(taskId);
  if (!task) {
    return json({ error: 'Task not found' }, 404);
  }

  if (String(task.status) !== 'pending') {
    return json({ error: 'Task is no longer accepting results' }, 409);
  }

  if (Number(task.expires_at) <= now) {
    return json({ error: 'Task has expired' }, 409);
  }

  // Executor must have viewed/claimed the task via GET /tasks first.
  if (!(await hasExecutorClaim(taskId, userId))) {
    return json({ error: 'You must claim the task via GET /tasks before submitting a result' }, 403);
  }

  // Enforce max executors.
  const executorCount = await countTaskExecutors(taskId);
  /* c8 ignore start */
  if (executorCount > appEnv.maxExecutorsPerTask) {
    return json({ error: 'Task already has maximum executors' }, 409);
  }
  /* c8 ignore stop */

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Mark task as full if at max executors.
  if (executorCount >= appEnv.maxExecutorsPerTask) {
    await markTaskFull(taskId);
  }

  // Write the result as an event under the originator's subscription.
  const originatorSubscriptionId = String(task.subscription_id);
  const resultEvent: GatewayEvent = {
    subscriptionId: originatorSubscriptionId,
    messageId: crypto.randomUUID(),
    payload: {
      taskId,
      executorId: userId,
      result: body,
    },
    timestamp: now,
  };
  await pushEvent(resultEvent);

  return json({ ok: true, messageId: resultEvent.messageId });
}
