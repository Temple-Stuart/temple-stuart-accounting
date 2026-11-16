/**
 * HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16) —
 * THE TOP BAR'S MENU: FOUR NAMES OPEN ONE PANEL OF THE SITE'S DESTINATIONS; ON A PHONE, FOUR ROWS THAT EACH OPEN A LIST.
 *
 * Alex approved the menu's two boards on the design canvas with the home page's, on 2026-11-14 at 20:01 Manila, and the corrected set at
 * 20:41. On 2026-11-16 at 00:52 Manila he chose each item's destination from the table that is the README's "Where each item goes",
 * answering "Yes, use these (Recommended)". The spec is a file: design-refs/home-menu-01/Menu-Reference.html, with its README beside it.
 * The bar is src/components/landing/LandingHeader.tsx — its four names (the three pillars and About Us) open one panel from 1024px, and
 * under 1024px the phone menu's first four rows open their lists; its words and destinations are one list, BAR_MENU; its stylesheet is
 * the reference's second, at the foot of src/app/globals.css. What is held here:
 *
 *   T1 the handoff — the README and the reference, byte for byte (sha256) and by size, the folder holds the two; the reference's first
 *      stylesheet is design-refs/hero-crest-01's, byte for byte, and so is everything on its page but the two bars;
 *   T2 the block — the port's new block IS the reference's second stylesheet, declaration by declaration and in order, behind the house
 *      prefix, its mono the site's; it reads five tokens, each in :root already, and adds none; nothing follows it;
 *   T3 the render — the bar's view, with its state, is the reference's two bars as the reference's own script paints them, token for
 *      token: closed, with the panel open, with the phone menu open, and with each list open in turn — but for the house prefix, the
 *      fixed ids and the mark's path;
 *   T4 the words — every word and destination in BAR_MENU, each read from its home where the home is light, or held equal to it where
 *      it is copied; the one new word typed once;
 *   T5 the graph — every module the bar reaches, as TypeScript's own parser reads its imports, listed, so that no heavy home can join it unseen;
 *   T6 the state — the panel and the lists closed at first; which press opens and which closes each, and what it leaves as it was; the
 *      default export's wiring of its three states into the view; Escape and the press outside, the one effect run for real against a
 *      stand-in document, its listeners added and taken away as they were; nothing stored;
 *   T7 the rulings — each quoted, exact, where it is built, under the brief's stamp; the notes it made false re-said, dated, and every
 *      comment line it wrote held as written; no cited line moved, and the guest law's re-said line as its seeds proved it; the approvals
 *      quoted nowhere new; a census of the brief's quotes in every source file of the change, each file's count held.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject (the digests, the two
 * references). No clock, no live call. What a browser must show — the bar beside the reference at 1440, 1280, 1024, 768 and 390, on the
 * landing and on /about; every link reaching its destination; no new request; the keyboard; no sideways scroll; the open menu inside the
 * hero — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { closureOf } from './importReader';
import { ABOUT_US_HEADING, BUILD_PILLAR, EXPLORE_PILLAR, OUR_STORY_HEADING, PLAN_PILLAR } from '../homeActWords';
import { DEMO_ANCHOR, EVENTS_ANCHOR, MY_TRIP_ANCHOR } from '../homeAnchors';
import { ABOUT_PATH, FINANCIAL_SOFTWARE_PATH } from '../homePages';
import { SERVICES, SERVICE_KINDS, proposalFormHref } from '../proposalNeeds';
import { PLANS } from '../offer/plans';
import { COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS } from '../howTo';
import { CODE_URL, FOOTER_RECORD_LINKS } from '../footerWords';
import { PIPELINE_PATH } from '@/components/landing/pipelineWords';
import LandingHeader, { BAR_MEGA_ID, BAR_MENU, BAR_MENU_ID, BAR_PRICING, LandingHeaderView, type BarMenuKey } from '@/components/landing/LandingHeader';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-menu-01';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Menu-Reference.html`;
const HERO_REFERENCE = 'design-refs/hero-crest-01/Hero-Reference.html';
const THIS = 'src/lib/__tests__/homeMenu01.test.ts';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const GLOBALS = 'src/app/globals.css';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS = 'scripts/proofs/guest01.seeds.ts';
const ANCHORS = 'src/lib/homeAnchors.ts';
const FOOTER_WORDS = 'src/lib/footerWords.ts';
const PIPELINE_WORDS = 'src/components/landing/pipelineWords.ts';
const SERVICES_SECTION = 'src/components/landing/ServicesSection.tsx';
const HOW_TO = 'src/components/landing/HowToSection.tsx';
const FS_PAGE = 'src/app/financial-software/page.tsx';
const LEAF = 'src/lib/howTo.ts';
const SERVICES_LEAF = 'src/lib/proposalNeeds.ts';
const PAGES_LEAF = 'src/lib/homePages.ts';
const ABOUT_PAGE = 'src/app/about/page.tsx';
const STEPS_PAGE = 'src/app/how-it-works/page.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const tests = (name: string): string => `src/lib/__tests__/${name}.test.ts`;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** A file's comments as prose: each line's comment leader gone, whitespace collapsed — a sentence that wraps is one sentence. */
const prose = (file: string): string => flat(comments(file).split('\n').map((line) => line.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/|\{\/\*)?\s?/, '')).join(' '));
/** Every .ts / .tsx file under src that is not a test. */
const srcFiles = (dir = 'src'): string[] => readdirSync(resolve(ROOT, dir)).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(resolve(ROOT, rel)).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.tsx?$/.test(name) ? [rel] : [];
});

// ── the stylesheets, read as lists of declarations ───────────────────────────

/** A stylesheet (comments removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>". Two levels. */
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
/** A page's stylesheets, as written: what stands between each <style> and its </style>. */
const stylesOf = (html: string): string[] => html.split('<style>').slice(1).map((part) => part.slice(0, part.indexOf('</style>')));
/** The house prefix on every class the second stylesheet names: .bar__trigger → .ts-bar__trigger, .mega__panel → .ts-mega__panel, .menu → .ts-menu. */
const prefixed = (selector: string): string => selector.replace(/\.(bar|mega|menu|brand)(?=$|[^A-Za-z0-9-]|__|--)/g, '.ts-$1');
/** The block: globals.css from its first rule, at the start of a line (the same selector opens a rule again inside its media blocks), to the end of the file. */
const BLOCK_OPEN = '\n.ts-bar__trigger {';
const blockCss = (): string => { const css = code(GLOBALS); return css.slice(css.indexOf(BLOCK_OPEN) + 1); };

// ── the reference's two bars, as its script paints them ─────────────────────

type Paint = { panel?: boolean; menu?: boolean; list?: BarMenuKey | null };
const BARS = 'M3 8h16M3 14h16';
const CROSS = 'M5.5 5.5l11 11M16.5 5.5l-11 11';
/** The reference's two bars, as written: the glass one over the hero, then the filled one on the plain page. */
const referenceBars = (): string[] => [...whole(REFERENCE).matchAll(/<header class="bar bar--(?:overlay|solid)">[\s\S]*?<\/header>/g)].map((m) => m[0]);
/** What the reference's script does to a bar's markup (Menu-Reference.html:567-617), done to its text: the panel, the menu, a list. */
function painted(bar: string, { panel = false, menu = false, list = null }: Paint): string {
  let h = bar;
  if (panel) {
    h = h.replace(/(<button class="bar__trigger" type="button" aria-expanded=)"false"/g, '$1"true"');
    h = h.replace(/(<div class="mega" id="mega-[a-z]+") hidden>/, '$1>');
  }
  if (menu) {
    h = h.replace(/(<nav class="menu" id="menu-[a-z]+" aria-label="Menu") hidden>/, '$1>');
    h = h.replace('<button class="bar__menu-button" type="button" aria-label="Open menu" aria-expanded="false"', '<button class="bar__menu-button" type="button" aria-label="Close menu" aria-expanded="true"');
    h = h.replace(`<path d="${BARS}"></path>`, `<path d="${CROSS}"></path>`);
  }
  if (list) {
    h = h.replace(new RegExp(`(<button class="menu__row menu__row--group" type="button" aria-expanded=)"false"( aria-controls="menu-[a-z]+-${list}">)`), '$1"true"$2');
    h = h.replace(new RegExp(`(<div class="menu__sub" id="menu-[a-z]+-${list}") hidden>`), '$1>');
  }
  return h;
}
/** A page's markup as tokens: each tag with its attributes as a sorted set, each run of text with its whitespace collapsed. The reference's
 * side keeps its own classes, ids and paths; the app's side is read back through the three differences — the house prefix (ts-), the
 * fixed ids (ts-bar-mega for mega-hero / mega-plain; ts-bar-menu for menu-hero / menu-plain), and the mark's path. */
function tokensOf(html: string, reference: boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)\/?>|([^<]+)/g)) {
    if (m[4] !== undefined) { const t = flat(m[4].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')); if (t) out.push(`#text ${t}`); continue; }
    const [all, close, tag, rest] = m;
    if (close) { out.push(`</${tag}>`); continue; }
    const attrs = [...rest.matchAll(/([a-zA-Z_:][\w:.-]*)(?:="([^"]*)")?/g)].map(([, k, v]) => {
      let val = v ?? '';
      if (k === 'class') val = val.split(/\s+/).filter(Boolean).map((c) => { if (reference) return c; assert.ok(c.startsWith('ts-'), `the app's class "${c}" wears the house prefix`); return c.slice(3); }).join(' ');
      if (k === 'id' || k === 'aria-controls') val = reference ? val.replace(/^mega-(hero|plain)$/, 'MEGA').replace(/^menu-(hero|plain)/, 'MENU') : val.replace(new RegExp(`^${BAR_MEGA_ID}$`), 'MEGA').replace(new RegExp(`^${BAR_MENU_ID}`), 'MENU');
      if (k === 'src' && tag === 'img') val = reference ? val.replace('../../public/brand/', '/brand/') : val;
      return `${k}=${val}`;
    }).sort();
    out.push(`<${tag} ${attrs.join(' ')}>`);
    if (all.endsWith('/>') && tag !== 'img') out.push(`</${tag}>`);
  }
  return out;
}
type ViewState = { menuOpen: boolean; panelFrom: BarMenuKey | null; openList: BarMenuKey | null };
const CLOSED: ViewState = { menuOpen: false, panelFrom: null, openList: null };
const noop = (): void => {};
const view = (glass: boolean, login: boolean, s: Partial<ViewState>): string =>
  renderToStaticMarkup(React.createElement(LandingHeaderView, { glass, onRequireLogin: login ? noop : undefined, ...CLOSED, ...s, setMenuOpen: noop, setPanelFrom: noop, setOpenList: noop }));

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

