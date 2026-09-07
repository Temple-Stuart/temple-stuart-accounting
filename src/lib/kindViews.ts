/**
 * TABLES-01 — SIX TABLES, ONE PER KIND, AS VIEWS OVER THE TYPED FEED TABLES.
 *
 * The deck's step 5: "create one table per kind: six tables, six names; the
 * kind picks the table." Ruled: the typed feed tables stay (real columns,
 * constraints, arrival_id); six VIEWS — reference · registry · event · derived
 * · snapshot · posting — each with ONE common shape (VIEW_COLUMNS), union the
 * feed tables of that kind. The kind per table comes from the rule book
 * (src/lib/providers.ts kindOf) — never typed twice. Posting is empty by the
 * deck's own law (nothing ever arrives as a posting); snapshot is empty until
 * holdings land (PR-2d).
 *
 * THE CENSUS (KIND_VIEW_CENSUS) is the one source: every table whose rows come
 * from a provider answer AND whose feed the rule book names, with its columns
 * for the common shape. A table whose feed the book cannot name is REPORTED
 * (STOPPED_TABLES), never guessed into a view. The migration
 * (prisma/migrations/*_kind_views) is kindViewsSql() verbatim; the deck's
 * step-5 honest line is KIND_VIEWS_HONEST_LINE; the README extracts both. The
 * build (scripts/assert-tool-registry.ts) runs kindViewsLaw against the
 * migration text: (a) every census table in exactly one view, (b) that view is
 * the rule book's kind for the table's feed, (c) posting unions nothing,
 * (d) all six views carry the common columns in the same order.
 *
 * Imports the rule book only; server- and client-safe (the deck renders the line).
 */
import { ARRIVAL_KINDS, kindOf, ruleFor, type ArrivalKind } from './providers';

/** The common shape, in order: name · SQL type. */
export const VIEW_COLUMNS = [
  ['kind', 'arrival_kind'],
  ['feed', 'text'],
  ['table_name', 'text'],
  ['row_id', 'text'],
  ['their_id', 'text'],
  ['arrival_id', 'text'],
  ['user_id', 'text'],
  ['arrived', 'timestamptz'],
] as const;

/** A fixed feed, or a feed picked per row by a column of the FROM clause (one kind for every branch). */
export type FeedOf = readonly [providerCode: string, resource: string] | { readonly column: string; readonly map: Readonly<Record<string, readonly [string, string]>> };

export interface FeedTable {
  /** The SQL table name. */
  table: string;
  /** The deck's word for the honest line. */
  label: string;
  feed: FeedOf;
  /** SQL expressions over the FROM clause below; row_id / their_id are cast to text by the generator. */
  rowId: string;
  theirId: string;
  /** null → NULL::text (the table carries no arrival_id, or the view does not read it yet — `why` says which; a view is redefined by a migration of its own). */
  arrivalId: string | null;
  /** null → NULL::text (a shared reference or cache row belongs to no user). */
  userId: string | null;
  /** The column that says when the row arrived; cast to timestamptz by the generator. */
  arrived: string;
  /** The FROM clause, alias and joins included. */
  from: string;
  /** A filter that keeps the feed's rows only (an authored or unruled row never rides a kind view). */
  where?: string;
  /** file:line — the writer and the columns, from the census. */
  why: string;
  /** Not a Prisma model — where it lives. */
  outsidePrisma?: string;
}

