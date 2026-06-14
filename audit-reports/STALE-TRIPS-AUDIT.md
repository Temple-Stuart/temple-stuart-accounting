# STALE-TRIPS AUDIT — old trips on the master calendar

**Type:** Audit — READ ONLY. Nothing modified or deleted.
**Symptom:** Logged-in, the master calendar shows OLD trips from a trips module the
user believes was deleted.
**Goal:** Trace exactly where these trip events live and how they reach the calendar,
so a cleanup can be scoped safely — **no deletion in this PR**.

All citations are repo `file:line` / `prisma/schema.prisma` line numbers. (The live
DB can't be queried from here — `DATABASE_URL` isn't set — so §3 gives Alex the exact
diagnostic + scoped, unexecuted cleanup, conditional on what it returns.)

---

## TL;DR

- Calendar trip events are **rows in the `calendar_events` table** with
  `source = 'trip'` and `source_id = <tripId>` — **not** read from the `trips` table
  directly.
- `calendar_events.source_id` is a **plain string, NOT a foreign key** to `trips`
  (`schema.prisma:1328`; no relation). So deleting a trip does **not** auto-remove its
  calendar rows.
- The app's own `DELETE /api/trips/[id]` **does** clean them up
  (`route.ts:137`). So the stale rows mean the trips were removed by a path that
  **bypassed that cleanup** (direct `trips` delete / raw SQL / "module removed" without
  data migration) → **orphaned `calendar_events` rows survive** and the calendar still
  shows them.
- **Safest fix = delete the orphaned `calendar_events` (source='trip') rows.** That
  table has **no dependents** (nothing FKs to `calendar_events`), so removing those
  rows orphans nothing. A feed-filter is a secondary guard. Diagnose first (§3).

---

## 1. THE CALENDAR'S TRIP LAYER — exact path

**UI → API → table:**
1. `HubCalendar.loadCalendar()` fetches `GET /api/calendar?year=&month=`
   (`src/components/hub/HubCalendar.tsx:96`) and keeps only `source === 'trip'`
   client-side (`HubCalendar.tsx:100`).
2. `GET /api/calendar` runs a raw query against **one table**:
   ```sql
   SELECT * FROM calendar_events
   WHERE user_id = ${user.id}
     AND start_date >= ... AND start_date < ...   -- date window only
   ```
   (`src/app/api/calendar/route.ts:29-35`, year branch `:40-46`). **No status filter,
   no join to `trips`.** It returns every `calendar_events` row for the user in the
   month; the `tripTotal`/`tripCount` summary just counts `source==='trip'` (`:59`).
3. So **the trip tiles = `calendar_events` rows where `source='trip'`** for that user.

**The table holding them:** `calendar_events` (`schema.prisma:1324-1350`):
`source VARCHAR(20)` (`:1327`), `source_id String?` (`:1328`), `user_id String?`
(`:1326`), `start_date`/`end_date` (`:1334-1335`), `budget_amount Int?` (`:1342`),
`status String? @default("committed")` (`:1343`). Its **only** relation is `users`
(`:1346`) — there is **no relation to `trips`**.

**Who writes those rows** (`source='trip'`, `source_id = tripId`):
- `POST /api/trips/[id]/commit` — `DELETE FROM calendar_events WHERE source='trip' AND
  source_id::text = ${id}` then `INSERT INTO calendar_events (... source, source_id
  ...)` (`src/app/api/trips/[id]/commit/route.ts:182,187-188`).
- Also `…/vendor-commit/route.ts` and `…/hub/nomad-budget/route.ts` write
  `source:'trip'` rows (grep). All key the row to a trip via `source_id`.

So a trip's calendar tiles are created at **commit time** and stamped with the trip's
id in `source_id`.

---

## 2. THE "DELETED" MODULE vs WHAT REMAINS

