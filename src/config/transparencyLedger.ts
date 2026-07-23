// FD-1e → FD-1f v3 → FD-1j: the landing transparency SCHEDULE — the company's
// real operating bills coded in ALEX'S DECLARED TAXONOMY (the D-TEMPLATE
// slice): every dimension is CODE + MEANING, and SUB is a CATEGORY slice (what
// kind of spend), never a per-vendor serial — multiple vendors share a sub;
// VENDOR answers who.
//
// FD-1j (1NF): the RENDERED table is FIRST NORMAL FORM — one allocation per
// row (Alex's verdict: three targets crammed into one cell is not how data
// works). The authorable source stays one record per BILL (SCHEDULE_BILLS,
// provenance comment per bill); ALLOCATION_ROWS below derives the per-
// allocation records the table renders.
//
// FD-1l → FD-1m (D-VOCAB): target names are the CANONICAL PILLAR VOCABULARY —
// the nine pillar names (Travel, Runway, Books, Trade, Tax, Compliance,
// Routines, Projects, Content), period. Alex's ruled mapping killed the
// pricing-costs synonyms on this surface (Trading→Trade, Bookkeeping→Books,
// Operations→Projects), and FD-1m killed Personal: chips must map to real
// platform pillars, and no Personal tab exists — OAI allocates wholly to
// Books. The bill descriptions keep their verbatim pricing-costs usedFor
// prose (provenance, not vocabulary).
//
// PHASE-1 HONESTY CONTRACT (unchanged from FD-1e):
//   • every row is one entry from src/config/pricing-costs.ts (the Alex-edited
//     invoice truth) — provenance cited per row; NOTHING renders outside it;
//   • the codes are the company's DECLARED coding of real bills, NOT ledger
//     derivation (that upgrade is the DIM arc's phase-2);
//   • amounts are monthlyCost VERBATIM (allocated ÷ target count per 1NF row)
//     or a dash + footnote — zero invented numbers; SPLIT is each row's even
//     share of its bill: 100 (dedicated) or the equal-split percentage with
//     the ᵉ footnote (the allocatedShare methodology, /how-pricing-works
//     :53-56) — platform bills explode to one row per module at 11.1ᵉ (the
//     former '÷ all' cell) — no other figures exist to show;
//   • D-SPLITS: splits are the declared even-split methodology EXCEPT rows
//     whose bill carries an ALEX-RULED comment — those targets are the
//     owner's explicit allocation ruling, recorded at the bill.
//
// ROW-SELECTION RULE (FD-1e, unchanged): FIXED + PER_USE + UNKNOWN entries
// render; COMMISSION entries are excluded ("not a bill we pay",
// how-pricing-works :113); FREE rows render only in the $0 strip where the
// zero is a company-differentiating fact (TastyTrade :80, gov data :231).
// 5100-20 (Market data per-call) is RESERVED in the taxonomy — no bill is
// entered under it, so it renders NO row.

// ─── The taxonomy — Alex's declared dimension vocabulary ─────────────────────

export const ENTITY_DIM: Record<string, string> = {
  B: 'Business',
};

export const ACCOUNT_DIM: Record<string, string> = {
  '5100': 'API & Data (COGS)',
  '6210': 'Fixed Subscriptions',
};

export const SUB_DIM: Record<string, Record<string, string>> = {
  '5100': {
    '10': 'AI inference',
    // '20': Market data per-call — RESERVED (no bill entered; renders no row).
    '30': 'Travel APIs',
    '40': 'Banking & financial data',
    '50': 'Background compute',
    '60': 'Payment processing',
  },
  '6210': {
    '10': 'Data subscriptions',
    '20': 'Infrastructure',
    '30': 'Domains',
  },
};

export const OBJECT_DIM: Record<string, string> = {
  API: 'usage-billed',
  SUB: 'subscription',
};

export const VENDOR_DIM: Record<string, string> = {
  ANTH: 'Anthropic',
  OAI: 'OpenAI',
  XAI: 'xAI',
  VOYG: 'Voyage AI',
  DUFL: 'Duffel',
  GOOG: 'Google',
  PLD: 'Plaid',
  INNG: 'Inngest',
  STRP: 'Stripe',
  FINN: 'Finnhub',
  VRCL: 'Vercel',
  AZUR: 'Azure',
  GHUB: 'GitHub',
  DOM: 'registrar',
};

// ─── Footnote registry (unicode marks live in the data strings) ──────────────

