/**
 * REEL-01 (Alex, 2026-10-15) — THE REEL KIT ON THE DAY CARD: one tag per stop
 * for video overlays, the day's caption, and the reel's script — each built from
 * the card's own figures.
 *
 * Alex posts a daily reel built on the day card: a bold tag per scene (the stop:
 * its vendor, price against budget, stars), the full card as the receipt at the
 * end, and every night a caption and a narration typed by hand from the same
 * data. R1 the tag, R2 the caption, R5 the script — each one pure rule in
 * dayCard.ts, made from Stop, Focus, dayTotals and dayVerdict (R3: no number the
 * card does not show); nothing leaves the browser but the PNG and the clipboard
 * (R4). A read an output uses that is in flight makes it wait; one that failed
 * is named; never a partial text (Alex's ruling 2a). No covering stay → no
 * caption and no script, said by name.
 *
 * The rules are DRIVEN over a day built by dayStops from the card's own shapes;
 * the screen is anchored to its source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { PlanLine } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import type { StopRole } from '../operations/stopRole';
import type { Routine, TodayRoutineEntry } from '@/components/workbench/operations/routines/types';
import {
  CAPTION_COPIED_WORDS, CAPTION_TAGS, COPY_CAPTION_WORDS, COPY_SCRIPT_WORDS, REEL_READ_NAMES, SCRIPT_BLANKS, SCRIPT_COPIED_WORDS, TAG_WIDTH,
  captionTags, captionText, copyFailedWords, dayStops, dayTotals, dayVerdict, focusStop, noStayReelWords, reelReadsWords, scriptText,
  stepSpentSoFarWords, stopName, stopScriptText, stopTagWords, tagBudgetWords, type DayCardInput, type ReelDay, type ReelReads,
} from '@/components/workbench/operations/day/dayCard';
import { DOWNLOAD_TAG_WORDS, cardTagName } from '@/components/workbench/operations/cardImage';

const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const TAG = 'src/components/workbench/operations/stops/StopTag.tsx';
const CARD_IMAGE = 'src/components/workbench/operations/cardImage.ts';

// ── FIXTURES (the day card's own shapes) ────────────────────────────────────

const DAY = '2026-10-15';
const BKK = 'Asia/Bangkok';
const routine = (over: Partial<Routine> & { id: string; name: string; role: StopRole; schedule_rrule: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], ...over,
});
const entry = (r: Routine, expected_at: string): TodayRoutineEntry => ({ routine: r, expected_at, status: 'pending', completion: null });
const vendor = (name: string) => ({ id: `v-${name}`, name, entityId: 'P', grain: 'occurrence' as const });
const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: [], ...over });
const item = (over: Partial<DailyPlanItem> & { id: string }): DailyPlanItem => ({
  user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: null, ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
  notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null, task: null, calendar_blocks: [], ...over,
});

/** Alex's day in Chiang Mai: the journal at 10, Brunch at Luka Café, co-working, Dinner, the Gym, Activities — and a priced task. */
const STOPS = [
  { id: 'journal', name: 'Vision journal', role: 'journal', hour: 10, at: '2026-10-15T03:00:00.000Z', cents: null, vendor: null },
  { id: 'brunch', name: 'Brunch', role: 'place', hour: 12, at: '2026-10-15T05:00:00.000Z', cents: 2500, vendor: 'Luka Café' },
  { id: 'cowork', name: 'Co-working', role: 'execute', hour: 13, at: '2026-10-15T06:00:00.000Z', cents: null, vendor: null },
  { id: 'dinner', name: 'Dinner', role: 'place', hour: 18, at: '2026-10-15T11:00:00.000Z', cents: 3000, vendor: null },
  { id: 'gym', name: 'Gym', role: 'place', hour: 19, at: '2026-10-15T12:00:00.000Z', cents: 1500, vendor: 'Fitness First' },
  { id: 'activities', name: 'Activities', role: 'place', hour: 20, at: '2026-10-15T13:00:00.000Z', cents: 2000, vendor: null },
] as const;
type Id = (typeof STOPS)[number]['id'];
type Rec = { outcome: 'done' | 'skipped'; actual?: number; rating?: number; note?: string };