/** The typed feed tables, sheet order by kind: event, reference, registry. Snapshot and derived have none the book names today. */
export const KIND_VIEW_CENSUS: readonly FeedTable[] = [
  {
    table: 'transactions', label: 'transactions', feed: ['plaid', 'transaction'],
    rowId: 't.id', theirId: 't."transactionId"', arrivalId: 't.arrival_id', userId: 'a."userId"', arrived: 't."createdAt"',
    from: 'transactions t JOIN accounts a ON a.id = t."accountId"',
    why: 'the one Plaid writer (sync-complete → src/lib/arrivals/plaidTransactionsPage.ts:114); user through accounts.userId (schema: transactions has no user column); arrival_id since PR-2',
  },
  {
    table: 'investment_transactions', label: 'investment transactions', feed: ['plaid', 'investment_transaction'],
    rowId: 'i.id', theirId: 'i.investment_transaction_id', arrivalId: 'i.arrival_id', userId: 'a."userId"', arrived: 'i."createdAt"',
    from: 'investment_transactions i JOIN accounts a ON a.id = i."accountId"',
    why: 'sync-complete → src/lib/arrivals/plaidInvestmentsPage.ts (creates / corrections); user through accounts.userId; arrival_id since PR-2c',
  },
  {
    table: 'reservations', label: 'bookings', feed: ['liteapi', 'booking'],
    rowId: 'r.id', theirId: 'r."providerBookingId"', arrivalId: null, userId: 'r."userId"', arrived: 'r."createdAt"',
    from: 'reservations r', where: "r.provider = 'liteapi'",
    why: "src/app/api/travel/liteapi/book/route.ts and liteapi/flights/book/route.ts write provider 'liteapi' inside the landing's transaction (src/lib/arrivals/liteapiBooking.ts); the 2 'duffel' writes (src/app/api/flights/book/route.ts) are a provider the deck does not name — filtered out, reported; reservations.arrival_id exists since REBUILD-01 PR-5 (20260908000000_reservations_arrival_id) — the event view still reads NULL for it until a view migration of its own redefines it (TABLES-01b)",
  },
  {
    table: 'securities', label: 'securities', feed: ['plaid', 'security'],
    rowId: 's.id', theirId: 's."securityId"', arrivalId: 's.arrival_id', userId: null, arrived: 's."createdAt"',
    from: 'securities s',
    why: 'sync-complete → plaidInvestmentsPage.ts (securities upsert); a shared reference row, no user column; arrival_id since PR-2c',
  },
  {
    table: 'places_cache', label: 'places', feed: ['google_places', 'place'],
    rowId: 'p.id', theirId: 'p."placeId"', arrivalId: null, userId: null, arrived: 'p."cachedAt"',
    from: 'places_cache p',
    why: 'src/lib/placesCache.ts (upsert by placeId); a cache of Google Places answers, no user column, no arrival_id',
  },
  {
    table: 'regulatory_documents', label: 'the law corpus',
    feed: { column: 's.domain', map: { 'ecfr.gov': ['ecfr', 'title'], 'uscode.house.gov': ['us_code', 'title'], 'federalregister.gov': ['federal_register', 'document'], 'irs.gov': ['irs', 'bulletin'] } },
    rowId: 'd.id', theirId: 'd.citation_key', arrivalId: null, userId: null, arrived: 'd.retrieved_at',
    from: 'regulatory_documents d JOIN regulatory_sources s ON s.id = d.source_id',
    why: 'src/lib/corpus/db.ts:91 insertDocument (raw SQL); the source domain names the feed — ecfr-persist.ts:37, uscode-persist.ts:37, fedreg-persist.ts:36, irb-persist.ts:37; content_hash / raw_hash are its own fingerprints, no arrival_id',
    outsidePrisma: 'prisma/migrations/20260503000000_pr_f_corpus_foundation/migration.sql (CREATE TABLE regulatory_documents; not a Prisma model)',
  },
  {
    table: 'accounts', label: 'accounts', feed: ['plaid', 'account'],
    rowId: 'a.id', theirId: 'a."accountId"', arrivalId: null, userId: 'a."userId"', arrived: 'a."createdAt"',
    from: 'accounts a', where: "a.source = 'plaid'",
    why: "src/app/api/plaid/exchange-token/route.ts:118 (create at link); rows with source 'manual' are authored (src/app/api/transactions/manual/route.ts:49) — filtered out; no arrival_id (accounts are never landed as objects)",
  },
];

/** Tables whose rows come from a provider answer but whose feed the rule book does not name — reported, never viewed. */
export const STOPPED_TABLES: ReadonlyArray<{ table: string; why: string }> = [
  { table: 'reservations (provider duffel)', why: "2 writes carry provider 'duffel' (src/app/api/flights/book/route.ts) — duffel is not a provider the deck names; those rows are outside the event view" },
  { table: 'trip_scanner_results', why: 'src/app/api/trips/[id]/ai-assistant/route.ts writes AI recommendations per trip/category; the book names no such feed (anthropic · classification is the only anthropic row)' },
  { table: 'scan_snapshots', why: 'src/lib/convergence/snapshot-logger.ts writes our own scores over quotes — math we did, not a provider answer; no rule-book feed' },
  { table: 'operations_ai_usage', why: 'src/lib/ai/recordUsage.ts:158 stores our AI calls (purpose, tokens, full_response) — the book\'s anthropic row is classification, not a usage log' },
  { table: 'discovery_proposals', why: 'AI-authored proposals (src/lib/discovery); not the book\'s anthropic · classification by name' },
  { table: 'plaid_items', why: "Plaid's item — a handshake (the access token lives here); the deck: handshakes never enter the tables; the book has no plaid · item row" },
  { table: 'tastytrade_connections', why: 'a handshake (tokens); never data' },
  { table: 'observatoryHealthLog', why: 'our probes of the providers (src/app/api/data-observatory) — not a provider feed' },
];

