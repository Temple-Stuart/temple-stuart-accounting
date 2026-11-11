/**
 * HOME-BRIEF-05 (Alex, 2026-11-10 19:00: "start with events, and then once you select them, do flights, and hotels";
 * 2026-11-09 17:45: "would be cool if that populated destination but like user gonna wanna pick their own travel dates") —
 * STAY NEAR IT: an event row's one action opens the booking box's Hotels tab with the event's place set — the country
 * always, the city when the hotel list holds it; never a date, never a search.
 *
 *   T1 the words and the rule — "Stay near it →"; canStayNear over the leaf: 169 rows with a fixed city, 2 without; the
 *      line's words; a row with no city is refused by name;
 *   T2 the row — rendered with no handler it draws no action (every other test's render); with one, every row whose city
 *      is fixed carries the button in its body, under its note, in the Source link's look, with no aria-pressed, the foot
 *      still last; the two rows with no city carry none; a press hands the handler its row;
 *   T3 the matcher — exact, trimmed, any case, accent-folded; the answer is the list's own string; none, a partial, a
 *      nearest and two matches are all null;
 *   T4 the picker — its static render with no starting place is today's, byte for byte (and the same with one: the
 *      place acts in an effect); the two sentences; the source: one loader, no call for a list already held, an
 *      overtaken answer dropped, the three outcomes, two list routes and nothing else;
 *   T5 the strip — with neither prop its first mode is open; with both, the held one; one without the other throws;
 *   T6 the box — at rest: no line, no starting place, the Hotels panel is the builder's own and (HOME-FINISH-02,
 *      2026-11-10) the commission disclosure is its last line, after the form; after a press (made while
 *      the box renders, so the renderer draws it again): Hotels is open, the line stands over the form with
 *      role="status", the place is the row's; the same row pressed again is a new place; no 'hotels' mode is a throw;
 *   T7 the freeze — travelStripModes.tsx, PublicHotelSearch.tsx and PublicFlightSearch.tsx still hash to their pins, and
 *      the new files call nothing but what the picker called before.
 * Source is read through code() and comments() only (the reader law). No clock, no network, no new test tooling: pure
 * functions, static renders, and a component called inside a host's render where a hook needs one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { EXPERIENCES, VENUE_NOT_FIXED, type Experience } from '../experiences';
import { ExperienceWordsError, STAY_NEAR_WORDS, canStayNear, stayNearLine } from '../experienceWords';
import { BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import { COMMISSION_LINE } from '../disclosureWords';
import { StartingPlaceContext, cityNotInListLine, countryNotInListLine, matchCity, type StartingPlace } from '@/components/trips/startingPlace';
import { ExperiencesView, SOURCE_LINK, StayNearContext } from '@/components/landing/ExperiencesSection';
import type { ToggleMode } from '@/components/ui/ToggleStrip';

Object.assign(globalThis, { React });

const WORDS = 'src/lib/experienceWords.ts';
const PLACE = 'src/components/trips/startingPlace.ts';
const PICKER = 'src/components/trips/CountryCityPicker.tsx';
const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const WRAPPER = 'src/components/landing/LandingBookingSection.tsx';
const STRIP_MODES = 'src/components/trips/travelStripModes.tsx';
const HOTEL_FORM = 'src/components/trips/PublicHotelSearch.tsx';
const FLIGHT_FORM = 'src/components/trips/PublicFlightSearch.tsx';
const TODAY = '2026-10-30';
/** The Source link's classes — the action wears them (ExperiencesSection.tsx EXP.source). */
const SOURCE_LOOK = 'inline-flex min-h-[44px] items-center font-mono text-xs text-brand-purple underline-offset-4 hover:text-brand-purple-hover hover:underline';
/**
 * The picker's static render on main 4564346, before a starting place existed — captured from that file and held here
 * whole: with no starting place the picker must draw exactly this.
 */
const PICKER_TODAY = '<div class="col-span-full grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-3"><label class="flex flex-col gap-1"><span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">Country</span><select disabled="" class="bg-bg-row border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-brand-purple" aria-label="Destination country"><option value="" selected="">Loading countries…</option></select></label><div class="flex flex-col gap-1"><span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">City</span><div class="relative"><input type="text" disabled="" placeholder="Pick a country first" class="bg-bg-row border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-brand-purple w-full " aria-label="Destination city" value=""/></div></div></div>';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
/** React's escaping of text. */
const asHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
/** A string, as a regular expression that matches exactly it. */
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const row = (id: string): Experience => {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
type El = React.ReactElement<Record<string, unknown>>;
/** Every element in a tree, depth first — through props.children only; a component is not rendered here. */
const elementsIn = (node: React.ReactNode): El[] => (Array.isArray(node) ? node.flatMap((n) => elementsIn(n as React.ReactNode))
  : React.isValidElement<Record<string, unknown>>(node) ? [node, ...elementsIn(node.props.children as React.ReactNode)] : []);
const view = (category: Experience['category'], onStayNear?: (r: Experience) => void): string => {
  const catalog = React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, choice: { category }, onPick: () => {} });
  return renderToStaticMarkup(onStayNear === undefined ? catalog : React.createElement(StayNearContext.Provider, { value: onStayNear }, catalog));
};
const cardOf = (html: string, id: string): string => {
  const m = new RegExp(`<article class="[^"]*" data-coming-up="${id}">([\\s\\S]*?)</article>`).exec(html);
  assert.ok(m, `${id}: its row is drawn`);
  return m[1];
};

