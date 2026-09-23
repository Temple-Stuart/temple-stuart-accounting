/**
 * NAV-01a — THE TOOL REGISTRY. One source for "which of the 25 tools exists
 * today, where, and in what state", keyed on the deck's PROBLEM_SHEET (the six
 * families and the 25 names are imported, never retyped).
 *
 * Every fact below is the TOOL CENSUS verbatim. THE RUBRIC (TRUTH-01,
 * census 2026-09-09 — status means the job is done, not that code exists):
 *   LIVE      = all four loop beats cited in code AND the tool does the job
 *               the sheet names, for a customer, on production. Four beats
 *               never imply LIVE.
 *   PARTIAL   = some of the job; a PARTIAL with four beats MUST carry a `why`
 *               note saying what is not done for a customer (the law throws
 *               without it).
 *   NOT_BUILT = no beats — no page or route does any of the tool's job (code
 *               that touches the name but belongs to another tool is cited,
 *               not counted).
 * 2 LIVE · 9 PARTIAL · 14 NOT_BUILT — the counts are a LAW below; bump them
 * only with a new dated census.
 *
 * `home` is an EXISTING route only — this PR links, it moves nothing. A
 * cockpit-hosted tool also carries `cockpitKey` (the ModuleLauncher section
 * that IS its home, selected in place); an off-cockpit tool is a plain link.
 * A NOT_BUILT tool has no home, no screen, no copy.
 *
 * NAV-25: the order the rail walks the tools, and which phases each owns, is
 * src/lib/nav.ts — this file stays the one source for what a tool IS. (The
 * steps layer SHELL-01 invented was deleted with it; src/lib/steps.ts is gone.)
 *
 * THE LAW (module scope — the deck's LAYOUT LAW idiom; also re-run at build by
 * scripts/assert-tool-registry.ts, which adds the filesystem check that every
 * home resolves to a page file):
 *   1. registry keys == PROBLEM_SHEET cells, 25/25, both directions;
 *   2. a LIVE or PARTIAL tool has a home; a NOT_BUILT tool has none;
 *   3. NOT_BUILT ⇔ no beats; LIVE ⇒ four beats; a PARTIAL with four beats
 *      carries a `why` note (thrown without it) — four beats never imply LIVE;
 *   4. status counts == the dated census (EXPECTED_STATUS_COUNTS);
 * SHELL-01 → NAV-25: the six family MENUS and PAGES are retired — the rail
 * renders the twenty-five tools (src/lib/nav.ts) and HOME carries the whole
 * sheet — so FAMILY_PAGES,
 * familyMenu, familyCards, familyOfPath and toolsOf went with them. What the
 * rail and the sheet still read lives here: the facts, the doors (doorOf /
 * doorOfLink), the cockpit paths and the family reads.
 */
import { PROBLEM_SHEET, type FamilyName, type ToolName } from './problemSheet';

export type ToolStatus = 'LIVE' | 'PARTIAL' | 'NOT_BUILT';

export interface Beats {
  discover: boolean;
  decide: boolean;
  commit: boolean;
  record: boolean;
}

export interface ToolLink {
  label: string;
  /** An existing page route (off-cockpit link). */
  href?: string;
  /** A ModuleLauncher section key (selected in place, URL written as today). */
  cockpitKey?: string;
}

export interface ToolFacts {
  slug: string;
  status: ToolStatus;
  beats: Beats;
  /** An existing route, or null for NOT_BUILT. */
  home: string | null;
  /** The cockpit section that IS the home, when it is one. */
  cockpitKey?: string;
  /** Related existing surfaces (never a tool of their own). */
  links?: readonly ToolLink[];
  /** file:line from the TOOL CENSUS. */
  citation: string;
  /** A census note that changes how the home should be read. */
  note?: string;
  /** TRUTH-01: a PARTIAL tool with all four beats cited says here what is NOT done for a customer on production — the law throws without it. */
  why?: string;
  /**
   * WHY-01 (2026-09-23): the same truth, WRITTEN FOR THE CUSTOMER — one plain
   * sentence saying what this job does today and what it does not do yet.
   *
   * `why` above is the BUILDER's evidence and the laws cite it, so it keeps its
   * every word: PR ids, table names, pipeline names, "the founder". It used to be
   * what the public plans table showed when a group expanded. It no longer reaches
   * a customer surface — this field does, and carries none of that vocabulary.
   *
   * Required of every tool a plan row can show as ◐ or Coming; the plan law names
   * any tool that lacks one. A sentence may only say what the tool does TODAY.
   */
  customer?: string;
}

