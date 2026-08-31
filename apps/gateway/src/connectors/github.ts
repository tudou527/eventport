/**
 * GitHub webhook signature verification.
 *
 * GitHub signs every webhook with HMAC-SHA256 over the raw request body using
 * a shared secret configured by the user at the webhook settings page. The
 * signature is sent in the `X-Hub-Signature-256` header as `sha256=<hex>`.
 *
 * Docs: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 *
 * Implementation notes:
 *   - Uses Web Crypto (SubtleCrypto) so it runs natively in Cloudflare
 *     Workers without depending on node:crypto. As a result `verify()` is
 *     async (SubtleCrypto is async-only in Workers).
 *   - The comparison is constant-time: we compute our own HMAC and compare
 *     it byte-for-byte against the upstream signature using a diff-accumulating
 *     loop, never returning early on a mismatch.
 */
import type { WebhookVerifier } from './types';
import { hexDigest, timingSafeEqualString } from '../utils/hmac';

/** Header GitHub sends the signature in. */
const SIGNATURE_HEADER = 'X-Hub-Signature-256';
/** Header that names the event type (pull_request, issues, push, ...). */
const EVENT_HEADER = 'X-GitHub-Event';
/** Header GitHub sends with a unique delivery ID — logged for traceability. */
const DELIVERY_HEADER = 'X-GitHub-Delivery';
/** Prefix GitHub prepends to the hex digest. */
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Verify a GitHub webhook signature.
 *
 * - Resolves to `{ valid: true }` if the signature matches the secret + raw body.
 * - Resolves to `{ valid: false, reason }` when the signature is wrong or missing.
 *
 * No signature verification is performed when the subscription has no
 * `signing_secret` configured — we surface it as `valid: false` so the default
 * behavior is secure (callers must explicitly opt in to unsigned mode via the
 * `custom` source).
 */
export const verifyGitHub: WebhookVerifier = {
  source: 'github',
  headerName: SIGNATURE_HEADER,
  eventNameHeader: EVENT_HEADER,
  deliveryIdHeader: DELIVERY_HEADER,

  async verify({ secret, rawBody, headers }): Promise<{ valid: boolean; reason?: string }> {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }

    const signatureHeader = headers.get(SIGNATURE_HEADER);
    if (!signatureHeader) {
      return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
      return { valid: false, reason: `malformed ${SIGNATURE_HEADER} header` };
    }
    const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);

    // Compute the expected HMAC over the raw body (hex digest) using Web Crypto.
    const expectedHex = await hexDigest(secret, rawBody);

    // Constant-time compare: walk the full length even on mismatch.
    if (receivedHex.length !== expectedHex.length) {
      return { valid: false, reason: 'signature length mismatch' };
    }
    if (!timingSafeEqualString(receivedHex, expectedHex)) {
      return { valid: false, reason: 'signature mismatch' };
    }

    return { valid: true };
  },
};
