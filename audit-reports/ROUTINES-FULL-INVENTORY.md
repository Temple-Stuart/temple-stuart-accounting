# ROUTINES-FULL-INVENTORY — read-only audit

**Date:** 2026-07-15 · **Branch:** `claude/routines-full-inventory` · **Mode:** READ-ONLY (no code changes, no design)
**Purpose:** the complete map of the real Routines tab — every section an authed user sees, the causal flow,
the cross-module feeds, per-section mountability, the teaser-reuse ruling, and the cross-deck example ruling —
grounding for the ROUTINES-SHOWCASE deck (Bloomberg template, proven ×6).

Every claim below was verified by reading the cited file at the cited line on `main`
(`5fcda63a`, post-Runway-deck merge).

---

## 0. Entry points

| Surface | Cite |
|---|---|
| Authed Routines tab → `<OperationsEntityProvider><SectionE_Routines/></OperationsEntityProvider>` | `ModuleLauncher.tsx:520-525` |
| Logged-out Routines tab → `<HomeRoutineCreateForm onRequireAuth/>` (the interactive teaser) | `ModuleLauncher.tsx:527-529`, import `:71` → `src/components/home/RoutineCreateForm.tsx` |
| Tab entry `{ key: 'routines', label: 'Routines', icon: Repeat }` | `ModuleLauncher.tsx:121` |
| Tab descriptor (verbatim): *"Build your recurring routines and watch them land on your calendar — the rhythms that run your day."* | `ModuleLauncher.tsx:150` |
| Module blurb (verbatim): *"Recurring routines that land on your calendar."* | `ModuleLauncher.tsx:104` |
| Auth resolving (`authed === null`) → nothing renders | `ModuleLauncher.tsx:530` |

The same workbench section also serves `/operations` (SectionE is the one source of truth — mounted verbatim,
`ModuleLauncher.tsx:514-517`).

---

## 1. THE ROUTINE MODEL — what a routine IS

`operations_routines` (Prisma model at `prisma/schema.prisma:2960-3004`; mirrored 1:1 by the frontend
`Routine` interface, `src/components/workbench/operations/routines/types.ts:25-70`):

| Field group | Fields | Notes |
|---|---|---|
| Identity | `id, user_id, entity_id, name (≤200, @@unique [user_id, name]), description` | duplicate name → 409 *"a routine with this name already exists"* (`routines/route.ts:256-265`) |
| Recurrence | `schedule_rrule (RFC 5545 text), timezone (default America/Los_Angeles)` | RRULE is **server-compiled, never accepted as a client string** (`routines/route.ts:11-13,200-212`) |
| Server-computed state | `next_due_at, last_evaluated_at, last_completed_at` | `next_due_at` computed at create via `expandForward` (`routines/route.ts:247-254`); recomputed on cadence/timezone/threshold PATCH (`[id]/route.ts:293-301`) |
| Streaks | `consecutive_completion_streak, consecutive_miss_streak` | completion endpoint owns +1/reset (`[id]/completions/route.ts:109-117`); nightly evaluator owns the miss side (§6) |
| Intent window | `ideal_time_label, fail_threshold_minutes, start_date, end_date, start_time, end_time` | `@db.Time` serializes as `1970-01-01THH:MM…` → UI slices `(11,16)` (`types.ts:42-53`) |
| Money (HB-4a/4b) | `budget_amount Decimal(12,2)?, coa_code VarChar(50)?` | **per-occurrence** budget; both optional, absent → null, never 0 / no default account — present-but-invalid fails 400 (`routines/route.ts:229-245`) |
| Lifecycle | `is_active, created_at, updated_at, created_by` | deactivate = PATCH `is_active:false`, audited as `operations_routine_deactivated` (`[id]/route.ts:310-319`) |
| Relations | `steps[], completions[], content_scene_group?` | `content_scene_group` include = the Content link (§5); steps carry their own `content_scene?` include (`routines/route.ts:90-99`) |

**Create/edit surface** (all self-fetching workbench components under
`src/components/workbench/operations/routines/`):

