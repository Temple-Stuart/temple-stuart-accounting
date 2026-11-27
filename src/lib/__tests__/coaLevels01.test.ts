/**
 * COALEVELS-01 (Alex, 2026-11-27) — THE ACCOUNT'S LEVELS: A CHART'S SUB-ACCOUNTS, A STOP'S LOCATION, AND THE PLACE'S THREE PARTS.
 *
 * PART 1 (S, L, A, P, M, R below): the rules and the database. The sub-account rule (src/lib/coa/subAccounts.ts) is driven
 * over an in-memory port; the Location rule (src/lib/operations/locationClass.ts), the account string and the place's split
 * are driven with made-up values; the migration, the schema, the new route and the two routines routes are read from source
 * through sourceText — code() for what the code does, comments() only for a header's words.
 *
 * HERMETIC: no database, no request, no clock. No route is run here and no SQL: what a database does with the migration is
 * not this file's to say. Every name, place, code and amount below is made up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { ValidationError } from '../errors/ValidationError';
import { deriveAccountString } from '../accountString';
import { renderCode } from '../coa/scheme';
import {
  SUB_CODES_USED_UP_WORDS, SUB_CODE_LAST, SUB_CODE_RE, SUB_CODE_SHAPE_WORDS, SUB_CODE_STEP, SUB_NAME_CONTROL_WORDS, SUB_NAME_LONG_WORDS, SUB_NAME_MAX, SUB_NAME_REQUIRED_WORDS,
  addSubAccount, nextSubCode, parseSubCode, parseSubName, subAccountNameKey, subAccountOf, subAccountWords,
  type NewSubAccount, type SubAccountDb, type SubAccountParent, type SubAccountRef, type SubAccountRow,
} from '../coa/subAccounts';
import {
  LOCATION_CHOICE_WORDS, LOCATION_CLASSES, LOCATION_CODES, LOCATION_NOT_TEXT_WORDS, LOCATION_WORDS, isLocationClass, locationClassOf, locationUnknownWords, readLocationClass,
} from '../operations/locationClass';
import { placeParts } from '../operations/stay';
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
