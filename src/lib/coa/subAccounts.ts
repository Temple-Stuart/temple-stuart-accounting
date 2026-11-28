import { ValidationError } from '@/lib/errors/ValidationError';

/**
 * COALEVELS-01 (Alex, 2026-11-27) — THE ONE RULE OF A SUB-ACCOUNT.
 *
 * A sub-account is a two-digit code and a name under ONE chart account: the account is the CATEGORY, the sub-account the TYPE
 * (prisma/schema.prisma chart_of_sub_accounts). A stop is tied to its sub-account by its NAME — subAccountOf, below — so no
 * plan row stores a sub-account's code, and a stop whose name is no sub-account's simply has none.
 *
 * Over a small port (SubAccountDb), as accounts.ts is over ChartDb: the policy runs hermetically in node:test and the route
 * binds it to Prisma (prismaSubAccountDb.ts). Every refusal is a ValidationError the route answers verbatim at its status
 * (failClosed); a thing that cannot be — a stored code that is not two digits, a name standing twice under one account — is
 * thrown by name, never read as something else.
 *
 *   add — the name is required, holds no control character and is at most SUB_NAME_MAX characters; it stands ONCE under its
 *         account by its key (subAccountNameKey), a retired one keeping its name; the code is two digits, free under the
 *         account — or, when none is sent, the lowest ten above every code the account holds (nextSubCode). Nothing is
 *         added under a retired account.
 *   None is deleted, renamed or re-coded here: is_archived retires one, and this change writes no retirement.
 */

export interface SubAccountRow {
  id: string;
  userId: string;
  account_id: string;
  code: string;
  name: string;
  is_archived: boolean;
}

export interface NewSubAccount {
  userId: string;
  account_id: string;
  code: string;
  name: string;
  created_by: string | null;
}

export interface SubAccountDb {
  /** Every sub-account of ONE account of this user — retired ones too. */
  listOfAccount(userId: string, accountId: string): Promise<SubAccountRow[]>;
  insert(row: NewSubAccount): Promise<SubAccountRow>;
}

/** The account a sub-account sits under, as the rule needs it. */
export interface SubAccountParent {
  id: string;
  /** The account's code as the chart renders it — scheme.ts renderCode: the entity's letter and the digits. */
  rendered: string;
  name: string;
  is_archived: boolean;
}

/** chart_of_sub_accounts.name is VarChar(100). */
export const SUB_NAME_MAX = 100;
/** chart_of_sub_accounts.code is two digits — the table's own CHECK. */
export const SUB_CODE_RE = /^[0-9]{2}$/;
/** A code not sent is the next TEN: 10, 20, … */
export const SUB_CODE_STEP = 10;
/** … up to this one. */
export const SUB_CODE_LAST = 90;

/** C0, DEL and C1. */
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

/** The ONE key a sub-account's name is matched by — and a stop's name against it: trimmed, inner whitespace one space, lower case. */
export const subAccountNameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const SUB_NAME_REQUIRED_WORDS = 'name is required';
export const SUB_NAME_CONTROL_WORDS = 'name holds a control character — type it again without it';
export const SUB_NAME_LONG_WORDS = `name is longer than ${SUB_NAME_MAX} characters`;
export const SUB_CODE_SHAPE_WORDS = 'code is two digits — 10, 20, 35';
export const SUB_CODES_USED_UP_WORDS = `the tens are used up under this account (10 to ${SUB_CODE_LAST}) — type a free two-digit code`;

/** A typed name → the name as the chart keeps it: trimmed, inner whitespace one space. The trimmed text is tested for a control character BEFORE its whitespace is collapsed — a tab or a line break inside a name is one. */
export function parseSubName(input: unknown): string {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (trimmed === '') throw new ValidationError(SUB_NAME_REQUIRED_WORDS, { field: 'name' });
  if (CONTROL_RE.test(trimmed)) throw new ValidationError(SUB_NAME_CONTROL_WORDS, { field: 'name' });
  const name = trimmed.replace(/\s+/g, ' ');
  if (name.length > SUB_NAME_MAX) throw new ValidationError(SUB_NAME_LONG_WORDS, { field: 'name' });
  return name;
}

