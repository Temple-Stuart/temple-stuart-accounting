/**
 * TRIPPOST-02 (Alex, 2026-11-23 11:38 Bali: "Okay, I would like to have the blog posts designed something like this.... review the
 * images, then mock up something that follows the current pages layout and all that good stuff!" · 12:52, on the board: "this is
 * beautiful , except the section called work... we can call that like planning or focus instead.   otherwise this is good!") — A STOP'S
 * PAGE, AS DRAWN. /my-trip/<stop> redrawn in the home page's look, for all ten stops: the one written up and the nine that are not.
 *
 * The spec is two files: design-refs/trippost-02/Post-Reference.html (the reference's own sentence: "Every value in the stylesheet is
 * the design, and the markup is each page as it opens.") and the README beside it, the design's record. The page is
 * src/components/trip/TripPostView.tsx; its figures are src/lib/tripFigures.ts's and its new words src/lib/tripPostPageWords.ts's; the
 * rentals' days are src/lib/tripCosts.ts's TRIP_MOTO_DAYS, and a post's day and its favorite with a photo are src/lib/tripPosts.ts's.
 *
 *   T1  the handoff landed — the README and the reference, byte for byte (sha256) and by size; the folder holds the two; the reference
 *       has one stylesheet and draws two pages; it reads its photos from public/was-here/ and nothing else but the fonts;
 *   T2  the tokens — the README's three tables (fourteen already in the app, twelve HOME-PLANS-04 brought, two HOME-SERVICES-01 brought):
 *       each name and value in the reference's :root, which holds those 28 and no other, and behind the house prefix in globals.css's
 *       :root, declared once; the port declares none and reads every one;
 *   T3  the stylesheet — globals.css's port IS the reference's, declaration by declaration and in order, but for ruling j's three
 *       differences; no hex, no rgb value typed, three gradients and all the band's; ruling k's four properties of every selector; its
 *       seat (ruling i), comments between and nothing else at either seam; nothing outside it names one of its classes;
 *   T6  the figures leaf — a rate's half rounds up; a day's share is the rounding of the unrounded sum, never the sum of the rounded
 *       rates; when it is not drawn; dayNumber's inverse across a span of years; an empty seat for a date with no entry; and the README's
 *       table of the ten stops' figures, cell for cell, as the two leaves build it;
 *   T7  the words — every new word the README's table names is the new leaf's, a fixed word typed there once; Source ↗ is SOURCE_LINK;
 *   T8  the data — the two leaves' new refusals, each by name over injected rows and posts; the live data as the README gives it; the
 *       build law's two clauses on the trip post law's line, and the file's length; the seeds on file;
 *   T10 Alex's two messages, quoted exact wherever a file this brief touches quotes them.
 * T4, T5 and T9 arrive with the page (part 5 of the build).
 *
 * Source is read through code() and comments() only (the reader law); rejoin() where the whole file is the subject. No clock, no live
 * call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments, rejoin } from '../sourceText';
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { tripOrder } from '../wasHereWords';
import { dayNumber, weekdayWords } from '../experienceWords';
import { TRIP_COSTS, TRIP_COST_FIELDS, TRIP_MOTO_DAYS, costsOf, motoDaysOf, tripCostsLaw, type TripCosts, type TripMotoDays } from '../tripCosts';
import { TRIP_POSTS, TRIP_POST_FIELDS, TRIP_POST_ROUTINE_KINDS, postOf, tripPostsLaw, type TripPost } from '../tripPosts';
import { NOT_APPLICABLE, NOT_IN_LOG } from '../tripPostWords';
import { functionalMoneyWords } from '../books/functionalCurrency';
import {
  TripFiguresError, calendarSeats, civilFromDays, dayShareCents, daysBetween, lineFigure, motoDayCount, nightsOf, rateCents, routineTotals, stopFigures, weekdayDates,
  type StopFigures,
} from '../tripFigures';
import * as Words from '../tripPostPageWords';
import { SOURCE_LINK } from '@/components/landing/ExperiencesSection';
import { SEEDS as TRIPPOST_SEEDS } from '../../../scripts/proofs/trippost02.seeds';

const ROOT = process.cwd();
const FOLDER = 'design-refs/trippost-02';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Post-Reference.html`;
const FIGURES = 'src/lib/tripFigures.ts';
const WORDS = 'src/lib/tripPostPageWords.ts';
const COSTS = 'src/lib/tripCosts.ts';
const POSTS = 'src/lib/tripPosts.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS_FILE = 'scripts/proofs/trippost02.seeds.ts';
const GLOBALS = 'src/app/globals.css';
/** The port's first rule, and the letter's (HOME-ABOUT-01), which stands directly under the port's last. */
const PORT_OPEN = '.ts-post {';
const NEXT_PORT = '.ts-about {';

/** Alex's two messages, as he wrote them (2026-11-23, Bali): his brief at 11:38, his yes on the board at 12:52. */
const HIS_BRIEF = 'Okay, I would like to have the blog posts designed something like this.... review the images, then mock up something that follows the current pages layout and all that good stuff!';
const HIS_YES = 'this is beautiful , except the section called work... we can call that like planning or focus instead.   otherwise this is good!';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A file whole — its two halves, as the reader splits it, rejoined. */
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
/** A README section: from its "## " heading to the next. */
function readmeSection(heading: string): string {
  const doc = whole(README);
  const at = doc.indexOf(`\n## ${heading}\n`);
  assert.ok(at > -1, `the README has a "${heading}" section`);
  const next = doc.indexOf('\n## ', at + 1);
  return doc.slice(at, next < 0 ? undefined : next);
}
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();

// ── the stylesheets, read as lists of declarations (tripCards03.test.ts's readers, as they stand) ──

