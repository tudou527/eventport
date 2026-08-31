/**
 * Plan limit definitions (site-side copy).
 *
 * Keep in sync with apps/gateway/src/plans.ts — gateway uses it for runtime
 * rate limiting, site uses it for UI display and subscription count cap checks.
 * The two packages are deployed independently and cannot share code, so each
 * keeps its own copy. When changing values, update both sides.
 *
 * EventPort is open source. The single "custom" plan acts as an internal
 * anti-abuse quota; adjust the limits below to fit your deployment.
 */

export type PlanId = "custom";

export interface PlanLimits {
  /** Event retention duration (seconds). */
  eventTtlSeconds: number;
  /** Push count per minute from external platforms per subscription. null = no limit. */
  webhookRateLimitPerMinute: number | null;
  /** Cap on unacked events per subscription. Returns 429 + count when limit hit. null = no limit. */
  maxBacklog: number | null;
  /** Cap on subscriptions a user can create. null = no limit. */
  maxSubscriptions: number | null;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  custom: {
    eventTtlSeconds: 15 * 60,
    webhookRateLimitPerMinute: 20,
    maxBacklog: 300,
    maxSubscriptions: 3,
  },
};

/** CLI consumption rate limit (anti-abuse). */
export const CONSUMER_RATE_LIMIT_PER_MINUTE = 60;

const DEFAULT_PLAN: PlanId = "custom";

/** Normalize a string to a valid PlanId; unknown values fall back to custom. */
export function normalizePlan(raw: unknown): PlanId {
  return raw === "custom" ? "custom" : DEFAULT_PLAN;
}

/** Look up a plan's limits. Falls back to custom for unknown plans. */
export function getPlanLimits(plan: PlanId | string | null | undefined): PlanLimits {
  const id = normalizePlan(plan);
  return PLANS[id];
}
