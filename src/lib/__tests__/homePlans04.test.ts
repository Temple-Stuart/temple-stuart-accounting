/**
 * HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila; the board approved on the design canvas at 14:30) — THE FINANCIAL
 * SOFTWARE SECTION, AS DRAWN: "What We Do" over it, the pillar's name and one line, the map of the 25 tools, three plan cards
 * and the all-three band, the link to /pricing.
 *
 * The spec is a file: design-refs/home-plans-04/Section-Reference.html ("Every value in its stylesheet is the design, and its
 * markup is the page at rest"), with its README beside it. The section is src/components/landing/HowToSection.tsx over
 * src/lib/howTo.ts (planMapView); "What We Do" is Landing.tsx's heading box; the stylesheet is the reference's own, ported to
 * src/app/globals.css under the house prefix.
 *
 * AFTER THE BUILD — Alex's notes on the built page (2026-11-12), three, each a NAMED DIFFERENCE from the reference that these
 * tests apply to it before they compare, each once, and no other:
 *   · "i like how about us and What We do were the same.  About us is better size... IMO..." — the heading's h2 wears the act
 *     headings' type (About Us's), not the eyebrow; its box is the reference's. The port leaves out .fs-eyebrow.
 *   · "then 13 of 25 tools is tacky, we dont need that to tell us, we can just count..." — the map draws no count. The port
 *     leaves out .fs-map__count and .fs-map__figure; each card's count and the band's stay.
 *   · "while youre at it, remove that word alwasy from personal... looks tacky too" — the Personal pill says "Personal", the
 *     first part of the plans' names (planMapView's base); PERSONAL_ALWAYS stays in its leaf, undrawn.
 *
 *   T1  the handoff landed — the README and the reference, byte for byte (sha256) and by size;
 *   T2  the tokens, named and valued as the README's two tables — the fourteen already in the app, each the reference's value
 *       behind the house prefix in globals.css :root, declared once; the seventeen new ones, declared once each as --ts-fs-*,
 *       behind tailwind.config.ts's `fs` family and in DESIGN.md's table — its rows and their comments in globals.css the
 *       README's, column for column; the reference's :root holds those thirty-one and no other;
 *   T3  the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the five
 *       differences named there (the last two Alex's notes); no hex and no rgb value typed; every variable it reads is
 *       declared and every new token is read; it stands under the chip strip's rules and above the hero's block; nothing else
 *       in the file reaches the section — not by its classes, its id, the state it is styled by or any data attribute it carries;
 *   T4  the page at rest — Landing.tsx's heading box and the section's render are the reference's markup, token for token
 *       (classes behind the house prefix, attributes in any order), with Alex's three notes applied, each once;
 *   T5  the four states — each render is the reference's markup, with his notes applied, and exactly the edits its own script
 *       makes, and no other: the switch's pressed state and mark, every tool's lit state and mark, the picked plan and its tag;
 *   T6  the words — every word drawn is its leaf's, in order; the three new words are src/lib/howTo.ts's and both numbers are
 *       computed; the switches and the Personal pill say the parts of the plans' names; the component types none, and writes
 *       no template literal;
 *   T7  the data — a tool's module is the module of the capability rows that name it (13 · 10 · 2); the lit tools 13 · 23 ·
 *       15 · 25; the map law refuses a tool of no module or of two, and a name that is not one part per module — by name; the
 *       law reads the sheet it is handed and the view the rows it is handed; both laws end the leaf, at its top level; the
 *       known difference (Bill Pay, FP&A and Brokerage stand in Personal's steps, the map follows the rows);
 *   T8  the state — two booleans in React state, both off at first, nothing stored, no browser global named; the switches
 *       turn them; every plan's button opens the door;
 *   T9  the build — the law suite's map law re-runs mapLaw and puts each violation on the build's violations, by name, and
 *       its seeds are on file;
 *   T10 the rulings — each quoted, dated, where it is built, and Alex's notes on the built page with them; what left the page
 *       stays in its leaf, undrawn, with its note.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the
 * digests, the reference (HTML, which the reader splits as TypeScript — referenceText), the token tables' rows (markdown,
 * and globals.css's token lines with their comments) and each seed's find (prove.ts reads the whole file). No clock, no
 * live call. What a browser must show — the look at 1440, 1024 and 390, no sideways scroll from 340px, the same height in all
 * four states — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { PROBLEM_SHEET, type ToolName } from '../problemSheet';
import { CAPABILITY_GROUPS, EARLY_ACCESS_CTA, LAUNCH_PLACEHOLDER, PLANS, PLANS_HEADLINE, PLANS_SUBHEAD, type CapabilityGroup, type ModuleId, type Plan } from '../offer/plans';
import {
  ADD_BUSINESS, ADD_TRADE, COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, HOW_TO_SECTIONS, HowToLawError, PERSONAL_ALWAYS, PLAN_MARKS, WHAT_YOU_RUN_LABEL, YOUR_PLAN,
  allToolsWords, mapLaw, nameParts, ofToolsWords, planCardSteps, planMapView, toolCountWords, toolModule,
} from '../howTo';
import { PLAN_PILLAR, WHAT_WE_DO_HEADING } from '../homeActWords';
import HowToSection, { HowToView, type HowToViewProps } from '@/components/landing/HowToSection';
import tailwindConfig from '../../../tailwind.config';
import { SEEDS as MAP_SEEDS } from '../../../scripts/proofs/map.seeds';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/home-plans-04/README.md';
const REFERENCE = 'design-refs/home-plans-04/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const LANDING = 'src/components/landing/Landing.tsx';
const SECTION = 'src/components/landing/HowToSection.tsx';
const LEAF = 'src/lib/howTo.ts';
const PILLARS = 'src/lib/homeActWords.ts';
const PLANS_SECTION = 'src/components/offer/PlansSection.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A whole file's digest, through the reader: the two halves put back together are the file (sourceText.ts rejoin). */
const digest = (file: string): string => sha256(rejoin(code(file), comments(file)));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** React's escaping of text. */
const asHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed by code()) as one line per declaration, in order:
 * "<media> | <selector> | <property>: <value>", whitespace collapsed. Two levels — rules, and rules inside @media.
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
/**
 * The reference, whole. It is HTML, and the reader splits a file as TypeScript: the apostrophe in "landing's", in the file's
 * opening comment, opens a string to it, so neither half alone is the stylesheet or the markup. Both halves together are the
 * file (rejoin — the digest in T1 is taken the same way), and each part below removes its own comments as its language writes them.
 */
const referenceText = (): string => rejoin(code(REFERENCE), comments(REFERENCE));
/** The reference's stylesheet: what stands between <style> and </style>, its CSS comments removed. */
function referenceCss(): string {
  const html = referenceText();
  assert.equal(count(html, '<style>'), 1, 'one stylesheet in the reference');
  return html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}
/** A stylesheet block's declarations as name → value (the reference's :root, or globals.css's). */
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
/** The port: globals.css from the section's first rule to the hero's — the rules between the chip strip's and HERO-CREST-01's. */
const PORT_OPEN = '.ts-fs-heading {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf('.ts-hero {');
  assert.ok(at > -1 && end > at, 'the port opens at .ts-fs-heading and runs to the hero\'s block');
  return css.slice(at, end);
}

/** The README's "Tokens" section: the rows of the table under one bold lead ("**Already in the app.**", "**New with this section.**"). */
function readmeTable(lead: string): Array<[name: string, value: string]> {
  const doc = code(README);
  const section = doc.slice(doc.indexOf('\n## Tokens'), doc.indexOf('\n## ', doc.indexOf('\n## Tokens') + 1));
  const from = section.indexOf(lead);
  assert.ok(from > -1, `the README's Tokens section has "${lead}"`);
  const lines = section.slice(from).split('\n').slice(1);
  const rows: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith('|')) { started = true; rows.push(line); continue; }
    if (started) break;
  }
  return rows.filter((l) => l.startsWith('| `')).map((row) => {
    const cells = row.split('|').slice(1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value, `${README}: "${row}" names one token and one value`);
    return [name[1], value[1]] as [string, string];
  });
}
/** DESIGN.md's table under a heading, read the same way. */
function designTable(heading: string): Array<[name: string, value: string]> {
  const doc = code('DESIGN.md');
  const from = doc.indexOf(`\n${heading}`);
  assert.ok(from > -1, `DESIGN.md has the section "${heading}"`);
  const end = doc.indexOf('\n## ', from + 1);
  return doc.slice(from, end < 0 ? doc.length : end).split('\n').filter((l) => l.startsWith('| `')).map((row) => {
    const cells = row.split('|').slice(1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value, `DESIGN.md: "${row}" names one token and one value`);
    return [name[1], value[1]] as [string, string];
  });
}

