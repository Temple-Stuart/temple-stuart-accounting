/**
 * journal04.test.ts — JOURNAL-04 (Alex, 2026-10-19): THE EVENING'S THREE ANSWERS — audit · learned · next.
 *
 * One additive migration (three nullable columns, the evening's not-blank
 * CHECK, the at-least-one CHECK re-made in ONE statement as JOURNAL-02's
 * expression OR the three — an evening alone is a journal), the schema's three
 * lines, the rule carrying seven answers (audit a BLOCK whose line breaks are
 * kept; learned and next texts), and the route unchanged in code: PUT writes
 * Answers whole, so a body carrying the three stores them and a body without
 * them stores NULL for them — so every writer sends the whole row as held: the
 * cards (decision 6), and, by the amendment the same day, the plate's tick and
 * the form's save (T7). No card yet; no words on a page.
 *
 * The migration-order pins moved by one in journal01, journal02, move01,
 * retro01, role01, routine02b, stay01, stop01, tasksOne02 and week02, each
 * dated; the shape pins in journal01 and journal02 moved to seven answers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  ANSWER_FIELDS, ANSWER_MAX, BIDI_WORDS, BLOCK_MAX_LINES, CONTROLS_WORDS, NOTHING_TYPED_WORDS, NO_ANSWERS, RETIRED_FIELDS,
  answersOf, journalInput, journalRowOf, journalUnchanged, notStringWords, retiredFieldWords, tooLongWords, tooManyLinesWords,
  type Answers, type JournalInputResult,
} from '../operations/journal';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261019210000_journal_04_evening_answers';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const RULE = 'src/lib/operations/journal.ts';
const ROUTE = 'src/app/api/operations/journal/route.ts';
const FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const DAY = '2026-10-19';

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

// ── T1 · THE MIGRATION ───────────────────────────────────────────────────────

test('T1 the migration: the newest; three nullable columns with no default; the evening not-blank CHECK; at-least-one re-made in ONE statement as JOURNAL-02’s OR the three; no DROP COLUMN, no enum, no row; the header says so', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 2], MIGRATION_DIR, 'the migration before the newest (LEDGER-03 followed)');
  // LEDGER-03 (Alex, 2026-10-19): two audit values for the planned-item link — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261019230000_ledger_03_planned_item_link_audit', 'the newest migration');
  assert.equal(dirs[dirs.length - 3], '20261019090000_move_01_moved_audit_type', 'right after MOVE-01’s');
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*ADD COLUMN "audit"\s+TEXT,\n\s*ADD COLUMN "learned" VARCHAR\(500\),\n\s*ADD COLUMN "next"\s+VARCHAR\(500\);/, 'the three columns, nullable, no default');
  assert.doesNotMatch(sql, /NOT NULL|DEFAULT/, 'NULL is unanswered — no default, nothing required');
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_evening_not_blank" CHECK \(\n\s*\("audit" IS NULL OR length\(btrim\("audit"\)\) > 0\)\n\s*AND \("learned" IS NULL OR length\(btrim\("learned"\)\) > 0\)\n\s*AND \("next" IS NULL OR length\(btrim\("next"\)\) > 0\)\n\s*\);/);
  // The at-least-one CHECK: dropped and re-added in ONE statement — JOURNAL-02's expression, then OR the three.
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*DROP CONSTRAINT "operations_day_journals_at_least_one",\n\s*ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n\s*num_nonnulls\("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped"\) >= 1\n\s*OR cardinality\("goals"\) > 0\n\s*OR cardinality\("plan_steps"\) > 0\n\s*OR num_nonnulls\("audit", "learned", "next"\) >= 1\n\s*\);/);
  const journal02 = code(`${MIGRATIONS}/20261013200000_journal_02_the_simple_journal/migration.sql`);
  const j02 = /ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n([\s\S]*?)\n\s*\);/.exec(journal02)![1];
  const j04 = /ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n([\s\S]*?)\n\s*\);/.exec(sql)![1];
  assert.equal(j04.trim().startsWith(j02.trim()), true, 'JOURNAL-02’s expression, verbatim, then the three');
  assert.equal(j04.trim().slice(j02.trim().length).trim(), 'OR num_nonnulls("audit", "learned", "next") >= 1');
  assert.equal((sql.match(/\bDROP\b/g) ?? []).length, 1, 'the one DROP is the at-least-one CHECK being re-made');
  assert.doesNotMatch(sql, /DROP COLUMN/, 'nothing dropped');
  assert.doesNotMatch(sql, /ALTER TYPE/, 'no enum value — operations_journal_set and _cleared cover the writes');
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no backfill, no row written');
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 3, 'three statements: the columns, the not-blank CHECK, the re-make');
  assert.doesNotMatch(sql, /(?<!")\bnext\b(?!")/, '"next" is quoted everywhere it appears');
  const head = comments(MIGRATION);
  assert.match(head, /JOURNAL-04 \(Alex, 2026-10-19\) — THE EVENING'S THREE ANSWERS: audit · learned · next\./);
  assert.match(head, /NO BACKFILL, no row\s*\n?-- written/);
  assert.match(head, /HELD HERE: no blank answer/);
  assert.match(head, /HELD BY THE RULE \(src\/lib\/operations\/journal\.ts journalInput\)/);
  assert.match(head, /a row of an evening alone is a journal \(Alex, decision 7\)/);
  assert.match(head, /No DROP COLUMN, no enum value/);
});

// ── T2 · THE SCHEMA ──────────────────────────────────────────────────────────

test('T2 the schema: the three fields after plan_done, in order, each documented; the client generated with them', () => {
  const model = /model operations_day_journals \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(model !== null);
  const m = model![1];
  assert.match(m, /\n\s+plan_done\s+Boolean\[\] @default\(\[\]\)\n\s+audit\s+String\?\s+@db\.Text\n\s+learned\s+String\?\s+@db\.VarChar\(500\)\n\s+next\s+String\?\s+@db\.VarChar\(500\)\n\s+created_at/);
  const docs = comments(SCHEMA);
  assert.match(docs, /JOURNAL-04 \(Alex, 2026-10-19\): the evening's three, nullable — NULL is unanswered, never "" \(the not-blank CHECK\)\. The pasted audit — paragraphs; the rule caps it at 4000 code points and 200 lines \(journal\.ts blockOf\)/);
  assert.match(docs, /What I learned, or what surprised me — VARCHAR\(500\), counted in code points by the rule\./);
  assert.match(docs, /Where I want to take it next — the line tomorrow's morning card shows first and the reel's cliffhanger \(REEL-02\); VARCHAR\(500\)\./);
  const fields = Object.keys(Prisma.Operations_day_journalsScalarFieldEnum);
  for (const f of ['audit', 'learned', 'next']) assert.ok(fields.includes(f), `prisma generate ran — the client knows ${f}`);
});

// ── T3 · THE RULE'S SHAPES ───────────────────────────────────────────────────

test('T3 seven answers: ANSWER_MAX, ANSWER_FIELDS in order, NO_ANSWERS, answersOf exactly the seven and no other key', () => {
  assert.deepEqual(ANSWER_MAX, { blocker: 280, audit: 4000, learned: 500, next: 500 });
  assert.equal(BLOCK_MAX_LINES, 200);
  assert.deepEqual(ANSWER_FIELDS, ['goals', 'blocker', 'plan_steps', 'plan_done', 'audit', 'learned', 'next']);
  assert.deepEqual(NO_ANSWERS, { goals: [], blocker: null, plan_steps: [], plan_done: [], audit: null, learned: null, next: null });
  const a = answersOf({ audit: 'a\n\nb', learned: 'l', next: 'n', id: 'x', shipped: 'old', user_id: 'u' } as unknown as Partial<Answers>);
  assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS], 'built fresh from the list — no other key passes');
  assert.deepEqual(a, { goals: [], blocker: null, plan_steps: [], plan_done: [], audit: 'a\n\nb', learned: 'l', next: 'n' });
  assert.deepEqual(answersOf({}), NO_ANSWERS, 'absent is unanswered');
  assert.match(comments(RULE), /audit's 4000 is the rule's OWN cap on a TEXT column/);
  assert.match(comments(RULE), /NEVER\s*\n?\s*\*?\s*flattened to one line — a block keeps its line breaks, which textOf does not/);
});

// ── T4 · journalInput: THE EVENING'S THREE ───────────────────────────────────

test('T4 journalInput: each of the three present and clean; absent and blank null; too long refused by name in code points; a control and a bidi control refused; a retired field still refused; the order', () => {
  const a = accepted({ day: DAY, goals: ['g'], audit: '  where we   got to ', learned: ' the cards\tsurprised me ', next: '  ship JOURNAL-05  ' });
  assert.deepEqual([a.audit, a.learned, a.next], ['where we got to', 'the cards surprised me', 'ship JOURNAL-05'], 'trimmed, runs of whitespace one space');
  assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS], 'the seven, in order — and nothing else');
  // Absent, null and blank are unanswered — null, never "".
  assert.deepEqual([accepted({ day: DAY, goals: ['g'] }).audit, accepted({ day: DAY, goals: ['g'] }).learned, accepted({ day: DAY, goals: ['g'] }).next], [null, null, null], 'absent');
  assert.deepEqual([accepted({ day: DAY, goals: ['g'], audit: null, learned: null, next: null }).audit, accepted({ day: DAY, goals: ['g'], audit: null, learned: null, next: null }).next], [null, null], 'null');
  assert.deepEqual([accepted({ day: DAY, goals: ['g'], audit: '  \n\n  ', learned: '   ', next: '\t' }).audit, accepted({ day: DAY, goals: ['g'], audit: '  \n\n  ', learned: '   ', next: '\t' }).learned, accepted({ day: DAY, goals: ['g'], audit: '  \n\n  ', learned: '   ', next: '\t' }).next], [null, null, null], 'blank');
  assert.equal(accepted({ day: DAY, goals: ['g'], audit: '\u200b\n\u200b' }).audit, null, 'invisible across every line is unanswered');
  // Not a string.
  for (const f of ['audit', 'learned', 'next'] as const) assert.deepEqual(refused({ day: DAY, goals: ['g'], [f]: 7 }), { field: f, message: notStringWords(f) });
  // The lengths, in CODE POINTS: a surrogate pair counts once.
  assert.equal(accepted({ day: DAY, learned: 'x'.repeat(500) }).learned, 'x'.repeat(500));
  assert.deepEqual(refused({ day: DAY, learned: 'x'.repeat(501) }), { field: 'learned', message: tooLongWords('learned', 501) });
  assert.equal(tooLongWords('learned', 501), 'learned is at most 500 characters (501 given)');
  assert.equal(accepted({ day: DAY, next: '😀'.repeat(500) }).next, '😀'.repeat(500), '500 code points of two UTF-16 units each');
  assert.deepEqual(refused({ day: DAY, next: '😀'.repeat(501) }), { field: 'next', message: tooLongWords('next', 501) });
  assert.equal(accepted({ day: DAY, audit: 'a'.repeat(4000) }).audit, 'a'.repeat(4000));
  assert.deepEqual(refused({ day: DAY, audit: 'a'.repeat(4001) }), { field: 'audit', message: tooLongWords('audit', 4001) });
  assert.equal(accepted({ day: DAY, audit: '😀'.repeat(4000) }).audit, '😀'.repeat(4000), 'the block counts code points too');
  assert.equal(accepted({ day: DAY, audit: `${'a'.repeat(1999)}\n${'b'.repeat(2000)}` }).audit?.length, 4000, 'the line break counts — 1999 + 1 + 2000');
  assert.deepEqual(refused({ day: DAY, audit: `${'a'.repeat(2000)}\n${'b'.repeat(2000)}` }), { field: 'audit', message: tooLongWords('audit', 4001) });
  // A control, a lone surrogate, a bidi control — the text answers' own words; audit's line breaks are not controls.
  for (const f of ['audit', 'learned', 'next'] as const) {
    assert.deepEqual(refused({ day: DAY, [f]: 'a\u0007b' }), { field: f, message: CONTROLS_WORDS }, `${f}: a bell`);
    assert.deepEqual(refused({ day: DAY, [f]: 'a\ud83db' }), { field: f, message: CONTROLS_WORDS }, `${f}: a lone surrogate`);
    assert.deepEqual(refused({ day: DAY, [f]: 'a\u202eb' }), { field: f, message: BIDI_WORDS }, `${f}: a bidi control`);
  }
  assert.equal(accepted({ day: DAY, learned: 'one\ntwo' }).learned, 'one two', 'learned is one line: a line break is whitespace there, flattened (cleanText)');
  assert.equal(accepted({ day: DAY, audit: 'one\ntwo' }).audit, 'one\ntwo', 'audit is a block: the line break is kept');
  // A retired field is still refused by name, before anything else.
  for (const f of RETIRED_FIELDS) assert.deepEqual(refused({ day: DAY, next: 'n', [f]: 'x' }), { field: f, message: retiredFieldWords(f) });
  // The order: the morning's four first, then audit, learned, next — the first bad field named.
  assert.equal(refused({ day: DAY, goals: ['x'.repeat(161)], audit: 'a\u0007', learned: 'l'.repeat(501) }).field, 'goals');
  assert.equal(refused({ day: DAY, audit: 'a\u0007', learned: 'l'.repeat(501), next: 7 }).field, 'audit');
  assert.equal(refused({ day: DAY, learned: 'l'.repeat(501), next: 7 }).field, 'learned');
  assert.equal(refused({ day: DAY, next: 7 }).field, 'next');
});

test('T4b journalInput: audit is a block — line breaks kept (CR, LF, CRLF), each line cleaned, blank runs one paragraph break, none at the edges, at most 200 lines; never flattened', () => {
  assert.equal(accepted({ day: DAY, audit: 'line one\n\n\n\nline two' }).audit, 'line one\n\nline two', 'a stack of blank lines is one paragraph break');
  assert.equal(accepted({ day: DAY, audit: '\n\n  line one  \r\n  \r\n\r\nline   two\r\n\n' }).audit, 'line one\n\nline two', 'CRLF and CR split too; edges dropped; each line trimmed and collapsed');
  assert.equal(accepted({ day: DAY, audit: 'a\rb\r\nc\nd' }).audit, 'a\nb\nc\nd');
  assert.equal(accepted({ day: DAY, goals: ['g'], audit: '   \n\u00a0\t \n' }).audit, null, 'only whitespace on every line is nothing typed');
  assert.equal(accepted({ day: DAY, audit: 'p1\n \n \t\n p2 \n\n\n p3' }).audit, 'p1\n\np2\n\np3', 'whitespace-only lines are blank lines');
  const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
  assert.equal(accepted({ day: DAY, audit: lines(200) }).audit?.split('\n').length, 200);
  assert.deepEqual(refused({ day: DAY, audit: lines(201) }), { field: 'audit', message: tooManyLinesWords('audit', 201) });
  assert.equal(tooManyLinesWords('audit', 201), 'audit is at most 200 lines (201 given)');
  assert.equal(accepted({ day: DAY, audit: `${lines(100)}\n\n\n\n${lines(99)}` }).audit?.split('\n').length, 200, 'counted after the collapse — 100 + one break + 99');
  assert.deepEqual(refused({ day: DAY, audit: `${lines(100)}\n\n${lines(100)}` }), { field: 'audit', message: tooManyLinesWords('audit', 201) }, 'a paragraph break is a line');
  // Never flattened: the code says so, and a block of many lines comes back with every break.
  assert.match(code(RULE), /const text = lines\.join\('\\n'\);/, 'joined with the line break, not a space');
  assert.doesNotMatch(/function blockOf[\s\S]*?\n\}/.exec(code(RULE))![0], /replace\(\/\\s\+\/g, ' '\)/, 'blockOf collapses whitespace per line through cleanText, never across lines');
  assert.equal(accepted({ day: DAY, audit: 'a\nb\nc' }).audit, 'a\nb\nc');
});

test('T4c journalInput: an evening alone is a journal; an all-empty body is nothing typed; the value is built from the seven alone', () => {
  for (const evening of [{ audit: 'where we got to' }, { learned: 'x' }, { next: 'y' }, { audit: 'a', learned: 'b', next: 'c' }]) {
    const a = accepted({ day: DAY, ...evening });
    assert.deepEqual([a.goals, a.blocker, a.plan_steps, a.plan_done], [[], null, [], []], 'the morning empty');
    assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS]);
  }
  for (const none of [{}, { goals: [], plan_steps: [], plan_done: [] }, { blocker: '  ' }, { audit: '\n\n', learned: '  ', next: null }, { audit: null, learned: null, next: '' }]) {
    assert.deepEqual(refused({ day: DAY, ...none }), { field: 'goals', message: NOTHING_TYPED_WORDS }, JSON.stringify(none));
  }
  assert.equal(NOTHING_TYPED_WORDS, 'nothing typed — a journal is at least one answer', 'the words unchanged');
  const check = /if \(goals\.lines\.length === 0 [^\n]*NOTHING_TYPED_WORDS\);/.exec(code(RULE))![0];
  for (const f of ['audit', 'learned', 'next']) assert.match(check, new RegExp(`${f}\\.text === null`), `the nothing-typed check reads ${f}`);
  assert.doesNotMatch(check, /shipped/);
  const smuggled = journalInput({ day: DAY, next: 'n', id: 'mine', user_id: 'someone', updated_at: '1970', retired: {} });
  assert.ok(smuggled.ok);
  if (smuggled.ok) assert.deepEqual(Object.keys(smuggled.value.answers), [...ANSWER_FIELDS], 'no other key passes');
});

// ── T5 · journalUnchanged ────────────────────────────────────────────────────

test('T5 journalUnchanged compares the seven — each of the three changes a write', () => {
  const held = answersOf({ goals: ['a'], blocker: 'x', plan_steps: ['s'], plan_done: [false], audit: 'p1\n\np2', learned: 'l', next: 'n' });
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a'], blocker: 'x', plan_steps: ['s'], plan_done: [false], audit: 'p1\n\np2', learned: 'l', next: 'n' })), true);
  assert.equal(journalUnchanged(held, answersOf({ ...held, audit: 'p1\np2' })), false, 'a paragraph break removed');
  assert.equal(journalUnchanged(held, answersOf({ ...held, audit: null })), false, 'the audit cleared');
  assert.equal(journalUnchanged(held, answersOf({ ...held, learned: 'L' })), false);
  assert.equal(journalUnchanged(held, answersOf({ ...held, next: null })), false);
  assert.equal(journalUnchanged(NO_ANSWERS, answersOf({})), true);
  assert.match(/export const journalUnchanged = [\s\S]*?;\n/.exec(code(RULE))![0], /row\.audit === answers\.audit\n\s*&& row\.learned === answers\.learned\n\s*&& row\.next === answers\.next/);
});

// ── T6 · THE ROUTE, AS IT READS — NO CODE CHANGE ─────────────────────────────

test('T6 the route is unchanged in code and writes Answers whole: a PUT carrying the three stores them, a PUT without them stores NULL for them (decision 6); the doc says so', () => {
  const r = code(ROUTE);
  assert.match(r, /data: answers \}\)\);/, 'the guarded update writes the rule’s answers — all seven');
  assert.match(r, /data: \{ user_id: user\.id, day: asJournalDate\(day\), \.\.\.answers \}/, 'the create spreads them');
  assert.doesNotMatch(r.replace("'@/lib/audit/writeAuditLog'", ''), /\b(audit|learned)\b|\bnext\b(?!Url|\/server)/, 'the route names no field — the row is written from Answers whole');
  assert.match(comments(ROUTE), /JOURNAL-04 \(Alex, 2026-10-19\): the row is SEVEN answers since this\s*\n\s*\*\s*ruling/);
  assert.match(comments(ROUTE), /a PUT WITHOUT\s*\n\s*\*\s*them stores NULL for them — which is why JOURNAL-05's cards must each\s*\n\s*\*\s*send the whole row as held \(decision 6\)/);
  // Driven as the route does: journalInput → journalUnchanged → the row written from `data: answers` (Prisma writes every key of data).
  const retired = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, null])) as Record<(typeof RETIRED_FIELDS)[number], string | null>;
  const stamp = { id: 'j1', day: new Date(`${DAY}T00:00:00.000Z`), updated_at: new Date('2026-10-19T21:00:00.000Z') };
  // 1. a PUT with the morning's four alone: the three are null in `data`.
  const morning = journalInput({ day: DAY, goals: ['a'] });
  assert.ok(morning.ok);
  if (!morning.ok) return;
  assert.deepEqual([morning.value.answers.audit, morning.value.answers.learned, morning.value.answers.next], [null, null, null]);
  const row1 = journalRowOf({ ...retired, ...morning.value.answers, ...stamp });
  assert.deepEqual([row1.audit, row1.learned, row1.next], [null, null, null], 'GET shows the three null');
  // 2. a PUT carrying the three: stored as cleaned, the audit's paragraph break kept.
  const evening = journalInput({ day: DAY, goals: ['a'], audit: 'line one\n\n\n\nline two', learned: 'x', next: 'y' });
  assert.ok(evening.ok);
  if (!evening.ok) return;
  assert.equal(journalUnchanged(row1, evening.value.answers), false, 'a change, so the route writes');
  const row2 = journalRowOf({ ...retired, ...evening.value.answers, ...stamp });
  assert.deepEqual([row2.audit, row2.learned, row2.next], ['line one\n\nline two', 'x', 'y'], 'GET shows them');
  assert.equal(journalUnchanged(row2, evening.value.answers), true, 'the same answers again — nothing written');
  // 3. a PUT of the morning's four alone over that row CLEARS the three — the whole row is written (decision 6).
  const again = journalInput({ day: DAY, goals: ['a'] });
  assert.ok(again.ok);
  if (!again.ok) return;
  assert.equal(journalUnchanged(row2, again.value.answers), false, 'the route would write');
  const row3 = journalRowOf({ ...retired, ...again.value.answers, ...stamp });
  assert.deepEqual([row3.audit, row3.learned, row3.next], [null, null, null], 'the evening is gone — JOURNAL-05’s cards must send the whole row');
  // 4. an evening alone is a row.
  const alone = journalInput({ day: DAY, next: 'y' });
  assert.ok(alone.ok);
  if (alone.ok) assert.deepEqual(alone.value.answers, { goals: [], blocker: null, plan_steps: [], plan_done: [], audit: null, learned: null, next: 'y' });
});

// ── T7 · WHAT DOES NOT CHANGE ────────────────────────────────────────────────

test('T7 every writer sends the row as held (the JOURNAL-04 amendment): the form carries audit, learned and next from the journal prop at save time; the tick spreads the row with the one flag flipped — neither names only the four', () => {
  // FOUND in the browser (JOURNAL-04, 2026-10-19): both bodies named the four morning fields, so a tick or a morning save
  // stored NULL over an evening. Alex's amendment (the same day): the invariant "every writer sends the whole row as held"
  // belongs to the data layer, here — R5 overridden for exactly these two bodies. Pinned exact.
  assert.match(code(FORM), /const read = journalInput\(\{ day, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: draft\.blocker === '' \? null : draft\.blocker, plan_steps: steps, plan_done: ticks, audit: journal === null \? null : journal\.audit, learned: journal === null \? null : journal\.learned, next: journal === null \? null : journal\.next \}\);/);
  assert.match(code(CARD), /const read = journalInput\(\{ day, \.\.\.answersOf\(row\), plan_done: row\.plan_done\.map\(\(d, j\) => \(j === i \? !d : d\)\) \}\);/);
  assert.doesNotMatch(code(FORM), /plan_done: ticks \}\)/, 'the form never sends the four alone');
  assert.doesNotMatch(code(CARD), /journalInput\(\{ day, goals: row\.goals/, 'the tick never names the four alone');
  assert.match(comments(FORM), /JOURNAL-04 \(Alex, 2026-10-19\): the form asks the morning's four and carries the evening's three/);
  assert.match(comments(CARD), /JOURNAL-04, 2026-10-19: audit, learned and next ride as held, so a tick never clears an evening/);
  assert.match(comments(ROUTE), /every writer sends the\s*\n\s*\*\s*row as held since JOURNAL-04 \(the tick, the form\); JOURNAL-05's cards do\s*\n\s*\*\s*the same/);
  // JOURNAL-05 (Alex, 2026-10-19): the three have their boxes and their questions now — on the EVENING form (stops/EveningForm.tsx, data-evening-field) and in the rule
  // (EVENING_AUDIT_QUESTION · EVENING_LEARNED_QUESTION · EVENING_NEXT_QUESTION); the morning form still asks none of them (journal05.test.ts pins both forms).
  assert.doesNotMatch(code(FORM), /data-journal-field="(audit|learned|next)"/, 'no box for the three on the morning form — they are the evening form’s (JOURNAL-05)');
  assert.match(code(RULE), /export const EVENING_AUDIT_QUESTION = 'Where did we actually get to\?';\nexport const EVENING_LEARNED_QUESTION = 'What did I learn, or what surprised me\?';\nexport const EVENING_NEXT_QUESTION = 'Where do I want to take it next\?';/, 'the three questions, here, since JOURNAL-05');
});
