/**
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run") — THE HOW-TO, the home
 * page's services display. A visitor says what they run — Personal always, plus a business, trading, or both — and the
 * steps fill in, in order, across Personal, Business, Travel and Trade. src/components/landing/HowToSection.tsx draws it
 * and types none of these words.
 *
 * TYPED HERE, ONCE: the section's words, and the steps — each a number, a title, the tools that do it and, on a few, a
 * note. NEVER TYPED, anywhere:
 *   · a tool's status — read from TOOL_REGISTRY (src/lib/toolRegistry.ts). A step is LIVE when every tool in it is LIVE
 *     there, and PENDING otherwise;
 *   · a plan's name or its audience line — read from PLANS (src/lib/offer/plans.ts). What you run picks the plan whose
 *     modules are exactly personal, plus business when Business is on, plus trading when Trade is on; no such plan
 *     throws, by name;
 *   · whether Books is on sale — read from src/lib/offer.ts (booksNotOnSale, below).
 *
 * THE LAW (howToLaw — run at module scope, so a bad edit fails on import): the four sections in order; each section's
 * steps numbered 1..N; every tool a step names is a registry tool; every registry tool stands in at least one step; each
 * of the four choices resolves to exactly one plan; and (HOME-PLANS-01) every plan has a head in the comparison and no
 * head names anything else, and every tool a step names has a line.
 *
 * NOT HERE, on purpose (the board): no placeholder box, no "guide" line, no count of the tools.
 *
 * HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03: "the how-to should replace software plans … cards should be horizontal
 * swipe per P, B, T … clean these cards up"): on the home page THIS is the SOFTWARE PLANS block — the plan cards and the
 * comparison table stay on /pricing. So the label reads "Software plans"; under the plan line stand the plan's price line
 * and its button, read from priceSlot (src/lib/offer/plans.ts — never typed), and a link to the four plans; each section's
 * steps are one row that swipes sideways; and a card says less: its step and its state, the title, each tool with its
 * mark, its note. Off the card: its place among your steps, the section's name and the needs-Books tags — the one line
 * over the rows and the legend still say which steps need Books.
 *
 * HOME-PLANS-01 (Alex, 2026-11-11 00:09: "Four plans. One comparison. Clean, polished, professional." · "Do not display
 * development statuses on the public homepage." · "A checkmark means the capability is part of that plan's intended
 * offering. It does NOT represent implementation status or current availability."): the home page draws THE COMPARISON
 * now (planComparison, below) — the 26 steps of this file, by plan, under the four plan cards. A ✓ there says the step
 * is in the plan; it says nothing about what is built, and that view carries no status word.
 *   · KEPT, NOT DRAWN: the status view — howToView with its words, marks and counts, NEEDS_BOOKS, booksNotOnSale,
 *     planFor and the legend's words — stays here exactly as it was, with its tests. The public page reads it no more;
 *     the signed-in app is where the statuses will be shown. The switches' words and the link to /pricing stay with it.
 *   · THE COMPARISON TYPES, once: the first column's head, the four plan heads, the two marks with what a screen reader
 *     hears, and the count's words. It NEVER TYPES what a tool does — toolLine reads the plans leaf's capability rows
 *     (CAPABILITY_GROUPS, src/lib/offer/plans.ts) — nor whether a category is in a plan: that is the plan's modules
 *     through sectionShown.
 *   · ONE FIELD MOVED: Trade step 1's note is a build note, not an explanation for a customer — it is the step's
 *     `buildNote` now. The status view still shows it (a card's note is `note`, then `buildNote`); the comparison reads
 *     `note` alone.
 *
 * HOME-PLANS-03 (Alex, 2026-11-11 18:17 Manila: "take the table and have the steps listed inside the cards… as they
 * apply… so that there are just 4 neat cards … and no added table, to save room and look cleaner and more crisp"): the
 * home page draws THE CARDS' STEPS now (planCardSteps, below) — each of the four plan cards lists the steps that plan
 * ADDS, in place of its three benefit bullets — and the comparison table left the page.
 *   · KEPT, NOT DRAWN (2026-11-11): the comparison — planComparison with COMPARISON_FIRST_HEAD, PLAN_HEADS, toolLine, its
 *     clauses of the law and its tests — stays here exactly as it was. No page reads it; it has the same standing as
 *     the status view (howToView) above. PLAN_MARKS stays drawn: a step on a card wears its in-plan mark.
 *   · NOTHING TYPED FOR THE CARDS: which categories a card lists is DERIVED — every section the plan shows
 *     (sectionShown, for what it runs — choiceOf), minus every section shown for a plan whose modules are a strict
 *     subset of its own. What a card inherits, the plan's own `relationship` line says (src/lib/offer/plans.ts). A
 *     category's heading is categoryHeading; a step's title is the step's, read for what that plan runs. No tool, no
 *     note, no status.
 *   · DRAWN AGAIN: COMPARE_PLANS_WORDS and COMPARE_PLANS_PATH — the one link under the cards, to /pricing, where the
 *     plans' own comparison stands.
 *
 * PURE: no directive, no fetch, no clock, no storage.
 */

