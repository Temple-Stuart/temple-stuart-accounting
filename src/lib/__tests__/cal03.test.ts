/**
 * CAL-03 (Alex, 2026-10-27) — THE LEGEND BY ACCOUNT.
 *
 * A. A routine tile's colour is its account's: a deterministic hash of (book, code) into eight literal quartets from the token
 *    palette, each text/background pair measured at ≥ 4.5:1. B. Two accounts on one quartet are a collision — both keep it, each
 *    chip declares it. C. 'several' → the neutral; 'none', 'missing', not read → the grey, each with its words. D. The legend is
 *    the fetched range: the accounts by book then code, the neutrals present, then the sources as before (sources.ts untouched).
 *    E. One module, pure; the grid reads it for routine tiles and the legend; the panel, the day card, the tables untouched.
 * The module is driven over fixtures; the grid, the law and the untouched files are pinned to their source (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, comments } from '../sourceText';
import {
  ACCOUNT_QUARTETS, GREY_QUARTET, QUARTET_COUNT, SEVERAL_QUARTET, accountHash, isRoutineTile, legendOf, quartetIndexOf, quartetOf, sharesColourWords, tileQuartetOf,
  type Quartet,
} from '../calendar/accountPalette';
import { ROUTINES_SOURCE, mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { ACCOUNT_NOT_READ_WORDS, NO_ACCOUNT_WORDS, SEVERAL_ACCOUNTS_WORDS, type TileAccount } from '../hub/tileAccount';
import { CALENDAR_SOURCES } from '../calendar/sources';

const PALETTE = 'src/lib/calendar/accountPalette.ts';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const SOURCES = 'src/lib/calendar/sources.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const HUB = 'src/components/hub/HubCalendar.tsx';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const DAY_VIEW = 'src/components/hub/DayView.tsx';
const DAY_CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const WORK = 'src/lib/operations/work.ts';
const LEDGER = 'src/lib/operations/ledger.ts';

const acc = (book: string, code: string, name: string | null = 'An account'): TileAccount => ({ book, code, name });
const FOOD = acc('P', '6150', 'Food & drink');
const FITNESS = acc('P', '6200', 'Fitness');
const OFFICE = acc('B', '6080', 'Office Expense');
const routineTile = (account: TileAccount | null, accountState?: 'account' | 'several' | 'none' | 'missing') => ({ source: ROUTINES_SOURCE, account, ...(accountState === undefined ? {} : { accountState }) });

/** The token values (globals.css) the quartets' classes resolve to — the contrast is measured here, never assumed. */
const HEX: Record<string, string> = {
  'bg-brand-purple': '#3b2d6b', 'bg-brand-red': '#c53030', 'bg-brand-green': '#16a34a', 'bg-brand-gold': '#B8860B', 'bg-brand-amber': '#d97706',
  'bg-ts-aqua': '#14e0c8', 'bg-ts-cyan': '#22d3ee', 'bg-ts-indigo': '#818cf8', 'bg-brand-purple-wash': '#eae7f2', 'bg-bg-row': '#F3EFE6',
  'text-white': '#ffffff', 'text-text-primary': '#1a1a2e', 'text-brand-purple-deep': '#2d1b4e', 'text-text-secondary': '#4a4a5a',
};
const luminance = (hex: string): number => {
  const c = hex.replace('#', '');
  const lin = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(parseInt(c.slice(0, 2), 16)) + 0.7152 * lin(parseInt(c.slice(2, 4), 16)) + 0.0722 * lin(parseInt(c.slice(4, 6), 16));
};
const contrast = (a: string, b: string): number => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const TOKEN_CLASS = /^(bg|border|text)-(brand-(purple|purple-deep|purple-hover|purple-wash|red|green|gold|amber|accent-dark)|ts-(aqua|aqua-deep|cyan|indigo)|text-(primary|secondary|faint)|bg-row|border)$|^text-white$/;

// ── RULING A · THE HASH AND THE EIGHT ────────────────────────────────────────

