/**
 * HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page; the boards approved on the
 * design canvas at 20:01 and, corrected, at 20:41; built 2026-11-15) — PROFESSIONAL SERVICES ON THE HOME PAGE BECOMES ITS SHORT VIEW;
 * /professional-services KEEPS THE WHOLE SECTION.
 *
 * His request, 2026-11-14 19:11 Manila: "I would like to take this feedback, consider it deeply, review the home page in its current
 * state, and then come up with a mock up to meet the requests of the beta users feedback." Two of the notes, as he pasted them: "Cut the
 * scrolling length of the landing page in half. Make the user explore to find the information behind info pages" · "Make it exploratory.
 * Click to learn more." His approval of the boards, 2026-11-14 20:01 Manila: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT"; of the corrected
 * boards, 20:41: "thats it!  yeet yeet!"
 *
 * The fourth PR of the shorter home page, and the last of its three trims. HOME-PAGES-01 gave the section a page of its own,
 * /professional-services; HOME-TRIM-02 drew Financial Software's short view; this one draws Professional Services' short view on the home
 * page: the section's name and its line, the panel with the question and the six services, under them the picked service's name and
 * line with the gold link and its note, then one link under the panel. The spec is a file: design-refs/home-trim-03/Section-Reference.html,
 * with its README beside it ("Its markup is the page at rest."). The short view is ServicesShortView in
 * src/components/landing/ServicesSection.tsx, which the section draws when Landing.tsx hands it view="short"; its stylesheet is the
 * reference's second, ported as the Professional Services port's last rules in src/app/globals.css. What is held here:
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two; the
 *      reference's first stylesheet is design-refs/home-services-01's, byte for byte, and so is its font link;
 *   T2 the block — the port's new rules ARE the reference's second stylesheet, declaration by declaration and in order, behind the house
 *      prefix, the family the site's mono; it reads the three tokens the README names, each in :root at its value, and types no colour;
 *      it stands directly after the port's last rule; the rest of the port is main's, declaration by declaration;
 *   T3 the short view — its render is the reference's section, token for token, with each of the six services picked, as the
 *      reference's own script paints it; the picture, the steps and their rail absent, not hidden; the act's tag first;
 *   T4 the whole view — its render is main's, byte for byte (sha256), with each of the six services picked, and the default export
 *      handed "whole" draws it;
 *   T5 the words — every word the short view draws is a leaf's, in order; the one new one is one constant in the leaf, beside
 *      SCOPED_BY_PROPOSAL, the arrow in the string, typed nowhere else;
 *   T6 the two mounts — Landing.tsx hands "short" on its line 650, the page hands "whole"; the view is required, with no default: a
 *      mount that names none, or a name that is neither, draws nothing — React refuses it;
 *   T7 the behaviour — the pick is one React state, the first door at rest, handed to the short view; each tile picks its own door; the
 *      gold link is the Link to the form with the pick; the link under the panel is a Link to the section's own page, carrying no state;
 *   T8 the rulings — each quoted, exact, where it is built, under the brief's stamp (cited by its letter where an older census forbids its
 *      words); ruling i's notes re-said in place, no cited line moved; in every source file of the change a quote that follows a sentence
 *      of his for twenty characters is his words from there, whole or to a full stop, the quotes under his three stamps are the words
 *      they date, and each file's count of his quotes is held.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript) and the README. No clock, no live call. What a browser must show — the short
 * view beside the reference at 1440, 1024, 768 and 390 with each service picked, the page's height before and after, everything outside
 * the section and /professional-services equal to main, the requests, the picks, the gold link, the links, no sideways scroll — cannot be
 * held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { BUILD_PILLAR } from '../homeActWords';
import { PROFESSIONAL_SERVICES_PATH } from '../homePages';
import { SERVICES_ANCHOR } from '../homeAnchors';
import {
  NEED_QUESTION, PROPOSAL_CTA, PROPOSAL_FORM_PATH, SERVICES, SERVICE_NEEDS, proposalFormHref, serviceDoor,
  type ServiceNeed,
} from '../proposalNeeds';
import ServicesSection, { ServicesShortView, ServicesView, type ServicesViewProps } from '@/components/landing/ServicesSection';
// HOME-SERVICES-02 (2026-11-16): the short view draws the proposal form, from the hook its holder calls; SCOPED_BY_PROPOSAL and
// SEE_HOW_A_PROPOSAL_WORKS, which this file imported until then, are gone from the leaf (its rulings k and j)
import { useProposalForm, type ProposalForm } from '@/hooks/useProposalForm';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-trim-03';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const SERVICES01_REFERENCE = 'design-refs/home-services-01/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const SECTION = 'src/components/landing/ServicesSection.tsx';
const LEAF = 'src/lib/proposalNeeds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const PS_PAGE = 'src/app/professional-services/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/homeTrim03.test.ts';
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
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homeTrim02.test.ts's reading: text after the last block, or a block
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
/** The house prefix on every class a selector names: .ps-brief → .ts-ps-brief, .ps--short → .ts-ps--short. */
const prefixed = (selector: string): string => selector.replace(/\.ps(?=$|[^A-Za-z0-9])/g, '.ts-ps');
/** The port, read as homeServices01.test.ts reads it: from its first rule to the Financial Software section's. */
const PORT_OPEN = '.ts-ps {';
const NEXT_PORT = '.ts-fs-heading {';
/** The block: from its first rule to the Financial Software section's. */
const BLOCK_OPEN = '.ts-ps--short .ts-ps__inner {';
function blockCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(BLOCK_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the block opens at .ts-ps--short .ts-ps__inner and runs to the Financial Software section\'s port');
  return css.slice(at, end);
}

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted (a valueless attribute reads "true", as React writes one), every run of
 * text with React's escaping undone; comments and the whitespace that only lays the file out (a run holding a newline) dropped, a lone
 * space between two tags kept. With `prefix`, every class gets the house prefix. (homeTrim02.test.ts's reading.)
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
/** The reference script's own doors — what its pick() draws each service from: [need, title, line]. */
function referenceDoors(): Array<[need: string, title: string, line: string]> {
  const m = /\n {2}const SERVICES = (\[\[.*\]\]);\n/.exec(referenceText());
  assert.ok(m, 'the reference script\'s SERVICES');
  return JSON.parse(m[1]) as Array<[string, string, string]>;
}
/**
 * The reference's section as its own script paints it for one pick (its pick(): each tile's aria-pressed, the picked service's name and
 * line under the tiles, and the gold link's href — README: "Pressing a service picks it. Its name and line show under the tiles, and the
 * button's link carries it, as the reference's script shows.").
 */
function painted(need: string): string {
  const script = referenceText().slice(referenceText().indexOf('<script>'), referenceText().indexOf('</script>'));
  for (const line of [
    "for (const tile of section.querySelectorAll('.ps-tile')) tile.setAttribute('aria-pressed', String(tile.dataset.doneForYou === need));",
    "section.querySelector('.ps-brief .ps-stage__title').textContent = title;",
    "section.querySelector('.ps-brief .ps-stage__line').textContent = line;",
    "cta.setAttribute('href', '/work-with-me?need=' + need);",
  ]) assert.ok(script.includes(line), `the script's pick() does this, and these are its edits: ${line.slice(0, 60)}…`);
  const door = referenceDoors().find(([n]) => n === need);
  assert.ok(door, `the reference has the door "${need}"`);
  const [, title, line] = door;
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const once = (html: string, re: RegExp, by: string): string => { assert.equal((html.match(new RegExp(re.source, 'g')) ?? []).length, 1, `${re}: once`); return html.replace(re, by); };
  let html = referenceSection().replace(/(<button class="ps-tile" type="button" aria-pressed=")(?:true|false)(" data-done-for-you="([a-z]+)">)/g, (_m, a: string, b: string, n: string) => `${a}${n === need}${b}`);
  html = once(html, /(<div class="ps-brief">[\s\S]*?<h3 class="ps-stage__title" aria-live="polite">)[^<]*(<\/h3>)/, `$1${esc(title)}$2`);
  html = once(html, /(<p class="ps-stage__line">)[^<]*(<\/p>)/, `$1${esc(line)}$2`);
  return once(html, /(<a class="ps-cta" href=")[^"]*(">)/, `$1/work-with-me?need=${need}$2`);
}
const noop = (): void => {};
/**
 * HOME-SERVICES-02 (2026-11-16): the short view with a pick, drawn with the hook its holder calls — the proposal form under the tiles. Until then
 * the view took the pick alone: React.createElement(ServicesShortView, { picked, onPick: noop }). shortHead cuts a render at the form: what this
 * brief's section still is of it — the tag, the inner box, the name and line, the panel's question and tiles (each naming the form it opens,
 * aria-controls="ps-form", HOME-SERVICES-02's ruling a); refHead cuts the reference at its row, which left with that brief (its ruling j).
 */
const ShortWithForm = ({ picked }: { picked: ServiceNeed }) => React.createElement(ServicesShortView, { picked, onPick: noop, form: useProposalForm(picked), onClose: noop });
const shortRender = (picked: ServiceNeed): string => renderToStaticMarkup(React.createElement(ShortWithForm, { picked }));
const shortHead = (html: string): string => html.slice(0, html.indexOf('<div class="ts-ps-form"')).replace(/ aria-controls="ps-form"/g, '');
const refHead = (html: string): string => html.slice(0, html.indexOf('<div class="ps-brief">'));
/** The hook's form for a pick, as a render hands it — for a call of the pure view outside one. */
function formFor(picked: ServiceNeed): ProposalForm {
  let form: ProposalForm | null = null;
  const Capture = (): null => { form = useProposalForm(picked); return null; };
  renderToStaticMarkup(React.createElement(Capture));
  if (form === null) throw new Error('the hook was not called');
  return form;
}
const wholeRender = (picked: ServiceNeed): string => renderToStaticMarkup(React.createElement(ServicesView, { picked, onPick: noop }));
/** Every element a view draws, depth first — its function components drawn too (homeTrim02.test.ts's reading). */
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

const RULING = {
  a: 'ONE SECTION, TWO VIEWS, as HOME-TRIM-02 built them. ServicesSection takes view: \'short\' | \'whole\', required, with no default. It picks its pure view by a lookup that refuses any other name, as HowToSection does. A second pure view, ServicesShortView, stands beside ServicesView. Landing.tsx mounts view="short", /professional-services view="whole". The whole view renders byte for byte what main renders, on /professional-services and wherever a test renders it. What both views draw is written once (the name and line, the question and the six tiles, the gold link and its note). Nothing in the whole view is copied.',
  b: 'WHAT THE SHORT VIEW DRAWS is the reference\'s section. The picture, the three steps and their rail are absent from its markup, not hidden. The section keeps id={SERVICES_ANCHOR}, aria-labelledby="ps-title" and each tile\'s data-done-for-you, and adds the reference\'s hook, ts-ps--short. The picked service\'s name keeps aria-live="polite".',
  c: 'THE PICK is the section\'s own: React state, the first door at rest, nothing stored and nothing in the URL. The gold link is the same Link to proposalFormHref(picked).',
  d: 'THE WORDS. Nothing is typed. "See how a proposal works →" is new: one constant in src/lib/proposalNeeds.ts beside SCOPED_BY_PROPOSAL (:166), the arrow in the string, with a dated note. Its link is a next/link Link, as the gold link is, to PROFESSIONAL_SERVICES_PATH (src/lib/homePages.ts:42). It carries no state.',
  e: 'THE PORT. The block\'s rules name the section\'s classes, so they join its port: homeServices01:419 holds that no rule outside the port names one. They stand after the port\'s last rule, in the reference\'s order, and homeServices01 T3 names them as its fifth difference, declaration by declaration. The family is var(--font-mono), as the port\'s other mono rules have it. The rest of the port does not change.',
  f: 'NO NEW TOKEN. The block reads three that are in :root already (the README\'s table).',
  g: 'THE ARROWS in the two links are drawn by the fallback face, as "Send a project proposal →" already is on main. A later PR fixes every arrow at once. Name those pixels; do not fix them here.',
  h: 'QUOTES. This brief shares its first stamp and its approvals with HOME-PAGES-01, HOME-TRIM-01 and HOME-TRIM-02. In the files their tests read, quote it as HOME-TRIM-01 and HOME-TRIM-02 did, by its lettered rulings, so their quote censuses stand.',
  i: 'NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-TRIM-02 re-said its own: every sentence that says the home page draws the picture, the steps or the button under them. No line moves in a file whose lines a test or a law cites.',
  j: 'NOTHING ELSE CHANGES: not the hero, the other sections, About Us, Our Story, the footer, /work-with-me or /professional-services.',
} as const;
/** His request, under the brief's first stamp (2026-11-14 19:11 Manila), as the brief gives it. */
const REQUEST = 'I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback.';
/** Two of his four beta users' notes, as he pasted them. */
const BETA_NOTES = ['Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages', 'Make it exploratory. Click to learn more.'] as const;
/** His approval of the boards (20:01 Manila) and of the corrected boards (20:41). */
const APPROVAL = 'ALL LOOKS GOOD … OTHERWISE, LETS DO IT';
const APPROVAL_OF_THE_CORRECTED = 'thats it! yeet yeet!'; // two spaces after "it!" as he typed it; held with whitespace collapsed, as prose() reads a file

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-trim-03-handoff.zip, 2026-11-15): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 9744, '3df95271505aa0aa88ea43f6c7fc9d0bcb074dce53b80c7be411111b670dd44d'],
  [REFERENCE, 26787, 'acefd29957597945f72f531e151c9e5494da044a35659e8142227573f8251772'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size, and the folder holds the two; the reference\'s first stylesheet and its font link are home-services-01\'s, byte for byte', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes, as the brief gives it`);
    assert.equal(sha256(whole(file)), sha, `${file}: byte for byte (sha256), as the brief gives it`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html'], 'the folder holds the two files and nothing else');
  const [first, second, ...more] = stylesOf(referenceText());
  assert.equal(more.length, 0, 'the reference has two stylesheets');
  const services01 = stylesOf(whole(SERVICES01_REFERENCE));
  assert.equal(services01.length, 1, 'home-services-01\'s has one');
  assert.equal(first, services01[0], 'the first stylesheet is design-refs/home-services-01\'s, byte for byte — on main already, as the .ts-ps… port');
  assert.ok(second.includes('HOME-TRIM-03 · NEW WITH THIS SECTION: what the short view adds. The only rules to port.'), 'the second is what the short view adds');
  const fontLink = (html: string): string => { const m = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/.exec(html); assert.ok(m, 'a font link'); return m[0]; };
  assert.equal(fontLink(referenceText()), fontLink(whole(SERVICES01_REFERENCE)), 'and so is the font link');
});

// ── T2 · THE PORT'S NEW BLOCK ────────────────────────────────────────────────

/** The port's declarations at main (79948a9), before this block: their count, and sha256 of their lines, joined. */
const PORT_AT_MAIN = { declarations: 237, sha: '3250e920765f400b23772eaf9429a303f76781c99e8516e2aa41f082dcf67f99' };
/** HOME-SERVICES-02 (2026-11-16): the port before the block as that brief leaves it — the form's rules in, the note's out. */
const PORT_WITH_THE_FORM = { declarations: 432, sha: 'cdb0386e3b61cf27513d1770644846ff5eebf321034adf8928176f936ef82f9c' };
/** The README's table of the three tokens the block reads (README, "Already in the app, read by the short view's stylesheet"). */
const TOKENS: ReadonlyArray<readonly [token: string, value: string]> = [['fs-rule', '#EEEAF5'], ['hero-violet-3', '#32118A'], ['hero-violet-2', '#4D1FBC']];

test('T2 the block is the reference\'s second stylesheet, declaration by declaration and in order, behind the house prefix, the family the site\'s mono; it reads the README\'s three tokens, each in :root at its value, and types no colour; it stands directly after the port\'s last rule, and the rest of the port is main\'s', () => {
  const second = stylesOf(referenceText())[1];
  const all = declarations(uncommented(second));
  const expected = all.map((d) => {
    const [media, sel, decl] = d.split(' | ');
    return `${media} | ${prefixed(sel)} | ${decl.replace(/var\(--/g, 'var(--ts-').replace("'IBM Plex Mono', monospace", 'var(--font-mono)')}`;
  });
  assert.equal(expected.length, 28, 'twenty-eight declarations in six rules');
  const block = declarations(blockCss());
  // HOME-SERVICES-02 (2026-11-16), its ruling p: the block is design-refs/home-services-02's second stylesheet now (homeServices02.test.ts holds it,
  // declaration by declaration): this reference's first rule, the section's top and foot, stands first in it; the row's and the link's rules left
  // with the row and the link (its ruling j). Until then: assert.deepEqual(block, expected, …) — the block was this second stylesheet, whole —
  // and the link's family, ' | .ts-ps-how | font-family: var(--font-mono)', stood in it (ruling e).
  assert.deepEqual(block.slice(0, 2), expected.slice(0, 2), 'the section\'s top and foot, as this reference has them, first in the block');
  assert.equal(block.length, 27, 'the block as HOME-SERVICES-02 leaves it: twenty-seven declarations');
  for (const gone of ['.ts-ps-brief', '.ts-ps-how']) assert.ok(!block.some((d) => d.includes(gone)), `${gone}: its rules left with it`);
  // HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling f: "NO NEW TOKEN. The block reads three that are in :root
  // already (the README's table)." — it reads the three, each in :root at the README's value, and declares none
  const read = [...new Set([...blockCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
  // HOME-SERVICES-02 (2026-11-16): the block reads one token, in :root already — the three below and the site's mono until then, which stay in :root
  assert.deepEqual(read, ['--ts-fs-ink-soft'], 'it reads one token, nothing else (until HOME-SERVICES-02: [\'--ts-fs-rule\', \'--font-mono\', \'--ts-hero-violet-3\', \'--ts-hero-violet-2\'])');
  const readme = flat(whole(README));
  for (const [token, value] of TOKENS) {
    assert.ok(readme.includes(`| \`${token}\` | \`${value}\` |`), `the README's table: ${token} is ${value}`);
    assert.match(code(GLOBALS), new RegExp(`\\n {2}--ts-${token}: +${value};`), `--ts-${token} is in :root already, at ${value}`);
  }
  assert.doesNotMatch(blockCss(), /--[\w-]+\s*:|#[0-9a-fA-F]{3,8}\b|rgba?\(|!important/, 'no token declared, no colour typed, no !important');
  for (const line of block) for (const cls of line.split(' | ')[1].match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-ps'), `${line}: ${cls} is the section's`);
  // its seat: directly after the port's last rule, inside the port, above the Financial Software section's
  const css = code(GLOBALS);
  const last = '@media (prefers-reduced-motion: reduce) {\n  .ts-ps-tile, .ts-ps-cta, .ts-ps-pick { transition: none; }\n}';
  assert.equal(count(css, last), 1, 'the port\'s last rule, once');
  assert.match(css.slice(css.indexOf(last) + last.length, css.indexOf(BLOCK_OPEN)), /^\s*$/, 'the block stands directly after it — comments between, nothing else');
  assert.ok(css.indexOf(PORT_OPEN) < css.indexOf(BLOCK_OPEN) && css.indexOf(BLOCK_OPEN) < css.indexOf(NEXT_PORT), 'inside the port, above the Financial Software section\'s');
  // ruling e: "The rest of the port does not change." — the port's declarations before the block are main's
  const port = declarations(css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT)));
  // HOME-SERVICES-02 (2026-11-16): the block is the port's last twenty-seven, and before it the port holds the form's rules (its section 4, the four
  // rules of sections 5 and 6) and no note's — 432 declarations, PORT_WITH_THE_FORM; until then the last twenty-eight, PORT_AT_MAIN before them
  assert.deepEqual(port.slice(-27), block, 'the block is the port\'s last twenty-seven declarations');
  const before = port.slice(0, -27);
  assert.equal(before.length, PORT_WITH_THE_FORM.declarations, 'the port before the block: as HOME-SERVICES-02 leaves it');
  assert.equal(sha256(before.join('\n')), PORT_WITH_THE_FORM.sha, 'every declaration of it');
  assert.equal(PORT_AT_MAIN.declarations, 237, 'main\'s count before HOME-SERVICES-02, kept for the record');
});

// ── T3 · THE SHORT VIEW'S MARKUP ─────────────────────────────────────────────

test('T3 the short view\'s render is the reference\'s section, token for token, with each of the six services picked, as the reference\'s script paints it; the picture, the steps and their rail absent, not hidden; the act\'s tag first, the anchor once', () => {
  assert.deepEqual(referenceDoors(), SERVICES.map((s) => [s.need, s.title, s.line]), 'the reference\'s doors are SERVICES, in order — the same words');
  assert.equal(painted(SERVICES[0].need), referenceSection(), 'the reference\'s markup is the page at rest: its script paints the first door as drawn');
  // HOME-SERVICES-02 (2026-11-16): the short view is design-refs/home-services-02's section now, the proposal form under the tiles (homeServices02
  // holds it token for token). Of this reference it keeps everything above its row — the tag, the box, the name and line, the panel's question
  // and tiles, each tile naming the form it opens. Until then the whole render was this reference's section, token for token, with each pick.
  for (const need of SERVICE_NEEDS) {
    const html = shortRender(need);
    assert.deepEqual(tokensOf(shortHead(html), false), tokensOf(refHead(painted(need)), true), `${need}: the reference's section above its row, token for token`);
    assert.ok(html.startsWith(`<section id="${SERVICES_ANCHOR}" class="ts-ps ts-ps--short" aria-labelledby="ps-title">`), `${need}: the act's tag — the id and the label kept, ts-ps--short added (ruling b)`);
    assert.equal(count(html, `id="${SERVICES_ANCHOR}"`), 1, `${need}: the anchor, once`);
    assert.equal(count(html, ' data-done-for-you="'), 6, `${need}: each tile keeps its hook`);
    assert.equal(count(shortHead(html), 'aria-pressed="true"'), 1, `${need}: one tile pressed (above the form — its picks with a default are pressed too, since HOME-SERVICES-02, 2026-11-16)`);
    assert.ok(html.includes(`aria-pressed="true" aria-controls="ps-form" data-done-for-you="${need}"`), `${need}: its own — naming the form it opens since HOME-SERVICES-02 (2026-11-16)`);
    assert.equal(count(html, '<h3 class="ts-ps-stage__title" aria-live="polite">'), 1, `${need}: the picked service's name keeps aria-live="polite" (ruling b)`);
    // HOME-SERVICES-02 (2026-11-16, ruling j): no link — the gold link to the form with the pick (ruling c) and the link under the panel to the
    // section's own page (ruling d) stood here until then, '<a ' twice
    assert.equal(count(html, '<a '), 0, `${need}: no link — the section sends nobody elsewhere`);
    assert.ok(!html.includes(`href="${proposalFormHref(need)}"`) && !html.includes(`href="${PROFESSIONAL_SERVICES_PATH}"`), `${need}: neither path`);
    // absent from the markup (ruling b); ts-ps-step's mark is the thank-you's since HOME-SERVICES-02 ('ts-ps-step' stood in this list until then)
    for (const gone of ['<img', 'ts-ps-stage"', 'ts-ps-stage__art', 'ts-ps-stage__text', 'ts-ps-steps', 'ts-ps-step"', 'ts-ps-step__rail', 'ts-ps-chip', 'ts-ps-cta-row', '<ol']) assert.equal(count(html, gone), 0, `${need}: no ${gone} — absent from the markup (ruling b)`);
    assert.doesNotMatch(shortHead(html), /\shidden(?=[\s>=])/, `${need}: nothing hidden above the form — what is not drawn is not there (the whole render, until HOME-SERVICES-02 drew the form, whose closed parts hide)`);
  }
  // HOME-SERVICES-02 (2026-11-16, ruling a): at rest nothing is picked and the form hides — "draws the short view at rest: the first door", equal to shortRender(SERVICES[0].need), until then
  const atRest = renderToStaticMarkup(React.createElement(ServicesSection, { view: 'short' }));
  assert.equal(count(atRest, 'aria-pressed="true"'), 0, 'the default export, handed "short", draws the short view at rest: no service picked');
  assert.ok(atRest.includes('<div class="ts-ps-form" id="ps-form" hidden="">'), 'and the form, hidden');
  // every class the short view wears is the port's, and the block rules nothing it does not wear
  const css = code(GLOBALS);
  const port = declarations(css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT)));
  const ruled = new Set(port.flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []));
  // HOME-SERVICES-02 (2026-11-16): the trap, /work-with-me's honeypot, wears Tailwind's classes, as it did there — the classes read are the house's
  const worn = new Set(SERVICE_NEEDS.flatMap((need) => [...shortRender(need).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))).filter((cls) => cls.startsWith('ts-')));
  for (const cls of worn) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule of the port`);
  for (const cls of new Set(declarations(blockCss()).flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []))) assert.ok(worn.has(cls.slice(1)), `${cls}, which the block rules, is worn by the short view`);
});

// ── T4 · THE WHOLE VIEW ──────────────────────────────────────────────────────

/** The whole view's render at main (79948a9), sha256 — each of the six doors picked; and the default export at rest, the first. */
const WHOLE_AT_MAIN: Readonly<Record<string, string>> = {
  setup: '5a2795fd6ee75ed7561b3183c1dc0bca0e6d416590d6e83d67ed06956402b516',
  maintenance: '588d71c032323d42307036460c72bf00534deb417c26d6e514a274bbda0676f8',
  custom: 'df675792b109d031474a1276d08d91997f361c18961db3bce199c8f17bd5f4ae',
  embed: '27dd7a1db44c853a8cbe8fcfe14f3d58cf24a5e24aa6bf8eecbec6ef264016a8',
  bookkeeping: '07d423880fa2f5b77a6e0ab6aba4abfcd4800974a4d021e45a3fb4cc22be59ee',
  unsure: '1ab38b25df0eef8b8650b03f3a973f3f9972e203cee75be7cf9bbd05e3f4a7a8',
};

test('T4 the whole view\'s render is main\'s, byte for byte, with each of the six services picked, and the default export handed "whole" draws it', () => {
  // ruling a: "The whole view renders byte for byte what main renders, on /professional-services and wherever a test renders it."
  assert.deepEqual(Object.keys(WHOLE_AT_MAIN), [...SERVICE_NEEDS], 'a digest for each door, in order');
  // HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling l, in part: "Its render is main's but for the note." — with the note put back beside the gold link, each render
  // is main's, byte for byte; it is not there (ruling k). Until then the render itself hashed to main's.
  const withNote = (html: string): string => html.replace(/(<a class="ts-ps-cta" [^>]*>[^<]*<\/a>)/, '$1<span class="ts-ps-note">Scoped by proposal</span>');
  for (const need of SERVICE_NEEDS) {
    assert.equal(sha256(withNote(wholeRender(need))), WHOLE_AT_MAIN[need], `${need}: main's render, byte for byte, but for the note`);
    assert.ok(!wholeRender(need).includes('ts-ps-note'), `${need}: no note`);
  }
  assert.equal(sha256(withNote(renderToStaticMarkup(React.createElement(ServicesSection, { view: 'whole' })))), WHOLE_AT_MAIN.setup, 'the default export, handed "whole": main\'s render at rest, the first door, but for the note — as /professional-services hands it');
});

