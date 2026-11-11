import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYNC_COMPLETE_PATH, syncThroughOneWriter } from '../plaid/oneWriter';
import { failureEnvelope, readSyncResponse, stageFailed, stageOk, syncItemsEnvelope, syncLine, type ItemOutcome, type SyncOutcome } from '../plaid/failLoud';
import { RESUME_REFUSED, SYNC_PAGE_SIZE, askOnce, moreEnvelope, pagedStage, readResume, runBudget, walkItems, type PageAnswer, type PagedPorts, type SyncMore } from '../plaid/syncRun';
import { code } from '../sourceText';

// REBUILD-01 PR-3 — ONE PLAID WRITER. Hermetic: a fake fetch stands in for the browser; the
// outcome line is the HYG-01 / HYG-03 reader's, byte for byte.

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('the Sync button posts ONCE to sync-complete — no per-item loop, no other route', async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    return answer(200, { ok: true, message: 'Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions', lines: ['Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions'], items: [] });
  }) as unknown as typeof fetch;
  const outcome = await syncThroughOneWriter(fetchImpl);
  assert.equal(SYNC_COMPLETE_PATH, '/api/transactions/sync-complete');
  assert.deepEqual(calls, [{ url: SYNC_COMPLETE_PATH, method: 'POST' }]);
  assert.deepEqual(outcome, { tone: 'ok', text: 'Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions', lines: ['Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions'] });
});

test('the outcome line is the HYG-03 reader\'s: 207 → partial with one line per failed bank then the success line; a refusal → error with the route\'s message; a non-JSON body never throws', async () => {
  const partial = await syncThroughOneWriter((async () => answer(207, {
    ok: false,
    message: 'TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED) · Wells Fargo synced: 3 landed',
    lines: ['TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)', 'Wells Fargo synced: 3 landed'],
  })) as unknown as typeof fetch);
  assert.equal(partial.tone, 'partial');
  assert.deepEqual(partial.lines, ['TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)', 'Wells Fargo synced: 3 landed']);

  const refused = await syncThroughOneWriter((async () => answer(429, { ok: false, message: 'transactions (page 1): Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes' })) as unknown as typeof fetch);
  assert.equal(refused.tone, 'error');
  assert.match(refused.text, /RATE_LIMIT_EXCEEDED/);
  assert.deepEqual(refused.lines, [refused.text]);

  const unauthorized = await syncThroughOneWriter((async () => answer(401, { error: 'Unauthorized' })) as unknown as typeof fetch);
  assert.deepEqual(unauthorized, { tone: 'error', text: 'Unauthorized', lines: ['Unauthorized'] });

  const gateway = await syncThroughOneWriter((async () => new Response('<html>502</html>', { status: 502 })) as unknown as typeof fetch);
  assert.deepEqual(gateway, { tone: 'error', text: 'Sync failed: HTTP 502', lines: ['Sync failed: HTTP 502'] });
});

test('ImportDataSection posts through syncThroughOneWriter and renders the outcome line; nothing in src names the three retired routes or plaid-sync-fix', () => {
  const root = resolve(__dirname, '../../..');
  // TEST-TRUTH-01: comment-stripped. A retired route named in a comment saying it
  // is retired must not satisfy "the per-item loop is gone" — nor the reverse.
  const src = code('src/components/dashboard/ImportDataSection.tsx');
  assert.ok(src.includes("from '@/lib/plaid/oneWriter'"), 'imports the one-writer helper');
  assert.ok(src.includes('await syncThroughOneWriter()'), 'the Sync button posts through it');
  assert.ok(src.includes('{syncOutcome.text}') && src.includes('syncOutcome.lines.map('), 'renders the outcome text and its lines');
  assert.ok(!src.includes('/api/plaid/sync') && !src.includes('/api/plaid/items'), 'the per-item loop over the retired route is gone');
  for (const gone of ['src/app/api/plaid/sync/route.ts', 'src/app/api/transactions/sync/route.ts', 'src/app/api/transactions/sync-full/route.ts', 'src/lib/plaid-sync-fix.ts']) {
    // An EXISTENCE check, not a read of source text — existsSync says so plainly.
    assert.equal(existsSync(resolve(root, gone)), false, `${gone} is deleted`);
  }
});

// ─── SYNC-01 (2026-11-11) part 2 — THE ONE WRITER FOLLOWS THE RUN TO ITS END ──
//
// The route answers 202 with `more` when its request's budget is spent (src/lib/plaid/syncRun.ts). The writer posts
// again with { resume: more } until a final answer and reads the outcome from everything the answers finished. The
// fake route below is the route's own tail, built from the REAL pure pieces — readResume, runBudget, walkItems over
// pagedStage / askOnce, moreEnvelope, syncItemsEnvelope — over a fake bank; so the body the writer posts is read by
// the reader the route uses, and the lines are written by the code that writes them in production.

