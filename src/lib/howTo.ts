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
 * PURE: no directive, no fetch, no clock, no storage.
 */

import type { ToolName } from './problemSheet';
import { TOOL_REGISTRY, type ToolEntry, type ToolStatus } from './toolRegistry';
import { PLANS, type ModuleId, type Plan } from './offer/plans';
import { OFFERS, priceLineFor, type Offer } from './offer';

// ── THE WORDS ────────────────────────────────────────────────────────────────

export const HOW_TO_EYEBROW = 'The how-to';
export const HOW_TO_HEADING = 'Here’s how you actually do it.';
export const HOW_TO_LINE = 'Personal is everyone’s. Add a business, trading, or both, and your steps fill in, in order, across Personal, Business, Travel and Trade.';
/** The label over the three, and the three: Personal is fixed, the other two are switches. */
export const WHAT_YOU_RUN_LABEL = 'What you run · add any';
export const PERSONAL_ALWAYS = 'Personal · always';
export const ADD_BUSINESS = '+ Business';
export const ADD_TRADE = '+ Trade';
/** After Personal, while neither Business nor Trade is on. */
export const NEXT_LINE = 'Next, earn abroad: run a business, trade, or both — add them above.';
/** The two tags a step carries while it needs Books and Books is not on sale. */
export const NEEDS_BOOKS_TAG = 'NEEDS BOOKS';
export const NOT_ON_SALE_TAG = 'NOT ON SALE YET';
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
/** "<Section> · step <n>" */
export function cardWhere(sectionName: string, n: number): string {
  return `${sectionName} · step ${n}`;
}
/** "YOUR STEP <its place> OF <N>" — places run in section order: Personal, Business, Travel, Trade. */
export function cardPlace(place: number, total: number): string {
  return `YOUR STEP ${place} OF ${total}`;
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
 */
export const NEEDS_BOOKS: readonly ToolName[] = ['Banking', 'Bookkeeping', 'Expenses', 'Bill Pay', 'Budget', 'Tasks'];

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
  /** "<Section> · step <n>" */
  where: string;
  /** "YOUR STEP <place> OF <N>" */
  placeLine: string;
  n: number;
  place: number;
  title: string;
  tools: readonly HowToToolMark[];
  live: boolean;
  /** LIVE or PENDING, with its tone. */
  state: { words: string; tone: HowToTone };
  /** True only while the step needs Books AND Books is not on sale — the two tags ride on this. */
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
  planLine: string;
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
  let place = 0;
  const views: HowToSectionView[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    badge: say(s.badge, choice),
    line: say(s.line, choice),
    cards: s.steps.map((step) => {
      place += 1;
      const statuses = step.tools.map((name) => statusOf(name, registry));
      const live = statuses.every((status) => status === 'LIVE');
      return {
        where: cardWhere(s.name, step.n),
        placeLine: cardPlace(place, total),
        n: step.n,
        place,
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
  return {
    planLine: planLine(planFor(choice, opts.plans ?? PLANS)),
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
