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
 * of the four choices resolves to exactly one plan.
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
 * PURE: no directive, no fetch, no clock, no storage.
 */

import type { ToolName } from './problemSheet';
import { TOOL_REGISTRY, type ToolEntry, type ToolStatus } from './toolRegistry';
import { PLANS, priceSlot, type ModuleId, type Plan, type PriceSlot } from './offer/plans';
import { OFFERS, priceLineFor, type Offer } from './offer';

// ── THE WORDS ────────────────────────────────────────────────────────────────

/** HOME-BRIEF-04 (2026-11-10): the block's label — "The how-to" until then. */
export const HOW_TO_EYEBROW = 'Software plans';
export const HOW_TO_HEADING = 'Here’s how you actually do it.';
export const HOW_TO_LINE = 'Personal is everyone’s. Add a business, trading, or both, and your steps fill in, in order, across Personal, Business, Travel and Trade.';
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
  note?: string;
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
      { n: 1, title: 'Keep the trading book separate.', tools: ['Banking', 'Bookkeeping'], note: 'No customer can open a trading book yet, so this step waits on that.' },
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
        note: step.note ?? null,
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

// ── THE LAW ──────────────────────────────────────────────────────────────────

export function howToLaw(
  opts: { throwOnFail?: boolean; registry?: readonly ToolEntry[]; plans?: readonly Plan[]; sections?: readonly HowToSection[] } = {},
): string[] {
  const registry = opts.registry ?? TOOL_REGISTRY;
  const plans = opts.plans ?? PLANS;
  const sections = opts.sections ?? HOW_TO_SECTIONS;
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
  if (violations.length > 0 && opts.throwOnFail !== false) throw new HowToLawError(`howTo law: ${violations.join('; ')}`);
  return violations;
}

howToLaw();
