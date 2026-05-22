# PR-OPS-DPI-UNIQUE — Phase 1 Audit (read-only)

**Goal of the eventual PR:** add a uniqueness guarantee so a task can have at
most ONE `operations_daily_plan_items` row per day, while leaving ad-hoc items
(`task_id NULL`) unconstrained (multiple per day is legitimate). Today the only
thing preventing a duplicate task-linked item is the client's in-flight-disable
plus the in-app find-or-create — there is **no DB constraint** (confirmed
below).

This audit makes **no source edits, no migration, no schema change**. It is
investigation only. All line citations are against the current `main` (this
audit branch was cut from `main`) unless noted otherwise.

---

## 1. Current `operations_daily_plan_items` definition — NO unique on (task_id, plan_date)

`prisma/schema.prisma:2635-2656`:

```prisma
model operations_daily_plan_items {
  id                 String   @id @default(uuid()) @db.Uuid          // 2636
  user_id            String                                         // 2637
  entity_id          String                                         // 2638
  plan_date          DateTime @db.Date                              // 2639
  task_id            String?  @db.Uuid                              // 2640  (nullable)
  ad_hoc_title       String?  @db.VarChar(500)                      // 2641
  ad_hoc_description String?  @db.Text                              // 2642
  display_order      Int      @default(0)                           // 2643
  notes              String?  @db.Text                              // 2644
  created_at         DateTime @default(now()) @db.Timestamptz(6)    // 2645
  updated_at         DateTime @updatedAt @db.Timestamptz(6)         // 2646
  created_by         String?                                        // 2647

  task            operations_project_tasks?    @relation(fields: [task_id], references: [id], onDelete: Cascade)  // 2649
  calendar_blocks operations_calendar_blocks[]                                                                    // 2650

  @@index([user_id, plan_date])   // 2652
  @@index([task_id])              // 2653
  @@index([entity_id])            // 2654
  @@map("operations_daily_plan_items")  // 2655
}
```

- **All existing index/unique lines:** three `@@index` (2652, 2653, 2654). There
  is **NO `@@unique`** on this model. Confirmed: no unique on `(task_id,
  plan_date)` exists in the Prisma schema.

- **The CHECK constraint** is not (and cannot be) expressed in `schema.prisma` —
  Prisma has no PSL syntax for CHECK. It lives in the creating migration,
  `prisma/migrations/20260516000000_pr_ops_4_0_daily_plan_schema/migration.sql:25-26`:

  ```sql
  CONSTRAINT "operations_daily_plan_items_task_or_adhoc_check"
    CHECK ("task_id" IS NOT NULL OR "ad_hoc_title" IS NOT NULL),
  ```

  The same migration creates the three indexes (lines 30-32) and the task FK
  (lines 27-28, later changed to `ON DELETE CASCADE` by
  `20260521020000_pr_ops_5_18_daily_plan_task_cascade/migration.sql`). **None of
  these is a unique on `(task_id, plan_date)`.**

**Finding: confirmed — there is currently no unique constraint or unique index
on `(task_id, plan_date)`, in neither schema.prisma nor any migration.**

---

## 2. NULL-distinctness representation — recommend plain `@@unique([task_id, plan_date])`

### Can Prisma 5.22 express a partial unique index natively?

**No.** Versions: `package.json:19` `"@prisma/client": "^5.22.0"` and
`package.json:63` `"prisma": "^5.22.0"`. Prisma Schema Language (PSL) in the 5.x
line — including 5.22 — has **no syntax for a partial index** (no `WHERE` clause
on `@@index`/`@@unique`). A `CREATE UNIQUE INDEX ... WHERE task_id IS NOT NULL`
can only be authored as **raw SQL**. Because PSL cannot represent the `WHERE`
predicate, a raw partial index is **invisible to the schema**, so
`prisma migrate diff` / `prisma db pull` would see an index the datamodel
doesn't declare → **persistent drift** that has no clean PSL annotation to
silence in 5.22.

### Is a plain `@@unique([task_id, plan_date])` sufficient and drift-free?

**Yes — and it is the recommended form.** Postgres treats NULLs as **distinct**
by default in a unique index (the pre-15 behaviour, still the default in 15+
unless `NULLS NOT DISTINCT` is requested). In a *composite* unique index, a row
whose indexed tuple contains **any** NULL is never considered equal to another
row — so:

- `(NULL, 2026-05-22)` and `(NULL, 2026-05-22)` → both have `task_id NULL` → treated
  as distinct → **both allowed** (multiple ad-hoc items per day: preserved).
