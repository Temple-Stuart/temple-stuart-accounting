PR-OPS-5.13 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `a26ccd7` (merge #559 PR-Ops-5.12 daily-plan list audit) → `57dfb16` (5.12 audit commit) → `4503584` (merge #558 PR-Ops-5.11 hub clean-slate). **PR-Ops-5.11 confirmed on main** (the underlying commit `a8257a5` is in main's history; merge #558 is in the top 3).
- current branch: `claude/pr-ops-5.13-routine-capture-gap-audit`

A. CURRENT ROUTINE SCHEMA

**`operations_routines` model — `prisma/schema.prisma:2716-2749`. FULL field list:**

| # | line | field | type | nullable | notes |
|---|------|-------|------|----------|-------|
| 1 | 2717 | `id` | `String @id @default(uuid()) @db.Uuid` | no | PK |
| 2 | 2718 | `user_id` | `String` | no | owner |
| 3 | **2719** | **`entity_id`** | **`String`** | **no** | **FK target by convention (no @relation defined here); REQUIRED field — already shipped** |
| 4 | 2720 | `name` | `String @db.VarChar(200)` | no | unique per (user_id, name) at :2744 |
| 5 | 2721 | `description` | `String? @db.Text` | yes | |
| 6 | 2722 | `schedule_rrule` | `String @db.Text` | no | RFC 5545 RRULE — required |
| 7 | 2723 | `timezone` | `String @default("America/Los_Angeles") @db.VarChar(64)` | no | |
| 8 | 2724 | `next_due_at` | `DateTime? @db.Timestamptz(6)` | yes | scheduler cache |
| 9 | 2725 | `last_evaluated_at` | `DateTime? @db.Timestamptz(6)` | yes | |
| 10 | 2726 | `last_completed_at` | `DateTime? @db.Timestamptz(6)` | yes | |
| 11 | 2727 | `consecutive_completion_streak` | `Int @default(0)` | no | |
| 12 | 2728 | `consecutive_miss_streak` | `Int @default(0)` | no | |
| 13 | 2729 | `ideal_time_label` | `String? @db.VarChar(50)` | yes | "morning", "EOD" |
| 14 | 2730 | `fail_threshold_minutes` | `Int @default(0)` | no | grace period |
| 15 | 2731 | `start_date` | `DateTime? @db.Date` | yes | cadence bound |
| 16 | 2732 | `end_date` | `DateTime? @db.Date` | yes | cadence bound |
| 17 | 2733 | `start_time` | `DateTime? @db.Time(6)` | yes | intent-window |
| 18 | 2734 | `end_time` | `DateTime? @db.Time(6)` | yes | intent-window |
| 19 | 2735 | `is_active` | `Boolean @default(true)` | no | |
| 20 | 2736 | `created_at` | `DateTime @default(now()) @db.Timestamptz(6)` | no | |
| 21 | 2737 | `updated_at` | `DateTime @updatedAt @db.Timestamptz(6)` | no | |
| 22 | 2738 | `created_by` | `String?` | yes | actor email |

Relations + indexes (`:2740-2748`):
- `completions  operations_routine_completions[]`
- `steps        operations_routine_steps[]`
- `content_scene operations_content_scenes?` ← **content link ALREADY EXISTS as a 0..1 relation**
- `@@unique([user_id, name])`
- `@@index([user_id, is_active, next_due_at])`
- `@@index([user_id, entity_id])` ← entity_id is indexed (proves it's a first-class field)
- `@@index([next_due_at])`

**`operations_routine_steps` (`:2751-2774`):**
- `id` uuid PK, `routine_id` uuid FK→routines (Cascade), `user_id`, `entity_id` (carries entity at step level too, line 2755), `step_order Int @default(0)`, `time_of_day DateTime? @db.Time(6)`, `activity VarChar(200)`, `sub_activity VarChar(200)?`, `location VarChar(200)?`, `duration_minutes Int?`, `notes Text?`, audit cols, `content_take operations_content_takes?` relation.

**`operations_routine_completions` (`:2776-2791`):**
- `id` uuid PK, `routine_id` uuid FK→routines (Cascade), `user_id`, `expected_at` Timestamptz, `completed_at` Timestamptz default now, `delta_minutes Int`, `notes Text?`, `created_at`.
- `@@unique([routine_id, expected_at])` — one completion per scheduled instant.

**Present/absent per target field (with line cite):**

- `entity_id` (FK to entities) — **PRESENT** at line 2719 (`String`, NOT NULL). Indexed at 2746. **The model doc claim was correct — the schema confirms it.** No FK @relation decorator is defined to entities at the routine level (matches the project/task pattern where the FK is by column-name convention, not Prisma relation), but the column itself is fully shipped.
- `expected_cost_usd` (or any cost) — **ABSENT.** No `*_cost*`, `*_amount*`, `*_price*`, or `*_usd*` column on the model.
- `coa_code` (or any COA/category) — **ABSENT.** No `coa_*` or `account_*` column.
- `recurrence_type` (enum) — **ABSENT.** No type/mode/category column.
- `links_to_content` (flag) — **ABSENT as a Boolean,** but the **relation `content_scene operations_content_scenes?`** at line 2742 already provides "this routine has a scene" / "this routine has no scene" — i.e., presence-as-flag. Per the scenify flow (PR-Ops-4.9.3 series), `content_scene` is unique per routine.
- `links_to_meals` (flag) — **ABSENT,** AND there is no `meals` model to link to. The only `meals` reference in the schema is a Json field on a daily-log row at `:1777` — no relational target exists.
- The known-existing time/cadence fields — **CONFIRMED present:** `start_time` (2733), `end_time` (2734), `start_date` (2731), `end_date` (2732), `schedule_rrule` (2722), `timezone` (2723), `is_active` (2735).

B. GAP TABLE

| Target field | Type recommended | Present now? | Line | Gap? |
|---|---|---|---|---|
| `entity_id` | `String` (NOT NULL) — FK→entities by convention | **YES** | 2719 | **NO** |
| `estimated_cost_usd` | `Decimal? @db.Decimal(15,2)` | NO | — | YES |
| `actual_cost_usd` | `Decimal? @db.Decimal(15,2)` | NO | — | YES *(maybe — see E)* |
| `coa_code` | `String? @db.VarChar(50)` (no DB FK) | NO | — | YES |
| `recurrence_type` | enum (`indefinite`/`recurring_until`/`once`) | NO | — | **NO — DERIVABLE** |
| `links_to_content` | `Boolean` | NO | — | **NO — RELATION ALREADY EXPRESSES THIS** |
| `links_to_meals` | `Boolean` | NO | — | NO — no `meals` model to relate to |
| `routine_project_allocations` | join table | NO | — | YES (deferred, future PR per spec) |

**recurrence_type — redundant or needed?**

**REDUNDANT. Recommend: do NOT add.** The three target states are fully derivable from the trio of (`schedule_rrule`, `start_date`, `end_date`) that the model already carries:

| derived state | how it's expressed today |
|---|---|
| `once` (one-shot) | `schedule_rrule` containing `COUNT=1` (or a rrule with no FREQ + a single DTSTART) — already supported by the rrule library, already expandable by `expandBetween` |
| `recurring_until` (bounded) | `end_date` set (`:2732`) |
| `indefinite` (forever) | `end_date` NULL — the existing default for daily/weekly routines |

Adding a `recurrence_type` enum would create two sources of truth (the enum + the rrule/end_date) that could drift. The display layer can derive a label via a one-line helper: `if (end_date) return 'until ' + end_date; if (schedule_rrule.includes('COUNT=1')) return 'once'; return 'indefinite'`. Constitutional rule: don't add a field that duplicates existing data.

C. ENTITIES + TASK COST PATTERN

**`entities` model (`prisma/schema.prisma:66-93`):**
- `id` String PK (uuid), `userId`, `name VarChar(100)`, `entity_type VarChar(20)`, `is_default Boolean`, `state_of_formation`, `ein`, `fiscal_year_start`, `naics_code`, audit cols.
- Relations: links into `users`, `chart_of_accounts`, `journal_entries`, `merchant_coa_mappings`, `transactions`, `investment_transactions`, `budgets`, `closing_periods`, `accounts`, `bank_reconciliations` (`:80-89`).
- `@@unique([userId, name])` (`:91`), `@@index([userId, is_default])` (`:92`).
- The 3-4 specific entities (Personal / Business / Trading / Travel) are **DATA, not schema** — they live as rows in this generic table, keyed by `userId, name`. Schema only defines the shape; can't confirm/deny their existence from the schema alone (the prompt's memory line about specific UUIDs is data-layer assertion).

**How operations_projects / operations_project_tasks carry entity:**
- `operations_projects.entity_id String` (NOT NULL) at line 2562; index `[user_id, entity_id, status]` at :2589.
- `operations_project_tasks.entity_id String` (NOT NULL) at line 2600; index `[entity_id]` at :2630.
- `operations_daily_plan_items.entity_id String` (NOT NULL) at line 2638; index `[entity_id]` at :2654.
- **Pattern: every Operations model carries `entity_id String` (NOT NULL, no Prisma @relation decorator) + an index on entity_id, and the API derives/validates the entity at write-time.** `operations_routines` already follows this exact pattern at lines 2719 + 2746. **No mirroring needed — routines already match.**

**Task cost/COA fields — EXACT names + types (mirror these for routines):**

From `operations_project_tasks` (`:2596-2632`):
- `estimated_cost_usd  Decimal?  @db.Decimal(15, 2)` at line 2605
- `coa_code            String?   @db.VarChar(50)` at line 2614
- `actual_cost_usd     Decimal?  @db.Decimal(15, 2)` at line 2615
- `actual_minutes      Int?` at line 2616
- `estimated_minutes   Int?` at line 2604
- Index on `[coa_code]` at line 2631.

**No DB-level FK from `coa_code` to `chart_of_accounts.code`** — confirmed by reading `chart_of_accounts` (`:147-174`): its uniqueness key is `@@unique([userId, entity_id, code])` (line 171), so `code` alone is not unique. The task API (per prior PR-5.1.6/5.1.7 audits) validates COA existence at write-time against `(user_id, entity_id, code)` rather than relying on a DB FK. **Routines should mirror this exact pattern** — bare `String? @db.VarChar(50)` + API-layer validation against the routine's entity_id.

For the routine "expected" cost notion, the closest mirror is `estimated_cost_usd` (matches `estimated_minutes`/`estimated_cost_usd` semantics on tasks). Spec says "expected_cost_usd" — recommend renaming to **`estimated_cost_usd`** for naming consistency with tasks/projects (every other Operations model uses `estimated_*` for the planning value, `actual_*` for the post-hoc value).

D. CREATION FORM (where capture happens in the UI)

**File:** `src/components/workbench/operations/routines/RoutineList.tsx` (the inline create form + the `/operations/routines` page entry).

**Fields the create form currently collects (`:210-300`):**
- `name` text (`:222-229`)
- `description` textarea (`:233-239`)
- `entity_id` select dropdown — populated from `entities` prop (`:241-255`) — **ENTITY SELECTOR ALREADY EXISTS HERE.**
- Cadence via `<RRULEBuilder form={createForm} setForm={setCreateForm} />` (`:258`) — RRULEBuilder is the structured-cadence component at `src/components/workbench/operations/routines/RRULEBuilder.tsx` (217 lines).
- `start_date`, `end_date` (date inputs, `:262-278`)
- `start_time`, `end_time` (time inputs, `:283-299`)
- Plus from RRULEBuilder: cadence_mode, weekly_byday, monthly_day_of_month, monthly_nth, monthly_weekday, custom_rrule, byhour, byminute, fail_threshold_minutes, timezone, ideal_time_label.

**Where new fields slot (just mapping locations, not designing the look):**
- `coa_code` dropdown — slots inside the existing 2-col `grid grid-cols-2 gap-3` block at `:219-256` (alongside `entity` and `name`). Best placement: right after `entity` (`:241-255`) since the COA list is entity-scoped — selecting an entity is the prerequisite for the COA list to populate.
- `estimated_cost_usd` number input — same 2-col grid; pair it with the existing `fail_threshold_minutes` row inside RRULEBuilder, or add a new `expected cost (USD)` field above the start/end dates block at `:260`.
- `actual_cost_usd` — does NOT belong on the create form (post-hoc value; should only appear in the EDIT form / RoutineRow's expanded body).
- Links flags — N/A for content (use the existing scenify button which creates the `content_scene` relation); N/A for meals (no meals model exists).

**Reusable COA dropdown pattern — YES, lives in `TaskList.tsx`:**
- `coaAccounts` state + `coaFetchedForEntityId` cache at `TaskList.tsx:40-41`.
- Fetch effect at `:81-116`: `fetch('/api/chart-of-accounts?entity_id=' + encodeURIComponent(entity_id))`, maps response, caches per-entity, handles cancellation.
- The select element at `:252-258`: `value={createForm.coa_code}`, populated from `coaAccounts.map((a) => ...)`.
- The "stale code" handling at `TaskRow.tsx:602-604`: if `form.coa_code` doesn't match any current account, surface a `⚠ (not in current COA)` option so the value isn't silently dropped.
- **All of this is portable to RoutineList.** Lift to a shared hook `useCoaAccountsForEntity(entity_id)` OR duplicate the ~30 lines into RoutineList (mirroring the existing pattern; lift only if a third caller appears — YAGNI per project convention).

**Entity selector pattern — already on RoutineList at `:241-255`.** No new work needed.

E. MIGRATION RECOMMENDATION

**Fields to ADD to `operations_routines`:**

| field | Prisma type | rationale |
|---|---|---|
| `estimated_cost_usd` | `Decimal? @db.Decimal(15, 2)` | mirrors `operations_project_tasks.estimated_cost_usd` (`:2605`) exactly |
| `coa_code` | `String? @db.VarChar(50)` | mirrors `operations_project_tasks.coa_code` (`:2614`) exactly; API validates against `(user_id, entity_id, code)` like tasks do |
| `actual_cost_usd` | `Decimal? @db.Decimal(15, 2)` | mirrors `operations_project_tasks.actual_cost_usd` (`:2615`); post-hoc value, captured on the completion edit — see open decision below |

**Fields NOT to add (and why):**
- `entity_id` — already exists (`:2719`).
- `recurrence_type` — redundant; derivable from `schedule_rrule` + `end_date`. Add a UI-side label helper instead.
- `links_to_content` — `content_scene` relation already encodes this presence.
- `links_to_meals` — no `meals` model to link to.

**Open question — actual_cost_usd: on the routine OR on the completion?**

Tasks store both `estimated_cost_usd` and `actual_cost_usd` on the SAME ROW because a task is a one-shot — there's one "actual" value to record. A routine is RECURRING — every occurrence could have its own actual cost (the routine costs $X per occurrence, but this Tuesday it was $X+5). Two options:

- (i) `actual_cost_usd` on `operations_routines` (single value, treated as "typical actual"). Simple, mirrors tasks.
- (ii) `actual_cost_usd` on `operations_routine_completions` (per-occurrence). Truer to the recurring nature; lets cost-history graph over time.
- **Recommend (ii) — per-occurrence on `operations_routine_completions`.** A routine's "actual" cost varies by instance (gym membership is fixed; coffee run varies). Putting it on completions matches reality and parallels how `delta_minutes` already lives on completions (`:2782`), not on the routine.
- For Phase 2 essentials-first: add `estimated_cost_usd` + `coa_code` to `operations_routines` NOW; add `actual_cost_usd` to `operations_routine_completions` LATER when the completion-edit UI is built. Keeps this PR scoped to "what the routine itself captures" — the completion model is its own thing.

**Recurrence_type verdict: do NOT add.** Add a `formatRecurrenceLabel(routine)` helper in `src/lib/operations/routineDisplay.ts` (new file or extend existing) that returns "indefinite" / "until YYYY-MM-DD" / "once". Centralizes the derivation so display layers stay consistent without DB drift.

**entity_id approach: NO CHANGE NEEDED.** Already shipped at `:2719`, indexed at `:2746`, collected by the create form at `RoutineList.tsx:241-255`, threaded through `RoutineForm.entity_id` to the POST body. The model doc claim verified.

**Migration described (DESCRIBE, don't run — Alex executes via psql):**

```sql
-- migrations/PR-Ops-5.13-routine-cost-coa.sql
-- Additive only. All new columns nullable. No data loss.
ALTER TABLE operations_routines
  ADD COLUMN estimated_cost_usd numeric(15, 2),
  ADD COLUMN coa_code varchar(50);

-- Index coa_code for entity-scoped COA lookups (mirrors tasks @:2631).
CREATE INDEX operations_routines_coa_code_idx
  ON operations_routines (coa_code);
```

Parallel `prisma/schema.prisma` edit (between line 2734 and 2735, alongside other nullable optional columns):
```prisma
  estimated_cost_usd  Decimal?  @db.Decimal(15, 2)
  coa_code            String?   @db.VarChar(50)
```
Plus a new index in the `@@index` block:
```prisma
  @@index([coa_code])
```

Regenerate the Prisma client:
```
npx prisma generate
```

**Full-set vs essentials-first: ESSENTIALS-FIRST.**
- This PR: `estimated_cost_usd` + `coa_code` on routines. Two columns, one ALTER, one index.
- Defer: `actual_cost_usd` placement (needs the open-decision call above), `routine_project_allocations` join table (per spec), per-occurrence completion-edit UI.
- Reasoning: 2 new columns is a clean, easy-to-review delta. Mixing in the completion-model question or the join table risks scope creep and a multi-table migration. Land the capture-essentials, then layer in `actual_cost_usd` + allocations as separate PRs.

**Additive / no data loss: CONFIRMED.**
- Both new columns are nullable — no backfill required, no constraint violations on existing rows.
- Alex cleared all routines (per prompt context) — even the worst case is zero rows affected.
- Reversible via `ALTER TABLE operations_routines DROP COLUMN estimated_cost_usd, DROP COLUMN coa_code;` if the schema needs to be backed out.

**Scope + files (estimated for Phase 2):**
1. `migrations/PR-Ops-5.13-routine-cost-coa.sql` (new) — the ALTER above. ~5 lines.
2. `prisma/schema.prisma` (modify) — add the 2 columns + 1 index. ~3 lines added in the `operations_routines` model.
3. `src/components/workbench/operations/routines/types.ts` (modify) — extend `RoutineForm` + the routine response type with `estimated_cost_usd: string | ''` (string-in-form / nullable in API) and `coa_code: string | ''`. ~4 lines.
4. `src/components/workbench/operations/routines/RoutineList.tsx` (modify) — add COA dropdown + cost input to the create form. ~40 lines (mirroring TaskList's COA fetch pattern).
5. `src/components/workbench/operations/routines/RoutineRow.tsx` (modify) — add the same fields to the inline edit form + render them in the read view. ~30 lines.
6. `src/app/api/operations/routines/route.ts` (modify) — POST validates + persists `estimated_cost_usd` (numeric ≥ 0 or null) and `coa_code` (string ≤ 50 chars, optional existence-check against `(user_id, entity_id, code)` mirroring tasks). ~20 lines.
7. `src/app/api/operations/routines/[id]/route.ts` (modify) — PATCH adds the two fields to the allowlist with the same validation. ~15 lines.
- **Total: 2 schema files + 5 source files modified, 1 migration SQL created. ~115 lines net added.**

**Open decisions for Alex:**
1. **`expected_cost_usd` vs `estimated_cost_usd` naming?** Recommend `estimated_cost_usd` to match `operations_project_tasks.estimated_cost_usd` (`:2605`) and `operations_projects.estimated_total_cost_usd` (`:2574`). Cross-model consistency > matching the spec's preliminary noun.
2. **`actual_cost_usd` placement:** on `operations_routines` (mirrors tasks, single value) or on `operations_routine_completions` (per-occurrence)? Recommend on completions — see Section E rationale.
3. **COA existence validation at write-time:** strict (reject unknown codes) or lenient (allow any string, surface ⚠ in UI for stale codes)? Recommend strict for POST/PATCH (mirror tasks per PR-5.1.7), with the same `⚠ (not in current COA)` graceful-degrade for already-saved values whose entity changed COA.
4. **Audit-trail discrimination for the new fields:** include `estimated_cost_usd` / `coa_code` in the existing `operations_routine_updated` audit `payload.after`? Recommend YES — same idiom as task PATCH audits.
5. **Skip the new fields on the EDIT form for legacy routines (none exist right now) and require them on CREATE?** Recommend BOTH OPTIONAL — they're nullable in the DB, the create form leaves them blank-by-default, edit form can fill them in later. Forcing required-on-create would block fast routine creation.
6. **Should routine_steps also carry `coa_code` / `estimated_cost_usd` (so per-step cost rollups can compute the routine's expected total)?** OUT OF SCOPE for this PR — defer. Step-level cost is allocations territory (the routine_project_allocations table mentioned in spec). One concept per PR.
7. **The links_to_content / links_to_meals capture in the spec:** content presence is already encoded via the `content_scene` relation; meals has no model to link to. Recommend **explicitly drop** these from the capture set for now. If meals capture becomes a need, design a `food_log` or `meals` model first as its own PR — don't add a flag that points nowhere.
8. **Single migration file or split across two PRs?** Recommend single migration here (just 2 ALTER COLUMN ADDs) — both fields belong to the same conceptual unit ("the routine's planned spend + its accounting category"). Splitting adds churn without isolation benefit.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.13-phase-1.md.
