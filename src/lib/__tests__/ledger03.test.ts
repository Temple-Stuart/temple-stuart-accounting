/**
 * LEDGER-03 (Alex, 2026-10-19) — THE MATCH COLUMN READS THE BOOKS' LINK.
 *
 * "Match — amount from Books … never auto link due to risk for error." A stop
 * record's Match is the posting that settled it, linked BY HAND on
 * planned_item_links (LINK-01) — the link the books already hold for a routine
 * occurrence or a line. The ledger route reads the caller's links in ONE query;
 * the rule joins each record to its links by the record's own three fields
 * (kind, target_id, occurrence_at) = the link's (target_kind, target_id,
 * target_instant); the cell prints the sum with a cue against ACTUAL; the
 * picker (LinkPicker.tsx) is LINK-01's list on the row — date order, nothing
 * pre-selected, nothing ranked; a link is audited from this ruling.
 *
 * The rule (src/lib/operations/ledger.ts) is DRIVEN over a fixture built the
 * Budget's own way, as ledger02.test.ts builds its own, with links of both
 * kinds; the routes, the leaf, the hook, the picker, the section, the
 * migration and the schema are anchored to their source with comments
 * stripped (TEST-TRUTH-01). The pins that moved in ledger01, ledger02, move01
 * and the migration-order ladder carry dated LEDGER-03 notes there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments, rejoin } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { PlanVendorRow, RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import { POSTING_LINES_SELECT, amountCentsOf } from '../calendar/postingAmount';
import {
  CANDIDATES_WORDS, LEDGER_HEAD_WORDS, LINKED_POSTINGS_WORDS, LINKS_LOADING_WORDS, LINK_WORDS, NO_CANDIDATES_WORDS, NO_LINKED_POSTINGS_WORDS, NO_READABLE_AMOUNT_WORDS, NO_SUGGESTION_WORDS,
  PICKER_CANCEL_WORDS, UNLINK_WORDS,
  ledgerCsv, ledgerOf, ledgerTotals, linkKeyOf, matchCellTitle, matchCellWords, matchCoverageWords, matchOf, matchState, matchTotalWords, postingAmountWords, postingDateWords, readableMatchCents,
  unreadableWords, varianceCoverageWords,
  type LedgerInput, type LedgerLinkInput, type LedgerRecordInput, type LedgerRow,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const PICKER = 'src/components/workbench/operations/ledger/LinkPicker.tsx';
const HOOK = 'src/components/hub/useLineLinks.tsx';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const LEAF = 'src/lib/calendar/postingAmount.ts';
const LINKS_ROUTE = 'src/app/api/calendar/links/route.ts';
const LEDGER_ROUTE = 'src/app/api/operations/ledger/route.ts';
const AUDIT_ROUTE = 'src/app/api/audit-log/route.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261019230000_ledger_03_planned_item_link_audit';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
/** The drill panel at 9680cf7b (main after #1833), whole file — LEDGER-03 touches it not at all. */
// CAL-02 (Alex, 2026-10-27): the panel's Category (COA) row became ACCOUNT for a routine occurrence and each line prints its own account words (cal02b.test.ts) — the byte-for-byte pin moved from 9680cf7b's 4e448408… to this change's file.
// LINK-LAW-01 (Alex, 2026-10-28, ruling C): a reversed linked posting wears a tag and the actual's note says how many were left out; each candidate list says how
// many reversed postings it did not offer — the byte-for-byte pin moved from CAL-02's 333c96a6… to this change's file (linkLaw01.test.ts drives the words).
const PANEL_SHA256 = 'f8eb9e968096e40178e61db8488444ac02f13793f61b6428906b67ec4b578e6c';

// ── FIXTURES (the Budget's own shapes, as ledger02.test.ts builds them) ─────

