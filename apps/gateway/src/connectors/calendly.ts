/**
 * Calendly webhook signature verification.
 *
 * Calendly uses the same scheme as Stripe: the `Calendly-Webhook-Signature`
 * header is of the form `t=<unix-seconds>,v1=<hex>` where the HMAC-SHA256 is
 * computed over `${timestamp}.${rawBody}` using the webhook signing key.
 *
 * The timestamp is signed, which gives replay protection: we reject any
 * delivery whose timestamp is more than 5 minutes from now.
 *
 * Docs: https://developer.calendly.com/api-docs/webhooks/webhooks-guide
 */
import type { WebhookVerifier } from './types';
import { hexDigest, parseSignatureParams, timingSafeEqualString, checkTimestampFreshness } from '../utils/hmac';

const SIGNATURE_HEADER = 'Calendly-Webhook-Signature';
/** Tolerance window for replay protection (Calendly recommends 5 minutes). */
const TOLERANCE_SECONDS = 300;

export const verifyCalendly: WebhookVerifier = {
  source: 'calendly',
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