/** THE FOURTEEN ALREADY IN THE APP — the README's first table: the reference declares them only so it renders on its own. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['gold', '184 134 11'],
  ['hero-violet-1', '#6A33E0'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
  ['hero-gold', '#F6C95C'], ['hero-gold-1', '255 236 178'], ['hero-gold-2', '248 203 90'], ['hero-gold-3', '236 178 62'],
  ['hero-on-gold', '#2A0F5C'], ['hero-ink', '#FAF8F4'], ['hero-ink-soft', '#E4E0F2'],
];
/** THE SEVENTEEN NEW WITH THIS SECTION — the README's second table. */
const NEW: ReadonlyArray<readonly [name: string, value: string]> = [
  ['fs-white', '255 255 255'], ['fs-teal', '#0B7F73'], ['fs-teal-deep', '#0B5F57'], ['fs-teal-light', '#8FE8DA'],
  ['fs-gold-text', '#8A6408'], ['fs-gold-deep', '#6B4E00'], ['fs-ink', '#2B2545'], ['fs-ink-soft', '#4A4560'], ['fs-ink-muted', '#6F6988'],
  ['fs-line', '#E9E4F2'], ['fs-rule', '#EEEAF5'], ['fs-chip-line', '#E4DFF0'], ['fs-button-line', '#CFC6EC'], ['fs-band-muted', '#D6CCF7'],
  ['fs-band-ring', '230 220 255'], ['fs-shadow', '33 10 94'], ['fs-band-shadow', '12 6 44'],
];
/** A colour the stylesheet reads at an alpha is stored as three channels; one it reads solid, as written. */
const isChannels = (value: string): boolean => /^\d+ \d+ \d+$/.test(value);

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted (a valueless attribute reads "true", as React writes one),
 * every run of text; comments and the whitespace that only lays the file out (a run holding a newline) dropped, a lone space
 * between two tags kept. With `prefix`, every class gets the house prefix — the reference's .fs-map is the app's .ts-fs-map.
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
      const value = a[2] ?? 'true';
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
  }
  return out;
}
/** The reference's page: its <body>, up to the script that only makes the file work on its own. */
function referenceBody(): string {
  const html = referenceText();
  return html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
}
/** The reference's section, at rest: from <section to its </section>. */
const referenceSection = (): string => {
  const body = referenceBody();
  return body.slice(body.indexOf('<section'), body.lastIndexOf('</section>') + '</section>'.length);
};
/** ALEX'S NOTES ON THE BUILT PAGE (2026-11-12), as the reference's markup takes them — the map's count, out; the Personal pill, "Personal". */
const REFERENCE_COUNT = '<p class="fs-map__count" aria-live="polite" aria-atomic="true"><span class="fs-map__figure">13</span> <span>of 25 tools</span></p>';
const REFERENCE_ALWAYS = '</svg>Personal · always</span>';
/** The reference's section with the two notes that reach it applied — each exactly once, so neither can quietly take more. */
const referenceWithNotes = (): string => {
  const rest = referenceSection();
  assert.equal(count(rest, REFERENCE_COUNT), 1, 'the reference draws the count once');
  assert.equal(count(rest, REFERENCE_ALWAYS), 1, 'and "Personal · always" once');
  return rest.replace(REFERENCE_COUNT, '').replace(REFERENCE_ALWAYS, `</svg>${planMapView({ business: false, trade: false }).base.words}</span>`);
};
/** "What We Do"'s type since Alex's note: the act headings' — About Us's h2 (StopZeroSection.tsx), HOME-FINISH-02's string. */
const ACT_HEADING_TYPE = 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold';

/** The four states, as what you run. */
type Run = { business: boolean; trade: boolean };
const STATES: ReadonlyArray<readonly [name: string, run: Run]> = [
  ['at rest', { business: false, trade: false }],
  ['Business on', { business: true, trade: false }],
  ['Trading on', { business: false, trade: true }],
  ['both on', { business: true, trade: true }],
];
const noop = (): void => {};
const render = (run: Run): string => renderToStaticMarkup(React.createElement(HowToView, { ...run, onBusiness: noop, onTrade: noop, onJoin: noop }));
/** Every element in a tree, depth first, with each pure function component called so what it draws can be reached. */
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}

/** A tool's modules, derived HERE from the capability rows — the leaf's toolModule is held to this. */
const modulesHere = (name: string, groups: readonly CapabilityGroup[] = CAPABILITY_GROUPS): ModuleId[] =>
  [...new Set(groups.flatMap((g) => g.rows).filter((r) => (r.tools as readonly string[]).includes(name)).map((r) => r.module))];
