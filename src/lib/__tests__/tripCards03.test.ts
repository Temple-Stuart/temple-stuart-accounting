/**
 * TRIPCARDS-03 (Alex's brief, 2026-11-12 21:08 Manila; the board approved on the design canvas at 21:21) — OUR STORY: THE STOP CARDS,
 * AS DRAWN. The eyebrow, the heading and its line; two arrows; one row of stop cards, edge to edge of the section, its first card under
 * the heading. Each card shows its photo whole, then the stop and how it stands, the place, the dates, what it cost, and the post.
 *
 * The spec is a file: design-refs/tripcards-03/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is
 * the page as it opens on 2026-11-12"), with its README beside it. The section is src/components/landing/WasHereSection.tsx, which
 * Landing.tsx mounts; its stylesheet is the reference's own, ported to src/app/globals.css under the house prefix; the photos' law is
 * src/lib/photoSize.ts, run by the trip log law in scripts/assert-tool-registry.ts.
 *
 *   T1  the handoff landed — the README and the reference, byte for byte (sha256) and by size; the folder holds the two; the reference
 *       reads the photos from public/was-here/ and nothing else but the fonts;
 *   T2  the tokens — the README's two tables (five already in the app, ten HOME-PLANS-04 brought), each the reference's value behind
 *       the house prefix in globals.css :root, declared once; the reference's :root holds those fifteen and no other; "New with this
 *       section: none" — the port declares no property and every one of the fifteen is read;
 *   T3  the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for the five differences
 *       named there (the last two Alex's notes on the cards as built, applied as named edits); no hex, no rgb value typed, no gradient; every
 *       class behind the prefix; every variable it reads declared; it stands directly above the CHIP-FADE comment, under the marquee's
 *       keyframes; nothing else in the file reaches the section; the classes the section wears and the classes the port rules are the same;
 *   T4  the page at rest — the section's render on 2026-11-12 IS the reference's markup, token for token (classes behind the prefix,
 *       attributes in any order, entities read as the characters they are), but for a photo's path in the app and Alex's two notes: the
 *       row in the page container, and the dots under it;
 *   T5  the card — the stop line from the day (no chip once he has left, COMING UP outlined, I'M HERE filled with its dot), the ring on
 *       the stop he is at, on other days too; each amount's kind from the data, never from the words, painted by the port; the photo
 *       whole, out of the tab order; a stop with no photo has no frame and no credit;
 *   T6  the row at work — where the row stands and when a card is cut, as pure functions; the arrows name the row, say their ends, move
 *       one card, at once under reduced motion, and move nothing at an end; a focused card comes into view whole; the keyboard's order;
 *       the port's rules for all of it; nothing stored;
 *   T7  the words — every word drawn is its home's, in order; the JSX types none; the two new words live beside Read the post →;
 *   T8  the photo law — each header read (a JPEG's frame header and EXIF orientation; a WebP's VP8, VP8L, VP8X), every refusal by name;
 *       the nine photos on disk as their headers say, each within 1%; the law's photo line holds the clause with no line added; no
 *       dependency; the seeds on file, each expecting the clause's own words;
 *   T9  the rulings — Alex's brief and approval quoted exact wherever quoted; the two reversed rulings named with his words; the heading
 *       violet (no word of gold launched this run); About Us untouched;
 *   T10 Alex's notes on the cards as built (2026-11-12) — the row in the page, whole cards only (one, two from 768px, three from 1024px:
 *       the plan cards' own columns), at rest on a card; under 768px one card at a time and the dots, one per stop, the one in view lit,
 *       a picture and not controls; the card in view as a pure function; his words quoted exact wherever quoted.
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject: the digests, the
 * reference (HTML, which the reader splits as TypeScript) and the README's tables. A photo's bytes are read through photoSize.ts's
 * photoBytes(), the one place they are read. No clock, no live call. What a browser must show — the look at 1440 and 390, the row
 * moving one card per arrow, a focused card brought into view, the frame holding its space before its photo loads — cannot be held
 * here; it is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { stayWords, stopLabel, stopStatus, stopWords, tripOrder } from '../wasHereWords';
import { TRIP_COSTS, type TripCosts } from '../tripCosts';
import { NOT_APPLICABLE, NOT_IN_LOG, STOP_COST_LABELS, stopCostRows } from '../tripPostWords';
import { OUR_STORY_HEADING } from '../homeActWords';
import { MY_TRIP_ANCHOR } from '../homeAnchors';
import { THREE_TWO_TOLERANCE, headerSize, jpegSize, offThreeTwo, photoBytes, photoShapeViolations, webpSize } from '../photoSize';
import WasHereSection, {
  EARLIER_STOPS, LATER_STOPS, MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, READ_THE_POST, ROW_AS_IT_OPENS, STORY_ROW_ID, WasHereView, cardAtStart, cardCut, rowEnds,
} from '@/components/landing/WasHereSection';
import { SEEDS as TRIPCARDS_SEEDS } from '../../../scripts/proofs/tripcards03.seeds';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const README = 'design-refs/tripcards-03/README.md';
const REFERENCE = 'design-refs/tripcards-03/Section-Reference.html';
const GLOBALS = 'src/app/globals.css';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const COST_WORDS = 'src/lib/tripPostWords.ts';
const LEAF = 'src/lib/wasHere.ts';
const PHOTO_LAW = 'src/lib/photoSize.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS_FILE = 'scripts/proofs/tripcards03.seeds.ts';
const STOP_ZERO = 'src/components/landing/StopZeroSection.tsx';
/** The day the reference's markup is the page as it opens. */
const DAY = '2026-11-12';
/** The act headings' type (HOME-FINISH-02) — the gold Our Story wore until this board. */
const ACT_HEADING_TYPE = 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** HTML's entities, read as the characters they are (React writes ' as &#x27;, the reference types it). */
const decode = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const render = (today: string, rows: readonly WasHereRow[] = WAS_HERE, costs: readonly TripCosts[] = TRIP_COSTS): string => renderToStaticMarkup(React.createElement(WasHereView, { rows, costs, today }));
const cardOf = (html: string, id: string): string => { const at = html.indexOf(`data-was-here="${id}"`); const next = html.indexOf('data-was-here="', at + 1); return html.slice(at, next < 0 ? undefined : next); };
const row = (id: string): WasHereRow => { const found = WAS_HERE.find((r) => r.id === id); assert.ok(found, `${id} is a stop`); return found; };
const costsOf = (id: string): TripCosts => { const found = TRIP_COSTS.find((c) => c.stopId === id); assert.ok(found, `${id} has its costs`); return found; };
const TRIP = tripOrder(WAS_HERE).map((r) => r.id);

// ── the stylesheets, read as lists of declarations ───────────────────────────

/** A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>". (homeServices01.test.ts's reading, as it stands.) */
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
 * THE THREE DIFFERENCES the port names (globals.css, its header), applied to the reference's declarations:
 *   1. the colours are tokens — the reference's :root is dropped here, and every custom property it reads gains the house prefix;
 *   2. the fonts are the site's — 'Inter' and 'IBM Plex Mono' are --font-sans and --font-mono;
 *   3. the reference page's own ground (body) is not ported.
 * Every class gains the house prefix: .story → .ts-story.
 */
