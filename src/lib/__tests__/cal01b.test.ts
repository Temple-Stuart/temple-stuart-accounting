/**
 * CAL-01 (2026-10-24) — the seven retired tools' event sources leave the calendar grid.
 *
 * agenda, home, shopping, personal, auto, growth and health were written only by
 * routes whose tools are retired — the six-category budget screens left /budget
 * with TAB13-02b (#1767, 2026-09-27); /agenda and /shopping became redirects with
 * BUDGET-02 (#1846, 2026-10-20) — and no screen calls those routes now. Ruling A:
 * they move from the rendered allowlist to EXCLUDED_CALENDAR_SOURCES with a dated
 * reason each; the hub's load filter (DAY-01's shape) drops their rows; GET
 * /api/calendar is NOT changed. Ruling C: no row is deleted, nothing else moves.
 *
 * cal01.test.ts is CAL-01 of 2026-09-23 (a booking lands on the calendar); this
 * file is the 2026-10-24 ruling's and does not touch it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CALENDAR_SOURCES, EXCLUDED_CALENDAR_SOURCES, calendarSourcesLaw, isRenderedCalendarSource } from '../calendar/sources';
import { EVENT_SOURCE_OWNER, ownerOf } from '../calendar/chain';
import { EVENT_CATEGORIES } from '../calendar/manualEvent';
import { code } from '../sourceText';

const HUB = 'src/components/hub/HubCalendar.tsx';
const SOURCES = 'src/lib/calendar/sources.ts';
const CHAIN = 'src/lib/calendar/chain.ts';
const CALENDAR_ROUTE = 'src/app/api/calendar/route.ts';
/** sha256 of code(CALENDAR_ROUTE) on origin/main 1a1fe5ec, the head this PR branched from — ruling A: the route is not changed. */
const CALENDAR_ROUTE_SHA256 = '2025cd151c16c358ee764eee13430218eb31bc21ae7f434c2a4d56990e321f59';