/** A typed code → two digits, or why not. */
export function parseSubCode(input: unknown): string {
  const code = typeof input === 'string' ? input.trim() : '';
  if (!SUB_CODE_RE.test(code)) throw new ValidationError(SUB_CODE_SHAPE_WORDS, { field: 'code' });
  return code;
}

/**
 * The code a sub-account takes when none is sent: the lowest ten above EVERY code taken — '10' with none, '30' after 10 and 25.
 * Past SUB_CODE_LAST there is none: null, and the caller says SUB_CODES_USED_UP_WORDS. A taken code that is not two digits is
 * thrown by name — a stored one cannot be (the table's CHECK).
 */
export function nextSubCode(taken: readonly string[]): string | null {
  let top = 0;
  for (const code of taken) {
    if (!SUB_CODE_RE.test(code)) throw new Error(`subAccounts: the taken code ${JSON.stringify(code)} is not two digits — a stored code always is`);
    top = Math.max(top, Number(code));
  }
  const next = (Math.floor(top / SUB_CODE_STEP) + 1) * SUB_CODE_STEP;
  return next > SUB_CODE_LAST ? null : String(next);
}

/** A sub-account in words: its account's rendered code, its own code, its name. */
export const subAccountWords = (parent: Pick<SubAccountParent, 'rendered'>, code: string, name: string): string => `${parent.rendered}-${code} ${name}`;

export interface AddSubAccountInput {
  userId: string;
  parent: SubAccountParent;
  name: unknown;
  /** Not sent (undefined): the next ten. */
  code?: unknown;
  createdBy: string | null;
}

export async function addSubAccount(db: SubAccountDb, input: AddSubAccountInput): Promise<SubAccountRow> {
  const { parent } = input;
  const name = parseSubName(input.name);
  if (parent.is_archived) {
    throw new ValidationError(`${parent.rendered} ${parent.name} is retired — restore it before adding a sub-account under it`, { status: 409, field: 'accountId' });
  }
  const held = await db.listOfAccount(input.userId, parent.id);
  const key = subAccountNameKey(name);
  const named = held.find((s) => subAccountNameKey(s.name) === key);
  if (named !== undefined) {
    const words = subAccountWords(parent, named.code, named.name);
    throw new ValidationError(named.is_archived ? `${words} is retired — it keeps its name` : `${words} is already a sub-account of ${parent.name}`, { status: 409, field: 'name' });
  }
  let code: string;
  if (input.code !== undefined) {
    code = parseSubCode(input.code);
    const holder = held.find((s) => s.code === code);
    if (holder !== undefined) {
      throw new ValidationError(`${subAccountWords(parent, holder.code, holder.name)} holds that code${holder.is_archived ? ' (retired)' : ''}`, { status: 409, field: 'code' });
    }
  } else {
    const next = nextSubCode(held.map((s) => s.code));
    if (next === null) throw new ValidationError(SUB_CODES_USED_UP_WORDS, { status: 409, field: 'code' });
    code = next;
  }
  return db.insert({ userId: input.userId, account_id: parent.id, code, name, created_by: input.createdBy });
}

/** A sub-account as a reader holds it: the account it sits under (by whatever key the reader names accounts with), its code, its name. */
export interface SubAccountRef {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
}

/**
 * THE JOIN OF A STOP TO ITS SUB-ACCOUNT: the one sub-account of that account whose key is the stop's name's — or null, when the
 * account holds none of that name. Two is thrown by name: a name stands once under an account, and one is never chosen between.
 */
export function subAccountOf(subAccounts: readonly SubAccountRef[], accountId: string, stopName: string): SubAccountRef | null {
  const key = subAccountNameKey(stopName);
  const found = subAccounts.filter((s) => s.accountId === accountId && subAccountNameKey(s.name) === key);
  if (found.length > 1) {
    throw new Error(`subAccounts: account ${accountId} holds ${found.length} sub-accounts named ${JSON.stringify(stopName)} (${found.map((s) => s.code).join(', ')}) — a name stands once under an account`);
  }
  return found.length === 1 ? found[0] : null;
}