/** The thirteen rulings, exactly as the brief words them (ruling l). */
const RULING = {
  a: 'FOUR NAMES OPEN ONE PANEL. From 1024px the three pillar names and About Us, which stands first in the account group, are buttons of type button. Each carries the reference\'s caret, aria-expanded, and aria-controls naming the panel, ts-bar-mega. Any of the four opens it; a second press of the same name closes it, and a press of another leaves it open. All four say the panel\'s state. It closes on a press of any link in it, on Escape, and on a press outside it and the four names. Escape sends focus back to the name that opened it when focus was inside. Under 1024px the panel is never drawn.',
  b: 'ON A PHONE THE NAMES ARE ROWS THAT OPEN LISTS. Under 1024px the menu, BAR_MENU_ID as today, opens on the same four names as rows, before the rule, Pricing and Log in. Each row is a button with its caret, aria-expanded, and aria-controls naming its list: ts-bar-menu-fs, -ps, -tm and -about. A row opens its list and closes the one open, and an open row closes its own; all start closed. One list at a time keeps the open menu inside the hero, which clips what overflows it. The menu still closes on a link, on Log in, on Escape and on its button, and Escape sends focus back to the button when focus was inside. While it is open the button draws the board\'s cross, and its two bars while closed.',
  c: 'THE MENU\'S STATE LIVES IN REACT ALONE: the phone menu\'s, as today; the panel\'s, which name opened it or none; the lists\', which one is open or none. It is kept in no storage and in no URL. The panel and the four lists are always in the markup, hidden while closed, as the menu is today. For the tests, the stateful bar draws a pure view of itself with its state, so each open state renders on the server; the audit names that view\'s shape, the smallest by the pins it moves.',
  d: 'THE FOUR COLUMNS ARE ONE EXPORTED LIST, BAR_MENU, where BAR_PRODUCT_LINKS stands, in the reference\'s order. Each column holds its key, its name, its links and its foot link or none. A link holds its words and its destination, and also a plan\'s audience, a service\'s kind, or the code\'s new tab. The panel draws the list as four columns and the phone menu as four lists. A destination on the site is a next/link Link, as the bar\'s are now; the code\'s is a plain anchor with target _blank and rel noopener noreferrer, as the footer\'s is. BAR_PRODUCT_LINKS goes with its last reader. BAR_PRICING stays in LandingHeader.tsx and the About Us column draws it; if its line moves, the law\'s GUEST_ROUTES row re-cites it, newest first, as FOOTER-02 re-cited it.',
  e: 'A WORD WHOSE HOME IS LIGHT IS READ THERE: the four names and Our Story from src/lib/homeActWords.ts; EVENTS_ANCHOR, DEMO_ANCHOR and MY_TRIP_ANCHOR from src/lib/homeAnchors.ts; FINANCIAL_SOFTWARE_PATH and ABOUT_PATH from src/lib/homePages.ts; PIPELINE_PATH from src/components/landing/pipelineWords.ts; the six services, their kinds and proposalFormHref from src/lib/proposalNeeds.ts.',
  f: 'A WORD WHOSE HOME IS HEAVY IS COPIED ONCE, AND HELD. The bar is a client component on every page that mounts it. src/lib/offer/plans.ts, src/lib/howTo.ts and src/lib/footerWords.ts pull in the tool registry, the offer and the trip rows: read from them, the menu\'s words would add about 126 KB minified, 35 KB gzipped, to each of those pages, where the light homes weigh about 6 KB in all (esbuild 0.25.12, measured 2026-11-16). travelStripModes.tsx pulls in the five search forms, and the booking-flow freeze pins it. So the four plans\' names and audiences, the compare link\'s words and path, the record\'s two labels with CODE_URL, and the six travel labels are typed once more, in LandingHeader.tsx. homeMenu01 holds each copy equal to its home, through the home\'s export where it has one, and the travel labels by their keys in the strip\'s code.',
  g: 'ONE WORD IS NEW: "Look up your booking →", the travel column\'s foot link, to /booking/manage. The words and the path are typed once, in LandingHeader.tsx. The guest law\'s check that LandingHeader.tsx never links /booking/manage (scripts/assert-tool-registry.ts:10382) is re-said in place to hold exactly this one link. The lookup box stays the door, mounted where it is. The guest proof\'s seed guest01-z4 plants a second link, and guest01:334 is re-said to match.',
  h: 'HIS NEWER CHOICE SUPERSEDES TWO OLDER RULINGS. GUEST-01\'s door ruling (Alex, 17:04, as the law quotes it) is re-said as ruling g says. HERO-CREST-01\'s "remove github, the icon is enough, we dont need it 2x" took the bar\'s own GitHub link; now the About Us column draws the footer\'s code link again, in a new tab. Both quotes stay where they stand, and each place that holds them is re-said beside them, dated.',
  i: 'THE MENU\'S RULES FOLLOW THE BAR\'S OWN at the foot of src/app/globals.css: from 1024px to 1279px they override some of its values, at the same specificity. Every class takes the house prefix, and the mono is var(--font-mono), as in the port\'s second difference. The note that nothing may follow the HERO-CREST-01 block is re-said in place. heroCrest01 T3\'s line that nothing follows the port is re-said: this block follows it, and homeMenu01 holds the block line for line. No token is added: the five it reads are in :root already (the README\'s table).',
  j: 'NOTES THE MENU MAKES FALSE ARE RE-SAID WHERE THEY STAND, dated. That covers every sentence that says the bar\'s names land on sections, that the bar reads MODULES_ANCHOR or SERVICES_ANCHOR, that the phone menu repeats the bar\'s links, or that the bar links neither GitHub nor /booking/manage. MODULES_ANCHOR stays, with no reader under src; heroCrest01 T10 still holds it equal to the how-to\'s id. Apart from BAR_PRICING\'s (ruling d), a line that a test or a law cites by its number stays on that number, and Landing.tsx keeps its 815 lines.',
  k: 'OTHER BRIEFS\' CENSUSES STAND UNEDITED: homeTrim01\'s, homeTrim02\'s, homeTrim03\'s and homePages01\'s, and homeAbout02\'s and homePlans05\'s when they land. A new note goes beside their quotes, never inside one. The 2026-11-14 approvals are named by their times and their words are quoted nowhere new.',
  l: 'HOME-MENU-01 IS QUOTED WITH THESE TIMES: 2026-11-14 20:01 and 20:41 Manila for the boards, and 2026-11-16 00:52 Manila for the destinations. Every ruling above is quoted exactly as worded, and its wording keeps it out of every other census.',
  m: 'NOTHING BUT THE BAR CHANGES ON ANY PAGE: not the hero, the home page\'s sections, the footer, the pages the menu opens, or the lookup box. Their files change only where ruling j re-says a note.',
} as const;
/** His answer, 2026-11-16 00:52 Manila, choosing each item's destination from the README's table. */
const ANSWER = 'Yes, use these (Recommended)';
/** His leave, 2026-11-16 13:28 Manila, at the rebase onto HOME-PLANS-05 and HOME-PHONE-01: to re-say in place, dated, the two assertions of theirs this
 * change makes false, each saying what it held until then, and any other sentence of theirs the menu makes false the same way, touching nothing
 * else of theirs. */
const LEAVE = 'Yes, re-say in place (Recommended)';
/** The brief's stamp, as every quote of it here and in the tree stands under. */
const STAMP = 'HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16)';

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-menu-01-handoff.zip): bytes and sha256 of each, as the brief gives them. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 13295, '0ad3cdc5881b6cc9a87f49298a15eaf581dcc555927669abe83778c6e4e617d2'],
  [REFERENCE, 42849, '183456e38a004e9fdc4bfdb2573382ceba47ae1a27a563edd894b72945d9668f'],
];
/** A page's body, its script left out, with each of its bars stood in for by one token. */
const bodyBesideBars = (html: string): string => html.slice(html.indexOf('<body>'), html.indexOf('<script>') > -1 ? html.indexOf('<script>') : html.indexOf('</body>')).replace(/<header class="bar[^"]*">[\s\S]*?<\/header>/g, '<header/>');

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size, the folder holds the two; the reference\'s first stylesheet is design-refs/hero-crest-01\'s, byte for byte, and so is everything on its page but the two bars', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes, as the brief gives it`);
    assert.equal(sha256(whole(file)), sha, `${file}: byte for byte (sha256), as the brief gives it`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['Menu-Reference.html', 'README.md'], 'the folder holds the two files and nothing else');
  const [first, second, ...more] = stylesOf(whole(REFERENCE));
  assert.equal(more.length, 0, 'the reference has two stylesheets');
  const hero = stylesOf(whole(HERO_REFERENCE));
  assert.equal(hero.length, 1, 'hero-crest-01\'s has one');
  assert.equal(first, hero[0], 'the first stylesheet is design-refs/hero-crest-01\'s, byte for byte — on main already, as its port');
  assert.ok(second.includes('HOME-MENU-01 · NEW WITH THIS CHANGE: the top bar\'s menu. The only rules to port.'), 'the second is what this change adds');
  assert.equal(bodyBesideBars(whole(REFERENCE)), bodyBesideBars(whole(HERO_REFERENCE)), 'everything on the page but the two bars is hero-crest-01\'s, byte for byte');
  assert.equal(referenceBars().length, 2, 'two bars: the glass one over the hero, the filled one on the plain page');
});

// ── T2 · THE PORT'S NEW BLOCK ────────────────────────────────────────────────

/** The README's table of the tokens the menu reads (README, "Tokens"), each in :root already: name and the value the app holds. */
const TOKENS: ReadonlyArray<readonly [token: string, value: string]> = [['hero-ink-nav', '#E8E4F5'], ['hero-ink', '#FAF8F4'], ['hero-gold', '#F6C95C'], ['hero-rim-lilac', '#B9A2FF'], ['glass-line', 'rgb(255 255 255 / 0.22)']];

test('T2 the block is the reference\'s second stylesheet, declaration by declaration and in order, behind the house prefix, its mono the site\'s; it reads the README\'s five tokens, each in :root already, and adds none; it follows the bar\'s own rules, and nothing follows it', () => {
  const second = stylesOf(whole(REFERENCE))[1];
  const expected = declarations(uncommented(second)).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    return `${media} | ${prefixed(sel)} | ${decl.replace(/var\(--/g, 'var(--ts-').replace("font-family: 'IBM Plex Mono'", 'font-family: var(--font-mono)')}`;
  });
  assert.equal(expected.length, 136, 'one hundred and thirty-six declarations');
  const block = declarations(blockCss());
  assert.deepEqual(block, expected, 'the block is the second stylesheet, declaration by declaration, in its order, renamed — its mono the site\'s (ruling i)');
  assert.equal(count(blockCss(), 'var(--font-mono)'), 4, 'the four mono rules read the site\'s mono');
  // ruling i: no token is added — the five it reads are in :root already, the README's table
  const read = [...new Set([...blockCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(read, ['--font-mono', ...TOKENS.map(([t]) => `--ts-${t}`)].sort(), 'it reads the five tokens and the site\'s mono, nothing else');
  const readme = flat(whole(README));
  for (const [token, value] of TOKENS) {
    assert.ok(readme.includes(`| \`${token}\` |`), `the README's table names ${token}`);
    assert.match(code(GLOBALS), new RegExp(`\\n {2}--ts-${token}: +${value.replace(/[()/.]/g, (c) => `\\${c}`)};`), `--ts-${token} is in :root already, at ${value}`);
  }
  assert.doesNotMatch(blockCss(), /--[\w-]+\s*:|#[0-9a-fA-F]{3,8}\b|!important/, 'no token declared, no hex typed, no !important');
  for (const line of block) for (const cls of line.split(' | ')[1].match(/\.[A-Za-z][\w-]*/g) ?? []) assert.ok(cls.startsWith('.ts-'), `${line}: ${cls} wears the house prefix`);
  // its seat: after the bar's own rules, at the foot of the file — nothing after it
  const css = code(GLOBALS);
  const heroAt = css.indexOf('.ts-hero {');
  assert.ok(heroAt > -1 && heroAt < css.indexOf(BLOCK_OPEN), 'it stands after the hero\'s and the bar\'s rules, whose values it overrides from 1024px to 1279px at the same specificity (ruling i)');
  assert.equal(count(css, BLOCK_OPEN), 1, 'its first rule, once at the start of a line');
  // nothing follows it: the block runs to the file's end, so a rule after it is a declaration more than the reference's (above), and the file's last
  // text is the reference's last rule (until the review of HOME-MENU-01, 2026-11-16, this line compared the block's declarations with themselves)
  assert.match(css, /@media \(hover: hover\) \{\s*\.ts-bar__trigger:hover \{ color: var\(--ts-hero-gold\); \}\s*\}\s*$/, 'the file ends at the reference\'s last rule, the names\' hover');
  // and no rule in the file names the bar's fixed ids: the panel, the menu and the lists are ruled by their classes alone, as the reference rules them
  assert.doesNotMatch(css, /ts-bar-me(?:ga|nu)/, 'no rule names the panel\'s, the menu\'s or a list\'s id, by #id or by [id…] (the ids are ts-bar-mega and ts-bar-menu…)');
  // and nothing redefines what the block reads: each of the five tokens is declared once, in :root, and the site's mono is the layout's (next/font
  // sets --font-mono on the page), declared nowhere in this file — so no rule can hand the menu another value
  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const [token] of TOKENS) assert.deepEqual([count(css, `--ts-${token}:`), count(rootBlock, `--ts-${token}:`)], [1, 1], `--ts-${token} is declared once, in :root`);
  assert.equal(count(css, '--font-mono:'), 0, 'and --font-mono nowhere in this file');
  for (const sel of ['.ts-bar__pill', '.ts-bar__products', '.ts-bar__account', '.ts-bar__login', '.ts-brand__name']) {
    const hero = declarations(css.slice(heroAt, css.indexOf(BLOCK_OPEN))).filter((d) => d.split(' | ')[1] === sel);
    assert.ok(hero.length > 0, `${sel} is the bar's own class, ruled in the hero's block before the menu's`);
  }
});

// ── T3 · THE RENDER ──────────────────────────────────────────────────────────

const STATES: ReadonlyArray<readonly [name: string, state: Partial<ViewState>, paint: Paint]> = [
  ['closed', {}, {}],
  ...(['fs', 'ps', 'tm', 'about'] as BarMenuKey[]).map((key) => [`the panel open, from the name ${key}`, { panelFrom: key }, { panel: true }] as const),
  ['the phone menu open', { menuOpen: true }, { menu: true }],
  ...(['fs', 'ps', 'tm', 'about'] as BarMenuKey[]).map((key) => [`the phone menu open, its list ${key} open`, { menuOpen: true, openList: key }, { menu: true, list: key }] as const),
];

test('T3 the bar\'s view, with its state, is the reference\'s two bars as its own script paints them, token for token: closed, the panel open from each name, the phone menu open, each list open in turn — but for the house prefix, the fixed ids and the mark\'s path; glass over the hero with Log in a button, filled on a page with Log in a link', () => {
  const [glassBar, solidBar] = referenceBars();
  for (const [name, state, paint] of STATES) {
    assert.deepEqual(tokensOf(view(true, true, state), false), tokensOf(painted(glassBar, paint), true), `glass, Log in a button: ${name}`);
    assert.deepEqual(tokensOf(view(false, false, state), false), tokensOf(painted(solidBar, paint), true), `filled, Log in a link: ${name}`);
  }
  // the fixed ids: one panel, one menu, four lists, each once, and the default export draws them closed
  const html = renderToStaticMarkup(React.createElement(LandingHeader));
  assert.equal(count(html, `id="${BAR_MEGA_ID}"`), 1, 'the panel\'s one id');
  for (const key of ['fs', 'ps', 'tm', 'about']) assert.equal(count(html, `id="${BAR_MENU_ID}-${key}"`), 1, `the list ${key}'s one id`);
  assert.equal(BAR_MEGA_ID, 'ts-bar-mega', 'the panel\'s id, as ruling a names it');
  assert.equal(tokensOf(html, false).join('\n'), tokensOf(view(false, false, {}), false).join('\n'), 'the default export, at first, draws the view closed');
});

