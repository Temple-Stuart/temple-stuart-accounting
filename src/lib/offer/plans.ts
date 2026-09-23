/**
 * OFFER-01 (2026-09-23) — THREE PLANS, THE WAY A COMMERCIAL PRODUCT SHOWS THEM.
 *
 * WHAT THIS REPLACES. The landing sold the BUILDER's view: a hero line counting
 * the registry ("Twenty-five tools, counted: two live, nine partial, fourteen on
 * the blueprint" — Landing.tsx:2010 and :2180 on main 3f84ac5d), offer cards
 * whose every tool wore the loop's own beat vocabulary ("partial — discover · decide",
 * src/lib/offer.ts claimLine), and a six-row persona grid headed "ONE SYSTEM ·
 * SIX LIVES" (Landing.tsx:2121-2158). A customer does not know what a beat is,
 * and a founder cannot scan his own offer. The count, the beats and the personas
 * stay in the registry and the audit trail, where they belong.
 *
 * THIS FILE IS DATA AND PURE FUNCTIONS. No fetch, no env, no clock, no React.
 * The three plans, their copy, the eight capability groups, the capability rows
 * and each row's tool mapping are DATA here; the component renders it and types
 * nothing of its own.
 *
 * THE ONE MAPPING, from the registry's status to what a cell says:
 *
 *   LIVE      → ✓        the job is done for a customer, on production
 *   PARTIAL   → ◐        with the registry's OWN `why` shown when the group opens
 *   NOT_BUILT → "Coming" no page or route does any of the tool's job
 *
 * A CAPABILITY BACKED BY SEVERAL TOOLS TAKES THE WEAKEST OF THEIR STATES.
 * `weakestStatus` ranks LIVE > PARTIAL > NOT_BUILT and returns the lowest, so a
 * row standing on one LIVE tool and one NOT_BUILT tool reads "Coming", never ✓.
 * No cell claims ✓ unless EVERY tool behind it is LIVE. That is the whole of the
 * derivation — a component may not compute a cell any other way.
 *
 * THE PRICE IS REAL BUT EMPTY. Each plan's price is ONE named constant below
 * (PERSONAL_PRICE · BUSINESS_PRICE · TRADING_PRICE), every field null. While the
 * monthly figure is null the slot renders "Pricing announced at launch" and a
 * "Join early access" button, in the geometry the figure, the struck-through
 * figure, the discount chip and the billing note will occupy. Setting three
 * prices later is an edit to three constants and nothing moves. There is no
 * invented price, discount, countdown, statistic or testimonial anywhere here.
 */
import { TOOL_REGISTRY, type ToolEntry, type ToolStatus } from '../toolRegistry';
import type { ToolName } from '../problemSheet';
import { TOOL_GATE } from '../offer';

/**
 * OFFER-03 (2026-09-23) — THE LADDER IS GONE; THERE ARE A BASE AND TWO MODULES.
 *
 * OFFER-01 sold three cumulative plans, so Trading sat above Business and a trader
 * with no company had to buy invoicing, payroll and sales tax to reach his trade
 * log. He does not. PERSONAL is the base everyone gets; BUSINESS and TRADING are
 * two INDEPENDENT modules that each couple with the base and neither requires the
 * other.
 *
 * A capability row carries the MODULE THAT OWNS IT, not the plan it starts in, and
 * a plan carries the SET OF MODULES it holds. A cell is set membership — no order,
 * no index comparison, nothing cumulative.
 */
export type ModuleId = 'personal' | 'business' | 'trading';

/** The three modules. Every capability row belongs to exactly one. */
export const MODULES: readonly ModuleId[] = ['personal', 'business', 'trading'];

/**
 * The four plans. Three ids are spelled like the module they add — `business` is
 * the plan "Personal + Business", whose module set is {personal, business} — and
 * `everything` is the bundle. The two vocabularies are kept apart by type: a row
 * has a ModuleId, a plan has a PlanId and a set of ModuleIds.
 */
