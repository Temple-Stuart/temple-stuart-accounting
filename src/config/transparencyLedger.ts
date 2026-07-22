// FD-1e: the landing transparency table — the company's REAL operating bills,
// coded in the Temple Stuart dimensional standard (ENTITY-ACCOUNT-SUB-OBJECT ·
// Vendor · Links).
//
// PHASE-1 HONESTY CONTRACT:
//   • every row is one entry from src/config/pricing-costs.ts (the Alex-edited
//     invoice truth) — provenance cited per row; NOTHING renders that isn't in
//     that inventory;
//   • the codes are the company's DECLARED coding of those real bills — a
//     coding scheme applied to real invoices, NOT yet derived from a ledger
//     (that upgrade is the DIM arc). Per Alex's standard: B (business entity),
//     FIXED subscriptions → B-6210-xx-SUB, metered/per-use → B-5100-xx-API;
//     the xx sub-segments are declared here, sequentially per family;
//   • amounts are monthlyCost VERBATIM ($550, $0) or the entry's own truthful
//     state ("— not yet entered" for null-FIXED, the metered cadence for
//     null-PER_USE, the unconfirmed note for UNKNOWN) — zero invented numbers;
//   • Links render module attributions VERBATIM with /how-pricing-works' own
//     split vocabulary — "shared ÷ N" (equal split, allocatedShare, page
//     :53-56) or "dedicated" (:176). NO percentage figures exist anywhere in
//     the source, so none render.
//
// ROW-SELECTION RULE: every FIXED + PER_USE + UNKNOWN entry renders (real
// bills or real metered commitments). COMMISSION entries (LiteAPI, Viator) are
// EXCLUDED — the page's own legend says "vendor takes a cut of bookings — not
// a bill we pay" (how-pricing-works :113). FREE entries render ONLY where the
// $0 is a company-differentiating fact (TastyTrade's connect-your-own-account
// model :80; the free-government-data corpus :231) — free-tier plumbing (FRED,
// SEC EDGAR, RapidAPI visa free tier, fetch-og, OAuth) is excluded as clutter.
// FREE rows carry code '—': a $0 fact posts nothing, so there is nothing to
// code — never a decorative account string.

export interface TransparencyRow {
  /** ENTITY-ACCOUNT-SUB-OBJECT, or '—' for $0 facts (nothing posts). */
  code: string;
  /** Declared vendor short-code (config-declared, never render-derived). */
  vendor: string;
  /** The entry's own usedFor line — what the money actually was. */
  whatHappened: string;
  /** Display amount — monthlyCost verbatim or the entry's truthful state. */
  amount: string;
  /** Module attribution verbatim + the page's split vocabulary. */
  links: string;
}

