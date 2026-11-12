/**
 * EVENTS-05 (Alex, 2026-11-11 17:54-17:56 Manila: "its expanded and too big and looks shitty on web and also on phone… IDK why IM INTO AND
 * SEASONS… ITs JUST ONE LIST… 1 drop down… select a category… have it start with select a categoty, so theres nothing expanded from the
 * start") — the Events panel's two chip rows are ONE dropdown under the I'M INTO… label, and nothing is open until a category is picked.
 *
 *   T1 none — the panel is its label and the dropdown, nothing else; the dropdown reads "Select a category";
 *   T2 the one list — "Select a category", then EXPERIENCE_CATEGORIES in the leaf's order, ids and labels read from the leaf, no group heading;
 *   T3 a picked category — every category of the leaf: its option selected alone, the label over its rows, its rail (keyed by it), its closing line;
 *   T4 the refused view — the dropdown reads "Select a category"; the refusal and the closing line print as before;
 *   T5 the pick — the dropdown hands onPick a category, or null for "Select a category"; a value that is none of its options throws by name;
 *   T6 the URL half — no param and an empty one are none; a category sets ?into=<id>; "Select a category" takes ?into out; the anchor is kept;
 *      a pick writes the URL with the browser's own replace (Alex's ruling, 2026-11-11) — the component's body is held whole, and so is the
 *      default export that mounts it: the view is mounted nowhere else;
 *   T7 what left — no aria-pressed, role="group", SEASONS_LABEL, DEFAULT_INTO or chip class in the section's code; the leaf's note is corrected;
 *   T8 the look — the dropdown wears the booking lookup's field classes (read from GuestBookingLookup.tsx), a 44px target, w-72 from lg up.
 *      HOME-TRAVEL-01 (Alex, 2026-11-12): the dropdown and the lookup's two fields wear the reference's field — 46px, a 12px radius, the house's
 *      field line — each by its own class (.ts-tm-select__field, .ts-tm-input), ruled in src/app/globals.css; the dropdown stands in its box
 *      (340px at most) with the reference's chevron. T1, T3, T4 and T8 are re-pointed, each with a dated note.
 * The view is rendered as experiences01 renders it; source is read through code() / comments(). No live call, no database, no clock. No line
 * number and no line count is pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { EXPERIENCES, EXPERIENCE_CATEGORIES, type Experience, type ExperienceCategoryId } from '../experiences';
import * as sectionModule from '@/components/landing/ExperiencesSection';
import {
  ExperiencesView, CLOSING_LINE, COMING_UP_LABEL, EVENTS_ANCHOR, INTO_LABEL, INTO_PARAM, SEASONS_CLOSING_LINE, SELECT_CATEGORY, WHEN_TO_GO_LABEL,
  choiceOf, notACategory, pickHref, pickedOf, type IntoChoice,
} from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LEAF = 'src/lib/experiences.ts';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';
const TODAY = '2026-11-11';

/** React's escaping of text and attributes: the ampersand, the angle brackets, then the apostrophe. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const view = (choice: IntoChoice, today = TODAY, rows: readonly Experience[] = EXPERIENCES) =>
  renderToStaticMarkup(React.createElement(ExperiencesView, { rows, today, choice, onPick: () => {} }));

/** The panel's opening tag, its label, and the label's classes — untouched by this change (homeLines01 holds the same opening). */
// HOME-TRAVEL-01 (Alex, 2026-11-12): the reference's classes (src/app/globals.css) — the label .ts-tm-label; the panel's section carries no class, since
// the box draws the one rule over every panel. Until then: LABEL_CLASS 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider
// text-text-faint' and PANEL_OPEN '<section id="events" aria-label="Book the experience" class="mt-6 border-t border-border pt-6" data-experiences="true">'.
const LABEL_CLASS = 'ts-tm-label';
const PANEL_OPEN = '<section id="events" aria-label="Book the experience" data-experiences="true">';
const LABEL = `<p class="${LABEL_CLASS}">${asHtml(INTO_LABEL)}</p>`;
/** HOME-TRAVEL-01 (2026-11-12): the dropdown's box opens around it, and closes after the reference's chevron. */
const SELECT_BOX = '<div class="ts-tm-select">';
const CHEVRON = '<svg class="ts-tm-select__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';

