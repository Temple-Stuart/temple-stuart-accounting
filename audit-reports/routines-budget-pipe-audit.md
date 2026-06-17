# Routines pipe migration + routine budget/COA fields (HB-4 scoping, READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** "the old app" = the standalone **`/operations/routines`** workbench
(`src/app/operations/routines/page.tsx`) where routines are really created/listed/edited
(`workbench/operations/routines/*` + `/api/operations/routines`). The homepage **Routines tab is a
bare placeholder** (`ModuleLauncher.tsx:279-287` — "The routine builder lands here next") — but
routines **already feed the homepage calendar** via `/api/hub/operations-routines` + `expandBetween`.
So "migrate the pipe" = mount the real **create/manage** surface on the homepage tab (the feed pipe
is already connected). For budgets: `operations_routines` has **no budget/cost/coa field** (confirmed),
the per-occurrence amount + COA belong on the **routine template** (cleanest), the COA picker +
cadence math + budget routes are all **REUSABLE**, and the only true migration is **two additive
nullable columns** on `operations_routines`. `hub_scheduled_items` has the canonical fields
(`budget_usd`/`coa_code`/`routine_id`) but is wired to **nothing** — materializing through it is a
LARGE lift deferred.

---

## 1. WHAT IS "THE OLD APP" / THE ROUTINES PIPE

**Two routine surfaces exist:**
- **The workbench (the "old app")** — `src/app/operations/routines/page.tsx` (a full route page),
  rendered from `workbench/operations/routines/*`: `RoutineList.tsx` (self-fetches `GET
  /api/operations/routines` on mount, `RoutineList.tsx:51`), `RoutineCreateForm.tsx` (211 lines,
  **real POST** to `/api/operations/routines`, `:68-69`), `RRULEBuilder.tsx`, `RoutineStepList.tsx`,
  `RoutineRow.tsx`. This is the live create/list/edit surface. — EXISTS.
- **The homepage** — `ModuleLauncher.tsx`. Its Routines tab is a **placeholder card**
  (`:279-287`): *"Build recurring routines… The routine builder lands here next."* There is a
  **`home/RoutineCreateForm.tsx`** (175 lines) but it is a **logged-out teaser** — "create routine"
  calls `onRequireAuth()` and returns, **no fetch anywhere** (`:46-50`, comment `:3-16`). It is not
  mounted in the tab yet (the tab renders the placeholder, not the form). — MISSING (real homepage
  create/manage).

**Not a separate codebase** — both surfaces are in this repo and share the same backend
(`/api/operations/routines` + `operations_routines`). "Migrate the pipe" concretely = **bring the
workbench create/list flow onto the homepage Routines tab** (authed), the way Travel/Trading were
extracted (the teaser `home/RoutineCreateForm` was step one of that, never finished). — the gap.

## 2. THE ROUTINES PIPE — end to end

- **Create:** `POST /api/operations/routines` (`route.ts:112`) accepts `name`, `entity_id`,
  `timezone`, `start_date`/`end_date`, `start_time`/`end_time`, `schedule_rrule` (compiled from the
  form via `compileFormToRRule`, `:202`), `fail_threshold_minutes`, `description`,
  `ideal_time_label` — and writes `operations_routines.create` (`:249-256`). **No budget/coa/amount
  accepted or stored.** — EXISTS (create), MISSING (money).
- **Generate occurrences → calendar:** `/api/hub/operations-routines/route.ts` loads the user's
  routines (`:104`), expands each `schedule_rrule` into occurrences with **`expandBetween(rrule,
  tz, from, windowEnd)`** (`:147`, helper `rruleHelpers.ts:161`), bounded by `end_date`
  (`:155`). → `mapOperationsRoutines` → `HubCalendar` renders them. **This pipe is already wired to
  the homepage calendar.** — EXISTS / REUSABLE.
- **What "migrate the pipe" means:** NOT the calendar feed (connected) — it's the **authoring**
  surface. The homepage can already SHOW routines on the calendar; it cannot CREATE/EDIT them
  (placeholder tab). — MISSING.

## 3. ROUTINE SCHEMA — no money today

