/**
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila; the board approved on the design canvas at 15:41) — THE PROFESSIONAL
 * SERVICES SECTION, AS DRAWN: the pillar's name and one line, six service tiles (one always picked), the picked door's picture and
 * words, how a proposal goes in three steps, the gold button to the form with the pick.
 *
 * The spec is a file: design-refs/home-services-01/Section-Reference.html ("Every value in its stylesheet is the design, and its
 * markup is the page at rest"), with its README beside it and the six pictures in public/brand/services/. The section is
 * src/components/landing/ServicesSection.tsx, which Landing.tsx mounts; its words are src/lib/proposalNeeds.ts's and
 * src/lib/homeActWords.ts's; its stylesheet is the reference's own, ported to src/app/globals.css under the house prefix. The form the
 * reference draws in place is HOME-SERVICES-02's, a later PR: nothing here builds it.
 *
 *   T1  the handoff landed — the README, the reference and the six pictures, byte for byte (sha256) and by size;
 *   T2  the tokens, named and valued as the README's three tables — the ten already in the app and the eleven HOME-PLANS-04 brought,
 *       each the reference's value behind the house prefix in globals.css :root; the six new ones declared once each as --ts-ps-*,
 *       their comments the README's "Used for", behind tailwind.config.ts's `ps` family and in DESIGN.md's table; the reference's
 *       :root holds those twenty-seven and no other;
 *   T3  the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the four differences
 *       named there; no hex and no rgb value typed; every class behind the prefix; every variable it reads declared and every new
 *       token read; it stands under the chip strip's rules and above the Financial Software section's; nothing else in the file
 *       reaches the section — not by its classes, its id, the state it is styled by or any data attribute it carries;
 *   T4  the page at rest — the section's render is the reference's markup, token for token (classes behind the house prefix,
 *       attributes in any order), but for the four differences this PR is: the tiles' hook (ruling h), the pictures' path in the
 *       app, the gold button a link to the form with the pick, and no form; Landing.tsx mounts it once;
 *   T5  each of the six doors — each render is the reference's markup with exactly the edits its own script makes for that pick,
 *       and no other: which tile is pressed, which picture shows, the title and line, step 1's chip, step 2's list — and the link;
 *   T6  the words — every word drawn is its leaf's, in order; the steps' first two are FORM_INTRO's halves and the third the form's
 *       thank-you; the form reads the five words it shares; the component types none and writes no template literal;
 *   T7  step 2 and the form — for each door the form, rendered, asks the modules question exactly when step 2 lists Modules;
 *   T8  the state — the picked door in React state, the first at first, nothing stored, no URL, no cookie; each tile picks its own;
 *   T9  the build — the services law's one line holds the pictures to the doors, both ways, by name; the six files are the six doors,
 *       shapes only; the two seeds are on file and each expects the law's own words;
 *   T10 the rulings — each quoted, dated, where it is built; Alex's words exact wherever they are quoted.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript), the README's tables, globals.css's token lines with their comments and the
 * pictures. No clock, no live call. What a browser must show — the look at 1440, 1024 and 390 with Full setup and with Bookkeeping
 * picked, no sideways scroll from 340px, the panel's height from one service to the next from 1024px — cannot be held here; it is in
 * the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import {
  ASK_BUDGET, ASK_TIMELINE, FORM_ASKS, FORM_INTRO, NEED_QUESTION, NO_MODULES_NEEDS, PROPOSAL_CTA, PROPOSAL_FORM_PATH, PROPOSAL_STEPS, SCOPED_BY_PROPOSAL,
  SERVICES, SERVICE_KINDS, SERVICE_NEEDS, SERVICE_PICTURES_PATH, ServicesLawError, formAsks, proposalFormHref, serviceDoor, servicePictureSrc, type ServiceNeed,
} from '../proposalNeeds';
import { BUILD_PILLAR } from '../homeActWords';
import { SEGMENT } from '../ds';
import { SERVICES_ANCHOR } from '../homeAnchors';
import ServicesSection, { ServicesView, type ServicesViewProps } from '@/components/landing/ServicesSection';
import WorkWithMeForm from '@/app/work-with-me/WorkWithMeForm';
import tailwindConfig from '../../../tailwind.config';
import { SEEDS as SERVICES_SEEDS } from '../../../scripts/proofs/services.seeds';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/home-services-01/README.md';
const REFERENCE = 'design-refs/home-services-01/Section-Reference.html';
const PICTURES = 'public/brand/services';
const GLOBALS = 'src/app/globals.css';
const LANDING = 'src/components/landing/Landing.tsx';
const SECTION = 'src/components/landing/ServicesSection.tsx';
const VOCAB = 'src/lib/proposalNeeds.ts';
const PILLARS = 'src/lib/homeActWords.ts';
const FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS_FILE = 'scripts/proofs/services.seeds.ts';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** React's escaping of text. */
const asHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
/** A replacement that must find its place exactly once. */
function once(html: string, re: RegExp, by: (...groups: string[]) => string): string {
  assert.equal([...html.matchAll(new RegExp(re.source, `${re.flags.replace('g', '')}g`))].length, 1, `${re} finds one place`);
  return html.replace(re, (...m: string[]) => by(...m));
}

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>",
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homePlans04.test.ts's reading, as it stands.)
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
 * THE FOUR DIFFERENCES the port names (globals.css, its header), applied to the reference's declarations:
 *   1. the colours are tokens — the reference's :root is dropped here, and every custom property it reads gains the house prefix;
 *   2. the fonts are the site's — 'Inter' and 'IBM Plex Mono' are --font-sans and --font-mono;
 *   3. the reference page's own ground (body) is not ported;
 *   4. the form is not ported here — section 4 whole, and the four rules of sections 5 and 6 that name only the form's elements.
 * Every class gains the house prefix: .ps → .ts-ps.
 */
