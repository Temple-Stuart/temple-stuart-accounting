/**
 * journal06.test.ts — JOURNAL-06 (Alex, 2026-10-20): THE EVENING'S SIX QUESTIONS AND THE REFLECTION PROMPT.
 *
 * Alex, 15:27: the evening card is "the same prompt every day" that "audits
 * the work from sitting down to finishing; articulate changes in direction and
 * why, verify they make sense, add them to the projects". The evening card asks
 * SEVEN, in order: ACCOMPLISHED (the `audit` column) · GAPS · EVOLUTION ·
 * DIRECTION · ALIGNMENT · ON TRACK · NEXT. Five new Text columns, each the
 * audit's rule (blockOf); `learned` retires JOURNAL-03's way; "copy reflection
 * prompt" replaces "copy audit prompt" — a CONSTANT worded around the day's
 * data, THE BACKLOG, WHAT MOVED TODAY, THE ANSWERS and THE ASK; every writer
 * sends the whole row; the morning's "Last night:" line and the reel keep
 * reading `next`.
 *
 * T1 the migration · T2 the schema · T3 the rule's eleven and learned refused
 * by name · T4 THE EVENING'S QUESTIONS verbatim, in order, on the form · T5
 * THE ASK verbatim · T6 the prompt driven full · T7 the two reads and the
 * routes they read · T8 the card's gating and window · T9 every writer · T10
 * the reel and the morning's line still read next · T11 nothing else. The
 * ladder pins moved by one in thirteen files, each dated; journal01, journal02,
 * journal04, journal05 and reel02 pins moved to the eleven and the reflection
 * prompt, each dated.
 *
 * JOURNAL-06b (Alex, 2026-10-20): the audit read's cap is named —
 * AUDIT_READ_LIMIT, the route's own 500 (audit-log/route.ts:137) — and when the
 * read returns exactly that many rows, WHAT MOVED TODAY says so under its
 * counts (MOVED_CAP_WORDS). T6b pins a 500-row and a 499-row day.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  ANSWER_FIELDS, ANSWER_MAX, AUDIT_READ_LIMIT, BIDI_WORDS, BLOCK_MAX_LINES, CONTROLS_WORDS, COPY_REFLECTION_PROMPT_WORDS, EVENING_ALIGNMENT_QUESTION, EVENING_AUDIT_QUESTION,
  EVENING_DIRECTION_QUESTION, EVENING_EVOLUTION_QUESTION, EVENING_GAPS_QUESTION, EVENING_LABELS, EVENING_NEXT_QUESTION, EVENING_ON_TRACK_QUESTION, EVENING_ORDER,
  EVENING_QUESTIONS, MOVED_CAP_WORDS, MOVED_DESCRIBED_TYPES, NOTHING_TYPED_WORDS, NO_ANSWERS, REFLECTION_PROMPT_ANSWERS, REFLECTION_PROMPT_ASK, REFLECTION_PROMPT_BACKLOG,
  REFLECTION_PROMPT_COPIED_WORDS, REFLECTION_PROMPT_MOVED, REFLECTION_PROMPT_NOTHING_MOVED, REFLECTION_PROMPT_NOT_ANSWERED, REFLECTION_PROMPT_NO_BACKLOG, RETIRED_FIELDS,
  answerWords, answersOf, backlogOrder, backlogRowWords, journalInput, journalUnchanged, movedWords, notStringWords, reflectionPromptFailedWords, reflectionPromptText,
  reflectionPromptWaitsWords, retiredFieldWords, tooLongWords, tooManyLinesWords,
  type Answers, type BlockField, type EveningField, type JournalInputResult, type ReflectionBacklogRow, type ReflectionMovedRow, type ReflectionPromptInput,
} from '../operations/journal';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261020150000_journal_06_reflection';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const RULE = 'src/lib/operations/journal.ts';
const ROUTE = 'src/app/api/operations/journal/route.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const AUDIT_ROUTE = 'src/app/api/audit-log/route.ts';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const MORNING_FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const EVENING_FORM = 'src/components/workbench/operations/stops/EveningForm.tsx';
const WRITES = 'src/components/workbench/operations/stops/journalWrites.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const DAY = '2026-10-20';
const FIVE: readonly BlockField[] = ['gaps', 'evolution', 'direction', 'alignment', 'on_track'];

const accepted = (body: unknown): Answers => {
  const r = journalInput(body);
  assert.ok(r.ok, r.ok ? '' : `${r.field}: ${r.message}`);
  return r.ok ? r.value.answers : NO_ANSWERS;
};
const refused = (body: unknown): { field: string; message: string } => {
  const r: JournalInputResult = journalInput(body);
  assert.ok(!r.ok, 'expected a refusal');
  return r.ok ? { field: '', message: '' } : { field: r.field, message: r.message };
};
/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── T1 · THE MIGRATION ───────────────────────────────────────────────────────

test('T1 the migration: the newest; five nullable TEXT columns with no default; the evening not-blank CHECK DROPPED and re-ADDED in ONE statement over the eight; at-least-one DROPPED and re-ADDED in ONE statement, its last clause the eight; learned kept; no DROP COLUMN, no enum, no row', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // DOCUMENTS-02 (Alex, 2026-10-30): the reconciliation's supersession — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], MIGRATION_DIR, 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020160000_backlog_02_reranked', 'the migration before the newest (DOCUMENTS-01 followed)');
  // DOCUMENTS-01 (Alex, 2026-10-28): source_documents, the receipt on its posting — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261028120000_documents_01_source_documents', 'the migration before the newest (DOCUMENTS-02 followed)');
  assert.equal(dirs[dirs.length - 2], '20261030120000_documents_02_reconciliation_supersession', 'the migration before the newest (FX-01 followed)');
  // FX-01 (2026-10-30): the transactions currency migration followed — every pin above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261030150000_fx_01_transactions_currency', 'the newest migration');
  assert.equal(dirs[dirs.length - 6], '20261020140000_backlog_01b_brief', 'right after BACKLOG-01b’s');
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*ADD COLUMN "gaps"\s+TEXT,\n\s*ADD COLUMN "evolution" TEXT,\n\s*ADD COLUMN "direction" TEXT,\n\s*ADD COLUMN "alignment" TEXT,\n\s*ADD COLUMN "on_track"\s+TEXT;/, 'the five columns, nullable, no default');
  assert.doesNotMatch(sql, /NOT NULL|DEFAULT/, 'NULL is unanswered — no default, nothing required');
  // The evening's not-blank CHECK: ONE statement — DROP and ADD, the eight evening columns.
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*DROP CONSTRAINT "operations_day_journals_evening_not_blank",\n\s*ADD CONSTRAINT "operations_day_journals_evening_not_blank" CHECK \(\n\s*\("audit" IS NULL OR length\(btrim\("audit"\)\) > 0\)\n\s*AND \("learned" IS NULL OR length\(btrim\("learned"\)\) > 0\)\n\s*AND \("next" IS NULL OR length\(btrim\("next"\)\) > 0\)\n\s*AND \("gaps" IS NULL OR length\(btrim\("gaps"\)\) > 0\)\n\s*AND \("evolution" IS NULL OR length\(btrim\("evolution"\)\) > 0\)\n\s*AND \("direction" IS NULL OR length\(btrim\("direction"\)\) > 0\)\n\s*AND \("alignment" IS NULL OR length\(btrim\("alignment"\)\) > 0\)\n\s*AND \("on_track" IS NULL OR length\(btrim\("on_track"\)\) > 0\)\n\s*\);/);
  // The at-least-one CHECK: ONE statement — JOURNAL-02's expression verbatim, then the eight.
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*DROP CONSTRAINT "operations_day_journals_at_least_one",\n\s*ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n\s*num_nonnulls\("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped"\) >= 1\n\s*OR cardinality\("goals"\) > 0\n\s*OR cardinality\("plan_steps"\) > 0\n\s*OR num_nonnulls\("audit", "learned", "next", "gaps", "evolution", "direction", "alignment", "on_track"\) >= 1\n\s*\);/);
  const journal02 = code(`${MIGRATIONS}/20261013200000_journal_02_the_simple_journal/migration.sql`);
  const j02 = /ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n([\s\S]*?)\n\s*\);/.exec(journal02)![1];
  const j06 = /ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n([\s\S]*?)\n\s*\);/.exec(sql)![1];
  assert.equal(j06.trim().startsWith(j02.trim()), true, 'JOURNAL-02’s expression, verbatim, then the eight');
  assert.equal(j06.trim().slice(j02.trim().length).trim(), 'OR num_nonnulls("audit", "learned", "next", "gaps", "evolution", "direction", "alignment", "on_track") >= 1');
  assert.equal((sql.match(/\bDROP\b/g) ?? []).length, 2, 'the two DROPs are the two CHECKs being re-made');
  assert.doesNotMatch(sql, /DROP COLUMN/, 'nothing dropped — learned stays');
  assert.doesNotMatch(sql, /ALTER TYPE/, 'no enum value — operations_journal_set and _cleared cover the writes');
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no backfill, no row written');
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 3, 'three statements: the columns, the not-blank re-make, the at-least-one re-make');
  assert.doesNotMatch(sql, /(?<!")\bnext\b(?!")/, '"next" is quoted everywhere it appears');
  const head = comments(MIGRATION);
  assert.match(head, /JOURNAL-06 \(Alex, 2026-10-20\) — THE EVENING'S SIX QUESTIONS AND THE REFLECTION PROMPT\./);
  assert.match(head, /"learned" RETIRES \(JOURNAL-03's way\): its column STAYS, nullable, never\s*\n?--\s*written again/);
  assert.match(head, /NO BACKFILL, no row written/);
  assert.match(head, /applied at deploy after merge/);
  assert.match(head, /No DROP COLUMN/);
});

// ── T2 · THE SCHEMA ──────────────────────────────────────────────────────────

test('T2 the schema: the five after next, each String? @db.Text, documented; learned’s line stays with its retired note; the client generated with the five', () => {
  const model = /model operations_day_journals \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(model !== null);
  const m = model![1];
  assert.match(m, /\n\s+next\s+String\?\s+@db\.VarChar\(500\)\n\s+gaps\s+String\?\s+@db\.Text\n\s+evolution\s+String\?\s+@db\.Text\n\s+direction\s+String\?\s+@db\.Text\n\s+alignment\s+String\?\s+@db\.Text\n\s+on_track\s+String\?\s+@db\.Text\n\s+created_at/);
  assert.match(m, /\n\s+learned\s+String\?\s+@db\.VarChar\(500\)\n/, 'learned stays — a column, never dropped');
  const docs = comments(SCHEMA);
  assert.match(docs, /RETIRED 2026-10-20 \(JOURNAL-06, JOURNAL-03's way\): kept, never asked, shown or written again; a body that carries it is refused by name\./);
  assert.match(docs, /JOURNAL-06 \(Alex, 2026-10-20\): the evening's five, each the audit's rule \(a block — line breaks kept, 4000 code points and 200 lines, journal\.ts blockOf\), nullable — NULL is unanswered, never "" \(the not-blank CHECK, re-made over the eight\)\. The at-least-one CHECK counts them\./);
  const fields = Object.keys(Prisma.Operations_day_journalsScalarFieldEnum);
  for (const f of [...FIVE, 'learned', 'audit', 'next']) assert.ok(fields.includes(f), `prisma generate ran — the client knows ${f}`);
});

// ── T3 · THE RULE: ELEVEN ANSWERS, LEARNED REFUSED BY NAME ───────────────────

test('T3 the rule: ANSWER_MAX and ANSWER_FIELDS carry the five at the audit’s rule; learned left for RETIRED_FIELDS and a body carrying it (any value, null too) is refused by name with the retired words; answersOf drops it', () => {
  assert.deepEqual(ANSWER_MAX, { blocker: 280, audit: 4000, gaps: 4000, evolution: 4000, direction: 4000, alignment: 4000, on_track: 4000, next: 500 });
  assert.deepEqual(ANSWER_FIELDS, ['goals', 'blocker', 'plan_steps', 'plan_done', 'audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next']);
  assert.deepEqual(RETIRED_FIELDS.slice(-2), ['shipped', 'learned'], 'learned joined the retired, after shipped');
  assert.equal(RETIRED_FIELDS.length, 13);
  assert.deepEqual(NO_ANSWERS, { goals: [], blocker: null, plan_steps: [], plan_done: [], audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null });
  assert.match(code(RULE), /export type BlockField = 'audit' \| 'gaps' \| 'evolution' \| 'direction' \| 'alignment' \| 'on_track';/, 'the six blocks, by type');
  // learned: refused by name, before the answers, whatever it carries — the words say what to do.
  assert.equal(retiredFieldWords('learned'), 'learned is retired — it is no longer asked; reload the page');
  for (const value of ['x', '', null, 7]) assert.deepEqual(refused({ day: DAY, next: 'n', learned: value }), { field: 'learned', message: retiredFieldWords('learned') }, `learned: ${JSON.stringify(value)}`);
  assert.deepEqual(refused({ day: DAY, gaps: 'g'.repeat(4001), learned: 'x' }), { field: 'learned', message: retiredFieldWords('learned') }, 'the retired name first, before a bad block');
  assert.doesNotMatch(code(RULE), /\bb\.learned\b/, 'the rule reads no learned from the body');
  const a = answersOf({ audit: 'a', learned: 'l', gaps: 'g', next: 'n' } as unknown as Partial<Answers>);
  assert.deepEqual(a, { goals: [], blocker: null, plan_steps: [], plan_done: [], audit: 'a', gaps: 'g', evolution: null, direction: null, alignment: null, on_track: null, next: 'n' }, 'answersOf: the eleven, learned dropped like any other key');
  assert.equal(Object.hasOwn(a, 'learned'), false);
});

test('T3b the five are each the audit’s rule: present and clean with line breaks kept; absent, null and blank null; 4000 code points and 200 lines refused by name; a control refused; the order audit → gaps → evolution → direction → alignment → on_track → next; a block alone is a journal; a day blank everywhere is nothing typed', () => {
  for (const f of FIVE) {
    assert.equal(accepted({ day: DAY, [f]: '  line one  \n\n\n\n  line   two ' })[f], 'line one\n\nline two', `${f}: a block — trimmed per line, blank runs one break, line breaks kept`);
    assert.equal(accepted({ day: DAY, goals: ['g'] })[f], null, `${f}: absent is null`);
    assert.equal(accepted({ day: DAY, goals: ['g'], [f]: null })[f], null, `${f}: null is null`);
    assert.equal(accepted({ day: DAY, goals: ['g'], [f]: ' \n\t\n ' })[f], null, `${f}: blank is null — never ""`);
    assert.deepEqual(refused({ day: DAY, goals: ['g'], [f]: 7 }), { field: f, message: notStringWords(f) });
    assert.equal(accepted({ day: DAY, [f]: '😀'.repeat(4000) })[f], '😀'.repeat(4000), `${f}: 4000 code points fit`);
    assert.deepEqual(refused({ day: DAY, [f]: '😀'.repeat(4001) }), { field: f, message: tooLongWords(f, 4001) }, `${f}: counted in code points`);
    assert.equal(tooLongWords(f, 4001), `${f} is at most 4000 characters (4001 given)`);
    const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
    assert.equal(accepted({ day: DAY, [f]: lines(BLOCK_MAX_LINES) })[f]?.split('\n').length, 200);
    assert.deepEqual(refused({ day: DAY, [f]: lines(201) }), { field: f, message: tooManyLinesWords(f, 201) });
    assert.deepEqual(refused({ day: DAY, [f]: 'a\u0007b' }), { field: f, message: CONTROLS_WORDS }, `${f}: a bell`);
    assert.deepEqual(refused({ day: DAY, [f]: 'a\u202eb' }), { field: f, message: BIDI_WORDS }, `${f}: a bidi control`);
    // A block alone is a journal.
    const alone = accepted({ day: DAY, [f]: 'alone' });
    assert.deepEqual([alone.goals, alone.blocker, alone.plan_steps, alone.plan_done, alone.audit, alone.next], [[], null, [], [], null, null]);
    assert.equal(alone[f], 'alone');
  }
  // The order: the first bad field named, in the card's order.
  assert.equal(refused({ day: DAY, audit: 7, gaps: 7, evolution: 7, direction: 7, alignment: 7, on_track: 7, next: 7 }).field, 'audit');
  assert.equal(refused({ day: DAY, gaps: 7, evolution: 7, direction: 7, alignment: 7, on_track: 7, next: 7 }).field, 'gaps');
  assert.equal(refused({ day: DAY, evolution: 7, direction: 7, alignment: 7, on_track: 7, next: 7 }).field, 'evolution');
  assert.equal(refused({ day: DAY, direction: 7, alignment: 7, on_track: 7, next: 7 }).field, 'direction');
  assert.equal(refused({ day: DAY, alignment: 7, on_track: 7, next: 7 }).field, 'alignment');
  assert.equal(refused({ day: DAY, on_track: 7, next: 7 }).field, 'on_track');
  assert.equal(refused({ day: DAY, next: 7 }).field, 'next');
  assert.match(code(RULE), /const audit = blockOf\('audit', b\.audit\);[\s\S]*?const gaps = blockOf\('gaps', b\.gaps\);[\s\S]*?const evolution = blockOf\('evolution', b\.evolution\);[\s\S]*?const direction = blockOf\('direction', b\.direction\);[\s\S]*?const alignment = blockOf\('alignment', b\.alignment\);[\s\S]*?const on_track = blockOf\('on_track', b\.on_track\);[\s\S]*?const next = textOf\('next', b\.next\);/, 'each of the five through blockOf — the audit’s rule — in the card’s order, then next through textOf');
  // Nothing typed anywhere — the check reads all eleven.
  assert.deepEqual(refused({ day: DAY, audit: '', gaps: '  ', evolution: null, direction: '\n', alignment: '', on_track: '', next: '' }), { field: 'goals', message: NOTHING_TYPED_WORDS });
  const check = /if \(goals\.lines\.length === 0 [^\n]*NOTHING_TYPED_WORDS\);/.exec(code(RULE))![0];
  for (const f of ['audit', ...FIVE, 'next']) assert.match(check, new RegExp(`${f}\\.text === null`), `the nothing-typed check reads ${f}`);
  // journalUnchanged compares the eleven — each of the five changes a write.
  const held = answersOf({ goals: ['a'], audit: 'p', gaps: 'g', evolution: 'e', direction: 'd', alignment: 'al', on_track: 'o', next: 'n' });
  assert.equal(journalUnchanged(held, answersOf({ ...held })), true);
  for (const f of FIVE) assert.equal(journalUnchanged(held, answersOf({ ...held, [f]: `${held[f]}!` })), false, `${f} changed — a write`);
  for (const f of FIVE) assert.equal(journalUnchanged(held, answersOf({ ...held, [f]: null })), false, `${f} cleared — a write`);
  assert.match(code(RULE), /&& row\.gaps === answers\.gaps\n\s*&& row\.evolution === answers\.evolution\n\s*&& row\.direction === answers\.direction\n\s*&& row\.alignment === answers\.alignment\n\s*&& row\.on_track === answers\.on_track\n\s*&& row\.next === answers\.next;/);
});

// ── T4 · THE EVENING'S QUESTIONS, VERBATIM, IN ORDER, ON THE FORM ───────────

test('T4 THE EVENING’S QUESTIONS verbatim; seven, in the card’s order, each box labelled with its question from the rule; EVENING_LABELS the prompt’s names; learned has no box and no question anywhere', () => {
  assert.equal(EVENING_AUDIT_QUESTION, 'What got done today — the narrative. Copy the reflection prompt, paste the chat\'s narrative here.');
  assert.equal(EVENING_GAPS_QUESTION, 'What gaps do you see — what is missing, wrong, or not yet true?');
  assert.equal(EVENING_EVOLUTION_QUESTION, 'What changed in how we build today — a rule, a better way, something we stopped doing?');
  assert.equal(EVENING_DIRECTION_QUESTION, 'Going well, or change direction? Which, and why.');
  assert.equal(EVENING_ALIGNMENT_QUESTION, 'Is the chat doing anything not aligned with your vision? Name it.');
  assert.equal(EVENING_ON_TRACK_QUESTION, 'On the rails — accounting rules, SOC 2, the mission? Anything that bent?');
  assert.equal(EVENING_NEXT_QUESTION, 'Where do I want to take it next?');
  assert.deepEqual(EVENING_ORDER, ['audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next']);
  assert.deepEqual(EVENING_LABELS, { audit: 'ACCOMPLISHED', gaps: 'GAPS', evolution: 'EVOLUTION', direction: 'DIRECTION', alignment: 'ALIGNMENT', on_track: 'ON TRACK', next: 'NEXT' });
  assert.deepEqual(EVENING_ORDER.map((f) => EVENING_QUESTIONS[f]), [EVENING_AUDIT_QUESTION, EVENING_GAPS_QUESTION, EVENING_EVOLUTION_QUESTION, EVENING_DIRECTION_QUESTION, EVENING_ALIGNMENT_QUESTION, EVENING_ON_TRACK_QUESTION, EVENING_NEXT_QUESTION], 'the questions, in the order');
  assert.deepEqual(Object.keys(EVENING_QUESTIONS).sort(), [...EVENING_ORDER].sort(), 'a question for each of the seven and no other');
  assert.deepEqual([COPY_REFLECTION_PROMPT_WORDS, REFLECTION_PROMPT_COPIED_WORDS], ['copy reflection prompt', 'copied — paste it into Claude, then paste the narrative into ACCOMPLISHED']);
  assert.equal(reflectionPromptWaitsWords('reading the backlog…'), 'the reflection prompt needs the day\'s reads — reading the backlog…');
  assert.equal(reflectionPromptFailedWords('denied'), 'could not copy the reflection prompt — denied');
  // The form: one block per field of EVENING_ORDER, its label the question, its box named by the field; the copy button on ACCOMPLISHED alone.
  const e = code(EVENING_FORM);
  assert.match(e, /\{EVENING_ORDER\.map\(\(field\) => \(\n\s*<div key=\{field\} className="flex flex-col gap-0\.5" data-evening-block=\{field\}>/, 'the seven blocks from the rule’s order — never a retyped list');
  assert.match(e, /<label htmlFor=\{`evening-\$\{field\}`\} className=\{question\}>\{EVENING_QUESTIONS\[field\]\}<\/label>/, 'each box labelled with its question');
  assert.match(e, /<textarea id=\{`evening-\$\{field\}`\} rows=\{ROWS\[field\]\} value=\{draft\[field\]\} onChange=\{\(e\) => setDraft\(\{ \.\.\.draft, \[field\]: e\.target\.value \}\)\}/);
  assert.match(e, /type Draft = Readonly<Record<EveningField, string>>;/);
  assert.match(e, /Object\.fromEntries\(EVENING_ORDER\.map\(\(f\) => \[f, journal === null \|\| journal\[f\] === null \? '' : journal\[f\]\]\)\) as Draft;/, 'the draft from the held row, by the order');
  assert.doesNotMatch(e, /learned|LEARNED|'Where did we actually get to|'What did I learn/, 'no box, no question, no word for learned');
  assert.doesNotMatch(e, /EVENING_[A-Z_]+_QUESTION\b/, 'the form names no question by itself — EVENING_QUESTIONS[field] does');
  for (const f of [RULE, CARD, MORNING_FORM, EVENING_FORM, CARD_RULES, WRITES]) assert.doesNotMatch(code(f), /EVENING_LEARNED_QUESTION|LEARNED_WORD/, `${f}: learned’s question and word are gone`);
});

// ── T5 · THE ASK, VERBATIM ───────────────────────────────────────────────────

test('T5 THE ASK verbatim — a constant, the same every day; the section heads and the none words', () => {
  assert.equal(REFLECTION_PROMPT_ASK, [
    'REFLECT ON THIS DAY. Same prompt every day; the data above is today\'s. Return, in this order and nothing else:',
    '1 THE NARRATIVE — what got done, against the plan: stop by stop, PR by PR (you know the PRs; the app\'s audit slice is above), what did not get done and why it is likely so; where the money went against the budget. Written to be pasted into ACCOMPLISHED.',
    '2 THE GAPS, VERIFIED — for each gap I named, is it real, what is its cause, and what closes it. Add gaps I did not name.',
    '3 DIRECTION, VERIFIED — for each change of direction I named, does it make sense against the mandates (Truth-First, Security-First, the accounting rules, SOC 2, the mission)? Yes or no, and why. Then: anything you did today that was off my vision — name it plainly.',
    '4 NEXT PROJECTS / TASKS — for the days ahead. Each NEW project as one complete block in THE BRIEF FORMAT (TITLE: · TYPE: · BOOK: · SIZE: · TARGET: · WHAT IS WRONG TODAY · WHY IT MATTERS · THE ONE CORRECT OUTCOME · ALREADY RULED · WANT A RECOMMENDATION ON · BY WHEN, AND WHY · PROOF OF DONE · LINKS · NOTES), ready to paste. For EXISTING projects (listed above), the tasks to add, by project title, one line each. Rank what should come first and say why.',
    'Be specific and short. No praise, no filler. One truth.',
  ].join('\n'));
  assert.deepEqual([REFLECTION_PROMPT_BACKLOG, REFLECTION_PROMPT_NO_BACKLOG, REFLECTION_PROMPT_MOVED, REFLECTION_PROMPT_NOTHING_MOVED, REFLECTION_PROMPT_ANSWERS, REFLECTION_PROMPT_NOT_ANSWERED],
    ['THE BACKLOG', '— no open projects —', 'WHAT MOVED TODAY', '— nothing recorded —', 'THE ANSWERS', '— not answered —']);
  assert.match(code(RULE), /export const REFLECTION_PROMPT_ASK = \[\n[\s\S]*?\]\.join\('\\n'\);/, 'a constant — no day, no read, no argument');
  assert.doesNotMatch(code(RULE), /AUDIT_PROMPT_ASK|auditPromptText|AuditPromptInput|AuditPromptState|COPY_AUDIT_PROMPT_WORDS|AUDIT_PROMPT_COPIED_WORDS|auditPromptWaitsWords|auditPromptFailedWords/, 'the audit prompt’s names went with it — no alias');
});

// ── T6 · THE PROMPT, DRIVEN FULL ─────────────────────────────────────────────

const BACKLOG: readonly ReflectionBacklogRow[] = [
  { rank: 2, title: 'Fix the ledger CSV', type: 'engineering', status: 'backlog', size: 'M', target: '2026-11-30', openTasks: 2 },
  { rank: null, title: 'Write the SOC 2 narrative', type: null, status: 'scoped', size: null, target: null, openTasks: 0 },
  { rank: 1, title: 'Reel kit', type: 'content', status: 'in_progress', size: 'S', target: '2026-10-25', openTasks: 3 },
  { rank: null, title: 'Book travel', type: 'life', status: 'blocked', size: 'XS', target: null, openTasks: 1 },
];
const MOVED: readonly ReflectionMovedRow[] = [
  { action_type: 'operations_project_created', description: 'Project "Reel kit" created' },
  { action_type: 'operations_project_status_changed', description: 'Project "Reel kit": backlog → in_progress' },
  { action_type: 'operations_project_created', description: 'Project "Fix the ledger CSV" created' },
  { action_type: 'operations_project_task_status_changed', description: 'Task "move the pins": open → in_progress' },
  { action_type: 'operations_project_task_completed', description: 'Task "move the pins": in_progress → completed' },
  { action_type: 'operations_journal_set', description: 'Journal set for 2026-10-20' },
];
const INPUT: ReflectionPromptInput = {
  dayWords: 'Tue Oct 20',
  journal: answersOf({ goals: ['ship JOURNAL-06'], blocker: null, plan_steps: ['write the migration', 'move the pins'], plan_done: [true, false], audit: 'Shipped it.\n\nThe pins moved.', gaps: 'the browser pass\nis not run', evolution: null, direction: 'keep going', alignment: null, on_track: 'yes', next: 'the browser pass' }),
  stops: [{ name: 'Journal', vendor: null, asksAmount: false, outcomeWords: 'done' }, { name: 'Brunch', vendor: 'Luka Café', asksAmount: true, budgetWords: '$25', actualWords: '$22 ▼ $3' }],
  budgetWords: '$25',
  actualWords: '$22',
  verdictWords: '▼ $3 under',
  backlog: BACKLOG,
  moved: MOVED,
};

test('T6 reflectionPromptText — the day’s lines, THE BACKLOG in rank order (unranked last, then by title) one line each, WHAT MOVED TODAY (counts per type, then each status change), THE ANSWERS (six, as saved or not answered), THE ASK last; every line a constant or built from one', () => {
  assert.equal(reflectionPromptText(INPUT), [
    'Day: Tue Oct 20',
    'Goals:',
    '- ship JOURNAL-06',
    'Blocker: none',
    'Plan — steps and ticks:',
    '- ✓ write the migration',
    '- ✗ move the pins',
    'Stops — budget vs actual:',
    '- Journal — done',
    '- Brunch at Luka Café — budget $25, actual $22 ▼ $3',
    'Totals: budget $25, actual $22, ▼ $3 under',
    '',
    'THE BACKLOG',
    '- #1 · Reel kit · content · in_progress · S · target 2026-10-25 · open tasks 3',
    '- #2 · Fix the ledger CSV · engineering · backlog · M · target 2026-11-30 · open tasks 2',
    '- #— · Book travel · life · blocked · XS · target — · open tasks 1',
    '- #— · Write the SOC 2 narrative · — · scoped · — · target — · open tasks 0',
    '',
    'WHAT MOVED TODAY',
    '- operations_journal_set × 1',
    '- operations_project_created × 2',
    '- operations_project_status_changed × 1',
    '- operations_project_task_completed × 1',
    '- operations_project_task_status_changed × 1',
    '- Project "Reel kit": backlog → in_progress',
    '- Task "move the pins": open → in_progress',
    '- Task "move the pins": in_progress → completed',
    '',
    'THE ANSWERS',
    'GAPS: the browser pass\nis not run',
    'EVOLUTION: — not answered —',
    'DIRECTION: keep going',
    'ALIGNMENT: — not answered —',
    'ON TRACK: yes',
    'NEXT: the browser pass',
    '',
    REFLECTION_PROMPT_ASK,
  ].join('\n'));
  // The pieces.
  assert.equal(backlogRowWords(BACKLOG[0]), '#2 · Fix the ledger CSV · engineering · backlog · M · target 2026-11-30 · open tasks 2');
  assert.equal(backlogRowWords(BACKLOG[1]), '#— · Write the SOC 2 narrative · — · scoped · — · target — · open tasks 0', '"—" for a rank, type, size or target not set');
  assert.deepEqual(backlogOrder(BACKLOG).map((p) => p.title), ['Reel kit', 'Fix the ledger CSV', 'Book travel', 'Write the SOC 2 narrative'], 'rank order, unranked last, then by title');
  assert.deepEqual(backlogOrder([]), []);
  assert.deepEqual(MOVED_DESCRIBED_TYPES, ['operations_project_status_changed', 'operations_project_task_status_changed', 'operations_project_task_completed'], 'the three status-change types the routes write (projects/[id] and tasks/[taskId])');
  assert.deepEqual(movedWords([]), ['- — nothing recorded —']);
  assert.deepEqual(movedWords([{ action_type: 'operations_project_created', description: 'Project "x" created' }]), ['- operations_project_created × 1'], 'a creation is counted, not described');
  assert.equal(answerWords('gaps', null), 'GAPS: — not answered —');
  assert.equal(answerWords('on_track', 'yes'), 'ON TRACK: yes');
  // The empties, by name — nothing invented.
  const empty = reflectionPromptText({ ...INPUT, journal: null, stops: [], verdictWords: null, backlog: [], moved: [] });
  inOrder(empty, ['Goals:\n- none typed', 'Blocker: none', 'Plan — steps and ticks:\n- no plan', 'Stops — budget vs actual:\n- no stops', 'Totals: budget $25, actual $22\n', '\nTHE BACKLOG\n- — no open projects —\n', '\nWHAT MOVED TODAY\n- — nothing recorded —\n', '\nTHE ANSWERS\nGAPS: — not answered —\nEVOLUTION: — not answered —\nDIRECTION: — not answered —\nALIGNMENT: — not answered —\nON TRACK: — not answered —\nNEXT: — not answered —\n', `\n${REFLECTION_PROMPT_ASK}`], 'the empties');
  // The same every day by construction: the ask closes every prompt, verbatim; the order of the backlog does not depend on how the rows arrive.
  for (const text of [reflectionPromptText(INPUT), empty]) assert.ok(text.endsWith(`\n\n${REFLECTION_PROMPT_ASK}`), 'THE ASK last, verbatim');
  assert.equal(reflectionPromptText({ ...INPUT, backlog: [...BACKLOG].reverse() }), reflectionPromptText(INPUT), 'the builder sorts the backlog itself');
  // ACCOMPLISHED is not printed back — the chat writes it; the six after it are.
  assert.doesNotMatch(reflectionPromptText(INPUT), /ACCOMPLISHED: |Shipped it\./);
  assert.match(code(RULE), /\.\.\.EVENING_ORDER\.filter\(\(f\) => f !== 'audit'\)\.map\(\(f\) => answerWords\(f, answered\(f\)\)\),/);
  // Pure.
  const rule = code(RULE);
  assert.doesNotMatch(rule, /\bfetch\b|@prisma\/client|from 'react'|from 'next|navigator\.|day\/dayCard|dayReads/, 'journal.ts reads nothing and knows nothing of the card');
  assert.match(rule, /export function reflectionPromptText\(input: ReflectionPromptInput\): string \{/);
});

// ── T6b · JOURNAL-06b: THE AUDIT READ'S CAP, NAMED WHEN IT IS HIT ───────────

/** A day of `n` audit rows: one project status change, one journal write, the rest project creations — the counts the route would answer. */
const movedDay = (n: number): ReflectionMovedRow[] => [
  { action_type: 'operations_project_status_changed', description: 'Project "Reel kit": backlog → in_progress' },
  { action_type: 'operations_journal_set', description: 'Journal set for 2026-10-20' },
  ...Array.from({ length: n - 2 }, (_, i) => ({ action_type: 'operations_project_created', description: `Project "p${i}" created` })),
];

