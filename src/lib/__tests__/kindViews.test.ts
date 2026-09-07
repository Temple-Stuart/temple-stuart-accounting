import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARRIVAL_KINDS, kindOf } from '../providers';
import { KIND_VIEWS_HONEST_LINE, KIND_VIEW_CENSUS, STOPPED_TABLES, VIEW_COLUMNS, kindOfTable, kindViewSql, kindViewsHonestLine, kindViewsLaw, kindViewsSql, parseViews, tablesOfKind, type FeedTable } from '../kindViews';

// TABLES-01 — six views, one per kind, generated from the census; the kind per table from the rule book.

const ROOT = resolve(__dirname, '../../..');
const migration = () => {
  const dir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_kind_views'));
  assert.ok(dir, 'the kind_views migration exists');
  return readFileSync(resolve(ROOT, 'prisma/migrations', dir, 'migration.sql'), 'utf8');
};

test('the census: every table once, its kind from the rule book (never typed), and the deck\'s honest line names exactly those tables', () => {
  assert.deepEqual(kindViewsLaw({ throwOnFail: false }), []);
  assert.deepEqual(KIND_VIEW_CENSUS.map((t) => [t.table, kindOfTable(t)]), [
    ['transactions', 'event'], ['investment_transactions', 'event'], ['reservations', 'event'],
    ['securities', 'reference'], ['places_cache', 'reference'], ['regulatory_documents', 'reference'],
    ['accounts', 'registry'],
  ]);
  for (const t of KIND_VIEW_CENSUS) {
    if (Array.isArray(t.feed)) assert.equal(kindOfTable(t), kindOf(t.feed[0], t.feed[1]));
  }
  assert.deepEqual(tablesOfKind('snapshot'), []);
  assert.deepEqual(tablesOfKind('derived'), []);
  assert.deepEqual(tablesOfKind('posting'), []);
  assert.equal(KIND_VIEWS_HONEST_LINE, 'Today the six are views over the feed tables — event: transactions, investment transactions, bookings; reference: securities, places, the law corpus; registry: accounts; snapshot: none yet; derived: none yet; posting: empty by law.');
  assert.ok(STOPPED_TABLES.length >= 5, 'the unruled tables are reported');
  assert.ok(STOPPED_TABLES.every((s) => !KIND_VIEW_CENSUS.some((t) => t.table === s.table)), 'a stopped table is never viewed');
});

