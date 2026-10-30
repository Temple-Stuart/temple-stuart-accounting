/**
 * BACKLOG-01b (Alex, 2026-10-20) — THE BRIEF ON TOP OF #1840.
 *
 * THE LOOP: morning card → work → evening card → "copy reflection prompt" → the
 * chat returns the NEXT PROJECTS in THE BRIEF FORMAT → "paste brief" → review →
 * create (backlog) → "copy brief prompt" on the row → the chat audits the code
 * → THE AUDIT and THE PLAN paste back → "scope it" → scoped → … → done | dropped.
 *
 * Rulings A–E: the capture asks only what Alex knows; one fact, one home;
 * "scope it" guarded by name; "paste brief" and "copy brief prompt" are one
 * pure format in two directions; the orphan home form is deleted and the
 * landing's slide stops claiming "title + goals".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  AUDIT_LABEL, BRIEF_HEADINGS, BRIEF_KEYS, BRIEF_NONE, BRIEF_TO_THE_CHAT, CAPTURE_QUESTIONS, NOT_ANSWERED_WORDS, PLAN_LABEL,
  badSizeWords, badTargetWords, badTypeWords, briefPromptText, captureQuestion, noSuchBookWords, parseBrief, unknownHeadingWords,
  type BriefProject,
} from '../operations/projectBrief';
import { DEFAULT_PROJECT_FORM } from '@/components/workbench/operations/projects/types';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261020140000_backlog_01b_brief';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const TYPES = 'src/components/workbench/operations/projects/types.ts';
const BRIEF = 'src/lib/operations/projectBrief.ts';
const POST = 'src/app/api/operations/projects/route.ts';
const PATCH = 'src/app/api/operations/projects/[id]/route.ts';
const FORM = 'src/components/workbench/operations/projects/ProjectCreateForm.tsx';
const ROW_VIEW = 'src/components/workbench/operations/projects/ProjectRowView.tsx';
const ROW = 'src/components/workbench/operations/projects/ProjectRow.tsx';
const SHOWROOM = 'src/components/workbench/operations/projects/showroom/ProjectsPipelineShowroom.tsx';
const SLIDE = 'src/components/home/ProjectsShowcaseSections.tsx';
const ORPHAN = 'src/components/home/ProjectCreateForm.tsx';

const ENTITIES = [{ id: 'ent-local-personal', name: 'Personal' }, { id: 'ent-business', name: 'Business' }];

/** Every needle appears in `text`, each after the one before it. */
function inOrder(text: string, needles: string[], what: string): void {
  let at = -1;
  for (const n of needles) {
    const i = text.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: "${n}" is missing or out of order`);
    at = i;
  }
}

// ── 1 · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('1 the migration adds the three columns and nothing else; the schema mirrors them and dates the *_items columns', () => {
  const sql = code(MIGRATION);
  assert.equal(sql.trim(), 'ALTER TABLE "operations_projects"\n  ADD COLUMN "rulings" TEXT,\n  ADD COLUMN "open_questions" TEXT,\n  ADD COLUMN "deadline_reason" VARCHAR(500);', 'the one statement and nothing else');
  assert.doesNotMatch(sql, /ALTER TYPE|CREATE TYPE|UPDATE|INSERT|DELETE|DROP|DEFAULT/i, 'no enum, no row, no default');
  const notes = comments(MIGRATION);
  assert.match(notes, /BACKLOG-01b \(Alex, 2026-10-20\) — THE BRIEF ON TOP OF BACKLOG-01\./);
  assert.match(notes, /Alex, 15:27/);
  assert.match(notes, /CLEAN-03\s*\n?-- rules on dropping/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 6], MIGRATION_DIR, 'the migration before the newest (JOURNAL-06 followed)');
  // JOURNAL-06 (Alex, 2026-10-20): the evening's five columns, the two CHECKs re-made — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], '20261020150000_journal_06_reflection', 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020160000_backlog_02_reranked', 'the migration before the newest (DOCUMENTS-01 followed)');
  // DOCUMENTS-01 (Alex, 2026-10-28): source_documents, the receipt on its posting — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261028120000_documents_01_source_documents', 'the migration before the newest (DOCUMENTS-02 followed)');
  // DOCUMENTS-02 (Alex, 2026-10-30): the reconciliation's supersession — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261030120000_documents_02_reconciliation_supersession', 'the migration before the newest (FX-01 followed)');
  // FX-01 (2026-10-30): the transactions currency migration followed — every pin above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261030150000_fx_01_transactions_currency', 'the newest migration');
  assert.equal(dirs[dirs.length - 7], '20261020120000_backlog_01_capture', 'right after BACKLOG-01’s');
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model operations_projects {'), schema.indexOf('@@map("operations_projects")'));
  assert.match(model, /^\s+rulings\s+String\?\s+@db\.Text$/m);
  assert.match(model, /^\s+open_questions\s+String\?\s+@db\.Text$/m);
  assert.match(model, /^\s+deadline_reason\s+String\?\s+@db\.VarChar\(500\)$/m);
  assert.match(comments(SCHEMA), /BACKLOG-01b \(2026-10-20\): no longer written or shown by the UI; CLEAN-03\s*\n?\s*\/\/ rules on dropping/);
  // The *_items columns stay — data untouched.
  for (const c of ['goal_items', 'problem_items', 'diagnosis_items']) assert.match(model, new RegExp(`^\\s+${c}\\s+Json\\s+@default\\("\\[\\]"\\) @db\\.JsonB$`, 'm'));
});

test('1 types.ts: Project and the form carry the three; the form carries problem, goal and diagnosis as text; the *_items stay in the form, dated', () => {
  const t = code(TYPES);
  for (const c of ['rulings', 'open_questions', 'deadline_reason']) assert.match(t, new RegExp(`^  ${c}: string \\| null;$`, 'm'), `Project carries ${c}`);
  for (const f of ['problem', 'why', 'goal', 'diagnosis', 'rulings', 'open_questions', 'deadline_reason']) assert.match(t, new RegExp(`^  ${f}: string;$`, 'm'), `ProjectForm carries ${f}`);
  assert.deepEqual(
    [DEFAULT_PROJECT_FORM.problem, DEFAULT_PROJECT_FORM.goal, DEFAULT_PROJECT_FORM.diagnosis, DEFAULT_PROJECT_FORM.rulings, DEFAULT_PROJECT_FORM.open_questions, DEFAULT_PROJECT_FORM.deadline_reason, DEFAULT_PROJECT_FORM.goalItems],
    ['', '', '', '', '', '', []],
  );
  assert.match(comments(TYPES), /goalItems \/ problemItems \/\s*\n?\s*\* diagnosisItems stay here for one release: no form writes them/);
  assert.match(code(ROW), /problem: p\.problem \?\? '',\s+why: p\.why \?\? '',\s+goal: p\.goal \?\? '',\s+diagnosis: p\.diagnosis \?\? '',\s+rulings: p\.rulings \?\? '',\s+open_questions: p\.open_questions \?\? '',\s+deadline_reason: p\.deadline_reason \?\? '',/);
});

// ── 2 · THE CAPTURE'S QUESTIONS AND THE BRIEF FORMAT, VERBATIM ──────────────

test('2 THE CAPTURE\'S QUESTIONS, verbatim and in order; BRIEF_HEADINGS, BRIEF_KEYS and the TO THE CHAT paragraph, verbatim', () => {
  assert.deepEqual(CAPTURE_QUESTIONS.map((q) => [q.label, q.question]), [
    ['TITLE', 'Name it in a few words.'],
    ['TYPE', ''],
    ['BOOK', ''],
    ['1 WHAT IS WRONG TODAY', 'What is wrong, missing, or unknown today? What you see on the screen; what you cannot do or cannot trust.'],
    ['2 WHY IT MATTERS', 'What does it cost you now — money, time, trust, a decision you can\'t make — and what does fixing it unlock?'],
    ['3 THE ONE CORRECT OUTCOME', 'Describe the result done right, as a CPA, a regulator, or Dalio would judge it. If there is one true way to do this, state it.'],
    ['4 ALREADY RULED', 'What have you already decided? One ruling per line — nothing here gets re-decided.'],
    ['5 WANT A RECOMMENDATION ON', 'What do you want the chat to recommend? One question per line.'],
    ['6 BY WHEN, AND WHY', 'Why that date — what happens if it slips?'],
    ['PROOF OF DONE', 'How will we prove it is done — what we will look at, which number must match which? (optional now; required to scope it)'],
    ['SIZE', 'Your guess: small · medium · large'],
    ['LINKS', 'The prompt docs, the PRs, the findings — one per line.'],
    ['NOTES', 'Anything else.'],
  ]);
  assert.deepEqual(CAPTURE_QUESTIONS.map((q) => q.key), ['title', 'type', 'book', 'problem', 'why', 'goal', 'rulings', 'open_questions', 'by_when', 'definition_of_done', 'size', 'links', 'notes']);
  assert.throws(() => captureQuestion('design'));
  assert.deepEqual(BRIEF_KEYS, ['TITLE', 'TYPE', 'BOOK', 'SIZE', 'TARGET']);
  assert.deepEqual(BRIEF_HEADINGS, ['WHAT IS WRONG TODAY', 'WHY IT MATTERS', 'THE ONE CORRECT OUTCOME', 'ALREADY RULED', 'WANT A RECOMMENDATION ON', 'BY WHEN, AND WHY', 'PROOF OF DONE', 'LINKS', 'NOTES']);
  assert.equal(BRIEF_NONE, '— none —');
  assert.equal(BRIEF_TO_THE_CHAT, 'TO THE CHAT — audit before any plan. Read every file this touches on current main; cite file:line; say "not verified" for what you did not read. Return in this order: THE FACTS (what exists today) · THE DATA (each piece and its source — typed, Plaid, booking, books, calculated; REAL vs CALCULATED) · MUST NEVER (the invariants) · DEPENDENCIES (what must exist first; what this feeds) · RISKS · THE DECISIONS I must make (options and consequences; no fallback recommended) · THE PR SEQUENCE (smallest safe order, migrations flagged) · A PROPOSED PROOF OF DONE for me to confirm. One truth.');
  assert.deepEqual([AUDIT_LABEL, PLAN_LABEL, NOT_ANSWERED_WORDS], ['THE AUDIT', 'THE PLAN', '— not answered —']);
  // Pure: no fetch, no clock, no React.
  const brief = code(BRIEF);
  assert.doesNotMatch(brief, /\bfetch\s*\(|new Date\(\)|Date\.now|from 'react'|['"`]\/api\//);
});

