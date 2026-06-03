# HOME-OPS-PR-1 — Real routine input form + empty output table on home (fetch-free, gated)

**Branch:** `claude/home-ops-pr-1`
**Date:** 2026-06-02
**Scope:** Replace the **fabricated** "Make a routine" panel in `OperationsShowroom`
with the **REAL** routine input form (extracted **fetch-free**) + the **real**
routines output table structure rendered **EMPTY**, with the create submit gated to
the login modal. ONE concept — the Routine piece only; the other 3 panels stay
sample-data until their own PRs. **Safe by construction: no fetch on mount, no
server/paid call when logged out.** 1 new component + `OperationsShowroom.tsx`.
**0 endpoint, 0 schema, 0 deps.**

> Per `audit-reports/home-ops-real-audit.md`: Travel/Trading show REAL inputs on home
> via (1) no fetch on mount, (2) submit injected + gated via `onRequireAuth` **before**
> any fetch, (3) `showHeader={false}`. The real `RoutineList` self-fetches on mount
> (`:51`), so it can't be dropped on the public page — the fix mirrors the
> Travel/Trading extraction.

---

## STEP 1 — Audit (cited)

- **Real routine INPUT form** lives in `RoutineList.tsx:219-300` (name `:222`,
  description `:233`, entity select `:243`, the **`RRULEBuilder`** `:258`, start/end
  dates `:263/272`, start/end times `:284/293`) + the create button `:303-310`. The
  cadence builder `RRULEBuilder.tsx` exposes the real fields: cadence mode `:54`,
  weekly days `:71`, monthly day-of-month `:96`, monthly Nth-weekday `:111/125`,
  custom RRULE `:145`, **hour `:160` / minute `:171` / fail-threshold `:182`**,
  timezone `:198`, ideal-time label `:206`.
- **Fetch-on-mount (the thing to avoid):** `RoutineList.tsx` `useEffect:66-69` →
  `fetchRoutines()` → `fetch('/api/operations/routines…')` `:51`. Entities arrive as
  a **prop** (`:29,33`), not fetched here.
- **Pure-input vs data-fetch separation:** `RRULEBuilder` and the form JSX are
  **local-state only** (controlled by `form`/`setForm`); the **only** fetch is the
  mount load (`:51`) + the POST in `handleCreate` (`:120`). So the input UI is
  cleanly extractable fetch-free.
- **Real routines OUTPUT table** = `RoutineList.tsx:330-356`: rows grouped by cadence
  (`CADENCE_GROUP_ORDER` → "Daily / Weekly / Monthly / Quarterly / Yearly / Custom",
  `:336-337`), each a `RoutineRow`. `RoutineRow.tsx`'s compact line (`:183-199`)
  shows **name** (`:185`) · **streak** `🔥 N✓ / N✗` (`:194`) · **next due** (`:196`)
  · active/time windows. That anatomy is reproduced **empty**.
- **Travel/Trading extraction pattern mirrored:** `CreateTripForm` — no fetch on
  mount (only a DOM listener `:78-81`); `handleCreate` runs `onUnauthenticated()`
  and **returns before** `fetch('/api/trips')` (`:95-102`); `showHeader` prop drops
  the inner band. This PR mirrors all three.
- **Fabricated panel replaced:** `OperationsShowroom.tsx` panel `step="02"` (the
  "Morning content filming" daily/06:00/streak glimpse) — the block swapped out.

## STEP 2 — Build (real fetch-free form + empty output table)

**New `src/components/home/RoutineCreateForm.tsx`** — the extracted, fetch-free
routine surface:
- **Real inputs, local state only:** holds a `RoutineForm` (`DEFAULT_ROUTINE_FORM`)
  and renders name/description/entity + the **real `RRULEBuilder`** (imported from
  `…/routines/RRULEBuilder` — genuinely the real cadence inputs, not re-fabricated)
  + start/end dates + start/end times — the same fields as `RoutineList:219-300`.
- **No fetch anywhere:** no `useEffect`, no `fetch`, no `/api/`. **Entity** is a
  neutral disabled placeholder ("Your workspace · set after login") — **no
  `/api/entities` fetch** (the logged-out form has no entity list).
- **Gated submit (mirrors CreateTripForm):** `handleCreate` (`:43-44`) calls
  `onRequireAuth()` and returns — there is **no fetch on this path or anywhere in
  the file**. The button reads "Create routine → log in".
