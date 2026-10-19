/**
 * MOVE-01 (Alex, 2026-10-19) — "I'M MOVING": from a date, every current routine
 * ends the day before and its copy runs in the new zone; one control, one list,
 * one transaction.
 *
 * T1 the plan by value: what ends (renamed), what is copied with which times
 *    (midnight allowed, an empty window refused), what is re-zoned, the stay,
 *    the words, every refusal by name.
 * T2 the route's source: the stops GET's auth order, every query by user_id,
 *    ONE $transaction with every old routine locked, the re-zoned proven to
 *    hold no history, no defaults, the audits, the answer.
 * T3 the control: "moving" beside the day controls (a sibling — the controls'
 *    own pin stands), the form's fields, the one zone picker with no default,
 *    the list grouped as the routine list is, the plan's words from the one
 *    rule, confirm then a full load, cancel writes nothing, nothing stored.
 * T4 the window may cross midnight: both routes refuse only an EMPTY window.
 * T5 the audit type: the enum value last, the one ADD VALUE line applied at
 *    deploy, the client knows it, the audit log lists it; the one-off law
 *    names the plan as an anchored caller.
 */

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  BODY_WORDS, MOVE_CHIP_WORDS, REZONED_WORDS, TASKS_WORDS, arrowWords, defaultEntry, hasHistoryWords, isCurrent, listRows, moveWords,
  nameTakenWords, noOccurrenceWords, notListedWords, pastDateWords, planMove, renamedWords, timeOf, type MoveRoutine,
} from '../operations/routineMove';
import { EMPTY_WINDOW_WORDS } from '../operations/rruleHelpers';

const PLAN = 'src/lib/operations/routineMove.ts';
const ROUTE = 'src/app/api/operations/routines/move/route.ts';
const CONTROL = 'src/components/workbench/operations/stops/MoveControl.tsx';
const ZONE_SELECT = 'src/components/workbench/operations/routines/ZoneSelect.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const PATCH_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const SCHEMA = 'prisma/schema.prisma';
const AUDIT_ROUTE = 'src/app/api/audit-log/route.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const MIGRATION_DIR = '20261019090000_move_01_moved_audit_type';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;

