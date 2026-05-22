PR-OPS-HUB-1 PHASE 2 — IMPLEMENTATION REPORT
=============================================

BRANCH: claude/pr-ops-hub-1-task-assign (off current origin/main 3140e9d).
COMMIT: 85cd3f4.

=== AUDIT-FIRST FINDINGS (re-verified against live source) ===

#1 — (task_id, plan_date) UNIQUE CONSTRAINT on operations_daily_plan_items:
  NONE EXISTS. schema.prisma:2652-2654 declares only three @@index
  (`[user_id, plan_date]`, `[task_id]`, `[entity_id]`) — no @@unique. The
  PR-4.0 create migration likewise adds no unique constraint. So duplicate
  daily_plan_items per (task, day) are NOT prevented at the DB level.
  → SUBSTITUTE in the assign txn: find-or-create. Inside the transaction
    (assign/route.ts) I query for an existing item for (user_id, task_id,
    plan_date) and reuse it if found; else create one. This dedupes per
    task per day in application code, standing in for the absent constraint.

#2 — CONFLICT CONTRACT (replicated verbatim inside the assign txn):
  - Overlap computation (source of truth): src/lib/operations/
    detectBlockConflicts.ts:27-40 —
      user_id = $user
      AND status NOT IN ('cancelled','missed')
      AND (scheduled_start, scheduled_end) OVERLAPS ($start::timestamptz, $end::timestamptz)
    (Postgres OVERLAPS, half-open intervals.)
  - The existing block-create endpoint's 409 shape:
    daily-plan/items/[itemId]/blocks/route.ts:97-103 →
      detectBlockConflicts(...) ; if conflicts.length>0 && !allow_conflicts
      → 409 { error:'Conflict', conflicting_block_ids: conflicts }.
  - MY REPLICATION: assign/route.ts inside prisma.$transaction runs the
    IDENTICAL raw SQL via the txn client (tx.$queryRaw) — same OVERLAPS,
    same status filter, same user scope — and throws a ConflictError
    (rolling back the whole txn) when conflicts exist and allow_conflicts
    !== true. The catch returns 409 { error:'Conflict', conflicting_block_ids }
    — byte-identical contract. allow_conflicts is an explicit user choice
    surfaced in the UI; never auto-set server-side.

#3 — entity derivation (no-trust-client): mirrored from daily-plan/items/
  route.ts:174-180 — assign/route.ts loads the task by (id, user_id) and
  uses task.entity_id for the item + block; client-supplied entity is never
  read.

#4 — auth reference (ai/cart-plan/route.ts:77-86): copied — getVerifiedEmail
  → 401; prisma.users.findFirst(insensitive email) → 404.

#6 — wired (not rebuilt): task PATCH /api/operations/projects/[id]/tasks/
  [taskId] accepts actual_cost_usd / actual_minutes; block PATCH
  /api/operations/daily-plan/blocks/[blockId] accepts scheduled_start/end
  (+ allow_conflicts, 409 at :99-106), actual_start/end (:111-139),
  status (:141-149).

=== AUTH GATES (cite line numbers) ===
  - unscheduled/route.ts: getVerifiedEmail :24 → 401 :25; users.findFirst
    :27 → 404 :30. Query user-scoped by user_id :35.
  - tasks/[id]/assign/route.ts: getVerifiedEmail :68 → 401 :69;
    users.findFirst :71 → 404 :74; task ownership findFirst {id, user_id}
    :84 → 404 :86. entity derived from task :130 (server-side). All BEFORE
    any write (the $transaction starts at :132).

=== BUDGET-LINE / ACTUALS WIRING — NOT TOUCHED (cite regions) ===
  - hub/page.tsx: I modified ONLY (a) the import block (added
    UnscheduledTaskTable), (b) added `unscheduledTasks` state + a
    `loadUnscheduledTasks` loader, (c) added `useEffect(... , [])` to load
    the pool, (d) inserted <UnscheduledTaskTable> + an onUpdated prop on
    <HubEventCard> in the region between the HubEventCard render and the
    "BUDGET COMPARISON" comment.
  - I did NOT modify the "BUDGET COMPARISON" block (the region starting at
    the `{/* BUDGET COMPARISON - WALL STREET STYLE */}` comment), the
    loadNomadBudget / loadBusinessBudget / loadYearCalendar loaders, the
    BudgetDrillDown wiring, or any actuals computation. The
    category-on-assign in the assign endpoint writes ONLY task fields
    (coa_code; estimated_cost_usd only when currently null —
    assign/route.ts:178-180) — no budget_line / planned / actuals row is
    read or written.

