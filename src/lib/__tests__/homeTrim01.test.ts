/**
 * HOME-TRIM-01 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page; the boards approved on the
 * design canvas at 20:01 and, corrected, at 20:41; built 2026-11-15) — ABOUT US BECOMES ONE BAND ON THE HOME PAGE; THE LETTER STAYS
 * WHOLE ON /about.
 *
 * The second PR of the shorter home page. HOME-PAGES-01 gave the letter a page of its own; this one takes the letter off the home page
 * and puts one band in its seat: the heading, the first quote of the letter, one door to /about. The spec is a file:
 * design-refs/home-trim-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is the page."), with its
 * README beside it. The band is src/components/landing/AboutBand.tsx, which Landing.tsx mounts; its stylesheet was the reference's own,
 * ported to src/app/globals.css under the house prefix ("is" until HOME-ABOUT-02, below). What is held here, as homeAbout01 holds the letter:
 *
 * HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15): the band draws the letter's three parts now — each its number, its
 * title and its quote — and its spec is design-refs/home-about-02, held by src/lib/__tests__/homeAbout02.test.ts: the handoff, the ten tokens,
 * the port against that reference, the render against its section, every word. design-refs/home-trim-01 stays in the tree, byte for byte (T1),
 * the record of the first band. What HOME-TRIM-01 ruled that still stands is held here; T1, T6, T7 and T8 stand as they were, and T2 to T5 are
 * re-pointed, each with what it held until then (the lines in quotes below are their entries until then). The brief's ruling f:
 * "HOME-TRIM-01'S QUOTES STAY WHERE THEY STAND. homeTrim01 T8 stands unedited: its stamp, its rulings and its counts in AboutBand.tsx,
 * homeActWords.ts, globals.css, Landing.tsx and homeTrim01 itself. Re-say around them, never through them, and quote that brief nowhere it
 * is not quoted today."
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two;
 *   T2 no new token — the first band's seven, named and valued as its README's two tables, are the app's tokens by the same names behind
 *      the house prefix, each declared once; no token is named for the band, and its port declares none ("the tokens — the README's two
 *      tables, … the port reads all seven and nothing else but the font variable; no token is new;" until HOME-ABOUT-02);
 *   T3 the class and the seat — every class the port names is the band's own behind the prefix, the one word; its seat is above every
 *      other port, directly under the base rules and over the marquee's keyframes; nothing outside it names one of its classes ("the
 *      stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the four differences named
 *      there; no hex, no rgb value typed, no gradient; …" until HOME-ABOUT-02);
 *   T4 the heading, the label, the tab stop — the band's h2 wears the act headings' type; the region's label, no id; one thing that
 *      takes the keyboard's focus ("the markup — the band's render is the reference's section, token for token … every other class it
 *      wears is ruled by the port, and the port rules no class the band does not wear; …" until HOME-ABOUT-02);
 *   T5 nothing typed, the letter's own helper, the door's words — the band types none of the words it draws and writes no split of its
 *      own, its quotes split by the letter's quoteParts; the door's words are one constant beside the heading's, and stand in no other
 *      file's code under src but the tests ("the words — the three the band draws are two leaves' own, in order: the heading, the
 *      letter's FIRST quote as the letter's own helper splits it, the door's words; the reference draws the same; …" until HOME-ABOUT-02);
 *   T6 the mount — the band once on the home page, in the letter's seat: its import where the letter's stood, on the
 *      ExperiencesSection import's line, its mount between the travel section's close and Our Story, on the two lines the brief
 *      names; the letter nowhere on that page; the letter still on /about, once, and the band not there;
 *   T7 the door — one next/link Link to the pages' leaf's path, read and not retyped; no button, no state, no handler, no script;
 *   T8 the rulings — each quoted, exact, where it is built; and in every source file of the change a quote that follows a sentence of
 *      his — his request at 19:11, the rulings, the two beta notes, the two approvals — for twenty characters is his words from there,
 *      whole or to a full stop; a quote under one of the brief's three stamps is the words that stamp dates, exact.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript) and the README. No clock, no live call. What a browser must show — the band
 * beside the reference at 1440, 1024, 768 and 390, the page's height before and after, everything outside the seat equal to main, no
 * sideways scroll — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { ABOUT_US_DOOR } from '../homeActWords';
import { ABOUT_PATH } from '../homePages';
import { STOP_ZERO_STORY } from '../stopZeroWords';
import AboutBand from '@/components/landing/AboutBand';
import { StopZeroShapeError, quoteParts } from '@/components/landing/StopZeroSection';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-trim-01';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const GLOBALS = 'src/app/globals.css';
const BAND = 'src/components/landing/AboutBand.tsx';
const LETTER = 'src/components/landing/StopZeroSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const ABOUT_PAGE = 'src/app/about/page.tsx';
const HEADINGS = 'src/lib/homeActWords.ts';
const WORDS = 'src/lib/stopZeroWords.ts';
const THIS = 'src/lib/__tests__/homeTrim01.test.ts';

/** The act headings' type — What We Do's h2 (Landing.tsx), the letter's (StopZeroSection.tsx), and the band's. */
const ACT_HEADING_TYPE = 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** A file's comments as prose: each line's comment leader gone, whitespace collapsed — a sentence that wraps is one sentence. */
const prose = (file: string): string => flat(comments(file).split('\n').map((line) => line.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)?\s?/, '')).join(' '));
/** React's escaping of text, undone — so a word reads the same in the reference's markup and in the render. */
const unescaped = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Every .ts / .tsx file under src that is not a test. */
const srcFiles = (dir = 'src'): string[] => readdirSync(resolve(ROOT, dir)).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(resolve(ROOT, rel)).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.tsx?$/.test(name) ? [rel] : [];
});

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>",
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homePlans04.test.ts's reading, as homeAbout01.test.ts has it — and
 * stricter: text after the last block, or a block that declares nothing, is refused, so a stray selector or brace cannot hide in a gap.)
 */
