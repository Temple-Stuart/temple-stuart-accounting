/**
 * TRIPS-01 (2026-09-29) — the Travel tab is the one Trips tab; nothing leads to the
 * legacy planner.
 *
 *   · /travel?trip=<id> selects one of the user's OWN trips — the row itself, from the
 *     list AllTripsList already loads — exactly as a click would; a foreign or unknown
 *     id selects nothing and says so; a guest's tab is unchanged by ?trip.
 *   · a booking's Trip button opens /travel?trip=<its trip>.
 *   · the four legacy pages answer a 307 to the Travel tab and read nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { code, comments } from '../sourceText';
import { TRIP_NOT_YOURS, requestedTripOf, tripFromUrl, urlTripStep, type UrlTrip, type UrlTripStep } from '../trips/tripFromUrl';
import { bookingRowOf, type BookingRowReservation } from '../reservations/bookingRow';

// The launcher's tree renders JSX at module scope (travelStripModes), so React goes on
// globalThis BEFORE it is imported — the imports below are dynamic for that reason.
Object.assign(globalThis, { React });

const LIST = 'src/components/trips/AllTripsList.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
type Row = { id: string; name: string };
const MINE: readonly Row[] = [{ id: 'trip-phuket', name: 'Phuket' }, { id: 'trip-lisbon', name: 'Lisbon' }];

/**
 * AllTripsList's effect, step for step: the component calls urlTripStep with the rows
 * it fetched and, on an answer, `onSelect(trip)` (the click's own call) then
 * `onUrlTripAnswered(verdict)`. The source test below holds the component to exactly
 * this shape; here the sequence runs.
 */
function drive(events: Array<{ requested: string | null; loaded: boolean; rows?: readonly Row[] }>) {
  let answered: string | null = null;
  let shown: UrlTrip<Row> | null = null;
  const selected: Row[] = [];
  const answers: UrlTrip<Row>[] = [];
  for (const e of events) {
    const step: UrlTripStep<Row> = urlTripStep(e.requested, e.loaded, e.rows ?? MINE, answered);
    if (step.kind === 'wait') continue;
    if (step.kind === 'forget') { answered = null; continue; }
    answered = step.id;
    shown = step.verdict;
    if (step.verdict.kind === 'selected') selected.push(step.verdict.trip);
    answers.push(step.verdict);
  }
  return { selected, answers, line: shown?.kind === 'notYours' ? TRIP_NOT_YOURS : null };
}

test('an own trip in ?trip is selected — the row itself, from the loaded list, once the list has loaded, once per arrival', () => {
  const own = tripFromUrl('trip-lisbon', MINE);
  assert.equal(own.kind, 'selected');
  assert.equal(own.kind === 'selected' && own.trip, MINE[1], 'the very row the list loaded — never a copy, never built from the id');

  const run = drive([
    { requested: 'trip-lisbon', loaded: false, rows: [] }, // the list is still loading: nothing yet
    { requested: 'trip-lisbon', loaded: true },            // loaded: answered, selected
    { requested: 'trip-lisbon', loaded: true },            // a refresh of the list: not answered again
  ]);
  assert.deepEqual(run.selected, [MINE[1]]);
  assert.equal(run.line, null);

  // The tab consumes ?trip; the same link followed again (a booking's Trip button,
  // from this tab) is answered again.
  const again = drive([
    { requested: 'trip-phuket', loaded: true },
    { requested: null, loaded: true },
    { requested: 'trip-phuket', loaded: true },
  ]);
  assert.deepEqual(again.selected, [MINE[0], MINE[0]]);

  // A failed load answers nothing — the list's own error says why.
  assert.equal(urlTripStep('trip-phuket', false, MINE, null).kind, 'wait');
});

