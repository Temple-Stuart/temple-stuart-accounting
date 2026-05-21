PR-OPS-5.7 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `90d70da` (merge #549 PR-Ops-5.6 audit) → `c5df8a2` (merge #548 5.6 wire) → `29f9804` (5.6 commit). 5.6 confirmed on main.
- current branch: `claude/pr-ops-5.7-routine-time-bug-audit`

A. WHERE EXPECTED/MISSED COMPUTED

- **`expected_at` is computed live (not stored)** in `/api/operations/routines/today/route.ts:136-146`:
  ```ts
  occurrences = expandBetween(r.schedule_rrule, r.timezone, start, end);
  const expectedAt = occurrences[0];          // ← THE expected time
  ```
  Where `expandBetween` is the shipped helper at `src/lib/operations/rruleHelpers.ts:161-170`.
- **`next_due_at` is computed at write time** by `expandForward` (`rruleHelpers.ts:143-153`) — called from:
  - `routines/route.ts:229` (POST create — initial next_due_at)
  - `routines/[id]/route.ts:271` (PATCH — recompute when rrule/tz/threshold changes)
  - The Inngest cron `src/inngest/functions/routine-evaluator.ts` (per the file header comment of rruleHelpers.ts:11-13)
- **"missed" determination** (`today/route.ts:158-169`):
  ```ts
  const failThresholdMs = r.fail_threshold_minutes * 60 * 1000;
  if (now.getTime() > expectedAt.getTime() + failThresholdMs) status = 'missed';
  else if (expectedAt.getTime() <= now.getTime()) status = 'pending';
  else status = 'upcoming';
  ```
- **Daily Plan render source:** `src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx:64` —
  ```tsx
  <span>expected: {formatTime(entry.expected_at, entry.routine.timezone)}</span>
  ```
  `entry.expected_at` is the ISO from `/today`. `formatTime` (`:15-26`) does `new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })` — formats the (already-shifted) ISO in the routine's timezone. **This component is innocent of the bug** — it just displays what the API hands it.
- **"window: 00:00–06:00" render** (`DailyPlanRoutineRow.tsx:65-79`) reads `entry.routine.start_time.slice(11,16)` / `end_time.slice(11,16)` directly. **No tz math — display is correct.**

B. EXPECTED-INSTANT DERIVATION

- **SLEEP routine schedule_rrule value:** `FREQ=DAILY;BYHOUR=<H>;BYMINUTE=<M>;BYSECOND=0` where `<H>/<M>` come from `form.byhour/form.byminute` at create time (`compileFormToRRule` in `rruleHelpers.ts:42-69`). **These are SEPARATE from `start_time`/`end_time`.** `start_time` and `end_time` are intent-window display only; they do NOT feed the rrule. So a routine created with `start_time=00:00, end_time=06:00, byhour=0, byminute=0` stores `schedule_rrule = "FREQ=DAILY;BYHOUR=0;BYMINUTE=0;BYSECOND=0"`. (If Alex didn't touch byhour, it would default to `08` per `DEFAULT_ROUTINE_FORM` — but for the SLEEP routine to display 16:00 with the bug below, BYHOUR=0 matches Alex's likely intent of "fire at midnight".)
- **Where 16:00 comes from — the timezone math:** `shiftFloatingToZone(floatingDate, timezone)` at `rruleHelpers.ts:184-188`:
  ```ts
  function shiftFloatingToZone(floatingDate: Date, timezone: string): Date {
    const utcMs = floatingDate.getTime();
    const offset = getTimezoneOffsetMs(floatingDate, timezone);
    return new Date(utcMs + offset);                // ← line 187
  }
  ```
  And `getTimezoneOffsetMs` at `rruleHelpers.ts:196-218`:
  ```ts
  function getTimezoneOffsetMs(instant: Date, timezone: string): number {
    // ... formats instant in target tz, builds tzAsUtc from the wall-clock parts ...
    return tzAsUtc - instant.getTime();             // ← line 217
  }
  ```
- **TZ transformation (exact math, with bug):**

  For SLEEP (BYHOUR=0) on May 21, 2026, timezone `America/New_York` (UTC-4 EDT) — the case that produces the reported 16:00 display:
  - `rrule.between(start=May 21 04:00Z, end=May 22 04:00Z, inclusive=true)` returns `[May 22 00:00:00Z]` (the BYHOUR=0 daily occurrence — floating-time interpreted as UTC).
  - `shiftFloatingToZone(May 22 00:00:00Z, 'America/New_York')`:
    - `utcMs = May 22 00:00:00Z`.
    - `Intl.DateTimeFormat` formats `May 22 00:00 UTC` in NY → `May 21 20:00 EDT`. So `parts.hour = 20`.
    - `tzAsUtc = Date.UTC(2026, 4, 21, 20, 0, 0) = May 21 20:00:00Z`.
    - `offset = tzAsUtc - instant.getTime() = (May 21 20:00Z) - (May 22 00:00Z) = -14_400_000 ms = **-4 hours**`.
    - **Return: `new Date(May 22 00:00Z + (-4h)) = May 21 20:00:00Z`.**
  - So `expectedAt = May 21 20:00:00Z`.
  - `formatTime(May 21 20:00Z, 'America/New_York')` = `May 21 16:00 EDT`. **= "16:00" — Alex's reported value.**

C. MIDNIGHT-CROSSING

- **00:00–06:00 treated as: same-day, NOT midnight-crossing.** The schema stores `start_time` and `end_time` as independent `@db.Time(6)` columns; the today endpoint, the rrule expansion, and the display row all treat them as same-day wall-clock bounds. There is NO branch in any file that interprets `start < end` differently from `start > end` (`grep` for `crossing\|midnight\|crosses` in routines code returns zero hits). The 00:00 start is just a normal early-morning window.
- **00:00 treated as falsy anywhere: NO.** The PRIME SUSPECT theory (00:00 being treated as falsy by a `||` fallback that injects a default time) is **FALSE**. The relevant checks all use explicit `=== null` or `if (r.start_time)` where the truthy test is against the @db.Time-serialized string `"1970-01-01T00:00:00.000Z"` (truthy as a non-empty string), not the wall-clock value. `formatTime(iso, tz)` uses `new Date(iso).toLocaleTimeString(...)`; `00:00` is not falsy in that path. The bug is unrelated to midnight as a special value.

D. MISSED LOGIC

- **`missed` condition** (today/route.ts:163): `now > expectedAt + fail_threshold_ms` AND no completion row.
- **Why a brand-new indefinite routine shows "missed":** the buggy `shiftFloatingToZone` returns an `expectedAt` that is **already in the past** relative to `now`. For the SLEEP case above, `expectedAt = May 21 20:00:00Z`. If "now" is anytime after May 21 20:00 UTC + `fail_threshold_minutes` (which defaults to 0 or whatever Alex set), `status = 'missed'`. The user sees "missed" the moment they look at the routine, because the buggy expected time is already past — even though the user just created the routine.

E. ROOT CAUSE + FIX

- **ROOT CAUSE: sign inversion in `getTimezoneOffsetMs` at `src/lib/operations/rruleHelpers.ts:217`.**

  The function's docstring (lines 190-194) states the intended semantic:
  > "Get the offset in milliseconds between UTC and the named timezone at the given instant. **Positive when the timezone is BEHIND UTC** (e.g., America/Los_Angeles is UTC-8 standard or UTC-7 DST → offset is **+28800000 or +25200000 ms**)."

  But the implementation at line 217 returns `tzAsUtc - instant.getTime()`. For LA at May 8 08:00 UTC: that's `(May 8 01:00Z) - (May 8 08:00Z) = -25_200_000 ms`. **The docstring says positive; the implementation returns negative.** The sign is inverted.

  Then `shiftFloatingToZone:187` does `utcMs + offset`. With the wrong-signed offset, the time shifts in the OPPOSITE direction of what the docstring (and `shiftFloatingToZone`'s own docstring at lines 175-181) describes. The function's `shiftFloatingToZone` docstring says:
  > "rrule returns 2026-05-08T08:00:00.000Z for BYHOUR=8 (UTC). If the routine's timezone is 'America/Los_Angeles', we want the actual instant when LA wall-clock reads 08:00 — **which is 2026-05-08T15:00:00.000Z in May (PDT, UTC-7)**."

  Expected: input `May 8 08:00Z` → output `May 8 15:00Z` (delta +7h). **Actual: returns `May 8 01:00Z` (delta -7h).** Every routine occurrence is shifted by **2× the tz offset in the wrong direction**.

- **Minimal fix (one line):** `src/lib/operations/rruleHelpers.ts:217` change from `return tzAsUtc - instant.getTime();` to `return instant.getTime() - tzAsUtc;`. This makes `getTimezoneOffsetMs` return the positive value its docstring promises for behind-UTC zones, and `shiftFloatingToZone`'s `utcMs + offset` then computes the correct UTC instant.

  Equivalently, line 187 could change from `new Date(utcMs + offset)` to `new Date(utcMs - offset)` and leave line 217 alone. Either flip restores correctness. The line-217 fix is the more semantically correct one (the docstring at lines 191-194 explicitly states the intended positive-for-behind-UTC sign).

- **Pure logic (no schema):** **YES.** No schema change. No migration. No data fix at the DB level — `next_due_at` values in the DB are currently wrong but will be **automatically recomputed correctly** the next time the cron evaluator runs (or the next PATCH on each routine). A one-time "rebuild next_due_at for all routines" admin script is a nice-to-have but not strictly required; the cron self-heals.

- **Other affected routines: ALL of them.** Every active routine's expected/next_due is wrong by 2× the routine's timezone offset. The bug is invisible for users in UTC timezone (where the offset is 0, so `2 × 0 = 0`) but breaks for everyone else:
  - UTC-7 PDT (LA): displayed time is 14 hours wrong (BYHOUR=8 should show 08:00, currently shows 18:00 the previous day).
  - UTC-4 EDT (NY): 8 hours wrong (BYHOUR=0 should show 00:00, currently shows 16:00 the previous day — Alex's case).
  - UTC+8 (Singapore/etc.): 16 hours wrong in the opposite direction.

  The bug has shipped since `rruleHelpers.ts` was written but didn't surface widely because routine usage was low. Alex (User #1) hit it because (a) his time window was 00:00–06:00, which puts the buggy display visibly outside the intent window, and (b) the buggy expected time lands in the past, triggering the "missed" status immediately on creation.

- **Side effects of the fix:** every consumer of `expandForward`/`expandBetween` immediately returns correctly-shifted instants:
  - `/api/operations/routines/today` (display)
  - `/api/operations/routines/[id]/upcoming` (forward window display)
  - `/api/operations/routines/[id]/completions` (validates the next occurrence — also used downstream for status updates)
  - `/api/operations/routines` POST (initial `next_due_at` write)
  - `/api/operations/routines/[id]` PATCH (recompute when rrule/tz/threshold changes)
  - `/api/hub/operations-routines` (PR-Ops-5.6 — Hub calendar wire)
  - `src/inngest/functions/routine-evaluator.ts` (cron — backward miss evaluation)
  - `RoutineRow.tsx` / `TodaysStrip.tsx` displays (consume the API output).

  All start showing correct times. `next_due_at` rows already stored will be **stale until** (a) the cron runs and re-evaluates, or (b) a PATCH fires recomputation. Neither is a blocker — the read path (today/upcoming/Hub) is live-computed via expandBetween/expandForward, so the user-facing display becomes correct immediately on deploy.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.7-phase-1.md.