export type PlanId = 'personal' | 'business' | 'trading' | 'everything';

/** The order the cards and the columns read in: the base, the two modules, the bundle. */
export const PLAN_ORDER: readonly PlanId[] = ['personal', 'business', 'trading', 'everything'];

/** One plan's price, in the geometry the card reserves. Every field null until Alex sets it. */
export interface PlanPrice {
  /** The figure, USD per month. null → the slot renders the launch placeholder. */
  monthly: number | null;
  /** The struck-through figure a discount is measured from. */
  compareAt: number | null;
  /** The discount chip beside the figure, e.g. "Save 20%". */
  discountNote: string | null;
  /** The line under the figure, e.g. "billed annually". */
  billingNote: string | null;
}

const NO_PRICE: PlanPrice = { monthly: null, compareAt: null, discountNote: null, billingNote: null };

/** Personal's price. ONE constant — set these four fields and the card fills itself. */
export const PERSONAL_PRICE: PlanPrice = { ...NO_PRICE };
/** Personal + Business's price. ONE constant. */
export const BUSINESS_PRICE: PlanPrice = { ...NO_PRICE };
/** Personal + Trading's price. ONE constant. */
export const TRADING_PRICE: PlanPrice = { ...NO_PRICE };
/** Everything's price. ONE constant. */
export const EVERYTHING_PRICE: PlanPrice = { ...NO_PRICE };

/**
 * OFFER-04 (2026-09-23) — THE SECTION SAYS WHAT IT MEANS.
 *
 * The heading read "One base, two modules. Take the one you need." — "base" and
 * "module" are THIS CODEBASE's words for how the plans are assembled, not words a
 * customer brings, and "two" standing beside four cards reads as a contradiction.
 * The model underneath is unchanged; only what it is CALLED on the screen changes.
 *
 * Both lines live here, with every other word the section says, so the component
 * still types no copy of its own.
 */
export const PLANS_HEADLINE = 'Four plans. One question: what do you run?';
export const PLANS_SUBHEAD = 'Everyone gets Personal. Add a business, a trading book, or both.';

export interface Plan {
  id: PlanId;
  /** The modules this plan holds. Every plan holds the base; the two modules are independent. */
  modules: readonly ModuleId[];
  /** The name on the card, and the column heading in the table. */
  name: string;
  /** One line: what this plan is for. */
  positioning: string;
  /** Who buys it. */
  audience: string;
  /** What this plan holds, in one line. */
  relationship: string;
  /**
   * The eyebrow over the plan's name — what this card IS, in the subhead's own
   * words. OFFER-04: the component used to type "The base", "The base + one
   * module" and "The bundle" here; a customer does not buy a base or a module, he
   * starts somewhere and adds what he runs.
   */
  role: string;
  /** Three, and no more — the card carries exactly these. */
  benefits: readonly [string, string, string];
  price: PlanPrice;
  /** The bundle alone reserves the "best value" position; it claims it only once a price exists. */
  reservesBestValue?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'personal',
    modules: ['personal'],
    name: 'Personal',
    positioning: 'Know where your money goes, and what’s next.',
    audience: 'For students, creators and nomads.',
    relationship: 'Your own money, start to finish.',
    role: 'Start here',
    benefits: [
      'Every account in one place, and what you actually have.',
      'Your days and what they cost, on one calendar.',
      'Book the trip and keep the receipt.',
    ],
    price: PERSONAL_PRICE,
  },
  {
    id: 'business',
    modules: ['personal', 'business'],
    name: 'Personal + Business',
    positioning: 'Run the business that funds your life.',
    audience: 'For founders, freelancers and small business owners.',
    relationship: 'Everything in Personal, plus the company.',
    role: 'Add a business',
    benefits: [
      'Get paid, pay people, and know what is left.',
      'Books that write themselves from what you already did.',
      'One set of records for you and the business.',
    ],
    price: BUSINESS_PRICE,
  },
  {
    // The module a trader buys: the base and the book, and NOT the company. This
    // plan is the whole point of OFFER-03 — under the cumulative ladder it did not
    // exist, and a trader had to buy invoicing, payroll and sales tax to reach it.
    id: 'trading',
    modules: ['personal', 'trading'],
    name: 'Personal + Trading',
    positioning: 'Your book and your own money, in one set of records.',
    audience: 'For traders running their own money.',
    relationship: 'Everything in Personal, plus the trading book.',
    role: 'Add a trading book',
    benefits: [
      'Every fill finds its order and lands in the books.',
      'Positions and returns beside the rest of your money.',
      'The tax year is ready before April.',
    ],
    price: TRADING_PRICE,
  },
  {
    id: 'everything',
    modules: ['personal', 'business', 'trading'],
    name: 'Everything',
    positioning: 'The company and the book, on one set of books.',
    audience: 'For founder-traders.',
    relationship: 'Personal, the company and the trading book, in one set of records.',
    role: 'Add both',
    benefits: [
      'One ledger for the business and the book.',
      'Every number traces to what actually happened.',
      'Nothing to reconcile between two systems.',
    ],
    price: EVERYTHING_PRICE,
    // The bundle is the one plan that will carry a "best value" mark. It RESERVES
    // the position now and CLAIMS nothing: with no price set there is no value to
    // compare, so the slot renders the geometry and no words (priceSlot below).
    reservesBestValue: true,
  },
];

