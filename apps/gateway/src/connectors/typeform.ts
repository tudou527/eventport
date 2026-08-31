/**
 * Typeform webhook signature verification.
 *
 * Typeform signs the raw request body with HMAC-SHA256 using the webhook
 * secret and sends the digest, base64-encoded and prefixed with `sha256=`,
 * in the `Typeform-Signature` header:
 *   sha256=<base64-hmac-sha256(secret, rawBody)>
 *
 * Note: there is NO timestamp in the header, so Typeform signatures do not
 * provide replay protection at the signature layer. Consumers should dedupe
 * using the `event_id` field in the payload and detect stale events via
 * `submitted_at`.
 *
 * Docs: https://www.typeform.com/developers/webhooks/secure-your-webhooks/
 */
import type { WebhookVerifier } from './types';
import { base64Digest, timingSafeEqualString } from '../utils/hmac';

const SIGNATURE_HEADER = 'Typeform-Signature';
/** Prefix Typeform prepends to the base64 digest. */
const SIGNATURE_PREFIX = 'sha256=';

export const verifyTypeform: WebhookVerifier = {
  source: 'typeform',
  headerName: SIGNATURE_HEADER,

  async verify({ secret, rawBody, headers }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const sigHeader = headers.get(SIGNATURE_HEADER);
    if (!sigHeader) {
      return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    if (!sigHeader.startsWith(SIGNATURE_PREFIX)) {
      return { valid: false, reason: `malformed ${SIGNATURE_HEADER} header` };
    }
    const received = sigHeader.slice(SIGNATURE_PREFIX.length);
    const expected = await base64Digest(secret, rawBody);
    return timingSafeEqualString(received, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