// ── 3 · THE ROUND-TRIP LAW ──────────────────────────────────────────────────

const PROJECT: BriefProject = {
  title: 'Fix the ledger CSV',
  type: 'engineering',
  size: 'M',
  target_completion_date: '2026-11-30T00:00:00.000Z',
  problem: 'The CSV drops the note column.\n\nEvery export since LEDGER-03.',
  why: 'I cannot trust the export, so I retype it.',
  goal: 'Every column, every row, byte for byte what the table shows.',
  rulings: 'one concept per PR\nreuse the ledger rule',
  open_questions: 'which separator?\nquote every cell, or only the ones with commas?',
  deadline_reason: 'the filing is due the day after',
  definition_of_done: 'the export diffs clean against the table',
  links: ['docs/prompts/ledger-05.md', 'https://github.com/Temple-Stuart/temple-stuart-accounting/pull/1840'],
  notes: 'typed from the browser pass',
};

test('3 briefPromptText writes THE BRIEF FORMAT — the five KEY: lines first, each section under its heading, a blank line, the TO THE CHAT paragraph', () => {
  const text = briefPromptText(PROJECT, 'Personal');
  assert.equal(text, [
    'TITLE: Fix the ledger CSV', 'TYPE: engineering', 'BOOK: Personal', 'SIZE: M', 'TARGET: 2026-11-30', '',
    'WHAT IS WRONG TODAY', 'The CSV drops the note column.\n\nEvery export since LEDGER-03.', '',
    'WHY IT MATTERS', 'I cannot trust the export, so I retype it.', '',
    'THE ONE CORRECT OUTCOME', 'Every column, every row, byte for byte what the table shows.', '',
    'ALREADY RULED', 'one concept per PR\nreuse the ledger rule', '',
    'WANT A RECOMMENDATION ON', 'which separator?\nquote every cell, or only the ones with commas?', '',
    'BY WHEN, AND WHY', 'the filing is due the day after', '',
    'PROOF OF DONE', 'the export diffs clean against the table', '',
    'LINKS', 'docs/prompts/ledger-05.md\nhttps://github.com/Temple-Stuart/temple-stuart-accounting/pull/1840', '',
    'NOTES', 'typed from the browser pass', '',
    BRIEF_TO_THE_CHAT,
  ].join('\n'));
  // A blank section prints its heading then "— none —"; a blank key prints the key alone.
  const blank = briefPromptText({ ...PROJECT, type: null, size: null, target_completion_date: null, rulings: null, open_questions: null, deadline_reason: null, definition_of_done: null, links: [], notes: '   ' }, 'Personal');
  assert.match(blank, /^TYPE:\nBOOK: Personal\nSIZE:\nTARGET:\n/m);
  for (const h of ['ALREADY RULED', 'WANT A RECOMMENDATION ON', 'BY WHEN, AND WHY', 'PROOF OF DONE', 'LINKS', 'NOTES']) assert.match(blank, new RegExp(`^${h}\\n${BRIEF_NONE}\\n`, 'm'));
});