interface Option { value: string; words: string; selected: boolean }
/** The dropdown's options as drawn, in order — and the dropdown must be the one the label names. */
const optionsIn = (html: string): Option[] => {
  const list = new RegExp(`<select aria-label="${asHtml(INTO_LABEL)}" class="[^"]*" data-into-select="true">([\\s\\S]*?)</select>`).exec(html);
  assert.ok(list, 'the dropdown is drawn, named by the I\'M INTO label');
  const options = [...list[1].matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map((m) => ({ value: m[1], words: m[3], selected: m[2] !== undefined }));
  assert.equal(options.map((o) => `<option value="${o.value}"${o.selected ? ' selected=""' : ''}>${o.words}</option>`).join(''), list[1], 'the options are everything inside the dropdown');
  return options;
};
const selectedIn = (html: string) => optionsIn(html).filter((o) => o.selected).map((o) => o.value);
/** What the panel draws under the dropdown. HOME-TRAVEL-01 (2026-11-12): under its box — the dropdown, then the chevron, then the box's close (right after '</select>' until then). */
const under = (html: string) => {
  const end = `</select>${CHEVRON}</div>`;
  const at = html.indexOf(end);
  assert.ok(at > -1 && count(html, '</select>') === 1 && count(html, end) === 1, 'one dropdown, in its box, the chevron over it');
  return html.slice(at + end.length);
};
const cardsOf = (html: string) => [...html.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);

type El = React.ReactElement<Record<string, unknown> & { children?: React.ReactNode }>;
/** Every element of a tree, depth first, through props.children — a component is not rendered here. */
const elementsIn = (node: React.ReactNode, out: El[] = []): El[] => {
  if (Array.isArray(node)) node.forEach((n) => elementsIn(n as React.ReactNode, out));
  else if (React.isValidElement(node)) { out.push(node as El); elementsIn((node as El).props.children, out); }
  return out;
};
const treeOf = (choice: IntoChoice, onPick: (id: ExperienceCategoryId | null) => void = () => {}) => ExperiencesView({ rows: EXPERIENCES, today: TODAY, choice, onPick });
const dropdownOf = (choice: IntoChoice, onPick?: (id: ExperienceCategoryId | null) => void): El => {
  const found = elementsIn(treeOf(choice, onPick)).filter((el) => el.type === 'select');
  assert.equal(found.length, 1, 'one dropdown in the tree');
  return found[0];
};

// ── T1 · NONE ────────────────────────────────────────────────────────────────

test('T1 none — nothing in the URL: the panel is its label and the dropdown and nothing else, and the dropdown reads "Select a category"', () => {
  assert.equal(SELECT_CATEGORY, 'Select a category');
  const none = view({ none: true });
  // The label is still the panel's first child, exactly as it was; the dropdown is right under it; and there the panel ends.
  // HOME-TRAVEL-01 (2026-11-12): the dropdown stands in its box with the chevron — until then '…${LABEL}<select …' and '…</option></select></section>'.
  assert.ok(none.startsWith(`${PANEL_OPEN}${LABEL}${SELECT_BOX}<select aria-label="${asHtml(INTO_LABEL)}" class="`), 'the panel opens with the I\'M INTO label, then the dropdown it names');
  assert.ok(none.endsWith(`</option></select>${CHEVRON}</div></section>`), 'the panel ends at the dropdown');
  assert.equal(under(none), '</section>', 'nothing under the dropdown');
  // Two children, by the tree: the label and the dropdown — everything else is not drawn (false), not hidden. HOME-TRAVEL-01 (2026-11-12): the
  // dropdown in its box, beside the chevron (['p', 'select'] until then).
  const drawn = React.Children.toArray((treeOf({ none: true }) as El).props.children).filter((k): k is El => React.isValidElement(k));
  assert.deepEqual(drawn.map((k) => k.type), ['p', 'div']);
  assert.deepEqual(React.Children.toArray(drawn[1].props.children).filter((k): k is El => React.isValidElement(k)).map((k) => k.type), ['select', 'svg'], 'the box: the dropdown, then its chevron');
  for (const gone of ['data-coming-up-rail', 'data-coming-up=', COMING_UP_LABEL, WHEN_TO_GO_LABEL, asHtml(CLOSING_LINE), asHtml(SEASONS_CLOSING_LINE), 'data-into-refused', 'data-nothing-upcoming', 'is not a category', '<article', 'role="status"', 'Source ↗']) {
    assert.ok(!none.includes(gone), `none draws no "${gone}"`);
  }
  // HOME-TRAVEL-01 (2026-11-12): counted as paragraphs — the chevron's <path> opens with "<p" too (count(none, '<p') until then).
  assert.equal((none.match(/<p[\s>]/g) ?? []).length, 1, 'one paragraph: the label — no label over rows, no line, no closing line');
  // The dropdown reads "Select a category": its first option, with no value, selected — alone.
  assert.deepEqual(selectedIn(none), ['']);
  assert.ok(none.includes(`<option value="" selected="">${SELECT_CATEGORY}</option>`));
  assert.equal(count(none, ' selected=""'), 1);
  // Nothing of a row or of the day is read with nothing chosen: the same markup over any day and over no rows at all.
  assert.equal(view({ none: true }, '2031-01-01'), none);
  assert.equal(view({ none: true }, TODAY, []), none);
});

// ── T2 · THE ONE LIST ────────────────────────────────────────────────────────

test('T2 the one list — "Select a category", then every category of the leaf in the leaf\'s order, ids and labels read from the leaf; no group heading, no second control; the same list on every view', () => {
  const expected = [['', SELECT_CATEGORY], ...EXPERIENCE_CATEGORIES.map((c) => [c.id, asHtml(c.label)])];
  const list = optionsIn(view({ none: true }));
  assert.deepEqual(list.map((o) => [o.value, o.words]), expected);
  assert.equal(list.length, EXPERIENCE_CATEGORIES.length + 1);
  assert.equal(EXPERIENCE_CATEGORIES.length, 26, 'twenty-six categories');
  // The leaf's order is the events, then the seasons — one list, read as it stands, not regrouped here.
  const events = EXPERIENCE_CATEGORIES.filter((c) => c.group === 'event');
  const seasons = EXPERIENCE_CATEGORIES.filter((c) => c.group === 'season');
  assert.deepEqual([events.length, seasons.length], [19, 7]);
  assert.deepEqual(list.slice(1).map((o) => o.value), [...events, ...seasons].map((c) => c.id), 'the nineteen event categories, then the seven season ones');
  // Each option's value is the category's id — the value ?into= takes — and no two options share one.
  assert.equal(new Set(list.map((o) => o.value)).size, list.length);
  // The same list whatever is chosen: a category, a refusal, nothing.
  for (const choice of [{ category: 'f1' }, { category: 'wildlife' }, { refused: 'nope' }] as IntoChoice[]) {
    assert.deepEqual(optionsIn(view(choice)).map((o) => [o.value, o.words]), expected);
  }
  // One native dropdown: no group heading, no second label, no button for a category, nothing pressed.
  for (const html of [view({ none: true }), view({ category: 'surfing' }), view({ category: 'wildlife' }), view({ refused: 'nope' })]) {
    assert.equal(count(html, '<select'), 1);
    for (const gone of ['<optgroup', 'role="group"', 'aria-pressed', 'data-into=', '>SEASONS<', 'role="listbox"']) assert.ok(!html.includes(gone), `no ${gone}`);
    assert.doesNotMatch(html, /<select[^>]*\s(multiple|disabled|size)=/, 'a plain single-choice dropdown — read off the tag\'s own attributes (React writes multiple="" and disabled=""), never off a class name or a row\'s words');
  }
  // Mapped from the list: the section's code types no category id and no category label — and draws two <option>s, the empty one and the mapped one.
  const section = code(SECTION);
  for (const c of EXPERIENCE_CATEGORIES) {
    assert.ok(!section.includes(`'${c.id}'`) && !section.includes(`"${c.id}"`), `${c.id} is not typed in the section`);
    assert.ok(!section.includes(`>${c.label}<`) && !section.includes(`'${c.label}'`) && !section.includes(`"${c.label}"`), `"${c.label}" is not typed in the section`);
  }
  assert.equal(count(section, '{EXPERIENCE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}'), 1, 'every category, in the list\'s order, its id the value and its label the words');
  assert.equal(count(section, '<option value="">{SELECT_CATEGORY}</option>'), 1, 'the first option: no value');
  assert.equal(count(section, '<option'), 2);
  assert.equal(count(section, '<select'), 1);
  assert.equal(count(section, "'Select a category'"), 1, 'typed once, in its const');
});

// ── T3 · A PICKED CATEGORY ───────────────────────────────────────────────────

test('T3 a picked category — every category of the leaf: its option selected alone, the label over its rows right under the dropdown, its rail keyed by it with every one of its rows, its closing line closing the panel', () => {
  for (const c of EXPERIENCE_CATEGORIES) {
    const html = view({ category: c.id });
    assert.ok(html.startsWith(`${PANEL_OPEN}${LABEL}${SELECT_BOX}<select aria-label="${asHtml(INTO_LABEL)}" class="`), `${c.label}: the label, then the dropdown`);
    assert.deepEqual(selectedIn(html), [c.id], `${c.label}: its option selected, alone`);
    assert.equal(count(html, ' selected=""'), 1, `${c.label}: nothing else selected`);
    // Under the dropdown: the label over the rows first — WHEN TO GO for a season, COMING UP for an event — and the closing line last.
    // HOME-TRAVEL-01 (2026-11-12): the label and the rows stand in one list block (data-list), in the reference's classes; until then '<p class="mt-10
    // ${LABEL_CLASS}">' opened what follows the dropdown and '<p class="mt-8 text-xs text-text-faint">' was the closing line.
    const below = under(html);
    assert.ok(below.startsWith(`<div data-list="true"><p class="ts-tm-label ts-tm-label--list">${c.group === 'season' ? WHEN_TO_GO_LABEL : COMING_UP_LABEL}</p>`), `${c.label}: the label over its rows, right under the dropdown`);
    assert.ok(below.endsWith(`<p class="ts-tm-closing">${asHtml(c.group === 'season' ? SEASONS_CLOSING_LINE : CLOSING_LINE)}</p></section>`), `${c.label}: its closing line closes the panel`);
    // Its rail, once, holding every row of the category and no other.
    assert.equal(count(html, 'data-coming-up-rail="true"'), 1, `${c.label}: its rail`);
    const rows = EXPERIENCES.filter((r) => r.category === c.id);
    assert.ok(rows.length > 0, `${c.label} has rows`);
    assert.deepEqual(cardsOf(html).sort(), rows.map((r) => r.id).sort(), `${c.label}: every one of its rows, no other`);
    assert.ok(!html.includes('data-into-refused'), `${c.label}: no refusal`);
    // The rail is keyed by the category: picking another mounts a new list, at its first row.
    const rails = elementsIn(treeOf({ category: c.id })).filter((el) => el.props['data-coming-up-rail'] === true);
    assert.equal(rails.length, 1);
    assert.equal(rails[0].key, c.id, `${c.label}: the rail's key is the category`);
    // The dropdown is controlled by the choice: it shows this category.
    assert.equal(dropdownOf({ category: c.id }).props.value, c.id);
  }
  const section = code(SECTION);
  assert.equal(count(section, '<div key={into} className={EXP.rail} data-coming-up-rail>'), 1);
  assert.equal(count(section, 'value={into === null ? \'\' : into}'), 1, 'the dropdown shows the URL\'s category, and "Select a category" when there is none');
});

// ── T4 · THE REFUSED VIEW ────────────────────────────────────────────────────

test('T4 the refused view — a value that names no category: the dropdown reads "Select a category", the refusal and the closing line print as before, no row, no substitute', () => {
  const bad = view({ refused: 'nope' });
  assert.ok(bad.startsWith(`${PANEL_OPEN}${LABEL}${SELECT_BOX}<select aria-label="${asHtml(INTO_LABEL)}" class="`));
  assert.deepEqual(selectedIn(bad), [''], 'the dropdown reads Select a category — no category stands in');
  assert.equal(notACategory('nope'), 'nope is not a category — pick one above.', 'the words, unchanged — "above" is the dropdown');
  // HOME-TRAVEL-01 (2026-11-12): the refusal and the closing line in the reference's classes — until then '<p class="mt-10 mt-2 font-mono text-xs
  // text-text-primary" role="status" data-into-refused="true">' and '<p class="mt-8 text-xs text-text-faint">'.
  assert.equal(
    under(bad),
    `<p class="ts-tm-refused" role="status" data-into-refused="true">${asHtml(notACategory('nope'))}</p><p class="ts-tm-closing">${asHtml(CLOSING_LINE)}</p></section>`,
    'under the dropdown: the refusal, then the events\' closing line — nothing else',
  );
  assert.equal(dropdownOf({ refused: 'nope' }).props.value, '');
  assert.equal(cardsOf(bad).length, 0);
  // The refusal names whatever the URL said, as text — never as markup.
  assert.ok(view({ refused: '<b>x</b>' }).includes(`${asHtml(notACategory('<b>x</b>'))}</p>`));
  // The refusal and none are different views: none says nothing, refuses nothing and closes with nothing.
  assert.notEqual(view({ none: true }), bad);
  const section = code(SECTION);
  // HOME-TRAVEL-01 (2026-11-12): the refusal 12px under the dropdown, the reference's spacing — '<p className={`mt-10 ${EXP.refused}`} …' until then.
  assert.equal(count(section, '{refused !== null && <p className={EXP.refused} role="status" data-into-refused>{notACategory(refused)}</p>}'), 1);
  assert.equal(count(section, '{(into !== null || refused !== null) && <p className={EXP.closing}>{isSeason ? SEASONS_CLOSING_LINE : CLOSING_LINE}</p>}'), 1, 'the closing line closes a view that is open — never none');
});

// ── T5 · THE PICK ────────────────────────────────────────────────────────────

test('T5 the pick — the dropdown hands onPick the category picked, or null for "Select a category"; a value that is none of its options throws by name and is handed on to nobody', () => {
  assert.equal(pickedOf(''), null, '"Select a category" is no category');
  for (const c of EXPERIENCE_CATEGORIES) assert.equal(pickedOf(c.id), c.id);
  for (const not of ['nope', ' ', 'Surf', 'SURFING', 'surfing ', 'null', 'undefined']) {
    assert.throws(() => pickedOf(not), { message: `ExperiencesSection: the dropdown answered "${not}", which is none of its options` }, `"${not}" is refused by name`);
  }
  // The dropdown itself, changed: from Golf to a season category, then to "Select a category".
  const picked: Array<ExperienceCategoryId | null> = [];
  const dropdown = dropdownOf({ category: 'golf' }, (id) => { picked.push(id); });
  const change = dropdown.props.onChange as (e: { target: { value: string } }) => void;
  change({ target: { value: 'wildlife' } });
  change({ target: { value: '' } });
  assert.deepEqual(picked, ['wildlife', null]);
  assert.throws(() => change({ target: { value: 'nope' } }), /the dropdown answered "nope", which is none of its options/);
  assert.deepEqual(picked, ['wildlife', null], 'a value that is no option reaches no handler');
  // Named for a screen reader by the label's own words, hooked for the page, and a plain single-choice dropdown.
  assert.equal(dropdown.props['aria-label'], INTO_LABEL);
  assert.equal(dropdown.props['data-into-select'], true);
  assert.ok(!('multiple' in dropdown.props) && !('size' in dropdown.props) && !('disabled' in dropdown.props));
  // With nothing chosen, and with a refusal, the dropdown's value is '' — "Select a category".
  assert.equal(dropdownOf({ none: true }).props.value, '');
  assert.equal(count(code(SECTION), 'onChange={(e) => onPick(pickedOf(e.target.value))}'), 1);
});

// ── T6 · THE URL HALF ────────────────────────────────────────────────────────

test('T6 the URL half — no param and an empty one are none; a category id is that category; anything else is refused by name; a pick sets ?into=<id>, "Select a category" takes ?into out, and the anchor is kept either way', () => {
  assert.equal(INTO_PARAM, 'into');
  assert.equal(EVENTS_ANCHOR, 'events');
  // The reading: what useSearchParams().get('into') hands back.
  assert.deepEqual(choiceOf(null), { none: true }, 'no param → none');
  assert.deepEqual(choiceOf(''), { none: true }, 'an empty one → none');
  assert.deepEqual(choiceOf(new URLSearchParams('').get(INTO_PARAM)), { none: true });
  assert.deepEqual(choiceOf(new URLSearchParams('into=').get(INTO_PARAM)), { none: true });
  for (const c of EXPERIENCE_CATEGORIES) assert.deepEqual(choiceOf(new URLSearchParams(`into=${c.id}`).get(INTO_PARAM)), { category: c.id }, `?into=${c.id} opens ${c.label}`);
  assert.deepEqual(choiceOf('nope'), { refused: 'nope' }, 'an unknown value is refused by name — never none, never a substitute');
  assert.deepEqual(choiceOf(' '), { refused: ' ' });
  assert.deepEqual(choiceOf('Surfing'), { refused: 'Surfing' });
  // The view under each reading: none closed, a link's category open with the dropdown showing it.
  assert.equal(under(view(choiceOf(null))), '</section>');
  assert.deepEqual(selectedIn(view(choiceOf('golf'))), ['golf'], 'a link to ?into=golf opens Golf with the dropdown showing it');
  // The writing: a category sets ?into=<id>; "Select a category" takes it out; the anchor closes the URL either way.
  assert.equal(pickHref('/', '', 'surfing'), '/?into=surfing#events');
  assert.equal(pickHref('/', 'into=surfing', 'wildlife'), '/?into=wildlife#events', 'another category replaces the one in the URL');
  assert.equal(pickHref('/', 'into=surfing', null), '/#events', '"Select a category" takes ?into out — and leaves no "?" behind');
  assert.equal(pickHref('/', '', null), '/#events');
  assert.equal(pickHref('/', 'into=nope', 'golf'), '/?into=golf#events', 'a pick after a refusal replaces the refused value');
  assert.equal(pickHref('/', 'into=nope', null), '/#events');
  // Every other parameter is kept, in place.
  assert.equal(pickHref('/', 'ref=a&into=golf&x=1', 'f1'), '/?ref=a&into=f1&x=1#events');
  assert.equal(pickHref('/', 'ref=a&into=golf&x=1', null), '/?ref=a&x=1#events');
  assert.equal(pickHref('/home', 'x=1', 'golf'), '/home?x=1&into=golf#events');
  // The query as the browser hands it — window.location.search, with its "?" — reads the same.
  assert.equal(pickHref('/', '?into=surfing', 'wildlife'), '/?into=wildlife#events');
  assert.equal(pickHref('/', '?into=surfing', null), '/#events');
  assert.equal(pickHref('/', '?ref=a&into=golf', null), '/?ref=a#events');
  // A round trip: what a pick writes is what the reading opens; what "Select a category" writes reads as none.
  for (const c of EXPERIENCE_CATEGORIES) {
    const href = pickHref('/', '', c.id);
    assert.deepEqual(choiceOf(new URL(href, 'https://example.org').searchParams.get(INTO_PARAM)), { category: c.id });
  }
  assert.deepEqual(choiceOf(new URL(pickHref('/', 'into=golf', null), 'https://example.org').searchParams.get(INTO_PARAM)), { none: true });
  // The component, held WHOLE — nothing may stand between these lines: it reads the choice from the URL; a pick replaces the URL with the browser's own
  // replace (Alex's ruling, 2026-11-11: router.replace is a round trip to the server here, and the dropdown showed its previous value until it answered) —
  // the address as it stands that moment, the same call whether it sets ?into or takes it out; and the view is handed exactly that choice and that pick.
  const section = code(SECTION);
  assert.match(section, new RegExp([
    'function ExperiencesFromUrl\\(\\{ today \\}: \\{ today: string \\}\\) \\{',
    'const params = useSearchParams\\(\\);',
    'useEffect\\(\\(\\) => \\{',
    'landOnEvents\\(window\\.location\\.hash, \\(id\\) => document\\.getElementById\\(id\\)\\);',
    '\\}, \\[\\]\\);',
    'const choice = choiceOf\\(params\\.get\\(INTO_PARAM\\)\\);',
    'const pick = \\(id: ExperienceCategoryId \\| null\\) => \\{',
    "window\\.history\\.replaceState\\(null, '', pickHref\\(window\\.location\\.pathname, window\\.location\\.search, id\\)\\);",
    '\\};',
    'return <ExperiencesView rows=\\{EXPERIENCES\\} today=\\{today\\} choice=\\{choice\\} onPick=\\{pick\\} />;',
    '\\}',
  ].join('\\s*')), 'the URL half, whole: the choice read from the URL, the browser\'s replace on a pick, the view handed both');
  // …and the module's default export mounts exactly that half, in its Suspense boundary, and nothing else. The view is mounted nowhere else in the
  // file, so nothing can stand in for the URL's choice — a default export that drew the view itself, on a category of its own, would open the page on it.
  assert.match(section, new RegExp([
    'export default function ExperiencesSection\\(\\{ today \\}: \\{ today: string \\}\\) \\{',
    'return \\(',
    '<Suspense fallback=\\{null\\}>',
    '<ExperiencesFromUrl today=\\{today\\} />',
    '</Suspense>',
    '\\);',
    '\\}',
  ].join('\\s*')), 'the default export, whole: the URL half in its Suspense boundary');
  assert.equal(count(section, '<ExperiencesView'), 1, 'the view is mounted once — by the URL half');
  assert.equal(count(section, '<ExperiencesFromUrl'), 1, 'the URL half is mounted once — by the default export');
  assert.equal(count(section, 'export default'), 1);
  assert.equal(count(section, 'window.history.replaceState('), 1, 'one replace — the same call sets ?into and takes it out');
  assert.equal(count(section, 'choiceOf('), 2, 'the reading: declared once, called once');
  assert.equal(count(section, 'pickHref('), 2, 'the writing: declared once, called once');
  assert.doesNotMatch(section, /useRouter|router\.|\.pushState\(|location\.(assign|replace)\(|location\.(href|hash|search)\s*=[^=]/, 'no router, no new history entry, no navigation — the browser\'s replace only');
  assert.match(section, /if \(id === null\) next\.delete\(INTO_PARAM\);\n\s*else next\.set\(INTO_PARAM, id\);/);
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|useState\(/, 'the URL is the only state');
});

// ── T7 · WHAT LEFT ───────────────────────────────────────────────────────────

test('T7 what left with its last reader — no aria-pressed, no role="group", no SEASONS_LABEL, no DEFAULT_INTO, no chip class in the section\'s code; `group` stays on the leaf and the season\'s lines still read it; the leaf\'s note is corrected', () => {
  const section = code(SECTION);
  for (const gone of ['aria-pressed', 'role="group"', 'SEASONS_LABEL', 'DEFAULT_INTO', 'chipRow', 'chipOn', 'chipOff', 'EXP.chip', 'rounded-full', 'data-into=', "'SEASONS'", "c.group === 'event'", 'type ExperienceCategory,']) {
    assert.ok(!section.includes(gone), `${gone} left the section's code`);
  }
  assert.doesNotMatch(section, /\bchip\b/i, 'no chip is drawn, named or read');
  // The module's exports: the two names are gone, not kept unread; the new ones are there.
  const exported = sectionModule as Record<string, unknown>;
  assert.ok(!('DEFAULT_INTO' in exported) && !('SEASONS_LABEL' in exported));
  for (const name of ['SELECT_CATEGORY', 'choiceOf', 'pickHref', 'pickedOf', 'ExperiencesView', 'INTO_LABEL', 'INTO_PARAM', 'COMING_UP_LABEL', 'WHEN_TO_GO_LABEL', 'CLOSING_LINE', 'SEASONS_CLOSING_LINE', 'notACategory', 'nothingUpcoming', 'landOnEvents', 'StayNearContext', 'EVENTS_ANCHOR']) {
    assert.ok(name in exported, `${name} is exported`);
  }
  // `group` stays on the leaf — every category says which it is — and the section reads it once (isSeason), for three things: a season's own label
  // over its rows, no "Nothing announced yet" line on a season, and a season's own closing line. (The leaf's law reads it too — the leaf's note says so.)
  assert.ok(EXPERIENCE_CATEGORIES.every((c) => c.group === 'event' || c.group === 'season'));
  assert.equal(count(section, "const isSeason = EXPERIENCE_CATEGORIES.some((c) => c.id === into && c.group === 'season');"), 1);
  assert.equal(count(section, '.group'), 1);
  for (const read of ['{isSeason ? WHEN_TO_GO_LABEL : COMING_UP_LABEL}', 'comingUp.length === 0 && !isSeason &&', '{isSeason ? SEASONS_CLOSING_LINE : CLOSING_LINE}']) {
    assert.equal(count(section, read), 1, `the section reads the season group here, once: ${read}`);
  }
  assert.equal(count(section, 'isSeason'), 4, 'isSeason: declared once, read three times — nothing else in the section depends on the group');
  // The three states of the choice, and no fourth.
  assert.equal(count(section, 'export type IntoChoice = { category: ExperienceCategoryId } | { refused: string } | { none: true };'), 1);
  // The leaf's notes, corrected (comments only): the note over its first entry names no default, and the four that described chips and two rows in the
  // present tense say the dropdown — each keeping what it said until then. (Two dated notes inside the list still end "so the default does not change":
  // history, left as it stands.)
  const leafNotes = comments(LEAF);
  assert.ok(!leafNotes.includes('DEFAULT_INTO') && !leafNotes.includes('default category'), 'the note over the first entry names no DEFAULT_INTO and no default category');
  assert.ok(leafNotes.includes('no longer a default (EVENTS-05, 2026-11-11: ExperiencesSection.tsx chooses none)'));
  for (const said of ['The chips split into two rows by it. */', '/** The chip and the heading. */', 'the I\'M INTO row shows the events, the SEASONS row the seasons. */', '— the chips read in this order (EVENTS-02', 'the group only chooses']) {
    assert.ok(!leafNotes.includes(said), `the leaf no longer says, in the present tense, "${said}"`);
  }
  // …and each says who reads it now: the group — the section (a season's label, its closing line, no "Nothing announced yet") and the leaf's own law;
  // the label — the dropdown's option, the section's "Nothing announced yet" line and a trip post's event eyebrow.
  for (const says of ['EVENTS-05 (2026-11-11): the one dropdown lists both, events first', 'The group is still read in two places: the section gives a season category its own label over its rows, its own closing line and no "Nothing announced yet" line, and this file\'s law holds season rows to season categories and season categories to season rows.', 'The option\'s words in the I\'M INTO dropdown; the category\'s name in the section\'s "Nothing announced yet" line and in a trip post\'s event eyebrow', 'EVENTS-05 (2026-11-11): the one dropdown lists every category whatever its group', 'the I\'M INTO dropdown\'s options read in this order, under "Select a category"']) {
    assert.ok(leafNotes.includes(says), `the leaf says "${says}"`);
  }
  assert.equal(EXPERIENCE_CATEGORIES[0].id, 'surfing', 'the first entry — the first option under "Select a category" — is unchanged');
});

// ── T8 · THE LOOK ────────────────────────────────────────────────────────────

// HOME-TRAVEL-01 (Alex, 2026-11-12; the board approved at 20:26): RE-POINTED. Until then T8 held the dropdown to the booking lookup's FIELD classes
// ('mt-1 block w-full rounded border border-border bg-white px-3 py-2 text-sm text-text-primary', read from GuestBookingLookup.tsx), with FIELD's mt-1
// read as mt-3, then 'min-h-[44px]' and 'lg:w-72' — EVENTS-05's "the dropdown wears the booking lookup's field classes". Both now wear the reference's
// field, each by its own class, and the README says it once: "The dropdown and the lookup's fields wear the house's own field line, --ts-border".
// So T8 reads the two rules in src/app/globals.css and holds the field's look equal between them.
test('T8 the look (HOME-TRAVEL-01, 2026-11-12) — the dropdown and the lookup\'s "Manage reference" input wear the reference\'s field, each by its own class: 46px tall, a 12px radius, the house\'s field line, white, body ink at 15px; the dropdown in its box (340px at most) with its chevron; no colour and no font of its own; the label is untouched', () => {
  // The lookup's field class, read where it lives — the home page's "Manage reference" input wears it.
  const lookup = code(LOOKUP);
  const field = /\nconst FIELD = '([^']*)';\n/.exec(lookup);
  assert.ok(field, 'the lookup\'s FIELD');
  assert.equal(field[1], 'ts-tm-input', 'the reference\'s .tm-input, behind the house prefix');
  assert.match(lookup, /Manage reference<\/span>\s*<input name="reference"[^\n]*className=\{FIELD\} data-guest-reference \/>/, 'the Manage reference input wears FIELD');
  // The dropdown's class, as drawn — the same on every view.
  const drawn = /<select aria-label="[^"]*" class="([^"]*)" data-into-select="true">/.exec(view({ none: true }));
  assert.ok(drawn);
  assert.equal(drawn[1], 'ts-tm-select__field', 'the reference\'s .tm-select__field, alone');
  for (const choice of [{ category: 'surfing' }, { category: 'wildlife' }, { refused: 'nope' }] as IntoChoice[]) {
    assert.equal(/<select aria-label="[^"]*" class="([^"]*)" data-into-select="true">/.exec(view(choice))?.[1], drawn[1]);
  }
  // The two rules, read from the stylesheet: one declaration per line of each body, whitespace collapsed.
  const css = code('src/app/globals.css');
  const ruleOf = (selector: string): Map<string, string> => {
    const at = css.indexOf(`\n${selector} {`);
    assert.ok(at > -1 && css.indexOf(`\n${selector} {`, at + 1) === -1, `${selector}: one rule`);
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    return new Map(body.split(';').map((d) => d.replace(/\s+/g, ' ').trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()] as [string, string]));
  };
  const select = ruleOf('.ts-tm-select__field');
  const input = ruleOf('.ts-tm-input');
  for (const [prop, value] of [['height', '46px'], ['border', '1px solid rgb(var(--ts-border))'], ['border-radius', '12px'], ['background-color', 'rgb(var(--ts-fs-white))'], ['color', 'var(--ts-fs-ink)'], ['font-size', '15px'], ['font-family', 'inherit'], ['box-sizing', 'border-box'], ['display', 'block'], ['width', '100%']] as const) {
    assert.equal(select.get(prop), value, `the dropdown: ${prop}: ${value}`);
    assert.equal(input.get(prop), value, `the lookup's field: ${prop}: ${value}`);
  }
  assert.equal(select.get('padding'), '0 42px 0 14px', 'room for the chevron on the right');
  assert.equal(input.get('padding'), '0 14px');
  assert.equal(ruleOf('.ts-tm-select').get('max-width'), '340px', 'the dropdown\'s box: 340px at most');
  // No colour and no font of its own: every colour either rule reads is a token, and neither names a face.
  for (const [prop, value] of [...select, ...input]) {
    assert.doesNotMatch(value, /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/, `${prop}: ${value} — no hex, no rgb value`);
    if (prop === 'font-family') assert.equal(value, 'inherit', 'the face is the section\'s');
  }
  // The chevron over the dropdown's right edge, drawn for the eye — the dropdown is named by its label.
  assert.ok(view({ none: true }).includes(`</select>${CHEVRON}</div>`), 'the chevron, aria-hidden, after the dropdown in its box');
  // The label: the panel's first child, in its own class, with no margin over it — exactly as it was.
  assert.equal(count(code(SECTION), '<p className={EXP.label}>{INTO_LABEL}</p>'), 1);
  assert.ok(view({ none: true }).startsWith(`${PANEL_OPEN}${LABEL}${SELECT_BOX}<select `));
  assert.equal(INTO_LABEL, "I'M INTO…");
});