function referencePorted(): string[] {
  const all = declarations(uncommented(referenceStyle()));
  const dropped = all.filter((d) => { const sel = d.split(' | ')[1]; return sel === ':root' || sel === 'body'; });
  assert.deepEqual([...new Set(dropped.map((d) => d.split(' | ')[1]))], [':root', 'body'], 'what is not ported: the :root and the page\'s own ground');
  return all.filter((d) => !dropped.includes(d)).map((d) => {
    const [media, sel, decl] = d.split(' | ');
    const port = decl.replace(/var\(--/g, 'var(--ts-').replace("'IBM Plex Mono', monospace", 'var(--font-mono)').replace("'Inter', sans-serif", 'var(--font-sans)');
    return `${media} | ${sel.replace(/\.story(?=$|[^A-Za-z0-9])/g, '.ts-story')} | ${port}`;
  });
}
/** Alex's notes on the cards as built, 2026-11-12 — his words, exact. */
const NOTE_ROW = 'the page seems aligned down the whole page, but when we get to trip cards on web they extend out to the right, and idk it just looks lopisded and off...';
const NOTE_PHONE = 'then on the phone web, the second card slightly shows.. it would look better with those like 3 dots under to indicate scrolling horizontal, but only show 1 card at a time, you know what I mean?';
/** An edit the notes make to the reference's declarations: one replaced, dropped or added after another — each anchor found exactly once. */
type NoteEdit = { note: 4 | 5; replace: string; by: string } | { note: 4 | 5; drop: string } | { note: 4 | 5; after: string; add: readonly string[] };
const ROW_PAD = 'max(16px, calc((100% - 1280px) / 2 + 16px))';
const ROW_PAD_WIDE = 'max(32px, calc((100% - 1280px) / 2 + 32px))';
/**
 * THE FOURTH AND FIFTH DIFFERENCES (globals.css, its header) — Alex's notes on the cards as built, as named edits:
 *   4. the row stands in the page: no full-bleed padding, 8px into the gutter each side; a card whole in it — one, two from 768px,
 *      three from 1024px; the reference's 1024px rule for the row's padding goes;
 *   5. one card at a time on a phone, with dots: the row always rests on a card (mandatory, where the reference has proximity); the
 *      dots' rules under the row's, hidden from 768px with the arrows shown; the dots skip their transition under reduced motion.
 */
const NOTE_EDITS: readonly NoteEdit[] = [
  { note: 5, replace: ' | .ts-story-row | scroll-snap-type: x proximity', by: ' | .ts-story-row | scroll-snap-type: x mandatory' },
  { note: 4, replace: ' | .ts-story-row | margin-top: clamp(24px, 2.8vw, 40px)', by: ' | .ts-story-row | margin: clamp(24px, 2.8vw, 40px) -8px 0' },
  { note: 4, replace: ` | .ts-story-row | padding: 4px ${ROW_PAD} 32px`, by: ' | .ts-story-row | padding: 4px 8px 32px' },
  { note: 4, replace: ` | .ts-story-row | scroll-padding-inline: ${ROW_PAD}`, by: ' | .ts-story-row | scroll-padding-inline: 8px' },
  { note: 5, after: ' | .ts-story-row::-webkit-scrollbar | display: none', add: [
    ' | .ts-story-dots | display: flex', ' | .ts-story-dots | justify-content: center', ' | .ts-story-dots | gap: 8px', ' | .ts-story-dots | margin-top: -12px', ' | .ts-story-dots | pointer-events: none',
    ' | .ts-story-dot | display: block', ' | .ts-story-dot | width: 6px', ' | .ts-story-dot | height: 6px', ' | .ts-story-dot | border-radius: 999px',
    ' | .ts-story-dot | background-color: var(--ts-fs-button-line)', ' | .ts-story-dot | transition: background-color 0.16s',
    ' | .ts-story-dot[data-current="true"] | background-color: var(--ts-hero-violet-2)',
  ] },
  { note: 4, replace: ' | .ts-story-card | flex: 0 0 min(352px, calc(100% - 32px))', by: ' | .ts-story-card | flex: 0 0 100%' },
  { note: 4, after: '@media (min-width: 768px) | .ts-story__arrows | display: flex', add: ['@media (min-width: 768px) | .ts-story-dots | display: none', '@media (min-width: 768px) | .ts-story-card | flex-basis: calc((100% - 20px) / 2)'] },
  { note: 4, drop: `@media (min-width: 1024px) | .ts-story-row | padding-inline: ${ROW_PAD_WIDE}` },
  { note: 4, replace: `@media (min-width: 1024px) | .ts-story-row | scroll-padding-inline: ${ROW_PAD_WIDE}`, by: '@media (min-width: 1024px) | .ts-story-card | flex-basis: calc((100% - 40px) / 3)' },
  { note: 5, replace: '@media (prefers-reduced-motion: reduce) | .ts-story-arrow, .ts-story-card__post | transition: none', by: '@media (prefers-reduced-motion: reduce) | .ts-story-arrow, .ts-story-card__post, .ts-story-dot | transition: none' },
];
/** The reference's declarations, ported, with Alex's two notes applied — each edit finding its one place, or the test says which did not. */
function withNotes(declared: readonly string[]): string[] {
  let out = [...declared];
  for (const edit of NOTE_EDITS) {
    const anchor = 'replace' in edit ? edit.replace : 'drop' in edit ? edit.drop : edit.after;
    assert.equal(out.filter((d) => d === anchor).length, 1, `note ${edit.note}: "${anchor}" stands once in the reference, ported`);
    const at = out.indexOf(anchor);
    if ('replace' in edit) out[at] = edit.by;
    else if ('drop' in edit) out = [...out.slice(0, at), ...out.slice(at + 1)];
    else out = [...out.slice(0, at + 1), ...edit.add, ...out.slice(at + 1)];
  }
  return out;
}
/** The port: globals.css from the section's first rule to the chip strip's — the rules between the marquee's keyframes and CHIP-FADE. */
const PORT_OPEN = '.ts-story {';
const NEXT_RULE = '.ts-chipfade {';
function portCss(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_RULE);
  assert.ok(at > -1 && end > at, 'the port opens at .ts-story and runs to the chip strip\'s first rule');
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
  return rows.filter((l) => l.startsWith('| `')).map((r) => {
    const cells = r.split('|').slice(1, -1).map((c) => c.trim());
    const name = /^`([^`]+)`$/.exec(cells[0]);
    const value = /^`([^`]+)`$/.exec(cells[1]);
    assert.ok(name && value && cells.length === 3, `${README}: "${r}" names one token, one value and its use`);
    return [name[1], value[1], cells[2]] as [string, string, string];
  });
}

/** THE FIVE ALREADY IN THE APP — the README's first table. */
const KEPT: ReadonlyArray<readonly [name: string, value: string]> = [
  ['bg', '250 248 243'], ['border', '221 214 232'], ['hero-violet-2', '#4D1FBC'], ['hero-violet-3', '#32118A'], ['hero-violet-4', '#210A5E'],
];
/** THE TEN HOME-PLANS-04 BROUGHT — the README's second table: reused by name and value. */
const SHARED: ReadonlyArray<readonly [name: string, value: string]> = [
  ['fs-white', '255 255 255'], ['fs-ink', '#2B2545'], ['fs-ink-soft', '#4A4560'], ['fs-ink-muted', '#6F6988'], ['fs-gold-text', '#8A6408'],
  ['fs-line', '#E9E4F2'], ['fs-rule', '#EEEAF5'], ['fs-chip-line', '#E4DFF0'], ['fs-button-line', '#CFC6EC'], ['fs-shadow', '33 10 94'],
];

// ── the markup, read as tokens ───────────────────────────────────────────────

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);
/**
 * HTML as a list of tokens: every tag with its attributes sorted, every run of text with its entities read as characters; comments and
 * the whitespace that only lays the file out (a run holding a newline) dropped, a lone space between two tags kept. A valueless
 * attribute reads "true", as React writes a data-* one; a self-closed element that is not void (React's <path/>) reads as open and
 * closed, as the reference writes it. With `prefix`, every class gets the house prefix — the reference's .story-card is the app's
 * .ts-story-card. (homeServices01.test.ts's reading, with the entities and the self-closed SVG.)
 */
function tokensOf(html: string, prefix: boolean): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (t.startsWith('<!--')) continue;
    if (!t.startsWith('<')) {
      if (/^\s*$/.test(t)) { if (!t.includes('\n')) out.push('#text " "'); continue; }
      out.push(`#text ${JSON.stringify(decode(t.replace(/\s+/g, ' ')))}`);
      continue;
    }
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?)>$/.exec(t);
    assert.ok(tag, `a tag: ${t}`);
    if (tag[1]) { out.push(`</${tag[2]}>`); continue; }
    const attrs: Array<[string, string]> = [];
    for (const a of tag[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
      const value = a[2] === undefined ? 'true' : decode(a[2]);
      attrs.push([a[1], a[1] === 'class' && prefix ? value.split(/\s+/).map((c) => `ts-${c}`).join(' ') : value]);
    }
    attrs.sort(([x], [y]) => (x < y ? -1 : 1));
    out.push(`<${tag[2]}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>`);
    if (tag[4] === '/' && !VOID.has(tag[2])) out.push(`</${tag[2]}>`);
  }
  return out;
}
const textsOf = (html: string): string[] => tokensOf(html, false).filter((t) => t.startsWith('#text ')).map((t) => JSON.parse(t.slice('#text '.length)) as string);
/** The reference's section, as the page opens: from <section to its </section>. */
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<script>'));
  return body.slice(body.indexOf('<section'), body.lastIndexOf('</section>') + '</section>'.length);
}
/**
 * WHAT IS BUILT OF THE REFERENCE'S MARKUP — a photo's path is the app's (public/ is served at /), and Alex's two notes on the cards as built
 * (2026-11-12): the row moves into the page container, after the head (note 4); the dots follow it, one per stop, the first lit as the
 * page opens (note 5).
 */
