/**
 * HOME-ABOUT-01 (Alex, 2026-11-12 21:43 Manila: "ok last but not least , mock up that about me section"; the boards approved on the
 * design canvas at 21:53: "okayy give me the prompt to send it!") — ABOUT US: STOP 0, IN ALEX'S WORDS, AS DRAWN.
 *
 * The spec is a file: design-refs/home-about-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is
 * the page"), with its README beside it. The section is src/components/landing/StopZeroSection.tsx, which Landing.tsx mounts; its
 * words are src/lib/stopZeroWords.ts's (byte for byte, as they stood) and src/lib/homeActWords.ts's; its stylesheet is the reference's
 * own, ported to src/app/globals.css under the house prefix. What Alex approved is the letter, centred: the board's other layout ("Page
 * grid, left") is built only if he says "left", and the message that launched this build did not.
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two;
 *   T2 the tokens — the README's two tables, six already in the app and five HOME-PLANS-04 brought; the reference's :root holds those
 *      eleven and no other, each the app's token by the same name behind the house prefix, with the same value, declared once; the
 *      port reads all eleven and nothing else but the two font variables; no token is new ("New with this section: none");
 *   T3 the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the five differences
 *      named there; no hex, no rgb value typed, no gradient, no border on a quote; every class behind the prefix and the section's
 *      own; it stands directly under the chip strip's rules and above the Travel Marketplace section's (HOME-TRAVEL-01), then the
 *      Professional Services section's; nothing outside it reaches the section — not by its classes, its id or the elements it draws;
 *   T4 the markup — the section's render is the reference's section, token for token (classes behind the house prefix, attributes
 *      in any order), but for the heading's class: the act headings' type, the one What We Do's h2 wears in Landing.tsx; every
 *      other class the section wears is ruled by the port;
 *   T5 the words — every word the section draws is a leaf's, in order: the heading; the stop and the place, the leaf's line split
 *      at its " | "; the dates; then each part's number (from his order), heading, paragraphs and quote — its two marks and its
 *      words; the reference draws the same words in the same order; the leaf is byte for byte as it stood;
 *   T6 the helpers — placeParts and quoteParts split exactly, and refuse, by name (StopZeroShapeError), a string without their
 *      shape; partNumber counts from 01; the section draws only what they hand it;
 *   T7 the layout and the rulings — the letter, centred: no rule of the board's other layout is ported and nothing wears it; Alex's
 *      words as the README quotes them, where they are built; HOME-BRIEF-02's italics reversed by name.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript) and the README. No clock, no live call. What a browser must show — the
 * letter at 1440 and 390, no sideways scroll, the section's height against the reference's — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { STOP_ZERO_ANCHOR, STOP_ZERO_DATES, STOP_ZERO_PLACE, STOP_ZERO_STORY } from '../stopZeroWords';
import { ABOUT_US_HEADING } from '../homeActWords';
import StopZeroSection, { StopZeroShapeError, partNumber, placeParts, quoteParts } from '@/components/landing/StopZeroSection';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/home-about-01/README.md';
const REFERENCE = 'design-refs/home-about-01/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const SECTION = 'src/components/landing/StopZeroSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const WORDS = 'src/lib/stopZeroWords.ts';

/** The act headings' type — What We Do's h2 (Landing.tsx), and About Us's now, without the 'mt-3' it wore until HOME-ABOUT-01. */
const ACT_HEADING_TYPE = 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** A file's comments as prose: each line's leading " * " gone, whitespace collapsed — a sentence that wraps is one sentence. */
const prose = (file: string): string => flat(comments(file).split('\n').map((line) => line.replace(/^\s*(\/\*\*?|\*\/|\*)?\s?/, '')).join(' '));
/** React's escaping of text, undone — so a word reads the same in the reference's markup and in the render. */
const unescaped = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>",
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homePlans04.test.ts's reading, as homeServices01.test.ts has it.)
 */
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
 * THE FIVE DIFFERENCES the port names (globals.css, its header), applied to the reference's declarations:
 *   1. the colours are tokens — the reference's :root is dropped here, and every custom property it reads gains the house prefix;
 *   2. the fonts are the site's — 'Inter' and 'IBM Plex Mono' are --font-sans and --font-mono;
 *   3. the heading's rule is not ported — the h2 wears the act headings' Tailwind classes;
 *   4. the board's other layout ("Page grid, left") is not ported — Alex did not say "left";
 *   5. the reference page's own ground and bar are not ported.
 * Every class gains the house prefix: .about → .ts-about, .about-part → .ts-about-part.
 */
