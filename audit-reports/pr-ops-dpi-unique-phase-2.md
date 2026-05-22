# PR-OPS-DPI-UNIQUE — Phase 2 Build Report

Implements the Phase 1 audit (`audit-reports/pr-ops-dpi-unique-phase-1.md`): a
`@@unique([task_id, plan_date])` on `operations_daily_plan_items` so a task has
at most one daily-plan item per day, with ad-hoc items (`task_id NULL`) left
unconstrained, plus graceful P2002 handling of the concurrent-insert race in the
Hub assign route. Built off `main` @ `6caaf8c3` (Hub-1 #571 merged — confirmed via
`git log`). Locked decisions from Phase 1 were applied, not re-derived.

---

## 1. Raw SQL migration (the DB half)

**Path:** `prisma/migrations/20260522000000_pr_ops_dpi_unique/migration.sql`

**Timestamp `20260522000000` — why it's last:** the newest migration on `main`
is `20260521020000_pr_ops_5_18_daily_plan_task_cascade`; `20260522000000` sorts
strictly after it, so this migration applies last and is never out-of-order.

**Statement (wrapped BEGIN;/COMMIT;):**
```sql
CREATE UNIQUE INDEX "operations_daily_plan_items_task_id_plan_date_key"
  ON "operations_daily_plan_items" ("task_id", "plan_date");
```
Plain `CREATE UNIQUE INDEX` (not `CONCURRENTLY` — `migrate deploy` runs each
migration in a transaction). Prod dupe-check returned 0 rows (Alex), so it will
not abort. Postgres NULL-distinct semantics leave ad-hoc (`task_id NULL`) rows
unconstrained automatically.

---

## 2. Parallel schema.prisma update (the types half) + drift proof

**Change** (`prisma/schema.prisma`, `operations_daily_plan_items` model, line
**2652**, added alongside the existing `@@index` lines):
```prisma
  @@unique([task_id, plan_date])
```

**`prisma generate` result:** succeeded against the pinned project Prisma —
`✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client`.
(Note: a bare `npx prisma` resolves an ad-hoc 7.8.0; the project binary
`./node_modules/.bin/prisma` is 5.22.0, matching `package.json` `^5.22.0`. All
checks below used the 5.22.0 binary.)

**Drift check — ZERO drift.** The migrations-directory diff
(`migrate diff --from-migrations`) requires a shadow database, unreachable from
the sandbox. DB-free equivalent proof instead: ask Prisma what SQL the
schema.prisma delta generates (datamodel→datamodel, no DB) and compare to the
hand-written migration:

```
$ prisma migrate diff \
    --from-schema-datamodel /tmp/schema-main.prisma \   # main's schema (no @@unique)
    --to-schema-datamodel  prisma/schema.prisma     \   # this branch (with @@unique)
    --script

-- CreateIndex
CREATE UNIQUE INDEX "operations_daily_plan_items_task_id_plan_date_key" ON "operations_daily_plan_items"("task_id", "plan_date");
```

Prisma's generated SQL is **identical** to the hand-written migration — same
index name (`operations_daily_plan_items_task_id_plan_date_key`, Prisma's
`<table>_<col1>_<col2>_key` default), same columns, same order. The only
difference is the `BEGIN;/COMMIT;` wrapper, which the migration runner applies
anyway. **schema.prisma and the migration agree exactly: zero drift.**

---

## 3. P2002 graceful handling (the integrity half)

**File:** `src/app/api/operations/tasks/[id]/assign/route.ts` (read fresh from
`main`; only the find-or-create path was touched).

**The gap:** the unique constraint closes the concurrent-insert race the UI
in-flight-disable cannot — two requests can both pass the find-or-create's
`findFirst` (lines 156-158) finding nothing, and both reach the `create` (line
165). With the constraint, one create wins; the loser's create raises P2002.
Before this change that P2002 was unhandled → 500.

Because the `create` is inside `prisma.$transaction`, a P2002 thrown there
poisons the transaction (Postgres aborts it; you cannot re-query on the same
`tx`). So the handling wraps the **whole** transaction and retries it once.

