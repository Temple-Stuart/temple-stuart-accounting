# Calendar Data Audit — stale trip events + new commits not showing

**Scope:** read-only code audit + **psql queries for Alex** (CC can't reach the Azure DB).
Two symptoms: (1) old/stale trip events linger on the home calendar; (2) newly saved
flights/hotels don't appear (or appear wrong). **No code changed.**

**Headline (the root causes):**
1. **Stale events = orphaned `calendar_events`.** Trip delete cleans `calendar_events` with
   `source_id = '<tripId>'`, but **flights/hotels (vendor-commit) write
   `source_id = 'trip:<tripId>:vendor:<optionId>'`** — a different shape the delete query
   **never matches**, so per-item events are left behind forever
   (`trips/[id]/route.ts:137` vs `vendor-commit/route.ts:337`).
2. **New commits not showing has 3 contributors:** (a) the calendar INSERT is wrapped in a
   **non-fatal try/catch** (`vendor-commit:350-356`) — if it throws, budget+itinerary exist
   but no calendar row; (b) the feed shows **only the viewed month** (`calendar/route.ts:29-46`),
   so a July trip won't show in the default June view; (c) **ledger time-edits update
   `trip_itinerary` but NOT `calendar_events`** (`itinerary/[itineraryId]/route.ts` touches
   no calendar row) — so an edited hotel shows its OLD date/time on the calendar.

---

## 1. What the calendar reads

`HubCalendar` fetches `/api/calendar?year=&month=` for the **viewed** month
(`HubCalendar.tsx:108`, default = current month `:95-96`). That route reads **only
`calendar_events`**, scoped to **`user_id` + `start_date` within the month** — and **nothing
else**:

```
SELECT * FROM calendar_events
WHERE user_id = <user> AND start_date >= <monthStart>::date AND start_date < <monthEnd>::date
```
(`src/app/api/calendar/route.ts:29-46`)

**Key facts:**
- It does **NOT** read `trip_itinerary` or `budget_line_items` — only `calendar_events`.
- There is **no trip filter** and **no orphan/existence check** — every `calendar_events` row
  for the user in that month shows, even if its trip/item was deleted.
- `calendar_events` has **no `tripId` column** — only `source_id` (a string) +
  `user_id` (`prisma/schema.prisma:1325-1352`). Trip linkage is by the `source_id` convention
  only.

So a saved flight/hotel reaches the calendar **only** by a `calendar_events` row being
inserted at commit time. If that insert didn't happen (or the row was orphaned/edited away),
the calendar is wrong.

## 2. Where new commits land (and the mismatch)

`POST /api/trips/[id]/vendor-commit` (the Save-to-trip path) writes **three** places:
- `budget_line_items` (the budget row, `source:'trip'`) — `vendor-commit:228-237`
- `trip_itinerary` (dates/times/vendor) — `:251-308`
- `calendar_events` via raw SQL, **`source_id = 'trip:<tripId>:vendor:<optionId>'`**,
  `start_date = <commit start>` — `:337, 351-352`, inside a **non-fatal try/catch** (`:350-356`).

The **older** `POST /api/trips/[id]/commit` (bulk "commit whole trip") writes ONE
`calendar_events` row with **`source_id = '<tripId>'`** (`commit/route.ts:187-191`).

**So two source_id shapes exist:** `'<tripId>'` (bulk commit) and
`'trip:<tripId>:vendor:<optionId>'` (per-item flights/hotels).

**The delete mismatch (stale-events cause):** trip delete runs
`DELETE FROM calendar_events WHERE source='trip' AND source_id::text = '<tripId>'`
(`trips/[id]/route.ts:137`). That matches the bulk shape **only** — it **misses every
per-item vendor-commit row** (`'trip:<tripId>:vendor:...'`). The single-item uncommit DOES
match (`vendor-commit:450-452` uses the full source_id), so removing one item cleans its
event — but **deleting the whole trip orphans all its flight/hotel events.**

---

## 3. psql queries for Alex

> IDs in use: user `cmfi3rcrl0000zcj0ajbj4za5`, old trip
> `cmq3adbzk000hbweimtv233z1`. **Quoting note:** `calendar_events` columns are snake_case
> (unquoted); `trips` / `trip_itinerary` / `budget_line_items` columns are **camelCase** and
> need **double quotes** (`"userId"`, `"tripId"`, `"homeDate"`, …).

### Q0 — find all the user's trips (incl. the new "Digital Nomad Tour")
```sql
SELECT id, name, destination, "startDate", "endDate", "createdAt"
FROM trips
WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
ORDER BY "createdAt" DESC;
```

### Q1 — all calendar_events for the user (old vs new by created_at; which have times; linkage)
```sql
SELECT id, title, source, source_id, start_date, end_date,
       start_time, end_time, is_recurring, budget_amount, created_at
FROM calendar_events
WHERE user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
ORDER BY created_at DESC;
```

### Q2 — trip_itinerary for a trip (dates/times/vendor/linkage) — run per trip id from Q0
```sql
SELECT id, "tripId", day, "homeDate", "homeTime", "destDate", "destTime",
       recurrence, block_start_time, block_end_time, category, vendor,
       "vendorOptionId", "vendorOptionType", "createdAt"
FROM trip_itinerary
WHERE "tripId" = 'cmq3adbzk000hbweimtv233z1'
ORDER BY "createdAt" DESC;
```

### Q3 — budget_line_items for a trip
```sql
SELECT id, "itineraryId", "coaCode", amount, description, source, "createdAt"
FROM budget_line_items
WHERE "tripId" = 'cmq3adbzk000hbweimtv233z1'
ORDER BY "createdAt" DESC;
```

### Q4 — ORPHAN CHECK: trip calendar_events whose owning trip no longer exists (the stale rows)
```sql
SELECT ce.id, ce.title, ce.source_id, ce.start_date, ce.created_at,
       CASE WHEN ce.source_id LIKE 'trip:%' THEN split_part(ce.source_id, ':', 2)
            ELSE ce.source_id END AS owning_trip_id
FROM calendar_events ce
WHERE ce.user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
  AND ce.source = 'trip'
  AND (CASE WHEN ce.source_id LIKE 'trip:%' THEN split_part(ce.source_id, ':', 2)
            ELSE ce.source_id END)
      NOT IN (SELECT id FROM trips WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5')
ORDER BY ce.created_at DESC;
```
Rows here = **stale events that should have been deleted** (trip gone, event left behind).

### Q5 — the events the trip-delete query MISSES for a specific old trip (per-item shape)
```sql
SELECT id, title, source_id, start_date, start_time, end_time, created_at
FROM calendar_events
WHERE user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
  AND source = 'trip'
  AND source_id LIKE 'trip:cmq3adbzk000hbweimtv233z1:%'
ORDER BY created_at DESC;
```

### Q6 — NOT-MAPPING CHECK: committed itinerary rows with NO matching calendar_event
(new flights/hotels in budget+itinerary but the calendar INSERT failed)
```sql
SELECT ti.id AS itinerary_id, ti."tripId", ti.vendor, ti."homeDate",
       ti."vendorOptionId", ti."createdAt"
FROM trip_itinerary ti
WHERE ti."tripId" IN (SELECT id FROM trips WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5')
  AND ti."vendorOptionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce
    WHERE ce.source = 'trip'
      AND ce.source_id = 'trip:' || ti."tripId" || ':vendor:' || ti."vendorOptionId"
  )
ORDER BY ti."createdAt" DESC;
```
Rows here = commits whose **calendar INSERT didn't land** (non-fatal failure) → not on calendar.

### Q7 — EDIT-DRIFT CHECK: itinerary edited in the ledger but calendar_events left stale
```sql
SELECT ti.id, ti."tripId", ti.vendor,
       ti."homeDate"::date AS itin_start, ce.start_date AS cal_start,
       ti."homeTime"       AS itin_starttime,
       to_char(ce.start_time,'HH24:MI') AS cal_starttime,
       ti."destDate"::date AS itin_end, ce.end_date AS cal_end
FROM trip_itinerary ti
JOIN calendar_events ce
  ON ce.source = 'trip'
 AND ce.source_id = 'trip:' || ti."tripId" || ':vendor:' || ti."vendorOptionId"
WHERE ti."tripId" IN (SELECT id FROM trips WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5')
  AND (ti."homeDate"::date <> ce.start_date
       OR COALESCE(ti."homeTime",'') <> COALESCE(to_char(ce.start_time,'HH24:MI'),''));
```
Rows here = the calendar shows the **old** date/time because a ledger edit updated only
`trip_itinerary`.

---

## 4. Root cause + fix map

### Likely causes (which the queries confirm)
- **(a) Stale = orphaned calendar_events** — **CONFIRMED in code**: trip delete's source_id
  pattern (`= '<tripId>'`, `route.ts:137`) doesn't match per-item rows
  (`'trip:<tripId>:vendor:...'`). Q4/Q5 list them.
- **(d) Multiple-trips** is a *symptom* of (a): events from the old `cmq3adbzk` trip linger
  (orphaned) while the user uses the new "Digital Nomad Tour" trip. The feed has no trip
  filter, so old + new both show — old ones never got cleaned.
- **(b) New ones not showing** — Q6 shows any commit whose **non-fatal calendar INSERT
  failed**; the **month view** (`calendar/route.ts:23-35`) hides events outside the viewed
  month; and Q7 shows **edit-drift** (calendar not updated on ledger edit).
- **(c) trip-id/date filter** — the feed filters by **month only, not trip**, so it's not a
  trip-id filter bug; it's the orphan + month-window + INSERT-failure combination.

### Cleanup (safe, SELECT-first — Alex runs)
**⚠️ DESTRUCTIVE — run the SELECT (Q4) first, eyeball it, then DELETE inside a transaction.**
```sql
BEGIN;
-- 1) Preview exactly what will be deleted (same predicate as the DELETE):
SELECT ce.id, ce.title, ce.source_id, ce.start_date
FROM calendar_events ce
WHERE ce.user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
  AND ce.source = 'trip'
  AND (CASE WHEN ce.source_id LIKE 'trip:%' THEN split_part(ce.source_id, ':', 2)
            ELSE ce.source_id END)
      NOT IN (SELECT id FROM trips WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5');

-- 2) If the rows look right, delete them:
DELETE FROM calendar_events ce
WHERE ce.user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
  AND ce.source = 'trip'
  AND (CASE WHEN ce.source_id LIKE 'trip:%' THEN split_part(ce.source_id, ':', 2)
            ELSE ce.source_id END)
      NOT IN (SELECT id FROM trips WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5');

-- 3) COMMIT; if the preview/delete count looks wrong, ROLLBACK;
COMMIT;
```
*(Targeted alternative if a specific old trip is known-deleted:
`... AND source_id LIKE 'trip:cmq3adbzk000hbweimtv233z1:%'`.)*

### Code fixes (atomic PRs — separate from the data cleanup)
1. **PR-Trip-Delete-Calendar-Cleanup** *(the real bug)* — fix `trips/[id]/route.ts:137` to
   also remove per-item rows: delete `source = 'trip' AND (source_id = id OR source_id LIKE
   'trip:' || id || ':%')`. Prevents future orphans.
2. **PR-Ledger-Edit-Calendar-Sync** — when the itinerary PATCH
   (`itinerary/[itineraryId]/route.ts`) changes dates/times, **also update the matching
   `calendar_events`** (`source_id = 'trip:'||tripId||':vendor:'||vendorOptionId`) so the
   calendar reflects the edit (fixes Q7 drift).
3. **PR-Commit-Calendar-Fail-Loud (optional)** — the calendar INSERT is non-fatal
   (`vendor-commit:350-356`); at minimum log/surface failures so a commit that didn't reach
   the calendar isn't silent (fixes the Q6 silent gap).
4. **(Product note, not a bug)** the month-only feed means events show only in their month —
   navigate the calendar to the trip's month. A future "jump to trip" affordance could help.

### Migration?
**None.** All fixes are query/scope/sync, not schema. (A `tripId` column on
`calendar_events` would make trip-scoped cleanup trivial, but that's optional and a separate
migration — the `source_id LIKE` predicate works today.)

---

### Citation index
- Calendar feed (calendar_events only, user+month, no trip filter):
  `src/app/api/calendar/route.ts:29-46`
- `calendar_events` schema (source_id string, no tripId): `prisma/schema.prisma:1325-1352`
- vendor-commit writes (budget/itinerary/calendar; per-item source_id; non-fatal insert):
  `src/app/api/trips/[id]/vendor-commit/route.ts:228-237, 251-308, 337, 350-356`; uncommit
  delete `:450-452`
- Bulk commit source_id `'<tripId>'`: `src/app/api/trips/[id]/commit/route.ts:187-191`
- **Trip delete mismatch (stale-events bug):** `src/app/api/trips/[id]/route.ts:127, 134, 137`
- Ledger edit does not touch calendar_events: `src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts`
- HubCalendar fetch per month: `src/components/hub/HubCalendar.tsx:95-96, 108`
