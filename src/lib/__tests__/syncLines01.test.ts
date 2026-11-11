import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOT_STORED_WORDS,
  bankLine,
  calendarDay,
  joinItemOutcomes,
  noteLine,
  stageFailed,
  stageOk,
  syncItemsEnvelope,
  syncLines,
  thousands,
  type ItemOutcome,
} from '../plaid/failLoud';
import { IDLE_NO_ACCOUNTS } from '../plaid/syncRun';
import { code } from '../sourceText';

// SYNC-01 (Alex, 2026-11-11 12:54: "lets get the sync fixed. so everything pulls") part 2 — THE LINES. One line per
// bank with what it pulled (failLoud.ts bankLine), the lines above it in their order (syncLines), and the join of a
// run that answered in parts (joinItemOutcomes). Pure: every expectation is the exact string a person reads.

/** What a completed transactions stage of a run states: the store's counts, then pulled / plaid_total (syncRun.ts pagedStage). */
const tx = (pulled: number, added: number, more: Record<string, number> = {}, through?: string) =>
  stageOk('transactions', { landed: added, already_landed: pulled - added, corrected: 0, synced: pulled, skipped: 0, unheld: 0, added, pulled, plaid_total: pulled, ...more }, through);
/** The same for investments (its counts carry the answer's securities too). */
const inv = (pulled: number, added: number, more: Record<string, number> = {}, through?: string) =>
  stageOk('investments', { landed: added, already_landed: pulled - added, corrected: 0, synced: added, skipped: pulled - added, securities: 0, unheld: 0, added, pulled, plaid_total: pulled, ...more }, through);
/** A holdings stage that wrote `written` holdings rows this run. */
const holdings = (written: number) => stageOk('holdings', { landed: written, already_landed: 0, corrected: 0, holdings: written, securities: written, unmatched: 0 });

/** An ask that did not come back — no Plaid code, so the line says what the error says. */
const hungUp = () => new Error('socket hang up');

test('L1 one bank, one stage: what was pulled of Plaid\'s total, how many were new to the app, the newest date held — Alex\'s own line', () => {
  const wells: ItemOutcome = { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(3412, 41, {}, '2026-11-09')] };
  assert.equal(bankLine(wells), 'Wells Fargo — transactions 3,412 of 3,412 pulled, 41 new, latest Nov 9, 2026');
  assert.deepEqual(syncLines([wells]), ['Wells Fargo — transactions 3,412 of 3,412 pulled, 41 new, latest Nov 9, 2026']);
  const { status, body } = syncItemsEnvelope([wells]);
  assert.equal(status, 200);
  assert.equal(body.message, 'Synced — Wells Fargo — transactions 3,412 of 3,412 pulled, 41 new, latest Nov 9, 2026');
});

test('L2 two stages and holdings: a part per ok stage in the order the stages ran, joined by " · ", the holdings written last', () => {
  const robin: ItemOutcome = { institution: 'Robinhood', key: 'item-rh', stages: [tx(4812, 0, {}, '2026-08-30'), inv(712, 3, {}, '2026-11-07'), holdings(14)] };
  assert.equal(
    bankLine(robin),
    'Robinhood — transactions 4,812 of 4,812 pulled, 0 new, latest Aug 30, 2026 · investments 712 of 712 pulled, 3 new, latest Nov 7, 2026 · 14 holdings',
  );
});

test('L3 a bracketed piece is printed only when its count is above zero: corrected (transactions only), not stored, the holdings written', () => {
  const chase: ItemOutcome = { institution: 'Chase', stages: [tx(1500, 20, { corrected: 2, unheld: 37 }, '2026-11-10'), inv(60, 5, { corrected: 4, unheld: 3 }), holdings(0)] };
  assert.equal(
    bankLine(chase),
    'Chase — transactions 1,500 of 1,500 pulled, 20 new, 2 corrected, 37 not stored (account not held here), latest Nov 10, 2026 · investments 60 of 60 pulled, 5 new, 3 not stored (account not held here)',
  );
  assert.equal(NOT_STORED_WORDS, 'not stored (account not held here)');
  // Zero of each: no piece, and no holdings part at all.
  assert.equal(bankLine({ institution: 'Chase', stages: [tx(10, 0, { corrected: 0, unheld: 0 }), holdings(0)] }), 'Chase — transactions 10 of 10 pulled, 0 new');
  // The two figures are the stage's own — printed as stated, never recomputed from one another.
  assert.equal(bankLine({ institution: 'Chase', stages: [tx(1502, 2, { plaid_total: 1500 })] }), 'Chase — transactions 1,502 of 1,500 pulled, 2 new');
});

