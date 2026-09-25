/**
 * FILTER-01 (2026-09-25) — the filters sit above Search, on every tab.
 *
 * The DOM order, the zero-fetch filter change, the byte-for-byte request and the
 * phone width are proved in the walk (scripts are not the tree). What the tree can
 * prove is the STRUCTURE the walk relies on: the bar lives in the view file the
 * FLIGHT-01 / HOTEL-01 / ACTIVITY-01 laws read, it is mounted by the container
 * INSIDE the form before the submit, and the view no longer draws it after the
 * fact — while every law those rulings wrote still passes unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { code } from '../sourceText';

const HOTEL_VIEW = 'src/components/trips/HotelResultsView.tsx';
const HOTEL_CONTAINER = 'src/components/trips/PublicHotelSearch.tsx';
const ACTIVITY_VIEW = 'src/components/trips/ActivityPickerView.tsx';
const ACTIVITY_CONTAINER = 'src/components/trips/PublicActivitySearch.tsx';
const FLIGHT_VIEW = 'src/components/trips/FlightPickerView.tsx';
const FLIGHT_CONTAINER = 'src/components/trips/PublicFlightSearch.tsx';

/** The form's text from `<form` to `</form>`, and where its submit sits inside it. */
function formOf(src: string) {
  const start = src.indexOf('<form ');
  const end = src.indexOf('</form>', start);
  assert.ok(start > 0 && end > start, 'one form');
  const form = src.slice(start, end);
  const submit = form.indexOf('type="submit"');
  assert.ok(submit > 0, 'the form has a submit');
  return { form, submit };
}

