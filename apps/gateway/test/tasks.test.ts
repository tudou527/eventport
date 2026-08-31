import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import { ENV_DEFAULTS } from '../src/utils/env';
import { __setTestClient, cleanupExpiredData } from '../src/db';
import { db, setupTestDb, createEnv, seedToken, emptyCtx } from './utils';

beforeEach(setupTestDb);

const TASK_BODY = { name: 'Translate doc', model: 'gpt-4o', prompt: 'Translate this' };

function authHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

async function postTask(apiKey: string, body: Record<string, unknown> = TASK_BODY, env?: ReturnType<typeof createEnv>) {
  return worker.fetch(
    new Request('http://localhost/tasks', {
      method: 'POST',
      headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env ?? createEnv(),
    emptyCtx()
  );
}

async function getTasks(apiKey: string) {
  return worker.fetch(
    new Request('http://localhost/tasks', { headers: authHeaders(apiKey) }),
    createEnv(),
    emptyCtx()
  );
}

async function putTaskResult(apiKey: string, taskId: string, body: Record<string, unknown> = { output: 'done' }) {
  return worker.fetch(
    new Request(`http://localhost/tasks/${taskId}`, {
      method: 'PUT',
      headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    createEnv(),
    emptyCtx()
  );
}

/** Seed a token_sharing subscription with a consumer token. */
async function seedTokenSharingUser(
  apiKey: string,
  opts: { userId?: string; subscriptionId?: string } = {}
) {
  return seedToken(apiKey, {
    role: 'consumer',
    source: 'token_sharing',
    userId: opts.userId,
    subscriptionId: opts.subscriptionId,
  });
}

// POST /tasks
describe('POST /tasks', () => {
  it('returns 401 without API key', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/tasks', { method: 'POST', body: '{}' }),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid API key', async () => {
    const res = await postTask('egc_invalid');
    expect(res.status).toBe(401);
  });

  it('returns 403 with webhook token', async () => {
    await seedToken('egw_webhook', { role: 'webhook', source: 'token_sharing' });
    const res = await postTask('egw_webhook');
    expect(res.status).toBe(403);
  });

  it('returns 403 for disabled user', async () => {
    await seedTokenSharingUser('egc_disabled', { userId: 'u_disabled' });
    await db.execute({ sql: 'UPDATE eg_users SET disabled = 1 WHERE id = ?', args: ['u_disabled'] });
    const res = await postTask('egc_disabled');
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-token_sharing subscription', async () => {
    await seedToken('egc_custom', { role: 'consumer', source: 'custom' });
    const res = await postTask('egc_custom');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('token_sharing');
  });

  it('returns 400 when name is missing', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await postTask('egc_a', { model: 'gpt-4o', prompt: 'hi' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when model is missing', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await postTask('egc_a', { name: 'Test', prompt: 'hi' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when prompt is missing', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await postTask('egc_a', { name: 'Test', model: 'gpt-4o' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await worker.fetch(
      new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { ...authHeaders('egc_a'), 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(400);
  });

  it('creates a task successfully', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await postTask('egc_a');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.taskId).toMatch(/^task_/);
  });

  it('stores description as null when omitted', async () => {
    await seedTokenSharingUser('egc_a');
    await postTask('egc_a', { name: 'No desc', model: 'gpt-4o', prompt: 'hi' });
    const row = await db.execute({ sql: 'SELECT description FROM eg_tasks WHERE user_id = ?', args: ['user_1'] });
    expect(row.rows[0]?.description).toBeNull();
  });

  it('stores description when provided', async () => {
    await seedTokenSharingUser('egc_a');
    await postTask('egc_a', { name: 'With desc', description: 'A test', model: 'gpt-4o', prompt: 'hi' });
    const row = await db.execute({ sql: 'SELECT description FROM eg_tasks WHERE user_id = ?', args: ['user_1'] });
    expect(row.rows[0]?.description).toBe('A test');
  });

  it('rejects when user has too many active tasks', async () => {
    await seedTokenSharingUser('egc_a');
    for (let i = 0; i < ENV_DEFAULTS.maxTasksPerUser; i++) {
      const res = await postTask('egc_a', { ...TASK_BODY, name: `Task ${i}` });
      expect(res.status).toBe(201);
    }
    const res = await postTask('egc_a', { ...TASK_BODY, name: 'One too many' });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.limit).toBe(ENV_DEFAULTS.maxTasksPerUser);
  });

  it('allows new tasks after old ones expire', async () => {
    await seedTokenSharingUser('egc_a');
    for (let i = 0; i < ENV_DEFAULTS.maxTasksPerUser; i++) {
      await postTask('egc_a', { ...TASK_BODY, name: `Task ${i}` });
    }
    // Expire all tasks by setting expires_at to the past.
    await db.execute({ sql: 'UPDATE eg_tasks SET expires_at = 1' });
    const res = await postTask('egc_a', { ...TASK_BODY, name: 'After expiry' });
    expect(res.status).toBe(201);
  });

  it('respects DEFAULT_TASK_TTL_SECONDS env', async () => {
    await seedTokenSharingUser('egc_a');
    const env = createEnv();
    const customTtl = 3600;
    const before = Date.now();
    await postTask('egc_a', TASK_BODY, { ...env, DEFAULT_TASK_TTL_SECONDS: String(customTtl) });
    const row = await db.execute({ sql: 'SELECT expires_at, created_at FROM eg_tasks WHERE user_id = ?', args: ['user_1'] });
    const expiresAt = Number(row.rows[0]?.expires_at);
    const createdAt = Number(row.rows[0]?.created_at);
    const ttlMs = expiresAt - createdAt;
    // TTL should be approximately customTtl * 1000 (within 1s tolerance).
    expect(ttlMs).toBeGreaterThanOrEqual(customTtl * 1000 - 1000);
    expect(ttlMs).toBeLessThanOrEqual(customTtl * 1000 + 1000);
  });

  it('strips name and description from payload', async () => {
    await seedTokenSharingUser('egc_a');
    await postTask('egc_a', { name: 'T', description: 'D', model: 'gpt-4o', prompt: 'hi', temperature: 0.5 });
    const row = await db.execute({ sql: 'SELECT payload FROM eg_tasks WHERE user_id = ?', args: ['user_1'] });
    const payload = JSON.parse(String(row.rows[0]?.payload));
    expect(payload).toEqual({ model: 'gpt-4o', prompt: 'hi', temperature: 0.5 });
    expect(payload.name).toBeUndefined();
    expect(payload.description).toBeUndefined();
  });
});

// GET /tasks
describe('GET /tasks', () => {
  it('returns 401 without API key', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/tasks'),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid API key', async () => {
    const res = await getTasks('egc_invalid');
    expect(res.status).toBe(401);
  });

  it('returns 403 with webhook token', async () => {
    await seedToken('egw_webhook', { role: 'webhook', source: 'token_sharing' });
    const res = await getTasks('egw_webhook');
    expect(res.status).toBe(403);
  });

  it('returns 403 for disabled user', async () => {
    await seedTokenSharingUser('egc_disabled', { userId: 'u_disabled' });
    await db.execute({ sql: 'UPDATE eg_users SET disabled = 1 WHERE id = ?', args: ['u_disabled'] });
    const res = await getTasks('egc_disabled');
    expect(res.status).toBe(403);
  });

  it('returns empty array when no tasks exist', async () => {
    await seedTokenSharingUser('egc_a');
    const res = await getTasks('egc_a');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toEqual([]);
    expect(body.cursor).toBeUndefined();
  });

  it('returns available tasks with executor counts', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'Task A', model: 'gpt-4o', prompt: 'do A' });
    await postTask('egc_origin', { name: 'Task B', model: 'gpt-4o', prompt: 'do B' });

    // Ensure deterministic ordering: tasks created in the same millisecond
    // have random IDs, so set distinct created_at values explicitly.
    await db.execute({
      sql: "UPDATE eg_tasks SET created_at = 1000 WHERE name = 'Task A'",
    });
    await db.execute({
      sql: "UPDATE eg_tasks SET created_at = 2000 WHERE name = 'Task B'",
    });

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await getTasks('egc_exec');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
    expect(body.tasks[0].name).toBe('Task A');
    expect(body.tasks[0].executorCount).toBe(0);
    expect(body.tasks[0].payload).toEqual({ model: 'gpt-4o', prompt: 'do A' });
  });

  it('filters out expired tasks', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'Expired', model: 'gpt-4o', prompt: 'old' });
    // Set expires_at to the past.
    await db.execute({ sql: 'UPDATE eg_tasks SET expires_at = 1' });

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await getTasks('egc_exec');
    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
  });

  it('filters out full tasks', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'Full', model: 'gpt-4o', prompt: 'full' });
    // Mark the task as full.
    await db.execute({ sql: "UPDATE eg_tasks SET status = 'full'" });

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await getTasks('egc_exec');
    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
  });

  it('records the executor view in eg_task_executors', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'View me', model: 'gpt-4o', prompt: 'look' });

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    await getTasks('egc_exec');

    const rows = await db.execute({ sql: 'SELECT executor_id FROM eg_task_executors' });
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.executor_id).toBe('u_exec');
  });

  it('hides tasks that already have max executors', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'Maxed', model: 'gpt-4o', prompt: 'max' });

    // Pre-seed max executors (must seed users first for FK).
    const taskRow = await db.execute({ sql: 'SELECT id FROM eg_tasks LIMIT 1' });
    const taskId = String(taskRow.rows[0]?.id);
    const now = Date.now();
    for (let i = 0; i < ENV_DEFAULTS.maxExecutorsPerTask; i++) {
      await db.execute({
        sql: `INSERT INTO eg_users (id, email, provider, provider_id, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [`exec_${i}`, `exec_${i}@test.com`, 'email', `exec_${i}`, 'custom', now],
      });
      await db.execute({
        sql: 'INSERT INTO eg_task_executors (task_id, executor_id, created_at) VALUES (?, ?, ?)',
        args: [taskId, `exec_${i}`, now],
      });
    }

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await getTasks('egc_exec');
    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
  });

  it('respects ?limit= parameter', async () => {
    await seedTokenSharingUser('egc_origin');
    for (let i = 0; i < 5; i++) {
      await postTask('egc_origin', { name: `Task ${i}`, model: 'gpt-4o', prompt: `do ${i}` });
    }

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await worker.fetch(
      new Request('http://localhost/tasks?limit=2', { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
    expect(body.cursor).toBeDefined();
  });

  it('supports cursor-based pagination via ?taskId=', async () => {
    await seedTokenSharingUser('egc_origin');
    for (let i = 0; i < 3; i++) {
      await postTask('egc_origin', { name: `Task ${i}`, model: 'gpt-4o', prompt: `do ${i}` });
    }

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });

    // First page: limit=1.
    const page1Res = await worker.fetch(
      new Request('http://localhost/tasks?limit=1', { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const page1 = await page1Res.json();
    expect(page1.tasks).toHaveLength(1);
    expect(page1.cursor).toBeDefined();

    // Second page using cursor: returns a different task.
    const page2Res = await worker.fetch(
      new Request(`http://localhost/tasks?limit=1&taskId=${page1.cursor}`, { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const page2 = await page2Res.json();
    expect(page2.tasks).toHaveLength(1);
    expect(page2.tasks[0].id).not.toBe(page1.tasks[0].id);

    // Third page: one more task left.
    const page3Res = await worker.fetch(
      new Request(`http://localhost/tasks?limit=1&taskId=${page2.cursor}`, { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const page3 = await page3Res.json();
    expect(page3.tasks).toHaveLength(1);
    expect(page3.tasks[0].id).not.toBe(page1.tasks[0].id);
    expect(page3.tasks[0].id).not.toBe(page2.tasks[0].id);

    // Fourth page: no more tasks.
    const page4Res = await worker.fetch(
      new Request(`http://localhost/tasks?limit=1&taskId=${page3.cursor}`, { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const page4 = await page4Res.json();
    expect(page4.tasks).toHaveLength(0);
  });

  it('returns empty tasks with cursor when no more pages', async () => {
    await seedTokenSharingUser('egc_origin');
    await postTask('egc_origin', { name: 'Only', model: 'gpt-4o', prompt: 'only' });

    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });

    // First page gets the only task.
    const page1Res = await getTasks('egc_exec');
    const page1 = await page1Res.json();
    expect(page1.tasks).toHaveLength(1);

    // Second page with cursor returns empty.
    const page2Res = await worker.fetch(
      new Request(`http://localhost/tasks?taskId=${page1.cursor}`, { headers: authHeaders('egc_exec') }),
      createEnv(),
      emptyCtx()
    );
    const page2 = await page2Res.json();
    expect(page2.tasks).toHaveLength(0);
    // Cursor should be the same as the one we passed.
    expect(page2.cursor).toBe(page1.cursor);
  });
});

// PUT /tasks/{id}
describe('PUT /tasks/{id}', () => {
  async function setupTaskWithExecutor() {
    // Originator creates a task.
    await seedTokenSharingUser('egc_origin', { userId: 'u_origin', subscriptionId: 'sub_origin' });
    const createRes = await postTask('egc_origin');
    const { taskId } = await createRes.json();

    // Executor views (claims) the task.
    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    await getTasks('egc_exec');

    return { taskId };
  }

  it('returns 401 without API key', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/tasks/task_abc', {
        method: 'PUT',
        body: JSON.stringify({ output: 'done' }),
      }),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid API key', async () => {
    const res = await putTaskResult('egc_invalid', 'task_abc');
    expect(res.status).toBe(401);
  });

  it('returns 403 with webhook token', async () => {
    await seedToken('egw_webhook', { role: 'webhook', source: 'token_sharing' });
    const res = await putTaskResult('egw_webhook', 'task_abc');
    expect(res.status).toBe(403);
  });

  it('returns 403 for disabled user', async () => {
    await seedTokenSharingUser('egc_disabled', { userId: 'u_disabled', subscriptionId: 'sub_disabled' });
    await db.execute({ sql: 'UPDATE eg_users SET disabled = 1 WHERE id = ?', args: ['u_disabled'] });
    const res = await putTaskResult('egc_disabled', 'task_abc');
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { taskId } = await setupTaskWithExecutor();
    // Exhaust rate limit (60/min consumer limit).
    for (let i = 0; i < 60; i++) {
      await putTaskResult('egc_exec', taskId, { output: 'spam' });
    }
    const res = await putTaskResult('egc_exec', taskId, { output: 'one more' });
    expect(res.status).toBe(429);
  });

  it('returns 400 for empty task ID (PUT /tasks/)', async () => {
    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await worker.fetch(
      new Request('http://localhost/tasks/', {
        method: 'PUT',
        headers: { ...authHeaders('egc_exec'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: 'done' }),
      }),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent task', async () => {
    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await putTaskResult('egc_exec', 'task_nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 403 if executor has not claimed the task', async () => {
    await seedTokenSharingUser('egc_origin', { userId: 'u_origin', subscriptionId: 'sub_origin' });
    const createRes = await postTask('egc_origin');
    const { taskId } = await createRes.json();

    // Executor tries to PUT without GET /tasks first.
    await seedTokenSharingUser('egc_exec', { userId: 'u_exec', subscriptionId: 'sub_exec' });
    const res = await putTaskResult('egc_exec', taskId);
    expect(res.status).toBe(403);
  });

  it('returns 409 for expired tasks', async () => {
    const { taskId } = await setupTaskWithExecutor();
    await db.execute({ sql: 'UPDATE eg_tasks SET expires_at = 1 WHERE id = ?', args: [taskId] });

    const res = await putTaskResult('egc_exec', taskId);
    expect(res.status).toBe(409);
  });

  it('returns 409 for non-pending tasks', async () => {
    const { taskId } = await setupTaskWithExecutor();
    await db.execute({ sql: "UPDATE eg_tasks SET status = 'full' WHERE id = ?", args: [taskId] });

    const res = await putTaskResult('egc_exec', taskId);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { taskId } = await setupTaskWithExecutor();

    const res = await worker.fetch(
      new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { ...authHeaders('egc_exec'), 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      createEnv(),
      emptyCtx()
    );
    expect(res.status).toBe(400);
  });

  it("writes result as event under originator's subscription", async () => {
    const { taskId } = await setupTaskWithExecutor();

    const res = await putTaskResult('egc_exec', taskId, { output: 'translated text' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.messageId).toBeDefined();

    // Verify the event exists under the originator's subscription.
    const rows = await db.execute({
      sql: 'SELECT payload FROM eg_events WHERE subscription_id = ? AND id = ?',
      args: ['sub_origin', body.messageId],
    });
    expect(rows.rows).toHaveLength(1);
    const payload = JSON.parse(String(rows.rows[0]?.payload));
    expect(payload.taskId).toBe(taskId);
    expect(payload.executorId).toBe('u_exec');
    expect(payload.result).toEqual({ output: 'translated text' });
  });

  it('originator can poll the result via GET /events', async () => {
    const { taskId } = await setupTaskWithExecutor();
    await putTaskResult('egc_exec', taskId, { output: 'result' });

    const pollRes = await worker.fetch(
      new Request('http://localhost/events', { headers: authHeaders('egc_origin') }),
      createEnv(),
      emptyCtx()
    );
    expect(pollRes.status).toBe(200);
    const pollBody = await pollRes.json();
    expect(pollBody.events).toHaveLength(1);
    expect(pollBody.events[0].payload.taskId).toBe(taskId);
    expect(pollBody.events[0].payload.result).toEqual({ output: 'result' });
  });

  it('marks task as full when max executors reached', async () => {
    await seedTokenSharingUser('egc_origin', { userId: 'u_origin', subscriptionId: 'sub_origin' });
    const createRes = await postTask('egc_origin');
    const { taskId } = await createRes.json();

    // Have 3 executors claim and submit results.
    for (let i = 0; i < ENV_DEFAULTS.maxExecutorsPerTask; i++) {
      const execKey = `egc_exec_${i}`;
      await seedTokenSharingUser(execKey, { userId: `u_exec_${i}`, subscriptionId: `sub_exec_${i}` });
      await getTasks(execKey);
      await putTaskResult(execKey, taskId, { output: `result_${i}` });
    }

    // Task should be marked as full.
    const row = await db.execute({ sql: 'SELECT status FROM eg_tasks WHERE id = ?', args: [taskId] });
    expect(row.rows[0]?.status).toBe('full');
  });
});

// Cleanup
describe('task cleanup', () => {
  it('deletes expired tasks and their executor records', async () => {
    await seedTokenSharingUser('egc_a');
    await postTask('egc_a', { name: 'Old task', model: 'gpt-4o', prompt: 'old' });

    // Expire the task.
    await db.execute({ sql: 'UPDATE eg_tasks SET expires_at = 1' });

    // Seed an executor user and record.
    const taskRow = await db.execute({ sql: 'SELECT id FROM eg_tasks LIMIT 1' });
    const taskId = String(taskRow.rows[0]?.id);
    await db.execute({
      sql: `INSERT INTO eg_users (id, email, provider, provider_id, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['exec_1', 'exec_1@test.com', 'email', 'exec_1', 'custom', Date.now()],
    });
    await db.execute({
      sql: 'INSERT INTO eg_task_executors (task_id, executor_id, created_at) VALUES (?, ?, ?)',
      args: [taskId, 'exec_1', Date.now()],
    });

    await cleanupExpiredData();

    const tasks = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM eg_tasks' });
    expect(Number(tasks.rows[0]?.n)).toBe(0);

    const executors = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM eg_task_executors' });
    expect(Number(executors.rows[0]?.n)).toBe(0);
  });

  it('keeps non-expired tasks', async () => {
    await seedTokenSharingUser('egc_a');
    await postTask('egc_a');

    await cleanupExpiredData();

    const tasks = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM eg_tasks' });
    expect(Number(tasks.rows[0]?.n)).toBe(1);
  });
});