const BKK = 'Asia/Bangkok';
const FROM = '2026-10-11';
const TO = '2026-10-13';
const NOW = new Date('2026-10-14T00:00:00.000Z');
const MORNING_11 = '2026-10-11T00:00:00.000Z';
const MORNING_12 = '2026-10-12T00:00:00.000Z';
const MORNING_13 = '2026-10-13T00:00:00.000Z';
const CLIENT_13 = '2026-10-13T05:30:00.000Z';
const YOGA_12 = '2026-10-12T10:00:00.000Z';

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: BKK, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  routine({ id: 'morning', name: 'Morning', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', steps: [
    { id: 'coffee', stepOrder: 1, budgetAmount: 10, coaCode: '5100' },
    { id: 'stretch', stepOrder: 2, budgetAmount: 8, coaCode: '5100' },
    { id: 'lunch', stepOrder: 3, budgetAmount: 15, coaCode: '5200' },
  ] }),
  routine({ id: 'client', name: 'Client lunch', scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', entityId: 'B', entityType: 'sole_prop', budgetAmount: 25, coaCode: '6100' }),
];
const ROLES = new Map([['morning', 'place'], ['client', 'place'], ['yoga', 'place']]);
const WORDS = new Map<string, RoutineWords>([
  ['morning', { name: 'Morning', timezone: BKK, steps: new Map([['coffee', { activity: 'Coffee', timeOfDay: '07:30' }], ['stretch', { activity: 'Stretch', timeOfDay: '06:30' }], ['lunch', { activity: 'Lunch', timeOfDay: '12:00' }]]) }],
  ['client', { name: 'Client lunch', timezone: BKK, steps: new Map() }],
]);
const VENDORS: PlanVendorRow[] = [];
const STAYS: StayRow[] = [{ id: 'cnx', place: 'Chiang Mai, Thailand 🇹🇭', starts_on: '2026-10-13', ends_on: '2026-10-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '5100', name: 'Meals' }, { entityId: 'B', code: '6100', name: 'Client meals' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }, { id: 'B', entityType: 'sole_prop' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: `${over.occurrence_at.slice(0, 11)}00:41:00.000Z`, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const morningLine = (r: StopRecordRow, activity: string, timeOfDay: string): LedgerRecordInput => ({ record: r, routineId: 'morning', routineName: 'Morning', zone: BKK, role: 'place', activity, timeOfDay, durationMinutes: null }); // TIME-03: the input grows additively — null here, time03.test.ts drives the minutes

const RECORDS: LedgerRecordInput[] = [
  morningLine(record({ id: 'r-coffee-13', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_13, actual_cents: 898, rating: 4, note: 'khao soi, "the good one"' }), 'Coffee', '07:30'),
  morningLine(record({ id: 'r-stretch-13', kind: 'routine_line', target_id: 'stretch', occurrence_at: MORNING_13, outcome: 'skipped', done_at: null, note: 'rain' }), 'Stretch', '06:30'),
  morningLine(record({ id: 'r-lunch-13', kind: 'routine_line', target_id: 'lunch', occurrence_at: MORNING_13, rating: 3 }), 'Lunch', '12:00'),
  { record: record({ id: 'r-client-13', kind: 'routine', target_id: 'client', occurrence_at: CLIENT_13, actual_cents: 3000, rating: 5 }), routineId: 'client', routineName: 'Client lunch', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
  morningLine(record({ id: 'r-coffee-12', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_12, actual_cents: 1200, rating: 5, note: 'latte' }), 'Coffee', '07:30'),
  { record: record({ id: 'r-yoga-12', kind: 'routine', target_id: 'yoga', occurrence_at: YOGA_12, actual_cents: 500, rating: 2 }), routineId: 'yoga', routineName: 'Yoga', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
  morningLine(record({ id: 'r-coffee-11', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_11, actual_cents: 1000 }), 'Coffee', '07:30'),
];

/** The links as the route reads them — both kinds; the ones that must NOT join are named. */
const LINKS: LedgerLinkInput[] = [
  // The coffee line on Oct 13: one posting, equal to the actual to the cent.
  { kind: 'routine_line', targetId: 'coffee', instant: MORNING_13, journalEntryId: 'je-coffee-13', amountCents: 898, reversed: false },
  // The stepless client lunch on Oct 13: two postings that sum to the actual.
  { kind: 'routine', targetId: 'client', instant: CLIENT_13, journalEntryId: 'je-client-a', amountCents: 2500, reversed: false },
  { kind: 'routine', targetId: 'client', instant: CLIENT_13, journalEntryId: 'je-client-b', amountCents: 500, reversed: false },
  // The coffee line on Oct 12: a posting that differs from the actual.
  { kind: 'routine_line', targetId: 'coffee', instant: MORNING_12, journalEntryId: 'je-coffee-12', amountCents: 1000, reversed: false },
  // The yoga (no plan line): one posting the books cannot read — reported, never summed as zero.
  { kind: 'routine', targetId: 'yoga', instant: YOGA_12, journalEntryId: 'je-yoga', amountCents: null, reversed: false },
  // The lunch line on Oct 13: a posting, but the record carries no actual — a sum with no cue.
  { kind: 'routine_line', targetId: 'lunch', instant: MORNING_13, journalEntryId: 'je-lunch', amountCents: 1500, reversed: false },
  // MUST NOT JOIN: the same step and day as r-coffee-11 but one millisecond off — byte for byte, or nothing.
  { kind: 'routine_line', targetId: 'coffee', instant: '2026-10-11T00:00:00.001Z', journalEntryId: 'je-off-by-one', amountCents: 1000, reversed: false },
  // MUST NOT JOIN: the step's id under the ROUTINE kind.
  { kind: 'routine', targetId: 'coffee', instant: MORNING_11, journalEntryId: 'je-wrong-kind', amountCents: 1000, reversed: false },
  // MUST NOT JOIN: a day with no record of this routine.
  { kind: 'routine', targetId: 'client', instant: '2026-10-12T05:30:00.000Z', journalEntryId: 'je-no-record', amountCents: 2500, reversed: false },
];

const built = buildRoutineBudgetLines(ROUTINES, FROM, TO);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: FROM, to: TO, now: NOW, records: RECORDS, links: LINKS, lines: built.lines, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, ...over,
});
const ledger = ledgerOf(input());
const rowOf = (id: string): LedgerRow => {
  const row = ledger.rows.find((r) => r.id === id);
  assert.ok(row !== undefined, `row ${id}`);
  return row;
};

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

// ── R2 · THE READ AND THE JOIN ──────────────────────────────────────────────

test('R2 the join: a record meets its links by (kind, target_id, occurrence_at) = (target_kind, target_id, target_instant), byte for byte, for both kinds; off by a millisecond, the other kind, or another day joins nothing; match is null / the readable sum / the unreadable counted', () => {
  assert.equal(linkKeyOf('routine_line', 'coffee', MORNING_13), `routine_line:coffee:${MORNING_13}`);
  const coffee = rowOf('r-coffee-13');
  assert.deepEqual(coffee.address, { kind: 'routine_line', id: 'coffee', instant: MORNING_13 }, 'the record’s own three fields — the picker’s props');
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): a match counts the reversed postings it left out — none in these fixtures (linkLaw01.test.ts drives it).
  assert.deepEqual(coffee.match, { cents: 898, postings: 1, unreadable: 0, reversed: 0 }, 'a line: one posting');
  const client = rowOf('r-client-13');
  assert.deepEqual(client.address, { kind: 'routine', id: 'client', instant: CLIENT_13 });
  assert.deepEqual(client.match, { cents: 3000, postings: 2, unreadable: 0, reversed: 0 }, 'a stepless routine: two postings summed');
  assert.deepEqual(rowOf('r-coffee-12').match, { cents: 1000, postings: 1, unreadable: 0, reversed: 0 });
  assert.deepEqual(rowOf('r-yoga-12').match, { cents: null, postings: 1, unreadable: 1, reversed: 0 }, 'a posting with no readable amount: counted, never summed as zero');
  assert.deepEqual(rowOf('r-lunch-13').match, { cents: 1500, postings: 1, unreadable: 0, reversed: 0 });
  assert.equal(rowOf('r-coffee-11').match, null, 'the off-by-one-millisecond link and the wrong-kind link join nothing — null, not a guess');
  assert.equal(rowOf('r-stretch-13').match, null, 'no link: null');
  assert.equal(ledger.rows.filter((r) => r.match !== null).length, 5);
  // The rule alone.
  assert.equal(matchOf([]), null);
  // LINK-LAW-01 (2026-10-28, ruling C): a link says whether its posting was reversed, and the match counts the reversed it left out (0 here).
  assert.deepEqual(matchOf([{ amountCents: 100, reversed: false }, { amountCents: null, reversed: false }, { amountCents: 250, reversed: false }]), { cents: 350, postings: 3, unreadable: 1, reversed: 0 });
  assert.deepEqual(matchOf([{ amountCents: null, reversed: false }]), { cents: null, postings: 1, unreadable: 1, reversed: 0 });
  assert.equal(readableMatchCents(null), null);
  assert.equal(readableMatchCents({ cents: 350, postings: 3, unreadable: 1, reversed: 0 }), null, 'any unreadable posting: no readable sum');
  assert.equal(readableMatchCents({ cents: 350, postings: 2, unreadable: 0, reversed: 0 }), 350);
  // In the source: the links indexed once by the record's own key; no per-record query anywhere.
  const rules = code(RULES);
  assert.match(rules, /export const linkKeyOf = \(kind: string, id: string, instant: string\): string => `\$\{kind\}:\$\{id\}:\$\{instant\}`;/);
  assert.match(rules, /const address: LedgerAddress = \{ kind: r\.record\.kind, id: r\.record\.target_id, instant: r\.record\.occurrence_at \};/, 'the record’s fields, as stopRecord.ts answers them');
  assert.match(rules, /match: matchOf\(linksByKey\.get\(linkKeyOf\(address\.kind, address\.id, address\.instant\)\) \?\? \[\]\),/);
  assert.match(rules, /readonly links: readonly LedgerLinkInput\[\];/);
  assert.doesNotMatch(rules, /\bfetch\b|@prisma\/client|from 'react'/, 'pure');
  // The route: ONE query for the span's window, both kinds, the caller's, with each posting's lines for the one amount rule.
  const route = code(LEDGER_ROUTE);
  assert.equal((route.match(/prisma\.planned_item_links\.findMany\(/g) ?? []).length, 1, 'one query');
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the select is LINKED_POSTING_SELECT — the lines plus the reversal state.
  assert.match(route, /prisma\.planned_item_links\.findMany\(\{\n\s*where: \{ user_id: user\.id, target_kind: \{ in: \['routine', 'routine_line'\] \}, target_instant: \{ gte: recordsFrom, lt: recordsTo \}, journal_entry: \{ userId: user\.id \} \},\n\s*select: \{ target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: \{ select: LINKED_POSTING_SELECT \} \},/, 'the records’ own window, user-scoped twice');
  assert.match(route, /const \[chart, routineGroups, roles, planVendors, stayRows, recordRows, firstRow, linkRows\] = await Promise\.all\(\[/, 'read beside the records, not per record');
  assert.match(route, /links: linkRows\.map\(linkInputOf\),/);
  // ROUTINES-03 (Alex, 2026-10-25): linkInputOf moved to ledger.ts, unchanged, so the routines' month route reads a link the same way — the pins moved with it.
  assert.match(route, /import \{ ledgerOf, linkInputOf, spanInput, type LedgerRecordInput \} from '@\/lib\/operations\/ledger';/);
  assert.doesNotMatch(route, /function linkInputOf\(/, 'the mapper lives in ledger.ts now');
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the mapper reads the posting's reversal state too (LinkedPostingRow) and says whether it was reversed.
  assert.match(rules, /export function linkInputOf\(row: \{ target_kind: string; target_id: string; target_instant: Date \| null; journal_entry_id: string; journal_entry: LinkedPostingRow \}\): LedgerLinkInput \{/);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the link also says whether its posting was reversed (isReversedPosting).
  assert.match(rules, /return \{ kind: row\.target_kind, targetId: row\.target_id, instant: row\.target_instant\.toISOString\(\), journalEntryId: row\.journal_entry_id, amountCents: amountCentsOf\(row\.journal_entry\), reversed: isReversedPosting\(row\.journal_entry\) \};/, 'the instant as the record’s occurrence_at is answered — toISOString');
  assert.match(rules, /has no instant — the migration's CHECK holds one/, 'a routine kind with no instant is the database’s error');
  assert.match(code('src/app/api/operations/routines/month/route.ts'), /links: linkRows\.map\(linkInputOf\)/, 'the month route reads a link through the same mapper');
  assert.doesNotMatch(route, /planned_item_links\.findFirst|planned_item_links\.findUnique|planned_item_links\.count/, 'no per-record read');
});

test('R2 the one amount rule: amountCentsOf lives in a pure leaf both routes import — the debit’s cents, NULL with no readable debit, never zero', () => {
  assert.equal(amountCentsOf({ ledger_entries: [{ entry_type: 'D', amount: BigInt(2200) }, { entry_type: 'C', amount: BigInt(2200) }] }), 2200);
  assert.equal(amountCentsOf({ ledger_entries: [{ entry_type: 'C', amount: BigInt(2200) }] }), null, 'no debit line: null');
  assert.equal(amountCentsOf({ ledger_entries: [] }), null);
  assert.equal(amountCentsOf({ ledger_entries: [{ entry_type: 'C', amount: BigInt(1) }, { entry_type: 'D', amount: BigInt(969) }] }), 969, 'the first debit, wherever it sits');
  assert.deepEqual(POSTING_LINES_SELECT, { ledger_entries: { select: { entry_type: true, amount: true } } });
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /@prisma\/client|\bfetch\b|from 'react'|from 'next/, 'pure');
  assert.match(leaf, /export function amountCentsOf\(entry: PostingLines\): number \| null \{\n\s*const debit = entry\.ledger_entries\.find\(\(l\) => l\.entry_type === 'D'\);\n\s*if \(!debit\) return null;\n\s*const n = Number\(debit\.amount\);\n\s*return Number\.isFinite\(n\) \? n : null;\n\}/, 'the links route’s rule, moved whole');
  const links = code(LINKS_ROUTE);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the select is LINKED_POSTING_SELECT — the same lines plus the reversal state (postingAmount.ts) —
  // in the links route, the ledger route and the rules' mapper; the amount rule is unchanged and still the leaf's one copy.
  assert.match(links, /import \{ LINKED_POSTING_SELECT, PAYING_POSTING_WHERE, REVERSED_POSTING_WHERE, amountCentsOf, isReversedPosting, reversedRefusalWords \} from '@\/lib\/calendar\/postingAmount';/);
  assert.doesNotMatch(links, /function amountCentsOf/, 'no second copy');
  assert.match(links, /const ENTRY_SELECT = \{\n\s*id: true, date: true, description: true,\n\s*\.\.\.LINKED_POSTING_SELECT,\n\} as const;/, 'the same select');
  assert.match(code(LEAF), /export const LINKED_POSTING_SELECT = \{ \.\.\.POSTING_LINES_SELECT, \.\.\.POSTING_STATE_SELECT \} as const;/, 'the lines select, unchanged, inside it');
  // ROUTINES-03 (2026-10-25): the route keeps the select; the amount rule is read by ledger.ts linkInputOf, which both routes call.
  assert.match(code(LEDGER_ROUTE), /import \{ LINKED_POSTING_SELECT \} from '@\/lib\/calendar\/postingAmount';/);
  assert.match(code(RULES), /import \{ amountCentsOf, isReversedPosting, type LinkedPostingRow \} from '@\/lib\/calendar\/postingAmount';/);
  assert.match(comments(LEAF), /LEDGER-03, Alex, 2026-10-19/);
});

// ── R3 · THE CELL, THE TOTAL, THE COVERAGE, THE CSV ─────────────────────────

test('R3 the MATCH cell: the sum in dollars; "—" with no link or any unreadable posting (the title names them); the cue — equal to ACTUAL green, differing red, none when ACTUAL is null; the TOTAL row’s MATCH sums the readable rows; the coverage line replaces the LEDGER-02 note; the CSV writes the sum or empty', () => {
  assert.equal(matchCellWords(rowOf('r-coffee-13').match), '$8.98');
  assert.equal(matchCellWords(rowOf('r-client-13').match), '$30');
  assert.equal(matchCellWords(rowOf('r-yoga-12').match), '—', 'an unreadable posting: no sum shown');
  assert.equal(matchCellTitle(rowOf('r-yoga-12').match), '1 posting unreadable');
  assert.equal(matchCellWords(null), '—');
  assert.equal(matchCellTitle(null), null);
  assert.equal(matchCellTitle(rowOf('r-coffee-13').match), null);
  assert.equal(unreadableWords(2), '2 postings unreadable');
  assert.equal(matchState(rowOf('r-coffee-13').match, 898), 'equal', 'to the cent');
  assert.equal(matchState(rowOf('r-coffee-13').match, 899), 'differs');
  assert.equal(matchState(rowOf('r-client-13').match, 3000), 'equal', 'two postings summed against the actual');
  assert.equal(matchState(rowOf('r-coffee-12').match, 1200), 'differs');
  assert.equal(matchState(rowOf('r-lunch-13').match, null), null, 'no actual: no cue');
  assert.equal(matchState(rowOf('r-yoga-12').match, 500), null, 'no readable sum: no cue');
  assert.equal(matchState(null, 500), null);
  // The totals: Σ over the rows with a readable sum — the yoga's unreadable posting and the unlinked rows add nothing.
  const t = ledgerTotals(ledger.rows);
  assert.deepEqual([t.matchCents, t.withMatch], [898 + 3000 + 1000 + 1500, 4], '$8.98 + $30 + $10 + $15 over the 4 of 7 rows with a readable sum');
  assert.equal(matchTotalWords(t.matchCents), '$63.98');
  assert.equal(matchTotalWords(null), '—');
  assert.deepEqual([ledgerTotals([rowOf('r-yoga-12')]).matchCents, ledgerTotals([rowOf('r-yoga-12')]).withMatch], [null, 0], 'one unreadable posting: "—", not $0');
  assert.deepEqual([ledgerTotals([]).matchCents, ledgerTotals([]).withMatch], [null, 0]);
  // The coverage words — the same rule as the variance's, pluralised the same way.
  assert.equal(matchCoverageWords(4, 7), 'MATCH totals the 4 of 7 rows linked to the books');
  assert.equal(matchCoverageWords(7, 7), 'MATCH totals all 7 rows');
  assert.equal(matchCoverageWords(1, 1), 'MATCH totals all 1 row');
  assert.equal(matchCoverageWords(0, 25), 'MATCH totals none of the 25 rows — no row is linked to the books');
  assert.equal(matchCoverageWords(0, 1), 'MATCH totals none of the 1 row — no row is linked to the books');
  assert.throws(() => matchCoverageWords(3, 2), /3 of 2 rows is no coverage/);
  assert.equal(varianceCoverageWords(4, 7), 'VARIANCE totals the 4 of 7 rows that carry both a budget and an actual', 'the variance words unchanged');
  const rules = code(RULES);
  assert.match(rules, /export const varianceCoverageWords = \(n: number, m: number\): string => coverageWordsOf\('VARIANCE', \{ rows: 'that carry both a budget and an actual', none: 'no row carries both a budget and an actual' \}, n, m\);/);
  assert.match(rules, /export const matchCoverageWords = \(n: number, m: number\): string => coverageWordsOf\('MATCH', \{ rows: 'linked to the books', none: 'no row is linked to the books' \}, n, m\);/, 'one words rule');
  assert.doesNotMatch(rules, /MATCH_NOTE_WORDS|MATCH_CELL_WORDS|nothing is linked yet/, 'the LEDGER-02 note is gone');
  // The CSV: the readable sum, two decimals; empty with no link or an unreadable posting.
  const lines = ledgerCsv(ledger.rows).split('\r\n');
  const field = (id: string, i: number): string => lines[1 + ledger.rows.findIndex((r) => r.id === id)].split(',')[i];
  const MATCH = LEDGER_HEAD_WORDS.indexOf('MATCH');
  assert.equal(MATCH, 15); // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13.
  assert.equal(field('r-coffee-13', MATCH), '8.98');
  assert.match(lines[1 + ledger.rows.findIndex((r) => r.id === 'r-coffee-13')], /,10\.00,8\.98,-1\.02,8\.98,under,"khao soi, ""the good one"""$/, 'BUDGET · ACTUAL · VARIANCE · MATCH 8.98 · UNDER / OVER');
  assert.match(lines[1 + ledger.rows.findIndex((r) => r.id === 'r-client-13')], /,25\.00,30\.00,5\.00,30\.00,over,$/);
  assert.equal(field('r-yoga-12', MATCH), '', 'unreadable: empty');
  assert.equal(field('r-stretch-13', MATCH), '', 'no link: empty');
  assert.equal(field('r-lunch-13', MATCH), '15.00');
  assert.match(rules, /csvMoney\(readableMatchCents\(row\.match\)\),/);
  // The section: the cell, its tone, its title; the TOTAL row's MATCH; the coverage line where the note was.
  const s = code(SECTION);
  assert.match(s, /<td className=\{`\$\{money\} \$\{readableMatchCents\(row\.match\) === null \? BLANK_CLASS : `font-semibold \$\{matchTone\(matchState\(row\.match, row\.actualCents\)\)\}`\}`\} data-ledger-cell="match" title=\{matchCellTitle\(row\.match\) \?\? undefined\}>/, 'the cell');
  assert.match(s, /const matchTone = \(state: MatchState \| null\): string => \(state === null \? '' : state === 'equal' \? 'text-brand-green' : 'text-brand-red'\);/, 'the cue — and no third colour');
  assert.match(s, /<span data-ledger-match>\{matchCellWords\(row\.match\)\}<\/span>/);
  assert.match(s, /<td className=\{`\$\{money\} \$\{totals\.matchCents === null \? BLANK_CLASS : ''\}`\} data-ledger-total-match>\{matchTotalWords\(totals\.matchCents\)\}<\/td>/, 'the TOTAL row’s MATCH, no tone');
  assert.match(s, /\{shown\.length > 0 && <p data-ledger-said-match>\{matchCoverageWords\(totals\.withMatch, shown\.length\)\}<\/p>\}/, 'the coverage line');
  assert.doesNotMatch(s, /MATCH_NOTE_WORDS|MATCH_CELL_WORDS/);
  assert.equal(LEDGER_HEAD_WORDS.length, 18, 'the cue is a tone, not a column (TIME-03 added the two minutes columns, not a MATCH cue)'); // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13.
});

// ── R4 · THE PICKER ─────────────────────────────────────────────────────────

test('R4 the picker: one leaf the ledger mounts under the row with the record’s own (kind, id, instant) and near = its day; LINK-01’s list as the route answers it — date order, nothing pre-selected, nothing ranked, no amount closeness, no vendor match; linked postings with unlink above; the ledger re-reads after a link or unlink; nothing stored', () => {
  const p = code(PICKER);
  assert.match(p, /^'use client';/m);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the picker also reads the hook's reversed tag.
  assert.match(p, /import \{ REVERSED_TAG_WORDS, useItemLinks \} from '@\/components\/hub\/useLineLinks';/, 'the generalised hook');
  assert.match(p, /export default function LinkPicker\(\{ kind, id, instant, near, onChanged, onClose \}: Props\)/);
  assert.match(p, /readonly kind: LinkableKind;\n\s*readonly id: string;\n\s*readonly instant: string;\s*readonly near: string;\s*readonly onChanged: \(\) => void;\n\s*readonly onClose: \(\) => void;/, 'the four props the ruling names, then the two callbacks');
  assert.match(p, /const item = useItemLinks\(kind, id, instant\);/);
  assert.match(p, /useEffect\(\(\) => \{ void openPicker\(near\); \}, \[openPicker, near\]\);/, 'the candidates near the record’s day, on open');
  inOrder(p, ['data-link-picker-no-suggestion>{NO_SUGGESTION_WORDS}', '{LINKED_POSTINGS_WORDS}', 'data-link-picker-linked={l.journalEntryId}', '{postingDateWords(l.date)}', '{l.description}', '{postingAmountWords(l.amountCents)}', 'data-link-picker-unlink={l.journalEntryId}>{UNLINK_WORDS}', '{CANDIDATES_WORDS}', 'data-link-picker-candidate={c.journalEntryId}', '{postingDateWords(c.date)}', '{c.description}', '{postingAmountWords(c.amountCents)}', 'data-link-picker-link={c.journalEntryId}>{LINK_WORDS}', 'data-link-picker-cancel>{PICKER_CANCEL_WORDS}'], 'linked above, each with unlink; then the candidates, each date · description · amount · link');
  assert.match(p, /item\.candidates\.map\(\(c\) => \(/, 'the candidates as the route answers them — mapped, not sorted');
  assert.match(p, /if \(await item\.link\(c\.journalEntryId, near\)\) onChanged\(\);/, 'a link the route accepted tells the ledger');
  assert.match(p, /if \(await item\.unlink\(l\.journalEntryId, near\)\) onChanged\(\);/);
  // THE ABSENCE: no sort, no best, no closeness, no vendor match, no pre-check, no auto anything, nothing stored.
  assert.doesNotMatch(p, /\.sort\(|\.toSorted\(|Math\.abs|closest|nearest|\bbest\b|\brank|\bscore|suggest(?!ion>)|confidence|vendor|defaultChecked|checked=|selected=|autoLink|auto-link|localStorage|sessionStorage|document\.cookie|\bfetch\s*\(/, 'nothing chosen for the person');
  for (const w of [LINKS_LOADING_WORDS, LINKED_POSTINGS_WORDS, NO_LINKED_POSTINGS_WORDS, CANDIDATES_WORDS, NO_SUGGESTION_WORDS, NO_CANDIDATES_WORDS, NO_READABLE_AMOUNT_WORDS]) {
    assert.doesNotMatch(p, new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${JSON.stringify(w)} is printed from the rules file, not typed here`);
  }
  assert.doesNotMatch(p, />\s*(link|unlink|cancel)\s*</i, 'the chip words are the rules file’s constants, not text nodes');
  assert.deepEqual([LINK_WORDS, UNLINK_WORDS, PICKER_CANCEL_WORDS], ['link', 'unlink', 'cancel']);
  assert.equal(NO_SUGGESTION_WORDS, 'In date order. Nothing is selected for you and no match is suggested — pick the one that settled this.');
  assert.match(code(PANEL), /In date order\. Nothing is selected for you and no match is suggested — pick the one that settled this\./, 'the drill panel’s own sentence, word for word');
  assert.equal(NO_CANDIDATES_WORDS, 'No unlinked postings within the window. A posting already linked to another item is not offered.');
  assert.equal(postingAmountWords(2200), '$22.00');
  assert.equal(postingAmountWords(null), 'no readable amount');
  assert.equal(postingDateWords('2026-10-13'), '2026-10-13');
  assert.equal(postingDateWords(null), '—');
  // The section mounts it once, under the row, keyed on the row; the chip is the one way in; React state only.
  const s = code(SECTION);
  assert.match(s, /import LinkPicker from '\.\/LinkPicker';/);
  assert.match(s, /const \[picking, setPicking\] = useState<string \| null>\(null\);/);
  assert.match(s, /<button type="button" className=\{`\$\{chip\} ml-1 font-normal`\} onClick=\{\(\) => setPicking\(picking === row\.key \? null : row\.key\)\} data-ledger-link=\{row\.key\} aria-expanded=\{picking === row\.key\}>\{LINK_WORDS\}<\/button>/, 'the chip in the MATCH cell');
  assert.match(s, /\{picking === row\.key && \(\n\s*<tr className="border-t border-border" data-ledger-picker=\{row\.key\}>\n\s*<td colSpan=\{LEDGER_HEAD_WORDS\.length\} className=\{cell\}>\n\s*<LinkPicker kind=\{row\.address\.kind\} id=\{row\.address\.id\} instant=\{row\.address\.instant\} near=\{row\.day\} onChanged=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setPicking\(null\)\} \/>/, 'under the row; a link or unlink bumps writes, which reads the span again');
  assert.equal((s.match(/<LinkPicker /g) ?? []).length, 1);
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie/, 'the section fetches nothing — the picker’s hook does');
  assert.match(s, /\[period\?\.from, period\?\.to, writes\]/, 'writes is the one re-read trigger');
});

test('R4 the hook: useItemLinks(kind, id, instant) is the general form; the three requests are one implementation; useLineLinks keeps its signature and its requests for the drill panel, which is byte for byte the file it was', () => {
  const h = code(HOOK);
  assert.match(h, /export function useItemLinks\(kind: LinkableKind, id: string, instant: string \| null\) \{/);
  assert.match(h, /export function useLineLinks\(stepIds: readonly string\[\], instant: string \| null\) \{/, 'unchanged signature');
  // The requests, once each — the same URLs, bodies and refusal words LINES-01 made.
  assert.match(h, /async function readLinks\(kind: LinkableKind, id: string, instant: string \| null, near\?: string\)[\s\S]*?const q = new URLSearchParams\(\{ kind, id \}\);\n\s*if \(instant\) q\.set\('instant', instant\);\n\s*if \(near\) q\.set\('near', near\);\n\s*const res = await fetch\(`\/api\/calendar\/links\?\$\{q\.toString\(\)\}`\);/, 'GET kind, id, instant, near — in that order');
  assert.match(h, /`Links could not be read \(HTTP \$\{res\.status\}\)\.`/);
  assert.match(h, /async function postLink\(kind: LinkableKind, id: string, instant: string \| null, journalEntryId: string\)[\s\S]*?method: 'POST', headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON\.stringify\(\{ kind, id, instant, journalEntryId \}\),/, 'POST the same body, the same key order');
  assert.match(h, /`The link was not made \(HTTP \$\{res\.status\}\)\.`/);
  assert.match(h, /async function deleteLink\(journalEntryId: string\)[\s\S]*?fetch\(`\/api\/calendar\/links\?journalEntryId=\$\{encodeURIComponent\(journalEntryId\)\}`, \{ method: 'DELETE' \}\);/);
  assert.match(h, /`The link was not removed \(HTTP \$\{res\.status\}\)\.`/);
  assert.equal((h.match(/\bfetch\s*\(/g) ?? []).length, 3, 'three requests, one implementation');
  assert.match(h, /const read = await readLinks\('routine_line', stepId, instant, near\);/, 'the lines hook reads through it, on its kind');
  assert.match(h, /const done = await postLink\('routine_line', stepId, instant, journalEntryId\);/);
  assert.match(h, /if \(!done\.ok\) \{ setRefusal\(done\.words\); return; \}\n\s*setPicking\(null\); setCandidates\(null\);\n\s*await reload\(\);/, 'the lines hook’s behaviour after a link, as before');
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): both hooks also answer how many reversed postings the candidate window left out.
  assert.match(h, /return \{ byStep, summed, picking, candidates, candidatesReversed, refusal, openPicker, closePicker, link, unlink \};/, 'the lines hook’s answer, plus the reversed count');
  assert.match(h, /return \{ links, summed, candidates, candidatesReversed, refusal, busy, openPicker, closePicker, link, unlink, reload \};/);
  assert.doesNotMatch(h, /\.sort\(|localStorage|sessionStorage/, 'nothing ranked, nothing stored');
  // The drill panel: untouched — the whole file, byte for byte (rejoin is exact: TRAVEL-01).
  assert.equal(sha256(rejoin(code(PANEL), comments(PANEL))), PANEL_SHA256, 'EventDetailPanel.tsx is the file LINK-LAW-01 left');
  assert.match(code(PANEL), /import \{ CANDIDATES_REVERSED_MISSING_WORDS, REVERSED_TAG_WORDS, useLineLinks \} from '@\/components\/hub\/useLineLinks';/);
});

// ── R5 · THE AUDIT TRAIL ────────────────────────────────────────────────────

test('R5 the audit: the migration adds the two values the MOVE-01 way and says a new value is used at request time; the schema and the client carry them last; the audit-log route lists them; the links route’s POST and DELETE write the row with the ruling’s payload; the ladder moved by one', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 6], MIGRATION_DIR, 'the migration before the newest (BACKLOG-01 followed)');
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns and the four statuses — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], '20261020120000_backlog_01_capture', 'the migration before the newest (BACKLOG-01b followed)');
  // BACKLOG-01b (Alex, 2026-10-20): the brief's three columns — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020140000_backlog_01b_brief', 'the migration before the newest (JOURNAL-06 followed)');
  // JOURNAL-06 (Alex, 2026-10-20): the evening's five columns, the two CHECKs re-made — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261020150000_journal_06_reflection', 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261020160000_backlog_02_reranked', 'the migration before the newest (DOCUMENTS-01 followed)');
  // DOCUMENTS-01 (Alex, 2026-10-28): source_documents, the receipt on its posting — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261028120000_documents_01_source_documents', 'the newest migration');
  assert.equal(dirs[dirs.length - 7], '20261019210000_journal_04_evening_answers', 'right after JOURNAL-04’s');
  const sql = code(MIGRATION);
  assert.equal(sql.trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'planned_item_linked';\nALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'planned_item_unlinked';`, 'the two lines and nothing else');
  assert.doesNotMatch(sql, /ALTER TABLE|CREATE TABLE|ADD COLUMN|UPDATE|INSERT|DELETE/i, 'no table, no column, no row');
  assert.match(comments(MIGRATION), /applied at deploy/);
  assert.match(comments(MIGRATION), /cannot be used in the same transaction that adds it/);
  assert.match(comments(MIGRATION), /the route\s*\n?-- ?writes them at request time, after this migration has committed at deploy/);
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(auditEnum);
  const values = auditEnum[1].split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  assert.deepEqual(values.slice(-3), ['operations_routines_moved', 'planned_item_linked', 'planned_item_unlinked'], 'appended in ALTER TYPE order');
  assert.equal(AuditActionType.planned_item_linked, 'planned_item_linked', 'prisma generate ran');
  assert.equal(AuditActionType.planned_item_unlinked, 'planned_item_unlinked');
  assert.match(code(AUDIT_ROUTE), /planned_item_: \[\n\s*'planned_item_linked',\n\s*'planned_item_unlinked',\n\s*\],\n\};/, 'its own family — the operations_ list is untouched');
  assert.match(code(AUDIT_ROUTE), /'operations_routine_rekeyed',\s*'operations_routines_moved',\s*\],/, 'MOVE-01’s tail stands');
  // The links route: the two writes, after the row they describe, with the ruling's payload.
  const r = code(LINKS_ROUTE);
  assert.match(r, /import \{ writeAuditLog \} from '@\/lib\/audit\/writeAuditLog';/);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function DELETE('));
  const del = r.slice(r.indexOf('export async function DELETE('));
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C) and B: the POST reads the posting with its date, description and reversal state (the refusal names it); the DELETE reads the same select.
  inOrder(post, ['const user = await caller()', "{ status: 401 }", 'ownsTarget(targetOwnerQuery(t.kind, t.id, user.id))', 'const entry = await prisma.journal_entries.findFirst({', 'select: { id: true, date: true, description: true, ...LINKED_POSTING_SELECT },', 'prisma.planned_item_links.findUnique({ where: { journal_entry_id: entry.id } })', 'const link = await prisma.planned_item_links.create({', 'await writeAuditLog({', "action: { type: 'planned_item_linked'", "target: { table: 'planned_item_links', id: link.id },", 'payload: { after: { kind: t.kind, id: t.id, instant: t.instant === null ? null : t.instant.toISOString(), journal_entry_id: entry.id, amountCents: amountCentsOf(entry) } },', '{ status: 201 }'], 'POST: the ownership checks, the write, then its audit');
  inOrder(del, ['const user = await caller()', "{ status: 401 }", 'const link = await prisma.planned_item_links.findFirst({', 'where: { journal_entry_id: journalEntryId, user_id: user.id },', 'include: { journal_entry: { select: LINKED_POSTING_SELECT } },', "{ status: 404 }", 'const removed = await prisma.planned_item_links.deleteMany({', 'where: { journal_entry_id: journalEntryId, user_id: user.id },', 'await writeAuditLog({', "action: { type: 'planned_item_unlinked'", "target: { table: 'planned_item_links', id: link.id },", 'payload: { before: { kind: link.target_kind, id: link.target_id, instant: link.target_instant === null ? null : link.target_instant.toISOString(), journal_entry_id: link.journal_entry_id, amountCents: amountCentsOf(link.journal_entry) } },', 'return NextResponse.json({ unlinked: journalEntryId });'], 'DELETE: read the row user-scoped, delete it, then its audit');
  assert.equal((r.match(/await writeAuditLog\(/g) ?? []).length, 2, 'two writes — one per verb');
  assert.doesNotMatch(r.slice(r.indexOf('export async function GET('), r.indexOf('export async function POST(')), /writeAuditLog/, 'a read is not audited');
  assert.match(r, /actor: \{ user_id: user\.id, email: user\.email, type: 'human_user' \}/);
});

// ── R6 · SECURITY ───────────────────────────────────────────────────────────

test('R6 security: no new route; the ledger’s read is scoped by user_id (and the posting’s userId); the picker uses the existing route, whose every verb is cookie → user → user-scoped query; a posting of another user is never a candidate', () => {
  const r = code(LINKS_ROUTE);
  inOrder(r, ['async function caller()', 'const email = await getVerifiedEmail();', 'if (!email) return null;', 'return prisma.users.findFirst({'], 'the cookie, then the user');
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function POST('));
  inOrder(get, ['const user = await caller();', "{ status: 401 }", 'where: { user_id: user.id, target_kind: t.kind, target_id: t.id, target_instant: t.instant },', 'where: { id: { in: entryIds }, userId: user.id }', 'userId: user.id,', 'date: { gte: from, lte: to },', 'planned_item_links: { none: {} },', "orderBy: { date: 'desc' },", 'take: CANDIDATE_LIMIT,'], 'GET: the links by user_id, the candidates by userId — another user’s posting is never offered');
  assert.doesNotMatch(r, /status: 403/, 'a cross-user read is the defensive 404');
  const g = code(LEDGER_ROUTE);
  inOrder(g, ['const userEmail = await getVerifiedEmail();', "{ status: 401 }", 'const user = await prisma.users.findFirst(', "{ status: 404 }", 'prisma.planned_item_links.findMany({', 'where: { user_id: user.id, target_kind:', 'journal_entry: { userId: user.id }'], 'the ledger’s read, scoped twice');
  const picker = code(PICKER);
  assert.doesNotMatch(picker, /\/api\//, 'the picker names no route — its hook does, and that hook names the one LINK-01 route');
  assert.equal((code(HOOK).match(/\/api\/calendar\/links/g) ?? []).length, 3, 'the one route, three verbs');
  assert.doesNotMatch(code(HOOK), /\/api\/(?!calendar\/links)/, 'no other route');
});

// ── R7 · NOTHING ELSE ───────────────────────────────────────────────────────

test('R7 nothing else: the candidate rule is as LINK-01 left it; no column on operations_stop_records, no link table; the day card and the stop form know nothing of the picker', () => {
  const r = code(LINKS_ROUTE);
  assert.match(r, /const CANDIDATE_DAYS = 45;\nconst CANDIDATE_LIMIT = 100;/);
  assert.match(r, /from\.setUTCDate\(from\.getUTCDate\(\) - CANDIDATE_DAYS\);/);
  assert.match(r, /planned_item_links: \{ none: \{\} \},/);
  assert.match(r, /orderBy: \{ date: 'desc' \},\n\s*take: CANDIDATE_LIMIT,/);
  assert.doesNotMatch(r, /orderBy[\s\S]{0,80}amount/, 'never by amount');
  assert.doesNotMatch(code(MIGRATION), /ALTER TABLE|CREATE TABLE|operations_stop_records|planned_item_links/, 'the migration touches no table');
  for (const f of ['src/components/workbench/operations/day/DayCard.tsx', 'src/components/workbench/operations/stops/StopForm.tsx', 'src/components/workbench/operations/day/dayCard.ts']) {
    assert.doesNotMatch(code(f), /LinkPicker|useItemLinks|planned_item_links/, `${f} knows nothing of the link`);
  }
  assert.doesNotMatch(code(PANEL), /useItemLinks|LinkPicker/, 'the drill-down keeps its own words and hook');
});
