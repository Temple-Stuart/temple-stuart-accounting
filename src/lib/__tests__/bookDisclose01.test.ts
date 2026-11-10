/**
 * BOOK-DISCLOSE-01 (Alex, 2026-11-08; board K tag 4) — one line directly under the booking box on the home page:
 * "When you book here, I may earn a commission." Its words live in a pure leaf (src/lib/disclosureWords.ts); the page
 * renders them, never types them.
 * HOME-FINISH-02 (Alex, 2026-11-10 20:56 — the line "should no longer appear as a standalone marketing line beneath the
 * booking interface … retain an appropriate concise disclosure in a compliant location"): the line is INSIDE the box now,
 * the last line of the four panels whose bookings can pay. T2 is re-pointed; T1 and T3 stand as they were.
 *
 *   T1 the words — COMMISSION_LINE is the exact ruled string; the leaf imports nothing; no other file under src types
 *      them (one source);
 *   T2 the line — HOME-FINISH-02: LandingBookingSection.tsx imports COMMISSION_LINE from the leaf and renders it as the
 *      ruled <p>, the LAST line of the Flights, Hotels, Getting around and Things to do panels — and of no other; Landing.tsx
 *      neither imports nor renders it, and nothing but a comment stands between the booking mount and the guest lookup.
 *      (Until then: Landing.tsx imports COMMISSION_LINE from the leaf and renders it once, as the ruled <p>, directly
 *      after the LandingBookingSection mount and before the guest lookup (data-guest-lookup-home); its words are never
 *      typed in Landing.tsx;)
 *   T3 the stronger claim — "I earn a commission" (board K's first draft) is in no file's code under src/.
 * Every text check reads sourceText's code() (comments stripped). No line number, no file length. No clock, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { code } from '../sourceText';
import { COMMISSION_LINE } from '../disclosureWords';
import type { ToggleMode } from '@/components/ui/ToggleStrip';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/disclosureWords.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const SELF = 'src/lib/__tests__/bookDisclose01.test.ts';
const MOUNT = '<LandingBookingSection onRequireAuth={onRequireAuth} events={<ExperiencesSection today={today} />} />'; // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the booking mount carries the experiences catalog as its Events panel — '<LandingBookingSection onRequireAuth={onRequireAuth} />' until then
const WRAPPER = 'src/components/landing/LandingBookingSection.tsx';
// HOME-FINISH-02 (2026-11-10): the ruled <p>, inside the box. Until then, in Landing.tsx under the box: '<p className="mt-3 font-mono text-xs text-text-secondary" data-commission-line>{COMMISSION_LINE}</p>'.
const LINE = '<p className="mt-3 text-xs text-text-secondary" data-commission-line>{COMMISSION_LINE}</p>';
/** The four modes whose bookings can pay, by the builder's keys (src/lib/disclosureWords.ts says why these). */
const PAYING = ['flights', 'hotels', 'transit', 'activities'];
type El = React.ReactElement<Record<string, unknown>>;
/** Every element in a tree, depth first — through props.children only; a component is not rendered here. */
const elementsIn = (node: React.ReactNode): El[] => (Array.isArray(node) ? node.flatMap((n) => elementsIn(n as React.ReactNode))
  : React.isValidElement<Record<string, unknown>>(node) ? [node, ...elementsIn(node.props.children as React.ReactNode)] : []);
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

/** Every .ts and .tsx under src/, as a repo-relative path. */
const srcFiles = (): string[] => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [relative(process.cwd(), full)] : [];
  });
  return walk(resolve(process.cwd(), 'src'));
};

test('T1 the words: the exact ruled string, from a leaf that imports nothing; no other file under src types them', () => {
  assert.equal(COMMISSION_LINE, 'When you book here, I may earn a commission.');
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(/, 'the leaf imports nothing');
  assert.match(leaf, /export const COMMISSION_LINE = 'When you book here, I may earn a commission\.';/);
  const typed = srcFiles().filter((f) => f !== LEAF && f !== SELF && code(f).includes('I may earn a commission'));
  assert.deepEqual(typed, [], 'one source for the words');
});

