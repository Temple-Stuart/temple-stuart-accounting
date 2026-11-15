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
 *   T5 the graph — every module the bar reaches, listed, so that no heavy home can join it unseen;
 *   T6 the state — the panel and the lists closed at first; which press opens and which closes each; Escape and the press outside;
 *      nothing stored;
 *   T7 the rulings — each quoted, exact, where it is built, under the brief's stamp; the notes it made false re-said, dated; no cited
 *      line moved; a census of the brief's quotes in every source file of the change, each file's count held.
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
      if (k === 'class') val = val.split(/\s+/).filter(Boolean).map((c) => (reference ? c : c.replace(/^ts-/, ''))).join(' ');
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
  assert.ok(declarations(css.slice(heroAt)).slice(-block.length).join('\n') === block.join('\n'), 'the port\'s last declarations are the block, and nothing follows it');
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
  for (const word of ['Personal', 'Personal + Business', 'Personal + Trading', 'Personal + Business + Trading', 'For students, creators and nomads.', 'For founders, freelancers and small business owners.', 'For traders running their own money.', 'For founder-traders.', 'Compare all four plans →', '/pricing', 'Events', 'Flights', 'Hotels', 'Getting around', 'Things to do', 'Visa', 'How It All Connects: The 14 Steps', 'Built in Public: The Code', CODE_URL, 'Look up your booking →', '/booking/manage']) {
    assert.equal(count(header, `'${word}'`), 1, `"${word}" is typed once in the bar`);
  }
  for (const name of ['Financial Software', 'Professional Services', 'Travel Marketplace', 'About Us', 'Our Story', 'Full setup', '/financial-software', '/about', '/how-it-works', '/work-with-me']) assert.ok(!header.includes(name), `"${name}" is read from its home, not typed in the bar`);
  assert.doesNotMatch(header, /#(modules|services|demo|events|my-trip|stop-0)\b/, 'no section id typed: the menu builds its fragments from the anchors');
  assert.doesNotMatch(header, /from '@\/lib\/(offer\/plans|howTo|footerWords)'|from '@\/components\/trips\/travelStripModes'/, 'and no heavy home is imported (ruling f)');
});

// ── T5 · THE GRAPH ───────────────────────────────────────────────────────────

/** Every module under src a file reaches through its imports and re-exports, and the packages it names. */
function graphOf(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    for (const m of code(file).matchAll(/^(?:import|export)\b[^'"]*?from '([^']+)';|^import '([^']+)';/gm)) {
      const spec = m[1] ?? m[2];
      const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : spec.startsWith('.') ? join(dirname(file), spec) : null;
      if (base === null) { packages.add(spec); continue; }
      const hit = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find((f) => existsSync(resolve(ROOT, f)));
      assert.ok(hit, `${file} imports ${spec}, which resolves to a file`);
      visit(hit as string);
    }
  };
  visit(entry);
  return { files: [...files].sort(), packages: [...packages].sort() };
}

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
  const menu = (): El => phone.els().find((el) => el.props.id === BAR_MENU_ID) as El;
  press(menu(), { closest: (s) => (s === 'a' ? {} : null) }); assert.equal(phone.state.menuOpen, false, 'a link closes the menu');
  press(menuButton()); press(menuButton()); assert.equal(phone.state.menuOpen, false, 'and its button closes it');
  press(menuButton());
  press(phone.els().find((el) => el.props.className === 'ts-pill-gold ts-menu__login') as El); assert.deepEqual([phone.state.menuOpen, phone.logins], [false, 1], 'Log in closes it, then opens the login');
  // Escape and the press outside: the one effect, held by its code (the server draws no effect; the browser's run is in the PR)
  const header = code(HEADER);
  const effect = flat(header.slice(header.indexOf('useEffect(() => {'), header.indexOf('}, [menuOpen, panelFrom]);')));
  assert.ok(effect.startsWith('useEffect(() => { if (!menuOpen && panelFrom === null) return;'), 'the effect listens only while the menu or the panel is open');
  assert.ok(effect.includes("const back = focused !== null && focused.closest(`#${BAR_MEGA_ID}`) !== null; setPanelFrom(null); if (back)"), 'Escape closes the panel and, when focus was inside, gives it back to the name that opened it');
  assert.ok(effect.includes("const back = focused !== null && focused.closest(`#${BAR_MENU_ID}`) !== null; setMenuOpen(false); if (back) document.querySelector<HTMLButtonElement>(`button[aria-controls=\"${BAR_MENU_ID}\"]`)!.focus();"), 'and the menu, giving focus back to its button');
  assert.ok(effect.includes('target.closest(`#${BAR_MEGA_ID}`) === null && target.closest(`button[aria-controls="${BAR_MEGA_ID}"]`) === null) setPanelFrom(null);'), 'a press outside the panel and the four names closes it');
  assert.equal(count(header, 'useEffect('), 1, 'one effect');
  // nothing stored, nothing in the URL (ruling c)
  assert.doesNotMatch(header, /localStorage|sessionStorage|indexedDB|\.cookie|useSearchParams|usePathname|useRouter|location\.|history\.|\bfetch\(/, 'no storage, no cookie, no URL, no call');
});

// ── T7 · THE RULINGS ─────────────────────────────────────────────────────────

