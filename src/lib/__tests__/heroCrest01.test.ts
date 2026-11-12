/**
 * HERO-CREST-01 (Alex, design canvas, 2026-11-11) — THE GUEST LANDING'S HERO AND THE TOP BAR, AS DRAWN.
 *
 * The spec is a file: design-refs/hero-crest-01/Hero-Reference.html ("every value in its stylesheet is the design"), with
 * its README beside it. The hero is src/components/landing/Landing.tsx's band; the bar is
 * src/components/landing/LandingHeader.tsx, on its six mounts; both are drawn by the reference's own stylesheet, ported
 * to the foot of src/app/globals.css.
 *
 *   T1  the handoff landed — four files byte for byte (sha256): the README, the reference, the two crest files. The
 *       mark is held by its presence and exact size only (a PNG does not survive the reader's utf8, so its bytes are
 *       not held here); the two SVGs hold shapes and gradients only;
 *   T2  the colours are tokens, named and valued as the README's table — its seventeen names on its values and its
 *       glass row's fill and line (glass-fill, glass-line, as the reference's :root names them), in its order; the same in the reference's :root, in globals.css (--ts-<name>, each declared once in the whole file)
 *       and behind tailwind.config.ts's `hero` and `glass` families; DESIGN.md's table carries the same names on the
 *       same values;
 *   T3  the app's stylesheet IS the reference's — declaration by declaration, in order, but for the five differences
 *       named in globals.css; no hex in it; every variable it reads is declared; nothing follows it in the file and
 *       nothing above it names one of its classes, by class selector or class attribute selector, at any depth, nor
 *       the headline by its id. (NOT HELD: an ELEMENT selector above it — h1, button, a, as Tailwind's base writes
 *       them — still reaches these elements; so do a browser's own defaults, and so would a second stylesheet imported
 *       after this one. globals.css names the one place that shows.);
 *   T4  the hero, as drawn — closed, token for token: every tag of the band with every attribute, every expression and
 *       every word of text, in the reference's order and nesting, and nothing else; the crest's one <picture>, the bar
 *       laid over it, the copy; the headline's three sentences and the subline from src/lib/brandLines.ts; both buttons
 *       with the handler and the href they had; the BSL pill and the arrow glyph gone; no colour, no computed class and
 *       no house utility typed in it;
 *   T5  the bar's words and links — the three pillars, each by its own name (its heading, src/lib/homeActWords.ts —
 *       never typed in the bar) on its own section (its anchor, src/lib/homeAnchors.ts — never a typed id); Pricing;
 *       the gold mark; "GitHub" and "create account" gone;
 *   T6  one pill, two fills, and Log in's two modes — rendered: filled is the default, glass is asked for; a button
 *       where a login opener is given, a link to '/' where none is; the menu repeats the bar and starts closed;
 *   T7  the phone menu's open-or-closed is React state and nothing else — and the bar's imports are a closed list, so
 *       no helper can carry it out; it closes on a link, on Log in, on Escape and on the button; the bar's own Log in
 *       calls the login opener;
 *   T8  six mounts — the landing asks for glass, the other five pass nothing new, four of them nothing at all; no
 *       mount hands the bar a register opener; six files import the bar, under its own name, and no seventh;
 *   T9  "create account" is still reachable from Log in — the one LoginBox's own switch, and the openers that reach it;
 *   T10 #modules has one home — MODULES_ANCHOR, read by the bar and by the footer; it equals the how-to's own id;
 *   T11 GitHub's mark — public/logos/github.svg, in the form the folder's Simple Icons files have (only this file is
 *       held to it: the Built-on wall's own files may be dropped in whatever form their vendors ship), drawn through a
 *       mask in the button's ink, 20px (17px under 1024px), decorative; its path typed in no .ts or .tsx file under src outside
 *       __tests__;
 *   T12 the reachability law's door to /how-pricing-works cites the line the bar's Pricing link is defined on — read
 *       by content, so the citation cannot drift;
 *   T13 the rulings are on the page — each of Alex's three removals quoted where it was made.
 *
 * FOOTER-02 (Alex's board, approved 2026-11-12 23:30 Manila): the footer opens with the bar's gold crest and wordmark, so the mark's path
 * and the wordmark moved to one plain leaf, src/lib/brandLockup.ts, which the bar and the footer both read. The bar draws exactly what it
 * drew, and re-exports BAR_MARK_SRC (this file still imports it from the bar). T7's closed list of the bar's imports gained that leaf's
 * line, with a dated note; the law's door to /how-pricing-works (T12) re-cites BAR_PRICING's line, one lower. Nothing else here moved.
 *
 * Source is read through code() and comments() only (the reader law). rejoin() is used for whole-file digests alone.
 * Every pattern that holds code reads code(); T13 reads comments(), where the rulings are quoted.
 * No clock, no live call, no database. What a browser must show — the look at 1440, 1024 and 390, no sideways scroll
 * from 340px, the headline on three lines, the two buttons side by side — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { COMPANY_LINE, HERO_SUBLINE } from '../brandLines';
import { CODE_URL, FOOTER_SERVICES_LINKS } from '../footerWords';
import { DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR } from '../homeAnchors';
import { BUILD_PILLAR, EXPLORE_PILLAR, PLAN_PILLAR } from '../homeActWords';
import LandingHeader, { BAR_MARK_SRC, BAR_MENU_ID, BAR_PRICING, BAR_PRODUCT_LINKS } from '@/components/landing/LandingHeader';
import tailwindConfig from '../../../tailwind.config';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/hero-crest-01/README.md';
const REFERENCE = 'design-refs/hero-crest-01/Hero-Reference.html';
const CREST_DESKTOP = 'public/brand/hero-crest-desktop.svg';
const CREST_MOBILE = 'public/brand/hero-crest-mobile.svg';
const MARK = 'public/brand/temple-stuart-crest-gold.png';
const GITHUB = 'public/logos/github.svg';
const GLOBALS = 'src/app/globals.css';
const LANDING = 'src/components/landing/Landing.tsx';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const GUEST = 'src/components/landing/GuestLanding.tsx';
const HOME_CLIENT = 'src/components/home/HomeClient.tsx';
const LOGIN_BOX = 'src/components/LoginBox.tsx';
const ANCHORS = 'src/lib/homeAnchors.ts';
const FOOTER_WORDS = 'src/lib/footerWords.ts';
const HOW_TO = 'src/components/landing/HowToSection.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
/** The five mounts that are not the landing — the first passes a login opener, the other four pass nothing. */
const OTHER_MOUNTS = [HOME_CLIENT, 'src/app/modules/[pillar]/ModulePageClient.tsx', 'src/app/how-it-works/page.tsx', 'src/app/pricing/page.tsx', 'src/app/my-trip/[id]/page.tsx'] as const;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A whole file's digest, through the reader: the two halves put back together are the file (sourceText.ts rejoin). */
const digest = (file: string): string => sha256(rejoin(code(file), comments(file)));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed by code()) as one line per declaration, in order:
 * "<media> | <selector> | <property>: <value>", whitespace collapsed. Two levels only — rules, and rules inside @media —
 * which is all either stylesheet holds.
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