/** One line a customer would say they get, and the registry tools that owe it. */
export interface CapabilityRow {
  /** The customer's words. */
  label: string;
  /** The registry tool(s) that deliver it — the cell takes the WEAKEST of their states. */
  tools: readonly ToolName[];
  /**
   * The module that owns this capability. OFFER-03 renamed the field from `from`
   * — under the ladder it named "the cheapest plan that carries it", and it is and
   * always was the module. EVERY VALUE IS UNCHANGED by this PR: no row changed
   * hands, 14 personal · 9 business · 2 trading, exactly as before.
   */
  module: ModuleId;
}

export interface CapabilityGroup {
  id: string;
  /** The group heading, collapsed by default. */
  title: string;
  rows: readonly CapabilityRow[];
}

/**
 * The eight groups, in the order the founder ruled. Every one of the registry's
 * twenty-five tools appears in exactly one row (COVERAGE below is a law).
 */
export const CAPABILITY_GROUPS: readonly CapabilityGroup[] = [
  {
    id: 'stand',
    title: 'Know where you stand',
    rows: [
      { label: 'Every bank and card account in one place', tools: ['Banking'], module: 'personal' },
      { label: 'What you plan to spend, against what you did spend', tools: ['Budget'], module: 'personal' },
      { label: 'What you owe, and when it comes due', tools: ['Debt'], module: 'personal' },
      { label: 'Retirement accounts beside the rest of your money', tools: ['Retirement'], module: 'personal' },
      { label: 'The things you own that lose value over time', tools: ['Fixed Assets'], module: 'personal' },
    ],
  },
  {
    id: 'days',
    title: 'Plan your days and what they cost',
    rows: [
      { label: 'One calendar for plans, bookings and the day’s cost', tools: ['Calendar'], module: 'personal' },
      { label: 'Projects and routines, each with what it costs', tools: ['Tasks'], module: 'personal' },
      { label: 'Where the hours went', tools: ['Time'], module: 'personal' },
    ],
  },
  {
    id: 'travel',
    title: 'Travel',
    rows: [
      { label: 'Search and book flights, stays and tours on the trip', tools: ['Travel'], module: 'personal' },
      { label: 'Miles driven, priced for the return', tools: ['Mileage'], module: 'personal' },
    ],
  },
  {
    id: 'books',
    title: 'Keep the books',
    rows: [
      // OFFER-02 (2026-09-23): both rows moved from 'business' to 'personal'. A personal
      // customer keeps books — Bookkeeping is the registry's LIVE tool, and starting it a
      // tier up left the entry plan with one ✓ and the finished accounting tool out of
      // reach. The line between Personal and Business is not the number of connected
      // accounts; it is what KIND of records you keep: one personal entity, against a
      // company with invoices, payroll, sales tax and filings — and those stay 'business'.
      { label: 'Double-entry books written from what you already did', tools: ['Bookkeeping'], module: 'personal' },
      { label: 'Receipts matched to the charge that made them', tools: ['Expenses'], module: 'personal' },
    ],
  },
  {
    id: 'taxes',
    title: 'Taxes',
    rows: [
      { label: 'What you owe this year, updated as the money lands', tools: ['Tax'], module: 'personal' },
      { label: 'Sales tax collected, and when each state wants it', tools: ['Sales Tax'], module: 'business' },
    ],
  },
  {
    id: 'business',
    title: 'Run the business',
    rows: [
      { label: 'The people you sell to, and where each one stands', tools: ['CRM'], module: 'business' },
      { label: 'Contracts signed and what they committed you to', tools: ['Contracts'], module: 'business' },
      { label: 'Invoices out, and who has not paid', tools: ['Invoicing'], module: 'business' },
      { label: 'Money in, matched to the invoice that earned it', tools: ['Payments'], module: 'business' },
      { label: 'Bills scheduled and paid on time', tools: ['Bill Pay'], module: 'business' },
      { label: 'Payroll run, with the taxes it triggers', tools: ['Payroll'], module: 'business' },
      { label: 'Runway, margin and the forecast behind them', tools: ['FP&A'], module: 'business' },
    ],
  },
  {
    id: 'trading',
    title: 'Your trading book',
    rows: [
      { label: 'Positions and balances from your broker', tools: ['Brokerage'], module: 'trading' },
      { label: 'Every fill matched to its order, and the return it made', tools: ['Trade Log'], module: 'trading' },
    ],
  },
  {
    id: 'proof',
    title: 'Proof and audit',
    rows: [
      // OFFER-02 (2026-09-23): the audit trail, split out of Bookkeeping's label into its
      // own row. THE TOOL THAT PROVES IT IS BOOKKEEPING, read rather than guessed:
      //   · the registry holds no Ledger tool and no audit tool — the twenty-five names are
      //     Calendar … FP&A (src/lib/problemSheet.ts, src/lib/toolRegistry.ts);
      //   · /ledger and /journal-entries BOTH redirect to /books (src/app/ledger/page.tsx:3-7,
      //     src/app/journal-entries/page.tsx:3-7 — "duplicated the Books cockpit's General
      //     Ledger section"), and /books is Bookkeeping's home (toolRegistry.ts:264);
      //   · the pointer itself is written by Bookkeeping's OWN writer —
      //     src/lib/journal-entry-service.ts:138-139 posts every entry with
      //     source_type: 'plaid_txn' and source_id: transactionId — and that file is in
      //     Bookkeeping's registry citation (toolRegistry.ts:266);
      //   · the chain reaches the provider's own bytes: ledger_entries.journal_entry_id
      //     (prisma/schema.prisma:228) → journal_entries.source_type/source_id →
      //     transactions, whose payload fields are kept as JSON (schema.prisma:539-543).
      // NOT this: /operations/audit-log is Tasks' link and is operations-filtered
      // (src/app/operations/audit-log/page.tsx:1-12), and writeAuditLog.ts is cited under
      // Compliance (toolRegistry.ts:276) — the SOC 2 who-changed-what, a different trail.
      //
      // THE LABEL SAYS "TRANSACTION", NOT "RECORD": "record" is one of the loop's four beat
      // names and the plan law forbids the whole word in this file — and "transaction" is
      // the exacter word anyway, since source_id IS a transactions row id.
      //
      // THE LABEL SAYS "OPEN" NOW (DRILL-01, 2026-09-23). OFFER-02 wrote "keeps, not
      // click" because the pointer was written and rendered on no screen. DRILL-01 put it
      // on both book surfaces: the journal's expanded row and the ledger's Source column
      // say where each entry came from, and a bank-transaction entry opens the row it
      // points at through /api/journal-entries/<id>/source. The label is the click the
      // product now offers — the derivation is unchanged, and the cell is still ✓ only
      // because Bookkeeping is the registry's LIVE tool.
      { label: 'Open the bank transaction any entry was posted from', tools: ['Bookkeeping'], module: 'personal' },
      // THE TWO-TOOL ROW: filing on time needs both the filings tool and the
      // compliance state. Ent Filings is NOT_BUILT and Compliance is PARTIAL, so the
      // weakest wins and the cell reads "Coming" in every plan — the customer is told
      // they cannot do this end to end yet, not that the finished half is finished.
      { label: 'What the entity must file, when it is due, and whether it did', tools: ['Ent Filings', 'Compliance'], module: 'business' },
    ],
  },
];

