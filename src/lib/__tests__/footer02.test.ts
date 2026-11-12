/**
 * FOOTER-02 (Alex, design canvas: his ask, 2026-11-12 22:44 Manila — "… all thats left to touch up is the footer!!!"; the board approved at
 * 23:30 — "lets get the hand off! yeet yett! i like it!"; his footer note of 2026-11-10 still stands — "Less text. Higher impact. A clean,
 * professional presentation.") — THE PUBLIC FOOTER IN THE HERO'S VIOLET, AS DRAWN.
 *
 * The spec is a file: design-refs/footer-02/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is the
 * footer"), with its README beside it. The footer is src/components/landing/LandingFooter.tsx, on its five mounts; its words are
 * src/lib/footerWords.ts's and LandingFooter.tsx's own, as they stood; its lockup's mark and wordmark are src/lib/brandLockup.ts's, which the
 * top bar reads too; its stylesheet is the reference's own, ported to src/app/globals.css's FOOTER-02 block under the house prefix.
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two;
 *   T2 the tokens — the README's two tables, eight already in the app and one HOME-PLANS-04 brought; the reference's :root holds those nine
 *      and the page's own --bg, and no other; each of the nine is the app's token by the same name behind the house prefix, with the same
 *      value, declared once; the port reads the nine and nothing else but the two font variables; no token is new;
 *   T3 the stylesheet — globals.css's FOOTER-02 block IS the reference's, declaration by declaration and in order, after the renames (.ft →
 *      .ts-ft and each .ft-* → .ts-ft-*, var(--x) → var(--ts-x), the two families → var(--font-sans) and var(--font-mono)), but for what is
 *      not ported (its :root and "THIS PAGE'S OWN"); the four width tiers as they stand; no hex and no rgb value typed; every class behind
 *      the prefix and the footer's own; the lockup's own rules, which do not shrink; it stands directly above HERO-CREST-01's header, which
 *      stays last; nothing outside it reaches the footer — not by its classes, its hooks or the elements it draws;
 *   T4 the markup — the footer's render is the reference's <footer>, token for token (classes behind the house prefix, attributes in any
 *      order), but for the crest's src (the reference reads the file from its place in the repo; the app serves it from public/); every
 *      class the port rules is worn, and every class worn is ruled but the two the reference itself draws without a rule;
 *   T5 the structure, by name — the lockup (next/link to /, the gold mark, the wordmark); the four hooks in order, each a <div> with its
 *      label <p> and its <ul>; one stop row per footerStoryLinks label, each two spans with a space between; the five socials, each icon
 *      aria-hidden in currentColor; the ↗ on exactly the external Record links, aria-hidden in currentColor; the hairline; the disclaimer;
 *      ©; the four links on their targets; next/link for every link that stays on the site (TERMS and PRIVACY too, plain <a>s until
 *      FOOTER-02), a plain <a> for every one that leaves;
 *   T6 the words — every word from its home, and none typed twice: the columns' from footerWords.ts; the mark and the wordmark from
 *      brandLockup.ts, read there by the bar and the footer and typed nowhere else in src but the day card's own BRAND_WORDS; the
 *      disclaimer, © and the four links typed once, in LandingFooter.tsx; the footer reads nothing from LandingHeader.tsx ('use client');
 *   T7 the split — storyLinkParts splits every footerStoryLinks label into its stop and its place, and refuses by name
 *      (FooterStoryLabelError), naming the label, one with no " | " or with two;
 *   T8 the mounts — five, as they were: three server pages and two client modules; the footer carries no directive, and imports only
 *      plain modules.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript), the README and the order of globals.css's block headers. No clock, no live
 * call. What a browser must show — the footer at 1440 and 390 against the reference at the same widths — cannot be held here; it is in
 * the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { WAS_HERE } from '../wasHere';
import { BAR_MARK_SRC, BAR_WORDMARK } from '../brandLockup';
import {
  FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS, FOOTER_SOCIALS, FOOTER_SOCIALS_LABEL, FOOTER_STOP_ZERO_LABEL,
  FOOTER_STORY_LABEL, FooterStoryLabelError, footerStoryLinks, storyLinkParts,
} from '../footerWords';
import LandingHeader, { BAR_MARK_SRC as BAR_MARK_SRC_FROM_THE_BAR } from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/footer-02/README.md';
const REFERENCE = 'design-refs/footer-02/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const FOOTER = 'src/components/landing/LandingFooter.tsx';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const WORDS = 'src/lib/footerWords.ts';
const LOCKUP = 'src/lib/brandLockup.ts';
const DAY_CARD = 'src/components/workbench/operations/day/dayCard.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const MODULE_PAGE = 'src/app/modules/[pillar]/ModulePageClient.tsx';
const HOW_IT_WORKS = 'src/app/how-it-works/page.tsx';
const PRICING_PAGE = 'src/app/pricing/page.tsx';
const STOP_PAGE = 'src/app/my-trip/[id]/page.tsx';

/** The disclaimer, word for word, as LandingFooter.tsx has typed it since FD-1d. */
const DISCLAIMER = 'Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor. All tax figures generated by this platform are estimates for informational purposes only and must be verified by a qualified tax professional before filing. Use of this software does not constitute tax advice.';
/** The ↗ the reference draws after a Record link that leaves the site. */
const OUT_ARROW = '<svg class="ts-ft-link__out" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"></path></svg>';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** React's escaping of text, undone — so a word reads the same in the reference's markup and in the render. */
const unescaped = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** What a stretch of markup reads as text: its tags gone, React's escaping undone. */
const textOf = (html: string): string => unescaped(html.replace(/<[^>]*>/g, ''));
/** Every <a> in a stretch of rendered HTML: its href, class, target, rel, inner markup and text — attribute order free. */
const anchorsIn = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
  href: unescaped(/\bhref="([^"]*)"/.exec(attrs)?.[1] ?? ''),
  cls: /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '',
  target: /\btarget="([^"]*)"/.exec(attrs)?.[1] ?? null,
  rel: /\brel="([^"]*)"/.exec(attrs)?.[1] ?? null,
  inner,
  text: textOf(inner),
}));
const render = (): string => renderToStaticMarkup(React.createElement(LandingFooter));
/** Where a word can be typed in code: every string literal and every run of JSX text — so an identifier (FOOTER_SERVICES_LABEL) is not a word. */
const typedRuns = (src: string): string[] => [...src.matchAll(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|>[^<>{}]*</g)].map((m) => m[0]);
const types = (src: string, word: string): boolean => typedRuns(src).some((run) => run.includes(word));
/** Every non-test .ts/.tsx file under src/, repo-relative. */
const srcFiles = (dir = 'src'): string[] => readdirSync(dir).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(rel).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.(ts|tsx)$/.test(name) ? [rel] : [];
});

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>",
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homeAbout01.test.ts's reading, as homePlans04 and homeServices01 have it.)
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
/** The reference's stylesheet, as written: what stands between <style> and </style>. */
function referenceStyle(): string {
  const html = whole(REFERENCE);
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
 * WHAT IS NOT PORTED, in the reference's order (globals.css, the block's header; the README, "When porting": "port every rule but :root
 * and "THIS PAGE'S OWN""): its :root — the colours, every one already the app's token — and the page's own ground and cream strip.
 */
const NOT_PORTED = [':root', 'body', '.ref-page'];
/**
 * The reference's stylesheet as the port writes it — the README's renames, applied to every declaration it ports:
 *   · .ft → .ts-ft, and each .ft-* → .ts-ft-* (.ft__inner → .ts-ft__inner);
 *   · var(--hero-…) → var(--ts-hero-…), and inside rgb(): rgb(var(--hero-bloom) / a), rgb(var(--fs-white) / a) gain the prefix alike;
 *   · 'Inter', sans-serif → var(--font-sans); 'IBM Plex Mono', monospace → var(--font-mono).
 */
function referencePorted(): string[] {
  const all = declarations(uncommented(referenceStyle()));
  const dropped = all.filter((d) => NOT_PORTED.includes(d.split(' | ')[1]));
  assert.deepEqual([...new Set(dropped.map((d) => d.split(' | ')[1]))], NOT_PORTED, 'what is not ported, in the reference\'s order: its :root, then the page\'s own ground and strip');
  return all.filter((d) => !NOT_PORTED.includes(d.split(' | ')[1])).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    const port = decl.replace(/var\(--/g, 'var(--ts-').replace("'Inter', sans-serif", 'var(--font-sans)').replace("'IBM Plex Mono', monospace", 'var(--font-mono)');
    return `${media} | ${sel.replace(/\.ft(?=$|[^A-Za-z0-9])/g, '.ts-ft')} | ${port}`;
  });
}
/** The port: globals.css from the footer's first rule to the hero's — HERO-CREST-01's block, which stays last. */
const PORT_OPEN = '.ts-ft {';
const NEXT_PORT = '.ts-hero {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-ft and runs to the hero\'s first rule');
  return css.slice(at, end);
}
/** HERO-CREST-01's header, at the start of its line — the :root holds a comment that opens the same way, indented. */
const HERO_HEADER = '\n/* ── HERO-CREST-01 (Alex, design canvas, 2026-11-11): THE GUEST HERO AND THE TOP BAR ──';

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