test('3 the round-trip law: parseBrief(briefPromptText(p)) is p — every field, nothing refused; a blank brief reads back blank', () => {
  const { form, refused } = parseBrief(briefPromptText(PROJECT, 'Personal'), ENTITIES);
  assert.deepEqual(refused, []);
  assert.deepEqual(form, {
    title: PROJECT.title, type: 'engineering', entity_id: 'ent-local-personal', size: 'M', target_completion_date: '2026-11-30',
    problem: PROJECT.problem, why: PROJECT.why, goal: PROJECT.goal, rulings: PROJECT.rulings, open_questions: PROJECT.open_questions,
    deadline_reason: PROJECT.deadline_reason, definition_of_done: PROJECT.definition_of_done, links: [...PROJECT.links], notes: PROJECT.notes,
  });
  const blank = parseBrief(briefPromptText({ ...PROJECT, type: null, size: null, target_completion_date: null, problem: null, why: null, goal: null, rulings: null, open_questions: null, deadline_reason: null, definition_of_done: null, links: [], notes: null }, 'Business'), ENTITIES);
  assert.deepEqual(blank.refused, []);
  assert.deepEqual(blank.form, { title: PROJECT.title, entity_id: 'ent-business', size: '', target_completion_date: '', problem: '', why: '', goal: '', rulings: '', open_questions: '', deadline_reason: '', definition_of_done: '', links: [], notes: '' });
  // Reading stops at the TO THE CHAT paragraph — it never lands in NOTES.
  assert.equal(form.notes, PROJECT.notes);
});

