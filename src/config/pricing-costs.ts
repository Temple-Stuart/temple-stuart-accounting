/**
 * PRICING-PAGE — the Alex-editable cost table behind /how-pricing-works.
 *
 * SOURCE OF TRUTH for dependencies: audit-reports/PRICING-AUDIT.md (per-module
 * external-API dependency map, cited file:line there). Do not add an API here
 * that the audit did not find, or drop one it did.
 *
 * HOW ALEX EDITS: set `monthlyCost` (average $/month from the real invoice) on
 * any entry, and `monthlyPrice` on any product, then commit. No deploy magic —
 * the page renders whatever is here.
 *
 * FALLBACK TRIPWIRE (fail-loud): `monthlyCost: null` means "not yet entered
 * from an invoice" and renders as an explicit empty state — NEVER as $0 and
 * never as a guessed number. `0` is reserved for KNOWN-free services.
 * The only seeded non-zero number is Finnhub ($550/mo FIXED — known true).
 * TastyTrade is $0 by Alex's ruling (2026-07-08): users connect their own
 * TastyTrade account, so the platform pays nothing.
 */

export type ProductId =
  | 'trading'
  | 'travel'
  | 'operations'
  | 'bookkeeping'
  | 'tax'
  | 'hub-calendar'
  | 'compliance';

/** Non-product cost-sharers that appear in split math but are not sold modules. */
export type SharerId = ProductId | 'personal' | 'platform';

export type CostType = 'FIXED' | 'PER_USE' | 'COMMISSION' | 'FREE' | 'UNKNOWN';

export type CostCadence =
  | 'monthly'
  | 'yearly'
  | 'per-call'
  | 'per-token'
  | 'per-booking'
  | 'per-item'
  | 'per-transaction'
  | 'free';

export interface ApiCostEntry {
  id: string;
  name: string;
  usedFor: string;
  /** Every module/sharer that fires it (PRICING-AUDIT.md §2). >1 = SHARED. */
  modules: SharerId[];
  costType: CostType;
  cadence: CostCadence | null;
  /**
   * Average monthly cost in USD, entered by Alex from the real invoice.
   * null = not yet entered (renders "— not yet entered"). 0 = known-free.
   */
  monthlyCost: number | null;
  note?: string;
}