const NOT_PORTED = [':root', '.about--left .about__column', '.about--left .about-part', '.about--left .about-part__quote', '.about__title', 'body', '.ref-bar', '.ref-bar button', '.ref-bar button[aria-pressed="true"]'];
function referencePorted(): string[] {
  const all = declarations(uncommented(referenceStyle()));
  const dropped = all.filter((d) => NOT_PORTED.includes(d.split(' | ')[1]));
  assert.deepEqual([...new Set(dropped.map((d) => d.split(' | ')[1]))], NOT_PORTED, 'what is not ported, in the reference\'s order: its :root, the other layout\'s three rules, the heading\'s rule, the page\'s own ground and its bar');
  return all.filter((d) => !NOT_PORTED.includes(d.split(' | ')[1])).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    const port = decl.replace(/var\(--/g, 'var(--ts-').replace("'IBM Plex Mono', monospace", 'var(--font-mono)').replace("'Inter', sans-serif", 'var(--font-sans)');
    return `${media} | ${sel.replace(/\.about(?=$|[^A-Za-z0-9])/g, '.ts-about')} | ${port}`;
  });
}
/** The port: globals.css from the section's first rule to the next block's — the Travel Marketplace section's (HOME-TRAVEL-01, 2026-11-12), which
 *  stands between this one and HOME-SERVICES-01's. Until HOME-TRAVEL-01 landed, the next block was the Professional Services section's: '.ts-ps {'. */
const PORT_OPEN = '.ts-about {';
const NEXT_PORT = '.ts-tm {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-about and runs to the Travel Marketplace section\'s first rule');
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

