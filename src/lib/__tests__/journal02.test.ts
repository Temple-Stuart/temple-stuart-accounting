/**
 * JOURNAL-02 (2026-10-13) — THE SIMPLE JOURNAL: YESTERDAY · TODAY'S GOALS · BLOCKERS · THE PLAN WITH TICKS · END OF DAY.
 *
 * The rule (src/lib/operations/journal.ts journalInput), the ticks (carryTicks,
 * openSteps, linesOf) are pure and DRIVEN over fixtures; the migration, the
 * schema, the route, the form, the plate and the stop form are anchored to
 * their source with comments stripped (TEST-TRUTH-01). journal01.test.ts keeps
 * JOURNAL-01's guarantees, its pins moved and dated where JOURNAL-02 changed them.
 *
 * JOURNAL-03 (Alex, 2026-10-15): END OF DAY (shipped) is retired — four answers,
 * four blocks, three boxes; a body that carries any of the twelve retired keys is
 * refused by name. The pins below moved with dated notes; none is loosened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  ADD_OPEN_STEPS_WORDS, ANSWER_FIELDS, BIDI_WORDS, BLOCKERS_BLOCK_WORD, CONTROLS_WORDS, DONE_NOT_LIST_WORDS,
  GOALS_EXAMPLE, JOURNAL_RECORD_WORDS, LIST_MAX, NO_JOURNAL_YESTERDAY_WORDS, NO_PLAN_YESTERDAY_WORDS, NOTHING_TYPED_WORDS, PLAN_BLOCK_WORD, PLAN_EXAMPLE, MORNING_BLOCKER_QUESTION, MORNING_GOALS_QUESTION, MORNING_PLAN_QUESTION, RETIRED_FIELDS, TODAY_BLOCK_WORD,
  YESTERDAY_WORD, answersOf, blankLineWords, carryTicks, doneLengthWords, doneNotBooleanWords, goalWords, journalInput, journalRowOf, journalUnchanged, lineNotStringWords,
  lineTooLongWords, lineWords, linesOf, notListWords, openSteps, planDoneWords, retiredFieldWords, planStepWords, tooManyWords, yesterdaySteps, yesterdayStepsWords,
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

// JOURNAL-03 (Alex, 2026-10-15): the answers are four — shipped left ANSWER_FIELDS for RETIRED_FIELDS; the pins below moved with it.
test('T1 journalInput: the four answers — absent lists empty, absent texts null; each line trimmed and collapsed; the answers built from the four alone', () => {
  const a = accepted({ day: DAY, goals: ['  perfect   the day cards ', 'book travel'], plan_steps: ['merge\tTABLE-01', ' record  brunch '], plan_done: [true, false] });
  // JOURNAL-04 (2026-10-19): the evening's three ride every answer, null until typed — the four pins below carry them.
  // JOURNAL-06 (Alex, 2026-10-20): the evening's seven — the five blocks joined after audit, learned retired (RETIRED_FIELDS); eleven answers.
  assert.deepEqual(a, { goals: ['perfect the day cards', 'book travel'], blocker: null, plan_steps: ['merge TABLE-01', 'record brunch'], plan_done: [true, false], audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null });
  assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS], 'the eleven answers, the plate’s four first — and nothing else');
  assert.deepEqual(ANSWER_FIELDS, ['goals', 'blocker', 'plan_steps', 'plan_done', 'audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next']);
  assert.deepEqual(accepted({ day: DAY, goals: null, plan_steps: null, plan_done: null, blocker: 'rain' }), { goals: [], blocker: 'rain', plan_steps: [], plan_done: [], audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null }, 'null lists are absent too');
  // JOURNAL-03 (2026-10-15): "the retired answers are never read from the body" became "a body that carries one is refused by name" —
  // stricter: a retired key still never reaches the write, and now the writer is told so instead of believing it was saved.
  assert.deepEqual(RETIRED_FIELDS, ['adjustment', 'one_thing', 'witness', 'plan_1_if', 'plan_1_then', 'plan_2_if', 'plan_2_then', 'plan_3_if', 'plan_3_then', 'obstacle_if', 'obstacle_then', 'shipped', 'learned']);
  assert.doesNotMatch(code(RULE), /\bb\.(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then)|shipped|learned)\b/, 'the rule reads no retired key’s value from the body');
});

test('T1b JOURNAL-03 a retired key is refused by name — all thirteen, any value, before the day and the answers; any other extra key is still ignored', () => {
  // JOURNAL-03 (Alex, 2026-10-15) — R1 b: refuse every retired key by name, with words that say what to do. Was: ignored (JOURNAL-02).
  // JOURNAL-06 (Alex, 2026-10-20): learned joined the list the same way — thirteen.
  assert.equal(RETIRED_FIELDS.length, 13, 'the eleven of JOURNAL-02, shipped (JOURNAL-03) and learned (JOURNAL-06)');
  for (const f of RETIRED_FIELDS) {
    for (const value of ['typed', '', null, 5, ['x'], { a: 1 }, false]) {
      assert.deepEqual(refused({ day: DAY, goals: ['g'], [f]: value }), { field: f, message: retiredFieldWords(f) }, `${f}: ${JSON.stringify(value)}`);
    }
    assert.deepEqual(refused(JSON.parse(`{"day":"${DAY}","goals":["g"],"${f}":null}`)), { field: f, message: retiredFieldWords(f) }, `${f} as JSON null is carried — refused`);
    assert.equal(retiredFieldWords(f), `${f} is retired — it is no longer asked; reload the page`);
  }
  assert.equal(retiredFieldWords('shipped'), 'shipped is retired — it is no longer asked; reload the page', 'the words, exact');
  // Before the day and the answers: a page from before reloads first, whatever else it sent.
  assert.deepEqual(refused({ day: 'today', shipped: 'x' }), { field: 'shipped', message: retiredFieldWords('shipped') }, 'before the day');
  assert.deepEqual(refused({ day: DAY, goals: 5, shipped: 'x' }), { field: 'shipped', message: retiredFieldWords('shipped') }, 'before the answers');
  assert.deepEqual(refused({ day: DAY, shipped: 'x', one_thing: 'y' }), { field: 'one_thing', message: retiredFieldWords('one_thing') }, 'several: the first in RETIRED_FIELDS’ order');
  // An own key only — an inherited name is not a key the body carries.
  assert.ok(journalInput(Object.assign(Object.create({ shipped: 'inherited' }), { day: DAY, goals: ['g'] })).ok, 'an inherited shipped is not carried');
  // Keys that are not retired keep JOURNAL-02's behaviour: ignored, never in the answers.
  const extra = journalInput({ day: DAY, goals: ['g'], mood: 'good', id: 'mine', user_id: 'someone', retired: { shipped: 'x' } });
  assert.ok(extra.ok, 'a key that is not retired is not refused');
  if (extra.ok) assert.deepEqual(Object.keys(extra.value.answers), [...ANSWER_FIELDS], 'and never passes through');
  assert.match(code(RULE), /for \(const f of RETIRED_FIELDS\) if \(Object\.prototype\.hasOwnProperty\.call\(b, f\)\) return refuse\(f, retiredFieldWords\(f\)\);\n\s*if \(!isIsoDay\(b\.day\)\)/, 'the check: every retired field, by own key, right before the day');
  // The route answers the rule's refusal as a 400 naming the field — unchanged code, so the twelve reach the writer by name.
  assert.match(code(ROUTE), /if \(!read\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: read\.field, message: read\.message \}, \{ status: 400 \}\);/);
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

// JOURNAL-03 (2026-10-15): "at least one of the five" is of the four — shipped no longer counts, it is refused; the pins moved with it.
test('T1 journalInput: plan_done is one true or false per step, refused by name otherwise; the first bad field in the plate’s order; at least one of the four', () => {
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a'], plan_done: 'true' }), { field: 'plan_done', message: DONE_NOT_LIST_WORDS });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b'], plan_done: [true, 'yes'] }), { field: 'plan_done', message: doneNotBooleanWords(2) });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b', 'c'], plan_done: [true, false] }), { field: 'plan_done', message: doneLengthWords(2, 3) });
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a', 'b'] }), { field: 'plan_done', message: doneLengthWords(0, 2) }, 'steps with no ticks — absent is empty, and empty is not one per step');
  assert.deepEqual(refused({ day: DAY, plan_steps: ['a'], plan_done: Array(100000).fill('x') }), { field: 'plan_done', message: doneLengthWords(100000, 1) }, 'the count is judged before any element is looked at');
  assert.deepEqual(refused({ day: DAY, goals: ['g'], plan_done: [true] }), { field: 'plan_done', message: doneLengthWords(1, 0) }, 'a tick with no step');
  assert.deepEqual(refused({ day: DAY, goals: 5, blocker: 5, plan_steps: 5 }), { field: 'goals', message: notListWords('goals') }, 'the first bad field, in the plate’s order');
  for (const one of [{ goals: ['g'] }, { blocker: 'rain' }, { plan_steps: ['s'], plan_done: [false] }]) assert.ok(journalInput({ day: DAY, ...one }).ok, `one answer is a journal: ${JSON.stringify(one)}`);
  assert.deepEqual(refused({ day: DAY, shipped: 'merged' }), { field: 'shipped', message: retiredFieldWords('shipped') }, 'JOURNAL-03: an end of day alone is no journal — refused by name');
  for (const none of [{}, { goals: [], plan_steps: [], plan_done: [] }, { blocker: '  ' }]) assert.deepEqual(refused({ day: DAY, ...none }), { field: 'goals', message: NOTHING_TYPED_WORDS });
  assert.doesNotMatch(/if \(goals\.lines\.length === 0 [^\n]*NOTHING_TYPED_WORDS\);/.exec(code(RULE))![0], /shipped/, 'the nothing-typed check reads no shipped');
});

// JOURNAL-03 (2026-10-15): four answers — shipped is not written, so not compared; its pin moved to the blocker and to the rule's text.
test('T1 journalUnchanged compares the four answers, the lists element by element', () => {
  const held = answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] });
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), true);
  assert.equal(journalUnchanged(held, answersOf({ goals: ['b', 'a'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), false, 'the order is the list');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, true] })), false, 'a tick flipped');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a'], blocker: 'x', plan_steps: ['s1', 's2'], plan_done: [true, false] })), false, 'a goal removed');
  assert.equal(journalUnchanged(held, answersOf({ goals: ['a', 'b'], blocker: 'y', plan_steps: ['s1', 's2'], plan_done: [true, false] })), false, 'the blocker changed');
  assert.doesNotMatch(/export const journalUnchanged = [\s\S]*?;\n/.exec(code(RULE))![0], /shipped/, 'shipped is not compared');
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
  // PLAN-01 (2026-10-13): Alex's words for two questions and for yesterday's unticked steps — the pins moved with them.
  // JOURNAL-05 (Alex, 2026-10-19): the morning's questions — "what must be true by tonight"; the JOURNAL-02 names went with their words.
  assert.equal(MORNING_GOALS_QUESTION, 'What must be true by tonight? One per line.');
  assert.equal(MORNING_BLOCKER_QUESTION, 'What could stop it?');
  assert.equal(MORNING_PLAN_QUESTION, 'The plan — copy the plan prompt, paste the steps from chat, one per line.');
  // CLEAN-02 (2026-10-14) — Alex's ruling: END OF DAY asks what was left and why; the plan's ticks say what was done (was "What did you accomplish today? (type tonight)").
  // JOURNAL-03 (Alex, 2026-10-15): END OF DAY is retired — END_OF_DAY_QUESTION, END_OF_DAY_BLOCK_WORD, NOTE_WORD, noteWords and
  // PLAN_PROMPT_NOTE are deleted, not left unused; the plate's blocks are four.
  for (const gone of ['END_OF_DAY_QUESTION', 'END_OF_DAY_BLOCK_WORD', 'NOTE_WORD', 'noteWords', 'PLAN_PROMPT_NOTE']) assert.doesNotMatch(code(RULE), new RegExp(`\\b${gone}\\b`), `${gone} is deleted`);
  assert.doesNotMatch(code(RULE), /END OF DAY|Anything left unfinished|'note:'|Yesterday — note:/, 'and their words with them');
  assert.deepEqual([YESTERDAY_WORD, TODAY_BLOCK_WORD, BLOCKERS_BLOCK_WORD, PLAN_BLOCK_WORD], ['YESTERDAY', 'TODAY', 'BLOCKERS', 'PLAN']);
  // CLEAN-02 (2026-10-14): notFinishedWords ("not finished: a · b") is gone — yesterdayStepsWords says what was left over (T2b); its last reader was the plate.
  assert.doesNotMatch(code(RULE), /\bnotFinishedWords\b|\bACCOMPLISHED_WORD\b|\baccomplishedWords\b/, 'the old yesterday words are deleted');
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

// JOURNAL-03 (2026-10-15): "the note only when typed" is gone with END OF DAY — its pins moved to "deleted" (T2 above).
test('T2b CLEAN-02 yesterdayStepsWords — all done, some left over, no plan, no journal', () => {
  // CLEAN-02 (2026-10-14) — Alex's ruling: YESTERDAY on the journal card is its plan's ticks, from the one rule (openSteps).
  const six = ['merge TABLE-01', 'book travel', 'record brunch', 'screenshot the card', 'post the reel', 'reply to comments'];
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, true, true, true, true] })), 'all 6 steps done');
  // DECK-01 (Alex, 2026-10-16) — DECLUTTERED: the line is counts alone ("· 2 left over"); the steps left over are the form's "+ yesterday's open
  // steps (k)" and the plan prompt's (openSteps, unchanged). Moved, not loosened.
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, false, true, true, false] })), '4 of 6 steps done · 2 left over', 'the count left over');
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: ['a'], plan_done: [false] })), '0 of 1 steps done · 1 left over');
  assert.equal(yesterdayStepsWords(answersOf({ goals: ['g'] })), 'no plan yesterday', 'a journal with no plan');
  assert.equal(yesterdayStepsWords(null), 'no journal yesterday', 'the read answered no row');
  // DECK-01 (Alex, 2026-10-16): LEFT_OVER_WORD ('left over:') is gone with the list of steps — the line is a count (deck01.test.ts).
  assert.deepEqual([NO_JOURNAL_YESTERDAY_WORDS, NO_PLAN_YESTERDAY_WORDS], ['no journal yesterday', 'no plan yesterday']);
  assert.doesNotMatch(code(RULE), /\bLEFT_OVER_WORD\b|'left over:'/, 'LEFT_OVER_WORD is deleted');
  assert.throws(() => yesterdayStepsWords(answersOf({ plan_steps: ['a'], plan_done: [] })), /0 ticks for 1 steps/, 'ticks that do not match the steps are the database’s error — never counted');
  assert.deepEqual(yesterdaySteps(answersOf({ plan_steps: ['a', 'b'], plan_done: [false, true] })), { kind: 'steps', done: 1, of: 2, leftOver: ['a'] });
  assert.deepEqual(yesterdaySteps(null), { kind: 'no journal' });
  // Nothing here is money.
  assert.doesNotMatch(/export function yesterdayStepsWords[\s\S]*?\n\}/.exec(code(RULE))![0], /cents|planDollars|formatCents/);
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
  // TASKS-ONE-02 (2026-10-14): the completion audit types' migration is newer still — every index moved one; the order holds.
  // RETRO-01 (Alex, 2026-10-16): the stop-moved audit type's migration is newer still — every index moved one; the order holds.
  // ROUTINE-02b (2026-10-18): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 12], MIGRATION_DIR, 'the migration three before the newest (TASKS-ONE-02, then RETRO-01, ROUTINE-02b followed)');
  assert.equal(dirs[dirs.length - 11], '20261014090000_tasks_one_02_completion_audit_types');
  assert.equal(dirs[dirs.length - 10], '20261016120000_retro_01_stop_moved_audit_type', 'the migration before the newest (ROUTINE-02b followed)');
  // MOVE-01 (2026-10-19): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 9], '20261018120000_routine_02b_rekeyed_audit_type', 'the migration before the newest (MOVE-01 followed)');
  // JOURNAL-04 (2026-10-19): the evening answers' migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 8], '20261019090000_move_01_moved_audit_type', 'the migration before the newest (JOURNAL-04 followed)');
  assert.equal(dirs[dirs.length - 7], '20261019210000_journal_04_evening_answers', 'the migration before the newest (LEDGER-03 followed)');
  // LEDGER-03 (Alex, 2026-10-19): two audit values for the planned-item link — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 6], '20261019230000_ledger_03_planned_item_link_audit', 'the migration before the newest (BACKLOG-01 followed)');
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns and the four statuses — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], '20261020120000_backlog_01_capture', 'the migration before the newest (BACKLOG-01b followed)');
  // BACKLOG-01b (Alex, 2026-10-20): the brief's three columns — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020140000_backlog_01b_brief', 'the migration before the newest (JOURNAL-06 followed)');
  // JOURNAL-06 (Alex, 2026-10-20): the evening's five columns, the two CHECKs re-made — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261020150000_journal_06_reflection', 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261020160000_backlog_02_reranked', 'the migration before the newest (DOCUMENTS-01 followed)');
  // DOCUMENTS-01 (Alex, 2026-10-28): source_documents, the receipt on its posting — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261028120000_documents_01_source_documents', 'the newest migration');
  assert.equal(dirs[dirs.length - 13], '20261013120000_journal_01_day_journals', 'right after JOURNAL-01’s');
});

test('T3 the schema: the three lists with empty defaults, every JOURNAL-01 column kept; the client generated with them', () => {
  const model = /model operations_day_journals \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(model !== null);
  const m = model![1];
  assert.match(m, /\n\s+goals\s+String\[\] @default\(\[\]\)\n/);
  assert.match(m, /\n\s+plan_steps\s+String\[\] @default\(\[\]\)\n/);
  assert.match(m, /\n\s+plan_done\s+Boolean\[\] @default\(\[\]\)\n/);
  // JOURNAL-03 (2026-10-15): shipped is among RETIRED_FIELDS now — still kept, still checked here.
  assert.ok(RETIRED_FIELDS.includes('shipped'));
  for (const f of [...RETIRED_FIELDS, 'blocker']) assert.match(m, new RegExp(`\\n\\s+${f}\\s+String\\?\\s+@db\\.VarChar\\(\\d+\\)`), `${f} kept`);
  const fields = Object.keys(Prisma.Operations_day_journalsScalarFieldEnum);
  for (const f of ['goals', 'plan_steps', 'plan_done']) assert.ok(fields.includes(f), `prisma generate ran — the client knows ${f}`);
});

// ── T4 · THE ROUTE: THE SAME SHAPE, THE FOUR ANSWERS ─────────────────────────

// JOURNAL-03 (2026-10-15): the route's code is unchanged; the rule's answers are four, so `data` is four — shipped joined the names it never says.
test('T4 the route: unchanged in shape — the guarded update and the create write the rule’s four answers as `data`; nothing retired is named; the audit keeps the retired answers through the row', () => {
  const r = code(ROUTE);
  assert.match(r, /data: answers \}\)\);/, 'the update writes the rule’s answers');
  assert.match(r, /data: \{ user_id: user\.id, day: asJournalDate\(day\), \.\.\.answers \}/, 'the create too');
  for (const f of [ROUTE, ROUTE_ID]) assert.doesNotMatch(code(f), /\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then)|shipped)\b/, `${f} names no retired answer`);
  assert.match(code(RULE), /return \{ \.\.\.answersOf\(row\), retired: retiredOf\(row\), id: row\.id,/, 'a row carries its retired answers, so the audit’s before and after keep them');
});

test('T4b JOURNAL-03 R3 — nothing typed before is lost: a tick or a goal edit on a day that holds END OF DAY words writes the four answers alone, so the words stay in the row and in `retired`', () => {
  // The row as Prisma reads it: a plan, a goal, and END OF DAY words typed before JOURNAL-03.
  const retired = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, null])) as Record<(typeof RETIRED_FIELDS)[number], string | null>;
  // JOURNAL-04 (2026-10-19): the row carries the evening's three too — null here, typed by no card yet.
  // JOURNAL-06 (2026-10-20): the five blocks ride too; learned is retired — it comes with `retired`, null.
  const db = { goals: ['film the day card'], blocker: null, plan_steps: ['merge X', 'book travel'], plan_done: [false, false], audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null, ...retired, shipped: 'merged TABLE-01; the reel is up', id: 'j1', day: new Date(`${DAY}T00:00:00.000Z`), updated_at: new Date(`${DAY}T01:00:00.000Z`) };
  const held = journalRowOf(db);
  assert.equal(held.retired.shipped, 'merged TABLE-01; the reel is up', 'the words ride `retired`');
  assert.equal(Object.hasOwn(held, 'shipped'), false, 'never the answers');
  // The plate's tick and the form's goal edit, each as its code builds the body (pinned in T5 and T6) — the four answers, no shipped.
  const tick = journalInput({ day: DAY, goals: held.goals, blocker: held.blocker, plan_steps: held.plan_steps, plan_done: held.plan_done.map((d, j) => (j === 0 ? !d : d)) });
  const edit = journalInput({ day: DAY, goals: [...held.goals, 'book travel for the rest of the trip'], blocker: held.blocker, plan_steps: held.plan_steps, plan_done: held.plan_done });
  for (const [what, read] of [['tick', tick], ['goal edit', edit]] as const) {
    assert.ok(read.ok, what);
    if (!read.ok) continue;
    // JOURNAL-04 (2026-10-19): seven keys now — the three evening answers ride as null, so a morning write clears an evening (decision 6; journal04.test.ts).
    assert.deepEqual(Object.keys(read.value.answers), ['goals', 'blocker', 'plan_steps', 'plan_done', 'audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next'], `${what}: the route writes these eleven as \`data\` — no shipped, no learned`);
    assert.equal(journalUnchanged(held, read.value.answers), false, `${what}: a change, so the route writes`);
    // What the guarded update leaves in the row: Prisma writes only the keys of `data`, so every other column keeps its value.
    const after = journalRowOf({ ...db, ...read.value.answers });
    assert.equal(after.retired.shipped, 'merged TABLE-01; the reel is up', `${what}: the END OF DAY words are still in the row, and in the audit’s after`);
  }
  // The route writes exactly the rule's answers on update and create — nothing it builds itself names shipped (T4 above).
  assert.match(code(ROUTE), /where: \{ id: existing\.id, user_id: user\.id, updated_at: existing\.updated_at \}, data: answers \}/);
});

// ── T5 · THE FORM ────────────────────────────────────────────────────────────

// JOURNAL-03 (Alex, 2026-10-15): three boxes — END OF DAY's box is gone; the count and the order moved with it.
test('T5 the form: three boxes, each labelled with its question, in the plate’s order; blank lines dropped, then carryTicks, then the rule, then the one writer; the open-steps button only when there are some', () => {
  const f = code(FORM);
  assert.equal((f.match(/<textarea\b/g) ?? []).length, 3, 'three textareas');
  assert.doesNotMatch(f, /<input\b/, 'no other box');
  inOrder(f, ['{MORNING_GOALS_QUESTION}', 'data-journal-field="goals"', '{MORNING_BLOCKER_QUESTION}', 'data-journal-field="blocker"', '{MORNING_PLAN_QUESTION}', 'data-journal-field="plan_steps"'], 'each box after its question, in the plate’s order');
  assert.doesNotMatch(f, /END_OF_DAY_QUESTION|data-journal-field="shipped"|data-journal-block="shipped"|\bshipped\b/, 'no END OF DAY box, and no shipped in the draft or the body');
  assert.match(f, /<label className="flex flex-col gap-0\.5" data-journal-block="goals">\n\s*<span className=\{question\}>\{MORNING_GOALS_QUESTION\}<\/span>\n\s*<textarea /, 'the question labels its box');
  assert.match(f, /<label htmlFor="journal-plan" className=\{question\}>\{MORNING_PLAN_QUESTION\}<\/label>/);
  assert.match(f, /<textarea id="journal-plan" /);
  assert.match(f, /placeholder=\{GOALS_EXAMPLE\}/);
  assert.match(f, /placeholder=\{PLAN_EXAMPLE\}/);
  // PLAN-01 (2026-10-13): the plan and goal lines lose a pasted list's marker between linesOf and carryTicks — the pin moved with it.
  inOrder(f, ['const steps = linesOf(draft.plan).map(stripListMarker);', 'const ticks = carryTicks(journal === null ? [] : journal.plan_steps, journal === null ? [] : journal.plan_done, steps);', 'const read = journalInput({ day, goals: linesOf(draft.goals).map(stripListMarker),', 'if (!read.ok) { setWords(read.message); return; }', 'const answer = await setJournal(day, read.value.answers);', 'onChanged();'], 'lines, then ticks, then the rule, then the writer, then the re-read');
  assert.match(f, /\{yesterdayOpen\.length > 0 && <button type="button" className=\{chip\} disabled=\{busy\} onClick=\{addOpen\} data-journal-add-open>\{ADD_OPEN_STEPS_WORDS\(yesterdayOpen\.length\)\}<\/button>\}/, 'only when yesterday left steps open');
  assert.match(f, /const addOpen = \(\) => setDraft\(\{ \.\.\.draft, plan: \[\.\.\.linesOf\(draft\.plan\), \.\.\.yesterdayOpen\]\.join\('\\n'\) \}\);/, 'appended to the plan box — the draft only');
  assert.doesNotMatch(f, /maxLength/);
  assert.doesNotMatch(f, /\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then)|shipped|retired)\b/, 'no retired answer is asked — JOURNAL-03: shipped among them');
  const c = code(CARD);
  // PLAN-01 (2026-10-13): the form takes yesterday whole — its open steps and its END OF DAY — or why it is not known; the pin moved with it.
  // CLEAN-02 (2026-10-14): "whole" is yesterday's row itself (its ticks and its note) — the open steps are derived in the form by openSteps.
  // JOURNAL-03 (2026-10-15): the row's note is no longer read — its ticks alone; "+ yesterday's open steps" is unchanged.
  assert.match(c, /const yesterdayForPrompt: YesterdayForPrompt = yesterdayRead === null\n\s*\? \{ ok: false, words: YESTERDAY_LOADING_WORDS \}\n\s*: !yesterdayRead\.ok\n\s*\? \{ ok: false, words: yesterdayRead\.words \}\n\s*: \{ ok: true, row: yesterdayRead\.value\.journal \};/, 'yesterday read, or why not — never an unknown written as none');
  assert.match(code(FORM), /const yesterdayOpen = yesterday\.ok && yesterday\.row !== null \? openSteps\(yesterday\.row\) : \[\];/, 'the open steps only from a read yesterday that has a journal');
});

// ── T6 · THE PLATE ───────────────────────────────────────────────────────────

// JOURNAL-03 (Alex, 2026-10-15): four blocks — END OF DAY and YESTERDAY's note are gone; a tick sends no shipped. The pins moved, dated.
test('T6 the plate: the four blocks in order; each step a tick button through the one writer, the whole journal with one flag flipped, re-read after; no retired answer read', () => {
  const c = code(CARD);
  const plate = c.slice(c.indexOf('function JournalPlate('), c.indexOf('function PlateHeader('));
  inOrder(plate, ['{YESTERDAY_WORD}', '{TODAY_BLOCK_WORD}', '{BLOCKERS_BLOCK_WORD}', '{PLAN_BLOCK_WORD}'], 'the four blocks, in the table’s order');
  assert.doesNotMatch(plate, /END_OF_DAY_BLOCK_WORD|data-day-journal-end-of-day|data-day-journal-shipped/, 'no END OF DAY block');
  // PLAN-01 (2026-10-13): "accomplished:" on yesterday's END OF DAY and "not finished:" on its unticked steps — the attribute renamed with the words.
  // CLEAN-02 (2026-10-14) — Alex's ruling: no money on the journal card. YESTERDAY is its plan's ticks with what was left over, then its note
  // when typed; the END OF DAY line, the spent / largest / done numbers and the not-finished line are gone.
  // JOURNAL-03 (2026-10-15): the note after the ticks is gone — YESTERDAY is the ticks and what was left over.
  assert.doesNotMatch(plate, /data-day-yesterday-note|noteWords|yRow\.shipped/, 'YESTERDAY: no typed note');
  assert.match(plate, /data-day-yesterday-steps>\{yesterdayStepsWords\(yRow\)\}/);
  assert.doesNotMatch(plate, /data-day-yesterday-(end-of-day|spent|largest|done|not-finished)|tally|plannedCents|planDollars|statusWords|provenance/i, 'no money, no status, no source on the journal card');
  assert.match(plate, /\{a\.goals\.map\(\(goal, i\) => \(\n\s*<div [^>]*data-day-journal-goal>\{goalWords\(goal\)\}<\/div>/, 'TODAY: the goals as a list');
  // DECK-01 (Alex, 2026-10-16): a block with no answer is left out — the BLOCKERS block renders only with a blocker, and prints it alone.
  assert.match(plate, /\{row !== null && a\.blocker !== null && \(\n\s*<div [^>]*data-day-journal-blockers>[\s\S]*?data-day-journal-blocker>\{a\.blocker\}<\/div>/);
  // JOURNAL-03 (2026-10-15): "END OF DAY — until typed" is gone with the block (pinned absent above).
  assert.match(plate, /\{a\.plan_steps\.map\(\(step, i\) => \(\n\s*<button\n\s*type="button"[\s\S]*?onClick=\{\(\) => tick\(i\)\}[\s\S]*?>\{planStepWords\(i \+ 1, step, a\.plan_done\[i\]\)\}<\/button>/, 'a button per step, ☐/✓ n. step');
  assert.match(plate, /data-day-journal-plan-done>\{planDoneWords\(a\.plan_done\.filter\(\(d\) => d\)\.length, a\.plan_steps\.length\)\}/, '"n of N done" under the list');
  // JOURNAL-03 (2026-10-15): the four answers as held — no shipped; the pin moved, as exact.
  // JOURNAL-04 (Alex, 2026-10-19): the row spread whole (answersOf — the seven), that one flag flipped; the pin moved with it, as exact.
  assert.match(plate, /const read = journalInput\(\{ day, \.\.\.answersOf\(row\), plan_done: row\.plan_done\.map\(\(d, j\) => \(j === i \? !d : d\)\) \}\);/, 'the whole journal as held, that one flag flipped, through the route’s rule');
  inOrder(plate, ['if (row === null || busyStep !== null) return;', 'if (!read.ok) { setTickWords(read.message); return; }', 'setBusyStep(i);', 'const answer = await writeJournal(day, read.value.answers);', 'if (!answer.ok) { setTickWords(answer.message); return; }', 'onChanged();', 'setBusyStep(null);'], 'busy, the one writer, the route’s words on a refusal, the journal read again');
  assert.match(plate, /disabled=\{busyStep !== null\}\n\s*aria-pressed=\{a\.plan_done\[i\]\}/, 'no second tick while one writes; the tick’s state is announced');
  assert.match(plate, /data-day-journal-tick-words>\{tickWords\}/);
  assert.doesNotMatch(plate, /set(Row|Answers|Draft)\(/, 'no optimistic copy — the plate shows what the journal read answers');
  assert.doesNotMatch(c, /\.retired\b|\b(adjustment|one_thing|witness|plan_\d_(if|then)|obstacle_(if|then)|shipped)\b/, 'the card reads no retired answer — JOURNAL-03: shipped among them');
});

test('T7 the stop form: a journal stop’s RECORD row says what the record is; nothing else changes', () => {
  const s = code(STOP_FORM);
  assert.match(s, /\{role === 'journal'\n\s*\? <span className="text-text-faint tracking-wide" data-stop-record-label>\{JOURNAL_RECORD_WORDS\}<\/span>\n\s*: <span className="text-text-faint uppercase tracking-wide" data-stop-record-label>Record<\/span>\}/, 'not uppercased — the words read as written');
  assert.match(s, /import \{ JOURNAL_RECORD_WORDS \} from '@\/lib\/operations\/journal';/);
  assert.match(s, /: role === 'journal'\n\s*\? \{ amount: false, rating: false, minutes: true, note: draft\.outcome === 'skipped' \}/, 'a journal stop still asks the minutes only (JOURNAL-01)');
});
