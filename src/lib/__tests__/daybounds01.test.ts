/**
 * DAYBOUNDS-01 (2026-10-11) — ONE DEFINITION OF A DAY.
 *
 * The today read (src/lib/operations/routineDay.ts) and the Budget's day rules
 * (src/lib/budget/days.ts) expand a routine over the SAME floating day and keep
 * the occurrence whose local day it is — so Today, This week and the day card
 * name the occurrence the Budget prices. T1 is the test that was missing: twenty
 * zone × hour cases, the two instants equal. The earlier dayBounds (local
 * midnight as a real UTC instant) was off by the zone's offset — in Bangkok an
 * evening routine was answered as the day before's; in Los Angeles an early one
 * as the day after's.
 *
 * Pure fixtures throughout; the source pins read through code() (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { buildRoutineBudgetLines, dayWindow, readOccurrenceKey, within, type RoutinePlanInput } from '../budget/days';
import { routineDay, type RoutineDayInput } from '../operations/routineDay';
import { instantToZoned } from '../time';

const MODULE = 'src/lib/operations/routineDay.ts';
const DAYS = 'src/lib/budget/days.ts';
const ROUTE = 'src/app/api/operations/routines/today/route.ts';

const DAY = '2026-10-11';
const ZONES = ['Asia/Bangkok', 'America/Los_Angeles', 'America/New_York', 'UTC'] as const;
const HOURS = [2, 8, 17, 20, 23] as const;
// `now` is only the status's reference — it never picks the day when one is asked for.
const NOW = new Date('2026-10-11T05:00:00.000Z');
const daily = (hour: number) => `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=0`;

/** The today read's input for one routine. */
const dayInput = (timezone: string, rrule: string, over: Partial<RoutineDayInput> = {}): RoutineDayInput => ({
  timezone, schedule_rrule: rrule, start_date: null, end_date: null, ...over,
});

/** The Budget's input for the same routine — one costed line, so its sourceId names the line's occurrence. */
const planInput = (timezone: string, rrule: string, over: Partial<RoutinePlanInput> = {}): RoutinePlanInput => ({
  id: 'r-1', name: 'Routine', entityId: 'ent-p', entityType: 'personal', timezone, scheduleRrule: rrule,
  startDate: null, endDate: null, budgetAmount: null, coaCode: null,
  steps: [{ id: 'step-1', stepOrder: 1, budgetAmount: '5.00', coaCode: '6150' }],
  ...over,
});

/** The instant the today read answers, as ISO text (or the kind when it answers none). */
const todayInstant = (timezone: string, rrule: string, day: string, over: Partial<RoutineDayInput> = {}): string => {
  const r = routineDay(dayInput(timezone, rrule, over), day, NOW);
  return r.kind === 'occurrence' ? r.expectedAt.toISOString() : r.kind;
};

/** The instant the Budget writes into the line's sourceId for that one day, read back through days.ts's own reader. */
const budgetInstant = (timezone: string, rrule: string, day: string, over: Partial<RoutinePlanInput> = {}): string => {
  const { lines, notPlaced } = buildRoutineBudgetLines([planInput(timezone, rrule, over)], day, day);
  assert.equal(notPlaced.length, 0, `nothing not placed: ${JSON.stringify(notPlaced)}`);
  assert.equal(lines.length, 1, `one line on ${day} in ${timezone} for ${rrule}: ${JSON.stringify(lines)}`);
  const read = readOccurrenceKey(lines[0].sourceId);
  assert.ok(read !== null && read.address.kind === 'routine_line' && read.address.id === 'step-1' && read.address.instant !== null, `the line's address: ${lines[0].sourceId}`);
  return (read.address.instant as Date).toISOString();
};

// ── T1 · THE TWO READS AGREE ─────────────────────────────────────────────────

