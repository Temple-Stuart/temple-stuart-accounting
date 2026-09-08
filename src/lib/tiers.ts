/**
 * Temple Stuart — Tier definitions & feature gating
 *
 * ── LEGACY VOCABULARY (PR-PRICE-2, Alex's ruling) ──────────────────────────
 * NOTHING SELLS TIERS — the landing deck's offer act and /pricing are THE
 * selling surfaces (SELL-02); both render src/lib/offer.ts (pricingModel.ts
 * died with it), and the Pro/Pro+ cards are gone. No surface names a tier price.
 * This file survives ONLY because live gates still read it (requireTier call
 * sites: ai/meal-plan, ai/cart-plan, ai/meal-planner, trips/[id]/ai-assistant;
 * the shopping page's canAccess twin) and existing subscriptions resolve
 * through it (webhook getTierFromPriceId). Retiring it fully = migrating those
 * gates to module entitlements or caps — its own ruled PR (SELL-05 reported the
 * readers and stopped), not a copy change.
 *
 * TRUTH-LABELS: what tiers ACTUALLY gate today (post TAB-SERVER-GATE, SELL-05):
 *   'ai'           → lifestyle AI: meal-plan, cart-plan, meal-planner
 *                    (Time's enrich-routine and generate-script moved under the
 *                    AI daily cap in SELL-05)
 *   'tripAI'       → trip AI recommendations
 *   'placesSearch' was RETIRED by SELL-05: places/category-search gates on a
 *                    signed-in user and the daily/monthly caps — zero readers.
 * The MODULES (Trade/Books/Tax/Compliance incl. Plaid sync, trading analytics,
 * wash sales, reconciliation, spending insights) are NOT tier features anymore —
 * they are per-tab entitlements (hasTabAccess, src/lib/entitlements.ts).
 * The orphaned 'plaid' and 'tradingAnalytics' flags were RETIRED by
 * TIER-FLAG-CLEANUP (zero live gate readers after TAB-SERVER-GATE).
 * maxLinkedAccounts is defined but not enforced — DEFERRED BY RULING
 * (audit-reports/MAXLINKED-RULING.md): no cap on tab:books buyers now;
 * usage-tiered pricing is a future feature.
 *
 * NOTE: All paid tiers are currently gated as "Coming Soon" for public users.
 * Only the admin user (ADMIN_USER_ID) has full access to all features.
 */

// Admin bypass — this user retains full access to all features
export const ADMIN_USER_ID = 'cmfi3rcrl0000zcj0ajbj4za5';

export type Tier = 'free' | 'pro' | 'pro_plus';

export interface TierConfig {
  label: string;
  ai: boolean;
  manualEntry: boolean;
  tripPlanning: boolean;
  tripAI: boolean;
  maxLinkedAccounts: number;
}

const TIER_MAP: Record<Tier, TierConfig> = {
  free: {
    label: 'Free',
    ai: false,
    manualEntry: true,
    tripPlanning: true,
    tripAI: false,
    maxLinkedAccounts: 0,
  },
  pro: {
    label: 'Pro',
    ai: false,
    manualEntry: true,
    tripPlanning: true,
    tripAI: false,
    maxLinkedAccounts: 10,
  },
  pro_plus: {
    label: 'Pro+',
    ai: true,
    manualEntry: true,
    tripPlanning: true,
    tripAI: true,
    maxLinkedAccounts: 25,
  },
};

export function getTierConfig(tier: string | null | undefined): TierConfig {
  const normalized = (tier || 'free').toLowerCase().replace('+', '_plus') as Tier;
  return TIER_MAP[normalized] || TIER_MAP.free;
}

export function canAccess(tier: string | null | undefined, feature: keyof TierConfig, userId?: string | null): boolean {
  // Admin bypass — full access to all features
  if (userId === ADMIN_USER_ID) return true;
  const config = getTierConfig(tier);
  return !!config[feature];
}

/**
 * Check if a user is the admin (full-access) user.
 */
export function isAdminUser(userId: string | null | undefined): boolean {
  return userId === ADMIN_USER_ID;
}