/** A stylesheet (its comments already removed) as one line per declaration, in order: "<media> | <selector> | <property>: <value>". */
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
/** The reference's stylesheet, as written: what stands between <style> and </style>. */
function referenceStyle(): string {
  const html = whole(REFERENCE);
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
/** How many times a stylesheet declares a custom property. */
const declaredTimes = (css: string, name: string): number => (css.match(new RegExp(`(^|[\\s;{])${name.replace(/[-]/g, '\\-')}\\s*:`, 'gm')) ?? []).length;
/** The README's Tokens section: the rows of the table under one bold lead, each [name, value, what it is for]. */
function readmeTable(lead: string): Array<[name: string, value: string, use: string]> {
  const section = readmeSection('Tokens');
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
/** The port in globals.css, its comments removed: from its first rule to the letter's first rule. */
function port(): string {
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const end = css.indexOf(NEXT_PORT);
  assert.ok(at > -1 && end > at && count(css, PORT_OPEN) === 1, 'one port, from .ts-post to the letter\'s first rule');
  return css.slice(at, end);
}
/** The reference page's own rules, which ruling j leaves unported with the reference's :root. */
const THIS_PAGES_OWN = new Set([':root', 'body', '.ref-note', '.ref-note--next']);
/** Ruling j's first two differences, applied to one declaration of the reference: the house prefix on its classes and its custom properties; the site's two font variables. */
const ported = (line: string): string => {
  const [media, selector, decl] = line.split(' | ');
  const value = decl.replace(/var\(--/g, 'var(--ts-').replace("'Inter', sans-serif", 'var(--font-sans)').replace("'IBM Plex Mono', monospace", 'var(--font-mono)');
  return `${media} | ${selector.replace(/\.post(?=[-_\s:,.>)]|$)/g, '.ts-post')} | ${value}`;
};

const row = (id: string): WasHereRow => { const found = WAS_HERE.find((r) => r.id === id); assert.ok(found, `${id} is a stop`); return found; };
const costs = (id: string): TripCosts => { const found = costsOf(id); assert.ok(found, `${id} has its costs`); return found; };
const figuresOf = (id: string): StopFigures => stopFigures(row(id), costs(id), motoDaysOf(id));

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

test('T1 the handoff landed byte for byte: the README and the reference by sha256 and size; the folder holds the two; one stylesheet, two pages; the photos from public/was-here/ and nothing else but the fonts', () => {
  assert.equal(sha256(whole(REFERENCE)), '2ba42489bca3a0eda54129380e17c896c1f6f9ab1ee6f12cdba5437a780cc9a0');
  assert.equal(size(REFERENCE), 103510);
  assert.equal(sha256(whole(README)), '4fc358f062589dfe869bb98d600bcd51b3a4efdfc129cbd3b9b8f73d02223c83');
  assert.equal(size(README), 28260);
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['Post-Reference.html', 'README.md']);
  const html = whole(REFERENCE);
  assert.equal(count(html, '<style>'), 1, 'one stylesheet');
  assert.equal(count(html, '<div class="post" data-trip-post="'), 2, 'two pages');
  assert.ok(html.includes('<div class="post" data-trip-post="canggu-2026-07" data-trip-post-kind="written">'), 'the first: Stop 1, written up');
  assert.ok(html.includes('<div class="post" data-trip-post="siargao-2026" data-trip-post-kind="stop">'), 'the second: Stop 7, not written up');
  const sources = [...html.matchAll(/\bsrc="([^"]*)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(sources, ['../../public/was-here/canggu-2026-07.jpg', '../../public/was-here/siargao-2026.jpg', '../../public/was-here/uluwatu-2026-11.jpg'], 'three photos, from public/was-here/');
  for (const photo of sources) assert.ok(statSync(resolve(ROOT, FOLDER, photo)).isFile(), `${photo} is on disk`);
  assert.deepEqual([...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]), ['<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap">'], 'and the fonts: nothing else is loaded');
  assert.doesNotMatch(html, /url\(|@import|<script\s+src/, 'no other file, by any road');
});

// ── T2 · THE TOKENS ──────────────────────────────────────────────────────────

test('T2 the tokens: the README\'s three tables, each name and value in the reference\'s :root (those 28 and no other) and behind the prefix in globals.css\'s :root, declared once; the port declares none and reads every one', () => {
  const tables = [readmeTable('**Already in the app.**'), readmeTable('**Added by HOME-PLANS-04**'), readmeTable('**Added by HOME-SERVICES-01**')];
  assert.deepEqual(tables.map((t) => t.length), [14, 12, 2], 'fourteen, twelve and two');
  const tokens = tables.flat();
  const reference = rootOf(uncommented(referenceStyle()));
  assert.deepEqual([...reference.keys()].sort(), tokens.map(([name]) => `--${name}`).sort(), 'the reference\'s :root holds the 28 and no other');
  const globals = code(GLOBALS);
  const root = rootOf(globals);
  for (const [name, value] of tokens) {
    assert.equal(reference.get(`--${name}`), value, `the reference's --${name} is the README's ${value}`);
    assert.equal(root.get(`--ts-${name}`), value, `globals.css's --ts-${name} is ${value}`);
    assert.equal(declaredTimes(globals, `--ts-${name}`), 1, `--ts-${name} is declared once`);
  }
  assert.ok(readmeSection('Tokens').includes('**New with this page: none.**'), 'the README adds none');
  const text = port();
  assert.doesNotMatch(text, /(^|[\s;{])--[\w-]+\s*:/m, 'the port declares no custom property');
  const read = new Set([...text.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  assert.deepEqual([...read].filter((v) => !v.startsWith('--font-')).sort(), tokens.map(([name]) => `--ts-${name}`).sort(), 'the port reads every one of the 28, and no other token');
  assert.deepEqual([...read].filter((v) => v.startsWith('--font-')).sort(), ['--font-mono', '--font-sans'], 'and the site\'s two fonts');
});

// ── T3 · THE STYLESHEET ──────────────────────────────────────────────────────

test('T3 the port IS the reference\'s stylesheet, declaration by declaration and in order, but for ruling j\'s three differences; no hex, no rgb value typed, three gradients and all the band\'s', () => {
  const reference = declarations(uncommented(referenceStyle()));
  const kept = reference.filter((line) => !THIS_PAGES_OWN.has(line.split(' | ')[1]));
  assert.deepEqual([...new Set(reference.filter((line) => !kept.includes(line)).map((line) => line.split(' | ')[1]))], [':root', 'body', '.ref-note', '.ref-note--next'], 'the third difference: neither its :root nor its own page\'s rules');
  assert.deepEqual(declarations(port()), kept.map(ported), 'every other declaration, in order, behind the prefix and in the site\'s fonts');
  const text = port();
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, 'no hex typed');
  assert.doesNotMatch(text, /rgba?\(\s*[\d.]/, 'no rgb value typed: every rgb() reads a token');
  assert.equal(count(text, 'gradient('), 3, 'three gradients');
  assert.deepEqual(declarations(text).filter((d) => d.includes('gradient(')).map((d) => d.split(' | ')[1]), ['.ts-post-band', '.ts-post-band__go'], 'all the band\'s: its rings and sweep, and its gold button');
  assert.ok(comments(GLOBALS).includes('THREE DIFFERENCES ruling j names, and no fourth'), 'its header names them');
});

test('T3 ruling k\'s four properties of every selector; the seat of ruling i, comments between and nothing else at either seam; nothing outside the port names one of its classes', () => {
  const text = port();
  const selectors = [...new Set(declarations(text).map((d) => d.split(' | ')[1]))];
  assert.ok(selectors.length > 150, `the port's selectors were read (${selectors.length})`);
  for (const sel of selectors) {
    assert.ok(!sel.includes('['), `${sel}: no attribute selector`);
    assert.ok(!sel.includes('#'), `${sel}: no id`);
    assert.doesNotMatch(sel, /\bbutton\b/, `${sel}: no button`);
    for (const one of sel.split(',')) assert.match(one.trim(), /^\.ts-post(?:[-_][\w-]*)?(?=$|[\s:.>])/, `${one.trim()}: begins with one of the page's own classes`);
    for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) assert.match(m[1], /^ts-post(?:$|[-_])/, `${sel}: .${m[1]} is the page's, behind the prefix`);
  }
  const css = code(GLOBALS);
  const at = css.indexOf(PORT_OPEN);
  const next = css.indexOf(NEXT_PORT);
  assert.match(css.slice(css.lastIndexOf('.ts-chipfade', at), at), /^\.ts-chipfade \{[^{}]*\}\s*\}\s*$/, 'directly under the chip strip\'s last rule (its @media from 1024px): comments between and nothing else');
  assert.match(css.slice(css.lastIndexOf('.ts-post', next), next), /^\.ts-post-pager__card \{[^{}]*\}\s*\}\s*$/, 'its last rule (its reduced-motion @media) directly above the letter\'s first: comments between and nothing else');
  const full = whole(GLOBALS);
  assert.ok(full.indexOf('/* ── TRIPPOST-02 (') > full.lastIndexOf('.ts-chipfade') && full.indexOf('/* ── TRIPPOST-02 (') < full.indexOf('/* ── HOME-ABOUT-01 ('), 'its header between the two');
  const outside = css.slice(0, at) + css.slice(next);
  assert.doesNotMatch(outside, /\.ts-post\b|\.ts-post[-_]/, 'no rule outside the port names one of its classes');
  assert.doesNotMatch(outside, /\[\s*class\s*[~|^$*]?=\s*["']?[^"'\]]*\bpost/, 'and none reaches them through a class attribute selector');
});

// ── T6 · THE FIGURES ─────────────────────────────────────────────────────────

test('T6 a rate: to the nearest cent, a half rounding up — floor((2 × amount + over) / (2 × over)) — on whole numbers; spread across nothing, refused by name', () => {
  for (const [amount, over, rate] of [[1, 2, 1], [3, 2, 2], [5, 2, 3], [7, 2, 4], [4, 3, 1], [5, 3, 2], [70814, 29, 2442], [13179, 27, 488], [83720, 29, 2887], [4398, 1, 4398], [0, 5, 0]] as const) {
    assert.equal(rateCents(amount, over), rate, `${amount} over ${over}`);
  }
  for (const [amount, over] of [[100, 0], [100, -1], [100, 1.5], [1.5, 2], [-1, 2]] as const) assert.throws(() => rateCents(amount, over), TripFiguresError, `${amount} over ${over} is refused`);
  assert.throws(() => rateCents(100, 0), /spread across nothing has no rate/);
});

test('T6 a day\'s share: one fraction over the product of what each line is spread across, rounded once — never the sum of the rounded rates; drawn only when every line is none or has a rate, and one at least is paid', () => {
  const half = lineFigure({ kind: 'paid', name: 'x', amountCents: 1 }, 2);
  assert.deepEqual(half, { kind: 'paid', amountCents: 1, spread: { over: 2, rateCents: 1 } }, 'half a cent a day rounds up to one');
  assert.equal(dayShareCents([half, half, half]), 2, 'three half cents are a cent and a half — two, rounded once');
  assert.notEqual(dayShareCents([half, half, half]), 3, 'not the three the rounded rates would sum to');
  // Canggu, as one fraction: (70814 × 27 × 29 + 13179 × 29 × 29 + 83720 × 29 × 27) / (29 × 27 × 29)
  const canggu = figuresOf('canggu-2026-07');
  assert.equal(canggu.dayShareCents, rateCents(70814 * 27 * 29 + 13179 * 29 * 29 + 83720 * 29 * 27, 29 * 27 * 29));
  assert.equal(canggu.dayShareCents, 5817);
  // not drawn: a line not in his log; a line paid with nothing to spread it across; no line paid
  assert.equal(figuresOf('cebu-2026-11').dayShareCents, null, 'Cebu: the motorbike is not in his log');
  assert.equal(figuresOf('phuket-2026-10').dayShareCents, null, 'Phuket: the motorbike is paid, its days are not on file');
  assert.equal(figuresOf('siargao-2026').dayShareCents, null, 'Siargao: the same');
  assert.equal(dayShareCents([{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }]), null, 'no line paid');
  assert.equal(dayShareCents([{ kind: 'none' }, { kind: 'paid', amountCents: 900, spread: { over: 3, rateCents: 300 } }]), 300, 'a line he never had stands aside');
  assert.equal(figuresOf('danang-2026-08').dayShareCents, 3989, 'Da Nang: the stay and the flight in, the motorbike n/a');
});

test('T6 nights, a rental\'s days and the fixed bookings: the stay\'s end less its start, the rental\'s last day less its first, the sum of the lines paid', () => {
  assert.equal(nightsOf({ start: '2026-07-01', end: '2026-07-30' }), 29);
  assert.equal(nightsOf({ start: '2026-10-21', end: '2026-10-22' }), 1);
  assert.equal(nightsOf({ start: '2026-10-22', end: null }), null, 'a stay with no end yet has none');
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1, 'across a year');
  assert.equal(motoDayCount({ from: '2026-07-03', to: '2026-07-30' }), 27);
  assert.equal(motoDayCount(null), null, 'a rental with no row has none');
  const canggu = figuresOf('canggu-2026-07');
  assert.deepEqual([canggu.nights, canggu.motoDays, canggu.fixedCents], [29, 27, 167713]);
  const pererenan = figuresOf('pererenan-2026-12');
  assert.deepEqual([pererenan.stay.kind, pererenan.moto.kind, pererenan.flightIn.kind, pererenan.fixedCents], ['paid', 'unknown', 'unknown', 28590]);
  const nothing = stopFigures({ start: '2026-07-01', end: '2026-07-30' }, { stopId: 'x', stay: { kind: 'unknown' }, moto: { kind: 'none' }, flightIn: { kind: 'unknown' } }, null);
  assert.equal(nothing.fixedCents, null, 'no line paid: no sum, never $0');
  assert.throws(() => stopFigures({ start: '2026-07-01', end: '2026-07-01' }, costs('canggu-2026-07'), null), /spread across nothing has no rate/, 'a stay that ends the day it starts: the rate is refused by name');
});

test('T6 dayNumber\'s inverse: civilFromDays turns every day from 1600 to 2400 back into its date; the calendar\'s weekdays from its first day; its seats, an empty one for a date with no entry', () => {
  const from = dayNumber('1600-01-01');
  const to = dayNumber('2400-12-31');
  let previous = '';
  for (let n = from; n <= to; n += 1) {
    const date = civilFromDays(n);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date) && date > previous, `day ${n} is a date after the one before it`);
    if (dayNumber(date) !== n) assert.fail(`civilFromDays(${n}) is ${date}, whose dayNumber is ${dayNumber(date)}`);
    previous = date;
  }
  assert.equal(civilFromDays(0), '1970-01-01');
  for (const [day, next] of [['2000-02-28', '2000-02-29'], ['1900-02-28', '1900-03-01'], ['2100-02-28', '2100-03-01'], ['2024-02-28', '2024-02-29'], ['2026-12-31', '2027-01-01']]) {
    assert.equal(civilFromDays(dayNumber(day) + 1), next, `the day after ${day}`);
  }
  assert.throws(() => civilFromDays(1.5), TripFiguresError);
  assert.throws(() => civilFromDays(dayNumber('9999-12-31') + 1), /not YYYY/);
  assert.deepEqual(weekdayDates('2026-07-01').map(weekdayWords), ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'], 'Canggu\'s calendar stands under the seven days from Jul 1');
  // a post with a gap in its days: the Lisbon fixture's Sep 1 and Sep 8 — six empty seats between, so each stands under its weekday
  const gap = calendarSeats(['2026-09-01', '2026-09-08']);
  assert.deepEqual(gap.map((s) => s.entry), [0, null, null, null, null, null, null, 1]);
  assert.deepEqual([gap[0].date, gap[7].date], ['2026-09-01', '2026-09-08']);
  const canggu = calendarSeats(TRIP_POSTS[0].weeks.flatMap((w) => w.days.map((d) => d.date)));
  assert.equal(canggu.length, 30);
  assert.ok(canggu.every((s, i) => s.entry === i), 'Canggu has an entry every day');
  assert.throws(() => calendarSeats([]), /no days has no calendar/);
  assert.throws(() => calendarSeats(['2026-09-08', '2026-09-01']), /strictly ascending/);
  assert.throws(() => calendarSeats(['2026-9-1']), /is not YYYY-MM-DD/);
  assert.deepEqual(routineTotals(postOf('canggu-2026-07')?.routine ?? assert.fail('Canggu has its day')), [
    { kind: 'activity', hours: 2 }, { kind: 'meals', hours: 2 }, { kind: 'focus', hours: 8 }, { kind: 'entertainment', hours: 4 }, { kind: 'sleep', hours: 8 },
  ], 'each kind once, in the order the day meets it, its hours summed');
});

test('T6 the README\'s table of the ten stops\' figures, cell for cell, as the figures leaf and the words leaf build them', () => {
  const table = readmeSection('The figures').split('\n').filter((l) => /^\| \d+ · /.test(l));
  assert.equal(table.length, 10, 'ten rows');
  const cell = (t: Words.TileWords): string => {
    const value = t.value.kind === 'figure' ? (t.value.unit === null ? t.value.text : `${t.value.text} ${t.value.unit}`) : t.value.text;
    return t.note === null ? value : `${value} (${t.note})`;
  };
  tripOrder(WAS_HERE).forEach((r, i) => {
    const f = figuresOf(r.id);
    const tiles = Words.tileWords(r, f);
    const howLong = tiles[0].value.kind === 'figure' ? `${tiles[0].value.text} ${tiles[0].value.unit}` : tiles[0].value.text;
    const share = f.dayShareCents === null ? 'not drawn' : `${functionalMoneyWords(f.dayShareCents)} ${Words.PER_DAY}`;
    assert.equal(`| ${i + 1} · ${r.city} | ${howLong} | ${cell(tiles[1])} | ${cell(tiles[2])} | ${cell(tiles[3])} | ${share} |`, table[i], `${r.id}, cell for cell`);
  });
});

test('T6 the two leaves are pure: no clock, no locale call; the figures leaf imports only types and the one date module', () => {
  for (const file of [FIGURES, WORDS]) assert.doesNotMatch(code(file), /toLocale|new Date\(|Date\.now|Intl\./, `${file}: no clock, no locale`);
  const imports = [...code(FIGURES).matchAll(/^import\s+(type\s+)?\{[^}]*\}\s+from\s+'([^']+)';/gm)].map((m) => `${m[1] ? 'type ' : ''}${m[2]}`);
  assert.deepEqual(imports, ['type ./tripCosts', 'type ./tripPosts', 'type ./wasHere', './experienceWords']);
  assert.match(code(FIGURES), /import \{ dayNumber \} from '\.\/experienceWords';/, 'dayNumber, and nothing else, from the one date module');
});

// ── T7 · THE WORDS ───────────────────────────────────────────────────────────

test('T7 every new word the README names is the new leaf\'s; each fixed word typed there once; Source ↗ is the events band\'s own SOURCE_LINK', () => {
  const table = readmeSection('Words');
  const newWords = table.slice(table.indexOf('**New words.**'));
  const canggu = figuresOf('canggu-2026-07');
  const day = postOf('canggu-2026-07')?.routine ?? assert.fail('Canggu has its day');
  // [the word as the README's New words table writes it, what the leaf gives for it, whether the leaf types it whole]
  const said: ReadonlyArray<readonly [word: string, given: string, fixed: boolean]> = [
    ['Stop 1 of 10', Words.stopCountWords(1, 10), false],
    ['On this page', Words.TABS_LABEL, true],
    ['Duration', Words.TILE_LABELS.duration, true], ['Stay / night', Words.TILE_LABELS.stay, true], ['Motorbike / day', Words.TILE_LABELS.moto, true], ['Fixed bookings', Words.TILE_LABELS.fixed, true],
    ['29 nights', Words.nightsWords(29), false], ['1 night', Words.nightsWords(1), false], ['27 days', Words.daysWords(27), false], ['1 day', Words.daysWords(1), false],
    ['$708.14 ÷ 29 nights', Words.spreadWords(70814, 29, 'nights'), false], ['$63.53 total', Words.totalWords(6353), false], ['stay + motorbike + flight in', Words.fixedNoteWords(canggu), false],
    ...(['story', 'routine', 'favorites', 'costs', 'journal', 'learned', 'on'] as const).flatMap((k) => [
      [Words.SECTION_WORDS[k].tab, Words.SECTION_WORDS[k].tab, true], [Words.SECTION_WORDS[k].eyebrow, Words.SECTION_WORDS[k].eyebrow, true], [Words.SECTION_WORDS[k].title, Words.SECTION_WORDS[k].title, true],
    ] as const),
    ['01 / The experience', Words.numberedEyebrow(1, Words.SECTION_WORDS.story.eyebrow), false],
    [Words.ROUTINE_INTRO, Words.ROUTINE_INTRO, true], [Words.FAVORITES_INTRO, Words.FAVORITES_INTRO, true], [Words.COSTS_INTRO_SHARED, Words.COSTS_INTRO_SHARED, true],
    [Words.COSTS_INTRO, Words.COSTS_INTRO, true], [Words.JOURNAL_INTRO, Words.JOURNAL_INTRO, true],
    ...TRIP_POST_ROUTINE_KINDS.map((k) => [Words.ROUTINE_KIND_LABELS[k], Words.ROUTINE_KIND_LABELS[k], true] as const),
    ['Activity · 2h', Words.routineKeyWords('activity', 2), false],
    ['A day in 24 hours: activity 2 hours, ', Words.routineBarWords(routineTotals(day)).slice(0, 'A day in 24 hours: activity 2 hours, '.length), false],
    ['Read that day →', Words.READ_THAT_DAY, true],
    ['Booking breakdown', Words.BREAKDOWN_LABEL, true], ['Fixed bookings total', Words.TOTAL_LABEL, true], ['Fixed bookings in my log', Words.TOTAL_IN_LOG_LABEL, true],
    ['Excludes meals, activities and other spending', Words.TOTAL_NOTE, true], ['Also in my log', Words.ALSO_IN_LOG, true],
    ['Daily cost allocation', Words.SHARE_LABEL, true], ['/ day', Words.PER_DAY, true],
    ['Fixed bookings normalized over the 29-night stay; motorbike over its 27 rental days.', Words.shareNoteWords(canggu), false],
    ['A day from the fixed bookings: stay $24.42, ', Words.splitBarWords(canggu).slice(0, 'A day from the fixed bookings: stay $24.42, '.length), false],
    ['The rest', Words.REST_LABEL, true],
    ['30 days', Words.daysWords(30), false], ['Day 1 of 30', Words.dayOfWords(1, 30), false], ['Earlier day', Words.EARLIER_DAY, true], ['Later day', Words.LATER_DAY, true],
    ['The big takeaway', Words.TAKEAWAY_LABEL, true],
    ['Source ↗', Words.SOURCE_WORD, true],
    ['More stops', Words.PAGER_LABEL, true], ['← Stop 0', Words.pagerBeforeWords('Stop 0'), false], ['Stop 2 →', Words.pagerAfterWords('Stop 2'), false],
  ];
  const leaf = code(WORDS);
  for (const [word, given, fixed] of said) {
    assert.ok(newWords.includes(word), `the README's New words table names "${word}"`);
    assert.equal(given, word, `the leaf gives "${word}"`);
    if (fixed) assert.equal(count(leaf, `'${word}'`), 1, `"${word}" is typed in the leaf once, whole`);
  }
  assert.equal(Words.SOURCE_WORD, SOURCE_LINK, 'copied from SOURCE_LINK, and held equal');
  assert.equal(Words.shareNoteWords(figuresOf('danang-2026-08')), 'Fixed bookings normalized over the 29-night stay.', 'no motorbike clause where there is none');
  assert.equal(Words.splitBarWords(figuresOf('danang-2026-08')), 'A day from the fixed bookings: stay $33.82, flight in $6.07');
  assert.equal(Words.routineBarWords(routineTotals(day)), 'A day in 24 hours: activity 2 hours, meals 2 hours, focus 8 hours, entertainment 4 hours, sleep 8 hours');
  assert.deepEqual(TRIP_POST_ROUTINE_KINDS.map((k) => Words.routineKeyWords(k, 1)), ['Activity · 1h', 'Meals · 1h', 'Focus · 1h', 'Entertainment · 1h', 'Sleep · 1h']);
  assert.equal(Words.totalLabel(figuresOf('cebu-2026-11')), Words.TOTAL_IN_LOG_LABEL, 'a line not in his log: the total is what is in his log');
  assert.equal(Words.totalLabel(figuresOf('siargao-2026')), Words.TOTAL_LABEL);
  assert.equal(Words.fixedNoteWords(figuresOf('pererenan-2026-12')), `stay · motorbike, flight in ${NOT_IN_LOG}`);
  assert.equal(Words.stayDetailWords(figuresOf('canggu-2026-07')), '29 nights');
  assert.equal(Words.motoDetailWords(figuresOf('canggu-2026-07'), motoDaysOf('canggu-2026-07')), '27 days · Jul 3–30, 2026');
  assert.equal(Words.motoDetailWords(figuresOf('siargao-2026'), motoDaysOf('siargao-2026')), null, 'no days on file: no line under the rental');
  assert.deepEqual([Words.twoDigits(1), Words.twoDigits(10), Words.calendarDayWords('2026-07-01'), Words.calendarDayWords('2026-07-30')], ['01', '10', '01', '30']);
  const tiles = Words.tileWords(row('danang-2026-08'), figuresOf('danang-2026-08'));
  assert.deepEqual(tiles[2], { label: Words.TILE_LABELS.moto, value: { kind: 'words', text: NOT_APPLICABLE }, note: null }, 'a line he never had: n/a, and nothing under it');
});

// ── T8 · THE DATA ────────────────────────────────────────────────────────────

const LISBON: TripPost = {
  stopId: 'lisbon-2026', title: 'Three weeks in Lisbon.', dek: 'Three weeks.', short: [{ label: 'Best day', value: 'the tram' }], lessons: [{ lead: 'Go early.', rest: 'The queue is long.' }],
  costs: [], costNote: 'From the log.',
  weeks: [
    { title: 'Arriving', days: [{ date: '2026-09-01', story: 'Landed. The tram up the hill was the best ride of the trip.', chips: [] }] },
    { title: 'Leaving', days: [{ date: '2026-09-08', story: 'Left.', chips: [] }] },
  ],
  picks: [{ heading: 'Food', items: ['Pastel de nata'] }], writtenOn: '2026-09-21',
  routine: { blocks: [{ kind: 'focus', hours: 8 }, { kind: 'activity', hours: 4 }, { kind: 'sleep', hours: 12 }], cards: [{ label: 'The focus', title: 'Writing', text: 'Eight hours a day.' }] },
  feature: { short: 'Best day', day: '2026-09-01', line: 'The tram up the hill was the best ride of the trip.', image: { src: '/was-here/canggu-2026-07.jpg', alt: 'A photo.', credit: 'Photo: Alex Stuart' } },
};
const refusesPost = (post: unknown, words: string): void => {
  const v = tripPostsLaw({ throwOnFail: false, posts: [post as TripPost] });
  assert.ok(v.some((line) => line.startsWith('lisbon-2026: ') && line.includes(words)), `expected a violation naming lisbon-2026 and "${words}", got [${v.join(' | ')}]`);
};
const withRoutine = (patch: Record<string, unknown>): unknown => ({ ...LISBON, routine: { ...LISBON.routine, ...patch } });
const withFeature = (patch: Record<string, unknown>): unknown => ({ ...LISBON, feature: { ...LISBON.feature, ...patch } });
const refusesDays = (motoDays: Record<string, unknown>, words: string): void => {
  const v = tripCostsLaw({ throwOnFail: false, rows: TRIP_COSTS, motoDays: motoDays as Record<string, TripMotoDays> });
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};

test('T8 a rental\'s days: TRIP_MOTO_DAYS holds Canggu\'s, Jul 3 to Jul 30; the row shape does not change; every refusal by name over injected tables', () => {
  assert.deepEqual(TRIP_MOTO_DAYS, { 'canggu-2026-07': { from: '2026-07-03', to: '2026-07-30' } });
  assert.deepEqual([...TRIP_COST_FIELDS], ['stopId', 'stay', 'moto', 'flightIn'], 'the row shape does not change');
  assert.deepEqual(motoDaysOf('canggu-2026-07'), { from: '2026-07-03', to: '2026-07-30' });
  assert.equal(motoDaysOf('phuket-2026-10'), null, 'Phuket\'s days are his to give');
  assert.equal(motoDaysOf('siargao-2026'), null, 'Siargao\'s too');
  assert.deepEqual(tripCostsLaw({ throwOnFail: false }), [], 'the live table passes');
  assert.deepEqual(tripCostsLaw({ throwOnFail: false, rows: TRIP_COSTS, motoDays: TRIP_MOTO_DAYS }), []);
  refusesDays({ 'lisbon-2026': { from: '2026-09-01', to: '2026-09-05' } }, "lisbon-2026: TRIP_MOTO_DAYS holds a rental's days for a stop that is no row's stop");
  refusesDays({ 'danang-2026-08': { from: '2026-08-01', to: '2026-08-05' } }, "danang-2026-08: TRIP_MOTO_DAYS holds a rental's days, but the row's motorbike is none — only a paid motorbike has days");
  refusesDays({ 'cebu-2026-11': { from: '2026-11-14', to: '2026-11-19' } }, "the row's motorbike is unknown");
  refusesDays({ 'canggu-2026-07': { from: '2026-07-03', to: '2026-07-30', by: 'Nyoman' } }, "canggu-2026-07: TRIP_MOTO_DAYS keys are [from, to, by] — a rental's days are exactly from, to");
  refusesDays({ 'canggu-2026-07': { from: '2026-07-03' } }, 'keys are [from]');
  refusesDays({ 'canggu-2026-07': null }, 'keys are [null]');
  refusesDays({ 'canggu-2026-07': { from: '2026-7-03', to: '2026-07-30' } }, 'canggu-2026-07: TRIP_MOTO_DAYS from "2026-7-03" is not YYYY-MM-DD');
  refusesDays({ 'canggu-2026-07': { from: '2026-07-03', to: 'Jul 30' } }, 'to "Jul 30" is not YYYY-MM-DD');
  refusesDays({ 'canggu-2026-07': { from: '2026-07-30', to: '2026-07-03' } }, 'canggu-2026-07: TRIP_MOTO_DAYS from 2026-07-30 is not before its to 2026-07-03');
  refusesDays({ 'canggu-2026-07': { from: '2026-07-03', to: '2026-07-03' } }, 'from 2026-07-03 is not before its to 2026-07-03');
  assert.throws(() => tripCostsLaw({ motoDays: { 'lisbon-2026': { from: '2026-09-01', to: '2026-09-05' } } }), /TRIP COSTS LAW failed/, 'thrown by default');
});

test('T8 a post\'s day and its favorite: twelve fields; Canggu\'s as the README gives them; the takeaway is no field; every refusal by name over injected posts', () => {
  assert.deepEqual([...TRIP_POST_FIELDS], ['stopId', 'title', 'dek', 'short', 'lessons', 'costs', 'costNote', 'weeks', 'picks', 'writtenOn', 'routine', 'feature']);
  assert.ok(!(TRIP_POST_FIELDS as readonly string[]).includes('takeaway'), 'the takeaway is the first lesson\'s lead, by rule');
  const canggu = postOf('canggu-2026-07') ?? assert.fail('Canggu is written up');
  assert.deepEqual(canggu.routine, {
    blocks: [{ kind: 'activity', hours: 2 }, { kind: 'meals', hours: 1 }, { kind: 'focus', hours: 8 }, { kind: 'meals', hours: 1 }, { kind: 'entertainment', hours: 4 }, { kind: 'sleep', hours: 8 }],
    cards: [
      { label: 'The focus', title: 'Temple Stuart', text: 'Product development, marketing, professional services, and building the tools I use to manage the trip.' },
      { label: 'The life', title: 'Beyond the laptop', text: 'Training, surf, cafes, local food, sunsets, social experiences, and exploring wherever I happen to be.' },
    ],
  }, 'his day as approved, with focus for work (README, Data)');
  const uluwatu = row('uluwatu-2026-11').image ?? assert.fail('Uluwatu has its photo');
  assert.deepEqual(canggu.feature, { short: 'Best day', day: '2026-07-05', line: 'I’m already planning a trip back just for Uluwatu.', image: { src: '/was-here/uluwatu-2026-11.jpg', alt: uluwatu.alt, credit: uluwatu.credit } }, 'his favorite, with that photo\'s own alt and credit');
  const favorite = canggu.feature ?? assert.fail('Canggu has its favorite');
  const fifth = canggu.weeks.flatMap((w) => w.days).find((d) => d.date === '2026-07-05') ?? assert.fail('Canggu has Jul 5');
  assert.ok(fifth.story.includes(favorite.line), 'his words, letter for letter, from that day');
  assert.deepEqual(tripPostsLaw({ throwOnFail: false }), [], 'the live post passes');
  assert.deepEqual(tripPostsLaw({ throwOnFail: false, posts: [LISBON] }), [], 'the fixture passes');
  assert.deepEqual(tripPostsLaw({ throwOnFail: false, posts: [{ ...LISBON, routine: null, feature: null }] }), [], 'each may be none');
  refusesPost({ ...LISBON, extra: 1 }, 'a post carries exactly the twelve ruled fields');
  // the day
  refusesPost(withRoutine({ extra: 1 }), 'routine keys are not exactly blocks, cards');
  refusesPost({ ...LISBON, routine: 'focus' }, 'routine keys are not exactly blocks, cards');
  refusesPost(withRoutine({ blocks: [] }), 'routine has no blocks');
  refusesPost(withRoutine({ blocks: [{ kind: 'focus', hours: 8, why: 'x' }, { kind: 'sleep', hours: 16 }] }), 'routine.blocks[0] keys are not exactly kind, hours');
  refusesPost(withRoutine({ blocks: [{ kind: 'work', hours: 8 }, { kind: 'sleep', hours: 16 }] }), 'routine.blocks[0] kind "work" is not activity | meals | focus | entertainment | sleep');
  for (const bad of [0, -2, 1.5, '8', null]) refusesPost(withRoutine({ blocks: [{ kind: 'focus', hours: bad }, { kind: 'sleep', hours: 16 }] }), `routine.blocks[0] hours ${JSON.stringify(bad)} is not a positive whole number`);
  refusesPost(withRoutine({ blocks: [{ kind: 'focus', hours: 8 }, { kind: 'sleep', hours: 15 }] }), 'routine hours come to 23, not 24');
  refusesPost(withRoutine({ blocks: [{ kind: 'focus', hours: 8 }, { kind: 'sleep', hours: 17 }] }), 'routine hours come to 25, not 24');
  refusesPost(withRoutine({ cards: [] }), 'routine has no cards');
  refusesPost(withRoutine({ cards: [{ label: 'The focus', title: 'Writing' }] }), 'routine.cards[0] keys are not exactly label, title, text');
  for (const field of ['label', 'title', 'text']) refusesPost(withRoutine({ cards: [{ label: 'The focus', title: 'Writing', text: 'Eight hours.', [field]: ' ' }] }), `routine.cards[0] has an empty ${field}`);
  // the favorite
  refusesPost(withFeature({ extra: 1 }), 'feature keys are not exactly short, day, line, image');
  refusesPost({ ...LISBON, feature: 'Best day' }, 'feature keys are not exactly short, day, line, image');
  refusesPost(withFeature({ short: 'Best night' }), 'feature short "Best night" is no line of the short version');
  refusesPost(withFeature({ short: 'the tram' }), 'feature short "the tram" is no line of the short version');
  refusesPost(withFeature({ day: '2026-09-02' }), 'feature day "2026-09-02" is no day of the post');
  refusesPost(withFeature({ day: 'Sep 1' }), 'feature day "Sep 1" is no day of the post');
  refusesPost(withFeature({ line: 'The tram up the hill was the best ride of my trip.' }), 'feature line is not found in the story of 2026-09-01, letter for letter');
  refusesPost(withFeature({ line: 'the tram up the hill was the best ride of the trip.' }), 'feature line is not found in the story of 2026-09-01, letter for letter');
  refusesPost(withFeature({ line: '' }), 'feature line is not found in the story of 2026-09-01, letter for letter');
  refusesPost(withFeature({ day: '2026-09-08' }), 'feature line is not found in the story of 2026-09-08, letter for letter');
  refusesPost(withFeature({ image: { src: '/was-here/canggu-2026-07.jpg', alt: 'A photo.' } }), 'feature image keys are not exactly src, alt, credit');
  for (const field of ['src', 'alt', 'credit']) refusesPost(withFeature({ image: { src: '/was-here/canggu-2026-07.jpg', alt: 'A photo.', credit: 'Photo: Alex Stuart', [field]: '' } }), `feature image has an empty ${field}`);
  assert.throws(() => tripPostsLaw({ posts: [withFeature({ day: '2026-09-02' }) as TripPost] }), /TRIP POSTS LAW failed/, 'thrown by default');
  for (const file of [COSTS, POSTS]) assert.doesNotMatch(code(file), /\bimport\b|\brequire\(/, `${file} still imports nothing`);
});

test('T8 the build law: two clauses on the trip post law\'s line, each refused by name and ending (TRIPPOST-02), the verdict naming both; its import edited in place; the file keeps its 11,254 lines; the seeds on file, each expecting its clause\'s own words', () => {
  const law = code(LAW);
  assert.equal(count(law, '\n'), 11254, 'the file keeps its lines: tests read them by number');
  const lines = law.split('\n');
  const at = lines.findIndex((l) => l.includes('violations.push(...tripPostsLaw({ throwOnFail: false }), ...tripCostsLaw({ throwOnFail: false }));'));
  assert.equal(at, 732, 'the trip post law is line 733');
  const line = lines[at];
  assert.ok(lines[161].startsWith("import { WAS_HERE, wasHereLaw } from '../src/lib/wasHere';"), 'line 162 opens as it did');
  assert.ok(lines[161].includes("import { TRIP_COSTS, TRIP_MOTO_DAYS, tripCostsLaw } from '../src/lib/tripCosts';") && lines[161].includes("import { WAS_HERE_IMAGE_SRC } from '../src/lib/wasHere';"), 'its import, edited in place');
  // (1) each post's favorite photo, held to the stop photos' law
  for (const words of [
    "if (!WAS_HERE_IMAGE_SRC.test(photoSrc)) violations.push(`trip posts: ${post.stopId}'s favorite photo ${photoSrc} is not /was-here/<slug>.jpg or .webp (TRIPPOST-02)`);",
    "else if (!existsSync(photo)) violations.push(`trip posts: ${post.stopId}'s favorite photo ${photoSrc} does not exist under public/ (TRIPPOST-02)`);",
    "if (statSync(photo).size > 400 * 1024) violations.push(`trip posts: ${post.stopId}'s favorite photo ${photoSrc} is ${statSync(photo).size} bytes — at most 400 KB (TRIPPOST-02)`);",
    "for (const why of photoShapeViolations(post.stopId, photoSrc, photoBytes(photo))) violations.push(`trip posts: ${post.stopId}'s favorite photo — ${why} (TRIPPOST-02)`);",
  ]) assert.ok(line.includes(words), `the law line holds: ${words.slice(0, 70)}…`);
  // (2) each rental's days inside its stop's stay
  for (const words of [
    "for (const [stopId, days] of Object.entries(TRIP_MOTO_DAYS)) { const stay = WAS_HERE.find((r) => r.id === stopId);",
    "if (stay === undefined) { violations.push(`trip costs: ${stopId}'s rental days name no WAS_HERE stop (TRIPPOST-02)`); continue; }",
    "if (days.from < stay.start) violations.push(`trip costs: ${stopId}'s rental starts ${days.from}, before its stay's start ${stay.start} (TRIPPOST-02)`);",
    "if (stay.end !== null && days.to > stay.end) violations.push(`trip costs: ${stopId}'s rental ends ${days.to}, after its stay's end ${stay.end} (TRIPPOST-02)`);",
  ]) assert.ok(line.includes(words), `the law line holds: ${words.slice(0, 70)}…`);
  assert.ok(line.includes('favorite photo(s), each /was-here/<slug>.jpg or .webp on disk at no more than 400 KB and within 1% of 3 : 2 by its own header;') && line.includes("rental(s) with its days, each inside its stop's stay;"), 'the verdict names both');
  // the seeds: each find once in its file, each expect its clause's own words
  assert.equal(TRIPPOST_SEEDS.length, 2);
  const [photoSeed, daysSeed] = TRIPPOST_SEEDS;
  for (const seed of TRIPPOST_SEEDS) assert.equal(count(whole(seed.file), seed.find), 1, `${seed.name}: its find stands once in ${seed.file}`);
  assert.equal(photoSeed.file, POSTS);
  assert.ok(photoSeed.expect.startsWith("trip posts: canggu-2026-07's favorite photo /was-here/") && photoSeed.expect.endsWith(' does not exist under public/ (TRIPPOST-02)'), 'the photo seed expects clause (1)\'s words');
  const absent = /\/was-here\/[a-z0-9-]+\.jpg/.exec(photoSeed.replace)?.[0] ?? assert.fail('the photo seed names a path');
  assert.ok(photoSeed.expect.includes(absent) && !readdirSync(resolve(ROOT, 'public/was-here')).includes(absent.slice('/was-here/'.length)), 'a path the law accepts, of a file that is not on disk');
  assert.equal(daysSeed.file, COSTS);
  assert.equal(daysSeed.expect, "trip costs: canggu-2026-07's rental ends 2026-07-31, after its stay's end 2026-07-30 (TRIPPOST-02)", 'the days seed expects clause (2)\'s words');
  assert.equal(row('canggu-2026-07').end, '2026-07-30', 'a day after Canggu\'s stay');
  assert.ok(whole(SEEDS_FILE).includes("import type { Seed } from '../prove';"), 'in tripcards03.seeds.ts\'s form');
});

// ── T10 · HIS WORDS ──────────────────────────────────────────────────────────

test('T10 Alex\'s two messages, quoted exact wherever a file this brief touches quotes them', () => {
  const files = [README, REFERENCE, FIGURES, WORDS, COSTS, POSTS, LAW, SEEDS_FILE, GLOBALS, 'src/lib/__tests__/homeAbout01.test.ts', 'src/lib/__tests__/tripPost02.test.ts'];
  let quoted = 0;
  for (const file of files) {
    const text = whole(file).replace(/\n \* /g, ' ');
    for (const message of [HIS_BRIEF, HIS_YES]) {
      const opening = message.slice(0, 26);
      for (let at = text.indexOf(opening); at > -1; at = text.indexOf(opening, at + 1)) {
        assert.equal(text.slice(at, at + message.length), message, `${file}: his words, exact`);
        quoted += 1;
      }
    }
  }
  assert.ok(quoted >= 6, 'the README, the port\'s header and this file quote both');
});
