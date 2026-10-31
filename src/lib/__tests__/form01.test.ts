/**
 * FORM-01 (Alex, 2026-10-19) — the routine form asks days · time · amount ·
 * account, nothing about where; the list shows those and is sorted by time.
 *
 * T1 the rule ↔ form round trip by value: every stored shape opens in its
 *    matching days choice when its parts equal the choice's compiled parts as
 *    a set; anything else opens as Custom rule; withDays sets the wire fields.
 * T2 the words by value: cadence, days, time, the clock order.
 * T3 the forms' source: the order, the days control, no place, "more", the
 *    row's unchanged guard, nothing of the place sent.
 * T4 the list's source: one flat table in clock order with the six columns
 *    and the controls; the routine's own row, the lines under it.
 * T5 the geo law: no routine form mounts the lookup; the component and the
 *    route stand; nothing under src/app/api or prisma changed by this PR's
 *    rule (the routes still accept the place).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { code, comments } from '../sourceText';
import { DAYS_CHOICE_LABELS, DAYS_CHOICE_ORDER, DEFAULT_ROUTINE_FORM, MONTHLY_KIND_LABELS, WEEKDAYS, WEEKEND, type RoutineForm } from '../../components/workbench/operations/routines/types';
import {
  byClockThenName, cadenceWords, clockMinutesOf, compileFormToRRule, daysWords, dayWords, formOfRule, nthWords, ordinalWords, ruleParts, samePartSet, timeWords, withDays,
} from '../operations/rruleHelpers';

const BUILDER = 'src/components/workbench/operations/routines/RRULEBuilder.tsx';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
// WORK-01 (Alex, 2026-10-24): RoutineRow left — its edit form is RoutineEditForm (lifted, moved code); ROW names it.
const ROW = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const WORK_LIB = 'src/lib/operations/work.ts'; // WORK-01 (2026-10-24): RoutineList left — the routines are rows of THE WORK
const LINES = 'src/components/workbench/operations/routines/RoutineStepList.tsx';
const TYPES = 'src/components/workbench/operations/routines/types.ts';
const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const LAW = 'scripts/assert-tool-registry.ts';

/** The fixture shapes: every rule the local rows and the tests have held. */
const SHAPES: readonly [string, string | null, string, string, string][] = [
  // rule, start_date, days choice, cadence_mode, the Days column
  ['FREQ=DAILY;BYHOUR=11;BYMINUTE=0;BYSECOND=0', null, 'every_day', 'daily', 'Mon–Sun'],
  ['FREQ=DAILY;BYSECOND=0;BYHOUR=18;BYMINUTE=0', '2026-10-12', 'every_day', 'daily', 'Mon–Sun'],
  ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0', null, 'weekdays', 'weekly', 'Mon–Fri'],
  ['FREQ=WEEKLY;BYDAY=SA,SU;BYHOUR=10;BYMINUTE=30;BYSECOND=0', null, 'weekends', 'weekly', 'Sat–Sun'],
  ['FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=20;BYMINUTE=0;BYSECOND=0', null, 'pick_days', 'weekly', 'Mon, Wed, Fri'],
  ['FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0;BYSECOND=0', null, 'monthly', 'monthly_day_of_month', '15th'],
  ['FREQ=MONTHLY;BYDAY=2TU;BYHOUR=9;BYMINUTE=0;BYSECOND=0', null, 'monthly', 'monthly_nth_weekday', '2nd Tue'],
  ['FREQ=MONTHLY;BYDAY=-1FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0', null, 'monthly', 'monthly_nth_weekday', 'last Fri'],
  ['FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', '2026-10-24', 'once', 'once', 'Oct 24, 2026'],
  ['FREQ=WEEKLY;BYDAY=FR,MO;BYHOUR=20;BYMINUTE=0;BYSECOND=0', null, 'custom', 'custom', '—'],
  ['FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0;BYSECOND=0', null, 'custom', 'custom', '—'],
  ['FREQ=DAILY;INTERVAL=2;BYHOUR=7;BYMINUTE=0;BYSECOND=0', null, 'custom', 'custom', '—'],
  ['FREQ=DAILY', null, 'custom', 'custom', '—'],
];

