import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_CATEGORIES, categoryOf, buildManualEvent, type ManualEventInput,
} from '../calendar/manualEvent';
import {
  CALENDAR_SOURCES, MANUAL_EVENT_SOURCE, MANUAL_EVENT_BADGE, isManualEvent, isRenderedCalendarSource,
} from '../calendar/sources';
import { buildDay, expectedTotal, coverageLine, mapSplit, type DayEventInput } from '../calendar/day';
import { code } from '../sourceText';

/**
 * EVENT-01 — AN EVENT CAN BE ADDED BY HAND. Source reads strip comment lines
 * first, so a citation in a comment can never satisfy an assertion about code.
 */

const ROUTE = 'src/app/api/calendar/events/route.ts';
// ONEOFF-01: the add-event form became the edit-only correction form. The
// calendar authors nothing; a one-off is a routine planned in Tasks.
const FORM = 'src/components/hub/CorrectEventForm.tsx';
const DAY_VIEW = 'src/components/hub/DayView.tsx';
const HUB = 'src/components/hub/HubCalendar.tsx';
const USER_A = 'user-a';

/** The walk's own event. */
const HAIRCUT: ManualEventInput = {
  title: 'Haircut', date: '2026-08-14', startTime: '14:00', endTime: '14:45',
  category: 'personal', cost: 300, location: 'Thonglor',
};

// ───────────────────────────────────────────────────────────────────────────
// Create → read → edit → delete, and the shape that round-trips.
// ───────────────────────────────────────────────────────────────────────────
test('a manual event round-trips: it builds, carries every field the person chose, and nothing they did not', () => {
  const built = buildManualEvent(HAIRCUT, USER_A);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const r = built.row;

  assert.equal(r.user_id, USER_A);
  assert.equal(r.source, MANUAL_EVENT_SOURCE);
  assert.equal(r.source_id, null, 'a hand-entered event points at no other row');
  assert.equal(r.title, 'Haircut');
  assert.equal(r.start_date, '2026-08-14');
  assert.equal(r.start_time, '14:00');
  assert.equal(r.end_time, '14:45');
  assert.equal(r.budget_amount, 300);
  assert.equal(r.location, 'Thonglor');
  // The icon and colour come from the CENSUS, never invented at the call site.
  assert.equal(r.category, 'personal');
  assert.equal(r.icon, categoryOf('personal')!.icon);
  assert.equal(r.color, categoryOf('personal')!.color);
  // Nothing the person did not choose.
  assert.equal(r.coa_code, null);
  assert.equal(r.latitude, null);
  assert.equal(r.longitude, null);
  assert.equal(r.description, null);
  // EVENT-02: recurrence exists on the table and is deliberately not used.
  assert.equal(r.is_recurring, false);
  assert.equal(r.recurrence_rule, null);

  // The edit: the same builder, so a correction cannot drift from a creation.
  const edited = buildManualEvent({ ...HAIRCUT, startTime: '15:30', endTime: '16:15' }, USER_A);
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(edited.row.start_time, '15:30');
  assert.equal(edited.row.end_time, '16:15');
  assert.equal(edited.row.source, MANUAL_EVENT_SOURCE);

  // ONEOFF-01: PATCH and DELETE exist and each answers 401 before touching the
  // store; POST is GONE — the calendar authors nothing.
  const route = code(ROUTE);
  for (const verb of ['PATCH', 'DELETE']) assert.match(route, new RegExp(`export async function ${verb}`));
  assert.doesNotMatch(route, /export async function POST\b/, 'no new hand-entered row is written by the calendar');
  assert.doesNotMatch(route, /INSERT INTO calendar_events/);
  assert.equal((route.match(/status: 401/g) ?? []).length, 2);
});

test('nothing is defaulted — an empty cost, time or coordinate stays empty, and a bad one is refused by name', () => {
  const refusals: Array<[string, ManualEventInput, RegExp]> = [
    ['no title', { ...HAIRCUT, title: '  ' }, /title is required/i],
    ['no date', { ...HAIRCUT, date: '' }, /date \(YYYY-MM-DD\) is required/i],
    ['a category nobody writes', { ...HAIRCUT, category: 'brunch' }, /Category must be one the calendar already renders/],
    ['an end with no start', { ...HAIRCUT, startTime: null, endTime: '14:45' }, /end time needs a start time/i],
    ['an end before the start', { ...HAIRCUT, startTime: '15:00', endTime: '14:00' }, /not after the start/i],
    ['a time that is not a time', { ...HAIRCUT, startTime: '25:00' }, /HH:MM/],
    ['a cost that is not a number', { ...HAIRCUT, cost: 'free' as unknown as number }, /must be a number/i],
    ['a negative cost', { ...HAIRCUT, cost: -5 }, /cannot be negative/i],
    ['half a coordinate', { ...HAIRCUT, latitude: 13.73 }, /both latitude and longitude, or neither/i],
    ['an impossible latitude', { ...HAIRCUT, latitude: 99, longitude: 100 }, /between -90 and 90/],
    ['a prefixed account code', { ...HAIRCUT, coaCode: 'P-8110' }, /four digits/],
  ];
  for (const [what, input, reason] of refusals) {
    const r = buildManualEvent(input, USER_A);
    assert.equal(r.ok, false, `${what} must be refused, never defaulted`);
    if (!r.ok) assert.match(r.reason, reason, what);
  }

  // An omitted cost is NULL, not 0 — this is the whole no-defaulting rule.
  const noCost = buildManualEvent({ ...HAIRCUT, cost: undefined }, USER_A);
  assert.equal(noCost.ok, true);
  if (noCost.ok) assert.equal(noCost.row.budget_amount, null);
  // A real 0 is a number the person typed, and it is kept.
  const freeThing = buildManualEvent({ ...HAIRCUT, cost: 0 }, USER_A);
  assert.equal(freeThing.ok, true);
  if (freeThing.ok) assert.equal(freeThing.row.budget_amount, 0);
  // An omitted time is NULL, not midnight.
  const untimed = buildManualEvent({ ...HAIRCUT, startTime: null, endTime: null }, USER_A);
  assert.equal(untimed.ok, true);
  if (untimed.ok) { assert.equal(untimed.row.start_time, null); assert.equal(untimed.row.end_time, null); }
});