const FORM_ONLY_RULES = ['.ps-fields', '.ps-close:hover, .ps-link__remove:hover, .ps-add:hover', '.ps-pick[aria-pressed="false"]:hover', '.ps-more:hover'];
function referencePorted(): string[] {
  const style = referenceStyle();
  const s4 = style.indexOf('/* ── 4 · the form, in place (HOME-SERVICES-02)');
  const s5 = style.indexOf('/* ── 5 · wider windows');
  assert.ok(s4 > -1 && s5 > s4, 'the reference\'s section 4 — the form — stands between its sections 3 and 5');
  const kept = declarations(uncommented(style.slice(0, s4) + style.slice(s5)));
  const dropped = kept.filter((d) => { const sel = d.split(' | ')[1]; return sel === ':root' || sel === 'body' || FORM_ONLY_RULES.includes(sel); });
  assert.deepEqual([...new Set(dropped.map((d) => d.split(' | ')[1]))], [':root', ...FORM_ONLY_RULES, 'body'], 'what is not ported: the :root, the four form-only rules, the page\'s own ground');
  return kept.filter((d) => !dropped.includes(d)).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    const port = decl.replace(/var\(--/g, 'var(--ts-').replace("'IBM Plex Mono', monospace", 'var(--font-mono)').replace("'Inter', sans-serif", 'var(--font-sans)');
    return `${media} | ${sel.replace(/\.ps(?=$|[^A-Za-z0-9])/g, '.ts-ps')} | ${port}`;
  });
}
/** The port: globals.css from the section's first rule to the Financial Software section's — the rules between the chip strip's and HOME-PLANS-04's. */
const PORT_OPEN = '.ts-ps {';
const NEXT_PORT = '.ts-fs-heading {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-ps and runs to the Financial Software section\'s first rule');
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
/** DESIGN.md's table under a heading, read the same way. */
function designTable(heading: string): Array<[name: string, value: string, use: string]> {
  const doc = whole('DESIGN.md');
  const from = doc.indexOf(`\n${heading}`);
  assert.ok(from > -1, `DESIGN.md has the section "${heading}"`);
  const end = doc.indexOf('\n## ', from + 1);
  return doc.slice(from, end < 0 ? doc.length : end).split('\n').filter((l) => l.startsWith('| `')).map((row) => {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value, `DESIGN.md: "${row}" names one token and one value`);
    return [name[1], value[1], cells[2]] as [string, string, string];
  });
}

