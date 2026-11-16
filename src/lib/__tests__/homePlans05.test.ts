/**
 * HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila: "I am wondering if we can make them toggles, to open up a drop down , on the home
 * page, rather than routing to a new page?" · "also the buttons look rather mediocore, and dont really follow the look of the rest of the
 * page..."; his approval of the boards on the design canvas, 00:19 Manila: "AMAZING YES!! EXACTLY!!!! Those TOGGLES ARE PERFECT!!"; built
 * 2026-11-16) — FINANCIAL SOFTWARE'S SHORT VIEW: THE PANEL'S TWO LINKS BECOME TOGGLES THAT OPEN THE WHOLE VIEW'S PARTS ON THE HOME PAGE.
 *
 * HOME-TRIM-02 drew the section's short view on the home page: its name and line, the panel with the question, the three choices and two
 * links (to /financial-software and to /pricing), then the one plan the choices pick. This change makes the two links two toggles, each a
 * button that opens, in place, the part of the whole view it named: "See all 25 tools" the map's grid inside the panel, "Compare all four
 * plans" the three cards and the band in place of the one plan. The spec is a file: design-refs/home-plans-05/Section-Reference.html, with
 * its README beside it; its first two stylesheets are on main already, and its third is ported as the Financial Software port's last rules.
 * What is held here:
 *
 *   T1 the handoff — the README and the reference in the tree, byte for byte (sha256) and by size, and the folder holds the two; the
 *      reference's first stylesheet is design-refs/home-plans-04's and its second design-refs/home-trim-02's second, byte for byte;
 *   T2 the port — its new block IS the reference's third stylesheet, declaration by declaration and in order, behind the house prefix, but
 *      for that page's own rule; it reads the README's five tokens and declares none; it ends the port, after the short view's block, which
 *      lost the links' two rules; every rule before them is main's;
 *   T3 the short view — its render is the reference's section, token for token, as its script paints it, in all sixteen states (each of
 *      the four plans, each toggle open and closed), its hidden parts left out: a closed part is absent, not hidden; and each open part is
 *      the whole view's own markup, but for the id its toggle names;
 *   T4 the whole view — its render is main's, byte for byte, in the four states with either door; the functions main drew it through are
 *      main's still (the short view draws through all of them but the foot link, the whole view's alone now), and /financial-software and /pricing are main's code;
 *   T5 the words — every word drawn in the sixteen states a leaf's, in order; the toggles' words exactly as ruling f gives them;
 *   T6 the state — two booleans in the short view's holder, both closed at first; each toggle opens and closes its own part, either with
 *      the other; nothing stored, nothing in the URL;
 *   T7 the rulings — each quoted, exact, where it is built, under the brief's stamps; the sentences ruling h re-said, dated; the cited lines
 *      where they stood; the older briefs' censuses unedited; and a census of this brief's quotes, held per file.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript), the README and DESIGN.md. No clock, no live call. What a browser must show — the
 * section beside the reference at 1440, 1024, 768 and 390 in each state, its height before and after, everything outside it equal to main,
 * /financial-software and /pricing equal to main, the requests, the keyboard, sign-up, no sideways scroll — cannot be held here; it is in
 * the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { COMPARE_PLANS_TOGGLE_WORDS, COMPARE_PLANS_WORDS, YOUR_PLAN, planMapView, seeAllToolsWords, type MapPlan } from '../howTo';
import { PLAN_PILLAR } from '../homeActWords';
import { PLANS_HEADLINE, PLANS_SUBHEAD } from '../offer/plans';
import { PROBLEM_SHEET } from '../problemSheet';
import HowToSection, { HowToShortHolder, HowToShortView, HowToView, type HowToShortViewProps, type HowToViewProps, type JoinDoor } from '@/components/landing/HowToSection';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-plans-05';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const PLANS04_REFERENCE = 'design-refs/home-plans-04/Section-Reference.html';
const TRIM02_REFERENCE = 'design-refs/home-trim-02/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const SECTION = 'src/components/landing/HowToSection.tsx';
const LEAF = 'src/lib/howTo.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const FS_PAGE = 'src/app/financial-software/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/homePlans05.test.ts';
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

/** A stylesheet (its comments removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>". (homeTrim02.test.ts's reading.) */
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
/** The third stylesheet's one rule that is that page's own, not the design ("THIS PAGE'S OWN: not part of the design, not ported."). */
const OWN_RULE = '.fs-map__grid[hidden]';
/** The house prefix on every class a selector names, and on every custom property a value reads. */
const prefixed = (line: string): string => line.replace(/\.fs(?=$|[^A-Za-z0-9])/g, '.ts-fs').replace(/var\(--/g, 'var(--ts-');
const PORT_OPEN = '.ts-fs-heading {';
const SHORT_OPEN = '.ts-fs--short .ts-fs__inner {';
const TOGGLES_OPEN = '.ts-fs-toggles {';
const NEXT_PORT = '.ts-ft {';
/** The README's five tokens (its "Tokens" table), each the value it gives, behind the house prefix. */
const TOKENS: ReadonlyArray<readonly [name: string, value: string]> = [
  ['--ts-fs-button-line', '#CFC6EC'], ['--ts-fs-white', '255 255 255'], ['--ts-hero-violet-3', '#32118A'], ['--ts-hero-violet-2', '#4D1FBC'], ['--ts-fs-rule', '#EEEAF5'],
];

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
/** The element that opens at `at` — a "<div" — through its matching "</div>". */
function divAt(html: string, at: number): string {
  assert.ok(html.startsWith('<div', at), `a div opens at ${at}`);
  let depth = 0;
  for (const m of html.slice(at).matchAll(/<div\b|<\/div>/g)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(at, at + (m.index as number) + m[0].length);
  }
  throw new assert.AssertionError({ message: `the div at ${at} closes` });
}
/** The one element that opens with these exact characters, whole. */
function divOpening(html: string, opening: string): string {
  assert.equal(count(html, opening), 1, `"${opening}" opens once`);
  return divAt(html, html.indexOf(opening));
}
/** The reference's section at rest: from <section to its </section>, before the script that only makes the file work alone. */
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
  assert.equal(count(body, '<section'), 1, 'one section in the reference');
  return body.slice(body.indexOf('<section'), body.indexOf('</section>') + '</section>'.length);
}
const referenceScript = (): string => referenceText().slice(referenceText().indexOf('<script>'), referenceText().indexOf('</script>'));

/** The sixteen states: each of the four plans the choices pick, each toggle open and closed. */
type Run = { business: boolean; trade: boolean };
type Open = { tools: boolean; plans: boolean };
const PLAN_STATES: ReadonlyArray<readonly [name: string, run: Run, picked: string]> = [
  ['at rest', { business: false, trade: false }, 'personal'],
  ['+ Business', { business: true, trade: false }, 'business'],
  ['+ Trading', { business: false, trade: true }, 'trading'],
  ['both', { business: true, trade: true }, 'everything'],
];
const OPEN_STATES: ReadonlyArray<readonly [name: string, open: Open]> = [
  ['both closed', { tools: false, plans: false }],
  ['tools open', { tools: true, plans: false }],
  ['plans open', { tools: false, plans: true }],
  ['both open', { tools: true, plans: true }],
];
const STATES: ReadonlyArray<readonly [name: string, run: Run, picked: string, open: Open]> =
  PLAN_STATES.flatMap(([plan, run, picked]) => OPEN_STATES.map(([state, open]) => [`${plan}, ${state}`, run, picked, open] as const));
const noop = (): void => {};
const LINK_DOOR = { kind: 'link', href: '/' } as const;
const shortProps = (run: Run, open: Open, onJoin: JoinDoor = noop): HowToShortViewProps =>
  ({ ...run, toolsOpen: open.tools, plansOpen: open.plans, onBusiness: noop, onTrade: noop, onTools: noop, onPlans: noop, onJoin });
const shortRender = (run: Run, open: Open, onJoin: JoinDoor = noop): string => renderToStaticMarkup(React.createElement(HowToShortView, shortProps(run, open, onJoin)));
const wholeRender = (run: Run, onJoin: JoinDoor = noop): string => renderToStaticMarkup(React.createElement(HowToView, { ...run, onBusiness: noop, onTrade: noop, onJoin }));

/**
 * The reference's section painted for a state as its own script paints it — each switch's aria-pressed and its mark; each toggle's
 * aria-expanded; while the first is open, the grid shown and each tool lit or not, with its mark; while the second is closed, the one plan
 * the choices pick, and while it is open, the four plans in its place, the picked one tagged — with every part it hides taken out, as
 * production draws a closed part not at all (README: "Production draws a closed part not at all.").
 */
