/**
 * HOME-TRAVEL-01 (Alex's brief, 2026-11-12 16:08 Manila; the board approved on the design canvas at 20:26: "ok I approve the travel market place")
 * — THE TRAVEL MARKETPLACE SECTION, AS DRAWN: the pillar's name and line on a cream band, the box (eight tabs as tiles, one rule, the open tab's
 * panel), the Events rows with Add to trip, the guest's trip under the box (its events in date order with the days between them, Search flights →),
 * and the booking lookup.
 *
 * The spec is a file: design-refs/home-travel-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is the page as
 * it opens (the board Alex approved)"), with its README beside it. The section is src/components/landing/Landing.tsx's travel <section>; the box is
 * src/components/landing/TravelBox.tsx, mounted by LandingBookingSection.tsx with the Events panel (ExperiencesSection.tsx) and the trip card
 * (GuestTripStrip.tsx) under it; the trip's store is src/lib/guestTrip.ts, its words and order src/lib/guestTripWords.ts; the stylesheet is the
 * reference's own, ported to src/app/globals.css under the house prefix.
 *
 *   T1  the handoff landed — the README and the reference, byte for byte (sha256) and by size;
 *   T2  no token — the reference's :root is the README's two tables, every one already in globals.css :root on the same value; nothing --ts-tm-*;
 *   T3  the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the three differences named there;
 *       no hex and no rgb value typed; every variable it reads is declared and every one the README names is read; it stands under the chip strip's
 *       rules and right above HOME-PLANS-04's; nothing else in the file reaches the section; every class the section wears is the reference's;
 *   T4  the board's markup — the tabs, the Events panel (Tennis, the board's three events in the trip), the trip and the lookup, token for token,
 *       but for the named differences of an app that keeps its hooks; the panels' headlines and disclosures; the section's own frame in Landing.tsx;
 *   T5  the trip's dates — one function beside experienceWindowLine gives the window part, and both read it: for every row on many days, the card's
 *       dates are the dated part of the panel's line, or "Not announced yet" where the line says not announced;
 *   T6  the trip's rules — order, the days between, the summary, places, Stay near it →, focus; day counts from the strings' own parts;
 *   T7  the store — the events join the guest trip: one key, the order added, the catalog id alone; the bookings' writer keeps them; the signal;
 *   T8  the box — the same modes in the same order, Events first and open; Search flights → opens Flights and asks for the top, as Stay near it →
 *       does for Hotels; Add to trip reads the trip and presses through it; the card renders after the read; the app's travel tab is untouched;
 *   T9  the words — every word the new parts draw is a leaf's; the components type none;
 *   T10 the rulings — quoted, dated, where they are built.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests and the reference
 * (HTML, which the reader splits as TypeScript). No clock, no live call: Date.UTC, below, works out the day counts the trip's own arithmetic must
 * match — it reads no clock. What a browser must show — the look at 1440 and 390, nothing sideways from 340px, the box brought into view, the focus
 * moving on a × — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { EXPERIENCES, VENUE_NOT_FIXED, type Experience } from '../experiences';
import {
  ADD_TO_TRIP, IN_YOUR_TRIP, NOT_ANNOUNCED_YET, STAY_NEAR_WORDS, canStayNear, dateWords, dayNumber, experienceLine, experienceWindowLine,
  experienceWindowWords, isUpcoming, notAnnouncedLine, seasonNotAnnouncedLine, tripWhenWords,
} from '../experienceWords';
import {
  BACK_TO_BACK, CREATE_FREE_ACCOUNT, DATES_NOT_ANNOUNCED, GuestTripWordsError, NOT_STATED, OVERLAPS, SEARCH_FLIGHTS, TOTAL, TRIP_EYEBROW, TRIP_PITCH,
  daysBetweenWords, eventCountWords, focusAfterRemove, removeWords, tripEventsView, tripGap,
} from '../guestTripWords';
import { COMMISSION_LINE } from '../disclosureWords';
import { EXPLORE_PILLAR } from '../homeActWords';
import { DEMO_ANCHOR } from '../homeAnchors';
import { ExperiencesView, AddToTripContext, StayNearContext } from '@/components/landing/ExperiencesSection';
import tailwindConfig from '../../../tailwind.config';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/home-travel-01/README.md';
const REFERENCE = 'design-refs/home-travel-01/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const LANDING = 'src/components/landing/Landing.tsx';
const WRAPPER = 'src/components/landing/LandingBookingSection.tsx';
const BOX = 'src/components/landing/TravelBox.tsx';
const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const CARD = 'src/components/landing/GuestTripStrip.tsx';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';
const STORE = 'src/lib/guestTrip.ts';
const TRIP_WORDS = 'src/lib/guestTripWords.ts';
const WORDS = 'src/lib/experienceWords.ts';
/** The reference's day (its script's DATA.today) — the board is drawn on it. */
const TODAY = '2026-11-12';
/** The board: Tennis picked, these three added (the reference's "three" state, as its script opens). */
const BOARD = ['australian-open-2027', 'sapporo-snow-festival-2027', 'f1-2027-r01'] as const;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A whole file's digest, through the reader: the two halves put back together are the file (sourceText.ts rejoin). */
const digest = (file: string): string => sha256(rejoin(code(file), comments(file)));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** HTML's entities, read back to the characters they stand for (the reference writes them raw; React escapes them). */
const unescapeHtml = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const row = (id: string): Experience => {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};

// ── the stylesheets, read as lists of declarations ───────────────────────────

/** A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>". */
function declarations(css: string): string[] {
  const out: string[] = [];
  const walk = (text: string, media: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth > 0; j += 1) {
        if (text[j] === '{') depth += 1;
        else if (text[j] === '}') depth -= 1;
      }
      assert.equal(depth, 0, 'every block closes');
      const prelude = flat(text.slice(i, open));
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) walk(body, prelude);
      else for (const d of body.split(';').map(flat).filter(Boolean)) out.push(`${media} | ${prelude} | ${d}`);
      i = j;
    }
  };
  walk(css, '');
  return out;
}
/** The reference, whole — HTML, which the reader splits as TypeScript; both halves together are the file. */
const referenceText = (): string => rejoin(code(REFERENCE), comments(REFERENCE));
/** The reference's stylesheet: between <style> and </style>, its CSS comments blanked. */
function referenceCss(): string {
  const html = referenceText();
  assert.equal(count(html, '<style>'), 1, 'one stylesheet in the reference');
  return html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}
/** A :root block's declarations as name → value. */
function rootOf(css: string): Map<string, string> {
  const at = css.indexOf(':root {');
  assert.ok(at > -1, 'a :root block');
  const map = new Map<string, string>();
  for (const line of declarations(css.slice(at, css.indexOf('}', at) + 1))) {
    const decl = line.split(' | ')[2];
    map.set(decl.slice(0, decl.indexOf(':')), decl.slice(decl.indexOf(':') + 1).trim());
  }
  return map;
}
/** The port: globals.css from the section's first rule to the next block's — HOME-SERVICES-01's, which stands above HOME-PLANS-04's and the hero's. */
const PORT_OPEN = '.ts-tm {';
const NEXT_PORT = '.ts-ps {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-tm and runs to the Professional Services section\'s first rule');
  return css.slice(at, end);
}
/** The README's "Tokens" section: the rows of the table under one bold lead. */
function readmeTable(lead: string): Array<[name: string, value: string]> {
  const doc = rejoin(code(README), comments(README));
  const section = doc.slice(doc.indexOf('\n## Tokens'), doc.indexOf('\n## ', doc.indexOf('\n## Tokens') + 1));
  const from = section.indexOf(lead);
  assert.ok(from > -1, `the README's Tokens section has "${lead}"`);
  const rows: string[] = [];
  for (const line of section.slice(from).split('\n').slice(1)) {
    if (line.startsWith('|')) rows.push(line);
    else if (rows.length > 0) break;
  }
  return rows.filter((l) => l.startsWith('| `')).map((r) => {
    const cells = r.split('|').slice(1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value, `${README}: "${r}" names one token and one value`);
    return [name[1], value[1]] as [string, string];
  });
}

