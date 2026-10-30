/**
 * FX-01b (Alex, 2026-10-30, rulings A–C) — THE BOOKS LANE IS WHAT BooksPipeline MOUNTS; THE MATCHER'S RATIONALE
 * SPEAKS THE ACCOUNT'S CURRENCY; THE CURRENCY LIST IS THE RUNTIME'S.
 *
 * The derivation is run over BooksPipeline's real source and over a mutated one; the law's text is read for the
 * derivation call; every derived file is scanned with the law's own shapes; the matcher is run over fixtures in
 * USD, in PHP and with a NULL account; the form's source is read and the runtime's list is read here, in Node.
 * Source is read through code() / comments() (the reader law); no render, no database, no network, no clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { booksLaneImports } from '../books/booksLane';
import { ISO_4217_CODE, runtimeCurrencyCodes } from '../books/functionalCurrency';
import { proposeMatches } from '../runway/reservationMatcher';

const PIPE = 'src/components/home/BooksPipeline.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const HOME = 'src/lib/books/functionalCurrency.ts';
const FORM = 'src/components/ManualTransactionForm.tsx';
const MATCHER = 'src/lib/runway/reservationMatcher.ts';
const ROUTE = 'src/app/api/transactions/manual/route.ts';
const ROOT = process.cwd();

/**
 * FACT 1, re-verified on main d78527b6 (2026-10-30): BooksPipeline's '@/components/…' imports in import order —
 * the chat's twenty plus bank/useBankConnection (BooksPipeline.tsx :38), which the chat's list missed.
 */
const EXPECTED = [
  'src/components/bookkeeping/BookkeepingSection', 'src/components/dashboard/BankReconciliation', 'src/components/books/EntitySetup',
  'src/components/dashboard/SpendingTab', 'src/components/dashboard/InvestmentsTab', 'src/components/dashboard/JournalEntryEngine',
  'src/components/dashboard/GeneralLedger', 'src/components/shell/RoomLock', 'src/components/bookkeeping/TrialBalanceSection',
  'src/components/dashboard/AdjustingEntriesTab', 'src/components/dashboard/FinancialStatementsTab', 'src/components/dashboard/WashSaleReportTab',
  'src/components/dashboard/PeriodClose', 'src/components/dashboard/CloseBooksTab', 'src/components/dashboard/PositionReportTab',
  'src/components/dashboard/CPAExport', 'src/components/ui/StageStrip', 'src/components/bank/useBankConnection',
  'src/components/ui/SectionHeader', 'src/components/ui/ProofStrip', 'src/components/ManualTransactionForm',
];
/** The five that still printed a literal `$` on main after #1878 (FACT 1's counts: 7, 4, 3, 3, 2). */
const FIVE = {
  statements: 'src/components/dashboard/FinancialStatementsTab.tsx',
  positions: 'src/components/dashboard/PositionReportTab.tsx',
  washSales: 'src/components/dashboard/WashSaleReportTab.tsx',
  closeBooks: 'src/components/dashboard/CloseBooksTab.tsx',
  spending: 'src/components/dashboard/SpendingTab.tsx',
};

