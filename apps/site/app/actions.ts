"use server";

import { redirect } from "next/navigation";
import { getSiteEnv, isAdminEmail } from "@/lib/env";
import { sendOtpEmail } from "@/lib/mail";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  verifySession,
  getSessionCookie,
} from "@/lib/session";
import {
  createGatewayToken,
  deleteGatewaySubscription,
  listGatewayTokens,
  setSubscriptionRateLimit,
  getSubscription,
  type SubscriptionSource,
} from "@/lib/tokens";
import { buildTestSignatureHeaders } from "@/lib/test-signature";
import {
  listUsers,
  setUserDisabled,
  setSubscriptionDisabled,
  getUser,
  isUserAdmin,
} from "@/lib/admin";
import { sqlQuery, sqlExecute } from "@/lib/db";
import { serverT } from "@/app/dashboard/i18n/server";

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login/");
}

/**
 * Verify the session cookie and return the authenticated user's ID.
 * Redirects to /login/ if the session is missing or invalid.
 */
export async function ensureAuthenticated(): Promise<string> {
  const token = await getSessionCookie();
  if (!token) {
    redirect("/login/");
  }
  const env = getSiteEnv();
  const userId = await verifySession(token, env.SESSION_SECRET);
  if (!userId) {
    await clearSessionCookie();
    redirect("/login/");
  }
  return userId;
}

/**
 * Verify the current user is an admin. Returns the userId or redirects.
 */
export async function ensureAdmin(): Promise<string> {
  const userId = await ensureAuthenticated();
  const admin = await isUserAdmin(userId);
  if (!admin) {
    redirect("/dashboard/");
  }
  return userId;
}

/**
 * Return the current user's public info for the dashboard layout.
 */
export async function getCurrentUser() {
  const userId = await ensureAuthenticated();
  const user = await getUser(userId);
  if (!user) {
    await clearSessionCookie();
    redirect("/login/");
  }
  return user;
}

/**
 * Handle the OAuth callback: find or create the user, then establish a session.
 * Called by the OAuth callback route after the provider returns user info.
 */
export async function oauthLogin(
  provider: string,
  providerId: string,
  email: string,
  name?: string
): Promise<{ error?: string }> {
  const env = getSiteEnv();
  const t = await serverT();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const rows = await sqlQuery<{
      id: string;
      disabled: number;
      is_admin: number;
    }>(
      `SELECT id, disabled, is_admin FROM eg_users WHERE provider = ? AND provider_id = ?`,
      [provider, providerId]
    );

    let userId: string;

    if (rows.length > 0) {
      if (rows[0].disabled === 1) {
        return { error: t("err.accountDisabled") };
      }
      userId = rows[0].id;
    } else {
      userId = crypto.randomUUID();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const isAdmin = isAdminEmail(normalizedEmail) ? 1 : 0;
      await sqlExecute(
        `INSERT INTO eg_users (id, email, name, provider, provider_id, is_admin, plan, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'custom', ?)`,
        [userId, normalizedEmail, name ?? null, provider, providerId, isAdmin, nowSeconds]
      );
    }

    const session = await createSession(env.SESSION_SECRET, userId);
    await setSessionCookie(session);
    redirect("/dashboard/");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loginFailed"),
    };
  }
}

export async function createToken(
  formData: FormData
): Promise<{
  subscriptionId?: string;
  webhookKey?: string;
  consumerKey?: string;
  webhookUrl?: string;
  signingSecret?: string;
  source?: string;
  error?: string;
}> {
  const userId = await ensureAuthenticated();
  const t = await serverT();
  const label = (formData.get("label") as string) || null;
  const source = (formData.get("source") as string) || "custom";

  try {
    const result = await createGatewayToken(
      userId,
      label,
      source as SubscriptionSource
    );
    return { ...result, source };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.createTokenFailed"),
    };
  }
}

/** Subscription and its integration config (displayed inline on the card, no per-request lookup needed). */
export interface SubscriptionWithConfig {
  subscriptionId: string;
  label: string | null;
  source: string;
  signingSecret: string | null;
  webhookKey: string | null;
  consumerKey: string | null;
  disabled: boolean;
  createdAt: number;
  instructions: string;
}

/**
 * Fetch all of the current user's subscriptions and their config (source / signing secret / both tokens)
 * in a single query, in descending order by creation time — newest first.
 */
