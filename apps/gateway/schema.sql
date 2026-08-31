-- Full schema for the EventPort database.
-- Targets Cloudflare D1 (SQLite). Deploys via
-- `pnpm exec wrangler d1 execute eventport --remote --file=schema.sql -y`.
--
-- All tables use the `eg_` prefix so they are visually grouped together and
-- won't collide with other applications' tables.

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'custom',    -- internal quota tier; limits defined in apps/gateway/src/plans.ts
  disabled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, provider_id)
);

-- Email is the account identity across login methods (OTP / Google). The
-- column's UNIQUE is case-sensitive in SQLite, so this expression index is the
-- real guard against `Foo@x.com` and `foo@x.com` becoming two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_eg_users_email_lower ON eg_users(lower(email));

-- ---------------------------------------------------------------------------
-- Subscriptions
-- Source-specific fields (source, signing_secret) live here so they are stored
-- once per subscription, not duplicated per token.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES eg_users(id),
  source TEXT NOT NULL,             -- 'github' | 'linear' | 'stripe' | ... (routes to the matching verifier in connectors/)
  label TEXT,
  signing_secret TEXT,    
  consume_on_read INTEGER NOT NULL DEFAULT 1,  -- 1 = delete on poll (default), 0 = persist (e.g. game replay)
  instructions TEXT NOT NULL DEFAULT '',  -- event instruction template; rendered per event into `text` in GET /events ({{a.b.c}} placeholders)
  created_at INTEGER NOT NULL,
  disabled INTEGER DEFAULT 0         -- subscription-level kill switch; 0 = active, 1 = disabled
);

-- Existing databases created before the instructions column need:
--   ALTER TABLE eg_subscriptions ADD COLUMN instructions TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_eg_subscriptions_user_id ON eg_subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- Tokens
-- Two tokens per subscription: webhook (egw_*) and consumer (egc_*).
-- subscription_id is the canonical key for event queues, rate-limit counters,
-- and disable checks.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES eg_users(id),
  subscription_id TEXT NOT NULL REFERENCES eg_subscriptions(id),
  role TEXT NOT NULL CHECK(role IN ('webhook', 'consumer')),
  label TEXT,
  api_key TEXT UNIQUE NOT NULL,
  rate_limit INTEGER DEFAULT 30,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_eg_tokens_subscription_id ON eg_tokens(subscription_id);
CREATE INDEX IF NOT EXISTS idx_eg_tokens_user_id ON eg_tokens(user_id);

-- ---------------------------------------------------------------------------
-- Events
-- Each event is one row. TTL is enforced by a scheduled cleanup (cron trigger)
-- rather than KV's expirationTtl, since SQLite has no native TTL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_events (
  id TEXT PRIMARY KEY,                       -- messageId (UUID)
  subscription_id TEXT NOT NULL REFERENCES eg_subscriptions(id),
  payload TEXT NOT NULL,                    -- raw upstream webhook body, stored verbatim as JSON string
  created_at INTEGER NOT NULL
);

-- Hot path: list events for a subscription ordered by insertion.
CREATE INDEX IF NOT EXISTS idx_eg_events_sub_created ON eg_events(subscription_id, created_at);

-- Cleanup path: find expired events across all subscriptions.
CREATE INDEX IF NOT EXISTS idx_eg_events_created_at ON eg_events(created_at);

-- ---------------------------------------------------------------------------
-- Rate limits (per subscription, per role, per minute)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_rate_limits (
  subscription_id TEXT NOT NULL,
  role TEXT NOT NULL,
  minute INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subscription_id, role, minute)
);

-- ---------------------------------------------------------------------------
-- Email OTP login codes (managed by site)
-- Cleanup is best-effort: rows are ignored once expires_at < now, and a
-- periodic DELETE removes them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_otp_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL              -- unix seconds; row ignored after this
);

-- Per-email OTP send rate limit.
-- One row per email; the window resets when window_expires_at < now.
CREATE TABLE IF NOT EXISTS eg_otp_rate_limits (
  email TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_expires_at INTEGER NOT NULL       -- unix seconds
);

-- ---------------------------------------------------------------------------
-- Rejected events hourly counter
-- When a subscription hits its maxBacklog limit, incoming events are rejected
-- (429) and the count is accumulated per hour here so the dashboard can show
-- users their real traffic volume.
-- Cleaned up by the scheduled task after REJECTED_EVENTS_RETENTION_SECONDS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_rejected_events_hourly (
  subscription_id TEXT NOT NULL,
  hour INTEGER NOT NULL,                  -- unix seconds floored to the hour
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subscription_id, hour)
);

CREATE INDEX IF NOT EXISTS idx_eg_rejected_events_hourly_hour ON eg_rejected_events_hourly(hour);

-- ---------------------------------------------------------------------------
-- Token-sharing tasks
-- Users submit tasks (model + prompt) that other users can execute using their
-- own AI model tokens. Each task has a fixed TTL and a max executor count.
-- Results are written to the originator's eg_events via PUT /tasks/{id}.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eg_tasks (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES eg_subscriptions(id),
  user_id TEXT NOT NULL REFERENCES eg_users(id),
  name TEXT NOT NULL,
  description TEXT,
  payload TEXT NOT NULL,              -- { model, prompt, ...params }
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | full
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL         -- created_at + TASK_TTL_SECONDS
);

CREATE INDEX IF NOT EXISTS idx_eg_tasks_user_pending ON eg_tasks(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_eg_tasks_status_expires ON eg_tasks(status, expires_at);

-- Tracks which users viewed/claimed a task. Count per task <= 3.
CREATE TABLE IF NOT EXISTS eg_task_executors (
  task_id TEXT NOT NULL REFERENCES eg_tasks(id),
  executor_id TEXT NOT NULL REFERENCES eg_users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, executor_id)
);