/** What a cell says. `absent` is a plan that does not hold the row's module. */
export type CellState = 'ready' | 'partial' | 'coming' | 'absent';

/** THE ONE MAPPING from a registry status to a cell state. Nothing else maps. */
export const STATUS_TO_CELL: Readonly<Record<ToolStatus, Exclude<CellState, 'absent'>>> = {
  LIVE: 'ready',
  PARTIAL: 'partial',
  NOT_BUILT: 'coming',
};

/** The mark a cell draws. The component reads this; it types no glyph of its own. */
export const CELL_MARK: Readonly<Record<CellState, string>> = {
  ready: '✓',
  partial: '◐',
  coming: 'Coming',
  absent: '—',
};

/** What a screen reader hears, so the glyph is never the only carrier. */
export const CELL_LABEL: Readonly<Record<CellState, string>> = {
  ready: 'included, and working today',
  partial: 'included, partly built',
  coming: 'not built yet',
  absent: 'not in this plan',
};

const STATUS_RANK: Readonly<Record<ToolStatus, number>> = { NOT_BUILT: 0, PARTIAL: 1, LIVE: 2 };

export class PlanLawError extends Error {
  constructor(message: string) {
    super(`PLAN LAW: ${message}`);
    this.name = 'PlanLawError';
  }
}

