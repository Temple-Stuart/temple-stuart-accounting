/**
 * TIMESHEET-03 (Alex, 2026-11-24) — THE TIME SHEET'S LOOK: today first, pills, the tint.
 *
 * /time's table opens on today's rows; BOOK and ACCOUNT NAME are coloured pills — one tone per book, one per account the
 * active plans use; the four cells nobody types on a row are tinted, and one line above the table says what the tint means.
 * Nothing is renamed, moved, added or removed: the same rows, the same twenty-one columns, the CSV byte for byte.
 *
 * The rule (src/lib/operations/ledger.ts — accountPlacesOf, toneOfPlace and the class strings) is DRIVEN directly, and the
 * ledger over a fixture built the Budget's own way, on timesheet01.test.ts's model: HERMETIC — no database, no network, and
 * the only clock is the `now` handed in. Every name, place and amount below is made up. The answer function is driven through
 * a fake client; the read through a stubbed fetch; the section, the shared table, the routes and the registry are anchored to
 * their source with comments stripped (the reader law; rejoin() where the whole file is the subject). No pin here names a line
 * number of any file — every pin finds its line by content, and a line the registry cites is read from the citation itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import colors from 'tailwindcss/colors';
import { code, comments, functionBody, rejoin } from '../sourceText';
import { buildRoutineBudgetLines, type RoutineLinePlanInput, type RoutinePlanInput } from '../budget/days';
import type { PlanVendorRow, RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import { TOOL_REGISTRY } from '../toolRegistry';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';
import { readLedger } from '@/components/workbench/operations/ledger/ledgerReads';
import {
  ACCOUNT_TONES, BOOK_TONES, BOOK_WORDS, LEDGER_COLUMNS, LEDGER_HEAD_WORDS, NEUTRAL_TONE, NOT_TYPED_WORDS, PILL_CLASS,
  accountCellWords, accountNameCellWords, accountPillClassOf, accountPlacesOf, bookCellWords, bookPillClassOf, ledgerCsv, ledgerFailedWords, ledgerOf, placeOf, planMinutesOf, toneOfPlace,
  type AccountPlaces, type LedgerInput, type LedgerLinkInput, type LedgerRecordInput, type LedgerRow,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const HOME_ROUTE = 'src/app/api/home-ledger/route.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TABLE = 'src/components/table/DataTable.tsx';
const PILL_HOME = 'src/components/workbench/operations/projects/TaskRowView.tsx';
const TAILWIND = 'tailwind.config.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/timesheet03.test.ts';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** A whole file, comment and code alike — for an equality over every character (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));

// ── THE PLANS (ruling B.4) — routine inputs as the loader's mapper gives them; every name and code made up ──

/** A line of a plan: its code, and whether the loader marks it inactive (absent means active). */
const step = (id: string, coaCode: string | null, isActive?: boolean): RoutineLinePlanInput => ({ id, stepOrder: 1, budgetAmount: null, coaCode, durationMinutes: null, timeOfDay: null, ...(isActive === undefined ? {} : { isActive }) });
type Plan = Pick<RoutinePlanInput, 'entityType' | 'coaCode' | 'steps'>;
const PLANS: readonly Plan[] = [
  // The routine's own code and its lines' codes — one of them twice, one of them null.
  { entityType: 'personal', coaCode: '6200', steps: [step('a', '6150'), step('b', null), step('c', '6150')] },
  // No code of its own; a line on the first plan's account again, and two codes whose order by number and by code unit differ.
  { entityType: 'personal', coaCode: null, steps: [step('d', '6150'), step('e', '900'), step('f', '1000')] },
  // Another book: the same code is another account.
  { entityType: 'sole_prop', coaCode: '6400', steps: [step('g', '6150')] },
  // A line the loader marks inactive is no active line: its code is not an account the plans use.
  { entityType: 'trading', coaCode: '5010', steps: [step('h', '7777', false), step('i', '5010', true)] },
  // An entity type that draws no letter: the label is the code alone — lower case, to tell code-unit order from a locale's.
  { entityType: 'estate', coaCode: 'a50', steps: [] },
];
const PLACES = { 'B-6150': 0, 'B-6400': 1, 'P-1000': 2, 'P-6150': 3, 'P-6200': 4, 'P-900': 5, 'T-5010': 6, a50: 7 };

// ── T1 · THE PLACES (ruling B.4) ─────────────────────────────────────────────

test('T1 the places: each routine’s own code and each of its active lines’ codes, a null code skipped, as the label the ACCOUNT cell prints; the same account on two plans has one place; the order is the label’s, by code unit', () => {
  const places = accountPlacesOf(PLANS);
  assert.deepEqual(places, PLACES);
  assert.deepEqual(Object.keys(places), ['B-6150', 'B-6400', 'P-1000', 'P-6150', 'P-6200', 'P-900', 'T-5010', 'a50'], 'in the order of their places');
  assert.deepEqual(Object.values(places), [0, 1, 2, 3, 4, 5, 6, 7], '0, 1, 2 … — no gap, none shared');
  // A routine's own code and its lines' codes; the null code is skipped — never an account of its own.
  assert.deepEqual(accountPlacesOf([PLANS[0]]), { 'P-6150': 0, 'P-6200': 1 });
  assert.deepEqual(accountPlacesOf([{ entityType: 'personal', coaCode: null, steps: [step('x', null)] }]), {}, 'no code at all: no account');
  assert.deepEqual(accountPlacesOf([]), {}, 'no plan: no place');
  // The same account on two plans (and twice on one) has ONE place; the same code in another book is another account.
  assert.equal(Object.keys(places).filter((label) => label === 'P-6150').length, 1);
  assert.notEqual(places['B-6150'], places['P-6150']);
  // An active line: absent means active, true is active, false is honoured.
  assert.equal(placeOf(places, 'T-7777'), null, 'an inactive line’s code is not an account the plans use');
  assert.equal(placeOf(places, 'T-5010'), 6);
  assert.deepEqual(accountPlacesOf([{ entityType: 'trading', coaCode: null, steps: [step('h', '7777', false)] }]), {});
  // The label is the ACCOUNT cell's own: the book's letter and the code — the same string a row carries in coa.account.
  assert.equal(accountCellWords({ coa: { account: 'P-6150', name: 'Dining Out' } }), 'P-6150');
  assert.deepEqual(Object.keys(accountPlacesOf([{ entityType: 'sole_prop', coaCode: '6400', steps: [] }, { entityType: 'trading', coaCode: '6400', steps: [] }, { entityType: 'personal', coaCode: '6400', steps: [] }])), ['B-6400', 'P-6400', 'T-6400']);
  // BY CODE UNIT, no locale: "P-1000" stands before "P-900", and the lower-case label after every upper-case one — a locale's order would put neither there.
  const labels = Object.keys(places);
  assert.deepEqual([...labels].sort(), labels, 'the default sort’s order — code units');
  assert.notDeepEqual([...labels].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), labels, 'not a locale’s');
  assert.ok(places['P-1000'] < places['P-900'] && places['T-5010'] < places.a50);
  // The order the routines are handed in changes nothing (the loader asks for no order).
  assert.deepEqual(accountPlacesOf([...PLANS].reverse()), PLACES);
  assert.deepEqual(accountPlacesOf([PLANS[3], PLANS[0], PLANS[4], PLANS[2], PLANS[1]]), PLACES);
  // Wire-shaped: an object of whole numbers — it round-trips JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(places)), places);
});

