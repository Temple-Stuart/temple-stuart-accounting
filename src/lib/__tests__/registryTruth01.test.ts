/**
 * REGISTRY-TRUTH-01 (GUIDES-00's findings 5 and 8 — the 25-tool audit, 2026-11-08; Alex, 2026-11-09 18:23: "the how-to
 * prints each tool's mark and line from the registry") — six lines in src/lib/toolRegistry.ts say what is true today,
 * and every file:line in that file that had drifted is re-cited in place (the one claim that holds nowhere today, in
 * the note above Brokerage, is reported and left as written). No status, beat, home, link, table or count moved:
 * 5 LIVE · 9 PARTIAL · 11 NOT_BUILT stand.
 *
 *   T1 the six lines: each no longer carries its false phrase and carries its true one;
 *   T2 the five customer sentences are a customer's: one sentence, no path, route, PR id, table name, beat word,
 *      builder word or "founder" — the plan law's rules (scripts/assert-tool-registry.ts) and this PR's stricter ones;
 *   T3 Trade Log — a hand-entered trade is written with no opening arrival; posting it needs a book of type trading,
 *      and setup opens personal and sole-proprietorship books only; Form 8949 selects by the opening arrival; a synced
 *      leg needs the same book;
 *   T4 Brokerage — positions and balances are fetched for the owner only and read by nothing; the scan is the owner's;
 *   T5 Retirement — the accounts screen has a Retirement group, filed by the institution's own type and subtype;
 *   T6 FP&A — the runway sums every account not tagged trading, whatever its kind; the home card prints it; Books
 *      prints one Profit Margin; the projections key is read by a component and returned by no route;
 *   T7 Budget — a plan's money may sit on an income account and is compared as income; travel budgets are not
 *      connected; a task counts only on a day that holds a calendar block;
 *   T8 Calendar — the grid file sends three GETs and no write; the panels it mounts write; no route under
 *      /api/calendar inserts a calendar_events row, its events route updates and deletes one; new rows are Travel's;
 *   T9 the counts are 5 · 9 · 11 and every tool's status is the one typed here;
 *   T10 every src/…ts(x):NN and every schema:NN a citation, a note or an ownTableRoute prints — and every one in the
 *       note beside Calendar's ownTable, which Calendar's citation names as its evidence — names a file that exists
 *       and has that line; a bare ":N" with no file before it fails by name;
 *   T11 the short forms too (generate-tasks/route.ts:43, page.tsx:413): each resolves to ONE file by the citation's
 *       own convention, and that file has the line.
 * Every code fact is read from the tool's own file by CONTENT, through code() (the reader law) — no line number of any
 * other file is pinned here, so a file that grows does not turn this red. T10 and T11 hold those numbers only to "the
 * file exists and is that long": what a line SAYS is each tool's own test's to pin. The numbers in the registry's
 * OTHER comments are not walked — they hold dated history ("was :640"), which names lines that are gone by design.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { code, comments } from '../sourceText';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts, type ToolEntry, type ToolStatus } from '../toolRegistry';

const REGISTRY = 'src/lib/toolRegistry.ts';
const tool = (name: string): ToolEntry => {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  assert.ok(t, `the registry holds ${name}`);
  return t;
};
const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
/** Every .ts/.tsx under src/, tests left out — for the facts that are true of the whole tree ("no screen calls it"). */
const walk = (dir: string): string[] => readdirSync(`${process.cwd()}/${dir}`).flatMap((name) => {
  const p = `${dir}/${name}`;
  return statSync(`${process.cwd()}/${p}`).isDirectory() ? walk(p) : [p];
});
const ALL_SOURCE = walk('src').filter((f) => /\.tsx?$/.test(f));
const PRODUCT = ALL_SOURCE.filter((f) => !f.includes('/__tests__/'));
const SCREENS = PRODUCT.filter((f) => !f.startsWith('src/app/api/'));
const read = new Map<string, string>();
const codeOf = (f: string): string => {
  let text = read.get(f);
  if (text === undefined) { text = code(f); read.set(f, text); }
  return text;
};
/** The files (of a set) whose code matches — comments never count. */
const filesWith = (re: RegExp, among: readonly string[] = PRODUCT): string[] => among.filter((f) => re.test(codeOf(f))).sort();
/** The files that import a component by its file name — none means it is mounted nowhere. */
const importersOf = (component: string): string[] => filesWith(new RegExp(`from ['"][^'"]*/${component}['"]`));