interface FakeLink {
  id: string;
  name: string;
  /** The account rows the app holds under the link — none makes it idle. */
  accounts: number;
  transactions: { total: number; fresh: number; latest: string | null };
  /** 'fails': the ask does not come back. */
  investments: { total: number; fresh: number; latest: string | null } | 'fails';
  holdings: number;
  /** Accounts Plaid lists under the link that the app holds no row for. */
  unheld?: string[];
}

const CHASE: FakeLink = { id: 'item-ch', name: 'Chase', accounts: 0, transactions: { total: 0, fresh: 0, latest: null }, investments: 'fails', holdings: 0 };
const ROBIN: FakeLink = {
  id: 'item-rh', name: 'Robinhood', accounts: 2,
  transactions: { total: 1200, fresh: 41, latest: '2026-11-09' },
  investments: { total: 700, fresh: 3, latest: '2026-11-07' },
  holdings: 14,
  unheld: ['Brokerage ••4417 (investment)'],
};
const WELLS: FakeLink = { id: 'item-wf', name: 'Wells Fargo', accounts: 1, transactions: { total: 300, fresh: 0, latest: '2026-11-10' }, investments: 'fails', holdings: 0 };
const RETIRED: ItemOutcome = { institution: 'Old Bank', key: 'item-old', stages: [], retired: 'replaced by a fresh link' };

interface Post { url: string; method: string | undefined; contentType: string | null; body: string | undefined }

/**
 * The route's tail over a fake bank. `asksPerRequest`: how many asks a request's budget covers — the request's clock
 * moves one tick per ask and the budget is that many ticks (Infinity: the run is never cut).
 */
function fakeRoute(links: FakeLink[], asksPerRequest: number) {
  const posts: Post[] = [];
  const answers: Array<{ status: number; body: Record<string, unknown> }> = [];
  const asked: string[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    posts.push({ url: String(url), method: init?.method, contentType: new Headers(init?.headers).get('content-type'), body: init?.body === undefined || init.body === null ? undefined : String(init.body) });
    const reply = (status: number, body: Record<string, unknown>) => { answers.push({ status, body }); return answer(status, body); };
    const read = readResume(typeof init?.body === 'string' ? init.body : '', links.map((link) => link.id));
    if (!read.ok) return reply(read.status, read.body);
    let clock = 0;
    const budget = runBudget(() => clock, asksPerRequest);
    const paged = (link: FakeLink, stage: 'transactions' | 'investments'): PagedPorts<PageAnswer> => {
      const feed = stage === 'transactions' ? link.transactions : link.investments;
      return {
        stage,
        ask: async (offset) => {
          clock += 1;
          asked.push(`${link.name}:${stage}:${offset}`);
          if (feed === 'fails') throw new Error('socket hang up');
          return { objects: Math.min(SYNC_PAGE_SIZE, feed.total - offset), total: feed.total };
        },
        land: async (page, pageNumber) => ({
          ok: true,
          counts: { landed: page.objects, already_landed: 0, corrected: 0, synced: page.objects, skipped: 0, unheld: 0, added: pageNumber === 1 && feed !== 'fails' ? feed.fresh : 0 },
        }),
        through: async () => (feed === 'fails' ? null : feed.latest),
        declare: async (error) => stageFailed(stage, error),
        ...(stage === 'transactions' ? { notes: () => (link.unheld === undefined ? [] : link.unheld) } : {}),
      };
    };
    const walked = await walkItems<FakeLink>({
      items: links,
      key: (link) => link.id,
      label: (link) => link.name,
      idle: (link) => link.accounts === 0,
      stages: [
        ['transactions', (link, from, b) => pagedStage(paged(link, 'transactions'), from, b)],
        ['investments', (link, from, b) => pagedStage(paged(link, 'investments'), from, b)],
        ['holdings', (link, _from, b) => askOnce(b, async () => {
          clock += 1;
          asked.push(`${link.name}:holdings`);
          return stageOk('holdings', { landed: link.holdings, already_landed: 0, corrected: 0, holdings: link.holdings, securities: link.holdings, unmatched: 0 });
        })],
      ],
      resume: read.resume,
      budget,
    });
    if (walked.more !== null) {
      const more = moreEnvelope(walked.more, walked.items, walked.progress);
      return reply(more.status, more.body);
    }
    const final = syncItemsEnvelope([...walked.items, RETIRED], { success: true });
    return reply(final.status, final.body);
  }) as unknown as typeof fetch;
  return { fetchImpl, posts, answers, asked };
}