/** ALREADY IN THE APP — the README's first table: the reference declares them only so it renders on its own. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['red', '197 48 48'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'],
  ['hero-violet-4', '#210A5E'], ['hero-gold-1', '255 236 178'], ['hero-gold-2', '248 203 90'], ['hero-gold-3', '236 178 62'], ['hero-on-gold', '#2A0F5C'],
];
/** ADDED BY HOME-PLANS-04 — the README's second table: on main since PR #1971 as --ts-fs-*, the same values. */
const FROM_PLANS_04: ReadonlyArray<readonly [name: string, value: string]> = [
  ['fs-white', '255 255 255'], ['fs-ink', '#2B2545'], ['fs-ink-soft', '#4A4560'], ['fs-ink-muted', '#6F6988'], ['fs-gold-text', '#8A6408'],
  ['fs-line', '#E9E4F2'], ['fs-rule', '#EEEAF5'], ['fs-chip-line', '#E4DFF0'], ['fs-button-line', '#CFC6EC'], ['fs-band-muted', '#D6CCF7'], ['fs-shadow', '33 10 94'],
];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted and every run of text, entities read back; comments and the whitespace that only
 * lays the file out dropped. With `prefix`, every class gets the house prefix — the reference's .tm-box is the app's .ts-tm-box.
 */
function tokensOf(html: string, prefix: boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<!--')) continue;
    if (!t.startsWith('<')) {
      if (/^\s*$/.test(t)) { if (!t.includes('\n')) out.push('#text " "'); continue; }
      out.push(`#text ${JSON.stringify(unescapeHtml(t).replace(/\s+/g, ' '))}`);
      continue;
    }
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?)>$/.exec(t);
    assert.ok(tag, `a tag: ${t}`);
    if (tag[1]) { out.push(`</${tag[2]}>`); continue; }
    const attrs: Array<[string, string]> = [];
    for (const a of tag[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
      const value = unescapeHtml(a[2] ?? '');
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
/**
 * THE NAMED DIFFERENCES between the reference's markup and the app's — each one where the reference is a page and this is the app:
 *   1. ATTRIBUTE NAMES as HTML reads them: React writes autoComplete and maxLength; the browser reads both case-blind.
 *   2. A PRESENCE HOOK: the reference writes data-box="", React writes data-box="true" — the same hook, read by presence ([data-box]).
 *   3. THE APP'S OWN HOOKS stay, as the brief rules ("every data-* a test reads"): KEPT_HOOKS, below, are dropped from the app's side.
 *   4. THE TAB ICON is the mode's own lucide node at 22px: lucide adds its xmlns and its own two classes beside the reference's one.
 *   5. A CONTROLLED FIELD: React writes the input's value="", and the server's lookup is disabled until the page is live (GUEST-01).
 *   6. A LINE THE REFERENCE KEEPS EMPTY AND HIDDEN — the refused ?into= line, the stay line, the lookup's failure line — is drawn by the app only
 *      when it has something to say.
 */
const KEPT_HOOKS = ['data-experiences', 'data-into-select', 'data-coming-up-rail', 'data-experience-line', 'data-series', 'data-checked', 'data-source',
  'data-nothing-upcoming', 'data-into-refused', 'data-guest-reference', 'data-guest-code', 'data-guest-open', 'data-guest-lookup-hint', 'data-guest-failure',
  'data-commission-line', 'data-stay-near-line'];
function normalized(tokens: readonly string[], side: 'reference' | 'app'): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    // 6. an empty, hidden line on the reference's side: its tag and its close, nothing between
    if (side === 'reference' && t.startsWith('<p ') && t.includes(' hidden=""') && tokens[i + 1] === '</p>') { i += 1; continue; }
    if (!t.startsWith('<') || t.startsWith('</')) { out.push(t); continue; }
    const name = /^<([a-zA-Z0-9]+)/.exec(t)?.[1] ?? '';
    const attrs = [...t.matchAll(/ ([^\s=]+)="([^"]*)"/g)].map((m) => [m[1].toLowerCase(), m[2]] as [string, string]) // 1.
      .filter(([k]) => !(side === 'app' && (KEPT_HOOKS.includes(k) || k === 'xmlns' || (name === 'input' && k === 'value') || (name === 'fieldset' && k === 'disabled')))) // 3, 4, 5
      .map(([k, v]): [string, string] => [k, k.startsWith('data-') && v === 'true' ? '' : v]) // 2.
      .map(([k, v]): [string, string] => [k, k === 'class' && side === 'app' ? v.split(' ').filter((c) => !/^lucide(-|$)/.test(c)).join(' ') : v]); // 4.
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${name}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
/** The reference's section, as it opens (the board): between its <!--TM--> markers. */
function referenceBoard(): string {
  const html = referenceText();
  return html.slice(html.indexOf('<!--TM-->') + '<!--TM-->'.length, html.indexOf('<!--/TM-->'));
}
/** The first element that opens with `open`, through its matching close of the same tag. */
function elementAt(html: string, open: string): string {
  const at = html.indexOf(open);
  assert.ok(at > -1, `drawn: ${open}`);
  const tag = /^<([a-z0-9]+)/.exec(open)?.[1] as string;
  let depth = 0;
  for (const m of html.slice(at).matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g'))) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(at, at + (m.index as number) + m[0].length);
  }
  throw new Error(`${open} never closes`);
}
/** What is inside an element (its first tag and its close dropped). */
const insideOf = (element: string): string => element.slice(element.indexOf('>') + 1, element.lastIndexOf('</'));

const noop = (): void => {};
const panelOnTheBoard = (): string => renderToStaticMarkup(React.createElement(StayNearContext.Provider, { value: noop },
  React.createElement(AddToTripContext.Provider, { value: { inTrip: (id: string) => (BOARD as readonly string[]).includes(id), onToggle: noop } },
    React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, choice: { category: 'tennis' }, onPick: noop }))));

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the reference links only to the fonts and the rows\' own sources', () => {
  const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
    [README, 23580, '753b1d8a214cb38e71060615c28e6b17038649338592db97557805c972227c47'],
    [REFERENCE, 169591, '6477612c168a6835988bdada4c598acfcda32f4efc0afdc6026801dd8298bf4e'],
  ];
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: its size`);
    assert.equal(digest(file), sha, `${file}: byte for byte as handed over — never redrawn or hand-edited`);
  }
  const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap';
  const sources = new Set(EXPERIENCES.map((r) => r.sourceUrl));
  const page = referenceText().slice(0, referenceText().indexOf('<script>'));
  const linked = [...page.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => unescapeHtml(m[1]));
  assert.ok(linked.length > 1);
  for (const href of linked) assert.ok(href === FONTS || sources.has(href), `${href}: the fonts, or a row's own source`);
});

