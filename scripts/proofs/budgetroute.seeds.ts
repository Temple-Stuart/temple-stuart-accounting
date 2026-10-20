/**
 * The budget report route law's seeded regressions (TAB13-02b, 2026-09-27).
 *
 * The law holds GET /api/budget/report to five clauses; each seed breaks one
 * and must fail THE BUDGET REPORT ROUTE LAW by name:
 *
 *   1. the gate comes first — a read before the cart-plan auth (a); a second
 *      method beside GET (b); the path made public in the middleware (c);
 *   2. no travel table — the route reads budget_line_items (d);
 *   3. left out by name — the actuals query stops excluding closing entries (e)
 *      or reversal pairs (f);
 *   4. it writes nothing — an update in the route (g);
 *   5. /budget renders the report — the page imports BudgetingPage (h).
 *
 * TAB13-02e (2026-09-28): clauses 2 and 4 read the Budget files only — the
 * route, src/lib/budget, src/components/budget and the routine loader. Seeds i,
 * j and k prove the scope reaches past the route: a write in the route-inputs
 * module (i), a travel table named in the loader (j), and a travel file imported
 * by the screen (k).
 *
 * TAB13-04 (2026-09-29): clause 6 — THE ONE INPUT. Every writing fetch in a
 * Budget file goes to a vendor route, by literal path and method. Seeds l–p: the
 * drill writes to another path (l), sends the wrong verb to plan-vendors (m), the
 * report screen itself writes (n), a path the law cannot read (o), and a method
 * the law cannot read (p).
 *
 * BUDGET-02 (ruled by Alex 2026-10-20, ruling G): TWO ROUTES, ONE LOADER. The
 * one actuals query and its counts moved into src/lib/budget/reportReads.ts, so
 * seeds e and f now break it THERE; the drill route GET /api/budget/report/cell
 * joins clause 1 (seeds q, r, s); no Budget file but the loader may read
 * ledger_entries (seeds t, u), and the loader reads it once and counts what it
 * leaves out (seeds v, w). The day-plan drill left /budget, and the vendor box
 * it held lives in src/components/budget/VendorBox.tsx — seeds l, m, o and p
 * break it there; seed n breaks the screen's one reader (readBudget).
 *
 * The anchors occur exactly once in their file, which the harness enforces
 * before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/budget/report/route.ts';
const PAGE = 'src/app/budget/page.tsx';
const MIDDLEWARE = 'src/middleware.ts';
const GATE_ANCHOR = '  try {\n    const userEmail = await getVerifiedEmail();';
const AFTER_GATE_ANCHOR = "    // The server's clock is read HERE, once; the pure half takes the day.";
// TAB13-02e: three more Budget files, one per new seed.
const INPUTS = 'src/lib/budget/reportInputs.ts';
const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const SCREEN = 'src/components/budget/BudgetReport.tsx';
const INPUTS_ANCHOR = 'export function utcDay(instant: Date): IsoDay {';
const LOADER_ANCHOR = 'export type RoutineBudgetRow = Prisma.operations_routinesGetPayload<{ select: typeof ROUTINE_BUDGET_SELECT }>;';
const SCREEN_ANCHOR = "import { SECTION_HEADER, toggleChip } from '@/lib/ds';";
// TAB13-04: the vendor box's writes, and the screen's one read. BUDGET-02: the box's file is VendorBox.tsx
// (DayPlanDrill.tsx less the drill); the screen reads through one function, readBudget.
const DRILL = 'src/components/budget/VendorBox.tsx';
const ADD_ANCHOR = "    return await answerOf(await fetch('/api/operations/vendor-directory', {\n      method: 'POST',";
const SET_ANCHOR = "    return await answerOf(await fetch('/api/operations/plan-vendors', {\n      method: 'POST',";
const CLEAR_ANCHOR = "{ method: 'DELETE', redirect: 'manual' }";
const READ_ANCHOR = "res = await fetch(url, { cache: 'no-store', redirect: 'manual' });";
// BUDGET-02: the drill route and the one loader.
const CELL = 'src/app/api/budget/report/cell/route.ts';
const READS = 'src/lib/budget/reportReads.ts';

export const SEEDS: Seed[] = [
  {
    name: 'route-a a read before the gate',
    file: ROUTE,
    find: GATE_ANCHOR,
    replace: "  try {\n    const early = request.nextUrl.searchParams.get('view'); void early;\n    const userEmail = await getVerifiedEmail();",
    expect: 'budget report route law: src/app/api/budget/report/route.ts does not open with the cart-plan auth',
  },
  {
    name: 'route-b the route exports a POST beside GET',
    file: ROUTE,
    find: "export const dynamic = 'force-dynamic';",
    replace: "export const dynamic = 'force-dynamic';\n\nexport async function POST() {\n  return NextResponse.json({ error: 'no' }, { status: 405 });\n}",
    expect: 'exports a method other than GET (POST, GET)',
  },
  {
    name: 'route-c the budget API is made a public path',
    file: MIDDLEWARE,
    find: "  '/api/proposals',\n];",
    replace: "  '/api/proposals',\n  '/api/budget',\n];",
    expect: '/api/budget/report is a public path (src/middleware.ts lists /api/budget)',
  },
  {
    name: 'route-d the route reads a travel table',
    file: ROUTE,
    find: AFTER_GATE_ANCHOR,
    replace: `    const travelLines = await prisma.budget_line_items.findMany({ where: { userId: user.id } }); void travelLines;\n${AFTER_GATE_ANCHOR}`,
    expect: 'src/app/api/budget/report/route.ts names the travel table budget_line_items',
  },
  {
    name: 'route-e the actuals stop excluding closing entries (BUDGET-02: in the loader)',
    file: READS,
    find: "reversed_by_entry_id: null, source_type: { not: 'year_end_close' } }),",
    replace: 'reversed_by_entry_id: null }),',
    expect: 'src/lib/budget/reportReads.ts does not leave out closing entries by name in its actuals query',
  },
  {
    name: 'route-f the actuals stop excluding reversal pairs (BUDGET-02: in the loader)',
    file: READS,
    find: 'lte: dayStart(through) }, is_reversal: false, reversed_by_entry_id: null, source_type: { not:',
    replace: 'lte: dayStart(through) }, source_type: { not:',
    expect: 'src/lib/budget/reportReads.ts does not leave out reversal pairs by name in its actuals query',
  },
  {
    name: 'route-g the route writes',
    file: ROUTE,
    find: AFTER_GATE_ANCHOR,
    replace: `    await prisma.users.update({ where: { id: user.id }, data: {} });\n${AFTER_GATE_ANCHOR}`,
    expect: 'src/app/api/budget/report/route.ts writes (.users.update(',
  },
  {
    name: 'route-h /budget mounts BudgetingPage again',
    file: PAGE,
    find: "import BudgetReport from '@/components/budget/BudgetReport';",
    replace: "import BudgetReport from '@/components/budget/BudgetReport';\nimport BudgetingPage from '@/components/dashboard/BudgetingPage';\nvoid BudgetingPage;",
    expect: 'BudgetingPage is in the import tree of src/app/budget/page.tsx',
  },
  // TAB13-02e — the Budget files beyond the route.
  {
    name: 'route-i the route-inputs module writes',
    file: INPUTS,
    find: INPUTS_ANCHOR,
    replace: `const scratchWrite = (db: { users: { update: (a: unknown) => unknown } }) => db.users.update({});\nvoid scratchWrite;\n${INPUTS_ANCHOR}`,
    expect: 'src/lib/budget/reportInputs.ts writes (.users.update() — it is a Budget file, and the report writes nothing',
  },
  {
    name: 'route-j the routine budget loader names a travel table',
    file: LOADER,
    find: LOADER_ANCHOR,
    replace: `${LOADER_ANCHOR}\nexport const SCRATCH_TRAVEL_TABLE = 'trip_itinerary';`,
    expect: 'src/lib/operations/routineBudgetInputs.ts names the travel table trip_itinerary — it is a Budget file',
  },
  {
    name: 'route-k the budget screen imports a travel file',
    file: SCREEN,
    find: SCREEN_ANCHOR,
    replace: `${SCREEN_ANCHOR}\nimport { LINE_STATUS } from '@/lib/trips/lineStatus';\nvoid LINE_STATUS;`,
    expect: 'src/components/budget/BudgetReport.tsx imports the travel file src/lib/trips/lineStatus.ts — it is a Budget file',
  },
  {
    name: 'route-l the drill writes to a path that is not a vendor route',
    file: DRILL,
    find: ADD_ANCHOR,
    replace: "    return await answerOf(await fetch('/api/budget/report', {\n      method: 'POST',",
    expect: 'src/components/budget/VendorBox.tsx writes (POST /api/budget/report) — the one input on /budget is a plan line vendor',
  },
  {
    name: 'route-m the drill sends plan-vendors a verb it does not take',
    file: DRILL,
    find: CLEAR_ANCHOR,
    replace: "{ method: 'PATCH', redirect: 'manual' }",
    expect: 'writes (PATCH /api/operations/plan-vendors)',
  },
  {
    name: 'route-n the report screen itself writes (BUDGET-02: through its one reader)',
    file: SCREEN,
    find: READ_ANCHOR,
    replace: "res = await fetch(url, { method: 'POST', cache: 'no-store', redirect: 'manual' });",
    expect: 'src/components/budget/BudgetReport.tsx writes (POST) to a path the law cannot read as a literal',
  },
  {
    name: 'route-o a write to a path the law cannot read',
    file: DRILL,
    find: SET_ANCHOR,
    replace: "    return await answerOf(await fetch(['/api/operations', 'plan-vendors'].join('/'), {\n      method: 'POST',",
    expect: 'src/components/budget/VendorBox.tsx writes (POST) to a path the law cannot read as a literal',
  },
  {
    name: 'route-p a method the law cannot read',
    file: DRILL,
    find: CLEAR_ANCHOR,
    replace: "{ method: ['DEL', 'ETE'].join(''), redirect: 'manual' }",
    expect: 'calls fetch with a method the law cannot read as a literal',
  },
  // BUDGET-02 — the drill route holds clause 1; only the loader reads the ledger, once, and counts what it leaves out.
  {
    name: 'route-q the cell route reads before the gate',
    file: CELL,
    find: GATE_ANCHOR,
    replace: "  try {\n    const early = request.nextUrl.searchParams.get('book'); void early;\n    const userEmail = await getVerifiedEmail();",
    expect: 'budget report route law: src/app/api/budget/report/cell/route.ts does not open with the cart-plan auth',
  },
  {
    name: 'route-r the cell route exports a POST beside GET',
    file: CELL,
    find: "export const dynamic = 'force-dynamic';",
    replace: "export const dynamic = 'force-dynamic';\n\nexport async function POST() {\n  return NextResponse.json({ error: 'no' }, { status: 405 });\n}",
    expect: 'src/app/api/budget/report/cell/route.ts exports a method other than GET (POST, GET)',
  },
  {
    name: 'route-s the cell route is made a public path',
    file: MIDDLEWARE,
    find: "  '/api/proposals',\n];",
    replace: "  '/api/proposals',\n  '/api/budget/report/cell',\n];",
    expect: '/api/budget/report/cell is a public path (src/middleware.ts lists /api/budget/report/cell)',
  },
  {
    name: 'route-t the cell route reads the ledger itself',
    file: CELL,
    find: AFTER_GATE_ANCHOR,
    replace: `    const stray = await prisma.ledger_entries.findMany({ where: { journal_entry: { userId: user.id } }, select: { id: true } }); void stray;\n${AFTER_GATE_ANCHOR}`,
    expect: 'src/app/api/budget/report/cell/route.ts reads ledger lines itself — a Budget file reads the actuals only through src/lib/budget/reportReads.ts',
  },
  {
    name: 'route-u the report route reads its actuals itself, not through the loader',
    file: ROUTE,
    find: '      readActuals(prisma, user.id, entityIds, rangeFrom, through),',
    replace: '      prisma.ledger_entries.findMany({ where: { journal_entry: { userId: user.id } }, select: { id: true } }),',
    expect: 'src/app/api/budget/report/route.ts reads ledger lines itself — a Budget file reads the actuals only through src/lib/budget/reportReads.ts',
  },
  {
    name: 'route-v the loader reads the ledger a second time',
    file: READS,
    find: '/** What readActuals leaves out of [from, through], counted',
    replace: "export const strayActuals = (db: Db) => db.ledger_entries.findMany({ where: {}, select: { id: true } });\n\n/** What readActuals leaves out of [from, through], counted",
    expect: 'src/lib/budget/reportReads.ts reads ledger lines 2 times — the actuals are ONE query, filtered by name',
  },
  {
    name: 'route-w the loader stops counting the reversal pairs it leaves out',
    file: READS,
    find: 'OR: [{ is_reversal: true }, { reversed_by_entry_id: { not: null } }]',
    replace: 'OR: [{ reversed_by_entry_id: { not: null } }]',
    expect: 'src/lib/budget/reportReads.ts does not count the reversal pairs it leaves out',
  },
];