function asBuilt(html: string): string {
  const out = html.replace(/src="\.\.\/\.\.\/public\/was-here\//g, 'src="/was-here/');
  const rowAt = out.indexOf('<div class="story-row"');
  const end = out.lastIndexOf('</section>');
  assert.equal(count(out, '<div class="story-row"'), 1, 'the reference draws one row');
  const innerClose = out.lastIndexOf('</div>', rowAt);
  assert.ok(rowAt > -1 && end > rowAt && innerClose > out.indexOf('<div class="story__inner">'), 'the reference\'s row follows the page container, the section\'s last child');
  const row = out.slice(rowAt, end).trim();
  const stops = count(row, '<article ');
  const dots = `<div class="story-dots" aria-hidden="true">${Array.from({ length: stops }, (_, i) => `<span class="story-dot" data-current="${i === 0}"></span>`).join('')}</div>`;
  return `${out.slice(0, innerClose)}${row}${dots}</div>${out.slice(innerClose + '</div>'.length, rowAt)}${out.slice(end)}`;
}
/** Every class in a render. */
const classesOf = (html: string): string[] => [...html.matchAll(/ class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

/** The two files as handed over (7453a2de-tripcards-03-handoff.zip): bytes and sha256 of each. */
const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 14601, '825db79a04d278f355d60d670d060db0a790f1e0b297d1cc48ba500d511df588'],
  [REFERENCE, 33209, '5518cc330d213a029a055cae20382d29122eced097f497dbdedd731000bc8b87'],
];

test('T1 the handoff is in the tree — the README and the reference, byte for byte (sha256) and by size; the reference reads the photos from public/was-here/ and no other file but the fonts', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.ok(existsSync(resolve(ROOT, file)), `${file} is in the tree`);
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: as handed over`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, 'design-refs/tripcards-03')).sort(), ['README.md', 'Section-Reference.html'], 'the reference\'s folder holds the two files');
  const section = referenceSection();
  const sources = [...section.matchAll(/ src="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(sources, WAS_HERE.filter((r) => r.image !== null).sort((a, b) => a.start.localeCompare(b.start)).map((r) => `../../public${r.image!.src}`), 'its nine photos: the leaf\'s own files, read from public/was-here/');
  assert.deepEqual([...referenceText().matchAll(/<link [^>]*href="([^"]*)"/g)].map((m) => m[1]), ['https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap'], 'and the fonts — "only so the file renders alone"');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens, named and valued as the README\'s two tables: five already in the app and ten HOME-PLANS-04 brought, the same values behind the house prefix, each declared once; the reference declares those fifteen and no other; new with this section: none', () => {
  assert.deepEqual(readmeTable('**Already in the app.**').map(([n, v]) => [n, v]), KEPT, 'the README\'s first table');
  assert.deepEqual(readmeTable('**Added by HOME-PLANS-04**').map(([n, v]) => [n, v]), SHARED, 'its second');
  assert.ok(whole(README).includes('**New with this section: none.** No gradient. The stylesheet types no hex and no rgb value outside `:root`.'), 'and no third');
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.entries()], [...KEPT, ...SHARED].map(([n, v]) => [`--${n}`, v]), 'the reference\'s :root: the fifteen, in the README\'s order');
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of [...KEPT, ...SHARED]) {
    assert.equal(root.get(`--ts-${name}`), value, `--ts-${name} is ${value}`);
    assert.equal(globals.split('\n').filter((l) => new RegExp(`^\\s*--ts-${name}:`).test(l)).length, 1, `--ts-${name} declared once`);
  }
  // "Add none": no token named for the section, no property declared in the port, and every one of the fifteen read
  assert.deepEqual([...root.keys()].filter((k) => /story|trip/i.test(k)), [], 'no token named for the section');
  assert.doesNotMatch(portCss(), /(?:^|[;{\s])--[\w-]+\s*:/, 'the port declares no custom property');
  const read = new Set([...portCss().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  for (const [name] of [...KEPT, ...SHARED]) assert.ok(read.has(`--ts-${name}`), `--ts-${name} is read by the port, as the README's table says`);
});

// ── T3 · THE STYLESHEET ──────────────────────────────────────────────────────

