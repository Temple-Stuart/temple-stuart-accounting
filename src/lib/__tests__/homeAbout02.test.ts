/**
 * HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15) — ABOUT US ON THE HOME PAGE SHOWS THE LETTER'S THREE QUOTES, EACH IN
 * ITS PART; QUOTE 2 GAINS ALEX'S FIRST SENTENCE.
 *
 * Alex, 2026-11-15 22:40 Manila, looking at the About Us band on the live home page: "Update the homepage About Us section to display all three
 * quotes, one at the end of each corresponding section, instead of displaying only one." And: "Keep quotes #1 and #3 exactly as written." ·
 * "Display all three quotes prominently and consistently on the homepage, within their respective sections." · "Preserve the existing About Us
 * content, design, styling, and layout wherever possible." · "Do not modify unrelated sections." At 22:49 Manila: "it should be all showing, no
 * swipe on quotes, cause they flow into eachother." At 22:57 Manila: "Quote 2 Change: “That's what I set out to build with Temple Stuart. One
 * connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”"
 *
 * HOME-TRIM-01 put one band in About Us's seat on the home page: the heading, the letter's first quote, one door to /about. This draws the letter's
 * three parts in that band — each its number, its title and its quote — and changes one of Alex's strings in the letter's leaf. The spec is a file:
 * design-refs/home-about-02/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is the page."), with its README
 * beside it. The band is src/components/landing/AboutBand.tsx, which Landing.tsx mounts; its stylesheet is the reference's own, ported to
 * src/app/globals.css under the house prefix at the first band's seat. homeTrim01.test.ts keeps what HOME-TRIM-01 ruled that still stands — the
 * one-word class and the seat, no new token, the heading's classes, the label and no id, one tab stop, nothing typed, the letter's own helper, the
 * door. What is held here:
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two;
 *   T2 the tokens — the README's table, ten, each the app's token by the same name behind the house prefix, with the same value, declared once; the
 *      reference's :root holds those ten and no other; the port reads the ten and the two font variables and nothing else; none is new;
 *   T3 the port — globals.css's band port IS the reference's stylesheet, declaration by declaration and in order, but for the four differences its
 *      header names, at the seat: from the band's first rule to the marquee's keyframes; no hex, no rgb value typed, no gradient; the words' column
 *      named nowhere; the class one word, and homeAbout01:304 as it stood;
 *   T4 the markup — the band's render is the reference's section, token for token (classes behind the house prefix, attributes in any order), but
 *      for the heading's class; every class it wears is ruled by the port, and the port rules no class it does not wear; read in order: the heading,
 *      the three parts, the door;
 *   T5 the words — every word the band draws is a leaf's, in order: the heading; each part's number, its heading, its quote's two marks and its
 *      words; the door's words; the reference draws the same; quote 2 exactly as ruling c gives it, quotes 1 and 3 as they stood; the leaf's code
 *      changed in that line alone and its header word for word; the letter's own two helpers, imported, and no second one written;
 *   T6 the mount — unchanged: the band once on the home page, in the letter's seat, on the lines HOME-TRIM-01 gave it; the letter's code, the letter's
 *      port and /about's page as main had them;
 *   T7 the rulings — each quoted, exact, where it is built, under the brief's stamp; a quote under one of his three stamps is the words that stamp
 *      dates; and in every source file of the change a quote that follows a sentence of this brief for twenty characters is its words from there,
 *      whole or to a full stop — each file's count held, as homeTrim01 T8 keeps its own.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the reference (HTML,
 * which the reader splits as TypeScript) and the README. No clock, no live call. What a browser must show — the band beside the reference at 1440,
 * 1024, 768 and 390, its height and the page's before and after, /about and the rest of the home page equal to main, the requests, the tab stop, no
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
import { ABOUT_US_DOOR, ABOUT_US_HEADING } from '../homeActWords';
import { ABOUT_PATH } from '../homePages';
import { STOP_ZERO_STORY } from '../stopZeroWords';
import AboutBand from '@/components/landing/AboutBand';
import { partNumber } from '@/components/landing/StopZeroSection';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-about-02';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const GLOBALS = 'src/app/globals.css';
const BAND = 'src/components/landing/AboutBand.tsx';
const LETTER = 'src/components/landing/StopZeroSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const ABOUT_PAGE = 'src/app/about/page.tsx';
const HEADINGS = 'src/lib/homeActWords.ts';
const WORDS = 'src/lib/stopZeroWords.ts';
const THIS = 'src/lib/__tests__/homeAbout02.test.ts';
const tests = (name: string): string => `src/lib/__tests__/${name}.test.ts`;

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
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>", whitespace
 * collapsed. Two levels — rules, and rules inside @media. Text after the last block, or a block that declares nothing, is refused, so a stray
 * selector or brace cannot hide in a gap. (homeTrim01.test.ts's reading.)
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
/**
 * THE FOUR DIFFERENCES the port names (globals.css, its header; the brief's ruling d), applied to the reference's declarations:
 *   1. the colours are the app's tokens — the reference's :root is dropped here, and every custom property it reads gains the house prefix;
 *   2. the families are the site's — 'Inter', sans-serif is var(--font-sans), and 'IBM Plex Mono', monospace is var(--font-mono);
 *   3. the heading's rule is not ported — the h2 wears the act headings' Tailwind classes;
 *   4. the reference page's own ground (body) is not ported.
 * Every class gains the house prefix: .aboutband → .ts-aboutband.
 */
