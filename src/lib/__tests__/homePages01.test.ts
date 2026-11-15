/**
 * HOME-PAGES-01 (Alex's brief, 2026-11-14 19:11 Manila; his approval of the boards on the design canvas, 20:01 Manila; his answer to
 * the audit, 2026-11-14) — THREE SECTIONS GET PAGES OF THEIR OWN: /financial-software, /professional-services, /about.
 *
 * The home page is getting shorter in a series of small PRs. This is the first, and it changes nothing on the home page: it gives
 * three sections a second home. Each page is /how-it-works's shell around the section's own component — nothing is redrawn — and
 * its door is the footer's link. What is held here, as pipelinePage01 holds /how-it-works:
 *
 *   T1 the pages — each file is the shell and nothing else: the wrapper, the filled bar, <main>, the section or sections, the
 *      footer, once each and in that order; its imports are a closed list; a server page that exports what a page may; nothing
 *      lives under its route but the page;
 *   T2 the words — each title is its section's heading and the ending PIPELINE_PAGE_TITLE has, from the pages' leaf; each
 *      description is a leaf's own words, imported; the leaf is pure; a page types no word;
 *   T3 the day — /about is force-dynamic and computes the day once, inside its page function, with the front door's own
 *      expression, and hands it to the log; the other two are static; no component the pages mount reads the clock; the build's
 *      trip log law holds the same on its mount line, and its ten seeds are on file;
 *   T4 ruling a's value — one rule, inside the Financial Software port, of one declaration, padding-top: the first value the two
 *      pillars' inner boxes carry; the home page's 12px stands; the hook is worn by the one page's <main> and by nothing else;
 *   T5 the door — a function is drawn as the button it was, a link as a link in the button's class; the two renders are equal
 *      but for the door; the page hands /pricing's own door; no handler on the link;
 *   T6 the footer's doors — the three, from the pages' leaf: Stop 0 to /about with no fragment, the first two pillars to their
 *      pages, Travel Marketplace on /#demo; drawn so; the top bar's three links where they were;
 *   T7 public, with the security review — the three paths in PUBLIC_PATHS directly after '/how-it-works', each with its dated
 *      proof, the root layout's session check named; the middleware lets each through and nothing beside it; in GUEST_ROUTES
 *      on the law's one line, each citing the footer; the Financial Software page on both lists of selling surfaces (PLAN_SURFACES,
 *      which the plan law's clause 1 reads, and SELLING_SURFACES, which the offer law counts); no data path in the pages or in
 *      anything they import, to the end of the closure — and the packages that closure reaches are a closed list of three;
 *   T8 the home page — HOME-TRIM-01 (2026-11-15) changed it: Landing.tsx mounts the bar, the two pillars' sections, the About Us band, Our Story and the footer once each, as typed, and the letter nowhere; it reads nothing of the pages' leaf, which the footer's words, the three pages and that band read. HOME-TRIM-02 (2026-11-15) changed it again: the Financial Software section is mounted with its short view, and reads the leaf for that view's first link. HOME-TRIM-03 (2026-11-15) changed it once more: the Professional Services section is mounted with its short view, and reads the leaf for that view's link. Until then this entry was: the home page does not change — Landing.tsx mounts each of the four sections once, as typed, and reads nothing of the
 *      new leaf, which the footer's words and the three pages alone read. No travel page, then and now;
 *   T9 the rulings — each quoted, dated, where it is built; and in every one of the change's twenty-six files, a quote that follows
 *      a sentence of his for twenty characters is his words from there — whole, or to a full stop — and each file's count of the
 *      quotes read is held. (A new quote that leaves his words sooner opens nothing: T9 says, where it reads, what it does not hold.)
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where a seed's find is held against the whole
 * file, as prove.ts reads it. No clock, no live call. What a browser must show — each page beside the same section on the home
 * page at 1440, 1024 and 390, no sideways scroll from 340px, one request under /api — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { code, comments, rejoin, stripComments } from '../sourceText';
import { middleware } from '../../middleware';
import { ABOUT_US_HEADING, BUILD_PILLAR, PLAN_PILLAR } from '../homeActWords';
import { DEMO_ANCHOR } from '../homeAnchors';
import {
  ABOUT_PATH, ABOUT_TITLE, FINANCIAL_SOFTWARE_PATH, FINANCIAL_SOFTWARE_TITLE, PROFESSIONAL_SERVICES_PATH, PROFESSIONAL_SERVICES_TITLE,
} from '../homePages';
import { FOOTER_SERVICES_LINKS, FOOTER_STOP_ZERO_LABEL, footerStoryLinks } from '../footerWords';
import { EARLY_ACCESS_CTA, PLANS, PLANS_SUBHEAD } from '../offer/plans';
import { STOP_ZERO_STORY } from '../stopZeroWords';
import { WAS_HERE } from '../wasHere';
import HowToSection, { HowToView, type HowToViewProps, type JoinDoor } from '@/components/landing/HowToSection';
import LandingFooter from '@/components/landing/LandingFooter';
import { BAR_PRODUCT_LINKS } from '@/components/landing/LandingHeader';
import { PIPELINE_PAGE_TITLE } from '@/components/landing/pipelineWords';
import { SEEDS as HOME_PAGES_SEEDS } from '../../../scripts/proofs/homepages01.seeds';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const LEAF = 'src/lib/homePages.ts';
const HEADINGS = 'src/lib/homeActWords.ts';
const FOOTER_WORDS = 'src/lib/footerWords.ts';
const ANCHORS = 'src/lib/homeAnchors.ts';
const GLOBALS = 'src/app/globals.css';
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS_FILE = 'scripts/proofs/homepages01.seeds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const FRONT_DOOR = 'src/app/page.tsx';
const HOW_IT_WORKS = 'src/app/how-it-works/page.tsx';
const PRICING_PAGE = 'src/app/pricing/page.tsx';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const FOOTER = 'src/components/landing/LandingFooter.tsx';
const HOW_TO = 'src/components/landing/HowToSection.tsx';
const SERVICES = 'src/components/landing/ServicesSection.tsx';
const ABOUT_US = 'src/components/landing/StopZeroSection.tsx'; const ABOUT_BAND = 'src/components/landing/AboutBand.tsx'; // HOME-TRIM-01 (2026-11-15): the About Us band, the home page's About Us now — a fifth reader of the pages' leaf (T8)
const OUR_STORY = 'src/components/landing/WasHereSection.tsx';
const PLANS_SECTION = 'src/components/offer/PlansSection.tsx';
const SIX_COMPONENTS = [HEADER, FOOTER, HOW_TO, SERVICES, ABOUT_US, OUR_STORY] as const;
const THIS = 'src/lib/__tests__/homePages01.test.ts';
const STOP_ZERO_WORDS = 'src/lib/stopZeroWords.ts';
/** The seven test files whose pins this change moved. Five quote the ruling or the step that moved them; homeAbout01 quotes his answer; intakeForm01 names the brief and quotes nothing. */
const TESTS = {
  footer01: 'src/lib/__tests__/footer01.test.ts', footer02: 'src/lib/__tests__/footer02.test.ts', heroCrest01: 'src/lib/__tests__/heroCrest01.test.ts',
  homePlans04: 'src/lib/__tests__/homePlans04.test.ts', howTo01: 'src/lib/__tests__/howTo01.test.ts', intakeForm01: 'src/lib/__tests__/intakeForm01.test.ts',
  homeAbout01: 'src/lib/__tests__/homeAbout01.test.ts',
} as const;

/** The shell's wrapper, as /how-it-works types it (ruling b). */
const WRAPPER = '<div className="min-h-screen bg-bg-terminal text-text-primary">';
/** The door /pricing hands its plans section, and /financial-software hands the how-to (ruling d). */
const LINK_DOOR_TEXT = "{ kind: 'link', href: '/' }";
const THE_DAY = 'const today = new Date().toISOString().slice(0, 10);';
const FORCE_DYNAMIC = "export const dynamic = 'force-dynamic';";
/** A page function's closing brace as the trip log law reads it: the first closing brace that stands alone at the start of a line. T3 holds this expression on the law's line. */
const CLOSING_BRACE = /\n\}[ \t\r]*(?:\n|$)/;
/** What the law takes for having read past a function closed some other way: a closing brace at a line's start with a semicolon or a word behind it. Held on the law's line too. */
const READ_PAST = /\n\}[ \t]*[;\w$]/;

interface OwnPage {
  /** The page's path, from the pages' leaf. */
  readonly path: string;
  readonly file: string;
  /** The page function's name. */
  readonly fn: string;
  /** <main>, as the page opens it. */
  readonly main: string;
  /** What stands in <main>, in order — each mount whole. */
  readonly mounts: readonly string[];
  /** Every import's path, in the file's order. */
  readonly imports: readonly string[];
  /** The names its metadata reads: the title's, then the description's expression. */
  readonly title: string;
  readonly description: string;
  /** What the file exports, in order. */
  readonly exports: readonly string[];
  /** Every other single-quoted literal in its code, after the imports' paths. */
  readonly literals: readonly string[];
}
const FS: OwnPage = {
  path: FINANCIAL_SOFTWARE_PATH, file: 'src/app/financial-software/page.tsx', fn: 'FinancialSoftwarePage', main: '<main className="ts-fs-page">',
  // HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: the page mounts the section with view="whole". Until then: `<HowToSection onRequireAuth={${LINK_DOOR_TEXT}} />`.
  mounts: [`<HowToSection view="whole" onRequireAuth={${LINK_DOOR_TEXT}} />`],
  imports: ['next', '@/components/landing/LandingHeader', '@/components/landing/LandingFooter', '@/components/landing/HowToSection', '@/lib/homePages', '@/lib/offer/plans'],
  title: 'FINANCIAL_SOFTWARE_TITLE', description: 'PLANS_SUBHEAD', exports: ['metadata', 'FinancialSoftwarePage'], literals: ['link', '/'],
};
const PS: OwnPage = {
  path: PROFESSIONAL_SERVICES_PATH, file: 'src/app/professional-services/page.tsx', fn: 'ProfessionalServicesPage', main: '<main>',
  mounts: ['<ServicesSection view="whole" />'], // HOME-TRIM-03 (2026-11-15), ruling a: the page mounts the section with view="whole" — '<ServicesSection />' until then
  imports: ['next', '@/components/landing/LandingHeader', '@/components/landing/LandingFooter', '@/components/landing/ServicesSection', '@/lib/homeActWords', '@/lib/homePages'],
  title: 'PROFESSIONAL_SERVICES_TITLE', description: 'BUILD_PILLAR.paragraphs[0]', exports: ['metadata', 'ProfessionalServicesPage'], literals: [],
};
const ABOUT: OwnPage = {
  path: ABOUT_PATH, file: 'src/app/about/page.tsx', fn: 'AboutPage', main: '<main>',
  mounts: ['<StopZeroSection />', '<WasHereSection today={today} />'],
  imports: ['next', '@/components/landing/LandingHeader', '@/components/landing/LandingFooter', '@/components/landing/StopZeroSection', '@/components/landing/WasHereSection', '@/lib/homePages', '@/lib/stopZeroWords'],
  title: 'ABOUT_TITLE', description: 'STOP_ZERO_STORY[0].quote', exports: ['dynamic', 'metadata', 'AboutPage'], literals: ['force-dynamic'],
};
const PAGES = [FS, PS, ABOUT] as const;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** A file's comments as running prose: each line's comment leader dropped, whitespace collapsed (homePlans04's `said`). */
const said = (file: string): string => flat(comments(file).replace(/^\s*(\*|\/\/)/gm, ' '));
/** A whole file, through the reader: the two halves put back together are the file (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
/** React's escaping of text. */
const asHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
/** Every .ts / .tsx file under src that is not a test. */
const srcFiles = (dir = 'src'): string[] => readdirSync(resolve(ROOT, dir)).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(resolve(ROOT, rel)).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.tsx?$/.test(name) ? [rel] : [];
});

