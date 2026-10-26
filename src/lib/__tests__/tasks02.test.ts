/**
 * TASKS-02 (Alex, 2026-10-20) — Tasks with no sub-rows.
 *
 * The ruling TASKS-ONE-01 waited for ("North Star and Audit trail stay until
 * the next ruling"). The North Star's page is DELETED — its page, its section,
 * its three routes (the paid optimizer among them), the optimizer's generator
 * and the section's types — while its TABLE and its AI READERS stay: a row
 * that exists still feeds the six generators, and a null row still returns
 * the 'none' shape. The audit trail is COMPLIANCE's — it is the log of what
 * was done, and the Compliance row links it now. The orphan law's exception
 * list is empty with its maximum at 0.
 *
 * This file replaces north01.test.ts, whose every test was about the North
 * Star's page, section and link: the presence pins became absence pins; the
 * pins on northStarContext and the six readers moved here unchanged in what
 * they hold.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { navLaw, navRows, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { formatNorthStarBlock, toNorthStarContext } from '../ai/northStarContext';
import { code, comments } from '../sourceText';

const THIS = 'src/lib/__tests__/tasks02.test.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const at = (f: string): string => join(process.cwd(), f);

/** The seven files the ruling deleted, and the test file it replaced. */
const DELETED = [
  'src/app/operations/north-star/page.tsx',
  'src/components/workbench/operations/SectionB_NorthStar.tsx',
  'src/app/api/operations/north-star/route.ts',
  'src/app/api/operations/north-star/review/route.ts',
  'src/app/api/operations/ai/optimize-north-star-section/route.ts',
  'src/lib/ai/generateNorthStarSectionOptimization.ts',
  'src/components/workbench/operations/types.ts',
  'src/lib/__tests__/north01.test.ts',
] as const;

/** What stays: the table's mapper and its six readers, the pipe runner, the place search, the tail. */
const READERS = [
  'src/app/api/operations/ai/generate-tasks/route.ts',
  'src/app/api/operations/ai/generate-design/route.ts',
  'src/app/api/operations/projects/[id]/research/route.ts',
  'src/app/api/operations/projects/[id]/generate-tasks/route.ts',
  'src/app/api/operations/projects/[id]/prompts/route.ts',
  'src/app/api/operations/projects/[id]/generate-design/route.ts',
] as const;

