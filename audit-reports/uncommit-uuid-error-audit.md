# Uncommit Invalid-UUID Error — Trace Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-uncommit-uuid-error`
**Scope:** Read-only. No application code modified. Only this report was created.
**Method:** Every claim cites `file:line`. Anything not read is marked **NOT VERIFIED**.

> **Bottom line:** The value passed to `trip_activity_expenses.update({ where: { id } })` is
> `trip_itinerary.vendorOptionId`, which for **synthetic detail-page commits** (Google places via
> `PlaceCommitForm`, hotels via `AddToTripButton`) was deliberately written as a **non-UUID
> placeholder** — `place-{category}-{timestamp}` / `hotel-{...}-{timestamp}`. The commit POST
> **skips** the option-row status update for synthetic commits (no row exists); the uncommit DELETE
> has **no symmetric synthetic guard**, so it feeds the `place-…` string into a `@db.Uuid` primary-key
> lookup → Postgres "Error creating UUID … found `p` at 1". Verdict: **(b)** wrong-format value stored
> at commit time + a missing synthetic branch in the uncommit handler. **Not (c)** — the id columns are
> genuinely UUID; synthetic commits simply never created a row.

---

## A. SCHEMA FACTS

**`trip_activity_expenses`** (`prisma/schema.prisma:1769-1791`):
- `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` (`:1770`) — **Postgres UUID-typed PK**. A non-UUID string passed to `where: { id }` throws at the DB driver.
- `trip_id String` (`:1771`), `category` (`:1772`), `title?` (`:1773`), `vendor?` (`:1774`), `url?` (`:1775`), `image_url? @db.Text` (`:1776`), `price? Decimal` (`:1777`), `is_per_person` (`:1778`), `per_person?` (`:1779`), `notes?` (`:1780`), `votes_up/down` (`:1781-1782`), `is_selected Boolean` (`:1783`), `status VendorOptionStatus` (`:1784`), `created_at/updated_at` (`:1785-1786`).
- FK: `trip trips @relation(fields: [trip_id], references: [id], onDelete: Cascade)` (`:1788`). **No relation to `trip_itinerary`.**

**`trip_itinerary`** (`prisma/schema.prisma:641-667`):
- `id String @id @default(cuid())` (`:642`) — **cuid**, not UUID.
- `vendorOptionId String? @db.VarChar(100)` (`:659`) — **free-text VarChar**, the column that stores whatever option id the commit passed (a real UUID, OR a synthetic `place-…`/`hotel-…` placeholder).
- `vendorOptionType String? @db.VarChar(20)` (`:660`) — e.g. `'activity'`, `'lodging'`.
- No FK between `trip_itinerary` and the option tables (`:663` relates only to `trips`); `vendorOptionId` is a soft, untyped link.

**Sibling option tables (all UUID PKs):** `trip_lodging_options.id @db.Uuid` (`:1700`), `trip_transfer_options.id @db.Uuid` (`:1724`), `trip_vehicle_options.id @db.Uuid` (`:1747`). → every option table the uncommit can touch is UUID-keyed.

---

## B. UNCOMMIT TRACE (UI → API → failing `.update()`)

1. **UI button:** the agenda/calendar item's remove action calls `handleUncommitItem(evt._vendorOptionId, evt._vendorOptionType || 'activity')` — `src/app/budgets/trips/[id]/page.tsx:1242`.
2. **Event field provenance:** `_vendorOptionId: item.vendorOptionId` where `item` is a `trip.itinerary` row (`page.tsx:472`, in the itinerary→`CalendarEvent` transform `:430-474`). So the value is **`trip_itinerary.vendorOptionId`** verbatim.
3. **Handler:** `handleUncommitItem(vendorOptionId, vendorOptionType)` (`page.tsx:381`) → `DELETE /api/trips/${id}/vendor-commit` with body `{ optionType: vendorOptionType, optionId: vendorOptionId }` (`:384-388`); errors surface via `alert(...)` (`:392`) — matches the reported browser alert.
4. **API DELETE:** `vendor-commit/route.ts:311`. Parses `{ optionType, optionId }` (`:321`). Inside the transaction:
   - `if (optionType !== 'flight') { await setOptionStatus(tx, optionType, optionId, 'proposed', false); }` (`:329-331`).
5. **Failing call:** `setOptionStatus` → `case 'activity': await tx.trip_activity_expenses.update({ where: { id: optionId }, data: {...} })` (`vendor-commit/route.ts:68-69`). `optionId` = `trip_itinerary.vendorOptionId` = `place-{category}-{timestamp}` → `@db.Uuid` parse fails. **This is the `prisma.trip_activity_expenses.update()` invocation in the error.**
   - (`getOptionDetails` → `trip_activity_expenses.findFirst({ where: { id: optionId } })` `:42` would also fail, but it runs later `:345`; the transaction already aborted at `setOptionStatus` `:330`.)

