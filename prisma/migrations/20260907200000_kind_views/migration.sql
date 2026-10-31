-- TABLES-01: SIX TABLES, ONE PER KIND — AS VIEWS OVER THE TYPED FEED TABLES.
-- The deck's step 5: "create one table per kind: six tables, six names; the
-- kind picks the table." The typed feed tables stay (real columns,
-- constraints, arrival_id); these six views — reference · registry · event ·
-- derived · snapshot · posting — carry ONE common shape and each unions
-- exactly the feed tables of its kind. The kind per table is the rule book's
-- (src/lib/providers.ts RULE_BOOK), never typed twice: THIS FILE IS
-- src/lib/kindViews.ts kindViewsSql() VERBATIM, generated from the census
-- (KIND_VIEW_CENSUS), and the build asserts the two agree — (a) every census
-- table in exactly one view, (b) in the rule book's kind for its feed,
-- (c) posting unions nothing, (d) all six share the common columns in order.
--
-- Common shape: kind · feed (the rule-book pair) · table_name · row_id ·
-- their_id · arrival_id · user_id · arrived. A row an authored or unruled
-- feed wrote never rides a kind view (accounts.source = 'plaid',
-- reservations.provider = 'liteapi', the corpus's four named sources).
--
-- VIEWS ONLY: no table changes, no data. Applied by `prisma migrate deploy`
-- at deploy; schema.prisma carries the six as `view` models (Prisma's `views`
-- preview), which Migrate does not manage — this file is their one source.
-- Re-running it fails loudly on the first CREATE VIEW (no IF NOT EXISTS, no
-- OR REPLACE): a change to a view is a new migration that drops and recreates.

-- reference: securities, places_cache, regulatory_documents
CREATE VIEW reference AS
  SELECT 'reference'::arrival_kind AS kind,
         'plaid · security' AS feed,
         'securities' AS table_name,
         s.id::text AS row_id,
         s."securityId"::text AS their_id,
         s.arrival_id::text AS arrival_id,
         NULL::text AS user_id,
         s."createdAt"::timestamptz AS arrived
  FROM securities s
  UNION ALL
  SELECT 'reference'::arrival_kind AS kind,
         'google places · place' AS feed,
         'places_cache' AS table_name,
         p.id::text AS row_id,
         p."placeId"::text AS their_id,
         NULL::text AS arrival_id,
         NULL::text AS user_id,
         p."cachedAt"::timestamptz AS arrived
  FROM places_cache p
  UNION ALL
  SELECT 'reference'::arrival_kind AS kind,
         CASE s.domain WHEN 'ecfr.gov' THEN 'ecfr · title' WHEN 'uscode.house.gov' THEN 'us code · title' WHEN 'federalregister.gov' THEN 'federal register · document' WHEN 'irs.gov' THEN 'irs · bulletin' END AS feed,
         'regulatory_documents' AS table_name,
         d.id::text AS row_id,
         d.citation_key::text AS their_id,
         NULL::text AS arrival_id,
         NULL::text AS user_id,
         d.retrieved_at::timestamptz AS arrived
  FROM regulatory_documents d JOIN regulatory_sources s ON s.id = d.source_id
  WHERE s.domain IN ('ecfr.gov', 'uscode.house.gov', 'federalregister.gov', 'irs.gov');

-- registry: accounts
CREATE VIEW registry AS
  SELECT 'registry'::arrival_kind AS kind,
         'plaid · account' AS feed,
         'accounts' AS table_name,
         a.id::text AS row_id,
         a."accountId"::text AS their_id,
         NULL::text AS arrival_id,
         a."userId"::text AS user_id,
         a."createdAt"::timestamptz AS arrived
  FROM accounts a
  WHERE a.source = 'plaid';

-- event: transactions, investment_transactions, reservations
CREATE VIEW event AS
  SELECT 'event'::arrival_kind AS kind,
         'plaid · transaction' AS feed,
         'transactions' AS table_name,
         t.id::text AS row_id,
         t."transactionId"::text AS their_id,
         t.arrival_id::text AS arrival_id,
         a."userId"::text AS user_id,
         t."createdAt"::timestamptz AS arrived
  FROM transactions t JOIN accounts a ON a.id = t."accountId"
  UNION ALL
  SELECT 'event'::arrival_kind AS kind,
         'plaid · investment_transaction' AS feed,
         'investment_transactions' AS table_name,
         i.id::text AS row_id,
         i.investment_transaction_id::text AS their_id,
         i.arrival_id::text AS arrival_id,
         a."userId"::text AS user_id,
         i."createdAt"::timestamptz AS arrived
  FROM investment_transactions i JOIN accounts a ON a.id = i."accountId"
  UNION ALL
  SELECT 'event'::arrival_kind AS kind,
         'liteapi · booking' AS feed,
         'reservations' AS table_name,
         r.id::text AS row_id,
         r."providerBookingId"::text AS their_id,
         NULL::text AS arrival_id,
         r."userId"::text AS user_id,
         r."createdAt"::timestamptz AS arrived
  FROM reservations r
  WHERE r.provider = 'liteapi';

-- derived: no feed table the rule book names holds a derived row — the AI tables (operations_ai_usage, discovery_proposals, trip_scanner_results, scan_snapshots) carry no rule-book feed (STOPPED_TABLES)
CREATE VIEW derived AS
  SELECT NULL::arrival_kind AS kind,
         NULL::text AS feed,
         NULL::text AS table_name,
         NULL::text AS row_id,
         NULL::text AS their_id,
         NULL::text AS arrival_id,
         NULL::text AS user_id,
         NULL::timestamptz AS arrived
  WHERE false;

-- snapshot: no feed table holds a snapshot yet — plaid · holding lands in REBUILD-01 PR-2d
CREATE VIEW snapshot AS
  SELECT NULL::arrival_kind AS kind,
         NULL::text AS feed,
         NULL::text AS table_name,
         NULL::text AS row_id,
         NULL::text AS their_id,
         NULL::text AS arrival_id,
         NULL::text AS user_id,
         NULL::timestamptz AS arrived
  WHERE false;

-- posting: empty by the deck's own law — nothing ever arrives as a posting; the system writes postings from events (step 10)
CREATE VIEW posting AS
  SELECT NULL::arrival_kind AS kind,
         NULL::text AS feed,
         NULL::text AS table_name,
         NULL::text AS row_id,
         NULL::text AS their_id,
         NULL::text AS arrival_id,
         NULL::text AS user_id,
         NULL::timestamptz AS arrived
  WHERE false;
