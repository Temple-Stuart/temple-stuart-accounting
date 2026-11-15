/**
 * HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page; the boards approved on the
 * design canvas at 20:01 and, corrected, at 20:41; built 2026-11-15) — FINANCIAL SOFTWARE ON THE HOME PAGE BECOMES ITS SHORT VIEW;
 * /financial-software KEEPS THE WHOLE SECTION.
 *
 * His request, 2026-11-14 19:11 Manila: "I would like to take this feedback, consider it deeply, review the home page in its current
 * state, and then come up with a mock up to meet the requests of the beta users feedback." Two of the notes, as he pasted them: "Cut the
 * scrolling length of the landing page in half. Make the user explore to find the information behind info pages" · "I like the +
 * options for business and trading." His approval of the boards, 2026-11-14 20:01 Manila: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT"; of
 * the corrected boards, 20:41: "thats it!  yeet yeet!"
 *
 * The third PR of the shorter home page. HOME-PAGES-01 gave the section a page of its own, /financial-software; HOME-TRIM-01 made About
 * Us one band; this one draws the section's short view on the home page: the section's name and its line, the panel with the question,
 * the three choices and two links (two toggles since HOME-PLANS-05, 2026-11-16, which open the map's grid and the four plans in place), then the one plan the choices pick. The spec is a file: design-refs/home-trim-02/Section-Reference.html,
 * with its README beside it ("Its markup is the page at rest."). The short view is HowToShortView in
 * src/components/landing/HowToSection.tsx, which the section draws when Landing.tsx hands it view="short"; its stylesheet is the
 * reference's second, ported after the Financial Software port's own rules in src/app/globals.css (its last rules until HOME-PLANS-05's
 * toggles followed them; the links' two rules left with the links). What is held here:
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two; the
 *      reference's first stylesheet is design-refs/home-plans-04's, byte for byte, and so is its font link;
 *   T2 the block — the port's new rules ARE the reference's second stylesheet, declaration by declaration and in order, behind the house
 *      prefix, its one rule that is the reference page's own left out (and, since HOME-PLANS-05, its links' two rules, which left with the
 *      links); it reads no variable, types no colour, and stands directly after the port's last rule, the toggles' rules after it; the
 *      rest of the port is main's, declaration by declaration;
 *   T3 the short view — its render is the reference's section, token for token, in each of the four states, as the reference's own
 *      script paints it, with the plans it hides taken out: absent, not hidden; one plan, one anchor id, the act's tag first — its links'
 *      box home-plans-05's two toggles, closed, since HOME-PLANS-05 (2026-11-16);
 *   T4 the whole view — its render is main's, byte for byte (sha256), in the four states with either door, and the default export
 *      handed "whole" draws it;
 *   T5 the words — every word the short view draws is a leaf's, in order; the one new one is computed, its total the cards' own, and
 *      follows the sheet; typed in the leaf alone, beside allToolsWords — its arrow gone since HOME-PLANS-05, the first toggle's words;
 *   T6 the two mounts — Landing.tsx hands "short" on its line 595, the page hands "whole"; the view is required, with no default: a
 *      mount that names none draws nothing — React refuses it;
 *   T7 the behaviour — the same two booleans and handlers drive the short view through the four states; two choices, two toggles and
 *      the plan's button — the two links, plain anchors to FINANCIAL_SOFTWARE_PATH and to /pricing with its hook, until HOME-PLANS-05
 *      (2026-11-16), which made them the toggles;
 *   T8 the rulings — each quoted, exact, where it is built, under the brief's stamp; ruling l's notes re-said in place, no cited line
 *      moved; in every source file of the change a quote that follows a sentence of his for twenty characters is his words from there,
 *      whole or to a full stop, the quotes under his three stamps are the words they date, and each file's count of his quotes is held.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript) and the README. No clock, no live call. What a browser must show — the short
 * view beside the reference at 1440, 1024, 768 and 390, the page's height before and after, everything outside the section and
 * /financial-software equal to main, the requests, the choices, sign-up, the links, no sideways scroll — cannot be held here; it is in
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
// HOME-PLANS-05 (2026-11-16): COMPARE_PLANS_TOGGLE_WORDS and the short view's holder are read here now; COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS and
// FINANCIAL_SOFTWARE_PATH, which the two links read, are read here no more (the whole view's foot link is homePlans04.test.ts's and howTo01.test.ts's).
import { COMPARE_PLANS_TOGGLE_WORDS, YOUR_PLAN, allToolsWords, planMapView, seeAllToolsWords } from '../howTo';
import { PLAN_PILLAR } from '../homeActWords';
import { PLANS, PLANS_HEADLINE, PLANS_SUBHEAD } from '../offer/plans';
import { PROBLEM_SHEET } from '../problemSheet';
import HowToSection, { HowToShortHolder, HowToShortView, HowToView, type HowToViewProps, type JoinDoor } from '@/components/landing/HowToSection';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-trim-02';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const PLANS04_REFERENCE = 'design-refs/home-plans-04/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const SECTION = 'src/components/landing/HowToSection.tsx';
const LEAF = 'src/lib/howTo.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const FS_PAGE = 'src/app/financial-software/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/homeTrim02.test.ts';
const tests = (name: string): string => `src/lib/__tests__/${name}.test.ts`;

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
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homeTrim01.test.ts's reading: text after the last block, or a block
 * that declares nothing, is refused.)
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
const referenceText = (): string => whole(REFERENCE);
/** A file's stylesheets, as written: what stands between each <style> and its </style>. */
const stylesOf = (html: string): string[] => html.split('<style>').slice(1).map((part) => part.slice(0, part.indexOf('</style>')));
/** The reference's second stylesheet's one rule that is the page's own, not the design ("THIS PAGE'S OWN: … not ported."). */
const OWN_RULE = '.fs-yours > [hidden]';
/** The house prefix on every class a selector names: .fs-yours → .ts-fs-yours, .fs--short → .ts-fs--short. */
const prefixed = (selector: string): string => selector.replace(/\.fs(?=$|[^A-Za-z0-9])/g, '.ts-fs');
/** The port, read as homePlans04.test.ts reads it: from its first rule to the footer's. */
const PORT_OPEN = '.ts-fs-heading {';
const NEXT_PORT = '.ts-ft {';
/**
 * The block: from its first rule to the toggles' — HOME-PLANS-05 (2026-11-16), its ruling e: the toggles' rules join the port after this block
 * (homePlans05.test.ts holds them). Until then the block ran to the footer's: css.indexOf(NEXT_PORT), 'the block opens at .ts-fs--short
 * .ts-fs__inner and runs to the footer\'s port'.
 */