test('a foreign or unknown id selects nothing and says so, in one line — the same line for both', () => {
  assert.equal(TRIP_NOT_YOURS, "That trip isn't in your trips.");
  for (const id of ['trip-of-another-user', 'no-such-trip', '', 'TRIP-PHUKET', 'trip-phuke']) {
    const run = drive([{ requested: id, loaded: true }]);
    assert.deepEqual(run.selected, [], `${JSON.stringify(id)} selects nothing`);
    assert.deepEqual(run.answers, [{ kind: 'notYours' }], `${JSON.stringify(id)} is answered as not yours — foreign and unknown alike`);
    assert.equal(run.line, TRIP_NOT_YOURS);
  }
  // A user with no trips: every id is not theirs.
  assert.deepEqual(drive([{ requested: 'trip-phuket', loaded: true, rows: [] }]).selected, []);
  // A later own link replaces the line with a selection.
  const recovered = drive([{ requested: 'no-such-trip', loaded: true }, { requested: null, loaded: true }, { requested: 'trip-phuket', loaded: true }]);
  assert.deepEqual(recovered.selected, [MINE[0]]);
  assert.equal(recovered.line, null);
});

test('only /travel asks for a trip', () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.equal(requestedTripOf('/travel', q('trip=trip-phuket')), 'trip-phuket');
  assert.equal(requestedTripOf('/travel', q('')), null);
  assert.equal(requestedTripOf('/travel', null), null);
  for (const path of ['/runway', '/books', '/budgets/trips', '/', null]) assert.equal(requestedTripOf(path, q('trip=trip-phuket')), null, `${path} asks for none`);
});