const NOW = new Date('2026-10-19T05:00:00.000Z');
const DATE = '2026-10-22';
const r = (o: Partial<MoveRoutine> & { id: string; name: string }): MoveRoutine => ({
  schedule_rrule: 'FREQ=DAILY;BYHOUR=21;BYMINUTE=0;BYSECOND=0', timezone: 'Asia/Bangkok', start_date: null, end_date: null,
  start_time: '1970-01-01T21:00:00.000Z', end_time: '1970-01-01T23:59:00.000Z', is_active: true, ...o,
});
const ROUTINES: MoveRoutine[] = [
  r({ id: 'a', name: 'Dinner' }),
  r({ id: 'b', name: 'Gym', schedule_rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=7;BYMINUTE=30;BYSECOND=0', start_time: new Date(Date.UTC(1970, 0, 1, 7, 30)), end_time: new Date(Date.UTC(1970, 0, 1, 8, 30)) }),
  r({ id: 'c', name: 'Massage', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: '2026-10-25', end_date: '2026-10-25' }),
  r({ id: 'd', name: 'Pilates', end_date: '2026-10-20' }),
  r({ id: 'e', name: 'Later', start_date: new Date('2026-10-23T00:00:00.000Z') }),
  r({ id: 'f', name: 'Ends later', end_date: '2026-10-30' }),
  r({ id: 'g', name: 'Inactive', is_active: false }),
];
const STAYS = [{ id: 's1', place: 'Chiang Mai', starts_on: '2026-10-08', ends_on: '2026-10-31' }];
const entriesFor = (date: string) => listRows(ROUTINES, date).map((row) => defaultEntry(ROUTINES.find((x) => x.id === row.id) as MoveRoutine));
const ENTRIES = entriesFor(DATE).map((e) => (e.id === 'a' ? { ...e, start_time: '22:00', end_time: '01:00' } : e.id === 'f' ? { ...e, carry: false } : e));
const input = (over: Partial<Parameters<typeof planMove>[0]> = {}) => planMove({ date: DATE, timezone: 'asia/makassar', now: NOW, stay: { place: 'Makassar', ends_on: '2026-11-05' }, routines: ROUTINES, entries: ENTRIES, stays: STAYS, ...over });

test('T1 the plan by value: ends renamed at date−1, copies at the row\'s times (midnight crosses, an empty window refuses), the re-zoned, the stay, the words — and every refusal by name', () => {
  // The list: current = active, end null or on/after the date; a start on/after the date or a one-off is re-zoned.
  assert.deepEqual(listRows(ROUTINES, DATE).map((row) => `${row.name}:${row.cadence}:${row.kind}`), ['Dinner:daily:ends', 'Gym:weekly:ends', 'Massage:once:rezoned', 'Later:daily:rezoned', 'Ends later:daily:ends']);
  assert.equal(isCurrent(ROUTINES[3], DATE), false, 'Pilates ended Oct 20 — not current on Oct 22');
  assert.equal(isCurrent(ROUTINES[3], '2026-10-20'), true, 'on its last day it is');
  assert.equal(isCurrent(ROUTINES[6], DATE), false, 'inactive is not the move\'s');
  // The defaults: the rule's clock (B1) and the row's end.
  assert.deepEqual(defaultEntry(ROUTINES[1]), { id: 'b', carry: true, start_time: '07:30', end_time: '08:30' });
  assert.equal(timeOf('1970-01-01T21:00:00.000Z'), '21:00'); assert.equal(timeOf(null), ''); assert.equal(timeOf(new Date(Date.UTC(1970, 0, 1, 7, 30))), '07:30');

  const p = input();
  assert.ok(p.ok, JSON.stringify(p));
  assert.equal(p.timezone, 'Asia/Makassar', 'the list\'s spelling (ROUTINE-02a)');
  assert.equal(p.day_before, '2026-10-21'); assert.equal(p.today, '2026-10-19');
  assert.deepEqual(p.ends.map((e) => [e.name, e.renamed, e.end_date, e.timezone]), [
    ['Dinner', 'Dinner (to 2026-10-21)', '2026-10-21', 'Asia/Bangkok'], ['Gym', 'Gym (to 2026-10-21)', '2026-10-21', 'Asia/Bangkok'], ['Ends later', 'Ends later (to 2026-10-21)', '2026-10-21', 'Asia/Bangkok'],
  ]);
  assert.equal(renamedWords('Gym', '2026-10-21'), 'Gym (to 2026-10-21)');
  // The copies: the row's clock in the rule (withClock), the window as given — Dinner's crosses midnight; Gym's first day is the Monday after a Thursday move.
  assert.deepEqual(p.copies, [
    { from_id: 'a', name: 'Dinner', schedule_rrule: 'FREQ=DAILY;BYHOUR=22;BYMINUTE=0;BYSECOND=0', start_time: '22:00', end_time: '01:00', start_date: DATE, end_date: null, first_day: DATE, overnight: true },
    { from_id: 'b', name: 'Gym', schedule_rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=7;BYMINUTE=30;BYSECOND=0', start_time: '07:30', end_time: '08:30', start_date: DATE, end_date: null, first_day: '2026-10-26', overnight: false },
  ]);
  assert.deepEqual(p.rezoned.map((z) => z.name), ['Massage', 'Later']);
  assert.deepEqual(p.rows.map((row) => [row.name, row.kind, row.carry, row.copy?.first_day ?? null]), [['Dinner', 'ends', true, DATE], ['Gym', 'ends', true, '2026-10-26'], ['Massage', 'rezoned', false, null], ['Later', 'rezoned', false, null], ['Ends later', 'ends', false, null]]);
  // The stay: Chiang Mai ran to Oct 31 — shortened to Oct 21; Makassar from the date to its last day.
  assert.deepEqual(p.stay, { shorten: { id: 's1', place: 'Chiang Mai', ends_on: '2026-10-21' }, create: { place: 'Makassar', starts_on: DATE, ends_on: '2026-11-05' } });
  assert.equal(p.words, '3 routines end 2026-10-21; 2 copies start 2026-10-22 in Asia/Makassar; 2 re-zoned; stay Makassar 2026-10-22 → 2026-11-05, Chiang Mai ends 2026-10-21');
  assert.equal(arrowWords('2026-10-26', 'Asia/Makassar'), '→ 2026-10-26 in Asia/Makassar');
  // The old end kept when on/after the date; a copy's end before the first occurrence refuses.
  const kept = planMove({ date: DATE, timezone: 'Asia/Makassar', now: NOW, stay: null, routines: ROUTINES, entries: ENTRIES.map((e) => (e.id === 'f' ? { ...e, carry: true } : e)), stays: STAYS });
  assert.ok(kept.ok); assert.equal(kept.copies.find((c) => c.name === 'Ends later')?.end_date, '2026-10-30');
  const weekly = planMove({ date: DATE, timezone: 'Asia/Makassar', now: NOW, stay: null, routines: [r({ id: 'w', name: 'Monday only', schedule_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=7;BYMINUTE=0;BYSECOND=0', end_date: '2026-10-24' })], entries: [{ id: 'w', carry: true, start_time: '07:00', end_time: '08:00' }], stays: [] });
  assert.deepEqual(weekly, { ok: false, status: 400, field: 'routines[0].id', message: noOccurrenceWords('Monday only', DATE, '2026-10-24') });
  // No stay change; a stay that meets another; the covering stay already ending at date−1 is not touched.
  const noStay = input({ stay: null }); assert.ok(noStay.ok); assert.equal(noStay.stay, null); assert.match(noStay.words, /; no stay change$/);
  assert.deepEqual(input({ stays: [...STAYS, { id: 's2', place: 'Bali', starts_on: '2026-11-01', ends_on: '2026-11-10' }] }), { ok: false, status: 409, field: 'stay', message: '2026-10-22 to 2026-11-05 meets the stay "Bali" (2026-11-01 to 2026-11-10)' });
  const exact = input({ stays: [{ id: 's1', place: 'Chiang Mai', starts_on: '2026-10-08', ends_on: '2026-10-21' }] }); assert.ok(exact.ok); assert.equal(exact.stay?.shorten, null);
  assert.deepEqual(input({ stay: { place: 'Makassar', ends_on: '2026-10-20' } }), { ok: false, status: 400, field: 'stay.ends_on', message: 'ends_on 2026-10-20 is before starts_on 2026-10-22' });
  assert.deepEqual(input({ stay: { place: '   ', ends_on: '2026-11-05' } }), { ok: false, status: 400, field: 'stay.place', message: 'required (a blank is no place)' });
  // Refusals by name: the date, a past date (today judged in the NEW zone), the zone (no default), an empty window, a blank time, a missing or unknown entry, a double.
  assert.deepEqual(input({ date: '22/10/2026' }), { ok: false, status: 400, field: 'date', message: "first day there \"22/10/2026\" is not a 'YYYY-MM-DD' day" });
  assert.deepEqual(input({ date: '2026-10-18', entries: entriesFor('2026-10-18') }), { ok: false, status: 400, field: 'date', message: pastDateWords('2026-10-18', '2026-10-19', 'Asia/Makassar') });
  assert.ok(input({ date: '2026-10-19', entries: entriesFor('2026-10-19') }).ok, 'today is allowed — "I am moving today"');
  assert.deepEqual(input({ timezone: '' }), { ok: false, status: 400, field: 'timezone', message: 'timezone "" is not one of Intl\'s zone names — pick one from the list' });
  assert.deepEqual(input({ timezone: 'UTC' }).ok, false);
  assert.deepEqual(input({ entries: ENTRIES.map((e) => (e.id === 'a' ? { ...e, end_time: '22:00' } : e)) }), { ok: false, status: 400, field: 'routines[0].end_time', message: `Dinner: ${EMPTY_WINDOW_WORDS}` });
  assert.deepEqual(input({ entries: ENTRIES.map((e) => (e.id === 'b' ? { ...e, start_time: '' } : e)) }), { ok: false, status: 400, field: 'routines[1].start_time', message: "Gym: start time is required — it is the routine's time" });
  assert.deepEqual(input({ entries: ENTRIES.map((e) => (e.id === 'b' ? { ...e, end_time: '' } : e)) }), { ok: false, status: 400, field: 'routines[1].end_time', message: 'Gym: end time is required when a start time is set — the window' });
  assert.deepEqual(input({ entries: ENTRIES.filter((e) => e.id !== 'b') }), { ok: false, status: 400, field: 'routines', message: notListedWords('Gym') });
  assert.deepEqual(input({ entries: [...ENTRIES, { id: 'g', carry: true, start_time: '09:00', end_time: '10:00' }] }), { ok: false, status: 404, field: 'routines[5].id', message: 'no current routine "g"' });
  assert.deepEqual(input({ entries: [...ENTRIES, ENTRIES[0]] }), { ok: false, status: 400, field: 'routines[5].id', message: 'Dinner is listed twice' });
  // An unticked re-zoned row needs no times: the entry's times are ignored for it.
  assert.ok(input({ entries: ENTRIES.map((e) => (e.id === 'c' ? { ...e, start_time: '', end_time: '' } : e)) }).ok);
  assert.equal(moveWords({ ends: [1], copies: [], rezoned: [], date: DATE, day_before: '2026-10-21', timezone: 'Asia/Makassar', stay: null }), '1 routine ends 2026-10-21; 0 copies start 2026-10-22 in Asia/Makassar; 0 re-zoned; no stay change');
  assert.equal(hasHistoryWords('Later'), 'Later starts on or after the move and already holds records — re-zone it from its own row (its history would move)');
  assert.equal(nameTakenWords('Gym'), 'a routine named "Gym" already exists');
  assert.match(comments(PLAN), /MOVE-01, Alex, 2026-10-19/);
  assert.doesNotMatch(code(PLAN), /prisma|fetch\(|localStorage|Date\.now\(\)/, 'pure: no read, no clock of its own (now is given)');
});

test('T2 the route: the stops GET\'s auth order, every query by user_id, no defaults, ONE transaction with every old routine held, the re-zoned proven empty, the copy without the old city, the money through the rule, the stays, the refusals, the audits, the answer', () => {
  const s = code(ROUTE);
  const order = ['getVerifiedEmail()', "{ status: 401 }", 'prisma.users.findFirst(', "{ status: 404 }", 'request.json()', 'readEntries(body.routines)', 'prisma.operations_routines.findMany({', 'prisma.operations_stays.findMany({ where: { user_id: user.id }', 'planMove({ date, timezone, now, stay, routines, entries: read.entries, stays })', 'prisma.$transaction(async (tx) => {', 'await lockRoutine(tx, e.id, user.id)', 'await lockRoutine(tx, z.id, user.id)', 'await proveNoHistory(tx, user.id,', 'tx.operations_routines.update({', 'tx.operations_routines.create({', 'tx.operations_routine_steps.createMany({', 'tx.operations_stays.update({', 'tx.operations_stays.create({', "type: 'operations_routine_updated'", "type: 'operations_routine_created'", "type: 'operations_stay_set'", "type: 'operations_routines_moved'", 'return NextResponse.json({ moved })'];
  let at = -1;
  for (const step of order) { const i = s.indexOf(step, at + 1); assert.ok(i > at, `${step} follows ${order[order.indexOf(step) - 1] ?? 'the start'}`); at = i; }
  assert.equal((s.match(/\$transaction\(/g) ?? []).length, 1, 'one transaction');
  assert.match(s, /where: \{ user_id: user\.id, is_active: true \},\n\s*include: \{ steps: \{ where: \{ is_active: true \}, orderBy: \{ step_order: 'asc' \} \} \}/, 'the caller\'s active routines with their active lines');
  // No defaults: the date and the zone are the caller's strings or '' — the plan refuses '' by name.
  assert.match(s, /const date = typeof body\.date === 'string' \? body\.date : '';/);
  assert.match(s, /const timezone = typeof body\.timezone === 'string' \? body\.timezone : '';/);
  assert.doesNotMatch(s, /tomorrow|DEFAULT_|\?\? 'Asia|resolvedOptions/, 'nothing filled in');
  // Every query names the caller.
  for (const m of s.matchAll(/(?:prisma|tx)\.(\w+)\.(findMany|findFirst|count|update|create|createMany)\(\{[\s\S]*?\}\)/g)) {
    if (m[1] === 'users') continue;
    assert.match(m[0], /user_id: (?:user\.id|userId)/, `${m[1]}.${m[2]} names the caller: ${m[0].slice(0, 80)}`);
  }
  // The ends first (the copy takes the bare name), renamed, bounded; then the copies without the old city; then the re-zoned; then the stays.
  assert.ok(s.indexOf('data: { name: e.renamed, end_date: endDate, next_due_at: nextDueAfter(') < s.indexOf('tx.operations_routines.create({'), 'ends before copies');
  assert.match(s, /name: c\.name,\n\s*description: from\.description,\n\s*schedule_rrule: c\.schedule_rrule,\n\s*timezone: plan\.timezone,/);
  assert.match(s, /location: null,\n\s*latitude: null,\n\s*longitude: null,/, 'no place for the copy');
  assert.doesNotMatch(s, /planned_item_vendors\.(create|update)/, 'no vendor for the copy');
  assert.match(s, /budget_amount: money\.routine\.amount,\n\s*coa_code: money\.routine\.coaCode,/, 'the routine\'s money through the rule');
  assert.match(s, /budget_amount: money\.lines\[i\]\.amount,\n\s*coa_code: money\.lines\[i\]\.coaCode,/, 'each line\'s money through the rule');
  assert.match(s, /duration_minutes: s\.duration_minutes,\n\s*time_of_day: s\.time_of_day,\n\s*notes: s\.notes,/, 'the lines\' fields copied');
  assert.doesNotMatch(s.slice(s.indexOf('createMany'), s.indexOf('createMany') + 700), /location: s\.location/, 'a line\'s location is the old city\'s');
  assert.match(s, /data: \{ timezone: plan\.timezone, next_due_at: nextDueAfter\(/, 'the re-zoned: the zone alone, next due recomputed');
  // The re-zoned proven empty — all four instant-keyed tables.
  const prove = s.slice(s.indexOf('async function proveNoHistory'), s.indexOf('export async function POST'));
  for (const t of ['operations_routine_completions.count', 'operations_stop_records.count', 'planned_item_vendors.count', 'planned_item_links.count']) assert.ok(prove.includes(t), t);
  assert.match(prove, /throw new MoveRefused\(409, 'routines', hasHistoryWords\(routine\.name\)\)/);
  // The refusals: the plan's, the transaction's, a name taken, a stay race.
  assert.match(s, /if \(!plan\.ok\) \{\n\s*return NextResponse\.json\(\{ error: plan\.status === 409 \? 'Conflict' : plan\.status === 404 \? 'Not found' : 'Validation', field: plan\.field, message: plan\.message \}, \{ status: plan\.status \}\);/);
  assert.match(s, /if \(error instanceof MoveRefused\)/);
  assert.match(s, /error\.code === 'P2002'/);
  assert.match(s, /error\.message\.includes\(OVERLAP_TAG\)/);
  assert.match(s, /\{ timeout: 60000 \}/);
  // The audits after the write: one per ended, copy, re-zoned and stay, then the move once with every pair by id.
  assert.equal((s.match(/type: 'operations_routine_updated'/g) ?? []).length, 2, 'ended and re-zoned');
  assert.equal((s.match(/type: 'operations_stay_set'/g) ?? []).length, 2, 'shortened and opened');
  assert.equal((s.match(/type: 'operations_routines_moved'/g) ?? []).length, 1);
  assert.match(s, /ended: pairs\.map\(\(p\) => \(\{ id: p\.from\.id, from_zone: p\.from\.timezone, copy_id: p\.copy === null \? 'no copy' : p\.copy\.id \}\)\)/);
  assert.match(s, /moved_by: 'operations_routines_moved'/);
  assert.match(s, /copied_from: from\.id/);
  // The answer lists every pair by name.
  assert.match(s, /return \{ from: \{ id: before\.id, name: before\.name, renamed: after\.name, timezone: before\.timezone \}, copy: copy === null \? null : \{ id: copy\.row\.id, name: copy\.row\.name, lines: copy\.lines \} \};/);
  assert.match(s, /failClosedResponse\('Routines move POST'/);
  assert.doesNotMatch(s, /^export const /m, 'a route file exports its handlers alone');
  assert.match(comments(ROUTE), /MOVE-01, Alex, 2026-10-19/);
  assert.equal(BODY_WORDS, 'the body must be an object with date, timezone, stay and routines');
});

test('T3 the control: "moving" beside the day controls, the form, the one zone picker with no default, the list grouped as the routine list is, the plan\'s words from the one rule, confirm then a full load, cancel writes nothing, nothing stored', () => {
  const c = code(CONTROL);
  const card = code(CARD);
  // Mounted as a SIBLING right after the day controls' div — deck01's "the day controls, and nothing else" stands.
  assert.match(card, /\{TODAY_WORD\}<\/button>\n\s*<\/div>\n\s*(?:\{\s*\}\s*)?<MoveControl today=\{today\} \/>\n\s*<\/div>/, 'the chip right after the controls\' div (the JSX note between is stripped to braces)');
  assert.match(card, /import MoveControl from '\.\.\/stops\/MoveControl';/);
  // The chip and the form.
  assert.equal(MOVE_CHIP_WORDS, 'moving');
  assert.match(c, /<button type="button" className=\{chip\} disabled=\{today === null \|\| open\} onClick=\{start\} title=\{MOVE_TITLE_WORDS\} data-move-open>\{MOVE_CHIP_WORDS\}<\/button>/);
  assert.match(c, /setDate\(shiftDay\(today, 1\)\);/, 'the date seeded with tomorrow (R1)');
  assert.match(c, /<input type="date" value=\{date\}[\s\S]{0,120}?required data-move-date \/>/);
  assert.match(c, /<ZoneSelect value=\{zone\} onChange=\{setZone\}[\s\S]{0,80}?unpickedWords=\{PICK_ZONE_WORDS\} data-move-zone \/>/, 'the one picker, no default');
  assert.match(c, /const \[zone, setZone\] = useState\(''\);/);
  assert.match(c, /data-move-place/); assert.match(c, /data-move-last-day/);
  // The list: the one rule's rows, grouped in the routine list's order with its labels; carry · start · end · the arrow; re-zoned rows with no box.
  assert.match(c, /const rows = date === '' \? \[\] : listRows\(active, date\);/);
  assert.match(c, /CADENCE_GROUP_ORDER\.map\(\(g\) => \{/); assert.match(c, /\{CADENCE_GROUP_LABELS\[g\]\} \(\{group\.length\}\)/);
  assert.match(c, /data-move-carry/); assert.match(c, /type="time" value=\{e\.start_time\}[\s\S]{0,160}?disabled=\{!e\.carry\}[\s\S]{0,60}?data-move-start/); assert.match(c, /type="time" value=\{e\.end_time\}[\s\S]{0,160}?disabled=\{!e\.carry\}[\s\S]{0,60}?data-move-end/);
  assert.match(c, /data-move-rezoned>\{REZONED_WORDS\}/); assert.equal(REZONED_WORDS, 're-zoned, same clock');
  assert.match(c, /arrowWords\(planned\.copy\.first_day,/);
  assert.match(c, /data-move-tasks>\{TASKS_WORDS\}/); assert.equal(TASKS_WORDS, 'project tasks carry no zone — nothing to move');
  // The plan in words BEFORE the write — the same planMove the route fires; its refusal shown.
  assert.match(c, /const plan = ready \? planMove\(\{ date, timezone: zone, now: new Date\(\), stay, routines: active, entries, stays: stays\.value \}\) : null;/);
  assert.match(c, /data-move-plan>\{plan\.words\}/); assert.match(c, /data-move-refused>\{plan\.message\}/);
  assert.match(c, /const entryOf = \(id: string\): MoveEntry => edited\.get\(id\) \?\? defaultEntry\(/, 'the defaults from the one rule');
  // Confirm posts the list; written → a full load of the new day; refused → the route's words. Cancel resets, writes nothing.
  assert.match(c, /disabled=\{busy \|\| plan === null \|\| !plan\.ok\} data-move-confirm/);
  assert.match(c, /fetch\('\/api\/operations\/routines\/move', \{\n\s*method: 'POST',/);
  assert.match(c, /body: JSON\.stringify\(\{ date: plan\.date, timezone: plan\.timezone, stay, routines: entries \}\),/);
  assert.match(c, /window\.location\.assign\(`\/tasks\?date=\$\{plan\.date\}`\);/);
  assert.match(c, /setRefusal\(`\$\{MOVE_FAILED_WORDS\}: \$\{body\?\.message \?\? body\?\.error \?\? `\$\{res\.status\}`\}`\);/);
  assert.match(c, /onClick=\{reset\} data-move-cancel>cancel<\/button>/);
  assert.doesNotMatch(c, /localStorage|sessionStorage|document\.cookie/, 'nothing stored');
  assert.match(c, /readJson\('\/api\/operations\/routines\?is_active=true'\)/); assert.match(c, /readJson\('\/api\/operations\/stays'\)/);
  assert.match(comments(CONTROL), /MOVE-01, Alex, 2026-10-19/);
  // The picker: an empty value shows the unpicked words first; the rest as ROUTINE-02a built it (routine02a pins the markup).
  const z = code(ZONE_SELECT);
  assert.match(z, /value === '' && unpickedWords !== undefined\n\s*\? <option value="" data-zone-unpicked>\{unpickedWords\}<\/option>/);
  assert.match(comments(ZONE_SELECT), /extracted\s*\n?\s*\*?\s*by MOVE-01/);
});

test('T4 the window may cross midnight: the create route and the PATCH refuse only an EMPTY window, by the one words; the hub grid\'s marker is the reader that meets it', () => {
  assert.equal(EMPTY_WINDOW_WORDS, 'end_time equals start_time — the window is empty; an end before the start ends the next day');
  const create = code(CREATE_ROUTE);
  assert.match(create, /startTimeResult\.value\.getTime\(\) === endTimeResult\.value\.getTime\(\)\n\s*\) \{\n\s*return NextResponse\.json\(\n\s*\{ error: 'Validation', field: 'end_time', message: EMPTY_WINDOW_WORDS \}/);
  assert.doesNotMatch(create, />= endTimeResult|must be after start_time/);
  const patch = code(PATCH_ROUTE);
  assert.match(patch, /effectiveStartTime\.getTime\(\) === effectiveEndTime\.getTime\(\)\) \{\n\s*return NextResponse\.json\(\n\s*\{ error: 'Validation', field: 'end_time', message: EMPTY_WINDOW_WORDS \}/);
  assert.doesNotMatch(patch, />= effectiveEndTime|must be after start_time/);
  // The one reader that could assume end after start marks it instead (extent.ts, DAY-01): pinned, not changed.
  assert.match(code('src/lib/calendar/extent.ts'), /if \(endMin < startMin\) return \{ startMin, endMin: startMin \+ MARKER_MINUTES, flag: 'end-before-start' \};/);
  assert.match(comments(HELPERS), /MOVE-01 \(Alex, 2026-10-19\): the window may cross midnight/);
});

test('T5 the audit type: the enum value last, the one ADD VALUE line applied at deploy, the client knows it, the audit log lists it; the one-off law names the plan as an anchored caller', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261018120000_routine_02b_rekeyed_audit_type');
  const sql = code(MIGRATION);
  assert.equal(sql.trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routines_moved';`, 'the one line and nothing else');
  assert.match(comments(MIGRATION), /applied at deploy/);
  const schema = code(SCHEMA);
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  assert.equal(values[values.length - 1], 'operations_routines_moved');
  assert.equal(values[values.length - 2], 'operations_routine_rekeyed');
  assert.equal(values.filter((v) => v === 'operations_routines_moved').length, 1);
  assert.equal(AuditActionType.operations_routines_moved, 'operations_routines_moved', 'prisma generate ran');
  assert.match(code(AUDIT_ROUTE), /'operations_routine_rekeyed',\s*'operations_routines_moved',\s*\],/);
  // The law: the plan is a named, anchored caller (the law's own words say how a caller registers).
  assert.match(code(LAW), /'src\/lib\/budget\/days\.ts',\n\s*'src\/lib\/operations\/routineMove\.ts',\n\];/);
  assert.match(comments(LAW), /MOVE-01 \(2026-10-19\): the move's plan expands a copy's rule once/);
  const calls = [...code(PLAN).matchAll(/expand(?:Forward|Between)\([^;]*;/g)].map((m) => m[0]);
  assert.equal(calls.length, 1, 'one expansion in the plan'); assert.match(calls[0], /scheduleAnchor\(date\)/);
});
