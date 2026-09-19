import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKER_MINUTES, FLAG_TEXT, assignLanes, blockExtent, unverifiedDurationExtent } from '../calendar/extent';
import { code, comments } from '../sourceText';

/**
 * GRID-01 — A BLOCK IS AS LONG AS IT SAYS, AND TWO BLOCKS NEVER HIDE EACH OTHER.
 * The extent and the lanes are pure leaves, probed here on plain numbers; the
 * grid cannot render in a bare node test (it calls useRouter — calendarRoom.test.ts
 * pins that), so what the grid DOES with the leaf is asserted from its source,
 * comments stripped (TEST-TRUTH-01), and shown in the walk.
 */

const GRID = 'src/components/shared/CalendarGrid.tsx';
const LEAF = 'src/lib/calendar/extent.ts';
type Span = { s: number; e: number };
const lanesOf = (spans: Span[], minSpan = 0) => assignLanes(spans, (b) => b.s, (b) => b.e, minSpan);

// ───────────────────────────────────────────────────────────────────────────
test('a block with no end draws at minimal height, flagged, and its label keeps the title', () => {
  const ext = blockExtent(600, null);
  assert.deepEqual(ext, { startMin: 600, endMin: 600 + MARKER_MINUTES, flag: 'no-end' });
  assert.equal(MARKER_MINUTES, 30, 'the existing 30-minute marker');
  assert.equal(FLAG_TEXT['no-end'], 'no end time');
  assert.deepEqual(blockExtent(600, undefined), ext, 'undefined is the same absence');
  // The grid: the non-trip path reads the leaf, the label carries the glyph, the
  // TITLE's first characters, then the flag; the subtitle carries the start only.
  const grid = code(GRID);
  assert.match(grid, /const ext = blockExtent\(startMin, storedEndMin\);/);
  assert.match(grid, /const storedEndMin = event\.endTime \? timeToMinutes\(event\.endTime\) : null;/);
  assert.match(grid, /`⚠ \$\{title\} · \$\{FLAG_TEXT\[ext\.flag\]\}`/);
  assert.match(grid, /endLabel: ext\.flag \? undefined : naiveEnd/);
  assert.match(grid, /data-block-flag=\{block\.flag \?\? undefined\}/);
});

test('two overlapping blocks land in two lanes, each half the column, both in the caller\'s order', () => {
  const lanes = lanesOf([{ s: 360, e: 660 }, { s: 420, e: 600 }]);
  assert.deepEqual(lanes, [{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }]);
  // Given in the other order, the EARLIER start still takes lane 0 — sorted by
  // start, never reordered by anything else — and the result stays aligned to the input.
  assert.deepEqual(lanesOf([{ s: 420, e: 600 }, { s: 360, e: 660 }]), [{ lane: 1, lanes: 2 }, { lane: 0, lanes: 2 }]);
  // A tie on start keeps the caller's order.
  assert.deepEqual(lanesOf([{ s: 600, e: 700 }, { s: 600, e: 650 }]), [{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }]);
});

test('three blocks where the third starts after the first ends reuse lane one', () => {
  // The first has ended by 620 while the second still runs: the third takes lane 0 and the cluster stays two wide.
  assert.deepEqual(lanesOf([{ s: 360, e: 600 }, { s: 420, e: 700 }, { s: 620, e: 680 }]), [
    { lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 0, lanes: 2 },
  ]);
  // Both have ended: the third is its own cluster — lane 0 at full width.
  assert.deepEqual(lanesOf([{ s: 360, e: 660 }, { s: 420, e: 600 }, { s: 700, e: 760 }]), [
    { lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 0, lanes: 1 },
  ]);
  // A block that ends exactly when the next starts does not overlap it.
  assert.deepEqual(lanesOf([{ s: 420, e: 600 }, { s: 600, e: 630 }]), [{ lane: 0, lanes: 1 }, { lane: 0, lanes: 1 }]);
  // The founder's Saturday: 6–11, 7–10, then markers at 10:00, 12:00 and 14:00.
  const sat = lanesOf([{ s: 360, e: 660 }, { s: 420, e: 600 }, ...[600, 720, 840].map((s) => ({ s, e: s + MARKER_MINUTES }))]);
  assert.deepEqual(sat, [{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 1, lanes: 2 }, { lane: 0, lanes: 1 }, { lane: 0, lanes: 1 }]);
});

test('two slivers that would overlap on screen share no lane — the drawn floor counts, the data does not change', () => {
  // Zero-length rows at the same minute: with no floor they "fit" one lane; with the grid's one-line floor they cannot.
  assert.deepEqual(lanesOf([{ s: 600, e: 600 }, { s: 600, e: 600 }]), [{ lane: 0, lanes: 1 }, { lane: 0, lanes: 1 }]);
  assert.deepEqual(lanesOf([{ s: 600, e: 600 }, { s: 600, e: 600 }], 30), [{ lane: 0, lanes: 2 }, { lane: 1, lanes: 2 }]);
  const grid = code(GRID);
  assert.match(grid, /const lanes = assignLanes\(blocks, \(b\) => b\.startMin, \(b\) => b\.endMin, MIN_BLOCK_MINUTES\);/);
  assert.match(grid, /const MIN_BLOCK_MINUTES = \(MIN_BLOCK_PX \/ HOUR_HEIGHT\) \* 60;/);
});

