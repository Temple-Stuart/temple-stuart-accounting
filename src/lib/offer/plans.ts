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

export type PlanId = 'personal' | 'business' | 'trading';

/** The ladder, cheapest first. A capability in an earlier plan is in every later one. */
export const PLAN_ORDER: readonly PlanId[] = ['personal', 'business', 'trading'];

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
/** Business & Personal's price. ONE constant. */
export const BUSINESS_PRICE: PlanPrice = { ...NO_PRICE };
/** Trading, Business & Personal's price. ONE constant. */
export const TRADING_PRICE: PlanPrice = { ...NO_PRICE };

export interface Plan {
  id: PlanId;
  /** The name on the card, and the column heading in the table. */
  name: string;
  /** One line: what this plan is for. */
  positioning: string;
  /** Who buys it. */
  audience: string;
  /** How it stands to the plan below it — the cumulative line. */
  relationship: string;
  /** Three, and no more — the card carries exactly these. */
  benefits: readonly [string, string, string];
  price: PlanPrice;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'personal',
    name: 'Personal',
    positioning: 'Know where your money goes, and what’s next.',
    audience: 'For students, creators and nomads.',
    relationship: 'Personal finance tools.',
    benefits: [
      'Every account in one place, and what you actually have.',
      'Your days and what they cost, on one calendar.',
      'Book the trip and keep the receipt.',
    ],
    price: PERSONAL_PRICE,
  },
  {
    id: 'business',
    name: 'Business & Personal',
    positioning: 'Run the business that funds your life.',
    audience: 'For founders, freelancers and small business owners.',
    relationship: 'Everything in Personal, plus business tools.',
    benefits: [
      'Get paid, pay people, and know what is left.',
      'Books that write themselves from what you already did.',
      'One set of records for you and the business.',
    ],
    price: BUSINESS_PRICE,
  },
  {
    id: 'trading',
    name: 'Trading, Business & Personal',
    positioning: 'Your book, your business, one set of records.',
    audience: 'For traders running their own money.',
    relationship: 'Everything in Business & Personal, plus the trading book.',
    benefits: [
      'Every fill finds its order and lands in the books.',
      'Positions and returns beside the rest of your money.',
      'The tax year is ready before April.',
    ],
    price: TRADING_PRICE,
  },
];

/** One line a customer would say they get, and the registry tools that owe it. */
export interface CapabilityRow {
  /** The customer's words. */
  label: string;
  /** The registry tool(s) that deliver it — the cell takes the WEAKEST of their states. */
  tools: readonly ToolName[];
  /** The cheapest plan that carries it; every plan above carries it too. */
  from: PlanId;
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
      { label: 'Every bank and card account in one place', tools: ['Banking'], from: 'personal' },
      { label: 'What you plan to spend, against what you did spend', tools: ['Budget'], from: 'personal' },
      { label: 'What you owe, and when it comes due', tools: ['Debt'], from: 'personal' },
      { label: 'Retirement accounts beside the rest of your money', tools: ['Retirement'], from: 'personal' },
      { label: 'The things you own that lose value over time', tools: ['Fixed Assets'], from: 'personal' },
    ],
  },
  {
    id: 'days',
    title: 'Plan your days and what they cost',
    rows: [
      { label: 'One calendar for plans, bookings and the day’s cost', tools: ['Calendar'], from: 'personal' },
      { label: 'Projects and routines, each with what it costs', tools: ['Tasks'], from: 'personal' },
      { label: 'Where the hours went', tools: ['Time'], from: 'personal' },
    ],
  },
  {
    id: 'travel',
    title: 'Travel',
    rows: [
      { label: 'Search and book flights, stays and tours on the trip', tools: ['Travel'], from: 'personal' },
      { label: 'Miles driven, priced for the return', tools: ['Mileage'], from: 'personal' },
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
      { label: 'Double-entry books written from what you already did', tools: ['Bookkeeping'], from: 'personal' },
      { label: 'Receipts matched to the charge that made them', tools: ['Expenses'], from: 'personal' },
    ],
  },
  {
    id: 'taxes',
    title: 'Taxes',
    rows: [
      { label: 'What you owe this year, updated as the money lands', tools: ['Tax'], from: 'personal' },
      { label: 'Sales tax collected, and when each state wants it', tools: ['Sales Tax'], from: 'business' },
    ],
  },
  {
    id: 'business',
    title: 'Run the business',
    rows: [
      { label: 'The people you sell to, and where each one stands', tools: ['CRM'], from: 'business' },
      { label: 'Contracts signed and what they committed you to', tools: ['Contracts'], from: 'business' },
      { label: 'Invoices out, and who has not paid', tools: ['Invoicing'], from: 'business' },
      { label: 'Money in, matched to the invoice that earned it', tools: ['Payments'], from: 'business' },
      { label: 'Bills scheduled and paid on time', tools: ['Bill Pay'], from: 'business' },
      { label: 'Payroll run, with the taxes it triggers', tools: ['Payroll'], from: 'business' },
      { label: 'Runway, margin and the forecast behind them', tools: ['FP&A'], from: 'business' },
    ],
  },
  {
    id: 'trading',
    title: 'Your trading book',
    rows: [
      { label: 'Positions and balances from your broker', tools: ['Brokerage'], from: 'trading' },
      { label: 'Every fill matched to its order, and the return it made', tools: ['Trade Log'], from: 'trading' },
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
      // THE LABEL SAYS "KEEPS", NOT "CLICK". Measured while reading: the pointer is written
      // but rendered on NO screen — JournalEntryEngine.tsx:22-37's JournalTxn carries no
      // source_type or source_id, and GeneralLedger.tsx renders none. So the row claims the
      // provenance the entry actually carries, and claims no click the surface does not
      // offer. Surfacing it is a later ruling.
      { label: 'Every entry keeps the bank transaction it was posted from', tools: ['Bookkeeping'], from: 'personal' },
      // THE TWO-TOOL ROW: filing on time needs both the filings tool and the
      // compliance state. Ent Filings is NOT_BUILT and Compliance is PARTIAL, so the
      // weakest wins and the cell reads "Coming" in every plan — the customer is told
      // they cannot do this end to end yet, not that the finished half is finished.
      { label: 'What the entity must file, when it is due, and whether it did', tools: ['Ent Filings', 'Compliance'], from: 'business' },
    ],
  },
];