// ── T2 · NO TOKEN ────────────────────────────────────────────────────────────

test('T2 no token — the reference\'s :root is the README\'s two tables, every one already in globals.css :root on the same value behind the house prefix; nothing --ts-tm-*, no tm family', () => {
  assert.deepEqual(readmeTable('**Already in the app.**'), KEPT.map(([n, v]) => [n, v]), 'the README\'s first table, row by row');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**'), FROM_PLANS_04.map(([n, v]) => [n, v]), 'the README\'s second table, row by row');
  assert.ok(rejoin(code(README), comments(README)).includes('**New with this section: none.**'), 'the README: none new');
  const ref = rootOf(referenceCss());
  assert.deepEqual([...ref.keys()].sort(), [...KEPT, ...FROM_PLANS_04].map(([n]) => `--${n}`).sort(), 'the reference declares these twenty-one and no other');
  for (const [name, value] of [...KEPT, ...FROM_PLANS_04]) assert.equal(ref.get(`--${name}`), value, `the reference: --${name}`);
  const css = code(GLOBALS);
  assert.equal((css.match(/:root\b/g) ?? []).length, 1, 'one :root in globals.css');
  const root = rootOf(css);
  for (const [name, value] of [...KEPT, ...FROM_PLANS_04]) {
    assert.equal(root.get(`--ts-${name}`), value, `globals.css :root: --ts-${name} is the reference's --${name} — added by no one here`);
    assert.equal([...css.matchAll(new RegExp(`--ts-${name}\\s*:`, 'g'))].length, 1, `--ts-${name}: declared once in globals.css`);
  }
  assert.doesNotMatch(css, /--ts-tm[\w-]*\s*:/, 'no token of this section\'s own');
  const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  assert.ok(!('tm' in colors), 'tailwind.config.ts: no tm family');
});

// ── T3 · THE STYLESHEET IS THE REFERENCE'S ───────────────────────────────────

