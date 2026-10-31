/**
 * BACKLOG-01 (Alex, 2026-10-20) — THE CAPTURE FORM AND ITS COLUMNS.
 *
 * The "New project" form is the CAPTURE form: title · type · book · why, and
 * the optional size, definition of done, links, notes and target date. A
 * captured project lands in the BACKLOG (set explicitly by the POST). The
 * Dalio loop stays on the row's edit view — "scope it". One migration adds the
 * four statuses, the two enums, the ten columns, the index and the CHECK; the
 * schema mirrors it. The projects list shows every book (ruling G); the cell
 * wears TYPE and SIZE pills beside the status pill. The PATCH accepts the new
 * fields with the POST's rules and, with no transition table yet, any valid
 * status (BACKLOG-03 adds the moves).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  DEFAULT_PROJECT_FORM, PROJECT_SIZES, PROJECT_TYPES, SIZE_LABELS, STATUS_LABELS, STATUS_PILL_CLASSES, TYPE_LABELS,
} from '@/components/workbench/operations/projects/types';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261020120000_backlog_01_capture';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const TYPES = 'src/components/workbench/operations/projects/types.ts';
const POST = 'src/app/api/operations/projects/route.ts';
const PATCH = 'src/app/api/operations/projects/[id]/route.ts';
const FORM = 'src/components/workbench/operations/projects/ProjectCreateForm.tsx';
const SECTION = 'src/components/workbench/operations/SectionD_ProjectBacklog.tsx';
const ROWS = 'src/components/workbench/operations/projects/ProjectTableRows.tsx';
const ROW_VIEW = 'src/components/workbench/operations/projects/ProjectRowView.tsx';
const ROW = 'src/components/workbench/operations/projects/ProjectRow.tsx';
const SHOWROOM = 'src/components/workbench/operations/projects/showroom/ProjectsPipelineShowroom.tsx';

const TEN = ['not_started', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived', 'backlog', 'scoped', 'scheduled', 'dropped'] as const;
const COLUMNS = ['type', 'size', 'why', 'definition_of_done', 'links', 'notes', 'rank', 'promoted_at', 'scheduled_at', 'done_at'] as const;

/** Every needle appears in `text`, each after the one before it. */
function inOrder(text: string, needles: string[], what: string): void {
  let at = -1;
  for (const n of needles) {
    const i = text.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: "${n}" is missing or out of order`);
    at = i;
  }
}

// ── 1 · THE MIGRATION ────────────────────────────────────────────────────────

test('1 the migration: four ADD VALUEs the precedent\'s way, two CREATE TYPEs, the ten columns, the CHECK and the index — and nothing rewritten', () => {
  const sql = code(MIGRATION);
  for (const v of ['backlog', 'scoped', 'scheduled', 'dropped']) {
    assert.match(sql, new RegExp(`^ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS '${v}';$`, 'm'), `adds ${v}`);
  }
  assert.match(sql, /^CREATE TYPE "ProjectType" AS ENUM \('engineering', 'accounting', 'content', 'travel', 'ops'\);$/m);
  assert.match(sql, /^CREATE TYPE "ProjectSize" AS ENUM \('S', 'M', 'L'\);$/m);
  assert.match(sql, /ALTER TABLE "operations_projects"\s+ADD COLUMN "type" "ProjectType",\s+ADD COLUMN "size" "ProjectSize",\s+ADD COLUMN "why" TEXT,\s+ADD COLUMN "definition_of_done" TEXT,\s+ADD COLUMN "links" JSONB NOT NULL DEFAULT '\[\]',\s+ADD COLUMN "notes" TEXT,\s+ADD COLUMN "rank" INTEGER,\s+ADD COLUMN "promoted_at" TIMESTAMPTZ\(6\),\s+ADD COLUMN "scheduled_at" TIMESTAMPTZ\(6\),\s+ADD COLUMN "done_at" TIMESTAMPTZ\(6\);/);
  assert.match(sql, /ADD CONSTRAINT "operations_projects_rank_positive" CHECK \("rank" IS NULL OR "rank" > 0\);/);
  assert.match(sql, /^CREATE INDEX "operations_projects_user_id_status_rank_idx" ON "operations_projects"\("user_id", "status", "rank"\);$/m);
  // Every column but links is nullable with no default — "not stated", never defaulted; no row is touched.
  for (const c of COLUMNS) if (c !== 'links') assert.doesNotMatch(sql, new RegExp(`"${c}"[^,;\\n]*DEFAULT`), `${c} has no default`);
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO|DROP)\s/, 'no row is written, moved or dropped');
  assert.doesNotMatch(sql, /ALTER COLUMN "status"/, 'the status default is not changed — the POST sets backlog itself');
  assert.doesNotMatch(sql, /BEGIN|COMMIT/, 'the ADD VALUEs run bare, the precedent\'s way');
  const notes = comments(MIGRATION);
  assert.match(notes, /BACKLOG-01 \(Alex, 2026-10-20\) — THE CAPTURE FORM AND ITS COLUMNS\./);
  assert.match(notes, /cannot run inside a BEGIN\/COMMIT block/);
  assert.match(notes, /20260605000000_pr_ops_archive_task_status/, 'names the precedent');
  assert.match(notes, /applied at\s*\n?-- deploy after merge/);
  // The ladder: this is the newest migration, right after LEDGER-03's.
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // BACKLOG-01b (2026-10-20): the brief's migration followed (the newest); this one is pinned by NAME and its neighbours.
  assert.ok(dirs.includes(MIGRATION_DIR), 'the migration exists');
  assert.equal(dirs[dirs.indexOf(MIGRATION_DIR) - 1], '20261019230000_ledger_03_planned_item_link_audit', 'right after LEDGER-03’s');
  assert.equal(dirs[dirs.indexOf(MIGRATION_DIR) + 1], '20261020140000_backlog_01b_brief', 'right before BACKLOG-01b’s');
});

test('1 the schema mirrors the migration: the ten statuses, the two enums, the ten columns and the index', () => {
  const schema = code(SCHEMA);
  const status = schema.slice(schema.indexOf('enum ProjectStatus {'), schema.indexOf('}', schema.indexOf('enum ProjectStatus {')));
  for (const s of TEN) assert.match(status, new RegExp(`^\\s+${s}$`, 'm'), `ProjectStatus has ${s}`);
  assert.match(schema, /enum ProjectType \{\s+engineering\s+accounting\s+content\s+travel\s+ops\s+\}/);
  assert.match(schema, /enum ProjectSize \{\s+S\s+M\s+L\s+\}/);
  const model = schema.slice(schema.indexOf('model operations_projects {'), schema.indexOf('@@map("operations_projects")'));
  assert.match(model, /^\s+type\s+ProjectType\?$/m);
  assert.match(model, /^\s+size\s+ProjectSize\?$/m);
  assert.match(model, /^\s+why\s+String\?\s+@db\.Text$/m);
  assert.match(model, /^\s+definition_of_done\s+String\?\s+@db\.Text$/m);
  assert.match(model, /^\s+links\s+Json\s+@default\("\[\]"\) @db\.JsonB$/m);
  assert.match(model, /^\s+notes\s+String\?\s+@db\.Text$/m);
  assert.match(model, /^\s+rank\s+Int\?$/m);
  for (const d of ['promoted_at', 'scheduled_at', 'done_at']) assert.match(model, new RegExp(`^\\s+${d}\\s+DateTime\\?\\s+@db\\.Timestamptz\\(6\\)$`, 'm'));
  assert.match(model, /@@index\(\[user_id, status, rank\]\)/);
  assert.match(model, /status\s+ProjectStatus @default\(not_started\)/, 'the default is untouched');
});

// ── 2 · THE TYPES ────────────────────────────────────────────────────────────

test('2 types.ts: the ten statuses have labels and pills; ProjectType and ProjectSize have their words; the form carries the capture\'s fields empty', () => {
  assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [...TEN].sort());
  assert.deepEqual(Object.keys(STATUS_PILL_CLASSES).sort(), [...TEN].sort());
  assert.deepEqual([STATUS_LABELS.backlog, STATUS_LABELS.scoped, STATUS_LABELS.scheduled, STATUS_LABELS.dropped], ['backlog', 'scoped', 'scheduled', 'dropped']);
  assert.deepEqual(PROJECT_TYPES, ['engineering', 'accounting', 'content', 'travel', 'ops']);
  assert.deepEqual(PROJECT_SIZES, ['S', 'M', 'L']);
  assert.deepEqual(TYPE_LABELS, { engineering: 'engineering', accounting: 'accounting', content: 'content', travel: 'travel', ops: 'ops' });
  assert.deepEqual(SIZE_LABELS, { S: 'small', M: 'medium', L: 'large' });
  assert.deepEqual(
    { type: DEFAULT_PROJECT_FORM.type, size: DEFAULT_PROJECT_FORM.size, why: DEFAULT_PROJECT_FORM.why, definition_of_done: DEFAULT_PROJECT_FORM.definition_of_done, links: DEFAULT_PROJECT_FORM.links, notes: DEFAULT_PROJECT_FORM.notes },
    { type: '', size: '', why: '', definition_of_done: '', links: [], notes: '' },
  );
  const t = code(TYPES);
  assert.match(t, /export type ProjectType = 'engineering' \| 'accounting' \| 'content' \| 'travel' \| 'ops';/);
  assert.match(t, /export type ProjectSize = 'S' \| 'M' \| 'L';/);
  for (const c of COLUMNS) assert.match(t, new RegExp(`^  ${c}: `, 'm'), `Project carries ${c}`);
  assert.match(t, /^  links: string\[\];$/m);
  assert.match(t, /^  type: ProjectType \| '';$/m);
  assert.match(t, /^  size: ProjectSize \| '';$/m);
  // The edit form round-trips the row's capture fields; the showroom still passes the default form.
  // BACKLOG-01b (2026-10-20): problem and goal (and the brief's three) sit between size and definition_of_done now.
  assert.match(code(ROW), /type: p\.type \?\? '',\s+size: p\.size \?\? '',[\s\S]{0,400}why: p\.why \?\? '',[\s\S]{0,400}definition_of_done: p\.definition_of_done \?\? '',\s+links: Array\.isArray\(p\.links\)/);
  assert.match(code(SHOWROOM), /form=\{DEFAULT_PROJECT_FORM\}/);
});

// ── 3 · THE POST ─────────────────────────────────────────────────────────────

test('3 the POST: type and why required by name, goal items empty allowed, links the *_items shape, status backlog set explicitly, the ladder covers all ten', () => {
  const post = code(POST);
  inOrder(post, [
    "requireString(body.entity_id, 'entity_id')",
    "requireString(body.title, 'title', 500)",
    'const type = PROJECT_TYPES.find((t) => t === body.type);',
    "field: 'type', message: `type is required — one of ${PROJECT_TYPES.join(', ')}`",
    "requireString(body.why, 'why')",
    'const whyLength = [...whyRaw].length;',
    'if (whyLength > WHY_MAX_CODE_POINTS)',
    "field: 'why', message: `why is at most ${WHY_MAX_CODE_POINTS} characters (${whyLength} given)`",
    "const found = PROJECT_SIZES.find((x) => x === body.size);",
    "validateItems(body.goalItems, 'goalItems', true)",
    "validateItems(body.problemItems, 'problemItems', true)",
    "validateItems(body.diagnosisItems, 'diagnosisItems', true)",
    "validateItems(body.links, 'links', true)",
    'const definition_of_done = trimNullable(body.definition_of_done);',
    'const notes = trimNullable(body.notes);',
    'prisma.operations_projects.create({',
    "status: 'backlog',",
    'type,', 'size,', 'why,', 'definition_of_done,', 'links: linksResult.items,', 'notes,',
    "type: 'operations_project_created'",
    'description: `captured ${type} project "${title}" for ${userEmail}`',
  ], 'the POST');
  assert.match(post, /const WHY_MAX_CODE_POINTS = 4000;/);
  assert.doesNotMatch(post, /validateItems\(body\.goalItems, 'goalItems'\)/, 'goal items are no longer required');
  assert.match(post, /const PROJECT_TYPES: readonly ProjectType\[\] = \['engineering', 'accounting', 'content', 'travel', 'ops'\];/);
  assert.match(post, /const PROJECT_SIZES: readonly ProjectSize\[\] = \['S', 'M', 'L'\];/);
  // STATUS_ORDER: all ten, the active work first, a legacy not_started after the backlog.
  const order = post.slice(post.indexOf('const STATUS_ORDER'), post.indexOf('};', post.indexOf('const STATUS_ORDER')));
  const keys = [...order.matchAll(/^\s+(\w+): (\d+),$/gm)].map((m) => [m[1], Number(m[2])] as const);
  assert.deepEqual(keys, [
    ['in_progress', 0], ['scheduled', 1], ['scoped', 2], ['backlog', 3], ['blocked', 4], ['not_started', 5],
    ['completed', 6], ['dropped', 7], ['cancelled', 8], ['archived', 9],
  ]);
  assert.match(comments(POST), /POST — CAPTURE a project \(BACKLOG-01, Alex, 2026-10-20\)/);
  assert.match(comments(POST), /journal\.ts:285 `\[\.\.\.text\]\.length`/, 'why\'s cap cites JOURNAL-04\'s count');
  // The GET still filters by ?entity_id for any other caller — the Tasks page just stops sending it.
  assert.match(post, /const entityId = searchParams\.get\('entity_id'\);/);
});

// ── 4 · THE PATCH ────────────────────────────────────────────────────────────

test('4 the PATCH: the ten statuses valid; type strict and never cleared once set; why capped and never emptied once set; size, definition of done, notes, links accepted; the dated no-transition note', () => {
  const patch = code(PATCH);
  const valid = patch.slice(patch.indexOf('const VALID_STATUSES'), patch.indexOf('];', patch.indexOf('const VALID_STATUSES')));
  assert.deepEqual([...valid.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort(), [...TEN].sort());
  inOrder(patch, [
    'if (body.type !== undefined) {',
    "if (body.type === null || body.type === '') {",
    'if (existing.type !== null) {',
    "field: 'type', message: 'type may not be cleared once set'",
    'const found = PROJECT_TYPES.find((t) => t === body.type);',
    "field: 'type', message: `type must be one of ${PROJECT_TYPES.join(', ')}`",
    'data.type = found;',
    'if (body.size !== undefined) {',
    'data.size = null;',
    "field: 'size', message: `size must be one of ${PROJECT_SIZES.join(', ')} or empty`",
    'data.size = found;',
    'if (body.why !== undefined) {',
    'const t = trimNonEmpty(body.why);',
    'if (existing.why !== null) {',
    "field: 'why', message: 'why may not be cleared once set'",
    'const whyLength = [...t].length;',
    'if (whyLength > WHY_MAX_CODE_POINTS)',
    'data.why = t;',
    "for (const field of ['definition_of_done', 'notes'] as const) {",
    'if (body[field] !== undefined) data[field] = trimNonEmpty(body[field]);',
    'if (body.links !== undefined) {',
    "validateItems(body.links, 'links')",
    'data.links = result.items;',
    'if (body.status !== undefined) {',
    'if (!VALID_STATUSES.includes(incoming)) {',
  ], 'the PATCH');
  assert.match(patch, /const WHY_MAX_CODE_POINTS = 4000;/);
  // BACKLOG-01b (2026-10-20): the note moved with the first guarded transition — "scope it" (pinned in backlog01b.test.ts).
  assert.match(comments(PATCH), /BACKLOG-01b: the only guarded transition is backlog → scoped \(diagnosis, design\s*\n?\s*\/\/ and definition_of_done required; promoted_at set once\); BACKLOG-03 adds the table\./);
  // Audited as today: a status change is status_changed, anything else updated.
  assert.match(patch, /type: statusChange \? 'operations_project_status_changed' : 'operations_project_updated'/);
});

// ── 5 · THE CAPTURE FORM ─────────────────────────────────────────────────────

// BACKLOG-01b (2026-10-20): the form asks THE CAPTURE'S QUESTIONS — the field order, the badge, the words and the
// refusals moved to backlog01b.test.ts; held here: no ListManager, no "I WANT to", type and why still refused by name,
// the book select as before, links one per line.
test('5 the capture form: no ListManager and no "I WANT to", type and why refused by name next to the field, the book as before', () => {
  const form = code(FORM);
  assert.doesNotMatch(form, /ListManager|I WANT to|goalItems/, 'the goal list left the capture form');
  assert.doesNotMatch(form, /title \+ goals|CAPTURE — scope it on the row/);
  assert.match(form, /<option value="">— choose —<\/option>/, 'type has no preselection');
  assert.match(form, /<option value="">— not sized —<\/option>/);
  // Refused by name, next to the field, before any fetch; the book still refuses as before.
  inOrder(form, [
    "if (!createForm.type) errors.type = TYPE_REQUIRED_WORDS;",
    'if (createForm.why.trim().length === 0) errors.why = WHY_REQUIRED_WORDS;',
    'if (!createForm.entity_id) {',
    'setCreateError(BOOK_REQUIRED_WORDS);',
    'if (Object.keys(errors).length > 0) return;',
    "fetch('/api/operations/projects'",
  ], 'the submit');
  assert.match(form, /export const TYPE_REQUIRED_WORDS = 'type is required — choose one';/);
  assert.match(form, /data-capture-error=\{key\}/, 'every refusal prints under its own field');
  // Links: one per line, split to the list the POST receives.
  assert.match(form, /export const splitLinks = \(text: string\): string\[\] =>\s+text\.split\(\/\\r\\n\|\\r\|\\n\/\)\.map\(\(line\) => line\.trim\(\)\)\.filter\(\(line\) => line\.length > 0\);/);
  assert.match(form, /setCreateForm\(\{ \.\.\.createForm, links: splitLinks\(e\.target\.value\) \}\)/);
  // The book select is the entity select as before — Trading filtered out, no default.
  assert.match(form, /const isProjectEntity = \(name: string\) => name\.trim\(\)\.toLowerCase\(\) !== 'trading';/);
  assert.match(form, /<option value="">— select —<\/option>/);
  assert.match(comments(FORM), /ProjectCreateForm — the CAPTURE form \(BACKLOG-01b, Alex, 2026-10-20\)\./);
});

// ── 6 · THE SECTION AND THE CELL ─────────────────────────────────────────────

test('6 the section fetches every book (no entity_id), refetches on show-archived only, keeps the selector as the form\'s default, and says capture', () => {
  const d = code(SECTION);
  assert.doesNotMatch(d, /params\.set\('entity_id'/, 'the fetch no longer filters by the page selector');
  assert.match(d, /if \(showArchived\) params\.set\('include_archived', 'true'\);/);
  assert.match(d, /\}, \[showArchived\]\);/);
  assert.doesNotMatch(d, /\[selectedEntityId, showArchived\]/);
  assert.match(d, /selectedEntityId \?\? entities\.find\(\(e\) => e\.is_default\)\?\.id \?\? entities\[0\]\?\.id \?\? ''/, 'the selector still seeds the form');
  assert.match(d, /no projects yet — click &quot;\+ new project&quot; to capture the first one\./);
  assert.doesNotMatch(d, /no projects for this entity yet/);
  assert.match(d, /show archived/);
  assert.match(d, /\+ new project/);
  assert.match(comments(SECTION), /BACKLOG-01 \(Alex, 2026-10-20\) — ruling G: the list shows EVERY book\./);
});

// PROJECTS-02 (Alex, 2026-10-25): the pills are three columns of the spec — TYPE, STATUS and SIZE in the label maps' words, "—" when null —
// and BOOK names the book; the cell they sat on is gone with the two-column table (projects02.test.ts pins the words over fixtures).
test('6 the project row wears TYPE and SIZE as columns beside STATUS, "—" when null, and still names the book', () => {
  const spec = code('src/lib/operations/projectsTable.ts');
  assert.match(spec, /export const projectTypeOf = \(row: ProjectTableRow\): string \| null => \(row\.project\.type === null \? null : TYPE_LABELS\[row\.project\.type\]\);/);
  assert.match(spec, /export const projectSizeOf = \(row: ProjectTableRow\): string \| null => \(row\.project\.size === null \? null : SIZE_LABELS\[row\.project\.size\]\);/);
  assert.match(spec, /export const projectStatusOf = \(row: ProjectTableRow\): string => STATUS_LABELS\[row\.project\.status\];/);
  assert.match(spec, /valueColumn<ProjectTableRow, ProjectColumn>\('type', head\.type, projectTypeOf\),\n\s*valueColumn<ProjectTableRow, ProjectColumn>\('book', head\.book, \(r\) => bookNameOf\(books, r\.project\.entity_id\)\),\n\s*valueColumn<ProjectTableRow, ProjectColumn>\('status', head\.status, projectStatusOf\),/);
  assert.match(spec, /valueColumn<ProjectTableRow, ProjectColumn>\('size', head\.size, projectSizeOf\),/);
  assert.doesNotMatch(code(ROWS), /data-project-type|data-project-size|STATUS_PILL_CLASSES/, 'no pill of its own on the row');
});

// ── 7 · THE EDIT VIEW ────────────────────────────────────────────────────────

// BACKLOG-01b (2026-10-20): the read view and the edit view name the brief's facts in its order (pinned in
// backlog01b.test.ts); held here: the ten statuses, the capture block above the rest, the type/size/links/notes
// inputs, the pure view fetch-free.
test('7 the row view: STATUS_OPTIONS covers all ten; the capture reads first; the edit mode binds the form; the pure view stays fetch-free', () => {
  const view = code(ROW_VIEW);
  const opts = view.slice(view.indexOf('const STATUS_OPTIONS'), view.indexOf('];', view.indexOf('const STATUS_OPTIONS')));
  assert.deepEqual([...opts.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort(), [...TEN].sort());
  inOrder(view, [
    '{expanded && !editing && (',
    'data-project-capture>',
    'data-project-text="definition_of_done"',
    'data-project-links',
    'data-project-text="notes"',
    'reality inputs',
  ], 'the read view');
  inOrder(view, [
    '{editing && (',
    '{STATUS_OPTIONS.map((s) => (',
    'data-project-capture-edit',
    'value={form.type}',
    "onFormChange({ ...form, type: e.target.value as ProjectType | '' })",
    '<option value="">— choose —</option>',
    'value={form.size}',
    '<option value="">— not sized —</option>',
    'value={form[key]}',
    'value={form.definition_of_done}',
    "value={form.links.join('\\n')}",
    "onFormChange({ ...form, links: e.target.value.split(/\\r\\n|\\r|\\n/) })",
    'value={form.notes}',
    'value={form.diagnosis}',
    'value={form.design}',
  ], 'the edit view');
  assert.doesNotMatch(view, /\bfetch\s*\(|\buseEffect\s*\(|['"`]\/api\//, 'the view is props only');
  // The save sends the whole form — the new fields ride on the PATCH with it.
  assert.match(code(ROW), /method: 'PATCH',\s+headers: \{ 'Content-Type': 'application\/json' \},\s+body: JSON\.stringify\(form\),/);
});