**The trips module is NOT gone from the schema or the API.** A full ecosystem exists
(`schema.prisma`): `trips` (`:515`), `trip_participants` (`:565`), `trip_expenses`
(`:602`), `trip_itinerary` (`:645`), `trip_destinations` (`:711`), `reservations`
(`:1153`), `trip_lodging_options` (`:1754`), `trip_transfer_options` (`:1778`),
`trip_vehicle_options` (`:1801`), `trip_activity_expenses` (`:1824`),
`trip_scanner_results` (`:1848`) — plus live routes under `src/app/api/trips/**`.

So "deleted module" most plausibly means the **UI/navigation was removed**, or some
trip **rows** were deleted, while the **tables, routes, and any committed
`calendar_events` rows remain**.

**Which store still holds the old trips that show on the calendar:** **`calendar_events`**
(source='trip'), independent of whether the parent `trips` row still exists —
because there is no FK/cascade between them (`:1328`).

**`trips.status`** exists (`String @default("planning")`, `:530`) — values seen:
"planning"/committed — but `calendar_events` does **not** carry the trip's status, and
`/api/calendar` never checks it. So even an archived/cancelled trip's already-committed
calendar rows keep showing.

**Current vs stale, how to tell:** a `calendar_events` trip row is **stale/orphaned**
when its `source_id` matches **no** row in `trips`. CURRENT trips have a matching
`trips` row. The Bali trip in question — `source_id = 'cmq3adbzk000hbweimtv233z1'`:
its calendar rows are `calendar_events WHERE source='trip' AND source_id::text =
'cmq3adbzk000hbweimtv233z1'`; they are stale **iff** no `trips` row with that id
remains (confirm via §3).

**Is the calendar reading a current or an old store?** It reads the **current**
`calendar_events` table — but that table can contain **orphaned** trip rows that the
proper delete path would have removed. The bug is orphaned rows, not a wrong table.

---

## 3. WHAT "DELETING" WOULD MEAN (scope only — DO NOT RUN)

### 3a. The proper delete path already cleans calendar rows
`DELETE /api/trips/[id]` (`src/app/api/trips/[id]/route.ts:91`) deletes, in order:
`expense_splits` (`:121`), `trip_expenses` (`:124`), `trip_itinerary` (`:127`),
`trip_destinations` (`:130`), `budget_line_items` (`:134`), **`calendar_events` where
source='trip' AND source_id = id (`:137`)**, `trip_participants` (`:138`), then
`trips.delete` (`:141`). **A trip removed through this route leaves NO calendar rows.**
The stale tiles therefore came from a deletion that **bypassed `:137`.**

### 3b. Diagnostic FIRST (Alex runs read-only)
Find orphaned trip calendar rows (the likely culprit):
```sql
SELECT ce.id, ce.title, ce.start_date, ce.source_id
FROM calendar_events ce
LEFT JOIN trips t ON t.id = ce.source_id          -- source_id holds the cuid as text
WHERE ce.source = 'trip'
  AND ce.user_id = '<USER_ID>'
  AND t.id IS NULL;                                -- no parent trip → orphaned
```
And to inspect the specific Bali rows:
```sql
SELECT * FROM calendar_events
WHERE source='trip' AND source_id::text = 'cmq3adbzk000hbweimtv233z1';
SELECT id, name, status FROM trips WHERE id = 'cmq3adbzk000hbweimtv233z1';
```

### 3c. Scoped cleanup (ONLY after the diagnostic — Alex runs, with approval)
- **If orphaned** (no parent trip): delete just the orphans —
  ```sql
  DELETE FROM calendar_events ce
  WHERE ce.source='trip' AND ce.user_id='<USER_ID>'
    AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.id = ce.source_id);
  ```
  or target the exact `source_id` if only the Bali trip is involved.
- **If the trip still exists but should be gone:** delete it through
  `DELETE /api/trips/[id]` (which also clears its calendar rows at `:137`) rather than
  hand-deleting the trip row.

