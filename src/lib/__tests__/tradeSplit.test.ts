import test from 'node:test';
import assert from 'node:assert/strict';

import { navToolByName, navToolsOfScreen, phasesRenderedOn } from '../nav';
import { TOOL_GATE } from '../offer';
import { PIPE_PHASES } from '../pipePhases';
import { FOUNDER_BROKER_LINE } from '../tastytrade/founderBroker';
import { TRADE_LOG_EMPTY_ROOM, TRADE_LOG_EMPTY_ROOM_DOORS, tradeLogRoomIsEmpty } from '../tradeLogRoom';
import { code } from '../sourceText';

// TRADE-SPLIT — Brokerage (17) and Trade Log (18) are two tools on two pages.
// The founderBroker.test.ts idiom: source reads strip comments first, so a
// citation in a comment can never satisfy an assertion about the code.

const BROKERAGE = 'src/app/brokerage/page.tsx';
const TRADE_LOG = 'src/app/trade-log/page.tsx';
const TRADING = 'src/app/trading/page.tsx';

test('/trading redirects to /brokerage and renders no tool surface of its own', () => {
  const old = code(TRADING);
  assert.match(old, /redirect\('\/brokerage'\)/);
  assert.match(old, /from 'next\/navigation'/);
  // It is a redirect, not a room: nothing of either tool is left on it.
  for (const gone of ['<StageStrip', '<ToolOpener', '<ConvergenceIntelligence', '<TradeLabPanel', '<CalendarGrid', 'useTabLock']) {
    assert.equal(old.includes(gone), false, `/trading still renders ${gone}`);
  }
  // And it is no tool's screen any more — the rail sends people to the homes.
  assert.deepEqual(navToolsOfScreen('/trading', TOOL_GATE).map((t) => t.name), []);
  assert.equal(navToolByName('Brokerage', TOOL_GATE).href, '/brokerage');
  assert.equal(navToolByName('Trade Log', TOOL_GATE).href, '/trade-log');
});

test('each tool draws its own three phases — Brokerage 01-03, Trade Log 04-06', () => {
  assert.deepEqual(
    phasesRenderedOn('/brokerage', navToolByName('Brokerage', TOOL_GATE)).map((p) => `${p.pipe} ${p.num}`),
    ['trade 01', 'trade 02', 'trade 03'],
  );
  assert.deepEqual(
    phasesRenderedOn('/trade-log', navToolByName('Trade Log', TOOL_GATE)).map((p) => `${p.pipe} ${p.num}`),
    ['trade 04', 'trade 05', 'trade 06'],
  );
  // Both read the shared pipe — neither retypes a phase list (TOOL-LAW-01 rule 4).
  for (const f of [BROKERAGE, TRADE_LOG]) {
    assert.match(code(f), /<StageStrip/, `${f} renders the shared strip`);
    assert.match(code(f), /PIPE_PHASES\.trade/, `${f} reads the shared pipe`);
  }
  // The destructures take their own slice and nothing more.
  assert.match(code(BROKERAGE), /const \[PIPE_SETUP, PIPE_SCAN, PIPE_REVIEW\] = PIPE_PHASES\.trade;/);
  assert.match(code(TRADE_LOG), /const \[, , , PIPE_LAB, PIPE_RECORD, PIPE_COMMIT\] = PIPE_PHASES\.trade;/);
  // Neither page names the other's phases.
  assert.equal(code(BROKERAGE).includes('PIPE_LAB'), false);
  assert.equal(code(TRADE_LOG).includes('PIPE_SCAN'), false);
});

test('a room with no trade says what it needs, and names the doors that actually fill it', () => {
  // The predicate: no trade at all is empty; one trade is not. A date filter
  // that excludes everything is NOT an empty room — the journal says that.
  assert.equal(tradeLogRoomIsEmpty([]), true);
  assert.equal(tradeLogRoomIsEmpty(null), true);
  assert.equal(tradeLogRoomIsEmpty(undefined), true);
  assert.equal(tradeLogRoomIsEmpty([{ tradeNum: '1' }]), false);

  // The line is one sentence and it states the need. TRADE-LOG-01 STEP 5: it
  // no longer says "there is no manual entry yet" — there is one now, and that
  // sentence would be the lie the room was written to avoid.
  assert.match(TRADE_LOG_EMPTY_ROOM, /^No trades yet/);
  assert.equal(/no manual entry/.test(TRADE_LOG_EMPTY_ROOM), false,
    'manual entry exists — the room must not say it does not');
  assert.match(TRADE_LOG_EMPTY_ROOM, /log one by hand/i);

  // STEP 0.4 still holds for the synced door: TastyTrade does NOT fill this
  // room, so the line never sends a customer to Brokerage's connect — it names
  // this page's own form first, then Banking (the Plaid sync) and Books.
  assert.deepEqual([...TRADE_LOG_EMPTY_ROOM_DOORS], [
    { label: 'Log a trade →', href: '#log-a-trade' },
    { label: 'Banking →', href: '/accounts' },
    { label: 'Books →', href: '/books' },
  ]);
  assert.equal(/TastyTrade|Brokerage|\/brokerage/.test(TRADE_LOG_EMPTY_ROOM), false,
    'the empty room must not point at a door that cannot fill it');

  // And the page renders it from the leaf, gated on the predicate.
  const page = code(TRADE_LOG);
  assert.match(page, /tradeLogRoomIsEmpty\(tradesData\?\.trades\)/);
  assert.match(page, /\{TRADE_LOG_EMPTY_ROOM\}/);
  assert.match(page, /data-empty-room/);
  assert.match(page, /TRADE_LOG_EMPTY_ROOM_DOORS\.map/);
});

