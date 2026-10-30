/**
 * FX-01 (Alex, 2026-10-30, rulings A–K) — THE FUNCTIONAL CURRENCY DECLARED ONCE; THE BOOKS LANE READS IT;
 * TRANSACTIONS CARRY PLAID'S CURRENCY; A BANK ACCOUNT'S CURRENCY IS CHECKED BEFORE IT POSTS.
 *
 * Every fixture of the prompt (DO 1), then the law's shapes and file list, the migration's text, the sync's key
 * in both files, the commit route's order, the manual route's refusals and the form's unpreselected choice, the
 * matcher's account currency, the two catches and money.ts's header. Source is read through code() / comments()
 * (the reader law); the module is run over fixtures; no render, no database, no network, no clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { code, comments } from '../sourceText';
import {
  CURRENCY_NOT_STATED_WORDS, FUNCTIONAL_CURRENCY, FUNCTIONAL_CURRENCY_WORDS, FunctionalCurrencyError, NOT_WHOLE_CENTS_WORDS,
  bankMoneyWords, centsOfDecimalString, centsOfTypedDollars, decimalStringOfCents, foreignAccountWords, functionalMoneyWords,
  isWholeCents, noAccountCurrencyWords, postingCurrencyRule, transactionCurrencyWords,
} from '../books/functionalCurrency';
import { DATA_KEYS } from '../arrivals/prismaDomain';
import { proposeMatches } from '../runway/reservationMatcher';

const HOME = 'src/lib/books/functionalCurrency.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261030150000_fx_01_transactions_currency';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const COMMIT = 'src/app/api/transactions/commit-to-ledger/route.ts';
const MANUAL = 'src/app/api/transactions/manual/route.ts';
const FORM = 'src/components/ManualTransactionForm.tsx';
const PROPOSE = 'src/app/api/runway/match/propose/route.ts';
const MATCHER = 'src/lib/runway/reservationMatcher.ts';
const PAGE = 'src/lib/arrivals/plaidTransactionsPage.ts';
const DOMAIN = 'src/lib/arrivals/prismaDomain.ts';
const PANEL = 'src/components/trips/CheckoutPanel.tsx';
const CONFIRM = 'src/app/booking/confirm/page.tsx';
const MONEY = 'src/lib/money.ts';

const LANE_DIRS = ['src/lib/books', 'src/app/api/trial-balance', 'src/app/api/journal-entries', 'src/app/api/bank-reconciliations', 'src/app/api/books', 'src/app/api/journal-transactions', 'src/app/api/ledger'];
const LANE_COMPONENTS = [
  'src/components/home/BooksPipeline.tsx', 'src/components/dashboard/GeneralLedger.tsx', 'src/components/dashboard/JournalEntryEngine.tsx',
  'src/components/bookkeeping/TrialBalanceSection.tsx', 'src/components/bookkeeping/BookkeepingCockpitBar.tsx', 'src/components/dashboard/BankReconciliation.tsx',
  'src/components/dashboard/PeriodClose.tsx', 'src/components/dashboard/CPAExport.tsx', 'src/components/dashboard/JournalEntriesTab.tsx',
  'src/components/dashboard/AdjustingEntriesTab.tsx', 'src/components/bookkeeping/COAManagementTable.tsx',
];
const ROOT = process.cwd();
function laneFiles(): string[] {
  const walk = (dir: string): string[] => readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : (/\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  return [...new Set([...LANE_COMPONENTS, ...LANE_DIRS.flatMap(walk)])];
}

// ─── A. the module ───────────────────────────────────────────────────────────

test('A the declaration: FUNCTIONAL_CURRENCY is USD, declared once; the words read it; the header cites ASC 830-10-20 and the IRS page and names the other posting paths', () => {
  assert.equal(FUNCTIONAL_CURRENCY, 'USD');
  assert.equal(FUNCTIONAL_CURRENCY_WORDS, 'All figures in USD');
  const src = code(HOME);
  assert.match(src, /export const FUNCTIONAL_CURRENCY = 'USD' as const;/);
  assert.equal((src.match(/'USD'/g) ?? []).length, 1, 'the one USD literal in the module is the declaration');
  const c = comments(HOME);
  for (const words of ['ASC 830-10-20', 'primary economic environment in which the entity operates', 'ASC 830-20-30-1', 'Foreign currency and currency exchange rates',
    'dollar is the functional currency for all taxpayers except some qualified business units', 'Use the exchange rate prevailing when you receive, pay, or accrue the item',
    'src/app/api/journal-entries/route.ts', 'src/app/api/journal-entries/manual/route.ts', 'src/lib/coa/reclassify.ts', 'src/app/api/year-end-close/route.ts',
    'src/app/api/admin/fix-entity-assignment/route.ts', 'reversePlaidTransaction', 'src/app/api/trading/commit-to-ledger/route.ts', 'src/app/api/stock-lots/commit/route.ts',
    'src/lib/batch-trade-processor.ts', 'THIS FILE IS PURE']) assert.ok(c.includes(words), words);
  // Pure: no Prisma, no fetch, no clock, no React.
  assert.doesNotMatch(src, /prisma|fetch\(|Date\.now|new Date\(|from 'react'/);
  // Integer arithmetic only on the formatting path: no division or multiplication by 100, no rounding.
  assert.doesNotMatch(src, /\/\s*100\b|\*\s*100\b|Math\.round\(|toFixed\(/);
});

test('A functionalMoneyWords: integer cents in, the functional currency out; anything else refused by name', () => {
  assert.equal(functionalMoneyWords(BigInt(0)), '$0.00');
  assert.equal(functionalMoneyWords(BigInt(123456)), '$1,234.56');
  assert.equal(functionalMoneyWords(-4500), '-$45.00');
  assert.equal(functionalMoneyWords(5), '$0.05');
  assert.equal(functionalMoneyWords(BigInt('9007199254740993')), '$90,071,992,547,409.93', 'past Number precision, still exact');
  assert.throws(() => functionalMoneyWords(12.5), (e: unknown) => e instanceof FunctionalCurrencyError && e.code === 'not-cents' && /12\.5 is not an integer number of cents/.test(e.message));
  assert.throws(() => functionalMoneyWords('x' as unknown as number), (e: unknown) => e instanceof FunctionalCurrencyError && e.code === 'not-cents');
  assert.throws(() => functionalMoneyWords(Number.NaN), FunctionalCurrencyError);
  assert.equal(decimalStringOfCents(-5), '-0.05');
  assert.equal(decimalStringOfCents(BigInt(100000001)), '1000000.01');
});

test('A centsOfDecimalString: exactly two decimals, by string arithmetic; centsOfTypedDollars: a typed figure padded, never rounded', () => {
  assert.equal(centsOfDecimalString('1234.56'), BigInt(123456));
  assert.equal(centsOfDecimalString('-45.00'), BigInt(-4500));
  assert.throws(() => centsOfDecimalString('1.5'), (e: unknown) => e instanceof FunctionalCurrencyError && e.code === 'not-decimal');
  assert.throws(() => centsOfDecimalString('abc'), (e: unknown) => e instanceof FunctionalCurrencyError && e.code === 'not-decimal');
  assert.throws(() => centsOfDecimalString('1234.5678'), FunctionalCurrencyError);
  assert.equal(centsOfTypedDollars('100'), BigInt(10000));
  assert.equal(centsOfTypedDollars('12.5'), BigInt(1250));
  assert.equal(centsOfTypedDollars(' 12.50 '), BigInt(1250));
  assert.equal(centsOfTypedDollars('-3'), BigInt(-300));
  assert.equal(centsOfTypedDollars('0.1'), BigInt(10));
  assert.throws(() => centsOfTypedDollars('12.345'), (e: unknown) => e instanceof FunctionalCurrencyError && e.code === 'not-dollars');
  assert.throws(() => centsOfTypedDollars(''), FunctionalCurrencyError);
  assert.throws(() => centsOfTypedDollars('1e3'), FunctionalCurrencyError);
  assert.throws(() => centsOfTypedDollars('$5'), FunctionalCurrencyError);
  assert.equal(isWholeCents(12.3), true);
  assert.equal(isWholeCents(12.345), false);
  assert.equal(isWholeCents(Number.NaN), false);
});

test('A postingCurrencyRule (ruling F): USD/USD ok; NULL account → its words; PHP account → its words; USD account + PHP row → its words; USD account + NULL row → ok', () => {
  assert.deepEqual(postingCurrencyRule({ name: 'Checking', isoCurrencyCode: 'USD' }, { id: 't1', iso_currency_code: 'USD' }), { ok: true });
  assert.deepEqual(postingCurrencyRule({ name: 'Checking', isoCurrencyCode: 'USD' }, { id: 't1', iso_currency_code: null }), { ok: true }, 'a row synced before FX-01 (the backfill left it NULL) posts on its account');
  assert.deepEqual(postingCurrencyRule({ name: 'Manual Cash', isoCurrencyCode: null }, { id: 't1', iso_currency_code: null }), { ok: false, error: 'account "Manual Cash" states no currency — set it before it posts' });
  assert.deepEqual(postingCurrencyRule({ name: 'BPI', isoCurrencyCode: 'PHP' }, { id: 't1', iso_currency_code: 'PHP' }), { ok: false, error: 'account "BPI" is stated in PHP; the books are kept in USD — FX-02 posts it' });
  assert.deepEqual(postingCurrencyRule({ name: 'Checking', isoCurrencyCode: 'USD' }, { id: 'txn_9', iso_currency_code: 'PHP' }), { ok: false, error: 'transaction txn_9 is stated in PHP but its account in USD' });
  assert.deepEqual(postingCurrencyRule({ name: 'Checking', isoCurrencyCode: 'usd' }, { id: 't1', iso_currency_code: 'USD' }), { ok: true }, 'case is not a difference');
  assert.equal(noAccountCurrencyWords('A'), 'account "A" states no currency — set it before it posts');
  assert.equal(foreignAccountWords('A', 'PHP'), 'account "A" is stated in PHP; the books are kept in USD — FX-02 posts it');
  assert.equal(transactionCurrencyWords('t', 'PHP', 'USD'), 'transaction t is stated in PHP but its account in USD');
});

test('A bankMoneyWords: a bank figure in the ACCOUNT’s currency — the one formatter for USD, the code otherwise, a NULL named, never a $ on a figure that is not dollars', () => {
  assert.equal(bankMoneyWords(1234.5, 'USD'), '$1,234.50');
  assert.equal(bankMoneyWords(-0.5, 'usd'), '-$0.50');
  assert.equal(bankMoneyWords(2520, 'THB'), '2520.00 THB');
  assert.equal(bankMoneyWords(7, null), `7.00 (${CURRENCY_NOT_STATED_WORDS})`);
  assert.equal(bankMoneyWords(12.345, 'USD'), `12.345 USD (${NOT_WHOLE_CENTS_WORDS})`);
  assert.equal(bankMoneyWords(null, 'USD'), '—');
  assert.equal(bankMoneyWords(undefined, 'USD'), '—');
});

// ─── B + C. the lane and the law ─────────────────────────────────────────────

const SHAPES: ReadonlyArray<{ name: string; re: RegExp; homeToo: boolean }> = [
  { name: '$${', re: /\$\$\{/, homeToo: true },
  { name: "'$' +", re: /['"]\$['"]\s*\+/, homeToo: true },
  { name: '>$<', re: />\$</, homeToo: true },
  { name: 'JSX text $ {', re: />\s*\$\s*\{/, homeToo: true },
  { name: "currency: 'USD'", re: /currency:\s*['"]USD['"]/, homeToo: false },
  { name: "'USD' literal", re: /['"]USD['"]/, homeToo: false },
  { name: 'Intl.NumberFormat', re: /Intl\.NumberFormat/, homeToo: false },
  { name: 'fmt*/format*Money|Dollars|Cents', re: /\b(?:fmt|format)\w*(?:Money|Dollars|Cents)\b/, homeToo: true },
];