/** THE EIGHT ALREADY IN THE APP — the README's first table: the hero's. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'], ['hero-bloom', '162 107 255'],
  ['hero-ink', '#FAF8F4'], ['hero-ink-nav', '#E8E4F5'], ['hero-gold', '#F6C95C'], ['hero-rim-lilac', '#B9A2FF'],
];
/** THE ONE HOME-PLANS-04 BROUGHT — the README's second table: reused by name and value, added by none. */
const SHARED: ReadonlyArray<readonly [name: string, value: string]> = [['fs-white', '255 255 255']];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text with React's escaping undone; comments and the
 * whitespace that only lays the file out (a run holding a newline) dropped, a lone space between two tags kept. With `prefix`, every
 * class gets the house prefix — the reference's .ft-link is the app's .ts-ft-link. (homeAbout01.test.ts's reading.)
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
/** The reference's footer: from <footer to its </footer>. */
function referenceFooter(): string {
  const html = whole(REFERENCE);
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
  assert.equal(count(body, '<footer'), 1, 'one footer in the reference');
  return body.slice(body.indexOf('<footer'), body.indexOf('</footer>') + '</footer>'.length);
}
/** Where the reference reads the crest: from its own place in the repo, design-refs/footer-02. */
const REFERENCE_MARK = '../../public/brand/temple-stuart-crest-gold.png';

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (footer-02-handoff.zip, 2026-11-12): bytes and sha256 of each. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 13080, '8da4449f7c67f694b69c8a37681fd533bfdfd24fec2a8b4231f7701cba2c5112'],
  [REFERENCE, 17771, 'd5c8e323b00f4aef15ba0e1595b939fa42e0a0e008b96a1a31fecc1e884ccb45'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the folder holds the two', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, 'design-refs/footer-02')).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s two tables — eight already in the app and one HOME-PLANS-04 brought, the same values behind the house prefix, each declared once; the reference\'s --bg is the page\'s own; the port reads the nine and nothing else but the two fonts; none is new', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), KEPT, 'the README\'s first table');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**').map(([n, v]) => [n, v]), SHARED, 'its second');
  assert.ok(whole(README).includes('**New with this footer: none.**'), 'and its word on new tokens: none');
  // the reference declares those nine and the page's own ground above the footer — and no other
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], [['--bg', '250 248 243'], ...[...KEPT, ...SHARED].map(([n, v]) => [`--${n}`, v])], 'the reference\'s :root: --bg, then the nine, in the README\'s order');
  // each of the nine is the app's token by the same name behind the house prefix, with the same value — declared once
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of [...KEPT, ...SHARED]) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal(globals.split('\n').filter((l) => new RegExp(`^\\s*--ts-${name}:`).test(l)).length, 1, `--ts-${name} declared once`);
  }
  // the port reads every one of the nine — no token listed without a reader — and nothing else but the two font variables
  const read = new Set([...portCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  assert.deepEqual([...read].sort(), [...[...KEPT, ...SHARED].map(([n]) => `--ts-${n}`), '--font-mono', '--font-sans'].sort(), 'the nine and the two fonts, and no other');
  assert.ok(!read.has('--ts-bg'), 'the reference\'s --bg is the cream strip above its footer — the page\'s own, not read by the footer');
  const layout = code('src/app/layout.tsx');
  assert.match(layout, /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(layout, /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  assert.match(layout, /weight:\s*\[[^\]]*["']500["'][^\]]*["']600["']/, 'the mono\'s 500 and 600 are loaded — © and the four links at 500, the labels and the stops at 600');
  // "Add none": no custom property is named for the footer, in :root or in the port
  assert.deepEqual([...root.keys()].filter((k) => /^--ts-ft(?:-|$)|footer/i.test(k)), [], 'no token is named for the footer');
  assert.doesNotMatch(portCss(), /(?:^|[\s;{])--[\w-]+\s*:/, 'the port declares no custom property');
});

// ── T3 · THE STYLESHEET ──────────────────────────────────────────────────────

test('T3 the footer\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, after the renames, but for its :root and THIS PAGE\'S OWN; the four width tiers; no hex, no rgb value typed; every class behind the prefix; the lockup does not shrink; directly above HERO-CREST-01\'s header, which stays last; nothing outside it reaches the footer', () => {
  const port = declarations(portCss());
  assert.deepEqual(port, referencePorted(), 'the port is the reference\'s stylesheet, renamed, rule for rule and value for value');
  assert.ok(port.length > 100, `the port was read (${port.length} declarations)`);
  // the four width tiers as they stand — under 640px (no @media), from 640px, from 1024px, from 1280px — then pointer and motion
  assert.deepEqual([...new Set(port.map((d) => d.split(' | ')[0]))], ['', '@media (min-width: 640px)', '@media (min-width: 1024px)', '@media (min-width: 1280px)', '@media (hover: hover)', '@media (prefers-reduced-motion: reduce)'], 'every tier, in the reference\'s order');
  for (const tier of ['@media (min-width: 640px)', '@media (min-width: 1024px)', '@media (min-width: 1280px)']) assert.ok(port.some((d) => d.startsWith(`${tier} | .ts-ft-columns | grid-template-columns:`)), `${tier}: the columns' grid`);
  const text = portCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\((?!var\()/, 'no rgb value typed — rgb() only ever wraps a token');
  // every class it names carries the house prefix and is the footer's own
  for (const sel of new Set(port.map((d) => d.split(' | ')[1]))) {
    for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-ft(?:$|[-_])/, `${sel}: .${m[1]} is the footer's, behind the prefix`);
  }
  // every variable it reads is declared — the fonts by the layout
  const root = rootOf(code(GLOBALS));
  for (const v of new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))) assert.ok(root.has(v) || v === '--font-sans' || v === '--font-mono', `${v} is declared`);
  // THE LOCKUP HAS RULES OF ITS OWN: the bar's shrink from 1024 to 1279px and under 1024px; the footer's is 25 × 36 and 16px at every width
  assert.ok(port.includes(' | .ts-ft-brand__mark | width: 25px') && port.includes(' | .ts-ft-brand__mark | height: 36px') && port.includes(' | .ts-ft-brand__name | font-size: 16px'), 'the lockup at the bar\'s full size');
  assert.deepEqual(port.filter((d) => /^@media \(m(in|ax)-width/.test(d) && /\.ts-ft-brand/.test(d.split(' | ')[1])), [], 'and no width tier resizes it');
  // where it stands: under the Financial Software section's port, directly above HERO-CREST-01's header — nothing between them — which stays last
  const css = code(GLOBALS);
  const w = whole(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const hero = css.indexOf(NEXT_PORT);
  assert.equal(count(css, PORT_OPEN), 1, 'one port');
  assert.ok(css.indexOf('.ts-fs-heading {') < at && at < hero, 'the Financial Software section\'s port → this one → the hero\'s');
  const portEnd = at + css.slice(at, hero).trimEnd().length;
  const heroHeader = w.indexOf(HERO_HEADER);
  assert.ok(heroHeader > at && heroHeader < hero, 'HERO-CREST-01\'s header stands between this port and the hero\'s rules');
  assert.match(w.slice(portEnd, heroHeader + 1), /^\s*$/, 'directly above HERO-CREST-01\'s header: nothing between the port\'s last rule and it');
  const before = css.lastIndexOf('}', at);
  assert.match(css.slice(before + 1, at), /^\s*$/, 'and only comments between the Financial Software port\'s last rule and this one\'s first');
  assert.ok(w.slice(before + 1, at).includes('/* ── FOOTER-02 ('), 'its own header among them');
  const headers = [...w.matchAll(/\n\/\* ── ([A-Z]+(?:-[A-Z]+)*-\d+) \(/g)].map((m) => m[1]);
  assert.deepEqual(headers.slice(-2), ['FOOTER-02', 'HERO-CREST-01'], 'FOOTER-02\'s block, then HERO-CREST-01\'s — the last');
  // nothing outside it names its classes, reaches its hooks, or reaches the elements it draws
  const outside = css.slice(0, at) + css.slice(hero);
  assert.doesNotMatch(outside, /\.ts-ft(?![A-Za-z0-9])/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*ft/, 'and none reaches them through a class attribute selector');
  assert.doesNotMatch(outside, /\[\s*data-footer/, 'nor through the columns\' hooks');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1])).filter((sel) => !sel.startsWith('@'));
  assert.ok(selectorsOutside.length > 100, `the rules outside the port were read (${selectorsOutside.length})`);
  const drawn = new Set(['footer', 'div', 'a', 'img', 'span', 'p', 'ul', 'li', 'svg', 'path']);
  for (const sel of selectorsOutside) {
    for (const one of sel.split(',')) {
      const compounds = one.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
      while (compounds.length > 1 && /^(html|body|:root)$/.test(compounds[0])) compounds.shift();
      const type = /^([a-z][a-z0-9-]*)/i.exec(compounds[0] ?? '')?.[1]?.toLowerCase();
      assert.ok(type === undefined || !drawn.has(type), `${sel}: no rule outside the port reaches the footer's <${type}> by its element`);
    }
  }
});

// ── T4 · THE MARKUP ──────────────────────────────────────────────────────────

test('T4 the footer\'s render is the reference\'s footer, token for token, but for the crest\'s src; every class the port rules is worn, and every class worn is ruled but the two the reference draws without a rule', () => {
  const reference = tokensOf(referenceFooter(), true);
  const marks = reference.filter((t) => t.startsWith('<img '));
  assert.deepEqual(marks, [`<img alt="" class="ts-ft-brand__mark" src="${REFERENCE_MARK}">`], 'the reference\'s one image: the crest, read from its place in the repo');
  assert.equal(resolve(ROOT, 'design-refs/footer-02', REFERENCE_MARK), resolve(ROOT, `public${BAR_MARK_SRC}`), 'the same file the app serves at BAR_MARK_SRC');
  const asBuilt = reference.map((t) => (t === marks[0] ? `<img alt="" class="ts-ft-brand__mark" src="${BAR_MARK_SRC}">` : t));
  const html = render();
  const app = tokensOf(html, false);
  assert.deepEqual(app, asBuilt, 'the footer is the reference\'s, but for the crest\'s src');
  assert.ok(app.length > 250, `the render was read (${app.length} tokens)`);
  // the classes: what the port rules is worn; what is worn is ruled — but the two column modifiers the reference draws and never rules
  const ruled = new Set(declarations(portCss()).flatMap((d) => d.split(' | ')[1].match(/\.ts-[\w-]+/g) ?? []).map((c) => c.slice(1)));
  const worn = new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const cls of ruled) assert.ok(worn.has(cls), `.${cls}: ruled by the port, and worn`);
  assert.deepEqual([...worn].filter((cls) => !ruled.has(cls)).sort(), ['ts-ft-column--services', 'ts-ft-column--socials'], 'every class worn is ruled, but the two the reference\'s own markup draws without a rule');
});

// ── T5 · THE STRUCTURE, BY NAME ──────────────────────────────────────────────

test('T5 the structure, by name: the lockup; the four hooks in order; a stop row per label, two spans and a space; the socials\' icons and the Record\'s ↗, aria-hidden in currentColor, the ↗ on exactly the external links; the hairline, the disclaimer, ©, the four links on their targets; next/link where a link stays on the site', () => {
  const html = render();
  // the lockup opens it: a link to /, the gold mark, the wordmark — then the columns
  assert.ok(html.startsWith(`<footer class="ts-ft"><div class="ts-ft__inner"><a class="ts-ft-brand" href="/"><img class="ts-ft-brand__mark" src="${BAR_MARK_SRC}" alt=""/><span class="ts-ft-brand__name">${BAR_WORDMARK}</span></a><div class="ts-ft-columns">`), 'the lockup, then the columns');
  assert.equal(count(html, '<footer'), 1, 'one footer');
  assert.equal(count(html, '<img'), 1, 'one image: the mark');
  // the four hooks, in order: each a <div>, its label a <p>, its links a <ul>
  const COLUMNS = [
    ['story', FOOTER_STORY_LABEL, 'ts-ft-list ts-ft-list--stops'],
    ['services', FOOTER_SERVICES_LABEL, 'ts-ft-list'],
    ['socials', FOOTER_SOCIALS_LABEL, 'ts-ft-list'],
    ['record', FOOTER_RECORD_LABEL, 'ts-ft-list'],
  ] as const;
  const opens = COLUMNS.map(([hook, label, list]) => {
    const open = `<div class="ts-ft-column ts-ft-column--${hook}" data-footer-${hook}="true"><p class="ts-ft-label">${label}</p><ul class="${list}">`;
    assert.equal(count(html, open), 1, `${label}: its <div> with the data-footer-${hook} hook, its label, its list`);
    assert.equal(count(html, `data-footer-${hook}`), 1, `data-footer-${hook}: once`);
    return html.indexOf(open);
  });
  assert.deepEqual(opens, [...opens].sort((x, y) => x - y), 'OUR STORY → SERVICES → SOCIALS → THE RECORD');
  const RULE = '<div class="ts-ft-rule"></div>';
  const column = (i: number): string => html.slice(opens[i], i + 1 < opens.length ? opens[i + 1] : html.indexOf(RULE));
  // OUR STORY: one row per label, in its order — the stop, a space, the place: the link reads "Stop 1 Canggu, Bali"
  const links = footerStoryLinks(WAS_HERE);
  const rows = [...column(0).matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => unescaped(m[1]));
  assert.equal(rows.length, links.length, 'one row per story link');
  assert.equal(rows.length, WAS_HERE.length + 1, 'Stop 0 and every stop of the log');
  links.forEach((link, i) => {
    const [stop, place] = link.label.split(' | ');
    assert.equal(rows[i], `<a class="ts-ft-link" href="${link.href}"><span class="ts-ft-link__stop">${stop}</span> <span class="ts-ft-link__place">${place}</span></a>`, `${link.label}: two spans, a space between`);
    assert.equal(textOf(rows[i]), `${stop} ${place}`, `it reads "${stop} ${place}"`);
  });
  // SERVICES: each name in its span, on its section
  assert.deepEqual(anchorsIn(column(1)).map((a) => [a.inner, a.href, a.target, a.rel]), FOOTER_SERVICES_LINKS.map((l) => [`<span>${l.label}</span>`, l.href, null, null]), 'the three, each in a span, staying on the site');
  // SOCIALS: the icon, then the name; a new tab
  const socials = anchorsIn(column(2));
  assert.equal(socials.length, FOOTER_SOCIALS.length, 'the five');
  FOOTER_SOCIALS.forEach((social, i) => {
    assert.match(socials[i].inner, new RegExp(`^<svg class="ts-ft-link__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M[^"]+"></path></svg><span>${social.name}</span>$`), `${social.name}: its icon, aria-hidden in currentColor, then its name`);
    assert.deepEqual([socials[i].href, socials[i].cls, socials[i].target, socials[i].rel], [social.href, 'ts-ft-link', '_blank', 'noopener noreferrer'], `${social.name}: its account, in a new tab`);
  });
  // THE RECORD: each label in its span; the ↗ after exactly the ones that leave the site
  const record = anchorsIn(column(3));
  assert.equal(record.length, FOOTER_RECORD_LINKS.length, 'the three');
  FOOTER_RECORD_LINKS.forEach((link, i) => {
    const leaves = link.external === true;
    assert.equal(record[i].inner, `<span>${link.label}</span>${leaves ? OUT_ARROW : ''}`, `${link.label}: ${leaves ? 'its span, then the ↗' : 'its span, no ↗'}`);
    assert.deepEqual([record[i].href, record[i].target, record[i].rel], [link.href, leaves ? '_blank' : null, leaves ? 'noopener noreferrer' : null], `${link.label}: ${leaves ? 'a new tab' : 'stays on the site'}`);
  });
  assert.equal(FOOTER_RECORD_LINKS.filter((l) => l.external === true).length, 2, 'two Record links leave the site today: the code and the licence');
  assert.equal(count(html, 'ts-ft-link__out'), 2, 'the ↗ twice — on those two and nowhere else in the footer');
  // every <svg>: aria-hidden, drawn in currentColor — the five icons and the two arrows, and no other
  const svgs = [...html.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(svgs.length, FOOTER_SOCIALS.length + 2, 'five icons and two arrows');
  for (const svg of svgs) assert.ok(svg.includes('aria-hidden="true"') && /(fill|stroke)="currentColor"/.test(svg), `${svg}: aria-hidden, in currentColor`);
  // under the columns: the hairline, the disclaimer, then one row — © and the four links
  assert.equal(count(html, RULE), 1, 'one hairline');
  const tail = html.slice(html.indexOf(RULE));
  assert.ok(tail.startsWith(`${RULE}<p class="ts-ft-disclaimer">${DISCLAIMER}</p><div class="ts-ft-bottom"><p class="ts-ft-copy">© 2026 TEMPLE STUART, LLC</p><div class="ts-ft-legal">`), 'the hairline, the disclaimer word for word, then © opening the row');
  assert.ok(tail.endsWith('</div></div></div></footer>'), 'the row closes the footer');
  assert.deepEqual(anchorsIn(tail).map((a) => [a.text, a.href, a.cls, a.target]), [
    ['PRICING', '/how-pricing-works', 'ts-ft-legal__link', null],
    ['TERMS', '/terms', 'ts-ft-legal__link', null],
    ['PRIVACY', '/privacy', 'ts-ft-legal__link', null],
    ['CONTACT', 'mailto:astuart@templestuart.com', 'ts-ft-legal__link', null],
  ], 'PRICING · TERMS · PRIVACY · CONTACT, on their targets');
  // next/link for every link that stays on the site, a plain <a> for every one that leaves — the source says which; the render cannot. TERMS and
  // PRIVACY were plain <a>s until FOOTER-02 (the brief: "Links that stay on the site use next/link; the rest stay as they are today").
  const footer = code(FOOTER);
  assert.equal(count(footer, '<Link className="ts-ft-brand" href="/">'), 1, 'the lockup: next/link to /');
  assert.equal(count(footer, '<Link className="ts-ft-link" href={link.href}>{drawn}</Link>'), 1, 'a column\'s row that stays on the site: next/link');
  assert.equal(count(footer, '<a className="ts-ft-link" href={link.href} target="_blank" rel="noopener noreferrer">{drawn}</a>'), 1, 'one that leaves: a plain <a>, a new tab');
  assert.match(footer, /\{link\.external \? \(\s*<a className="ts-ft-link"/, 'chosen by the link\'s own external mark');
  assert.equal(count(footer, '<a className="ts-ft-link" href={social.href} target="_blank" rel="noopener noreferrer">'), 1, 'a social: a plain <a>, a new tab');
  assert.equal(count(footer, '<Link href="/how-pricing-works" className="ts-ft-legal__link">PRICING</Link>'), 1, 'PRICING: next/link, as it was');
  for (const [href, word] of [['/terms', 'TERMS'], ['/privacy', 'PRIVACY']] as const) {
    assert.equal(count(footer, `<Link href="${href}" className="ts-ft-legal__link">${word}</Link>`), 1, `${word}: next/link — it stays on the site`);
  }
  assert.equal(count(footer, '<a href="mailto:astuart@templestuart.com" className="ts-ft-legal__link">CONTACT</a>'), 1, 'CONTACT: a plain <a>, as it was — a mailto leaves the site');
  assert.equal(count(footer, '<Link'), 5, 'next/link five times: the lockup, a row that stays, PRICING, TERMS, PRIVACY');
  assert.deepEqual([...footer.matchAll(/<a\s[^>]*>/g)].map((m) => m[0]), [
    '<a className="ts-ft-link" href={link.href} target="_blank" rel="noopener noreferrer">',
    '<a className="ts-ft-link" href={social.href} target="_blank" rel="noopener noreferrer">',
    '<a href="mailto:astuart@templestuart.com" className="ts-ft-legal__link">',
  ], 'and a plain <a> only where the link leaves the site');
});

// ── T6 · THE WORDS ───────────────────────────────────────────────────────────

test('T6 every word from its home, none typed twice: the columns\' from footerWords.ts; the mark and the wordmark from brandLockup.ts, read by the bar and the footer; the disclaimer, © and the four links in LandingFooter.tsx; nothing read from the \'use client\' bar', () => {
  const footer = code(FOOTER);
  const header = code(HEADER);
  const lockup = code(LOCKUP);
  const words = code(WORDS);
  // THE LOCKUP'S TWO — one plain leaf: no directive, no import; the bar and the footer read both there, and draw them
  assert.equal(BAR_MARK_SRC, '/brand/temple-stuart-crest-gold.png');
  assert.equal(BAR_WORDMARK, 'TEMPLE STUART');
  assert.ok(existsSync(resolve(ROOT, `public${BAR_MARK_SRC}`)), 'the mark is a file in public/');
  assert.doesNotMatch(lockup, /^\s*['"]use (client|server)['"]/m, 'a plain leaf: no directive');
  assert.doesNotMatch(lockup, /^\s*import\b/m, 'and no import');
  assert.deepEqual([...lockup.matchAll(/^export const (\w+) =/gm)].map((m) => m[1]), ['BAR_MARK_SRC', 'BAR_WORDMARK'], 'it exports the two');
  for (const [file, src] of [[FOOTER, footer], [HEADER, header]] as const) {
    assert.equal(src.split('\n').filter((l) => l === "import { BAR_MARK_SRC, BAR_WORDMARK } from '@/lib/brandLockup';").length, 1, `${file} reads both from the leaf`);
    assert.ok(src.includes('src={BAR_MARK_SRC}') && src.includes('>{BAR_WORDMARK}</span>'), `${file} draws both`);
  }
  assert.doesNotMatch(footer, /from\s+['"][^'"]*LandingHeader['"]/, 'the footer reads nothing from the bar — a \'use client\' module reaches a server component as a client reference');
  assert.match(header, /^export \{ BAR_MARK_SRC \};$/m, 'the bar re-exports the mark for its readers');
  assert.equal(BAR_MARK_SRC_FROM_THE_BAR, BAR_MARK_SRC, 'heroCrest01\'s import of BAR_MARK_SRC from the bar still holds');
  assert.equal(count(renderToStaticMarkup(React.createElement(LandingHeader)), `<span class="ts-brand__name">${BAR_WORDMARK}</span>`), 1, 'the bar draws the leaf\'s wordmark');
  // typed once in src: the wordmark — but the day card's own BRAND_WORDS, the card's word, left with the card — and the mark's path
  const wordmarks = srcFiles().filter((f) => /(['"`])TEMPLE STUART\1|>\s*TEMPLE STUART\s*</.test(code(f))).sort();
  assert.deepEqual(wordmarks, [DAY_CARD, LOCKUP].sort(), 'the wordmark is typed in its home, and in the day card\'s own word, and nowhere else in src');
  assert.match(code(DAY_CARD), /^export const BRAND_WORDS = 'TEMPLE STUART';$/m, 'the day card\'s BRAND_WORDS, untouched');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('temple-stuart-crest-gold.png')), [LOCKUP], 'the mark\'s path is typed in its home alone');
  // THE COLUMNS' WORDS — typed once, in footerWords.ts; the footer types none of them
  const COLUMN_WORDS = [FOOTER_STORY_LABEL, FOOTER_SERVICES_LABEL, FOOTER_SOCIALS_LABEL, FOOTER_RECORD_LABEL, FOOTER_STOP_ZERO_LABEL, ...FOOTER_SERVICES_LINKS.map((l) => l.label), ...FOOTER_RECORD_LINKS.map((l) => l.label)];
  for (const word of COLUMN_WORDS) {
    assert.equal(count(words, `'${word}'`), 1, `"${word}" is typed once, in footerWords.ts`);
    assert.ok(!types(footer, word), `and LandingFooter.tsx types no "${word}"`);
  }
  for (const link of footerStoryLinks(WAS_HERE)) {
    const [stop, place] = link.label.split(' | ');
    for (const part of [stop, place]) assert.ok(!types(footer, part), `LandingFooter.tsx types no "${part}" — it is the log's`);
  }
  assert.ok(types(footer, 'PRICING') && !types(footer, 'FOOTER_SERVICES_LABEL'), 'the reading finds a typed word, and passes an identifier by');
  // a social's name is typed in the words leaf as its account's name, and in the footer only as its icon's key (the SocialName type holds the two)
  for (const { name } of FOOTER_SOCIALS) {
    assert.equal(count(words, `name: '${name}'`), 1, `${name}: its account, in footerWords.ts`);
    assert.equal(count(footer, `  ${name}: '`), 1, `${name}: its icon's key in LandingFooter.tsx`);
    assert.ok(!footer.includes(`'${name}'`) && !footer.includes(`>${name}<`), `${name}: not typed as a word in the footer`);
  }
  // THE FOOTER'S OWN — the disclaimer, ©, the four links: typed once, in LandingFooter.tsx, and in none of the files it reads
  assert.equal(count(flat(footer), DISCLAIMER), 1, 'the disclaimer, word for word, once');
  assert.equal(count(footer, '© 2026 TEMPLE STUART, LLC'), 1, '©, once');
  for (const word of ['PRICING', 'TERMS', 'PRIVACY', 'CONTACT']) assert.equal(count(footer, `>${word}<`), 1, `${word}, once`);
  for (const [file, src] of [[WORDS, words], [LOCKUP, lockup], [HEADER, header]] as const) {
    for (const word of ['Temple Stuart is not a CPA firm', '© 2026', 'PRICING', 'TERMS', 'PRIVACY', 'CONTACT']) assert.ok(!types(src, word), `${file} types no "${word}"`);
  }
});

// ── T7 · THE SPLIT ───────────────────────────────────────────────────────────

test('T7 storyLinkParts splits every footerStoryLinks label into its stop and its place, and refuses by name (FooterStoryLabelError), naming the label, one with no " | " or with two', () => {
  const links = footerStoryLinks(WAS_HERE);
  assert.ok(links.length > 10, `the labels were read (${links.length})`);
  for (const link of links) {
    const { stop, place } = storyLinkParts(link.label);
    assert.equal(`${stop} | ${place}`, link.label, `${link.label}: the stop and the place, and nothing lost`);
    assert.match(stop, /^Stop \d+$/, `${link.label}: the stop`);
    assert.ok(place.length > 0 && !place.includes(' | '), `${link.label}: the place`);
  }
  assert.deepEqual(storyLinkParts(FOOTER_STOP_ZERO_LABEL), { stop: 'Stop 0', place: 'Los Angeles' });
  assert.deepEqual(storyLinkParts('Stop 2 | Da Nang / Hoi An'), { stop: 'Stop 2', place: 'Da Nang / Hoi An' }, 'a slash in a place is the place\'s');
  const NOT_ONE = [
    '', 'Stop 0', 'Stop 0 Los Angeles', 'Stop 0 || Los Angeles', 'Stop 0 |Los Angeles', // no " | "
    'Stop 0 | Los Angeles | California', 'Stop 0 | | Los Angeles', ' | Stop 0 | Los Angeles', // two (the second pair overlapping)
  ];
  for (const bad of NOT_ONE) {
    assert.throws(() => storyLinkParts(bad), (e: unknown) => e instanceof FooterStoryLabelError && e.name === 'FooterStoryLabelError' && e.message === `storyLinkParts: "${bad}" is not its stop, one " | ", then its place`, `storyLinkParts refuses ${JSON.stringify(bad)} by name, naming it`);
  }
  // the footer draws only what the split hands it — and the split is the words leaf's, pure
  assert.match(code(FOOTER), /const \{ stop, place \} = storyLinkParts\(link\.label\);/, 'the footer splits each label with it');
  assert.doesNotMatch(code(FOOTER), /\.split\(/, 'and splits nothing itself');
  assert.doesNotMatch(code(WORDS), /^\s*['"]use (client|server)['"]/m, 'footerWords.ts: still no directive');
});

// ── T8 · THE MOUNTS ──────────────────────────────────────────────────────────

test('T8 five mounts, as they were — three server pages and two client modules; the footer carries no directive and imports plain modules only', () => {
  const MOUNTS = [LANDING, MODULE_PAGE, HOW_IT_WORKS, PRICING_PAGE, STOP_PAGE];
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('<LandingFooter')).sort(), [...MOUNTS].sort(), 'the five mount it, and no sixth');
  for (const f of MOUNTS) assert.equal(count(code(f), '<LandingFooter />'), 1, `${f}: once, with nothing passed`);
  const isClient = (f: string): boolean => /^\s*['"]use client['"]/.test(code(f));
  assert.deepEqual(MOUNTS.filter(isClient), [LANDING, MODULE_PAGE], 'two client modules: the landing and the /modules pages');
  assert.deepEqual(MOUNTS.filter((f) => !isClient(f)), [HOW_IT_WORKS, PRICING_PAGE, STOP_PAGE], 'three server pages: /how-it-works, /pricing, /my-trip/[id]');
  const footer = code(FOOTER);
  assert.doesNotMatch(footer, /^\s*['"]use (client|server)['"]/m, 'no directive: a server component where a server page renders it');
  assert.deepEqual([...footer.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]), ['react', 'next/link', '@/lib/wasHere', '@/lib/brandLockup', '@/lib/footerWords'], 'its imports: a type from React, next/link, the log, the lockup\'s leaf, the words leaf');
  assert.match(footer, /^import type \{ ReactNode \} from 'react';$/m, 'from React, a type alone');
  for (const leaf of ['src/lib/wasHere.ts', LOCKUP, WORDS]) assert.doesNotMatch(code(leaf), /^\s*['"]use client['"]/m, `${leaf}: no 'use client'`);
});
