export type EmailProvider =
  | { type: "brevo"; apiKey: string; from: string }
  | { type: "resend"; apiKey: string; from: string };

/**
 * Client-safe public URLs, provided exclusively via NEXT_PUBLIC_* env vars —
 * no code defaults, so a missing value fails fast at build time with a
 * clear message (instead of a cryptic "Invalid URL" from new URL(undefined)).
 */
function requirePublicEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name} (see apps/site/.env.example)`,
    );
  }
  return value;
}

export const SITE_URL = requirePublicEnv("NEXT_PUBLIC_SITE_URL");
export const GATEWAY_URL = requirePublicEnv("NEXT_PUBLIC_GATEWAY_URL");

/** Fixed project info (like the copyright line), not env-controlled. */
export const GITHUB_URL = "https://github.com/tudou527/eventport";

export interface SiteEnv {
  GATEWAY_URL: string;
  INTERNAL_SQL_SECRET: string;
  SESSION_SECRET: string;
  /** Google OAuth login is optional: enabled only when both values are set. */
  GOOGLE_CLIENT_ID: string | null;
  GOOGLE_CLIENT_SECRET: string | null;
  ADMIN_EMAILS: string[];
  EMAIL_PROVIDERS: EmailProvider[];
}

function parseEmailProviders(): EmailProvider[] {
  const list = (process.env.EMAIL_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const providers: EmailProvider[] = [];

  for (const name of list) {
    const prefix = name.toUpperCase();

    switch (name) {
      case "brevo": {
        const apiKey = process.env[`${prefix}_API_KEY`];
        const from = process.env[`${prefix}_FROM`];
        if (apiKey && from) {
          providers.push({ type: "brevo", apiKey, from });
        }
        break;
      }

      case "resend": {
        const apiKey = process.env[`${prefix}_API_KEY`];
        const from = process.env[`${prefix}_FROM`];
        if (apiKey && from) {
          providers.push({ type: "resend", apiKey, from });
        }
        break;
      }
    }
  }

  return providers;
}

export function getSiteEnv(): SiteEnv {
  const required = [
    "NEXT_PUBLIC_GATEWAY_URL",
    "NEXT_PUBLIC_SITE_URL",
    "INTERNAL_SQL_SECRET",
    "SESSION_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const adminEmailsRaw = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL!,
    INTERNAL_SQL_SECRET: process.env.INTERNAL_SQL_SECRET!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? null,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? null,
    ADMIN_EMAILS: adminEmails,
    EMAIL_PROVIDERS: parseEmailProviders(),
  };
}

/**
 * Check whether an email belongs to the bootstrap admin list.
 * Used when creating users via OAuth/OTP to grant initial admin privileges.
 */
export function isAdminEmail(email: string): boolean {
  const env = getSiteEnv();
  return env.ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
