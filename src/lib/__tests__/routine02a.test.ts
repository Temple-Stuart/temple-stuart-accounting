/**
 * ROUTINE-02a (Alex, 2026-10-18) — ENDED ROUTINES ARCHIVED, END DATES HONOURED
 * EVERYWHERE, THE ZONE LIST.
 *
 * A1 the end bound (rruleHelpers.ts) is DRIVEN: both expansions stop at the
 * routine's end_date, as a local day in its zone; the evaluator's window, the
 * month tables and the completion's next-due are driven through it. A2 the
 * archive's test (endedBy) is driven; the list, the row and the lines are
 * anchored to their source. A3 the zone list is driven — the list, the
 * canonical spelling, the refusal — and the proof that canonicalising a name
 * moves no instant is run. Source is read with comments stripped
 * (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  TIME_ZONES, VIEWER_ZONE_WORDS, canonicalZone, endDayOf, endedBy, expandBetween, expandForward, scheduleAnchor, throughEnd, unlistedZoneWords, zoneNotListedWords, zoneUnreadWords, zonesByRegion,
} from '../operations/rruleHelpers';
import { evaluateWindow } from '@/inngest/functions/routine-evaluator';
import { routineMonthlyByCoa } from '../operations/routineBudget';
import { nextDueAfter } from '../operations/routineCompletion';
import { instantToZoned } from '../time';
import { ValidationError } from '../errors/ValidationError';

const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const EVALUATOR = 'src/inngest/functions/routine-evaluator.ts';
const BUDGET = 'src/lib/operations/routineBudget.ts';
const COMPLETION = 'src/lib/operations/routineCompletion.ts';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const PATCH_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const LIST = 'src/components/workbench/operations/routines/RoutineList.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const LINES = 'src/components/workbench/operations/routines/RoutineStepList.tsx';
const BUILDER = 'src/components/workbench/operations/routines/RRULEBuilder.tsx';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';

const BKK = 'Asia/Bangkok';
const DAILY_7 = 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0';
const START = new Date('2026-10-01T00:00:00.000Z');
const END = new Date('2026-10-15T00:00:00.000Z');
const iso = (ds: readonly Date[]) => ds.map((d) => d.toISOString());

// ── T1 · THE END BOUND ───────────────────────────────────────────────────────

test('T1 the end bound: a routine\'s end_date is the last LOCAL day an occurrence may fall on — both expansions stop at it; none without one', () => {
  assert.equal(endDayOf('2026-10-15'), '2026-10-15');
  assert.equal(endDayOf(END), '2026-10-15');
  assert.equal(endDayOf('2026-10-15T00:00:00.000Z'), '2026-10-15');
  for (const none of [null, undefined, '']) assert.equal(endDayOf(none), null);
  assert.throws(() => endDayOf('not a day'), ValidationError);
  // Daily 07:00 Bangkok (00:00Z), ended Oct 15: the window Oct 10–20 holds Oct 10..15 and nothing after; without an end, every day.
  const from = new Date('2026-10-10T00:00:00.000Z'), to = new Date('2026-10-20T23:59:59.000Z');
  const bounded = expandBetween(DAILY_7, BKK, from, to, scheduleAnchor(START), END);
  assert.deepEqual(iso(bounded), ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((d) => `${d}T00:00:00.000Z`), 'through the end day, inclusive');
  assert.equal(expandBetween(DAILY_7, BKK, from, to, scheduleAnchor(START)).length, 11, 'no end → every occurrence, as before');
  assert.equal(expandBetween(DAILY_7, BKK, from, to, scheduleAnchor(START), null).length, 11);
  // After the end nothing is next; before it the next is the next; the string form of the end reads the same.
  assert.deepEqual(expandForward(DAILY_7, BKK, new Date('2026-10-18T00:00:00.000Z'), 1, scheduleAnchor(START), END), []);
  // (expandForward compares `after` with the rule's FLOATING times before the shift to the zone — a pre-existing trait, not changed here; `after` is placed past the floating 07:00.)
  assert.deepEqual(iso(expandForward(DAILY_7, BKK, new Date('2026-10-14T08:00:00.000Z'), 3, scheduleAnchor(START), '2026-10-15')), ['2026-10-15T00:00:00.000Z'], 'the count is cut by the end — nothing after it exists');
  assert.equal(expandForward(DAILY_7, BKK, new Date('2026-10-18T00:00:00.000Z'), 1, scheduleAnchor(START)).length, 1, 'no end → the next, as before');
  // The bound is the LOCAL day: 23:00 Los Angeles on the end day is the next UTC day and still counts.
  const laLate = 'FREQ=DAILY;BYHOUR=23;BYMINUTE=0;BYSECOND=0';
  const la = expandBetween(laLate, 'America/Los_Angeles', new Date('2026-10-14T00:00:00.000Z'), new Date('2026-10-17T00:00:00.000Z'), scheduleAnchor(START), END);
  assert.deepEqual(iso(la), ['2026-10-15T06:00:00.000Z', '2026-10-16T06:00:00.000Z'], 'Oct 14 23:00 PDT and Oct 15 23:00 PDT (= Oct 16 06:00Z) — on the end day in LA, kept; Oct 16 23:00 PDT dropped');
  assert.deepEqual(throughEnd(la, 'America/Los_Angeles', null), la);
  assert.deepEqual(throughEnd(la, 'America/Los_Angeles', '2026-10-14'), [la[0]]);
  // The source: one bound, in the two expansions; every caller that writes or counts passes the end.
  const h = code(HELPERS);
  assert.match(h, /export function throughEnd\(occurrences: Date\[\], timezone: string, endDate: Date \| string \| null \| undefined\): Date\[\] \{\n\s*const last = endDayOf\(endDate\);\n\s*if \(last === null\) return occurrences;\n\s*return occurrences\.filter\(\(d\) => instantToZoned\(d, timezone\)\.date <= last\);\n\}/, 'the Budget\'s own day test (lib/time.ts instantToZoned)');
  assert.match(h, /return throughEnd\(rawOccurrences\.map\(\(d\) => shiftFloatingToZone\(d, timezone\)\), timezone, endDate\);/, 'expandForward');
  assert.match(h, /return throughEnd\(raw\.map\(\(d\) => shiftFloatingToZone\(d, timezone\)\), timezone, endDate\);/, 'expandBetween');
  assert.equal((h.match(/endDate\?: Date \| string \| null\n/g) ?? []).length, 2, 'the last parameter of both, optional — a caller passing nothing is unchanged');
  assert.match(code(CREATE_ROUTE), /expandForward\(schedule_rrule, timezone, new Date\(\), 1, scheduleAnchor\(startResult\.value\), endDate\);/, 'the create route');
  assert.match(code(PATCH_ROUTE), /expandForward\(nextRrule, nextTz, new Date\(\), 1, scheduleAnchor\(effectiveStart\), effectiveEnd\);/, 'the update route');
  assert.match(code(COMPLETION), /expandForward\(routine\.schedule_rrule, routine\.timezone, after, 1, scheduleAnchor\(routine\.start_date\), routine\.end_date\);/, 'the completion\'s next due');
  assert.match(code(BUDGET), /expandBetween\(routine\.schedule_rrule, routine\.timezone, from, to, scheduleAnchor\(routine\.start_date \?\? null\), routine\.end_date \?\? null\)\.length;/, 'the month tables');
  assert.match(comments(HELPERS), /ROUTINE-02a \(Alex, 2026-10-18\) — END DATES HONOURED EVERYWHERE/);
});

// ── T2 · THE EVALUATOR ───────────────────────────────────────────────────────

test('T2 the evaluator reads end_date; a routine whose end has passed expects nothing in the window, is never a miss and has no next — the window pure and exported', () => {
  const r = { schedule_rrule: DAILY_7, timezone: BKK, start_date: START, end_date: END, fail_threshold_minutes: 30, role: 'place' };
  const windowStart = new Date('2026-10-16T00:00:00.000Z'), now = new Date('2026-10-18T00:00:00.000Z');
  // Three days after the end: nothing expected, nothing missed, no next.
  assert.deepEqual(evaluateWindow(r, windowStart, now), { expected: [], misses: [], nextDueAt: null });
  // The dates cross step.run as ISO strings — read the same.
  assert.deepEqual(evaluateWindow({ ...r, start_date: '2026-10-01T00:00:00.000Z', end_date: '2026-10-15T00:00:00.000Z' }, windowStart, now), { expected: [], misses: [], nextDueAt: null });
  // The same routine with no end: Oct 16 and 17 expected (the window is compared in the rule's floating time, as before), both past the threshold → misses; Oct 18 07:00 is next.
  const open = evaluateWindow({ ...r, end_date: null }, windowStart, now);
  assert.deepEqual(iso(open.expected), ['2026-10-16T00:00:00.000Z', '2026-10-17T00:00:00.000Z']);
  assert.deepEqual(iso(open.misses), ['2026-10-16T00:00:00.000Z', '2026-10-17T00:00:00.000Z']);
  assert.equal(open.nextDueAt?.toISOString(), '2026-10-18T00:00:00.000Z');
  // A window straddling the end: the days through the end are expected and missed; nothing after; no next.
  const straddle = evaluateWindow(r, new Date('2026-10-14T00:00:00.000Z'), now);
  assert.deepEqual(iso(straddle.expected), ['2026-10-14T00:00:00.000Z', '2026-10-15T00:00:00.000Z']);
  assert.deepEqual(iso(straddle.misses), ['2026-10-14T00:00:00.000Z', '2026-10-15T00:00:00.000Z']);
  assert.equal(straddle.nextDueAt, null);
  // TASKS-ONE-02 kept: an all-day routine is a charge — expected, never a miss; a role outside the six is thrown by name.
  const charge = evaluateWindow({ ...r, end_date: null, role: 'all_day' }, windowStart, now);
  assert.equal(charge.expected.length, 2);
  assert.deepEqual(charge.misses, []);
  assert.throws(() => evaluateWindow({ ...r, role: 'habit' }, windowStart, now), /role "habit" — not one of the six/);
  assert.throws(() => evaluateWindow({ ...r, end_date: null, timezone: 'Not/AZone' }, windowStart, now), /Invalid time zone|not recognised|timeZone/);
  // The source: the row's end_date is read; the loop writes what the window answers.
  const e = code(EVALUATOR);
  assert.match(e, /start_date: true,\n\s*end_date: true,\n\s*fail_threshold_minutes: true,/, 'the select reads the end');
  assert.match(e, /export function evaluateWindow\(r: EvaluatedRoutine, windowStart: Date, now: Date\): \{ readonly expected: Date\[\]; readonly misses: Date\[\]; readonly nextDueAt: Date \| null \} \{/);
  assert.match(e, /const expected = expandBetween\(r\.schedule_rrule, r\.timezone, windowStart, now, scheduleAnchor\(r\.start_date\), r\.end_date\);/, 'anchored (the one-off law) and bounded');
  assert.match(e, /const nextDueAt = expandForward\(r\.schedule_rrule, r\.timezone, now, 1, scheduleAnchor\(r\.start_date\), r\.end_date\)\[0\] \?\? null;/);
  assert.match(e, /window = evaluateWindow\(r, windowStart, now\);/);
  assert.match(e, /for \(const expectedAt of window\.misses\) \{/);
  assert.match(e, /next_due_at: window\.nextDueAt,/);
  assert.doesNotMatch(e, /expectedOccurrences|eligibleMisses/, 'no second expansion path in the loop');
  assert.match(comments(EVALUATOR), /ROUTINE-02a \(Alex, 2026-10-18\): END DATES HONOURED/);
});

// ── T3 · THE MONTH TABLES ────────────────────────────────────────────────────

test('T3 the month tables stop at the end: the month of the end counts through its day, a month after counts nothing; no end → as before', () => {
  const r = { budget_amount: 10, coa_code: 'P-6150', schedule_rrule: DAILY_7, timezone: BKK, start_date: START };
  assert.deepEqual(routineMonthlyByCoa({ ...r, end_date: END }, 2026, 9), { 'P-6150': 150 }, 'Oct 1–15: 15 × $10');
  assert.deepEqual(routineMonthlyByCoa({ ...r, end_date: END }, 2026, 10), {}, 'November: nothing');
  assert.deepEqual(routineMonthlyByCoa(r, 2026, 10), { 'P-6150': 300 }, 'no end: every day of November');
  assert.deepEqual(routineMonthlyByCoa({ ...r, end_date: null }, 2026, 9), { 'P-6150': 310 });
  assert.match(code(BUDGET), /end_date\?: Date \| string \| null;/, 'the input the loader already hands over (routineBudgetInputs.ts) is read');
  assert.match(code('src/lib/operations/routineBudgetInputs.ts'), /id: true, name: true, end_date: true,/, 'the loader selects it — unchanged');
});

// ── T4 · THE COMPLETION'S NEXT DUE ───────────────────────────────────────────

test('T4 the completion\'s next due stops at the end: the last stop recorded leaves no next; the writer reads end_date', () => {
  const r = { schedule_rrule: DAILY_7, timezone: BKK, start_date: START, end_date: END };
  // (`after` placed past the rule's floating 07:00 — expandForward's pre-existing comparison, see T1.)
  assert.equal(nextDueAfter(r, new Date('2026-10-14T08:00:00.000Z'))?.toISOString(), '2026-10-15T00:00:00.000Z');
  assert.equal(nextDueAfter(r, new Date('2026-10-15T08:00:00.000Z')), null, 'after the end day\'s stop: nothing is next');
  assert.equal(nextDueAfter({ ...r, end_date: null }, new Date('2026-10-15T08:00:00.000Z'))?.toISOString(), '2026-10-16T00:00:00.000Z');
  const c = code(COMPLETION);
  assert.match(c, /readonly end_date: Date \| null;\n\}/, 'the schedule carries its end');
  assert.match(c, /select: \{ id: true, name: true, role: true, schedule_rrule: true, timezone: true, start_date: true, end_date: true, consecutive_completion_streak: true \},/, 'syncCompletion reads it');
});

// ── T5 · THE UPDATE AND CREATE ROUTES ────────────────────────────────────────

test('T5 an end_date edit recomputes next_due_at; a one-off\'s effective end is its day; the create route bounds the first next', () => {
  const p = code(PATCH_ROUTE);
  assert.match(p, /if \('end_date' in body\) \{\n\s*const r = parseDateOrNull\(body\.end_date, 'end_date'\);\n\s*if \(r\.error\) return r\.error;\n\s*effectiveEnd = r\.value;\n\s*data\.end_date = r\.value;\n\s*scheduleChanged = true;\n\s*\}/, 'the end moved → recompute');
  assert.match(p, /data\.end_date = effectiveStart;\n\s*effectiveEnd = effectiveStart;/, 'a one-off ends on its day — the recompute sees that end');
  assert.ok(p.indexOf('effectiveEnd = effectiveStart;') < p.indexOf('expandForward(nextRrule, nextTz'), 'the effective end is settled before the recompute');
  assert.match(comments(PATCH_ROUTE), /ROUTINE-02a \(Alex, 2026-10-18\): end_date is the LAST DAY/);
  assert.match(comments(CREATE_ROUTE), /ROUTINE-02a \(Alex, 2026-10-18\)/);
});

// ── T6 · THE ARCHIVE ─────────────────────────────────────────────────────────

test('T6 the archive: ended = end_date before today in the routine\'s own zone; behind "show ended (n)" in an ENDED group at the bottom, newest end first, read-only but for edit; nothing deleted or deactivated', () => {
  // The test, driven: the end day in Bangkok, judged at Bangkok's midnight — not UTC's.
  assert.deepEqual(endedBy(null, BKK, new Date('2026-10-18T00:00:00.000Z')), { ended: false, reason: null });
  assert.deepEqual(endedBy('2026-10-15', BKK, new Date('2026-10-15T16:59:00.000Z')), { ended: false, reason: null }, '23:59 Bangkok on the end day: current');
  assert.deepEqual(endedBy('2026-10-15', BKK, new Date('2026-10-15T17:00:00.000Z')), { ended: true, day: '2026-10-15' }, '00:00 Bangkok the day after: ended');
  assert.deepEqual(endedBy(END, BKK, new Date('2026-10-18T00:00:00.000Z')), { ended: true, day: '2026-10-15' });
  assert.deepEqual(endedBy('2026-10-15', 'America/Los_Angeles', new Date('2026-10-16T06:59:00.000Z')), { ended: false, reason: null }, '23:59 Los Angeles on the end day: current');
  const unread = endedBy('2026-10-15', 'Not/AZone', new Date('2026-10-18T00:00:00.000Z'));
  assert.equal(unread.ended, false);
  assert.match((unread as { reason: string }).reason, /^zone "Not\/AZone" not recognised: .*pick one from the list$/, 'named, and current — never hidden, never judged by another zone');
  assert.equal(zoneUnreadWords('X/Y', 'why'), 'zone "X/Y" not recognised: why — pick one from the list');
  // The list: judged now in each routine's zone; the cadence groups hold the current; the ended group at the bottom, newest end first, only while shown.
  const l = code(LIST);
  assert.match(l, /const now = new Date\(\);\n\s*const judged = routines\.map\(\(r\) => \(\{ r, end: endedBy\(r\.end_date, r\.timezone, now\) \}\)\);\n\s*const current = judged\.filter\(\(x\) => !x\.end\.ended\);/);
  assert.match(l, /\.sort\(\(a, b\) => b\.day\.localeCompare\(a\.day\) \|\| a\.r\.name\.localeCompare\(b\.r\.name\)\);/, 'newest end first');
  assert.match(l, /for \(const x of current\) \{\n\s*const g = groupOf\(x\.r\.schedule_rrule\);/, 'the cadence groups hold current routines only');
  assert.match(l, /const \[showEnded, setShowEnded\] = useState\(false\);/, 'React state only');
  assert.match(l, /checked=\{showEnded\}\n\s*onChange=\{\(e\) => setShowEnded\(e\.target\.checked\)\}\n\s*data-routines-show-ended\n\s*\/>\n\s*<span className="text-text-muted">\{showEndedWords\(ended\.length\)\}<\/span>/);
  assert.ok(l.indexOf('show inactive') < l.indexOf('data-routines-show-ended'), 'beside "show inactive"');
  assert.match(l, /\{showEnded && ended\.length > 0 && \(\n\s*<Fragment key="ended">\n\s*<tbody>\n\s*<tr data-ended-group>/);
  assert.ok(l.indexOf('<tr data-ended-group>') > l.lastIndexOf('CADENCE_GROUP_ORDER.map('), 'at the bottom');
  assert.match(l, /const url = showInactive\n\s*\? '\/api\/operations\/routines'\n\s*: '\/api\/operations\/routines\?is_active=true';/, 'the fetch is unchanged');
  assert.doesNotMatch(l, /localStorage|sessionStorage|document\.cookie/);
  assert.match(l, /export const showEndedWords = \(n: number\): string => `show ended \(\$\{n\}\)`;/);
  assert.match(l, /export const endedGroupWords = \(n: number\): string => `ended \(\$\{n\}\)`;/);
  // The row: "ended <date>" beside the name; edit alone; its lines read-only; the zone shown as the list spells it; a zone Intl cannot read named.
  const r = code(ROW);
  assert.match(r, /export const endedWords = \(dateWords: string\): string => `ended \$\{dateWords\}`;/);
  assert.match(r, /\{end\.ended && \(\n\s*<span [^>]*data-routine-ended>\n\s*\{endedWords\(formatDate\(end\.day\)\)\}\n\s*<\/span>\n\s*\)\}/);
  assert.match(r, /\{!end\.ended && \(\n\s*<>\n\s*<button\n\s*type="button"\n\s*onClick=\{handleToggleActive\}/, 'deactivate, delete and + line only on a current routine');
  assert.ok(r.indexOf('onClick={enterEdit}') < r.indexOf('{!end.ended && ('), 'edit stays, first');
  assert.match(r, /<RoutineStepList routine=\{routine\} entities=\{entities\} onUpdate=\{onUpdate\} routineCell=\{routineCell\} readOnly=\{end\.ended\} \/>/);
  assert.match(r, /<span title="time zone" data-routine-zone>\{canonicalZone\(routine\.timezone\) \?\? routine\.timezone\}<\/span>/);
  assert.match(r, /\{!end\.ended && end\.reason !== null && \(\n\s*<span className="text-amber-800" data-routine-zone-unread>\{end\.reason\}<\/span>\n\s*\)\}/);
  assert.match(r, /timezone: canonicalZone\(r\.timezone\) \?\? r\.timezone,/, 'the edit form is seeded canonical, so the next save stores it');
  assert.ok(r.indexOf('{!end.ended && (') < r.indexOf('onClick={handleToggleActive}') && r.indexOf('onClick={handleToggleActive}') < r.indexOf('onClick={handleDelete}') && r.indexOf('onClick={handleDelete}') < r.indexOf('data-routine-add-line'), 'deactivate, delete and + line all sit inside the current-only block');
  // The lines: no controls, no "+ line".
  const s = code(LINES);
  assert.match(s, /readOnly\?: boolean;/);
  assert.match(s, /\{readOnly \? <td className=\{cellClass\} data-line-read-only \/> : \(/);
  assert.match(comments(LIST), /ROUTINE-02a \(Alex, 2026-10-18\) — THE ARCHIVE/);
  assert.match(comments(ROW), /ROUTINE-02a \(Alex, 2026-10-18\)/);
  assert.match(comments(LINES), /ROUTINE-02a \(Alex, 2026-10-18\)/);
});

// ── T7 · THE ZONE LIST ───────────────────────────────────────────────────────

test('T7 the zone list: Intl\'s own names, matched without case, stored as spelled; UTC and aliases refused by name; canonicalising moves no instant', () => {
  assert.ok(TIME_ZONES.length > 300 && TIME_ZONES.includes('Asia/Bangkok') && TIME_ZONES.includes('America/Los_Angeles'));
  assert.deepEqual([...new Set(TIME_ZONES)].length, TIME_ZONES.length, 'no name twice');
  assert.equal(canonicalZone('Asia/Bangkok'), 'Asia/Bangkok');
  assert.equal(canonicalZone('asia/bangkok'), 'Asia/Bangkok');
  assert.equal(canonicalZone(' ASIA/BANGKOK '), 'Asia/Bangkok');
  assert.equal(canonicalZone('america/los_angeles'), 'America/Los_Angeles');
  // Nothing else: V8's list holds no 'UTC' and no alias; each is refused by name, never remapped.
  assert.equal(TIME_ZONES.includes('UTC'), false);
  for (const not of ['UTC', 'utc', 'Etc/UTC', 'US/Pacific', 'GMT', 'Asia/Foo', '', '  ', null, undefined, 7]) assert.equal(canonicalZone(not), null, `${JSON.stringify(not)} is not in the list`);
  assert.equal(zoneNotListedWords('US/Pacific'), 'timezone "US/Pacific" is not one of Intl\'s zone names — pick one from the list');
  assert.equal(unlistedZoneWords('asia/foo'), 'asia/foo — not in the list, pick one');
  assert.equal(VIEWER_ZONE_WORDS, "your browser's zone");
  // By region, in the list's order; every zone once.
  const groups = zonesByRegion();
  assert.equal(groups[0].region, 'Africa');
  assert.ok(groups.some((g) => g.region === 'Asia' && g.zones.includes('Asia/Bangkok')));
  assert.deepEqual(groups.flatMap((g) => g.zones), [...TIME_ZONES]);
  for (const g of groups) for (const z of g.zones) assert.ok(z === g.region || z.startsWith(`${g.region}/`));
  // THE PROOF: a name that differs only by case is the same zone to Intl — every instant is unchanged, across a DST change too.
  const from = new Date('2026-10-01T00:00:00.000Z'), to = new Date('2026-11-30T00:00:00.000Z');
  assert.deepEqual(iso(expandBetween(DAILY_7, 'asia/bangkok', from, to, scheduleAnchor(START), END)), iso(expandBetween(DAILY_7, 'Asia/Bangkok', from, to, scheduleAnchor(START), END)));
  const la8 = 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0';
  const lower = expandBetween(la8, 'america/los_angeles', from, to, scheduleAnchor(START)), upper = expandBetween(la8, 'America/Los_Angeles', from, to, scheduleAnchor(START));
  assert.equal(lower.length, 60, 'Oct 1 – Nov 29 (the window is compared in floating time, as before)');
  assert.deepEqual(iso(lower), iso(upper), 'identical through the Nov 1 2026 clock change');
  // (The offset is sampled at the rule's floating instant — lib/time.ts's documented limit on the day of a change — so Oct 31 and Nov 2 are the witnesses.)
  assert.ok(iso(lower).includes('2026-10-31T15:00:00.000Z') && iso(lower).includes('2026-11-02T16:00:00.000Z'), 'PDT then PST — the zone is read, under either spelling');
  assert.deepEqual(expandForward(DAILY_7, 'asia/bangkok', new Date('2026-10-14T00:30:00.000Z'), 1, scheduleAnchor(START), END), expandForward(DAILY_7, 'Asia/Bangkok', new Date('2026-10-14T00:30:00.000Z'), 1, scheduleAnchor(START), END));
  assert.deepEqual(instantToZoned(new Date('2026-10-14T00:00:00.000Z'), 'asia/bangkok'), instantToZoned(new Date('2026-10-14T00:00:00.000Z'), 'Asia/Bangkok'));
  assert.deepEqual(endedBy('2026-10-15', 'asia/bangkok', new Date('2026-10-15T17:00:00.000Z')), endedBy('2026-10-15', 'Asia/Bangkok', new Date('2026-10-15T17:00:00.000Z')));
  // The routes: refuse by name, store the list's spelling; the PATCH writes only the routine row (its records are untouched).
  const post = code(CREATE_ROUTE), patch = code(PATCH_ROUTE);
  assert.match(post, /const timezone = canonicalZone\(body\.timezone\);\n\s*if \(timezone === null\) \{\n\s*return NextResponse\.json\(\n\s*\{ error: 'Validation', field: 'timezone', message: zoneNotListedWords\(body\.timezone\) \},\n\s*\{ status: 400 \}\n\s*\);\n\s*\}/);
  assert.match(post, /schedule_rrule,\n\s*timezone,\n\s*ideal_time_label: idealTimeLabel,/, 'stored as the list spells it');
  assert.doesNotMatch(post, /timezone: body\.timezone/, 'the typed spelling is never stored');
  assert.match(patch, /const timezone = canonicalZone\(body\.timezone\);\n\s*if \(timezone === null\) \{\n\s*return NextResponse\.json\(\n\s*\{ error: 'Validation', field: 'timezone', message: zoneNotListedWords\(body\.timezone\) \},\n\s*\{ status: 400 \}\n\s*\);\n\s*\}\n\s*data\.timezone = timezone;\n\s*scheduleChanged = true;/);
  assert.equal((patch.match(/prisma\.operations_routines\.update\(/g) ?? []).length, 1, 'the one write');
  // ROUTINE-02b (2026-10-18): the PATCH moves a routine's history only when its clock or its zone changes, and a name that
  // differs only by case is the same zone — a canonicalising save enters no move, so no record or completion is touched.
  const patchHandler = patch.slice(patch.indexOf('export async function PATCH('), patch.indexOf('export async function DELETE('));
  assert.match(patchHandler, /const zoneMoved = canonicalZone\(existing\.timezone\) !== canonicalZone\(nextTz\);/);
  assert.ok(patchHandler.indexOf('operations_stop_records') > patchHandler.indexOf('if (clockMoved || zoneMoved) {'), 'the records are reached only inside the move');
  // The builder: a select over the list — the viewer's zone first (read after mount), the rest by region; an unlisted stored value visible, named.
  const b = code(BUILDER);
  assert.doesNotMatch(b, /type="text"\n\s*value=\{form\.timezone\}/, 'the zone is picked, not typed');
  assert.match(b, /const \[viewerZone, setViewerZone\] = useState<string \| null>\(null\);\n\s*useEffect\(\(\) => \{\n\s*setViewerZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\);\n\s*\}, \[\]\);/);
  assert.match(b, /<select\n\s*value=\{form\.timezone\}\n\s*onChange=\{\(e\) => setForm\(\{ \.\.\.form, timezone: e\.target\.value \}\)\}\n\s*className=\{inputClass\}\n\s*data-routine-timezone\n\s*>\n\s*\{!zoneListed && <option value=\{form\.timezone\} data-routine-timezone-unlisted>\{unlistedZoneWords\(form\.timezone\)\}<\/option>\}\n\s*\{viewerZone !== null && TIME_ZONES\.includes\(viewerZone\) && \(\n\s*<optgroup label=\{VIEWER_ZONE_WORDS\} data-routine-timezone-viewer>\n\s*<option value=\{viewerZone\}>\{viewerZone\}<\/option>\n\s*<\/optgroup>\n\s*\)\}\n\s*\{zonesByRegion\(\)\.map\(\(g\) => \(\n\s*<optgroup key=\{g\.region\} label=\{g\.region\}>/);
  // The create form starts in the viewer's zone, read after mount.
  assert.match(code(CREATE_FORM), /useEffect\(\(\) => \{\n\s*const zone = Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone;\n\s*setCreateForm\(\(f\) => \(\{ \.\.\.f, timezone: zone \}\)\);\n\s*\}, \[\]\);/);
  assert.match(comments(HELPERS), /ROUTINE-02a — THE ZONE LIST/);
  assert.match(comments(BUILDER), /ROUTINE-02a \(Alex, 2026-10-18\)/);
  assert.match(comments(CREATE_FORM), /ROUTINE-02a \(Alex, 2026-10-18\)/);
});