`operations_routines` (`prisma/schema.prisma:2884-2918`): `id, user_id, entity_id, name,
description, schedule_rrule, timezone, next_due_at, last_evaluated_at, last_completed_at,
consecutive_completion_streak, consecutive_miss_streak, ideal_time_label, fail_threshold_minutes,
start_date, end_date, start_time, end_time, is_active`. Relations: `completions, steps,
content_scene_group, **hub_scheduled_items**` (`:2911` — the routine→hub link EXISTS).
**No `budget`/`cost`/`amount`/`coa_code` column** (grep over `:2884-2918` empty). — MISSING.

**Minimal addition (recommended): two columns on the TEMPLATE** —
`coa_code VARCHAR(20)?` + a **per-occurrence** amount (e.g. `budget_amount` Int cents, or
`Decimal(12,2)`), both nullable. Reasoning in (b). — MISSING (migration).

## 4. COA PICKER — data source + reusable component

- **Data source:** **`/api/chart-of-accounts`** (`route.ts:28`) returns `{ accounts: [{ code, name,
  …, entity_id, entity_type }] }`, filterable by **`?entity_id=`** (`:26-32`). The picker scopes to
  the routine's entity. — REUSABLE.
- **`chart_of_accounts`** (`schema.prisma:147-174`): `code VARCHAR(50)`, `name VARCHAR(255)`,
  `entity_id` (required), `@@unique([userId, entity_id, code])`. So a code is unique **per entity**
  — the picker must pass the routine's `entity_id` (the same join caveat the budget audit flagged).
- **Reusable picker component:** the **project-task COA `<select>`** in
  `workbench/operations/projects/TaskRowView.tsx:473-478` — `value={form.coa_code}`, options mapped
  from a `coaAccounts: CoaAccountSummary[]` prop (`:53`; type at `projects/types.ts:189`), with a
  "— None —" option and a "code not found" guard (`:353-370`). `operations_project_tasks` already
  carries `coa_code` with exactly this picker → a routine `coa_code` picker is a **direct mirror**.
  — REUSABLE.
- Also `travelCOA.ts:listTravelCOAAccounts()`/`coaCodeToLabel` exist, but those are the
  **travel** registry (9xxx); Personal/Business routines should use the real per-entity
  `/api/chart-of-accounts` like project tasks do. — EXISTS-BUT (travel-specific).

**Picking a COA on a routine requires:** the `coa_code` column (§3) + the TaskRowView-style select
fed by `/api/chart-of-accounts?entity_id=`.

## 5. BUDGET → HOMEPAGE BRIDGE — the asymmetry to solve

The three homepage budget routes read **different** planned sources (the budget audit's key
finding, re-confirmed):
- **Personal** (`year-calendar`): `prisma.budgets.findMany` — the flat **`budgets`** table
  (`:69`), NOT `budget_line_items`.
- **Business** (`business-budget`): `budget_line_items WHERE source='business'` (`:68-72`).
- **Travel** (`nomad-budget`): `budget_line_items WHERE source='trip'`.

So a routine's monthly figure reaching the homepage table must either:
- **(path α) become `budget_line_items source='recurring'`** (enum value EXISTS at
  `schema.prisma:1061`, **nothing writes it** — MISSING) AND each budget route's filter must
  **include 'recurring'**: Business → `source IN ('business','recurring')`; Travel similar; **Personal
  → year-calendar must additionally aggregate `budget_line_items('recurring')`** (today it reads
  only `budgets`). — RISK: the Personal route's `budgets`-only read is the gap.
- **(path β) be aggregated on-read from the routine template** — each budget route (or a shared
  helper) computes the routine's monthly figure via cadence math (§7) grouped by `coa_code`/month,
  merged into `budgetData`. No new write table, but each route learns a routine read path.
- **(path γ) flow through `hub_scheduled_items`** — `budget_usd` + `coa_code` + `routine_id` +
  `cadence` + `entity_id` all EXIST (`schema.prisma:2980-2994`), but the table has **no writer and
  no reader** (EXISTS-BUT-UNUSED, per the event-editor + budget audits) → would need an occurrence
  generator (writer) + every budget route repointed (readers). LARGE.

