import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyCadence, compileFormToRRule, expandBetween, expandForward, isOnceRRule, scheduleAnchor,
} from '../operations/rruleHelpers';
import { parseBudgetAmountOrNull, parseLinesInput, parsePlaceInput } from '../operations/routineInput';
import { CADENCE_GROUP_ORDER, CADENCE_MODE_LABELS, DEFAULT_ROUTINE_FORM } from '@/components/workbench/operations/routines/types';
import { mapOperationsRoutines, type RoutineWindowEntry } from '../hub/mapOperationsRoutines';
import { buildDay, dayParts, mapSplit } from '../calendar/day';
import { buildDrill } from '../calendar/chain';
import { CALENDAR_SOURCES, MANUAL_EVENT_SOURCE, isRenderedCalendarSource } from '../calendar/sources';
import { TOOL_REGISTRY } from '../toolRegistry';
import { claimLine } from '../offer';
import { code, comments } from '../sourceText';

/**
 * ONEOFF-01 — A ONE-OFF IS A ROUTINE THAT HAPPENS ONCE, AUTHORED IN TASKS LIKE
 * EVERYTHING ELSE. Source reads strip comments first, so a citation in a comment
 * can never satisfy an assertion about code.
 */

const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const PATCH_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const WINDOW_ROUTE = 'src/app/api/hub/operations-routines/route.ts';
const EV_ROUTE = 'src/app/api/calendar/events/route.ts';
const HUB = 'src/components/hub/HubCalendar.tsx';
const DAY_VIEW = 'src/components/hub/DayView.tsx';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const CORRECT_FORM = 'src/components/hub/CorrectEventForm.tsx';
const CREATOR = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const PICKER = 'src/components/workbench/operations/routines/CoaSelect.tsx';
const BUTTON = 'src/components/workbench/operations/routines/FindThisPlace.tsx';
const MIGRATION = 'prisma/migrations/20260918150000_oneoff_01_a_routine_that_happens_once/migration.sql';

const TZ = 'Asia/Bangkok';
const DAY = '2026-09-24';
const localDay = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const lineOf = (f: string, n: number) => code(f).split('\n')[n - 1] ?? '';

/** The walk's own one-off: Haircut · once · Thu Sep 24 · 2:00–2:45 · one line $300 / 8150 · Thonglor, found. */
const HAIRCUT_FORM = { ...DEFAULT_ROUTINE_FORM, cadence_mode: 'once' as const, start_date: DAY, end_date: DAY, byhour: '14', byminute: '00', timezone: TZ, start_time: '14:00', end_time: '14:45' };

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFilesUnder(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// STEP 0.1 / STEP 1 — the representation: COUNT=1, anchored on the date.
// ───────────────────────────────────────────────────────────────────────────
test('cadence once compiles to COUNT=1 and, anchored on its date, expands to exactly one occurrence — on that day, never again', () => {
  const rule = compileFormToRRule(HAIRCUT_FORM);
  assert.equal(rule, 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0');
  assert.equal(isOnceRRule(rule), true);
  assert.equal(classifyCadence(rule), 'once');
  assert.equal(CADENCE_MODE_LABELS.once, 'once (a single date)');
  assert.equal(CADENCE_GROUP_ORDER[0], 'once', 'a one-off groups first in Tasks');

  const anchor = scheduleAnchor(DAY);
  assert.equal(anchor?.toISOString(), '2026-09-24T00:00:00.000Z');
  // A decade either side: one occurrence, on the date, at 14:00 Bangkok (07:00Z).
  const decade = expandBetween(rule, TZ, new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2031, 0, 1)), anchor);
  assert.deepEqual(decade.map((d) => d.toISOString()), ['2026-09-24T07:00:00.000Z']);
  assert.equal(localDay(decade[0], TZ), DAY);
  // The calendar's September window sees it once; October sees nothing.
  assert.equal(expandBetween(rule, TZ, new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 8, 30, 23, 59, 59)), anchor).length, 1);
  assert.equal(expandBetween(rule, TZ, new Date(Date.UTC(2026, 9, 1)), new Date(Date.UTC(2026, 9, 31)), anchor).length, 0);
  // next_due_at: the occurrence itself until it passes, then nothing.
  assert.equal(expandForward(rule, TZ, new Date(Date.UTC(2026, 8, 1)), 1, anchor)[0]?.toISOString(), '2026-09-24T07:00:00.000Z');
  assert.deepEqual(expandForward(rule, TZ, new Date(Date.UTC(2026, 8, 25)), 5, anchor), []);
  // WITHOUT the anchor the count runs from 1971 and the occurrence is nowhere —
  // the defect STEP 0 proved on the library, and the reason the anchor is law.
  assert.equal(expandBetween(rule, TZ, new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2031, 0, 1))).length, 0);
});