/** The reference's stylesheet: what stands between <style> and </style>. */
function referenceCss(): string {
  const html = code(REFERENCE);
  assert.equal(count(html, '<style>'), 1, 'one stylesheet in the reference');
  return html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));
}
/** globals.css :root — its declarations as name → value. */
function rootTokens(): Map<string, string> {
  const css = code(GLOBALS);
  const at = css.indexOf(':root {');
  assert.ok(at > -1 && (css.match(/:root\b/g) ?? []).length === 1, 'one :root in globals.css, however it is spaced');
  const map = new Map<string, string>();
  for (const line of declarations(css.slice(at, css.indexOf('}', at) + 1))) {
    const decl = line.split(' | ')[2];
    map.set(decl.slice(0, decl.indexOf(':')), decl.slice(decl.indexOf(':') + 1).trim());
  }
  return map;
}
/** The port: everything in globals.css from the hero's first rule to the end of the file. */
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf('.ts-hero {');
  assert.ok(at > -1, 'the port opens at .ts-hero');
  assert.ok(at > css.indexOf('.ts-chipfade'), 'at the foot of the file, under everything that was there');
  return css.slice(at);
}
/** Every class the port's selectors name — .ts-hero, .ts-bar__pill, … — each once. */
function portClasses(): Set<string> {
  return new Set(declarations(portCss()).flatMap((line) => line.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []));
}

/**
 * The new colours, NAMED AND VALUED AS THE README'S TABLE (design-refs/hero-crest-01/README.md, "Tokens"). The reference
 * writes each --<name>; the app writes it --ts-<name>.
 */