function painted(run: Run, picked: string, open: Open): string {
  let html = referenceSection();
  const exact = (re: RegExp): string => { const m = re.exec(html); assert.ok(m, `the reference at rest draws ${re}`); return m[0]; };
  const TICK_HIDDEN = exact(/<svg class="fs-tick"[^>]*aria-hidden="true"><path[^>]*><\/path><\/svg>/);
  const TICK_IN = exact(/<svg class="fs-tick"[^>]*role="img" aria-label="In this plan"><path[^>]*><\/path><\/svg>/);
  const RING_OUT = '<span class="fs-ring" role="img" aria-label="Not in this plan"></span>';
  const TAG = '<span class="fs-plan__tag">Your plan</span>';
  const on: Record<string, boolean> = { personal: true, business: run.business, trading: run.trade };
  // the switches
  html = html.replace(/<button class="fs-switch" type="button" data-module="(\w+)" aria-pressed="false"><span class="fs-ring" aria-hidden="true"><\/span>/g,
    (all: string, m: string) => (on[m] ? `<button class="fs-switch" type="button" data-module="${m}" aria-pressed="true">${TICK_HIDDEN}` : all));
  // the toggles
  for (const [part, isOpen] of [['fs-all-tools', open.tools], ['fs-all-plans', open.plans]] as const) {
    assert.equal(count(html, `aria-expanded="false" aria-controls="${part}"`), 1, `the reference draws the toggle for ${part}, closed`);
    html = html.replace(`aria-expanded="false" aria-controls="${part}"`, `aria-expanded="${isOpen}" aria-controls="${part}"`);
  }
  // the map's grid: absent while closed; shown while open, each tool lit while the picked plan holds its module
  const grid = divOpening(html, '<div class="fs-map__grid" id="fs-all-tools" hidden>');
  const lit = grid.replace('<div class="fs-map__grid" id="fs-all-tools" hidden>', '<div class="fs-map__grid" id="fs-all-tools">')
    .replace(/<li class="fs-tool" data-module="(\w+)" data-lit="(?:true|false)">([^<]+)(?:<svg[\s\S]*?<\/svg>|<span class="fs-ring"[^>]*><\/span>)<\/li>/g,
      (_: string, m: string, name: string) => `<li class="fs-tool" data-module="${m}" data-lit="${on[m]}">${name}${on[m] ? TICK_IN : RING_OUT}</li>`);
  html = html.replace(grid, open.tools ? lit : '');
  // the one plan: the picked one alone while the plans are closed; absent while they are open
  const yours = divOpening(html, '<div class="fs-yours">');
  const plans = [...yours.matchAll(/<div class="fs-plan fs-plan--(?:row|all)" data-plan="(\w+)"/g)].map((m) => ({ id: m[1], html: divAt(yours, m.index as number) }));
  assert.deepEqual(plans.map((p) => p.id), ['personal', 'business', 'trading', 'everything'], 'the reference keeps the four plans in the holder, in PLANS\' order');
  let one = yours;
  for (const p of plans) one = one.replace(p.html, p.id === picked ? p.html.replace(' hidden>', '>') : '');
  html = html.replace(yours, open.plans ? '' : one);
  // the four plans: absent while closed; while open, the picked one ringed and tagged
  const all = divOpening(html, '<div id="fs-all-plans" hidden>');
  assert.equal(count(all, TAG), 1, 'one tag among the four plans at rest');
  const four = all.replace('<div id="fs-all-plans" hidden>', '<div id="fs-all-plans">').replace(TAG, '')
    .replace(/<div class="fs-plan( fs-plan--all)?" data-plan="(\w+)" data-picked="(?:true|false)">([\s\S]*?<div class="fs-plan__top"><p class="fs-plan__role">[^<]*<\/p>)<\/div>/g,
      (_: string, band: string | undefined, id: string, head: string) => `<div class="fs-plan${band ?? ''}" data-plan="${id}" data-picked="${id === picked}">${head}${id === picked ? TAG : ''}</div>`);
  html = html.replace(all, open.plans ? four : '');
  return html;
}
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}
/** A top-level function's text in a source: from "function NAME(" to its closing brace at depth 0, the parameter list skipped by its parentheses. */
function fnText(source: string, name: string): string {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at > -1, `function ${name}`);
  let i = source.indexOf('(', at);
  for (let depth = 0; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') { depth -= 1; if (depth === 0) break; }
  }
  for (let j = source.indexOf('{', i), depth = 0; j < source.length; j += 1) {
    if (source[j] === '{') depth += 1;
    else if (source[j] === '}') { depth -= 1; if (depth === 0) return source.slice(at, j + 1); }
  }
  throw new assert.AssertionError({ message: `function ${name} closes` });
}

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