import type { ToolName } from './problemSheet';
import { TOOL_REGISTRY, type ToolEntry, type ToolStatus } from './toolRegistry';
import { CAPABILITY_GROUPS, PLANS, priceSlot, type CapabilityGroup, type CapabilityRow, type ModuleId, type Plan, type PlanId, type PriceSlot } from './offer/plans';
import { OFFERS, priceLineFor, type Offer } from './offer';

// ── THE WORDS ────────────────────────────────────────────────────────────────

// HOME-FINISH-02 (Alex, 2026-11-10 20:56): the block's label, its h2 and its one line left with their last reader — the Plan pillar's
// heading and paragraphs (src/lib/homeActWords.ts) stand over the tool now.
/** The label over the three, and the three: Personal is fixed, the other two are switches. */
export const WHAT_YOU_RUN_LABEL = 'What you run · add any';
export const PERSONAL_ALWAYS = 'Personal · always';
export const ADD_BUSINESS = '+ Business';
export const ADD_TRADE = '+ Trade';
/** After Personal, while neither Business nor Trade is on. */
export const NEXT_LINE = 'Next, earn abroad: run a business, trade, or both — add them above.';
/** HOME-BRIEF-04 (2026-11-10): beside the plan's button, the door to the four plans and their table. */
export const COMPARE_PLANS_WORDS = 'Compare all four plans →';
export const COMPARE_PLANS_PATH = '/pricing';
export const LEGEND_TITLE = 'How to read the marks';
export const LEGEND_STEP_LINE = 'A step is LIVE when every tool in it is live, and PENDING until then.';
/** The legend's last sentence — drawn only while Books is not on sale. */
export const LEGEND_BOOKS_LINE = 'NEEDS BOOKS: a new customer can’t use it until Books goes on sale — no price is set yet.';

/** A chip's tone — three of the design system's chip variants (src/lib/ds.ts chip), named here so the section types no status. */
export type HowToTone = 'success' | 'warning' | 'neutral';

/** A tool's mark, by its registry status: the word on the chip, its tone, and what it means (the legend). */
export const TOOL_MARKS: Readonly<Record<ToolStatus, { words: string; tone: HowToTone; means: string }>> = {
  LIVE: { words: 'LIVE', tone: 'success', means: 'done for a customer, on production' },
  PARTIAL: { words: 'PARTIAL', tone: 'warning', means: 'part of the job works' },
  NOT_BUILT: { words: 'NOT BUILT', tone: 'neutral', means: 'not built yet' },
};
/** The legend's three marks, in this order. */
export const LEGEND_ORDER: readonly ToolStatus[] = ['LIVE', 'PARTIAL', 'NOT_BUILT'];

/** A step's own state: LIVE when every tool in it is live, PENDING until then. */
export const STEP_LIVE = { words: 'LIVE', tone: 'success' } as const;
export const STEP_PENDING = { words: 'PENDING', tone: 'neutral' } as const;

/** "Your plan: <the plan's name>. <its audience line>" — both from PLANS. */
export function planLine(plan: Pick<Plan, 'name' | 'audience'>): string {
  return `Your plan: ${plan.name}. ${plan.audience}`;
}
/** "Your steps: <N>, in order — <X> live today, <Y> pending." */
export function stepsLine(total: number, live: number): string {
  return `Your steps: ${total}, in order — ${live} live today, ${total - live} pending.`;
}
/** "<K> of them need Books, and Books isn’t on sale yet." */
export function booksLine(needBooks: number): string {
  return `${needBooks} of them need Books, and Books isn’t on sale yet.`;
}
/** "STEP <n>" — a card's first line, the step's number in its own section (HOME-BRIEF-04; "<Section> · step <n>" and "YOUR STEP <place> OF <N>" until then). */
export function cardStep(n: number): string {
  return `STEP ${n}`;
}
/**
 * The plan's price line, from its slot (priceSlot, src/lib/offer/plans.ts): the launch words while no price is set; once
 * one is, the figure and its billing note. Nothing here is typed — every word is the slot's.
 */