/** The day's records: Brunch under with stars and a note, Dinner over with stars, the Gym skipped with its reason, the journal done; Activities not recorded. */
const HALF: Partial<Record<Id, Rec>> = {
  journal: { outcome: 'done' },
  brunch: { outcome: 'done', actual: 969, rating: 4, note: 'Eggs benedict' },
  dinner: { outcome: 'done', actual: 3500, rating: 5 },
  gym: { outcome: 'skipped', note: 'closed for a holiday' },
};
/** Every stop that asks an amount carries one — the card shows its verdict. */
const FULL: Partial<Record<Id, Rec>> = {
  journal: { outcome: 'done' },
  brunch: { outcome: 'done', actual: 969, rating: 4, note: 'Eggs benedict' },
  cowork: { outcome: 'done' },
  dinner: { outcome: 'done', actual: 3500, rating: 5 },
  gym: { outcome: 'done', actual: 1500, rating: 3, note: 'leg day' },
  activities: { outcome: 'done', actual: 1200 },
};

function build(recs: Partial<Record<Id, Rec>>, opts: { readonly task?: boolean; readonly taskActual?: string } = {}) {
  const records = STOPS.filter((s) => recs[s.id] !== undefined).map((s): StopRecordRow => {
    const r = recs[s.id] as Rec;
    return {
      id: `rec-${s.id}`, kind: 'routine', target_id: s.id, occurrence_at: s.at, outcome: r.outcome, done_at: r.outcome === 'done' ? s.at : null,
      actual_cents: r.actual ?? null, rating: r.rating ?? null, note: r.note ?? null, actual_minutes: null,
    };
  });
  const withTask = opts.task !== false;
  return dayStops(input({
    entries: STOPS.map((s) => entry(routine({ id: s.id, name: s.name, role: s.role, schedule_rrule: `FREQ=DAILY;BYHOUR=${s.hour};BYMINUTE=0` }), s.at)),
    lines: [
      ...STOPS.flatMap((s) => (s.cents === null ? [] : [line({ address: { kind: 'routine', id: s.id, instant: s.at }, cents: s.cents, label: s.name, vendor: s.vendor === null ? null : vendor(s.vendor) })])),
      ...(withTask ? [line({ address: { kind: 'project_task', id: 't1', instant: null }, cents: 1000, label: 'Ship REEL-01', source: 'task' })] : []),
    ],
    items: withTask ? [item({ id: 'i1', task_id: 't1', task: { id: 't1', title: 'Ship REEL-01', status: 'open', project_id: 'proj', coa_code: null, estimated_cost_usd: '10.00', actual_cost_usd: opts.taskActual ?? null, actual_minutes: null, completed_at: null } })] : [],
    records,
  }));
}

const STAY: StayRow = { id: 's1', place: 'Chiang Mai, Thailand 🇹🇭', starts_on: '2026-10-08', ends_on: '2026-10-22' };
const JOURNAL = { goals: ['Ship the reel kit', 'Call the bank'], blocker: 'waiting on the bank' };

/** The ReelDay exactly as DayCard.tsx composes it: the card's stops, its TOTAL row, its verdict on the TOTAL row's BUDGET. */
function reelDay(r: ReturnType<typeof build>, over: Partial<ReelDay> = {}): ReelDay {
  const totals = dayTotals(r, r.plannedCents);
  return { day: DAY, stay: STAY, stops: r.stops, totals, verdict: dayVerdict(r, totals.budgetCents), journal: JOURNAL, ...over };
}
const stopOf = (r: ReturnType<typeof build>, id: Id) => {
  const i = r.stops.findIndex((s) => s.key === `routine:${id}:${STOPS.find((x) => x.id === id)?.at}`);
  assert.ok(i >= 0, `${id} is a stop`);
  return { stop: r.stops[i], n: i + 1 };
};

// ── T0 · THE FIXTURE IS THE CARD'S OWN ─────────────────────────────────────

