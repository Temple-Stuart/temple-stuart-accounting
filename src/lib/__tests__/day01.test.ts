import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CALENDAR_SOURCES, EXCLUDED_CALENDAR_SOURCES, isRenderedCalendarSource,
  calendarSourcesLaw, CalendarSourcesLawError,
} from '../calendar/sources';
import {
  buildDay, expectedTotal, coverageLine, mapSplit, projectPins, readTasks, tasksTotal, minutesOf,
  type DayEventInput,
} from '../calendar/day';
import { ACTUALS_JOIN_SOUND, ACTUALS_JOIN_BLOCKERS, ACTUALS_NOT_JOINABLE_LINE } from '../calendar/actuals';

/**
 * DAY-01 — THE DAY, WHOLE. The tradeSplit.test.ts idiom: a source read strips
 * comment lines first, so a citation in a comment can never satisfy an assertion
 * about the code.
 */
const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

const HUB = 'src/components/hub/HubCalendar.tsx';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const DAY_VIEW = 'src/components/hub/DayView.tsx';

/** One event, with only what the test varies. */
const ev = (over: Partial<DayEventInput> & { id: string }): DayEventInput => ({
  source: 'trip', title: over.id, startDate: '2026-08-14', ...over,
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 1 — a day with events from four sources shows all four.
// ───────────────────────────────────────────────────────────────────────────
test('a day with events from four sources shows all four — the bare trip filter is gone', () => {
  // The four the walk seeds: a manual budget line, a hotel, an activity, an agenda item.
  for (const s of ['trip', 'home', 'shopping', 'agenda', 'personal', 'auto', 'growth', 'health']) {
    assert.equal(isRenderedCalendarSource(s), true, `${s} writes calendar_events and must render`);
  }
  // The two that are NOT calendar_events rows are refused BY NAME, with a reason.
  for (const e of EXCLUDED_CALENDAR_SOURCES) {
    assert.equal(isRenderedCalendarSource(e.source), false);
    assert.match(e.why, /merged separately|not a calendar_events row/);
  }
  assert.equal(isRenderedCalendarSource('a-source-nobody-writes'), false);
  assert.equal(isRenderedCalendarSource(null), false);
  assert.equal(isRenderedCalendarSource(undefined), false);

  // And the component reads the allowlist rather than a string of its own.
  const hub = code(HUB);
  assert.match(hub, /isRenderedCalendarSource\(e\.source\)/);
  assert.equal(/e\.source === 'trip'/.test(hub), false, 'the bare trip filter must be gone');
  assert.match(hub, /from '@\/lib\/calendar\/sources'/);
});

test('every rendered source carries its writer and its reason; every exclusion carries a reason', () => {
  assert.doesNotThrow(() => calendarSourcesLaw());
  for (const r of CALENDAR_SOURCES) {
    assert.ok(r.why.length > 10, `${r.source} needs a real reason`);
    assert.match(r.writtenBy, /\.ts:\d+/, `${r.source} must cite its writer at file:line`);
    assert.ok(r.label.length > 0);
    assert.ok(r.icon.length > 0);
    // Tailwind reads source text — a template-built class never ships.
    for (const cls of Object.values(r.tint)) assert.equal(/\$\{/.test(cls), false, `${r.source}'s ${cls} is built, not literal`);
  }
  // The law FAILS on a silent exclusion and on a source named twice.
  assert.throws(() => calendarSourcesLaw(CALENDAR_SOURCES, [{ source: 'x', why: '' }]), CalendarSourcesLawError);
  assert.throws(() => calendarSourcesLaw([CALENDAR_SOURCES[0], CALENDAR_SOURCES[0]]), CalendarSourcesLawError);
  assert.throws(() => calendarSourcesLaw([{ ...CALENDAR_SOURCES[0], writtenBy: 'somewhere' }]), CalendarSourcesLawError);
  // And a source cannot be both rendered and excluded.
  assert.throws(() => calendarSourcesLaw(CALENDAR_SOURCES, [{ source: 'trip', why: 'because' }]), CalendarSourcesLawError);
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 2 — the day view: time order, untimed on top, blanks, coverage.
// ───────────────────────────────────────────────────────────────────────────
test('the day reads in time order with untimed events grouped at the top', () => {
  const rows = buildDay([
    ev({ id: 'dinner', startTime: '19:30', endTime: '21:00' }),
    ev({ id: 'rent', source: 'home' }),
    ev({ id: 'flight', startTime: '06:05', endTime: '09:40' }),
    ev({ id: 'aaa-untimed', source: 'shopping' }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['aaa-untimed', 'rent', 'flight', 'dinner']);
  assert.deepEqual(rows.map((r) => r.untimed), [true, true, false, false]);
  assert.equal(rows[2].startTime, '06:05');
  assert.equal(rows[2].endTime, '09:40');
  // "HH:MM:SS" from a pg TIME column normalizes to HH:MM, and junk is untimed.
  assert.equal(buildDay([ev({ id: 'a', startTime: '07:15:00' })])[0].startTime, '07:15');
  assert.equal(minutesOf('25:00'), null);
  assert.equal(minutesOf(''), null);
  assert.equal(minutesOf('09:40'), 580);
});

test('an event with no budget_amount shows BLANK and is counted out of the total', () => {
  const rows = buildDay([
    ev({ id: 'hotel', budgetAmount: 240 }),
    ev({ id: 'walk', budgetAmount: null }),
    ev({ id: 'museum', budgetAmount: 100 }),
    ev({ id: 'beach' }),
  ]);
  // NULL stays NULL — it is never coerced into a 0 that would read as "free".
  assert.deepEqual(rows.map((r) => r.expected).sort((a, b) => (a ?? -1) - (b ?? -1)), [null, null, 100, 240]);
  const t = expectedTotal(rows);
  assert.deepEqual(t, { total: 340, covered: 2, of: 4 });
  assert.equal(coverageLine(t), '$340 planned across 2 of 4 events');

  // A REAL zero is a number the app has, and it counts.
  const withZero = expectedTotal([{ expected: 0 }, { expected: 5 }]);
  assert.deepEqual(withZero, { total: 5, covered: 2, of: 2 });

  // The ruling's own example shape, and the singular.
  assert.equal(coverageLine({ total: 340, covered: 5, of: 8 }), '$340 planned across 5 of 8 events');
  assert.equal(coverageLine({ total: 0, covered: 0, of: 1 }), '$0 planned across 0 of 1 event');
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 3 — the map: pins in route order, the rest listed not dropped.
// ───────────────────────────────────────────────────────────────────────────
test('an event with no coordinates is LISTED under the map, never dropped', () => {
  const rows = buildDay([
    ev({ id: 'hotel', startTime: '15:00', latitude: 20.6534, longitude: -105.2253 }),
    ev({ id: 'rent', source: 'home' }),
    ev({ id: 'surf', startTime: '08:00', latitude: 20.7, longitude: -105.3 }),
    ev({ id: 'nowhere', startTime: '12:00', latitude: 20.5, longitude: null }),
  ]);
  const { pinned, unplaced } = mapSplit(rows);
  assert.equal(pinned.length + unplaced.length, rows.length, 'every row is on the map or under it — none is dropped');
  // Route order IS time order: surf 08:00 before hotel 15:00.
  assert.deepEqual(pinned.map((r) => r.id), ['surf', 'hotel']);
  // Half a coordinate is not a place, and 0/0 is the empty-column reading.
  assert.deepEqual(unplaced.map((r) => r.id).sort(), ['nowhere', 'rent']);
  assert.equal(buildDay([ev({ id: 'z', latitude: 0, longitude: 0 })])[0].pin, null);

  // The projection keeps the geometry and never divides by zero.
  const pts = projectPins(pinned.map((r) => r.pin!));
  assert.equal(pts.length, 2);
  for (const p of pts) { assert.ok(p.x >= 0 && p.x <= 1); assert.ok(p.y >= 0 && p.y <= 1); }
  assert.deepEqual(projectPins([{ lat: 20.6, lon: -105.2 }]), [{ x: 0.5, y: 0.5 }]);
  assert.deepEqual(projectPins([]), []);
  // North is up: the higher latitude gets the smaller y.
  const ns = projectPins([{ lat: 10, lon: 0 }, { lat: 20, lon: 0 }]);
  assert.ok(ns[1].y < ns[0].y);

  // NO PROVIDER, NO GEOCODING — the day view reaches exactly two routes: the
  // day's plan (a read) and, since EVENT-01, its own manual-event route to
  // delete a hand-entered event. Nothing else, and no map service ever.
  const view = code(DAY_VIEW);
  assert.equal((view.match(/fetch\(/g) ?? []).length, 2, 'the day view reaches two routes and no more');
  assert.match(view, /\/api\/ops\/daily-plan\?date=/);
  assert.match(view, /\/api\/calendar\/events\?id=/);
  assert.equal(/googleapis|mapbox|openstreetmap|tile|geocod/i.test(view), false, 'no map provider, no geocoding');
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 4 — the plan and its tasks, read not written, totalled separately.
// ───────────────────────────────────────────────────────────────────────────
test('the day\'s tasks are read from daily_plans, and the two totals are stated separately', () => {
  const tasks = readTasks([
    { id: 't2', text: 'Ship DAY-01', completed: false, order: 2 },
    { id: 't1', text: 'Book the ferry', completed: true, order: 1, cost: 38 },
    { id: 't3', text: 'no order', completed: false },
    'not a task',
    { id: 't4', completed: true },
  ]);
  // A row with no text is not a task and is not invented.
  assert.deepEqual(tasks.map((t) => t.text), ['Book the ferry', 'Ship DAY-01', 'no order']);
  assert.deepEqual(tasks.map((t) => t.completed), [true, false, false]);
  // The writer's shape carries NO cost, so a costless task's cost is null — not 0.
  assert.deepEqual(tasks.map((t) => t.cost), [38, null, null]);
  assert.deepEqual(tasksTotal(tasks), { total: 38, covered: 1, of: 3 });
  assert.equal(coverageLine(tasksTotal(tasks), 'task', 'costed'), '$38 costed across 1 of 3 tasks');
  assert.deepEqual(readTasks(null), []);
  assert.deepEqual(readTasks({}), []);

  // The day view reads daily_plans and NEVER writes it — Tasks owns that row.
  // EVENT-01 STEP 5 added exactly one write: DELETE of a hand-entered event,
  // through the manual-event route. POST, PATCH and PUT remain absent.
  const view = code(DAY_VIEW);
  assert.equal(/method:\s*'(POST|PATCH|PUT)'/.test(view), false, 'the day view creates and updates nothing');
  const methods = [...view.matchAll(/method:\s*'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(methods, ['DELETE'], 'the day view has exactly one write, and it is a delete');
  // …and it is on the manual-event route, not on daily_plans.
  assert.match(view, /fetch\(`\/api\/calendar\/events\?id=\$\{encodeURIComponent\(id\)\}`, \{ method: 'DELETE' \}\)/);
  assert.equal(/daily-plan[^)]*method:/.test(view), false, 'daily_plans is read, never written — Tasks owns it');
  // And the two totals are never merged into one number.
  assert.match(view, /data-day-total/);
  assert.match(view, /data-day-task-total/);
});

// ───────────────────────────────────────────────────────────────────────────
// STEP 5 — actuals: the join is not sound, so nothing is guessed.
// ───────────────────────────────────────────────────────────────────────────
test('actuals are not shown, because the date + coa_code join is not sound — and the day says so', () => {
  assert.equal(ACTUALS_JOIN_SOUND, false);
  assert.equal(ACTUALS_JOIN_BLOCKERS.length, 4);
  for (const b of ACTUALS_JOIN_BLOCKERS) {
    assert.ok(b.detail.length > 40, `${b.name} needs a real detail`);
    assert.ok(b.evidence.length > 10, `${b.name} needs evidence`);
  }
  // The four, named — each one on its own disqualifying.
  const names = ACTUALS_JOIN_BLOCKERS.map((b) => b.name).join(' | ');
  assert.match(names, /not the same string/);
  assert.match(names, /no entity/);
  assert.match(names, /dates mean different things/);
  assert.match(names, /many-to-many/);
  // The screen states the finding rather than leaving a column the reader fills in.
  const view = code(DAY_VIEW);
  assert.match(view, /ACTUALS_JOIN_SOUND/);
  assert.match(view, /ACTUALS_NOT_JOINABLE_LINE/);
  assert.match(ACTUALS_NOT_JOINABLE_LINE, /Any match would be a guess\.$/);
  // An unmatched event shows its EXPECTED and nothing else — there is no actual
  // column at all while the join is unsound.
  assert.equal(/data-day-actual\b/.test(view), false);
  assert.match(view, /data-day-expected/);
});

// ───────────────────────────────────────────────────────────────────────────
// The grid's day click, and the totals law.
// ───────────────────────────────────────────────────────────────────────────
test('a day opens whole from the grid, and no total renders without its coverage count', () => {
  const grid = code(GRID);
  assert.match(grid, /onDayClick\?: \(dateKey: string\) => void;/);
  assert.match(grid, /data-day-cell=\{dateToKey\(date\)\}/);
  assert.match(grid, /data-day-cell=\{dateToKey\(day\)\}/);
  // Optional: every existing caller that passes nothing keeps its behaviour.
  assert.match(grid, /onClick=\{onDayClick \? \(\) => onDayClick\(dateToKey\(date\)\) : undefined\}/);

  const hub = code(HUB);
  assert.match(hub, /onDayClick=\{\(dateKey\) => setOpenDay\(dateKey\)\}/);
  assert.match(hub, /<DayView/);
  // The panel reads the SAME merged list the grid draws — it cannot show a
  // different day from the grid it opened from.
  assert.match(hub, /events=\{gridEvents/);

  // THE TOTALS LAW, in the leaf: a total always arrives with its coverage.
  const t = expectedTotal([{ expected: 12 }, { expected: null }]);
  assert.equal(t.covered, 1);
  assert.equal(t.of, 2);
  assert.match(coverageLine(t), /\d+ of \d+/);
  // and the day view prints the line, never a bare figure.
  const view = code(DAY_VIEW);
  assert.match(view, /\{coverageLine\(eventsTotal\)\}/);
  assert.match(view, /coverageLine\(taskTotal, 'task', 'costed'\)/);
});

test('a multi-day stay is on every day it spans — and shows only the times that apply to THAT day', () => {
  const hub = code(HUB);
  assert.match(hub, /start <= openDay && openDay <= end/);

  // A hotel: check in 13 Aug 15:00, check out 16 Aug 11:00. Its stored times are
  // ONE check-in and ONE check-out, and printing both on a middle night would
  // tell the reader the stay starts and ends today. It does not.
  const hotel = ev({ id: 'hotel', startDate: '2026-08-13', endDate: '2026-08-16', startTime: '15:00', endTime: '11:00' });

  const arrival = buildDay([hotel], '2026-08-13')[0];
  assert.equal(arrival.span, 'starts');
  assert.equal(arrival.startTime, '15:00');
  assert.equal(arrival.endTime, null, 'check-out is not on the arrival day');

  const middle = buildDay([hotel], '2026-08-14')[0];
  assert.equal(middle.span, 'continues');
  assert.equal(middle.startTime, null);
  assert.equal(middle.endTime, null);
  assert.equal(middle.untimed, true, 'an ongoing stay reads as all-day, which is how the grid draws it');

  const checkout = buildDay([hotel], '2026-08-16')[0];
  assert.equal(checkout.span, 'ends');
  assert.equal(checkout.startTime, null, 'check-in is not on the departure day');
  assert.equal(checkout.endTime, '11:00');

  // A single-day event is unaffected on every reading.
  const one = buildDay([ev({ id: 'surf', startTime: '08:00', endTime: '10:30' })], '2026-08-14')[0];
  assert.equal(one.span, 'single');
  assert.equal(one.startTime, '08:00');
  assert.equal(one.endTime, '10:30');

  // And the screen says which it is rather than printing a time that is not today's.
  const view = code(DAY_VIEW);
  assert.match(view, /buildDay\(events, dateKey\)/);
  assert.match(view, /all day \(continues\)/);
  assert.match(view, /data-day-span/);
});
