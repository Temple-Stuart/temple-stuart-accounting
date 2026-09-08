import { ValidationError } from '@/lib/errors/ValidationError';
import { deriveAccountString, entityLetter } from '@/lib/accountString';

/**
 * COA-01 — the chart of accounts' code scheme, in ONE place.
 *
 * A code renders as <letter>-<four digits> (src/lib/accountString.ts): the
 * letter is the ENTITY's — personal → P, sole_prop → B, trading → T — and is
 * never stored; chart_of_accounts.code holds the four digits. The first digit
 * is the statement family, the rule every seed in the repo follows
 * (prisma/seed-coa-complete.ts:41-143 · prisma/seed-trading-coa.ts:6-60 ·
 * src/lib/coaDefaults.ts:14-51 · prisma/migrations/20260324110000_add_travel_coa_codes):
 *
 *   1xxx asset · 2xxx liability · 3xxx equity · 4xxx revenue · 5xxx–9xxx expense
 *
 * The family range is THE gate: a code outside its family's range fails loud
 * (assertCodeInFamily), a letter that is not the entity's fails loud
 * (parseCode), anything but four digits fails loud. The expense blocks under
 * the family (EXPENSE_BLOCKS) are the conventions the seeds evidence per
 * letter — they guide the add form and the seed sets; they are not a gate.
 *
 * Client-safe: no prisma, no server-only import (the add form reads it).
 */