const NOT_PORTED = [':root', '.aboutband__title', 'body'];
function referencePorted(): string[] {
  const all = declarations(uncommented(referenceStyle()));
  const dropped = all.filter((d) => NOT_PORTED.includes(d.split(' | ')[1]));
  assert.deepEqual([...new Set(dropped.map((d) => d.split(' | ')[1]))], NOT_PORTED, 'what is not ported, in the reference\'s order: its :root, the heading\'s rule, the page\'s own ground');
  assert.deepEqual([...new Set(dropped.filter((d) => d.split(' | ')[1] === '.aboutband__title').map((d) => d.split(' | ')[0]))], ['', '@media (min-width: 640px)'], 'the heading\'s rule, and its size from 640px');
  return all.filter((d) => !NOT_PORTED.includes(d.split(' | ')[1])).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    const port = decl.replace(/var\(--/g, 'var(--ts-').replace("'Inter', sans-serif", 'var(--font-sans)').replace("'IBM Plex Mono', monospace", 'var(--font-mono)');
    return `${media} | ${sel.replace(/\.aboutband(?=$|[^A-Za-z0-9])/g, '.ts-aboutband')} | ${port}`;
  });
}
/** The port, at its seat: globals.css from the band's first rule to the next block's — the marquee's keyframes (homeTrim01 T3 holds the seat). */
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

/** THE TEN — the README's table: six the app's own, four HOME-PLANS-04 brought; every one already in :root (the brief's ruling e). */
const TEN: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['gold', '184 134 11'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
  ['fs-white', '255 255 255'], ['fs-gold-text', '#8A6408'], ['fs-line', '#E9E4F2'], ['fs-button-line', '#CFC6EC'],
];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text with React's escaping undone; comments and the whitespace that
 * only lays the file out (a run holding a newline) dropped, a lone space between two tags kept. With `prefix`, every class gets the house prefix —
 * the reference's .aboutband__go is the app's .ts-aboutband__go. (homeTrim01.test.ts's reading, as homeAbout01.test.ts has it.)
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
/** The reference's section: from <section to its </section>. */
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
  assert.equal(count(body, '<section'), 1, 'one section in the reference');
  return body.slice(body.indexOf('<section'), body.indexOf('</section>') + '</section>'.length);
}
const render = (): string => renderToStaticMarkup(React.createElement(AboutBand));

/** QUOTE 2, as Alex's change of 22:57 Manila words it and ruling c gives it — typed here a second time, so a changed word fails by name. */
const QUOTE_2 = "“That's what I set out to build with Temple Stuart. One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”";
/** …and as it stood until then (the leaf's line at 79948a9), so the leaf's code can be held to its old digest with that one line put back. */
const QUOTE_2_UNTIL_THEN = '“One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”';
/** Quotes 1 and 3, which Alex kept: "Keep quotes #1 and #3 exactly as written." */
const QUOTE_1 = '“Everyone was showing me the life they were living. I wanted to understand how to build one of my own.”';
const QUOTE_3 = "“I don't just want to sell the dream. I want to guide people into living it for themselves.”";
/** The parts' numbers, typed by position: the letter's partNumber makes them (T5 holds that). */
const NUMBERS = ['01', '02', '03'] as const;
/** Every word the band draws, in order: the heading; each part's number, heading, quote mark, words, mark; the door's words. */
const DRAWN: readonly string[] = [
  ABOUT_US_HEADING,
  ...STOP_ZERO_STORY.flatMap((part, i) => [NUMBERS[i], part.heading, '“', part.quote.slice(1, -1), '”']),
  ABOUT_US_DOOR,
];

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

