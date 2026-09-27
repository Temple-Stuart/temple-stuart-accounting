/**
 * The budget report purity law's seeded regressions (TAB13-01, 2026-09-27).
 *
 * The law says the budget report model (src/lib/budget/report.ts) and every
 * file in its local import tree are pure: no @prisma/client, no next, no
 * fetch, no clock, no process.env — and the model's test loads without a
 * generated client. These eight seeds are its clauses, one each:
 *
 *   · the model imports @prisma/client (a type import counts);
 *   · the model imports next;
 *   · the model calls fetch;
 *   · the model reads the clock through Date.now();
 *   · the model reads the clock through an argument-less new Date();
 *   · the model reads process.env;
 *   · a file the model imports (scheme.ts) imports the Prisma client module,
 *     which the walk follows into src/lib/prisma.ts;
 *   · the model's test imports @prisma/client.
 *
 * TAB13-02a added the law's second root, the day rules (src/lib/budget/days.ts):
 * seeds i, j and k prove its clauses on that root and its test.
 *
 * Each must fail THE BUDGET REPORT PURITY LAW by name. The anchors occur exactly
 * once in their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const MODEL = 'src/lib/budget/report.ts';
// TAB13-02a: the law's second root, the day rules, and their test.
const DAYS = 'src/lib/budget/days.ts';
const DAYS_TEST = 'src/lib/__tests__/budgetDays.test.ts';
const DAYS_BODY_ANCHOR = 'export function buildRoutineBudgetLines(routines: readonly RoutinePlanInput[], rangeFrom: IsoDay, rangeTo: IsoDay): DayRuleResult {';
const DAYS_IMPORT_ANCHOR = "import { entityLetter } from '@/lib/accountString';";
const SCHEME = 'src/lib/coa/scheme.ts';
const TEST = 'src/lib/__tests__/budgetReport.test.ts';
const IMPORT_ANCHOR = "import { variance } from '@/lib/calendar/links';";
const BODY_ANCHOR = 'export function buildBudgetReport(input: BudgetReportInput): BudgetReport {';
const inBody = (statement: string) => `${BODY_ANCHOR}\n  ${statement}`;

export const SEEDS: Seed[] = [
  {
    name: 'budget-a the model imports @prisma/client',
    file: MODEL,
    find: IMPORT_ANCHOR,
    replace: `import type { Prisma } from '@prisma/client';\n${IMPORT_ANCHOR}`,
    expect: 'src/lib/budget/report.ts imports @prisma/client',
  },
  {
    name: 'budget-b the model imports next',
    file: MODEL,
    find: IMPORT_ANCHOR,
    replace: `import { NextResponse } from 'next/server';\n${IMPORT_ANCHOR}`,
    expect: 'src/lib/budget/report.ts imports next',
  },
  {
    name: 'budget-c the model calls fetch',
    file: MODEL,
    find: BODY_ANCHOR,
    replace: inBody("void fetch('/api/budget/report');"),
    expect: 'src/lib/budget/report.ts calls fetch',
  },
  {
    name: 'budget-d the model reads the clock through Date.now()',
    file: MODEL,
    find: BODY_ANCHOR,
    replace: inBody('const stamp = Date.now(); void stamp;'),
    expect: 'src/lib/budget/report.ts reads the clock through Date.now()',
  },
  {
    name: 'budget-e the model reads the clock through an argument-less new Date()',
    file: MODEL,
    find: BODY_ANCHOR,
    replace: inBody('const today = new Date(); void today;'),
    expect: 'src/lib/budget/report.ts reads the clock through an argument-less new Date()',
  },
  {
    name: 'budget-f the model reads process.env',
    file: MODEL,
    find: BODY_ANCHOR,
    // NODE_ENV is already read in src (src/lib/prisma.ts), so the env law's README check
    // passes and the failure is this law's alone; a new name would fail the env law first.
    replace: inBody('const mode = process.env.NODE_ENV; void mode;'),
    expect: 'src/lib/budget/report.ts reads process.env',
  },
  {
    name: 'budget-g a file in the model\'s import tree reaches the Prisma client',
    file: SCHEME,
    find: "import { ValidationError } from '@/lib/errors/ValidationError';",
    replace: "import { ValidationError } from '@/lib/errors/ValidationError';\nimport { prisma } from '@/lib/prisma';\nvoid prisma;",
    expect: 'src/lib/prisma.ts imports @prisma/client — it is in the import tree of src/lib/budget/report.ts',
  },
  {
    name: 'budget-h the model\'s test imports @prisma/client',
    file: TEST,
    find: "import { code } from '../sourceText';",
    replace: "import { code } from '../sourceText';\nimport { Prisma } from '@prisma/client';\nvoid Prisma;",
    expect: 'budgetReport.test.ts imports @prisma/client',
  },
  // TAB13-02a — the second root. Each clause proved on the day rules and their test.
  {
    name: 'budget-i the day rules read the clock through Date.now()',
    file: DAYS,
    find: DAYS_BODY_ANCHOR,
    replace: `${DAYS_BODY_ANCHOR}\n  const stamp = Date.now(); void stamp;`,
    expect: 'src/lib/budget/days.ts reads the clock through Date.now() — the day module is pure',
  },
  {
    name: 'budget-j the day rules import @prisma/client',
    file: DAYS,
    find: DAYS_IMPORT_ANCHOR,
    replace: `import type { Prisma } from '@prisma/client';\n${DAYS_IMPORT_ANCHOR}`,
    expect: 'src/lib/budget/days.ts imports @prisma/client — the day module is pure',
  },
  {
    name: 'budget-k the day rules test imports @prisma/client',
    file: DAYS_TEST,
    find: "import { code } from '../sourceText';",
    replace: "import { code } from '../sourceText';\nimport { Prisma } from '@prisma/client';\nvoid Prisma;",
    expect: 'budgetDays.test.ts imports @prisma/client — the test of the day module must load without a generated client',
  },
];