// ── T1 · THE WORDS AND THE RULE ──────────────────────────────────────────────

test('T1 the words and the rule: "Stay near it →"; 169 rows can be stayed near and 2 cannot — exactly the two whose city is not fixed; the line names the event and its place; a row with no city is refused by name', () => {
  assert.equal(STAY_NEAR_WORDS, 'Stay near it →');
  const can = EXPERIENCES.filter((r) => canStayNear(r));
  const cannot = EXPERIENCES.filter((r) => !canStayNear(r));
  assert.equal(EXPERIENCES.length, 171);
  assert.equal(can.length, 169, 'every row whose city is fixed');
  assert.equal(cannot.length, 2, 'the two whose city is not');
  assert.deepEqual(cannot.map((r) => r.id), ['x-games-summer-2027', 'world-skate-championships-next']);
  assert.ok(cannot.every((r) => r.city === VENUE_NOT_FIXED) && can.every((r) => r.city !== VENUE_NOT_FIXED), 'the rule is the city, read off the row');
  assert.equal(VENUE_NOT_FIXED, '—');
  // the rule reads the place, never a status: both kinds of row hold every status the leaf has for them
  assert.ok(new Set(can.map((r) => r.status)).size > 1, 'rows that can be stayed near are of more than one status');
  assert.equal(canStayNear({ city: 'Augusta' }), true);
  assert.equal(canStayNear({ city: VENUE_NOT_FIXED }), false);
  // the line
  assert.equal(stayNearLine(row('masters-2027')), 'Stay near The Masters Tournament — Augusta National Golf Club · Augusta, USA. Set your dates, then Search.');
  for (const r of can) assert.equal(stayNearLine(r), `Stay near ${r.name} — ${r.venue} · ${r.city}, ${r.country}. Set your dates, then Search.`, `${r.id}: the event, its venue, its city, its country`);
  for (const r of can) assert.doesNotMatch(stayNearLine(r), /\d{4}-\d{2}-\d{2}/, `${r.id}: never a date — the dates stay the visitor's`);
  for (const r of cannot) assert.throws(() => stayNearLine(r), (e: unknown) => e instanceof ExperienceWordsError && e.message === `${r.id}: its city is not fixed — there is no place to stay near`, `${r.id}: refused by name`);
  // the source: the leaf's own mark, read — the rule types no city and no status
  const words = code(WORDS);
  assert.match(words, /^import \{ VENUE_NOT_FIXED, type Experience \} from '\.\/experiences';$/m, 'the mark comes from the leaf');
  assert.match(words, /export function canStayNear\(row: Pick<Experience, 'city'>\): boolean \{\n\s*return row\.city !== VENUE_NOT_FIXED;\n\}/, 'the rule, whole');
  assert.match(words, /^export const STAY_NEAR_WORDS = 'Stay near it →';$/m);
  assert.doesNotMatch(words, /new Date\(|Date\.now\(|toLocale|\bfetch\s*\(/, 'still pure: no clock, no locale, no fetch');
});

// ── T2 · THE ROW ─────────────────────────────────────────────────────────────

test('T2 the row: no handler, no action; with one, every row with a fixed city carries "Stay near it →" in its body, under its note, in the Source link\'s look, with no aria-pressed and the foot still last; the two rows with no city carry none; a press hands the handler its row', () => {
  // rendered with no handler — as every other test renders it — a row draws no action
  for (const category of ['golf', 'skate', 'surfing'] as const) {
    const plain = view(category);
    assert.equal(count(plain, 'data-stay-near'), 0, `${category}: no handler, no action`);
    assert.ok(!plain.includes(asHtml(STAY_NEAR_WORDS)), `${category}: nor its words`);
  }
  // with a handler: Golf — five rows, each with a fixed city
  const golf = view('golf', () => {});
  const golfRows = EXPERIENCES.filter((r) => r.category === 'golf');
  assert.equal(golfRows.length, 5);
  assert.equal(count(golf, 'data-stay-near='), 5, 'one action per row');
  for (const r of golfRows) {
    const card = cardOf(golf, r.id);
    const button = `<button type="button" class="${SOURCE_LOOK}" data-stay-near="${r.id}">${asHtml(STAY_NEAR_WORDS)}</button>`;
    assert.equal(count(card, button), 1, `${r.id}: the action — a button, in the Source link's classes`);
    // in the row's body, last, under the note when the row has one and under the place when it has none
    const before = r.notes === null ? `${asHtml(`${r.venue} · ${r.city}, ${r.country}`)}</p>` : `${asHtml(r.notes)}</p>`;
    assert.ok(card.includes(`${before}${button}</div><div class="`), `${r.id}: the body's last child, right under its ${r.notes === null ? 'place' : 'note'}, and the foot follows`);
    // the foot is still the row's last child, unchanged: the checked words if any, then the Source link
    assert.match(card, new RegExp(`<div class="[^"]*">(?:<span class="font-mono text-xs text-text-faint" data-checked="${r.id}">[^<]*</span>)?<a href="[^"]+" rel="noopener" target="_blank" class="${esc(SOURCE_LOOK)}" data-source="${r.id}">${SOURCE_LINK}</a></div>$`), `${r.id}: the foot ends the row`);
    assert.ok(!/aria-pressed/.test(card), `${r.id}: nothing pressed on a row`);
  }
  // EVENTS-05 (2026-11-11): re-pointed — until then "the chips stay the only pressed things: twenty-six, with or without a handler" (/aria-pressed="(true|false)"/ × 26,
  // twice). The chips are one dropdown now: nothing in the panel is pressed, and the one list — "Select a category" and the twenty-six — is drawn either way.
  assert.ok(!/aria-pressed/.test(golf) && (golf.match(/<option value="[^"]*"/g) ?? []).length === 27, 'with a handler: nothing pressed, the one list');
  assert.ok(!/aria-pressed/.test(view('golf')) && (view('golf').match(/<option value="[^"]*"/g) ?? []).length === 27, 'without one: the same');
  // without the action the two renders are the same markup
  assert.equal(golf.replace(/<button type="button" class="[^"]*" data-stay-near="[^"]*">[^<]*<\/button>/g, ''), view('golf'), 'the action is the only difference a handler makes');
  // Skate: two rows with a city, and the two with none
  const skate = view('skate', () => {});
  const skateRows = EXPERIENCES.filter((r) => r.category === 'skate');
  assert.deepEqual(skateRows.map((r) => [r.id, canStayNear(r)]), [['sls-tokyo-2026', true], ['sls-super-crown-2026', true], ['x-games-summer-2027', false], ['world-skate-championships-next', false]]);
  assert.deepEqual([...skate.matchAll(/data-stay-near="([^"]+)"/g)].map((m) => m[1]), ['sls-tokyo-2026', 'sls-super-crown-2026'], 'the two rows with no city carry no action');
  // across the whole catalog: one action per row that can be stayed near
  const categories = [...new Set(EXPERIENCES.map((r) => r.category))];
  const actions = categories.flatMap((category) => [...view(category, () => {}).matchAll(/data-stay-near="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(actions.length, 169);
  assert.deepEqual([...actions].sort(), EXPERIENCES.filter((r) => canStayNear(r)).map((r) => r.id).sort(), 'exactly the rows with a fixed city');
  // a press: the row component, called inside a host under the provider, hands the handler its own row
  const tree = ExperiencesView({ rows: EXPERIENCES, today: TODAY, choice: { category: 'golf' }, onPick: () => {} });
  const rowElement = elementsIn(tree).find((el) => typeof el.type === 'function' && (el.props.row as Experience | undefined)?.id === 'masters-2027');
  assert.ok(rowElement, 'the pure half hands each row to the row component');
  const Row = rowElement.type as (props: { row: Experience; today: string }) => React.ReactElement;
  const pressed: string[] = [];
  let article: React.ReactNode;
  const RowHost = () => { article = Row({ row: row('masters-2027'), today: TODAY }); return null; };
  renderToStaticMarkup(React.createElement(StayNearContext.Provider, { value: (r: Experience) => { pressed.push(r.id); } }, React.createElement(RowHost)));
  const buttons = elementsIn(article).filter((el) => el.props['data-stay-near'] !== undefined);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].type, 'button');
  assert.equal(buttons[0].props.type, 'button', 'a button that submits nothing');
  (buttons[0].props.onClick as () => void)();
  assert.deepEqual(pressed, ['masters-2027'], 'the handler is handed the row');
  // the source: the rule and the handler decide, nothing else; the words are the leaf's
  const section = code(SECTION);
  assert.match(section, /\{onStayNear !== null && canStayNear\(row\) && \(\n\s*<button type="button" onClick=\{\(\) => onStayNear\(row\)\} className=\{EXP\.source\} data-stay-near=\{row\.id\}>\{STAY_NEAR_WORDS\}<\/button>\n\s*\)\}/, 'the action, whole');
  assert.equal(count(section, 'export const StayNearContext = createContext<((row: Experience) => void) | null>(null);'), 1, 'the handler\'s context, default null');
  assert.ok(!section.includes('Stay near') && !section.includes('row.status'), 'the section types no words of the action and reads no status');
});

// ── T3 · THE MATCHER ─────────────────────────────────────────────────────────

test('T3 the matcher: exact once trimmed, lower-cased and stripped of accents; the answer is the list\'s own string; none, a partial, a nearest and two matches are null', () => {
  const US = ['Aspen', 'Augusta', 'Frisco', 'Las Vegas', 'New York'];
  assert.equal(matchCity('Augusta', US), 'Augusta', 'exact');
  assert.equal(matchCity('  augusta ', US), 'Augusta', 'trimmed, any case — and the list\'s own string comes back');
  assert.equal(matchCity('NEW YORK', US), 'New York');
  // accent-folded, both ways — the list's spelling is what is returned
  assert.equal(matchCity('São Paulo', ['Rio de Janeiro', 'Sao Paulo']), 'Sao Paulo', 'the event\'s accent, the list\'s plain letters');
  assert.equal(matchCity('Sao Paulo', ['Rio de Janeiro', 'São Paulo']), 'São Paulo', 'and the other way round');
  assert.equal(matchCity('Nazaré', ['Lisboa', 'NAZARE ']), 'NAZARE ', 'the list\'s string exactly as the list holds it');
  assert.equal(matchCity('Zürich', ['Zurich', 'Geneva']), 'Zurich');
  // none
  assert.equal(matchCity('Pebble Beach', US), null, 'not in the list');
  assert.equal(matchCity('Augusta', []), null, 'an empty list');
  assert.equal(matchCity('', US), null, 'no city');
  // never a partial, never a nearest
  assert.equal(matchCity('Paris', ['Paris 01', 'Parisot', 'Le Paris']), null, 'a longer name that contains it is not it');
  assert.equal(matchCity('New', US), null, 'nor a shorter one');
  assert.equal(matchCity('Lisbon', ['Lisboa']), null, 'another spelling is another name');
  assert.equal(matchCity('General Luna, Siargao', ['General Luna', 'Siargao']), null, 'a city written with its island is neither');
  // two matches
  assert.equal(matchCity('Springfield', ['Springfield', 'springfield ']), null, 'two list cities of the same name: neither is chosen');
  assert.equal(matchCity('Springfield', ['Springfield', 'Shelbyville', 'Springfield']), null);
  // the source: one folding for both sides, exactly one match
  const place = code(PLACE);
  assert.match(place, /const folded = \(name: string\): string => name\.trim\(\)\.toLowerCase\(\)\.normalize\('NFD'\)\.replace\(\/\[\\u0300-\\u036f\]\/g, ''\);/);
  assert.match(place, /const want = folded\(city\);\n\s*const same = list\.filter\(\(name\) => folded\(name\) === want\);\n\s*return same\.length === 1 \? same\[0\] : null;/);
  assert.doesNotMatch(place, /includes\(|startsWith\(|indexOf\(|localeCompare|levenshtein|distance/i, 'no partial and no nearest');
});

// ── T4 · THE PICKER ──────────────────────────────────────────────────────────

test('T4 the picker: with no starting place its static render is today\'s, byte for byte; the two sentences; the source — one loader, no call for a list already held, an overtaken answer dropped, the three outcomes, the two list routes and nothing else', async () => {
  const { default: CountryCityPicker } = await import('../../components/trips/CountryCityPicker');
  const bare = renderToStaticMarkup(React.createElement(CountryCityPicker, { onChange: () => {} }));
  assert.equal(bare, PICKER_TODAY, 'no provider: exactly the picker of main 4564346');
  const withNull = renderToStaticMarkup(React.createElement(StartingPlaceContext.Provider, { value: null }, React.createElement(CountryCityPicker, { onChange: () => {} })));
  assert.equal(withNull, PICKER_TODAY, 'a provider of null: the same');
  // a place acts in an effect, once the country list has loaded — the first render is still today's, and nothing is reported
  const reported: unknown[] = [];
  const place: StartingPlace = { countryCode: 'US', country: 'USA', city: 'Augusta' };
  const withPlace = renderToStaticMarkup(React.createElement(StartingPlaceContext.Provider, { value: place }, React.createElement(CountryCityPicker, { onChange: (selection) => { reported.push(selection); } })));
  assert.equal(withPlace, PICKER_TODAY, 'a place changes nothing until the country list has loaded');
  assert.deepEqual(reported, [], 'and reports nothing on its own');
  assert.ok(!bare.includes('data-starting-place-line'), 'no line with no place');
  // the two sentences
  assert.equal(cityNotInListLine('Pebble Beach'), '“Pebble Beach” isn’t in the hotel list under that name — pick the nearest city from the list.');
  assert.equal(countryNotInListLine('Ireland'), 'Ireland isn’t in the hotel list — pick a country.');
  // the source
  const picker = code(PICKER);
  assert.match(picker, /^import \{ StartingPlaceContext, cityNotInListLine, countryNotInListLine, matchCity, type StartingPlace \} from '\.\/startingPlace';$/m);
  assert.equal(count(picker, 'const place = useContext(StartingPlaceContext);'), 1, 'the place comes through context — the form above is not told');
  // once the country list has loaded, each place once
  assert.match(picker, /useEffect\(\(\) => \{\n\s*if \(place === null \|\| countriesLoading \|\| countriesError !== '' \|\| appliedPlace\.current === place\) return;\n\s*appliedPlace\.current = place;\n\s*void startFrom\(place\);\n\s*\}\);/, 'null → nothing; a place → once the list is in, once per place (by identity: the same event pressed again is a new place)');
  // the country by its code; a code the list does not hold → nothing chosen, one line
  assert.match(picker, /const country = countries\.find\(\(c\) => c\.code === from\.countryCode\);\n\s*if \(!country\) \{\n(?:\s*\n)*\s*void onPickCountry\(''\);\n\s*setPlaceLine\(\{ under: 'country', words: countryNotInListLine\(from\.country\) \}\);\n\s*return;\n\s*\}/, 'an unknown code: the country cleared, the line said');
  // the cities: the one loader — none when that country's list is already held
  assert.match(picker, /const held = heldCities\.current;\n\s*const list = held !== null && held\.code === country\.code \? held\.list : await onPickCountry\(country\.code\);\n\s*if \(list === null\) return;/, 'held → no call; else the one loader; overtaken or failed → stop');
  assert.equal(count(picker, 'fetch('), 2, 'two calls in the file, as before: the countries once, a country\'s cities');
  assert.equal(count(picker, "fetch('/api/travel/locations/countries')"), 1);
  assert.equal(count(picker, 'fetch(`/api/travel/locations/cities?countryCode=${encodeURIComponent(code)}`)'), 1, 'the one loader of a country\'s cities');
  assert.equal(count(picker, '/api/'), 2, 'no other route');
  // a newer pick wins over an answer in flight
  assert.match(picker, /const mine = \+\+pickNumber\.current;\n\s*heldCities\.current = null;/, 'every pick of a country takes the next number and lets go of the held list');
  assert.match(picker, /if \(mine !== pickNumber\.current\) return null;\n\s*setCities\(list\);\n\s*heldCities\.current = \{ code, list \};\n\s*return list;/, 'an overtaken answer is dropped before it is held');
  assert.equal(count(picker, 'onChange={(e) => onPickCountry(e.target.value)}'), 1, 'the visitor\'s own pick comes through the same loader');
  // no match → typed in, NOT chosen, the list not opened, one line; nothing reported but null
  assert.match(picker, /const city = matchCity\(from\.city, list\);\n\s*setShowDropdown\(false\);\n\s*if \(city === null\) \{\n(?:\s*\n)*\s*setCityQuery\(from\.city\);\n\s*setCityChosen\(''\);\n\s*setPlaceLine\(\{ under: 'city', words: cityNotInListLine\(from\.city\) \}\);\n\s*report\.current\(null\);\n\s*return;\n\s*\}/, 'not in the list: typed, not chosen');
  // a match → chosen and reported exactly as a click on that city reports it
  assert.match(picker, /setCityQuery\(city\);\n\s*setCityChosen\(city\);\n\s*setPlaceLine\(null\);\n\s*report\.current\(\{ city, country: country\.name, countryCode: country\.code \}\);/, 'the list\'s own string, the list\'s country name, its code');
  assert.equal(count(picker, 'onChange({ city, country: countryName, countryCode });'), 1, 'a click on a city reports the same three');
  // the two lines, each under its own field, each a status
  assert.equal(count(picker, `{placeLine !== null && placeLine.under === 'country' && <span role="status" className="text-xs text-text-secondary" data-starting-place-line="country">{placeLine.words}</span>}`), 1);
  assert.equal(count(picker, `{placeLine !== null && placeLine.under === 'city' && <p role="status" className="text-xs text-text-secondary" data-starting-place-line="city">{placeLine.words}</p>}`), 1);
  // never a date, never a search
  assert.doesNotMatch(picker, /check-?in|check-?out|new Date\(|Date\.now\(|hotels\/search|localStorage|sessionStorage/i, 'no date, no search, nothing stored');
  // the leaf beside it: a context, two sentences, one function — pure
  const leaf = code(PLACE);
  assert.deepEqual([...leaf.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['react'], 'it imports createContext and nothing else');
  assert.match(leaf, /^export const StartingPlaceContext = createContext<StartingPlace \| null>\(null\);$/m, 'default null');
  assert.deepEqual([...leaf.matchAll(/^export (?:const|function|interface) (\w+)/gm)].map((m) => m[1]), ['StartingPlace', 'StartingPlaceContext', 'cityNotInListLine', 'countryNotInListLine', 'matchCity'], 'the type, the context, the two sentences, the one function');
  assert.doesNotMatch(leaf, /['"]use client['"]|\bfetch\s*\(|new Date\(|Date\.now\(|process\.env|localStorage|\/api\//, 'no directive, no fetch, no clock, no env, no storage');
});

// ── T5 · THE STRIP ───────────────────────────────────────────────────────────

test('T5 the strip: with neither prop its first mode is open, as always; with both, the caller\'s key is; one without the other throws, by name', async () => {
  const { default: ToggleStrip } = await import('../../components/ui/ToggleStrip');
  const modes: ToggleMode[] = [
    { key: 'events', label: 'Events', panel: React.createElement('p', null, 'the events') },
    { key: 'flights', label: 'Flights', panel: React.createElement('p', null, 'the flights') },
    { key: 'hotels', label: 'Hotels', panel: React.createElement('p', null, 'the hotels') },
  ];
  const panels = (html: string) => [...html.matchAll(/<div class="(block|hidden)"><p>the (\w+)<\/p><\/div>/g)].map((m) => `${m[2]}:${m[1]}`);
  const pressedTabs = (html: string) => [...html.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*>(\w+)<\/button>/g)].filter((m) => m[1] === 'true').map((m) => m[2]);
  const own = renderToStaticMarkup(React.createElement(ToggleStrip, { modes }));
  assert.deepEqual(panels(own), ['events:block', 'flights:hidden', 'hotels:hidden'], 'neither prop: the first mode, every other mounted and hidden');
  assert.deepEqual(pressedTabs(own), ['Events']);
  assert.deepEqual(panels(renderToStaticMarkup(React.createElement(ToggleStrip, { modes, defaultKey: 'flights' }))), ['events:hidden', 'flights:block', 'hotels:hidden'], 'its own default key still works');
  const held = renderToStaticMarkup(React.createElement(ToggleStrip, { modes, activeKey: 'hotels', onActiveChange: () => {} }));
  assert.deepEqual(panels(held), ['events:hidden', 'flights:hidden', 'hotels:block'], 'both props: the caller\'s key');
  assert.deepEqual(pressedTabs(held), ['Hotels']);
  assert.deepEqual(panels(renderToStaticMarkup(React.createElement(ToggleStrip, { modes, defaultKey: 'flights', activeKey: 'hotels', onActiveChange: () => {} }))), ['events:hidden', 'flights:hidden', 'hotels:block'], 'the caller\'s key, whatever the default');
  assert.equal(held.replace(/aria-pressed="(true|false)"/g, '').replace(/class="[^"]*"/g, ''), own.replace(/aria-pressed="(true|false)"/g, '').replace(/class="[^"]*"/g, ''), 'the same markup either way — only which tab is open differs');
  assert.throws(() => renderToStaticMarkup(React.createElement(ToggleStrip, { modes, activeKey: 'hotels' })), /ToggleStrip: activeKey was given without onActiveChange — the caller holds the open tab with both, or the strip holds it with neither/);
  assert.throws(() => renderToStaticMarkup(React.createElement(ToggleStrip, { modes, onActiveChange: () => {} })), /ToggleStrip: onActiveChange was given without activeKey — the caller holds the open tab with both, or the strip holds it with neither/);
});

// ── T6 · THE BOX ─────────────────────────────────────────────────────────────

test('T6 the box: at rest no line and no starting place, the Hotels panel the builder\'s own; a press opens Hotels with the line over the form and the row\'s place; the same row pressed again is a new place; no hotels mode is a throw, by name', async () => {
  const { travelStripModes } = await import('../../components/trips/travelStripModes');
  const { default: LandingBookingSection } = await import('../../components/landing/LandingBookingSection');
  const { default: ToggleStrip } = await import('../../components/ui/ToggleStrip');
  type StripProps = { modes: ToggleMode[]; activeKey?: string; onActiveChange?: (key: string) => void };
  const catalog = React.createElement('section', { id: 'events' }, 'the catalog');
  const onRequireAuth = () => {};
  const masters = row('masters-2027');
  const stripOf = (tree: React.ReactNode): React.ReactElement<StripProps> => {
    const strips = elementsIn(tree).filter((el) => el.type === ToggleStrip) as unknown as React.ReactElement<StripProps>[];
    assert.equal(strips.length, 1, 'the shared strip, once');
    return strips[0];
  };
  const hotelsOf = (tree: React.ReactNode): El => {
    const mode = stripOf(tree).props.modes.find((m) => m.key === 'hotels');
    assert.ok(mode, 'the Hotels mode');
    return mode.panel as El;
  };
  const handlerOf = (tree: React.ReactNode): ((r: Experience) => void) => {
    const providers = elementsIn(tree).filter((el) => el.type === StayNearContext.Provider);
    assert.equal(providers.length, 1, 'the press handler is provided once, around the strip');
    assert.ok(elementsIn(providers[0].props.children as React.ReactNode).some((el) => el.type === ToggleStrip), 'the strip — and so the catalog in it — sits inside');
    assert.equal(typeof providers[0].props.value, 'function');
    return providers[0].props.value as (r: Experience) => void;
  };
  // The box is a component with state: it is called inside a host's render. A press made DURING that render is a
  // render-phase update, so the renderer draws the host again with the new state — `presses` rows, one per pass.
  const boxAfter = (presses: Experience[]): React.ReactNode[] => {
    const passes: React.ReactNode[] = [];
    const Host = () => {
      const tree = LandingBookingSection({ onRequireAuth, events: catalog });
      passes.push(tree);
      if (passes.length <= presses.length) handlerOf(tree)(presses[passes.length - 1]);
      return null;
    };
    assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
    assert.equal(passes.length, presses.length + 1, 'one pass, and one more per press');
    return passes;
  };
  // at rest
  const [rest] = boxAfter([]);
  assert.equal(stripOf(rest).props.activeKey, 'events', 'Events is open');
  const restHotels = hotelsOf(rest);
  assert.equal(restHotels.type, StartingPlaceContext.Provider, 'the Hotels panel sits in the starting place\'s provider');
  assert.equal(restHotels.props.value, null, 'with no place');
  const built = travelStripModes({ onRequireAuth, authed: false, eventsAnchor: '#events' });
  const builtHotels = built.find((m) => m.key === 'hotels');
  assert.ok(builtHotels);
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): the commission disclosure is the LAST line of the Hotels panel — a third child, after the form, so the
  // form keeps its seat (second) and is never remounted. Until then: two children ([false, the builder's panel]); 'at rest the Hotels panel draws
  // exactly what the builder's draws'; and every other panel but Events' was the builder's own element ('untouched').
  const restChildren = restHotels.props.children as React.ReactNode[];
  assert.equal(restChildren.length, 3);
  assert.equal(restChildren[0], false, 'no line');
  assert.equal((restChildren[1] as El).type, (builtHotels.panel as El).type, 'and the builder\'s own Hotels panel, second');
  const DISCLOSURE = `<p class="mt-3 text-xs text-text-secondary" data-commission-line="true">${COMMISSION_LINE}</p>`;
  assert.equal(renderToStaticMarkup(restChildren[2] as El), DISCLOSURE, 'then the disclosure, third and last');
  assert.equal(renderToStaticMarkup(restHotels), renderToStaticMarkup(builtHotels.panel as El) + DISCLOSURE, 'at rest the Hotels panel draws exactly what the builder\'s draws, and then the disclosure');
  for (const m of stripOf(rest).props.modes) {
    if (m.key === 'hotels' || m.key === 'events') continue;
    const made = built.find((b) => b.key === m.key)?.panel as El;
    if (!['flights', 'transit', 'activities'].includes(m.key)) { assert.equal((m.panel as El).type, made.type, `${m.key}: untouched`); continue; }
    // the three other panels that can pay: the builder's own panel, then the disclosure
    assert.equal((m.panel as El).type, React.Fragment, `${m.key}: two things side by side`);
    const kids = (m.panel as El).props.children as React.ReactNode[];
    assert.equal(kids.length, 2);
    assert.equal((kids[0] as El).type, made.type, `${m.key}: the builder's own panel, first`);
    assert.equal(renderToStaticMarkup(kids[1] as El), DISCLOSURE, `${m.key}: then the disclosure`);
  }
  assert.equal(stripOf(rest).props.modes[0].panel, catalog, 'the catalog is still the Events panel itself');
  const whole = renderToStaticMarkup(React.createElement(LandingBookingSection, { onRequireAuth, events: catalog }));
  assert.equal(count(whole, 'data-stay-near-line'), 0, 'rendered whole: no line');
  assert.match(whole, /^<div class="scroll-mt-4"><div class="mt-6 rounded-lg border border-border bg-white p-4">/, 'the white box, in the plain box a press brings into view');
  // one press: Hotels opens, the line stands over the form, the place is the row's
  const [, once] = boxAfter([masters]);
  assert.equal(stripOf(once).props.activeKey, 'hotels', 'a press opens the Hotels tab');
  const onceHotels = hotelsOf(once);
  assert.deepEqual(onceHotels.props.value, { countryCode: 'US', country: 'USA', city: 'Augusta' }, 'the place: the row\'s country code, country and city — and nothing else: no date');
  const onceChildren = onceHotels.props.children as React.ReactNode[];
  const line = onceChildren[0] as El;
  assert.equal(line.type, 'p');
  assert.equal(line.props.role, 'status');
  assert.equal(line.props.children, stayNearLine(masters), 'the line names the event and its place');
  assert.equal((onceChildren[1] as El).type, (builtHotels.panel as El).type, 'the form keeps its seat — second child — so it is never remounted');
  const drawn = renderToStaticMarkup(once as El);
  assert.ok(drawn.includes(`<div class="block"><p role="status" class="mt-4 border-l-2 border-brand-purple pl-3 text-sm text-text-primary" data-stay-near-line="true">${asHtml(stayNearLine(masters))}</p><div class="mt-4 rounded-lg border border-border bg-white p-4 space-y-3"><p class="sr-only">Hotels</p><form `), 'drawn: Hotels is the open panel, and the line is over the form');
  assert.ok(drawn.includes('<div class="hidden"><section id="events">the catalog</section></div>'), 'the catalog stays mounted, hidden');
  assert.equal(count(drawn, 'data-stay-near-line'), 1);
  // the same row pressed again: a new place — the picker applies a place once per object
  const [, first, second] = boxAfter([masters, masters]);
  assert.deepEqual(hotelsOf(second).props.value, hotelsOf(first).props.value);
  assert.notEqual(hotelsOf(second).props.value, hotelsOf(first).props.value, 'equal, and a new object: it is applied again');
  // another row: its own line and place
  const [, , other] = boxAfter([masters, row('sls-super-crown-2026')]);
  assert.deepEqual(hotelsOf(other).props.value, { countryCode: 'BR', country: 'Brazil', city: 'São Paulo' });
  assert.equal(((hotelsOf(other).props.children as React.ReactNode[])[0] as El).props.children, 'Stay near SLS Super Crown World Championship 2026 — Ginásio do Ibirapuera · São Paulo, Brazil. Set your dates, then Search.');
  // the source: the key, the throw, what a press does, the wrap — and no call of its own
  const wrapper = code(WRAPPER);
  assert.match(wrapper, /^const HOTELS_KEY = 'hotels';$/m);
  assert.match(wrapper, /if \(!ordered\.some\(\(m\) => m\.key === HOTELS_KEY\)\) throw new Error\(`LandingBookingSection: travelStripModes returned no '\$\{HOTELS_KEY\}' mode/, 'no hotels mode → a throw that names it');
  assert.match(wrapper, /const stayNear = useCallback\(\(row: Experience\) => \{\n\s*setStay\(\{ place: \{ countryCode: row\.countryCode, country: row\.country, city: row\.city \}, line: stayNearLine\(row\) \}\);\n\s*setOpen\(HOTELS_KEY\);\n\s*setTops\(\(n\) => n \+ 1\);\n\s*\}, \[\]\);/, 'a press: the place and its line, Hotels open, one top asked for');
  assert.match(wrapper, /useEffect\(\(\) => \{\n\s*if \(tops === 0\) return;\n\s*if \(box\.current === null\) throw new Error\([^)]*\);\n\s*box\.current\.scrollIntoView\(\);\n\s*\}, \[tops\]\);/, 'then the top of the box is brought into view, after that render');
  assert.equal(count(wrapper, '<StartingPlaceContext.Provider value={stay === null ? null : stay.place}>'), 1);
  assert.equal(count(wrapper, '{stay !== null && <p role="status" className={STAY_LINE} data-stay-near-line>{stay.line}</p>}'), 1);
  assert.equal(count(wrapper, '<StayNearContext.Provider value={stayNear}>'), 1);
  assert.doesNotMatch(wrapper, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|pushState|replaceState|new Date\(|Date\.now\(/, 'the box calls nothing, stores nothing and sets no date');
});

// ── T7 · THE FREEZE ──────────────────────────────────────────────────────────

test('T7 the freeze holds: the strip builder, the Hotels form and the Flights form still hash to their pins; the form still takes its destination from the picker alone; nothing new reaches the hotel search', () => {
  for (const file of [STRIP_MODES, HOTEL_FORM, FLIGHT_FORM]) {
    const pin = BOOKING_FLOW_FILES.find((p) => p.file === file);
    assert.ok(pin, `${file} is in the freeze`);
    assert.equal(bookingFlowSha256(rejoin(code(file), comments(file))), pin.sha256, `${file}: byte for byte what the freeze pinned`);
  }
  assert.ok(!BOOKING_FLOW_FILES.some((p) => p.file === PICKER || p.file === PLACE || p.file === WRAPPER), 'the picker, the leaf beside it and the box are not in the freeze');
  // the form's one door for a destination is the picker it mounts — the context is how a place gets in without the form
  const form = code(HOTEL_FORM);
  assert.equal(count(form, '<CountryCityPicker onChange={setPicked} />'), 1, 'the form mounts the picker once, and hears it through setPicked');
  assert.ok(!form.includes('startingPlace') && !form.includes('StartingPlace'), 'the form knows nothing of a starting place');
  // the hotel search is the form's alone: no file of this change names it
  for (const file of [PICKER, PLACE, WRAPPER, 'src/components/landing/ExperiencesSection.tsx', 'src/lib/experienceWords.ts', 'src/components/ui/ToggleStrip.tsx']) {
    assert.doesNotMatch(code(file), /hotels\/search|liteapi|\/api\/travel\/(?!locations\/)/i, `${file}: names no route but the two lists`);
  }
});