**Map (recommended, path β with template fields):** routine (`budget_amount` per-occurrence +
`coa_code`, §3) → a shared `routineMonthlyByCoa(routine, year, month)` helper (cadence math, §7) →
merged into `budgetData[coa][month]` inside `year-calendar` (Personal) + `business-budget`
(Business) → the HB-1 homepage table. No row materialization; routines stay templates.

## 6. MIGRATION SHAPE — options, all non-destructive

| Option | Migration | Cleanliness | Data migrated | Lift |
|---|---|---|---|---|
| **A. Template columns** (recommend) | `ALTER operations_routines ADD COLUMN budget_amount …, ADD COLUMN coa_code VARCHAR(20)` — **additive nullable** | Cleanest: budget is a property of the routine; no row explosion | none (old routines stay null) | **SMALL** migration + read-path |
| B. `hub_scheduled_items` materialize | none (cols exist) | "Right" canonical long-term BUT table is wired to nothing | none, but must generate occurrence rows | **LARGE** (writer + all readers) |
| C. `budget_line_items source='recurring'` | none on routines, but **still needs A's per-occurrence amount somewhere** to edit | budget routes already read line_items (Business/Travel) | a sync job writes monthly rows | **MED** + a sync, + Personal route still reads `budgets` |

**No option is destructive.** A is the foundation (the per-occurrence amount + COA must live
*somewhere* editable → the template). B/C are downstream materialization choices that still need A.
**Flag:** never drop `budgets` or any line-items; additive only. — recommend **A**, defer B.

## 7. CADENCE → MONTHLY AMOUNT — reusable math

A budgeted routine is **$X per occurrence**; the monthly budget figure = **(occurrences that
month) × X**. The occurrence count is already computable with the shipped helper
**`expandBetween(rrule, timezone, from, to)`** (`rruleHelpers.ts:161`) — the SAME function the
calendar feed uses (`hub/operations-routines/route.ts:147`):
```
monthlyAmount(routine, year, month) =
  expandBetween(routine.schedule_rrule, routine.timezone, monthStart, monthEndExclusive).length
  × perOccurrenceAmount
```
So "daily $15 coffee" in a 30-day month → `30 × 15 = $450`; "weekly $40" → ~`4 × 40 = $160`. The
cadence/RRULE math is **REUSABLE as-is** — no new recurrence engine. (`compileFormToRRule:26`,
`classifyCadence:82`, `expandForward:143`, `expandBetween:161` all exist.) — REUSABLE,
`rruleHelpers.ts`.

---

## Explicit answers

**(a) "Old app" / routines pipe + what's missing on the homepage.** The old app = the
`/operations/routines` workbench (`app/operations/routines/page.tsx` + `workbench/operations/
routines/*` + `/api/operations/routines`), the live create/list/edit surface. The homepage
Routines tab is a **placeholder** (`ModuleLauncher.tsx:279-287`); the real create flow is **not
mounted** there (only a fetch-free logged-out teaser exists, `home/RoutineCreateForm.tsx:46-50`).
The calendar **feed** pipe (`/api/hub/operations-routines` + `expandBetween`) is already connected.
**Missing = the homepage authoring surface.**

**(b) Where budget+COA should live — the TEMPLATE (`operations_routines`).** A routine is a
template; its budget ($X/occurrence) and COA are properties of the template, not of each generated
occurrence. Putting them on the template (one row) avoids materializing N `hub_scheduled_items`
rows per routine, keeps a single editable source, and lets the monthly figure be **computed**
on-read via `expandBetween` (§7). `hub_scheduled_items.budget_usd` is the right *canonical*
materialized store eventually, but it's wired to nothing today — defer. **Recommend: `budget_amount`
(per-occurrence) + `coa_code` on `operations_routines`.**

**(c) COA picker.** Data: `/api/chart-of-accounts?entity_id=<routine entity>` →
`{accounts:[{code,name}]}` (`route.ts:28-56`). Component: mirror the project-task select
`TaskRowView.tsx:473-478` (`CoaAccountSummary[]`, "— None —", code-not-found guard) — a direct
reuse, since `operations_project_tasks.coa_code` already uses it.