/** THE TEN ALREADY IN THE APP — the README's first table. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['red', '197 48 48'],
  ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
  ['hero-gold-1', '255 236 178'], ['hero-gold-2', '248 203 90'], ['hero-gold-3', '236 178 62'], ['hero-on-gold', '#2A0F5C'],
];
/** THE ELEVEN HOME-PLANS-04 BROUGHT — the README's second table: reused by name and value, added by none. */
const SHARED: ReadonlyArray<readonly [name: string, value: string]> = [
  ['fs-white', '255 255 255'], ['fs-ink', '#2B2545'], ['fs-ink-soft', '#4A4560'], ['fs-ink-muted', '#6F6988'], ['fs-gold-text', '#8A6408'],
  ['fs-line', '#E9E4F2'], ['fs-rule', '#EEEAF5'], ['fs-chip-line', '#E4DFF0'], ['fs-button-line', '#CFC6EC'], ['fs-band-muted', '#D6CCF7'],
  ['fs-shadow', '33 10 94'],
];
/** THE SIX NEW WITH THIS SECTION — the README's third table. */
const NEW: ReadonlyArray<readonly [name: string, value: string]> = [
  ['ps-field-line', '#DCD5EC'], ['ps-wash', '#F6F2FE'], ['ps-art', '#F3EFFC'], ['ps-art-1', '#F8F5FE'], ['ps-art-2', '#ECE6FA'], ['ps-art-ring', '77 31 188'],
];
/** A colour the stylesheet reads at an alpha is stored as three channels; one it reads solid, as written. */
const isChannels = (value: string): boolean => /^\d+ \d+ \d+$/.test(value);

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text; comments and the whitespace that only lays the
 * file out (a run holding a newline) dropped, a lone space between two tags kept. A valueless attribute reads "true", as React writes
 * a data-* one; React writes a boolean attribute (hidden) as hidden="", and that reads "true" too. With `prefix`, every class gets the
 * house prefix — the reference's .ps-tile is the app's .ts-ps-tile. (homePlans04.test.ts's reading, and the boolean attribute.)
 */
function tokensOf(html: string, prefix: boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<!--')) continue;
    if (!t.startsWith('<')) {
      if (/^\s*$/.test(t)) { if (!t.includes('\n')) out.push('#text " "'); continue; }
      out.push(`#text ${JSON.stringify(t.replace(/\s+/g, ' '))}`);
      continue;
    }
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?)>$/.exec(t);
    assert.ok(tag, `a tag: ${t}`);
    if (tag[1]) { out.push(`</${tag[2]}>`); continue; }
    const attrs: Array<[string, string]> = [];
    for (const a of tag[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
      const value = a[2] === undefined || (a[1] === 'hidden' && a[2] === '') ? 'true' : a[2];
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
const textsOf = (html: string): string[] => tokensOf(html, false).filter((t) => t.startsWith('#text ')).map((t) => JSON.parse(t.slice('#text '.length)) as string);
/** The reference's section, at rest: from <section to its </section>. */
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
  return body.slice(body.indexOf('<section'), body.lastIndexOf('</section>') + '</section>'.length);
}
/** The reference script's own data — what its paint() draws each pick from. */
type ReferenceData = { services: Array<[need: string, title: string, line: string]>; asks: string[]; noModules: string[] };
function referenceData(): ReferenceData {
  const m = /\n {2}const DATA = (\{.*\});\n/.exec(referenceText());
  assert.ok(m, 'the reference script\'s DATA');
  return JSON.parse(m[1]) as ReferenceData;
}
/** The reference's section as its own script paints it for one pick: which tile is pressed, which picture shows, the title and line, step 1's chip, step 2's list. */
function paintedReference(need: string): string {
  const data = referenceData();
  const door = data.services.find(([n]) => n === need);
  assert.ok(door, `the reference has the door "${need}"`);
  const [, title, line] = door;
  const asksModules = !data.noModules.includes(need);
  let html = referenceSection();
  html = html.replace(/(<button class="ps-tile" type="button" aria-pressed=")(?:true|false)(" data-need="([a-z]+)">)/g, (_m, a: string, b: string, n: string) => `${a}${n === need}${b}`);
  html = html.replace(/(<img src="\.\.\/\.\.\/public\/brand\/services\/([a-z]+)\.svg" alt="" width="560" height="380" data-need="[a-z]+")(?: hidden)?>/g, (_m, a: string, n: string) => `${a}${n === need ? '' : ' hidden'}>`);
  html = once(html, /(<h3 class="ps-stage__title" aria-live="polite">)[^<]*(<\/h3>)/, (_m, a, b) => `${a}${asHtml(title)}${b}`);
  html = once(html, /(<p class="ps-stage__line">)[^<]*(<\/p>)/, (_m, a, b) => `${a}${asHtml(line)}${b}`);
  html = once(html, /(<span class="ps-chip ps-chip--picked" data-picked>[\s\S]*?<span>)[^<]*(<\/span><\/span>)/, (_m, a, b) => `${a}${asHtml(title)}${b}`);
  const asks = data.asks.filter((a) => asksModules || a !== 'Modules').map((a) => `<li class="ps-chip">${asHtml(a)}</li>`).join('');
  return once(html, /(<ul class="ps-chips ps-chips--asks" data-asks>)[\s\S]*?(<\/ul>)/, (_m, a, b) => `${a}${asks}${b}`);
}
/**
 * WHAT THIS PR BUILDS OF THE REFERENCE — its four differences, each named: the tiles carry data-done-for-you where the reference's
 * carry data-need (ruling h); a picture's path is the app's (public/ is served at /); the gold button is a link to the form's page with
 * the pick (the reference's own note on it: "HOME-SERVICES-01 builds this as a link to the form's page with the pick:
 * /work-with-me?need=<picked>."; the README: "The button is a link to the form's page with the pick."); and the form, HOME-SERVICES-02's,
 * is not drawn.
 */
function asBuilt(html: string, need: string): string {
  let out = html.replace(/(<button class="ps-tile" type="button" aria-pressed="(?:true|false)") data-need="/g, '$1 data-done-for-you="');
  out = out.replace(/src="\.\.\/\.\.\/public\/brand\/services\//g, 'src="/brand/services/');
  out = once(out, /<button class="ps-cta" type="button" aria-controls="ps-form">([^<]*)<\/button>/, (_m, words) => `<a class="ps-cta" href="${PROPOSAL_FORM_PATH}?need=${need}">${words}</a>`);
  const open = out.indexOf('<div class="ps-form" id="ps-form" hidden>');
  assert.ok(open > -1, 'the reference draws the form in place');
  let depth = 0;
  let end = -1;
  for (const m of out.slice(open).matchAll(/<div\b|<\/div>/g)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) { end = open + (m.index ?? 0) + '</div>'.length; break; }
  }
  assert.ok(end > open, 'the form closes');
  return out.slice(0, open) + out.slice(end);
}
const noop = (): void => {};
const render = (picked: ServiceNeed): string => renderToStaticMarkup(React.createElement(ServicesView, { picked, onPick: noop }));
/** Every element in a tree, depth first. Components are not called: the tiles and the link are drawn by the view itself. */
function elementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elementsOf(node.props.children as React.ReactNode)];
}
const renderForm = (need: ServiceNeed): string => renderToStaticMarkup(React.createElement(WorkWithMeForm, { initialNeed: need }));
const BANNED: Array<[RegExp, string]> = [
  [/\bfree\b/i, '"free"'], [/buy now/i, '"BUY NOW"'], [/don['’]t miss/i, '"don\'t miss"'], [/countdown|days left|hours left/i, 'a countdown'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'an emoji'],
];

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The eight files as handed over (c9fc8797-home-services-01-handoff.zip): bytes and sha256 of each. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 14920, 'ddab557825e67b227d177bc7e777d976933f074210fb17a7e8de06ed9b4bf38a'],
  [REFERENCE, 41226, '7a88eb11e9efa61d25a3f9370063110e73a84282aa737208d2ccf596158a23de'],
  [`${PICTURES}/setup.svg`, 3535, '95b279a49ea84b69e30fdfcb5b9cee299956ca3819af53b143eb50eeadb1ab3e'],
  [`${PICTURES}/maintenance.svg`, 1467, '5f941d7ed92db17965568b822f06c0afc11f942ec75f95a1c88d74718bbd7df4'],
  [`${PICTURES}/custom.svg`, 1710, 'b4ba6ff2abe65b265cb9867f30048364cf8d727be8bf36d8ee7160c04d16cdc3'],
  [`${PICTURES}/embed.svg`, 2582, '85defe1cec4f4253e9cae679eaf7a7c0c2973f0310ebaefb859e968d3b57b541'],
  [`${PICTURES}/bookkeeping.svg`, 5510, 'cfeb9dbc62968e208906f42c77d9158afd6798ba1d14d07e99e03bb312ff9e67'],
  [`${PICTURES}/unsure.svg`, 2010, 'ebf962984c16ebaa33cd91da9d2a1129605b068d0e157e6f6d30ab5340fb7711'],
];

test('T1 the handoff is in the tree — the README, the reference and the six pictures, byte for byte (sha256) and by size', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, 'design-refs/home-services-01')).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s three tables: ten already in the app and eleven HOME-PLANS-04 brought, the same values behind the house prefix; six new, declared once each in globals.css :root with the README\'s words, behind tailwind.config.ts\'s ps family and in DESIGN.md\'s table', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), KEPT, 'the README\'s first table');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**').map(([n, v]) => [n, v]), SHARED, 'its second');
  const fresh = readmeTable('**New with this section.**');
  assert.deepEqual(fresh.map(([n, v]) => [n, v]), NEW, 'its third');
  // the reference declares those twenty-seven, and no other
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], [...KEPT, ...SHARED, ...NEW].map(([n, v]) => [`--${n}`, v]), 'the reference\'s :root: the twenty-seven, in the README\'s order');
  // each is the app's token by the same name behind the house prefix, with the same value — declared once
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of [...KEPT, ...SHARED, ...NEW]) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal(globals.split('\n').filter((l) => new RegExp(`^\\s*--ts-${name}:`).test(l)).length, 1, `--ts-${name} declared once`);
  }
  // ruling g: "Add only the six new ones." — no --ts-ps-* but the six
  assert.deepEqual([...root.keys()].filter((k) => k.startsWith('--ts-ps-')), NEW.map(([n]) => `--ts-${n}`), 'the six, and no other --ts-ps-*');
  // each new token's line says what the README says it is for
  const tokenLines = whole(GLOBALS).split('\n').filter((l) => /^\s*--ts-ps-/.test(l));
  for (const [name, , use] of fresh) {
    const line = tokenLines.find((l) => l.trim().startsWith(`--ts-${name}:`));
    assert.ok(line, `--ts-${name}'s line`);
    assert.equal(/\/\*\s*(.*?)\s*\*\//.exec(line)?.[1], use, `--ts-${name}: "${use}"`);
  }
  // tailwind.config.ts's ps family: each new token, hex ones as the variable, channel ones with Tailwind's alpha
  const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, Record<string, string>>;
  assert.deepEqual(colors.ps, Object.fromEntries(NEW.map(([n, v]) => [n.slice('ps-'.length), isChannels(v) ? `rgb(var(--ts-${n}) / <alpha-value>)` : `var(--ts-${n})`])), 'the ps family');
  // DESIGN.md: the same six, the same values, the README's words
  assert.deepEqual(designTable('## The Professional Services section (HOME-SERVICES-01, 2026-11-12)'), fresh, 'DESIGN.md\'s table is the README\'s');
});

