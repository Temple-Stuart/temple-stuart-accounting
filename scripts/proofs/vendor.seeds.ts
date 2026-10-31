/**
 * The vendor law's seeded regressions (VENDOR-01, 2026-09-29).
 *
 * The law holds a plan's vendor to four clauses; each seed breaks one and must
 * fail THE VENDOR LAW by name:
 *
 *   1. ONE WRITER — the directory route writes planned_item_vendors (a); the
 *      plan-vendors route updates the vendor directory (b);
 *   2. THE CALLER FIRST — a query before the DELETE's gate (c); the vendor read
 *      loses its caller (d); a 403 (e); the plan-vendors path made public (f);
 *   3. THE DATABASE HOLDS IT — vendor_id CASCADEs instead of RESTRICT (g); the
 *      trigger stops locking a line's row (h); the task CHECK goes (i); a line's
 *      every-occurrence index goes (j); the trigger no longer runs on UPDATE (k);
 *   4. THE RULE, PROBED — case makes two names (l); a 201-character name passes
 *      (m); an every-occurrence vendor lets an occurrence in (n); occurrences let
 *      an every-occurrence vendor in (o).
 *
 * The anchors occur exactly once in their file, which the harness enforces
 * before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/operations/plan-vendors/route.ts';
const DIRECTORY = 'src/app/api/operations/vendor-directory/route.ts';
const MIDDLEWARE = 'src/middleware.ts';
const MIGRATION = 'prisma/migrations/20260929190000_vendor_01_planned_item_vendors/migration.sql';
const RULE = 'src/lib/operations/planVendor.ts';

export const SEEDS: Seed[] = [
  {
    name: 'a · the directory route writes planned_item_vendors',
    file: DIRECTORY,
    find: '      const taken = takenBy(name.name, vendors);\n',
    replace: '      await tx.planned_item_vendors.deleteMany({ where: { user_id: user.id } });\n      const taken = takenBy(name.name, vendors);\n',
    expect: 'writes planned_item_vendors (.deleteMany)',
  },
  {
    name: 'b · the plan-vendors route updates the vendor directory',
    file: ROUTE,
    find: '    const fits = vendorFits(vendorRow, planBook, books);\n',
    replace: '    await prisma.operations_vendor_directory.updateMany({ where: { user_id: user.id }, data: { is_active: true } });\n    const fits = vendorFits(vendorRow, planBook, books);\n',
    expect: 'updateManys the vendor directory — a vendor is created, never updated or deleted',
  },
  {
    name: 'c · a query runs before the DELETE gate',
    file: ROUTE,
    find: 'export async function DELETE(request: NextRequest) {\n  try {\n',
    replace: 'export async function DELETE(request: NextRequest) {\n  try {\n    await prisma.planned_item_vendors.count({ where: { user_id: String(request.nextUrl.searchParams.get(\'u\')) } });\n',
    expect: 'DELETE does not open with the cart-plan gate',
  },
  {
    name: 'd · the vendor read loses its caller',
    file: ROUTE,
    find: 'where: { id: vendorId, user_id: user.id }',
    replace: 'where: { id: vendorId }',
    expect: 'prisma.operations_vendor_directory.findFirst names no caller',
  },
  {
    name: 'e · a plan that is not found answers 403',
    file: ROUTE,
    find: "const noPlan = () => NextResponse.json({ error: 'not-found', message: 'No such plan' }, { status: 404 });",
    replace: "const noPlan = () => NextResponse.json({ error: 'not-found', message: 'No such plan' }, { status: 403 });",
    expect: 'answers 403',
  },
  {
    name: 'f · the plan-vendors path is made public',
    file: MIDDLEWARE,
    find: "  '/api/inngest',\n",
    replace: "  '/api/inngest',\n  '/api/operations/plan-vendors',\n",
    expect: '/api/operations/plan-vendors is a public path',
  },
  {
    name: 'g · vendor_id CASCADEs instead of RESTRICT',
    file: MIGRATION,
    find: 'REFERENCES "operations_vendor_directory"("id") ON DELETE RESTRICT',
    replace: 'REFERENCES "operations_vendor_directory"("id") ON DELETE CASCADE',
    expect: 'vendor_id is not ON DELETE RESTRICT',
  },
  {
    name: 'h · the grain trigger stops locking a line row',
    file: MIGRATION,
    find: '    PERFORM 1 FROM "operations_routine_steps" WHERE "id" = NEW."step_id" FOR NO KEY UPDATE;\n',
    replace: '    PERFORM 1 FROM "operations_routine_steps" WHERE "id" = NEW."step_id";\n',
    expect: 'operations_routine_steps row FOR NO KEY UPDATE before it reads',
  },
  {
    name: 'i · the task CHECK goes',
    file: MIGRATION,
    find: 'ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_task_every_occurrence"\n  CHECK ("task_id" IS NULL OR "occurrence_at" IS NULL);\n',
    replace: '',
    expect: 'has no CHECK that a task row carries no occurrence',
  },
  {
    name: 'j · a line every-occurrence unique index goes',
    file: MIGRATION,
    find: 'CREATE UNIQUE INDEX "planned_item_vendors_step_every_key" ON "planned_item_vendors"("step_id") WHERE "step_id" IS NOT NULL AND "occurrence_at" IS NULL;\n',
    replace: '',
    expect: 'one every-occurrence vendor per step_id',
  },
  {
    name: 'k · the grain trigger no longer runs on UPDATE',
    file: MIGRATION,
    find: '  BEFORE INSERT OR UPDATE ON "planned_item_vendors"\n',
    replace: '  BEFORE INSERT ON "planned_item_vendors"\n',
    expect: 'has no BEFORE INSERT OR UPDATE grain trigger',
  },
  {
    name: 'l · case makes two names',
    file: RULE,
    find: 'export const vendorNameKey = (raw: string): string => spaced(raw).toLowerCase();',
    replace: 'export const vendorNameKey = (raw: string): string => spaced(raw);',
    expect: '"Pho 24" are not one name',
  },
  {
    name: 'm · a 201-character name passes',
    file: RULE,
    find: '  if (length > VENDOR_NAME_MAX) return',
    replace: '  if (length > VENDOR_NAME_MAX + 1) return',
    expect: 'a 201-character vendor name is not refused',
  },
  {
    name: 'n · an every-occurrence vendor lets an occurrence in',
    file: RULE,
    find: '    if (every !== null) {\n',
    replace: '    if (every !== null && held.length < 0) {\n',
    expect: 'lets an every-occurrence vendor sit beside a single-occurrence one',
  },
  {
    name: 'o · occurrences let an every-occurrence vendor in',
    file: RULE,
    find: '  if (single.length > 0) {\n',
    replace: '  if (single.length > 1) {\n',
    expect: 'lets a single-occurrence vendor sit beside an every-occurrence one',
  },
];