- **`RoutineCreateForm.tsx`** (238 lines) — name, description, entity (required, `— select —`),
  budget/occurrence + `CoaSelect` (COA list scoped to the picked entity, self-fetches
  `/api/chart-of-accounts?entity_id=…`, `CoaSelect.tsx:37`), `RRULEBuilder`, start/end date,
  start/end time. Submit → `POST /api/operations/routines` (`RoutineCreateForm.tsx:69-78`).
- **`RoutineRow.tsx`** (463 lines) — three display modes (compact / expanded / edit,
  `RoutineRow.tsx:4-7`). Compact: name + `🔥 N ✓ / N ✗` streaks + `next: <due>` + active-window +
  intent-window chips (`:205-245`). Expanded: description, raw rrule string (monospace), timezone,
  fail threshold, last completed, last evaluated, ideal time (`:248-292`), then `RoutineStepList`
  (`:294`) and the action row edit / deactivate / delete / **ScenifyButton** (`:296-321`). Edit: full
  form incl. budget+COA, entity locked after creation (`:353-368`, `title="entity cannot be changed
  after creation"`). Delete confirms *"All completion history will also be deleted."* (`:172`) —
  hard delete, completions cascade (`[id]/route.ts:12-13,382-392`).
- **"Routines 3 patterns" (roadmap item) — NOT BUILT.** Zero hits repo-wide for any such feature. The
  only "three" is RoutineRow's three *display modes* (`RoutineRow.tsx:4`). Banned as a feature name in
  deck copy.

**Steps** (`operations_routine_steps`, editor `RoutineStepList.tsx`, 499 lines): ordered sub-steps —
`step_order, time_of_day, activity, sub_activity, location, duration_minutes, notes` (`types.ts:75-103`).
Add auto-fills `time_of_day` = routine `start_time` + 15 min × existing steps (`RoutineStepList.tsx:20,71-81`).
Reorder = paired PATCH swaps (`:199-210`); delete is a **soft-delete** (`is_active=false`) that preserves the
step's scene row + takes (`steps/[stepId]/route.ts:186-195`); each step row carries a **TakeifyButton**
(`RoutineStepList.tsx:399`). Empty state: *"no steps yet"* (`:252`).

---

## 2. RRULE MECHANICS

- **Users never type RRULE** (except the labeled escape hatch). `RRULEBuilder.tsx` (pure controlled,
  fetch-free) offers five `cadence_mode`s: daily · weekly (weekday chips) · monthly day-of-month ·
  monthly Nth-weekday (1st…4th/last × weekday) · custom raw RRULE (`RRULEBuilder.tsx:27-33`), plus
  BYHOUR/BYMINUTE, fail-threshold, timezone, ideal-time label (`:159-216`). The custom placeholder is
  itself the quarterly example: `FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15` (`:150-155`).
- **Server compiles + validates**: `compileFormToRRule` synthesizes `FREQ=…;BYDAY=…;BYHOUR=…;BYMINUTE=…;BYSECOND=0`
  and round-trips through `rrulestr` so every stored RRULE is parseable (`rruleHelpers.ts:26-69`).
- **Expansion is server-side only** — the UI never expands RRULE (`types.ts:20-23`). Two pure helpers:
  `expandForward` (next N) and `expandBetween` (window), both timezone-shifted per-occurrence so
  BYHOUR=8 means 08:00 *in the routine's zone* across DST (`rruleHelpers.ts:143-170,184-225`; sign-bug
  history documented at `:217-224`).
- **Cadence groups** for display: Daily / Weekly / Monthly / Quarterly / Yearly / Custom — quarterly
  detected as `FREQ=YEARLY` + `BYMONTH` of 4 months divisible by 3 (`rruleHelpers.ts:82-107`; client
  approximation `RoutineList.tsx:113-127`). **Quarterly/yearly are not reachable from the structured
  modes** — only via the custom escape hatch (`home RoutineCreateForm.tsx:39-42` documents the same).
- **What the user sees**: grouped list under group headers with counts (`RoutineList.tsx:190-213`);
  today's occurrences with status pills (§3); `next: <datetime>` per row; the raw rrule string in the
  expanded view (`RoutineRow.tsx:266-268`).

**Occurrence-consuming endpoints** (all `getVerifiedEmail` → 401, user-scoped, cross-user 404):

