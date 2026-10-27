/**
 * REEL-02 (Alex, 2026-10-19) — "TOMORROW:" ON THE REEL. The reel is a daily
 * earnings report: guidance (the plan) → actuals (each stop) → the tally →
 * forward guidance. The forward guidance is the evening card's "Where do I want
 * to take it next?" — one line typed at night (JOURNAL-04 `next`). It becomes
 * the script's last block ("Tomorrow: …", the cliffhanger) and the caption's
 * last section before the tags. What he learned and the audit he pasted are
 * his; the reel never reads them. The orphan AI script generator
 * (src/lib/ai/generateReelScript.ts — no importer since TIME-02) is deleted.
 * The audit prompt prints money only for a stop whose form asks it.
 *
 * The rules are DRIVEN over the reel's own fixture (fixtureReelDay.ts — the
 * day REEL-01 built, moved there verbatim) with and without a `next`; the four
 * texts REEL-01's rules made for that fixture are held here VERBATIM, captured
 * on the head before this change, and the rules must still make them byte for
 * byte when the journal has no `next` (R4). The card and the rules are anchored
 * to their source with comments stripped (TEST-TRUTH-01). The pins that moved
 * in reel01 and journal05 carry dated notes there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments } from '../sourceText';
import { CAPTION_TAGS, TOMORROW_WORDS, captionTags, captionText, scriptText, tomorrowWords } from '@/components/workbench/operations/day/dayCard';
// JOURNAL-06 (Alex, 2026-10-20): the audit prompt became the reflection prompt — the day's lines, auditStopWords among them, unchanged.
import { auditStopWords, reflectionPromptText, type ReflectionPromptInput } from '../operations/journal';
import { FULL, HALF, JOURNAL, STAY, build, reelDay } from './fixtureReelDay';

const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULE = 'src/lib/operations/journal.ts';
const TAG = 'src/components/workbench/operations/stops/StopTag.tsx';
const ORPHAN = 'src/lib/ai/generateReelScript.ts';
const THIS = 'src/lib/__tests__/reel02.test.ts';
const NEXT = 'book the Pai bus before the card work';

const at = (f: string): string => join(process.cwd(), f);
/** Every .ts/.tsx file under a directory, as repo-relative paths. */
function tsFiles(dir: string): string[] {
  return readdirSync(at(dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(at(rel)).isDirectory()) return tsFiles(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}
/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let n = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, n);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    n = i + stepText.length;
  }
}
const full = () => build(FULL, { taskActual: '8.50' });
const withNext = { journal: { ...JOURNAL, next: NEXT } } as const;

// ── THE FOUR TEXTS REEL-01'S RULES MADE FOR THE FIXTURE — captured on the head before REEL-02, verbatim ──

const CAPTION_HALF_BEFORE = [
  'Chiang Mai, Thailand 🇹🇭 Day 8 of 15!',
  'Budget today: $100. Under or Over? 👇',
  '',
  'Today’s plan:',
  'Ship the reel kit',
  'Call the bank',
  'Blocker: waiting on the bank',
  '',
  'Brunch at Luka Café',
  'Budget: $25',
  'Actual: $9.69',
  '▼ $15.31 under',
  '⭐️⭐️⭐️⭐️',
  'Eggs benedict',
  '',
  'Dinner',
  'Budget: $30',
  'Actual: $35',
  '▲ $5 over',
  '⭐️⭐️⭐️⭐️⭐️',
  '',
  'Gym at Fitness First: skipped',
  'Budget: $15',
  'Actual: —',
  'closed for a holiday',
  '',
  'Total budget: $100',
  'Spent: $44.69',
  '',
  '#chiangmai #thailand #digitalnomad #costofliving #buildinpublic',
].join('\n');

