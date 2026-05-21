PR-OPS-5.6 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `c5e2aa1` (merge #547 PR-Ops-5.5 hub event card) → `a078c30` (merge #546 5.5 audit) → `a2e48d1` (5.5 commit). PR-Ops-5.5 confirmed on main.
- current branch: `claude/pr-ops-5.6-routines-hub-audit`

A. ROUTINES DATA MODEL

- **`operations_routines` (`prisma/schema.prisma:2716-2748`)** — full column list:
  - `id String @id @default(uuid())`
  - `user_id String`
  - `entity_id String`
  - `name String @db.VarChar(200)`
  - `description String? @db.Text`
  - **`schedule_rrule String @db.Text` ← RFC 5545 RRULE string**
  - `timezone String @default("America/Los_Angeles") @db.VarChar(64)` — REQUIRED for RRULE expansion (DST/BYHOUR semantics are timezone-sensitive)
  - `next_due_at DateTime? @db.Timestamptz(6)` — server-computed forward anchor
  - `last_evaluated_at / last_completed_at DateTime? @db.Timestamptz(6)`
  - `consecutive_completion_streak Int @default(0)` / `consecutive_miss_streak Int @default(0)` — habit tracking
  - `ideal_time_label String? @db.VarChar(50)` — free-text label like "morning"
  - `fail_threshold_minutes Int @default(0)` — grace period before a missed occurrence is recorded
  - `start_date / end_date DateTime? @db.Date` — RRULE window bounds (local date)
  - **`start_time / end_time DateTime? @db.Time(6)` — daily intent-window (HH:MM)**
  - `is_active Boolean @default(true)`
  - timestamps + `created_by`
- **Recurrence representation:** RFC 5545 RRULE string in `schedule_rrule`, plus per-row `timezone` (DST-aware). "Every Saturday at 9am PT" → `FREQ=WEEKLY;BYDAY=SA;BYHOUR=9;BYMINUTE=0;BYSECOND=0` with timezone `America/Los_Angeles`. The UI provides a structured form (`RRULEBuilder.tsx`) that compiles to RRULE; the user never types RRULE strings directly. **Real RFC 5545 — not a homegrown cadence enum.**
- **Time fields:** ✓ `start_time` (intent-window start, HH:MM) + `end_time` (intent-window end). Plus the BYHOUR/BYMINUTE inside the rrule itself.
- **Cost / expense fields: NONE.**
  - `grep -E "cost|amount|coa_code|expense" prisma/schema.prisma` in the routines block range (2716-2748): **zero matches.**
  - No `expected_cost_usd`, no `coa_code`, no `amount`. The routine model is purely cadence/habit-tracking — no money.
- **3 patterns supported today: ONLY (a) — time-block / cadence.** Patterns (b) "recurring expense" and (c) "both" require schema additions that don't exist. The prompt's 3-pattern framing is aspirational.
- **Child tables:**
  - **`operations_routine_steps`** (`:2751-2772`) — ordered sub-activities within a routine. Has `step_order, time_of_day, activity, sub_activity, location, duration_minutes, notes`. Inherits the parent's recurrence (no own rrule). Has a `content_take` relation (the content-production layer).
  - **`operations_routine_completions`** (`:2776-2792`) — one row per **completed** occurrence: `routine_id, expected_at, completed_at, delta_minutes, notes`. UNIQUE on `[routine_id, expected_at]`. **Missed** occurrences are NOT in this table — they live exclusively in `audit_log` (per the types.ts comment `:9-18`: "the absence of a row at expected_at IS the miss"). Truth-first design — the table is success-only.
- **Routines also relate to content:** `operations_routines.content_scene operations_content_scenes?` (1:1, from the 4.9.3 content series). Routine steps relate to `content_takes`. Routines are also the cadence backbone for content production.

B. CURRENT ROUTINE BEHAVIOR

- **API endpoints (7 routes under `src/app/api/operations/routines/`):**
  - `routines/route.ts` — GET (list, with optional ?entity_id and ?is_active filters), POST (create with rrule compilation + initial `next_due_at` via `expandForward`)
  - `routines/[id]/route.ts` — GET single (lines :78-103), PATCH (:105-327, audit-discriminating: deactivation vs reactivation vs schedule-change vs content-change), DELETE (:329+, hard delete cascading completions)
  - `routines/today/route.ts` — GET today's strip with status per routine (`pending` | `completed` | `missed` | `upcoming`), using `expandBetween` over today's local bounds
  - `routines/[id]/upcoming/route.ts` — GET next N occurrences (`?count=N`, max 30), using `expandForward`
  - `routines/[id]/completions/route.ts` — POST a completion at `expected_at` (with audit + delta_minutes computation)
  - `routines/[id]/steps/route.ts` — POST a new step
  - `routines/steps/[stepId]/route.ts` — PATCH / DELETE a step
- **Creator form** (`RoutineList.tsx`, fields per the form at `:221-296`): `name, description, entity, cadence builder (RRULEBuilder.tsx), start_date, end_date, start_time, end_time`. **NO cost/amount/category fields.** The form is currently for time-cadence routines only. `RoutineForm` interface (`types.ts:140-159`) confirms: 18 fields, none money-related.
- **AI assistants in the creator: NO.** The form is fully manual (RRULE builder, manual fields). No "describe your habit and we'll set the rrule" assistant. No "is this a workout/meal/expense?" classifier. The 3-pattern AI assistance is future.
- **Occurrence generation exists: YES, on-the-fly only.** No materialized `routine_occurrences` table. Expansion happens at read time via the `rrule` package wrapped in `src/lib/operations/rruleHelpers.ts`.

C. RECURRENCE HANDLING

- **Expansion approach: ON-THE-FLY via `expandBetween` / `expandForward`** (`src/lib/operations/rruleHelpers.ts`):
  - `expandForward(rruleString, timezone, after, count)` (`:143-153`) — next N occurrences from `after`
  - `expandBetween(rruleString, timezone, from, to)` (`:161-170`) — all occurrences inside [from, to]
  - Both are timezone-aware (DST-correct via `shiftFloatingToZone` at `:184-188` using `Intl.DateTimeFormat`).
  - **No materialization.** No `routine_occurrences` table. Each read recomputes.
- **rrule library usage:** the npm `rrule@^2.8.1` package is the workhorse. Used in 7 places:
  - `src/lib/operations/rruleHelpers.ts` — the shipped expansion helpers (server-side)
  - `src/components/workbench/operations/routines/RRULEBuilder.tsx` — form-side structured builder
  - `src/components/workbench/operations/content/ContentTable.tsx` — read-only display of routine cadence
  - 4 routines API routes (`route.ts`, `[id]/route.ts`, `[id]/completions/route.ts`, `[id]/upcoming/route.ts`)
  - `src/inngest/functions/routine-evaluator.ts` — Inngest cron that backward-evaluates completed/missed occurrences
- **"Occurrences in window" capability: EXISTS** in pure-helper form (`expandBetween`), but **NO Hub-facing endpoint** wraps it across all active routines for an arbitrary window.
  - `/today` covers exactly one local day with status hydration.
  - `/[id]/upcoming` covers next-N per-routine (forward only).
  - For a Hub month-window render with multiple routines: would need either (a) a new `/api/hub/operations-routines?from=&to=` server endpoint that loops active routines + calls `expandBetween` per routine and shapes events, or (b) N+1 client calls (bad — `/upcoming` doesn't accept a window anyway). **(a) is the buildable path.**

D. HUB MAPPING ASSESSMENT

- **3 patterns → CalendarEvent:**
  | Pattern | Maps to | Buildable today? |
  |---|---|---|
  | (a) Time-block routine | `CalendarEvent { startDate, startTime, endTime, source: 'routines', title, isRecurring: true }` — one event per expanded occurrence | **YES** — schema has start_time/end_time, rrule expansion works |
  | (b) Expense routine | `CalendarEvent { startDate, source: 'routines', title, budgetAmount, details: [coa_code] }` — all-day cost marker | **NO** — `operations_routines` has no amount or coa_code column |
  | (c) Both (time + cost) | Combined event with all the above | **NO** — same blocker as (b) |
- **New `'routines'` source vs reuse `'operations'`: NEW SOURCE.** Recommendation. Routines are recurring-cadence (habit/maintenance work), conceptually different from one-time scheduled task commitments. Visual distinction prevents user confusion. Available palette colors (existing sources use amber/slate/pink/violet/emerald/brand-purple/cyan/indigo): **teal, lime, rose, fuchsia, sky, orange, red, yellow** are open. Recommend `{ icon: '🔁', color: 'text-teal-600', dotColor: 'bg-teal-500', calendarColor: 'bg-teal-400' }` — 🔁 is iconic for recurrence.
- **`isRecurring` + existing recurrence handling on Hub:**
  - `CalendarEvent.isRecurring?: boolean` exists on the interface (`CalendarGrid.tsx:19`).
  - Hub maps `calendar_events.is_recurring → CalendarEvent.isRecurring` (`hub/page.tsx:29, :303`).
  - **But the existing `calendar_events` flow does NOT expand recurring events into instances.** A recurring AT&T bill is stored as ONE row with `is_recurring: true` + `recurrence_rule String?` (schema `:1209-1210`) and rendered as ONE event tile tagged "recurring." This is **different from how routines should render on the Hub** — we want each weekly workout to appear as a distinct tile on its own day. Routines need real per-occurrence expansion; the existing flag-only approach won't do.
  - **`isRecurring` is informational — keep using it on routine events** (set `true` so the UI can show a small "↻" hint if desired). The actual per-instance rendering comes from emitting N CalendarEvents (one per expanded occurrence), not from the flag.

E. RECOMMENDATION

**Honest scope: the prompt's "3 patterns" are aspirational; only pattern (a) is buildable from the current schema. Patterns (b) and (c) require a prerequisite schema migration.** Choosing between:

- **Recommended Phase 2 scope (this PR): Wire ONLY pattern (a).** Time-block routine occurrences render on the Hub via on-the-fly rrule expansion. New `'routines'` source. Routines render exactly like Operations blocks but with a distinct color and the `isRecurring: true` flag.
- **Defer to a separate prerequisite PR (call it PR-Ops-5.7):** add `expected_cost_usd Decimal? @db.Decimal(15,2)` and `coa_code String? @db.VarChar(50)` to `operations_routines` (or to a new `operations_routine_amounts` join — design TBD). Then patterns (b) and (c) wire in PR-Ops-5.8.

**Wire approach (pattern (a) only):**

- **New server endpoint:** `GET /api/hub/operations-routines?from=YYYY-MM-DD&to=YYYY-MM-DD`. Server fetches all `is_active: true` routines for the user, loops them, calls `expandBetween(rrule, tz, from, to)` per routine, returns an array of `{ routine_id, name, entity_id, timezone, start_time, end_time, occurrences: ISO[] }`. ~80 lines. Reuses shipped `expandBetween` helper.
- **New mapper:** `src/lib/hub/mapOperationsRoutines.ts` (mirrors `mapOperationsBlocks.ts`). Takes the routines-window response + emits `CalendarEvent[]` with one event per (routine, occurrence) pair. Date = LOCAL YYYY-MM-DD from occurrence ISO; time = HH:MM from routine `start_time` if set, plus `end_time` for endTime; `title = routine.name`; `source: 'routines'`; `isRecurring: true`. ~50 lines.
- **`src/app/hub/page.tsx` changes:**
  - Add `routines` to `SOURCE_CONFIG` (~3 lines)
  - Add `operationsRoutines` state + `loadOperationsRoutines()` fetcher (mirrors `loadOperationsBlocks` pattern from 5.3) (~30 lines)
  - Useeffect dep on `[selectedYear, selectedMonth]` to refire
  - Concatenate routine events into `gridEvents` useMemo (~3 lines)
  - **Click handling: v1 = navigate to `/operations/routines`** via the existing CalendarGrid `href` mechanism (the dead-link bug from 5.3 is fixed in 5.5, and `/operations/routines` is a real route). OR open a routines-specific info card in a follow-up PR. Recommend v1 = href to `/operations/routines`, deferring a routines info card.
- **No schema change. No new dependency. No CalendarGrid change. No migration.**

**Estimated scope:**
- 1 new API route (`/api/hub/operations-routines/route.ts`, ~80 lines)
- 1 new mapper (`src/lib/hub/mapOperationsRoutines.ts`, ~50 lines)
- 1 modified file (`hub/page.tsx`, ~40 lines added)
- Total: ~170 lines across 1 new + 1 new helper + 1 modified.

**Open decisions for Alex:**

1. **Confirm scope = pattern (a) only.** Patterns (b)/(c) need the cost-on-routines schema first. Do you want PR-Ops-5.6 to wire just (a), or should we hold and do the schema migration first (PR-Ops-5.7 cost columns → PR-Ops-5.8 full 3-pattern wire)?
2. **Click behavior for routine events on Hub.** Three options:
   - (i) Navigate to `/operations/routines` (cheap, route exists, no card)
   - (ii) Open a routines-specific info card (mirror 5.5's HubEventCard pattern but with routine-specific fields: rrule description, next/previous occurrences, completion streak)
   - (iii) No click target (read-only display only — like the existing AT&T-bill style events)
   Recommend (i) for v1, (ii) as a follow-up.
3. **Routines source color/icon.** Recommend `{ icon: '🔁', color: 'text-teal-600', bg/dot/calendar: teal-50/500/400 }`. Confirm or pick different.
4. **Should the Hub fetch only routines whose `entity_id` matches the user's "active" entity** (if any selector exists on /hub), or all routines for the user? Recommend: all active routines, same as how Operations blocks work today.
5. **Performance ceiling:** with N active routines * occurrences-per-month, we could emit hundreds of events per month for the Hub render. The existing CalendarGrid handles dozens of events comfortably. Worth a quick performance check during Phase 2 (count of routines × occurrences for the typical user); if it balloons, consider downsampling or capping.
6. **Completion overlay:** PR-Ops-5.6 v1 will render routine occurrences as scheduled future + past tiles, but does NOT visually distinguish completed vs missed past occurrences on the Hub. Joining `operations_routine_completions` (per (routine_id, expected_at)) plus the audit-log miss rows is a polish layer for a later PR. Confirm v1 ships without completion overlay (simpler, ships sooner).

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.6-phase-1.md.