const RULING = {
  a: 'TWO TOGGLES STAND WHERE THE LINKS STOOD. Each is a button of type button, with aria-expanded, and aria-controls naming its part, fs-all-tools or fs-all-plans, which is drawn only while open. Each carries its chevron, inline and aria-hidden, as the section\'s tick is. Both start closed, and either can be open with the other. Neither is a link.',
  b: 'EACH PART IS THE WHOLE VIEW\'S OWN, WRITTEN ONCE. While open, the first draws the map\'s grid inside the panel, under its head, lit by the choices; the second draws the three cards and the band in place of the one plan, the picked one ringed, tagged and gold. A closed part is absent from the markup. HowToView draws both parts through the same components, and its render stays main\'s byte for byte.',
  c: 'OPEN OR CLOSED IS REACT STATE, one boolean per toggle, false at first: nothing stored, nothing in the URL, so a reload starts closed. Its shape is the audit\'s to name: the smallest that keeps both views pure and HowToView\'s props as they are, by the pins it moves.',
  d: 'A TOGGLE LOOKS AS THE REFERENCE DRAWS IT: the choices\' height and type in the quiet button\'s look, a soft fill and the violet line while open, the chevron turned. It reads five tokens that are in :root already (the README\'s table); none is added.',
  e: 'THE TOGGLES\' RULES JOIN THE SECTION\'S PORT after the short view\'s, and homePlans04 T3 names them as its eighth difference. The two .ts-fs-links rules go with their last wearer, and the seventh difference says so. Every other rule of the port stays as it is.',
  f: 'A TOGGLE\'S WORDS ARE ITS LINK\'S WORDS WITHOUT THE ARROW. seeAllToolsWords loses its arrow where it stands, its total still the cards\' own. One new constant in src/lib/howTo.ts, beside COMPARE_PLANS_WORDS, holds the words "Compare all four plans"; COMPARE_PLANS_WORDS keeps its arrow for the whole view\'s foot link. No string is sliced from another, and FINANCIAL_SOFTWARE_PATH leaves HowToSection.tsx with its last use there.',
  g: 'EARLIER BRIEFS\' QUOTES STAY WHERE THEY STAND. The quote censuses of homeTrim01, homeTrim02 and homePages01 stand unedited, as do HOME-TRIM-03\'s and HOME-ABOUT-02\'s when they land. Write around their quotes, never through them, and quote those briefs nowhere they are not quoted today.',
  h: 'SENTENCES THE TOGGLES MAKE FALSE ARE RE-SAID IN PLACE, dated: every sentence that says the short view draws two links, or that this section opens /financial-software or /pricing from the home page. Files whose lines a test or a law cites keep every line where it is: Landing.tsx stays 815 lines long.',
  i: 'ITS OWN STAMPS DATE EVERY QUOTE OF THIS BRIEF: 2026-11-16 00:04 and 00:19 Manila. Quote its rulings exactly as written here: their sentences were chosen so that no other brief\'s census reads one as its own.',
  j: 'ONLY THE SHORT VIEW\'S PANEL HEAD AND WHAT IT OPENS CHANGE: not the whole view, /financial-software, /pricing, the choices, the plan\'s button, the section\'s hooks, or any other section.',
} as const;
/** His words under the brief's first stamp (2026-11-16 00:04 Manila), as the brief gives them, and his approval of the boards (00:19). */
const REQUEST = 'I am wondering if we can make them toggles, to open up a drop down , on the home page, rather than routing to a new page?';
const SECOND_NOTE = 'also the buttons look rather mediocore, and dont really follow the look of the rest of the page...';
const APPROVAL = 'AMAZING YES!! EXACTLY!!!! Those TOGGLES ARE PERFECT!!';

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-plans-05-handoff.zip, 2026-11-16): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 9040, '970bec2b04323eb66409237473b634ffaf4475121cf714a7d428d31851f70a73'],
  [REFERENCE, 52153, 'f77a55264e84890bba6eb55c441361de79bff7b011fcf4df6fcf0cade73f9c30'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size, the folder holding the two; the reference\'s first stylesheet is home-plans-04\'s and its second home-trim-02\'s second, byte for byte, and its font link home-plans-04\'s', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes, as the brief gives it`);
    assert.equal(sha256(whole(file)), sha, `${file}: byte for byte (sha256), as the brief gives it`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html'], 'the folder holds the two files and nothing else');
  const [first, second, third, ...more] = stylesOf(referenceText());
  assert.equal(more.length, 0, 'the reference has three stylesheets');
  const plans04 = stylesOf(whole(PLANS04_REFERENCE));
  const trim02 = stylesOf(whole(TRIM02_REFERENCE));
  assert.deepEqual([plans04.length, trim02.length], [1, 2], 'home-plans-04\'s has one, home-trim-02\'s two');
  assert.equal(first, plans04[0], 'the first stylesheet is design-refs/home-plans-04\'s, byte for byte — on main already, as the .ts-fs… port');
  assert.equal(second, trim02[1], 'the second is design-refs/home-trim-02\'s second, byte for byte — on main already, as the port\'s section 7');
  assert.ok(third.includes('HOME-PLANS-05 · NEW WITH THIS CHANGE: the panel\'s two links become toggles. The only rules to port.'), 'the third is what this change adds');
  const fontLink = (html: string): string => { const m = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/.exec(html); assert.ok(m, 'a font link'); return m[0]; };
  assert.equal(fontLink(referenceText()), fontLink(whole(PLANS04_REFERENCE)), 'and its font link is home-plans-04\'s');
});

// ── T2 · THE PORT'S NEW BLOCK ────────────────────────────────────────────────

/** The port's declarations at main (0ade717, and 284e976 alike) before the short view's block: their count and the sha256 of their lines, joined (homeTrim02.test.ts's). */
const PORT_AT_MAIN = { declarations: 327, sha: 'b2d89df20aecf557bdf1ab8fdd9594a963a775fa8744fdb59d4e71bc42a708ec' };

test('T2 the port\'s new block is the reference\'s third stylesheet, declaration by declaration and in order, behind the house prefix, but for its page\'s own rule; it reads the README\'s five tokens and declares none; it ends the port, after the short view\'s block, which lost the links\' two rules; every rule before them is main\'s', () => {
  const third = stylesOf(referenceText())[2];
  const all = declarations(uncommented(third));
  assert.deepEqual(all.filter((d) => d.split(' | ')[1] === OWN_RULE), [' | .fs-map__grid[hidden] | display: none'], 'its page\'s own rule — one declaration — is not ported');
  const expected = all.filter((d) => d.split(' | ')[1] !== OWN_RULE).map(prefixed);
  assert.equal(expected.length, 34, 'thirty-four declarations');
  assert.equal(new Set(expected.map((d) => d.split(' | ').slice(0, 2).join(' | '))).size, 9, 'in nine rules');
  const css = code(GLOBALS);
  const block = declarations(css.slice(css.indexOf(TOGGLES_OPEN), css.indexOf(NEXT_PORT)));
  assert.deepEqual(block, expected, 'the block is the third stylesheet, declaration by declaration, in its order, renamed');
  // ruling d: five tokens that are in :root already, each the README's value; none is added
  const read = [...new Set(block.flatMap((d) => [...d.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])))].sort();
  assert.deepEqual(read, TOKENS.map(([name]) => name).sort(), 'it reads the README\'s five tokens, and no other');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const [name, value] of TOKENS) assert.equal(count(flat(root), `${name}: ${value};`), 1, `${name} is in :root already, ${value}`);
  const blockText = css.slice(css.indexOf(TOGGLES_OPEN), css.indexOf(NEXT_PORT));
  assert.doesNotMatch(blockText, /--[\w-]+\s*:|#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|!important|gradient/, 'it declares no token, types no colour and draws no gradient');
  assert.ok(block.some((d) => d.endsWith('| font-family: inherit')) && !/var\(--font-/.test(blockText), 'the toggles\' family is the section\'s: no face is read');
  for (const line of block) for (const cls of line.split(' | ')[1].match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-fs-toggle') || cls === '.ts-fs-chevron', `${line}: ${cls} is the toggles'`);
  // its seat: after the short view's block, as the port's last rules, above the footer's
  const port = declarations(css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT)));
  const short = declarations(css.slice(css.indexOf(SHORT_OPEN), css.indexOf(TOGGLES_OPEN)));
  assert.ok(css.indexOf(PORT_OPEN) < css.indexOf(SHORT_OPEN) && css.indexOf(SHORT_OPEN) < css.indexOf(TOGGLES_OPEN) && css.indexOf(TOGGLES_OPEN) < css.indexOf(NEXT_PORT), 'inside the port, after the short view\'s block, above the footer\'s');
  assert.deepEqual(port.slice(-block.length), block, 'the toggles\' rules are the port\'s last');
  assert.deepEqual(port.slice(-(block.length + short.length), -block.length), short, 'the short view\'s block directly before them');
  assert.equal(short.length, 20, 'the short view\'s block: twenty declarations — the links\' two rules, five declarations, gone with their last wearer (ruling e)');
  assert.doesNotMatch(css, /\.ts-fs-links\b/, '.ts-fs-links is ruled nowhere');
  // HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling e, its last
  // sentence: "Every other rule of the port stays as it is."
  const before = port.slice(0, -(block.length + short.length));
  assert.equal(before.length, PORT_AT_MAIN.declarations, 'the port before the short view\'s block: main\'s count');
  assert.equal(sha256(before.join('\n')), PORT_AT_MAIN.sha, 'and main\'s declarations, every one');
  // no rule anywhere reaches a part by the id its toggle names
  assert.doesNotMatch(css, /#fs-all-(tools|plans)\b/, 'no rule names #fs-all-tools or #fs-all-plans');
});

// ── T3 · THE SHORT VIEW'S MARKUP, IN SIXTEEN STATES ─────────────────────────