/** THE SIX ALREADY IN THE APP — the README's first table. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['gold', '184 134 11'],
  ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
];
/** THE FIVE HOME-PLANS-04 BROUGHT — the README's second table: reused by name and value, added by none. */
const SHARED: ReadonlyArray<readonly [name: string, value: string]> = [
  ['fs-white', '255 255 255'], ['fs-ink', '#2B2545'], ['fs-gold-text', '#8A6408'], ['fs-line', '#E9E4F2'], ['fs-button-line', '#CFC6EC'],
];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text with React's escaping undone; comments and the
 * whitespace that only lays the file out (a run holding a newline) dropped, a lone space between two tags kept. With `prefix`, every
 * class gets the house prefix — the reference's .about-part is the app's .ts-about-part. (homeServices01.test.ts's reading.)
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
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
  return body.slice(body.indexOf('<section'), body.lastIndexOf('</section>') + '</section>'.length);
}
const render = (): string => renderToStaticMarkup(React.createElement(StopZeroSection));
/** The words the section draws, in order — typed here a second time where a split makes them, so a changed split fails by name. */
const DRAWN: readonly string[] = [
  ABOUT_US_HEADING, 'Stop 0', 'Los Angeles, California 🇺🇸', STOP_ZERO_DATES,
  ...STOP_ZERO_STORY.flatMap((part, i) => [['01', '02', '03'][i], part.heading, ...part.paragraphs, '“', part.quote.slice(1, -1), '”']),
];

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-about-01-handoff.zip, 2026-11-12): bytes and sha256 of each. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 7850, '6f70bfd0f701bad1245705d00dcf1438072069d3b6193b1d90d11be8fc87a48a'],
  [REFERENCE, 13174, 'cf4000b526b004e2313457ac8f68fbd606a131557faf6845fb2a61545543b97a'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the folder holds the two', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, 'design-refs/home-about-01')).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s two tables — six already in the app and five HOME-PLANS-04 brought, the same values behind the house prefix, each declared once; the port reads all eleven and nothing else but the two fonts; none is new', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), KEPT, 'the README\'s first table');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**').map(([n, v]) => [n, v]), SHARED, 'its second');
  assert.ok(whole(README).includes('**New with this section: none.** No gradient.'), 'and its word on new tokens: none');
  // the reference declares those eleven, and no other
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], [...KEPT, ...SHARED].map(([n, v]) => [`--${n}`, v]), 'the reference\'s :root: the eleven, in the README\'s order');
  // each is the app's token by the same name behind the house prefix, with the same value — declared once
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of [...KEPT, ...SHARED]) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal(globals.split('\n').filter((l) => new RegExp(`^\\s*--ts-${name}:`).test(l)).length, 1, `--ts-${name} declared once`);
  }
  // the port reads every one of the eleven — no token listed without a reader — and nothing else but the two font variables
  const read = new Set([...portCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  assert.deepEqual([...read].sort(), [...[...KEPT, ...SHARED].map(([n]) => `--ts-${n}`), '--font-mono', '--font-sans'].sort(), 'the eleven and the two fonts, and no other');
  const layout = code('src/app/layout.tsx');
  assert.match(layout, /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(layout, /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  // "Add none": no custom property is declared for this section — in :root, or in the port
  assert.deepEqual([...root.keys()].filter((k) => /about|stop-?0|stop-?zero/i.test(k)), [], 'no token is named for this section');
  assert.doesNotMatch(portCss(), /(?:^|[\s;{])--[\w-]+\s*:/, 'the port declares no custom property');
});

// ── T3 · THE STYLESHEET ──────────────────────────────────────────────────────

test('T3 the section\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the five named differences; no hex, no rgb value typed, no gradient, no border on a quote; every class behind the prefix; directly under the chip strip\'s rules, above the Travel Marketplace section\'s and the Professional Services section\'s; nothing outside it reaches the section', () => {
  const port = declarations(portCss());
  assert.deepEqual(port, referencePorted(), 'the port is the reference\'s stylesheet, as the five differences leave it');
  assert.ok(port.length > 60, `the port was read (${port.length} declarations)`);
  const text = portCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\((?!var\()/, 'no rgb value typed — rgb() only ever wraps a token');
  assert.doesNotMatch(text, /gradient\(/, 'no gradient — the README: "No gradient."');
  // HOME-BRIEF-02 (Alex, 2026-11-10) and the README: "Still no border." — no border on a quote, nor on its marks
  assert.deepEqual(port.filter((d) => /__(quote|mark)\b/.test(d.split(' | ')[1]) && /^border/.test(d.split(' | ')[2])), [], 'no border on a quote');
  // every class it names carries the house prefix and is the section's own
  const selectors = [...new Set(port.map((d) => d.split(' | ')[1]))];
  for (const sel of selectors) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-about(?:$|[-_])/, `${sel}: .${m[1]} is the section's, behind the prefix`);
  // every variable it reads is declared — the fonts by the layout
  const root = rootOf(code(GLOBALS));
  for (const v of new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))) assert.ok(root.has(v) || v === '--font-sans' || v === '--font-mono', `${v} is declared`);
  // where it stands: directly under the chip strip's rules — nothing between but comments — then the Travel Marketplace section's port, the
  // Professional Services section's and the hero's. HOME-TRAVEL-01 (2026-11-12) landed first in the seat this brief named, under the chip strip and
  // above HOME-SERVICES-01's header; its port runs from its own first rule to HOME-SERVICES-01's (homeTravel01.test.ts), so this one stands above
  // it. Until then the last line read: css.indexOf('.ts-ps {') > at && css.indexOf('.ts-hero {') > at ('above the Professional Services
  // section's port, and the hero's').
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  assert.equal(count(css, PORT_OPEN), 1, 'one port');
  assert.match(css.slice(css.lastIndexOf('.ts-chipfade'), at), /^\.ts-chipfade \{[^{}]*\}\s*\}\s*$/, 'directly under the chip strip\'s last rule (its @media from 1024px), comments between and nothing else');
  assert.ok(css.indexOf(NEXT_PORT) > at && css.indexOf('.ts-ps {') > css.indexOf(NEXT_PORT) && css.indexOf('.ts-hero {') > css.indexOf('.ts-ps {'), 'the chip strip → this port → Travel Marketplace → Professional Services → the hero');
  // nothing outside it names its classes, reaches its id, or reaches the elements it draws
  const outside = css.slice(0, at) + css.slice(css.indexOf(NEXT_PORT));
  assert.doesNotMatch(outside, /\.ts-about\b|\.ts-about[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*about/, 'and none reaches them through a class attribute selector');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1]));
  assert.ok(selectorsOutside.length > 50, `the rules outside the port were read (${selectorsOutside.length})`);
  const drawn = new Set(['section', 'div', 'h2', 'h3', 'p', 'span', 'blockquote']);
  for (const sel of selectorsOutside) {
    assert.ok(!sel.includes(`#${STOP_ZERO_ANCHOR}`), `${sel}: no rule outside the port reaches the section by its id`);
    for (const one of sel.split(',')) {
      const first = one.trim().split(/\s*[\s>+~]\s*/).filter(Boolean).filter((c) => !/^(html|body|:root)$/.test(c))[0] ?? '';
      const type = /^([a-z][a-z0-9-]*)/i.exec(first)?.[1]?.toLowerCase();
      assert.ok(type === undefined || !drawn.has(type), `${sel}: no rule outside the port reaches the section's <${type}> by its element`);
    }
  }
});

