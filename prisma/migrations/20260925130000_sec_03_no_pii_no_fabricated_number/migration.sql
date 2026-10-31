-- SEC-03 (2026-09-25) — NO PII IN A URL, NO FABRICATED NUMBER IN A LEDGER.
--
-- 1. THE MONEY. reservations.finalPriceCents and commission_ledger.grossAmountCents
--    become NULLABLE. NULL means "price not stated by the vendor — reconcile against
--    the bank". No default. The flights book route used to write $0 when the vendor
--    stated no price (parsed.price ?? 0), so a real $0 booking and a missing price
--    were the same number in the ledger and the matcher had to treat 0 as unknown.
--    Existing rows are untouched: nothing backfilled, nothing inferred — a 0 that
--    is already there stays a 0.
--
-- 2. THE CONTACT. prebook_contacts: what the customer STATED at prebook, keyed by
--    the vendor's prebookId, so the checkout's returnUrl and /booking/flight-confirm
--    carry ids only and the book route reads the contact here. A customer's email
--    used to ride the redirect URL — browser history, referrer headers, server logs.
--    One table serves both lanes: `lane` names which; the hotel lane collects its
--    holder on /booking/confirm's own form and carries no PII in its URL, so it
--    writes nothing here today, and a second table for it would be a second copy
--    of the same shape. No default on any stated field; createdAt is a timestamp,
--    not a statement. searchCurrency and contactPhoneCountryCode are stated inputs
--    recorded verbatim beside the contact (the book route is handed the search
--    currency from here when the vendor's book answer states none; the phone's
--    country code is the separate field the customer typed). userId is the
--    signed-in account when there was one, else NULL (a guest).

ALTER TABLE "reservations" ALTER COLUMN "finalPriceCents" DROP NOT NULL;
ALTER TABLE "commission_ledger" ALTER COLUMN "grossAmountCents" DROP NOT NULL;

CREATE TABLE "prebook_contacts" (
    "prebookId"               VARCHAR(120) NOT NULL,
    "lane"                    VARCHAR(20)  NOT NULL,
    "contactFirstName"        VARCHAR(255) NOT NULL,
    "contactLastName"         VARCHAR(255) NOT NULL,
    "contactEmail"            VARCHAR(255) NOT NULL,
    "contactPhone"            VARCHAR(40)  NOT NULL,
    "contactPhoneCountryCode" VARCHAR(8),
    "searchCurrency"          VARCHAR(3),
    "userId"                  TEXT,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prebook_contacts_pkey" PRIMARY KEY ("prebookId"),
    CONSTRAINT "prebook_contacts_lane" CHECK ("lane" IN ('hotel', 'flight', 'activity'))
);

CREATE INDEX "prebook_contacts_userId_idx" ON "prebook_contacts"("userId");

ALTER TABLE "prebook_contacts"
    ADD CONSTRAINT "prebook_contacts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
