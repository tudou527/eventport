import { createHmac } from "node:crypto";

/**
 * Build the signature headers a real provider would attach to a webhook
 * delivery, so "Send test event" passes the gateway's per-source verifier
 * (mirrors apps/gateway/src/connectors formats).
 *
 * Sources without a registered verifier (custom, token_sharing, ...) return
 * no extra headers — the gateway accepts them unsigned.
 */
export function buildTestSignatureHeaders(
  source: string,
  secret: string | null,
  rawBody: string,
  url: string
): Record<string, string> {
  if (!secret) return {};

  const hex = (payload: string) =>
    createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const b64 = (payload: string) =>
    createHmac("sha256", secret).update(payload, "utf8").digest("base64");

  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  switch (source) {
    case "github":
      return { "X-Hub-Signature-256": `sha256=${hex(rawBody)}` };

    case "linear":
      return { "Linear-Signature": hex(rawBody) };

    case "stripe":
      return { "Stripe-Signature": `t=${nowSec},v1=${hex(`${nowSec}.${rawBody}`)}` };

    case "slack":
      return {
        "X-Slack-Signature": `v0=${hex(`v0:${nowSec}:${rawBody}`)}`,
        "X-Slack-Request-Timestamp": String(nowSec),
      };

    case "shopify":
      return { "X-Shopify-Hmac-Sha256": b64(rawBody) };

    case "hubspot": {
      // HubSpot v3 signs `${method}${uri}${body}${tsMs}`. Our webhook URL has
      // no percent-encoded reserved chars, so normalization reduces to
      // dropping the fragment (mirrors normalizeHubSpotUri).
      const uri = url.split("#")[0];
      return {
        "X-HubSpot-Signature-v3": b64(`POST${uri}${rawBody}${nowMs}`),
        "X-HubSpot-Request-Timestamp": String(nowMs),
      };
    }

    case "calendly":
      return {
        "Calendly-Webhook-Signature": `t=${nowSec},v1=${hex(`${nowSec}.${rawBody}`)}`,
      };

    case "typeform":
      return { "Typeform-Signature": `sha256=${b64(rawBody)}` };

    default:
      return {};
  }
}