export function priceLine(slot: PriceSlot): string {
  return slot.kind === 'unannounced' ? slot.text : [slot.figure, slot.billingNote].filter((part): part is string => part !== null && part !== '').join(' ');
}

// ── THE STEPS ────────────────────────────────────────────────────────────────

export type HowToSectionId = 'personal' | 'business' | 'travel' | 'trade';
/** The four sections, in the order the steps are counted. */
export const HOW_TO_SECTION_ORDER: readonly HowToSectionId[] = ['personal', 'business', 'travel', 'trade'];

/** What you run: Personal is everyone's; these two are the switches. */
export interface HowToChoice {
  business: boolean;
  trade: boolean;
}
/** The four choices, in the plans' order. */
export const HOW_TO_CHOICES: readonly HowToChoice[] = [
  { business: false, trade: false },
  { business: true, trade: false },
  { business: false, trade: true },
  { business: true, trade: true },
];

/** Words that read one way with Business on and another with it off. */
type ByBusiness = string | { withBusiness: string; withoutBusiness: string };
const say = (words: ByBusiness, choice: HowToChoice): string => (typeof words === 'string' ? words : choice.business ? words.withBusiness : words.withoutBusiness);

export interface HowToStep {
  /** Its number within its section, 1..N. */
  n: number;
  title: ByBusiness;
  /** The tools that do it, by registry name. */
  tools: readonly ToolName[];
  /** An explanation for a customer. Both views show it. */
  note?: string;
  /** HOME-PLANS-01: a note about what is built — the status view shows it; the comparison never does. */
  buildNote?: string;
}
export interface HowToSection {
  id: HowToSectionId;
  name: string;
  /** The letter(s) on the section's badge: P, B, T — Travel's follows the books a trip line can go to. */
  badge: ByBusiness;
  line: ByBusiness;
  steps: readonly HowToStep[];
}

