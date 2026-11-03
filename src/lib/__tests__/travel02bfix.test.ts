/**
 * TRAVEL-02b-fix (Alex, 2026-11-03, rulings A–D) — the travel ledger's reads never show a missing list as empty; the
 * vendor and the note are kept trimmed; the travel lane's hundredths are declared in three places; four stale schema
 * citations in the registry are re-pointed. The parse is driven with fixture answers through the same function the
 * screen calls (travelLedger.ts travelLedgerReadsOf); source is read through code() / comments() (the reader law).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  RESERVATIONS_ROUTE, TRAVEL_EXPENSES_ROUTE, TravelLedgerError, ledgerRowsOf, listOf, missingListWords, travelLedgerReadsOf,
} from '../reservations/travelLedger';
import { AMOUNT_REQUIRED_WORDS, NOTE_BLANK_WORDS, VENDOR_BLANK_WORDS, VENDOR_MAX, travelExpenseBodyRule } from '../travel/travelExpense';
import { statedMoneyWords } from '../books/functionalCurrency';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { LEDGER_FIXTURE, VIEWER_ZONE } from './fixtureTravelLedger';
import { TYPED_FIXTURE } from './fixtureTravelExpenses';

const VIEW = 'src/components/trips/AllBookings.tsx';
const LEAF = 'src/lib/reservations/travelLedger.ts';
const RULES = 'src/lib/travel/travelExpense.ts';
const CONTROLS = 'src/components/trips/TravelExpenseControls.tsx';
const ROUTE = 'src/app/api/travel-expenses/route.ts';
const VOID_ROUTE = 'src/app/api/travel-expenses/[id]/void/route.ts';
const RES_ROUTE = 'src/app/api/reservations/route.ts';
const CURRENCY = 'src/lib/books/functionalCurrency.ts';
const SCHEMA = 'prisma/schema.prisma';
const REGISTRY = 'src/lib/toolRegistry.ts';

/** The two 200 answers the screen reads, whole. */
const RESERVATIONS_ANSWER = { ledger: LEDGER_FIXTURE };
const EXPENSES_ANSWER = {
  expenses: TYPED_FIXTURE,
  trips: [{ id: 'trip-bali', name: 'Bali 2026' }],
  accounts: [{ account: 'P-9200', name: 'Travel — Visas', book: 'Personal' }],
};

const failsWith = (read: () => unknown, words: string): void => {
  assert.throws(read, (e: unknown) => e instanceof TravelLedgerError && e.message === words, words);
};

/** The comment block directly above the first code line matching `line`, its comment markers removed, one line of prose. */
function commentAbove(file: string, line: RegExp): string {
  const codeLines = code(file).split('\n');
  const commentLines = comments(file).split('\n');
  const at = codeLines.findIndex((l) => line.test(l));
  assert.ok(at > 0, `${file} holds ${line}`);
  const block: string[] = [];
  for (let i = at - 1; i >= 0 && codeLines[i].trim() === '' && commentLines[i].trim() !== ''; i -= 1) block.unshift(commentLines[i]);
  return block.map((l) => l.replace(/^\s*(\/\*\*|\*\/|\*|\/\/\/|\/\/)?\s?/, '')).join(' ').replace(/\s+/g, ' ');
}

// ── A · NO SILENT EMPTY ─────────────────────────────────────────────────────