const CAPTION_FULL_BEFORE = [
  'Chiang Mai, Thailand 🇹🇭 Day 8 of 15!',
  'Budget today: $100. Under or Over? 👇',
  '',
  'Today’s plan:',
  'Ship the reel kit',
  'Call the bank',
  'Blocker: waiting on the bank',
  '',
  'Brunch at Luka Café',
  'Budget: $25',
  'Actual: $9.69',
  '▼ $15.31 under',
  '⭐️⭐️⭐️⭐️',
  'Eggs benedict',
  '',
  'Dinner',
  'Budget: $30',
  'Actual: $35',
  '▲ $5 over',
  '⭐️⭐️⭐️⭐️⭐️',
  '',
  'Gym at Fitness First',
  'Budget: $15',
  'Actual: $15',
  'on plan',
  '⭐️⭐️⭐️',
  'leg day',
  '',
  'Activities',
  'Budget: $20',
  'Actual: $12',
  '▼ $8 under',
  '',
  'Total budget: $100',
  'Spent: $80.19',
  '▼ $19.81 under',
  '',
  '#chiangmai #thailand #digitalnomad #costofliving #buildinpublic',
].join('\n');

const SCRIPT_HALF_BEFORE = [
  'Budget today: $100. Under or Over? Let’s find out.',
  '',
  'Happy Thursday everyone, welcome to day 8 of 15, here in Chiang Mai, Thailand 🇹🇭. Today: Vision journal, Brunch at Luka Café, Co-working, Dinner, Gym at Fitness First, Activities, Ship REEL-01.',
  '',
  'Today’s list: Ship the reel kit, Call the bank.',
  'Blocker: waiting on the bank.',
  '',
  'Brunch at Luka Café.',
  'Eggs benedict',
  'Budget $25, actual $9.69, ▼ $15.31 under.',
  '4 out of 5.',
  '',
  'Dinner.',
  '[what you got]',
  'Budget $30, actual $35, ▲ $5 over.',
  '5 out of 5.',
  '',
  'Gym: skipped.',
  'closed for a holiday',
  '',
  'Activities.',
  '[what you got]',
  'Budget $20, actual [actual].',
  '[stars] out of 5.',
  '',
  'Ship REEL-01.',
  '[what you got]',
  'Budget $10, actual [actual].',
  '[stars] out of 5.',
  '',
  'Final tally: [actual] out of $100. [verdict]. Day 8 of 15, done.',
].join('\n');

const SCRIPT_FULL_BEFORE = [
  'Budget today: $100. Under or Over? Let’s find out.',
  '',
  'Happy Thursday everyone, welcome to day 8 of 15, here in Chiang Mai, Thailand 🇹🇭. Today: Vision journal, Brunch at Luka Café, Co-working, Dinner, Gym at Fitness First, Activities, Ship REEL-01.',
  '',
  'Today’s list: Ship the reel kit, Call the bank.',
  'Blocker: waiting on the bank.',
  '',
  'Brunch at Luka Café.',
  'Eggs benedict',
  'Budget $25, actual $9.69, ▼ $15.31 under.',
  '4 out of 5.',
  '',
  'Dinner.',
  '[what you got]',
  'Budget $30, actual $35, ▲ $5 over.',
  '5 out of 5.',
  '',
  'Gym at Fitness First.',
  'leg day',
  'Budget $15, actual $15, on plan.',
  '3 out of 5.',
  '',
  'Activities.',
  '[what you got]',
  'Budget $20, actual $12, ▼ $8 under.',
  '[stars] out of 5.',
  '',
  'Ship REEL-01.',
  '[what you got]',
  'Budget $10, actual $8.50, ▼ $1.50 under.',
  '[stars] out of 5.',
  '',
  'Final tally: $80.19 out of $100. ▼ $19.81 under. Day 8 of 15, done.',
].join('\n');

// ── R2 · THE SCRIPT ─────────────────────────────────────────────────────────