const RULING = {
  a: 'THE BAND SHOWS ALL THREE PARTS OF THE LETTER. Under the heading, an ordered list: each part of STOP_ZERO_STORY in his order, as its number, its heading and its quote. Then the door. At every width all three show; nothing swipes, folds or hides. The heading keeps the act headings\' classes; the section keeps aria-label="About us" and carries no id.',
  b: 'THE BAND\'S WORDS COME FROM THE LEAVES. It types none of them. Each number is partNumber(index), and each quote is split by quoteParts, both imported from ./StopZeroSection as quoteParts is today; no second helper is written. ABOUT_US_HEADING stays its heading, and its door stays a next/link Link to ABOUT_PATH with ABOUT_US_DOOR.',
  c: 'QUOTE 2 IS ALEX\'S CHANGE OF 2026-11-15 22:57 MANILA. STOP_ZERO_STORY[1].quote becomes, exactly: “That\'s what I set out to build with Temple Stuart. One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.” Its apostrophe is the straight one, and its string is double-quoted, as quote 3\'s are. A dated note quotes his words where the line changes. The leaf\'s code changes nowhere else. Its header stays word for word: it names the letter as the section that draws every one of its words, which stays true, and the band says in its own file which of them it reads. homeAbout01 T7 holds one of the header\'s sentences.',
  d: 'THE BAND\'S PORT IS REPLACED AT ITS SEAT. Its rules become the reference\'s stylesheet behind the house prefix, with the four differences its header names: the colours are the app\'s tokens; the families are var(--font-sans) and var(--font-mono); the heading\'s rule is not ported; the page\'s own ground is not ported. .ts-aboutband__words goes with its last wearer. The class stays one word, aboutband, so homeAbout01:304 stands unedited.',
  e: 'THE TEN TOKENS ARE THE APP\'S. The reference reads ten, all in :root already (the README\'s table); none is added.',
  f: 'HOME-TRIM-01\'S QUOTES STAY WHERE THEY STAND. homeTrim01 T8 stands unedited: its stamp, its rulings and its counts in AboutBand.tsx, homeActWords.ts, globals.css, Landing.tsx and homeTrim01 itself. Re-say around them, never through them, and quote that brief nowhere it is not quoted today.',
  g: 'WHAT GOES FALSE IS RE-SAID WHERE IT STANDS, dated: every sentence in the tree that says the band draws the letter\'s first quote, or that design-refs/home-trim-01 draws the band. Landing.tsx stays 815 lines long (homeTrim01 T6).',
  h: 'THIS BRIEF IS QUOTED UNDER ITS OWN STAMPS: 2026-11-15 22:40, 22:49 and 22:57 Manila. Its rulings are quoted as written: no sentence of theirs opens on twenty characters of a sentence of the briefs whose tests keep a quote census (homeTrim01, homeTrim02, homePages01, and HOME-TRIM-03\'s to come).',
  i: 'ONLY THE BAND AND QUOTE 2 CHANGE: not the letter\'s layout, its port or StopZeroSection.tsx\'s code; on the home page, nothing outside the band.',
} as const;
/** His words under the brief's first stamp, 2026-11-15 22:40 Manila: the request, then the four lines that follow it ("And: …"). */
const REQUEST = 'Update the homepage About Us section to display all three quotes, one at the end of each corresponding section, instead of displaying only one.';
const AND = ['Keep quotes #1 and #3 exactly as written.', 'Display all three quotes prominently and consistently on the homepage, within their respective sections.', 'Preserve the existing About Us content, design, styling, and layout wherever possible.', 'Do not modify unrelated sections.'] as const;
/** His words at 22:49 Manila and at 22:57 Manila, as the brief gives them. */
const NO_SWIPE = 'it should be all showing, no swipe on quotes, cause they flow into eachother.';
const QUOTE_2_CHANGE = `Quote 2 Change: ${QUOTE_2}`;

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-about-02-handoff.zip, 2026-11-15): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 10164, '8f99612fccb24a13878269c58fc6c57753681e90f8cf39248b3710b50ef971e8'],
  [REFERENCE, 8530, '65ebf0c836c5df491cb06107fe05ac77ae2c4d36709d42968976bc45ca1d9aad'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the folder holds the two', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes, as the brief gives it`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
  // the first band's spec stays, the record of the first band (homeTrim01 T1 holds it byte for byte), and so does the letter's (homeAbout01 T1)
  for (const folder of ['design-refs/home-trim-01', 'design-refs/home-about-01']) assert.deepEqual(readdirSync(resolve(ROOT, folder)).sort(), ['README.md', 'Section-Reference.html'], `${folder} stands`);
  assert.ok(whole(README).includes('It takes the place of `design-refs/home-trim-01` as the band\'s spec. That folder stays as it is, the record of the first band.'), 'the README: this folder takes home-trim-01\'s place as the band\'s spec, and that folder stays');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s table — ten, each the app\'s by the same name behind the house prefix, with the same value, declared once; the reference\'s :root holds those ten and no other; the port reads the ten and the two font variables and nothing else; none is new', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), TEN, 'the README\'s table: the ten');
  assert.ok(whole(README).includes('**New with this section: none.** No gradient.'), 'and its word on new tokens: none');
  // the reference declares those ten, and no other
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], TEN.map(([n, v]) => [`--${n}`, v]), 'the reference\'s :root: the ten, in the README\'s order');
  // each is the app's token by the same name behind the house prefix, with the same value — declared once (ruling e)
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of TEN) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal([...globals.matchAll(new RegExp(`--ts-${name}\\s*:`, 'g'))].length, 1, `--ts-${name} declared once in globals.css, wherever it stands`);
  }
  // the port reads every one of the ten — no token listed without a reader — and nothing else but the two font variables
  const read = new Set([...portCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  assert.deepEqual([...read].sort(), [...TEN.map(([n]) => `--ts-${n}`), '--font-mono', '--font-sans'].sort(), 'the ten and the two fonts, and no other');
  const layout = code('src/app/layout.tsx');
  assert.match(layout, /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(layout, /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  assert.match(layout, /IBM_Plex_Mono\(\{\s*weight: \[[^\]]*"600"[^\]]*\]/, 'IBM Plex Mono is loaded at 600, the numbers\' weight');
  // none is added: no custom property is declared for this section — in :root, or in the port
  assert.deepEqual([...root.keys()].filter((k) => /aboutband|about-band/i.test(k)), [], 'no token is named for this section');
  assert.doesNotMatch(portCss(), /(?:^|[\s;{])--[\w-]+\s*:/, 'the port declares no custom property');
});

// ── T3 · THE PORT ────────────────────────────────────────────────────────────

test('T3 the band\'s port in globals.css is the reference\'s stylesheet, declaration by declaration and in order, but for the four differences its header names, at the seat; no hex, no rgb value typed, no gradient; the words\' column named nowhere; the class one word, and homeAbout01:304 as it stood', () => {
  const port = declarations(portCss());
  assert.deepEqual(port, referencePorted(), 'the port is the reference\'s stylesheet, as the four differences leave it');
  assert.equal(port.length, 75, 'seventy-five declarations');
  assert.equal(new Set(port.map((d) => `${d.split(' | ')[0]} | ${d.split(' | ')[1]}`)).size, 15, 'in fifteen rules: ten, and five inside @media');
  // what is not ported is what the reference itself marks so: its :root, which it says is declared only so that the file renders on its own, and
  // its two last section notes, with every rule under each
  const style = referenceStyle();
  const APP_OWN = '/* ── THE APP\'S OWN CLASSES, NOT PORTED:';
  const PAGE_OWN = '/* ── THIS PAGE\'S OWN: not part of the design, not ported';
  assert.ok(count(style, APP_OWN) === 1 && count(style, PAGE_OWN) === 1 && style.indexOf(PAGE_OWN) > style.indexOf(APP_OWN), 'the reference marks two things not ported, in this order');
  const selectorsOf = (css: string): string[] => [...new Set(declarations(uncommented(css)).map((d) => d.split(' | ')[1]))];
  assert.deepEqual(selectorsOf(style.slice(style.indexOf(APP_OWN), style.indexOf(PAGE_OWN))), ['.aboutband__title'], 'under "THE APP\'S OWN CLASSES, NOT PORTED": the heading\'s rule alone');
  assert.deepEqual(selectorsOf(style.slice(style.indexOf(PAGE_OWN))), ['body'], 'under "THIS PAGE\'S OWN": the page\'s ground alone');
  assert.ok(flat(style).includes(`the heading wears the act headings' type, the classes What We Do and the letter's About Us wear — '${ACT_HEADING_TYPE}'.`), 'and the reference names the heading\'s classes: the act headings\' type, whole');
  // the colours are tokens: none typed
  const text = portCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\((?!var\()/, 'no rgb value typed — rgb() only ever wraps a token');
  assert.doesNotMatch(text, /gradient\(/, 'no gradient — the README: "No gradient."');
  // the class stays one word: every class the port names is .ts-aboutband or one of its parts (homeTrim01 T3 holds the seat around it)
  for (const sel of new Set(port.map((d) => d.split(' | ')[1]))) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-aboutband(?:$|__)/, `${sel}: .${m[1]} is the band's, behind the prefix`);
  assert.equal(code(tests('homeAbout01')).split('\n')[303], "  assert.doesNotMatch(outside, /\\.ts-about\\b|\\.ts-about[-_]/, 'no rule outside the port names one of its classes');", 'homeAbout01:304 stands as it stood, and .ts-aboutband is no class it names');
  // ruling d: ".ts-aboutband__words goes with its last wearer." — named by no rule, worn by nothing, typed in no file's code under src
  assert.doesNotMatch(code(GLOBALS), /ts-aboutband__words/, 'no rule names the words\' column');
  assert.doesNotMatch(render(), /ts-aboutband__words/, 'nothing wears it');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('ts-aboutband__words')), [], 'and no file\'s code under src types it');
  // the four differences, named in the port's header — the note that stands over the port, from its title to the line that says who wears it
  const notes = prose(GLOBALS);
  const TITLE = 'ABOUT US, AS ONE BAND ON THE HOME PAGE';
  assert.equal(count(notes, TITLE), 1, 'the port\'s header, once');
  const close = notes.indexOf('Used by src/components/landing/AboutBand.tsx, which Landing.tsx mounts in the seat the letter held.', notes.indexOf(TITLE));
  assert.ok(close > notes.indexOf(TITLE), 'and it closes on the line that says who wears the port');
  const header = notes.slice(notes.indexOf(TITLE), close);
  for (const lead of [
    'THE SPEC IS design-refs/home-about-02/Section-Reference.html: "Every value in its stylesheet is the design, and its markup is the page."',
    'src/lib/__tests__/homeAbout02.test.ts reads both files and holds them equal, declaration by declaration, but for the FOUR DIFFERENCES named here',
    '1. THE COLOURS are tokens the app already holds.', '2. THE FONTS are the site\'s:', '3. NOT PORTED: the heading\'s rule (.aboutband__title, and its size from 640px)', '4. NOT PORTED: the reference page\'s own ground (body)',
  ]) assert.equal(count(header, lead), 1, `the port's header names: ${lead.slice(0, 70)}`);
  assert.doesNotMatch(header, /\b5\. [A-Z]{3}/, 'four, and no fifth');
});

// ── T4 · THE MARKUP ──────────────────────────────────────────────────────────

test('T4 the band\'s render is the reference\'s section, token for token, but for the heading\'s class — the act headings\' type; every class it wears is ruled by the port, and the port rules no class it does not wear; read in order: the heading, the three parts, the door', () => {
  const reference = tokensOf(referenceSection(), true);
  const REFERENCE_HEADING = '<h2 class="ts-aboutband__title">';
  assert.equal(reference.filter((t) => t === REFERENCE_HEADING).length, 1, 'the reference\'s heading, once');
  const asBuilt = reference.map((t) => (t === REFERENCE_HEADING ? `<h2 class="${ACT_HEADING_TYPE}">` : t));
  const html = render();
  const app = tokensOf(html, false);
  assert.deepEqual(app, asBuilt, 'the band is the reference\'s section, but for the heading\'s class');
  assert.equal(app.length, 63, 'sixty-three tokens: the section, its box, the heading, the list and its three parts — each a number, a heading and a quote with its two marks — and the door');
  // ruling a: an ordered list of the three parts, each its number (aria-hidden, as the letter's are), its heading and its quote; then the door
  assert.equal(count(html, '<ol class="ts-aboutband__parts">'), 1, 'one ordered list');
  assert.equal(count(html, '<li class="ts-aboutband__part">'), 3, 'three parts');
  assert.deepEqual([...html.matchAll(/<li class="ts-aboutband__part"><p class="ts-aboutband__number" aria-hidden="true">(\d\d)<\/p><h3 class="ts-aboutband__heading">[^<]*<\/h3><blockquote class="ts-aboutband__quote">/g)].map((m) => m[1]), [...NUMBERS], 'each part: its number, aria-hidden, then its heading, then its quote');
  assert.equal(count(html, '</blockquote></li>'), 3, 'each quote the last thing in its part, as each ends its part in the letter');
  // read in order — the DOM is the reading order: the heading, the three parts, then the door (from 1024px the port draws the door beside the
  // heading; the reading order stays)
  const [h2, ol, a] = ['<h2 ', '<ol ', '<a '].map((open) => html.indexOf(open));
  assert.ok(h2 > -1 && ol > h2 && a > html.lastIndexOf('</li>') && a > ol, 'the heading, the three parts, then the door');
  // what the band wears is what the port rules — each class itself, but for the heading's Tailwind type — and no class is ruled for nothing
  const ruled = new Set(declarations(portCss()).flatMap((d) => d.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []).map((c) => c.slice(1)));
  const worn = new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => !ACT_HEADING_TYPE.split(' ').includes(c)));
  assert.deepEqual([...worn].sort(), ['ts-aboutband', 'ts-aboutband__go', 'ts-aboutband__heading', 'ts-aboutband__inner', 'ts-aboutband__mark', 'ts-aboutband__number', 'ts-aboutband__part', 'ts-aboutband__parts', 'ts-aboutband__quote'], 'the nine classes the band wears');
  assert.deepEqual([...ruled].sort(), [...worn].sort(), 'are the nine the port rules');
  // the heading's classes, the label and no id, one tab stop: homeTrim01 T4 holds them, as HOME-TRIM-01 ruled them
  assert.equal(count(html, `<section class="ts-aboutband" aria-label="About us"><div class="ts-aboutband__inner"><h2 class="${ACT_HEADING_TYPE}">`), 1, 'the section with its label, its box, the heading in the act headings\' type');
});