// ── T4 · THE MARKUP ──────────────────────────────────────────────────────────

test('T4 the section\'s render is the reference\'s section, token for token, but for the heading\'s class — the act headings\' type, What We Do\'s; every other class it wears is ruled by the port', () => {
  const reference = tokensOf(referenceSection(), true);
  const REFERENCE_HEADING = '<h2 class="ts-about__title">';
  assert.equal(reference.filter((t) => t === REFERENCE_HEADING).length, 1, 'the reference\'s heading, once');
  const asBuilt = reference.map((t) => (t === REFERENCE_HEADING ? `<h2 class="${ACT_HEADING_TYPE}">` : t));
  const html = render();
  const app = tokensOf(html, false);
  assert.deepEqual(app, asBuilt, 'the section is the reference\'s, but for the heading\'s class');
  assert.ok(app.length > 100, `the render was read (${app.length} tokens)`);
  // the heading wears the act headings' type — exactly the classes What We Do's h2 wears in Landing.tsx, and nothing else
  assert.equal(count(code(LANDING), `<h2 className="${ACT_HEADING_TYPE}" data-act-heading>`), 1, 'What We Do\'s h2 wears the act headings\' type');
  assert.equal(count(html, `<h2 class="${ACT_HEADING_TYPE}">`), 1, 'About Us\'s wears the same, without its old mt-3');
  assert.doesNotMatch(html, /\bmt-3\b|ts-about__title/, 'no mt-3, and the reference\'s heading class is worn by nothing');
  // what the section wears is ruled by the port — each class itself, but for the heading's Tailwind type
  const ruled = new Set(declarations(portCss()).flatMap((d) => d.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []).map((c) => c.slice(1)));
  const worn = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => !ACT_HEADING_TYPE.split(' ').includes(c));
  assert.ok(worn.length > 30, `the section's classes were read (${worn.length})`);
  for (const c of new Set(worn)) assert.ok(ruled.has(c), `.${c} is ruled by the port`);
  // the hooks stay: the anchor, the region's label, once each
  assert.equal(count(html, `id="${STOP_ZERO_ANCHOR}"`), 1, 'id="stop-0" once — the footer\'s link lands on it');
  assert.equal(count(html, 'aria-label="About us"'), 1, 'the region\'s label');
});

// ── T5 · THE WORDS ───────────────────────────────────────────────────────────