export async function fetchSubscriptions(): Promise<{
  subscriptions?: SubscriptionWithConfig[];
  error?: string;
}> {
  const userId = await ensureAuthenticated();
  const t = await serverT();

  try {
    const rows = await sqlQuery<{
      id: string;
      label: string | null;
      source: string;
      signing_secret: string | null;
      created_at: number;
      webhook_key: string | null;
      consumer_key: string | null;
      disabled: number;
      instructions: string;
    }>(
      `SELECT s.id, s.label, s.source, s.signing_secret, s.created_at, s.disabled, s.instructions,
              MAX(CASE WHEN t.role = 'webhook' THEN t.api_key END) AS webhook_key,
              MAX(CASE WHEN t.role = 'consumer' THEN t.api_key END) AS consumer_key
       FROM eg_subscriptions s
       LEFT JOIN eg_tokens t ON t.subscription_id = s.id AND t.revoked_at IS NULL
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return {
      subscriptions: rows.map((r) => ({
        subscriptionId: r.id,
        label: r.label,
        source: r.source,
        signingSecret: r.signing_secret,
        webhookKey: r.webhook_key,
        consumerKey: r.consumer_key,
        disabled: r.disabled === 1,
        createdAt: r.created_at,
        instructions: r.instructions ?? "",
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadSubscriptionsFailed"),
    };
  }
}

/** A queued event row as shown on the Events page. */
export interface StoredEvent {
  messageId: string;
  subscriptionId: string;
  subscriptionLabel: string | null;
  payload: unknown;
  timestamp: number;
}

/**
 * List queued events for the signed-in user, newest first.
 *
 * Reads `eg_events` directly instead of calling the gateway's `GET /events`:
 * that endpoint is consume-on-read and would delete the very events the user's
 * agent still needs. The dashboard must never drain the queue.
 */
export async function fetchStoredEvents(
  subscriptionId?: string
): Promise<{ events?: StoredEvent[]; error?: string }> {
  const userId = await ensureAuthenticated();
  const t = await serverT();

  try {
    const rows = await sqlQuery<{
      id: string;
      subscription_id: string;
      label: string | null;
      payload: string;
      created_at: number;
    }>(
      `SELECT e.id, e.subscription_id, s.label, e.payload, e.created_at
       FROM eg_events e
       JOIN eg_subscriptions s ON s.id = e.subscription_id
       WHERE s.user_id = ?${subscriptionId ? " AND e.subscription_id = ?" : ""}
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 200`,
      subscriptionId ? [userId, subscriptionId] : [userId]
    );

    return {
      events: rows.map((r) => ({
        messageId: r.id,
        subscriptionId: r.subscription_id,
        subscriptionLabel: r.label,
        payload: safeParseJson(r.payload),
        timestamp: r.created_at,
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadEventsFailed"),
    };
  }
}

/** Event payloads are stored as JSON text; fall back to the raw string. */
function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function deleteSubscription(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const userId = await ensureAuthenticated();
  const t = await serverT();
  const subscriptionId = formData.get("subscriptionId") as string;

  try {
    const deleted = await deleteGatewaySubscription(subscriptionId, userId);
    if (!deleted) {
      return { error: t("err.subscriptionNotFound") };
    }
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.deleteSubscriptionFailed"),
    };
  }
}

/** Max length of the per-subscription instructions template. */
const INSTRUCTIONS_MAX_LENGTH = 4000;

/**
 * Update the instructions template of one of the current user's subscriptions.
 * The gateway renders it against each event's payload into the `text` field
 * of GET /events. Ownership is enforced by scoping the UPDATE to user_id.
 */
export async function updateInstructions(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const userId = await ensureAuthenticated();
  const t = await serverT();
  const subscriptionId = formData.get("subscriptionId") as string;
  const instructions = ((formData.get("instructions") as string) ?? "")
    .trim()
    .slice(0, INSTRUCTIONS_MAX_LENGTH);

  try {
    const rowsAffected = await sqlExecute(
      `UPDATE eg_subscriptions SET instructions = ? WHERE id = ? AND user_id = ?`,
      [instructions, subscriptionId, userId]
    );
    if (rowsAffected === 0) {
      return { error: t("err.subscriptionNotFound") };
    }
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.updateInstructionsFailed"),
    };
  }
}

export async function fetchTokens(): Promise<{
  tokens?: Awaited<ReturnType<typeof listGatewayTokens>>;
  error?: string;
}> {
  const userId = await ensureAuthenticated();
  const t = await serverT();

  try {
    const tokens = await listGatewayTokens(userId);
    return { tokens };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadTokensFailed"),
    };
  }
}

/**
 * Send a test event to the webhook URL for the current user's subscription.
 * Verifies ownership and webhook role before calling the gateway.
 */
export async function testWebhook(
  apiKey: string
): Promise<{ ok?: boolean; messageId?: string; error?: string }> {
  const userId = await ensureAuthenticated();
  const env = getSiteEnv();
  const t = await serverT();

  try {
    const tokens = await listGatewayTokens(userId);
    const token = tokens.find(
      (tk) => tk.apiKey === apiKey && !tk.revokedAt && tk.role === "webhook"
    );
    if (!token) {
      return { error: t("err.webhookTokenNotFound") };
    }

    // Sign the payload the way the real provider would, so the gateway's
    // per-source signature verifier (github, stripe, ...) accepts the event.
    const subscription = await getSubscription(token.subscriptionId);
    const rawBody = JSON.stringify({
      event: "test",
      source: "eventport-dashboard",
      timestamp: Date.now(),
    });
    const url = `${env.GATEWAY_URL}/hooks/${apiKey}`;
    const signatureHeaders = buildTestSignatureHeaders(
      subscription?.source ?? "custom",
      subscription?.signingSecret ?? null,
      rawBody,
      url
    );

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...signatureHeaders },
      body: rawBody,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => t("err.unknown"));
      return { error: t("err.gatewayReturned", { status: resp.status, text }) };
    }

    const data = (await resp.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.sendTestWebhookFailed"),
    };
  }
}

/**
 * Poll the gateway for events belonging to the current user's subscription.
 * Runs server-side so it uses the real GATEWAY_URL env var.
 */
export async function fetchSubscriptionTokens(
  subscriptionId: string
): Promise<{ webhook?: { apiKey: string; rateLimit: number }; consumer?: { apiKey: string; rateLimit: number }; error?: string }> {
  const userId = await ensureAuthenticated();
  const t = await serverT();

  try {
    const tokens = await listGatewayTokens(userId);
    const subscriptionTokens = tokens.filter(
      (tk) => tk.subscriptionId === subscriptionId && !tk.revokedAt
    );
    const webhook = subscriptionTokens.find((tk) => tk.role === "webhook");
    const consumer = subscriptionTokens.find((tk) => tk.role === "consumer");
    if (!webhook && !consumer) {
      return { error: t("err.subscriptionNotFoundOrRevoked") };
    }
    return {
      webhook: webhook ? { apiKey: webhook.apiKey, rateLimit: webhook.rateLimit } : undefined,
      consumer: consumer ? { apiKey: consumer.apiKey, rateLimit: consumer.rateLimit } : undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadTokensFailed"),
    };
  }
}

/**
 * Fetch a subscription's webhook config (source + signing secret) so the
 * detail page can keep showing the provider setup guidance after creation.
 * Ownership is enforced by matching the caller's tokens first.
 */
export async function fetchSubscriptionConfig(
  subscriptionId: string
): Promise<{ source?: string; signingSecret?: string | null; error?: string }> {
  const userId = await ensureAuthenticated();
  const t = await serverT();

  try {
    const tokens = await listGatewayTokens(userId);
    const owned = tokens.some((tk) => tk.subscriptionId === subscriptionId);
    if (!owned) {
      return { error: t("err.subscriptionNotFound") };
    }
    const subscription = await getSubscription(subscriptionId);
    if (!subscription) {
      return { error: t("err.subscriptionNotFound") };
    }
    return {
      source: subscription.source,
      signingSecret: subscription.signingSecret,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadSubscriptionFailed"),
    };
  }
}

// Admin actions

export async function fetchAllUsers(): Promise<{
  users?: Awaited<ReturnType<typeof listUsers>>;
  error?: string;
}> {
  await ensureAdmin();
  const t = await serverT();
  try {
    const users = await listUsers();
    return { users };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadUsersFailed"),
    };
  }
}

export async function fetchAllTokens(): Promise<{
  tokens?: Awaited<ReturnType<typeof listGatewayTokens>>;
  error?: string;
}> {
  await ensureAdmin();
  const t = await serverT();
  try {
    const tokens = await listGatewayTokens();
    return { tokens };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.loadTokensFailed"),
    };
  }
}

export async function toggleUserDisabled(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await ensureAdmin();
  const t = await serverT();
  const userId = formData.get("userId") as string;
  const disabled = formData.get("disabled") === "true";

  try {
    await setUserDisabled(userId, disabled);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.updateUserFailed"),
    };
  }
}

export async function toggleSubscriptionDisabled(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await ensureAdmin();
  const t = await serverT();
  const subscriptionId = formData.get("subscriptionId") as string;
  const disabled = formData.get("disabled") === "true";

  try {
    await setSubscriptionDisabled(subscriptionId, disabled);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.updateSubscriptionFailed"),
    };
  }
}

export async function updateRateLimit(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await ensureAdmin();
  const t = await serverT();
  const subscriptionId = formData.get("subscriptionId") as string;
  const rateLimit = parseInt(formData.get("rateLimit") as string, 10);

  if (isNaN(rateLimit) || rateLimit < 1) {
    return { error: t("err.invalidRateLimit") };
  }

  try {
    await setSubscriptionRateLimit(subscriptionId, rateLimit);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : t("err.updateRateLimitFailed"),
    };
  }
}

// Email OTP login
const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const OTP_RATE_LIMIT_MAX = 3;

/**
 * Generate a one-time login code and store it in the database.
 */
export async function sendLoginCode(
  email: string
): Promise<{ ok?: boolean; error?: string }> {
  const t = await serverT();
  if (!email || !email.includes("@")) {
    return { error: t("err.invalidEmail") };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = Math.floor(Date.now() / 1000);
  const codeExpiresAt = now + OTP_TTL_SECONDS;
  const rateWindowExpiresAt = now + OTP_RATE_LIMIT_WINDOW_SECONDS;

  // 1) Atomic rate-limit check + increment in a single round-trip via
  //    UPSERT ... RETURNING. If the window expired, reset to 1; if already
  //    at the cap, keep the count unchanged so we can detect overflow.
  const rateRows = await sqlQuery<{ count: number }>(
    `INSERT INTO eg_otp_rate_limits (email, count, window_expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(email) DO UPDATE SET
       count = CASE
         WHEN eg_otp_rate_limits.window_expires_at <= ? THEN 1
         WHEN eg_otp_rate_limits.count >= ? THEN eg_otp_rate_limits.count
         ELSE eg_otp_rate_limits.count + 1
       END,
       window_expires_at = CASE
         WHEN eg_otp_rate_limits.window_expires_at <= ? THEN excluded.window_expires_at
         ELSE eg_otp_rate_limits.window_expires_at
       END
     RETURNING count`,
    [normalizedEmail, rateWindowExpiresAt, now, OTP_RATE_LIMIT_MAX, now]
  );

  const newCount = rateRows[0]?.count ?? 1;
  if (newCount > OTP_RATE_LIMIT_MAX) {
    return { error: t("err.otpTooManySent") };
  }

  // 2) Generate a 6-digit code and store it.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await sqlExecute(
    `INSERT INTO eg_otp_codes (email, code, attempts, expires_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code = excluded.code,
       attempts = 0,
       expires_at = excluded.expires_at`,
    [normalizedEmail, code, codeExpiresAt]
  );

  await sendOtpEmail(normalizedEmail, code);

  return { ok: true };
}

/**
 * Verify a one-time login code. On success, find or create the user and establish a session.
 */
export async function verifyLoginCode(
  email: string,
  code: string
): Promise<{ error?: string }> {
  const env = getSiteEnv();
  const t = await serverT();
  const normalizedEmail = email.toLowerCase().trim();
  const now = Math.floor(Date.now() / 1000);

  const rows = await sqlQuery<{
    code: string;
    attempts: number;
  }>(
    `SELECT code, attempts FROM eg_otp_codes WHERE email = ? AND expires_at > ?`,
    [normalizedEmail, now]
  );

  if (rows.length === 0) {
    return { error: t("err.otpExpired") };
  }

  const { code: storedCode, attempts } = rows[0];

  if (attempts >= OTP_MAX_ATTEMPTS) {
    await sqlExecute(`DELETE FROM eg_otp_codes WHERE email = ?`, [normalizedEmail]);
    return { error: t("err.otpTooManyAttempts") };
  }

  if (code !== storedCode) {
    await sqlExecute(
      `UPDATE eg_otp_codes SET attempts = attempts + 1 WHERE email = ?`,
      [normalizedEmail]
    );
    return { error: t("err.otpInvalidCode") };
  }

  // Code is valid — delete it so it can't be reused.
  await sqlExecute(`DELETE FROM eg_otp_codes WHERE email = ?`, [normalizedEmail]);

  // Find or create the user. Email is the account identity — an address that
  // already signed up via Google must resolve to the same account here,
  // otherwise the INSERT below would violate eg_users.email UNIQUE.
  const userRows = await sqlQuery<{
    id: string;
    disabled: number;
  }>(
    `SELECT id, disabled FROM eg_users WHERE lower(email) = ?`,
    [normalizedEmail]
  );

  let userId: string;

  if (userRows.length > 0) {
    if (userRows[0].disabled === 1) {
      return { error: t("err.accountDisabled") };
    }
    userId = userRows[0].id;
  } else {
    userId = crypto.randomUUID();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const isAdmin = isAdminEmail(normalizedEmail) ? 1 : 0;
    await sqlExecute(
      `INSERT INTO eg_users (id, email, name, provider, provider_id, is_admin, plan, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'custom', ?)`,
        [userId, normalizedEmail, null, "email", normalizedEmail, isAdmin ? 1 : 0, nowSeconds]
    );
  }

  const session = await createSession(env.SESSION_SECRET, userId);
  await setSessionCookie(session);
  redirect("/dashboard/");
}