export const FOOTNOTES: Record<string, string> = {
  'ᵃ': 'metered — billed per use; no fixed monthly bill exists',
  'ᵇ': 'not yet entered from an invoice — never estimated',
  'ᶜ': 'billing model unconfirmed — fills from the invoice',
  'ᵈ': 'billed yearly',
  'ᵉ': 'even split across the modules that fire it (the equal-split allocation, /how-pricing-works allocatedShare :53-56)',
};

// ─── The schedule source — one record per BILL ───────────────────────────────
// The readable, provenance-commented source of truth: one entry per real
// pricing-costs.ts bill. The table does NOT render these directly — FD-1j's
// ALLOCATION_ROWS below explodes each bill × target into 1NF records.

export interface ScheduleBill {
  entity: string;   // ENTITY_DIM key
  account: string;  // ACCOUNT_DIM key
  sub: string;      // SUB_DIM[account] key
  object: string;   // OBJECT_DIM key
  vendor: string;   // VENDOR_DIM key — unique per bill (the bill identity)
  description: string;         // the entry's own usedFor line
  basis: string;               // the entry's costType, page-legend vocabulary
  cadence: string;             // the entry's cadence, verbatim
  // FD-1g/FD-1j: ALLOCATED TO — the allocation targets. A bill divides EVENLY
  // across its targets (the equal-split allocation, /how-pricing-works
  // allocatedShare :53-56); each target's split % and allocated $ are DERIVED
  // in the 1NF explosion below, never stored twice. type drives the RENDER:
  // 'module' targets render bare; project/routine/trip targets render with a
  // PROJECT:/ROUTINE:/TRIP: prefix (none exist in the current declared rows —
  // the shape is ready for the ledger-derived version).
  allocatedTo: { type: 'module' | 'project' | 'routine' | 'trip'; name: string }[];
  amountUsd: number | null;    // the BILL's monthlyCost VERBATIM; null → dash + footnote
  footnotes: string[];         // marks into FOOTNOTES
}

// FD-1j: the former '÷ all' platform cell explodes to one row PER MODULE
// (Alex's ruling). The module vocabulary is the landing's own nine pillars —
// the module sheet / TAB_DESCRIPTORS / DIM-3 module_key vocabulary, NOT the
// seven-product legacy PRODUCTS list in pricing-costs.ts (tension flagged in
// the FD-1j report; /how-pricing-works :225 still divides by 7).
export const ALL_MODULES: ScheduleBill['allocatedTo'] = [
  'Travel', 'Runway', 'Books', 'Trade', 'Tax', 'Compliance', 'Routines', 'Projects', 'Content',
].map((name) => ({ type: 'module' as const, name }));