export const HOW_TO_SECTIONS: readonly HowToSection[] = [
  {
    id: 'personal',
    name: 'Personal',
    badge: 'P',
    line: 'Your own money, days and books — everyone starts here.',
    steps: [
      { n: 1, title: 'Get your bank data.', tools: ['Banking'] },
      { n: 2, title: 'Turn it into financial statements.', tools: ['Bookkeeping'] },
      { n: 3, title: 'See your income and expenses.', tools: ['Expenses', 'Bill Pay'] },
      { n: 4, title: 'Know what living at home costs. That’s your benchmark.', tools: ['Budget'] },
      { n: 5, title: 'Know what you own and what you owe.', tools: ['Retirement', 'Brokerage', 'Fixed Assets', 'Debt'], note: 'Each account sits where you use it: your 401k here, the brokerage you trade options in under Trade.' },
      { n: 6, title: 'Plan your days and what they cost.', tools: ['Calendar', 'Tasks', 'Time'] },
      { n: 7, title: 'Plan ahead.', tools: ['FP&A'] },
      { n: 8, title: 'File your taxes.', tools: ['Tax'] },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    badge: 'B',
    line: 'Earning by running a business — on its own book.',
    steps: [
      { n: 1, title: 'Set up the business.', tools: ['Compliance', 'Ent Filings'] },
      { n: 2, title: 'Keep the business books separate.', tools: ['Banking', 'Bookkeeping', 'Debt', 'Fixed Assets'] },
      { n: 3, title: 'Find clients.', tools: ['CRM'] },
      { n: 4, title: 'Agree the work.', tools: ['Contracts'] },
      { n: 5, title: 'Bill and get paid.', tools: ['Invoicing', 'Payments'] },
      { n: 6, title: 'Do the work and count the hours.', tools: ['Tasks', 'Time'] },
      { n: 7, title: 'Pay your costs and your people.', tools: ['Bill Pay', 'Expenses', 'Payroll', 'Mileage'] },
      { n: 8, title: 'Pay your taxes.', tools: ['Tax', 'Sales Tax'] },
      { n: 9, title: 'Plan ahead.', tools: ['FP&A', 'Budget'] },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    badge: { withBusiness: 'P · B', withoutBusiness: 'P' },
    line: { withBusiness: 'Every trip line goes to Personal or Business — never a book of its own.', withoutBusiness: 'Every trip line goes to Personal — travel is never a book of its own.' },
    steps: [
      { n: 1, title: 'Plan the trip and book it.', tools: ['Travel', 'Calendar'] },
      { n: 2, title: 'Live it, day by day, and check it adds up.', tools: ['Tasks', 'Time'] },
      { n: 3, title: 'Log the miles you drive.', tools: ['Mileage'] },
      { n: 4, title: { withBusiness: 'Book every trip line to Personal or Business.', withoutBusiness: 'Book every trip line to Personal.' }, tools: ['Bookkeeping'] },
    ],
  },
  {
    id: 'trade',
    name: 'Trade',
    badge: 'T',
    line: 'Earning by trading — the account you trade in, on its own book.',
    steps: [
      { n: 1, title: 'Keep the trading book separate.', tools: ['Banking', 'Bookkeeping'], buildNote: 'No customer can open a trading book yet, so this step waits on that.' },
      { n: 2, title: 'Connect the account you trade.', tools: ['Brokerage'], note: 'The brokerage you trade options in. Your 401k stays under Personal.' },
      { n: 3, title: 'Log every trade.', tools: ['Trade Log'] },
      { n: 4, title: 'Pay taxes on your trades.', tools: ['Tax'] },
      { n: 5, title: 'Plan ahead.', tools: ['FP&A', 'Budget'] },
    ],
  },
];

/** Which sections a choice shows: Personal and Travel always; Business and Trade when their switch is on. */
export function sectionShown(id: HowToSectionId, choice: HowToChoice): boolean {
  return id === 'business' ? choice.business : id === 'trade' ? choice.trade : true;
}

// ── NEEDS BOOKS ──────────────────────────────────────────────────────────────

/**
 * The tools that do nothing for an account with no book (the 25-tool audit, 2026-11-08) — each re-read against the code
 * on 2026-11-10, and the code agrees with all six:
 *   · Banking     — connecting a bank is gated on the Books key (src/app/api/plaid/link-token/route.ts, requireTabAccess);
 *   · Bookkeeping — the ledger and the journal are gated on it (src/app/api/ledger/route.ts, src/app/api/journal-entries/route.ts);
 *   · Expenses    — a routine expense is written to a book: the POST refuses without an entity of the caller's
 *                   (src/app/api/operations/routines/route.ts);
 *   · Bill Pay    — the due list is built book by book from the caller's entities (src/app/api/bill-pay/route.ts);
 *   · Budget      — the report is read book by book from the caller's entities (src/app/api/budget/report/route.ts);
 *   · Tasks       — a task is written under a project, and a project needs a book (src/app/api/operations/projects/route.ts).
 * A book is opened only by POST /api/entities, which is gated on the Books key (src/app/api/entities/route.ts); sign-up
 * opens none.
 *
 * HOME-BRIEF-04 (Alex, 2026-11-10 19:00): four more, each behind a key that only a purchase of Books (or the bundle that
 * holds it) grants — src/lib/offer.ts OFFERS' grants — re-read in the code the same day:
 *   · Trade Log   — its room locks on the trade key (src/app/trade-log/page.tsx, useTabLock); the gate table names the
 *                   Books key for it (src/lib/offer.ts TOOL_GATE) — either way a key only Books grants;
 *   · Brokerage   — its room locks on the trade key (src/app/brokerage/page.tsx, useTabLock);
 *   · Tax         — the tax report is gated on the tax key (src/app/api/tax/report/route.ts, requireTabAccess);
 *   · Compliance  — its reads and writes are gated on the compliance key (src/app/api/discovery/profile/route.ts).
 */
export const NEEDS_BOOKS: readonly ToolName[] = ['Banking', 'Bookkeeping', 'Expenses', 'Bill Pay', 'Budget', 'Tasks', 'Trade Log', 'Brokerage', 'Tax', 'Compliance'];

/**
 * Is Books not on sale? Read from src/lib/offer.ts, never typed: the Books offer (OFFERS, key 'tab:books') through
 * priceLineFor — the state behind "Not for sale yet — no price is set." — is 'unset' and missing its price. That state
 * has a second half, the Stripe price id, which is a server env read (offerAvailabilityFromEnv) a pure leaf cannot make;
 * the sentences this gates say only that no price is set, which is exactly the half read here.
 */
export function booksNotOnSale(offers: readonly Offer[] = OFFERS): boolean {
  const books = offers.find((o) => o.key === 'tab:books');
  if (!books) throw new HowToLawError('howTo: src/lib/offer.ts holds no Books offer (key tab:books) — whether Books is on sale cannot be read');
  const price = priceLineFor(books, true);
  return price.kind === 'unset' && price.missing.includes('price');
}

// ── THE PLAN ─────────────────────────────────────────────────────────────────

export class HowToLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HowToLawError';
  }
}

