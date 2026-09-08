/**
 * SELL-04 — the entity kinds the product can set up, as data. A LEAF (zero
 * imports; client- and server-safe): the first-run step renders it, the
 * POST route validates against it, the tests read it.
 *
 * Only the kinds a route can READ are offered. The tax routes compute
 * Schedule C (src/lib/schedule-c-service.ts:162-163 finds the `sole_prop`
 * entity; src/lib/form-1040-service.ts:188-191 the default `personal` one);
 * no route reads an LLC, S-corp or partnership (grep: nothing in src/lib or
 * src/app/api/tax handles them), so they are not labels here — offering a
 * kind nothing computes would be a claim with nothing behind it. The letters
 * are the chart's (src/lib/accountString.ts:25-28: personal→P, sole_prop→B).
 */

export type EntityKindType = 'personal' | 'sole_prop';

export interface EntityKind {
  readonly type: EntityKindType;
  readonly label: string;
  readonly letter: 'P' | 'B';
  readonly defaultName: string;
  /** One line on what the kind is for — printed under the choice. */
  readonly what: string;
}

export const ENTITY_KINDS: readonly EntityKind[] = [
  {
    type: 'personal',
    label: 'Personal',
    letter: 'P',
    defaultName: 'Personal',
    what: 'Your own money — wages, living costs, the P- chart. Runway and net worth read it.',
  },
  {
    type: 'sole_prop',
    label: 'Sole proprietorship',
    letter: 'B',
    defaultName: 'Business',
    what: 'A business you own alone, filed on Schedule C — the B- chart the Tax and Business answers read.',
  },
];

export function entityKind(type: unknown): EntityKind | undefined {
  return ENTITY_KINDS.find((k) => k.type === type);
}

export function isEntityKindType(x: unknown): x is EntityKindType {
  return entityKind(x) !== undefined;
}

/** Why the step offers no LLC / S-corp / partnership — the honest line, printed on the step. */
export const UNSUPPORTED_ENTITY_LINE =
  'Personal and sole proprietorship only — the tax routes compute Schedule C; an LLC, S-corp or partnership has no route that reads it yet.';

/** The declared line a Books route answers when the user has no entity yet (where ensure-bookkeeping used to create one). */
export const SETUP_ENTITY_LINE = 'Set up your entity first — Books › Chart of accounts.';

/** Where the setup step lives — the chart page (the registry\'s Bookkeeping link) carries it. */
export const SETUP_DOOR = '/chart-of-accounts';

/** The name rule: 1–100 characters (entities.name is varchar(100)), whitespace collapsed. */
export const ENTITY_NAME_MAX = 100;