=== HONESTY CONSTRAINT — NO FABRICATED MODULE SECTIONS ===
  HubEventCard renders ONLY real-data sections (its existing doctrine):
  scheduled time + status, task (title/status), category (coa) [only when
  present], cost planned/actual [only sides populated], notes [only when
  present], and the new reschedule/reconcile action panels (which only
  read/write fields that exist). NO Trading P&L, Tax, Compliance, or
  budget-variance section was added — those modules don't exist and their
  shells are not fabricated. The card extends cleanly as they ship.

=== NO FALLBACK ===
  - Assign conflict → 409 surfaced with conflicting_block_ids; the UI shows
    "schedule anyway" as an explicit user choice (not a silent default).
  - Assign / reschedule / reconcile failure → inline error in the form/card;
    never a fabricated block or fake success.
  - Reconcile: if the block PATCH succeeds but the task-actuals PATCH fails,
    the card surfaces "block updated, but task actuals failed" — truthful,
    no silent swallow.

=== FILES (created / modified, line counts) ===
  NEW  src/app/api/operations/tasks/unscheduled/route.ts            (~55 lines)
  NEW  src/app/api/operations/tasks/[id]/assign/route.ts            (~230 lines)
  NEW  src/components/hub/UnscheduledTaskTable.tsx                  (~240 lines)
  MOD  src/components/hub/HubEventCard.tsx                          (+~210 lines: reschedule + reconcile)
  MOD  src/app/hub/page.tsx                                         (+~35 lines: pool fetch + table render + onUpdated)
  MOD  src/components/workbench/operations/dailyplan/types.ts       (+2 fields: project_id, actual_minutes)
  MOD  src/app/api/operations/daily-plan/items/route.ts            (+2 select fields: project_id, actual_minutes)
  (814 insertions, 8 deletions total.)

  Note on the two type/select additions: the in-card reconcile of
  actual_cost/minutes reaches the task PATCH at /api/operations/projects/
  [project_id]/tasks/[taskId], which requires project_id. LinkedTaskSummary
  lacked it, so project_id + actual_minutes were added to the type AND the
  daily-plan items GET select. Additive only; touches no budget/actuals
  wiring.

=== NO SCHEMA CHANGE ===
  Confirmed — reuses operations_project_tasks + operations_daily_plan_items
  + operations_calendar_blocks. "Unscheduled" is the derived Prisma relation
  filter `daily_plan_items: { none: { calendar_blocks: { some: {} } } }`,
  not a column. No migration created.

=== TYPECHECK + BUILD ===
  - npx tsc --noEmit → PASS (exit 0).
  - npx eslint (all 7 touched files) → 0 errors. The 4 new files +
    HubEventCard + types + items-route produced ZERO warnings. The only
    warnings are 17 PRE-EXISTING ones in hub/page.tsx (unused imports
    Card/Badge/MapContainer/etc., exhaustive-deps on pre-existing effects)
    — not introduced by this PR.
  - npx next build → "✓ Compiled successfully in 48s" and
    "Checking validity of types ..." PASSED. The build then failed at
    "Collecting page data" for an UNRELATED route
    (/api/admin/backfill-transaction-fields) that throws at module load
    when PLAID_CLIENT_ID/PLAID_SECRET are unset — a sandbox env limitation
    (same class as the DATABASE_URL gap on `prisma migrate deploy`), in
    code this PR does not touch. Compilation + type-validity of the changed
    code is confirmed.

NEXT STEP FOR ALEX: squash-merge the PR on GitHub. No SQL, no migration, no
env change required. The unscheduled pool + assign + pop-up actions are live
on the Hub once deployed (the prod build environment has DATABASE_URL +
PLAID secrets, so the full `npm run build` completes there).