// ── T3 · THE STYLESHEET ──────────────────────────────────────────────────────

test('T3 the section\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the four named differences; no hex and no rgb value typed; every class behind the prefix; every variable it reads declared and every new token read; it stands between the chip strip and the Financial Software section; nothing else reaches the section', () => {
  const port = declarations(portCss());
  assert.deepEqual(port, referencePorted(), 'the port is the reference\'s stylesheet, as the four differences leave it');
  assert.ok(port.length > 100, `the port was read (${port.length} declarations)`);
  const text = portCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\((?!var\()/, 'no rgb value typed — rgb() only ever wraps a token');
  // every class it names carries the house prefix and is the section's own
  const selectors = [...new Set(port.map((d) => d.split(' | ')[1]))];
  for (const sel of selectors) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-ps(?:$|[-_])/, `${sel}: .${m[1]} is the section's, behind the prefix`);
  // every variable it reads is declared — the fonts by the layout — and each new token is read
  const root = rootOf(code(GLOBALS));
  const read = new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  for (const v of read) assert.ok(root.has(v) || v === '--font-sans' || v === '--font-mono', `${v} is declared`);
  for (const [name] of NEW) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read — no token without a reader`);
  // of the twenty-one the app already held, the port reads nineteen: the other two are the form's (HOME-SERVICES-02) — DESIGN.md says so
  assert.deepEqual([...KEPT, ...SHARED].map(([n]) => n).filter((n) => !read.has(`--ts-${n}`)), ['red', 'fs-gold-text'], 'the form\'s error and its eyebrow, read by nothing here yet');
  assert.ok(whole('DESIGN.md').includes('This PR\'s stylesheet reads nineteen of the twenty-one: `red` and `fs-gold-text` are the\nform\'s (its error and its eyebrow), and come with it in HOME-SERVICES-02.'), 'DESIGN.md says which two');
  // the two gradients on the board (ruling f): the gold button, the hero's golds at 135deg with hero-gold-2 under it; the frame's
  assert.ok(port.includes(' | .ts-ps-cta | background-image: linear-gradient(135deg, rgb(var(--ts-hero-gold-1)) 0%, rgb(var(--ts-hero-gold-2)) 52%, rgb(var(--ts-hero-gold-3)) 100%)'), 'the gold gradient — HOME-PLANS-04\'s');
  assert.ok(port.includes(' | .ts-ps-cta | background-color: rgb(var(--ts-hero-gold-2))'), 'hero-gold-2 under it');
  assert.equal(port.filter((d) => /gradient\(/.test(d)).length, 2, 'two gradients, and no other');
  // the one rule that hides what the section hides
  assert.ok(port.includes(' | .ts-ps [hidden] | display: none'), '.ts-ps [hidden] { display: none }');
  // where it stands: under the chip strip's rules, above the Financial Software section's port, which runs to the hero's
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const next = css.indexOf(NEXT_PORT);
  assert.equal(count(css, PORT_OPEN), 1, 'one port');
  assert.ok(at > css.lastIndexOf('.ts-chipfade') && next > at && css.indexOf('.ts-hero {') > next, 'the chip strip → this port → the Financial Software section\'s → the hero\'s');
  // nothing outside it names its classes, its id or the hooks its markup carries — but the rules of the two blocks beside it that are
  // styled by the same attributes, every part of each opening with one of that block's own classes: the Financial Software section's
  // (.ts-fs…: its switches by [aria-pressed], its plans by [data-picked]) and the top bar's menu (.ts-menu:not([hidden]), HERO-CREST-01).
  // This section wears none of their classes (each class it wears is ruled by its port, below), and no element around it wears one:
  // it is mounted directly under the page's root, whose classes are Tailwind's.
  const outside = css.slice(0, at) + css.slice(next);
  assert.doesNotMatch(outside, /\.ts-ps\b|\.ts-ps[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*ps/, 'and none reaches them through a class attribute selector');
  const hooks = new Set<string>(['aria-pressed', 'aria-live', 'aria-labelledby', 'hidden']);
  for (const need of SERVICE_NEEDS) for (const m of render(need).matchAll(/ (data-[\w-]+)="/g)) hooks.add(m[1]);
  assert.deepEqual([...hooks].sort(), ['aria-labelledby', 'aria-live', 'aria-pressed', 'data-asks', 'data-done-for-you', 'data-need', 'data-picked', 'data-step', 'hidden'], 'the hooks the section carries');
  // HOME-TRAVEL-01 (Alex, 2026-11-12): and the Travel Marketplace section's port, which stands above this one (.ts-tm…: its tiles by [aria-pressed],
  // what it hides by [hidden]) — every part of each such selector opens with one of that section's own classes, which no element here wears.
  // Until then the exception named the Financial Software section's and the top bar's menu alone: /^\.ts-(?:fs|menu)…/.
  const besideOwn = (sel: string): boolean => sel.split(',').every((one) => /^\.ts-(?:fs|menu|tm)(?:[-_][\w-]*)?(?![\w-])/.test(one.trim()));
  const landing = code(LANDING);
  assert.ok(landing.includes('\n  return (\n    <div className="min-h-screen bg-bg-terminal text-text-primary">\n') && landing.includes('\n      <ServicesSection />\n'), 'mounted directly under the page\'s root, which wears no ts- class');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1]));
  assert.ok(selectorsOutside.length > 50, `the rules outside the port were read (${selectorsOutside.length})`);
  for (const sel of selectorsOutside) {
    assert.ok(!sel.includes(`#${SERVICES_ANCHOR}`), `${sel}: no rule outside the port reaches the section by its id`);
    if (besideOwn(sel)) continue;
    for (const hook of hooks) assert.ok(!sel.includes(`[${hook}`), `${sel}: no rule outside the port reaches the section by [${hook}]`);
  }
  // what the section wears is ruled by the port — each class itself
  const ruled = new Set(selectors.flatMap((sel) => sel.match(/\.ts-[A-Za-z][\w-]*/g) ?? []).map((c) => c.slice(1)));
  const worn = [...code(SECTION).matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
  assert.ok(worn.length > 25, `the section's classes were read (${worn.length})`);
  for (const c of worn) assert.ok(ruled.has(c), `.${c} is ruled by the port`);
});

