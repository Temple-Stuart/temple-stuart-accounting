/**
 * VENDOR-02 (2026-10-14) — THE VENDOR BOX ON EVERY PRICED STOP; STRANDED VENDORS
 * LEAVE THE CARD FOR BUDGET.
 *
 * Alex's ruling: the vendor box shows for every stop that is a stop and has a
 * matched plan line, whatever its role (ROLE-01 showed it on place stops only),
 * directly above the record row, labelled VENDOR; a place stop with no line keeps
 * its one reason; a work stop with no money shows nothing. The day card is the
 * daily and overlay surface — stranded vendor picks are Budget's to show and
 * clear, so the card's amber line and its "N vendors stranded" count go; /budget
 * keeps its list, each with Clear.
 *
 * The rule (dayCard.ts vendorSlot) is DRIVEN over the card's own stops, built by
 * dayStops from fixtures; the screens are anchored to their source with comments
 * stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import type { PlanLine } from '../budget/planLines';
import { NO_AMOUNT_NO_VENDOR_WORDS, REPORT_NOT_READ_NO_VENDOR_WORDS, UNMATCHED_NO_VENDOR_WORDS, type StopRole } from '../operations/stopRole';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry } from '@/components/workbench/operations/routines/types';
import { completenessWords, dayStops, focusStop, vendorSlot, type DayCardInput, type Stop } from '@/components/workbench/operations/day/dayCard';

const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const VENDOR = 'src/components/workbench/operations/stops/StopVendor.tsx';
// BUDGET-02 (2026-10-20): the box's file is VendorBox.tsx — DayPlanDrill.tsx less the drill, which left /budget.
const DRILL = 'src/components/budget/VendorBox.tsx';
const BUDGET = 'src/components/budget/BudgetReport.tsx';
const BUDGET_PAGE = 'src/app/budget/page.tsx';

// ── FIXTURES (the day card's own shapes) ────────────────────────────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
const routine = (over: Partial<Routine> & { id: string; name: string; role: StopRole; schedule_rrule: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], ...over,
});
const step = (over: Partial<RoutineStep> & { id: string; routine_id: string; step_order: number; activity: string }): RoutineStep => ({
  user_id: 'u', entity_id: 'P', time_of_day: null, sub_activity: null, location: null, duration_minutes: null,
  notes: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});
const entry = (r: Routine, expected_at: string): TodayRoutineEntry => ({ routine: r, expected_at, status: 'pending', completion: null });
const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: [], ...over });

/** One stepless routine per role, each at its own hour (Bangkok = UTC+7). */
const ROLES: readonly { role: StopRole; hour: number; at: string }[] = [
  { role: 'journal', hour: 6, at: '2026-10-10T23:00:00.000Z' },
  { role: 'plan', hour: 7, at: '2026-10-11T00:00:00.000Z' },
  { role: 'execute', hour: 9, at: '2026-10-11T02:00:00.000Z' },
  { role: 'place', hour: 12, at: '2026-10-11T05:00:00.000Z' },
  { role: 'none', hour: 20, at: '2026-10-11T13:00:00.000Z' },
];
const routineOf = (role: StopRole, hour: number): Routine => routine({ id: `r-${role}`, name: `R ${role}`, role, schedule_rrule: `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=0` });
const lineOf = (role: StopRole, at: string, cents = 1500): PlanLine => line({ address: { kind: 'routine', id: `r-${role}`, instant: at }, cents, label: `R ${role}` });
const stopOf = (result: ReturnType<typeof dayStops>, role: StopRole): Stop => {
  const s = result.stops.find((x) => x.role === role);
  if (s === undefined) throw new Error(`no ${role} stop on the fixture day`);
  return s;
};

// ── T1 · THE RULE, DRIVEN OVER THE CARD'S OWN STOPS ─────────────────────────

test('T1 a priced stop of EVERY role — none, journal, plan, execute, place — gets the box on its matched line', () => {
  const lines = ROLES.map((r) => lineOf(r.role, r.at));
  const result = dayStops(input({ entries: ROLES.map((r) => entry(routineOf(r.role, r.hour), r.at)), lines }));
  assert.equal(result.stops.length, 5);
  for (const r of ROLES) {
    const s = stopOf(result, r.role);
    assert.equal(s.planLineState, 'matched', `${r.role} is matched`);
    const slot = vendorSlot(s, true);
    assert.equal(slot.kind, 'box', `${r.role}: a priced stop shows the box, whatever its role`);
    assert.equal(slot.kind === 'box' ? slot.line : null, lines.find((l) => l.address.id === `r-${r.role}`), `${r.role}: on its own matched plan line`);
  }
  // The same through the step view: stop n of N carries the same slot.
  for (let n = 1; n <= 5; n += 1) assert.equal(vendorSlot(focusStop(result, n)!.stop, true).kind, 'box');
});