function declarations(css: string): string[] {
  const out: string[] = [];
  const walk = (text: string, media: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) { assert.match(text.slice(i), /^\s*$/, `nothing stands after the last block: "${flat(text.slice(i)).slice(0, 60)}"`); break; }
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
      else {
        const decls = body.split(';').map(flat).filter(Boolean);
        assert.ok(decls.length > 0, `the block "${prelude}" declares something`);
        for (const d of decls) out.push(`${media} | ${prelude} | ${d}`);
      }
      i = j;
    }
  };
  walk(css, '');
  return out;
}
/** CSS comments blanked, newlines kept. */
const uncommented = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
/** The reference whole: HTML, which the reader splits as TypeScript, so both halves together are the file. */
const referenceText = (): string => whole(REFERENCE);
/** The reference's stylesheet, as written: what stands between <style> and </style>. */
function referenceStyle(): string {
  const html = referenceText();
  assert.equal(count(html, '<style>'), 1, 'one stylesheet in the reference');
  return html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));
}
/** A stylesheet's :root block as name → value. */
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
// HOME-ABOUT-02 (2026-11-15): THE FOUR DIFFERENCES — the reading that applied them to design-refs/home-trim-01's declarations (NOT_PORTED and
// referencePorted(), which T3 held the port to) left this file: the port is design-refs/home-about-02's stylesheet now, and homeAbout02.test.ts
// applies the four differences its header names to that reference's declarations.
/** The port: globals.css from the band's first rule to the next block's — the marquee's keyframes. */
const PORT_OPEN = '.ts-aboutband {';
const NEXT_BLOCK = '@keyframes ts-marquee {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_BLOCK);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-aboutband and runs to the marquee\'s keyframes');
  return css.slice(at, end);
}

/** The README's "Tokens" section: the rows of the table under one bold lead, each [name, value, what it is for]. */
function readmeTable(lead: string): Array<[name: string, value: string, use: string]> {
  const doc = whole(README);
  const section = doc.slice(doc.indexOf('\n## Tokens'), doc.indexOf('\n## ', doc.indexOf('\n## Tokens') + 1));
  const from = section.indexOf(lead);
  assert.ok(from > -1, `the README's Tokens section has "${lead}"`);
  const rows: string[] = [];
  let started = false;
  for (const line of section.slice(from).split('\n').slice(1)) {
    if (line.startsWith('|')) { started = true; rows.push(line); continue; }
    if (started) break;
  }
  return rows.filter((l) => l.startsWith('| `')).map((row) => {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value && cells.length === 3, `${README}: "${row}" names one token, one value and its use`);
    return [name[1], value[1], cells[2]] as [string, string, string];
  });
}