test('T2 the line (HOME-FINISH-02, 2026-11-10): inside the booking box — the last line of the four panels whose bookings can pay (Flights, Hotels, Getting around, Things to do) and of no other; Landing.tsx neither imports nor renders it, and nothing stands between the box and the guest lookup', async () => {
  // Until HOME-FINISH-02 this test read 'T2 the line: Landing imports COMMISSION_LINE from the leaf and renders it once, directly under the booking
  // section and above the guest lookup' — the import in Landing.tsx, '{COMMISSION_LINE}' and 'data-commission-line' once each there, the ruled <p>
  // whole, after MOUNT with nothing between ('directly under the mount') and before data-guest-lookup-home.
  const landing = code(LANDING);
  for (const gone of ['COMMISSION_LINE', 'data-commission-line', 'disclosureWords']) assert.ok(!landing.includes(gone), `Landing.tsx carries no ${gone} — the box renders the line`);
  assert.doesNotMatch(landing, /When you book here/, 'the words are never typed in Landing.tsx');
  const mount = landing.indexOf(MOUNT);
  const lookup = landing.indexOf('<div className="mt-6 border-t border-border-light pt-4" data-guest-lookup-home>');
  assert.ok(mount > -1 && lookup > mount, 'the booking mount, then the guest lookup');
  assert.match(landing.slice(mount + MOUNT.length, lookup), /^\s*(\{\s*\}\s*)*$/, 'the box → the lookup: a comment between, nothing else — no line under the box');
  // the wrapper's source: the import, the ruled <p> once, the four keys, the throw by name; the words never typed
  const wrapper = code(WRAPPER);
  assert.match(wrapper, /^import \{ COMMISSION_LINE \} from '@\/lib\/disclosureWords';$/m, 'the import');
  assert.equal(count(wrapper, LINE), 1, 'the ruled <p>, whole, once');
  assert.equal(count(wrapper, 'data-commission-line'), 1, 'one hook in the source');
  assert.match(wrapper, /^const PAYING_KEYS: readonly string\[\] = \['flights', 'hotels', 'transit', 'activities'\];$/m, 'the four that can pay, by key');
  assert.match(wrapper, /for \(const key of PAYING_KEYS\) \{\n\s*if \(!ordered\.some\(\(m\) => m\.key === key\)\) throw new Error\(`LandingBookingSection: travelStripModes returned no '\$\{key\}' mode/, 'a paying key the builder does not return → a throw that names it');
  assert.doesNotMatch(wrapper, /When you book here/, 'the words are never typed in the wrapper');
  // the box, as it hands its panels to the strip: the sentence is the last line of exactly the four
  const { travelStripModes } = await import('../../components/trips/travelStripModes');
  const { default: LandingBookingSection } = await import('../../components/landing/LandingBookingSection');
  const { default: ToggleStrip } = await import('../../components/ui/ToggleStrip');
  const catalog = React.createElement('section', { id: 'events' }, 'the catalog');
  const onRequireAuth = () => {};
  let returned: React.ReactNode;
  const Host = () => { returned = LandingBookingSection({ onRequireAuth, events: catalog }); return null; };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  const strips = elementsIn(returned).filter((el) => el.type === ToggleStrip);
  assert.equal(strips.length, 1, 'the shared strip, once');
  const modes = strips[0].props.modes as ToggleMode[];
  const built = travelStripModes({ onRequireAuth, authed: false, eventsAnchor: '#events' });
  const SENTENCE = `<p class="mt-3 text-xs text-text-secondary" data-commission-line="true">${COMMISSION_LINE}</p>`;
  assert.deepEqual(modes.map((m) => m.key).filter((key) => PAYING.includes(key)), PAYING, 'the four paying tabs are in the box');
  for (const m of modes) {
    const drawn = renderToStaticMarkup(React.createElement(React.Fragment, null, m.panel));
    if (!PAYING.includes(m.key)) { assert.equal(count(drawn, 'data-commission-line'), 0, `${m.key}: no disclosure — nothing booked here can pay`); continue; }
    const made = built.find((b) => b.key === m.key);
    assert.ok(made, `${m.key}: the builder makes it`);
    assert.equal(drawn, renderToStaticMarkup(React.createElement(React.Fragment, null, made.panel)) + SENTENCE, `${m.key}: the builder's panel, then the sentence — its last line`);
  }
  // drawn whole: four sentences, each closing its panel; the Events panel (open) carries none
  const whole = renderToStaticMarkup(React.createElement(LandingBookingSection, { onRequireAuth, events: catalog }));
  assert.equal(count(whole, SENTENCE), 4, 'four panels carry it');
  assert.equal(count(whole, `${SENTENCE}</div>`), 4, 'and each is the last thing in its panel');
  assert.ok(whole.includes('<div class="block"><section id="events">the catalog</section></div>'), 'the Events panel is the catalog alone');
});

test('T3 the stronger claim, "I earn a commission", is in no file\'s code under src/', () => {
  const claims = srcFiles().filter((f) => f !== SELF && /I earn a commission/i.test(code(f)));
  assert.deepEqual(claims, []);
});
