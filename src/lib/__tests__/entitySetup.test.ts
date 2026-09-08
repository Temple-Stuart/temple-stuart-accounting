import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import { DEFAULT_COA } from '../coaDefaults';
import { SOLE_PROP_STANDARD } from '../seed-coa-templates';
import { familyOfCode } from '../coa/scheme';
import { ENTITY_KINDS, ENTITY_NAME_MAX, UNSUPPORTED_ENTITY_LINE, isEntityKindType } from '../entities/kinds';
import { createEntity, mappingMultiplier, parseNewEntity, starterChartFor, type EntityDb, type EntityRecord } from '../entities/setup';
import { FakeChart } from './fakeChart';

// SELL-04 — the entity setup over its port. Hermetic, with the table's own rule
// (entities @@unique([userId, name])) and rows that carry their user.

class FakeEntityDb implements EntityDb {
  rows: EntityRecord[] = [];
  mappings: Array<{ account_id: string; tax_form: string; form_line: string; tax_year: number; multiplier: number; created_by: string }> = [];
  initialized: string[] = [];
  chart = new FakeChart();
  private seq = 0;
  async count(userId: string) { return this.rows.filter((r) => r.userId === userId).length; }
  async findByName(userId: string, name: string) { return this.rows.find((r) => r.userId === userId && r.name.toLowerCase() === name.toLowerCase()) ?? null; }
  async insert(row: { userId: string; name: string; entity_type: 'personal' | 'sole_prop'; is_default: boolean }) {
    if (this.rows.some((r) => r.userId === row.userId && r.name === row.name)) throw new Error('unique violation (userId, name)');
    const rec = { id: `ent-${++this.seq}`, ...row };
    this.rows.push(rec);
    return rec;
  }
  async insertTaxMapping(row: { account_id: string; tax_form: string; form_line: string; tax_year: number; multiplier: number; created_by: string }) { this.mappings.push(row); }
  async markInitialized(userId: string) { this.initialized.push(userId); }
}

const refuses = (fn: () => unknown, status: number, field: string, re: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof ValidationError && e.status === status && e.field === field && re.test(e.message));

test('the kinds are the two the routes read; the type is validated with the honest line for an LLC / S-corp; the name is required and bounded', () => {
  assert.deepEqual(ENTITY_KINDS.map((k) => k.type), ['personal', 'sole_prop']);
  assert.deepEqual(ENTITY_KINDS.map((k) => k.letter), ['P', 'B']);
  assert.ok(isEntityKindType('sole_prop') && !isEntityKindType('llc') && !isEntityKindType('trading'));
  assert.deepEqual(parseNewEntity({ name: '  My   Shop ', entity_type: 'sole_prop' }), { name: 'My Shop', entity_type: 'sole_prop' });
  refuses(() => parseNewEntity({ name: 'Co', entity_type: 'llc' }), 400, 'entity_type', /Personal and sole proprietorship only/);
  assert.match(UNSUPPORTED_ENTITY_LINE, /Schedule C/);
  refuses(() => parseNewEntity({ name: 'Co', entity_type: 's_corp' }), 400, 'entity_type', /S-corp/);
  refuses(() => parseNewEntity({ name: 'Co' }), 400, 'entity_type', /required/);
  refuses(() => parseNewEntity({ entity_type: 'personal' }), 400, 'name', /required/);
  refuses(() => parseNewEntity({ name: 'x'.repeat(ENTITY_NAME_MAX + 1), entity_type: 'personal' }), 400, 'name', /longer than 100/);
  refuses(() => parseNewEntity(null), 400, 'entity_type', /required/);
});

test('the starter charts come from the two existing seeds — every code in its family; the sole-prop rows carry their Schedule C lines', () => {
  const personal = starterChartFor('personal');
  assert.equal(personal.length, DEFAULT_COA.length);
  assert.deepEqual(personal.map((a) => a.code), DEFAULT_COA.map((a) => a.code));
  for (const a of personal) assert.equal(familyOfCode(a.code), a.family);
  assert.ok(personal.every((a) => a.tax_form_line === null));
  const sole = starterChartFor('sole_prop');
  assert.equal(sole.length, SOLE_PROP_STANDARD.accounts.length);
  for (const a of sole) assert.equal(familyOfCode(a.code), a.family);
  assert.ok(sole.filter((a) => a.tax_form_line).length >= 20, 'the Schedule C lines ride the sole-prop rows');
  assert.equal(sole.find((a) => a.name === 'Service Revenue')?.tax_form_line, 'schedule_c_line_1');
  assert.equal(mappingMultiplier('Meals (Business)'), 0.5);
  assert.equal(mappingMultiplier('Advertising'), 1);
});