**What value is passed as the update's where-id:** `trip_itinerary.vendorOptionId` (`page.tsx:472` → `:387` → `vendor-commit/route.ts:321,330,69`). The UI gets it from the fetched itinerary entry's `vendorOptionId` field.

---

## C. ID PROVENANCE — verdict (a)/(b)/(c)

**Where the bad value was written at commit time:**
- Synthetic Google-place commit (`PlaceCommitForm`): POST body `optionType:'activity', synthetic:true, optionId: \`place-${category}-${Date.now()}\`, notes: placeName` (`PlaceCommitForm.tsx:49-58`). `placeName` (e.g. **"My Awesome Cafe"**) becomes `trip_itinerary.vendor`.
- The commit POST builds details from the payload for synthetic activities — **no `trip_activity_expenses` row is created** (`vendor-commit/route.ts:98-104,151-152`, comment: "UNPRICED discovery result with NO trip_activity_expenses row").
- The commit **writes the itinerary row with `vendorOptionId: optionId`** = the `place-…` string (`vendor-commit/route.ts:265`).
- **Crucially, the commit SKIPS the option-status update for synthetic:** `if (optionType !== 'flight' && !isSyntheticLodging && !isSyntheticActivity) { await setOptionStatus(...) }` (`:158-160`). So commit never touches the (nonexistent) UUID row.

**The asymmetry (root cause):** the uncommit DELETE excludes only `'flight'` (`:329`) — it has **no `synthetic` guard** and receives no `synthetic` flag (the body is just `{ optionType, optionId }`, `page.tsx:387`). It therefore calls `trip_activity_expenses.update({ where: { id: 'place-…' } })` unconditionally.

**Verdict:**
- **(a) wrong field passed by the UI?** No — `vendorOptionId` is the intended link field; for *row-based* commits it correctly holds a real UUID. The UI passes the right field.
- **(b) wrong-format value stored at commit time?** **YES — primary.** The synthetic commit path deliberately stores a non-UUID placeholder (`place-…`/`hotel-…`) in `vendorOptionId` (`PlaceCommitForm.tsx:52`, `AddToTripButton.tsx:74`, persisted at `vendor-commit/route.ts:265`) because there is no option row. The uncommit then feeds that placeholder into a `@db.Uuid` PK lookup (`:69`).
- **(c) schema type mismatch (cuid stored where uuid declared)?** **No.** `trip_activity_expenses.id` is genuinely `@db.Uuid` (`:1770`) and real rows hold valid UUIDs; the problem is that synthetic commits never created a row and stored a placeholder. (`trip_itinerary.id` is cuid but is unrelated to the failing lookup.)
- **Mechanism = (b) + a missing code branch:** the commit guards `!isSyntheticActivity` before the UUID write (`:158`); the uncommit has no equivalent guard, so it dereferences a placeholder as a UUID. The reported correlation with "committed before the destination fix" is **incidental** — the affected rows are defined by the **synthetic detail-page commit path**, not by commit era; the destination-resolution fix is unrelated to this column.

---

## D. BLAST RADIUS

**Broken on uncommit (any era) — all SYNTHETIC detail-page commits:**
- **Synthetic activity (Google places):** `optionId = place-{category}-{ts}` (`PlaceCommitForm.tsx:52`) → `trip_activity_expenses.update` (`:69`) on `@db.Uuid` (`:1770`) → error "found `p` at 1". **This is the reported "My Awesome Cafe" case.**
- **Synthetic lodging (LiteAPI hotels via "Add to trip"):** `optionId = hotel-{liteapiHotelId||'manual'}-{ts}` (`AddToTripButton.tsx:74`), `optionType:'lodging', synthetic:true`. Uncommit → `setOptionStatus('lodging')` → `trip_lodging_options.update({ where:{ id:'hotel-…' } })` (`vendor-commit/route.ts:60`) on `@db.Uuid` (`:1700`) → **same class of error** (would read "found `h` at 1"). Same missing-guard defect; not yet reported but latent.

**Works on uncommit — ROW-BASED commits (real UUID `vendorOptionId`):**
- The carousel "select + schedule" path (`handleSelectItem`→`confirmSelection`→`buildVendorBody`) creates a real option row first, then commits with that row's UUID → `vendorOptionId` is a valid UUID → `setOptionStatus`/`getOptionDetails` succeed. (Flights are excluded from `setOptionStatus` entirely, `:329`.)

