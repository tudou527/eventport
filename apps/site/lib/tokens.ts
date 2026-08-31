import { getSiteEnv } from "./env";
import { sqlQuery, sqlExecute, sqlBatch } from "./db";
import { getPlanLimits } from "./plans";

export type TokenRole = "webhook" | "consumer";

/**
 * Sources supported by the gateway.
 *
 * Each value MUST match a key in `apps/gateway/src/connectors/index.ts`'s
 * `verifiers` map (or `custom` for passthrough). Adding a source here without
 * a corresponding verifier means events will be accepted without signature
 * verification — only do this intentionally.
 */
export type SubscriptionSource =
  | "github"
  | "linear"
  | "stripe"
  | "slack"
  | "shopify"
  | "hubspot"
  | "calendly"
  | "typeform"
  | "token_sharing"
  | "custom";

export interface GatewayToken {
  id: string;
  userId: string;
  subscriptionId: string;
  label: string | null;
  apiKey: string;
  role: TokenRole;
  rateLimit: number;
  createdAt: number;
  revokedAt: number | null;
  /** Subscription-level disabled flag (joined from eg_subscriptions). */
  disabled?: boolean;
}

const DEFAULT_RATE_LIMIT = 30; // events or polls per minute

export interface CreateTokenResult {
  subscriptionId: string;
  webhookKey: string;
  consumerKey: string;
  webhookUrl: string;
  /** Shared HMAC secret the user must paste into the upstream SaaS webhook config. */
  signingSecret: string;
}

/**
 * Create a new subscription for a user.
 * Generates:
 *   - one subscriptions row (source + signing_secret stored once here)
 *   - two tokens: webhook (egw_*) / consumer (egc_*)
 *
 * Both inserts run as a single transactional batch so the tokens are never written
 * without their parent subscription (FK safety).
 *
 * Enforces the user's plan subscription count limit (maxSubscriptions) before
 * inserting. Throws if the limit is reached.
 */
export async function createGatewayToken(
  userId: string,
  label: string | null,
  source: SubscriptionSource = "custom",
  rateLimit: number = DEFAULT_RATE_LIMIT
): Promise<CreateTokenResult> {
  const env = getSiteEnv();

  // Plan-level subscription count limit.
  const userRows = await sqlQuery<{ plan: string | null }>(
    `SELECT plan FROM eg_users WHERE id = ?`,
    [userId]
  );
  const plan = userRows[0]?.plan;
  const limits = getPlanLimits(plan);
  if (limits.maxSubscriptions !== null) {
    const countRows = await sqlQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM eg_subscriptions WHERE user_id = ?`,
      [userId]
    );
    const current = Number(countRows[0]?.n ?? 0);
    if (current >= limits.maxSubscriptions) {
      throw new Error(
        `Subscription limit reached: your plan allows ${limits.maxSubscriptions} subscription(s). ` +
          `Delete an existing one or upgrade your plan.`
      );
    }
  }

  const subscriptionId = `sub_${generateId(12)}`;
  const webhookKey = generateApiKey("webhook");
  const consumerKey = generateApiKey("consumer");
  const signingSecret = generateSigningSecret();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const validatedLimit = Math.max(1, Math.min(rateLimit, 10000));

  const webhookTokenId = crypto.randomUUID();
  const consumerTokenId = crypto.randomUUID();

  await sqlBatch([
    {
      sql: `INSERT INTO eg_subscriptions (id, user_id, source, label, signing_secret, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [subscriptionId, userId, source, label, signingSecret, nowSeconds],
    },
    {
      sql: `INSERT INTO eg_tokens (id, user_id, subscription_id, role, label, api_key, rate_limit, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [webhookTokenId, userId, subscriptionId, "webhook", label, webhookKey, validatedLimit, nowSeconds],
    },
    {
      sql: `INSERT INTO eg_tokens (id, user_id, subscription_id, role, label, api_key, rate_limit, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [consumerTokenId, userId, subscriptionId, "consumer", label, consumerKey, validatedLimit, nowSeconds],
    },
  ]);

  return {
    subscriptionId,
    webhookKey,
    consumerKey,
    webhookUrl: `${env.GATEWAY_URL}/hooks/${webhookKey}`,
    signingSecret,
  };
}

/**
 * Hard-delete a subscription and everything tied to it (tokens, queued
 * events, rate-limit counters, rejected-event stats, tasks). Scoped to the
 * owning user — deleting someone else's subscription is a no-op.
 * Returns false when the subscription doesn't exist or isn't owned by userId.
 */