test('A eight literal quartets from the token palette, each text on its background ≥ 4.5:1 (measured); the same (book, code) is the same quartet on every call; the hash is FNV-1a over "<book>-<code>", mod eight; nothing stored, nothing random', () => {
  assert.equal(ACCOUNT_QUARTETS.length, 8);
  assert.equal(QUARTET_COUNT, 8);
  const measured: string[] = [];
  for (const q of [...ACCOUNT_QUARTETS, SEVERAL_QUARTET, GREY_QUARTET]) {
    for (const cls of Object.values(q)) {
      assert.equal(cls.includes('${'), false, `${cls} is literal`);
      assert.match(cls, TOKEN_CLASS, `${cls} is a token class`);
    }
    const ratio = contrast(HEX[q.bg], HEX[q.text]);
    measured.push(`${q.text} on ${q.bg} ${ratio.toFixed(2)}`);
    assert.ok(ratio >= 4.5, `${q.text} on ${q.bg} reads at ${ratio.toFixed(2)}:1 — the floor is 4.5`);
  }
  assert.deepEqual(measured, [
    'text-white on bg-brand-purple 11.84', 'text-white on bg-brand-red 5.47', 'text-text-primary on bg-brand-green 5.18', 'text-text-primary on bg-brand-gold 5.24',
    'text-text-primary on bg-brand-amber 5.35', 'text-text-primary on bg-ts-aqua 10.17', 'text-text-primary on bg-ts-cyan 9.44', 'text-text-primary on bg-ts-indigo 5.72',
    'text-brand-purple-deep on bg-brand-purple-wash 12.49', 'text-text-secondary on bg-bg-row 7.57',
  ], 'the numbers the module documents');
  assert.equal(new Set(ACCOUNT_QUARTETS.map((q) => q.bg)).size, 8, 'eight different backgrounds');
  assert.equal(new Set(ACCOUNT_QUARTETS.map((q) => q.swatch)).size, 8, 'eight different swatches');
  // Determinism: the same account, the same quartet — across calls and across equal objects.
  for (let i = 0; i < 5; i++) assert.equal(quartetOf(FOOD), quartetOf(acc('P', '6150', null)), 'the name is not in the hash');
  const fold = (h: number): number => ((h ^ (h >>> 16)) >>> 0) % 8;
  assert.equal(quartetIndexOf(FOOD), fold(accountHash('P', '6150')), 'the two halves folded, then modulo eight');
  assert.deepEqual([FOOD, FITNESS, OFFICE].map(quartetIndexOf), [1, 3, 0], 'the three check accounts on three quartets — the raw modulo put all three on one (6)');
  assert.deepEqual([FOOD, FITNESS, OFFICE].map((a) => accountHash(a.book, a.code) % 8), [6, 6, 6], 'why the fold: the raw modulo reads only the low three bits of every character');
  assert.equal(accountHash('P', '6150'), accountHash('P', '6150'));
  assert.notEqual(accountHash('P', '6150'), accountHash('B', '6150'), 'the book is in the hash — P-6150 and B-6150 are different accounts');
  assert.notEqual(accountHash('P', '6150'), accountHash('P', '6200'));
  // FNV-1a, pinned on one value: "P-6150" → the 32-bit hash the function returns today; a changed hash would re-colour every account.
  const expected = ((): number => { let h = 0x811c9dc5; for (const ch of 'P-6150') { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; })();
  assert.equal(accountHash('P', '6150'), expected);
  assert.ok(quartetIndexOf(FOOD) >= 0 && quartetIndexOf(FOOD) < 8);
  // The eight are reachable: over the four-digit codes of one book every index comes up.
  const seen = new Set<number>();
  for (let n = 1000; n < 9999 && seen.size < 8; n++) seen.add(quartetIndexOf({ book: 'P', code: String(n) }));
  assert.equal(seen.size, 8, 'every quartet is some account’s');
  const m = code(PALETTE);
  assert.match(m, /const h = accountHash\(account\.book, account\.code\);\n\s*return \(\(h \^ \(h >>> 16\)\) >>> 0\) % QUARTET_COUNT;/);
  // Over every four-digit code of three books, no quartet is favoured: each takes between 12.3% and 12.7% of the 27 000.
  const dist = new Array(8).fill(0);
  for (let n = 1000; n < 10000; n++) for (const b of ['P', 'B', 'T']) dist[quartetIndexOf({ book: b, code: String(n) })]++;
  assert.ok(dist.every((d) => d >= 3300 && d <= 3450), `the eight share the codes evenly: ${dist.join(' ')}`);
  assert.doesNotMatch(m, /Math\.random|Date\.now|new Date\(|localStorage|sessionStorage|\bfetch\b|from 'react'|@prisma\/client/, 'pure — no clock, no store, no randomness');
});

// ── RULING B · THE COLLISION ─────────────────────────────────────────────────

test('B two accounts on one quartet both keep it and each chip says "shares a colour with <the other>" — by construction; eight accounts on eight different quartets share nothing', () => {
  // By construction: the first P code that lands on FOOD's quartet.
  const index = quartetIndexOf(FOOD);
  let other: TileAccount | null = null;
  for (let n = 1000; n < 9999; n++) { const c = String(n); if (c !== '6150' && quartetIndexOf({ book: 'P', code: c }) === index) { other = acc('P', c, 'The other one'); break; } }
  assert.ok(other !== null, 'a second code on the same quartet exists');
  assert.equal(quartetOf(other!), quartetOf(FOOD), 'both keep the quartet');
  const chips = legendOf([routineTile(FOOD, 'account'), routineTile(other!, 'account')]);
  const [first, second] = [...chips].sort((a, b) => a.words.localeCompare(b.words));
  assert.deepEqual(chips.map((c) => c.quartet), [ACCOUNT_QUARTETS[index], ACCOUNT_QUARTETS[index]]);
  assert.deepEqual(first.sharesWith, [second.words]);
  assert.deepEqual(second.sharesWith, [first.words]);
  assert.equal(sharesColourWords('P-6200 Fitness'), 'shares a colour with P-6200 Fitness');
  // Eight accounts, one per quartet: no chip shares.
  const eight: TileAccount[] = [];
  const taken = new Set<number>();
  for (let n = 1000; n < 9999 && eight.length < 8; n++) { const i = quartetIndexOf({ book: 'P', code: String(n) }); if (!taken.has(i)) { taken.add(i); eight.push(acc('P', String(n))); } }
  const spread = legendOf(eight.map((a) => routineTile(a, 'account')));
  assert.equal(spread.length, 8);
  assert.equal(new Set(spread.map((c) => c.quartet)).size, 8, 'eight different quartets');
  assert.ok(spread.every((c) => c.sharesWith.length === 0));
  // Three on one quartet: each names the other two, in legend order.
  const three = [FOOD, other!, ((): TileAccount => { for (let n = 9998; n > 1000; n--) { const c = String(n); if (c !== '6150' && c !== other!.code && quartetIndexOf({ book: 'P', code: c }) === index) return acc('P', c, 'A third'); } throw new Error('no third'); })()];
  const trio = legendOf(three.map((a) => routineTile(a, 'account')));
  for (const chip of trio) assert.deepEqual(chip.sharesWith, trio.filter((o) => o !== chip).map((o) => o.words));
});

// ── RULING C · THE NEUTRALS AND THE TILE ─────────────────────────────────────

test('C the tile: an account → its hashed quartet; several → the neutral; none, missing and not read → the grey; a tile of any other source → null (its source draws it); the words are tileAccount’s', () => {
  assert.equal(tileQuartetOf(routineTile(FOOD, 'account')), quartetOf(FOOD));
  assert.equal(tileQuartetOf(routineTile(null, 'several')), SEVERAL_QUARTET);
  assert.equal(tileQuartetOf(routineTile(null, 'none')), GREY_QUARTET);
  assert.equal(tileQuartetOf(routineTile(acc('P', '9999', null), 'missing')), GREY_QUARTET);
  assert.equal(tileQuartetOf(routineTile(null)), GREY_QUARTET, 'not read: the grey');
  assert.equal(tileQuartetOf({ source: 'manual', account: FOOD, accountState: 'account' }), null, 'a hand-entered event is its source’s, whatever it carries');
  for (const s of ['trip', 'reservation', 'project', 'operations', 'trade', 'manual']) assert.equal(tileQuartetOf({ source: s }), null, `${s}: the source rule`);
  assert.throws(() => tileQuartetOf({ source: ROUTINES_SOURCE, account: null, accountState: 'account' }), /a tile in state account carries no account/);
  assert.equal(isRoutineTile({ source: ROUTINES_SOURCE }), true);
  assert.equal(ROUTINES_SOURCE, 'routines');
  assert.notEqual(SEVERAL_QUARTET, GREY_QUARTET);
  assert.ok(!ACCOUNT_QUARTETS.includes(SEVERAL_QUARTET) && !ACCOUNT_QUARTETS.includes(GREY_QUARTET), 'the neutrals sit outside the hashed eight');
  // The mapper's tiles reach the palette as they are: a CAL-02 window entry → a coloured tile.
  const tile = mapOperationsRoutines({ routines: [{ routine_id: 'r', name: 'Brunch', entity_id: 'P', timezone: 'Asia/Makassar', start_time: '1970-01-01T11:00:00.000Z', end_time: '1970-01-01T12:00:00.000Z', occurrences: ['2026-10-27T03:00:00.000Z'], coa_code: '6150', budget_amount: 25, steps: [], account: FOOD, account_state: 'account' }], truncated: false })[0];
  assert.equal(tileQuartetOf(tile), quartetOf(FOOD));
});

// ── RULING D · THE LEGEND ────────────────────────────────────────────────────

test('D the legend is the fetched range: one chip per account by book letter then code, then several, none, each missing account, not read; the chip words are the panel’s; a range with no routine tile → no chips; sources are not read here', () => {
  const events = [
    routineTile(FITNESS, 'account'), routineTile(FOOD, 'account'), routineTile(FOOD, 'account'), routineTile(OFFICE, 'account'),
    routineTile(null, 'none'), routineTile(acc('P', '9999', null), 'missing'), routineTile(null, 'several'), routineTile(null),
    routineTile(acc('B', '9998', null), 'missing'),
    { source: 'trip', account: FOOD, accountState: 'account' as const }, { source: 'manual' },
  ];
  const chips = legendOf(events);
  assert.deepEqual(chips.map((c) => [c.kind, c.words]), [
    ['account', 'B-6080 Office Expense'], ['account', 'P-6150 Food & drink'], ['account', 'P-6200 Fitness'],
    ['several', SEVERAL_ACCOUNTS_WORDS], ['none', NO_ACCOUNT_WORDS], ['missing', 'B-9998 — not in the chart'], ['missing', 'P-9999 — not in the chart'], ['not-read', ACCOUNT_NOT_READ_WORDS],
  ]);
  assert.deepEqual(chips.map((c) => c.key), ['account:B-6080 Office Expense', 'account:P-6150 Food & drink', 'account:P-6200 Fitness', 'several', 'none', 'missing:B-9998', 'missing:P-9999', 'not-read']);
  assert.deepEqual(chips.slice(0, 3).map((c) => c.quartet), [quartetOf(OFFICE), quartetOf(FOOD), quartetOf(FITNESS)]);
  assert.deepEqual(chips.slice(3).map((c) => c.quartet), [SEVERAL_QUARTET, GREY_QUARTET, GREY_QUARTET, GREY_QUARTET, GREY_QUARTET]);
  assert.equal(chips[0].words, 'B-6080 Office Expense', 'B before P — the book letter first');
  assert.deepEqual(legendOf([]), []);
  assert.deepEqual(legendOf([{ source: 'trip' }, { source: 'reservation' }, { source: 'manual' }]), [], 'no routine tile: no account chip — the sources alone');
  assert.throws(() => legendOf([routineTile(null, 'missing')]), /a tile in state missing carries no account/);
  // The same account on many days is one chip.
  assert.equal(legendOf(Array.from({ length: 30 }, () => routineTile(FOOD, 'account'))).length, 1);
});

// ── RULING E · THE GRID READS THE MODULE; EVERYTHING ELSE UNTOUCHED ──────────

test('E the grid colours a routine tile and its dot by the module and lists the accounts in the legend before the sources; every class is a literal in the module; the sources’ line and sources.ts stand; the law checks the quartets; the panel, the day view, the day card, the tables untouched', () => {
  const grid = code(GRID);
  assert.match(grid, /import \{ legendOf, sharesColourWords, tileQuartetOf \} from '@\/lib\/calendar\/accountPalette';/);
  assert.equal((grid.match(/const quartet = tileQuartetOf\((event|block\.event|e)\);/g) ?? []).length, 3, 'the all-day tile, the timed block, the month dot');
  assert.equal((grid.match(/\$\{quartet \? `\$\{quartet\.bg\} \$\{quartet\.text\} border \$\{quartet\.border\}` : `\$\{(config\.badge \|\| config\.dot|badgeColor)\} text-white`\}/g) ?? []).length, 2, 'the two tile shapes: the quartet, else the source’s badge and white text as before');
  assert.match(grid, /\$\{quartet \? quartet\.swatch : config\.dot\}/, 'the month dot');
  assert.match(grid, /const config = sourceConfig\[event\.source\] \|\| \{ badge: 'bg-gray-400', dot: 'bg-gray-400' \};/, 'the source line stands');
  assert.match(grid, /const config = sourceConfig\[block\.event\.source\] \|\| \{ badge: 'bg-gray-400', dot: 'bg-gray-400' \};\n\s*const badgeColor = config\.badge \|\| config\.dot;/);
  // The legend: the account chips, then the sources (the routines source skipped — its tiles wear their accounts).
  assert.match(grid, /const accountChips = legendOf\(events\);/);
  assert.match(grid, /if \(tileQuartetOf\(\{ source \}\) !== null\) return false;/, 'no chip for the routines source');
  assert.match(grid, /return accountChips\.length > 0 \|\| legendItems\.length > 0 \? \(/);
  assert.match(grid, /\{accountChips\.map\(\(chip\) => \(\n\s*<span key=\{chip\.key\} className="flex items-center gap-1\.5" data-legend-chip=\{chip\.kind\} data-legend-words=\{chip\.words\}>\n\s*<span className=\{`w-2\.5 h-2\.5 rounded-sm border \$\{chip\.quartet\.swatch\} \$\{chip\.quartet\.border\}`\} \/>\n\s*<span className="text-xs text-text-secondary">\{chip\.words\}<\/span>/);
  assert.match(grid, /<span key=\{other\} className="text-\[10px\] text-text-muted" data-legend-shares=\{other\}>\{sharesColourWords\(other\)\}<\/span>/, 'the collision, declared on the chip');
  const accountChipsAt = grid.indexOf('{accountChips.map((chip) => (');
  const sourcesAt = grid.indexOf('{legendItems.map(([source, config]) => (');
  assert.ok(accountChipsAt > 0 && sourcesAt > accountChipsAt, 'accounts, then the sources');
  assert.match(grid, /\{legendItems\.map\(\(\[source, config\]\) => \(\n\s*<label key=\{source\} className="flex items-center gap-1\.5 cursor-pointer" onClick=\{\(\) => setVisibleCategories/, 'the sources’ chips as before');
  assert.doesNotMatch(grid, /\.(account|accountState)\b|accountWords|tileAccountOf|accountHash|quartetOf\(/, 'the grid decides no colour for a routine — it hands the event to the module');
  // No class is built in the grid from an account; the quartets' classes live in the module as literals (Tailwind scans src/lib).
  assert.doesNotMatch(grid, /bg-\$\{|text-\$\{|border-\$\{/);
  // sources.ts: byte for byte as CAL-02 pinned it; the sources' tints untouched.
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
  assert.equal(sha(code(SOURCES) + comments(SOURCES)), '288471dab672b2a19a5dd554afc0185388c17f3acec92d24a5a71059255a57b5', 'sources.ts, byte for byte (captured on main 935af394)');
  assert.deepEqual(CALENDAR_SOURCES.map((s) => [s.source, s.tint.badge]), [['manual', 'bg-rose-400'], ['trip', 'bg-cyan-400'], ['reservation', 'bg-amber-400']]);
  // The law: the palette's quartets are literals, and eight.
  const law = code(LAW);
  assert.match(law, /import \{ ACCOUNT_QUARTETS, GREY_QUARTET, QUARTET_COUNT, SEVERAL_QUARTET \} from '\.\.\/src\/lib\/calendar\/accountPalette';/);
  assert.match(law, /if \(ACCOUNT_QUARTETS\.length !== QUARTET_COUNT \|\| QUARTET_COUNT !== 8\) dayFail\(/);
  assert.match(law, /for \(const q of \[\.\.\.ACCOUNT_QUARTETS, SEVERAL_QUARTET, GREY_QUARTET\]\) \{\n\s*for \(const cls of Object\.values\(q\)\) if \(cls\.includes\('\$\{'\)\) dayFail\(/);
  // Untouched: the panel, the day view, the day card, the tables.
  for (const f of [HUB, PANEL, DAY_VIEW, DAY_CARD, WORK, LEDGER]) assert.doesNotMatch(code(f) + comments(f), /CAL-03|accountPalette|quartetOf|legendOf/, `${f} is untouched`);
  assert.doesNotMatch(code(PALETTE), /prisma|ALTER TABLE|migrations|NextResponse/, 'no schema, no route, no migration');
});