const RUN_LINES = [
  'Wells Fargo — investments: Error: socket hang up',
  'Robinhood — Plaid lists an account this app does not hold under this link: Brokerage ••4417 (investment). Its transactions are not stored.',
  'Chase — holds no accounts in this app — nothing was asked of Plaid',
  'Old Bank — retired (replaced by a fresh link)',
  'Robinhood — transactions 1,200 of 1,200 pulled, 41 new, latest Nov 9, 2026 · investments 700 of 700 pulled, 3 new, latest Nov 7, 2026 · 14 holdings',
  'Wells Fargo — transactions 300 of 300 pulled, 0 new, latest Nov 10, 2026',
];

test('SYNC-01 a run the route never cuts is ONE post with no body, read as it always was — and nothing is said of progress', async () => {
  const route = fakeRoute([CHASE, ROBIN, WELLS], Infinity);
  const progress: SyncOutcome[] = [];
  const outcome = await syncThroughOneWriter(route.fetchImpl, (line) => progress.push(line));
  assert.deepEqual(route.posts, [{ url: SYNC_COMPLETE_PATH, method: 'POST', contentType: null, body: undefined }]);
  assert.deepEqual(progress, []);
  assert.deepEqual(outcome, { tone: 'partial', text: `Partial sync — ${RUN_LINES.join(' · ')}`, lines: RUN_LINES });
  // The idle link was not asked; every other link ran every stage.
  assert.deepEqual(route.asked, [
    'Robinhood:transactions:0', 'Robinhood:transactions:500', 'Robinhood:transactions:1000', 'Robinhood:investments:0', 'Robinhood:investments:500', 'Robinhood:holdings',
    'Wells Fargo:transactions:0', 'Wells Fargo:investments:0', 'Wells Fargo:holdings',
  ]);
});

test('SYNC-01 a run cut into requests: the writer posts again with { resume: more } — the last answer\'s `more`, unchanged — until the final answer, and the line moves', async () => {
  const route = fakeRoute([CHASE, ROBIN, WELLS], 2);
  const progress: SyncOutcome[] = [];
  const outcome = await syncThroughOneWriter(route.fetchImpl, (line) => progress.push(line));

  // Five posts: the first with no body, each later one carrying the `more` of the answer before it, as JSON.
  assert.equal(route.posts.length, 5);
  assert.deepEqual(route.posts[0], { url: SYNC_COMPLETE_PATH, method: 'POST', contentType: null, body: undefined });
  for (let i = 1; i < route.posts.length; i += 1) {
    assert.deepEqual(route.posts[i], { url: SYNC_COMPLETE_PATH, method: 'POST', contentType: 'application/json', body: JSON.stringify({ resume: route.answers[i - 1].body.more }) }, `post ${i + 1} continues answer ${i}`);
  }
  const firstMore: SyncMore = { item: 'item-rh', stage: 'transactions', offset: 1000, counts: { landed: 1000, already_landed: 0, corrected: 0, synced: 1000, skipped: 0, unheld: 0, added: 41 } };
  assert.deepEqual(JSON.parse(route.posts[1].body ?? ''), { resume: firstMore });
  // The last request held only Wells Fargo's holdings and the retired link — on its own it is a 200; the RUN is read below.
  assert.deepEqual(route.answers.map((a) => a.status), [202, 202, 202, 202, 200]);

  // The line under the button, as each 202 arrived.
  assert.deepEqual(progress, [
    syncLine('ok', 'Still pulling — Robinhood: transactions 1,000 of 1,200'),
    syncLine('ok', 'Still pulling — Robinhood: investments 500 of 700'),
    syncLine('ok', 'Still pulling — Wells Fargo: transactions next'),
    syncLine('ok', 'Still pulling — Wells Fargo: holdings next'),
  ]);

  // Nothing was asked twice, and nothing was skipped: the asks of the cut run are the asks of the uncut one.
  const whole = fakeRoute([CHASE, ROBIN, WELLS], Infinity);
  const uncut = await syncThroughOneWriter(whole.fetchImpl);
  assert.deepEqual(route.asked, whole.asked);

  // The outcome is the one an uninterrupted answer carries — tone, text and every line.
  assert.deepEqual(outcome, uncut);
  assert.deepEqual(outcome.lines, RUN_LINES);
  assert.equal(outcome.tone, 'partial');
});