test('T6b JOURNAL-06b the cap: AUDIT_READ_LIMIT is the route’s own 500 and the read asks for it; a 500-row day prints the cap line under the counts, before the descriptions; a 499-row day prints none', () => {
  // The constant is the route's cap, read from the route (audit-log/route.ts:137) — one number, two homes, pinned equal.
  assert.equal(AUDIT_READ_LIMIT, 500);
  const cap = /const limit = Math\.min\(Math\.max\(parseInt\(limitParam \|\| '100', 10\) \|\| 100, 1\), (\d+)\);/.exec(code(AUDIT_ROUTE));
  assert.ok(cap !== null, 'the route sets its cap in one line');
  assert.equal(Number(cap![1]), AUDIT_READ_LIMIT, 'AUDIT_READ_LIMIT is the route’s cap');
  assert.match(code(READS), /limit: String\(AUDIT_READ_LIMIT\) \}\);/, 'the read asks for exactly the cap — a full read is exactly AUDIT_READ_LIMIT rows');
  assert.match(comments(RULE), /src\/app\/api\/audit-log\/route\.ts:137/, 'the constant cites where the cap is set');
  // The words, verbatim, built from the constant.
  assert.equal(MOVED_CAP_WORDS, '— the read stops at 500 rows; today has at least 500, so these counts may be short —');
  assert.match(code(RULE), /export const MOVED_CAP_WORDS = `— the read stops at \$\{AUDIT_READ_LIMIT\} rows; today has at least \$\{AUDIT_READ_LIMIT\}, so these counts may be short —`;/, 'the 500 is the constant, never typed twice');
  // 500 rows: the counts, then the cap line, then the status change.
  const full = movedDay(500);
  assert.equal(full.length, 500);
  assert.deepEqual(movedWords(full), [
    '- operations_journal_set × 1',
    '- operations_project_created × 498',
    '- operations_project_status_changed × 1',
    '— the read stops at 500 rows; today has at least 500, so these counts may be short —',
    '- Project "Reel kit": backlog → in_progress',
  ]);
  const fullText = reflectionPromptText({ ...INPUT, moved: full });
  inOrder(fullText, ['\nWHAT MOVED TODAY\n', '- operations_project_status_changed × 1\n', `${MOVED_CAP_WORDS}\n`, '- Project "Reel kit": backlog → in_progress\n', '\nTHE ANSWERS\n'], 'the cap line sits under the counts, before the descriptions');
  assert.equal(fullText.split(MOVED_CAP_WORDS).length, 2, 'once');
  // 499 rows: no line.
  const short = movedDay(499);
  assert.equal(short.length, 499);
  assert.deepEqual(movedWords(short), [
    '- operations_journal_set × 1',
    '- operations_project_created × 497',
    '- operations_project_status_changed × 1',
    '- Project "Reel kit": backlog → in_progress',
  ]);
  assert.equal(reflectionPromptText({ ...INPUT, moved: short }).includes(MOVED_CAP_WORDS), false, 'a 499-row day is whole — no cap line');
  assert.equal(reflectionPromptText(INPUT).includes(MOVED_CAP_WORDS), false, 'nor on the fixture day');
  assert.deepEqual(movedWords([]), ['- — nothing recorded —'], 'an empty day unchanged');
  assert.match(code(RULE), /if \(rows\.length === AUDIT_READ_LIMIT\) lines\.push\(MOVED_CAP_WORDS\);/, 'exactly the cap — the route never answers more');
});

