import { ValidationError } from '@/lib/errors/ValidationError';
import { FAMILY_RULES, assertCodeInFamily, familyOfAccountType, isFamily, parseCode, renderCode, type Family } from './scheme';
import type { SeedPlanRow } from './seedSets';

/**
 * COA-01 — add / rename / retire an account, and apply a seed plan, over a
 * small port (ChartDb) so the policies run hermetically in node:test and the
 * routes bind them to Prisma (prismaChartDb.ts). Every rule fails loud with a
 * ValidationError the route answers verbatim at its status (failClosed).
 *
 *   add     — the code follows the ENTITY's scheme (parseCode), sits in its
 *             family's range (assertCodeInFamily), and is unique in the
 *             entity's chart — a retired account at that code is a 409 with
 *             the restore hint, never silently re-added;
 *   rename  — name / code / sub / family; a new code obeys the same rules;
 *   retire  — is_archived flips, NOTHING else: the row, its balance and its
 *             ledger history stay (ledger_entries.account is Restrict; the
 *             no_ledger_updates trigger refuses edits) — retired accounts
 *             leave every categorization list and the auto-categorizer skips
 *             their mappings.
 */

export interface ChartAccountRow {
  id: string;
  userId: string;
  entity_id: string;
  entity_type: string | null;
  code: string;
  name: string;
  account_type: string;
  balance_type: string;
  sub_type: string | null;
  module: string | null;
  settled_balance: bigint;
  is_archived: boolean;
}

export interface NewChartAccount {
  userId: string;
  entity_id: string;
  entity_type: string | null;
  code: string;
  name: string;
  account_type: Family;
  balance_type: 'D' | 'C';
  sub_type: string | null;
  module: string | null;
}

export type ChartPatch = Partial<Pick<ChartAccountRow, 'name' | 'code' | 'sub_type' | 'account_type' | 'balance_type' | 'is_archived'>>;

export interface ChartDb {
  findByCode(userId: string, entityId: string, code: string): Promise<ChartAccountRow | null>;
  insert(row: NewChartAccount): Promise<ChartAccountRow>;
  update(id: string, patch: ChartPatch): Promise<ChartAccountRow>;
}

export interface EntityRef {
  id: string;
  entity_type: string | null;
}

const NAME_MAX = 255;
const SUB_MAX = 50;

function parseName(input: unknown): string {
  const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new ValidationError('name is required', { field: 'name' });
  if (name.length > NAME_MAX) throw new ValidationError(`name is longer than ${NAME_MAX} characters`, { field: 'name' });
  return name;
}

function parseSub(input: unknown): string | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') throw new ValidationError('subType must be a string or null', { field: 'subType' });
  const s = input.trim();
  if (s.length > SUB_MAX) throw new ValidationError(`subType is longer than ${SUB_MAX} characters`, { field: 'subType' });
  return s || null;
}

function parseFamily(input: unknown): Family {
  const f = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!f) throw new ValidationError('family is required — asset, liability, equity, revenue or expense', { field: 'family' });
  if (!isFamily(f)) throw new ValidationError(`family "${input}" is not one of asset, liability, equity, revenue, expense`, { field: 'family' });
  return f;
}

/** 409 on a code already in the entity's chart — active or retired, each with its own line. */
async function assertCodeFree(db: ChartDb, userId: string, entity: EntityRef, code: string, exceptId?: string): Promise<void> {
  const existing = await db.findByCode(userId, entity.id, code);
  if (!existing || existing.id === exceptId) return;
  const rendered = renderCode(code, entity.entity_type);
  if (existing.is_archived) {
    throw new ValidationError(`code ${rendered} is retired as "${existing.name}" — restore it instead of adding it again`, { status: 409, field: 'code' });
  }
  throw new ValidationError(`code ${rendered} is already "${existing.name}"`, { status: 409, field: 'code' });
}

export interface AddAccountInput {
  userId: string;
  entity: EntityRef;
  code: unknown;
  name: unknown;
  family: unknown;
  subType?: unknown;
}

export async function addAccount(db: ChartDb, input: AddAccountInput): Promise<ChartAccountRow> {
  const family = parseFamily(input.family);
  const code = parseCode(input.code, input.entity.entity_type);
  assertCodeInFamily(code, family);
  const name = parseName(input.name);
  const sub = parseSub(input.subType);
  await assertCodeFree(db, input.userId, input.entity, code);
  return db.insert({
    userId: input.userId,
    entity_id: input.entity.id,
    entity_type: input.entity.entity_type,
    code,
    name,
    account_type: family,
    balance_type: FAMILY_RULES[family].balanceType,
    sub_type: sub,
    module: null,
  });
}

export interface RenameAccountInput {
  userId: string;
  entity: EntityRef;
  account: ChartAccountRow;
  name?: unknown;
  code?: unknown;
  family?: unknown;
  subType?: unknown;
}

export async function renameAccount(db: ChartDb, input: RenameAccountInput): Promise<ChartAccountRow> {
  const { account } = input;
  const patch: ChartPatch = {};
  const family = input.family === undefined ? familyOfAccountType(account.account_type) : parseFamily(input.family);
  const code = input.code === undefined ? account.code : parseCode(input.code, input.entity.entity_type);
  if (code !== account.code || input.family !== undefined) {
    assertCodeInFamily(code, family);
  }
  if (code !== account.code) {
    await assertCodeFree(db, input.userId, input.entity, code, account.id);
    patch.code = code;
  }
  if (input.family !== undefined && family !== account.account_type) {
    patch.account_type = family;
    patch.balance_type = FAMILY_RULES[family].balanceType;
  }
  if (input.name !== undefined) patch.name = parseName(input.name);
  if (input.subType !== undefined) patch.sub_type = parseSub(input.subType);
  if (Object.keys(patch).length === 0) throw new ValidationError('nothing to change — send a name, code, family or subType', { status: 400 });
  return db.update(account.id, patch);
}

/** Retire (or restore) — the archived flag only; balance and history untouched by construction. */
export async function retireAccount(db: ChartDb, account: ChartAccountRow, retired: boolean): Promise<ChartAccountRow> {
  if (account.is_archived === retired) return account;
  return db.update(account.id, { is_archived: retired });
}

/** Insert the plan's 'create' rows; every other fate is left exactly as found. */
export async function applySeed(db: ChartDb, ctx: { userId: string; entity: EntityRef }, plan: readonly SeedPlanRow[]): Promise<ChartAccountRow[]> {
  const created: ChartAccountRow[] = [];
  for (const row of plan) {
    if (row.action !== 'create') continue;
    assertCodeInFamily(row.code, row.family);
    await assertCodeFree(db, ctx.userId, ctx.entity, row.code);
    created.push(await db.insert({
      userId: ctx.userId,
      entity_id: ctx.entity.id,
      entity_type: ctx.entity.entity_type,
      code: row.code,
      name: row.name,
      account_type: row.family,
      balance_type: FAMILY_RULES[row.family].balanceType,
      sub_type: row.subType,
      module: row.module,
    }));
  }
  return created;
}