/** The modules a choice runs: personal, plus business when Business is on, plus trading when Trade is on. */
export function modulesOf(choice: HowToChoice): readonly ModuleId[] {
  return ['personal', ...(choice.business ? (['business'] as const) : []), ...(choice.trade ? (['trading'] as const) : [])];
}

/** The one plan whose modules are exactly the choice's. None, or more than one, throws by name. */
export function planFor(choice: HowToChoice, plans: readonly Plan[] = PLANS): Plan {
  const want = modulesOf(choice);
  const found = plans.filter((p) => p.modules.length === want.length && want.every((m) => p.modules.includes(m)));
  if (found.length !== 1) {
    throw new HowToLawError(`howTo: ${found.length} plans hold exactly [${want.join(', ')}] (${found.map((p) => p.id).join(', ') || 'none'}) — what you run must pick one plan of src/lib/offer/plans.ts`);
  }
  return found[0];
}

// ── THE VIEW ─────────────────────────────────────────────────────────────────

export interface HowToToolMark {
  name: ToolName;
  /** The mark's word and tone, from the tool's registry status. */
  words: string;
  tone: HowToTone;
}
export interface HowToCard {
  /** "STEP <n>" */
  step: string;
  n: number;
  title: string;
  tools: readonly HowToToolMark[];
  live: boolean;
  /** LIVE or PENDING, with its tone. */
  state: { words: string; tone: HowToTone };
  /** True only while the step needs Books AND Books is not on sale — counted in the line over the rows; no tag rides on the card (HOME-BRIEF-04). */
  needsBooks: boolean;
  note: string | null;
}
export interface HowToSectionView {
  id: HowToSectionId;
  name: string;
  badge: string;
  line: string;
  cards: readonly HowToCard[];
  /** The line after the section's cards: NEXT_LINE after Personal while neither switch is on. */
  after: string | null;
}
export interface HowToView {
  /** The plan what you run picks — from PLANS. */
  plan: Plan;
  planLine: string;
  /** The plan's price line and its button's words, from priceSlot(plan). */
  price: { line: string; cta: string };
  stepsLine: string;
  /** Null unless Books is not on sale. */
  booksLine: string | null;
  legendBooksLine: string | null;
  sections: readonly HowToSectionView[];
  total: number;
  live: number;
  pending: number;
  needBooks: number;
}

const statusOf = (name: ToolName, registry: readonly ToolEntry[]): ToolStatus => {
  const tool = registry.find((t) => t.name === name);
  if (!tool) throw new HowToLawError(`howTo: ${name} is not a registry tool`);
  return tool.status;
};

/** Everything the section draws for one choice — every status from the registry, the plan from PLANS, Books' sale state from the offer. */
export function howToView(
  choice: HowToChoice,
  opts: { registry?: readonly ToolEntry[]; plans?: readonly Plan[]; sections?: readonly HowToSection[]; booksOnSale?: boolean } = {},
): HowToView {
  const registry = opts.registry ?? TOOL_REGISTRY;
  const sections = (opts.sections ?? HOW_TO_SECTIONS).filter((s) => sectionShown(s.id, choice));
  const gateOnBooks = opts.booksOnSale === undefined ? booksNotOnSale() : !opts.booksOnSale;
  const total = sections.reduce((sum, s) => sum + s.steps.length, 0);
  const views: HowToSectionView[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    badge: say(s.badge, choice),
    line: say(s.line, choice),
    cards: s.steps.map((step) => {
      const statuses = step.tools.map((name) => statusOf(name, registry));
      const live = statuses.every((status) => status === 'LIVE');
      return {
        step: cardStep(step.n),
        n: step.n,
        title: say(step.title, choice),
        tools: step.tools.map((name, i) => ({ name, words: TOOL_MARKS[statuses[i]].words, tone: TOOL_MARKS[statuses[i]].tone })),
        live,
        state: live ? STEP_LIVE : STEP_PENDING,
        needsBooks: gateOnBooks && step.tools.some((name) => NEEDS_BOOKS.includes(name)),
        note: step.note ?? step.buildNote ?? null,
      };
    }),
    after: s.id === 'personal' && !choice.business && !choice.trade ? NEXT_LINE : null,
  }));
  const cards = views.flatMap((v) => v.cards);
  const live = cards.filter((c) => c.live).length;
  const needBooks = cards.filter((c) => c.needsBooks).length;
  const plan = planFor(choice, opts.plans ?? PLANS);
  const slot = priceSlot(plan);
  return {
    plan,
    planLine: planLine(plan),
    price: { line: priceLine(slot), cta: slot.cta },
    stepsLine: stepsLine(total, live),
    booksLine: gateOnBooks ? booksLine(needBooks) : null,
    legendBooksLine: gateOnBooks ? LEGEND_BOOKS_LINE : null,
    sections: views,
    total,
    live,
    pending: total - live,
    needBooks,
  };
}