// ── T4 · THE WORDS AND THE DESTINATIONS ──────────────────────────────────────

/** The six travel labels, by their keys, as the strip's code types them (src/components/trips/travelStripModes.tsx — frozen by the booking flow). */
const stripLabel = (key: string): string => {
  const labels = [...new Set([...code(STRIP).matchAll(new RegExp(`\\{ key: '${key}', label: '([^']+)'`, 'g'))].map((m) => m[1]))];
  assert.equal(labels.length, 1, `the strip types one label for ${key}`);
  return labels[0];
};

test('T4 BAR_MENU, every word and destination: the four names, Our Story, the anchors, the pages\' paths, the 14 steps\' path and the services read from their light homes; the plans, the compare link, the record\'s two labels with CODE_URL and the six travel labels copied once and held equal to theirs; the one new word typed once', () => {
  const [fs, ps, tm, about] = BAR_MENU;
  assert.deepEqual(BAR_MENU.map((c) => c.key), ['fs', 'ps', 'tm', 'about'], 'four columns, in the reference\'s order');
  // ruling e: read where the home is light
  assert.deepEqual(BAR_MENU.map((c) => c.name), [PLAN_PILLAR.heading, BUILD_PILLAR.heading, EXPLORE_PILLAR.heading, ABOUT_US_HEADING], 'the four names: the pillars\' headings and About Us');
  assert.deepEqual(fs.links.map((l) => l.href), Array(4).fill(FINANCIAL_SOFTWARE_PATH), 'the four plans open /financial-software');
  assert.deepEqual(ps.links.map((l) => [l.label, l.href, l.kind]), SERVICES.map((s) => [s.title, proposalFormHref(s.need), s.kind]), 'each service: its title, the form with it picked, its kind');
  assert.deepEqual(ps.links.map((l) => l.kind), [SERVICE_KINDS.project, SERVICE_KINDS.monthly, SERVICE_KINDS.project, SERVICE_KINDS.project, SERVICE_KINDS.monthly, null], 'Project or Monthly; Something else has none');
  assert.deepEqual(tm.links.map((l) => l.href), [`/#${EVENTS_ANCHOR}`, ...Array(5).fill(`/#${DEMO_ANCHOR}`)], 'Events to /#events, the five tabs to /#demo');
  assert.deepEqual(about.links.map((l) => [l.label, l.href]), [[ABOUT_US_HEADING, ABOUT_PATH], [OUR_STORY_HEADING, `/#${MY_TRIP_ANCHOR}`], [FOOTER_RECORD_LINKS[0].label, PIPELINE_PATH], [BAR_PRICING.label, BAR_PRICING.href], [FOOTER_RECORD_LINKS[1].label, CODE_URL]], 'About Us, Our Story, the 14 steps, Pricing, the code');
  assert.equal(FOOTER_RECORD_LINKS[0].href, PIPELINE_PATH, 'the record\'s first link is the 14 steps\' path, as the menu\'s is');
  assert.deepEqual(BAR_MENU.flatMap((c) => c.links).filter((l) => l.newTab).map((l) => l.href), [CODE_URL], 'one link leaves the site, in a new tab: the code');
  // ruling f: copied once, and held equal to the home, through the home's export where it has one
  assert.deepEqual(fs.links.map((l) => [l.label, l.audience]), PLANS.map((p) => [p.name, p.audience]), 'the four plans\' names and audiences are PLANS\'');
  assert.deepEqual(fs.more, { label: COMPARE_PLANS_WORDS, href: COMPARE_PLANS_PATH }, 'the compare link is the how-to\'s');
  assert.deepEqual([about.links[2].label, about.links[4].label, about.links[4].href], [FOOTER_RECORD_LINKS[0].label, FOOTER_RECORD_LINKS[1].label, CODE_URL], 'the record\'s two labels and CODE_URL');
  assert.deepEqual(tm.links.map((l) => l.label), ['events', 'flights', 'hotels', 'transit', 'activities', 'visa'].map(stripLabel), 'the six travel labels are the strip\'s, by their keys');
  // ruling g: the one new word, its path beside it, typed once
  assert.deepEqual(tm.more, { label: 'Look up your booking →', href: '/booking/manage' }, 'the travel column\'s foot link');
  assert.deepEqual([ps.more, about.more], [null, null], 'the other two columns have none');
  const header = code(HEADER);
  for (const word of ['Personal', 'Personal + Business', 'Personal + Trading', 'Personal + Business + Trading', 'For students, creators and nomads.', 'For founders, freelancers and small business owners.', 'For traders running their own money.', 'For founder-traders.', 'Compare all four plans →', '/pricing', 'Events', 'Flights', 'Hotels', 'Getting around', 'Things to do', 'Visa', 'How It All Connects: The 14 Steps', 'Built in Public: The Code', CODE_URL, 'Look up your booking →', '/booking/manage', '/how-pricing-works']) {
    assert.equal(count(header, `'${word}'`), 1, `"${word}" is typed once in the bar`);
  }
  for (const name of new Set(['Financial Software', 'Professional Services', 'Travel Marketplace', 'About Us', 'Our Story', ...SERVICES.map((s) => s.title), ...Object.values(SERVICE_KINDS), '/financial-software', '/about', '/how-it-works', '/work-with-me'])) assert.ok(!header.includes(name), `"${name}" is read from its home, not typed in the bar`);
  assert.equal((header.match(/\bBAR_LOOKUP\b/g) ?? []).length, 2, 'BAR_LOOKUP is named twice — its declaration and the travel column\'s foot link: nothing else draws it (ruling g)');
  // ruling d: a destination on the site is a next/link Link, the code's a plain anchor in a new tab. next/link draws an anchor's markup, so the render
  // cannot hold this; the code does: two plain anchors, the code's (the panel's and the list's), and eleven Links — the mark, Pricing and Log in in the
  // bar; the panel's three kinds of link and its foot link; the list's link and its foot link; Pricing and Log in in the phone menu
  const anchors = header.match(/<a\b[^>]*>/g) ?? [];
  assert.equal(anchors.length, 2, 'two plain anchors in the bar');
  for (const a of anchors) assert.ok(a.includes('href={link.href} target="_blank" rel="noopener noreferrer"'), `${a}: the code's link, in a new tab`);
  assert.equal(count(header, '<Link '), 11, 'and eleven next/link Links');
  // Pricing's word is drawn from BAR_PRICING wherever the bar draws it, never typed as text (the markup is the same either way, so the code holds it)
  assert.equal(count(header, '{BAR_PRICING.label}'), 2, 'the bar\'s Pricing and the phone menu\'s draw BAR_PRICING.label');
  assert.doesNotMatch(header, />\s*Pricing\s*</, 'and no Pricing typed as JSX text');
  assert.doesNotMatch(header, /#(modules|services|demo|events|my-trip|stop-0)\b/, 'no section id typed: the menu builds its fragments from the anchors');
  assert.doesNotMatch(header, /from '@\/lib\/(offer\/plans|howTo|footerWords)'|from '@\/components\/trips\/travelStripModes'/, 'and no heavy home is imported (ruling f)');
});

// ── T5 · THE GRAPH ───────────────────────────────────────────────────────────

/** The bar's import closure — homePages01.test.ts's reader, shared with it in ./importReader.ts (TypeScript's own parser reads each file's imports:
 * declarations wherever they stand, import(), require(), re-exports; a module named by anything but a literal is returned as such and refused by
 * the closed list below). Until the review of HOME-MENU-01 (2026-11-16) this test read imports with a pattern of its own, and then with a copy. */
const graphOf = (entry: string): { files: string[]; packages: string[] } => closureOf([entry]);

test('T5 the bar\'s import graph, listed: eight modules under src and two packages — the light homes it reads, and none of the heavy ones (rulings e and f)', () => {
  const { files, packages } = graphOf(HEADER);
  assert.deepEqual(files, [
    'src/components/landing/LandingHeader.tsx',
    'src/components/landing/pipelineWords.ts',
    'src/lib/brandLockup.ts',
    'src/lib/homeActWords.ts',
    'src/lib/homeAnchors.ts',
    'src/lib/homePages.ts',
    'src/lib/proposalNeeds.ts',
    'src/lib/stopZeroWords.ts',
  ], 'the bar reaches these eight modules and nothing else — five until HOME-MENU-01 (2026-11-16): the three it adds are homePages.ts, pipelineWords.ts and proposalNeeds.ts, each a pure leaf');
  assert.deepEqual(packages, ['next/link', 'react'], 'and two packages');
  for (const heavy of ['src/lib/offer/plans.ts', 'src/lib/howTo.ts', 'src/lib/footerWords.ts', 'src/components/trips/travelStripModes.tsx', 'src/lib/toolRegistry.ts', 'src/lib/offer.ts', 'src/lib/experiences.ts']) assert.ok(!files.includes(heavy), `${heavy} stays out of the bar`);
});

// ── T6 · THE STATE ───────────────────────────────────────────────────────────

type El = React.ReactElement<Record<string, unknown>>;
/** Every element the view draws, depth first — its function components drawn too. */
function drawnElementsOf(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}
/** The view drawn from a state, its setters applying each press to that state, as React's would. */
function pressable(start: ViewState, login = false): { state: ViewState; els: () => El[]; logins: number } {
  const box = { state: { ...start }, logins: 0 };
  const apply = <K extends keyof ViewState>(key: K) => (next: ViewState[K] | ((prev: ViewState[K]) => ViewState[K])): void => {
    box.state = { ...box.state, [key]: typeof next === 'function' ? (next as (prev: ViewState[K]) => ViewState[K])(box.state[key]) : next };
  };
  return Object.assign(box, {
    els: (): El[] => drawnElementsOf(LandingHeaderView({ onRequireLogin: login ? () => { box.logins += 1; } : undefined, ...box.state, setMenuOpen: apply('menuOpen'), setPanelFrom: apply('panelFrom'), setOpenList: apply('openList') })),
  });
}
const nameOf = (els: El[], key: BarMenuKey): El => els.filter((el) => el.props['aria-controls'] === BAR_MEGA_ID)[BAR_MENU.findIndex((c) => c.key === key)];
const rowOf = (els: El[], key: BarMenuKey): El => els.find((el) => el.props['aria-controls'] === `${BAR_MENU_ID}-${key}`) as El;
const press = (el: El, target?: { closest: (s: string) => unknown }): void => (el.props.onClick as (e: unknown) => void)({ target });
/** A stand-in for an element the effect meets: what closest() answers for the selectors it asks, and a focus it records. */
type Stand = { place: string; closest: (selector: string) => unknown; focus: () => void };
/**
 * THE EFFECT, RUN FOR REAL. The default export called once under a dispatcher that hands it a state and records its one effect — React 18's own
 * internals hold the dispatcher, as booksGate01.test.ts drives a component — then that effect run against a stand-in document, as the browser runs
 * it after the render: what has focus, the listeners it adds and takes away, the four names and the menu button it gives focus back to.
 */
function runEffect(state: ViewState) {
  const writes: string[] = [];
  const focused: string[] = [];
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const added: Array<{ type: string; fn: unknown; options: unknown }> = [];
  const removed: Array<{ type: string; fn: unknown; options: unknown }> = [];
  const effects: Array<{ run: () => unknown; deps: unknown[] }> = [];
  const values: unknown[] = [state.menuOpen, state.panelFrom, state.openList];
  const stateNames = ['menuOpen', 'panelFrom', 'openList'];
  const setters = stateNames.map((name) => (next: unknown): void => { writes.push(`${name} ← ${String(next)}`); });
  let calls = 0;
  const dispatcher = {
    useState: () => { const i = calls; calls += 1; return [values[i], setters[i]]; },
    useEffect: (run: () => unknown, deps: unknown[]) => { effects.push({ run, deps }); },
  };
  const internals = (React as unknown as { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current: unknown } } })
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  const prev = internals.current;
  internals.current = dispatcher;
  let drawn: unknown;
  try { drawn = LandingHeader({ glass: true }); } finally { internals.current = prev; }
  assert.equal(calls, 3, 'the bar holds three states');
  assert.equal(effects.length, 1, 'and one effect');
  const stand = (place: string, inside: string | null): Stand => ({ place, closest: (s) => (inside !== null && s === inside ? { inside } : null), focus: () => { focused.push(place); } });
  const names = BAR_MENU.map((c) => stand(`the name ${c.key}`, `button[aria-controls="${BAR_MEGA_ID}"]`));
  const places = { names, menuButton: stand('the menu button', null), inPanel: stand('a link in the panel', `#${BAR_MEGA_ID}`), inMenu: stand('a link in the menu', `#${BAR_MENU_ID}`), page: stand('the page', null) };
  const doc = {
    activeElement: null as Stand | null,
    body: places.page,
    addEventListener: (type: string, fn: (e: unknown) => void, options?: unknown) => { added.push({ type, fn, options }); if (!listeners[type]) listeners[type] = []; listeners[type].push(fn); },
    removeEventListener: (type: string, fn: unknown, options?: unknown) => { removed.push({ type, fn, options }); },
    querySelectorAll: (s: string) => (s === `button[aria-controls="${BAR_MEGA_ID}"]` ? names : []),
    querySelector: (s: string) => (s === `button[aria-controls="${BAR_MENU_ID}"]` ? places.menuButton : null),
  };
  const g = globalThis as unknown as { document?: unknown };
  const had = Object.prototype.hasOwnProperty.call(g, 'document');
  const saved = g.document;
  const inDocument = <T,>(f: () => T): T => { g.document = doc; try { return f(); } finally { if (had) g.document = saved; else delete g.document; } };
  const cleanup = inDocument(() => effects[0].run());
  // focus moves when the person moves it — after the effect has run, before the key — so a handler that read it early reads it wrong
  const focus = (on: 'panel' | 'menu' | 'page' | null): void => { doc.activeElement = on === 'panel' ? places.inPanel : on === 'menu' ? places.inMenu : on === 'page' ? places.page : null; };
  const fire = (type: string, event: unknown): void => inDocument(() => { for (const fn of listeners[type] ? listeners[type] : []) fn(event); });
  const clean = (): void => inDocument(() => { (cleanup as () => void)(); });
  return { writes, focused, listeners, added, removed, deps: effects[0].deps, cleanup, clean, focus, fire, places, drawn, setters };
}