test('create: the first entity is the default and marks bookkeeping initialized; the chart and the Schedule C mappings land with it', async () => {
  const db = new FakeEntityDb();
  const first = await createEntity(db, { userId: 'user-a', body: { name: 'Personal', entity_type: 'personal' }, taxYear: 2026 });
  assert.equal(first.isFirst, true);
  assert.equal(first.entity.is_default, true);
  assert.deepEqual(db.initialized, ['user-a']);
  assert.equal(first.chart.created, DEFAULT_COA.length);
  assert.equal(first.chart.mappings, 0);
  assert.ok(db.chart.accounts.every((a) => a.userId === 'user-a' && a.entity_id === first.entity.id && a.entity_type === 'personal'));

  const second = await createEntity(db, { userId: 'user-a', body: { name: 'Business', entity_type: 'sole_prop' }, taxYear: 2026 });
  assert.equal(second.isFirst, false);
  assert.equal(second.entity.is_default, false);
  assert.deepEqual(db.initialized, ['user-a'], 'marked once');
  assert.equal(second.chart.created, SOLE_PROP_STANDARD.accounts.length);
  assert.equal(second.chart.mappings, SOLE_PROP_STANDARD.accounts.filter((a) => a.tax_form_line).length);
  assert.ok(db.mappings.every((m) => m.tax_form === 'schedule_c' && m.tax_year === 2026 && m.created_by === 'user-a' && /^line_/.test(m.form_line)));
  const meals = db.chart.accounts.find((a) => a.name === 'Meals (Business)');
  assert.equal(db.mappings.find((m) => m.account_id === meals?.id)?.multiplier, 0.5);
  assert.equal(db.mappings.find((m) => m.account_id === meals?.id)?.form_line, 'line_24b');
});

test('create is user-scoped: a duplicate name is a 409 for THAT user only; two users with the same name never share a row', async () => {
  const db = new FakeEntityDb();
  await createEntity(db, { userId: 'user-a', body: { name: 'Business', entity_type: 'sole_prop' }, taxYear: 2026 });
  await assert.rejects(
    () => createEntity(db, { userId: 'user-a', body: { name: 'business', entity_type: 'sole_prop' }, taxYear: 2026 }),
    (e: unknown) => e instanceof ValidationError && e.status === 409 && e.field === 'name' && /already have an entity named "Business"/.test(e.message),
  );
  const b = await createEntity(db, { userId: 'user-b', body: { name: 'Business', entity_type: 'sole_prop' }, taxYear: 2026 });
  assert.equal(b.isFirst, true, "user-b's first entity — user-a's rows do not count");
  assert.equal(b.entity.is_default, true);
  assert.equal(db.rows.length, 2);
  assert.notEqual(db.rows[0].id, db.rows[1].id);
  assert.deepEqual(db.rows.map((r) => r.userId), ['user-a', 'user-b']);
  const byUser = (u: string) => db.chart.accounts.filter((a) => a.userId === u);
  assert.equal(byUser('user-a').length, SOLE_PROP_STANDARD.accounts.length);
  assert.equal(byUser('user-b').length, SOLE_PROP_STANDARD.accounts.length);
  assert.ok(byUser('user-a').every((a) => a.entity_id === db.rows[0].id) && byUser('user-b').every((a) => a.entity_id === db.rows[1].id));
  // a refused input creates nothing
  await assert.rejects(() => createEntity(db, { userId: 'user-c', body: { name: 'Co', entity_type: 'llc' }, taxYear: 2026 }), ValidationError);
  assert.equal(db.rows.filter((r) => r.userId === 'user-c').length, 0);
  assert.deepEqual(db.initialized, ['user-a', 'user-b']);
});
