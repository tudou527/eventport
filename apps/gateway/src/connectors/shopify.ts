/**
 * Shopify webhook signature verification.
 *
 * Shopify signs the raw request body with HMAC-SHA256 and sends the digest as
 * a base64 string in the `X-Shopify-Hmac-SHA256` header.
 *
 * No timestamp is signed, so there is no replay protection at the signature
 * layer — consumers should deduplicate by the `X-Shopify-Webhook-Id` header.
 *
 * Docs: https://shopify.dev/docs/apps/webhooks/configure#verify-a-webhook
 */
import type { WebhookVerifier } from './types';
import { base64Digest, timingSafeEqualString } from '../utils/hmac';

const SIGNATURE_HEADER = 'X-Shopify-Hmac-SHA256';

export const verifyShopify: WebhookVerifier = {
  source: 'shopify',
  headerName: SIGNATURE_HEADER,
  eventNameHeader: 'X-Shopify-Topic',
  deliveryIdHeader: 'X-Shopify-Webhook-Id',

  async verify({ secret, rawBody, headers }) {
    if (!secret) {
      return { valid: false, reason: 'no signing_secret configured for subscription' };
    }
    const received = headers.get(SIGNATURE_HEADER);
    if (!received) {
      return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    const expected = await base64Digest(secret, rawBody);
    return timingSafeEqualString(received, expected)
      ? { valid: true }
      : { valid: false, reason: 'signature mismatch' };
  },
};