const feedLabel = (code: string, resource: string): string => {
  const rule = ruleFor(code, resource);
  if (!rule) throw new Error(`kind views: no rule for ${code} · ${resource}`);
  return `${rule.provider} · ${rule.resource}`;
};

/** The one kind a table's feed resolves to — every branch of a per-row feed must agree, or the table is not one kind's. */
export function kindOfTable(t: FeedTable): ArrivalKind {
  if (Array.isArray(t.feed)) return kindOf(t.feed[0], t.feed[1]);
  const m = t.feed as { column: string; map: Record<string, readonly [string, string]> };
  const kinds = new Set(Object.values(m.map).map(([code, resource]) => kindOf(code, resource)));
  if (kinds.size !== 1) throw new Error(`kind views: ${t.table} resolves to ${kinds.size} kinds (${[...kinds].join(', ')}) — a table is one kind's`);
  return [...kinds][0];
}

export function tablesOfKind(kind: ArrivalKind, census: readonly FeedTable[] = KIND_VIEW_CENSUS): FeedTable[] {
  return census.filter((t) => kindOfTable(t) === kind);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function feedSql(t: FeedTable): string {
  if (Array.isArray(t.feed)) return q(feedLabel(t.feed[0], t.feed[1]));
  const m = t.feed as { column: string; map: Record<string, readonly [string, string]> };
  return `CASE ${m.column} ${Object.entries(m.map).map(([v, [code, resource]]) => `WHEN ${q(v)} THEN ${q(feedLabel(code, resource))}`).join(' ')} END`;
}

function whereSql(t: FeedTable): string {
  const parts: string[] = [];
  if (!Array.isArray(t.feed)) {
    const m = t.feed as { column: string; map: Record<string, readonly [string, string]> };
    parts.push(`${m.column} IN (${Object.keys(m.map).map(q).join(', ')})`);
  }
  if (t.where) parts.push(t.where);
  return parts.length ? `\n  WHERE ${parts.join(' AND ')}` : '';
}

/** One branch of a view: the common columns, in VIEW_COLUMNS order, over one feed table. */
export function branchSql(t: FeedTable): string {
  const kind = kindOfTable(t);
  return [
    `  SELECT ${q(kind)}::arrival_kind AS kind,`,
    `         ${feedSql(t)} AS feed,`,
    `         ${q(t.table)} AS table_name,`,
    `         ${t.rowId}::text AS row_id,`,
    `         ${t.theirId}::text AS their_id,`,
    `         ${t.arrivalId ?? 'NULL'}::text AS arrival_id,`,
    `         ${t.userId ?? 'NULL'}::text AS user_id,`,
    `         ${t.arrived}::timestamptz AS arrived`,
    `  FROM ${t.from}${whereSql(t)}`,
  ].join('\n');
}

/** Why a kind's view unions nothing today — the comment the migration carries. */
export const EMPTY_VIEW_WHY: Readonly<Partial<Record<ArrivalKind, string>>> = {
  snapshot: 'no feed table holds a snapshot yet — plaid · holding lands in REBUILD-01 PR-2d',
  derived: 'no feed table the rule book names holds a derived row — the AI tables (operations_ai_usage, discovery_proposals, trip_scanner_results, scan_snapshots) carry no rule-book feed (STOPPED_TABLES)',
  posting: "empty by the deck's own law — nothing ever arrives as a posting; the system writes postings from events (step 10)",
};

const EMPTY_SELECT = `  SELECT ${VIEW_COLUMNS.map(([name, type]) => `NULL::${type} AS ${name}`).join(',\n         ')}\n  WHERE false`;

/** CREATE VIEW <kind> — UNION ALL over exactly the census tables of that kind; an empty SELECT with the same columns when there are none. */
export function kindViewSql(kind: ArrivalKind, census: readonly FeedTable[] = KIND_VIEW_CENSUS): string {
  const tables = tablesOfKind(kind, census);
  if (tables.length === 0) {
    const why = EMPTY_VIEW_WHY[kind];
    if (!why) throw new Error(`kind views: ${kind} has no feed table and no stated reason`);
    return `-- ${kind}: ${why}\nCREATE VIEW ${kind} AS\n${EMPTY_SELECT};`;
  }
  return `-- ${kind}: ${tables.map((t) => t.table).join(', ')}\nCREATE VIEW ${kind} AS\n${tables.map(branchSql).join('\n  UNION ALL\n')};`;
}

/** The six, in the deck's order — the migration's body, verbatim. */
export function kindViewsSql(census: readonly FeedTable[] = KIND_VIEW_CENSUS): string {
  return ARRIVAL_KINDS.map((k) => kindViewSql(k, census)).join('\n\n');
}

/** The deck's step-5 honest line — every name from the census, none retyped. */
export function kindViewsHonestLine(census: readonly FeedTable[] = KIND_VIEW_CENSUS): string {
  const part = (kind: ArrivalKind): string => {
    if (kind === 'posting') return 'posting: empty by law';
    const names = tablesOfKind(kind, census).map((t) => t.label);
    return `${kind}: ${names.length ? names.join(', ') : 'none yet'}`;
  };
  const order: ArrivalKind[] = ['event', 'reference', 'registry', 'snapshot', 'derived', 'posting'];
  return `Today the six are views over the feed tables — ${order.map(part).join('; ')}.`;
}

export const KIND_VIEWS_HONEST_LINE = kindViewsHonestLine();

/** Parse CREATE VIEW blocks out of migration text: name → { tables (FROM …), columns (the AS aliases of the first SELECT), unions }. */
export function parseViews(sql: string): Array<{ name: string; tables: string[]; columns: string[]; body: string }> {
  const out: Array<{ name: string; tables: string[]; columns: string[]; body: string }> = [];
  for (const m of sql.matchAll(/CREATE VIEW (\w+) AS\n([\s\S]*?);/g)) {
    const body = m[2];
    const tables = [...body.matchAll(/FROM (\w+)/g)].map((x) => x[1]);
    const firstSelect = body.split('UNION ALL')[0];
    const columns = [...firstSelect.matchAll(/ AS (\w+)/g)].map((x) => x[1]);
    out.push({ name: m[1], tables, columns, body });
  }
  return out;
}

/** THE KIND-VIEWS LAW. Over the census alone, and over a migration's text when given. */
export function kindViewsLaw(opts: { throwOnFail?: boolean; census?: readonly FeedTable[]; migrationSql?: string } = {}): string[] {
  const violations: string[] = [];
  const census = opts.census ?? KIND_VIEW_CENSUS;
  const seen = new Set<string>();
  for (const t of census) {
    if (seen.has(t.table)) violations.push(`kind views: ${t.table} is in the census twice`);
    seen.add(t.table);
    try { kindOfTable(t); } catch (e) { violations.push(`kind views: ${t.table}: ${(e as Error).message}`); }
  }
  const expectedColumns = VIEW_COLUMNS.map(([n]) => n);
  if (opts.migrationSql !== undefined) {
    const views = parseViews(opts.migrationSql);
    const byName = new Map(views.map((v) => [v.name, v]));
    for (const kind of ARRIVAL_KINDS) {
      const v = byName.get(kind);
      if (!v) { violations.push(`kind views: the migration has no CREATE VIEW ${kind}`); continue; }
      // (d) the common columns, same order
      if (v.columns.join(',') !== expectedColumns.join(',')) violations.push(`kind views: ${kind} carries [${v.columns.join(' ')}], not the common shape [${expectedColumns.join(' ')}]`);
      // (a)(b) exactly the census tables of this kind, each once
      const want = tablesOfKind(kind, census).map((t) => t.table).sort();
      const have = [...v.tables].sort();
      if (want.join(',') !== have.join(',')) violations.push(`kind views: ${kind} unions [${have.join(', ')}]; the census (through the rule book) says [${want.join(', ')}]`);
      // the migration is the generator's text, verbatim — never typed twice
      let expected: string | null = null;
      try { expected = kindViewSql(kind, census); } catch { expected = null; }
      if (expected !== null && !opts.migrationSql.includes(expected)) violations.push(`kind views: the migration's CREATE VIEW ${kind} is not kindViewSql('${kind}') verbatim`);
    }
    // (c) posting unions nothing
    const posting = byName.get('posting');
    if (posting && posting.tables.length !== 0) violations.push(`kind views: posting unions [${posting.tables.join(', ')}] — nothing ever arrives as a posting`);
    // (a) every census table appears in exactly one view
    for (const t of census) {
      const n = views.filter((v) => v.tables.includes(t.table)).length;
      if (n !== 1) violations.push(`kind views: ${t.table} appears in ${n} views, expected exactly 1`);
    }
    if (views.length !== ARRIVAL_KINDS.length) violations.push(`kind views: the migration creates ${views.length} views, expected ${ARRIVAL_KINDS.length}`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new Error(`KIND VIEWS LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

kindViewsLaw();