// ── THE COMPARISON ───────────────────────────────────────────────────────────
// HOME-PLANS-01 (Alex, 2026-11-11 00:09). What the home page draws under the four plan cards: the steps above, by plan.
// A mark says whether the step is IN THE PLAN — never whether it is built. Nothing below reads a tool's status.

/** The first column's head. */
export const COMPARISON_FIRST_HEAD = 'Step / Capability';

/** The four plan columns' heads, by plan id — short, so four columns sit beside the steps. The plan's full name is PLANS'; a screen reader hears it. */
export const PLAN_HEADS: Readonly<Record<PlanId, string>> = {
  personal: 'Personal',
  business: 'P + Business',
  trading: 'P + Trading',
  everything: 'All',
};

/** The two marks, each with what a screen reader hears. */
export const PLAN_MARKS = {
  inPlan: { mark: '✓', label: 'In this plan' },
  notInPlan: { mark: '—', label: 'Not in this plan' },
} as const;

/** "<n> steps" — "1 step" for one. */
export function stepCountWords(n: number): string {
  return n === 1 ? '1 step' : `${n} steps`;
}

/** A category's row: its name in capitals, then its count — "PERSONAL — 8 steps". */
export function categoryHeading(name: string, steps: number): string {
  return `${name.toUpperCase()} — ${stepCountWords(steps)}`;
}

/** What a plan runs, as a choice: Business when it holds the business module, Trade when it holds trading. */
export function choiceOf(plan: Pick<Plan, 'modules'>): HowToChoice {
  return { business: plan.modules.includes('business'), trade: plan.modules.includes('trading') };
}

/** The capability row that says what a tool does: the first row of the plans leaf that names it ALONE; when no row names it alone, the first row that names it. */
function capabilityRowOf(name: ToolName, groups: readonly CapabilityGroup[]): CapabilityRow | undefined {
  const naming = groups.flatMap((g) => g.rows).filter((row) => row.tools.includes(name));
  const alone = naming.filter((row) => row.tools.length === 1);
  return alone.length > 0 ? alone[0] : naming[0];
}

/**
 * What a tool does, in a customer's words — READ from the plans leaf's capability rows (CAPABILITY_GROUPS,
 * src/lib/offer/plans.ts), never retyped here. No row names the tool → a throw, by name.
 */
export function toolLine(name: ToolName, groups: readonly CapabilityGroup[] = CAPABILITY_GROUPS): string {
  const row = capabilityRowOf(name, groups);
  if (row === undefined) throw new HowToLawError(`howTo: no capability row of src/lib/offer/plans.ts names ${name} — the comparison has no line saying what it does`);
  return row.label;
}

export interface ComparisonColumn {
  /** The plan's id, from PLANS. */
  id: PlanId;
  /** The short head over the column. */
  head: string;
  /** The plan's full name — what a screen reader hears for the column. */
  name: string;
}
export interface ComparisonTool {
  /** The tool's name — or, when tools of one step share a line, their names together: "Compliance · Ent Filings". */
  name: string;
  /** What it does: a capability row's label from the plans leaf. */
  line: string;
}
export interface ComparisonStep {
  n: number;
  title: string;
  tools: readonly ComparisonTool[];
  /** The step's note for a customer — never its build note. */
  note: string | null;
}
export interface ComparisonCategory {
  id: HowToSectionId;
  name: string;
  /** How many steps it holds, and the words for that: "8 steps". */
  count: number;
  countWords: string;
  /** The category's row: "PERSONAL — 8 steps". */
  heading: string;
  line: string;
  /** One per column, in the columns' order: is this category in that plan? */
  inPlan: readonly boolean[];
  steps: readonly ComparisonStep[];
}
export interface PlanComparison {
  firstHead: string;
  columns: readonly ComparisonColumn[];
  categories: readonly ComparisonCategory[];
}