const BLOCK_OPEN = '.ts-fs--short .ts-fs__inner {';
const TOGGLES_OPEN = '.ts-fs-toggles {';
function blockCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(BLOCK_OPEN);
  const end = css.indexOf(TOGGLES_OPEN);
  assert.ok(at > -1 && end > at && css.indexOf(NEXT_PORT) > end, 'the block opens at .ts-fs--short .ts-fs__inner and runs to the toggles\' rules, which run to the footer\'s port');
  return css.slice(at, end);
}
/** HOME-PLANS-05 (2026-11-16): the second stylesheet's two rules of the links' row, which went with their last wearer when the links became toggles. */
const LINKS_RULES: readonly string[] = ['.fs-links', '.fs-links .fs__compare'];

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted (a valueless attribute reads "true", as React writes one), every run of
 * text with React's escaping undone; comments and the whitespace that only lays the file out (a run holding a newline) dropped, a lone
 * space between two tags kept. With `prefix`, every class gets the house prefix. (homePlans04.test.ts's reading.)
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
      const value = a[2] ?? 'true';
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
const textsOf = (html: string): string[] => tokensOf(html, false).filter((t) => t.startsWith('#text ')).map((t) => JSON.parse(t.slice('#text '.length)) as string);
/** The reference's section at rest: from <section to its </section>, before the script that only makes the file work alone. */
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
  assert.equal(count(body, '<section'), 1, 'one section in the reference');
  return body.slice(body.indexOf('<section'), body.indexOf('</section>') + '</section>'.length);
}
/** The four states, as what you run — and the plan the reference's script shows for each. */
type Run = { business: boolean; trade: boolean };
const STATES: ReadonlyArray<readonly [name: string, run: Run, picked: string]> = [
  ['at rest', { business: false, trade: false }, 'personal'],
  ['+ Business', { business: true, trade: false }, 'business'],
  ['+ Trading', { business: false, trade: true }, 'trading'],
  ['both', { business: true, trade: true }, 'everything'],
];
const noop = (): void => {};
const LINK_DOOR = { kind: 'link', href: '/' } as const;
// HOME-PLANS-05 (2026-11-16): the short view takes its two toggles too — closed here (`closed`, below), as the page draws it at rest. Until then
// it took HowToView's props alone: { ...run, onBusiness: noop, onTrade: noop, onJoin }.
const shortRender = (run: Run, onJoin: JoinDoor = noop): string => renderToStaticMarkup(React.createElement(HowToShortView, { ...run, ...closed, onBusiness: noop, onTrade: noop, onJoin }));
const wholeRender = (run: Run, onJoin: JoinDoor = noop): string => renderToStaticMarkup(React.createElement(HowToView, { ...run, onBusiness: noop, onTrade: noop, onJoin }));
/**
 * The reference's section painted for a state as its own script paints it — each switch's aria-pressed and its tick or ring, and the one
 * plan shown — with the plans it hides taken out, as production draws the picked plan alone (README: "Production renders the picked plan
 * alone: the others are not in the page.").
 */
function painted(run: Run, picked: string): string {
  const rest = referenceSection();
  const script = referenceText().slice(referenceText().indexOf('<script>'), referenceText().indexOf('</script>'));
  assert.ok(script.includes("const picked = run.business && run.trading ? 'everything' : run.business ? 'business' : run.trading ? 'trading' : 'personal';"), 'the script picks the plan as the states above say');
  const tick = /<svg class="fs-tick"[^>]*aria-hidden="true"><path[^>]*><\/path><\/svg>/.exec(rest);
  assert.ok(tick, 'the reference draws the hidden tick');
  const on: Record<string, boolean> = { business: run.business, trading: run.trade };
  let html = rest.replace(/<button class="fs-switch" type="button" data-module="(\w+)" aria-pressed="false"><span class="fs-ring" aria-hidden="true"><\/span>/g,
    (all: string, m: string) => (on[m] ? `<button class="fs-switch" type="button" data-module="${m}" aria-pressed="true">${tick[0]}` : all));
  const plans = [...rest.matchAll(/ {6}<div class="fs-plan fs-plan--(?:row|all)" data-plan="(\w+)"[\s\S]*?\n {6}<\/div>\n/g)].map((m) => ({ id: m[1], html: m[0] }));
  assert.deepEqual(plans.map((p) => p.id), ['personal', 'business', 'trading', 'everything'], 'the reference keeps the four plans, in PLANS\' order');
  assert.deepEqual(plans.map((p) => p.html.includes(' hidden>')), [false, true, true, true], 'and hides three at rest');
  for (const p of plans) html = html.replace(p.html, p.id === picked ? p.html.replace(' hidden>', '>') : '');
  return html;
}
/**
 * HOME-PLANS-05 (2026-11-16): the panel's two links are two toggles — design-refs/home-plans-05's, at rest, as its section draws them. This file's
 * reference draws the links' box; the short view draws the toggles in its place, and homePlans05.test.ts holds them and what they open in all
 * sixteen states. Here the reference's section is read with that one box swapped for those toggles, closed, and held token for token as before.
 */
const PLANS05_REFERENCE = 'design-refs/home-plans-05/Section-Reference.html';
const LINKS_BOX = /<div class="fs-links">[\s\S]*?<\/div>/;
function withToggles(html: string): string {
  assert.equal(count(html, '<div class="fs-links">'), 1, 'the reference draws the links\' box once');
  const toggles = /<div class="fs-toggles">[\s\S]*?<\/div>/.exec(whole(PLANS05_REFERENCE));
  assert.ok(toggles && count(toggles[0], 'aria-expanded="false"') === 2, 'home-plans-05 draws the two toggles, closed');
  return html.replace(LINKS_BOX, toggles[0]);
}
const closed = { toolsOpen: false, plansOpen: false, onTools: noop, onPlans: noop } as const;
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