test('T3 the short view\'s render is the reference\'s section, token for token, as its script paints it, in all sixteen states — each of the four plans, each toggle open and closed — its hidden parts left out; a closed part is absent, not hidden, and each open part is the whole view\'s own markup but for the id its toggle names', () => {
  // the script's rules, as it writes them: the picked plan; what lights a tool; the toggles and what they show
  const script = referenceScript();
  for (const rule of [
    'const run = { business: false, trading: false, tools: false, plans: false };',
    "const picked = run.business && run.trading ? 'everything' : run.business ? 'business' : run.trading ? 'trading' : 'personal';",
    'const inPlan = { personal: () => true, business: () => run.business, trading: () => run.trading };',
    "tool.querySelector('.fs-tick, .fs-ring').outerHTML = lit ? tick('In this plan') : ring('Not in this plan');",
    "if (on && !tag) top.insertAdjacentHTML('beforeend', '<span class=\"fs-plan__tag\">Your plan</span>');",
    "tools.setAttribute('aria-expanded', String(run.tools));",
    "plans.setAttribute('aria-expanded', String(run.plans));",
    "document.getElementById('fs-all-tools').hidden = !run.tools;",
    "document.getElementById('fs-all-plans').hidden = !run.plans;",
    "section.querySelector('.fs-yours').hidden = run.plans;",
  ]) assert.ok(script.includes(rule), `the script: ${rule}`);
  const renders = new Set<string>();
  for (const [name, run, picked, open] of STATES) {
    const html = shortRender(run, open);
    renders.add(html);
    assert.deepEqual(tokensOf(html, false), tokensOf(painted(run, picked, open), true), `${name}: the reference's section as its script paints it, token for token`);
    assert.ok(html.startsWith('<section id="modules" class="ts-fs ts-fs--short" aria-label="Software plans" data-how-to="true">'), `${name}: the section's hooks as they were (ruling j)`);
    assert.doesNotMatch(html, /\shidden(?=[\s>=])/, `${name}: nothing hidden — a closed part is not there`);
    assert.equal(count(html, 'id="fs-all-tools"'), Number(open.tools), `${name}: the map's grid ${open.tools ? 'drawn, once' : 'absent'}`);
    assert.equal(count(html, 'id="fs-all-plans"'), Number(open.plans), `${name}: the four plans ${open.plans ? 'drawn, once' : 'absent'}`);
    assert.equal(count(html, 'class="ts-fs-yours"'), Number(!open.plans), `${name}: the one plan ${open.plans ? 'absent, the four in its place' : 'drawn'}`);
    assert.equal(count(html, 'class="ts-fs-tool"'), open.tools ? 25 : 0, `${name}: the sheet's 25 tools only while the grid is open`);
    assert.equal(count(html, 'data-plan='), open.plans ? 4 : 1, `${name}: ${open.plans ? 'four plans' : 'one plan'}`);
    assert.equal(count(html, `data-plan="${picked}" data-picked="true"`), 1, `${name}: the picked one, ringed`);
    assert.equal(count(html, 'data-picked="true"'), 1, `${name}: and no other`);
    assert.equal(count(html, YOUR_PLAN), 1, `${name}: the tag, once`);
    assert.equal(count(html, '<a '), 0, `${name}: no link — the toggles are buttons, and Landing's door a button`);
    assert.equal(count(html, '→'), 0, `${name}: no arrow drawn`);
  }
  assert.equal(renders.size, 16, 'sixteen different renders');
  // each open part is the whole view's own: the same markup, but for the id its toggle names
  for (const [name, run] of PLAN_STATES) {
    const full = wholeRender(run);
    const gridOf = (html: string, opening: string): string => divOpening(html, opening);
    assert.equal(gridOf(shortRender(run, { tools: true, plans: false }), '<div class="ts-fs-map__grid" id="fs-all-tools">').replace(' id="fs-all-tools"', ''), gridOf(full, '<div class="ts-fs-map__grid">'), `${name}: the open grid is the whole view's grid`);
    const four = divOpening(shortRender(run, { tools: false, plans: true }), '<div id="fs-all-plans">');
    const cards = divOpening(full, '<div class="ts-fs-plans">');
    const band = divOpening(full, '<div class="ts-fs-plan ts-fs-plan--all"');
    assert.equal(four, `<div id="fs-all-plans">${cards}${band}</div>`, `${name}: the open plans are the whole view's three cards and band`);
  }
  // the default export, handed "short", draws the short view at rest through its holder: both toggles closed
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'short', onRequireAuth: noop })), shortRender(PLAN_STATES[0][1], OPEN_STATES[0][1]), 'the default export, handed "short": the short view at rest, both toggles closed');
  // every class the short view wears is the port's
  const port = declarations(code(GLOBALS).slice(code(GLOBALS).indexOf(PORT_OPEN), code(GLOBALS).indexOf(NEXT_PORT)));
  const ruled = new Set(port.flatMap((l) => l.split(' | ')[1].match(/\.ts-[A-Za-z][\w-]*/g) ?? []));
  for (const [, run, , open] of STATES) for (const m of shortRender(run, open).matchAll(/class="([^"]*)"/g)) for (const cls of m[1].split(/\s+/)) assert.ok(ruled.has(`.${cls}`), `.${cls} is named by a rule of the port`);
});

// ── T4 · THE WHOLE VIEW, AND WHAT RULING J KEEPS ────────────────────────────

/** The whole view's render at main, sha256 — each state, a function door and a link door (homeTrim02.test.ts holds the same). */
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
/** At main (284e976): the sha256 of each function main's whole view drew through, as code() reads it — the choices, the plan's parts and its button, the band, the foot link. The short view draws through all of them but the foot link, the whole view's alone now; ToolGrid and AllPlans, new, are held by the eight renders above and by T3. */
const FUNCTIONS_AT_MAIN: Readonly<Record<string, string>> = {
  Tick: 'cb5afb00db58ab68f146dd4981effced608e52772e3429bc0b3fa49e4d592453',
  Check: '44eb3cfb2ce856d9fb659b7c828a24340a23728deb1577badb4c1be972c3afb1',
  NameWords: 'b3753495f2205012bd06b708aab95b325f71a3065460ff77ca260c585fdff4a5',
  PlanHead: '7cb78c7849cb8b0b8ff7d38a72155b066f8aa1490c4622e24f67f04604a996b4',
  PlanBody: '75febee68dc6d8ce0b5e2d45951ddae5fa2d644c99328dde5d8090fe5ebdf3dc',
  SectionName: 'c7046ea881e289be9f6a10ab82b4f0d4d4851d0b769b7bf9dec9510bfe1e8701',
  Choices: 'e21d06f979f0781f75c84df4bc1c83ea4f0dfea04ef7f59d68aafcd2387ead49',
  Band: '12768c017e920ea695fb66aad32078331620bb83c037ff9c287bb40502a3ba39',
  CompareLink: 'bec7e998ab73e0836614952d7ff25cf28b2420ca592932329f77230902f7ca13',
};
/** At main (284e976): the code of the two pages the section's parts stand on whole, whitespace collapsed, sha256 — their notes may be re-said (ruling h); their code stands. */
const PAGES_AT_MAIN: ReadonlyArray<readonly [file: string, sha: string]> = [
  [FS_PAGE, '38dca7377dbc64c0f5bebfaaf0c0fc4312d20c6e5ab391c4dac9fce4c1308a28'],
  ['src/app/pricing/page.tsx', '7bcb9d2cac70f9aa34d18da9d9b77c0777b3e754b2ffc2132429b29217e80626'],
];

test('T4 the whole view\'s render is main\'s, byte for byte, in the four states with either door, through the same components the short view opens; the functions main drew it through are main\'s still; /financial-software and /pricing are main\'s code', () => {
  for (const [name, run] of PLAN_STATES) {
    assert.equal(sha256(wholeRender(run)), WHOLE_AT_MAIN[`${name} function`], `${name}, a function door: main's render, byte for byte`);
    assert.equal(sha256(wholeRender(run, LINK_DOOR)), WHOLE_AT_MAIN[`${name} link`], `${name}, a link door: main's render, byte for byte`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: noop })), wholeRender(PLAN_STATES[0][1]), 'the default export, handed "whole": the whole view at rest');
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: LINK_DOOR })), wholeRender(PLAN_STATES[0][1], LINK_DOOR), 'handed "whole" and a link, as /financial-software hands them');
  // ruling b, in its last sentence: the whole view draws both parts through the same components — the grid and the four plans, by name, in its own body
  const section = code(SECTION);
  const wholeView = fnText(section, 'HowToView');
  const shortView = fnText(section, 'HowToShortView');
  for (const part of ['<ToolGrid view={view} />', '<AllPlans view={view} onJoin={onJoin} />']) assert.equal(count(wholeView, part), 1, `the whole view draws ${part}`);
  assert.equal(count(shortView, '{toolsOpen ? <ToolGrid view={view} id="fs-all-tools" /> : null}'), 1, 'the short view draws the same grid while its first toggle is open');
  assert.equal(count(shortView, '<AllPlans view={view} onJoin={onJoin} />'), 1, 'and the same plans while its second is');
  assert.equal(count(section, 'className="ts-fs-map__grid"'), 1, 'the grid is written once');
  assert.equal(count(section, 'className="ts-fs-plans"'), 1, 'and so are the three cards');
  // ruling j: the choices, the plan's parts and its button, the band and the foot link are main's functions, character for character
  for (const [name, sha] of Object.entries(FUNCTIONS_AT_MAIN)) assert.equal(sha256(fnText(section, name)), sha, `${name}: main's, as code() reads it`);
  assert.match(section, /^export type JoinDoor = \(\(\) => void\) \| \{ readonly kind: 'link'; readonly href: string \};$/m, 'the door\'s two arms as they were');
  for (const [file, sha] of PAGES_AT_MAIN) assert.equal(sha256(flat(code(file))), sha, `${file}: main's code`);
  assert.equal(count(code(LANDING), '<HowToSection view="short" onRequireAuth={onRequireAuth} />'), 1, 'Landing.tsx mounts the short view as it did');
});

// ── T5 · THE WORDS ───────────────────────────────────────────────────────────

