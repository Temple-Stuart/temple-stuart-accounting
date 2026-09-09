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
 * NAV-02: the family navigation's tabs are MENUS and each family has a PAGE
 * (FAMILY_PAGES). familyMenu() and familyCards() below are the ONE source the
 * nav and the pages render from and the build assert counts: every tool in
 * exactly one menu and on exactly one page, once each, in sheet order.
 *
 * THE LAW (module scope — the deck's LAYOUT LAW idiom; also re-run at build by
 * scripts/assert-tool-registry.ts, which adds the filesystem check that every
 * home resolves to a page file):
 *   1. registry keys == PROBLEM_SHEET cells, 25/25, both directions;
 *   2. a LIVE or PARTIAL tool has a home; a NOT_BUILT tool has none;
 *   3. NOT_BUILT ⇔ no beats; LIVE ⇒ four beats; a PARTIAL with four beats
 *      carries a `why` note (thrown without it) — four beats never imply LIVE;
 *   4. status counts == the dated census (EXPECTED_STATUS_COUNTS);
 *   5. (NAV-02) every family has one page route — single-segment kebab-case,
 *      unique, never a cockpit path or a tool's home.
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
  Calendar: {
    slug: 'calendar', status: 'PARTIAL', beats: ALL, home: '/agenda',
    why: 'an agenda list whose commit lands on calendar_events; the calendar grid itself lives on /runway',
    links: [{ label: 'Routines · the recurring form', cockpitKey: 'routines' }],
    citation: 'src/app/api/agenda/route.ts:5 (discover) · :56 (decide, draft :86) · src/app/api/agenda/[id]/route.ts:54 (commit) · :84 (record → calendar_events)',
    note: 'Reachable from no menu until this PR; the tab keyed "calendar" is Runway.',
  },
  Tasks: {
    slug: 'tasks', status: 'PARTIAL', beats: ALL, home: '/projects', cockpitKey: 'projects',
    why: "the founder's build pipeline — accepting a task fires a paid Claude Code build (tasks/[taskId]/route.ts:392-402); not a customer's task tool",
    links: [{ label: 'Issue log', href: '/operations/issues' }, { label: 'Audit tail', href: '/operations/audit-log' }],
    citation: 'src/app/api/operations/projects/[id]/tasks/route.ts:43 · generate-tasks/route.ts:42 · tasks/bulk-create/route.ts:117 · tasks/[taskId]/route.ts:82 → :339, :370',
  },
  Time: {
    slug: 'time', status: 'PARTIAL', beats: ALL, home: '/content', cockpitKey: 'content',
    why: 'day blocks and a daily log inside the Narrative pipeline; no time tool',
    links: [{ label: 'Daily plan · North Star', href: '/operations' }],
    citation: 'src/app/api/operations/tasks/unscheduled/route.ts · daily-plan/items/route.ts:120 · daily-plan/items/[itemId]/blocks/route.ts:36 · daily-plan/blocks/[blockId]/route.ts:38, :163',
  },
  // ── MONEY IN ──
  CRM: {
    slug: 'crm', status: 'NOT_BUILT', beats: NONE, home: null,
    citation: "/owner is the founder's proposals inbox — no contact or deal object (src/app/api/owner/proposals/route.ts)",
  },
  Contracts: { slug: 'contracts', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 5 — no page, route, or model' },
  Invoicing: { slug: 'invoicing', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 6 — no invoice model, no A/R route' },
  Payments: { slug: 'payments', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 7 — Stripe routes are the product\'s own billing; commission_ledger (schema:1397) is a Travel byproduct' },
  // ── MONEY OUT ──
  'Bill Pay': { slug: 'bill-pay', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 8 — operations_vendor_directory (schema:3478) is a read-only GET (vendor-directory/route.ts:12)' },
  Payroll: { slug: 'payroll', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 9 — no page, route, or model' },
  Expenses: {
    slug: 'expenses', status: 'NOT_BUILT', beats: NONE, home: null,
    citation: "trip cost split on the trip planner (src/app/api/trips/[id]/expenses/route.ts:70) is Travel's, not an expenses tool",
  },
  Travel: {
    slug: 'travel', status: 'LIVE', beats: ALL, home: '/travel', cockpitKey: 'travel',
    links: [{ label: 'Trips · the legacy pages', href: '/budgets/trips' }],
    citation: 'src/app/api/travel/liteapi/flights/search/route.ts:23 · travel/liteapi/prebook/route.ts:40 · travel/liteapi/book/route.ts:134 · :169, :193',
  },
  Mileage: { slug: 'mileage', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 12 — no miles or odometer column in prisma/schema.prisma' },
  Budget: {
    slug: 'budget', status: 'PARTIAL', beats: ALL, home: '/business',
    why: 'actuals by entity plus recurring lines on module_expenses; no plan vs actual; no personal · trade · travel roll-up',
    links: [
      { label: 'Personal', href: '/personal' }, { label: 'Home', href: '/home' }, { label: 'Auto', href: '/auto' },
      { label: 'Growth', href: '/growth' }, { label: 'Health', href: '/health' },
      { label: 'Shopping · meal & cart plans', href: '/shopping' },
      { label: 'Itinerary budget builder', href: '/hub/itinerary' },
      { label: 'Runway · the read-only view', cockpitKey: 'calendar' },
    ],
    citation: 'src/components/dashboard/BudgetingPage.tsx:39 · src/app/api/home/route.ts:33-63 · :89 (draft :107) · src/app/api/home/[id]/route.ts:143 · :118-139, :81-89',
    note: 'Six category pages, reachable from no menu until this PR; the draft form works on /business only (coaAccounts, census note B).',
  },
  // ── WHAT YOU OWN ──
  Banking: {
    slug: 'banking', status: 'PARTIAL', beats: some({ discover: true }), home: '/books', cockpitKey: 'books',
    links: [{ label: 'Accounts · the legacy page', href: '/accounts' }],
    citation: 'src/components/home/BooksPipeline.tsx:296 (Source Accounts) · src/app/api/accounts/route.ts:6; no transfer route exists',
  },
  'Fixed Assets': { slug: 'fixed-assets', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 15 — no depreciation or placed-in-service field' },
  Retirement: { slug: 'retirement', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 16 — 1099-R intake at src/app/api/tax/calculate/route.ts:250 is Tax' },
  Brokerage: {
    slug: 'brokerage', status: 'PARTIAL', beats: some({ discover: true, decide: true }), home: '/trade', cockpitKey: 'trade',
    links: [{ label: 'Standalone cockpit · chains, connect, observatory, journal', href: '/trading' }],
    citation: 'src/app/api/tastytrade/chains/route.ts:58 · scanner/route.ts:205 · src/app/api/trade-cards/route.ts:72 (status queued :92); no order is ever sent (ConvergenceIntelligence.tsx:840)',
  },
  'Trade Log': {
    slug: 'trade-log', status: 'PARTIAL', beats: some({ discover: true, commit: true, record: true }), home: '/books', cockpitKey: 'books',
    links: [{ label: 'Grade · on the Trade tab', cockpitKey: 'trade' }],
    citation: 'src/app/api/transactions/sync-complete/route.ts:185 → :242 · investment-transactions/commit-to-ledger/route.ts:106 → src/lib/position-tracker-service.ts:170, :307-311 · :601, :619; no persisted draft',
  },
  // ── WHAT YOU OWE ──
  Debt: { slug: 'debt', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 19 — src/app/api/net-worth/route.ts:36 is a totals read; no schedule, no lender' },
  'Sales Tax': { slug: 'sales-tax', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 20 — sales_tax_nexus (schema:2197) is a corpus enum' },
  'Ent Filings': { slug: 'ent-filings', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 21 — entities (schema:66-77) has no filing date or agent' },
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
  },
  Compliance: {
    slug: 'compliance', status: 'PARTIAL', beats: some({ discover: true, decide: true, record: true }), home: '/compliance', cockpitKey: 'compliance',
    links: [{ label: 'SOC 2 proofs', href: '/soc2' }],
    citation: 'src/lib/discovery/runDiscovery.ts:44 · :107 · src/lib/audit/writeAuditLog.ts:101 via materializeProposal.ts:186; nothing signed (attestation_status schema:2675-2678 never written)',
  },
  'FP&A': { slug: 'fpa', status: 'NOT_BUILT', beats: NONE, home: null, citation: 'TOOL CENSUS row 25 — no forecast model, route, or tab; MetricsAndProjectionsTab.tsx:53 reads a key the route never returns' },
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

/** The cockpit section a deep link lands on → the tool the family nav should open to. */
export const COCKPIT_PRIMARY_TOOL: Readonly<Record<string, ToolName>> = {
  projects: 'Tasks', content: 'Time', travel: 'Travel', calendar: 'Budget', routines: 'Calendar',
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

export function toolsOf(family: FamilyName): readonly ToolEntry[] {
  return TOOL_REGISTRY.filter((t) => t.family === family);
}

/**
 * NAV-02: the family PAGES — one route per family: the map of its tools (a
 * grid, one card per tool) and the door the family menu's first item opens.
 * On a phone the family tab IS this link (a menu on a 375px screen is the
 * page). The law holds the six unique and kebab-case; the build assert checks
 * each has a page file that names its family.
 */
export const FAMILY_PAGES: Readonly<Record<FamilyName, string>> = {
  'THE WORK': '/work',
  'MONEY IN': '/money-in',
  'MONEY OUT': '/money-out',
  'WHAT YOU OWN': '/what-you-own',
  'WHAT YOU OWE': '/what-you-owe',
  'THE PROOF': '/the-proof',
};

/** The family whose page this path is, or null. */
export function familyOfPath(pathname: string | null | undefined): FamilyName | null {
  if (!pathname) return null;
  return FAMILIES.find((f) => FAMILY_PAGES[f] === pathname) ?? null;
}

/**
 * NAV-02: a DOOR — where a menu item or a card link opens. A cockpit door is
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

/**
 * NAV-02: a family's MENU — what its tab opens. The first item is the family
 * page ("All of <FAMILY>"); then the family's tools in sheet order, each with
 * its status and its door. FamilyNav renders exactly this; the build assert
 * counts it (every tool in exactly one menu, exactly once).
 */
export type MenuItem =
  | { kind: 'family'; label: string; href: string }
  | { kind: 'tool'; tool: ToolEntry; door: ToolDoor };

export function familyMenu(family: FamilyName): readonly MenuItem[] {
  return [
    { kind: 'family', label: `All of ${family}`, href: FAMILY_PAGES[family] },
    ...toolsOf(family).map((tool): MenuItem => ({ kind: 'tool', tool, door: doorOf(tool) })),
  ];
}

/**
 * NAV-02: a family PAGE's cards — one per tool in sheet order: the tool, its
 * home (the registry's own route — a page, never a cockpit param) and its
 * related surfaces' doors. The family page renders exactly this; the build
 * assert counts it (every tool on exactly one page, exactly once).
 */
export interface FamilyCard {
  tool: ToolEntry;
  /** The registry home, or null for NOT_BUILT. */
  home: string | null;
  links: ReadonlyArray<{ label: string; door: ToolDoor }>;
}

export function familyCards(family: FamilyName): readonly FamilyCard[] {
  return toolsOf(family).map((tool) => ({
    tool,
    home: tool.home,
    links: (tool.links ?? []).map((l) => ({ label: l.label, door: doorOfLink(tool, l) })),
  }));
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
export function registryLaw(opts: { throwOnFail?: boolean; familyPages?: Readonly<Record<FamilyName, string>>; registry?: readonly ToolEntry[] } = {}): string[] {
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
  // NAV-02 (rule 5): one page route per family — single-segment kebab-case, unique, never a cockpit path or a tool's home.
  const pages = opts.familyPages ?? FAMILY_PAGES;
  const pageKeys = Object.keys(pages);
  if (pageKeys.length !== FAMILIES.length || FAMILIES.some((f) => !(f in pages))) violations.push(`FAMILY_PAGES must name the ${FAMILIES.length} families exactly (has ${pageKeys.join(', ')})`);
  for (const k of pageKeys) if (!FAMILIES.includes(k as FamilyName)) violations.push(`FAMILY_PAGES names unknown family "${k}"`);
  const routes = FAMILIES.map((f) => pages[f]).filter((r): r is string => typeof r === 'string');
  for (const f of FAMILIES) {
    const r = pages[f];
    if (typeof r !== 'string' || !/^\/[a-z][a-z0-9-]*$/.test(r)) violations.push(`FAMILY_PAGES[${f}] "${r}" is not a single-segment kebab-case route`);
    else if (Object.values(COCKPIT_PATH).includes(r) || TOOL_REGISTRY.some((t) => t.home === r)) violations.push(`FAMILY_PAGES[${f}] "${r}" collides with a cockpit path or a tool's home`);
  }
  if (new Set(routes).size !== routes.length) violations.push(`FAMILY_PAGES routes are not unique (${routes.join(', ')})`);
  if (violations.length && opts.throwOnFail !== false) {
    throw new Error(`TOOL REGISTRY LAW failed:\n  ${violations.join('\n  ')}`);
  }
  return violations;
}

registryLaw();
