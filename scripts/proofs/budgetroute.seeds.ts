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
    name: 'route-e the actuals stop excluding closing entries',
    file: ROUTE,
    find: "reversed_by_entry_id: null, source_type: { not: 'year_end_close' } }),",
    replace: 'reversed_by_entry_id: null }),',
    expect: 'does not leave out closing entries by name in its actuals query',
  },
  {
    name: 'route-f the actuals stop excluding reversal pairs',
    file: ROUTE,
    find: "lte: throughDay }, is_reversal: false, reversed_by_entry_id: null, source_type: { not:",
    replace: 'lte: throughDay }, source_type: { not:',
    expect: 'does not leave out reversal pairs by name in its actuals query',
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
];
