import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDay, expectedTotal, coverageLine, readTasks,
  dayParts, partLine, dayTotalLine, ROUTINE_PART_SOURCE,
  type DayEventInput,
} from '../calendar/day';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { code } from '../sourceText';

/**
 * ROUTINE-01 — THE DAY'S TOTAL NAMES ITS PARTS. The defect DAY-01's own audit
 * found: routine occurrences were summed inside the "Events" figure with
 * nothing saying so. Right number, wrong label.
 */

const DAY_VIEW = 'src/components/hub/DayView.tsx';
const DAY = '2026-08-14';

const ev = (over: Partial<DayEventInput> & { id: string }): DayEventInput => ({
  source: 'trip', title: over.id, startDate: DAY, ...over,
});
const routine = (over: Partial<DayEventInput> & { id: string }): DayEventInput =>
  ev({ source: ROUTINE_PART_SOURCE, ...over });

// ───────────────────────────────────────────────────────────────────────────
test('a day with events and routines shows BOTH parts, each with its own count', () => {
  const rows = buildDay([
    ev({ id: 'hotel', startTime: '15:00', budgetAmount: 180 }),
    ev({ id: 'museum', startTime: '11:00', budgetAmount: 30 }),
    ev({ id: 'walk', startTime: '17:00' }),
    routine({ id: 'gym', startTime: '07:00', endTime: '09:00', budgetAmount: 100 }),
    routine({ id: 'lunch', startTime: '12:30', budgetAmount: 30 }),
    routine({ id: 'post' }),
  ], DAY);

  const totals = dayParts(rows, []);
  assert.deepEqual(totals.parts.map((p) => p.key), ['events', 'routines']);

  const events = totals.parts.find((p) => p.key === 'events')!;
  const routines = totals.parts.find((p) => p.key === 'routines')!;
  assert.deepEqual(events.total, { total: 210, covered: 2, of: 3 });
  assert.deepEqual(routines.total, { total: 130, covered: 2, of: 3 });
  assert.equal(partLine(events), 'Events: $210 planned across 2 of 3 events');
  assert.equal(partLine(routines), 'Routines: $130 planned across 2 of 3 routines');

  // The routines are NO LONGER inside the Events figure — the defect, gone.
  const beforeThisPR = expectedTotal(rows);
  assert.equal(beforeThisPR.total, 340, 'the old single figure was 340');
  assert.notEqual(events.total.total, beforeThisPR.total, 'Events must no longer contain the routines');
});

test('a routine with no budget_amount is counted OUT of its part, never as zero', () => {
  const rows = buildDay([
    routine({ id: 'gym', startTime: '07:00', budgetAmount: 100 }),
    routine({ id: 'post' }),
    routine({ id: 'meditate', budgetAmount: null }),
  ], DAY);
  const part = dayParts(rows, []).parts.find((p) => p.key === 'routines')!;
  assert.deepEqual(part.total, { total: 100, covered: 1, of: 3 });
  assert.equal(partLine(part), 'Routines: $100 planned across 1 of 3 routines');
  // Blank, not $0 — the row itself says so too.
  assert.deepEqual(rows.map((r) => r.expected).sort((a, b) => (a ?? -1) - (b ?? -1)), [null, null, 100]);
  // A REAL zero is a number the app has, and it counts.
  const withZero = dayParts(buildDay([routine({ id: 'free', budgetAmount: 0 })], DAY), []);
  assert.deepEqual(withZero.parts.find((p) => p.key === 'routines')!.total, { total: 0, covered: 1, of: 1 });
});

test('a day with no tasks omits the Tasks part — never a $0 row', () => {
  const rows = buildDay([ev({ id: 'hotel', budgetAmount: 180 })], DAY);
  assert.deepEqual(dayParts(rows, []).parts.map((p) => p.key), ['events']);
  // And with no routines either, Routines is absent too.
  assert.equal(dayParts(rows, []).parts.some((p) => p.key === 'routines'), false);
  // A task with no cost is still a task — the part appears, counted out.
  const tasks = readTasks([{ id: 't1', text: 'Write the PR body', completed: false }]);
  const withTasks = dayParts(rows, tasks);
  assert.deepEqual(withTasks.parts.map((p) => p.key), ['events', 'tasks']);
  const taskPart = withTasks.parts.find((p) => p.key === 'tasks')!;
  assert.deepEqual(taskPart.total, { total: 0, covered: 0, of: 1 });
  assert.equal(partLine(taskPart), 'Tasks: $0 costed across 0 of 1 task');
  // An entirely empty day says so rather than adding nothing up to $0.
  assert.deepEqual(dayParts([], []).parts, []);
  assert.equal(dayTotalLine(dayParts([], [])), 'Nothing on this day to add up');
});