/** Words that read two ways take their with-Business reading in the comparison: it is one table for all four plans. */
const WITH_BUSINESS: HowToChoice = { business: true, trade: false };

/**
 * Everything the comparison draws: the four columns in PLANS' order; the four categories in HOW_TO_SECTION_ORDER, each
 * with its count, its line and, per plan, whether it is in the plan; each step with its tools and their lines. IN THE
 * PLAN is derived: a category is in a plan when sectionShown says so for what that plan runs (choiceOf).
 */
export function planComparison(
  opts: { plans?: readonly Plan[]; sections?: readonly HowToSection[]; groups?: readonly CapabilityGroup[] } = {},
): PlanComparison {
  const plans = opts.plans ?? PLANS;
  const sections = opts.sections ?? HOW_TO_SECTIONS;
  const groups = opts.groups ?? CAPABILITY_GROUPS;
  const heads: Readonly<Record<string, string>> = PLAN_HEADS;
  const columns: ComparisonColumn[] = plans.map((plan) => {
    const head = heads[plan.id];
    if (!head) throw new HowToLawError(`howTo: the plan "${plan.id}" has no head in the comparison — PLAN_HEADS names every plan of src/lib/offer/plans.ts`);
    return { id: plan.id, head, name: plan.name };
  });
  const categories: ComparisonCategory[] = HOW_TO_SECTION_ORDER.map((id) => {
    const section = sections.find((s) => s.id === id);
    if (!section) throw new HowToLawError(`howTo: the steps hold no "${id}" section — the comparison has no such category`);
    return {
      id: section.id,
      name: section.name,
      count: section.steps.length,
      countWords: stepCountWords(section.steps.length),
      heading: categoryHeading(section.name, section.steps.length),
      line: say(section.line, WITH_BUSINESS),
      inPlan: plans.map((plan) => sectionShown(section.id, choiceOf(plan))),
      steps: section.steps.map((step) => {
        // Tools of one step that share a line stand together on it.
        const tools: ComparisonTool[] = [];
        for (const name of step.tools) {
          const line = toolLine(name, groups);
          const at = tools.findIndex((t) => t.line === line);
          if (at === -1) tools.push({ name, line });
          else tools[at] = { name: `${tools[at].name} · ${name}`, line };
        }
        return { n: step.n, title: say(step.title, WITH_BUSINESS), tools, note: step.note ?? null };
      }),
    };
  });
  return { firstHead: COMPARISON_FIRST_HEAD, columns, categories };
}

// ── THE CARDS' STEPS ─────────────────────────────────────────────────────────
// HOME-PLANS-03 (Alex, 2026-11-11 18:17 Manila). What the home page draws INSIDE the four plan cards: the steps each plan
// ADDS. This part reads the plans' modules and the steps' titles — no tool, no note, nothing of what is built.

/** One category on a plan's card. */
export interface PlanCardCategory {
  id: HowToSectionId;
  /** Its heading: "PERSONAL — 8 steps" (categoryHeading). */
  heading: string;
  /** Its steps' titles, in order, each as it reads for what the plan runs. */
  steps: readonly string[];
}
/** What one plan's card lists. */
export interface PlanCardSteps {
  /** The plan's id. */
  plan: PlanId;
  /** The categories this plan adds, in the sections' order — none for a plan that adds none: its card keeps its benefits. */
  categories: readonly PlanCardCategory[];
}

/** Does `inner` hold fewer modules than `outer`, and none that `outer` lacks? */
const strictSubset = (inner: readonly ModuleId[], outer: readonly ModuleId[]): boolean => inner.every((m) => outer.includes(m)) && outer.some((m) => !inner.includes(m));

/**
 * What each plan's card lists, in the plans' order — DERIVED, nothing typed: every section the plan shows (sectionShown,
 * for what it runs), MINUS every section shown for a plan whose modules are a strict subset of this plan's. A card lists
 * what its plan ADDS; what it inherits, the plan's `relationship` line already says. Each step's title is read for that
 * plan's own choice, so words that read two ways take the plan's reading. A plan with no module throws, by name.
 */