const RULING = {
  a: 'ONE SECTION, TWO VIEWS. HowToSection takes one more prop, view: \'short\' | \'whole\', required, with no default. Landing.tsx mounts it with view="short", /financial-software with view="whole". The whole view renders byte for byte what main renders, on /financial-software and wherever a test renders it. The audit names the smallest shape inside the file (a prop on HowToView, or a second pure view beside it) and builds the one that moves fewer pins. Nothing in the whole view is copied into a second file.',
  b: 'WHAT THE SHORT VIEW DRAWS is the reference\'s section. The map\'s grid, the three-card grid, the plans not picked and the link at the foot are absent from its markup, not hidden. The panel keeps its class, .ts-fs-map. The section keeps id="modules" (the plan law\'s :9448 reads \'<section id="modules"\'), aria-label="Software plans" and data-how-to, and adds the reference\'s hook, ts-fs--short.',
  c: 'THE PLAN is the one planMapView picks, in a holder, .ts-fs-yours. It is a card in a row (.ts-fs-plan--row, its first three parts in .ts-fs-plan__lead, as the band\'s are), or the band itself when both choices are on. It wears the tag and the gold button, as the picked plan does today. On the home page its button opens sign-up, as it does today.',
  d: 'THE CHOICES are the section\'s own: the same state, words, marks and handlers. Nothing is stored and nothing goes in the URL.',
  e: 'THE WORDS. Nothing is typed. "See all ‹total› tools →" is new: one function in src/lib/howTo.ts beside allToolsWords (:712). Its total is the sheet\'s count that the cards count against, never typed. Its link is a plain anchor in the compare link\'s class (.ts-fs__compare) to FINANCIAL_SOFTWARE_PATH (src/lib/homePages.ts:39). "Compare all four plans →" moves into the panel in the short view with its path and its data-compare-plans hook; in the whole view it stays at the foot. Neither link carries state.',
  f: 'THE PORT. The block\'s rules name the section\'s classes, so they join its port: homePlans04:425 holds that no rule outside the port names one. They stand after the port\'s last rule, in the reference\'s order, and homePlans04 T3 names them as its seventh difference, declaration by declaration, as HOME-PAGES-01 named the sixth. The rest of the port does not change.',
  g: 'NO NEW TOKEN. The block reads no variable.',
  h: 'THE TOP. The "What We Do" box (Landing.tsx:569-570) and the section\'s 12px top stay as they are. HOME-DOORS-01, later in this series, changes both.',
  i: 'THE ARROWS in the two links are drawn by the fallback face, as "Compare all four plans →" already is on main. A later PR fixes every arrow at once. Name those pixels; do not fix them here.',
  j: 'QUOTES. This brief shares its first stamp and its approvals with HOME-PAGES-01 and HOME-TRIM-01. In the files their tests read, quote it as HOME-TRIM-01 did, by its lettered rulings, so their quote censuses stand.',
  k: 'NOTHING ELSE CHANGES: not the hero, the other sections, About Us, Our Story, the footer, /pricing or /financial-software.',
  l: 'NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-TRIM-01 re-said its own: every sentence that says the home page draws the map, the three cards, the band at rest or the link at the foot. No line moves in a file whose lines a test or a law cites.',
} as const;
/** His request, under the brief's first stamp (2026-11-14 19:11 Manila), as the brief gives it. */
const REQUEST = 'I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback.';
/** Two of his four beta users' notes, as he pasted them. */
const BETA_NOTES = ['Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages', 'I like the + options for business and trading.'] as const;
/** His approval of the boards (20:01 Manila) and of the corrected boards (20:41). */
const APPROVAL = 'ALL LOOKS GOOD … OTHERWISE, LETS DO IT';
const APPROVAL_OF_THE_CORRECTED = 'thats it! yeet yeet!'; // two spaces after "it!" as he typed it; held with whitespace collapsed, as prose() reads a file

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-trim-02-handoff.zip, 2026-11-15): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 10465, '63466dbf1c299e33bb803c2c2d2c0c6d5522251102ff890d876f65cdbd7e32eb'],
  [REFERENCE, 32699, '0a3c5c6810f20dc4a9e493eba761433bf4eecafc4381c983b650922fd1086f46'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size, and the folder holds the two; the reference\'s first stylesheet and its font link are home-plans-04\'s, byte for byte', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes, as the brief gives it`);
    assert.equal(sha256(whole(file)), sha, `${file}: byte for byte (sha256), as the brief gives it`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html'], 'the folder holds the two files and nothing else');
  const [first, second, ...more] = stylesOf(referenceText());
  assert.equal(more.length, 0, 'the reference has two stylesheets');
  const plans04 = stylesOf(whole(PLANS04_REFERENCE));
  assert.equal(plans04.length, 1, 'home-plans-04\'s has one');
  assert.equal(first, plans04[0], 'the first stylesheet is design-refs/home-plans-04\'s, byte for byte — on main already, as the .ts-fs… port');
  assert.ok(second.includes('HOME-TRIM-02 · NEW WITH THIS SECTION: what the short view adds. The only rules to port.'), 'the second is what the short view adds');
  const fontLink = (html: string): string => { const m = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/.exec(html); assert.ok(m, 'a font link'); return m[0]; };
  assert.equal(fontLink(referenceText()), fontLink(whole(PLANS04_REFERENCE)), 'and so is the font link');
});

// ── T2 · THE PORT'S NEW BLOCK ────────────────────────────────────────────────

/** The port's declarations at main (0ade717), before this block: sha256 of their lines, joined, and their count. */
const PORT_AT_MAIN = { declarations: 327, sha: 'b2d89df20aecf557bdf1ab8fdd9594a963a775fa8744fdb59d4e71bc42a708ec' };

// HOME-PLANS-05 (2026-11-16), its ruling e — T2 RE-WRITTEN IN PLACE: the two rules of .ts-fs-links went with their last wearer, the toggles' rules
// follow the block, and the block ends where theirs begin. Until then T2 held the block to the whole second stylesheet but its page's own rule
// (twenty-five declarations in twelve rules), read to the footer's port, and as the port's last twenty-five declarations.
test('T2 the block is the reference\'s second stylesheet, declaration by declaration and in order, behind the house prefix, the page\'s own rule left out — and, since HOME-PLANS-05 (2026-11-16), the links\' two rules, which left with the links; it reads no variable and types no colour; it stands directly after the port\'s last rule, the toggles\' rules after it; and the rest of the port is main\'s', () => {
  const second = stylesOf(referenceText())[1];
  const all = declarations(uncommented(second));
  const own = all.filter((d) => d.split(' | ')[1] === OWN_RULE);
  assert.deepEqual(own, [' | .fs-yours > [hidden] | display: none'], 'the reference page\'s own rule — one declaration — is not ported');
  const links = all.filter((d) => LINKS_RULES.includes(d.split(' | ')[1]));
  assert.deepEqual(links, [' | .fs-links | display: flex', ' | .fs-links | flex-wrap: wrap', ' | .fs-links | align-items: center', ' | .fs-links | gap: 0 28px', ' | .fs-links .fs__compare | margin-top: 0'], 'the links\' row: two rules, five declarations, which left with the links (HOME-PLANS-05)');
  const expected = all.filter((d) => d.split(' | ')[1] !== OWN_RULE && !LINKS_RULES.includes(d.split(' | ')[1])).map((d) => { const [media, sel, decl] = d.split(' | '); return `${media} | ${prefixed(sel)} | ${decl}`; });
  assert.equal(expected.length, 20, 'twenty declarations in ten rules (twenty-five in twelve until HOME-PLANS-05)');
  const block = declarations(blockCss());
  assert.deepEqual(block, expected, 'the block is the second stylesheet, declaration by declaration, in its order, renamed — but for the links\' row');
  assert.doesNotMatch(code(GLOBALS), /\.ts-fs-links\b/, 'and .ts-fs-links is ruled nowhere: it has no wearer');
  // ruling g: "NO NEW TOKEN. The block reads no variable."
  assert.doesNotMatch(blockCss(), /var\(|--[\w-]+\s*:|#[0-9a-fA-F]{3,8}\b|rgba?\(|!important/, 'no variable read or declared, no colour typed, no !important');
  for (const line of block) for (const cls of line.split(' | ')[1].match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-fs'), `${line}: ${cls} is the section's`);
  // its seat: directly after the port's last rule, inside the port, above the footer's block
  const css = code(GLOBALS);
  const last = '@media (prefers-reduced-motion: reduce) {\n  .ts-fs-switch, .ts-fs-tool, .ts-fs-plan, .ts-fs-plan__cta { transition: none; }\n}';
  assert.equal(count(css, last), 1, 'the port\'s last rule, once');
  assert.match(css.slice(css.indexOf(last) + last.length, css.indexOf(BLOCK_OPEN)), /^\s*$/, 'the block stands directly after it — comments between, nothing else');
  assert.ok(css.indexOf(PORT_OPEN) < css.indexOf(BLOCK_OPEN) && css.indexOf(BLOCK_OPEN) < css.indexOf(NEXT_PORT), 'inside the port, above the footer\'s block');
  assert.ok(css.indexOf('.ts-fs-plan {') < css.indexOf('.ts-fs-plan--row {'), 'after .ts-fs-plan, whose column the row overrides at equal weight');
  // ruling f: "The rest of the port does not change." — the port's declarations before the block are main's
  const port = declarations(css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT)));
  const toggles = declarations(css.slice(css.indexOf(TOGGLES_OPEN), css.indexOf(NEXT_PORT)));
  assert.ok(toggles.length > 0 && toggles.every((d) => d.split(' | ')[1].startsWith('.ts-fs-toggle') || d.split(' | ')[1].startsWith('.ts-fs-chevron')), 'after the block, the toggles\' rules alone (HOME-PLANS-05; homePlans05.test.ts holds them)');
  assert.deepEqual(port.slice(-(expected.length + toggles.length), -toggles.length), expected, 'the block, then the toggles\' rules, end the port — "the block is the port\'s last twenty-five declarations" until HOME-PLANS-05');
  const before = port.slice(0, -(expected.length + toggles.length));
  assert.equal(before.length, PORT_AT_MAIN.declarations, 'the port before the block: main\'s count');
  assert.equal(sha256(before.join('\n')), PORT_AT_MAIN.sha, 'and main\'s declarations, every one');
});

