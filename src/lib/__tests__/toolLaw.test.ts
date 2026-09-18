import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PIPE_PHASES } from '../pipePhases';
import { THE_SORT, navRows, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { code, comments } from '../sourceText';

// TOOL-LAW-01 — one tool, one page, its own pipe.


test('THE WORK is three tools on three pages — the room is gone', () => {
  assert.equal(navToolByName('Calendar', TOOL_GATE).href, '/calendar');
  assert.equal(navToolByName('Tasks', TOOL_GATE).href, '/tasks');
  assert.equal(navToolByName('Time', TOOL_GATE).href, '/time');
  // No two of them share a page.
  const hrefs = ['Calendar', 'Tasks', 'Time'].map((n) => navToolByName(n, TOOL_GATE).href);
  assert.equal(new Set(hrefs).size, 3);
  for (const gone of ['src/lib/operationsPhases.ts', 'src/app/operations/OperationsRoom.tsx', 'src/app/operations/page.tsx']) {
    assert.ok(!existsSync(`${process.cwd()}/${gone}`), `${gone} is deleted`);
  }
  // And the opener line I wrote for the room went with it.
  for (const f of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx', 'src/app/calendar/page.tsx']) {
    assert.ok(!code(f).includes('One day, top down'), `${f} carries no room prose`);
  }
});

test('each page renders its own pipe, in the pipe\'s own order', () => {
  // Tasks → projects (per project row, behind pipelineMode — recorded, not smoothed over).
  assert.match(code('src/components/workbench/operations/projects/TruthMachineView.tsx'), /PIPE_PHASES\.projects/);
  // TEST-TRUTH-01: "per-project strip" is the DESCRIPTION beside that strip, not
  // code. The behaviour is the line above (PIPE_PHASES.projects); this is the
  // documented shape, read as prose.
  assert.match(comments('src/components/workbench/operations/projects/TruthMachineView.tsx'), /per-project strip/);
  assert.match(code('src/components/workbench/operations/projects/ProjectRow.tsx'), /pipelineMode/);
  // Time → content, a PAGE-LEVEL strip inside ContentPipeline.
  assert.match(code('src/components/workbench/operations/content/ContentPipeline.tsx'), /PIPE_PHASES\.content/);
  // PLAN-01: Tasks → routines too, the same page-level strip inside SectionE_Routines.
  assert.match(code('src/components/workbench/operations/SectionE_Routines.tsx'), /PIPE_PHASES\.routines/);
  // The order is the pipe's, never retyped.
  assert.deepEqual(PIPE_PHASES.projects.map((p) => p.num), ['01', '02', '03', '04', '05', '06']);
  assert.deepEqual(PIPE_PHASES.content.map((p) => p.num), ['01', '02', '03', '04']);
  assert.deepEqual(PIPE_PHASES.routines.map((p) => p.num), ['01', '02', '03', '04']);
});

test('the phases each page renders belong to that page\'s tool', () => {
  const owners = (pipe: string) => [...new Set(THE_SORT.filter((a) => a.pipe === pipe).map((a) => a.owner))];
  assert.deepEqual(owners('projects'), ['Tasks']);
  assert.deepEqual(owners('content'), ['Time']);
  // PLAN-01: Tasks owns BOTH planning pipes now.
  assert.deepEqual(owners('routines'), ['Tasks']);
});

test('every redirect resolves to the tool that owns the work', () => {
  const want: Record<string, string> = {
    'src/app/projects/page.tsx': '/tasks',
    'src/app/routines/page.tsx': '/tasks',
    'src/app/content/page.tsx': '/time',
    'src/app/operations/projects/page.tsx': '/tasks',
    'src/app/operations/routines/page.tsx': '/tasks',
    'src/app/operations/content/page.tsx': '/time',
  };
  for (const [f, target] of Object.entries(want)) {
    const body = code(f);
    assert.ok(body.split('\n').filter((l) => l.trim()).length <= 10, `${f} is a redirect, not a page`);
    assert.ok(body.includes(`redirect('${target}')`), `${f} → ${target}`);
  }
});

test('/tasks and /time each render exactly one opener, /calendar none, and only /calendar holds the merged grid', () => {
  for (const f of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx']) {
    assert.equal((code(f).match(/<ToolOpener/g) ?? []).length, 1, `${f} has one opener`);
  }
  // CAL-OPEN-01: the calendar explains nothing — no opener above the grid. The
  // enforced opener law never required one (calOpen01.test.ts pins that).
  assert.equal((code('src/app/calendar/page.tsx').match(/<ToolOpener/g) ?? []).length, 0, 'the calendar has no opener');
  // The merged grid: HubCalendar, on /calendar and nowhere else among the three.
  assert.match(code('src/app/calendar/page.tsx'), /<HubCalendar \/>/);
  for (const f of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx']) {
    assert.ok(!code(f).includes('HubCalendar'), `${f} does not mount the merged grid`);
  }
  // PLAN-01: the routine builder moved to Tasks. The calendar authors NOTHING
  // now — no routine surface, no strip — and Tasks holds it instead.
  assert.equal(code('src/app/calendar/page.tsx').includes('SectionE_Routines'), false);
  assert.match(code('src/app/tasks/page.tsx'), /<SectionE_Routines \/>/);
  // EVENT-01's form STAYS on the calendar: it writes a calendar_event, this
  // tool's OWN row, not another tool's object.
  assert.match(code('src/app/calendar/page.tsx'), /<HubCalendar \/>/);
  assert.match(code('src/components/hub/HubCalendar.tsx'), /<AddEventForm/);
});

test('the grandfather lists are closed, dated and shrink-only — and CLAUDE.md says so', () => {
  const assertSrc = code('scripts/assert-tool-registry.ts');
  assert.match(assertSrc, /MULTI_TOOL_ALLOWED/);
  assert.match(assertSrc, /FOREIGN_PHASE_ALLOWED/);
  assert.match(assertSrc, /THE ALLOWLIST MAY ONLY SHRINK/);
  // TRADE-SPLIT: the multi-tool list is EMPTY; the foreign-phase list keeps its one dated entry.
  assert.equal((assertSrc.match(/since: '2026-09-10 \(NAV-25\)'/g) ?? []).length, 1);
  assert.match(code('CLAUDE.md'), /The allowlist may only shrink/);
  assert.match(code('CLAUDE.md'), /One tool, one page \(TOOL-LAW-01\)/);
  // TRADE-SPLIT: NO page serves two tools — /trading was the last and it split
  // into /brokerage (trade 01-03) and /trade-log (04-06).
  const byHref = new Map<string, string[]>();
  for (const t of navRows(TOOL_GATE)) if (t.href) byHref.set(t.href, [...(byHref.get(t.href) ?? []), t.name]);
  const multi = [...byHref.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  assert.deepEqual(multi, []);
});