- `(<task-uuid>, 2026-05-22)` twice → both non-null → **conflict → rejected**
  (the duplicate task-linked item we want to forbid).

This is functionally identical to a `WHERE task_id IS NOT NULL` partial index
for this two-column case. The only differences are (a) the plain index also
*physically indexes* the ad-hoc (NULL) rows — a marginal size/perf cost, never a
correctness one — and (b) explicitness.

### Recommendation

**Use the plain `@@unique([task_id, plan_date])`.** Reason: it is **fully
Prisma-managed → zero drift** (Prisma owns both the schema declaration and the
generated SQL), and Postgres NULL-distinct semantics deliver the exact required
behaviour (ad-hoc rows unconstrained, task-linked rows deduped) for free. The
partial index `WHERE task_id IS NOT NULL` is the more *explicit* institutional
form but, in Prisma 5.22, it can only be raw SQL and would introduce a standing
drift problem with no clean PSL annotation — that cost is not worth the marginal
index-size saving here.

### Exact representations (for the eventual PR — NOT applied in this audit)

**schema.prisma** — add one line to the model (next to the existing `@@index`
lines, ~2654):

```prisma
  @@unique([task_id, plan_date])
```

**Generated migration SQL** (Prisma's default index name for an `@@unique` is
`<table>_<col1>_<col2>_key`):

```sql
CREATE UNIQUE INDEX "operations_daily_plan_items_task_id_plan_date_key"
  ON "operations_daily_plan_items" ("task_id", "plan_date");
```

### Drift-free sync plan

Per the locked pattern (raw SQL changes the DB; `schema.prisma` + `prisma
generate` change the TS types — both must move together):

1. Add `@@unique([task_id, plan_date])` to `operations_daily_plan_items` in
   `schema.prisma`.
2. Author the migration at
   `prisma/migrations/<timestamp>_pr_ops_dpi_unique/migration.sql` with the
   `CREATE UNIQUE INDEX` above. **Use Prisma's default index name
   `operations_daily_plan_items_task_id_plan_date_key`** so the DB object matches
   what `@@unique` implies — this is what keeps `prisma migrate diff` clean.
3. Run `npx prisma generate` to refresh the client types (the `@@unique` makes
   the tuple available to `findUnique`/`upsert`).
4. Verify no drift: `npx prisma migrate diff --from-schema-datamodel
   prisma/schema.prisma --to-migrations prisma/migrations` should report no
   difference.

Ad-hoc rows need **no** special handling — the composite NULL-distinct behaviour
leaves them unconstrained automatically.

---

## 3. task_id → user is 1:1 — the unique must NOT include user_id

`operations_project_tasks` (`prisma/schema.prisma:2596-2633`):

- `user_id String` at **line 2599** — **non-null** (no `?`).
- Relations (2623-2625): `project` (to `operations_projects`), `daily_plan_items`,
  `status_history`. There is **no share/collaborator relation** — a task belongs
  to exactly one user.
- The assign route derives `entity_id` from the task server-side and never
  trusts a client-supplied owner (assign/route.ts @ 85cd3f46:137), reinforcing
  that a task's ownership is fixed and singular.

**Finding: `task_id` implies exactly one `user_id`.** Therefore the unique key
should be `(task_id, plan_date)` and **must NOT include `user_id`** — adding
`user_id` would be redundant (functionally a no-op narrowing) and would
needlessly widen the index. `(task_id, plan_date)` is the correct minimal key.

---

## 4. Hub-1 find-or-create consistency — CONSISTENT

Source: `src/app/api/operations/tasks/[id]/assign/route.ts` on
`origin/claude/pr-ops-hub-1-task-assign` @ **85cd3f46** (read via `git show`, not
checked out). The find-or-create (lines 153-176):

```ts
// b. find-or-create the (task, day) item. No DB @@unique on
//    (task_id, plan_date) exists, so dedupe in-app ...
let item = await tx.operations_daily_plan_items.findFirst({         // 156
  where: { user_id: user.id, task_id: task.id, plan_date: planDate }, // 157
});
if (!item) { ... item = await tx.operations_daily_plan_items.create({...}) } // 159-175
```

- The **find key is `(user_id, task_id, plan_date)`** (line 157); the proposed
  unique is `(task_id, plan_date)`.
- Because `task_id → user_id` is 1:1 (§3), the extra `user_id` in the find
  narrows nothing: any row matching `(task_id, plan_date)` necessarily carries
  that task's `user_id`. So the find step reuses **precisely** the row the unique
  would protect.
