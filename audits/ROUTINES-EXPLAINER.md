# ROUTINES TAB EXPLAINER — PIPELINE AUDIT (read-only)

**Branch:** `claude/audit-routines-explainer` · **Date:** 2026-06-21 · **Scope:** verify the REAL Routines
pipeline mechanics so a Hero "How it works" explainer can be written TRUE, not invented. Read-only; every
claim cites `file:line`. Unread = "NOT VERIFIED."

---

## FINDINGS TABLE (Q1–Q6)

| Q | Finding | `file:line` |
|---|---|---|
| **Q1 Tab id & subhead** | Routines tab id = **`'routines'`**; subhead entry **EXISTS** | `ModuleLauncher.tsx:82`, `:111` |
| **Q2 What a routine is** | `operations_routines` — RRULE-scheduled, entity-scoped, optional time/budget/COA/steps | `schema.prisma:2940-2984` |
| **Q3 Three patterns** | **NOT an explicit field** — inferred from which optional fields are set (start_time / budget_amount) | `mapOperationsRoutines.ts:100-129`; `schema:2957-2969` |
| **Q4 Creation flow** | Single direct **form POST**; **NO AI builder creates routines** | `operations/routines/route.ts:267`; grep |
| **Q5 Downstream feeds** | Budget Planned ✅ · calendar block ✅ · Routine→Content **WIRED** ✅ | `year-calendar:89-98`; `mapOperationsRoutines`; `content/scenes/route.ts:204-216` |
| **Q6 Verified sentences** | 8 verified stages (below); AI builders NOT VERIFIED | (see list) |

---

## Q1 — THE ROUTINES TAB ID & SURFACE

- **Tab id = `'routines'`** — `ModuleLauncher.tsx:82` `{ key: 'routines', label: 'Routines', icon: Repeat }`
  (cf. Runway = `'calendar'` `:80`, Projects = `'projects'` `:83`).
- **Subhead EXISTS** — `TAB_DESCRIPTORS.routines` (`ModuleLauncher.tsx:111`):
  *"Build your recurring routines and watch them land on your calendar — the rhythms that run your day."*
  → **DO NOT duplicate the subhead**; like Runway, it is already wired. The explainer block gates on
  `activeTab === 'routines'`.

## Q2 — WHAT IS A ROUTINE, MECHANICALLY?

`model operations_routines` (`schema.prisma:2940-2984`) — defining fields:
- `schedule_rrule String` (`:2946`) — **required** recurrence rule (the cadence).
- `entity_id String` (`:2943`), `user_id` (`:2942`), `name` (`:2944`), `description?` (`:2945`).
- `start_time DateTime? @db.Time(6)` / `end_time?` (`:2957-2958`) — optional time-of-day window.
- `start_date? / end_date? @db.Date` (`:2955-2956`) — optional active date bounds.
- `budget_amount Decimal? @db.Decimal(12,2)` (`:2968`) + `coa_code String?` (`:2969`) — optional
  per-occurrence budget + category (both nullable; null = no budget, never 0 — comment `:2960-2964`).
- `is_active Boolean` (`:2959`), `timezone` (`:2947`), `next_due_at?` (`:2948`), streaks (`:2951-2952`),
  `ideal_time_label?` (`:2953`), `fail_threshold_minutes` (`:2954`).
- **Relations:** `completions`, `steps operations_routine_steps[]` (`:2975`), `content_scene_group
  operations_content_scene_groups?` (`:2976`), `hub_scheduled_items[]` (`:2977`).

**Plain sentence:** *A routine is a named, recurring activity (an RRULE schedule) scoped to one entity,
which can optionally carry a time-of-day window, a per-occurrence budget + category, and ordered steps.*

## Q3 — THE THREE PATTERNS → **inferred, not an explicit field** (truth-first)

There is **no `pattern`/`type` enum column** on `operations_routines` (`schema:2940-2984` has none). The
"three patterns" are **emergent from which optional fields are populated**:
- **Recurring time block** ← `start_time` is **present** → rendered as a timed hourly-grid block
  (`mapOperationsRoutines.ts:100-113`: `if (startTime) { … startTime … }`).