test('T0 the day as the card builds it: seven stops in the table’s order, the TOTAL row $100 | $44.69, no verdict until every amount is in', () => {
  const half = build(HALF);
  assert.deepEqual(half.stops.map(stopName), ['Vision journal', 'Brunch', 'Co-working', 'Dinner', 'Gym', 'Activities', 'Ship REEL-01']);
  const t = dayTotals(half, half.plannedCents);
  assert.deepEqual([t.budgetCents, t.actualCents], [10000, 4469]);
  assert.equal(dayVerdict(half, t.budgetCents), null, 'Activities asks an amount and has none');
  // The task's own actual is its record (one fact, one home): with it, every stop that asks an amount carries one.
  const full = build(FULL, { taskActual: '8.50' });
  assert.deepEqual(dayVerdict(full, dayTotals(full, full.plannedCents).budgetCents), { text: '▼ $19.81 under', over: false });
  assert.equal(dayVerdict(build(FULL), dayTotals(build(FULL), build(FULL).plannedCents).budgetCents), null, 'without the task’s actual the card shows no verdict — nor do the caption and the script');
});

// ── T1 · R1 THE TAG ─────────────────────────────────────────────────────────

test('T1 the tag: the stay’s count and place, the vendor big, the name and time, the money as the row says it, the stars, the step view’s own spent-so-far', () => {
  const r = build(HALF);
  const budget = dayTotals(r, r.plannedCents).budgetCents;
  const tag = (id: Id, stay: StayRow | null = STAY) => {
    const { stop, n } = stopOf(r, id);
    const f = focusStop(r, n);
    assert.ok(f !== null);
    return { words: stopTagWords({ day: DAY, stay, stop, foot: stepSpentSoFarWords(f, budget) }), foot: stepSpentSoFarWords(f, budget) };
  };
  // Under: Brunch at Luka Café, $9.69 against $25, four stars.
  const under = tag('brunch');
  assert.deepEqual(under.words, {
    top: 'DAY 8 OF 15 · Chiang Mai, Thailand 🇹🇭', big: 'Luka Café', what: 'Brunch · 12:00',
    money: { kind: 'actual', words: '$9.69 ▼ $15.31', over: false }, stars: '★★★★☆', foot: 'spent so far $9.69 of $100',
  });
  // Over: Dinner has no vendor — its name is big, and the second line is its time alone.
  assert.deepEqual(tag('dinner').words, {
    top: 'DAY 8 OF 15 · Chiang Mai, Thailand 🇹🇭', big: 'Dinner', what: '18:00',
    money: { kind: 'actual', words: '$35 ▲ $5', over: true }, stars: '★★★★★', foot: 'spent so far $44.69 of $100',
  });
  // Not recorded: the budget alone; no stars.
  const notRecorded = tag('activities').words;
  assert.deepEqual([notRecorded.money, notRecorded.stars], [{ kind: 'budget', words: 'budget $20', over: null }, null]);
  assert.equal(tagBudgetWords(2000), 'budget $20');
  // Not priced: no money line at all — never $0.
  const notPriced = tag('cowork').words;
  assert.deepEqual([notPriced.big, notPriced.money, notPriced.stars], ['Co-working', null, null]);
  // No covering stay: the day alone (whereWords’ rule).
  assert.equal(tag('brunch', null).words.top, 'Thu Oct 15');
  // The foot is the step view's own line — the one rule both print.
  assert.equal(under.words.foot, under.foot);
  // DECK-01 (Alex, 2026-10-16): the line is each stop card's (stopPlate(f)); the tag is the card in view's (focus). Moved, not loosened.
  assert.match(code(CARD), /data-day-spent-so-far>\{stepSpentSoFarWords\(f, totals\.budgetCents\)\}/);
  assert.match(code(CARD), /const tag = focus !== null && reelWait === null \? stopTagWords\(\{ day, stay: reelStay, stop: focus\.stop, foot: stepSpentSoFarWords\(focus, totals\.budgetCents\) \}\) : null;/);
  assert.throws(() => stopTagWords({ day: '2026-11-01', stay: STAY, stop: r.stops[1], foot: '' }), /does not cover 2026-11-01/, 'a stay that does not cover the day is the caller’s error');
});