test('R2 the script: with a `next`, ONE more block after the tally — the last — "Tomorrow: <next>"; the tally block’s own last sentence unchanged; nothing when the journal has none, or there is no journal', () => {
  assert.equal(TOMORROW_WORDS, 'Tomorrow:');
  assert.equal(tomorrowWords(NEXT), `Tomorrow: ${NEXT}`);
  const s = scriptText(reelDay(full(), withNext));
  assert.ok(s.ok);
  const blocks = s.text.split('\n\n');
  assert.equal(blocks[blocks.length - 1], `Tomorrow: ${NEXT}`, 'the last block');
  assert.equal(blocks[blocks.length - 2], 'Final tally: $80.19 out of $100. ▼ $19.81 under. Day 8 of 15, done.', 'the tally block before it, its last sentence as it was');
  assert.equal(s.text, `${SCRIPT_FULL_BEFORE}\n\nTomorrow: ${NEXT}`, 'everything before it is REEL-01’s script, byte for byte');
  // A day half recorded: the blanks, then the cliffhanger.
  const half = scriptText(reelDay(build(HALF), withNext));
  assert.ok(half.ok);
  assert.match(half.text, /\n\nFinal tally: \[actual\] out of \$100\. \[verdict\]\. Day 8 of 15, done\.\n\nTomorrow: book the Pai bus before the card work$/);
  assert.equal((half.text.match(/Tomorrow:/g) ?? []).length, 1, 'once');
  // No next: the script ends on the tally. No journal: the same.
  assert.equal(JOURNAL.next, null, 'the fixture’s journal has no next');
  for (const d of [reelDay(full()), reelDay(full(), { journal: null }), reelDay(full(), { journal: { goals: [], blocker: null, next: null } })]) {
    const t = scriptText(d);
    assert.ok(t.ok);
    assert.match(t.text, /Day 8 of 15, done\.$/);
    assert.doesNotMatch(t.text, /Tomorrow/);
  }
  // The rule: one line, after the tally push, before the join.
  const r = code(RULES);
  assert.match(r, /\. Day \$\{at\.n\} of \$\{at\.of\}, done\.`\]\);\n\s*if \(d\.journal !== null && d\.journal\.next !== null\) blocks\.push\(\[tomorrowWords\(d\.journal\.next\)\]\);\n\s*return \{ ok: true, text: blocks\.map\(\(lines\) => lines\.join\('\\n'\)\)\.join\('\\n\\n'\) \};/);
  assert.match(r, /export const TOMORROW_WORDS = 'Tomorrow:';\nexport const tomorrowWords = \(next: string\): string => `\$\{TOMORROW_WORDS\} \$\{next\}`;/);
  assert.equal((r.match(/'Tomorrow:'/g) ?? []).length, 1, 'the word once — a constant');
});

// ── R3 · THE CAPTION ────────────────────────────────────────────────────────

test('R3 the caption: with a `next`, ONE more section after the tally and BEFORE the tags — the tags stay last, their count unchanged; nothing when the journal has none', () => {
  const c = captionText(reelDay(full(), withNext));
  assert.ok(c.ok);
  const sections = c.text.split('\n\n');
  assert.equal(sections[sections.length - 1], '#chiangmai #thailand #digitalnomad #costofliving #buildinpublic', 'the tags, last');
  assert.equal(sections[sections.length - 2], `Tomorrow: ${NEXT}`, 'the line before the tags');
  assert.equal(sections[sections.length - 3], 'Total budget: $100\nSpent: $80.19\n▼ $19.81 under', 'the tally section before it');
  assert.equal(c.text, CAPTION_FULL_BEFORE.replace(/\n\n#chiangmai/, `\n\nTomorrow: ${NEXT}\n\n#chiangmai`), 'REEL-01’s caption with the one section slid in before the tags');
  // At most five tags, as before: the place's two and the three constants.
  const tags = sections[sections.length - 1].split(' ');
  assert.equal(tags.length, 5);
  assert.ok(tags.every((t) => t.startsWith('#')));
  assert.deepEqual(captionTags(STAY.place), ['#chiangmai', '#thailand', ...CAPTION_TAGS]);
  assert.equal((c.text.match(/Tomorrow:/g) ?? []).length, 1, 'once');
  // No next, no journal: the tags follow the tally directly.
  for (const d of [reelDay(full()), reelDay(build(HALF), { journal: null })]) {
    const t = captionText(d);
    assert.ok(t.ok);
    assert.match(t.text, /\nSpent: [^\n]*\n(▼[^\n]*\n)?\n#chiangmai #thailand #digitalnomad #costofliving #buildinpublic$/);
    assert.doesNotMatch(t.text, /Tomorrow/);
  }
  // The rule: between the tally section and the tags.
  assert.match(code(RULES), /sections\.push\(\[`Total budget: [^\n]*\]\);\n\s*if \(d\.journal !== null && d\.journal\.next !== null\) sections\.push\(\[tomorrowWords\(d\.journal\.next\)\]\);\n\s*sections\.push\(\[captionTags\(d\.stay\.place\)\.join\(' '\)\]\);/);
});

// ── R4 · BYTE FOR BYTE WHEN ABSENT ──────────────────────────────────────────

test('R4 a journal with no `next` makes exactly REEL-01’s caption and script — the four texts captured before this change, byte for byte', () => {
  assert.equal(JOURNAL.next, null);
  const half = build(HALF);
  const cHalf = captionText(reelDay(half)); const cFull = captionText(reelDay(full()));
  const sHalf = scriptText(reelDay(half)); const sFull = scriptText(reelDay(full()));
  assert.ok(cHalf.ok && cFull.ok && sHalf.ok && sFull.ok);
  assert.equal(cHalf.text, CAPTION_HALF_BEFORE, 'the caption of the half-recorded day');
  assert.equal(cFull.text, CAPTION_FULL_BEFORE, 'the caption of the full day');
  assert.equal(sHalf.text, SCRIPT_HALF_BEFORE, 'the script of the half-recorded day');
  assert.equal(sFull.text, SCRIPT_FULL_BEFORE, 'the script of the full day');
  // The captured texts are REEL-01's: the ones reel01.test.ts holds verbatim are among them.
  assert.ok(CAPTION_HALF_BEFORE.startsWith('Chiang Mai, Thailand 🇹🇭 Day 8 of 15!\nBudget today: $100. Under or Over? 👇\n\nToday’s plan:\nShip the reel kit\nCall the bank\nBlocker: waiting on the bank\n\nBrunch at Luka Café\n'));
  assert.ok(SCRIPT_FULL_BEFORE.endsWith('\n\nFinal tally: $80.19 out of $100. ▼ $19.81 under. Day 8 of 15, done.'));
});

// ── R1 · THE TYPE AND THE PRIVACY ───────────────────────────────────────────

test('R1 ReelDay.journal is goals, blocker and next; the card’s hand-off is unchanged (the row it read); learned and audit are never read by the reel', () => {
  const r = code(RULES);
  assert.match(r, /readonly journal: Pick<Answers, 'goals' \| 'blocker' \| 'next'> \| null;/);
  const reel = r.slice(r.indexOf('export interface ReelDay'), r.indexOf('// ── TASKS-ONE-01'));
  assert.ok(reel.includes('export function captionText(') && reel.includes('export function scriptText(') && reel.includes('export function stopSceneLines('), 'the reel’s functions are in the slice');
  assert.doesNotMatch(reel, /\.(learned|audit)\b/, 'the reel reads neither');
  assert.doesNotMatch(r, /\.(learned|audit)\b/, 'nor does anything else in the rules');
  assert.match(reel, /d\.journal\.next/);
  const c = code(CARD);
  assert.match(c, /const reelJournal = journalRead !== null && journalRead\.ok \? journalRead\.value\.journal : null;/, 'the whole row the card read — only the type narrows it');
  assert.match(c, /const reelDay = \{ day, stay: reelStay, stops: result\.stops, totals, verdict, journal: reelJournal, done: reelDone \};/); // WORK-03 (Alex, 2026-10-26): the work block reaches the reel — an execute stop's scene says what was done in its block and the caption counts it; the reel waits on the backlog by name (work03.test.ts).
  assert.match(comments(RULES), /REEL-02 \(Alex, 2026-10-19\): `next` too/);
});

// ── R5 · THE ORPHAN ─────────────────────────────────────────────────────────

test('R5 the orphan AI script generator is deleted; nothing under src or scripts names it; nothing else under src/lib/ai changed', () => {
  assert.ok(!existsSync(at(ORPHAN)), `${ORPHAN} is deleted`);
  for (const f of [...tsFiles('src'), ...tsFiles('scripts')].filter((f) => f !== THIS)) assert.doesNotMatch(code(f), /generateReelScript/, `${f} names the orphan`);
  // TASKS-02 (2026-10-20): generateNorthStarSectionOptimization.ts left the folder with the North Star's paid
  // optimizer route (its only caller); northStarContext.ts stays — the six readers still feed on it.
  assert.deepEqual(readdirSync(at('src/lib/ai')).sort(), [
    'buildAuditPrompt.ts', 'caps.ts', 'client.ts', 'dailyCap.ts', 'exemplars', 'generateDeepResearch.ts',
    'generateProjectDesign.ts', 'generateProjectTasks.ts', 'northStarContext.ts', 'promptSegments.ts', 'recordUsage.ts',
  ], 'the folder as TASKS-02 left it — REEL-02\'s orphan and the North Star optimizer gone, the rest as they were');
  for (const f of ['src/lib/ai/dailyCap.ts', 'src/lib/ai/caps.ts', 'src/lib/ai/client.ts', 'src/lib/ai/recordUsage.ts', 'src/lib/routineFireBudget.ts']) assert.ok(existsSync(at(f)), `${f} stays`);
});

// ── R6 · THE AUDIT PROMPT PRINTS MONEY ONLY FOR A STOP THAT ASKS IT ────────

test('R6 the audit prompt: a stop whose form asks no amount prints its name and its outcome in the card’s own words, no budget, no actual; one that asks prints as before; the flag is the card’s asksAmount, and journal.ts imports nothing of the card', () => {
  assert.equal(auditStopWords({ name: 'Co-working', vendor: null, asksAmount: false, outcomeWords: 'done' }), '- Co-working — done');
  assert.equal(auditStopWords({ name: 'Vision journal', vendor: null, asksAmount: false, outcomeWords: 'not recorded' }), '- Vision journal — not recorded');
  assert.equal(auditStopWords({ name: 'Stretch', vendor: 'Yoga Tree', asksAmount: false, outcomeWords: 'skipped' }), '- Stretch at Yoga Tree — skipped');
  assert.equal(auditStopWords({ name: 'Brunch', vendor: 'Luka Café', asksAmount: true, budgetWords: '$25', actualWords: '$22 ▼ $3' }), '- Brunch at Luka Café — budget $25, actual $22 ▼ $3', 'as before');
  const input: ReflectionPromptInput = {
    dayWords: 'Thu Oct 15', journal: null,
    stops: [
      { name: 'Vision journal', vendor: null, asksAmount: false, outcomeWords: 'done' },
      { name: 'Brunch', vendor: 'Luka Café', asksAmount: true, budgetWords: '$25', actualWords: '$9.69 ▼ $15.31' },
      { name: 'Co-working', vendor: null, asksAmount: false, outcomeWords: 'not recorded' },
      { name: 'Gym', vendor: 'Fitness First', asksAmount: true, budgetWords: '$15', actualWords: 'skipped' },
    ],
    budgetWords: '$100', actualWords: '$44.69', verdictWords: null,
    // JOURNAL-06 (2026-10-20): THE BACKLOG and WHAT MOVED TODAY follow the day's lines — empty here (journal06.test.ts drives them).
    backlog: [], moved: [],
  };
  const text = reflectionPromptText(input);
  inOrder(text, ['Stops — budget vs actual:\n- Vision journal — done\n- Brunch at Luka Café — budget $25, actual $9.69 ▼ $15.31\n- Co-working — not recorded\n- Gym at Fitness First — budget $15, actual skipped\nTotals: budget $100, actual $44.69\n'], 'the stop lines in order');
  assert.doesNotMatch(text, /Vision journal — budget|Co-working — budget|budget —, actual —/, 'no money words for a stop that asks none');
  // The flag's home: the words rule's input, set by the card from its own rule — the rule imports nothing of the card.
  const rule = code(RULE);
  assert.match(rule, /export type AuditPromptStop =\n\s*\| \{ readonly name: string; readonly vendor: string \| null; readonly asksAmount: true; readonly budgetWords: string; readonly actualWords: string \}\n\s*\| \{ readonly name: string; readonly vendor: string \| null; readonly asksAmount: false; readonly outcomeWords: string \};/);
  assert.match(rule, /export const auditStopWords = \(s: AuditPromptStop\): string =>\n\s*`- \$\{s\.name\}\$\{s\.vendor === null \? '' : ` at \$\{s\.vendor\}`\} — \$\{s\.asksAmount \? `budget \$\{s\.budgetWords\}, actual \$\{s\.actualWords\}` : s\.outcomeWords\}`;/);
  assert.doesNotMatch(rule, /day\/dayCard|asksAmount\(/, 'journal.ts imports nothing from dayCard.ts and decides nothing about roles');
  const c = code(CARD);
  assert.match(c, /stops: result\.stops\.map\(\(s\) => \(asksAmount\(s\.role\)\n\s*\? \{ name: stopName\(s\), vendor: s\.vendor, asksAmount: true, budgetWords: factOf\(s\.cents === null \? null : planDollars\(s\.cents\)\), actualWords: s\.status === 'skipped' \? SKIPPED_WORD : s\.actualCents === null \? factOf\(null\) : rowActualWords\(s\.actualCents, s\.cents\) \}\n\s*: \{ name: stopName\(s\), vendor: s\.vendor, asksAmount: false, outcomeWords: s\.status === 'done' \? DONE_WORD : s\.status === 'skipped' \? SKIPPED_WORD : NOT_RECORDED_WORDS \}\)\),/, 'the card decides by its own asksAmount and hands the card’s own words');
  assert.match(code(RULES), /export const asksAmount = \(role: StopRole\): boolean => role === 'place' \|\| role === 'none';/, 'the one rule — unchanged');
  assert.match(comments(RULE), /REEL-02 \(Alex, 2026-10-19\) — THE AUDIT PROMPT PRINTS MONEY ONLY FOR A STOP/);
});

// ── R7 · NOTHING ELSE ───────────────────────────────────────────────────────

test('R7 nothing else: the plates, the forms, the deck, the ledger and the routes know nothing of "Tomorrow:"; the reel still sends nothing', () => {
  for (const f of [
    'src/components/workbench/operations/stops/JournalForm.tsx', 'src/components/workbench/operations/stops/EveningForm.tsx', 'src/components/workbench/operations/stops/DayDeck.tsx',
    'src/components/workbench/operations/stops/StopForm.tsx', 'src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/app/api/operations/journal/route.ts', CARD, RULE,
  ]) assert.doesNotMatch(code(f), /TOMORROW_WORDS|tomorrowWords|'Tomorrow/, `${f} prints no Tomorrow`);
  for (const f of [CARD, RULES, TAG]) assert.doesNotMatch(code(f), /\bfetch\s*\(|generate-script|anthropic|openai|XMLHttpRequest|sendBeacon/i, `${f} sends nothing`);
  assert.doesNotMatch(code(CARD).slice(code(CARD).indexOf('function EveningPlate(')), /\.next\b[^;]*Tomorrow|tomorrowWords/, 'the evening plate prints next as NEXT, not as Tomorrow');
});
