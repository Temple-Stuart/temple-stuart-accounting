-- Collapse fabricated per-day itinerary expansion → ONE recurrence-template row.
-- Alex runs this via psql AFTER deploying the code fix (vendor-commit no longer
-- expands). Idempotent in spirit: once collapsed, no (tripId, vendorOptionId)
-- group has COUNT(*) > 1, so a re-run is a no-op. Wrapped in a transaction with
-- pre/post counts so the effect is auditable. Do NOT execute from CI.
--
-- WHY: vendor-commit used to write N amortized per-day rows (cost = amount/N,
-- rounded per day). The per-day rounding drifts from the single honest budget row
-- — e.g. on trip cmq3adbzk000hbweimtv233z1:
--   • Fairfield lodging  : 29 rows summing 1427.09  vs budget_line_items 1427.10
--   • gym activity        : 29 rows summing   64.96  vs budget_line_items   65.00
-- Both penny gaps are CPA-grade violations. This collapses each expanded group to
-- one row carrying the FULL honest amount (the budget figure), recurrence='daily',
-- the real date span, and links the budget row back via itineraryId.
--
-- GENERALIZED: it does NOT hard-code those two vendorOptionIds (the synthetic ids
-- carry a timestamp). It collapses EVERY (tripId, vendorOptionId) group with
-- COUNT(*) > 1. To see exactly which groups will be touched first, run:
--   SELECT "tripId", "vendorOptionId", "vendorOptionType", min(vendor) AS vendor,
--          count(*) AS rows, round(sum(cost),2) AS summed_cost
--   FROM trip_itinerary WHERE "vendorOptionId" IS NOT NULL
--   GROUP BY "tripId", "vendorOptionId", "vendorOptionType" HAVING count(*) > 1
--   ORDER BY rows DESC;

BEGIN;

-- ── PRE counts ───────────────────────────────────────────────────────────────
SELECT 'pre' AS phase,
  (SELECT count(*) FROM trip_itinerary) AS itinerary_rows,
  (SELECT count(*) FROM (
     SELECT "tripId", "vendorOptionId" FROM trip_itinerary
     WHERE "vendorOptionId" IS NOT NULL
     GROUP BY "tripId", "vendorOptionId" HAVING count(*) > 1
   ) g) AS expanded_groups,
  (SELECT count(*) FROM trip_itinerary WHERE recurrence = 'daily') AS daily_rows;

-- 1. KEEP row per expanded group = earliest destDate (tiebreak: id). This row is
--    the range start (its day/homeDate are correct); we extend its destDate below.
CREATE TEMP TABLE _collapse_keep ON COMMIT DROP AS
SELECT DISTINCT ON (ti."tripId", ti."vendorOptionId")
       ti.id AS keep_id, ti."tripId", ti."vendorOptionId", ti."vendorOptionType", ti.vendor
FROM trip_itinerary ti
JOIN (
  SELECT "tripId", "vendorOptionId"
  FROM trip_itinerary
  WHERE "vendorOptionId" IS NOT NULL
  GROUP BY "tripId", "vendorOptionId"
  HAVING count(*) > 1
) grp ON grp."tripId" = ti."tripId" AND grp."vendorOptionId" = ti."vendorOptionId"
ORDER BY ti."tripId", ti."vendorOptionId", ti."destDate" ASC, ti.id ASC;

-- 2. Per-group plan: real range end (MAX destDate), the honest budget figure
--    (matched by description = vendor, both written from details.title at commit),
--    and the group's summed cost as a fallback if no budget row matches.
CREATE TEMP TABLE _collapse_plan ON COMMIT DROP AS
SELECT k.keep_id, k."tripId", k."vendorOptionId", k."vendorOptionType", k.vendor,
       (SELECT max(ti2."destDate") FROM trip_itinerary ti2
         WHERE ti2."tripId" = k."tripId" AND ti2."vendorOptionId" = k."vendorOptionId") AS max_dest_date,
       (SELECT sum(ti3.cost) FROM trip_itinerary ti3
         WHERE ti3."tripId" = k."tripId" AND ti3."vendorOptionId" = k."vendorOptionId") AS group_cost_sum,
       (SELECT b.id FROM budget_line_items b
         WHERE b."tripId" = k."tripId" AND b.description = k.vendor AND b.source = 'trip'
         ORDER BY b."createdAt" ASC LIMIT 1) AS budget_id,
       (SELECT b.amount FROM budget_line_items b
         WHERE b."tripId" = k."tripId" AND b.description = k.vendor AND b.source = 'trip'
         ORDER BY b."createdAt" ASC LIMIT 1) AS budget_amount
FROM _collapse_keep k;

-- 3. Rewrite the kept row to the single recurrence-template shape:
--    recurrence='daily', destDate=range end, cost=honest full amount (budget row,
--    else the group sum — never a per-day slice), vendor_name backfilled, and the
--    lodging overnight window default (22:00–07:00); non-lodging keeps NULL window.
UPDATE trip_itinerary ti
SET recurrence       = 'daily',
    "destDate"       = p.max_dest_date,
    cost             = COALESCE(p.budget_amount, p.group_cost_sum, ti.cost),
    vendor_name      = COALESCE(ti.vendor_name, ti.vendor),
    block_start_time = COALESCE(ti.block_start_time,
                         CASE WHEN ti."vendorOptionType" = 'lodging' THEN TIME '22:00' END),
    block_end_time   = COALESCE(ti.block_end_time,
                         CASE WHEN ti."vendorOptionType" = 'lodging' THEN TIME '07:00' END)
FROM _collapse_plan p
WHERE ti.id = p.keep_id;

-- 4. Auditable 1:1 link: point the budget row at the kept itinerary row.
UPDATE budget_line_items b
SET "itineraryId" = p.keep_id
FROM _collapse_plan p
WHERE b.id = p.budget_id;

-- 5. Delete the non-kept (amortized) rows in every collapsed group.
DELETE FROM trip_itinerary ti
USING _collapse_keep k
WHERE ti."tripId" = k."tripId"
  AND ti."vendorOptionId" = k."vendorOptionId"
  AND ti.id <> k.keep_id;

-- ── POST counts (expanded_groups should now be 0) ────────────────────────────
SELECT 'post' AS phase,
  (SELECT count(*) FROM trip_itinerary) AS itinerary_rows,
  (SELECT count(*) FROM (
     SELECT "tripId", "vendorOptionId" FROM trip_itinerary
     WHERE "vendorOptionId" IS NOT NULL
     GROUP BY "tripId", "vendorOptionId" HAVING count(*) > 1
   ) g) AS expanded_groups,
  (SELECT count(*) FROM trip_itinerary WHERE recurrence = 'daily') AS daily_rows;

COMMIT;
