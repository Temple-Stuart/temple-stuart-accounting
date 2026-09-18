import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { navRows, navToolByName, PHASES_RENDERED_AT } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { code } from '../sourceText';

// CAL-OPEN-01 — the calendar explains nothing; it is self-evident.
//
// /calendar's ToolOpener printed two paragraphs above the grid. STEP 0 named
// them: string #1 was the page's own `line` prop; string #2 is the registry
// `why`, which the opener rendered as the tool's line (nav.ts `line: tool.why`).
// The opener law's enforced check never required an opener to be mounted, so
// the opener is REMOVED from /calendar — not reduced — and the registry row is
// untouched: its `why` renders on the sheet, not here.

const PAGE = 'src/app/calendar/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
// String #1, as it stood on main at 19f7dbf6 — the opening and closing clauses.
const LINE_OPENS = 'The day as it actually is';
const LINE_CLOSES = 'routines and projects are planned in Tasks';
// String #2, verbatim — the registry row CAL-OPEN-01 forbids changing. In source
// text its apostrophe is escaped, so source scans look for its opening clause.
const WHY_OPENS = 'the view every tool logs to';
const WHY = 'the view every tool logs to — trips, routine occurrences, project blocks and the days you enter by hand, on one grid, with the day\'s total naming each part; an event can be added, edited and deleted here, but nothing holds a draft and no invite goes out';

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFilesUnder(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function openerCount(route: string): number | null {
  const f = `src/app${route === '/' ? '' : route}/page.tsx`;
  if (!existsSync(`${process.cwd()}/${f}`)) return null;
  return (code(f).match(/<ToolOpener/g) ?? []).length;
}

// ───────────────────────────────────────────────────────────────────────────
test('/calendar renders neither string — no opener, no line prop, no why', () => {
  const page = code(PAGE);
  assert.doesNotMatch(page, /<ToolOpener/, 'no opener is mounted');
  assert.equal(page.includes('ToolOpener'), false, 'and none is imported');
  assert.equal(page.includes('navToolByName'), false, 'the page reads no registry row to print');
  assert.equal(page.includes('line='), false, 'no line prop of any kind');
  assert.equal(page.includes(LINE_OPENS), false, 'string #1 is gone');
  assert.equal(page.includes(LINE_CLOSES), false, 'string #1 is gone, to its last clause');
  assert.equal(page.includes(WHY_OPENS), false, 'string #2 is not typed here either');
  // Nothing renders but the shell and the grid — the whole JSX, in order.
  assert.match(page, /<AppLayout page>\s*<div data-calendar-room>\s*<HubCalendar \/>\s*<\/div>\s*<\/AppLayout>/,
    'the shell, the room, the grid — and nothing else');
});

test('the prose moved nowhere — string #1 is in no rendered file, string #2 only in its registry home', () => {
  const rendered = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')];
  for (const f of rendered) {
    const body = code(f);
    assert.equal(body.includes(LINE_OPENS), false, `${f} does not carry the calendar's old line`);
    assert.equal(body.includes(WHY_OPENS), false, `${f} does not type the calendar's why`);
  }
  const homes = tsFilesUnder('src/lib').filter((f) => !f.includes('__tests__') && code(f).includes(WHY_OPENS));
  assert.deepEqual(homes, ['src/lib/toolRegistry.ts'], 'the why has one home');
});

test('the registry why-note is untouched, and it still renders on the sheet, not on /calendar', () => {
  const row = TOOL_REGISTRY.find((t) => t.name === 'Calendar')!;
  assert.equal(row.why, WHY, 'the row CAL-OPEN-01 forbids changing');
  assert.equal(row.status, 'PARTIAL');
  assert.equal(row.home, '/calendar');
  // nav.ts still hands the why on as the tool's line — the rail and the sheet read it.
  assert.equal(navToolByName('Calendar', TOOL_GATE).line, WHY);
  // The sheet prints the why (or says the registry holds no note); the page prints nothing.
  const sheet = code('src/components/shell/TheSheet.tsx');
  assert.match(sheet, /tool\.why\?\.trim\(\) \? tool\.why : 'No note in the registry for this job\.'/);
  assert.equal(code(PAGE).includes('why'), false);
});

test('the opener law still passes on its own terms — /calendar declares and draws no phases', () => {
  // The law: PHASES_RENDERED_AT[route] must equal the phases the page's import
  // tree draws. /calendar declares none (PLAN-01) and the page reads no strip.
  assert.deepEqual(PHASES_RENDERED_AT['/calendar'], []);
  const page = code(PAGE);
  assert.equal(page.includes('<StageStrip'), false);
  assert.equal(page.includes('PIPE_PHASES'), false);
  // STEP 0's answer, pinned: the enforced check compares declared vs drawn and
  // never asks whether an opener is mounted. If it ever does, /calendar needs a
  // new ruling — this is the test that will say so.
  const law = code(LAW);
  const start = law.indexOf("console.log('THE OPENER");
  const end = law.indexOf('The opener law passed');
  assert.ok(start > 0 && end > start, 'the opener law is where it was');
  const openerLaw = law.slice(start, end);
  assert.match(openerLaw, /PHASES_RENDERED_AT\[route\]/, 'it reads the declaration');
  assert.match(openerLaw, /<StageStrip/, 'it censuses the strips a tree draws');
  assert.equal(openerLaw.includes('ToolOpener'), false, 'it never requires an opener to be mounted');
});

test("no other tool's opener changes — six pages mount one each, /calendar mounts none", () => {
  const counts = new Map<string, number>();
  for (const t of navRows(TOOL_GATE)) {
    if (!t.href) continue;
    const n = openerCount(t.href);
    if (n !== null) counts.set(t.href, n);
  }
  assert.equal(counts.get('/calendar'), 0);
  const withOpener = [...counts.entries()].filter(([, n]) => n > 0).map(([r]) => r).sort();
  // The census on 2026-09-18 (CAL-OPEN-01): seven tool pages mounted an opener; six do now.
  assert.deepEqual(withOpener, ['/brokerage', '/budget', '/compliance', '/tasks', '/time', '/trade-log']);
  for (const r of withOpener) assert.equal(counts.get(r), 1, `${r} mounts exactly one opener`);
});
