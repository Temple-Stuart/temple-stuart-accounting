/**
 * LINK-LAW-01 (Alex, 2026-10-28) — "PAID" STAYS A HUMAN ACT, AND A LINK MEANS WHAT IT SAYS.
 *
 * Ruling A: ONE WRITER — planned_item_links is created and deleted only by the links route and its instant moved only
 * by the routine rekey; the tool-registry law scans all of src/ (the budget-link law's scope). Ruling B: A LINK IS TO A
 * REAL OCCURRENCE — the links POST refuses an instant the routine's rule does not produce in its zone, by name, through
 * the budget's builder. Ruling C: A REVERSED POSTING PAYS NOTHING — the POST refuses one by name; every MATCH read
 * (Expenses, the ledger, THE WORK, the links GET's lists) leaves it out and says how many. Ruling D: NO ORPHANS — the
 * routine DELETE and the line DELETE refuse with 409 while links are held. Ruling E: no schema, no migration, no route.
 *
 * The rules are driven over fixtures; the routes, the screens and the law are pinned to their source with comments
 * stripped (TEST-TRUTH-01). The law's one-writer clause was also proved failing on a temp copy with a stray write
 * (reported in the PR, not committed).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { OCCURRENCE_ROUTINE_SELECT, notAnOccurrenceWords, occurrenceCheck, type OccurrenceRoutine } from '../operations/linkOccurrence';
import {
  LINKED_POSTING_SELECT, PAYING_POSTING_WHERE, POSTING_LINES_SELECT, POSTING_STATE_SELECT, REVERSED_POSTING_WHERE, isReversedPosting, reversedCandidatesWords,
  reversedLinkedWords, reversedRefusalWords,
} from '../calendar/postingAmount';
import { ledgerOf, linkInputOf, matchCellWords, matchOf, notesCount, readableMatchCents, type LedgerInput, type LedgerLinkInput, type LedgerRecordInput } from '../operations/ledger';
import { routineMonthOf, type RoutineMonthRoutine } from '../operations/routineMonth';
import { taskMatchesOf, type TaskLinkRow } from '../operations/taskMatch';
import { linkedSourceLine, sumLinks } from '../calendar/links';
import { lineHoldsLinksWords, routineHoldsLinksWords, routineLinksWhere } from '../operations/linkHold';
import { tasksReversedOf, type TaskRow } from '../operations/work';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { StopRecordRow } from '../operations/stopRecord';

const LINK_ROUTE = 'src/app/api/calendar/links/route.ts';
const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const LINE_ROUTE = 'src/app/api/operations/routines/steps/[stepId]/route.ts';
const LEAF = 'src/lib/operations/linkOccurrence.ts';
const HOLD = 'src/lib/operations/linkHold.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const BKK = 'Asia/Bangkok';
const LA = 'America/Los_Angeles';

const bodyOf = (src: string, verb: string): string => {
  const at = src.indexOf(`export async function ${verb}(`);
  assert.notEqual(at, -1, `${verb} exists`);
  const next = src.indexOf('export async function', at + 1);
  return next < 0 ? src.slice(at) : src.slice(at, next);
};
/** Each step found AFTER the one before it — a step missing or out of order fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const step of steps) {
    const i = body.indexOf(step, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(step)} comes after the step before it`);
    at = i + step.length;
  }
}

// ── RULING A · ONE WRITER ───────────────────────────────────────────────────

test('A one writer: the law scans all of src/ for every write verb, nested writes and raw SQL; the links route creates and deletes, the rekey alone moves an instant; today nothing else writes', () => {
  const law = code(LAW);
  assert.match(law, /for \(const \{ file, src \} of srcFiles\) \{\n\s*for \(const m of src\.matchAll\(\/planned_item_links\\s\*\\\.\\s\*\(create\|createMany\|createManyAndReturn\|update\|updateMany\|updateManyAndReturn\|upsert\|delete\|deleteMany\)\\s\*\\\(\/g\)\) \{/, 'every verb, over srcFiles — the budget-link law’s scope');
  assert.match(law, /if \(file === LINK_ROUTE && LINK_CREATE_DELETE\.has\(verb\)\) continue;\n\s*if \(file === ROUTINE_ID_ROUTE && LINK_MOVE\.has\(verb\)\) continue;\n\s*linkFail\(`\$\{file\} calls planned_item_links\.\$\{verb\}/, 'two allowed sites, each for its own verbs; every other site named');
  assert.match(law, /const LINK_CREATE_DELETE = new Set\(\['create', 'createMany', 'createManyAndReturn', 'upsert', 'delete', 'deleteMany'\]\);/);
  assert.match(law, /const LINK_MOVE = new Set\(\['update', 'updateMany', 'updateManyAndReturn'\]\);/);
  assert.match(law, /planned_item_links\\s\*:\\s\*\\\{\\s\*\(create\|createMany\|connectOrCreate\|upsert\|update\|updateMany\|delete\|deleteMany\|set\|connect\|disconnect\)\\b/, 'a nested write is a write');
  assert.match(law, /\(INSERT\\s\+INTO\|UPDATE\|DELETE\\s\+FROM\|TRUNCATE\(\\s\+TABLE\)\?\)\\s\+"\?planned_item_links\/i/, 'raw SQL naming the table');
  // The sites today, as the law sees them (comments stripped): one create and one deleteMany in the route, one instant move in the rekey.
  const route = code(LINK_ROUTE);
  assert.equal((route.match(/planned_item_links\.create\(/g) ?? []).length, 1);
  assert.equal((route.match(/planned_item_links\.deleteMany\(/g) ?? []).length, 1);
  assert.doesNotMatch(route, /planned_item_links\.(update|updateMany|upsert|createMany|delete)\(/, 'the route never moves an instant');
  const rekey = code(ROUTINE_ROUTE);
  assert.equal((rekey.match(/planned_item_links\.update\(\{ where: \{ id: l\.id \}, data: \{ target_instant: to \} \}\)/g) ?? []).length, 1, 'the rekey moves the instant and nothing else');
  assert.doesNotMatch(rekey, /planned_item_links\.(create|createMany|upsert|delete|deleteMany|updateMany)\(/);
});

// ── RULING B · A LINK IS TO A REAL OCCURRENCE ──────────────────────────────

const routineOf = (o: Partial<OccurrenceRoutine> = {}): OccurrenceRoutine => ({ name: 'Coffee', timezone: BKK, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', start_date: null, end_date: null, ...o });

test('B on-rule accepted, off-rule refused by name — "<instant> is not an occurrence of <routine>", the instant read in the routine’s zone', () => {
  const coffee = routineOf();
  assert.deepEqual(occurrenceCheck(coffee, new Date('2026-10-14T00:00:00.000Z')), { ok: true }, '07:00 Bangkok on Oct 14 is 00:00Z');
  const off = occurrenceCheck(coffee, new Date('2026-10-14T01:00:00.000Z'));
  assert.deepEqual(off, { ok: false, message: '2026-10-14T01:00:00.000Z (2026-10-14 08:00 Asia/Bangkok) is not an occurrence of "Coffee"' });
  assert.equal(notAnOccurrenceWords(new Date('2026-10-14T01:00:00.000Z'), coffee, { date: '2026-10-14', time: '08:00' }), '2026-10-14T01:00:00.000Z (2026-10-14 08:00 Asia/Bangkok) is not an occurrence of "Coffee"');
  assert.equal(occurrenceCheck(coffee, new Date('2026-10-14T00:00:00.001Z')).ok, false, 'to the millisecond — the key is the instant');
  // Every occurrence of a day, not only the first: a rule that fires twice a day accepts both.
  const twice = routineOf({ name: 'Twice', schedule_rrule: 'FREQ=DAILY;BYHOUR=7,19;BYMINUTE=0;BYSECOND=0' });
  assert.equal(occurrenceCheck(twice, new Date('2026-10-14T00:00:00.000Z')).ok, true);
  assert.equal(occurrenceCheck(twice, new Date('2026-10-14T12:00:00.000Z')).ok, true, '19:00 Bangkok');
  // A weekly rule: Wednesday is on it, Thursday is not.
  const weekly = routineOf({ name: 'Weekly', schedule_rrule: 'FREQ=WEEKLY;BYDAY=WE;BYHOUR=7;BYMINUTE=0;BYSECOND=0' });
  assert.equal(occurrenceCheck(weekly, new Date('2026-10-14T00:00:00.000Z')).ok, true, 'Wed Oct 14');
  assert.match((occurrenceCheck(weekly, new Date('2026-10-15T00:00:00.000Z')) as { message: string }).message, / is not an occurrence of "Weekly"$/);
});

test('B the midnight-crossing zone: 23:30 Los Angeles is the next UTC day, and 00:15 Bangkok the previous one — the day is the routine’s zone’s, never UTC’s', () => {
  const late = routineOf({ name: 'Late snack', timezone: LA, schedule_rrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0' });
  assert.equal(occurrenceCheck(late, new Date('2026-10-15T06:30:00.000Z')).ok, true, '23:30 PDT on Oct 14 is 06:30Z on Oct 15');
  assert.equal(occurrenceCheck(late, new Date('2026-10-14T23:30:00.000Z')).ok, false, '23:30Z is 16:30 in Los Angeles');
  const early = routineOf({ name: 'Early', schedule_rrule: 'FREQ=WEEKLY;BYDAY=WE;BYHOUR=0;BYMINUTE=15;BYSECOND=0' });
  assert.equal(occurrenceCheck(early, new Date('2026-10-13T17:15:00.000Z')).ok, true, '00:15 Bangkok on Wed Oct 14 is 17:15Z on Tue Oct 13');
  assert.deepEqual(occurrenceCheck(early, new Date('2026-10-14T17:15:00.000Z')), { ok: false, message: '2026-10-14T17:15:00.000Z (2026-10-15 00:15 Asia/Bangkok) is not an occurrence of "Early"' }, 'Thursday in Bangkok');
  // Across a clock change: 07:00 Los Angeles before and after Nov 1 2026.
  const am = routineOf({ name: 'AM', timezone: LA });
  assert.equal(occurrenceCheck(am, new Date('2026-10-31T14:00:00.000Z')).ok, true, 'PDT');
  assert.equal(occurrenceCheck(am, new Date('2026-11-02T15:00:00.000Z')).ok, true, 'PST');
  assert.equal(occurrenceCheck(am, new Date('2026-11-02T14:00:00.000Z')).ok, false, 'the summer offset after the change');
});

test('B the dates bound it; a zone Intl cannot read and a rule that does not parse are refused by name, never read as UTC', () => {
  const bounded = routineOf({ start_date: new Date('2026-10-10T00:00:00.000Z'), end_date: new Date('2026-10-20T00:00:00.000Z') });
  assert.equal(occurrenceCheck(bounded, new Date('2026-10-10T00:00:00.000Z')).ok, true, 'the start day');
  assert.equal(occurrenceCheck(bounded, new Date('2026-10-20T00:00:00.000Z')).ok, true, 'the end day');
  assert.equal(occurrenceCheck(bounded, new Date('2026-10-09T00:00:00.000Z')).ok, false, 'before the start');
  assert.equal(occurrenceCheck(bounded, new Date('2026-10-21T00:00:00.000Z')).ok, false, 'after the end');
  const once = routineOf({ name: 'Dentist', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: new Date('2026-10-20T00:00:00.000Z'), end_date: new Date('2026-10-20T00:00:00.000Z') });
  assert.equal(occurrenceCheck(once, new Date('2026-10-20T07:00:00.000Z')).ok, true, 'a one-off: its one occurrence (anchored on its start, ONEOFF-01)');
  assert.equal(occurrenceCheck(once, new Date('2026-10-21T07:00:00.000Z')).ok, false);
  assert.match((occurrenceCheck(routineOf({ timezone: 'Nowhere/Zone' }), new Date('2026-10-14T00:00:00.000Z')) as { message: string }).message, /^2026-10-14T00:00:00\.000Z cannot be placed on a day of "Coffee": timezone not recognised — "Nowhere\/Zone": /);
  assert.match((occurrenceCheck(routineOf({ schedule_rrule: 'FREQ=NOPE' }), new Date('2026-10-14T00:00:00.000Z')) as { message: string }).message, /^2026-10-14T00:00:00\.000Z cannot be tested against "Coffee": schedule does not parse — "FREQ=NOPE": /);
});

test('B the POST: for a routine or a line, the routine read user-scoped and the instant tested BEFORE the posting is read or the link written; refused 400 by name; the leaf is the budget’s builder', () => {
  const post = bodyOf(code(LINK_ROUTE), 'POST');
  inOrder(post, [
    'ownsTarget(targetOwnerQuery(t.kind, t.id, user.id))',
    "if (t.kind === 'routine' || t.kind === 'routine_line') {",
    "prisma.operations_routines.findFirst({ where: { id: t.id, user_id: user.id }, select: OCCURRENCE_ROUTINE_SELECT })",
    "prisma.operations_routine_steps.findFirst({ where: { id: t.id, routine: { user_id: user.id } }, select: { routine: { select: OCCURRENCE_ROUTINE_SELECT } } })",
    "if (!routine) return NextResponse.json({ error: 'No such item' }, { status: 404 });",
    'const occurrence = occurrenceCheck(routine, t.instant);',
    'if (!occurrence.ok) return NextResponse.json({ error: occurrence.message }, { status: 400 });',
    'const entry = await prisma.journal_entries.findFirst({',
    'const link = await prisma.planned_item_links.create({',
  ], 'the POST');
  assert.deepEqual(OCCURRENCE_ROUTINE_SELECT, { name: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true });
  const leaf = code(LEAF);
  assert.match(leaf, /import \{ dayWindow \} from '@\/lib\/budget\/days';\nimport \{ expandBetween, scheduleAnchor \} from '@\/lib\/operations\/rruleHelpers';\nimport \{ instantToZoned \} from '@\/lib\/time';/);
  assert.match(leaf, /const \{ windowFrom, windowTo \} = dayWindow\(day, day\);/);
  assert.doesNotMatch(leaf, /@prisma\/client|\bfetch\b|new Date\(\)|Date\.now/, 'pure — no Prisma, no clock');
  assert.match(comments(LEAF), /LINK-LAW-01 \(Alex, 2026-10-28, ruling B\)/);
});

// ── RULING C · A REVERSED POSTING PAYS NOTHING ─────────────────────────────

const posted = { status: 'posted', is_reversal: false, reversed_by_entry_id: null };
const reversedOriginal = { status: 'reversed', is_reversal: false, reversed_by_entry_id: 'je-rev' };
const reversalEntry = { status: 'posted', is_reversal: true, reversed_by_entry_id: null };

test('C the rule: a reversal, or a reversed posting (any of the three columns), pays nothing; the select and the queries say the same', () => {
  assert.equal(isReversedPosting(posted), false);
  assert.equal(isReversedPosting(reversedOriginal), true, 'the product’s reversal marks the original reversed, with the entry that reversed it');
  assert.equal(isReversedPosting(reversalEntry), true, 'the reversal entry itself');
  assert.equal(isReversedPosting({ status: 'reversed', is_reversal: false, reversed_by_entry_id: null }), true, 'status alone');
  assert.equal(isReversedPosting({ status: 'posted', is_reversal: false, reversed_by_entry_id: 'x' }), true, 'reversed_by_entry_id alone');
  assert.deepEqual(POSTING_STATE_SELECT, { status: true, is_reversal: true, reversed_by_entry_id: true });
  assert.deepEqual(LINKED_POSTING_SELECT, { ...POSTING_LINES_SELECT, status: true, is_reversal: true, reversed_by_entry_id: true });
  assert.deepEqual(PAYING_POSTING_WHERE, { is_reversal: false, reversed_by_entry_id: null, status: { not: 'reversed' } });
  assert.deepEqual(REVERSED_POSTING_WHERE, { OR: [{ is_reversal: true }, { reversed_by_entry_id: { not: null } }, { status: 'reversed' }] });
  assert.equal(reversedLinkedWords(1), '1 linked posting was reversed — MATCH leaves it out', 'the ruling’s words');
  assert.equal(reversedLinkedWords(2), '2 linked postings were reversed — MATCH leaves them out');
  assert.equal(reversedCandidatesWords(1), '1 reversed posting in this window is not offered — a reversed posting pays nothing');
  const named = { id: 'je-9', description: 'GRAB*TRIP', date: new Date('2026-10-14T00:00:00.000Z') };
  assert.equal(reversedRefusalWords({ ...named, ...reversedOriginal }), '"GRAB*TRIP" (2026-10-14, je-9) has been reversed — it pays nothing, so it cannot be linked');
  assert.equal(reversedRefusalWords({ ...named, ...reversalEntry }), '"GRAB*TRIP" (2026-10-14, je-9) is a reversal entry — it pays nothing, so it cannot be linked');
});

test('C the POST refuses a reversal or a reversed posting by name, 409, before the cardinality check and the write', () => {
  const post = bodyOf(code(LINK_ROUTE), 'POST');
  inOrder(post, [
    'const entry = await prisma.journal_entries.findFirst({',
    'where: { id: body.journalEntryId, userId: user.id },',
    'select: { id: true, date: true, description: true, ...LINKED_POSTING_SELECT },',
    "if (!entry) return NextResponse.json({ error: 'No such posting' }, { status: 404 });",
    'if (isReversedPosting(entry)) return NextResponse.json({ error: reversedRefusalWords(entry) }, { status: 409 });',
    'const taken = await prisma.planned_item_links.findUnique(',
    'const link = await prisma.planned_item_links.create({',
  ], 'the POST');
});

test('C the match: matchOf leaves a reversed posting out and counts it; all reversed → blank, never 0', () => {
  assert.deepEqual(matchOf([{ amountCents: 2500, reversed: false }, { amountCents: 500, reversed: true }]), { cents: 2500, postings: 1, unreadable: 0, reversed: 1 });
  const allReversed = matchOf([{ amountCents: 500, reversed: true }]);
  assert.deepEqual(allReversed, { cents: null, postings: 0, unreadable: 0, reversed: 1 });
  assert.equal(readableMatchCents(allReversed), null);
  assert.equal(matchCellWords(allReversed), '—', 'MATCH blank');
  assert.deepEqual(matchOf([{ amountCents: null, reversed: true }]), { cents: null, postings: 0, unreadable: 0, reversed: 1 }, 'a reversed posting is reversed, not unreadable');
  const row = { target_kind: 'routine', target_id: 'r', target_instant: new Date('2026-10-13T05:30:00.000Z'), journal_entry_id: 'je', journal_entry: { ...reversedOriginal, ledger_entries: [{ entry_type: 'D', amount: BigInt(500) }] } };
  assert.deepEqual(linkInputOf(row), { kind: 'routine', targetId: 'r', instant: '2026-10-13T05:30:00.000Z', journalEntryId: 'je', amountCents: 500, reversed: true });
  assert.equal(linkInputOf({ ...row, journal_entry: { ...posted, ledger_entries: row.journal_entry.ledger_entries } }).reversed, false);
});

// Expenses: a daily $10 line, as_of the 10th; a paying link on the 2nd and a reversed one on the 3rd.
const plan = (o: Partial<RoutineMonthRoutine> & { id: string; name: string }): RoutineMonthRoutine => ({
  entityId: 'p', entityType: 'personal', timezone: BKK, scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null,
  budgetAmount: null, coaCode: null, steps: [], isActive: true, ...o,
});
const DAILY = plan({ id: 'daily', name: 'Daily', steps: [{ id: 's1', stepOrder: 1, budgetAmount: '10', coaCode: '6150' }] });
const monthLink = (o: Partial<LedgerLinkInput> & { journalEntryId: string; instant: string }): LedgerLinkInput => ({ kind: 'routine_line', targetId: 's1', amountCents: 1000, reversed: false, ...o });

test('C Expenses: the month leaves the reversed posting out of MATCH and says so ("1 linked posting was reversed"); only reversed → MATCH blank with the said line', () => {
  const mixed = routineMonthOf({ asOf: '2026-10-10', routines: [DAILY], records: [], vendors: [], links: [
    monthLink({ journalEntryId: 'je-paid', instant: '2026-10-02T00:00:00.000Z', amountCents: 950 }),
    monthLink({ journalEntryId: 'je-rev', instant: '2026-10-03T00:00:00.000Z', amountCents: 1050, reversed: true }),
  ] });
  assert.ok(mixed.ok);
  assert.equal(mixed.lines[0].match_cents, 950, 'the reversed 1050 is not summed');
  assert.equal(mixed.lines[0].match_links, 1);
  assert.deepEqual(mixed.said, ['1 linked posting was reversed — MATCH leaves it out']);
  const only = routineMonthOf({ asOf: '2026-10-10', routines: [DAILY], records: [], vendors: [], links: [monthLink({ journalEntryId: 'je-rev', instant: '2026-10-03T00:00:00.000Z', reversed: true })] });
  assert.ok(only.ok);
  assert.equal(only.lines[0].match_cents, null, 'MATCH blank — never 0');
  assert.deepEqual(only.said, ['1 linked posting was reversed — MATCH leaves it out']);
  // A reversed link outside [the 1st, as_of] is not placed, so not counted.
  const later = routineMonthOf({ asOf: '2026-10-10', routines: [DAILY], records: [], vendors: [], links: [monthLink({ journalEntryId: 'je-rev', instant: '2026-10-20T00:00:00.000Z', reversed: true })] });
  assert.ok(later.ok);
  assert.deepEqual(later.said, []);
});

// The ledger: a stepless client lunch with a record of $30 and two links, one reversed.
const CLIENT_13 = '2026-10-13T05:30:00.000Z';
const CLIENT: RoutinePlanInput = { id: 'client', name: 'Client lunch', entityId: 'B', entityType: 'sole_prop', timezone: BKK, scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', startDate: null, endDate: null, budgetAmount: 25, coaCode: '6100', steps: [] };
const clientRecord: StopRecordRow = { id: 'r-client-13', kind: 'routine', target_id: 'client', occurrence_at: CLIENT_13, outcome: 'done', done_at: CLIENT_13, actual_cents: 3000, rating: null, note: null, actual_minutes: null };
const RECORDS: LedgerRecordInput[] = [{ record: clientRecord, routineId: 'client', routineName: 'Client lunch', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: null }];
const built = buildRoutineBudgetLines([CLIENT], '2026-10-13', '2026-10-13');
const ledgerInput = (links: readonly LedgerLinkInput[]): LedgerInput => ({
  from: '2026-10-13', to: '2026-10-13', now: new Date('2026-10-14T00:00:00.000Z'), records: RECORDS, links, lines: built.lines, notPlaced: built.notPlaced,
  routines: new Map([['client', { name: 'Client lunch', timezone: BKK, steps: new Map() }]]), roles: new Map([['client', 'place']]), vendors: [], stays: [],
  accounts: [{ entityId: 'B', code: '6100', name: 'Client meals' }], books: [{ id: 'B', entityType: 'sole_prop' }],
});
const clientLink = (journalEntryId: string, amountCents: number, reversed: boolean): LedgerLinkInput => ({ kind: 'routine', targetId: 'client', instant: CLIENT_13, journalEntryId, amountCents, reversed });

test('C the ledger: a row’s MATCH leaves the reversed posting out; said.reversed counts it and the notes count it; only reversed → MATCH blank', () => {
  const mixed = ledgerOf(ledgerInput([clientLink('je-a', 2500, false), clientLink('je-b', 500, true)]));
  assert.deepEqual(mixed.rows[0].match, { cents: 2500, postings: 1, unreadable: 0, reversed: 1 });
  assert.equal(mixed.said.reversed, 1);
  assert.equal(notesCount(mixed.said, 1), notesCount({ ...mixed.said, reversed: 0 }, 1) + 1, 'the reversed line is one more note');
  const only = ledgerOf(ledgerInput([clientLink('je-b', 500, true)]));
  assert.equal(matchCellWords(only.rows[0].match), '—');
  assert.equal(only.said.reversed, 1);
  const none = ledgerOf(ledgerInput([clientLink('je-a', 3000, false)]));
  assert.equal(none.said.reversed, 0);
  const section = code('src/components/workbench/operations/ledger/LedgerSection.tsx');
  assert.match(section, /\{answer\.read\.value\.said\.reversed > 0 && <p data-ledger-said-reversed>\{reversedLinkedWords\(answer\.read\.value\.said\.reversed\)\}<\/p>\}/);
});

const entryOf = (debit: number, state: { status: string; is_reversal: boolean; reversed_by_entry_id: string | null }): TaskLinkRow['journal_entry'] => ({ ...state, ledger_entries: [{ entry_type: 'D', amount: BigInt(debit) }, { entry_type: 'C', amount: BigInt(debit) }] });
const taskLink = (journal_entry_id: string, target_id: string, journal_entry: TaskLinkRow['journal_entry']): TaskLinkRow => ({ target_kind: 'project_task', target_id, target_instant: null, journal_entry_id, journal_entry });

test('C THE WORK: a task’s MATCH leaves the reversed posting out and counts it (match_reversed); the table says the count under it', () => {
  const matches = taskMatchesOf([taskLink('je-1', 'a', entryOf(1000, posted)), taskLink('je-2', 'a', entryOf(400, reversedOriginal)), taskLink('je-3', 'b', entryOf(700, reversalEntry))]);
  assert.deepEqual(matches.get('a'), { match_cents: 1000, match_links: 1, match_unreadable: 0, match_reversed: 1 });
  assert.deepEqual(matches.get('b'), { match_cents: null, match_links: 0, match_unreadable: 0, match_reversed: 1 }, 'only reversed: blank, never 0');
  const row = (match_reversed: number | undefined): TaskRow => ({ task: { match_reversed } } as unknown as TaskRow);
  assert.equal(tasksReversedOf([row(1), row(undefined), row(2)]), 3, 'a task the GET did not answer adds none');
  const work = code('src/components/workbench/operations/SectionE_Work.tsx');
  assert.match(work, /\{loaded && tasksReversedOf\(shown\) > 0 && <p className="text-xs text-amber-800" \{\.\.\.dataAttr\(name, 'reversed'\)\}>\{reversedLinkedWords\(tasksReversedOf\(shown\)\)\}<\/p>\}/);
});

test('C the three MATCH routes read the reversal state; the links GET marks each linked posting, offers no reversed candidate and counts the ones it left out', () => {
  for (const f of ['src/app/api/operations/routines/month/route.ts', 'src/app/api/operations/ledger/route.ts', 'src/app/api/operations/projects/[id]/tasks/route.ts']) {
    const src = code(f);
    assert.match(src, /journal_entry: \{ select: LINKED_POSTING_SELECT \}/, f);
    assert.doesNotMatch(src, /POSTING_LINES_SELECT/, `${f}: the lines alone are not the select`);
  }
  const get = bodyOf(code(LINK_ROUTE), 'GET');
  inOrder(get, [
    'planned_item_links: { none: {} },',
    '...PAYING_POSTING_WHERE,',
    "orderBy: { date: 'desc' },",
    'candidates = rows.map(asPosting);',
    'candidatesReversed = await prisma.journal_entries.count({',
    'where: { userId: user.id, date: { gte: from, lte: to }, planned_item_links: { none: {} }, ...REVERSED_POSTING_WHERE },',
    'candidatesReversed,',
  ], 'the GET');
  assert.match(code(LINK_ROUTE), /amountCents: amountCentsOf\(e\),\n\s*reversed: isReversedPosting\(e\),\n\}\);/, 'each posting says whether it was reversed');
  assert.match(code(LINK_ROUTE), /amountCents: null, reversed: null \}/, 'an entry that cannot be read is unknown — not "not reversed"');
});

test('C the link leaf: a reversed posting is left out of the actual and named; the panel and the pickers say it', () => {
  const mixed = sumLinks([
    { journalEntryId: 'paid', date: '2026-10-13', description: 'Lunch', amountCents: 2500, reversed: false },
    { journalEntryId: 'rev', date: '2026-10-13', description: 'Lunch (reversed)', amountCents: 500, reversed: true },
  ]);
  assert.equal(mixed.actual, 25);
  assert.equal(mixed.counted, 1);
  assert.deepEqual(mixed.reversed, ['rev']);
  assert.equal(mixed.complete, true, 'every paying posting was read');
  assert.equal(linkedSourceLine(mixed), 'linked to 1 posting in Books; 1 linked posting was reversed — MATCH leaves it out (rev)');
  const only = sumLinks([{ journalEntryId: 'rev', date: '2026-10-13', description: 'x', amountCents: 500, reversed: true }]);
  assert.equal(only.actual, null, 'nothing paid: NOT LINKED, never $0');
  const unknown = sumLinks([{ journalEntryId: 'u', date: '2026-10-13', description: 'x', amountCents: null, reversed: null }]);
  assert.deepEqual([unknown.unreadable, unknown.reversed], [['u'], []], 'an unreadable entry is unreadable');
  const panel = code('src/components/hub/EventDetailPanel.tsx');
  assert.match(panel, /\{summed\.reversed\.length > 0 && \(\n\s*<p className="pt-2 text-xs text-amber-800" data-drill-reversed-note>\{reversedLinkedWords\(summed\.reversed\.length\)\}<\/p>\n\s*\)\}/, 'said even when nothing else is linked');
  assert.match(panel, /data-drill-candidates-reversed>\{reversedCandidatesWords\(candidatesReversed\)\}/);
  assert.match(panel, /data-drill-line-candidates-reversed>\{reversedCandidatesWords\(lineLinks\.candidatesReversed\)\}/);
  assert.match(panel, /if \(withCandidates && typeof data\.candidatesReversed !== 'number'\) \{ setRefusal\(CANDIDATES_REVERSED_MISSING_WORDS\); return; \}/, 'the count is read, never assumed');
  const hook = code('src/components/hub/useLineLinks.tsx');
  assert.match(hook, /if \(near && typeof data\.candidatesReversed !== 'number'\) return \{ ok: false, words: CANDIDATES_REVERSED_MISSING_WORDS \};/);
  assert.doesNotMatch(hook + panel, /candidatesReversed \?\? 0/, 'never a 0 in its place');
  assert.match(code('src/components/workbench/operations/ledger/LinkPicker.tsx'), /data-link-picker-candidates-reversed>\{reversedCandidatesWords\(item\.candidatesReversed\)\}/);
});

// ── RULING D · NO ORPHANS ───────────────────────────────────────────────────

test('D the routine DELETE: the routine’s and every line’s links counted in the transaction that deletes; any held → 409 by name, nothing deleted', () => {
  assert.equal(routineHoldsLinksWords(1), 'this routine has 1 posting linked in Books — deactivate it instead (every record stays)');
  assert.equal(routineHoldsLinksWords(3), 'this routine has 3 postings linked in Books — deactivate it instead (every record stays)', 'the ruling’s words');
  assert.deepEqual(routineLinksWhere('u', 'r', ['s1', 's2']), { user_id: 'u', OR: [{ target_kind: 'routine', target_id: 'r' }, { target_kind: 'routine_line', target_id: { in: ['s1', 's2'] } }] });
  assert.deepEqual(routineLinksWhere('u', 'r', []), { user_id: 'u', OR: [{ target_kind: 'routine', target_id: 'r' }] }, 'a stepless routine');
  const del = bodyOf(code(ROUTINE_ROUTE), 'DELETE');
  inOrder(del, [
    'const existing = await loadAuthorizedRoutine(id, user.id);',
    "if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    'const linked = await prisma.$transaction(async (tx) => {',
    'const lineIds = (await tx.operations_routine_steps.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true } })).map((s) => s.id);',
    'const held = await tx.planned_item_links.count({ where: routineLinksWhere(user.id, id, lineIds) });',
    'if (held > 0) return held;',
    'await tx.operations_routines.delete({ where: { id } });',
    'if (linked > 0) return NextResponse.json({ error: routineHoldsLinksWords(linked) }, { status: 409 });',
    'await writeAuditLog({',
  ], 'the routine DELETE');
  assert.doesNotMatch(del, /is_active: true/, 'every line, archived ones too — the delete cascades them all');
  assert.equal((code(ROUTINE_ROUTE).match(/operations_routines\.delete\(/g) ?? []).length, 1, 'one delete, inside the transaction');
});

test('D the line DELETE refuses while the line holds links — 409 by name, before the archive; deactivate is unchanged', () => {
  assert.equal(lineHoldsLinksWords(1), 'this line has 1 posting linked in Books — deactivate its routine instead (every record stays)');
  const del = bodyOf(code(LINE_ROUTE), 'DELETE');
  inOrder(del, [
    'const existing = await loadAuthorizedRoutineStep(stepId, user.id);',
    "const linked = await prisma.planned_item_links.count({ where: { user_id: user.id, target_kind: 'routine_line', target_id: stepId } });",
    'if (linked > 0) return NextResponse.json({ error: lineHoldsLinksWords(linked) }, { status: 409 });',
    'const archived = await prisma.operations_routine_steps.update({',
  ], 'the line DELETE');
  // Deactivate: the PATCH's is_active path is untouched by this ruling — it writes no link and reads none.
  const patch = bodyOf(code(ROUTINE_ROUTE), 'PATCH');
  assert.match(patch, /is_active/);
  assert.doesNotMatch(patch.slice(0, patch.indexOf('rekeyPlan(')), /routineHoldsLinksWords|lineHoldsLinksWords/, 'deactivate is never refused for links');
  assert.match(comments(HOLD), /LINK-LAW-01 \(Alex, 2026-10-28, ruling D\) — NO ORPHANS\./);
});

// ── RULING E · NO SCHEMA, NO MIGRATION, NO ROUTE ────────────────────────────

test('E the law holds each refusal; no route was added (the five touched routes all existed)', () => {
  const law = code(LAW);
  for (const piece of ['(LINK-LAW-01 ruling A)', '(LINK-LAW-01 ruling B)', '(LINK-LAW-01 ruling C)', '(LINK-LAW-01 ruling D)']) assert.ok(law.includes(piece), piece);
  assert.match(law, /if \(!occurrenceCheck\(probe, new Date\('2026-10-15T06:30:00\.000Z'\)\)\.ok\)/, 'the law probes the midnight-crossing zone at build time');
  assert.match(law, /const m = matchOf\(\[\{ amountCents: 1000, reversed: true \}, \{ amountCents: 250, reversed: false \}\]\);/, 'and the match');
  assert.match(law, /'src\/lib\/operations\/linkOccurrence\.ts',\n\];/, 'the occurrence test is an anchored caller (ONEOFF-01)');
});