test('T1 an unpriced WORK stop shows nothing — nothing to pay; a place stop with no line keeps its one reason per cause', () => {
  const result = dayStops(input({ entries: ROLES.map((r) => entry(routineOf(r.role, r.hour), r.at)), lines: [] }));
  for (const role of ['journal', 'plan', 'execute', 'none'] as const) {
    assert.deepEqual(vendorSlot(stopOf(result, role), true), { kind: 'none' }, `${role} with no money: no box, no reason`);
    assert.deepEqual(vendorSlot(stopOf(result, role), false), { kind: 'none' }, `${role} while the amounts are unread: nothing`);
  }
  const place = stopOf(result, 'place');
  assert.equal(place.planLineState, 'none');
  assert.deepEqual(vendorSlot(place, true), { kind: 'reason', words: NO_AMOUNT_NO_VENDOR_WORDS }, 'no line: give it an amount');
  assert.deepEqual(vendorSlot(place, false), { kind: 'reason', words: REPORT_NOT_READ_NO_VENDOR_WORDS }, 'the amounts unread: said so');
  // A line at another instant: the place stop names it; a work stop still shows nothing.
  const moved = dayStops(input({
    entries: [entry(routineOf('place', 12), ROLES[3].at), entry(routineOf('execute', 9), ROLES[2].at)],
    lines: [lineOf('place', '2026-10-11T06:00:00.000Z'), lineOf('execute', '2026-10-11T03:00:00.000Z')],
  }));
  assert.equal(stopOf(moved, 'place').planLineState, 'unmatched');
  assert.deepEqual(vendorSlot(stopOf(moved, 'place'), true), { kind: 'reason', words: UNMATCHED_NO_VENDOR_WORDS });
  assert.deepEqual(vendorSlot(stopOf(moved, 'execute'), true), { kind: 'none' });
  // A line the report holds is never shown while the report is not read (a place stop says why; any other, nothing).
  const priced = stopOf(dayStops(input({ entries: [entry(routineOf('place', 12), ROLES[3].at)], lines: [lineOf('place', ROLES[3].at)] })), 'place');
  assert.deepEqual(vendorSlot(priced, false), { kind: 'reason', words: REPORT_NOT_READ_NO_VENDOR_WORDS });
  assert.deepEqual(vendorSlot({ ...priced, role: 'execute' }, false), { kind: 'none' });
});

