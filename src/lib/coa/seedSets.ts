import { ValidationError } from '@/lib/errors/ValidationError';
import { FAMILY_RULES, assertCodeInFamily, letterFor, type EntityLetter, type Family } from './scheme';

/**
 * COA-01 — the ruled seed sets, as data. Applied IN THE PRODUCT (POST
 * /api/chart-of-accounts/seed), per user, per entity, only where absent — the
 * honest path: a migration cannot see a user's chart, cannot tell "absent"
 * from "this code is already something else", and reports nothing. planSeed
 * names every row's fate (create / exists / collision / retired) BEFORE a
 * single insert; a collision is never overwritten.
 *
 * Codes come from the scheme, not invented:
 *   • the B-6200 fixed-cost family (the ruling's words) — the eight bills in
 *     the ruling's order at steps of ten from 6210, which puts Finnhub at
 *     B-6250, the code the ruling names for it;
 *   • International transaction fees — the next travel code after the 98xx
 *     fees block (9810 communication · 9820 insurance & fees · 9830 groceries,
 *     src/lib/travelCOA.ts) → 9840, sub_type 'travel' / module 'trips' like
 *     every travel row the 20260324110000 migration wrote;
 *   • Gym membership, Pet supplies & food — the next fixed & personal codes
 *     after 8200 Phone & Internet (prisma/seed-coa-complete.ts:99) → 8210, 8220.
 */

export interface SeedAccount {
  readonly code: string;
  readonly name: string;
  readonly family: Family;
  readonly subType: string | null;
  readonly module: string | null;
}

export interface SeedSet {
  readonly key: string;
  readonly label: string;
  /** The entity letters this set may be applied to. */
  readonly entityLetters: readonly EntityLetter[];
  readonly why: string;
  readonly accounts: readonly SeedAccount[];
}

const fixed = (code: string, name: string): SeedAccount => ({ code, name, family: 'expense', subType: 'fixed', module: null });
const travel = (code: string, name: string): SeedAccount => ({ code, name, family: 'expense', subType: 'travel', module: 'trips' });
const personal = (code: string, name: string): SeedAccount => ({ code, name, family: 'expense', subType: null, module: null });

export const SEED_SETS: readonly SeedSet[] = [
  {
    key: 'platform-fixed-costs',
    label: 'Platform fixed costs — the B-6200 family',
    entityLetters: ['B'],
    why: "The platform's own bills, one account each, so a quarterly plan is one line — not a per-call account.",
    accounts: [
      fixed('6210', 'Vercel'),
      fixed('6220', 'Azure Postgres'),
      fixed('6230', 'GitHub'),
      fixed('6240', 'Claude seat'),
      fixed('6250', 'Finnhub Premium (quarterly plan)'),
      fixed('6260', 'tastytrade data'),
      fixed('6270', 'Resend'),
      fixed('6280', 'Voyage'),
    ],
  },
  {
    key: 'travel-intl-fees',
    label: 'Travel — International transaction fees',
    entityLetters: ['P', 'B'],
    why: 'Card and ATM fees abroad are a travel cost of their own, not insurance.',
    accounts: [travel('9840', 'International transaction fees')],
  },
  {
    key: 'personal-additions',
    label: 'Personal — Gym membership, Pet supplies & food',
    entityLetters: ['P'],
    why: 'Two fixed personal costs the default chart lacks.',
    accounts: [personal('8210', 'Gym membership'), personal('8220', 'Pet supplies & food')],
  },
];

export function seedSet(key: string): SeedSet | undefined {
  return SEED_SETS.find((s) => s.key === key);
}

export function seedSetsFor(entityType: string | null | undefined): SeedSet[] {
  const l = letterFor(entityType);
  return l ? SEED_SETS.filter((s) => s.entityLetters.includes(l)) : [];
}

export type SeedAction = 'create' | 'exists' | 'collision' | 'retired';

export interface SeedPlanRow {
  readonly code: string;
  readonly name: string;
  readonly family: Family;
  readonly subType: string | null;
  readonly module: string | null;
  readonly action: SeedAction;
  /** For exists / collision / retired: the row already at that code. */
  readonly existingId?: string;
  readonly existingName?: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Every row's fate against the entity's chart, before any write:
 *   create    — no account at that code;
 *   exists    — the same name at that code, active (nothing to do);
 *   retired   — the same name at that code, archived (restore it; never re-add);
 *   collision — another name at that code (never overwritten; reported).
 */
export function planSeed(
  set: SeedSet,
  entity: { entity_type: string | null },
  existing: ReadonlyArray<{ id: string; code: string; name: string; is_archived: boolean }>,
): SeedPlanRow[] {
  const letter = letterFor(entity.entity_type);
  if (!letter || !set.entityLetters.includes(letter)) {
    throw new ValidationError(
      `the set "${set.label}" applies to ${set.entityLetters.map((l) => `${l}-`).join(' / ')} charts; this entity is ${letter ? `${letter}-` : entity.entity_type ?? 'unlettered'}`,
      { field: 'setKey' },
    );
  }
  const byCode = new Map(existing.map((a) => [a.code, a]));
  return set.accounts.map((a) => {
    const row = byCode.get(a.code);
    if (!row) return { ...a, action: 'create' };
    if (norm(row.name) !== norm(a.name)) return { ...a, action: 'collision', existingId: row.id, existingName: row.name };
    return { ...a, action: row.is_archived ? 'retired' : 'exists', existingId: row.id, existingName: row.name };
  });
}

/** The law over the sets — runs at import: every code in its family's range, unique within its set, Finnhub at 6250. */
export function assertSeedSetsLaw(sets: readonly SeedSet[] = SEED_SETS): void {
  const keys = new Set<string>();
  for (const set of sets) {
    if (keys.has(set.key)) throw new Error(`seed sets law: duplicate set key ${set.key}`);
    keys.add(set.key);
    if (set.entityLetters.length === 0) throw new Error(`seed sets law: ${set.key} applies to no entity letter`);
    const codes = new Set<string>();
    for (const a of set.accounts) {
      if (!/^\d{4}$/.test(a.code)) throw new Error(`seed sets law: ${set.key} code ${a.code} is not four digits`);
      if (codes.has(a.code)) throw new Error(`seed sets law: ${set.key} repeats code ${a.code}`);
      codes.add(a.code);
      assertCodeInFamily(a.code, a.family);
      if (!a.name.trim()) throw new Error(`seed sets law: ${set.key} code ${a.code} has no name`);
      if (!FAMILY_RULES[a.family]) throw new Error(`seed sets law: ${set.key} code ${a.code} has no family`);
    }
  }
  const finnhub = sets.flatMap((s) => s.accounts).find((a) => a.name.startsWith('Finnhub'));
  if (!finnhub || finnhub.code !== '6250') throw new Error('seed sets law: Finnhub Premium must sit at 6250 — the code the ruling names');
}

assertSeedSetsLaw();
