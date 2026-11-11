/**
 * HERO-CREST-01 (Alex, design canvas, 2026-11-11) — THE GUEST LANDING'S HERO AND THE TOP BAR, AS DRAWN.
 *
 * The spec is a file: design-refs/hero-crest-01/Hero-Reference.html ("every value in its stylesheet is the design"), with
 * its README beside it. The hero is src/components/landing/Landing.tsx's band; the bar is
 * src/components/landing/LandingHeader.tsx, on its six mounts; both are drawn by the reference's own stylesheet, ported
 * to the foot of src/app/globals.css.
 *
 *   T1  the handoff landed byte for byte — the README, the reference and the two crest files by sha256; the mark by
 *       size (a PNG does not survive the reader's utf8); the two SVGs hold shapes and gradients only;
 *   T2  the colours are tokens, named and valued as the README's table — the same value in the reference's :root, in
 *       globals.css :root (--ts-<name>) and behind tailwind.config.ts's `hero` and `glass` families; the README's
 *       table and DESIGN.md's carry the same values;
 *   T3  the app's stylesheet IS the reference's — declaration by declaration, in order, but for the five differences
 *       named in globals.css; no hex in it; every variable it reads is declared; nothing follows it in the file and no
 *       rule above it names one of its classes (so the cascade is the port's alone — what a browser's own defaults add
 *       under it, the test cannot see: globals.css names the one place that shows);
 *   T4  the hero, as drawn — the band, the crest's one <picture>, the bar laid over it, the copy; the headline's three
 *       sentences and the subline from src/lib/brandLines.ts; both buttons with the handler and the href they had;
 *       the BSL pill and the arrow glyph gone; no colour and no house utility typed in it;
 *   T5  the bar's words and links — the three pillars, each by its own name (its heading, src/lib/homeActWords.ts —
 *       never typed in the bar) on its own section (its anchor, src/lib/homeAnchors.ts — never a typed id); Pricing;
 *       the gold mark; "GitHub" and "create account" gone;
 *   T6  one pill, two fills, and Log in's two modes — rendered: filled is the default, glass is asked for; a button
 *       where a login opener is given, a link to '/' where none is; the menu repeats the bar and starts closed;
 *   T7  the phone menu's open-or-closed is React state and nothing else; it closes on a link, on Log in, on Escape
 *       and on the button;
 *   T8  six mounts — the landing asks for glass, the other five pass nothing new, four of them nothing at all; no
 *       mount hands the bar a register opener; no seventh mount;
 *   T9  "create account" is still reachable from Log in — the one LoginBox's own switch, and the openers that reach it;
 *   T10 #modules has one home — MODULES_ANCHOR, read by the bar and by the footer; it equals the how-to's own id;
 *   T11 GitHub's mark — public/logos/github.svg, in the form the folder's Simple Icons files have (only this file is
 *       held to it: the Built-on wall's own files may be dropped in whatever form their vendors ship), drawn through a
 *       mask in the button's ink, 20px (17px under 1024px), decorative; its path typed in no component;
 *   T12 the reachability law's door to /how-pricing-works cites the line the bar's Pricing link is defined on — read
 *       by content, so the citation cannot drift;
 *   T13 the rulings are on the page — each of Alex's three removals quoted where it was made.
 *
 * Source is read through code() and comments() only (the reader law). rejoin() is used for whole-file digests alone —
 * every pattern here reads code().
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

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/hero-crest-01/README.md';
const REFERENCE = 'design-refs/hero-crest-01/Hero-Reference.html';
const CREST_DESKTOP = 'public/brand/hero-crest-desktop.svg';
const CREST_MOBILE = 'public/brand/hero-crest-mobile.svg';
const MARK = 'public/brand/temple-stuart-crest-gold.png';
const GITHUB = 'public/logos/github.svg';
const GLOBALS = 'src/app/globals.css';
const TAILWIND = 'tailwind.config.ts';
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
  assert.ok(at > -1 && count(css, ':root {') === 1, 'one :root in globals.css');
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
/** The README's glass row writes the line as the fill's white at another alpha — "`rgb(255 255 255 / 0.10)` fill · `/ 0.22` line" — so that is what is looked for there. */
const README_WRITES: Readonly<Record<string, string>> = { 'glass-line': '`/ 0.22` line' };
/** A colour the design draws at an alpha is stored as three channels; one it only draws solid, as written. */
const isChannels = (value: string): boolean => /^\d+ \d+ \d+$/.test(value);

// ── the hero's markup ────────────────────────────────────────────────────────

