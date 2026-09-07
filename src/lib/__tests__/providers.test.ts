import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADDED_RULES, ARRIVAL_KINDS, NoRuleError, PROVIDERS, PROVIDER_CODES, PROVIDER_MENU, ROUTING_RULES, RULE_BOOK, kindOf, providerByCode, providerByDeck, providerCode, providersLaw, ruleFor, type Rule } from '../providers';

// REBUILD-01 PR-1 — the provider vocabulary. Deck words ↔ codes round-trip, no
// duplicates, every rule-book pair resolves, and the schema's enum carries the
// code set exactly (read as text — the generated client is not committed).

const ROOT = resolve(__dirname, '../../..');

test('the vocabulary passes its own law and derives from the deck consts', () => {
  assert.deepEqual(providersLaw({ throwOnFail: false }), []);
  const menuWords = PROVIDER_MENU.flatMap(([, today, next]) => [today, next]).filter((c) => c !== '—').flatMap((c) => c.split(' · '));
  assert.deepEqual([...new Set(menuWords)].sort(), PROVIDERS.map((p) => p.deck).sort());
  assert.equal(PROVIDERS.length, 27);
  assert.equal(PROVIDERS.filter((p) => p.today).length, 18);
});

test('deck words and codes round-trip both ways, with no duplicate on either side', () => {
  for (const p of PROVIDERS) {
    assert.equal(providerCode(p.deck), p.code);
    assert.equal(providerByCode(p.code)?.deck, p.deck);
    assert.equal(providerByDeck(p.deck)?.code, p.code);
    assert.match(p.code, /^[a-z][a-z0-9_]*$/);
  }
  assert.equal(new Set(PROVIDERS.map((p) => p.deck)).size, PROVIDERS.length);
  assert.equal(new Set(PROVIDERS.map((p) => p.code)).size, PROVIDERS.length);
  assert.deepEqual(PROVIDER_CODES, [...PROVIDER_CODES].sort());
  assert.equal(providerCode('google places'), 'google_places');
  assert.equal(providerByCode('federal_register')?.deck, 'federal register');
});

test('every ROUTING_RULES provider + resource pair resolves, spelled as the deck spells it', () => {
  for (const [provider, resource] of ROUTING_RULES) {
    const p = providerByDeck(provider);
    assert.ok(p, `${provider} is a menu provider`);
    assert.ok(p.resources.includes(resource), `${provider} ${resource}`);
  }
  // RULEBOOK-01: resources come from the book — the deck's rows plus the two added plaid rows.
  assert.equal(PROVIDERS.flatMap((p) => p.resources).length, RULE_BOOK.length);
  assert.deepEqual(providerByDeck('plaid')?.resources, ['transaction', 'account', 'holding', 'security', 'investment_transaction']);
  assert.deepEqual(providerByDeck('stripe')?.resources, ['payout', 'event']);
  assert.deepEqual(providerByDeck('teller')?.resources, []);
});

// ── RULEBOOK-01 ──

test('the rule book: every deck row verbatim with the deck\'s kind, plus the rows the sample omits; one rule per pair; kindOf answers from the book and throws for a feed it does not name', () => {
  assert.deepEqual([...ARRIVAL_KINDS], ['reference', 'registry', 'event', 'derived', 'snapshot', 'posting']);
  assert.equal(RULE_BOOK.length, ROUTING_RULES.length + ADDED_RULES.length);
  for (const [provider, resource, kind, means] of ROUTING_RULES) {
    const rule = RULE_BOOK.find((r) => r.provider === provider && r.resource === resource);
    assert.ok(rule, `${provider} · ${resource}`);
    assert.equal(rule.kind, kind.toLowerCase());
    assert.equal(rule.means, means);
    assert.equal(rule.source, 'deck');
    assert.equal(rule.code, providerCode(provider));
  }
  assert.deepEqual(ADDED_RULES.map(([p, r, k]) => [p, r, k]), [['plaid', 'security', 'REFERENCE'], ['plaid', 'investment_transaction', 'EVENT'], ['stripe', 'event', 'EVENT'], ['liteapi', 'cancellation', 'EVENT']]);
  assert.equal(kindOf('liteapi', 'cancellation'), 'event');
  assert.equal(kindOf('liteapi', 'booking'), 'event');
  assert.equal(ruleFor('liteapi', 'booking')?.source, 'deck');
  assert.equal(ruleFor('liteapi', 'cancellation')?.source, 'added');
  assert.equal(kindOf('stripe', 'event'), 'event');
  assert.equal(kindOf('stripe', 'payout'), 'event');
  assert.equal(ruleFor('plaid', 'security')?.source, 'added');
  assert.equal(new Set(RULE_BOOK.map((r) => `${r.provider} · ${r.resource}`)).size, RULE_BOOK.length, 'one rule per pair');
  assert.ok(RULE_BOOK.every((r) => r.kind !== 'posting'), 'nothing ever arrives as a posting');
  // the three resources the store has landed, the deck's holding, the two the book does not name
  assert.equal(kindOf('plaid', 'transaction'), 'event');
  assert.equal(kindOf('plaid', 'investment_transaction'), 'event');
  assert.equal(kindOf('plaid', 'security'), 'reference');
  assert.equal(kindOf('plaid', 'holding'), 'snapshot');
  assert.equal(kindOf('plaid', 'account'), 'registry');
  assert.equal(kindOf('google_places', 'place'), 'reference', 'keyed by the enum code, not the deck word');
  assert.throws(() => kindOf('plaid', 'balance'), NoRuleError);
  assert.throws(() => kindOf('teller', 'transaction'), /no rule for teller · transaction/);
  assert.equal(ruleFor('plaid', 'balance'), undefined);
});