function entryOf(name: ToolName, registry: readonly ToolEntry[]): ToolEntry {
  const tool = registry.find((t) => t.name === name);
  if (!tool) throw new PlanLawError(`${name} is not a registry tool`);
  return tool;
}

/**
 * THE WEAKEST STATE WINS. A capability standing on several tools is only as done
 * as its least-done tool: one NOT_BUILT tool makes the whole row "Coming", one
 * PARTIAL makes it ◐. That is why no cell can claim ✓ unless every tool behind it
 * is LIVE — the customer is told what they can actually do end to end, not what
 * the best-finished part of it can do.
 */
export function weakestStatus(tools: readonly ToolName[], registry: readonly ToolEntry[] = TOOL_REGISTRY): ToolStatus {
  if (tools.length === 0) throw new PlanLawError('a capability row must name at least one registry tool');
  return tools
    .map((name) => entryOf(name, registry).status)
    .reduce((worst, s) => (STATUS_RANK[s] < STATUS_RANK[worst] ? s : worst));
}

/**
 * Does this plan carry this row? SET MEMBERSHIP — does the plan hold the module
 * that owns the capability. There is no order and nothing cumulative: Personal +
 * Trading holds {personal, trading}, so every business row is absent from it and
 * every trading row is present, which is the whole of OFFER-03.
 *
 * It takes the PLAN, not its id: a plan IS its module set, and reading the set off
 * a global by id would let a caller ask about a plan that is not in the list.
 */