// ── T5 · THE WORDS ───────────────────────────────────────────────────────────

test('T5 every word the band draws is a leaf\'s, in order — the heading, each part\'s number, heading and quote, the door\'s words; the reference draws the same; quote 2 exactly as ruling c gives it, quotes 1 and 3 as they stood; the leaf\'s code changed in that line alone and its header word for word; the letter\'s own two helpers, imported, and no second one written', () => {
  const html = render();
  assert.deepEqual(textsOf(html), DRAWN, 'the words drawn, in order');
  assert.deepEqual(textsOf(referenceSection(), true), DRAWN, 'the reference\'s words are the same, in the same order (the README\'s "The words": each one its leaf\'s)');
  assert.equal(DRAWN.length, 17, 'seventeen runs of text: the heading, five for each part, the door\'s words');
  // quote 2 is Alex's change of 22:57 Manila, exactly (ruling c); quotes 1 and 3 are as they stood ("Keep quotes #1 and #3 exactly as written.")
  assert.deepEqual(STOP_ZERO_STORY.map((part) => part.quote), [QUOTE_1, QUOTE_2, QUOTE_3], 'the three quotes: 1 and 3 as they stood, 2 his new words');
  assert.equal(QUOTE_2, `“That's what I set out to build with Temple Stuart. ${QUOTE_2_UNTIL_THEN.slice(1)}`, 'quote 2: his new first sentence in front of the words it held, inside the same two marks');
  assert.ok(QUOTE_2.includes("That's") && !QUOTE_2.includes('’'), 'its apostrophe is the straight one');
  const leaf = code(WORDS);
  assert.equal(count(leaf, `    quote: "${QUOTE_2}",`), 1, 'its string is double-quoted in the leaf, as quote 3\'s is');
  assert.equal(count(leaf, `    quote: "${QUOTE_3}",`), 1, '(quote 3\'s string, double-quoted)');
  // "The leaf's code changes nowhere else.": with quote 2's line as it stood, the leaf's code has the digest it had at 79948a9 (homeAbout01 T5 pinned it)
  const asItStood = leaf.replace(`    quote: "${QUOTE_2}",`, `    quote: '${QUOTE_2_UNTIL_THEN}',`);
  assert.equal(sha256(asItStood.replace(/\s+/g, ' ').trim()), 'a93588d7302bd48938f20e638666b8ac2de3372588b7c3c974bb88b653c4cb94', 'the leaf\'s code, with that one line put back, is the code it was');
  // ruling c, the header word for word: the leaf's header comment, from its first character to its first */, as it was at 79948a9
  const words = whole(WORDS);
  assert.equal(sha256(words.slice(0, words.indexOf('*/') + 2)), '2ed347726a2fa576d0877472d994fad38f7aa36a6f40afa7547797520db17531', 'the leaf\'s header, word for word');
  assert.equal(comments(WORDS).split('\n').length, 66, 'and the leaf is the 65 lines it was (and its closing line break): the note stands on quote 2\'s line');
  // the numbers come from the letter's own partNumber, in his order
  assert.deepEqual(STOP_ZERO_STORY.map((_, i) => partNumber(i)), [...NUMBERS], 'partNumber: 01, 02, 03');
  // the band reads the letter's two helpers from the letter's file, and writes neither again (ruling b)
  const band = code(BAND);
  assert.deepEqual(band.split('\n').filter((l) => /^import /.test(l)), [
    "import Link from 'next/link';",
    "import { ABOUT_US_DOOR, ABOUT_US_HEADING } from '@/lib/homeActWords';",
    "import { ABOUT_PATH } from '@/lib/homePages';",
    "import { STOP_ZERO_STORY } from '@/lib/stopZeroWords';",
    "import { partNumber, quoteParts } from './StopZeroSection';",
  ], 'the band\'s five imports: the link, the three leaves, the letter\'s two helpers');
  assert.equal(count(band, 'import'), 5, 'and no other, in any form');
  assert.equal(count(band, '{STOP_ZERO_STORY.map((part, index) => {'), 1, 'each part of the story, in his order');
  assert.equal(count(band, 'const quote = quoteParts(part.quote);'), 1, 'each quote split by quoteParts');
  assert.equal(count(band, '<p className={BAND.number} aria-hidden="true">{partNumber(index)}</p>'), 1, 'each number partNumber(index)');
  assert.equal(count(band, '<h3 className={BAND.h3}>{part.heading}</h3>'), 1, 'each heading the part\'s own');
  assert.equal(count(band, 'STOP_ZERO_'), 2, 'of the leaf, its story alone: its import and its one read — not its place, its dates or its anchor');
  assert.equal(count(band, 'function '), 1, 'no second helper: the band\'s one function is the band');
  assert.doesNotMatch(band, /padStart|String\(|index \+ 1|\.(?:slice|split|replace|substring|substr|match|trim)\(/, 'no number made and no quote split in the band');
  assert.equal(count(band, '<Link className={BAND.go} href={ABOUT_PATH}>{ABOUT_US_DOOR}</Link>'), 1, 'its door: a next/link Link to ABOUT_PATH with ABOUT_US_DOOR');
  assert.equal(ABOUT_PATH, '/about');
  // the band says in its own file which of the leaf's words it reads (ruling c: "the band says in its own file which of them it reads")
  assert.ok(prose(BAND).includes('of that leaf this file reads STOP_ZERO_STORY and nothing else'), 'and says so in its own file');
});

// ── T6 · THE MOUNT ───────────────────────────────────────────────────────────

test('T6 the mount is unchanged — the band once on the home page, in the letter\'s seat, on the lines HOME-TRIM-01 gave it; the letter\'s code, the letter\'s port and /about\'s page as main had them', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, '<AboutBand />'), 1, 'the band, mounted once');
  assert.equal(count(landing, 'AboutBand'), 3, 'named three times in the page\'s code: its import (the name, and its file) and its mount');
  const lines = landing.split('\n');
  assert.equal(lines[203].trimEnd(), "import ExperiencesSection from './ExperiencesSection'; import AboutBand from './AboutBand';", 'line 204: its import, as it stood');
  assert.equal(lines[752], '      <AboutBand />', 'line 753: its mount, as it stood');
  assert.equal(lines.length, 816, 'and Landing.tsx is the 815 lines it was (ruling g: "Landing.tsx stays 815 lines long (homeTrim01 T6)")');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('<AboutBand')), [LANDING], 'the band is mounted by Landing.tsx alone');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('<StopZeroSection')), [ABOUT_PAGE], 'and the letter by /about\'s page alone');
  // ruling i — the letter's layout, its port and StopZeroSection.tsx's code do not change: each as it was at 79948a9, its comments set aside and its
  // whitespace collapsed (code() blanks a comment to spaces, so a note re-said in place changes code()'s whitespace and nothing else)
  const flatCode = (file: string): string => code(file).replace(/\s+/g, ' ').trim();
  assert.equal(sha256(flatCode(LETTER)), 'c774c75a11a77e8f9138b193eacab6b65a52e9f1127cafc526f36feac32ebf54', 'StopZeroSection.tsx\'s code, as main had it (one note re-said, its code not touched)');
  const css = code(GLOBALS);
  assert.equal(sha256(css.slice(css.indexOf('.ts-about {'), css.indexOf('.ts-tm {')).replace(/\s+/g, ' ').trim()), '78fda8673c4aff0a95ed9ebe499507df5308f36f968a97c72dd575235e83eb6f', 'the letter\'s port, as main had it — its layout (homeAbout01 T3 holds it to its reference)');
  assert.equal(sha256(flatCode(ABOUT_PAGE)), 'd504f7913c69094b3366b4013eb30aed19c9f3fa266fbf09eb23561fa2b276dc', '/about\'s page, as main had it: the letter, then Our Story — and its description, the first quote, which does not change');
  assert.ok(code(ABOUT_PAGE).includes('description: STOP_ZERO_STORY[0].quote,'), '(the page\'s description is quote 1)');
});