test('the law rejects a book missing a deck row, a deck row with another kind, two kinds for one pair, a posting rule, an unknown kind, an unknown provider', () => {
  const book = [...RULE_BOOK];
  assert.deepEqual(providersLaw({ throwOnFail: false, book }), []);
  const missing = book.filter((r) => !(r.provider === 'plaid' && r.resource === 'holding'));
  assert.match(providersLaw({ throwOnFail: false, book: missing }).join('\n'), /deck row plaid · holding is missing/);
  const changed = book.map((r) => (r.provider === 'plaid' && r.resource === 'transaction' ? { ...r, kind: 'snapshot' as const } : r));
  assert.match(providersLaw({ throwOnFail: false, book: changed }).join('\n'), /plaid · transaction is snapshot; the deck says event/);
  const twice = [...book, { ...book[0], kind: 'reference' as const }];
  assert.match(providersLaw({ throwOnFail: false, book: twice }).join('\n'), /has two rules \(event, reference\)/);
  const posting = [...book, { provider: 'stripe', code: 'stripe', resource: 'ledger_line', kind: 'posting' as const, means: '', source: 'added' as const }];
  assert.match(providersLaw({ throwOnFail: false, book: posting }).join('\n'), /is a posting — nothing ever arrives as a posting/);
  const unknown = [...book, { provider: 'plaid', code: 'plaid', resource: 'balance', kind: 'ledger' as unknown as Rule['kind'], means: '', source: 'added' as const }];
  assert.match(providersLaw({ throwOnFail: false, book: unknown }).join('\n'), /unknown kind "ledger"/);
  const foreign = [...book, { provider: 'yodlee', code: 'yodlee', resource: 'transaction', kind: 'event' as const, means: '', source: 'added' as const }];
  assert.match(providersLaw({ throwOnFail: false, book: foreign }).join('\n'), /"yodlee" is not a provider the menu names/);
  assert.throws(() => providersLaw({ book: missing }), /PROVIDER VOCABULARY LAW failed/);
});

test("the Prisma enum arrival_kind and the migration's CREATE TYPE carry the six kinds in the deck's order; the migration's UPDATEs are rules the book holds", () => {
  const schema = readFileSync(resolve(ROOT, 'prisma/schema.prisma'), 'utf8');
  const enumBlock = schema.match(/enum arrival_kind \{\n([\s\S]*?)\n\}/);
  assert.ok(enumBlock, 'enum arrival_kind exists');
  assert.deepEqual(enumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean), [...ARRIVAL_KINDS]);
  assert.match(schema, /\n  kind          arrival_kind\n/, 'arrivals.kind is NOT NULL (no ?)');
  const dir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_arrival_kind'));
  assert.ok(dir, 'the arrival_kind migration exists');
  const sql = readFileSync(resolve(ROOT, 'prisma/migrations', dir, 'migration.sql'), 'utf8');
  assert.deepEqual(sql.match(/CREATE TYPE arrival_kind AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, '')), [...ARRIVAL_KINDS]);
  const applied = [...sql.matchAll(/UPDATE arrivals SET kind = '([a-z]+)'\s+WHERE kind IS NULL AND provider = '([a-z_]+)' AND resource = '([a-z_]+)';/g)].map((m) => [m[2], m[3], m[1]]);
  assert.deepEqual(applied, [['plaid', 'transaction', 'event'], ['plaid', 'investment_transaction', 'event'], ['plaid', 'security', 'reference']]);
  for (const [provider, resource, kind] of applied) assert.equal(kindOf(provider, resource), kind);
  assert.match(sql, /RAISE EXCEPTION 'arrival_kind: % arrivals carry no rule/, 'a row the book does not cover stops the migration');
  assert.ok(sql.indexOf('RAISE EXCEPTION \'arrival_kind') < sql.indexOf('ALTER TABLE arrivals ALTER COLUMN kind SET NOT NULL'), 'the check runs before SET NOT NULL');
  assert.match(sql, /OR NEW\.kind\s+IS DISTINCT FROM OLD\.kind THEN/, 'promise 1 freezes kind');
});

test("the Prisma enum arrival_provider and the migration's CREATE TYPE carry the code set exactly, alphabetical", () => {
  const schema = readFileSync(resolve(ROOT, 'prisma/schema.prisma'), 'utf8');
  const enumBlock = schema.match(/enum arrival_provider \{\n([\s\S]*?)\n\}/);
  assert.ok(enumBlock, 'enum arrival_provider exists');
  const enumValues = enumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(enumValues, PROVIDER_CODES);
  const dir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_arrivals'));
  assert.ok(dir, 'the arrivals migration exists');
  const sql = readFileSync(resolve(ROOT, 'prisma/migrations', dir, 'migration.sql'), 'utf8');
  const typeValues = sql.match(/CREATE TYPE arrival_provider AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, ''));
  assert.deepEqual(typeValues, PROVIDER_CODES);
});