// ── T3 · THE SHORT VIEW'S MARKUP ─────────────────────────────────────────────

// HOME-PLANS-05 (2026-11-16), its ruling a: the panel's two links are two toggles, so the reference's section is read with its links' box swapped
// for home-plans-05's toggles, closed (withToggles, above); every other token is held as it was. Until then: tokensOf(painted(run, picked), true).
test('T3 the short view\'s render is the reference\'s section, token for token, in each of the four states, as the reference\'s script paints it with the plans it hides taken out — absent, not hidden; one plan, the tag once, the act\'s tag first, the anchor once — its links\' box home-plans-05\'s two toggles, closed, since HOME-PLANS-05 (2026-11-16)', () => {
  for (const [name, run, picked] of STATES) {
    const html = shortRender(run);
    assert.deepEqual(tokensOf(html, false), tokensOf(withToggles(painted(run, picked)), true), `${name}: the reference's section, token for token, its links' box the two toggles`);
    assert.ok(html.startsWith('<section id="modules" class="ts-fs ts-fs--short" aria-label="Software plans" data-how-to="true">'), `${name}: the act's tag — the id, the label and the hook kept, ts-fs--short added (ruling b)`);
    assert.equal(count(html, 'id="modules"'), 1, `${name}: the anchor, once`);
    assert.equal(count(html, 'data-plan='), 1, `${name}: one plan`);
    assert.equal(count(html, `data-plan="${picked}" data-picked="true"`), 1, `${name}: the one the choices pick (ruling c)`);
    assert.equal(count(html, YOUR_PLAN), 1, `${name}: it wears the tag`);
    assert.equal(count(html, picked === 'everything' ? 'class="ts-fs-plan ts-fs-plan--all"' : 'class="ts-fs-plan ts-fs-plan--row"'), 1, `${name}: ${picked === 'everything' ? 'the band itself' : 'a card in a row'}`);
    for (const gone of ['ts-fs-map__grid', 'ts-fs-plans', 'ts-fs-tool', 'ts-fs-family']) assert.equal(count(html, gone), 0, `${name}: no ${gone} — absent from the markup (ruling b)`);
    assert.doesNotMatch(html, /\shidden(?=[\s>=])/, `${name}: nothing hidden — what is not drawn is not there`);
    assert.ok(html.endsWith('</div></div></div></section>'), `${name}: the plan's holder closes the section — no link at the foot`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'short', onRequireAuth: noop })), shortRender(STATES[0][1]), 'the default export, handed "short", draws the short view at rest');
  // every class the short view wears is the port's, and the block rules nothing it does not wear
  const port = declarations(code(GLOBALS).slice(code(GLOBALS).indexOf(PORT_OPEN), code(GLOBALS).indexOf(NEXT_PORT)));
  const ruled = new Set(port.flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []));
  const worn = new Set(STATES.flatMap(([, run]) => [...shortRender(run).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))));
  for (const cls of worn) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule of the port`);
  for (const cls of new Set(declarations(blockCss()).flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []))) assert.ok(worn.has(cls.slice(1)), `${cls}, which the block rules, is worn by the short view`);
});

// ── T4 · THE WHOLE VIEW ──────────────────────────────────────────────────────

/** The whole view's render at main (0ade717), sha256 — each state, a function door (Landing's until now) and a link door (the page's). */
const WHOLE_AT_MAIN: Readonly<Record<string, string>> = {
  'at rest function': 'cfc73caf10d50f760cd83ff21168db1c5268d2f5bdf0eb96fc9d5ad114abe15a',
  'at rest link': 'e4f1c279305273e7e4ab8d84c89d8d0f7ef408a8fd4817a2cef9d367591d43d6',
  '+ Business function': 'a8c2ff817a6a6959f1fbed64930cad96395bfcecc8d4d03aac6d4fa005e8e2c7',
  '+ Business link': 'ef43b4e2bf3a85c2685b775713ba206647fa6170d4edc21fec0bf7bcb63e32a5',
  '+ Trading function': '410ae8f0bd93c11e81321567309bf800404dd46b6832b9f90da6e1509237b532',
  '+ Trading link': 'e3777f6fe0bf6123b6355f06855a2a3b43cbfc4ac58045e55d78bcf9295509a0',
  'both function': '5717eed3206c484e8214bc61adc4705f61acd84d8940b12492d86c2e3be45aa7',
  'both link': 'ecee2b9f26ce8447971aa9780bf03c28048d42ad02608c1747b8de203e4e947f',
};

test('T4 the whole view\'s render is main\'s, byte for byte, in the four states with either door, and the default export handed "whole" draws it', () => {
  // ruling a: "The whole view renders byte for byte what main renders, on /financial-software and wherever a test renders it."
  for (const [name, run] of STATES) {
    assert.equal(sha256(wholeRender(run)), WHOLE_AT_MAIN[`${name} function`], `${name}, a function door: main's render, byte for byte`);
    assert.equal(sha256(wholeRender(run, LINK_DOOR)), WHOLE_AT_MAIN[`${name} link`], `${name}, a link door: main's render, byte for byte`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: noop })), wholeRender(STATES[0][1]), 'the default export, handed "whole" and a function: the whole view at rest');
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: LINK_DOOR })), wholeRender(STATES[0][1], LINK_DOOR), 'handed "whole" and a link, as /financial-software hands them');
});

// ── T5 · THE WORDS ───────────────────────────────────────────────────────────