// ── T7 · THE TWO READS AND THE ROUTES THEY READ ──────────────────────────────

test('T7 the two reads (dayReads.ts): THE BACKLOG from the projects GET — the not-done statuses (BACKLOG-02b: six, not_started among them), title and open_task_count required, sorted by the rule; WHAT MOVED TODAY from the audit log — prefix operations_, after/before, limit 500, oldest first; the projects GET counts open tasks; the audit route’s operations_ list carries the described types', () => {
  const r = code(READS);
  // BACKLOG-02 (Alex, 2026-10-20): the five statuses have one home, morningLog.ts OPEN_PROJECT_STATUSES (THE LOG's) — the pin moved there, as exact.
  assert.match(r, /export const BACKLOG_STATUSES: readonly string\[\] = OPEN_PROJECT_STATUSES;/, 'projects not done — done and cancelled are not the backlog');
  // BACKLOG-02b (Alex, 2026-10-20): not_started joined the set — THE BACKLOG lists it (backlog02.test.ts T10); the pin moved with it, as exact.
  assert.match(code('src/lib/operations/morningLog.ts'), /export const OPEN_PROJECT_STATUSES = \['backlog', 'scoped', 'scheduled', 'in_progress', 'blocked', 'not_started'\] as const;/);
  assert.match(r, /export const BACKLOG_READ_NAME = 'the backlog';\nexport const MOVED_READ_NAME = 'what moved today';/);
  // BACKLOG-02 (2026-10-20): the same read is THE LOG's — its rows are LogProject (a ReflectionBacklogRow plus id, book and open tasks); the pin moved with it.
  // WORK-02 (Alex, 2026-10-26): THE WORK BLOCK — on an execute stop the card lists the open tasks to tick and the tasks done inside the block by completed_at; the backlog read is the same read, asked with the day's bounds on a day with an execute stop (work02.test.ts). The read takes an optional window; without one it asks the same URL.
  assert.match(r, /export async function readBacklog\(done: BlockWindow \| null = null\): Promise<Read<readonly LogProject\[\]>> \{\n\s*const read = await readJson\(done === null \? '\/api\/operations\/projects' : /);
  inOrder(r, ["if (typeof p.status !== 'string' || !BACKLOG_STATUSES.includes(p.status)) continue;", "if (typeof p.title !== 'string' || typeof p.open_task_count !== 'number') return { ok: false, words: backlogFailedWords('a project came back without its title or its open-task count') };", "rank: typeof p.rank === 'number' ? p.rank : null,", "target: typeof p.target_completion_date === 'string' ? p.target_completion_date.slice(0, 10) : null,", 'openTasks: p.open_task_count,', 'return { ok: true, value: backlogOrder(rows) };'], 'readBacklog — a row without its facts is a failure in words, never a row with "0" invented');
  // JOURNAL-06b (Alex, 2026-10-20): the limit is the named cap (AUDIT_READ_LIMIT, T6b) — the pin moved with it, as exact.
  assert.match(r, /export async function readMovedToday\(after: Date, before: Date\): Promise<Read<readonly ReflectionMovedRow\[\]>> \{\n\s*const query = new URLSearchParams\(\{ prefix: 'operations_', after: after\.toISOString\(\), before: before\.toISOString\(\), limit: String\(AUDIT_READ_LIMIT\) \}\);\n\s*const read = await readJson\(`\/api\/audit-log\?\$\{query\.toString\(\)\}`\);/);
  // FOUND in the browser (2026-10-20): the audit_log column is action_description — a reader naming `description` fails every day; pinned on the column's name.
  inOrder(r, ["if (typeof r.action_type !== 'string' || typeof r.action_description !== 'string') return { ok: false, words: movedFailedWords('a row came back without its action type or description') };", 'rows.push({ action_type: r.action_type, description: r.action_description });', 'return { ok: true, value: rows.reverse() };'], 'readMovedToday — the route answers newest first; the prompt reads oldest first');
  assert.match(code(SCHEMA), /\n\s+action_description String\s+@db\.Text\n/, 'the column the reader names');
  assert.match(code(AUDIT_ROUTE), /const serialized = rows\.map\(\(r\) => \(\{\n\s*\.\.\.r,/, 'the route answers the rows as stored — action_description, not description');
  assert.doesNotMatch(r, /catch \(|\?\? \[\]|\?\? 0|\?\? ''/, 'no silent catch, no invented value');
  // The projects GET: open_task_count — tasks not done, grouped once; reads existing data, no migration.
  const p = code(PROJECTS_ROUTE);
  assert.match(p, /await prisma\.operations_project_tasks\.groupBy\(\{\n\s*by: \['project_id'\],\n\s*where: \{ project_id: \{ in: projectIds \}, status: \{ in: \['open', 'in_progress', 'blocked', 'pending_review'\] \} \},\n\s*_count: \{ _all: true \},\n\s*\}\)/);
  assert.match(p, /open_task_count: openCountByProject\.get\(p\.id\) \?\? 0,/, 'a project with no group row has no open task — zero is its count');
  assert.match(comments(PROJECTS_ROUTE), /JOURNAL-06 \(Alex, 2026-10-20\): open_task_count — a project's tasks NOT DONE/);
  // The audit route: the operations_ prefix list carries what the prompt counts and describes; after and before bound created_at (before inclusive).
  const a = code(AUDIT_ROUTE);
  const list = /operations_: \[([\s\S]*?)\n\s*\],/.exec(a)![1];
  for (const t of ['operations_project_created', ...MOVED_DESCRIBED_TYPES, 'operations_journal_set']) assert.match(list, new RegExp(`'${t}'`), `the operations_ list carries ${t}`);
  // The described types are the ones the routes write on a status change — never a name the enum does not hold.
  assert.match(code('src/app/api/operations/projects/[id]/route.ts'), /type: statusChange \? 'operations_project_status_changed' : 'operations_project_updated',/);
  assert.match(code('src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts'), /actionType = 'operations_project_task_completed';[\s\S]*?actionType = 'operations_project_task_status_changed';/);
  assert.match(a, /if \(after\) where\.created_at\.gte = new Date\(after\);\n\s*if \(before\) where\.created_at\.lte = new Date\(before\);/, 'the window — which is why the card ends it one millisecond before the next midnight');
});

// ── T8 · THE CARD: THE WINDOW, THE GATING, THE FORM ─────────────────────────

test('T8 the card: the two reads kept with their day, read on a day with a journal stop and again after a write; the window is the day’s midnight to the next in the viewer’s zone (zonedToInstant), ending one millisecond before; the prompt waits on every read and names a failed one; built from the STORED row; the evening form gets reflectionPrompt; the plate shows ACCOMPLISHED and NEXT', () => {
  const c = code(CARD);
  assert.match(c, /import \{ zonedToInstant \} from '@\/lib\/time';/);
  // BACKLOG-02 (Alex, 2026-10-20): the backlog's rows are LogProject (THE LOG's), and THE LOG's re-read counter sits between the two — the pin moved with it, as exact.
  assert.match(c, /const \[backlog, setBacklog\] = useState<\{ readonly day: string; readonly read: Read<readonly LogProject\[\]> \} \| null>\(null\);\n\s*const \[logReads, setLogReads\] = useState\(0\);\n\s*const \[moved, setMoved\] = useState<\{ readonly day: string; readonly read: Read<readonly ReflectionMovedRow\[\]> \} \| null>\(null\);/);
  // BACKLOG-02 (Alex, 2026-10-20): both reads re-read after a write from THE LOG too (logReads) — the two pins below moved with it, as exact.
  // WORK-02 (Alex, 2026-10-26): THE WORK BLOCK — on an execute stop the card lists the open tasks to tick and the tasks done inside the block by completed_at; the backlog read is the same read, asked with the day's bounds on a day with an execute stop (work02.test.ts). The gate is a journal OR an execute stop; the window is passed only for an execute stop.
  assert.match(c, /if \(day === null \|\| !\(hasJournalStop \|\| hasExecuteStop\)\) return;\n\s*const doneWindow = hasExecuteStop && zone !== null \? dayWindowOf\(day, zone\) : null;\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const b = await readBacklog\(doneWindow\);\n\s*if \(live\) setBacklog\(\{ day, read: b \}\);\n\s*\}\)\(\);\n\s*return \(\) => \{ live = false; \};\n\s*\}, \[day, zone, hasJournalStop, hasExecuteStop, journalReads, recordReads, dayWrites, logReads\]\);/, 'the backlog — again after any write the card knows of');
  assert.match(c, /if \(day === null \|\| zone === null \|\| !hasJournalStop\) return;\n\s*const after = zonedToInstant\(day, '00:00', zone\);\n\s*const before = new Date\(zonedToInstant\(shiftDay\(day, 1\), '00:00', zone\)\.getTime\(\) - 1\);\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const m = await readMovedToday\(after, before\);\n\s*if \(live\) setMoved\(\{ day, read: m \}\);\n\s*\}\)\(\);\n\s*return \(\) => \{ live = false; \};\n\s*\}, \[day, zone, hasJournalStop, journalReads, recordReads, dayWrites, logReads\]\);/, 'what moved — the day window in the viewer’s zone');
  assert.match(c, /const backlogRead = backlog !== null && backlog\.day === day \? backlog\.read : null;\n\s*const movedRead = moved !== null && moved\.day === day \? moved\.read : null;\n\s*const dayWait = reelReadsWords\(reelReads\);/);
  assert.match(c, /const reflectionPrompt: ReflectionPromptState = \(\(\) => \{\n\s*if \(dayWait !== null\) return \{ ok: false, words: reflectionPromptWaitsWords\(dayWait\) \};\n\s*if \(backlogRead !== null && !backlogRead\.ok\) return \{ ok: false, words: reflectionPromptWaitsWords\(backlogRead\.words\) \};\n\s*if \(movedRead !== null && !movedRead\.ok\) return \{ ok: false, words: reflectionPromptWaitsWords\(movedRead\.words\) \};\n\s*if \(backlogRead === null \|\| movedRead === null\) \{\n\s*return \{ ok: false, words: reflectionPromptWaitsWords\(reelWaitingWords\(\[\.\.\.\(backlogRead === null \? \[BACKLOG_READ_NAME\] : \[\]\), \.\.\.\(movedRead === null \? \[MOVED_READ_NAME\] : \[\]\)\]\)\) \};\n\s*\}\n\s*return \{ ok: true, text: reflectionPromptText\(\{/, 'a failed read named, a waiting one waited on — never a partial prompt');
  inOrder(c, ['return { ok: true, text: reflectionPromptText({', 'dayWords: dayShortWords(day),', 'journal: reelJournal,', 'backlog: backlogRead.value,', 'moved: movedRead.value,', '}) };\n  })();'], 'the stored row (reelJournal — the journal as read), the two reads as read');
  assert.match(c, /const reelJournal = journalRead !== null && journalRead\.ok \? journalRead\.value\.journal : null;/, 'THE ANSWERS print from the stored row — the form copies, it does not build');
  assert.match(c, /<EveningForm key=\{`\$\{day\}:\$\{journalRead\.value\.journal === null \? 'none' : journalRead\.value\.journal\.id\}`\} day=\{day\} journal=\{journalRead\.value\.journal\} reflectionPrompt=\{reflectionPrompt\} onChanged=\{\(\) => setJournalReads\(\(n\) => n \+ 1\)\} \/>/);
  assert.doesNotMatch(c, /auditPrompt|AuditPromptState|auditWait|LEARNED_WORD|data-day-evening-learned|row\.learned/, 'the audit prompt and learned left the card');
  const plate = c.slice(c.indexOf('function EveningPlate('), c.indexOf('export default function DayCard()'));
  inOrder(plate, ['data-day-evening-audit>', '{AUDIT_WORD}', 'data-day-evening-audit-words>{answer(row === null ? null : row.audit)}', 'data-day-evening-next>', '{NEXT_WORD}', 'data-day-evening-next-words>{answer(row === null ? null : row.next)}'], 'ACCOMPLISHED then NEXT, nothing between');
  assert.doesNotMatch(plate, /row\.(gaps|evolution|direction|alignment|on_track)\b/, 'the five are the form’s alone — the plate does not repeat them');
  // The evening form: no fetch of its own; the prompt arrives built; copy is the PLAN-01 shape.
  const e = code(EVENING_FORM);
  assert.match(e, /export default function EveningForm\(\{ day, journal, reflectionPrompt, onChanged \}: \{\n\s*day: string; journal: JournalRow \| null; reflectionPrompt: ReflectionPromptState; onChanged: \(\) => void;\n\}\)/);
  assert.doesNotMatch(e, /readBacklog|readMovedToday|reflectionPromptText|\bfetch\s*\(|\/api\//, 'the form builds no prompt and reads no route');
  assert.match(e, /await navigator\.clipboard\.writeText\(reflectionPrompt\.text\);/);
});

// ── T9 · EVERY WRITER SENDS THE WHOLE ROW ────────────────────────────────────

test('T9 every writer sends the whole row — the evening form the seven from its boxes, the morning form and the tick the seven as held — through the one rule and the one writer; the route writes Answers whole; no body carries learned', () => {
  assert.match(code(EVENING_FORM), /const read = journalInput\(\{ day, goals: journal === null \? \[\] : journal\.goals, blocker: journal === null \? null : journal\.blocker, plan_steps: journal === null \? \[\] : journal\.plan_steps, plan_done: journal === null \? \[\] : journal\.plan_done, audit: draft\.audit, gaps: draft\.gaps, evolution: draft\.evolution, direction: draft\.direction, alignment: draft\.alignment, on_track: draft\.on_track, next: draft\.next \}\);/, 'the evening form: the morning’s four as held, the seven from the boxes');
  assert.match(code(MORNING_FORM), /const read = journalInput\(\{ day, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: draft\.blocker === '' \? null : draft\.blocker, plan_steps: steps, plan_done: ticks, audit: journal === null \? null : journal\.audit, gaps: journal === null \? null : journal\.gaps, evolution: journal === null \? null : journal\.evolution, direction: journal === null \? null : journal\.direction, alignment: journal === null \? null : journal\.alignment, on_track: journal === null \? null : journal\.on_track, next: journal === null \? null : journal\.next \}\);/, 'the morning form: the seven as held');
  assert.match(code(CARD), /const read = journalInput\(\{ day, \.\.\.answersOf\(row\), plan_done: row\.plan_done\.map\(\(d, j\) => \(j === i \? !d : d\)\) \}\);/, 'the tick: the whole row as held (answersOf — the eleven) with one flag flipped');
  assert.match(code(WRITES), /body: JSON\.stringify\(\{ day, \.\.\.answers \}\),/, 'the one writer PUTs the answers whole');
  assert.match(code(ROUTE), /data: answers \}\)\);/, 'the route writes Answers whole — the five ride `data` with the rest');
  for (const f of [EVENING_FORM, MORNING_FORM, CARD, WRITES, ROUTE]) assert.doesNotMatch(code(f).replace("'@/lib/audit/writeAuditLog'", ''), /\blearned\b/, `${f} names learned nowhere`);
  // Driven through the rule, as the forms build the bodies: a morning save over an evening keeps the five; an evening save over a morning keeps the four.
  const evening = accepted({ day: DAY, goals: ['g'], blocker: null, plan_steps: ['s'], plan_done: [false], audit: 'A', gaps: 'G', evolution: '', direction: 'D', alignment: '', on_track: 'O', next: 'N' });
  const morning = accepted({ day: DAY, goals: ['g', 'h'], blocker: 'b', plan_steps: ['s'], plan_done: [true], audit: evening.audit, gaps: evening.gaps, evolution: evening.evolution, direction: evening.direction, alignment: evening.alignment, on_track: evening.on_track, next: evening.next });
  assert.deepEqual([morning.audit, morning.gaps, morning.evolution, morning.direction, morning.alignment, morning.on_track, morning.next], ['A', 'G', null, 'D', null, 'O', 'N'], 'the morning save keeps the evening’s seven');
  const tick = accepted({ day: DAY, ...answersOf(morning), plan_done: [false] });
  assert.deepEqual([tick.gaps, tick.direction, tick.on_track, tick.goals, tick.plan_done], ['G', 'D', 'O', ['g', 'h'], [false]], 'the tick keeps them');
  assert.match(comments(MORNING_FORM), /JOURNAL-06 \(Alex, 2026-10-20\): the evening's SEVEN ride AS HELD — audit, gaps, evolution, direction,\s*\n\s*\*\s*alignment, on_track and next \(learned retired/);
});

// ── T10 · THE MORNING'S LINE AND THE REEL STILL READ NEXT ───────────────────

test('T10 the morning’s "Last night:" line and the reel keep reading next; neither reads the five or learned', () => {
  const c = code(CARD);
  assert.match(c, /yRow\.next !== null && <div className="font-semibold text-text-primary break-words" style=\{plateLine\} data-day-yesterday-next>\{lastNightWords\(yRow\.next\)\}<\/div>/, 'last night’s next, as JOURNAL-05 printed it');
  const r = code(CARD_RULES);
  assert.match(r, /readonly journal: Pick<Answers, 'goals' \| 'blocker' \| 'next'> \| null;/, 'the reel reads goals, blocker and next');
  assert.match(r, /d\.journal\.next/);
  assert.doesNotMatch(r, /\.(gaps|evolution|direction|alignment|on_track|learned|audit)\b/, 'the reel reads none of the blocks');
  assert.doesNotMatch(r, /reflectionPrompt|EveningForm|readBacklog|readMovedToday/, 'dayCard.ts (the reel text) untouched by the prompt');
});

// ── T11 · NOTHING ELSE ───────────────────────────────────────────────────────

test('T11 nothing else: the route unchanged in code; the law names neither form; the week, the ledger and the deck know nothing of the five', () => {
  assert.doesNotMatch(code(ROUTE), /\b(gaps|evolution|direction|alignment|on_track)\b/, 'the route names no field — the row is written from Answers whole');
  assert.doesNotMatch(code(LAW), /EveningForm|EveningPlate|reflectionPrompt/);
  for (const f of ['src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/components/workbench/operations/stops/DayDeck.tsx', 'src/components/workbench/operations/stops/StopForm.tsx', 'src/components/workbench/operations/week/weekReads.ts']) {
    assert.doesNotMatch(code(f), /reflectionPrompt|readBacklog|readMovedToday|on_track/, `${f} knows nothing of the prompt`);
  }
  assert.match(comments(RULE), /JOURNAL-06 \(Alex, 2026-10-20\) — THE EVENING'S SIX QUESTIONS AND THE\s*\n\s*\*\s*REFLECTION PROMPT\./);
  const seven: readonly EveningField[] = EVENING_ORDER;
  assert.equal(seven.length, 7);
});