test('T1 the tag’s element and file: outside the day folder, the card’s own words and tone, the card’s renderer, named "-tag"', () => {
  assert.equal(TAG_WIDTH, 600);
  assert.equal(DOWNLOAD_TAG_WORDS, 'download tag');
  assert.equal(cardTagName('2026-10-15', { index: 2, label: 'Brunch' }), 'temple-stuart-2026-10-15-step-2-brunch-tag.png');
  assert.throws(() => cardTagName('2026-10-15', { index: 2, label: '☕' }), /has no letter or digit/, 'the name refuses as cardImageName does');
  const t = code(TAG);
  assert.match(t, /import \{ BADGE_WORDS, TAG_WIDTH, type StopTagWords \} from '\.\.\/day\/dayCard';/, 'every word is the card’s');
  for (const part of ['data-stop-tag-top>{words.top}', 'data-stop-tag-big>{words.big}', 'data-stop-tag-what>{words.what}', 'data-stop-tag-money={words.money.kind}>{words.money.words}', 'data-stop-tag-stars>{words.stars}', 'data-stop-tag-foot>{words.foot}']) assert.ok(t.includes(part), `the tag prints ${part}`);
  assert.match(t, /className="bg-ts-white border border-border flex flex-col" style=\{\{ width: TAG_WIDTH, borderRadius: 28,/, 'rounded, no background outside its corners');
  assert.doesNotMatch(t, /note|data-day-plan-bar|data-day-spent-bar|<table|\bfetch\s*\(|useEffect|useState/, 'nothing else: no note, no bars, no table; it reads and writes nothing');
  assert.match(t, /\$\{words\.money\.kind === 'budget' \? 'text-text-secondary' : moneyTone\}/, 'the actual in the tone the card hands it');
  const c = code(CARD);
  assert.match(c, /<StopTag ref=\{tagRef\} words=\{tag\} moneyTone=\{actualTone\(tag\.money === null \? null : tag\.money\.over\)\} \/>/, 'the card’s own actualTone — one colour rule');
  assert.match(c, /<div aria-hidden="true" style=\{\{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' \}\} data-day-tag-stage>/, 'rendered off the page, never seen');
  // DECK-01 (Alex, 2026-10-16): the tag's file is named for the deck's card number (deckIndex — the journal not one), as the card's image is.
  assert.match(c, /await downloadCardImage\(tagRef\.current, cardTagName\(day, \{ index: deckIndex, label: boldOf\(focus\.stop\) \}\)\);/, 'the card’s renderer — its pixel ratio, its transparency');
  assert.match(code(CARD_IMAGE), /export const cardTagName = \(day: string, focus: \{ readonly index: number; readonly label: string \}\): string =>\n\s*cardImageName\(day, focus\)\.replace\(\/\\\.png\$\/, '-tag\.png'\);/);
});

// ── T2 · R2 THE CAPTION ─────────────────────────────────────────────────────

test('T2 the caption of a day half recorded, with a journal and a skipped stop — the exact text; the unrecorded, the task and the journal stop left out', () => {
  const r = build(HALF);
  const caption = captionText(reelDay(r));
  assert.ok(caption.ok);
  assert.equal(caption.text, [
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
  ].join('\n'));
  assert.doesNotMatch(caption.text, /Activities|Co-working|Ship REEL-01|Vision journal|\$0\b/, 'no record, a work stop with no money, a task, the journal stop — none is shown, never as $0');
});

test('T2 the caption of a day fully recorded carries the card’s verdict; no budget → no line 2; no journal → no plan lines; no stay → none, said by name', () => {
  const full = captionText(reelDay(build(FULL, { taskActual: '8.50' })));
  assert.ok(full.ok);
  assert.match(full.text, /Total budget: \$100\nSpent: \$80\.19\n▼ \$19\.81 under\n\n#chiangmai/, 'the totals and the verdict the card shows');
  assert.doesNotMatch(full.text, /Ship REEL-01/, 'a task is left out of the blocks, though its actual is in the totals');
  assert.match(full.text, /Gym at Fitness First\nBudget: \$15\nActual: \$15\non plan\n⭐️⭐️⭐️\nleg day/);
  // No priced stop: no TOTAL row budget, no line 2.
  const unpriced = build({}, { task: false });
  // LEDGER-01 (2026-10-16): dayTotals also returns the recorded budget it measures `over` against — the fixture carries it.
  const bare = captionText(reelDay(unpriced, { totals: { budgetCents: null, actualCents: null, over: null, recordedBudgetCents: null, beyondCents: null }, journal: null }));
  assert.ok(bare.ok);
  assert.ok(bare.text.startsWith('Chiang Mai, Thailand 🇹🇭 Day 8 of 15!\n\nTotal budget: —\nSpent: —\n\n#chiangmai'), bare.text);
  // No journal read (the day has no journal stop) or none typed: no plan lines, and nothing claims there is no journal.
  const noJournal = captionText(reelDay(build(HALF), { journal: null }));
  assert.ok(noJournal.ok);
  assert.doesNotMatch(noJournal.text, /Today’s plan|Blocker|journal/i);
  // A journal with a blocker and no goals: the blocker alone.
  const blockerOnly = captionText(reelDay(build(HALF), { journal: { goals: [], blocker: 'jet lag' } }));
  assert.ok(blockerOnly.ok);
  assert.match(blockerOnly.text, /👇\n\nBlocker: jet lag\n\nBrunch at Luka Café/);
  // No covering stay: no caption — never a guessed place.
  assert.deepEqual(captionText(reelDay(build(HALF), { stay: null })), { ok: false, words: noStayReelWords(DAY) });
  assert.equal(noStayReelWords(DAY), 'no caption and no script — no stay covers Thu Oct 15 (the place and the day count come from the stay)');
});

test('T2 the tags: split at the FIRST comma — the city, the country — lowercased, Unicode letters and digits only; no comma → the city tag; then the three constants', () => {
  assert.deepEqual(CAPTION_TAGS, ['#digitalnomad', '#costofliving', '#buildinpublic']);
  assert.deepEqual(captionTags('Chiang Mai, Thailand 🇹🇭'), ['#chiangmai', '#thailand', ...CAPTION_TAGS], 'the flag and the space go');
  assert.deepEqual(captionTags('Bali'), ['#bali', ...CAPTION_TAGS], 'no comma: the city tag and the three constants');
  assert.deepEqual(captionTags('Hội An, Việt Nam 🇻🇳'), ['#hộian', '#việtnam', ...CAPTION_TAGS], 'Unicode letters kept');
  assert.deepEqual(captionTags('Ho Chi Minh City, Vietnam, Asia'), ['#hochiminhcity', '#vietnamasia', ...CAPTION_TAGS], 'only the first comma splits — the rest is the country part, as written');
  assert.deepEqual(captionTags('🇹🇭, Thailand'), ['#thailand', ...CAPTION_TAGS], 'a part with no letter or digit gives no tag — never a guessed one');
  assert.deepEqual(captionTags('Phuket 2'), ['#phuket2', ...CAPTION_TAGS], 'digits stay');
  assert.match(comments(RULES), /A place with no comma gives the city tag and the three\s*\n\s*\* constants\./, 'the rule says so in its comment');
});

// ── T3 · R5 THE SCRIPT ──────────────────────────────────────────────────────

test('T3 the script of a full day: hook, greeting, the journal, one scene per priced stop, the outro with the card’s tally and verdict', () => {
  const s = scriptText(reelDay(build(FULL, { taskActual: '8.50' })));
  assert.ok(s.ok);
  assert.equal(s.text, [
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
  ].join('\n'));
});

test('T3 the script of a day half recorded: blanks to fill, never $0 — the skipped stop’s scene, the tally and the verdict blank until the day is done', () => {
  const s = scriptText(reelDay(build(HALF)));
  assert.ok(s.ok);
  assert.match(s.text, /\n\nGym: skipped\.\nclosed for a holiday\n\n/, 'a skipped stop: "<name>: skipped." then its reason');
  assert.match(s.text, /\n\nActivities\.\n\[what you got\]\nBudget \$20, actual \[actual\]\.\n\[stars\] out of 5\.\n\n/, 'not recorded: blanks, never $0');
  assert.match(s.text, /\n\nFinal tally: \[actual\] out of \$100\. \[verdict\]\. Day 8 of 15, done\.$/, 'the card shows no verdict yet — the tally and the verdict are blanks');
  assert.doesNotMatch(s.text, /\$0\b|undefined|null/);
  assert.deepEqual(SCRIPT_BLANKS, { budget: '[budget]', actual: '[actual]', stars: '[stars]', what: '[what you got]', verdict: '[verdict]' });
  // No covering stay: no script, said by name — the full card's and the step view's.
  assert.deepEqual(scriptText(reelDay(build(HALF), { stay: null })), { ok: false, words: noStayReelWords(DAY) });
  assert.deepEqual(stopScriptText(DAY, null, build(HALF).stops[1]), { ok: false, words: noStayReelWords(DAY) });
});

test('T3 the step view’s script is that one stop’s scene', () => {
  const r = build(HALF);
  assert.deepEqual(stopScriptText(DAY, STAY, stopOf(r, 'brunch').stop), { ok: true, text: 'Brunch at Luka Café.\nEggs benedict\nBudget $25, actual $9.69, ▼ $15.31 under.\n4 out of 5.' });
  assert.deepEqual(stopScriptText(DAY, STAY, stopOf(r, 'gym').stop), { ok: true, text: 'Gym: skipped.\nclosed for a holiday' });
  assert.deepEqual(stopScriptText(DAY, STAY, stopOf(r, 'cowork').stop), { ok: true, text: 'Co-working.\n[what you got]\n[stars] out of 5.' }, 'a stop that shows neither figure has no money sentence');
});

// ── T4 · 2a THE READS: WAIT, OR NAME THE FAILURE — NEVER A PARTIAL TEXT ─────

test('T4 every read the outputs use: in flight → wait and say which; failed → named (a failure never waits); all in → made', () => {
  const ok: ReelReads = { day: 'ok', tasks: 'ok', report: 'ok', records: 'ok', stay: 'ok', journal: 'ok' };
  assert.equal(reelReadsWords(ok), null);
  assert.equal(reelReadsWords({ ...ok, journal: null }), null, 'a day with no journal stop: the card reads no journal, nothing to wait for');
  assert.equal(reelReadsWords({ ...ok, stay: 'waiting' }), 'not ready — waiting for the stay');
  assert.equal(reelReadsWords({ ...ok, records: 'waiting', journal: 'waiting' }), 'not ready — waiting for the stop records, the journal');
  assert.equal(reelReadsWords({ ...ok, report: 'failed', journal: 'waiting' }), 'not made — the budget report could not be read', 'the failure is named, never waited on');
  assert.equal(reelReadsWords({ ...ok, day: 'failed', records: 'failed' }), 'not made — the day’s routines, the stop records could not be read');
  assert.deepEqual(Object.keys(REEL_READ_NAMES), ['day', 'tasks', 'report', 'records', 'stay', 'journal']);
  const c = code(CARD);
  assert.match(c, /const reelReads: ReelReads = \{\n\s*day: dayRead === null \? 'waiting' : dayRead\.ok && refused\.length === 0 \? 'ok' : 'failed',\n\s*tasks: items === null \? 'waiting' : items\.ok \? 'ok' : 'failed',\n\s*report: report === null \? 'waiting' : report\.ok && report\.value\.plans\.listed \? 'ok' : 'failed',\n\s*records: recordsRead === null \? 'waiting' : recordsRead\.ok \? 'ok' : 'failed',\n\s*stay: staysRead === null \? 'waiting' : staysRead\.ok \? 'ok' : 'failed',\n\s*journal: !hasJournalStop \? null : journalRead === null \? 'waiting' : journalRead\.ok \? 'ok' : 'failed',\n\s*\};/, 'the card’s own read states, by name');
  assert.match(c, /const reelWait = focus === null \? reelReadsWords\(reelReads\) : reelReadsWords\(\{ \.\.\.reelReads, journal: null \}\);/, 'the step view’s tag and scene use no journal');
  assert.match(c, /const caption: ReelText \| null = focus === null && reelWait === null \? captionText\(reelDay\) : null;/, 'made only when every read is in');
  assert.match(c, /const script: ReelText \| null = reelWait !== null \? null : focus === null \? scriptText\(reelDay\) : stopScriptText\(day, reelStay, focus\.stop\);/);
  assert.match(c, /const reelDay = \{ day, stay: reelStay, stops: result\.stops, totals, verdict, journal: reelJournal \};/, 'R3: the card’s own stops, TOTAL row and verdict');
});

// ── T5 · THE SCREEN: THE BUTTONS, THE WORDS, NOTHING LEAVES THE BROWSER ────

test('T5 beside "download image": the full card’s "copy caption", the step view’s "download tag", "copy script" on both — disabled until made; copied or the failure, in words', () => {
  assert.deepEqual([COPY_CAPTION_WORDS, COPY_SCRIPT_WORDS, CAPTION_COPIED_WORDS, SCRIPT_COPIED_WORDS], ['copy caption', 'copy script', 'caption copied', 'script copied']);
  assert.equal(copyFailedWords('caption', 'denied'), 'could not copy the caption — denied');
  const c = code(CARD);
  const row = /<div className="flex flex-wrap items-center gap-1\.5" data-day-reel>([\s\S]*?)<\/div>/.exec(c);
  assert.ok(row !== null, 'one row of buttons');
  const buttons = [...row[1].matchAll(/data-day-([a-z-]+)>\{([A-Z_]+)\}<\/button>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(buttons, [['download-image', 'DOWNLOAD_IMAGE_WORDS'], ['copy-caption', 'COPY_CAPTION_WORDS'], ['download-tag', 'DOWNLOAD_TAG_WORDS'], ['copy-script', 'COPY_SCRIPT_WORDS']]);
  // DECK-01 (Alex, 2026-10-16): copyReel is told which view it copies for (`at`) — the card in view, or the journal card under the deck.
  assert.match(row[1], /\{focus === null && <button type="button" className=\{chip\} disabled=\{caption === null \|\| !caption\.ok\} onClick=\{\(\) => copyReel\('caption', caption, view\)\} data-day-copy-caption>/, 'the caption on the full card');
  assert.match(row[1], /\{focus !== null && <button type="button" className=\{chip\} disabled=\{tag === null \|\| tagBusy\} aria-busy=\{tagBusy\} onClick=\{downloadTag\} data-day-download-tag>/, 'the tag in the step view');
  assert.match(row[1], /<button type="button" className=\{chip\} disabled=\{script === null \|\| !script\.ok\} onClick=\{\(\) => copyReel\('script', script, view\)\} data-day-copy-script>/, 'the script on both');
  // The reasons, in words: waiting or failed reads, no stay; then copied, or the clipboard's refusal — never a silent catch.
  assert.match(c, /\{reelWait !== null && <p className="text-text-muted" data-day-reel-waits>\{reelWait\}<\/p>\}/);
  assert.match(c, /\{script !== null && !script\.ok && <p className="text-text-muted" data-day-reel-no-stay>\{script\.words\}<\/p>\}/);
  assert.match(c, /\{reelWords !== null && reelWords\.view === view && <p className=\{reelWords\.ok \? 'text-text-muted' : 'text-brand-red'\} data-day-reel-words>\{reelWords\.words\}<\/p>\}/);
  assert.match(c, /const copyReel = async \(what: 'caption' \| 'script', text: ReelText \| null, at: string\) => \{/);
  assert.match(c, /try \{\n\s*await navigator\.clipboard\.writeText\(text\.text\);\n\s*setReelWords\(\{ view: at, ok: true, words: what === 'caption' \? CAPTION_COPIED_WORDS : SCRIPT_COPIED_WORDS \}\);\n\s*\} catch \(error\) \{\n\s*setReelWords\(\{ view: at, ok: false, words: copyFailedWords\(what, error instanceof Error \? error\.message : String\(error\)\) \}\);\n\s*\}/, 'copied, or the failure said');
  assert.equal((c.match(/navigator\.clipboard/g) ?? []).length, 1, 'one write — no second path');
  // R4: nothing leaves the browser but the PNG and the clipboard — no fetch, no model, no route, in the card, its rules or the tag.
  for (const f of [CARD, RULES, TAG]) assert.doesNotMatch(code(f), /\bfetch\s*\(|generate-script|anthropic|openai|XMLHttpRequest|sendBeacon/i, `${f} sends nothing`);
  assert.ok(!c.slice(c.lastIndexOf('<div', c.indexOf('data-day-card')), c.indexOf('data-day-image>')).includes('data-day-reel'), 'outside the plate — never in the card’s own image');
});
