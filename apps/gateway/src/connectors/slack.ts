/**
 * Slack webhook signature verification.
 *
 * Slack signs requests with HMAC-SHA256 over the base string
 *   v0:<timestamp>:<rawBody>
 * and sends the digest as `v0=<hex>` in the `X-Slack-Signature` header. The
 * timestamp travels separately in `X-Slack-Request-Timestamp` (unix seconds).
 *
 * The timestamp is part of the signed base string, which gives replay
 * protection: we reject deliveries whose timestamp is more than 5 minutes
 * from now (Slack's documented recommendation is 5 minutes).
 *
 * Docs: https://api.slack.com/authentication/verifying-requests-from-slack
 */
import type { WebhookVerifier } from './types';
import { hexDigest, timingSafeEqualString, checkTimestampFreshness } from '../utils/hmac';

const SIGNATURE_HEADER = 'X-Slack-Signature';
const TIMESTAMP_HEADER = 'X-Slack-Request-Timestamp';
/** Slack recommends rejecting requests older than 5 minutes. */
const TOLERANCE_SECONDS = 300;
/** Version prefix Slack prepends to both the base string and the signature. */
const VERSION = 'v0';

export const verifySlack: WebhookVerifier = {
  source: 'slack',
  headerName: SIGNATURE_HEADER,
  eventNameHeader: 'X-Slack-Event-Type',
  deliveryIdHeader: 'X-Slack-Request-Id',

  async verify({ secret, rawBody, headers }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const signature = headers.get(SIGNATURE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    if (!signature || !timestamp) {
      return { valid: false, reason: 'missing Slack signature or timestamp header' };
    }
    if (!signature.startsWith(`${VERSION}=`)) {
      return { valid: false, reason: `malformed ${SIGNATURE_HEADER} header` };
    }

    const staleReason = checkTimestampFreshness(Number(timestamp), TOLERANCE_SECONDS);
    if (staleReason) {
      return { valid: false, reason: staleReason };
    }

    const basestring = `${VERSION}:${timestamp}:${rawBody}`;
    const expected = await hexDigest(secret, basestring);
    const received = signature.slice(`${VERSION}=`.length);
    return timingSafeEqualString(received, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