export interface ToolEntry extends ToolFacts {
  name: ToolName;
  family: FamilyName;
  /** 1-based position in sheet order. */
  order: number;
}

const ALL: Beats = { discover: true, decide: true, commit: true, record: true };
const NONE: Beats = { discover: false, decide: false, commit: false, record: false };
const some = (b: Partial<Beats>): Beats => ({ ...NONE, ...b });

// census 2026-09-09 (TRUTH-01): door by door, the job done for a customer on production.
export const EXPECTED_STATUS_COUNTS: Readonly<Record<ToolStatus, number>> = { LIVE: 2, PARTIAL: 9, NOT_BUILT: 14 };

const FACTS: Readonly<Record<ToolName, ToolFacts>> = {
  // ── THE WORK ──
  // CAL-01: the calendar is THE CALENDAR. Its home was /agenda — a recurring-spend
  // planner (cadence + coa_code + budget_amount, committing a `budgets` row) that
  // is Budget's work and is Budget's now. The merged grid had no room of its own;
  // it has one at /calendar.
  //
  // TRUTH-CAL (2026-09-17): this row claimed four beats cited to the ROUTINES
  // pipe — the routine builder's own routes. PLAN-01 moved that builder to
  // /tasks, so the row was naming a surface this tool no longer has. The beats
  // are re-derived from the page as it now stands, and they are NOT one.
  //
  // The loop's Calendar cells are about an EVENT, not a routine:
  // 'open time on the calendar' · 'a draft event' · 'the event is set, invites
  // go out' · 'event recorded' (src/components/landing/Landing.tsx:810). EVENT-01
  // put a hand-entered event form on this page and GEO-01 gave it a place, so:
  //   · discover — the three GETs, the grid itself writing nothing;
  //   · commit   — an event is created, edited and deleted through this tool's
  //                OWN row, calendar_events (not another tool's object);
  //   · record   — the row is read back, badged and counted into the day total.
  // `decide` is NOT claimed: there is no persisted draft event. The form holds
  // React state and POSTs on submit — the same standard Trade Log's row applies
  // ("no persisted draft"). Three beats, not four, and not discover alone.
  //
  // It stays PARTIAL: the loop's commit cell ends "invites go out", and no invite
  // goes out. TRUTH-01b's four-beat `why` requirement does not bind a three-beat
  // row; the `why` here says what the calendar IS, which is what the sheet prints.
  //
  // ONEOFF-01 (2026-09-18): THE CALENDAR AUTHORS NOTHING. EVENT-01's add form
  // and its POST are gone — a one-off is a routine that happens once, planned in
  // Tasks with its lines and its place — so the COMMIT beat TRUTH-CAL cited to
  // that form is LOST: the loop's commit cell is "the event is set, invites go
  // out", and nothing is set here now. RECORD is KEPT, by TRUTH-CAL's own
  // standard ("the row is read back, badged and counted into the day total"):
  // every source's rows are read back through the allowlist and counted into
  // the day's named parts, and a row entered by hand before the ruling is read
  // back after its correction (PATCH returns the row, the grid reloads, the badge
  // marks it). Two beats — discover · record — and still PARTIAL.
  Calendar: {
    slug: 'calendar', status: 'PARTIAL', beats: some({ discover: true, record: true }), home: '/calendar',
    why: 'the view every tool logs to — trips, routine occurrences and one-offs, project blocks and the days entered by hand before ONEOFF-01, on one grid, with the day\'s total naming each part; nothing is authored here — a one-off is a routine planned in Tasks — and an event entered by hand before the ruling can still be corrected or removed',
    links: [],
    citation: 'discover: src/components/hub/HubCalendar.tsx:192 (/api/calendar) · :208 (/api/operations/daily-plan/items) · :220 (/api/hub/operations-routines) — three GETs, the grid writes nothing · record: src/components/hub/HubCalendar.tsx:199 (the rendered-source filter) · src/lib/calendar/day.ts:304 (dayParts — every row counted into its named part) · src/lib/calendar/sources.ts:84 (manual) · src/components/hub/DayView.tsx:221 (the hand-entered badge) · src/app/api/calendar/events/route.ts:82 (PATCH — a pre-ruling row re-stated and read back) · :123 (DELETE) · no commit: no POST since ONEOFF-01, nothing is authored on the calendar · no decide: no persisted draft',
    note: 'Nine calendar_events sources render, each named with its writer and its reason in src/lib/calendar/sources.ts:82-157; "project" and "routines" are named EXCLUDED at :170-179 because they reach the grid already through their own loaders, and admitting them would draw every block twice. DAY-01 deleted the bare source === "trip" filter this note used to describe. ONEOFF-01 closed the manual writer — its rows are pre-ruling and stay editable; a new one-off is a routine.',
    customer: 'Your trips, routines, project blocks and what each day costs all show on one grid; the days themselves are planned elsewhere, not here.',
  },
  Tasks: {
    // TOOL-LAW-01: one tool, one page. /operations was Tasks AND Time on one
    // screen behind six invented cells; Tasks has /tasks now.
    // The Issue log and Audit trail return as Tasks' own sub-rows: they are THE
    // WORK's pages, and the /operations prefix that doored them is gone with
    // the room. Neither is any tool's screen, so navLaw rule 7 holds.
    // NORTH-01 (2026-09-18): the North Star joins them. It is Tasks' own input —
    // src/lib/ai/northStarContext.ts feeds every project generator — and it was
    // rendered inline at the top of /tasks, which is not how its two siblings
    // are reached. It has its own page now, doored the same way: a link here,
    // a sub-row in the rail. Nothing about the North Star itself changed.
    // TASKS-01 (2026-09-18): /tasks is two lists — projects and routines — and
    // the `why` below is a customer's line. The founder's note that stood here
    // ("the founder's build pipeline — accepting a task fires a paid Claude Code
    // build; not a customer's task tool") is a fact about the code, not a
    // customer's line, and it lives here now: accepting a pending_review task
    // (the pending_review → open transition, tasks/[taskId]/route.ts) fires
    // fireExecutionRoutine — a Claude Code Routine that builds THIS repository
    // and opens a PR, cost-capped per user (requireExecBudget) but gated to any
    // signed-in owner, not to the founder. Where that pipeline should live for a
    // customer (a gated section, its own page, or gone) is Alex's call — put in
    // the TASKS-01 PR body, not decided here. "Audit tail" → "Audit trail": the
    // label said tail, the page is the trail.
    slug: 'tasks', status: 'PARTIAL', beats: ALL, home: '/tasks',
    why: "the work, planned: projects with costed tasks and routines with costed lines, both landing on the calendar and linkable to a posting — a task's actual cost is still typed by hand; nothing posts it from the books",
    links: [
      { label: 'North Star', href: '/operations/north-star' },
      { label: 'Issue log', href: '/operations/issues' },
      { label: 'Audit trail', href: '/operations/audit-log' },
    ],
    citation: 'src/app/api/operations/projects/[id]/tasks/route.ts:43 · generate-tasks/route.ts:42 · tasks/bulk-create/route.ts:117 · tasks/[taskId]/route.ts:82 → :339, :370; accepting a pending_review task fires the paid build at tasks/[taskId]/route.ts:392-402',
    customer: 'You can plan projects and routines with what each one should cost, and see them on your calendar; what a task actually cost is still typed in by hand.',
  },
  Time: {
    // TOOL-LAW-01: one tool, one page. /time renders the content pipe's four
    // phases and nothing else. DayCalendarView rides phase 03 and is Time's —
    // a clock-ordered list of the day's blocks, not the merged grid.
    slug: 'time', status: 'PARTIAL', beats: ALL, home: '/time',
    why: 'day blocks and a daily log inside the Narrative pipeline; no time tool',
    links: [],
    citation: 'src/app/api/operations/tasks/unscheduled/route.ts · daily-plan/items/route.ts:120 · daily-plan/items/[itemId]/blocks/route.ts:36 · daily-plan/blocks/[blockId]/route.ts:38, :163',
    customer: 'You can block out a day and keep a daily log; there is no separate place yet that adds up where your hours went.',
  },
  // ── MONEY IN ──
  CRM: {
    slug: 'crm', status: 'NOT_BUILT', beats: NONE, home: null,
    citation: "/owner is the founder's proposals inbox — no contact or deal object (src/app/api/owner/proposals/route.ts)",
    customer: 'There is nowhere yet to keep the people you sell to, or track where each one stands.',
  },
  Contracts: {
    slug: 'contracts', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 5 — no page, route, or model',
    customer: 'There is nowhere yet to keep a signed contract or what you agreed to in it.',
  },
  Invoicing: {
    slug: 'invoicing', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 6 — no invoice model, no A/R route',
    customer: 'You cannot send an invoice or see who has not paid yet.',
  },
  Payments: {
    slug: 'payments', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 7 — Stripe routes are the product\'s own billing; commission_ledger (schema:1397) is a Travel byproduct',
    customer: 'Money arriving is not yet matched to the invoice that earned it.',
  },
  // ── MONEY OUT ──
  'Bill Pay': {
    slug: 'bill-pay', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 8 — operations_vendor_directory (schema:3478) is a read-only GET (vendor-directory/route.ts:12)',
    customer: 'You cannot schedule or pay a bill here yet.',
  },
  Payroll: {
    slug: 'payroll', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 9 — no page, route, or model',
    customer: 'You cannot run payroll here yet, or see the taxes that come with it.',
  },
  Expenses: {
    slug: 'expenses', status: 'NOT_BUILT', beats: NONE, home: null,
    citation: "trip cost split on the trip planner (src/app/api/trips/[id]/expenses/route.ts:70) is Travel's, not an expenses tool",
    customer: 'Receipts are not yet matched to the charge that made them.',
  },
  Travel: {
    slug: 'travel', status: 'LIVE', beats: ALL, home: '/travel', cockpitKey: 'travel',
    links: [{ label: 'Trips · the legacy pages', href: '/budgets/trips' }],
    citation: 'src/app/api/travel/liteapi/flights/search/route.ts:23 · travel/liteapi/prebook/route.ts:40 · travel/liteapi/book/route.ts:134 · :169, :193',
  },
  Mileage: {
    slug: 'mileage', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 12 — no miles or odometer column in prisma/schema.prisma',
    customer: 'Miles driven are not tracked yet, or priced for the return.',
  },
  Budget: {
    slug: 'budget', status: 'PARTIAL', beats: ALL, home: '/budget',
    why: 'actuals by entity plus recurring lines on module_expenses; no plan vs actual; no personal · trade · travel roll-up',
    // ROOM-01: the six category sub-links are gone — they are the switcher inside
    // /budget now, not six doors in the rail. Shopping stays a room of its own.
    links: [
      // CAL-01: the agenda planner is Budget's. Its items carry a cadence, a
      // coa_code and a budget_amount, and committing one writes a `budgets`
      // plan row (src/app/api/agenda/[id]/route.ts:113-133). ONE sub-row covers
      // all three pages — /agenda/new and /agenda/[id] are reached through it.
      { label: 'Recurring plan · the agenda', href: '/agenda' },
      { label: 'Shopping · meal & cart plans', href: '/shopping' },
      { label: 'Itinerary budget builder', href: '/hub/itinerary' },
      { label: 'Runway · the read-only view', cockpitKey: 'calendar' },
    ],
    citation: 'src/components/dashboard/BudgetingPage.tsx:47 · src/app/api/home/route.ts:33-63 · :89 (draft :107) · src/app/api/home/[id]/route.ts:143 · :118-139, :81-89',
    note: 'Six category pages, reachable from no menu until this PR; the draft form works on /business only (coaAccounts, census note B).',
    customer: 'You can see what you actually spent and set amounts that repeat; it does not yet compare that against a plan, or add your personal, trading and travel spending into one view.',
  },
  // ── WHAT YOU OWN ──
  // ACCOUNTS-01b: Banking's home is its OWN screen. Until ACCOUNTS-01 the tool had
  // no room of its own, so the registry pointed it at Books' Source Accounts phase
  // and carried /accounts as a "legacy page" link. /accounts is now step 1's screen
  // and shows these accounts, so the home IS /accounts and the link is gone (a tool
  // does not link to itself). No cockpitKey: Banking is no longer a cockpit section.
  Banking: {
    slug: 'banking', status: 'PARTIAL', beats: some({ discover: true }), home: '/accounts',
    citation: 'src/components/accounts/AccountsClient.tsx:118 (connect) · :127 (sync) · :201 (reconnect), through src/components/bank/useBankConnection.ts:83 · :101 · :122 · :164 · src/app/api/accounts/route.ts:6; no transfer route exists',
    customer: 'You can connect your bank and card accounts and refresh their balances; no money is moved from here.',
  },
  'Fixed Assets': {
    slug: 'fixed-assets', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 15 — no depreciation or placed-in-service field',
    customer: 'The things you own that lose value over time are not tracked yet.',
  },
  Retirement: {
    slug: 'retirement', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 16 — 1099-R intake at src/app/api/tax/calculate/route.ts:250 is Tax',
    customer: 'Retirement accounts do not sit beside the rest of your money yet.',
  },
  // ACCOUNTS-01b: the home is /trading, the full room — it is the only surface that
  // CONNECTS a brokerage (src/app/trading/page.tsx:263 /api/tastytrade/connect) and it
  // carries chains, positions and the journal. The cockpit's Trade tab connects
  // nothing, so it was never this tool's home; the old "Standalone cockpit" link is
  // deleted because the standalone cockpit IS the home. SHELL-02 removed Trade
  // Log's "Grade · on the Trade tab" link too: /trade keeps its door as a listed
  // guest route (the cockpit paths, scripts/assert-tool-registry.ts GUEST_ROUTES).
  Brokerage: {
    slug: 'brokerage', status: 'PARTIAL', beats: some({ discover: true, decide: true }), home: '/brokerage',
    why: "runs on the founder's broker until per-user connections ship (TT-02)",
    citation: 'src/app/api/tastytrade/chains/route.ts:58 · scanner/route.ts:205 · src/app/api/trade-cards/route.ts:72 (status queued :92); no order is ever sent (ConvergenceIntelligence.tsx:840)',
    customer: 'Positions and balances show from one connected brokerage account; connecting your own broker is not available yet.',
  },
  // SHELL-02: the "Grade · on the Trade tab" sub-link is gone. The room is
  // /trading — the step's own screen — and a rail row pointing back into the
  // cockpit was the last of the old two-language navigation.
  // ACCOUNTS-01b: home /books → /trading. Trade Log sits in step 2 TRADING, whose
  // screen is /trading — a job's home may not be another step's screen (the steps
  // law). /trading is where the job is done for a customer: it posts the balanced
  // entry (page.tsx:640 → api/trading/commit-to-ledger/route.ts:168 postJournal) and
  // saves the journal (page.tsx:733 → /api/trading-journal). The Books pipeline
  // still READS investment transactions; that is Bookkeeping's row, not this one.
  'Trade Log': {
    slug: 'trade-log', status: 'PARTIAL', beats: some({ discover: true, commit: true, record: true }), home: '/trade-log',
    why: 'a customer cannot log a trade: a position exists only once a Plaid-synced investment transaction is committed, and there is no manual entry — so the job is not done for a customer on production yet (TRADE-LOG-01)',
    citation: 'src/app/trading/page.tsx:640 → src/app/api/trading/commit-to-ledger/route.ts:168 · page.tsx:733 → /api/trading-journal · src/app/api/transactions/sync-complete/route.ts:185 → :242 · investment-transactions/commit-to-ledger/route.ts:106 → src/lib/position-tracker-service.ts:170, :307-311 · :601, :619; no persisted draft',
    customer: 'Trades show only once they arrive from a synced brokerage feed and are posted to the books; you cannot enter one by hand yet.',
  },
  // ── WHAT YOU OWE ──
  Debt: {
    slug: 'debt', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 19 — src/app/api/net-worth/route.ts:36 is a totals read; no schedule, no lender',
    customer: 'What you owe and when it comes due is not tracked yet.',
  },
  'Sales Tax': {
    slug: 'sales-tax', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 20 — sales_tax_nexus (schema:2197) is a corpus enum',
    customer: 'Sales tax collected, and when each state wants it, is not tracked yet.',
  },
  'Ent Filings': {
    slug: 'ent-filings', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 21 — entities (schema:66-77) has no filing date or agent',
    customer: 'What the entity must file, and when it is due, is not tracked yet.',
  },
  // ── THE PROOF ──
  Bookkeeping: {
    slug: 'bookkeeping', status: 'LIVE', beats: ALL, home: '/books', cockpitKey: 'books',
    links: [{ label: 'Chart of accounts', href: '/chart-of-accounts' }],
    citation: 'src/components/home/BooksPipeline.tsx:198 · src/lib/auto-categorization-service.ts:132-140 · src/lib/journal-entry-service.ts:131, :210-216 · :147, :158',
  },
  Tax: {
    slug: 'tax', status: 'PARTIAL', beats: some({ discover: true, decide: true }), home: '/tax', cockpitKey: 'tax',
    links: [{ label: 'Filing wizard · standalone', href: '/dashboard/tax-filing' }],
    citation: 'src/components/tax-filing/steps/IncomeReviewStep.tsx:298-300 · src/app/api/tax/documents/route.ts:67; FileStep.tsx:13-14 "Nothing is submitted from here"',
    customer: "You can review the income and the documents behind this year's figure; nothing is filed from here.",
  },
  Compliance: {
    slug: 'compliance', status: 'PARTIAL', beats: some({ discover: true, decide: true, record: true }), home: '/compliance', cockpitKey: 'compliance',
    links: [{ label: 'SOC 2 proofs', href: '/soc2' }],
    citation: 'src/lib/discovery/runDiscovery.ts:44 · :107 · src/lib/audit/writeAuditLog.ts:101 via materializeProposal.ts:186; nothing signed (attestation_status schema:2675-2678 never written)',
    customer: 'It works out what the entity has to do and keeps a log of what was done; nothing is signed off here yet.',
  },
  'FP&A': {
    slug: 'fpa', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 25 — no forecast model, route, or tab; MetricsAndProjectionsTab.tsx:53 reads a key the route never returns',
    customer: 'Runway, margin and the forecast behind them are not available yet.',
  },
};