| Route | Purpose | Cite |
|---|---|---|
| `GET /api/operations/routines` | list w/ steps + content includes, `?is_active` filter | `routines/route.ts:65-110` |
| `POST /api/operations/routines` | create (validation battery, RRULE compile, audit `operations_routine_created`) | `:112-322` |
| `GET/PATCH/DELETE /api/operations/routines/[id]` | read / edit (budget+COA editable `:178-197`; audit discriminates deactivation) / hard delete | `[id]/route.ts:1-14` |
| `GET /api/operations/routines/today` | today's strip: expand per-routine today-bounds, hydrate pending/completed/missed/upcoming | `today/route.ts:89-193` |
| `POST /api/operations/routines/[id]/completions` | ✓ mark done: completion row (`@@unique [routine_id, expected_at]` → 409 on retry), `delta_minutes`, streak +1/miss-reset, `next_due_at` recompute, audit | `completions/route.ts:1-14,109-117` |
| `GET /api/operations/routines/[id]/upcoming` | next N occurrences (max 30) — **live route, ZERO UI consumers** (§8) | `upcoming/route.ts:34-95` |
| `POST/PATCH/DELETE` step routes | step CRUD (cookie-auth only, no paid calls) | `[id]/steps/route.ts`, `steps/[stepId]/route.ts` |

---

## 3. TODAY'S STRIP — the execution loop the user runs

`TodaysStrip.tsx` (mounted first in SectionE under the `today` label, `SectionE_Routines.tsx:36-41`):
self-fetches `/api/operations/routines/today` (`TodaysStrip.tsx:73`). Per entry: time (in the routine's
timezone) · name · status pill · `✓ mark done` (allowed for pending/upcoming/missed, `:148`) ·
`Δ N min` when completed (`:166-170`). Summary line: **"N done · N due · N missed"** (`:135`).

Status semantics (verbatim, `today/route.ts:14-22` + `types.ts:120-127`):
`pending` (due, within threshold) · `completed` (row exists) · `missed` (past `fail_threshold_minutes`)
· `upcoming` (later today). Routines with no occurrence today are excluded. Empty state:
*"no routines scheduled for today."* (`TodaysStrip.tsx:123-128`).

List empty state (verbatim, `RoutineList.tsx:184-187`): *"no routines yet — click "+ new routine" to
create your first one. Bridgewater's Principles operationalize through cadence; this is where you set
yours."*

---

## 4. THE CROSS-MODULE FEEDS — the deck's story

Routines is quiet infrastructure: one table, four live outbound wires.

### FEED 1 — Routines → the calendar layer
`GET /api/hub/operations-routines?from&to` is the **only** wire turning routines into dated events:
queries active routines (`operations-routines/route.ts:104-107`), expands each RRULE via `expandBetween`
(`:152`), applies start/end-date bounds (`:143-148,164-168`), guards `MAX_WINDOW_DAYS=92` /
`MAX_OCCURRENCES=500` with an explicit `truncated` flag — no silent narrowing (`:16-21,34-35,192`).
Each entry carries `routine_id, name, entity_id, timezone, start_time, end_time, occurrences[],
coa_code, budget_amount` (`:179-189`) — **the budget rides onto the tile**.
`mapOperationsRoutines.ts` emits one `CalendarEvent` per occurrence: `source:'routines'`,
`isRecurring:true`, `coaCode`/`budgetAmount` carried, `href:'/operations/routines'` (`:94-95,109-112,128-129`).
HubCalendar renders the layer teal with the 🔁 icon (`HubCalendar.tsx:76`), fetches at `:153`, merges at
`:215` (href stripped on the master view, `:210`). `/hub` page consumes identically (`app/hub/page.tsx:271-292,392-393`).

### FEED 2 — Routines → Runway budgets (the money bridge)
`routineMonthlyByCoa`: **monthly planned = expandBetween(rrule, tz, monthStart, monthEnd).length ×
budget_amount**, attributed to the routine's COA; no budget OR no COA → contributes NOTHING (null, never
a default) — `routineBudget.ts:41-60`, summed per COA by `routinesMonthlyByCoa` (`:66-77`). Exactly two
callers, and budgeted routines are the **ONLY planned source** (legacy `budgets` table no longer read):
- `/api/hub/year-calendar` (Personal entity, non-7xxx COAs): query `year-calendar/route.ts:87-96`,
  12-month loop `:104-113`, single-source declaration `:66-73`.