export async function deleteGatewaySubscription(
  subscriptionId: string,
  userId: string
): Promise<boolean> {
  const rows = await sqlQuery<{ id: string }>(
    `SELECT id FROM eg_subscriptions WHERE id = ? AND user_id = ?`,
    [subscriptionId, userId]
  );
  if (rows.length === 0) return false;

  await sqlBatch([
    {
      sql: `DELETE FROM eg_task_executors WHERE task_id IN (SELECT id FROM eg_tasks WHERE subscription_id = ?)`,
      args: [subscriptionId],
    },
    { sql: `DELETE FROM eg_tasks WHERE subscription_id = ?`, args: [subscriptionId] },
    { sql: `DELETE FROM eg_events WHERE subscription_id = ?`, args: [subscriptionId] },
    { sql: `DELETE FROM eg_rate_limits WHERE subscription_id = ?`, args: [subscriptionId] },
    { sql: `DELETE FROM eg_rejected_events_hourly WHERE subscription_id = ?`, args: [subscriptionId] },
    { sql: `DELETE FROM eg_tokens WHERE subscription_id = ?`, args: [subscriptionId] },
    { sql: `DELETE FROM eg_subscriptions WHERE id = ? AND user_id = ?`, args: [subscriptionId, userId] },
  ]);
  return true;
}

/**
 * Update the rate limit for both tokens of a subscription.
 */
export async function setSubscriptionRateLimit(
  subscriptionId: string,
  rateLimit: number
): Promise<void> {
  const validatedLimit = Math.max(1, Math.min(rateLimit, 10000));
  await sqlExecute(
    `UPDATE eg_tokens SET rate_limit = ? WHERE subscription_id = ? AND revoked_at IS NULL`,
    [validatedLimit, subscriptionId]
  );
}

/**
 * Return the active webhook and consumer tokens for a subscription.
 */
export async function getSubscriptionTokens(
  subscriptionId: string
): Promise<{ webhook?: GatewayToken; consumer?: GatewayToken }> {
  const rows = await sqlQuery<GatewayToken>(
    `SELECT id, user_id as userId, subscription_id as subscriptionId, label, api_key as apiKey,
            role, rate_limit as rateLimit, created_at as createdAt, revoked_at as revokedAt
     FROM eg_tokens WHERE subscription_id = ? AND revoked_at IS NULL`,
    [subscriptionId]
  );
  return {
    webhook: rows.find((r) => r.role === "webhook"),
    consumer: rows.find((r) => r.role === "consumer"),
  };
}

/**
 * Return the subscription row (source, signing_secret, label, disabled state).
 * Used by the dashboard to render the webhook setup instructions.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<{
  id: string;
  source: string;
  label: string | null;
  signingSecret: string | null;
  disabled: boolean;
  createdAt: number;
} | null> {
  const rows = await sqlQuery<{
    id: string;
    source: string;
    label: string | null;
    signing_secret: string | null;
    disabled: number;
    created_at: number;
  }>(
    `SELECT id, source, label, signing_secret, disabled, created_at
     FROM eg_subscriptions WHERE id = ?`,
    [subscriptionId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    source: row.source,
    label: row.label,
    signingSecret: row.signing_secret,
    disabled: row.disabled === 1,
    createdAt: row.created_at,
  };
}

/**
 * List all gateway tokens for a specific user.
 * If userId is omitted, returns tokens for all users (admin use).
 */
export async function listGatewayTokens(userId?: string): Promise<GatewayToken[]> {
  if (userId) {
    return sqlQuery<GatewayToken>(
      `SELECT t.id, t.user_id as userId, t.subscription_id as subscriptionId, t.label, t.api_key as apiKey,
              t.role, t.rate_limit as rateLimit, t.created_at as createdAt, t.revoked_at as revokedAt,
              s.disabled as disabled
       FROM eg_tokens t
       LEFT JOIN eg_subscriptions s ON t.subscription_id = s.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );
  }
  return sqlQuery<GatewayToken>(
    `SELECT t.id, t.user_id as userId, t.subscription_id as subscriptionId, t.label, t.api_key as apiKey,
            t.role, t.rate_limit as rateLimit, t.created_at as createdAt, t.revoked_at as revokedAt,
            s.disabled as disabled
     FROM eg_tokens t
     LEFT JOIN eg_subscriptions s ON t.subscription_id = s.id
     ORDER BY t.created_at DESC`
  );
}

function generateApiKey(role: TokenRole): string {
  const prefix = role === "webhook" ? "egw_" : "egc_";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 43);
  return prefix + key;
}

/** Generate a shared HMAC secret for upstream webhook signature verification. */
function generateSigningSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "whsec_" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateId(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const arr = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += chars[arr[i] % chars.length];
  }
  return result;
}