export const FAMILIES: readonly FamilyName[] = PROBLEM_SHEET.map((f) => f.header);

/**
 * NAV-01b: family-level READS — pages that read across a family's tools and
 * belong to no single tool. Income is a read under MONEY IN; net worth is a
 * read under WHAT YOU OWN and, since NAV-01c, the read below the four answers
 * on /answers (src/lib/answers.ts NET_WORTH_READ names the same page).
 */
export const FAMILY_READS: Readonly<Partial<Record<FamilyName, readonly ToolLink[]>>> = {
  'MONEY IN': [{ label: 'Income · a read', href: '/income' }],
  'WHAT YOU OWN': [{ label: 'Net worth · a read', href: '/net-worth' }],
};

/** The 25 tools in sheet order, each joined to its census facts. */
export const TOOL_REGISTRY: readonly ToolEntry[] = PROBLEM_SHEET.flatMap((f) =>
  f.tools.map((name): ToolEntry => ({ name, family: f.header, order: 0, ...FACTS[name] })),
).map((t, i) => ({ ...t, order: i + 1 }));

/**
 * The cockpit section a deep link lands on → the tool the family nav should open to.
 *
 * TRUTH-CAL (2026-09-17): `routines` pointed at Calendar. PLAN-01 gave the
 * routines pipe to Tasks, so a visitor on the cockpit's Routines showcase had the
 * rail marking a tool that does not own routines — the same untruth as the row
 * above, in a different place. It points at the owner now. Nothing renders from
 * this entry today (claimForCockpit('routines') has no caller), so the change
 * costs nothing and restores the truth.
 */
