/**
 * FINISH-01 (2026-09-28) — the travel tab reads right on a phone, and every search
 * shows its filters before Search.
 *
 * The widths themselves are measured in the walk (390×844 and 1280×800, before and
 * after — the PR carries the numbers and the screenshots). What the tree proves:
 *   · the one set of phone-card classes restores the table at `sm` in every class;
 *   · the transfers lane's logic that MOVED — the sort and the minimum rating now
 *     live in the container and reach the view as props — orders and narrows the rows
 *     exactly as the view's own state did, and the controls render no rows' note;
 *   · each view's card labels are its header words, from one constant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { PHONE_CARD } from '../travel/phoneCard';
import ActivityResultsView, { type ActivityResult } from '../../components/trips/ActivityResultsView';
import ResultsFilterBar, { ResultsShownNote } from '../../components/trips/ResultsFilterBar';

// The components compile with the classic JSX runtime under tsx (the lockedRoom.test.ts precedent).
Object.assign(globalThis, { React });

const row = (name: string, price: number | null, rating: number): ActivityResult => ({
  name, address: 'Phuket', photoUrl: null, priceLevelDisplay: null, googleRating: rating, reviewCount: 10,
  summary: '', category: 'activities', viatorProductCode: name, durationMinutes: 90, price,
});
const ROWS = [row('Airport taxi', 31, 4.4), row('Private van', 12, 4.8), row('Speedboat', 80, 3.9), row('Tuk-tuk', null, 4.6)];
const namesIn = (html: string) => [...html.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);

test('PHONE_CARD: every class is a card below sm and restores the table at sm', () => {
  assert.equal(PHONE_CARD.table, 'block sm:table');
  assert.equal(PHONE_CARD.head, 'hidden sm:table-header-group');
  assert.equal(PHONE_CARD.body, 'block sm:table-row-group');
  assert.equal(PHONE_CARD.wideRow, 'block sm:table-row');
  assert.match(PHONE_CARD.row, /^flex flex-wrap .*sm:table-row$/);
  assert.match(PHONE_CARD.cell, /^block min-w-0 \[overflow-wrap:anywhere\] sm:table-cell /);
  assert.equal(PHONE_CARD.nowrap, 'sm:whitespace-nowrap', 'a line is kept whole only where the table is');
  assert.equal(PHONE_CARD.end, 'sm:text-right');
  assert.match(PHONE_CARD.box, /\brelative\b/, 'nothing positioned inside the box widens the page');
  assert.match(PHONE_CARD.box, /\bsm:overflow-x-auto\b/);
  assert.doesNotMatch(PHONE_CARD.box, /(^|\s)overflow-x-auto/, 'no sideways scroll on a phone');
  assert.match(PHONE_CARD.label, /sm:hidden$/, 'the header row carries the words at sm');
});

test('the transfers rows are ordered and narrowed by the sort and rating the container hands down — as the view\'s own state did', () => {
  const byPrice = renderToStaticMarkup(createElement(ActivityResultsView, { results: ROWS, loading: false, error: '', sort: 'price-asc', minRating: 0 }));
  assert.deepEqual(namesIn(byPrice), ['Private van', 'Airport taxi', 'Speedboat', 'Tuk-tuk'], 'price, low to high — an unstated price last');
  const byRating = renderToStaticMarkup(createElement(ActivityResultsView, { results: ROWS, loading: false, error: '', sort: 'rating-desc', minRating: 0 }));
  assert.deepEqual(namesIn(byRating), ['Private van', 'Tuk-tuk', 'Airport taxi', 'Speedboat']);
  const narrowed = renderToStaticMarkup(createElement(ActivityResultsView, { results: ROWS, loading: false, error: '', sort: 'price-asc', minRating: 4.5 }));
  assert.deepEqual(namesIn(narrowed), ['Private van', 'Tuk-tuk']);
  assert.match(narrowed, /Showing 2 of 4/, 'the rows\' own note stays with the rows');
  // The view draws no controls of its own any more — they sit above Search.
  assert.doesNotMatch(byPrice, /data-results-filter/);
  assert.match(byPrice, /data-transfer-results/);
  // The phone card is in the markup: the table, its body rows and its cells.
  assert.match(byPrice, /<table class="block sm:table /);
  assert.equal((byPrice.match(/<tr class="flex flex-wrap/g) ?? []).length, 4, 'every result row is a card below sm');
});

test('the controls render the same two filters and no rows\' note; the note says the same words or nothing', () => {
  const bar = renderToStaticMarkup(createElement(ResultsFilterBar, { sort: 'price-asc', minRating: 0, onSortChange: () => {}, onMinRatingChange: () => {} }));
  assert.equal((bar.match(/data-results-filter="sort"/g) ?? []).length, 1);
  assert.equal((bar.match(/data-results-filter="minRating"/g) ?? []).length, 4, 'Any, 3★+, 4★+, 4.5★+');
  for (const words of ['Price: low to high', 'Price: high to low', 'Rating: high to low', 'Any', '3★+', '4★+', '4.5★+']) assert.ok(bar.includes(words), words);
  assert.doesNotMatch(bar, /Showing|Top 12/);
  assert.equal(renderToStaticMarkup(createElement(ResultsShownNote, { shownCount: 4, totalCount: 4 })), '', 'nothing narrowed, no cap — no note');
  assert.match(renderToStaticMarkup(createElement(ResultsShownNote, { shownCount: 3, totalCount: 12, capNote: 'Top 12 results' })), />Showing 3 of 12 · Top 12 results</);
});

test('the transfers form: the filters BEFORE Search; the request is still city and country; no effect runs on a filter', () => {
  const c = code('src/components/trips/PublicTransferSearch.tsx');
  const form = c.slice(c.indexOf('<form '), c.indexOf('</form>'));
  const bar = form.indexOf('<ResultsFilterBar');
  const submit = form.indexOf('type="submit"');
  assert.ok(bar > 0 && submit > bar, 'the bar is inside the form, before the submit');
  assert.match(form, /onSortChange=\{setSort\}\s*onMinRatingChange=\{setMinRating\}/, 'a control writes its value and nothing else');
  const runSearch = c.slice(c.indexOf('const runSearch = async'), c.indexOf('const search = (e'));
  assert.doesNotMatch(runSearch, /\b(sort|minRating)\b/, 'the filters are not sent — the route takes city and country');
  assert.match(runSearch, /city: cityVal\.trim\(\),\s*country: countryVal\.trim\(\),/);
  for (const m of c.matchAll(/useEffect\([\s\S]*?\},\s*\[([^\]]*)\]\)/g)) assert.doesNotMatch(m[1], /sort|minRating/, 'no effect re-runs a search on a filter');
});

test('each result view: its card labels are its header words, from one constant', () => {
  for (const f of ['ActivityPickerView', 'ActivityResultsView', 'FlightPickerView', 'HotelResultsView', 'PublicActivitySearch']) {
    const src = code(`src/components/trips/${f}.tsx`);
    const heads = new Set([...src.matchAll(/<th\b[^>]*>(\{[A-Z_]*COLUMNS\.\w+\})<\/th>/g)].map((m) => m[1]));
    const labels = [...src.matchAll(/className=\{PHONE_CARD\.label\}>(\{[A-Z_]*COLUMNS\.\w+\})</g)].map((m) => m[1]);
    assert.ok(labels.length > 0, `${f} labels its card facts`);
    for (const l of labels) assert.ok(heads.has(l), `${f}: the label ${l} is a header word`);
    assert.doesNotMatch(src, /<th\b[^>]*>[A-Za-z][^<{]*<\/th>/, `${f}: no header cell types its word`);
  }
});