test('hotels: the bar is exported from the view, mounted in the form BEFORE the submit, and drawn nowhere else', () => {
  const view = code(HOTEL_VIEW);
  assert.match(view, /export function HotelFiltersBar\(/, 'the bar is a component the container can mount');
  // The bar text the hotel law reads is still in this file, unchanged in shape.
  const bar = view.slice(view.indexOf('data-hotel-filters>'), view.indexOf('data-hotel-filters-stated'));
  assert.equal((bar.match(/onFiltersChange\(\{/g) ?? []).length, 5);
  assert.ok(!/\{bar\}/.test(view), 'the results view no longer renders a bar of its own');
  const container = code(HOTEL_CONTAINER);
  const { form, submit } = formOf(container);
  const mount = form.indexOf('<HotelFiltersBar');
  assert.ok(mount > 0 && mount < submit, 'the bar is INSIDE the form, before the submit');
  assert.match(form, /onFiltersChange=\{\(patch\) => setFilters\(\(f\) => \(\{ \.\.\.f, \.\.\.patch \}\)\)\}/, 'the same handler');
  assert.match(form, /searchCount=\{searchCount\}/, 'the same count, beside the controls');
  // The results view is handed the filters only for the per-night range — no handler, no count.
  const viewMount = container.slice(container.indexOf('<HotelResultsView'), container.indexOf('onCloseCheckout=', container.indexOf('<HotelResultsView')));
  assert.ok(!/onFiltersChange=|searchCount=/.test(viewMount), 'the view mount carries no filter handler');
  assert.ok(!/onFiltersChange|searchCount: number/.test(view.slice(view.indexOf('interface Props'), view.indexOf('export function HotelFiltersBar'))), 'the view\'s Props no longer carry them');
});

test('activities: the bar is exported from the picker, mounted in the form BEFORE the submit, and drawn nowhere else', () => {
  const view = code(ACTIVITY_VIEW);
  assert.match(view, /export function ActivityFiltersBar\(/);
  const bar = view.slice(view.indexOf('data-activity-filters>'), view.indexOf('data-activity-filters-stated'));
  assert.equal((bar.match(/onFiltersChange\(\{/g) ?? []).length, 8, 'eight controls, unchanged');
  assert.ok(!/\{bar\}/.test(view));
  const container = code(ACTIVITY_CONTAINER);
  const { form, submit } = formOf(container);
  const mount = form.indexOf('<ActivityFiltersBar');
  assert.ok(mount > 0 && mount < submit, 'the bar is INSIDE the form, before the submit');
  assert.match(form, /onFiltersChange=\{\(patch\) => setFilters\(\(f\) => \(\{ \.\.\.f, \.\.\.patch \}\)\)\}/);
  assert.match(form, /sentCurrency=\{ACTIVITY_SEARCH_CURRENCY\}/, 'the statement still names the currency the search sends');
  // SHOW THEM ALL is untouched: Next repeats the sent filters; a change restarts from page one.
  assert.match(container, /const page = await fetchPage\(sentFilters, cards\.length \+ 1\);/);
  assert.match(container, /await fetchPage\(filters, 1\);/);
  assert.match(container, /const filtersChanged = sentFilters !== null && JSON\.stringify\(filters\) !== JSON\.stringify\(sentFilters\);/);
  assert.match(view, /disabled=\{!hasMore \|\| filtersChanged \|\| loadingMore\}/, 'Next waits after a change');
});

test('flights: per leg, the fields, then the six controls and the statement, then SEARCH — the container is untouched', () => {
  const view = code(FLIGHT_VIEW);
  const leg = view.slice(view.indexOf('placeholder="LAX"'), view.indexOf('{leg.error && ('));
  const bar = leg.indexOf('data-flight-filters>');
  const stated = leg.indexOf('data-flight-filters-stated');
  const search = leg.indexOf('onSearchLeg(leg.id)');
  assert.ok(bar > 0 && stated > bar && search > stated, 'fields → filters → statement → SEARCH, in that order');
  assert.equal((view.match(/onSearchLeg\(/g) ?? []).length, 1, 'still exactly one SEARCH');
  assert.equal((leg.match(/setFilters\(leg, \{/g) ?? []).length, 6, 'six controls, unchanged');
  // The field strip no longer holds the SEARCH button: the actions row is its own block beneath the bar.
  const strip = leg.slice(0, bar);
  assert.ok(!/onSearchLeg|SearchCount/.test(strip), 'the field strip is the fields alone');
  // No change to what a search sends.
  assert.match(code(FLIGHT_CONTAINER), /body: JSON\.stringify\(\{ legs: searchLegs, adults: 1, currency: 'USD', \.\.\.searchRequestOf\(leg\.filters\) \}\)/);
});

test('the request each Search press sends is the fixture captured on main — the walk asserts it byte for byte', () => {
  const fixture = JSON.parse(readFileSync('src/lib/__tests__/fixtureFilter01Requests.json', 'utf8')) as Record<string, string>;
  for (const key of ['hotels', 'flights', 'activitiesSearch', 'activitiesNext', 'activitiesResearch']) {
    assert.ok(typeof fixture[key] === 'string' && fixture[key].length > 20, `${key} was captured`);
  }
  assert.match(fixture._captured, /captured on main e67263dc/);
  // What was captured is what the contracts send: the vendor's own names, only what the screen set.
  assert.match(fixture.hotels, /starRating=4%2C4\.5%2C5&refundableRatesOnly=true&sort=price&sortDirection=ascending$/);
  assert.match(fixture.flights, /"filters":\{"cabinClass":"BUSINESS","cabinClassMatch":"exactly","maxStops":0,"refundableOnly":true,"includesCheckedBag":true,"departureTimeAfter":"05:00","departureTimeBefore":"11:59"\},"sort":\{"sortBy":"duration","sortOrder":"asc"\}/);
  assert.equal(fixture.activitiesNext, `${fixture.activitiesSearch}&start=51`, 'Next = the same filters + the vendor\'s cursor');
  assert.ok(!/start=/.test(fixture.activitiesResearch) && /ratingFrom=3/.test(fixture.activitiesResearch), 'a changed filter restarts from page one');
});