test('T3 the section\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the three named differences; no hex and no rgb value typed; every variable it reads is declared; it stands under the chip strip and above the other sections\' ports; nothing outside it reaches the section; every class the section wears is the reference\'s', () => {
  const expected: string[] = [];
  for (const line of declarations(referenceCss())) {
    const [media, selector, decl] = line.split(' | ');
    // 1. THE COLOURS are tokens in globals.css :root (T2), never declared here.
    if (selector === ':root') continue;
    // 3. NOT PORTED: "THIS PAGE'S OWN" — the page's ground, its state bar and its dashed frames.
    if (selector === 'body' || selector.startsWith('.ref-')) continue;
    const renamed = [media, selector.replace(/\.([a-z])/g, '.ts-$1'), decl.replace(/var\(--/g, 'var(--ts-')];
    // 2. THE FONTS are the site's two: the reference names the families, the app reads the variables layout.tsx declares.
    renamed[2] = renamed[2].replace("font-family: 'IBM Plex Mono', monospace", 'font-family: var(--font-mono)').replace("font-family: 'Inter', sans-serif", 'font-family: var(--font-sans)');
    expected.push(renamed.join(' | '));
  }
  const port = declarations(portCss());
  assert.deepEqual(port, expected, 'the port, line for line, and nothing more');
  assert.ok(port.length > 250, `a whole stylesheet was compared (${port.length} declarations)`);
  for (const line of port) {
    const [, selector, decl] = line.split(' | ');
    for (const cls of selector.match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-tm'), `${selector}: ${cls} wears the section's prefix`);
    assert.doesNotMatch(decl, /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/, `${line}: no hex and no rgb value — "The stylesheet types no hex and no rgb value outside :root"`);
    assert.doesNotMatch(decl, /var\(--(?!ts-|font-)|'Inter'|'IBM Plex Mono'/, `${line}: the reference's own names are renamed`);
  }
  // every variable it reads is declared — a colour in :root, a face by the layout — and every one the README's tables name is read
  const root = rootOf(code(GLOBALS));
  const read = new Set(port.flatMap((l) => [...l.split(' | ')[2].matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
  for (const v of read) assert.ok(root.has(v) || v === '--font-mono' || v === '--font-sans', `${v} is declared`);
  for (const [name] of [...KEPT, ...FROM_PLANS_04]) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read, as the README's table says`);
  const layout = code('src/app/layout.tsx');
  assert.match(layout, /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(layout, /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  // ONE GRADIENT: the gold button, with --ts-hero-gold-2 under it
  const gradients = port.filter((l) => /gradient\(/.test(l));
  assert.deepEqual(gradients, [' | .ts-tm-cta | background-image: linear-gradient(135deg, rgb(var(--ts-hero-gold-1)) 0%, rgb(var(--ts-hero-gold-2)) 52%, rgb(var(--ts-hero-gold-3)) 100%)'], 'one gradient: the gold button');
  assert.ok(port.includes(' | .ts-tm-cta | background-color: rgb(var(--ts-hero-gold-2))'), 'with hero-gold-2 under it');
  // where it stands: under the chip strip's rules, then the Professional Services section's port, the Financial Software section's and the hero's —
  // each of those runs from its own first rule to the next block's, so a block lands above the last one landed (the brief, written while
  // HOME-SERVICES-01 was in flight, put this one directly above HOME-PLANS-04's; HOME-SERVICES-01 took that seat first)
  const whole = code(GLOBALS);
  const at = whole.indexOf(PORT_OPEN);
  assert.ok(at > whole.lastIndexOf('.ts-chipfade'), 'under the chip strip\'s rules');
  assert.equal(count(whole, PORT_OPEN), 1, 'one port');
  assert.ok(whole.indexOf(NEXT_PORT) > at && whole.indexOf('.ts-fs-heading {') > whole.indexOf(NEXT_PORT) && whole.indexOf('.ts-hero {') > whole.indexOf('.ts-fs-heading {'), 'the chip strip → this port → Professional Services → Financial Software → the hero');
  // nothing outside the port names its classes — by class selector or through a class attribute selector
  const outside = whole.slice(0, at) + whole.slice(whole.indexOf(NEXT_PORT));
  assert.doesNotMatch(outside, /\.ts-tm\b|\.ts-tm[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*tm/, 'and none reaches them through a class attribute selector');
  // nor reaches it by the state it is styled by or a hook it carries — but the rules of the blocks beside it that are styled by the same attributes, every
  // part of each opening with one of that block's own classes (the Professional Services section's tiles and the Financial Software section's switches by
  // [aria-pressed], the top bar's menu by [hidden]): no element of this section wears one, and no ancestor of it does — it is mounted under the page's root,
  // whose classes are Tailwind's (the sibling sections' own tests read the same way)
  const hooks = ['aria-pressed', 'aria-live', 'hidden', 'data-box', 'data-tab', 'data-soon', 'data-panel', 'data-add', 'data-in-trip', 'data-trip', 'data-search-flights', 'data-trip-event', 'data-remove', 'data-overlap', 'data-trip-booked', 'data-list', 'data-guest-lookup', 'data-guest-lookup-home', 'data-stay-near'];
  const besideOwn = (sel: string): boolean => sel.split(',').every((one) => /^\.ts-(?:ps|fs|menu)(?:[-_][\w-]*)?(?![\w-])/.test(one.trim()));
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1]));
  assert.ok(selectorsOutside.length > 50, `the rules outside the port were read (${selectorsOutside.length})`);
  assert.ok(selectorsOutside.some((sel) => besideOwn(sel) && sel.includes('[aria-pressed')), 'the blocks beside it are read');
  for (const sel of selectorsOutside) {
    if (besideOwn(sel)) continue;
    for (const hook of hooks) assert.ok(!sel.includes(`[${hook}`), `${sel}: no rule outside the port reaches the section by [${hook}]`);
  }
  // every class the section wears is the reference's own (behind the house prefix): ruled by the port, or worn by the reference's markup
  const ruled = new Set(port.flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []).map((c) => c.slice(1)));
  const referenceClasses = new Set([...referenceBoard().matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).map((c) => `ts-${c}`));
  const worn = [BOX, CARD, LOOKUP, SECTION, WRAPPER, LANDING].flatMap((f) => [...code(f).matchAll(/(?:className="|className=\{EXP\.\w+\}|: ')(ts-tm[\w\- ]*)['"]/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.ok(worn.length > 50, `the section's classes were read (${worn.length})`);
  for (const cls of new Set(worn)) assert.ok(ruled.has(cls) || referenceClasses.has(cls), `.${cls} is the reference's own`);
});

// ── T4 · THE BOARD'S MARKUP ──────────────────────────────────────────────────

test('T4 the board\'s markup — the tabs, the Events panel (Tennis, the three in the trip), the trip and the lookup are the reference\'s, token for token, but for the named differences; the panels\' headlines and disclosures; the section\'s frame', async () => {
  const board = referenceBoard();
  const { default: LandingBookingSection } = await import('../../components/landing/LandingBookingSection');
  const { default: GuestTripStrip } = await import('../../components/landing/GuestTripStrip');
  const { default: GuestBookingLookup } = await import('../../components/guest/GuestBookingLookup');
  const catalog = React.createElement('section', { id: 'events' }, 'the catalog');
  const whole = renderToStaticMarkup(React.createElement(LandingBookingSection, { onRequireAuth: noop, today: TODAY, events: catalog }));
  const same = (app: string, reference: string, what: string): void => {
    const want = normalized(tokensOf(reference, true), 'reference');
    const got = normalized(tokensOf(app, false), 'app');
    assert.ok(want.length > 20, `${what}: compared (${want.length} tokens)`);
    assert.deepEqual(got, want, `${what}: the reference's markup`);
  };
  // the box opens as drawn, Events open: the eight tiles, then one rule over the panels
  assert.ok(whole.startsWith('<div class="ts-tm-box" data-box="true"><div class="ts-tm-tabs">'), 'the box, then its tiles');
  same(elementAt(whole, '<div class="ts-tm-tabs">'), elementAt(board, '<div class="tm-tabs">'), 'the eight tabs');
  // every panel but Events opens with its mode's headline, in the tabs' order; the four that pay close with the disclosure
  const headlines = (html: string, cls: string) => [...html.matchAll(new RegExp(`<p class="${cls}">([^<]*)</p>`, 'g'))].map((m) => unescapeHtml(m[1]));
  assert.deepEqual(headlines(whole, 'ts-tm-panel__headline'), headlines(board, 'tm-panel__headline'), 'the seven headlines, as drawn');
  assert.equal(headlines(board, 'tm-panel__headline').length, 7);
  const disclosed = (html: string, panel: string, cls: string) => [...html.matchAll(new RegExp(`<p class="${cls}"[^>]*>${COMMISSION_LINE}</p>\\s*</div>`, 'g'))].length + (panel ? 0 : 0);
  assert.equal(disclosed(whole, '', 'ts-tm-disclosure'), 4, 'the four that pay close with the disclosure');
  assert.equal(disclosed(board, '', 'tm-disclosure'), 4, 'as the reference draws them');
  // the Events panel: Tennis, the board's three in the trip — the panel's inside, as drawn
  const section = panelOnTheBoard();
  assert.ok(section.startsWith('<section id="events" aria-label="Book the experience" data-experiences="true">'), 'the panel, its id and its name');
  same(insideOf(section), insideOf(elementAt(board, '<section class="tm-panel" id="events"')), 'the Events panel on the board');
  // the trip: the board's three, added in any order — drawn in date order with the days between them
  const trip = renderToStaticMarkup(React.createElement(GuestTripStrip, { trip: { bookings: [], events: [BOARD[2], BOARD[0], BOARD[1]] }, today: TODAY, onRequireAuth: noop, onStayNear: noop, onSearchFlights: noop, onNoEventLeft: noop }));
  same(trip, elementAt(board, '<section class="tm-trip"'), 'the trip on the board');
  // the lookup: the same fields, words and behaviour in the new look
  same(renderToStaticMarkup(React.createElement(GuestBookingLookup, { onOpened: noop })), elementAt(board, '<form class="tm-lookup__form"'), 'the lookup');
  // the section's frame, in Landing.tsx: the cream band, the page container, the heading with the demo's anchor, the line, the box, the lookup's seat
  const landing = code(LANDING);
  const frame = [
    '<section aria-label="Live demo — travel" className="ts-tm">',
    '<div className="ts-tm__inner">',
    '<h2 id={DEMO_ANCHOR} className="ts-tm__title">{EXPLORE_PILLAR.heading}</h2>',
    '{EXPLORE_PILLAR.paragraphs.map((words) => <p key={words} className="ts-tm__lede">{words}</p>)}',
    '<LandingBookingSection onRequireAuth={onRequireAuth} today={today} events={<ExperiencesSection today={today} />} />',
    '<div className="ts-tm-lookup" data-guest-lookup-home>',
    "<GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />",
  ];
  const at = frame.map((part) => { assert.equal(count(landing, part), 1, `${part}: once`); return landing.indexOf(part); });
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the band → its container → the heading → the line → the box → the lookup');
  assert.ok(board.includes(`<h2 class="tm__title" id="${DEMO_ANCHOR}">${EXPLORE_PILLAR.heading}</h2>`) && board.includes(`<p class="tm__lede">${EXPLORE_PILLAR.paragraphs[0]}</p>`), 'the heading and the line are the pillar\'s own words, on the demo\'s anchor');
  assert.ok(board.includes('<div class="tm-lookup" data-guest-lookup-home="">'), 'the lookup\'s seat, as drawn');
});

// ── T5 · THE TRIP'S DATES ────────────────────────────────────────────────────

test('T5 the trip\'s dates come from one function beside experienceWindowLine, and both read it — for every row on many days the card\'s dates are the dated part of the panel\'s line, or "Not announced yet" where the line says not announced', () => {
  assert.equal(NOT_ANNOUNCED_YET, 'Not announced yet');
  const DAYS = ['2026-10-30', TODAY, '2027-01-01', '2027-03-13', '2027-06-01', '2099-12-31'];
  let windows = 0;
  let notYet = 0;
  for (const r of EXPERIENCES) {
    if (r.status !== 'not_announced') {
      const part = experienceWindowWords(r);
      assert.ok(experienceWindowLine(r).startsWith(`${part} · `), `${r.id}: the line opens with the window part`);
    } else assert.throws(() => experienceWindowWords(r), /has no window to name/, `${r.id}: no window, no guess`);
    for (const day of DAYS) {
      const line = experienceLine(r, day);
      const saysNot = line === notAnnouncedLine(r.checkedOn) || line === seasonNotAnnouncedLine(r.checkedOn);
      const when = tripWhenWords(r, day);
      if (saysNot) { assert.equal(when, NOT_ANNOUNCED_YET, `${r.id} on ${day}`); notYet += 1; } else {
        assert.equal(when, line.split(' · ')[0], `${r.id} on ${day}: the dated part of the line, without its source`);
        assert.equal(when, experienceWindowWords(r), `${r.id} on ${day}: the window part`);
        windows += 1;
      }
      // a dated event in the trip is one whose line names an open window — never a usual season, never one closed
      if (isUpcoming(r, day)) assert.match(when, /^(Window |Season )?[A-Z][a-z]{2} \d/, `${r.id} on ${day}: dated`);
    }
  }
  assert.ok(windows > 300 && notYet > 300, `both kinds were read (${windows} windows, ${notYet} not announced)`);
  // the kinds the README names, each with its words
  assert.equal(tripWhenWords(row('australian-open-2027'), TODAY), 'Jan 17–31, 2027');
  assert.equal(tripWhenWords(row('nazare-big-wave-2026-27'), TODAY), 'Window Nov 1, 2026 – Mar 31, 2027');
  assert.equal(tripWhenWords(row('zermatt-ski-season-2026-27'), TODAY), 'Season Nov 1, 2026 – May 2, 2027');
  assert.equal(tripWhenWords(row('whistler-ski-season-2026-27'), TODAY), 'Usually Nov – May');
  assert.equal(tripWhenWords(row('us-open-tennis-2027'), TODAY), NOT_ANNOUNCED_YET, 'no dates');
  assert.equal(tripWhenWords(row('philippines-pro-2026'), TODAY), NOT_ANNOUNCED_YET, 'a window closed by today');
  // the source: the line reads the part; the card's words sit beside it and read it off the line, never a list of statuses
  const words = code(WORDS);
  assert.match(words, /export function experienceWindowLine\(row: Experience\): string \{\n\s*const part = experienceWindowWords\(row\);/, 'experienceWindowLine reads the window part');
  assert.ok(words.indexOf('export function experienceWindowWords(') < words.indexOf('export function experienceWindowLine(') && words.indexOf('export function tripWhenWords(') > words.indexOf('export function experienceWindowLine('), 'the two functions stand beside experienceWindowLine');
  assert.match(words, /return line === notAnnouncedLine\(row\.checkedOn\) \|\| line === seasonNotAnnouncedLine\(row\.checkedOn\) \? NOT_ANNOUNCED_YET : experienceWindowWords\(row\);/, 'read off the line');
  assert.doesNotMatch(words, /new Date\(|Date\.now\(|toLocale|\bIntl\./, 'still pure: no clock, no locale');
});

// ── T6 · THE TRIP'S RULES ────────────────────────────────────────────────────

/** A row of the leaf with its own id and dates — the trip's rules worked on any pair. */
const dated = (id: string, start: string, end: string): Experience => ({ ...row('masters-2027'), id, name: `Event ${id}`, start, end });
/** The days strictly between two dates, by Date.UTC — the check's own arithmetic, against which the trip's is held. */
const daysBetweenUtc = (end: string, start: string): number => (Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10)) - Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10))) / 86400000 - 1;

test('T6 the trip\'s rules — dated events first by start (ties in the order added), then the undated in the order added; the days between two dated events in a row, or that they overlap; the summary; places; Stay near it →; focus; day counts from the strings\' own parts', () => {
  // the board, added in any order
  for (const added of [[...BOARD], [BOARD[2], BOARD[0], BOARD[1]], [BOARD[1], BOARD[2], BOARD[0]]]) {
    const view = tripEventsView(added, TODAY);
    assert.deepEqual(view.events.map((e) => e.row.id), [...BOARD], 'by start date');
    assert.deepEqual(view.events.map((e) => e.gap?.words ?? null), [null, '3 days between', '28 days between']);
    assert.deepEqual(view.events.map((e) => e.when), ['Jan 17–31, 2027', 'Feb 4–11, 2027', 'Mar 12–14, 2027']);
    assert.deepEqual(view.events.map((e) => e.place), ['Melbourne, Australia', 'Sapporo, Japan', 'Sakhir, Bahrain']);
    assert.ok(view.events.every((e) => e.stay && e.gap?.overlap !== true));
    assert.equal(view.summary, '3 events · Jan 17 – Mar 14, 2027');
  }
  // each gap the README names, on rows of its own
  const pair = (a: Experience, b: Experience) => tripEventsView([a.id, b.id], TODAY, [a, b]).events[1].gap;
  assert.deepEqual(pair(dated('a', '2027-04-08', '2027-04-11'), dated('b', '2027-04-10', '2027-04-12')), { words: OVERLAPS, overlap: true }, 'the second starts before the first ends');
  assert.deepEqual(pair(dated('a', '2027-04-08', '2027-04-11'), dated('b', '2027-04-11', '2027-04-12')), { words: OVERLAPS, overlap: true }, 'on the day it ends');
  assert.deepEqual(pair(dated('a', '2027-04-08', '2027-04-11'), dated('b', '2027-04-12', '2027-04-13')), { words: BACK_TO_BACK, overlap: false }, 'the day after');
  assert.deepEqual(pair(dated('a', '2027-04-08', '2027-04-11'), dated('b', '2027-04-13', '2027-04-13')), { words: '1 day between', overlap: false });
  assert.deepEqual(pair(dated('a', '2028-02-27', '2028-02-28'), dated('b', '2028-03-01', '2028-03-02')), { words: '1 day between', overlap: false }, 'across a leap day');
  assert.deepEqual(pair(dated('a', '2026-12-30', '2026-12-31'), dated('b', '2027-01-03', '2027-01-04')), { words: '2 days between', overlap: false }, 'across a new year');
  // ties keep the order added; the summary runs to the latest end, not the last start's
  const tie = tripEventsView(['b', 'a', 'c'], TODAY, [dated('a', '2027-05-01', '2027-05-02'), dated('b', '2027-05-01', '2027-08-30'), dated('c', '2027-06-01', '2027-06-02')]);
  assert.deepEqual(tie.events.map((e) => e.row.id), ['b', 'a', 'c'], 'two that start the same day stand in the order added');
  assert.equal(tie.summary, `3 events · ${dateWords('2027-05-01', '2027-08-30')}`, 'from the first start to the latest end');
  // an undated event with a usual season and a dated pair: the dated first; no gap is drawn to or from the undated
  const mixed = tripEventsView(['whistler-ski-season-2026-27', BOARD[1], BOARD[0]], TODAY);
  assert.deepEqual(mixed.events.map((e) => [e.row.id, e.when, e.gap?.words ?? null]), [[BOARD[0], 'Jan 17–31, 2027', null], [BOARD[1], 'Feb 4–11, 2027', '3 days between'], ['whistler-ski-season-2026-27', 'Usually Nov – May', null]]);
  assert.equal(mixed.summary, '3 events · Jan 17 – Feb 11, 2027');
  // undated alone, in the order added — "dates not announced yet" after the dot
  const undated = tripEventsView(['us-open-tennis-2027', 'whistler-ski-season-2026-27'], TODAY);
  assert.deepEqual(undated.events.map((e) => [e.row.id, e.when]), [['us-open-tennis-2027', NOT_ANNOUNCED_YET], ['whistler-ski-season-2026-27', 'Usually Nov – May']]);
  assert.equal(undated.summary, `2 events · ${DATES_NOT_ANNOUNCED}`);
  assert.equal(tripEventsView(['us-open-tennis-2027'], TODAY).summary, '1 event · dates not announced yet');
  // a city that is not fixed prints the leaf's own mark, and the event draws no Stay near it →
  const unfixed = tripEventsView(['x-games-summer-2027'], TODAY).events[0];
  assert.equal(unfixed.place, `${VENUE_NOT_FIXED}, USA`);
  assert.equal(unfixed.stay, false);
  assert.equal(canStayNear(row('x-games-summer-2027')), false);
  // no event, no summary; an id stored twice is refused by name
  assert.deepEqual(tripEventsView([], TODAY), { events: [], summary: null });
  assert.throws(() => tripEventsView([BOARD[0], BOARD[0]], TODAY), (e: unknown) => e instanceof GuestTripWordsError && /holds australian-open-2027 twice/.test(e.message));
  // the words
  assert.deepEqual([eventCountWords(1), eventCountWords(3), daysBetweenWords(0), daysBetweenWords(1), daysBetweenWords(28), removeWords('Bahrain Grand Prix')], ['1 event', '3 events', 'Back to back', '1 day between', '28 days between', 'Remove Bahrain Grand Prix']);
  assert.throws(() => daysBetweenWords(-1), GuestTripWordsError, 'an overlap has its own words');
  assert.throws(() => tripGap(row('us-open-tennis-2027'), row(BOARD[0])), GuestTripWordsError, 'a gap is drawn between two dated events only');
  // focus on a ×: the next event's ×, else the one before, else the open tab (null)
  assert.equal(focusAfterRemove(['a', 'b', 'c'], 'a'), 'b');
  assert.equal(focusAfterRemove(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(focusAfterRemove(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(focusAfterRemove(['a'], 'a'), null);
  assert.throws(() => focusAfterRemove(['a'], 'z'), GuestTripWordsError);
  // THE DAY COUNT — dayNumber, from the string's own parts, held to Date.UTC over every day of four years, a century's leap rule and the epoch
  assert.equal(dayNumber('1970-01-01'), 0);
  for (let d = Date.UTC(2026, 0, 1); d <= Date.UTC(2029, 11, 31); d += 86400000) {
    const iso = new Date(d).toISOString().slice(0, 10);
    assert.equal(dayNumber(iso), d / 86400000, iso);
  }
  for (const [end, start] of [['2100-02-28', '2100-03-01'], ['2000-02-28', '2000-03-01'], ['1999-12-31', '2000-01-01']] as const) {
    assert.equal(dayNumber(start) - dayNumber(end) - 1, daysBetweenUtc(end, start), `${end} → ${start}`);
  }
  // every dated pair of the leaf on the reference's day, held to the check's own arithmetic
  const datedRows = EXPERIENCES.filter((r) => isUpcoming(r, TODAY));
  let pairs = 0;
  for (const a of datedRows) for (const b of datedRows) {
    if (a === b || (b.start as string) < (a.start as string)) continue;
    const days = daysBetweenUtc(a.end as string, b.start as string);
    assert.deepEqual(tripGap(a, b), days < 0 ? { words: OVERLAPS, overlap: true } : { words: daysBetweenWords(days), overlap: false }, `${a.id} → ${b.id}`);
    pairs += 1;
  }
  assert.ok(pairs > 1000, `every dated pair was read (${pairs})`);
  // the leaf is pure
  assert.doesNotMatch(code(TRIP_WORDS), /new Date\(|Date\.now\(|toLocale|\bIntl\.|localeCompare|sessionStorage|localStorage|from 'react'|\bfetch\s*\(/, 'no clock, no locale, no storage, no React');
});

// ── T7 · THE STORE ───────────────────────────────────────────────────────────

test('T7 the store — the events join the guest trip: one key, the order added, the catalog id alone; the bookings\' writer keeps them; each reader takes its kind; the update signal', async () => {
  const store = new Map<string, string>();
  const signals: string[] = [];
  const fake = {
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } },
    dispatchEvent: (e: Event) => { signals.push(e.type); return true; },
  };
  const g = globalThis as Record<string, unknown>;
  const before = g.window;
  g.window = fake;
  try {
    const trip = await import('../guestTrip');
    const stored = () => JSON.parse(store.get('ts-guest-trip') ?? '[]') as unknown[];
    trip.addGuestTripEvent(BOARD[0]);
    assert.deepEqual(stored(), [{ type: 'event', id: BOARD[0] }], 'the catalog id, and nothing else from the catalog');
    assert.deepEqual(signals, [trip.GUEST_TRIP_EVENT], 'the same update signal');
    trip.addGuestTripEvent(BOARD[0]);
    assert.equal(stored().length, 1, 'an event already in the trip is not added twice');
    assert.equal(signals.length, 1, 'and nothing is written');
    trip.addGuestTripEvent(BOARD[2]);
    const booking = { type: 'flight' as const, name: 'MNL → MEL', confirmationCode: 'K7Q2PX', amountUsd: 412, currency: 'USD', ts: 1 };
    trip.addGuestTripRecord(booking);
    assert.deepEqual(stored(), [{ type: 'event', id: BOARD[0] }, { type: 'event', id: BOARD[2] }, booking], 'one list, in the order added — the booking\'s writer keeps the events');
    assert.deepEqual(trip.readGuestTrip(), [booking], 'the bookings\' reader takes the bookings');
    assert.deepEqual(trip.readGuestTripWhole(), { bookings: [booking], events: [BOARD[0], BOARD[2]] }, 'the one read: both kinds, each in the order added');
    trip.removeGuestTripEvent(BOARD[0]);
    assert.deepEqual(stored(), [{ type: 'event', id: BOARD[2] }, booking], 'the event leaves; every other entry stays, in its order');
    const writes = signals.length;
    trip.removeGuestTripEvent(BOARD[0]);
    assert.equal(signals.length, writes, 'an event not in the trip: nothing written');
    // read strictly, as BOOK-3's rows are: a mis-shaped entry is no event
    store.set('ts-guest-trip', JSON.stringify([{ type: 'event' }, { type: 'event', id: '' }, { type: 'event', id: 'x', name: 'carried' }, { type: 'event', id: BOARD[1] }]));
    assert.deepEqual(trip.readGuestTripWhole(), { bookings: [], events: [BOARD[1]] });
  } finally {
    g.window = before;
  }
  // the source: one key; BOOK-3's header names the event writers, dated
  const source = code(STORE);
  assert.equal(count(source, "'ts-guest-trip'"), 1, 'one key');
  assert.doesNotMatch(source, /localStorage|document\.cookie|\bfetch\s*\(/, 'sessionStorage by BOOK-3\'s ruling — nothing sent, nothing kept past the tab');
  const header = flat(comments(STORE).replace(/^\s*\/\//gm, ' '));
  assert.ok(header.includes('HOME-TRAVEL-01') && header.includes('2026-11-12') && header.includes('addGuestTripEvent') && header.includes('removeGuestTripEvent'), 'BOOK-3\'s header gains the event writers, dated');
});

// ── T8 · THE BOX ─────────────────────────────────────────────────────────────

test('T8 the box — the same modes, Events first and open; Search flights → opens Flights and asks for the top as Stay near it → does; the trip card follows the box and renders after the read; Add to trip presses through the trip; the app\'s travel tab is untouched', async () => {
  const { default: LandingBookingSection } = await import('../../components/landing/LandingBookingSection');
  const { default: TravelBox } = await import('../../components/landing/TravelBox');
  const { default: GuestTripStrip } = await import('../../components/landing/GuestTripStrip');
  type El = React.ReactElement<Record<string, unknown>>;
  const elementsIn = (node: React.ReactNode): El[] => (Array.isArray(node) ? node.flatMap((n) => elementsIn(n as React.ReactNode))
    : React.isValidElement<Record<string, unknown>>(node) ? [node, ...elementsIn(node.props.children as React.ReactNode)] : []);
  const door = (): void => {};
  const catalog = React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, choice: { category: 'tennis' }, onPick: noop });
  // a host keeps every pass; a press made during a pass is drawn on the next
  const passes: React.ReactNode[] = [];
  const Host = () => {
    const tree = LandingBookingSection({ onRequireAuth: door, today: TODAY, events: catalog });
    passes.push(tree);
    if (passes.length === 1) {
      const card = elementsIn(tree).find((el) => el.type === GuestTripStrip);
      assert.ok(card, 'the trip card, in the box\'s tree');
      (card.props.onSearchFlights as () => void)();
    }
    return null;
  };
  renderToStaticMarkup(React.createElement(Host));
  assert.equal(passes.length, 2, 'one pass, and one more for the press');
  const boxOf = (tree: React.ReactNode) => { const found = elementsIn(tree).filter((el) => el.type === TravelBox); assert.equal(found.length, 1, 'the box, once'); return found[0]; };
  assert.equal(boxOf(passes[0]).props.activeKey, 'events', 'Events open at first');
  assert.equal(boxOf(passes[1]).props.activeKey, 'flights', 'Search flights → opens Flights');
  // the card: under the box, inside the press handler's reach, handed the day, the door, Stay near it → itself
  const tree = passes[0];
  const provider = elementsIn(tree).find((el) => el.type === StayNearContext.Provider);
  assert.ok(provider);
  const kids = React.Children.toArray(provider.props.children as React.ReactNode) as El[];
  assert.equal(kids.length, 2, 'the box (in the trip\'s context), then the card');
  assert.equal(kids[0].type, AddToTripContext.Provider);
  assert.equal(kids[1].type, GuestTripStrip, 'the card follows the box');
  assert.equal(kids[1].props.today, TODAY);
  assert.equal(kids[1].props.onRequireAuth, door);
  assert.equal(kids[1].props.onStayNear, provider.props.value, 'the card\'s Stay near it → is the panel row\'s own action');
  assert.equal(kids[1].props.trip, null, 'before the read: no trip');
  assert.equal(kids[0].props.value, null, 'and no row draws Add to trip');
  // rendered whole before the read: no card, no Add button — the rows' Stay near it → only
  const whole = renderToStaticMarkup(React.createElement(LandingBookingSection, { onRequireAuth: door, today: TODAY, events: catalog }));
  assert.ok(!whole.includes('ts-tm-trip') && !whole.includes('data-add='), 'the trip renders after mount — the server\'s HTML holds none');
  assert.ok(whole.includes('data-stay-near="australian-open-2027"'));
  // a row's Add to trip, with the trip read: its words say its state; a press hands the box its row; no aria-pressed
  const pressed: string[] = [];
  const drawn = (inTrip: boolean) => renderToStaticMarkup(React.createElement(AddToTripContext.Provider, { value: { inTrip: () => inTrip, onToggle: (r: Experience) => { pressed.push(r.id); } } },
    React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, choice: { category: 'golf' }, onPick: noop })));
  assert.equal(count(drawn(false), `>${ADD_TO_TRIP}</button>`), 5);
  assert.equal(count(drawn(true), `>${IN_YOUR_TRIP}</button>`), 5);
  assert.ok(!/aria-pressed/.test(drawn(true) + drawn(false)), 'its words say its state');
  const rowTree = ExperiencesView({ rows: EXPERIENCES, today: TODAY, choice: { category: 'golf' }, onPick: noop });
  const rowEl = elementsIn(rowTree).find((el) => typeof el.type === 'function' && (el.props.row as Experience | undefined)?.id === 'masters-2027');
  assert.ok(rowEl);
  let article: React.ReactNode;
  const RowHost = () => { article = (rowEl.type as (p: Record<string, unknown>) => React.ReactNode)(rowEl.props); return null; };
  renderToStaticMarkup(React.createElement(AddToTripContext.Provider, { value: { inTrip: () => false, onToggle: (r: Experience) => { pressed.push(r.id); } } }, React.createElement(RowHost)));
  const add = elementsIn(article).find((el) => el.props['data-add'] !== undefined);
  assert.ok(add && add.type === 'button' && add.props.type === 'button');
  (add.props.onClick as () => void)();
  assert.deepEqual(pressed, ['masters-2027'], 'the press hands the box its row');
  // the source: what a press does, Search flights → as Stay near it →, the throw by name, the one read
  const wrapper = code(WRAPPER);
  assert.match(wrapper, /const searchFlights = useCallback\(\(\) => \{\n\s*setOpen\(FLIGHTS_KEY\);\n\s*setTops\(\(n\) => n \+ 1\);\n\s*\}, \[\]\);/, 'Flights open, one top asked for — the same top Stay near it → asks for');
  assert.match(wrapper, /^const FLIGHTS_KEY = 'flights';$/m);
  assert.match(wrapper, /if \(!ordered\.some\(\(m\) => m\.key === FLIGHTS_KEY\)\) throw new Error\(`LandingBookingSection: travelStripModes returned no '\$\{FLIGHTS_KEY\}' mode/, 'no Flights → a throw that names it');
  assert.match(wrapper, /onToggle: \(row: Experience\) => \{\n\s*if \(trip\.events\.includes\(row\.id\)\) removeGuestTripEvent\(row\.id\);\n\s*else addGuestTripEvent\(row\.id\);\n\s*\},/, 'in the trip → out; out → in');
  assert.equal(count(wrapper, 'const trip = useGuestTrip();'), 1, 'the one read, for the card and every Add button');
  assert.doesNotMatch(wrapper, /sessionStorage|localStorage|\bfetch\s*\(|new Date\(|Date\.now\(/, 'the box stores nothing itself and sets no date');
  const card = code(CARD);
  assert.match(card, /useEffect\(\(\) => \{\n\s*const sync = \(\) => setTrip\(readGuestTripWhole\(\)\);\n\s*sync\(\);[^\n]*\n\s*window\.addEventListener\(GUEST_TRIP_EVENT, sync\);\n\s*return \(\) => window\.removeEventListener\(GUEST_TRIP_EVENT, sync\);\n\s*\}, \[\]\);/, 'read in an effect, after mount, and on every signal');
  // the app's travel tab is untouched: the shared strip and ds.ts byte for byte as on main ca3fdc7, and the app still mounts the strip
  assert.equal(digest('src/components/ui/ToggleStrip.tsx'), 'f41af2b60ebef66ed59f907c4a8c5af1fb3af5c28b78fa3a31282c05ee13dc1f', 'ToggleStrip.tsx, byte for byte');
  assert.equal(digest('src/lib/ds.ts'), '17e731aef3a790c98052a4954beee8ce69efaec495b62a3f8e5ad42cbe49a9f5', 'ds.ts (DS.iconTab, the band), byte for byte');
  assert.match(code('src/components/home/ModuleLauncher.tsx'), /<ToggleStrip\b/, 'the app\'s travel tab still draws the strip');
  assert.doesNotMatch(wrapper, /import ToggleStrip\b|<ToggleStrip\b/, 'the landing mounts it no more — it reads the strip\'s mode type alone');
  assert.match(wrapper, /^import type \{ ToggleMode \} from '@\/components\/ui\/ToggleStrip';$/m);
});

// ── T9 · THE WORDS ───────────────────────────────────────────────────────────

test('T9 every word the new parts draw is a leaf\'s — the trip\'s in src/lib/guestTripWords.ts (the four GuestTripStrip.tsx typed among them), the row\'s beside STAY_NEAR_WORDS; the components type none', () => {
  assert.deepEqual([TRIP_EYEBROW, TRIP_PITCH, CREATE_FREE_ACCOUNT, TOTAL], ['Your trip so far', 'This trip lives in your browser — create a free account to save it, budget it, and map it to your runway.', 'Create free account', 'Total'], 'the four, word for word as BOOK-3 typed them');
  assert.deepEqual([SEARCH_FLIGHTS, DATES_NOT_ANNOUNCED, BACK_TO_BACK, OVERLAPS, NOT_STATED], ['Search flights →', 'dates not announced yet', 'Back to back', 'Overlaps the one above', '—']);
  assert.deepEqual([ADD_TO_TRIP, IN_YOUR_TRIP, STAY_NEAR_WORDS], ['Add to trip', 'In your trip', 'Stay near it →']);
  const words = code(WORDS);
  assert.ok(words.indexOf("export const ADD_TO_TRIP = 'Add to trip';") > words.indexOf("export const STAY_NEAR_WORDS = 'Stay near it →';"), 'beside STAY_NEAR_WORDS');
  // the components: no text between their tags, and none of the leaves' words typed
  // the markup each draws — from its returned JSX to the file's end (the type parameters above it hold angle brackets that are not tags)
  const drawnIn = (file: string, opening: string): string => { const src = code(file); const at = src.indexOf(opening); assert.ok(at > -1, `${file}: ${opening}`); return src.slice(at); };
  const typedIn = (markup: string): string[] => [...markup.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-z]/.test(t));
  assert.deepEqual(typedIn(drawnIn(BOX, 'return (\n    <div ref={boxRef}')), [], `${BOX}: no text typed between its tags`);
  const card = code(CARD);
  const marks = card.slice(card.indexOf('function GapMark()'), card.indexOf('export default function GuestTripStrip('));
  assert.ok(marks.includes('<svg') && marks.length < 1000, 'the two marks');
  assert.deepEqual(typedIn(marks + drawnIn(CARD, 'return (\n    <section className="ts-tm-trip"')), [], `${CARD}: no text typed between its tags`);
  const leafWords = [TRIP_EYEBROW, TRIP_PITCH, CREATE_FREE_ACCOUNT, SEARCH_FLIGHTS, DATES_NOT_ANNOUNCED, BACK_TO_BACK, OVERLAPS, ADD_TO_TRIP, IN_YOUR_TRIP, NOT_ANNOUNCED_YET, 'days between', 'day between', 'Remove ', 'Soon', 'Total'];
  // Landing.tsx: the travel section alone — the hero above it types its own "Create free account" (HERO-CREST-01), which is not this section's
  const landing = code(LANDING);
  const travel = landing.slice(landing.indexOf('<section aria-label="Live demo — travel"'), landing.indexOf('</section>', landing.indexOf('<section aria-label="Live demo — travel"')));
  for (const [file, text] of [[BOX, code(BOX)], [CARD, code(CARD)], [SECTION, code(SECTION)], [WRAPPER, code(WRAPPER)], [LANDING, travel]] as const) {
    const source = flat(text);
    for (const w of leafWords) assert.ok(!source.includes(`'${w}`) && !source.includes(`"${w}`) && !source.includes(`>${w}`), `${file} does not type "${w}"`);
  }
  // the tiles' words are the builder's own: its labels, its headlines, and its SOON_BADGE's "Soon" drawn in this look
  assert.match(code(BOX), /cloneElement\(m\.badge, \{ className: 'ts-tm-tab__soon' \}\)/, 'the badge is the mode\'s own node, in this look');
  assert.match(code(BOX), /cloneElement\(m\.icon, \{ className: 'ts-tm-tab__icon', width: 22, height: 22 \}\)/, 'the icon is the mode\'s own node, at 22px');
});

// ── T10 · THE RULINGS ────────────────────────────────────────────────────────

test('T10 each ruling is quoted, dated, where it is built — Alex\'s words exact; the Look up reversal named', () => {
  const said = (file: string): string => flat(comments(file).replace(/^\s*(\*|\/\/)/gm, ' '));
  const FILES = [GLOBALS, LANDING, WRAPPER, BOX, SECTION, CARD, LOOKUP, STORE, TRIP_WORDS, WORDS];
  for (const file of FILES) {
    const notes = said(file);
    assert.ok(notes.includes('HOME-TRAVEL-01'), `${file} names the brief`);
    assert.ok(notes.includes('2026-11-12'), `${file} dates it`);
  }
  for (const file of [GLOBALS, LANDING, BOX, SECTION, CARD, LOOKUP]) assert.ok(said(file).includes('design-refs/home-travel-01/Section-Reference.html'), `${file} names the spec where it is built`);
  // Alex's words, wherever a file of this change quotes them: an excerpt of his 16:08 brief, cut only at its own "..." or an elision; his 20:26
  // approval whole; his 2026-11-09 line on Search flights whole
  const WORDS_1608 = 'this one is basically set, not much to change, just need to match astehetics of the site to make it follow along... also with the events, it would be cool if someone selects events, they add to a queue table below the search bar, so the person who adds them can see them for review to like aid in booking flights and stuff.... the see what they wanna do when it is, so they know dates they need to filter for flights and stuff, to build around the events.';
  const WORDS_2026 = 'ok I approve the travel market place';
  const WORDS_1109 = 'would be cool if that populated destination but like user gonna wanna pick their own travel dates';
  let quoted1608 = 0;
  let quoted2026 = 0;
  for (const file of [...FILES, 'src/lib/__tests__/homeTravel01.test.ts']) {
    const notes = said(file);
    for (const m of notes.matchAll(/16:08 Manila: "([^"]+)"/g)) { assert.ok(WORDS_1608.includes(m[1]), `${file}: "${m[1].slice(0, 40)}…" is Alex's 16:08 words, exact`); quoted1608 += 1; }
    for (const m of notes.matchAll(/20:26: "([^"]+)"/g)) { assert.equal(m[1], WORDS_2026, `${file}: his 20:26 words, exact`); quoted2026 += 1; }
  }
  assert.ok(quoted1608 >= 6 && quoted2026 >= 8, `his words are quoted where they are built (${quoted1608} · ${quoted2026})`);
  assert.ok(said(WRAPPER).includes(`"${WORDS_1109}"`) && said(CARD).includes(`"${WORDS_1109}"`), 'Search flights fills nothing — his 2026-11-09 line, where it is built');
  // the Look up reversal, named where it is built and in the test that held it
  const lookup = said(LOOKUP);
  assert.ok(lookup.includes('LOOK UP LEAVES PRIMARY_CTA') && lookup.includes('"like lookup, purple"') && lookup.includes('HOME-FINISH-01'), 'the lookup names the ruling it reverses');
  assert.ok(said('src/lib/__tests__/buttons01.test.ts').includes('LOOK UP LEAVES PRIMARY_CTA'), 'and buttons01 says why its pin moved');
  // ONE GRADIENT, named at the stylesheet
  assert.ok(said(GLOBALS).includes('ONE GRADIENT, the gold button'), 'the gradient, named');
});