test('the parts sum to the day total, and the sum says which parts it added', () => {
  const rows = buildDay([
    ev({ id: 'hotel', budgetAmount: 180 }),
    ev({ id: 'museum', budgetAmount: 30 }),
    ev({ id: 'walk' }),
    routine({ id: 'gym', budgetAmount: 100 }),
    routine({ id: 'lunch', budgetAmount: 30 }),
    routine({ id: 'post' }),
  ], DAY);
  const tasks = readTasks([
    { id: 't1', text: 'Book the ferry', completed: true, cost: 38 },
    { id: 't2', text: 'Write the PR body', completed: false },
  ]);
  const totals = dayParts(rows, tasks);

  // The grand total IS the parts added — not a second sweep of the rows.
  assert.equal(totals.total, totals.parts.reduce((s, p) => s + p.total.total, 0));
  assert.equal(totals.total, 210 + 130 + 38);
  assert.equal(dayTotalLine(totals), '$378 — Events $210 + Routines $130 + Tasks $38');

  // Every part's coverage comes from DAY-01's own coverageLine.
  for (const p of totals.parts) {
    assert.equal(partLine(p), `${p.label}: ${coverageLine(p.total, p.noun, p.verb)}`);
  }
  // The counts add up to the whole day too.
  const rowParts = totals.parts.filter((p) => p.key !== 'tasks');
  assert.equal(rowParts.reduce((s, p) => s + p.total.of, 0), rows.length);
});

test('the part source is the one mapOperationsRoutines actually stamps', () => {
  // The leaf names 'routines' rather than importing the grid's mapper; this
  // feeds a routine through the REAL mapper and holds the two together, so the
  // value cannot drift unnoticed.
  const emitted = mapOperationsRoutines({
    routines: [{
      routine_id: 'r1', name: 'Gym', entity_id: 'e1', timezone: 'Asia/Bangkok',
      start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T09:00:00.000Z',
      occurrences: ['2026-08-14T00:00:00.000Z'], coa_code: '8210', budget_amount: 100,
    }],
    truncated: false,
  });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].source, ROUTINE_PART_SOURCE);
  // And such an occurrence lands in the Routines part, with its budget.
  const rows = buildDay([{
    id: emitted[0].id, source: emitted[0].source, title: emitted[0].title,
    startDate: emitted[0].startDate, startTime: emitted[0].startTime, endTime: emitted[0].endTime,
    budgetAmount: emitted[0].budgetAmount,
  }], emitted[0].startDate);
  const part = dayParts(rows, []).parts.find((p) => p.key === 'routines')!;
  assert.deepEqual(part.total, { total: 100, covered: 1, of: 1 });
  // A budget-less routine maps to undefined, never 0 (mapOperationsRoutines:95).
  const none = mapOperationsRoutines({
    routines: [{ ...({ routine_id: 'r2', name: 'Post', entity_id: 'e1', timezone: 'UTC', start_time: null, end_time: null, occurrences: ['2026-08-14T00:00:00.000Z'], coa_code: null, budget_amount: null }) }],
    truncated: false,
  });
  assert.equal(none[0].budgetAmount, undefined);
});

test('the day view renders its parts from the list, sums them once, and names every total', () => {
  const view = code(DAY_VIEW);
  assert.match(view, /dayParts\(rows, tasks\)/);
  assert.match(view, /totals\.parts\.map\(/);
  assert.match(view, /data-day-total-part=\{part\.key\}/);
  assert.match(view, /\{partLine\(part\)\}/);
  assert.match(view, /\{dayTotalLine\(totals\)\}/);
  // ONE summation: the view never sweeps the rows itself.
  assert.equal(/expectedTotal\(/.test(view), false, 'a second summation could disagree with the parts');
  // The old unlabelled "Events" footer is gone.
  assert.equal(/coverageLine\(eventsTotal\)/.test(view), false);
  // FORBIDDEN: this stays a read surface bar EVENT-01's one delete.
  assert.deepEqual([...view.matchAll(/method:\s*'(\w+)'/g)].map((m) => m[1]), ['DELETE']);
  // And nothing here touches routines' own tables.
  assert.equal(/operations_routines|routine_completions|routine_steps/.test(view), false);
});
