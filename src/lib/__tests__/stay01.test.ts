/**
 * STAY-01 (2026-10-12) — THE STAY: where the user is from a first day to a last
 * day; the day card counts it ("DAY 3 OF 14") and names the place.
 *
 * The rules (src/lib/operations/stay.ts) are pure and DRIVEN over cases; the
 * writer is driven over a stubbed fetch; the migration, the schema, the routes,
 * the stay bar and the plate are anchored to their source with comments
 * stripped (TEST-TRUTH-01, through code() — the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  NO_STAY_WORDS, OVERLAP_TAG, PLACE_MAX, RACE_WORDS, STAY_LOADING_WORDS, STAY_NOT_READ_WORDS, asDate, coveringStay, deleteStayQuestion, endsOnFor, meeting,
  otherStaysWords, overlapWords, overlaps, stayAtWords, stayDay, stayDayWords, stayInput, stayLength, stayLengthWords, stayRowOf, type StayRow,
} from '../operations/stay';
import { staysFailedWords } from '@/components/workbench/operations/day/dayReads';
import { changeStay, createStay, removeStay } from '@/components/workbench/operations/stays/stayWrites';
import { NO_STAY_COVERS, stayLine } from '@/components/workbench/operations/stays/StayBar';

const RULES = 'src/lib/operations/stay.ts';
const ROUTE = 'src/app/api/operations/stays/route.ts';
const ROUTE_ID = 'src/app/api/operations/stays/[id]/route.ts';
const WRITES = 'src/components/workbench/operations/stays/stayWrites.ts';
const BAR = 'src/components/workbench/operations/stays/StayBar.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261012090000_stay_01_operations_stays';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';

const bkk: StayRow = { id: 'bkk', place: 'Bangkok', starts_on: '2026-10-01', ends_on: '2026-10-19' };
const cnx: StayRow = { id: 'cnx', place: 'Chiang Mai', starts_on: '2026-10-20', ends_on: '2026-11-02' };
const lax: StayRow = { id: 'lax', place: 'Los Angeles', starts_on: '2026-11-03', ends_on: '2027-02-02' };
const STAYS = [bkk, cnx, lax];

// ── T1 · THE INPUT RULE ──────────────────────────────────────────────────────

test('T1 stayInput: the place trimmed and its spaces collapsed, 1–80 characters; two real days; the last on or after the first — the first bad field named, nothing filled in', () => {
  assert.deepEqual(stayInput({ place: '  Chiang   Mai ', starts_on: '2026-10-20', ends_on: '2026-11-02' }), { ok: true, value: { place: 'Chiang Mai', startsOn: '2026-10-20', endsOn: '2026-11-02' } });
  assert.deepEqual(stayInput({ place: 'Pai', starts_on: '2026-10-25', ends_on: '2026-10-25' }), { ok: true, value: { place: 'Pai', startsOn: '2026-10-25', endsOn: '2026-10-25' } }, 'a one-day stay');
  for (const [body, field, words] of [
    [null, 'place', 'the body must be an object'],
    [[], 'place', 'the body must be an object'],
    [{ starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'required (a string'],
    [{ place: 7, starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'required (a string'],
    [{ place: '   ', starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'a blank is no place'],
    [{ place: 'x'.repeat(81), starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'at most 80 characters (81 given)'],
    [{ place: 'Pai', starts_on: '2026-02-30', ends_on: '2026-11-02' }, 'starts_on', `starts_on "2026-02-30" is not a 'YYYY-MM-DD' day`],
    [{ place: 'Pai', starts_on: '2026-10-20', ends_on: 'next week' }, 'ends_on', `ends_on "next week" is not a 'YYYY-MM-DD' day`],
    [{ place: 'Pai', starts_on: '2026-10-20', ends_on: '2026-10-19' }, 'ends_on', 'ends_on 2026-10-19 is before starts_on 2026-10-20'],
    [{ place: 'Pai', starts_on: 20261020, ends_on: '2026-11-02' }, 'starts_on', 'is not a'],
    [{ place: 'Pai\u0000', starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'control characters are not a place'],
    [{ place: 'a\u0001b', starts_on: '2026-10-20', ends_on: '2026-11-02' }, 'place', 'control characters'],
  ] as const) {
    const r = stayInput(body);
    assert.ok(!r.ok, JSON.stringify(body));
    assert.equal(r.field, field, JSON.stringify(body));
    assert.ok(r.message.includes(words), `${JSON.stringify(body)} → ${r.message}`);
  }
  assert.equal(PLACE_MAX, 80);
  assert.ok(stayInput({ place: 'x'.repeat(80), starts_on: '2026-10-20', ends_on: '2026-11-02' }).ok, '80 is allowed');
});

// ── T2 · SPANS ───────────────────────────────────────────────────────────────

test('T2 overlaps is inclusive at both ends; meeting names the stays a span meets, except the one being edited; coveringStay finds at most one', () => {
  const span = (startsOn: string, endsOn: string) => ({ startsOn, endsOn });
  assert.equal(overlaps(span('2026-10-01', '2026-10-19'), span('2026-10-20', '2026-11-02')), false, 'adjacent days do not meet');
  assert.equal(overlaps(span('2026-10-01', '2026-10-20'), span('2026-10-20', '2026-11-02')), true, 'a shared day meets');
  assert.equal(overlaps(span('2026-10-25', '2026-10-25'), span('2026-10-20', '2026-11-02')), true, 'inside');
  assert.equal(overlaps(span('2026-10-20', '2026-11-02'), span('2026-10-25', '2026-10-25')), true, 'around');
  assert.equal(overlaps(span('2026-11-02', '2026-11-09'), span('2026-10-20', '2026-11-02')), true, 'touching the last day');
  assert.deepEqual(meeting(STAYS, span('2026-10-15', '2026-10-21')).map((s) => s.id), ['bkk', 'cnx']);
  assert.deepEqual(meeting(STAYS, span('2026-10-15', '2026-10-21'), 'bkk').map((s) => s.id), ['cnx'], 'the row being edited is not its own neighbour');
  assert.deepEqual(meeting(STAYS, span('2027-02-03', '2027-02-10')), []);
  assert.equal(coveringStay(STAYS, '2026-10-22')?.id, 'cnx');
  assert.equal(coveringStay(STAYS, '2026-10-20')?.id, 'cnx', 'the first day');
  assert.equal(coveringStay(STAYS, '2026-11-02')?.id, 'cnx', 'the last day');
  assert.equal(coveringStay(STAYS, '2027-02-03'), null);
  assert.equal(coveringStay([], '2026-10-22'), null);
  assert.throws(() => coveringStay([cnx, { ...cnx, id: 'dup' }], '2026-10-22'), /2 stays cover 2026-10-22 — the database holds one/, 'two covering stays is the database’s error, never a pick');
});

test('T2 stayDay and stayLength: 1 on the first day, the length on the last; null outside; a one-day stay is 1 of 1', () => {
  const c = { startsOn: cnx.starts_on, endsOn: cnx.ends_on };
  assert.deepEqual(stayDay(c, '2026-10-20'), { n: 1, of: 14 });
  assert.deepEqual(stayDay(c, '2026-10-22'), { n: 3, of: 14 });
  assert.deepEqual(stayDay(c, '2026-11-02'), { n: 14, of: 14 });
  assert.equal(stayDay(c, '2026-11-03'), null);
  assert.equal(stayDay(c, '2026-10-19'), null);
  assert.deepEqual(stayDay({ startsOn: '2026-10-25', endsOn: '2026-10-25' }, '2026-10-25'), { n: 1, of: 1 });
  assert.equal(stayLength({ startsOn: lax.starts_on, endsOn: lax.ends_on }), 92);
  assert.throws(() => stayLength({ startsOn: '2026-10-20', endsOn: '2026-10-19' }), /ends before it starts/, 'never a negative count');
  assert.equal(stayInput({ place: 'a\tb', starts_on: '2026-10-20', ends_on: '2026-11-02' }).ok, true, 'a tab is whitespace — collapsed to a space, not refused');
  assert.deepEqual(stayDay({ startsOn: '2026-03-07', endsOn: '2026-03-09' }, '2026-03-09'), { n: 3, of: 3 }, 'across a DST change in any zone — days are days');
});

// ── T3 · LENGTHS ─────────────────────────────────────────────────────────────

test('T3 endsOnFor: a week is 7 days; a month ends the day before the same date next month, or on that month’s last day; three months likewise; N days counts the first', () => {
  assert.equal(endsOnFor('2026-10-20', 'week'), '2026-10-26');
  assert.equal(endsOnFor('2026-10-20', 'month'), '2026-11-19');
  assert.equal(endsOnFor('2026-10-01', 'month'), '2026-10-31');
  assert.equal(endsOnFor('2026-01-31', 'month'), '2026-02-28', 'no Feb 31: the month’s last day');
  assert.equal(endsOnFor('2026-01-30', 'month'), '2026-02-28');
  assert.equal(endsOnFor('2028-01-29', 'month'), '2028-02-28', 'the day before Feb 29 in a leap year');
  assert.equal(endsOnFor('2026-01-29', 'month'), '2026-02-28', 'no Feb 29: the month’s last day');
  assert.equal(endsOnFor('2026-12-15', 'month'), '2027-01-14', 'across the year');
  assert.equal(endsOnFor('2026-11-03', 'quarter'), '2027-02-02');
  assert.equal(endsOnFor('2026-11-30', 'quarter'), '2027-02-28');
  assert.equal(endsOnFor('2026-12-31', 'quarter'), '2027-03-30');
  assert.equal(endsOnFor('2026-10-20', { days: 14 }), '2026-11-02');
  assert.equal(endsOnFor('2026-10-20', { days: 1 }), '2026-10-20');
  assert.throws(() => endsOnFor('2026-10-20', { days: 0 }), /at least 1 day/);
  assert.throws(() => endsOnFor('2026-10-20', { days: 2.5 }), /at least 1 day/);
  // A first day that is not a day is refused by name — a cleared date box ('') or a loose '2026-2-3' never rolls over into a date.
  assert.throws(() => endsOnFor('', 'month'), /the first day "" is not a 'YYYY-MM-DD' day/);
  assert.throws(() => endsOnFor('2026-2-3', 'week'), /is not a 'YYYY-MM-DD' day/);
  assert.throws(() => endsOnFor('2026-02-30', 'month'), /is not a 'YYYY-MM-DD' day/);
  // Years 0001–0099 are years, not 1901–1999 (Date.UTC would remap them).
  assert.equal(endsOnFor('0099-01-31', 'month'), '0099-02-28');
  assert.equal(endsOnFor('0001-01-31', 'quarter'), '0001-04-30');
  assert.equal(stayLength({ startsOn: '2026-10-20', endsOn: endsOnFor('2026-10-20', 'week') }), 7);
});

// ── T4 · WORDS, ROWS ─────────────────────────────────────────────────────────

test('T4 the words, exact; a row’s days read as days; the rules read every day by its UTC parts', () => {
  assert.equal(NO_STAY_WORDS, 'NO STAY');
  assert.equal(STAY_NOT_READ_WORDS, 'STAY NOT READ');
  assert.equal(STAY_LOADING_WORDS, 'loading the stay…');
  assert.equal(OVERLAP_TAG, 'STAY_OVERLAP');
  assert.equal(stayAtWords(3, 14), 'day 3 of 14');
  assert.equal(otherStaysWords(false, 1), 'show 1 other stay');
  assert.equal(otherStaysWords(true, 2), 'hide 2 other stays');
  assert.equal(RACE_WORDS('2026-10-25', '2026-10-25'), '2026-10-25 to 2026-10-25 meets another stay (written moments ago)');
  assert.equal(deleteStayQuestion(cnx), 'Delete the stay "Chiang Mai" (2026-10-20 to 2026-11-02)? The audit log keeps it; the card forgets it.');
  assert.equal(staysFailedWords('x'), 'The stay could not be read — x');
  assert.equal(stayDayWords(3, 14), 'DAY 3 OF 14');
  assert.equal(stayLengthWords(1), '1 day');
  assert.equal(stayLengthWords(14), '14 days');
  assert.equal(overlapWords({ startsOn: '2026-10-25', endsOn: '2026-10-25' }, cnx), '2026-10-25 to 2026-10-25 meets the stay "Chiang Mai" (2026-10-20 to 2026-11-02)');
  assert.equal(stayLine(cnx), 'Chiang Mai · 2026-10-20 → 2026-11-02 · 14 days');
  assert.equal(NO_STAY_COVERS('2026-10-13'), 'No stay covers 2026-10-13');
  assert.deepEqual(stayRowOf({ id: 'x', place: 'Pai', starts_on: new Date('2026-10-25T00:00:00.000Z'), ends_on: new Date('2026-10-26T00:00:00.000Z') }), { id: 'x', place: 'Pai', starts_on: '2026-10-25', ends_on: '2026-10-26' });
  assert.equal(asDate('2026-10-25').toISOString(), '2026-10-25T00:00:00.000Z');
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|\.get(Day|Month|Date|FullYear|Hours)\(|new Date\(\s*\w+\s*,/, 'pure, and never the process’s zone');
});

// ── T5 · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('T5 the migration: the table with its two CHECKs, the trigger that locks the user’s row before it looks, the two ADD VALUEs — and it is the newest', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE TABLE "operations_stays" \(/);
  assert.match(sql, /"place"\s+VARCHAR\(80\)\s+NOT NULL/);
  assert.match(sql, /"starts_on"\s+DATE\s+NOT NULL/);
  assert.match(sql, /"ends_on"\s+DATE\s+NOT NULL/);
  assert.match(sql, /CONSTRAINT "operations_stays_place_not_blank" CHECK \(length\(btrim\("place"\)\) > 0\)/);
  assert.match(sql, /CONSTRAINT "operations_stays_days_ordered" CHECK \("ends_on" >= "starts_on"\)/);
  assert.match(sql, /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  assert.match(sql, /CREATE INDEX "operations_stays_user_id_starts_on_idx" ON "operations_stays"\("user_id", "starts_on"\)/);
  // The trigger: the user's row locked FOR NO KEY UPDATE (never FOR UPDATE), then any stay sharing a day, then the tagged refusal.
  assert.match(sql, /PERFORM 1 FROM "users" WHERE "id" = NEW\."user_id" FOR NO KEY UPDATE;/);
  assert.doesNotMatch(sql, /FOR UPDATE\b/);
  assert.match(sql, /AND "id" <> NEW\."id"\s+AND "starts_on" <= NEW\."ends_on"\s+AND "ends_on" >= NEW\."starts_on"/);
  assert.match(sql, /RAISE EXCEPTION 'STAY_OVERLAP: % to % meets the stay "%" \(% to %, id %\)'/);
  assert.match(sql, /CREATE TRIGGER "operations_stays_no_overlap"\s+BEFORE INSERT OR UPDATE OF "starts_on", "ends_on", "user_id" ON "operations_stays"\s+FOR EACH ROW EXECUTE FUNCTION operations_stays_no_overlap\(\);/);
  assert.match(sql, /ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stay_set';\s*ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stay_deleted';/);
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no row is written or moved');
  assert.doesNotMatch(sql, /DROP /);
  assert.match(comments(MIGRATION), /AUTHORED here, applied at deploy/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // STOP-01 (2026-10-12): the stop records migration is newer; ROLE-01 (2026-10-13): the role migration newer still; JOURNAL-01 (2026-10-13) followed. The pin moved three times; the order holds.
  // JOURNAL-02 (2026-10-13): the simple journal's migration is newer still — every index moved one; the order holds.
  // TASKS-ONE-02 (2026-10-14): the completion audit types' migration is newer still — every index moved one; the order holds.
  // RETRO-01 (Alex, 2026-10-16): the stop-moved audit type's migration is newer still — every index moved one; the order holds.
  assert.equal(dirs[dirs.length - 7], MIGRATION_DIR, 'the migration six before the newest (STOP-01, ROLE-01, JOURNAL-01, JOURNAL-02, TASKS-ONE-02, then RETRO-01 followed)');
  assert.equal(dirs[dirs.length - 6], '20261012140000_stop_01_operations_stop_records');
  assert.equal(dirs[dirs.length - 5], '20261013030000_role_01_routine_role');
  assert.equal(dirs[dirs.length - 4], '20261013120000_journal_01_day_journals');
  assert.equal(dirs[dirs.length - 3], '20261013200000_journal_02_the_simple_journal');
  assert.equal(dirs[dirs.length - 2], '20261014090000_tasks_one_02_completion_audit_types');
  assert.equal(dirs[dirs.length - 1], '20261016120000_retro_01_stop_moved_audit_type', 'the newest migration');
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20260930210000');
});

test('T5 the schema: the model column for column with the SQL; the user’s relation; the two enum values, last, known to the client, listed by the audit-log route', () => {
  const schema = code(SCHEMA);
  const model = /model operations_stays \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(model !== null);
  const m = model[1];
  assert.match(m, /id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid/);
  assert.match(m, /user_id\s+String\n/);
  assert.match(m, /place\s+String\s+@db\.VarChar\(80\)/);
  assert.match(m, /starts_on\s+DateTime @db\.Date/);
  assert.match(m, /ends_on\s+DateTime @db\.Date/);
  assert.match(m, /user users @relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade\)/);
  assert.match(m, /@@index\(\[user_id, starts_on\]\)/);
  assert.match(m, /@@map\("operations_stays"\)/);
  assert.match(schema, /operations_stays\s+operations_stays\[\]/, 'the user’s relation');
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  // STOP-01 (2026-10-12): two values follow them in ALTER TYPE order; JOURNAL-01 (2026-10-13): two more — the pin moved from "last two" to "the two before the last four".
  // TASKS-ONE-02 (2026-10-14): two more follow — "the two before the last six".
  // RETRO-01 (2026-10-16): one more follows — "the two before the last seven".
  assert.deepEqual(values.slice(-9, -7), ['operations_stay_set', 'operations_stay_deleted']);
  assert.equal(AuditActionType.operations_stay_set, 'operations_stay_set', 'prisma generate ran');
  assert.equal(AuditActionType.operations_stay_deleted, 'operations_stay_deleted');
  assert.match(code(AUDIT_LOG), /'operations_routine_completion_note_edited',\s*'operations_stay_set',\s*'operations_stay_deleted',\s*'operations_stop_set',\s*'operations_stop_cleared',\s*'operations_journal_set',\s*'operations_journal_cleared',\s*'operations_routine_uncompleted',\s*'operations_routine_completion_updated',\s*'operations_stop_moved',\s*\],/);
});

// ── T6 · THE ROUTES ──────────────────────────────────────────────────────────

test('T6 the routes: the caller proven, then the row, then the input, then the overlap by name, then the write, then the audit — and the trigger’s tag read back as 409', () => {
  const r = code(ROUTE);
  for (const method of ['GET', 'POST']) assert.match(r, new RegExp(`export async function ${method}\\(`));
  assert.doesNotMatch(r, /export (const|function) (?!GET|POST)/, 'a route file exports its handlers only');
  // GET: the cookie, the user, the day by name, the caller's rows, the covering stay through the one rule.
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function POST('));
  assert.ok(get.indexOf('getVerifiedEmail()') < get.indexOf('prisma.users.findFirst('), 'the cookie first');
  assert.match(get, /if \(day !== null && !isIsoDay\(day\)\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'day', message: `day \$\{JSON\.stringify\(day\)\} is not a 'YYYY-MM-DD' day` \}, \{ status: 400 \}\);/, 'a day that is not a day is a 400 naming the field, in the field’s own word');
  assert.match(get, /prisma\.operations_stays\.findMany\(\{ where: \{ user_id: user\.id \}, orderBy: \{ starts_on: 'asc' \} \}\)/);
  assert.match(get, /covering: day === null \? null : coveringStay\(stays, day\)/);
  // POST, in order.
  const post = r.slice(r.indexOf('export async function POST('));
  const order = ['getVerifiedEmail()', 'prisma.users.findFirst(', 'stayInput(await request.json())', "status: 400", 'prisma.operations_stays.findMany({ where: { user_id: user.id } })', 'meeting(others, { startsOn, endsOn })', 'status: 409', 'prisma.operations_stays.create(', 'error.message.includes(OVERLAP_TAG)', "type: 'operations_stay_set'", 'status: 201'];
  let at = -1;
  for (const step of order) { const i = post.indexOf(step); assert.ok(i > at, `POST: ${step} comes after the step before it`); at = i; }
  assert.match(post, /data: \{ user_id: user\.id, place, starts_on: asDate\(startsOn\), ends_on: asDate\(endsOn\) \}/, 'the write is the rule’s answer, days as dates');
  assert.match(post, /const met = meeting\(others, \{ startsOn, endsOn \}\);\n\s*if \(met\.length > 0\) return NextResponse\.json\(\{ error: 'Conflict', message: overlapWords\(\{ startsOn, endsOn \}, met\[0\]\) \}, \{ status: 409 \}\);/, 'one meeting stay is enough to refuse');
  assert.match(post, /message: RACE_WORDS\(startsOn, endsOn\) \}, \{ status: 409 \}/, 'the race’s words are the rules’');
  assert.match(post, /payload: \{ before: null, after: created \}/);
  // [id]: the row by { id, user_id }; unchanged writes nothing; the edited row is not its own neighbour; DELETE audits before.
  const i = code(ROUTE_ID);
  for (const method of ['PATCH', 'DELETE']) assert.match(i, new RegExp(`export async function ${method}\\(`));
  assert.doesNotMatch(i, /export (const|function) (?!PATCH|DELETE)/);
  assert.equal((i.match(/prisma\.operations_stays\.findFirst\(\{ where: \{ id, user_id: user\.id \} \}\)/g) ?? []).length, 2, 'the caller’s own row, proven in each handler (the ownership law reads the handler itself)');
  assert.equal((i.match(/if \(!isValidUuid\(id\)\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/g) ?? []).length, 2, 'an id that is no UUID is the same 404, before any query');
  assert.match(i, /const met = meeting\(others, \{ startsOn, endsOn \}, row\.id\);\n\s*if \(met\.length > 0\) return/);
  assert.match(i, /if \(place === before\.place && startsOn === before\.starts_on && endsOn === before\.ends_on\) \{\n\s*return NextResponse\.json\(\{ stay: before, changed: false \}\);/);
  assert.match(i, /meeting\(others, \{ startsOn, endsOn \}, row\.id\)/);
  const patch = i.slice(i.indexOf('export async function PATCH('), i.indexOf('export async function DELETE('));
  const patchOrder = ['getVerifiedEmail()', 'prisma.users.findFirst(', 'prisma.operations_stays.findFirst({ where: { id, user_id: user.id } })', 'stayInput(await request.json())', 'changed: false', 'meeting(others', 'status: 409', 'prisma.operations_stays.update(', 'error.message.includes(OVERLAP_TAG)', "type: 'operations_stay_set'", 'payload: { before, after }'];
  at = -1;
  for (const step of patchOrder) { const k = patch.indexOf(step); assert.ok(k > at, `PATCH: ${step} comes after the step before it`); at = k; }
  const del = i.slice(i.indexOf('export async function DELETE('));
  assert.ok(del.indexOf('prisma.operations_stays.delete({ where: { id: row.id } })') < del.indexOf("type: 'operations_stay_deleted'"), 'delete, then audit');
  assert.match(del, /payload: \{ before, after: null \}/);
  for (const f of [ROUTE, ROUTE_ID]) {
    const body = code(f);
    assert.equal((body.match(/getVerifiedEmail\(\)/g) ?? []).length, (body.match(/export async function/g) ?? []).length, `${f}: every handler proves the caller`);
    assert.doesNotMatch(body, /\$queryRaw|\$executeRaw/, `${f}: no raw SQL`);
    assert.match(body, /failClosedResponse\(/);
  }
});

// ── T7 · THE WRITER AND THE BAR ──────────────────────────────────────────────

test('T7 the one writer: POST / PATCH / DELETE to the stays routes, the answer read as the week’s writer reads its own', async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify({ stay: { id: 's1' } }), { status: 201, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  try {
    assert.deepEqual(await createStay({ place: 'Chiang Mai', starts_on: '2026-10-20', ends_on: '2026-11-02' }), { ok: true });
    assert.deepEqual(await changeStay('s1', { place: 'Chiang Mai', starts_on: '2026-10-20', ends_on: '2026-11-03' }), { ok: true });
    answer = () => new Response(JSON.stringify({ error: 'Conflict', message: '2026-10-25 to 2026-10-25 meets the stay "Chiang Mai" (2026-10-20 to 2026-11-02)' }), { status: 409, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await createStay({ place: 'Pai', starts_on: '2026-10-25', ends_on: '2026-10-25' }), { ok: false, message: '2026-10-25 to 2026-10-25 meets the stay "Chiang Mai" (2026-10-20 to 2026-11-02)' });
    answer = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await removeStay('gone'), { ok: false, message: 'Not found' });
    answer = () => new Response(JSON.stringify({}), { status: 500, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await removeStay('s1'), { ok: false, message: 'failed to delete the stay' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method]), [
    ['/api/operations/stays', 'POST'], ['/api/operations/stays/s1', 'PATCH'], ['/api/operations/stays', 'POST'], ['/api/operations/stays/gone', 'DELETE'], ['/api/operations/stays/s1', 'DELETE'],
  ]);
  assert.equal(sent[0].init?.body, JSON.stringify({ place: 'Chiang Mai', starts_on: '2026-10-20', ends_on: '2026-11-02' }));
  assert.deepEqual(sent[0].init?.headers, { 'Content-Type': 'application/json' });
  // The bar writes through the writer only; the day folder still fetches nothing of its own; the stays read goes through the one reader.
  const bar = code(BAR);
  assert.match(bar, /import \{ changeStay, createStay, removeStay \} from '\.\/stayWrites';/);
  assert.doesNotMatch(bar, /\bfetch\s*\(|\/api\//, 'the bar names no route and fetches nothing of its own');
  assert.doesNotMatch(bar, /localStorage|sessionStorage|document\.cookie/, 'nothing stored');
  assert.match(bar, /setLength\('week'\)|setLength\('month'\)|setLength\('quarter'\)|setLength\(\{ days: Number\(draft\.days\) \}\)/);
  for (const preset of ["'week'", "'month'", "'quarter'", '{ days: Number(draft.days) }']) assert.ok(bar.includes(`setLength(${preset})`), `the ${preset} length`);
  assert.match(bar, /endsOnFor\(draft\.startsOn, preset\)/, 'the last day from the one rule');
  assert.equal((bar.match(/if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}/g) ?? []).length, 2, 'a refusal is the route’s own words — on save AND on delete');
  assert.match(bar, /const answer = draft\.id === null \? await createStay\(body\) : await changeStay\(draft\.id, body\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n\s*setDraft\(null\);\n\s*onChanged\(\);/, 'save: the writer, the refusal, then the form closes and the caller reads again');
  assert.match(bar, /const answer = await removeStay\(s\.id\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n[\s\S]*?if \(draft !== null && draft\.id === s\.id\) setDraft\(null\);\n\s*onChanged\(\);/, 'delete: the writer, the refusal, the dead draft closed, the caller reads again');
  assert.match(bar, /if \(busy \|\| !window\.confirm\(deleteStayQuestion\(s\)\)\) return;/, 'a delete asks first, in the rules’ words');
  assert.match(bar, /if \(draft === null \|\| busy\) return;/, 'no double submit');
  assert.match(bar, /const hasFirstDay = draft !== null && isIsoDay\(draft\.startsOn\);/, 'the length buttons need a real first day');
  for (const preset of ["'week'", "'month'", "'quarter'"]) assert.ok(bar.includes(`disabled={!hasFirstDay} onClick={() => setLength(${preset})}`), `${preset} waits for a first day`);
  assert.match(bar, /throw new Error\(`StayBar: the stay \$\{covering\.starts_on\}\.\.\$\{covering\.ends_on\} does not cover \$\{day\}/, 'a covering stay that does not cover the day is the route’s error — no second branch draws it');
  assert.equal((code(WRITES).match(/\bfetch\s*\(/g) ?? []).length, 3, 'three requests, in the one writer');
  assert.match(code(READS), /export async function readStays\(day: string\)/);
  assert.doesNotMatch(code(CARD), /\bfetch\s*\(|stayWrites|method:/, 'the card fetches and writes nothing of its own');
});
