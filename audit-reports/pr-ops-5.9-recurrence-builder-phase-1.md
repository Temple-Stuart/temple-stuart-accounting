PR-OPS-5.9 PHASE 1 AUDIT REPORT — Recurrence builder + edit/remove model vs. Apple
=================================================================================

BRANCH STATUS
- main top 3: `debc5ae` (merge #554 PR-Ops-5.8 hub-routine-intent-window) → `1fd7b5d` (merge #553 5.8 hub-time audit) → `89871bf` (merge #552 5.8 editable-routines audit). **PR-Ops-5.8 confirmed on main** (the intent-window fix and both 5.8 audits all merged).
- current branch: `claude/pr-ops-5.9-recurrence-builder-audit`
- **Note:** the prior editable-routines audit (`89871bf`) merged the AUDIT REPORT only — Phase 2 implementation never shipped. `DailyPlanRoutineRow.tsx` still has zero action buttons (grep for `handleDelete|handleDeactivate|<button` returns nothing). Relevant to Section D below.

A. RRULEBUILDER UI (repeat picker) — partial Apple-grade

- **Cadence-mode dropdown (`RRULEBuilder.tsx:54-64`)** offers 5 options sourced from `CADENCE_MODES`:
  - `daily` → emits `FREQ=DAILY`
  - `weekly` → emits `FREQ=WEEKLY;BYDAY=<selected>`
  - `monthly_day_of_month` → emits `FREQ=MONTHLY;BYMONTHDAY=N`
  - `monthly_nth_weekday` → emits `FREQ=MONTHLY;BYDAY=NthWD` (e.g. `BYDAY=-1MO` for "last Monday")
  - `custom` → raw RRULE escape hatch (`:140-155`)
- **Mode-specific UI controls:**
  - daily: no extra fields
  - weekly: 7 weekday-toggle buttons (Mon–Sun chips, `:67-91`) → `weekly_byday: WeekDay[]`
  - monthly_day_of_month: number input 1–31 (`:93-105`)
  - monthly_nth_weekday: `1st / 2nd / 3rd / 4th / last` dropdown + weekday dropdown (`:107-138`)
  - custom: free-text input (`:140-155`)
- **Always present (`:157-191, 193-214`):** `byhour` (0–23), `byminute` (0–59), `fail_threshold_minutes`, `timezone`, `ideal_time_label`.
- **`compileFormToRRule` output (rruleHelpers.ts:42-69):** never emits `INTERVAL` — every produced RRULE is implicitly `INTERVAL=1`. Always appends `BYHOUR=X;BYMINUTE=Y;BYSECOND=0`. Validates by parsing through `rrulestr` before returning.
- **Human-readable summary: NO.** Grep for any preview text / formatted-cadence display in the builder returns nothing. The user sees the form controls but never a "Repeats every weekday at 8am" sentence like Apple shows.
- **Apple gap table:**

  | Apple option | RRULEBuilder has it? | Missing |
  |---|---|---|
  | Every day | ✓ `daily` | — |
  | Every weekday (M–F) | ⚠ achievable via `weekly` + manually toggling 5 chips | **One-click weekday preset** |
  | Every weekend (Sat+Sun) | ⚠ same — manual chip toggling | **One-click weekend preset** |
  | Weekly on specific days | ✓ `weekly` + chips | — |
  | Every N days/weeks/months (INTERVAL=N) | **❌ NO** — no form field, `compileFormToRRule` never emits `INTERVAL`. Only via `custom` raw RRULE. | **INTERVAL field + repeat-every-N selector** |
  | Monthly on date | ✓ `monthly_day_of_month` | — |
  | Monthly on Nth weekday | ✓ `monthly_nth_weekday` (1st/2nd/3rd/4th/last) | — |
  | Yearly | ⚠ via `custom` only | Yearly preset (Apple has it built-in) |
  | Custom raw RRULE | ✓ `custom` | — |
  | Human-readable summary ("Repeats every weekday at 8am") | ❌ NO | **Cadence-summary string** |
  | End repeat (date / count) | ⚠ `routine.end_date` column achieves series-end at the routine level; not via RRULE `UNTIL`/`COUNT`. | RRULE-level UNTIL/COUNT not exposed; end_date workaround works for most cases |

  **Net: partial Apple parity. The structural modes are all there; the friendly affordances (presets, INTERVAL, readable summary) are not.**

B. EDITING RECURRENCE AFTER CREATION

- **Yes, cadence is editable.** `RoutineRow.tsx:96-122 handleSave` PATCHes `/api/operations/routines/[id]` with the full `form`. The server (`/[id]/route.ts:181-206`) checks `cadenceFieldsPresent` (any of `cadence_mode, weekly_byday, monthly_*, custom_rrule, byhour, byminute`) and recompiles `schedule_rrule` via `compileFormToRRule`. The same `RRULEBuilder` is reused in edit mode (`RoutineRow.tsx:348` per prior audits).
- **This/future/all concept: NO.** Editing a routine replaces the SINGLE rule — every past and future occurrence shifts accordingly with no per-occurrence override. No `RRuleSet` writes, no EXDATE handling, no series-split logic. A schedule edit is global.

C. OCCURRENCE MODEL (this/future/all feasibility)

- **"All" (edit the single rule): ALREADY POSSIBLE** via `handleSave` above. ✓
- **"This and future" (split the series):** feasible without schema change. Mechanically: PATCH routine A's `end_date` to (split_date − 1); CREATE routine B with `start_date = split_date` and the new rrule. Both endpoints already exist (POST `/api/operations/routines`, PATCH `/[id]`). Two API calls in sequence, no new column. UI work is the cost — a "this and future" modal that drives both calls. **Routine model accommodates it natively** (`start_date`/`end_date` are `@db.Date` per audited schema and are already respected by `/today`, `/upcoming`, and `/api/hub/operations-routines` bounds checks).
- **"This only" (skip one occurrence) — EXDATE:**
  - **rrule@2.8.1 library DOES support EXDATE** (`node_modules/rrule/dist/esm/rruleset.d.ts` exposes `_exdate: Date[]`, `.exdate(date)`, `.exdates()`; `rrulestr.d.ts` shows `exdatevals: Date[]` in the parse output). Library-side, no addition needed.
  - **BUT the codebase explicitly REJECTS RRuleSet today** (`rruleHelpers.ts:121-126`):
    ```ts
    const parsed = rrulestr(`RRULE:${rruleString.replace(/^RRULE:/, '')}`, { dtstart: ... });
    if (parsed instanceof RRuleSet) {
      throw new Error('RRuleSet not supported; provide a single RRULE');
    }
    return parsed;
    ```
    A string containing both `RRULE:...` and `EXDATE:...` parses to RRuleSet, which this code throws on. So **EXDATE in the stored `schedule_rrule` would break expansion across all consumers** (`/today`, `/upcoming`, `/api/hub/operations-routines`, the Inngest evaluator) until this guard is loosened.
  - **`expandBetween` does NOT honor EXDATE today** because of the RRuleSet rejection. Once `rruleFromString` returns either RRule or RRuleSet, `rule.between(from, to, true)` works identically on both (the library's `RRuleSet.between` filters out exdates automatically). **Small server-side change: 1 function (~10 lines) in `rruleHelpers.ts` to accept and return either type, plus updating the type signature of `expandBetween`/`expandForward` return values.**
  - **Schema: NO change needed.** `schedule_rrule String @db.Text` already accommodates multi-line content like `RRULE:FREQ=DAILY\nEXDATE:20260521T070000Z`.
  - **UI / API additions for "skip one":**
    - A "skip this occurrence" affordance somewhere (Hub event card? routines page? Daily Plan routine row?).
    - A PATCH path that appends an EXDATE line to `schedule_rrule` for the chosen occurrence ISO. The existing `/api/operations/routines/[id]` PATCH could accept a new body field like `{ exdate_add: "YYYYMMDDTHHMMSSZ" }` that mutates `schedule_rrule` server-side.

D. DEACTIVATE PATH (the simple uncommit)

- **PATCH `is_active: false` exists.** `/api/operations/routines/[id]/route.ts:208-215` accepts `body.is_active`, writes the column, and audit-discriminates: false → `operations_routine_deactivated`; true (from previously-false) → `operations_routine_updated` with `metadata.activation_toggle='reactivated'`.
- **Hub filter (`/api/hub/operations-routines/route.ts:105`):** `where: { user_id: user.id, is_active: true }` — deactivated routines immediately disappear from the Hub. ✓
- **Today filter (`/api/operations/routines/today/route.ts:102`):** same — `where: { user_id: user.id, is_active: true }`. ✓
- **Deactivate button location: ONLY on `/operations/routines`** (RoutineRow.tsx `:280-296`, handler at `:125-145 handleToggleActive`). NOT on the Hub. NOT on the Daily Plan routine row. The prior 5.8 editable-routines AUDIT recommended adding it to the Daily Plan row but **the Phase 2 implementation never shipped** (audit-only merge `89871bf`; DailyPlanRoutineRow still has zero buttons — grep confirmed).

E. RECOMMENDATION — sequence the Apple experience

- **RRULEBuilder status: structurally complete but friendliness-incomplete.** All four modes (daily / weekly / monthly-by-date / monthly-by-Nth-weekday) work; cadence is editable. **Missing for Apple parity: INTERVAL (every N), one-click weekday/weekend presets, human-readable summary line.** None require schema changes.
- **this/future/all model: ENTIRELY NEW UI**, but the underlying mechanics break down differently than expected:
  - **"All" = already possible** (existing edit/delete).
  - **"This and future" = small** (PATCH end_date on routine A + POST routine B; both endpoints exist). Largely UI.
  - **"This only" = small server change (EXDATE wiring) + medium UI.** The rrule library already supports EXDATE; the codebase's `rruleFromString` rejects RRuleSet (1 guard to loosen + signature update). PATCH endpoint takes a small extension. Schema unchanged.
- **EXDATE makes skip-one smaller than expected: YES.** The library is ready; the codebase intentionally narrowed its surface to single-RRULE. Loosening the guard is ~10 server lines + a UI affordance.
- **Smallest first PR that moves toward the Apple experience: ship the editable-routines Phase 2 first (the audit merged but the implementation never did).** That gets `deactivate` + `delete` + `edit-link` onto the Daily Plan routine row — closes Alex's "no way to act on them" pain point with the minimum diff and gives the user the "remove from calendar" gesture today. Build sequence after that:
  1. **PR-Ops-5.9-A (this concept):** RRULEBuilder friendliness — add INTERVAL field, "every weekday" / "every weekend" one-click presets, and a one-line human-readable summary (`"Repeats every weekday at 08:00"`-style). Pure UI; no API/schema. Closes the "doesn't look Apple-grade" gap.
  2. **PR-Ops-5.9-B (editable on Daily Plan):** the deferred editable-routines work — `deactivate / delete / edit-link` buttons on `DailyPlanRoutineRow`. Pure UI; uses existing PATCH/DELETE. (Closes Alex's earlier "no way to act on them" pain.)
  3. **PR-Ops-5.9-C (EXDATE / skip-one):** loosen `rruleFromString` to accept RRuleSet, return union type; update `expandBetween`/`expandForward` return types; PATCH endpoint accepts `exdate_add` field; UI affordance ("skip this occurrence") in the Hub event card AND/OR Daily Plan routine row. Server: ~30 lines. UI: ~80 lines.
  4. **PR-Ops-5.9-D (this-and-future / series split):** "this and future edit" modal that drives PATCH(A.end_date) + POST(B). UI: ~120 lines. No server change.
- **Schema implications: NONE for any of A/B/C/D.** All Apple-style affordances fit in the existing schema (`schedule_rrule String @db.Text` accommodates EXDATE; `start_date/end_date` accommodate series-split; `is_active` accommodates deactivate). The cost-fields migration (for recurring expenses) is a SEPARATE concern.
- **Open decisions for Alex:**
  1. **Build order:** ship the deferred editable-routines work first (Daily Plan buttons) so the basic uncommit gesture exists, OR push straight to RRULEBuilder Apple-grade upgrades, OR jump to EXDATE skip-one? Recommend: **(B) editable Daily Plan first** (smallest, closes a known pain) → **(A) RRULEBuilder friendliness** → **(C) EXDATE skip-one** → **(D) this-and-future split**. Each PR is independently shippable.
  2. **Should the Apple-grade summary be computed server-side** (in `compileFormToRRule`'s neighborhood, returned alongside the rrule for any UI to render) **or client-side** (in RRULEBuilder)? Server-side gives one source of truth for every display surface (Hub card, Daily Plan, routines page). Client-side is simpler for the builder alone. Recommend **server-side helper** returning a `describeRRule(rrule, tz): string` so the Hub event card and other surfaces can show "Repeats every weekday at 08:00" without re-implementing.
  3. **EXDATE storage format:** EXDATE values can be `EXDATE:YYYYMMDDTHHMMSS` (floating) or `EXDATE;TZID=America/Los_Angeles:YYYYMMDDTHHMMSS` (zoned). Routines have a `timezone` column; the natural fit is the floating form interpreted in routine.timezone, matching how BYHOUR/BYMINUTE work today. Confirm before implementing C.
  4. **Confirm "this and future" semantics:** Apple's "this and future" preserves PAST occurrences as the old rule. Our equivalent (`end_date` on routine A) does the same. Confirm this is the intended behavior (vs. "all future = mutate the existing rule, lose past consistency").
  5. **Where do `skip-one` and `this/future` affordances live?** Three candidate surfaces: Hub event card (PR-Ops-5.5 pattern — open card, choose edit option, modal), Daily Plan routine row (after editable-routines ships, this is a natural home), or routines-page RoutineRow (heaviest editor, makes sense for series-split but maybe not for one-off skips). Recommend: skip-one on Hub card + Daily Plan row; this/future on routines-page editor (where the user is already deciding cadence).
  6. **Regression test posture:** test infra still absent per PR-Ops-5.7 Phase 2. Each of these PRs ships without tests until that infra arrives. Confirm — or fold in a vitest-setup PR before C/D (the EXDATE wiring is the kind of thing that BADLY wants a test).

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.9-recurrence-builder-phase-1.md.
