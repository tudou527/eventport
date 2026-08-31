/**
 * Linear webhook signature verification.
 *
 * Linear signs every webhook with HMAC-SHA256 over the raw request body using
 * the shared secret configured on the webhook subscription. The digest is sent
 * as a lowercase hex string in the `Linear-Signature` header.
 *
 * Docs: https://developers.linear.app/docs/webhooks
 *
 * No timestamp is signed, so there is no replay protection at the signature
 * layer — consumers should deduplicate by the `webhookId` payload field.
 */
import type { WebhookVerifier } from './types';
import { hexDigest, timingSafeEqualString } from '../utils/hmac';

const SIGNATURE_HEADER = 'Linear-Signature';

export const verifyLinear: WebhookVerifier = {
  source: 'linear',
  headerName: SIGNATURE_HEADER,

  async verify({ secret, rawBody, headers }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const received = headers.get(SIGNATURE_HEADER);
    if (!received) {
      return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    const expected = await hexDigest(secret, rawBody);
    return timingSafeEqualString(received, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