test('L4 no `through`: the line says nothing of a latest date; a `through` that is no calendar day prints no date either — nothing is guessed', () => {
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [tx(14, 14)] }), 'Wells Fargo — transactions 14 of 14 pulled, 14 new');
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [tx(14, 14, {}, '2026-02-30')] }), 'Wells Fargo — transactions 14 of 14 pulled, 14 new');
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [tx(14, 14, {}, '2026-11-09T08:00:00.000Z')] }), 'Wells Fargo — transactions 14 of 14 pulled, 14 new');
});

test('L5 thousands: a count reads as a person writes it, in every piece of the line', () => {
  assert.deepEqual([0, 7, 999, 1000, 4812, 12345, 123456, 1234567].map(thousands), ['0', '7', '999', '1,000', '4,812', '12,345', '123,456', '1,234,567']);
  const big: ItemOutcome = { institution: 'Schwab', stages: [tx(1234567, 12345, { corrected: 1000, unheld: 2500 }), holdings(1200)] };
  assert.equal(bankLine(big), 'Schwab — transactions 1,234,567 of 1,234,567 pulled, 12,345 new, 1,000 corrected, 2,500 not stored (account not held here) · 1,200 holdings');
});

test('L6 a stage that states no figure prints no part, and a link with no part has no line — a figure nobody stated is never printed as 0', () => {
  const old: ItemOutcome = { institution: 'Wells Fargo', stages: [stageOk('transactions', { synced: 3, skipped: 0 })] };
  assert.equal(bankLine(old), null);
  assert.deepEqual(syncLines([old]), []);
  // One figure missing is enough: no half-line.
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [stageOk('transactions', { pulled: 3, plaid_total: 3 })] }), null);
  // A stage this file does not know prints nothing.
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [stageOk('balances', { pulled: 3, plaid_total: 3, added: 3 })] }), null);
  // A link with no stages (retired, idle) and a link whose every stage failed have no line of their own.
  assert.equal(bankLine({ institution: 'Old Bank', stages: [], retired: 'replaced by a fresh link' }), null);
  assert.equal(bankLine({ institution: 'Wells Fargo', stages: [stageFailed('transactions', hungUp())] }), null);
});

test('L7 a failed stage beside an ok one: the failure on its own line, above the bank\'s line for what did come — and the answer is a 207', () => {
  const wells: ItemOutcome = { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(300, 0, {}, '2026-11-10'), stageFailed('investments', hungUp()), holdings(0)] };
  const lines = syncLines([wells]);
  assert.deepEqual(lines, [
    'Wells Fargo — investments: Error: socket hang up',
    'Wells Fargo — transactions 300 of 300 pulled, 0 new, latest Nov 10, 2026',
  ]);
  const { status, body } = syncItemsEnvelope([wells]);
  assert.equal(status, 207);
  assert.equal(body.message, `Partial sync — ${lines.join(' · ')}`);
  // A failed page names its page.
  const paged: ItemOutcome = { institution: 'Wells Fargo', stages: [stageFailed('transactions', hungUp(), 3), inv(4, 4)] };
  assert.deepEqual(syncLines([paged]), ['Wells Fargo — transactions page 3: Error: socket hang up', 'Wells Fargo — investments 4 of 4 pulled, 4 new']);
});