export type Family = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export const FAMILIES: readonly Family[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export interface FamilyRule {
  readonly family: Family;
  readonly label: string;
  readonly from: number;
  readonly to: number;
  /** The normal balance — D for asset/expense, C for liability/equity/revenue (chart_of_accounts.balance_type). */
  readonly balanceType: 'D' | 'C';
  readonly statement: 'Balance sheet' | 'Income statement';
}

export const FAMILY_RULES: Readonly<Record<Family, FamilyRule>> = {
  asset: { family: 'asset', label: 'Assets', from: 1000, to: 1999, balanceType: 'D', statement: 'Balance sheet' },
  liability: { family: 'liability', label: 'Liabilities', from: 2000, to: 2999, balanceType: 'C', statement: 'Balance sheet' },
  equity: { family: 'equity', label: 'Equity', from: 3000, to: 3999, balanceType: 'C', statement: 'Balance sheet' },
  revenue: { family: 'revenue', label: 'Revenue', from: 4000, to: 4999, balanceType: 'C', statement: 'Income statement' },
  expense: { family: 'expense', label: 'Expenses', from: 5000, to: 9999, balanceType: 'D', statement: 'Income statement' },
};

export function isFamily(x: unknown): x is Family {
  return typeof x === 'string' && (FAMILIES as readonly string[]).includes(x);
}

export type EntityLetter = 'P' | 'B' | 'T';

export interface CodeBlock {
  readonly from: number;
  readonly to: number;
  readonly label: string;
  /** Where the repo evidences the block — a seed, a migration, a ruling. */
  readonly evidence: string;
}

/** The expense blocks each letter's seeds use. Guidance for the form and the seed sets; the family range is the gate. */
export const EXPENSE_BLOCKS: Readonly<Record<EntityLetter, readonly CodeBlock[]>> = {
  P: [
    { from: 5000, to: 5999, label: 'Trading & investment costs', evidence: 'prisma/seed-coa-complete.ts:78-80' },
    { from: 6000, to: 6999, label: 'Variable living costs', evidence: 'prisma/seed-coa-complete.ts:81-88' },
    { from: 7000, to: 7999, label: 'Travel (the default chart, legacy codes)', evidence: 'src/lib/coaDefaults.ts:43-50' },
    { from: 8000, to: 8999, label: 'Fixed & personal costs', evidence: 'prisma/seed-coa-complete.ts:89-100' },
    { from: 9000, to: 9999, label: 'Travel', evidence: 'src/lib/travelCOA.ts coaPersonal · migration 20260324110000' },
  ],
  B: [
    { from: 6000, to: 6999, label: 'Operating expenses', evidence: 'prisma/seed-coa-complete.ts:126-142' },
    { from: 6200, to: 6299, label: 'Fixed costs — the platform\'s own bills', evidence: 'COA-01 ruling: the B-6200 fixed-cost family' },
    { from: 9000, to: 9999, label: 'Travel', evidence: 'src/lib/travelCOA.ts coaBusiness · migration 20260324110000' },
  ],
  T: [
    { from: 5000, to: 5999, label: 'Trading losses', evidence: 'prisma/seed-trading-coa.ts:39-47' },
    { from: 6000, to: 6999, label: 'Trading expenses', evidence: 'prisma/seed-trading-coa.ts:48-59' },
  ],
};

/** The entity's code letter, or null for an entity type the scheme does not letter (accountString.ts renders no letter for it). */
export function letterFor(entityType: string | null | undefined): EntityLetter | null {
  const l = entityLetter(entityType);
  return l === 'P' || l === 'B' || l === 'T' ? l : null;
}

const BARE = /^(\d{4})$/;
const LETTERED = /^([PBT])-(\d{4})$/;

/**
 * The four stored digits from what a user typed — "6250" or "B-6250". A letter
 * must be THIS entity's; a code outside 1000–9999 or not four digits fails.
 */
export function parseCode(input: unknown, entityType: string | null | undefined): string {
  const raw = typeof input === 'string' ? input.trim().toUpperCase() : '';
  if (!raw) throw new ValidationError('code is required — four digits (6250) or the entity letter and four digits (B-6250)', { field: 'code' });
  let digits: string;
  let letter: EntityLetter | null = null;
  const bare = BARE.exec(raw);
  if (bare) {
    digits = bare[1];
  } else {
    const m = LETTERED.exec(raw);
    if (!m) {
      throw new ValidationError(`code "${raw}" is not in the scheme — four digits (6250) or the entity letter and four digits (B-6250)`, { field: 'code' });
    }
    letter = m[1] as EntityLetter;
    digits = m[2];
  }
  const mine = letterFor(entityType);
  if (letter && !mine) {
    throw new ValidationError(`this entity (${entityType ?? 'unknown type'}) has no code letter — enter the four digits only`, { field: 'code' });
  }
  if (letter && mine && letter !== mine) {
    throw new ValidationError(`code ${raw} carries the ${letter}- letter; this is a ${mine}- chart (${entityType}) — enter ${mine}-${digits} or ${digits}`, { field: 'code' });
  }
  if (digits[0] === '0') {
    throw new ValidationError(`code ${digits} is outside every family — codes run 1000–9999`, { field: 'code' });
  }
  return digits;
}

/** The family a four-digit code reads as, from its first digit. */
export function familyOfCode(code: string): Family {
  switch (code[0]) {
    case '1': return 'asset';
    case '2': return 'liability';
    case '3': return 'equity';
    case '4': return 'revenue';
    case '5': case '6': case '7': case '8': case '9': return 'expense';
    default:
      throw new ValidationError(`code ${code} is outside every family — codes run 1000–9999`, { field: 'code' });
  }
}

/** Fail loud on a code outside its family's range. */
export function assertCodeInFamily(code: string, family: Family): void {
  const rule = FAMILY_RULES[family];
  const n = Number(code);
  if (!Number.isInteger(n) || n < rule.from || n > rule.to) {
    throw new ValidationError(
      `code ${code} is outside the ${family} range ${rule.from}–${rule.to} — it reads as ${familyOfCode(code)}`,
      { field: 'code' },
    );
  }
}

/** The family a stored account_type names, or a loud failure for a value outside the five. */
export function familyOfAccountType(accountType: string): Family {
  const f = accountType.toLowerCase();
  if (!isFamily(f)) throw new ValidationError(`account_type "${accountType}" is not one of ${FAMILIES.join(', ')}`, { field: 'family' });
  return f;
}

/** The rendered code — the entity letter and the digits (accountString.ts). */
export function renderCode(code: string, entityType: string | null | undefined, subType?: string | null): string {
  return deriveAccountString({ entityType, code, subType });
}

export function blocksFor(entityType: string | null | undefined): readonly CodeBlock[] {
  const l = letterFor(entityType);
  return l ? EXPENSE_BLOCKS[l] : [];
}

/** One line for the add form: the family's range, and for expenses this letter's blocks. */
export function schemeHint(entityType: string | null | undefined, family: Family): string {
  const rule = FAMILY_RULES[family];
  const l = letterFor(entityType);
  const prefix = l ? `${l}-` : '';
  const range = `${prefix}${rule.from}–${prefix}${rule.to}`;
  if (family !== 'expense') return `${rule.label} · ${range} · ${rule.statement}`;
  const blocks = blocksFor(entityType).map((b) => `${b.from}–${b.to} ${b.label}`).join(' · ');
  return blocks ? `${rule.label} · ${range} · ${blocks}` : `${rule.label} · ${range} · ${rule.statement}`;
}
