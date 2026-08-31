/**
 * Stripe webhook signature verification.
 *
 * Stripe sends a `Stripe-Signature` header of the form:
 *   t=<unix-seconds>,v1=<hex-hmac-sha256>
 * where the HMAC is computed over `${timestamp}.${rawBody}` using the
 * endpoint's signing secret (whsec_...).
 *
 * The timestamp is part of the signed payload, which gives replay protection:
 * we reject any delivery whose timestamp is more than 5 minutes from now.
 *
 * Docs: https://docs.stripe.com/webhooks#verify-events
 */
import type { WebhookVerifier } from './types';
import { hexDigest, parseSignatureParams, timingSafeEqualString, checkTimestampFreshness } from '../utils/hmac';

const SIGNATURE_HEADER = 'Stripe-Signature';
/** Stripe's documented tolerance window for replay protection. */
const TOLERANCE_SECONDS = 300;

export const verifyStripe: WebhookVerifier = {
  source: 'stripe',
  headerName: SIGNATURE_HEADER,

  async verify({ secret, rawBody, headers }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const sigHeader = headers.get(SIGNATURE_HEADER);
    if (!sigHeader) {
      return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const params = parseSignatureParams(sigHeader);
    const timestamp = params.get('t');
    const signature = params.get('v1');
    if (!timestamp || !signature) {
      return { valid: false, reason: `malformed ${SIGNATURE_HEADER} header` };
    }

    const staleReason = checkTimestampFreshness(Number(timestamp), TOLERANCE_SECONDS);
    if (staleReason) {
      return { valid: false, reason: staleReason };
    }

    const expected = await hexDigest(secret, `${timestamp}.${rawBody}`);
    return timingSafeEqualString(signature, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