- `/api/hub/business-budget` (Business entity): same pattern (`business-budget/route.ts:82-91,99-100`).
Actuals come from `ledger_entries` in the same routes — plan from routines, actuals from books. This is
the wire the Runway audit verified from the other side; the Runway deck's slide 6 renders its output.

### FEED 3 — Routines → Content
Relational, not a toggle (§5). The live Content tab (`ContentPipeline`, mounted at
`app/operations/content/page.tsx:21`) fetches `/api/operations/routines` (`ContentPipeline.tsx:130-131`),
renders a click-to-select ordered routine picker as its **"1 · INPUTS"** section (`:5,414-445`), and feeds
selections into `ScenifyDraft` (`:454-455`). Persistence: one `operations_content_scene_groups` row per
routine (`routine_id @unique`, `schema.prisma:3133,3143`), one `operations_content_scenes` row per step
(`routine_step_id @unique`, `:3156,3175`); takes reach a routine only transitively (take → scene → step).
The Content day feed orders by `routine_step.time_of_day` (`useDayFeed.ts:40-57,387`).

### FEED 4 — Routines → the Daily Plan
Display-only: `SectionC_DailyPlan.tsx:90` fetches `/api/operations/routines/today` and renders a
read-only `DailyPlanRoutineRow` per entry (`:322-323`) beside plan items, today-only. **No routine↔task
data linkage exists** (the only schema construct that could join them, `hub_scheduled_items`, is unwired — §8).

### THE CAUSAL ORDER (= the slide order)
1. **Build the routine** — name · entity · per-occurrence budget + COA · cadence via the structured
   builder; the server compiles + validates the RRULE and computes `next_due_at`.
2. **Give it steps** — the ordered runbook under each routine (time-autofilled, reorderable).
3. **Occurrences generate server-side** — today's strip + next-due; the UI never does recurrence math.
4. **You execute, it keeps score** — ✓ mark done → completion row + Δ minutes + streak; miss →
   the nightly evaluator writes the miss and bumps the miss streak (§6). Success in the completions
   table; misses only in the audit log (`types.ts:10-18`).
5. **FEED: the calendar** — every occurrence lands as a teal 🔁 tile, budget + COA riding on it.
6. **FEED: the budget** — amount × occurrences per month becomes the planned column Runway showed;
   actuals stay the ledger's.