export const COCKPIT_PRIMARY_TOOL: Readonly<Record<string, ToolName>> = {
  projects: 'Tasks', content: 'Time', travel: 'Travel', calendar: 'Budget', routines: 'Tasks',
  books: 'Bookkeeping', trade: 'Brokerage', tax: 'Tax', compliance: 'Compliance',
};

/**
 * NAV-01c: cockpit section key → the URL the cockpit writes for it
 * (ModuleLauncher writeTabParam; src/app/[tab]/page.tsx TAB_PATHS; the
 * compliance carve-out keeps its legacy /?tab= URL). ONE source: the family
 * navigation's link mode (off the cockpit, a cockpit tool is a plain link here)
 * and the build-time reachability law (scripts/assert-tool-registry.ts).
 */
export const COCKPIT_PATH: Readonly<Record<string, string>> = {
  calendar: '/runway', travel: '/travel', routines: '/routines', projects: '/projects',
  content: '/content', trade: '/trade', books: '/books', tax: '/tax', compliance: '/?tab=compliance',
};

/**
 * NAV-02: a DOOR — where a rail row or a sheet link opens. A cockpit door is
 * a ModuleLauncher section: on the cockpit it is selected in place through the
 * selectTab funnel (the URL is written as today); anywhere else it is a plain
 * link to COCKPIT_PATH. A route door is a page. `none` is a NOT_BUILT tool.
 */