/** THE FIVE ALREADY IN THE APP — the README's first table. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['gold', '184 134 11'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'],
];
/** THE TWO HOME-PLANS-04 BROUGHT — the README's second table: reused by name and value, added by none. */
const SHARED: ReadonlyArray<readonly [name: string, value: string]> = [['fs-white', '255 255 255'], ['fs-button-line', '#CFC6EC']];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text with React's escaping undone; comments and the
 * whitespace that only lays the file out (a run holding a newline) dropped, a lone space between two tags kept. With `prefix`, every
 * class gets the house prefix — the reference's .aboutband__go is the app's .ts-aboutband__go. (homeAbout01.test.ts's reading.)
 */
function tokensOf(html: string, prefix: boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<!--')) continue;
    if (!t.startsWith('<')) {
      if (/^\s*$/.test(t)) { if (!t.includes('\n')) out.push('#text " "'); continue; }
      out.push(`#text ${JSON.stringify(unescaped(t).replace(/\s+/g, ' '))}`);
      continue;
    }
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?)>$/.exec(t);
    assert.ok(tag, `a tag: ${t}`);
    if (tag[1]) { out.push(`</${tag[2]}>`); continue; }
    const attrs: Array<[string, string]> = [];
    for (const a of tag[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
      const value = a[2] === undefined ? 'true' : a[2];
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
const textsOf = (html: string, prefix = false): string[] => tokensOf(html, prefix).filter((t) => t.startsWith('#text ')).map((t) => JSON.parse(t.slice('#text '.length)) as string);
// HOME-ABOUT-02 (2026-11-15): the reference's section (referenceSection()), the letter's FIRST_QUOTE and the band's three DRAWN words, which T4
// and T5 held the band to, left this file with those holds — homeAbout02.test.ts reads design-refs/home-about-02's section and every word now.
const render = (): string => renderToStaticMarkup(React.createElement(AboutBand));
/** code() blanks a JSX comment's words and keeps its braces. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

const RULING = {
  a: 'THE LETTER IS NOT REDRAWN. StopZeroSection.tsx\'s code, its port (.ts-about…) and design-refs/home-about-01 do not change. /about shows the letter exactly as main does. src/lib/stopZeroWords.ts stays byte for byte: nothing in it goes false. Its header names the section that draws all of its words; the band reads one quote and says so in its own file.',
  b: 'NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-PAGES-01 re-said its own: every sentence in the tree that says the letter stands on the home page, or that Landing.tsx mounts it. Known at 480d4ef: StopZeroSection.tsx:4-5 and :32, src/app/about/page.tsx:12, src/middleware.ts:106 ("the home page keeps its own mount of each"), and Landing.tsx\'s own notes. In middleware.ts that one clause of the note changes and nothing else: no entry, no order, no code. No line moves in any of these files.',
  c: 'THE WORDS. Nothing is typed in the band. The heading is ABOUT_US_HEADING. The quote is STOP_ZERO_STORY[0].quote, split by the letter\'s own quoteParts, imported from ./StopZeroSection: no second split is written, and a quote without that shape is refused by name, as it is there. "Read my story →" is new: one constant, ABOUT_US_DOOR, in src/lib/homeActWords.ts beside ABOUT_US_HEADING, the arrow in the string, with a dated note. It does not go in stopZeroWords.ts (stopZero01:189 holds that "Read my story" is typed nowhere in that leaf).',
  d: 'THE DOOR is a next/link Link to ABOUT_PATH (src/lib/homePages.ts), read by the band and not retyped. No button element, no state, no modal, no script.',
  e: 'THE SEAT. In Landing.tsx the band\'s import takes the letter\'s on :204 and its mount takes the letter\'s on :753. The notes around them are re-said. No line moves. The section keeps aria-label="About us" and carries no id: STOP_ZERO_ANCHOR stays the letter\'s section\'s alone (src/lib/homeAnchors.ts:28), the band does not read it, and /#stop-0 does nothing on the home page, as the old-links effect\'s note already says (Landing.tsx:453). No redirect is added.',
  f: 'THE HEADING wears the act headings\' classes, the string What We Do\'s h2 and the letter\'s h2 wear. The reference\'s rule for it is not ported.',
  g: 'THE CLASS is one word, aboutband, so homeAbout01:304 ("no rule outside the port names one of its classes") stands unedited. The port takes a seat in globals.css that moves no other port\'s pin. The audit names the seat.',
  h: 'NO NEW TOKEN. The seven the reference reads are in :root already (the README\'s two tables).',
  i: 'OUR STORY IS NOT TOUCHED: WasHereSection, its styles, its mount, its props.',
  j: 'NOTHING ELSE ON THE HOME PAGE CHANGES: not the hero, the three pillars, the travel section or the footer.',
} as const;
/** Two of his four beta users' notes, as he pasted them; his approval of the boards (20:01 Manila) and of the corrected boards (20:41). */
const BETA_NOTES = ['Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages', 'Like for Mobile, put your story behind a page and make it a vertical scroll.'] as const;
const APPROVAL = 'ALL LOOKS GOOD … OTHERWISE, LETS DO IT';
/** His request, under the brief's first stamp (2026-11-14 19:11 Manila), as the brief gives it. */
const REQUEST = 'I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback.';
const APPROVAL_OF_THE_CORRECTED = 'thats it! yeet yeet!'; // two spaces after "it!" as he typed it; held with whitespace collapsed, as prose() reads a file

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-trim-01-handoff.zip, 2026-11-15): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 9055, '9aa9aea4ca949c189c3fe51024e7fa010c066c642ad1b604e4f46f48b0767dda'],
  [REFERENCE, 5874, '41c26b8d3ff3d34656e84e6f45585d7dc58d929eff36f08662694415d70dca02'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the folder holds the two', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
});

// ── T2 · NO NEW TOKEN ────────────────────────────────────────────────────────

// HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15), its ruling d: "THE BAND'S PORT IS REPLACED AT ITS SEAT." The port reads ten
// tokens now — these seven and three more — and two font variables; homeAbout02 T2 holds the ten, named and valued as its README's table, and that the
// port reads them and nothing else. What HOME-TRIM-01 ruled of the tokens stands here: none is new. Until then this test was named "T2 the tokens,
// named and valued as the README's two tables — five already in the app and two HOME-PLANS-04 brought, the same values behind the house prefix, each
// declared once; the port reads all seven and nothing else but the font; none is new", and it held, too, that the port read the seven and the font
// variable and no other (deepEqual of the variables it reads with the seven and '--font-sans'), and that src/app/layout.tsx declares --font-sans.
test('T2 no token is new — the first band\'s seven, named and valued as its README\'s two tables, are still the app\'s by the same names behind the house prefix, each declared once; no token is named for the band, and its port declares none (the ten its port reads now: homeAbout02 T2)', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), KEPT, 'the README\'s first table');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**').map(([n, v]) => [n, v]), SHARED, 'its second');
  assert.ok(whole(README).includes('**New with this section: none.** No gradient.'), 'and its word on new tokens: none');
  // the reference declares those seven, and no other
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], [...KEPT, ...SHARED].map(([n, v]) => [`--${n}`, v]), 'the reference\'s :root: the seven, in the README\'s order');
  // each is the app's token by the same name behind the house prefix, with the same value — declared once
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of [...KEPT, ...SHARED]) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal([...globals.matchAll(new RegExp(`--ts-${name}\\s*:`, 'g'))].length, 1, `--ts-${name} declared once in globals.css, wherever it stands (homePlans04.test.ts's count)`);
  }
  // ruling h — "NO NEW TOKEN." — no custom property is declared for this section: in :root, or in the port
  assert.deepEqual([...root.keys()].filter((k) => /aboutband|about-band/i.test(k)), [], 'no token is named for this section');
  assert.doesNotMatch(portCss(), /(?:^|[\s;{])--[\w-]+\s*:/, 'the port declares no custom property');
});

// ── T3 · THE CLASS AND THE SEAT ──────────────────────────────────────────────

// HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15), its ruling d: the band's rules are design-refs/home-about-02's stylesheet now,
// at this seat; homeAbout02 T3 holds them equal to that reference, declaration by declaration, but for the four differences the port's header names,
// and holds that no colour is typed. What HOME-TRIM-01 ruled of the port stands here: the one-word class and the seat. Until then this test was named
// "T3 the band's stylesheet in globals.css is the reference's, declaration by declaration and in order, but for the four named differences; no hex, no
// rgb value typed, no gradient; every class behind the prefix and the band's own; its seat is above every other port, directly under the base rules
// and over the marquee's keyframes; nothing outside it names one of its classes", and it held the port to design-refs/home-trim-01's stylesheet —
// forty-six declarations in ten rules, every variable declared — and the port's header to that reference's four differences.
test('T3 the band\'s port keeps the one-word class and its seat — every class it names is the band\'s own, behind the prefix; above every other port, directly under the base rules and over the marquee\'s keyframes; nothing outside it names one of its classes (the port against its reference: homeAbout02 T3)', () => {
  const port = declarations(portCss());
  assert.ok(port.length > 0, `the port was read (${port.length} declarations)`);
  // every class it names carries the house prefix and is the band's own — the one word, aboutband (ruling g)
  const selectors = [...new Set(port.map((d) => d.split(' | ')[1]))];
  for (const sel of selectors) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-aboutband(?:$|__)/, `${sel}: .${m[1]} is the band's, behind the prefix`);
  // THE SEAT (ruling g: "The port takes a seat in globals.css that moves no other port's pin."): above every other port. Each port's test reads
  // its port from its own first rule to the next block's first rule (the hero's, the last, to the end of the file), so a block set under any of
  // them would be read as part of it — and the
  // chip strip's two neighbours are held to it with nothing between. Here: directly under the base rules (body), nothing between but comments;
  // then the marquee's keyframes; then every port, in the order they stood.
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  assert.equal(count(css, PORT_OPEN), 1, 'one port');
  const body = css.lastIndexOf('\nbody {', at);
  assert.ok(body > -1 && body > css.indexOf(':root {'), 'the base rule, body, stands above the port, under :root');
  assert.match(css.slice(css.indexOf('}', body) + 1, at), /^\s*$/, 'directly under the base rules: comments between and nothing else');
  const LAST = '@media (prefers-reduced-motion: reduce) {\n  .ts-aboutband__go { transition: none; }\n}';
  assert.ok(count(css, LAST) === 1 && css.indexOf(LAST) > at, 'the port\'s last rule, once, in the port');
  assert.match(css.slice(css.indexOf(LAST) + LAST.length, css.indexOf(NEXT_BLOCK)), /^\s*$/, 'and the marquee\'s keyframes follow the port\'s last rule: comments between and nothing else — not even an empty rule');
  const order = [PORT_OPEN, NEXT_BLOCK, '.ts-story {', '.ts-chipfade {', '.ts-about {', '.ts-tm {', '.ts-ps {', '.ts-fs-heading {', '.ts-ft {', '.ts-hero {'].map((open) => css.indexOf(open));
  assert.ok(order.every((n) => n > -1), 'every block was found');
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'the band\'s port → the marquee → the trip cards → the chip strip → the letter → Travel Marketplace → Professional Services → Financial Software → the footer → the hero');
  // nothing outside it names its classes, or reaches them through a class attribute selector
  const outside = css.slice(0, at) + css.slice(css.indexOf(NEXT_BLOCK));
  assert.doesNotMatch(outside, /\.ts-aboutband\b|\.ts-aboutband[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*aboutband/, 'and none reaches them through a class attribute selector');
  // the letter's port stands where it stood and names its own classes alone: homeAbout01.test.ts holds it equal to its reference (ruling a)
  assert.equal(count(css, '.ts-about {'), 1, 'the letter\'s port still opens once: ".ts-about {" is no part of ".ts-aboutband {"');
});

// ── T4 · THE HEADING, THE LABEL, THE TAB STOP ────────────────────────────────

// HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15), its ruling a: the band is design-refs/home-about-02's section now — the
// heading, the letter's three parts, the door; homeAbout02 T4 holds the render to that section, token for token, and the classes it wears to the classes
// its port rules. What HOME-TRIM-01 ruled of the markup stands here: the heading's classes, the label and no id, one tab stop. Until then this test was
// named "T4 the band's render is the reference's section, token for token, but for the heading's class — the act headings' type; every other class it
// wears is ruled by the port, and the port rules no class it does not wear; the region's label and no id; one thing takes the keyboard's focus", and it
// held the render to design-refs/home-trim-01's section — twenty-one tokens: eight elements, their closes, and five runs of text — and to the six classes
// the band wore (ts-aboutband, ts-aboutband__go, ts-aboutband__inner, ts-aboutband__mark, ts-aboutband__quote, ts-aboutband__words).
test('T4 the band\'s heading wears the act headings\' type, the string What We Do\'s h2 and the letter\'s h2 wear; the region\'s label and no id; one thing takes the keyboard\'s focus (the render against its reference: homeAbout02 T4)', () => {
  const html = render();
  // the heading wears the act headings' type — the string What We Do's h2 wears in Landing.tsx and the letter's h2 wears, whole (ruling f)
  assert.equal(count(code(LANDING), `<h2 className="${ACT_HEADING_TYPE}" data-act-heading>`), 1, 'What We Do\'s h2 wears the act headings\' type');
  assert.equal(count(code(LETTER), `h2: '${ACT_HEADING_TYPE}',`), 1, 'the letter\'s h2 wears it');
  assert.equal(count(code(BAND), `h2: '${ACT_HEADING_TYPE}',`), 1, 'and the band\'s: the same string');
  assert.equal(count(html, `<h2 class="${ACT_HEADING_TYPE}">`), 1, 'drawn so');
  assert.doesNotMatch(html, /ts-aboutband__title/, 'the reference\'s heading class is worn by nothing');
  // the hooks (ruling e): the region's label, typed on the tag as the letter types its own; no id
  assert.equal(count(html, '<section class="ts-aboutband" aria-label="About us">'), 1, 'the section, with its label');
  assert.equal(count(code(LETTER), 'aria-label="About us"'), 1, 'the letter types the same label on its own tag');
  assert.doesNotMatch(html, /\sid="/, 'no element of the band carries an id');
  // one tab stop: the one link, and nothing else that takes the keyboard's focus
  assert.equal(count(html, '<a '), 1, 'one link');
  assert.doesNotMatch(html, /<(?:button|input|select|textarea|summary|iframe|details|audio|video)\b|\stabindex=|\scontenteditable/, 'nothing else can be focused');
});

// ── T5 · NOTHING TYPED, THE LETTER'S OWN HELPER, THE DOOR'S WORDS ────────────

// HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15), its ruling b: the band draws the letter's three parts — each its number, its
// heading and its quote — from the leaves, each number the letter's partNumber; homeAbout02 T5 holds every word, in order, against the leaves and the
// reference, quote 2 exactly as its ruling c gives it, and the band's imports. What HOME-TRIM-01 ruled of the words stands here: nothing is typed in the
// band, its quotes are split by the letter's own helper and by nothing else, and the door's words are one constant beside the heading's. Until then this
// test was named "T5 the words the band draws are two leaves' own, in order — the heading, the letter's first quote as the letter's own helper splits it,
// the door's words; the reference draws the same; the band types none and writes no split of its own; the door's words are one constant beside the
// heading's, and stand in no other file's code under src but the tests", and it held the band's three words and the reference's, the letter's FIRST quote
// alone (const quote = quoteParts(STOP_ZERO_STORY[0].quote), "one thing" of the leaf), the band's five imports with { quoteParts } alone from the letter's
// file, seven class strings among its literals and ['About us'] for its double-quoted ones.
test('T5 nothing is typed in the band, and the letter\'s own helper splits its quotes — no split of its own, no catch, no default; the door\'s words are one constant beside the heading\'s, and stand in no other file\'s code under src but the tests (every word, in order: homeAbout02 T5)', () => {
  const html = render();
  const band = code(BAND);
  // every quote is split by the letter's own helper, imported from the letter's file, and drawn mark, words, mark — as the letter draws one
  assert.match(band, /^import \{[^}\n]*\bquoteParts\b[^}\n]*\} from '\.\/StopZeroSection';$/m, 'quoteParts, imported from the letter\'s own file');
  assert.equal(count(band, 'const quote = quoteParts(part.quote);'), 1, 'each quote, split by it');
  assert.equal(count(band, '<blockquote className={BAND.quote}><span className={BAND.mark}>{quote.open}</span>{quote.words}<span className={BAND.mark}>{quote.close}</span></blockquote>'), 1, 'drawn mark, words, mark');
  assert.equal(count(code(LETTER), '<blockquote className={STOP.quote}><span className={STOP.mark}>{quote.open}</span>{quote.words}<span className={STOP.mark}>{quote.close}</span></blockquote>'), 1, 'as the letter draws a quote');
  for (const part of STOP_ZERO_STORY) assert.deepEqual(quoteParts(part.quote), { open: '“', words: part.quote.slice(1, -1), close: '”' }, `"${part.heading}": split into its two marks and its words, losing nothing`);
  // no second split is written, and a refusal is never swallowed
  assert.doesNotMatch(band, /\.(?:slice|split|replace|substring|substr|match|trim)\(|[“”]/, 'no split of its own, and neither mark typed');
  assert.doesNotMatch(band, /\bcatch\b|\?\?|\|\|/, 'no catch and no default: a quote without its shape is refused by name');
  assert.throws(() => quoteParts(STOP_ZERO_STORY[0].quote.slice(1)), (e: unknown) => e instanceof StopZeroShapeError && e.name === 'StopZeroShapeError', 'as the letter\'s helper refuses one');
  // nothing is typed in the band (ruling c): its string literals are its directive, its imports' paths and its classes; its double-quoted literals
  // are the region's label, which no leaf holds and which is not drawn, and aria-hidden's "true" on each number, typed as the letter types its own;
  // no template literal; no text between its tags
  assert.deepEqual([...band.matchAll(/'([^']*)'/g)].map((m) => m[1]), [
    'use client', 'next/link', '@/lib/homeActWords', '@/lib/homePages', '@/lib/stopZeroWords', './StopZeroSection',
    'ts-aboutband', 'ts-aboutband__inner', ACT_HEADING_TYPE, 'ts-aboutband__parts', 'ts-aboutband__part', 'ts-aboutband__number', 'ts-aboutband__heading', 'ts-aboutband__quote', 'ts-aboutband__mark', 'ts-aboutband__go',
  ], 'its single-quoted literals: the directive, five paths, ten class strings');
  assert.deepEqual([...band.matchAll(/"([^"]*)"/g)].map((m) => m[1]), ['About us', 'true'], 'its double-quoted literals: the region\'s label, and aria-hidden="true" on the numbers');
  assert.equal(count(code(LETTER), '<p className={STOP.number} aria-hidden="true">{partNumber(index)}</p>'), 1, '(the letter types aria-hidden="true" on its numbers the same way)');
  assert.equal(count(band, '`'), 0, 'no template literal, where a typed word could hide');
  const jsx = band.slice(band.indexOf('return ('), band.lastIndexOf(');'));
  assert.ok(jsx.includes('<section') && jsx.includes('</section>'), '(the band\'s markup was read)');
  assert.deepEqual([...jsx.matchAll(/>([^<>{}]*)</g)].map((m) => m[1]).filter((t) => t.trim() !== ''), [], 'no text between its tags: every word is handed in braces');
  const drawn = textsOf(html);
  assert.ok(drawn.length > 10, `(the band's words were read: ${drawn.length} runs of text)`);
  for (const word of drawn) assert.ok(!band.includes(word), `the band does not type "${word.slice(0, 30)}"`);
  // the door's words: one constant, beside the heading's, the arrow in the string
  assert.equal(ABOUT_US_DOOR, 'Read my story →');
  const leaf = code(HEADINGS);
  assert.deepEqual([...leaf.matchAll(/^export const (\w+) = '([^']*)';$/gm)].map((m) => `${m[1]} = ${m[2]}`), ['WHAT_WE_DO_HEADING = What We Do', 'ABOUT_US_HEADING = About Us', 'ABOUT_US_DOOR = Read my story →', 'OUR_STORY_HEADING = Our Story'], 'the leaf\'s one-string constants, in order: the door\'s words directly under About Us\'s heading');
  assert.equal(code(HEADINGS).split('\n')[71], "export const ABOUT_US_HEADING = 'About Us';", 'and the heading stands on the line it stood on');
  assert.equal(code(HEADINGS).split('\n')[85], "export const ABOUT_US_DOOR = 'Read my story →';", 'the door\'s words on line 86, under its dated note');
  assert.match(code(HEADINGS).split('\n').slice(72, 85).join('\n'), /^\s*$/, 'and nothing but that note between the two');
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(|['"]use client['"]/, 'the leaf stays pure: no import, no directive');
  // "One new constant" (the brief's BUILD 4): the leaf's exports are the seven it had at 480d4ef, and the door's words beside the heading
  assert.deepEqual([...leaf.matchAll(/^export (?:const|let|var|function|interface|type|class|enum) (\w+)/gm)].map((m) => m[1]), ['WHAT_WE_DO_HEADING', 'ABOUT_US_HEADING', 'ABOUT_US_DOOR', 'OUR_STORY_HEADING', 'Pillar', 'PLAN_PILLAR', 'BUILD_PILLAR', 'EXPLORE_PILLAR'], 'the leaf\'s exports: its seven, and one new constant');
  assert.equal(count(leaf, 'export '), 8, 'and no export of another shape');
  // "Read my story" is typed in one file's code under src but the tests — the headings' leaf; not in the letter's words (stopZero01 holds that leaf)
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('Read my story')), [HEADINGS], 'the door\'s words stand in one file\'s code');
  assert.ok(!code(WORDS).includes('Read my story'), 'and not in src/lib/stopZeroWords.ts');
});