test('a one-off without its date is refused — by the compiler, by the custom hatch, and by the database', () => {
  assert.throws(() => compileFormToRRule({ ...HAIRCUT_FORM, start_date: '' }), /needs its date/);
  assert.throws(() => compileFormToRRule({ ...HAIRCUT_FORM, start_date: '24/09/2026' }), /needs its date/);
  // A hand-written COUNT=1 is a one-off too, and needs the same date.
  assert.throws(() => compileFormToRRule({ ...DEFAULT_ROUTINE_FORM, cadence_mode: 'custom', custom_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=9;BYMINUTE=0', start_date: '' }), /needs its date/);
  assert.equal(compileFormToRRule({ ...DEFAULT_ROUTINE_FORM, cadence_mode: 'custom', custom_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=9;BYMINUTE=0', start_date: DAY }), 'FREQ=DAILY;COUNT=1;BYHOUR=9;BYMINUTE=0');
  // COUNT=10 is not a one-off.
  assert.equal(isOnceRRule('FREQ=DAILY;COUNT=10;BYHOUR=9'), false);
  assert.equal(classifyCadence('FREQ=DAILY;COUNT=10;BYHOUR=9;BYMINUTE=0'), 'daily');
  // The database refuses the row too: a COUNT=1 rule with no start_date.
  assert.match(code(MIGRATION), /CHECK \("schedule_rrule" !~ '\(\^\|;\)COUNT=1\(;\|\$\)' OR "start_date" IS NOT NULL\)/);
  // And the create route refuses a one-off with no line and a window that is not its day.
  const create = code(CREATE_ROUTE);
  assert.match(create, /if \(once && lines\.value\.length === 0\)/);
  assert.match(create, /endDate = startResult\.value;/);
  assert.match(create, /a one-off ends on the day it happens/);
});

test('the anchor changes nothing for a rule that names its own components — and the one shape it moves is recorded', () => {
  const start = new Date(Date.UTC(2026, 8, 24));
  const to = new Date(Date.UTC(2026, 10, 1));
  const anchor = scheduleAnchor(start);
  for (const rule of [
    'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
    'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
    'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
    'FREQ=MONTHLY;BYDAY=1MO;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
  ]) {
    const before = expandBetween(rule, TZ, start, to).map((d) => d.toISOString());
    const after = expandBetween(rule, TZ, start, to, anchor).map((d) => d.toISOString());
    assert.ok(after.length > 0, `${rule} expands`);
    assert.deepEqual(after, before, `${rule} is unchanged on and after its start date`);
  }
  // The custom hatch's bare FREQ=WEEKLY (no BYDAY) takes its weekday from
  // DTSTART: Friday under the 1971 anchor, the start date's weekday under its
  // own. That is the ONE shape the anchor moves, for routines that have a
  // start_date — reported in the PR body with a query for Alex.
  const bare = 'FREQ=WEEKLY;BYHOUR=8;BYMINUTE=0;BYSECOND=0';
  const under1971 = expandBetween(bare, TZ, start, to).map((d) => localDay(d, TZ));
  const anchored = expandBetween(bare, TZ, start, to, anchor).map((d) => localDay(d, TZ));
  assert.equal(under1971[0], '2026-09-25', 'a Friday, from 1971-01-01');
  assert.equal(anchored[0], '2026-09-24', 'a Thursday, from the start date');
  // A routine with no start_date keeps the fixed anchor — nothing moves for it.
  assert.equal(scheduleAnchor(null), undefined);
  assert.equal(scheduleAnchor(''), undefined);
  assert.deepEqual(expandBetween(bare, TZ, start, to, scheduleAnchor(null)).map((d) => localDay(d, TZ)), under1971);
});

test('every expansion is anchored on the routine\'s start_date — one mechanism, no second path', () => {
  const callers = [CREATE_ROUTE, PATCH_ROUTE, 'src/app/api/operations/routines/[id]/completions/route.ts',
    'src/app/api/operations/routines/[id]/upcoming/route.ts', 'src/app/api/operations/routines/today/route.ts',
    WINDOW_ROUTE, 'src/inngest/functions/routine-evaluator.ts', 'src/lib/operations/routineBudget.ts'];
  for (const f of callers) {
    const body = code(f);
    const calls = [...body.matchAll(/expand(?:Forward|Between)\([^;]*;/g)].map((m) => m[0]);
    assert.ok(calls.length > 0, `${f} expands a schedule`);
    for (const c of calls) assert.match(c, /scheduleAnchor\(/, `${f}: ${c.slice(0, 60)} carries the anchor`);
  }
  // The evaluator and the budget bridge read the column they anchor on.
  assert.match(code('src/inngest/functions/routine-evaluator.ts'), /start_date: true/);
  assert.match(code('src/app/api/hub/business-budget/route.ts'), /start_date: true/);
  assert.match(code('src/app/api/hub/business-budget/route.ts'), /start_date: r\.start_date,/);
  // Nothing else in src expands a schedule.
  const others = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components'), ...tsFilesUnder('src/lib'), ...tsFilesUnder('src/inngest')]
    .filter((f) => !callers.includes(f) && f !== HELPERS && !f.includes('__tests__'))
    .filter((f) => /\bexpand(?:Forward|Between)\(/.test(code(f)));
  assert.deepEqual(others, []);
  // The helper builds the rule on the anchor it is handed, else the fixed one.
  assert.match(code(HELPERS), /dtstart: anchor \?\? FLOATING_ANCHOR/);
  // PATCH: moving the date moves the anchor, so next_due_at is recomputed.
  const patch = code(PATCH_ROUTE);
  assert.match(patch, /if \('start_date' in body\) \{[\s\S]{0,300}?scheduleChanged = true;/);
  assert.match(patch, /scheduleAnchor\(effectiveStart\)/);
  assert.match(patch, /if \(isOnceRRule\(nextRrule\)\)/);
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 1 — what a one-off carries, through the calendar's own leaves.
// ───────────────────────────────────────────────────────────────────────────
test('a one-off created in Tasks appears on that day only — with its line and total in the Routines part, and its pin on the map', () => {
  const rule = compileFormToRRule(HAIRCUT_FORM);
  const [instant] = expandBetween(rule, TZ, new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 8, 30, 23, 59, 59)), scheduleAnchor(DAY));
  const entry: RoutineWindowEntry = {
    routine_id: 'r-haircut', name: 'Haircut', entity_id: 'e1', timezone: TZ,
    start_time: '1970-01-01T14:00:00.000Z', end_time: '1970-01-01T14:45:00.000Z',
    occurrences: [instant.toISOString()],
    coa_code: null, budget_amount: null,
    steps: [{ id: 's1', is_active: true, step_order: 0, activity: 'Haircut', time_of_day: null, budget_amount: 300, coa_code: '8150' }],
    location: 'Thonglor', latitude: 13.7308, longitude: 100.5698, cadence: 'once',
  };
  const tiles = mapOperationsRoutines({ routines: [entry], truncated: false });
  assert.equal(tiles.length, 1, 'one tile, one occurrence');
  const tile = tiles[0];
  assert.equal(tile.startDate, DAY);
  assert.equal(tile.startTime, '14:00');
  assert.equal(tile.endTime, '14:45');
  assert.equal(tile.budgetAmount, 300, 'the sum of its one line');
  assert.equal(tile.coaCode, null, 'a lined routine carries no single chip — the line carries 8150');
  assert.equal(tile.isRecurring, false, 'a one-off wears no recurrence glyph');
  assert.equal(tile.location, 'Thonglor');
  assert.equal(tile.latitude, 13.7308);
  assert.equal(tile.longitude, 100.5698);

  // The day it sits on: the Routines part, its total, its pin.
  const onDay = [tile].filter((e) => (e.startDate ?? '') <= DAY && DAY <= (e.endDate ?? e.startDate ?? ''));
  const rows = buildDay(onDay.map((e) => ({ ...e, budgetAmount: e.budgetAmount ?? null })), DAY);
  assert.equal(rows.length, 1);
  const parts = dayParts(rows);
  const routines = parts.parts.find((p) => p.key === 'routines')!;
  assert.deepEqual(routines.total, { total: 300, covered: 1, of: 1 });
  assert.equal(parts.parts.some((p) => p.key === 'events'), false, 'it is a routine, not an event');
  const { pinned, unplaced } = mapSplit(rows);
  assert.equal(pinned.length, 1);
  assert.equal(unplaced.length, 0);
  assert.deepEqual(pinned[0].pin, { lat: 13.7308, lon: 100.5698 });

  // The next day: nothing.
  const nextDay = '2026-09-25';
  assert.equal([tile].filter((e) => (e.startDate ?? '') <= nextDay && nextDay <= (e.endDate ?? e.startDate ?? '')).length, 0);

  // The chain panel: a routine owned by Tasks, with its line, its pin and no guessed actual.
  const drill = buildDrill(
    { id: tile.id, source: tile.source, title: tile.title, startDate: tile.startDate, startTime: tile.startTime, endTime: tile.endTime,
      location: tile.location, latitude: tile.latitude, longitude: tile.longitude, coaCode: tile.coaCode, budgetAmount: tile.budgetAmount ?? null },
    null,
    { lines: [{ stepId: 's1', activity: 'Haircut', timeOfDay: null, amount: 300, coaCode: '8150' }], coverage: { counted: 1, of: 1 }, ignoredRoutineLevel: null },
  );
  assert.equal(drill.kind, 'routine');
  assert.equal(drill.owner, 'Tasks');
  assert.deepEqual(drill.pin, { lat: 13.7308, lon: 100.5698 });
  assert.equal(drill.planned, 300);
  assert.equal(drill.actual, null);
  assert.equal(drill.lines?.length, 1);
  assert.equal(drill.chain?.state, 'NOT_LINKED');

  // A place-less one-off lists under the map, never dropped and never 0,0.
  const bare = mapOperationsRoutines({ routines: [{ ...entry, location: null, latitude: null, longitude: null }], truncated: false })[0];
  assert.equal(bare.latitude, null);
  const bareRows = buildDay([{ ...bare, budgetAmount: bare.budgetAmount ?? null }], DAY);
  assert.equal(mapSplit(bareRows).unplaced.length, 1);
  // The window route hands the mapper the place and the cadence; the mapper stamps them.
  const win = code(WINDOW_ROUTE);
  assert.match(win, /location: r\.location,/);
  assert.match(win, /latitude: r\.latitude != null \? Number\(r\.latitude\) : null/);
  assert.match(win, /cadence: classifyCadence\(r\.schedule_rrule\)/);
});

test('the create form authors the one-off whole — date, times, lines from the entity-scoped picker, place from the one-press lookup', () => {
  const creator = code(CREATOR);
  // Cadence once is offered, and once makes the date required.
  assert.match(code('src/components/workbench/operations/routines/RRULEBuilder.tsx'), /'once',\s*\n\s*'custom',/);
  assert.match(creator, /const once = createForm\.cadence_mode === 'once';/);
  assert.match(creator, /data-routine-once-date/);
  assert.match(creator, /end_date: once \? \(createForm\.start_date \|\| null\)/);
  // Lines: activity + amount + COA per line, the COA from CoaSelect scoped to the entity.
  assert.match(creator, /data-routine-lines/);
  assert.match(creator, /data-routine-line-activity/);
  assert.match(creator, /data-routine-line-amount/);
  assert.match(creator, /<CoaSelect\s+entityId=\{createForm\.entity_id\}\s+value=\{l\.coa_code\}/);
  assert.match(creator, /budget_amount: l\.budget_amount\.trim\(\) \|\| null, coa_code: l\.coa_code \|\| null/);
  // A one-off's money is its lines; the routine-level pair is not sent for it.
  assert.match(creator, /budget_amount: once \? '' : createForm\.budget_amount/);
  // The place: the location field, the moved button, the pair — '' → null.
  assert.match(creator, /<FindThisPlace/);
  assert.match(creator, /data-routine-location/);
  assert.match(creator, /latitude: createForm\.latitude \|\| null/);
  // The start time fills the occurrence's hour and minute on a one-off.
  assert.match(creator, /byhour: v\.slice\(0, 2\), byminute: v\.slice\(3, 5\)/);
  // The create route writes the routine and its lines together, or not at all.
  const create = code(CREATE_ROUTE);
  assert.match(create, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(create, /tx\.operations_routine_steps\.createMany\(/);
  assert.match(create, /parseLinesInput\(body\.lines\)/);
  assert.match(create, /parsePlaceInput\(\{ location: body\.location, latitude: body\.latitude, longitude: body\.longitude \}\)/);
  assert.match(create, /location: place\.value\.location,/);
  // The row's edit form carries the place too, and opens a one-off as once.
  const row = code(ROW);
  assert.match(row, /cadence_mode: once \? 'once' : 'custom'/);
  assert.match(row, /<FindThisPlace/);
  assert.match(row, /data-routine-place-view/);
});

test('the routine input leaf: a blank amount is null, half a pair is refused, a line needs its activity, nothing is defaulted', () => {
  assert.deepEqual(parseBudgetAmountOrNull(''), { value: null });
  assert.deepEqual(parseBudgetAmountOrNull(undefined), { value: null });
  assert.deepEqual(parseBudgetAmountOrNull('300'), { value: '300' });
  assert.deepEqual(parseBudgetAmountOrNull(12.5), { value: '12.5' });
  assert.ok('error' in parseBudgetAmountOrNull('-1'));
  assert.ok('error' in parseBudgetAmountOrNull('1.234'));
  assert.ok('error' in parseBudgetAmountOrNull('free'));

  assert.deepEqual(parseLinesInput(undefined), { value: [] });
  assert.deepEqual(parseLinesInput([{ activity: ' Haircut ', budget_amount: '300', coa_code: '8150' }]),
    { value: [{ activity: 'Haircut', budget_amount: '300', coa_code: '8150' }] });
  assert.deepEqual(parseLinesInput([{ activity: 'Gym' }]), { value: [{ activity: 'Gym', budget_amount: null, coa_code: null }] });
  const noActivity = parseLinesInput([{ activity: 'Gym' }, { activity: '  ', budget_amount: '5' }]);
  assert.ok('error' in noActivity && noActivity.error.field === 'lines[1].activity');
  assert.ok('error' in parseLinesInput('x'));
  const badAmount = parseLinesInput([{ activity: 'Gym', budget_amount: '-3' }]);
  assert.ok('error' in badAmount && badAmount.error.field === 'lines[0].budget_amount');

  assert.deepEqual(parsePlaceInput({ location: ' Thonglor ', latitude: '13.7308', longitude: '100.5698' }),
    { value: { location: 'Thonglor', latitude: 13.7308, longitude: 100.5698 } });
  assert.deepEqual(parsePlaceInput({ location: '  ', latitude: '', longitude: null }), { value: { location: null, latitude: null, longitude: null } });
  assert.deepEqual(parsePlaceInput({}), { value: { location: null, latitude: null, longitude: null } });
  const half = parsePlaceInput({ latitude: 13.7 });
  assert.ok('error' in half && /both latitude and longitude, or neither/.test(half.error.message));
  const range = parsePlaceInput({ latitude: 99, longitude: 1 });
  assert.ok('error' in range && /between -90 and 90/.test(range.error.message));
  assert.ok('error' in parsePlaceInput({ latitude: 'x', longitude: 1 }));
  // The two step writers read the same leaf and hold no parser of their own.
  for (const f of ['src/app/api/operations/routines/[id]/steps/route.ts', 'src/app/api/operations/routines/steps/[stepId]/route.ts']) {
    assert.match(code(f), /from '@\/lib\/operations\/routineInput'/, `${f} reads the leaf`);
    assert.doesNotMatch(code(f), /function parseBudgetAmountOrNull/, `${f} keeps no copy of the rule`);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 2 — the calendar authors nothing; a pre-ruling row stays editable.
// ───────────────────────────────────────────────────────────────────────────
test('POST /api/calendar/events is gone — a method the route does not export answers 405; PATCH and DELETE stay', () => {
  const route = code(EV_ROUTE);
  assert.doesNotMatch(route, /export async function POST\b/);
  assert.doesNotMatch(route, /INSERT INTO calendar_events/);
  assert.match(route, /export async function PATCH\b/);
  assert.match(route, /export async function DELETE\b/);
  assert.match(comments(EV_ROUTE), /POST\s+— REMOVED/);
  // Nothing in the app POSTs to it any more, and the old form is gone.
  const posts = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')]
    .filter((f) => /fetch\(\s*['"`]\/api\/calendar\/events['"`][\s\S]{0,200}?method:\s*'POST'/.test(code(f)));
  assert.deepEqual(posts, []);
  assert.equal(existsSync(`${process.cwd()}/src/components/hub/AddEventForm.tsx`), false);
  // No writer in src inserts the manual source.
  const manualWriters = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/lib')]
    .filter((f) => !f.includes('__tests__'))
    .filter((f) => /INSERT INTO calendar_events/.test(code(f)) && /MANUAL_EVENT_SOURCE|source:\s*'manual'/.test(code(f)));
  assert.deepEqual(manualWriters, []);
});

test('an existing hand-entered row still renders, corrects and deletes — from the day and from the chain panel', () => {
  // The allowlist keeps 'manual' with its amended reason and cites the two verbs that remain.
  const entry = CALENDAR_SOURCES.find((r) => r.source === MANUAL_EVENT_SOURCE)!;
  assert.ok(entry);
  assert.match(entry.why, /No new rows since ONEOFF-01; existing rows render and remain editable\./);
  assert.doesNotMatch(entry.writtenBy, /\(POST\)/);
  const cited = [...entry.writtenBy.matchAll(/:(\d+) \((PATCH|DELETE)\)/g)].map((m) => [Number(m[1]), m[2]] as const);
  assert.equal(cited.length, 2);
  for (const [n, verb] of cited) {
    assert.ok(lineOf(EV_ROUTE, n).includes(verb === 'PATCH' ? 'UPDATE calendar_events' : 'DELETE FROM calendar_events'), `${EV_ROUTE}:${n} is the ${verb}`);
  }
  assert.equal(isRenderedCalendarSource(MANUAL_EVENT_SOURCE), true);
  // It renders: a pre-ruling row through the same day leaf, pin and all.
  const rows = buildDay([{ id: 'old', source: MANUAL_EVENT_SOURCE, title: 'Dentist', startDate: DAY, startTime: '09:00', budgetAmount: 120, latitude: 13.7, longitude: 100.5 }], DAY);
  assert.equal(rows.length, 1);
  assert.equal(mapSplit(rows).pinned.length, 1);
  assert.equal(dayParts(rows).parts.find((p) => p.key === 'events')?.total.total, 120);
  // From the day: Correct and Delete on the row, the one write the day view is allowed.
  const day = code(DAY_VIEW);
  assert.match(day, /data-correct-event/);
  assert.match(day, /data-delete-event/);
  assert.match(day, /\/api\/calendar\/events\?id=\$\{encodeURIComponent\(id\)\}`, \{ method: 'DELETE' \}/);
  assert.match(day, /from '@\/components\/hub\/CorrectEventForm'/);
  // From the chain panel: Correct hands the id up (no PATCH here), Remove is the same DELETE, both behind the source check.
  const panel = code(PANEL);
  assert.match(panel, /isManualEvent\(row\.source\) && \(/);
  assert.match(panel, /data-drill-correct[\s\S]{0,80}onClick=\{\(\) => onCorrect\(row\.id\)\}/);
  assert.match(panel, /data-drill-remove[\s\S]{0,60}onClick=\{removeEvent\}/);
  assert.match(panel, /\/api\/calendar\/events\?id=\$\{encodeURIComponent\(row\.id\)\}`, \{ method: 'DELETE' \}/);
  assert.doesNotMatch(panel, /method:\s*'PATCH'/);
  assert.match(panel, /data-drill-remove-refusal/);
  // The grid mounts the correction only while one is open, and nothing that adds.
  const hub = code(HUB);
  assert.match(hub, /\{!isDemo && editEvent && \(\s*<CorrectEventForm/);
  assert.match(hub, /onCorrect=\{\(id\) => \{/);
  assert.match(hub, /onRemoved=\{\(\) => \{ setDetailEvent\(null\); loadCalendar\(\); \}\}/);
  assert.doesNotMatch(hub, /AddEventForm|data-add-event/);
  // The correction form: PATCH only, the stored account kept as stored, no merged chart, no lookup.
  const form = code(CORRECT_FORM);
  assert.match(form, /method: 'PATCH'/);
  assert.doesNotMatch(form, /method: 'POST'/);
  assert.match(form, /coaCode: event\.coaCode \?\? null/);
  assert.doesNotMatch(form, /chart-of-accounts|find-place|FindThisPlace/);
  assert.match(form, /data-correct-event-submit/);
  assert.match(form, /data-correct-event-cancel/);
});

test('no merged chart anywhere on the two trees — the picker shows one entity\'s chart, unique by (user, entity, code)', () => {
  // The picker fetches ONE entity's chart, and the route filters on it.
  assert.match(code(PICKER), /\/api\/chart-of-accounts\?entity_id=\$\{encodeURIComponent\(entityId\)\}/);
  assert.match(code('src/app/api/chart-of-accounts/route.ts'), /\.\.\.\(entityId && \{ entity_id: entityId \}\)/);
  // A code is unique within an entity's chart — the schema says so — so the
  // scoped list cannot hold two 1010s; only the merged list could, and it is gone.
  const chart = code('prisma/schema.prisma');
  const model = chart.slice(chart.indexOf('model chart_of_accounts {'), chart.indexOf('model', chart.indexOf('model chart_of_accounts {') + 10));
  assert.match(model, /@@unique\(\[userId, entity_id, code\]\)/);
  // Nothing on the calendar's tree or the routines surface reads the chart unscoped.
  const surfaces = [...tsFilesUnder('src/components/hub'), ...tsFilesUnder('src/components/workbench/operations/routines'), 'src/app/calendar/page.tsx'];
  for (const f of surfaces) assert.doesNotMatch(code(f), /fetch\(\s*['"`]\/api\/chart-of-accounts['"`]/, `${f} reads no merged chart`);
  // Simulated: the old merged list held duplicates; scoped to one entity it holds none.
  const merged = [{ code: '1010', entity_id: 'e1' }, { code: '1010', entity_id: 'e2' }, { code: '3000', entity_id: 'e1' }, { code: '3000', entity_id: 'e3' }, { code: '6100', entity_id: 'e2' }];
  assert.ok(new Set(merged.map((a) => a.code)).size < merged.length, 'the merged list repeats codes');
  const scoped = merged.filter((a) => a.entity_id === 'e1').map((a) => a.code);
  assert.equal(new Set(scoped).size, scoped.length, 'one entity\'s chart does not');
});

test('Find this place makes one call on press and none on type, from its new home in Tasks', () => {
  const button = code(BUTTON);
  const hits = [...button.matchAll(/\/api\/calendar\/find-place/g)];
  assert.equal(hits.length, 1, 'one call site in the component');
  const handlerAt = button.indexOf('const findThisPlace = async () =>');
  assert.ok(handlerAt > -1 && hits[0].index! > handlerAt, 'the call lives inside findThisPlace');
  assert.deepEqual([...button.matchAll(/(\w+)=\{findThisPlace\}/g)].map((m) => m[1]), ['onClick']);
  assert.equal(/useEffect\(/.test(button), false, 'no effect fires without a press');
  assert.equal(/setTimeout|debounce/i.test(button), false);
  assert.match(button, /data-find-place\n/);
  assert.match(button, /disabled=\{finding \|\| atCap \|\| !location\.trim\(\)\}/);
  // Exactly one file in the app renders the button, and it is this one.
  const renderers = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')].filter((f) => /data-find-place(?![\w-])/.test(code(f)));
  assert.deepEqual(renderers, [BUTTON]);
  // Mounted by Tasks' creator and the row's edit form; by nothing on the calendar.
  assert.match(code(CREATOR), /<FindThisPlace/);
  assert.match(code(ROW), /<FindThisPlace/);
  for (const f of tsFilesUnder('src/components/hub')) assert.doesNotMatch(code(f), /FindThisPlace|find-place/, `${f} mounts no lookup`);
  // GEO-01's cap and one-press rule are untouched on the route.
  const route = code('src/app/api/calendar/find-place/route.ts');
  assert.equal((route.match(/googleFetch\s*\(/g) ?? []).length, 1);
  assert.match(route, /status: 429/);
  assert.match(route, /capResetsOn\(\)/);
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 3 — the registry tells the truth.
// ───────────────────────────────────────────────────────────────────────────
test('the Calendar row lost commit and kept record; Tasks\' row gained nothing', () => {
  const cal = TOOL_REGISTRY.find((t) => t.name === 'Calendar')!;
  assert.deepEqual(cal.beats, { discover: true, decide: false, commit: false, record: true });
  assert.equal(cal.status, 'PARTIAL');
  assert.equal(claimLine(cal), 'partial — discover · record');
  assert.match(cal.why ?? '', /nothing is authored here — a one-off is a routine planned in Tasks/);
  assert.match(cal.citation, /no commit: no POST since ONEOFF-01/);
  assert.doesNotMatch(cal.citation, /AddEventForm|POST, INSERT/);
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual(tasks.beats, { discover: true, decide: true, commit: true, record: true });
  // TASKS-01 (2026-09-18): the why became a customer's line and the third
  // link reads "Audit trail" — pinned in tasks01.test.ts; here only that the
  // row's shape did not move with ONEOFF-01.
  assert.doesNotMatch(tasks.why ?? '', /founder|Claude Code/);
  assert.deepEqual(tasks.links?.map((l) => l.label), ['North Star', 'Issue log', 'Audit trail']);
});

// ───────────────────────────────────────────────────────────────────────────
// The migration: additive, nothing moves; the schema moves with it.
// ───────────────────────────────────────────────────────────────────────────
test('the migration adds the place columns with their CHECKs and moves nothing; the schema carries them', () => {
  const m = code(MIGRATION);
  for (const col of ['"location"  VARCHAR(255)', '"latitude"  DECIMAL(10,7)', '"longitude" DECIMAL(10,7)']) assert.ok(m.includes(`ADD COLUMN ${col}`), col);
  assert.match(m, /CHECK \(\("latitude" IS NULL\) = \("longitude" IS NULL\)\)/);
  assert.doesNotMatch(m, /DEFAULT 0/);
  assert.doesNotMatch(m, /(^|\n)\s*(UPDATE|DELETE|INSERT)\s/);
  assert.doesNotMatch(m, /DROP (COLUMN|TABLE)/);
  assert.doesNotMatch(m, /ALTER TABLE "calendar_events"/, 'no calendar_events row is touched');
  const schema = code('prisma/schema.prisma');
  const model = schema.slice(schema.indexOf('model operations_routines {'), schema.indexOf('@@map("operations_routines")'));
  assert.match(model, /\n\s+location\s+String\?\s+@db\.VarChar\(255\)/);
  assert.match(model, /\n\s+latitude\s+Decimal\?\s+@db\.Decimal\(10, 7\)/);
  assert.match(model, /\n\s+longitude\s+Decimal\?\s+@db\.Decimal\(10, 7\)/);
  // The calendar page says what it is now, as prose.
  assert.match(comments('src/app/calendar/page.tsx'), /THE CALENDAR AUTHORS NOTHING, AN EVENT INCLUDED/);
});
