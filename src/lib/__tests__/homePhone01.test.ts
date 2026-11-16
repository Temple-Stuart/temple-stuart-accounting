/**
 * HOME-PHONE-01 (Alex's brief, 2026-11-16 01:42 Manila — his ask: "ok i sent it now what about the footer"; the phone footer approved on the
 * design canvas with the home page's boards, 2026-11-14 at 20:01 and, corrected, at 20:41 Manila; built 2026-11-16) — THE FOOTER ON A PHONE:
 * OUR STORY, SERVICES AND THE RECORD FOLD, AND THE SOCIALS CLOSE THE COLUMNS AS MARKS.
 *
 * FOOTER-02 drew the public footer: the lockup, four columns, a hairline, the disclaimer, © and four links; under 1024px every column drew all
 * its links, Our Story and The Record across and Services and Socials side by side between them. Now, under 1024px, the columns stand one
 * under another, three of them folded behind a row each, and the socials stand last as five marks; from 1024px nothing
 * changes. The spec is a file: design-refs/home-phone-01/Footer-Reference.html, with its README beside it. Its first stylesheet is
 * design-refs/footer-02's, byte for byte; its footer is footer-02's markup but for the three doors HOME-PAGES-01 moved, as main draws them,
 * and the three folds; its second stylesheet is the only part to port. The fold is src/components/landing/FooterFold.tsx — a client component,
 * the footer's one island — which src/components/landing/LandingFooter.tsx draws in the three columns; the second stylesheet ends FOOTER-02's
 * port in src/app/globals.css. What is held here:
 *
 *   T1 the handoff — the README and the reference are in the tree, byte for byte (sha256) and by size, and the folder holds the two; the
 *      reference's first stylesheet is design-refs/footer-02's, byte for byte, and so is its font link; its footer is footer-02's, but for
 *      the three doors HOME-PAGES-01 moved and the three folds;
 *   T2 the block — the port's new rules ARE the reference's second stylesheet, declaration by declaration and in order, behind the house
 *      prefix; they stand at the foot of FOOTER-02's port, after its last rule and directly above HERO-CREST-01's header; they read two
 *      tokens, both in :root, add none and type no colour; where they override FOOTER-02's rules they do it after them, at the same
 *      specificity or one class above, never by !important; nothing outside the port reaches a fold;
 *   T3 the render — the footer's render is the reference's footer as its own script paints it, token for token, folded, with each fold
 *      open and with all three, but for the house prefix, the ids and the crest's src; the footer as a page renders it is the folded one;
 *   T4 the words — every word from its home, and no new word: a fold's row reads its column's label, which LandingFooter.tsx reads from the
 *      words leaf and draws in the column's own <p>; the three ids are the only strings LandingFooter.tsx adds (with the fold's path), and
 *      FooterFold.tsx types no word;
 *   T5 the state — FooterFold holds one React boolean: closed at first; each press of a row turns its own fold; any number open; nothing
 *      stored and nothing in the URL;
 *   T6 the island — LandingFooter.tsx still with no directive, importing plain modules and FooterFold.tsx, its one client module, and
 *      handing each fold the column's name, the list's id and class and the links, nothing that cannot cross to a client; FooterFold.tsx
 *      'use client', importing React alone;
 *   T7 the rulings — each quoted, exact, where it is built, under the brief's date; what the folds made false re-said beside it, dated, and
 *      main's words gone; the legal links re-cited in GUEST_ROUTES, newest first, and no other cited line moved; no quote under the boards'
 *      stamps added anywhere; in every file of the change a quote that follows a sentence of the brief's for twenty characters is its words
 *      from there, whole or to a full stop, and each file's count of them is held (homeTrim03's census).
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript), the README and the stylesheet's seat. No clock, no live call. What a browser must
 * show — the footer beside the reference at 1440, 1280, 1024, 768, 390 and 340, folded, with each fold open and with all three, on the landing
 * and on /about; from 1024px equal to main, pixel for pixel; its heights; its links and marks; the keyboard; no sideways scroll; the requests a
 * signed-out visitor makes — cannot be held here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { code, comments, rejoin } from '../sourceText';
import { WAS_HERE } from '../wasHere';
import { BAR_MARK_SRC } from '../brandLockup';
import { ABOUT_PATH, FINANCIAL_SOFTWARE_PATH, PROFESSIONAL_SERVICES_PATH } from '../homePages';
import {
  FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS, FOOTER_SOCIALS_LABEL, FOOTER_STORY_LABEL, footerStoryLinks,
} from '../footerWords';
import LandingFooter from '@/components/landing/LandingFooter';
import FooterFold, { FooterFoldView, type FooterFoldProps, type FooterFoldViewProps } from '@/components/landing/FooterFold';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-phone-01';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Footer-Reference.html`;
const FOOTER02_REFERENCE = 'design-refs/footer-02/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const FOOTER = 'src/components/landing/LandingFooter.tsx';
const FOLD = 'src/components/landing/FooterFold.tsx';
const WORDS = 'src/lib/footerWords.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const THIS = 'src/lib/__tests__/homePhone01.test.ts';
const tests = (name: string): string => `src/lib/__tests__/${name}.test.ts`;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** A selector list's compounds: split at its commas and its combinators, outside brackets and parentheses. */
const compoundsOf = (sel: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '[' || ch === '(') depth += 1;
    else if (ch === ']' || ch === ')') depth -= 1;
    if (depth === 0 && /[\s,>+~]/.test(ch)) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};
