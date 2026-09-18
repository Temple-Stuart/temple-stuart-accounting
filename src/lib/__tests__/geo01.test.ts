import test from 'node:test';
import assert from 'node:assert/strict';

import { code } from '../sourceText';
import {
  textSearchUrl, searchText, readMatches, capResetsOn, remainingCalls, atCapLine, MAX_PLACE_MATCHES,
} from '../calendar/findPlace';

/**
 * GEO-01 — ONE GEOCODE, ON PURPOSE. Source reads strip comment lines first, so a
 * citation in a comment can never satisfy an assertion about the code.
 */

const ROUTE = 'src/app/api/calendar/find-place/route.ts';
// ONEOFF-01: the button moved to Tasks, intact — its new home is its own
// component, mounted by the routine creator (and the row's edit form).
const FORM = 'src/components/workbench/operations/routines/FindThisPlace.tsx';
const CREATOR = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const LEAF = 'src/lib/calendar/findPlace.ts';

/** Google's Text Search shape, as placesSearch.ts:160-175 reads it. */
const googleResult = (name: string, lat: number | null, lng: number | null, address = `${name} Rd`) => ({
  name,
  formatted_address: address,
  place_id: `pid-${name}`,
  ...(lat === null || lng === null ? {} : { geometry: { location: { lat, lng } } }),
});