test('T1 the today read and the Budget name the same instant — four zones, five hours, twenty cases', () => {
  const cases: string[] = [];
  for (const zone of ZONES) {
    for (const hour of HOURS) {
      const today = todayInstant(zone, daily(hour), DAY);
      const budget = budgetInstant(zone, daily(hour), DAY);
      assert.equal(today, budget, `${zone} BYHOUR=${hour} on ${DAY}: today read ${today} · Budget ${budget}`);
      cases.push(`${zone} ${String(hour).padStart(2, '0')} → ${today}`);
    }
  }
  assert.equal(cases.length, 20);
});

// ── T2 · THE DAY IS RIGHT ────────────────────────────────────────────────────

test('T2 an evening routine in Bangkok is THAT day’s; an early one in Los Angeles and New York is THAT day’s', () => {
  assert.equal(todayInstant('Asia/Bangkok', daily(20), DAY), '2026-10-11T13:00:00.000Z', '20:00 +07 on Oct 11 — not Oct 10');
  assert.equal(todayInstant('Asia/Bangkok', daily(23), DAY), '2026-10-11T16:00:00.000Z', '23:00 +07 on Oct 11');
  assert.equal(todayInstant('America/Los_Angeles', daily(2), DAY), '2026-10-11T09:00:00.000Z', '02:00 PDT on Oct 11 — not Oct 12');
  assert.equal(todayInstant('America/New_York', daily(2), DAY), '2026-10-11T06:00:00.000Z', '02:00 EDT on Oct 11 — not Oct 12');
});

test('T2 every occurrence of T1 falls on the day asked for, in the routine’s own zone', () => {
  for (const zone of ZONES) {
    for (const hour of HOURS) {
      const r = routineDay(dayInput(zone, daily(hour)), DAY, NOW);
      assert.equal(r.kind, 'occurrence', `${zone} BYHOUR=${hour}`);
      if (r.kind !== 'occurrence') continue;
      assert.equal(r.day, DAY);
      assert.equal(instantToZoned(r.expectedAt, zone).date, DAY, `${zone} BYHOUR=${hour}: ${r.expectedAt.toISOString()}`);
      assert.equal(instantToZoned(r.expectedAt, zone).time, `${String(hour).padStart(2, '0')}:00`, 'the wall clock the rule names');
    }
  }
});

// ── T3 · DST ─────────────────────────────────────────────────────────────────

test('T3 Los Angeles across a DST change — the fall-back day and the spring-forward day — the two reads agree, on the day', () => {
  const LA = 'America/Los_Angeles';
  // What THIS PR promises on a DST-change day: the two reads name ONE instant,
  // and its local day is the day asked for. The wall-clock HOUR of that instant
  // is the one expansion's (rruleHelpers.ts shiftFloatingToZone), not this PR's:
  // it takes the zone's offset at the floating instant read as UTC, so for the
  // hours between the change and offset-many hours after it, the shifted instant
  // is an hour off (2026-11-01 BYHOUR=8 lands at 07:00 PST, 2026-03-08 BYHOUR=8
  // at 09:00 PDT) — for the Budget and the today read alike. Found by this PR's
  // probe, reported, not pinned here and not fixed here (rruleHelpers is out of
  // scope). A fix there moves no pin below.
  for (const [day, hour, note] of [
    ['2026-11-01', 8, 'the fall-back day (02:00 PDT → 01:00 PST)'],
    ['2026-11-01', 1, 'the fall-back day — 01:00 happens twice; the rule names one occurrence'],
    ['2026-03-08', 8, 'the spring-forward day (02:00 PST → 03:00 PDT)'],
  ] as const) {
    const today = routineDay(dayInput(LA, daily(hour)), day, NOW);
    assert.equal(today.kind, 'occurrence', `${day} BYHOUR=${hour}: ${note}`);
    if (today.kind !== 'occurrence') continue;
    assert.equal(today.expectedAt.toISOString(), budgetInstant(LA, daily(hour), day), `${day} BYHOUR=${hour}: the two reads agree — ${note}`);
    assert.equal(instantToZoned(today.expectedAt, LA).date, day, `${day} BYHOUR=${hour}: on the day — ${note}`);
  }
  // The 01:00 occurrence on the fall-back day is the first 01:00 (PDT, 08:00Z) — one occurrence, its own hour.
  assert.equal(todayInstant(LA, daily(1), '2026-11-01'), '2026-11-01T08:00:00.000Z');
  assert.equal(instantToZoned(new Date('2026-11-01T08:00:00.000Z'), LA).time, '01:00');
  // Either side of the change, the hour is the rule's: 08:00 PDT the day before, 08:00 PST the day after.
  assert.equal(todayInstant(LA, daily(8), '2026-10-31'), '2026-10-31T15:00:00.000Z', '08:00 PDT');
  assert.equal(todayInstant(LA, daily(8), '2026-11-02'), '2026-11-02T16:00:00.000Z', '08:00 PST');
  assert.equal(todayInstant(LA, daily(8), '2026-10-31'), budgetInstant(LA, daily(8), '2026-10-31'));
  assert.equal(todayInstant(LA, daily(8), '2026-11-02'), budgetInstant(LA, daily(8), '2026-11-02'));
});