/** Whether a compound names a class that no element of the footer wears — one not ts-ft or ts-ft-* — outside its brackets and parentheses. */
const scopedAway = (compound: string): boolean => /\.(?!ts-ft(?:-|(?![\w-])))[A-Za-z_][\w-]*/.test(compound.replace(/\[[^\]]*\]|\([^)]*\)/g, ''));
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
/** A file's imports, in order, each on a line of its own: what each names. */
const importsOf = (file: string): string[] => [...code(file).matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

/** His ask, 2026-11-16 01:42 Manila. */
const ASK = 'ok i sent it now what about the footer';
/** The brief's rulings, a to i, word for word. */
const RULING = {
  a: 'THREE COLUMNS FOLD UNDER 1024PX. In Our Story, Services and The Record, a button of type button stands between the column\'s name and its list. It holds the name in a span of the label\'s class and the reference\'s caret, with aria-expanded, and aria-controls naming its list: ts-ft-story, ts-ft-services and ts-ft-record. A press opens that column\'s links and a second press closes them. All three start closed, and any number can be open. Under 1024px the row stands in for the name; from 1024px the row is never drawn and the name stands as it does today.',
  b: 'THE SOCIALS CLOSE THE COLUMNS AS FIVE MARKS. Under 1024px they stand last, their name and then the five icons in a row, each account\'s name drawn off-screen in its link. Their markup does not change.',
  c: 'THE FOOTER STAYS A SERVER COMPONENT, WITH ONE CLIENT ISLAND. A fold\'s state lives in FooterFold.tsx, a client component that draws the row and the list it opens. LandingFooter.tsx hands it the column\'s name, the list\'s id and class, and the links, which LandingFooter.tsx still draws. That state is React\'s alone: nothing is kept in storage or in the URL. A folded list carries data-folded, which the stylesheet reads under 1024px only. The tests reach each open state through a pure view that the stateful fold draws, so it renders on the server; the audit names that view\'s shape, the smallest by the pins it moves.',
  d: 'NOT ONE WORD IS NEW. A fold\'s name is its column\'s label from src/lib/footerWords.ts, read where LandingFooter.tsx reads it today, and the three ids are the only strings added.',
  e: 'THE PHONE RULES END FOOTER-02\'S PORT, after its last rule and directly above HERO-CREST-01\'s header: under 1024px they override its rules, at the same specificity. Its classes wear the house prefix and its colours are tokens, as FOOTER-02\'s port has them: rgb() wraps --ts-fs-white, and the gold is --ts-hero-gold. footer02 T3 is re-said: the port is the reference\'s stylesheet followed by this block, which homePhone01 holds line for line. No token is added.',
  f: 'WHAT THE FOLDS MAKE FALSE IS RE-SAID BESIDE IT, dated. Among them is any sentence saying that LandingFooter.tsx renders footer-02\'s markup tag for tag, that a column is its name and its list and nothing else, that a phone draws every column\'s links, that the footer imports plain modules only, or that two column classes are worn without a rule. If the legal links\' lines move, GUEST_ROUTES re-cites them in its rows for /how-pricing-works, /privacy and /terms, newest first, as FOOTER-02 re-cited them. Apart from those, a line that a test or a law cites by its number stays on that number, and Landing.tsx keeps its 815 lines.',
  g: 'THE OTHER CENSUSES ARE LEFT AS THEY ARE: homeTrim01\'s, homeTrim02\'s, homeTrim03\'s and homePages01\'s, and homeAbout02\'s, homePlans05\'s and homeMenu01\'s when they land. Other briefs\' quotes are written around, and none is quoted where it was not already. Alex\'s 2026-11-14 approvals appear by their times, never by their words.',
  h: 'HOME-PHONE-01\'S QUOTES CARRY ITS TIMES: 2026-11-14 20:01 and 20:41 Manila for the boards, and 2026-11-16 01:42 Manila for the ask. Each ruling here is quoted word for word, worded to keep clear of every other census.',
  i: 'ONLY THE FOOTER UNDER 1024PX CHANGES: not the footer from 1024px, its words or links, the socials\' markup, the pages that mount it, or anything above it.',
} as const;

// ── the stylesheets, read as lists of declarations ───────────────────────────

/**
 * A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>",
 * whitespace collapsed. Two levels — rules, and rules inside @media. (homeTrim03.test.ts's reading: text after the last block, or a block
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
/** A file's stylesheets, as written: what stands between each <style> and its </style>. */
const stylesOf = (html: string): string[] => html.split('<style>').slice(1).map((part) => part.slice(0, part.indexOf('</style>')));
/** The house prefix on every class a selector names: .ft-fold → .ts-ft-fold, .ft-column--socials → .ts-ft-column--socials. */
const prefixed = (selector: string): string => selector.replace(/\.ft(?=$|[^A-Za-z0-9])/g, '.ts-ft');
/** The reference's second stylesheet as the port writes it — its classes behind the house prefix, var(--x) → var(--ts-x) (the README, "When porting"). */
function secondPorted(): string[] {
  const styles = stylesOf(whole(REFERENCE));
  assert.equal(styles.length, 2, 'the reference has two stylesheets');
  return declarations(uncommented(styles[1])).map((d) => {
    const [media, selector, declaration] = d.split(' | ');
    return `${media} | ${prefixed(selector)} | ${declaration.replace(/var\(--/g, 'var(--ts-')}`;
  });
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
/** FOOTER-02's port opens here; HERO-CREST-01's rules open there, under their header. */
const PORT_OPEN = '.ts-ft {';
const NEXT_PORT = '.ts-hero {';
/** The block: from its first rule to the hero's. */
const BLOCK_OPEN = '.ts-ft-fold {';
function blockCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(BLOCK_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at, 'the block opens at .ts-ft-fold and runs to the hero\'s first rule');
  return css.slice(at, end);
}
/** HERO-CREST-01's header, at the start of its line (footer02.test.ts's). */
const HERO_HEADER = '\n/* ── HERO-CREST-01 (Alex, design canvas, 2026-11-11): THE GUEST HERO AND THE TOP BAR ──';
/** A selector's specificity as [ids, classes and attributes, elements] — enough for the selectors the block and FOOTER-02's port write. */
function specificity(selector: string): [number, number, number] {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const elements = selector.split(/[\s>+~]+/).filter((part) => /^[a-z]/i.test(part)).length;
  return [ids, classes, elements];
}
const outranks = (x: [number, number, number], y: [number, number, number]): number => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);

// ── the markup, read as tokens ───────────────────────────────────────────────

/**
 * HTML as a list of tokens: every tag with its attributes sorted (a valueless attribute reads "true", as React writes one), every run of
 * text with React's escaping undone; comments and the whitespace that only lays the file out (a run holding a newline) dropped, a lone
 * space between two tags kept. With `prefix`, every class gets the house prefix. (homeTrim03.test.ts's reading.)
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
/** A file's footer: from <footer to its </footer>, before any script. */
function footerOf(file: string): string {
  const html = whole(file);
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.includes('<script>') ? html.indexOf('<script>') : html.indexOf('</body>'));
  assert.equal(count(body, '<footer'), 1, `${file}: one footer`);
  return body.slice(body.indexOf('<footer'), body.indexOf('</footer>') + '</footer>'.length);
}
/** Where the reference reads the crest: from its own place in the repo. */
const REFERENCE_MARK = '../../public/brand/temple-stuart-crest-gold.png';
/** The three folds: the id the reference gives each list, and the one the app gives it — the house prefix (ruling a). */
const FOLDS: ReadonlyArray<readonly [reference: string, app: string]> = [['ft-story', 'ts-ft-story'], ['ft-services', 'ts-ft-services'], ['ft-record', 'ts-ft-record']];
/** Replace one exact stretch, which must stand once. */
function once(html: string, from: string, to: string): string {
  assert.equal(count(html, from), 1, `${from}: once`);
  return html.replace(from, to);
}
/**
 * The reference's footer as its own script paints it with the given folds open — the script's two edits on a press (README: "Pressing the
 * row opens the column's links under it, as they stand today. Pressing it again closes them."): the row's aria-expanded, and data-folded off
 * the list it names.
 */
function painted(open: readonly string[]): string {
  const html = whole(REFERENCE);
  const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));
  for (const line of ["const open = fold.getAttribute('aria-expanded') !== 'true';", "fold.setAttribute('aria-expanded', String(open));", "list.toggleAttribute('data-folded', !open);"]) {
    assert.ok(script.includes(line), `the script's press does this, and these are its edits: ${line}`);
  }
  let footer = footerOf(REFERENCE);
  for (const id of open) {
    footer = once(footer, `aria-expanded="false" aria-controls="${id}"`, `aria-expanded="true" aria-controls="${id}"`);
    footer = once(footer, `id="${id}" data-folded>`, `id="${id}">`);
  }
  return footer;
}
/** The reference's tokens as the app writes them: the house prefix on its classes and on its three ids, wherever they stand, and the crest from public/. */
function asBuilt(html: string): string[] {
  return tokensOf(html, true).map((t) => {
    let u = t.replace(` src="${REFERENCE_MARK}"`, ` src="${BAR_MARK_SRC}"`);
    for (const [reference, app] of FOLDS) u = u.replace(` aria-controls="${reference}"`, ` aria-controls="${app}"`).replace(` id="${reference}"`, ` id="${app}"`);
    return u;
  });
}
/**
 * The footer's render with the given folds open: LandingFooter's own element tree, each FooterFold in it drawn by the pure view the stateful
 * fold draws, handed that state. Ruling c: "The tests reach each open state through a pure view that the stateful fold draws, so it renders
 * on the server; the audit names that view's shape, the smallest by the pins it moves." The audit named it: FooterFoldView, exported beside
 * the stateful default, handed what the fold is handed and, besides, the state and the press — no prop added to the fold or to the footer.
 */
