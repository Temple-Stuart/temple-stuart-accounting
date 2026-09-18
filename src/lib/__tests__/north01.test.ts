import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { navLaw, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { toNorthStarContext, formatNorthStarBlock } from '../ai/northStarContext';
import { code, comments } from '../sourceText';

// NORTH-01 — the North Star lives under Tasks, beside Issue log and Audit trail.
// TASKS-01 (2026-09-18): "Audit tail" → "Audit trail" on the registry link, and
// the section header lost its letter (B · NORTH STAR → NORTH STAR) — the letters
// were the deleted room's; the component is otherwise untouched.

const PAGE = 'src/app/operations/north-star/page.tsx';
const TASKS = 'src/app/tasks/page.tsx';
const COCKPIT = 'src/components/home/ModuleLauncher.tsx';
const SECTION = 'src/components/workbench/operations/SectionB_NorthStar.tsx';

test('the registry row names all three, and each is a rail sub-row of Tasks', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual((tasks.links ?? []).map((l) => [l.label, l.href]), [
    ['North Star', '/operations/north-star'],
    ['Issue log', '/operations/issues'],
    ['Audit trail', '/operations/audit-log'],
  ]);
  const rail = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(rail.subRows.map((r) => r.label), ['North Star', 'Issue log', 'Audit trail']);
  assert.deepEqual(rail.subRows.map((r) => r.door.href), ['/operations/north-star', '/operations/issues', '/operations/audit-log']);
  // The door is nobody's screen (navLaw rule 7), and the law is clean.
  assert.deepEqual(navLaw({ throwOnFail: false }), []);
  assert.equal(TOOL_REGISTRY.some((t) => t.home === '/operations/north-star'), false);
});

test('North Star renders under Tasks by the SAME idiom as Audit trail — one page, one component, nothing else', () => {
  assert.ok(existsSync(`${process.cwd()}/${PAGE}`));
  const page = code(PAGE);
  assert.match(page, /<SectionB_NorthStar \/>/);
  // The idiom, byte for byte: the sibling mounts one component and returns it.
  const sibling = code('src/app/operations/audit-log/page.tsx');
  assert.match(sibling, /return <SectionK_AuditTail \/>;/);
  assert.match(page, /return <SectionB_NorthStar \/>;/);
  // Under the operations layout, which supplies the entity provider the section reads.
  assert.match(code('src/app/operations/layout.tsx'), /<OperationsEntityProvider>/);
  assert.match(code(SECTION), /useOperationsEntity|OperationsEntityContext|fetch\('\/api\/operations\/north-star'\)/);
});

test('its edit and review actions are intact — the component is not rewritten', () => {
  const s = code(SECTION);
  assert.match(s, /fetch\('\/api\/operations\/north-star'\)/, 'reads the table through its route');
  assert.match(s, /fetch\('\/api\/operations\/north-star\/review', \{ method: 'POST' \}\)/, 'the "I reviewed — still holds" attestation');
  assert.match(s, /I reviewed — still holds/);
  assert.match(s, /review overdue by/, 'the overdue banner');
  assert.match(s, /daysUntil\(northStar\.next_review_at\)/, 'the cadence computes from the row');
  // TASKS-01: the header lost its letter and nothing else — the one line this
  // pin moved for.
  assert.match(s, />\s*NORTH STAR\s*</, "the header is the component's own, without the deleted room's letter");
  assert.doesNotMatch(s, /B · NORTH STAR/);
});

test('the cockpit does not render it — and never did', () => {
  assert.doesNotMatch(code(COCKPIT), /NorthStar|north-star|NORTH STAR/);
  assert.doesNotMatch(comments(COCKPIT), /NORTH STAR/);
  // The inline mount on /tasks is gone; the page names where it went.
  const tasks = code(TASKS);
  assert.doesNotMatch(tasks, /SectionB_NorthStar/);
  assert.match(comments(TASKS), /operations\/north-star/);
  // The section is mounted in exactly ONE place in the app.
  assert.equal([PAGE].length, 1);
});

test("northStarContext reads the TABLE, not the component — its output is the same shape before and after", () => {
  // The mapper takes a row and returns the injected context. No component, no route.
  const row = {
    mission_statement: 'Build the machine', life_stage: 'builder', core_values: ['truth'],
    guiding_principles: ['one concept per PR'], one_year_target: 'ship', three_year_target: 'scale',
    current_location_label: 'Bangkok', current_timezone: 'Asia/Bangkok',
  };
  const ctx = toNorthStarContext(row as never);
  assert.ok(ctx, 'a row maps to a context');
  const block = formatNorthStarBlock(ctx);
  assert.match(block, /Build the machine/);
  assert.equal(toNorthStarContext(null), null, 'no row, no context — never a placeholder');
  const src = code('src/lib/ai/northStarContext.ts');
  assert.doesNotMatch(src, /SectionB_NorthStar|components\//, 'it never imports the component');
  assert.doesNotMatch(src, /fetch\(/, 'it never calls a route — the callers hand it the row');
});

test('every AI reader still takes the row from the table', () => {
  for (const f of [
    'src/app/api/operations/ai/generate-tasks/route.ts',
    'src/app/api/operations/ai/generate-design/route.ts',
    'src/app/api/operations/projects/[id]/research/route.ts',
    'src/app/api/operations/projects/[id]/generate-tasks/route.ts',
    'src/app/api/operations/projects/[id]/prompts/route.ts',
    'src/app/api/operations/projects/[id]/generate-design/route.ts',
  ]) {
    const s = code(f);
    assert.match(s, /toNorthStarContext/, `${f} injects the context`);
    assert.match(s, /operations_north_star/, `${f} reads the table`);
    assert.doesNotMatch(s, /SectionB_NorthStar/, `${f} never touches the component`);
  }
});
