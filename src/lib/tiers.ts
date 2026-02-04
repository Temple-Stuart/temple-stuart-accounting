/**
 * Temple Stuart — Tier definitions & feature gating
 *
 * Free:  Manual entry only. No Plaid, no AI.
 * Pro:   Plaid sync + all bookkeeping features.
 * Pro+:  Everything in Pro + AI insights + trip AI + trading analytics.
 */

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

export function canAccess(tier: string | null | undefined, feature: keyof TierConfig): boolean {
  const config = getTierConfig(tier);
  return !!config[feature];
}