test('a trip with unknown duration still draws its existing marker, from the same leaf', () => {
  assert.deepEqual(unverifiedDurationExtent(540), { startMin: 540, endMin: 570, flag: 'duration-unverified' });
  const grid = code(GRID);
  assert.match(grid, /const ext = unverifiedDurationExtent\(tripStartMin\);/);
  assert.match(grid, /label: `⚠ duration unverified · \$\{event\.title\}`/);
  assert.match(grid, /if \(dayOffset === 0\) \{\s*const ext = unverifiedDurationExtent/, 'on the depart day only, as before');
});

test('a block with a real end is unchanged — exact, unflagged, no clamp anywhere in the builder', () => {
  assert.deepEqual(blockExtent(600, 645), { startMin: 600, endMin: 645, flag: null });
  assert.deepEqual(blockExtent(600, 605), { startMin: 600, endMin: 605, flag: null }, 'five minutes is five minutes');
  assert.deepEqual(blockExtent(600, 600), { startMin: 600, endMin: 600, flag: null }, 'zero length is drawn one line tall by the floor, not lengthened here');
  // An end before the start is bad data: a flagged marker, never a negative or an invented span.
  assert.deepEqual(blockExtent(600, 500), { startMin: 600, endMin: 630, flag: 'end-before-start' });
  const grid = code(GRID);
  const builder = grid.slice(grid.indexOf('function getBlocksForDay('), grid.indexOf('export default function CalendarGrid('));
  assert.doesNotMatch(builder, /Math\.max\(/, 'no clamp in the block builder');
  assert.doesNotMatch(builder, /\w*Min\s*\+\s*\d+/, 'nothing adds a literal number of minutes to a minute value');
  assert.match(builder, /endMin: segEnd, flag: null/, 'a flight segment is exactly as long as its duration says');
  assert.match(builder, /endMin: 24 \* 60, flag: null/, 'a multi-day departure day runs to midnight — the row continues');
  assert.match(builder, /const ext = blockExtent\(0, storedEndMin\);/, 'the arrival day reads the leaf too');
  // The render floor is one text line, not 1.5 hours.
  assert.match(grid, /const MIN_BLOCK_PX = 26;/);
  assert.doesNotMatch(grid, /HOUR_HEIGHT \* 1\.5|MIN_EVENT_HEIGHT/);
  assert.match(grid, /Math\.max\(\(\(block\.endMin - block\.startMin\) \/ 60\) \* HOUR_HEIGHT, MIN_BLOCK_PX\)/);
});

test('the label survives: the whole label rides the hover/focus title, the marker shows its first characters', () => {
  const grid = code(GRID);
  assert.match(grid, /const hoverTitle = `\$\{block\.label\}\$\{block\.startLabel \? ` · \$\{block\.startLabel\}/);
  assert.match(grid, /title=\{hoverTitle\}/);
  assert.match(grid, /aria-label=\{hoverTitle\}/);
  assert.match(grid, /tabIndex=\{0\}/);
  assert.match(grid, /<div className="text-\[11px\] font-semibold leading-tight truncate">\{block\.label\}<\/div>/, 'the label line truncates, it never empties');
  // Lane geometry only: left and width from the lane, nothing else about the block moves.
  assert.match(grid, /left: `calc\(\$\{\(lane \/ laneCount\) \* 100\}% \+ 2px\)`, width: `calc\(\$\{100 \/ laneCount\}% - 4px\)`/);
  assert.match(grid, /data-block-lane=\{lane\}/);
  assert.match(grid, /data-block-lanes=\{laneCount\}/);
  assert.match(grid, /data-day-column=\{dayKey\}/);
});

test('FORBIDDEN held: no mapper, no table, no day view changed; no default end written anywhere', () => {
  // The mappers still emit the row's own end, or nothing.
  assert.match(code('src/lib/hub/mapOperationsRoutines.ts'), /endTime: endTime \?\? undefined,/);
  assert.match(code('src/components/hub/HubCalendar.tsx'), /endTime: toClock\(e\.end_time\),/);
  assert.match(code('src/lib/hub/mapOperationsBlocks.ts'), /endTime: end\.time,/);
  // The day view and the panel print the start alone when there is no end (DAY-01) — no derived end.
  assert.match(code('src/components/hub/DayView.tsx'), /\$\{clock\(r\.startTime\)\}\$\{r\.endTime \? ` – \$\{clock\(r\.endTime\)\}` : ''\}/);
  assert.match(code('src/components/hub/EventDetailPanel.tsx'), /\$\{clock\(row\.startTime\)\}\$\{row\.endTime \? ` – \$\{clock\(row\.endTime\)\}` : ''\}/);
  assert.match(code('src/lib/calendar/day.ts'), /endTime: minutesOf\(endRaw\) === null \? null : \(endRaw as string\)\.slice\(0, 5\),/);
  for (const f of ['src/components/hub/DayView.tsx', 'src/components/hub/EventDetailPanel.tsx', 'src/lib/calendar/day.ts', 'src/lib/hub/mapOperationsRoutines.ts', 'src/lib/hub/mapOperationsBlocks.ts', 'src/components/hub/HubCalendar.tsx']) {
    assert.doesNotMatch(code(f), /MARKER_MINUTES|blockExtent|\+ 120\b|\+ 60\b/, `${f} decides no extent`);
  }
  // A start without an end is still a legal row — the writers default nothing.
  assert.match(code('src/lib/calendar/manualEvent.ts'), /if \(endTime !== null && startTime === null\) return/);
  assert.doesNotMatch(code('src/lib/calendar/manualEvent.ts'), /endTime \?\? '|end_time: startTime/);
  assert.doesNotMatch(code('src/app/api/operations/routines/route.ts'), /end_time: startTime|end_time: .*\?\? .*start/);
  // MARKER_MINUTES lives in the leaf alone.
  assert.match(code(LEAF), /export const MARKER_MINUTES = 30;/);
  assert.match(comments(LEAF), /THE ONE PLACE A BLOCK'S EXTENT IS DECIDED, AND IT NEVER INVENTS ONE/);
});
