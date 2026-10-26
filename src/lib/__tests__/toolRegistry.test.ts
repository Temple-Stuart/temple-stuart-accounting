import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts, type ToolEntry } from '../toolRegistry';
import { OWNER_UTILITIES } from '../shellMenu';
import { FREE_TOOLS } from '../offer';

// TRUTH-01 — status means the job is done, not that code exists. The rubric: NOT_BUILT ⇔ no
// beats; LIVE ⇒ four beats; a PARTIAL with four beats says why it is not LIVE. Census 2026-09-09.

const byName = (name: string): ToolEntry => {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  if (!t) throw new Error(`${name} is not in the registry`);
  return t;
};
const beats = (t: ToolEntry) => [t.beats.discover, t.beats.decide, t.beats.commit, t.beats.record].filter(Boolean).length;
const withTool = (name: string, patch: Partial<ToolEntry>): ToolEntry[] => TOOL_REGISTRY.map((t) => (t.name === name ? { ...t, ...patch } : t));

// EXPENSES-01 (Alex, 2026-10-25): Expenses NOT_BUILT → PARTIAL — ROUTINE EXPENSES is its page, /expenses. 2 · 9 · 14 → 2 · 10 · 13.
// EXPENSES-02 (Alex, 2026-10-26): Expenses is LIVE — the vendor decided on the row; receipts are Documents' job. 2 · 10 · 13 → 3 · 9 · 13.
// TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13.
// TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13.
test('the counts are the dated census — 5 LIVE · 7 PARTIAL · 13 NOT_BUILT — and the law holds on the real registry', () => {
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 7, NOT_BUILT: 13 });
  assert.deepEqual(statusCounts(), { LIVE: 5, PARTIAL: 7, NOT_BUILT: 13 });
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.deepEqual(TOOL_REGISTRY.filter((t) => t.status === 'LIVE').map((t) => t.name), ['Tasks', 'Time', 'Expenses', 'Travel', 'Bookkeeping']);
});

// TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. Tasks left the four-beat PARTIALs; two remain.
// TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. Time left the four-beat PARTIALs; Budget alone remains.
test('the one four-beat PARTIAL carries the census note; no LIVE or NOT_BUILT tool carries one', () => {
  const fourBeatPartials = TOOL_REGISTRY.filter((t) => t.status === 'PARTIAL' && beats(t) === 4).map((t) => t.name);
  // TRUTH-CAL: Calendar was the fourth. PLAN-01 moved the routine builder that
  // carried its decide/commit/record to /tasks; the row is re-derived from the
  // page — discover, commit and record through EVENT-01's hand-entered event,
  // and no decide, because nothing persists a draft. PARTIAL is unchanged.
  assert.deepEqual(fourBeatPartials, ['Budget']); // TIME-03
  // ONEOFF-01: the calendar authors nothing — the add form and its POST are
  // gone, so commit is lost; record is kept by TRUTH-CAL's standard. Two beats.
  assert.equal(beats(byName('Calendar')), 2);
  assert.equal(byName('Calendar').status, 'PARTIAL');
  assert.deepEqual(byName('Calendar').beats, { discover: true, decide: false, commit: false, record: true });
  // A two-beat row states what it DOES; the law does not require a why here,
  // and the one it carries is customer copy with no source path in it.
  assert.match(byName('Calendar').why ?? '', /^the view every tool logs to —/);
  assert.doesNotMatch(byName('Calendar').why ?? '', /\.tsx?:|src\//);
  // TASKS-01: a customer's line — what is not done for a customer, without the founder's build note.
  assert.equal(byName('Tasks').why, undefined, 'TASKS-03: a LIVE row carries no why');
  // TIME-01 (Alex, 2026-10-19): the day card and the ledger moved to /time — the why names them, the pipeline beneath until TIME-02.
  // TIME-02 (Alex, 2026-10-19): the content pipeline is retired — the why is a customer's line with no build note in it.
  // LEDGER-02 (Alex, 2026-10-19): the city ledger is the task ledger — the why says "the task ledger" where it said "the ledger of every stop".
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): "the task ledger of every stop … by city, account and book".
  // HOME-01 (Alex, 2026-10-24, ruling C): the day card is on the dashboard; the Time row's why is the tables' — still a customer's line, no build note.
  assert.equal(byName('Time').why, undefined, 'TIME-03: a LIVE row carries no why'); // TIME-03 (Alex, 2026-10-26): the tables' line left with the status
  // TAB13-02b (ruled 2026-09-27): /budget is plan vs actual now; what is not done is named.
  assert.equal(byName('Budget').why, 'plan vs actual for routines and tasks on /budget; travel and income budgets not connected yet');
  assert.doesNotMatch(byName('Budget').citation, /BudgetingPage/, 'the citation is the report, not the unmounted room');
  assert.equal(byName('Budget').status, 'PARTIAL');
  for (const t of TOOL_REGISTRY) if (t.status !== 'PARTIAL') assert.equal(t.why, undefined, `${t.name} carries no why`);
});