// Source order: ENTITY → ACCOUNT → SUB, vendors grouped within a sub (the 1NF
// derivation re-sorts ENTITY → ACCOUNT → SUB → VENDOR → target name).
export const SCHEDULE_BILLS: ScheduleBill[] = [
  // ── B-5100-10 · AI inference ──────────────────────────────────────────────
  // Anthropic — pricing-costs.ts:113-121 (PER_USE per-token, null,
  // modules ['operations','trading','compliance'])
  {
    entity: 'B', account: '5100', sub: '10', object: 'API', vendor: 'ANTH',
    description: 'Trading briefs/synthesis · operations planning, design, tasks, content · compliance discovery',
    basis: 'PER-USE', cadence: 'per token',
    allocatedTo: [{ type: 'module', name: 'Projects' }, { type: 'module', name: 'Trade' }, { type: 'module', name: 'Compliance' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },
  // OpenAI — pricing-costs.ts:131-139 (PER_USE per-token, null, ['bookkeeping','personal'])
  {
    entity: 'B', account: '5100', sub: '10', object: 'API', vendor: 'OAI',
    description: 'Spending insights (bookkeeping) · meal & cart planning (personal)',
    basis: 'PER-USE', cadence: 'per token',
    allocatedTo: [{ type: 'module', name: 'Books' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },
  // xAI (Grok) — pricing-costs.ts:102-110 (PER_USE per-token, null, ['trading'])
  {
    entity: 'B', account: '5100', sub: '10', object: 'API', vendor: 'XAI',
    description: 'Social/X sentiment on scanned tickers',
    basis: 'PER-USE', cadence: 'per token',
    allocatedTo: [{ type: 'module', name: 'Trade' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },
  // Voyage AI — pricing-costs.ts:214-222 (PER_USE per-token, null, ['compliance'])
  {
    entity: 'B', account: '5100', sub: '10', object: 'API', vendor: 'VOYG',
    description: 'Embeddings + rerank for the regulatory corpus search',
    basis: 'PER-USE', cadence: 'per token',
    allocatedTo: [{ type: 'module', name: 'Compliance' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },

  // ── B-5100-30 · Travel APIs ───────────────────────────────────────────────
  // Duffel — pricing-costs.ts:152-161 (PER_USE per-booking, null, ['travel'])
  {
    entity: 'B', account: '5100', sub: '30', object: 'API', vendor: 'DUFL',
    description: 'Flight search, offers, orders, payments',
    basis: 'PER-USE', cadence: 'per booking',
    allocatedTo: [{ type: 'module', name: 'Travel' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },
  // Google Places — pricing-costs.ts:182-191 (PER_USE per-call, null,
  // ['travel'], "hard cap: 5,000 calls/month enforced in code")
  {
    entity: 'B', account: '5100', sub: '30', object: 'API', vendor: 'GOOG',
    description: 'Trip discovery — POI search, geocode, details, photos (5,000 calls/mo cap in code)',
    basis: 'PER-USE', cadence: 'per call',
    allocatedTo: [{ type: 'module', name: 'Travel' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },

  // ── B-5100-40 · Banking & financial data ──────────────────────────────────
  // Plaid — pricing-costs.ts:122-130 (PER_USE per-item, null, ['bookkeeping','trading'])
  // ALEX-RULED (D-SPLITS-1): 100% to Books. Plaid feeds the ledger —
  // bank/card sync + investment cost basis are Books functions; Trade
  // consumes Books' output, not Plaid directly.
  {
    entity: 'B', account: '5100', sub: '40', object: 'API', vendor: 'PLD',
    description: 'Bank/card transaction sync · investment holdings for cost basis',
    basis: 'PER-USE', cadence: 'per item',
    allocatedTo: [{ type: 'module', name: 'Books' }],
    amountUsd: null, footnotes: ['ᵃ'],
  },

  // ── B-5100-50 · Background compute ────────────────────────────────────────
  // Inngest — pricing-costs.ts:140-149 (UNKNOWN, null, ['operations','compliance'],
  // "jobs SaaS with a free tier — cadence unknown, fill from invoice")
  {
    entity: 'B', account: '5100', sub: '50', object: 'API', vendor: 'INNG',
    description: 'Background jobs — operations AI pipeline, routine evaluator, compliance corpus ingest',
    basis: 'UNKNOWN', cadence: 'unconfirmed',
    allocatedTo: [{ type: 'module', name: 'Projects' }, { type: 'module', name: 'Compliance' }],
    amountUsd: null, footnotes: ['ᶜ'],
  },

  // ── B-5100-60 · Payment processing ────────────────────────────────────────
  // Stripe — pricing-costs.ts:241-250 (PER_USE per-transaction, null, platform,
  // "% + fee per transaction — scales with revenue, not usage")
  {
    entity: 'B', account: '5100', sub: '60', object: 'API', vendor: 'STRP',
    description: 'Payment processing for subscriptions (% + fee per transaction)',
    basis: 'PER-USE', cadence: 'per transaction',
    allocatedTo: ALL_MODULES,
    amountUsd: null, footnotes: ['ᵃ'],
  },

  // ── B-6210-10 · Data subscriptions ────────────────────────────────────────
  // Finnhub — pricing-costs.ts:63-71 (FIXED, monthlyCost 550 — "known true —
  // the one seeded number"; modules ['trading'])
  {
    entity: 'B', account: '6210', sub: '10', object: 'SUB', vendor: 'FINN',
    description: 'Market data — fundamentals, estimates, news, insider, earnings quality',
    basis: 'FIXED', cadence: 'monthly',
    allocatedTo: [{ type: 'module', name: 'Trade' }],
    amountUsd: 550, footnotes: [],
  },

  // ── B-6210-20 · Infrastructure ────────────────────────────────────────────
  // Vercel Pro — pricing-costs.ts:237 (FIXED, monthlyCost null, platform)
  {
    entity: 'B', account: '6210', sub: '20', object: 'SUB', vendor: 'VRCL',
    description: 'Hosting',
    basis: 'FIXED', cadence: 'monthly',
    allocatedTo: ALL_MODULES,
    amountUsd: null, footnotes: ['ᵇ'],
  },
  // Azure PostgreSQL — pricing-costs.ts:238 (FIXED, null, platform)
  {
    entity: 'B', account: '6210', sub: '20', object: 'SUB', vendor: 'AZUR',
    description: 'Database',
    basis: 'FIXED', cadence: 'monthly',
    allocatedTo: ALL_MODULES,
    amountUsd: null, footnotes: ['ᵇ'],
  },
  // GitHub — pricing-costs.ts:240 (FIXED, null, platform)
  {
    entity: 'B', account: '6210', sub: '20', object: 'SUB', vendor: 'GHUB',
    description: 'Repo / CI',
    basis: 'FIXED', cadence: 'monthly',
    allocatedTo: ALL_MODULES,
    amountUsd: null, footnotes: ['ᵇ'],
  },

  // ── B-6210-30 · Domains ───────────────────────────────────────────────────
  // Domain — pricing-costs.ts:239 (FIXED, yearly cadence, null, platform)
  {
    entity: 'B', account: '6210', sub: '30', object: 'SUB', vendor: 'DOM',
    description: 'DNS / domain',
    basis: 'FIXED', cadence: 'yearly',
    allocatedTo: ALL_MODULES,
    amountUsd: null, footnotes: ['ᵇ', 'ᵈ'],
  },
];

// ─── FD-1j: the 1NF derivation — one allocation per row ──────────────────────
// Row = one bill × one target. The identity columns repeat on every row (the
// render dims them on continuation rows — a styling choice only; the DATA is
// complete per row). SPLIT is THIS row's percent — the bill's even division:
// an integer share renders bare of decimals ('100', '50ᵉ'), otherwise one
// decimal ('33.3ᵉ', '11.1ᵉ'); multi-target rows carry the ᵉ mark. AMOUNT is
// THIS row's allocated dollars (bill amount ÷ target count) when the bill's
// amount is entered, else null → the dash + the bill's footnotes.

export interface ScheduleAllocationRow {
  entity: string;
  account: string;
  sub: string;
  object: string;
  vendor: string;
  description: string;
  basis: string;
  cadence: string;
  target: { type: 'module' | 'project' | 'routine' | 'trip'; name: string };
  splitPct: string;            // THIS row's share of its bill
  amountUsd: number | null;    // THIS row's allocated dollars
  footnotes: string[];
  /** Same bill as the previous row in sort order — the render dims the
   *  repeated identity cells (the row's data is still complete). */
  isContinuation: boolean;
}

function evenSplitPct(targetCount: number): string {
  const pct = 100 / targetCount;
  const shown = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return targetCount === 1 ? shown : `${shown}ᵉ`;
}

// Sort: ENTITY → ACCOUNT → SUB → VENDOR → target name (Alex's ruled order).
// isContinuation is stamped AFTER the sort; vendor codes are unique per bill,
// so vendor equality identifies a continuation row.
export const ALLOCATION_ROWS: ScheduleAllocationRow[] = SCHEDULE_BILLS
  .flatMap((bill) =>
    bill.allocatedTo.map((target) => ({
      entity: bill.entity, account: bill.account, sub: bill.sub,
      object: bill.object, vendor: bill.vendor,
      description: bill.description, basis: bill.basis, cadence: bill.cadence,
      target,
      splitPct: evenSplitPct(bill.allocatedTo.length),
      amountUsd: bill.amountUsd === null ? null : bill.amountUsd / bill.allocatedTo.length,
      footnotes: bill.footnotes,
      isContinuation: false,
    })),
  )
  .sort((a, b) =>
    a.entity.localeCompare(b.entity) ||
    a.account.localeCompare(b.account) ||
    a.sub.localeCompare(b.sub) ||
    a.vendor.localeCompare(b.vendor) ||
    a.target.name.localeCompare(b.target.name),
  )
  .map((row, i, rows) => ({
    ...row,
    isContinuation: i > 0 && rows[i - 1].vendor === row.vendor,
  }));

// ─── The $0 strip — real facts worth stating; nothing posts, nothing codes ───

export interface NoCostFact {
  vendor: string;       // display short-code (not in VENDOR_DIM — nothing codes)
  vendorLabel: string;
  description: string;
  allocatedTo: { type: 'module' | 'project' | 'routine' | 'trip'; name: string }[];
}

export const NO_COST_STRIP: NoCostFact[] = [
  // TastyTrade — pricing-costs.ts:72-81 (FREE, monthlyCost 0, "users connect
  // their OWN TastyTrade account — the platform pays nothing")
  {
    vendor: 'TT', vendorLabel: 'TastyTrade',
    description: 'Option chains, quotes, greeks, positions — users connect their own TastyTrade account; the platform pays nothing',
    allocatedTo: [{ type: 'module', name: 'Trade' }],
  },
  // Gov data — pricing-costs.ts:223-232 (FREE, 0, ['compliance'], "free government APIs")
  {
    vendor: 'GOV', vendorLabel: 'Gov data',
    description: 'Regulation text ingest (eCFR · US Code · Federal Register · IRS) — free government APIs',
    allocatedTo: [{ type: 'module', name: 'Compliance' }],
  },
];
