/**
 * JOURNAL-05 (Alex, 2026-10-19) — THE TWO JOURNAL CARDS: MORNING (planning)
 * with last night's "where next" on top, and EVENING (reflection) with "copy
 * audit prompt", the pasted audit, what I learned, where next — one row per
 * day, every writer sending the whole row.
 *
 * The audit prompt (src/lib/operations/journal.ts auditPromptText) is DRIVEN
 * over a full day, a day with no plan and a day with a skipped stop; the two
 * forms' save bodies are driven through the route's own rule (journalInput) to
 * prove no loss; the card, the forms, the words and the laws are anchored to
 * their source with comments stripped (TEST-TRUTH-01). The pins that moved in
 * journal01, journal02, plan01-copy-prompt and daycard01 carry dated notes
 * there; the three-file pin of the day folder did not move — the new form
 * lives in stops/, as every form does.
 *
 * JOURNAL-06 (Alex, 2026-10-20): the audit prompt became the REFLECTION prompt
 * (reflectionPromptText — the same day lines, then THE BACKLOG, WHAT MOVED
 * TODAY, THE ANSWERS and THE ASK; journal06.test.ts drives the three sections),
 * the evening form asks SEVEN (ACCOMPLISHED · GAPS · EVOLUTION · DIRECTION ·
 * ALIGNMENT · ON TRACK · NEXT), learned is retired and the plate shows
 * ACCOMPLISHED and NEXT. Every pin here moved with it, dated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  AUDIT_PROMPT_BLOCKER, AUDIT_PROMPT_DAY, AUDIT_PROMPT_GOALS, AUDIT_PROMPT_NO_PLAN, AUDIT_PROMPT_NO_STOPS, AUDIT_PROMPT_PLAN,
  AUDIT_PROMPT_STOPS, AUDIT_PROMPT_TOTALS, AUDIT_WORD, COPY_REFLECTION_PROMPT_WORDS, EVENING_ALIGNMENT_QUESTION, EVENING_AUDIT_QUESTION, EVENING_BLANK_WORD, EVENING_DIRECTION_QUESTION,
  EVENING_EVOLUTION_QUESTION, EVENING_GAPS_QUESTION, EVENING_NEXT_PLACEHOLDER, EVENING_NEXT_QUESTION, EVENING_ON_TRACK_QUESTION, EVENING_SAVE_WORDS, EVENING_WORD, LAST_NIGHT_WORD,
  MORNING_BLOCKER_QUESTION, MORNING_GOALS_QUESTION, MORNING_PLAN_QUESTION, MORNING_WORD,
  NEXT_WORD, NOTHING_TYPED_WORDS, NO_PLAN_TODAY_WORDS, PLAN_PROMPT_ASK, REFLECTION_PROMPT_ASK, REFLECTION_PROMPT_COPIED_WORDS, TODAY_TICKS_WORD, VERDICT_WORD,
  answersOf, auditStepWords, auditStopWords, auditTotalsWords, clearJournalQuestion, journalInput, lastNightWords,
  planPromptText, reflectionPromptFailedWords, reflectionPromptText, reflectionPromptWaitsWords, todayStepsWords, yesterdayStepsWords,
  type Answers, type ReflectionPromptInput,
} from '../operations/journal';

const RULE = 'src/lib/operations/journal.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const MORNING_FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const EVENING_FORM = 'src/components/workbench/operations/stops/EveningForm.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const DAY = '2026-10-12';

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}
const accepted = (body: unknown): Answers => {
  const r = journalInput(body);
  assert.ok(r.ok, r.ok ? '' : `${r.field}: ${r.message}`);
  return r.ok ? r.value.answers : answersOf({});
};

// ── THE FIXTURE: a full day, as the card hands it ───────────────────────────

const FULL: ReflectionPromptInput = {
  dayWords: 'Mon Oct 12',
  journal: answersOf({ goals: ['post the reel', 'book travel'], blocker: 'the clipboard in a headless browser', plan_steps: ['merge TABLE-01', 'book travel while CC runs', 'record brunch and dinner'], plan_done: [true, true, false] }),
  // REEL-02 (Alex, 2026-10-19): each stop says whether its form asks an amount (the card's asksAmount); the journal stop asks none and
  // hands its outcome instead of "budget —, actual —". Moved, not loosened.
  stops: [
    { name: 'Coffee', vendor: 'Luka Café', asksAmount: true, budgetWords: '$10', actualWords: '$8.98 ▼ $1.02' },
    { name: 'Brunch', vendor: null, asksAmount: true, budgetWords: '$25', actualWords: '$22 ▼ $3' },
    { name: 'Activities', vendor: 'Viator', asksAmount: true, budgetWords: '$20', actualWords: 'skipped' },
    { name: 'Dinner', vendor: null, asksAmount: true, budgetWords: '$30', actualWords: '—' },
    { name: 'Journal', vendor: null, asksAmount: false, outcomeWords: 'done' },
  ],
  budgetWords: '$85',
  actualWords: '$30.98',
  verdictWords: '▼ $54.02 under',
  // JOURNAL-06 (Alex, 2026-10-20): THE BACKLOG and WHAT MOVED TODAY follow the day's lines — empty here; journal06.test.ts drives them full.
  backlog: [],
  moved: [],
};

// ── R4 · THE AUDIT PROMPT — JOURNAL-06: THE REFLECTION PROMPT'S DAY LINES ──

test('R4 reflectionPromptText — a full day: the day, the goals, the blocker, the plan with its ticks, every stop with its budget and actual in order, the totals with the verdict; then (JOURNAL-06) THE BACKLOG, WHAT MOVED TODAY, THE ANSWERS and THE ASK; every line a constant or built from one', () => {
  // JOURNAL-06 (Alex, 2026-10-20): the day's lines as JOURNAL-05 had them, verbatim; the three sections and THE ASK after them (journal06.test.ts drives them full).
  assert.equal(reflectionPromptText(FULL), [
    'Day: Mon Oct 12',
    'Goals:',
    '- post the reel',
    '- book travel',
    'Blocker: the clipboard in a headless browser',
    'Plan — steps and ticks:',
    '- ✓ merge TABLE-01',
    '- ✓ book travel while CC runs',
    '- ✗ record brunch and dinner',
    'Stops — budget vs actual:',
    '- Coffee at Luka Café — budget $10, actual $8.98 ▼ $1.02',
    '- Brunch — budget $25, actual $22 ▼ $3',
    '- Activities at Viator — budget $20, actual skipped',
    '- Dinner — budget $30, actual —',
    '- Journal — done',
    'Totals: budget $85, actual $30.98, ▼ $54.02 under',
    '',
    'THE BACKLOG',
    '- — no open projects —',
    '',
    'WHAT MOVED TODAY',
    '- — nothing recorded —',
    '',
    'THE ANSWERS',
    'GAPS: — not answered —',
    'EVOLUTION: — not answered —',
    'DIRECTION: — not answered —',
    'ALIGNMENT: — not answered —',
    'ON TRACK: — not answered —',
    'NEXT: — not answered —',
    '',
    REFLECTION_PROMPT_ASK,
  ].join('\n'));
  assert.deepEqual([AUDIT_PROMPT_DAY, AUDIT_PROMPT_GOALS, AUDIT_PROMPT_BLOCKER, AUDIT_PROMPT_PLAN, AUDIT_PROMPT_STOPS, AUDIT_PROMPT_TOTALS, AUDIT_PROMPT_NO_PLAN, AUDIT_PROMPT_NO_STOPS], ['Day:', 'Goals:', 'Blocker:', 'Plan — steps and ticks:', 'Stops — budget vs actual:', 'Totals:', 'no plan', 'no stops']);
  assert.equal(auditStepWords('merge TABLE-01', true), '✓ merge TABLE-01');
  assert.equal(auditStepWords('post the reel', false), '✗ post the reel');
  assert.equal(auditStopWords({ name: 'Brunch', vendor: 'Luka Café', asksAmount: true, budgetWords: '$25', actualWords: '$22 ▼ $3' }), '- Brunch at Luka Café — budget $25, actual $22 ▼ $3');
  assert.equal(auditTotalsWords('$85', '$30.98', null), 'budget $85, actual $30.98', 'no verdict words when the card shows none');
  assert.equal(reflectionPromptWaitsWords('reading the records…'), 'the reflection prompt needs the day\'s reads — reading the records…');
  assert.equal(reflectionPromptFailedWords('denied'), 'could not copy the reflection prompt — denied');
});

test('R4 reflectionPromptText — a day with no journal and no plan, a day with a skipped stop and no verdict, a day with no stops: said by name, nothing invented', () => {
  const noJournal = reflectionPromptText({ ...FULL, journal: null, verdictWords: null });
  inOrder(noJournal, ['Goals:\n- none typed', 'Blocker: none', 'Plan — steps and ticks:\n- no plan', 'Totals: budget $85, actual $30.98\n\nTHE BACKLOG'], 'no journal: none typed, none, no plan; no verdict words');
  const noPlan = reflectionPromptText({ ...FULL, journal: answersOf({ goals: ['one goal'] }) });
  inOrder(noPlan, ['Goals:\n- one goal', 'Blocker: none', 'Plan — steps and ticks:\n- no plan'], 'a journal with goals but no plan');
  const skipped = reflectionPromptText({ ...FULL, stops: [{ name: 'Activities', vendor: 'Viator', asksAmount: true, budgetWords: '$20', actualWords: 'skipped' }], verdictWords: null });
  assert.match(skipped, /Stops — budget vs actual:\n- Activities at Viator — budget \$20, actual skipped\nTotals: budget \$85, actual \$30\.98\n\nTHE BACKLOG/, 'the skipped stop named as the card names it; no verdict');
  assert.match(reflectionPromptText({ ...FULL, stops: [] }), /Stops — budget vs actual:\n- no stops\n/);
  // Pure, and no second plan prompt: the two prompts share the none words and nothing else.
  const rule = code(RULE);
  assert.doesNotMatch(rule, /\bfetch\b|@prisma\/client|from 'react'|from 'next|navigator\./, 'pure');
  assert.match(rule, /export function reflectionPromptText\(input: ReflectionPromptInput\): string \{/);
  assert.match(rule, /export interface ReflectionPromptInput \{\n\s*readonly dayWords: string;\n[\s\S]*?readonly journal: Answers \| null;\n[\s\S]*?readonly stops: readonly AuditPromptStop\[\];\n[\s\S]*?readonly budgetWords: string;\n\s*readonly actualWords: string;\n[\s\S]*?readonly verdictWords: string \| null;\n[\s\S]*?readonly backlog: readonly ReflectionBacklogRow\[\];\n[\s\S]*?readonly moved: readonly ReflectionMovedRow\[\];\n\}/, 'the input type — the card hands words, not figures; JOURNAL-06: the backlog and what moved, as read');
  assert.match(rule, /export type ReflectionPromptState = \{ readonly ok: true; readonly text: string \} \| \{ readonly ok: false; readonly words: string \};/);
  assert.equal(PLAN_PROMPT_ASK.startsWith('Audit the temple-stuart-accounting repo'), true, 'the plan prompt’s text is untouched (R7)');
  assert.equal(planPromptText({ dayWords: 'Mon Oct 12', yesterday: null, goals: [], blocker: null }).split('\n')[1], 'Yesterday — steps: no journal');
});

test('R4 the card builds the input from its OWN reads and words, and offers the prompt only once every read is in — the gating "copy script" uses; nothing paid, nothing leaves the browser but the clipboard', () => {
  const c = code(CARD);
  // JOURNAL-06 (Alex, 2026-10-20): the reflection prompt waits on the reel's reads AND its own two (the backlog, what moved) — journal06.test.ts pins the gating in full.
  assert.match(c, /const dayWait = reelReadsWords\(reelReads\);/, 'the same reads the reel waits on, the journal included');
  assert.match(c, /const reflectionPrompt: ReflectionPromptState = \(\(\) => \{\n\s*if \(dayWait !== null\) return \{ ok: false, words: reflectionPromptWaitsWords\(dayWait\) \};/, 'not offered while a read is in flight or failed');
  // REEL-02 (Alex, 2026-10-19): the stop line is built by asksAmount(s.role) — the card's own rule: money words for a stop that asks an amount,
  // the outcome in the card's own words for one that asks none (reel02.test.ts R6). Moved, not loosened.
  inOrder(c, ['dayWords: dayShortWords(day),', 'journal: reelJournal,', 'stops: result.stops.map((s) => (asksAmount(s.role)', "? { name: stopName(s), vendor: s.vendor, asksAmount: true, budgetWords: factOf(s.cents === null ? null : planDollars(s.cents)), actualWords: s.status === 'skipped' ? SKIPPED_WORD : s.actualCents === null ? factOf(null) : rowActualWords(s.actualCents, s.cents) }", ": { name: stopName(s), vendor: s.vendor, asksAmount: false, outcomeWords: s.status === 'done' ? DONE_WORD : s.status === 'skipped' ? SKIPPED_WORD : NOT_RECORDED_WORDS })),", 'budgetWords: factOf(totals.budgetCents === null ? null : planDollars(totals.budgetCents)),', 'actualWords: factOf(totals.actualCents === null ? null : planDollars(totals.actualCents)),', 'verdictWords: verdict === null ? null : verdict.text,', 'backlog: backlogRead.value,', 'moved: movedRead.value,'], 'the card’s own words for every stop and the TOTAL row, the verdict as the card says it; JOURNAL-06: the two reads as read');
  assert.match(c, /import \{ DONE_WORD, NOT_RECORDED_WORDS, SKIPPED_WORD, starsWords, type StopRecordPlan, type StopRecordRow \} from '@\/lib\/operations\/stopRecord';/);
  const e = code(EVENING_FORM);
  assert.match(e, /if \(!reflectionPrompt\.ok\) return;\n\s*setCopyWords\(null\);\n\s*try \{\n\s*await navigator\.clipboard\.writeText\(reflectionPrompt\.text\);\n\s*setCopyWords\(\{ ok: true, words: REFLECTION_PROMPT_COPIED_WORDS \}\);\n\s*\} catch \(error\) \{\n\s*setCopyWords\(\{ ok: false, words: reflectionPromptFailedWords\(error instanceof Error \? error\.message : String\(error\)\) \}\);\n\s*\}/, 'the PLAN-01 shape — copied, or the clipboard’s refusal, nothing else tried');
  assert.match(e, /\{field === 'audit' && <button type="button" className=\{chip\} disabled=\{!reflectionPrompt\.ok\} onClick=\{copyPrompt\} data-evening-copy-prompt>\{COPY_REFLECTION_PROMPT_WORDS\}<\/button>\}/);
  assert.match(e, /\{field === 'audit' && !reflectionPrompt\.ok && <p className="text-text-muted" data-evening-copy-waits>\{reflectionPrompt\.words\}<\/p>\}/, 'disabled with its reason');
  for (const f of [EVENING_FORM, CARD]) assert.doesNotMatch(code(f), /\/api\/ai|\/api\/operations\/content|openai|anthropic|claude\.ai|fetch\(['"`]\/api\/ai/, `${f}: nothing paid`);
  assert.doesNotMatch(e, /\bfetch\s*\(|\/api\//, 'the form names no route — the one writer does');
});

// ── R1 · THE MORNING CARD ───────────────────────────────────────────────────

test('R1 the morning card: named MORNING_WORD first on the plate’s journal block; "Last night: …" above YESTERDAY’s counts only when yesterday’s row has a next; TODAY, BLOCKERS, PLAN and the tick unchanged; the reel buttons and the record row where they were; the morning form’s questions and its clear', () => {
  assert.equal(MORNING_WORD, 'MORNING — planning');
  assert.equal(LAST_NIGHT_WORD, 'Last night: ');
  assert.equal(lastNightWords('ship the two cards'), 'Last night: ship the two cards');
  const c = code(CARD);
  const plate = c.slice(c.indexOf('function JournalPlate('), c.indexOf('function PlateHeader('));
  inOrder(plate, ['data-day-journal>', '<div className="font-bold text-text-faint" style={plateLabel} data-day-journal-morning>{MORNING_WORD}</div>', 'data-day-journal-yesterday>', '{YESTERDAY_WORD}', 'data-day-yesterday-loading>', 'data-day-yesterday-journal-failed>', '{yesterday !== null && yesterday.ok && yRow !== null && yRow.next !== null && <div className="font-semibold text-text-primary break-words" style={plateLine} data-day-yesterday-next>{lastNightWords(yRow.next)}</div>}', 'data-day-yesterday-steps>{yesterdayStepsWords(yRow)}', 'data-day-journal-today>', 'data-day-journal-blockers>', 'data-day-journal-plan-block>'], 'MORNING first, then YESTERDAY with last night’s next above its counts, then the blocks as they were');
  assert.doesNotMatch(plate, /yRow\.next[^}]*'—'|EVENING_BLANK_WORD/, 'nothing printed when yesterday has no next — no "—"');
  assert.match(plate, /const read = journalInput\(\{ day, \.\.\.answersOf\(row\), plan_done: row\.plan_done\.map\(\(d, j\) => \(j === i \? !d : d\)\) \}\);/, 'the tick unchanged — the whole row as held with one flag flipped');
  // The section's order: the morning plate, the reel buttons, the record row, the morning form, then the evening plate and its form.
  const section = c.slice(c.indexOf('data-day-journal-section>'), c.indexOf('data-day-foot>'));
  inOrder(section, ['<PlateFrame>', '<Plate plateRef={(el) => { journalPlateRef.current = el; }} journal right={journalHeaderWords(journalStop.time)}>', '<JournalPlate key={day}', '</PlateFrame>', 'data-day-journal-reel>', 'data-day-download-image>', 'data-day-copy-script>', '<StopForm key={`${journalStop.key}:', '<JournalForm key={`${day}:', 'id="evening" data-day-evening-section>', '<PlateFrame>', '<Plate plateRef={noPlateRef} journal right={journalHeaderWords(journalStop.time)}>', '<EveningPlate journal={journalRead} verdict={verdict} />', '</PlateFrame>', '{journalRead !== null && journalRead.ok && (', '<EveningForm key={`${day}:${journalRead.value.journal === null ? \'none\' : journalRead.value.journal.id}`} day={day} journal={journalRead.value.journal} reflectionPrompt={reflectionPrompt} onChanged={() => setJournalReads((n) => n + 1)} />'], 'morning plate → reel buttons → record row → morning form → evening plate → evening form');
  assert.equal((section.match(/<StopForm /g) ?? []).length, 1, 'the journal’s record row, once, under the morning plate');
  assert.equal((section.match(/data-day-journal-reel>/g) ?? []).length, 1, 'the reel buttons, once, under the morning plate');
  assert.doesNotMatch(section.slice(section.indexOf('data-day-evening-section>')), /data-day-download-image|data-day-copy-script|data-day-copy-caption|<StopForm|planDollars|data-day-plan-bar|data-day-spent-bar/, 'no image, no reel button, no record row, no money on the evening card');
  // The morning form: the three questions, the save, the clear with its wider question; "+ yesterday's open steps" and "copy plan prompt" as they were.
  const f = code(MORNING_FORM);
  assert.deepEqual([MORNING_GOALS_QUESTION, MORNING_BLOCKER_QUESTION, MORNING_PLAN_QUESTION], ['What must be true by tonight? One per line.', 'What could stop it?', 'The plan — copy the plan prompt, paste the steps from chat, one per line.']);
  inOrder(f, ['{MORNING_GOALS_QUESTION}', 'data-journal-field="goals"', '{MORNING_BLOCKER_QUESTION}', 'data-journal-field="blocker"', '{MORNING_PLAN_QUESTION}', 'data-journal-add-open', 'data-journal-copy-prompt', 'data-journal-field="plan_steps"', '<button type="submit" className={chip} disabled={busy}>save</button>', 'data-journal-clear>clear</button>'], 'the morning form');
  assert.doesNotMatch(code(RULE) + f, /\bTODAY_GOALS_QUESTION\b|\bBLOCKERS_QUESTION\b|\bPLAN_QUESTION\b/, 'the JOURNAL-02 names went with their words — no alias was needed, every pin moved');
  assert.equal(clearJournalQuestion('Mon Oct 12'), 'Clear the whole journal for Mon Oct 12 — morning and evening? The audit log keeps it; the card forgets it.');
  assert.match(f, /window\.confirm\(clearJournalQuestion\(dayShortWords\(day\)\)\)/, 'the clear asks it');
});

// ── R2 · THE EVENING PLATE ──────────────────────────────────────────────────

test('R2 the evening plate: labelled EVENING_WORD; TODAY’S TICKS by the morning’s counts rule on today’s row ("no plan today" when none); the verdict as the card says it; ACCOMPLISHED (the block, line breaks kept) and NEXT as held, "—" when null; the read’s own state said', () => {
  assert.equal(EVENING_WORD, 'EVENING — reflection');
  // JOURNAL-06 (Alex, 2026-10-20): AUDIT_WORD reads ACCOMPLISHED (the column is still `audit`); LEARNED left the plate with its column (retired).
  assert.deepEqual([TODAY_TICKS_WORD, VERDICT_WORD, AUDIT_WORD, NEXT_WORD, EVENING_BLANK_WORD, NO_PLAN_TODAY_WORDS], ['TODAY’S TICKS', 'VERDICT', 'ACCOMPLISHED', 'NEXT', '—', 'no plan today']);
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(todayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, false, true, true, false] })), '4 of 6 steps done · 2 left over', 'the same counts rule as YESTERDAY’s');
  assert.equal(todayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, true, true, true, true] })), 'all 6 steps done');
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, false, true, true, false] })), '4 of 6 steps done · 2 left over', 'the morning’s words unchanged');
  assert.equal(todayStepsWords(answersOf({ goals: ['g'] })), 'no plan today');
  assert.equal(todayStepsWords(null), 'no plan today');
  const rule = code(RULE);
  assert.match(rule, /export function todayStepsWords\(row: Answers \| null\): string \{\n\s*const y = yesterdaySteps\(row\);\n\s*return y\.kind === 'steps' \? stepsCountWords\(y\) : NO_PLAN_TODAY_WORDS;\n\}/, 'one rule, applied to today');
  assert.match(rule, /if \(y\.kind === 'no plan'\) return NO_PLAN_YESTERDAY_WORDS;\n\s*return stepsCountWords\(y\);/, 'YESTERDAY’s counts through the same line');
  const c = code(CARD);
  const plate = c.slice(c.indexOf('function EveningPlate('), c.indexOf('export default function DayCard()'));
  inOrder(plate, ['data-day-evening>', 'data-day-evening-label>{EVENING_WORD}', 'data-day-evening-loading>{JOURNAL_LOADING_WORDS}', 'data-day-evening-failed>{journal.words}', 'data-day-evening-ticks>', '{TODAY_TICKS_WORD}', 'data-day-evening-ticks-words>{todayStepsWords(row)}', 'data-day-evening-verdict>', '{VERDICT_WORD}', "actualTone(verdict.over)", 'data-day-evening-verdict-words>{verdict === null ? EVENING_BLANK_WORD : verdict.text}', 'data-day-evening-audit>', '{AUDIT_WORD}', 'whitespace-pre-line', 'data-day-evening-audit-words>{answer(row === null ? null : row.audit)}', 'data-day-evening-next>', '{NEXT_WORD}', 'data-day-evening-next-words>{answer(row === null ? null : row.next)}'], 'the evening plate, in order');
  assert.match(plate, /const answer = \(text: string \| null\): string => \(text === null \? EVENING_BLANK_WORD : text\);/, '"—" for an answer not yet typed');
  assert.doesNotMatch(plate, /planDollars|Cents|spent|tally|dayVerdict\(|deltaWords\(|data-day-download-image|data-day-copy-script/, 'no money beyond the verdict line the card already made, no new arithmetic, no image, no reel button');
  assert.match(c, /function EveningPlate\(\{ journal, verdict \}: \{ journal: Read<JournalAnswer> \| null; verdict: DeltaWords \| null \}\)/);
  assert.match(c, /const noPlateRef = \(\): void => undefined;/, 'no image button — no ref');
});

// ── R3 · THE EVENING FORM ───────────────────────────────────────────────────

test('R3 the evening form: the seven questions with their boxes, in order; "copy reflection prompt" beside ACCOMPLISHED; save builds the whole row with the morning’s four AS HELD and the evening’s seven from the boxes, through the one rule and the one writer; busy while writing; no clear', () => {
  // JOURNAL-06 (Alex, 2026-10-20): seven questions, THE EVENING'S QUESTIONS verbatim (journal06.test.ts pins the order on the form); the copy words moved to the reflection prompt.
  assert.deepEqual([EVENING_AUDIT_QUESTION, EVENING_GAPS_QUESTION, EVENING_EVOLUTION_QUESTION, EVENING_DIRECTION_QUESTION, EVENING_ALIGNMENT_QUESTION, EVENING_ON_TRACK_QUESTION, EVENING_NEXT_QUESTION, EVENING_NEXT_PLACEHOLDER, EVENING_SAVE_WORDS, COPY_REFLECTION_PROMPT_WORDS, REFLECTION_PROMPT_COPIED_WORDS],
    ['What got done today — the narrative. Copy the reflection prompt, paste the chat\'s narrative here.', 'What gaps do you see — what is missing, wrong, or not yet true?', 'What changed in how we build today — a rule, a better way, something we stopped doing?', 'Going well, or change direction? Which, and why.', 'Is the chat doing anything not aligned with your vision? Name it.', 'On the rails — accounting rules, SOC 2, the mission? Anything that bent?', 'Where do I want to take it next?', 'one sentence', 'save', 'copy reflection prompt', 'copied — paste it into Claude, then paste the narrative into ACCOMPLISHED']);
  const e = code(EVENING_FORM);
  assert.match(e, /^'use client';/m);
  assert.match(e, /import \{ setJournal \} from '\.\/journalWrites';/, 'the one writer, and only its set');
  assert.doesNotMatch(e, /clearJournal|data-journal-clear|data-evening-clear|window\.confirm|clear</, 'no clear on the evening form');
  // JOURNAL-06: the seven boxes render from EVENING_ORDER (one block per field, its question from EVENING_QUESTIONS); the copy button and its words sit on ACCOMPLISHED alone.
  inOrder(e, ['data-evening-form>', '{EVENING_ORDER.map((field) => (', 'data-evening-block={field}>', '{EVENING_QUESTIONS[field]}</label>', "{field === 'audit' && <button", 'data-evening-copy-prompt>{COPY_REFLECTION_PROMPT_WORDS}</button>}', "{field === 'audit' && !reflectionPrompt.ok && <p", 'data-evening-copy-waits>{reflectionPrompt.words}</p>}', "{field === 'audit' && copyWords !== null && <p", 'data-evening-copy-words>{copyWords.words}</p>}', '<textarea id={`evening-${field}`} rows={ROWS[field]} value={draft[field]}', "placeholder={field === 'next' ? EVENING_NEXT_PLACEHOLDER : undefined}", 'data-evening-field={field} />', 'data-evening-save>{EVENING_SAVE_WORDS}</button>', 'data-evening-words>{words}</p>}'], 'the evening form, in order');
  assert.match(e, /const ROWS: Readonly<Record<EveningField, number>> = \{ audit: 8, gaps: 4, evolution: 3, direction: 3, alignment: 3, on_track: 3, next: 2 \};/, 'the narrative and the blocks tall, NEXT one sentence');
  assert.match(e, /const read = journalInput\(\{ day, goals: journal === null \? \[\] : journal\.goals, blocker: journal === null \? null : journal\.blocker, plan_steps: journal === null \? \[\] : journal\.plan_steps, plan_done: journal === null \? \[\] : journal\.plan_done, audit: draft\.audit, gaps: draft\.gaps, evolution: draft\.evolution, direction: draft\.direction, alignment: draft\.alignment, on_track: draft\.on_track, next: draft\.next \}\);/, 'the whole row: the morning’s four as held, the evening’s seven from the boxes');
  assert.match(e, /if \(!read\.ok\) \{ setWords\(read\.message\); return; \}\n\s*setBusy\(true\);\n\s*setWords\(null\);\n\s*try \{\n\s*const answer = await setJournal\(day, read\.value\.answers\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n\s*onChanged\(\);\n\s*\} finally \{\n\s*setBusy\(false\);\n\s*\}/, 'the route’s words on a refusal; busy while writing; the card re-reads after');
  assert.doesNotMatch(e, /maxLength|localStorage|sessionStorage|document\.cookie/, 'no maxLength (the rule’s refusal is the limit); nothing stored');
  assert.match(comments(EVENING_FORM), /NO "clear" here[\s\S]*morning form's\s*\n?\s*\*?\s*clear, which clears the whole day's journal, is the way out/, 'the form’s doc says why there is no clear');
  // The morning form's save body is JOURNAL-04b's — JOURNAL-06: the seven as held, learned never sent.
  assert.match(code(MORNING_FORM), /audit: journal === null \? null : journal\.audit, gaps: journal === null \? null : journal\.gaps, evolution: journal === null \? null : journal\.evolution, direction: journal === null \? null : journal\.direction, alignment: journal === null \? null : journal\.alignment, on_track: journal === null \? null : journal\.on_track, next: journal === null \? null : journal\.next \}\);/);
  assert.doesNotMatch(code(MORNING_FORM) + e, /\blearned\b\s*:/, 'no body carries learned — retired (JOURNAL-06)');
});

// ── R5 · ONE ROW, TWO CARDS, NO LOSS ────────────────────────────────────────

test('R5 no loss: an evening save over a row with goals keeps the goals; a morning save over a row with an audit keeps the audit; two saves in a row leave all eleven as typed; a day emptied everywhere is refused by name', () => {
  // The two bodies exactly as the forms build them (EveningForm.tsx / JournalForm.tsx), driven through the route's own rule.
  // JOURNAL-06 (Alex, 2026-10-20): the evening's boxes are seven — ACCOMPLISHED (audit), the five blocks and NEXT; learned is retired and no body carries it.
  type Five = { gaps: string; evolution: string; direction: string; alignment: string; on_track: string };
  const five = (b: Partial<Five>): Five => ({ gaps: b.gaps ?? '', evolution: b.evolution ?? '', direction: b.direction ?? '', alignment: b.alignment ?? '', on_track: b.on_track ?? '' });
  const eveningBody = (held: Answers | null, boxes: { audit: string; next: string } & Partial<Five>) => {
    const f = five(boxes);
    return { day: DAY, goals: held === null ? [] : held.goals, blocker: held === null ? null : held.blocker, plan_steps: held === null ? [] : held.plan_steps, plan_done: held === null ? [] : held.plan_done, audit: boxes.audit, gaps: f.gaps, evolution: f.evolution, direction: f.direction, alignment: f.alignment, on_track: f.on_track, next: boxes.next };
  };
  const morningBody = (held: Answers | null, boxes: { goals: string[]; blocker: string | null; plan_steps: string[]; plan_done: boolean[] }) =>
    ({ day: DAY, ...boxes, audit: held === null ? null : held.audit, gaps: held === null ? null : held.gaps, evolution: held === null ? null : held.evolution, direction: held === null ? null : held.direction, alignment: held === null ? null : held.alignment, on_track: held === null ? null : held.on_track, next: held === null ? null : held.next });
  // A morning typed first, then the evening over it.
  const morning = accepted(morningBody(null, { goals: ['post the reel', 'book travel'], blocker: 'rain', plan_steps: ['merge TABLE-01', 'record brunch'], plan_done: [true, false] }));
  const evening = accepted(eveningBody(morning, { audit: 'Got the reel posted.\n\nTravel not booked — the site was down.\n\nCarry: book travel first thing.', gaps: 'travel is not booked\nthe site was down', direction: 'keep going — the cards land', next: 'ship the two cards' }));
  assert.deepEqual([evening.goals, evening.blocker, evening.plan_steps, evening.plan_done], [['post the reel', 'book travel'], 'rain', ['merge TABLE-01', 'record brunch'], [true, false]], 'the evening save keeps the morning’s four');
  assert.deepEqual([evening.audit, evening.gaps, evening.evolution, evening.direction, evening.alignment, evening.on_track, evening.next], ['Got the reel posted.\n\nTravel not booked — the site was down.\n\nCarry: book travel first thing.', 'travel is not booked\nthe site was down', null, 'keep going — the cards land', null, null, 'ship the two cards'], 'the paragraphs kept; a blank box is null');
  // A morning save over it — the ticks flipped, a goal added — keeps the evening's seven.
  const morningAgain = accepted(morningBody(evening, { goals: [...evening.goals, 'reply to comments'], blocker: evening.blocker, plan_steps: evening.plan_steps, plan_done: [true, true] }));
  assert.deepEqual([morningAgain.audit, morningAgain.gaps, morningAgain.direction, morningAgain.next], [evening.audit, evening.gaps, evening.direction, evening.next], 'the morning save keeps the evening’s seven');
  assert.deepEqual([morningAgain.goals, morningAgain.plan_done], [['post the reel', 'book travel', 'reply to comments'], [true, true]]);
  // The tick (DayCard.tsx): the whole row as held with one flag flipped.
  const tick = accepted({ day: DAY, ...answersOf(morningAgain), plan_done: morningAgain.plan_done.map((d, j) => (j === 1 ? !d : d)) });
  assert.deepEqual([tick.audit, tick.gaps, tick.direction, tick.next, tick.plan_done], [evening.audit, evening.gaps, evening.direction, evening.next, [true, false]], 'a tick keeps them');
  // Two saves in a row — evening then morning — leave all eleven as typed.
  const once = accepted(eveningBody(tick, { audit: tick.audit as string, gaps: 'and again', direction: tick.direction as string, next: tick.next as string }));
  const twice = accepted(morningBody(once, { goals: once.goals, blocker: once.blocker, plan_steps: once.plan_steps, plan_done: once.plan_done }));
  assert.deepEqual(twice, answersOf({ goals: ['post the reel', 'book travel', 'reply to comments'], blocker: 'rain', plan_steps: ['merge TABLE-01', 'record brunch'], plan_done: [true, false], audit: evening.audit, gaps: 'and again', direction: 'keep going — the cards land', next: 'ship the two cards' }), 'all eleven as typed');
  // An evening blanked by saving empty boxes: the seven go null; a day with nothing left anywhere is refused by name — the morning's clear is the way out.
  const blanked = accepted(eveningBody(twice, { audit: '', gaps: '  ', direction: '\n\n', next: '' }));
  assert.deepEqual([blanked.audit, blanked.gaps, blanked.direction, blanked.next, blanked.goals], [null, null, null, null, twice.goals]);
  const nothing = journalInput(eveningBody(null, { audit: '', next: '' }));
  assert.ok(!nothing.ok && nothing.message === NOTHING_TYPED_WORDS, 'nothing left anywhere: refused by name');
  // The evening alone is a journal (JOURNAL-04) — a block alone too (JOURNAL-06).
  assert.ok(journalInput(eveningBody(null, { audit: '', next: 'ship the two cards' })).ok);
  assert.ok(journalInput(eveningBody(null, { audit: '', gaps: 'one gap', next: '' })).ok);
});

// ── R6 · WORDS AND LAWS; R7 · NOTHING ELSE ──────────────────────────────────

test('R6 every word is the rule’s; the registry’s Time row and the law’s controls list are untouched; the day folder is still its three files; R7 nothing else — no route, no schema, no reel, no ledger, no deck change', () => {
  const e = code(EVENING_FORM);
  const printed = [...e.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length >= 5);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(e, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  const c = code(CARD);
  assert.doesNotMatch(c.slice(c.indexOf('function EveningPlate(')), /'MORNING|'EVENING|'Last night|'no plan today'|'AUDIT'|'ACCOMPLISHED'|'LEARNED'|'NEXT'/, 'the card types none of the new words');
  // HOME-01 (Alex, 2026-10-24, ruling C): the Time row's why is the tables' now — the journal is what the card records, as a table.
  assert.match(code(REGISTRY), /why: 'the task ledger and the two journals, day over day — every stop and every answer the day card records, as tables'/, 'the Time row — HOME-01 rewrote it to the tables; the journal is in it still');
  assert.match(code(LAW), /\['src\/components\/workbench\/operations\/stops\/StopForm\.tsx', \/data-stop-done-now\[\\s\\S\]\*✓ done now\/, 'the stop form on the day card lost "✓ done now" — the one way a routine is marked done'\],/, 'the controls list unchanged');
  assert.doesNotMatch(code(LAW), /EveningForm|EveningPlate/, 'the law names neither');
  assert.doesNotMatch(code(CARD_RULES), /EveningForm|EveningPlate|auditPrompt|MORNING_WORD|EVENING_WORD|lastNightWords/, 'dayCard.ts (the reel text) untouched');
  // REEL-02 (Alex, 2026-10-19): the reel reads `next` too — the script's cliffhanger and the caption's line before the tags; learned and audit never (reel02.test.ts R1).
  assert.match(code(CARD_RULES), /readonly journal: Pick<Answers, 'goals' \| 'blocker' \| 'next'> \| null;/, 'the reel reads the goals, the blocker and next — never learned or audit');
  for (const f of ['src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/components/workbench/operations/stops/DayDeck.tsx', 'src/components/workbench/operations/stops/StopForm.tsx', 'src/app/api/operations/journal/route.ts']) {
    assert.doesNotMatch(code(f), /EveningForm|EveningPlate|auditPrompt|MORNING_WORD|EVENING_WORD/, `${f} knows nothing of the two cards`);
  }
  assert.match(comments(CARD), /JOURNAL-05 \(Alex, 2026-10-19\) — THE MORNING CARD, named/);
  assert.match(comments(RULE), /JOURNAL-05 \(Alex, 2026-10-19\) — THE TWO CARDS/);
});