/** What a cell says. `absent` is a plan below the row's `from` — this plan does not carry it. */
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

/** Does this plan carry this row? The ladder is cumulative — at or above the row's `from`. */
export function planCarries(plan: PlanId, row: Pick<CapabilityRow, 'from'>): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(row.from);
}

/** The state of one cell: absent below the row's plan, otherwise the weakest backing status through the one mapping. */
export function cellState(plan: PlanId, row: CapabilityRow, registry: readonly ToolEntry[] = TOOL_REGISTRY): CellState {
  if (!planCarries(plan, row)) return 'absent';
  return STATUS_TO_CELL[weakestStatus(row.tools, registry)];
}

/** One backing tool, as the opened group names it: its registry status and its OWN `why`, or null when the registry carries none. */
export interface CapabilityNote {
  name: ToolName;
  status: ToolStatus;
  why: string | null;
}

/**
 * What an opened group says about a row that is not ✓: each backing tool, its
 * status, and the registry's own `why` VERBATIM. A PARTIAL tool the registry
 * gives no `why` (the registry law requires one only at four beats) says nothing
 * more than its status — nothing is invented to fill the gap.
 */
export function capabilityNotes(row: CapabilityRow, registry: readonly ToolEntry[] = TOOL_REGISTRY): CapabilityNote[] {
  return row.tools.map((name) => {
    const tool = entryOf(name, registry);
    return { name, status: tool.status, why: tool.why?.trim() ? tool.why : null };
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
export type PriceSlot =
  | {
      kind: 'announced';
      figure: string;
      compareAt: string | null;
      discountNote: string | null;
      billingNote: string | null;
      cta: string;
    }
  | { kind: 'unannounced'; text: string; cta: string };

/** The words the slot says while no price is set. Typed once, here. */
export const LAUNCH_PLACEHOLDER = 'Pricing announced at launch';
export const EARLY_ACCESS_CTA = 'Join early access';

/** The slot for one plan, from its ONE price constant. No figure → the placeholder and the early-access door. */
export function priceSlot(plan: Pick<Plan, 'name' | 'price'>): PriceSlot {
  const p = plan.price;
  if (p.monthly === null) return { kind: 'unannounced', text: LAUNCH_PLACEHOLDER, cta: EARLY_ACCESS_CTA };
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

  // 1. Three plans, in the ladder's order, each named once.
  if (plans.length !== PLAN_ORDER.length) violations.push(`${plans.length} plans — the offer is ${PLAN_ORDER.length}`);
  plans.forEach((p, i) => {
    if (p.id !== PLAN_ORDER[i]) violations.push(`plan ${i + 1} is ${p.id}, not ${PLAN_ORDER[i]} — the ladder's order is the cumulative order`);
    if (p.benefits.length !== 3) violations.push(`${p.id}: ${p.benefits.length} benefit bullets — a card carries three`);
    for (const [field, value] of Object.entries({ positioning: p.positioning, audience: p.audience, relationship: p.relationship })) {
      if (!value.trim()) violations.push(`${p.id}: no ${field} line`);
    }
  });

  // 2. Every row names real registry tools; every tool is placed exactly once.
  const placed = new Map<string, string>();
  const ids = new Set<string>();
  for (const g of groups) {
    if (ids.has(g.id)) violations.push(`group ${g.id}: listed twice`);
    ids.add(g.id);
    if (g.rows.length === 0) violations.push(`group ${g.id}: holds no capability`);
    for (const row of g.rows) {
      if (row.tools.length === 0) violations.push(`${g.id} · "${row.label}": names no tool`);
      if (!(PLAN_ORDER as readonly string[]).includes(row.from)) violations.push(`${g.id} · "${row.label}": from "${row.from}" is not a plan`);
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
      for (const plan of PLAN_ORDER) {
        const state = cellState(plan, row, registry);
        if (state !== 'ready') continue;
        const notLive = row.tools.filter((name) => registry.find((t) => t.name === name)?.status !== 'LIVE');
        if (notLive.length) violations.push(`${g.id} · "${row.label}" reads ready for ${plan} while ${notLive.join(', ')} ${notLive.length === 1 ? 'is' : 'are'} not LIVE`);
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
  }

  if (violations.length && opts.throwOnFail !== false) throw new PlanLawError(violations.join('\n  '));
  return violations;
}

planLaw();