export function planCardSteps(plans: readonly Pick<Plan, 'id' | 'modules'>[] = PLANS, sections: readonly HowToSection[] = HOW_TO_SECTIONS): readonly PlanCardSteps[] {
  for (const plan of plans) {
    if (plan.modules.length === 0) throw new HowToLawError(`howTo: the plan "${plan.id}" holds no module — a card lists the steps its plan's modules add, and this plan has none`);
  }
  return plans.map((plan) => {
    const choice = choiceOf(plan);
    const inherited = plans.filter((other) => strictSubset(other.modules, plan.modules)).map((other) => choiceOf(other));
    const categories = sections
      .filter((section) => sectionShown(section.id, choice) && !inherited.some((smaller) => sectionShown(section.id, smaller)))
      .map((section) => ({ id: section.id, heading: categoryHeading(section.name, section.steps.length), steps: section.steps.map((step) => say(step.title, choice)) }));
    return { plan: plan.id, categories };
  });
}

// ── THE LAW ──────────────────────────────────────────────────────────────────

export function howToLaw(
  opts: {
    throwOnFail?: boolean; registry?: readonly ToolEntry[]; plans?: readonly Plan[]; sections?: readonly HowToSection[];
    groups?: readonly CapabilityGroup[]; heads?: Readonly<Record<string, string>>;
  } = {},
): string[] {
  const registry = opts.registry ?? TOOL_REGISTRY;
  const plans = opts.plans ?? PLANS;
  const sections = opts.sections ?? HOW_TO_SECTIONS;
  const groups = opts.groups ?? CAPABILITY_GROUPS;
  const heads: Readonly<Record<string, string>> = opts.heads ?? PLAN_HEADS;
  const violations: string[] = [];
  // 1. The four sections, in order.
  const ids = sections.map((s) => s.id).join(', ');
  if (ids !== HOW_TO_SECTION_ORDER.join(', ')) violations.push(`the sections are [${ids}], not [${HOW_TO_SECTION_ORDER.join(', ')}] in that order`);
  const named = new Set<string>();
  for (const s of sections) {
    // 2. Each section's steps numbered 1..N.
    s.steps.forEach((step, i) => {
      if (step.n !== i + 1) violations.push(`${s.id}: step ${i + 1} in order is numbered ${step.n} — the steps run 1..${s.steps.length} with no gap`);
      if (step.tools.length === 0) violations.push(`${s.id} step ${step.n} names no tool`);
      // 3. Every tool named is a registry tool.
      for (const name of step.tools) {
        if (!registry.some((t) => t.name === name)) violations.push(`${s.id} step ${step.n} names "${name}", which is not a registry tool`);
        named.add(name);
      }
    });
    if (s.steps.length === 0) violations.push(`${s.id} holds no step`);
  }
  // 4. Every registry tool appears in at least one step.
  for (const t of registry) {
    if (!named.has(t.name)) violations.push(`${t.name} is in the registry and in no step`);
  }
  for (const name of NEEDS_BOOKS) {
    if (!registry.some((t) => t.name === name)) violations.push(`NEEDS_BOOKS names "${name}", which is not a registry tool`);
  }
  // 5. Each of the four choices resolves to one plan.
  for (const choice of HOW_TO_CHOICES) {
    const want = modulesOf(choice);
    const found = plans.filter((p) => p.modules.length === want.length && want.every((m) => p.modules.includes(m)));
    if (found.length !== 1) violations.push(`[${want.join(', ')}] resolves to ${found.length} plans (${found.map((p) => p.id).join(', ') || 'none'}), not one`);
  }
  // 6. HOME-PLANS-01: every plan has a head in the comparison, and no head names anything else.
  for (const p of plans) {
    if (!heads[p.id] || !heads[p.id].trim()) violations.push(`the plan "${p.id}" has no head in the comparison`);
  }
  for (const id of Object.keys(heads)) {
    if (!plans.some((p) => p.id === id)) violations.push(`the comparison's head "${heads[id]}" names "${id}", which is not a plan`);
  }
  // 7. HOME-PLANS-01: every tool a step names has a line — a capability row of the plans leaf names it.
  for (const s of sections) {
    for (const step of s.steps) {
      for (const name of step.tools) {
        if (capabilityRowOf(name, groups) === undefined) violations.push(`${s.id} step ${step.n} names "${name}", which no capability row names — the comparison has no line for it`);
      }
    }
  }
  if (violations.length > 0 && opts.throwOnFail !== false) throw new HowToLawError(`howTo law: ${violations.join('; ')}`);
  return violations;
}

howToLaw();