test('A every list a 200 promises, or the read fails by name — the bookings\' ledger; the typed rows\' expenses, trips and accounts — through the parse the screen uses', () => {
  assert.equal(missingListWords(TRAVEL_EXPENSES_ROUTE, 'accounts'), '/api/travel-expenses answered without its "accounts" list — nothing is shown as empty');
  assert.equal(RESERVATIONS_ROUTE, '/api/reservations');
  assert.equal(TRAVEL_EXPENSES_ROUTE, '/api/travel-expenses');
  // Each list left out of its answer: the read fails, naming the route and the list.
  failsWith(() => travelLedgerReadsOf({}, EXPENSES_ANSWER), missingListWords(RESERVATIONS_ROUTE, 'ledger'));
  failsWith(() => travelLedgerReadsOf(RESERVATIONS_ANSWER, { trips: EXPENSES_ANSWER.trips, accounts: EXPENSES_ANSWER.accounts }), missingListWords(TRAVEL_EXPENSES_ROUTE, 'expenses'));
  failsWith(() => travelLedgerReadsOf(RESERVATIONS_ANSWER, { expenses: EXPENSES_ANSWER.expenses, accounts: EXPENSES_ANSWER.accounts }), missingListWords(TRAVEL_EXPENSES_ROUTE, 'trips'));
  failsWith(() => travelLedgerReadsOf(RESERVATIONS_ANSWER, { expenses: EXPENSES_ANSWER.expenses, trips: EXPENSES_ANSWER.trips }), missingListWords(TRAVEL_EXPENSES_ROUTE, 'accounts'));
  // A key that is there but not a list, and an answer that is not an object (a body that was not JSON reads as {}), are the same malformed answer.
  failsWith(() => travelLedgerReadsOf({ ledger: null }, EXPENSES_ANSWER), missingListWords(RESERVATIONS_ROUTE, 'ledger'));
  failsWith(() => travelLedgerReadsOf({ ledger: {} }, EXPENSES_ANSWER), missingListWords(RESERVATIONS_ROUTE, 'ledger'));
  failsWith(() => travelLedgerReadsOf(RESERVATIONS_ANSWER, { ...EXPENSES_ANSWER, accounts: 'none' }), missingListWords(TRAVEL_EXPENSES_ROUTE, 'accounts'));
  for (const answer of [null, undefined, [], 'ledger', 7]) failsWith(() => travelLedgerReadsOf(answer, EXPENSES_ANSWER), missingListWords(RESERVATIONS_ROUTE, 'ledger'));
  failsWith(() => listOf({ expenses: [] }, TRAVEL_EXPENSES_ROUTE, 'trips'), missingListWords(TRAVEL_EXPENSES_ROUTE, 'trips'));
});

test('A a list that is truly empty stays a list — the ledger draws no rows and no failure; a whole answer reads back as answered', () => {
  const empty = travelLedgerReadsOf({ ledger: [] }, { expenses: [], trips: [], accounts: [] });
  assert.deepEqual(empty, { ledger: [], expenses: [], trips: [], accounts: [] });
  assert.deepEqual(ledgerRowsOf(empty.ledger, empty.expenses, VIEWER_ZONE), []);
  const whole = travelLedgerReadsOf(RESERVATIONS_ANSWER, EXPENSES_ANSWER);
  assert.equal(whole.ledger, RESERVATIONS_ANSWER.ledger);
  assert.equal(whole.expenses, EXPENSES_ANSWER.expenses);
  assert.deepEqual(whole.trips, EXPENSES_ANSWER.trips);
  assert.deepEqual(whole.accounts, EXPENSES_ANSWER.accounts);
  assert.equal(ledgerRowsOf(whole.ledger, whole.expenses, VIEWER_ZONE).length > 0, true);
  assert.deepEqual(listOf({ trips: [] }, TRAVEL_EXPENSES_ROUTE, 'trips'), []);
});