test('the scan phase is the founder\'s broker only, and states the line to everyone else', () => {
  const page = code(BROKERAGE);
  // The gate is the one that was on /trading — unchanged, owner-only.
  assert.match(page, /\{isOwner && ttConnected && \(/);
  assert.match(page, /founderBroker=\{!isOwner\}/);
  // A non-owner is not shown an empty phase: the SCAN/REVIEW cell states why,
  // from the same const the route refuses with.
  assert.match(page, /\{!isOwner && \(/);
  assert.match(page, /\{FOUNDER_BROKER_LINE\}/);
  assert.match(page, /data-founder-broker/);
  // The line itself is TT-01's, verbatim — never a second wording.
  assert.equal(FOUNDER_BROKER_LINE, "Trading runs on the founder's broker until per-user connections ship.");
  // The scanner itself is still behind the gate, not rendered beside the line.
  assert.ok(page.indexOf('<ConvergenceIntelligence') > page.indexOf('isOwner && ttConnected'),
    'the scanner renders inside the owner gate');
});

test('phase 06 still hands off to Books — the pipe\'s own link, carried to the new page', () => {
  const commit = PIPE_PHASES.trade.find((p) => p.num === '06');
  assert.ok(commit, 'trade 06 exists');
  assert.equal(commit.name, 'COMMIT');
  assert.equal(commit.link?.target, 'books');
  assert.equal(commit.link?.label, 'IN BOOKS →');
  // Trade Log carries it: the commit surface and the link to the ledger's room.
  const page = code(TRADE_LOG);
  assert.match(page, /href="\/books"/);
  assert.match(page, /PIPE_COMMIT\.link\?\.label/);
  assert.match(page, /\/api\/trading\/commit-to-ledger/, 'the commit itself moved whole');
  // Brokerage does not carry the hand-off — 06 is not its phase.
  assert.equal(code(BROKERAGE).includes('/api/trading/commit-to-ledger'), false);
});

test('the grandfather list is empty — TOOL-LAW-01 has no exceptions to rule 1', () => {
  const law = code('scripts/assert-tool-registry.ts');
  assert.match(law, /const MULTI_TOOL_ALLOWED: ReadonlyArray<\{[^}]*\}> = \[\];/);
  assert.match(law, /if \(MULTI_TOOL_ALLOWED\.length > 0\) \{/);
  // No page serves two tools.
  const byHref = new Map<string, string[]>();
  for (const name of ['Brokerage', 'Trade Log']) {
    const href = navToolByName(name, TOOL_GATE).href;
    if (href) byHref.set(href, [...(byHref.get(href) ?? []), name]);
  }
  assert.deepEqual([...byHref.keys()].sort(), ['/brokerage', '/trade-log']);
  for (const [href, tools] of byHref) assert.equal(tools.length, 1, `${href} serves one tool`);
});

test('both tools stay PARTIAL, and each says why in its own words', () => {
  const brokerage = navToolByName('Brokerage', TOOL_GATE);
  const tradeLog = navToolByName('Trade Log', TOOL_GATE);
  assert.equal(brokerage.status, 'PARTIAL');
  assert.equal(tradeLog.status, 'PARTIAL');
  // The registry's `why` is what the screen prints under the tool's name
  // (NavTool.line) — never the citation.
  assert.equal(brokerage.line, "runs on the founder's broker until per-user connections ship (TT-02)");
  // Trade Log's why is STEP 0.4's finding, stated as the reason the job is not
  // done for a customer: the only writer is the Plaid commit path.
  assert.match(tradeLog.line ?? '', /a customer cannot log a trade/);
  assert.match(tradeLog.line ?? '', /no manual entry/);
  assert.match(tradeLog.line ?? '', /not done for a customer on production yet/);
  // The line is RENDERED under the tool's name, so it carries no source path —
  // that is the citation field's job (the citation law).
  assert.equal(/\.tsx?:\d+/.test(tradeLog.line ?? ''), false, 'a rendered line is never a citation');
  assert.equal(/\.tsx?:\d+/.test(brokerage.line ?? ''), false);
});