// ── T5 · THE WORDS ───────────────────────────────────────────────────────────

test('T5 every word the short view draws is a leaf\'s, in order, and the reference draws the same; the one new one is one constant in the leaf, beside SCOPED_BY_PROPOSAL, the arrow in the string, typed nowhere else', () => {
  // HOME-SERVICES-02 (2026-11-16, rulings j and k): the link's words and the note left the leaf with the link and the note — "See how a proposal
  // works →" was one constant there (ruling d), SEE_HOW_A_PROPOSAL_WORKS, directly after SCOPED_BY_PROPOSAL, whose line, :166, the brief cites:
  // that line is gone with the constant (ruling k). Until then this test held the constant, its arrow, its seat after :166, and one file typing it.
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('See how a proposal works') || code(f).includes('SEE_HOW_A_PROPOSAL_WORKS')), [], 'the link\'s words stand in no file\'s code under src but the tests');
  assert.ok(!code(LEAF).includes('SCOPED_BY_PROPOSAL'), 'proposalNeeds.ts:166, SCOPED_BY_PROPOSAL, is gone with the note');
  // every word drawn, in order: the leaves' own — and the reference draws the same
  for (const need of SERVICE_NEEDS) {
    const door = serviceDoor(need);
    // HOME-SERVICES-02 (2026-11-16): above the form, the words this reference draws above its row; the door's name and line stand in the form's head
    // now, and the form's words are the list's (homeServices02 holds them). Until then, after the tiles: door.title, door.line, PROPOSAL_CTA,
    // SCOPED_BY_PROPOSAL and SEE_HOW_A_PROPOSAL_WORKS, the whole render's words and the reference's.
    const words = [BUILD_PILLAR.heading, ...BUILD_PILLAR.paragraphs, NEED_QUESTION, ...SERVICES.flatMap((s) => (s.kind === null ? [s.title] : [s.title, s.kind]))];
    assert.deepEqual(textsOf(shortHead(shortRender(need))), words, `${need}: every word a leaf's, in order`);
    assert.deepEqual(textsOf(refHead(painted(need))), words, `${need}: and the reference draws the same words`);
    assert.ok(textsOf(shortRender(need)).includes(door.title) && textsOf(shortRender(need)).includes(door.line), `${need}: the door's name and line, in the form's head`);
  }
  // the section types none of them, and neither path: it writes no template literal
  const section = code(SECTION);
  assert.equal(count(section, '`'), 0, 'no template literal in the section');
  // HOME-SERVICES-02 (2026-11-16): the words above the form — the form's are the list's, typed in src/lib/proposalNeeds.ts (homeServices02 holds that
  // no component types one); the whole render's words until then
  for (const w of new Set(SERVICE_NEEDS.flatMap((need) => textsOf(shortHead(shortRender(need)))))) assert.ok(!section.includes(w), `ServicesSection.tsx does not type "${w}"`);
  assert.ok(!section.includes(PROFESSIONAL_SERVICES_PATH) && !section.includes(PROPOSAL_FORM_PATH), 'both paths are read, not typed');
  assert.equal(count(section, 'className="ts-ps-how"'), 0, 'no link under the panel (HOME-SERVICES-02, 2026-11-16, ruling j) — a next/link Link in the README\'s class, to the pages\' leaf\'s path, with the leaf\'s words, until then (ruling d)');
});