- **Cadence-only (no time)** ← `start_time` is **null** → rendered all-day (`:114-129`: *"Time-less
  routine → all-day event"*).
- **Recurring expense** ← `budget_amount` + `coa_code` are **present** → contributes planned spend
  (`route.ts:230-285` stores them; `year-calendar` reads them).
- **Both** ← `start_time` **and** `budget_amount`+`coa_code` all set.

→ **Report honestly:** the categorization is **inferred from populated fields**, not a stored
"pattern" type. An explainer may say "a routine can be a time block, an expense, or both" — but it must
not imply a discrete type the user picks; the user simply fills in time and/or budget.

## Q4 — CREATION FLOW → direct form; **no AI builder wired to routine creation**

- **One creation path:** `prisma.operations_routines.create` appears **only** at
  `operations/routines/route.ts:267` (whole-repo grep). The user provides: `name`, `description`,
  `schedule_rrule`, `timezone`, `ideal_time_label`, `fail_threshold`, `start/end_date`, `start/end_time`,
  `is_active`, and optional `budget_amount` + `coa_code` (validated `:230-285` — invalid budget fails
  loud 400, never coerced; null when unset). It is a **plain form POST**, no AI.
- **AI builders — NOT wired to routines.** Grep for `workout|meal planner|scene planner|expense
  categoriz|routine builder|ai routine` found a **meal planner** (`shopping/MealPlanner.tsx`,
  `MealPlannerForm.tsx`, `api/ai/meal-plan/route.ts`) and an ops `api/ops/ai-plan/route.ts` — but **none
  create `operations_routines`** (the only `.create` is `route.ts:267`). The meal planner lives under
  `shopping/`, unrelated to routine creation. **No workout / meal / scene / expense-categorizer builder
  feeds routine creation in code.** → **NOT FOUND — do not mention AI builders in the copy.**

## Q5 — WHERE ROUTINES FEED (downstream pipeline)

1. **Budget Planned figure — WIRED.** `year-calendar/route.ts:89-98` reads budgeted routines
   (`is_active`, `budget_amount != null`, `coa_code != null`) and contributes occurrences-in-month ×
   `budget_amount` to the Planned column (business-budget mirrors it). ✅
2. **Hub calendar block — WIRED.** The `/api/hub/operations-routines` feed → `mapOperationsRoutines.ts`
   emits one calendar event per (routine, occurrence): a **timed block** when `start_time` is set
   (`:100-113`), else **all-day** (`:114-129`). ✅
3. **Routine → Content scene — WIRED.** `operations_content_scene_groups.create`
   (`content/scenes/route.ts:204-216`) creates a scene group with **`routine_id: routineId`** (`:208`),
   `entity_id` derived from the parent routine (`:181`), enforced **1 scene per routine** (`:184-192`).
   The routine model carries the inverse relation `content_scene_group?` (`schema:2976`) and the routines
   GET includes it (`route.ts:98`). ✅ → A routine **can be turned into a Content scene/script.**

## Q6 — VERIFIED PIPELINE SENTENCES (the copy raw material)

**Verified in code (safe for the explainer):**
1. You create a routine — a named recurring activity on a schedule, scoped to an entity. `route.ts:267`,
   `schema:2946`
2. Give it a time of day and it lands as a timed block on your calendar. `schema:2957-2958`,
   `mapOperationsRoutines:100-113`
3. Leave the time off and it's cadence-only — shown all-day. `mapOperationsRoutines:114-129`
4. Give it a dollar amount and a category and it becomes planned spend. `schema:2968-2969`,
   `route.ts:233-285`
5. Each month that planned spend flows onto your budget (occurrences × amount). `year-calendar:89-98`
6. Every occurrence shows up on the hub calendar as a recurring event. `mapOperationsRoutines` feed
7. A routine can hold ordered steps. `schema:2975` (`operations_routine_steps`)
8. A routine can be turned into a Content scene + script (one scene per routine). `content/scenes/route.ts:204-216`,
   `schema:2976`

**NOT VERIFIED — do NOT put in copy:**
- Any **AI builder** (workout / meal planner / scene planner / expense categorizer) that **creates or
  drafts a routine** — the meal planner exists only under `shopping/` and does not touch
  `operations_routines`; no AI path creates routines (Q4). Mentioning an "AI builds your routine" step
  would be false.

---

## CONFIRMED TAB FACTS (for the build)

- **Tab id:** `activeTab === 'routines'` (`ModuleLauncher.tsx:82`).
- **Subhead:** already wired — `TAB_DESCRIPTORS.routines` (`:111`). Do not add another.
- **GET STARTED — shared button, no own needed.** The Hero's Get Started lives **outside** the per-tab
  conditional, at `page.tsx:141-146` (after the `{activeTab === '…' && (…)}` blocks), so it renders for
  every tab. The Routines explainer block needs **no button of its own** — identical to the Runway block
  — preserving the register-modal behavior (`page.tsx:142` `setLoginMode('register'); setShowLogin(true)`).

→ **Build shape:** add a `{activeTab === 'routines' && ( … )}` block in `page.tsx`'s Hero, structurally
identical to the Projects/Runway blocks (same wrapper, `How it works:` headline, `list-decimal` `<ol>`),
with steps drawn ONLY from the Q6 verified list. No subhead change, no button, no logic.

---

*Read-only audit. No code changed; this `.md` is the only file created. The three "patterns" are inferred
from populated fields (not a stored type); routine creation is a plain form (no AI builder wired);
budget-feed, calendar-block, and Routine→Content are all wired. AI-builder routine creation is NOT
VERIFIED and must stay out of the copy. Every claim cites `file:line`.*