### 3d. RISK / dependencies
- **Deleting the `calendar_events` rows is structurally SAFE:** nothing FKs to
  `calendar_events` (only `users → calendar_events`, `:1346`); no table depends on it.
  Removing stale trip rows orphans nothing. The only caution is **scope** — restrict
  to `source='trip'` + the user + orphaned `source_id`, so live trips' events aren't
  touched.
- **Deleting `trips` rows is the heavy operation** (NOT needed for the calendar fix):
  `trips` has many dependents (`schema.prisma:547-558`) — `trip_participants`,
  `trip_expenses`, `trip_itinerary`, `trip_destinations`, `trip_lodging/transfer/
  vehicle_options`, `trip_activity_expenses`, `trip_scanner_results`, `reservations`,
  and **`budget_line_items.tripId → trips` (`onDelete: SetNull`, `:1054`)**. Hand-
  deleting a trip without the route's ordered cleanup can orphan budgets/reservations.
- **Related, out of calendar scope:** `budget_line_items` rows with `source='trip'`
  (`commit/route.ts:112-123`) may ALSO be orphaned for a bypassed deletion
  (`tripId` SetNull on trip delete, `:1054`) — so the user may also see stale trip
  budgets. Flag for a separate pass; don't bundle into the calendar fix.

### 3e. Cleanup vs feed-filter — which fix
- **Primary: data cleanup (3c).** The orphaned rows should never have survived; the
  proper delete path removes them. This directly fixes the calendar.
- **Secondary guard: feed filter.** `/api/calendar` could exclude trip rows whose
  parent trip is missing (LEFT JOIN trips, drop where null) — a cheap safety net so a
  future bypass-deletion doesn't resurface on the calendar. Recommended as a follow-up,
  not a substitute for the cleanup.
- A **status filter** alone won't help if the trip row is gone (no status to read) —
  it only helps the "archived but still present" case.

---

## REPORT SUMMARY

- **Where they live:** the `calendar_events` table — rows with `source='trip'`,
  `source_id = <tripId>`, written at trip commit (`commit/route.ts:182-188`), read
  wholesale by `/api/calendar` (`route.ts:29-46`) and shown by HubCalendar
  (`:96,100`). Not read from `trips`.
- **Why old trips still show:** `calendar_events.source_id` is not a FK to `trips`
  (`schema.prisma:1328`), so a trip deleted **outside** `DELETE /api/trips/[id]`
  (which would have cleared them at `:137`) leaves **orphaned** trip rows behind.
- **Right fix:** **(a) data cleanup** of the orphaned `calendar_events` trip rows
  (scoped by user + `source='trip'` + no matching `trips` row) — SAFE, no dependents;
  optionally **(b) add a feed filter** as a guard. Diagnose with §3b first.
- **Dependencies to respect:** none point at `calendar_events` (safe to prune). The
  `trips` table itself has many dependents (`schema.prisma:547-558`, incl.
  `budget_line_items` SetNull `:1054`) — only relevant if/when deleting trips, which
  the calendar fix does NOT require.
- **Do NOT delete/modify anything** — this is the map + plan; Alex runs the scoped SQL
  after approval.

---

## Citations index
- Calendar feed: `src/components/hub/HubCalendar.tsx:96,100`;
  `src/app/api/calendar/route.ts:29-46,59`.
- `calendar_events` model (no trips FK): `prisma/schema.prisma:1324-1350` (source_id
  `:1328`, users-only relation `:1346`, status `:1343`).
- Trip → calendar writers: `src/app/api/trips/[id]/commit/route.ts:182,187-188`;
  `…/vendor-commit/route.ts`; `…/hub/nomad-budget/route.ts`.
- Proper delete (clears calendar rows): `src/app/api/trips/[id]/route.ts:91,137,141`.
- Trips ecosystem + dependents: `prisma/schema.prisma:515-563` (status `:530`,
  relations `:547-558`); `budget_line_items.tripId` SetNull `:1054`.
