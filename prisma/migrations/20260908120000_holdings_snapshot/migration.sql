-- REBUILD-01 PR-2d: PLAID HOLDINGS LAND AS SNAPSHOTS. The rule book's plaid ·
-- holding row is SNAPSHOT ("how things stood at one moment"); until now the
-- holdings answer was read live (/api/investments) and never stored, and the
-- snapshot view unioned nothing. This migration:
--
--   1. creates `holdings` — one row per account + security + as_of (UNIQUE: one
--      snapshot per moment), typed columns for the answer's fields (the Plaid
--      SDK's Holding: quantity, cost_basis, institution_price, its as-of date
--      and datetime, institution_value, the two currency codes), the user
--      through accounts, and arrival_id NOT NULL — every row is parsed from an
--      arrival (the table is younger than the store: no cutoff, no backfill).
--      The DDL below is `prisma migrate diff` from main's schema to this one,
--      verbatim (schema.prisma moves with it).
--   2. redefines the snapshot view over it: DROP VIEW + CREATE VIEW, the
--      generator's text verbatim (src/lib/kindViews.ts kindViewSql('snapshot')
--      — the census names the composed their_id, holding:<account_id>:
--      <security_id>:<as_of>). The kind-views law reads each view's NEWEST
--      definition across the migrations (latestViews); the other five stay as
--      20260907200000_kind_views created them.
--
-- ADDITIVE-ONLY for data: a new table, a view redefined. Zero data rewrites.
-- Applied by `prisma migrate deploy` at deploy; no hand run.

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "as_of" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "cost_basis" DOUBLE PRECISION,
    "institution_price" DOUBLE PRECISION NOT NULL,
    "institution_price_as_of" DATE,
    "institution_price_datetime" TIMESTAMP(3),
    "institution_value" DOUBLE PRECISION NOT NULL,
    "iso_currency_code" TEXT,
    "unofficial_currency_code" TEXT,
    "arrival_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holdings_arrival_id_idx" ON "holdings"("arrival_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_accountId_security_id_as_of_key" ON "holdings"("accountId", "security_id", "as_of");

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("securityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_arrival_id_fkey" FOREIGN KEY ("arrival_id") REFERENCES "arrivals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- The snapshot view, redefined over holdings (drop and recreate — never OR REPLACE).
DROP VIEW snapshot;

-- snapshot: holdings
CREATE VIEW snapshot AS
  SELECT 'snapshot'::arrival_kind AS kind,
         'plaid · holding' AS feed,
         'holdings' AS table_name,
         h.id::text AS row_id,
         ('holding:' || a."accountId" || ':' || h.security_id || ':' || to_char(h.as_of, 'YYYY-MM-DD'))::text AS their_id,
         h.arrival_id::text AS arrival_id,
         a."userId"::text AS user_id,
         h."createdAt"::timestamptz AS arrived
  FROM holdings h JOIN accounts a ON a.id = h."accountId";