test('SYNC-01 the joined outcome is read from the WHOLE run: a last request that only failed does not make the run a failure, and one that only succeeded does not hide an earlier one', async () => {
  // Cut after every ask: Wells Fargo's failed investments stage arrives alone in a 202; the final answer holds only its ok holdings.
  const route = fakeRoute([ROBIN, WELLS], 1);
  const outcome = await syncThroughOneWriter(route.fetchImpl);
  assert.equal(route.posts.length, 9, 'one ask per request, nine asks');
  assert.equal(route.answers[route.answers.length - 1].status, 200, 'the last request alone was all ok');
  assert.equal(outcome.tone, 'partial', 'the run was not');
  assert.deepEqual(outcome.lines, RUN_LINES.filter((line) => !line.startsWith('Chase')));
});

/** A fetch that plays a script of answers, one per post, and records every post. */
function scripted(script: Array<() => Response>) {
  const bodies: Array<string | undefined> = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const step = script[bodies.length];
    bodies.push(init?.body === undefined || init.body === null ? undefined : String(init.body));
    if (step === undefined) throw new Error('the script has no answer for this post — the writer posted more often than it should');
    return step();
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

const ROBIN_TX: ItemOutcome = { institution: 'Robinhood', key: 'item-rh', stages: [stageOk('transactions', { landed: 1200, already_landed: 0, corrected: 0, synced: 1200, skipped: 0, unheld: 0, added: 41, pulled: 1200, plaid_total: 1200 }, '2026-11-09')] };
const ROBIN_TX_LINE = 'Robinhood — transactions 1,200 of 1,200 pulled, 41 new, latest Nov 9, 2026';
const AT_INVESTMENTS: SyncMore = { item: 'item-rh', stage: 'investments', offset: 500, counts: { landed: 500, already_landed: 0, corrected: 0, synced: 500, skipped: 0, securities: 12, unheld: 0, added: 3 } };
const STILL = 'Still pulling — Robinhood: investments 500 of 700';
const more202 = (more: SyncMore, items: ItemOutcome[], progress: string) => () => { const e = moreEnvelope(more, items, progress); return answer(e.status, e.body); };

test('SYNC-01 a point that does not advance ends the run, declared: the reason first, then what had finished — never a third post', async () => {
  const run = scripted([more202(AT_INVESTMENTS, [ROBIN_TX], STILL), more202(AT_INVESTMENTS, [ROBIN_TX], STILL)]);
  const progress: SyncOutcome[] = [];
  const outcome = await syncThroughOneWriter(run.fetchImpl, (line) => progress.push(line));
  assert.deepEqual(run.bodies, [undefined, JSON.stringify({ resume: AT_INVESTMENTS })], 'two posts — it is not retried');
  const lines = [`Sync stopped — "${STILL}" did not advance. Press Sync to try again.`, ROBIN_TX_LINE];
  assert.deepEqual(outcome, { tone: 'error', text: lines.join(' · '), lines });
  assert.deepEqual(progress, [syncLine('ok', STILL)], 'the answer that did not advance is not shown as progress');

  // The same item and stage further on IS an advance — and so is the same offset in another stage or link.
  const further: SyncMore = { ...AT_INVESTMENTS, offset: 600 };
  const moved = scripted([more202(AT_INVESTMENTS, [], STILL), more202(further, [], 'Still pulling — Robinhood: investments 600 of 700'), () => { const e = syncItemsEnvelope([ROBIN_TX]); return answer(e.status, e.body); }]);
  assert.equal((await syncThroughOneWriter(moved.fetchImpl)).tone, 'ok');
  assert.deepEqual(moved.bodies, [undefined, JSON.stringify({ resume: AT_INVESTMENTS }), JSON.stringify({ resume: further })]);
});

test('SYNC-01 a later answer that is not a sync answer ends the run, declared: its own line first, then what had finished', async () => {
  const cases: Array<{ name: string; later: () => Response; first: string }> = [
    { name: 'a 401', later: () => answer(401, { error: 'Unauthorized' }), first: 'Unauthorized' },
    { name: 'the route\'s own 500', later: () => { const e = failureEnvelope('sync', new Error('the database did not answer')); return answer(e.status, e.body); }, first: 'Error: the database did not answer' },
    { name: 'a gateway page', later: () => new Response('<html>504 Gateway Timeout</html>', { status: 504 }), first: 'Sync failed: HTTP 504' },
    { name: 'a refused resume point', later: () => answer(400, { ok: false, stage: 'sync', message: RESUME_REFUSED }), first: 'The sync could not continue from where it stopped — press Sync to start again.' },
  ];
  for (const c of cases) {
    const run = scripted([more202(AT_INVESTMENTS, [ROBIN_TX], STILL), c.later]);
    const outcome = await syncThroughOneWriter(run.fetchImpl);
    const lines = [c.first, ROBIN_TX_LINE];
    assert.deepEqual(outcome, { tone: 'error', text: lines.join(' · '), lines }, c.name);
    assert.equal(run.bodies.length, 2, `${c.name}: two posts — it is not retried`);
  }
  // With nothing finished yet, the line stands alone.
  const early = scripted([more202({ item: 'item-rh', stage: 'transactions', offset: 500, counts: { landed: 500 } }, [], 'Still pulling — Robinhood: transactions 500 of 1,200'), () => answer(401, { error: 'Unauthorized' })]);
  assert.deepEqual(await syncThroughOneWriter(early.fetchImpl), { tone: 'error', text: 'Unauthorized', lines: ['Unauthorized'] });
});

test('SYNC-01 a fetch that throws is a declared outcome — on the first post and on a later one; the writer itself never throws', async () => {
  const dropped = () => { throw new TypeError('Failed to fetch'); };
  const first = scripted([dropped]);
  assert.deepEqual(await syncThroughOneWriter(first.fetchImpl), { tone: 'error', text: 'Sync failed — network: Failed to fetch', lines: ['Sync failed — network: Failed to fetch'] });
  assert.equal(first.bodies.length, 1, 'one post — it is not retried');

  const later = scripted([more202(AT_INVESTMENTS, [ROBIN_TX], STILL), dropped]);
  const progress: SyncOutcome[] = [];
  const lines = ['Sync failed — network: Failed to fetch', ROBIN_TX_LINE];
  assert.deepEqual(await syncThroughOneWriter(later.fetchImpl, (line) => progress.push(line)), { tone: 'error', text: lines.join(' · '), lines });
  assert.equal(later.bodies.length, 2, 'two posts — it is not retried');
  assert.deepEqual(progress, [syncLine('ok', STILL)]);

  // What was thrown need not be an Error.
  const odd = scripted([() => { throw 'offline'; }]);
  assert.deepEqual((await syncThroughOneWriter(odd.fetchImpl)).lines, ['Sync failed — network: offline']);
});

test('SYNC-01 only a 202 that carries `more` and its line continues the run — any other first answer is final, read by the reader as it always was', async () => {
  // A 200 is final whatever it carries.
  const ok = scripted([() => answer(200, { ok: true, more: AT_INVESTMENTS, progress: STILL, items: [], lines: ['done'], message: 'done' })]);
  assert.deepEqual(await syncThroughOneWriter(ok.fetchImpl), readSyncResponse(200, { ok: true, items: [], lines: ['done'], message: 'done' }));
  assert.equal(ok.bodies.length, 1);
  // A 202 with no `more` is not a point to continue from.
  const bare = scripted([() => answer(202, { ok: true, items: [], lines: ['accepted'], message: 'accepted' })]);
  assert.deepEqual(await syncThroughOneWriter(bare.fetchImpl), { tone: 'ok', text: 'accepted', lines: ['accepted'] });
  assert.equal(bare.bodies.length, 1);
});

test('SYNC-01 the Sync button\'s hook posts through the one writer with its own line as the progress — its own fetch of the route is gone', () => {
  const hook = code('src/components/bank/useBankConnection.ts');
  assert.ok(hook.includes("import { syncThroughOneWriter } from '@/lib/plaid/oneWriter';"));
  assert.match(hook, /const syncAccounts = useCallback\(async \(\) => \{\n\s*setSyncing\(true\);\n\s*setMessage\(null\);\n\s*try \{\n\s*setMessage\(await syncThroughOneWriter\(fetch, setMessage\)\);\n\s*await onChanged\(\);\n\s*\} finally \{\n\s*setSyncing\(false\);\n\s*\}\n\s*\}, \[onChanged\]\);/);
  assert.ok(!hook.includes("fetch('/api/transactions/sync-complete'"), 'the hook no longer posts the route itself');
  assert.equal((hook.match(/syncThroughOneWriter\(/g) ?? []).length, 1, 'one call');
  // The writer is the only place the route's path is posted from in src/lib/plaid.
  const writer = code('src/lib/plaid/oneWriter.ts');
  assert.ok(writer.includes("export const SYNC_COMPLETE_PATH = '/api/transactions/sync-complete';"));
  assert.ok(writer.includes("fetchImpl(SYNC_COMPLETE_PATH, { method: 'POST' })"), 'a fresh run posts with no body');
  assert.ok(writer.includes("body: JSON.stringify({ resume })"), 'a continued run posts { resume } as JSON');
});