export const TRANSPARENCY_ROWS: TransparencyRow[] = [
  // ── FIXED subscriptions → B-6210-xx-SUB ────────────────────────────────────
  // Finnhub — pricing-costs.ts:63-71 (monthlyCost 550, "known true — the one
  // seeded number"; modules ['trading'])
  {
    code: 'B-6210-10-SUB',
    vendor: 'FINN',
    whatHappened: 'Market data — fundamentals, estimates, news, insider, earnings quality',
    amount: '$550/mo',
    links: 'Trading — dedicated',
  },
  // Vercel Pro — pricing-costs.ts:237 (FIXED, monthlyCost null, platform)
  {
    code: 'B-6210-20-SUB',
    vendor: 'VRCL',
    whatHappened: 'Hosting',
    amount: '— not yet entered',
    links: 'Platform — shared ÷ all modules',
  },
  // Azure PostgreSQL — pricing-costs.ts:238 (FIXED, null, platform)
  {
    code: 'B-6210-30-SUB',
    vendor: 'AZUR',
    whatHappened: 'Database',
    amount: '— not yet entered',
    links: 'Platform — shared ÷ all modules',
  },
  // GitHub — pricing-costs.ts:240 (FIXED, null, platform)
  {
    code: 'B-6210-40-SUB',
    vendor: 'GHUB',
    whatHappened: 'Repo / CI',
    amount: '— not yet entered',
    links: 'Platform — shared ÷ all modules',
  },
  // Domain — pricing-costs.ts:239 (FIXED, yearly cadence, null, platform)
  {
    code: 'B-6210-50-SUB',
    vendor: 'DOM',
    whatHappened: 'DNS / domain',
    amount: '— not yet entered (billed yearly)',
    links: 'Platform — shared ÷ all modules',
  },

  // ── Metered / per-use → B-5100-xx-API ──────────────────────────────────────
  // Anthropic — pricing-costs.ts:113-121 (PER_USE per-token, null, modules
  // ['operations','trading','compliance'])
  {
    code: 'B-5100-10-API',
    vendor: 'ANTH',
    whatHappened: 'Trading briefs/synthesis · operations planning, design, tasks, content · compliance discovery',
    amount: 'metered · per token',
    links: 'Operations · Trading · Compliance — shared ÷ 3',
  },
  // OpenAI — pricing-costs.ts:131-139 (PER_USE per-token, null, ['bookkeeping','personal'])
  {
    code: 'B-5100-20-API',
    vendor: 'OAI',
    whatHappened: 'Spending insights (bookkeeping) · meal & cart planning (personal)',
    amount: 'metered · per token',
    links: 'Bookkeeping · Personal — shared ÷ 2',
  },
  // xAI (Grok) — pricing-costs.ts:102-110 (PER_USE per-token, null, ['trading'])
  {
    code: 'B-5100-30-API',
    vendor: 'XAI',
    whatHappened: 'Social/X sentiment on scanned tickers',
    amount: 'metered · per token',
    links: 'Trading — dedicated',
  },
  // Plaid — pricing-costs.ts:122-130 (PER_USE per-item, null, ['bookkeeping','trading'])
  {
    code: 'B-5100-40-API',
    vendor: 'PLD',
    whatHappened: 'Bank/card transaction sync · investment holdings for cost basis',
    amount: 'metered · per item',
    links: 'Bookkeeping · Trading — shared ÷ 2',
  },
  // Google Places — pricing-costs.ts:182-191 (PER_USE per-call, null,
  // ['travel'], note "hard cap: 5,000 calls/month enforced in code")
  {
    code: 'B-5100-50-API',
    vendor: 'GOOG',
    whatHappened: 'Trip discovery — POI search, geocode, details, photos (5,000 calls/mo cap in code)',
    amount: 'metered · per call',
    links: 'Travel — dedicated',
  },
  // Voyage AI — pricing-costs.ts:214-222 (PER_USE per-token, null, ['compliance'])
  {
    code: 'B-5100-60-API',
    vendor: 'VOYG',
    whatHappened: 'Embeddings + rerank for the regulatory corpus search',
    amount: 'metered · per token',
    links: 'Compliance — dedicated',
  },
  // Inngest — pricing-costs.ts:140-149 (UNKNOWN, null, ['operations','compliance'],
  // note "jobs SaaS with a free tier — cadence unknown, fill from invoice")
  {
    code: 'B-5100-70-API',
    vendor: 'INNG',
    whatHappened: 'Background jobs — operations AI pipeline, routine evaluator, compliance corpus ingest',
    amount: 'billing model unconfirmed — fills from the invoice',
    links: 'Operations · Compliance — shared ÷ 2',
  },
  // Duffel — pricing-costs.ts:152-161 (PER_USE per-booking, null, ['travel'])
  {
    code: 'B-5100-80-API',
    vendor: 'DUFL',
    whatHappened: 'Flight search, offers, orders, payments',
    amount: 'metered · per booking',
    links: 'Travel — dedicated',
  },
  // Stripe — pricing-costs.ts:241-250 (PER_USE per-transaction, null, platform,
  // note "% + fee per transaction — scales with revenue, not usage")
  {
    code: 'B-5100-90-API',
    vendor: 'STRP',
    whatHappened: 'Payment processing for subscriptions (% + fee per transaction)',
    amount: 'metered · per transaction',
    links: 'Platform — shared ÷ all modules',
  },

  // ── $0 facts worth stating (code '—': nothing posts, nothing to code) ──────
  // TastyTrade — pricing-costs.ts:72-81 (FREE, monthlyCost 0, note "users
  // connect their OWN TastyTrade account — the platform pays nothing")
  {
    code: '—',
    vendor: 'TT',
    whatHappened: 'Option chains, quotes, greeks, positions — users connect their own TastyTrade account; the platform pays nothing',
    amount: '$0',
    links: 'Trading — dedicated',
  },
  // Gov data — pricing-costs.ts:223-232 (FREE, 0, ['compliance'], "free government APIs")
  {
    code: '—',
    vendor: 'GOV',
    whatHappened: 'Regulation text ingest (eCFR · US Code · Federal Register · IRS) — free government APIs',
    amount: '$0',
    links: 'Compliance — dedicated',
  },
];