const clockOf = (rule: string) => { const h = /BYHOUR=(\d+)/.exec(rule); const m = /BYMINUTE=(\d+)/.exec(rule); return h ? `${h[1].padStart(2, '0')}:${(m?.[1] ?? '0').padStart(2, '0')}` : ''; };

test('T1 the round trip by value: a stored rule opens in the matching days choice when its parts equal the choice\'s compiled parts as a set — and compiles back to the same parts; else Custom rule, verbatim', () => {
  assert.deepEqual([...ruleParts('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=9;BYMINUTE=0;BYSECOND=0').entries()], [['FREQ', 'WEEKLY'], ['BYDAY', 'MO,WE'], ['BYHOUR', '9'], ['BYMINUTE', '0'], ['BYSECOND', '0']]);
  assert.equal(samePartSet('FREQ=DAILY;BYSECOND=0;BYHOUR=18;BYMINUTE=0', 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0;BYSECOND=0'), true, 'order ignored');
  assert.equal(samePartSet('FREQ=DAILY;BYHOUR=18;BYMINUTE=0', 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0;BYSECOND=0'), false, 'a missing part differs');
  assert.equal(samePartSet('FREQ=WEEKLY;BYDAY=MO,FR', 'FREQ=WEEKLY;BYDAY=FR,MO'), false, 'values compared as given');
  for (const [rule, sd, days, mode, words] of SHAPES) {
    const f = formOfRule(rule, sd);
    assert.equal(f.days, days, rule);
    assert.equal(f.cadence_mode, mode, rule);
    if (days === 'custom') {
      assert.equal(f.custom_rrule, rule, 'Custom rule holds the stored rule verbatim');
    } else {
      assert.equal(f.custom_rrule, '', 'a structured choice carries no raw rule');
      const back = compileFormToRRule({ ...DEFAULT_ROUTINE_FORM, ...f, start_date: sd ?? '', start_time: clockOf(rule), byhour: '', byminute: '' });
      assert.equal(samePartSet(back, rule), true, `${rule} ↔ ${back}: the same parts`);
    }
    assert.equal(daysWords(rule, sd), words, rule);
  }
  // The weekday fields as opened: Mon–Fri reads as Weekdays, Sat–Sun as Weekends, anything else as Pick days with those toggles on.
  assert.deepEqual(formOfRule(SHAPES[2][0], null).weekly_byday, ['MO', 'TU', 'WE', 'TH', 'FR']);
  assert.deepEqual(formOfRule(SHAPES[4][0], null).weekly_byday, ['MO', 'WE', 'FR']);
  assert.deepEqual([formOfRule(SHAPES[6][0], null).monthly_nth, formOfRule(SHAPES[6][0], null).monthly_weekday], ['2', 'TU']);
  assert.equal(formOfRule(SHAPES[5][0], null).monthly_day_of_month, '15');
  // A one-off without its date cannot compile (ONEOFF-01) — it opens as Custom rule rather than pretending.
  assert.equal(formOfRule(SHAPES[8][0], null).days, 'custom');
  // withDays: the choice sets the wire fields; the four day choices compile to the existing rule shapes only.
  const base: RoutineForm = { ...DEFAULT_ROUTINE_FORM, start_time: '09:00', byhour: '09', byminute: '00' };
  assert.equal(compileFormToRRule(withDays(base, 'every_day')), 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0');
  assert.equal(compileFormToRRule(withDays(base, 'weekdays')), 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0');
  assert.equal(compileFormToRRule(withDays(base, 'weekends')), 'FREQ=WEEKLY;BYDAY=SA,SU;BYHOUR=9;BYMINUTE=0;BYSECOND=0');
  assert.equal(compileFormToRRule(withDays({ ...base, weekly_byday: ['MO', 'WE', 'FR'] }, 'pick_days')), 'FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0');
  assert.equal(withDays(base, 'pick_days').weekly_byday, base.weekly_byday, 'Pick days keeps the toggles as they are');
  assert.equal(withDays(base, 'monthly').cadence_mode, 'monthly_day_of_month');
  assert.equal(withDays({ ...base, cadence_mode: 'monthly_nth_weekday' }, 'monthly').cadence_mode, 'monthly_nth_weekday', 'a monthly shape already chosen is kept');
  assert.equal(withDays(base, 'once').cadence_mode, 'once');
  assert.deepEqual([withDays(base, 'custom').cadence_mode, withDays(base, 'custom').custom_rrule], ['custom', 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0'], 'Custom rule is seeded with the rule the form compiles to');
  assert.equal(withDays({ ...base, custom_rrule: 'FREQ=HOURLY' }, 'custom').custom_rrule, 'FREQ=HOURLY', 'a typed rule is kept');
  assert.equal(withDays({ ...DEFAULT_ROUTINE_FORM, start_time: '' }, 'custom').custom_rrule, '', 'no start time: nothing is seeded');
  assert.deepEqual(DAYS_CHOICE_ORDER, ['every_day', 'weekdays', 'weekends', 'pick_days', 'once', 'monthly', 'custom']);
  assert.deepEqual(DAYS_CHOICE_LABELS, { every_day: 'Every day', weekdays: 'Weekdays (Mon–Fri)', weekends: 'Weekends (Sat–Sun)', pick_days: 'Pick days', once: 'Once (a date)', monthly: 'Monthly', custom: 'Custom rule' });
  assert.deepEqual([WEEKDAYS, WEEKEND], [['MO', 'TU', 'WE', 'TH', 'FR'], ['SA', 'SU']]);
  assert.deepEqual(Object.keys(MONTHLY_KIND_LABELS), ['monthly_day_of_month', 'monthly_nth_weekday']);
  assert.equal(DEFAULT_ROUTINE_FORM.days, 'every_day');
});

test('T2 the words by value: cadence, days, time, the clock order', () => {
  assert.deepEqual(SHAPES.map(([rule]) => cadenceWords(rule)), ['daily', 'daily', 'weekly', 'weekly', 'weekly', 'monthly', 'monthly', 'monthly', 'once', 'weekly', 'quarterly', 'daily', 'daily']);
  assert.equal(timeWords({ schedule_rrule: SHAPES[0][0], end_time: '1970-01-01T12:00:00.000Z' }), '11:00 – 12:00');
  assert.equal(timeWords({ schedule_rrule: SHAPES[0][0], end_time: null }), '11:00');
  assert.equal(timeWords({ schedule_rrule: 'FREQ=DAILY', end_time: '1970-01-01T12:00:00.000Z' }), '—', 'no clock, no window');
  assert.equal(timeWords({ schedule_rrule: SHAPES[1][0], end_time: new Date(Date.UTC(1970, 0, 1, 18, 30)) }), '18:00 – 18:30');
  // The list hands the words a @db.Date's JSON ('2026-10-24T00:00:00.000Z'); the row hands a day — both open the one-off and print its date.
  assert.equal(daysWords(SHAPES[8][0], '2026-10-24T00:00:00.000Z'), 'Oct 24, 2026'); assert.equal(formOfRule(SHAPES[8][0], new Date('2026-10-24T00:00:00.000Z')).days, 'once');
  assert.equal(dayWords('2026-10-24'), 'Oct 24, 2026'); assert.equal(dayWords(new Date('2026-01-05T00:00:00.000Z')), 'Jan 5, 2026'); assert.equal(dayWords(null), '—');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalWords), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
  assert.deepEqual([1, 2, -1, -2].map(nthWords), ['1st', '2nd', 'last', '2nd last']);
  assert.equal(clockMinutesOf('FREQ=DAILY;BYHOUR=6;BYMINUTE=30'), 390); assert.equal(clockMinutesOf('FREQ=DAILY'), null);
  const rows = [
    { name: 'Night walk', schedule_rrule: 'FREQ=DAILY;BYHOUR=22;BYMINUTE=0' },
    { name: 'Brunch', schedule_rrule: 'FREQ=DAILY;BYHOUR=11;BYMINUTE=0' },
    { name: 'Zed', schedule_rrule: 'FREQ=DAILY' },
    { name: 'Journal', schedule_rrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0' },
    { name: 'Stretch', schedule_rrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=30' },
    { name: 'Alpha', schedule_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=11;BYMINUTE=0' },
  ];
  assert.deepEqual([...rows].sort(byClockThenName).map((r) => r.name), ['Journal', 'Stretch', 'Alpha', 'Brunch', 'Night walk', 'Zed'], 'by the clock, then name, no clock last');
  assert.match(comments(HELPERS), /FORM-01 \(Alex, 2026-10-19\): THE DAYS CONTROL/);
});

test('T3 the forms: in order — name · on the day card · entity · days · time · amount + account · active from / until · timezone · more; the days control; no place anywhere; nothing of it sent; the row opens in the matching choice and a save without a change writes nothing', () => {
  const b = code(BUILDER);
  // The days control: the seven choices from the one order; its own fields per choice; the time row.
  assert.match(b, /<select\n\s*value=\{form\.days\}\n\s*onChange=\{\(e\) => setForm\(withDays\(form, e\.target\.value as DaysChoice\)\)\}\n\s*className=\{inputClass\}\n\s*data-routine-days-select\n\s*>\n\s*\{DAYS_CHOICE_ORDER\.map\(\(c\) => \(/);
  assert.match(b, /\{form\.days === 'pick_days' && \(\n\s*<div data-routine-pick-days>/);
  assert.match(b, /\{form\.days === 'once' && \(/); assert.match(b, /data-routine-once-date/);
  assert.match(b, /\{form\.days === 'monthly' && \(/); assert.match(b, /data-routine-monthly-kind/);
  assert.match(b, /\{form\.days === 'custom' && \(/); assert.match(b, /data-routine-custom-rule/);
  assert.match(b, /export function DaysField\(/); assert.match(b, /export function TimeField\(/);
  assert.doesNotMatch(b, /CADENCE_MODE_LABELS|cadence_mode: e\.target\.value as CadenceMode|ZoneSelect|MISSED_AFTER_WORDS\}<|ideal_time_label|location|latitude/, 'the builder is days and time alone');
  assert.match(comments(BUILDER), /FORM-01, Alex, 2026-10-19/);
  // The forms: the order, by the fields' first appearance; no place; "more" closed by default.
  for (const [f, v, setter] of [[CREATE_FORM, 'createForm', 'setCreateForm'], [ROW, 'form', 'setForm']] as const) {
    const s = code(f);
    const formAt = f === ROW ? s.indexOf('data-routine-editing>') : s.indexOf('data-routine-create-form');
    const body = s.slice(formAt);
    const order = [`value={${v}.name}`, `value={${v}.role}`, `value={${v}.entity_id}`, `<DaysField form={${v}} setForm={setForm} />`, `<TimeField form={${v}} setForm={setForm} />`, `value={${v}.budget_amount ?? ''}`, '<CoaSelect', `value={${v}.start_date}`, `value={${v}.end_date}`, `<ZoneSelect`, 'data-routine-more>', `value={${v}.description}`, `value={${v}.ideal_time_label}`, '{MISSED_AFTER_WORDS}', `value={${v}.fail_threshold_minutes}`];
    let at = -1;
    for (const piece of order) { const i = body.indexOf(piece, at + 1); assert.ok(i > at, `${f}: ${piece} follows ${order[order.indexOf(piece) - 1] ?? 'the start'}`); at = i; }
    assert.doesNotMatch(s, /FindThisPlace|data-routine-location|data-routine-latitude|data-routine-longitude|picked|PlaceMatch|find-place/, `${f}: nothing about where`);
    assert.match(s, /const \[more, setMore\] = useState\(false\);/, `${f}: "more" is closed, React state only`);
    assert.match(s, /\{more && \(\n\s*<div className="mt-2 grid grid-cols-2 gap-3" data-routine-more-fields>/);
    assert.match(s, /location: undefined,\n\s*latitude: undefined,\n\s*longitude: undefined,/, `${f}: nothing of the place is sent`);
    assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie/);
    assert.match(comments(f), /FORM-01 \(Alex, 2026-10-19\)/);
    void setter;
  }
  // The row: opens in the matching choice; a save equal to the seeded form writes nothing.
  const row = code(ROW);
  assert.match(row, /export function routineToForm\(r: Routine\): RoutineForm \{/);
  assert.match(row, /\.\.\.formOfRule\(r\.schedule_rrule, r\.start_date \? r\.start_date\.slice\(0, 10\) : null\),/);
  assert.match(row, /const handleSave = async \(\) => \{\s*if \(JSON\.stringify\(form\) === JSON\.stringify\(routineToForm\(routine\)\)\) \{\s*setError\(null\);\s*onClose\(\);\s*return;\s*\}/, 'the unchanged guard, before any request');
  assert.doesNotMatch(row, /data-routine-place-view|formatTime12h|intent time window/, 'the place block and the time range left the cell');
  assert.match(row, /data-routine-zone/); assert.match(row, /data-routine-next-due/); assert.match(row, /fail threshold \{routine\.fail_threshold_minutes\} min/); assert.match(row, /data-routine-last-done/);
  // The create form's lines sit with the money, before the dates.
  const c = code(CREATE_FORM);
  assert.ok(c.indexOf('data-routine-lines') > c.indexOf('<CoaSelect') && c.indexOf('data-routine-lines') < c.indexOf('data-routine-start-date'));
  assert.match(code(TYPES), /days: DaysChoice;/); assert.match(comments(TYPES), /FORM-01 \(Alex, 2026-10-19\): DAYS IS ONE CONTROL/);
});

test('T4 the list: WORK-01 (Alex, 2026-10-24) — the routines are rows of THE WORK in clock order; the lines\' FORM-01 table lives in the editor; the ended routines are a STATUS', () => {
  const f = code(ROW);
  assert.deepEqual([...f.matchAll(/<th\b[^>]*>([^<]*)</g)].map((m) => m[1]), ['Routine', 'Cadence', 'Days', 'Time', 'Amount', 'Account', '']);
  assert.match(code(LINES), /export const ROUTINE_TABLE_COLUMNS = 7;/);
  const w = code(WORK_LIB);
  assert.match(w, /for \(const routine of \[\.\.\.routines\]\.sort\(byClockThenName\)\) \{/, 'clock order then name');
  // WORK-01d (Alex, 2026-10-25): the routines are ROUTINE EXPENSES' rows (RoutineRow, no `of` — tasks have their own table), so CADENCE reads the rule bare.
  assert.match(w, /export const routineCadenceOf = \(row: RoutineRow\): string => cadenceWords\(row\.routine\.schedule_rrule\);/, 'CADENCE is cadenceWords');
  assert.match(w, /const words = daysWords\(row\.routine\.schedule_rrule, row\.routine\.start_date\);/, 'DAYS is daysWords');
  assert.match(w, /const words = timeWords\(row\.routine\);/, 'TIME is timeWords');
  assert.doesNotMatch(w, /groupOf|CADENCE_GROUP_ORDER|CADENCE_GROUP_LABELS|data-cadence-group/, 'no cadence groups, no second classifier');
  // WORK-01d: KIND left with the merged table — a Once routine is told by CADENCE "once". ROUTINES-03 (Alex, 2026-10-25, ruling B): KIND is back as ROUTINE
  // EXPENSES' own column, read by ONEOFF-01's one rule (isOnceRRule) — the pin moved from "no isOnceRRule" to "isOnceRRule, in KIND alone".
  assert.match(w, /export const routineKindOf = \(row: RoutineRow\): string => \(isOnceRRule\(row\.routine\.schedule_rrule\) \? KIND_WORDS\.once : KIND_WORDS\.repeated\);/);
  assert.equal((w.match(/isOnceRRule\(/g) ?? []).length, 1, 'the one rule, once — CADENCE still reads cadenceWords');
  assert.match(code(HELPERS), /export const cadenceWords = \(rrule: string\): string => CADENCE_GROUP_LABELS\[classifyCadence\(rrule\)\]\.toLowerCase\(\);/);
  assert.match(code(HELPERS), /if \(parsed\.options\.count === 1\) return 'once';/, 'cadenceWords says once by the one rule (ONEOFF-01: one occurrence, whatever its FREQ)');
  assert.match(w, /end\.ended \? 'ended' : routine\.is_active \? 'active' : 'inactive'/, 'the ENDED group is a STATUS (ROUTINE-02a)');
  const lines = code(LINES);
  assert.match(lines, /<tr data-routine-main>\n\s*\{cell\}\n\s*<td[^>]*data-routine-cadence>\{cadenceWords\(routine\.schedule_rrule\)\}<\/td>\n\s*<td[^>]*data-routine-days>\{daysWords\(routine\.schedule_rrule, routine\.start_date\)\}<\/td>\n\s*<td[^>]*data-routine-time>\{timeWords\(routine\)\}<\/td>/);
  assert.match(lines, /const rowSpan = 1 \+ steps\.length \+ \(openAdd \? 1 : 0\);/);
  assert.doesNotMatch(lines, /data-line-where|data-line-minutes|step\.location|step\.duration_minutes|value=\{form\.location\}|value=\{form\.duration_minutes\}/, 'Where and Minutes left the rows and the editor');
  assert.match(lines, /location: f\.location \|\| null,\n\s*sub_activity: f\.sub_activity \|\| null,\n\s*duration_minutes: f\.duration_minutes !== '' \? Number\(f\.duration_minutes\) : null,/, 'a line\'s stored location and duration are sent back as they are');
  assert.match(comments(LINES), /FORM-01 \(Alex, 2026-10-19\): THE TABLE IS Routine · Cadence · Days · Time/);
  assert.match(comments(ROW), /FORM-01 \(Alex, 2026-10-19\): THE EDIT FORM OPENS IN THE MATCHING DAYS CHOICE/);
});

test('T5 the geo law: no routine form mounts the lookup; the component and the route stand; the create route still accepts the place', () => {
  const law = code(LAW);
  assert.match(law, /const GEO_NO_MOUNT = \['src\/components\/workbench\/operations\/routines\/RoutineCreateForm\.tsx', 'src\/components\/workbench\/operations\/routines\/RoutineEditForm\.tsx'\];/); // WORK-01 (2026-10-24)
  assert.match(law, /for \(const f of GEO_NO_MOUNT\) \{\n\s*if \(\/<FindThisPlace\/\.test\(dayCode\(f\)\)\) geoFail\(/);
  assert.doesNotMatch(law, /the routine creator does not mount FindThisPlace/, 'the old clause moved');
  assert.match(comments(LAW), /FORM-01 \(Alex, 2026-10-19\): NO ROUTINE FORM MOUNTS THE LOOKUP/);
  assert.match(code('src/components/workbench/operations/routines/FindThisPlace.tsx'), /data-find-place\n/, 'the component stands');
  assert.match(code('src/app/api/operations/routines/route.ts'), /parsePlaceInput\(\{ location: body\.location, latitude: body\.latitude, longitude: body\.longitude \}\)/, 'the route still accepts the place');
  assert.match(code('src/app/api/hub/operations-routines/route.ts'), /latitude: r\.latitude != null \? Number\(r\.latitude\) : null,/, 'the hub map keeps reading what is stored');
});