// ── T4 · THE PAGE AT REST ────────────────────────────────────────────────────

test('T4 the page at rest is the reference\'s markup, token for token, but for the four differences this PR is — the tiles\' hook, the pictures\' path, the gold link with the pick, no form; Landing.tsx mounts it once', () => {
  const first = SERVICES[0].need;
  assert.equal(paintedReference(first), referenceSection(), 'the reference\'s markup is the page at rest: its script paints the first door as drawn');
  const app = tokensOf(render(first), false);
  assert.deepEqual(app, tokensOf(asBuilt(referenceSection(), first), true), 'the section, at rest, is the reference\'s, as built');
  assert.ok(app.length > 200, `the render was read (${app.length} tokens)`);
  // the four differences, each where it is meant to be and nowhere else
  const html = render(first);
  assert.equal(count(html, 'data-done-for-you="'), 6, 'six tiles carry the hook (ruling h)');
  assert.equal(count(html, ' data-need="'), 6, 'six pictures keep the reference\'s data-need');
  assert.equal(count(html, `src="${SERVICE_PICTURES_PATH}/`), 6, 'six pictures, from public/brand/services');
  assert.equal(count(html, '<a '), 1, 'one link');
  assert.equal(count(html, `href="${PROPOSAL_FORM_PATH}?need=${first}"`), 1, 'the gold link: the form with the first door');
  assert.doesNotMatch(html, /ps-form|aria-controls|<form|<input|<textarea/, 'no form — HOME-SERVICES-02\'s');
  // the page mounts it once, imported once
  const landing = code(LANDING);
  assert.equal(count(landing, '<ServicesSection />'), 1, 'mounted once');
  assert.equal(landing.split('\n').filter((l) => l === "import ServicesSection from './ServicesSection';").length, 1, 'imported once, on a line of its own');
});

// ── T5 · EACH DOOR ───────────────────────────────────────────────────────────

test('T5 each of the six doors — each render is the reference\'s markup with exactly the edits its own script makes for that pick, and no other; one tile always pressed and one picture shown', () => {
  const data = referenceData();
  assert.deepEqual(data.services, SERVICES.map((s) => [s.need, s.title, s.line]), 'the reference\'s doors are SERVICES, in order — the same words');
  assert.deepEqual(data.asks, FORM_ASKS.map((a) => a.name), 'its asks are step 2\'s, in order');
  assert.deepEqual(data.noModules, [...NO_MODULES_NEEDS], 'and its rule is the form\'s: no modules for bookkeeping');
  for (const need of SERVICE_NEEDS) {
    const html = render(need);
    assert.deepEqual(tokensOf(html, false), tokensOf(asBuilt(paintedReference(need), need), true), `${need}: the reference as its script paints it, as built`);
    assert.equal(count(html, 'aria-pressed="true"'), 1, `${need}: one tile pressed`);
    assert.match(html, new RegExp(`<button class="ts-ps-tile" type="button" aria-pressed="true" data-done-for-you="${need}">`), `${need}: its own`);
    assert.equal((html.match(/<img [^>]*>/g) ?? []).filter((img) => !img.includes('hidden=""')).length, 1, `${need}: one picture shown`);
    assert.match(html, new RegExp(`<img src="${SERVICE_PICTURES_PATH}/${need}\\.svg" alt="" width="560" height="380" data-need="${need}"/>`), `${need}: its own, shown`);
    assert.equal(count(html, `href="${proposalFormHref(need)}"`), 1, `${need}: the link carries the pick`);
  }
});

// ── T6 · THE WORDS ───────────────────────────────────────────────────────────

