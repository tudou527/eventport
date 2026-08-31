/**
 * Plan limits definition.
 *
 * EventPort is open source. The single 'custom' plan acts as an internal
 * anti-abuse quota; adjust the limits below to fit your deployment.
 *
 * Design rationale:
 *   - TTL controls how long offline consumers can catch up on missed events.
 *   - webhook rateLimit and maxBacklog serve both quota and system protection.
 *   - Consumer rate limiting is uniform — pure anti-abuse, no differentiation.
 *
 * Each plan defines 4 dimensions (null = unlimited):
 *   - eventTtlSeconds:           Event retention duration (seconds).
 *   - webhookRateLimitPerMinute: Max upstream pushes per minute per subscription.
 *   - maxBacklog:                Max unacked events per subscription; 429 + counter on hit.
 *   - maxSubscriptions:          Max subscriptions a user can create.
 *
 * Plan is stored in eg_users.plan. Adjust limits by editing this file and
 * redeploying the gateway.
 */

export type PlanId = 'custom';

export interface PlanLimits {
  /** Event retention duration (seconds). */
  eventTtlSeconds: number;
  /** Max upstream pushes per minute per subscription. null = unlimited. */
  webhookRateLimitPerMinute: number | null;
  /** Max unacked events per subscription. 429 + counter on hit. null = unlimited. */
  maxBacklog: number | null;
  /** Max subscriptions a user can create. null = unlimited. */
  maxSubscriptions: number | null;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  custom: {
    eventTtlSeconds: 15 * 60,              // 15 min; 20/min × 15min = 300, aligned with maxBacklog
    webhookRateLimitPerMinute: 20,
    maxBacklog: 300,
    maxSubscriptions: 3,
  },
};

/** CLI consumer rate limit (anti-abuse). 60/min = 1/sec. */
export const CONSUMER_RATE_LIMIT_PER_MINUTE = 60;
/** Rejected event counter retention (for dashboard trend display). */
export const REJECTED_EVENTS_RETENTION_SECONDS = 7 * 24 * 60 * 60; // 7 days

const DEFAULT_PLAN: PlanId = 'custom';

/** Normalize a string to a valid PlanId; unknown values fall back to custom. */
export function normalizePlan(raw: unknown): PlanId {
  return raw === 'custom' ? 'custom' : DEFAULT_PLAN;
}

/** Get the limits for a plan. Unknown plans fall back to custom. */
export function getPlanLimits(plan: PlanId | string | null | undefined): PlanLimits {
  const id = normalizePlan(plan);
  return PLANS[id];
}