test('A the screen reads both answers through the parse, into its one error state; no list in the lane is read as empty when it is missing', () => {
  const view = code(VIEW);
  assert.match(view, /const \[res, typedRes\] = await Promise\.all\(\[fetch\('\/api\/reservations'\), fetch\('\/api\/travel-expenses'\)\]\);/);
  assert.match(view, /const reads = travelLedgerReadsOf\(data, answer\);\s*if \(alive\) setLoaded\(\{ state: 'done', \.\.\.reads \}\);/);
  assert.match(view, /\} catch \(err\) \{\s*if \(alive\) setLoaded\(\{ state: 'error', message: err instanceof Error \? err\.message : BOOKING_WORDS\.unreadable \}\);/);
  assert.match(view, /\{loaded\.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-travel-ledger-failed>\{loaded\.message\}<\/p>\}/);
  assert.match(view, /\| \(\{ state: 'done' \} & TravelLedgerReads\);/);
  // Ruling A's sweep, every file of the lane: no `Array.isArray(x) ? x : []`, no `|| []`, no `?? []`.
  for (const f of [VIEW, CONTROLS, LEAF, RULES, ROUTE, VOID_ROUTE, RES_ROUTE]) {
    const src = code(f);
    assert.doesNotMatch(src, /Array\.isArray\([^)]*\)\s*\?[^:]*:\s*\[\]/, `${f} reads no missing list as empty`);
    assert.doesNotMatch(src, /\|\|\s*\[\]/, `${f} has no || []`);
    assert.doesNotMatch(src, /\?\?\s*\[\]/, `${f} has no ?? []`);
  }
  // The words are the leaf's, one function (ruling A).
  assert.match(code(LEAF), /export const missingListWords = \(route: string, name: string\): string =>\s*`\$\{route\} answered without its "\$\{name\}" list — nothing is shown as empty`;/);
});

// ── B · TRIMMED ─────────────────────────────────────────────────────────────