test('T1 the places function reads nothing but its argument: the same routines give the same places, whatever the period, the rows or the clock; it changes nothing it is handed', () => {
  const frozen = PLANS.map((p) => Object.freeze({ ...p, steps: Object.freeze(p.steps.map((s) => Object.freeze({ ...s }))) }));
  assert.deepEqual(accountPlacesOf(frozen), PLACES, 'nothing it is handed is written to');
  assert.deepEqual(accountPlacesOf(frozen), accountPlacesOf(frozen));
  // One parameter, and a body that names nothing but it, the label rule and the comparison.
  assert.equal(accountPlacesOf.length, 1);
  const rules = code(RULES);
  const body = functionBody(rules, 'accountPlacesOf');
  if (body === null) return assert.fail('ledger.ts exports accountPlacesOf');
  assert.match(body, /^export function accountPlacesOf\(routines: readonly Pick<RoutinePlanInput, 'entityType' \| 'coaCode' \| 'steps'>\[\]\): AccountPlaces \{/);
  assert.doesNotMatch(body, /\binput\b|\bnow\b|new Date|Date\.|\bfrom\b|\bto\b|\brows\b|\bsheet\b|process\.|fetch|Math\.random|localeCompare|Intl\./, 'no period, no row, no clock, no locale');
  assert.match(body, /if \(routine\.coaCode !== null\) labels\.add\(deriveAccountString\(\{ entityType: routine\.entityType, code: routine\.coaCode \}\)\);/, 'the routine’s own code — the ACCOUNT cell’s label rule');
  assert.match(body, /if \(step\.isActive === false \|\| step\.coaCode === null\) continue;\n\s*labels\.add\(deriveAccountString\(\{ entityType: routine\.entityType, code: step\.coaCode \}\)\);/, 'each active line’s code, a null code skipped');
  assert.match(body, /\[\.\.\.labels\]\.sort\(cmp\)\.forEach\(\(label, place\) => \{ places\[label\] = place; \}\);/, 'distinct, in the label’s order, each its place');
  assert.match(rules, /const cmp = \(a: string, b: string\): number => \(a < b \? -1 : a > b \? 1 : 0\);/, 'plain code-unit comparison');
  // The ACCOUNT cell's own label, where the rule builds a row's.
  assert.equal((rules.match(/deriveAccountString\(\{ entityType: book\.entityType, code: l(ine)?\.code \}\)/g) ?? []).length, 2);
  // And ledgerOf is not handed the places: its input and its output are as they were.
  assert.doesNotMatch(functionBody(rules, 'ledgerOf') ?? '', /tones|accountPlacesOf|toneOfPlace/);
});

// ── T2 · THE TONE OF A PLACE; THE BOOKS' TONES (rulings B.2, B.4) ────────────

const WHEEL = [
  'bg-blue-200 text-blue-950', 'bg-orange-200 text-orange-950', 'bg-green-200 text-green-950', 'bg-pink-200 text-pink-950', 'bg-teal-200 text-teal-950', 'bg-amber-300 text-amber-950', 'bg-purple-200 text-purple-950',
  'bg-cyan-200 text-cyan-950', 'bg-rose-200 text-rose-950', 'bg-lime-200 text-lime-950', 'bg-indigo-200 text-indigo-950', 'bg-yellow-200 text-yellow-950', 'bg-sky-200 text-sky-950',
];

test('T2 the tone of a place: the wheel’s thirteen, in order; a fourteenth account is back on the first; an account with no place takes the neutral tone; the three books’ tones by BOOK_WORDS’ words', () => {
  assert.deepEqual([...ACCOUNT_TONES], WHEEL, 'the thirteen, in this order');
  assert.equal(ACCOUNT_TONES.length, 13);
  assert.deepEqual(WHEEL.map((_, place) => toneOfPlace(place)), WHEEL, 'place 0 … 12: the wheel’s at that place');
  assert.equal(toneOfPlace(13), 'bg-blue-200 text-blue-950', 'the wheel repeats after its last');
  assert.deepEqual([toneOfPlace(14), toneOfPlace(25), toneOfPlace(26), toneOfPlace(130)], ['bg-orange-200 text-orange-950', 'bg-sky-200 text-sky-950', 'bg-blue-200 text-blue-950', 'bg-blue-200 text-blue-950']);
  assert.equal(NEUTRAL_TONE, 'bg-gray-200 text-gray-800');
  assert.equal(toneOfPlace(null), NEUTRAL_TONE, 'no place: the neutral tone');
  // A place that is no whole number 0 or above is the read's error, by name — never drawn in some tone.
  for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => toneOfPlace(bad), /ledger: .* is no place — an account's place is a whole number, 0 or above/, String(bad));
  // Fourteen accounts on the plans: thirteen tones, all different, and the fourteenth back on the first.
  const fourteen: Plan[] = Array.from({ length: 14 }, (_, i) => ({ entityType: 'personal', coaCode: String(6001 + i), steps: [] }));
  const places = accountPlacesOf(fourteen);
  assert.deepEqual(Object.values(places), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const tones = Object.keys(places).map((label) => toneOfPlace(placeOf(places, label)));
  assert.equal(new Set(tones.slice(0, 13)).size, 13, 'no two accounts share a tone until the plans use more than thirteen');
  assert.deepEqual([tones[13], places['P-6014']], [tones[0], 13]);
  // An account no active plan uses: no place, the neutral tone.
  assert.equal(placeOf(places, 'P-9999'), null);
  assert.equal(placeOf(places, 'toString'), null, 'only a label the places hold — never a name every object answers to');
  assert.equal(toneOfPlace(placeOf(places, 'P-9999')), NEUTRAL_TONE);
  // The three books' tones, by BOOK_WORDS' three words.
  assert.deepEqual(Object.keys(BOOK_TONES), Object.values(BOOK_WORDS), 'one for each word, and no other');
  assert.deepEqual(BOOK_TONES, { Personal: 'bg-gray-300 text-gray-900', Business: 'bg-violet-200 text-violet-950', Trading: 'bg-emerald-200 text-emerald-950' });
  assert.deepEqual([BOOK_TONES[BOOK_WORDS.personal], BOOK_TONES[BOOK_WORDS.sole_prop], BOOK_TONES[BOOK_WORDS.trading]], ['bg-gray-300 text-gray-900', 'bg-violet-200 text-violet-950', 'bg-emerald-200 text-emerald-950']);
});

test('T2 the two pills’ classes: the app’s pill and the rule’s tone — a book by its word, an account by its place; a row with no book and a cell with no name give none', () => {
  assert.equal(PILL_CLASS, 'inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap');
  assert.match(code(PILL_HOME), /const pillClass = `inline-block px-2 py-0\.5 rounded-full text-xs font-medium \$\{TASK_STATUS_PILL_CLASSES\[task\.status\]\}`;/, 'the app’s pill, where it stands — its shape is this one’s');
  // BOOK.
  assert.equal(bookPillClassOf({ book: 'Personal' }), `${PILL_CLASS} bg-gray-300 text-gray-900`);
  assert.equal(bookPillClassOf({ book: 'Business' }), `${PILL_CLASS} bg-violet-200 text-violet-950`);
  assert.equal(bookPillClassOf({ book: 'Trading' }), `${PILL_CLASS} bg-emerald-200 text-emerald-950`);
  assert.equal(bookPillClassOf({ book: null }), null, 'no book: the blank as before, no pill');
  // ACCOUNT NAME: by the account's place among the places handed in.
  const places: AccountPlaces = accountPlacesOf(PLANS);
  assert.equal(accountPillClassOf({ coa: { account: 'B-6150', name: 'Meals with clients' } }, places), `${PILL_CLASS} bg-blue-200 text-blue-950`, 'place 0');
  assert.equal(accountPillClassOf({ coa: { account: 'P-6150', name: 'Dining Out' } }, places), `${PILL_CLASS} bg-pink-200 text-pink-950`, 'place 3');
  assert.equal(accountPillClassOf({ coa: { account: 'a50', name: 'Upkeep' } }, places), `${PILL_CLASS} bg-cyan-200 text-cyan-950`, 'place 7');
  assert.equal(accountPillClassOf({ coa: { account: 'P-9999', name: 'Sundries' } }, places), `${PILL_CLASS} ${NEUTRAL_TONE}`, 'an account no active plan uses');
  assert.equal(accountPillClassOf({ coa: null }, places), null, 'no account: the blank, no pill');
  assert.equal(accountPillClassOf({ coa: { account: 'P-6150', name: null } }, places), null, 'no name: the blank, no pill — though the account has a place');
  // The words in the pills do not change.
  assert.equal(bookCellWords({ book: 'Business' }), 'Business');
  assert.equal(accountNameCellWords({ coa: { account: 'P-6150', name: 'Dining Out' } }), 'Dining Out');
  assert.deepEqual([bookCellWords({ book: null }), accountNameCellWords({ coa: null }), accountNameCellWords({ coa: { account: 'P-6150', name: null } })], ['—', '—', '—']);
});

// ── T3 · EVERY CLASS TYPED WHOLE (ruling B.6) ────────────────────────────────

test('T3 in ledger.ts’s source the pill, the thirteen, the neutral and the three books’ tones are whole string literals — the thirteen all different, every one a class the palette holds, and tailwind scans the file', () => {
  const rules = code(RULES);
  assert.ok(rules.includes("export const PILL_CLASS = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';"), 'the pill, whole');
  assert.ok(rules.includes("export const NEUTRAL_TONE = 'bg-gray-200 text-gray-800';"), 'the neutral, whole');
  for (const tone of WHEEL) assert.ok(rules.includes(`  '${tone}',\n`), `${tone}: a whole literal on its own line`);
  for (const [word, tone] of [['Personal', 'bg-gray-300 text-gray-900'], ['Business', 'bg-violet-200 text-violet-950'], ['Trading', 'bg-emerald-200 text-emerald-950']]) assert.ok(rules.includes(`  ${word}: '${tone}',\n`), `${word}: a whole literal`);
  // The wheel, as written: thirteen literals between its brackets, in the ruling's order, and nothing built.
  const wheel = rules.slice(rules.indexOf('export const ACCOUNT_TONES = ['), rules.indexOf('] as const;', rules.indexOf('export const ACCOUNT_TONES = [')));
  assert.deepEqual([...wheel.matchAll(/'([^']+)'/g)].map((m) => m[1]), WHEEL);
  assert.equal(new Set(WHEEL).size, 13, 'the thirteen are all different');
  assert.equal(new Set(WHEEL.map((tone) => tone.split(' ')[0])).size, 13, 'thirteen grounds');
  assert.equal(new Set([...WHEEL, NEUTRAL_TONE, ...Object.values(BOOK_TONES)]).size, 17, 'and none is the neutral or a book’s');
  // No class is assembled from parts — in the rule or in the section.
  for (const file of [RULES, SECTION]) assert.doesNotMatch(code(file), /(bg|text|border|ring)-\$\{|\$\{[^}]*\}-(50|100|200|300|400|500|600|700|800|900|950)\b/, `${file}: no class built from parts`);
  // Every one is a class of the palette the app compiles: the same hue for the ground and the words, each shade the palette's own.
  const palette = colors as unknown as Readonly<Record<string, Readonly<Record<string, string>> | undefined>>;
  for (const tone of [...WHEEL, NEUTRAL_TONE, ...Object.values(BOOK_TONES)]) {
    const m = /^bg-([a-z]+)-(\d+) text-([a-z]+)-(\d+)$/.exec(tone);
    if (m === null) return assert.fail(`${tone} is a ground and its words`);
    assert.equal(m[1], m[3], `${tone}: one hue`);
    for (const shade of [m[2], m[4]]) assert.match(palette[m[1]]?.[shade] ?? '', /^#[0-9a-f]{6}$/, `${m[1]}-${shade} is a colour of the palette`);
  }
  assert.match(palette.blue?.['50'] ?? '', /^#[0-9a-f]{6}$/, 'and so is the tint’s (the section’s bg-blue-50)');
  // tailwind.config.ts scans src/lib — and extends the palette, never replaces it or renames one of these hues.
  const tw = code(TAILWIND);
  assert.ok(tw.includes('"./src/lib/**/*.{js,ts,jsx,tsx,mdx}",'), 'src/lib is scanned');
  assert.match(tw, /theme: \{\n\s*extend: \{\n\s*colors: \{/, 'the theme extends the palette');
  for (const hue of ['gray', 'violet', 'emerald', 'blue', 'orange', 'green', 'pink', 'teal', 'amber', 'purple', 'cyan', 'rose', 'lime', 'indigo', 'yellow', 'sky']) assert.doesNotMatch(tw, new RegExp(`^ {8}'?${hue}'?: `, 'm'), `${hue} is not renamed by the theme`);
});

// ── THE FIXTURE (the Budget's own shapes, as timesheet01.test.ts builds them; every name made up) ──

const NBO = 'Africa/Nairobi'; // UTC+3 the year round
const MON = '2027-05-10';
const TUE = '2027-05-11';
const WED = '2027-05-12';
/** Tue May 11, 12:00 in the zone. */
const NOW = new Date('2027-05-11T09:00:00.000Z');
/** An occurrence's instant: a wall clock on a day in the zone (UTC+3), as the Budget's expansion gives it. */
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  // A lined place stop at 12:30 — no code of its own, its two lines on one account.
  routine({ id: 'lunch', name: 'Lunch', scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', steps: [
    { id: 'soup', stepOrder: 1, budgetAmount: 5.5, coaCode: '6150', durationMinutes: 20, timeOfDay: '12:45' },
    { id: 'bread', stepOrder: 2, budgetAmount: 2.25, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  // A stepless plain stop on its own account.
  routine({ id: 'swim', name: 'Swim', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', budgetAmount: 4, coaCode: '6200', role: 'none' }),
  // A stepless place stop on the business book.
  routine({ id: 'print', name: 'Print shop', scheduleRrule: 'FREQ=DAILY;BYHOUR=11;BYMINUTE=0', entityId: 'B', entityType: 'sole_prop', budgetAmount: 7.5, coaCode: '6400' }),
  // A stepless place stop on the lunch's account.
  routine({ id: 'tea', name: 'Tea', scheduleRrule: 'FREQ=DAILY;BYHOUR=15;BYMINUTE=0', budgetAmount: 3, coaCode: '6150' }),
  // An all-day charge on the trading book, on an account the chart has no name for.
  routine({ id: 'desk', name: 'Desk fee', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0', entityId: 'T', entityType: 'trading', budgetAmount: 9.75, coaCode: '5010', role: 'all_day' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['kiosk', 'place']]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: NBO,
  steps: new Map(r.id === 'lunch' ? [['soup', { activity: 'Soup', timeOfDay: '12:45' }], ['bread', { activity: 'Bread', timeOfDay: null }]] : []),
}]));
const VENDORS: PlanVendorRow[] = [
  { id: 'pv-soup', routine_id: null, step_id: 'soup', task_id: null, occurrence_at: null, vendor: { id: 'v1', vendor_name: 'Ladle & Co', entity_id: 'P' }, routine: null, step: { activity: 'Soup', routine_id: 'lunch', routine: { name: 'Lunch', timezone: NBO } }, task: null },
];
/** Tuesday on — Monday has no stay. */
const STAYS: StayRow[] = [{ id: 'em', place: 'Eastmere, Sylvania', starts_on: TUE, ends_on: '2027-05-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }, { entityId: 'B', code: '6400', name: 'Printing' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }, { id: 'B', entityType: 'sole_prop' }, { id: 'T', entityType: 'trading' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const line = (r: StopRecordRow, activity: string, timeOfDay: string | null, durationMinutes: number | null): LedgerRecordInput => ({ record: r, routineId: 'lunch', routineName: 'Lunch', zone: NBO, role: 'place', activity, timeOfDay, durationMinutes });
const stop = (routineId: string, routineName: string, role: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: NBO, role, activity: null, timeOfDay: null, durationMinutes: null });
const RECORDS: LedgerRecordInput[] = [
  line(record({ id: 'r-soup-1', kind: 'routine_line', target_id: 'soup', occurrence_at: at(MON, '12:30'), actual_cents: 600, rating: 4, note: 'with rice', actual_minutes: 18 }), 'Soup', '12:45', 20),
  line(record({ id: 'r-bread-1', kind: 'routine_line', target_id: 'bread', occurrence_at: at(MON, '12:30'), outcome: 'skipped', done_at: null, note: 'sold out' }), 'Bread', null, null),
  stop('print', 'Print shop', 'place', record({ id: 'r-print-1', kind: 'routine', target_id: 'print', occurrence_at: at(MON, '11:00'), actual_cents: 700, note: 'thirty copies, two-sided' })),
  // A one-off whose routine the loader no longer lists — a record no line matches: no book, no account.
  stop('kiosk', 'Kiosk', 'place', record({ id: 'r-kiosk-1', kind: 'routine', target_id: 'kiosk', occurrence_at: at(MON, '10:00'), actual_cents: 150 })),
];
const LINKS: LedgerLinkInput[] = [{ kind: 'routine_line', targetId: 'soup', instant: at(MON, '12:30'), journalEntryId: 'je-soup', amountCents: 600, reversed: false }];
const built = buildRoutineBudgetLines(ROUTINES, MON, WED);
const INPUT: LedgerInput = {
  from: MON, to: WED, now: NOW, records: RECORDS, links: LINKS, lines: built.lines, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS,
};
const ledger = ledgerOf(INPUT);

// ── WHAT MAIN GIVES: ledgerOf(INPUT).rows and ledgerCsv(ledgerOf(INPUT).sheet), computed on main e0fd7bf over this fixture — the rule
//    before this change — pinned here so neither can drift under the new look. ──

const MAIN_ROWS: readonly LedgerRow[] = [
  { id: 'r-kiosk-1', key: 'routine:kiosk:2027-05-10T07:00:00.000Z', address: { kind: 'routine', id: 'kiosk', instant: '2027-05-10T07:00:00.000Z' }, match: null, day: '2027-05-10', time: '10:00', place: null, book: null, coa: null, vendor: null, description: 'Kiosk', rating: null, note: null, cents: null, budgetState: 'none', outcome: 'done', actualCents: 150, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-print-1', key: 'routine:print:2027-05-10T08:00:00.000Z', address: { kind: 'routine', id: 'print', instant: '2027-05-10T08:00:00.000Z' }, match: null, day: '2027-05-10', time: '11:00', place: null, book: 'Business', coa: { account: 'B-6400', name: 'Printing' }, vendor: null, description: 'Print shop', rating: null, note: 'thirty copies, two-sided', cents: 750, budgetState: 'matched', outcome: 'done', actualCents: 700, varianceCents: -50, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-bread-1', key: 'line:bread:2027-05-10T09:30:00.000Z', address: { kind: 'routine_line', id: 'bread', instant: '2027-05-10T09:30:00.000Z' }, match: null, day: '2027-05-10', time: '12:30', place: null, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, description: 'Bread', rating: null, note: 'sold out', cents: 225, budgetState: 'matched', outcome: 'skipped', actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-soup-1', key: 'line:soup:2027-05-10T09:30:00.000Z', address: { kind: 'routine_line', id: 'soup', instant: '2027-05-10T09:30:00.000Z' }, match: { cents: 600, postings: 1, unreadable: 0, reversed: 0 }, day: '2027-05-10', time: '12:45', place: null, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Ladle & Co', description: 'Soup', rating: 4, note: 'with rice', cents: 550, budgetState: 'matched', outcome: 'done', actualCents: 600, varianceCents: 50, plannedMinutes: 20, loggedMinutes: 18 },
];
const MAIN_CSV_LINES: readonly string[] = [
  'DAY,DATE,START,END,CITY,COUNTRY,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,WENT,STARS,PLANNED MIN,LOGGED MIN,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,DESCRIPTION',
  'Monday,2027-05-10,07:00,,,,Personal,P-6200,Sport,Swim,,not recorded,,,,4.00,,,,,',
  'Monday,2027-05-10,10:00,,,,,,,Kiosk,,went,,,,,1.50,,,,',
  'Monday,2027-05-10,11:00,,,,Business,B-6400,Printing,Print shop,,went,,,,7.50,7.00,-0.50,,under,"thirty copies, two-sided"',
  'Monday,2027-05-10,12:30,,,,Personal,P-6150,Dining Out,Bread,,skipped,,,,2.25,,,,,sold out',
  'Monday,2027-05-10,12:45,13:05,,,Personal,P-6150,Dining Out,Soup,Ladle & Co,went,4,20,18,5.50,6.00,0.50,6.00,over,with rice',
  'Monday,2027-05-10,15:00,,,,Personal,P-6150,Dining Out,Tea,,not recorded,,,,3.00,,,,,',
  'Tuesday,2027-05-11,all day,,Eastmere,Sylvania,Trading,T-5010,,Desk fee,,,,,,9.75,,,,,',
  'Tuesday,2027-05-11,07:00,,Eastmere,Sylvania,Personal,P-6200,Sport,Swim,,not recorded,,,,4.00,,,,,',
  'Tuesday,2027-05-11,11:00,,Eastmere,Sylvania,Business,B-6400,Printing,Print shop,,not recorded,,,,7.50,,,,,',
  'Tuesday,2027-05-11,12:30,,Eastmere,Sylvania,Personal,P-6150,Dining Out,Bread,,planned,,,,2.25,,,,,',
  'Tuesday,2027-05-11,12:45,13:05,Eastmere,Sylvania,Personal,P-6150,Dining Out,Soup,Ladle & Co,planned,,20,,5.50,,,,,',
  'Tuesday,2027-05-11,15:00,,Eastmere,Sylvania,Personal,P-6150,Dining Out,Tea,,planned,,,,3.00,,,,,',
  'Wednesday,2027-05-12,07:00,,Eastmere,Sylvania,Personal,P-6200,Sport,Swim,,planned,,,,4.00,,,,,',
  'Wednesday,2027-05-12,11:00,,Eastmere,Sylvania,Business,B-6400,Printing,Print shop,,planned,,,,7.50,,,,,',
  'Wednesday,2027-05-12,12:30,,Eastmere,Sylvania,Personal,P-6150,Dining Out,Bread,,planned,,,,2.25,,,,,',
  'Wednesday,2027-05-12,12:45,13:05,Eastmere,Sylvania,Personal,P-6150,Dining Out,Soup,Ladle & Co,planned,,20,,5.50,,,,,',
  'Wednesday,2027-05-12,15:00,,Eastmere,Sylvania,Personal,P-6150,Dining Out,Tea,,planned,,,,3.00,,,,,',
];
const MAIN_CSV = MAIN_CSV_LINES.map((l) => `${l}\r\n`).join('');

// ── T4 · THE ROWS AND THE CSV ARE WHAT THEY WERE (ruling D) ──────────────────

test('T4 `rows` is what main gives for the same fixture, and the rule’s own keys are as they were — the places are no part of ledgerOf', () => {
  assert.deepEqual(ledger.rows, MAIN_ROWS, 'the recorded expenses, cell for cell, in main’s order');
  for (const row of ledger.rows) assert.deepEqual(Object.keys(row), Object.keys(MAIN_ROWS[0]), `${row.id}: the row’s shape is main’s`);
  assert.deepEqual(Object.keys(ledger), ['from', 'to', 'rows', 'sheet', 'recording', 'said'], 'the rule returns what it returned'); // TIMESHEET-02 (Alex, 2026-11-24, ruling B): the rule gains ONE key, `recording`, after `sheet` — five keys until then; the places are still no part of it
  assert.equal(ledger.sheet.length, 17);
  for (const row of ledger.sheet) assert.equal('tone' in row || 'tones' in row, false, `${row.key}: no row carries a tone — every row’s own fields are as they were`);
  // The fixture's own places: the accounts its five plans use — the lunch has no code of its own, three plans share one account.
  assert.deepEqual(accountPlacesOf(ROUTINES), { 'B-6400': 0, 'P-6150': 1, 'P-6200': 2, 'T-5010': 3 });
  // Every account a row of the sheet prints has a place — a plan row's line is an active plan's.
  const places = accountPlacesOf(ROUTINES);
  for (const row of ledger.sheet) if (row.coa !== null) assert.notEqual(placeOf(places, row.coa.account), null, `${row.key}: ${row.coa.account}`);
  // And a tone does not change with the period shown: one day of the span, or all three, the places are the routines'.
  const tuesday = ledgerOf({ ...INPUT, from: TUE, to: TUE, lines: buildRoutineBudgetLines(ROUTINES, TUE, TUE).lines });
  assert.equal(tuesday.sheet.length, 6);
  assert.deepEqual(accountPlacesOf(ROUTINES), places);
});

test('T4 the CSV for the fixture is byte for byte what it is on main — no column moved, no word changed, no tone in the file', () => {
  const csv = ledgerCsv(ledger.sheet);
  assert.equal(csv, MAIN_CSV);
  assert.deepEqual(csv.split('\r\n'), [...MAIN_CSV_LINES, ''], 'line for line');
  assert.deepEqual([Buffer.byteLength(csv, 'utf8'), sha256(csv)], [1862, '7c8be5dde9b1ffcd5e4a8d013d5ea5a21d60d4315ebae646e922834cf127256b'], 'the bytes main writes');
  assert.equal(MAIN_CSV_LINES[0], LEDGER_HEAD_WORDS.join(','), 'the twenty-one heads, in their order');
  assert.equal(LEDGER_COLUMNS.length, 21);
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'START', 'END', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION']);
  assert.doesNotMatch(csv, /bg-|text-|rounded|inline-block/, 'no class in the file');
  // The CSV's fields are the spec's, as they were: nothing here reads a tone.
  const rules = code(RULES);
  const block = rules.slice(rules.indexOf('export const LEDGER_CSV'), rules.indexOf('export const LEDGER_TABLE'));
  assert.doesNotMatch(block, /PILL|TONE|tones|placeOf/i);
  assert.match(block, /book: \(row\) => row\.book \?\? '',\n\s*account: \(row\) => row\.coa === null \? '' : row\.coa\.account,\n\s*accountName: \(row\) => row\.coa === null \|\| row\.coa\.name === null \? '' : row\.coa\.name,/);
});

// ── T5 · THE ANSWER AND THE READ (ruling B.5) ────────────────────────────────

type Call = { readonly table: string; readonly method: string };
function fakeDb(rows: Readonly<Record<string, readonly unknown[]>>, calls: Call[]) {
  const db: Record<string, { findMany: () => Promise<unknown[]>; findFirst: () => Promise<unknown> }> = {};
  for (const table of Object.keys(rows)) {
    db[table] = {
      findMany: async () => { calls.push({ table, method: 'findMany' }); return [...rows[table]]; },
      findFirst: async () => { calls.push({ table, method: 'findFirst' }); return rows[table].length === 0 ? null : rows[table][0]; },
    };
  }
  return db as unknown as Parameters<typeof taskLedgerAnswerOf>[0];
}

test('T5 the answer carries `tones` beside the rest, after `sheet` — the places of the accounts the caller’s active plans use, from the routines the loader already read: no query added, removed, widened or reordered', async () => {
  const a = code(ANSWER);
  assert.match(a, /return \{ from, to, as_of: now\.toISOString\(\), first_record: firstRecord, rows: ledger\.rows, sheet: ledger\.sheet, tones: accountPlacesOf\(routineInputs\), recording: ledger\.recording, said: ledger\.said \};/); // TIMESHEET-02 (Alex, 2026-11-24): `recording` after `tones` — `tones: accountPlacesOf(routineInputs), said: ledger.said` until then; `tones` is built as it was
  assert.match(a, /const routineInputs = routineGroups\.flatMap\(\(group\) => group\.rows\.map\(\(row\) => toRoutinePlanInput\(row, bookOf\(group\.entityId, `the routines of entity \$\{group\.entityId\}`\)\)\)\);/, 'the routines the loader already read');
  assert.match(a, /minutes: planMinutesOf\(routineInputs\),/, 'as planMinutesOf reads them');
  assert.equal((a.match(/db\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 8, 'the eight reads — no query added');
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, 'writes nothing');
  assert.match(code(ROUTE), /return NextResponse\.json\(await taskLedgerAnswerOf\(prisma, user\.id, \{ from, to \}, new Date\(\)\)\);/, 'the route’s code is unchanged');
  const day = (iso: string): Date => new Date(iso);
  const time = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);
  // The rows as the client reads them: one routine row serves the loader's read and the roles read. Two books.
  const P_ROUTINES = [
    { id: 'lunch', name: 'Lunch', role: 'place', is_active: true, end_date: null, start_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', timezone: NBO, start_time: null, end_time: null,
      steps: [{ id: 'soup', is_active: true, budget_amount: 5.5, coa_code: '6150', step_order: 1, activity: 'Soup', time_of_day: time('12:45'), duration_minutes: 20 }] },
    { id: 'swim', name: 'Swim', role: 'none', is_active: true, end_date: null, start_date: null, budget_amount: 4, coa_code: '6200', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] },
    // A plan that falls on no day of the span still gives its account a place: the places are the plans', not the period's.
    { id: 'dues', name: 'Dues', role: 'all_day', is_active: true, end_date: null, start_date: null, budget_amount: 30, coa_code: '7450', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=28;BYHOUR=0;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] },
  ];
  const RECORD_ROW = {
    id: 'rec-swim', routine_id: 'swim', step_id: null, occurrence_at: day(at(TUE, '07:00')), outcome: 'done', done_at: day(at(TUE, '07:40')), actual_cents: 400, rating: 3, note: null, actual_minutes: 35,
    routine: { name: 'Swim', timezone: NBO, role: 'none', start_time: null, end_time: null }, step: null,
  };
  const calls: Call[] = [];
  const db = fakeDb({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }], chart_of_accounts: [{ entity_id: 'P', code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' }],
    operations_routines: P_ROUTINES, planned_item_vendors: [], operations_stays: [], operations_stop_records: [RECORD_ROW], planned_item_links: [],
  }, calls);
  const answer = await taskLedgerAnswerOf(db, 'someone', { from: TUE, to: TUE }, NOW);
  assert.deepEqual(Object.keys(answer), ['from', 'to', 'as_of', 'first_record', 'rows', 'sheet', 'tones', 'recording', 'said'], 'ONE key more, after the sheet'); // TIMESHEET-02 (Alex, 2026-11-24): `recording` after `tones` — eight keys until then
  assert.deepEqual(answer.tones, { 'P-6150': 0, 'P-6200': 1, 'P-7450': 2 }, 'an account’s label → its place');
  assert.deepEqual(Object.keys(answer.tones), ['P-6150', 'P-6200', 'P-7450']);
  assert.deepEqual(JSON.parse(JSON.stringify(answer)), answer, 'wire-shaped as built');
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'operations_routines.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany'], 'the same reads, in the same order — the loader’s (once an entity) among them');
  assert.deepEqual(answer.rows.map((r) => r.id), ['rec-swim'], 'the recorded expense, as before');
  assert.deepEqual(answer.sheet.map((r) => [r.description, r.coa === null ? null : r.coa.account]), [['Swim', 'P-6200'], ['Soup', 'P-6150']], 'Tuesday’s two rows — the dues fall on no day of it');
  for (const r of answer.sheet) assert.notEqual(placeOf(answer.tones, r.coa === null ? '' : r.coa.account), null);
  assert.equal(placeOf(answer.tones, 'P-7450'), 2, 'the account of a plan with no row in the period keeps its place');
  // The same routines read for another span give the same places.
  const month = await taskLedgerAnswerOf(fakeDb({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }], chart_of_accounts: [], operations_routines: P_ROUTINES, planned_item_vendors: [], operations_stays: [], operations_stop_records: [], planned_item_links: [],
  }, []), 'someone', { from: '2027-05-01', to: '2027-05-31' }, NOW);
  assert.deepEqual(month.tones, answer.tones, 'a tone does not change with the period shown');
});

test('T5 the read: the client carries `tones`; an answer without it is a failure in words, as one without its sheet is; the home ledger reads `rows` alone', async () => {
  const reads = code(READS);
  assert.match(reads, /readonly sheet: readonly LedgerSheetRow\[\];\s*\n\s*readonly tones: AccountPlaces;\s*\n\s*readonly recording: Readonly<Record<string, LedgerRecording>>;\s*\n\s*readonly said: LedgerSaid;/, 'after the sheet, before what is said'); // TIMESHEET-02 (Alex, 2026-11-24): `recording` stands between `tones` and `said` — `tones` then `said` until then
  assert.match(reads, /if \(typeof read\.value\.tones !== 'object' \|\| read\.value\.tones === null \|\| Array\.isArray\(read\.value\.tones\)\) return \{ ok: false, words: ledgerFailedWords\('the ledger came back without its tones'\) \};/);
  assert.equal((reads.match(/readJson\(/g) ?? []).length, 1, 'still one read');
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const answers = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const places = accountPlacesOf(ROUTINES);
  const whole = { from: MON, to: WED, as_of: NOW.toISOString(), first_record: { day: MON }, rows: ledger.rows, sheet: ledger.sheet, tones: places, recording: ledger.recording, said: ledger.said }; // TIMESHEET-02 (Alex, 2026-11-24): the answer carries its `recording` too — one without it is a failure in words (timesheet02.test.ts); `tones: places, said: ledger.said` until then
  try {
    g.fetch = answers(whole);
    const ok = await readLedger(MON, WED);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.value.tones, places, 'as the rule built them, through the wire');
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], sheet: [], tones: {}, recording: {}, said: {} }); // TIMESHEET-02 (Alex, 2026-11-24): with its `recording` — `tones: {}, said: {}` until then
    assert.equal((await readLedger(MON, WED)).ok, true, 'no plan uses an account: no place, and that is an answer');
    // Without them.
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], sheet: [], said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its tones') }, 'never drawn in a guessed tone');
    for (const bad of [null, [], 'blue', 7]) {
      g.fetch = answers({ ...whole, tones: bad });
      assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its tones') }, JSON.stringify(bad));
    }
    // The earlier refusals stand, in their order.
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], tones: {}, said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its sheet') });
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, sheet: [], tones: {}, said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its rows') });
  } finally {
    g.fetch = real;
  }
  assert.equal(ledgerFailedWords('the ledger came back without its tones'), 'The ledger could not be read — the ledger came back without its tones');
  // The home ledger reads `rows` through the one reader — not the sheet, not the tones.
  const h = code(HOME_ROUTE);
  assert.match(h, /taskRows: listOf<LedgerRow>\(taskAnswer, '\/api\/operations\/ledger', 'rows'\),/);
  assert.doesNotMatch(h, /tones|\.sheet\b/);
});

// ── T6 · THE SECTION (rulings A, B, C) ───────────────────────────────────────

test('T6 today first: the section’s period starts on Day, anchored today as before; the period’s controls are as they were', () => {
  const s = code(SECTION);
  assert.match(s, /const \[kind, setKind\] = useState<PeriodKind>\('day'\);/, 'Day is the default');
  assert.doesNotMatch(s, /useState<PeriodKind>\('(month|week|all)'\)/);
  assert.match(s, /useEffect\(\(\) => \{\n\s*const t = localToday\(\);\n\s*setToday\(t\);\n\s*setAnchor\(t\);\n\s*\}, \[\]\);/, 'anchored today, on mount');
  assert.match(s, /const period = today === null \|\| anchor === null \? null : periodOf\(kind, anchor, today, firstRecordDay\);/);
  // Month, Week, Day and All are one tap away; ‹ ›, the date box and the period's words work as they did.
  assert.match(s, /\{PERIOD_KINDS\.map\(\(k\) => \(\n\s*<button key=\{k\} type="button" className=\{kind === k \? chipOn : chip\} onClick=\{\(\) => setKind\(k\)\} data-ledger-period=\{k\} aria-pressed=\{kind === k\}>\{PERIOD_WORDS\[k\]\}<\/button>/);
  assert.match(s, /onClick=\{\(\) => anchor !== null && setAnchor\(stepAnchor\(kind, anchor, -1\)\)\} data-ledger-previous/);
  assert.match(s, /onClick=\{\(\) => anchor !== null && setAnchor\(stepAnchor\(kind, anchor, 1\)\)\} data-ledger-next/);
  assert.match(s, /<input type="date" value=\{anchor \?\? ''\} disabled=\{kind === 'all'\}/);
  assert.match(s, /\{period !== null && <span className="font-semibold text-text-secondary" data-ledger-period-words>\{periodWords\(period\)\}<\/span>\}/);
});

test('T6 the pills: the BOOK and ACCOUNT NAME cells draw the pill with the rule’s classes and their blank without one; the ACCOUNT cell is not touched; the places are the answer’s `tones`', () => {
  const s = code(SECTION);
  assert.match(s, /const tones: AccountPlaces = answer !== null && answer\.read\.ok \? answer\.read\.value\.tones : \{\};/);
  assert.match(s, /const bookPill = bookPillClassOf\(row\);\n\s*const accountPill = accountPillClassOf\(row, tones\);/, 'the classes by the rule — null for a blank');
  // BOOK: the word in the pill, or the blank as before, bare.
  assert.match(s, /<td className=\{`\$\{cell\} whitespace-nowrap \$\{row\.book === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="book">\{bookPill === null \? bookCellWords\(row\) : <span className=\{bookPill\} data-ledger-pill="book">\{bookCellWords\(row\)\}<\/span>\}<\/td>/);
  // ACCOUNT, between them: as it was.
  assert.match(s, /<td className=\{`\$\{cell\} whitespace-nowrap \$\{row\.coa === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="account">\{accountCellWords\(row\)\}<\/td>/);
  // ACCOUNT NAME: the name in the pill, or the blank as before, bare.
  assert.match(s, /<td className=\{`\$\{cell\} \$\{row\.coa === null \|\| row\.coa\.name === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="account-name">\{accountPill === null \? accountNameCellWords\(row\) : <span className=\{accountPill\} data-ledger-pill="account-name">\{accountNameCellWords\(row\)\}<\/span>\}<\/td>/);
  assert.equal((s.match(/data-ledger-pill=/g) ?? []).length, 2, 'two pills, and no other');
  // The three stand together, in their order.
  assert.match(s, /data-ledger-cell="book">[^\n]*<\/td>\n\s*<td [^\n]*data-ledger-cell="account">[^\n]*<\/td>\n\s*<td [^\n]*data-ledger-cell="account-name">[^\n]*<\/td>\n\s*<td [^\n]*data-ledger-cell="sub-account-name">/);
  // The section types no pill class and no tone of its own: they are the rule's.
  assert.doesNotMatch(s, /rounded-full|bg-(gray|violet|emerald|orange|green|pink|teal|amber|purple|cyan|rose|lime|indigo|yellow|sky)-\d|bg-blue-(100|200|300)/, 'no pill class, no tone typed here');
  assert.doesNotMatch(s, /BOOK_TONES|ACCOUNT_TONES|NEUTRAL_TONE|PILL_CLASS|toneOfPlace/, 'it reads the two classes, never the wheel');
  // On the fixture's rows: what each cell would wear.
  const places = accountPlacesOf(ROUTINES);
  const worn = ledger.sheet.filter((r) => r.day === MON || r.description === 'Desk fee').map((r) => [r.description, bookPillClassOf(r), accountPillClassOf(r, places)]);
  assert.deepEqual(worn, [
    ['Swim', `${PILL_CLASS} bg-gray-300 text-gray-900`, `${PILL_CLASS} bg-green-200 text-green-950`],
    ['Kiosk', null, null],
    ['Print shop', `${PILL_CLASS} bg-violet-200 text-violet-950`, `${PILL_CLASS} bg-blue-200 text-blue-950`],
    ['Bread', `${PILL_CLASS} bg-gray-300 text-gray-900`, `${PILL_CLASS} bg-orange-200 text-orange-950`],
    ['Soup', `${PILL_CLASS} bg-gray-300 text-gray-900`, `${PILL_CLASS} bg-orange-200 text-orange-950`],
    ['Tea', `${PILL_CLASS} bg-gray-300 text-gray-900`, `${PILL_CLASS} bg-orange-200 text-orange-950`],
    ['Desk fee', `${PILL_CLASS} bg-emerald-200 text-emerald-950`, null],
  ], 'a book by its word; an account by its place; the record no line matches and the account with no name print their blank');
});

test('T6 the tint: BUDGET, VARIANCE, MATCH and UNDER / OVER carry it on every body row, whatever else their classes say; no other cell and not the TOTAL row; one legend line above the table while rows are shown', () => {
  const s = code(SECTION);
  assert.match(s, /const NOT_TYPED_TINT = 'bg-blue-50';/, 'one class, typed whole');
  // The four cells, each with the tint before its own classes.
  assert.match(s, /<td className=\{`\$\{money\} \$\{NOT_TYPED_TINT\} \$\{row\.cents === null \? BLANK_CLASS : 'font-semibold text-text-primary'\}`\} data-ledger-cell="budget">\{budgetCellWords\(row\.cents\)\}<\/td>/);
  assert.match(s, /<td className=\{`\$\{money\} \$\{NOT_TYPED_TINT\} \$\{row\.varianceCents === null \? BLANK_CLASS : `font-semibold \$\{actualTone\(delta\.over\)\}`\}`\} data-ledger-cell="variance">\{varianceCellWords\(row\.varianceCents\)\}<\/td>/);
  assert.match(s, /<td className=\{`\$\{money\} \$\{NOT_TYPED_TINT\} \$\{readableMatchCents\(row\.match\) === null \? BLANK_CLASS : `font-semibold \$\{matchTone\(matchState\(row\.match, row\.actualCents\)\)\}`\}`\} data-ledger-cell="match" title=\{matchCellTitle\(row\.match\) \?\? undefined\}>/);
  assert.match(s, /<td className=\{`\$\{cell\} whitespace-nowrap \$\{NOT_TYPED_TINT\} \$\{row\.varianceCents === null \? BLANK_CLASS : actualTone\(delta\.over\)\}`\} data-ledger-cell="under-over">\{underOverWords\(row\.varianceCents\)\}<\/td>/);
  // Exactly those four of the twenty-one — ACTUAL, among them, is typed on a row and is not tinted.
  const cells = [...s.matchAll(/<td className=\{`([^\n]*?)`\} data-ledger-cell="([a-z-]+)"/g)].map((m) => ({ name: m[2], tinted: m[1].includes('${NOT_TYPED_TINT}') }));
  assert.deepEqual(cells.map((c) => c.name), ['day', 'date', 'start', 'end', 'city', 'country', 'book', 'account', 'account-name', 'sub-account-name', 'vendor', 'went', 'stars', 'planned-minutes', 'logged-minutes', 'budget', 'actual', 'variance', 'match', 'under-over', 'description'], 'one cell per head word, in its order — none added, none moved');
  assert.deepEqual(cells.filter((c) => c.tinted).map((c) => c.name), ['budget', 'variance', 'match', 'under-over']);
  // The TOTAL row is not tinted.
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.ok(tfoot.includes('data-ledger-total>') && tfoot.includes('data-ledger-total-budget') && tfoot.includes('data-ledger-total-under-over'));
  assert.doesNotMatch(tfoot, /NOT_TYPED_TINT|bg-blue/, 'the TOTAL row carries no tint');
  assert.equal((s.match(/\$\{NOT_TYPED_TINT\}/g) ?? []).length, 5, 'the four cells and the legend’s swatch');
  assert.equal((s.match(/bg-blue-50/g) ?? []).length, 1, 'typed once');
  // The legend: one line, in the shared table's children slot, after the nothing-recorded line — while rows are shown.
  assert.match(s, /\{answer !== null && answer\.read\.ok && rows\.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>\{noRowsWords\(answer\.period\)\}<\/div>\}\n(?:\s*\{\s*\}\n)?\s*\{answer !== null && answer\.read\.ok && shown\.length > 0 && <div className="flex items-center gap-1\.5 text-xs text-text-muted" data-ledger-legend><span className=\{`inline-block h-3 w-3 rounded-sm border border-border \$\{NOT_TYPED_TINT\}`\} aria-hidden="true" data-ledger-legend-swatch \/><span>\{NOT_TYPED_WORDS\}<\/span><\/div>\}\n\s*<\/DataTable>/);
  assert.equal(NOT_TYPED_WORDS, 'not typed on a row — from your plan, from Books, or worked out');
  assert.ok(code(RULES).includes("export const NOT_TYPED_WORDS = 'not typed on a row — from your plan, from Books, or worked out';"), 'the words are the rule’s');
  assert.doesNotMatch(s, /not typed on a row/, 'and are not typed in the section');
  // No sentence of the section's own, no box in a row, nothing fetched or stored — as before.
  const printed = [...s.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(s, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  const row = s.slice(s.indexOf('renderRow={(row) => {'), s.indexOf('foot={('));
  assert.doesNotMatch(row, /<input|<select|<textarea|<form|bg-amber|contentEditable/, 'no box in a row, no amber cell — typing in the row is not this change');
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|method:/);
  assert.match(comments(SECTION), /TIMESHEET-03 \(Alex, 2026-11-24\): THE TIME SHEET'S LOOK — TODAY FIRST, PILLS, THE TINT\./);
  assert.match(comments(RULES), /TIMESHEET-03 \(Alex, 2026-11-24\) — THE TIME SHEET'S LOOK: TODAY FIRST, PILLS, THE TINT\./);
});

test('T6 the shared table: mounted with the same props, and not edited — DataTable.tsx is byte for byte what it is on main', () => {
  const s = code(SECTION);
  assert.match(s, /<DataTable\n\s*name="ledger"\n\s*columns=\{LEDGER_TABLE\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{answer !== null && answer\.read\.ok\}\n\s*tableClassName="min-w-\[96rem\]"\n\s*filters=\{filters\}\n\s*onFilters=\{setFilters\}\n\s*noFilters=\{NO_COLUMN_FILTERS\}\n\s*sort=\{sort\}\n\s*onSort=\{setSort\}\n\s*openFilter=\{openFilter\}\n\s*onOpenFilter=\{setOpenFilter\}\n\s*csv=\{csv\}\n\s*controls=\{\(/, 'the same props, in the same order');
  const mount = s.slice(s.indexOf('<DataTable\n'), s.indexOf('</DataTable>'));
  assert.deepEqual([...mount.matchAll(/^ {8}([a-zA-Z]+)=\{/gm)].map((m) => m[1]).concat([...mount.matchAll(/^ {8}([a-zA-Z]+)="/gm)].map((m) => m[1])).sort(), ['columns', 'controls', 'csv', 'filters', 'foot', 'loaded', 'name', 'noFilters', 'onFilters', 'onOpenFilter', 'onSort', 'openFilter', 'renderRow', 'rows', 'shown', 'sort', 'tableClassName', 'trailing'].sort(), 'no prop added, none removed');
  assert.equal((s.match(/<DataTable\n/g) ?? []).length, 1);
  // The table itself, as it stood on main when this branch was cut (e0fd7bf): every character.
  const table = whole(TABLE);
  assert.deepEqual([Buffer.byteLength(table, 'utf8'), sha256(table)], [10887, '58f411487e2f6e4b36da6bf9f7ba59c4bdf9af4bd3b1675aedd2881eeeac31f5'], 'DataTable.tsx is not among the files this change edits');
  // What the section leans on in it, by content: its classes, the children slot between the controls and the table, each row through renderRow.
  const t = code(TABLE);
  assert.match(t, /export const cellClass = 'px-2 py-1\.5 align-top';\nexport const moneyClass = 'px-2 py-1\.5 align-top text-right tabular-nums whitespace-nowrap';/);
  assert.match(t, /\{trailing\}\n\s*<\/div>\n\s*\{children\}\n/, 'the caller’s lines stand between the controls and the table');
  assert.match(t, /<tbody>\n\s*\{shown\.map\(renderRow\)\}\n\s*<\/tbody>/);
  assert.doesNotMatch(t, /PILL_CLASS|_TONES?\b|NOT_TYPED|rounded-full|bg-blue|data-ledger-/, 'the shared table knows no pill, no tone, no tint and no ledger');
});

// ── T7 · THE REGISTRY (ruling F) ─────────────────────────────────────────────

/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');

test('T7 the registry’s Time row: status, beats, why, note and customer line unchanged; every line it cites holds what it cites; the two pinned files keep their line counts', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  assert.match(time.note ?? '', /^HOME-03 \(2026-10-27\): the day itself is entered on the day card/);
  // The number a citation names, read from the citation itself — and the line it names, by content.
  const cited = (re: RegExp): number => { const m = time.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  const lineOf = (file: string, n: number): string => linesOf(file)[n - 1] ?? '';
  // Every citation this change moved, re-cited: each line is what it says.
  assert.match(lineOf(RULES, cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS/)), /^export const LEDGER_HEAD_WORDS = \[/);
  assert.match(lineOf(RULES, cited(/the summary's sums, src\/lib\/operations\/ledger\.ts:(\d+)/)), /^export const SUMMARY_HEAD_WORDS = \[/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the two cells\)/)), /data-ledger-cell="planned-minutes"/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(PLANNED HOURS · LOGGED HOURS/)), /data-ledger-group-planned-hours/);
  assert.match(lineOf(SECTION, cited(/their coverage said at LedgerSection\.tsx:(\d+)/)), /data-ledger-said-planned/);
  // And the ones that did not move.
  assert.match(lineOf(READS, cited(/discover: src\/components\/workbench\/operations\/ledger\/ledgerReads\.ts:(\d+)/)), /readJson\(`\/api\/operations\/ledger\?/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the line's duration\)/)), /duration_minutes: true/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the routine's window\)/)), /start_time: true, end_time: true/);
  // The dated note on the row says what moved.
  assert.match(comments(REGISTRY), /TIMESHEET-03 \(Alex, 2026-11-24\): ledger\.ts and LedgerSection\.tsx grew again/);
  // The two files other tests pin by line number keep their line counts (ruling F).
  assert.equal(linesOf(REGISTRY).length, 761);
  assert.equal(linesOf(LAW).length, 11254);
});

// ── T8 · NOTHING ELSE ────────────────────────────────────────────────────────

test('T8 this change adds no route, no migration and no write; the rule stays pure; this test pins no line number of any file', () => {
  for (const f of [RULES, ANSWER, ROUTE, READS, SECTION]) assert.doesNotMatch(code(f), /prisma\.\$executeRaw|ALTER TABLE|migrations|\$transaction/, `${f}: no migration, no raw SQL`);
  assert.doesNotMatch(code(RULES), /\bfetch\b|@prisma\/client|from 'react'|from 'next/, 'the rule stays pure');
  assert.doesNotMatch(code(RULES), /new Date\(\)|Date\.now\(/, 'and reads no clock of its own');
  assert.doesNotMatch(code(THIS), /new Date\(\)|Date\.now\(/, 'nor does this test');
  assert.equal((code(ROUTE).match(/prisma\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 1, 'the route’s only read is the gate’s');
  assert.doesNotMatch(code(THIS), /split\('\\n'\)\[\d+\]|\.tsx?:\d+/, 'no line-number pin');
});