export function planCarries(plan: Pick<Plan, 'modules'>, row: Pick<CapabilityRow, 'module'>): boolean {
  return plan.modules.includes(row.module);
}

/** The state of one cell: absent when the plan does not hold the row's module, otherwise the weakest backing status through the one mapping. */
export function cellState(plan: Pick<Plan, 'modules'>, row: CapabilityRow, registry: readonly ToolEntry[] = TOOL_REGISTRY): CellState {
  if (!planCarries(plan, row)) return 'absent';
  return STATUS_TO_CELL[weakestStatus(row.tools, registry)];
}

/** One backing tool, as the opened group names it: its registry status and its OWN `why`, or null when the registry carries none. */
export interface CapabilityNote {
  name: ToolName;
  status: ToolStatus;
  /**
   * The registry's CUSTOMER sentence. There is no `why` on this type: WHY-01 took
   * the builder's note off the public table for good, and a field that is not
   * carried cannot leak.
   */
  customer: string | null;
}

/**
 * What an opened group says about a row that is not ✓: each backing tool, its
 * status, and the registry's CUSTOMER sentence.
 *
 * WHY-01 (2026-09-23): this used to hand over the registry's `why` verbatim —
 * the builder's evidence, PR ids, table and pipeline names and all, straight onto
 * the public plans table. `why` is unchanged and still the laws' citation; it
 * simply never travels through here again. The plan law requires a `customer`
 * sentence of every tool a plan row can show as ◐ or Coming, so a null here means
 * a tool was added without one and the build has already failed by name — nothing
 * is invented to fill the gap.
 */
export function capabilityNotes(row: CapabilityRow, registry: readonly ToolEntry[] = TOOL_REGISTRY): CapabilityNote[] {
  return row.tools.map((name) => {
    const tool = entryOf(name, registry);
    return { name, status: tool.status, customer: tool.customer?.trim() ? tool.customer : null };
  });
}

/**
 * Travel's free line, under the cards — derived from the registry's Travel row
 * and its gate, never typed: the name is the registry's, "free" is TOOL_GATE
 * naming no tab key, and the line renders only while the tool is LIVE. A Travel
 * row that stops being LIVE, or gains a gate, stops saying this.
 */
export function travelFreeLine(registry: readonly ToolEntry[] = TOOL_REGISTRY, gate: Readonly<Record<string, string | null>> = TOOL_GATE): string | null {
  const travel = registry.find((t) => t.name === 'Travel');
  if (!travel || travel.status !== 'LIVE' || gate['Travel'] !== null) return null;
  return `${travel.name} is free: search and book flights, stays and tours without a plan.`;
}

/** The price slot the card renders — the placeholder until the plan's constant carries a figure. */
/**
 * The "best value" position. `null` — this plan never carries one. `reserved` —
 * the bundle carries one and there is NOTHING TO CLAIM: with no price set, no
 * value can be compared, so the position holds its geometry and says no words.
 * `claimed` — a price exists and the mark is earned.
 */
export type BestValue = null | 'reserved' | 'claimed';

export type PriceSlot =
  | {
      kind: 'announced';
      figure: string;
      compareAt: string | null;
      discountNote: string | null;
      billingNote: string | null;
      cta: string;
      bestValue: BestValue;
    }
  | { kind: 'unannounced'; text: string; cta: string; bestValue: BestValue };

/** The words the slot says while no price is set. Typed once, here. */
export const LAUNCH_PLACEHOLDER = 'Pricing announced at launch';
export const EARLY_ACCESS_CTA = 'Join early access';
/** The mark the bundle will wear once a price exists. Rendered ONLY when a slot claims it. */
export const BEST_VALUE_WORDS = 'Best value';