- `plan_date` alignment: schema is `@db.Date` (2639); the route normalizes
  `plan_date` to UTC midnight via `parsePlanDate` (`${v}T00:00:00.000Z`,
  assign/route.ts:48-52) and uses that same value for both the find (157) and the
  create (169). The find and the constraint key on identical values.

**Finding: the proposed `@@unique([task_id, plan_date])` is CONSISTENT with the
find-or-create — the constraint can never reject a row the find step would not
already have found and reused. No mismatch.**

**Strengthening note (for the PR, not a blocker):** the in-app find-or-create is
*not* race-safe today — two concurrent assigns for the same `(task, day)` can
both find nothing (even inside their transactions, since `READ COMMITTED`
snapshots don't see each other's uncommitted insert) and both create a row. The
unique constraint **closes exactly this race**, turning the soft in-app dedupe
into a hard guarantee. One consequence to handle in the eventual PR: once the
constraint exists, the losing concurrent insert raises a Prisma `P2002` unique
violation; the assign route does **not** currently catch `P2002`, so it would
surface as a 500. The PR should map `P2002` on this key to a graceful
"reuse-the-existing-item" retry or a clear 409 — that's an implementation
follow-up, noted here so it isn't missed.

---

## 5. Migration mechanics — Vercel runs `migrate deploy`; CREATE UNIQUE INDEX is gated on the dupe-check

- **Location & naming:** migrations live in `prisma/migrations/`. Provider is
  `postgresql` (`migration_lock.toml`). The dominant naming pattern is a
  timestamp prefix + descriptive name, e.g.
  `20260521020000_pr_ops_5_18_daily_plan_task_cascade`,
  `20260516000000_pr_ops_4_0_daily_plan_schema`. (A few legacy dirs lack the
  timestamp, e.g. `add_robinhood_reconciliation`.) The new migration should
  follow the timestamped `..._pr_ops_dpi_unique` convention with a timestamp
  later than `20260521020000`.

- **Deploy runs migrations:** `package.json:8`
  `"build": "prisma generate && prisma migrate deploy && next build"`. Vercel's
  build therefore runs `prisma migrate deploy`, which applies any pending
  migration — so the `CREATE UNIQUE INDEX` **will run on deploy**.

- **Failure mode on existing dupes:** `CREATE UNIQUE INDEX` is **not**
  `CONCURRENTLY` and is run inside the migration. If prod already contains two+
  rows with the same non-null `(task_id, plan_date)`, Postgres aborts index
  creation (`ERROR: could not create unique index ... Key (task_id,
  plan_date)=(...) is duplicated`). `prisma migrate deploy` then exits non-zero,
  **failing the Vercel build/deploy** and leaving the schema unchanged.

- **Gating:** the migration is therefore **gated on Alex's separate `psql`
  duplicate-check**. The `CREATE UNIQUE INDEX` must not be deployed until that
  check confirms zero duplicate non-null `(task_id, plan_date)` rows in prod (and
  any found dupes are reconciled first). This audit does not run that check.

---

## Summary / recommendation

| Item | Finding |
|------|---------|
| Existing unique on (task_id, plan_date)? | **None** — schema.prisma:2652-2654 (only 3 `@@index`), no unique in any migration. |
| Recommended form | **Plain `@@unique([task_id, plan_date])`** — drift-free, Prisma-managed; Postgres NULL-distinct gives partial-index behaviour for free. |
| schema.prisma change | `@@unique([task_id, plan_date])` on the model. |
| Raw SQL | `CREATE UNIQUE INDEX "operations_daily_plan_items_task_id_plan_date_key" ON "operations_daily_plan_items" ("task_id", "plan_date");` |
| Sync / no-drift | schema `@@unique` + migration with Prisma's default index name + `prisma generate`; verify with `prisma migrate diff`. |
| user_id in the key? | **No** — task_id→user_id is 1:1 (user_id non-null, no share model; schema.prisma:2599). |
| Find-or-create consistency | **Consistent** — find on (user_id, task_id, plan_date) @ 85cd3f46:156-157 reuses exactly the row the unique protects; never rejects a reusable row. Note: constraint also closes a concurrent-insert race; handle `P2002` in the PR. |
| Deploy / gating | Vercel runs `prisma migrate deploy` (package.json:8); CREATE UNIQUE INDEX fails the deploy if prod has dupes → **gated on Alex's psql dupe-check**. |

No edits, no migration, no schema change were made. Read-only audit only.