// ── T4 · NOTHING ELSE MOVED ──────────────────────────────────────────────────

test('T4 the day’s other answers stand: none on a day a weekly rule skips, outside start/end dates; refused by name; a once routine on its day only', () => {
  const BKK = 'Asia/Bangkok';
  const mondays = 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0';
  assert.equal(todayInstant(BKK, mondays, '2026-10-11'), 'none', 'a Sunday');
  assert.equal(todayInstant(BKK, mondays, '2026-10-12'), '2026-10-12T02:00:00.000Z', 'the Monday, 09:00 +07');
  assert.equal(todayInstant(BKK, daily(7), DAY, { start_date: new Date('2026-10-12T00:00:00.000Z') }), 'none', 'before its start date');
  assert.equal(todayInstant(BKK, daily(7), DAY, { end_date: new Date('2026-10-10T00:00:00.000Z') }), 'none', 'after its end date');
  const mars = routineDay(dayInput('Mars/Olympus', daily(7)), DAY, NOW);
  assert.ok(mars.kind === 'refused' && mars.reason === 'timezone not recognised' && mars.detail.startsWith('"Mars/Olympus": '));
  const garbled = routineDay(dayInput(BKK, 'NOT A RULE'), DAY, NOW);
  assert.ok(garbled.kind === 'refused' && garbled.reason === 'schedule does not parse' && garbled.detail.startsWith('"NOT A RULE": '));
  // ONEOFF-01: a once routine, anchored on its start_date — one occurrence on its day, none the day after.
  const once = { start_date: new Date('2026-10-11T00:00:00.000Z'), end_date: new Date('2026-10-11T00:00:00.000Z') };
  assert.equal(todayInstant(BKK, 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', '2026-10-11', once), '2026-10-11T05:00:00.000Z', '12:00 +07 on its day');
  assert.equal(todayInstant(BKK, 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', '2026-10-12', once), 'none', 'the day after');
  // The once routine's instant is the Budget's too.
  assert.equal(
    todayInstant(BKK, 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', '2026-10-11', once),
    budgetInstant(BKK, 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', '2026-10-11', { startDate: '2026-10-11', endDate: '2026-10-11' }),
  );
});

test('T4 the helpers themselves: dayWindow is the floating day, within is the closed range', () => {
  const w = dayWindow('2026-10-11', '2026-10-11');
  assert.deepEqual(w, { windowFrom: new Date('2026-10-11T00:00:00.000Z'), windowTo: new Date('2026-10-11T23:59:59.999Z') });
  assert.deepEqual(dayWindow('2026-10-05', '2026-10-11'), { windowFrom: new Date('2026-10-05T00:00:00.000Z'), windowTo: new Date('2026-10-11T23:59:59.999Z') });
  assert.equal(within('2026-10-11', '2026-10-11', '2026-10-11'), true);
  assert.equal(within('2026-10-10', '2026-10-11', '2026-10-11'), false);
  assert.equal(within('2026-10-12', '2026-10-11', '2026-10-11'), false);
  assert.equal(within('2026-10-05', '2026-10-05', '2026-10-11'), true);
  assert.equal(within('2026-10-11', '2026-10-05', '2026-10-11'), true);
});

// ── T5 · THE PINS ────────────────────────────────────────────────────────────

test('T5 routineDay.ts reads the day through the Budget’s helpers and keeps no definition of its own', () => {
  const m = code(MODULE);
  assert.match(m, /import \{ dayWindow, isIsoDay, within \} from '@\/lib\/budget\/days';/);
  assert.doesNotMatch(m, /dayBounds/, 'the real-instant bounds are gone');
  assert.match(m, /const \{ windowFrom, windowTo \} = dayWindow\(localDay, localDay\);/);
  assert.match(m, /expandBetween\(r\.schedule_rrule, r\.timezone, windowFrom, windowTo, scheduleAnchor\(r\.start_date\)\);/, 'the one anchored expansion, over the Budget’s window');
  assert.match(m, /occurrences\.find\(\(instant\) => within\(instantToZoned\(instant, r\.timezone\)\.date, localDay, localDay\)\)/, 'placed by the Budget’s own test');
  assert.doesNotMatch(m, /Date\.UTC\(|getTimezoneOffset|24 \* 60 \* 60 \* 1000/, 'no offset arithmetic of its own');
  // Unchanged: the zone is read first; the refusals; the module stays pure.
  assert.match(m, /instantToZoned\(now, r\.timezone\);/);
  assert.match(m, /reason: 'timezone not recognised'/);
  assert.match(m, /reason: 'schedule does not parse'/);
  assert.doesNotMatch(m, /@prisma\/client|@\/lib\/prisma|next\/server|process\.env|Date\.now\(|new Date\(\s*\)|console\./);
});

test('T5 days.ts states the day once — dayWindow’s body is the two lines, and buildRoutineBudgetLines calls it', () => {
  const d = code(DAYS);
  assert.match(d, /export function dayWindow\(rangeFrom: IsoDay, rangeTo: IsoDay\): \{ windowFrom: Date; windowTo: Date \} \{\n\s*const windowFrom = new Date\(`\$\{rangeFrom\}T00:00:00\.000Z`\);\n\s*const windowTo = new Date\(`\$\{rangeTo\}T23:59:59\.999Z`\);\n\s*return \{ windowFrom, windowTo \};\n\}/);
  assert.match(d, /export const within = \(day: IsoDay, from: IsoDay, to: IsoDay\): boolean => from <= day && day <= to;/);
  assert.match(d, /checkRange\(rangeFrom, rangeTo\);\n\s*const \{ windowFrom, windowTo \} = dayWindow\(rangeFrom, rangeTo\);/, 'the day rules take their window from the one helper');
  // isIsoDay builds a UTC midnight to validate a day string (:179) — not a window; the window's two bounds are written once.
  assert.equal((d.match(/\$\{rangeFrom\}T00:00:00\.000Z`\)/g) ?? []).length, 1, 'the floating start is written once');
  assert.equal((d.match(/T23:59:59\.999Z`\)/g) ?? []).length, 1, 'the floating end is written once');
  assert.match(d, /occurrences = expandBetween\(routine\.scheduleRrule, routine\.timezone, windowFrom, windowTo, scheduleAnchor\(routine\.startDate\)\);/, 'the anchored call the one-off seed names, unchanged');
  assert.match(d, /if \(!within\(day, rangeFrom, rangeTo\)\) continue;/);
});

test('T5 the today route is untouched: it reads a day through routineDay alone and names no window', () => {
  const r = code(ROUTE);
  assert.match(r, /const day = routineDay\(r, asked\.day, now\);/);
  assert.doesNotMatch(r, /dayWindow|dayBounds|windowFrom|within\(|expandBetween|expandForward|instantToZoned/, 'the day logic lives in the module');
  assert.match(r, /expected_at: expectedAt\.toISOString\(\),/);
});