/** The slot for one plan, from its ONE price constant. No figure → the placeholder and the early-access door. */
export function priceSlot(plan: Pick<Plan, 'name' | 'price' | 'reservesBestValue'>): PriceSlot {
  const p = plan.price;
  const reserves = plan.reservesBestValue === true;
  if (p.monthly === null) {
    // Reserved, never claimed: the geometry is held so nothing moves when the
    // price lands, and no value is asserted over plans that have no price either.
    return { kind: 'unannounced', text: LAUNCH_PLACEHOLDER, cta: EARLY_ACCESS_CTA, bestValue: reserves ? 'reserved' : null };
  }
  if (!(Number.isFinite(p.monthly) && p.monthly > 0)) throw new PlanLawError(`${plan.name}: a price must be a positive number or null`);
  if (p.compareAt !== null && !(Number.isFinite(p.compareAt) && p.compareAt > p.monthly)) {
    throw new PlanLawError(`${plan.name}: compareAt must be above the price it is struck through for, or null`);
  }
  return {
    kind: 'announced',
    figure: `$${p.monthly}`,
    compareAt: p.compareAt === null ? null : `$${p.compareAt}`,
    discountNote: p.discountNote,
    billingNote: p.billingNote,
    cta: `Choose ${plan.name}`,
    bestValue: reserves ? 'claimed' : null,
  };
}

/**
 * THE PLAN LAW — module scope, and re-run at build by
 * scripts/assert-tool-registry.ts. Throws on the first violation unless asked
 * for the list.
 */