test('T6 every word drawn is its leaf\'s, in order; the steps come from the form\'s lead and its thank-you; the form reads the five words it shares; the component types none and writes no template literal', () => {
  for (const need of SERVICE_NEEDS) {
    const door = serviceDoor(need);
    assert.deepEqual(textsOf(render(need)), [
      BUILD_PILLAR.heading, ...BUILD_PILLAR.paragraphs, NEED_QUESTION,
      ...SERVICES.flatMap((s) => (s.kind === null ? [s.title] : [s.title, s.kind])),
      door.title, door.line,
      PROPOSAL_STEPS.pick, door.title,
      '2', PROPOSAL_STEPS.tell, ...formAsks(need),
      '3', PROPOSAL_STEPS.read, PROPOSAL_STEPS.note,
      PROPOSAL_CTA, SCOPED_BY_PROPOSAL,
    ], `${need}: every word, in order`);
  }
  // the words, as the README's "Words" table has them
  assert.deepEqual([...BUILD_PILLAR.paragraphs], ['Hands-on services, tailored to your needs.'], 'the one line (ruling b)');
  assert.equal(NEED_QUESTION, 'What do you need?');
  assert.deepEqual(SERVICE_KINDS, { project: 'Project', monthly: 'Monthly' }, 'the two kinds');
  assert.deepEqual({ ...PROPOSAL_STEPS }, { pick: 'Pick what fits', tell: 'Tell me about your business', read: 'I read every one of these myself', note: 'You’ll hear from me by email.' });
  assert.deepEqual(FORM_ASKS.map((a) => a.name), ['Your business', 'Modules', 'Timeline', 'Budget range', 'What done looks like'], 'step 2\'s short names, in the form\'s order');
  assert.deepEqual([ASK_TIMELINE, ASK_BUDGET], ['Timeline', 'Budget range'], 'two of them the form\'s labels as they stand');
  assert.deepEqual([PROPOSAL_CTA, SCOPED_BY_PROPOSAL], ['Send a project proposal →', 'Scoped by proposal'], 'the two moved words (ruling f)');
  // "The first two come from FORM_INTRO, the last two from the form's thank-you line."
  const lower = (s: string): string => `${s[0].toLowerCase()}${s.slice(1)}`;
  assert.equal(FORM_INTRO, `${PROPOSAL_STEPS.pick} below and ${lower(PROPOSAL_STEPS.tell)}.`, 'steps 1 and 2 are the form\'s lead, in two');
  const form = code(FORM);
  assert.ok(form.includes('Got it — {PROPOSAL_STEPS.read}. You&apos;ll hear from me at {submittedEmail}.'), 'step 3 is the form\'s thank-you, which reads it from the leaf');
  // the form reads the five words it shares, each in its own place, and types none of them (ruling e)
  for (const [name, at] of [['NEED_QUESTION', '<span className={CONTROL.label}>{NEED_QUESTION}</span>'], ['ASK_TIMELINE', '<span className={CONTROL.label}>{ASK_TIMELINE}</span>'], ['ASK_BUDGET', '<span className={CONTROL.label}>{ASK_BUDGET}</span>'], ['SCOPED_BY_PROPOSAL', '<span className="ml-auto font-mono text-xs italic text-text-faint">{SCOPED_BY_PROPOSAL}</span>']] as const) {
    assert.equal(count(form, at), 1, `the form reads ${name} where it typed it`);
  }
  for (const w of [NEED_QUESTION, SCOPED_BY_PROPOSAL, PROPOSAL_STEPS.read, ASK_BUDGET]) assert.ok(!form.includes(w), `the form types "${w}" no more`);
  assert.doesNotMatch(form, />\s*Timeline\s*<|['"]Timeline['"]/, 'nor "Timeline"');
  const formHtml = renderForm('setup');
  for (const w of [NEED_QUESTION, ASK_TIMELINE, ASK_BUDGET, SCOPED_BY_PROPOSAL]) assert.equal(count(formHtml, `>${asHtml(w)}</span>`), 1, `the form still shows "${w}" once`);
  // no fixed price and no sales tone in any new word
  for (const w of [...BUILD_PILLAR.paragraphs, NEED_QUESTION, ...Object.values(SERVICE_KINDS), ...Object.values(PROPOSAL_STEPS), ...FORM_ASKS.map((a) => a.name), PROPOSAL_CTA, SCOPED_BY_PROPOSAL]) {
    assert.doesNotMatch(w, /\$\s*\d/, `no fixed price: "${w}"`);
    for (const [re, what] of BANNED) assert.doesNotMatch(w, re, `no ${what}: "${w}"`);
  }
  // the component types none: no word it draws stands in its code; its step numbers are their places; no template literal, no colour
  const section = code(SECTION);
  for (const w of new Set(SERVICE_NEEDS.flatMap((need) => textsOf(render(need))))) {
    if (/^\d$/.test(w)) continue;
    assert.ok(!section.includes(w), `ServicesSection.tsx does not type "${w}"`);
  }
  assert.ok(section.includes(': i + 1}'), 'a step\'s number is its place');
  assert.ok(!section.includes('`'), 'no template literal — the link is the leaf\'s');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'no colour typed');
  for (const f of [LANDING, SECTION]) for (const w of [PROPOSAL_CTA, SCOPED_BY_PROPOSAL, NEED_QUESTION]) assert.ok(!code(f).includes(w), `${f} types "${w}" nowhere`);
});

// ── T7 · STEP 2 AND THE FORM ─────────────────────────────────────────────────

test('T7 step 2 follows the form\'s own rule — for each door the form, rendered, asks the modules question exactly when step 2 lists Modules (ruling e: a test that renders the form for each door and holds the two equal)', () => {
  let asked = 0;
  for (const need of SERVICE_NEEDS) {
    const form = renderForm(need);
    assert.equal(count(form, `class="${SEGMENT.item(true)}" data-need="`), 1, `${need}: one chip picked`);
    assert.ok(form.includes(`class="${SEGMENT.item(true)}" data-need="${need}"`), `${need}: the form opens with this door picked`);
    const modules = /\bdata-modules\b/.test(form);
    assert.equal(modules, formAsks(need).includes('Modules'), `${need}: the form ${modules ? 'asks' : 'does not ask'} the modules question, and step 2 ${modules ? 'lists' : 'drops'} Modules`);
    if (modules) asked += 1;
  }
  assert.equal(asked, 5, 'five doors ask it; bookkeeping does not');
  assert.deepEqual(SERVICE_NEEDS.filter((n) => !formAsks(n).includes('Modules')), ['bookkeeping'], 'step 2 drops Modules for bookkeeping alone');
  assert.match(code(FORM), /const isBookkeeping = need === 'bookkeeping';/, 'the form keeps its own rule, as SERVICES-01 pinned it');
});

// ── T8 · THE STATE ───────────────────────────────────────────────────────────

test('T8 the picked door is React state — the first door at first, nothing stored, no URL, no cookie; each tile picks its own door', () => {
  const section = code(SECTION);
  assert.match(section, /export default function ServicesSection\(\) \{\n {2}const \[picked, setPicked\] = useState<ServiceNeed>\(SERVICES\[0\]\.need\);\n {2}return <ServicesView picked=\{picked\} onPick=\{setPicked\} \/>;\n\}/, 'one value in React state: the picked door, the first at first');
  assert.equal((section.match(/\buseState\b/g) ?? []).length, 2, 'one piece of state — its import and its one call');
  assert.ok(section.includes("import { useState, type ReactNode } from 'react';"), 'React\'s own state, and nothing else of React\'s but a type');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|cookies\(|useSearchParams|useRouter|usePathname|window\.|history\.|\blocation\b|useEffect|useId/, 'no storage, no URL, no cookie, no effect, no generated id (ruling a)');
  assert.equal(renderToStaticMarkup(React.createElement(ServicesSection)), render(SERVICES[0].need), 'a fresh page shows the first door');
  // each tile, pressed, picks its own door — and the view draws the door it is handed
  const picks: string[] = [];
  const props: ServicesViewProps = { picked: 'bookkeeping', onPick: (need) => { picks.push(need); } };
  const tiles = elementsOf(ServicesView(props)).filter((el) => el.type === 'button' && typeof el.props['data-done-for-you'] === 'string');
  assert.deepEqual(tiles.map((el) => el.props['data-done-for-you']), [...SERVICE_NEEDS], 'six tiles, in the doors\' order');
  assert.deepEqual(tiles.map((el) => el.props['aria-pressed']), SERVICE_NEEDS.map((n) => n === 'bookkeeping'), 'the picked one is pressed, and only it');
  for (const tile of tiles) (tile.props.onClick as () => void)();
  assert.deepEqual(picks, [...SERVICE_NEEDS], 'each tile picks its own door');
  // a door no tile holds is refused by name, never drawn as another
  assert.throws(() => serviceDoor('audit' as ServiceNeed), (e: unknown) => e instanceof ServicesLawError && /no door holds the key "audit"/.test(e.message));
});

// ── T9 · THE BUILD ───────────────────────────────────────────────────────────

test('T9 the build holds the pictures to the doors, both ways, by name, on the services law\'s one line; the six files are the six doors, shapes only; the two seeds are on file and each expects the law\'s own words', () => {
  // the six files are the six doors' keys, and each door's picture is served at its key
  assert.deepEqual(readdirSync(resolve(ROOT, PICTURES)).sort(), SERVICE_NEEDS.map((n) => `${n}.svg`).sort(), 'one picture per door, named by its key — and no other file');
  for (const need of SERVICE_NEEDS) assert.equal(servicePictureSrc(need), `/brand/services/${need}.svg`, `${need}: served from public/`);
  // shapes only (README: "no text, no script, no image, no outside reference"), each 560 × 380
  for (const need of SERVICE_NEEDS) {
    const svg = whole(`${PICTURES}/${need}.svg`);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 560 380"/, `${need}.svg: an svg, 560 × 380`);
    assert.doesNotMatch(svg, /<text|<script|<image|<foreignObject|href|url\(|@import|on[a-z]+=/i, `${need}.svg: shapes only`);
  }
  // the law: the services law's one line (:710) holds both directions, by name, after the module's own law and before its verdict
  const line = code(LAW).split('\n')[709];
  const NO_PICTURE = 'for (const s of SERVICES) if (!pictures.includes(`${s.need}.svg`)) violations.push(`services: the door "${s.need}" has no picture — public/brand/services/${s.need}.svg is not on file (HOME-SERVICES-01, ruling d: one picture per door, named by its key)`);';
  const NO_DOOR = 'for (const f of pictures) if (!SERVICES.some((s) => `${s.need}.svg` === f)) violations.push(`services: public/brand/services/${f} is the picture of no door — the doors are ${SERVICES.map((s) => s.need).join(\', \')} (HOME-SERVICES-01, ruling d: one picture per door, named by its key)`);';
  const READ = "const pictures = readdirSync(resolve(ROOT, 'public/brand/services')).sort();";
  for (const piece of [READ, NO_PICTURE, NO_DOOR]) assert.equal(count(line, piece), 1, `:710 holds ${piece.slice(0, 50)}…`);
  const pushAt = line.indexOf('violations.push(...servicesLaw({ throwOnFail: false, migrations: ALL_MIGRATIONS }));');
  assert.ok(pushAt > -1 && pushAt < line.indexOf(READ) && line.indexOf(NO_DOOR) < line.indexOf('console.log('), 'after the module\'s own law, before the verdict that counts them');
  assert.equal(count(code(LAW), READ), 1, 'read in one place');
  // the seeds: each find occurs once in its file; each expect is the law's own words for that change
  assert.ok(existsSync(resolve(ROOT, SEEDS_FILE)), 'the seeds are on file');
  assert.deepEqual(SERVICES_SEEDS.map((s) => s.file), [VOCAB, VOCAB]);
  for (const seed of SERVICES_SEEDS) assert.equal(count(whole(seed.file), seed.find), 1, `${seed.name}: its find occurs once`);
  const [added, removed] = SERVICES_SEEDS;
  assert.ok(added.replace.startsWith(added.find) && /need: 'audit'/.test(added.replace) && !existsSync(resolve(ROOT, PICTURES, 'audit.svg')), 'a: a seventh door, and no picture of it on file');
  assert.equal(added.expect, 'services: the door "${s.need}" has no picture — public/brand/services/${s.need}.svg is not on file'.replaceAll('${s.need}', 'audit'), 'a: the law\'s words for it');
  assert.ok(removed.find.includes("need: 'unsure'") && removed.replace === '' && existsSync(resolve(ROOT, PICTURES, 'unsure.svg')), 'b: the door "unsure" leaves, its picture stays');
  assert.equal(removed.expect, 'services: public/brand/services/${f} is the picture of no door'.replace('${f}', 'unsure.svg'), 'b: the law\'s words for it');
});

// ── T10 · THE RULINGS ────────────────────────────────────────────────────────

test('T10 each ruling is quoted, dated, where it is built; Alex\'s words exact wherever they are quoted', () => {
  const said = (file: string): string => flat(comments(file).replace(/^\s*(\*|\/\/)/gm, ' '));
  const section = said(SECTION);
  const vocab = said(VOCAB);
  const pillars = said(PILLARS);
  const globals = said(GLOBALS);
  const landing = said(LANDING);
  const law = said(LAW);
  const form = said(FORM);
  for (const [file, notes] of [[SECTION, section], [VOCAB, vocab], [PILLARS, pillars], [GLOBALS, globals], [LANDING, landing], [LAW, law], [FORM, form], ['tailwind.config.ts', said('tailwind.config.ts')], [SEEDS_FILE, said(SEEDS_FILE)]] as const) {
    assert.ok(notes.includes('HOME-SERVICES-01'), `${file} names the brief`);
    assert.ok(notes.includes('2026-11-12'), `${file} dates it`);
  }
  assert.ok(whole('DESIGN.md').includes('## The Professional Services section (HOME-SERVICES-01, 2026-11-12)'), 'DESIGN.md names and dates it');
  assert.ok(section.includes('design-refs/home-services-01/Section-Reference.html') && globals.includes('design-refs/home-services-01/Section-Reference.html'), 'the spec is named where it is built');
  // a — the state
  assert.ok(section.includes('"STATE. The picked door, in React state only. No storage, no URL, no cookie; a reload starts at the first door."'), 'a, in the section');
  // b — the paragraph
  assert.ok(pillars.includes('"THE PARAGRAPH IS REPLACED. BUILD_PILLAR.paragraphs holds the one new line, "Hands-on services, tailored to your needs."; his paragraph is quoted, dated, in the leaf\'s note. HOME-FINISH-02\'s "Approved description" is this line now."'), 'b, beside the line');
  // c — the doors' kinds
  assert.ok(vocab.includes('"THE DOORS ARE SERVICES\'. Titles, lines and order unchanged. Each door gains a kind: Project (setup, custom, embed), Monthly (maintenance, bookkeeping), none (unsure). One home per door\'s words is the aim; the audit proposes where."'), 'c, beside the doors');
  // d — the pictures, in the section and at the build's law
  assert.ok(section.includes('"THE PICTURES ARE FILES, one per door, named by its key. All six are in the page and one shows. They are decorative (alt=""): the title and line beside each say what it shows. A door with no picture, or a picture with no door, fails the build by name."'), 'd, in the section');
  assert.ok(law.includes('“A door with no picture, or a picture with no door, fails the build by name.”'), 'd, at the build\'s law');
  // e — the steps' words and the form's rule
  assert.ok(vocab.includes('"THE STEPS\' WORDS ARE NEW and live beside FORM_INTRO. Step 2 follows the form\'s own rule (no modules for bookkeeping): one rule read by both, or a test that renders the form for each door and holds the two equal. The form changes only where it must read a word or a rule it now shares with the landing ("What do you need?" is one)."'), 'e, beside the words');
  assert.ok(form.includes('"The form changes only where it must read a word or a rule it now shares with the landing ("What do you need?" is one)."'), 'e, at the form');
  // f — the gold button, in the section; its gradient at the stylesheet
  assert.ok(section.includes('"THE GOLD BUTTON replaces the purple one here; PRIMARY_CTA keeps its other users. "Send a project proposal →" and "Scoped by proposal" move from Landing.tsx into a leaf. The gold gradient is HOME-PLANS-04\'s; the picture\'s frame is the second gradient, on the board."'), 'f, in the section');
  assert.ok(globals.includes('"The gold gradient is HOME-PLANS-04\'s; the picture\'s frame is the second gradient, on the board."'), 'f, at the stylesheet');
  // g — the colours
  assert.ok(globals.includes('"COLOURS. Every colour this section shares with HOME-PLANS-04 is that PR\'s token, by value (the README maps each). Add only the six new ones."'), 'g, beside the tokens');
  // h — the hook
  assert.ok(section.includes('"HOOKS. data-done-for-you={need} moves to the tiles."'), 'h, in the section');
  // his paragraph, quoted and dated in the leaf's note (ruling b)
  assert.ok(pillars.includes('"Want to build your own system or something customized for your business? From full setup and custom development to integrations, ongoing maintenance, and bookkeeping, Temple Stuart offers hands-on services tailored to your needs."'), 'his paragraph, word for word');
  // Alex's own words, exact, wherever a file of this change quotes them after their time ("15:16 Manila: "…", "15:41 Manila: "…"): a quote
  // of his 15:16 words, as the brief quotes them, is whole pieces of them — each piece one of the brief's own, cut only at its elision marks
  // (…) — in his order; a quote of his 15:41 words is the whole
  const WORDS_1516 = 'do we have like a form under the table that adjusts questions being asked by what you click? … remove that text about and replace with like an image that SHOWS what and why and how, rather than telling with words … obviously following the style of the page weve built thus far since this is a continuation of all that is above it!';
  const WORDS_1541 = 'yea, I approve , this looks good, lets build this for sure';
  const SEGMENTS_1516 = WORDS_1516.split('…').map((p) => p.trim());
  const excerptOf = (quote: string): boolean => {
    let from = 0;
    for (const piece of quote.split('…').map((p) => p.trim()).filter(Boolean)) {
      const at = SEGMENTS_1516.indexOf(piece, from);
      if (at < 0) return false;
      from = at + 1;
    }
    return true;
  };
  assert.ok(!excerptOf('form under the table') && !excerptOf('SHOWS what') && excerptOf(SEGMENTS_1516[1]), 'a piece counts only whole');
  const quoted: Record<string, { at1516: string[]; at1541: string[] }> = {};
  for (const file of [SECTION, VOCAB, PILLARS, GLOBALS, LANDING, LAW, FORM, SEEDS_FILE, 'tailwind.config.ts']) {
    const notes = said(file);
    quoted[file] = { at1516: [...notes.matchAll(/15:16 Manila: "([^"]+)"/g)].map((m) => m[1]), at1541: [...notes.matchAll(/15:41(?: Manila)?: "([^"]+)"/g)].map((m) => m[1]) };
    for (const q of quoted[file].at1516) assert.ok(excerptOf(q), `${file}: "${q.slice(0, 40)}…" is Alex's 15:16 words, whole pieces, in order`);
    for (const q of quoted[file].at1541) assert.equal(q, WORDS_1541, `${file}: his 15:41 words, exact`);
  }
  assert.deepEqual(quoted[SECTION].at1516, [WORDS_1516], 'the section quotes the 15:16 words whole');
  assert.deepEqual([quoted[SECTION].at1541.length, quoted[VOCAB].at1541.length], [1, 1], 'and the 15:41 words, in the section and beside the words');
  assert.ok(quoted[PILLARS].at1516.length === 1 && quoted[VOCAB].at1516.length === 1, 'the leaves quote the 15:16 words once each');
});
