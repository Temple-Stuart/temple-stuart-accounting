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
const DAY_PAGE = 'src/app/tasks/day/page.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const ISSUES_PAGE = 'src/app/operations/issues/page.tsx';
const PLACEHOLDER = 'src/components/workbench/operations/PlaceholderCard.tsx';

// ── T1 · /tasks MOUNTS THE DAY CARD FIRST ───────────────────────────────────

test('T1 /tasks mounts DayCard first — in its Suspense boundary, above the week, the lists and the daily plan', () => {
  const page = code(PAGE);
  assert.match(page, /^'use client';/, 'a client page — which is why the card needs its boundary');
  assert.match(page, /import \{ Suspense \} from 'react';/);
  assert.match(page, /import DayCard from '@\/components\/workbench\/operations\/day\/DayCard';/);
  assert.equal((page.match(/<DayCard \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(page, /<div className="space-y-3" data-tool-page="Tasks">\n\s*<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>\n\s*<WeekSection \/>\n\s*<SectionD_ProjectBacklog \/>\n\s*<SectionE_Routines \/>\n\s*<SectionC_DailyPlan \/>\n\s*<\/div>/);
  assert.ok(page.indexOf('<ToolOpener') < page.indexOf('<DayCard />'), 'the opener first — family, name, registry line — then the card');
  assert.match(comments(PAGE), /TASKS-ONE-01 \(2026-10-14\) — Alex's ruling: the day card is the first section\s*\n\s*\* of Tasks — one Tasks page, no sub-tabs\./);
});

test('T1 the two-lists law mounts the day card first, with the dated ruling', () => {
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<DayCard \/>', '<WeekSection \/>', '<SectionD_ProjectBacklog \/>', '<SectionE_Routines \/>', '<SectionC_DailyPlan \/>'\];/);
  assert.match(law, /mounts its sections out of order — the day card first, then this week, projects, routines and the daily plan/);
  assert.match(comments(LAW), /TASKS-ONE-01 — the ruling \(Alex, 2026-10-14\): the day card is the first section of Tasks — one Tasks page, no\s*\n\s*\/\/ sub-tabs\./);
});

// ── T2 · THE CARD'S URLS ARE /tasks?… ───────────────────────────────────────

test('T2 hrefFor builds /tasks?date=&step= — DAY_CARD_PATH, the same two parameters, the same rules', () => {
  assert.equal(DAY_CARD_PATH, '/tasks');
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  const c = code(CARD);
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  // Every control pushes hrefFor's URL — ‹ › today all, ‹ step, step › and a row's door — and nothing else.
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 7);
  assert.equal((c.match(/router\.push\(/g) ?? []).length, 1, 'the one push is go()');
  assert.doesNotMatch(c, /\/tasks\/day|['"`]\/tasks\?/, 'no URL of the card is typed outside DAY_CARD_PATH');
  // The card still reads only ?date= and ?step= — and nothing else on /tasks reads a query parameter (the §1 grep).
  assert.deepEqual([...c.matchAll(/search\.get\('(\w+)'\)/g)].map((m) => m[1]), ['date', 'step']);
});

// ── T3 · /tasks/day IS ONE SERVER HOP, KEEPING date AND step ────────────────

test('T3 /tasks/day redirects to /tasks keeping date and step exactly as given', () => {
  assert.equal(dayCardRedirectHref({ date: '2026-10-13', step: '2' }), '/tasks?date=2026-10-13&step=2');
  assert.equal(dayCardRedirectHref({ date: '2026-10-13' }), '/tasks?date=2026-10-13');
  assert.equal(dayCardRedirectHref({ step: '3' }), '/tasks?step=3');
  assert.equal(dayCardRedirectHref({}), '/tasks', 'neither given — the bare path, nothing invented');
});

test('T3 nothing else is carried and nothing is checked — a bad value arrives as sent, for the card to name', () => {
  assert.equal(dayCardRedirectHref({ date: '2026-10-13', step: '2', entity: 'P', utm_source: 'x' }), '/tasks?date=2026-10-13&step=2');
  assert.equal(dayCardRedirectHref({ date: 'not-a-day', step: '99' }), '/tasks?date=not-a-day&step=99');
  assert.equal(dayCardRedirectHref({ date: '' }), '/tasks?date=', 'an empty ?date= is still given');
  // Date first, as the card's own links write them — whatever order the request named them in.
  assert.equal(dayCardRedirectHref({ step: '2', date: '2026-10-13' }), '/tasks?date=2026-10-13&step=2');
  // A parameter given twice keeps both values, in order — the card reads the first, as it did at /tasks/day.
  assert.equal(dayCardRedirectHref({ date: ['2026-10-13', '2026-10-14'] }), '/tasks?date=2026-10-13&date=2026-10-14');
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
  assert.match(law, /const ORPHAN_EXCEPTIONS_MAX = 1;/);
});

// ── T5 · THE TASKS ROW LINKS NORTH STAR AND AUDIT TRAIL ONLY ────────────────

test('T5 the Tasks row links North Star and Audit trail only — and the rail shows exactly those two', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual(tasks.links, [
    { label: 'North Star', href: '/operations/north-star' },
    { label: 'Audit trail', href: '/operations/audit-log' },
  ]);
  const rail = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(rail.subRows.map((r) => [r.label, r.door.href]), [['North Star', '/operations/north-star'], ['Audit trail', '/operations/audit-log']]);
  assert.match(comments('src/lib/toolRegistry.ts'), /TASKS-ONE-01 \(Alex, 2026-10-14\): one Tasks page, no sub-tabs\./);
});