function tsFiles(dir: string): string[] {
  return readdirSync(at(dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(at(rel)).isDirectory()) return tsFiles(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

// ── R1 · THE NORTH STAR GOES — CODE ONLY ────────────────────────────────────

test('R1 the seven files are deleted, and nothing under src or scripts imports or fetches them', () => {
  for (const f of DELETED) assert.equal(existsSync(at(f)), false, `${f} is deleted`);
  // The directories went with their only files.
  assert.equal(existsSync(at('src/app/operations/north-star')), false);
  assert.equal(existsSync(at('src/app/api/operations/north-star')), false);
  assert.equal(existsSync(at('src/app/api/operations/ai/optimize-north-star-section')), false);
  // No importer, no fetch, no link: the CODE halves of every source file hold no import of the deleted modules,
  // no call to the deleted routes and no href to the deleted page. (A test's absence pin may NAME a path —
  // tasks01.test.ts holds SectionB's — so the scan is of the forms that would USE one, not of the words.)
  const uses = /from '[^']*(SectionB_NorthStar|generateNorthStarSectionOptimization)'|['"`]\/api\/operations\/(north-star|ai\/optimize-north-star-section)|href: '\/operations\/north-star'|\b(OptimizableSection|OptimizeSectionRequest|OptimizeSectionResponse|DEFAULT_NORTH_STAR_FORM)\b/;
  for (const f of [...tsFiles('src'), ...tsFiles('scripts')].filter((f) => f !== THIS)) {
    assert.doesNotMatch(code(f), uses, `${f} uses a deleted file`);
  }
  // The deleted types module was `./types` to its one importer; no file left in that folder imports a `./types`.
  for (const f of readdirSync(at('src/components/workbench/operations')).filter((n) => /\.(ts|tsx)$/.test(n))) {
    assert.doesNotMatch(code(`src/components/workbench/operations/${f}`), /from '\.\/types'/, `${f} imports the deleted types`);
  }
});

test('R1 the table and its mapper stay: a null row is the none shape — null context, empty block, never a placeholder', () => {
  assert.equal(toNorthStarContext(null), null, 'no row, no context');
  assert.equal(formatNorthStarBlock(null), '', 'no context, no block — the userMessage is unchanged');
  // An all-empty row is the same none shape (the mapper, not the caller, decides).
  const empty = { mission_statement: '', one_year_target: null, three_year_target: '  ', guiding_principles: null, core_values: [], life_stage: null };
  assert.equal(toNorthStarContext(empty), null);
  assert.equal(formatNorthStarBlock(toNorthStarContext(empty)), '');
  // A row that exists still maps — the readers lost nothing with the page.
  const row = { mission_statement: 'Build the machine', one_year_target: 'ship', three_year_target: 'scale', guiding_principles: 'one concept per PR', core_values: ['truth'], life_stage: 'builder' };
  const ctx = toNorthStarContext(row);
  assert.ok(ctx);
  assert.match(formatNorthStarBlock(ctx), /MISSION: Build the machine/);
  const src = code('src/lib/ai/northStarContext.ts');
  assert.doesNotMatch(src, /components\/|fetch\(/, 'it never imports a component or calls a route — the callers hand it the row');
  assert.match(code('prisma/schema.prisma'), /model operations_north_star \{/, 'the table is not dropped');
});

test('R1 the six readers, the pipe runner and the place search still read the TABLE — untouched by the deletion', () => {
  for (const f of [...READERS, 'src/inngest/functions/operations-pipe-run.ts']) {
    const s = code(f);
    assert.match(s, /toNorthStarContext/, `${f} injects the context`);
    assert.match(s, /prisma\.operations_north_star\.findUnique/, `${f} reads the table`);
  }
  // GEO-01's bias: the current-location LABEL from the same table, by the same read.
  assert.match(code('src/app/api/calendar/find-place/route.ts'), /prisma\.operations_north_star\.findUnique\(\{\s*where: \{ user_id: user\.id \},\s*select: \{ current_location_label: true \},/);
  // The three audit action types stay listed: the rows written before still read.
  const audit = code('src/app/api/audit-log/route.ts');
  for (const t of ['operations_north_star_created', 'operations_north_star_updated', 'operations_north_star_reviewed']) assert.match(audit, new RegExp(`'${t}',`), `${t} stays listed`);
  // The six readers and the mapper still compile against each other: `tsc` runs in the build; here the import
  // above already resolved the mapper, and the readers' import line is pinned to the module that exists.
  for (const f of READERS) assert.match(code(f), /from '@\/lib\/ai\/northStarContext'/);
  assert.equal(existsSync(at('src/lib/ai/northStarContext.ts')), true);
});

// ── R2 · DOOR A — THE AUDIT TRAIL IS COMPLIANCE'S ───────────────────────────

test('R2 the Compliance row links SOC 2 proofs then Audit trail; the page, SectionK and the layout are unchanged', () => {
  const compliance = TOOL_REGISTRY.find((t) => t.name === 'Compliance')!;
  assert.deepEqual(compliance.links, [
    { label: 'SOC 2 proofs', href: '/soc2' },
    { label: 'Audit trail', href: '/operations/audit-log' },
  ]);
  assert.equal(compliance.home, '/compliance');
  assert.match(comments(REGISTRY), /TASKS-02 \(Alex, 2026-10-20\): the audit trail \(\/operations\/audit-log,\s*\n\s*\/\/ SectionK_AuditTail\) is doored here, not under Tasks/);
  // The page mounts the tail by the same idiom as before — one component, returned.
  assert.match(code('src/app/operations/audit-log/page.tsx'), /return <SectionK_AuditTail \/>;/);
  assert.equal(existsSync(at('src/components/workbench/operations/SectionK_AuditTail.tsx')), true);
  assert.match(code('src/components/workbench/operations/SectionK_AuditTail.tsx'), />\s*AUDIT TRAIL\s*</);
  assert.match(code('src/app/operations/layout.tsx'), /<OperationsEntityProvider>/);
});

test('R2 the rail shows the trail under Compliance — and nav rule 7 holds because /operations/audit-log is no tool\'s home', () => {
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const compliance = navToolByName('Compliance', TOOL_GATE);
  assert.deepEqual(compliance.subRows.map((r) => [r.label, r.door.href]), [['SOC 2 proofs', '/soc2'], ['Audit trail', '/operations/audit-log']]);
  // Rule 7 (nav.ts): a sub-row may not open ANOTHER TOOL'S screen. Screens are the registry homes; the trail's
  // page is none of them, so Compliance owns the door it names.
  assert.equal(TOOL_REGISTRY.some((t) => t.home === '/operations/audit-log'), false);
  assert.match(code('src/lib/nav.ts'), /for \(const t of rows\) if \(t\.href\) screens\.set\(t\.href\.split\('\?'\)\[0\], t\.name\);/);
  assert.match(code('src/lib/nav.ts'), /if \(owner && owner !== t\.name\) \{/);
  // The only sub-rows in the whole rail that open an /operations page are Compliance's.
  const openers = navRows(TOOL_GATE).flatMap((t) => t.subRows.filter((r) => r.door.href.startsWith('/operations/')).map((r) => `${t.name} → ${r.door.href}`));
  assert.deepEqual(openers, ['Compliance → /operations/audit-log']);
});

test('R2 the orphan law\'s exception list is EMPTY with its maximum at 0, dated, and the trail is counted as a registry link', () => {
  const law = code(LAW);
  assert.match(law, /const ORPHAN_EXCEPTIONS: readonly OrphanException\[\] = \[\] as const;/);
  assert.match(law, /const ORPHAN_EXCEPTIONS_SET_ON = '2026-10-20';/);
  assert.match(law, /const ORPHAN_EXCEPTIONS_MAX = 0;/);
  assert.doesNotMatch(law, /route: '\/operations\/audit-log'/, 'no exception names the trail');
  assert.doesNotMatch(law, /route: '\/operations\/north-star'/, 'none ever named the North Star');
  const notes = comments(LAW);
  assert.match(notes, /TASKS-02 \(Alex, 2026-10-20\): ORPHAN-02's answer for the audit trail — it\s*\n\s*\* belongs to Compliance\./);
  assert.match(notes, /TASKS-02 \(2026-10-20\): \/operations\/audit-log is counted by `orphanLinks`/);
  // The generic registry-link line is unchanged: every link of every row, Compliance's among them.
  assert.match(law, /const orphanLinks = TOOL_REGISTRY\.flatMap\(\(t\) => \(t\.links \?\? \[\]\)\.map\(\(l\) => l\.href\)\)/);
  // The shrink-only check and the per-entry checks stay — an empty list passes them vacuously, a grown one fails.
  assert.match(law, /if \(ORPHAN_EXCEPTIONS\.length > ORPHAN_EXCEPTIONS_MAX\) \{/);
  assert.match(law, /for \(const e of ORPHAN_EXCEPTIONS\) \{/);
});

// ── R3 · TASKS WITH NO SUB-ROWS ─────────────────────────────────────────────

test('R3 the Tasks row links nothing; its why, citation and customer line did not move; the rail shows no sub-row', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual(tasks.links, []);
  assert.equal(tasks.home, '/tasks');
  // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. The row's status, why, citation tail and customer line are tasks03.test.ts's; the TASKS-02 facts stay pinned.
  assert.equal(tasks.status, 'LIVE');
  assert.equal(tasks.why, undefined);
  assert.match(tasks.citation, /^src\/app\/api\/operations\/projects\/\[id\]\/tasks\/route\.ts:43 · generate-tasks\/route\.ts:42 · tasks\/bulk-create\/route\.ts:117 · tasks\/\[taskId\]\/route\.ts:82 → :339, :370; accepting a pending_review task fires the paid build at tasks\/\[taskId\]\/route\.ts:392-402/);
  assert.match(tasks.customer ?? '', /^You can capture a project as a brief, rank it, plan its tasks/);
  assert.match(comments(REGISTRY), /TASKS-02 \(Alex, 2026-10-20\): the ruling TASKS-ONE-01 waited for\. Tasks\s*\n\s*\/\/ has NO sub-rows\./);
  const rail = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(rail.subRows, []);
  // The rail draws the sub-row list only when there is one — Tasks draws none.
  assert.match(code('src/components/shell/Rail.tsx'), /isActive && tool\.subRows\.length > 0 && \(/);
  // No tool in the rail links an /operations/north-star page, and no registry home is one.
  assert.equal(TOOL_REGISTRY.some((t) => (t.links ?? []).some((l) => (l.href ?? '').startsWith('/operations/north-star'))), false);
  assert.equal(TOOL_REGISTRY.some((t) => t.home === '/operations/north-star'), false);
});

// ── R5 · NOTHING ELSE ───────────────────────────────────────────────────────

test('R5 what is left under src/app/operations is the trail, the layout and the three dated redirects — nothing else moved', () => {
  assert.deepEqual(readdirSync(at('src/app/operations')).sort(), ['audit-log', 'content', 'layout.tsx', 'projects', 'routines']);
  for (const f of ['content', 'projects', 'routines']) assert.match(code(`src/app/operations/${f}/page.tsx`), /redirect\('\//, `${f} is a one-hop redirect`);
  // The ai folder holds the two generators the projects use; the optimizer's folder is gone.
  assert.deepEqual(readdirSync(at('src/app/api/operations/ai')).sort(), ['generate-design', 'generate-tasks']);
  // SectionB left the folder; the backlog, the routines and the tail stay (tasks01.test.ts pins the tail's header).
  // WORK-01d (Alex, 2026-10-25): SectionF_RoutineExpenses joins — the routines' own table.
  assert.deepEqual(readdirSync(at('src/components/workbench/operations')).filter((n) => /^Section[A-Z]_/.test(n)).sort(), ['SectionD_ProjectBacklog.tsx', 'SectionE_Work.tsx', 'SectionF_RoutineExpenses.tsx', 'SectionK_AuditTail.tsx']);
});