/**
 * A stylesheet (its comments already removed by code()) as one line per declaration, in order:
 * "<media> | <selector> | <property>: <value>", whitespace collapsed — homePlans04's own reading of globals.css.
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
/** A value's parts at its top level: clamp(52px, 6.2vw, 88px) is one part, not three (tripCards03's own). */
function valuesOf(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (part !== '') parts.push(part);
      part = '';
    } else part += ch;
  }
  if (part !== '') parts.push(part);
  return parts;
}
/** Every element a tree draws, its components called through — to read a drawn element's own props (homePlans04's own). */
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}

/** The file an import names, when it is one of this repo's under src — null for a package. A path that names no file fails by name. */
function fileOf(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (base === null) return null;
  const found = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].filter((f) => existsSync(resolve(ROOT, f)) && statSync(resolve(ROOT, f)).isFile());
  assert.equal(found.length, 1, `${from}: "${spec}" names one file under src (found ${JSON.stringify(found)})`);
  return found[0];
}
/**
 * Every module a file's code names, as TypeScript's own PARSER reads the file (ts.createSourceFile): each import declaration and each
 * `export … from` — a namespace re-export too — wherever it stands on a line (this repo writes a second import on a line: Landing.tsx's
 * StopZeroSection), import-equals, an import type, each import() call, and each call of require or of a property named require. Text inside
 * a string, a template literal, a regex literal or JSX text is not an import (the tool registry's citations hold a `from "…"`). Such a call
 * that names its module by anything but a literal names none this reader can follow: it is returned as NOT_A_LITERAL, and the closed list of
 * packages then refuses it by name. NOT READ: a require reached under another name (`const r = require; r('x')`), which only a deliberate edit
 * writes. T7 holds the shapes. (Until the second review of HOME-PAGES-01, 2026-11-14, this was four patterns of the test's own, which read a
 * statement only where it started a line; then, until the third review, TypeScript's scanner ts.preProcessFile, which did not read
 * `export * as ns from`.)
 */
const NOT_A_LITERAL = '(a module named by something that is not a literal)';
function specsOf(src: string, file: string): string[] {
  const tree = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const specs: string[] = [];
  const named = (node: ts.Node | undefined): void => {
    if (node !== undefined) specs.push(ts.isStringLiteralLike(node) ? node.text : NOT_A_LITERAL);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) named(node.moduleSpecifier);
    else if (ts.isExportDeclaration(node)) named(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) named(node.moduleReference.expression);
    else if (ts.isImportTypeNode(node)) named(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require') || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'require'))) named(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return specs;
}
/** Everything a set of files imports, and what those import, to the end: the files under src, and the packages they reach outside it. */
function closureOf(entries: readonly string[]): { files: string[]; packages: string[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specsOf(code(file), file)) {
      const next = fileOf(file, spec);
      if (next === null) packages.add(spec);
      else queue.push(next);
    }
  }
  return { files: [...seen].sort(), packages: [...packages].sort() };
}

// ── THE BRIEF'S RULINGS AND ALEX'S ANSWER, EXACT ─────────────────────────────

const RULING = {
  a: 'NOTHING IS REDRAWN. Each page mounts the section\'s own component: no copy, no second stylesheet. One value is new. On /financial-software the section\'s inner top padding is clamp(44px, 5.6vw, 80px), the value .ts-ps__inner and .ts-tm__inner carry, where the home page has 12px under the What We Do box. The page draws no "What We Do".',
  b: 'THE SHELL is /how-it-works\'s: the min-h-screen wrapper, <LandingHeader /> filled, <main>, <LandingFooter />.',
  c: 'WORDS. Nothing is typed in a page. Three titles are new and need a leaf: each is the section\'s heading, then " | Temple Stuart", as PIPELINE_PAGE_TITLE ends. Descriptions are words that exist: PLANS_SUBHEAD, BUILD_PILLAR.paragraphs[0], and for /about the first quote of STOP_ZERO_STORY as its leaf writes it.',
  d: 'THE JOIN BUTTON on /financial-software is /pricing\'s door: a link to the front door (PlansSection.tsx: "The door is the caller\'s: /pricing hands a link, the home page a button that opens sign-up."). No second sign-up modal and no new auth code.',
  e: 'THE DAY. /about computes it once per request, on the server, with the front door\'s own expression, and hands it to WasHereSection. No component reads the clock.',
  f: 'PUBLIC. The three paths join PUBLIC_PATHS, each with a dated note and its proof, as /how-it-works\'s entry gives one: no route handler under it, no fetch, no paid call, no database read, no session read. They join GUEST_ROUTES, each citing its real door from step 4. This is the HARD GATE: put the three proofs in the audit report, then proceed on this ruling.',
  g: 'NO TRAVEL PAGE. /travel is the cockpit\'s (src/app/[tab]/page.tsx TAB_PATHS). The booking box and the lookup stay mounted where the guest law holds them.',
  h: 'THE HOME PAGE DOES NOT CHANGE. Landing.tsx keeps every mount where it is, once each. The only thing a visitor to / can notice is three footer links\' targets.',
} as const;
/** The brief's step 4, as he wrote it — one of its three targets changed with his answer. */
const STEP_4 = 'The footer\'s doors to them: Financial Software → /financial-software, Professional Services → /professional-services, and Stop 0 | Los Angeles → /about#stop-0. Travel Marketplace stays /#demo.';
/** Alex's answer to the audit, 2026-11-14 — the pieces this change quotes. */
const ANSWER = {
  session: 'signed out, each of the three pages makes exactly one request under /api, the root layout\'s GET /api/auth/session, and none to another origin.',
  noFragment: 'The footer\'s Stop 0 | Los Angeles goes to /about, with no fragment. This replaces "/about#stop-0" in step 4. The letter is the first thing on that page, so the fragment only scrolled the bar away. No scroll margin is added and the About Us port is not touched.',
  theHref: 'The href is the leaf\'s /about path. footerWords.ts builds nothing from STOP_ZERO_ANCHOR for it; if that leaves the import unread there, it goes.',
  // item 5, whole: what he said to build as the audit reported it — the one piece of it this test holds by quoting it is the two lists of selling surfaces
  asAudited: 'EVERYTHING ELSE: build it as the audit reports it, sections 1 to 10. That includes src/lib/homePages.ts for the paths and titles; force-dynamic on /about and the clause on :729 with its seeds; JoinDoor under onRequireAuth with the link arm to /; the one padding-top rule inside the port, named as T3\'s sixth difference; the page on PLAN_SURFACES and SELLING_SURFACES; the three GUEST_ROUTES entries on law line 225; the three PUBLIC_PATHS entries directly after \'/how-it-works\'; the /f sentences and intakeForm01:527 re-said, dated; the stale sentences re-said in place; npx tsc --noEmit by hand.',
} as const;
/** The brief's list of what this PR leaves alone, under its heading. */
const NOT_IN_THIS_PR_HEADING = 'NOT IN THIS PR';
const NOT_IN_THIS_PR = 'Landing.tsx and every section\'s markup and look. The top bar and its links. /pricing, /work-with-me, /booking/manage, /my-trip. Any trim, any new sentence, any dependency, any analytics. The top bar\'s menu.';
/** Two of his four beta users' notes, as he pasted them, and his approval of the boards. */
const BETA_NOTES = ['Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages', 'It\'s a lot on one page though. Any way you can split it out'] as const;
const APPROVAL = 'ALL LOOKS GOOD … OTHERWISE, LETS DO IT';

// ── T1 · THE PAGES ───────────────────────────────────────────────────────────