test('T5 every word the short view draws is a leaf\'s, in order; the one new one is computed — its total the cards\' own — follows the sheet, and is typed in the leaf alone, beside allToolsWords', () => {
  // ruling e's new words, and its total — HOME-PLANS-05 (2026-11-16), its ruling f: the words lose their arrow where they stand, the first toggle's
  // now. Until then: seeAllToolsWords(25) === 'See all 25 tools →', '"See all ‹total› tools →", the arrow in the string'; and 'See all 24 tools →' below.
  assert.equal(seeAllToolsWords(25), 'See all 25 tools', '"See all ‹total› tools", the arrow gone (HOME-PLANS-05)');
  const total = PROBLEM_SHEET.flatMap((f) => f.tools).length;
  assert.equal(total, 25, 'the sheet\'s count');
  const rest = planMapView({ business: false, trade: false });
  assert.equal(rest.seeAll, seeAllToolsWords(total), 'planMapView hands the words, built over the sheet\'s count');
  assert.equal(planMapView({ business: true, trade: true }).band.count, allToolsWords(total), 'the count the band\'s own words are out of — the same total');
  assert.ok(rest.cards.every((c) => c.count.endsWith(`of ${total} tools`)), 'and the three cards\' counts are out of it too');
  const shorter = PROBLEM_SHEET.map((f) => ({ header: f.header, tools: f.tools.filter((t) => t !== 'Mileage') }));
  assert.equal(planMapView({ business: false, trade: false }, { sheet: shorter }).seeAll, 'See all 24 tools', 'it follows the sheet — never typed');
  assert.equal('figure' in rest || 'total' in rest, false, 'the view carries words, not a figure for a count to draw');
  // typed once, in the leaf, beside allToolsWords
  const leaf = code(LEAF);
  const at = leaf.indexOf('export function seeAllToolsWords(');
  assert.ok(at > -1 && at > leaf.indexOf('export function allToolsWords(') && at < leaf.indexOf('export type MapSheet'), 'beside allToolsWords, before the map\'s types');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('See all')), [LEAF], 'the words stand in one file\'s code under src but the tests');
  // every word drawn, in order: the leaves' own — HOME-PLANS-05 (2026-11-16), its ruling f: after the switches, the two toggles' words, seeAll and
  // COMPARE_PLANS_TOGGLE_WORDS, read against the reference's section with its links' box swapped for the toggles (withToggles). Until then: v.seeAll
  // and COMPARE_PLANS_WORDS, read against painted(…) alone.
  for (const [name, run] of STATES) {
    const v = planMapView(run);
    const plan = [...v.cards, v.band].find((p) => p.picked);
    assert.ok(plan, `${name}: a picked plan`);
    const words = [PLAN_PILLAR.heading, PLANS_SUBHEAD, PLANS_HEADLINE, v.base.words, ...v.switches.map((s) => s.words), v.seeAll, COMPARE_PLANS_TOGGLE_WORDS,
      plan.role, YOUR_PLAN, ...plan.parts.map((p) => p.words), plan.audience, plan.explainer, ...plan.benefits, plan.count, plan.price, plan.cta];
    assert.deepEqual(textsOf(shortRender(run)).map((t) => t.trim()).filter((t) => t !== ''), words, `${name}: every word a leaf's, in order`);
    assert.deepEqual(textsOf(withToggles(painted(run, STATES.find((s) => s[0] === name)?.[2] ?? ''))).map((t) => t.trim()).filter((t) => t !== ''), words, `${name}: and the reference draws the same words`);
  }
  // the section types none of them: it writes no template literal, and its only typed label is the act's
  const section = code(SECTION);
  assert.equal(count(section, '`'), 0, 'no template literal in the section');
  assert.ok(!section.includes('See all') && !section.includes('/financial-software') && !section.includes('/pricing'), 'the words and both paths are read, not typed');
  // HOME-PLANS-05 (2026-11-16), its ruling a: the first link is the first toggle, a button with the same words, which opens the map's grid in place.
  // Until then: count(section, '<a className="ts-fs__compare" href={FINANCIAL_SOFTWARE_PATH}>{view.seeAll}</a>') === 1.
  assert.equal(count(section, '<Toggle words={view.seeAll} open={toolsOpen} controls="fs-all-tools" onPress={onTools} />'), 1, 'the first toggle: the view\'s words, its part the map\'s grid');
  assert.equal(count(section, 'FINANCIAL_SOFTWARE_PATH'), 0, 'and the pages\' leaf\'s path is read nowhere in the section now');
  assert.equal(PLANS.length, 4);
});

// ── T6 · THE TWO MOUNTS ──────────────────────────────────────────────────────

test('T6 Landing.tsx hands "short" on its line 595, /financial-software hands "whole"; the view is required, with no default — a mount that names none draws nothing', () => {
  const landing = code(LANDING);
  const lines = landing.split('\n');
  assert.equal(lines[594], '      <HowToSection view="short" onRequireAuth={onRequireAuth} />', 'line 595: the mount, where it stood, handed the short view');
  assert.equal(count(landing, '<HowToSection'), 1, 'mounted once');
  assert.equal(lines.length, 816, 'Landing.tsx is the 815 lines it was (and its closing line break)');
  assert.equal(count(code(FS_PAGE), '<HowToSection view="whole" onRequireAuth={{ kind: \'link\', href: \'/\' }} />'), 1, '/financial-software: the whole view, and /pricing\'s door');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('<HowToSection')).sort(), [FS_PAGE, LANDING].sort(), 'mounted by those two alone');
  assert.ok(!landing.includes('homePages') && !landing.includes('FINANCIAL_SOFTWARE_PATH'), 'Landing.tsx reads nothing of the pages\' leaf — nor, since HOME-PLANS-05 (2026-11-16), does the section ("the section does" until then)');
  // ruling a: "required, with no default"
  const section = code(SECTION);
  assert.match(section, /export default function HowToSection\(\{ view, onRequireAuth \}: \{ view: 'short' \| 'whole'; onRequireAuth: JoinDoor \}\) \{/, 'the view: two names, required');
  // HOME-PLANS-05 (2026-11-16), its ruling c: the short view's name finds the short view's holder, which keeps the toggles' two booleans and draws
  // HowToShortView with them. Until then: short: HowToShortView.
  assert.match(section, /^const VIEWS = \{ __proto__: null, short: HowToShortHolder, whole: HowToView \} as const;$/m, 'each view by its name, in an object with no prototype to lend one');
  assert.equal(count(section, 'const View = VIEWS[view];'), 1, 'looked up, not chosen by a ternary');
  assert.doesNotMatch(section, /view \?\?|view \|\||view === |view !== |= 'whole'|= 'short'/, 'no default and no fall-through: nothing stands in for a missing view');
  assert.throws(() => renderToStaticMarkup(React.createElement(HowToSection as unknown as React.FC<{ onRequireAuth: JoinDoor }>, { onRequireAuth: noop })), /Element type is invalid/, 'a mount that names no view draws nothing: React refuses it');
  // nor does a name that is neither view, Object's own among them — the type refuses them first, and the lookup has none to lend
  const untyped = HowToSection as unknown as React.FC<{ view: string; onRequireAuth: JoinDoor }>;
  for (const name of ['', 'Short', 'toString', 'constructor', 'valueOf', '__proto__']) assert.throws(() => renderToStaticMarkup(React.createElement(untyped, { view: name, onRequireAuth: noop })), /Element type is invalid/, `view "${name}" draws nothing`);
});

// ── T7 · THE SHORT VIEW'S BEHAVIOUR ──────────────────────────────────────────

