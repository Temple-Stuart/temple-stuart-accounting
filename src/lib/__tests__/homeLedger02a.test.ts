/**
 * HOME-LEDGER-02a (Alex, 2026-11-07) — the home's MONTH table: Budget's own report on /home on the day card's year
 * (ruling A), the trip budget lines under it, one row each, never summed (ruling B), the bank figure per currency
 * through ONE read for both pages (ruling C), the #1886 gap said (ruling D), the laws (ruling E). Every pin here finds
 * its line by content — no test pins a line number in a file this PR does not own (ruling F).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  MONTH_RULE_WORDS, NO_BOOK_STATED_WORDS, NO_CODE_WORDS, NO_TOTAL_WORDS, NOT_IN_CHART_WORDS, TRAVEL_PLAN_COLUMNS, TRAVEL_PLAN_CSV_FILE_NAME,
  TRAVEL_PLAN_HEAD_WORDS, TRAVEL_PLAN_HEADING, TRAVEL_PLAN_ROUTE, TRAVEL_PLAN_TABLE, TRIP_GONE_WORDS, TravelPlanError, YEAR_REQUIRED_WORDS,
  bookWordsOfCode, noLinesWords, travelPlanCellWords, travelPlanColumnOf, travelPlanCsv, travelPlanOf, travelPlanQuery, travelPlanReadOf,
  travelPlanRowsOf, travelPlanSortKey, tripBudgetCentsOf, tripBudgetWordsOf, yearNotAYearWords, type TravelPlanInput, type TravelPlanLineIn,
} from '../home/travelPlan';
import { HOME_LEDGER_MONTH_HEADING } from '../home/homeLedger';
import { BANK_ROW_LABEL, SUPERSEDED_GAP_WORDS, bankColumnWords, currencyNotStatedCountWords, notTotalledCountWords } from '../budget/reportView';
import { missingListWords } from '../reservations/travelLedger';
import { BLANK } from '../table/words';

const LEAF = 'src/lib/home/travelPlan.ts';
const ROUTE = 'src/app/api/home-travel-plan/route.ts';
const SCREEN = 'src/components/home/TravelPlan.tsx';
const HOST = 'src/components/home/HomeMonth.tsx';
const ANSWERS = 'src/components/answers/AnswersClient.tsx';
const REPORT = 'src/components/budget/BudgetReport.tsx';
const PAGE = 'src/app/budget/page.tsx';
const VIEW = 'src/lib/budget/reportView.ts';
const INPUTS = 'src/lib/budget/reportInputs.ts';
const READS = 'src/lib/budget/reportReads.ts';
const BR_ROUTE = 'src/app/api/budget/report/route.ts';
const HL_ROUTE = 'src/app/api/home-ledger/route.ts';
const LAWS = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/homeLedger02a.test.ts';

// ── THE FIXTURES (DO 2) ──────────────────────────────────────────────────────

const YEAR = '2026';
const line = (over: Partial<TravelPlanLineIn> & Pick<TravelPlanLineIn, 'id'>): TravelPlanLineIn => ({
  coaCode: 'P-9200', year: 2026, month: 3, amount: '300', description: 'HL-02 flights', tripId: 'trip-manila', tripName: 'HL-02 Manila', ...over,
});
const input = (over: Partial<TravelPlanInput> = {}): TravelPlanInput => ({
  year: YEAR,
  books: [{ id: 'ent-p', name: 'Personal', entityType: 'personal' }, { id: 'ent-b', name: 'Business', entityType: 'sole_prop' }],
  chart: [
    { entityId: 'ent-p', code: '9200', name: 'Travel', accountType: 'expense', balanceType: 'D' },
    { entityId: 'ent-b', code: '9200', name: 'Business travel', accountType: 'expense', balanceType: 'D' },
  ],
  lines: [
    line({ id: 'l-flights', amount: '300' }),
    line({ id: 'l-hotel', amount: '120.00', description: 'HL-02 hotel' }),
    line({ id: 'l-nocode', coaCode: '', amount: '50', description: 'HL-02 no code' }),
    line({ id: 'l-9300', coaCode: '9300', month: 4, amount: '80', description: null }),
    line({ id: 'l-gone', coaCode: 'P-9100', amount: '45.5', description: 'HL-02 trip gone', tripId: null, tripName: null }),
    line({ id: 'l-biz', coaCode: 'B-9200', month: 1, amount: '10', description: 'HL-02 business' }),
  ],
  ...over,
});
const rowOf = <R extends { readonly id: string }>(rows: readonly R[], id: string): R => {
  const row = rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no row ${id}`);
  return row;
};

// ── A · THE QUERY ────────────────────────────────────────────────────────────

test('A the query: year required, four digits, never defaulted — each refusal by name', () => {
  assert.deepEqual(travelPlanQuery(null), { ok: false, field: 'year', message: YEAR_REQUIRED_WORDS });
  assert.deepEqual(travelPlanQuery(''), { ok: false, field: 'year', message: YEAR_REQUIRED_WORDS });
  assert.deepEqual(travelPlanQuery('abcd'), { ok: false, field: 'year', message: yearNotAYearWords('abcd') });
  assert.equal(yearNotAYearWords('abcd'), 'year "abcd" is not a year (YYYY)');
  assert.deepEqual(travelPlanQuery('202'), { ok: false, field: 'year', message: 'year "202" is not a year (YYYY)' });
  assert.deepEqual(travelPlanQuery('0000'), { ok: false, field: 'year', message: 'year "0000" is not a year (YYYY)' });
  assert.deepEqual(travelPlanQuery('2026'), { ok: true, year: '2026' });
  assert.equal(YEAR_REQUIRED_WORDS, "year is required — the month table's year, YYYY");
});

// ── B · THE ROWS, NEVER SUMMED ───────────────────────────────────────────────

test('B one row per trip line, by month then id: two March lines on P-9200 stay two rows (300.00 and 120.00, never 420.00)', () => {
  const rows = travelPlanRowsOf(input());
  assert.deepEqual(rows.map((r) => r.id), ['l-biz', 'l-flights', 'l-gone', 'l-hotel', 'l-nocode', 'l-9300']);
  const flights = rowOf(rows, 'l-flights');
  assert.deepEqual(flights, {
    id: 'l-flights', month: '2026-03', source: 'trip', book: 'Personal', account: 'P-9200', accountName: 'Travel', description: 'HL-02 flights',
    trip: 'HL-02 Manila', tripBudgetCents: 30000, tripBudgetWords: '300.00 (currency not stated)',
  });
  assert.equal(rowOf(rows, 'l-hotel').tripBudgetWords, '120.00 (currency not stated)');
  // Nothing holds 420.00: not a row, not a field, not the CSV.
  assert.ok(!rows.some((r) => r.tripBudgetCents === 42000));
  assert.doesNotMatch(JSON.stringify(rows), /42000|420\.00/);
  assert.doesNotMatch(travelPlanCsv(rows), /420\.00/);
});

test('B the words: an empty code is "no code" · "no book stated" · "not in your chart" — never 9950; a bare 9300 states no book and is not in the chart; a null description is —; a gone trip is said', () => {
  const rows = travelPlanRowsOf(input());
  const nocode = rowOf(rows, 'l-nocode');
  assert.equal(nocode.account, NO_CODE_WORDS);
  assert.equal(nocode.book, NO_BOOK_STATED_WORDS);
  assert.equal(nocode.accountName, NOT_IN_CHART_WORDS);
  assert.doesNotMatch(JSON.stringify(rows), /9950/);
  const bare = rowOf(rows, 'l-9300');
  assert.deepEqual([bare.month, bare.account, bare.book, bare.accountName, bare.description], ['2026-04', '9300', NO_BOOK_STATED_WORDS, NOT_IN_CHART_WORDS, null]);
  assert.equal(travelPlanCellWords(bare, 'description'), BLANK);
  const gone = rowOf(rows, 'l-gone');
  assert.equal(gone.trip, TRIP_GONE_WORDS);
  assert.equal(gone.accountName, NOT_IN_CHART_WORDS, 'P-9100 is not in the fixture chart');
  assert.equal(gone.tripBudgetWords, '45.50 (currency not stated)');
  const biz = rowOf(rows, 'l-biz');
  assert.deepEqual([biz.book, biz.accountName, biz.month], ['Business', 'Business travel', '2026-01'], 'B-9200 names the sole_prop chart through the one scheme');
  assert.equal(NO_CODE_WORDS, 'no code');
  assert.equal(NO_BOOK_STATED_WORDS, 'no book stated');
  assert.equal(NOT_IN_CHART_WORDS, 'not in your chart');
  assert.equal(TRIP_GONE_WORDS, 'trip gone');
});

test('B BOOK from the letter through the one scheme: P · B · T; a letter no type draws, no letter, an empty code → no book stated', () => {
  assert.equal(bookWordsOfCode('P-9200'), 'Personal');
  assert.equal(bookWordsOfCode('B-5100'), 'Business');
  assert.equal(bookWordsOfCode('T-1200'), 'Trading');
  assert.equal(bookWordsOfCode('X-1'), NO_BOOK_STATED_WORDS);
  assert.equal(bookWordsOfCode('9300'), NO_BOOK_STATED_WORDS);
  assert.equal(bookWordsOfCode(''), NO_BOOK_STATED_WORDS);
  assert.equal(bookWordsOfCode('p-9200'), NO_BOOK_STATED_WORDS, 'the letter is upper case in the scheme');
});

test('B TRIP BUDGET: the Decimal text as cents with the point placed, the missing currency named, never a $; not whole cents refused by name', () => {
  assert.equal(tripBudgetCentsOf({ id: 'x', amount: '300' }), 30000);
  assert.equal(tripBudgetCentsOf({ id: 'x', amount: '120.5' }), 12050);
  assert.equal(tripBudgetCentsOf({ id: 'x', amount: '-3' }), -300);
  assert.equal(tripBudgetWordsOf(30000), '300.00 (currency not stated)');
  assert.doesNotMatch(tripBudgetWordsOf(123456), /\$/);
  assert.throws(() => tripBudgetCentsOf({ id: 'l-odd', amount: '12.345' }), (e: unknown) => e instanceof TravelPlanError && /trip budget line l-odd states "12\.345", which is not whole cents/.test(e.message));
  assert.throws(() => tripBudgetCentsOf({ id: 'l-words', amount: 'abc' }), TravelPlanError);
  assert.throws(() => travelPlanRowsOf(input({ lines: [line({ id: 'l-odd', amount: '0.001' })] })), /l-odd/);
});

test('B refused by name: a line of another year, a month outside 1..12, a chart row on no book of the viewer, a year that is not one', () => {
  assert.throws(() => travelPlanRowsOf(input({ lines: [line({ id: 'l-2025', year: 2025 })] })), /trip budget line l-2025 is in 2025, not the year 2026 asked for/);
  assert.throws(() => travelPlanRowsOf(input({ lines: [line({ id: 'l-m13', month: 13 })] })), /trip budget line l-m13 stores month 13, not 1 to 12/);
  assert.throws(() => travelPlanRowsOf(input({ chart: [{ entityId: 'ent-ghost', code: '9200', name: 'Ghost', accountType: 'expense', balanceType: 'D' }] })), /entity ent-ghost, which is not one of the viewer's books/);
  assert.throws(() => travelPlanRowsOf(input({ year: '26' })), /"26" is not a year/);
  assert.deepEqual(travelPlanOf(input({ lines: [] })), { year: '2026', rows: [] });
  assert.equal(noLinesWords('2026'), 'no trip budget line in 2026');
});

// ── C · THE TABLE ────────────────────────────────────────────────────────────

test('C the columns in Alex\'s order, their head words, the kinds, the sort keys, the CSV', () => {
  assert.deepEqual([...TRAVEL_PLAN_COLUMNS], ['month', 'source', 'book', 'account', 'accountName', 'description', 'trip', 'tripBudget', 'id']);
  assert.deepEqual(TRAVEL_PLAN_TABLE.map((c) => c.label), ['MONTH', 'SOURCE', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'DESCRIPTION', 'TRIP', 'TRIP BUDGET', 'ID']);
  assert.deepEqual(TRAVEL_PLAN_TABLE.map((c) => c.kind), ['value', 'value', 'value', 'value', 'value', 'text', 'value', 'value', 'text']);
  assert.equal(TRAVEL_PLAN_HEAD_WORDS.tripBudget, 'TRIP BUDGET');
  assert.equal(travelPlanColumnOf('tripBudget').kind, 'value', 'no money popover beside a figure whose currency nobody stated');
  const rows = travelPlanRowsOf(input());
  const flights = rowOf(rows, 'l-flights');
  assert.deepEqual(TRAVEL_PLAN_COLUMNS.map((c) => travelPlanCellWords(flights, c)), ['2026-03', 'trip', 'Personal', 'P-9200', 'Travel', 'HL-02 flights', 'HL-02 Manila', '300.00 (currency not stated)', 'l-flights']);
  assert.deepEqual(travelPlanSortKey(flights, 'tripBudget'), { kind: 'number', n: 30000 });
  assert.deepEqual(travelPlanSortKey(rowOf(rows, 'l-9300'), 'description'), null, 'a blank sorts last');
  assert.deepEqual(travelPlanSortKey(flights, 'month'), { kind: 'text', t: '2026-03' });
  const lines = travelPlanCsv(rows).split('\r\n');
  assert.equal(lines[0], 'MONTH,SOURCE,BOOK,ACCOUNT,ACCOUNT NAME,DESCRIPTION,TRIP,TRIP BUDGET,ID');
  assert.equal(lines.find((l) => l.endsWith(',l-flights')), '2026-03,trip,Personal,P-9200,Travel,HL-02 flights,HL-02 Manila,300.00 (currency not stated),l-flights');
  assert.equal(lines.find((l) => l.endsWith(',l-9300')), '2026-04,trip,no book stated,9300,not in your chart,,trip gone,80.00 (currency not stated),l-9300'.replace('trip gone', 'HL-02 Manila'));
  assert.equal(lines.find((l) => l.endsWith(',l-gone')), '2026-03,trip,Personal,P-9100,not in your chart,HL-02 trip gone,trip gone,45.50 (currency not stated),l-gone');
  assert.equal(lines.at(-1), '', 'the last line ends CRLF');
  assert.equal(TRAVEL_PLAN_CSV_FILE_NAME, 'travel-plan.csv');
});

// ── D · THE READ ─────────────────────────────────────────────────────────────

test('D the read: a 200 carries its rows list and its year, or fails by the one reader\'s words', () => {
  const answer = travelPlanOf(input());
  const read = travelPlanReadOf(JSON.parse(JSON.stringify(answer)));
  assert.equal(read.rows.length, 6);
  assert.equal(read.year, '2026');
  assert.throws(() => travelPlanReadOf({ year: '2026' }), new RegExp(missingListWords(TRAVEL_PLAN_ROUTE, 'rows').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.throws(() => travelPlanReadOf({ rows: [] }), /answered without its year/);
  assert.throws(() => travelPlanReadOf(null), /"rows" list/);
  assert.equal(TRAVEL_PLAN_ROUTE, '/api/home-travel-plan');
});

// ── E · THE ROUTE ────────────────────────────────────────────────────────────

test('E the route: GET only, the cart-plan gate first, the year refused by name, the caller\'s trip lines alone, the trip\'s name through the relation', () => {
  const route = code(ROUTE);
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.doesNotMatch(route, new RegExp(`export async function ${m}\\(`));
  const gateAt = route.indexOf('const userEmail = await getVerifiedEmail();');
  const userAt = route.indexOf('const user = await prisma.users.findFirst({');
  const queryAt = route.indexOf("travelPlanQuery(request.nextUrl.searchParams.get('year'))");
  assert.ok(gateAt > -1 && userAt > gateAt && queryAt > userAt, 'the cookie, then the user, then the query');
  assert.match(route, /return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(route, /return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\);/);
  assert.match(route, /if \(!query\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: query\.field, message: query\.message \}, \{ status: 400 \}\);/);
  assert.match(route, /where: \{ userId: user\.id, source: 'trip', year: Number\(year\) \}/);
  assert.match(route, /trip: \{ select: \{ name: true \} \}/);
  assert.match(route, /amount: l\.amount\.toString\(\),/, 'the Decimal travels as text');
  assert.match(route, /readBudgetChart\(prisma, user\.id, entityIds\)/);
  assert.match(route, /error instanceof TravelPlanError/);
  assert.doesNotMatch(route, /budget_line_items\.(create|update|delete|upsert)/, 'reads only');
  assert.doesNotMatch(code('src/middleware.ts'), /'\/api\/home-travel-plan'/, 'not public');
  assert.match(route, /export const dynamic = 'force-dynamic';/);
});

// ── F · THE SCREEN AND THE HOST ──────────────────────────────────────────────

test('F the travel plan screen: the year is a prop, one GET of the route, the one idiom, no foot, the two lines said once', () => {
  const screen = code(SCREEN);
  assert.match(screen, /export default function TravelPlan\(\{ year \}: \{ year: string \}\)/);
  assert.match(screen, /fetch\(`\$\{TRAVEL_PLAN_ROUTE\}\?\$\{new URLSearchParams\(\{ year \}\)\.toString\(\)\}`, \{ cache: 'no-store' \}\)/);
  assert.match(screen, /name="travel-plan"/);
  assert.match(screen, /columns=\{TRAVEL_PLAN_TABLE\}/);
  assert.match(screen, /foot=\{null\}/);
  assert.match(screen, /\{TRAVEL_PLAN_HEADING\}/);
  assert.match(screen, /\{NO_TOTAL_WORDS\}/);
  assert.match(screen, /\{MONTH_RULE_WORDS\}/);
  assert.match(screen, /const read = travelPlanReadOf\(data\);/);
  assert.doesNotMatch(screen, /useSearchParams|useRouter/, 'reads no URL — the host hands the year');
  assert.doesNotMatch(screen, /localStorage|sessionStorage|document\.cookie/);
  assert.equal(TRAVEL_PLAN_HEADING, 'TRAVEL PLAN · trip budget lines (not in Budget)');
  assert.equal(NO_TOTAL_WORDS, 'no total — a trip budget line states no currency (FX-00), so no figure here is added to another, not even two lines of one month on one code');
  assert.equal(MONTH_RULE_WORDS, 'MONTH as the line stores it — a trip budget line carries no day');
});

test('F the host: the heading constant, the card\'s own day, its year to Budget\'s report with no step, the travel plan under it; mounted on /home once between the day table and the sheet', () => {
  const host = code(HOST);
  assert.equal(HOME_LEDGER_MONTH_HEADING, 'HOME LEDGER · MONTH');
  assert.match(code('src/lib/home/homeLedger.ts'), /export const HOME_LEDGER_MONTH_HEADING = 'HOME LEDGER · MONTH';/);
  assert.match(host, /\{HOME_LEDGER_MONTH_HEADING\}/);
  assert.ok(host.includes('const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;'), 'the day card\'s own expression');
  assert.ok(host.includes("const year = day === null ? null : day.slice(0, 4);"));
  assert.match(host, /useEffect\(\(\) => \{\s*setToday\(localToday\(\)\);\s*\}, \[\]\);/, 'today on mount, never in the server render');
  const headingAt = host.indexOf('{HOME_LEDGER_MONTH_HEADING}');
  const reportAt = host.indexOf("<BudgetReport year={{ from: 'host', year }} />");
  const planAt = host.indexOf('<TravelPlan year={year} />');
  assert.ok(headingAt > -1 && reportAt > headingAt && planAt > reportAt, 'heading → the report → the travel plan');
  assert.equal((host.match(/<BudgetReport\b/g) ?? []).length, 1, 'Budget\'s own component, once — never a second model');
  assert.doesNotMatch(host, /search\.get\('year'\)|\?year=|yearHref|stepYear|router\./, 'no year of its own, no step');
  assert.equal((host.match(/\bsearch\.get\(/g) ?? []).length, 1, 'the URL is read once: ?date=');
  const answers = code(ANSWERS);
  assert.match(answers, /import HomeMonth from '@\/components\/home\/HomeMonth';/);
  assert.equal((answers.match(/<HomeMonth \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(answers, /<div className="mt-5 sm:mt-6" data-home-month-table>\n\s*<Suspense>\n\s*<HomeMonth \/>\n\s*<\/Suspense>\n\s*<\/div>/, 'the boundary');
  const at = (s: string) => answers.indexOf(s);
  assert.ok(at('data-answers') > -1 && at('data-net-worth') > at('data-answers') && at('<DayCard />') > at('data-net-worth') && at('<HomeLedger />') > at('<DayCard />') && at('<HomeMonth />') > at('<HomeLedger />') && at('<TheSheet />') > at('<HomeMonth />'), 'the four answers → Net worth → the day card → the home ledger → the month host → the sheet');
  assert.match(comments(ANSWERS), /HOME-LEDGER-02a \(Alex, 2026-11-07, ruling A\): HOME LEDGER · MONTH/);
});

// ── G · BUDGET'S OWN REPORT: THE YEAR PROP, THE BANK ROW, THE GAP ────────────

test('G BudgetReport takes the one required year prop — { from: \'url\' } on /budget with the ‹ › step, { from: \'host\', year } on /home with none', () => {
  const report = code(REPORT);
  assert.match(report, /export type BudgetYearSource = \{ readonly from: 'url' \} \| \{ readonly from: 'host'; readonly year: string \};/);
  assert.match(report, /export default function BudgetReport\(\{ year: source \}: \{ year: BudgetYearSource \}\)/);
  assert.match(report, /const year = asOf === null \? null : source\.from === 'url' \? yearOf\(new URLSearchParams\(search\.toString\(\)\), asOf\) : source\.year;/);
  assert.match(report, /\{source\.from === 'url' \? \(/, 'the step only from the URL');
  assert.equal((report.match(/router\.push\(/g) ?? []).length, 2, 'the year, back and forward — no other navigation');
  assert.doesNotMatch(report, /year\?: BudgetYearSource|source\?\.|source\.from === 'url' \?\?|from: 'url' \} \| undefined/, 'nothing optional, nothing defaulted');
  assert.match(code(PAGE), /<BudgetReport year=\{\{ from: 'url' \}\} \/>/);
  assert.match(code(HOST), /<BudgetReport year=\{\{ from: 'host', year \}\} \/>/);
  assert.doesNotMatch(code('src/components/workbench/operations/day/dayCard.ts'), /HomeMonth|BudgetReport|travel plan/i, 'dayCard.ts is not touched');
});

test('G the BANK row: per currency through the books\' one bank formatter, a count for the unstated, blank for a future column; under the book tables; then the gap line', () => {
  assert.equal(BANK_ROW_LABEL, 'BANK — not yet in the books');
  assert.equal(bankColumnWords({ bankByCode: null, currencyNotStated: null }), BLANK, 'a future column');
  assert.equal(bankColumnWords({ bankByCode: [], currencyNotStated: 0 }), BLANK, 'no whole-cent row');
  assert.equal(bankColumnWords({ bankByCode: [{ code: 'USD', cents: 4210, rows: 1 }], currencyNotStated: 0 }), '$42.10');
  assert.equal(bankColumnWords({ bankByCode: [{ code: 'THB', cents: 120000, rows: 1 }, { code: 'USD', cents: 4210, rows: 1 }], currencyNotStated: 1 }), '1200.00 THB · $42.10 · 1 currency not stated');
  assert.equal(bankColumnWords({ bankByCode: [], currencyNotStated: 2 }), '2 currency not stated');
  assert.equal(currencyNotStatedCountWords(1), '1 currency not stated');
  assert.equal(notTotalledCountWords(1), '1 bank row not totalled (not whole cents)');
  assert.equal(notTotalledCountWords(2), '2 bank rows not totalled (not whole cents)');
  const view = code(VIEW);
  assert.match(view, /import \{ CURRENCY_NOT_STATED_WORDS, NOT_WHOLE_CENTS_WORDS, bankCentsWords \} from '@\/lib\/books\/functionalCurrency';/);
  assert.match(view, /const parts = column\.bankByCode\.map\(\(c\) => bankCentsWords\(c\.cents, c\.code\)\);/);
  assert.doesNotMatch(view, /\$\$\{|>\$<|['"]USD['"]|Intl\.NumberFormat/, 'no figure worded here but through the home');
  const report = code(REPORT);
  const tablesAt = report.lastIndexOf('<BookTable ');
  const bankAt = report.indexOf('<BankRow columns={report.columns} notInBooks={notInBooks} />');
  const gapAt = report.indexOf('{SUPERSEDED_GAP_WORDS}');
  assert.ok(tablesAt > -1 && bankAt > tablesAt && gapAt > bankAt, 'the book tables, then the BANK row, then the gap');
  assert.match(report, /\{bankColumnWords\(c\)\}/);
  assert.match(report, /data-budget-bank-cell=\{c\.key\}/);
  assert.match(report, /\{BANK_ROW_LABEL\}/);
  assert.doesNotMatch(report, /bankCents\b/, 'the one sum across currencies is gone');
  assert.doesNotMatch(report, /notInBooks\.columns\.map\([^)]*\+/, 'nothing added to an actual');
});

test('G the gap, said on both pages — the constant in the view helper, printed under the tables', () => {
  assert.equal(SUPERSEDED_GAP_WORDS, 'Budget counts every routine occurrence; the day card leaves out the ones superseded by travel — this table does not yet (SUPERSEDE-01)');
  assert.match(code(VIEW), /export const SUPERSEDED_GAP_WORDS = 'Budget counts every routine occurrence; the day card leaves out the ones superseded by travel — this table does not yet \(SUPERSEDE-01\)';/);
  assert.match(code(REPORT), /<p className="text-xs text-text-muted" data-budget-superseded-gap>\{SUPERSEDED_GAP_WORDS\}<\/p>/);
});

// ── H · THE ONE BANK READ ────────────────────────────────────────────────────

test('H the bank rows not yet in the books are ONE read in the budget\'s loader, called by both routes; the model carries the figures per code', () => {
  const reads = code(READS);
  assert.equal((reads.match(/transactions\.findMany\(/g) ?? []).length, 1);
  assert.match(reads, /export function readBankNotInBooks\(db: Db, userId: string, from: string, through: string\) \{\n  return db\.transactions\.findMany\(\{\n    where: \{ accounts: \{ userId \}, review_status: \{ not: 'committed' \}, date: \{ gte: dayStart\(from\), lte: new Date\(`\$\{through\}T23:59:59\.999Z`\) \} \},\n    select: \{ id: true, date: true, amount: true, name: true, merchantName: true, review_status: true, accounts: \{ select: \{ isoCurrencyCode: true \} \} \},/);
  assert.match(reads, /type Db = Pick<PrismaClient, 'chart_of_accounts' \| 'operations_project_tasks' \| 'ledger_entries' \| 'planned_item_vendors' \| 'transactions'>;/);
  for (const f of [BR_ROUTE, HL_ROUTE]) {
    assert.doesNotMatch(code(f), /transactions\.findMany/, `${f} reads no transactions itself`);
    assert.match(code(f), /readBankNotInBooks\(prisma, user\.id, /, `${f} calls the one read`);
  }
  assert.match(code(BR_ROUTE), /readBankNotInBooks\(prisma, user\.id, rangeFrom, through\),/);
  assert.match(code(BR_ROUTE), /const bank = bankRows\.map\(\(t\) => \(\{ id: t\.id, date: t\.date, amount: t\.amount, currency: t\.accounts\.isoCurrencyCode \}\)\);/);
  assert.match(code(HL_ROUTE), /readBankNotInBooks\(prisma, user\.id, date, date\),/);
  const inputs = code(INPUTS);
  assert.match(inputs, /readonly currency: string \| null;/);
  assert.match(inputs, /readonly bankByCode: readonly BankCodeCents\[\] \| null;/);
  assert.match(inputs, /readonly currencyNotStated: number \| null;/);
  assert.doesNotMatch(inputs, /bankCents\b/);
  assert.match(inputs, /if \(r\.code === null\) \{ currencyNotStated \+= 1; continue; \}/, 'an unstated row is counted, never summed');
  assert.match(inputs, /code: row\.currency === null \? null : row\.currency\.toUpperCase\(\)/);
});

// ── I · THE LAWS ─────────────────────────────────────────────────────────────

test('I the home month law stands at the end of the laws script, after the home ledger law, above the second gate; the lane names both screens', () => {
  const laws = code(LAWS);
  const ledgerAt = laws.indexOf("lawGuard('The home ledger law', () => {");
  const monthAt = laws.indexOf("lawGuard('The home month law', () => {");
  const gateAt = laws.indexOf('if (violations.length > raised) {');
  assert.ok(ledgerAt > -1 && monthAt > ledgerAt && gateAt > monthAt, 'appended at the END, never above an existing law');
  // CRM-02 (2026-11-07): the intake form law was added at the END, after this one — a new law check goes at the END (the CRM-02 ruling); the month law still stands after the ledger law, above the second gate.
  assert.equal(laws.slice(monthAt).match(/lawGuard\(/g)?.length, 2, 'the last but one — the intake form law (CRM-02) stands after it');
  assert.ok(laws.indexOf("lawGuard('The intake form law', () => {") > monthAt, 'the intake form law after the month law');
  for (const piece of [
    "const HM_HOST = 'src/components/home/HomeMonth.tsx';",
    "const TP_ROUTE = 'src/app/api/home-travel-plan/route.ts';",
    "const TP_LEAF = 'src/lib/home/travelPlan.ts';",
    "const TP_SCREEN = 'src/components/home/TravelPlan.tsx';",
    'monthAt > ledgerAt && sheetAt > monthAt',
    "if (!/where: \\{ userId: user\\.id, source: 'trip', year: Number\\(year\\) \\}/.test(tpRoute))",
    "if (/\\|\\|/.test(body)) hmFail(`${f} holds a \\`||\\` — nothing is defaulted in silence`);",
    "if (/9950/.test(body)) hmFail(",
    "if (/\\+=|\\.reduce\\(|tripBudgetCents\\s*\\+|\\+\\s*\\w*\\.?tripBudgetCents/.test(body)) hmFail(",
    "if ((reads.match(/transactions\\.findMany\\(/g) ?? []).length !== 1) hmFail(",
    "if (/transactions\\.findMany/.test(codeOf(f))) hmFail(`${f} reads transactions itself",
    "if (!/export type BudgetYearSource = \\{ readonly from: 'url' \\} \\| \\{ readonly from: 'host'; readonly year: string \\};/.test(hmReport))",
    "if (!/\\{source\\.from === 'url' \\? \\(/.test(hmReport)) hmFail(",
    "if (!/<BudgetReport year=\\{\\{ from: 'url' \\}\\} \\/>/.test(codeOf(HM_PAGE)))",
    'const bankAt = hmReport.indexOf(\'<BankRow columns={report.columns} notInBooks={notInBooks} />\');',
    "if (!/export const SUPERSEDED_GAP_WORDS = 'Budget counts every routine occurrence;",
  ]) assert.ok(laws.includes(piece), `the law holds: ${piece}`);
  assert.match(laws, /const FX_LANE_FILES = \['src\/components\/home\/HomeLedger\.tsx', 'src\/components\/home\/HomeMonth\.tsx', 'src\/components\/home\/TravelPlan\.tsx'\];/);
  assert.match(laws, /✔ The home month law passed/);
});

// ── J · THE DOES-NOTS ────────────────────────────────────────────────────────

test('J the does-nots: no $ outside the currency home\'s formatters, no ||, no ?? <default>, no USD literal, no 9950, no sum in the leaf or the screen; the leaf pure; nothing retired', () => {
  for (const f of [LEAF, ROUTE, SCREEN, HOST]) {
    const body = code(f);
    assert.doesNotMatch(body, /\$(?!\{)/, `${f}: a $ outside the formatters`);
    assert.doesNotMatch(body, /\|\|/, `${f}: a ||`);
    assert.doesNotMatch(body, /\?\? /, `${f}: a ?? <default>`);
    assert.doesNotMatch(body, /['"]USD['"]/, `${f}: a 'USD' literal`);
    assert.doesNotMatch(body, /Intl\.NumberFormat/, `${f}: Intl.NumberFormat`);
    assert.doesNotMatch(body, /9950/, `${f}: 9950`);
  }
  for (const f of [LEAF, SCREEN]) assert.doesNotMatch(code(f), /\+=|\.reduce\(|tripBudgetCents\s*\+|\+\s*\w*\.?tripBudgetCents/, `${f} sums`);
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /@prisma\/client|from 'next|from 'react|\bfetch\s*\(|Date\.now\(|new Date\(\)|process\.env/, 'the leaf is pure');
  // Nothing in the other lane (ruling G, H). HOME-LEDGER-02b (Alex, 2026-11-07): the two tables 02a left standing for 02b to retire
  // are retired — HubBudgetSection and BudgetComparison are gone (homeLedger02b.test.ts pins the nine absences); RunwayBudgetPanel
  // stands, the burn hero alone.
  for (const f of ['src/components/hub/HubBudgetSection.tsx', 'src/components/hub/BudgetComparison.tsx']) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} retired with 02b`);
  assert.ok(code('src/components/hub/RunwayBudgetPanel.tsx').length > 0, 'RunwayBudgetPanel still stands — the burn hero');
  // SERVICES-01 (2026-11-08): src/lib/offer/closeWords.ts retired with the close — it left this list; nothing of it remains to read.
  for (const f of ['src/lib/toolRegistry.ts', 'src/lib/nav.ts', 'src/lib/offer.ts', 'src/lib/shellMenu.ts']) assert.doesNotMatch(code(f), /HomeMonth|home-travel-plan|HOME-LEDGER-02a/, `${f} is CRM-01a's lane — untouched`);
  assert.ok(!existsSync(resolve(process.cwd(), 'src/lib/offer/closeWords.ts')), 'closeWords.ts retired (SERVICES-01)');
  assert.doesNotMatch(code('src/lib/budget/reportInputs.ts'), /budget_line_items|travelPlan/, 'Budget reads no trip line');
});

// ── K · THIS TEST ────────────────────────────────────────────────────────────

test('K this test pins no line number of any file — every pin finds its line by content', () => {
  const me = code(THIS);
  assert.doesNotMatch(me, /\.tsx?:\d+/, 'a file:line pin');
  assert.doesNotMatch(me, /\.ts', \d+\)|lines\[\d{2,}\]|slice\(\d{2,}, \d{2,}\)/, 'a line-number read');
});