test('T5 every word drawn in the sixteen states is a leaf\'s, in order, and the reference draws the same; the toggles\' words are their links\' words without the arrow, the second a new constant beside COMPARE_PLANS_WORDS, which keeps its arrow; nothing is sliced, and the section types none', () => {
  // HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling f, its first
  // sentence: "A TOGGLE'S WORDS ARE ITS LINK'S WORDS WITHOUT THE ARROW." — exactly
  assert.equal(seeAllToolsWords(25), 'See all 25 tools', 'the first toggle\'s words: the first link\'s, its arrow gone');
  assert.equal(COMPARE_PLANS_TOGGLE_WORDS, 'Compare all four plans', 'the second\'s: the compare link\'s, its arrow gone');
  assert.equal(COMPARE_PLANS_WORDS, 'Compare all four plans →', 'COMPARE_PLANS_WORDS keeps its arrow, for the whole view\'s foot link');
  assert.ok(wholeRender(PLAN_STATES[0][1]).includes(`>${COMPARE_PLANS_WORDS}</a></div></section>`), 'and the whole view\'s foot link still says it');
  // its total still the cards' own, and it follows the sheet
  const total = PROBLEM_SHEET.flatMap((f) => f.tools).length;
  assert.equal(planMapView({ business: false, trade: false }).seeAll, seeAllToolsWords(total), 'planMapView hands the words over the sheet\'s count');
  assert.ok(planMapView({ business: false, trade: false }).cards.every((c) => c.count.endsWith(`of ${total} tools`)), 'the total the cards count against');
  const shorter = PROBLEM_SHEET.map((f) => ({ header: f.header, tools: f.tools.filter((t) => t !== 'Mileage') }));
  assert.equal(planMapView({ business: false, trade: false }, { sheet: shorter }).seeAll, 'See all 24 tools', 'never typed');
  // no string sliced from another; the new constant on COMPARE_PLANS_WORDS's own line, so no line of the leaf moves
  const leaf = code(LEAF);
  const lines = leaf.split('\n');
  assert.ok(lines[120].startsWith("export const COMPARE_PLANS_WORDS = 'Compare all four plans →';") && lines[120].trimEnd().endsWith("export const COMPARE_PLANS_TOGGLE_WORDS = 'Compare all four plans';"), 'howTo.ts:121 — the new constant beside COMPARE_PLANS_WORDS, on its line, typed whole');
  assert.equal(lines[711], 'export function allToolsWords(total: number): string {', 'howTo.ts:712 is allToolsWords still, as HOME-TRIM-02\'s ruling e cites it');
  assert.equal(lines.length, 936, 'howTo.ts is the 935 lines it was (and its closing line break): no line moves');
  assert.ok(leaf.includes('  return `See all ${total} tools`;\n}'), 'seeAllToolsWords, in place, without the arrow');
  assert.doesNotMatch(leaf, /COMPARE_PLANS_WORDS\s*\.\s*(slice|replace|substring|substr|split|trim)|seeAll\s*\.\s*(slice|replace)|\.slice\(0, -[12]\)/, 'no string is sliced from another');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('Compare all four plans')), [LEAF], 'the words stand in one file\'s code under src but the tests');
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('See all')), [LEAF], 'and so do the first toggle\'s');
  // the section types none of them, and reads the pages' leaf no more
  const section = code(SECTION);
  assert.ok(!section.includes('See all') && !section.includes('Compare all') && !section.includes('→'), 'the section types neither toggle\'s words, nor an arrow');
  assert.ok(!section.includes('FINANCIAL_SOFTWARE_PATH') && !section.includes('homePages'), 'FINANCIAL_SOFTWARE_PATH left the section with its last use there');
  assert.equal(count(section, '<Toggle words={COMPARE_PLANS_TOGGLE_WORDS} open={plansOpen} controls="fs-all-plans" onPress={onPlans} />'), 1, 'the second toggle reads the new constant');
  assert.equal(count(section, '<Toggle words={view.seeAll} open={toolsOpen} controls="fs-all-tools" onPress={onTools} />'), 1, 'the first, the view\'s words');
  // every word of each of the sixteen states, in order: the leaves' own — and the reference's
  for (const [name, run, picked, open] of STATES) {
    const v = planMapView(run);
    const planWords = (plan: MapPlan): string[] => [plan.role, ...(plan.picked ? [YOUR_PLAN] : []), ...plan.parts.map((p) => p.words), plan.audience, plan.explainer, ...plan.benefits, plan.count, plan.price, plan.cta];
    const one = [...v.cards, v.band].find((p) => p.picked);
    assert.ok(one, `${name}: a picked plan`);
    const words = [
      PLAN_PILLAR.heading, PLANS_SUBHEAD, PLANS_HEADLINE, v.base.words, ...v.switches.map((s) => s.words), v.seeAll, COMPARE_PLANS_TOGGLE_WORDS,
      ...(open.tools ? v.families.flatMap((f) => [f.name, ...f.tools.map((t) => t.name)]) : []),
      ...(open.plans ? [...v.cards, v.band].flatMap(planWords) : planWords(one)),
    ];
    assert.deepEqual(textsOf(shortRender(run, open)).map((t) => t.trim()).filter((t) => t !== ''), words, `${name}: every word a leaf's, in order`);
    assert.deepEqual(textsOf(painted(run, picked, open)).map((t) => t.trim()).filter((t) => t !== ''), words, `${name}: and the reference draws the same words`);
  }
});

// ── T6 · THE STATE ───────────────────────────────────────────────────────────

