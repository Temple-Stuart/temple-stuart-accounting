/**
 * COALEVELS-01 (Alex, 2026-11-27) — THE ACCOUNT'S LEVELS: A CHART'S SUB-ACCOUNTS, A STOP'S LOCATION, AND THE PLACE'S THREE PARTS.
 *
 * PART 1 (S, L, A, P, M, R below): the rules and the database. The sub-account rule (src/lib/coa/subAccounts.ts) is driven
 * over an in-memory port; the Location rule (src/lib/operations/locationClass.ts), the account string and the place's split
 * are driven with made-up values; the migration, the schema, the new route and the two routines routes are read from source
 * through sourceText — code() for what the code does, comments() only for a header's words.
 *
 * PART 2 (G below): THE SHEET. ledgerOf over made-up plans — a row's Location from its routine and its account's levels
 * (the entity's letter, the Location's code, the line's code, the code of the sub-account of that account whose name is the
 * stop's) with the whole code they render; the twenty-five columns in his sheet's words and order; the fold of five and the
 * day's place; the ten groups; the expense form's Location; and, in the source, the section, the grid's class, the compact
 * opener, the answer's nine reads and the registry's two cites.
 *
 * HERMETIC: no database, no request, no clock. No route is run here and no SQL: what a database does with the migration is
 * not this file's to say. Every name, place, code and amount below is made up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnceRRule } from '../operations/rruleHelpers'; // EDIT-01 (2026-11-28): the fixture states each routine's one-off-ness by the rule's own test
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import { ValidationError } from '../errors/ValidationError';
import { deriveAccountString } from '../accountString';
import { renderCode } from '../coa/scheme';
import {
  SUB_CODES_USED_UP_WORDS, SUB_CODE_LAST, SUB_CODE_RE, SUB_CODE_SHAPE_WORDS, SUB_CODE_STEP, SUB_NAME_CONTROL_WORDS, SUB_NAME_LONG_WORDS, SUB_NAME_MAX, SUB_NAME_REQUIRED_WORDS,
  addSubAccount, nextSubCode, parseSubCode, parseSubName, subAccountNameKey, subAccountOf, subAccountWords,
  type NewSubAccount, type SubAccountDb, type SubAccountParent, type SubAccountRef, type SubAccountRow,
} from '../coa/subAccounts';
import {
  LOCATION_CHOICE_WORDS, LOCATION_CLASSES, LOCATION_CODES, LOCATION_NOT_TEXT_WORDS, LOCATION_WORDS, isLocationClass, locationClassOf, locationUnknownWords, readLocationClass, type LocationClass,
} from '../operations/locationClass';
import { placeParts, type StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';
import {
  routineClocksOf, EMPTY_EXPENSE, EXPENSE_FIELDS, EXPENSE_FIELD_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, LEDGER_TABLE, LEDGER_TABLE_CLASS, // SHEET-01 (2026-11-28): the fold's class and columns are gone from the rule file
  LOCATION_CLASSES as SHEET_LOCATION_CLASSES, LOCATION_WORDS as SHEET_LOCATION_WORDS, NO_COLUMN_FILTERS, NO_LOCATION_WORDS, NO_VALUE_FILTER, SUMMARY_TITLE_WORDS, TEXT_COLUMNS, VALUE_COLUMNS,
  accountCellWords, applyColumnFilters, cellWordsOf, codeCellWords, columnKind, columnValues, expenseInput, headWordOf, ledgerCsv, ledgerOf, ledgerSummary, locationCellWords, // SHEET-01 (2026-11-28): the fold's count and place words are gone
  oneOffBody, planMinutesOf, regionWords, requiredWords, sortKeyOf, sortRows, typeGroupWords,
  type ExpenseDraft, type LedgerInput, type LedgerRecordInput, type LedgerSegments, type LedgerSheetRow, type LedgerSubAccount,
} from '../operations/ledger';
import { TOOL_REGISTRY } from '../toolRegistry';
import { CAPTION_TAGS, captionTags } from '@/components/workbench/operations/day/dayCard';

const SUB_RULE = 'src/lib/coa/subAccounts.ts';
const SUB_BINDING = 'src/lib/coa/prismaSubAccountDb.ts';
const SUB_ROUTE = 'src/app/api/chart-of-accounts/sub-accounts/route.ts';
const CHART_ROUTE = 'src/app/api/chart-of-accounts/route.ts';
const LOCATION_RULE = 'src/lib/operations/locationClass.ts';
const ACCOUNT_STRING = 'src/lib/accountString.ts';
const STAY = 'src/lib/operations/stay.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const ROUTINES_ROUTE = 'src/app/api/operations/routines/route.ts';
const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const MOVE_ROUTE = 'src/app/api/operations/routines/move/route.ts';
const ROUTINE_TYPES = 'src/components/workbench/operations/routines/types.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261127230000_coa_levels_01_sub_accounts_location';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;

const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const countOf = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
/** A handler's text: from its `export async function` to the next exported function, or the file's end. */
const handler = (src: string, method: string): string => {
  const at = src.indexOf(`export async function ${method}(`);
  assert.ok(at >= 0, `${method} is a function`);
  const next = src.indexOf('\nexport async function ', at + 1);
  return src.slice(at, next > 0 ? next : undefined);
};
/** Each text stands in the source once, and they stand in this order. */
const inOrder = (src: string, parts: readonly string[], what: string): void => {
  for (const p of parts) assert.equal(src.split(p).length - 1, 1, `${what}: \`${p}\` stands once`);
  const at = parts.map((p) => src.indexOf(p));
  assert.deepEqual([...at].sort((a, b) => a - b), at, `${what}: in this order`);
};
/** What a call throws, in its own words — or the test fails. */
const thrownBy = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return assert.fail('nothing was thrown');
};
/** A rule's refusal as the route answers it: its status, its field, its words — or the test fails. */
const refused = (run: () => unknown): [number, string | undefined, string] => {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return [error.status, error.field, error.message];
    throw error;
  }
  return assert.fail('accepted');
};
const refusedAsync = async (run: () => Promise<unknown>): Promise<[number, string | undefined, string]> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof ValidationError) return [error.status, error.field, error.message];
    throw error;
  }
  return assert.fail('accepted');
};

// ── THE FIXTURE (made up): one user's two accounts, and what one of them holds ──

const USER = 'user-1';
const DINING: SubAccountParent = { id: 'acc-dining', rendered: 'P-6150', name: 'Dining Out', is_archived: false };
const SPORT: SubAccountParent = { id: 'acc-sport', rendered: 'P-6200', name: 'Sport', is_archived: false };
const RETIRED_PARENT: SubAccountParent = { id: 'acc-old', rendered: 'B-6400', name: 'Printing', is_archived: true };
const sub = (over: Partial<SubAccountRow> & { id: string; code: string; name: string }): SubAccountRow => ({ userId: USER, account_id: DINING.id, is_archived: false, ...over });
/** An in-memory port: the rows it holds, and every row it was asked to insert. */
function memoryDb(held: readonly SubAccountRow[] = []): SubAccountDb & { readonly rows: SubAccountRow[]; readonly inserted: NewSubAccount[]; readonly asked: [string, string][] } {
  const rows = [...held];
  const inserted: NewSubAccount[] = [];
  const asked: [string, string][] = [];
  return {
    rows, inserted, asked,
    async listOfAccount(userId, accountId) { asked.push([userId, accountId]); return rows.filter((r) => r.userId === userId && r.account_id === accountId); },
    async insert(row) {
      inserted.push(row);
      const made: SubAccountRow = { id: `sub-${rows.length + 1}`, userId: row.userId, account_id: row.account_id, code: row.code, name: row.name, is_archived: false };
      rows.push(made);
      return made;
    },
  };
}
/** Control characters typed by their code, never raw: C0, DEL, C1. */
const CONTROLS: readonly (readonly [string, string])[] = [['\u0000', 'NUL'], ['\u0007', 'BEL'], ['\u001b', 'ESC'], ['\u007f', 'DEL'], ['\u0085', 'a C1 control'], ['\t', 'a tab'], ['\n', 'a line break']];

// ── S · THE SUB-ACCOUNT RULE (ruling 1.3) ────────────────────────────────────

test('S1 a typed name: required — not text, or blank after the trim; no control character (C0, DEL, C1 — a tab or a line break inside it too); trimmed, inner whitespace one space; 100 at most — each refusal on `name`, in the rule’s words', () => {
  assert.equal(parseSubName('Soup'), 'Soup');
  assert.equal(parseSubName('   Dry    noodles  '), 'Dry noodles', 'trimmed; a run of spaces is one');
  assert.equal(parseSubName('\tSoup\n'), 'Soup', 'whitespace at either end is trimmed away before anything is tested');
  for (const none of [undefined, null, 7, true, ['Soup'], { name: 'Soup' }, '', '   ', ' \t\n ']) assert.deepEqual(refused(() => parseSubName(none)), [400, 'name', SUB_NAME_REQUIRED_WORDS], JSON.stringify(none) ?? 'undefined');
  for (const [c, name] of CONTROLS) assert.deepEqual(refused(() => parseSubName(`Dry${c}noodles`)), [400, 'name', SUB_NAME_CONTROL_WORDS], name);
  assert.equal(parseSubName('n'.repeat(SUB_NAME_MAX)).length, 100, 'the edge is inside');
  assert.deepEqual(refused(() => parseSubName('n'.repeat(SUB_NAME_MAX + 1))), [400, 'name', SUB_NAME_LONG_WORDS]);
  assert.equal(parseSubName(` ${'ab  '.repeat(33)}c `).length, 100, 'counted after the trim and the collapse — 135 characters typed');
  assert.deepEqual([SUB_NAME_MAX, SUB_NAME_REQUIRED_WORDS, SUB_NAME_CONTROL_WORDS, SUB_NAME_LONG_WORDS], [100, 'name is required', 'name holds a control character — type it again without it', 'name is longer than 100 characters']);
});

test('S2 a typed code is two digits, or refused on `code` in the rule’s words; the key a name is matched by is trimmed, one-spaced and lower case', () => {
  for (const [typed, read] of [['10', '10'], ['05', '05'], ['99', '99'], [' 35 ', '35']] as const) assert.equal(parseSubCode(typed), read);
  for (const bad of ['5', '100', 'ab', '1a', '', '  ', '1 0', '10.', '-1', 10, null, ['10']]) assert.deepEqual(refused(() => parseSubCode(bad)), [400, 'code', SUB_CODE_SHAPE_WORDS], JSON.stringify(bad));
  assert.equal(SUB_CODE_SHAPE_WORDS, 'code is two digits — 10, 20, 35');
  assert.equal(String(SUB_CODE_RE), '/^[0-9]{2}$/');
  // THE KEY — one, for a sub-account's name and for a stop's name against it.
  assert.equal(subAccountNameKey('  Dry   NOODLES '), 'dry noodles');
  assert.equal(subAccountNameKey('Dry noodles'), subAccountNameKey('dry\tNoodles'));
  assert.notEqual(subAccountNameKey('Dry noodles'), subAccountNameKey('Drynoodles'), 'a space is a space — never dropped');
  assert.match(code(SUB_RULE), /export const subAccountNameKey = \(name: string\): string => name\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)\.toLowerCase\(\);/);
});

test('S3 nextSubCode: the lowest ten above EVERY code taken — 10 with none, 30 after 10 and 25; past 90 there is none; a taken code that is not two digits is thrown by name', () => {
  assert.equal(nextSubCode([]), '10');
  assert.equal(nextSubCode(['10']), '20');
  assert.equal(nextSubCode(['10', '25']), '30', 'above the 25, not into the gap at 20');
  assert.equal(nextSubCode(['25', '10']), '30', 'whatever the order');
  assert.equal(nextSubCode(['05']), '10');
  assert.equal(nextSubCode(['00']), '10');
  assert.equal(nextSubCode(['30']), '40', 'above every code taken — 10 and 20 below it are never handed out behind it');
  assert.equal(nextSubCode(['80']), '90');
  assert.equal(nextSubCode(['89']), '90');
  for (const top of ['90', '91', '99']) assert.equal(nextSubCode(['10', top]), null, `${top}: no ten is left`);
  assert.deepEqual([SUB_CODE_STEP, SUB_CODE_LAST], [10, 90]);
  assert.equal(SUB_CODES_USED_UP_WORDS, 'the tens are used up under this account (10 to 90) — type a free two-digit code');
  // A stored code is two digits (the table's CHECK): one that is not is this rule's error, thrown by name — never counted as some number.
  for (const stored of ['7', '100', 'ten', '']) assert.equal(thrownBy(() => nextSubCode(['10', stored])), `subAccounts: the taken code ${JSON.stringify(stored)} is not two digits — a stored code always is`);
});