test('3 parseBrief refuses by name and leaves the field untouched: an unknown heading, TYPE travle, BOOK Nobody, SIZE XL, TARGET not a day; a missing section leaves the field untouched; the book matches case-insensitively', () => {
  const r = parseBrief(['TITLE: X', 'TYPE: travle', 'BOOK: Nobody', 'SIZE: XL', 'TARGET: next week', '', 'WHAT IS WRONG TODAY', 'a', '', 'MUST NEVER', 'dropped line', '', 'NOTES', 'n'].join('\n'), ENTITIES);
  assert.deepEqual(r.refused, [unknownHeadingWords('MUST NEVER'), badTypeWords('travle'), noSuchBookWords('Nobody'), badSizeWords('XL'), badTargetWords('next week')]);
  assert.deepEqual(r.form, { title: 'X', problem: 'a', notes: 'n' }, 'the refused fields are untouched; the lines under the unknown heading are dropped');
  assert.equal(unknownHeadingWords('MUST NEVER'), `unknown heading "MUST NEVER" — not one of ${BRIEF_HEADINGS.join(' · ')}`);
  assert.equal(badTypeWords('travle'), 'type "travle" — one of engineering, accounting, content, travel, ops');
  assert.equal(noSuchBookWords('Nobody'), 'book "Nobody" matches no entity');
  const ok = parseBrief('BOOK: personal\nTYPE: Travel\nSIZE: l\n\nLINKS\n  a \n\n b\n', ENTITIES);
  assert.deepEqual(ok.refused, []);
  assert.deepEqual(ok.form, { type: 'travel', entity_id: 'ent-local-personal', size: 'L', links: ['a', 'b'] });
  // A KEY: line after a heading is section text, not a key; a stray line before the first heading is refused by name.
  const stray = parseBrief('TITLE: t\nhello\n\nNOTES\nTYPE: inside notes', ENTITIES);
  assert.deepEqual(stray.refused, ['"hello" is before the first heading and is not one of TITLE: TYPE: BOOK: SIZE: TARGET:']);
  assert.deepEqual(stray.form, { title: 't', notes: 'TYPE: inside notes' });
});