/** The law's eight shapes, verbatim (fx01.test.ts holds the same list against the law's text). */
const SHAPES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: '$${', re: /\$\$\{/ },
  { name: "'$' +", re: /['"]\$['"]\s*\+/ },
  { name: '>$<', re: />\$</ },
  { name: 'JSX text $ {', re: />\s*\$\s*\{/ },
  { name: "currency: 'USD'", re: /currency:\s*['"]USD['"]/ },
  { name: "'USD' literal", re: /['"]USD['"]/ },
  { name: 'Intl.NumberFormat', re: /Intl\.NumberFormat/ },
  { name: 'fmt*/format*Money|Dollars|Cents', re: /\b(?:fmt|format)\w*(?:Money|Dollars|Cents)\b/ },
];

function resolved(p: string): string {
  const f = [`${p}.tsx`, `${p}.ts`, `${p}/index.tsx`, `${p}/index.ts`].find((c) => existsSync(resolve(ROOT, c)));
  assert.ok(f !== undefined, `${p} resolves to a file`);
  return f!;
}

// ─── A. the lane is derived ──────────────────────────────────────────────────

test('A booksLaneImports over BooksPipeline (comments stripped) is FACT 1’s list, in import order, each file once — a type import of a file already imported adds nothing', () => {
  assert.deepEqual(booksLaneImports(code(PIPE)), EXPECTED);
  assert.equal(new Set(EXPECTED).size, EXPECTED.length);
  assert.ok(/import type \{ ReconciliationSave, SaveAnswer \} from '@\/components\/dashboard\/BankReconciliation';/.test(code(PIPE)), 'the type import is there (:6) and counted once with :17');
});

test('A a component added to BooksPipeline’s imports joins the lane with no law change; quotes and type imports alike; nothing outside @/components', () => {
  assert.deepEqual(booksLaneImports(`${code(PIPE)}\nimport NewTab from '@/components/dashboard/NewTab';\n`), [...EXPECTED, 'src/components/dashboard/NewTab']);
  assert.deepEqual(
    booksLaneImports("import type { A } from '@/components/a/A';\nimport B from \"@/components/b/B\";\nimport { A2 } from '@/components/a/A';"),
    ['src/components/a/A', 'src/components/b/B'],
  );
  assert.deepEqual(booksLaneImports("import x from '@/lib/x';\nimport y from './y';"), []);
  // The function reads TEXT: the law hands it code(), with comments stripped, so a comment's mention is not a mount.
  assert.deepEqual(booksLaneImports("// import Ghost from '@/components/ghost/Ghost';"), ['src/components/ghost/Ghost']);
  assert.deepEqual(booksLaneImports(''), []);
  assert.ok(comments('src/lib/books/booksLane.ts').includes('THIS FILE IS PURE'));
});

test('A the law derives the lane from BooksPipeline’s imports (comments stripped), resolves each file, fails by name on one no file answers to, keeps the seven directories and an EMPTY allowlist; FX-01’s hand-kept component list is gone', () => {
  const law = code(LAW);
  assert.match(law, /import \{ booksLaneImports \} from '\.\.\/src\/lib\/books\/booksLane';/);
  assert.match(law, /const FX_PIPE = 'src\/components\/home\/BooksPipeline\.tsx';/);
  assert.match(law, /const imports = booksLaneImports\(codeOf\(FX_PIPE\)\);/, 'comments stripped before the derivation');
  assert.match(law, /if \(imports\.length === 0\) fxFail\(/);
  assert.match(law, /\[`\$\{p\}\.tsx`, `\$\{p\}\.ts`, `\$\{p\}\/index\.tsx`, `\$\{p\}\/index\.ts`\]\.find\(\(c\) => existsSync\(resolve\(ROOT, c\)\)\)/);
  assert.match(law, /fxFail\(`\$\{FX_PIPE\} imports '\$\{p\}' and no \.tsx, \.ts or index file answers to it`\)/);
  assert.match(law, /const FX_LANE_COMPONENTS = fxLaneComponents\(\);/);
  assert.doesNotMatch(law, /const FX_LANE_COMPONENTS = \[/, 'no hand-kept component list');
  assert.match(law, /const FX_LANE_DIRS = \['src\/lib\/books', 'src\/app\/api\/trial-balance', 'src\/app\/api\/journal-entries', 'src\/app\/api\/bank-reconciliations', 'src\/app\/api\/books', 'src\/app\/api\/journal-transactions', 'src\/app\/api\/ledger'\];/);
  assert.match(law, /const FX_ALLOW: ReadonlyArray<\{ file: string; snippet: string; dated: string; reason: string \}> = \[\];/, 'EMPTY');
  assert.match(law, /derived from the imports of \$\{FX_PIPE\}/);
  // The activity law blanks the law's single-quoted strings to find a stray seal call: no apostrophe in this law's own code
  // may stand unpaired (one did, in the first draft of its ✔ line, and un-blanked a 'sealOf(' two thousand lines below).
  const booksLaw = law.slice(law.indexOf("lawGuard('The books currency law'"), law.indexOf("lawGuard('The lines law'"));
  assert.equal((booksLaw.match(/'/g) ?? []).length % 2, 0, 'the single quotes in the books currency law pair up');
});

test('A every derived file — BooksPipeline and its twenty-one imports — holds none of the eight shapes (comments stripped); the five converted screens read the home and keep no local formatter', () => {
  const files = [PIPE, ...EXPECTED.map(resolved)];
  assert.equal(files.length, 22);
  const hits: string[] = [];
  for (const f of files) for (const [i, line] of code(f).split('\n').entries()) for (const s of SHAPES) if (s.re.test(line)) hits.push(`${f}:${i + 1} ${s.name}: ${line.trim().slice(0, 80)}`);
  assert.deepEqual(hits, []);
  for (const f of Object.values(FIVE)) {
    assert.match(code(f), /from '@\/lib\/books\/functionalCurrency'/, `${f} reads the home`);
    assert.match(code(f), /functionalMoneyWords\(|bankMoneyWords\(/, `${f} writes through the one formatter`);
    assert.doesNotMatch(code(f), /const fmt = \(val: number\)|const formatCents = |function formatMoney\(/, `${f} keeps no local formatter`);
  }
  // The statements: integer cents in, cents kept, nothing divided into dollars; the dead dollars branch is gone.
  const statements = code(FIVE.statements);
  assert.doesNotMatch(statements, /\/ 100\b|toFixed\(2\)\}/);
  assert.match(statements, /const net = \(acct\.debits \|\| 0\) - \(acct\.credits \|\| 0\);/);
  assert.match(statements, /const isBalanced = balanceSheet\.assetsCents - liabilitiesPlusEquityCents === 0;/);
  assert.match(statements, /Balance Check: Assets = \{functionalMoneyWords\(balanceSheet\.assetsCents\)\}/);
  assert.doesNotMatch(statements, /statements\.incomeStatement && statements\.balanceSheet/);
  assert.match(statements, /data-functional-currency>\{FUNCTIONAL_CURRENCY_WORDS\}/);
  // The close: the GL's cents through the one formatter, on the screen and in the alert.
  const close = code(FIVE.closeBooks);
  assert.match(close, /\{status\.netIncome === null \? '—' : functionalMoneyWords\(status\.netIncome\)\}/);
  assert.match(close, /`Net Income: \$\{functionalMoneyWords\(result\.netIncome\)\} \(\$\{FUNCTIONAL_CURRENCY_WORDS\}\)\\n`/);
  assert.doesNotMatch(close, /\/ 100\b|formatCents/);
  // The position report and the wash-sale report: every figure through bankMoneyWords in the functional currency.
  const positions = code(FIVE.positions);
  assert.equal((positions.match(/bankMoneyWords\(/g) ?? []).length, 24, '21 P&L figures + two strikes + an average cost');
  assert.match(positions, /\{bankMoneyWords\(p\.strike, FUNCTIONAL_CURRENCY\)\}/);
  assert.match(positions, /\{bankMoneyWords\(p\.avgCostPerShare, FUNCTIONAL_CURRENCY\)\}/);
  assert.doesNotMatch(positions, /strike\?\.toFixed|avgCostPerShare\.toFixed/);
  assert.ok(comments(FIVE.positions).includes('by construction'));
  const wash = code(FIVE.washSales);
  assert.equal((wash.match(/bankMoneyWords\(/g) ?? []).length, 8);
  assert.ok(comments(FIVE.washSales).includes('IRS Publication 550'));
  // Spending: a bank row prints in its ACCOUNT's currency; the selection total is cents over functional-currency rows, the rest counted out by name.
  const spending = code(FIVE.spending);
  assert.match(spending, /\n  currency: string \| null;\n/);
  assert.match(spending, /\{txn\.amount > 0 \? '-' : '\+'\}\{bankMoneyWords\(Math\.abs\(txn\.amount\), txn\.currency\)\}/);
  assert.match(spending, /if \(t\.currency === null \|\| t\.currency\.toUpperCase\(\) !== FUNCTIONAL_CURRENCY \|\| !isWholeCents\(abs\)\) \{ countedOut \+= 1; continue; \}/);
  assert.match(spending, /cents \+= centsOfTypedDollars\(String\(abs\)\);/);
  assert.match(spending, /\(\{functionalMoneyWords\(selectedPendingTotal\.cents\)\}\{selectedPendingTotal\.countedOut > 0 \? ` · \$\{selectedPendingTotal\.countedOut\} not in \$\{FUNCTIONAL_CURRENCY\} or not whole cents, counted out` : ''\}\)/);
  assert.match(spending, /case 'amountRange': return \[filter\.min, filter\.max\]\.filter\(Boolean\)\.join\(' – '\);/);
  assert.doesNotMatch(spending, /formatMoney|selectedPendingAmount|Min \(\$\)|Max \(\$\)/);
  assert.match(code('src/app/api/transactions/route.ts'), /currency: txn\.accounts\?\.isoCurrencyCode \?\? null,/, 'the row’s currency comes from the account, as FX-01 left it');
});

// ─── B. the matcher's rationale ──────────────────────────────────────────────

test('B the rationale speaks the account’s currency: USD → the one formatter on both figures; PHP → each figure with its code; a bank figure that is not whole cents named; NULL and cross-currency excluded by name as before', () => {
  const opts = { amountTolerancePct: 0.05, dateWindowDays: 3 };
  const usdRes = { id: 'r1', finalPriceCents: 123456, currency: 'USD', provider: 'liteapi', hotelName: null, createdAt: '2026-09-20' };
  const usdTxn = { id: 't1', amount: 1234.56, date: '2026-09-20', name: 'NUITEE HOTEL', pending: false };
  const [usd] = proposeMatches({ reservations: [usdRes], transactions: [usdTxn], accountCurrency: 'USD', opts });
  assert.match(usd.rationale, /amount: \$1,234\.56 vs booked \$1,234\.56 \(drift 0\.0% ≤ 5\.0% tolerance\)/, 'USD: the one formatter, with its grouping');
  const phpRes = { ...usdRes, id: 'r2', finalPriceCents: 200000, currency: 'PHP' };
  const phpTxn = { ...usdTxn, id: 't2', amount: 2000 };
  const [php] = proposeMatches({ reservations: [phpRes], transactions: [phpTxn], accountCurrency: 'PHP', opts });
  assert.match(php.rationale, /amount: 2000\.00 PHP vs booked 2000\.00 PHP \(drift 0\.0% ≤ 5\.0% tolerance\)/);
  assert.doesNotMatch(php.rationale, /\$/, 'no $ on a figure that is not dollars');
  const [lower] = proposeMatches({ reservations: [phpRes], transactions: [phpTxn], accountCurrency: 'php', opts });
  assert.match(lower.rationale, /amount: 2000\.00 PHP vs booked 2000\.00 PHP/, 'case is not a difference');
  const [odd] = proposeMatches({ reservations: [usdRes], transactions: [{ ...usdTxn, amount: 1234.555 }], accountCurrency: 'USD', opts });
  assert.match(odd.rationale, /amount: 1234\.555 USD \(not whole cents\) vs booked \$1,234\.56/, 'named, never rounded');
  const [nulled] = proposeMatches({ reservations: [usdRes], transactions: [usdTxn], accountCurrency: null, opts });
  assert.match(nulled.rationale, /amount: EXCLUDED — the account currency is not stated \(accounts\.isoCurrencyCode NULL\); date \+ descriptor carry this proposal/);
  assert.doesNotMatch(nulled.rationale, /vs booked/);
  const [cross] = proposeMatches({ reservations: [phpRes], transactions: [phpTxn], accountCurrency: 'USD', opts });
  assert.match(cross.rationale, /amount: EXCLUDED — reservation currency PHP ≠ account USD \(never converted by guess\)/);
  // The source: the charge pass writes no `$` before a figure; the booked helper names the functional currency by the constant.
  const src = code(MATCHER);
  const chargePass = src.slice(0, src.indexOf('export const MATCH_REFUND_DATE_WINDOW_DAYS'));
  assert.doesNotMatch(chargePass, /\$\$\{|toFixed\(2\)\} vs booked/);
  assert.match(src, /import \{ FUNCTIONAL_CURRENCY, bankMoneyWords, decimalStringOfCents, functionalMoneyWords \} from '\.\.\/books\/functionalCurrency';/);
  assert.match(src, /`amount: \$\{bankMoneyWords\(t\.amount, account\)\} vs booked \$\{bookedMoneyWords\(r\.finalPriceCents!, r\.currency\)\} ` \+/);
  assert.match(src, /return upper === FUNCTIONAL_CURRENCY \? functionalMoneyWords\(cents\) : `\$\{decimalStringOfCents\(cents\)\} \$\{upper\}`;/);
  assert.ok(comments(MATCHER).includes("THE RATIONALE'S CURRENCY (FX-01b"));
});

// ─── C. the currency list is the runtime's ───────────────────────────────────

test('C runtimeCurrencyCodes reads Intl.supportedValuesOf(\'currency\') when called; every code is an ISO 4217 code under the route’s own rule; the rule is stated once in the home and unchanged in the route', () => {
  const list = runtimeCurrencyCodes();
  assert.ok(list !== null, 'this Node has Intl.supportedValuesOf');
  assert.ok(list!.length > 100, `the runtime lists ${list!.length} currencies`);
  for (const c of list!) assert.match(c, ISO_4217_CODE);
  assert.ok(list!.includes('USD') && list!.includes('PHP') && list!.includes('THB'));
  assert.equal(ISO_4217_CODE.source, '^[A-Z]{3}$');
  assert.ok(code(ROUTE).includes('const ISO_4217 = /^[A-Z]{3}$/;'), 'the route’s rule, unchanged');
  const home = code(HOME);
  assert.match(home, /export const ISO_4217_CODE = \/\^\[A-Z\]\{3\}\$\/;/);
  assert.match(home, /export function runtimeCurrencyCodes\(\): readonly string\[\] \| null \{/);
  assert.match(home, /return typeof intl\.supportedValuesOf === 'function' \? intl\.supportedValuesOf\('currency'\) : null;/);
  assert.ok(comments(HOME).includes('THE CURRENCY CODE (FX-01b'));
});

test('C the form offers the runtime’s list, read at render, with nothing preselected — or a typed three-letter field under the same rule when the runtime has none; the hand-picked twenty are gone', () => {
  const form = code(FORM);
  assert.match(form, /import \{ ISO_4217_CODE, runtimeCurrencyCodes \} from '@\/lib\/books\/functionalCurrency';/);
  assert.match(form, /const currencies = useMemo\(\(\) => runtimeCurrencyCodes\(\), \[\]\);/, 'read at render');
  assert.match(form, /const \[currency, setCurrency\] = useState\(''\);/, 'nothing preselected');
  assert.match(form, /\{currencies !== null \? \(\n\s+<select/);
  assert.match(form, /data-currency-source="runtime-list"/);
  assert.match(form, /<option value="" disabled>\{CHOOSE_CURRENCY_WORDS\}<\/option>\n\s+\{currencies\.map\(\(c\) => \(/);
  assert.match(form, /<input\n\s+type="text"\n\s+value=\{currency\}/);
  assert.match(form, /pattern="\[A-Z\]\{3\}"/);
  assert.match(form, /data-currency-source="typed"/);
  assert.match(form, /if \(!ISO_4217_CODE\.test\(currency\)\) \{\n\s+setError\(CURRENCY_NOT_A_CODE_WORDS\);/);
  assert.doesNotMatch(form, /MANUAL_ACCOUNT_CURRENCIES|'USD'|useState\('USD'\)|defaultValue=|selected(?!\))/);
  assert.doesNotMatch(form, /\?\? \[|\|\| \[/, 'no list stands in for the runtime’s');
  assert.ok(comments(FORM).includes('THE LIST IS THE RUNTIME'));
});