- **Real OUTPUT structure, EMPTY:** below the form, the real cadence-grouped list is
  reproduced empty — the `CADENCE_GROUP_LABELS` chips ("Daily (0) … Custom (0)") +
  a table with the real `RoutineRow` columns (**Routine · Streak · Next due**) and
  an empty-state row "Your routines appear here once you log in and create one." No
  data, no fetch.

**`OperationsShowroom.tsx` wiring:**
- `import RoutineCreateForm` (top).
- `Panel`'s `action` prop made **optional**; the footer login button renders only
  when `action` is set. Panel 02 omits `action` (the form carries its own gated
  button), so there's exactly one gated control, no duplicate.
- Panel 02 body replaced with `<RoutineCreateForm onRequireAuth={onRequireAuth} />`.
- Header comment updated to record panel 02 is now real/fetch-free.
- **Design:** the panel keeps the light gray inner header (NOT purple); the module
  card's single `bg-brand-purple/80` band (in `ModuleLauncher`) stays the only
  purple — one-purple-per-card preserved.

## STEP 3 — Verify (cited)

- **Routine panel = REAL input form + REAL empty output table; fabricated routine
  content gone.** Panel 02 now renders `RoutineCreateForm` (the
  name/description/entity/`RRULEBuilder`/dates/times form + the empty
  cadence-grouped table); the "Morning content filming" sample block is removed.
- **grep proof — no fetch / no `/api/` / submit→onRequireAuth only:**
  `grep -nE "fetch|axios|/api/|useEffect" RoutineCreateForm.tsx RRULEBuilder.tsx`
  → matches are **comment lines only**; **zero in code**. `handleCreate`
  (`RoutineCreateForm.tsx:43-44`) calls only `onRequireAuth()`. `types.ts` is pure
  (its `/api/` mentions are doc comments).
- **Logged-out render fires ZERO server calls (hard line):** the component has no
  `useEffect`, no `fetch`, no `/api/`; the reused `RRULEBuilder` is pure controlled
  (only imports types). There is no network code on any render or submit path → safe
  by construction.
- **Other 3 panels UNCHANGED:** `grep 'step="0[134]"'` confirms panels 01 (project),
  03 (content), 04 (evolution) still render their sample-data bodies + `action`
  footer buttons.
- **Other 5 module sections + the real /operations Routines tab UNTOUCHED:**
  `git diff --name-only` = `OperationsShowroom.tsx` only (+ the new component +
  report); `RoutineList`/`RoutineRow`/`RRULEBuilder`/the routines APIs are **not** in
  the diff (RRULEBuilder is imported, not modified). `ModuleLauncher` untouched.
- **One purple band per card; alternating bands preserved:** the showroom adds no
  purple band; the module section band (`ModuleLauncher.tsx:150`) + alternating
  backgrounds are unchanged.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Real input form + real EMPTY output table; no fabricated data in the routine panel | ✅ real fields + `RRULEBuilder`; output = empty cadence groups + empty `RoutineRow`-column table |
| No fetch on mount, no server/paid call logged-out; submit gates before any fetch | ✅ grep: 0 fetch/`/api/` in code; `handleCreate`→`onRequireAuth()` only; no fetch path exists |
| Don't touch the real Routines tab, other showroom panels, or other 5 modules | ✅ diff = `OperationsShowroom.tsx` + new component; real surface/`ModuleLauncher` not in diff; panels 01/03/04 intact |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (new + changed) | ✅ `RoutineCreateForm.tsx` + `OperationsShowroom.tsx` → 0 problems |
| git diff scoped | ✅ `OperationsShowroom.tsx` + `RoutineCreateForm.tsx` (+ this report) |

---

## Result
The home Operations showroom's **Routine** panel is now the **real thing**: the
genuine routine input form (name, description, entity, the real `RRULEBuilder`
cadence/hour/minute/fail-threshold/timezone fields, date + time windows) above the
**real routines output table rendered empty** (cadence groups + Routine/Streak/Next-
due columns + "your routines appear here"). It is **fetch-free** — extracted exactly
like Travel's `CreateTripForm`: no fetch on mount, and "Create routine" calls
`onRequireAuth` before any network call, so a logged-out visitor fires **zero**
server/paid calls (grep-proven). The other 3 panels, the other 5 module sections, and
the real `/operations` Routines tab are untouched; one-purple-per-card + alternating
bands preserved. tsc + lint clean; diff scoped to the showroom + the new form.