test('T1 each page is /how-it-works\'s shell around the section\'s own component and nothing else: the wrapper, the filled bar, <main>, the section or sections, the footer, once each and in order; a closed list of imports; a server page that exports what a page may; nothing under its route but the page', () => {
  // the shell is /how-it-works's own (ruling b): its wrapper, the bar with nothing passed, <main>, the footer with nothing passed
  const model = code(HOW_IT_WORKS);
  for (const part of [WRAPPER, '<LandingHeader />', '<LandingFooter />']) assert.equal(count(model, part), 1, `/how-it-works has ${part} once`);
  assert.equal(count(model, '<main '), 1, '/how-it-works has one <main>');
  for (const page of PAGES) {
    const src = code(page.file);
    // the page function, whole: the shell, the page's own mounts in <main>, and nothing else — no state, no effect, no word
    const drawn = [
      `export default function ${page.fn}() {`,
      ...(page === ABOUT ? [`  ${THE_DAY}`] : []),
      '  return (',
      `    ${WRAPPER}`,
      '      <LandingHeader />',
      `      ${page.main}`,
      ...page.mounts.map((m) => `        ${m}`),
      '      </main>',
      '      <LandingFooter />',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    assert.equal(src.slice(src.indexOf(`export default function ${page.fn}(`)).trim(), drawn, `${page.file}: the page function, whole, ends the file — the shell and its own mounts`);
    // nothing else is mounted: every component and every element the file draws
    assert.deepEqual([...src.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]), ['LandingHeader', ...page.mounts.map((m) => (/^<(\w+)/.exec(m) as RegExpExecArray)[1]), 'LandingFooter'], `${page.file}: the bar, its section(s), the footer — and no other component`);
    assert.deepEqual([...src.matchAll(/<([a-z]\w*)/g)].map((m) => m[1]), ['div', 'main'], `${page.file}: the wrapper and <main> — and no other element`);
    // a closed list of imports, each on a line of its own; the bar and the footer under their own names
    assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), page.imports, `${page.file}: its imports`);
    assert.equal(count(src, 'import '), page.imports.length, `${page.file}: and no import beyond them`);
    assert.match(src, /^import type \{ Metadata \} from 'next';$/m, `${page.file}: from Next, a type alone`);
    assert.match(src, /^import LandingHeader from '@\/components\/landing\/LandingHeader';$/m);
    assert.match(src, /^import LandingFooter from '@\/components\/landing\/LandingFooter';$/m);
    // a server page: no directive, no hook, no handler — and it exports only what a page file may (the build's type pass refuses any other)
    assert.doesNotMatch(src, /['"]use (client|server)['"]/, `${page.file}: no directive`);
    assert.doesNotMatch(src, /\buse[A-Z]\w*\(|=>|\basync\b|\bawait\b/, `${page.file}: no hook, no arrow function, nothing awaited`);
    assert.equal(count(src, 'function '), 1, `${page.file}: one function — the page`);
    assert.deepEqual([...src.matchAll(/^export (?:const|default function|function|type|interface|class|enum|let|var) (\w+)/gm)].map((m) => m[1]), page.exports, `${page.file}: its exports`);
    assert.equal(count(src, 'export '), page.exports.length, `${page.file}: and no other export`);
    // nothing lives under the route but the page, and no route handler answers at its path
    const folder = page.file.slice(0, -'/page.tsx'.length);
    assert.equal(`/${folder.slice('src/app/'.length)}`, page.path, `${page.file} is the page at ${page.path}`);
    assert.deepEqual(readdirSync(resolve(ROOT, folder)), ['page.tsx'], `${folder}: no route handler, no layout — the page alone`);
    assert.ok(!existsSync(resolve(ROOT, 'src/app/api', folder.slice('src/app/'.length))), `no src/app/api${page.path}`);
  }
});

// ── T2 · THE WORDS ───────────────────────────────────────────────────────────

test('T2 each title is its section\'s heading and the ending PIPELINE_PAGE_TITLE has, from the pages\' leaf; each description is a leaf\'s own words, imported; the leaf is pure and holds no description; a page types no word', () => {
  // ruling c: the section's heading, then " | Temple Stuart", as PIPELINE_PAGE_TITLE ends
  const END = ' | Temple Stuart';
  assert.ok(PIPELINE_PAGE_TITLE.endsWith(END), 'the ending is /how-it-works\'s own');
  assert.deepEqual([FINANCIAL_SOFTWARE_TITLE, PROFESSIONAL_SERVICES_TITLE, ABOUT_TITLE], [`${PLAN_PILLAR.heading}${END}`, `${BUILD_PILLAR.heading}${END}`, `${ABOUT_US_HEADING}${END}`], 'each is its section\'s heading, then the ending');
  assert.deepEqual([FINANCIAL_SOFTWARE_TITLE, PROFESSIONAL_SERVICES_TITLE, ABOUT_TITLE], ['Financial Software | Temple Stuart', 'Professional Services | Temple Stuart', 'About Us | Temple Stuart']);
  assert.deepEqual([FINANCIAL_SOFTWARE_PATH, PROFESSIONAL_SERVICES_PATH, ABOUT_PATH], ['/financial-software', '/professional-services', '/about']);
  // the leaf: pure, one import — the headings' leaf, which imports nothing — the ending typed once, no heading retyped, no description
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /['"]use (client|server)['"]/, 'the leaf: no directive — a server page and the footer read it');
  assert.deepEqual([...leaf.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./homeActWords'], 'one import: the headings');
  assert.equal(count(leaf, 'import '), 1);
  assert.doesNotMatch(code(HEADINGS), /^import |['"]use client['"]/m, 'which imports nothing and carries no directive');
  assert.equal(count(leaf, "' | Temple Stuart'"), 1, 'the ending, typed once');
  for (const heading of [PLAN_PILLAR.heading, BUILD_PILLAR.heading, ABOUT_US_HEADING]) assert.ok(!leaf.includes(heading), `"${heading}" is not retyped in the leaf`);
  // what the leaf exports, as TypeScript's parser reads its statements: six constants, one name to a statement — no function, no type, no default, no re-export
  const leafTree = ts.createSourceFile(LEAF, leaf, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const exported = leafTree.statements.flatMap((statement): string[] => {
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) return ['(a re-export or a default)'];
    if (!ts.canHaveModifiers(statement) || !(ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    if (!ts.isVariableStatement(statement)) return ['(an export that is not a constant)'];
    return [`${(statement.declarationList.flags & ts.NodeFlags.Const) !== 0 ? 'const' : 'not const'} ${statement.declarationList.declarations.map((declaration) => declaration.name.getText(leafTree)).join(', ')}`];
  });
  assert.deepEqual(exported, ['FINANCIAL_SOFTWARE_PATH', 'PROFESSIONAL_SERVICES_PATH', 'ABOUT_PATH', 'FINANCIAL_SOFTWARE_TITLE', 'PROFESSIONAL_SERVICES_TITLE', 'ABOUT_TITLE'].map((name) => `const ${name}`), 'three paths and three titles, each a constant of its own statement, and nothing else exported in any form — no description: each page imports its own from the leaf that holds it');
  assert.equal((leaf.match(/\bexport\b/g) ?? []).length, 6, 'and the word export stands six times in its code');
  assert.doesNotMatch(leaf, /new Date\(|Date\.now\(|\bfetch\s*\(|process\.env/, 'no clock, no fetch, no env');
  // each description is words that exist, where they exist
  assert.equal(PLANS_SUBHEAD, 'Everyone gets Personal. Add a business, a trading book, or both.');
  assert.equal(BUILD_PILLAR.paragraphs[0], 'Hands-on services, tailored to your needs.');
  assert.equal(STOP_ZERO_STORY[0].quote, '“Everyone was showing me the life they were living. I wanted to understand how to build one of my own.”', 'the first quote, as its leaf writes it: inside its two curly marks');
  for (const page of PAGES) {
    const src = code(page.file);
    assert.ok(src.includes(`export const metadata: Metadata = {\n  title: ${page.title},\n  description: ${page.description},\n};`), `${page.file}: its title and description, each read from a leaf`);
    // a page types no word: its single-quoted literals are its imports' paths and what its shell needs; its double-quoted ones are classes
    assert.deepEqual([...src.matchAll(/'([^']*)'/g)].map((m) => m[1]), [...page.imports, ...page.literals], `${page.file}: its single-quoted literals — its imports' paths, and ${page.literals.length === 0 ? 'no other' : page.literals.map((l) => `'${l}'`).join(', ')}`);
    // HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: the Financial Software page's third, 'whole', is the view it hands the section, and no word a visitor reads.
    // Until then its two classes alone: ['min-h-screen bg-bg-terminal text-text-primary', 'ts-fs-page']. HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: the Professional Services page's second, 'whole', is the view it hands the section, likewise — its one class alone until then: ['min-h-screen bg-bg-terminal text-text-primary'].
    assert.deepEqual([...src.matchAll(/"([^"]*)"/g)].map((m) => m[1]), page === FS ? ['min-h-screen bg-bg-terminal text-text-primary', 'ts-fs-page', 'whole'] : page === PS ? ['min-h-screen bg-bg-terminal text-text-primary', 'whole'] : ['min-h-screen bg-bg-terminal text-text-primary'], `${page.file}: its double-quoted literals are classes${page === FS || page === PS ? ', and the view it hands the section' : ''}`);
    assert.equal(count(src, '`'), 0, `${page.file}: no template literal, where a typed word could hide`);
    assert.deepEqual([...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-z0-9]/.test(t)), [], `${page.file}: no text typed between its tags`);
  }
});

// ── T3 · THE DAY ─────────────────────────────────────────────────────────────

test('T3 /about is force-dynamic and computes the day once, inside its page function, with the front door\'s own expression, and hands it to the log; the other two pages are static; nothing the pages mount reads the clock; the trip log law holds the same on its mount line, and its ten seeds are on file', () => {
  // ruling e: the front door's own two lines
  const door = code(FRONT_DOOR);
  assert.equal(count(door, FORCE_DYNAMIC), 1, 'the front door is rendered per request');
  assert.equal(count(door, THE_DAY), 1, 'and computes the day so');
  const about = code(ABOUT.file);
  assert.equal(count(about, FORCE_DYNAMIC), 1, '/about is rendered per request: without it Next draws the page once, at build, and the day is the deploy\'s');
  const at = about.indexOf(`export default function ${ABOUT.fn}() {`);
  assert.ok(at > about.indexOf(FORCE_DYNAMIC) && about.indexOf(FORCE_DYNAMIC) > -1, 'the export stands at the module\'s top, above the page');
  // the page function is from its opening to its OWN closing brace — the first closing brace alone at the start of a line, as the law reads it — and the file ends there
  const end = at < 0 ? -1 : at + about.slice(at).search(CLOSING_BRACE);
  assert.ok(at > -1 && end > at, 'the page function, from its opening to its closing brace');
  assert.equal(about.slice(end).trim(), '}', 'nothing stands under the page function');
  assert.equal(count(about.slice(at, end), THE_DAY), 1, 'the day, with the front door\'s expression, inside the page function: once per request');
  assert.equal(count(about, THE_DAY), 1, 'and nowhere else in the file');
  assert.equal(count(about.slice(0, at), 'today') + count(about.slice(end), 'today'), 0, 'not at the module\'s top, above the function or below it, where it would be computed once per server instance');
  assert.equal(count(about, 'new Date('), 1, 'the clock is read once');
  assert.doesNotMatch(about, /Date\.now\(|performance\.now\(|toLocale/, 'and no other way');
  assert.equal(count(about, '<WasHereSection today={today} />'), 1, 'the log is handed the day the page computed');
  assert.equal(count(about, '<WasHereSection'), 1, 'and it is mounted once in all: no second mount, whatever it is handed');
  assert.doesNotMatch(about, /\bcookies\(|\bheaders\(|searchParams|generateMetadata|revalidate/, 'force-dynamic is its one reason to render per request: no cookie, no header, no query read');
  // the other two are static server pages, as /how-it-works is
  for (const page of [FS, PS]) assert.doesNotMatch(code(page.file), /generateMetadata|dynamic\s*=|revalidate|new Date\(|Date\.now\(|\bcookies\(|\bheaders\(/, `${page.file}: a static server page`);
  // "No component reads the clock."
  for (const f of SIX_COMPONENTS) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(/, `${f} reads no clock`);
  // the build's law holds it too — on the line that holds the landing's own mount to one (`if (logMounts !== 1)`), so no line of the law file moved
  const lawLine = code(LAW).split('\n').filter((l) => l.includes('if (logMounts !== 1) violations.push('));
  assert.equal(lawLine.length, 1, 'the trip log law\'s mount line');
  // the clause, WHOLE — the last code on that line, from its opening brace to its closing one. One text, so nothing can stand in a gap between two
  // checks, or in front of the block, and switch a check off under words that still read right
  const CLAUSE = [
    "{ const about = codeOf('src/app/about/page.tsx');",
    "const aboutAt = about.search(/^export default (?:async )?function /m);",
    "const aboutClose = aboutAt < 0 ? -1 : about.slice(aboutAt).search(/\\n\\}[ \\t\\r]*(?:\\n|$)/);",
    "const aboutEnd = aboutClose < 0 ? -1 : aboutAt + aboutClose;",
    "const aboutPage = aboutEnd < 0 ? '' : about.slice(aboutAt, aboutEnd);",
    "if (aboutEnd < 0 || /\\n\\}[ \\t]*[;\\w$]/.test(aboutPage)) violations.push('was here: src/app/about/page.tsx has no page function the law can read — export default function, closed by a brace alone at the start of its line (HOME-PAGES-01)');",
    "const aboutMounts = (about.match(/<WasHereSection today=\\{today\\} \\/>/g) ?? []).length;",
    "const aboutLogs = (about.match(/<WasHereSection\\b/g) ?? []).length;",
    "if (!about.includes(\"export const dynamic = 'force-dynamic';\")) violations.push('was here: src/app/about/page.tsx does not export dynamic = force-dynamic — a static /about keeps the day of its build, and every stop\\u2019s I\\u2019M HERE with it (HOME-PAGES-01)');",
    "if ((aboutPage.match(/const today = new Date\\(\\)\\.toISOString\\(\\)\\.slice\\(0, 10\\);/g) ?? []).length !== 1 || (about.match(/new Date\\(|Date\\.now\\(/g) ?? []).length !== 1) violations.push('was here: src/app/about/page.tsx does not compute today once, inside its page function, as new Date().toISOString().slice(0, 10) — the front door\\u2019s own expression (HOME-PAGES-01)');",
    "if (aboutMounts !== 1 || aboutLogs !== 1) violations.push(`was here: src/app/about/page.tsx mounts <WasHereSection today={today} /> ${aboutMounts} time(s) and the log ${aboutLogs} time(s) in all — exactly once, with the day the page computed (HOME-PAGES-01)`);",
    "}",
  ].join(' ');
  const clauseAt = lawLine[0].indexOf("{ const about = codeOf('src/app/about/page.tsx');");
  assert.equal(lawLine[0].slice(clauseAt).trimEnd(), CLAUSE, 'the /about clause, whole, and the last code on the line');
  assert.equal(lawLine[0].slice(clauseAt - 5, clauseAt), ')`); ', 'it stands directly behind the landing\'s own check: nothing in front of it');
  assert.ok(CLAUSE.includes(`about.slice(aboutAt).search(${CLOSING_BRACE})`), 'the page function is read to its closing brace by the expression this test reads it with');
  assert.ok(CLAUSE.includes(`if (aboutEnd < 0 || ${READ_PAST}.test(aboutPage)) violations.push(`), 'and a reading that ran past a function closed some other way is refused by the expression this test holds');
  assert.ok(CLAUSE.includes(`if (!about.includes("${FORCE_DYNAMIC}"))`), 'and force-dynamic by the export this test holds');
  assert.equal(count(code(LAW), "codeOf('src/app/about/page.tsx')"), 1, 'the law reads the page once');
  // what that reading is for: a signature closed over several lines, as the front door's is, puts a brace at a line's start above the body — and it is not the function's end
  const wide = about.replace(`export default function ${ABOUT.fn}() {`, `export default async function ${ABOUT.fn}({ searchParams }: {\n  searchParams: Promise<Record<string, string>>;\n}) {`);
  const wideAt = wide.search(/^export default (?:async )?function /m);
  assert.ok(wideAt > -1 && wide !== about, '(a check that the wider signature was written)');
  assert.equal(count(wide.slice(wideAt, wideAt + wide.slice(wideAt).search(CLOSING_BRACE)), THE_DAY), 1, 'under the front door\'s signature — closed by a brace and a parenthesis on one line — the day is still read inside the page function');
  assert.equal(count(wide.slice(wideAt, wide.indexOf('\n}', wideAt)), THE_DAY), 0, 'which the first brace at a line\'s start, whatever follows it, would not: it stops at the signature, above the day');
  assert.ok(!READ_PAST.test(wide.slice(wideAt, wideAt + wide.slice(wideAt).search(CLOSING_BRACE))), 'and that signature\'s own closing — a brace, then a parenthesis — is not taken for a function closed some other way');
  // and its ten seeds are on file, each changing the one page in one place
  assert.equal(HOME_PAGES_SEEDS.length, 10, 'ten seeds (the file is on file: this test imports it)');
  assert.deepEqual(HOME_PAGES_SEEDS.map((s) => s.name.slice(0, 'homepages01-a'.length)), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((letter) => `homepages01-${letter}`));
  for (const seed of HOME_PAGES_SEEDS) {
    assert.equal(seed.file, ABOUT.file, `${seed.name}: it changes the /about page`);
    assert.equal(count(whole(seed.file), seed.find), 1, `${seed.name}: its find occurs once`);
    assert.notEqual(seed.find, seed.replace, `${seed.name}: it changes something`);
  }
  assert.equal(new Set(HOME_PAGES_SEEDS.map((s) => s.replace)).size, 10, 'ten different regressions');
  // WHAT THE CLAUSE WOULD SAY of a page's text: this test's own reading of the clause above, check for check — in the clause's own four sentences,
  // lifted from it and not retyped, each \u escape read so they stand as the law prints them — and over the code alone, comments removed as the
  // law's codeOf removes them. A build runs no seed (prove.ts is run by hand), so this is where each seed is held: what the clause raises of the
  // seeded page, and its expect, which must open exactly ONE of the four sentences as the law would print them of that page, counts included —
  // the sentence of the check the seed is for. An empty expect, or an opening the four share, opens all four and fails.
  const sentences = [...CLAUSE.matchAll(/violations\.push\((['`])(.*?)\1\);/g)].map((m) => m[2].replace(/\\u([0-9a-f]{4})/gi, (_escape, hex: string) => String.fromCharCode(parseInt(hex, 16))));
  assert.equal(sentences.length, 4, 'the clause raises four sentences');
  for (const sentence of sentences) assert.ok(!sentence.includes('\\'), 'each read as it is printed: no escape is left in it');
  assert.ok(sentences[0].includes('has no page function') && sentences[1].includes('force-dynamic') && sentences[1].includes('stop’s I’M HERE') && sentences[2].includes('does not compute today once') && sentences[3].includes('${aboutMounts} time(s) and the log ${aboutLogs} time(s)'), '(a check that the four were lifted in the clause\'s order, and read as printed)');
  const CHECKS = ['function', 'request', 'day', 'mount'] as const;
  type Check = typeof CHECKS[number];
  const lawSays = (text: string): { would: Record<Check, string>; raises: Check[] } => {
    const src = stripComments(text);
    const from = src.search(/^export default (?:async )?function /m);
    const close = from < 0 ? -1 : src.slice(from).search(CLOSING_BRACE);
    const page = close < 0 ? '' : src.slice(from, from + close);
    const mounts = count(src, '<WasHereSection today={today} />');
    const logs = (src.match(/<WasHereSection\b/g) ?? []).length;
    const raised: Record<Check, boolean> = {
      function: close < 0 || READ_PAST.test(page),
      request: !src.includes(FORCE_DYNAMIC),
      day: count(page, THE_DAY) !== 1 || count(src, 'new Date(') + count(src, 'Date.now(') !== 1,
      mount: mounts !== 1 || logs !== 1,
    };
    return {
      would: { function: sentences[0], request: sentences[1], day: sentences[2], mount: sentences[3].replace('${aboutMounts}', String(mounts)).replace('${aboutLogs}', String(logs)) },
      raises: CHECKS.filter((check) => raised[check]),
    };
  };
  assert.deepEqual(lawSays(whole(ABOUT.file)).raises, [], 'of the page as it stands the clause says nothing');
  // each seed: every sentence the clause raises of its page, the first being the check the seed is for
  const SEEDED: Record<string, readonly Check[]> = { a: ['request'], b: ['day'], c: ['day'], d: ['day'], e: ['mount'], f: ['day'], g: ['day'], h: ['mount'], i: ['function', 'day'], j: ['function'] };
  for (const seed of HOME_PAGES_SEEDS) {
    // the seed applied as prove.ts applies it: one exact replacement in the whole file
    const { would, raises } = lawSays(whole(seed.file).replace(seed.find, seed.replace));
    const expected = SEEDED[seed.name.slice('homepages01-'.length, 'homepages01-a'.length)];
    assert.deepEqual(raises, expected, `${seed.name}: what the clause raises of the seeded page`);
    assert.deepEqual(CHECKS.filter((check) => would[check].startsWith(seed.expect)), [expected[0]], `${seed.name}: its expect ("${seed.expect.slice(0, 70)}…") opens one of the clause's four sentences as the law would print them of that page — the one the seed is for`);
  }
  // what the second condition is for, beyond seed j (where the day stays inside the function): a page function closed by a brace and a semicolon,
  // the day at the module's top under it, a helper below. The reading runs past the function's end to the helper's brace and finds the day inside
  // it — so the clause refuses the page by name, as one it cannot read
  const page = whole(ABOUT.file);
  assert.equal(count(page, `  ${THE_DAY}\n`), 1);
  assert.ok(page.endsWith('  );\n}\n'), '(the page ends with its function\'s closing brace)');
  const closedAnotherWay = `${page.replace(`  ${THE_DAY}\n`, '').slice(0, -'}\n'.length)}};\n\n${THE_DAY}\n\nfunction helper(): number {\n  return 1;\n}\n`;
  assert.deepEqual(lawSays(closedAnotherWay).raises, ['function'], 'a function closed some other way and read past: refused by the first sentence, though the day check alone would pass it');
});

// ── T4 · RULING A'S ONE VALUE ────────────────────────────────────────────────

test('T4 ruling a\'s one value: one rule inside the Financial Software port, of one declaration — padding-top, the first value the two pillars\' inner boxes carry; the home page\'s 12px stands; the hook is worn by the one page\'s <main> and by nothing else', () => {
  const css = code(GLOBALS);
  const all = declarations(css);
  const VALUE = 'clamp(44px, 5.6vw, 80px)';
  const RULE = '.ts-fs-page .ts-fs__inner';
  const ofRule = (selector: string): string[] => all.filter((d) => d.split(' | ')[1] === selector).map((d) => `${d.split(' | ')[0]} | ${d.split(' | ')[2]}`);
  // the one rule: one declaration, outside any @media, and it is padding-top alone — a shorthand would take the sides too, and lose the 32px gutter from 1024px
  assert.deepEqual(ofRule(RULE), [` | padding-top: ${VALUE}`], 'one rule, one declaration: the top padding');
  assert.deepEqual([...new Set(all.map((d) => d.split(' | ')[1]).filter((sel) => sel.includes('ts-fs-page')))], [RULE], 'the hook is named by that one selector, and no other');
  assert.equal(count(css, 'ts-fs-page'), 1, 'and typed once in the stylesheet');
  // the value is the pillars' own: the first value of the Professional Services and the Travel Marketplace inner boxes' padding
  const paddingOf = (selector: string): string[] => {
    const own = ofRule(selector).filter((d) => d.startsWith(' | padding:'));
    assert.equal(own.length, 1, `${selector} declares its padding once, outside any @media`);
    return valuesOf(own[0].slice(' | padding:'.length).trim());
  };
  assert.equal(paddingOf('.ts-ps__inner')[0], VALUE, '.ts-ps__inner\'s top padding');
  assert.equal(paddingOf('.ts-tm__inner')[0], VALUE, '.ts-tm__inner\'s top padding');
  // the home page's rule stands as it was: 12px under the What We Do box, 16px at the sides, and 32px from 1024px — which the page's rule leaves alone
  assert.deepEqual(paddingOf('.ts-fs__inner'), ['12px', '16px', 'clamp(52px, 6.2vw, 88px)'], 'the home page\'s inner box: 12px on top, as the reference has it');
  assert.ok(all.includes('@media (min-width: 1024px) | .ts-fs-heading, .ts-fs__inner | padding-inline: 32px'), 'the side gutter from 1024px is the port\'s own rule');
  // where it stands: inside the port, directly after the inner box's own rule
  const at = all.indexOf(` | ${RULE} | padding-top: ${VALUE}`);
  assert.equal(all[at - 1], ' | .ts-fs__inner | padding: 12px 16px clamp(52px, 6.2vw, 88px)', 'directly after the inner box\'s own padding');
  const ruleAt = css.indexOf(`${RULE} {`);
  assert.ok(ruleAt > css.indexOf('.ts-fs-heading {') && ruleAt < css.indexOf('.ts-ft {'), 'between the port\'s first rule and the footer\'s block');
  // who wears the hook: the Financial Software page's <main>, once — nothing on the home page, no component, no other page
  assert.deepEqual(srcFiles().filter((f) => code(f).includes('ts-fs-page')), [FS.file], 'one file under src wears the hook');
  assert.equal(count(code(FS.file), 'ts-fs-page'), 1);
  assert.equal(count(code(FS.file), '<main className="ts-fs-page">'), 1, 'on <main>');
  // HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling b: the short view's section has its own inner box, as its reference draws it — written once in each view, and
  // neither wears the hook. Until then: 1, 'and the inner box is the section's own, as it was'.
  assert.equal(count(code(HOW_TO), 'className="ts-fs__inner"'), 2, 'and the inner box is the section\'s own, as it was — one in each view');
  // the page draws no "What We Do": the box over the section on the home page is Landing.tsx's, and no page mounts or types it
  assert.equal(count(code(LANDING), 'className="ts-fs-heading"'), 1, 'the What We Do box is the landing\'s');
  for (const page of PAGES) assert.doesNotMatch(code(page.file), /ts-fs-heading|WHAT_WE_DO_HEADING|What We Do/, `${page.file} draws no "What We Do"`);
});

// ── T5 · THE DOOR ────────────────────────────────────────────────────────────

test('T5 the door: a function is drawn as the button it was, a link as a link in the button\'s class; the two renders are equal but for the door, in all four states; the page hands /pricing\'s own door; the link carries no handler', () => {
  const link: JoinDoor = { kind: 'link', href: '/' };
  const noop = (): void => {};
  const STATES = [{ business: false, trade: false }, { business: true, trade: false }, { business: false, trade: true }, { business: true, trade: true }];
  const render = (run: { business: boolean; trade: boolean }, onJoin: JoinDoor): string => renderToStaticMarkup(React.createElement(HowToView, { ...run, onBusiness: noop, onTrade: noop, onJoin }));
  const asButton = `<button class="ts-fs-plan__cta" type="button">${asHtml(EARLY_ACCESS_CTA)}</button>`;
  const asLink = `<a class="ts-fs-plan__cta" href="/">${asHtml(EARLY_ACCESS_CTA)}</a>`;
  for (const run of STATES) {
    const name = `${run.business ? 'B' : '-'}${run.trade ? 'T' : '-'}`;
    const home = render(run, noop);
    const page = render(run, link);
    assert.equal(count(home, asButton), PLANS.length, `${name}, a function: a button per plan, as it was`);
    assert.equal(count(home, '<a '), 1, `${name}, a function: the one link, the compare link`);
    assert.equal(count(page, asLink), PLANS.length, `${name}, a link: a link per plan, in the button's own class, its words the plan's`);
    assert.equal(count(page, '<button'), 2, `${name}, a link: the two switches are the only buttons`);
    assert.equal(count(page, '<a '), PLANS.length + 1, `${name}, a link: a link per plan and the compare link`);
    assert.equal(page, home.split(asButton).join(asLink), `${name}: the two renders are equal but for the door`);
  }
  // the link is a plain anchor — where it goes, how it looks, its words — with no handler; the switches still turn their own
  const calls: string[] = [];
  const drawn = drawnElementsOf(HowToView({ business: false, trade: false, onBusiness: () => { calls.push('business'); }, onTrade: () => { calls.push('trade'); }, onJoin: link }));
  const doors = drawn.filter((el) => el.type === 'a' && el.props.className === 'ts-fs-plan__cta');
  assert.equal(doors.length, PLANS.length);
  for (const el of doors) assert.deepEqual(Object.keys(el.props).sort(), ['children', 'className', 'href'], 'a plain anchor: no onClick, no target');
  for (const el of doors) assert.equal(el.props.href, '/', 'to the front door');
  const buttons = drawn.filter((el) => el.type === 'button');
  for (const b of buttons) (b.props.onClick as () => void)();
  assert.deepEqual(calls, ['business', 'trade'], 'the two switches turn their own, and nothing else is pressed');
  // the default export hands the door on, whichever it is
  // HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: the view is required, with no default — each call hands the whole view, the one this test renders (the short
  // view's door is homeTrim02.test.ts's). Until then no view was handed, and the second line read 'handed a function: as the home page has it' —
  // the home page hands the short view now.
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: link })), render(STATES[0], link), 'the default export, handed a link: the pure half at rest, with that door');
  assert.equal(renderToStaticMarkup(React.createElement(HowToSection, { view: 'whole', onRequireAuth: noop })), render(STATES[0], noop), 'handed a function — the home page\'s kind of door — and the whole view');
  const Host = (): null => {
    const el = HowToSection({ view: 'whole', onRequireAuth: link }) as React.ReactElement<HowToViewProps>;
    assert.equal(el.props.onJoin, link, 'the very door it was handed');
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  // the page hands /pricing's own door (ruling d), and the landing its function, as typed
  assert.equal(count(code(PRICING_PAGE), `door={${LINK_DOOR_TEXT}}`), 1, '/pricing\'s door: a link to the front door');
  // HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: each hands its view too — the page the whole view, the landing the short view. Until then neither named a view.
  assert.equal(count(code(FS.file), `<HowToSection view="whole" onRequireAuth={${LINK_DOOR_TEXT}} />`), 1, '/financial-software hands the same door, and the whole view');
  assert.equal(count(code(LANDING), '<HowToSection view="short" onRequireAuth={onRequireAuth} />'), 1, 'the landing hands its function, as typed, and the short view');
  // the link arm is PlanDoor's, retyped: the section imports nothing of the plans section, and draws the link itself
  assert.ok(code(PLANS_SECTION).includes("| { kind: 'link'; href: string };"), 'PlanDoor\'s link arm, the precedent');
  const section = code(HOW_TO);
  assert.equal(count(section, "export type JoinDoor = (() => void) | { readonly kind: 'link'; readonly href: string };"), 1, 'the same shape, declared in the section\'s own file');
  assert.equal(count(section, "typeof onJoin === 'function'"), 1, 'told apart once, where the door is drawn');
  assert.doesNotMatch(section, /PlansSection|next\/link|\buseRouter\b|signIn|signUp|LoginBox/, 'no second sign-up modal, no new auth code: nothing of the plans section, no router, no auth import');
});

// ── T6 · THE FOOTER'S DOORS ──────────────────────────────────────────────────

test('T6 the footer\'s doors, from the pages\' leaf: Stop 0 | Los Angeles to /about with no fragment, Financial Software and Professional Services to their pages, Travel Marketplace on /#demo; drawn so; the top bar\'s three links where they were', () => {
  assert.deepEqual(FOOTER_SERVICES_LINKS, [
    { label: 'Financial Software', href: FINANCIAL_SOFTWARE_PATH },
    { label: 'Professional Services', href: PROFESSIONAL_SERVICES_PATH },
    { label: 'Travel Marketplace', href: `/#${DEMO_ANCHOR}` },
  ]);
  assert.equal(FOOTER_SERVICES_LINKS[2].href, '/#demo', 'Travel Marketplace stays on its section (ruling g: no travel page)');
  const story = footerStoryLinks(WAS_HERE);
  assert.deepEqual(story[0], { label: FOOTER_STOP_ZERO_LABEL, href: ABOUT_PATH }, 'Stop 0 opens About Us\'s own page');
  assert.equal(story[0].href, '/about');
  assert.ok(!story[0].href.includes('#'), 'with no fragment (Alex\'s answer to the audit): the letter is the first thing on that page');
  assert.equal(story.filter((l) => l.href.startsWith(ABOUT_PATH)).length, 1, 'one link to /about');
  // the words leaf reads the three paths, and one anchor: the three its doors left are gone from its import
  const words = code(FOOTER_WORDS);
  assert.match(words, /^import \{ ABOUT_PATH, FINANCIAL_SOFTWARE_PATH, PROFESSIONAL_SERVICES_PATH \} from '\.\/homePages';$/m, 'the three paths, from the pages\' leaf');
  assert.match(words, /^import \{ DEMO_ANCHOR \} from '\.\/homeAnchors';$/m, 'one anchor');
  assert.doesNotMatch(words, /MODULES_ANCHOR|SERVICES_ANCHOR|STOP_ZERO_ANCHOR/, `his answer: "${ANSWER.theHref.slice(ANSWER.theHref.indexOf('footerWords.ts builds'))}"`);
  for (const typed of ["'/about", "'/financial-software", "'/professional-services", '#stop-0']) assert.ok(!words.includes(typed), `${typed} is not typed in the footer's words`);
  assert.equal(count(words, '{ label: FOOTER_STOP_ZERO_LABEL, href: ABOUT_PATH },'), 1, 'the href is the leaf\'s /about path, and nothing is built from an anchor for it');
  // drawn so: the footer's render holds each door once
  const html = renderToStaticMarkup(React.createElement(LandingFooter));
  for (const page of PAGES) assert.equal(count(html, `href="${page.path}"`), 1, `the footer draws one link to ${page.path}`);
  for (const gone of ['href="/#stop-0"', 'href="/#modules"', 'href="/#services"', 'href="/about#']) assert.equal(count(html, gone), 0, `and none to ${gone.slice(6)}`);
  assert.equal(count(html, 'href="/#demo"'), 1, 'Travel Marketplace, on its section');
  // the brief's "NOT IN THIS PR" names "The top bar and its links." — they land where they did
  assert.deepEqual(BAR_PRODUCT_LINKS.map((l) => l.href), ['/#modules', '/#services', '/#demo'], 'the top bar\'s three links land on the home page\'s sections, as they did');
  // the anchors' home keeps Stop 0's re-export, though the footer reads it no more; the section keeps its id
  assert.match(code(ANCHORS), /^export \{ STOP_ZERO_ANCHOR \} from '\.\/stopZeroWords';$/m);
  assert.equal(count(code(ABOUT_US), 'id={STOP_ZERO_ANCHOR}'), 1, 'About Us keeps its id (homeAbout01 T3 holds its port, line for line: no scroll margin can join it unseen)');
});

// ── T7 · PUBLIC, WITH THE SECURITY REVIEW ────────────────────────────────────

test('T7 public: the three paths in PUBLIC_PATHS directly after \'/how-it-works\', each with its dated proof and the layout\'s session check named; the middleware lets each through and nothing beside it; in GUEST_ROUTES on the law\'s one line, each citing the footer; the Financial Software page on both lists of selling surfaces; no data path in the pages or in anything they import', async () => {
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(list, 'PUBLIC_PATHS is declared');
  const paths = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const at = paths.indexOf('/how-it-works');
  assert.deepEqual(paths.slice(at, at + 4), ['/how-it-works', FINANCIAL_SOFTWARE_PATH, PROFESSIONAL_SERVICES_PATH, ABOUT_PATH], 'directly after /how-it-works, in the brief\'s order (the pages\' leaf\'s)');
  for (const page of PAGES) assert.equal(paths.filter((p) => p === page.path).length, 1, `${page.path}: listed once`);
  assert.equal(paths[paths.length - 1], '/my-trip', "'/my-trip' stays last (tripPost01, intakeForm01, pipelinePage01)");
  // the rule: p or p + '/' — each entry covers its page and nothing beside it, and no other entry covers one of the three
  const isPublic = (pathname: string): boolean => paths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  for (const page of PAGES) {
    assert.ok(isPublic(page.path), `${page.path} is public`);
    assert.deepEqual(paths.filter((p) => page.path === p || page.path.startsWith(p + '/')), [page.path], `${page.path} is public by its own entry alone — never by '/f', never by '/'`);
    for (const beside of [`${page.path}x`, `${page.path}-2`, page.path.slice(0, -1), `/api${page.path}`, `/x${page.path}`]) assert.ok(!isPublic(beside), `${beside} is not public`);
  }
  // at run time: the middleware lets each of the three through with no cookie, and sends a path beside it to the front door
  for (const page of PAGES) {
    const through = await middleware(new NextRequest(`https://www.templestuart.com${page.path}`));
    assert.equal(through.status, 200, `${page.path}: not a redirect`);
    assert.equal(through.headers.get('location'), null);
    const beside = await middleware(new NextRequest(`https://www.templestuart.com${page.path}x`));
    assert.equal(beside.status, 307, `${page.path}x: still behind the cookie`);
    assert.equal(new URL(beside.headers.get('location') as string).pathname, '/');
  }
  // each entry's dated note and its proof, as /how-it-works's gives one — and the one thing that is the root layout's, named
  const notes = said(MIDDLEWARE);
  const PROOF = 'no route handler under it, no fetch, no paid API, no database read, no env read, no session read';
  assert.equal(count(notes, PROOF), 4, '/how-it-works\'s proof, and one for each of the three');
  for (const [page, sentence] of [
    [FS, '/financial-software (HOME-PAGES-01, 2026-11-14) — the Financial Software section (src/components/landing/HowToSection.tsx; the home page keeps its own mount). SAFE BY CONSTRUCTION: a static server page (src/app/financial-software/page.tsx) over a client section with no data path — its only state is two React booleans — no route handler under it,'],
    [PS, '/professional-services (HOME-PAGES-01, 2026-11-14) — the Professional Services section (src/components/landing/ServicesSection.tsx; the home page keeps its own mount). SAFE BY CONSTRUCTION: a static server page (src/app/professional-services/page.tsx) over a client section with no data path — its only state is the picked door — no route handler under it,'],
    [ABOUT, '/about (HOME-PAGES-01, 2026-11-14) — About Us and, under it, Our Story (src/components/landing/StopZeroSection.tsx, WasHereSection.tsx; the home page keeps its own mount of Our Story, and of About Us one band in the letter\'s seat — HOME-TRIM-01, 2026-11-15: "the home page keeps its own mount of each" until then). SAFE BY CONSTRUCTION: a server page (src/app/about/page.tsx) rendered on every request for one reason — the day:'], // HOME-TRIM-01 (2026-11-15): the one clause of that note the brief's ruling b re-said — '…; the home page keeps its own mount of each). SAFE BY CONSTRUCTION: …' until then
  ] as const) assert.equal(count(notes, sentence), 1, `${page.path}: its proof opens as written — dated, the section's own component named, what renders it and what it holds`);
  for (const page of PAGES) assert.equal(count(notes, `nothing lives under ${page.path} but the page itself`), 1, `${page.path}: what the prefix covers, said`);
  assert.ok(notes.includes(`HOME-PAGES-01 (Alex's brief, 2026-11-14 — ruling f: "${RULING.f.slice(0, RULING.f.indexOf(' They join GUEST_ROUTES'))}"`), 'ruling f\'s first half, quoted over the three');
  assert.ok(notes.includes('ONE THING IS THE ROOT LAYOUT\'S, on every page of the app, and not these pages\' own: the session check on load (src/components/Providers.tsx — GET /api/auth/session, public by \'/api/auth\' above).'), 'the layout\'s session check, named');
  assert.ok(paths.includes('/api/auth'), 'and /api/auth is public, as the note says');
  assert.ok(notes.includes(`Alex's answer to the audit, 2026-11-14: "${ANSWER.session}"`), 'and his answer on it, exact');
  assert.equal(count(code('src/components/Providers.tsx'), '<SessionProvider>'), 1, 'the provider stays where it is: in the root layout\'s Providers');
  assert.equal(count(code('src/app/layout.tsx'), '<Providers>{children}</Providers>'), 1);
  assert.equal(count(notes, 'and no other path is /f or under /f/.'), 1, 'the /f note, re-said: /financial-software starts with those two characters and was never covered by it');
  // GUEST_ROUTES: on the one line that holds '/work-with-me' — a new line would move the lines the deck cites by number — each citing its real door
  const lawLine = code(LAW).split('\n').filter((l) => l.includes("{ route: '/work-with-me', why:"));
  assert.equal(lawLine.length, 1, 'the /work-with-me line');
  for (const entry of [
    "{ route: '/financial-software', why: 'HOME-PAGES-01 (2026-11-14): the Financial Software section on a page of its own — its door is the footer\\u2019s SERVICES column, on every page that mounts the footer (src/lib/footerWords.ts FOOTER_SERVICES_LINKS; LandingFooter.tsx), PUBLIC_PATHS' },",
    "{ route: '/professional-services', why: 'HOME-PAGES-01 (2026-11-14): the Professional Services section on a page of its own — its door is the footer\\u2019s SERVICES column, on every page that mounts the footer (src/lib/footerWords.ts FOOTER_SERVICES_LINKS; LandingFooter.tsx), PUBLIC_PATHS' },",
    "{ route: '/about', why: 'HOME-PAGES-01 (2026-11-14): About Us and Our Story on a page of their own — its door is the footer\\u2019s OUR STORY column, Stop 0 | Los Angeles (src/lib/footerWords.ts footerStoryLinks; LandingFooter.tsx), PUBLIC_PATHS' },",
  ]) assert.equal(count(lawLine[0], entry), 1, `GUEST_ROUTES, on that line: ${entry.slice(0, 40)}…`);
  assert.equal(count(lawLine[0], "'") % 2, 0, 'its single quotes pair (the activity law blanks quoted spans over the law\'s code)');
  // the two lists of selling surfaces: the page renders the public offer, so it joins PLAN_SURFACES — the plan law's clause 1 then holds it as it
  // holds /pricing's page — and SELLING_SURFACES, which the offer law counts
  const law = code(LAW);
  assert.match(law, /^const PLAN_SURFACES = \[[^\]]*'src\/app\/pricing\/page\.tsx', 'src\/app\/financial-software\/page\.tsx'\];/m, 'PLAN_SURFACES holds the page');
  assert.match(law, /^const SELLING_SURFACES = \[[^\]]*'src\/app\/pricing\/page\.tsx', 'src\/app\/financial-software\/page\.tsx'\];/m, 'and SELLING_SURFACES');
  // NO DATA PATH — the three pages and everything they import, to the end
  const { files: closure, packages } = closureOf(PAGES.map((p) => p.file));
  for (const f of [...PAGES.map((p) => p.file), ...SIX_COMPONENTS, LEAF, FOOTER_WORDS]) assert.ok(closure.includes(f), `${f} is in what the pages import`);
  assert.ok(closure.length >= 31, `the whole closure was read (${closure.length} files — 31 when this was written: the three pages and the 28 of the six components' closure, the six and the 22 they import)`);
  assert.ok(notes.includes('28 files: the 27 the audit read, and this change\'s own leaf, src/lib/homePages.ts'), 'the count the proofs were read over, said at the entries');
  assert.equal(closureOf([...SIX_COMPONENTS]).files.length, closure.length - PAGES.length, 'the pages add nothing to what the six components import but themselves');
  // and the packages that closure reaches, a closed list: a paid or outbound call made through an SDK carries none of the call shapes below,
  // so the door it would come in by is held shut here
  assert.deepEqual(packages, ['next', 'next/link', 'react'], 'the packages the closure imports: next, next/link and React — no client of any service');
  const readsNext = closure.filter((f) => specsOf(code(f), f).includes('next'));
  assert.deepEqual(readsNext, PAGES.map((p) => p.file).sort(), 'next itself is read by the three pages alone');
  for (const f of readsNext) assert.deepEqual(code(f).split('\n').filter((l) => /['"]next['"]/.test(l)), ["import type { Metadata } from 'next';"], `${f}: and for its Metadata type, nothing more`);
  // the reader itself, held: the shapes this repo writes and the ones a later edit could — a reader that missed one would pass a package the list never saw
  for (const [shape, src] of [
    ['an import at a line\'s start', "import x from 'pkg';"], ['a second import on a line', "import a from './a'; import x from 'pkg';"], ['an import after another statement', "const a = 1; import x from 'pkg';"],
    ['an indented import', "  import x from 'pkg';"], ['a bare import', "import 'pkg';"], ['a type-only import', "import type { X } from 'pkg';"], ['a list over several lines', "import {\n  x,\n  y,\n} from 'pkg';"],
    ['export * from', "export * from 'pkg';"], ['export * as … from', "export * as ns from 'pkg';"], ['export { … } from', "export { x } from 'pkg';"], ['export type { … } from', "export type { X } from 'pkg';"],
    ['import()', "const m = import('pkg');"], ['import () with a space', "const m = import ('pkg');"], ['import() with a second argument', "const m = import('pkg', {});"], ['import() of a template literal', 'const m = import(`pkg`);'],
    ['import() inside a template literal\'s expression', "const t = `${import('pkg')}`;"], ['require()', "const m = require('pkg');"], ['require () with a space', "const m = require ('pkg');"],
    ['require() inside a template literal\'s expression', "const t = `${require('pkg')}`;"], ['require() behind a regex literal that holds a backtick', "const r = /`/; const m = require('pkg');"], ['module.require()', "const m = module.require('pkg');"],
    ['import-equals', "import m = require('pkg');"], ['an import type', "type X = import('pkg').X;"], ['double quotes', 'import x from "pkg";'],
  ] as const) assert.deepEqual(specsOf(src, 'shape.tsx').filter((spec) => spec !== './a'), ['pkg'], `the reader reads ${shape}`);
  // a file is parsed as its extension says: a type assertion in angle brackets is TypeScript in a .ts file and the start of an element in a .tsx one
  assert.deepEqual(specsOf("const m = <any>require('pkg');", 'shape.ts'), ['pkg'], 'the reader reads a require() behind an angle-bracket assertion in a .ts file');
  assert.deepEqual(specsOf("const m = <any>require('pkg');", 'shape.tsx'), [], 'which is no call at all read as a .tsx file: the kind is chosen by the file\'s name');
  for (const [shape, src] of [
    ['a string that holds an import', "export const S = \"import x from 'pkg'\";"], ['a template literal that holds one', "export const T = `\nimport x from 'pkg';\n`;"], ['a from inside a template literal', "export const T = `from 'pkg'`;"],
    ['a regex literal that holds one', "export const R = /import x from 'pkg'/;"], ['JSX text that holds one', "export const A = () => <p>import x from 'pkg';</p>;"],
  ] as const) assert.deepEqual(specsOf(src, 'shape.tsx'), [], `and does not read ${shape}`);
  for (const [shape, src] of [['import() of a name', 'const m = import(name);'], ['require() of a name', 'const m = require(name);'], ['import() of a template with an expression in it', 'const m = import(`${name}`);']] as const) {
    assert.deepEqual(specsOf(src, 'shape.tsx'), [NOT_A_LITERAL], `${shape} names no module the reader can follow: returned by name, for the closed list to refuse`);
  }
  const CALLS: ReadonlyArray<readonly [what: string, shape: RegExp]> = [
    ['a fetch', /\bfetch\s*\(/], ['an XMLHttpRequest', /\bXMLHttpRequest\b/], ['a beacon', /\bsendBeacon\b/], ['a socket or a stream', /new\s+(?:WebSocket|EventSource)\s*\(/],
    ['a server action', /['"]use server['"]/], ['a database client', /from\s+['"](?:@prisma\/client|@\/lib\/prisma|pg)['"]|\bnew PrismaClient\b/], ['an env read', /process\.env/],
    ['a cookie or header read', /\b(?:cookies|headers)\(\s*\)/], ['a session read', /\b(?:getServerSession|getToken|useSession|getVerifiedEmail|verifyCookie|getCurrentUser)\b/],
  ];
  for (const f of closure) for (const [what, shape] of CALLS) assert.doesNotMatch(code(f), shape, `${f} makes ${what}`);
  // the pages and the six components carry not even the words; among the leaves, one file does — the tool registry, whose '/api/…' paths and
  // schema names stand inside citation strings and are never called
  for (const f of [...PAGES.map((p) => p.file), ...SIX_COMPONENTS]) for (const tell of ['fetch(', '/api/', 'prisma', 'process.env']) assert.ok(!code(f).includes(tell), `${f} carries no ${tell}`);
  for (const tell of ['/api/', 'prisma']) for (const f of closure.filter((file) => code(file).includes(tell))) assert.equal(f, 'src/lib/toolRegistry.ts', `"${tell}" stands in no file of the closure but the registry, where it is a citation inside a string (found in ${f})`);
  assert.doesNotMatch(code('src/lib/toolRegistry.ts'), /\bfetch\s*\(|from\s+['"]@prisma\/client['"]/, 'which calls nothing');
});

// ── T8 · THE HOME PAGE — as HOME-PAGES-01 left it (unchanged), then as HOME-TRIM-01 left it (one band for the letter), then as HOME-TRIM-02 left it (the short view), then as HOME-TRIM-03 left it (2026-11-15: the Professional Services section's short view too) ──

test('T8 the home page, as HOME-TRIM-02 left it (2026-11-15; "as HOME-TRIM-01 left it" until then), and HOME-TRIM-03 after it (2026-11-15): Landing.tsx mounts the bar, the two pillars\' sections (each its short view: the Financial Software section\'s since HOME-TRIM-02, the Professional Services section\'s since HOME-TRIM-03), the About Us band, Our Story and the footer once each, as typed, and the letter nowhere; it reads nothing of the pages\' leaf — the footer\'s words, the three pages, the band and (HOME-TRIM-02, 2026-11-15) the Financial Software section read it, and (HOME-TRIM-03, 2026-11-15) the Professional Services section; no travel page. (HOME-PAGES-01\'s ruling h held the page unchanged until then, and this test was named: T8 the home page does not change: Landing.tsx mounts the bar, the four sections and the footer once each, as typed, and reads nothing of the pages\' leaf — the footer\'s words and the three pages alone read it; no travel page)', () => {
  const landing = code(LANDING);
  for (const mount of ['<LandingHeader glass onRequireLogin={onRequireLogin} />', '<HowToSection view="short" onRequireAuth={onRequireAuth} />', '<ServicesSection view="short" />', '<AboutBand />', '<WasHereSection today={today} />', '<LandingFooter />']) { // HOME-TRIM-01 (2026-11-15): the fourth was '<StopZeroSection />' until then — the letter's one mount is /about's page's now (T1), and the About Us band holds its seat here; HOME-TRIM-02 (2026-11-15, ruling a): the second was '<HowToSection onRequireAuth={onRequireAuth} />' until then — the how-to mounts its short view here; HOME-TRIM-03 (2026-11-15, ruling a): the third was '<ServicesSection />' until then — the services section mounts its short view here
    assert.equal(count(landing, mount), 1, `Landing.tsx: ${mount}, once, as typed`);
  }
  const order = ['<HowToSection ', '<ServicesSection ', '<AboutBand ', '<WasHereSection ', '<LandingFooter '].map((m) => landing.indexOf(m)); assert.equal(count(landing, 'StopZeroSection'), 0, 'the letter is mounted nowhere on the home page, and named nowhere in its code'); // '<StopZeroSection ' third in this order until HOME-TRIM-01
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'in the order they stood');
  assert.ok(!landing.includes('homePages') && !landing.includes('ts-fs-page'), 'the landing reads nothing of the pages\' leaf and wears nothing of the page\'s hook');
  // who reads the leaf: the footer's words, the three pages and — since HOME-TRIM-01 (2026-11-15) — the About Us band, whose one door opens /about by the leaf's path (the footer's words and the three pages alone, until then); and — since HOME-TRIM-02 (2026-11-15, ruling e) — the Financial Software section, whose short view's first link opens /financial-software by the leaf's path; and — since HOME-TRIM-03 (2026-11-15, ruling d) — the Professional Services section, whose short view's link opens /professional-services by the leaf's path
  const readers = srcFiles().filter((f) => specsOf(code(f), f).some((spec) => /(?:^|\/)homePages$/.test(spec))).sort();
  assert.deepEqual(readers, [...PAGES.map((p) => p.file), FOOTER_WORDS, ABOUT_BAND, HOW_TO, SERVICES].sort(), 'the three pages, the footer\'s words, the About Us band, the Financial Software section and the Professional Services section — no other component, no other page, by any import, export … from, import() or require() that names its module by a literal');
  // ruling g: no travel page — /travel is the cockpit's
  assert.ok(!existsSync(resolve(ROOT, 'src/app/travel')), 'no src/app/travel');
  assert.match(code('src/app/[tab]/page.tsx'), /const TAB_PATHS = new Set\(\[\s*'runway', 'travel', 'trade', 'books', 'tax',\s*\]\);/, '/travel is one of the cockpit\'s tab paths');
  for (const section of ['LandingBookingSection', 'GuestBookingLookup']) for (const page of PAGES) assert.ok(!code(page.file).includes(section), `${page.file} mounts no ${section}`);
});

// ── T9 · THE RULINGS ─────────────────────────────────────────────────────────

test('T9 each ruling is quoted, dated, where it is built; and in every one of the change\'s twenty-six files a quote that follows a sentence of Alex\'s for twenty characters is his words from there, whole or to a full stop — each file\'s count of the quotes read held', () => {
  const quoted = (file: string, words: string): boolean => said(file).includes(`"${words}"`);
  const BUILT: ReadonlyArray<readonly [file: string, rulings: readonly string[]]> = [
    [LEAF, [RULING.c, RULING.g, RULING.h]],
    [FS.file, [RULING.a, RULING.b, RULING.d]],
    [PS.file, [RULING.b]],
    [ABOUT.file, [RULING.b, RULING.e]],
    [HOW_TO, [RULING.d]],
    [GLOBALS, [RULING.a]],
    [FOOTER_WORDS, [STEP_4, ANSWER.noFragment, ANSWER.theHref, RULING.g, RULING.h]],
    [LAW, [RULING.e]],
    [SEEDS_FILE, [RULING.e]],
    // the re-pointed tests: each quotes the ruling that moved its pin
    [TESTS.footer01, [STEP_4]],
    [TESTS.footer02, [RULING.b]],
    [TESTS.heroCrest01, [RULING.b, STEP_4, ANSWER.theHref]],
    [TESTS.homePlans04, [RULING.a]],
    [TESTS.howTo01, [RULING.d]],
  ];
  for (const [file, rulings] of BUILT) {
    const notes = said(file);
    assert.ok(notes.includes('HOME-PAGES-01'), `${file} names the brief`);
    assert.ok(notes.includes('2026-11-14'), `${file} dates it`);
    for (const ruling of rulings) assert.ok(quoted(file, ruling), `${file} quotes "${ruling.slice(0, 40)}…", exact`);
  }
  // the short forms: a page that builds only part of a ruling quotes that part — its opening sentences, to a full stop
  for (const page of [PS, ABOUT]) assert.ok(quoted(page.file, RULING.a.slice(0, RULING.a.indexOf(' One value is new.'))), `${page.file} quotes ruling a's rule: nothing is redrawn`);
  for (const page of PAGES) assert.ok(quoted(page.file, RULING.c.slice(0, RULING.c.indexOf(' Three titles'))), `${page.file} quotes ruling c's rule: nothing is typed in a page`);
  // ruling f is built in two places, and each quotes its half
  assert.ok(quoted(MIDDLEWARE, RULING.f.slice(0, RULING.f.indexOf(' They join GUEST_ROUTES'))), 'the middleware quotes ruling f\'s first half: PUBLIC_PATHS, with the proof');
  const second = RULING.f.slice(RULING.f.indexOf('They join GUEST_ROUTES'), RULING.f.indexOf(' This is the HARD GATE'));
  assert.equal(second, 'They join GUEST_ROUTES, each citing its real door from step 4.', '(a check of the slicing above, not of the tree)');
  // on the GUEST_ROUTES line itself: the note at the end of the line that holds the entries
  const lawCode = code(LAW).split('\n');
  const guestLine = lawCode.findIndex((l) => l.includes("{ route: '/work-with-me', why:"));
  assert.ok(guestLine > -1 && flat(comments(LAW).split('\n')[guestLine]).includes(`"${second}"`), 'the law quotes its second half, on the GUEST_ROUTES line');
  // Alex's answer, where each piece is built
  assert.ok(quoted(MIDDLEWARE, ANSWER.session), 'the session check, at the middleware');
  // the two lists of selling surfaces: no lettered ruling names them — his answer's item 5 does, and it is quoted where the page joins them
  const SURFACES = 'the page on PLAN_SURFACES and SELLING_SURFACES;';
  assert.ok(ANSWER.asAudited.includes(` ${SURFACES} `), '(a check that the excerpt is a clause of his answer)');
  const plansLine = lawCode.findIndex((l) => l.startsWith('const PLAN_SURFACES = ['));
  assert.ok(plansLine > -1 && flat(comments(LAW).split('\n')[plansLine]).includes(`Alex's answer to the audit, 2026-11-14, item 5: "… ${SURFACES} …"`), 'his answer on the two lists, quoted on the PLAN_SURFACES line itself — cut at both ends, and marked so');
  assert.equal(count(said(LAW), `item 5: "… ${SURFACES} …"`), 1, 'and nowhere else in the law');
  const WHY = ANSWER.noFragment.slice(ANSWER.noFragment.indexOf('The letter is the first thing'), ANSWER.noFragment.indexOf(' No scroll margin'));
  assert.ok(WHY.startsWith('The letter') && WHY.endsWith('scrolled the bar away.'), '(a check of the slicing above: one sentence of his answer)');
  assert.ok(quoted(ABOUT_US, WHY), 'why the fragment went, at About Us');
  // the brief's own words, in the leaf: two of the four beta users' notes as he pasted them, and his approval of the boards
  for (const note of BETA_NOTES) assert.ok(quoted(LEAF, note), `the leaf quotes "${note.slice(0, 30)}…", exact`);
  assert.ok(said(LEAF).includes(`2026-11-14 20:01 Manila: "${APPROVAL}"`), 'and his approval, under its stamp');
  // EVERY FILE OF THE CHANGE — the twenty-six: six new, five whose code changed, eight whose notes alone did (the eighth is the About Us words'
  // leaf: two notes re-said by Alex's yes of 2026-11-15, its code as it stood — homeAbout01 T5 held both until HOME-ABOUT-02, 2026-11-15, which gave the leaf's second quote his new first sentence: "holds both" until then), seven re-pointed tests
  const CHANGED = [
    LEAF, ...PAGES.map((p) => p.file), THIS, SEEDS_FILE,
    HOW_TO, FOOTER_WORDS, MIDDLEWARE, GLOBALS, LAW,
    FOOTER, HEADER, SERVICES, ABOUT_US, OUR_STORY, 'src/lib/brandLockup.ts', ANCHORS, STOP_ZERO_WORDS,
    ...Object.values(TESTS),
  ];
  assert.equal(new Set(CHANGED).size, 26);
  // any quote under one of this brief's two stamps, in any of them, is his words
  for (const file of CHANGED) {
    for (const m of said(file).matchAll(/20:01 Manila: "([^"]+)"/g)) assert.equal(m[1], APPROVAL, `${file}: under the 20:01 stamp, his approval, exact`);
    for (const m of said(file).matchAll(/19:11 Manila: "([^"]+)"/g)) assert.fail(`${file}: a quote stands directly under the 19:11 stamp ("${m[1].slice(0, 30)}…") — this change quotes his brief by its rulings, by letter`);
  }
  // EVERY QUOTE OF HIM THIS CAN OPEN, IN EVERY ONE OF THEM. His texts are the eighteen below. A straight double mark followed by twenty or more
  // characters of one of their sentences, from that sentence's start, opens a quote of him: what stands from there to the closing mark must be his
  // words from that sentence on — to the end of the piece on file, or to a full stop — or this fails and says where the two part: never a
  // reworded piece, never a cut mid-sentence. A whole sentence of his shorter than that is read too. And each file's count of the quotes read is
  // held exactly, so a quote that stood and is then misquoted inside its first twenty characters leaves its file's count, and fails by it.
  // WHAT IS NOT HELD: a quote newly written that leaves his words before its twentieth character opens nothing and is counted nowhere. Neither
  // is a quote that opens in the middle of a sentence or behind an ellipsis (the one such in the twenty-six, on the law's PLAN_SURFACES line, is
  // held by name above); nor one in curly marks, single marks or backticks; nor one in a code string — where this file's own code holds his
  // words, they are built from the texts above or checked against them on the spot. Twenty, not fewer: his sentences open on plain words ("This
  // is the", "The footer's"), and at twelve characters other sentences of his own brief, exact, were taken for misquotes of these.
  const HIS_WORDS = [...Object.values(RULING), STEP_4, NOT_IN_THIS_PR_HEADING, NOT_IN_THIS_PR, ...Object.values(ANSWER), ...BETA_NOTES, APPROVAL];
  assert.equal(HIS_WORDS.length, 18);
  // one span in the twenty-six follows a sentence of his that far and is not his: an older brief's ruling, quoted in the file that built it. It is
  // excepted by name — that file, those words as they go on there — so the same words anywhere else, or going on any other way, are read against his
  const NOT_HIS: ReadonlyArray<readonly [file: string, opens: string, whose: string]> = [
    [HOW_TO, 'WORDS. Nothing is typed in a component. The switches say', 'HOME-PLANS-04, ruling f'],
  ];
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closesASentence = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
  for (const file of CHANGED) {
    const notes = said(file);
    for (let at = notes.indexOf('"'); at > -1; at = notes.indexOf('"', at + 1)) {
      const rest = notes.slice(at + 1);
      let his = false;
      let parted = '';
      for (const text of HIS_WORDS) {
        for (const from of sentencesOf(text)) {
          let n = 0;
          while (from + n < text.length && rest[n] === text[from + n]) n += 1;
          if (n > 0 && closesASentence(text, from + n) && rest[n] === '"') his = true;
          else if (n >= 20 && !NOT_HIS.some(([where, opens]) => where === file && rest.startsWith(opens))) parted = `a quote follows a sentence of his for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece of his words on file goes on "${text.slice(from + n, from + n + 24)}…". If it is his, quote the piece on file, whole or to a full stop, or put the longer piece among the texts above; if it is another text's sentence, name it in NOT_HIS`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(NOT_HIS.map(([where, opens]) => count(said(where), `"${opens}`)), [1], 'the excepted span stands once, where it is said to');
  assert.deepEqual(census, {
    [LEAF]: 6, [FS.file]: 4, [PS.file]: 3, [ABOUT.file]: 4, [THIS]: 3, [SEEDS_FILE]: 1,
    [HOW_TO]: 1, [FOOTER_WORDS]: 5, [MIDDLEWARE]: 2, [GLOBALS]: 1, [LAW]: 2, [ABOUT_US]: 1, [STOP_ZERO_WORDS]: 1,
    [TESTS.footer01]: 3, [TESTS.footer02]: 2, [TESTS.heroCrest01]: 5, [TESTS.homePlans04]: 1, [TESTS.howTo01]: 1, [TESTS.homeAbout01]: 3,
  }, 'each file\'s quotes of him, counted — 49 in 19 of the 26: a quote that stood and no longer opens on his words leaves its file\'s count, and fails here');
});