test('T1 an all-day line is not a stop — never a box, even with money; a line of a routine and a task are stops like any other', () => {
  const HBO_AT = '2026-10-11T01:00:00.000Z';
  const hbo = routine({ id: 'hbo', name: 'HBO', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=8;BYMINUTE=0' });
  const hboLine = line({ address: { kind: 'routine', id: 'hbo', instant: HBO_AT }, cents: 1100, label: 'HBO', time: '08:00' });
  const r = dayStops(input({ entries: [entry(hbo, HBO_AT)], lines: [hboLine] }));
  assert.equal(r.stops.length, 0, 'not a stop — no step view at all');
  assert.equal(r.allDay.length, 1);
  assert.equal(r.allDay[0].planLine, hboLine, 'the band holds its line');
  assert.deepEqual(vendorSlot(r.allDay[0], true), { kind: 'none' }, 'the rule refuses it by role, should it ever be asked');
  // A routine with lines: each priced line is its own stop, with its own box; an unpriced line of a work routine shows nothing.
  const MORNING_AT = '2026-10-11T00:00:00.000Z';
  const morning = routine({
    id: 'morning', name: 'Morning', role: 'execute', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0',
    steps: [step({ id: 'coffee', routine_id: 'morning', step_order: 1, activity: 'Coffee' }), step({ id: 'deep', routine_id: 'morning', step_order: 2, activity: 'Deep work' })],
  });
  const coffee = line({ address: { kind: 'routine_line', id: 'coffee', instant: MORNING_AT }, cents: 500, label: 'Morning', line: 'Coffee' });
  const m = dayStops(input({ entries: [entry(morning, MORNING_AT)], lines: [coffee] }));
  assert.deepEqual(vendorSlot(m.stops[0], true), { kind: 'box', line: coffee }, 'the priced line of an execute routine');
  assert.deepEqual(vendorSlot(m.stops[1], true), { kind: 'none' }, 'its unpriced line — nothing to pay');
  // A task with a matched task line (role 'none') is a stop with money: the box (VendorBox's one-button grain for a task).
  const task = line({ address: { kind: 'project_task', id: 'T1', instant: null }, cents: 2000, label: 'Ship VENDOR-02', source: 'task' });
  const item: DailyPlanItem = {
    id: 'item-1', user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: 'T1', ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
    notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null,
    task: { id: 'T1', title: 'Ship VENDOR-02', status: 'in_progress', estimated_cost_usd: '20.00', actual_cost_usd: null, actual_minutes: null, completed_at: null } as DailyPlanItem['task'],
    calendar_blocks: [],
  };
  const t = dayStops(input({ items: [item], lines: [task] }));
  assert.equal(t.stops[0].kind, 'task');
  assert.deepEqual(vendorSlot(t.stops[0], true), { kind: 'box', line: task });
});

test('T1 "priced" is the matched plan line itself — the Budget builds one only for a line with an amount, $0.00 included, as before for a place stop', () => {
  const zero = lineOf('execute', ROLES[2].at, 0);
  const r = dayStops(input({ entries: [entry(routineOf('execute', 9), ROLES[2].at)], lines: [zero] }));
  assert.deepEqual(vendorSlot(stopOf(r, 'execute'), true), { kind: 'box', line: zero });
  assert.match(comments(RULES), /A plan line exists only for a line\s*\n\s*\* that carries an amount \(budget\/days\.ts\), so "priced" is the matched line\s*\n\s*\* itself, as it was for a place stop\./);
  assert.match(code('src/lib/budget/days.ts'), /planned\.lines\.filter\(\(l\) => l\.amount !== null\)/, 'the Budget builds a line only for an amount');
  assert.doesNotMatch(code(RULES), /\bfetch\s*\(|new Date\(\)|from 'react'/, 'the rule stays pure');
});

// ── T2 · THE SCREEN: UNDER THE CARD, ABOVE THE RECORD ROW, BUDGET'S OWN BOX ─

test('T2 the card mounts the VENDOR row on every step view, by the rule — after the fine print, directly above the record row', () => {
  const c = code(CARD);
  assert.match(c, /import StopVendor from '\.\.\/stops\/StopVendor';/);
  assert.match(c, /\{loaded && focus !== null && \(\n\s*<StopVendor key=\{focus\.stop\.key\} slot=\{vendorSlot\(focus\.stop, reportRead\)\} bookName=\{focus\.stop\.planLine === null \? ACCOUNT_CELL_WORDS\.bookNotLoaded : bookNameOf\(focus\.stop\.planLine\.entityId\)\} reload=\{\(\) => setReportReads\(\(n\) => n \+ 1\)\} \/>\n\s*\)\}/,
    'on the step view for any stop (a task too; the records need not have been read — a vendor is a plan write), keyed by the stop, a write re-reading the report');
  assert.equal((c.match(/<StopVendor /g) ?? []).length, 1, 'mounted once');
  const at = (s: string) => { const i = c.indexOf(s); assert.ok(i >= 0, `${s} is on the card`); return i; };
  assert.ok(at('data-day-download-image') < at('data-day-fine-print') && at('data-day-fine-print') < at('<StopVendor') && at('<StopVendor') < at('<StopForm') && at('<StopForm') < at('data-day-foot'),
    'the download button (directly under the plate — CLEAN-02), the fine print, the VENDOR row, then the record row');
  // The plate's own VENDOR cell still shows what the box planned — the box re-reads the report, never an optimistic copy.
  assert.match(c, /useEffect\(\(\) => \{[\s\S]*?\}, \[day, today, reportReads\]\);/, 'a bumped reportReads reads the report again');
});

test('T2 StopVendor: the label VENDOR, Budget\'s own box on the line or the place stop\'s reason, nothing else; the directory read only while the box shows', () => {
  const v = code(VENDOR);
  assert.match(v, /if \(slot\.kind === 'none'\) return null;/, 'nothing at all when there is nothing to pay');
  // WIDTH-01 (Alex, 2026-10-16): the box takes the card's width on screen — the deck's rule (stops/DayDeck.tsx underStyle; deck01 T6).
  assert.match(v, /<div className="mx-auto flex flex-wrap items-center gap-1\.5 text-xs" style=\{underStyle\(bleed\)\} data-stop-vendor>\n\s*<span className="text-text-faint uppercase tracking-wide">\{VENDOR_LABEL_WORDS\}<\/span>/, 'at the card’s width, labelled VENDOR (the label word, upper-cased)');
  assert.match(v, /\{slot\.kind === 'box'\n\s*\? <Box line=\{slot\.line\} bookName=\{bookName\} reload=\{reload\} \/>\n\s*: <span className="text-text-muted" data-stop-no-vendor>\{slot\.words\}<\/span>\}/);
  assert.match(v, /function Box\(\{ line, bookName, reload \}: \{ line: PlanLine; bookName: string; reload: \(\) => void \}\) \{\n\s*const directory = useDirectory\(\);\n\s*return <VendorBox line=\{line\} bookName=\{bookName\} directory=\{directory\} reload=\{reload\} \/>;\n\}/, 'the directory hook lives in the box child — a reason reads nothing');
  assert.equal((v.match(/useDirectory\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(v, /\bfetch\s*\(|\/api\/|useState|localStorage|sessionStorage/, 'no route of its own, no copy of its own, nothing stored');
  // The form holds no vendor box now — its props went with it.
  const f = code(FORM);
  assert.doesNotMatch(f, /PlaceVendor|VendorBox|useDirectory|data-stop-vendor|onPlanChanged|reportRead|bookName/);
  assert.match(f, /export default function StopForm\(\{ stop, day, viewerZone, onChanged \}: \{ stop: Stop; day: string; viewerZone: string; onChanged: \(\) => void \}\) \{/);
});

test('T2 the box is Budget\'s, unchanged — pick from the book, "+ add", This day / Every time, Change, Clear — and it writes through the two vendor routes only', () => {
  const d = code(DRILL);
  assert.match(d, /\nexport function VendorBox\(\{ line, bookName, directory, reload \}: \{/);
  for (const words of ['>+ add {choices.add} to {bookName}</button>', '>This day</button>', '>Every time</button>', '>Change</button>', '>+ vendor</button>', "label = 'Clear'"]) assert.ok(d.includes(words), `the box still offers ${words}`);
  assert.match(d, /if \(answer\.ok\) \{ reset\(\); reload\(\); \} else setWords\(answer\.words\);/, 'a set: then the caller reads again');
  assert.match(d, /if \(answer\.ok\) reload\(\);/, 'a clear: then the caller reads again');
  const routes = [...d.matchAll(/fetch\(\s*[`'](\/api\/[^`'?$]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(routes)], ['/api/operations/plan-vendors', '/api/operations/vendor-directory'], 'the two vendor routes, and no other');
});

// ── T3 · STRANDED VENDORS LEAVE THE CARD; BUDGET KEEPS THEM WITH CLEAR ──────

// VENDOR-03 (Alex, 2026-10-27): the card lists them again — not on the plate, the foot or the completeness line, but in their own
// section under the full card's plate (stops/StrandedVendors.tsx, vendor03.test.ts). These pins still hold for the card's own file:
// no amber foot line, no count, no word of its own; the section's markup and words live in the section and its words module.
test('T3 the day card\'s plate, foot and completeness line name no stranded vendor (VENDOR-03: the section under the plate does, in its own file)', () => {
  const c = code(CARD);
  assert.doesNotMatch(c, /data-day-stranded|strandedWords|\bstranded\b|vendors? stranded/);
  assert.doesNotMatch(code(RULES), /strandedWords|StrandedVendor|vendors? stranded/);
  assert.equal(completenessWords.length, 2, 'the result and what was read — no stranded count');
  assert.match(c, /const completeness = completenessWords\(result, \{ day: !dayFailed, report: reportRead, records: recordsOk \}\);/);
  assert.match(comments(RULES), /VENDOR-02 \(2026-10-14\) — Alex's ruling: the day card is the daily and overlay\s*\n\s*\* surface; stranded vendor picks are Budget's to show and clear\./);
  // Driven: a day whose report lists stranded vendors prints none of them — the card does not even read the field.
  const r = dayStops(input({ entries: [entry(routineOf('place', 12), ROLES[3].at)], lines: [lineOf('place', ROLES[3].at)] }));
  assert.equal(completenessWords(r, { day: true, report: true, records: true }), '1 not recorded');
});

// BUDGET-02 (Alex, ruling A, 2026-10-20): "the 'what this view is missing' notice strip … leave[s] the screen" — and
// VENDORS STRANDED was that notice's last line. /budget no longer lists the stranded vendors (was: each with Clear,
// VENDOR-02's home for them). Stated, not hidden: the report still computes them for a DAY or WEEK (planLines.ts
// dayPlanOf; budgetPlanLines T2 drives it), and no screen shows them now — reported to Alex in the BUDGET-02 PR.
test('T3 BUDGET-02: /budget lists no stranded vendors — the notice left the page; the report still computes them for a DAY or WEEK', () => {
  const b = code(BUDGET);
  assert.doesNotMatch(b, /vendors-stranded|VENDORS STRANDED|ClearVendor|DayPlanDrill/, 'the notice and its Clear left /budget');
  assert.match(code(BUDGET_PAGE), /import BudgetReport from '@\/components\/budget\/BudgetReport';/);
  assert.match(code('src/lib/budget/planLines.ts'), /readonly stranded: readonly StrandedVendor\[\]/);
  assert.match(code('src/lib/budget/planLines.ts'), /export function dayPlanOf\(input: DayPlanInput\): DayPlanResult \{/);
});
