/**
 * HubSpot webhook signature verification (v3 scheme).
 *
 * HubSpot includes two headers on every outbound request:
 *   X-HubSpot-Signature-v3       — HMAC-SHA256 digest, base64-encoded
 *   X-HubSpot-Request-Timestamp  — unix milliseconds when the request was sent
 *
 * The signed payload is the concatenation, in this exact order:
 *   <HTTP method> + <normalized URI> + <raw body> + <timestamp>
 *
 * where the URI is normalized by:
 *   - dropping any fragment (`#...`)
 *   - URL-decoding a specific set of characters (`: / ? @ ! $ ' ( ) * , ;`)
 *
 * The timestamp is part of the signed string, which gives replay protection:
 * we reject any delivery whose timestamp is more than 5 minutes from now.
 * (HubSpot's timestamp is in milliseconds, unlike Stripe/Slack/Calendly which
 * use seconds.)
 *
 * Docs: https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
import type { WebhookVerifier } from './types';
import { base64Digest, timingSafeEqualString } from '../utils/hmac';

const SIGNATURE_HEADER = 'X-HubSpot-Signature-v3';
const TIMESTAMP_HEADER = 'X-HubSpot-Request-Timestamp';
/** HubSpot's documented replay window. */
const TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Characters HubSpot URL-decodes in the URI before signing. These are the
 * RFC 3986 sub-delimiters plus a few gen-delimiters that HubSpot's signing
 * pipeline explicitly decodes. Encoding/decoding them inconsistently is the
 * most common cause of HubSpot signature mismatches.
 */
const DECODED_CHARS = [':', '/', '?', '@', '!', '$', "'", '(', ')', '*', ',', ';'];

/**
 * For each decoded character, a `[percentEncodedFormRegex, decodedChar]` rule.
 * The regex is case-insensitive so `%2F` and `%2f` both match.
 */
const DECODE_RULES: Array<[RegExp, string]> = DECODED_CHARS.map((ch) => {
  const encoded = '%' + ch.charCodeAt(0).toString(16).toUpperCase();
  return [new RegExp(escapedRegex(encoded), 'gi'), ch];
});

/** Escape regex metacharacters in a literal string. `%` is not special, but
 * keep this defensive in case the decoded-char set ever changes. */
function escapedRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a request URI the way HubSpot does before signing: drop the
 * fragment and URL-decode the specific set of reserved characters listed
 * above. Characters not in the set (e.g. `%20` for space) are left encoded.
 */
export function normalizeHubSpotUri(uri: string): string {
  let normalized = uri;
  const hashIndex = normalized.indexOf('#');
  if (hashIndex !== -1) {
    normalized = normalized.slice(0, hashIndex);
  }
  for (const [encoded, decoded] of DECODE_RULES) {
    normalized = normalized.replace(encoded, decoded);
  }
  return normalized;
}

export const verifyHubSpot: WebhookVerifier = {
  source: 'hubspot',
  headerName: SIGNATURE_HEADER,

  async verify({ secret, rawBody, headers, url, method }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const signature = headers.get(SIGNATURE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    if (!signature || !timestamp) {
      return { valid: false, reason: 'missing HubSpot signature or timestamp header' };
    }
    if (!url || !method) {
      return { valid: false, reason: 'missing request url or method' };
    }

    const tsMs = Number(timestamp);
    if (!Number.isFinite(tsMs)) {
      return { valid: false, reason: 'invalid timestamp' };
    }
    if (Math.abs(Date.now() - tsMs) > TOLERANCE_MS) {
      return { valid: false, reason: 'timestamp outside tolerance' };
    }

    const signedString = `${method}${normalizeHubSpotUri(url)}${rawBody}${timestamp}`;
    const expected = await base64Digest(secret, signedString);
    return timingSafeEqualString(signature, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