// ───────────────────────────────────────────────────────────────────────────
// The press makes exactly one call; typing makes none.
// ───────────────────────────────────────────────────────────────────────────
test('the press makes exactly ONE call, and it is the only call site in the app', () => {
  const route = code(ROUTE);
  // One googleFetch in the route — the whole cost of a press.
  assert.equal((route.match(/googleFetch\s*\(/g) ?? []).length, 1);
  // And it goes through the quota guard, never straight to Google.
  assert.equal(/fetch\(\s*['"`]https:\/\/maps\.googleapis/.test(route), false);
  assert.match(route, /from '@\/lib\/googlePlacesQuota'/);

  // The form reaches the lookup from exactly one place, inside the handler.
  const form = code(FORM);
  const hits = [...form.matchAll(/\/api\/calendar\/find-place/g)];
  assert.equal(hits.length, 1, 'one call site in the form');
  const handlerAt = form.indexOf('const findThisPlace = async () =>');
  assert.ok(handlerAt > -1 && hits[0].index! > handlerAt, 'the call lives inside findThisPlace');

  // Wired to onClick and to NOTHING else.
  const wired = [...form.matchAll(/(\w+)=\{findThisPlace\}/g)].map((m) => m[1]);
  assert.deepEqual(wired, ['onClick']);
});

test('typing makes no call — no effect, no debounce, no blur, no submit spends one', () => {
  const form = code(FORM);
  const creator = code(CREATOR);
  // The component holds no effect at all, and no timer reaches the lookup.
  assert.equal(/useEffect\(/.test(form), false, 'the button component has no effect — nothing fires without a press');
  assert.equal(/setTimeout[\s\S]{0,120}findThisPlace|debounce/i.test(form), false);
  // The location input lives in the creator; its onChange only sets state and
  // drops a pick the text no longer matches.
  const locAt = creator.indexOf('data-routine-location');
  assert.ok(locAt > -1, 'the creator has the location field');
  const locInput = creator.slice(creator.lastIndexOf('<input', locAt), locAt);
  assert.ok(locInput.includes('onChange'), 'the location field has an onChange');
  assert.equal(/find-place|findThisPlace/.test(locInput), false, 'typing must not look anything up');
  assert.equal(/onBlur/.test(locInput), false, 'no onBlur on the location field at all');
  // No effect in the creator reaches it either.
  for (const m of creator.matchAll(/useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n  \}/g)) {
    assert.equal(/findThisPlace|find-place/.test(m[1]), false, 'an effect fires without a press');
  }
  // The submit path does not look anything up — saving never spends a call.
  const submitAt = creator.indexOf('const handleCreate = async () =>');
  assert.ok(submitAt > -1);
  const submitBody = creator.slice(submitAt, creator.indexOf('\n  };', submitAt));
  assert.equal(/findThisPlace|find-place/.test(submitBody), false);
  // Nor does the edit prefill in the row.
  const row = code(ROW);
  const prefill = row.slice(row.indexOf('function routineToForm'), row.indexOf('function formatDateTime'));
  assert.equal(/findThisPlace|find-place/.test(prefill), false);
});

// ───────────────────────────────────────────────────────────────────────────
// A pick fills all three fields; declining leaves coordinates null.
// ───────────────────────────────────────────────────────────────────────────
test('a pick fills location, latitude and longitude — and nothing is auto-selected', () => {
  const matches = readMatches([
    googleResult('Thonglor Barber Shop', 13.7308, 100.5698, '123 Sukhumvit 55'),
    googleResult('Barber Thonglor', 13.7295, 100.5712),
  ]);
  assert.equal(matches.length, 2);
  assert.deepEqual(matches[0], {
    name: 'Thonglor Barber Shop', address: '123 Sukhumvit 55',
    placeId: 'pid-Thonglor Barber Shop', latitude: 13.7308, longitude: 100.5698,
  });

  const form = code(FORM);
  // A pick hands the match up, and the creator sets all three fields at once.
  const pick = form.slice(form.indexOf('const pick = (m: PlaceMatch)'), form.indexOf('const clearPick'));
  assert.match(pick, /onPick\(m\)/);
  const creator = code(CREATOR);
  const onPick = creator.slice(creator.indexOf('onPick={(m) => {'), creator.indexOf('onClear={() => {'));
  assert.match(onPick, /location: m\.name, latitude: String\(m\.latitude\), longitude: String\(m\.longitude\)/);
  // NOTHING is auto-selected: no reach for the first result anywhere.
  assert.equal(/matches\[0\]|results\[0\]|\.at\(0\)/.test(form), false);
  assert.match(form, /data-find-place-match/);
});

test('declining the pick keeps the typed name with no coordinates, and the event still saves', () => {
  const form = code(FORM);
  const clearAt = form.indexOf('const clearPick = ()');
  const clear = form.slice(clearAt, form.indexOf('\n  };', clearAt));
  assert.match(clear, /onClear\(\)/);
  assert.match(form, /data-find-place-clear/);
  // The typed name SURVIVES in the creator — only the coordinates go.
  const creator = code(CREATOR);
  const onClearAt = creator.indexOf('onClear={() => {');
  const onClear = creator.slice(onClearAt, creator.indexOf('/>', onClearAt));
  assert.equal(/location:/.test(onClear), false, 'clearing a pick must not erase what was typed');
  assert.match(onClear, /latitude: '', longitude: ''/);
  // An empty coordinate box posts null, so the routine saves without a pin —
  // the typed-name-only path, still first-class.
  assert.match(creator, /latitude: createForm\.latitude \|\| null/);
  assert.match(creator, /longitude: createForm\.longitude \|\| null/);
});

// ───────────────────────────────────────────────────────────────────────────
// At the cap the button is disabled and the form still works.
// ───────────────────────────────────────────────────────────────────────────
test('at the cap the button is disabled and says so with the reset date; the typed name still saves', () => {
  assert.equal(remainingCalls(5000, 5000), 0);
  assert.equal(remainingCalls(5001, 5000), 0, 'never negative');
  assert.equal(remainingCalls(4993, 5000), 7);

  const line = atCapLine(5000, '2026-10-01');
  assert.match(line, /monthly cap of 5000/);
  assert.match(line, /resets on 2026-10-01/);
  assert.match(line, /the event still works/);

  // The reset is the 1st of next month, UTC — googlePlacesQuota keys on the UTC
  // year-month (:22-25), so that is when a new counter row begins.
  assert.equal(capResetsOn(new Date('2026-09-16T12:00:00Z')), '2026-10-01');
  assert.equal(capResetsOn(new Date('2026-12-31T23:59:59Z')), '2027-01-01');
  assert.equal(capResetsOn(new Date('2026-01-01T00:00:00Z')), '2026-02-01');

  const form = code(FORM);
  assert.match(form, /const atCap = usage != null && usage\.remaining <= 0;/);
  assert.match(form, /disabled=\{finding \|\| atCap \|\| !location\.trim\(\)\}/);
  assert.match(form, /data-find-place-at-cap/);
  assert.match(form, /atCapLine\(usage\.cap, usage\.resetsOn\)/);
  // The cap disables the LOOKUP only — the creator's submit is untouched by it.
  const creator = code(CREATOR);
  const submitBtn = creator.slice(creator.lastIndexOf('<button', creator.indexOf('data-routine-create-submit')), creator.indexOf('data-routine-create-submit'));
  assert.equal(/atCap/.test(submitBtn), false, 'the cap must not block saving the routine');
  assert.equal(/atCap/.test(creator), false, 'the creator never even sees the cap — the component owns it');

  // The route refuses at the cap BEFORE spending, and names the reset.
  const route = code(ROUTE);
  assert.match(route, /if \(before\.callCount >= before\.cap\)/);
  assert.match(route, /status: 429/);
  assert.match(route, /resetsOn: capResetsOn\(\)/);
  // …and also catches the guard's own throw, for the race between read and spend.
  assert.match(route, /err instanceof GooglePlacesQuotaError/);
});

// ───────────────────────────────────────────────────────────────────────────
// The query, the bias, and what a refusal looks like.
// ───────────────────────────────────────────────────────────────────────────
test('the query is one Text Search, biased with the label the app already holds', () => {
  assert.equal(
    textSearchUrl('Thonglor barber', 'KEY'),
    'https://maps.googleapis.com/maps/api/place/textsearch/json?query=Thonglor%20barber&key=KEY',
  );
  // The bias is the North Star's current-location LABEL, folded into the text —
  // there is no current-location COORDINATE in the schema, and turning the label
  // into one would cost a second metered call.
  assert.equal(searchText('barber', 'Bangkok'), 'barber near Bangkok');
  assert.equal(searchText('barber', null), 'barber');
  assert.equal(searchText('barber', '   '), 'barber');
  assert.match(textSearchUrl('barber', 'KEY', 'Bangkok'), /query=barber%20near%20Bangkok/);
  // One URL, no pagetoken, no radius, no second endpoint.
  const url = textSearchUrl('x', 'KEY', 'Bangkok');
  assert.equal(/pagetoken|radius=|\/geocode\//.test(url), false);

  const route = code(ROUTE);
  assert.match(route, /current_location_label: true/);
  assert.match(route, /where: \{ user_id: user\.id \}/);
});

test('a result with no geometry is dropped, and a provider refusal is named — never "no matches"', () => {
  // A match you cannot pin is not offered: picking it could not fill the fields.
  const matches = readMatches([
    googleResult('Has pin', 1, 2),
    googleResult('No geometry', null, null),
    { formatted_address: 'nameless' },
    'not an object',
  ]);
  assert.deepEqual(matches.map((m) => m.name), ['Has pin']);
  assert.deepEqual(readMatches(null), []);
  assert.deepEqual(readMatches('nope'), []);

  // At most five, however many Google returns.
  const many = readMatches(Array.from({ length: 20 }, (_, i) => googleResult(`p${i}`, i, i)));
  assert.equal(many.length, MAX_PLACE_MATCHES);
  assert.equal(MAX_PLACE_MATCHES, 5);

  const route = code(ROUTE);
  // ZERO_RESULTS is a real answer; every other non-OK status is a refusal.
  assert.match(route, /status !== 'OK' && status !== 'ZERO_RESULTS'/);
  assert.match(route, /new GooglePlacesApiError\(status/);
  assert.match(route, /status: 502/);
  // A network failure is named too.
  assert.match(route, /'NETWORK_ERROR'/);
  // A missing key is its own answer, not a crash.
  assert.match(route, /MissingGoogleKeyError/);
  assert.match(route, /status: 503/);
  // The form shows whatever the route said, verbatim.
  const form = code(FORM);
  assert.match(form, /setFindError\(data\?\.error/);
  assert.match(form, /data-find-place-error/);
});

test('results belong to the text that fetched them — none is reused against different typing', () => {
  const form = code(FORM);
  // The matches carry the query they are for, and go stale when it changes.
  assert.match(form, /const staleMatches = matches !== null && matchesFor !== null && matchesFor !== location\.trim\(\);/);
  assert.match(form, /\{matches !== null && !staleMatches && \(/);
  // A pick that no longer matches what is typed is dropped as you type — in the
  // creator and in the row's edit form alike.
  for (const f of [CREATOR, ROW]) {
    assert.match(code(f), /if \(picked && v\.trim\(\) !== picked\.name\) setPicked\(null\)/, `${f} drops a stale pick`);
  }
  // The leaf is pure — no fetch in it, so the query and the cap are testable.
  assert.equal(/fetch\s*\(/.test(code(LEAF)), false);
});