// ── 4 · THE POST AND THE PATCH ──────────────────────────────────────────────

test('4 the POST: problem and goal required by name with why\'s cap; rulings and open_questions capped; deadline_reason ≤ 500 and required when a target date is set; the three written', () => {
  const post = code(POST);
  inOrder(post, [
    "requireString(body.why, 'why')",
    "const problemRaw = requireString(body.problem, 'problem');",
    'const problemLength = [...problemRaw].length;',
    "message: capWords('problem', problemLength)",
    "const goalRaw = requireString(body.goal, 'goal');",
    "message: capWords('goal', goalLength)",
    "const found = PROJECT_SIZES.find((x) => x === body.size);",
    'const rulings = trimNullable(body.rulings);',
    "message: capWords('rulings', [...rulings].length)",
    'const open_questions = trimNullable(body.open_questions);',
    'const deadline_reason = trimNullable(body.deadline_reason);',
    'if (deadline_reason !== null && [...deadline_reason].length > DEADLINE_REASON_MAX_CODE_POINTS)',
    'if (target_completion_date !== null && deadline_reason === null) {',
    "field: 'deadline_reason', message: 'deadline_reason is required when a target date is set'",
    'prisma.operations_projects.create({',
    'rulings,', 'open_questions,', 'deadline_reason,',
  ], 'the POST');
  assert.match(post, /const DEADLINE_REASON_MAX_CODE_POINTS = 500;/);
  assert.match(post, /const capWords = \(field: string, length: number\) => `\$\{field\} is at most \$\{WHY_MAX_CODE_POINTS\} characters \(\$\{length\} given\)`;/);
  assert.doesNotMatch(post, /const goal = trimNullable\(body\.goal\)|const problem = trimNullable\(body\.problem\)/, 'problem and goal are no longer optional');
  assert.match(post, /const diagnosis = trimNullable\(body\.diagnosis\);/, 'THE AUDIT stays optional text');
  assert.match(comments(POST), /BACKLOG-01b \(Alex, 2026-10-20\) — the capture asks only what Alex knows/);
});

test('4 the PATCH: problem/goal follow why\'s rule; diagnosis/design never cleared once scoped; "scope it" names the missing three and sets promoted_at once; a target date without its reason refused; the dated note', () => {
  const patch = code(PATCH);
  inOrder(patch, [
    "for (const field of ['deep_research_input', 'claude_code_audit_input'] as const) {",
    "for (const field of ['problem', 'goal'] as const) {",
    'message: `${field} may not be cleared once set`',
    'message: `${field} is at most ${WHY_MAX_CODE_POINTS} characters (${length} given)`',
    'let diagnosisAfter: string | null = existing.diagnosis;',
    'let designAfter: string | null = existing.design;',
    "for (const field of ['diagnosis', 'design'] as const) {",
    'if (t === null && existing[field] !== null && SCOPED_OR_BEYOND.includes(existing.status)) {',
    'message: `${field} may not be cleared once scoped`',
    "for (const field of ['rulings', 'open_questions'] as const) {",
    'if (body.deadline_reason !== undefined) {',
    'deadlineReasonAfter = t;',
    'const definitionOfDoneAfter: string | null = body.definition_of_done !== undefined ? trimNonEmpty(body.definition_of_done) : existing.definition_of_done;',
    'if (body.status !== undefined) {',
    "if (incoming === 'scoped' && existing.status === 'backlog') {",
    "const missing = (['diagnosis', 'design', 'definition_of_done'] as const).filter((f) => after[f] === null);",
    "field: 'status', message: `scope it needs: ${missing.join(', ')}`",
    'data.promoted_at = existing.promoted_at ?? new Date();',
    'let targetAfter: Date | null = existing.target_completion_date;',
    'if (body.target_completion_date !== undefined) {',
    'if (targetAfter !== null && deadlineReasonAfter === null) {',
    "field: 'deadline_reason', message: 'deadline_reason is required when a target date is set'",
  ], 'the PATCH');
  assert.match(patch, /const SCOPED_OR_BEYOND: readonly ProjectStatus\[\] = \['scoped', 'scheduled', 'in_progress', 'completed'\];/);
  assert.match(patch, /const DEADLINE_REASON_MAX_CODE_POINTS = 500;/);
  assert.doesNotMatch(patch, /for \(const field of \['goal', 'problem', 'diagnosis', 'design', 'deep_research_input', 'claude_code_audit_input'\] as const\)/, 'the four texts left the generic loop');
  assert.match(comments(PATCH), /BACKLOG-01b: the only guarded transition is backlog → scoped \(diagnosis, design\s*\n?\s*\/\/ and definition_of_done required; promoted_at set once\); BACKLOG-03 adds the table\./);
  assert.doesNotMatch(comments(PATCH), /no transition table yet/);
});

