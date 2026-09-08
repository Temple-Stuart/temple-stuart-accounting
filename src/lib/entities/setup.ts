import { ValidationError } from '@/lib/errors/ValidationError';
import { DEFAULT_COA } from '@/lib/coaDefaults';
import { SOLE_PROP_STANDARD } from '@/lib/seed-coa-templates';
import { parseTaxFormLine } from '@/lib/seed-entities';
import { FAMILY_RULES, assertCodeInFamily, familyOfAccountType, type Family } from '@/lib/coa/scheme';
import type { ChartDb } from '@/lib/coa/accounts';
import { ENTITY_KINDS, ENTITY_NAME_MAX, UNSUPPORTED_ENTITY_LINE, entityKind, type EntityKindType } from './kinds';

/**
 * SELL-04 — ENTITY SETUP, the product's one creator of an entity (POST
 * /api/entities). Over a small port so the rules run hermetically:
 *
 *   • the kind is one the routes can read (ENTITY_KINDS — personal, sole_prop;
 *     anything else is refused with the honest line);
 *   • the name is 1–ENTITY_NAME_MAX characters and unique for the user
 *     (entities @@unique([userId, name]) — a duplicate is a 409, never a
 *     silent second row);
 *   • the user's FIRST entity is their default (what commit-to-ledger,
 *     bank-reconciliations and the pipeline resolve by);
 *   • the entity gets its STARTER CHART in the same transaction — personal:
 *     DEFAULT_COA, the chart every new user was seeded with until now
 *     (src/lib/coaDefaults.ts); sole_prop: the Sole Proprietor Standard
 *     template (src/lib/seed-coa-templates.ts) with its Schedule C line
 *     mappings for the tax year given (schedule-c-service reads
 *     account_tax_mappings, not the chart row) — so the Tax and Business
 *     answers have lines to read the day the entity exists;
 *   • when it is the user's first, bookkeeping_initialized is set (what the
 *     old silent path set).
 *
 * Every row is the caller's (userId on the entity, on every chart row) — the
 * port is handed the id and never a query of its own to make.
 */

export interface NewEntity {
  name: string;
  entity_type: EntityKindType;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

export function parseNewEntity(body: unknown): NewEntity {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const kind = entityKind(b.entity_type);
  if (!kind) {
    if (typeof b.entity_type === 'string' && b.entity_type.trim()) throw new ValidationError(UNSUPPORTED_ENTITY_LINE, { field: 'entity_type' });
    throw new ValidationError(`entity_type is required — ${ENTITY_KINDS.map((k) => k.type).join(' or ')}`, { field: 'entity_type' });
  }
  const name = typeof b.name === 'string' ? norm(b.name) : '';
  if (!name) throw new ValidationError('name is required', { field: 'name' });
  if (name.length > ENTITY_NAME_MAX) throw new ValidationError(`name is longer than ${ENTITY_NAME_MAX} characters`, { field: 'name' });
  return { name, entity_type: kind.type };
}

export interface StarterAccount {
  code: string;
  name: string;
  family: Family;
  balance_type: 'D' | 'C';
  sub_type: string | null;
  /** Schedule C line for the mapping (sole_prop rows), e.g. "schedule_c_line_8". */
  tax_form_line: string | null;
}

/** The starter chart per kind — from the two existing seeds, never retyped. */
export function starterChartFor(type: EntityKindType): readonly StarterAccount[] {
  if (type === 'personal') {
    return DEFAULT_COA.map((a) => ({
      code: a.code,
      name: a.name,
      family: familyOfAccountType(a.account_type),
      balance_type: FAMILY_RULES[familyOfAccountType(a.account_type)].balanceType,
      sub_type: null,
      tax_form_line: null,
    }));
  }
  return SOLE_PROP_STANDARD.accounts.map((a) => ({
    code: a.code,
    name: a.name,
    family: familyOfAccountType(a.account_type),
    balance_type: a.balance_type === 'C' ? 'C' : 'D',
    sub_type: a.sub_type ?? null,
    tax_form_line: a.tax_form_line ?? null,
  }));
}

/** The multiplier a mapping carries — meals are 50% deductible (IRC §274(n)); the seed script's rule, kept. */
export function mappingMultiplier(accountName: string): number {
  return accountName === 'Meals (Business)' ? 0.5 : 1;
}

export interface EntityRecord {
  id: string;
  userId: string;
  name: string;
  entity_type: string;
  is_default: boolean;
}

export interface EntityDb {
  /** How many entities the user has (0 → this one becomes the default). */
  count(userId: string): Promise<number>;
  /** An existing entity of the user's by name (case-insensitive) — a duplicate is refused. */
  findByName(userId: string, name: string): Promise<EntityRecord | null>;
  insert(row: { userId: string; name: string; entity_type: EntityKindType; is_default: boolean }): Promise<EntityRecord>;
  /** The chart port (COA-01 ChartDb) bound to the same transaction. */
  chart: ChartDb;
  insertTaxMapping(row: { account_id: string; tax_form: string; form_line: string; tax_year: number; multiplier: number; created_by: string }): Promise<void>;
  markInitialized(userId: string): Promise<void>;
}

export interface CreatedEntity {
  entity: EntityRecord;
  chart: { created: number; mappings: number };
  isFirst: boolean;
}

export async function createEntity(db: EntityDb, input: { userId: string; body: unknown; taxYear: number }): Promise<CreatedEntity> {
  const reg = parseNewEntity(input.body);
  const existing = await db.findByName(input.userId, reg.name);
  if (existing) throw new ValidationError(`you already have an entity named "${existing.name}"`, { status: 409, field: 'name' });
  const isFirst = (await db.count(input.userId)) === 0;
  const entity = await db.insert({ userId: input.userId, name: reg.name, entity_type: reg.entity_type, is_default: isFirst });

  let created = 0;
  let mappings = 0;
  for (const a of starterChartFor(reg.entity_type)) {
    assertCodeInFamily(a.code, a.family);
    const row = await db.chart.insert({
      userId: input.userId,
      entity_id: entity.id,
      entity_type: entity.entity_type,
      code: a.code,
      name: a.name,
      account_type: a.family,
      balance_type: a.balance_type,
      sub_type: a.sub_type,
      module: null,
    });
    created += 1;
    if (a.tax_form_line) {
      const { tax_form, form_line } = parseTaxFormLine(a.tax_form_line);
      await db.insertTaxMapping({ account_id: row.id, tax_form, form_line, tax_year: input.taxYear, multiplier: mappingMultiplier(a.name), created_by: input.userId });
      mappings += 1;
    }
  }
  if (isFirst) await db.markInitialized(input.userId);
  return { entity, chart: { created, mappings }, isFirst };
}
