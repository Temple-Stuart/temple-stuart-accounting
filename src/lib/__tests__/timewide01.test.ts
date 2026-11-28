/**
 * TIMEWIDE-01 (Alex, 2026-11-24) — THE TIME SHEET TAKES THE WINDOW'S WIDTH.
 *
 * /time's page loses the tool page's cap (ui/AppLayout.tsx `wide`, read only together with `page`), and the sheet's table lets
 * its head words wrap and sets its cells a little closer (ledger.ts LEDGER_TABLE_CLASS, handed to the shared table). Nothing is
 * renamed, moved, added or removed: the same rows, the same twenty-one columns in the same order with the same words.
 *
 * HERMETIC — no database, no network, no clock. Every source file is read through the reader with its comments stripped
 * (rejoin() where a whole file is the subject), the class is compiled with the repo's own Tailwind config, and the registry is
 * read as it is exported. This test holds classes, props, head words and line counts only — nothing in it is anyone's data.
 * It names line numbers in ONE place, on purpose: the lines the registry's Time row cites, which this change may not move.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import { code, comments, rejoin } from '../sourceText';
import { TOOL_REGISTRY } from '../toolRegistry';
import { LEDGER_HEAD_WORDS, LEDGER_TABLE_CLASS } from '../operations/ledger';

const OPS = 'src/components/workbench/operations';
const LAYOUT = 'src/components/ui/AppLayout.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const RULES = 'src/lib/operations/ledger.ts';
const SECTION = `${OPS}/ledger/LedgerSection.tsx`;
const TABLE = 'src/components/table/DataTable.tsx';
const TAILWIND = 'tailwind.config.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A whole file, comment and code alike — for an equality over every character (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
/** Every source file under a folder with one of the endings — the tests' own folder left out. */
const walk = (dir: string, ending: RegExp): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path, ending);
  return ending.test(name) ? [path] : [];
});
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;

// The main's three arms, each typed whole — and the choice between them exactly as ruling A writes it.
const WIDE_ARM = 'w-full min-w-0 px-3 py-2'; // COALEVELS-01 (2026-11-27): the wide page's own padding — the page's (px-4 lg:px-8 py-6 sm:py-8) until then
const PAGE_ARM = 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8';
const ROOM_ARM = 'max-w-[1800px] mx-auto w-full';
const RULED_CLASS = "page && wide ? 'w-full min-w-0 px-3 py-2' : page ? 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8' : 'max-w-[1800px] mx-auto w-full'";

// ── T1 · THE PROP (ruling A) ─────────────────────────────────────────────────