const TOKENS: ReadonlyArray<readonly [name: string, value: string]> = [
  ['hero-violet-1', '#6A33E0'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
  ['hero-bloom', '162 107 255'],
  ['hero-orchid', '217 70 239'],
  ['hero-ink', '#FAF8F4'],
  ['hero-ink-soft', '#E4E0F2'],
  ['hero-ink-nav', '#E8E4F5'],
  ['hero-gold', '#F6C95C'],
  ['hero-gold-1', '255 236 178'], ['hero-gold-2', '248 203 90'], ['hero-gold-3', '236 178 62'],
  ['hero-on-gold', '#2A0F5C'],
  ['hero-well', '#210B5C'],
  ['hero-rim-gold', '#F8CB5A'], ['hero-rim-lilac', '#B9A2FF'],
  ['glass-fill', 'rgb(255 255 255 / 0.10)'], ['glass-line', 'rgb(255 255 255 / 0.22)'],
];
/** A colour the stylesheet reads at an alpha is stored as three channels; one it reads solid, as written. */
const isChannels = (value: string): boolean => /^\d+ \d+ \d+$/.test(value);
/**
 * A token table — the README's "Tokens" and DESIGN.md's — read as [name, value] pairs in the table's own order. A row
 * names its tokens in backticks in its first cell and gives their values in backticks in its second, in the same order;
 * "`hero-violet-1` … `-4`" is the run from 1 to 4. The README writes its glass row differently, and spells neither
 * name: the row is read as glass-fill and glass-line, the names the reference's :root and DESIGN.md give them —
 * "| glass | `rgb(255 255 255 / 0.10)` fill · `/ 0.22` line · …" — the fill, then the line as the fill's white at a second alpha.
 */
function tableTokens(file: string, heading: string): Array<[name: string, value: string]> {
  const doc = code(file);
  const from = doc.indexOf(`\n${heading}`);
  assert.ok(from > -1, `${file} has the section "${heading}"`);
  const end = doc.indexOf('\n## ', from + 1);
  const rows = doc.slice(from, end < 0 ? doc.length : end).split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Token |'));
  const ticked = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const out: Array<[string, string]> = [];
  for (const row of rows) {
    const [nameCell, valueCell] = row.split('|').slice(1).map((cell) => cell.trim());
    if (nameCell === 'glass') {
      const glass = /^`(rgb\(255 255 255 \/ )(0\.\d+)\)` fill · `\/ (0\.\d+)` line\b/.exec(valueCell);
      assert.ok(glass, `${file}: the glass row reads "<fill> fill · / <alpha> line"`);
      out.push(['glass-fill', `${glass[1]}${glass[2]})`], ['glass-line', `${glass[1]}${glass[3]})`]);
      continue;
    }
    const named = ticked(nameCell);
    const last = named.length === 2 ? /^-(\d+)$/.exec(named[1]) : null;
    const first = last ? /^(.+)-(\d+)$/.exec(named[0]) : null;
    const names = last && first ? Array.from({ length: Number(last[1]) - Number(first[2]) + 1 }, (_, i) => `${first[1]}-${Number(first[2]) + i}`) : named;
    const values = ticked(valueCell);
    assert.equal(values.length, names.length, `${file}: ${nameCell} — as many values as names`);
    names.forEach((name, i) => out.push([name, values[i]]));
  }
  return out;
}

// ── the hero's markup ────────────────────────────────────────────────────────

const HERO_OPEN = '<div className="ts-hero">';
/** The band, from its opening <div> to that div's own closing tag — Landing.tsx's code, comments removed. Found by depth, so its layout on the page does not matter. */
function heroOf(landing: string): string {
  const from = landing.indexOf(HERO_OPEN);
  assert.ok(from > -1, `Landing.tsx opens the band: ${HERO_OPEN}`);
  assert.equal(count(landing, HERO_OPEN), 1, 'one band');
  let depth = 0;
  for (const m of landing.slice(from).matchAll(/<(\/?)div\b[^<>]*>/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return landing.slice(from, from + (m.index ?? 0) + m[0].length);
  }
  assert.fail('the band\'s <div> is never closed');
}
/**
 * The band, token by token, in document order: every tag whole (its attributes too, whitespace collapsed, so how the JSX is
 * wrapped does not matter), every {expression} between tags, every run of text. What a removed JSX comment leaves — {} — is
 * dropped.
 */
function bandTokens(hero: string): string[] {
  const out: string[] = [];
  for (const m of hero.matchAll(/<[^<>]*>|\{[^{}]*\}|[^<>{}]+/g)) {
    const token = flat(m[0]);
    if (token === '' || /^\{\s*\}$/.test(token)) continue;
    out.push(token.startsWith('<') ? token.replace(/\s*\/>$/, ' />').replace(/\s+>$/, '>') : token);
  }
  return out;
}
/** Every class a source types in a className="…" attribute. */
const classesOf = (source: string): string[] => [...source.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
/** No colour typed: no hex, no colour function, no arbitrary-value utility. */
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(|\[#/;

const render = (props: { onRequireLogin?: () => void; glass?: boolean } = {}): string => renderToStaticMarkup(React.createElement(LandingHeader, props));
const hrefsOf = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const textOf = (html: string): string => flat(html.replace(/<[^>]*>/g, ' '));
/** The bar's row and the phone menu, split at the menu's <nav>. */
const halves = (html: string): [bar: string, menu: string] => {
  const at = html.indexOf('<nav class="ts-menu"');
  assert.ok(at > -1, 'the menu is in the header');
  return [html.slice(0, at), html.slice(at)];
};

function srcFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = `${dir}/${name}`;
    if (statSync(abs).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') out.push(...srcFiles(abs)); continue; }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(abs.replace(`${ROOT}/`, ''));
  }
  return out;
}

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

test('T1 the five handoff files are in the tree — the README, the reference and the two crest files byte for byte (sha256), the mark by its presence and exact size; the two SVGs hold shapes and gradients only', () => {
  const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
    [README, 7470, '87d9b31a906b3c7747cddafdc8f96a9f482722c868023099ba70985e7fe6a613'],
    [REFERENCE, 18959, 'e679f99052bee4a10d4a3b3a8fabd3bd4cac10dd4e5e0589030a8334c3cb08fe'],
    [CREST_DESKTOP, 156966, '38a410054bfd2d8f2957e9e39bcba56ba7049902a693b127660e582e67eb2899'],
    [CREST_MOBILE, 128679, 'b903436f863e8d6dfc1cdd0b41b0acadcd26b6cbd9466a97aed6d163bd5e67fe'],
  ];
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: its size`);
    assert.equal(digest(file), sha, `${file}: byte for byte as handed over — never redrawn, traced or hand-edited`);
  }
  // A PNG is not text: the reader decodes utf8, so its bytes cannot be digested here. Its presence and exact size are held — a
  // different picture of the same 22,269 bytes would pass this line.
  assert.ok(existsSync(resolve(ROOT, MARK)), `${MARK} is in the tree`);
  assert.equal(size(MARK), 22269, `${MARK}: its size`);
  for (const svg of [CREST_DESKTOP, CREST_MOBILE]) {
    assert.equal(comments(svg).trim(), '', `${svg}: nothing in it reads as a comment, so code() is the whole file`);
    const text = code(svg);
    const tags = [...new Set([...text.matchAll(/<([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]))].sort();
    assert.deepEqual(tags, ['circle', 'defs', 'g', 'linearGradient', 'path', 'radialGradient', 'stop', 'svg'], `${svg}: paths, circles and gradients only — no script, no embedded image`);
    assert.doesNotMatch(text, /\bhref\s*=|url\(\s*['"]?(?!#)|<!ENTITY|\bon[a-z]+\s*=/i, `${svg}: no outside reference and no handler`);
  }
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the design\'s colours are tokens, named and valued as the README\'s table: the reference\'s :root, globals.css :root (--ts-<name>), tailwind.config.ts\'s hero and glass families and DESIGN.md\'s table hold the same nineteen', () => {
  assert.equal(TOKENS.length, 19);
  assert.equal(new Set(TOKENS.map(([name]) => name)).size, 19, 'nineteen names');
  // the two tables, read row by row: each name on its own value, in the README's order — not a value found somewhere in the file
  const pairs = TOKENS.map(([name, value]) => [name, value]);
  assert.deepEqual(tableTokens(README, '## Tokens'), pairs, 'the README\'s table: its seventeen names and its glass row\'s fill and line, each on this value, in this order');
  assert.deepEqual(tableTokens('DESIGN.md', '## The guest hero and the top bar'), pairs, 'DESIGN.md\'s table: the same names on the same values');
  // the reference's own :root — the nineteen colours and its two geometry properties, nothing else
  const refRoot = new Map(declarations(referenceCss()).filter((d) => d.startsWith(' | :root | ')).map((d) => {
    const decl = d.split(' | ')[2];
    return [decl.slice(0, decl.indexOf(':')), decl.slice(decl.indexOf(':') + 1).trim()] as const;
  }));
  assert.deepEqual([...refRoot.keys()].sort(), [...TOKENS.map(([name]) => `--${name}`), '--crest-x', '--crest-w'].sort(), 'the reference declares these nineteen colours and its two geometry properties');
  const root = rootTokens();
  for (const [name, value] of TOKENS) {
    assert.equal(refRoot.get(`--${name}`), value, `the reference: --${name}`);
    assert.equal(root.get(`--ts-${name}`), value, `globals.css :root: --ts-${name} — the reference's value, the house prefix`);
  }
  // nothing else wears the two prefixes, and no value is typed twice under a second name
  const ours = [...root.keys()].filter((k) => k.startsWith('--ts-hero-') || k.startsWith('--ts-glass-')).sort();
  assert.deepEqual(ours, TOKENS.map(([name]) => `--ts-${name}`).sort(), 'the nineteen, and no twentieth');
  // each is declared ONCE in the whole file: a second declaration anywhere — another rule, a second :root — would override the first for every visitor
  const declared = [...code(GLOBALS).matchAll(/(--ts-(?:hero|glass)-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(declared, TOKENS.map(([name]) => `--ts-${name}`).sort(), 'declared once each in globals.css, and nowhere a second time');
  // tailwind.config.ts, read as the object it exports — not as text, so neither its quotes nor its layout matter: each family holds
  // its tokens and nothing else, and each entry reads its variable (as channels where the stylesheet draws the colour at an alpha)
  const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  for (const family of ['hero', 'glass']) {
    const expected = Object.fromEntries(TOKENS.filter(([name]) => name.startsWith(`${family}-`)).map(([name, value]) => [name.slice(family.length + 1), isChannels(value) ? `rgb(var(--ts-${name}) / <alpha-value>)` : `var(--ts-${name})`]));
    assert.deepEqual(colors[family], expected, `tailwind.config.ts: the ${family} family holds its tokens and nothing else, each reading its variable`);
  }
});

// ── T3 · THE STYLESHEET IS THE REFERENCE'S ───────────────────────────────────

test('T3 the hero\'s and the bar\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the five named differences; it types no hex; every variable it reads is declared', () => {
  const rename = (line: string): string => {
    const [media, selector, decl] = line.split(' | ');
    return [media, selector.replace(/\.([a-z])/g, '.ts-$1'), decl.replace(/--(hero|glass|crest)-/g, '--ts-$1-')].join(' | ');
  };
  const expected: string[] = [];
  for (const line of declarations(referenceCss()).map(rename)) {
    const [media, selector, decl] = line.split(' | ');
    // 5. NOT PORTED — the reference page's own ground.
    if (selector === 'body' || selector.startsWith('.ts-plain-page')) continue;
    // 1. THE COLOURS are tokens in globals.css :root (T2); the two geometry properties sit on the band, their only reader.
    if (selector === ':root') {
      if (decl.startsWith('--ts-crest-')) expected.push([media, '.ts-hero', decl].join(' | '));
      continue;
    }
    // 2 + 3. THE FONTS are the site's: Inter is inherited, so where the reference names it the app resets the line
    //        height the reference was written against; the mono is the site's variable.
    if (decl === "font-family: 'Inter'") { expected.push([media, selector, 'line-height: normal'].join(' | ')); continue; }
    if (decl === "font-family: 'IBM Plex Mono'") { expected.push([media, selector, 'font-family: var(--font-mono)'].join(' | ')); continue; }
    // 4. THE GITHUB MARK stands where the reference draws a stand-in ring: same slot, same sizes, the mark in the ring's place.
    if (selector === '.ts-github-slot') {
      if (/^(box-sizing|border|border-radius|border-width):/.test(decl)) continue;
      if (decl.startsWith('background-color:')) { expected.push([media, '.ts-github-mark', 'background-color: currentColor'].join(' | '), [media, '.ts-github-mark', 'mask: url(/logos/github.svg) center / contain no-repeat'].join(' | ')); continue; }
      expected.push([media, '.ts-github-mark', decl].join(' | '));
      continue;
    }
    expected.push(line);
  }
  const port = declarations(portCss());
  assert.deepEqual(port.slice(0, expected.length), expected, 'the port, line for line');
  assert.deepEqual(port.slice(expected.length), [], 'nothing follows the port in globals.css — a new rule goes above the HERO-CREST-01 block, not after it');
  assert.ok(port.length > 200, `a whole stylesheet was compared (${port.length} declarations)`);
  // nothing above the port names one of its classes — as a class selector or inside a class attribute selector, at any depth: a
  // restyle from above (inside @layer or @supports too) would pass the equality. The text above is searched, not its parsed rules.
  // What this cannot hold: an ELEMENT selector above (h1, button, a — Tailwind's base writes such rules) still reaches these elements.
  const whole = code(GLOBALS);
  const above = whole.slice(0, whole.indexOf('.ts-hero {'));
  const own = portClasses();
  assert.ok(own.size >= 25 && ['.ts-hero', '.ts-bar__pill', '.ts-menu', '.ts-pill-gold', '.ts-cta-secondary', '.ts-github-mark'].every((cls) => own.has(cls)), `the port's own classes were read (${own.size})`);
  assert.deepEqual([...new Set(above.match(/\.ts-[A-Za-z][\w-]*/g) ?? [])].filter((cls) => own.has(cls)), [], 'nothing above the port names one of the hero\'s or the bar\'s classes');
  const reaching = [...above.matchAll(/\[\s*class\s*[~|^$*]?=\s*["']?([^"'\]]+?)["']?\s*\]/g)].map((m) => m[1].trim()).filter((value) => [...own].some((cls) => cls.slice(1).includes(value) || value.includes(cls.slice(1))));
  assert.deepEqual(reaching, [], 'and nothing above reaches them through a class attribute selector ([class*="…"] and its kin)');
  assert.doesNotMatch(above, /#hero-title\b/, 'nor the headline through its id');
  assert.ok(above.includes('.ts-chipfade'), 'the rules above were read (the chip strip\'s is among them)');
  // every selector wears the house prefix; no colour is a hex; the differences left no trace of the reference's own names
  for (const line of port) {
    const [, selector, decl] = line.split(' | ');
    for (const cls of selector.match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-'), `${selector}: ${cls} wears the house prefix`);
    assert.doesNotMatch(decl, /#[0-9a-fA-F]{3,8}\b/, `${line}: no hex — a colour the design names is a token`);
    assert.doesNotMatch(decl, /--(hero|glass|crest)-|'Inter'|'IBM Plex Mono'|fonts\.googleapis/, `${line}: the reference's own names are renamed`);
  }
  // every variable the port reads is declared: a colour in :root, the crest's geometry on the band, the mono by the layout
  const root = rootTokens();
  const onBand = new Set(port.filter((l) => l.split(' | ')[1] === '.ts-hero' && l.split(' | ')[2].startsWith('--')).map((l) => l.split(' | ')[2].split(':')[0]));
  assert.deepEqual([...onBand].sort(), ['--ts-crest-w', '--ts-crest-x'], 'the band declares the crest\'s two geometry properties');
  const read = new Set(port.flatMap((l) => [...l.split(' | ')[2].matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
  for (const v of read) assert.ok(root.has(v) || onBand.has(v) || v === '--font-mono', `${v} is declared`);
  assert.match(code('src/app/layout.tsx'), /variable:\s*["']--font-mono["']/, 'src/app/layout.tsx declares --font-mono (IBM Plex Mono)');
  for (const [name] of TOKENS) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read by the stylesheet — no token without a reader`);
});

// ── T4 · THE HERO ────────────────────────────────────────────────────────────

test('T4 the hero, as drawn — token for token: the band, the crest\'s one <picture>, the bar laid over it, the copy; the words from brandLines.ts; both buttons with their handler and href; the BSL pill and the arrow glyph gone; no colour typed', () => {
  const landing = code(LANDING);
  const hero = heroOf(landing);
  // THE BAND IS CLOSED: these tokens, in this order, and no others — every tag whole with every attribute it carries, every
  // expression, every word of text. Nothing can be added to the hero, taken from it, lifted out of it or re-ordered in it unseen:
  // a licence line under any wording (as an element, as bare text or as an expression), a third button, a handler dropped, an
  // attribute that hides the copy, the buttons outside the copy. How the JSX is wrapped across lines does not matter.
  assert.deepEqual(bandTokens(hero), [
    '<div className="ts-hero">',
    // the crest: one <picture>, so only one file downloads — the desktop file from 1024px, the mobile file otherwise; decorative
    '<picture className="ts-hero__crest">',
    '<source media="(min-width: 1024px)" srcSet="/brand/hero-crest-desktop.svg" />',
    '<img src="/brand/hero-crest-mobile.svg" alt="" aria-hidden="true" />',
    '</picture>',
    // the bar, laid over the band as glass, with the login opener and no register opener
    '<LandingHeader glass onRequireLogin={onRequireLogin} />',
    // the copy: the headline's three sentences in three spans (the stylesheet inks the last one gold), then the subline
    '<section className="ts-hero__inner" aria-labelledby="hero-title">',
    '<div className="ts-hero__copy">',
    '<h1 className="ts-hero__title" id="hero-title">',
    '<span>', '{COMPANY_LINE[0]}', '</span>',
    '<span>', '{COMPANY_LINE[1]}', '</span>',
    '<span>', '{COMPANY_LINE[2]}', '</span>',
    '</h1>',
    '<p className="ts-hero__subline">', '{HERO_SUBLINE}', '</p>',
    // the two buttons, each with what it had: the register opener, and the repository in a new tab — the mark, the label, the arrow
    '<div className="ts-hero__cta">',
    '<button type="button" onClick={onRequireAuth} className="ts-pill-gold ts-cta-primary">', 'Create free account', '</button>',
    `<a className="ts-cta-secondary" href="${CODE_URL}" target="_blank" rel="noopener noreferrer">`,
    '<span className="ts-github-mark" aria-hidden="true" />',
    '<span>', 'Clone it on GitHub', '</span>',
    '<svg className="ts-cta-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">',
    '<path d="M4.5 11.5l7-7M5.5 4.5h6v6" />',
    '</svg>',
    '</a>',
    '</div>',
    '</div>',
    '</section>',
    '</div>',
  ], 'the band, token for token: its tags with their attributes, its expressions and its words, in the reference\'s order and nesting — and nothing else');
  for (const file of [CREST_DESKTOP, CREST_MOBILE]) assert.ok(hero.includes(`"${file.replace(/^public/, '')}"`), `the hero draws ${file}`);
  assert.equal(count(landing, '/brand/'), 2, 'the two crest files, each named once in this file');
  assert.equal(count(landing, '<h1'), 1, 'one h1 on the home page');
  assert.equal(count(landing, 'id="hero-title"'), 1, 'the section is labelled by its headline');
  for (const words of [...COMPANY_LINE, HERO_SUBLINE]) assert.ok(!landing.includes(words), `Landing.tsx types none of "${words.slice(0, 24)}…" — the words are src/lib/brandLines.ts's`);
  // gone, by Alex's ruling
  for (const gone of ['✦', 'Source-available', 'BSL', 'LICENSE', '↗']) assert.ok(!hero.includes(gone), `the hero carries no ${gone}`);
  assert.ok(!landing.includes('/blob/main/LICENSE'), 'the licence link left this file — the footer\'s Software License is its door');
  assert.doesNotMatch(landing, /<LandingHeader[^>]*onRequireAuth/, 'the bar is handed no register opener');
  // drawn by the reference's classes alone: no colour, no computed class, no house utility, nothing inline
  assert.doesNotMatch(hero, RAW_COLOUR, 'no colour typed in the hero');
  assert.doesNotMatch(hero, /className=\{/, 'every class in the band is a plain string — none is computed');
  assert.ok(!hero.includes('style='), 'no inline style');
  for (const cls of classesOf(hero)) assert.ok(cls.startsWith('ts-'), `${cls}: the hero wears the reference's classes only`);
  const ruled = portClasses();
  for (const cls of new Set(classesOf(hero))) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule in globals.css — the class itself, not one that starts like it`);
});

// ── T5 · THE BAR'S WORDS AND LINKS ───────────────────────────────────────────

test('T5 the bar: the three pillars, each by its own name and on its own section — no name and no id typed in the bar; Pricing; the gold mark; GitHub and "create account" gone; no colour typed', () => {
  assert.deepEqual(BAR_PRODUCT_LINKS, [
    { label: 'Financial Software', href: '/#modules' },
    { label: 'Professional Services', href: '/#services' },
    { label: 'Travel Marketplace', href: '/#demo' },
  ]);
  assert.deepEqual(BAR_PRODUCT_LINKS.map((l) => l.href), [`/#${MODULES_ANCHOR}`, `/#${SERVICES_ANCHOR}`, `/#${DEMO_ANCHOR}`], 'each built from its section\'s anchor');
  assert.deepEqual(BAR_PRODUCT_LINKS.map((l) => l.label), [PLAN_PILLAR.heading, BUILD_PILLAR.heading, EXPLORE_PILLAR.heading], 'each label is its pillar\'s heading — the design\'s three words are the pillars\' names (PILLAR-NAMES-01)');
  assert.deepEqual(BAR_PRODUCT_LINKS.map((l) => ({ label: l.label, href: l.href })), FOOTER_SERVICES_LINKS.map((l) => ({ label: l.label, href: l.href })), 'the same three names on the same three sections as the footer\'s SERVICES column, in its order');
  assert.deepEqual(BAR_PRICING, { label: 'Pricing', href: '/how-pricing-works' });
  assert.equal(BAR_MARK_SRC, '/brand/temple-stuart-crest-gold.png');
  assert.ok(existsSync(resolve(ROOT, `public${BAR_MARK_SRC}`)), 'the mark is a file in public/');
  const header = code(HEADER);
  assert.match(header, /^import \{ DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR \} from '@\/lib\/homeAnchors';$/m, 'the three ids come from their one home');
  assert.match(header, /^import \{ BUILD_PILLAR, EXPLORE_PILLAR, PLAN_PILLAR \} from '@\/lib\/homeActWords';$/m, 'the three names come from theirs');
  for (const [pillar, anchor] of [['PLAN_PILLAR', 'MODULES_ANCHOR'], ['BUILD_PILLAR', 'SERVICES_ANCHOR'], ['EXPLORE_PILLAR', 'DEMO_ANCHOR']] as const) {
    assert.ok(header.includes(`{ label: ${pillar}.heading, href: \`/#\${${anchor}}\` },`), `${pillar}'s heading → /#\${${anchor}}`);
  }
  assert.doesNotMatch(header, /#(modules|services|demo|events|my-trip|stop-0)\b/, 'no section id is typed in the bar');
  assert.doesNotMatch(header, /id="/, 'and it declares none');
  for (const name of ['Financial Software', 'Professional Services', 'Travel Marketplace']) assert.ok(!header.includes(name), `"${name}" is not typed in the bar — it is read from the pillar`);
  assert.equal(count(header, "'Pricing'"), 1, '"Pricing" is typed once — the bar\'s row and the menu draw the same link');
  // gone, by Alex's ruling
  assert.doesNotMatch(header, /github/i, 'no GitHub link in the bar');
  assert.doesNotMatch(header, /create (free )?account/i, 'no create-account button in the bar');
  assert.doesNotMatch(header, /onRequireAuth/, 'and no register opener among its props');
  assert.ok(!header.includes('temple-stuart-crest.png'), 'the white-ground crest is not the bar\'s mark');
  // drawn by the reference's classes alone
  assert.doesNotMatch(header, RAW_COLOUR, 'no colour typed in the bar');
  assert.ok(!header.includes('style='), 'no inline style');
  // one class in the bar is computed — the header's own, its two fills — and every other is a plain string
  assert.equal(count(header, 'className={'), 1, 'one computed class in the bar');
  assert.equal(count(header, "<header className={glass ? 'ts-bar ts-bar--overlay' : 'ts-bar ts-bar--solid'}>"), 1, 'the header\'s: glass or filled, nothing else chosen');
  const worn = [...classesOf(header), 'ts-bar', 'ts-bar--overlay', 'ts-bar--solid'];
  for (const cls of worn) assert.ok(cls.startsWith('ts-'), `${cls}: the bar wears the reference's classes only`);
  const ruled = portClasses();
  for (const cls of new Set(worn)) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule in globals.css — the class itself, not one that starts like it`);
});

// ── T6 · ONE PILL, TWO FILLS; LOG IN'S TWO MODES ─────────────────────────────

test('T6 rendered: filled is the default and glass is asked for; Log in is a button where a login opener is given and a link to / where none is; the phone menu repeats the bar and starts closed', () => {
  const PRODUCTS = ['/#modules', '/#services', '/#demo'];
  const WORDS = 'TEMPLE STUART Financial Software Professional Services Travel Marketplace Pricing Log in Financial Software Professional Services Travel Marketplace Pricing Log in';
  // 1. no props — the four pages with no login modal: filled, Log in a link to the front door
  const plain = render();
  assert.ok(plain.startsWith('<header class="ts-bar ts-bar--solid">'), 'filled, in the page\'s flow, with nothing passed');
  assert.deepEqual(hrefsOf(plain), ['/', ...PRODUCTS, '/how-pricing-works', '/', ...PRODUCTS, '/how-pricing-works', '/'], 'the brand, the three products, Pricing, Log in — then the menu: the three, Pricing, Log in');
  assert.equal(textOf(plain), WORDS, 'the words, in order');
  assert.equal(count(plain, '<a class="ts-pill-gold ts-bar__login" href="/">Log in</a>'), 1, 'Log in: a link to / in the bar');
  assert.equal(count(plain, '<a class="ts-pill-gold ts-menu__login" href="/">Log in</a>'), 1, 'and in the menu');
  assert.equal(count(plain, '<button'), 1, 'the only button is the menu\'s');
  // 2. the landing — glass, Log in a button
  const glass = render({ glass: true, onRequireLogin: () => {} });
  assert.ok(glass.startsWith('<header class="ts-bar ts-bar--overlay">'), 'glass, laid over the hero, when asked');
  assert.deepEqual(hrefsOf(glass), ['/', ...PRODUCTS, '/how-pricing-works', ...PRODUCTS, '/how-pricing-works'], 'the same links; Log in is no link here');
  assert.equal(textOf(glass), WORDS, 'the same words');
  assert.equal(count(glass, '<button type="button" class="ts-pill-gold ts-bar__login">Log in</button>'), 1, 'Log in: a button in the bar');
  assert.equal(count(glass, '<button type="button" class="ts-pill-gold ts-menu__login">Log in</button>'), 1, 'and in the menu');
  // 3. the signed-out cockpit — filled, Log in a button: the fill and the mode are independent
  const cockpit = render({ onRequireLogin: () => {} });
  assert.ok(cockpit.startsWith('<header class="ts-bar ts-bar--solid">'), 'filled with a login opener');
  assert.equal(count(cockpit, '>Log in</button>'), 2, 'Log in: a button, twice');
  assert.equal(cockpit.replace('<header class="ts-bar ts-bar--solid">', '<header class="ts-bar ts-bar--overlay">'), glass, 'the two fills differ by the header\'s class and nothing else');
  for (const html of [plain, glass, cockpit]) {
    const [bar, menu] = halves(html);
    // the pill: mark and wordmark · the three products with a rule between · Pricing · Log in · the menu button
    assert.match(bar, /^<header [^>]*><div class="ts-bar__pill"><a class="ts-brand" href="\/"><img class="ts-brand__mark" src="\/brand\/temple-stuart-crest-gold\.png" alt=""\/><span class="ts-brand__name">TEMPLE STUART<\/span><\/a><nav class="ts-bar__products" aria-label="Products">/, 'the pill opens with the gold mark and the wordmark, then the products');
    assert.equal(count(bar, '<span class="ts-bar__rule" aria-hidden="true"></span>'), 2, 'a hairline rule between the three products');
    assert.equal(count(bar, '<nav class="ts-bar__account" aria-label="Account"><a class="ts-bar__link" href="/how-pricing-works">Pricing</a>'), 1, 'Pricing opens the account group');
    assert.equal(count(bar, `<button type="button" class="ts-bar__menu-button" aria-label="Open menu" aria-expanded="false" aria-controls="${BAR_MENU_ID}">`), 1, 'the menu button says what it does, that the menu is closed, and which element it controls');
    assert.equal(count(bar, `aria-controls="${BAR_MENU_ID}"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 8h16M3 14h16"></path></svg></button>`), 1, 'and draws its two bars — the reference\'s icon, decorative, in the bar\'s ink');
    // the menu: closed, named by the button, the three rows, a rule, Pricing, Log in
    assert.ok(menu.startsWith(`<nav class="ts-menu" id="${BAR_MENU_ID}" aria-label="Menu" hidden="">`), 'the menu starts closed, and is the element the button controls');
    assert.equal(count(html, `id="${BAR_MENU_ID}"`), 1, 'the id is on one element');
    assert.equal(count(menu, 'class="ts-menu__row"'), 4, 'four rows: the three products and Pricing');
    assert.equal(count(menu, '<span class="ts-menu__rule" aria-hidden="true"></span>'), 1, 'one rule');
    assert.ok(menu.indexOf('ts-menu__rule') > menu.indexOf('/#demo') && menu.indexOf('ts-menu__rule') < menu.indexOf('/how-pricing-works'), 'the rule stands between the products and Pricing');
    assert.doesNotMatch(html, /github|create (free )?account/i, 'no GitHub link and no create-account button anywhere in the bar');
    assert.equal(count(html, '<header'), 1, 'one header');
  }
});

// ── T7 · THE MENU'S STATE ────────────────────────────────────────────────────

test('T7 the phone menu: open or closed is React state and nothing else; it closes on a link, on Log in, on Escape and on the button', () => {
  const header = code(HEADER);
  assert.match(header, /^'use client';/, 'a client component — it holds state');
  assert.equal(count(header, 'const [menuOpen, setMenuOpen] = useState(false);'), 1, 'one state: closed to start');
  assert.equal(count(header, 'useState('), 1, 'and no other');
  assert.doesNotMatch(header, /localStorage|sessionStorage|indexedDB|\.cookie|useSearchParams|usePathname|useRouter|location\.|history\.|\bfetch\(/, 'no storage, no cookie, no URL, no call');
  assert.ok(header.includes('hidden={!menuOpen}'), 'the menu is hidden while closed');
  assert.ok(header.includes("aria-label={menuOpen ? 'Close menu' : 'Open menu'}") && header.includes('aria-expanded={menuOpen}') && header.includes('aria-controls={BAR_MENU_ID}') && header.includes('id={BAR_MENU_ID}'), 'the button says which it is, and which element it controls');
  assert.ok(header.includes('onClick={() => setMenuOpen((open) => !open)}'), 'the button opens and closes it');
  assert.ok(header.includes("onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}"), 'a press on any link in it closes it');
  assert.ok(header.includes('onClick={() => { setMenuOpen(false); onRequireLogin(); }}'), 'Log in closes it, then opens the login');
  // the bar's own Log in (from 1024px) calls the login opener — the rendered markup in T6 cannot show a handler, so it is held here
  assert.equal(count(flat(header), '<button type="button" onClick={onRequireLogin} className="ts-pill-gold ts-bar__login">Log in</button>'), 1, 'the bar\'s Log in calls the login opener');
  assert.equal(count(header, 'onRequireLogin'), 6, 'the opener is named six times: the prop, its type, the two mode tests and the two calls — and wired nowhere else');
  // what the bar imports is everything it can reach: React's three, next/link, the anchors, the pillars' names and — since FOOTER-02 (2026-11-12) —
  // the lockup's leaf, src/lib/brandLockup.ts: the mark and the wordmark, which the footer reads there too (this file is 'use client', and its
  // exports reach a server component as client references, so the two moved to a plain leaf). A new import is a new dependency of every page that
  // mounts the bar (and the only way state could leave this file unseen). Until FOOTER-02 the list was the first four lines below — 'the bar
  // imports these four lines and nothing else'.
  assert.deepEqual(header.split('\n').filter((line) => /^import\b/.test(line)), [
    "import { Fragment, useEffect, useState } from 'react';",
    "import Link from 'next/link';",
    "import { DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR } from '@/lib/homeAnchors';",
    "import { BUILD_PILLAR, EXPLORE_PILLAR, PLAN_PILLAR } from '@/lib/homeActWords';",
    "import { BAR_MARK_SRC, BAR_WORDMARK } from '@/lib/brandLockup';",
  ], 'the bar imports these five lines and nothing else');
  assert.doesNotMatch(code('src/lib/brandLockup.ts'), /^\s*(import\b|['"]use )/m, 'and the lockup\'s leaf imports nothing and carries no directive — no state can leave through it');
  assert.match(header, /useEffect\(\(\) => \{\s*if \(!menuOpen\) return;\s*const closeOnEscape = \(e: KeyboardEvent\) => \{ if \(e\.key === 'Escape'\) setMenuOpen\(false\); \};\s*document\.addEventListener\('keydown', closeOnEscape\);\s*return \(\) => document\.removeEventListener\('keydown', closeOnEscape\);\s*\}, \[menuOpen\]\);/, 'Escape closes it; the listener is on only while it is open, and is taken off again');
  assert.equal(count(header, 'useEffect('), 1, 'one effect');
  // the menu's id is typed, never generated: useId gave the server and the browser different ids on the landing (a hydration mismatch)
  assert.equal(BAR_MENU_ID, 'ts-bar-menu');
  assert.doesNotMatch(header, /\buseId\b/, 'no generated id');
  const ids = srcFiles(resolve(ROOT, 'src')).filter((f) => code(f).includes(`'${BAR_MENU_ID}'`) || code(f).includes(`"${BAR_MENU_ID}"`));
  assert.deepEqual(ids, [HEADER], 'and no other file under src (outside __tests__) types it — one element wears it');
  // the stylesheet shows the panel only under 1024px and only while it is not hidden
  const port = declarations(portCss());
  assert.ok(port.includes(' | .ts-menu | display: none'), 'from 1024px the menu is never drawn');
  assert.ok(port.includes('@media (max-width: 1023.98px) | .ts-menu:not([hidden]) | display: flex'), 'under it, only while open');
  assert.ok(port.includes('@media (max-width: 1023.98px) | .ts-bar__products, .ts-bar__account | display: none') && port.includes('@media (max-width: 1023.98px) | .ts-bar__menu-button | display: inline-flex'), 'under 1024px the links fold behind the one button');
  assert.ok(port.includes(' | .ts-bar__menu-button | width: 44px') && port.includes(' | .ts-bar__menu-button | height: 44px'), 'a 44px button');
});

// ── T8 · THE SIX MOUNTS ──────────────────────────────────────────────────────

test('T8 six mounts: the landing asks for glass; the other five pass nothing new — four of them nothing at all; no mount hands the bar a register opener; there is no seventh', () => {
  const mountOf = (file: string): string => {
    const src = code(file);
    assert.equal(count(src, '<LandingHeader'), 1, `${file} mounts the bar once`);
    const at = src.indexOf('<LandingHeader');
    return flat(src.slice(at, src.indexOf('/>', at) + 2));
  };
  assert.equal(mountOf(LANDING), '<LandingHeader glass onRequireLogin={onRequireLogin} />', 'the landing: glass, and its login opener');
  assert.equal(mountOf(HOME_CLIENT), "<LandingHeader onRequireLogin={() => { setLoginMode('login'); setShowLogin(true); }} />", 'the signed-out cockpit: filled, and its login opener');
  // the two lines above and the one below pin each mount whole: none of the five asks for glass, and none of the six hands the bar a register opener
  for (const file of OTHER_MOUNTS.slice(1)) assert.equal(mountOf(file), '<LandingHeader />', `${file}: filled, Log in a link — nothing passed`);
  const mounts = srcFiles(resolve(ROOT, 'src')).filter((f) => f !== HEADER && code(f).includes('<LandingHeader')).sort();
  assert.deepEqual(mounts, [LANDING, ...OTHER_MOUNTS].sort(), 'six files mount the bar');
  // and six files import it — under whatever name: a seventh mount cannot hide behind an alias
  const importers = srcFiles(resolve(ROOT, 'src')).filter((f) => f !== HEADER && /from\s+['"](?:[^'"]*\/)?LandingHeader['"]/.test(code(f))).sort();
  assert.deepEqual(importers, [LANDING, ...OTHER_MOUNTS].sort(), 'the same six import it, and no seventh');
  for (const f of importers) assert.match(code(f), /^import LandingHeader from ['"](?:[^'"]*\/)?LandingHeader['"];$/m, `${f} imports it under its own name`);
  // the glass bar is positioned against the band it lies over, so nothing above the landing can come between them
  const port = declarations(portCss());
  assert.ok(port.includes(' | .ts-hero | position: relative') && port.includes(' | .ts-bar--overlay | position: absolute'), 'glass: absolute, inside the band');
  assert.ok(port.includes(' | .ts-bar--solid | position: relative'), 'filled: in the page\'s flow');
});

// ── T9 · CREATE ACCOUNT FROM LOG IN ──────────────────────────────────────────

test('T9 "create account" is still reachable from Log in: the one LoginBox switches itself to register; the landing\'s and the cockpit\'s Log in open it; the hero still opens it in register mode', () => {
  const box = code(LOGIN_BOX);
  assert.match(box, /const \[mode, setMode\] = useState<'login' \| 'register'>\(initialMode\);/, 'the box opens in the mode it is given');
  assert.match(box, /const switchMode = \(\) => \{\s*setMode\(mode === 'login' \? 'register' : 'login'\);/, 'and switches itself');
  const switcher = /<button\s+type="button"\s+onClick=\{switchMode\}[^>]*data-auth-switch=\{mode === 'login' \? 'register' : 'login'\}[^>]*>([\s\S]*?)<\/button>/.exec(box);
  assert.ok(switcher, 'the switch is a button under the form, in both modes');
  assert.ok(switcher[1].includes('"Don\'t have an account? Sign up free"'), 'in login mode it reads "Don\'t have an account? Sign up free"');
  assert.equal(count(box, 'onClick={switchMode}'), 1, 'one switch');
  const guest = code(GUEST);
  assert.ok(guest.includes("onRequireLogin={() => { setLoginMode('login'); setShowLogin(true); }}"), 'the landing\'s Log in opens the box in login mode');
  assert.ok(guest.includes("onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }}"), 'the landing\'s register asks open it in register mode');
  assert.match(guest, /\{showLogin && \([\s\S]*?<LoginBox[\s\S]*?initialMode=\{loginMode\}/, 'one box, mounted when asked for, in the asked mode');
  const cockpit = code(HOME_CLIENT);
  assert.match(cockpit, /\{showLogin && \([\s\S]*?<LoginBox[\s\S]*?initialMode=\{loginMode\}/, 'the cockpit\'s Log in opens its own');
  assert.equal(count(heroOf(code(LANDING)), 'onClick={onRequireAuth}'), 1, 'and the hero\'s "Create free account" is the register opener');
});

// ── T10 · #modules HAS ONE HOME ──────────────────────────────────────────────

test('T10 #modules has one home: MODULES_ANCHOR in src/lib/homeAnchors.ts, read by the bar and by the footer\'s first link; it equals the how-to\'s own section id', () => {
  assert.equal(MODULES_ANCHOR, 'modules');
  assert.match(code(ANCHORS), /^export const MODULES_ANCHOR = 'modules';$/m, 'typed once, in the anchors\' home');
  assert.ok(code(HOW_TO).includes(`<section id="${MODULES_ANCHOR}"`), 'the how-to\'s <section> wears it — that literal is the plan law\'s, and these two are held equal here');
  const words = code(FOOTER_WORDS);
  assert.match(words, /^import \{ DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR, STOP_ZERO_ANCHOR \} from '\.\/homeAnchors';$/m, 'the footer reads it from the same home');
  assert.ok(words.includes("{ label: 'Financial Software', href: `/#${MODULES_ANCHOR}` },"), 'for its first SERVICES link');
  assert.doesNotMatch(words, /'modules'|PLANS_SECTION_ID/, 'the footer\'s private copy is gone');
  assert.equal(FOOTER_SERVICES_LINKS[0].href, '/#modules', 'and the footer\'s link is what it was');
  assert.match(code(HEADER), /^import \{ DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR \} from '@\/lib\/homeAnchors';$/m, 'the bar reads it from the same home');
  assert.ok(code(HEADER).includes('href: `/#${MODULES_ANCHOR}` },'), 'for its first link');
  assert.equal(BAR_PRODUCT_LINKS[0].href, FOOTER_SERVICES_LINKS[0].href, 'the bar\'s first link and the footer\'s land on the one section');
  // any constant, whatever its name. (The word is typed in two more places, both the plan law's and neither a constant: the how-to's
  // id literal, held equal above, and the plans section's default headingId prop.)
  const typed = srcFiles(resolve(ROOT, 'src')).filter((f) => /\b[A-Z][A-Z0-9_]*\s*=\s*'modules'/.test(code(f)));
  assert.deepEqual(typed, [ANCHORS], 'no second constant holds it');
});

// ── T11 · GITHUB'S MARK ──────────────────────────────────────────────────────

test('T11 GitHub\'s mark is a file — public/logos/github.svg, in the folder\'s form — drawn through a mask in the button\'s ink at 20px (17px under 1024px); decorative; its path typed in no .ts or .tsx file under src outside __tests__', () => {
  assert.ok(existsSync(resolve(ROOT, GITHUB)), `${GITHUB} is in the tree`);
  assert.equal(size(GITHUB), 838);
  assert.equal(digest(GITHUB), 'cb0a639761421ae629b1f40786b301f3b7bac385206948329323a35ef45a9f08', 'the file as fetched — simple-icons 16.37.0, with the folder\'s fill attribute and closing newline; its path data untouched');
  assert.equal(comments(GITHUB).trim(), '', 'nothing in it reads as a comment, so code() is the whole file');
  const svg = code(GITHUB);
  assert.match(svg, /^<svg role="img" viewBox="0 0 24 24" xmlns="http:\/\/www\.w3\.org\/2000\/svg" fill="#ffffff"><title>GitHub<\/title><path d="[^"<>]+"\/><\/svg>\n$/, 'the folder\'s form: one <title>, one <path>, the root filled white');
  // Only this file is held to that form. The folder is the Built-on wall's drop point (src/lib/builtOnWall.ts, DROP CONVENTION): a vendor's official
  // file lands there as the vendor ships it, and must not turn this test red.
  const port = declarations(portCss());
  for (const decl of ['flex: none', 'width: 20px', 'height: 20px', 'background-color: currentColor', 'mask: url(/logos/github.svg) center / contain no-repeat']) {
    assert.ok(port.includes(` | .ts-github-mark | ${decl}`), `.ts-github-mark { ${decl} }`);
  }
  for (const decl of ['width: 17px', 'height: 17px']) assert.ok(port.includes(`@media (max-width: 1023.98px) | .ts-github-mark | ${decl}`), `under 1024px: ${decl}`);
  assert.equal(port.filter((l) => l.includes('.ts-github-mark')).length, 7, 'and nothing else');
  const hero = heroOf(code(LANDING));
  assert.equal(count(hero, '<span className="ts-github-mark" aria-hidden="true" />'), 1, 'one mark, decorative, on the second button');
  assert.ok(hero.indexOf('ts-github-mark') > hero.indexOf('ts-cta-secondary') && hero.indexOf('ts-github-mark') < hero.indexOf('Clone it on GitHub'), 'before its label');
  for (const f of [LANDING, HEADER]) assert.ok(!code(f).includes('/logos/'), `${f} types no path under /logos/ — the stylesheet names the file`);
  assert.deepEqual(srcFiles(resolve(ROOT, 'src')).filter((f) => code(f).includes('/logos/github')), [], 'no .ts or .tsx file under src (outside __tests__) types the mark\'s path');
  assert.doesNotMatch(hero, /<path d="M12 /, 'the mark is not drawn inline');
});

// ── T12 · THE LAW'S DOOR ─────────────────────────────────────────────────────

test('T12 the reachability law\'s door to /how-pricing-works cites the line the bar\'s Pricing link is defined on — read by content', () => {
  const law = code(LAW);
  // the house's form lists the newest re-cite first — "(NEXT, date: was :89; HERO-CREST-01, 2026-11-11: was :52 — …)" — so this note may stand anywhere in the parentheses
  const cited = /\{ route: '\/how-pricing-works', why: 'LandingHeader\.tsx:(\d+) \([^')]*HERO-CREST-01, 2026-11-11: was :52[^')]*\), LandingFooter\.tsx:/.exec(law);
  assert.ok(cited, 'GUEST_ROUTES cites a line of LandingHeader.tsx for /how-pricing-works, and its note still says what the line was before HERO-CREST-01 (:52)');
  const line = code(HEADER).split('\n')[Number(cited[1]) - 1];
  assert.equal(line, "export const BAR_PRICING = { label: 'Pricing', href: '/how-pricing-works' } as const;", `the law cites LandingHeader.tsx:${cited[1]} — that line must be BAR_PRICING's (re-cite the law's GUEST_ROUTES row when the bar's lines move)`);
  assert.equal(count(code(HEADER), 'href={BAR_PRICING.href}'), 2, 'drawn twice — the bar and its menu');
});

// ── T13 · THE RULINGS ────────────────────────────────────────────────────────

test('T13 Alex\'s three removals are quoted where each was made, and the design is named where it is built', () => {
  const header = flat(comments(HEADER).replace(/^\s*\*/gm, ' '));
  assert.ok(header.includes('"remove github, the icon is enough, we dont need it 2x"'), 'the bar: GitHub ↗');
  assert.ok(header.includes('"create free account top right, that can be login… we dont need it twice"'), 'the bar: CREATE FREE ACCOUNT');
  const landing = flat(comments(LANDING));
  assert.ok(landing.includes('"the BSL we have down in the footer, so lets just remove it from the hero"'), 'the hero: the BSL pill');
  for (const [file, notes] of [[HEADER, header], [LANDING, landing], [GLOBALS, flat(comments(GLOBALS))]] as const) {
    assert.ok(notes.includes('HERO-CREST-01 (Alex, design canvas, 2026-11-11)'), `${file} names the design and its date`);
    assert.ok(notes.includes('design-refs/hero-crest-01/Hero-Reference.html'), `${file} names the spec`);
  }
});