test('B the vendor and the note are kept trimmed — STAY-01\'s rule for a place; the length is the trimmed text\'s; one that trims to nothing is refused as blank', () => {
  const VISA = { kind: 'visa', paid_on: '2026-10-20', amount_minor: 350000, currency: 'PHP', vendor: '  Airalo  ' };
  const plain = travelExpenseBodyRule(VISA);
  assert.ok(plain.ok && plain.value.vendor === 'Airalo', 'vendor "  Airalo  " is kept "Airalo"');
  const noted = travelExpenseBodyRule({ ...VISA, note: '  x ' });
  assert.ok(noted.ok && noted.value.note === 'x', 'note "  x " is kept "x"');
  const longest = 'v'.repeat(VENDOR_MAX);
  const kept = travelExpenseBodyRule({ ...VISA, vendor: `  ${longest}  ` });
  assert.ok(kept.ok && kept.value.vendor === longest, '120 characters with spaces around is 120 characters');
  assert.deepEqual(travelExpenseBodyRule({ ...VISA, vendor: ` ${'v'.repeat(VENDOR_MAX + 1)} ` }), { ok: false, field: 'vendor', words: 'vendor is 121 characters — at most 120' });
  assert.deepEqual(travelExpenseBodyRule({ ...VISA, vendor: '\t \n' }), { ok: false, field: 'vendor', words: VENDOR_BLANK_WORDS });
  assert.deepEqual(travelExpenseBodyRule({ ...VISA, note: '   ' }), { ok: false, field: 'note', words: NOTE_BLANK_WORDS });
  // The rule and its header say so (ruling B's words).
  assert.match(code(RULES), /const vendor = body\.vendor\.trim\(\);/);
  assert.match(code(RULES), /const noteKept = note\.value === null \? null : note\.value\.trim\(\);/);
  assert.match(comments(RULES), /vendor as typed,[\s*]*trimmed \(STAY-01's rule for a place\)/);
});

// ── C · THE HUNDREDTHS, DECLARED ────────────────────────────────────────────

test('C the travel lane\'s hundredths declared in three places, words only — 350,000 VND is stored 35,000,000 and printed \'350000.00 VND\'', () => {
  assert.equal(statedMoneyWords(35000000, 'VND'), '350000.00 VND', 'the declaration\'s own example is what the one formatter prints');
  assert.equal(AMOUNT_REQUIRED_WORDS, 'amount_minor is required — the amount in hundredths of the currency (1/100 of its major unit), a whole number above 0');
  const places: readonly [string, RegExp][] = [
    [CURRENCY, /^export function statedMoneyWords\(/],
    [RULES, /^export const AMOUNT_REQUIRED_WORDS = /],
    [SCHEMA, /^\s+amount_minor\s+Int$/],
  ];
  for (const [file, line] of places) {
    const said = commentAbove(file, line);
    assert.match(said, /TRAVEL-02b-fix \(Alex, 2026-11-03, ruling C\) — THE HUNDREDTHS/, `${file}: the declaration sits directly above ${line}`);
    assert.match(said, /HUNDREDTHS of (its|the) currency \(1\/100 of its major unit\)/, file);
    assert.match(said, /VND, JPY and KRW have none, so 350,000 VND is stored 35,000,000 and printed '350000\.00 VND'/, file);
    assert.match(said, /FX-02 owns exponent-aware words and any conversion/, file);
  }
});

// ── D · FOUR STALE CITATIONS, RE-POINTED ────────────────────────────────────

test('D four stale schema citations re-pointed — each cited line holds what its words name; :4254 kept; no status, beat or count moved', () => {
  const schema = code(SCHEMA).split('\n');
  const line = (n: number): string => schema[n - 1];
  const opening = (n: number): number => { let k = n - 1; while (!/^(enum|model) /.test(schema[k])) k -= 1; return k + 1; };
  const entry = (name: string) => {
    const t = TOOL_REGISTRY.find((x) => x.name === name);
    assert.ok(t, name);
    return t;
  };
  // Payments :300 — commission_ledger is the model at :1936 (it was :1399, dining_destinations.coworkingCount).
  assert.match(entry('Payments').citation, /commission_ledger \(schema:1936\) is a Travel byproduct/);
  assert.match(line(1936), /^model commission_ledger \{/);
  // Bill Pay's note :309 — the five bill columns sit at :4261-4265 (it was :4233); :316's :4254 was right and stays.
  assert.match(comments(REGISTRY), /The vendor directory's own bill columns are still written by nothing \(re-cited: schema:4261-4265\)\./);
  assert.deepEqual([4261, 4262, 4263, 4264, 4265].map((n) => line(n).trim().split(/\s+/)[0]), ['amount_usd', 'billing_rrule', 'next_due_date', 'last_paid_date', 'last_paid_amount_usd']);
  assert.equal(opening(4261), 4254);
  assert.match(line(4254), /^model operations_vendor_directory \{/);
  assert.match(entry('Bill Pay').citation, /operations_vendor_directory \(schema:4254\)/);
  // Sales Tax :479 — sales_tax_nexus is a value of the corpus enum PracticeArea at :2800 (it was :2201); the words claim an enum, not a model.
  assert.match(entry('Sales Tax').citation, /sales_tax_nexus \(schema:2800\) is a corpus enum/);
  assert.match(line(2800), /^\s+sales_tax_nexus$/);
  assert.equal(opening(2800), 2777);
  assert.match(line(2777), /^enum PracticeArea \{/);
  // Compliance :509 — compliance_tasks.attestation_status sits at :3390 (it was :2679-2682, trip_scanner_results).
  assert.match(entry('Compliance').citation, /attestation_status schema:3390 never written/);
  assert.match(line(3390), /^\s+attestation_status\s+AttestationStatus\b/);
  assert.match(line(opening(3390)), /^model compliance_tasks \{/);
  // The stale numbers are gone, each move carries its dated note, and nothing else moved.
  assert.doesNotMatch(code(REGISTRY), /schema:(1399|4233|2201|2679)\b/);
  assert.doesNotMatch(comments(REGISTRY), /schema:(1399|4233|2201|2679)\b/);
  const notes = comments(REGISTRY).match(/TRAVEL-02b-fix \(2026-11-03, ruling D\)/g);
  assert.ok(notes);
  assert.equal(notes.length, 4);
  assert.equal(entry('Payments').status, 'NOT_BUILT');
  assert.equal(entry('Sales Tax').status, 'NOT_BUILT');
  assert.equal(entry('Compliance').status, 'PARTIAL');
  assert.equal(entry('Bill Pay').status, 'PARTIAL');
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
});