test('L8 a note: an account Plaid lists that the app does not hold is said on its own line, with what follows from it', () => {
  assert.equal(
    noteLine('Robinhood', 'Brokerage ••4417 (investment)'),
    'Robinhood — Plaid lists an account this app does not hold under this link: Brokerage ••4417 (investment). Its transactions are not stored.',
  );
  const robin: ItemOutcome = { institution: 'Robinhood', key: 'item-rh', stages: [tx(40, 2, { unheld: 9 }, '2026-11-07')], notes: ['Brokerage ••4417 (investment)', 'Cash Management (depository)'] };
  assert.deepEqual(syncLines([robin]), [
    'Robinhood — Plaid lists an account this app does not hold under this link: Brokerage ••4417 (investment). Its transactions are not stored.',
    'Robinhood — Plaid lists an account this app does not hold under this link: Cash Management (depository). Its transactions are not stored.',
    'Robinhood — transactions 40 of 40 pulled, 2 new, 9 not stored (account not held here), latest Nov 7, 2026',
  ]);
});

test('L9 an idle link says so on its own line and decides nothing: not ok, not failed', () => {
  const idle: ItemOutcome = { institution: 'Chase', key: 'item-ch', stages: [], idle: IDLE_NO_ACCOUNTS };
  assert.deepEqual(syncLines([idle]), ['Chase — holds no accounts in this app — nothing was asked of Plaid']);
  // Beside a bank that synced: 200.
  const wells: ItemOutcome = { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(14, 14)] };
  const ok = syncItemsEnvelope([idle, wells]);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.lines, ['Chase — holds no accounts in this app — nothing was asked of Plaid', 'Wells Fargo — transactions 14 of 14 pulled, 14 new']);
  // Beside a bank whose every stage failed: that failure's status, not a 207 — the idle link is no success.
  const dead: ItemOutcome = { institution: 'Wells Fargo', key: 'item-wf', stages: [stageFailed('transactions', hungUp()), stageFailed('investments', hungUp())] };
  const failed = syncItemsEnvelope([idle, dead]);
  assert.equal(failed.status, 500);
  assert.equal(failed.body.ok, false);
  // Alone: no live bank — a 200 that says so, with the idle line.
  const alone = syncItemsEnvelope([idle]);
  assert.equal(alone.status, 200);
  assert.equal(alone.body.message, 'Synced — no live banks · Chase — holds no accounts in this app — nothing was asked of Plaid');
});

test('L10 a retired link keeps its words, and decides nothing', () => {
  const retired: ItemOutcome = { institution: 'Old Bank', key: 'item-old', stages: [], retired: 'replaced by a fresh link' };
  assert.deepEqual(syncLines([retired]), ['Old Bank — retired (replaced by a fresh link)']);
  const wells: ItemOutcome = { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(14, 14)] };
  assert.equal(syncItemsEnvelope([wells, retired]).status, 200);
});

test('L11 the order of the lines: failed (link, stage) → notes → idle → retired → one per bank; each group in the links\' own order', () => {
  const items: ItemOutcome[] = [
    { institution: 'Ally', key: 'a', stages: [tx(20, 1, {}, '2026-11-01')], notes: ['Savings ••0042 (depository)'] },
    { institution: 'Bank of the West', key: 'b', stages: [stageFailed('transactions', hungUp()), stageFailed('investments', hungUp())] },
    { institution: 'Chase', key: 'c', stages: [], idle: IDLE_NO_ACCOUNTS },
    { institution: 'Old Bank', key: 'd', stages: [], retired: 'replaced by a fresh link' },
    { institution: 'Robinhood', key: 'e', stages: [stageFailed('transactions', hungUp(), 2), inv(712, 3, {}, '2026-11-07'), holdings(14)] },
  ];
  assert.deepEqual(syncLines(items), [
    'Bank of the West — transactions: Error: socket hang up',
    'Bank of the West — investments: Error: socket hang up',
    'Robinhood — transactions page 2: Error: socket hang up',
    'Ally — Plaid lists an account this app does not hold under this link: Savings ••0042 (depository). Its transactions are not stored.',
    'Chase — holds no accounts in this app — nothing was asked of Plaid',
    'Old Bank — retired (replaced by a fresh link)',
    'Ally — transactions 20 of 20 pulled, 1 new, latest Nov 1, 2026',
    'Robinhood — investments 712 of 712 pulled, 3 new, latest Nov 7, 2026 · 14 holdings',
  ]);
  // Only the failed stages decide the status: one bank ok, one failed whole, one partial → 207.
  assert.equal(syncItemsEnvelope(items).status, 207);
});