export type ToolDoor =
  | { kind: 'cockpit'; key: string; href: string }
  | { kind: 'route'; href: string }
  | { kind: 'none' };

/** The tool's own door for its MENU item: its cockpit section when it has one, else its home; none for NOT_BUILT. */
export function doorOf(tool: ToolEntry): ToolDoor {
  if (tool.home === null) return { kind: 'none' };
  if (tool.cockpitKey) return { kind: 'cockpit', key: tool.cockpitKey, href: COCKPIT_PATH[tool.cockpitKey] };
  return { kind: 'route', href: tool.home };
}

/** A related surface's door. The law holds every link to exactly one of href / cockpitKey; anything else is a registry bug, thrown. */
export function doorOfLink(tool: ToolEntry, link: ToolLink): ToolDoor {
  if (link.href) return { kind: 'route', href: link.href };
  if (link.cockpitKey) return { kind: 'cockpit', key: link.cockpitKey, href: COCKPIT_PATH[link.cockpitKey] };
  throw new Error(`${tool.name}: link "${link.label}" has neither href nor cockpitKey`);
}

export function statusCounts(registry: readonly ToolEntry[] = TOOL_REGISTRY): Record<ToolStatus, number> {
  const counts: Record<ToolStatus, number> = { LIVE: 0, PARTIAL: 0, NOT_BUILT: 0 };
  for (const t of registry) counts[t.status] += 1;
  return counts;
}