// ───────────────────────────────────────────────────────────────────────────
// A second user gets 404 on all three.
// ───────────────────────────────────────────────────────────────────────────
test('a second user gets 404 on read, edit and delete — every statement carries the caller', () => {
  const route = code(ROUTE);
  // The refusal reader and BOTH writes scope on the caller's id.
  assert.match(route, /SELECT source FROM calendar_events WHERE id = \$\{id\}::uuid AND user_id = \$\{userId\}/);
  assert.match(route, /WHERE id = \$14::uuid AND user_id = \$15 AND source = \$16/);
  assert.match(route, /DELETE\s+FROM calendar_events\s+WHERE id = \$\{id\}::uuid AND user_id = \$\{user\.id\} AND source = \$\{MANUAL_EVENT_SOURCE\}/);
  // A row that is not the caller's is NOT FOUND — never a 403, which would
  // confirm it exists.
  assert.match(route, /return \{ status: 404, error: 'No event with that id\.' \}/);
  assert.equal(/status: 403/.test(route), false, 'a cross-user row is a defensive 404, not a 403');
  // The scope is on the WHERE itself, not only on the check before it.
  assert.equal((route.match(/user_id = /g) ?? []).length >= 3, true);
});

// ───────────────────────────────────────────────────────────────────────────
// A trip event refuses edit and delete, with its reason.
// ───────────────────────────────────────────────────────────────────────────
test('a trip or budget event refuses edit and delete with its reason — it is never silently touched', () => {
  const route = code(ROUTE);
  assert.match(route, /if \(source !== MANUAL_EVENT_SOURCE\)/);
  assert.match(route, /status: 409/);
  assert.match(route, /which owns it/);
  assert.match(route, /Only an event added by hand can be changed on the calendar/);
  // Both verbs consult it BEFORE they write.
  const patch = route.slice(route.indexOf('export async function PATCH'));
  const del = route.slice(route.indexOf('export async function DELETE'));
  for (const [name, body] of [['PATCH', patch], ['DELETE', del]] as const) {
    const refusalAt = body.indexOf('refusalFor(');
    const writeAt = Math.max(body.indexOf('UPDATE calendar_events'), body.indexOf('DELETE\n    FROM calendar_events'), body.indexOf('DELETE FROM calendar_events'));
    assert.ok(refusalAt > -1, `${name} must consult the refusal`);
    assert.ok(writeAt === -1 || refusalAt < writeAt, `${name} must check before it writes`);
  }
  // And the write ITSELF is source-scoped, so the check is belt and braces.
  assert.match(route, /AND source = \$\{MANUAL_EVENT_SOURCE\}/);
});

// ───────────────────────────────────────────────────────────────────────────
// The day view: untimed group, cost counted out, pins.
// ───────────────────────────────────────────────────────────────────────────
const ev = (over: Partial<DayEventInput> & { id: string }): DayEventInput => ({
  source: MANUAL_EVENT_SOURCE, title: over.id, startDate: '2026-08-14', ...over,
});

test('a hand-entered event with no time lands in the untimed group; with no cost it is counted out of the day total', () => {
  const rows = buildDay([
    ev({ id: 'haircut', startTime: '14:00', endTime: '14:45', budgetAmount: 300 }),
    ev({ id: 'aaa-gym' }),
    ev({ id: 'dinner', startTime: '19:00' }),
  ], '2026-08-14');
  assert.deepEqual(rows.map((r) => r.id), ['aaa-gym', 'haircut', 'dinner']);
  assert.equal(rows[0].untimed, true);
  // The gym has no cost, so it is blank AND counted out.
  const t = expectedTotal(rows);
  assert.deepEqual(t, { total: 300, covered: 1, of: 3 });
  assert.equal(coverageLine(t), '$300 planned across 1 of 3 events');
  assert.equal(rows[0].expected, null);
});