test('L12 the one day formatter: a calendar day prints as that day, from its text — no Date, no time zone; anything else is null', () => {
  assert.equal(calendarDay('2026-11-09'), 'Nov 9, 2026');
  assert.equal(calendarDay('2026-08-30'), 'Aug 30, 2026');
  assert.equal(calendarDay('2024-01-01'), 'Jan 1, 2024');
  assert.equal(calendarDay('2024-02-29'), 'Feb 29, 2024', 'a leap day in a leap year');
  assert.equal(calendarDay('2100-02-28'), 'Feb 28, 2100');
  for (const not of ['2026-02-29', '2100-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-32', '2026-1-9', '11/09/2026', '2026-11-09T00:00:00.000Z', ' 2026-11-09', '', 'Nov 9, 2026']) {
    assert.equal(calendarDay(not), null, `${JSON.stringify(not)} is no calendar day`);
  }
  for (const not of [null, undefined, 20261109, new Date('2026-11-09T00:00:00Z'), { date: '2026-11-09' }]) assert.equal(calendarDay(not), null);
  // By content: the formatter builds no Date and asks no locale.
  const src = code('src/lib/plaid/failLoud.ts');
  const body = src.slice(src.indexOf('export function calendarDay('), src.indexOf('export function thousands('));
  assert.ok(body.length > 0);
  assert.doesNotMatch(body, /new Date|Date\.|toLocale|Intl\./);
});

test('J1 the join: a link\'s stages in the order they arrived, its notes united, idle and retired kept — and the parts are not changed', () => {
  const a = tx(1200, 41, {}, '2026-11-09');
  const b = inv(700, 3, {}, '2026-11-07');
  const c = holdings(14);
  const failed = stageFailed('investments', hungUp());
  const parts: ItemOutcome[] = [
    // request 1: the idle link the walk reached, and Robinhood's first finished stage with its note
    { institution: 'Chase', key: 'item-ch', stages: [], idle: IDLE_NO_ACCOUNTS },
    { institution: 'Robinhood', key: 'item-rh', stages: [a], notes: ['Brokerage ••4417 (investment)'] },
    // request 2: the rest of Robinhood (the same note again, and one more), then Wells Fargo's first stages
    { institution: 'Robinhood', key: 'item-rh', stages: [b, c], notes: ['Brokerage ••4417 (investment)', 'IRA ••0009 (investment)'] },
    { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(300, 0, {}, '2026-11-10'), failed] },
    // request 3: Wells Fargo's last stage, and the retired link that rides the final answer
    { institution: 'Wells Fargo', key: 'item-wf', stages: [holdings(0)] },
    { institution: 'Old Bank', key: 'item-old', stages: [], retired: 'replaced by a fresh link' },
  ];
  const before = JSON.parse(JSON.stringify(parts));
  const joined = joinItemOutcomes(parts);
  assert.deepEqual(joined, [
    { institution: 'Chase', key: 'item-ch', stages: [], idle: IDLE_NO_ACCOUNTS },
    { institution: 'Robinhood', key: 'item-rh', stages: [a, b, c], notes: ['Brokerage ••4417 (investment)', 'IRA ••0009 (investment)'] },
    { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(300, 0, {}, '2026-11-10'), failed, holdings(0)] },
    { institution: 'Old Bank', key: 'item-old', stages: [], retired: 'replaced by a fresh link' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(parts)), before, 'the parts are as they arrived');
  assert.notEqual(joined[1].stages, parts[1].stages, 'a joined link holds its own list, not a part\'s');
  // The joined lines are the lines one uninterrupted answer with the same outcomes carries.
  const whole: ItemOutcome[] = [
    { institution: 'Chase', key: 'item-ch', stages: [], idle: IDLE_NO_ACCOUNTS },
    { institution: 'Robinhood', key: 'item-rh', stages: [a, b, c], notes: ['Brokerage ••4417 (investment)', 'IRA ••0009 (investment)'] },
    { institution: 'Wells Fargo', key: 'item-wf', stages: [tx(300, 0, {}, '2026-11-10'), failed, holdings(0)] },
    { institution: 'Old Bank', key: 'item-old', stages: [], retired: 'replaced by a fresh link' },
  ];
  assert.deepEqual(syncLines(joined), syncLines(whole));
  assert.deepEqual(syncItemsEnvelope(joined), syncItemsEnvelope(whole));
  assert.deepEqual(syncLines(joined), [
    'Wells Fargo — investments: Error: socket hang up',
    'Robinhood — Plaid lists an account this app does not hold under this link: Brokerage ••4417 (investment). Its transactions are not stored.',
    'Robinhood — Plaid lists an account this app does not hold under this link: IRA ••0009 (investment). Its transactions are not stored.',
    'Chase — holds no accounts in this app — nothing was asked of Plaid',
    'Old Bank — retired (replaced by a fresh link)',
    'Robinhood — transactions 1,200 of 1,200 pulled, 41 new, latest Nov 9, 2026 · investments 700 of 700 pulled, 3 new, latest Nov 7, 2026 · 14 holdings',
    'Wells Fargo — transactions 300 of 300 pulled, 0 new, latest Nov 10, 2026',
  ]);
});