// ── T6 · THE MOUNT ───────────────────────────────────────────────────────────

test('T6 the band is mounted once on the home page, in the letter\'s seat — its import where the letter\'s stood, its mount between the travel section\'s close and Our Story, on the two lines the brief names; the letter nowhere on that page; the letter still on /about, once, and the band not there', () => {
  const landing = code(LANDING);
  const MOUNT = '<AboutBand />';
  assert.equal(count(landing, MOUNT), 1, 'the band, mounted once');
  assert.equal(count(landing, '<AboutBand'), 1, 'and no second mount, however it is written');
  assert.equal(count(landing, 'AboutBand'), 3, 'named three times in the page\'s code: its import (the name, and its file) and its mount');
  // the letter nowhere on the home page
  assert.equal(count(landing, 'StopZeroSection'), 0, 'the letter is neither mounted nor imported by Landing.tsx');
  assert.doesNotMatch(landing, /stopZeroWords|STOP_ZERO_|stop-0/, 'and the page reads nothing of its words or its anchor');
  // ruling e: "No redirect is added." — /#stop-0 does nothing on the home page. The hash never reaches the server; the home page's client files
  // are Landing.tsx and the guest's shell around it (src/app/page.tsx mounts GuestLanding.tsx, which mounts Landing): none names the anchor
  for (const file of ['src/app/page.tsx', 'src/components/landing/GuestLanding.tsx']) assert.doesNotMatch(code(file), /stopZeroWords|STOP_ZERO_|stop-0|AboutBand|StopZeroSection/, `${file} names neither the letter, its anchor nor the band`);
  assert.ok(comments(LANDING).split('\n')[452].includes('#stop-0, #my-trip, #modules …) does nothing.'), 'line 453: the old-links effect\'s note, which ruling e cites, where it stood');
  // the seat: between the travel section's close and Our Story's mount, nothing but comments on either side
  const TRAVEL_OPEN = '<section aria-label="Live demo — travel" className="ts-tm">';
  const OUR_STORY = '<WasHereSection today={today} />';
  assert.equal(count(landing, TRAVEL_OPEN), 1, 'the travel section, once');
  assert.equal(count(landing, OUR_STORY), 1, 'Our Story, once (ruling i: its mount and its props as they were)');
  const travelEnd = landing.indexOf('</section>', landing.indexOf(TRAVEL_OPEN)) + '</section>'.length;
  const at = landing.indexOf(MOUNT);
  assert.ok(travelEnd > '</section>'.length && at > travelEnd && landing.indexOf(OUR_STORY) > at, 'the travel section → the band → Our Story');
  assert.match(landing.slice(travelEnd, at), ONLY_COMMENTS, 'the travel section\'s </section> → the band: comments between, nothing else');
  assert.match(landing.slice(at + MOUNT.length, landing.indexOf(OUR_STORY)), ONLY_COMMENTS, 'the band → Our Story: comments between, nothing else');
  // ruling e's two lines: "In Landing.tsx the band's import takes the letter's on :204 and its mount takes the letter's on :753." and, of them,
  // "No line moves."
  const lines = landing.split('\n');
  assert.equal(lines[203].trimEnd(), "import ExperiencesSection from './ExperiencesSection'; import AboutBand from './AboutBand';", 'line 204: the band\'s import, where the letter\'s stood on the ExperiencesSection import\'s line');
  assert.equal(lines[752], '      <AboutBand />', 'line 753: the band\'s mount, where the letter\'s stood');
  assert.equal(lines.length, 816, 'and Landing.tsx is the 815 lines it was (and its closing line break)');
  // who mounts what, over every file under src that is not a test
  const files = srcFiles();
  assert.deepEqual(files.filter((f) => code(f).includes('<AboutBand')), [LANDING], 'the band is mounted by Landing.tsx alone');
  assert.deepEqual(files.filter((f) => code(f).includes('<StopZeroSection')), [ABOUT_PAGE], 'the letter is mounted by /about\'s page alone');
  // every import of the two files, however its path is spelled ('./', '../landing/', '@/components/landing/', …)
  assert.deepEqual(files.filter((f) => /['"][^'"\n]*\/AboutBand['"]/.test(code(f))), [LANDING], 'the band\'s file is imported by Landing.tsx alone, by any path');
  assert.deepEqual(files.filter((f) => /['"][^'"\n]*\/StopZeroSection['"]/.test(code(f))).sort(), [ABOUT_PAGE, BAND].sort(), 'the letter\'s file is read by /about\'s page, for the letter, and by the band, for the quote\'s split — by any path');
  // the letter still on /about, once, and the band not there
  const page = code(ABOUT_PAGE);
  assert.equal(count(page, '<StopZeroSection />'), 1, '/about mounts the letter, once');
  assert.equal(count(page, "import StopZeroSection from '@/components/landing/StopZeroSection';"), 1, 'from its own file');
  assert.ok(!page.includes('AboutBand'), 'and no band: the page is the letter\'s');
});

