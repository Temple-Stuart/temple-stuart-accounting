/**
 * DATAFLOW-01 (Alex, 2026-11-02) — THE PIPELINE DECK TELLS THE TRUTH ABOUT TODAY.
 * Every "Today…" line in the fourteen steps is DERIVED from a leaf at render or TYPED
 * with the file:line that makes it true on the same line (Landing.tsx DECK_TODAY).
 * DATAFLOW-01b (Alex, 2026-11-03) corrects #1888: the deck's size is the August 24
 * census again (no rule-book count anywhere); step 7's beat words are the registry's
 * own; one constant says what a new provider is (steps 2 and 4); step 4's retired row
 * says so; step 9 tags both live matches; the README's gap ledger quotes the deck and
 * cannot drift from it. Ruling C (step 6 and step 8) was STOPPED — the test pins why.
 *
 *   T1 no Grok or xAI in any today-line, the menu as spoken today or step 3's example —
 *      except the census line, which names xAI as the provider that left (ruling A);
 *      the rule book's xAI rows and the enum stay (a migration, not this PR);
 *   T2 step 7's line: the registry's four-beat tools in registry order, in its own beat words;
 *   T3 the counts are the August 24 census — verbatim, cited, no rule-book count anywhere;
 *   T4 the fixed lines' text, verbatim; the old words gone; step 9's two tags; C stopped, with the evidence;
 *   T5 every typed today-line carries `// true per ` with file:lines that exist and still
 *      hold what the citation names — and no raw today-line is left in the deck's JSX;
 *   T6 ruling D of DATAFLOW-01, the second path: the S14 law re-run at the build's seat;
 *   T7 the README's gap ledger and count line equal the deck's strings, computed here;
 *   T8 step 2 and step 4 read one constant; step 4's retired label comes from RETIRED_PROVIDERS.
 * Source is read through code(), comments() and rejoin() only (the reader law). No clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { code, comments, rejoin } from '../sourceText';
import { ALL_BEATS_LINE, BEAT_WORDS, TOOL_REGISTRY, allBeatsLine } from '../toolRegistry';
import * as providers from '../providers';
import { ADDED_RULES, PROVIDER_MENU, RETIRED_PROVIDERS, ROUTING_RULES, RULE_BOOK, isRetired, liveMenuCell, providersLaw } from '../providers';
import { KIND_VIEWS_HONEST_LINE } from '../kindViews';

Object.assign(globalThis, { React });

const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SCHEMA = 'prisma/schema.prisma';
const REGISTRY = 'src/lib/toolRegistry.ts';
const README = 'README.md';
const GROK = /grok|xai/i;

const landingCode = code(LANDING);
const codeLines = landingCode.split('\n');
const noteLines = comments(LANDING).split('\n');
const deck = () => import('@/components/landing/Landing');

/** DECK_TODAY's entries as the source holds them: one per line, its key and the line it sits on. */
const deckTodayLines = (() => {
  const start = codeLines.findIndex((l) => l.startsWith('export const DECK_TODAY = {'));
  const end = codeLines.findIndex((l, i) => i > start && l.startsWith('} as const;'));
  assert.ok(start > -1 && end > start, 'Landing.tsx exports DECK_TODAY');
  return codeLines.slice(start + 1, end).map((line, k) => {
    const m = /^ {2}(\w+): (['"`]).*\2,\s*$/.exec(line);
    assert.ok(m, `DECK_TODAY line ${start + 2 + k} is one entry on one line: ${line.trim().slice(0, 80)}`);
    return { key: m[1], index: start + 1 + k };
  });
})();

/** The deck's JSX: THE PIPELINE header through the end of deck-14. */
const deckJsx = (() => {
  const from = codeLines.findIndex((l) => l.includes('<section aria-label="The pipeline"'));
  const at14 = codeLines.findIndex((l) => l.includes('id="deck-14"'));
  const to = codeLines.findIndex((l, i) => i > at14 && l.trim() === '</section>');
  assert.ok(from > -1 && at14 > from && to > at14, 'the deck runs from THE PIPELINE header through deck-14');
  return { from, to, lines: codeLines.slice(from, to + 1) };
})();

const NEW_PROVIDER = 'one row in the rule book — a code file, checked at build — and one enum value';
const WANT = {
  intro: 'One data pipe is the plan for the whole system. Each step below says what runs today.',
  s02: 'Here is who we speak to today:',
  s03: 'And here is the real size of it: on August 24, 2026 we counted 121 feeds from 20 providers — one of those providers, xAI, has left since.',
  s05: 'We classified every one of the 121 feeds — August 24, 2026 — and posting took zero.',
  s04: `When a new provider shows up, it is ${NEW_PROVIDER}; no new logic, no new tables.`,
  s07: 'Hotel and flight bookings commit for real, and an accepted task fires its build — for the repo owner today; the route refuses anyone else.',
  s08: "Today each tool keeps its own table; one table holding every document is the shape we're building.",
  s09: '(Two pieces of this are already alive today: card charges find their bookings and propose the match — you approve it; and you link a routine occurrence or a task to the journal entry that settled it.)',
  s10: "The posting view is the blueprint — today it holds zero lines by design — the ledger already has its lines. The rules writing them is the bookkeeping pipe we're building.",
  s11: "Today all four compute — tax and the business result from the journal entries you commit by hand, runway from Plaid's account balances against those entries, trading from the positions and lots you committed, with no live quote in the number.",
  s12: 'Today the calendar window is live in the cockpit, and the ledger window is live in Books, showing the committed lines; the posting pipe will land more.',
  s13: 'Alive today: two matches — card charges find their bookings and propose the match, which you approve; and you link a routine occurrence or a task to the journal entry that settled it. The project lane is wired end to end: a task lands for your review, and accepting it fires the build that answers it — for the repo owner today; the route refuses anyone else.',
  s14Fingerprint: 'Alive today: the fingerprint, on the rules and the audit log — every regulation pull is hashed the moment it lands, and the audit log hash-chains every entry it records; the citation re-check is written, but the hash it compares against is stored empty today, so it proves nothing yet.',
  s14Arrivals: "Today the Plaid feeds land in that table — every answer word for word, fingerprinted: 9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026 — and so do LiteAPI's bookings, cancellations, booking reads and webhooks, and Stripe's webhook events.",
  s14Parsed: "The other providers still land parsed; the same table is the shape they're moving into.",
} as const;

// ── T1 · NO GROK, NO xAI TODAY ───────────────────────────────────────────────

test('T1 no Grok or xAI in any today-line, the menu as spoken today, or step 3\'s example — the census line alone names xAI, as the provider that left; the rule book\'s xAI rows and the enum stay', async () => {
  const { DECK_TODAY } = await deck();
  for (const [key, text] of Object.entries(DECK_TODAY)) {
    if (key === 's03') assert.ok(text.endsWith('— one of those providers, xAI, has left since.'), 'ruling A: the census line names the one provider that left');
    else assert.doesNotMatch(text, GROK, `DECK_TODAY.${key}`);
  }
  for (const line of [ALL_BEATS_LINE, KIND_VIEWS_HONEST_LINE]) assert.doesNotMatch(line, GROK);
  for (const [job, cell] of PROVIDER_MENU) assert.doesNotMatch(liveMenuCell(cell), GROK, `the menu's ${job} row as spoken today`);
  assert.equal(liveMenuCell('anthropic · openai · xai grok · voyage'), 'anthropic · openai · voyage', 'step 2: our AI, today');
  const s3 = [...new Set(PROVIDER_MENU.flatMap(([, cell]) => liveMenuCell(cell).split(' · ')))];
  assert.deepEqual(s3, ['plaid', 'stripe', 'tastytrade', 'finnhub', 'fred', 'sec', 'liteapi', 'viator', 'google places', 'travel buddy', 'anthropic', 'openai', 'voyage', 'ecfr', 'us code', 'federal register', 'irs'], 'step 3\'s provider list, as derived');
  const arrivals = /const IMPORT_ARRIVALS = \[([\s\S]*?)\] as const;/.exec(landingCode);
  assert.ok(arrivals, 'Landing.tsx declares IMPORT_ARRIVALS');
  assert.doesNotMatch(arrivals[1], GROK, 'no xAI row in step 3\'s example');
  assert.match(arrivals[1], /\['openai', '—', 'insight', 'chatcmpl-9xR7', 'arr_0014', /, 'arr_0014 is openai\'s second insight answer');
  assert.equal((arrivals[1].match(/\['/g) ?? []).length, 19, 'nineteen rows, as step 3 says');
  assert.match(landingCode, /const S3_PROVIDERS = \[\.\.\.new Set\(PROVIDER_MENU\.flatMap\(\(\[, today\]\) => liveMenuCell\(today\)\.split\(' · '\)\)\)\];/);
  assert.equal((landingCode.match(/>\{liveMenuCell\(today\)\}<\/td>/g) ?? []).length, 2, 'both menu tables speak the TODAY cell as of today');
  for (const line of deckJsx.lines) assert.doesNotMatch(line, GROK, `nothing in the deck's JSX types Grok or xAI: ${line.trim().slice(0, 80)}`);
  assert.deepEqual(RETIRED_PROVIDERS, [['xai grok', '2026-09-10', '8358dc28']]);
  assert.ok(isRetired('xai grok') && !isRetired('openai'));
  assert.ok(PROVIDER_MENU.some(([, cell]) => cell.includes('xai grok')), 'the menu still names xai grok — the deck filters it at render');
  assert.ok(ROUTING_RULES.some(([p, r]) => p === 'xai grok' && r === 'sentiment'), 'the rule book still holds xai grok · sentiment');
  assert.match(code(SCHEMA), /enum arrival_provider \{[^}]*\n {2}xai_grok\n\}/, 'the enum keeps xai_grok');
  assert.deepEqual(providersLaw({ throwOnFail: false }), []);
});

// ── T2 · STEP 7, FROM THE REGISTRY, IN ITS OWN WORDS ─────────────────────────

test('T2 step 7\'s line is the registry\'s four-beat tools in registry order, in the registry\'s own beat words — "draft" gone (DATAFLOW-01b B)', async () => {
  assert.deepEqual(BEAT_WORDS, ['discover', 'decide', 'commit', 'record']);
  for (const t of TOOL_REGISTRY) assert.deepEqual(Object.keys(t.beats), [...BEAT_WORDS], `${t.name}'s beats are the Beats keys in their declared order`);
  assert.match(code(REGISTRY), /const ALL: Beats = \{ discover: true, decide: true, commit: true, record: true \};/);
  const four = TOOL_REGISTRY.filter((t) => BEAT_WORDS.every((beat) => t.beats[beat])).map((t) => t.name);
  assert.deepEqual(four, ['Tasks', 'Time', 'Expenses', 'Travel', 'Budget', 'Bookkeeping']);
  assert.equal(ALL_BEATS_LINE, allBeatsLine());
  assert.equal(ALL_BEATS_LINE, `Today ${four.length} tools run all four beats — ${BEAT_WORDS.join(', ')}: ${four.join(', ')}.`);
  assert.equal(ALL_BEATS_LINE, 'Today 6 tools run all four beats — discover, decide, commit, record: Tasks, Time, Expenses, Travel, Budget, Bookkeeping.');
  const ALL = { discover: true, decide: true, commit: true, record: true };
  const fixture = TOOL_REGISTRY.map((t) => (t.name === 'Calendar' ? { ...t, beats: ALL } : t));
  assert.equal(allBeatsLine(fixture), 'Today 7 tools run all four beats — discover, decide, commit, record: Calendar, Tasks, Time, Expenses, Travel, Budget, Bookkeeping.', 'the derivation is real');
  const { DECK_TODAY } = await deck();
  for (const text of [ALL_BEATS_LINE, DECK_TODAY.s07]) assert.doesNotMatch(text, /\bdraft\b/, '"draft" left step 7');
  assert.ok(landingCode.includes("This loop is the blueprint — the shape we&apos;re building every tool toward. {ALL_BEATS_LINE} {DECK_TODAY.s07}</p>"));
  assert.doesNotMatch(code(REGISTRY), /discover, decide, draft, commit/);
});

// ── T3 · THE COUNTS, THE AUGUST 24 CENSUS ────────────────────────────────────

test('T3 the counts are the August 24 census — verbatim, cited to d0738c9b / PR #1581 and RETIRED_PROVIDERS; no rule-book count anywhere (DATAFLOW-01b A)', async () => {
  const { DECK_TODAY } = await deck();
  assert.equal(DECK_TODAY.s03, WANT.s03);
  assert.equal(DECK_TODAY.s05, WANT.s05);
  for (const key of ['s03', 's05'] as const) {
    assert.doesNotMatch(DECK_TODAY[key], /per the rule book/, `${key}: "per the rule book" left`);
    const note = noteLines[deckTodayLines.find((e) => e.key === key)!.index];
    assert.match(note, /\/\/ true per commit d0738c9b, PR #1581/, `${key} names the census record`);
    assert.match(note, /src\/lib\/providers\.ts:\d+ RETIRED_PROVIDERS/, `${key} names RETIRED_PROVIDERS`);
  }
  assert.ok(landingCode.includes('{DECK_TODAY.s03} We will show you a small example'), 'step 3 renders the census line');
  assert.ok(landingCode.includes('We did not guess this. {DECK_TODAY.s05} The data agreed!'), 'step 5 renders the classification line');
  for (const gone of ['RULE_BOOK_COUNTS_LINE', 'ruleBookCounts', 'ruleBookCountsLine', 'LIVE_PROVIDERS']) {
    assert.ok(!(gone in providers), `providers.ts exports no ${gone}`);
    assert.ok(!landingCode.includes(gone), `Landing.tsx names no ${gone}`);
  }
  assert.doesNotMatch(landingCode, /per the rule book/, 'no rule-book count in the deck');
  assert.ok(DECK_TODAY.s14Arrivals.includes('9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026'), 'step 14\'s database counts stay as written');
});

// ── T4 · THE FIXED LINES, VERBATIM; C AND D STOPPED ──────────────────────────

test('T4 the fixed lines\' text, verbatim, rendered where they were; the old words gone; step 9 tags both live matches; ruling C stopped, with the evidence', async () => {
  const { DECK_TODAY } = await deck();
  assert.deepEqual({ ...DECK_TODAY }, { ...WANT });
  assert.deepEqual(deckTodayLines.map((e) => e.key), Object.keys(WANT), 'one source line per entry, in this order');
  const renders: Array<[string, string]> = [
    ['B.10 intro', '{DECK_TODAY.intro}'],
    ['step 2', '<p className={`mt-10 ${DECK.statement}`}>{DECK_TODAY.s02}</p>'],
    ['A step 3', '{DECK_TODAY.s03} We will show you a small example'],
    ['B.8 step 4', 'It is not a guess buried in code. {DECK_TODAY.s04} And the line is who did the math'],
    ['A step 5', 'We did not guess this. {DECK_TODAY.s05} The data agreed!'],
    ['step 8', '<p className={`mt-2 ${DECK.statement}`}>The master table is the blueprint. {DECK_TODAY.s08}</p>'],
    ['B.4 step 9', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s09}</p>'],
    ['B.5 step 10', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s10}</p>'],
    ['step 11', '<p className={`mt-2 ${DECK.statement}`}>These four lenses are the blueprint. {DECK_TODAY.s11} The rules-written lines and the live quotes the blueprint reads wait on the posting pipe.</p>'],
    ['B.6 step 12', '<p className={`mt-2 ${DECK.statement}`}>Two windows over one set of rows is the blueprint. {DECK_TODAY.s12}</p>'],
    ['B.4 B.9 step 13', '<p className={`mt-[14px] ${DECK.statement}`}>{DECK_TODAY.s13}</p>'],
    ['B.7 step 14', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s14Fingerprint} {DECK_TODAY.s14Arrivals} {DECK_TODAY.s14Parsed}</p>'],
  ];
  for (const [what, jsx] of renders) assert.equal((landingCode.match(new RegExp(jsx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `${what} renders once`);
  assert.ok(DECK_TODAY.s10.includes('zero lines by design — the ledger already has its lines'));
  for (const key of ['s07', 's13'] as const) assert.ok(DECK_TODAY[key].includes(' — for the repo owner today; the route refuses anyone else'), `B.9 in ${key}`);
  for (const stale of [
    'One data pipe runs the whole system.', 'not code, and not new tables', 'today it holds zero lines.', 'the ledger window fills as the posting pipe lands its lines',
    'A piece of this is already alive today', 'Alive today: the travel match', 'just rows in a table', 'today that is',
  ]) assert.ok(!landingCode.includes(stale), `gone: ${stale}`);
  // RULING D: step 9 tags both live matches — Travel (the card charge to its booking) and the tool whose registry
  // entry cites the route that writes planned_item_links, the one writer of the hand link. Only Bill Pay's does.
  const registryText = rejoin(code(REGISTRY), comments(REGISTRY)).split('\n');
  const citing = registryText.flatMap((l, i) => (l.includes('POST /api/calendar/links') ? [i + 1] : []));
  // PREVIEW-DB-01 (2026-11-03): :316 → :320 — TRAVEL-02b-fix's four dated-note lines above it (Payments' and Bill Pay's
  // re-cited citations) merged just before this test's PR, which had pinned the line on the main it was written against;
  // main has failed this pin since. Moved, not loosened: the same one line, the same words, the same entry.
  assert.deepEqual(citing, [320], 'one registry line cites the route');
  assert.match(registryText[319], /record: BillPaySection\.tsx:78 \("link payment"[^)]*\) → :86 the existing ledger\/LinkPicker\.tsx → POST \/api\/calendar\/links/);
  assert.equal(registryText.slice(0, 319).reverse().find((l) => /^ {2}['\w& ]+: \{$/.test(l)), "  'Bill Pay': {", 'that line is Bill Pay\'s entry');
  assert.match(code('src/app/api/calendar/links/route.ts'), /prisma\.planned_item_links\.create\(/, 'that route is the writer');
  assert.equal((landingCode.match(/ {4}live: tool === 'Travel' \|\| tool === 'Bill Pay',/g) ?? []).length, 1, 'step 9 tags Travel and Bill Pay');
  assert.match(landingCode, /tag: live \? '· LIVE TODAY' : null/, 'step 13\'s lanes read the same flag');
  // RULING C STOPPED: a built tool among the sixteen keeps no table of its own — Budget's report reads only other
  // tools' tables, and the budgets table is written only by a route no page calls.
  const movers = /const S2_MOVERS = new Set<string>\(\[([\s\S]*?)\]\);/.exec(landingCode);
  assert.ok(movers, 'Landing.tsx declares S2_MOVERS');
  const nine = [...movers[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const sixteen = TOOL_REGISTRY.filter((t) => !nine.includes(t.name));
  assert.equal(sixteen.length, 16);
  assert.deepEqual(sixteen.filter((t) => t.status !== 'NOT_BUILT').map((t) => t.name), ['Calendar', 'Tasks', 'Time', 'Bill Pay', 'Budget', 'Bookkeeping', 'Tax']);
  const budgetReads = ['src/lib/budget/reportReads.ts', 'src/app/api/budget/report/route.ts', 'src/app/api/budget/report/cell/route.ts'].map((f) => code(f)).join('\n');
  assert.deepEqual([...new Set([...budgetReads.matchAll(/\bdb\.(\w+)\./g)].map((m) => m[1]))].sort(), ['chart_of_accounts', 'ledger_entries', 'operations_project_tasks', 'planned_item_vendors'], 'Budget reads Books\', Tasks\' and the vendors\' tables');
  assert.doesNotMatch(budgetReads, /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\bbudgets\./, 'and writes none, nor reads the budgets table');
  assert.ok(landingCode.includes('The sixteen are yours — and they have no table. That&apos;s the one gap left.'), 'step 6 stands as it was until Alex rules');
  assert.ok(landingCode.includes('<p className={`mt-2 ${DECK.statement}`}>The master table is the blueprint. {DECK_TODAY.s08}</p>') && DECK_TODAY.s08.startsWith('Today each tool keeps'), 'step 8 stands as it was until Alex rules');
  assert.ok(!('s06' in DECK_TODAY), 'no derived step-6 line was built');
});

// ── T5 · EVERY TYPED TODAY-LINE CARRIES ITS FILE:LINE, AND THE LINE HOLDS IT ─

test('T5 every typed today-line carries `// true per ` with file:lines that exist and still hold what each names — and no raw today-line is left in the deck\'s JSX', () => {
  const CITE = /((?:src|prisma|scripts)\/[\w./[\]-]+?\.(?:tsx|ts|prisma)|README\.md)?:(\d+)(?:-(\d+))?([^·]*)/g;
  const providerLine = codeLines.findIndex((l) => l.startsWith('export const NEW_PROVIDER_IS ='));
  const liveAt = codeLines.findIndex((l) => l.trim().startsWith("live: tool === 'Travel' || tool === 'Bill Pay',"));
  const sevenAt = noteLines.findIndex((l) => l.includes('true per scripts/assert-tool-registry.ts:984'));
  assert.ok(providerLine > -1 && liveAt > -1 && sevenAt > -1, 'the constant, the step-9 tag and the step-14 note are found');
  const cited = [...deckTodayLines.map((e) => ({ key: e.key, index: e.index })), { key: 'NEW_PROVIDER_IS', index: providerLine }, { key: 'S9 live', index: liveAt }, { key: 'S14 note', index: sevenAt }];
  const files = new Map<string, string[]>();
  let checked = 0;
  let anchored = 0;
  for (const { key, index } of cited) {
    const note = noteLines[index];
    assert.match(note, /true per /, `${key} carries its "true per" on the same line`);
    let file: string | undefined;
    for (const m of note.matchAll(CITE)) {
      file = m[1] ?? file;
      if (!file) continue;
      assert.ok(existsSync(resolve(process.cwd(), file)), `${key}: ${file} exists`);
      if (!files.has(file)) files.set(file, rejoin(code(file), comments(file)).split('\n'));
      const body = files.get(file)!;
      const from = Number(m[2]);
      const to = m[3] ? Number(m[3]) : from;
      assert.ok(from >= 1 && to <= body.length && from <= to, `${key}: ${file}:${from}${to === from ? '' : `-${to}`} is inside the file (${body.length})`);
      checked += 1;
      // the anchor: the first word after the line number names what the line holds
      const anchor = (m[4].trim().split(/\s+/)[0] ?? '').replace(/^[("'<]+/, '').replace(/[)"'>,;:/]+$/, '');
      if (!/[A-Za-z_]/.test(anchor)) continue;
      assert.ok(body.slice(from - 1, to).join('\n').includes(anchor), `${key}: ${file}:${from} holds "${anchor}" — the citation still names its line`);
      anchored += 1;
    }
  }
  assert.ok(checked > 70 && anchored > 40, `${checked} file:line citations checked, ${anchored} by their anchor`);
  const EXEMPT: Array<[RegExp, string]> = [
    [/So today, to see your full picture/, 'step 1 — the reader\'s world before this system, not a claim about it'],
    [/\['THE JOB', 'TODAY', 'NEXT'\]/, 'the menu table\'s column header'],
    [/\['TODAY', 'w-\[30%\]'\]/, 'the menu table\'s column header'],
    [/PROVIDER_MENU\.map\(\(\[job, today, next\], r\) =>/, 'the menu row\'s field name'],
    [/>\{liveMenuCell\(today\)\}</, 'the TODAY cell, derived'],
    [/the providers in the TODAY column/, 'step 3 names the column'],
    [/\{r\.live && <span [^>]*>live today<\/span>\}/, 'step 9\'s tag, cited at S9_LAYOUT'],
  ];
  const raw = deckJsx.lines.filter((l) => /\b(?:today|Today|TODAY)\b/.test(l) && !EXEMPT.some(([re]) => re.test(l)));
  assert.deepEqual(raw.map((l) => l.trim().slice(0, 120)), [], 'every today-line in the deck is DECK_TODAY or a derived const');
});

// ── T6 · DATAFLOW-01 RULING D, THE SECOND PATH ───────────────────────────────

test('T6 the S14 law re-runs at the build\'s providers-law seat; the deck\'s line stands unchanged', async () => {
  const law = code(LAW);
  assert.match(law, /import \{ s14Law \} from '\.\.\/src\/components\/landing\/Landing';/);
  assert.match(law, /lawGuard\('The proof law', \(\) => \{[\s\S]*?violations\.push\(\.\.\.s14Law\(\{ throwOnFail: false \}\)\);[\s\S]*?\}\);/);
  assert.match(landingCode, /export function s14Law\(opts: \{ throwOnFail\?: boolean \} = \{\}\): string\[\] \{/);
  assert.match(landingCode, /const S14_LAYOUT = s14Layout\(\);/);
  assert.ok(landingCode.includes('seven of seven hops checked at build — a failed check is a failed build.</p>'), 'the line did not change; the build did');
  const { s14Law } = await deck();
  assert.deepEqual(s14Law({ throwOnFail: false }), []);
  assert.deepEqual(s14Law(), []);
});

// ── T7 · THE README QUOTES THE DECK ──────────────────────────────────────────

test('T7 the README\'s gap ledger quotes the deck\'s lines, its count line is the census line, and its step-04 rule-book count is RULE_BOOK\'s — computed here so the two cannot drift (DATAFLOW-01b G)', async () => {
  const { DECK_TODAY: T } = await deck();
  const readme = rejoin(code(README), comments(README)).split('\n');
  const todayOf = (step: string) => {
    const row = readme.find((l) => l.startsWith(`| ${step} | `) && l.split(' | ').length === 4);
    assert.ok(row, `the gap ledger has row ${step}`);
    return row.split(' | ')[2];
  };
  const quotes: Array<[string, string]> = [
    ['05', KIND_VIEWS_HONEST_LINE],
    ['07', `This loop is the blueprint — the shape we're building every tool toward. ${allBeatsLine()} ${T.s07}`],
    ['08', `The master table is the blueprint. ${T.s08}`],
    ['09', T.s09],
    ['10', T.s10],
    ['11', `These four lenses are the blueprint. ${T.s11} The rules-written lines and the live quotes the blueprint reads wait on the posting pipe.`],
    ['12', `Two windows over one set of rows is the blueprint. ${T.s12}`],
    ['13', T.s13],
    ['14', `${T.s14Fingerprint} ${T.s14Arrivals} ${T.s14Parsed}`],
  ];
  for (const [step, deckLine] of quotes) assert.equal(todayOf(step), deckLine, `README gap ledger row ${step} quotes the deck`);
  assert.ok(readme.includes(`The deck's own count: ${T.s03.slice(T.s03.indexOf(': ') + 2)}`), 'README\'s count line is the deck\'s census line');
  const book = `src/lib/providers.ts RULE_BOOK, ${RULE_BOOK.length} rows (the deck's ${ROUTING_RULES.length} plus ${ADDED_RULES.map(([p, r, k]) => `${p} · ${r} → ${k.toLowerCase()}`).join(', ')})`;
  assert.ok(todayOf('04').includes(book), `README row 04 counts the rule book as it is: ${book}`);
  assert.ok(readme[4].includes('as of 2026-09-02: ') && readme[4].includes('121 feeds from 20 providers (counted August 24, 2026)'), 'README:5 stays as written, dated');
  for (const stale of ['today that is 121 feeds', 'discover, decide, draft, commit', 'The posting table is the blueprint', 'A piece of this is already alive today']) assert.ok(!readme.join('\n').includes(stale), `README: gone — ${stale}`);
});

// ── T8 · ONE CONSTANT FOR A NEW PROVIDER; THE RETIRED ROW SAYS SO ────────────

test('T8 step 2 and step 4 read one constant for what a new provider is; step 4\'s retired label is derived from RETIRED_PROVIDERS (DATAFLOW-01b E, F)', async () => {
  const { NEW_PROVIDER_IS, DECK_TODAY } = await deck();
  assert.equal(NEW_PROVIDER_IS, NEW_PROVIDER);
  assert.equal(DECK_TODAY.s04, `When a new provider shows up, it is ${NEW_PROVIDER_IS}; no new logic, no new tables.`);
  assert.ok(landingCode.includes('The system does not care; a provider is {NEW_PROVIDER_IS}, so a new one is added, never built.'), 'step 2 reads the constant');
  assert.match(landingCode, /s04: `When a new provider shows up, it is \$\{NEW_PROVIDER_IS\}; no new logic, no new tables\.`,/, 'step 4 reads the constant');
  assert.ok(landingCode.includes('{isRetired(ROUTING_RULES[i][0]) && <span className="whitespace-nowrap pl-1 text-text-faint" data-s4-retired>retired</span>}'), 'the label is drawn from RETIRED_PROVIDERS, beside the empty slot');
  assert.match(landingCode, /\{feed === null \? \(\s*<>\s*<span className="text-text-faint">—<\/span>\s*\{isRetired\(ROUTING_RULES\[i\]\[0\]\)/, 'only an empty feed slot can carry it');
  assert.deepEqual(ROUTING_RULES.filter(([p]) => isRetired(p)).map(([p, r]) => `${p} · ${r}`), ['xai grok · sentiment'], 'exactly one rule-book row is retired today');
});