test('AllTripsList answers from the rows it fetched and selects with the click’s own call; no new fetch', () => {
  const list = code(LIST);
  assert.match(list, /const step = urlTripStep\(requestedTripId, !loading && error === null, trips, answered\);/);
  assert.match(list, /if \(step\.verdict\.kind === 'selected'\) onSelect\?\.\(step\.verdict\.trip\);/);
  assert.match(list, /onClick=\{\(\) => onSelect\?\.\(trip\)\}/);
  assert.equal((list.match(/\bonSelect\?\.\(/g) ?? []).length, 2, 'a click, and the URL answer — nothing else selects');
  assert.deepEqual([...list.matchAll(/\bfetch\(([^)]*)\)/g)].map((m) => m[1]).sort(), ["'/api/trips'", "`/api/trips/${trip.id}`, { method: 'DELETE' }"].sort());
  assert.match(list, /\{urlTrip\?\.kind === 'notYours' && \(\s*<p [^>]*data-url-trip-missing>\{TRIP_NOT_YOURS\}<\/p>/);
  assert.match(comments(LIST), /TRIPS-01 \(2026-09-29\)/);
  // The route those rows come from is the caller's own.
  assert.match(code('src/app/api/trips/route.ts'), /prisma\.trips\.findMany\(\{\s*where: \{ userId: user\.id \}/);
});

/** The Travel tab as Next renders it for a visitor whose sign-in has not resolved — the guest branch. */
async function travelRegion(pathname: string, search: string): Promise<string> {
  const { RailStateProvider } = await import('../../components/shell/RailState');
  const { default: ModuleLauncher } = await import('../../components/home/ModuleLauncher');
  const tree = React.createElement(PathnameContext.Provider, { value: pathname },
    React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(search) },
      React.createElement(RailStateProvider, null, React.createElement(ModuleLauncher, { onRequireAuth: () => {} }))));
  const html = renderToStaticMarkup(tree);
  const from = html.indexOf('data-travel-section="header"');
  const to = html.indexOf('</section>', html.indexOf('data-travel-section="unattached"'));
  assert.ok(from > 0 && to > from, 'the travel region renders');
  return html.slice(from, to);
}

test('a guest’s Travel tab is unchanged by ?trip — the same markup, no list, no line', async () => {
  const plain = await travelRegion('/travel', '');
  for (const search of ['trip=trip-phuket', 'trip=trip-of-another-user', 'trip=']) {
    assert.equal(await travelRegion('/travel', search), plain, `?${search} changes nothing for a guest`);
  }
  assert.match(plain, /Sign up free to save trips here/);
  assert.doesNotMatch(plain, /data-url-trip-missing|Your trips<\/p>|Loading your trips/);
  // Structurally: ?trip is handed to AllTripsList alone, and AllTripsList mounts only
  // in the signed-in branch of the trips section.
  const launcher = code(LAUNCHER);
  assert.match(launcher, /const requestedTripId = requestedTripOf\(usePathname\(\), useSearchParams\(\)\);/);
  assert.equal((launcher.match(/\brequestedTripId\b/g) ?? []).length, 3);
  const listAt = launcher.indexOf('<AllTripsList');
  assert.ok(launcher.indexOf('data-travel-section="trips"') < launcher.lastIndexOf('{authed === true ? (', listAt));
  assert.match(launcher.slice(listAt, launcher.indexOf('/>', listAt)), /onSelect=\{setCurrentTrip\}[\s\S]*requestedTripId=\{requestedTripId\}[\s\S]*onUrlTripAnswered=\{answerUrlTrip\}/);
});

test('tripHref: a booking on a trip opens /travel?trip=<its trip>; one on no trip, none', () => {
  const base: BookingRowReservation = {
    id: 'r1', lane: 'hotel', displayName: 'Hotel Temple', providerConfirmationCode: 'C1', providerBookingId: 'b1',
    status: 'confirmed', tripId: 'trip-phuket', checkinDate: '2026-10-01', checkoutDate: '2026-10-03',
    ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: null,
    finalPriceCents: 18000, currency: 'USD', createdAt: '2026-09-20T10:00:00.000Z',
  };
  const row = (r: BookingRowReservation) => bookingRowOf({ reservation: r, calendarDay: null, chargeMatched: false, chargePosted: false, budgetLine: null });
  assert.equal(row(base).tripHref, '/travel?trip=trip-phuket');
  assert.equal(row({ ...base, tripId: null }).tripHref, null);
  assert.match(code('src/components/trips/AllBookings.tsx'), /<Link href=\{b\.tripHref\}[^>]*data-booking-trip=\{b\.id\}>/, 'the Trip button renders the row’s own href');
  assert.match(code('src/components/trips/CreateTripForm.tsx'), /router\.push\(`\/travel\?trip=\$\{newId\}`\);/);
});

const PAGES: ReadonlyArray<{ file: string; load: () => Promise<{ default: (p: never) => unknown }>; params?: Record<string, string>; target: string }> = [
  { file: 'src/app/budgets/trips/page.tsx', load: () => import('../../app/budgets/trips/page'), target: '/travel' },
  { file: 'src/app/budgets/trips/new/page.tsx', load: () => import('../../app/budgets/trips/new/page'), target: '/travel' },
  { file: 'src/app/budgets/trips/[id]/page.tsx', load: () => import('../../app/budgets/trips/[id]/page'), params: { id: 'trip-phuket' }, target: '/travel?trip=trip-phuket' },
  { file: 'src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx', load: () => import('../../app/budgets/trips/[id]/discover/[category]/[rank]/page'), params: { id: 'trip-phuket', category: 'lodging', rank: '3' }, target: '/travel?trip=trip-phuket' },
];

/** What a page answers: Next's redirect() throws; its digest carries the type, the URL and the status. */
async function answerOf(page: (typeof PAGES)[number], params = page.params): Promise<string> {
  const { default: Page } = await page.load();
  try {
    await Page((params ? { params: Promise.resolve(params) } : {}) as never);
  } catch (e) {
    return String((e as { digest?: unknown }).digest);
  }
  return 'rendered — no redirect';
}

test('the four legacy pages answer a 307 to the Travel tab, and read nothing', async () => {
  for (const page of PAGES) {
    assert.equal(await answerOf(page), `NEXT_REDIRECT;replace;${page.target};307;`, page.file);
    const body = code(page.file);
    assert.deepEqual(body.split('\n').filter((l) => /^\s*import\b/.test(l)).map((l) => l.trim()), ["import { redirect } from 'next/navigation';"], `${page.file} imports only redirect`);
    assert.doesNotMatch(body, /\bprisma\b|\bfetch\(|cookies\(|getVerifiedEmail|<[A-Za-z]|\breturn\b|use client/, `${page.file} has no UI and reads no data`);
    assert.match(comments(page.file), /TRIPS-01 \(2026-09-29\)/);
  }
  // The id rides along encoded — it cannot add a parameter of its own.
  assert.equal(await answerOf(PAGES[2], { id: 'x&tab=books' }), 'NEXT_REDIRECT;replace;/travel?trip=x%26tab%3Dbooks;307;');
});
