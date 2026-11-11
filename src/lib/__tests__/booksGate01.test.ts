/**
 * BOOKS-GATE-01 (Alex, 2026-10-28) — no Plaid call for a locked viewer; no balance read as zero.
 *
 *   A. BooksPipeline's bank hook takes an explicit `enabled` = !roomLocked — the panel's booksLocked, read through
 *      the RoomLock BooksPanel wraps it in. Locked: no link-token POST, no OAuth-return read. Unlocked: as before.
 *   B. The Books summary's figures read each trial-balance figure through the readable rule: a finite number (or a
 *      numeric string) reads; anything else throws by name, and the panel shows its existing error words.
 *
 * BOOKS-01 (2026-11-11) re-pointed ruling B's tests. Until then the bar summed |normalBalance| per type through
 * readableBalanceOf / sumByType; now its three figures are the one balance sheet over each row's totalDebits and
 * totalCredits (src/lib/books/cockpitSums.ts barFiguresOf), and the SAME readable rule is asked of those two fields.
 * What each test pinned before is said at the test.
 *
 * No DOM library is installed, so the components are CALLED under a stand-in React dispatcher that records their
 * effects; the effects then run against a stubbed fetch and window, and the requests they make are counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { code, comments } from '../sourceText';
import { MISSING_ACCOUNTS_WORDS, barFiguresOf, readableFigureOf, trialBalanceAccountsOf, unreadableFigureWords, unreadableTypeWords } from '../books/cockpitSums';

Object.assign(globalThis, { React });

const PIPELINE = 'src/components/home/BooksPipeline.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const ROOM_LOCK = 'src/components/shell/RoomLock.tsx';
const HOOK = 'src/components/bank/useBankConnection.ts';
const SUMS = 'src/lib/books/cockpitSums.ts';

type Fetched = { method: string; url: string };
interface Run { requests: Fetched[]; storageReads: number; stateWrites: unknown[] }

/**
 * Call a function component once under a dispatcher that records effects, with RoomLock's context answering
 * `locked` (RoomLockContext defaults to false — the one boolean-false context these components read). Then run the
 * recorded effects against a fetch that answers by URL, and report every request, every localStorage read and every
 * state write. React's own internals hold the dispatcher (React 18: ReactCurrentDispatcher).
 */
async function drive(component: (props: never) => unknown, props: unknown, locked: boolean, answer: (url: string) => unknown): Promise<Run> {
  const run: Run = { requests: [], storageReads: 0, stateWrites: [] };
  const effects: Array<() => unknown> = [];
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, fetch: g.fetch };
  g.window = {
    localStorage: { getItem: () => { run.storageReads += 1; return null; }, setItem: () => {}, removeItem: () => {} },
    location: { search: '', pathname: '/books', hash: '' },
    history: { replaceState: () => {} },
  };
  g.fetch = async (url: string, init?: { method?: string }) => {
    run.requests.push({ method: init?.method ?? 'GET', url });
    const body = answer(url);
    return { ok: body !== undefined, status: body !== undefined ? 200 : 500, json: async () => body ?? {} };
  };
  const setter = (v: unknown) => { run.stateWrites.push(v); };
  const dispatcher = {
    useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, setter],
    useReducer: (_r: unknown, init: unknown) => [init, setter],
    useEffect: (f: () => unknown) => { effects.push(f); },
    useLayoutEffect: (f: () => unknown) => { effects.push(f); },
    useInsertionEffect: () => {},
    useCallback: (f: unknown) => f,
    useMemo: (f: () => unknown) => f(),
    useRef: (v: unknown) => ({ current: v }),
    useContext: (c: { _currentValue: unknown }) => (c._currentValue === false ? locked : c._currentValue),
    useId: () => 'id',
    useDebugValue: () => {},
    useImperativeHandle: () => {},
    useTransition: () => [false, (f: () => void) => f()],
    useDeferredValue: (v: unknown) => v,
    useSyncExternalStore: (_s: unknown, get: () => unknown) => get(),
  };
  const internals = (React as unknown as { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current: unknown } } })
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  const prev = internals.current;
  internals.current = dispatcher;
  try { (component as (p: unknown) => unknown)(props); } finally { internals.current = prev; }
  try {
    for (const f of effects) f();
    await new Promise((r) => setTimeout(r, 30));
  } finally {
    g.window = saved.window;
    g.fetch = saved.fetch;
  }
  return run;
}
const linkTokenPosts = (r: Run) => r.requests.filter((q) => q.method === 'POST' && q.url === '/api/plaid/link-token').length;

