import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY, registryLaw } from '../toolRegistry';
import { claimLine } from '../offer';
import { code } from '../sourceText';

// TRUTH-CAL — tool 01's row says what /calendar is after PLAN-01, and every
// file:line it prints resolves to the line it names.

const lineOf = (f: string, n: number) => code(f).split('\n')[n - 1] ?? '';
const CAL = TOOL_REGISTRY.find((t) => t.name === 'Calendar')!;
const ROW = `${CAL.why ?? ''} ${CAL.citation} ${CAL.note ?? ''}`;

test('the beats are what the page renders — discover, commit, record; no decide', () => {
  assert.deepEqual(CAL.beats, { discover: true, decide: false, commit: true, record: true });
  assert.equal(CAL.status, 'PARTIAL', 'the census does not move');

  // discover — three GETs in the grid, and the grid itself writes nothing.
  const grid = code('src/components/hub/HubCalendar.tsx');
  for (const feed of ['/api/calendar?', '/api/operations/daily-plan/items', '/api/hub/operations-routines']) {
    assert.ok(grid.includes(feed), `the grid reads ${feed}`);
  }

  // commit — the form reaches this tool's OWN row through its own route.
  assert.match(code('src/components/hub/AddEventForm.tsx'), /fetch\('\/api\/calendar\/events'/);
  const route = code('src/app/api/calendar/events/route.ts');
  for (const verb of ['POST', 'PATCH', 'DELETE']) {
    assert.match(route, new RegExp(`export async function ${verb}\\b`), `the events route answers ${verb}`);
  }
  assert.match(route, /INSERT INTO calendar_events/);

  // record — written, read back, badged.
  assert.match(grid, /isRenderedCalendarSource\(e\.source\)/);
  assert.match(code('src/lib/calendar/sources.ts'), /source: 'manual'/);
  assert.match(code('src/components/hub/DayView.tsx'), /MANUAL_EVENT_BADGE/);

  // decide — a draft event would have to be PERSISTED. Nothing writes one.
  for (const f of ['src/components/hub/AddEventForm.tsx', 'src/app/api/calendar/events/route.ts', 'src/lib/calendar/manualEvent.ts']) {
    assert.doesNotMatch(code(f), /\bdraft\b/i, `${f} persists no draft event — decide stays unclaimed`);
  }
});

test('no registry string names a surface the tool no longer has', () => {
  // PLAN-01 moved the routine builder to /tasks. The row may not name it, nor
  // any of the routes that were its citation.
  for (const dead of [
    /routine builder/i,
    /api\/operations\/routines/,
    /routines\/\[id\]/,
    /completions/,
  ]) assert.doesNotMatch(ROW, dead, `the Calendar row still names a surface it lost: ${dead}`);

  // DAY-01 deleted the bare source filter; the note may only mention it as history.
  assert.doesNotMatch(CAL.note ?? '', /The grid shows only calendar_events with source "trip"/);
  assert.match(CAL.note ?? '', /src\/lib\/calendar\/sources\.ts/, 'the note points at the allowlist that replaced it');

  // The `why` is customer copy — the citation law forbids a path in a rendered line.
  assert.doesNotMatch(CAL.why ?? '', /\.tsx?:|src\//);

  // And the cockpit section points at the tool that owns routines.
  assert.equal(COCKPIT_PRIMARY_TOOL.routines, 'Tasks');
  assert.equal(COCKPIT_PRIMARY_TOOL.projects, 'Tasks', 'its sibling is unchanged');
});

test('every file:line the row prints resolves to the line it names', () => {
  // The table is the claim; the assertion is that the file really says so.
  const CITED: ReadonlyArray<readonly [string, number, string]> = [
    ['src/components/hub/HubCalendar.tsx', 166, '/api/calendar?'],
    ['src/components/hub/HubCalendar.tsx', 173, 'isRenderedCalendarSource'],
    ['src/components/hub/HubCalendar.tsx', 182, '/api/operations/daily-plan/items'],
    ['src/components/hub/HubCalendar.tsx', 194, '/api/hub/operations-routines'],
    ['src/components/hub/HubCalendar.tsx', 330, 'onAdded'],
    ['src/components/hub/AddEventForm.tsx', 247, "editEvent ? 'PATCH' : 'POST'"],
    ['src/app/api/calendar/events/route.ts', 75, 'export async function POST'],
    ['src/app/api/calendar/events/route.ts', 105, 'export async function PATCH'],
    ['src/app/api/calendar/events/route.ts', 146, 'export async function DELETE'],
    ['src/components/hub/DayView.tsx', 221, 'MANUAL_EVENT_BADGE'],
    ['src/lib/calendar/sources.ts', 76, 'export const CALENDAR_SOURCES'],
    ['src/lib/calendar/sources.ts', 78, "source: 'manual'"],
    ['src/lib/calendar/sources.ts', 149, '] as const;'],
    ['src/lib/calendar/sources.ts', 162, 'export const EXCLUDED_CALENDAR_SOURCES'],
    ['src/lib/calendar/sources.ts', 171, '] as const;'],
  ];
  for (const [file, n, token] of CITED) {
    assert.ok(existsSync(`${process.cwd()}/${file}`), `${file} exists`);
    assert.ok(lineOf(file, n).includes(token), `${file}:${n} should carry "${token}" — it reads: ${lineOf(file, n).trim()}`);
  }

  // Both directions: every pair the row prints is in the table above, so a new
  // uncited line number cannot slip in unchecked. A bare ":N" continues the
  // file named before it, which is the citation's own convention.
  // A range "file:76-149" is two pairs: both ends must resolve, not just the first.
  const pairs: string[] = [];
  let current = '';
  for (const m of ROW.matchAll(/([\w/.[\]@-]+\.tsx?):(\d+)(?:-(\d+))?|(?:^|[\s·])(?::(\d+)(?:-(\d+))?)/g)) {
    if (m[1]) current = m[1];
    const ends = [m[2] ?? m[4], m[3] ?? m[5]].filter(Boolean) as string[];
    assert.ok(current, `a bare :${ends[0]} with no file named before it`);
    for (const n of ends) pairs.push(`${current}:${n}`);
  }
  const table = new Set(CITED.map(([f, n]) => `${f}:${n}`));
  for (const p of pairs) assert.ok(table.has(p), `${p} is printed by the Calendar row but is not checked above`);
  assert.ok(pairs.length >= 10, `the row prints ${pairs.length} file:line pairs — the citation lost its evidence`);
});

test('the row still satisfies the registry law, and its claim line follows the beats', () => {
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  // TRUTH-01b: fewer than four beats keeps the beats form, so the claim line is
  // the beats — the `why` is what the rail and the sheet print (nav.ts).
  assert.equal(claimLine(CAL), 'partial — discover · commit · record');
});