const RETIRED = ['agenda', 'home', 'shopping', 'personal', 'auto', 'growth', 'health'] as const;
type Retired = (typeof RETIRED)[number];
/** The writer each reason must name — the retired route's INSERT INTO calendar_events line (CAL-00's census). */
const WRITER: Record<Retired, readonly string[]> = {
  agenda: ['src/app/api/agenda/[id]/route.ts:84'],
  home: ['src/app/api/home/[id]/route.ts:83'],
  shopping: ['src/app/api/shopping/[id]/route.ts:83', 'src/app/api/shopping/commit/route.ts:84'],
  personal: ['src/app/api/budget/[module]/[id]/route.ts:104'],
  auto: ['src/app/api/budget/[module]/[id]/route.ts:104'],
  growth: ['src/app/api/budget/[module]/[id]/route.ts:104'],
  health: ['src/app/api/budget/[module]/[id]/route.ts:104'],
};
/** The PR that retired the tool, as the reason must name it. */
const RETIRED_IN: Record<Retired, RegExp> = {
  agenda: /, a tool retired in BUDGET-02 \(#1846, 2026-10-20/,
  shopping: /, a tool retired in BUDGET-02 \(#1846, 2026-10-20/,
  home: /, a tool retired in TAB13-02b \(#1767, 2026-09-27/,
  personal: /, a tool retired in TAB13-02b \(#1767, 2026-09-27/,
  auto: /, a tool retired in TAB13-02b \(#1767, 2026-09-27/,
  growth: /, a tool retired in TAB13-02b \(#1767, 2026-09-27/,
  health: /, a tool retired in TAB13-02b \(#1767, 2026-09-27/,
};
const lineOf = (f: string, n: number) => code(f).split('\n')[n - 1] ?? '';
const excluded = (s: string) => EXCLUDED_CALENDAR_SOURCES.find((e) => e.source === s);

test('T1 the seven are EXCLUDED by name, each with a dated reason naming its writer and the PR that retired its tool; none renders', () => {
  for (const s of RETIRED) {
    const e = excluded(s);
    assert.ok(e, `${s} is named EXCLUDED`);
    assert.match(e!.why, /^written only by /);
    for (const w of WRITER[s]) assert.ok(e!.why.includes(w), `${s}'s reason names its writer ${w}`);
    assert.match(e!.why, RETIRED_IN[s]);
    assert.match(e!.why, /; its rows stay in calendar_events until TABLES exports and drops them \(2026-10-24\)$/);
    assert.equal(isRenderedCalendarSource(s), false, `${s} does not render`);
    assert.equal(CALENDAR_SOURCES.some((r) => r.source === s), false, `${s} is off the allowlist`);
  }
  // Each writer a reason cites is a real line, and it is the row's INSERT (ruling C: the routes are untouched).
  for (const s of RETIRED) {
    for (const w of WRITER[s]) {
      const at = w.lastIndexOf(':');
      assert.match(lineOf(w.slice(0, at), Number(w.slice(at + 1))), /INSERT INTO calendar_events/, `${w} is the INSERT`);
    }
  }
  assert.doesNotThrow(() => calendarSourcesLaw());
});

test('T2 the allowlist is manual, trip and reservation in the day\'s order, unchanged in label, icon and tint; the two merged layers are still the first exclusions', () => {
  assert.deepEqual(CALENDAR_SOURCES.map((r) => r.source), ['manual', 'trip', 'reservation']);
  assert.deepEqual(EXCLUDED_CALENDAR_SOURCES.slice(0, 2).map((e) => e.source), ['project', 'routines']);
  for (const e of EXCLUDED_CALENDAR_SOURCES.slice(0, 2)) {
    assert.match(e.why, /^not a calendar_events row — .* merged separately; admitting it here would draw each (block|occurrence) twice$/);
  }
  assert.deepEqual(EXCLUDED_CALENDAR_SOURCES.slice(2).map((e) => e.source), [...RETIRED]);
  const by = (s: string) => CALENDAR_SOURCES.find((r) => r.source === s)!;
  assert.deepEqual([by('manual').label, by('trip').label, by('reservation').label], ['Added by hand', 'Trips', 'Bookings']);
  assert.deepEqual([by('manual').icon, by('trip').icon, by('reservation').icon], ['✍️', '✈️', '🏨']);
  assert.deepEqual([by('manual').tint.dot, by('trip').tint.dot, by('reservation').tint.dot], ['bg-rose-500', 'bg-cyan-500', 'bg-amber-500']);
});

test('T3 the drill owner map has no key for a retired source and keeps a door for every rendered one', () => {
  for (const s of RETIRED) {
    assert.equal(EVENT_SOURCE_OWNER[s], undefined, `${s} has no owner`);
    assert.throws(() => ownerOf('calendar_event', s), /has no owner/);
  }
  assert.deepEqual(Object.keys(EVENT_SOURCE_OWNER).sort(), CALENDAR_SOURCES.map((r) => r.source).sort());
  assert.equal(ownerOf('calendar_event', 'manual'), 'Calendar');
  assert.equal(ownerOf('calendar_event', 'trip'), 'Travel');
  assert.equal(ownerOf('calendar_event', 'reservation'), 'Travel');
  // And the map's own text keys none of the seven (comments aside — code() strips them).
  const chain = code(CHAIN);
  for (const s of RETIRED) assert.equal(new RegExp(`^\\s*${s}:\\s*'`, 'm').test(chain), false, `${s} is not a key in chain.ts`);
});

test('T4 the hub still asks the allowlist at load — the filter line as DAY-01 wrote it — and builds its legend config from the allowlist alone, typing no source name of its own', () => {
  const hub = code(HUB);
  assert.ok(hub.includes('setEvents(raw.filter((e) => isRenderedCalendarSource(e.source)));'), 'the load filter is unchanged');
  assert.match(hub, /\.\.\.Object\.fromEntries\(CALENDAR_SOURCES\.map\(\(s\) => \[s\.source, \{/, 'the legend config derives from the allowlist');
  for (const s of RETIRED) assert.equal(new RegExp(`'${s}'`).test(hub), false, `the hub does not type '${s}'`);
  assert.equal(/e\.source === '/.test(hub), false, 'no bare source filter');
});

test('T5 GET /api/calendar is not changed — it still returns every row of the caller; the filter is the grid\'s (ruling A)', () => {
  const route = code(CALENDAR_ROUTE);
  assert.equal(createHash('sha256').update(route).digest('hex'), CALENDAR_ROUTE_SHA256, 'the route reads as it did on origin/main 1a1fe5ec');
  assert.match(route, /SELECT \* FROM calendar_events\s+WHERE user_id = \$\{user\.id\}/);
  assert.doesNotMatch(route, /isRenderedCalendarSource|CALENDAR_SOURCES|EXCLUDED_CALENDAR_SOURCES/);
});

test('T6 no row is deleted: no file this PR changes deletes from calendar_events or issues a query, and the ICS exports do not read the allowlist (ruling C)', () => {
  // The patterns are assembled so this file's own text cannot satisfy them. The
  // pinned test files are not scanned: a pin that QUOTES a route's SQL (event01
  // quotes the manual route's DELETE) is not a deletion by this PR.
  const deletes = new RegExp(['DELETE FROM ', 'calendar_events'].join('') + '|' + ['calendar_events', '.delete'].join('\\'), 'i');
  const queries = new RegExp(['\\$', 'queryRaw'].join('') + '|' + ['\\$', 'executeRaw'].join('') + '|' + ['prisma', '.'].join('\\') + '[a-z_]+\\.(find|create|update|delete|upsert)');
  for (const f of [SOURCES, CHAIN, 'src/lib/toolRegistry.ts', 'src/lib/__tests__/cal01b.test.ts']) {
    const body = code(f);
    assert.doesNotMatch(body, deletes, `${f} deletes no row`);
    assert.doesNotMatch(body, queries, `${f} issues no query`);
  }
  // And the patterns are live: the manual route's DELETE and the hub's reads would be caught.
  assert.match(code('src/app/api/calendar/events/route.ts'), deletes);
  assert.match(code('src/app/api/calendar/events/route.ts'), queries);
  for (const f of ['src/lib/calendar/ics.ts', 'src/lib/calendar/icsExport.ts', 'src/lib/calendar/prismaIcsPorts.ts']) {
    assert.doesNotMatch(code(f), /calendar\/sources|isRenderedCalendarSource/, `${f} does not read the allowlist, so the exclusion cannot reach it`);
  }
});

test('T7 the category census stays for CLEAN: the retired writers\' categories are still listed (fact 8)', () => {
  for (const c of ['home', 'shopping', 'personal', 'auto', 'growth', 'health']) {
    assert.ok(EVENT_CATEGORIES.some((e) => e.category === c), `${c} is still in the census`);
  }
});