test('a hand-entered event with coordinates pins on the map; one without is listed, never dropped', () => {
  const rows = buildDay([
    ev({ id: 'haircut', startTime: '14:00', latitude: 13.7308, longitude: 100.5698 }),
    ev({ id: 'gym', startTime: '07:00' }),
    ev({ id: 'half', startTime: '09:00', latitude: 13.7, longitude: null }),
  ], '2026-08-14');
  const { pinned, unplaced } = mapSplit(rows);
  assert.equal(pinned.length + unplaced.length, 3);
  assert.deepEqual(pinned.map((r) => r.id), ['haircut']);
  assert.deepEqual(unplaced.map((r) => r.id).sort(), ['gym', 'half']);
  assert.deepEqual(pinned[0].pin, { lat: 13.7308, lon: 100.5698 });
});

// ───────────────────────────────────────────────────────────────────────────
// The source, the census, the form, the marking.
// ───────────────────────────────────────────────────────────────────────────
test('the manual source is in DAY-01\'s allowlist with its writer and its reason, and is a NEW value', () => {
  const entry = CALENDAR_SOURCES.find((r) => r.source === MANUAL_EVENT_SOURCE);
  assert.ok(entry, 'the calendar must render the source it now writes');
  assert.match(entry!.writtenBy, /calendar\/events\/route\.ts:\d+/);
  assert.ok(entry!.why.length > 20);
  assert.equal(isRenderedCalendarSource(MANUAL_EVENT_SOURCE), true);
  assert.equal(isManualEvent(MANUAL_EVENT_SOURCE), true);
  assert.equal(isManualEvent('trip'), false);
  // It is a NEW value: no existing source means "entered by a person".
  const others = CALENDAR_SOURCES.filter((r) => r.source !== MANUAL_EVENT_SOURCE).map((r) => r.source);
  // CAL-01 (2026-09-23) appended 'reservation' — a PAID booking, deliberately not
  // 'trip' (which is what was PLANNED), so the deferred budget retro-map can tell
  // the two apart on this column alone. The point of this assertion is unchanged:
  // no source here means "entered by a person".
  assert.deepEqual(others, ['trip', 'agenda', 'home', 'shopping', 'personal', 'auto', 'growth', 'health', 'reservation']);
});

test('the category census is gathered from the existing writers, and the form offers only it', () => {
  assert.ok(EVENT_CATEGORIES.length >= 10);
  for (const c of EVENT_CATEGORIES) {
    assert.match(c.evidence, /\.ts:\d+/, `${c.category} must cite where the app already writes it`);
    assert.ok(c.icon.length > 0);
    assert.ok(c.color.length > 0);
  }
  assert.equal(categoryOf('brunch'), null);
  assert.equal(categoryOf(null), null);
  assert.equal(categoryOf('personal')!.icon, '👤');

  const form = code(FORM);
  assert.match(form, /EVENT_CATEGORIES\.map\(/);
  assert.equal(/<input[^>]*id="cef-category"/.test(form), false, 'the category is a select over the census, never free text');
  // The form never calls a provider — ONEOFF-01 moved the lookup to Tasks, and
  // the correction form has no lookup at all. The key stays on the server.
  assert.equal(/googleFetch\s*\(|maps\.googleapis|GOOGLE_PLACES_API_KEY|find-place/.test(form), false);
  assert.match(form, /data-correct-event-coord-hint/);
  // An empty number box posts nothing.
  assert.match(form, /if \(s === ''\) return undefined;/);
  assert.match(form, /cost: typedNumber\(cost\) \?\? null/);
  // ONEOFF-01: edit-only — it PATCHes an existing row and never POSTs; and it
  // carries the stored account back as stored, never from a merged chart.
  assert.match(form, /method: 'PATCH'/);
  assert.doesNotMatch(form, /method: 'POST'/);
  assert.doesNotMatch(form, /\/api\/chart-of-accounts/, 'no chart is fetched — the merged list is gone');
  assert.match(form, /coaCode: event\.coaCode \?\? null/);
});

test('the day view marks a hand-entered event and offers correct/delete on it alone', () => {
  const view = code(DAY_VIEW);
  assert.match(view, /isManualEvent\(r\.source\) && \(/);
  assert.match(view, /data-hand-entered/);
  assert.match(view, /\{MANUAL_EVENT_BADGE\}/);
  assert.match(view, /data-correct-event/);
  assert.match(view, /data-delete-event/);
  // The refusal is SHOWN, not swallowed.
  assert.match(view, /data-delete-event-refusal/);
  assert.match(view, /setDeleteRefusal\(data\?\.error/);
  assert.equal(MANUAL_EVENT_BADGE, 'hand-entered');

  // The correction form is mounted for a signed-in viewer only, and only while
  // a row is being corrected — a guest's demo calendar never calls a personal
  // route (HubCalendar's zero-fetch guarantee). ONEOFF-01: nothing is ADDED.
  const hub = code(HUB);
  assert.match(hub, /\{!isDemo && editEvent && \(/);
  assert.match(hub, /<CorrectEventForm/);
  assert.doesNotMatch(hub, /AddEventForm/);
  assert.match(hub, /onCorrect=\{\(ev\) => \{ setEditEvent\(ev\); setOpenDay\(null\); \}\}/);
});