**Other readers of `vendorOptionId` — do they fail too?**
- `trip_itinerary.deleteMany({ where: { vendorOptionId: optionId } })` (`vendor-commit/route.ts:354`) — VarChar match, would succeed, but **never runs** (transaction aborts at `setOptionStatus` `:330` first).
- `budget_line_items.deleteMany` matches on `description` (`:347-349`), not on the id — unaffected, but also unreached.
- `calendar_events` delete by `source_id = trip:${id}:vendor:${optionId}` (raw SQL string, `:360`) — unaffected by UUID typing, but outside the transaction and unreached on the throw.
- Client itinerary→calendar transform: `vendorOptions[item.vendorOptionId]` (`page.tsx:453`) — a JS object lookup by string key; for synthetic ids it simply misses and falls back (`:454`). **No crash on display.**
- Budget rollups / display read `trip_itinerary.vendor` (the stored string, e.g. "My Awesome Cafe") and `budget_line_items.description` — **commit and display work fine**; only **uncommit** is broken.

**Distinguishing trait (not era — PATH):** affected rows are those whose `trip_itinerary.vendorOptionId` is a synthetic non-UUID placeholder (`place-…` / `hotel-…`), written exclusively by the detail-page synthetic commit forms (`PlaceCommitForm.tsx:52`, `AddToTripButton.tsx:74`). Row-based commits store real UUIDs and uncommit cleanly.

---

## E. ALEX-RUN QUERIES (psql — auditor cannot reach the DB)

> Note: the offending value lives in **`trip_itinerary.vendorOptionId`**, not in `trip_activity_expenses` (synthetic commits create **no** `trip_activity_expenses` row). Queries for both tables below.

```sql
-- 1. Real activity rows that DO exist for the trip (these have valid UUID ids;
--    synthetic 'place-…' commits will NOT appear here — that's the point).
SELECT id, category, title, vendor, status, is_selected
FROM trip_activity_expenses
WHERE trip_id = 'cmpqhf1dt000514h3px1qqwom'
ORDER BY created_at;

-- 2. The SUSPECT column: every committed itinerary row + its vendorOptionId.
SELECT id, vendor, category, "vendorOptionId", "vendorOptionType", "createdAt"
FROM trip_itinerary
WHERE "tripId" = 'cmpqhf1dt000514h3px1qqwom'
ORDER BY "vendorOptionType", "createdAt";

-- 3. Rows whose vendorOptionId is NON-UUID (the un-uncommittable ones —
--    expect 'place-…' (activity) and 'hotel-…' (lodging) placeholders).
SELECT "vendorOptionType", "vendorOptionId", vendor, count(*)
FROM trip_itinerary
WHERE "tripId" = 'cmpqhf1dt000514h3px1qqwom'
  AND "vendorOptionId" IS NOT NULL
  AND "vendorOptionId" !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
GROUP BY "vendorOptionType", "vendorOptionId", vendor
ORDER BY "vendorOptionType";

-- 4. The specific reported rows.
SELECT id, vendor, "vendorOptionId", "vendorOptionType"
FROM trip_itinerary
WHERE "tripId" = 'cmpqhf1dt000514h3px1qqwom'
  AND vendor ILIKE '%awesome cafe%';

-- 5. (Optional) budget rows tied to those vendors, matched the way the code
--    matches them (by description), to see what an uncommit WOULD remove.
SELECT id, "coaCode", amount, description, source
FROM budget_line_items
WHERE "tripId" = 'cmpqhf1dt000514h3px1qqwom'
  AND source = 'trip';
```

---

## F. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Mirror the commit's synthetic guard in the uncommit.** The commit POST already gates the UUID-row update behind `!isSyntheticLodging && !isSyntheticActivity` (`vendor-commit/route.ts:158`). The DELETE handler (`:329`) needs an equivalent branch so it never calls `setOptionStatus`/`getOptionDetails` for synthetic ids. A synthetic id is recognizable two ways: the `vendorOptionId` doesn't parse as a UUID, or it has a `place-`/`hotel-` prefix.
2. **The itinerary + budget teardown can key off `trip_itinerary` alone.** `trip_itinerary.deleteMany({ where: { vendorOptionId } })` (`:354`) and the description-matched `budget_line_items.deleteMany` (`:347`) already don't need the option-table row — so an uncommit that skips the option-row status reset would still fully tear down synthetic commits. (Verify against the desired status-reset semantics.)
3. **Latent twin:** synthetic-lodging uncommit (`hotel-…`, `AddToTripButton.tsx:74`) has the identical defect (D); any fix should cover both `activity` and `lodging` synthetic paths, not just the reported cafe case.
4. **Data already written is recoverable without a row:** the broken rows can be uncommitted by deleting `trip_itinerary` (by `vendorOptionId`) + `budget_line_items` (by `description`/`tripId`) + `calendar_events` (by `source_id`) directly — none of which require a valid UUID. (Confirm with Alex before any data operation; out of this audit's scope.)

---

*End of audit. No application code was modified; only this report was created.*