test('T5 every word the section draws is a leaf\'s, in order — the heading, the stop and the place, the dates, then each part\'s number, heading, paragraphs and quote; the reference draws the same; the leaf is byte for byte as it stood', () => {
  const html = render();
  assert.deepEqual(textsOf(html), DRAWN, 'the words drawn, in order');
  assert.deepEqual(textsOf(referenceSection(), true), DRAWN, 'the reference\'s words are the same, in the same order (the README: "Every word on the page, in order, is the leaves\' own")');
  // the splits lose nothing: the two parts are the leaf's line; each quote's marks and words are the leaf's quote
  assert.equal(['Stop 0', 'Los Angeles, California 🇺🇸'].join(' | '), STOP_ZERO_PLACE, 'the stop and the place are the leaf\'s line, split at its " | "');
  for (const part of STOP_ZERO_STORY) {
    const quote = quoteParts(part.quote);
    assert.equal(`${quote.open}${quote.words}${quote.close}`, part.quote, `"${part.quote.slice(0, 30)}…" — its marks and its words are the leaf's quote`);
  }
  // the numbers come from his order and are aria-hidden: the heading under each says which part it is
  assert.deepEqual([...html.matchAll(/<p class="ts-about-part__number" aria-hidden="true">(\d\d)<\/p><h3 /g)].map((m) => m[1]), ['01', '02', '03'], 'three numbers, aria-hidden, each directly over its part\'s heading');
  // the leaf stays byte for byte — its sha256 at ed10acc, the main this was built from ("a change to these words is Alex's")
  assert.equal(sha256(whole(WORDS)), '6b26ef4b9790280aa67bf55c94ff64a04eadae8736b8ab4bf1903dae8c62feb6', 'src/lib/stopZeroWords.ts is as it stood');
  assert.equal(size(WORDS), 4874);
});

// ── T6 · THE HELPERS ─────────────────────────────────────────────────────────

