/**
 * JOURNAL-02 (2026-10-13) — THE SIMPLE JOURNAL: YESTERDAY · TODAY'S GOALS · BLOCKERS · THE PLAN WITH TICKS · END OF DAY.
 *
 * The rule (src/lib/operations/journal.ts journalInput), the ticks (carryTicks,
 * openSteps, linesOf) are pure and DRIVEN over fixtures; the migration, the
 * schema, the route, the form, the plate and the stop form are anchored to
 * their source with comments stripped (TEST-TRUTH-01). journal01.test.ts keeps
 * JOURNAL-01's guarantees, its pins moved and dated where JOURNAL-02 changed them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  ADD_OPEN_STEPS_WORDS, ANSWER_FIELDS, BIDI_WORDS, BLOCKERS_BLOCK_WORD, BLOCKERS_QUESTION, CONTROLS_WORDS, DONE_NOT_LIST_WORDS, END_OF_DAY_BLOCK_WORD, END_OF_DAY_QUESTION,
  GOALS_EXAMPLE, JOURNAL_RECORD_WORDS, LIST_MAX, NOTHING_TYPED_WORDS, PLAN_BLOCK_WORD, PLAN_EXAMPLE, PLAN_QUESTION, RETIRED_FIELDS, TODAY_BLOCK_WORD, TODAY_GOALS_QUESTION,
  YESTERDAY_WORD, answersOf, blankLineWords, carryTicks, doneLengthWords, doneNotBooleanWords, goalWords, journalInput, journalUnchanged, leftOpenWords, lineNotStringWords,
  lineTooLongWords, lineWords, linesOf, notListWords, openSteps, planDoneWords, planStepWords, tooManyWords,
  type Answers,
} from '../operations/journal';

const RULE = 'src/lib/operations/journal.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const ROUTE = 'src/app/api/operations/journal/route.ts';
const ROUTE_ID = 'src/app/api/operations/journal/[id]/route.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261013200000_journal_02_the_simple_journal';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;

const DAY = '2026-10-13';

const refused = (body: unknown) => {
  const r = journalInput(body);
  assert.ok(!r.ok, `refused: ${JSON.stringify(body)}`);
  return r.ok ? null : { field: r.field, message: r.message };
};
const accepted = (body: unknown): Answers => {
  const r = journalInput(body);
  assert.ok(r.ok, `accepted: ${JSON.stringify(body)} — ${r.ok ? '' : r.message}`);
  return r.ok ? r.value.answers : answersOf({});
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

// ── T1 · THE RULE ────────────────────────────────────────────────────────────

test('T1 journalInput: the five answers — absent lists empty, absent texts null; each line trimmed and collapsed; the answers built from the five alone', () => {
  const a = accepted({ day: DAY, goals: ['  perfect   the day cards ', 'book travel'], plan_steps: ['merge\tTABLE-01', ' record  brunch '], plan_done: [true, false] });
  assert.deepEqual(a, { goals: ['perfect the day cards', 'book travel'], blocker: null, plan_steps: ['merge TABLE-01', 'record brunch'], plan_done: [true, false], shipped: null });
  assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS], 'the five answers, in the plate’s order — and nothing else');
  assert.deepEqual(ANSWER_FIELDS, ['goals', 'blocker', 'plan_steps', 'plan_done', 'shipped']);
  assert.deepEqual(accepted({ day: DAY, goals: null, plan_steps: null, plan_done: null, blocker: 'rain' }), { goals: [], blocker: 'rain', plan_steps: [], plan_done: [], shipped: null }, 'null lists are absent too');
  // The retired answers are never read from the body — they do not reach the write.
  const withRetired = journalInput({ day: DAY, goals: ['x'], ...Object.fromEntries(RETIRED_FIELDS.map((f) => [f, 'smuggled'])) });
  assert.ok(withRetired.ok);
  if (withRetired.ok) {
    assert.deepEqual(Object.keys(withRetired.value.answers), [...ANSWER_FIELDS], 'no retired key in the answers the route writes as `data`');
    for (const f of RETIRED_FIELDS) assert.equal(Object.hasOwn(withRetired.value.answers, f), false, `${f} does not pass through`);
  }
  assert.deepEqual(RETIRED_FIELDS, ['adjustment', 'one_thing', 'witness', 'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then']);
  assert.doesNotMatch(code(RULE), /\bb\.(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then))\b/, 'the rule reads no retired key from the body');
});

test('T1 journalInput refuses each list by name: not a list, too many lines, a line not a string, a control, a bidi control, a blank line, a line too long (in code points)', () => {
  assert.deepEqual(refused({ day: DAY, goals: 'x' }), { field: 'goals', message: notListWords('goals') });
  assert.deepEqual(refused({ day: DAY, plan_steps: { 0: 'x' }, plan_done: [false] }), { field: 'plan_steps', message: notListWords('plan_steps') });
  assert.deepEqual(refused({ day: DAY, goals: Array(9).fill('g') }), { field: 'goals', message: tooManyWords('goals', 9) }, 'at most 8 goals');
  assert.equal(accepted({ day: DAY, goals: Array(8).fill('g') }).goals.length, 8);
  assert.deepEqual(refused({ day: DAY, plan_steps: Array(13).fill('s'), plan_done: Array(13).fill(false) }), { field: 'plan_steps', message: tooManyWords('plan_steps', 13) }, 'at most 12 steps');
  assert.equal(accepted({ day: DAY, plan_steps: Array(12).fill('s'), plan_done: Array(12).fill(false) }).plan_steps.length, 12);
  assert.deepEqual(refused({ day: DAY, goals: ['a', 7] }), { field: 'goals', message: lineNotStringWords('goals', 2) });
  assert.deepEqual(refused({ day: DAY, goals: ['a', 'b\u0007c'] }), { field: 'goals', message: lineWords('goals', 2, CONTROLS_WORDS) }, 'a control, the line named');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['x\ud83dy'], plan_done: [false] }), { field: 'plan_steps', message: lineWords('plan_steps', 1, CONTROLS_WORDS) }, 'a lone surrogate');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['x‮y'], plan_done: [false] }), { field: 'plan_steps', message: lineWords('plan_steps', 1, BIDI_WORDS) }, 'a bidi control');
  assert.deepEqual(refused({ day: DAY, goals: ['a', '   '] }), { field: 'goals', message: blankLineWords('goals', 2) }, 'a blank line is refused by name — never dropped');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['​‍'], plan_done: [false] }), { field: 'plan_steps', message: blankLineWords('plan_steps', 1) }, 'a line of invisible characters is blank');
  assert.deepEqual(refused({ day: DAY, goals: ['g'.repeat(161)] }), { field: 'goals', message: lineTooLongWords('goals', 1, 161) });
  assert.deepEqual(accepted({ day: DAY, goals: ['😀'.repeat(160)] }).goals, ['😀'.repeat(160)], '160 code points (320 UTF-16 units) is a goal');
  assert.deepEqual(refused({ day: DAY, goals: ['😀'.repeat(161)] }), { field: 'goals', message: lineTooLongWords('goals', 1, 161) }, 'counted in code points');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['ok', 's'.repeat(201)], plan_done: [false, false] }), { field: 'plan_steps', message: lineTooLongWords('plan_steps', 2, 201) });
  assert.equal(accepted({ day: DAY, plan_steps: ['s'.repeat(200)], plan_done: [false] }).plan_steps[0].length, 200);
  assert.deepEqual(LIST_MAX, { goals: { lines: 8, characters: 160 }, plan_steps: { lines: 12, characters: 200 } });
  assert.equal(accepted({ day: DAY, goals: ['👨‍👩‍👧 family'] }).goals[0], '👨‍👩‍👧 family', 'a ZWJ sequence is visible');
});

test('T1 journalInput: plan_done is one true or false per step, refused by name otherwise; the first bad field in the plate’s order; at least one of the five', () => {
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a'], plan_done: 'true' }), { field: 'plan_done', message: DONE_NOT_LIST_WORDS });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b'], plan_done: [true, 'yes'] }), { field: 'plan_done', message: doneNotBooleanWords(2) });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b', 'c'], plan_done: [true, false] }), { field: 'plan_done', message: doneLengthWords(2, 3) });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b'] }), { field: 'plan_done', message: doneLengthWords(0, 2) }, 'steps with no ticks — absent is empty, and empty is not one per step');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a'], plan_done: Array(100000).fill('x') }), { field: 'plan_done', message: doneLengthWords(100000, 1) }, 'the count is judged before any element is looked at');
  assert.deepEqual(refused({ day: DAY, goals: ['g'], plan_done: [true] }), { field: 'plan_done', message: doneLengthWords(1, 0) }, 'a tick with no step');
  assert.deepEqual(refused({ day: DAY, goals: 5, blocker: 5, shipped: 5 }), { field: 'goals', message: notListWords('goals') }, 'the first bad field, in the plate’s order');
  for (const one of [{ goals: ['g'] }, { blocker: 'rain' }, { plan_steps: ['s'], plan_done: [false] }, { shipped: 'merged' }]) assert.ok(journalInput({ day: DAY, ...one }).ok, `one answer is a journal: ${JSON.stringify(one)}`);
  for (const none of [{}, { goals: [], plan_steps: [], plan_done: [] }, { blocker: '  ', shipped: '​' }]) assert.deepEqual(refused({ day: DAY, ...none }), { field: 'goals', message: NOTHING_TYPED_WORDS });
});

test('T1 journalUnchanged compares the five answers, the lists element by element', () => {
  const held = answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false], shipped: null });
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), true);
  assert.equal(journalUnchanged(held, answersOf({ goals: ['b', 'a'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), false, 'the order is the list');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, true] })), false, 'a tick flipped');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), false, 'a goal removed');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false], shipped: 'done' })), false);
});

// ── T2 · THE TICKS ───────────────────────────────────────────────────────────

test('T2 carryTicks: a step kept keeps its tick, a moved step keeps it, an edited step starts unticked, duplicates match in order; a broken saved plan is refused', () => {
  const steps = ['merge TABLE-01', 'book travel', 'record brunch'];
  const done = [true, false, true];
  assert.deepEqual(carryTicks(steps, done, steps), done, 'kept');
  assert.deepEqual(carryTicks(steps, done, ['record brunch', 'merge TABLE-01', 'book travel']), [true, true, false], 'moved');
  assert.deepEqual(carryTicks(steps, done, ['merge TABLE-01 today', 'book travel', 'record brunch']), [false, false, true], 'edited — a different text is a new step');
  assert.deepEqual(carryTicks(steps, done, [...steps, 'post']), [true, false, true, false], 'a new step starts unticked');
  assert.deepEqual(carryTicks(['x', 'x'], [true, false], ['x', 'x']), [true, false], 'two steps of one text keep their own ticks, in order');
  assert.deepEqual(carryTicks(['x', 'x'], [false, true], ['x']), [false], 'the first unused match');
  assert.deepEqual(carryTicks(['x'], [true], ['x', 'x']), [true, false], 'one saved tick carries once');
  assert.deepEqual(carryTicks([], [], ['a']), [false]);
  assert.throws(() => carryTicks(['a', 'b'], [true], ['a']), /1 ticks for 2 saved steps/);
});

test('T2 linesOf and openSteps: the lines as the form sends them; the steps a day left open', () => {
  assert.deepEqual(linesOf('  merge   TABLE-01 \n\nbook travel\r\n   \r record brunch '), ['merge TABLE-01', 'book travel', 'record brunch'], 'trimmed, collapsed, blank lines dropped');
  assert.deepEqual(linesOf(''), []);
  assert.deepEqual(linesOf('​'), ['​'], 'only whitespace is blank here — an invisible line goes to the rule, which refuses it by name');
  assert.deepEqual(carryTicks(['merge TABLE-01'], [true], linesOf('merge  TABLE-01 ')), [true], 'the form’s cleaning matches the saved text exactly');
  assert.deepEqual(openSteps(answersOf({ plan_steps: ['a', 'b', 'c'], plan_done: [true, false, false] })), ['b', 'c']);
  assert.deepEqual(openSteps(answersOf({ plan_steps: ['a'], plan_done: [true] })), []);
  assert.deepEqual(openSteps(answersOf({})), []);
  assert.throws(() => openSteps(answersOf({ plan_steps: ['a'], plan_done: [] })), /0 ticks for 1 steps/);
});

test('T2 the words — each a constant or a function, exact', () => {
  assert.equal(TODAY_GOALS_QUESTION, 'What are you getting done today? One per line.');
  assert.equal(BLOCKERS_QUESTION, 'What could stop it?');
  assert.equal(PLAN_QUESTION, 'The plan — paste the steps from chat, one per line.');
  assert.equal(END_OF_DAY_QUESTION, 'End of day — what got done? (type tonight)');
  assert.deepEqual([YESTERDAY_WORD, TODAY_BLOCK_WORD, BLOCKERS_BLOCK_WORD, PLAN_BLOCK_WORD, END_OF_DAY_BLOCK_WORD], ['YESTERDAY', 'TODAY', 'BLOCKERS', 'PLAN', 'END OF DAY']);
  assert.equal(leftOpenWords(['a', 'b']), 'left open: a · b');
  assert.equal(ADD_OPEN_STEPS_WORDS(2), "+ yesterday's open steps (2)");
  assert.equal(planDoneWords(2, 5), '2 of 5 done');
  assert.equal(planStepWords(1, 'merge TABLE-01', false), '☐ 1. merge TABLE-01');
  assert.equal(planStepWords(3, 'post', true), '✓ 3. post');
  assert.equal(goalWords('perfect the day cards'), '• perfect the day cards');
  assert.equal(JOURNAL_RECORD_WORDS, 'RECORD — when you did the journal');
  assert.equal(GOALS_EXAMPLE, 'perfect the day cards\nbook travel for the rest of the trip');
  assert.equal(PLAN_EXAMPLE, 'merge TABLE-01\nbook travel while CC runs\nrecord brunch and dinner\nscreenshot the card, edit, post');
  assert.equal(notListWords('goals'), 'goals must be a list of lines');
  assert.equal(tooManyWords('goals', 9), 'goals is at most 8 lines (9 given)');
  assert.equal(lineNotStringWords('plan_steps', 2), 'plan_steps line 2 must be a string');
  assert.equal(blankLineWords('goals', 2), 'goals line 2 is blank — type it or leave it out');
  assert.equal(lineTooLongWords('plan_steps', 3, 201), 'plan_steps line 3 is at most 200 characters (201 given)');
  assert.equal(lineWords('goals', 1, CONTROLS_WORDS), 'goals line 1: control characters are not an answer');
  assert.equal(DONE_NOT_LIST_WORDS, 'plan_done must be a list of true or false, one per step');
  assert.equal(doneNotBooleanWords(2), 'plan_done line 2 must be true or false');
  assert.equal(doneLengthWords(2, 3), 'plan_done has 2 ticks for 3 steps — one tick per step');
  const rule = code(RULE);
  for (const gone of ['QUESTION_WORDS', 'PAIRS', 'INDEPENDENT_FIELDS', 'pairWords', 'answerLine', 'pairLine', 'SHIPPED_HINT_WORDS', 'NO_YESTERDAY_WORDS']) assert.doesNotMatch(rule, new RegExp(`\\b${gone}\\b`), `${gone} — only the retired answers used it — is deleted`);
  assert.doesNotMatch(rule, /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'/, 'pure: no fetch, no clock, no Prisma, no React');
});

// ── T3 · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('T3 the migration: the three lists added NOT NULL default empty, the four CHECKs, the at-least-one re-made in one statement — no DROP COLUMN, no row written, the retired listed with the date, the newest', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*ADD COLUMN "goals"\s+TEXT\[\]\s+NOT NULL DEFAULT '\{\}',\n\s*ADD COLUMN "plan_steps" TEXT\[\]\s+NOT NULL DEFAULT '\{\}',\n\s*ADD COLUMN "plan_done"\s+BOOLEAN\[\] NOT NULL DEFAULT '\{\}';/);
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_goals_at_most_8" CHECK \(cardinality\("goals"\) <= 8\),/);
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_plan_steps_at_most_12" CHECK \(cardinality\("plan_steps"\) <= 12\),/);
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_one_tick_per_step" CHECK \(cardinality\("plan_steps"\) = cardinality\("plan_done"\)\),/);
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_lists_no_null" CHECK \(\n\s*array_position\("goals", NULL\) IS NULL\n\s*AND array_position\("plan_steps", NULL\) IS NULL\n\s*AND array_position\("plan_done", NULL\) IS NULL\n\s*\);/);
  assert.match(sql, /ALTER TABLE "operations_day_journals"\n\s*DROP CONSTRAINT "operations_day_journals_at_least_one",\n\s*ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n\s*num_nonnulls\("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped"\) >= 1\n\s*OR cardinality\("goals"\) > 0\n\s*OR cardinality\("plan_steps"\) > 0\n\s*\);/, 'the old nine OR a goal OR a step — dropped and re-added in ONE statement');
  assert.doesNotMatch(sql, /DROP COLUMN/, 'no column dropped — the retired answers keep their words');
  assert.equal((sql.match(/\bDROP\b/g) ?? []).length, 1, 'the one DROP is the at-least-one CHECK being re-made');
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no backfill, no row written');
  const header = comments(MIGRATION);
  assert.match(header, /RETIRED 2026-10-13 \(JOURNAL-02\): "adjustment", "one_thing", "witness",\s*--\s*"plan_1_if", "plan_1_then", "plan_2_if", "plan_2_then", "plan_3_if",\s*--\s*"plan_3_then", "obstacle_if", "obstacle_then"/, 'the header lists the retired answers with the date');
  assert.match(header, /no DROP COLUMN/);
  assert.match(header, /AUTHORED here, applied at deploy/);
  assert.match(header, /NO BACKFILL/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261013120000_journal_01_day_journals', 'right after JOURNAL-01’s');
});

test('T3 the schema: the three lists with empty defaults, every JOURNAL-01 column kept; the client generated with them', () => {
  const model = /model operations_day_journals \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(model !== null);
  const m = model![1];
  assert.match(m, /\n\s+goals\s+String\[\] @default\(\[\]\)\n/);
  assert.match(m, /\n\s+plan_steps\s+String\[\] @default\(\[\]\)\n/);
  assert.match(m, /\n\s+plan_done\s+Boolean\[\] @default\(\[\]\)\n/);
  for (const f of [...RETIRED_FIELDS, 'blocker', 'shipped']) assert.match(m, new RegExp(`\\n\\s+${f}\\s+String\\?\\s+@db\\.VarChar\\(\\d+\\)`), `${f} kept`);
  const fields = Object.keys(Prisma.Operations_day_journalsScalarFieldEnum);
  for (const f of ['goals', 'plan_steps', 'plan_done']) assert.ok(fields.includes(f), `prisma generate ran — the client knows ${f}`);
});

// ── T4 · THE ROUTE: THE SAME SHAPE, THE FIVE ANSWERS ─────────────────────────

test('T4 the route: unchanged in shape — the guarded update and the create write the rule’s five answers as `data`; nothing retired is named; the audit keeps the retired answers through the row', () => {
  const r = code(ROUTE);
  assert.match(r, /data: answers \}\)\);/, 'the update writes the rule’s answers');
  assert.match(r, /data: \{ user_id: user\.id, day: asJournalDate\(day\), \.\.\.answers \}/, 'the create too');
  for (const f of [ROUTE, ROUTE_ID]) assert.doesNotMatch(code(f), /\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then))\b/, `${f} names no retired answer`);
  assert.match(code(RULE), /return \{ \.\.\.answersOf\(row\), retired: retiredOf\(row\), id: row\.id,/, 'a row carries its retired answers, so the audit’s before and after keep them');
});

// ── T5 · THE FORM ────────────────────────────────────────────────────────────

test('T5 the form: four boxes, each labelled with its question, in the plate’s order; blank lines dropped, then carryTicks, then the rule, then the one writer; the open-steps button only when there are some', () => {
  const f = code(FORM);
  assert.equal((f.match(/<textarea\b/g) ?? []).length, 4, 'four textareas');
  assert.doesNotMatch(f, /<input\b/, 'no other box');
  inOrder(f, ['{TODAY_GOALS_QUESTION}', 'data-journal-field="goals"', '{BLOCKERS_QUESTION}', 'data-journal-field="blocker"', '{PLAN_QUESTION}', 'data-journal-field="plan_steps"', '{END_OF_DAY_QUESTION}', 'data-journal-field="shipped"'], 'each box after its question, in the plate’s order');
  assert.match(f, /<label className="flex flex-col gap-0\.5" data-journal-block="goals">\n\s*<span className=\{question\}>\{TODAY_GOALS_QUESTION\}<\/span>\n\s*<textarea /, 'the question labels its box');
  assert.match(f, /<label htmlFor="journal-plan" className=\{question\}>\{PLAN_QUESTION\}<\/label>/);
  assert.match(f, /<textarea id="journal-plan" /);
  assert.match(f, /placeholder=\{GOALS_EXAMPLE\}/);
  assert.match(f, /placeholder=\{PLAN_EXAMPLE\}/);
  inOrder(f, ['const steps = linesOf(draft.plan);', 'const ticks = carryTicks(journal === null ? [] : journal.plan_steps, journal === null ? [] : journal.plan_done, steps);', 'const read = journalInput({ day, goals: linesOf(draft.goals),', 'if (!read.ok) { setWords(read.message); return; }', 'const answer = await setJournal(day, read.value.answers);', 'onChanged();'], 'lines, then ticks, then the rule, then the writer, then the re-read');
  assert.match(f, /\{yesterdayOpen\.length > 0 && <button type="button" className=\{chip\} disabled=\{busy\} onClick=\{addOpen\} data-journal-add-open>\{ADD_OPEN_STEPS_WORDS\(yesterdayOpen\.length\)\}<\/button>\}/, 'only when yesterday left steps open');
  assert.match(f, /const addOpen = \(\) => setDraft\(\{ \.\.\.draft, plan: \[\.\.\.linesOf\(draft\.plan\), \.\.\.yesterdayOpen\]\.join\('\\n'\) \}\);/, 'appended to the plan box — the draft only');
  assert.doesNotMatch(f, /maxLength/);
  assert.doesNotMatch(f, /\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then)|retired)\b/, 'no retired answer is asked');
  const c = code(CARD);
  assert.match(c, /const yesterdayOpen = yesterdayReads !== null && yesterdayReads\.journal\.ok && yesterdayReads\.journal\.value\.journal !== null \? openSteps\(yesterdayReads\.journal\.value\.journal\) : \[\];/, 'the card hands the form yesterday’s open steps — none while unread');
});

// ── T6 · THE PLATE ───────────────────────────────────────────────────────────

test('T6 the plate: the five blocks in order; each step a tick button through the one writer, the whole journal with one flag flipped, re-read after; no retired answer read', () => {
  const c = code(CARD);
  const plate = c.slice(c.indexOf('function JournalPlate('), c.indexOf('function PlateHeader('));
  inOrder(plate, ['{YESTERDAY_WORD}', '{TODAY_BLOCK_WORD}', '{BLOCKERS_BLOCK_WORD}', '{PLAN_BLOCK_WORD}', '{END_OF_DAY_BLOCK_WORD}'], 'the five blocks, in the table’s order');
  inOrder(plate, ['data-day-yesterday-end-of-day>', 'data-day-yesterday-spent>', 'data-day-yesterday-largest>', 'data-day-yesterday-done>', 'data-day-yesterday-left-open>'], 'YESTERDAY: the END OF DAY as typed, the numbers, then what was left open');
  assert.match(plate, /\{yOpen\.length > 0 && <div [^>]*data-day-yesterday-left-open>\{leftOpenWords\(yOpen\)\}<\/div>\}/);
  assert.match(plate, /const yOpen = yRow === null \? \[\] : openSteps\(yRow\);/);
  assert.match(plate, /\{a\.goals\.map\(\(goal, i\) => \(\n\s*<div [^>]*data-day-journal-goal>\{goalWords\(goal\)\}<\/div>/, 'TODAY: the goals as a list');
  assert.match(plate, /data-day-journal-blocker>\{a\.blocker === null \? UNANSWERED_WORD : a\.blocker\}/);
  assert.match(plate, /data-day-journal-shipped>\{a\.shipped === null \? UNANSWERED_WORD : a\.shipped\}/, 'END OF DAY — until typed');
  assert.match(plate, /\{a\.plan_steps\.map\(\(step, i\) => \(\n\s*<button\n\s*type="button"[\s\S]*?onClick=\{\(\) => tick\(i\)\}[\s\S]*?>\{planStepWords\(i \+ 1, step, a\.plan_done\[i\]\)\}<\/button>/, 'a button per step, ☐/✓ n. step');
  assert.match(plate, /data-day-journal-plan-done>\{planDoneWords\(a\.plan_done\.filter\(\(d\) => d\)\.length, a\.plan_steps\.length\)\}/, '"n of N done" under the list');
  assert.match(plate, /const read = journalInput\(\{ day, goals: row\.goals, blocker: row\.blocker, plan_steps: row\.plan_steps, plan_done: row\.plan_done\.map\(\(d, j\) => \(j === i \? !d : d\)\), shipped: row\.shipped \}\);/, 'the whole journal as held, that one flag flipped, through the route’s rule');
  inOrder(plate, ['if (row === null || busyStep !== null) return;', 'if (!read.ok) { setTickWords(read.message); return; }', 'setBusyStep(i);', 'const answer = await writeJournal(day, read.value.answers);', 'if (!answer.ok) { setTickWords(answer.message); return; }', 'onChanged();', 'setBusyStep(null);'], 'busy, the one writer, the route’s words on a refusal, the journal read again');
  assert.match(plate, /disabled=\{busyStep !== null\}\n\s*aria-pressed=\{a\.plan_done\[i\]\}/, 'no second tick while one writes; the tick’s state is announced');
  assert.match(plate, /data-day-journal-tick-words>\{tickWords\}/);
  assert.doesNotMatch(plate, /set(Row|Answers|Draft)\(/, 'no optimistic copy — the plate shows what the journal read answers');
  assert.doesNotMatch(c, /\.retired\b|\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then))\b/, 'the card reads no retired answer');
});

test('T7 the stop form: a journal stop’s RECORD row says what the record is; nothing else changes', () => {
  const s = code(STOP_FORM);
  assert.match(s, /\{role === 'journal'\n\s*\? <span className="text-text-faint tracking-wide" data-stop-record-label>\{JOURNAL_RECORD_WORDS\}<\/span>\n\s*: <span className="text-text-faint uppercase tracking-wide" data-stop-record-label>Record<\/span>\}/, 'not uppercased — the words read as written');
  assert.match(s, /import \{ JOURNAL_RECORD_WORDS \} from '@\/lib\/operations\/journal';/);
  assert.match(s, /: role === 'journal'\n\s*\? \{ amount: false, rating: false, minutes: true, note: draft\.outcome === 'skipped' \}/, 'a journal stop still asks the minutes only (JOURNAL-01)');
});