export function planLaw(opts: {
  throwOnFail?: boolean;
  plans?: readonly Plan[];
  groups?: readonly CapabilityGroup[];
  registry?: readonly ToolEntry[];
} = {}): string[] {
  const plans = opts.plans ?? PLANS;
  const groups = opts.groups ?? CAPABILITY_GROUPS;
  const registry = opts.registry ?? TOOL_REGISTRY;
  const violations: string[] = [];

  // 1. Four plans, in the reading order, each holding the base and a set of modules.
  if (plans.length !== PLAN_ORDER.length) violations.push(`${plans.length} plans — the offer is ${PLAN_ORDER.length}`);
  plans.forEach((p, i) => {
    if (p.id !== PLAN_ORDER[i]) violations.push(`plan ${i + 1} is ${p.id}, not ${PLAN_ORDER[i]} — the base reads first, then the two modules, then the bundle`);
    // EVERY PLAN HOLDS THE BASE. Personal is what everyone gets; a plan without it
    // would sell a module with nothing under it.
    if (!p.modules.includes('personal')) violations.push(`${p.id}: holds [${p.modules.join(', ')}] and not the base — Personal is what every plan starts from`);
    for (const m of p.modules) if (!(MODULES as readonly string[]).includes(m)) violations.push(`${p.id}: holds "${m}", which is not a module`);
    if (new Set(p.modules).size !== p.modules.length) violations.push(`${p.id}: names a module twice`);
    if (p.benefits.length !== 3) violations.push(`${p.id}: ${p.benefits.length} benefit bullets — a card carries three`);
    if (p.reservesBestValue === true && p.id !== 'everything') violations.push(`${p.id} reserves the best-value mark — only the bundle may`);
    for (const [field, value] of Object.entries({ positioning: p.positioning, audience: p.audience, relationship: p.relationship })) {
      if (!value.trim()) violations.push(`${p.id}: no ${field} line`);
    }
  });

  // EVERY MODULE IS SOLD BY AT LEAST ONE PLAN — a module no plan holds is a
  // capability nobody can buy, which is exactly what the ladder did to Trading.
  for (const m of MODULES) {
    if (!plans.some((p) => p.modules.includes(m))) violations.push(`the ${m} module is in no plan — its capabilities are unsellable`);
  }
  // AND THE TWO MODULES ARE INDEPENDENT: neither may be reachable only through the
  // other. There is a plan holding business and not trading, and one holding trading
  // and not business.
  for (const [have, without] of [['business', 'trading'], ['trading', 'business']] as const) {
    if (!plans.some((p) => p.modules.includes(have) && !p.modules.includes(without))) {
      violations.push(`${have} is only sold together with ${without} — the two modules are independent and each couples with the base alone`);
    }
  }

  // 2. Every row names real registry tools; every tool is placed exactly once.
  const placed = new Map<string, string>();
  const ids = new Set<string>();
  for (const g of groups) {
    if (ids.has(g.id)) violations.push(`group ${g.id}: listed twice`);
    ids.add(g.id);
    if (g.rows.length === 0) violations.push(`group ${g.id}: holds no capability`);
    for (const row of g.rows) {
      if (row.tools.length === 0) violations.push(`${g.id} · "${row.label}": names no tool`);
      if (!(MODULES as readonly string[]).includes(row.module)) violations.push(`${g.id} · "${row.label}": module "${row.module}" is not one of the three modules`);
      for (const name of row.tools) {
        if (!registry.some((t) => t.name === name)) { violations.push(`${g.id} · "${row.label}": ${name} is not a registry tool`); continue; }
        // OFFER-02 (2026-09-23): this read "a tool sits in exactly ONE ROW" until the
        // founder split the audit trail off Bookkeeping's label. Two rows can be two
        // genuinely different capabilities of one tool — keeping the books, and keeping
        // each entry's provenance — and a tool's cells cannot disagree, because every one
        // derives from the same registry status. What would still be a fault is the SAME
        // GROUP selling one tool twice, so that is what the clause forbids now; coverage
        // (every registry tool in at least one row) is checked below and is unchanged.
        const already = placed.get(name);
        if (already === g.id) violations.push(`${name}: named twice inside ${g.id} (again at "${row.label}") — one group sells a tool once`);
        placed.set(name, g.id);
      }
    }
  }
  for (const t of registry) {
    if (!placed.has(t.name)) violations.push(`${t.name}: in the registry and in no capability row — the table must account for every tool`);
  }

  // 3. No cell claims ✓ unless every tool behind it is LIVE, and nothing is typed.
  for (const g of groups) {
    for (const row of g.rows) {
      for (const plan of plans) {
        const state = cellState(plan, row, registry);
        // A CELL IS NEVER DRAWN FOR A MODULE THE PLAN DOES NOT HOLD.
        if (!plan.modules.includes(row.module) && state !== 'absent') {
          violations.push(`${g.id} · "${row.label}" renders "${state}" for ${plan.id}, which holds [${plan.modules.join(', ')}] and not the ${row.module} module`);
        }
        if (state !== 'ready') continue;
        const notLive = row.tools.filter((name) => registry.find((t) => t.name === name)?.status !== 'LIVE');
        if (notLive.length) violations.push(`${g.id} · "${row.label}" reads ready for ${plan.id} while ${notLive.join(', ')} ${notLive.length === 1 ? 'is' : 'are'} not LIVE`);
      }
    }
  }

  // 4. The price slot is the placeholder while the constant is unset.
  for (const p of plans) {
    const slot = priceSlot(p);
    if (p.price.monthly === null && slot.kind !== 'unannounced') violations.push(`${p.id}: no price is set and the slot is not the launch placeholder`);
    if (p.price.monthly === null && (p.price.compareAt !== null || p.price.discountNote !== null)) {
      violations.push(`${p.id}: a struck-through figure or a discount with no price behind it`);
    }
    // NO BEST-VALUE CLAIM WHILE THE PRICES ARE UNSET: with nothing to compare, the
    // position is reserved and the words are not said.
    if (p.price.monthly === null && slot.bestValue === 'claimed') {
      violations.push(`${p.id} claims "${BEST_VALUE_WORDS}" with no price set — there is no value to compare`);
    }
  }

  if (violations.length && opts.throwOnFail !== false) throw new PlanLawError(violations.join('\n  '));
  return violations;
}

planLaw();
