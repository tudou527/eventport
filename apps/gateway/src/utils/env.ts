/**
 * Application env config — resolved from CF Workers env bindings at request start.
 *
 * Usage:
 *   - Call `initEnv(env)` at the top of `fetch()`.
 *   - Call `setAuth(metadata)` after resolving the API key.
 *   - Any module imports `appEnv` directly — no need to pass env/auth through function signatures.
 *   - Safe in CF Workers: V8 isolates handle one request at a time, no concurrent access.
 */

/** Parse a string as a positive integer, returning null if invalid or undefined. */
function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolved API key metadata — stored after auth so handlers can read from appEnv.auth. */
export interface ApiKeyMetadata {
  userId: string;
  subscriptionId: string;
  role: 'webhook' | 'consumer';
  source: string;
  plan: string;
  signingSecret: string | null;
  /** Whether events are deleted on poll (1) or persisted for replay (0). */
  consumeOnRead: boolean;
  /** Event instruction template; rendered per event into `text` in GET /events. Empty = disabled. */
  instructions: string;
}

/** Resolved application config. */
export interface AppEnv {
  /** Shared secret for the site's /internal/sql proxy endpoint. */
  internalSqlSecret: string;
  apiVersion: string;
  maxTasksPerUser: number;
  maxExecutorsPerTask: number;
  taskTtlSeconds: number;
  /** Resolved auth metadata. Null until setAuth() is called after API key resolution. */
  auth: ApiKeyMetadata | null;
}

/** Defaults used when env vars are absent or invalid. */
export const ENV_DEFAULTS: Omit<AppEnv, 'internalSqlSecret'> = {
  apiVersion: 'v1',
  maxTasksPerUser: 3,
  maxExecutorsPerTask: 3,
  taskTtlSeconds: 3 * 24 * 60 * 60,
  auth: null,
};

/** Module-level config, set once per request by initEnv(). */
export let appEnv: AppEnv = {
  internalSqlSecret: '',
  ...ENV_DEFAULTS,
};

/** Resolve all env bindings. Call at the top of fetch(). */
export function initEnv(env: {
  INTERNAL_SQL_SECRET?: string;
  API_VERSION?: string;
  MAX_TASKS_PER_USER?: string;
  MAX_EXECUTORS_PER_TASK?: string;
  DEFAULT_TASK_TTL_SECONDS?: string;
}): void {
  appEnv = {
    internalSqlSecret: env.INTERNAL_SQL_SECRET ?? '',
    apiVersion: env.API_VERSION ?? ENV_DEFAULTS.apiVersion,
    maxTasksPerUser: parsePositiveInt(env.MAX_TASKS_PER_USER) ?? ENV_DEFAULTS.maxTasksPerUser,
    maxExecutorsPerTask: parsePositiveInt(env.MAX_EXECUTORS_PER_TASK) ?? ENV_DEFAULTS.maxExecutorsPerTask,
    taskTtlSeconds: parsePositiveInt(env.DEFAULT_TASK_TTL_SECONDS) ?? ENV_DEFAULTS.taskTtlSeconds,
    auth: null,
  };
}

/** Store resolved API key metadata. Call after resolveApiKey succeeds. */
export function setAuth(metadata: ApiKeyMetadata): void {
  appEnv.auth = metadata;
}
