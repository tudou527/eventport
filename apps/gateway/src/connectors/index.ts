/**
 * Webhook verifier registry.
 *
 * Each source (GitHub, Linear, Stripe, ...) registers a verifier here. The
 * gateway's `handleWebhook` looks up the verifier by `subscriptions.source`
 * and calls `verify()` before storing the event.
 *
 * Sources without a registered verifier fall through to the `custom` path —
 * events are accepted without signature verification. This is the legacy
 * behavior for users who just want a passthrough webhook inbox and configure
 * their own transport-level security (e.g. IP allowlisting, mTLS).
 *
 * Adding a new source:
 *   1. Create `connectors/<source>.ts` exporting a `WebhookVerifier`.
 *   2. Register it in the `verifiers` map below.
 *   3. Add the source string to `apps/site/lib/tokens.ts` `SubscriptionSource`.
 */
import { verifyGitHub } from './github';
import { verifyLinear } from './linear';
import { verifyStripe } from './stripe';
import { verifySlack } from './slack';
import { verifyShopify } from './shopify';
import { verifyHubSpot } from './hubspot';
import { verifyCalendly } from './calendly';
import { verifyTypeform } from './typeform';
import type { WebhookVerifier } from './types';

export {
  verifyGitHub,
  verifyLinear,
  verifyStripe,
  verifySlack,
  verifyShopify,
  verifyHubSpot,
  verifyCalendly,
  verifyTypeform,
};
export type { WebhookVerifier } from './types';

const verifiers: Record<string, WebhookVerifier> = {
  github: verifyGitHub,
  linear: verifyLinear,
  stripe: verifyStripe,
  slack: verifySlack,
  shopify: verifyShopify,
  hubspot: verifyHubSpot,
  calendly: verifyCalendly,
  typeform: verifyTypeform,
};

/**
 * Look up the verifier for a source. Returns `null` for `custom` sources
 * (and any unregistered source) — callers treat `null` as "no verification
 * required" (passthrough mode).
 */
export function getVerifier(source: string): WebhookVerifier | null {
  return verifiers[source] ?? null;
}
