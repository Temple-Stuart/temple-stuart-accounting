import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { THE_SORT, PHASES_RENDERED_AT, navRows, navToolByName, phasesRenderedOn } from '../nav';
import { TOOL_GATE } from '../offer';
import { PIPE_PHASES, PIPE_LABEL } from '../pipePhases';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { code, comments } from '../sourceText';

/**
 * PLAN-01 — TASKS IS THE PLANNING TAB. Source reads strip comment lines first,
 * so a citation in a comment can never satisfy an assertion about the code.
 */

const TASKS = 'src/app/tasks/page.tsx';
const CALENDAR = 'src/app/calendar/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

// ───────────────────────────────────────────────────────────────────────────
test('THE SORT is the one place pipe ownership is declared, and it gives Tasks both', () => {
  const owners = (pipe: string) => [...new Set(THE_SORT.filter((a) => a.pipe === pipe).map((a) => a.owner))];
  assert.deepEqual(owners('routines'), ['Tasks']);
  assert.deepEqual(owners('projects'), ['Tasks']);
  assert.deepEqual(owners('content'), ['Time']);
  // Calendar owns no pipe now — it is the view, not an author.
  assert.deepEqual(THE_SORT.filter((a) => a.owner === 'Calendar'), []);

  // The registry DERIVES from it; there is no second ownership list.
  const tasks = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(tasks.phases.map((p) => `${p.pipe} ${p.num}`), [
    'routines 01', 'routines 02', 'routines 03', 'routines 04',
    'projects 01', 'projects 02', 'projects 03', 'projects 04', 'projects 05', 'projects 06',
  ]);
  assert.deepEqual(navToolByName('Calendar', TOOL_GATE).phases, []);
  // nav.ts:201 is the derivation — the registry carries no `pipes` field of its own.
  assert.match(code('src/lib/nav.ts'), /phases: phasesOf\(tool\.name, sort\)/);
  assert.equal(/pipes:\s*\[/.test(code('src/lib/toolRegistry.ts')), false, 'a second ownership list would be two truths');
});

test('/tasks draws BOTH strips, each labelled with its pipe', () => {
  const page = code(TASKS);
  assert.match(page, /<SectionD_ProjectBacklog \/>/);
  assert.match(page, /<SectionE_Routines \/>/);
  // Each labelled, and from the pipe's own name — never typed twice.
  assert.match(page, /data-pipe-label="projects"/);
  assert.match(page, /data-pipe-label="routines"/);
  assert.match(page, /\{PIPE_LABEL\.projects\}/);
  assert.match(page, /\{PIPE_LABEL\.routines\}/);
  assert.equal(PIPE_LABEL.routines, 'Routines');
  assert.equal(PIPE_LABEL.projects, 'Projects');
  // The declaration matches, in the order the page renders them.
  assert.deepEqual(PHASES_RENDERED_AT['/tasks'], ['projects', 'routines']);
  // Both pipes' phases are listed for the opener, each whole and in pipe order.
  for (const pipe of ['projects', 'routines'] as const) {
    const listed = phasesRenderedOn('/tasks', navToolByName('Tasks', TOOL_GATE)).filter((p) => p.pipe === pipe);
    assert.deepEqual(listed.map((p) => p.num), PIPE_PHASES[pipe].map((p) => p.num));
  }
});

test('/calendar authors nothing — no routines strip, no routine surface', () => {
  const page = code(CALENDAR);
  assert.equal(page.includes('SectionE_Routines'), false);
  assert.equal(page.includes('OperationsEntityProvider'), false, 'the provider left with its only consumer');
  assert.deepEqual(PHASES_RENDERED_AT['/calendar'], []);
  // The opener says what the page now is, and claims nothing it does not meet.
  assert.match(page, /line="The day as it actually is/);
  assert.match(page, /routines and projects are planned in Tasks/);
  // The grid and the day view stay — that is the whole tool.
  assert.match(page, /<HubCalendar \/>/);
});

test("EVENT-01's form stays on the calendar, because a calendar_event is the calendar's own row", () => {
  // It is mounted inside HubCalendar, which /calendar renders — the one thing
  // this tool writes, and it writes THIS tool's object, not another tool's.
  assert.match(code('src/components/hub/HubCalendar.tsx'), /<AddEventForm/);
  assert.ok(existsSync(`${process.cwd()}/src/app/api/calendar/events/route.ts`));
  // And the reason is recorded where the next reader will look. TEST-TRUTH-01:
  // that reason is PROSE — the page's header comment — and this now says so.
  // The behaviour it explains is asserted from code, two lines above.
  assert.match(comments(CALENDAR), /writes a calendar_event, which is THIS tool's own row/);
});

test('a routine authored on /tasks still appears as occurrences on the calendar — the mapper is untouched', () => {
  // The mapper is the calendar's read of a routine. PLAN-01 changed no line of
  // it; this proves the behaviour the move depends on.
  const emitted = mapOperationsRoutines({
    routines: [{
      routine_id: 'r1', name: 'Gym', entity_id: 'e1', timezone: 'Asia/Bangkok',
      start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T09:00:00.000Z',
      occurrences: ['2026-08-14T00:00:00.000Z', '2026-08-15T00:00:00.000Z'],
      coa_code: '8210', budget_amount: 100,
    }],
    truncated: false,
  });
  assert.equal(emitted.length, 2, 'one tile per occurrence');
  assert.deepEqual(emitted.map((e) => e.startDate), ['2026-08-14', '2026-08-15']);
  assert.equal(emitted[0].source, 'routines');
  assert.equal(emitted[0].startTime, '07:00');
  assert.equal(emitted[0].endTime, '09:00');
  // The per-occurrence budget rides along — ROUTINE-01's Routines part of the
  // day total is fed from exactly this.
  assert.equal(emitted[0].budgetAmount, 100);
  assert.equal(emitted[0].coaCode, '8210');
  // The occurrence tile still opens the calendar: an occurrence lives here even
  // though the routine is authored in Tasks (ORPHAN-01's href, unchanged).
  assert.equal(emitted[0].href, '/calendar');
});

test('the amendment is written down: what it permits, and what it still forbids', () => {
  // TEST-TRUTH-01: the amendment's WORDING is a dated comment, so it is read as
  // one. Every line below that asserts what the law SAYS reads comments(); every
  // line that asserts what the law DOES reads code(). Splitting them is the whole
  // point — before, one raw read could not tell you which kind of claim it was.
  const wording = comments(LAW);
  assert.match(wording, /TOOL-LAW-01 · AMENDMENT \(PLAN-01, 2026-09-17\)/);
  assert.match(wording, /WHAT IT PERMITS/);
  assert.match(wording, /WHAT IT STILL FORBIDS/);
  // The three things it still refuses, named.
  assert.match(wording, /a FOREIGN pipe/);
  assert.match(wording, /a page serving two TOOLS/);
  assert.match(wording, /UNLABELLED multi-pipe/);
  // And the STEP 0.1 answer recorded: no rule requires a page to draw a pipe.
  assert.match(wording, /No\s*\n\/\/ rule REQUIRES a tool's page to draw a pipe/);
  // The amendment is ENFORCED, not just described — this half is code.
  assert.match(code(LAW), /a page may draw a second pipe only when its tool owns it/);
  assert.match(code(LAW), /data-pipe-label="\$\{pipe\}"/);
});

test('every legacy routines URL resolves to the tool that owns the work', () => {
  for (const f of ['src/app/routines/page.tsx', 'src/app/operations/routines/page.tsx']) {
    assert.match(code(f), /redirect\('\/tasks'\)/, `${f} must send a routines-seeker to Tasks`);
  }
  // /projects and /content are unchanged — their owners did not move.
  assert.match(code('src/app/projects/page.tsx'), /redirect\('\/tasks'\)/);
  assert.match(code('src/app/content/page.tsx'), /redirect\('\/time'\)/);
  assert.match(code('src/app/operations/projects/page.tsx'), /redirect\('\/tasks'\)/);
  assert.match(code('src/app/operations/content/page.tsx'), /redirect\('\/time'\)/);
});

test('no tool row moved and the 25-row order is untouched', () => {
  const rows = navRows(TOOL_GATE);
  assert.equal(rows.length, 25);
  assert.equal(rows[0].name, 'Calendar');
  assert.equal(rows[1].name, 'Tasks');
  assert.equal(rows[2].name, 'Time');
  // Calendar keeps its home and its status; only what it OWNS changed.
  const cal = navToolByName('Calendar', TOOL_GATE);
  assert.equal(cal.href, '/calendar');
  assert.equal(cal.status, 'PARTIAL');
  assert.equal(navToolByName('Tasks', TOOL_GATE).status, 'PARTIAL');
});
