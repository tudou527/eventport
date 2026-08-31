import { sqlQuery, sqlExecute } from "./db";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: number;
}

/**
 * List all users. Used by the admin dashboard.
 */
export async function listUsers(): Promise<User[]> {
  const rows = await sqlQuery<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    provider: string;
    is_admin: number;
    disabled: number;
    created_at: number;
  }>(
    `SELECT id, email, name, avatar_url, provider, is_admin, disabled, created_at
     FROM eg_users
     ORDER BY created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    provider: row.provider,
    isAdmin: Boolean(row.is_admin),
    disabled: row.disabled === 1,
    createdAt: row.created_at,
  }));
}

/**
 * Fetch a single user by ID.
 */
export async function getUser(userId: string): Promise<User | null> {
  const rows = await sqlQuery<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    provider: string;
    is_admin: number;
    disabled: number;
    created_at: number;
  }>(
    `SELECT id, email, name, avatar_url, provider, is_admin, disabled, created_at
     FROM eg_users WHERE id = ?`,
    [userId]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    provider: row.provider,
    isAdmin: Boolean(row.is_admin),
    disabled: row.disabled === 1,
    createdAt: row.created_at,
  };
}

/**
 * Disable or enable a user.
 * Updates eg_users.disabled; the gateway checks it directly.
 */
export async function setUserDisabled(
  userId: string,
  disabled: boolean
): Promise<void> {
  await sqlExecute(
    `UPDATE eg_users SET disabled = ? WHERE id = ?`,
    [disabled ? 1 : 0, userId]
  );
}

/**
 * Disable or enable a subscription (subscription-level kill switch).
 * Writes to eg_subscriptions.disabled; the gateway reads this column on every
 * webhook/poll request.
 */
export async function setSubscriptionDisabled(
  subscriptionId: string,
  disabled: boolean
): Promise<void> {
  await sqlExecute(
    `UPDATE eg_subscriptions SET disabled = ? WHERE id = ?`,
    [disabled ? 1 : 0, subscriptionId]
  );
}

/**
 * Check whether a user is an admin.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.isAdmin ?? false;
}