// ── T6 · THE TWO MOUNTS ──────────────────────────────────────────────────────

test('T6 Landing.tsx hands "short" on its line 650, /professional-services hands "whole"; the view is required, with no default — a mount that names none, or a name that is neither, draws nothing', () => {
  const landing = code(LANDING);
  const lines = landing.split('\n');
  assert.equal(lines[649], '      <ServicesSection view="short" />', 'line 650: the mount, where it stood, handed the short view');
  assert.equal(count(landing, '<ServicesSection'), 1, 'mounted once');
  assert.equal(lines.length, 816, 'Landing.tsx is the 815 lines it was (and its closing line break)');
  assert.equal(count(code(PS_PAGE), '<ServicesSection view="whole" />'), 1, '/professional-services: the whole view');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('<ServicesSection')).sort(), [PS_PAGE, LANDING].sort(), 'mounted by those two alone');
  assert.ok(!landing.includes('homePages') && !landing.includes('PROFESSIONAL_SERVICES_PATH'), 'Landing.tsx reads nothing of the pages\' leaf: the section does');
  // ruling a: "required, with no default" — "a lookup that refuses any other name, as HowToSection does"
  const section = code(SECTION);
  assert.match(section, /export default function ServicesSection\(\{ view \}: \{ view: 'short' \| 'whole' \}\) \{/, 'the view: two names, required');
  // HOME-SERVICES-02 (2026-11-16, ruling a): "short" finds the short view's holder, which keeps its own pick and draws ServicesShortView — short:
  // ServicesShortView until then
  assert.match(section, /^const VIEWS = \{ __proto__: null, short: ServicesShortHolder, whole: ServicesView \} as const;$/m, 'each view by its name, in an object with no prototype to lend one');
  assert.equal(count(section, 'const View = VIEWS[view];'), 1, 'looked up, not chosen by a ternary');
  assert.doesNotMatch(section, /view \?\?|view \|\||view === |view !== |= 'whole'|= 'short'/, 'no default and no fall-through: nothing stands in for a missing view');
  assert.throws(() => renderToStaticMarkup(React.createElement(ServicesSection as unknown as React.FC)), /Element type is invalid/, 'a mount that names no view draws nothing: React refuses it');
  const untyped = ServicesSection as unknown as React.FC<{ view: string }>;
  for (const name of ['', 'Short', 'toString', 'constructor', 'valueOf', '__proto__']) assert.throws(() => renderToStaticMarkup(React.createElement(untyped, { view: name })), /Element type is invalid/, `view "${name}" draws nothing`);
});