test('T6 open or closed is React state: two booleans in the short view\'s holder, both closed at first; each toggle opens and closes its own part, either with the other; nothing stored, nothing in the URL; each toggle a button, never a link', () => {
  // the holder, driven inside a host's render: each press re-draws the host, as a click would
  const acts: Array<(props: HowToShortViewProps) => void> = [(p) => p.onTools(), (p) => p.onPlans(), (p) => p.onTools(), (p) => p.onPlans()];
  const passes: string[] = [];
  const handed: HowToViewProps = { business: true, trade: false, onBusiness: noop, onTrade: noop, onJoin: noop };
  const Host = (): null => {
    const el = HowToShortHolder(handed) as React.ReactElement<HowToShortViewProps>;
    assert.equal(el.type, HowToShortView, 'the holder draws the pure short view');
    assert.ok(el.props.business === true && el.props.trade === false && el.props.onBusiness === noop && el.props.onJoin === noop, 'with all the default export hands it — what you run and the door, untouched');
    passes.push(`${el.props.toolsOpen ? 'T' : '-'}${el.props.plansOpen ? 'P' : '-'}`);
    if (passes.length <= acts.length) acts[passes.length - 1](el.props);
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  assert.deepEqual(passes, ['--', 'T-', 'TP', '-P', '--'], 'closed at first → the grid open → both open → the plans alone → closed again: each toggle turns its own part, either with the other');
  // the default export: handed "short", it draws the holder, with the same two booleans and the same door; "whole" never mounts it. Its own two
  // booleans are hooks, so it is called inside a host's render.
  const door = (): void => {};
  const drawnBy = (view: 'short' | 'whole'): React.ReactElement<HowToViewProps> => {
    let el: React.ReactElement<HowToViewProps> | null = null;
    const Caller = (): null => { el = HowToSection({ view, onRequireAuth: door }) as React.ReactElement<HowToViewProps>; return null; };
    assert.equal(renderToStaticMarkup(React.createElement(Caller)), '');
    assert.ok(el, `the default export, handed "${view}", drew an element`);
    return el;
  };
  const shortEl = drawnBy('short');
  const wholeEl = drawnBy('whole');
  assert.equal(shortEl.type, HowToShortHolder, 'the short view\'s name finds its holder');
  assert.equal(wholeEl.type, HowToView, 'the whole view\'s finds HowToView, which holds no toggle');
  assert.deepEqual(Object.keys(shortEl.props).sort(), ['business', 'onBusiness', 'onJoin', 'onTrade', 'trade'], 'the holder is handed HowToView\'s props, as they are');
  assert.deepEqual(Object.keys(wholeEl.props).sort(), Object.keys(shortEl.props).sort(), 'and so is the whole view');
  // the source: two booleans here, closed at first, beside what you run; no storage, no URL, no effect
  const section = code(SECTION);
  const holder = fnText(section, 'HowToShortHolder');
  assert.equal(holder, [
    'function HowToShortHolder(props: HowToViewProps) {',
    '  const [toolsOpen, setToolsOpen] = useState(false);',
    '  const [plansOpen, setPlansOpen] = useState(false);',
    '  return <HowToShortView {...props} toolsOpen={toolsOpen} plansOpen={plansOpen} onTools={() => setToolsOpen((open) => !open)} onPlans={() => setPlansOpen((open) => !open)} />;',
    '}',
  ].join('\n'), 'the holder, whole: one boolean per toggle, false at first, each press turning its own');
  assert.match(section, /^const VIEWS = \{ __proto__: null, short: HowToShortHolder, whole: HowToView \} as const;$/m, 'the short view\'s name finds the holder; no prototype lends a name');
  assert.equal(count(section, 'useState('), 4, 'what you run, and the toggles: no other state');
  assert.doesNotMatch(section, /\buse(Effect|LayoutEffect|Reducer|Ref|Router|SearchParams|Pathname|Context|SyncExternalStore)\b|\b(globalThis|window|document|navigator|history|location|localStorage|sessionStorage|indexedDB|cookieStore|caches)\b|\bfetch\s*\(|searchParams/, 'nothing stored, nothing read from or written to the URL — a reload starts closed');
  // each toggle: a button of type button, aria-expanded saying its part is open, aria-controls naming that part, its chevron inline and hidden
  for (const [name, run, , open] of STATES) {
    const calls: string[] = [];
    const drawn = drawnElementsOf(HowToShortView({ ...shortProps(run, open), onTools: () => calls.push('tools'), onPlans: () => calls.push('plans') }));
    const toggles = drawn.filter((el) => el.type === 'button' && el.props.className === 'ts-fs-toggle');
    assert.deepEqual(toggles.map((t) => [t.props.type, t.props['aria-expanded'], t.props['aria-controls'], 'href' in t.props]), [['button', open.tools, 'fs-all-tools', false], ['button', open.plans, 'fs-all-plans', false]], `${name}: two buttons, each saying whether its part is open, naming it`);
    for (const t of toggles) (t.props.onClick as () => void)();
    assert.deepEqual(calls, ['tools', 'plans'], `${name}: each toggle presses its own`);
    const html = shortRender(run, open);
    for (const [part, isOpen] of [['fs-all-tools', open.tools], ['fs-all-plans', open.plans]] as const) assert.equal(count(html, `id="${part}"`), Number(isOpen), `${name}: ${part} drawn only while open`);
    assert.equal(count(html, '<svg class="ts-fs-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"></path></svg></button>'), 2, `${name}: each toggle carries its chevron, inline and hidden from a screen reader, last`);
    // the head stands as it is when a part opens: in its markup only the toggles' aria-expanded tells two states apart. That focus then stays on the
    // pressed toggle is the browser's to show, and the browser check shows it; here, the toggle and its two uses are held whole (below the loop), so
    // no key can be added that would make React draw a new button in its place.
    const head = (h: string): string => divOpening(h, '<div class="ts-fs-map__head">').replace(/aria-expanded="(true|false)"/g, 'aria-expanded');
    assert.equal(head(html), head(shortRender(run, OPEN_STATES[0][1])), `${name}: the panel's head is the head at rest but for aria-expanded`);
  }
  assert.equal(fnText(section, 'Toggle'), [
    'function Toggle({ words, open, controls, onPress }: { words: string; open: boolean; controls: string; onPress: () => void }) {',
    '  return <button className="ts-fs-toggle" type="button" aria-expanded={open} aria-controls={controls} onClick={() => onPress()}>{words}<Chevron /></button>;',
    '}',
  ].join('\n'), 'the toggle, whole: a button of type button, no key, its state in aria-expanded alone');
  assert.equal(count(section, '<Toggle '), 2, 'the toggle, used twice');
  assert.equal(count(section, '<Toggle words={view.seeAll} open={toolsOpen} controls="fs-all-tools" onPress={onTools} />'), 1, 'the first, as it is written: no key');
  assert.equal(count(section, '<Toggle words={COMPARE_PLANS_TOGGLE_WORDS} open={plansOpen} controls="fs-all-plans" onPress={onPlans} />'), 1, 'the second, as it is written: no key');
  // the keyboard's order: at rest, the two choices, the two toggles, then the plan's button; with both parts open, the four plans' buttons stand in the
  // one's place, and the grid adds no stop
  const stops = (open: Open): string[] => drawnElementsOf(HowToShortView(shortProps(PLAN_STATES[0][1], open))).filter((el) => el.type === 'button' || el.type === 'a').map((el) => String(el.props.className));
  assert.deepEqual(stops(OPEN_STATES[0][1]), ['ts-fs-switch', 'ts-fs-switch', 'ts-fs-toggle', 'ts-fs-toggle', 'ts-fs-plan__cta'], 'at rest: the choices, the toggles, then the plan\'s button');
  assert.deepEqual(stops(OPEN_STATES[3][1]), ['ts-fs-switch', 'ts-fs-switch', 'ts-fs-toggle', 'ts-fs-toggle', 'ts-fs-plan__cta', 'ts-fs-plan__cta', 'ts-fs-plan__cta', 'ts-fs-plan__cta'], 'both open: the choices, the toggles, then the four plans\' buttons in the one plan\'s place — the grid adds no stop');
});

// ── T7 · THE RULINGS ─────────────────────────────────────────────────────────

/**
 * At main: each older brief's census, whole — its texts to the statement that holds its counts — sha256 of the file's rejoined text. The first four
 * as main had them at 284e976, where this change was built; HOME-ABOUT-02's as it landed, at ac0fc25 (2026-11-16), before this change's push, which
 * was rebased onto it.
 */
const CENSUS_AT_MAIN: ReadonlyArray<readonly [test: string, sha: string]> = [
  ['homeTrim01', '5c41388afaa39dc467379aadef752ea96465a70ed412fbfabdd1f93fcfe01768'],
  ['homeTrim02', 'b0c3469473d7f91f20011a8bc13c454aeec1dc2a0abddabb91867cb4db6302f9'],
  ['homeTrim03', '296a3be92155fbbfcda09d81568f3e5a435da86c0354dca3a269991be1083b33'],
  ['homePages01', '9f8c546caab1977076b69f4e9416e19706e00c20e19003bef3f86a2d2595e337'],
  ['homeAbout02', '0692c4c2fec24c1357a58ae2df50f06bc09903fdd03233a9e8f87ccd0e1a86bd'],
];

test('T7 each ruling is quoted, exact, where it is built, under the brief\'s stamps; the sentences ruling h re-said stand, dated, and main\'s are gone; the cited lines where they stood; the older briefs\' censuses unedited; in every source file of the change a quote that follows a sentence of the brief for twenty characters is its words from there, whole or to a full stop, and each file\'s count of them is held', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [SECTION, [RULING.a, RULING.b, RULING.c, RULING.h]],
    [GLOBALS, [RULING.d, RULING.e]],
    [LEAF, [RULING.f]],
    [LANDING, [RULING.h]],
    [FS_PAGE, [RULING.j]],
    [tests('homePlans04'), [RULING.e]],
    [THIS, [RULING.g, RULING.i]],
  ];
  // the stamp each carries where the brief is built: the brief by name, its day and hour, and the day it was built
  const STAMP = /HOME-PLANS-05 (?:\(|— )Alex's brief, 2026-11-16 00:04 Manila[^()]*built 2026-11-16\)/;
  for (const [file, rulings] of BUILT) {
    const said = prose(file);
    assert.match(said, STAMP, `${file} names the brief, dates it (2026-11-16 00:04 Manila) and dates the build (2026-11-16)`);
    for (const ruling of rulings) {
      assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
      const at = said.indexOf(`"${flat(ruling)}"`);
      const under = said.slice(said.lastIndexOf('HOME-PLANS-05', at), at);
      assert.ok(under.includes("Alex's brief, 2026-11-16 00:04 Manila") && under.includes('built 2026-11-16'), `${file}: "${ruling.slice(0, 30)}…" stands under the brief's stamp — "${under.slice(0, 90)}…"`);
    }
  }
  // HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling g — built here,
  // by the five hashes above and by the five censuses themselves, which run unedited: "EARLIER BRIEFS' QUOTES STAY WHERE THEY STAND. The quote censuses
  // of homeTrim01, homeTrim02 and homePages01 stand unedited, as do HOME-TRIM-03's and HOME-ABOUT-02's when they land. Write around their quotes, never
  // through them, and quote those briefs nowhere they are not quoted today." HOME-ABOUT-02's census was not on main at 284e976; it landed at ac0fc25,
  // before this change was pushed, and joins the list from there.
  const censusOf = (file: string): string => {
    const w = whole(file);
    const at = w.indexOf('const HIS_WORDS');
    const counts = w.indexOf('assert.deepEqual(census, {', at);
    const end = w.indexOf(');\n', counts);
    assert.ok(at > -1 && counts > at && end > counts, `${file}: its census, whole`);
    return w.slice(at, end + 2);
  };
  for (const [name, sha] of CENSUS_AT_MAIN) assert.equal(sha256(censusOf(tests(name))), sha, `${name}'s census stands as main has it, character for character`);
  // ruling h: the files whose lines a test or a law cites keep every line where it is — each its length, each cited line on its line
  const HELD: ReadonlyArray<readonly [file: string, lines: number]> = [[LANDING, 815], [LAW, 11254], [FS_PAGE, 48], ['src/middleware.ts', 312], [LEAF, 935]];
  for (const [file, lines] of HELD) assert.equal(whole(file).split('\n').length, lines + 1, `${file} is the ${lines} lines it was (and its closing line break)`);
  const at = (file: string, n: number): string => code(file).split('\n')[n - 1];
  assert.equal(at(LANDING, 595), '      <HowToSection view="short" onRequireAuth={onRequireAuth} />', 'Landing.tsx:595, the mount, where it stood');
  assert.equal(at(tests('homePlans04'), 425).trim(), "assert.doesNotMatch(outside, /\\.ts-fs\\b|\\.ts-fs[-_]/, 'no rule outside the port names one of its classes');", 'homePlans04:425, where it stood');
  assert.ok(at(LAW, 9448).includes(".includes('<section id=\"modules\"')"), 'the law\'s line 9448, where it stood');
  // every sentence ruling h re-said: its new words stand, dated (a phrase only the new sentence carries), and where main's sentence differs from them
  // it is gone. DESIGN.md is prose, read whole; the rest are read in their comments.
  const RESAID: ReadonlyArray<readonly [file: string, now: RegExp, gone: RegExp | null]> = [
    [SECTION, /the three choices and two toggles \(HOME-PLANS-05, 2026-11-16, below: "two links" until then\)/, /three choices and two links, then the one plan/],
    [SECTION, /two toggles, then the one plan the choices pick — or, while the second toggle is open, the four plans in its place \("two links, then the one plan" until HOME-PLANS-05, 2026-11-16\)/, null],
    [SECTION, /the link to \/pricing is the whole view's alone since \(both views drew it until then, the short view in its panel\)/, null],
    [SECTION, /from HOME-TRIM-02 \(ruling e, below\) until HOME-PLANS-05 \(2026-11-16\), in the short view's panel too/, /at the whole view's foot, and in the short view's panel \(ruling e, below\)/],
    [SECTION, /the first link's words were planMapView's seeAll \(seeAllToolsWords over the cards' own total\)\. Since HOME-PLANS-05 \(2026-11-16\) neither link is drawn here/, /— the first link's words are planMapView's seeAll/],
    [SECTION, /HOME-PLANS-05, 2026-11-16: the short view's two toggles are two more booleans since, each closed at first/, null],
    [SECTION, /HOME-PLANS-05, 2026-11-16: the short view's two toggles are React state too; while the second is open, the four plans stand in that one plan's place/, null],
    [LEAF, /— and, since HOME-PLANS-05 \(2026-11-16\), that view's two toggles open the map's grid and the three cards with the band there too, each while it is open\./, null],
    [LEAF, /— until HOME-PLANS-05 \(2026-11-16\), whose toggles open them on the home page again, each while it is open; this stays, undrawn/, /\("the home page draws the map and its own cards now" until then\); this stays, undrawn/],
    [LEAF, /draws from the same view: the picked plan and seeAll — and, since HOME-PLANS-05 \(2026-11-16; design-refs\/home-plans-05\/\), the families, and the three cards with the band, each while its toggle is open/, /draws from the same view: the picked plan alone, and seeAll\./],
    [LEAF, /question, its three choices and two toggles \(two links until HOME-PLANS-05, 2026-11-16, below\), then the one plan planMapView picks/, /question, its three choices and two links, then the one plan planMapView picks/],
    [LEAF, /One word is new, the short view's first link's — its first toggle's since HOME-PLANS-05, without the arrow:/, null],
    [LEAF, /the short view's first link, to the section's own page, until HOME-PLANS-05 made it a toggle \(below\); the arrow was part of the string then/, /the arrow is part of the string, as COMPARE_PLANS_WORDS has its own/],
    [LEAF, /The short view's first toggle's words, "See all <total> tools" \(HOME-PLANS-05, 2026-11-16, ruling f; its first link's, with the arrow, from HOME-TRIM-02's ruling e until then\)/, /The short view's first link's words, "See all <total> tools →" \(HOME-TRIM-02, ruling e\): seeAllToolsWords/],
    [GLOBALS, /but for the EIGHT DIFFERENCES named here \(HOME-PLANS-05, 2026-11-16: the SEVEN DIFFERENCES named here until then\)/, /but for the SEVEN DIFFERENCES named here —/],
    [GLOBALS, /ten rules, twenty declarations \(section 7, below\)\. .* Nor, since HOME-PLANS-05 \(2026-11-16\), are the two rules of the links' row/, /as this port's last rules and in its own order: twelve rules, twenty-five declarations \(section 7, below\)/],
    [GLOBALS, /8\. ADDED, the short view's toggles \(HOME-PLANS-05, 2026-11-16\): the third stylesheet of design-refs\/home-plans-05\/Section-Reference\.html .* nine rules, thirty-four declarations \(section 8, below\)/, null],
    [GLOBALS, /but for its two rules of the links' row, \.fs-links and \.fs-links \.fs__compare, which left with the links \(HOME-PLANS-05, 2026-11-16: the seventh difference above says so/, null],
    [GLOBALS, /\(and above the toggles' rules, which follow them since HOME-PLANS-05, 2026-11-16\)/, null],
    [GLOBALS, /the links kept \.ts-fs__compare's face \(var\(--font-mono\)\) while they stood, and no face was added for U\+2192; since HOME-PLANS-05 \(2026-11-16\) the short view draws no arrow at all/, /the links keep \.ts-fs__compare's face/],
    [LANDING, /all four on \/financial-software — and here too, since HOME-PLANS-05, 2026-11-16, while that view's second toggle is open\)/, null],
    [LANDING, /three choices and two toggles \(HOME-PLANS-05, 2026-11-16: "two links \(to \/financial-software and to \/pricing\)" until then\)/, /three choices and two links \(to \/financial-software and to \/pricing\), then/],
    [LANDING, /and the link at the foot is \/financial-software's alone, which mounts the whole view \("the map, the three cards, the band at rest and the link at the foot are \/financial-software's" until then\)/, /; the map, the three cards, the band at rest and the link at the foot are \/financial-software's, which mounts/],
    [LANDING, /no steps are drawn here now, and the map's grid only while the first toggle is open \(HOME-PLANS-05, 2026-11-16: "no steps and no map are drawn here now" until then\)/, /The notes above are history: no steps and no map are drawn here now\./],
    [FS_PAGE, /from HOME-TRIM-02 until HOME-PLANS-05 \(2026-11-16\), the home page's short view, "See all 25 tools →", a toggle since, which opens the map's grid in place/, /and — since HOME-TRIM-02 — the home page's short view, "See all 25 tools →"\./],
    [LAW, /and on the landing too since HOME-PLANS-05, 2026-11-16, while its second toggle is open; and its first toggle, "See all <total> tools" \(its link, with the arrow, until then\)/, /; and its link "See all <total> tools →" counts the sheet/],
    [LAW, /and its grid on the guest landing again since HOME-PLANS-05, 2026-11-16, while the short view's first toggle is open;/, null],
    ['scripts/proofs/map.seeds.ts', /its grid on the guest landing again since HOME-PLANS-05 \(2026-11-16\) while the short view's first toggle is open/, null],
    ['src/lib/problemSheet.ts', /and the landing renders that map's grid again, since HOME-PLANS-05 \(2026-11-16\), while its first toggle is open/, null],
    [tests('homePlans04'), /the eighth that view's toggles, HOME-PLANS-05, 2026-11-16 — "the seven" until then/, null],
    [tests('homePlans04'), /HOME-PLANS-05 \(2026-11-16\), its ruling e: the two rules of \.ts-fs-links went with their last wearer/, /twelve rules and twenty-five declarations, in its order/],
    [tests('howTo01'), /from HOME-TRIM-02 \(2026-11-15\) until HOME-PLANS-05 \(2026-11-16\), the pages' leaf, for the short view's first link/, null],
    [tests('howTo01'), /the one the choices pick, and all four while the short view's second toggle is open \(HOME-PLANS-05, 2026-11-16\)/, null],
    [tests('howTo01'), /and there alone since, until HOME-PLANS-05, 2026-11-16, whose second toggle opens them on the home page again/, null],
    [tests('howTo01'), /alone since — and the landing again since HOME-PLANS-05 \(2026-11-16\), while its first toggle is open —/, null],
    [tests('homePages01'), /and read the leaf for that view's first link until HOME-PLANS-05 \(2026-11-16\) made that link a toggle, which opens no page/, /and reads the leaf for that view's first link\. HOME-TRIM-03/],
    [tests('homePages01'), /from HOME-TRIM-02 \(2026-11-15, ruling e\) until HOME-PLANS-05 \(2026-11-16\) — the Financial Software section, whose short view's first link opened/, null],
    [tests('homeTrim02'), /the three choices and two links \(two toggles since HOME-PLANS-05, 2026-11-16, which open the map's grid and the four plans in place\)/, null],
    [tests('homeTrim02'), /two choices, two toggles and the plan's button — the two links, plain anchors to FINANCIAL_SOFTWARE_PATH and to \/pricing with its hook, until HOME-PLANS-05 \(2026-11-16\), which made them the toggles/, /the two links are plain anchors, the first to FINANCIAL_SOFTWARE_PATH/],
    [GLOBALS, /what the panel's two links become, rule for rule and value for value/, /the panel's two links: beside the question's choices/],
    // and those re-said after the review of 2026-11-16, each the open part's own: the plans in the one plan's place, the foot link the whole view's alone
    [SECTION, /so exactly one plan is in the holder's markup \(HOME-PLANS-05, 2026-11-16: while the second toggle is open the holder is not drawn and the four plans stand in its place — "exactly one plan is in the markup" until then\)/, /so exactly one plan is in the markup;/],
    [SECTION, /\(AllPlans, which draws them in both views since HOME-PLANS-05, 2026-11-16 — in the whole view alone until then\)/, /\(AllPlans, in both views since HOME-PLANS-05\);/],
    [GLOBALS, /the short view hides no plan — its holder draws the picked plan alone, and while the second toggle is open the four plans stand in the holder's place \(HOME-PLANS-05, 2026-11-16: "the short view draws the picked plan alone" until then\)/, /is not ported: the short view draws the picked plan alone\./],
    [LEAF, /then the one plan planMapView picks — or, while the second toggle is open, the three cards and the band in its place, as the first opens the map's grid in the panel \(HOME-PLANS-05, 2026-11-16: "then the one plan planMapView picks" alone until then\)/, /then the one plan planMapView picks; the whole view/],
    [tests('howTo01'), /the link \(CompareLink; the whole view's alone since HOME-PLANS-05, 2026-11-16 — both views drew it until then, the short view in its panel\)/, /the link \(CompareLink\) — so the order is read/],
    [tests('howTo01'), /the home page its one plan's price line, and, while its second toggle is open, all four plans' \(HOME-PLANS-05, 2026-11-16\)/, /the home page its one plan's price line; both with/],
    [tests('homePlans04'), /two booleans in React state \(and, since HOME-PLANS-05, 2026-11-16, the short view's two toggles, in its holder\), both off at first/, /T8 the state — two booleans in React state, both off at first/],
    [tests('homePlans04'), /HowToView, or the short view beside it \(since HOME-PLANS-05, 2026-11-16, the short view's holder, which keeps its two toggles and draws it, pure\)/, /HowToView, or the short view beside it — one element/],
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its sentence re-said, dated`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
  }
  const design = flat(whole('DESIGN.md'));
  assert.match(design, /until HOME-PLANS-05 \(2026-11-16\), whose two toggles open the map's grid and the three cards with the band there again, each while it is open \(`design-refs\/home-plans-05\/`, whose stylesheet reads five tokens the app holds/, 'DESIGN.md: the section\'s sentence re-said, dated');
  // and the tests' titles it re-said — strings, so read in the code: the new words stand, and main's are gone
  const TITLES: ReadonlyArray<readonly [file: string, now: string, gone: string | null]> = [
    [tests('homePlans04'), 'the eighth its toggles — HOME-PLANS-05, 2026-11-16: "but for the seven named differences" until then', null],
    [tests('howTo01'), 'for the short view\\\'s first link, until HOME-PLANS-05 (2026-11-16) made it a toggle', null],
    [tests('homePages01'), 'as the Financial Software section did from HOME-TRIM-02 (2026-11-15) until HOME-PLANS-05 (2026-11-16), whose toggles open no page', 'the band and (HOME-TRIM-02, 2026-11-15) the Financial Software section read it'],
    [tests('homeTrim02'), 'two choices, two toggles and the plan\\\'s button', 'two choices and the plan\\\'s button, which opens the door handed in; the two links are plain anchors that carry no state'],
    [tests('homePlans04'), 'two booleans and the half its view names — the pure whole view, or, since HOME-PLANS-05 (2026-11-16), the short view\\\'s holder, which keeps its two toggles', 'two booleans and the pure half its view names — nothing else runs in it'],
  ];
  for (const [file, now, gone] of TITLES) {
    assert.ok(code(file).includes(now), `${file}: a title re-said — "${now.slice(0, 60)}"`);
    if (gone) assert.ok(!code(file).includes(gone), `${file}: and main's title is gone`);
  }
  // EVERY SOURCE FILE OF THE CHANGE — this one, the four whose code changed, the five whose notes alone did (DESIGN.md, prose no guard reads, aside),
  // and the three re-pointed tests. The handoff's two files are the owner's own and are held byte for byte (T1).
  const CHANGED = [
    THIS,
    SECTION, LEAF, GLOBALS, tests('homePlans04'),
    LANDING, FS_PAGE, LAW, 'scripts/proofs/map.seeds.ts', 'src/lib/problemSheet.ts',
    ...['howTo01', 'homePages01', 'homeTrim02'].map(tests),
  ];
  assert.equal(new Set(CHANGED).size, 13);
  // any quote under one of the brief's two stamps is the words that stamp dates — his words of 00:04, his approval of 00:19 — exact
  for (const file of CHANGED) {
    const said = prose(file);
    for (const m of said.matchAll(/00:04 Manila: "([^"]+)"/g)) assert.equal(m[1], REQUEST, `${file}: under the 00:04 stamp, his words, exact`);
    for (const m of said.matchAll(/00:19 Manila: "([^"]+)"/g)) assert.equal(m[1], APPROVAL, `${file}: under the 00:19 stamp, his approval of the boards, exact`);
  }
  // HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling i — built here:
  // "ITS OWN STAMPS DATE EVERY QUOTE OF THIS BRIEF: 2026-11-16 00:04 and 00:19 Manila. Quote its rulings exactly as written here: their sentences were
  // chosen so that no other brief's census reads one as its own." HIS WORDS ARE THE THIRTEEN BELOW: the ten rulings, his two notes of 00:04 and his
  // approval of 00:19. A straight double mark followed by twenty or more characters of one of their sentences, from the sentence's start, opens a quote
  // of him: what stands from there to the closing mark is his words from that sentence on — to the end of the piece, or to a full stop — or this
  // fails and says where the two part. A whole sentence of his shorter than that is read too, and counted. Each file's count is held. (homeTrim02's
  // census, on this brief's words.) NOT HELD: a quote that leaves his words before its twentieth character, one that opens in the middle of a
  // sentence, one in other marks, one in a code string.
  const HIS_WORDS = [...Object.values(RULING), REQUEST, SECOND_NOTE, APPROVAL];
  assert.equal(HIS_WORDS.length, 13);
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
  for (const file of CHANGED) {
    const said = prose(file);
    for (let q = said.indexOf('"'); q > -1; q = said.indexOf('"', q + 1)) {
      const rest = said.slice(q + 1);
      let his = false;
      let parted = '';
      for (const text of HIS_WORDS) {
        for (const from of sentencesOf(text)) {
          let n = 0;
          while (from + n < text.length && rest[n] === text[from + n]) n += 1;
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') his = true;
          else if (n >= 20) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece goes on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) {
        census[file] = (census[file] ?? 0) + 1;
        // ruling i: its own stamps date every quote of it — from the last "HOME-PLANS-05" before the quote, the brief's day and hour, and for his
        // approval its own hour
        const under = said.slice(said.lastIndexOf('HOME-PLANS-05', q), q);
        assert.ok(under.startsWith('HOME-PLANS-05') && under.includes("Alex's brief, 2026-11-16 00:04 Manila"), `${file}: the quote at "${rest.slice(0, 30)}…" stands under the brief's stamp`);
        if (rest.startsWith(APPROVAL)) assert.ok(under.includes('00:19 Manila: '), `${file}: his approval stands under its own stamp, 00:19`);
      }
    }
  }
  assert.deepEqual(census, {
    [THIS]: 7, // the header: his two notes of 00:04 and his approval of 00:19; a sentence each of rulings e (T2) and f (T5); rulings g and i, at their checks in T7
    [SECTION]: 7, // the header: his two notes and his approval, ruling h; ruling b at the parts, a at the toggle, c at the holder
    [LEAF]: 1, // ruling f, at seeAllToolsWords
    [GLOBALS]: 2, // rulings d and e, over the toggles' rules
    [tests('homePlans04')]: 1, // ruling e, at the eighth difference
    [LANDING]: 1, // ruling h, at the mount
    [FS_PAGE]: 1, // ruling j, at the page's door
  }, 'each file\'s quotes of the brief, counted — twenty in seven of the thirteen: a quote that stood and no longer opens on its words leaves its file\'s count, and fails here');
});
