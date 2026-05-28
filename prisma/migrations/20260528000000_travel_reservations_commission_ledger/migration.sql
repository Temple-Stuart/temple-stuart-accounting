-- Travel-LiteAPI-PR-3b: persist real bookings + commission earned per booking.
-- Additive only — two new tables, no backfill, safe on `prisma migrate deploy`.
-- Both are user-scoped (userId FK) so every read/write through the routes can
-- filter by the verified user without leaking cross-account data.

CREATE TABLE "reservations" (
    "id"                       UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"                   TEXT NOT NULL,
    "tripId"                   TEXT NOT NULL,
    "provider"                 VARCHAR(20)  NOT NULL,
    "providerBookingId"        VARCHAR(120) NOT NULL,
    "providerConfirmationCode" VARCHAR(120),
    "status"                   VARCHAR(20)  NOT NULL,
    "hotelName"                VARCHAR(255),
    "checkinDate"              DATE NOT NULL,
    "checkoutDate"             DATE NOT NULL,
    "guestCount"               INTEGER NOT NULL DEFAULT 1,
    "finalPriceCents"          INTEGER NOT NULL,
    "currency"                 VARCHAR(3)  NOT NULL DEFAULT 'USD',
    "cancellationPolicyJson"   JSONB,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservations_userId_idx"   ON "reservations"("userId");
CREATE INDEX "reservations_tripId_idx"   ON "reservations"("tripId");
CREATE INDEX "reservations_provider_providerBookingId_idx"
    ON "reservations"("provider", "providerBookingId");

ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commission_ledger" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"                TEXT NOT NULL,
    "reservationId"         UUID NOT NULL,
    "provider"              VARCHAR(20) NOT NULL,
    "grossAmountCents"      INTEGER NOT NULL,
    "commissionAmountCents" INTEGER NOT NULL,
    "currency"              VARCHAR(3)  NOT NULL DEFAULT 'USD',
    "status"                VARCHAR(20) NOT NULL,
    "payoutDate"            TIMESTAMP(3),
    "providerInvoiceRef"    VARCHAR(120),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_ledger_userId_idx"        ON "commission_ledger"("userId");
CREATE INDEX "commission_ledger_reservationId_idx" ON "commission_ledger"("reservationId");
CREATE INDEX "commission_ledger_status_idx"        ON "commission_ledger"("status");

ALTER TABLE "commission_ledger"
    ADD CONSTRAINT "commission_ledger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commission_ledger"
    ADD CONSTRAINT "commission_ledger_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
