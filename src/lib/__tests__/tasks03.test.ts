/**
 * TASKS-03 (Alex, 2026-10-26) — TASKS IS LIVE: A TASK'S COST AS YOU LOGGED IT AND WHAT BOOKS MATCHED.
 *
 * THE WORK's columns are TASK · PROJECT · BOOK · STATUS · DEADLINE · ESTIMATE ·
 * ACTUAL · MATCH · ACCOUNT · DONE — the money together, in the ledger's words:
 * ACTUAL the task's actual_cost_usd as logged (blank is blank, never $0.00),
 * MATCH the sum of the postings linked to the task in Books (ruling A). The
 * tasks GET carries match_cents · match_links · match_unreadable per task,
 * additively, from ONE user-scoped query (ruling B). The registry row is LIVE,
 * no why, the customer line without "not yet"; the census 4 · 8 · 13 (ruling C).
 * No schema, no migration, no new route; PROJECTS' ACTUAL is the project-grain
 * allocation and is untouched (ruling D). The pure rules are driven over
 * fixtures; the route, the screen and the registry are pinned to their source
 * with comments stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { navToolByName } from '../nav';
import { FREE_TOOLS, TOOL_GATE, claimForTool, freeSetLine, heroCountsLine } from '../offer';
import { CAPABILITY_GROUPS, PLANS, cellState } from '../offer/plans';
import { verificationEmail } from '../auth/welcomeEmail';
import { tableCsv } from '../table/csv';
import { columnOf } from '../table/columns';
import {
  TASK_COLUMNS, TASK_HEAD_WORDS, TASK_TOOLTIPS, actualCentsOf, taskActualCentsOf, taskMatchCentsOf, taskRowsOf, taskTable, type WorkBook, type WorkProject,
} from '../operations/work';
import { NO_TASK_MATCH, taskMatchOf, taskMatchesOf, type TaskLinkRow } from '../operations/taskMatch';
import type { Project, Task } from '@/components/workbench/operations/projects/types';

const ROUTE = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const RULE = 'src/lib/operations/taskMatch.ts';
const WORK = 'src/lib/operations/work.ts';
const SECTION_E = 'src/components/workbench/operations/SectionE_Work.tsx';
const TYPES = 'src/components/workbench/operations/projects/types.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const PROJECTS_TABLE = 'src/lib/operations/projectsTable.ts';

// ── FIXTURES ───────────────────────────────────────────────────────────────
const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }];
const CHARTS = { p: [{ code: '6150', name: 'Food & drink' }] } as unknown as Parameters<typeof taskTable>[1];
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({ entity_id: 'p', status: 'in_progress', ...o } as Project);
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task =>
  ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, actual_cost_usd: null, deadline: null, coa_code: null, completed_at: null, ...o } as Task);
const OPEN = project({ id: 'x', title: 'X' });
const LOGGED = task({ id: 'a', title: 'logged and matched', project_id: 'x', estimated_cost_usd: '10', actual_cost_usd: '12.34', coa_code: '6150', match_cents: 1500, match_links: 2, match_unreadable: 0 });
const ZERO = task({ id: 'b', title: 'logged zero', project_id: 'x', actual_cost_usd: '0' });
const BLANK = task({ id: 'c', title: 'nothing logged', project_id: 'x' });
const UNREAD = task({ id: 'd', title: 'a link the rule cannot read', project_id: 'x', match_cents: null, match_links: 1, match_unreadable: 1 });
const WORK_ROWS: WorkProject[] = [{ project: OPEN, tasks: [LOGGED, ZERO, BLANK, UNREAD] }];
const ROWS = taskRowsOf(WORK_ROWS);
const COLS = taskTable(BOOKS, CHARTS);
const rowOf = (id: string) => { const r = ROWS.find((x) => x.task.id === id); if (!r) throw new Error(id); return r; };
const cell = (id: string, key: typeof TASK_COLUMNS[number]) => columnOf(COLS, key).words(rowOf(id));

const entry = (debit: number | null): TaskLinkRow['journal_entry'] => ({ status: 'posted', is_reversal: false, reversed_by_entry_id: null, ledger_entries: debit === null ? [{ entry_type: 'C', amount: BigInt(100) }] : [{ entry_type: 'D', amount: BigInt(debit) }, { entry_type: 'C', amount: BigInt(debit) }] });
const link = (o: Partial<TaskLinkRow> & { journal_entry_id: string; target_id: string }): TaskLinkRow => ({ target_kind: 'project_task', target_instant: null, journal_entry: entry(1000), ...o });

// ── RULING A · THE COLUMNS ──────────────────────────────────────────────────

test('A the ten heads in order — the money together, in the ledger\'s words — each money column with its tooltip', () => {
  assert.deepEqual([...TASK_COLUMNS], ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'actual', 'match', 'account', 'done']);
  assert.deepEqual(COLS.map((c) => c.label), ['TASK', 'PROJECT', 'BOOK', 'STATUS', 'DEADLINE', 'ESTIMATE', 'ACTUAL', 'MATCH', 'ACCOUNT', 'DONE']);
  assert.deepEqual(COLS.map((c) => c.label), TASK_COLUMNS.map((k) => TASK_HEAD_WORDS[k]));
  assert.equal(columnOf(COLS, 'actual').kind, 'money');
  assert.equal(columnOf(COLS, 'match').kind, 'money');
  assert.deepEqual(TASK_TOOLTIPS, { actual: 'as you logged it', match: 'postings linked in Books' });
  assert.equal(columnOf(COLS, 'actual').title, 'as you logged it');
  assert.equal(columnOf(COLS, 'match').title, 'postings linked in Books');
  for (const key of ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'account', 'done'] as const) assert.equal(columnOf(COLS, key).title, undefined, `${key} has no tooltip`);
  // The spec in source: the pair sits between ESTIMATE and ACCOUNT, through the same builders; the tooltips come from the map, never typed on a column.
  const w = code(WORK);
  assert.match(w, /moneyColumn<TaskRow, TaskColumn>\('estimate', head\.estimate, taskEstimateCentsOf\),\n\s*moneyColumn<TaskRow, TaskColumn>\('actual', head\.actual, taskActualCentsOf\),\n\s*moneyColumn<TaskRow, TaskColumn>\('match', head\.match, taskMatchCentsOf\),\n\s*textColumn<TaskRow, TaskColumn>\('account'/);
  assert.match(w, /return columns\.map\(\(c\) => \(TASK_TOOLTIPS\[c\.key\] === undefined \? c : \{ \.\.\.c, title: TASK_TOOLTIPS\[c\.key\] \}\)\);/);
  assert.match(comments(WORK), /TASKS-03 \(Alex, 2026-10-26, ruling A\): the task's actual_cost_usd/);
});

test('A ACTUAL is actual_cost_usd as logged — $12.34; $0.00 when zero was logged; blank, never $0.00, when nothing was', () => {
  assert.equal(actualCentsOf({ actual_cost_usd: '12.34' }), 1234);
  assert.equal(actualCentsOf({ actual_cost_usd: '0' }), 0);
  assert.equal(actualCentsOf({ actual_cost_usd: null }), null);
  assert.equal(actualCentsOf({ actual_cost_usd: '' }), null);
  assert.equal(actualCentsOf({ actual_cost_usd: 'twelve' }), null);
  assert.equal(taskActualCentsOf(rowOf('a')), 1234);
  assert.equal(cell('a', 'actual'), '$12.34');
  assert.equal(cell('b', 'actual'), '$0.00', 'a logged zero is a logged zero');
  assert.equal(cell('c', 'actual'), '—', 'nothing logged is blank');
  assert.equal(columnOf(COLS, 'actual').csv(rowOf('a')), '12.34');
  assert.equal(columnOf(COLS, 'actual').csv(rowOf('c')), '', 'the CSV writes an empty field, never 0');
  assert.deepEqual(columnOf(COLS, 'actual').sortKey(rowOf('c')), null, 'a blank sorts last');
});

test('A MATCH is the GET\'s match_cents — the sum; blank with no link, with an unreadable posting, or on a task the GET did not carry', () => {
  assert.equal(taskMatchCentsOf(rowOf('a')), 1500);
  assert.equal(cell('a', 'match'), '$15.00');
  assert.equal(cell('c', 'match'), '—', 'no link');
  assert.equal(cell('d', 'match'), '—', 'an unreadable posting: counted and said by the GET, the sum blank');
  assert.equal(taskMatchCentsOf({ id: 't', task: task({ id: 'z', title: 'z', project_id: 'x' }), project: OPEN }), null, 'a task from a POST answer carries no match: blank, never 0');
  assert.equal(columnOf(COLS, 'match').csv(rowOf('a')), '15.00');
  assert.equal(columnOf(COLS, 'match').csv(rowOf('d')), '');
});

test('A the CSV header is the ten heads, the money bare; the screen draws every column through the shared cell', () => {
  const csv = tableCsv(COLS, [rowOf('a'), rowOf('c')]);
  assert.equal(csv.split('\r\n')[0], 'TASK,PROJECT,BOOK,STATUS,DEADLINE,ESTIMATE,ACTUAL,MATCH,ACCOUNT,DONE');
  assert.equal(csv.split('\r\n')[1], 'logged and matched,X,Personal,new,,10.00,12.34,15.00,P-6150 Food & drink,');
  assert.equal(csv.split('\r\n')[2], 'nothing logged,X,Personal,new,,,,,,');
  const e = code(SECTION_E);
  assert.match(e, /\{columns\.map\(\(c\) => <WorkCell key=\{c\.key\} name=\{name\} column=\{c\} row=\{row\} \/>\)\}/, 'every column, the pair included, is the shared cell');
  assert.doesNotMatch(e, /actual_cost_usd|match_cents/, 'the section types no cell of its own');
  assert.match(comments(SECTION_E), /TASKS-03 \(Alex, 2026-10-26, ruling A\): THE WORK prints the ledger's pair/);
});

// ── RULING B · THE GET ──────────────────────────────────────────────────────

test('B the rule: three tasks, two links on one → its sum and 2 links, the others null and 0; an unreadable posting counted, the sum null; a wrong kind or an instant thrown by name', () => {
  const rows = [
    link({ journal_entry_id: 'je-1', target_id: 'a', journal_entry: entry(1000) }),
    link({ journal_entry_id: 'je-2', target_id: 'a', journal_entry: entry(500) }),
  ];
  const matches = taskMatchesOf(rows);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): a task's match also counts the reversed postings it left out — none in these fixtures (linkLaw01.test.ts drives it).
  assert.deepEqual(taskMatchOf(matches, 'a'), { match_cents: 1500, match_links: 2, match_unreadable: 0, match_reversed: 0 });
  assert.deepEqual(taskMatchOf(matches, 'b'), NO_TASK_MATCH);
  assert.deepEqual(taskMatchOf(matches, 'c'), { match_cents: null, match_links: 0, match_unreadable: 0, match_reversed: 0 });
  // An unreadable posting (no debit line): counted and said; the sum is blank, never the readable part alone.
  const unread = taskMatchesOf([...rows, link({ journal_entry_id: 'je-3', target_id: 'a', journal_entry: entry(null) }), link({ journal_entry_id: 'je-4', target_id: 'b', journal_entry: entry(null) })]);
  assert.deepEqual(taskMatchOf(unread, 'a'), { match_cents: null, match_links: 3, match_unreadable: 1, match_reversed: 0 });
  assert.deepEqual(taskMatchOf(unread, 'b'), { match_cents: null, match_links: 1, match_unreadable: 1, match_reversed: 0 });
  assert.throws(() => taskMatchesOf([link({ journal_entry_id: 'je-5', target_id: 'a', target_kind: 'routine_line' })]), /is of kind "routine_line" — the query asked for project_task/);
  assert.throws(() => taskMatchesOf([link({ journal_entry_id: 'je-6', target_id: 'a', target_instant: new Date('2026-10-26T00:00:00Z') })]), /carries an instant — a task happens once/);
  // The rule is the ledger's: matchOf and readableMatchCents, the amount by postingAmount.ts.
  const r = code(RULE);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the rule reads the reversal state too — LinkedPostingRow, isReversedPosting.
  assert.match(r, /import \{ amountCentsOf, isReversedPosting, type LinkedPostingRow \} from '@\/lib\/calendar\/postingAmount';/);
  assert.match(r, /import \{ matchOf, readableMatchCents \} from '@\/lib\/operations\/ledger';/);
  assert.match(r, /match_cents: readableMatchCents\(match\), match_links: match\?\.postings \?\? 0, match_unreadable: match\?\.unreadable \?\? 0, match_reversed: match === null \? 0 : match\.reversed/);
  assert.doesNotMatch(r, /prisma|fetch\(|new Date\(\)/, 'pure');
});

test('B the GET: one query for the project\'s tasks\' links with POSTING_LINES_SELECT, scoped to the caller twice; the fields added additively; every other caller reads the same tasks', () => {
  const route = code(ROUTE);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the select is LINKED_POSTING_SELECT — the same lines plus the reversal state.
  assert.match(route, /import \{ LINKED_POSTING_SELECT \} from '@\/lib\/calendar\/postingAmount';/);
  assert.match(route, /import \{ taskMatchOf, taskMatchesOf \} from '@\/lib\/operations\/taskMatch';/);
  assert.match(route, /const linkRows = sorted\.length === 0 \? \[\] : await prisma\.planned_item_links\.findMany\(\{\n\s*where: \{ user_id: user\.id, target_kind: 'project_task', target_id: \{ in: sorted\.map\(\(t\) => t\.id\) \}, journal_entry: \{ userId: user\.id \} \},\n\s*select: \{ target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: \{ select: LINKED_POSTING_SELECT \} \},\n\s*orderBy: \{ linked_at: 'asc' \},\n\s*\}\);/);
  assert.equal((route.match(/planned_item_links\.findMany/g) ?? []).length, 1, 'one query, never one per task');
  assert.match(route, /return NextResponse\.json\(\{ tasks: sorted\.map\(\(t\) => \(\{ \.\.\.t, \.\.\.taskMatchOf\(matches, t\.id\) \}\)\) \}\);/, 'additive: the task as before, the three fields beside it');
  // The scoping is the ledger route's: the link's user AND the posting's user (user B's links never reach user A's read, and a posting of another user never counts).
  assert.match(code('src/app/api/operations/ledger/route.ts'), /where: \{ user_id: user\.id, target_kind: \{ in: \['routine', 'routine_line'\] \}, target_instant: \{ gte: recordsFrom, lt: recordsTo \}, journal_entry: \{ userId: user\.id \} \}/);
  // Nothing of the read before it changed: the archived filter, the order, the status sort.
  assert.match(route, /const includeArchived = request\.nextUrl\.searchParams\.get\('include_archived'\) === 'true';\n\s*const where: Prisma\.operations_project_tasksWhereInput = \{ project_id: projectId \};/);
  assert.match(route, /const sorted = tasks\.slice\(\)\.sort\(\(a, b\) => \{/);
  assert.match(comments(ROUTE), /TASKS-03 \(Alex, 2026-10-26, ruling B\)/);
  // The type says the fields are the GET's and optional elsewhere.
  assert.match(code(TYPES), /match_cents\?: number \| null;\n\s*match_links\?: number;\n\s*match_unreadable\?: number;/);
  // No new route, no schema, no migration (ruling D).
  assert.ok(!existsSync(resolve(process.cwd(), 'src/app/api/operations/tasks-match')), 'no new route');
  assert.doesNotMatch(code('prisma/schema.prisma'), /TASKS-03/);
});

// ── RULING C · THE REGISTRY ──────────────────────────────────────────────────

test('C Tasks is LIVE with four beats, no why, the customer line verbatim and without "not yet"; the census is 4 · 8 · 13; the claim "built and running"; the opener prints no line', () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'Tasks');
  assert.ok(t);
  assert.equal(t.status, 'LIVE');
  assert.deepEqual(t.beats, { discover: true, decide: true, commit: true, record: true });
  assert.equal(t.home, '/tasks');
  assert.equal(t.why, undefined, 'a LIVE row carries no why — the typed-cost clause left with the status');
  assert.equal(t.customer, 'You can capture a project as a brief, rank it, plan its tasks with what each should cost and tick them off, and see what each task cost as you logged it and what Books matched; routines are planned under Expenses.');
  assert.doesNotMatch(t.customer ?? '', /not yet|\.tsx?:|src\/|\b(discover|decide|commit|record)\b|founder|module|registry/i);
  // LINK-LAW-01 (Alex, 2026-10-28, ruling C): the match read selects LINKED_POSTING_SELECT — the citation says so.
  assert.match(t.citation, /TASKS-03 \(2026-10-26\) the match read: tasks\/route\.ts:\d+-\d+ \(one planned_item_links query, project_task, LINKED_POSTING_SELECT, scoped to the caller twice\) → src\/lib\/operations\/taskMatch\.ts taskMatchesOf/);
  assert.match(comments(REGISTRY), /TASKS-03 census \(Alex, 2026-10-26\): Tasks LIVE — ACTUAL as logged and MATCH from Books on THE WORK, the ledger's pair\./);
  assert.match(comments(REGISTRY), /4 LIVE · 8 PARTIAL · 13 NOT_BUILT/);
  assert.match(comments(REGISTRY), /the pair IS the ledger's/);
  // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. The TASKS-03 census line stays in the record; the counts moved on (time03.test.ts pins them).
  assert.match(comments(REGISTRY), /3 · 9 · 13 → 4 · 8 · 13/);
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Tasks' ? { ...x, why: 'x' } : x)) }).join('\n'), /Tasks: why belongs only to a PARTIAL tool/);
  assert.equal(claimForTool('Tasks'), 'built and running');
  assert.equal(navToolByName('Tasks', TOOL_GATE).line, null);
});

test('C the free set and the selling surfaces follow by derivation: Tasks joins the free set first; the hero counts four live; the verification email names it', () => {
  assert.equal(TOOL_GATE.Tasks, null);
  // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. Time joined the free set after Tasks; the counts are time03.test.ts's.
  assert.equal(FREE_TOOLS[0].name, 'Tasks');
  assert.match(freeSetLine(), /^Free with an account, no module to buy: Tasks, .*Expenses, Travel — the registry's live tools with no tab gate\.$/);
  assert.match(heroCountsLine(), /^Twenty-five tools, counted: \w+ live, \w+ partial, thirteen on the blueprint\.$/);
  const mail = verificationEmail({ name: 'Ada', verifyUrl: 'https://templestuart.com/api/auth/verify?token=t', baseUrl: 'https://templestuart.com/' });
  assert.match(mail.text, /Free with your account: Tasks, .*Expenses, Travel\./); // TIME-03 (2026-10-26): Time sits between
});

test('C the plan surfaces flip the one row standing on Tasks to ✓ by derivation, in every plan; nothing typed', () => {
  const rows = CAPABILITY_GROUPS.flatMap((g) => g.rows.map((row) => ({ group: g.id, row }))).filter((r) => r.row.tools.includes('Tasks'));
  assert.equal(rows.length, 1);
  const [{ group, row }] = rows;
  assert.equal(group, 'days');
  // TIME-03 (Alex, 2026-10-26, ruling E; TASKS-03 call 1, ruled in chat): the row is backed by Tasks AND Expenses — half its claim stands on Expenses. Both LIVE: ✓ unchanged.
  assert.deepEqual(row.tools, ['Tasks', 'Expenses']);
  assert.equal(row.module, 'personal');
  for (const plan of PLANS) assert.equal(cellState(plan, row), 'ready', `${plan.id} reads ✓`);
  assert.equal(cellState(PLANS[0], row, TOOL_REGISTRY.map((x) => (x.name === 'Tasks' ? { ...x, status: 'PARTIAL' as const } : x))), 'partial');
});

// ── RULING D · PROJECTS' ACTUAL IS ANOTHER FACT ──────────────────────────────

test('D PROJECTS\' ACTUAL (ledger_allocated, the project-grain allocation) is untouched and still labelled so', () => {
  const p = code(PROJECTS_TABLE) + comments(PROJECTS_TABLE);
  assert.match(p, /ledger_allocated/);
  assert.doesNotMatch(p, /TASKS-03|match_cents|taskMatch/);
});