7. **FEED: content** — steps scenify into scene rows → takes → script (the Content deck's pipeline).
8. **The quiet-infrastructure close** — one definition, four systems fed; nothing re-entered.

---

## 5. THE ROUTINE↔CONTENT TOGGLE

**No boolean toggle exists** (`is_content` / `content_enabled` — zero hits repo-wide). The link is
purely relational: `content_scene_group` presence = "scenified" (`schema.prisma:2996`; included by
`routines/route.ts:98`; typed `types.ts:64-69`), `steps[].content_scene` presence = "take-ified"
(`types.ts:96-102`). RoutineList applies optimistic updates so the 🎬 badges appear without refetch
(`RoutineList.tsx:76-101`). Status: **live, relational, badge-surfaced** — describe it as "scenified
into Content", never as a settings toggle.

---

## 6. SCENIFY / TAKEIFY — what fires, what it costs, how it's gated

| | Scenify | Takeify |
|---|---|---|
| Mount in THIS tab | `RoutineRow.tsx:320` (expanded action row) → `ScenifyModal` | `RoutineStepList.tsx:399` (per step) |
| What it does | modal lists the routine's steps as editable scene rows; **`✨ AI suggest`** → `POST /api/operations/content/enrich-routine`; **`save scenes`** → plain upserts to `/api/operations/content/scene-rows` (`ScenifyModal.tsx:131,177-182,234-249`) | already-taken → static `🎬 Take` badge; else bare `POST /api/operations/content/takes` (`TakeifyButton.tsx:39-48,55-59`) |
| Anthropic? | **YES — the AI-suggest path only.** `enrichRoutineScenes` → forced tool call, model `claude-sonnet-4-6` (`lib/ai/client.ts:33`), 4000 max tokens, purpose `routine_scene_enrichment` (`enrichRoutineScenes.ts:172-196`; SDK call `recordUsage.ts:126`). Suggestions only **prefill the form — nothing auto-saves** (human gate, `ScenifyModal.tsx:11-17`) | **NO** — pure DB insert; route imports no AI, no tier gate (`takes/route.ts:16-19`) |
| Gate order (before the paid call) | `getVerifiedEmail` 401 → user 404 → **`requireTier(user.tier,'ai',user.id)` 403** → UUID 400 → ownership 404 → 0-steps 400 → paid call (`enrich-routine/route.ts:32-77`) | cookie auth + ownership + unique-per-step 409 only |
| Tier | `ai: true` **only on `pro_plus`** (`tiers.ts:57-65`); free/pro denied; admin bypass (`tiers.ts:73-78`) | none |
| Quota | **No metered quota** on enrich-routine/generate-script — binary tier gate only; cost is *recorded* per call (`operations_ai_usage` + audit, `recordUsage.ts:158-201`) but never capped | none |

Also live on the Content tab: `ScenifyDraft` (multi-routine, same two backends,
`ContentPipeline.tsx:455`) and `ScriptGenerator` (`generate-script`, Content-only — NOT reachable from
the Routines tab). The only paid call reachable from the Routines tab is Scenify's AI-suggest;
everything else in the SectionE tree is cookie-auth CRUD.

---

## 7. THE INNGEST MACHINERY — backend-only, outputs visible

- **`routine-evaluator`** (`src/inngest/functions/routine-evaluator.ts`): daily cron `15 0 * * *`,
  concurrency 1 (`:34-35`); expands each active routine over `(last_evaluated_at, now]`
  (`:66-75`), writes one `operations_routine_missed` audit row per uncompleted occurrence
  (`:103-126`), bumps `consecutive_miss_streak` / zeroes completion streak (`:141-153`), recomputes
  `next_due_at`. Idempotent by window (`:5-8`). Registered via `src/inngest/functions/index.ts` and
  served at `/api/inngest` (signature-auth, middleware-exempt).
- **UI surface: NONE.** The evaluator surfaces only through its *outputs* the tab already renders —
  the `missed` pill, `🔥 ✓/✗` streaks, `last evaluated` (`RoutineRow.tsx:284-287`). The deck may show
  those outputs; it must NOT advertise a background-automation dashboard (none exists).
- **The "Claude Code Routines" (~15/day quota) are a DIFFERENT concept**: `fireAuditRoutine.ts` /
  `routineFireBudget.ts` (cap default 10/day, `AI_ROUTINE_DAILY_CAP` env, kill-switch pattern —
  `routineFireBudget.ts:3-19`) fire the Truth-Machine **audit Routine for Projects' pipes** against
  Alex's Claude account. Zero connection to `operations_routines`; nothing in this tab's UI. The naming
  collision is a deck hazard — **banned from Routines-deck copy entirely.**

---

## 8. NOT-LIVE / BANNED LIST (zero rendered hits required in the deck)

| # | Banned | Why | Cite |
|---|---|---|---|
| 1 | "Routines 3 patterns" (roadmap phrase) | no such feature exists; nearest real thing = RoutineRow's 3 display modes | repo-wide grep, `RoutineRow.tsx:4` |
| 2 | Any "next N occurrences" preview UI | `/[id]/upcoming` is live but has **zero UI consumers** (its docstring "Used by Section E" is doc-drift) | `upcoming/route.ts:8`, component grep |
| 3 | `hub_scheduled_items` master-calendar rows | schema + migration only; **no route reads or writes it**; sole reference is a comment | `schema.prisma:3065-3109`, `EventDetailPanel.tsx:8` |
| 4 | Background-automation dashboard / "we watch your routines" UI | evaluator is backend-only; only its outputs render | §7 |
| 5 | Claude Code Routine automation (audit/exec fires, daily caps) | different subsystem (Projects pipes); naming collision | §7 |
| 6 | Scenify as free/universal | `pro_plus`-only tier gate; mirror must be inert + honestly labeled | `tiers.ts:57-65`, `enrich-routine/route.ts:42-43` |
| 7 | "Budgeted routines land in every budget view" | travel-7xxx-COA routines surface in NO budget route (year-calendar excludes 7xxx `:45-46`; nomad-budget reads no routines — 0 hits) | `year-calendar/route.ts:45-46`, nomad grep |
| 8 | `AvailableRoutinesList` / `SectionG_Content` / `ContentTable` surfaces | retired (OPS-CE-7); live path is `ContentPipeline` | `app/operations/content/page.tsx:11-16` |
| 9 | "Your guest-built routines transfer when you sign up" | no import path exists; the teaser's copy is already honest ("start saving") | `home RoutineCreateForm.tsx:265-270` |
| 10 | One-click quarterly/yearly cadence | reachable only via the custom-RRULE escape hatch | `home RoutineCreateForm.tsx:39-42`, `RRULEBuilder.tsx:140-156` |

**Disclaimers / empty states / state strings to carry verbatim:** the four status pills
(`pending/completed/missed/upcoming`), "N done · N due · N missed", "✓ mark done", "Δ N min",
"🔥 N ✓ / N ✗", "next: <datetime>", "no routines scheduled for today.", the Bridgewater empty state
(§3), "no steps yet", "entity cannot be changed after creation", the delete warning ("All completion
history will also be deleted."), 409 "a routine with this name already exists", the teaser strings
("in your browser (not saved)", "starter categories · your own chart after login", "Your workspace ·
set after login", "Built routines live in your browser only.", "These routines live in this browser
only and are not saved. Make a free account to start saving routines and watch them land on your
calendar."), and the calendar feed's `truncated` honesty flag.

---

## 9. MOUNTABILITY — the three-tier ruling per section

| Section | Ruling | Seam / fetches (cite) |
|---|---|---|
| **The logged-out teaser** (`home/RoutineCreateForm.tsx`) | **DIRECT REUSE — zero-fetch, already live** | no fetch code exists in the file (`:3-16`); guest routines are React state only (`:44-50`); submit validates locally, never POSTs (`:61-69`); conversion CTA reuses `onRequireAuth` (`:271-284`) |
| RRULEBuilder | **DIRECT REUSE** (already inside the teaser) | pure controlled, fetch-free (`RRULEBuilder.tsx:9-11`) |
| HubCalendar w/ routines layer | **DIRECT REUSE, EXAMPLE-FED** via `demoEvents` truthy-guard (proven live in the Runway deck) | `HubCalendar.tsx:173,180`; routine tiles = `source:'routines'`, teal, 🔁, `isRecurring:true` |
| TodaysStrip | **STATIC MIRROR** | unconditional self-fetch on mount (`TodaysStrip.tsx:73,88-90`), no demo seam |
| RoutineList / RoutineRow (grouped list, streaks, expanded detail) | **STATIC MIRROR** | self-fetch on mount (`RoutineList.tsx:51,66-69`), no seam |
| RoutineStepList | **STATIC MIRROR** (inside the row mirror) | mutation-only fetches; parent list unfetchable logged-out |
| CoaSelect | **cannot mount logged-out** — teaser's static `DEFAULT_COA` substitution is the correct stand-in | self-fetches per entity (`CoaSelect.tsx:37`); teaser substitution documented (`home RoutineCreateForm.tsx:108-112`) |
| ScenifyButton/Modal, TakeifyButton | **STATIC MIRROR only, inert** | Scenify AI-suggest is a paid, `pro_plus`-gated call (§6); a live mount could fire it — banned. Mirror carries the 🎬 badges + an honest tier label |
| Budget bridge visual (routines → planned column) | **STATIC MIRROR** with correspondence cites | no data seam in HubBudgetSection (per RUNWAY-FULL-INVENTORY); reuse the Runway deck's BudgetMirror correspondence (`RunwayShowcaseSections.tsx:92-99`) |

**Zero-fetch guarantee for the deck:** teaser + RRULEBuilder + HubCalendar-on-demoEvents are the only
live mounts needed; everything else mirrors. No `RunwayDataProvider`-style dead fetcher exists on this
tab to avoid — but `OperationsEntityProvider` (self-fetches `/api/entities`) must NOT be imported by
the deck.

---

## 10. TEASER-REUSE RULING

**The teaser IS the deck's live section — reuse it as-is; it has not drifted.**

Verified against the current real form field-by-field: name / description / entity / budget-per-occurrence
/ COA / the SAME `RRULEBuilder` component instance / start-end date / start-end time — the teaser mirrors
`workbench RoutineCreateForm.tsx` faithfully, with two deliberate, honestly-labeled substitutions
(entity placeholder "set after login" `:100-104`; static `DEFAULT_COA` starter categories `:108-145`).
Its output table (cadence-count chips + name·cadence·time rows + per-row delete `:206-262`) and its
convert-CTA after the first routine (`:271-284`) are exactly the "genuinely interactive locally,
honestly labeled" pattern the deck's live section wants.

What it does NOT show (fine — server-computed state a guest can't honestly have): streaks, next-due,
status pills, steps, budget column in the output table. **Recommended extension for the build task
(small, honest):** surface the guest-typed budget + COA as a column in the output table and a
"planned/month ≈ amount × occurrences" line computed client-side from the guest's own inputs — it
closes the loop to the budget slide using only data the guest typed. This is an extension decision for
the deck build, not a prerequisite; the teaser is reusable verbatim today.

---

## 11. CROSS-DECK EXAMPLE RULING — do the Runway deck's figures carry?

**YES — carry the SAME example set. The routines shown here ARE the budget lines shown there.**

The Runway deck's slide-6 budget rows (`RunwayShowcaseSections.tsx:92-99`, declared as "three MONTHLY
budgeted routines", header comment `:28`):

| Routine | COA | budget/occurrence | occurrences/mo | planned | actual (Runway deck) |
|---|---|---|---|---|---|
| Rent (Business) | 6100 | $400 | 1 (monthly) | $400 | $400.00 (0.0%) |
| Supplies | 6120 | $300 | 1 (monthly) | $300 | $312.45 (+4.2% — the drill's 84.12+145.90+82.43) |
| Car & Truck Expenses | 6010 | $150 | 1 (monthly) | $150 | $138.20 (−7.9%) |

And the Runway deck's demo-day routine tiles (`:136,139`): "Morning coffee and plan the day"
07:00–07:30 and "Prep the truck for the lunch rush" 10:30–11:30, both teal `source:'routines'`,
`isRecurring:true` — reuse both for this deck's calendar mount.

**The constraint that shapes HOW they carry (verified):** the teaser's picker is the static
`DEFAULT_COA` starter chart (28 codes, `coaDefaults.ts:14-52`) — **6120 and 6010 do not exist in it,
and 6100 is "Meals & Dining" there**, not "Rent (Business)". The Runway example codes are per-user
*Business-entity* COA codes. Therefore:

- The carried example routines must render as **pre-built worked-example rows** (EXAMPLE-FED into
  deck-owned display, or a labeled static mirror) — *"the example business you saw on the Runway
  deck"* — never as guest-buildable picks in the teaser (its picker literally cannot select those codes).
- The **interactive teaser stays the guest's own sandbox** with its honest starter categories.
- Two layers, labeled on their faces: (a) the worked example carrying the Runway figures verbatim —
  cross-deck coherence; (b) the live build-your-own teaser — interactivity. Do not blend them.

---

## 12. Scope of a future ROUTINES-SHOWCASE build (informational, no design here)

New deck file + a ModuleLauncher guest-branch swap (`ModuleLauncher.tsx:527-529`), teaser reused inside
the deck's live section. No gate/route/lib changes. CTA: no `tab:routines` entitlement exists
(`categoryKeys.ts:23-28`); a `tab:operations` key IS defined there (`:27`) but is **checked nowhere**
(zero `hasTabAccess`/`isTabLocked` hits outside categoryKeys) and the Routines tab mount carries no lock
(`ModuleLauncher.tsx:513-531`). Same ruling as Projects/Content/Runway — the tab is auth-only → honest
**"Make a free account"**, and the teaser's existing conversion copy already is that CTA.

---

*READ-ONLY audit. No code changed. Authored for the SOC 2 paper trail; Alex merges.*
