import { readFileSync } from "fs";
import { join } from "path";
import { getSiteEnv, type EmailProvider } from "./env";

const OTP_EXPIRY_MINUTES = 10;

// Load HTML template once at module load
const OTP_TEMPLATE = readFileSync(
  join(process.cwd(), "lib/templates/otp-email.html"),
  "utf-8"
);

/** Render template with variable substitution. */
function renderTemplate(vars: Record<string, string>): string {
  return OTP_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/** Extract the bare email address from a "Name <email>" string. */
function parseEmail(from: string): string {
  const match = from.match(/<(.+)>/);
  return match ? match[1] : from;
}

function getTextContent(code: string): string {
  return `Your login code is: ${code}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`;
}

async function sendViaBrevo(p: Extract<EmailProvider, { type: "brevo" }>, to: string, code: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": p.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: parseEmail(p.from) },
      to: [{ email: to }],
      subject: "Your login code",
      textContent: getTextContent(code),
      htmlContent: renderTemplate({ code, expiry: String(OTP_EXPIRY_MINUTES) }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Brevo API ${res.status}: ${await res.text()}`);
  }
}

async function sendViaResend(p: Extract<EmailProvider, { type: "resend" }>, to: string, code: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: p.from,
      to: [to],
      subject: "Your login code",
      text: getTextContent(code),
      html: renderTemplate({ code, expiry: String(OTP_EXPIRY_MINUTES) }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend API ${res.status}: ${await res.text()}`);
  }
}

const dispatchers = {
  brevo: sendViaBrevo,
  resend: sendViaResend,
} as const;

/** Send OTP email. Tries each configured provider in order. */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const { EMAIL_PROVIDERS } = getSiteEnv();

  if (EMAIL_PROVIDERS.length === 0) {
    throw new Error("No email providers configured");
  }

  let lastError: Error | null = null;

  for (const provider of EMAIL_PROVIDERS) {
    try {
      const send = dispatchers[provider.type] as (p: typeof provider, to: string, code: string) => Promise<void>;
      await send(provider, to, code);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[mail] ${provider.type} failed:`, lastError.message);
    }
  }

  throw new Error(`All email providers failed: ${lastError?.message}`);
}