test('T1 AppLayout gains ONE prop, `wide`, beside `page`, with its dated doc; it is named in three places — the prop, the parameter and the main’s class — and nowhere else', () => {
  const layout = code(LAYOUT);
  // The prop: optional, a boolean, between `page` and `rail` — nothing but their docs between the three.
  assert.match(layout, /\n {2}page\?: boolean;\n(?:[ \t]*\n)* {2}wide\?: boolean;\n(?:[ \t]*\n)* {2}rail\?: boolean;\n\}/);
  // Its doc stands right above it, dated, in the file's own style — one block comment and nothing else between `page` and `wide`.
  const file = whole(LAYOUT);
  const between = file.slice(file.indexOf('  page?: boolean;\n') + '  page?: boolean;\n'.length, file.indexOf('  wide?: boolean;\n'));
  assert.match(between, /^ {2}\/\*\*\n(?: {3}\*[^\n]*\n)+ {3}\*\/\n$/, 'one doc block');
  assert.match(between, /^ {2}\/\*\*\n {3}\* TIMEWIDE-01 \(Alex, 2026-11-24\): a `page` that takes the window's width/);
  assert.match(between, /page's own gutter and padding, and no cap\. Read only together with `page`;/);
  assert.equal(countOf(between, /\/\*\*/g), 1);
  // The parameter, beside `page`'s, in the one signature.
  assert.ok(layout.includes('export default function AppLayout({ children, ledgerMetrics, engineMetrics, onOpenTaxSettings, bookkeepingBar, page = false, wide = false, rail = true }: AppLayoutProps) {'));
  // Read nowhere but the main's class: three lines name it, and they are these three.
  const naming = layout.split('\n').filter((line) => /\bwide\b/.test(line)).map((line) => line.trim());
  assert.equal(naming.length, 3);
  assert.equal(naming[0], 'wide?: boolean;');
  assert.match(naming[1], /^export default function AppLayout\(\{/);
  assert.equal(naming[2], `<main className={${RULED_CLASS}}>`);
  assert.equal(countOf(layout, /\bwide\b/g), 3, 'once on each');
  // `page` is read where it was, and beside `wide` in the class.
  assert.equal(layout.split('\n').filter((line) => /\bpage\b/.test(line)).length, 3, 'the prop, the parameter, the main’s class');
  assert.equal(countOf(layout, /\bpage\b/g), 4, 'twice in the class now: with `wide`, and alone');
});

// ── T2 · THE MAIN'S CLASS (ruling A) ─────────────────────────────────────────

test('T2 the main’s class is the three-way choice as ruled: with `page` and `wide`, no cap and the wide page’s own padding (COALEVELS-01, 2026-11-27: px-3 py-2 — the page’s own gutter and padding until then); the two arms that were there, byte for byte; the header, the bars and the rail as they are', () => {
  const layout = code(LAYOUT);
  const mains = layout.split('\n').filter((line) => line.includes('<main')).map((line) => line.trim());
  assert.deepEqual(mains, [`<main className={${RULED_CLASS}}>`], 'one main, its class exactly as ruled');
  assert.equal(RULED_CLASS, `page && wide ? '${WIDE_ARM}' : page ? '${PAGE_ARM}' : '${ROOM_ARM}'`, 'three arms');
  // The two arms that were there: the line ends in exactly what the whole expression was.
  assert.ok(mains[0].endsWith(`page ? '${PAGE_ARM}' : '${ROOM_ARM}'}>`), 'a page without `wide`, and a room, get the class they had');
  // The wide arm: the page's width words, no cap and no centring, and a padding of its own. COALEVELS-01 (2026-11-27): 'the page's arm without its cap and its centring — nothing else differs' until then.
  assert.deepEqual([WIDE_ARM, PAGE_ARM.replace('max-w-7xl mx-auto ', '')], ['w-full min-w-0 px-3 py-2', 'w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8']);
  assert.doesNotMatch(WIDE_ARM, /max-w-|mx-auto/, 'no cap, so nothing to centre');
  for (const kept of ['w-full', 'min-w-0']) assert.ok(WIDE_ARM.split(' ').includes(kept), `${kept}: the page's own`); assert.deepEqual(WIDE_ARM.split(' ').filter((c) => /^(sm:|lg:)?p[xy]-/.test(c)), ['px-3', 'py-2'], 'one padding, at every width');
  // `wide` without `page` is not read: the first test is `page && wide`.
  assert.match(mains[0], /^<main className=\{page && wide \? /);
  // Each arm is a whole literal — no class assembled from parts.
  assert.doesNotMatch(mains[0], /\$\{|`| \+ /);
  // Nothing else in the layout takes the width: the bar above, the rail beside, the column and the three bars' own caps.
  assert.match(layout, /<ShellBar\n\s*userLabel=\{userLabel\}/);
  assert.match(layout, /<div className="flex flex-1 min-w-0 flex-col sm:flex-row">\n\s*\{rail && \(\n\s*<Rail\n/);
  assert.match(layout, /<div className="flex-1 min-w-0 flex flex-col">/);
  assert.equal(countOf(layout, /<div className="max-w-\[1600px\] mx-auto px-4 lg:px-6 py-4">/g), 1, 'the bookkeeping bar');
  assert.equal(countOf(layout, /<div className="max-w-\[1800px\] mx-auto flex items-center px-6 py-2 text-xs">/g), 2, 'the ledger bar and the tax bar');
});

// ── T3 · WHO PASSES IT (ruling B) ────────────────────────────────────────────

test('T3 of every file under src that mounts AppLayout, exactly one passes `wide` — src/app/time/page.tsx, as <AppLayout page wide>; the seven other `page` mounts are bare; the Time page’s sections are as they were', () => {
  // The build law's own pattern for a mount — it takes props.
  assert.ok(code(LAW).includes('const MOUNT_APP_LAYOUT = /<AppLayout(\\s[^>]*)?>/g;'));
  const mounts = walk('src', /\.tsx$/).flatMap((file) => [...code(file).matchAll(/<AppLayout(\s[^>]*)?>/g)].map((m) => ({ file, mount: m[0] })));
  assert.ok(mounts.length > 8, 'the walk found the mounts');
  assert.deepEqual(mounts.filter((m) => /\bwide\b/.test(m.mount)), [{ file: TIME_PAGE, mount: '<AppLayout page wide>' }]);
  // Under src/app: the eight pages that mount it with `page` — seven bare, as they were.
  const paged = mounts.filter((m) => m.file.startsWith('src/app/') && /^<AppLayout page\b/.test(m.mount)).sort((a, b) => (a.file < b.file ? -1 : 1));
  assert.deepEqual(paged.map((m) => m.file), ['accounts', 'bill-pay', 'budget', 'calendar', 'crm', 'expenses', 'tasks', 'time'].map((room) => `src/app/${room}/page.tsx`));
  assert.deepEqual(paged.filter((m) => m.file !== TIME_PAGE).map((m) => m.mount), Array.from({ length: 7 }, () => '<AppLayout page>'));
  // No mount outside src/app passes `page` at all, so none can be wide.
  assert.deepEqual(mounts.filter((m) => !m.file.startsWith('src/app/') && /\bpage\b/.test(m.mount)), []);
  // The Time page: one mount, and inside it what was there — the opener, the provider, the three sections in their order.
  const page = code(TIME_PAGE);
  assert.equal(countOf(page, /<AppLayout\b/g), 1);
  assert.match(page, /<AppLayout page wide>\n\s*<ToolOpener compact tools=\{\[navToolByName\('Time', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>\n\s*<\/AppLayout>/); // COALEVELS-01 (2026-11-27): the opener is passed `compact` — one line; the sections as they were; SHEET-01 (2026-11-28): the ledger alone — the two journal tables after it until then
  // Its header carries the dated paragraph.
  assert.match(comments(TIME_PAGE), /TIMEWIDE-01 \(Alex, 2026-11-24\) — THE PAGE TAKES THE WINDOW'S WIDTH\./);
  assert.match(comments(TIME_PAGE), /passes `wide` beside `page`: the page's own gutter and padding, and no cap/);
});

// ── T4 · THE TABLE'S CLASS (ruling C) ────────────────────────────────────────

const CLASS_LINE = "export const LEDGER_TABLE_CLASS = 'min-w-[96rem] [&_th]:whitespace-normal [&_th]:px-1.5 [&_th]:py-1 [&_th]:align-bottom [&_td]:px-1.5 [&_td[data-ledger-cell]]:py-0.5 [&_td[data-ledger-cell]]:align-middle [&_td[data-ledger-cell]]:whitespace-nowrap [&_th]:border-l [&_th]:border-border [&_td]:border-l [&_td]:border-border [&_th:first-child]:border-l-0 [&_td:first-child]:border-l-0 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-bg-row [&_thead_th]:shadow-[inset_0_-1px_0_rgb(var(--ts-border))] [&_tfoot_th]:sticky [&_tfoot_th]:bottom-0 [&_tfoot_th]:bg-bg-row [&_tfoot_th]:py-0.5 [&_tfoot_th]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tfoot_td]:sticky [&_tfoot_td]:bottom-0 [&_tfoot_td]:bg-bg-row [&_tfoot_td]:py-0.5 [&_tfoot_td]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tr[data-ledger-row]:hover]:bg-bg-row [&_[data-ledger-pill]]:px-1.5 [&_[data-ledger-pill]]:py-0 [&_td[data-ledger-cell]_button]:px-1 [&_td[data-ledger-cell]_button]:py-0 [&_td[data-ledger-cell]_button]:leading-[14px] [&_td[data-ledger-cell=sub-account-name]]:max-w-[12rem] [&_td[data-ledger-cell=sub-account-name]]:truncate [&_td[data-ledger-cell=description]]:max-w-[16rem] [&_td[data-ledger-cell=description]]:truncate [&_td[data-ledger-cell=vendor]]:max-w-[11rem] [&_td[data-ledger-cell=vendor]]:truncate [&_td[data-ledger-cell=notes]]:max-w-[14rem] [&_td[data-ledger-cell=notes]]:truncate';"; // COALEVELS-01 (2026-11-27): THE GRID — the floor and forty-three variants; "…= 'min-w-[96rem] [&_th]:whitespace-normal [&_th]:px-1.5 [&_td]:px-1.5';" until then

test('T4 LEDGER_TABLE_CLASS is the whole literal, typed once and whole — the last export and the last line of ledger.ts, its dated note above it; forty-four classes (COALEVELS-01, 2026-11-27 — the grid; four until then), each once; tailwind scans the file', () => {
  assert.equal(LEDGER_TABLE_CLASS, 'min-w-[96rem] [&_th]:whitespace-normal [&_th]:px-1.5 [&_th]:py-1 [&_th]:align-bottom [&_td]:px-1.5 [&_td[data-ledger-cell]]:py-0.5 [&_td[data-ledger-cell]]:align-middle [&_td[data-ledger-cell]]:whitespace-nowrap [&_th]:border-l [&_th]:border-border [&_td]:border-l [&_td]:border-border [&_th:first-child]:border-l-0 [&_td:first-child]:border-l-0 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-bg-row [&_thead_th]:shadow-[inset_0_-1px_0_rgb(var(--ts-border))] [&_tfoot_th]:sticky [&_tfoot_th]:bottom-0 [&_tfoot_th]:bg-bg-row [&_tfoot_th]:py-0.5 [&_tfoot_th]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tfoot_td]:sticky [&_tfoot_td]:bottom-0 [&_tfoot_td]:bg-bg-row [&_tfoot_td]:py-0.5 [&_tfoot_td]:shadow-[inset_0_1px_0_rgb(var(--ts-border))] [&_tr[data-ledger-row]:hover]:bg-bg-row [&_[data-ledger-pill]]:px-1.5 [&_[data-ledger-pill]]:py-0 [&_td[data-ledger-cell]_button]:px-1 [&_td[data-ledger-cell]_button]:py-0 [&_td[data-ledger-cell]_button]:leading-[14px] [&_td[data-ledger-cell=sub-account-name]]:max-w-[12rem] [&_td[data-ledger-cell=sub-account-name]]:truncate [&_td[data-ledger-cell=description]]:max-w-[16rem] [&_td[data-ledger-cell=description]]:truncate [&_td[data-ledger-cell=vendor]]:max-w-[11rem] [&_td[data-ledger-cell=vendor]]:truncate [&_td[data-ledger-cell=notes]]:max-w-[14rem] [&_td[data-ledger-cell=notes]]:truncate');
  const rules = code(RULES);
  assert.equal(rules.split(CLASS_LINE).length - 1, 1, 'typed once, whole, on one line');
  assert.equal(countOf(rules, /\bLEDGER_TABLE_CLASS\b/g), 1, 'and named nowhere else in the rule file');
  // The last export, and the file's last line — nothing a citation names stands below it, and nothing above it moved.
  assert.equal(rules.split('\n').filter((line) => /^export /.test(line)).at(-1), CLASS_LINE);
  assert.equal(rules.replace(/\s+$/, '').split('\n').at(-1), CLASS_LINE);
  assert.ok(whole(RULES).endsWith(`${CLASS_LINE}\n`), 'the file ends with it');
  // Its dated note is the comment right above it.
  const file = whole(RULES);
  const note = file.slice(file.lastIndexOf('// ── TIMEWIDE-01'), file.lastIndexOf(CLASS_LINE));
  assert.match(note, /^\/\/ ── TIMEWIDE-01 \(Alex, 2026-11-24\): THE SHEET'S TABLE CLASS ─+\n/); assert.match(note, /\/\/ {3}COALEVELS-01 \(Alex, 2026-11-27\): THE GRID\./, 'and what the variants do now, said in the same note');
  assert.ok(note.split('\n').filter((line) => line !== '').every((line) => line.startsWith('//')), 'nothing but the note between its heading and the constant');
  // Forty-four classes: the floor the table had, the three variants it had, and the grid's forty — once each. COALEVELS-01 (2026-11-27): four until then.
  const classes = LEDGER_TABLE_CLASS.split(' ');
  assert.deepEqual([classes.slice(0, 3), classes[5], classes.slice(1).every((c) => c.startsWith('[&_'))], [['min-w-[96rem]', '[&_th]:whitespace-normal', '[&_th]:px-1.5'], '[&_td]:px-1.5', true], 'the floor first; the three it had, where they stood; every other a variant');
  for (const one of classes) assert.equal(classes.filter((c) => c === one).length, 1, `${one}: once`);
  assert.equal(new Set(classes).size, 44);
  // Typed whole where tailwind reads whole class strings: no template, nothing joined.
  assert.doesNotMatch(rules, /LEDGER_TABLE_CLASS = (?!')/, 'a plain string literal');
  assert.doesNotMatch(CLASS_LINE, /\$\{|`| \+ |\.join\(/);
  assert.ok(code(TAILWIND).includes('"./src/lib/**/*.{js,ts,jsx,tsx,mdx}"'), 'tailwind scans src/lib — a class typed in the rule file is compiled');
});

// ── T5 · WHAT THE CLASS COMPILES TO (ruling C) ───────────────────────────────

test('T5 compiled with the repo’s own Tailwind config, each variant is a class AND an element — so it outranks the shared table’s own single-class px-2 and whitespace-nowrap; the floor is the width the table had', async () => {
  // The shared table's own classes, read from its source — it is not edited (T7), so these are what the variants must beat.
  const table = code(TABLE);
  const classOf = (name: string): string => {
    const m = new RegExp(`export const ${name} = '([^']+)';`).exec(table);
    if (m === null) return assert.fail(`${name} is a whole literal in ${TABLE}`);
    return m[1];
  };
  const [head, cell, money] = [classOf('headClass'), classOf('cellClass'), classOf('moneyClass')];
  assert.deepEqual([head, cell, money], ['px-2 py-1.5 font-normal text-left whitespace-nowrap', 'px-2 py-1.5 align-top', 'px-2 py-1.5 align-top text-right tabular-nums whitespace-nowrap']);
  assert.match(table, /<table className=\{`w-full \$\{tableClassName\} border-collapse text-xs`\}/, 'the caller’s class goes on the table itself, beside w-full');
  // Compile exactly these class strings with the repo's config — its theme and plugins, its content replaced by the strings.
  const raw = [LEDGER_TABLE_CLASS, head, cell, money].join(' ');
  const built = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw, extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  const compiled = [...built.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2].replace(/\s+/g, ' ').trim() }));
  const bodyOf = (selector: string): string => {
    const found = compiled.filter((rule) => rule.selector === selector);
    assert.equal(found.length, 1, `one rule for ${selector}`);
    return found[0].body;
  };
  // The three variants: a class and an element each.
  assert.equal(bodyOf('.\\[\\&_th\\]\\:whitespace-normal th'), 'white-space: normal');
  assert.equal(bodyOf('.\\[\\&_th\\]\\:px-1\\.5 th'), 'padding-left: 0.375rem; padding-right: 0.375rem');
  assert.equal(bodyOf('.\\[\\&_td\\]\\:px-1\\.5 td'), 'padding-left: 0.375rem; padding-right: 0.375rem');
  // What they stand against: one class each, no element.
  assert.equal(bodyOf('.whitespace-nowrap'), 'white-space: nowrap');
  assert.equal(bodyOf('.px-2'), 'padding-left: 0.5rem; padding-right: 0.5rem');
  // A selector of a class and an element outranks a selector of a class alone, wherever each stands in the sheet.
  const weight = (selector: string): [number, number] => [countOf(selector, /\.(?:\\.|[^\s.\\])+/g), countOf(selector, /(?:^|\s)[a-z]+(?=$|\s)/g)];
  for (const variant of ['.\\[\\&_th\\]\\:whitespace-normal th', '.\\[\\&_th\\]\\:px-1\\.5 th', '.\\[\\&_td\\]\\:px-1\\.5 td']) assert.deepEqual(weight(variant), [1, 1], variant);
  for (const own of ['.whitespace-nowrap', '.px-2']) assert.deepEqual(weight(own), [1, 0], own);
  // Only the head cells may wrap: one variant sets white-space: normal, and it is the head's; a body cell of the sheet is one line. COALEVELS-01 (2026-11-27): the grid — `td[data-ledger-cell]` is nowrap; 'no variant sets a body cell's white-space' until then.
  assert.deepEqual(compiled.filter((rule) => rule.body === 'white-space: normal').map((rule) => rule.selector), ['.\\[\\&_th\\]\\:whitespace-normal th']); assert.equal(bodyOf('.\\[\\&_td\\[data-ledger-cell\\]\\]\\:whitespace-nowrap td[data-ledger-cell]'), 'white-space: nowrap'); assert.deepEqual([bodyOf('.\\[\\&_thead_th\\]\\:sticky thead th'), bodyOf('.\\[\\&_thead_th\\]\\:top-0 thead th'), bodyOf('.\\[\\&_tfoot_td\\]\\:sticky tfoot td'), bodyOf('.\\[\\&_tfoot_td\\]\\:bottom-0 tfoot td')], ['position: sticky', 'top: 0px', 'position: sticky', 'bottom: 0px'], 'the head stays at the top of the table’s box and the TOTAL at its bottom');
  // The floor is the width the table always had.
  assert.equal(bodyOf('.min-w-\\[96rem\\]'), 'min-width: 96rem');
  // Every class of the constant compiled to a rule — none is a silent no-op.
  assert.equal(compiled.filter((rule) => rule.selector === '.min-w-\\[96rem\\]' || rule.selector.startsWith('.\\[\\&_')).length, LEDGER_TABLE_CLASS.split(' ').length); assert.equal(LEDGER_TABLE_CLASS.split(' ').length, 44); // COALEVELS-01 (2026-11-27): forty-four classes, forty-four rules — four until then
});

// ── T6 · THE SECTION (ruling C) ──────────────────────────────────────────────

test('T6 the section hands the shared table that class on the line that held its width, and imports the name on a line that was there — 488 lines still; the mount’s props are the same; no other file takes the class', () => {
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 586, 'the registry cites two of its lines'); // SHEET-01 (2026-11-28): 432 — the notes, the summary and the fold are gone, the TOTAL row sums the minutes; 488 until then; SHEET-01 (2026-11-28) (PART 3): 435 — the `adding` state and its note, the `first` prop; 432 until then; EDIT-01 (2026-11-28): 568 — a cell opens as its box (the read of `editing`, the frame's call, the open cell's line; the frame below the section); 435 until then; EDIT-01 (2026-11-28) (PART 3): 586 — the frame, below the section, reads the vendors once a VENDOR cell opens and hands the box what it lists; no cited line moved; 568 until then
  assert.equal(countOf(s, /\bLEDGER_TABLE_CLASS\b/g), 2, 'the import and the mount');
  assert.match(s, /\n {2}CELL_WORDS, LEDGER_COLUMNS, LEDGER_LOADING_WORDS, LEDGER_TABLE, LEDGER_TABLE_CLASS, LEDGER_TITLE_WORDS, LINK_WORDS, NEXT_WORDS, NO_COLUMN_FILTERS,\n/, 'on the import’s first line of names, in its place'); // SHEET-01 (2026-11-28): the names only the notes and the summary read left the import; LEDGER_COLUMNS joined it
  assert.doesNotMatch(s, /min-w-\[96rem\]|tableClassName="/, 'the sheet’s table class is typed in the rule file alone');
  // The summary's own table, in the same file, is not the sheet's: it keeps the class it had.
  assert.equal(countOf(s, /<table className="w-full min-w-\[48rem\] border-collapse text-xs" data-ledger-summary-table>/g), 0, 'the summary’s own table is gone'); // SHEET-01 (2026-11-28): re-pointed to its absence — the notes and the summary under the table are gone
  assert.equal(countOf(s, /min-w-\[/g), 0, 'no width typed here — the summary’s went with it'); // SHEET-01 (2026-11-28): re-pointed to its absence — the notes and the summary under the table are gone
  // The mount, prop for prop — the one line differs.
  assert.match(s, /<DataTable\n\s*name="ledger"\n\s*columns=\{LEDGER_TABLE\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{answer !== null && answer\.read\.ok\}\n\s*tableClassName=\{LEDGER_TABLE_CLASS\}\n\s*filters=\{filters\}\n\s*onFilters=\{setFilters\}\n\s*noFilters=\{NO_COLUMN_FILTERS\}\n\s*sort=\{sort\}\n\s*onSort=\{setSort\}\n\s*openFilter=\{openFilter\}\n\s*onOpenFilter=\{setOpenFilter\}\n\s*csv=\{csv\}\n\s*first=\{adding \? <ExpenseRow [^\n]*\n\s*controls=\{\(/); // SHEET-01 (2026-11-28): and the one new prop, `first`
  assert.equal(countOf(s, /<DataTable\n/g), 1);
  // No cell's own class changed for this: a body cell and a head cell still take the shared table's.
  assert.match(s, /import DataTable, \{[^}]*\} from '@\/components\/table\/DataTable';/);
  // The class is the sheet's alone: two source files name it — where it is typed and where it is handed over.
  const naming = walk('src', /\.tsx?$/).filter((file) => /\bLEDGER_TABLE_CLASS\b/.test(code(file))).sort();
  assert.deepEqual(naming, [SECTION, RULES].sort());
});

// ── T7 · WHAT IS NOT EDITED (ruling D) ───────────────────────────────────────

test('T7 the files this change may not edit: toolRegistry.ts keeps its 761 lines and assert-tool-registry.ts its 11,254, and neither names this change; DataTable.tsx is byte for byte what it was', () => {
  assert.equal(linesOf(REGISTRY).length, 761);
  assert.equal(linesOf(LAW).length, 11254);
  for (const file of [REGISTRY, LAW, TABLE]) assert.doesNotMatch(whole(file), /TIMEWIDE|LEDGER_TABLE_CLASS|\bwide\?: boolean/, `${file}: not touched by this change`);
  // The shared table, every character, as it stood on main when this branch was cut (43f750f).
  const table = whole(TABLE);
  assert.deepEqual([Buffer.byteLength(table, 'utf8'), sha256(table)], [11187, '53c549ac1efbd01cb2e4049d260789995472125e60972f7af4d53f42b15e67de'], 'DataTable.tsx as SHEET-01 left it — its one new optional prop, first'); // SHEET-01 (2026-11-28): the shared table gains ONE optional prop (ruling 3.1) — [10887, '58f41148…'] until then
});

// ── T8 · THE REGISTRY'S CITED LINES (ruling D) ───────────────────────────────

test('T8 the registry’s Time row cites the same thirteen lines as on main, and each still holds what it cites — nothing the row points at moved — SHEET-01 (2026-11-28): ten now — the journal’s read, the summary’s words and the notes’ coverage left with the tables and the summary; the hours are the TOTAL row’s two sums', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.home, time.why], ['LIVE', '/time', undefined]);
  // Every file:line the citation names, in its order — the numbers are main's (43f750f), typed here because this change may move none.
  const cited = [...time.citation.matchAll(/([A-Za-z0-9_/.[\]-]+\.tsx?):(\d+)/g)].map((m) => `${m[1]}:${m[2]}`);
  const HOLDS: readonly (readonly [string, string, RegExp])[] = [
    ['src/components/workbench/operations/ledger/ledgerReads.ts:28', `${OPS}/ledger/ledgerReads.ts`, /readJson\(`\/api\/operations\/ledger\?/],
    ['src/app/api/operations/journal/route.ts:61', 'src/app/api/operations/journal/route.ts', /^export async function PUT\(request: NextRequest\) \{/],
    ['stops/stopWrites.ts:39', `${OPS}/stops/stopWrites.ts`, /const res = await fetch\('\/api\/operations\/stops', \{/],
    ['ledger/RecordForm.tsx:126', `${OPS}/ledger/RecordForm.tsx`, /void write\(\(\) => setStopRecord\(body\)\);/],
    ['ledger/ExpenseForm.tsx:78', `${OPS}/ledger/ExpenseForm.tsx`, /^export default function ExpenseRow\(/], // SHEET-01 (2026-11-28) (PART 3): "+ expense" is its blank row — :87 until then
    ['src/lib/operations/ledger.ts:1620', RULES, /^export const LEDGER_HEAD_WORDS = \[/], // PASTE-03 (2026-11-28): the rule file grew above this line again (a stop may have no budget — the open occurrences, the one read of a line's cents) and the registry re-pointed its cite — :1518 until then. COALEVELS-01 (2026-11-27): the rule file grew above this line again (a row's Location and its account's levels, the twenty-five columns, the ten groups) and the registry re-pointed its cite — :1426 until then. TIMESHEET-04b (2026-11-27): the rule file grew above this line (the sheet's two columns, a plan row's planned items, the record form's NOTES) and the registry re-pointed its cite — :1342 until then; EDIT-01 (2026-11-28): the rule file grew above it again (each row's plan in the answer) and the cite followed — :1561 until then
    ['src/lib/operations/ledgerAnswer.ts:43', 'src/lib/operations/ledgerAnswer.ts', /duration_minutes: true/],
    ['src/lib/operations/ledgerAnswer.ts:42', 'src/lib/operations/ledgerAnswer.ts', /start_time: true, end_time: true/],
    ['src/components/workbench/operations/ledger/LedgerSection.tsx:379', SECTION, /data-ledger-cell="planned-minutes"/], // SHEET-01 (2026-11-28) (PART 3): three lines more above it — :368 until then; EDIT-01 (2026-11-28): the section grew above it — :371 until then
    ['LedgerSection.tsx:430', SECTION, /data-ledger-total-planned-minutes/], // SHEET-01 (2026-11-28): the TOTAL row's two sums — the summary's PLANNED HOURS · LOGGED HOURS at :475 until then; SHEET-01 (2026-11-28) (PART 3): three lines more above it — :407 in PART 2; EDIT-01 (2026-11-28): the section grew above it, and the open cell's line stands above the TOTAL row — :410 until then
  ];
  assert.deepEqual(cited, HOLDS.map(([citation]) => citation), 'the same lines, in the same order'); // SHEET-01 (2026-11-28): ten — the journal's read, the summary's words and the coverage line cited no longer
  for (const gone of ['journal/journalReads.ts', 'SUMMARY_HEAD_WORDS', 'data-ledger-said', 'their coverage said at']) assert.equal(time.citation.includes(gone), false, `${gone} — cited no longer`);
  for (const [citation, file, holds] of HOLDS) {
    const n = Number(citation.slice(citation.lastIndexOf(':') + 1));
    assert.match(linesOf(file)[n - 1] ?? '', holds, `${citation} holds what it cites`);
  }
  // The row's own table is written where it was.
  assert.match(time.ownTableRoute ?? '', /^src\/app\/api\/operations\/stops\/route\.ts:177 \(operations_stop_records\.create/);
  assert.match(linesOf('src/app/api/operations/stops/route.ts')[176] ?? '', /operations_stop_records\.create\(/);
  // Nothing cites a line of the rule file below its last cited one, so a constant added at its end moves no citation.
  const ruleLines = cited.filter((c) => c.startsWith(`${RULES}:`)).map((c) => Number(c.slice(c.lastIndexOf(':') + 1)));
  assert.deepEqual(ruleLines, [1620]); // PASTE-03 (2026-11-28): [1518, 1535] until then. COALEVELS-01 (2026-11-27): [1426, 1443] until then. TIMESHEET-04b (2026-11-27): [1342, 1359] until then; SHEET-01 (2026-11-28): the summary's words left the citation — [1561, 1578] until then; EDIT-01 (2026-11-28): [1561] until then
  assert.ok(linesOf(RULES).length > Math.max(...ruleLines));
  assert.equal(linesOf(RULES).findIndex((line) => line.startsWith('export const LEDGER_TABLE_CLASS')) + 1, linesOf(RULES).length, 'the constant is the last line — below every cited one');
});

// ── T9 · THE SHEET'S WORDS ───────────────────────────────────────────────────

test('T9 the sheet’s columns — twenty-five head words in their order, his sheet’s words (COALEVELS-01, 2026-11-27; twenty-three until then); the long heads the class lets wrap are each of several words; the class changes no word — it cuts four long cells, each said whole in its title', () => {
  assert.deepEqual([...LEDGER_HEAD_WORDS], ['DAY', 'DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'NOTES']); // TIMESHEET-04b (2026-11-27): twenty-three — INSTAGRAM TAG after VENDOR, NOTES after DESCRIPTION, nothing else moved; twenty-one until then · COALEVELS-01 (2026-11-27): twenty-five, in his sheet's words and order — REGION after CITY, LOCATION after COUNTRY; CATEGORY · ENTITY · TYPE · ITEMS where ACCOUNT NAME · BOOK · SUB ACCOUNT NAME · DESCRIPTION stood; COA (was ACCOUNT) before BUDGET; NOTES last — twenty-three until then
  assert.equal(LEDGER_HEAD_WORDS.length, 25); // COALEVELS-01 (2026-11-27): 23 until then. TIMESHEET-04b (2026-11-27): 21 until then
  // A head can go onto a second line only at a space: the four long ones each have one. COALEVELS-01 (2026-11-27): INSTAGRAM TAG, PLANNED MIN, LOGGED MIN and UNDER / OVER — SUB ACCOUNT NAME, the fifth until then, is TYPE now, one word.
  const several = LEDGER_HEAD_WORDS.filter((head) => head.includes(' '));
  for (const long of ['INSTAGRAM TAG', 'PLANNED MIN', 'LOGGED MIN', 'UNDER / OVER']) assert.ok(several.includes(long as (typeof several)[number]), `${long}: of several words`);
  // The class is classes only — no content, no order, no visibility. COALEVELS-01 (2026-11-27): the grid cuts four long cells to their column (truncate) — the TYPE, the ITEMS, the VENDOR and the NOTES, each said whole in its title (the section) — and nothing else; 'a width and three variants of two utilities', with no truncate, until then.
  assert.doesNotMatch(LEDGER_TABLE_CLASS, /content-|(?<!b)order-|hidden|invisible|sr-only|line-clamp|uppercase|lowercase|capitalize/); assert.deepEqual(LEDGER_TABLE_CLASS.split(' ').filter((c) => c.endsWith(':truncate')), ['sub-account-name', 'description', 'vendor', 'notes'].map((cell) => `[&_td[data-ledger-cell=${cell}]]:truncate`));
  // And the rule file's functions are not this change's: the constant is a string, read by the section and by nothing in the rule.
  assert.equal(typeof LEDGER_TABLE_CLASS, 'string');
});
