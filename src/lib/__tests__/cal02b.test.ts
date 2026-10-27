/**
 * CAL-02 (Alex, 2026-10-27) — THE ACCOUNT REACHES THE CALENDAR TILE. (cal02b: cal02.test.ts is the earlier CAL-02's — the
 * ICS export and the flight segments — and stands untouched.)
 *
 * A. The grain is the ACCOUNT — book + code + name — never the bare code; the words are the tables' ("P-6150 Food & drink":
 *    accountCell + the chart's name). B. The join happens on the server, once per window: the window route reads the returned
 *    routines' books and their charts ONCE and ships `account` + `account_state` per routine and per line, beside the unchanged
 *    coa_code; 'missing' for a saved code with no chart row — the account carrying its code and book with name null (ruling 1,
 *    2026-10-27); 'none' without a code. C. The tile carries `account` + `accountState` by the leaf grain, read off the lines'
 *    OWN codes (ruling 3 — routinePlanned's coaCode is null for every costed-lines routine): all coded lines one code → that
 *    account; two or more → 'several', null; none coded → the routine's own. D. The panel's ACCOUNT row and each line print the
 *    one words rule. E. No colour, no legend, no schema, no migration, no new route; the window's params, auth, window and cap
 *    unchanged; the answer additive. The 'missing' state is legacy-only (planMoney writes the chart row's own code; the chart
 *    archives, never deletes) — proven here with fixtures, never a direct DB edit (ruling 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, comments } from '../sourceText';
import {
  ACCOUNT_NOT_READ_WORDS, NO_ACCOUNT_WORDS, SEVERAL_ACCOUNTS_WORDS, accountCodeWords, accountOf, accountWords, annotateWindow, readAccountWords, tileAccountOf,
  type TileBook,
} from '../hub/tileAccount';
import { mapOperationsRoutines, type RoutineWindowEntry } from '../hub/mapOperationsRoutines';
import { buildDrill } from '../calendar/chain';
import { CHART_MISSING_WORDS, accountWordsOf, type WorkChart } from '../operations/work';

const ROUTE = 'src/app/api/hub/operations-routines/route.ts';
const RULE = 'src/lib/hub/tileAccount.ts';
const MAPPER = 'src/lib/hub/mapOperationsRoutines.ts';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const HUB = 'src/components/hub/HubCalendar.tsx';
const CHAIN = 'src/lib/calendar/chain.ts';
const SOURCES = 'src/lib/calendar/sources.ts';

const P: TileBook = { id: 'P', entity_type: 'personal' };
const B: TileBook = { id: 'B', entity_type: 'sole_prop' };
const BOOKS = [P, B];
const chart = (entity_id: string, rows: readonly (readonly [string, string])[]): WorkChart => rows.map(([c, name]) => ({ code: c, name, account_type: 'expense', entity_id }));
const P_CHART = chart('P', [['6150', 'Food & drink'], ['6200', 'Fitness']]);
const B_CHART = chart('B', [['6080', 'Office Expense'], ['6200', 'Software & SaaS']]);
const CHARTS = new Map<string, WorkChart>([['P', P_CHART], ['B', B_CHART]]);
const FOOD = { code: '6150', name: 'Food & drink', book: 'P' };
const GONE = { code: '9999', name: null, book: 'P' };

// ── RULING A · THE GRAIN AND THE WORDS ───────────────────────────────────────

test('A one saved code reads as its account — book + code + name, never the bare code: 6200 is Fitness in the P book and Software & SaaS in the B book; a lettered code reads as its digits; 9999 → missing with its code and book, name null; blank → none; the words are the tables’ own', () => {
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', '6150'), { account: FOOD, account_state: 'account' });
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', '6200'), { account: { code: '6200', name: 'Fitness', book: 'P' }, account_state: 'account' });
  assert.deepEqual(accountOf(BOOKS, B_CHART, 'B', '6200'), { account: { code: '6200', name: 'Software & SaaS', book: 'B' }, account_state: 'account' }, 'the same four digits, another book, another account');
  assert.deepEqual(accountOf(BOOKS, B_CHART, 'B', 'B-6080'), { account: { code: '6080', name: 'Office Expense', book: 'B' }, account_state: 'account' }, 'a lettered saved code: its digits');
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', '9999'), { account: GONE, account_state: 'missing' }, 'no chart row: the code and the book travel, the name is null (ruling 1)');
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', null), { account: null, account_state: 'none' });
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', '  '), { account: null, account_state: 'none' });
  assert.deepEqual(accountOf(BOOKS, P_CHART, 'P', 'abc'), { account: { code: 'abc', name: null, book: 'P' }, account_state: 'missing' }, 'a code the chart’s rule cannot read (legacy only): missing, as saved');
  assert.throws(() => accountOf(BOOKS, P_CHART, 'T', '6150'), /book T was not read with the window/);
  // The words: the tables' (work.ts accountWordsOf) for an account and for a missing one; the tile's two more states.
  const books = [{ ...P, name: 'Personal' }, { ...B, name: 'Business' }];
  assert.equal(accountWords(FOOD, 'account'), 'P-6150 Food & drink');
  assert.equal(accountWords(FOOD, 'account'), accountWordsOf(books, { P: P_CHART, B: B_CHART }, 'P', '6150'), 'the chip words are THE WORK’s');
  assert.equal(accountWords(GONE, 'missing'), `P-9999 — ${CHART_MISSING_WORDS}`);
  assert.equal(accountWords(GONE, 'missing'), accountWordsOf(books, { P: P_CHART, B: B_CHART }, 'P', '9999'));
  assert.equal(accountWords({ code: '6080', name: 'Office Expense', book: 'B' }, 'account'), 'B-6080 Office Expense');
  assert.equal(accountWords(null, 'several'), SEVERAL_ACCOUNTS_WORDS);
  assert.equal(accountWords(null, 'none'), NO_ACCOUNT_WORDS);
  assert.deepEqual([SEVERAL_ACCOUNTS_WORDS, NO_ACCOUNT_WORDS, ACCOUNT_NOT_READ_WORDS, CHART_MISSING_WORDS], ['several accounts', 'no account', 'account not read', 'not in the chart']);
  assert.equal(accountCodeWords({ code: '6150', name: null, book: '' }), '6150', 'an unlettered book: the digits alone');
  assert.throws(() => accountWords(null, 'missing'), /a missing account carries its code and book/);
  assert.throws(() => accountWords(GONE, 'account'), /an account carries its name/);
  assert.equal(readAccountWords({}), ACCOUNT_NOT_READ_WORDS, 'a row the window did not read with its account says so — never a blank, never a guess');
  assert.equal(readAccountWords({ account: FOOD, accountState: 'account' }), 'P-6150 Food & drink');
  // The rule reuses the tables' two readers — nothing re-reads a code here.
  assert.match(code(RULE), /import \{ accountCell, type AccountCellBook \} from '@\/lib\/coa\/accountCell';/);
  assert.match(code(RULE), /import \{ CHART_MISSING_WORDS, chartNameOf, type WorkChart \} from '@\/lib\/operations\/work';/);
  assert.doesNotMatch(code(RULE), /parseCode|deriveAccountString|ENTITY_LETTER|letterFor|\bfetch\b|@prisma\/client|from 'react'/, 'pure; the code is read by accountCell, the name by chartNameOf');
});

// ── RULING B · THE ROUTE: ONE CHART READ PER WINDOW, THE ANSWER ADDITIVE ─────

const stepless = { routine_id: 'r1', name: 'Brunch', entity_id: 'P', timezone: 'Asia/Makassar', start_time: '1970-01-01T11:00:00.000Z', end_time: '1970-01-01T12:00:00.000Z', occurrences: ['2026-10-27T03:00:00.000Z'], coa_code: '6150', budget_amount: 25, steps: [] as { id: string; is_active: boolean; step_order: number; activity: string; time_of_day: string | null; budget_amount: number | null; coa_code: string | null }[], location: 'Luka Café Makassar', latitude: -5.1477, longitude: 119.4327, cadence: 'daily' as const };
const line = (id: string, coa_code: string | null, budget_amount: number | null, step_order = 1) => ({ id, is_active: true, step_order, activity: id, time_of_day: null, budget_amount, coa_code });
const lined = { ...stepless, routine_id: 'r2', name: 'Morning', coa_code: null, budget_amount: null, steps: [line('coffee', '6150', 5), line('walk', null, null, 2), line('ghost', '9999', 3, 3)] };

test('B annotateWindow: every routine and every line gains account + account_state by the one rule over the entry’s book and chart; every key that was in the answer is in it as it was (old ⊂ new, byte for byte)', () => {
  const before = [stepless, lined];
  const after = annotateWindow(before, BOOKS, CHARTS);
  for (let i = 0; i < before.length; i++) {
    const old = before[i] as unknown as Record<string, unknown>;
    const now = after[i] as unknown as Record<string, unknown>;
    for (const k of Object.keys(old)) {
      if (k === 'steps') continue;
      assert.equal(JSON.stringify(now[k]), JSON.stringify(old[k]), `${old.name}.${k} is as it was`);
    }
    const oldSteps = old.steps as Record<string, unknown>[];
    const newSteps = now.steps as Record<string, unknown>[];
    assert.equal(newSteps.length, oldSteps.length);
    for (let j = 0; j < oldSteps.length; j++) for (const k of Object.keys(oldSteps[j])) assert.equal(JSON.stringify(newSteps[j][k]), JSON.stringify(oldSteps[j][k]), `${old.name}.steps[${j}].${k} is as it was`);
    assert.deepEqual(Object.keys(now).filter((k) => !(k in old)), ['account', 'account_state'], 'two keys added, no more');
  }
  assert.deepEqual([after[0].account, after[0].account_state], [FOOD, 'account']);
  assert.deepEqual([after[1].account, after[1].account_state], [null, 'none'], 'the lined routine’s own: no code');
  assert.deepEqual(after[1].steps.map((s) => [s.id, s.account, s.account_state]), [['coffee', FOOD, 'account'], ['walk', null, 'none'], ['ghost', GONE, 'missing']]);
  assert.deepEqual(annotateWindow([{ ...stepless, entity_id: 'B', coa_code: '6080' }], BOOKS, CHARTS)[0].account, { code: '6080', name: 'Office Expense', book: 'B' }, 'the B book’s chart, by the entry’s book');
  assert.deepEqual(annotateWindow([{ ...stepless, entity_id: 'B' }], BOOKS, new Map())[0], { ...stepless, entity_id: 'B', account: { code: '6150', name: null, book: 'B' }, account_state: 'missing', steps: [] }, 'a book with an empty chart: missing');
  assert.deepEqual(annotateWindow([], BOOKS, CHARTS), []);
});

test('B the route: the returned routines’ books and their charts are read ONCE each, after the window is built and before the answer; the routine query, the auth, the params, the window and the cap are untouched; the answer is annotateWindow over the same `out`', () => {
  const route = code(ROUTE);
  assert.equal((route.match(/chart_of_accounts\.findMany\(/g) ?? []).length, 1, 'one chart read');
  assert.equal((route.match(/entities\.findMany\(/g) ?? []).length, 1, 'one books read');
  assert.equal((route.match(/prisma\.[a-z_]+\.findMany\(/g) ?? []).length, 3, 'routines, books, charts — nothing per routine');
  assert.equal((route.match(/prisma\.[a-z_]+\.findFirst\(/g) ?? []).length, 1, 'the user');
  const loop = route.indexOf('for (const r of routines) {');
  const charts = route.indexOf('chart_of_accounts.findMany(');
  const answer = route.indexOf('annotateWindow(out, books, chartsByBook)');
  assert.ok(loop > 0 && charts > loop && answer > charts, 'the chart read sits after the loop and before the answer — never inside it');
  assert.match(route, /const bookIds = \[\.\.\.new Set\(out\.map\(\(e\) => e\.entity_id\)\)\];/, 'the books of the routines returned');
  assert.match(route, /where: \{ id: \{ in: bookIds \}, userId: user\.id \},\n\s*select: \{ id: true, entity_type: true \},/, 'the caller’s books alone');
  assert.match(route, /where: \{ entity_id: \{ in: bookIds \}, entity: \{ userId: user\.id \} \},\n\s*select: \{ entity_id: true, code: true, name: true, account_type: true \},/, 'the caller’s charts alone — the budget report’s read shape');
  assert.match(route, /return NextResponse\.json\(\{ routines: annotateWindow\(out, books, chartsByBook\), truncated \}\);/);
  // Untouched: the routine query with its lines, the auth, the two params, the window, the cap, the guards' words.
  assert.match(route, /where: \{ user_id: user\.id, is_active: true \},\n\s*orderBy: \{ name: 'asc' \},/);
  assert.match(route, /include: \{ steps: \{ where: \{ is_active: true \}, orderBy: \{ step_order: 'asc' \} \} \},/);
  assert.match(route, /const userEmail = await getVerifiedEmail\(\);\n\s*if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(route, /const MAX_WINDOW_DAYS = 92;\nconst MAX_OCCURRENCES = 500;/);
  for (const words of ['from is required (YYYY-MM-DD)', 'to is required (YYYY-MM-DD)', 'to must be on or after from', 'window must be <= ${MAX_WINDOW_DAYS} days (got ${windowDays})']) assert.ok(route.includes(words), words);
  assert.match(route, /occurrences: taken\.map\(\(d\) => d\.toISOString\(\)\),\n\s*coa_code: r\.coa_code,/, 'coa_code stays, as it was');
  assert.match(route, /coa_code: st\.coa_code,\n\s*\}\)\),/, 'the line’s coa_code stays');
  assert.doesNotMatch(route, /prisma\.\$executeRaw|ALTER TABLE|migrations|accountCell|chartNameOf/, 'no raw SQL; the rule is the lib’s, not restated here');
});

// ── RULING C · THE TILE ──────────────────────────────────────────────────────

const entry = (over: Partial<RoutineWindowEntry> & { steps?: RoutineWindowEntry['steps'] }): RoutineWindowEntry => annotateWindow([{ ...stepless, ...over, steps: (over.steps ?? []) as typeof stepless.steps }], BOOKS, CHARTS)[0] as RoutineWindowEntry;
const tileOf = (e: RoutineWindowEntry) => mapOperationsRoutines({ routines: [e], truncated: false })[0];

test('C the tile: a stepless routine coded P-6150 → its account; two lines both 6150 → that account; lines 6150 + 6200 → several, null; no code anywhere → none; 9999 → missing with its code and book; the coded lines decide, an uncoded line beside them adds nothing; no coded line → the routine’s own; coaCode and budgetAmount on the tile are as before', () => {
  const own = tileOf(entry({}));
  assert.deepEqual([own.account, own.accountState, own.coaCode, own.budgetAmount], [FOOD, 'account', '6150', 25]);
  const shared = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', '6150', 5), line('b', '6150', 3, 2)] }));
  assert.deepEqual([shared.account, shared.accountState, shared.coaCode, shared.budgetAmount], [FOOD, 'account', null, 8], 'LINES-01’s leaf still says coaCode null for costed lines — the account is read off the lines’ own codes (ruling 3)');
  const several = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', '6150', 5), line('b', '6200', 3, 2)] }));
  assert.deepEqual([several.account, several.accountState], [null, 'several']);
  const none = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', null, null), line('b', null, null, 2)] }));
  assert.deepEqual([none.account, none.accountState, none.coaCode], [null, 'none', null]);
  const bare = tileOf(entry({ coa_code: null, budget_amount: null }));
  assert.deepEqual([bare.account, bare.accountState], [null, 'none'], 'a stepless routine with no code');
  const missing = tileOf(entry({ coa_code: '9999', budget_amount: 10 }));
  assert.deepEqual([missing.account, missing.accountState, missing.coaCode], [GONE, 'missing', '9999']);
  const missingLine = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', '9999', 5)] }));
  assert.deepEqual([missingLine.account, missingLine.accountState], [GONE, 'missing'], 'one coded line, its code not in the chart');
  const mixed = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', '6150', 5), line('b', null, 2, 2)] }));
  assert.deepEqual([mixed.account, mixed.accountState], [FOOD, 'account'], 'the coded lines share one code; the uncoded line says "no account" on its own row');
  const ownUnderLines = tileOf(entry({ coa_code: '6200', budget_amount: 12, steps: [line('a', null, null), line('b', null, null, 2)] }));
  assert.deepEqual([ownUnderLines.account, ownUnderLines.accountState], [{ code: '6200', name: 'Fitness', book: 'P' }, 'account'], 'no coded line: the routine’s own');
  const twoMissing = tileOf(entry({ coa_code: null, budget_amount: null, steps: [line('a', '9999', 5), line('b', '9998', 3, 2)] }));
  assert.deepEqual([twoMissing.account, twoMissing.accountState], [null, 'several'], 'two codes, both missing: still several');
  // An answer not read with its accounts: the tile carries neither field — nothing is claimed.
  const unread = mapOperationsRoutines({ routines: [{ ...stepless }], truncated: false })[0];
  assert.equal('account' in unread, false);
  assert.equal('accountState' in unread, false);
  assert.throws(() => mapOperationsRoutines({ routines: [{ ...entry({}), steps: [line('a', '6150', 5)] }], truncated: false }), /line a carries no account_state/, 'a line without its read, under a routine with one, is the route’s error');
  // The pure rule, driven directly.
  assert.equal(tileAccountOf({}), null);
  assert.deepEqual(tileAccountOf({ account: FOOD, account_state: 'account', steps: [] }), { account: FOOD, accountState: 'account' });
  assert.deepEqual(tileAccountOf({ account: null, account_state: 'none', steps: [{ id: 'a', account: FOOD, account_state: 'account' }, { id: 'b', account: FOOD, account_state: 'account' }] }), { account: FOOD, accountState: 'account' });
  assert.throws(() => tileAccountOf({ account: null, account_state: 'none', steps: [{ id: 'a', account: null, account_state: 'missing' }] }), /line a is missing with no account/);
  // Every occurrence tile carries the same read; the two tile shapes both carry it.
  const timed = mapOperationsRoutines({ routines: [{ ...entry({}), occurrences: ['2026-10-27T03:00:00.000Z', '2026-10-28T03:00:00.000Z'] }], truncated: false });
  assert.deepEqual(timed.map((t) => [t.startTime, t.accountState]), [['11:00', 'account'], ['11:00', 'account']]);
  const allDay = mapOperationsRoutines({ routines: [{ ...entry({}), start_time: null, end_time: null }], truncated: false })[0];
  assert.deepEqual([allDay.startTime, allDay.account, allDay.accountState], [undefined, FOOD, 'account']);
  const m = code(MAPPER);
  assert.match(m, /const tileAccount = tileAccountOf\(routine\);\n\s*const accountFields = tileAccount === null \? \{\} : \{ account: tileAccount\.account, accountState: tileAccount\.accountState \};/);
  assert.equal((m.match(/\.\.\.accountFields,/g) ?? []).length, 2, 'both tile shapes');
  assert.match(m, /const coaCode = planned\.coaCode;/, 'coaCode on the event is unchanged for its existing readers');
  assert.match(code(GRID), /account\?: TileAccount \| null;\n\s*accountState\?: TileAccountState;/, 'CalendarEvent gains the two');
});

// ── RULING D · THE PANEL ─────────────────────────────────────────────────────

test('D the drill row carries the tile’s account and each line its own; the panel’s ACCOUNT row prints the words for a routine, every other kind keeps its Category (COA) row; the lines print their own account words; "no category" is gone', () => {
  const tile = tileOf(entry({}));
  const row = buildDrill({ id: tile.id, source: tile.source, title: tile.title, startDate: tile.startDate, coaCode: tile.coaCode, budgetAmount: tile.budgetAmount ?? null, account: tile.account, accountState: tile.accountState });
  assert.deepEqual([row.kind, row.account, row.accountState, row.coaCode], ['routine', FOOD, 'account', '6150']);
  assert.equal(readAccountWords(row), 'P-6150 Food & drink');
  const unread = buildDrill({ id: tile.id, source: tile.source, title: tile.title, startDate: tile.startDate });
  assert.equal('accountState' in unread, false, 'no read, no claim');
  assert.equal(readAccountWords(unread), ACCOUNT_NOT_READ_WORDS);
  const event = buildDrill({ id: 'e1', source: 'manual', title: 'Walk', startDate: '2026-10-27', coaCode: 'P-6150' });
  assert.equal('accountState' in event, false, 'a hand-entered event is not read with an account — its Category row stands');
  // The four states' words, as the panel prints them.
  assert.deepEqual(
    [readAccountWords({ account: FOOD, accountState: 'account' }), readAccountWords({ account: null, accountState: 'several' }), readAccountWords({ account: null, accountState: 'none' }), readAccountWords({ account: GONE, accountState: 'missing' })],
    ['P-6150 Food & drink', 'several accounts', 'no account', 'P-9999 — not in the chart'],
  );
  // The lines, as HubCalendar hands them: each line's own read.
  assert.deepEqual([readAccountWords({ account: FOOD, accountState: 'account' }), readAccountWords({ account: null, accountState: 'none' }), readAccountWords({})], ['P-6150 Food & drink', 'no account', 'account not read']);
  const panel = code(PANEL);
  assert.match(panel, /\{row\.kind === 'routine' && \(\n\s*<Row label="Account" value=\{readAccountWords\(row\)\} testId="account" \/>\n\s*\)\}/);
  assert.match(panel, /\{row\.kind !== 'routine' && !\(row\.lines && row\.lines\.length > 0\) && \(\n\s*<Row label="Category \(COA\)" value=\{row\.coaCode \?\? NONE\} mono testId="coa" \/>\n\s*\)\}/, 'every other kind: the row as it was');
  assert.match(panel, /data-drill-line-coa>\n\s*\{readAccountWords\(l\)\}\n\s*<\/span>/);
  assert.doesNotMatch(panel, /no category/, 'the bare-code words left');
  assert.match(panel, /import \{ readAccountWords \} from '@\/lib\/hub\/tileAccount';/);
  const hub = code(HUB);
  assert.match(hub, /account: e\.account, accountState: e\.accountState,/, 'the tile’s account reaches the drill row');
  assert.match(hub, /const stepsById = new Map\(\(r\.steps \?\? \[\]\)\.map\(\(s\) => \[s\.id, s\]\)\);/);
  assert.match(hub, /coaCode: l\.coaCode, account: s\.account, accountState: s\.account_state \};/, 'each line’s own read, by its id');
  assert.match(hub, /if \(s === undefined\) throw new Error\(`HubCalendar: line \$\{l\.id\} of \$\{r\.name\} is not among the window's steps`\);/);
  const chain = code(CHAIN);
  assert.match(chain, /\.\.\.\(e\.accountState === undefined \? \{\} : \{ account: e\.account \?\? null, accountState: e\.accountState \}\),/);
  assert.match(chain, /readonly account\?: TileAccount \| null;\n\s*readonly accountState\?: AccountState;\n\}/, 'DrillLine gains the two');
});

// ── RULING E · NOTHING ELSE CHANGES ──────────────────────────────────────────

test('E no colour, no legend: the grid’s legend block and sources.ts are byte-identical to main 935af394; the source colour line stands; no schema, no migration, no new route; the panel’s other rows untouched', () => {
  // Read through the one reader (TEST-TRUTH-01): the legend block of code(GRID) and the whole of sources.ts (its code and its comments).
  const grid = code(GRID);
  const start = grid.indexOf('      {showCategoryLegend && (() => {');
  const end = grid.indexOf('      })()}\n', start) + '      })()}\n'.length;
  assert.ok(start > 0 && end > start, 'the legend block is where it was');
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
  assert.equal(sha(grid.slice(start, end)), '6dd5243dd7228df8d27e1fbf2f70ff219c11d9cb34b64dc789e5d7b3d1ad7ef2', 'the legend block, byte for byte (21 lines, captured on main 935af394)');
  assert.equal(sha(code(SOURCES) + comments(SOURCES)), '288471dab672b2a19a5dd554afc0185388c17f3acec92d24a5a71059255a57b5', 'sources.ts, byte for byte (captured on main 935af394)');
  assert.match(grid, /const config = sourceConfig\[event\.source\] \|\| \{ badge: 'bg-gray-400', dot: 'bg-gray-400' \};/, 'a tile is coloured by its source, as before');
  assert.doesNotMatch(grid, /\.(account|accountState)\b|accountWords|tileAccountOf/, 'the grid reads nothing of the account — the two fields are declared on the event and drawn by no line of the grid');
  assert.doesNotMatch(code(ROUTE) + code(RULE) + code(MAPPER) + code(CHAIN), /prisma\.\$executeRaw|ALTER TABLE|migrations/);
  const panel = code(PANEL);
  for (const row of ['<Row label="Date"', '<Row label="Time" value={when}', '<Row label="Where" value={row.location ?? NONE}', '<Row label="Vendor"', '<Row label="Pin" mono']) assert.ok(panel.includes(row), `${row} stands`);
  assert.match(comments(PANEL), /CAL-02 \(Alex, 2026-10-27\)\. A routine occurrence's ACCOUNT row prints the words/);
});