// ── T1 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('T1 the six lines: each no longer carries its false phrase and carries its true one', () => {
  // Trade Log — the why (the builder's line) and the customer sentence.
  const tradeLog = tool('Trade Log');
  assert.doesNotMatch(tradeLog.why ?? '', /a customer cannot log a trade|there is no manual entry|only once a Plaid-synced investment transaction is committed/);
  assert.match(tradeLog.why ?? '', /^a customer can log an options trade by hand \(TRADE-LOG-01\), correct or delete it, keep a journal entry on it, and read it back with its realized P&L once it is closed; nothing past that is done: /);
  assert.match(tradeLog.why ?? '', /posting it needs a Trading book and entity setup opens only personal and sole-proprietorship books/);
  assert.match(tradeLog.why ?? '', /Form 8949 never reads a hand-entered trade/);
  assert.match(tradeLog.why ?? '', /the one screen that commits a synced brokerage leg sends no book so the leg needs that same Trading book to become a trade/);
  assert.match(tradeLog.why ?? '', /grading needs a trade card and the only screen that queues one is a scan only the owner can run/);
  assert.match(tradeLog.why ?? '', /— so the job is not done for a customer on production yet$/);
  assert.doesNotMatch(tradeLog.customer ?? '', /Trades show only once|you cannot enter one by hand yet/);
  assert.equal(tradeLog.customer, 'You can enter an options trade by hand, correct or delete it, keep your own notes and a rating on it, and see what it made or lost once it is closed; it does not reach your books or your tax forms, and fills from a synced brokerage feed cannot be turned into trades yet.');

  // Brokerage — the customer sentence (the why is tradeSplit.test.ts's, untouched).
  const brokerage = tool('Brokerage');
  assert.doesNotMatch(brokerage.customer ?? '', /Positions and balances show|one connected brokerage account/);
  assert.equal(brokerage.customer, 'You can set the filters for a market scan; the scan itself is not open to customers yet, no positions or balances are shown here, and you cannot connect your own broker here yet.');
  assert.equal(brokerage.why, "runs on the founder's broker until per-user connections ship (TT-02)", 'the why stands');

  // Retirement.
  const retirement = tool('Retirement');
  assert.doesNotMatch(retirement.customer ?? '', /do not sit beside the rest of your money/);
  assert.equal(retirement.customer, 'Contribution limits, employer match and required withdrawals are not worked out yet; a retirement account is listed in its own group beside your other connected accounts, with its balance, when its institution reports it as one.');

  // FP&A.
  const fpa = tool('FP&A');
  assert.doesNotMatch(fpa.customer ?? '', /Runway, margin and the forecast behind them are not available yet|nothing is forecast/);
  assert.equal(fpa.customer, 'No forecast stands behind the runway or the margin yet; once a bank is linked and your books go back three full months, your home page says how long your money lasts, counting the balance of every linked account not marked trading as cash, cards, loans and investments included, and the statements in your books show one profit margin.');

  // Budget — the customer sentence (the why is dataflow01.test.ts's and toolRegistry.test.ts's, untouched).
  const budget = tool('Budget');
  assert.doesNotMatch(budget.customer ?? '', /income budgets|what you actually spent, by book and account/);
  assert.equal(budget.customer, "You can compare the spending and income you planned in your routines with what your books show you actually spent and earned, by book and account; a task's cost is counted only after the task has a start and end time on your calendar, which you cannot set yet, and travel budgets are not connected yet.");
  assert.equal(budget.why, 'plan vs actual for routines and tasks on /budget; travel and income budgets not connected yet', 'the why stands — reported, not changed');

  // Calendar — the citation's discover words and the note beside ownTable.
  const calendar = tool('Calendar');
  assert.doesNotMatch(calendar.citation, /the grid writes nothing/);
  assert.match(calendar.citation, /\(\/api\/hub\/operations-routines\) — three GETs, the only requests the grid file itself sends; the panels it mounts write \(each named with its file:line in the note beside ownTable above\) · record: /);
  assert.match(calendar.citation, / · no commit: no POST since ONEOFF-01 on the events route, nothing is authored on the calendar · no decide: no persisted draft$/);
  assert.equal(calendar.ownTable, null, 'ownTable stands — reported, not changed');
  const notes = comments(REGISTRY);
  assert.doesNotMatch(notes, /its own routes are three GETs/);
  assert.doesNotMatch(notes, /calendar_events is written by Travel's itinerary route/);
  assert.match(notes, /REGISTRY-TRUTH-01 \(2026-11-10\), re-read against the code: its own routes write no NEW calendar_events row/);
  assert.match(notes, /The grid file itself sends three GETs and no write \(src\/components\/hub\/HubCalendar\.tsx:\d+, :\d+, :\d+\); the panels it mounts write/);

  // The header says what this was, on the census-history line.
  assert.match(notes, /REGISTRY-TRUTH-01 \(2026-11-10, no census\): six lines re-read against the code/);
  assert.match(notes, /no status, beat, home, link or table moved and the counts are unchanged, 5 LIVE · 9 PARTIAL · 11 NOT_BUILT\./);
});

