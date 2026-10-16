/**
 * PLAN-01 (2026-10-13) — COPY PLAN PROMPT: the journal hands yesterday and today to Claude; the plan comes back as steps.
 * With it, Alex's rulings of 2026-10-13: the card 640 wide, LOCATION off the table, "spent —" when nothing is
 * recorded, the PLAN and SPENT bars, and the record's time box naming its zone.
 *
 * The pure words (planPromptText, stripListMarker, timeBoxWords, the bars' words) are DRIVEN; the form, the plate
 * and the stop form are anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import {
  COPY_PLAN_PROMPT_WORDS, LIST_MAX, PLAN_PROMPT_ASK, PLAN_PROMPT_COPIED_WORDS,
  RETIRED_FIELDS, answersOf, journalRowOf, planPromptFailedWords, planPromptText, planPromptWaitsWords, stripListMarker, yesterdayStepsWords,
} from '../operations/journal';
import { TIME_BOX_WORDS, timeBoxWords } from '../operations/stopRecord';
import { BARS_NOTHING_PLANNED_WORDS, BARS_PLAN_NOT_READ_WORDS, PLATE_WIDTH, overByWords, planSoFarWords, spentSoFarWords } from '@/components/workbench/operations/day/dayCard';

const RULE = 'src/lib/operations/journal.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';

const ASK = "Audit the temple-stuart-accounting repo where you need to, then give me today's plan as numbered steps, one per line, plain text, at most 12 steps, each under 200 characters — each a step I can tick off (a Claude Code prompt to send is a step). After the steps, give me any Claude Code prompts the steps need.";

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── T1 · THE PLAN PROMPT ─────────────────────────────────────────────────────

// CLEAN-02 (2026-10-14) — Alex's ruling: yesterday in the prompt is its steps (done of all), what was left over, and its note — the
// "Yesterday — accomplished:" and "Yesterday — not finished:" lines are gone; everything else is unchanged. The texts below moved with it.
// JOURNAL-03 (Alex, 2026-10-15): END OF DAY is retired — the "Yesterday — note:" line is gone; everything else is unchanged. The
// fixture's END OF DAY words moved into the row's `retired` (as a row typed before JOURNAL-03 reads), and the texts moved with it.
test('T1 planPromptText, exactly: everything present', () => {
  const retired = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, null])) as Record<(typeof RETIRED_FIELDS)[number], string | null>;
  const text = planPromptText({
    dayWords: 'Tue Oct 13',
    yesterday: journalRowOf({
      ...answersOf({
        plan_steps: ['merge TABLE-01', 'book travel while CC runs', 'record brunch and dinner', 'screenshot the card', 'post the reel', 'reply to comments'],
        plan_done: [true, false, false, true, true, true],
      }),
      ...retired,
      shipped: 'merged TABLE-01; booked Chiang Mai',
      id: 'y', day: new Date('2026-10-12T00:00:00.000Z'), updated_at: new Date('2026-10-12T14:00:00.000Z'),
    }),
    goals: ['perfect the day cards', 'book travel for the rest of the trip'],
    blocker: 'CC runs long',
  });
  assert.equal(text, [
    'Day: Tue Oct 13',
    'Yesterday — steps: 4 of 6 done',
    'Yesterday — left over:',
    '- book travel while CC runs',
    '- record brunch and dinner',
    'Today — what I need to get done:',
    '- perfect the day cards',
    '- book travel for the rest of the trip',
    'Blockers: CC runs long',
    '',
    ASK,
  ].join('\n'));
  assert.equal(PLAN_PROMPT_ASK, ASK);
  assert.match(code(RULE), /at most \$\{LIST_MAX\.plan_steps\.lines\} steps, each under \$\{LIST_MAX\.plan_steps\.characters\} characters/, 'the ask’s limits are the plan’s own');
  assert.deepEqual([LIST_MAX.plan_steps.lines, LIST_MAX.plan_steps.characters], [12, 200]);
});

test('T1 planPromptText, exactly: no journal yesterday, no goals, no blocker — "no journal", "none", "none typed"; never invented', () => {
  assert.equal(planPromptText({ dayWords: 'Wed Oct 14', yesterday: null, goals: [], blocker: null }), [
    'Day: Wed Oct 14',
    'Yesterday — steps: no journal',
    'Yesterday — left over:',
    '- none',
    'Today — what I need to get done:',
    '- none typed',
    'Blockers: none typed',
    '',
    ASK,
  ].join('\n'));
  // CLEAN-02: a journal with no plan, and one with every step ticked and no note.
  // JOURNAL-03 (2026-10-15): yesterday's head is three lines — "Yesterday — note: none" is gone; the next line is today's.
  const head = (text: string) => text.split('\n').slice(1, 5);
  assert.deepEqual(head(planPromptText({ dayWords: 'Wed Oct 14', yesterday: answersOf({ goals: ['g'] }), goals: [], blocker: null })), ['Yesterday — steps: no plan', 'Yesterday — left over:', '- none', 'Today — what I need to get done:']);
  assert.deepEqual(head(planPromptText({ dayWords: 'Wed Oct 14', yesterday: answersOf({ plan_steps: ['a', 'b'], plan_done: [true, true] }), goals: [], blocker: null })), ['Yesterday — steps: all 2 done', 'Yesterday — left over:', '- none', 'Today — what I need to get done:']);
  // Every line is a constant or built from one — the function names no other text.
  const fn = /export function planPromptText\(input: PlanPromptInput\): string \{([\s\S]*?)\n\}/.exec(code(RULE));
  assert.ok(fn !== null);
  const literals = [...new Set([...fn![1].matchAll(/'[^']*'/g)].map((m) => m[0]))].sort();
  assert.deepEqual(literals, ["''", "'\\n'"], 'no literal words in the function — only the blank line and the line break');
  const templates = [...fn![1].matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  // CLEAN-02 (2026-10-14): four built lines — the day, yesterday's steps, yesterday's note, the blockers (was three: the day, accomplished, the blockers).
  // JOURNAL-03 (2026-10-15): three built lines — the day, yesterday's steps, the blockers; yesterday's note is gone.
  assert.equal(templates.length, 3);
  assert.doesNotMatch(fn![1], /shipped|retired|PLAN_PROMPT_NOTE/, 'the prompt reads no END OF DAY, typed before or not');
  for (const t of templates) assert.match(t, /^\$\{PLAN_PROMPT_[A-Z_]+\} \$\{/, `each built line starts with its constant: ${t}`);
});

test('T1 the form builds the prompt from the DRAFT — the goals and the blocker as typed, not only what is saved', () => {
  const f = code(FORM);
  // CLEAN-02 (2026-10-14): yesterday is handed over as its row (was its END OF DAY and its unticked steps).
  assert.match(f, /const blocker = linesOf\(draft\.blocker\)\.join\(' '\);\n\s*const text = planPromptText\(\{ dayWords: dayShortWords\(day\), yesterday: yesterday\.row, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: blocker === '' \? null : blocker \}\);/);
  const copy = f.slice(f.indexOf('const copyPrompt = async'), f.indexOf('const addOpen'));
  assert.doesNotMatch(copy, /journal\.(goals|blocker)/, 'never the saved goals in place of the draft');
});

// ── T2 · THE PASTED LIST ─────────────────────────────────────────────────────

test('T2 stripListMarker: a leading "1." "12)" "-" "•" "*" and a space is the list’s; nothing else changes', () => {
  assert.deepEqual(['1. a', '12) b', '- c', '• d', '* e'].map(stripListMarker), ['a', 'b', 'c', 'd', 'e']);
  for (const kept of ['1.5 kg rice', '-5 degrees', 'a - b', '-perfect the day cards', 'merge TABLE-01', '1.', '-']) assert.equal(stripListMarker(kept), kept, `${kept} stays as typed`);
  assert.equal(stripListMarker('2. - x'), '- x', 'one marker, the leading one');
  const f = code(FORM);
  assert.match(f, /const steps = linesOf\(draft\.plan\)\.map\(stripListMarker\);\n\s*const ticks = carryTicks\(/, 'the plan: split, trimmed, blank-dropped, marker off — then the ticks carried');
  assert.match(f, /goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: draft\.blocker === '' \? null : draft\.blocker, plan_steps: steps,/, 'the goals too (Alex, 2026-10-13: "-perfect…" and "- perfect…")');
});

// ── T3 · THE BUTTON ──────────────────────────────────────────────────────────

test('T3 "copy plan prompt": beside the PLAN, writes planPromptText to the clipboard, says copied or the refusal, and tries nothing else', () => {
  const f = code(FORM);
  assert.match(f, /<button type="button" className=\{chip\} disabled=\{!yesterday\.ok\} onClick=\{copyPrompt\} data-journal-copy-prompt>\{COPY_PLAN_PROMPT_WORDS\}<\/button>/);
  inOrder(f, ['{PLAN_QUESTION}</label>', 'data-journal-copy-prompt', 'data-journal-field="plan_steps"'], 'next to the PLAN box');
  inOrder(f, ['const copyPrompt = async () => {', 'if (!yesterday.ok) return;', 'const text = planPromptText({', 'setCopyWords(null);', 'try {', 'await navigator.clipboard.writeText(text);', 'setCopyWords({ ok: true, words: PLAN_PROMPT_COPIED_WORDS });', '} catch (error) {', 'setCopyWords({ ok: false, words: planPromptFailedWords(error instanceof Error ? error.message : String(error)) });'], 'build, write, say');
  assert.match(f, /\} catch \(error\) \{\n\s*setCopyWords\(\{ ok: false, words: planPromptFailedWords\(error instanceof Error \? error\.message : String\(error\)\) \}\);\n\s*\}\n\s*\};/, 'on a refusal: its words, and nothing else');
  assert.equal((f.match(/navigator\.clipboard/g) ?? []).length, 1, 'one write — no second path');
  assert.doesNotMatch(f, /execCommand|\.select\(\)|document\.createElement/, 'no fallback copy');
  assert.match(f, /\{copyWords !== null && <p className=\{copyWords\.ok \? 'text-text-muted' : 'text-brand-red'\} data-journal-copy-words>\{copyWords\.words\}<\/p>\}/, 'the words under the button');
  assert.match(f, /\{!yesterday\.ok && <p className="text-text-muted" data-journal-copy-waits>\{planPromptWaitsWords\(yesterday\.words\)\}<\/p>\}/, 'yesterday unknown: said, the button off — never "nothing typed" for an unknown');
  assert.equal(COPY_PLAN_PROMPT_WORDS, 'copy plan prompt');
  assert.equal(PLAN_PROMPT_COPIED_WORDS, 'copied — paste it into Claude');
  assert.equal(planPromptFailedWords('Write permission denied.'), 'could not copy the plan prompt — Write permission denied.');
  assert.equal(planPromptWaitsWords('reading yesterday…'), 'the plan prompt needs yesterday\'s journal — reading yesterday…');
});

// ── T4 · HIS WORDS ON THE PLATE ──────────────────────────────────────────────

// CLEAN-02 (2026-10-14) — Alex's ruling: "accomplished:" became "note:" (only when typed) and "not finished: a · b" became
// yesterdayStepsWords' "4 of 6 steps done · left over: a · b"; ACCOMPLISHED_WORD, accomplishedWords and notFinishedWords are deleted.
// JOURNAL-03 (Alex, 2026-10-15): END OF DAY is retired — "note:" on its text is gone, noteWords deleted; the pins moved to "gone".
// DECK-01 (Alex, 2026-10-16) — DECLUTTERED: "left over: a · b" became the count "2 left over"; the steps themselves are the form's and the prompt's.
test('T4 the plate’s YESTERDAY: the steps done and the count left over; no "note:" (JOURNAL-03)', () => {
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: ['merge', 'book travel', 'record brunch'], plan_done: [true, false, false] })), '1 of 3 steps done · 2 left over');
  const c = code(CARD);
  assert.doesNotMatch(c + code(RULE), /data-day-yesterday-note|\bnoteWords\b|\bNOTE_WORD\b|'note:'/, 'the note on yesterday’s END OF DAY is gone');
  assert.match(c, /data-day-yesterday-steps>\{yesterdayStepsWords\(yRow\)\}/);
  // PLAN-01 (2026-10-13) pinned leftOpenWords ("left open:") gone; CLEAN-02 (2026-10-14, the pin moved — Alex named leftOpenWords for
  // notFinishedWords): the words that replaced it are gone too, and so is "accomplished:".
  assert.doesNotMatch(c + code(RULE), /leftOpenWords|left open:|notFinishedWords|not finished:|ACCOMPLISHED_WORD|accomplishedWords|accomplished:/, 'the old words are gone');
});

// ── T5 · THE WIDTH ───────────────────────────────────────────────────────────

test('T5 one width: the plate, the hint, the foot and both forms under it are PLATE_WIDTH (640) — no width typed', () => {
  assert.equal(PLATE_WIDTH, 640);
  for (const f of [CARD, FORM, STOP_FORM]) assert.doesNotMatch(code(f), /\b540\b/, `${f}: no 540 left`);
  assert.match(code(FORM), /style=\{\{ width: PLATE_WIDTH \}\} data-journal-form>/);
  assert.match(code(STOP_FORM), /style=\{\{ width: PLATE_WIDTH \}\} data-stop-form>/);
  const c = code(CARD);
  // CLEAN-02 (2026-10-14): the download button's row and the fine print are at the plate's width too.
  // DECK-01 (Alex, 2026-10-16): the plate stays PLATE_WIDTH (the deck scales it on a phone); everything under the deck is `under` — the
  // plate's width, or the screen's when that is narrower. One constant still; no width typed.
  assert.match(c, /width: PLATE_WIDTH[\s\S]{0,120}?\}\} data-day-card/, 'data-day-card at the plate’s width');
  assert.match(c, /const under = \{ width: '100%', maxWidth: PLATE_WIDTH \} as const;/);
  for (const attr of ['data-day-hint', 'data-day-foot', 'data-day-image', 'data-day-fine-print']) assert.match(c, new RegExp(`style=\\{under\\} ${attr}`), `${attr} at the plate’s width, or the screen’s`);
});

// ── T6 · THE TWO BARS ────────────────────────────────────────────────────────

test('T6 the step view’s two bars: PLAN (gold) and SPENT (green), each with its words; over the total, "over by"; unknown, said', () => {
  assert.equal(planSoFarWords(1000, 7500), 'plan so far $10 of $75');
  // CLEAN-02 (2026-10-14) — Alex's ruling: no "N without an amount" beside the spent so far.
  assert.equal(spentSoFarWords(225, 7500), 'spent so far $2.25 of $75');
  assert.equal(overByWords(500), 'over by $5');
  assert.equal(BARS_PLAN_NOT_READ_WORDS, 'no bars — the day’s planned total is not known (the Budget’s plan lines were not read)');
  assert.equal(BARS_NOTHING_PLANNED_WORDS, 'no bars — nothing is planned for the day');
  const c = code(CARD);
  // CLEAN-02 (2026-10-14): the bars' why-line prints under the plate, in the fine print — still after the bars in the screen's order.
  // DECK-01 (Alex, 2026-10-16): each stop card's bars are barsOf(f) — bars.planBar, bars.spentBar, bars.overCents; the why-line under the deck is the card in view's.
  inOrder(c, ['data-day-plan-so-far>', 'data-day-plan-bar={bars.planBar}', 'data-day-spent-so-far>', 'data-day-spent-bar={bars.spentBar}', 'data-day-fine-print>', 'data-day-bars-why>'], 'the plan words and bar, then the spent words and bar, then — under the deck — why there are none');
  // TOTALS-01 amendment II (Alex, 2026-10-15): moved, not loosened — "over by" is past the TOTAL row's BUDGET (totals.budgetCents), and the
  // why-line is barsWhyWords, whose answers stay true when the hero has a plan the stops do not carry (totals01 T3 drives every case).
  assert.match(c, /overCents: f\.spentSoFarCents === null \|\| f\.withActualSoFar === 0 \|\| totals\.budgetCents === null \|\| f\.spentSoFarCents <= totals\.budgetCents \? null : f\.spentSoFarCents - totals\.budgetCents,/, 'over: the actuals past the total — the bar full (progressPercent clamps), the amount said');
  assert.match(c, /\{focus !== null && planBar === null && <p data-day-bars-why>\{barsWhyWords\(plannedCents, totals\.budgetCents\)\}<\/p>\}/, 'no bars without a total — and why, in the fine print (CLEAN-02)');
});

// ── T7 · THE TIME BOX NAMES ITS ZONE ─────────────────────────────────────────

test('T7 the record’s time box: "HH:MM" in the browser’s zone, "HH:MM (America/Los_Angeles)" when the routine reads it in another; the rule unchanged', () => {
  assert.equal(TIME_BOX_WORDS, 'HH:MM');
  assert.equal(timeBoxWords('Asia/Bangkok', 'Asia/Bangkok'), 'HH:MM');
  assert.equal(timeBoxWords('America/Los_Angeles', 'Asia/Bangkok'), 'HH:MM (America/Los_Angeles)');
  const s = code(STOP_FORM);
  assert.match(s, /placeholder=\{timeBoxWords\(zone, viewerZone\)\} title=\{timeBoxWords\(zone, viewerZone\)\} aria-label=\{`Done at \(\$\{zone\}\)`\} className=\{`\$\{box\} \$\{zone === viewerZone \? 'w-16' : 'w-56'\} font-mono`\}/, 'the box says the zone it reads the time in, wide enough to show it');
  assert.match(s, /doneAt = zonedToInstant\(d\.doneDay, d\.doneTime, zone\)\.toISOString\(\);/, 'the time is still read in the routine’s zone — no change to the rule');
  assert.match(code(CARD), /<StopForm key=\{[^}]*\}[^>]*viewerZone=\{zone\}/, 'the card hands the stop form the browser’s zone');
});
