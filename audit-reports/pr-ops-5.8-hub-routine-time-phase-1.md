PR-OPS-5.8 PHASE 1 AUDIT REPORT — Hub renders routine occurrences at wrong times
=================================================================================

BRANCH STATUS
- main top 3: `b37e744` (merge #551 PR-Ops-5.7 sign fix) → `d4cdd97` (merge #550 5.7 audit) → `b3242fa` (5.7 commit). PR-Ops-5.7 confirmed on main.
- current branch: `claude/pr-ops-5.8-hub-routine-time-audit`
- **Filename deviation flagged:** the prompt requested `audit-reports/pr-ops-5.8-phase-1.md`, but the parallel branch `claude/pr-ops-5.8-editable-routines-audit` (unmerged) targets that exact path. To avoid a merge collision when both 5.8 PRs eventually land, this report is written to `audit-reports/pr-ops-5.8-hub-routine-time-phase-1.md`. The two parallel 5.8 audits address different concerns (editable routine rows vs. Hub time disagreement); both can ship independently.

A. ROUTINES-PAGE (CORRECT) TIME PATH — NO TIMEZONE MATH AT ALL

- **The displayed `window: 00:00–06:00` and `07:00–09:00` come from direct `.slice(11, 16)` of the stored `@db.Time` columns.** No timezone conversion, no rrule expansion, no shift — just literal extraction of the HH:MM the user typed.
- **Daily Plan (`DailyPlanRoutineRow.tsx:65-79`):**
  ```tsx
  {(entry.routine.start_time || entry.routine.end_time) && (
    <span title="intent time window">
      {(() => {
        const startStr = entry.routine.start_time ? entry.routine.start_time.slice(11, 16) : null;
        const endStr = entry.routine.end_time ? entry.routine.end_time.slice(11, 16) : null;
        if (startStr && endStr) return `window: ${startStr}–${endStr}`;
        ...
      })()}
    </span>
  )}
  ```
- **Routines page (`RoutineRow.tsx:211-222`):** identical pattern — direct `.slice(11, 16)` of start_time / end_time.
- **Why this is exact:** `@db.Time(6)` columns are serialized by Prisma as `"1970-01-01THH:MM:SS.000Z"` (epoch-date placeholder + actual HH:MM). Slicing positions 11–16 extracts `HH:MM` verbatim — character-for-character what Alex typed into the form. No timezone applied, no DST drift, no browser-tz dependence. SLEEP's `00:00:00` becomes `"00:00"`. GYM's `07:00:00` becomes `"07:00"`. Always.
- **Separately**, `DailyPlanRoutineRow.tsx:64` shows `expected: {formatTime(entry.expected_at, entry.routine.timezone)}` — this IS the rrule-expansion path that PR-Ops-5.7 fixed. Post-5.7, `expected_at` correctly displays in routine.timezone. But for the WINDOW line (where Alex sees the correct 00:00–06:00 / 07:00–09:00 values), only the direct `.slice` is in play.

B. HUB (WRONG) TIME PATH — BROWSER-LOCAL EXTRACTION OF THE RRULE'S OCCURRENCE ISO

- **`src/lib/hub/mapOperationsRoutines.ts:46-54`:**
  ```ts
  function toLocalDateAndTime(iso: string): { date: string; time: string } {
    const d = new Date(iso);
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
  ```
- **Time derivation: BROWSER-LOCAL `getHours()` / `getMinutes()` of the occurrence ISO.** Does NOT use `routine.start_time`. Does NOT use `routine.timezone`. Date extraction is also browser-local (`getFullYear()/getMonth()/getDate()`), with the same tz dependence.
- **What the occurrence ISO carries (`/api/hub/operations-routines/route.ts:127, 154`):** `expandBetween(r.schedule_rrule, r.timezone, from, windowEnd)` → `taken.map((d) => d.toISOString())`. The returned ISO is a Date post-`shiftFloatingToZone(d, r.timezone)`, i.e., a UTC instant representing the rrule's BYHOUR/BYMINUTE wall-clock in routine.timezone.
- **Critical: the occurrence ISO encodes the rrule's BYHOUR, NOT `routine.start_time`.** Per the PR-Ops-5.7 audit, `start_time/end_time` and `byhour/byminute` are SEPARATE form fields with NO auto-derivation. The default `byhour: '08'` ships in `DEFAULT_ROUTINE_FORM`; if the user sets `start_time=00:00` but doesn't change `byhour`, the rrule still fires at 08:00. The occurrence ISO will reflect the BYHOUR, never start_time.
- **The mapper's own comments (`:5-12, 14-20`)** acknowledge the browser-tz dependence as intentional: *"Hub renders in the browser's timezone; a routine scheduled at 8am PT shows up at 11am ET for an ET viewer (correct)."* — this design assumption is the source of the bug. It assumed the rrule's BYHOUR was the canonical "scheduled" time and that browser-tz extraction would render it correctly; in fact the routines-page truth is `start_time`, and `start_time` ≠ BYHOUR in general.

C. DIVERGENCE — TWO PATHS THAT AGREE ONLY BY COINCIDENCE

- **The two surfaces use FUNDAMENTALLY DIFFERENT time sources.** Routines page = `routine.start_time.slice(11, 16)` (the user's typed intent-window start, raw stored string, no tz math). Hub = `new Date(expandBetween(rrule, …)[i].toISOString()).getHours()` (browser-local extraction of the rrule's post-shifted BYHOUR-occurrence). **These agree only when BOTH** (a) browser timezone === routine.timezone **AND** (b) rrule BYHOUR === start_time hour (and BYMINUTE === start_time minute).
- **Worked example for GYM (Alex sees 02:00 on Hub, correctly sees 07:00–09:00 on routines page):**
  - Routines page: `start_time="1970-01-01T07:00:00.000Z".slice(11, 16) = "07:00"`. Display: "07:00–09:00". ✓
  - Hub path: the occurrence ISO returned by `/api/hub/operations-routines` is derived from `expandBetween(routine.schedule_rrule, routine.timezone, ...)`. The rrule's BYHOUR is what determines the hour, and the post-5.7-fixed `shiftFloatingToZone` produces a UTC instant whose hour-in-routine.tz equals BYHOUR. Then `toLocalDateAndTime(iso)` extracts `getHours()` in BROWSER tz. For Alex's GYM to render "02:00", one of these is true:
    - BYHOUR in the stored rrule is NOT 7 (perhaps left at the form's `08` default, or set to a different value when Alex edited),
    - **and/or** Alex's browser timezone differs from `routine.timezone` by an amount that lands the post-shifted hour on 02 (e.g., rrule BYHOUR=07 in LA viewed from a UTC-12 browser would land on 02; or BYHOUR=08 in UTC viewed from a UTC-6 browser would land on 02).
  - Without Alex's actual DB rows it's impossible to say which factor dominates, but the architectural bug is the same either way: **the Hub path doesn't read `start_time`, so it can't agree with the routines page except by accident.**
- **Worked example for SLEEP (Alex sees "6:00 AM" on Hub, correctly sees 00:00–06:00 on routines page):**
  - Routines page: `start_time="1970-01-01T00:00:00.000Z".slice(11, 16) = "00:00"`. Display: "00:00–06:00". ✓
  - Hub path: `toLocalDateAndTime` returns `time: getHours()/getMinutes()` of the post-shifted occurrence. For the Hub to land on `06:00`: the occurrence's UTC instant must format to hour=6 in Alex's browser tz. That requires the rrule BYHOUR ≠ 0 (since BYHOUR=0 in routine.tz=browser.tz would produce 00:00). Most plausible: BYHOUR=6 in the rrule (perhaps Alex set byhour=6 thinking it was the end of the window, OR the form auto-filled it from end_time somewhere I haven't traced) + browser tz === routine tz; OR BYHOUR=0 + browser tz that's 6 hours behind/ahead of routine.tz. Same architectural conclusion: **the Hub never consults start_time, so SLEEP's intent-window of 00:00 is invisible to the Hub.**
  - **Note about endTime:** `mapOperationsRoutines` deliberately OMITS `endTime` (see file header `:14-20`). The Hub tile therefore shows only the (wrongly-derived) startTime as a single label, which is why SLEEP renders as "6:00 AM" alone, not as "00:00–06:00". Even if the startTime were correct, the Hub can't render a window without endTime.
- **Client-side `getHours()` (browser-tz) vs direct read: CONFIRMED divergence at `mapOperationsRoutines.ts:50-53`.** `getHours()` returns the BROWSER's local hour. The mapper runs client-side (the file is imported by `hub/page.tsx` which is `'use client'`). The routines page does NO tz math anywhere in the window-render path — it just reads the stored Time string and slices it. **The Hub IS browser-tz-dependent; the routines page is NOT.** Definitive divergence.

D. CANONICAL TIME — WHAT THE HUB SHOULD DO

- **The single correct display approach:** mirror the routines page exactly — `routine.start_time.slice(11, 16)` for startTime (and `routine.end_time.slice(11, 16)` for endTime). Character-for-character what the user typed. No timezone math, no browser-tz dependence, no BYHOUR involvement.
- **What about the DATE?** The Hub needs `startDate: YYYY-MM-DD` to place the tile on the right calendar day. The occurrence's UTC instant from `expandBetween` does encode the date — but extracting it via browser-local `getFullYear/Month/Date` has the same browser-tz drift as the time bug. The correct extraction is via `Intl.DateTimeFormat` with `timeZone: routine.timezone` (the same `formatLocalDate` helper already used inside `/api/hub/operations-routines/route.ts:35-46`). The date should be the calendar date IN THE ROUTINE'S TIMEZONE on which the occurrence is scheduled — independent of the viewer's browser tz.
- **Why intent-window is the right truth (not BYHOUR):** `routine.start_time/end_time` are what the user typed when they said "this routine happens between 07:00 and 09:00 in my timezone." The rrule's BYHOUR/BYMINUTE are technical metadata used by the cron evaluator to compute "what specific instant should we evaluate missed-vs-completed for today's expected occurrence." For DISPLAY purposes, the user's intent is the source of truth. The routines page already does this; the Hub diverged because the 5.6 mapper extracted from the rrule occurrence instead of from start_time/end_time.
- **Minimal change to make the Hub agree with the routines page:**
  1. Stop using `toLocalDateAndTime(occISO)` for the time.
  2. Use `routine.start_time.slice(11, 16)` for startTime; `routine.end_time.slice(11, 16)` for endTime (also adds the endTime that v1 deliberately omitted — bonus correctness).
  3. Compute startDate via `Intl.DateTimeFormat({ timeZone: routine.timezone, ... }).format(occurrenceDate)` (using the existing `formatLocalDate` pattern from the server endpoint) so the tile lands on the correct calendar day in routine.tz regardless of viewer browser tz.
  4. Fall back to occurrence-ISO time extraction in routine.timezone (via Intl) when `start_time` is null — handles the legacy "cadence-only" routine without intent-window.

E. RECOMMENDATION

- **Root cause:** `src/lib/hub/mapOperationsRoutines.ts:46-54` (`toLocalDateAndTime` + the loop body at `:64-72` that calls it). The mapper extracts the hour from the rrule-occurrence ISO via browser-local `getHours()` instead of reading `routine.start_time` directly, so the displayed time depends on (a) BYHOUR in the rrule (not start_time) and (b) the viewer's browser timezone. Neither matches the routines-page convention.
- **Fix approach:**
  1. **`mapOperationsRoutines.ts`:** use `routine.start_time.slice(11, 16)` for `startTime`; `routine.end_time.slice(11, 16)` for `endTime` (NEW — was omitted in v1). For `startDate`, convert the occurrence ISO to YYYY-MM-DD in `routine.timezone` via `Intl.DateTimeFormat` (matches the server's `formatLocalDate` helper at `/api/hub/operations-routines/route.ts:35-46` — extract that to a shared util, or duplicate the small function client-side). For routines with null `start_time` (cadence-only edge case), fall back to occurrence-ISO time extraction IN routine.timezone (still no browser-tz dependence).
  2. **`/api/hub/operations-routines/route.ts`** (likely no change required) — it already returns `start_time` and `end_time` per `RoutineWindowEntry`. Confirm during Phase 2.
  3. **No new shared util strictly required** — the routines page's `.slice(11, 16)` pattern is two lines, fine to inline. The routine-tz date extraction could reuse the existing `formatLocalDate` server helper if exported, or be reimplemented client-side (5 lines).
- **Schema change: NO** — confirmed. Pure mapping-logic fix.
- **Scope + files:**
  - **1 file modified:** `src/lib/hub/mapOperationsRoutines.ts` — change `toLocalDateAndTime` to take the routine context (for tz + start_time/end_time access), or restructure the mapping loop to read those directly. ~30 lines net.
  - Possibly 0 file changes to `/api/hub/operations-routines/route.ts` (it already returns the needed fields).
- **Open decisions for Alex:**
  1. **Confirm the design choice:** intent-window (`start_time/end_time`) as Hub display truth — same as the routines page. This is the recommended fix. Alternative would be to "fix" the routines page to match the Hub (use rrule BYHOUR-derived times), but that would lose the user-typed window display, which is more semantically meaningful. **Recommend the intent-window approach.**
  2. **What to do when `start_time` is null** (cadence-only routine with no intent window): two options — (a) skip the routine entirely on the Hub (omit from display), (b) use the rrule occurrence's hour-in-routine.tz as a fallback time. **Recommend (b)** — still useful display, still tz-correct (just uses routine.tz instead of browser.tz).
  3. **Should the same fix go to `mapOperationsBlocks.ts`?** That helper (PR-Ops-5.3) also uses `toLocalDateAndTime` for one-time scheduled task blocks (operations_calendar_blocks). Task blocks have `scheduled_start`/`scheduled_end` as full `timestamptz` (not `@db.Time`), so the equivalent question is: do task blocks suffer the same browser-tz bug? Likely yes for cross-tz viewers, but it's a separate concept (one-time scheduled commitments, not recurring routines). **Recommend NOT bundling** — fix routines first, audit blocks separately if needed.
  4. **Should this PR also fix the still-deferred `endTime` rendering** on the Hub for routines (PR-Ops-5.6 explicitly omitted it citing tz complexity)? With the intent-window fix, endTime becomes trivial — just `end_time.slice(11, 16)`. **Recommend YES, fold it in** — same one-line addition, restores the window display ("07:00 — 09:00").
  5. **A regression test would lock both fixes (5.7 sign + this) permanently.** Test infra still doesn't exist in the repo per PR-Ops-5.7 Phase 2. Recommend keeping the deferred-test posture from 5.7 and ship the fix alone; address test infra in a separate PR per Alex's prior call.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.8-hub-routine-time-phase-1.md (deviation from prompt path to avoid collision with the parallel `claude/pr-ops-5.8-editable-routines-audit` branch which targets `audit-reports/pr-ops-5.8-phase-1.md`).
