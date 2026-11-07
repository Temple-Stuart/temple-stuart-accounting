/**
 * DATAFLOW-01 (Alex, 2026-11-02) — THE PIPELINE DECK TELLS THE TRUTH ABOUT TODAY.
 * Every "Today…" line in the fourteen steps is DERIVED from a leaf at render or TYPED
 * with the file:line that makes it true on the same line (Landing.tsx DECK_TODAY).
 * DATAFLOW-01b (Alex, 2026-11-03) corrects #1888: the deck's size is the August 24
 * census again (no rule-book count anywhere); step 7's beat words are the registry's
 * own; one constant says what a new provider is (steps 2 and 4); step 4's retired row
 * says so; step 9 tags both live matches; the README's gap ledger quotes the deck and
 * cannot drift from it. DATAFLOW-01c (Alex, 2026-11-03): the sixteen are counted by who
 * keeps a table of their own (the registry's ownTable, its writing route cited and checked
 * at build); step 6 is derived from it and step 8 cites it; step 2 ends on step 4's point;
 * the README's gap cells say only what is missing; the phone shows step 4's retired slot.
 * DATAFLOW-01d (Alex, 2026-11-03): Budget's beats are what its page does — discover alone,
 * cited to the report route; step 7 and README row 07 derive five tools from the registry.
 * DATAFLOW-01e (Alex, 2026-11-03): the three "twenty-five of twenty-five" captions say they are
 * the blueprint; Budget's BUDGET-02 note names the one file that mounts the vendor box.
 *
 *   T1 no Grok or xAI in any today-line, the menu as spoken today or step 3's example —
 *      except the census line, which names xAI as the provider that left (ruling A);
 *      the rule book's xAI rows and the enum stay (a migration, not this PR);
 *   T2 step 7's line: the registry's four-beat tools in registry order, in its own beat words;
 *   T3 the counts are the August 24 census — verbatim, cited, no rule-book count anywhere;
 *   T4 the fixed lines' text, verbatim; the old words gone; step 9's two tags; steps 6 and 8 from ownTable;
 *   T5 every typed today-line carries `// true per ` with file:lines that exist and still
 *      hold what the citation names — and no raw today-line is left in the deck's JSX;
 *   T6 ruling D of DATAFLOW-01, the second path: the S14 law re-run at the build's seat;
 *   T7 the README's gap ledger and count line equal the deck's strings, computed here;
 *   T8 step 2 and step 4 read one constant; step 4's retired label comes from RETIRED_PROVIDERS, on both widths;
 *   T9 the own-table law refuses by name, and step 6's line moves with the registry (DATAFLOW-01c A, B).
 *   T10 Budget runs one beat, discover, cited to the route that reads and writes nothing; step 7 and
 *      README row 07 derive five tools; the vendor note names the day card (DATAFLOW-01d, 2026-11-03).
 *   T11 the three "twenty-five of twenty-five" captions begin "The blueprint: ", each above its drawing; the
 *      BUDGET-02 note names every file that mounts VendorBox, by grep (DATAFLOW-01e, 2026-11-03).
 * Source is read through code(), comments() and rejoin() only (the reader law). No clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { code, comments, rejoin } from '../sourceText';
import { ALL_BEATS_LINE, BEAT_WORDS, EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, allBeatsLine, ownTableLaw, ownTableLine, registryLaw, statusCounts, type ToolEntry } from '../toolRegistry';
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
  s08: "Today each tool that has a table keeps its own; one table holding every document is the shape we're building.",
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
  // DATAFLOW-01d (Alex, 2026-11-03): Budget's beats are discover alone — it left the four-beat tools; six became five.
  // CRM-01b (Alex, 2026-11-07): CRM runs all four — a stage and a next step on the row, a contact by hand — and stays PARTIAL; five became six.
  assert.deepEqual(four, ['Tasks', 'Time', 'CRM', 'Expenses', 'Travel', 'Bookkeeping']);
  assert.equal(ALL_BEATS_LINE, allBeatsLine());
  assert.equal(ALL_BEATS_LINE, `Today ${four.length} tools run all four beats — ${BEAT_WORDS.join(', ')}: ${four.join(', ')}.`);
  assert.equal(ALL_BEATS_LINE, 'Today 6 tools run all four beats — discover, decide, commit, record: Tasks, Time, CRM, Expenses, Travel, Bookkeeping.'); // CRM-01b (2026-11-07); DATAFLOW-01d's five until then
  const ALL = { discover: true, decide: true, commit: true, record: true };
  const fixture = TOOL_REGISTRY.map((t) => (t.name === 'Calendar' ? { ...t, beats: ALL } : t));
  assert.equal(allBeatsLine(fixture), 'Today 7 tools run all four beats — discover, decide, commit, record: Calendar, Tasks, Time, CRM, Expenses, Travel, Bookkeeping.', 'the derivation is real'); // CRM-01b: 6 → 7, CRM in; DATAFLOW-01d: 7 → 6, Budget out
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

test('T4 the fixed lines\' text, verbatim, rendered where they were; the old words gone; step 9 tags both live matches; steps 6 and 8 from the registry\'s ownTable (DATAFLOW-01c B, C)', async () => {
  const { DECK_TODAY } = await deck();
  assert.deepEqual({ ...DECK_TODAY }, { ...WANT });
  assert.deepEqual(deckTodayLines.map((e) => e.key), Object.keys(WANT), 'one source line per entry, in this order');
  const renders: Array<[string, string]> = [
    ['B.10 intro', '{DECK_TODAY.intro}'],
    ['step 2', '<p className={`mt-10 ${DECK.statement}`}>{DECK_TODAY.s02}</p>'],
    ['A step 3', '{DECK_TODAY.s03} We will show you a small example'],
    ['B.8 step 4', 'It is not a guess buried in code. {DECK_TODAY.s04} And the line is who did the math'],
    ['A step 5', 'We did not guess this. {DECK_TODAY.s05} The data agreed!'],
    ['01c B step 6', '<p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>{SIXTEEN_LINE}</p>'],
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
    'The sixteen are yours', 'the one gap left', 'so a new one is added, never built', 'Today each tool keeps its own table',
  ]) assert.ok(!landingCode.includes(stale), `gone: ${stale}`);
  // RULING D (01b): step 9 tags both live matches — Travel (the card charge to its booking) and the tool whose registry
  // entry cites the route that writes planned_item_links. The line is FOUND, never typed: #1890 moved it once already.
  const registryText = rejoin(code(REGISTRY), comments(REGISTRY)).split('\n');
  const citing = registryText.flatMap((l, i) => (l.includes('→ POST /api/calendar/links') ? [i + 1] : []));
  assert.equal(citing.length, 1, 'one registry citation sends a beat to the link route');
  assert.match(registryText[citing[0] - 1], /record: BillPaySection\.tsx:78 \("link payment"[^)]*\) → :86 the existing ledger\/LinkPicker\.tsx → POST \/api\/calendar\/links/);
  assert.equal(registryText.slice(0, citing[0] - 1).reverse().find((l) => /^ {2}['\w& ]+: \{$/.test(l)), "  'Bill Pay': {", 'that line is Bill Pay\'s entry');
  assert.ok(noteLines.some((l) => l.includes(`src/lib/toolRegistry.ts:${citing[0]} (record)`)), `the deck's step-9 citation names toolRegistry.ts:${citing[0]}, where that line is`);
  assert.match(code('src/app/api/calendar/links/route.ts'), /prisma\.planned_item_links\.create\(/, 'that route is the writer');
  assert.equal((landingCode.match(/ {4}live: tool === 'Travel' \|\| tool === 'Bill Pay',/g) ?? []).length, 1, 'step 9 tags Travel and Bill Pay');
  assert.match(landingCode, /tag: live \? '· LIVE TODAY' : null/, 'step 13\'s lanes read the same flag');
  // DATAFLOW-01c B and C: step 6 is the registry's own count over the deck's sixteen; step 8 says "each tool that has a table".
  const movers = /const S2_MOVERS = new Set<string>\(\[([\s\S]*?)\]\);/.exec(landingCode);
  assert.ok(movers, 'Landing.tsx declares S2_MOVERS');
  const nine = [...movers[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const sixteen = TOOL_REGISTRY.filter((t) => !nine.includes(t.name)).map((t) => t.name);
  assert.equal(sixteen.length, 16);
  assert.match(landingCode, /const SIXTEEN_LINE = ownTableLine\(S6_STAYHOME\);/);
  // CRM-01b (Alex, 2026-11-07): CRM keeps crm_contacts, written by its own route — five of the sixteen, in registry order.
  assert.equal(ownTableLine(sixteen), 'Today 5 of the sixteen keep their own table: Tasks, Time, CRM, Bookkeeping, Tax. The other 11 don\'t yet. One table for all of them is the blueprint.');
  assert.ok(DECK_TODAY.s08.startsWith('Today each tool that has a table keeps its own;'));
  assert.ok(!('s06' in DECK_TODAY), 'step 6 is derived, not typed');
});

// ── T5 · EVERY TYPED TODAY-LINE CARRIES ITS FILE:LINE, AND THE LINE HOLDS IT ─

test('T5 every typed today-line carries `// true per ` with file:lines that exist and still hold what each names — and no raw today-line is left in the deck\'s JSX', () => {
  // DATAFLOW-01c: each citation's anchor is read up to the NEXT citation — #1891's parser ran to the next "·" and so
  // swallowed a citation set off by "—", which is how toolRegistry.ts:316 went stale unnoticed.
  const CITE = /((?:src|prisma|scripts)\/[\w./[\]-]+?\.(?:tsx|ts|prisma)|README\.md)?:(\d+)(?:-(\d+))?/g;
  const providerLine = codeLines.findIndex((l) => l.startsWith('export const NEW_PROVIDER_IS ='));
  const liveAt = codeLines.findIndex((l) => l.trim().startsWith("live: tool === 'Travel' || tool === 'Bill Pay',"));
  const sevenAt = noteLines.findIndex((l) => /true per scripts\/assert-tool-registry\.ts:\d+ \(s14Law\)/.test(l));
  assert.ok(providerLine > -1 && liveAt > -1 && sevenAt > -1, 'the constant, the step-9 tag and the step-14 note are found');
  const cited = [...deckTodayLines.map((e) => ({ key: e.key, index: e.index })), { key: 'NEW_PROVIDER_IS', index: providerLine }, { key: 'S9 live', index: liveAt }, { key: 'S14 note', index: sevenAt }];
  const files = new Map<string, string[]>();
  let checked = 0;
  let anchored = 0;
  for (const { key, index } of cited) {
    const note = noteLines[index];
    assert.match(note, /true per /, `${key} carries its "true per" on the same line`);
    let file: string | undefined;
    const found = [...note.matchAll(CITE)];
    for (const [k, m] of found.entries()) {
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
      const tail = note.slice((m.index ?? 0) + m[0].length, k + 1 < found.length ? found[k + 1].index : note.length).split('·')[0];
      const anchor = (tail.trim().split(/\s+/)[0] ?? '').replace(/^[("'<]+/, '').replace(/[)"'>,;:/]+$/, '');
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
  // DATAFLOW-01c F: the five gap cells say only what is still missing — the numbers computed here, never typed.
  const gapOf = (step: string) => readme.find((l) => l.startsWith(`| ${step} | `) && l.split(' | ').length === 4)!.split(' | ')[3].replace(/ \|$/, '');
  const four = TOOL_REGISTRY.filter((t) => BEAT_WORDS.every((b) => t.beats[b])).length;
  const gaps: Array<[string, string]> = [
    ['07', `${TOOL_REGISTRY.length - four} of the ${TOOL_REGISTRY.length} tools do not run all four beats yet.`],
    ['10', "the rules that write the posting lines — the bookkeeping pipe we're building."],
    ['12', 'one set of rows under both windows; the posting pipe will land more.'],
    ['13', "the other matches are not live yet; the sale's lines and lenses wait on steps 10–11."],
    ['14', 'the other providers still land parsed; the citation re-check compares against a hash stored empty today.'],
  ];
  for (const [step, gap] of gaps) assert.equal(gapOf(step), gap, `README gap ledger row ${step}: what is still missing`);
  assert.equal(gapOf('08'), 'no master table; each tool that has a table keeps its own.', 'row 08 follows step 8 (DATAFLOW-01c C)');
  assert.equal(gapOf('07'), '19 of the 25 tools do not run all four beats yet.'); // CRM-01b (2026-11-07): CRM joined the four-beat tools — 20 → 19; DATAFLOW-01d: 19 → 20
  const retiredDay = (word: string) => RETIRED_PROVIDERS.find(([w]) => w === word)?.[1];
  for (const [job, today, next] of PROVIDER_MENU) {
    const cell = today.split(' · ').map((w) => (retiredDay(w) ? `${w} (retired ${retiredDay(w)})` : w)).join(' · ');
    assert.ok(readme.includes(`| ${job} | ${cell} | ${next} |`), `README's menu row ${job} marks the retired`);
  }
  assert.ok(readme.includes('| our AI | anthropic · openai · xai grok (retired 2026-09-10) · voyage | — |'));
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
  assert.ok(landingCode.includes('The system does not care; a provider is {NEW_PROVIDER_IS}: the pipe gains no new tables and no new logic.'), 'step 2 reads the constant and ends on step 4\'s point (DATAFLOW-01c E)');
  assert.match(landingCode, /s04: `When a new provider shows up, it is \$\{NEW_PROVIDER_IS\}; no new logic, no new tables\.`,/, 'step 4 reads the constant');
  assert.ok(landingCode.includes('{isRetired(ROUTING_RULES[i][0]) && <span className="whitespace-nowrap pl-1 text-text-faint" data-s4-retired>retired</span>}'), 'the label is drawn from RETIRED_PROVIDERS, beside the empty slot');
  assert.match(landingCode, /\{feed === null \? \(\s*<>\s*<span className="text-text-faint">—<\/span>\s*\{isRetired\(ROUTING_RULES\[i\]\[0\]\)/, 'only an empty feed slot can carry it');
  assert.deepEqual(ROUTING_RULES.filter(([p]) => isRetired(p)).map(([p, r]) => `${p} · ${r}`), ['xai grok · sentiment'], 'exactly one rule-book row is retired today');
  // DATAFLOW-01c G: the phone's rule book shows xAI's row, so the phone's feeds card shows its empty slot and label too.
  assert.ok(landingCode.includes('{isRetired(ROUTING_RULES[i][0]) && <span className="text-text-faint" data-s4-retired> retired</span>}'), 'the phone draws the label');
  assert.equal((landingCode.match(/data-s4-retired/g) ?? []).length, 2, 'one label per breakpoint');
  assert.ok(!landingCode.includes('S4_LISTED'), 'the phone lists every slot, as the desktop does');
});

// ── T9 · A TABLE OF ITS OWN ──────────────────────────────────────────────────

test('T9 the own-table law refuses by name, a fixture for each — and step 6\'s line moves with the registry (DATAFLOW-01c A, B)', () => {
  const schema = code(SCHEMA);
  const codeOf = (file: string) => (existsSync(resolve(process.cwd(), file)) ? code(file) : null);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.deepEqual(ownTableLaw({ schema, codeOf }), [], 'the live registry passes');
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  const crm = TOOL_REGISTRY.find((t) => t.name === 'CRM')!;
  const swap = (name: string, patch: Partial<ToolEntry>): ToolEntry[] => TOOL_REGISTRY.map((t) => (t.name === name ? { ...t, ...patch } : t));
  const refuses = (violations: string[], words: string) => assert.ok(violations.some((v) => v.includes(words)), `expected "${words}", got [${violations.join(' | ')}]`);
  refuses(ownTableLaw({ schema, codeOf }, swap('Tasks', { ownTable: 'operations_task_rows' })), 'Tasks: ownTable operations_task_rows is not a model in prisma/schema.prisma');
  refuses(ownTableLaw({ schema, codeOf }, swap('Tasks', { ownTableRoute: 'src/app/api/operations/stops/route.ts:177 (wrong route)' })), "Tasks: src/app/api/operations/stops/route.ts does not name operations_project_tasks's client accessor");
  refuses(ownTableLaw({ schema, codeOf }, swap('Tasks', { ownTableRoute: 'src/lib/posting/postJournal.ts:121 (a lib)' })), 'is not a route file:line under src/app/api');
  refuses(ownTableLaw({ schema, codeOf }, swap('Tasks', { ownTableRoute: 'src/app/api/operations/nope/route.ts:1 (gone)' })), 'Tasks: src/app/api/operations/nope/route.ts does not exist');
  // CRM-01a (Alex, 2026-11-07): CRM is PARTIAL now, so the NOT_BUILT probe is Contracts — still NOT_BUILT, ownTable null.
  refuses(registryLaw({ throwOnFail: false, registry: swap('Contracts', { ownTable: 'operations_project_tasks', ownTableRoute: tasks.ownTableRoute }) }), 'Contracts: NOT_BUILT keeps no table — ownTable "operations_project_tasks" refused');
  refuses(registryLaw({ throwOnFail: false, registry: swap('Tasks', { ownTableRoute: undefined }) }), 'Tasks: ownTable "operations_project_tasks" cites no route that writes it');
  // CRM-01b (2026-11-07): CRM has an ownTable now — the probe runs through Contracts, whose ownTable is null.
  refuses(registryLaw({ throwOnFail: false, registry: swap('Contracts', { ownTableRoute: tasks.ownTableRoute }) }), 'Contracts: ownTableRoute without an ownTable');
  refuses(registryLaw({ throwOnFail: false, registry: swap('Tasks', { ownTable: 'Tasks Table' }) }), 'is not a prisma model name');
  assert.equal(crm.ownTable, 'crm_contacts'); // CRM-01b (2026-11-07): written by src/app/api/crm/contacts/route.ts
  // the derivation is real: one more of the sixteen with a table moves k and the names
  const movers = new Set(['Payments', 'Expenses', 'Travel', 'Banking', 'Retirement', 'Brokerage', 'Trade Log', 'Debt', 'Compliance']);
  const sixteen = TOOL_REGISTRY.filter((t) => !movers.has(t.name)).map((t) => t.name);
  const withBudget = swap('Budget', { ownTable: 'budgets', ownTableRoute: 'src/app/api/budgets/route.ts:43 (budgets.upsert)' });
  assert.equal(ownTableLine(sixteen, withBudget), 'Today 6 of the sixteen keep their own table: Tasks, Time, CRM, Budget, Bookkeeping, Tax. The other 10 don\'t yet. One table for all of them is the blueprint.'); // CRM-01b: CRM before Budget, in registry order
  assert.notEqual(ownTableLine(sixteen, withBudget), ownTableLine(sixteen));
  assert.throws(() => ownTableLine(sixteen, swap('Tax', { ownTable: undefined })), /Tax — a stay-home tool's entry says ownTable, a model or null/, 'an unsaid ownTable is a loud failure');
  // D is report-only: Budget's status is untouched. DATAFLOW-01d (Alex, 2026-11-03): its beats
  // moved by their own ruling — ALL → discover alone (T10); this PR left them as they were.
  const budget = TOOL_REGISTRY.find((t) => t.name === 'Budget')!;
  assert.equal(budget.status, 'PARTIAL');
  assert.deepEqual(budget.beats, { discover: true, decide: false, commit: false, record: false });
  assert.equal(budget.ownTable, null);
  assert.match(code(LAW), /violations\.push\(\.\.\.ownTableLaw\(\{ schema: schemaText, codeOf: /, 'the build runs the file half');
});

// ── T10 · BUDGET'S BEATS ARE WHAT ITS PAGE DOES (DATAFLOW-01d) ───────────────

test('T10 Budget runs one beat, discover — cited to the report route, which reads Books\', Tasks\' and the vendors\' tables and writes none; step 7 and README row 07 derive five tools; the vendor note names the day card (DATAFLOW-01d)', () => {
  const budget = TOOL_REGISTRY.find((t) => t.name === 'Budget')!;
  // A: discover and nothing else, in the registry's own some() form.
  assert.deepEqual(budget.beats, { discover: true, decide: false, commit: false, record: false });
  assert.deepEqual(BEAT_WORDS.filter((b) => budget.beats[b]), ['discover']);
  assert.ok(code(REGISTRY).includes("slug: 'budget', status: 'PARTIAL', beats: some({ discover: true }), home: '/budget',"), 'the some() form on its slug line');
  // status, why, home and links stand; the census does not move.
  assert.equal(budget.status, 'PARTIAL');
  assert.equal(budget.why, 'plan vs actual for routines and tasks on /budget; travel and income budgets not connected yet');
  assert.equal(budget.home, '/budget');
  assert.deepEqual(budget.links, []);
  // CRM-01a census (Alex, 2026-11-07): 5 · 8 · 12 → 5 · 9 · 11 — CRM NOT_BUILT → PARTIAL; Budget's row did not move.
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  // The citation holds: what the route reads, through which lines, and that neither budget route writes.
  const note = comments(REGISTRY).replace(/\s*\n\s*\/\/\s*/g, ' ');
  assert.match(note, /DATAFLOW-01d \(Alex, 2026-11-03\): the beats are what the page does — one, discover\. \/budget reads Books', Tasks' and the vendors' tables \(src\/app\/api\/budget\/report\/route\.ts:90-103:/);
  const reads = code('src/app/api/budget/report/route.ts').split('\n').slice(89, 103).join('\n');
  // HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the bank rows left the route for the one loader (reportReads.ts readBankNotInBooks) — the route's :90-103 block calls it; the note's "transactions" is read there.
  for (const read of ['readBudgetChart(', 'loadRoutineBudgetInputs(', 'readCostedTasks(', 'readActuals(', 'readBankNotInBooks(', 'readPlanVendors(']) assert.ok(reads.includes(read), `route.ts:90-103 reads through ${read}`);
  assert.match(code('src/lib/budget/reportReads.ts'), /export function readBankNotInBooks\(db: Db, userId: string, from: string, through: string\) \{\n  return db\.transactions\.findMany\(\{/, 'the loader reads transactions');
  const loader = code('src/lib/budget/reportReads.ts').split('\n');
  for (const [line, table] of [[50, 'ledger_entries'], [78, 'chart_of_accounts'], [86, 'operations_project_tasks'], [100, 'planned_item_vendors']] as const) {
    assert.match(loader[line - 1], new RegExp(`db\\.${table}\\.findMany\\(`), `reportReads.ts:${line} reads ${table}`);
  }
  assert.match(code('src/lib/operations/routineBudgetInputs.ts').split('\n')[100], /db\.operations_routines\.findMany\(/, 'routineBudgetInputs.ts:101 reads operations_routines');
  for (const [file, line] of [['src/app/api/budget/report/route.ts', 61], ['src/app/api/budget/report/cell/route.ts', 46]] as const) {
    const src = code(file);
    assert.match(src.split('\n')[line - 1], /^export async function GET\(/, `${file}:${line} is its GET`);
    assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)\b/, `${file} exports no write`);
  }
  assert.doesNotMatch(code('src/components/budget/BudgetReport.tsx'), /VendorBox|method:/, "/budget's report mounts no vendor box and sends no write");
  // B: step 7 and README row 07 derive five tools, Budget not among them.
  assert.equal(ALL_BEATS_LINE, 'Today 6 tools run all four beats — discover, decide, commit, record: Tasks, Time, CRM, Expenses, Travel, Bookkeeping.'); // CRM-01b (2026-11-07)
  assert.doesNotMatch(ALL_BEATS_LINE, /Budget/);
  const row07 = rejoin(code(README), comments(README)).split('\n').find((l) => l.startsWith('| 07 | ') && l.split(' | ').length === 4)!.split(' | ');
  assert.equal(row07[2], "This loop is the blueprint — the shape we're building every tool toward. Today 6 tools run all four beats — discover, decide, commit, record: Tasks, Time, CRM, Expenses, Travel, Bookkeeping. Hotel and flight bookings commit for real, and an accepted task fires its build — for the repo owner today; the route refuses anyone else."); // CRM-01b (2026-11-07): six
  assert.equal(row07[3].replace(/ \|$/, ''), '19 of the 25 tools do not run all four beats yet.'); // CRM-01b (2026-11-07)
  // A: the stale note is corrected to where the vendor box mounts — the day card — and that citation holds.
  assert.doesNotMatch(comments(REGISTRY), /the drill writes a vendor/);
  assert.match(note, /the vendor box writes a vendor, never a figure — DATAFLOW-01d \(2026-11-03\): that box mounts on the day card, src\/components\/workbench\/operations\/day\/DayCard\.tsx:1228, not on \/budget's GET-only drill\)\./);
  assert.match(code('src/components/workbench/operations/day/DayCard.tsx').split('\n')[1227], /<StopVendor /, 'DayCard.tsx:1228 mounts the stop vendor');
  assert.match(code('src/components/workbench/operations/stops/StopVendor.tsx'), /<VendorBox line=\{line\}/, 'which draws the budget vendor box');
});

// ── T11 · THE THREE BLUEPRINT CAPTIONS; THE VENDOR BOX'S ONE MOUNT (DATAFLOW-01e) ──

test('T11 the three "twenty-five of twenty-five" captions under steps 7, 8 and 13 begin "The blueprint: " and are otherwise unchanged, each above the drawing it captions; the BUDGET-02 note names every file that mounts VendorBox (DATAFLOW-01e)', () => {
  // A: each caption's whole line — its class and its words as they stood, with "The blueprint: " in front.
  const CAPTIONS: Array<[string, string, string, string]> = [
    ['deck-07', 'THE LOOP, desktop', '<p className="mt-10 lg:mt-[76px] text-[12px] lg:text-[14px] text-text-faint">', 'twenty-five of twenty-five — every tool runs these same four beats.'],
    ['deck-08', 'THE MASTER TABLE, desktop', '<p className="mt-10 lg:mt-[76px] text-[12px] lg:text-[14px] text-text-faint">', 'twenty-five of twenty-five — every loop&apos;s record lands here.'],
    ['deck-13', 'THE THREADS, desktop', '<p className="mt-[6px] font-mono text-[10px] lg:text-[11px] text-text-faint">', 'twenty-five of twenty-five — every lane reaches YOU LOOK; eleven write no lines.'],
  ];
  assert.equal((landingCode.match(/twenty-five of twenty-five/g) ?? []).length, 3, 'three captions, no fourth');
  assert.equal((landingCode.match(/The blueprint: twenty-five of twenty-five/g) ?? []).length, 3, 'each one says it is the blueprint');
  for (const [section, drawing, open, words] of CAPTIONS) {
    const at = codeLines.findIndex((l) => l.trim() === `${open}The blueprint: ${words}</p>`);
    assert.ok(at > -1, `${section}: the caption reads "The blueprint: ${words}"`);
    const start = codeLines.findIndex((l) => l.includes(`<section id="${section}"`));
    const end = codeLines.findIndex((l, i) => i > start && l.trim() === '</section>');
    assert.ok(start > -1 && start < at && at < end, `${section}: the caption sits in its own step`);
    const drawn = noteLines.findIndex((l, i) => i > at && l.includes(drawing));
    assert.ok(drawn > at && drawn < end, `${section}: the caption sits above ${drawing}, the drawing it captions`);
  }
  // B: the note names every file that mounts VendorBox, as a grep of the code finds them; "mounted by Tasks" is gone.
  const walk = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const mounts = walk('src').flatMap((f) => code(f).split('\n').flatMap((l, i) => (/<VendorBox\b/.test(l) ? [`${f}:${i + 1}`] : [])));
  assert.deepEqual(mounts, ['src/components/workbench/operations/stops/StopVendor.tsx:32'], 'one file mounts the vendor box');
  const note = comments(REGISTRY).replace(/\s*\n\s*\/\/\s*/g, ' ');
  for (const m of mounts) assert.ok(note.includes(`every file that mounts it, by grep — ${m}, the only one.`), `the BUDGET-02 note names ${m}`);
  assert.match(note, /BUDGET-02 \(2026-10-20\): re-cited — one page: .* The day plan, its vendor box and the notice left \/budget; the box stays \(VendorBox\.tsx\)\. DATAFLOW-01e \(2026-11-03\): every file that mounts it/);
  assert.doesNotMatch(comments(REGISTRY), /mounted by Tasks/, 'the note no longer says "mounted by Tasks"');
});