test('S4 addSubAccount adds under an account: the name cleaned, the code sent or the next ten, the row the caller’s — and nothing but the one insert', async () => {
  const db = memoryDb([sub({ id: 's1', code: '10', name: 'Soup' }), sub({ id: 's2', code: '25', name: 'Bread' }), sub({ id: 's9', code: '10', name: 'Climbing', account_id: SPORT.id })]);
  // No code sent: the next ten above every code THIS account holds.
  const noodles = await addSubAccount(db, { userId: USER, parent: DINING, name: '  Dry   noodles ', createdBy: 'someone@example.test' });
  assert.deepEqual(noodles, { id: 'sub-4', userId: USER, account_id: DINING.id, code: '30', name: 'Dry noodles', is_archived: false });
  assert.deepEqual(db.inserted, [{ userId: USER, account_id: DINING.id, code: '30', name: 'Dry noodles', created_by: 'someone@example.test' }]);
  assert.deepEqual(db.asked, [[USER, DINING.id]], 'ONE read: this user’s sub-accounts of this account — the other account’s code 10 is not this one’s');
  // A code sent, and free: taken as sent — in a gap too.
  const tea = await addSubAccount(db, { userId: USER, parent: DINING, name: 'Tea', code: '20', createdBy: null });
  assert.deepEqual([tea.code, tea.name, db.inserted[1].created_by], ['20', 'Tea', null]);
  // Another account holds its own codes and its own names: the same name and the same code stand there freely.
  const other = await addSubAccount(db, { userId: USER, parent: SPORT, name: 'Soup', code: '25', createdBy: null });
  assert.deepEqual([other.account_id, other.code, other.name], [SPORT.id, '25', 'Soup']);
  // The first under an account takes 10.
  assert.equal((await addSubAccount(memoryDb(), { userId: USER, parent: DINING, name: 'Soup', createdBy: null })).code, '10');
  // In the source: the rule imports the validation error and nothing else — no prisma; the binding names the caller on every read.
  const rule = code(SUB_RULE);
  assert.deepEqual([...rule.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['@/lib/errors/ValidationError']);
  assert.doesNotMatch(rule, /prisma|\bfetch\b|new Date\(\)|Date\.now\(/);
  const binding = code(SUB_BINDING);
  assert.match(binding, /const SELECT = \{ id: true, userId: true, account_id: true, code: true, name: true, is_archived: true \} as const;/);
  assert.match(binding, /findMany\(\{ where: \{ userId, account_id: accountId \}, select: SELECT, orderBy: \{ code: 'asc' \} \}\)/, 'by its user AND its account, by code ascending');
  assert.match(binding, /data: \{ userId: row\.userId, account_id: row\.account_id, code: row\.code, name: row\.name, created_by: row\.created_by \},/, 'the five fields');
  assert.equal(countOf(binding, /chart_of_sub_accounts\.(findMany|create)\(/g), 2, 'one read and one write');
  assert.doesNotMatch(binding, /\.(update|updateMany|upsert|delete|deleteMany|createMany)\s*\(|\$executeRaw|\$queryRaw/, 'none is deleted, renamed or re-coded here');
});

test('S5 addSubAccount refuses by name and status: a retired account; a name the account already holds — by its key, active or retired; a code that is held — a retired holder said; no ten left; a name or a code that is not one — and the name is read first', async () => {
  const held = [sub({ id: 's1', code: '10', name: 'Soup' }), sub({ id: 's2', code: '25', name: 'Bread', is_archived: true })];
  const add = (input: { parent?: SubAccountParent; name: unknown; code?: unknown }, rows: readonly SubAccountRow[] = held) => {
    const db = memoryDb(rows);
    return { db, run: () => addSubAccount(db, { userId: USER, parent: input.parent ?? DINING, name: input.name, ...('code' in input ? { code: input.code } : {}), createdBy: null }) };
  };
  // A retired account takes none.
  assert.deepEqual(await refusedAsync(add({ parent: RETIRED_PARENT, name: 'Flyers' }).run), [409, 'accountId', 'B-6400 Printing is retired — restore it before adding a sub-account under it']);
  // The name stands once under its account — matched by its KEY, so another case or spacing is the same name.
  for (const typed of ['Soup', 'soup', '  SOUP ']) assert.deepEqual(await refusedAsync(add({ name: typed }).run), [409, 'name', 'P-6150-10 Soup is already a sub-account of Dining Out'], typed);
  // A retired one keeps its name.
  assert.deepEqual(await refusedAsync(add({ name: 'bread' }).run), [409, 'name', 'P-6150-25 Bread is retired — it keeps its name']);
  // A code sent that is held — by an active one, by a retired one.
  assert.deepEqual(await refusedAsync(add({ name: 'Tea', code: '10' }).run), [409, 'code', 'P-6150-10 Soup holds that code']);
  assert.deepEqual(await refusedAsync(add({ name: 'Tea', code: '25' }).run), [409, 'code', 'P-6150-25 Bread holds that code (retired)']);
  // No code sent and no ten left: said, in the rule's words — a retired one's code is taken too.
  assert.deepEqual(await refusedAsync(add({ name: 'Tea' }, [sub({ id: 's3', code: '90', name: 'Last', is_archived: true })]).run), [409, 'code', SUB_CODES_USED_UP_WORDS]);
  // …and a free two-digit code typed then lands.
  const typed = add({ name: 'Tea', code: '95' }, [sub({ id: 's3', code: '90', name: 'Last' })]);
  assert.equal((await typed.run()).code, '95');
  // A name or a code that is not one: a 400 on its own field.
  assert.deepEqual(await refusedAsync(add({ name: '   ' }).run), [400, 'name', SUB_NAME_REQUIRED_WORDS]);
  assert.deepEqual(await refusedAsync(add({ name: 'Tea', code: '5' }).run), [400, 'code', SUB_CODE_SHAPE_WORDS]);
  assert.deepEqual(await refusedAsync(add({ name: 'Tea', code: null }).run), [400, 'code', SUB_CODE_SHAPE_WORDS], 'a code SENT as null is a code that is not one — only a code not sent is the next ten');
  // THE ORDER: the name is parsed first — before the account's retirement is said; the name's place before the code's.
  assert.deepEqual(await refusedAsync(add({ parent: RETIRED_PARENT, name: '' }).run), [400, 'name', SUB_NAME_REQUIRED_WORDS]);
  assert.equal((await refusedAsync(add({ name: 'Soup', code: '10' }).run))[1], 'name');
  // A refusal writes nothing.
  for (const input of [{ name: 'Soup' }, { name: 'Tea', code: '10' }, { parent: RETIRED_PARENT, name: 'Flyers' }]) {
    const tried = add(input);
    await refusedAsync(tried.run);
    assert.deepEqual(tried.db.inserted, [], JSON.stringify(input));
  }
  assert.equal(subAccountWords(DINING, '10', 'Soup'), 'P-6150-10 Soup');
});

test('S6 subAccountOf joins a stop to its sub-account by NAME: none → null; the one of that account whose key is the stop’s name’s; two of one name under one account are thrown by name — never chosen between', () => {
  const subs: SubAccountRef[] = [
    { accountId: 'P:6150', code: '10', name: 'Soup' },
    { accountId: 'P:6150', code: '20', name: 'Dry noodles' },
    { accountId: 'P:6200', code: '10', name: 'Soup' },
  ];
  assert.equal(subAccountOf(subs, 'P:6150', 'Tea'), null, 'the account holds none of that name');
  assert.equal(subAccountOf([], 'P:6150', 'Soup'), null, 'no sub-accounts at all');
  assert.equal(subAccountOf(subs, 'B:6150', 'Soup'), null, 'another account’s is not this one’s');
  assert.equal(subAccountOf(subs, 'P:6150', 'Soup'), subs[0]);
  assert.equal(subAccountOf(subs, 'P:6200', 'Soup'), subs[2], 'the same name under another account is that account’s own');
  for (const stopName of ['Dry noodles', 'dry noodles', '  DRY   NOODLES ']) assert.equal(subAccountOf(subs, 'P:6150', stopName), subs[1], `${JSON.stringify(stopName)}: matched by its key`);
  // Two of one name under one account: a name stands once — thrown, with both codes named.
  const twice: SubAccountRef[] = [...subs, { accountId: 'P:6150', code: '40', name: 'soup' }];
  assert.equal(thrownBy(() => subAccountOf(twice, 'P:6150', 'Soup')), 'subAccounts: account P:6150 holds 2 sub-accounts named "Soup" (10, 40) — a name stands once under an account');
  assert.equal(subAccountOf(twice, 'P:6200', 'Soup'), subs[2], 'the other account is untouched by it');
});

// ── L · THE LOCATION RULE (ruling 1.6) ───────────────────────────────────────

test('L1 a Location is travel or homebase — or not said: the two keys, their words, their codes; a typed one is read by its key or its word in either case; a word that is neither, and anything that is not text, is refused in the rule’s words; a stored unknown is thrown by name', () => {
  assert.deepEqual(LOCATION_CLASSES, ['travel', 'homebase']);
  assert.deepEqual(LOCATION_WORDS, { travel: 'Travel', homebase: 'Homebase' });
  assert.deepEqual(LOCATION_CODES, { travel: 'TRV', homebase: 'HOM' });
  assert.equal(LOCATION_CHOICE_WORDS, 'Travel or Homebase');
  assert.equal(LOCATION_CHOICE_WORDS, LOCATION_CLASSES.map((c) => LOCATION_WORDS[c]).join(' or '), 'built from the two words');
  // NOT SAID: undefined, null, only spaces.
  for (const none of [undefined, null, '', '   ', '\t\n']) assert.deepEqual(readLocationClass(none), { ok: true, value: null }, JSON.stringify(none) ?? 'undefined');
  // A class's key or its word, in either case, trimmed.
  for (const typed of ['travel', 'Travel', 'TRAVEL', '  tRaVeL  ']) assert.deepEqual(readLocationClass(typed), { ok: true, value: 'travel' }, typed);
  for (const typed of ['homebase', 'Homebase', 'HOMEBASE', ' homebase\n']) assert.deepEqual(readLocationClass(typed), { ok: true, value: 'homebase' }, typed);
  // Text that is neither: refused, naming what was typed — its code is not its word, and a near word is not it.
  for (const typed of ['abroad', 'TRV', 'HOM', 'home base', 'travelling', 'home']) assert.deepEqual(readLocationClass(` ${typed} `), { ok: false, words: `Location ${JSON.stringify(typed)} is not one this app knows — Travel or Homebase` }, typed);
  assert.equal(locationUnknownWords('abroad'), 'Location "abroad" is not one this app knows — Travel or Homebase');
  // Not text.
  for (const raw of [7, 0, true, false, ['travel'], { value: 'travel' }]) assert.deepEqual(readLocationClass(raw), { ok: false, words: LOCATION_NOT_TEXT_WORDS }, JSON.stringify(raw));
  assert.equal(LOCATION_NOT_TEXT_WORDS, 'Location is Travel or Homebase, or left out');
  // A STORED one: null is none; one of the two is itself; anything else is thrown by name — the column is CHECKed.
  assert.deepEqual([locationClassOf(null, 'routine r1'), locationClassOf('travel', 'routine r1'), locationClassOf('homebase', 'routine r1')], [null, 'travel', 'homebase']);
  for (const stored of ['abroad', 'Travel', '', 'TRV']) assert.equal(thrownBy(() => locationClassOf(stored, 'routine r1')), `locationClass: routine r1 holds the Location ${JSON.stringify(stored)} — not one of travel, homebase`);
  assert.deepEqual(['travel', 'homebase', 'Travel', null, 7].map(isLocationClass), [true, true, false, false, false]);
  // Pure: no import, no clock.
  const rule = code(LOCATION_RULE);
  assert.doesNotMatch(rule, /^import /m, 'the rule imports nothing');
  assert.doesNotMatch(rule, /new Date\(\)|Date\.now\(|\bfetch\b|prisma/);
});

// ── A · THE ACCOUNT STRING (ruling 1.7) ──────────────────────────────────────

test('A1 deriveAccountString: the Location’s code stands after the entity’s letter and before the code, trimmed, when it is sent — and a caller that sends none renders exactly what it rendered', () => {
  // With the segment: Entity – Location – Category – Type (– Object).
  assert.equal(deriveAccountString({ entityType: 'personal', locationCode: 'HOM', code: '6150', subType: '20' }), 'P-HOM-6150-20');
  assert.equal(deriveAccountString({ entityType: 'sole_prop', locationCode: 'TRV', code: '6400' }), 'B-TRV-6400', 'no sub: a shorter string');
  assert.equal(deriveAccountString({ entityType: 'trading', locationCode: ' TRV ', code: '6150', subType: '30', objectCode: 'XYZ' }), 'T-TRV-6150-30-XYZ', 'trimmed; the object last, as it was');
  assert.equal(deriveAccountString({ entityType: 'something_else', locationCode: 'HOM', code: '6150' }), 'HOM-6150', 'an entity type with no letter renders none — never a guessed one');
  // Absent → absent: undefined, null and blank alike.
  for (const none of [undefined, null, '', '   ']) {
    assert.equal(deriveAccountString({ entityType: 'personal', locationCode: none, code: '6150', subType: '20' }), 'P-6150-20', JSON.stringify(none) ?? 'undefined');
  }
  // Every caller that sends none: as it rendered — the chart's own render among them.
  assert.equal(deriveAccountString({ entityType: 'personal', code: '6150' }), 'P-6150');
  assert.equal(deriveAccountString({ entityType: 'sole_prop', code: '6400', subType: 'loan' }), 'B-6400-loan');
  assert.equal(deriveAccountString({ code: '6150' }), '6150');
  assert.equal(deriveAccountString({ entityType: 'personal', code: '6150', subType: '10', objectCode: 'XYZ' }), 'P-6150-10-XYZ');
  assert.equal(renderCode('6150', 'personal'), 'P-6150', 'scheme.ts renderCode — the chart’s rendered code, unchanged');
  // The Location's codes are the rule file's, and each renders in its place.
  for (const c of LOCATION_CLASSES) assert.equal(deriveAccountString({ entityType: 'personal', locationCode: LOCATION_CODES[c], code: '6150' }), `P-${LOCATION_CODES[c]}-6150`);
  // In the source: pushed after the letter, before the code; the contract says the segment.
  const src = code(ACCOUNT_STRING);
  assert.match(src, /if \(letter\) segments\.push\(letter\);\n\s*const location = locationCode\?\.trim\(\);\n\s*if \(location\) segments\.push\(location\);\n\s*segments\.push\(code\);/);
  assert.match(src, /locationCode\?: string \| null;/);
  assert.match(comments(ACCOUNT_STRING), /L — COALEVELS-01 \(Alex, 2026-11-27\): the LOCATION segment, after the entity's letter/);
});

// ── P · THE PLACE HAS THREE PARTS (ruling 1.8) ───────────────────────────────

test('P1 placeParts splits a place in three — the city before the FIRST comma, the country after the LAST, the region between — and captionTags tags those that are there: one part, two, three and four', () => {
  // ONE part: the city alone.
  assert.deepEqual(placeParts('Quillhaven'), { city: 'Quillhaven', region: null, country: null });
  assert.deepEqual(captionTags('Quillhaven'), ['#quillhaven', ...CAPTION_TAGS]);
  // TWO: the city and the country, no region — as it always read.
  assert.deepEqual(placeParts(' Quillhaven ,  Ruritania '), { city: 'Quillhaven', region: null, country: 'Ruritania' }, 'each part trimmed');
  assert.deepEqual(captionTags('Quillhaven, Ruritania'), ['#quillhaven', '#ruritania', ...CAPTION_TAGS]);
  // THREE: the region is the middle.
  assert.deepEqual(placeParts('Quillhaven, Marrow Vale, Ruritania'), { city: 'Quillhaven', region: 'Marrow Vale', country: 'Ruritania' });
  assert.deepEqual(captionTags('Quillhaven, Marrow Vale, Ruritania'), ['#quillhaven', '#marrowvale', '#ruritania', ...CAPTION_TAGS], 'a tag each, in the place’s order');
  // FOUR: the two middle parts stay together, as written between the first comma and the last.
  assert.deepEqual(placeParts('Quillhaven,  Old Quarter , Marrow Vale , Ruritania'), { city: 'Quillhaven', region: 'Old Quarter , Marrow Vale', country: 'Ruritania' });
  assert.deepEqual(captionTags('Quillhaven, Old Quarter, Marrow Vale, Ruritania'), ['#quillhaven', '#oldquartermarrowvale', '#ruritania', ...CAPTION_TAGS], 'the region is ONE part, so one tag');
  // A part left empty is an empty text, never dropped or guessed — and gives no tag.
  assert.deepEqual(placeParts('Quillhaven, , Ruritania'), { city: 'Quillhaven', region: '', country: 'Ruritania' });
  assert.deepEqual(captionTags('Quillhaven, , Ruritania'), ['#quillhaven', '#ruritania', ...CAPTION_TAGS]);
  // In the source: the one split, read by the card; the type holds the region between the two.
  const stay = code(STAY);
  assert.match(stay, /export interface PlaceParts \{\n\s*readonly city: string;\n\s*readonly region: string \| null;\n\s*readonly country: string \| null;\n\}/);
  assert.match(stay, /const first = place\.indexOf\(','\);\n\s*if \(first < 0\) return \{ city: place\.trim\(\), region: null, country: null \};\n\s*const last = place\.lastIndexOf\(','\);/);
  assert.match(code(CARD_RULES), /const parts = \[place\.city, place\.region, place\.country\]\.filter\(\(part\): part is string => part !== null\);/);
  assert.doesNotMatch(code(CARD_RULES), /indexOf\(','\)|split\(','\)/, 'no second split on the card');
});

// ── M · THE MIGRATION AND THE SCHEMA (rulings 1.1, 1.2) ──────────────────────

test('M1 the migration is the newest and holds eight statements and no other: the table with its two CHECKs, its three indexes, its two foreign keys, the routine’s column and its CHECK — no row written; authored, not applied', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  const statements = code(MIGRATION).split(';').map(flat).filter(Boolean);
  assert.deepEqual(statements, [
    'CREATE TABLE "chart_of_sub_accounts" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" TEXT NOT NULL, "account_id" UUID NOT NULL, "code" VARCHAR(2) NOT NULL, "name" VARCHAR(100) NOT NULL, "is_archived" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL, "created_by" TEXT, CONSTRAINT "chart_of_sub_accounts_pkey" PRIMARY KEY ("id"), CONSTRAINT "chart_of_sub_accounts_code_two_digits" CHECK ("code" ~ \'^[0-9]{2}$\'), CONSTRAINT "chart_of_sub_accounts_name_not_blank" CHECK (length(btrim("name")) > 0))',
    'CREATE UNIQUE INDEX "chart_of_sub_accounts_account_id_code_key" ON "chart_of_sub_accounts"("account_id", "code")',
    'CREATE UNIQUE INDEX "chart_of_sub_accounts_account_id_name_key" ON "chart_of_sub_accounts"("account_id", "name")',
    'CREATE INDEX "chart_of_sub_accounts_userId_idx" ON "chart_of_sub_accounts"("userId")',
    'ALTER TABLE "chart_of_sub_accounts" ADD CONSTRAINT "chart_of_sub_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "chart_of_sub_accounts" ADD CONSTRAINT "chart_of_sub_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    'ALTER TABLE "operations_routines" ADD COLUMN "location_class" VARCHAR(10)',
    'ALTER TABLE "operations_routines" ADD CONSTRAINT "operations_routines_location_class_known" CHECK ("location_class" IS NULL OR "location_class" IN (\'travel\', \'homebase\'))',
  ]);
  // Nothing that stands is read, updated or deleted; no default on the column, no trigger, no enum value.
  for (const s of statements) assert.match(s, /^(CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX|ALTER TABLE "\w+" ADD (CONSTRAINT|COLUMN)) /, `a statement that adds: ${s.slice(0, 60)}`);
  assert.doesNotMatch(code(MIGRATION), /\b(INSERT|DROP|TRUNCATE|TRIGGER|ADD VALUE|ALTER COLUMN|RENAME|SET DEFAULT)\b/i, 'the only UPDATE and DELETE are what the two foreign keys do ON them');
  assert.doesNotMatch(statements[6], /DEFAULT|NOT NULL/, 'the column admits NULL and carries no default — no row is rewritten');
  // The rules agree with the table's CHECKs: the code's shape, the two Locations.
  assert.ok(statements[0].includes(`CHECK ("code" ~ '${SUB_CODE_RE.source}')`), 'the code’s CHECK is the rule’s own pattern');
  assert.ok(statements[7].includes(`IN (${LOCATION_CLASSES.map((c) => `'${c}'`).join(', ')})`), 'the column’s CHECK holds the rule’s two keys');
  assert.ok(statements[0].includes(`"name" VARCHAR(${SUB_NAME_MAX})`), 'the name’s width is the rule’s bound');
  // The header says what it is, that nothing is backfilled, and that it was applied to no database.
  const header = comments(MIGRATION);
  assert.match(header, /COALEVELS-01 \(Alex, 2026-11-27\) — A TABLE AND A COLUMN: THE CHART'S SUB-ACCOUNTS, AND A STOP'S LOCATION\./);
  assert.match(header, /NO BACKFILL\. The table is created empty\./);
  assert.match(header, /AUTHORED, NOT APPLIED to any database\./);
});

test('M2 the schema moves with it: the model chart_of_sub_accounts after chart_of_accounts, field for field; the two back-relations; operations_routines.location_class after role — beside `location`, which is the venue', () => {
  const schema = code(SCHEMA);
  const model = (name: string): string => {
    const at = schema.indexOf(`\nmodel ${name} {`);
    assert.ok(at >= 0, `model ${name}`);
    return schema.slice(at + 1, schema.indexOf('\n}', at) + 2);
  };
  assert.deepEqual(model('chart_of_sub_accounts').split('\n').map(flat).filter(Boolean), [
    'model chart_of_sub_accounts {',
    'id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid',
    'userId String',
    'account_id String @db.Uuid',
    'code String @db.VarChar(2)',
    'name String @db.VarChar(100)',
    'is_archived Boolean @default(false)',
    'created_at DateTime @default(now()) @db.Timestamptz(6)',
    'updated_at DateTime @updatedAt @db.Timestamptz(6)',
    'created_by String?',
    'user users @relation(fields: [userId], references: [id], onDelete: Cascade)',
    'account chart_of_accounts @relation(fields: [account_id], references: [id])',
    '@@unique([account_id, code])',
    '@@unique([account_id, name])',
    '@@index([userId])',
    '}',
  ]);
  // After chart_of_accounts, and before the next model.
  const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
  assert.equal(models[models.indexOf('chart_of_accounts') + 1], 'chart_of_sub_accounts');
  assert.equal(models.filter((m) => m === 'chart_of_sub_accounts').length, 1);
  // The two back-relations: the account's, and the user's beside its chart_of_accounts.
  assert.match(model('chart_of_accounts'), /\n\s+sub_accounts\s+chart_of_sub_accounts\[\]\n/);
  assert.match(model('users'), /\n\s+chart_of_accounts\s+chart_of_accounts\[\]\n\s+chart_of_sub_accounts\s+chart_of_sub_accounts\[\]\n/);
  // The routine's Location: nullable, ten wide, after role — and `location` is still the venue's text.
  const routine = model('operations_routines');
  assert.match(routine, /\n\s+role\s+String\s+@default\("none"\) @db\.VarChar\(10\)\n\s*\n*\s*location_class\s+String\?\s+@db\.VarChar\(10\)\n/);
  assert.match(routine, /\n\s+location\s+String\?\s+@db\.VarChar\(255\)\n/);
  assert.equal(countOf(schema, /\blocation_class\b/g), 1, 'one column of that name, on the routine');
  assert.match(comments(SCHEMA), /COALEVELS-01 \(Alex, 2026-11-27\): the stop's LOCATION — 'travel' \| 'homebase' \| NULL \(not said\)/);
  assert.match(comments(SCHEMA), /It is NOT\n?\s*\/?\/?\s*`location` above, which is the venue's text\./);
});

// ── R · THE ROUTES (rulings 1.5, 1.9) ────────────────────────────────────────

test('R1 the sub-accounts route: /api/chart-of-accounts’ own gate order on both handlers — verified email, user, tab:books, entity setup — before anything is read; the account read as the caller’s with a defensive 404; the rule over its binding; 201; no paid call', () => {
  const src = code(SUB_ROUTE);
  assert.deepEqual([...src.matchAll(/^export async function (\w+)\(/gm)].map((m) => m[1]), ['GET', 'POST'], 'two handlers');
  const GATE = ['const userEmail = await getVerifiedEmail();', "return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });", 'const user = await prisma.users.', "return NextResponse.json({ error: 'User not found' }, { status: 404 });", "const tabGate = await requireTabAccess(user.id, 'tab:books');", 'if (tabGate) return tabGate;', 'const setup = await requireEntitySetup(user);', 'if (setup) return setup;'];
  // GET: the gate, then the one read — the caller's sub-accounts under the caller's accounts.
  const get = handler(src, 'GET');
  inOrder(get, [...GATE, 'const subAccounts = await prisma.chart_of_sub_accounts.findMany({'], 'GET');
  assert.match(flat(get), /where: \{ userId: user\.id, account: \{ userId: user\.id, \.\.\.\(entityId && \{ entity_id: entityId \}\), \.\.\.\(includeArchived \? \{\} : \{ is_archived: false \}\), \}, \.\.\.\(includeArchived \? \{\} : \{ is_archived: false \}\), \},/, 'the caller twice — on the sub-account and on its account; active under active unless asked');
  assert.match(get, /orderBy: \[\{ account: \{ code: 'asc' \} \}, \{ code: 'asc' \}\],/, 'by the account’s code, then the code');
  assert.match(flat(get), /subAccounts: subAccounts\.map\(\(s\) => \(\{ id: s\.id, accountId: s\.account_id, accountCode: s\.account\.code, entityId: s\.account\.entity_id, code: s\.code, name: s\.name, is_archived: s\.is_archived, \}\)\),/);
  assert.equal(countOf(get, /prisma\.\w+\.(findMany|findFirst|findUnique)\(/g), 2, 'the user, and the one read');
  // POST: the gate, then the body, the account as the caller's, the rule, the answer.
  const post = handler(src, 'POST');
  inOrder(post, [...GATE, 'const body = await request.json()', "return NextResponse.json({ error: 'accountId is required', field: 'accountId' }, { status: 400 });", 'await prisma.chart_of_accounts.findFirst({', "return NextResponse.json({ error: 'Account not found' }, { status: 404 });", 'const subAccount = await addSubAccount(prismaSubAccountDb(prisma), {', '}, { status: 201 });'], 'POST');
  assert.match(post, /where: \{ id: accountId, userId: user\.id, entity: \{ userId: user\.id \} \},/, 'the account is the caller’s, and so is its entity');
  assert.match(post, /const account = !isValidUuid\(accountId\) \? null : await prisma\.chart_of_accounts\.findFirst\(\{/, 'an id that is no account’s id at all is asked of no table — and answers as a missing one does');
  assert.equal(countOf(post, /'Account not found'/g), 1, 'ONE answer for a missing account and another user’s — it confirms nothing');
  assert.doesNotMatch(post, /status: 403/, 'never a 403');
  assert.match(flat(post), /parent: \{ id: account\.id, rendered: renderCode\(account\.code, account\.entity\.entity_type\), name: account\.name, is_archived: account\.is_archived \}, name, code, createdBy: userEmail,/);
  assert.match(flat(post), /subAccount: \{ id: subAccount\.id, accountId: subAccount\.account_id, accountCode: account\.code, code: subAccount\.code, name: subAccount\.name, is_archived: subAccount\.is_archived, \},/);
  // Faults through the fixed line; the table's one writer; no paid call, no other table written.
  assert.equal(countOf(src, /return failClosedResponse\(/g), 2, 'each handler’s catch');
  assert.doesNotMatch(src, /\bfetch\s*\(|anthropic|openai|stripe/i, 'no paid call');
  assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw/, 'the route writes through the rule’s port alone');
  // The gate is the chart route's own, line for line.
  const chart = code(CHART_ROUTE);
  for (const step of GATE.filter((g) => !g.startsWith('const user = '))) assert.equal(chart.split(step).length - 1, 2, `the chart route holds \`${step}\` on both its handlers`);
});

test('R2 the two routines routes take the Location: read by the one rule after the place — refused as a 400 on location_class in the rule’s words; written on create; on edit only when sent (null clears it); the move route is not changed; the registry’s cites into the two routes hold what they cite', () => {
  const create = code(ROUTINES_ROUTE);
  inOrder(create, ["const place = parsePlaceInput({ location: body.location, latitude: body.latitude, longitude: body.longitude });", 'const locationClass = readLocationClass(body.location_class);', "return NextResponse.json({ error: 'Validation', field: 'location_class', message: locationClass.words }, { status: 400 });", 'location: place.value.location,', 'location_class: locationClass.value,'], 'the create route');
  assert.match(create, /longitude: place\.value\.longitude,\n\s*location_class: locationClass\.value,\n\s*created_by: userEmail,/, 'in the create’s data, beside the place');
  const edit = code(ROUTINE_ROUTE);
  assert.match(edit, /if \('location_class' in body\) \{\n\s*const locationClass = readLocationClass\(body\.location_class\);\n\s*if \(!locationClass\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: 'location_class', message: locationClass\.words \}, \{ status: 400 \}\);\n\s*data\.location_class = locationClass\.value;\n\s*\}/, 'sent → read and written; not sent → untouched');
  assert.ok(edit.indexOf('data.longitude = place.value.longitude;') < edit.indexOf("if ('location_class' in body) {"), 'after the place block');
  for (const [file, src] of [[ROUTINES_ROUTE, create], [ROUTINE_ROUTE, edit]] as const) {
    assert.equal(countOf(src, /import \{ readLocationClass \} from '@\/lib\/operations\/locationClass';/g), 1, `${file}: the one rule, imported once`);
    assert.equal(countOf(src, /readLocationClass\(/g), 1, `${file}: read once`);
  }
  // The body's type names it; a plan copied to a new place says no Location.
  assert.match(code(ROUTINE_TYPES), /\n\s+location_class\?: string \| null;\n/);
  assert.doesNotMatch(code(MOVE_ROUTE), /location_class|readLocationClass/, 'the move route is not changed');
  // The registry cites three lines of the two routes: each holds what its cite names — the two above the edit did not move.
  const expenses = TOOL_REGISTRY.find((t) => t.name === 'Expenses');
  assert.ok(expenses);
  const cited = (re: RegExp): number => { const m = expenses.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  assert.match(linesOf(ROUTINES_ROUTE)[cited(/src\/app\/api\/operations\/routines\/route\.ts:(\d+) \(POST\)/) - 1], /^export async function POST\(/);
  assert.match(linesOf(ROUTINE_ROUTE)[cited(/routines\/\[id\]\/route\.ts:(\d+) \(PATCH\)/) - 1], /^export async function PATCH\(/);
  assert.match(linesOf(ROUTINE_ROUTE)[cited(/routines\/\[id\]\/route\.ts:(\d+) \(DELETE\)/) - 1], /^export async function DELETE\(/);
  assert.match(comments('src/lib/toolRegistry.ts'), /COALEVELS-01 \(2026-11-27\): the routine route grew again \(the read of a stop's Location, after the place\) — :581 → :\d+ \(DELETE\); what it cites unchanged\./);
});

// ═══ PART 2 · THE SHEET ══════════════════════════════════════════════════════
// Made-up plans: a lined stop whose routine says Travel (two lines on one account), a stop of its own whose routine says
// Homebase, and a stop on a second book whose routine says no Location; a stay from the second day whose place names a region.

const EAT = 'Africa/Nairobi'; // UTC+3 the year round
const D1 = '2027-10-04'; // a Monday — no stay covers it
const D2 = '2027-10-05';
const D3 = '2027-10-06';
/** Tuesday, 12:00 in the zone: all of Monday is past, Tuesday's supper is ahead. */
const SHEET_NOW = new Date('2027-10-05T09:00:00.000Z');
const atEat = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
const plan = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: EAT, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const PLANS: RoutinePlanInput[] = [
  plan({ id: 'supper', name: 'Supper', scheduleRrule: 'FREQ=DAILY;BYHOUR=19;BYMINUTE=0', steps: [
    { id: 'curry', stepOrder: 1, budgetAmount: 9, coaCode: '6150', durationMinutes: null, timeOfDay: null },
    { id: 'lassi', stepOrder: 2, budgetAmount: 2.5, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  plan({ id: 'climb', name: 'Climbing', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', budgetAmount: 14, coaCode: '6200' }),
  plan({ id: 'print', name: 'Print shop', entityId: 'B', entityType: 'sole_prop', scheduleRrule: 'FREQ=DAILY;BYHOUR=10;BYMINUTE=0', budgetAmount: 4, coaCode: '6400', role: 'none' }),
];
const PLAN_WORDS = new Map<string, RoutineWords>(PLANS.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: EAT, steps: new Map(r.id === 'supper' ? [['curry', { activity: 'Curry', timeOfDay: null }], ['lassi', { activity: 'Lassi', timeOfDay: null }]] : []),
}]));
const PLAN_LOCATIONS = new Map<string, LocationClass | null>([['supper', 'travel'], ['climb', 'homebase'], ['print', null]]);
const PLAN_SUBS: LedgerSubAccount[] = [
  { entityId: 'P', code: '6150', sub: '20', name: 'Curry' },
  // The stop's name in another case: a name is matched by its key.
  { entityId: 'P', code: '6200', sub: '30', name: 'CLIMBING' },
  { entityId: 'B', code: '6400', sub: '10', name: 'Print shop' },
  // The curry's name under ANOTHER account, and the lassi's under the same code in ANOTHER book: neither codes a line of P:6150.
  { entityId: 'P', code: '6200', sub: '40', name: 'Curry' },
  { entityId: 'B', code: '6150', sub: '50', name: 'Lassi' },
];
const sheetRecord = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const PLAN_RECORDS: LedgerRecordInput[] = [
  // Monday's curry, recorded on its line.
  { record: sheetRecord({ id: 'r-curry-1', kind: 'routine_line', target_id: 'curry', occurrence_at: atEat(D1, '19:00'), actual_cents: 950 }), routineId: 'supper', routineName: 'Supper', zone: EAT, role: 'place', activity: 'Curry', timeOfDay: null, durationMinutes: null },
  // A record of a routine the loader no longer lists — no line matches it.
  { record: sheetRecord({ id: 'r-kiosk-1', kind: 'routine', target_id: 'kiosk', occurrence_at: atEat(D1, '11:00'), actual_cents: 150 }), routineId: 'kiosk', routineName: 'Kiosk', zone: EAT, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
];
const PLAN_STAYS: StayRow[] = [{ id: 'hv', place: 'Harborview, Eastmarch, Ruritania', starts_on: D2, ends_on: '2027-10-20' }];
const planBuilt = buildRoutineBudgetLines(PLANS, D1, D3);
const sheetInput = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: D1, to: D3, now: SHEET_NOW, records: PLAN_RECORDS, links: [], lines: planBuilt.lines, open: [], notPlaced: planBuilt.notPlaced, routines: PLAN_WORDS, // PASTE-03 (2026-11-28): the input says its open occurrences — the lines that name their account and no amount; none here
  roles: new Map(PLANS.map((r): [string, string] => [r.id, r.role])), once: new Map(PLANS.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)])), clocks: routineClocksOf(PLANS), locations: PLAN_LOCATIONS, subAccounts: PLAN_SUBS, minutes: planMinutesOf(PLANS), vendors: [], stays: PLAN_STAYS, // EDIT-01 (2026-11-28): and each routine's one-off-ness — isOnceRRule over its own rule, as the answer builds it
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Recreation' }, { entityId: 'B', code: '6400', name: 'Printing' }],
  books: [{ id: 'P', entityType: 'personal' }, { id: 'B', entityType: 'sole_prop' }], ...over,
});
const planLedger = ledgerOf(sheetInput());
const planSheet = planLedger.sheet;
/** The sheet's one row of a name on a day — or the test fails by name. */
const rowOn = (rows: readonly LedgerSheetRow[], name: string, day: string): LedgerSheetRow => {
  const found = rows.filter((r) => r.description === name && r.day === day);
  assert.equal(found.length, 1, `one ${name} on ${day}`);
  return found[0];
};
const thrown = (run: () => unknown): string => {
  try { run(); } catch (error) { return error instanceof Error ? error.message : String(error); }
  return assert.fail('nothing was thrown');
};

const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SHEET_ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const SHEET_SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const EXPENSE_LEAF = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const PASTE_LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const OPENER = 'src/components/shell/ToolOpener.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const LAYOUT = 'src/components/ui/AppLayout.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';
const walk = (dir: string, ending: RegExp): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path, ending) : ending.test(name) ? [path] : [];
});

test('G1 a row’s Location is its ROUTINE’s: a routine’s own line by the routine’s id, a line by the routine that holds it — on a plan row and on a recorded row alike; a routine that says none gives null; a routine `locations` does not hold is thrown by name', () => {
  assert.equal(planSheet.length, 13, 'three days of the four lines, and Monday’s record no line matches');
  // A routine's own line: every climb is Homebase.
  for (const day of [D1, D2, D3]) assert.equal(rowOn(planSheet, 'Climbing', day).location, 'homebase', `${day}: the stop’s own routine`);
  // A line: the routine that holds it — both lines of the supper, on every day.
  for (const day of [D1, D2, D3]) assert.deepEqual([rowOn(planSheet, 'Curry', day).location, rowOn(planSheet, 'Lassi', day).location], ['travel', 'travel'], `${day}: the lines’ routine`);
  // A routine that says no Location: null, said.
  for (const day of [D1, D2, D3]) assert.equal(rowOn(planSheet, 'Print shop', day).location, null);
  // The recorded line is the row of `rows` — the same Location as the plan rows of its line.
  const recorded = rowOn(planSheet, 'Curry', D1);
  assert.deepEqual([recorded.id, recorded.location], ['r-curry-1', 'travel']);
  assert.equal(planLedger.rows.find((r) => r.id === 'r-curry-1'), recorded, 'the same row, not a copy');
  // The Location is the routine's, whatever the day or the place: a stay changes none.
  assert.deepEqual(ledgerOf(sheetInput({ stays: [] })).sheet.map((r) => r.location), planSheet.map((r) => r.location));
  // Every routine a line can be of is handed in — one that is not is this rule's error, by name; null is a value, not an absence.
  const without = new Map([...PLAN_LOCATIONS].filter(([id]) => id !== 'climb'));
  assert.match(thrown(() => ledgerOf(sheetInput({ locations: without }))), /^ledger: line routine:climb:\S+ is of routine climb, whose Location was not read$/);
  assert.match(thrown(() => ledgerOf(sheetInput({ locations: new Map([...PLAN_LOCATIONS].filter(([id]) => id !== 'supper')) }))), /^ledger: line line:(curry|lassi):\S+ is of routine supper, whose Location was not read$/);
  assert.doesNotThrow(() => ledgerOf(sheetInput({ locations: new Map([...PLAN_LOCATIONS.keys()].map((id): [string, null] => [id, null])) })));
  // In the source: the map is read with no default beside it.
  const rules = code(SHEET_RULES);
  assert.match(rules, /const location = input\.locations\.get\(routineId\);\n\s*if \(location === undefined\) throw new Error\(/);
  assert.doesNotMatch(rules, /input\.locations\.get\([^)]*\) \?\?/, 'a routine that is not held is never read as none');
});

test('G2 a row’s segments are its account, level by level — the entity’s letter, the Location’s code, the line’s code, the code of the sub-account of THAT account whose name is the stop’s — and the whole code they render; a level that is not there is left out, never invented', () => {
  const seg = (name: string, day: string, rows: readonly LedgerSheetRow[] = planSheet): LedgerSegments | null => rowOn(rows, name, day).segments;
  // A Location and a sub-account of its name.
  assert.deepEqual(seg('Curry', D2), { entity: 'P', location: 'TRV', category: '6150', type: '20', code: 'P-TRV-6150-20' });
  assert.deepEqual(seg('Climbing', D2), { entity: 'P', location: 'HOM', category: '6200', type: '30', code: 'P-HOM-6200-30' }, 'the name matched by its key — case does not part them');
  // A Location, and no sub-account of its name under ITS account: the same name under another account, or the same code in another book, codes nothing.
  assert.deepEqual(seg('Lassi', D2), { entity: 'P', location: 'TRV', category: '6150', type: null, code: 'P-TRV-6150' });
  // No Location, and a sub-account of its name.
  assert.deepEqual(seg('Print shop', D2), { entity: 'B', location: null, category: '6400', type: '10', code: 'B-6400-10' });
  // Neither: the entity and the code alone — what the cell printed until this change.
  const bare = ledgerOf(sheetInput({ subAccounts: [], locations: new Map([...PLAN_LOCATIONS.keys()].map((id): [string, null] => [id, null])) })).sheet;
  assert.deepEqual(seg('Curry', D2, bare), { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' });
  assert.deepEqual(seg('Print shop', D2, bare), { entity: 'B', location: null, category: '6400', type: null, code: 'B-6400' });
  for (const row of bare) if (row.segments !== null && row.coa !== null) assert.equal(row.segments.code, row.coa.account, `${row.key}: no Location and no sub-account — the whole code is the entity and the code`);
  // A recorded row whose line matched holds its line's levels — the plan row's own.
  assert.deepEqual(seg('Curry', D1), seg('Curry', D2));
  // The code is the one renderer's over the levels, and each level's code is its rule's own.
  for (const row of planSheet) {
    if (row.segments === null) continue;
    const s = row.segments;
    assert.equal(s.code, [s.entity, s.location, s.category, s.type].filter((part) => part !== null).join('-'), `${row.key}: the levels, in their order`);
    assert.equal(s.location, row.location === null ? null : LOCATION_CODES[row.location], `${row.key}: the Location’s code`);
  }
  // `coa` is as it was — the entity and the code, and the chart's name: the tones and the group by category still read it.
  assert.deepEqual(rowOn(planSheet, 'Curry', D2).coa, { account: 'P-6150', name: 'Dining Out' });
  assert.equal(accountCellWords(rowOn(planSheet, 'Curry', D2)), 'P-6150');
  // Two sub-accounts of one name under the line's account: the rule's own join names them, and picks neither.
  assert.equal(thrown(() => ledgerOf(sheetInput({ subAccounts: [...PLAN_SUBS, { entityId: 'P', code: '6150', sub: '60', name: ' curry ' }] }))), 'subAccounts: account P:6150 holds 2 sub-accounts named "Curry" (20, 60) — a name stands once under an account');
  // Wire-shaped: the sheet round-trips JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(planSheet)), planSheet);
  // In the source: the join is the sub-account rule's own, keyed as the accounts' names are; the code is the one renderer's.
  const rules = code(SHEET_RULES);
  assert.match(rules, /const sub = subAccountOf\(subAccounts, `\$\{l\.entityId\}:\$\{l\.code\}`, name\);/);
  assert.match(rules, /code: deriveAccountString\(\{ entityType, locationCode, code: l\.code, subType: type \}\)/);
  assert.match(rules, /input\.subAccounts\.map\(\(s\) => \(\{ accountId: `\$\{s\.entityId\}:\$\{s\.code\}`, code: s\.sub, name: s\.name \}\)\)/);
});

test('G3 a recorded row no line matches holds no Location and no segments — null, said; its four cells are the sheet’s blank and its CSV fields empty', () => {
  const kiosk = rowOn(planSheet, 'Kiosk', D1);
  assert.deepEqual([kiosk.id, kiosk.book, kiosk.coa, kiosk.location, kiosk.segments], ['r-kiosk-1', null, null, null, null]);
  assert.deepEqual([cellWordsOf(kiosk, 'location'), cellWordsOf(kiosk, 'account'), cellWordsOf(kiosk, 'accountName'), cellWordsOf(kiosk, 'book')], [BLANK, BLANK, BLANK, BLANK]);
  assert.deepEqual([LEDGER_CSV.location(kiosk), LEDGER_CSV.account(kiosk), LEDGER_CSV.region(kiosk)], ['', '', '']);
  assert.deepEqual([locationCellWords(kiosk), codeCellWords(kiosk), regionWords(kiosk)], [BLANK, BLANK, BLANK]);
  assert.equal(ledgerCsv([kiosk]).split('\r\n')[1], ['Monday', D1, '11:00', '', '', '', '', '', '', '', 'Kiosk', '', '', '', 'went', '', '', '', '', '', '1.50', '', '', '', ''].join(','));
  // Both fields stand on every row, after book — a recorded row's and a plan row's alike.
  for (const row of planSheet) {
    const keys = Object.keys(row);
    assert.deepEqual(keys.slice(keys.indexOf('book'), keys.indexOf('book') + 4), ['book', 'location', 'segments', 'coa'], row.key);
  }
});

test('G4 the twenty-five columns in his sheet’s words and order; REGION and LOCATION are VALUE columns; the cell words, the sort and the CSV of a row with a place of three parts, a Location and a whole code', () => {
  assert.deepEqual([...LEDGER_COLUMNS], ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'account', 'budget', 'actual', 'variance', 'match', 'underOver', 'notes']);
  assert.deepEqual([...LEDGER_HEAD_WORDS], ['DAY', 'DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'NOTES']);
  assert.deepEqual([LEDGER_COLUMNS.length, LEDGER_HEAD_WORDS.length, LEDGER_TABLE.length, new Set(LEDGER_HEAD_WORDS).size], [25, 25, 25, 25]);
  // No key is renamed: each prints under its new word.
  assert.deepEqual((['accountName', 'book', 'subAccountName', 'description', 'account', 'region', 'location'] as const).map(headWordOf), ['CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'COA', 'REGION', 'LOCATION']);
  // The kinds: the two new columns filter by a checklist; nothing else changed its kind.
  assert.deepEqual([columnKind('region'), columnKind('location'), columnKind('account'), columnKind('description'), columnKind('notes')], ['value', 'value', 'value', 'text', 'text']);
  assert.ok(VALUE_COLUMNS.includes('region') && VALUE_COLUMNS.includes('location'));
  assert.deepEqual([VALUE_COLUMNS.length, TEXT_COLUMNS.length, Object.keys(NO_COLUMN_FILTERS).length], [19, 2, 25]);
  assert.deepEqual([NO_COLUMN_FILTERS.region, NO_COLUMN_FILTERS.location], [NO_VALUE_FILTER, NO_VALUE_FILTER]);
  // A row, whole: Tuesday's curry — a stay of three parts, the routine's Location, the whole code under COA.
  const curry = rowOn(planSheet, 'Curry', D2);
  assert.deepEqual(curry.place, { city: 'Harborview', region: 'Eastmarch', country: 'Ruritania' });
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(curry, c)), ['Tuesday', D2, '19:00', BLANK, 'Harborview', 'Eastmarch', 'Ruritania', 'Travel', 'Dining Out', 'Personal', 'Curry', BLANK, BLANK, BLANK, 'planned', BLANK, BLANK, BLANK, 'P-TRV-6150-20', '$9', BLANK, BLANK, BLANK, BLANK, BLANK]);
  assert.equal(ledgerCsv([curry]).split('\r\n')[1], ['Tuesday', D2, '19:00', '', 'Harborview', 'Eastmarch', 'Ruritania', 'Travel', 'Dining Out', 'Personal', 'Curry', '', '', '', 'planned', '', '', '', 'P-TRV-6150-20', '9.00', '', '', '', '', ''].join(','));
  assert.equal(ledgerCsv([]), `${LEDGER_HEAD_WORDS.join(',')}\r\n`, 'no rows: the header alone');
  // Monday has no stay: the region is the blank with the place; a place of two parts names no region (the stay's rule, PART 1).
  assert.deepEqual([regionWords(rowOn(planSheet, 'Curry', D1)), regionWords(curry), regionWords({ ...curry, place: { city: 'Harborview', region: null, country: 'Ruritania' } })], [BLANK, 'Eastmarch', BLANK]);
  // The spec: every column's words, sort key and CSV field are the rule's own, for every row.
  for (const row of planSheet) {
    for (const c of LEDGER_TABLE) {
      assert.equal(c.words(row), cellWordsOf(row, c.key), `${c.key} words of ${row.key}`);
      assert.deepEqual(c.sortKey(row), sortKeyOf(row, c.key), `${c.key} sort key of ${row.key}`);
      assert.equal(c.csv(row), LEDGER_CSV[c.key](row), `${c.key} csv of ${row.key}`);
    }
    // The screen and the file agree on the three: a blank is "—" on screen and empty in the file.
    for (const key of ['region', 'location', 'account'] as const) assert.equal(LEDGER_CSV[key](row), cellWordsOf(row, key) === BLANK ? '' : cellWordsOf(row, key), `${key} of ${row.key}`);
  }
  // The checklists, each in its column's order, the blank last; a filter over them; the sort by each.
  assert.deepEqual(columnValues(planSheet, 'location'), [{ key: 'Homebase', count: 3 }, { key: 'Travel', count: 6 }, { key: BLANK, count: 4 }]);
  assert.deepEqual(columnValues(planSheet, 'region'), [{ key: 'Eastmarch', count: 8 }, { key: BLANK, count: 5 }]);
  assert.deepEqual(applyColumnFilters(planSheet, { ...NO_COLUMN_FILTERS, location: { dropped: ['Travel', BLANK] } }).map((r) => r.description), ['Climbing', 'Climbing', 'Climbing']);
  assert.deepEqual(applyColumnFilters(planSheet, { ...NO_COLUMN_FILTERS, region: { dropped: ['Eastmarch'] } }).map((r) => r.day), [D1, D1, D1, D1, D1]);
  const byLocation = sortRows(planSheet, { column: 'location', direction: 'asc' }).map((r) => cellWordsOf(r, 'location'));
  assert.deepEqual(byLocation, [...Array(3).fill('Homebase'), ...Array(6).fill('Travel'), ...Array(4).fill(BLANK)], 'by the word, the blank last');
  assert.deepEqual(sortRows(planSheet, { column: 'location', direction: 'desc' }).map((r) => cellWordsOf(r, 'location')).slice(0, 7), [...Array(6).fill('Travel'), 'Homebase'], 'descending: the blank still last');
  const byCode = sortRows(planSheet, { column: 'account', direction: 'asc' }).map((r) => cellWordsOf(r, 'account'));
  assert.deepEqual([...new Set(byCode)], ['B-6400-10', 'P-HOM-6200-30', 'P-TRV-6150', 'P-TRV-6150-20', BLANK], 'by the WHOLE code');
  // In the source: the CSV's own null path — never a screen helper; the COA cell reads the levels' code, not `coa`.
  const rules = code(SHEET_RULES);
  const block = rules.slice(rules.indexOf('export const LEDGER_CSV'), rules.indexOf('export const LEDGER_TABLE'));
  assert.doesNotMatch(block, /CellWords|BLANK|regionWords/, 'the CSV never calls a screen helper');
  assert.match(block, /region: \(row\) => row\.place === null \|\| row\.place\.region === null \? '' : row\.place\.region,/);
  assert.match(block, /location: \(row\) => row\.location === null \? '' : LOCATION_WORDS\[row\.location\],/);
  assert.match(rules, /case 'account': return codeCellWords\(row\);/);
  assert.match(rules, /export const accountCellWords = /, 'the entity and the code alone stay exported for what else reads them');
});

test('G5 a single day folds FIVE columns — REGION with the place — and its line above the table says the place’s three parts when every row of the day shares them; a region is a value, null too — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: a single day folds NOTHING, and the place is on every row', () => {
  // SHEET-01 (2026-11-28): the fold and its line above the table are deleted (ledger.ts's TIMEDAY-01 block). What this test pinned is pinned gone: no fold is typed in the rule file;
  // the twenty-five columns are drawn on one day as on any; and the day's place stands on every row, in its three cells — a region a value, null too.
  assert.doesNotMatch(code(SHEET_RULES), /DAY_FOLD|dayFold|dayPlaceWords|isOneDay|\]:hidden/, 'no fold, no class that hides a column, no line above the table');
  assert.deepEqual([LEDGER_COLUMNS.indexOf('plannedMinutes'), LEDGER_COLUMNS.indexOf('budget'), LEDGER_COLUMNS.length], [16, 19, 25], 'the TOTAL’s label spans sixteen, on one day as on any; twenty-five columns drawn');
  const ofTuesday = planSheet.filter((r) => r.day === D2);
  assert.ok(ofTuesday.length > 1);
  for (const r of ofTuesday) assert.deepEqual([cellWordsOf(r, 'city'), cellWordsOf(r, 'region'), cellWordsOf(r, 'country')], ['Harborview', 'Eastmarch', 'Ruritania'], 'the place’s three parts, on the row itself');
  for (const r of planSheet.filter((row) => row.day === D1)) assert.deepEqual([cellWordsOf(r, 'city'), cellWordsOf(r, 'region'), cellWordsOf(r, 'country')], [BLANK, BLANK, BLANK], 'no stay covers Monday — its rows say so, each');
  const withRegion = (region: string | null, rows: readonly LedgerSheetRow[] = ofTuesday): LedgerSheetRow[] => rows.map((r) => ({ ...r, place: r.place === null ? null : { ...r.place, region } }));
  for (const r of withRegion(null)) assert.deepEqual([cellWordsOf(r, 'city'), cellWordsOf(r, 'region'), cellWordsOf(r, 'country')], ['Harborview', BLANK, 'Ruritania'], 'a place that names no region: its cell is blank');
  assert.deepEqual(withRegion('Southmarch', ofTuesday.slice(0, 1)).map((r) => cellWordsOf(r, 'region')), ['Southmarch'], 'a region is the row’s own');
});

test('G6 the summary groups by TEN: region after city, location after country, type after the category — a row’s key by region and by location its cell’s words, by type its category’s name and its own; the chips say his sheet’s words; the title says by entity', () => {
  assert.deepEqual([...GROUP_KEYS], ['day', 'week', 'month', 'city', 'region', 'country', 'location', 'coa', 'type', 'book']);
  assert.deepEqual(GROUP_WORDS, { day: 'Day', week: 'Week', month: 'Month', city: 'City', region: 'Region', country: 'Country', location: 'Location', coa: 'Category', type: 'Type', book: 'Entity' });
  assert.deepEqual(GROUP_KEYS.map((g) => GROUP_WORDS[g]), ['Day', 'Week', 'Month', 'City', 'Region', 'Country', 'Location', 'Category', 'Type', 'Entity'], 'the chips, in their order');
  assert.equal(SUMMARY_TITLE_WORDS, 'over time, by place and by entity');
  const groups = (by: (typeof GROUP_KEYS)[number]) => ledgerSummary(planSheet, by).map((g) => [g.key, g.totals.budgetCents, g.totals.actualCents]);
  // By region: Monday's five rows under the blank; the stay's two days under its region.
  assert.deepEqual(groups('region'), [[BLANK, 2950, 1100], ['Eastmarch', 5900, null]]);
  // By location: the cell's words — the routine that says none, and the record no line matches, under the blank.
  assert.deepEqual(groups('location'), [[BLANK, 1200, 150], ['Homebase', 4200, null], ['Travel', 3450, 950]]);
  // By type: the category's name, then the stop's own — the row with no account under the blank's.
  assert.deepEqual(groups('type'), [[`${BLANK} › Kiosk`, null, 150], ['Dining Out › Curry', 2700, 950], ['Dining Out › Lassi', 750, null], ['Printing › Print shop', 1200, null], ['Recreation › Climbing', 4200, null]]);
  // One name under two categories is two types.
  const curry = rowOn(planSheet, 'Curry', D2);
  assert.deepEqual([typeGroupWords(curry), typeGroupWords({ ...curry, coa: { account: 'P-6200', name: 'Recreation' } })], ['Dining Out › Curry', 'Recreation › Curry']);
  // The five that stood keep their keys' own words: the category still groups by the code and the name, the book by its word.
  assert.deepEqual(ledgerSummary(planSheet, 'book').map((g) => g.key), ['Business', 'no account', 'Personal']);
  assert.deepEqual(ledgerSummary(planSheet, 'city').map((g) => g.key), [BLANK, 'Harborview']);
  // Every group's totals are the one rule's over its rows.
  for (const by of GROUP_KEYS) assert.equal(ledgerSummary(planSheet, by).reduce((sum, g) => sum + (g.totals.budgetCents ?? 0), 0), 8850, `${by}: the groups part the rows — (9 + 2.50 + 14 + 4) × 3`);
});

test('G7 "+ expense" asks the stop’s LOCATION after the ENTITY — none, Travel or Homebase, read by the one rule and never required; a word that is neither is refused on `location` in that rule’s words; its one-off’s body says location_class; the form’s labels are the sheet’s words', () => {
  assert.deepEqual([...EXPENSE_FIELDS], ['day', 'time', 'end', 'location', 'coa', 'book', 'name', 'note', 'vendor', 'tag', 'stars', 'logged', 'amount', 'actual', 'notes']); // SHEET-01 (2026-11-28): fifteen boxes, in the sheet's order — LOCATION before CATEGORY now; END, INSTAGRAM TAG, LOGGED MIN and NOTES joined
  assert.deepEqual([EXPENSE_FIELD_WORDS.name, EXPENSE_FIELD_WORDS.coa, EXPENSE_FIELD_WORDS.book, EXPENSE_FIELD_WORDS.location, EXPENSE_FIELD_WORDS.note], ['TYPE', 'CATEGORY', 'ENTITY', 'LOCATION', 'ITEMS']);
  assert.deepEqual([EXPENSE_FIELD_WORDS.name, EXPENSE_FIELD_WORDS.coa, EXPENSE_FIELD_WORDS.book, EXPENSE_FIELD_WORDS.location, EXPENSE_FIELD_WORDS.note], (['subAccountName', 'accountName', 'book', 'location', 'description'] as const).map(headWordOf), 'each the column’s own head word');
  assert.deepEqual([requiredWords('name'), requiredWords('coa'), requiredWords('book')], ['TYPE is required', 'CATEGORY is required', 'ENTITY is required'], 'every sentence built from them follows');
  assert.equal(EMPTY_EXPENSE.location, '');
  assert.equal(NO_LOCATION_WORDS, BLANK);
  assert.equal(SHEET_LOCATION_CLASSES, LOCATION_CLASSES, 'the form’s choices are the rule file’s own list, read through the sheet’s rules');
  assert.equal(SHEET_LOCATION_WORDS, LOCATION_WORDS, 'and its own words');
  const draft: ExpenseDraft = { ...EMPTY_EXPENSE, day: D1, time: '13:15', name: 'Dumplings', amount: '7.25', coa: '6150', book: 'P' };
  const read = (over: Partial<ExpenseDraft>) => expenseInput({ ...draft, ...over }, EAT, SHEET_NOW);
  const locationOf = (typed: string): LocationClass | null => {
    const r = read({ location: typed });
    if (!r.ok) return assert.fail(`refused: ${r.field} — ${r.message}`);
    return r.value.location;
  };
  // None, the two by their keys, and by their words in either case.
  assert.deepEqual(['', '   ', 'travel', 'homebase', 'Travel', 'HOMEBASE', ' Homebase '].map(locationOf), [null, null, 'travel', 'homebase', 'travel', 'homebase', 'homebase']);
  // A word that is neither: the rule's own words, on the form's `location`.
  assert.deepEqual(read({ location: 'abroad' }), { ok: false, field: 'location', message: locationUnknownWords('abroad') });
  // Read after the ENTITY and before the vendor: the first bad box is the one named.
  assert.deepEqual(read({ book: '', location: 'abroad' }), { ok: false, field: 'book', message: requiredWords('book') });
  assert.deepEqual(read({ location: 'abroad', vendorId: 'v1', vendorName: 'Steam Stall' }), { ok: false, field: 'location', message: locationUnknownWords('abroad') });
  // The one-off's body says it — beside the venue's text, which is as it was.
  const travel = read({ location: 'Travel' });
  const none = read({});
  assert.ok(travel.ok && none.ok);
  assert.deepEqual([oneOffBody(travel.value).location_class, oneOffBody(none.value).location_class, oneOffBody(travel.value).location], ['travel', null, '']);
  assert.deepEqual(Object.keys(oneOffBody(travel.value)).filter((key) => !Object.keys(oneOffBody(none.value)).includes(key)), [], 'the same keys, said or not');
  // In the source: the leaf's box — none first, then the rule's two; and the rule reads it with the one reader.
  const leaf = code(EXPENSE_LEAF);
  assert.ok(leaf.includes(`case 'location': return <ColumnBox column="location" value={draft.location} onChange={set('location')} />;`)); assert.ok(code('src/components/workbench/operations/ledger/ColumnBox.tsx').includes(`case 'location': return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.location} className={box} data-ledger-expense-box="location" {...keys}><option value="">{NO_LOCATION_WORDS}</option>{LOCATION_CLASSES.map((c) => <option key={c} value={c}>{LOCATION_WORDS[c]}</option>)}</select>;`)); // SHEET-01 (2026-11-28): the blank row's cell under LOCATION — none first, then the rule's two, labelled by its word; EDIT-01 (2026-11-28): the box is the one box of its column (ColumnBox.tsx) — none first, then the rule's two, labelled by its word, as it was
  assert.ok(LEDGER_COLUMNS.indexOf('location') < LEDGER_COLUMNS.indexOf('book') && leaf.includes('{LEDGER_COLUMNS.map((key) => <td key={key}'), 'in the sheet’s order — the cells drawn from the one list: LOCATION before CATEGORY and ENTITY'); // SHEET-01 (2026-11-28): the row draws the sheet's order — after the ENTITY's box until then
  assert.match(code(SHEET_RULES), /const location = readLocationClass\(draft\.location\);\n\s*if \(!location\.ok\) return refuseExpense\('location', location\.words\);/);
  assert.match(code(SHEET_RULES), /location_class: v\.location,/);
});

test('G8 in the source, the section: 488 lines, the three lines the registry cites where they stood; the controls on ONE line — title, two leaves, divider — and the tint’s swatch in the trailing; the cells in the sheet’s order, a level’s code before its word in four, a cut cell titled; the TOTAL’s label over nineteen and one cell under NOTES', () => {
  const s = code(SHEET_SECTION);
  const lines = linesOf(SHEET_SECTION);
  assert.equal(lines.length, 635); // SHEET-01 (2026-11-28): 432 — the notes, the summary and the fold are gone, the TOTAL row sums the minutes; 488 until then; SHEET-01 (2026-11-28): PART 3 moved it — three lines more above; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it); EDIT-01 (2026-11-28) (PART 3): 586 — the frame, below the section, reads the vendors once a VENDOR cell opens and hands the box what it lists; no cited line moved; 568 until then; EDIT-01 (2026-11-28) (PART 4): 625 — the ✕'s question, a row beneath the row, and the frame's question state below the section; 586 until then; EDIT-02 (2026-11-28) (PART 1): 635 — the frame, below the section, opens every typed cell with the refusal the rule knows and lists the provider's books for ENTITY; no cited line moved; 625 until then
  assert.match(lines[378], /data-ledger-cell="planned-minutes"/, ':379'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.match(lines[439], /data-ledger-total-planned-minutes/, ':440 — the TOTAL row’s two sums, which the registry cites now'); // SHEET-01 (2026-11-28): the coverage line is gone; the registry cites the TOTAL row's two sums; SHEET-01 (2026-11-28): PART 3 moved it — three lines more above; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it); EDIT-01 (2026-11-28) (PART 4): :440 — the ✕'s question stands beneath each row, above the TOTAL row; :430 until then
  assert.doesNotMatch(s, /data-ledger-group-planned-hours|data-ledger-said-planned/, 'the summary’s hours and the coverage line are gone — the registry cites neither'); // SHEET-01 (2026-11-28): re-pointed to its absence
  // The section's class: the table's box takes what is left of the window.
  assert.ok(lines[302].includes('<section className="space-y-1.5 [&_div:has(>[data-ledger-table])]:max-h-[calc(100vh-8rem)] [&_div:has(>[data-ledger-table])]:overflow-y-auto" data-ledger>'), ':303 — its own class alone'); // SHEET-01 (2026-11-28): the section's class is its own alone — no fold; SHEET-01 (2026-11-28): PART 3 moved it — three lines more above; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  // The five lines under it are a note: no markup stands between the section's tag and the shared table.
  assert.equal(lines.slice(303, 308).join('').replace(/\s+/g, ''), '{}', ':304–:308 hold one comment and nothing else'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  // The controls on ONE line: title, the two leaves exactly as they were mounted, a divider — at the head of the shared table's controls.
  assert.ok(lines[328].trim().startsWith('<><h2 className="text-sm font-bold text-brand-purple" data-ledger-title>{LEDGER_TITLE_WORDS}</h2><ExpenseOpen open={adding} onToggle={() => setAdding((open) => !open)} /><PasteRows onWritten={(days) => { setWrites((n) => n + 1); days.forEach(announceDayWritten); }} /><span className="h-4 w-px bg-border" aria-hidden="true" />'), ':329'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.deepEqual([countOf(s, /<h2\b/g), countOf(s, /<ExpenseOpen\b/g), countOf(s, /<PasteRows\b/g)], [1, 1, 1]); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three
  // The swatch: the tint's legend, its meaning its label and its title.
  assert.ok(lines[339].trim().startsWith('<>{answer !== null && answer.read.ok && shown.length > 0 && <span className={`inline-block h-3 w-3 rounded-sm border border-border ${NOT_TYPED_TINT}`} role="img" aria-label={NOT_TYPED_WORDS} title={NOT_TYPED_WORDS} data-ledger-legend data-ledger-legend-swatch />}'), ':340'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.deepEqual([countOf(s, /data-ledger-legend(?![-\w])/g), countOf(s, /data-ledger-legend-swatch/g)], [1, 1], 'the legend is the swatch — no separate line beneath the table');
  // The cells, one per head word, in the head's order; each keeps its name.
  const cells = [...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cells, LEDGER_COLUMNS.map((key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)));
  const cellOn = (n: number, name: string): string => {
    const line = lines[n - 1];
    const at = line.indexOf(`data-ledger-cell="${name}"`);
    assert.ok(at >= 0, `:${n} holds the ${name} cell`);
    return line.slice(line.lastIndexOf('<td ', at), line.indexOf('</td>', at) + '</td>'.length);
  };
  // :363 city, then region; :364 country, then location; :366 CATEGORY; :367 ENTITY; :368 TYPE, then ITEMS; :369 vendor, then tag; :380 logged minutes, then COA; :389 notes.; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(363, 'region'), '<td className={`${cell} ${row.place === null || row.place.region === null ? BLANK_CLASS : \'\'}`} data-ledger-cell="region" title={titleOf(row, \'region\')} onClick={(e) => clickCell(e, row, \'region\')}>{boxIn(row, \'region\') ?? regionWords(row)}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it); EDIT-02 (2026-11-28) (PART 1): the cell opens as its box — its click, and its box before what it prints
  assert.ok(lines[362].indexOf('data-ledger-cell="city"') < lines[362].indexOf('data-ledger-cell="region"')); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(364, 'location'), '<td className={`${cell} ${row.location === null ? BLANK_CLASS : \'\'}`} data-ledger-cell="location" title={titleOf(row, \'location\')} onClick={(e) => clickCell(e, row, \'location\')}>{boxIn(row, \'location\') ?? <>{row.segments !== null && row.segments.location !== null && <span className={CODE_CLASS}>{row.segments.location}</span>}{locationCellWords(row)}</>}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.ok(lines[363].indexOf('data-ledger-cell="country"') < lines[363].indexOf('data-ledger-cell="location"')); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(lines[364].replace(/\s+/g, ''), '{}', ':365 — a note where the book’s cell stood'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(366, 'account-name'), '<td className={`${cell} ${row.coa === null || row.coa.name === null ? BLANK_CLASS : \'\'}`} data-ledger-cell="account-name" title={titleOf(row, \'accountName\')} onClick={(e) => clickCell(e, row, \'accountName\')}>{boxIn(row, \'accountName\') ?? <>{row.segments !== null && <span className={CODE_CLASS}>{row.segments.category}</span>}{accountPill === null ? accountNameCellWords(row) : <span className={accountPill} data-ledger-pill="account-name">{accountNameCellWords(row)}</span>}</>}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(367, 'book'), '<td className={`${cell} whitespace-nowrap ${row.book === null ? BLANK_CLASS : \'\'}`} data-ledger-cell="book" title={titleOf(row, \'book\')} onClick={(e) => clickCell(e, row, \'book\')}>{boxIn(row, \'book\') ?? <>{row.segments !== null && row.segments.entity !== null && <span className={CODE_CLASS}>{row.segments.entity}</span>}{bookPill === null ? bookCellWords(row) : <span className={bookPill} data-ledger-pill="book">{bookCellWords(row)}</span>}</>}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it); EDIT-02 (2026-11-28) (PART 1): the cell opens as its box — its click, and its box before what it prints
  assert.equal(cellOn(368, 'sub-account-name'), '<td className={`${cell} font-semibold text-text-primary`} data-ledger-cell="sub-account-name" title={titleOf(row, \'subAccountName\', row.description)} onClick={(e) => clickCell(e, row, \'subAccountName\')}>{boxIn(row, \'subAccountName\') ?? <>{row.segments !== null && row.segments.type !== null && <span className={CODE_CLASS}>{row.segments.type}</span>}{row.description}</>}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(368, 'description'), '<td className={`${cell} ${descriptionOf(row) === null ? BLANK_CLASS : plannedDescription(row) ? PLANNED_CLASS : \'text-text-muted\'}`} data-ledger-cell="description" data-ledger-planned={plannedDescription(row) ? \'\' : undefined} title={titleOf(row, \'description\', plannedDescription(row) ? `${PLANNED_ITEMS_TITLE_WORDS} — ${noteCellWords(descriptionOf(row))}` : descriptionOf(row) ?? undefined)} onClick={(e) => clickCell(e, row, \'description\')}>{boxIn(row, \'description\') ?? noteCellWords(descriptionOf(row))}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.ok(lines[367].indexOf('data-ledger-cell="sub-account-name"') < lines[367].indexOf('data-ledger-cell="description"')); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(369, 'vendor'), '<td className={`${cell} ${row.vendor === null ? BLANK_CLASS : \'\'}`} data-ledger-cell="vendor" title={titleOf(row, \'vendor\', row.vendor ?? undefined)} onClick={(e) => clickCell(e, row, \'vendor\')}>{boxIn(row, \'vendor\') ?? vendorCellWords(row.vendor)}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.ok(lines[368].includes('data-ledger-cell="instagram-tag" title={titleOf(row, \'instagramTag\')} onClick={(e) => clickCell(e, row, \'instagramTag\')}>{boxIn(row, \'instagramTag\') ?? tagCellWords(row.instagramTag)}</td>')); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(cellOn(380, 'account'), '<td className={`${cell} whitespace-nowrap ${row.segments === null ? BLANK_CLASS : \'font-mono text-[11px] font-semibold text-text-primary\'}`} data-ledger-cell="account" title={titleOf(row, \'account\')}>{codeCellWords(row)}</td>'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.ok(lines[379].indexOf('data-ledger-cell="logged-minutes"') < lines[379].indexOf('data-ledger-cell="account"')); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.equal(lines[388].trim(), '<td className={`${cell} ${row.notes === null ? BLANK_CLASS : \'text-text-muted\'}`} data-ledger-cell="notes" title={titleOf(row, \'notes\', row.notes ?? undefined)} onClick={(e) => clickCell(e, row, \'notes\')}>{boxIn(row, \'notes\') ?? noteCellWords(row.notes)}</td>', ':389 — the notes’ cell alone'); // SHEET-01 (2026-11-28): the section gained three lines in PART 3 — the `adding` state and its note, the `first` prop; :244–:316 moved by two, :317 on by three; EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  // A level's code is printed before its word in FOUR cells, in the one class — typed whole, once — and never where the row has none.
  assert.ok(s.includes("const CODE_CLASS = 'font-mono text-[11px] text-text-muted mr-1.5 tabular-nums';"));
  assert.deepEqual([...s.matchAll(/<span className=\{CODE_CLASS\}>\{row\.segments\.([a-z]+)\}<\/span>/g)].map((m) => m[1]), ['location', 'category', 'entity', 'type']);
  assert.equal(countOf(s, /\bCODE_CLASS\b/g), 5, 'typed once, read by the four cells');
  assert.equal(countOf(s, /row\.segments !== null && /g), 4, 'no segments — no span');
  assert.equal(countOf(s, /row\.segments\.(location|entity|type) !== null && <span/g), 3, 'a level that is null — no span (the category is never null)');
  // A cut cell says itself whole on hover: the four the table's class cuts.
  assert.deepEqual([...s.matchAll(/ title=\{titleOf\(row, '(\w+)', /g)].map((m) => m[1]).filter((name) => name !== 'match'), ['subAccountName', 'description', 'vendor', 'notes']); assert.equal(countOf(s, / title=\{titleOf\(row, '/g), LEDGER_COLUMNS.length, 'every cell titled — its own, or why it does not open'); // EDIT-01 (2026-11-28): the section grew above it — every line from :290 moved by eight (two imports, an import line, the read of `editing` and the frame's call), the TOTAL row by twenty (the open cell's line above it)
  assert.deepEqual(LEDGER_TABLE_CLASS.split(' ').filter((c) => c.endsWith(':truncate')), ['sub-account-name', 'description', 'vendor', 'notes'].map((name) => `[&_td[data-ledger-cell=${name}]]:truncate`), 'the same four');
  // The TOTAL row: its label over the nineteen columns before BUDGET (less a single day's fold), the five it has, then ONE cell under NOTES.
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.ok(tfoot.includes('<th scope="row" colSpan={LEDGER_COLUMNS.indexOf(\'plannedMinutes\')} className={`${cell} text-left`}>{TOTAL_WORDS}</th>')); // SHEET-01 (2026-11-28): the label spans the columns before PLANNED MIN, worked out — nineteen less the fold until then
  assert.deepEqual([...tfoot.matchAll(/data-ledger-total-([a-z-]+)/g)].map((m) => m[1]), ['planned-minutes', 'logged-minutes', 'account', 'budget', 'actual', 'variance', 'match', 'under-over', 'notes']); // SHEET-01 (2026-11-28): the two minutes' sums and COA's empty cell before BUDGET
  assert.equal(LEDGER_COLUMNS.indexOf('plannedMinutes') + 2 + 1 + 6, LEDGER_COLUMNS.length); // SHEET-01 (2026-11-28): the label, the two sums, COA's cell and the six — 19 + 6 until then
  assert.doesNotMatch(s, /data-ledger-total-description/);
  // The section imports the three cell rules it prints, and no longer the entity-and-code one.
  assert.deepEqual([countOf(s, /\bcodeCellWords\b/g), countOf(s, /\blocationCellWords\b/g), countOf(s, /\bregionWords\b/g), countOf(s, /\baccountCellWords\b/g)], [2, 2, 2, 0]);
  // No sentence of its own, no box in a row, nothing fetched or stored.
  assert.doesNotMatch(s, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|contentEditable/);
  assert.match(comments(SHEET_SECTION), /COALEVELS-01 \(2026-11-27\), Alex — ONE LINE OF CONTROLS\./);
});

/** The grid's class, as ruled — typed whole here too, so a variant that drifts is named by the test and not by the eye. */
const RULED_TABLE_CLASS = 'min-w-[96rem] [&_th]:whitespace-normal [&_th]:px-1.5 [&_th]:py-1 [&_th]:align-bottom [&_td]:px-1.5 [&_td[data-ledger-cell]]:py-0.5 [&_td[data-ledger-cell]]:align-middle [&_td[data-ledger-cell]]:whitespace-nowrap [&_th]:border-l [&_th]:border-border [&_td]:border-l [&_td]:border-border [&_th:first-child]:border-l-0 [&_td:first-child]:border-l-0 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-bg-row [&_thead_th]:shadow-[inset_0_-1px_0_rgb(var(--ts-border))] [&_tfoot_th]:sticky [&_tfoot_th]:bottom-0 [&_tfoot_th]:bg-bg-row [&_tfoot_th]:py-0.5 [&_tfoot_th]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tfoot_td]:sticky [&_tfoot_td]:bottom-0 [&_tfoot_td]:bg-bg-row [&_tfoot_td]:py-0.5 [&_tfoot_td]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tr[data-ledger-row]:hover]:bg-bg-row [&_[data-ledger-pill]]:px-1.5 [&_[data-ledger-pill]]:py-0 [&_td[data-ledger-cell]_button]:px-1 [&_td[data-ledger-cell]_button]:py-0 [&_td[data-ledger-cell]_button]:leading-[14px] [&_td[data-ledger-cell=sub-account-name]]:max-w-[12rem] [&_td[data-ledger-cell=sub-account-name]]:truncate [&_td[data-ledger-cell=description]]:max-w-[16rem] [&_td[data-ledger-cell=description]]:truncate [&_td[data-ledger-cell=vendor]]:max-w-[11rem] [&_td[data-ledger-cell=vendor]]:truncate [&_td[data-ledger-cell=notes]]:max-w-[14rem] [&_td[data-ledger-cell=notes]]:truncate';

test('G9 the grid’s class is typed WHOLE, exactly as ruled — the rule file’s last export and last line, its note above it saying what the variants do; every attribute a variant finds a cell by is one the section or the shared table writes', () => {
  assert.equal(LEDGER_TABLE_CLASS, RULED_TABLE_CLASS);
  const line = `export const LEDGER_TABLE_CLASS = '${RULED_TABLE_CLASS}';`;
  const rules = code(SHEET_RULES);
  assert.equal(rules.split(line).length - 1, 1, 'typed once, whole, on one line');
  assert.equal(rules.replace(/\s+$/, '').split('\n').at(-1), line, 'the file’s last line');
  assert.equal(rules.split('\n').filter((l) => /^export /.test(l)).at(-1), line, 'its last export');
  assert.doesNotMatch(line, /\$\{|`| \+ |\.join\(/, 'a plain string literal — nothing joined');
  const classes = RULED_TABLE_CLASS.split(' ');
  assert.deepEqual([classes.length, new Set(classes).size, classes[0]], [44, 44, 'min-w-[96rem]'], 'the floor the table had, and forty-three variants — each once');
  assert.ok(classes.slice(1).every((c) => /^\[&_[^ ]+\]:[^ ]+$/.test(c)), 'every other class is a variant: an element under the table, then one utility');
  // What a variant finds: the section's own attributes, and nothing the shared table does not hold.
  const section = code(SHEET_SECTION);
  for (const attr of ['data-ledger-row={row.key}', 'data-ledger-pill="book"', 'data-ledger-pill="account-name"', 'data-ledger-cell="sub-account-name"', 'data-ledger-cell="description"', 'data-ledger-cell="vendor"', 'data-ledger-cell="notes"']) assert.ok(section.includes(attr), attr);
  assert.match(section, /tableClassName=\{LEDGER_TABLE_CLASS\}/);
  assert.match(section, /<tfoot>/);
  // The section's own class reaches the table's box by the attribute the shared table writes on the table itself.
  assert.match(code('src/components/table/DataTable.tsx'), /<div className="overflow-x-auto border border-border rounded bg-white">\n\s*<table className=\{`w-full \$\{tableClassName\} border-collapse text-xs`\} \{\.\.\.dataAttr\(name, 'table'\)\}>/);
  // The note above the class says what the variants do now.
  const whole = comments(SHEET_RULES);
  assert.match(whole, /COALEVELS-01 \(Alex, 2026-11-27\): THE GRID\./);
});

test('G10 the shell: ToolOpener takes ONE new prop, `compact` — false when not passed — and /time alone passes it; compact is one line: the family, then each tool’s number, name, status and its registry line cut to the line, whole in its title; the wide page’s padding; the two leaves’ roots by `open`', () => {
  const o = code(OPENER);
  assert.ok(o.includes('export default function ToolOpener({ tools, line, actions, compact = false }: {'));
  assert.match(o, /\n\s*compact\?: boolean;\n/);
  assert.equal(countOf(o, /\bcompact\b/g), 3, 'the prop, its default, and the one test of it');
  const start = o.indexOf('  if (compact) {\n');
  assert.ok(start > 0, 'the one test of the prop');
  const branch = o.slice(start, o.indexOf('\n  }\n', start));
  assert.ok(branch.includes('<header className="mb-1.5 flex items-baseline gap-x-2 text-xs" data-tool-opener={tools.map((t) => t.name).join(\' + \')}>'), 'one line');
  assert.match(branch, /<p className="[^"]*\bwhitespace-nowrap\b[^"]*">\n\s*\{familyWord\(first\.family\)\}\n\s*<\/p>/, 'the family, on the line');
  assert.ok(branch.includes('<span key={tool.name} className="flex min-w-0 flex-1 items-baseline gap-x-2" data-opener-tool={tool.name} id={tool.name.toLowerCase().replace(/[^a-z0-9]+/g, \'-\')}>'));
  assert.ok(branch.includes('<h1 className="text-sm font-semibold tracking-tight text-text-primary">{tool.name}</h1>'));
  assert.ok(branch.includes('<StatusChip status={tool.status} />'));
  assert.ok(branch.includes('{tool.line && <span className="min-w-0 flex-1 truncate text-text-muted" title={tool.line}>{tool.line}</span>}'), 'the registry line, cut to the line and whole in its title');
  assert.doesNotMatch(branch, /StageStrip|phases|\{line\}|\{actions\}/, 'the family, the name and the registry line — no other prose, no strip, no actions');
  // Not passed, the opener is as it was: the full header still stands after the compact branch.
  assert.equal(countOf(o, /<header\b/g), 2);
  // /time alone passes it.
  /** Every mount of the opener in a file, whole: a one-line mount to its line's end, a longer one to the `/>` at its own indent. */
  const mountsOf = (file: string): string[] => {
    const text = code(file).split('\n');
    const found: string[] = [];
    text.forEach((line, i) => {
      const at = line.indexOf('<ToolOpener');
      if (at < 0) return;
      if (line.includes('/>', at)) { found.push(line.slice(at).trim()); return; }
      const end = text.findIndex((l, j) => j > i && l === `${line.slice(0, at)}/>`);
      assert.ok(end > i, `${file}:${i + 1} — the mount closes at its own indent`);
      found.push(text.slice(i, end + 1).map((l) => l.trim()).join(' '));
    });
    return found;
  };
  const mounts = walk('src', /\.tsx$/).filter((file) => file !== OPENER).flatMap((file) => mountsOf(file).map((mount) => ({ file, mount })));
  assert.ok(mounts.length > 10, 'the walk found the mounts');
  assert.deepEqual(mounts.filter((m) => /\bcompact\b/.test(m.mount)), [{ file: TIME_PAGE, mount: "<ToolOpener compact tools={[navToolByName('Time', TOOL_GATE)]} />" }]);
  // The wide page — /time's alone — has its own padding.
  assert.ok(code(LAYOUT).includes("<main className={page && wide ? 'w-full min-w-0 px-3 py-2' : page ? 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8' : 'max-w-[1800px] mx-auto w-full'}>"));
  // The two leaves' roots: shut, the root is `contents` and its button stands in the controls row; open, it takes the row's whole width beneath.
  assert.match(code(EXPENSE_LEAF), /export function ExpenseOpen\(\{ open, onToggle \}: \{ open: boolean; onToggle: \(\) => void \}\) \{\n\s*return <button type="button" className=\{open \? chipOn : chip\} onClick=\{onToggle\} aria-pressed=\{open\} data-ledger-expense-open>\{EXPENSE_WORDS\}<\/button>;/, 'the expense leaf’s chip stands in the controls row; its row is the table’s first'); for (const [file, attr] of [[PASTE_LEAF, 'data-ledger-paste']] as const) { // SHEET-01 (2026-11-28): "+ expense" is a chip in the controls row and a blank row at the top of the table — no root of its own; the paste's root as it was
    assert.ok(code(file).includes(`<div className={open ? 'order-last w-full space-y-2' : 'contents'} ${attr}>`), file);
  }
  // The registry's cite into the expense form still holds its one-off's write.
  assert.match(linesOf(EXPENSE_LEAF)[77], /^export default function ExpenseRow\(/, 'ExpenseForm.tsx:78 — the blank row'); // SHEET-01 (2026-11-28): the registry's cite follows ExpenseRow — the create at :87 until then
});

test('G11 the answer reads NINE — the caller’s active sub-accounts beside the eight — and hands the rule every routine’s Location and each sub-account by its account’s book and code; over a stand-in client the levels ride the one answer; a sub-account of no chart row read, and a stored Location that is neither, are thrown by name; the registry’s two cites follow the rule file', async () => {
  const a = code(SHEET_ANSWER);
  assert.equal(countOf(a, /db\.[a-z_]+\.(findMany|findFirst)\(/g), 9);
  assert.match(a, /db\.chart_of_sub_accounts\.findMany\(\{ where: \{ userId: userId, is_archived: false \}, select: \{ account_id: true, code: true, name: true \} \}\),/);
  assert.match(a, /select: \{ id: true, entity_id: true, code: true, name: true, account_type: true, balance_type: true \},/);
  assert.match(a, /db\.operations_routines\.findMany\(\{ where: \{ user_id: userId \}, select: \{ id: true, role: true, location_class: true \} \}\),/);
  assert.match(a, /locations: new Map\(roles\.map\(\(r\) => \[r\.id, locationClassOf\(r\.location_class, `routine \$\{r\.id\}`\)\]\)\),\n\s*subAccounts,/);
  assert.match(a, /return \{ entityId: account\.entityId, code: account\.code, sub: s\.code, name: s\.name \};/);
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, 'writes nothing');
  // The two lines the registry cites in it are where they stood.
  assert.match(linesOf(SHEET_ANSWER)[41], /start_time: true, end_time: true/, ':42');
  assert.match(linesOf(SHEET_ANSWER)[42], /duration_minutes: true/, ':43');
  // Over a stand-in client: one routine row serves the loader's read and the roles read.
  type Call = { readonly table: string; readonly method: string };
  const standIn = (rows: Readonly<Record<string, readonly unknown[]>>, calls: Call[]) => {
    const db: Record<string, { findMany: () => Promise<unknown[]>; findFirst: () => Promise<unknown> }> = {};
    for (const table of Object.keys(rows)) {
      db[table] = {
        findMany: async () => { calls.push({ table, method: 'findMany' }); return [...rows[table]]; },
        findFirst: async () => { calls.push({ table, method: 'findFirst' }); return rows[table].length === 0 ? null : rows[table][0]; },
      };
    }
    return db as unknown as Parameters<typeof taskLedgerAnswerOf>[0];
  };
  const routineRow = (locationClass: string | null) => ({
    id: 'supper', name: 'Supper', role: 'place', location_class: locationClass, is_active: true, end_date: null, start_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=19;BYMINUTE=0', timezone: EAT, start_time: null, end_time: null,
    steps: [{ id: 'curry', is_active: true, budget_amount: 9, coa_code: '6150', step_order: 1, activity: 'Curry', time_of_day: null, duration_minutes: null }],
  });
  const tables = (over: { readonly location?: string | null; readonly subs?: readonly unknown[] } = {}) => ({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }],
    chart_of_accounts: [{ id: 'acct-6150', entity_id: 'P', code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' }],
    chart_of_sub_accounts: over.subs ?? [{ account_id: 'acct-6150', code: '20', name: 'Curry' }],
    operations_routines: [routineRow(over.location === undefined ? 'travel' : over.location)], planned_item_vendors: [], operations_stays: [], operations_stop_records: [], planned_item_links: [],
  });
  const calls: Call[] = [];
  const answer = await taskLedgerAnswerOf(standIn(tables(), calls), 'someone', { from: D2, to: D2 }, SHEET_NOW);
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'operations_routines.findMany', 'chart_of_sub_accounts.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany']);
  assert.deepEqual(answer.sheet.map((r) => [r.description, r.location, r.segments]), [['Curry', 'travel', { entity: 'P', location: 'TRV', category: '6150', type: '20', code: 'P-TRV-6150-20' }]]);
  assert.deepEqual(JSON.parse(JSON.stringify(answer)), answer, 'wire-shaped as built');
  // A routine that says none, and a caller with no sub-accounts: the levels that are there, and no others.
  const bare = await taskLedgerAnswerOf(standIn(tables({ location: null, subs: [] }), []), 'someone', { from: D2, to: D2 }, SHEET_NOW);
  assert.deepEqual(bare.sheet.map((r) => [r.location, r.segments]), [[null, { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }]]);
  // A sub-account whose account is no chart row read; a stored Location that is neither of the two — each thrown by name, nothing printed as none.
  await assert.rejects(taskLedgerAnswerOf(standIn(tables({ subs: [{ account_id: 'acct-gone', code: '20', name: 'Curry' }] }), []), 'someone', { from: D2, to: D2 }, SHEET_NOW), /ledger GET: sub-account "20" "Curry" names account acct-gone, which is no chart row read/);
  await assert.rejects(taskLedgerAnswerOf(standIn(tables({ location: 'abroad' }), []), 'someone', { from: D2, to: D2 }, SHEET_NOW), /locationClass: routine supper holds the Location "abroad" — not one of travel, homebase/);
  // THE REGISTRY: the Time row's two cites into the rule file stand where the two lines stand; no status, beat or word of it changed.
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  const cited = (re: RegExp): number => { const m = time.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  const heads = cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS — EDIT-02, 2026-11-28: was :\d+/); // PASTE-03 (2026-11-28): the cite's own "was" is that change's now — the rule file grew above both lines again (a stop may have no budget) and the registry's two cites followed; "COALEVELS-01, 2026-11-27: was" stood there until then; EDIT-01 (2026-11-28): the cite's own "was" is this change's now — the rule file grew above the line again (each row's plan in the answer); EDIT-02 (2026-11-28) (PART 1): the cite's own "was" is EDIT-02's now — the rule file grew above it again
  assert.doesNotMatch(time.citation, /the summary's sums|SUMMARY_HEAD_WORDS/, 'the summary’s words left the citation with the summary'); // SHEET-01 (2026-11-28): re-pointed to its absence
  assert.match(linesOf(SHEET_RULES)[heads - 1], /^export const LEDGER_HEAD_WORDS = \[/);
  assert.ok(linesOf(SHEET_RULES).some((l) => /^export const SUMMARY_HEAD_WORDS = \[/.test(l)), 'the words stay in the rule file, uncalled'); // SHEET-01 (2026-11-28): the words stay, uncalled
  assert.equal(countOf(time.citation, /src\/lib\/operations\/ledger\.ts:\d+/g), 1, 'the rule file cited once — LEDGER_HEAD_WORDS'); // SHEET-01 (2026-11-28): twice until then
  const said = comments(REGISTRY).split('\n').find((l) => l.includes('COALEVELS-01 (Alex, 2026-11-27): ledger.ts grew'));
  assert.ok(said !== undefined, 'the dated sentence, on the row’s comment line');
  assert.match(said, new RegExp(`ledger\\.ts :\\d+ → :${heads} \\(LEDGER_HEAD_WORDS\\); what it cites unchanged\\.`)); // SHEET-01 (2026-11-28): the sentence is PASTE-03's history; no cite names SUMMARY_HEAD_WORDS now; EDIT-01 (2026-11-28): the sentence is this change's — the same line, one cite
});
