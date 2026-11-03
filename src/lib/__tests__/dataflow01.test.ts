/**
 * DATAFLOW-01 (Alex, 2026-11-02) — THE PIPELINE DECK TELLS THE TRUTH ABOUT TODAY.
 * Every "Today…" line in the fourteen steps is DERIVED from a leaf at render or TYPED
 * with the file:line that makes it true on the same line (Landing.tsx DECK_TODAY).
 *
 *   T1 no Grok, no xAI in any today-line, the menu as spoken today or step 3's example —
 *      while the rule book's xAI rows and the enum stay (a migration, not this PR);
 *   T2 step 7's line is the registry's, and a registry with one more four-beat tool moves it;
 *   T3 the counts line is the rule book's — feeds and providers recomputed here, retired excluded;
 *   T4 the fixed lines' new text, verbatim; the old words gone; B.2 stopped, not built;
 *   T5 every typed today-line carries `// true per ` with a file:line that exists — a text
 *      pin over the deck's lines — and no raw today-line is left in the deck's JSX;
 *   T6 ruling D's second path: the S14 law re-run by name at the build's providers-law seat.
 * Source is read through code() and comments() only (the reader law). No clock, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { code, comments } from '../sourceText';
import { ALL_BEATS_LINE, TOOL_REGISTRY, allBeatsLine } from '../toolRegistry';
import {
  LIVE_PROVIDERS, PROVIDERS, PROVIDER_MENU, RETIRED_PROVIDERS, ROUTING_RULES, RULE_BOOK, RULE_BOOK_COUNTS_LINE,
  isRetired, liveMenuCell, providersLaw, ruleBookCounts, ruleBookCountsLine, type Rule,
} from '../providers';
import { KIND_VIEWS_HONEST_LINE } from '../kindViews';

Object.assign(globalThis, { React });

const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SCHEMA = 'prisma/schema.prisma';
const GROK = /grok|xai/i;

const landingCode = code(LANDING);
const codeLines = landingCode.split('\n');
const noteLines = comments(LANDING).split('\n');

/** DECK_TODAY, read from the source: one entry per line, its text and the line it sits on. */
const deckToday = (() => {
  const start = codeLines.findIndex((l) => l.startsWith('const DECK_TODAY = {'));
  const end = codeLines.findIndex((l, i) => i > start && l.startsWith('} as const;'));
  assert.ok(start > -1 && end > start, 'Landing.tsx declares DECK_TODAY');
  return codeLines.slice(start + 1, end).map((line, k) => {
    const m = /^ {2}(\w+): (['"])(.*)\2,\s*$/.exec(line);
    assert.ok(m, `DECK_TODAY line ${start + 2 + k} is one entry on one line: ${line.trim()}`);
    return { key: m[1], text: m[3], index: start + 1 + k };
  });
})();
const today = (key: string) => {
  const entry = deckToday.find((e) => e.key === key);
  assert.ok(entry, `DECK_TODAY.${key} exists`);
  return entry.text;
};

/** The deck's JSX: THE PIPELINE header through the end of deck-14. */
const deckJsx = (() => {
  const from = codeLines.findIndex((l) => l.includes('<section aria-label="The pipeline"'));
  const at14 = codeLines.findIndex((l) => l.includes('id="deck-14"'));
  const to = codeLines.findIndex((l, i) => i > at14 && l.trim() === '</section>');
  assert.ok(from > -1 && at14 > from && to > at14, 'the deck runs from THE PIPELINE header through deck-14');
  return { from, to, lines: codeLines.slice(from, to + 1) };
})();

const WANT = {
  intro: 'One data pipe is the plan for the whole system. Each step below says what runs today.',
  s02: 'Here is who we speak to today:',
  s04: 'When a new provider shows up, it is one row in the rule book — a code file, checked at build — and one enum value; no new logic, no new tables.',
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

test('T1 no Grok or xAI in any today-line, the menu as spoken today, or step 3\'s example; the rule book\'s xAI rows and the enum stay', () => {
  for (const e of deckToday) assert.doesNotMatch(e.text, GROK, `DECK_TODAY.${e.key}`);
  for (const line of [ALL_BEATS_LINE, RULE_BOOK_COUNTS_LINE, KIND_VIEWS_HONEST_LINE]) assert.doesNotMatch(line, GROK);
  for (const [job, cell] of PROVIDER_MENU) assert.doesNotMatch(liveMenuCell(cell), GROK, `the menu's ${job} row as spoken today`);
  assert.equal(liveMenuCell('anthropic · openai · xai grok · voyage'), 'anthropic · openai · voyage', 'step 2: our AI, today');
  assert.deepEqual(LIVE_PROVIDERS.map((p) => p.deck), ['plaid', 'stripe', 'tastytrade', 'finnhub', 'fred', 'sec', 'liteapi', 'viator', 'google places', 'travel buddy', 'anthropic', 'openai', 'voyage', 'ecfr', 'us code', 'federal register', 'irs']);
  // step 3's example: the arrivals table and the list it is drawn from
  const arrivals = /const IMPORT_ARRIVALS = \[([\s\S]*?)\] as const;/.exec(landingCode);
  assert.ok(arrivals, 'Landing.tsx declares IMPORT_ARRIVALS');
  assert.doesNotMatch(arrivals[1], GROK, 'no xAI row in step 3\'s example');
  assert.match(arrivals[1], /\['openai', '—', 'insight', 'chatcmpl-9xR7', 'arr_0014', /, 'arr_0014 is openai\'s second insight answer');
  assert.equal((arrivals[1].match(/\['/g) ?? []).length, 19, 'nineteen rows, as step 3 says');
  assert.match(landingCode, /const S3_PROVIDERS = \[\.\.\.new Set\(PROVIDER_MENU\.flatMap\(\(\[, today\]\) => liveMenuCell\(today\)\.split\(' · '\)\)\)\];/);
  assert.equal((landingCode.match(/>\{liveMenuCell\(today\)\}<\/td>/g) ?? []).length, 2, 'both menu tables speak the TODAY cell as of today');
  assert.doesNotMatch(landingCode, />\{today\}<\/td>/);
  for (const line of deckJsx.lines) assert.doesNotMatch(line, GROK, `nothing in the deck's JSX types Grok or xAI: ${line.trim().slice(0, 80)}`);
  // NOT touched: the menu word, the rule row, the enum value — retiring them is a migration
  assert.deepEqual(RETIRED_PROVIDERS, [['xai grok', '2026-09-10', '8358dc28']]);
  assert.ok(isRetired('xai grok') && !isRetired('openai'));
  assert.ok(PROVIDER_MENU.some(([, cell]) => cell.includes('xai grok')), 'the menu still names xai grok — the deck filters it at render');
  assert.ok(ROUTING_RULES.some(([p, r]) => p === 'xai grok' && r === 'sentiment'), 'the rule book still holds xai grok · sentiment');
  assert.match(code(SCHEMA), /enum arrival_provider \{[^}]*\n {2}xai_grok\n\}/, 'the enum keeps xai_grok');
  assert.deepEqual(providersLaw({ throwOnFail: false }), []);
});

// ── T2 · STEP 7, FROM THE REGISTRY ───────────────────────────────────────────

test('T2 step 7\'s line is the registry\'s four-beat tools in registry order — and one more four-beat tool moves it', () => {
  const four = TOOL_REGISTRY.filter((t) => t.beats.discover && t.beats.decide && t.beats.commit && t.beats.record).map((t) => t.name);
  assert.deepEqual(four, ['Tasks', 'Time', 'Expenses', 'Travel', 'Budget', 'Bookkeeping']);
  assert.equal(ALL_BEATS_LINE, allBeatsLine());
  assert.equal(ALL_BEATS_LINE, `Today ${four.length} tools run all four beats — discover, decide, draft, commit: ${four.join(', ')}.`);
  assert.equal(ALL_BEATS_LINE, 'Today 6 tools run all four beats — discover, decide, draft, commit: Tasks, Time, Expenses, Travel, Budget, Bookkeeping.');
  const ALL = { discover: true, decide: true, commit: true, record: true };
  const fixture = TOOL_REGISTRY.map((t) => (t.name === 'Calendar' ? { ...t, beats: ALL } : t));
  assert.equal(allBeatsLine(fixture), 'Today 7 tools run all four beats — discover, decide, draft, commit: Calendar, Tasks, Time, Expenses, Travel, Budget, Bookkeeping.', 'the derivation is real');
  assert.notEqual(allBeatsLine(fixture), ALL_BEATS_LINE);
  // the deck renders the derived line, then the typed and cited commit fact — never a typed list of names
  assert.ok(landingCode.includes("This loop is the blueprint — the shape we&apos;re building every tool toward. {ALL_BEATS_LINE} {DECK_TODAY.s07}</p>"));
  assert.match(landingCode, /import \{ ALL_BEATS_LINE \} from '@\/lib\/toolRegistry';/);
  for (const stale of ['Today, hotel bookings commit for real', 'the rest run discover → decide → draft']) assert.ok(!landingCode.includes(stale), stale);
});

// ── T3 · THE COUNTS, FROM THE RULE BOOK ──────────────────────────────────────

test('T3 the counts line is the rule book\'s: feeds are the live providers\' rule rows, providers the live ones — retired excluded, no typed date', () => {
  const live = PROVIDERS.filter((p) => p.today && !RETIRED_PROVIDERS.some(([word]) => word === p.deck));
  const feeds = RULE_BOOK.filter((r) => live.some((p) => p.deck === r.provider));
  assert.deepEqual(ruleBookCounts(), { feeds: feeds.length, providers: live.length });
  assert.equal(RULE_BOOK_COUNTS_LINE, `${feeds.length} feeds from ${live.length} providers, per the rule book`);
  assert.equal(RULE_BOOK_COUNTS_LINE, '25 feeds from 17 providers, per the rule book');
  assert.equal(RULE_BOOK.length - feeds.length, 1, 'the one rule row left out is the retired provider\'s');
  assert.ok(live.every((p) => feeds.some((r) => r.provider === p.deck)), 'every counted provider sends a counted feed');
  const added: Rule = { provider: 'stripe', code: 'stripe', resource: 'refund', kind: 'event', means: '', source: 'added' };
  assert.equal(ruleBookCountsLine(ruleBookCounts([...RULE_BOOK, added])), '26 feeds from 17 providers, per the rule book', 'the derivation is real');
  assert.equal((landingCode.match(/\{RULE_BOOK_COUNTS_LINE\}/g) ?? []).length, 2, 'steps 3 and 5 render it');
  assert.ok(landingCode.includes('And here is the real size of it: today that is {RULE_BOOK_COUNTS_LINE}. We will show you'));
  assert.ok(landingCode.includes('We classified every one of the {RULE_BOOK_COUNTS_LINE} — and posting took zero.'));
  for (const stale of ['121 feeds', '20 providers', 'August 24']) assert.ok(!landingCode.includes(stale), stale);
  // step 14's database counts stay exactly as written — truthfully dated, until a recount
  assert.ok(today('s14Arrivals').includes('9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026'));
});

// ── T4 · THE FIXED LINES, VERBATIM ───────────────────────────────────────────

test('T4 the fixed lines\' new text, verbatim, rendered where they were; the old words gone', () => {
  assert.deepEqual(Object.fromEntries(deckToday.map((e) => [e.key, e.text])), WANT);
  const renders: Array<[string, string]> = [
    ['B.10 intro', '{DECK_TODAY.intro}'],
    ['step 2', '<p className={`mt-10 ${DECK.statement}`}>{DECK_TODAY.s02}</p>'],
    ['B.8 step 4', 'It is not a guess buried in code. {DECK_TODAY.s04} And the line is who did the math'],
    ['step 8', '<p className={`mt-2 ${DECK.statement}`}>The master table is the blueprint. {DECK_TODAY.s08}</p>'],
    ['B.4 step 9', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s09}</p>'],
    ['B.5 step 10', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s10}</p>'],
    ['step 11', '<p className={`mt-2 ${DECK.statement}`}>These four lenses are the blueprint. {DECK_TODAY.s11} The rules-written lines and the live quotes the blueprint reads wait on the posting pipe.</p>'],
    ['B.6 step 12', '<p className={`mt-2 ${DECK.statement}`}>Two windows over one set of rows is the blueprint. {DECK_TODAY.s12}</p>'],
    ['B.4 B.9 step 13', '<p className={`mt-[14px] ${DECK.statement}`}>{DECK_TODAY.s13}</p>'],
    ['B.7 step 14', '<p className={`mt-2 ${DECK.statement}`}>{DECK_TODAY.s14Fingerprint} {DECK_TODAY.s14Arrivals} {DECK_TODAY.s14Parsed}</p>'],
  ];
  for (const [what, jsx] of renders) assert.equal((landingCode.match(new RegExp(jsx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `${what} renders once`);
  assert.ok(today('s10').includes('zero lines by design — the ledger already has its lines'), 'B.5: "zero lines" only as "zero lines by design — the ledger already has its lines"');
  for (const key of ['s07', 's13'] as const) assert.ok(today(key).includes(' — for the repo owner today; the route refuses anyone else'), `B.9 in ${key}`);
  assert.ok(!today('s04').includes('not code'), 'B.8: "not code" left');
  for (const stale of [
    'One data pipe runs the whole system.', 'not code, and not new tables', 'today it holds zero lines.', 'the ledger window fills as the posting pipe lands its lines',
    'A piece of this is already alive today', 'Alive today: the travel match', 'fingerprinted: 9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026. The other',
  ]) assert.ok(!landingCode.includes(stale), `gone: ${stale}`);
  // B.2 was STOPPED, not built: its ruled sentence ("the sixteen each keep their own table today") is
  // false for the nine of the sixteen the registry holds NOT_BUILT. The line stands as it was, reported.
  const movers = /const S2_MOVERS = new Set<string>\(\[([\s\S]*?)\]\);/.exec(landingCode);
  assert.ok(movers, 'Landing.tsx declares S2_MOVERS');
  const nine = [...movers[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const sixteen = TOOL_REGISTRY.filter((t) => !nine.includes(t.name));
  assert.equal(sixteen.length, 16);
  assert.deepEqual(sixteen.filter((t) => t.status === 'NOT_BUILT').map((t) => t.name), ['CRM', 'Contracts', 'Invoicing', 'Payroll', 'Mileage', 'Fixed Assets', 'Sales Tax', 'Ent Filings', 'FP&A']);
  assert.ok(landingCode.includes('The sixteen are yours — and they have no table. That&apos;s the one gap left.'), 'step 6 untouched until Alex rules its words');
  assert.ok(!deckToday.some((e) => e.key === 's06'));
});

// ── T5 · EVERY TYPED TODAY-LINE CARRIES ITS FILE:LINE ────────────────────────

test('T5 every typed today-line carries `// true per ` with file:lines that exist — and no raw today-line is left in the deck\'s JSX', () => {
  const CITE = /(?:((?:src|prisma|scripts)\/[\w./[\]-]+?\.(?:tsx|ts|prisma)))?:(\d+)(?:-(\d+))?/g;
  let cited = 0;
  for (const e of deckToday) {
    const note = noteLines[e.index];
    assert.match(note, /\/\/ true per /, `DECK_TODAY.${e.key} carries its // true per on the same line`);
    let file: string | undefined;
    for (const m of note.matchAll(CITE)) {
      file = m[1] ?? file;
      if (!file) continue;
      assert.ok(existsSync(resolve(process.cwd(), file)), `${e.key}: ${file} exists`);
      const lines = code(file).split('\n').length;
      for (const n of [m[2], m[3]].filter(Boolean).map(Number)) assert.ok(n >= 1 && n <= lines, `${e.key}: ${file}:${n} is a line of the file (${lines})`);
      cited += 1;
    }
    if (e.key !== 'intro') assert.ok(note.match(CITE), `DECK_TODAY.${e.key} names a file:line`);
  }
  assert.ok(cited > 60, `${cited} file:line citations checked`);
  // step 9's drawn tag is a today claim too — cited where it is decided
  const liveAt = codeLines.findIndex((l) => l.trim() === "live: tool === 'Travel',");
  assert.ok(liveAt > -1 && /\/\/ true per /.test(noteLines[liveAt]), 'S9_LAYOUT\'s live flag is cited');
  // the sweep: in the deck's JSX, "today" survives only where it is no claim of ours
  const EXEMPT: Array<[RegExp, string]> = [
    [/So today, to see your full picture/, 'step 1 — the reader\'s world before this system, not a claim about it'],
    [/\['THE JOB', 'TODAY', 'NEXT'\]/, 'the menu table\'s column header'],
    [/\['TODAY', 'w-\[30%\]'\]/, 'the menu table\'s column header'],
    [/PROVIDER_MENU\.map\(\(\[job, today, next\], r\) =>/, 'the menu row\'s field name'],
    [/>\{liveMenuCell\(today\)\}</, 'the TODAY cell, derived'],
    [/the providers in the TODAY column/, 'step 3 names the column'],
    [/today that is \{RULE_BOOK_COUNTS_LINE\}\./, 'step 3 — the count is derived from the rule book (ruling C)'],
    [/\{r\.live && <span [^>]*>live today<\/span>\}/, 'step 9\'s tag, cited at S9_LAYOUT'],
  ];
  const raw = deckJsx.lines.filter((l) => /\b(?:today|Today|TODAY)\b/.test(l) && !EXEMPT.some(([re]) => re.test(l)));
  assert.deepEqual(raw.map((l) => l.trim().slice(0, 120)), [], 'every today-line in the deck is DECK_TODAY or a derived const');
});

// ── T6 · RULING D, THE SECOND PATH ───────────────────────────────────────────

test('T6 the S14 law re-runs at the build\'s providers-law seat; the deck\'s line stands unchanged', async () => {
  const law = code(LAW);
  assert.match(law, /import \{ s14Law \} from '\.\.\/src\/components\/landing\/Landing';/);
  assert.match(law, /lawGuard\('The proof law', \(\) => \{[\s\S]*?violations\.push\(\.\.\.s14Law\(\{ throwOnFail: false \}\)\);[\s\S]*?\}\);/);
  assert.match(landingCode, /export function s14Law\(opts: \{ throwOnFail\?: boolean \} = \{\}\): string\[\] \{/);
  assert.match(landingCode, /const S14_LAYOUT = s14Layout\(\);/);
  assert.ok(landingCode.includes('seven of seven hops checked at build — a failed check is a failed build.</p>'), 'the line did not change; the build did');
  const { s14Law } = await import('@/components/landing/Landing');
  assert.deepEqual(s14Law({ throwOnFail: false }), []);
  assert.deepEqual(s14Law(), []);
});