function rendered(open: readonly string[]): string {
  const swap = (node: React.ReactNode): React.ReactNode => {
    if (Array.isArray(node)) return node.map(swap);
    if (!React.isValidElement(node)) return node;
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.type === FooterFold) {
      const props = el.props as FooterFoldProps;
      return React.createElement(FooterFoldView, { ...props, open: open.includes(props.id), onToggle: () => {} });
    }
    const kids = el.props.children;
    return kids === undefined ? el : React.cloneElement(el, undefined, ...(Array.isArray(kids) ? kids.map(swap) : [swap(kids)]));
  };
  return renderToStaticMarkup(swap(LandingFooter()) as React.ReactElement);
}
/** Every element in a tree, depth first. Components are not called. */
const elementsOf = (node: React.ReactNode, out: React.ReactElement[] = []): React.ReactElement[] => {
  if (Array.isArray(node)) node.forEach((n) => elementsOf(n, out));
  else if (React.isValidElement(node)) { out.push(node); elementsOf((node.props as { children?: React.ReactNode }).children, out); }
  return out;
};
/** What a file types as a word or a value: every string literal and every run of JSX text in its code, read with TypeScript's own parser. */
function literalsOf(file: string): string[] {
  const tree = ts.createSourceFile(file, code(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
    else if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces) out.push(flat(node.text));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return out;
}

/** The five states the brief names: folded, each fold open, all three. */
const STATES: ReadonlyArray<readonly [name: string, open: readonly string[]]> = [
  ['folded', []],
  ['Our Story open', ['ts-ft-story']],
  ['Services open', ['ts-ft-services']],
  ['The Record open', ['ts-ft-record']],
  ['all three open', ['ts-ft-story', 'ts-ft-services', 'ts-ft-record']],
];

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (home-phone-01-handoff.zip, 2026-11-16): bytes and sha256 of each. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 7494, '5d17c1a75714873a25669039b44b34eb9e99273dd8e0a836a21169fdb48cb826'],
  [REFERENCE, 21558, '8efb84d43a9118c1bafb16626d7cd189e1e6eb5e74a679722597f43652ab02e5'],
];

test('T1 the handoff is in the tree, byte for byte and by size, the folder holding the two; its first stylesheet and font link are design-refs/footer-02\'s, byte for byte; its footer is footer-02\'s but for the three doors HOME-PAGES-01 moved and the three folds', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['Footer-Reference.html', 'README.md'], 'the folder holds the two files');
  // the first stylesheet is FOOTER-02's, byte for byte, and so is the font link (the README: "Its first stylesheet is `design-refs/footer-02`'s, byte for byte.")
  const styles = stylesOf(whole(REFERENCE));
  const footer02 = stylesOf(whole(FOOTER02_REFERENCE));
  assert.equal(styles.length, 2, 'two stylesheets: FOOTER-02\'s, then this change\'s');
  assert.equal(footer02.length, 1, 'design-refs/footer-02 has one');
  assert.equal(styles[0], footer02[0], 'the first is design-refs/footer-02\'s, byte for byte');
  assert.ok(styles[0].length > 7000, `and was read (${styles[0].length} characters)`);
  const link = (file: string): string => { const m = whole(file).match(/<link rel="stylesheet" href="[^"]+">/g) ?? []; assert.equal(m.length, 1, `${file}: one font link`); return m[0]; };
  assert.equal(link(REFERENCE), link(FOOTER02_REFERENCE), 'and its font link is FOOTER-02\'s');
  assert.ok(flat(whole(README)).includes('Its first stylesheet is `design-refs/footer-02`\'s, byte for byte. Its second stylesheet is what this change adds: every value in it is the design.'), 'as its README says');
  // its footer is FOOTER-02's markup but for the three doors HOME-PAGES-01 moved, as main draws them, and the three folds — each fold's row, and
  // the id and data-folded its list carries
  const rows = (tokens: string[]): string[] => {
    const out: string[] = [];
    let inRow = false;
    for (const t of tokens) {
      if (inRow) { if (t === '</button>') inRow = false; continue; }
      if (t.startsWith('<button ') && t.includes(' class="ft-fold"')) { inRow = true; continue; }
      out.push(t.startsWith('<ul ') ? t.replace(' data-folded="true"', '').replace(/ id="ft-(?:story|services|record)"/, '') : t);
    }
    return out;
  };
  const MOVED: ReadonlyArray<readonly [drawn: string, built: string]> = [['/#stop-0', ABOUT_PATH], ['/#modules', FINANCIAL_SOFTWARE_PATH], ['/#services', PROFESSIONAL_SERVICES_PATH]];
  const door = (href: string): string => `<a class="ft-link" href="${href}">`;
  const footer02Doors = tokensOf(footerOf(FOOTER02_REFERENCE), false).map((t) => { const moved = MOVED.find(([drawn]) => t === door(drawn)); return moved ? door(moved[1]) : t; });
  assert.deepEqual(rows(tokensOf(footerOf(REFERENCE), false)), footer02Doors, 'the reference\'s footer, its folds set aside, is FOOTER-02\'s with the three doors main draws');
  assert.equal(count(footerOf(REFERENCE), '<button class="ft-fold"'), 3, 'and it draws three folds');
});

// ── T2 · THE BLOCK ───────────────────────────────────────────────────────────