// HOME-PLANS-05 (2026-11-16), its rulings a and c — T7 RE-WRITTEN IN PLACE: the default export hands the short view's holder the same two booleans
// and door, and the short view draws two toggles where the two links stood. Until then: the default export drew HowToShortView itself; three
// buttons (two choices and the plan's) and two plain anchors, the first to FINANCIAL_SOFTWARE_PATH; and two useState in the file.
test('T7 the same two booleans and handlers drive the short view through the four states; two choices, two toggles and the plan\'s button, which opens the door handed in — the two links plain anchors that carried no state until HOME-PLANS-05 (2026-11-16), two toggles since', () => {
  // ruling d: "THE CHOICES are the section's own: the same state, words, marks and handlers. Nothing is stored and nothing goes in the URL."
  const acts: Array<(props: HowToViewProps) => void> = [(p) => p.onBusiness(), (p) => p.onTrade(), (p) => p.onBusiness(), (p) => p.onTrade()];
  const passes: string[] = [];
  const door = (): void => {};
  const Host = (): null => {
    const el = HowToSection({ view: 'short', onRequireAuth: door }) as React.ReactElement<HowToViewProps>;
    assert.equal(el.type, HowToShortHolder, 'handed "short", the default export draws the short view\'s holder, which draws the short view');
    assert.equal(el.props.onJoin, door, 'with the door Landing hands in');
    passes.push(`${el.props.business ? 'B' : '-'}${el.props.trade ? 'T' : '-'}`);
    if (passes.length <= acts.length) acts[passes.length - 1](el.props);
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  assert.deepEqual(passes, ['--', 'B-', 'BT', '-T', '--'], 'at rest → + Business → both → + Trading → at rest');
  for (const [name, run, picked] of STATES) {
    const calls: string[] = [];
    const drawn = drawnElementsOf(HowToShortView({ ...run, ...closed, onBusiness: () => calls.push('business'), onTrade: () => calls.push('trade'), onTools: () => calls.push('tools'), onPlans: () => calls.push('plans'), onJoin: () => calls.push('join') }));
    const buttons = drawn.filter((el) => el.type === 'button');
    assert.equal(buttons.length, 5, `${name}: two choices, two toggles and the plan's button`);
    for (const b of buttons) (b.props.onClick as () => void)();
    assert.deepEqual(calls, ['business', 'trade', 'tools', 'plans', 'join'], `${name}: each choice turns its own, each toggle its own; the plan's button opens the door — on the home page, sign-up (ruling c)`);
    assert.deepEqual(buttons.slice(0, 2).map((b) => [b.props['data-module'], b.props['aria-pressed']]), [['business', run.business], ['trading', run.trade]], `${name}: aria-pressed says what is on`);
    assert.deepEqual(buttons.slice(2, 4).map((b) => [b.props.type, b.props['aria-expanded'], b.props['aria-controls']]), [['button', false, 'fs-all-tools'], ['button', false, 'fs-all-plans']], `${name}: the two toggles, closed, each naming its part`);
    const anchors = drawn.filter((el) => el.type === 'a');
    assert.deepEqual(anchors, [], `${name}: no link in the short view — the toggles are buttons, and a function door is a button`);
    const linkDoor = drawnElementsOf(HowToShortView({ ...run, ...closed, onBusiness: noop, onTrade: noop, onJoin: LINK_DOOR })).filter((el) => el.type === 'a');
    assert.deepEqual(linkDoor.map((a) => a.props.href), ['/'], `${name}: a link door is the plan's own link (${picked}), and the only one`);
  }
  // nothing stored, nothing in the URL: the section's only state is the default export's two booleans — and, since HOME-PLANS-05, the holder's two
  const section = code(SECTION);
  assert.equal(count(section, 'useState('), 4, 'two booleans and the toggles\' two, and no other state');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|window\.|location\b|\bfetch\s*\(|searchParams|useRouter/, 'nothing stored, nothing read from or written to the URL');
});

// ── T8 · THE RULINGS ─────────────────────────────────────────────────────────

test('T8 each ruling is quoted, exact, where it is built, under the brief\'s stamp; ruling l\'s notes re-said in place, dated, and no cited line moved; in every source file of the change a quote that follows a sentence of his for twenty characters is his words from there, whole or to a full stop, the quotes under his three stamps are the words they date, and each file\'s count of his quotes is held', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  /** A sentence of a ruling, from its start to its full stop — the form a file quotes where it builds that part alone. */
  const sentence = (text: string, opens: string): string => { const at = text.indexOf(opens); const end = text.indexOf('. ', at); return text.slice(at, end < 0 ? text.length : end + 1); };
  const MOUNTS = sentence(RULING.a, 'Landing.tsx mounts it');
  assert.equal(MOUNTS, 'Landing.tsx mounts it with view="short", /financial-software with view="whole".', '(a check of the slicing above: ruling a\'s mounts)');
  const NO_LINE_MOVES = sentence(RULING.l, 'No line moves');
  assert.equal(NO_LINE_MOVES, 'No line moves in a file whose lines a test or a law cites.', '(and of ruling l\'s last sentence)');
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [SECTION, [RULING.a, RULING.b, RULING.c, RULING.d, RULING.e, RULING.l]],
    [LEAF, [RULING.e, RULING.l]],
    [GLOBALS, [RULING.f, RULING.g, RULING.h, RULING.i]],
    [LANDING, [MOUNTS, RULING.h, RULING.k, NO_LINE_MOVES]],
    [FS_PAGE, [MOUNTS, RULING.k]],
    [tests('homePlans04'), [RULING.f]],
  ];
  // the stamp each carries where the brief is built: the brief by name, its day and hour, and the day it was built
  const STAMP = /HOME-TRIM-02 (?:\(|— )Alex's brief, 2026-11-14 19:11 Manila[^()]*built 2026-11-15\)/;
  for (const [file, rulings] of BUILT) {
    const said = prose(file);
    assert.match(said, STAMP, `${file} names the brief, dates it (2026-11-14 19:11 Manila) and dates the build (2026-11-15)`);
    for (const ruling of rulings) {
      assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
      // and each quote stands under the stamp: from the last "HOME-TRIM-02" before it, the brief's day and hour and the build's day
      const at = said.indexOf(`"${flat(ruling)}"`);
      const under = said.slice(said.lastIndexOf('HOME-TRIM-02', at), at);
      assert.ok(under.includes("Alex's brief, 2026-11-14 19:11 Manila") && under.includes('built 2026-11-15'), `${file}: "${ruling.slice(0, 30)}…" stands under the brief's stamp — "${under.slice(0, 90)}…"`);
    }
  }
  // ruling j — built here, and in every file of the change: "QUOTES. This brief shares its first stamp and its approvals with HOME-PAGES-01 and
  // HOME-TRIM-01. In the files their tests read, quote it as HOME-TRIM-01 did, by its lettered rulings, so their quote censuses stand." Rulings e and
  // l are quoted whole outside those files (the section, the leaf); in Landing.tsx ruling l is cited by its letter and its last sentence, which
  // opens nothing in HOME-TRIM-01's scan, where its first sentence would part from HOME-TRIM-01's ruling b. The brief's request, the first beta note
  // and the two approvals stand in the leaf and in this file, outside both lists.
  assert.ok(prose(LANDING).includes(`ruling l, which re-said this note in place`) && quoted(LANDING, NO_LINE_MOVES), 'Landing.tsx cites ruling l by its letter and its last sentence');
  // ruling l: "No line moves in a file whose lines a test or a law cites." — each such file keeps its length, and each re-said note carries the date
  const HELD: ReadonlyArray<readonly [file: string, lines: number]> = [[LANDING, 815], [LAW, 11254], [FS_PAGE, 48]];
  for (const [file, lines] of HELD) assert.equal(comments(file).split('\n').length, lines + 1, `${file} is the ${lines} lines it was (and its closing line break)`);
  const notes = comments(LANDING).split('\n');
  assert.match(notes[510], /HOME-TRIM-02, 2026-11-15/, `${LANDING}:511 — re-said on its own line, dated`);
  const overTheMount = flat(notes.slice(591, 594).join(' '));
  assert.ok(overTheMount.startsWith('/* HOME-PLANS-04 (2026-11-12): the how-to is the Financial Software section as the board draws it. UNTIL HOME-TRIM-02 this note went on, true until then: "— the pillar\'s name and one line, the map of the 25 tools with its two switches (React state only), three plan cards and the all-three band, the link to /pricing (HowToSection.tsx). The notes above are history: no steps are drawn here now."'), `${LANDING}:592-594 — the note over the mount, re-said on its own three lines, dated, its old words quoted whole`);
  assert.ok(notes[510].includes('said by the four plans below (HOME-TRIM-02, 2026-11-15:'), 'line 511 keeps the phrase three tests pin, whole, and says the rest after it');
  // and every line the rulings cite, where they are quoted, still holds what they say it holds — ruling e's howTo.ts:712 and homePages.ts:39, ruling h's
  // Landing.tsx:569-570, ruling b's law line 9448, ruling f's homePlans04:425
  const at = (file: string, n: number): string => code(file).split('\n')[n - 1];
  assert.equal(at(LEAF, 712), 'export function allToolsWords(total: number): string {', 'howTo.ts:712 is allToolsWords, as ruling e cites it');
  assert.equal(at('src/lib/homePages.ts', 39), "export const FINANCIAL_SOFTWARE_PATH = '/financial-software';", 'homePages.ts:39 is FINANCIAL_SOFTWARE_PATH, as ruling e cites it');
  assert.deepEqual([at(LANDING, 569).trim(), at(LANDING, 570).trim().slice(0, 4)], ['<div className="ts-fs-heading">', '<h2 '], 'Landing.tsx:569-570 is the "What We Do" box, as ruling h cites it');
  assert.ok(at(LAW, 9448).includes(".includes('<section id=\"modules\"')"), 'the law\'s line 9448 reads \'<section id="modules"\', as ruling b cites it');
  const plans04 = code(tests('homePlans04')).split('\n');
  assert.equal(plans04[424].trim(), "assert.doesNotMatch(outside, /\\.ts-fs\\b|\\.ts-fs[-_]/, 'no rule outside the port names one of its classes');", 'homePlans04:425 holds what ruling f says it holds');
  const law = comments(LAW).split('\n');
  assert.match(law[388], /HOME-TRIM-02, 2026-11-15: the landing draws one of those plans/, `${LAW}:389 — re-said in place, dated`);
  assert.match(flat(law.slice(11217, 11219).join(' ')), /The map \(src\/components\/landing\/HowToSection\.tsx's whole view, on \/\/ \/financial-software since HOME-PAGES-01, 2026-11-14, and there alone since HOME-TRIM-02, 2026-11-15 — the guest landing's too until then;/, `${LAW}:11218-11219 — the map law's note, re-said in place, dated`);
  // every note ruling l re-said: the re-said words stand, dated (a phrase only the re-said sentence carries), and where main's sentence differs from them,
  // it is gone — DESIGN.md is prose, read whole; the rest are read in their comments
  const RESAID: ReadonlyArray<readonly [file: string, now: RegExp, gone: RegExp | null]> = [
    [SECTION, /AS DRAWN — since HOME-TRIM-02 \(2026-11-15\), its WHOLE view, on its own page/, null],
    [SECTION, /Top to bottom, the whole view:/, /Top to bottom: 1\./],
    [SECTION, /Landing\.tsx's mount stood as typed \("stands as typed" until HOME-TRIM-02, 2026-11-15/, /Landing\.tsx's mount stands as typed\. Each arm/],
    [SECTION, /\(HOME-TRIM-02, 2026-11-15: on the home page, one plan is drawn — the one the choices pick — and its button calls that door\.\)/, null],
    [LEAF, /the home page drew THE MAP \(planMapView, at the foot of this file\)/, /the home page draws THE MAP now \(planMapView/],
    [LEAF, /KEPT, NOT DRAWN \(HOME-PLANS-04, 2026-11-12\): the section draws the map and its own cards — on the home page until HOME-TRIM-02 \(2026-11-15\), on \/financial-software since HOME-PAGES-01 \(2026-11-14\) and there alone since/, /2026-11-12\): the home page draws the map and its own cards now; this stays/],
    [LEAF, /What the home page's first pillar drew, under its name and one line, until HOME-TRIM-02 \(2026-11-15\)/, /first pillar draws now/],
    [LEAF, /three words are typed \(and, since HOME-TRIM-02, 2026-11-15, a fourth: seeAllToolsWords, its ruling e\)/, /three words are typed, ruled new by/],
    [FS_PAGE, /The home page keeps its own mount of the same component — "unchanged" until HOME-TRIM-02/, /of the same component, unchanged\./],
    [GLOBALS, /SEVEN DIFFERENCES named here .* \(HOME-TRIM-02, 2026-11-15: SIX DIFFERENCES until then;/, /homePlans04\.test\.ts reads both files and holds them equal, declaration by declaration, but for the SIX DIFFERENCES/],
    ['scripts/proofs/map.seeds.ts', /on \/financial-software since HOME-PAGES-01 \(2026-11-14\), and there alone since HOME-TRIM-02 \(2026-11-15; the guest landing's too until then\)/, /The guest landing's map lights each tool/],
    ['src/lib/problemSheet.ts', /the landing rendered it \(Landing\.tsx — the deck until PIPELINE-PAGE-01, 2026-11-09; the Financial Software section's map until HOME-TRIM-02, 2026-11-15: "renders" until then\)/, /the landing renders it \(Landing\.tsx\)/],
    [tests('howTo01'), /the how-to draws its own plans — on the home page, since HOME-TRIM-02 \(2026-11-15\), the one the choices pick/, /the how-to draws its own three cards and the band \(HOME-PLANS-04;/],
    [tests('howTo01'), /the how-to drew its own three cards and the band — on the home page until HOME-TRIM-02, 2026-11-15; on \/financial-software since HOME-PAGES-01, 2026-11-14, and there alone since/, /the how-to draws its own three cards and the band now\)/],
    [tests('howTo01'), /until HOME-TRIM-02 \(2026-11-15\) — "draws … now" until then — and \/financial-software, which has drawn them since HOME-PAGES-01 \(2026-11-14\)/, /the landing draws the map's marks now/],
    [tests('homePlans04'), /the link to \/pricing — on the home page until HOME-TRIM-02 \(2026-11-15\), which draws the section's short view there/, null],
    [tests('homePlans04'), /its whole view; the home page's at rest until HOME-TRIM-02, 2026-11-15/, null],
    [tests('homePages01'), /HOME-TRIM-02 \(2026-11-15\) changed it again: the Financial Software section is mounted with/, null],
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its note re-said, dated, saying what it said until then`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
  }
  // and the tests' titles it re-said — strings, so read in the code: the re-said words stand, and main's are gone
  const TITLES: ReadonlyArray<readonly [file: string, now: string, gone: string | null]> = [
    [tests('howTo01'), 'the plans leaf — and, since HOME-TRIM-02 (2026-11-15), the pages', 'the pillars leaf and the plans leaf, and nothing from the plans section'],
    [tests('howTo01'), 'Landing mounts the how-to once, with the door and the short view (HOME-TRIM-02)', 'Landing mounts the how-to once, with the door — first'],
    [tests('homePlans04'), 'but for the seven named differences', 'but for the six named differences'],
    [tests('homePlans04'), 'token for token — its whole view, the home page', null],
    [tests('homePages01'), 'T8 the home page, as HOME-TRIM-02 left it (2026-11-15;', 'T8 the home page, as HOME-TRIM-01 left it (2026-11-15):'],
  ];
  for (const [file, now, gone] of TITLES) {
    assert.ok(code(file).includes(now), `${file}: a title re-said — "${now}"`);
    if (gone) assert.ok(!code(file).includes(gone), `${file}: and main's title is gone — "${gone}"`);
  }
  const design = flat(whole('DESIGN.md'));
  assert.match(design, /under "What We Do" on the home page until HOME-TRIM-02 \(2026-11-15\), on \/financial-software — its own page since HOME-PAGES-01 \(2026-11-14\) — alone since, where the home page draws its short view/, 'DESIGN.md: the section\'s sentence re-said, dated');
  assert.doesNotMatch(design, /under "What We Do" — is a design change too/, 'and main\'s sentence is gone');
  // EVERY SOURCE FILE OF THE CHANGE — fifteen: this one, the five whose code changed, three whose notes alone did, six re-pointed tests. The handoff's
  // two files are the owner's own and are held byte for byte (T1); DESIGN.md, whose one sentence is re-said, is prose no guard reads.
  const CHANGED = [
    THIS,
    SECTION, LEAF, GLOBALS, LANDING, FS_PAGE,
    LAW, 'scripts/proofs/map.seeds.ts', 'src/lib/problemSheet.ts',
    ...['homePlans04', 'howTo01', 'homePages01', 'homeOrder01', 'homePanels02', 'pipelinePage01'].map(tests),
  ];
  assert.equal(new Set(CHANGED).size, 15);
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  // any quote under one of the brief's three stamps, in any of them, is the words that stamp dates — his request, his approval of the boards, his
  // approval of the corrected boards — exact
  for (const file of CHANGED) {
    const said = prose(file);
    for (const m of said.matchAll(/19:11 Manila: "([^"]+)"/g)) assert.equal(m[1], REQUEST, `${file}: under the 19:11 stamp, his request, exact`);
    for (const m of said.matchAll(/20:01 Manila: "([^"]+)"/g)) assert.equal(m[1], APPROVAL, `${file}: under the 20:01 stamp, his approval of the boards, exact`);
    for (const m of said.matchAll(/20:41(?: Manila)?: "([^"]+)"/g)) assert.equal(m[1], APPROVAL_OF_THE_CORRECTED, `${file}: under the 20:41 stamp, his approval of the corrected boards, exact`);
  }
  // HIS WORDS ARE THE SEVENTEEN BELOW: his request, the twelve rulings, the two beta notes, the two approvals. A straight double mark followed by twenty
  // or more characters of one of their sentences, from the sentence's start, opens a quote of him: what stands from there to the closing mark is his
  // words from that sentence on — to the end of the piece on file, or to a full stop — or this fails and says where the two part. A whole sentence of
  // his shorter than that is read too, and counted. Each file's count of the quotes read is held. NOT HELD: a quote that leaves his words before its
  // twentieth character, one that opens in the middle of a sentence, one in other marks, one in a code string; and the brief's other words (where this
  // sits, the build's four steps, what is not in this PR, the audit's nine items, the tests, what done means), which no file of the change quotes.
  const HIS_WORDS = [REQUEST, ...Object.values(RULING), ...BETA_NOTES, APPROVAL, APPROVAL_OF_THE_CORRECTED];
  assert.equal(HIS_WORDS.length, 17);
  // one span in the fifteen follows a sentence of his that far and is not his: an older brief's ruling, quoted in the file that built it. It is
  // excepted by name — that file, those words as they go on there — so the same words anywhere else, or going on any other way, are read against his
  const NOT_HIS: ReadonlyArray<readonly [file: string, opens: string, whose: string]> = [
    [LANDING, 'NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-PAGES-01 re-said its own:', 'HOME-TRIM-01, ruling b'],
  ];
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
  const shared: Record<string, number> = {};
  const SHARED = [REQUEST, BETA_NOTES[0], APPROVAL, APPROVAL_OF_THE_CORRECTED];
  for (const file of CHANGED) {
    const said = prose(file);
    for (let at = said.indexOf('"'); at > -1; at = said.indexOf('"', at + 1)) {
      const rest = said.slice(at + 1);
      let his = false;
      let parted = '';
      for (const text of HIS_WORDS) {
        for (const from of sentencesOf(text)) {
          let n = 0;
          while (from + n < text.length && rest[n] === text[from + n]) n += 1;
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') { his = true; if (SHARED.includes(text as never)) shared[file] = (shared[file] ?? 0) + 1; }
          else if (n >= 20 && !NOT_HIS.some(([where, opens]) => where === file && rest.startsWith(opens))) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece on file goes on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(NOT_HIS.map(([where, opens]) => count(prose(where), `"${opens}`)), [1], 'the excepted span stands once, where it is said to');
  // ruling j: the request, the first beta note and the two approvals — the words this brief shares with HOME-PAGES-01 and HOME-TRIM-01 — are quoted
  // only in files neither of their tests reads: this one and the leaf
  assert.deepEqual(Object.keys(shared).sort(), [LEAF, THIS].sort(), 'the shared words stand in the leaf and this file alone');
  assert.deepEqual(census, {
    [THIS]: 11, // the header: his request, the two beta notes, the two approvals; a sentence each of rulings a (T4), f and g (T2), l (T8); rulings d (T7) and j (T8) whole
    [SECTION]: 6, // rulings a, b, c, d, e and l
    [LEAF]: 7, // his request, the two beta notes, the two approvals, rulings e and l
    [GLOBALS]: 4, // rulings f, g, h and i, over the block
    [LANDING]: 4, // ruling a's sentence of the mounts, rulings h and k, ruling l's last sentence — at the mount
    [FS_PAGE]: 2, // ruling a's sentence of the mounts, ruling k
    [tests('homePlans04')]: 1, // ruling f, at the seventh difference
  }, 'each file\'s quotes of him, counted — thirty-five in seven of the fifteen: a quote that stood and no longer opens on his words leaves its file\'s count, and fails here');
});