// ── T7 · THE SHORT VIEW'S BEHAVIOUR ──────────────────────────────────────────

test('T7 the pick is one React state, the first door at rest, handed to the short view; each tile picks its own door; the gold link is the Link to the form with the pick; the link under the panel is a Link to the section\'s own page that carries no state', () => {
  // HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling c: "THE PICK is the section's own: React state, the first
  // door at rest, nothing stored and nothing in the URL. The gold link is the same Link to proposalFormHref(picked)."
  // HOME-SERVICES-02 (2026-11-16, rulings a and l): the default export's pick is the whole view's; handed "short" it draws the short view's holder,
  // which keeps its own — none at rest (homeServices02 holds the toggle). Until then the one state was handed to the short view: the first door
  // at rest, then each pick, as the state held it (a Host called the default export and drove onPick through the six).
  const Host = (): null => {
    const el = ServicesSection({ view: 'short' }) as React.ReactElement<ServicesViewProps>;
    assert.equal((el.type as { name?: string }).name, 'ServicesShortHolder', 'handed "short", the default export draws the short view\'s holder');
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  for (const need of SERVICE_NEEDS) {
    const picks: string[] = [];
    const drawn = drawnElementsOf(ServicesShortView({ picked: need, onPick: (n) => { picks.push(n); }, form: formFor(need), onClose: noop }));
    // HOME-SERVICES-02 (2026-11-16): the form's buttons are drawn too — the tiles are the buttons with the hook (every button, until then)
    const tiles = drawn.filter((el) => el.type === 'button' && typeof el.props['data-done-for-you'] === 'string');
    assert.deepEqual(tiles.map((el) => el.props['data-done-for-you']), [...SERVICE_NEEDS], `${need}: six tiles, in the doors' order`);
    assert.deepEqual(tiles.map((el) => el.props['aria-pressed']), SERVICE_NEEDS.map((n) => n === need), `${need}: the picked one is pressed, and only it`);
    for (const tile of tiles) (tile.props.onClick as () => void)();
    assert.deepEqual(picks, [...SERVICE_NEEDS], `${need}: each tile picks its own door`);
    // HOME-SERVICES-02 (2026-11-16, ruling j): no link — until then the gold link to the form with the pick (ruling c), ['ts-ps-cta',
    // proposalFormHref(need)], then the link to the section's own page, which carried no state (ruling d), ['ts-ps-how', PROFESSIONAL_SERVICES_PATH],
    // both next/link Links
    assert.deepEqual(drawn.filter((el) => typeof el.props.href === 'string'), [], `${need}: no link`);
  }
  // nothing stored, nothing in the URL: the section's only state is the default export's pick
  const section = code(SECTION);
  assert.equal(count(section, 'useState<ServiceNeed>(SERVICES[0].need)'), 1, 'one state: the pick, the first door at first');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|window\.|\blocation\b|\bfetch\s*\(|searchParams|useRouter|usePathname|useEffect/, 'nothing stored, nothing read from or written to the URL');
});

// ── T8 · THE RULINGS ─────────────────────────────────────────────────────────

/** A sentence of a ruling, from its start to its full stop — the form a ruling is quoted in where an older census forbids its opening. */
function sentenceOf(ruling: string, starts: string): string {
  const at = ruling.indexOf(starts);
  assert.ok(at > -1, `the ruling holds "${starts}"`);
  const end = ruling.indexOf('. ', at);
  return end < 0 ? ruling.slice(at) : ruling.slice(at, end + 1);
}

test('T8 each ruling is quoted, exact, where it is built, under the brief\'s stamp — by its letter and a sentence that opens nothing where an older census forbids its opening; ruling i\'s notes re-said in place, dated, and no cited line moved; in every source file of the change a quote that follows a sentence of his for twenty characters is his words from there, whole or to a full stop, the quotes under his three stamps are the words they date, and each file\'s count of his quotes is held', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  const MOUNTS = sentenceOf(RULING.a, 'Landing.tsx mounts');
  const FAMILY = sentenceOf(RULING.e, 'The family is');
  const THREE = sentenceOf(RULING.f, 'The block reads');
  assert.equal(MOUNTS, 'Landing.tsx mounts view="short", /professional-services view="whole".', '(a check of the slicing above, not of the tree)');
  // where each is built: whole where no older census reaches (ServicesSection.tsx is on HOME-PAGES-01's list alone, and these share nothing
  // with its words; proposalNeeds.ts and homeServices01.test.ts are on none); a sentence that opens nothing where HOME-TRIM-01's or
  // HOME-TRIM-02's census reads the file (Landing.tsx, globals.css), as HOME-TRIM-02 quoted its own ruling l in Landing.tsx; and in this
  // file, on no census, rulings c (T7), f (T2) and h (below) whole
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [SECTION, [RULING.a, RULING.b, RULING.c, RULING.d, RULING.g, RULING.i, RULING.j]],
    [LEAF, [RULING.d]],
    [GLOBALS, [FAMILY, THREE]],
    [LANDING, [MOUNTS]],
    [PS_PAGE, [MOUNTS, RULING.j]],
    [tests('homeServices01'), [RULING.e]],
    [THIS, [RULING.c, RULING.f, RULING.h]],
  ];
  const STAMP = /HOME-TRIM-03 (?:\(|— )Alex's brief, 2026-11-14 19:11 Manila[^()]*built 2026-11-15\)/;
  for (const [file, rulings] of BUILT) {
    const said = prose(file);
    assert.match(said, STAMP, `${file} names the brief, dates it (2026-11-14 19:11 Manila) and dates the build (2026-11-15)`);
    for (const ruling of rulings) {
      assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
      const at = said.indexOf(`"${flat(ruling)}"`);
      const under = said.slice(said.lastIndexOf('HOME-TRIM-03', at), at);
      assert.ok(under.includes("Alex's brief, 2026-11-14 19:11 Manila") && under.includes('2026-11-15'), `${file}: "${ruling.slice(0, 30)}…" stands under the brief's stamp — "${under.slice(0, 90)}…"`);
    }
  }
  // where an older census forbids a ruling's opening, it is cited by its letter: rulings e, f and g in globals.css; i and j in Landing.tsx
  assert.match(prose(GLOBALS), /Ruling e \(the port[^)]*\): "The family is var\(--font-mono\)/, 'globals.css cites ruling e by its letter, then its sentence on the family');
  assert.match(prose(GLOBALS), /Ruling f \(no new token\): "The block reads three/, 'and ruling f, then its second sentence');
  assert.match(prose(GLOBALS), /Ruling g \(the arrows\): the "→" in the two links is drawn by the fallback face/, 'and ruling g, said, not quoted');
  assert.match(prose(LANDING), /Its rulings i and j, by their letters: this note is re-said in place, on its own seven lines, and nothing else on this page changes\./, 'Landing.tsx cites rulings i and j by their letters');
  // HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling h — built here, by the census of his words below, and in
  // the older censuses' files by the letters they cite: "QUOTES. This brief shares its first stamp and its approvals with HOME-PAGES-01,
  // HOME-TRIM-01 and HOME-TRIM-02. In the files their tests read, quote it as HOME-TRIM-01 and HOME-TRIM-02 did, by its lettered rulings, so
  // their quote censuses stand." So the request, the first beta note and the two approvals — the words this brief shares with those three —
  // stand only in files none of their tests reads: the leaf and this file
  for (const [words, where] of [[REQUEST, '19:11 Manila: '], [APPROVAL, '20:01 Manila: '], [APPROVAL_OF_THE_CORRECTED, '20:41: ']] as const) {
    assert.ok(prose(LEAF).includes(`${where}"${words}"`) && prose(THIS).includes(`${where}"${words}"`), `"${words.slice(0, 30)}…" under its stamp, in the leaf and in this file`);
  }
  for (const note of BETA_NOTES) for (const file of [LEAF, THIS]) assert.ok(quoted(file, note), `${file} quotes "${note.slice(0, 30)}…", exact`);
  // ruling i: the notes that went false, re-said in place and dated — each re-said phrase stands, and main's sentence is gone where it differs
  const RESAID: ReadonlyArray<readonly [file: string, now: RegExp, gone: RegExp | null]> = [
    [LANDING, /HOME-TRIM-03, 2026-11-15: its short view here — the picked door's name and line with the gold button in one row under the tiles, then a link to \/professional-services, where the picture and the steps stand/, /it carries id="services"\)/],
    [LANDING, /as the board draws it\. UNTIL HOME-TRIM-03 this note went on, true until then: "— the pillar's name and one line where his paragraph stood, six tiles/, /as the board draws it — the pillar's name and one line where his paragraph stood/],
    [SECTION, /AS DRAWN — since HOME-TRIM-03 \(2026-11-15\), its WHOLE view, on its own page alone \(view="whole"; on its own page since HOME-PAGES-01, 2026-11-14, and the guest landing's second pillar until then/, /AS DRAWN: the guest landing's second pillar/],
    [SECTION, /Top to bottom, the whole view:/, /Top to bottom: 1\./],
    [SECTION, /"whole" on both until HOME-TRIM-03 \(2026-11-15\): the page hands it view="whole" now, and Landing\.tsx view="short"/, null],
    [SECTION, /the whole view's stage \(the short view draws no picture since HOME-TRIM-03, 2026-11-15: its ruling b, at the short view\) draws one <img> per key/, /fails the build by name\." — the stage draws one <img> per key/],
    ['src/lib/homeActWords.ts', /and the pictures there show the rest — in its whole view, on \/professional-services \(its own page since HOME-PAGES-01, 2026-11-14\), and there alone since HOME-TRIM-03 \(2026-11-15\): the home page draws its short view, which draws none\./, /pictures there show the rest\./],
    [PS_PAGE, /The home page keeps its own mount of the same component \("unchanged" until HOME-TRIM-03 \(Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15\), which hands the home page's mount view="short" and this one view="whole"/, /of the same component, unchanged\./],
    [GLOBALS, /but for the FIVE DIFFERENCES named here \(HOME-TRIM-03, 2026-11-15: FOUR DIFFERENCES until then\)/, /homeServices01\.test\.ts reads both files and holds them equal, declaration by declaration, but for the FOUR DIFFERENCES/],
    [GLOBALS, /Five of the six pictures are in the page and hidden — the whole view's page, \/professional-services \(its own page since HOME-PAGES-01, 2026-11-14\), alone since HOME-TRIM-03 \(2026-11-15\): the home page's short view draws none\./, /Five of the six pictures are in the page and hidden\. Used by/],
    [GLOBALS, /Used by src\/components\/landing\/ServicesSection\.tsx — its whole view on \/professional-services, and its short view, which Landing\.tsx mounts \(HOME-TRIM-03, 2026-11-15: "which Landing\.tsx mounts" said the whole section until then\)/, /ServicesSection\.tsx, which Landing\.tsx mounts\. It stands here/],
    [tests('homeServices01'), /the gold button to the form with the pick — on the home page until HOME-TRIM-03 \(2026-11-15\), which draws the section's short view there/, /the gold button to the form with the pick\. The spec is a file/],
    [tests('homeServices01'), /ServicesSection\.tsx, which Landing\.tsx mounts \(its short view since HOME-TRIM-03, 2026-11-15; its whole view on \/professional-services\)/, /ServicesSection\.tsx, which Landing\.tsx mounts; its words/],
    [tests('homeServices01'), /but for the five differences named there \(the fifth the home page's short view, HOME-TRIM-03, 2026-11-15 — "the four" until then\)/, /but for the four differences named there;/],
    [tests('homeServices01'), /the section's render \(its whole view; the home page's at rest until HOME-TRIM-03, 2026-11-15\) is the reference's markup/, /the page at rest — the section's render is the reference's markup/],
    [tests('homeServices01'), /and no form; Landing\.tsx mounts it once \(handing it view="short" since HOME-TRIM-03, 2026-11-15 — the short view's markup is homeTrim03\.test\.ts's\);/, /and no form; Landing\.tsx mounts it once;/],
    [tests('homeServices01'), /THE FIVE DIFFERENCES the port names \(globals\.css, its header — "THE FOUR" until HOME-TRIM-03, 2026-11-15\)/, /THE FOUR DIFFERENCES the port names \(globals\.css, its header\), applied/],
    [tests('homeServices01'), /its function components drawn too: HOME-TRIM-03 \(2026-11-15, ruling a\) writes the tiles once/, /Every element in a tree, depth first\. Components are not called/],
    [tests('services01'), /drawn as design-refs\/home-services-01\/Section-Reference\.html draws it \(its whole view, on \/professional-services; the home page's mount draws its short view since HOME-TRIM-03, 2026-11-15, as design-refs\/home-trim-03 draws it/, null],
    [tests('homePages01'), /HOME-TRIM-03 \(2026-11-15\) changed it once more: the Professional Services section is mounted with its short view, and reads the leaf for that view's link\./, null],
    [LANDING, /\.\/ServicesSection draws it as design-refs\/home-services-01 does \(its whole view, on \/professional-services — its own page since HOME-PAGES-01, 2026-11-14; since HOME-TRIM-03, 2026-11-15, here it draws its short view, as design-refs\/home-trim-03 does\)/, /draws it as design-refs\/home-services-01 does, and the gold button/],
    ['src/app/work-with-me/WorkWithMeForm.tsx', /the services section draws them too \(its whole view, on \/professional-services, all five; since HOME-TRIM-03, 2026-11-15, the home page's short view draws the need question and the note, and "the landing's section draws them too" stood until then\)/, /Send — the landing's section draws them too, so both/],
    [tests('homeServices01'), /the page mounts it once, imported once — its short view since HOME-TRIM-03 \(2026-11-15\); the render above is the whole view's/, null],
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its note re-said, dated, saying what it said until then`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
  }

  // and the tests' titles it re-said — strings, so read in the code: the re-said words stand, and main's are gone
  const TITLES: ReadonlyArray<readonly [file: string, now: string, gone: string | null]> = [
    [tests('homeServices01'), 'but for the five named differences (the fifth the home page', 'but for the four named differences; no hex'],
    [tests('homeServices01'), 'Landing.tsx mounts it once — its whole view: the home page', null],
    [tests('homePages01'), 'T8 the home page, as HOME-TRIM-02 left it (2026-11-15; "as HOME-TRIM-01 left it" until then), and HOME-TRIM-03 after it (2026-11-15):', null],
  ];
  for (const [file, now, gone] of TITLES) {
    assert.ok(code(file).includes(now), `${file}: a title re-said — "${now}"`);
    if (gone) assert.ok(!code(file).includes(gone), `${file}: and main's title is gone — "${gone}"`);
  }
  const design = flat(whole('DESIGN.md'));
  assert.match(design, /The section \(`ServicesSection\.tsx`, which `Landing\.tsx` mounts — whole until HOME-TRIM-03 \(2026-11-15\), and whole on `\/professional-services` — its own page since HOME-PAGES-01 \(2026-11-14\) — alone since, where the home page draws its short view, `design-refs\/home-trim-03\/`, whose stylesheet reads three tokens the app holds and adds none\)/, 'DESIGN.md: the section\'s sentence re-said, dated');
  assert.doesNotMatch(design, /which `Landing\.tsx` mounts\) is drawn/, 'DESIGN.md: and main\'s sentence is gone');
  assert.ok(whole('DESIGN.md').includes('This PR\'s stylesheet reads nineteen of the twenty-one: `red` and `fs-gold-text` are the\nform\'s'), 'and the sentence homeServices01:400 holds, as it stood');
  // no cited line moved: the files whose lines a test or a law cites, held to their lines
  const LINES: ReadonlyArray<readonly [file: string, line: number, text: string]> = [
    [LANDING, 650, '      <ServicesSection view="short" />'],
    // HOME-SERVICES-02 (2026-11-16, ruling k): proposalNeeds.ts:166, "export const SCOPED_BY_PROPOSAL = 'Scoped by proposal';", stood here until then — the
    // line left with the note it held, and the brief's citation of it, ruling d's "(:166)", is history (T5 holds the constant gone)
    ['src/lib/homePages.ts', 42, "export const PROFESSIONAL_SERVICES_PATH = '/professional-services';"],
  ];
  for (const [file, line, text] of LINES) assert.equal(code(file).split('\n')[line - 1], text, `${file}:${line}, the line the brief cites, where it stood`);
  assert.equal(code(tests('homeServices01')).split('\n')[418], "  assert.doesNotMatch(outside, /\\.ts-ps\\b|\\.ts-ps[-_]/, 'no rule outside the port names one of its classes');", 'homeServices01:419, the line ruling e cites, where it stood');
  assert.equal(code(LAW).split('\n')[709].slice(0, 60), "{ const before = violations.length; violations.push(...servi", 'the law\'s line 710, which homeServices01 T9 reads, where it stood');
  const HELD: ReadonlyArray<readonly [file: string, lines: number]> = [[LANDING, 815], [LAW, 11254], [PS_PAGE, 42]];
  for (const [file, lines] of HELD) assert.equal(whole(file).split('\n').length - 1, lines, `${file}: ${lines} lines, as it was`);
  // EVERY SOURCE FILE OF THE CHANGE
  const CHANGED = [
    THIS,
    SECTION, LEAF, GLOBALS, LANDING, PS_PAGE, 'src/lib/homeActWords.ts', 'src/app/work-with-me/WorkWithMeForm.tsx',
    ...['homeServices01', 'services01', 'homePages01', 'homeOrder01', 'homePanels02', 'stopZero01', 'howTo01', 'footer01'].map(tests),
  ];
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  for (const file of CHANGED) {
    const said = prose(file);
    for (const m of said.matchAll(/19:11 Manila: "([^"]+)"/g)) assert.equal(m[1], REQUEST, `${file}: under the 19:11 stamp, his request, exact`);
    for (const m of said.matchAll(/20:01 Manila: "([^"]+)"/g)) assert.equal(m[1], APPROVAL, `${file}: under the 20:01 stamp, his approval of the boards, exact`);
    for (const m of said.matchAll(/20:41(?: Manila)?: "([^"]+)"/g)) assert.equal(m[1], APPROVAL_OF_THE_CORRECTED, `${file}: under the 20:41 stamp, his approval of the corrected boards, exact`);
  }
  // HIS WORDS ARE THE FIFTEEN BELOW: his request, the ten rulings, the two beta notes, the two approvals. A straight double mark followed by
  // twenty or more characters of one of their sentences, from the sentence's start, opens a quote of him: what stands from there to the closing
  // mark is his words from that sentence on — to the end of the piece on file, or to a full stop — or this fails and says where the two part.
  // A whole sentence of his shorter than that is read too, and counted. Each file's count of the quotes read is held. (homeTrim02's census.)
  const HIS_WORDS = [REQUEST, ...Object.values(RULING), ...BETA_NOTES, APPROVAL, APPROVAL_OF_THE_CORRECTED];
  assert.equal(HIS_WORDS.length, 15);
  // six spans in the sixteen follow a sentence of his that far and are not his: older briefs' rulings, each quoted in the file that built it. Each is
  // excepted by name — that file, those words as they go on there — so the same words anywhere else, or going on any other way, are read against his
  const NOT_HIS: ReadonlyArray<readonly [file: string, opens: string, whose: string]> = [
    [GLOBALS, 'THE PORT. The block\'s rules name the section\'s classes, so they join its port: homePlans04:425', 'HOME-TRIM-02, ruling f'],
    [GLOBALS, 'NO NEW TOKEN. The block reads no variable.', 'HOME-TRIM-02, ruling g'],
    [GLOBALS, 'THE ARROWS in the two links are drawn by the fallback face, as "Compare all four plans →"', 'HOME-TRIM-02, ruling i'],
    [LANDING, 'NOTHING ELSE CHANGES: not the hero, the other sections, About Us, Our Story, the footer, /pricing or /financial-software.', 'HOME-TRIM-02, ruling k'],
    [LANDING, 'NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-PAGES-01 re-said its own:', 'HOME-TRIM-01, ruling b'],
    ['src/lib/homeActWords.ts', 'THE WORDS. Nothing is typed in the band.', 'HOME-TRIM-01, ruling c'],
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
          else if (n >= 20 && !NOT_HIS.some(([where, opens]) => where === file && rest.startsWith(opens))) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece of his words on file goes on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(NOT_HIS.map(([where, opens]) => count(prose(where), `"${opens}`)), [1, 1, 1, 1, 1, 1], 'each excepted span stands once, where it is said to');
  // ruling h: the request, the first beta note and the two approvals — the words this brief shares with HOME-PAGES-01, HOME-TRIM-01 and
  // HOME-TRIM-02 — are quoted only in files none of their tests reads: this one and the leaf
  assert.deepEqual(Object.keys(shared).sort(), [LEAF, THIS].sort(), 'the shared words stand in the leaf and this file alone');
  assert.deepEqual(census, {
    [THIS]: 10, // the header: his request, the two beta notes, the two approvals; a sentence each of rulings e (T2) and a (T4); rulings f (T2), c (T7) and h (T8) whole
    [SECTION]: 7, // rulings a, b, c, d, g, i and j
    [LEAF]: 6, // his request, the two beta notes, the two approvals, ruling d
    [GLOBALS]: 2, // a sentence each of rulings e and f, over the block
    [LANDING]: 2, // ruling a's sentence of the mounts, at the mount; and HOME-TRIM-02's quote of its own ruling l's last sentence, which is ruling i's last sentence too
    [PS_PAGE]: 2, // ruling a's sentence of the mounts, ruling j
    [tests('homeServices01')]: 1, // ruling e, at the fifth difference
  }, 'each file\'s quotes of him, counted — thirty in seven of the sixteen: a quote that stood and no longer opens on his words leaves its file\'s count, and fails here');
});
