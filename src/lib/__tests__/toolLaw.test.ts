import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PIPE_PHASES } from '../pipePhases';
import { THE_SORT, navRows, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';

// TOOL-LAW-01 — one tool, one page, its own pipe.

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

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
    assert.ok(!src(f).includes('One day, top down'), `${f} carries no room prose`);
  }
});

test('each page renders its own pipe, in the pipe\'s own order', () => {
  // Tasks → projects (per project row, behind pipelineMode — recorded, not smoothed over).
  assert.match(code('src/components/workbench/operations/projects/TruthMachineView.tsx'), /PIPE_PHASES\.projects/);
  assert.match(src('src/components/workbench/operations/projects/TruthMachineView.tsx'), /per-project strip/);
  assert.match(src('src/components/workbench/operations/projects/ProjectRow.tsx'), /pipelineMode/);
  // Time → content, a PAGE-LEVEL strip inside ContentPipeline.
  assert.match(code('src/components/workbench/operations/content/ContentPipeline.tsx'), /PIPE_PHASES\.content/);
  // Calendar → routines, a page-level strip inside SectionE_Routines.
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
  assert.deepEqual(owners('routines'), ['Calendar']);
});

test('every redirect resolves to the tool that owns the work', () => {
  const want: Record<string, string> = {
    'src/app/projects/page.tsx': '/tasks',
    'src/app/routines/page.tsx': '/calendar',
    'src/app/content/page.tsx': '/time',
    'src/app/operations/projects/page.tsx': '/tasks',
    'src/app/operations/routines/page.tsx': '/calendar',
    'src/app/operations/content/page.tsx': '/time',
  };
  for (const [f, target] of Object.entries(want)) {
    const body = src(f);
    assert.ok(body.split('\n').filter((l) => l.trim()).length <= 10, `${f} is a redirect, not a page`);
    assert.ok(body.includes(`redirect('${target}')`), `${f} → ${target}`);
  }
});

test('/tasks and /time each render exactly one opener, and only /calendar holds the merged grid', () => {
  for (const f of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx', 'src/app/calendar/page.tsx']) {
    assert.equal((code(f).match(/<ToolOpener/g) ?? []).length, 1, `${f} has one opener`);
  }
  // The merged grid: HubCalendar, on /calendar and nowhere else among the three.
  assert.match(code('src/app/calendar/page.tsx'), /<HubCalendar \/>/);
  for (const f of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx']) {
    assert.ok(!code(f).includes('HubCalendar'), `${f} does not mount the merged grid`);
  }
  // Calendar's own writing surface came with it.
  assert.match(code('src/app/calendar/page.tsx'), /<SectionE_Routines \/>/);
});

test('the grandfather lists are closed, dated and shrink-only — and CLAUDE.md says so', () => {
  const assertSrc = src('scripts/assert-tool-registry.ts');
  assert.match(assertSrc, /MULTI_TOOL_ALLOWED/);
  assert.match(assertSrc, /FOREIGN_PHASE_ALLOWED/);
  assert.match(assertSrc, /THE ALLOWLIST MAY ONLY SHRINK/);
  // One entry each, both dated.
  assert.equal((assertSrc.match(/since: '2026-09-10 \(NAV-25\)'/g) ?? []).length, 2);
  assert.match(src('CLAUDE.md'), /The allowlist may only shrink/);
  assert.match(src('CLAUDE.md'), /One tool, one page \(TOOL-LAW-01\)/);
  // Only /trading is a multi-tool page now.
  const byHref = new Map<string, string[]>();
  for (const t of navRows(TOOL_GATE)) if (t.href) byHref.set(t.href, [...(byHref.get(t.href) ?? []), t.name]);
  const multi = [...byHref.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  assert.deepEqual(multi, ['/trading']);
});