// ── T2 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('T2 the five customer sentences are a customer\'s: one sentence, no path, route, PR id, table name, beat word, builder word or "founder"', () => {
  for (const name of ['Trade Log', 'Brokerage', 'Retirement', 'FP&A', 'Budget']) {
    const line = tool(name).customer ?? '';
    assert.ok(line.length > 0, `${name} carries a customer sentence`);
    assert.match(line, /^[A-Z][^.!?]*\.$/, `${name}: one sentence — a capital, one full stop, at the end`);
    assert.doesNotMatch(line, /\//, `${name}: no path and no route`);
    assert.doesNotMatch(line, /\.tsx?\b|\bsrc\b/, `${name}: no file`);
    assert.doesNotMatch(line, /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/, `${name}: no PR id`);
    assert.doesNotMatch(line, /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/, `${name}: no table or column name`);
    assert.doesNotMatch(line, /\b(discover|decide|commit|record)/i, `${name}: no beat word`);
    assert.doesNotMatch(line, /\b(module|base|tier|cumulative|registry|beat|loop)/i, `${name}: no builder word`);
    assert.doesNotMatch(line, /\bfounder/i, `${name}: not told whose account it runs on`);
  }
});

// ── T3 · TRADE LOG ──────────────────────────────────────────────────────────────────────────────────────────────────
test('T3 Trade Log: a hand entry is written with no opening arrival; posting needs a trading book that setup does not open; Form 8949 selects by the opening arrival; a synced leg needs the same book', () => {
  // The hand entry exists and writes — the old line's "you cannot enter one by hand yet" was false.
  assert.match(code('src/app/api/trade-log/manual/route.ts'), /await prisma\.trading_positions\.createMany\(\{ data: built\.rows \}\);/);
  const manual = code('src/lib/tradeLog/manualTrade.ts');
  assert.ok(count(manual, /open_investment_txn_id: null,/g) >= 1, 'a hand-entered position has no opening arrival');
  assert.equal(count(manual, /open_investment_txn_id: (?!null[,;])/g), 0, 'on every row the builder writes, open or closed');
  assert.match(manual, /type must be CALL or PUT\./, 'options only');
  const page = code('src/app/trade-log/page.tsx');
  assert.match(page, /<LogTradeForm\b/, 'the form is on the tool\'s own page');
  // Correct or delete it: the same route, the caller's own hand-entered rows.
  const manualRoute = code('src/app/api/trade-log/manual/route.ts');
  assert.match(manualRoute, /export async function PATCH\b/);
  assert.match(manualRoute, /export async function DELETE\b/);
  // Keep a journal entry on it: the button is on every row, and the route asks for the trading key and no owner.
  assert.match(page, /<button onClick=\{\(\) => openJournalModal\(trade\)\}/);
  assert.match(page, /fetch\('\/api\/trading-journal', \{\s*method: 'POST',/);
  const journal = code('src/app/api/trading-journal/route.ts');
  assert.match(journal, /where: \{ userId: user\.id, tradeNum \}/, 'the entry is the caller\'s, by trade number — wherever the trade came from');
  assert.doesNotMatch(journal, /requireAdmin|isAdminUser/);
  // Posting it: a book of type trading, or a 400.
  const post = code('src/app/api/trading/commit-to-ledger/route.ts');
  assert.match(post, /where: \{ userId: user\.id, entity_type: 'trading' \},/);
  assert.match(post, /return NextResponse\.json\(\{ error: 'No Trading entity found for user' \}, \{ status: 400 \}\);/);
  // …which no customer can open: setup takes these two kinds and no other.
  assert.match(code('src/lib/entities/kinds.ts'), /export type EntityKindType = 'personal' \| 'sole_prop';/);
  assert.match(code('src/lib/entities/setup.ts'), /const kind = entityKind\(b\.entity_type\);\s*if \(!kind\) \{/);
  // …and setup is the only door: one route creates a book, through that parser; the other writer is the seed script's.
  assert.deepEqual(filesWith(/\.entities\.(create|createMany|upsert)\(/), ['src/lib/entities/prismaEntityDb.ts', 'src/lib/seed-entities.ts']);
  assert.deepEqual(filesWith(/\bprismaEntityDb\(/, PRODUCT.filter((f) => f.startsWith('src/app/'))), ['src/app/api/entities/route.ts']);
  assert.deepEqual(filesWith(/\bseedEntities\(/, PRODUCT.filter((f) => f.startsWith('src/app/') || f.startsWith('src/components/'))), [], 'no route and no screen runs the seed');
  // The tax forms read a closed position by its opening arrival — the id a hand entry does not have.
  assert.match(code('src/lib/tax-report-service.ts'), /open_investment_txn_id: \{ in: userInvestmentTxnIds \},\s*status: 'CLOSED',/);
  // A synced leg becomes a trade through a route that needs the same book when no entity is sent — and the one
  // mounted caller sends none.
  const synced = code('src/app/api/investment-transactions/commit-to-ledger/route.ts');
  assert.match(synced, /where: \{ userId: user\.id, code: '1200', entity: \{ entity_type: 'trading' \} \},/);
  assert.match(synced, /No entityId provided and no Trading entity found/);
  const workflow = code('src/components/dashboard/TradeCommitWorkflow.tsx');
  assert.equal(count(workflow, /fetch\('\/api\/investment-transactions\/commit-to-ledger'/g), 2);
  assert.doesNotMatch(workflow, /entityId/, 'the mounted commit workflow sends no entity');
  // The route's two other callers are mounted nowhere — no file imports either.
  assert.deepEqual(importersOf('OpensCommitPanel'), []);
  assert.deepEqual(importersOf('TradeCommitQueue'), []);
  assert.deepEqual(importersOf('TradeCommitWorkflow'), ['src/components/dashboard/InvestmentsTab.tsx'], 'the mounted one');
  // Grading: one screen queues a trade card — the scanner's save — and both of its sources are the owner's.
  assert.deepEqual(filesWith(/fetch\('\/api\/trade-cards', \{\s*method: 'POST',/, SCREENS), ['src/components/convergence/ConvergenceIntelligence.tsx']);
  assert.match(code('src/app/api/test/convergence/route.ts'), /const adminGate = await requireAdmin\(\);/);
});

// ── T4 · BROKERAGE ──────────────────────────────────────────────────────────────────────────────────────────────────
test('T4 Brokerage: positions and balances are fetched for the owner only and read by nothing; the scan is refused to every other account', () => {
  const page = code('src/app/brokerage/page.tsx');
  // Declared once each, set by the fetch, and named nowhere else — nothing draws them.
  assert.equal(count(page, /\bttPositions\b/g), 1, 'ttPositions is declared and never read');
  assert.equal(count(page, /\bttBalances\b/g), 1, 'ttBalances is declared and never read');
  assert.match(page, /setTtPositions\(posData\.positions \|\| \[\]\);\s*setTtBalances\(balData\.balances \|\| \[\]\);/);
  // The connection is asked for the owner alone, so the fetch above never runs for anyone else.
  assert.match(page, /if \(!isOwner\) return;\s*fetch\('\/api\/tastytrade\/status'\)/);
  assert.match(page, /\{isOwner && ttConnected && \(/, 'the scanner mounts for the owner alone');
  assert.match(page, /\{!isOwner && \(/, 'everyone else reads the one line');
  // The scan route refuses every account but the admin's before anything is computed.
  assert.match(code('src/app/api/trading/convergence/route.ts'), /const admin = await requireAdmin\(\);\s*const gate = scanGate\(!\(admin instanceof NextResponse\)\);\s*if \(gate\.refused\) \{/);
  // What a key holder can do: the filters, kept in the browser — the form is drawn before, and outside, the owner's gate.
  assert.match(page, /localStorage\.setItem\('scanner-filters', JSON\.stringify\(next\)\)/);
  const form = page.indexOf('<ScanFilterForm');
  assert.ok(form > -1 && form < page.indexOf('{isOwner && ttConnected && ('), 'the filter form mounts for every viewer of the room');
  // (code() blanks the JSX comment above the form and leaves its empty braces.)
  assert.match(page, /<\/div>\s+(?:\{\s*\}\s*)?<ScanFilterForm\b/, 'in the room\'s own flow — a sibling of the strip, inside no condition');
  // No screen connects a broker: nothing outside the API names the connect route.
  assert.deepEqual(filesWith(/tastytrade\/connect/, SCREENS), []);
});

// ── T5 · RETIREMENT ─────────────────────────────────────────────────────────────────────────────────────────────────
test('T5 Retirement: the accounts screen files a retirement account in a group of its own, by the institution\'s type and subtype, with its balance and the group\'s total', () => {
  const view = code('src/lib/accountsView.ts');
  assert.match(view, /\{ key: 'retirement', label: 'Retirement', empty: /);
  assert.match(view, /if \(type === 'investment'\) \{\s*return RETIREMENT_SUBTYPES\.includes\(norm\(account\.subtype\)\) \? 'retirement' : 'brokerage';/);
  const screen = code('src/components/accounts/AccountsClient.tsx');
  assert.match(screen, /const groups = groupAccounts\(rows\);/);
  assert.match(screen, /\{group\.label\}<\/h2>/);
  assert.match(screen, /<span data-group-total>\{money\(group\.total\)\}<\/span>/);
  // Nothing retirement-specific stands behind it: the row keeps no home, no beats and its NOT_BUILT (T9).
  assert.equal(tool('Retirement').home, null);
});

// ── T6 · FP&A ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('T6 FP&A: the runway sums every account not tagged trading, whatever its kind; the home card prints it; Books prints one Profit Margin; nothing returns a projection', () => {
  const route = code('src/app/api/runway/route.ts');
  // The whole cash query: the caller's accounts, minus the ones tagged trading — no condition on what kind of account.
  assert.match(route, /SELECT COUNT\(\*\)::int AS n, COALESCE\(SUM\("currentBalance"\)::numeric, 0\)::text AS total\s+FROM accounts\s+WHERE "userId" = \$\{userId\}\s+AND "entityType" IS DISTINCT FROM 'trading'\s+`;/);
  // The home card reads that route and prints the sum as cash.
  assert.match(code('src/lib/answers.ts'), /'How long can I last\?': \{\s*computed: true,\s*endpoint: '\/api\/runway',/);
  assert.match(code('src/components/answers/AnswersClient.tsx'), /const basis = `cash \$\{r\.cash \?\? 'no bank linked'\} \(\$\{r\.accountsLinked\} linked account/);
  // The card reads the first window, and the first window is three full months.
  assert.match(route, /const windows = \[await buildWindow\(3\), await buildWindow\(6\)\];/);
  assert.match(code('src/components/answers/AnswersClient.tsx'), /const w = d\.windows\[0\];/);
  // One margin, in the books' statements — the word appears once on that tab.
  const statements = code('src/components/dashboard/FinancialStatementsTab.tsx');
  assert.match(statements, />Profit Margin</);
  assert.equal(count(statements, /Margin/g), 1);
  // No forecast: the only reader of a projections key reads a key its route never returns.
  assert.match(code('src/components/dashboard/MetricsAndProjectionsTab.tsx'), /setProjections\(data\.projections \|\| \[\]\);/);
  assert.deepEqual(importersOf('MetricsAndProjectionsTab'), [], 'and no file mounts that reader');
  assert.doesNotMatch(code('src/app/api/metrics/route.ts'), /projections/);
  assert.equal(tool('FP&A').home, null);
});

// ── T7 · BUDGET ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('T7 Budget: a plan\'s money may sit on an income account and is compared as income; travel budgets are not connected; a task counts only on a day that holds a calendar block', () => {
  // Income is planned the same way as spending — only the other three account types are refused.
  assert.match(code('src/lib/operations/planMoney.ts'), /if \(row\.account_type !== 'revenue' && row\.account_type !== 'expense'\) \{/);
  const report = code('src/lib/budget/report.ts');
  assert.match(report, /if \(account\.accountType !== 'revenue' && account\.accountType !== 'expense'\) return 'not an income or expense account';/);
  assert.match(report, /const v = account\.accountType === 'revenue' \? variance\(actual, budgetToDate\) : variance\(budgetToDate, actual\);/);
  // Travel is the half that is still true.
  assert.match(code('src/lib/budget/reportInputs.ts'), /travelBudgets: 'not connected',/);
  // A task's cost lands on the earliest planned day that holds a block; with none it is listed, not counted.
  const days = code('src/lib/budget/days.ts');
  assert.match(days, /\.filter\(\(item\) => item\.blocks\.some\(\(b\) => b\.status !== 'cancelled'\)\)/);
  assert.match(days, /reason: 'not on the calendar', detail: null \}\);/);
  // "which you cannot set yet": two routes create a calendar block; the one screen that calls the first is mounted
  // nowhere, and no screen calls the second.
  assert.deepEqual(filesWith(/operations_calendar_blocks\.create\(/), ['src/app/api/operations/daily-plan/items/[itemId]/blocks/route.ts', 'src/app/api/operations/tasks/[id]/assign/route.ts']);
  assert.deepEqual(filesWith(/\/api\/operations\/tasks\/\$\{[^}]+\}\/assign/, SCREENS), ['src/components/hub/UnscheduledTaskTable.tsx']);
  assert.deepEqual(importersOf('UnscheduledTaskTable'), [], 'imported by no file');
  assert.deepEqual(filesWith(/daily-plan\/items\/\$\{[^}]+\}\/blocks/, SCREENS), []);
  // Both budget routes read and neither writes — the one beat stands.
  for (const f of ['src/app/api/budget/report/route.ts', 'src/app/api/budget/report/cell/route.ts']) {
    assert.doesNotMatch(code(f), /export async function (POST|PATCH|PUT|DELETE)\b/, `${f} exports GET alone`);
  }
});

// ── T8 · CALENDAR ───────────────────────────────────────────────────────────────────────────────────────────────────
test('T8 Calendar: the grid file sends three GETs and no write; the panels it mounts write; no route under /api/calendar inserts a calendar_events row; new rows are Travel\'s', () => {
  const grid = code('src/components/hub/HubCalendar.tsx');
  assert.equal(count(grid, /\bfetch\(/g), 3, 'three requests in the grid file');
  assert.doesNotMatch(grid, /method:\s*'(POST|PATCH|PUT|DELETE)'/, 'the grid file itself sends no write');
  for (const panel of ['HubEventCard', 'EventDetailPanel', 'CorrectEventForm', 'DayView']) {
    assert.match(grid, new RegExp(`<${panel}\\b`), `the grid mounts ${panel}`);
  }
  // …and each of the four writes.
  assert.match(code('src/components/hub/CorrectEventForm.tsx'), /fetch\('\/api\/calendar\/events', \{\s*method: 'PATCH',/);
  assert.match(code('src/components/hub/DayView.tsx'), /fetch\(`\/api\/calendar\/events\?id=\$\{encodeURIComponent\(id\)\}`, \{ method: 'DELETE' \}\)/);
  const panel = code('src/components/hub/EventDetailPanel.tsx');
  assert.match(panel, /fetch\(`\/api\/calendar\/events\?id=\$\{encodeURIComponent\(row\.id\)\}`, \{ method: 'DELETE' \}\)/);
  assert.match(panel, /fetch\('\/api\/calendar\/links', \{\s*method: 'POST',/);
  assert.match(panel, /\bfetch\(`\/api\/calendar\/links\?journalEntryId=\$\{encodeURIComponent\(journalEntryId\)\}`, \{ method: 'DELETE' \}\)/);
  const links = code('src/components/hub/useLineLinks.tsx');
  assert.match(links, /fetch\('\/api\/calendar\/links', \{\s*method: 'POST',/);
  assert.match(links, /\{ method: 'DELETE' \}/);
  const card = code('src/components/hub/HubEventCard.tsx');
  assert.match(card, /fetch\(`\/api\/operations\/daily-plan\/blocks\/\$\{block\.id\}`, \{\s*method: 'PATCH',/);
  assert.equal(count(card, /method: 'PATCH'/g), 2, 'the block, then its task');

  // Its own routes: the events route re-states and removes a row, and inserts none; no file under /api/calendar does.
  const events = code('src/app/api/calendar/events/route.ts');
  assert.match(events, /export async function PATCH\b/);
  assert.match(events, /export async function DELETE\b/);
  assert.doesNotMatch(events, /export async function (POST|PUT)\b/);
  assert.match(events, /UPDATE calendar_events SET/);
  assert.match(events, /DELETE FROM calendar_events/);
  const own = walk('src/app/api/calendar').filter((f) => /\/route\.tsx?$/.test(f)).sort();
  assert.deepEqual(own, ['src/app/api/calendar/events/route.ts', 'src/app/api/calendar/find-place/route.ts', 'src/app/api/calendar/links/route.ts', 'src/app/api/calendar/route.ts'], 'four route files under /api/calendar');
  for (const f of own) {
    assert.doesNotMatch(code(f), /INSERT INTO calendar_events|calendar_events\.(create|createMany|upsert)\(/, `${f} inserts no calendar_events row`);
  }
  // find-place: a GET whose one caller is mounted nowhere.
  assert.deepEqual(filesWith(/\/api\/calendar\/find-place/, SCREENS), ['src/components/workbench/operations/routines/FindThisPlace.tsx']);
  assert.deepEqual(importersOf('FindThisPlace'), []);
  assert.doesNotMatch(code('src/app/api/calendar/route.ts'), /export async function (POST|PATCH|PUT|DELETE)\b/, 'the feed is a GET');
  // New rows are Travel's; its itinerary route holds the one prisma-client write.
  assert.match(code('src/app/api/trips/[id]/vendor-commit/route.ts'), /INSERT INTO calendar_events \(/);
  assert.match(code('src/lib/calendar/prismaBookingCalendar.ts'), /INSERT INTO calendar_events \(/);
  assert.deepEqual(filesWith(/\.calendar_events\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/), ['src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts'], 'the one prisma-client write');
  assert.match(code('src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts'), /prisma\.calendar_events\.updateMany\(\{/);
});

// ── T9 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('T9 the counts are 5 · 9 · 11 and no tool\'s status changed', () => {
  // Typed here, in sheet order, as they stood on main 819862462 — the list this PR was held to.
  const STATUS: ReadonlyArray<readonly [string, ToolStatus]> = [
    ['Calendar', 'PARTIAL'], ['Tasks', 'LIVE'], ['Time', 'LIVE'],
    ['CRM', 'PARTIAL'], ['Contracts', 'NOT_BUILT'], ['Invoicing', 'NOT_BUILT'], ['Payments', 'NOT_BUILT'],
    ['Bill Pay', 'PARTIAL'], ['Payroll', 'NOT_BUILT'], ['Expenses', 'LIVE'], ['Travel', 'LIVE'], ['Mileage', 'NOT_BUILT'], ['Budget', 'PARTIAL'],
    ['Banking', 'PARTIAL'], ['Fixed Assets', 'NOT_BUILT'], ['Retirement', 'NOT_BUILT'], ['Brokerage', 'PARTIAL'], ['Trade Log', 'PARTIAL'],
    ['Debt', 'NOT_BUILT'], ['Sales Tax', 'NOT_BUILT'], ['Ent Filings', 'NOT_BUILT'],
    ['Bookkeeping', 'LIVE'], ['Tax', 'PARTIAL'], ['Compliance', 'PARTIAL'], ['FP&A', 'NOT_BUILT'],
  ];
  assert.equal(STATUS.length, 25);
  assert.deepEqual(TOOL_REGISTRY.map((t) => [t.name, t.status]), STATUS.map(([n, s]) => [n, s]));
  assert.deepEqual(statusCounts(), { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  // The six tools' beats, as they stood: none moved with its line.
  const beats = (name: string) => (['discover', 'decide', 'commit', 'record'] as const).filter((b) => tool(name).beats[b]).join(' · ');
  assert.equal(beats('Trade Log'), 'discover · commit · record');
  assert.equal(beats('Brokerage'), 'discover · decide');
  assert.equal(beats('Retirement'), '');
  assert.equal(beats('FP&A'), '');
  assert.equal(beats('Budget'), 'discover');
  assert.equal(beats('Calendar'), 'discover · record');
});

// ── T10 · T11 · THE NUMBERS THE REGISTRY PRINTS ─────────────────────────────────────────────────────────────────────
/**
 * Every file:line reference in the three fields that carry evidence, and in the note beside Calendar's ownTable (the
 * comment Calendar's citation names as its evidence). A file token names the file; a bare ":N" continues the file
 * named before it — the citation's own convention (truthCal.test.ts); "schema:N" is prisma/schema.prisma. `file` is
 * the path the token resolves to, or null when nothing settles it:
 *   · a full path (src/…) is itself;
 *   · a short form is, in this order, the nearest earlier path in the same field that ends with it (page.tsx after
 *     src/app/trade-log/page.tsx); else the file of that name beside or above the path named just before it
 *     (generate-tasks/route.ts after …/projects/[id]/tasks/route.ts); else the ONE file under src/ that ends with it.
 * No guess: a short form that none of the three settles is returned unresolved, and T11 fails on it by name; a bare
 * ":N" with no file named before it is returned with no token, and T10 fails on it by name.
 */
interface Reference { where: string; token: string; file: string | null; ends: number[] }
const SCHEMA = 'prisma/schema.prisma';
const TOKEN = /\bschema:(\d+)(?:-(\d+))?|([\w/.[\]@-]+\.tsx?)(?::(\d+)(?:-(\d+))?)?|(?:^|[\s·,(→])(?::(\d+)(?:-(\d+))?)(?![\w])/g;
/** The note beside Calendar's ownTable — one comment line, found by its opening words. */
const CALENDAR_NOTE = comments(REGISTRY).split('\n').find((l) => l.includes('re-read against the code: its own routes write no NEW calendar_events row')) ?? '';
function resolveShort(token: string, seen: readonly string[], all: readonly string[]): string | null {
  const earlier = [...seen].reverse().find((f) => f.endsWith(`/${token}`));
  if (earlier) return earlier;
  const last = seen[seen.length - 1];
  if (last) {
    const dir = last.split('/').slice(0, -1);
    for (; dir.length > 0; dir.pop()) {
      const beside = `${dir.join('/')}/${token}`;
      if (all.includes(beside)) return beside;
    }
  }
  const bySuffix = all.filter((f) => f.endsWith(`/${token}`));
  return bySuffix.length === 1 ? bySuffix[0] : null;
}
function references(all: readonly string[]): Reference[] {
  const out: Reference[] = [];
  const fields: [string, string][] = TOOL_REGISTRY.flatMap((t): [string, string][] => [[`${t.name}.citation`, t.citation], [`${t.name}.note`, t.note ?? ''], [`${t.name}.ownTableRoute`, t.ownTableRoute ?? '']]);
  fields.push(['Calendar.ownTable note', CALENDAR_NOTE]);
  for (const [field, text] of fields) {
    let token = '';
    let file: string | null = null;
    const seen: string[] = [];
    for (const m of text.matchAll(TOKEN)) {
      if (m[1]) { // schema:N — stands alone, and never becomes "the file named before"
        const ends = [m[1], m[2]].filter(Boolean).map(Number);
        out.push({ where: `${field}: schema:${ends.join('-')}`, token: SCHEMA, file: SCHEMA, ends });
        continue;
      }
      if (m[3]) {
        token = m[3];
        file = token.startsWith('src/') ? token : resolveShort(token, seen, all);
        if (file) seen.push(file);
      }
      const ends = [m[4] ?? m[6], m[5] ?? m[7]].filter(Boolean).map(Number);
      if (ends.length === 0) continue;
      out.push({ where: `${field}: ${token}:${ends.join('-')}`, token, file: token === '' ? null : file, ends });
    }
  }
  return out;
}
const lineCount = new Map<string, number>();
function linesOf(file: string): number {
  let n = lineCount.get(file);
  if (n === undefined) {
    const text = code(file);
    n = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    lineCount.set(file, n);
  }
  return n;
}
/** What is wrong with a resolved reference, or nothing. */
function faults(r: Reference): string[] {
  if (r.token === '') return [`${r.where} — a bare :N with no file named before it`];
  if (r.file === null) return [`${r.where} — no file settles this short form`];
  if (!existsSync(`${process.cwd()}/${r.file}`)) return [`${r.where} — ${r.file} does not exist`];
  const have = linesOf(r.file);
  const out = r.ends.filter((n) => n < 1 || n > have).map((n) => `${r.where} — ${r.file} has ${have} lines, not ${n}`);
  if (r.ends.length === 2 && r.ends[0] > r.ends[1]) out.push(`${r.where} — the range runs backwards`);
  return out;
}
const REFERENCES = references(ALL_SOURCE);

test('T10 every src/…ts(x):NN and schema:NN a citation, a note, an ownTableRoute or the note beside Calendar\'s ownTable prints names a file that exists and has that line', () => {
  const full = REFERENCES.filter((r) => r.token === '' || r.token === SCHEMA || r.token.startsWith('src/'));
  assert.deepEqual(full.flatMap(faults), [], 'a citation names a line its file does not have');
  // The walk is live: it reads the registry's evidence, not an empty set.
  assert.ok(full.length >= 110, `the registry prints ${full.length} full-path and schema file:line references in its citations, notes, ownTableRoutes and Calendar's ownTable note`);
  assert.equal(full.filter((r) => r.token === SCHEMA).length, 5, 'Payments, Bill Pay, Sales Tax, Ent Filings and Compliance each cite the schema once');
  assert.ok(CALENDAR_NOTE.length > 0, 'the note beside Calendar\'s ownTable is where T1 found it');
  assert.ok(full.filter((r) => r.where.startsWith('Calendar.ownTable note: ')).length >= 15, 'and the walk reads its file:lines');
  // Read by the path, never by the number: a re-cite must not have to touch this test.
  const reads = (prefix: string): number => full.filter((r) => r.where.startsWith(prefix)).length;
  for (const must of ['Trade Log.citation: src/app/trade-log/page.tsx:', 'Calendar.citation: src/components/hub/HubCalendar.tsx:', 'Tasks.ownTableRoute: src/app/api/operations/projects/[id]/tasks/route.ts:', 'Calendar.note: src/lib/calendar/sources.ts:']) {
    assert.ok(reads(must) >= 1, `the walk reads ${must}NN`);
  }
  // A bare ":N" is read as continuing the path before it — Brokerage cites the card's create, then its status line.
  assert.equal(reads('Brokerage.citation: src/app/api/trade-cards/route.ts:'), 2);
});

test('T11 the short forms too: every abbreviated path resolves to one file by the citation\'s own convention, and that file has the line', () => {
  const short = REFERENCES.filter((r) => r.token !== '' && r.token !== SCHEMA && !r.token.startsWith('src/'));
  assert.deepEqual(short.flatMap(faults), [], 'a short-form citation resolves to no one file, or names a line its file does not have');
  assert.ok(short.length >= 30, `the registry prints ${short.length} short-form file:line references`);
  // The three ways a short form is settled, two of each as they stand today — found by the path, never by the number.
  const fileOf = (prefix: string): string | null | undefined => short.find((r) => r.where.startsWith(prefix))?.file;
  assert.equal(fileOf('Trade Log.citation: page.tsx:'), 'src/app/trade-log/page.tsx', 'the nearest earlier path that ends with it');
  assert.equal(fileOf('Expenses.citation: route.ts:'), 'src/app/api/operations/plan-vendors/route.ts', 'the nearest earlier path that ends with it');
  assert.equal(fileOf('Tasks.citation: generate-tasks/route.ts:'), 'src/app/api/operations/projects/[id]/generate-tasks/route.ts', 'beside the path named just before it');
  assert.equal(fileOf('Brokerage.citation: scanner/route.ts:'), 'src/app/api/tastytrade/scanner/route.ts', 'beside the path named just before it');
  assert.equal(fileOf('Tax.citation: FileStep.tsx:'), 'src/components/tax-filing/steps/FileStep.tsx', 'the one file under src/ of that name');
  assert.equal(fileOf('Time.citation: stops/stopWrites.ts:'), 'src/components/workbench/operations/stops/stopWrites.ts', 'the one file under src/ of that name');
});