// ── T7 · THE RULINGS ─────────────────────────────────────────────────────────

test('T7 each ruling is quoted, exact, where it is built, under the brief\'s stamp; a quote under one of his three stamps is the words that stamp dates; and in every source file of the change a quote that follows a sentence of this brief for twenty characters is its words from there, whole or to a full stop — each file\'s count held', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [BAND, [RULING.a, RULING.b]],
    [WORDS, [RULING.c]],
    [GLOBALS, [RULING.d, RULING.e]],
    [tests('homeTrim01'), [RULING.f]],
    [LANDING, [RULING.g, RULING.i]],
    [THIS, [RULING.h]],
  ];
  // the stamp each carries where the brief is built: the brief by name, its day and its first hour
  const STAMP = /HOME-ABOUT-02 \(Alex's brief, 2026-11-15 22:40 Manila[;)]/;
  for (const [file, rulings] of BUILT) {
    assert.match(prose(file), STAMP, `${file} names the brief and dates it (2026-11-15 22:40 Manila)`);
    for (const ruling of rulings) assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
  }
  // ruling h — built here: "THIS BRIEF IS QUOTED UNDER ITS OWN STAMPS: 2026-11-15 22:40, 22:49 and 22:57 Manila. Its rulings are quoted as written: no
  // sentence of theirs opens on twenty characters of a sentence of the briefs whose tests keep a quote census (homeTrim01, homeTrim02, homePages01, and
  // HOME-TRIM-03's to come)." Their own censuses hold the second sentence in the files they read; the audit checked every sentence of the nine rulings
  // and of his words against the fifty pieces those three tests read (the longest shared opening: thirteen characters). The first sentence is held below.
  // EVERY SOURCE FILE OF THE CHANGE — eleven: this one, the band, the leaf, the port's file, Landing.tsx, the headings' leaf and the letter's file, whose
  // notes alone changed in the last two, and four tests re-pointed or re-said. The handoff's two files are the owner's own and are held byte for byte (T1).
  const CHANGED = [
    THIS, BAND, WORDS, GLOBALS, LANDING, HEADINGS, LETTER,
    ...['homeTrim01', 'homeAbout01', 'stopZero01', 'homePages01'].map(tests),
  ];
  assert.equal(new Set(CHANGED).size, 11);
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  // a quote under one of the brief's three stamps, in any of them, is the words that stamp dates — exact
  for (const file of CHANGED) {
    const notes = prose(file);
    for (const m of notes.matchAll(/22:40 Manila: "([^"]+)"/g)) assert.ok([REQUEST, ...AND].includes(m[1] as never), `${file}: under the 22:40 stamp, his words of 22:40, exact — "${m[1].slice(0, 40)}…"`);
    for (const m of notes.matchAll(/22:49(?: Manila)?: "([^"]+)"/g)) assert.equal(m[1], NO_SWIPE, `${file}: under the 22:49 stamp, his words of 22:49, exact`);
    for (const m of notes.matchAll(/22:57(?: Manila)?: "([^"]+)"/g)) assert.equal(m[1], QUOTE_2_CHANGE, `${file}: under the 22:57 stamp, his words of 22:57, exact`);
  }
  // THIS BRIEF'S WORDS ARE THE SIXTEEN BELOW: his request and its four lines under the first stamp, his words at 22:49 and at 22:57, and the nine
  // rulings. A straight double mark followed by twenty or more characters of one of their sentences, from the sentence's start, opens a quote of the
  // brief: what stands from there to the closing mark is its words from that sentence on — to the end of the piece on file, or to a full stop — or this
  // fails and says where the two part. A whole sentence of it shorter than that is read too, and counted. Each file's count of the quotes read is held.
  // NOT HELD: a quote that leaves the brief's words before its twentieth character, one that opens in the middle of a sentence, one in other marks, one
  // in a code string; and the brief's other words (where this sits, the build's three steps, the other session, what is not in this PR, the audit's
  // seven items, the tests, what done means), which no file of the change quotes.
  const HIS_WORDS = [REQUEST, ...AND, NO_SWIPE, QUOTE_2_CHANGE, ...Object.values(RULING)];
  assert.equal(HIS_WORDS.length, 16);
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
    [THIS]: 12, // the header: his request and its four lines, his words at 22:49 and at 22:57; his first line again over quotes 1 and 3, and at T5; ruling d's sentence of the words' column, at T3; ruling c's of the leaf's code, at T5; ruling h, at the census
    [BAND]: 4, // his request and his words at 22:49; rulings a and b
    [WORDS]: 2, // his words at 22:57 and ruling c, on quote 2's line
    [GLOBALS]: 3, // his words at 22:49; rulings d and e, over the port
    [LANDING]: 2, // rulings i and g, over the band's mount
    [tests('homeTrim01')]: 2, // ruling f, in its header; ruling d's first sentence, at T2
    [tests('homeAbout01')]: 2, // ruling c's first sentence, twice: over quote 2 as the reference draws it, and at the leaf's digests
    [tests('stopZero01')]: 1, // ruling c's first sentence, on T1's line for quote 2
  }, 'each file\'s quotes of the brief, counted: twenty-eight in eight files, and none in the other three');
});
