/**
 * TASKS-ONE-01 (2026-10-14) — Alex's ruling: the day card is the first section
 * of Tasks — one Tasks page, no sub-tabs.
 *
 *   · /tasks mounts DayCard first, above the week, in the Suspense boundary a
 *     client page that reads the URL needs; the week, Projects, Routines and
 *     the Daily plan stay below it, unchanged.
 *   · The card's URLs are /tasks?date=&step= (dayCard.ts DAY_CARD_PATH).
 *   · /tasks/day is one server hop to /tasks keeping date and step exactly as
 *     given (dayCard.ts dayCardRedirectHref, driven below).
 *
 * TIME-01 (Alex, 2026-10-19): the card is the first section of /time now, with
 * the ledger; DAY_CARD_PATH is '/time' and every pin below that named /tasks as
 * the card's page moved with it (time01.test.ts holds the new split). The
 * card's rules — the boundary, hrefFor, the hop keeping date and step — are
 * unchanged.
 *   · The Issue log's page and PlaceholderCard are deleted, its link and its
 *     orphan exception gone; the Tasks row links North Star and Audit trail only.
 *
 * Source is read through code() and comments() only (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { code, comments } from '../sourceText';
import { navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { DAY_CARD_PARAMS, DAY_CARD_PATH, dayCardRedirectHref } from '@/components/workbench/operations/day/dayCard';

const PAGE = 'src/app/tasks/page.tsx';
// TIME-01 (2026-10-19): the card's page.
const TIME_PAGE = 'src/app/time/page.tsx';
const DAY_PAGE = 'src/app/tasks/day/page.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const ISSUES_PAGE = 'src/app/operations/issues/page.tsx';
const PLACEHOLDER = 'src/components/workbench/operations/PlaceholderCard.tsx';

// ── T1 · /tasks MOUNTS THE DAY CARD FIRST ───────────────────────────────────

// TASKS-ONE-02 (2026-10-14): the title said "above the week, the lists and the daily plan" — the week and the daily
// plan are deleted (Alex's ruling: the day card replaces the week grid, the Daily plan and the Today strip). Moved.
test('T1 the card\'s page mounts DayCard first — in its Suspense boundary (TIME-01: /time, above the ledger and the pipeline)', () => {
  // TIME-01 (Alex, 2026-10-19): the page is /time; the boundary and the order are the same rule.
  const page = code(TIME_PAGE);
  assert.match(page, /^'use client';/, 'a client page — which is why the card needs its boundary');
  assert.match(page, /import \{ Suspense \} from 'react';/);
  assert.match(page, /import DayCard from '@\/components\/workbench\/operations\/day\/DayCard';/);
  assert.equal((page.match(/<DayCard \/>/g) ?? []).length, 1, 'mounted once');
  // TASKS-ONE-02 (2026-10-14): <WeekSection /> and <SectionC_DailyPlan /> came off — the container holds exactly three.
  // LEDGER-01 (Alex, 2026-10-16): <LedgerSection /> joins, LAST — the container holds exactly four; the card is still first.
  // TIME-01 (2026-10-19): the Time container holds exactly three — the card, the ledger, the pipeline (until TIME-02).
  // TIME-02 (2026-10-19): the pipeline is retired — the container holds exactly two: the card, then the ledger.
  // JOURNAL-07 (Alex, 2026-10-24): the two journal tables mount under the ledger — the /time container is four (TIME_MOUNTS), the ledger still the section after the card.
  assert.match(page, /<div className="space-y-3" data-tool-page="Time">\n\s*<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>/);
  assert.ok(page.indexOf('<ToolOpener') < page.indexOf('<DayCard />'), 'the opener first — family, name, registry line — then the card');
  assert.match(comments(PAGE), /TASKS-ONE-01 \(2026-10-14\) — Alex's ruling: the day card is the first section\s*\n\s*\* of Tasks — one Tasks page, no sub-tabs\./, 'the Tasks page keeps the ruling\'s history');
  // BACKLOG-02 (Alex, 2026-10-20): a boundary is back on /tasks — around the projects list ALONE, which reads ?project= and ?new=project (useSearchParams); the day card stays /time's — the guard moved to the card itself, as exact.
  assert.doesNotMatch(code(PAGE), /DayCard/, 'and mounts the card no more (TIME-01)');
  assert.match(code(PAGE), /<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>/, 'the one boundary holds the projects list alone (BACKLOG-02)');
});

test('T1 the two-lists law mounts the day card first, with the dated ruling', () => {
  const law = code(LAW);
  // TASKS-ONE-02 (2026-10-14): the mount list is three — the day card, projects, routines (tasksOne02.test.ts pins the
  // ruling that says so); the order message moved with it.
  // LEDGER-01 (Alex, 2026-10-16): the mount list is four — the city ledger last (ledger01.test.ts pins the ruling).
  // TIME-01 (Alex, 2026-10-19): the day card is first on /time — TIME_MOUNTS; /tasks is the two lists (time01.test.ts).
  // TIME-02 (2026-10-19): TIME_MOUNTS is the two — the content pipeline is retired (time02.test.ts).
  assert.match(law, /const TIME_MOUNTS = \['<DayCard \/>', '<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  // JOURNAL-07 (Alex, 2026-10-24): the order message names the two journal tables after the ledger.
  assert.match(law, /mounts its sections out of order — the day card first, then the ledger, then the morning and the evening journal tables \(TIME-01; TIME-02; JOURNAL-07\)/);
  assert.match(comments(LAW), /TASKS-ONE-01 — the ruling \(Alex, 2026-10-14\): the day card is the first section of Tasks — one Tasks page, no\s*\n\s*\/\/ sub-tabs\./);
});

// ── T2 · THE CARD'S URLS ARE /tasks?… ───────────────────────────────────────

test('T2 hrefFor builds DAY_CARD_PATH?date=&step= — the same two parameters, the same rules (TIME-01: /time)', () => {
  assert.equal(DAY_CARD_PATH, '/time'); // TIME-01 (Alex, 2026-10-19): the card moved to /time
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  const c = code(CARD);
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  // Every control pushes hrefFor's URL — ‹ › today all, ‹ step, step › and a row's door — and nothing else.
  // DECK-01 (Alex, 2026-10-16): the day controls (‹ › today) push; "all", "‹ step" and "step ›" are gone, and the deck's moves (a swipe, a
  // button, a key, a dot, a row's door) REPLACE hrefFor's URL — one replace, show() — so a swipe never fills the back button.
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 3);
  assert.equal((c.match(/router\.push\(/g) ?? []).length, 1, 'the one push is go()');
  assert.equal((c.match(/router\.replace\(hrefFor\(day, step\), \{ scroll: false \}\)/g) ?? []).length, 1, 'the one replace is show()');
  assert.equal((c.match(/router\.replace\(/g) ?? []).length, 1);
  assert.doesNotMatch(c, /\/tasks\/day|['"`]\/tasks\?/, 'no URL of the card is typed outside DAY_CARD_PATH');
  // The card still reads only ?date= and ?step= — and nothing else on /tasks reads a query parameter (the §1 grep).
  assert.deepEqual([...c.matchAll(/search\.get\('(\w+)'\)/g)].map((m) => m[1]), ['date', 'step']);
});

// ── T3 · /tasks/day IS ONE SERVER HOP, KEEPING date AND step ────────────────

test('T3 /tasks/day redirects to the card\'s page keeping date and step exactly as given (TIME-01: /time)', () => {
  // TIME-01 (Alex, 2026-10-19): the hop follows DAY_CARD_PATH — the same rule, the card's page is /time.
  assert.equal(dayCardRedirectHref({ date: '2026-10-13', step: '2' }), '/time?date=2026-10-13&step=2');
  assert.equal(dayCardRedirectHref({ date: '2026-10-13' }), '/time?date=2026-10-13');
  assert.equal(dayCardRedirectHref({ step: '3' }), '/time?step=3');
  assert.equal(dayCardRedirectHref({}), '/time', 'neither given — the bare path, nothing invented');
});

test('T3 nothing else is carried and nothing is checked — a bad value arrives as sent, for the card to name', () => {
  // TIME-01 (2026-10-19): the path is /time; every rule below is unchanged.
  assert.equal(dayCardRedirectHref({ date: '2026-10-13', step: '2', entity: 'P', utm_source: 'x' }), '/time?date=2026-10-13&step=2');
  assert.equal(dayCardRedirectHref({ date: 'not-a-day', step: '99' }), '/time?date=not-a-day&step=99');
  assert.equal(dayCardRedirectHref({ date: '' }), '/time?date=', 'an empty ?date= is still given');
  // Date first, as the card's own links write them — whatever order the request named them in.
  assert.equal(dayCardRedirectHref({ step: '2', date: '2026-10-13' }), '/time?date=2026-10-13&step=2');
  // A parameter given twice keeps both values, in order — the card reads the first, as it did at /tasks/day.
  assert.equal(dayCardRedirectHref({ date: ['2026-10-13', '2026-10-14'] }), '/time?date=2026-10-13&date=2026-10-14');
  // Exactly as given: what the card reads back on /tasks is byte-for-byte what /tasks/day was sent.
  for (const date of ['2026-10-13', 'a b&c=d', 'ü/?#']) {
    const back = new URLSearchParams(dayCardRedirectHref({ date, step: '1' }).split('?')[1]);
    assert.equal(back.get('date'), date);
    assert.equal(back.get('step'), '1');
  }
});

test('T3 the page is the hop and nothing else — a server component, no shell, no card', () => {
  const p = code(DAY_PAGE);
  assert.match(p, /^import \{ redirect \} from 'next\/navigation';\nimport \{ dayCardRedirectHref \} from '@\/components\/workbench\/operations\/day\/dayCard';/);
  assert.match(p, /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.doesNotMatch(p, /'use client'|AppLayout|DayCard\b|useSearchParams/);
});

// ── T4 · THE ISSUE LOG IS GONE ──────────────────────────────────────────────

test('T4 the Issue log page and PlaceholderCard are deleted, and nothing names them', () => {
  assert.equal(existsSync(`${process.cwd()}/${ISSUES_PAGE}`), false);
  assert.equal(existsSync(`${process.cwd()}/${PLACEHOLDER}`), false);
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal((tasks.links ?? []).some((l) => l.label === 'Issue log' || l.href === '/operations/issues'), false);
  const law = code(LAW);
  assert.doesNotMatch(law, /\/operations\/issues|PlaceholderCard/, 'no orphan exception names the page');
  // TASKS-02 (2026-10-20): the maximum came down again, 1 → 0 — the audit trail left the list for Compliance's links.
  assert.match(law, /const ORPHAN_EXCEPTIONS_MAX = 0;/);
});

// ── T5 · THE TASKS ROW LINKS NOTHING ───────────────────────────────────────
// TASKS-02 (2026-10-20): T5 said "North Star and Audit trail only — until the next ruling". This is that ruling:
// the North Star's page is deleted and the audit trail is Compliance's link, so the Tasks row links nothing and the
// rail shows no sub-row. The TASKS-ONE-01 comment stays on the row as history.

test('T5 the Tasks row links nothing — and the rail shows no sub-row under it', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual(tasks.links, []);
  const rail = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(rail.subRows, []);
  assert.match(comments('src/lib/toolRegistry.ts'), /TASKS-ONE-01 \(Alex, 2026-10-14\): one Tasks page, no sub-tabs\./);
});
