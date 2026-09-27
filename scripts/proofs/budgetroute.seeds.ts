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
 * The anchors occur exactly once in their file, which the harness enforces
 * before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/budget/report/route.ts';
const PAGE = 'src/app/budget/page.tsx';
const MIDDLEWARE = 'src/middleware.ts';
const GATE_ANCHOR = '  try {\n    const userEmail = await getVerifiedEmail();';
const AFTER_GATE_ANCHOR = "    // The server's clock is read HERE, once; the pure half takes the day.";

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
];