function beatCount(b: Beats): number {
  return [b.discover, b.decide, b.commit, b.record].filter(Boolean).length;
}

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. */
export function registryLaw(opts: { throwOnFail?: boolean; registry?: readonly ToolEntry[] } = {}): string[] {
  const violations: string[] = [];
  // TRUTH-01: the per-tool rules and the counts run over an injectable registry so a test can hand in a broken one.
  const registry = opts.registry ?? TOOL_REGISTRY;
  const cells = PROBLEM_SHEET.flatMap((f) => f.tools as readonly string[]);
  const keys = Object.keys(FACTS);
  if (cells.length !== 25) violations.push(`PROBLEM_SHEET has ${cells.length} cells, expected 25`);
  for (const c of cells) if (!(c in FACTS)) violations.push(`sheet cell "${c}" has no registry facts`);
  for (const k of keys) if (!cells.includes(k)) violations.push(`registry key "${k}" is not a sheet cell`);
  if (new Set(cells).size !== cells.length) violations.push('PROBLEM_SHEET cells are not unique');
  if (registry.length !== 25) violations.push(`registry has ${registry.length} entries, expected 25`);
  const slugs = new Set<string>();
  for (const t of registry) {
    if (slugs.has(t.slug)) violations.push(`${t.name}: duplicate slug "${t.slug}"`);
    slugs.add(t.slug);
    if (!/^[a-z][a-z0-9-]*$/.test(t.slug)) violations.push(`${t.name}: slug "${t.slug}" is not kebab-case`);
    const n = beatCount(t.beats);
    // rule 3 (TRUTH-01): NOT_BUILT ⇔ no beats; LIVE ⇒ four beats; a four-beat PARTIAL says why it is not LIVE.
    if (t.status === 'LIVE' && (n !== 4 || t.home === null)) violations.push(`${t.name}: LIVE needs four beats and a home (beats ${n}, home ${t.home})`);
    if (t.status === 'PARTIAL' && (n === 0 || t.home === null)) violations.push(`${t.name}: PARTIAL needs at least one beat and a home (beats ${n}, home ${t.home})`);
    if (t.status === 'PARTIAL' && n === 4 && !t.why?.trim()) violations.push(`${t.name}: PARTIAL with four beats must say why it is not LIVE (why: what is not done for a customer on production)`);
    if (t.status !== 'PARTIAL' && t.why) violations.push(`${t.name}: why belongs only to a PARTIAL tool`);
    if (t.status === 'NOT_BUILT' && (n !== 0 || t.home !== null || t.cockpitKey || (t.links && t.links.length))) violations.push(`${t.name}: NOT_BUILT must have no beats, no home, no links`);
    if (t.status !== 'NOT_BUILT' && n === 0) violations.push(`${t.name}: ${t.status} with no beats — no beats is NOT_BUILT`);
    if (t.home !== null && !t.home.startsWith('/')) violations.push(`${t.name}: home "${t.home}" is not a route`);
    for (const l of t.links ?? []) {
      if ((l.href ? 1 : 0) + (l.cockpitKey ? 1 : 0) !== 1) violations.push(`${t.name}: link "${l.label}" must have exactly one of href / cockpitKey`);
    }
  }
  const counts = statusCounts(registry);
  for (const s of Object.keys(EXPECTED_STATUS_COUNTS) as ToolStatus[]) {
    if (counts[s] !== EXPECTED_STATUS_COUNTS[s]) violations.push(`${s} count ${counts[s]} ≠ census ${EXPECTED_STATUS_COUNTS[s]} (bump only with a census)`);
  }
  for (const [key, name] of Object.entries(COCKPIT_PRIMARY_TOOL)) {
    if (!(name in FACTS)) violations.push(`COCKPIT_PRIMARY_TOOL[${key}] names unknown tool "${name}"`);
    if (!(key in COCKPIT_PATH)) violations.push(`COCKPIT_PRIMARY_TOOL key "${key}" has no COCKPIT_PATH`);
  }
  for (const t of registry) {
    if (t.cockpitKey && !(t.cockpitKey in COCKPIT_PATH)) violations.push(`${t.name}: cockpitKey "${t.cockpitKey}" has no COCKPIT_PATH`);
    for (const l of t.links ?? []) if (l.cockpitKey && !(l.cockpitKey in COCKPIT_PATH)) violations.push(`${t.name}: link "${l.label}" cockpit key "${l.cockpitKey}" has no COCKPIT_PATH`);
  }
  for (const [family, reads] of Object.entries(FAMILY_READS)) {
    if (!FAMILIES.includes(family as FamilyName)) violations.push(`FAMILY_READS names unknown family "${family}"`);
    for (const r of reads ?? []) if (!r.href || !r.href.startsWith('/')) violations.push(`FAMILY_READS[${family}]: "${r.label}" must be an href route`);
  }
  if (violations.length && opts.throwOnFail !== false) {
    throw new Error(`TOOL REGISTRY LAW failed:\n  ${violations.join('\n  ')}`);
  }
  return violations;
}

registryLaw();