test('T6 the state: the panel, the phone menu and its lists closed at first; a name opens the panel and the name pressed last closes it; a link in it closes it; a row opens its list and closes the one open; the menu closes on a link, on Log in and on its button; Escape and the press outside, held in the one effect; nothing stored', () => {
  // closed at first: the default export draws the view with nothing open
  const first = renderToStaticMarkup(React.createElement(LandingHeader));
  assert.ok(first.includes(`<div class="ts-mega" id="${BAR_MEGA_ID}" hidden="">`), 'the panel: in the markup, hidden');
  assert.ok(first.includes(`<nav class="ts-menu" id="${BAR_MENU_ID}" aria-label="Menu" hidden="">`), 'the phone menu: in the markup, hidden');
  for (const key of ['fs', 'ps', 'tm', 'about']) assert.ok(first.includes(`<div class="ts-menu__sub" id="${BAR_MENU_ID}-${key}" hidden="">`), `the list ${key}: in the markup, hidden`);
  assert.equal(count(first, 'aria-expanded="true"'), 0, 'every button says closed');
  // the four names (ruling a)
  const bar = pressable(CLOSED);
  press(nameOf(bar.els(), 'fs')); assert.equal(bar.state.panelFrom, 'fs', 'a name opens the panel');
  assert.deepEqual(bar.els().filter((el) => el.props['aria-controls'] === BAR_MEGA_ID).map((el) => el.props['aria-expanded']), [true, true, true, true], 'all four names say the panel is open');
  press(nameOf(bar.els(), 'fs')); assert.equal(bar.state.panelFrom, null, 'a second press of the same name closes it');
  press(nameOf(bar.els(), 'ps')); press(nameOf(bar.els(), 'about')); assert.equal(bar.state.panelFrom, 'about', 'a press of another leaves it open, and makes that one the opener');
  press(nameOf(bar.els(), 'ps')); assert.equal(bar.state.panelFrom, 'ps', 'and again');
  press(nameOf(bar.els(), 'ps')); assert.equal(bar.state.panelFrom, null, 'the name pressed last closes it');
  press(nameOf(bar.els(), 'tm'));
  const panel = bar.els().find((el) => el.props.id === BAR_MEGA_ID) as El;
  press(panel, { closest: () => null }); assert.equal(bar.state.panelFrom, 'tm', 'a press inside the panel, off a link, leaves it open');
  press(panel, { closest: (s) => (s === 'a' ? {} : null) }); assert.equal(bar.state.panelFrom, null, 'a press on a link in it closes it');
  // the phone menu and its rows (ruling b)
  const phone = pressable(CLOSED, true);
  const menuButton = (): El => phone.els().find((el) => el.props['aria-controls'] === BAR_MENU_ID && el.type === 'button') as El;
  press(menuButton()); assert.equal(phone.state.menuOpen, true, 'the button opens the menu');
  assert.equal(drawnElementsOf(LandingHeaderView({ ...phone.state, setMenuOpen: noop, setPanelFrom: noop, setOpenList: noop })).find((el) => el.type === 'path' && String(el.props.d).startsWith('M5.5'))?.props.d, CROSS, 'and draws the board\'s cross while it is open');
  press(rowOf(phone.els(), 'fs')); assert.equal(phone.state.openList, 'fs', 'a row opens its list');
  press(rowOf(phone.els(), 'tm')); assert.equal(phone.state.openList, 'tm', 'and closes the one open');
  press(rowOf(phone.els(), 'tm')); assert.equal(phone.state.openList, null, 'an open row closes its own');
  assert.deepEqual([phone.state.menuOpen, phone.state.panelFrom], [true, null], 'and the rows leave the menu open, and the panel as it was');
  const both = pressable({ ...CLOSED, menuOpen: true });
  for (const key of ['fs', 'about', 'about'] as BarMenuKey[]) press(nameOf(both.els(), key));
  assert.deepEqual([both.state.menuOpen, both.state.openList], [true, null], 'a press of a name leaves the phone menu and its lists as they were: the four closers are a link, Log in, Escape and the button (ruling b)');
  const menu = (): El => phone.els().find((el) => el.props.id === BAR_MENU_ID) as El;
  press(menu(), { closest: (s) => (s === 'a' ? {} : null) }); assert.equal(phone.state.menuOpen, false, 'a link closes the menu');
  press(menuButton()); press(menuButton()); assert.equal(phone.state.menuOpen, false, 'and its button closes it');
  press(menuButton());
  press(phone.els().find((el) => el.props.className === 'ts-pill-gold ts-menu__login') as El); assert.deepEqual([phone.state.menuOpen, phone.logins], [false, 1], 'Log in closes it, then opens the login');
  // Escape and the press outside: the one effect, run for real (until the review of HOME-MENU-01, 2026-11-16, held by four phrases of its code, which an
  // inverted guard or a wrong target passed)
  // the default export draws the view with its three states and their setters, each where it belongs (an openList handed the panel's state, or
  // a row's setter that is the panel's, would draw on the server just the same), and hands on what it was given
  const wired = runEffect({ menuOpen: true, panelFrom: 'tm', openList: 'fs' });
  const view = wired.drawn as React.ReactElement<Record<string, unknown>>;
  assert.equal(view.type, LandingHeaderView, 'the default export draws the pure view');
  assert.deepEqual([view.props.glass, view.props.menuOpen, view.props.panelFrom, view.props.openList], [true, true, 'tm', 'fs'], 'with what it was handed and its three states, each in its own place');
  assert.deepEqual([view.props.setMenuOpen, view.props.setPanelFrom, view.props.setOpenList].map((f) => wired.setters.indexOf(f as (next: unknown) => void)), [0, 1, 2], 'and each state\'s own setter');
  const closedRun = runEffect(CLOSED);
  assert.deepEqual(closedRun.deps, [false, null], 'the effect follows the menu\'s state and the panel\'s, and nothing else');
  assert.deepEqual([closedRun.cleanup, closedRun.added], [undefined, []], 'closed, it listens for nothing');
  let run = runEffect({ ...CLOSED, panelFrom: 'tm' });
  assert.deepEqual(run.deps, [false, 'tm'], 'opened from Travel Marketplace');
  assert.deepEqual(run.added.map((a) => [a.type, a.options]).sort(), [['click', undefined], ['keydown', undefined]], 'open, it listens for a key and for a press, with no options: every key and every press, in the bubbling phase');
  run.focus('panel');
  run.fire('keydown', { key: 'Enter' });
  assert.deepEqual([run.writes, run.focused], [[], []], 'another key does nothing');
  run.fire('keydown', { key: 'Escape' });
  assert.deepEqual([run.writes, run.focused], [['panelFrom ← null'], ['the name tm']], 'Escape closes the panel and gives focus back to the name that opened it, when focus was inside — read when the key is pressed');
  run = runEffect({ ...CLOSED, panelFrom: 'tm' });
  run.focus('page');
  run.fire('keydown', { key: 'Escape' });
  assert.deepEqual([run.writes, run.focused], [['panelFrom ← null'], []], 'with focus elsewhere, Escape closes it and focus stays where it was');
  run = runEffect({ ...CLOSED, panelFrom: 'tm' });
  run.fire('click', { target: run.places.inPanel });
  assert.deepEqual(run.writes, [], 'a press inside the panel is not a press outside');
  for (const name of run.places.names) run.fire('click', { target: name });
  assert.deepEqual(run.writes, [], 'nor is a press on any of the four names: the name\'s own press decides');
  run.fire('click', { target: run.places.page });
  assert.deepEqual(run.writes, ['panelFrom ← null'], 'a press outside the panel and the four names closes it');
  assert.equal(typeof run.cleanup, 'function', 'the effect hands back its cleanup');
  run.clean();
  assert.deepEqual(run.removed.map((r) => [r.type, r.options]).sort(), [['click', undefined], ['keydown', undefined]], 'which takes both listeners away, as they were added');
  for (const r of run.removed) assert.ok(run.added.some((a) => a.type === r.type && a.fn === r.fn), `the cleanup takes away the very ${r.type} listener the effect added`);
  run = runEffect({ ...CLOSED, menuOpen: true });
  assert.deepEqual(run.deps, [true, null], 'the phone menu open');
  run.focus('menu');
  run.fire('keydown', { key: 'Escape' });
  assert.deepEqual([run.writes, run.focused], [['menuOpen ← false'], ['the menu button']], 'Escape closes the menu and gives focus back to its button, when focus was inside');
  run = runEffect({ ...CLOSED, menuOpen: true });
  run.focus('page');
  run.fire('keydown', { key: 'Escape' });
  assert.deepEqual([run.writes, run.focused], [['menuOpen ← false'], []], 'with focus elsewhere, Escape closes it and focus stays');
  run = runEffect({ ...CLOSED, menuOpen: true });
  run.fire('click', { target: run.places.page });
  assert.deepEqual(run.writes, [], 'a press outside closes no phone menu: the panel alone closes so');
  run = runEffect({ ...CLOSED, menuOpen: true, panelFrom: 'fs' });
  run.fire('click', { target: run.places.page });
  assert.deepEqual(run.writes, ['panelFrom ← null'], 'both open (a window narrowed with the panel open): a press outside closes the panel, whatever the menu');
  run = runEffect({ ...CLOSED, menuOpen: true, panelFrom: 'fs' });
  run.focus('page');
  run.fire('keydown', { key: 'Escape' });
  assert.deepEqual(run.writes, ['panelFrom ← null', 'menuOpen ← false'], 'and Escape closes both');
  const header = code(HEADER);
  assert.equal(count(header, 'useEffect('), 1, 'one effect');
  // nothing stored, nothing in the URL (ruling c)
  assert.doesNotMatch(header, /localStorage|sessionStorage|indexedDB|\.cookie|useSearchParams|usePathname|useRouter|location\.|history\.|\bfetch\(/, 'no storage, no cookie, no URL, no call');
});

// ── T7 · THE RULINGS ─────────────────────────────────────────────────────────

test('T7 each ruling is quoted, exact, where it is built, under the brief\'s stamp; the notes the menu made false are re-said in place, dated; no cited line moved; in every source file of the change a quote that follows a sentence of his for twelve characters is his words from there, and each file\'s count of his quotes is held', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  // where each is built: in the bar — the names, the rows, the state, the list, the light homes, the copies, the new word, the code's link,
  // the notes and nothing else changing; in globals.css the block; in this file, HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and,
  // corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling k: "OTHER BRIEFS' CENSUSES STAND UNEDITED: homeTrim01's, homeTrim02's, homeTrim03's and homePages01's, and homeAbout02's and homePlans05's when they land. A new note goes beside their quotes, never inside one. The 2026-11-14 approvals are named by their times and their words are quoted nowhere new."
  // and ruling l: "HOME-MENU-01 IS QUOTED WITH THESE TIMES: 2026-11-14 20:01 and 20:41 Manila for the boards, and 2026-11-16 00:52 Manila for the destinations. Every ruling above is quoted exactly as worded, and its wording keeps it out of every other census."
  const BUILT: ReadonlyArray<readonly [file: string, words: readonly string[]]> = [
    [HEADER, [RULING.a, RULING.b, RULING.c, RULING.d, RULING.e, RULING.f, RULING.g, RULING.h, RULING.j, RULING.m, ANSWER]],
    [GLOBALS, [RULING.i]],
    [THIS, [RULING.k, RULING.l, ANSWER]],
  ];
  for (const [file, words] of BUILT) {
    const said = prose(file);
    assert.ok(said.includes(STAMP), `${file} names the brief, its times and the build's day`);
    for (const w of words) {
      assert.ok(quoted(file, w), `${file} quotes "${w.slice(0, 40)}…", exact`);
      const at = said.indexOf(`"${flat(w)}"`);
      const under = said.slice(said.lastIndexOf('HOME-MENU-01', at), at);
      assert.ok(under.includes('2026-11-14 20:01') && under.includes('2026-11-16 00:52') && under.includes('built 2026-11-16'), `${file}: "${w.slice(0, 30)}…" stands under the brief's stamp`);
    }
  }
  // the law and the seeds cite rulings d, g and h by their letters, beside the words they re-say
  assert.match(prose(LAW), /HOME-MENU-01 \(2026-11-16\), rulings g and h: still the door; the header links it exactly once since then/, 'the law, beside the 17:04 door');
  assert.match(code(LAW), /why: 'LandingHeader\.tsx:\d+ \(HOME-MENU-01, 2026-11-16: was :90; FOOTER-02, 2026-11-12: was :89; HERO-CREST-01, 2026-11-11: was :52 — BAR_PRICING, drawn in the bar, in its phone menu and in the About Us column of its menu, in the panel and in the list\)/, 'GUEST_ROUTES re-cites BAR_PRICING, newest first (ruling d)');
  // ruling j: the notes that went false, re-said in place and dated — each re-said phrase stands, and main's sentence is gone where it differs
  const RESAID: ReadonlyArray<readonly [file: string, now: RegExp, gone: RegExp | null]> = [
    [HEADER, /Log in \(HOME-MENU-01, 2026-11-16: the three names with a caret each, then About Us with its own, first in the account group, before Pricing/, /Travel Marketplace · Pricing · Log in\. Its/],
    [HEADER, /ported to the foot of src\/app\/globals\.css \(and, since HOME-MENU-01, 2026-11-16, design-refs\/home-menu-01's second stylesheet after them: the menu's\)/, null],
    [HEADER, /THE THREE LINKS were the home page's three pillars until HOME-MENU-01 \(2026-11-16\)/, /THE THREE LINKS are the home page's three pillars/],
    [HEADER, /UNDER 1024px the bar's row folds into a menu behind one 44px button — the menu repeated the three links, Pricing and Log in until HOME-MENU-01 \(2026-11-16\); since then its first four rows are the four names/, /UNDER 1024px the links fold into a menu behind one 44px button\. Open or closed is React state/],
    [HEADER, /No pillar name and no id is typed here \(the menu's other words are BAR_MENU's, below, the heavy homes' copied once: ruling f\)\. Its links are absolute/, /No name and no id is typed here/],
    [HEADER, /The bar's own link to the code was "GitHub ↗" until HERO-CREST-01 \(2026-11-11\) took it out, by his words the note above quotes; from then until HOME-MENU-01 \(2026-11-16\) the bar linked no code/, null],
    [HEADER, /HOME-MENU-01 \(2026-11-16\), his newer choice, beside it: the menu's About Us column draws the footer's code link again/, null],
    [HEADER, /Until then this place held BAR_PRODUCT_LINKS/, /HERO-CREST-01: the bar's three product links — the home page's three pillars\. Each is its pillar's heading/],
    [HEADER, /HOME-MENU-01 \(2026-11-16\): five more fixed ids, for the same reason/, null],
    [HEADER, /THE OPEN MENU — under 1024px, a dark glass panel under the bar: the four names as rows/, /THE OPEN MENU — the README's first proposal/],
    [LANDING, /as its third product link, BAR_PRODUCT_LINKS — until HOME-MENU-01, 2026-11-16: since then from its menu's Travel Marketplace column/, /as its third product link, BAR_PRODUCT_LINKS\), but an/],
    [LANDING, /left the bar by his rulings of the same day \(LandingHeader\.tsx; HOME-MENU-01, 2026-11-16: the code's link came back, in the bar's menu's About Us column, in a new tab\)/, /left the bar by his rulings of the same day \(LandingHeader\.tsx\);/],
    [ANCHORS, /SERVICES_ANCHOR the bar's and its section's \(HOME-MENU-01, 2026-11-16: since then MODULES_ANCHOR is read by nothing under src but this file/, null],
    [ANCHORS, /linked the three pillars — \/#modules, \/#services, \/#demo — from every page that mounts it until HOME-MENU-01 \(2026-11-16: since then its names open the menu, and the menu's links read EVENTS_ANCHOR, DEMO_ANCHOR and MY_TRIP_ANCHOR here\), and it may not retype an id/, /links the three pillars — \/#modules, \/#services, \/#demo — from every page that mounts it, and may not retype an id/],
    [ANCHORS, /the bar alone reads it now; HOME-MENU-01, 2026-11-16: nothing under src reads it now but this file/, /the bar alone reads it now\)\./],
    [ANCHORS, /WHAT THE BAR PAYS FOR READING IT HERE \(its anchors since HOME-MENU-01, 2026-11-16/, /WHAT THE BAR PAYS FOR READING IT HERE:/],
    [FOOTER_WORDS, /every section keeps its id\. HOME-MENU-01 \(2026-11-16\): the bar read the first two until then/, null],
    [FOOTER_WORDS, /the bar still does \(until HOME-MENU-01, 2026-11-16: its names open the menu now/, /the bar still does\.(?! \()/],
    [FOOTER_WORDS, /it left the top bar\. HOME-MENU-01 \(2026-11-16\): the bar's menu opens it again, in a new tab/, null],
    [PIPELINE_WORDS, /nothing reads them anywhere else \(HOME-MENU-01, 2026-11-16: but the top bar's menu, which links PIPELINE_PATH/, /nothing reads them anywhere else:/],
    [PIPELINE_WORDS, /HOME-MENU-01 \(2026-11-16\): and the top bar's menu \(LandingHeader\.tsx\);/, null],
    [SERVICES_SECTION, /Professional Services lands on \(until HOME-MENU-01, 2026-11-16: the bar's Professional Services opens its menu now/, /Professional Services lands on\. \(HOME-PAGES-01/],
    [HOW_TO, /bar's first link land on \(the top bar's first link until HOME-MENU-01, 2026-11-16: its first name opens the menu now, and lands nowhere\)/, /bar's first link land on\. \(HOME-PAGES-01/],
    [GLOBALS, /nothing may follow the hero's block \(but HOME-MENU-01's, 2026-11-16: the menu's rules follow the bar's own\), the/, /nothing may follow the hero's block, the/],
    [GLOBALS, /and nothing may follow the hero's \(but HOME-MENU-01's, 2026-11-16: the menu's rules follow the bar's own\)\. \(The brief, written/, /and nothing may follow the hero's\. \(The brief, written/],
    [GLOBALS, /because nothing may follow the hero's \(but HOME-MENU-01's, 2026-11-16: the menu's rules follow the bar's own\) and the Financial Software port/, /because nothing may follow the hero's and the Financial Software port/],
    [GLOBALS, /which stays last \(HOME-MENU-01, 2026-11-16: but for the menu's block, which follows it\):/, /which stays last: the Financial Software section's port/],
    [GLOBALS, /NOTHING FOLLOWS THIS BLOCK BUT THE MENU'S, AND NOTHING ABOVE IT NAMES ITS CLASSES \(HOME-MENU-01, 2026-11-16, its ruling i/, /NOTHING FOLLOWS THIS BLOCK, AND NOTHING ABOVE IT NAMES ITS CLASSES: a rule/],
    [GLOBALS, /THE OPEN MENU\. Drawn on the design canvas: the menu's 390 board, approved with the home page's boards on 2026-11-14 at 20:01 and, corrected, 20:41 Manila, draws it open with one list, and HOME-MENU-01 built it \(2026-11-16/, /THE OPEN MENU\. Not drawn on the design canvas: this panel is the proposal\. \*\//],
    [GLOBALS, /the open menu's panel is hero-well at 86%, typed as the reference types it; HOME-MENU-01, 2026-11-16: and the top bar's menu's panel, \.ts-mega__panel, is hero-well at 95%/, null],
    [LAW, /LandingHeader carries no link to it\. \(HOME-MENU-01, 2026-11-16, its rulings g and h, beside the 17:04 ruling/, null],
    [LAW, /never a header link\. \(HOME-MENU-01, 2026-11-16, rulings g and h: it is still the door/, null],
    [SEEDS, /HOME-MENU-01, 2026-11-16: since then a second header link, typed or drawn from BAR_LOOKUP again, or the header's one link with other words or in another column/, null],
    [SEEDS, /The door \(Alex's ruling 17:04\): the lookup under the home page's booking section\. HOME-MENU-01 \(2026-11-16\), ruling h, beside it/, null],
    [tests('heroCrest01'), /nothing follows it in the file but the menu's block \(HOME-MENU-01, 2026-11-16/, /nothing follows it in the file and nothing above/],
    [tests('heroCrest01'), /T10 #modules has one home — MODULES_ANCHOR, read by the bar until HOME-MENU-01 \(2026-11-16\) and by nothing under src since/, /MODULES_ANCHOR, read by the bar \(and by the footer/],
    [tests('homePages01'), /HOME-MENU-01 \(2026-11-16\) adds one more reader: the top bar \(LandingHeader\.tsx\)/, null],
    [tests('homePages01'), /they land where they did \(until HOME-MENU-01, 2026-11-16, rulings d and e/, null],
    [tests('footer01'), /it left the top bar \(until HOME-MENU-01, 2026-11-16: the bar's menu opens it again, in a new tab/, null],
    [tests('footer01'), /the top bar's first link \(until HOME-MENU-01, 2026-11-16: its names open its menu now\) and the checkout's cancel link still land on it/, null],
    [tests('footer02'), /stays last \(but for the menu's block after it, since HOME-MENU-01, 2026-11-16\)/, null],
    [tests('howTo01'), /and the top bar's first link, until HOME-MENU-01, 2026-11-16: its first name opens the menu now/, /\/modules and the top bar's first link land on it/],
    [tests('guest01'), /the door still \(HOME-MENU-01, 2026-11-16, ruling h, beside it: the header carries one link to \/booking\/manage since then/, null],
    [tests('guest01'), /HOME-MENU-01 \(2026-11-16\), rulings g and h: line 334, above, re-said — the header links \/booking\/manage exactly once/, null],
    [tests('heroCrest01'), /ported to the foot of src\/app\/globals\.css \(and the bar's menu, since HOME-MENU-01, 2026-11-16, by design-refs\/home-menu-01's second stylesheet after it/, null],
    [tests('heroCrest01'), /HOME-MENU-01 \(2026-11-16\), ruling h, beside the quote below: it took the bar's own GitHub link, which stays gone/, null],
    [tests('homeServices01'), /\.ts-menu:not\(\[hidden\]\), HERO-CREST-01; and its lists', \.ts-menu__sub:not\(\[hidden\]\), since HOME-MENU-01, 2026-11-16/, null],
    // at the rebase onto HOME-PLANS-05 and HOME-PHONE-01 (2026-11-16): what the menu made false that the first round left, or that those briefs said
    // anew — the Financial Software port's seat, its page's door and the leaf's NEVER TYPED (HOME-PLANS-05's files: Alex's leave, 13:28 Manila), and
    // three notes in tests this change had re-said already
    [GLOBALS, /It stands here, above the hero's block, because nothing may follow that one \(but HOME-MENU-01's, 2026-11-16: the menu's rules follow the bar's own\); it names none of the hero's classes/, null],
    [FS_PAGE, /which opens the map's grid in place \(and, since HOME-MENU-01, 2026-11-16, the four plans in the top bar's menu, each a link here: BAR_MENU, in src\/components\/landing\/LandingHeader\.tsx — from HOME-PLANS-05 until then the footer's column was its one door\)/, null],
    [LEAF, /a plan's name or its audience line — read from PLANS \(src\/lib\/offer\/plans\.ts; HOME-MENU-01, 2026-11-16: but for the top bar's menu, which types the four plans' names and audiences once more, in src\/components\/landing\/LandingHeader\.tsx, held equal to PLANS by homeMenu01 — never typed anywhere until then\)/, null],
    [tests('footer02'), /T6 the words — every word from its home, and none typed twice in the footer's own files \(HOME-MENU-01, 2026-11-16: the bar types the record's two labels and the code's URL once more, among its menu's copies, which homeMenu01 holds equal — none typed twice in all of src until then\)/, /and none typed twice: the columns' from footerWords\.ts/],
    [tests('footer02'), /THE COLUMNS' WORDS — typed once, in footerWords\.ts; the footer types none of them \(HOME-MENU-01, 2026-11-16: the bar types two of them once more, the record's two labels/, null],
    [tests('heroCrest01'), /The port: everything in globals\.css from the hero's first rule to the end of the file \(HOME-MENU-01, 2026-11-16: and so the menu's block with it, which follows the port to the end of the file and which T3 sets apart/, null],
    // and the rebase's completeness critic: lists of a page's doors and a leaf's readers that the menu lengthens, which the first round left
    [SERVICES_LEAF, /read them \(HOME-MENU-01, 2026-11-16: and the top bar's menu, src\/components\/landing\/LandingHeader\.tsx — its Professional Services column, each service's title and kind, to proposalFormHref; those four alone until then\)/, null],
    [LEAF, /TYPED HERE, ONCE: the section's words \(HOME-MENU-01, 2026-11-16: but the compare link's, which the top bar's menu types once more, in src\/components\/landing\/LandingHeader\.tsx, held equal to COMPARE_PLANS_WORDS by homeMenu01 — once, here, until then\)/, null],
    [ABOUT_PAGE, /Since HOME-MENU-01 \(2026-11-16\) the About Us column of the top bar's menu opens it too, on every page that mounts the bar \(BAR_MENU, in src\/components\/landing\/LandingHeader\.tsx\) — the footer's link and the band's button alone until then\./, null],
    [STEPS_PAGE, /the footer's THE RECORD links here too\. HOME-MENU-01 \(2026-11-16\): and the top bar's menu, from its About Us column, by PIPELINE_PATH \(BAR_MENU, in src\/components\/landing\/LandingHeader\.tsx\)\./, null],
    [PAGES_LEAF, /Stop 0 \| Los Angeles\. \(HOME-MENU-01, 2026-11-16: and the top bar's menu reads two of the paths, FINANCIAL_SOFTWARE_PATH for its four plans and ABOUT_PATH for About Us, in src\/components\/landing\/LandingHeader\.tsx — the footer's words alone read them until then\.\)/, null],
    [FOOTER_WORDS, /and the footer is each one's door \(HOME-MENU-01, 2026-11-16: and, for \/financial-software and \/about, the top bar's menu too — the footer alone until then\)\. The brief's step 4/, null],
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its note re-said, dated`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
  }
  // THE WORDS THIS CHANGE WROTE. Every run of comment lines HOME-MENU-01 added or re-said in the files it touched stands exactly as written: read as
  // prose (the reader law's comments, flattened; DESIGN.md as text), found by its first words — and which occurrence of them — and held by its length
  // and sha256. A note made false, undated or misquoted fails here by name, with its words as they now stand; a later brief that re-says one of these
  // lines re-hashes it here, beside a dated note. (From the review of HOME-MENU-01, 2026-11-16, whose hunters changed words inside these notes that no
  // phrase above reached: a count, a column, a ruling's letter, a date.)
  // Rebased onto main at 5e789e1 (HOME-PLANS-05 and HOME-PHONE-01, landed 2026-11-16), four runs are held anew, as the merge leaves them: in
  // homePages01, the T8 entry and the note on who reads the leaf, lines those briefs re-said too, which carry their words beside this change's; in
  // footer02, the T3 note on the port's seat, and the note under it, whose neighbours they re-said. The other eighty-one stand as written. And six
  // runs join them, the notes the rebase's sweep found the menu makes false: the Financial Software port's seat in globals.css, its page's door,
  // the leaf's NEVER TYPED (src/app/financial-software/page.tsx and src/lib/howTo.ts join the table's files), footer02's T6 entry and its note on
  // the columns' words, and heroCrest01's port helper. Then six more, which its completeness critic found the first round had left: the services'
  // leaf's readers, the leaf's TYPED HERE, ONCE, the doors of /about and /how-it-works, the pages' leaf's readers and the footer's words' door
  // (src/lib/proposalNeeds.ts, src/lib/homePages.ts, src/app/about/page.tsx and src/app/how-it-works/page.tsx join the table's files).
  const WRITTEN: ReadonlyArray<readonly [file: string, opens: string, nth: number, length: number, before: number, after: number, sha: string]> = [
    ["src/components/landing/LandingHeader.tsx", "mark and the wordmark · Financial Software | Pro", 0, 304, 16, 16, 'd6ecfcfbb85acf567e2b1c9255eb697e9afa78df581017f20282d005a4adfd31'],
    ["src/components/landing/LandingHeader.tsx", "reference's own, ported to the foot of src/app/g", 0, 199, 16, 16, '709d3094b6f4c6ae2224193c8af57a34ce38b384e9d9a8f75838226057f6d480'],
    ["src/components/landing/LandingHeader.tsx", "· THE THREE LINKS were the home page's three pil", 0, 759, 16, 16, '8ebbbcae517b43f32d7dc660f3e1ea5f6b30ab9603f16d0897c733ab93a1f6dc'],
    ["src/components/landing/LandingHeader.tsx", "· UNDER 1024px the bar's row folds into a menu b", 0, 462, 16, 16, 'f0655a8096609aed013ed49f464b2fe5ec80dbcb3e2788af83e88af1acf6bed8'],
    ["src/components/landing/LandingHeader.tsx", "signed-out cockpit tabs mount none: this link wa", 0, 312, 16, 16, 'aeac2ea0c16e7a2ec80044017bb13281ddc2d1b89008f5c25bca3b138895c9f7'],
    ["src/components/landing/LandingHeader.tsx", "Pricing keeps its page — /how-pricing-works (the", 0, 296, 16, 16, '09de29eb18b43d67d6371565e27879211199ad3a0e1d860c3995da1fb30a3eb5'],
    ["src/components/landing/LandingHeader.tsx", "THE COPIES. HOME-MENU-01 (Alex: the boards, 2026", 0, 1527, 16, 16, '5aaa02b386169c7ca64ca4a70770845f9b32c30d238a57dcc39fa71d0c416f13'],
    ["src/components/landing/LandingHeader.tsx", "The code, which leaves the site. HOME-MENU-01 (A", 0, 1545, 16, 16, '99e7d34298b120818b808a65782bd0baa9841b69f3364c41499d79ba66af6f89'],
    ["src/components/landing/LandingHeader.tsx", "The four columns' keys, in the reference's order", 0, 2142, 16, 16, '12f664dc26c945b7d0ee6c7a960029fbc4465a6168a0a1cc43213e1a221232c1'],
    ["src/components/landing/LandingHeader.tsx", "aria-controls and id; the fixed id gave none in ", 0, 282, 16, 16, '55605fd0161420eaa31493d288f71c95e522dd3714551aac7c1d5bd1fd268c0e'],
    ["src/components/landing/LandingHeader.tsx", "HOME-MENU-01 (2026-11-16): the panel's one fixed", 0, 211, 16, 16, '45ca8c4ead3a437a31f8f2e458fd86cae36e95519cac3f005e47efa1585b3e08'],
    ["src/components/landing/LandingHeader.tsx", "The bar's two props, shared by the stateful bar ", 0, 64, 16, 16, '5c742cef5868c2c270f48c0797b52451d4f12d13a5b7d99ba21430d2fd44072d'],
    ["src/components/landing/LandingHeader.tsx", "THE VIEW — the bar drawn from its state, pure, s", 0, 1936, 16, 16, '01d8629bb50f85ce21a78cdabee31febbcf762ec41b6699e2ae399df12668d00'],
    ["src/components/landing/LandingHeader.tsx", "closed, its two bars; open, the cross the 390 bo", 0, 71, 16, 16, '9714593e9295257860a6ef31d69372fced81ddc035cf1e550f1488d913d4a579'],
    ["src/components/landing/LandingHeader.tsx", "THE PANEL (HOME-MENU-01, 2026-11-16): from 1024p", 0, 716, 16, 16, 'dd2c310a3a8bdf63c13f6379f4fcdf65a34d7ea2b7b7eb93f72d7ae3a2b866fb'],
    ["src/components/landing/LandingHeader.tsx", "THE BAR — its state, and the view drawn with it.", 0, 2015, 16, 0, 'b8fb2814369d328d6db999217a425b21bdddd13de294056ffb439834c6734d7d'],
    ["src/app/globals.css", "without its token: the open menu's panel is hero", 0, 236, 16, 16, '8a07b7d07ba3b0eeb5626520251fb5f9f2ecd7c6fd0c6518dce7fb2751734c62'],
    ["src/app/globals.css", "above the chip strip's rules, the HOME-SERVICES-", 0, 198, 16, 16, '78152c1d578892a81cc051b35399190e0ed8a3b62e34ab608c2b27683b721086'],
    ["src/app/globals.css", "each of those ports runs from its own first rule", 0, 196, 16, 16, 'aae5d739d5ab1d1317be390ecf0f54d83289459ddeca51497f2d22a0daefc578'],
    ["src/app/globals.css", "section's block and the hero's, because nothing ", 0, 191, 16, 16, 'c19b78db731c76c82933f40daed651cd3845a5e4bfe3d9ca57ed2f00183d0dd1'],
    ["src/app/globals.css", "follow that one (but HOME-MENU-01's, 2026-11-16:", 0, 189, 16, 16, 'c8f15d07e18513e28f10f41265ff71a9348a5b271eac2233e42e5f69292142f1'],
    ["src/app/globals.css", "last (HOME-MENU-01, 2026-11-16: but for the menu", 0, 192, 16, 16, 'a5e7b134092f1034506eb5366ed3331bf0e741a910f306641dde5978a6eb8ad2'],
    ["src/app/globals.css", "NOTHING FOLLOWS THIS BLOCK BUT THE MENU'S, AND N", 0, 246, 16, 16, '287102f29bccca3144d02bdcaea526f17928930bb6cca356ffec613f541a7845'],
    ["src/app/globals.css", "file as the port, and fails on any of these (the", 0, 175, 16, 16, '00d6075bd26a6638461a237535b0858ade1b43d7b7ccd01f6b06edc11897aad5'],
    ["src/app/globals.css", "THE OPEN MENU. Drawn on the design canvas: the m", 0, 300, 16, 16, '8c657576e81f2984ca2c0fa20de2b2146fce9e68dc6d340d1edf41b99f861187'],
    ["src/app/globals.css", "── HOME-MENU-01 (Alex: the boards, 2026-11-14 20", 0, 3480, 16, 0, '53a139e326c9f5d7ffab91e0a63d9bb46afd16dde7736775b49afb5ac4c3e35d'],
    ["src/components/landing/Landing.tsx", "ACCOUNT\" left the bar by his rulings of the same", 0, 209, 16, 16, 'b50b8c1824d2ab050a91770b796eb1bc432bedaf88c24606d873c55645e1d2d9'],
    ["src/components/landing/Landing.tsx", "today (the nav's Live-demo link retired, Landing", 0, 369, 16, 16, '1cf79ebad0adb45a723ff7ddc1667eaa334d91086a234622d0933537fb7dc549'],
    ["scripts/assert-tool-registry.ts", "goes to /booking/manage. LandingHeader carries n", 0, 395, 16, 16, '29bd50000df068fbc399e27804567764b0a517c802259acc09989adedc861c28'],
    ["scripts/assert-tool-registry.ts", "THE DOOR (Alex's ruling 17:04): the lookup under", 0, 305, 16, 16, '7cd7a6a6b30dab025ae3a0a006b960ae89a420afc51842fec83f32d8fb6d2eea'],
    ["scripts/assert-tool-registry.ts", "HOME-FINISH-02 (Alex, 2026-11-10 20:56): NOTHING", 0, 664, 16, 16, '44a5c01eb4d4820ac0cfb1405a65094cb2a64a99e69c616b2e74c20614cfe333'],
    ["scripts/proofs/guest01.seeds.ts", "above the booking section, asking on load, or th", 0, 283, 16, 16, 'd6c1d44207325d27d28b1306c0ee6f71e7b593c43d528a1c447818746eb25f56'],
    ["scripts/proofs/guest01.seeds.ts", "The door (Alex's ruling 17:04): the lookup under", 0, 274, 16, 16, '1544b104f59ef1b8277088a79a16fb89b76843b922204e65501352e2e66aa1dd'],
    ["scripts/proofs/guest01.seeds.ts", "HOME-MENU-01 (2026-11-16), rulings g and h: the ", 0, 401, 16, 16, '4343626801cb27afb6312e4a97f2a2e7cadb53a7c419bd2eb79163364cbf1114'],
    ["scripts/proofs/guest01.seeds.ts", "HOME-MENU-01 (2026-11-16), ruling g: the one lin", 0, 643, 16, 16, '1387cd3a01d4ea28b25c47402cb62d15cc162e72fcb158d5cb0890ec910d7913'],
    ["src/lib/homeAnchors.ts", "/about — with no fragment), so MODULES_ANCHOR is", 0, 287, 16, 16, '75550f15dc39acebade2808f9dc0d5adf110e193244fdd3e1decba9db970752c'],
    ["src/lib/homeAnchors.ts", "The top bar (LandingHeader.tsx) linked the three", 0, 384, 16, 16, 'b75d871182945bb8ef9b6ffc2925f3a7019f1d930a26cf2cd35b44be9a6b28dd'],
    ["src/lib/homeAnchors.ts", "bar both read it, so it is typed once for both (", 0, 311, 16, 16, '99e8272f92602fd94a1d50ff9a7ff4003fc55ca6b0c197e0e731aa682cddef7f'],
    ["src/lib/homeAnchors.ts", "holds it; src/lib/__tests__/heroCrest01.test.ts ", 0, 448, 16, 16, '4b113471573c1d8ad2612208e76b550ee467cdc31d0db5a0f29687a4e5cc332e'],
    ["src/lib/footerWords.ts", "door (HOME-MENU-01, 2026-11-16: and, for /financ", 0, 242, 16, 16, 'ce75c5af498831f7c17059bc8423344bedf7d9c84fc86698232a0ae22c9c0429'],
    ["src/lib/footerWords.ts", "still land on the home page's sections), and eve", 0, 287, 16, 16, '7811fbc7641619db6542f6a9b78d2b19a90853c62496d1ef108b3b1df17a9f3b'],
    ["src/lib/footerWords.ts", "HOME-PAGES-01 (2026-11-14): the footer reads it ", 0, 238, 16, 16, '8d4f163746d3d20190f3fe4b2576249b566b59e6f140afa064664a9c9715e742'],
    ["src/lib/footerWords.ts", "The code, built in public — the same URL the her", 0, 461, 16, 16, '765c179b804eb207cb7a0dc6f5ae740d7adae45b400475097e201e0d3d877ca1'],
    ["src/components/landing/pipelineWords.ts", "outside the deck lives here, and nothing reads t", 0, 169, 16, 16, '54c5a72eac801227174b9c65fb927fb2a2442eb9e518988f282ca6273022009d'],
    ["src/components/landing/pipelineWords.ts", "FOOTER-01 (2026-11-09): the footer's THE RECORD ", 0, 156, 16, 16, 'ae4cbc54e314dc88f0becf1e799bceda015148c99d00fb875607320357bf8a19'],
    ["src/components/landing/ServicesSection.tsx", "on (until HOME-MENU-01, 2026-11-16: the bar's Pr", 0, 302, 16, 16, 'cdf380743a956b0126cf3a5bf53ae02e1e143c3aaddd4b2ae6327f0722232f45'],
    ["src/components/landing/HowToSection.tsx", "bar's first link land on (the top bar's first li", 0, 231, 16, 16, 'e70e868e72fe4456f4e5099197ccfec95bb7df70e2fc085740c7330cdb83a3a8'],
    ["src/lib/__tests__/heroCrest01.test.ts", "to the foot of src/app/globals.css (and the bar'", 0, 183, 16, 16, '0c15a162bf5ac798fd6c9113508037f569c07dc778f4aa4dfe19fd9baa1c43a9'],
    ["src/lib/__tests__/heroCrest01.test.ts", "named in globals.css; no hex in it; every variab", 0, 281, 16, 16, '3ee84a1493a24f455749fa4905061b233fdb3f57e4f5dc5991ac8d74369feae9'],
    ["src/lib/__tests__/heroCrest01.test.ts", "T5 the bar's words and links — the four names th", 0, 493, 16, 16, 'f7ea0a593dcf0f46f698c5ed37085b867ba43c2040e52a7b6cff4293a9e821a8'],
    ["src/lib/__tests__/heroCrest01.test.ts", "where a login opener is given, a link to '/' whe", 0, 277, 16, 16, '557221038e9a0ee5b430c86ba5ed9e7a507386d6f3f39c4fafde22ec00ef51b5'],
    ["src/lib/__tests__/heroCrest01.test.ts", "calls the login opener (HOME-MENU-01, 2026-11-16", 0, 200, 16, 16, '2a0875d81a4fcba383caec3e056484bbb3e1142897d18ee9afb02ae4e46824c8'],
    ["src/lib/__tests__/heroCrest01.test.ts", "T10 #modules has one home — MODULES_ANCHOR, read", 0, 254, 16, 16, '85cbb9442655c206dd659d5409d3704af4a00a48a0a28c9e7168f96a9dda3a51'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), ruling d: BAR_MENU wh", 0, 93, 16, 16, '2f4169ffe9a02635a2dd6b91eb83a2536c225783a97faac5c114b6161dbe2f4b'],
    ["src/lib/__tests__/heroCrest01.test.ts", "The port: everything in globals.css from the her", 0, 275, 16, 16, '0b2db9d5f322383cb73cb9a694df4a0f33e5cef8e7f50d4ba02922e78f702864'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), ruling i: the menu's ", 0, 532, 16, 16, 'b001fb8a48e0301a0cb72920529e62f07f28ceab3f92541f3912ffeb2192db35'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), rulings a, d and e: t", 0, 519, 16, 16, 'ae21809e195e5759215ff6ae152953a8509e5ec1532bc7149d2adb75a128bbd0'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), beside the note above", 0, 394, 16, 16, 'd9a15ef1e09d54d5aace6fc47efcc0adb28d59ef7ce8cb518ba161cedab1aaf6'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16): the menu builds its t", 0, 318, 16, 16, '302d0374d041d0b7dc06d4876ab2f8118194ed1d4cc546cb00e6e38e1c89615a'],
    ["src/lib/__tests__/heroCrest01.test.ts", "gone, by Alex's ruling — and (HOME-MENU-01, 2026", 0, 326, 16, 16, '738b91b1d27cf757203a57eee143cb55384b9c530a091cd85a0a4a7b7e21bc6c'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), rulings a to d: the f", 0, 822, 16, 16, '019159413290f796a1b4f76606e775df9ee9d6a073d4e934fb21dc4ccc8866e9'],
    ["src/lib/__tests__/heroCrest01.test.ts", "the pill: mark and wordmark · the three names wi", 0, 287, 16, 16, '57052a13e31f8f40f61aa85d26de73f4d869b202a1e3a7afdb5e68be5c71645d'],
    ["src/lib/__tests__/heroCrest01.test.ts", "the menu: closed, named by the button, the four ", 0, 151, 16, 16, '6771e0a425f2a1fe5531c29df344157a9a50584bc3f859a31bd6218efb3491a6'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16): the About Us list dra", 0, 534, 16, 16, '960ed1bcb5d960860c82069fbd6a0d7a229172200803295d1e002e96df8a5b34'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), ruling c: the panel's", 0, 187, 16, 16, '908e355d376f40816504c4e45b73e59e1b5a62c316f2acad3e67892d1ad09a01'],
    ["src/lib/__tests__/heroCrest01.test.ts", "imports these four lines and nothing else'. HOME", 0, 558, 16, 16, '52b28cce9b4d9460ae439e8d9ed52a8a71712aa53539100c153db94b13aa6783'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), rulings a and b: the ", 0, 688, 16, 16, 'b5b1ec6ebfb076369d318d317664b7963d96c408540229f0a912553b2217eb6d'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), ruling j, beside the ", 0, 638, 16, 16, '92d77bb29f9866b2c51f2607793338f31cb624568a94fbe144d8c48dfa5080f7'],
    ["src/lib/__tests__/heroCrest01.test.ts", "HOME-MENU-01 (2026-11-16), ruling h, beside the ", 0, 211, 16, 0, 'a5a62c2c4e9563dd518d282ef256e423e7965be6122a66e5668873b1732abff7'],
    ["src/lib/__tests__/homePages01.test.ts", "pages, Travel Marketplace on /#demo; drawn so; t", 0, 211, 16, 16, '422b33c33505bf8d3deec4c58fde42a850389a04fd543188dedb06d77437c635'],
    ["src/lib/__tests__/homePages01.test.ts", "T8 the home page — HOME-TRIM-01 (2026-11-15) cha", 0, 1005, 16, 16, '44abb3c42d53b0c1533e032d1d358ce77dc31b30ef0d4153001e9be0cc3f37ac'],
    ["src/lib/__tests__/homePages01.test.ts", "HOME-MENU-01 (2026-11-16): the import reader — s", 0, 232, 16, 16, 'd6a1671067c6972824cdc492e1d6d5e86fe8bcf910de77bb72f374240ec3dbda'],
    ["src/lib/__tests__/homePages01.test.ts", "HOME-MENU-01 (2026-11-16), ruling d: BAR_PRODUCT", 0, 83, 16, 16, '56a90e714ea6dfbf66df5c3e756bd29d80de7a9da50e44ba53704230866f65a9'],
    ["src/lib/__tests__/homePages01.test.ts", "the brief's \"NOT IN THIS PR\" names \"The top bar ", 0, 419, 16, 16, 'c3e2d764542866fd888328091c7c26f22341f5c71337a84cd1d8a32a64237b55'],
    ["src/lib/__tests__/homePages01.test.ts", "who reads the leaf: the footer's words, the thre", 0, 817, 16, 16, '2e90a0983d292e30a209e860aa7623bfce12d4571a379d835714e92e4f880dd3'],
    ["src/lib/__tests__/footer01.test.ts", "then; it left the top bar (until HOME-MENU-01, 2", 0, 291, 16, 16, 'eba933c3d207526949eb2c7220911e9c767f64713a9467875107bb3d735ae146'],
    ["src/lib/__tests__/footer01.test.ts", "HOME-MENU-01 (2026-11-16): the bar's one link to", 0, 69, 16, 16, 'f1a723259710b332d72e0abe7fd073ea918ba80c899ff6933ecd25c9fc23fb0b'],
    ["src/lib/__tests__/footer01.test.ts", "the top bar's first link (until HOME-MENU-01, 20", 0, 135, 16, 16, '5ac4a7c8076f7afc6125a6ed26152f846f36a8a1c6341ae046f5263a8ce07439'],
    ["src/lib/__tests__/footer01.test.ts", "HOME-MENU-01 (2026-11-16), ruling h, beside the ", 0, 415, 16, 16, '98e754db2e7af191010dedcc52c2742df94181b1633e22d3d3668afa8ec51141'],
    ["src/lib/__tests__/footer02.test.ts", "HERO-CREST-01's header, which stays last (but fo", 0, 198, 16, 16, '2b142f261197fccb869b8817308e7242fc1c95286847f01f121204533749c11c'],
    ["src/lib/__tests__/footer02.test.ts", "T6 the words — every word from its home, and non", 0, 347, 16, 16, '7eaddb81dc1f90c9f5fbaebf27778c1297fc0624daefacc2591225420f960569'],
    ["src/lib/__tests__/footer02.test.ts", "The port: globals.css from the footer's first ru", 0, 178, 16, 16, '36f3be4830659dc810395da55c6b18ab98fbd454d1bbc4fd2437d3591b7ecaf6'],
    ["src/lib/__tests__/footer02.test.ts", "but for the menu's block after it (HOME-MENU-01,", 0, 60, 16, 16, 'a06b01dc6f09c765ea5db4b1eea8e496aa2c121cb30cd1dab1ef44be14a0c31f'],
    ["src/lib/__tests__/footer02.test.ts", "THE COLUMNS' WORDS — typed once, in footerWords.", 0, 257, 16, 16, '5f744dddd4f50b71208ece894106ec3b8605e4782f713a991f40349e2294bc1b'],
    ["src/lib/__tests__/howTo01.test.ts", "the act: its id (the checkout's cancel link and ", 0, 289, 16, 16, 'c1d95d7de8e44832ed37cc4de191efb3a5f0aa6217eda5891586c6abff06d972'],
    ["src/lib/__tests__/guest01.test.ts", "on the home page and on /booking/manage (Alex's ", 0, 246, 16, 16, '7a216bd654619ef2bb9d611dd73387564c3d0152d36049300a597c6b9ae782d8'],
    ["src/lib/__tests__/guest01.test.ts", "HOME-MENU-01 (2026-11-16), rulings g and h: line", 0, 326, 16, 16, 'aafb29ce690ab82f817df9123bea756b65fe49aeb8f3b20db0ddd15d33f818c0'],
    ["src/lib/__tests__/guest01.test.ts", "BOOK-DISCLOSE-01 (2026-11-08): the disclosure si", 0, 512, 16, 16, 'ba23e167823b90359d740ae0a23ebce9407b15438e3f7b42121830777de399b1'],
    ["src/lib/__tests__/homeServices01.test.ts", "(.ts-fs…: its switches by [aria-pressed], its pl", 0, 210, 16, 16, '80fac52dc801a47427b3f3e04b9006a6f195ecd74c3c95bad2b276ba3e6f9edb'],
    ["DESIGN.md", "gradients (`globals.css`, REPAINT-5); it changes", 0, 405, 16, 16, '11fb9a448a7f13cca086b22be59671095b23d0535878516c0eda3222a00d5ba2'],
    ["src/app/financial-software/page.tsx", "Its door: the footer's SERVICES column, \"Financi", 0, 854, 16, 16, 'c2560456d0b544ce5f93c7cfbe6baec5f2ad158f694c0006a1a23b8d79d90a0b'],
    ["src/lib/howTo.ts", "TYPED HERE, ONCE: the section's words (HOME-MENU", 0, 328, 16, 16, 'fdb5ad775fc5c7f7226225cb7f277b86483030db1baae52281c364c3cbe24f3f'],
    ["src/lib/howTo.ts", "· a plan's name or its audience line — read from", 0, 341, 16, 16, '47d5b91ae4ccb627777a451a27e1f52b9e960d23f86d82515cbb2b9de4002bfe'],
    ["src/lib/proposalNeeds.ts", "(src/lib/crm/crm.ts needWords) read them (HOME-M", 0, 305, 16, 16, '264abaf0ae0e58cc9139d1b28522fd7166278002baa61484dc1f291149470d18'],
    ["src/lib/homePages.ts", "Stop 0 | Los Angeles. (HOME-MENU-01, 2026-11-16:", 0, 261, 16, 16, '3c7d7f77f122965363857ee51b4f7b7577e29debf2b423dc0206a26a868f3c4b'],
    ["src/app/about/page.tsx", "(src/lib/footerWords.ts) — to the page's top, wi", 0, 342, 16, 16, '19c5fbbe3e4b3a8e9213b35c5f077d9d5c1f0372c389ff4a9cb217501e6cde93'],
    ["src/app/how-it-works/page.tsx", "(the deck's own hash effect then opens that step", 0, 265, 16, 16, '5728f44b576c2e4f0248a922a0cf661bf16f8b93ae11404b9f8989a88183a11f'],
  ];
  assert.equal(WRITTEN.length, 97, 'ninety-seven runs of comment lines, in twenty-four files (eighty-five in eighteen until the rebase, 2026-11-16)');
  for (const [file, opens, nth, length, before, after, sha] of WRITTEN) {
    const said = file.endsWith('.md') ? flat(whole(file)) : prose(file);
    let at = -1;
    for (let k = 0; k <= nth; k += 1) { at = said.indexOf(opens, at + 1); if (at < 0) break; }
    assert.ok(at > -1, `${file}: a note HOME-MENU-01 wrote, opening "${opens}…", stands`);
    // the note, and up to sixteen characters on either side of it: nothing is set beside it unseen — and where fewer stood on a side, the file's
    // comments begin or end there still
    if (before < 16) assert.equal(at - before, 0, `${file}: nothing stands before the note HOME-MENU-01 wrote, opening "${opens}…", but what stood there`);
    if (after < 16) assert.equal(said.length, at + length + after, `${file}: nothing follows the note HOME-MENU-01 wrote, opening "${opens}…", but what followed it`);
    const now = said.slice(at - before, at + length + after);
    assert.equal(sha256(now), sha, `${file}: the note HOME-MENU-01 wrote, opening "${opens}…", stands as written, with what stands beside it — it reads now «${now}» (${sha256(now)})`);
  }
  assert.match(flat(whole('DESIGN.md')), /Since HOME-MENU-01 \(2026-11-16\) the bar's menu — the four names' carets, the panel and the phone menu's lists — is drawn by `design-refs\/home-menu-01\/`'s second stylesheet/, 'DESIGN.md: the bar\'s stylesheet, re-said');
  // the tests' titles it re-said, and the seed it re-named — strings, so read in the code
  const TITLES: ReadonlyArray<readonly [file: string, now: string]> = [
    [tests('heroCrest01'), "T5 the bar: four names that open its menu, each by its own name (the three pillars on their own sections until HOME-MENU-01, 2026-11-16)"],
    [tests('heroCrest01'), "the phone menu opens on the four names as rows and starts closed, the panel and the lists in the markup, hidden (HOME-MENU-01, 2026-11-16: the phone menu repeated the bar until then)"],
    [tests('heroCrest01'), "read by the bar until HOME-MENU-01 (2026-11-16) and by nothing under src since"],
    [tests('homePages01'), "the top bar\\'s menu opens the pages\\' paths (HOME-MENU-01, 2026-11-16: its three links where they were, until then)"],
    [tests('footer01'), "the top bar linked GitHub no more, until HOME-MENU-01, 2026-11-16: its menu\\'s About Us column opens CODE_URL again, in a new tab"],
    [tests('footer02'), "which stays last but for the menu\\'s block (HOME-MENU-01, 2026-11-16)"],
    [tests('guest01'), "one header link, the menu’s travel column’s foot link (the door is still the home page’s lookup — HOME-MENU-01, 2026-11-16: no header link until then)"],
    [SEEDS, "name: 'guest01-z4 the header links /booking/manage a second time'"],
    [SEEDS, "name: 'guest01-z4c the header\\'s one lookup link moves to another column'"],
    [SEEDS, "name: 'guest01-z4d the header draws its one lookup link a second time, from BAR_LOOKUP'"],
    [tests('heroCrest01'), "with nothing between the two — homeMenu01 T2 holds the block line for line, and that nothing follows it"],
    [tests('guest01'), "'Alex’s ruling 17:04, re-said by HOME-MENU-01 (2026-11-16): one header link, typed once'"],
    [tests('pipelinePage01'), "pipelineWords.ts\\'s code is untouched (HOME-MENU-01, 2026-11-16, re-said two of its notes)"],
  ];
  for (const [file, now] of TITLES) assert.ok(code(file).includes(now), `${file}: re-said — "${now.slice(0, 60)}…"`);
  // THEIR ASSERTIONS, RE-SAID AT THE REBASE. HOME-PLANS-05 and HOME-PHONE-01 landed on main (2026-11-16) holding two things this change makes false:
  // the compare link's words in one file's code (ruling f types them once more, in the bar; the next line's message, read after it, re-said with it),
  // and HERO-CREST-01's block the last in globals.css
  // (ruling i sets the menu's after it). Asked whether they may be re-said in place, dated, Alex answered, 2026-11-16 13:28 Manila: "Yes, re-say in
  // place (Recommended)". Each stays on its line; strings, so read in the code: the new words stand, and the old line is gone.
  const THEIRS_RESAID: ReadonlyArray<readonly [file: string, now: string, gone: string]> = [
    [tests('homePlans05'), "['src/components/landing/LandingHeader.tsx', LEAF], 'the words stand in two files\\' code under src but the tests: the leaf, and the top bar\\'s menu, which types the compare link\\'s words once more, held equal to COMPARE_PLANS_WORDS by homeMenu01 (HOME-MENU-01, 2026-11-16, its ruling f; re-said at its rebase with Alex\\'s leave, 2026-11-16 13:28 Manila", "[LEAF], 'the words stand in one file\\'s code under src but the tests');"],
    [tests('homePlans05'), "[LEAF], 'and the first toggle\\'s stand in the leaf alone: the menu types none (HOME-MENU-01, 2026-11-16, re-said with the line above at its rebase, with Alex\\'s leave, 2026-11-16 13:28 Manila", "[LEAF], 'and so do the first toggle\\'s');"],
    [tests('homePhone01'), "headers.slice(-3), ['FOOTER-02', 'HERO-CREST-01', 'HOME-MENU-01'], 'its note is no block\\'s header: it ends FOOTER-02\\'s block, and HERO-CREST-01\\'s follows it, the last but for the menu\\'s block after it (HOME-MENU-01, 2026-11-16, its ruling i; re-said at its rebase with Alex\\'s leave, 2026-11-16 13:28 Manila", "headers.slice(-2), ['FOOTER-02', 'HERO-CREST-01']"],
  ];
  for (const [file, now, gone] of THEIRS_RESAID) {
    assert.ok(code(file).includes(now), `${file}: its assertion re-said in place, dated — "${now.slice(0, 60)}…"`);
    assert.ok(!code(file).includes(gone), `${file}: and its old line is gone — "${gone.slice(0, 60)}…"`);
  }
  // no cited line moved: the lines a test or a law cites by number, where they stood
  assert.equal(whole(LANDING).split('\n').length - 1, 815, 'Landing.tsx: 815 lines, as it was');
  assert.equal(whole(LAW).split('\n').length - 1, 11254, 'the law: 11,254 lines, as it was (homeTrim02 and homeTrim03 hold it)');
  assert.ok(comments(ANCHORS).split('\n')[27].includes("STOP_ZERO_ANCHOR its section's alone: no link lands on #stop-0 now, and the id stays."), 'homeAnchors.ts:28, which HOME-TRIM-01\'s ruling e cites, where it stood');
  assert.ok(comments(HEADER).split('\n')[52].includes('LANDING-V3 (spec :34-47) → THREE-TRIMS'), 'LandingHeader.tsx:53-54, which Landing.tsx:673 cites, where it stood');
  assert.ok(code(tests('guest01')).split('\n')[333].startsWith("  assert.equal((code(HEADER).match(/booking\\/manage/g) ?? []).length, 1,"), 'guest01:334, which ruling g cites, holds the re-said check');
  assert.ok(code(LAW).split('\n')[10381].startsWith("  { const bar = codeOf('src/components/landing/LandingHeader.tsx'); const links = (bar.match(/booking\\/manage/g) ?? []).length;"), 'the law\'s :10382, which ruling g cites, holds the re-said check');
  // the line itself, character for character, as guest01's seeds z4 to z4d proved it: a law is proven by its seeds (scripts/prove.ts), which run only
  // when the law is edited, so an edit to this line fails here first — re-prove the seeds, then re-hash (from the review of HOME-MENU-01, 2026-11-16,
  // whose hunters loosened its counts and its column and found no test that saw it). Each seed's expected words stand in it, and each plant is the one meant.
  const lawLine = whole(LAW).split('\n')[10381];
  assert.equal(sha256(lawLine), '3363fc4ad9168b20eff08c3973d414eddc33f93af2c1d3119c1d5611e28bd9dc', `the law's :10382, as its seeds proved it — now ${sha256(lawLine)}`);
  for (const expect of ['LandingHeader.tsx links /booking/manage', 'one link to /booking/manage is not the travel column', 'LandingHeader.tsx names BAR_LOOKUP']) {
    assert.ok(lawLine.includes(expect), `the law's :10382 says "${expect}"`);
    assert.ok(code(SEEDS).includes(`expect: '${expect}',`), `and a seed expects it`);
  }
  assert.ok(code(SEEDS).includes("replace: 'kind: service.kind })), more: BAR_LOOKUP },"), 'guest01-z4c plants the lookup in Professional Services\' column');
  assert.ok(code(SEEDS).includes("replace: '      { label: BAR_PRICING.label, href: BAR_PRICING.href },\\n      { label: BAR_LOOKUP.label, href: BAR_LOOKUP.href },\\n',"), 'guest01-z4d draws it a second time, from BAR_LOOKUP');
  // EVERY SOURCE FILE OF THE CHANGE: a straight mark followed by twelve or more characters of one of his sentences, from the sentence's start,
  // opens a quote of him — what stands from there to the closing mark is his words from that sentence on, to the end of the piece or to a full
  // stop, or this fails, naming the longest such part; a whole sentence of his shorter than that is read too, and counted. Each file's count is held.
  // (homeTrim03's census, at twelve characters: twenty until the review of HOME-MENU-01, 2026-11-16, which let a misquote parting at fifteen through.)
  const CHANGED = [THIS, HEADER, GLOBALS, LANDING, LAW, SEEDS, ANCHORS, FOOTER_WORDS, PIPELINE_WORDS, SERVICES_SECTION, HOW_TO, ...['heroCrest01', 'homePages01', 'footer01', 'footer02', 'howTo01', 'guest01', 'homeServices01', 'pipelinePage01', 'homePlans05', 'homePhone01'].map(tests), 'src/lib/__tests__/importReader.ts', 'DESIGN.md', FS_PAGE, LEAF, SERVICES_LEAF, PAGES_LEAF, ABOUT_PAGE, STEPS_PAGE];
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  // ruling k: the 2026-11-14 approvals are named by their times, and their words are quoted nowhere new. Their words are built here from their
  // parts, so this file does not hold them; in the comments and in the code of every file of the change they stand as often as before it — once,
  // in the code of homePages01.test.ts (HOME-PAGES-01's own APPROVAL), and nowhere else. (Until the review of HOME-MENU-01, 2026-11-16, this test
  // typed the words; then it looked for their stamps, which a stamp wrapped onto the next line passed.)
  const approvals = [['ALL', 'LOOKS', 'GOOD'].join(' '), ['yeet', 'yeet'].join(' ')];
  for (const file of CHANGED) {
    const held = approvals.map((words) => (file.endsWith('.md') ? [count(flat(whole(file)), words), 0] : [count(prose(file), words), count(flat(code(file)), words)]));
    // homePages01's own APPROVAL, in its code; and three comments that quote them and stood so on main before this change, in files that joined
    // the change's files at the rebase (2026-11-16) for one dated note each: the leaf's (HOME-TRIM-02's note, howTo.ts:720-721) and the services'
    // leaf's (HOME-TRIM-03's, proposalNeeds.ts:172), which quote both, and the pages' leaf's (HOME-PAGES-01's own, homePages.ts:5), which quotes one
    // — and in every other file of the change, none
    const before = file === tests('homePages01') ? [[0, 1], [0, 0]] : file === LEAF || file === SERVICES_LEAF ? [[1, 0], [1, 0]] : file === PAGES_LEAF ? [[1, 0], [0, 0]] : [[0, 0], [0, 0]];
    assert.deepEqual(held, before, `${file}: the approvals' words, in its comments and its code, as often as before this change`);
  }
  const HIS_WORDS = [...Object.values(RULING), ANSWER, LEAVE];
  assert.equal(HIS_WORDS.length, 15, 'his words: the thirteen rulings, his answer and his leave at the rebase (fourteen until then) — a ruling dropped from the table above fails here');
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  // ANOTHER BRIEF'S QUOTE THAT OPENS AS ONE OF HIS SENTENCES DOES. Rebased onto main at 5e789e1 (2026-11-16): HOME-PHONE-01's ruling a, its last
  // sentence, quoted in globals.css under that brief's stamp, opens on the seventeen characters that open a sentence of rulings a and b too, and
  // goes on in its own words. It is that brief's quote, not a misquote of his: named here whole, by its file and its words, held to stand there
  // once, and counted as none of his.
  const THEIRS: ReadonlyArray<readonly [file: string, words: string]> = [
    [GLOBALS, 'Under 1024px the row stands in for the name; from 1024px the row is never drawn and the name stands as it does today.'],
  ];
  for (const [file, words] of THEIRS) assert.equal(count(prose(file), `"${words}"`), 1, `${file}: another brief's quote, "${words.slice(0, 40)}…", stands there once, whole`);
  const census: Record<string, number> = {};
  for (const file of CHANGED) {
    const said = file.endsWith('.md') ? flat(whole(file)) : prose(file);
    for (let at = said.indexOf('"'); at > -1; at = said.indexOf('"', at + 1)) {
      const rest = said.slice(at + 1);
      let his = false;
      let parted = '';
      let longest = 0;
      for (const text of HIS_WORDS) {
        for (const from of sentencesOf(text)) {
          let n = 0;
          while (from + n < text.length && rest[n] === text[from + n]) n += 1;
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') his = true;
          else if (n >= 12 && n > longest) { longest = n; parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where his words go on "${text.slice(from + n, from + n + 24)}…"`; }
        }
      }
      const theirs = THEIRS.some(([f, words]) => f === file && rest.startsWith(`${words}"`));
      assert.ok(his || theirs || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(census, {
    [THIS]: 4, // the header: his answer; rulings k and l (T7); his leave at the rebase (T7) — three until then
    [HEADER]: 11, // rulings a, b, c, d, e, f, g, h, j and m, and his answer
    [GLOBALS]: 1, // ruling i, over the block
  }, 'each file\'s quotes of him, counted — sixteen in three of the twenty-nine (fifteen in three of the twenty-one until the rebase): a quote that stood and no longer opens on his words leaves its file\'s count, and fails here');
});