test('T6 the helpers split exactly, and refuse by name (StopZeroShapeError) a string without their shape; partNumber counts from 01; the section draws only what they hand it', () => {
  // the place line, at its " | ": the stop, then the place
  assert.deepEqual(placeParts(STOP_ZERO_PLACE), { stop: 'Stop 0', place: 'Los Angeles, California 🇺🇸' });
  assert.deepEqual(placeParts('Stop 1 | Mexico City, Mexico'), { stop: 'Stop 1', place: 'Mexico City, Mexico' }, 'any stop and any place of that shape');
  const NOT_A_PLACE_LINE = [
    '', 'Stop 0', 'Stop 0 Los Angeles', 'Stop 0 |Los Angeles', 'Stop 0| Los Angeles', 'Stop 0 || Los Angeles', ' | Los Angeles', 'Stop 0 | ',
    'Stop 0 | Los Angeles | California', 'Stop 0  | Los Angeles', 'Stop 0 |  Los Angeles', ' Stop 0 | Los Angeles', 'Stop 0 | Los Angeles ',
    'Stop 0 | Los|Angeles', 'Stop 0 | Los Angeles\n', 'Stop 0 | Los\nAngeles',
  ];
  for (const bad of NOT_A_PLACE_LINE) {
    assert.throws(() => placeParts(bad), (e: unknown) => e instanceof StopZeroShapeError && e.name === 'StopZeroShapeError' && e.message === `placeParts: "${bad}" is not the stop, " | ", then the place`, `placeParts refuses ${JSON.stringify(bad)} by name`);
  }
  // each quote: its opening mark, its words, its closing mark
  for (const part of STOP_ZERO_STORY) assert.deepEqual(quoteParts(part.quote), { open: '“', words: part.quote.slice(1, -1), close: '”' });
  assert.deepEqual(quoteParts('“a”'), { open: '“', words: 'a', close: '”' }, 'one word is words');
  const NOT_A_QUOTE = [
    '', '“', '”', '“”', 'no marks', '“open only', 'close only”', '"straight"', '‘single’', '“ spaced”', '“spaced ”', '“one” and “two”', '““double””',
    '“line\nbreak”', '“”trailing', 'leading“”',
  ];
  for (const bad of NOT_A_QUOTE) {
    assert.throws(() => quoteParts(bad), (e: unknown) => e instanceof StopZeroShapeError && e.name === 'StopZeroShapeError' && e.message === `quoteParts: "${bad}" is not one quote inside its own two curly marks, “ and ”`, `quoteParts refuses ${JSON.stringify(bad)} by name`);
  }
  // a part's number, from his order
  assert.deepEqual([0, 1, 2, 8, 9, 98].map(partNumber), ['01', '02', '03', '09', '10', '99']);
  // the section draws the leaf's line and quotes through the two helpers, and draws what they hand it — nothing else
  const section = code(SECTION);
  assert.match(section, /const \{ stop, place \} = placeParts\(STOP_ZERO_PLACE\);/, 'the place line, split');
  assert.match(section, /<span className=\{STOP\.stop\}>\{stop\}<\/span>\s*<p className=\{STOP\.place\}>\{place\}<\/p>/, 'the stop, then the place');
  assert.match(section, /const quote = quoteParts\(part\.quote\);/, 'each quote, split');
  assert.match(section, /<p className=\{STOP\.number\} aria-hidden="true">\{partNumber\(index\)\}<\/p>/, 'each number, from the order');
  assert.doesNotMatch(section, /STOP_ZERO_PLACE\.(?:split|slice|replace)|part\.quote\.(?:split|slice|replace)|\.padStart\(2, '0'\)[^\n]*\n[^\n]*STOP_ZERO/, 'no split made elsewhere');
  assert.doesNotMatch(section, /\bcatch\b|\?\?|\|\| ['"`]/, 'no catch and no default: a refusal is never swallowed');
});

// ── T7 · THE LAYOUT AND THE RULINGS ──────────────────────────────────────────

test('T7 the layout is the letter, centred, as approved — nothing of the board\'s other layout is built; Alex\'s words as the README quotes them, where they are built; HOME-BRIEF-02\'s italics reversed by name', () => {
  const readme = whole(README);
  assert.ok(readme.includes('**What he approved is the boards as they open: the letter, centred.**'), 'the README: the letter, centred');
  assert.ok(readme.includes('**Only if Alex says "left"**, the board\'s other layout applies'), 'the other layout: only if he says "left"');
  // nothing of the other layout is ported, and nothing wears it
  for (const [file, text] of [[GLOBALS, code(GLOBALS)], [SECTION, code(SECTION)], ['the render', render()]] as const) assert.doesNotMatch(text, /about--left/, `${file}: nothing of "Page grid, left"`);
  // the letter: the column 680px at most and centred; each part's rule 1040px at most and centred; each quote centred, 1040px at most
  const port = declarations(portCss());
  for (const want of [
    ' | .ts-about__column | max-width: 680px', ' | .ts-about__column | margin-inline: auto',
    ' | .ts-about-part | max-width: 1040px', ' | .ts-about-part | margin: clamp(40px, 4.4vw, 64px) auto 0',
    ' | .ts-about-part__quote | max-width: 1040px', ' | .ts-about-part__quote | text-align: center',
  ]) assert.ok(port.includes(want), `the letter: ${want.slice(3)}`);
  // Alex's words, as the README quotes them, where they are built: the section's note and the port's header
  for (const quote of ['"ok last but not least , mock up that about me section"', '"okayy give me the prompt to send it!"']) {
    assert.ok(readme.includes(quote), `the README quotes ${quote}`);
    assert.ok(prose(SECTION).includes(quote), `StopZeroSection.tsx quotes ${quote}`);
    assert.ok(prose(GLOBALS).includes(quote), `globals.css quotes ${quote}`);
  }
  // the heading's ruling, quoted where it is built: Alex's note of 2026-11-12, as the README has it
  assert.ok(readme.includes('("i like how about us and What We do were the same. About us is better size")'), 'the README quotes his note on the heading');
  assert.ok(prose(SECTION).includes('("i like how about us and What We do were the same. About us is better size")'), 'and so does the section');
  // HOME-BRIEF-02's "the dates in italics", reversed by name — in the README, in the section's note, in its markup
  assert.ok(readme.includes('It is no longer italic: HOME-BRIEF-02 said "the dates in italics", and the PR says so.'), 'the README says so');
  assert.ok(prose(SECTION).includes('ONE PART OF HOME-BRIEF-02 REVERSES: it set "the dates in italics"'), 'and the section\'s note');
  assert.doesNotMatch(render(), /italic/, 'nothing drawn is italic');
  // the words' leaf says why it is not touched, in the words the README quotes
  assert.ok(prose(WORDS).includes("Never reworded, trimmed or added to here: a change to these words is Alex's."), 'src/lib/stopZeroWords.ts\'s header');
  assert.ok(readme.includes("\"Never reworded, trimmed or added to here: a change to these words is Alex's.\""), 'as the README quotes it');
});