test('T3 the section\'s stylesheet in globals.css is the reference\'s, declaration by declaration and in order, but for the five named differences (the last two Alex\'s notes on the cards as built); no hex, no rgb value, no gradient; every class behind the prefix; every variable it reads declared; it stands directly above CHIP-FADE, under the marquee\'s keyframes; nothing else reaches the section; what it wears is what the port rules', () => {
  const port = declarations(portCss());
  assert.deepEqual(port, withNotes(referencePorted()), 'the port is the reference\'s stylesheet, as the five differences leave it');
  assert.ok(port.length > 100, `the port was read (${port.length} declarations)`);
  const text = portCss();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\((?!var\()/, 'no rgb value typed — rgb() only ever wraps a token');
  assert.doesNotMatch(text, /gradient\(/, 'no gradient (the README: "No gradient.")');
  // every class it names carries the house prefix and is the section's own
  const selectors = [...new Set(port.map((d) => d.split(' | ')[1]))];
  for (const sel of selectors) for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-story(?:$|[-_])/, `${sel}: .${m[1]} is the section's, behind the prefix`);
  // every variable it reads is declared — the fonts by the layout
  const root = rootOf(code(GLOBALS));
  for (const v of new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))) assert.ok(root.has(v) || v === '--font-sans' || v === '--font-mono', `${v} is declared`);
  assert.match(code('src/app/layout.tsx'), /variable:\s*["']--font-sans["']/, 'src/app/layout.tsx declares --font-sans (Inter)');
  assert.match(code('src/app/layout.tsx'), /variable:\s*["']--font-mono["']/, 'and --font-mono (IBM Plex Mono)');
  // where it stands: directly above the CHIP-FADE comment, under the marquee's keyframes — away from the two blocks HOME-TRAVEL-01 adds beside
  const all = whole(GLOBALS);
  assert.equal(count(all, '\n.ts-story {'), 1, 'one port');
  assert.ok(all.includes('  to { transform: translateX(-50%); }\n}\n\n/* ── TRIPCARDS-03 (Alex\'s brief, 2026-11-12 21:08 Manila;'), 'its header comment follows the marquee\'s keyframes');
  assert.ok(all.includes('  .ts-story-arrow, .ts-story-card__post, .ts-story-dot { transition: none; }\n}\n\n/* CHIP-FADE (390 audit finding 2)'), 'and its last rule stands directly above the CHIP-FADE comment');
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_RULE);
  assert.ok(css.indexOf('@keyframes ts-marquee') < at && end < css.indexOf('.ts-ps {') && css.indexOf('.ts-ps {') < css.indexOf('.ts-fs-heading {') && css.indexOf('.ts-fs-heading {') < css.indexOf('.ts-hero {'), 'the marquee → this port → the chip strip → HOME-SERVICES-01 → HOME-PLANS-04 → the hero');
  // nothing outside it names its classes, its ids or the hooks its markup carries, nor reaches it by an element
  const outside = css.slice(0, at) + css.slice(end);
  assert.doesNotMatch(outside, /\.ts-story\b|\.ts-story[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*story/, 'and none reaches them through a class attribute selector');
  const html = render(DAY);
  const hooks = new Set<string>(['aria-disabled', 'aria-controls']);
  for (const m of html.matchAll(/ (data-[\w-]+)="/g)) hooks.add(m[1]);
  assert.deepEqual([...hooks].sort(), ['aria-controls', 'aria-disabled', 'data-current', 'data-kind', 'data-my-trip', 'data-status', 'data-stop-status', 'data-was-here', 'data-was-here-cost', 'data-was-here-costs', 'data-was-here-image', 'data-was-here-label', 'data-was-here-post-link', 'data-was-here-rail', 'data-was-here-stay', 'data-was-here-stop'], 'the hooks the section carries');
  const selectorsOutside = [...outside.matchAll(/([^{};]+)\{/g)].map((m) => flat(m[1]));
  assert.ok(selectorsOutside.length > 50, `the rules outside the port were read (${selectorsOutside.length})`);
  for (const sel of selectorsOutside) {
    for (const id of [MY_TRIP_ANCHOR, STORY_ROW_ID]) assert.ok(!sel.includes(`#${id}`), `${sel}: no rule outside the port reaches the section by #${id}`);
    for (const hook of hooks) assert.ok(!sel.includes(`[${hook}`), `${sel}: no rule outside the port reaches the section by [${hook}]`);
  }
  // (homePlans04.test.ts's reading): a selector that STARTS with a type, the universal selector or :is/:where/:not reaches every such element
  const typeFirst = (selector: string): boolean => selector.split(',').some((one) => {
    const compounds = one.trim().split(/\s*[\s>+~]\s*/).filter(Boolean);
    while (compounds.length > 1 && /^(html|body|:root)$/.test(compounds[0])) compounds.shift();
    return /^(?:[a-z][a-z0-9-]*|\*|:(?:is|where|not)\()/i.test(compounds[0]) && !/^(html|body|from|to)$/i.test(compounds[0]);
  });
  assert.deepEqual(selectorsOutside.filter(typeFirst), [], 'no rule outside the port reaches the section by an element');
  // what the section wears is what the port rules — on every day the cards can show, and for a stop with no photo — and no class is ruled for nothing
  const ruled = new Set(selectors.flatMap((sel) => sel.match(/\.ts-[A-Za-z][\w-]*/g) ?? []).map((c) => c.slice(1)));
  const worn = new Set(['2026-06-01', '2026-07-01', DAY, '2026-11-13', '2026-12-11'].flatMap((d) => classesOf(render(d))));
  assert.deepEqual([...worn].sort(), [...ruled].sort(), 'the classes worn and the classes ruled are one list');
  const map = /const TRIP = \{([\s\S]*?)\} as const;/.exec(code(SECTION));
  assert.ok(map, 'the class grammar');
  assert.deepEqual([...map[1].matchAll(/: '([^']*)'/g)].map((m) => m[1]).sort(), [...ruled].sort(), 'and the class grammar holds each of them, once');
});

// ── T4 · THE PAGE AT REST ────────────────────────────────────────────────────

test('T4 the page at rest — the section\'s render on 2026-11-12 is the reference\'s markup, token for token, but for a photo\'s path in the app and Alex\'s two notes on the cards as built (the row in the page container, the dots under it); the default export draws the view with the live leaves', () => {
  const html = renderToStaticMarkup(React.createElement(WasHereSection, { today: DAY }));
  assert.equal(html, render(DAY), 'the default export: the live rows and their costs');
  const want = tokensOf(asBuilt(referenceSection()), true);
  const got = tokensOf(html, false);
  assert.ok(want.length > 600, `a whole section was compared (${want.length} tokens)`);
  assert.deepEqual(got, want, 'the section at rest IS the reference\'s markup: every tag with every attribute, every word, in order');
  // the photo's path, where it is meant to be and nowhere else
  assert.equal(count(referenceSection(), 'src="../../public/was-here/'), 9, 'the reference reads its nine photos from public/');
  assert.equal(count(html, 'src="/was-here/'), 9, 'the app serves them from /was-here/');
  // Alex's notes, where they are meant to be: the row inside the page container, after the head; the dots after the row, one per stop
  assert.ok(html.includes('</button></div></div><div class="ts-story-row" id="story-row" data-was-here-rail="true">'), 'the arrows and the head close, and the row opens inside the page container');
  assert.ok(html.includes('</article></div><div class="ts-story-dots" aria-hidden="true">') && html.endsWith('</span></div></div></section>'), 'the dots follow the row, the page container closes after them');
  // the page as it opens: the row at its start, the first dot lit
  assert.deepEqual(ROW_AS_IT_OPENS, { start: true, end: false, current: 0 });
  assert.ok(html.includes(`aria-label="${EARLIER_STOPS}" aria-controls="${STORY_ROW_ID}" aria-disabled="true"`) && html.includes(`aria-label="${LATER_STOPS}" aria-controls="${STORY_ROW_ID}" aria-disabled="false"`), 'back at its end, forward not');
});

// ── T5 · THE CARD ────────────────────────────────────────────────────────────

test('T5 the card: the stop line from the server\'s day — no chip once he has left, COMING UP outlined, I\'M HERE filled with its dot — and the ring on the stop he is at, on any day; each amount\'s kind is its line\'s, painted by the port; the photo whole, out of the tab order; a stop with no photo has no frame and no credit', () => {
  for (const day of ['2026-06-30', '2026-07-01', DAY, '2026-11-13', '2026-12-10', '2026-12-11']) {
    const html = render(day);
    for (const id of TRIP) {
      const card = cardOf(html, id);
      const status = stopStatus(row(id), day);
      assert.ok(card.includes(`data-stop-status="${status}">`), `${day} · ${id}: its status`);
      const chip = /<span class="ts-story-chip" data-status="(now|next)" data-was-here-label="true">(<span class="ts-story-chip__dot" aria-hidden="true"><\/span>)?([^<]*)<\/span>/.exec(card);
      if (status === 'past') assert.equal(chip, null, `${day} · ${id}: no chip once he has left`);
      else {
        assert.ok(chip, `${day} · ${id}: its chip`);
        assert.deepEqual([chip[1], chip[2] !== undefined, decode(chip[3])], [status, status === 'now', stopLabel(row(id), day)], `${day} · ${id}: ${status === 'now' ? 'filled, with its dot' : 'outlined'}`);
      }
    }
    assert.deepEqual(TRIP.filter((id) => stopStatus(row(id), day) === 'now'), TRIP.filter((id) => cardOf(html, id).includes('data-stop-status="now"')), `${day}: the ring on the stop he is at, and no other`);
    assert.ok(count(html, 'data-stop-status="now"') <= 1 && count(html, 'class="ts-story-chip__dot"') === count(html, 'data-stop-status="now"'), `${day}: one place at a time — one ring, one dot`);
  }
  assert.deepEqual(TRIP.filter((id) => cardOf(render(DAY), id).includes('data-stop-status="now"')), ['siargao-2026'], 'on the day the board was drawn: Siargao');
  assert.deepEqual(TRIP.filter((id) => cardOf(render('2026-11-13'), id).includes('data-stop-status="now"')), ['cebu-2026-11'], 'the next day: Cebu');
  // each amount's kind is its line's — from TRIP_COSTS, never read out of the words
  const html = render(DAY);
  let kinds = 0;
  for (const id of TRIP) {
    const c = costsOf(id);
    assert.deepEqual([...cardOf(html, id).matchAll(/<dd class="ts-story-cost__amount" data-kind="([^"]+)">/g)].map((m) => m[1]), [c.stay.kind, c.moto.kind, c.flightIn.kind], `${id}: stay, motorbike and flight in, each by its own line's kind`);
    kinds += 3;
  }
  assert.equal(kinds, 30);
  assert.deepEqual(['paid', 'none', 'unknown'].map((k) => count(html, `data-kind="${k}"`)), [22, 4, 4], 'twenty-two paid, four none, four not in the log');
  const misleading: TripCosts = { stopId: 'cebu-2026-11', stay: { kind: 'paid', name: NOT_IN_LOG, amountCents: 100 }, moto: { kind: 'none' }, flightIn: { kind: 'unknown' } };
  assert.deepEqual(stopCostRows(misleading).map((r) => r.kind), ['paid', 'none', 'unknown'], 'a paid line named like the words for none is still paid');
  const section = code(SECTION);
  assert.ok(section.includes('<dd className={TRIP.costAmount} data-kind={c.kind}>{c.amount}</dd>'), 'the card paints by the kind it is handed');
  assert.doesNotMatch(section, /NOT_IN_LOG|NOT_APPLICABLE|c\.amount\s*[!=]==|\.kind\s*===\s*['"](?:paid|none|unknown)['"]/, 'and reads no kind out of the words, nor decides one itself');
  assert.match(code(COST_WORDS), /case 'paid': return \{ what, detail: line\.name, amount: functionalMoneyWords\(line\.amountCents\), kind: line\.kind \};/, 'stopCostRows carries the line\'s own kind beside the words');
  const port = declarations(portCss());
  assert.ok(port.includes(' | .ts-story-cost__amount[data-kind="paid"] | color: var(--ts-fs-gold-text)'), 'paid: gold');
  assert.ok(port.includes(' | .ts-story-cost__amount | color: var(--ts-fs-ink-muted)'), 'none and unknown: the amount\'s own muted ink');
  assert.deepEqual(port.filter((d) => d.includes('[data-kind=')).map((d) => d.split(' | ')[1]).filter((s, i, a) => a.indexOf(s) === i), ['.ts-story-cost__amount[data-kind="paid"]'], 'and no rule for the other two');
  assert.ok(port.includes(' | .ts-story-card[data-stop-status="now"] | border-color: var(--ts-hero-violet-2)'), 'the ring: violet');
  assert.ok(port.includes(' | .ts-story-chip[data-status="now"] | background-color: var(--ts-hero-violet-2)') && port.includes(' | .ts-story-chip | border: 1px solid var(--ts-fs-button-line)'), 'I\'M HERE filled, COMING UP outlined');
  // the photo, whole, out of the tab order; a stop with no photo: no frame, no credit, its place large
  for (const id of TRIP) {
    const image = row(id).image;
    const card = cardOf(html, id);
    if (image === null) {
      assert.doesNotMatch(card, /<img|ts-story-card__photo|ts-story-card__credit/, `${id}: no image, no box, no credit`);
      assert.ok(card.startsWith(`data-was-here="${id}" data-was-here-image="none"`), `${id}: data-was-here-image="none"`);
      continue;
    }
    assert.ok(card.includes(`<a href="/my-trip/${id}" tabindex="-1" aria-hidden="true" class="ts-story-card__photo"><img src="${image.src}"`), `${id}: the photo opens the post, out of the tab order`);
    assert.ok(card.includes(`<span class="ts-story-card__credit">${image.credit}</span>`), `${id}: its credit`);
  }
  assert.deepEqual(TRIP.filter((id) => row(id).image === null), ['cebu-2026-11'], 'Cebu has no photo yet');
  assert.ok(port.includes(' | .ts-story-card[data-was-here-image="none"] .ts-story-card__city | font-size: 30px'), 'its place at 30px');
  for (const decl of ['aspect-ratio: 3 / 2', 'object-fit: cover', 'width: 100%', 'height: auto']) assert.ok(port.includes(` | .ts-story-card__photo img | ${decl}`), `the frame: ${decl}`);
  assert.equal(port.filter((d) => /position\s*:/.test(d)).length, 0, 'nothing is laid over anything');
});

// ── T6 · THE ROW AT WORK ─────────────────────────────────────────────────────

test('T6 the row at work: where it stands and when a card is cut, as pure functions; the arrows name the row, say their ends, move one card — at once under reduced motion — and nothing at an end; a focused card comes into view whole; the keyboard meets the arrows, then the ten posts; the port\'s rules for all of it; nothing stored', () => {
  // where the row stands — a pixel's slack, as the reference's script allows
  assert.deepEqual(rowEnds(0, 1440, 3780), { start: true, end: false }, 'at its start');
  assert.deepEqual(rowEnds(1, 1440, 3780), { start: true, end: false }, 'within a pixel of it');
  assert.deepEqual(rowEnds(2, 1440, 3780), { start: false, end: false }, 'moved');
  assert.deepEqual(rowEnds(2339, 1440, 3780), { start: false, end: true }, 'within a pixel of its end');
  assert.deepEqual(rowEnds(2338, 1440, 3780), { start: false, end: false }, 'short of it');
  assert.deepEqual(rowEnds(0, 3800, 3780), { start: true, end: true }, 'a window wider than the row: neither arrow can move it');
  // a card is cut when it stands past either edge — half a pixel's slack
  const rowBox = { left: 0, right: 1440 };
  assert.equal(cardCut({ left: 32, right: 384 }, rowBox), false, 'whole');
  assert.equal(cardCut({ left: -0.5, right: 351.5 }, rowBox), false, 'within half a pixel');
  assert.equal(cardCut({ left: -1, right: 351 }, rowBox), true, 'cut at the left');
  assert.equal(cardCut({ left: 1100, right: 1440.6 }, rowBox), true, 'cut at the right');
  // the code that wires them, read as written
  const section = code(SECTION);
  assert.equal(STORY_ROW_ID, 'story-row', 'the reference\'s own id');
  assert.ok(section.includes('<div ref={rowRef} className={TRIP.list} id={STORY_ROW_ID} data-was-here-rail onScroll={(event) => settle(event.currentTarget)} onFocus={bringIntoView}>'), 'the row: its id, its scroll measured, its focus watched');
  assert.equal(count(section, 'aria-controls={STORY_ROW_ID}'), 2, 'both arrows name the row');
  assert.ok(section.includes('aria-label={EARLIER_STOPS} aria-controls={STORY_ROW_ID} aria-disabled={place.start} onClick={() => { if (!place.start) step(-1); }}'), 'back: says its end, and moves nothing there');
  assert.ok(section.includes('aria-label={LATER_STOPS} aria-controls={STORY_ROW_ID} aria-disabled={place.end} onClick={() => { if (!place.end) step(1); }}'), 'forward: the same');
  assert.ok(section.includes('row.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap)), behavior: motion() });'), 'one card: its width and the gap');
  assert.ok(section.includes("const motion = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');"), 'smoothly, or at once under reduced motion');
  assert.ok(section.includes("if (cardCut(card.getBoundingClientRect(), event.currentTarget.getBoundingClientRect())) card.scrollIntoView({ block: 'nearest', inline: 'start', behavior: motion() });"), 'a cut card the keyboard reaches moves to the row\'s start');
  assert.ok(section.includes("window.addEventListener('resize', onResize);") && section.includes("return () => window.removeEventListener('resize', onResize);") && section.includes('settle(row);\n'), 'measured on mount and on every resize, the listener removed with the section');
  assert.ok(section.includes('setPlace((was) => (was.start === now.start && was.end === now.end && was.current === now.current ? was : now));'), 'a scroll that moves no end and no card draws nothing again');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|useSearchParams|useRouter|usePathname|history\.|fetch\(/, 'nothing stored, no URL, no fetch — "No state but the row\'s scroll position, which is the browser\'s. Nothing is stored."');
  // the keyboard's order: the two arrows, then each card's post, in trip order — the photos skipped
  const html = render(DAY);
  const stops = [...html.matchAll(/<button [^>]*aria-label="([^"]+)"|<a href="([^"]+)"( tabindex="-1")?/g)].filter((m) => m[3] === undefined).map((m) => m[1] ?? m[2]);
  assert.deepEqual(stops, [EARLIER_STOPS, LATER_STOPS, ...TRIP.map((id) => `/my-trip/${id}`)], 'the arrows, then the ten posts in trip order');
  assert.equal(count(html, 'tabindex="-1"'), 9, 'the nine photos, out of the tab order');
  // the port's rules: the arrows from 768px, faded at an end; the row swiped under it, its scrollbar hidden both ways, snapping by proximity
  const port = declarations(portCss());
  for (const decl of [
    ' | .ts-story__arrows | display: none', '@media (min-width: 768px) | .ts-story__arrows | display: flex',
    ' | .ts-story-arrow[aria-disabled="true"] | opacity: 0.4', ' | .ts-story-arrow | width: 44px', ' | .ts-story-arrow | height: 44px',
    ' | .ts-story-row | overflow-x: auto', ' | .ts-story-row | scroll-snap-type: x mandatory', ' | .ts-story-row | scrollbar-width: none', ' | .ts-story-row::-webkit-scrollbar | display: none',
    ' | .ts-story-row | gap: 20px', ' | .ts-story-card | scroll-snap-align: start', ' | .ts-story-card | flex: 0 0 100%',
    ' | .ts-story-row | scroll-padding-inline: 8px',
    '@media (min-width: 768px) | .ts-story-card | flex-basis: calc((100% - 20px) / 2)', '@media (min-width: 1024px) | .ts-story-card | flex-basis: calc((100% - 40px) / 3)',
    ' | .ts-story-card__post | height: 44px', '@media (prefers-reduced-motion: reduce) | .ts-story-arrow, .ts-story-card__post, .ts-story-dot | transition: none',
  ]) assert.ok(port.includes(decl), `the port: ${decl}`);
});

// ── T7 · THE WORDS ───────────────────────────────────────────────────────────

test('T7 every word drawn is its home\'s, in order; the JSX types none — "My trip", the act\'s aria-label, typed where it stands; the arrows\' two words are new, beside Read the post →', () => {
  const html = render(DAY);
  const want = [MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, ...tripOrder(WAS_HERE).flatMap((r, i) => {
    const label = stopLabel(r, DAY);
    return [
      stopWords(i + 1), ...(label === null ? [] : [label]), ...(r.image === null ? [] : [r.image.credit]),
      r.city, r.country, stayWords(r),
      ...stopCostRows(costsOf(r.id)).flatMap((c) => [c.what, ...(c.detail === '' ? [] : [c.detail]), c.amount]),
      READ_THE_POST,
    ];
  })];
  assert.deepEqual(textsOf(html), want, 'every word, in order — from the section\'s constants, the heading\'s leaf, the trip log and its costs');
  assert.deepEqual([...html.matchAll(/ aria-label="([^"]*)"/g)].map((m) => decode(m[1])), ['My trip', EARLIER_STOPS, LATER_STOPS], 'the act\'s label and the two arrows\'');
  assert.deepEqual([...html.matchAll(/ alt="([^"]*)"/g)].map((m) => decode(m[1])), tripOrder(WAS_HERE).flatMap((r) => (r.image === null ? [] : [r.image.alt])), 'each photo\'s alt, the leaf\'s');
  assert.deepEqual([...html.matchAll(/ title="([^"]*)"/g)].map((m) => decode(m[1])), tripOrder(WAS_HERE).flatMap((r) => stopCostRows(costsOf(r.id)).filter((c) => c.detail !== '').map((c) => c.detail)), 'each name\'s whole words in its title');
  // the words, as the README's "Words" table has them
  assert.deepEqual([MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, READ_THE_POST, EARLIER_STOPS, LATER_STOPS], ['MY TRIP', 'Our Story', "Stop by stop, dated, with the whole story where I've written it up.", 'Read the post →', 'Earlier stops', 'Later stops']);
  assert.equal(MY_TRIP_HEADLINE, OUR_STORY_HEADING, 'the heading is the leaf\'s');
  assert.deepEqual([STOP_COST_LABELS, NOT_APPLICABLE, NOT_IN_LOG], [{ stay: 'Stay', moto: 'Motorbike', flightIn: 'Flight in' }, 'n/a', 'not in my log yet']);
  // the JSX types none: each word stands in the section's code at most once — as its home's declaration — and "My trip" as the label
  const section = code(SECTION);
  const homes = new Map([[MY_TRIP_EYEBROW, "export const MY_TRIP_EYEBROW = 'MY TRIP';"], [MY_TRIP_LINE, 'export const MY_TRIP_LINE = "Stop by stop, dated, with the whole story where I\'ve written it up.";'], [READ_THE_POST, "export const READ_THE_POST = 'Read the post →';"], [EARLIER_STOPS, "export const EARLIER_STOPS = 'Earlier stops';"], [LATER_STOPS, "export const LATER_STOPS = 'Later stops';"], ['My trip', 'aria-label="My trip"']]);
  for (const w of new Set([...textsOf(html), 'My trip', EARLIER_STOPS, LATER_STOPS, ...textsOf(render('2026-11-13')), ...textsOf(render('2026-07-01'))])) {
    const home = homes.get(w);
    if (home === undefined) assert.equal(count(section, w), 0, `WasHereSection.tsx does not type "${w}"`);
    else assert.ok(count(section, w) === 1 && section.includes(home), `"${w}" is typed once, in its home: ${home}`);
  }
  assert.doesNotMatch(section, />[^<>{}]*[A-Za-z][^<>{}]*<\//, 'no word between two tags in the JSX');
  // the two new words: beside Read the post →, in that order
  const at = (s: string): number => section.indexOf(s);
  assert.ok(at("export const READ_THE_POST = 'Read the post →';") < at("export const EARLIER_STOPS = 'Earlier stops';") && at("export const EARLIER_STOPS = 'Earlier stops';") < at("export const LATER_STOPS = 'Later stops';") && at("export const LATER_STOPS = 'Later stops';") < at('const TRIP = {'), 'beside READ_THE_POST, above the class grammar');
  for (const w of [EARLIER_STOPS, LATER_STOPS]) assert.doesNotMatch(w, /\bfree\b|buy now|countdown|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/iu, `"${w}": no sales tone, no emoji`);
});

// ── T8 · THE PHOTO LAW ───────────────────────────────────────────────────────

const bytes = (...parts: Array<number[] | string>): Uint8Array => Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((ch) => ch.charCodeAt(0)) : p)));
const be16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const le16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le32 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
/** A JPEG segment: its marker, its length (counting itself), its payload. */
const segment = (marker: number, payload: number[]): number[] => [0xff, marker, ...be16(payload.length + 2), ...payload];
const JFIF = segment(0xe0, [...bytes('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const frame = (marker: number, width: number, height: number): number[] => segment(marker, [8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
/** An APP1 Exif block holding one directory entry: the orientation, in either byte order. */
function exifBlock(orientation: number | null, order: 'II' | 'MM' = 'II'): number[] {
  const u16 = order === 'II' ? le16 : be16;
  const u32 = (n: number): number[] => (order === 'II' ? le32(n) : le32(n).reverse());
  const entries = orientation === null ? [] : [[...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0]];
  const tiff = [...bytes(order), ...u16(42), ...u32(8), ...u16(entries.length), ...entries.flat(), ...u32(0)];
  return segment(0xe1, [...bytes('Exif\0\0'), ...tiff]);
}
const jpeg = (...segments: number[][]): Uint8Array => Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0x34, 0xff, 0xd9]);
const riff = (chunk: string, body: number[]): Uint8Array => { const data = [...body, ...Array(Math.max(0, 10 - body.length)).fill(0)]; return bytes('RIFF', le32(4 + 8 + data.length), 'WEBP', chunk, le32(data.length), data); };
const vp8 = (width: number, height: number): Uint8Array => riff('VP8 ', [0x50, 0x02, 0x00, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)]);
const vp8l = (width: number, height: number): Uint8Array => { const bits = ((width - 1) | ((height - 1) << 14)) >>> 0; return riff('VP8L', [0x2f, ...le32(bits), 0]); };
const vp8x = (width: number, height: number): Uint8Array => riff('VP8X', [0x10, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
const refusal = (read: ReturnType<typeof jpegSize>): string => { assert.equal(read.ok, false, 'refused'); return read.ok ? '' : read.why; };

/** The nine photos on disk, as their headers — and `file public/was-here/*` — say (the audit, 2026-11-12). */
const ON_DISK: ReadonlyArray<readonly [id: string, width: number, height: number]> = [
  ['canggu-2026-07', 953, 635], ['danang-2026-08', 1415, 943], ['bangkok-2026-09', 948, 632], ['phuket-2026-10', 1206, 804], ['chiangmai-2026-10', 1254, 836],
  ['bangkok-2026-10-21', 1412, 941], ['siargao-2026', 780, 520], ['uluwatu-2026-11', 1223, 815], ['pererenan-2026-12', 945, 630],
];

test('T8 the photo law: a JPEG\'s frame header (turned by its EXIF orientation) and a WebP\'s VP8, VP8L or VP8X chunk give its size; anything else is refused by name; 1% from 3 : 2 is measured exactly', () => {
  assert.deepEqual(jpegSize(jpeg(JFIF, frame(0xc0, 1500, 1000))), { ok: true, turned: false, width: 1500, height: 1000 }, 'baseline (SOF0)');
  assert.deepEqual(jpegSize(jpeg(JFIF, frame(0xc2, 953, 635))), { ok: true, turned: false, width: 953, height: 635 }, 'progressive (SOF2), as every photo here is');
  assert.deepEqual(jpegSize(jpeg(JFIF, segment(0xc4, [0, 1, 2, 3]), segment(0xdb, [0, 1]), frame(0xc2, 900, 600))), { ok: true, turned: false, width: 900, height: 600 }, 'DHT (C4) is not a frame, nor a quantization table');
  assert.deepEqual(jpegSize(jpeg(exifBlock(6), frame(0xc0, 1500, 1000))), { ok: true, turned: true, width: 1000, height: 1500 }, 'orientation 6 turns it: as shown, 1000 × 1500');
  assert.deepEqual(jpegSize(jpeg(exifBlock(8, 'MM'), frame(0xc0, 1000, 1500))), { ok: true, turned: true, width: 1500, height: 1000 }, 'orientation 8, big-endian: stored upright, shown 3 : 2');
  assert.deepEqual(jpegSize(jpeg(exifBlock(1), frame(0xc0, 1500, 1000))), { ok: true, turned: false, width: 1500, height: 1000 }, 'orientation 1: as stored');
  assert.deepEqual(jpegSize(jpeg(exifBlock(3), frame(0xc0, 1500, 1000))), { ok: true, turned: false, width: 1500, height: 1000 }, 'orientation 3 turns it half way: the same shape');
  assert.deepEqual(jpegSize(jpeg(exifBlock(null), frame(0xc0, 1500, 1000))), { ok: true, turned: false, width: 1500, height: 1000 }, 'an EXIF block with no orientation: as stored');
  assert.equal(refusal(jpegSize(bytes([0x89], 'PNG\r\n', [0x1a, 0x0a]))), 'it is not a JPEG — it does not open with the SOI marker FF D8');
  assert.equal(refusal(jpegSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00]))), 'it is cut off inside the segment at byte 2');
  assert.equal(refusal(jpegSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 0x00]))), 'its segment at byte 2 says it is 64 bytes long, past the file\'s end');
  assert.equal(refusal(jpegSize(Uint8Array.from([0xff, 0xd8, 0x00, 0x00]))), 'there is no marker at byte 2, where a segment should start');
  assert.equal(refusal(jpegSize(Uint8Array.from([0xff, 0xd8, ...JFIF, ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0xff, 0xd9]))), 'its scan (SOS) starts before any frame header');
  assert.equal(refusal(jpegSize(Uint8Array.from([0xff, 0xd8, ...JFIF, 0xff, 0xd9]))), 'it ends (EOI) before any frame header');
  assert.equal(refusal(jpegSize(jpeg(JFIF, frame(0xc0, 1500, 0)))), 'its frame header says 1500 × 0');
  assert.equal(refusal(jpegSize(jpeg(segment(0xe1, [...bytes('Exif\0\0'), ...bytes('XX'), 0, 42, 0, 0, 0, 8]), frame(0xc0, 1500, 1000)))), 'its EXIF block has no TIFF byte order (II or MM)');
  assert.deepEqual(webpSize(vp8(1500, 1000)), { ok: true, turned: false, width: 1500, height: 1000 }, 'lossy (VP8)');
  assert.deepEqual(webpSize(vp8l(1500, 1000)), { ok: true, turned: false, width: 1500, height: 1000 }, 'lossless (VP8L)');
  assert.deepEqual(webpSize(vp8x(1500, 1000)), { ok: true, turned: false, width: 1500, height: 1000 }, 'extended (VP8X): its canvas');
  assert.equal(refusal(webpSize(riff('ALPH', [0, 0]))), 'its first chunk is "ALPH", not VP8, VP8L or VP8X');
  assert.equal(refusal(webpSize(jpeg(JFIF, frame(0xc0, 1500, 1000)))), 'it is not a WebP — it does not open with RIFF … WEBP, or is cut off before its first chunk');
  assert.equal(refusal(headerSize('/was-here/lisbon-2026.png', vp8x(1500, 1000))), 'it is neither .jpg nor .webp');
  assert.equal(refusal(headerSize('/was-here/lisbon-2026.jpg', vp8x(1500, 1000))), 'it is not a JPEG — it does not open with the SOI marker FF D8', 'a file is what its name says, or it is refused');
  // 1% from 3 : 2, measured exactly at the edge
  assert.equal(THREE_TWO_TOLERANCE, 0.01);
  for (const [w, h, inside] of [[1500, 1000, true], [1515, 1000, true], [1516, 1000, false], [1485, 1000, true], [1484, 1000, false], [3, 2, true], [4, 3, false]] as const) {
    assert.equal(offThreeTwo({ width: w, height: h }) <= THREE_TWO_TOLERANCE, inside, `${w} × ${h}: ${inside ? 'within' : 'more than'} 1%`);
    assert.equal(photoShapeViolations('lisbon-2026', '/was-here/lisbon-2026.webp', vp8x(w, h)).length, inside ? 0 : 1, `${w} × ${h}: the law ${inside ? 'passes' : 'refuses'} it`);
  }
  assert.deepEqual(photoShapeViolations('lisbon-2026', '/was-here/lisbon-2026.jpg', jpeg(JFIF, frame(0xc0, 1600, 1000))), ['was here: lisbon-2026\'s photo /was-here/lisbon-2026.jpg is 1600 × 1000 — 6.67% from 3 : 2, more than 1%: the card shows a photo whole at 3 : 2, so crop it to 3 : 2 before it goes in (TRIPCARDS-03)'], 'refused by name, with its size and how far it stands');
  assert.deepEqual(photoShapeViolations('lisbon-2026', '/was-here/lisbon-2026.jpg', jpeg(exifBlock(6), frame(0xc0, 1500, 1000))), ['was here: lisbon-2026\'s photo /was-here/lisbon-2026.jpg is 1000 × 1500 as shown (its EXIF orientation turns it) — 55.56% from 3 : 2, more than 1%: the card shows a photo whole at 3 : 2, so crop it to 3 : 2 before it goes in (TRIPCARDS-03)'], 'a 3 : 2 file shown turned is refused, saying why');
  assert.deepEqual(photoShapeViolations('lisbon-2026', '/was-here/lisbon-2026.jpg', bytes('not a photo')), ['was here: lisbon-2026\'s photo /was-here/lisbon-2026.jpg has no size the build can read — it is not a JPEG — it does not open with the SOI marker FF D8 (TRIPCARDS-03: the card shows a photo whole at 3 : 2, so the build reads each one\'s shape from its own header)'], 'a header it cannot read is refused by name, never passed');
});

test('T8 the nine photos on disk are 3 : 2 within 1% (within 0.1%, as the README says), each read from its own header; the law\'s photo line holds the clause, and no line of the law moved; no dependency; the seeds are on file and each expects the clause\'s own words', () => {
  assert.deepEqual(WAS_HERE.filter((r) => r.image !== null).map((r) => r.id).sort(), ON_DISK.map(([id]) => id).sort(), 'every photo the log names');
  for (const [id, width, height] of ON_DISK) {
    const src = row(id).image!.src;
    const file = photoBytes(resolve(ROOT, 'public', src.slice(1)));
    assert.deepEqual(headerSize(src, file), { ok: true, turned: false, width, height }, `${id}: ${width} × ${height}`);
    assert.ok(offThreeTwo({ width, height }) < 0.001, `${id}: within 0.1% of 3 : 2`);
    assert.deepEqual(photoShapeViolations(id, src, file), [], `${id}: the law passes it`);
  }
  // the law: the trip log law's photo line — after the 400 KB check, for a file that is there — and its import on the trip log's import line
  const lines = code(LAW).split('\n');
  const photoLine = lines.filter((l) => l.includes('statSync(abs).size > 400 * 1024'));
  assert.equal(photoLine.length, 1, 'one photo line');
  const clause = 'if (existsSync(abs)) violations.push(...photoShapeViolations(row.id, row.image.src, photoBytes(abs)));';
  assert.ok(photoLine[0].indexOf('at most 400 KB (WASHERE-01)`);') < photoLine[0].indexOf(clause), 'the clause follows the 400 KB check on its line');
  assert.equal(count(code(LAW), 'photoShapeViolations('), 1, 'called once');
  assert.ok(lines.some((l) => l.startsWith("import { WAS_HERE, wasHereLaw } from '../src/lib/wasHere';") && l.includes("import { photoBytes, photoShapeViolations } from '../src/lib/photoSize';")), 'its import rides the trip log\'s import line');
  assert.ok(lines.some((l) => l.includes('with a photo on disk at no more than 400 KB, each within 1% of 3 : 2 by its own header;')), 'the verdict says so');
  // no line moved: the lines other files cite by number still hold what they cite
  for (const [n, holds] of [[160, "import { EXPERIENCES, EXPERIENCE_CATEGORIES, experiencesLaw } from '../src/lib/experiences';"], [483, 'violations.push(...ownTableLaw('], [710, 'violations.push(...servicesLaw({ throwOnFail: false, migrations: ALL_MIGRATIONS }));'], [742, "if (enumValues.join(',') !== PROVIDER_CODES.join(','))"], [840, 'callSites.push({ file, provider'], [987, 'violations.push(...s14Law({ throwOnFail: false }));']] as const) {
    assert.ok(lines[n - 1].includes(holds), `${LAW}:${n} still holds ${holds.slice(0, 40)}… (the deck and the tests cite it by number)`);
  }
  // the one place a photo's bytes are read; the reader law's subjects read none
  const photoLaw = code(PHOTO_LAW);
  assert.equal((photoLaw.match(/\breadFileSync\s*\(/g) ?? []).length, 1, 'photoBytes reads the file — once');
  assert.match(photoLaw, /export function photoBytes\(file: string\): Uint8Array \{\n {2}return readFileSync\(file\);\n\}/, 'and does nothing else');
  assert.doesNotMatch(code(LAW), /\breadFileSync\s*\(/, 'the law reads no file raw');
  // no dependency: the repo had none that reads image sizes, and has none now
  const pkg = JSON.parse(whole('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  assert.deepEqual(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /image-size|probe-image|sharp|jimp|exif/i.test(d)), [], 'no dependency reads image sizes');
  // the seeds: on file; each find occurs once in its file; each expects the clause's own words, naming a real photo
  assert.ok(existsSync(resolve(ROOT, SEEDS_FILE)), 'the seeds are on file');
  assert.deepEqual(TRIPCARDS_SEEDS.map((s) => s.file), [PHOTO_LAW, PHOTO_LAW]);
  for (const seed of TRIPCARDS_SEEDS) {
    assert.equal(count(whole(seed.file), seed.find), 1, `${seed.name}: its find occurs once`);
    assert.ok(seed.expect.startsWith("was here: canggu-2026-07's photo /was-here/canggu-2026-07.jpg is "), `${seed.name}: it expects the clause's words for a real photo`);
  }
  const [swapped, tighter] = TRIPCARDS_SEEDS;
  assert.equal(swapped.expect, `was here: canggu-2026-07's photo /was-here/canggu-2026-07.jpg is ${635} × ${953} —`, 'a: Canggu read as 2 : 3');
  assert.equal(tighter.expect, 'was here: canggu-2026-07\'s photo /was-here/canggu-2026-07.jpg is 953 × 635 — 0.05% from 3 : 2, more than 0.03%', 'b: Canggu, 0.05% from 3 : 2, refused at 0.03%');
  assert.equal(ON_DISK.filter(([, w, h]) => offThreeTwo({ width: w, height: h }) > 0.0003).length, 4, 'b: four photos stand more than 0.03% from 3 : 2, and five stand on it');
});

// ── T9 · THE RULINGS ─────────────────────────────────────────────────────────

test('T9 the rulings: the brief (21:08) and the approval (21:21) quoted exact wherever quoted; the two reversed rulings named with Alex\'s words; the heading violet — no word of gold launched this run; About Us untouched', () => {
  const said = (file: string): string => flat(comments(file).replace(/^\s*(\*|\/\/)/gm, ' '));
  const WORDS_2108 = 'so these cards (a) dont follow the new asthetics of the page, and also when we made these, it like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the sunset which were a big part of the image... (b) like how the other cards had the issue, the data just looks like kinda crammed and messy and shanty on the card now....';
  const WORDS_2121 = 'omg yesssssssss that is fucking sexy, our story, yassss yassss yasssss! give me the prmpt to turn this real!';
  const readme = whole(README);
  assert.ok(readme.includes(`(21:08): "${WORDS_2108}"`) && readme.includes(`21:21 Manila: "${WORDS_2121}"`), 'the handoff quotes both, as these do');
  const files = [SECTION, GLOBALS, PHOTO_LAW, COST_WORDS, LEAF, LAW, SEEDS_FILE] as const;
  for (const file of files) {
    const notes = said(file);
    assert.ok(notes.includes('TRIPCARDS-03'), `${file} names the brief`);
    assert.ok(notes.includes('2026-11-12'), `${file} dates it`);
    for (const m of notes.matchAll(/21:08 Manila: "([^"]+)"/g)) assert.equal(m[1], WORDS_2108, `${file}: the brief, exact`);
    for (const m of notes.matchAll(/21:21 Manila: "([^"]+)"/g)) assert.equal(m[1], WORDS_2121, `${file}: the approval, exact`);
  }
  for (const file of [SECTION, GLOBALS]) {
    assert.ok(said(file).includes(`21:08 Manila: "${WORDS_2108}"`) && said(file).includes(`21:21 Manila: "${WORDS_2121}"`), `${file} quotes the brief and the approval whole`);
    assert.ok(said(file).includes('design-refs/tripcards-03/Section-Reference.html'), `${file} names the spec`);
  }
  assert.ok(said(PHOTO_LAW).includes('His brief: "it like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the sunset which were a big part of the image".'), 'the photo law quotes why — an excerpt, his words in his order');
  assert.ok(WORDS_2108.includes('it like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the sunset which were a big part of the image'));
  // the two reversed rulings, named where they are reversed, with his words
  const section = said(SECTION);
  assert.ok(section.includes('Read the post → leaves PRIMARY_CTA (src/lib/ds.ts), the public page\'s filled purple button, for the quiet pill. HOME-FINISH-01 had put it there (Alex, 2026-11-08: "same thing on blog read the post button.... should be consistent, like lookup, purple").'), 'HOME-FINISH-01, reversed — his words');
  assert.ok(flat(comments('src/lib/__tests__/buttons01.test.ts').replace(/^\s*\*/gm, ' ')).includes('same thing on blog read the post button.... should be consistent, like lookup, purple'), 'as HOME-FINISH-01 quoted them');
  assert.ok(section.includes('The heading leaves HOME-FINISH-02\'s gold (Alex\'s brief, 2026-11-10 20:56: a section heading, in gold and one size up) for violet at the pillars\' size, as the board draws it.'), 'HOME-FINISH-02, reversed');
  // the heading: violet, at the pillars' size — the launch message's own "gold"s are its rulings', not Alex's word for the heading
  const code_ = code(SECTION);
  assert.ok(code_.includes("h2: 'ts-story__title',") && !code_.includes(ACT_HEADING_TYPE) && !code_.includes('text-brand-gold'), 'the h2 wears the port\'s title, not the act headings\' gold');
  const port = declarations(portCss());
  for (const decl of ['font-size: clamp(34px, 4vw, 56px)', 'color: var(--ts-hero-violet-4)', 'font-weight: 500']) assert.ok(port.includes(` | .ts-story__title | ${decl}`), `the heading: ${decl} — the pillars' size, in violet`);
  assert.ok(code(GLOBALS).includes('.ts-fs__title { margin: 0; font-size: clamp(34px, 4vw, 56px);'), 'the pillars\' own title is the same size');
  // About Us: untouched by this port — its h2 keeps the act headings' type, and it wears nothing of this port. HOME-ABOUT-01 (2026-11-12;
  // the README: "Its `mt-3` goes, as What We Do's did"): the type exactly, without the 'mt-3' it wore when this line was written — until then
  // stopZero.includes(`h2: 'mt-3 ${ACT_HEADING_TYPE}'`).
  const stopZero = code(STOP_ZERO);
  assert.ok(stopZero.includes(`h2: '${ACT_HEADING_TYPE}',`) && !stopZero.includes('ts-story'), 'About Us keeps the act headings\' type and wears nothing of this port');
});

// ── T10 · ALEX'S NOTES ON THE BUILT PAGE ─────────────────────────────────────

test('T10 Alex\'s notes on the cards as built (2026-11-12): the row stands in the page — whole cards only, one in view, two from 768px, three from 1024px (the plan cards\' own columns), at rest on a card; under 768px one card at a time and the dots, one per stop, the one in view lit, a picture and not controls; his words exact wherever quoted', () => {
  // the card in view, as a pure function: of the cards' left edges, the one nearest the row's start; -1 when the row holds none
  assert.equal(cardAtStart([], 24), -1, 'no card: no dot to light');
  assert.equal(cardAtStart([24, 402, 780], 24), 0, 'the row at its start: the first');
  assert.equal(cardAtStart([-354, 24, 402], 24), 1, 'one card along: the second');
  assert.equal(cardAtStart([-3000, -2622, 23.6], 24), 2, 'at its end: the last, within a fraction of a pixel');
  assert.equal(cardAtStart([-150, 228], 24), 0, 'part-way: the nearer');
  assert.equal(cardAtStart([-165, 213], 24), 0, 'half-way exactly: the first of the two');
  // the dots, as the page opens: one per stop, in trip order, the first lit; a picture of where the row stands, not controls
  const html = render(DAY);
  const dots = /<div class="ts-story-dots" aria-hidden="true">((?:<span class="ts-story-dot" data-current="(?:true|false)"><\/span>)*)<\/div>/.exec(html);
  assert.ok(dots, 'one line of dots, hidden from assistive technology');
  assert.deepEqual([...dots[1].matchAll(/data-current="(true|false)"/g)].map((m) => m[1]), TRIP.map((_, i) => String(i === 0)), 'a dot per stop, the first lit');
  assert.equal(count(html, 'class="ts-story-dots"'), 1, 'one line of them');
  const section = code(SECTION);
  assert.ok(section.includes('<div className={TRIP.pager} aria-hidden="true">'), 'the dots are hidden from assistive technology');
  assert.ok(section.includes('{tripOrder(rows).map((row, i) => <span key={row.id} className={TRIP.pagerDot} data-current={i === place.current} />)}'), 'one per stop, in trip order, lit by the card in view');
  assert.doesNotMatch(section.slice(section.indexOf('<div className={TRIP.pager}'), section.indexOf('</div>', section.indexOf('<div className={TRIP.pager}'))), /onClick|onKeyDown|tabIndex|<button|role=/, 'nothing to tap or reach');
  assert.ok(section.includes('const rowStart = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).scrollPaddingLeft);'), 'measured from the row\'s start, where a card comes to rest');
  assert.ok(section.includes('current: cardAtStart([...row.children].map((card) => card.getBoundingClientRect().left), rowStart)'), 'the card in view, on every scroll and every resize');
  // the port's rules, as the notes draw them
  const port = declarations(portCss());
  for (const decl of [
    ' | .ts-story-row | margin: clamp(24px, 2.8vw, 40px) -8px 0', ' | .ts-story-row | padding: 4px 8px 32px', ' | .ts-story-row | scroll-padding-inline: 8px',
    ' | .ts-story-row | gap: 20px', ' | .ts-story-row | scroll-snap-type: x mandatory', ' | .ts-story-card | scroll-snap-align: start',
    ' | .ts-story-card | flex: 0 0 100%', '@media (min-width: 768px) | .ts-story-card | flex-basis: calc((100% - 20px) / 2)', '@media (min-width: 1024px) | .ts-story-card | flex-basis: calc((100% - 40px) / 3)',
    ' | .ts-story-dots | pointer-events: none', '@media (min-width: 768px) | .ts-story-dots | display: none', '@media (min-width: 768px) | .ts-story__arrows | display: flex',
    ' | .ts-story-dot | background-color: var(--ts-fs-button-line)', ' | .ts-story-dot[data-current="true"] | background-color: var(--ts-hero-violet-2)',
  ]) assert.ok(port.includes(decl), `the port: ${decl}`);
  assert.doesNotMatch(portCss(), /100% - 1280px/, 'nothing pads the row out to the window\'s edges any more');
  // the row reaches into the gutter less far than the gap, so no other card shows at either edge
  const reach = Number(/margin: clamp\(24px, 2\.8vw, 40px\) -(\d+)px 0/.exec(portCss())?.[1]);
  const pad = Number(/padding: 4px (\d+)px 32px/.exec(portCss())?.[1]);
  const gap = Number(/\.ts-story-row \{[^}]*gap: (\d+)px/.exec(portCss())?.[1]);
  assert.ok(reach === 8 && pad === reach && gap === 20 && reach < gap, `the row reaches ${reach}px into the gutter, pads itself back by as much, and the gap is ${gap}px`);
  // three across from 1024px are the plan cards' own columns: the same page container, three columns 20px apart
  const all = declarations(code(GLOBALS));
  for (const decl of [' | .ts-story__inner | max-width: 1280px', ' | .ts-story__inner | padding-inline: 16px', '@media (min-width: 1024px) | .ts-story__inner | padding-inline: 32px']) assert.ok(all.includes(decl), `the trip log's container: ${decl}`);
  for (const decl of [' | .ts-fs__inner | max-width: 1280px', ' | .ts-fs__inner | padding: 12px 16px clamp(52px, 6.2vw, 88px)', '@media (min-width: 1024px) | .ts-fs-heading, .ts-fs__inner | padding-inline: 32px', '@media (min-width: 1024px) | .ts-fs-plans | grid-template-columns: repeat(3, minmax(0, 1fr))', '@media (min-width: 1024px) | .ts-fs-plans | gap: 0 20px']) assert.ok(all.includes(decl), `the plans above it: ${decl}`);
  // his words, exact: the stylesheet quotes both under their stamp, and the section both
  const header = flat(whole(GLOBALS).slice(whole(GLOBALS).indexOf('/* ── TRIPCARDS-03'), whole(GLOBALS).indexOf('/* ── 1 · the section: the eyebrow')));
  const stamped = [...header.matchAll(/Alex's note on the cards as built, 2026-11-12: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(stamped, [NOTE_ROW, NOTE_PHONE], 'the port names the fourth and fifth differences with his two notes, exact');
  const notes = flat(comments(SECTION).replace(/^\s*(\*|\/\/)/gm, ' '));
  for (const note of [NOTE_ROW, NOTE_PHONE]) assert.ok(notes.includes(`"${note}"`), `WasHereSection.tsx quotes "${note.slice(0, 30)}…" exact`);
  assert.ok(notes.includes('AFTER THE BUILD — Alex\'s notes on the cards as built, 2026-11-12'), 'and names them, dated');
});
