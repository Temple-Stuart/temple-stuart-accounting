/**
 * Temple Stuart — Tier definitions & feature gating
 *
 * TRUTH-LABELS: what tiers ACTUALLY gate today (post TAB-SERVER-GATE):
 *   'ai'           → lifestyle/ops AI: meal-plan, cart-plan, meal-planner,
 *                    operations content (enrich-routine, generate-script)
 *   'placesSearch' → travel premium category search (dual-gated with
 *                    per-category entitlements)
 *   'tripAI'       → trip AI recommendations
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
  placesSearch: boolean;
  maxLinkedAccounts: number;
}

const TIER_MAP: Record<Tier, TierConfig> = {
  free: {
    label: 'Free',
    ai: false,
    manualEntry: true,
    tripPlanning: true,
    tripAI: false,
    placesSearch: false,
    maxLinkedAccounts: 0,
  },
  pro: {
    label: 'Pro',
    ai: false,
    manualEntry: true,
    tripPlanning: true,
    tripAI: false,
    placesSearch: true,
    maxLinkedAccounts: 10,
  },
  pro_plus: {
    label: 'Pro+',
    ai: true,
    manualEntry: true,
    tripPlanning: true,
    tripAI: true,
    placesSearch: true,
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