/** The vendor/API cost table — one row per real dependency found by the audit. */
export const API_COSTS: ApiCostEntry[] = [
  // ── Trading (PRICING-AUDIT.md §1 Trading) ──────────────────────────────
  {
    id: 'finnhub',
    name: 'Finnhub',
    usedFor: 'market data — fundamentals, estimates, news, insider, earnings quality (licensed subscription, Appendix A)',
    modules: ['trading'],
    costType: 'FIXED',
    cadence: 'monthly',
    monthlyCost: 550, // known true — the one seeded number
  },
  {
    id: 'tastytrade',
    name: 'TastyTrade',
    usedFor: 'option chains, quotes, greeks, positions, balances, backtests',
    modules: ['trading'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'users connect their OWN TastyTrade account — the platform pays nothing (Alex ruling, 2026-07-08)',
  },
  {
    id: 'fred',
    name: 'FRED',
    usedFor: 'macro + volatility-regime series (VIX, VIX3M, VVIX, credit spreads…)',
    modules: ['trading'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'free government API',
  },
  {
    id: 'sec-edgar',
    name: 'SEC EDGAR',
    usedFor: 'XBRL company facts, 10-K/8-K filing scans',
    modules: ['trading'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'free government API',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    usedFor: 'social/X sentiment on scanned tickers',
    modules: ['trading'],
    costType: 'PER_USE',
    cadence: 'per-token',
    monthlyCost: null,
  },

  // ── Shared LLM / data pools (PRICING-AUDIT.md §2 SHARED) ────────────────
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    usedFor: 'trading briefs/synthesis · operations planning, design, tasks, content · compliance discovery',
    modules: ['operations', 'trading', 'compliance'],
    costType: 'PER_USE',
    cadence: 'per-token',
    monthlyCost: null,
  },
  {
    id: 'plaid',
    name: 'Plaid',
    usedFor: 'bank/card transaction sync (bookkeeping) · investment holdings for cost basis (trading)',
    modules: ['bookkeeping', 'trading'],
    costType: 'PER_USE',
    cadence: 'per-item',
    monthlyCost: null,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    usedFor: 'spending insights (bookkeeping) · meal & cart planning (personal)',
    modules: ['bookkeeping', 'personal'],
    costType: 'PER_USE',
    cadence: 'per-token',
    monthlyCost: null,
  },
  {
    id: 'inngest',
    name: 'Inngest',
    usedFor: 'background jobs — operations AI pipeline, routine evaluator, compliance corpus ingest',
    modules: ['operations', 'compliance'],
    costType: 'UNKNOWN',
    cadence: null,
    monthlyCost: null,
    note: 'jobs SaaS with a free tier — cadence unknown, fill from invoice',
  },

  // ── Travel (PRICING-AUDIT.md §1 Travel — all dedicated) ─────────────────
  {
    id: 'duffel',
    name: 'Duffel',
    usedFor: 'flight search, offers, orders, payments',
    modules: ['travel'],
    costType: 'PER_USE',
    cadence: 'per-booking',
    monthlyCost: null,
    note: 'live booking behind a hard env gate; 25 bookings/day cap in code',
  },
  {
    id: 'liteapi',
    name: 'LiteAPI',
    usedFor: 'hotel search, rates, content, reviews, booking',
    modules: ['travel'],
    costType: 'COMMISSION',
    cadence: 'per-booking',
    monthlyCost: null,
    note: 'booking-commission model — confirm from contract; per-feature daily caps in code',
  },
  {
    id: 'viator',
    name: 'Viator',
    usedFor: 'activities + transfers search',
    modules: ['travel'],
    costType: 'COMMISSION',
    cadence: null,
    monthlyCost: null,
    note: 'affiliate revenue-share (Viator pays commission) — confirm from contract',
  },
  {
    id: 'google-places',
    name: 'Google Places',
    usedFor: 'trip discovery — POI search, geocode, details, photos',
    modules: ['travel'],
    costType: 'PER_USE',
    cadence: 'per-call',
    monthlyCost: null,
    note: 'hard cap: 5,000 calls/month enforced in code + 7-day cache',
  },
  {
    id: 'rapidapi-visa',
    name: 'RapidAPI Travel-Buddy (visa)',
    usedFor: 'visa-requirement lookups',
    modules: ['travel'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'free tier (5 checks/day cap sized to it); becomes per-use above the free tier',
  },
  {
    id: 'fetch-og',
    name: 'Listing previews (fetch-og)',
    usedFor: 'preview of user-pasted listing URLs (SSRF-guarded direct fetch)',
    modules: ['travel'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'no vendor — fetches public pages directly',
  },

  // ── Compliance (PRICING-AUDIT.md §1 Compliance) ─────────────────────────
  {
    id: 'voyage',
    name: 'Voyage AI',
    usedFor: 'embeddings + rerank for the regulatory corpus search',
    modules: ['compliance'],
    costType: 'PER_USE',
    cadence: 'per-token',
    monthlyCost: null,
  },
  {
    id: 'gov-data',
    name: 'Gov data (eCFR · US Code · Federal Register · IRS)',
    usedFor: 'regulation text ingest',
    modules: ['compliance'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
    note: 'free government APIs',
  },
];

/** Platform infrastructure — every product rides on it (allocated ÷ all products). */
export const INFRA_COSTS: ApiCostEntry[] = [
  { id: 'vercel', name: 'Vercel Pro', usedFor: 'hosting', modules: ['platform'], costType: 'FIXED', cadence: 'monthly', monthlyCost: null },
  { id: 'azure-postgres', name: 'Azure PostgreSQL', usedFor: 'database', modules: ['platform'], costType: 'FIXED', cadence: 'monthly', monthlyCost: null },
  { id: 'domain', name: 'Domain', usedFor: 'DNS / domain', modules: ['platform'], costType: 'FIXED', cadence: 'yearly', monthlyCost: null },
  { id: 'github', name: 'GitHub', usedFor: 'repo / CI', modules: ['platform'], costType: 'FIXED', cadence: 'monthly', monthlyCost: null },
  {
    id: 'stripe',
    name: 'Stripe',
    usedFor: 'payment processing for subscriptions',
    modules: ['platform'],
    costType: 'PER_USE',
    cadence: 'per-transaction',
    monthlyCost: null,
    note: '% + fee per transaction — scales with revenue, not usage',
  },
  {
    id: 'oauth',
    name: 'Google / GitHub OAuth',
    usedFor: 'sign-in only (no calendar or data scopes)',
    modules: ['platform'],
    costType: 'FREE',
    cadence: 'free',
    monthlyCost: 0,
  },
];

export interface ProductEntry {
  id: ProductId;
  name: string;
  what: string; // one honest line, no marketing filler
  /** ids into API_COSTS — must match PRICING-AUDIT.md §1 exactly */
  deps: string[];
  /**
   * The monthly price Alex charges — entered by Alex, never computed, never
   * fabricated. null = not yet set (renders "— not yet set").
   */
  monthlyPrice: number | null;
}

export const PRODUCTS: ProductEntry[] = [
  {
    id: 'trading',
    name: 'Trading',
    what: 'options convergence scanner, positions & greeks, backtests, outcome tracking',
    deps: ['finnhub', 'tastytrade', 'fred', 'sec-edgar', 'xai', 'anthropic', 'plaid'],
    monthlyPrice: null,
  },
  {
    id: 'travel',
    name: 'Travel',
    what: 'flight/hotel/activity search, trip budgets & itineraries, booking',
    deps: ['duffel', 'liteapi', 'viator', 'google-places', 'rapidapi-visa', 'fetch-og'],
    monthlyPrice: null,
  },
  {
    id: 'operations',
    name: 'Operations',
    what: 'projects with AI planning, routines, daily plan, content studio',
    deps: ['anthropic', 'inngest'],
    monthlyPrice: null,
  },
  {
    id: 'bookkeeping',
    name: 'Bookkeeping',
    what: 'bank sync, double-entry ledger, statements, reconciliation, period close',
    deps: ['plaid', 'openai'],
    monthlyPrice: null,
  },
  {
    id: 'tax',
    name: 'Tax',
    what: '1040 estimate, Schedule C/D + 8949 export, wash sales, CPA export',
    deps: [], // zero external APIs — verified in PRICING-AUDIT.md §1 Tax
    monthlyPrice: null,
  },
  {
    id: 'hub-calendar',
    name: 'Hub Calendar',
    what: 'unified calendar and budget timeline across every module',
    deps: [], // zero external APIs — verified in PRICING-AUDIT.md §1 Hub Calendar
    monthlyPrice: null,
  },
  {
    id: 'compliance',
    name: 'Compliance',
    what: 'regulatory corpus search, citations, discovery, SOC 2 audit registry',
    deps: ['anthropic', 'voyage', 'gov-data', 'inngest'],
    monthlyPrice: null,
  },
];

/** Vendors the audit found declared or referenced but NOT connected — zero cost, listed for completeness. */
export const NOT_CONNECTED = [
  'Airalo (eSIM — declared, not connected)',
  'Mozio (ground transport — declared, not connected)',
  'Cover Genius (insurance — declared, not connected)',
  'Ticketmaster (no reference in code)',
  'Yelp (dead code — no live caller, no cost)',
];
