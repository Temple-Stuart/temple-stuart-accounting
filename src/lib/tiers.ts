/**
 * Temple Stuart — Tier definitions & feature gating
 *
 * Free:  Manual entry only. No Plaid, no AI.
 * Pro:   Plaid sync + all bookkeeping features.
 * Pro+:  Everything in Pro + AI insights + trip AI + trading analytics.
 *
 * NOTE: All paid tiers are currently gated as "Coming Soon" for public users.
 * Only the admin user (ADMIN_USER_ID) has full access to all features.
 */

// Admin bypass — this user retains full access to all features
export const ADMIN_USER_ID = 'cmfi3rcrl0000zcj0ajbj4za5';

export type Tier = 'free' | 'pro' | 'pro_plus';

export interface TierConfig {
  label: string;
  plaid: boolean;
  ai: boolean;
  manualEntry: boolean;
  tradingAnalytics: boolean;
  tripPlanning: boolean;
  tripAI: boolean;
  maxLinkedAccounts: number;
}

const TIER_MAP: Record<Tier, TierConfig> = {
  free: {
    label: 'Free',
    plaid: false,
    ai: false,
    manualEntry: true,
    tradingAnalytics: false,
    tripPlanning: true,
    tripAI: false,
    maxLinkedAccounts: 0,
  },
  pro: {
    label: 'Pro',
    plaid: true,
    ai: false,
    manualEntry: true,
    tradingAnalytics: true,
    tripPlanning: true,
    tripAI: false,
    maxLinkedAccounts: 10,
  },
  pro_plus: {
    label: 'Pro+',
    plaid: true,
    ai: true,
    manualEntry: true,
    tradingAnalytics: true,
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