test('T2 the port\'s new rules ARE the reference\'s second stylesheet, declaration by declaration, behind the house prefix; at the foot of FOOTER-02\'s port, directly above HERO-CREST-01\'s header; two tokens read, none added, no colour typed; each override after the rule it overrides, at its specificity or one class above, never !important; nothing outside the port reaches a fold', () => {
  // ruling e, its first sentence: "THE PHONE RULES END FOOTER-02'S PORT, after its last rule and directly above HERO-CREST-01's header: under 1024px they override its rules, at the same specificity."
  const block = declarations(blockCss());
  assert.deepEqual(block, secondPorted(), 'the block is the reference\'s second stylesheet, renamed, rule for rule and value for value');
  assert.equal(block.length, 48, `the block was read (${block.length} declarations)`);
  assert.deepEqual([...new Set(block.map((d) => d.split(' | ')[0]))], ['', '@media (max-width: 1023.98px)'], 'one rule at every width — a fold\'s row, not drawn — then the rest under 1024px');
  assert.deepEqual(block.filter((d) => d.startsWith(' | ')), [' | .ts-ft-fold | display: none'], 'the rule at every width hides a row only the folds draw (ruling i)');
  // its seat: after FOOTER-02's last rule, with nothing but comments between; directly above HERO-CREST-01's header, with nothing between
  const css = code(GLOBALS);
  const w = whole(GLOBALS);
  const port = css.indexOf(PORT_OPEN);
  const at = css.indexOf(BLOCK_OPEN);
  const hero = css.indexOf(NEXT_PORT);
  assert.ok(port > -1 && port < at && at < hero, 'FOOTER-02\'s port → this block → the hero\'s rules');
  const footer02 = declarations(css.slice(port, at));
  assert.equal(footer02[footer02.length - 1], '@media (prefers-reduced-motion: reduce) | .ts-ft-link, .ts-ft-legal__link, .ts-ft-link__stop, .ts-ft-link__icon, .ts-ft-link__out | transition: none', 'FOOTER-02\'s last rule, its reduced-motion one, stands directly before it');
  assert.match(css.slice(css.lastIndexOf('}', at) + 1, at), /^\s*$/, 'with nothing but comments between');
  const blockEnd = at + css.slice(at, hero).trimEnd().length;
  const heroHeader = w.indexOf(HERO_HEADER);
  assert.ok(heroHeader > at && heroHeader < hero, 'HERO-CREST-01\'s header stands between the block and the hero\'s rules');
  assert.ok(blockEnd < heroHeader, 'the block\'s last rule ends above HERO-CREST-01\'s header — every rule of it, not only its first');
  assert.match(w.slice(blockEnd, heroHeader + 1), /^\s*$/, 'directly above HERO-CREST-01\'s header: nothing between the block\'s last rule and it');
  const headers = [...w.matchAll(/\n\/\* ── ([A-Z]+(?:-[A-Z]+)*-\d+) \(/g)].map((m) => m[1]);
  assert.deepEqual(headers.slice(-2), ['FOOTER-02', 'HERO-CREST-01'], 'its note is no block\'s header: it ends FOOTER-02\'s block, and HERO-CREST-01\'s stays the last');
  // its colours: tokens — rgb() wraps --ts-fs-white, the gold is --ts-hero-gold; both in :root at the README's values; none typed, none added
  const text = blockCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.deepEqual([...text.matchAll(/rgba?\(/g)].length, 2, 'rgb() twice');
  assert.deepEqual([...text.matchAll(/rgb\((var\(--[\w-]+\)) \/ ([\d.]+)\)/g)].map((m) => `${m[1]} / ${m[2]}`), ['var(--ts-fs-white) / 0.14', 'var(--ts-fs-white) / 0.14'], 'each wrapping --ts-fs-white: the fold\'s hairline and the socials\'');
  assert.deepEqual([...new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))].sort(), ['--ts-fs-white', '--ts-hero-gold'], 'it reads two tokens and nothing else');
  assert.deepEqual(block.filter((d) => d.includes('var(--ts-hero-gold)')), ['@media (max-width: 1023.98px) | .ts-ft-fold | color: var(--ts-hero-gold)'], 'the gold: a fold\'s name and caret');
  const root = rootOf(css);
  assert.equal(root.get('--ts-fs-white'), '255 255 255', '--ts-fs-white, in :root');
  assert.equal(root.get('--ts-hero-gold'), '#F6C95C', '--ts-hero-gold, in :root');
  assert.doesNotMatch(text, /(?:^|[\s;{])--[\w-]+\s*:/, 'it declares no custom property');
  assert.ok(flat(whole(README)).includes('**New with this change: none.**'), 'the README: none new');
  // every class it names is the footer's, behind the prefix
  for (const sel of new Set(block.map((d) => d.split(' | ')[1]))) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-ft(?:$|[-_])/, `${sel}: .${m[1]} is the footer's, behind the prefix`);
  // WHERE IT MEETS FOOTER-02'S RULES — each override after the rule it overrides: two by the same selector, so at the same specificity, and three
  // by one class more, as the reference writes them; nothing here is !important
  assert.doesNotMatch(text, /!important/, 'no !important');
  const ported = declarations(css.slice(port, at));
  /** The properties a selector sets, under 1024px in the block or at every width in FOOTER-02's port. */
  const setBy = (lines: readonly string[], media: string, sel: string): string[] => lines.filter((d) => d.startsWith(`${media} | ${sel} | `)).map((d) => d.split(' | ')[2].split(':')[0]);
  const OVERRIDES: ReadonlyArray<readonly [phone: string, sets: readonly string[], older: string, setting: readonly string[], same: boolean]> = [
    ['.ts-ft-columns', ['display', 'gap', 'margin-top'], '.ts-ft-columns', ['display', 'gap', 'margin-top'], true],
    ['.ts-ft-rule', ['margin'], '.ts-ft-rule', ['margin'], true],
    ['.ts-ft-fold + .ts-ft-list', ['margin'], '.ts-ft-list', ['margin'], false],
    ['.ts-ft-column--socials .ts-ft-list', ['margin-top'], '.ts-ft-list', ['margin'], false],
    ['.ts-ft-column--socials .ts-ft-link__icon', ['width', 'height'], '.ts-ft-link__icon', ['width', 'height'], false],
  ];
  for (const [phone, sets, older, setting, same] of OVERRIDES) {
    for (const p of sets) assert.ok(setBy(block, '@media (max-width: 1023.98px)', phone).includes(p), `${phone}: sets ${p} under 1024px`);
    for (const p of setting) assert.ok(setBy(ported, '', older).includes(p), `${older}: FOOTER-02 sets ${p} at every width`);
    const [x, y] = [specificity(phone), specificity(older)];
    if (same) assert.deepEqual(x, y, `${phone} overrides ${older} at the same specificity, and wins by coming after`);
    else assert.deepEqual([x[0], x[1] - y[1], x[2] - y[2]], [0, 1, 0], `${phone} reaches ${older}'s element through one class more`);
    assert.ok(outranks(x, y) >= 0, `${phone}: never below the rule it overrides`);
  }
  // nothing outside the port reaches a fold — not by its classes, its attributes or its element
  const outside = css.slice(0, port) + css.slice(hero);
  assert.doesNotMatch(outside, /\.ts-ft-fold/, 'no rule outside the port names a fold\'s classes');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1])).filter((sel) => !sel.startsWith('@'));
  assert.ok(selectorsOutside.length > 100, `the rules outside the port were read (${selectorsOutside.length})`);
  for (const sel of selectorsOutside) assert.doesNotMatch(sel, /(?:^|[\s,>+~(])button\b/, `${sel}: no rule outside the port reaches a <button>`);
  // nor by any attribute a fold's elements carry — the row's class, type, aria-expanded and aria-controls; the caret's svg attributes; the list's
  // class, id and data-folded: wherever a rule outside the port names one, the same compound names a class that no element of the footer
  // wears, so it cannot match a fold's element. (HOME-PLANS-05's toggles name aria-expanded so, as .ts-fs-toggle[aria-expanded="true"]: the
  // Financial Software section's own, rebased onto 2026-11-16.) Nor does a rule outside reach a list by its id.
  const FOLD_ATTRIBUTES = ['class', 'type', 'aria-expanded', 'aria-controls', 'aria-hidden', 'width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'id', 'data-folded'];
  const named = selectorsOutside.flatMap(compoundsOf).flatMap((c) => [...c.matchAll(/\[\s*([\w-]+)/g)].map((m) => [c, m[1].toLowerCase()] as const));
  assert.ok(new Set(named.map(([, name]) => name)).size > 5, `the attribute selectors outside the port were read (${[...new Set(named.map(([, name]) => name))].join(', ')})`);
  for (const [compound, name] of named.filter(([, n]) => FOLD_ATTRIBUTES.includes(n))) {
    assert.ok(scopedAway(compound), `${compound}: a rule outside the port names a fold's attribute (${name}) only beside a class of its own, which no element of the footer wears`);
  }
  assert.doesNotMatch(outside, /#ts-ft-/, 'nor reaches a list by its id');
});

// ── T3 · THE RENDER ──────────────────────────────────────────────────────────

test('T3 the footer\'s render is the reference\'s footer as its own script paints it, token for token — folded, with each fold open, and with all three — but for the house prefix, the ids and the crest\'s src; the footer as a page renders it is the folded one', () => {
  const marks = tokensOf(footerOf(REFERENCE), true).filter((t) => t.startsWith('<img '));
  assert.deepEqual(marks, [`<img alt="" class="ts-ft-brand__mark" src="${REFERENCE_MARK}">`], 'the reference\'s one image: the crest, read from its place in the repo');
  assert.equal(resolve(ROOT, FOLDER, REFERENCE_MARK), resolve(ROOT, `public${BAR_MARK_SRC}`), 'the same file the app serves at BAR_MARK_SRC');
  for (const [name, open] of STATES) {
    const drawn = open.map((id) => (FOLDS.find(([, app]) => app === id) as readonly [string, string])[0]);
    const reference = painted(drawn);
    const app = tokensOf(rendered(open), false);
    assert.deepEqual(app, asBuilt(reference), `${name}: the render is the reference's footer, painted, but for the house prefix, the ids and the crest's src`);
    // and what differs from the reference, the prefix aside, is those alone: the crest, and each fold's row and list by their ids
    const prefixedOnly = tokensOf(reference, true);
    assert.equal(app.length, prefixedOnly.length, `${name}: as many tokens as the reference`);
    assert.equal(app.filter((t, i) => t !== prefixedOnly[i]).length, 1 + 2 * FOLDS.length, `${name}: seven tokens differ — the crest, and each fold's row and list — and no eighth`);
    for (const [, id] of FOLDS) {
      assert.equal(count(rendered(open), `aria-expanded="${open.includes(id)}" aria-controls="${id}"`), 1, `${name}: ${id}'s row says ${open.includes(id) ? 'open' : 'folded'}`);
      assert.equal(count(rendered(open), `id="${id}" data-folded="true"`), open.includes(id) ? 0 : 1, `${name}: ${id}'s list ${open.includes(id) ? 'carries no data-folded' : 'carries data-folded'}`);
    }
  }
  assert.ok(tokensOf(rendered([]), false).length > 280, 'the render was read');
  // the footer as a page renders it — the stateful fold at rest — is the folded footer, byte for byte
  assert.equal(renderToStaticMarkup(React.createElement(LandingFooter)), rendered([]), 'the footer, rendered: folded');
  assert.ok(!rendered(['ts-ft-story']).includes('data-folded="false"'), 'an open list carries no data-folded at all — "false" would still match [data-folded]');
});

// ── T4 · THE WORDS ───────────────────────────────────────────────────────────

/**
 * LandingFooter.tsx's literals at main (ac0fc25), read as literalsOf reads them: 72 strings and runs of JSX text, sorted, as one sha256 — the
 * five icon paths, the classes, the hrefs, the disclaimer, © and the four links' words.
 */
const MAIN_FOOTER_LITERALS: readonly [count: number, sha: string] = [72, '298d373a74f9e065f24fff57b77a95f234748135bcecfb638e224de4ba681799'];

test('T4 every word from its home, and no new word: a fold\'s row reads its column\'s label, from the words leaf, where LandingFooter.tsx reads it; the three ids are the only strings LandingFooter.tsx adds, with the fold\'s own path; FooterFold.tsx types no word', () => {
  // ruling d: "NOT ONE WORD IS NEW. A fold's name is its column's label from src/lib/footerWords.ts, read where LandingFooter.tsx reads it today, and the three ids are the only strings added."
  const footer = code(FOOTER);
  const LABELS: ReadonlyArray<readonly [name: string, id: string, list: string, label: string]> = [
    ['FOOTER_STORY_LABEL', 'ts-ft-story', 'ts-ft-list ts-ft-list--stops', FOOTER_STORY_LABEL],
    ['FOOTER_SERVICES_LABEL', 'ts-ft-services', 'ts-ft-list', FOOTER_SERVICES_LABEL],
    ['FOOTER_RECORD_LABEL', 'ts-ft-record', 'ts-ft-list', FOOTER_RECORD_LABEL],
  ];
  for (const [name, id, list, label] of LABELS) {
    assert.equal(count(footer, `<p className="ts-ft-label">{${name}}</p>`), 1, `${name}: drawn in the column's own <p>, as it was`);
    assert.equal(count(footer, `<FooterFold label={${name}} id="${id}" listClassName="${list}">`), 1, `${name}: and handed to its fold, read where it is read for the <p>`);
    // drawn: the row reads the label, and nothing else
    const html = rendered([]);
    const row = html.slice(html.indexOf(`aria-controls="${id}"`), html.indexOf('</button>', html.indexOf(`aria-controls="${id}"`)));
    assert.deepEqual(textsOf(`<button ${row}</button>`), [label], `${label}: the row reads its column's label, and only that`);
  }
  assert.match(footer, /^import \{\n {2}FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS, FOOTER_SOCIALS, FOOTER_SOCIALS_LABEL, FOOTER_STORY_LABEL,\n {2}footerStoryLinks, storyLinkParts, type FooterLink, type SocialName,\n\} from '@\/lib\/footerWords';$/m, 'the labels, from the words leaf, on the import they came in on');
  // every word the render draws, in any state, is one main drew, or a column's label again in its row
  const base = textsOf(rendered([]));
  for (const [name, open] of STATES) assert.deepEqual(textsOf(rendered(open)), base, `${name}: the same words, in the same order — opening a fold draws no word`);
  const labelsTwice = [FOOTER_STORY_LABEL, FOOTER_SERVICES_LABEL, FOOTER_RECORD_LABEL];
  for (const label of labelsTwice) assert.equal(base.filter((t) => t === label).length, 2, `${label}: twice — the column's <p> and its row`);
  assert.equal(base.filter((t) => t === FOOTER_SOCIALS_LABEL).length, 1, `${FOOTER_SOCIALS_LABEL}: once — the socials do not fold`);
  // the three ids are the only strings LandingFooter.tsx adds — and the fold's path, its import: with the four taken out, its literals are main's
  const literals = literalsOf(FOOTER);
  const ADDED = ['ts-ft-story', 'ts-ft-services', 'ts-ft-record', './FooterFold'];
  for (const added of ADDED) assert.equal(literals.filter((l) => l === added).length, 1, `"${added}": typed once`);
  const rest = literals.filter((l) => !ADDED.includes(l)).sort();
  assert.deepEqual([rest.length, sha256(JSON.stringify(rest))], MAIN_FOOTER_LITERALS, 'every other literal is main\'s, as many and the same');
  for (const [, id] of LABELS) assert.deepEqual(srcFiles().filter((f) => code(f).includes(id)), [FOOTER], `${id}: typed in LandingFooter.tsx alone`);
  // FooterFold.tsx types no word: its literals are its directive, its import, its classes, the caret's attributes and the two props it holds
  assert.deepEqual(literalsOf(FOLD).sort(), ['use client', 'react', 'ts-ft-fold', 'button', 'ts-ft-label', 'ts-ft-fold__caret', '14', '14', '0 0 16 16', 'none', 'currentColor', '1.8', 'round', 'round', 'true', 'M4 6l4 4 4-4', 'open', 'onToggle'].sort(), 'FooterFold.tsx: no word, no JSX text — what it draws is handed in');
  assert.doesNotMatch(code(FOLD), /from '@\/lib\/footerWords'/, 'and it reads no words leaf: the label is handed in');
  // footerWords.ts is the words' home still: the four labels in it, typed once
  for (const label of [FOOTER_STORY_LABEL, FOOTER_SERVICES_LABEL, FOOTER_SOCIALS_LABEL, FOOTER_RECORD_LABEL]) assert.equal(count(code(WORDS), `'${label}'`), 1, `"${label}": typed once, in footerWords.ts`);
});

// ── T5 · THE STATE ───────────────────────────────────────────────────────────

test('T5 FooterFold holds one React boolean: closed at first; each press of a row turns its own fold; any number open; nothing stored, nothing in the URL', () => {
  // ruling a: "A press opens that column's links and a second press closes them. All three start closed, and any number can be open."
  const FOLD_PROPS: readonly FooterFoldProps[] = [
    { label: FOOTER_STORY_LABEL, id: 'ts-ft-story', listClassName: 'ts-ft-list ts-ft-list--stops', children: null },
    { label: FOOTER_SERVICES_LABEL, id: 'ts-ft-services', listClassName: 'ts-ft-list', children: null },
    { label: FOOTER_RECORD_LABEL, id: 'ts-ft-record', listClassName: 'ts-ft-list', children: null },
  ];
  // a host draws the three stateful folds as the footer does, one each, and presses a row between renders: React re-renders it with the new state
  const presses = [0, 1, 0, 2, 1, 2];
  const passes: string[] = [];
  const Host = (): null => {
    const folds = FOLD_PROPS.map((props) => FooterFold(props) as React.ReactElement<FooterFoldViewProps>);
    for (const [i, el] of folds.entries()) {
      assert.equal(el.type, FooterFoldView, 'the stateful fold draws the pure view');
      assert.deepEqual([el.props.label, el.props.id, el.props.listClassName], [FOLD_PROPS[i].label, FOLD_PROPS[i].id, FOLD_PROPS[i].listClassName], 'handing it what it was handed');
    }
    passes.push(folds.map((el) => (el.props.open ? 'O' : '-')).join(''));
    if (passes.length <= presses.length) folds[presses[passes.length - 1]].props.onToggle();
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  assert.deepEqual(passes, ['---', 'O--', 'OO-', '-O-', '-OO', '--O', '---'], 'closed at first; each press turns its own; any number open; a second press closes');
  // the view: the row's press is the press handed in
  const pressed: string[] = [];
  for (const open of [false, true]) {
    const view = FooterFoldView({ label: FOOTER_STORY_LABEL, id: 'ts-ft-story', listClassName: 'ts-ft-list', children: null, open, onToggle: () => pressed.push(String(open)) });
    const button = elementsOf(view).find((el) => el.type === 'button') as React.ReactElement<{ onClick: () => void; type: string; 'aria-expanded': boolean; 'aria-controls': string }>;
    assert.deepEqual([button.props.type, button.props['aria-expanded'], button.props['aria-controls']], ['button', open, 'ts-ft-story'], `${open ? 'open' : 'folded'}: a button of type button, saying so, naming its list`);
    button.props.onClick();
  }
  assert.deepEqual(pressed, ['false', 'true'], 'a press of the row is the press handed in, open or folded');
  // nothing stored, nothing in the URL: the fold's only state is its one boolean
  const fold = code(FOLD);
  assert.equal(count(fold, 'useState('), 1, 'one state');
  assert.match(fold, /const \[open, setOpen\] = useState\(false\);/, 'a boolean, false at first');
  assert.doesNotMatch(fold, /useEffect|useLayoutEffect|useReducer|useRef|useContext|localStorage|sessionStorage|indexedDB|caches\b|cookieStore|document\.|window\.|globalThis|navigator|location\b|history\b|searchParams|useRouter|usePathname|\bfetch\s*\(/, 'nothing stored, nothing read from or written to the URL, no effect');
  // the stateful fold, whole: its one boolean, the view it draws and the press that turns it — nothing else rides on a press
  assert.equal(count(fold, "export default function FooterFold(props: FooterFoldProps) {\n  const [open, setOpen] = useState(false);\n  return <FooterFoldView {...props} open={open} onToggle={() => setOpen((wasOpen) => !wasOpen)} />;\n}"), 1, 'the stateful fold, whole');
});

// ── T6 · THE ISLAND ──────────────────────────────────────────────────────────

test('T6 LandingFooter.tsx still with no directive, importing plain modules and FooterFold.tsx, its one client module, and handing each fold its name, its list\'s id and class and the links; FooterFold.tsx \'use client\', importing React alone', () => {
  // ruling c, its first sentences: "THE FOOTER STAYS A SERVER COMPONENT, WITH ONE CLIENT ISLAND. A fold's state lives in FooterFold.tsx, a client component that draws the row and the list it opens."
  const footer = code(FOOTER);
  assert.doesNotMatch(footer, /^\s*['"]use (client|server)['"]/m, 'LandingFooter.tsx: no directive — a server component where a server page renders it');
  assert.deepEqual(importsOf(FOOTER), ['react', 'next/link', '@/lib/wasHere', '@/lib/brandLockup', '@/lib/footerWords', './FooterFold'], 'its imports: React (a type), next/link, the log, the lockup\'s leaf, the words leaf — and the fold');
  for (const leaf of ['src/lib/wasHere.ts', 'src/lib/brandLockup.ts', WORDS]) assert.doesNotMatch(code(leaf), /^\s*['"]use (client|server)['"]/m, `${leaf}: a plain module, no directive`);
  assert.match(footer, /^import FooterFold from '\.\/FooterFold';$/m, 'the fold, its default export');
  // the island: 'use client' first, React alone
  const fold = code(FOLD);
  assert.ok(fold.startsWith("'use client';\n"), 'FooterFold.tsx: \'use client\', first');
  assert.deepEqual(importsOf(FOLD), ['react'], 'importing React alone');
  assert.match(fold, /^import \{ useState, type ReactNode \} from 'react';$/m, 'its state, and a type');
  assert.deepEqual([...fold.matchAll(/^export (?:default )?(?:function|type|interface|const) (\w+)/gm)].map((m) => m[1]), ['FooterFoldViewProps', 'FooterFoldView', 'FooterFoldProps', 'FooterFold'], 'it exports the view, the fold, and their props\' types');
  // what LandingFooter.tsx hands each fold: the column's name, the list's id and class, and the links — strings and elements, nothing a server
  // component cannot hand a client one
  const folds = elementsOf(LandingFooter()).filter((el) => el.type === FooterFold) as Array<React.ReactElement<FooterFoldProps>>;
  assert.equal(folds.length, 3, 'three folds');
  assert.deepEqual(folds.map((el) => [el.props.label, el.props.id, el.props.listClassName]), [
    [FOOTER_STORY_LABEL, 'ts-ft-story', 'ts-ft-list ts-ft-list--stops'],
    [FOOTER_SERVICES_LABEL, 'ts-ft-services', 'ts-ft-list'],
    [FOOTER_RECORD_LABEL, 'ts-ft-record', 'ts-ft-list'],
  ], 'Our Story, Services and The Record, in order, each with its name, its list\'s id and its class');
  for (const el of folds) {
    assert.deepEqual(Object.keys(el.props).sort(), ['children', 'id', 'label', 'listClassName'], `${el.props.id}: four props`);
    for (const value of Object.values(el.props)) assert.notEqual(typeof value, 'function', `${el.props.id}: no function crosses to the client`);
  }
  // the links, still LandingFooter.tsx's: each fold's children are its column's rows, one per link
  assert.deepEqual(folds.map((el) => React.Children.count(el.props.children)), [footerStoryLinks(WAS_HERE).length, FOOTER_SERVICES_LINKS.length, FOOTER_RECORD_LINKS.length], 'one row per link, as the footer draws them');
  assert.equal(count(footer, '{footerStoryLinks(WAS_HERE).map((link) => {'), 1, 'Our Story\'s rows, drawn here');
  // the socials are no fold: their column draws its own list, as it did (ruling b: "Their markup does not change.")
  assert.equal(count(footer, '<ul className="ts-ft-list">'), 1, 'one <ul> typed in LandingFooter.tsx: the socials\'');
  // Alex's answer to the audit (2026-11-16): the seven notes that describe the public pages' import closure — HOME-PAGES-01's, in the auth file
  // and in the three pages ruling i keeps — stand as written, and the change is recorded beside the change: one dated sentence in the fold's
  // header, citing each note by its lines. Read here by content, so those citations cannot drift.
  assert.ok(prose(FOLD).includes("THE PUBLIC PAGES' IMPORT CLOSURE (HOME-PHONE-01, 2026-11-16, Alex's answer to the audit): this file joins the import closure of the public pages that mount the footer — it imports React alone and reads no data — and the seven notes that describe that closure stand as written (src/middleware.ts:78-80, :89-90, :99-100 and :110-111; src/app/financial-software/page.tsx:30-31, src/app/professional-services/page.tsx:24-25 and src/app/about/page.tsx:33)."), 'FooterFold.tsx says it joins the closure, and that the seven notes stand as written');
  const linesOf = (file: string, from: number, to: number): string => flat(comments(file).split('\n').slice(from - 1, to).map((line) => line.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)?\s?/, '')).join(' '));
  const SEVEN: ReadonlyArray<readonly [file: string, from: number, to: number, holds: string]> = [
    ['src/middleware.ts', 78, 80, 'Each proof below was read over the whole import closure of the six components the pages mount — 28 files: the 27 the audit read, and this change\'s own leaf, src/lib/homePages.ts'],
    ['src/middleware.ts', 89, 90, 'its imports are LandingHeader, the section, LandingFooter and the pure leaves they read'],
    ['src/middleware.ts', 99, 100, 'its imports are LandingHeader, the section, LandingFooter and the pure leaves they read'],
    ['src/middleware.ts', 110, 111, 'its imports are LandingHeader, the two sections, LandingFooter and the pure leaves they read'],
    ['src/app/financial-software/page.tsx', 30, 31, 'Its imports are the bar, the section, the footer and the pure leaves they read.'],
    ['src/app/professional-services/page.tsx', 24, 25, 'Its imports are the bar, the section, the footer and the pure leaves they read.'],
    ['src/app/about/page.tsx', 33, 33, 'Its imports are the bar, the two sections, the footer and the pure leaves they read.'],
  ];
  for (const [file, from, to, holds] of SEVEN) assert.ok(linesOf(file, from, to).includes(holds), `${file}, lines ${from} to ${to}: "${holds.slice(0, 50)}…", as written`);
});

// ── T7 · THE RULINGS ─────────────────────────────────────────────────────────

test('T7 each ruling quoted, exact, where it is built; what the folds made false re-said beside it, dated, and main\'s words gone; the legal links re-cited, newest first, and no other cited line moved; no quote under the boards\' stamps added; the census of this brief\'s quotes', () => {
  const quoted = (file: string, words: string): boolean => prose(file).includes(`"${flat(words)}"`);
  /** A sentence of a ruling, from its start to its full stop — the form a file quotes where it builds that part alone. */
  const sentence = (text: string, opens: string): string => { const at = text.indexOf(opens); assert.ok(at > -1, `"${opens}" opens a sentence`); const end = text.indexOf('. ', at); return text.slice(at, end < 0 ? text.length : end + 1); };
  // ruling g: "THE OTHER CENSUSES ARE LEFT AS THEY ARE: homeTrim01's, homeTrim02's, homeTrim03's and homePages01's, and homeAbout02's, homePlans05's and homeMenu01's when they land. Other briefs' quotes are written around, and none is quoted where it was not already. Alex's 2026-11-14 approvals appear by their times, never by their words."
  // ruling h: "HOME-PHONE-01'S QUOTES CARRY ITS TIMES: 2026-11-14 20:01 and 20:41 Manila for the boards, and 2026-11-16 01:42 Manila for the ask. Each ruling here is quoted word for word, worded to keep clear of every other census."
  const BUILT: ReadonlyArray<readonly [file: string, words: readonly string[]]> = [
    [FOLD, [RULING.a, RULING.c]],
    [FOOTER, [RULING.a, RULING.c, RULING.d, RULING.f]],
    [GLOBALS, [sentence(RULING.a, 'Under 1024px the row'), RULING.b, RULING.e, RULING.f, RULING.i]],
    [tests('footer02'), [sentence(RULING.e, 'footer02 T3 is re-said'), sentence(RULING.a, 'In Our Story'), sentence(RULING.c, 'A fold\'s state'), sentence(RULING.f, 'Among them')]],
    [tests('footer01'), [sentence(RULING.a, 'In Our Story')]],
    [THIS, [RULING.d, RULING.g, RULING.h]],
  ];
  for (const [file, words] of BUILT) {
    assert.ok(prose(file).includes('HOME-PHONE-01'), `${file} names the brief`);
    assert.ok(prose(file).includes('2026-11-16'), `${file} dates it`);
    for (const w of words) assert.ok(quoted(file, w), `${file} quotes "${w.slice(0, 50)}…", exact`);
  }
  // the ask, under its stamp, where the brief opens in each new note; the boards by their times, never by their words (ruling g)
  for (const file of [FOLD, FOOTER, GLOBALS, THIS]) {
    assert.ok(prose(file).includes(`2026-11-16 01:42 Manila — his ask: "${ASK}"`), `${file}: his ask, under its stamp`);
    assert.ok(prose(file).includes('2026-11-14 at 20:01 and, corrected, at 20:41 Manila'), `${file}: the boards, by their times`);
  }

  // RULING F — WHAT THE FOLDS MADE FALSE, RE-SAID BESIDE IT, dated; main's words gone where they were rewritten
  const RESAID: ReadonlyArray<readonly [file: string, now: RegExp, gone: RegExp | null]> = [
    [FOOTER, /README beside it; and under 1024px, since HOME-PHONE-01 \(2026-11-16\), a second, design-refs\/home-phone-01\/Footer-Reference\.html, whose first stylesheet is that one byte for byte and whose markup adds the three folds \("The spec is a file" said the whole of it until then\)/, /with its README beside it\. This file renders/],
    [FOOTER, /This file renders that markup, tag for tag — and, since HOME-PHONE-01 \(2026-11-16\), the three folds, each drawn by FooterFold\.tsx \("This file renders that markup, tag for tag" said the whole of it until then\)/, /This file renders that markup, tag for tag, each class/],
    [FOOTER, /ported to src\/app\/globals\.css's FOOTER-02 block, and at the block's foot, since HOME-PHONE-01 \(2026-11-16\), design-refs\/home-phone-01's second stylesheet \("the rules are the reference's own" said the whole of them until then\)/, /ported to src\/app\/globals\.css's FOOTER-02 block\. The design adds/],
    [FOOTER, /its label a <p>, its links a <ul>, and in OUR STORY, SERVICES and THE RECORD a fold's row between the two since HOME-PHONE-01 \(2026-11-16:/, /its label a <p>, its links a <ul> — every word/],
    [FOOTER, /and, since HOME-PHONE-01, 2026-11-16, the three folds, which design-refs\/home-phone-01\/Footer-Reference\.html draws: against that file's footer the differences are the crest's src and the three lists' ids/, null],
    [GLOBALS, /and its markup is the footer\." \(HOME-PHONE-01, 2026-11-16: and, for the footer under 1024px, design-refs\/home-phone-01\/Footer-Reference\.html, whose first stylesheet is that one byte for byte; "THE SPEC IS design-refs\/footer-02\/Section-Reference\.html" said the whole of it until then\.\)/, null],
    [GLOBALS, /ported as HERO-CREST-01's, HOME-PLANS-04's and HOME-ABOUT-01's were \(HOME-PHONE-01, 2026-11-16: then, after its last rule, the footer under 1024px/, null],
    [GLOBALS, /but for the THREE DIFFERENCES named here — each one where the reference is a page of its own and this is the app \(HOME-PHONE-01, 2026-11-16: up to the phone rules at the block's foot/, null],
    [GLOBALS, /from 1280px\. \(HOME-PHONE-01, 2026-11-16: under 1024px the phone rules at the block's foot override the first two where they meet — the columns stand one under another, three of them folded, the socials last as five marks, the hairline closer — and the rest of the two draws as before, the stops' two columns from 640px among it; until then nothing at the block's foot overrode them\.\)/, /draw as the reference has them from 1024px alone/],
    [GLOBALS, /Used by src\/components\/landing\/LandingFooter\.tsx \(and, since HOME-PHONE-01, 2026-11-16, by src\/components\/landing\/FooterFold\.tsx, which it draws in three columns\), on its eight mounts/, /Used by src\/components\/landing\/LandingFooter\.tsx, on its eight mounts/],
    [GLOBALS, /then The Record across \(HOME-PHONE-01, 2026-11-16: no width draws this now/, null],
    [GLOBALS, /its columns stand on the columns beneath it \(HOME-PHONE-01, 2026-11-16: from 1024px/, null],
    [GLOBALS, /Services and Socials in halves; the stops in two columns, on those halves \(HOME-PHONE-01, 2026-11-16: the stops' two columns stand; the halves are drawn at no width now/, null],
    [tests('footer02'), /with its README beside it — and, under 1024px since HOME-PHONE-01 \(2026-11-16\), a second, design-refs\/home-phone-01's, which homePhone01\.test\.ts holds \("The spec is a file" said the whole of it until then\)/, null],
    [tests('footer02'), /its stylesheet is the reference's own, ported to src\/app\/globals\.css's FOOTER-02 block under the house prefix — and, at that block's foot since HOME-PHONE-01 \(Alex's brief, 2026-11-16 01:42 Manila\)/, null],
    [tests('footer02'), /— to the reference's last rule, and then the phone rules: HOME-PHONE-01, 2026-11-16, ruling e,/, null],
    [tests('footer02'), /T4 the markup — the footer's render, its three folds set aside since HOME-PHONE-01 \(2026-11-16:/, /T4 the markup — the footer's render is the reference's <footer>/],
    [tests('footer02'), /every class worn is ruled — the phone rules rule the two the reference itself draws without a rule \(HOME-PHONE-01, 2026-11-16, ruling f;/, /every class worn is ruled but the two the reference itself draws without a rule;/],
    [tests('footer02'), /label <p> and its <ul>, and in OUR STORY, SERVICES and THE RECORD a fold's row between the two \(HOME-PHONE-01, 2026-11-16:/, /label <p> and its <ul>; one stop row/],
    [tests('footer02'), /imports plain modules and src\/components\/landing\/FooterFold\.tsx, its one client module \(HOME-PHONE-01, 2026-11-16, ruling c:/, /and imports only plain modules\. Source/],
    [tests('footer02'), /it is in the PR\. \(HOME-PHONE-01, 2026-11-16: from 1024px against this reference still; under 1024px against design-refs\/home-phone-01's, folded and open, in that PR/, null],
    [tests('footer01'), /The footer is the reference's markup now \(design-refs\/footer-02\/Section-Reference\.html\), in its classes behind the house prefix; its look is held by src\/lib\/__tests__\/footer02\.test\.ts\. \(HOME-PHONE-01, 2026-11-16: and three folds/, null],
    [tests('footer01'), /each column is its label, then a <ul> of ITS OWN links — and, in OUR STORY, SERVICES and THE RECORD, its fold's row between the two; nothing else/, /each column is its label, then a <ul> of ITS OWN links — nothing else \(attribute/],
  ];
  for (const [file, now, gone] of RESAID) {
    assert.match(prose(file), now, `${file}: its note re-said, dated, saying what it said until then`);
    if (gone) assert.doesNotMatch(prose(file), gone, `${file}: and main's sentence is gone`);
  }
  // and the tests' titles re-said — strings, so read in the code: the re-said words stand, and main's are gone
  const TITLES: ReadonlyArray<readonly [file: string, now: string, gone: string]> = [
    [tests('footer02'), 'and then the phone rules (HOME-PHONE-01); the four width tiers, then the phone rules\\\' one;', 'but for its :root and THIS PAGE\\\'S OWN; the four width tiers; no hex'],
    [tests('footer02'), 'T4 the footer\\\'s render, its three folds set aside (HOME-PHONE-01), is the reference\\\'s footer', 'T4 the footer\\\'s render is the reference\\\'s footer'],
    [tests('footer02'), 'the four hooks in order, three with a fold\\\'s row between label and list (HOME-PHONE-01)', 'the lockup; the four hooks in order; a stop row'],
    [tests('footer02'), 'imports plain modules and FooterFold.tsx, its one client module (HOME-PHONE-01: "imports plain modules only" until then)', 'the footer carries no directive and imports plain modules only\''],
  ];
  for (const [file, now, gone] of TITLES) {
    assert.ok(code(file).includes(now), `${file}: a title re-said — "${now}"`);
    assert.ok(!code(file).includes(gone), `${file}: and main's title is gone — "${gone}"`);
  }

  // the legal links, re-cited in GUEST_ROUTES where FOOTER-02 re-cited them, newest first — each on the line it stood on
  const lines = code(FOOTER).split('\n');
  const lineOf = (re: RegExp): number => { const at = lines.flatMap((l, i) => (re.test(l) ? [i + 1] : [])); assert.equal(at.length, 1, `${re}: one line`); return at[0]; };
  const law = code(LAW).split('\n');
  for (const [row, re, was] of [
    [222, />PRICING<\/Link>/, "LandingFooter.tsx:%d (HOME-PHONE-01, 2026-11-16: was :167; FOOTER-02, 2026-11-12: was :131; HOME-FINISH-02, 2026-11-10: was :98; FOOTER-01, 2026-11-09: was :54), the HomeClient header' },"],
    [223, />PRIVACY<\/Link>/, "{ route: '/privacy', why: 'LandingFooter.tsx:%d (HOME-PHONE-01, 2026-11-16: was :169; FOOTER-02, 2026-11-12: was :133; HOME-FINISH-02, 2026-11-10: was :100; FOOTER-01, 2026-11-09: was :56), PUBLIC_PATHS' },"],
    [224, />TERMS<\/Link>/, "{ route: '/terms', why: 'LandingFooter.tsx:%d (HOME-PHONE-01, 2026-11-16: was :168; FOOTER-02, 2026-11-12: was :132; HOME-FINISH-02, 2026-11-10: was :99; FOOTER-01, 2026-11-09: was :55), PUBLIC_PATHS' },"],
  ] as const) {
    assert.ok(law[row - 1].includes(was.replace('%d', String(lineOf(re)))), `the law's line ${row}: re-cited to LandingFooter.tsx:${lineOf(re)}, newest first`);
  }
  assert.match(law[221], /^ {2}\{ route: '\/how-pricing-works', why: 'LandingHeader\.tsx:\d+ \([^)]*\), LandingFooter\.tsx:/, 'the header\'s half of its row stands before the footer\'s, as it did');
  // no other cited line moved: the law's lines a test reads by number, and the files held to their length
  assert.ok(law[224].includes("{ route: '/work-with-me', why:"), 'the law\'s line 225, which intakeForm01 and homePages01 read, where it stood');
  assert.equal(law[709].slice(0, 60), "{ const before = violations.length; violations.push(...servi", 'the law\'s line 710, which homeServices01, services01 and homeTrim03 read, where it stood');
  for (const [file, n] of [[LANDING, 815], [LAW, 11254]] as const) assert.equal(whole(file).split('\n').length - 1, n, `${file}: ${n} lines, as it was`);

  // EVERY FILE OF THE CHANGE — the seven: this test, the fold, the footer, the stylesheet, the law, and the two tests re-pointed
  const CHANGED = [THIS, FOLD, FOOTER, GLOBALS, LAW, tests('footer01'), tests('footer02')];
  for (const file of CHANGED) assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
  // ruling g: Alex's 2026-11-14 approvals by their times, never by their words — no quote stands under the boards' stamps in any of the seven
  // but where one stood: the stamped quotes each file held at main, held at main's count
  const STAMPED: Readonly<Record<string, readonly [number, number, number]>> = {
    [THIS]: [0, 0, 0], [FOLD]: [0, 0, 0], [FOOTER]: [0, 0, 0], [GLOBALS]: [0, 0, 0], [LAW]: [0, 0, 0], [tests('footer01')]: [0, 0, 0], [tests('footer02')]: [0, 0, 0],
  };
  for (const file of CHANGED) {
    const said = prose(file);
    const stamped = [/19:11 Manila: "/g, /20:01 Manila: "/g, /20:41(?: Manila)?: "/g].map((re) => [...said.matchAll(re)].length);
    assert.deepEqual(stamped, STAMPED[file], `${file}: no quote under the 2026-11-14 stamps added (19:11, 20:01, 20:41)`);
    for (const m of said.matchAll(/01:42 Manila(?: — his ask)?: "([^"]+)"/g)) assert.equal(m[1], ASK, `${file}: under the 01:42 stamp, his ask, exact`);
  }
  // HIS WORDS ARE THE TEN BELOW: his ask and the nine rulings. A straight double mark followed by twenty or more characters of one of their
  // sentences, from the sentence's start, opens a quote of the brief: what stands from there to the closing mark is its words from that sentence
  // on — to the end of the piece on file, or to a full stop — or this fails and says where the two part. A whole sentence shorter than that is
  // read too, and counted. Each file's count is held. (homeTrim03's census.)
  const HIS_WORDS = [ASK, ...Object.values(RULING)];
  assert.equal(HIS_WORDS.length, 10);
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
          else if (n >= 20) parted = `a quote follows a sentence of the brief for ${n} characters ("${rest.slice(0, n)}"), then goes on "${rest.slice(n, n + 24)}…" where the piece on file goes on "${text.slice(from + n, from + n + 24)}…"`;
        }
      }
      assert.ok(his || parted === '', `${file}: ${parted}`);
      if (his) census[file] = (census[file] ?? 0) + 1;
    }
  }
  assert.deepEqual(census, {
    [THIS]: 9, // the header: his ask; T2: ruling e's first sentence; rendered(): ruling c's last; T4: ruling d; T5: ruling a's fourth and fifth sentences; T6: ruling c's first two and ruling b's last; T7: rulings g and h
    [FOLD]: 3, // his ask; rulings a and c
    [FOOTER]: 5, // his ask; rulings a, c, d and f
    [GLOBALS]: 6, // his ask; ruling a's last sentence; rulings b, e, f and i
    [tests('footer01')]: 1, // ruling a's second sentence, at T4's shape
    [tests('footer02')]: 7, // ruling e's third sentence at T3 and ruling c's second at T8, each in the header and in the test; ruling a's second sentence at T4 and T5; ruling f's second at T4's classes
  }, 'each file\'s quotes of the brief, counted — thirty-one in six of the seven: a quote that stood and no longer opens on its words leaves its file\'s count, and fails here');
});