const HERO_OPEN = '<div className="ts-hero">';
const HERO_CLOSE = '        </section>\n      </div>';
/** The band, from its opening tag to its close — Landing.tsx's code, comments removed. */
function heroOf(landing: string): string {
  const from = landing.indexOf(HERO_OPEN);
  const to = landing.indexOf(HERO_CLOSE, from);
  assert.ok(from > -1 && to > from, 'the band opens once and closes after its one <section>');
  assert.equal(count(landing, HERO_OPEN), 1, 'one band');
  return landing.slice(from, to + HERO_CLOSE.length);
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

test('T1 the five handoff files are in the tree byte for byte — the README, the reference and the two crest files by sha256, the mark by size; the two SVGs hold shapes and gradients only', () => {
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
  // A PNG is not text: the reader decodes utf8, so its bytes cannot be digested here. Its presence and exact size are held.
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

test('T2 the design\'s colours are tokens, named and valued as the README\'s table: the reference\'s :root, globals.css :root (--ts-<name>) and tailwind.config.ts\'s hero and glass families hold the same nineteen', () => {
  assert.equal(TOKENS.length, 19);
  assert.equal(new Set(TOKENS.map(([name]) => name)).size, 19, 'nineteen names');
  // the reference's own :root — the nineteen colours and its two geometry properties, nothing else
  const refRoot = new Map(declarations(referenceCss()).filter((d) => d.startsWith(' | :root | ')).map((d) => {
    const decl = d.split(' | ')[2];
    return [decl.slice(0, decl.indexOf(':')), decl.slice(decl.indexOf(':') + 1).trim()] as const;
  }));
  assert.deepEqual([...refRoot.keys()].sort(), [...TOKENS.map(([name]) => `--${name}`), '--crest-x', '--crest-w'].sort(), 'the reference declares these nineteen colours and its two geometry properties');
  const root = rootTokens();
  const tailwind = code(TAILWIND);
  const readme = code(README);
  const designDoc = code('DESIGN.md');
  for (const [name, value] of TOKENS) {
    assert.ok(designDoc.includes(`\`${value}\``), `DESIGN.md's table carries ${name}'s value, ${value}`);
    assert.equal(refRoot.get(`--${name}`), value, `the reference: --${name}`);
    assert.equal(root.get(`--ts-${name}`), value, `globals.css :root: --ts-${name} — the reference's value, the house prefix`);
    assert.ok(readme.includes(README_WRITES[name] ?? `\`${value}\``), `the README's table carries ${name}'s value, ${value}`);
    const [family, ...rest] = name.split('-');
    const key = rest.join('-');
    const mapped = isChannels(value) ? `rgb(var(--ts-${name}) / <alpha-value>)` : `var(--ts-${name})`;
    const entry = new RegExp(`(?:'${key}'|[\\s{]${key}): '${mapped.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}',`);
    const familyAt = tailwind.indexOf(`        ${family}: {`);
    assert.ok(familyAt > -1, `tailwind.config.ts has the ${family} family`);
    assert.match(tailwind.slice(familyAt, tailwind.indexOf('},', familyAt)), entry, `tailwind.config.ts: ${family}.${key} → ${mapped}`);
  }
  // nothing else wears the two prefixes, and no value is typed twice under a second name
  const ours = [...root.keys()].filter((k) => k.startsWith('--ts-hero-') || k.startsWith('--ts-glass-')).sort();
  assert.deepEqual(ours, TOKENS.map(([name]) => `--ts-${name}`).sort(), 'the nineteen, and no twentieth');
  for (const family of ['hero', 'glass']) {
    const at = tailwind.indexOf(`        ${family}: {`);
    const keys = [...tailwind.slice(at, tailwind.indexOf('},', at)).matchAll(/^\s+(?:'([a-z0-9-]+)'|([a-z0-9-]+)): '/gm)].map((m) => `${family}-${m[1] ?? m[2]}`).sort();
    assert.deepEqual(keys, TOKENS.map(([name]) => name).filter((n) => n.startsWith(`${family}-`)).sort(), `the ${family} family holds its tokens and nothing else`);
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
  // the cascade is the port's alone: no rule above it names one of its classes (a restyle from a few lines up would pass the equality)
  const whole = code(GLOBALS);
  const above = declarations(whole.slice(0, whole.indexOf('.ts-hero {')).replace(/@tailwind [a-z]+;/g, ''));
  const PORT_CLASS = /\.ts-(?:hero|bar|brand|menu|pill-gold|cta-|github-mark)/;
  assert.deepEqual(above.filter((line) => PORT_CLASS.test(line.split(' | ')[1])), [], 'no rule above the port styles the hero\'s or the bar\'s classes');
  assert.ok(above.some((line) => line.split(' | ')[1] === '.ts-chipfade'), 'the rules above were read (the chip strip\'s is among them)');
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
  assert.match(code('src/app/layout.tsx'), /variable: "--font-mono"/, 'src/app/layout.tsx declares --font-mono (IBM Plex Mono)');
  for (const [name] of TOKENS) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read by the stylesheet — no token without a reader`);
});

// ── T4 · THE HERO ────────────────────────────────────────────────────────────

test('T4 the hero, as drawn: the band, the crest\'s one <picture>, the bar laid over it, the copy; the words from brandLines.ts; both buttons with their handler and href; the BSL pill and the arrow glyph gone; no colour typed', () => {
  const landing = code(LANDING);
  const hero = heroOf(landing);
  // the band's children, in the reference's order
  const order = ['<picture className="ts-hero__crest">', '<LandingHeader glass onRequireLogin={onRequireLogin} />', '<section className="ts-hero__inner" aria-labelledby="hero-title">'];
  for (const part of order) assert.equal(count(hero, part), 1, `${part}, once`);
  const at = order.map((part) => hero.indexOf(part));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the crest, then the bar, then the copy');
  // the crest: one <picture>, so only one file downloads; decorative
  assert.match(hero, /<picture className="ts-hero__crest">\s*<source media="\(min-width: 1024px\)" srcSet="\/brand\/hero-crest-desktop\.svg" \/>\s*<img src="\/brand\/hero-crest-mobile\.svg" alt="" aria-hidden="true" \/>\s*\{\s*\}\s*<\/picture>/, 'the desktop file from 1024px, the mobile file otherwise; alt="" and aria-hidden');
  for (const file of [CREST_DESKTOP, CREST_MOBILE]) assert.ok(hero.includes(`"${file.replace(/^public/, '')}"`), `the hero draws ${file}`);
  assert.equal(count(landing, '/brand/'), 2, 'the two crest files, each named once in this file');
  // the copy
  assert.match(hero, /<h1 className="ts-hero__title" id="hero-title">\s*<span>\{COMPANY_LINE\[0\]\}<\/span>\s*<span>\{COMPANY_LINE\[1\]\}<\/span>\s*<span>\{COMPANY_LINE\[2\]\}<\/span>\s*<\/h1>/, 'the headline: three sentences, three spans — the last is the one the stylesheet inks gold');
  assert.equal(count(landing, '<h1'), 1, 'one h1 on the home page');
  assert.equal(count(landing, 'id="hero-title"'), 1, 'the section is labelled by its headline');
  assert.match(hero, /<p className="ts-hero__subline">\{HERO_SUBLINE\}<\/p>/, 'the subline');
  for (const words of [...COMPANY_LINE, HERO_SUBLINE]) assert.ok(!landing.includes(words), `Landing.tsx types none of "${words.slice(0, 24)}…" — the words are src/lib/brandLines.ts's`);
  // the two buttons, each with what it had
  assert.equal(count(hero, '<button type="button" onClick={onRequireAuth} className="ts-pill-gold ts-cta-primary">Create free account</button>'), 1, '"Create free account" keeps its handler — the register opener');
  const clone = /<a\s+className="ts-cta-secondary"\s+href="([^"]+)"\s+target="_blank"\s+rel="noopener noreferrer"\s*>\s*<span className="ts-github-mark" aria-hidden="true" \/>\s*<span>Clone it on GitHub<\/span>\s*<svg className="ts-cta-arrow" [^>]*aria-hidden="true"><path d="M4\.5 11\.5l7-7M5\.5 4\.5h6v6" \/><\/svg>\s*<\/a>/.exec(hero);
  assert.ok(clone, '"Clone it on GitHub": the mark, the label, then the arrow, in a new tab');
  assert.equal(clone[1], CODE_URL, 'and keeps its href — the repository');
  assert.equal(count(hero, '<button'), 1, 'one button');
  assert.equal(count(hero, '<a'), 1, 'and one link in the band — the bar\'s own are in LandingHeader.tsx');
  // gone, by Alex's ruling
  for (const gone of ['✦', 'Source-available', 'BSL', 'LICENSE', '↗']) assert.ok(!hero.includes(gone), `the hero carries no ${gone}`);
  assert.ok(!landing.includes('/blob/main/LICENSE'), 'the licence link left this file — the footer\'s Software License is its door');
  assert.ok(!landing.includes('onRequireAuth={onRequireAuth} />\n\n      {/*') && !/<LandingHeader[^>]*onRequireAuth/.test(landing), 'the bar is handed no register opener');
  // drawn by the reference's classes alone: no colour, no house utility, nothing inline
  assert.doesNotMatch(hero, RAW_COLOUR, 'no colour typed in the hero');
  assert.ok(!hero.includes('style='), 'no inline style');
  for (const cls of classesOf(hero)) assert.ok(cls.startsWith('ts-'), `${cls}: the hero wears the reference's classes only`);
  const port = declarations(portCss()).map((l) => l.split(' | ')[1]).join(' ');
  for (const cls of new Set(classesOf(hero))) assert.ok(port.includes(`.${cls}`), `.${cls} has a rule in globals.css`);
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
  for (const cls of [...classesOf(header), ...[...header.matchAll(/'(ts-bar[^']*)'/g)].flatMap((m) => m[1].split(' '))]) assert.ok(cls.startsWith('ts-'), `${cls}: the bar wears the reference's classes only`);
  const port = declarations(portCss()).map((l) => l.split(' | ')[1]).join(' ');
  for (const cls of new Set(classesOf(header))) assert.ok(port.includes(`.${cls}`), `.${cls} has a rule in globals.css`);
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
  assert.match(header, /useEffect\(\(\) => \{\s*if \(!menuOpen\) return;\s*const closeOnEscape = \(e: KeyboardEvent\) => \{ if \(e\.key === 'Escape'\) setMenuOpen\(false\); \};\s*document\.addEventListener\('keydown', closeOnEscape\);\s*return \(\) => document\.removeEventListener\('keydown', closeOnEscape\);\s*\}, \[menuOpen\]\);/, 'Escape closes it; the listener is on only while it is open, and is taken off again');
  assert.equal(count(header, 'useEffect('), 1, 'one effect');
  // the menu's id is typed, never generated: useId gave the server and the browser different ids on the landing (a hydration mismatch)
  assert.equal(BAR_MENU_ID, 'ts-bar-menu');
  assert.doesNotMatch(header, /\buseId\b/, 'no generated id');
  const ids = srcFiles(resolve(ROOT, 'src')).filter((f) => code(f).includes(`'${BAR_MENU_ID}'`) || code(f).includes(`"${BAR_MENU_ID}"`));
  assert.deepEqual(ids, [HEADER], 'and no other file types it — one element wears it');
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
  for (const file of OTHER_MOUNTS.slice(1)) assert.equal(mountOf(file), '<LandingHeader />', `${file}: filled, Log in a link — nothing passed`);
  for (const file of OTHER_MOUNTS) assert.doesNotMatch(mountOf(file), /glass/, `${file} does not ask for glass`);
  for (const file of [LANDING, ...OTHER_MOUNTS]) assert.doesNotMatch(mountOf(file), /onRequireAuth/, `${file} hands the bar no register opener`);
  const mounts = srcFiles(resolve(ROOT, 'src')).filter((f) => f !== HEADER && code(f).includes('<LandingHeader')).sort();
  assert.deepEqual(mounts, [LANDING, ...OTHER_MOUNTS].sort(), 'six files mount the bar');
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
  const typed = srcFiles(resolve(ROOT, 'src')).filter((f) => /_ANCHOR = 'modules'|_ID = 'modules'/.test(code(f)));
  assert.deepEqual(typed, [ANCHORS], 'no second constant holds it');
});

// ── T11 · GITHUB'S MARK ──────────────────────────────────────────────────────

test('T11 GitHub\'s mark is a file — public/logos/github.svg, in the folder\'s form — drawn through a mask in the button\'s ink at 20px (17px under 1024px); decorative; its path typed in no component', () => {
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
  assert.doesNotMatch(hero, /<path d="M12 /, 'the mark is not drawn inline');
});

// ── T12 · THE LAW'S DOOR ─────────────────────────────────────────────────────

test('T12 the reachability law\'s door to /how-pricing-works cites the line the bar\'s Pricing link is defined on — read by content', () => {
  const law = code(LAW);
  const cited = /\{ route: '\/how-pricing-works', why: 'LandingHeader\.tsx:(\d+) \(HERO-CREST-01, 2026-11-11: was :52[^')]*\), LandingFooter\.tsx:/.exec(law);
  assert.ok(cited, 'GUEST_ROUTES cites the header\'s line, dated, with what it was');
  const line = code(HEADER).split('\n')[Number(cited[1]) - 1];
  assert.equal(line, "export const BAR_PRICING = { label: 'Pricing', href: '/how-pricing-works' } as const;", `LandingHeader.tsx:${cited[1]} is the Pricing link`);
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