const SHEET_TOOLS: readonly ToolName[] = PROBLEM_SHEET.flatMap((f) => [...f.tools]);

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size', () => {
  const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
    [README, 14233, 'adea420888372ddd9a034ab137480fc91b3e15816c37e88c159264d543a3b1cc'],
    [REFERENCE, 38139, '3caaf6c3b5e23b4e945095e59e283c75da678b5206cca7f07a63034dda06b460'],
  ];
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: its size`);
    assert.equal(digest(file), sha, `${file}: byte for byte as handed over — never redrawn or hand-edited`);
  }
  const html = referenceText();
  assert.doesNotMatch(html.replace('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap', ''), /\b(src|href)="(?!\/pricing")[^"]+"/, 'the reference reads no outside file but the two fonts — and links only to /pricing');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s two tables: fourteen already in the app, the same values behind the house prefix; seventeen new, declared once each in globals.css :root, behind tailwind.config.ts\'s fs family and in DESIGN.md\'s table', () => {
  assert.deepEqual(readmeTable('**Already in the app.**'), KEPT.map(([n, v]) => [n, v]), 'the README\'s first table, row by row');
  assert.deepEqual(readmeTable('**New with this section.**'), NEW.map(([n, v]) => [n, v]), 'the README\'s second table, row by row');
  assert.equal(KEPT.length, 14);
  assert.equal(NEW.length, 17);
  // the reference's own :root: the thirty-one and nothing else, each on its value
  const ref = rootOf(referenceCss());
  assert.deepEqual([...ref.keys()].sort(), [...KEPT, ...NEW].map(([n]) => `--${n}`).sort(), 'the reference declares these thirty-one and no other');
  for (const [name, value] of [...KEPT, ...NEW]) assert.equal(ref.get(`--${name}`), value, `the reference: --${name}`);
  // globals.css: ONE :root; the fourteen already there, on the same values; the seventeen, each declared once in the whole file
  const css = code(GLOBALS);
  assert.equal((css.match(/:root\b/g) ?? []).length, 1, 'one :root in globals.css');
  const root = rootOf(css);
  for (const [name, value] of KEPT) assert.equal(root.get(`--ts-${name}`), value, `globals.css :root: --ts-${name} is the reference's --${name} — added by no one here`);
  for (const [name, value] of NEW) assert.equal(root.get(`--ts-${name}`), value, `globals.css :root: --ts-${name}`);
  assert.deepEqual([...root.keys()].filter((k) => k.startsWith('--ts-fs-')).sort(), NEW.map(([n]) => `--ts-${n}`).sort(), 'the seventeen, and no eighteenth');
  const declared = [...css.matchAll(/(--ts-fs-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
  assert.deepEqual(declared, NEW.map(([n]) => `--ts-${n}`).sort(), 'declared once each in globals.css, and nowhere a second time');
  // tailwind.config.ts, read as the object it exports: the fs family holds the seventeen and nothing else
  const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  const expected = Object.fromEntries(NEW.map(([name, value]) => [name.slice('fs-'.length), isChannels(value) ? `rgb(var(--ts-${name}) / <alpha-value>)` : `var(--ts-${name})`]));
  assert.deepEqual(colors.fs, expected, 'tailwind.config.ts: the fs family holds its seventeen tokens, each reading its variable');
  // DESIGN.md's table: the same names on the same values, in the README's order
  assert.deepEqual(designTable('## The Financial Software section'), NEW.map(([n, v]) => [n, v]), 'DESIGN.md\'s table');
  // every column: DESIGN.md's rows are the README's, character for character, and each new token's comment in globals.css is its
  // "Used for". Markdown is split by the reader as TypeScript, so the rows are read from the whole file (rejoin).
  const rowsAfter = (file: string, lead: string): string[] => {
    const doc = rejoin(code(file), comments(file));
    const from = doc.indexOf(lead);
    assert.ok(from > -1, `${file} has "${lead.trim()}"`);
    const rows: string[] = [];
    for (const line of doc.slice(from).split('\n').slice(1)) {
      if (line.startsWith('|')) rows.push(line);
      else if (rows.length > 0) break;
    }
    return rows.filter((l) => l.startsWith('| `'));
  };
  const readmeRows = rowsAfter(README, '**New with this section.**');
  assert.equal(readmeRows.length, 17);
  assert.deepEqual(rowsAfter('DESIGN.md', '\n## The Financial Software section'), readmeRows, 'DESIGN.md\'s table is the README\'s, row for row and column for column');
  const globalsLines = rejoin(code(GLOBALS), comments(GLOBALS)).split('\n');
  for (const row of readmeRows) {
    const [name, value, usedFor] = row.split('|').slice(1, 4).map((c) => c.trim().replace(/^`|`$/g, ''));
    const lines = globalsLines.filter((l) => l.trimStart().startsWith(`--ts-${name}:`));
    assert.equal(lines.length, 1, `globals.css declares --ts-${name} on one line`);
    assert.ok(lines[0].includes(` ${value};`) && lines[0].trimEnd().endsWith(`/* ${usedFor} */`), `--ts-${name}: ${value}, and its comment is the README's "${usedFor}"`);
  }
  // the fourteen already in the app are declared once each too — none re-declared in a scope that would reach the section
  for (const [name] of KEPT) assert.equal([...css.matchAll(new RegExp(`--ts-${name}\\s*:`, 'g'))].length, 1, `--ts-${name}: declared once in globals.css`);
});

// ── T3 · THE STYLESHEET IS THE REFERENCE'S ───────────────────────────────────

test('T3 the section\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the five named differences (the last two Alex\'s notes on the built page); no hex and no rgb value typed; every variable it reads is declared and every new token read; it stands between the chip strip and the hero', () => {
  const expected: string[] = [];
  const left = { eyebrow: 0, count: 0 };
  for (const line of declarations(referenceCss())) {
    const [media, selector, decl] = line.split(' | ');
    // 1. THE COLOURS are tokens in globals.css :root (T2), never re-declared here.
    if (selector === ':root') continue;
    // 3. NOT PORTED: the reference page's own ground.
    if (selector === 'body') continue;
    // 4. NOT PORTED: the eyebrow — "What We Do" wears the act headings' type (Alex's note on the built page, 2026-11-12).
    if (selector === '.fs-eyebrow') { left.eyebrow += 1; continue; }
    // 5. NOT PORTED: the map's count — the map draws none (Alex's note on the built page, 2026-11-12).
    if (selector === '.fs-map__count' || selector === '.fs-map__figure') { left.count += 1; continue; }
    // every class and every custom property behind the house prefix
    const renamed = [media, selector.replace(/\.([a-z])/g, '.ts-$1'), decl.replace(/var\(--/g, 'var(--ts-')];
    // 2. THE FONTS are the site's two: the reference names the families, the app reads the variables layout.tsx declares.
    renamed[2] = renamed[2].replace("font-family: 'IBM Plex Mono', monospace", 'font-family: var(--font-mono)').replace("font-family: 'Inter', sans-serif", 'font-family: var(--font-sans)');
    expected.push(renamed.join(' | '));
  }
  const port = declarations(portCss());
  assert.deepEqual(port, expected, 'the port, line for line, and nothing more');
  assert.ok(port.length > 150, `a whole stylesheet was compared (${port.length} declarations)`);
  assert.deepEqual(left, { eyebrow: 8, count: 14 }, 'the two notes leave out exactly the eyebrow\'s 8 declarations and the count\'s 14 — no more');
  assert.doesNotMatch(portCss(), /\.ts-fs-eyebrow|\.ts-fs-map__count|\.ts-fs-map__figure/, 'and the port names neither, anywhere');
  for (const line of port) {
    const [, selector, decl] = line.split(' | ');
    for (const cls of selector.match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-fs'), `${selector}: ${cls} wears the section's prefix`);
    assert.doesNotMatch(decl, /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/, `${line}: no hex and no rgb value — "The stylesheet types no hex and no rgb value outside :root"`);
    assert.doesNotMatch(decl, /var\(--(?!ts-|font-)|'Inter'|'IBM Plex Mono'/, `${line}: the reference's own names are renamed`);
  }
  // every variable it reads is declared — a colour in :root, a face by the layout — and every new token is read
  const root = rootOf(code(GLOBALS));
  const read = new Set(port.flatMap((l) => [...l.split(' | ')[2].matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
  for (const v of read) assert.ok(root.has(v) || v === '--font-mono' || v === '--font-sans', `${v} is declared`);
  const layout = code('src/app/layout.tsx');
  assert.match(layout, /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(layout, /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  for (const [name] of NEW) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read by the stylesheet — no token without a reader`);
  for (const [name] of KEPT) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read by the stylesheet, as the README's table says`);
  // where it stands: under the chip strip's rules, above the hero's block, with nothing between it and the hero but the hero's comment
  const whole = code(GLOBALS);
  const at = whole.indexOf(PORT_OPEN);
  assert.ok(at > whole.lastIndexOf('.ts-chipfade'), 'under the chip strip\'s rules');
  assert.equal(count(whole, PORT_OPEN), 1, 'one port');
  // nothing outside the port names its classes — by class selector or through a class attribute selector
  const outside = whole.slice(0, at) + whole.slice(whole.indexOf('.ts-hero {'));
  assert.doesNotMatch(outside, /\.ts-fs\b|\.ts-fs[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*fs/, 'and none reaches them through a class attribute selector');
  // nor reaches the section another way: by its id, by the state attribute the port styles it by, or by any data attribute its
  // markup or the heading box carries
  const hooks = new Set<string>(['aria-pressed', 'data-act-heading']);
  for (const [, run] of STATES) for (const m of render(run).matchAll(/ (data-[\w-]+)="/g)) hooks.add(m[1]);
  assert.deepEqual([...hooks].sort(), ['aria-pressed', 'data-act-heading', 'data-compare-plans', 'data-how-to', 'data-lit', 'data-module', 'data-picked', 'data-plan'], 'the hooks the section and its heading carry');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1]));
  assert.ok(selectorsOutside.length > 50, `the rules outside the port were read (${selectorsOutside.length})`);
  for (const sel of selectorsOutside) {
    assert.ok(!sel.includes('#modules'), `${sel}: no rule outside the port reaches the section by its id`);
    for (const hook of hooks) assert.ok(!sel.includes(`[${hook}`), `${sel}: no rule outside the port reaches the section by [${hook}]`);
  }
  // nor by an element: no selector outside the port STARTS with a type, the universal selector or :is/:where/:not (past an html,
  // body or :root prefix) — those reach every such element on the page, the section's among them. One scoped under a class
  // (.ts-bar a, the hero's) reaches only inside that class.
  const typeFirst = (selector: string): boolean => selector.split(',').some((one) => {
    const compounds = one.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
    while (compounds.length > 1 && /^(html|body|:root)$/.test(compounds[0])) compounds.shift();
    // a compound that opens with a letter is a type selector (keyframe stops excepted)
    return /^(?:[a-z][a-z0-9-]*|\*|:(?:is|where|not)\()/i.test(compounds[0]) && !/^(html|body|from|to)$/i.test(compounds[0]);
  });
  assert.deepEqual(selectorsOutside.filter(typeFirst), [], 'no rule outside the port reaches the section by an element');
  for (const reaches of ['button', '*', 'body h2', 'h2[data-act-heading]', ':where(button)', 'li:last-child']) assert.ok(typeFirst(reaches), `"${reaches}" would be refused`);
  for (const scoped of ['.ts-bar a', '.ts-hero__title span', 'body', 'html', ':root', 'from', '0%', '@media (min-width: 1024px)']) assert.ok(!typeFirst(scoped), `"${scoped}" stands`);
  // what the section and the heading box wear is ruled by the port — each class itself (the box's h2 wears Tailwind's
  // utilities, the act headings' type, since Alex's note on the built page: the fourth difference)
  const ruled = new Set(port.flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []));
  const worn = [...code(SECTION).matchAll(/className="([^"]*)"/g), ...code(LANDING).matchAll(/className="(ts-fs[^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
  for (const cls of new Set(worn)) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule of the port`);
});

// ── T4 · THE PAGE AT REST ────────────────────────────────────────────────────

test('T4 the page at rest is the reference\'s markup with Alex\'s notes applied — Landing.tsx\'s heading box (the act headings\' type on its h2) and the section\'s render, token for token', () => {
  // the heading box: the reference's, behind the house prefix, with the leaf's word — and, since Alex's note on the built page
  // (2026-11-12), the act headings' type on its h2 where the reference has the eyebrow: that one edit, and no other
  const body = referenceBody();
  const box = body.slice(body.indexOf('<div class="fs-heading">'), body.indexOf('</div>', body.indexOf('<div class="fs-heading">')) + '</div>'.length);
  assert.equal(flat(box), '<div class="fs-heading"> <h2 class="fs-eyebrow" data-act-heading>What We Do</h2> </div>', 'the reference\'s heading box');
  assert.equal(WHAT_WE_DO_HEADING, 'What We Do');
  const landing = code(LANDING);
  const BOX = `<div className="ts-fs-heading">\n        <h2 className="${ACT_HEADING_TYPE}" data-act-heading>{WHAT_WE_DO_HEADING}</h2>\n      </div>`;
  assert.equal(flat(BOX), flat(box).replace('class="fs-heading"', 'className="ts-fs-heading"').replace('class="fs-eyebrow"', `className="${ACT_HEADING_TYPE}"`).replace('>What We Do<', '>{WHAT_WE_DO_HEADING}<'), 'the reference\'s box but for the h2\'s class and the leaf\'s word');
  assert.equal(count(landing, BOX), 1, 'Landing.tsx\'s heading box: the same element, the same place, data-act-heading — the act headings\' type, in the reference\'s box');
  // the act headings' type is About Us's and Our Story's own: their h2s add 'mt-3', and nothing else
  for (const file of ['src/components/landing/StopZeroSection.tsx', 'src/components/landing/WasHereSection.tsx']) assert.ok(code(file).includes(`h2: 'mt-3 ${ACT_HEADING_TYPE}'`), `${file}: its h2 wears the same type`);
  assert.equal(count(landing, 'ts-fs-eyebrow'), 0, 'the eyebrow is worn by nothing on the page');
  // the section, rendered at rest, through the default export too
  const rest = render({ business: false, trade: false });
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { onRequireAuth: noop })), rest, 'the default export draws the pure half, at rest');
  const want = tokensOf(referenceWithNotes(), true);
  const got = tokensOf(rest, false);
  assert.ok(want.length > 400, `a whole section was compared (${want.length} tokens)`);
  assert.deepEqual(got, want, 'the section at rest IS the reference\'s markup with Alex\'s notes applied: every tag with every attribute, every word, in order');
  // the two notes as drawn: no count anywhere, and the Personal pill says the Personal plan's own name
  for (const gone of ['ts-fs-map__count', 'ts-fs-map__figure', 'aria-live', 'aria-atomic', asHtml(PERSONAL_ALWAYS)]) assert.equal(count(rest, gone), 0, `no "${gone}"`);
  assert.equal(count(rest, 'always'), count(rest, 'ts-fs-switch--always'), '"always" stands only in the pill\'s class name, the reference\'s own — never in a word drawn');
  assert.equal(count(rest, `</svg>${nameParts(PLANS[0])[0].words}</span>`), 1, 'the Personal pill says "Personal", the first part of the plans\' names');
  // the act keeps what the laws and the doors read: its id first (the plan law, footer01 and heroCrest01 hold the literal), its label, its hook
  assert.ok(rest.startsWith('<section id="modules" class="ts-fs" aria-label="Software plans" data-how-to="true">'), 'the act\'s own tag');
  assert.equal(count(rest, 'id="modules"'), 1, 'the anchor, once');
});

// ── T5 · THE FOUR STATES ─────────────────────────────────────────────────────

test('T5 the four states — each render is the reference\'s markup with Alex\'s notes applied and the edits its own script makes, and no other', () => {
  const rest = referenceWithNotes();
  const script = (() => { const html = referenceText(); return html.slice(html.indexOf('<script>'), html.indexOf('</script>')); })();
  // the script's two rules, as it writes them: a tool is lit when its module is Personal or switched on; the picked plan
  assert.ok(script.includes("const on = tool.dataset.module === 'personal' || run[tool.dataset.module];"), 'the script: a tool is lit when the picked plan holds its module');
  assert.ok(script.includes("const picked = run.business && run.trading ? 'everything' : run.business ? 'business' : run.trading ? 'trading' : 'personal';"), 'the script: the one plan the switches pick');
  // the one edit of its own the page does not make: the script writes the count's figure, and the map draws no count (Alex's
  // note on the built page, 2026-11-12)
  assert.equal(count(script, "section.querySelector('.fs-map__figure').textContent = String(lit);"), 1, 'the script writes the figure — the one edit the page leaves, with the count');
  // the fragments the script moves, each as the page at rest draws it
  const exact = (re: RegExp): string => { const m = re.exec(rest); assert.ok(m, `the reference at rest draws ${re}`); return m[0]; };
  const TICK_HIDDEN = exact(/<svg class="fs-tick"[^>]*aria-hidden="true"><path[^>]*><\/path><\/svg>/);
  const TICK_IN = exact(/<svg class="fs-tick"[^>]*role="img" aria-label="In this plan"><path[^>]*><\/path><\/svg>/);
  const RING_OUT = '<span class="fs-ring" role="img" aria-label="Not in this plan"></span>';
  const TAG = '<span class="fs-plan__tag">Your plan</span>';
  assert.equal(count(rest, TAG), 1, 'one tag at rest');
  const painted = (run: Run): string => {
    const on = { business: run.business, trading: run.trade } as Record<string, boolean>;
    let html = rest.replace(/<button class="fs-switch" type="button" data-module="(\w+)" aria-pressed="false"><span class="fs-ring" aria-hidden="true"><\/span>/g,
      (whole: string, m: string) => (on[m] ? `<button class="fs-switch" type="button" data-module="${m}" aria-pressed="true">${TICK_HIDDEN}` : whole));
    html = html.replace(/<li class="fs-tool" data-module="(\w+)" data-lit="(?:true|false)">([^<]+)(?:<svg[\s\S]*?<\/svg>|<span class="fs-ring"[^>]*><\/span>)<\/li>/g, (_: string, m: string, name: string) => {
      const isLit = m === 'personal' || on[m];
      return `<li class="fs-tool" data-module="${m}" data-lit="${isLit}">${name}${isLit ? TICK_IN : RING_OUT}</li>`;
    });
    const picked = on.business && on.trading ? 'everything' : on.business ? 'business' : on.trading ? 'trading' : 'personal';
    html = html.replace(TAG, '').replace(/<div class="fs-plan( fs-plan--all)?" data-plan="(\w+)" data-picked="(?:true|false)">([\s\S]*?<div class="fs-plan__top"><p class="fs-plan__role">[^<]*<\/p>)<\/div>/g,
      (_: string, all: string | undefined, id: string, head: string) => `<div class="fs-plan${all ?? ''}" data-plan="${id}" data-picked="${id === picked}">${head}${id === picked ? TAG : ''}</div>`);
    return html;
  };
  assert.equal(painted({ business: false, trade: false }), rest, 'painting the rest state changes nothing');
  const renders = new Map<string, string>();
  for (const [name, run] of STATES) {
    const html = render(run);
    renders.set(name, html);
    assert.deepEqual(tokensOf(html, false), tokensOf(painted(run), true), `${name}: the reference's markup with its script's edits, token for token`);
    assert.equal(count(html, YOUR_PLAN), 1, `${name}: one plan tagged`);
    assert.equal(count(html, 'data-picked="true"'), 1, `${name}: one plan picked`);
  }
  // the four differ — the switches matter — and no state draws a count: the eye counts the lit tools, 13 · 23 · 15 · 25
  assert.equal(new Set(renders.values()).size, 4, 'four different renders');
  assert.deepEqual(STATES.map(([name]) => count(renders.get(name) ?? '', 'data-lit="true"')), [13, 23, 15, 25], 'the lit tools: 13 · 23 · 15 · 25');
  for (const [name, run] of STATES) {
    const html = renders.get(name) ?? '';
    const lit = count(html, 'data-lit="true"');
    for (const gone of ['ts-fs-map__count', 'ts-fs-map__figure', 'aria-live', 'aria-atomic']) assert.equal(count(html, gone), 0, `${name}: no count is drawn, and no live region ("${gone}")`);
    assert.equal(count(html, `aria-label="${PLAN_MARKS.inPlan.label}"`), lit, `${name}: every lit tool says "${PLAN_MARKS.inPlan.label}"`);
    assert.equal(count(html, `aria-label="${PLAN_MARKS.notInPlan.label}"`), SHEET_TOOLS.length - lit, `${name}: every other says "${PLAN_MARKS.notInPlan.label}"`);
    assert.equal(count(html, 'aria-pressed="true"'), Number(run.business) + Number(run.trade), `${name}: the switches pressed`);
  }
});

// ── T6 · THE WORDS ───────────────────────────────────────────────────────────

test('T6 every word drawn is its leaf\'s, in order — the three new words and both numbers computed, the switches and the Personal pill the parts of the plans\' names; the component types none', () => {
  // the three new words, typed once in src/lib/howTo.ts; both numbers computed
  assert.equal(YOUR_PLAN, 'Your plan');
  assert.equal(toolCountWords(13, 25), '13 of 25 tools');
  assert.equal(ofToolsWords(25), 'of 25 tools');
  assert.equal(toolCountWords(13, 25), `13 ${ofToolsWords(25)}`, 'a card\'s count is its figure, then these words');
  assert.equal(allToolsWords(25), 'All 25 tools');
  const shorter = PROBLEM_SHEET.map((f) => ({ header: f.header, tools: f.tools.filter((t) => t !== 'Mileage') }));
  const small = planMapView({ business: false, trade: false }, { sheet: shorter });
  assert.deepEqual([...small.cards.map((c) => c.count), small.band.count], ['12 of 24 tools', '22 of 24 tools', '14 of 24 tools', 'All 24 tools'], 'both numbers follow the sheet — never typed');
  // the switches: the part each plan's name adds — "a switch and its card cannot disagree"
  const view = planMapView({ business: false, trade: false });
  assert.deepEqual(view.switches.map((s) => s.words), ['+ Business', '+ Trading']);
  assert.deepEqual(view.switches.map((s) => s.words), [nameParts(PLANS[1])[1].words, nameParts(PLANS[2])[1].words], 'read from Personal + Business and Personal + Trading');
  // the Personal pill: the first part of the plans' names, as the Personal plan's own name says it (Alex's note on the built
  // page, 2026-11-12: "while youre at it, remove that word alwasy from personal... looks tacky too")
  assert.deepEqual(view.base, { words: 'Personal', module: 'personal' }, 'the pill says "Personal"');
  assert.deepEqual(view.base, nameParts(PLANS[0])[0], 'read from the Personal plan\'s own name');
  for (const plan of PLANS) assert.deepEqual(nameParts(plan)[0], view.base, `${plan.id}: its name opens with the pill's part — the part every plan holds`);
  for (const [name, run] of STATES) assert.deepEqual(planMapView(run).base, view.base, `${name}: the pill does not move`);
  assert.equal(PERSONAL_ALWAYS, 'Personal · always', 'the old pill\'s words stand, undrawn');
  for (const [name, run] of STATES) assert.equal(count(render(run), asHtml(PERSONAL_ALWAYS)), 0, `${name}: "Personal · always" is drawn nowhere`);
  assert.equal(ADD_BUSINESS, '+ Business', 'the old switch word stands, undrawn');
  assert.equal(ADD_TRADE, '+ Trade', 'and so does its pair, which the board does not say');
  for (const [name, run] of STATES) assert.equal(count(render(run), `>${ADD_TRADE}<`), 0, `${name}: "+ Trade" is drawn nowhere`);
  // every word of each state, in order, from its leaf
  for (const [name, run] of STATES) {
    const v = planMapView(run);
    const planWords = (plan: (typeof v.cards)[number]): string[] => [
      plan.role, ...(plan.picked ? [YOUR_PLAN] : []),
      ...plan.parts.flatMap((part, i) => (plan.parts.length === 1 ? [part.words] : i === 0 ? [`${part.words} `] : i === 1 ? [part.words] : [' ', part.words])),
      plan.audience, plan.explainer, ...plan.benefits, plan.count, plan.price, plan.cta,
    ];
    const want = [
      PLAN_PILLAR.heading, PLANS_SUBHEAD, PLANS_HEADLINE, v.base.words, ...v.switches.map((s) => s.words),
      ...PROBLEM_SHEET.flatMap((f) => [f.header, ...f.tools]),
      ...v.cards.flatMap(planWords), ...planWords(v.band), COMPARE_PLANS_WORDS,
    ].map((w) => `#text ${JSON.stringify(asHtml(w))}`);
    assert.deepEqual(tokensOf(render(run), false).filter((t) => t.startsWith('#text')), want, `${name}: every word, in order, is its leaf's`);
  }
  // each plan's words are PLANS', its explainer its positioning then its relationship, its price line and button its slot's
  for (const plan of [...view.cards, view.band]) {
    const source = PLANS.find((p) => p.id === plan.id) as Plan;
    assert.equal(plan.role, source.role);
    assert.equal(plan.parts.map((p) => p.words).join(' '), source.name, `${plan.id}: its parts are its name`);
    assert.equal(plan.audience, source.audience);
    assert.equal(plan.explainer, `${source.positioning} ${source.relationship}`);
    assert.deepEqual(plan.benefits, source.benefits);
    assert.deepEqual([plan.price, plan.cta], [LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA], `${plan.id}: the unannounced slot's words`);
  }
  // what a screen reader hears beyond the words: the act's label, the group's, and each tool's mark — nothing drawn for it alone
  const labels = [...render({ business: false, trade: false }).matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Software plans', WHAT_YOU_RUN_LABEL, ...view.families.flatMap((f) => f.tools.map((t) => (t.lit ? PLAN_MARKS.inPlan.label : PLAN_MARKS.notInPlan.label)))]);
  // the component types none: no text between its tags, no leaf's word anywhere in its source
  const section = code(SECTION);
  const drawnAt = section.indexOf('<section id="modules"');
  assert.ok(drawnAt > -1);
  assert.deepEqual([...section.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-z0-9]/.test(t)), [], 'no text is typed between its tags');
  const leafWords = [PLAN_PILLAR.heading, PLANS_SUBHEAD, PLANS_HEADLINE, PERSONAL_ALWAYS, WHAT_YOU_RUN_LABEL, YOUR_PLAN, COMPARE_PLANS_WORDS, COMPARE_PLANS_PATH, LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA,
    PLAN_MARKS.inPlan.label, PLAN_MARKS.notInPlan.label, '+ Business', '+ Trading', 'of 25', 'tools', ...PROBLEM_SHEET.flatMap((f) => [f.header, ...f.tools]),
    ...PLANS.flatMap((p) => [p.name, p.role, p.audience, p.positioning, p.relationship, ...p.benefits])];
  for (const w of leafWords) assert.ok(!flat(section).includes(`'${w}'`) && !flat(section).includes(`"${w}"`) && !flat(section).includes(`>${w}<`), `the section does not type "${w.slice(0, 30)}"`);
  assert.deepEqual([...section.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]), ['Software plans'], 'its one typed label is the act\'s own, as since HOME-PLANS-01');
  assert.equal(count(section, '`'), 0, 'and it writes no template literal, where a typed word could hide');
  assert.deepEqual([...section.matchAll(/'([^']*)'/g)].map((m) => m[1]), ['use client', 'react', '@/lib/howTo', '@/lib/homeActWords', '@/lib/offer/plans', ' '], 'its single-quoted literals: the directive, its three imports\' paths and React\'s, and the space before each later part of a plan\'s name (the space between the map\'s figure and its words left with the count, at Alex\'s note)');
});

// ── T7 · THE DATA ────────────────────────────────────────────────────────────

test('T7 a tool\'s module is the module of the capability rows that name it — 13 Personal, 10 Business, 2 Trading; the counts 13, 23, 15 and 25; the map law refuses by name; the known difference', () => {
  // every tool on the sheet: the leaf's module is the one derived here, from the rows
  assert.equal(SHEET_TOOLS.length, 25);
  for (const name of SHEET_TOOLS) {
    const modules = modulesHere(name);
    assert.equal(modules.length, 1, `${name}: one module`);
    assert.equal(toolModule(name), modules[0], `${name}: ${modules[0]}`);
  }
  const byModule = (m: ModuleId) => SHEET_TOOLS.filter((t) => toolModule(t) === m);
  assert.deepEqual([byModule('personal').length, byModule('business').length, byModule('trading').length], [13, 10, 2], '13 Personal, 10 Business, 2 Trading');
  assert.deepEqual(byModule('trading'), ['Brokerage', 'Trade Log']);
  const named = (t: string) => CAPABILITY_GROUPS.flatMap((g) => g.rows).filter((r) => (r.tools as readonly string[]).includes(t));
  assert.deepEqual(SHEET_TOOLS.filter((t) => named(t).length > 1), ['Expenses', 'Bookkeeping'], 'two tools are named by two rows each');
  for (const t of ['Expenses', 'Bookkeeping']) assert.deepEqual(named(t).map((r) => r.module), ['personal', 'personal'], `${t}: both rows Personal`);
  // the counts: each plan's tools, over the sheet's
  const counts = PLANS.map((p) => SHEET_TOOLS.filter((t) => p.modules.includes(toolModule(t))).length);
  assert.deepEqual(counts, [13, 23, 15, 25]);
  const view = planMapView({ business: false, trade: false });
  assert.deepEqual([...view.cards, view.band].map((p) => p.count), ['13 of 25 tools', '23 of 25 tools', '15 of 25 tools', 'All 25 tools']);
  // the map draws no count since Alex's note on the built page (2026-11-12); the tools it lights are the picked plan's count
  const litIn = (v: ReturnType<typeof planMapView>): number => v.families.flatMap((f) => f.tools).filter((t) => t.lit).length;
  assert.deepEqual(STATES.map(([, run]) => litIn(planMapView(run))), counts, 'each state lights the picked plan\'s tools: 13 · 23 · 15 · 25');
  assert.equal('figure' in view || 'ofTotal' in view, false, 'and the view carries no figure for a count to draw');
  // THE MAP LAW: the live leaves pass; a tool of two modules, a tool of none and a name of the wrong parts — each refused by name
  assert.deepEqual(mapLaw({ throwOnFail: false }), []);
  assert.match(code(LEAF), /^mapLaw\(\);$/m, 'run at module scope');
  let moved = false;
  const twoModules = CAPABILITY_GROUPS.map((g) => ({ ...g, rows: g.rows.map((r) => { if (!moved && (r.tools as readonly string[]).includes('Expenses') && (r.tools as readonly string[]).length === 1) { moved = true; return { ...r, module: 'business' as const }; } return r; }) }));
  assert.ok(moved, 'one of Expenses\' rows was moved');
  assert.ok(mapLaw({ throwOnFail: false, groups: twoModules }).some((v) => /^Expenses is named by capability rows of 2 modules \((personal, business|business, personal)\)/.test(v)), 'a tool of two modules, by name');
  assert.throws(() => toolModule('Expenses', twoModules), (e: unknown) => e instanceof HowToLawError && /Expenses is named by capability rows of 2 modules/.test(e.message));
  const noMileage = CAPABILITY_GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => !(r.tools as readonly string[]).includes('Mileage')) }));
  assert.ok(mapLaw({ throwOnFail: false, groups: noMileage }).includes('Mileage is named by no capability row — a tool on the map wears its module\'s colour, and it has no module'), 'a tool of no module, by name');
  const misnamed = PLANS.map((p) => (p.id === 'business' ? { ...p, name: 'Personal and Business' } : p));
  assert.ok(mapLaw({ throwOnFail: false, plans: misnamed }).some((v) => /the plan "business" is named "Personal and Business" — 1 part\(s\) for its 2 module\(s\)/.test(v)), 'a name that is not one part per module, by name');
  assert.throws(() => mapLaw({ groups: twoModules }), (e: unknown) => e instanceof HowToLawError && /^map law: /.test(e.message), 'it throws by default');
  assert.throws(() => toolModule('Mileage', noMileage), (e: unknown) => e instanceof HowToLawError && /Mileage is named by no capability row/.test(e.message), 'a tool of no module is a throw, as a tool of two is');
  // the law reads the sheet it is handed, and the view the rows it is handed — the module, the light and the cards' counts follow them
  assert.deepEqual(mapLaw({ throwOnFail: false, sheet: [{ header: 'A family of one', tools: ['Ledger Zero' as ToolName] }] }), ['Ledger Zero is named by no capability row — a tool on the map wears its module\'s colour, and it has no module']);
  assert.throws(() => planMapView({ business: false, trade: false }, { groups: twoModules }), (e: unknown) => e instanceof HowToLawError && /Expenses is named by capability rows of 2 modules/.test(e.message), 'a view over rows that give a tool two modules is refused');
  const mileageTrades = CAPABILITY_GROUPS.map((g) => ({ ...g, rows: g.rows.map((r) => ((r.tools as readonly string[]).includes('Mileage') ? { ...r, module: 'trading' as const } : r)) }));
  const mileageIn = (run: Run) => planMapView(run, { groups: mileageTrades }).families.flatMap((f) => f.tools).find((t) => t.name === 'Mileage');
  assert.deepEqual(mileageIn({ business: false, trade: false }), { name: 'Mileage', module: 'trading', lit: false }, 'Mileage wears the module its rows give it, unlit at rest');
  assert.deepEqual(mileageIn({ business: false, trade: true }), { name: 'Mileage', module: 'trading', lit: true }, 'and is lit when Trading is on');
  const movedView = planMapView({ business: false, trade: false }, { groups: mileageTrades });
  const personalHere = SHEET_TOOLS.filter((t) => modulesHere(t, mileageTrades)[0] === 'personal').length;
  assert.equal(personalHere, 12, 'with Mileage moved, Personal holds 12');
  assert.equal(litIn(movedView), personalHere, 'the light counts by the rows handed in');
  assert.equal(movedView.cards[0].count, toolCountWords(personalHere, SHEET_TOOLS.length), 'and so does the Personal card\'s count');
  // both module-scope laws end the file, each a statement of its own at the top level — behind no condition, inside no block
  const leafCode = code(LEAF).trimEnd();
  assert.ok(leafCode.endsWith('\nhowToLaw();\nmapLaw();'), 'the leaf ends with its two laws, run at module scope');
  const beforeLaws = leafCode.slice(0, -'\nhowToLaw();\nmapLaw();'.length).trimEnd();
  assert.match(beforeLaws.slice(-1), /[;}]/, 'after a finished statement, so no condition holds them');
  assert.equal(count(beforeLaws, '{'), count(beforeLaws, '}'), 'and at the top level, inside no block');
  // a priced plan is not drawn: only the unannounced slot is designed (the plan law fails the build on a price first)
  const priced = PLANS.map((p) => ({ ...p, price: { ...p.price, monthly: 29, billingNote: 'billed monthly' } }));
  assert.throws(() => planMapView({ business: false, trade: false }, { plans: priced }), (e: unknown) => e instanceof HowToLawError && /the plan "personal" carries a price/.test(e.message));
  // THE KNOWN DIFFERENCE: the step lists that left the page use Bill Pay, FP&A and Brokerage inside Personal's steps; the map follows the rows
  const personalSteps = HOW_TO_SECTIONS.find((s) => s.id === 'personal');
  assert.ok(personalSteps);
  const outside = [...new Set(personalSteps.steps.flatMap((s) => s.tools))].filter((t) => toolModule(t) !== 'personal');
  assert.deepEqual(outside.map((t) => `${t}: ${toolModule(t)}`), ['Bill Pay: business', 'Brokerage: trading', 'FP&A: business'], 'three tools of Personal\'s steps belong to other modules\' rows');
  for (const t of outside) assert.ok(view.families.flatMap((f) => f.tools).some((tool) => tool.name === t && tool.module === toolModule(t) && !tool.lit), `${t} is drawn in its rows' module, unlit at rest`);
});

// ── T8 · THE STATE ───────────────────────────────────────────────────────────

test('T8 what you run is two booleans in React state — both off at first, nothing stored; the switches turn them; every plan\'s button opens the door', () => {
  const section = code(SECTION);
  assert.match(section, /^'use client';/);
  assert.equal(count(section, 'const [business, setBusiness] = useState(false);'), 1, 'Business: off at first');
  assert.equal(count(section, 'const [trade, setTrade] = useState(false);'), 1, 'Trading: off at first');
  assert.equal(count(section, 'useState('), 2, 'and no other state');
  assert.doesNotMatch(section, /\buse(Effect|LayoutEffect|Reducer|Ref|Router|SearchParams|Pathname|Context|SyncExternalStore)\b|\b(globalThis|window|self|document|navigator|history|location|localStorage|sessionStorage|indexedDB|cookieStore|caches|cookie)\b|\bfetch\s*\(|new Date\(|Date\.now\(/, 'no storage, no URL, no cookie, no clock — no browser global named at all');
  assert.equal(section.slice(section.indexOf('export default function HowToSection(')).trim(), [
    'export default function HowToSection({ onRequireAuth }: { onRequireAuth: () => void }) {',
    '  const [business, setBusiness] = useState(false);',
    '  const [trade, setTrade] = useState(false);',
    '  return <HowToView business={business} trade={trade} onBusiness={() => setBusiness((on) => !on)} onTrade={() => setTrade((on) => !on)} onJoin={onRequireAuth} />;',
    '}',
  ].join('\n'), 'the default export, whole, ends the file: two booleans and the pure half — nothing else runs in it');
  // the default export, driven inside a host's render: an act made during that render re-draws the host
  const acts: Array<(props: HowToViewProps) => void> = [(p) => p.onBusiness(), (p) => p.onTrade(), (p) => p.onBusiness(), (p) => p.onTrade()];
  const passes: string[] = [];
  const door = (): void => {};
  const Host = (): null => {
    const el = HowToSection({ onRequireAuth: door }) as React.ReactElement<HowToViewProps>;
    assert.equal(el.type, HowToView, 'the default export draws the pure half');
    assert.equal(el.props.onJoin, door, 'handing it the door Landing hands in');
    passes.push(`${el.props.business ? 'B' : '-'}${el.props.trade ? 'T' : '-'}`);
    if (passes.length <= acts.length) acts[passes.length - 1](el.props);
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  assert.deepEqual(passes, ['--', 'B-', 'BT', '-T', '--'], 'at rest → Business on → both → Business off → Trading off: back at rest');
  // the pure half: each switch calls its own toggle; each plan's button opens the door; the link is a plain anchor
  for (const [name, run] of STATES) {
    const calls: string[] = [];
    const drawn = drawnElementsOf(HowToView({ ...run, onBusiness: () => calls.push('business'), onTrade: () => calls.push('trade'), onJoin: () => calls.push('join') }));
    const buttons = drawn.filter((el) => el.type === 'button');
    assert.equal(buttons.length, 2 + PLANS.length, `${name}: two switches and a button per plan`);
    for (const b of buttons) (b.props.onClick as () => void)();
    assert.deepEqual(calls, ['business', 'trade', ...PLANS.map(() => 'join')], `${name}: each switch turns its own; each plan's button opens the door`);
    const switches = buttons.slice(0, 2);
    assert.deepEqual(switches.map((b) => [b.props['data-module'], b.props['aria-pressed']]), [['business', run.business], ['trading', run.trade]], `${name}: aria-pressed says what is on`);
    const anchors = drawn.filter((el) => el.type === 'a');
    assert.equal(anchors.length, 1);
    assert.deepEqual(Object.keys(anchors[0].props).sort(), ['children', 'className', 'data-compare-plans', 'href']);
    assert.equal(anchors[0].props.href, COMPARE_PLANS_PATH);
  }
});

// ── T9 · THE BUILD'S LAW ─────────────────────────────────────────────────────

test('T9 the build\'s map law re-runs mapLaw — one module per tool, or the build fails by name — and its two seeds are on file, each finding its line once and expecting what the law says', () => {
  const law = code(LAW);
  assert.equal(count(law, "lawGuard('The map law', () => {"), 1, 'one seat');
  assert.equal(count(law, "import { mapLaw } from '../src/lib/howTo';"), 1, 'the leaf\'s own law, imported');
  const seat = law.slice(law.indexOf("lawGuard('The map law', () => {"));
  assert.ok(seat.includes('for (const v of mapLaw({ throwOnFail: false })) mapFail(v);'), 'the seat re-runs the leaf\'s law and fails on each violation');
  assert.ok(seat.includes('const mapFail = (m: string) => { mapViolations += 1; violations.push(`map law: ${m} (HOME-PLANS-04)`); };'), 'each violation goes onto the build\'s violations, which the second gate fails on');
  assert.equal(count(law, "import { mapLaw } from '../src/lib/howTo';\n\nlawGuard('The map law', () => {\n"), 1, 'the seat is a statement of its own, right under its import — no condition holds it');
  assert.ok(law.indexOf("lawGuard('The map law', () => {") < law.lastIndexOf('if (violations.length > raised) {'), 'above the second gate, so its violations fail the build');
  assert.ok(law.lastIndexOf("lawGuard('") === law.indexOf("lawGuard('The map law', () => {"), 'the last seat in the file');
  // the seeds: each find occurs once in its file; each expect is what the law says of that very change
  assert.deepEqual(MAP_SEEDS.map((s) => s.file), ['src/lib/offer/plans.ts', 'src/lib/offer/plans.ts']);
  for (const seed of MAP_SEEDS) assert.equal(count(rejoin(code(seed.file), comments(seed.file)), seed.find), 1, `${seed.name}: its find occurs once`);
  const [a, b] = MAP_SEEDS;
  const moved = CAPABILITY_GROUPS.map((g) => ({ ...g, rows: g.rows.map((r) => (a.find.includes(`'${r.label}'`) ? { ...r, module: 'business' as const } : r)) }));
  assert.ok(mapLaw({ throwOnFail: false, groups: moved }).some((v) => v.includes(a.expect)), `${a.name}: the law says "${a.expect}"`);
  const renamed = PLANS.map((p) => (b.find.includes(`'${p.name}'`) ? { ...p, name: /name: '([^']+)'/.exec(b.replace)?.[1] ?? '' } : p));
  assert.ok(mapLaw({ throwOnFail: false, plans: renamed }).some((v) => v.includes(b.expect)), `${b.name}: the law says "${b.expect}"`);
});

// ── T10 · THE RULINGS ────────────────────────────────────────────────────────

test('T10 each ruling is quoted, dated, where it is built, and Alex\'s notes on the built page with them, exact; what left the page stays in its leaf, undrawn, with its note', () => {
  const said = (file: string): string => flat(comments(file).replace(/^\s*(\*|\/\/)/gm, ' '));
  const section = said(SECTION);
  const leaf = said(LEAF);
  const pillars = said(PILLARS);
  const globals = said(GLOBALS);
  const landing = said(LANDING);
  const law = said(LAW);
  for (const [file, notes] of [[SECTION, section], [LEAF, leaf], [GLOBALS, globals], [LANDING, landing]] as const) {
    assert.ok(notes.includes('HOME-PLANS-04'), `${file} names the brief`);
    assert.ok(notes.includes('2026-11-12'), `${file} dates it`);
  }
  assert.ok(section.includes('design-refs/home-plans-04/Section-Reference.html') && globals.includes('design-refs/home-plans-04/Section-Reference.html'), 'the spec is named where it is built');
  // a — the state
  assert.ok(section.includes('"STATE. The section holds two booleans in React state: what you run. No storage, no URL, no cookie; a reload starts at Personal. This ends HOME-PLANS-03\'s "NO STATE" for these two switches and nothing else."'), 'a, in the section');
  // b — the cards
  assert.ok(section.includes('"THE CARDS ARE THE SECTION\'S OWN. /pricing keeps PlanCards, its table and every class it has, untouched."'), 'b, in the section');
  // c — what leaves the page, in both leaves
  const C = '"WHAT LEAVES THE PAGE: the pillar\'s three paragraphs and the step lists in the cards. Both stay in their leaves, undrawn, with a dated note: the standing HOME-PLANS-03 gave the comparison."';
  assert.ok(pillars.includes(C), 'c, beside the paragraphs');
  assert.ok(leaf.includes(C), 'c, beside planCardSteps');
  // d — the mark
  assert.ok(section.includes('"A MARK STILL SAYS "IN THIS PLAN", NEVER "BUILT". The map draws no status and no price, so the plan law\'s price guard stays as it is."'), 'd, in the section');
  // e — the tool's module, in the leaf and in the build's law
  const E = '"A TOOL\'S MODULE is the module of the capability rows that name it (CAPABILITY_GROUPS), held by a law: one module per tool, or the build fails by name."';
  assert.ok(leaf.includes(E), 'e, in the leaf');
  assert.ok(law.includes(E), 'e, at the build\'s law');
  // f — the words
  const F = '"WORDS. Nothing is typed in a component. The switches say the part each plan\'s name adds: "+ Business", "+ Trading". Three words are new and need a leaf: "Your plan", "<n> of <total> tools", "All <total> tools". Both numbers are computed."';
  assert.ok(section.includes(F) && leaf.includes(F), 'f, in the section and in the leaf');
  // g — the two gradients
  assert.ok(globals.includes('"TWO GRADIENTS, both on the board: the picked plan\'s gold button and the band."'), 'g, at the stylesheet');
  // the heading's look
  assert.ok(landing.includes('"What We Do" keeps its element, its place and data-act-heading. Only its look changes: the eyebrow. This replaces HOME-FINISH-02\'s "in gold and one size up" for the heading\'s look only.'), 'the eyebrow, at the heading box');
  // Alex's own words, wherever a file of this change quotes them, exact: a quote of his 14:07 words is the whole of them or an
  // excerpt cut only at an elision mark (…), every piece his, in his order; a quote of his 14:30 words is the whole of them
  const WORDS_1407 = 'Plaids sections with Title, Sub title, quick explainer paragraph, and then list of features. ours is a little more complex looking and harer to see separation … instead of this , we might have like some simple like lists, or something or an image... that like lists the Tabs , separated by Tier? … simple and easy to understand';
  const WORDS_1430 = 'YES, OMG, GIVE ME THE PROMPT TO MAKE THIS REAL!';
  const excerptOf = (quote: string, whole: string): boolean => {
    let from = 0;
    for (const piece of quote.split('…').map((p) => p.trim()).filter(Boolean)) {
      const at = whole.indexOf(piece, from);
      if (at < 0) return false;
      from = at + piece.length;
    }
    return true;
  };
  const quoted: Record<string, { at1407: string[]; at1430: string[] }> = {};
  for (const file of [SECTION, LEAF, PILLARS, GLOBALS, LANDING, LAW, 'scripts/proofs/map.seeds.ts', 'tailwind.config.ts']) {
    const notes = said(file);
    quoted[file] = { at1407: [...notes.matchAll(/14:07 Manila: "([^"]+)"/g)].map((m) => m[1]), at1430: [...notes.matchAll(/14:30(?: Manila)?: "([^"]+)"/g)].map((m) => m[1]) };
    for (const q of quoted[file].at1407) assert.ok(excerptOf(q, WORDS_1407), `${file}: "${q.slice(0, 40)}…" is Alex's 14:07 words, exact`);
    for (const q of quoted[file].at1430) assert.equal(q, WORDS_1430, `${file}: his 14:30 words, exact`);
  }
  assert.deepEqual(quoted[SECTION].at1407, [WORDS_1407], 'the section quotes the 14:07 words whole');
  assert.equal(quoted[LEAF].at1407.length, 2, 'the leaf quotes them twice, each an excerpt');
  assert.deepEqual([quoted[SECTION].at1430.length, quoted[LEAF].at1430.length], [1, 1], 'and the 14:30 words once each');
  // AFTER THE BUILD — Alex's notes on the built page (2026-11-12), exact, where each is built: every quote after the stamp
  // "Alex's note(s) on the built page, 2026-11-12:" is a piece of his words, letter for letter (whitespace collapsed, as said()
  // collapses it), and each file quotes the notes it builds
  const NOTES = 'two small notes: first the what we do, whay did we shrink that , its so small, i like how about us and What We do were the same. About us is better size... IMO... then 13 of 25 tools is tacky, we dont need that to tell us, we can just count...';
  const NOTE_3 = 'while youre at it, remove that word alwasy from personal... looks tacky too';
  const SHRUNK = 'first the what we do, whay did we shrink that , its so small,';
  const SAME = 'i like how about us and What We do were the same. About us is better size... IMO...';
  const COUNT = 'then 13 of 25 tools is tacky, we dont need that to tell us, we can just count...';
  for (const piece of [SHRUNK, SAME, COUNT]) assert.ok(NOTES.includes(piece), `"${piece.slice(0, 30)}…" is a piece of his notes`);
  const notesQuoted = (notes: string): string[] => [...notes.matchAll(/Alex's notes? on the built page, 2026-11-12: ((?:"[^"]+"(?: · )?)+)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((q) => q[1]));
  const BUILT_AT: ReadonlyArray<readonly [file: string, notes: string, quotes: readonly string[]]> = [
    [LANDING, landing, [SHRUNK, SAME]],
    [PILLARS, pillars, [SAME]],
    [GLOBALS, globals, [SAME, COUNT]],
    [SECTION, section, [COUNT, NOTE_3]],
    [LEAF, leaf, [COUNT, NOTE_3, NOTE_3]],
  ];
  for (const [file, notes, quotes] of BUILT_AT) {
    assert.deepEqual(notesQuoted(notes), quotes, `${file}: Alex's notes on the built page, quoted where they are built, in order`);
    for (const q of notesQuoted(notes)) assert.ok(NOTES.includes(q) || q === NOTE_3, `${file}: "${q.slice(0, 30)}…" is his words, exact`);
  }
  assert.ok(leaf.includes(`AFTER THE BUILD (Alex's note on the built page, 2026-11-12: "${NOTE_3}"): NOT DRAWN`), 'PERSONAL_ALWAYS keeps its note: not drawn');
  // what left the page stays in its leaf, undrawn
  assert.equal(PLAN_PILLAR.paragraphs.length, 3, 'the pillar keeps its three paragraphs');
  const titles = planCardSteps().flatMap((card) => card.categories.flatMap((c) => [c.heading, ...c.steps]));
  assert.ok(titles.length > 20, 'the step lists stand in the leaf');
  for (const [name, run] of STATES) {
    const html = render(run);
    for (const words of [...PLAN_PILLAR.paragraphs, ...titles]) assert.equal(count(html, asHtml(words)), 0, `${name}: "${words.slice(0, 30)}" is not drawn`);
  }
  assert.doesNotMatch(code(SECTION), /PlanCards|planCardSteps|paragraphs|PlansSection/, 'the section reads neither, nor the plans section');
  assert.ok(code(PLANS_SECTION).includes('export function PlanCards({ door, steps }: { door: PlanDoor; steps?: readonly PlanCardSteps[] }) {'), 'PlanCards keeps its `steps` branch, with no caller — left as it is');
});