**(d) The bridge (exact path).** routine (`budget_amount`+`coa_code`) → `routineMonthlyByCoa()`
helper (`expandBetween` occurrence count × per-occurrence amount, grouped by `coa_code`/month) →
merged into `budgetData[coa][month]` inside **`year-calendar`** (Personal) and **`business-budget`**
(Business) → the HB-1 `HubBudgetSection` table. (Alternative: write `budget_line_items
source='recurring'` and widen each route's `source` filter — but Personal's `year-calendar` reads
the `budgets` table, so it needs the routine aggregation regardless.)

**(e) Cadence→monthly math.** `monthly = expandBetween(rrule, tz, monthStart, monthEnd).length ×
perOccurrenceAmount` — reuse `rruleHelpers.expandBetween` (`:161`), the same helper the calendar
feed already uses. No new recurrence code.

**(f) Migrations — one, additive, non-destructive.** `ALTER TABLE operations_routines ADD COLUMN
budget_amount … (nullable), ADD COLUMN coa_code VARCHAR(20) (nullable)`. Old routines stay null
(no money until set). No drops, no NOT NULL, no data migration. (Options B/C add no routine column
but are larger downstream and still need this editable amount.)

**(g) Recommended ATOMIC PR SEQUENCE for HB-4.**
1. **HB-4a — schema + API accept (SMALL, MIGRATION).** `ALTER operations_routines ADD budget_amount
   + coa_code` (additive nullable, Alex-run psql + `schema.prisma` + `npx prisma generate`); extend
   the `POST`/`PATCH` `/api/operations/routines` routes to accept+validate them (validate `coa_code`
   against the entity's chart_of_accounts, like the COA picker). No render change.
2. **HB-4b — routine form: COA picker + budget input (SMALL-MED, no migration).** Add the
   TaskRowView-style `<select>` (fed by `/api/chart-of-accounts?entity_id=`) + a per-occurrence
   amount field to the routine create/edit form. Reuse `CoaAccountSummary`.
3. **HB-4c — cadence→monthly helper (SMALL, no migration).** `routineMonthlyByCoa(routine, year,
   month)` wrapping `expandBetween` — pure function, unit-testable, reused by the budget routes.
4. **HB-4d — bridge into the budget routes (MED, no migration).** In `year-calendar` (Personal) +
   `business-budget` (Business), aggregate budgeted routines (HB-4c) into `budgetData` by
   `coa_code`/month, merged with the existing planned source. (Decision gate: aggregate-on-read vs
   write `budget_line_items source='recurring'` — recommend on-read first, no new write table.)
5. **HB-4e — migrate the authoring pipe to the homepage (MED, no migration; parallel-able).** Mount
   the real routine create/list (the workbench flow) on the homepage Routines tab for authed users,
   replacing the placeholder (`ModuleLauncher.tsx:279-287`) — the "migrate the pipe" deliverable,
   mirroring the Travel/Trading extraction the teaser `home/RoutineCreateForm` began.
6. **(Later, optional) HB-4f — `hub_scheduled_items` materialization (LARGE, no migration).** If
   per-occurrence drill-in / actuals reconciliation is wanted, wire the routine→`hub_scheduled_items`
   generator (`budget_usd`/`routine_id` exist) + repoint readers. Defer until A–E prove out.

### Citation index
- Surfaces: `app/operations/routines/page.tsx`; `workbench/operations/routines/RoutineCreateForm.tsx:68`,
  `RoutineList.tsx:51`; `home/RoutineCreateForm.tsx:46-50`; `ModuleLauncher.tsx:279-287`.
- Pipe: `api/operations/routines/route.ts:112-256`; `api/hub/operations-routines/route.ts:104,147,155`;
  `rruleHelpers.ts:26,82,143,161`.
- Schema (no money): `operations_routines :2884-2918` (`hub_scheduled_items` rel `:2911`);
  `hub_scheduled_items.budget_usd/coa_code/routine_id :2980-2994` (unwired); `budget_line_items
  source enum :1061`.
- COA picker: `api/chart-of-accounts/route.ts:26-56`; `chart_of_accounts :147-174`;
  `TaskRowView.tsx:473-478`; `projects/types.ts:189`.
- Budget route sources: `year-calendar:69` (budgets table), `business-budget:68-72` (line_items
  source='business'), `nomad-budget` (source='trip').

*Do not implement — audit only.*