// ── 5 · THE CAPTURE FORM ────────────────────────────────────────────────────

test('5 the capture form asks the questions in order through captureQuestion, refuses 1/2/3 and the reason by name, pastes a brief, and says CAPTURE — what only you know', () => {
  const form = code(FORM);
  inOrder(form, [
    "field('title',", "field('type',", "field('book',", "field('problem',", "field('why',", "field('goal',", "field('rulings',", "field('open_questions',",
    "field('by_when',", 'data-capture-field="target_completion_date"', 'data-capture-field="deadline_reason"',
    "field('definition_of_done',", "field('size',", "field('links',", "field('notes',",
  ], 'the capture form');
  assert.match(form, /const q = captureQuestion\(key\);/);
  assert.match(form, /<div className=\{labelClass\}>\{q\.label\}<\/div>\s*\{q\.question && <div className=\{questionClass\} data-capture-question=\{key\}>\{q\.question\}<\/div>\}/, 'the label, then the question under it');
  assert.match(form, /CAPTURE — what only you know/);
  inOrder(form, [
    'if (createForm.problem.trim().length === 0) errors.problem = PROBLEM_REQUIRED_WORDS;',
    'if (createForm.why.trim().length === 0) errors.why = WHY_REQUIRED_WORDS;',
    'if (createForm.goal.trim().length === 0) errors.goal = GOAL_REQUIRED_WORDS;',
    'if (createForm.target_completion_date.length > 0 && createForm.deadline_reason.trim().length === 0) errors.deadline_reason = REASON_REQUIRED_WORDS;',
  ], 'the refusals');
  assert.match(form, /export const PROBLEM_REQUIRED_WORDS = '1 WHAT IS WRONG TODAY is required';/);
  assert.match(form, /export const WHY_REQUIRED_WORDS = '2 WHY IT MATTERS is required';/);
  assert.match(form, /export const GOAL_REQUIRED_WORDS = '3 THE ONE CORRECT OUTCOME is required';/);
  assert.match(form, /export const REASON_REQUIRED_WORDS = 'the reason is required when a date is set';/);
  // paste brief: parseBrief fills the fields for review; refusals print under the box; the box collapses after a fill; nothing posts.
  inOrder(form, [
    'const fillFromBrief = () => {',
    'const { form: filled, refused } = parseBrief(briefText, selectableEntities);',
    'setCreateForm((f) => ({ ...f, ...filled }));',
    'setBriefRefused(refused);',
    'setBriefOpen(false);',
  ], 'fill from brief');
  assert.doesNotMatch(form.slice(form.indexOf('const fillFromBrief'), form.indexOf('const handleCreate')), /fetch\(/, 'nothing posts on a fill');
  inOrder(form, ['data-capture-brief>', 'aria-label="Brief"', 'data-capture-fill', 'fill from brief', 'data-capture-brief-open', 'data-capture-brief-refused', 'data-capture-error="form"', "field('title',"], 'the box sits above the fields');
  assert.match(comments(FORM), /"paste brief" \(ruling D\)/);
});

// ── 6 · THE ROW ─────────────────────────────────────────────────────────────

test('6 the row view: no ListManager; "copy brief prompt" beside target:; the read view in the brief\'s order with "— not answered —"; the edit view\'s paste boxes; "scope it" while backlog; the showroom passes neither', () => {
  const view = code(ROW_VIEW);
  assert.doesNotMatch(view, /ListManager|renderStructuredField|goalItems|problemItems|diagnosisItems|showDesignReasoning|view AI design reasoning|1 · goal/);
  assert.match(view, /import \{ AUDIT_LABEL, NOT_ANSWERED_WORDS, PLAN_LABEL, captureQuestion \} from '@\/lib\/operations\/projectBrief';/);
  inOrder(view, [
    'target: {formatTargetDate(project.target_completion_date)}',
    'data-project-copy-brief',
    'copy brief prompt',
    'data-project-brief-words',
  ], 'the header');
  inOrder(view, [
    '{expanded && !editing && (',
    'data-project-capture>',
    "['problem', project.problem],", "['why', project.why],", "['goal', project.goal],", "['rulings', project.rulings],", "['open_questions', project.open_questions],",
    'data-project-text={key}>{answered(text)}',
    "captureQuestion('by_when').label", 'data-project-text="target_completion_date"', 'data-project-text="deadline_reason"',
    "captureQuestion('definition_of_done').label", 'data-project-text="definition_of_done"',
    "captureQuestion('links').label", 'data-project-links',
    "captureQuestion('notes').label", 'data-project-text="notes"',
    '{AUDIT_LABEL}', 'data-project-text="diagnosis"',
    '{PLAN_LABEL}', 'data-project-text="design"',
    'reality inputs',
  ], 'the read view');
  assert.match(view, /const answered = \(t: string \| null\): string => \(\(t \?\? ''\)\.trim\(\)\.length > 0 \? \(t as string\) : NOT_ANSWERED_WORDS\);/);
  inOrder(view, ['data-project-scope-words', "{onScopeIt && project.status === 'backlog' && (", 'data-project-scope-it', "{scoping ? 'scoping…' : 'scope it'}", 'onClick={onUnarchive}'], 'scope it among the controls');
  inOrder(view, [
    '{editing && (', 'data-project-capture-edit',
    "(['problem', 'why', 'goal', 'rulings', 'open_questions'] as const).map((key) => (",
    'value={form[key]}',
    "captureQuestion('by_when').label", 'value={form.target_completion_date}', 'value={form.deadline_reason}',
    'value={form.definition_of_done}', "value={form.links.join('\\n')}", 'value={form.notes}',
    '{AUDIT_LABEL}', 'value={form.diagnosis}', 'placeholder="paste the chat\'s audit here"',
    '{PLAN_LABEL}', 'onClick={onGenerateDesign}', 'value={form.design}', 'placeholder="paste the plan here"',
    '{generationError && (',
    'est. minutes',
  ], 'the edit view');
  assert.equal((view.match(/type="date"/g) ?? []).length, 1, 'one target date input, in 6 BY WHEN, AND WHY');
  assert.doesNotMatch(view, /\bfetch\s*\(|\buseEffect\s*\(|['"`]\/api\//, 'the view is props only');
  // The container owns the clipboard and the PATCH; the showroom passes neither (no button).
  const row = code(ROW);
  assert.match(row, /import \{ briefPromptText \} from '@\/lib\/operations\/projectBrief';/);
  assert.match(row, /await navigator\.clipboard\.writeText\(briefPromptText\(project, bookName\)\);/);
  assert.match(row, /window\.setTimeout\(\(\) => setBriefWords\(null\), 2000\);/);
  assert.match(row, /body: JSON\.stringify\(\{ status: 'scoped' \}\),/);
  assert.match(row, /onCopyBrief=\{handleCopyBrief\}/);
  assert.match(row, /onScopeIt=\{handleScopeIt\}/);
  assert.doesNotMatch(row, /showDesignReasoning/);
  const showroom = code(SHOWROOM);
  assert.doesNotMatch(showroom, /onCopyBrief|onScopeIt|showDesignReasoning|onToggleDesignReasoning/);
});

// ── 7 · RULING E ────────────────────────────────────────────────────────────

test('7 the orphan home form is deleted and nothing imports it; the landing\'s slide says Capture — what only you know', () => {
  assert.equal(existsSync(resolve(process.cwd(), ORPHAN)), false);
  const slide = code(SLIDE);
  assert.doesNotMatch(slide, /home\/ProjectCreateForm|title \+ goals|I WANT to/);
  assert.match(slide, /<DarkSlide title="Capture — what only you know">/);
  assert.match(slide, /<p>the problem, why it matters, the one correct outcome; the audit and the plan paste back<\/p>/);
  assert.match(comments(SLIDE), /1\. CAPTURE — mirrors ProjectCreateForm, the capture form \(BACKLOG-01b,/);
});