**P2002 matcher — specific, not catch-all** (`route.ts:73-84`):
```ts
function isDuplicatePlanItemError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  const asText = Array.isArray(target) ? target.join(',')
    : typeof target === 'string' ? target : '';
  return asText.includes('task_id') && asText.includes('plan_date');
}
```
P2002 shape matched: `PrismaClientKnownRequestError` with `.code === 'P2002'`
and `.meta.target` = the violated index/constraint. Postgres returns the index
name string `operations_daily_plan_items_task_id_plan_date_key`; some Prisma
versions return the field array `['task_id','plan_date']` — both contain the
substrings `task_id` and `plan_date`, so the matcher handles either. **Any other
error — including a P2002 on a different constraint — returns false and
propagates unchanged** (the existing `catch` at the end of POST still 500s /
handles `ConflictError`).

**Retry-once wrapper** (`route.ts:235-243`): the transaction body was extracted
verbatim into `const runAssignTxn = () => prisma.$transaction(async (tx) => {…})`
(no logic inside changed), then:
```ts
let result: Awaited<ReturnType<typeof runAssignTxn>>;
try {
  result = await runAssignTxn();
} catch (e) {
  if (isDuplicatePlanItemError(e)) {
    result = await runAssignTxn();   // re-run: find now sees the committed item
  } else {
    throw e;
  }
}
```

**How the loser reaches the same one-item end-state:** on the retry, the
winner's item is already committed, so `findFirst` (line 156-158) finds it,
the `create` is skipped, and the loser's block is attached to that existing
item (block create, line 178). Both racers end with exactly one
`operations_daily_plan_items` row for `(task_id, plan_date)` and their
respective blocks on it. This is **invariant reconciliation, not a fallback**:
the constraint and the find-or-create enforce the identical invariant (one item
per task per day). Only the item create can raise this P2002, so a single retry
is sufficient.

**No other Hub-1 behavior changed.** The transaction body (conflict check
156→a, find-or-create, block create, category-on-assign) is byte-identical —
only its wrapper changed from `const result = await prisma.$transaction(...)` to
`const runAssignTxn = () => prisma.$transaction(...)` + the try/retry. The
`ConflictError` 409 path, auth gates, and audit log are untouched.

---

## 4. Hard-constraint confirmations

- **Budget-line / actuals wiring:** untouched. The route only ever wrote TASK
  `coa_code` / `estimated_cost_usd` (category-on-assign, lines 192-197); that
  block is unchanged.
- **Conflict-detection logic:** untouched (the `tx.$queryRaw` OVERLAPS check and
  `ConflictError` throw, lines 142-151, are inside the unchanged txn body).
- **Auth gates:** untouched (`getVerifiedEmail` → user lookup → task ownership
  check, before any write).
- **No fallback logic** anywhere — the P2002 path is invariant reconciliation as
  described.
- **Both Prisma halves move in the same commit** (migration SQL + schema.prisma
  `@@unique`).

---

## 5. Verification results

- **`prisma generate` (5.22.0):** ✓ `Generated Prisma Client (v5.22.0)`.
- **Drift:** ✓ zero (§2 — Prisma-generated SQL identical to the migration).
- **`tsc --noEmit`:** ✓ exit 0, no type errors.
- **`next build`:** ✓ `Compiled successfully in 42s`, "Checking validity of
  types" passed. The build then errored in the page-data collection step on an
  **unrelated** route — `/api/admin/backfill-transaction-fields` throws
  `PLAID_CLIENT_ID and PLAID_SECRET must be set` at module load. This is the
  same class of sandbox-env limitation noted in Hub-1 (the `build` script also
  chains `prisma migrate deploy`, which needs the Azure `DATABASE_URL`,
  unreachable here). It is not produced by this change; compilation of the
  edited assign route succeeded.

On merge (Alex squash-merges on GitHub; SOC 2 gate), Vercel runs `prisma migrate
deploy` → the `CREATE UNIQUE INDEX` applies to prod (0 dupes verified, safe).