// ── RULING A · NO PLAID CALL FOR A LOCKED VIEWER ─────────────────────────────

test('A a locked BooksPipeline fires no link-token POST and reads no OAuth-return line; unlocked, exactly the one it always fired', async () => {
  const { default: BooksPipeline } = await import('../../components/home/BooksPipeline');
  const locked = await drive(BooksPipeline as never, {}, true, () => undefined);
  assert.equal(linkTokenPosts(locked), 0, 'locked: no link-token POST');
  assert.equal(locked.storageReads, 0, 'locked: the hook reads no OAuth-return line (localStorage untouched)');
  assert.ok(locked.requests.every((q) => !q.url.startsWith('/api/plaid/')), 'locked: no Plaid route at all');
  const unlocked = await drive(BooksPipeline as never, {}, false, () => undefined);
  assert.equal(linkTokenPosts(unlocked), 1, 'unlocked: the one link-token POST, as before');
  assert.ok(unlocked.storageReads >= 1, 'unlocked: the OAuth-return line is read, as before');
  // Everything else the pipeline reads is the same either way — the gate takes only the hook's own call away.
  assert.deepEqual(unlocked.requests.filter((q) => q.url !== '/api/plaid/link-token'), locked.requests);
});

test('A the wiring: `enabled: !roomLocked`; roomLocked is RoomLock\'s value, and BooksPanel hands RoomLock its booksLocked — no new prop', () => {
  const p = code(PIPELINE);
  assert.match(p, /const roomLocked = useRoomLock\(\);/);
  assert.match(p, /const bank = useBankConnection\(\{ onChanged: \(\) => reloadAll\(\), enabled: !roomLocked \}\);/);
  assert.equal((p.match(/useBankConnection\(/g) ?? []).length, 1, 'the pipeline calls the hook once');
  assert.match(p, /export default function BooksPipeline\(\) \{/, 'still no props — the locked state arrives through the room');
  const l = code(LAUNCHER);
  const panel = l.slice(l.indexOf('export function BooksPanel('), l.indexOf('export default function ModuleLauncher('));
  assert.match(panel, /<RoomLock locked=\{booksLocked\} lapsed=\{lapsed\} stepName="Books">[\s\S]*<BooksPipeline \/>[\s\S]*<\/RoomLock>/, 'the pipeline sits inside the RoomLock that BooksPanel locks with booksLocked');
  assert.equal((l.match(/<BooksPipeline \/>/g) ?? []).length, 1, 'its one mount');
  const r = code(ROOM_LOCK);
  assert.match(r, /if \(!locked\) return <RoomLockContext\.Provider value=\{false\}>\{children\}<\/RoomLockContext\.Provider>;/);
  assert.match(r, /<RoomLockContext\.Provider value=\{true\}>/);
  // The hook is untouched: its own gate is the `enabled` early return before the token POST.
  assert.match(code(HOOK), /useEffect\(\(\) => \{\n\s*if \(!enabled\) return;[\s\S]*?fetch\('\/api\/plaid\/link-token', \{ method: 'POST' \}\)/);
  assert.match(comments(PIPELINE), /BOOKS-GATE-01 \(Alex, 2026-10-28, ruling A\): the hook takes an explicit `enabled`/);
});

// ── RULING B · NO BALANCE READ AS ZERO ───────────────────────────────────────

// BOOKS-01 (2026-11-11): until then this pinned readableBalanceOf({ accountCode, normalBalance }) and the words
// "trial balance account 1010 has no readable normalBalance". The rule is the same rule; the fields it is asked of are
// the two the bar reads now — totalDebits and totalCredits — and the words name the field.
test('B readableFigureOf: a number and a numeric string read; "abc", null, undefined, "", NaN, Infinity throw by name — the account\'s code and the field', () => {
  assert.equal(readableFigureOf({ accountCode: '1010', totalDebits: 1250.5 }, 'totalDebits'), 1250.5);
  assert.equal(readableFigureOf({ accountCode: '1010', totalDebits: '1250.50' }, 'totalDebits'), 1250.5);
  assert.equal(readableFigureOf({ accountCode: '1010', totalCredits: -40 }, 'totalCredits'), -40);
  assert.equal(readableFigureOf({ accountCode: '1010', totalCredits: 0 }, 'totalCredits'), 0, 'a real zero is a zero');
  for (const bad of ['abc', null, undefined, '', '  ', Number.NaN, Number.POSITIVE_INFINITY, 'Infinity', true, {}, []]) {
    assert.throws(() => readableFigureOf({ accountCode: '1010', totalDebits: bad }, 'totalDebits'), { message: 'trial balance account 1010 has no readable totalDebits' }, `${JSON.stringify(bad)} throws`);
    assert.throws(() => readableFigureOf({ accountCode: '1010', totalCredits: bad }, 'totalCredits'), { message: 'trial balance account 1010 has no readable totalCredits' }, `${JSON.stringify(bad)} throws`);
  }
  assert.equal(unreadableFigureWords('P-1010', 'totalDebits'), 'trial balance account P-1010 has no readable totalDebits');
  assert.equal(unreadableFigureWords('P-1010', 'totalCredits'), 'trial balance account P-1010 has no readable totalCredits');
});

// BOOKS-01 (2026-11-11): until then this pinned sumByType — Σ |normalBalance| over a type's accounts ("the absolute
// balances, summed — the bar's figure, unchanged": 1000 + 250.25 + |−50| = 1300.25), one outside the three types not
// read. sumByType is gone: the three figures are the one balance sheet over the rows, signed, every row read.
test('B barFiguresOf: the three figures are the one balance sheet over the rows — signed, adding up; an unreadable figure in ANY row throws by name', () => {
  const rows = [
    { accountCode: '1010', accountType: 'asset', totalDebits: 100_000, totalCredits: 0 },
    { accountCode: '1020', accountType: 'asset', totalDebits: '25025', totalCredits: 0 },
    // A credit balance on an asset: it LOWERS assets (the old sum added its absolute value).
    { accountCode: '1030', accountType: 'asset', totalDebits: 0, totalCredits: 5_000 },
    { accountCode: '2010', accountType: 'liability', totalDebits: 0, totalCredits: 30_000 },
    { accountCode: '4010', accountType: 'revenue', totalDebits: 0, totalCredits: 100_025 },
    { accountCode: '6150', accountType: 'expense', totalDebits: 10_000, totalCredits: 0 },
  ];
  const sheet = barFiguresOf(rows);
  assert.equal(sheet.totalAssets, 120_025, '1,000.00 + 250.25 − 50.00: the negative balance lowers the figure');
  assert.equal(sheet.totalLiabilities, 30_000);
  assert.equal(sheet.equityAccounts, 0, 'no equity account: a real 0');
  assert.equal(sheet.earningsNotClosed, 90_025, 'revenue − expenses, inside Equity');
  assert.equal(sheet.totalEquity, 90_025);
  assert.equal(sheet.totalAssets - (sheet.totalLiabilities + sheet.totalEquity), 0, 'the three figures add up');
  assert.equal(sheet.isBalanced, true);
  // Every row is read now — revenue and expense are inside Equity — so an unreadable figure in any of them throws.
  assert.throws(() => barFiguresOf([...rows, { accountCode: '1040', accountType: 'asset', totalDebits: null, totalCredits: 0 }]), { message: 'trial balance account 1040 has no readable totalDebits' });
  assert.throws(() => barFiguresOf([...rows, { accountCode: '6200', accountType: 'expense', totalDebits: 5, totalCredits: 'abc' }]), { message: 'trial balance account 6200 has no readable totalCredits' });
  assert.throws(() => barFiguresOf([...rows, { accountCode: '3010', accountType: 'equity', totalCredits: 480 }]), { message: 'trial balance account 3010 has no readable totalDebits' });
  // A row with no type is refused by name; a figure that reads but is not whole cents is refused by the statements' rule.
  assert.throws(() => barFiguresOf([{ accountCode: '1050', totalDebits: 1, totalCredits: 0 }]), { message: 'trial balance account 1050 has no readable accountType' });
  assert.equal(unreadableTypeWords('1050'), 'trial balance account 1050 has no readable accountType');
  assert.throws(() => barFiguresOf([{ accountCode: '1060', accountType: 'asset', totalDebits: 10.5, totalCredits: 0 }]), { message: 'statements: account 1060 debits 10.5 is not an integer number of cents' });
  // A type the statements do not read: named, in no figure.
  const odd = barFiguresOf([...rows, { accountCode: '9000', accountType: 'suspense', totalDebits: 700, totalCredits: 0 }]);
  assert.deepEqual(odd.unclassified, [{ code: '9000', name: '9000', type: 'suspense' }]);
  assert.deepEqual([odd.totalAssets, odd.totalLiabilities, odd.totalEquity], [sheet.totalAssets, sheet.totalLiabilities, sheet.totalEquity]);
  assert.doesNotMatch(code(SUMS), /\|\|\s*0|\?\?\s*0|\bfetch\b|from 'react'|Date\.now|new Date/, 'no zero in place of a figure; pure');
  assert.doesNotMatch(code(SUMS), /Math\.abs|sumByType|normalBalance/, 'the absolute sum is gone');
});

const TB_OK = (accounts: unknown[]) => ({ totals: { isBalanced: true, hasActivity: true }, accounts });
const answerWith = (tb: unknown) => (url: string): unknown =>
  url === '/api/trial-balance' ? tb
    : url === '/api/accounts' ? { items: [{ accounts: [{}, {}] }] }
      : url.startsWith('/api/closing-periods') ? { periods: [] }
        : url === '/api/plaid/link-token' ? {}
          : undefined;

// BOOKS-01 (2026-11-11): until then the rows carried normalBalance, the good answer drew
// { totalAssets: 600, totalLiabilities: 120, totalEquity: 480, isBalanced: true, … } — the liability's −120 raised to
// 120, isBalanced the trial balance's — and the panel's line was `const sumBy = (type: string) => sumByType(tbAccounts, type);`.
test('B the panel: an unreadable figure puts the panel in its error state (its existing words); numeric strings read into the bar, signed, and the three figures add up', async () => {
  const { BooksPanel } = await import('../../components/home/ModuleLauncher');
  const bad = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([
    { accountCode: '1010', accountType: 'asset', totalDebits: 500, totalCredits: 0 },
    { accountCode: '1020', accountType: 'asset', totalDebits: null, totalCredits: 0 },
  ])));
  assert.ok(bad.stateWrites.includes('error'), 'the panel\'s state is error');
  assert.ok(!bad.stateWrites.includes('ok'), 'never ok with a balance it could not read');
  assert.ok(!bad.stateWrites.some((w) => typeof w === 'object' && w !== null && 'totalAssets' in w), 'no total is drawn');
  const good = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([
    { accountCode: '1010', accountType: 'asset', totalDebits: '50050', totalCredits: 0 },
    { accountCode: '1020', accountType: 'asset', totalDebits: 9950, totalCredits: '0' },
    // The card was overpaid: a liability with a debit balance — it LOWERS liabilities (the old sum drew +120).
    { accountCode: '2010', accountType: 'liability', totalDebits: '12000', totalCredits: 0 },
    { accountCode: '3010', accountType: 'equity', totalDebits: 0, totalCredits: 48_000 },
    { accountCode: '4010', accountType: 'revenue', totalDebits: 0, totalCredits: 30_000 },
    { accountCode: '6010', accountType: 'expense', totalDebits: 6_000, totalCredits: 0 },
    { accountCode: '9000', accountType: 'suspense', totalDebits: 0, totalCredits: 0 },
  ])));
  assert.ok(good.stateWrites.includes('ok'));
  assert.deepEqual(good.stateWrites.find((w) => typeof w === 'object' && w !== null && 'totalAssets' in w), {
    totalAssets: 60_000, totalLiabilities: -12_000, totalEquity: 72_000, earningsNotClosed: 24_000, unclassified: ['9000'], hasActivity: true, connectedAccounts: 2, periodStatus: 'open',
  });
  // A locked panel reads nothing at all — its own gate, unchanged (COCKPIT-PERF-01).
  const locked = await drive(BooksPanel as never, { booksLocked: true, lapsed: null }, true, answerWith(TB_OK([])));
  assert.deepEqual(locked.requests, []);
  // The error state renders the panel's existing words — no new copy.
  const l = code(LAUNCHER);
  assert.match(l, /\{booksState === 'error' && \(\n\s*<div role="alert" className=\{`\$\{STATE\.errorCard\} flex items-center justify-between gap-3`\}>\n\s*<span>Couldn&rsquo;t load your books right now\. Nothing is assumed — the balance sheet is hidden until it loads\.<\/span>/);
  assert.match(l, /const sheet = barFiguresOf\(tbAccounts\);/);
  assert.match(l, /totalAssets: sheet\.totalAssets,\n\s*totalLiabilities: sheet\.totalLiabilities,\n\s*totalEquity: sheet\.totalEquity,\n\s*earningsNotClosed: sheet\.earningsNotClosed, unclassified: sheet\.unclassified\.map\(\(u\) => u\.code\),\n\s*hasActivity: tb\.totals\.hasActivity,/);
  assert.doesNotMatch(l, /Number\(a\.normalBalance\) \|\| 0|sumByType|isBalanced: tb\.totals\.isBalanced/, 'the zero in place of a balance, the absolute sum and the borrowed mark are gone');
});

test('B ruling 6: a trial balance without its accounts array throws by name and the panel shows its error words — never a $0 bar; an empty list stays a real empty ledger', async () => {
  assert.equal(MISSING_ACCOUNTS_WORDS, 'trial balance came back without its accounts');
  for (const tb of [{}, { accounts: null }, { accounts: 'none' }, { accounts: {} }, null, undefined]) {
    assert.throws(() => trialBalanceAccountsOf(tb as never), { message: MISSING_ACCOUNTS_WORDS }, `${JSON.stringify(tb)} throws`);
  }
  assert.deepEqual(trialBalanceAccountsOf({ accounts: [] }), [], 'an empty ledger is an empty list, not an error');
  // The fixture: the route's answer with totals but no accounts — the panel goes to error and draws no total.
  const { BooksPanel } = await import('../../components/home/ModuleLauncher');
  const run = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith({ totals: { isBalanced: true, hasActivity: true } }));
  assert.ok(run.stateWrites.includes('error'), 'the panel\'s state is error');
  assert.ok(!run.stateWrites.includes('ok'));
  assert.ok(!run.stateWrites.some((w) => typeof w === 'object' && w !== null && 'totalAssets' in w), 'no $0 total is drawn');
  const l = code(LAUNCHER);
  assert.match(l, /const tbAccounts = trialBalanceAccountsOf\(tb\);/);
  assert.doesNotMatch(l, /Array\.isArray\(tb\.accounts\) \? tb\.accounts : \[\]/, 'the empty list in place of a missing one is gone');
});

test('BOOKS-GATE-01b: the catch hands the thrown reason to console.error — each of the three — and the card\'s words stay', async () => {
  const { BooksPanel } = await import('../../components/home/ModuleLauncher');
  const cases: ReadonlyArray<[string, unknown]> = [
    ['trial balance missing isBalanced/hasActivity', { accounts: [] }],
    // BOOKS-01 (2026-11-11): the words named normalBalance until the bar read totalDebits and totalCredits.
    ['trial balance account 1020 has no readable totalDebits', TB_OK([{ accountCode: '1020', accountType: 'asset', totalDebits: null, totalCredits: 0 }])],
    [MISSING_ACCOUNTS_WORDS, { totals: { isBalanced: true, hasActivity: true } }],
  ];
  for (const [reason, tb] of cases) {
    const logged: unknown[][] = [];
    const real = console.error;
    console.error = (...args: unknown[]) => { logged.push(args); };
    let run: Run;
    try {
      run = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(tb));
    } finally {
      console.error = real;
    }
    assert.ok(run.stateWrites.includes('error'), `${reason}: the panel's state is error`);
    assert.equal(logged.length, 1, `${reason}: logged once`);
    assert.equal(logged[0][0], '[books] cockpit summary:');
    assert.ok(logged[0][1] instanceof Error && logged[0][1].message === reason, `${reason}: the error itself is handed over`);
  }
  // A good answer logs nothing.
  const logged: unknown[] = [];
  const real = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([{ accountCode: '1010', accountType: 'asset', totalDebits: 5, totalCredits: 0 }])));
  } finally {
    console.error = real;
  }
  assert.deepEqual(logged, []);
  const l = code(LAUNCHER);
  assert.match(l, /\} catch \(err\) \{\n\s*console\.error\('\[books\] cockpit summary:', err\);\n\s*setBooksData\(null\);\n\s*setBooksState\('error'\);/);
});
