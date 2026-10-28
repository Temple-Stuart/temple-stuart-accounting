/**
 * BOOKS-GATE-01 (Alex, 2026-10-28) — no Plaid call for a locked viewer; no balance read as zero.
 *
 *   A. BooksPipeline's bank hook takes an explicit `enabled` = !roomLocked — the panel's booksLocked, read through
 *      the RoomLock BooksPanel wraps it in. Locked: no link-token POST, no OAuth-return read. Unlocked: as before.
 *   B. The Books summary's sums read each trial-balance balance through readableBalanceOf: a finite number (or a
 *      numeric string) sums as before; anything else throws by name, and the panel shows its existing error words.
 *
 * No DOM library is installed, so the components are CALLED under a stand-in React dispatcher that records their
 * effects; the effects then run against a stubbed fetch and window, and the requests they make are counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { code, comments } from '../sourceText';
import { MISSING_ACCOUNTS_WORDS, readableBalanceOf, sumByType, trialBalanceAccountsOf, unreadableBalanceWords } from '../books/cockpitSums';

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

test('B readableBalanceOf: a number and a numeric string read; "abc", null, undefined, "", NaN, Infinity throw by name', () => {
  assert.equal(readableBalanceOf({ accountCode: '1010', normalBalance: 1250.5 }), 1250.5);
  assert.equal(readableBalanceOf({ accountCode: '1010', normalBalance: '1250.50' }), 1250.5);
  assert.equal(readableBalanceOf({ accountCode: '1010', normalBalance: -40 }), -40);
  assert.equal(readableBalanceOf({ accountCode: '1010', normalBalance: 0 }), 0, 'a real zero is a zero');
  for (const bad of ['abc', null, undefined, '', '  ', Number.NaN, Number.POSITIVE_INFINITY, 'Infinity', true, {}, []]) {
    assert.throws(() => readableBalanceOf({ accountCode: '1010', normalBalance: bad }), { message: 'trial balance account 1010 has no readable normalBalance' }, `${JSON.stringify(bad)} throws`);
  }
  assert.equal(unreadableBalanceWords('P-1010'), 'trial balance account P-1010 has no readable normalBalance');
});

test('B sumByType: Σ |balance| over the type\'s accounts as before; an unreadable one in the sum throws; one outside the three types is not read', () => {
  const rows = [
    { accountCode: '1010', accountType: 'asset', normalBalance: 1000 },
    { accountCode: '1020', accountType: 'asset', normalBalance: '250.25' },
    { accountCode: '1030', accountType: 'asset', normalBalance: -50 },
    { accountCode: '2010', accountType: 'liability', normalBalance: 300 },
    { accountCode: '6150', accountType: 'expense', normalBalance: null },
  ];
  assert.equal(sumByType(rows, 'asset'), 1300.25, 'the absolute balances, summed — the bar\'s figure, unchanged');
  assert.equal(sumByType(rows, 'liability'), 300);
  assert.equal(sumByType(rows, 'equity'), 0, 'no equity account: a real 0');
  assert.throws(() => sumByType([...rows, { accountCode: '1040', accountType: 'asset', normalBalance: null }], 'asset'), { message: 'trial balance account 1040 has no readable normalBalance' });
  assert.throws(() => sumByType([...rows, { accountCode: '3010', accountType: 'equity', normalBalance: 'abc' }], 'equity'), { message: 'trial balance account 3010 has no readable normalBalance' });
  assert.doesNotMatch(code(SUMS), /\|\|\s*0|\?\?\s*0|\bfetch\b|from 'react'|Date\.now|new Date/, 'no zero in place of a balance; pure');
});

const TB_OK = (accounts: unknown[]) => ({ totals: { isBalanced: true, hasActivity: true }, accounts });
const answerWith = (tb: unknown) => (url: string): unknown =>
  url === '/api/trial-balance' ? tb
    : url === '/api/accounts' ? { items: [{ accounts: [{}, {}] }] }
      : url.startsWith('/api/closing-periods') ? { periods: [] }
        : url === '/api/plaid/link-token' ? {}
          : undefined;

test('B the panel: an unreadable balance puts the panel in its error state (its existing words); numeric strings sum into the bar as before', async () => {
  const { BooksPanel } = await import('../../components/home/ModuleLauncher');
  const bad = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([
    { accountCode: '1010', accountType: 'asset', normalBalance: 500 },
    { accountCode: '1020', accountType: 'asset', normalBalance: null },
  ])));
  assert.ok(bad.stateWrites.includes('error'), 'the panel\'s state is error');
  assert.ok(!bad.stateWrites.includes('ok'), 'never ok with a balance it could not read');
  assert.ok(!bad.stateWrites.some((w) => typeof w === 'object' && w !== null && 'totalAssets' in w), 'no total is drawn');
  const good = await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([
    { accountCode: '1010', accountType: 'asset', normalBalance: '500.50' },
    { accountCode: '1020', accountType: 'asset', normalBalance: 99.5 },
    { accountCode: '2010', accountType: 'liability', normalBalance: '-120' },
    { accountCode: '3010', accountType: 'equity', normalBalance: 480 },
  ])));
  assert.ok(good.stateWrites.includes('ok'));
  assert.deepEqual(good.stateWrites.find((w) => typeof w === 'object' && w !== null && 'totalAssets' in w), {
    totalAssets: 600, totalLiabilities: 120, totalEquity: 480, isBalanced: true, hasActivity: true, connectedAccounts: 2, periodStatus: 'open',
  });
  // A locked panel reads nothing at all — its own gate, unchanged (COCKPIT-PERF-01).
  const locked = await drive(BooksPanel as never, { booksLocked: true, lapsed: null }, true, answerWith(TB_OK([])));
  assert.deepEqual(locked.requests, []);
  // The error state renders the panel's existing words — no new copy.
  const l = code(LAUNCHER);
  assert.match(l, /\{booksState === 'error' && \(\n\s*<div role="alert" className=\{`\$\{STATE\.errorCard\} flex items-center justify-between gap-3`\}>\n\s*<span>Couldn&rsquo;t load your books right now\. Nothing is assumed — the balance sheet is hidden until it loads\.<\/span>/);
  assert.match(l, /const sumBy = \(type: string\) => sumByType\(tbAccounts, type\);/);
  assert.doesNotMatch(l, /Number\(a\.normalBalance\) \|\| 0/, 'the zero in place of a balance is gone');
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
    ['trial balance account 1020 has no readable normalBalance', TB_OK([{ accountCode: '1020', accountType: 'asset', normalBalance: null }])],
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
    await drive(BooksPanel as never, { booksLocked: false, lapsed: null }, false, answerWith(TB_OK([{ accountCode: '1010', accountType: 'asset', normalBalance: 5 }])));
  } finally {
    console.error = real;
  }
  assert.deepEqual(logged, []);
  const l = code(LAUNCHER);
  assert.match(l, /\} catch \(err\) \{\n\s*console\.error\('\[books\] cockpit summary:', err\);\n\s*setBooksData\(null\);\n\s*setBooksState\('error'\);/);
});