test('T7 each ruling is quoted, exact, where it is built, under the brief\'s stamp; the notes the menu made false are re-said in place, dated; no cited line moved; in every source file of the change a quote that follows a sentence of his for twenty characters is his words from there, and each file\'s count of his quotes is held', () => {
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
    [HEADER, /UNDER 1024px the links folded into a menu behind one 44px button until HOME-MENU-01 \(2026-11-16\); since then its first four rows are the four names/, /UNDER 1024px the links fold into a menu/],
    [HEADER, /HOME-MENU-01 \(2026-11-16\), his newer choice, beside it: the menu's About Us column draws the footer's code link again/, null],
    [HEADER, /Until then this place held BAR_PRODUCT_LINKS/, /HERO-CREST-01: the bar's three product links — the home page's three pillars\. Each is its pillar's heading/],
    [HEADER, /HOME-MENU-01 \(2026-11-16\): five more fixed ids, for the same reason/, null],
    [HEADER, /THE OPEN MENU — under 1024px, a dark glass panel under the bar: the four names as rows/, /THE OPEN MENU — the README's first proposal/],
    [LANDING, /as its third product link, BAR_PRODUCT_LINKS — until HOME-MENU-01, 2026-11-16: since then from its menu's Travel Marketplace column/, /as its third product link, BAR_PRODUCT_LINKS\), but an/],
    [ANCHORS, /SERVICES_ANCHOR the bar's and its section's \(HOME-MENU-01, 2026-11-16: since then MODULES_ANCHOR is read by nothing under src but this file/, null],
    [ANCHORS, /may not retype an id \(until HOME-MENU-01, 2026-11-16: since then its names open the menu/, /may not retype an id\. Until now/],
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
    [GLOBALS, /THE OPEN MENU\. Drawn on the design canvas since HOME-MENU-01 \(2026-11-16\)/, /THE OPEN MENU\. Not drawn on the design canvas: this panel is the proposal\. \*\//],
    [LAW, /LandingHeader carries no link to it\. \(HOME-MENU-01, 2026-11-16, its rulings g and h, beside the 17:04 ruling/, null],
    [LAW, /never a header link\. \(HOME-MENU-01, 2026-11-16, rulings g and h: it is still the door/, null],
    [SEEDS, /HOME-MENU-01, 2026-11-16: since then a second header link, or the header's one link with other words or in another column/, null],
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
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its note re-said, dated`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
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
  ];
  for (const [file, now] of TITLES) assert.ok(code(file).includes(now), `${file}: re-said — "${now.slice(0, 60)}…"`);
  // no cited line moved: the lines a test or a law cites by number, where they stood
  assert.equal(whole(LANDING).split('\n').length - 1, 815, 'Landing.tsx: 815 lines, as it was');
  assert.equal(whole(LAW).split('\n').length - 1, 11254, 'the law: 11,254 lines, as it was (homeTrim02 and homeTrim03 hold it)');
  assert.ok(comments(ANCHORS).split('\n')[27].includes("STOP_ZERO_ANCHOR its section's alone: no link lands on #stop-0 now, and the id stays."), 'homeAnchors.ts:28, which HOME-TRIM-01\'s ruling e cites, where it stood');
  assert.ok(comments(HEADER).split('\n')[52].includes('LANDING-V3 (spec :34-47) → THREE-TRIMS'), 'LandingHeader.tsx:53-54, which Landing.tsx:673 cites, where it stood');
  // ruling k: the 2026-11-14 approvals are named by their times, and their words are quoted in no file of the change that did not quote them
  for (const file of [HEADER, LAW, SEEDS, ANCHORS, FOOTER_WORDS, PIPELINE_WORDS, SERVICES_SECTION, HOW_TO, tests('heroCrest01'), tests('footer01'), tests('footer02'), tests('guest01'), tests('howTo01'), THIS]) {
    for (const words of ['ALL LOOKS GOOD', 'yeet yeet']) assert.ok(!prose(file).includes(words), `${file}: the approvals' words are quoted nowhere new`);
  }
  // EVERY SOURCE FILE OF THE CHANGE: a straight mark followed by twenty or more characters of one of his sentences, from the sentence's start,
  // opens a quote of him — what stands from there to the closing mark is his words from that sentence on, to the end of the piece or to a full
  // stop, or this fails; a whole sentence of his shorter than that is read too, and counted. Each file's count is held. (homeTrim03's census.)
  const CHANGED = [THIS, HEADER, GLOBALS, LANDING, LAW, SEEDS, ANCHORS, FOOTER_WORDS, PIPELINE_WORDS, SERVICES_SECTION, HOW_TO, ...['heroCrest01', 'homePages01', 'footer01', 'footer02', 'howTo01', 'guest01'].map(tests)];
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  const HIS_WORDS = [...Object.values(RULING), ANSWER];
  assert.equal(HIS_WORDS.length, 14);
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
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
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') his = true;
          else if (n >= 20) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where his words go on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(census, {
    [THIS]: 3, // the header: his answer; rulings k and l (T7)
    [HEADER]: 11, // rulings a, b, c, d, e, f, g, h, j and m, and his answer
    [GLOBALS]: 1, // ruling i, over the block
  }, 'each file\'s quotes of him, counted — fifteen in three of the seventeen: a quote that stood and no longer opens on his words leaves its file\'s count, and fails here');
});