test('the law rejects a four-beat PARTIAL without `why`, a `why` on a non-PARTIAL, a LIVE short of four beats, a PARTIAL or LIVE with no beats, and a NOT_BUILT with beats or a home', () => {
  // TRUTH-CAL: Calendar is no longer a four-beat PARTIAL, so the four-beat rule is
  // exercised through Tasks, which is. Calendar's own three-beat row is checked
  // to be legal WITHOUT a why — the rule binds four beats, not three.
  // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE, so the four-beat PARTIAL probe ran through Time.
  // TIME-03 (Alex, 2026-10-26): Time is LIVE too, so the probe runs through Budget, the one four-beat PARTIAL left.
  const noWhy = registryLaw({ throwOnFail: false, registry: withTool('Budget', { why: undefined }) }).join('\n');
  assert.match(noWhy, /Budget: PARTIAL with four beats must say why it is not LIVE/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Budget', { why: '   ' }) }).join('\n'), /Budget: PARTIAL with four beats must say why/);
  assert.throws(() => registryLaw({ registry: withTool('Budget', { why: undefined }) }), /TOOL REGISTRY LAW failed/); // TIME-03: through Budget
  assert.deepEqual(registryLaw({ throwOnFail: false, registry: withTool('Calendar', { why: undefined }) }), []);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Travel', { why: 'not needed' }) }).join('\n'), /Travel: why belongs only to a PARTIAL tool/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Travel', { beats: { discover: true, decide: true, commit: true, record: false } }) }).join('\n'), /Travel: LIVE needs four beats and a home \(beats 3/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Banking', { beats: { discover: false, decide: false, commit: false, record: false } }) }).join('\n'), /Banking: PARTIAL with no beats — no beats is NOT_BUILT/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('CRM', { beats: { discover: true, decide: false, commit: false, record: false } }) }).join('\n'), /CRM: NOT_BUILT must have no beats, no home, no links/);
  // EXPENSES-01 (2026-10-25): Expenses is PARTIAL now — the NOT_BUILT-with-a-home probe runs through Payroll, which is NOT_BUILT.
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Payroll', { home: '/travel' }) }).join('\n'), /Payroll: NOT_BUILT must have no beats, no home, no links/);
  // a wrong count is named (Calendar back to LIVE → 6/6/13; TIME-03, 2026-10-26: the census is 5 LIVE)
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Calendar', { status: 'LIVE', why: undefined }) }).join('\n'), /LIVE count 6 ≠ census 5/);
});

// EXPENSES-01 (Alex, 2026-10-25): Expenses left this test's NOT_BUILT pair — it is PARTIAL at /expenses (expenses01.test.ts pins
// the row); CRM stays. The LEGACY-DEL-01 line about trip_expenses is history in the Expenses row's comment, not its citation.
test('CRM is NOT_BUILT with the census citation, no home, no beats; Expenses is PARTIAL at /expenses; /owner keeps its door in the owner utilities, and Travel carries no sub-link (TRIPS-01)', () => {
  for (const name of ['CRM']) {
    const t = byName(name);
    assert.equal(t.status, 'NOT_BUILT');
    assert.equal(t.home, null);
    assert.equal(beats(t), 0);
    assert.equal(t.links, undefined);
  }
  assert.match(byName('CRM').citation, /proposals inbox — no contact or deal object \(src\/app\/api\/owner\/proposals\/route\.ts\)/);
  assert.equal(byName('Expenses').status, 'LIVE'); // EXPENSES-02 (Alex, 2026-10-26): Expenses is LIVE — the vendor decided on the row; receipts are Documents' job. 2 · 10 · 13 → 3 · 9 · 13.
  assert.equal(byName('Expenses').home, '/expenses');
  assert.match(byName('Expenses').citation, /^EXPENSES-01 \(2026-10-25\): src\/app\/expenses\/page\.tsx mounts ROUTINE EXPENSES alone · EXPENSES-02 \(2026-10-26\) decide:/);
  assert.doesNotMatch(byName('Expenses').citation, /^no expenses tooling writes trip_expenses now — the trip delete clears a trip's rows \(src\/app\/api\/trips\/\[id\]\/route\.ts:135\) and the export reads them \(src\/app\/api\/export\/route\.ts:154\)$/);
  assert.ok(OWNER_UTILITIES.some((u) => u.href === '/owner'), '/owner keeps its door in the utilities menu');
  // TRIPS-01 (2026-09-29): the legacy pages under /budgets/trips are redirects to the Travel
  // tab, and Travel carries no sub-link: not to them, not to anything. (LEGACY-DEL-01: the
  // planner those pages mounted is deleted.)
  assert.deepEqual(byName('Travel').links, []);
});

test('TRIPS-01: Travel carries no sub-link, ever — the registry law refuses one, whatever it opens', () => {
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  for (const links of [
    [{ label: 'Trips · the legacy pages', href: '/budgets/trips' }],
    [{ label: 'Anything', href: '/travel' }],
    [{ label: 'A cockpit row', cockpitKey: 'travel' }],
  ]) {
    const found = registryLaw({ throwOnFail: false, registry: withTool('Travel', { links }) }).join('\n');
    assert.match(found, /Travel: carries 1 sub-link\(s\) — the Travel tab is the one Trips tab; Travel carries no sub-link, ever \(TRIPS-01\)/);
  }
  assert.throws(() => registryLaw({ registry: withTool('Travel', { links: [{ label: 'x', href: '/budgets/trips' }] }) }), /TOOL REGISTRY LAW failed/);
  assert.deepEqual(registryLaw({ throwOnFail: false, registry: withTool('Travel', { links: [] }) }), []);
});

// EXPENSES-02 (Alex, 2026-10-26): Expenses is LIVE — the vendor decided on the row; receipts are Documents' job. 2 · 10 · 13 → 3 · 9 · 13. The free set is the LIVE tools with no gate — Expenses (gate null) joins Travel; Bookkeeping is gated.
test('derived surfaces: the free set is Expenses and Travel', () => {
  assert.deepEqual(FREE_TOOLS.map((t) => t.name), ['Tasks', 'Time', 'Expenses', 'Travel']); // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. Time (gate null) joins after Tasks, in registry order.
});
