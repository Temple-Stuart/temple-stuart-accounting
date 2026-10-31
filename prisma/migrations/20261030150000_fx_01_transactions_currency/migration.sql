-- FX-01 (Alex, 2026-10-30, ruling D) — TRANSACTIONS CARRY PLAID'S CURRENCY; TWO 'USD' DEFAULTS DROPPED.
--
-- ONE MIGRATION THAT CONVERGES TWO POSSIBLE PRODUCTION STATES. prisma/add_plaid_rich_data.sql (an ad-hoc
-- file outside this ladder, deleted by FX-01) may or may not have been run by hand on production; if it
-- was, transactions already holds "iso_currency_code" TEXT DEFAULT 'USD' and every row says 'USD' because
-- the default said so. If it was not, the column does not exist (the local database built from this
-- ladder has none). Either way this migration ends with the same column: VARCHAR(3), NO default, and
-- every existing row carrying the currency its ACCOUNT states.
--
-- THE LABELLED BACKFILL. The sync keeps Plaid's own word for a row only from FX-01 on
-- (src/lib/arrivals/plaidTransactionsPage.ts). Every row that exists BEFORE this migration runs gets
-- its currency DERIVED from its account's stated currency (accounts."isoCurrencyCode", as Plaid stated
-- it at link — LAW-02) on the day this migration applies; that is NOT Plaid's own word for the
-- transaction, and the row cannot tell the two apart — the derivation is recorded here, in words,
-- because the column cannot carry it. A NULL account currency leaves a NULL row: never 'USD' by default.
-- A row synced after FX-01 carries Plaid's word, written by the sync.
--
-- THE TWO DEFAULTS. reservations.currency and commission_ledger.currency carried @default("USD"); their
-- writers (src/app/api/travel/liteapi/book/route.ts, src/app/api/travel/liteapi/flights/book/route.ts)
-- state the value on every create, so the defaults only ever stood in for an omitted currency. Dropped:
-- the columns stay NOT NULL, so an omitted currency is refused by the database, never assumed.
--
-- The only CHECK is the length: a code is three characters or NULL (ISO 4217). Nothing here converts a
-- figure, touches ledger_entries, or rewrites a reservation.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres: the build's `prisma migrate deploy`
-- (package.json "build") applies it at deploy, after Alex merges.

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "iso_currency_code" VARCHAR(3);
ALTER TABLE "transactions" ALTER COLUMN "iso_currency_code" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "iso_currency_code" TYPE VARCHAR(3);

-- The labelled backfill (see the header): derived from the account's stated currency; NULL stays NULL.
UPDATE "transactions" t
   SET "iso_currency_code" = a."isoCurrencyCode"
  FROM "accounts" a
 WHERE t."accountId" = a."id";

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_iso_currency_code_length"
  CHECK ("iso_currency_code" IS NULL OR char_length("iso_currency_code") = 3);

ALTER TABLE "reservations" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "commission_ledger" ALTER COLUMN "currency" DROP DEFAULT;