test('the SQL: one CREATE VIEW per kind in the deck\'s order, the common columns in order on every branch, UNION ALL over exactly the kind\'s tables, an empty SELECT with a reason for the rest; posting unions nothing', () => {
  const sql = kindViewsSql();
  const views = parseViews(sql);
  assert.deepEqual(views.map((v) => v.name), [...ARRIVAL_KINDS]);
  for (const v of views) assert.deepEqual(v.columns, VIEW_COLUMNS.map(([n]) => n), `${v.name} columns`);
  assert.deepEqual(views.find((v) => v.name === 'event')!.tables, ['transactions', 'investment_transactions', 'reservations']);
  assert.deepEqual(views.find((v) => v.name === 'reference')!.tables, ['securities', 'places_cache', 'regulatory_documents']);
  assert.deepEqual(views.find((v) => v.name === 'registry')!.tables, ['accounts']);
  for (const k of ['snapshot', 'derived', 'posting']) {
    const v = views.find((x) => x.name === k)!;
    assert.deepEqual(v.tables, []);
    assert.match(v.body, /WHERE false/);
  }
  assert.match(kindViewSql('posting'), /^-- posting: empty by the deck's own law/);
  assert.match(kindViewSql('snapshot'), /plaid · holding lands in REBUILD-01 PR-2d/);
  // the branches: the kind is a cast literal, the feed is the rule book's words, the filters keep the feed's rows only
  const event = kindViewSql('event');
  assert.match(event, /'event'::arrival_kind AS kind/);
  assert.match(event, /'plaid · transaction' AS feed/);
  assert.match(event, /'liteapi · booking' AS feed/);
  assert.match(event, /WHERE r\.provider = 'liteapi'/);
  assert.match(event, /JOIN accounts a ON a\.id = t\."accountId"/, 'user_id through accounts');
  const reference = kindViewSql('reference');
  assert.match(reference, /CASE s\.domain WHEN 'ecfr\.gov' THEN 'ecfr · title' WHEN 'uscode\.house\.gov' THEN 'us code · title' WHEN 'federalregister\.gov' THEN 'federal register · document' WHEN 'irs\.gov' THEN 'irs · bulletin' END AS feed/);
  assert.match(reference, /WHERE s\.domain IN \('ecfr\.gov', 'uscode\.house\.gov', 'federalregister\.gov', 'irs\.gov'\)/);
  assert.match(reference, /NULL::text AS user_id/, 'a shared reference row has no user');
  assert.match(kindViewSql('registry'), /WHERE a\.source = 'plaid'/);
});

test('the migration is the generator\'s text verbatim, and the law passes over it', () => {
  const sql = migration();
  assert.ok(sql.includes(kindViewsSql()), 'never typed twice');
  assert.deepEqual(kindViewsLaw({ throwOnFail: false, migrationSql: sql }), []);
});

test('the law fails when a feed table is missing from every view, in two views, in the wrong kind\'s view, when posting unions a table, or when a view\'s columns drift', () => {
  const sql = kindViewsSql();
  const missing = sql.replace(/  UNION ALL\n  SELECT 'reference'::arrival_kind AS kind,\n         'google places · place' AS feed,[\s\S]*?FROM places_cache p/, '');
  assert.match(kindViewsLaw({ throwOnFail: false, migrationSql: missing }).join('\n'), /places_cache appears in 0 views, expected exactly 1/);
  const twice = sql.replace(/CREATE VIEW registry AS\n/, 'CREATE VIEW registry AS\n  SELECT \'registry\'::arrival_kind AS kind, \'x\' AS feed, \'transactions\' AS table_name, t.id::text AS row_id, t.id::text AS their_id, NULL::text AS arrival_id, NULL::text AS user_id, now()::timestamptz AS arrived FROM transactions t\n  UNION ALL\n');
  const v2 = kindViewsLaw({ throwOnFail: false, migrationSql: twice }).join('\n');
  assert.match(v2, /transactions appears in 2 views/);
  assert.match(v2, /registry unions \[accounts, transactions\]; the census \(through the rule book\) says \[accounts\]/);
  const postingFull = sql.replace(/CREATE VIEW posting AS\n[\s\S]*?WHERE false;/, "CREATE VIEW posting AS\n  SELECT 'posting'::arrival_kind AS kind, 'x' AS feed, 'accounts' AS table_name, a.id::text AS row_id, a.id::text AS their_id, NULL::text AS arrival_id, NULL::text AS user_id, now()::timestamptz AS arrived FROM accounts a;");
  assert.match(kindViewsLaw({ throwOnFail: false, migrationSql: postingFull }).join('\n'), /posting unions \[accounts\] — nothing ever arrives as a posting/);
  const drifted = sql.replace(/NULL::text AS user_id,\n         NULL::timestamptz AS arrived\n  WHERE false;/, 'NULL::timestamptz AS arrived,\n         NULL::text AS user_id\n  WHERE false;');
  assert.match(kindViewsLaw({ throwOnFail: false, migrationSql: drifted }).join('\n'), /carries \[kind feed table_name row_id their_id arrival_id arrived user_id\], not the common shape/);
  // a census table whose branches resolve to two kinds is refused by the census law itself
  const twoKinds: FeedTable = { table: 'mixed', label: 'mixed', feed: { column: 'x.k', map: { a: ['plaid', 'transaction'], b: ['plaid', 'security'] } }, rowId: 'x.id', theirId: 'x.id', arrivalId: null, userId: null, arrived: 'x.at', from: 'mixed x', why: 'test' };
  assert.match(kindViewsLaw({ throwOnFail: false, census: [...KIND_VIEW_CENSUS, twoKinds] }).join('\n'), /mixed resolves to 2 kinds \(event, reference\)/);
  // the honest line follows the census: drop a table and its name leaves the line
  assert.equal(kindViewsHonestLine(KIND_VIEW_CENSUS.filter((t) => t.table !== 'reservations')), 'Today the six are views over the feed tables — event: transactions, investment transactions; reference: securities, places, the law corpus; registry: accounts; snapshot: none yet; derived: none yet; posting: empty by law.');
});