// ── T7 · THE DOOR ────────────────────────────────────────────────────────────

test('T7 the door is one next/link Link to the pages\' leaf\'s path, read and not retyped; no button, no state, no handler, no script; Landing.tsx reads nothing of that leaf', () => {
  const band = code(BAND);
  assert.equal(count(band, '<Link className={BAND.go} href={ABOUT_PATH}>{ABOUT_US_DOOR}</Link>'), 1, 'the door: a Link to the leaf\'s path, its words the leaf\'s');
  assert.equal(count(band, '<Link'), 1, 'one Link');
  assert.equal(ABOUT_PATH, '/about');
  assert.ok(!band.includes('/about'), 'the path is not retyped in the band');
  const html = render();
  assert.equal(count(html, `<a class="ts-aboutband__go" href="${ABOUT_PATH}">${ABOUT_US_DOOR}</a>`), 1, 'drawn as one link to /about');
  assert.doesNotMatch(html, /\starget=|\srel=|\sonclick=|<script/i, 'it opens in this tab, with no handler and no script');
  // ruling d: "No button element, no state, no modal, no script."
  assert.doesNotMatch(band, /<button\b|<dialog\b|<script\b|<form\b|<input\b/, 'no button, no dialog, no script, no form');
  assert.doesNotMatch(band, /\buse[A-Z]\w*\(|\bon[A-Z]\w*=|\bwindow\.|\bdocument\.|\bfetch\s*\(|new Date\(|Date\.now\(|localStorage|sessionStorage/, 'no hook, no handler, no window, no fetch, no clock, no storage');
  assert.match(band, /^'use client';\n/, 'a client file, as the letter\'s is: it calls a function that file exports');
  assert.match(code(LETTER), /^'use client';\n/, '(the letter\'s file carries the directive)');
  assert.match(code(LANDING), /^'use client';\n/, '(and so does the page that mounts the band)');
  // the page that mounts the band reads nothing of the pages' leaf: the band does
  assert.ok(!code(LANDING).includes('homePages') && !code(LANDING).includes('ABOUT_PATH'), 'Landing.tsx reads nothing of the pages\' leaf');
});

// ── T8 · THE RULINGS ─────────────────────────────────────────────────────────

test('T8 each ruling is quoted, exact, where it is built; and in every source file of the change a quote that follows a sentence of his — his request, the rulings, the two beta notes, the two approvals — for twenty characters is his words from there, whole or to a full stop, and a quote under one of the brief\'s three stamps is the words it dates', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [BAND, [RULING.a, RULING.c, RULING.d, RULING.e, RULING.f]],
    [HEADINGS, [RULING.c]],
    [GLOBALS, [RULING.g, RULING.h]],
    [LANDING, [RULING.e, RULING.i, RULING.j]],
  ];
  // the stamp each of the four carries where the brief is built: the brief by name, its day and hour, and the day it was built
  const STAMP = /HOME-TRIM-01 (?:\(|— )Alex's brief, 2026-11-14 19:11 Manila[^()]*built 2026-11-15\)/;
  for (const [file, rulings] of BUILT) {
    assert.match(prose(file), STAMP, `${file} names the brief, dates it (2026-11-14 19:11 Manila) and dates the build (2026-11-15)`);
    for (const ruling of rulings) assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
  }
  // ruling b: "No line moves in any of these files." — each keeps its length (Landing.tsx's is held in T6), and each re-said note stands on its line
  const RESAID: ReadonlyArray<readonly [file: string, lines: number, at: readonly number[]]> = [
    [LETTER, 144, [4, 32]], [ABOUT_PAGE, 55, [12, 17]], ['src/middleware.ts', 312, [106]],
  ];
  for (const [file, lines, at] of RESAID) {
    const notes = comments(file).split('\n');
    assert.equal(notes.length, lines + 1, `${file} is the ${lines} lines it was (and its closing line break)`);
    for (const n of at) assert.match(notes[n - 1], /HOME-TRIM-01(?: \(|, )2026-11-15/, `${file}:${n} — the note re-said on its own line, dated`);
  }
  // ruling b is built in the notes it re-said; Landing.tsx quotes its rule — its first sentence, to its full stop
  const RULE_B = RULING.b.slice(0, RULING.b.indexOf(' Known at 480d4ef'));
  assert.ok(RULE_B.endsWith('or that Landing.tsx mounts it.'), '(a check of the slicing above: ruling b\'s first sentence)');
  assert.ok(quoted(LANDING, RULE_B), 'Landing.tsx quotes ruling b\'s rule, at the notes it re-said');
  // the spec's own sentence, as its README has it, where the change quotes it: the band's file, the port's header and this file
  const SPEC = 'Every value in its stylesheet is the design, and its markup is the page.';
  assert.ok(flat(whole(README)).includes(SPEC), 'the README\'s sentence');
  for (const file of [BAND, GLOBALS, THIS]) assert.ok(quoted(file, SPEC), `${file} quotes the spec's sentence whole`);
  // the brief's own words, in the band's file: two of the four beta users' notes as he pasted them, and his approval under its stamp
  for (const note of BETA_NOTES) assert.ok(quoted(BAND, note), `the band quotes "${note.slice(0, 30)}…", exact`);
  assert.ok(prose(BAND).includes(`20:01 Manila: "${APPROVAL}"`), 'and his approval of the boards, under its stamp');
  // EVERY SOURCE FILE OF THE CHANGE — eighteen: two new, nine whose notes or code changed, six re-pointed tests and one test's header
  // (homeAbout01's). The handoff's two files are the owner's own and are held byte for byte (T1).
  const CHANGED = [
    BAND, THIS,
    HEADINGS, GLOBALS, LANDING, LETTER, ABOUT_PAGE, 'src/middleware.ts', 'src/lib/homeAnchors.ts', 'src/components/landing/ExperiencesSection.tsx', 'scripts/assert-tool-registry.ts',
    ...['stopZero01', 'experiences01', 'homeOrder01', 'homePanels02', 'homePages01', 'builtOn01', 'homeAbout01'].map((t) => `src/lib/__tests__/${t}.test.ts`),
  ];
  assert.equal(new Set(CHANGED).size, 18);
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  // any quote under one of the brief's three stamps, in any of them, is the words that stamp dates — his request, his approval of the boards,
  // his approval of the corrected boards — exact
  for (const file of CHANGED) {
    const notes = prose(file);
    for (const m of notes.matchAll(/19:11 Manila: "([^"]+)"/g)) assert.equal(m[1], REQUEST, `${file}: under the 19:11 stamp, his request, exact`);
    for (const m of notes.matchAll(/20:01 Manila: "([^"]+)"/g)) assert.equal(m[1], APPROVAL, `${file}: under the 20:01 stamp, his approval of the boards, exact`);
    for (const m of notes.matchAll(/20:41(?: Manila)?: "([^"]+)"/g)) assert.equal(m[1], APPROVAL_OF_THE_CORRECTED, `${file}: under the 20:41 stamp, his approval of the corrected boards, exact`);
  }
  // HIS WORDS ARE THE FIFTEEN BELOW: his request, the ten rulings, the two beta notes, the two approvals. A straight double mark followed by
  // twenty or more characters of one of their sentences, from the sentence's start, opens a quote of him: what stands from there to the closing
  // mark is his words from that sentence on — to the end of the piece on file, or to a full stop — or this fails and says where the two part.
  // A whole sentence of his shorter than that is read too, and counted. Each file's count of the quotes read is held. NOT HELD: a quote that leaves his words before its twentieth character, one that opens in
  // the middle of a sentence, one in other marks, one in a code string; and the brief's other words (where this sits, the build's four steps,
  // what is not in this PR, the audit's ten items, the tests, what done means), which no file of the change quotes — and the spec's sentence,
  // which the brief quotes from the README: it is held whole where the change quotes it (above), not by this scan, because the older ports'
  // headers in globals.css quote their own READMEs' version of it cut.
  const HIS_WORDS = [REQUEST, ...Object.values(RULING), ...BETA_NOTES, APPROVAL, APPROVAL_OF_THE_CORRECTED];
  assert.equal(HIS_WORDS.length, 15);
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
  for (const file of CHANGED) {
    const notes = prose(file);
    for (let at = notes.indexOf('"'); at > -1; at = notes.indexOf('"', at + 1)) {
      const rest = notes.slice(at + 1);
      let his = false;
      let parted = '';
      for (const text of HIS_WORDS) {
        for (const from of sentencesOf(text)) {
          let n = 0;
          while (from + n < text.length && rest[n] === text[from + n]) n += 1;
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') his = true;
          else if (n >= 20) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece on file goes on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(census, {
    [BAND]: 8, // rulings a, c, d, e and f; the two beta notes; his approval of the boards
    [HEADINGS]: 1, // ruling c, at the door's words
    [GLOBALS]: 2, // rulings g and h, over the port
    [LANDING]: 4, // rulings e, i and j, and ruling b's rule, at the seat
    [THIS]: 7, // ruling h's first sentence at the tokens' check; a sentence of ruling g at the seat's; three of ruling e, at the redirect check and the line checks; one of ruling d at the door's; ruling b's last at its files' lines
  }, 'each file\'s quotes of the brief, counted: twenty-two in five files, and none in the other thirteen');

});
