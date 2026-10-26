/**
 * EXPENSES-02 (Alex, 2026-10-26) — EXPENSES IS LIVE: THE VENDOR IS DECIDED ON THE ROW.
 *
 * The VENDOR cell of ROUTINE EXPENSES is where a line's vendor is decided: the
 * row's "vendor" control opens, under the row, the book's vendor list with "+ add"
 * and "clear"; picking writes the EVERY-OCCURRENCE grain through the existing
 * plan-vendors route (kind routine_line, or routine for a stepless routine;
 * instant null); a line at the occurrence grain gets the refusal by name and no
 * write (ruling A). A vendor write re-reads the month route (ruling B). The
 * registry row is LIVE with four beats, no `why`, the customer line without
 * "not yet"; the census is 3 · 9 · 13; Expenses joins the free set (ruling C).
 * No schema, no migration, no new route (ruling D). The pure rules are driven
 * over fixtures; the screens and the law are pinned with comments stripped
 * (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { TOOL_REGISTRY, registryLaw } from '../toolRegistry';
import { navToolByName } from '../nav';
import { FREE_TOOLS, TOOL_GATE, claimForTool, freeSetLine, heroCountsLine } from '../offer';
import { CAPABILITY_GROUPS, PLANS, cellState } from '../offer/plans';
import { verificationEmail } from '../auth/welcomeEmail';
import {
  VENDOR_BY_OCCURRENCE_REFUSAL_WORDS, VENDOR_CLEAR_WORDS, VENDOR_CONTROL_WORDS, VENDOR_MONTH_NOT_READ_WORDS, routineRowsOf, routineVendorAddressOf,
  routineVendorControlOf, vendorAddWords, vendorHeldWords,
} from '../operations/work';
import { BY_OCCURRENCE_WORDS, routineMonthOf, type RoutineMonthInput, type RoutineMonthRoutine } from '../operations/routineMonth';
import type { PlanVendorRow } from '../budget/planLines';
import type { Routine, RoutineStep } from '@/components/workbench/operations/routines/types';

const OPS = 'src/components/workbench/operations';
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`;
const PANEL = `${OPS}/routines/RoutineVendorPanel.tsx`;
const BOX = 'src/components/budget/VendorBox.tsx';
const WORK = 'src/lib/operations/work.ts';
const MONTH = 'src/lib/operations/routineMonth.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const PLANS_FILE = 'src/lib/offer/plans.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const PLAN_VENDORS_ROUTE = 'src/app/api/operations/plan-vendors/route.ts';

const expenses = () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'Expenses');
  if (!t) throw new Error('Expenses is not in the registry');
  return t;
};

// ── THE FIXTURES ───────────────────────────────────────────────────────────
const routine = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'p', description: null, schedule_rrule: 'FREQ=DAILY', timezone: 'Asia/Bangkok', budget_amount: null, coa_code: null,
  start_date: null, end_date: null, start_time: '08:00', end_time: '08:30', next_due_at: null, is_active: true, steps: [], role: 'place', ...o,
} as unknown as Routine);
const step = (id: string, routineId: string, activity: string, amount: string): RoutineStep => ({ id, routine_id: routineId, activity, step_order: 1, time_of_day: null, budget_amount: amount, coa_code: '6150' } as unknown as RoutineStep);
const LINED = routine({ id: 'r-lined', name: 'Lined', steps: [step('s-1', 'r-lined', 'Coffee', '4')] });
const STEPLESS = routine({ id: 'r-plain', name: 'Plain', budget_amount: '10', coa_code: '6150' });
const NOW = new Date('2026-10-26T06:00:00.000Z');
const ROWS = routineRowsOf([LINED, STEPLESS], NOW);
const rowOf = (routineId: string) => {
  const r = ROWS.find((x) => x.routine.id === routineId);
  if (!r) throw new Error(`no row for ${routineId}`);
  return r;
};

// ── RULING A · THE ADDRESS, THE CONTROL ───────────────────────────────────────

test('A the write is the every-occurrence address: routine_line with the line id, or routine for a stepless routine — instant null, never an instant', () => {
  assert.deepEqual(routineVendorAddressOf(rowOf('r-lined')), { kind: 'routine_line', id: 's-1', instant: null });
  assert.deepEqual(routineVendorAddressOf(rowOf('r-plain')), { kind: 'routine', id: 'r-plain', instant: null });
  // The body the panel posts is the box's own call with that address and instant null — the kind, id and vendorId as plan-vendors reads them.
  const panel = code(PANEL);
  assert.match(panel, /const address = routineVendorAddressOf\(row\);/);
  assert.match(panel, /await setVendor\(address, null, vendorId\)/, 'every occurrence — the second argument is null, never row.line\'s instant');
  assert.doesNotMatch(panel, /instant: ['"`]|new Date\(|toISOString/, 'no instant is ever built here');
  const box = code(BOX);
  assert.match(box, /export async function setVendor\(address: PlanAddressText, instant: string \| null, vendorId: string\)/);
  assert.match(box, /body: JSON\.stringify\(\{ kind: address\.kind, id: address\.id, instant, vendorId \}\)/, 'the POST body shape is the route\'s: { kind, id, instant, vendorId }');
  assert.match(box, /export async function addVendor\(entityId: string, name: string\)/);
  assert.match(box, /body: JSON\.stringify\(\{ entityId, name \}\)/);
  // The route reads exactly that: a null instant is EVERY occurrence (planVendor.ts readPlanAddress), the DELETE the same address without ?instant=.
  const route = code(PLAN_VENDORS_ROUTE);
  assert.match(route, /readPlanAddress\(body\.kind, body\.id, body\.instant\)/);
  assert.match(route, /readPlanAddress\(q\.get\('kind'\), q\.get\('id'\), q\.get\('instant'\)\)/);
  assert.match(box, /if \(address\.instant !== null\) query\.set\('instant', address\.instant\);/, 'clear at the every-occurrence address sends no instant');
});

test('A the control decides by the month line\'s GRAIN: pick on none or every (with the held vendor to clear), the refusal by name on occurrence, the month\'s own refusal on both, not-read without a line', () => {
  assert.deepEqual(routineVendorControlOf({ vendor_words: null, vendor_grain: null }), { kind: 'pick', held: null });
  assert.deepEqual(routineVendorControlOf({ vendor_words: 'Luka Café', vendor_grain: 'every' }), { kind: 'pick', held: { name: 'Luka Café' } });
  assert.deepEqual(routineVendorControlOf({ vendor_words: BY_OCCURRENCE_WORDS, vendor_grain: 'occurrence' }), { kind: 'refusal', words: VENDOR_BY_OCCURRENCE_REFUSAL_WORDS });
  assert.deepEqual(routineVendorControlOf({ vendor_words: 'plan routine:x holds "A" for every occurrence AND "B" at …', vendor_grain: 'both' }), { kind: 'refusal', words: 'plan routine:x holds "A" for every occurrence AND "B" at …' });
  assert.deepEqual(routineVendorControlOf(undefined), { kind: 'refusal', words: VENDOR_MONTH_NOT_READ_WORDS });
  // The words — the ruling's own.
  assert.equal(VENDOR_CONTROL_WORDS, 'vendor');
  assert.equal(VENDOR_CLEAR_WORDS, 'clear');
  assert.equal(VENDOR_BY_OCCURRENCE_REFUSAL_WORDS, 'this line names its vendor per stop — set it on the day card');
  assert.equal(vendorHeldWords('Luka Café'), 'Luka Café · every time');
  assert.equal(vendorAddWords('Luka Café', 'Personal'), '+ add Luka Café to Personal');
  // The refusal writes nothing: the panel returns before any write when the control is a refusal, and never decides by the words.
  const panel = code(PANEL);
  const refusalAt = panel.indexOf("if (control.kind === 'refusal') {");
  const writeAt = panel.indexOf('const write = async');
  assert.ok(refusalAt > 0 && writeAt > refusalAt, 'the refusal branch returns before the write is even defined');
  const refusalBranch = panel.slice(refusalAt, panel.indexOf('\n  }\n', refusalAt));
  assert.doesNotMatch(refusalBranch, /setVendor|addVendor|ClearVendor|fetch\(/, 'nothing is written on a refusal');
  assert.match(refusalBranch, /\{control\.words\}/, 'the refusal is printed by name');
  assert.doesNotMatch(panel, /BY_OCCURRENCE_WORDS|by occurrence|vendor_words/, 'the panel never reads the words to decide');
  // The section hands the control in from the month line's grain, and holds one panel open at a time in React state.
  const f = code(SECTION_F);
  assert.match(f, /const vendorControl = routineVendorControlOf\(month\.get\(row\.id\)\);/);
  assert.match(f, /const \[vendorFor, setVendorFor\] = useState<string \| null>\(null\);/);
  assert.match(f, /<RoutineVendorPanel row=\{row\} control=\{vendorControl\} bookName=\{bookName\} onChanged=\{onChanged\} onClose=\{\(\) => setVendorOpen\(false\)\} \/>/);
  assert.match(f, /\{\.\.\.dataAttr\(name, 'vendor'\)\} \{\.\.\.dataAttr\(name, 'vendor-control', vendorControl\.kind\)\}>\{VENDOR_CONTROL_WORDS\}<\/button>/);
  assert.doesNotMatch(f, /localStorage|sessionStorage|document\.cookie/);
});

test('A the panel is the budget box\'s own list and writes — VENDOR-01\'s one list for the line\'s book, "+ add <name> to <book>" through the directory\'s POST, "clear" through ClearVendor', () => {
  const panel = code(PANEL);
  assert.match(panel, /import \{ ClearVendor, addVendor, setVendor, useDirectory \} from '@\/components\/budget\/VendorBox';/);
  assert.match(panel, /const directory = useDirectory\(\);/);
  assert.match(panel, /vendorChoices\(typed, vendors, bookId\)/, 'the one name rule offers the book\'s vendors once something is typed');
  assert.match(panel, /vendors\.filter\(\(v\) => v\.entity_id === bookId\)/, 'nothing typed: the book\'s whole list');
  assert.match(panel, /const bookId = row\.routine\.entity_id;/);
  assert.match(panel, /await addVendor\(bookId, vendorName\)/);
  assert.match(panel, /<ClearVendor address=\{address\} reload=\{\(\) => \{ onChanged\(\); onClose\(\); \}\} label=\{VENDOR_CLEAR_WORDS\} \/>/);
  assert.match(panel, /\{vendorAddWords\(choices\.add, bookName\)\}/);
  // Ruling B: a write re-reads the section — onChanged is the section's refresh (both routes), called on every successful write.
  assert.match(panel, /if \(answer\.ok\) \{ onChanged\(\); onClose\(\); \} else setWords\(answer\.words\);/);
  const f = code(SECTION_F);
  assert.match(f, /vendorOpen=\{vendorFor === row\.id\} setVendorOpen=\{\(on\) => setVendorFor\(on \? row\.id : null\)\} onChanged=\{refresh\} \/>/);
  assert.match(f, /const refresh = \(\) => \{ readRoutines\(\); \};/);
  assert.match(f, /readJson\(`\/api\/operations\/routines\/month\?as_of=\$\{localToday\(\)\}`/, 'the re-read is the month route (vendor_words)');
  // No new route, no schema (ruling D): the panel reaches only the two existing vendor routes, through the box.
  assert.doesNotMatch(panel, /fetch\(|\/api\//, 'every call is the box\'s');
  assert.ok(!existsSync(resolve(process.cwd(), 'src/app/api/operations/routine-vendors')), 'no new route');
  assert.doesNotMatch(code('prisma/schema.prisma'), /EXPENSES-02/, 'no migration');
  // The law holds the control and the panel's writes.
  const law = code(LAW);
  assert.match(law, /SectionF_RoutineExpenses\.tsx', \/VENDOR_CONTROL_WORDS\//);
  assert.match(law, /RoutineVendorPanel\.tsx', \/setVendor\\\(address, null, vendorId\\\)\//);
  assert.match(law, /RoutineVendorPanel\.tsx', \/<ClearVendor address=\\\{address\\\}\//);
  assert.match(comments(LAW), /EXPENSES-02 \(Alex, 2026-10-26, ruling A\): the vendor is DECIDED on the row/);
});

// ── THE MONTH LINE'S GRAIN (the rule behind the control) ────────────────────

test('the month line carries vendor_grain beside its words: every → the name; occurrence → "by occurrence"; none → null; both → the refusal', () => {
  // The rule's fixtures as routines03.test.ts builds them — a routine as /budget reads one, with whether it is active.
  const BKK = 'Asia/Bangkok';
  const plan = (o: Partial<RoutineMonthRoutine> & { id: string; name: string }): RoutineMonthRoutine => ({
    entityId: 'p', entityType: 'personal', timezone: BKK, scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null,
    budgetAmount: null, coaCode: null, steps: [], isActive: true, ...o,
  });
  const lined = plan({ id: 'r-lined', name: 'Lined', steps: [{ id: 's-1', stepOrder: 1, budgetAmount: '4', coaCode: '6150' }] });
  const plain = plan({ id: 'r-plain', name: 'Plain', budgetAmount: '10', coaCode: '6150' });
  const vendor = (o: Partial<PlanVendorRow> & { id: string }): PlanVendorRow => ({
    routine_id: null, step_id: null, task_id: null, occurrence_at: null, vendor: { id: 'v-1', vendor_name: 'Luka Café', entity_id: 'p' }, routine: null, step: null, task: null, ...o,
  });
  const input: RoutineMonthInput = { asOf: '2026-10-26', routines: [lined, plain], records: [], links: [], vendors: [] };
  const grainOf = (vendors: PlanVendorRow[], routineId: string, stepId: string | null) => {
    const month = routineMonthOf({ ...input, vendors });
    assert.ok(month.ok, month.ok ? '' : month.message);
    const line = month.lines.find((l) => l.routine_id === routineId && l.step_id === stepId);
    assert.ok(line, `${routineId}/${stepId} is a line`);
    return { words: line.vendor_words, grain: line.vendor_grain };
  };
  assert.deepEqual(grainOf([], 'r-lined', 's-1'), { words: null, grain: null });
  assert.deepEqual(grainOf([vendor({ id: 'pv-1', step_id: 's-1', step: { activity: 'Coffee', routine_id: 'r-lined', routine: { name: 'Lined', timezone: BKK } } })], 'r-lined', 's-1'), { words: 'Luka Café', grain: 'every' });
  const at = new Date('2026-10-03T00:00:00.000Z');
  assert.deepEqual(grainOf([vendor({ id: 'pv-2', routine_id: 'r-plain', occurrence_at: at, routine: { name: 'Plain', timezone: BKK } })], 'r-plain', null), { words: BY_OCCURRENCE_WORDS, grain: 'occurrence' });
  const both = grainOf([
    vendor({ id: 'pv-3', routine_id: 'r-plain', routine: { name: 'Plain', timezone: BKK } }),
    vendor({ id: 'pv-4', routine_id: 'r-plain', occurrence_at: at, routine: { name: 'Plain', timezone: BKK }, vendor: { id: 'v-2', vendor_name: 'Other Co', entity_id: 'p' } }),
  ], 'r-plain', null);
  assert.equal(both.grain, 'both');
  assert.match(both.words ?? '', /^plan routine:r-plain holds "Luka Café" for every occurrence AND "Other Co" at /);
  assert.match(code(MONTH), /readonly vendor_grain: RoutineVendorGrain;/);
  assert.match(comments(MONTH), /EXPENSES-02 \(Alex, 2026-10-26, ruling A\): the grain the plan's vendor rows hold/);
  assert.match(comments(WORK), /EXPENSES-02 \(Alex, 2026-10-26, ruling A\): this cell is where a\s*\n\s*\*\s+line's vendor is DECIDED/);
});

// ── RULING C · THE REGISTRY ROW, THE CENSUS, THE PLAN SURFACES ──────────────

test('C Expenses is LIVE with four beats, no why, the customer line without "not yet"; the census is 3 · 9 · 13; the claim is "built and running"; the opener prints no line', () => {
  const t = expenses();
  assert.equal(t.status, 'LIVE');
  assert.deepEqual(t.beats, { discover: true, decide: true, commit: true, record: true });
  assert.equal(t.home, '/expenses');
  assert.equal(t.why, undefined, 'a LIVE row carries no why — the registry law holds why to a PARTIAL row');
  assert.equal(t.customer, 'You can plan every recurring expense — its amount, account, cadence and vendor — and see this month\'s budget, what you logged at each stop and what Books matched, line by line.');
  assert.doesNotMatch(t.customer ?? '', /not yet|\.tsx?:|src\/|\b(discover|decide|commit|record)/i, 'no "not yet", no source path, no beat word');
  assert.match(t.citation, /EXPENSES-02 \(2026-10-26\) decide: the VENDOR cell's control \(SectionF_RoutineExpenses\.tsx VENDOR_CONTROL_WORDS\) opens routines\/RoutineVendorPanel\.tsx — setVendor \(budget\/VendorBox\.tsx\) → POST src\/app\/api\/operations\/plan-vendors\/route\.ts:\d+ at instant null/);
  assert.match(t.citation, /clear → route\.ts:\d+ \(DELETE\); add → vendor-directory\/route\.ts:\d+ \(POST\)/);
  assert.match(t.citation, /receipts are the Documents job, not this row's \(ruled 2026-10-26\)/);
  assert.match(comments(REGISTRY), /EXPENSES-02 census \(Alex, 2026-10-26\): Expenses LIVE — the vendor decided on the row; receipts are Documents' job\./);
  // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. The EXPENSES-02 census line stays in the record; the counts moved on (tasks03.test.ts).
  assert.match(comments(REGISTRY), /2 · 10 · 13 → 3 · 9 · 13/);
  assert.match(comments(REGISTRY), /RECEIPTS ARE THE DOCUMENTS JOB — ruled in chat 2026-10-26/);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  // The law would refuse the row as LIVE with a why, or short of a beat.
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Expenses' ? { ...x, why: 'x' } : x)) }).join('\n'), /Expenses: why belongs only to a PARTIAL tool/);
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Expenses' ? { ...x, beats: { ...x.beats, decide: false } } : x)) }).join('\n'), /Expenses: LIVE needs four beats and a home/);
  assert.equal(claimForTool('Expenses'), 'built and running');
  assert.equal(navToolByName('Expenses', TOOL_GATE).line, null);
  assert.equal(navToolByName('Expenses', TOOL_GATE).status, 'LIVE');
});

test('C the free set and the selling surfaces follow by derivation: Expenses joins Travel; the hero counts three live; the verification email names it free', () => {
  assert.equal(TOOL_GATE.Expenses, null);
  // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. Tasks joined the free set before Expenses; the counts are tasks03.test.ts's.
  assert.ok(FREE_TOOLS.some((t) => t.name === 'Expenses') && FREE_TOOLS.some((t) => t.name === 'Travel'));
  assert.match(freeSetLine(), /^Free with an account, no module to buy: .*Expenses, Travel — the registry's live tools with no tab gate\.$/);
  assert.match(heroCountsLine(), /^Twenty-five tools, counted: \w+ live, \w+ partial, thirteen on the blueprint\.$/);
  const mail = verificationEmail({ name: 'Ada', verifyUrl: 'https://templestuart.com/api/auth/verify?token=t', baseUrl: 'https://templestuart.com/' });
  assert.match(mail.text, /Free with your account: .*Expenses, Travel\./); // TASKS-03 (2026-10-26): Tasks precedes them
});

test('C the plan surfaces flip the one row standing on Expenses to ✓ by derivation, in every plan (all four hold personal); its label says what Expenses does', () => {
  // TIME-03 (Alex, 2026-10-26, ruling E): "Projects and routines, each with what it costs" is backed by Tasks and Expenses too (time03.test.ts) — this test holds the Expenses row of its own.
  const rows = CAPABILITY_GROUPS.flatMap((g) => g.rows.map((row) => ({ group: g.id, row }))).filter((r) => r.row.tools.includes('Expenses') && r.group === 'books');
  assert.equal(rows.length, 1, 'one row of the books group stands on Expenses');
  const [{ group, row }] = rows;
  assert.equal(group, 'books');
  assert.deepEqual(row.tools, ['Expenses']);
  assert.equal(row.module, 'personal');
  assert.equal(row.label, 'Every recurring expense planned, with its vendor and what it cost this month');
  for (const plan of PLANS) assert.equal(cellState(plan, row), 'ready', `${plan.id} reads ✓`);
  // Nothing typed: the cell comes from the registry's status through the one mapping.
  assert.equal(cellState(PLANS[0], row, TOOL_REGISTRY.map((x) => (x.name === 'Expenses' ? { ...x, status: 'PARTIAL' as const } : x))), 'partial');
  assert.doesNotMatch(code(PLANS_FILE), /Receipts matched to the charge that made them/, 'the old label — a job nobody built — is gone');
  assert.match(comments(PLANS_FILE), /EXPENSES-02 \(Alex, 2026-10-26\): Expenses is LIVE, so this row reads ✓ by derivation/);
});