test('B the lane holds none of the eight shapes (comments stripped) — the same regexes the law runs; every lane file exists', () => {
  const files = laneFiles();
  assert.ok(files.length >= LANE_COMPONENTS.length + 10, `the lane is ${files.length} files`);
  const hits: string[] = [];
  for (const f of files) {
    assert.ok(existsSync(resolve(ROOT, f)), `${f} exists`);
    const isHome = f === HOME;
    for (const [i, line] of code(f).split('\n').entries()) for (const s of SHAPES) if ((s.homeToo || !isHome) && s.re.test(line)) hits.push(`${f}:${i + 1} ${s.name}: ${line.trim().slice(0, 80)}`);
  }
  assert.deepEqual(hits, [], 'no literal $ before a figure, no USD literal, no Intl, no local money formatter in the lane');
});

test('B every lane screen that prints a figure imports the one formatter; the local formatters are gone (deleted, not wrapped); the CPA export states the unit; the routes hand integer cents', () => {
  for (const f of ['src/components/dashboard/GeneralLedger.tsx', 'src/components/dashboard/JournalEntryEngine.tsx', 'src/components/bookkeeping/TrialBalanceSection.tsx',
    'src/components/bookkeeping/BookkeepingCockpitBar.tsx', 'src/components/dashboard/CPAExport.tsx', 'src/components/dashboard/JournalEntriesTab.tsx',
    'src/components/dashboard/AdjustingEntriesTab.tsx', 'src/components/bookkeeping/COAManagementTable.tsx', 'src/components/home/BooksPipeline.tsx']) {
    assert.match(code(f), /from '@\/lib\/books\/functionalCurrency'/, `${f} imports the home`);
    assert.match(code(f), /functionalMoneyWords\(/, `${f} writes through functionalMoneyWords`);
    assert.doesNotMatch(code(f), /const (fmtMoney|fmtCents|fmtDollars|moneyOfCents|settledWords|fmt) = /, `${f} wraps nothing`);
    assert.doesNotMatch(code(f), /function (formatMoney|formatMoneyDollars|formatCurrency|formatAmount|fmtMoney)\(/, `${f} keeps no local formatter`);
  }
  // The reconciliation's words delegate to the one formatter — a figure that is not whole cents is refused, never rounded.
  assert.match(code('src/lib/books/reconciliation.ts'), /return functionalMoneyWords\(centsOfTypedDollars\(String\(n\)\)\);/);
  // The CPA export: a unit line on every CSV, after the title.
  const cpa = code('src/components/dashboard/CPAExport.tsx');
  assert.equal((cpa.match(/\[FUNCTIONAL_CURRENCY_WORDS\],/g) ?? []).length, 4, 'four CSVs, four unit lines');
  assert.match(cpa, /\['TRIAL BALANCE'\],\n    \[`For the Year Ended December 31, \$\{period\.year\}`\],\n    \[FUNCTIONAL_CURRENCY_WORDS\],/);
  // The routes hand integer cents — nothing divided into dollars on the way out.
  for (const f of ['src/app/api/ledger/route.ts', 'src/app/api/cpa-export/route.ts']) assert.doesNotMatch(code(f), /\/ 100\b/, `${f} hands cents`);
  assert.match(code('src/app/api/ledger/route.ts'), /amount: Number\(entry\.amount\),\n\s+runningBalance: account\.runningBalance,/);
  assert.match(code('src/app/api/cpa-export/route.ts'), /if \(!Number\.isSafeInteger\(n\)\) throw new Error\(`CPA export: \$\{n\} is not an integer number of cents`\);/);
  // The typed journal entry reads a decimal string into cents by string arithmetic; the adjusting route refuses a non-integer.
  assert.match(code('src/app/api/journal-entries/route.ts'), /centsOfTypedDollars\(/);
  assert.doesNotMatch(code('src/app/api/journal-entries/route.ts'), /parseFloat|\* 100\b/);
  assert.match(code('src/app/api/journal-entries/manual/route.ts'), /if \(lines\.some\(\(l: \{ amount: unknown \}\) => !Number\.isSafeInteger\(l\.amount\)\)\)/);
  assert.match(code('src/app/api/journal-entries/manual/route.ts'), /const amountCents = BigInt\(line\.amount\);/);
  // The Banking tab: a balance in its own currency, the total over USD accounts only.
  const pipe = code('src/components/home/BooksPipeline.tsx');
  assert.match(pipe, /bankMoneyWords\(acc\.balance, acc\.currency\)/);
  assert.match(pipe, /balance: a\.balance \?\? null, currency: a\.currency \?\? null,/);
  assert.match(code('src/app/api/accounts/route.ts'), /currency: account\.isoCurrencyCode,/);
  assert.match(code('src/app/api/transactions/route.ts'), /currency: txn\.accounts\?\.isoCurrencyCode \?\? null,/);
});

test('C the law: beside the documents law, the lane named file by file, the eight shapes, the home checks, an EMPTY closed allowlist that may only shrink', () => {
  const law = code(LAW);
  assert.match(law, /lawGuard\('The books currency law', \(\) => \{/);
  assert.match(law, /const FX_HOME = 'src\/lib\/books\/functionalCurrency\.ts';/);
  for (const f of LANE_COMPONENTS) assert.ok(law.includes(`'${f}',`), `the law names ${f}`);
  for (const d of LANE_DIRS) assert.ok(law.includes(`'${d}'`), `the law names ${d}`);
  assert.match(law, /const FX_ALLOW: ReadonlyArray<\{ file: string; snippet: string; dated: string; reason: string \}> = \[\];/, 'EMPTY at merge (ruling C)');
  assert.match(law, /the allowance for \$\{a\.file\} "\$\{a\.snippet\}" \(\$\{a\.dated\}\) matches no line — it is stale; the list only shrinks/);
  for (const re of ['/\\$\\$\\{/', "/['\"]\\$['\"]\\s*\\+/", '/>\\$</', '/>\\s*\\$\\s*\\{/', "/currency:\\s*['\"]USD['\"]/", "/['\"]USD['\"]/", '/Intl\\.NumberFormat/', '/\\b(?:fmt|format)\\w*(?:Money|Dollars|Cents)\\b/']) {
    assert.ok(law.includes(re), `the law holds the shape ${re}`);
  }
  assert.match(law, /if \(!\/export const FUNCTIONAL_CURRENCY = 'USD' as const;\/\.test\(home\)\) fxFail/);
  assert.match(law, /if \(\/\\\/\\s\*100\\b\|\\\*\\s\*100\\b\|Math\\\.round\\\(\/\.test\(home\)\) fxFail/);
  // The documents law precedes it and the lines law follows — "beside the documents law".
  assert.ok(law.indexOf("lawGuard('The documents law'") < law.indexOf("lawGuard('The books currency law'") && law.indexOf("lawGuard('The books currency law'") < law.indexOf("lawGuard('The lines law'"));
  // The matcher's listed default is gone from the stated-figure law's allowances (ruling H).
  assert.doesNotMatch(law, /snippet: "\(opts\.accountCurrency \?\? 'USD'\)\.toUpperCase\(\)"/);
});

// ─── D. the migration ────────────────────────────────────────────────────────

test('D the migration converges both production states, backfills from the account by name, drops the two defaults, checks only the length; the schema and the ladder follow; the ad-hoc file is gone', () => {
  const sql = code(MIGRATION);
  const words = comments(MIGRATION);
  assert.match(sql, /ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "iso_currency_code" VARCHAR\(3\);/);
  assert.match(sql, /ALTER TABLE "transactions" ALTER COLUMN "iso_currency_code" DROP DEFAULT;/);
  assert.match(sql, /UPDATE "transactions" t\n\s+SET "iso_currency_code" = a\."isoCurrencyCode"\n\s+FROM "accounts" a\n\s+WHERE t\."accountId" = a\."id";/);
  assert.match(sql, /ADD CONSTRAINT "transactions_iso_currency_code_length"\n\s+CHECK \("iso_currency_code" IS NULL OR char_length\("iso_currency_code"\) = 3\);/);
  assert.equal((sql.match(/CHECK \(/g) ?? []).length, 1, 'no CHECK beyond the length');
  assert.match(sql, /ALTER TABLE "reservations" ALTER COLUMN "currency" DROP DEFAULT;/);
  assert.match(sql, /ALTER TABLE "commission_ledger" ALTER COLUMN "currency" DROP DEFAULT;/);
  assert.doesNotMatch(sql, /DEFAULT 'USD'|SET "iso_currency_code" = 'USD'/, "never 'USD' by default");
  assert.doesNotMatch(sql, /ledger_entries|journal_entries/, 'nothing touches the GL');
  for (const w of ['LABELLED BACKFILL', 'DERIVED from its account\'s stated currency', 'NOT Plaid\'s own word for the', 'A NULL account currency leaves a NULL row', "never 'USD' by default", 'AUTHORED, NOT APPLIED', 'prisma/add_plaid_rich_data.sql']) assert.ok(words.includes(w), w);
  // The schema.
  const schema = code(SCHEMA);
  // code() blanks a comment in place, so the doc line between the two columns reads as spaces.
  assert.match(schema, /model transactions \{[\s\S]*?\n  amount\s+Float\n\s*iso_currency_code\s+String\?\s+@db\.VarChar\(3\)\n/);
  assert.match(comments(SCHEMA), /FX-01 \(2026-10-30\): Plaid's own ISO 4217 code for the row, kept by the sync; NULL for a row synced before FX-01/);
  assert.match(schema, /\n  finalPriceCents\s+Int\?[^\n]*\n\s*currency\s+String\s+@db\.VarChar\(3\)\s*\n/, 'reservations.currency has no default');
  assert.match(schema, /\n  commissionAmountCents Int\?\s*\n\s*currency\s+String\s+@db\.VarChar\(3\)\s*\n/, 'commission_ledger.currency has no default');
  assert.equal((schema.match(/@default\("USD"\)/g) ?? []).length, 1, 'the one remaining USD default is compliance_tasks.penalty_currency (FX-02)');
  // The ladder.
  const dirs = readdirSync(resolve(ROOT, MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261030120000_documents_02_reconciliation_supersession', 'right after DOCUMENTS-02’s');
  // The ad-hoc file is gone; the recon table says where the column went.
  assert.equal(existsSync(resolve(ROOT, 'prisma/add_plaid_rich_data.sql')), false);
  assert.match(code('AUDIT-RECON.md'), /now a migration, `20261030150000_fx_01_transactions_currency`/);
});

// ─── E. the sync ─────────────────────────────────────────────────────────────

test('E the sync keeps Plaid’s word: the parser’s txnData and the binding’s DATA_KEYS name iso_currency_code together; unofficial is not kept, declared', () => {
  assert.match(code(PAGE), /iso_currency_code: txn\.iso_currency_code \?\? null,/);
  assert.doesNotMatch(code(PAGE), /unofficial_currency_code:/);
  assert.ok(comments(PAGE).includes('unofficial_currency_code is NOT kept'));
  assert.ok((DATA_KEYS as readonly string[]).includes('iso_currency_code'));
  assert.match(code(DOMAIN), /'iso_currency_code', 'arrival_id', 'updatedAt',/);
  assert.doesNotMatch(code(DOMAIN), /'unofficial_currency_code'/);
});

// ─── F. the commit rule in the route ─────────────────────────────────────────

test('F the commit route calls postingCurrencyRule after the account is loaded and before the accountCode check, in its own errors shape', () => {
  const src = code(COMMIT);
  assert.match(src, /import \{ postingCurrencyRule \} from '@\/lib\/books\/functionalCurrency';/);
  const loaded = src.indexOf('const linkedAccount = plaidTxn.accounts;');
  const rule = src.indexOf('const currency = postingCurrencyRule(linkedAccount, { id: plaidTxn.id, iso_currency_code: plaidTxn.iso_currency_code });');
  const refused = src.indexOf('errors.push({ txnId, error: currency.error });');
  const codeCheck = src.indexOf('const bankAccountCode = linkedAccount.accountCode;');
  const posts = src.indexOf('commitPlaidTransaction(prisma,');
  assert.ok(loaded > 0 && rule > loaded && refused > rule && codeCheck > refused && posts > codeCheck, 'account → rule → refusal → accountCode → posting');
  assert.doesNotMatch(src, /Intl\.NumberFormat|fxRate|exchangeRate|convertCurrency/, 'nothing converts');
});

// ─── G. the manual account states its currency ───────────────────────────────

test('G the manual route requires an ISO 4217 code by name, creates the account with it, refuses a NULL or a different one (409); the form offers a required select with nothing preselected', () => {
  const src = code(MANUAL);
  assert.match(src, /const ISO_4217 = \/\^\[A-Z\]\{3\}\$\/;/);
  assert.match(src, /if \(typeof currency !== 'string' \|\| !ISO_4217\.test\(currency\)\) \{\n\s+return NextResponse\.json\(\{ error: CURRENCY_REQUIRED_WORDS \}, \{ status: 400 \}\);/);
  assert.match(src, /\nconst CURRENCY_REQUIRED_WORDS = 'currency is required — a three-letter ISO 4217 code in capitals \(USD, PHP, …\)';/, 'module-level, not exported — a route file exports only its handlers');
  assert.match(src, /if \(stated === null\) return NextResponse\.json\(\{ error: accountStatesNoCurrencyWords\(account\.name\) \}, \{ status: 409 \}\);/);
  assert.match(src, /if \(stated !== currency\) return NextResponse\.json\(\{ error: accountCurrencyDiffersWords\(account\.name, stated, currency\) \}, \{ status: 409 \}\);/);
  assert.match(src, /source: 'manual',\n\s+isoCurrencyCode: currency,\n/);
  assert.doesNotMatch(src, /\?\? 'USD'|\|\| 'USD'/);
  assert.ok(!comments(MANUAL).includes('+ journal entry'), 'the doc comment no longer claims a journal entry');
  const form = code(FORM);
  assert.match(form, /const \[currency, setCurrency\] = useState\(''\);/, 'nothing preselected');
  assert.match(form, /<option value="" disabled>\{CHOOSE_CURRENCY_WORDS\}<\/option>/);
  assert.match(form, /\{MANUAL_ACCOUNT_CURRENCIES\.map\(\(c\) => \(/);
  assert.match(form, /required\n\s+data-manual-currency/);
  assert.match(form, /amount: finalAmount,\n\s+currency,\n/);
  assert.match(form, /if \(currency === ''\) \{\n\s+setError\(CURRENCY_NOT_CHOSEN_WORDS\);/);
  assert.doesNotMatch(form, /useState\('USD'\)|Amount \(\$\)/);
});

// ─── H. the matcher reads the account's currency ─────────────────────────────

test('H the charge pass takes the account currency per group (as the refund pass does); NULL excludes the amount signal by name; no USD default; the stale comment is gone', () => {
  const route = code(PROPOSE);
  assert.match(route, /accounts: \{ select: \{ isoCurrencyCode: true \} \},\n\s+\},\n\s+\}\);\n/, 'the charge pass selects the account currency');
  assert.match(route, /const byAccountCurrency = new Map<string \| null, typeof transactions>\(\);/);
  assert.match(route, /const proposals = chargeCurrencies\.flatMap\(\(accountCurrency\) => proposeMatches\(\{\n\s+reservations,\n\s+transactions: byAccountCurrency\.get\(accountCurrency\) \?\? \[\],\n\s+accountCurrency,/);
  const matcher = code(MATCHER);
  assert.doesNotMatch(matcher, /\?\? 'USD'|\|\| 'USD'/);
  assert.match(matcher, /accountCurrency: string \| null;\n  opts: MatcherOptions;\n\}\): MatchProposal\[\] \{/);
  assert.doesNotMatch(comments(MATCHER), /transactions:414-449/);
  assert.match(comments(MATCHER), /iso_currency_code :716/);
  const RES = { id: 'r1', finalPriceCents: 43210, currency: 'USD', provider: 'liteapi', hotelName: null, createdAt: '2026-09-20' };
  const TXN = { id: 't1', amount: 432.1, date: '2026-09-20', name: 'NUITEE FLIGHTS', pending: false };
  const opts = { amountTolerancePct: 0.05, dateWindowDays: 3 };
  const [scored] = proposeMatches({ reservations: [RES], transactions: [TXN], accountCurrency: 'USD', opts });
  assert.match(scored.rationale, /amount: \$432\.10 vs booked \$432\.10/);
  const [nulled] = proposeMatches({ reservations: [RES], transactions: [TXN], accountCurrency: null, opts });
  assert.match(nulled.rationale, /amount: EXCLUDED — the account currency is not stated \(accounts\.isoCurrencyCode NULL\); date \+ descriptor carry this proposal/);
  assert.ok(nulled.confidence > 0 && nulled.confidence <= 1, 'the weights re-normalize over date + descriptor — a proposal still stands');
  assert.match(nulled.rationale, /date: /);
  assert.doesNotMatch(nulled.rationale, /vs booked/);
  const [foreign] = proposeMatches({ reservations: [RES], transactions: [TXN], accountCurrency: 'PHP', opts });
  assert.match(foreign.rationale, /amount: EXCLUDED — reservation currency USD ≠ account PHP/);
});

// ─── I. no catch relabels a currency; money.ts names what it is ──────────────

test('I the two catches print the figure WITH its code; money.ts’s header names the books lane’s formatter', () => {
  assert.match(code(PANEL), /\} catch \{\n\s+return `\$\{amount\.toFixed\(2\)\} \$\{currency\}`;/);
  assert.match(code(CONFIRM), /\} catch \{\n\s+return `\$\{\(cents \/ 100\)\.toFixed\(2\)\} \$\{currency\}`;/);
  for (const f of [PANEL, CONFIRM]) assert.doesNotMatch(code(f), /return `\$\$\{/, `${f} relabels nothing as dollars`);
  const c = comments(MONEY);
  assert.ok(c.includes('src/lib/books/functionalCurrency.ts functionalMoneyWords'));
  assert.ok(c.includes('It is NOT the books\' formatter and never was the\n * single one') || c.includes('never was the'));
  assert.doesNotMatch(c, /the SINGLE money formatter/);
});
