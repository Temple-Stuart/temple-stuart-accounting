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
  ACCOMPLISHED_WORD, COPY_PLAN_PROMPT_WORDS, LIST_MAX, PLAN_PROMPT_ASK, PLAN_PROMPT_COPIED_WORDS,
  accomplishedWords, notFinishedWords, planPromptFailedWords, planPromptText, planPromptWaitsWords, stripListMarker,
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

test('T1 planPromptText, exactly: everything present', () => {
  const text = planPromptText({
    dayWords: 'Tue Oct 13',
    yesterdayAccomplished: 'merged TABLE-01; booked Chiang Mai',
    yesterdayNotFinished: ['book travel while CC runs', 'record brunch and dinner'],
    goals: ['perfect the day cards', 'book travel for the rest of the trip'],
    blocker: 'CC runs long',
  });
  assert.equal(text, [
    'Day: Tue Oct 13',
    'Yesterday — accomplished: merged TABLE-01; booked Chiang Mai',
    'Yesterday — not finished:',
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

test('T1 planPromptText, exactly: nothing yesterday, no goals, no blocker — "nothing typed", "none", "none typed"; never invented', () => {
  assert.equal(planPromptText({ dayWords: 'Wed Oct 14', yesterdayAccomplished: null, yesterdayNotFinished: [], goals: [], blocker: null }), [
    'Day: Wed Oct 14',
    'Yesterday — accomplished: nothing typed',
    'Yesterday — not finished:',
    '- none',
    'Today — what I need to get done:',
    '- none typed',
    'Blockers: none typed',
    '',
    ASK,
  ].join('\n'));
  // Every line is a constant or built from one — the function names no other text.
  const fn = /export function planPromptText\(input: PlanPromptInput\): string \{([\s\S]*?)\n\}/.exec(code(RULE));
  assert.ok(fn !== null);
  const literals = [...new Set([...fn![1].matchAll(/'[^']*'/g)].map((m) => m[0]))].sort();
  assert.deepEqual(literals, ["''", "'\\n'"], 'no literal words in the function — only the blank line and the line break');
  const templates = [...fn![1].matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  assert.equal(templates.length, 3);
  for (const t of templates) assert.match(t, /^\$\{PLAN_PROMPT_[A-Z_]+\} \$\{/, `each built line starts with its constant: ${t}`);
});

test('T1 the form builds the prompt from the DRAFT — the goals and the blocker as typed, not only what is saved', () => {
  const f = code(FORM);
  assert.match(f, /const blocker = linesOf\(draft\.blocker\)\.join\(' '\);\n\s*const text = planPromptText\(\{ dayWords: dayShortWords\(day\), yesterdayAccomplished: yesterday\.accomplished, yesterdayNotFinished: yesterday\.notFinished, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: blocker === '' \? null : blocker \}\);/);
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

test('T4 the plate’s YESTERDAY: "accomplished:" on the END OF DAY text, "not finished:" on the steps not ticked', () => {
  assert.equal(ACCOMPLISHED_WORD, 'accomplished:');
  assert.equal(accomplishedWords('merged TABLE-01'), 'accomplished: merged TABLE-01');
  assert.equal(accomplishedWords(null), 'accomplished: —');
  assert.equal(notFinishedWords(['book travel', 'record brunch']), 'not finished: book travel · record brunch');
  const c = code(CARD);
  assert.match(c, /data-day-yesterday-end-of-day>\{accomplishedWords\(yRow\.shipped\)\}/);
  assert.match(c, /data-day-yesterday-not-finished>\{notFinishedWords\(yOpen\)\}/);
  assert.doesNotMatch(c + code(RULE), /leftOpenWords|left open:/, 'the old words are gone');
});

// ── T5 · THE WIDTH ───────────────────────────────────────────────────────────

test('T5 one width: the plate, the hint, the foot and both forms under it are PLATE_WIDTH (640) — no width typed', () => {
  assert.equal(PLATE_WIDTH, 640);
  for (const f of [CARD, FORM, STOP_FORM]) assert.doesNotMatch(code(f), /\b540\b/, `${f}: no 540 left`);
  assert.match(code(FORM), /style=\{\{ width: PLATE_WIDTH \}\} data-journal-form>/);
  assert.match(code(STOP_FORM), /style=\{\{ width: PLATE_WIDTH \}\} data-stop-form>/);
  const c = code(CARD);
  for (const attr of ['data-day-card', 'data-day-hint', 'data-day-foot']) assert.match(c, new RegExp(`width: PLATE_WIDTH[\\s\\S]{0,120}?\\}\\} ${attr}`), `${attr} at the plate’s width`);
});

// ── T6 · THE TWO BARS ────────────────────────────────────────────────────────

test('T6 the step view’s two bars: PLAN (gold) and SPENT (green), each with its words; over the total, "over by"; unknown, said', () => {
  assert.equal(planSoFarWords(1000, 7500), 'plan so far $10 of $75');
  assert.equal(spentSoFarWords(225, 1, 1, 7500), 'spent so far $2.25 of $75 · 1 without an amount');
  assert.equal(overByWords(500), 'over by $5');
  assert.equal(BARS_PLAN_NOT_READ_WORDS, 'no bars — the day’s planned total is not known (the Budget’s plan lines were not read)');
  assert.equal(BARS_NOTHING_PLANNED_WORDS, 'no bars — nothing is planned for the day');
  const c = code(CARD);
  inOrder(c, ['data-day-plan-so-far>', 'data-day-plan-bar={planBar}', 'data-day-spent-so-far>', 'data-day-spent-bar={spentBar}', 'data-day-bars-why>'], 'the plan words and bar, then the spent words and bar');
  assert.match(c, /const overCents = focus === null \|\| focus\.spentSoFarCents === null \|\| focus\.withActualSoFar === 0 \|\| plannedCents === null \|\| focus\.spentSoFarCents <= plannedCents \? null : focus\.spentSoFarCents - plannedCents;/, 'over: the actuals past the total — the bar full (progressPercent clamps), the amount said');
  assert.match(c, /\{planBar === null && <div [^>]*data-day-bars-why>\{plannedCents === null \? BARS_PLAN_NOT_READ_WORDS : BARS_NOTHING_PLANNED_WORDS\}<\/div>\}/, 'no bars without a total — and why');
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
