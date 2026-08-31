import { getSiteEnv } from "./env";

/**
 * SQL access via the gateway's /internal/sql proxy endpoint.
 *
 * The database lives in Cloudflare D1, whose binding only exists inside the
 * gateway Worker. The site (Vercel) sends parameterized statements to
 * `POST {GATEWAY_URL}/internal/sql`, authenticated by INTERNAL_SQL_SECRET.
 * Callers: api.ts, admin.ts, tokens.ts, auth.ts, actions.ts.
 */

/** Values accepted as SQL bind parameters (subset of SQLite types we use). */
export type InValue = string | number | boolean | null;
export type InArgs = InValue[];
export interface InStatement {
  sql: string;
  args: InArgs;
}

type ProxyMode = "query" | "execute" | "batch";

async function callInternalSql<T>(
  mode: ProxyMode,
  statements: InStatement[]
): Promise<T> {
  const env = getSiteEnv();
  const res = await fetch(`${env.GATEWAY_URL}/internal/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.INTERNAL_SQL_SECRET}`,
    },
    body: JSON.stringify({ mode, statements }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`internal/sql ${mode} failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as T;
}

/** Execute a SQL statement and return the rows. */
export async function sqlQuery<T = unknown>(
  sql: string,
  args: InArgs = []
): Promise<T[]> {
  const result = await callInternalSql<{ rows: T[] }>("query", [{ sql, args }]);
  return result.rows;
}

/** Execute a SQL statement that does not return rows (INSERT/UPDATE/DELETE). */
export async function sqlExecute(
  sql: string,
  args: InArgs = []
): Promise<number> {
  const result = await callInternalSql<{ rowsAffected: number }>("execute", [
    { sql, args },
  ]);
  return Number(result.rowsAffected ?? 0);
}

/**
 * Execute multiple SQL statements in a single batch (transactional in D1).
 * Used by `createGatewayToken` to insert both tokens atomically.
 */
export async function sqlBatch(statements: InStatement[]): Promise<void> {
  await callInternalSql<{ ok: boolean }>("batch", statements);
}