test('J2 the join is by key, never by name: two links of one bank stay two; an outcome with no key is its own entry; nothing joined is nothing', () => {
  const first = tx(10, 10);
  const second = tx(20, 0);
  const sameName = joinItemOutcomes([
    { institution: 'Chase (linked Jan 5, 2025)', key: 'item-1', stages: [first] },
    { institution: 'Chase (linked Mar 2, 2026)', key: 'item-2', stages: [second] },
    { institution: 'Chase (linked Jan 5, 2025)', key: 'item-1', stages: [holdings(3)] },
  ]);
  assert.deepEqual(sameName.map((i) => [i.key, i.stages.length]), [['item-1', 2], ['item-2', 1]]);
  const keyless = joinItemOutcomes([{ institution: 'Wells Fargo', stages: [first] }, { institution: 'Wells Fargo', stages: [second] }]);
  assert.equal(keyless.length, 2, 'no key — no claim that two outcomes are one link');
  assert.deepEqual(joinItemOutcomes([]), []);
  // A link first listed without notes takes the notes a later part brings; idle and retired arrive once and stay.
  const late = joinItemOutcomes([
    { institution: 'Robinhood', key: 'rh', stages: [first] },
    { institution: 'Robinhood', key: 'rh', stages: [], notes: ['Brokerage ••4417 (investment)'] },
  ]);
  assert.deepEqual(late, [{ institution: 'Robinhood', key: 'rh', stages: [first], notes: ['Brokerage ••4417 (investment)'] }]);
});

test('S1 by content: the run\'s one closing line is gone, and the pull\'s new code defaults no figure', () => {
  const failLoud = code('src/lib/plaid/failLoud.ts');
  assert.ok(!failLoud.includes('successLine'), 'failLoud.ts successLine is gone — its line was the run\'s, not a bank\'s');
  assert.ok(failLoud.includes('export function bankLine(') && failLoud.includes('export function joinItemOutcomes('));
  const defaults = /\?\?\s*0(?![.\d])|\|\|\s*0(?![.\d])|\?\?\s*'USD'|\|\|\s*'USD'/g;
  assert.deepEqual(failLoud.match(defaults), ['?? 0'], 'failLoud.ts holds the one counter the stated-figure law lists (sumStageCounts) and no other default');
  for (const file of ['src/lib/plaid/syncRun.ts', 'src/lib/plaid/oneWriter.ts']) {
    assert.equal(code(file).match(defaults), null, `${file} defaults no figure`);
  }
});
