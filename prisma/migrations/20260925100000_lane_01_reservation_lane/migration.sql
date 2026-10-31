-- LANE-01 (2026-09-25) — A RESERVATION KNOWS WHAT IT IS.
--
-- reservations had no lane column. The lane IS known at book time — each book
-- route calls landLiteApiBooking with lane: 'hotel' | 'flight' — and was thrown
-- away, so every reader derived a type from `provider` ('liteapi' → hotel) and
-- LiteAPI is now both rails: every flight rendered as a hotel.
--
-- Two columns, additive:
--   lane         VARCHAR(20) NOT NULL, CHECK-enforced to 'hotel' | 'flight' |
--                'activity'. NO DEFAULT: a book route writes the lane it holds, or
--                the insert fails loudly.
--   displayName  VARCHAR(255) NULL — the customer-facing name a lane STATES: a
--                stay's hotel name (the hotel route writes it beside hotelName), a
--                flight's carrier + route once GET /flights/bookings/{id} has
--                answered. NULL until stated; a reader renders the lane word and
--                the booking reference, and NEVER the provider slug.
--
-- ─── THE ONE-TIME BACKFILL, AND WHY RUNTIME CODE MAY NEVER REPEAT IT ────────
-- Rows written before this column existed carry no lane. They are given one HERE,
-- ONCE, from the documented D3 convention (schema.prisma:1497-1498: checkinDate /
-- checkoutDate are "null for non-stay orders (flights) — D3") and the provider that
-- wrote them: viator → activity; a stay-less row → flight; else hotel. Verified on
-- main 8f06554c: only the two LiteAPI book routes create reservations today
-- (liteapi/book/route.ts:191, liteapi/flights/book/route.ts:176), so the viator
-- branch can only ever touch rows that pre-date the Duffel/Viator retirements.
--
-- THIS CASE IS A MIGRATION-ONLY BACKFILL.
-- NO RUNTIME CODE MAY EVER DERIVE lane THIS WAY. From here on the lane is written
-- by the book route from the value it already holds, and type is read from this
-- column alone. The build asserts the CASE appears in no file under src/ (the lane
-- law, LANE-01).

ALTER TABLE "reservations" ADD COLUMN "lane" VARCHAR(20);
ALTER TABLE "reservations" ADD COLUMN "displayName" VARCHAR(255);

-- ONE-TIME BACKFILL of rows written before the column existed (D3 convention).
UPDATE "reservations"
   SET "lane" = CASE
                  WHEN "provider" = 'viator'   THEN 'activity'
                  WHEN "checkinDate" IS NULL   THEN 'flight'
                  ELSE 'hotel'
                END
 WHERE "lane" IS NULL;

-- A stay's stated name is the hotel's; copy it once so existing hotel rows keep
-- reading as the hotel, not as "Hotel booking <code>". A pure copy of a stated
-- value — nothing derived, nothing invented; flights stay NULL until the vendor
-- states their route.
UPDATE "reservations"
   SET "displayName" = "hotelName"
 WHERE "lane" = 'hotel' AND "displayName" IS NULL AND "hotelName" IS NOT NULL;

ALTER TABLE "reservations" ALTER COLUMN "lane" SET NOT NULL;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_lane"
  CHECK ("lane" IN ('hotel', 'flight', 'activity'));
