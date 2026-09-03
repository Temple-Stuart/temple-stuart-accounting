import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROVIDERS, PROVIDER_CODES, PROVIDER_MENU, ROUTING_RULES, providerByCode, providerByDeck, providerCode, providersLaw } from '../providers';

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
  assert.equal(PROVIDERS.flatMap((p) => p.resources).length, ROUTING_RULES.length);
  assert.deepEqual(providerByDeck('plaid')?.resources, ['transaction', 'account', 'holding']);
  assert.deepEqual(providerByDeck('teller')?.resources, []);
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
