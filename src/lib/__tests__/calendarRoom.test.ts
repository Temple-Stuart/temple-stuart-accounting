import test from 'node:test';
import assert from 'node:assert/strict';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import HubCalendar from '@/components/hub/HubCalendar';
import { navLaw, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { code } from '../sourceText';

// CAL-01 — the calendar is the calendar; the agenda planner is Budget's.

test('/calendar mounts the SAME grid, bare — nothing only ModuleLauncher could supply', () => {
  const page = code('src/app/calendar/page.tsx');
  assert.match(page, /<HubCalendar \/>/, 'the same component, mounted with no props');
  assert.match(page, /<AppLayout page>/, 'it wears the one shell');
  assert.match(page, /navToolByName\('Calendar'/, 'its opener names the tool from the registry');
  // TOOL-LAW-01: the room's mount went with the room. The cockpit's runway tab
  // is the only other mount, and it passes nothing either.
  assert.match(code('src/components/home/ModuleLauncher.tsx'), /<HubCalendar \/>/, 'the cockpit mounts it bare too');
  // Every prop HubCalendar takes is optional, and the page passes none.
  assert.match(code('src/components/hub/HubCalendar.tsx'), /demoEvents\?:/);
  assert.match(code('src/components/hub/HubCalendar.tsx'), /onRequireAuth\?:/);
});

test('the grid needs nothing but a Next page — its one context is the app router', () => {
  // It cannot be rendered in a bare node test: CalendarGrid.tsx:338 and
  // HubEventCard.tsx:111 both call useRouter(), which throws "invariant expected
  // app router to be mounted" outside Next. That is not a blocker for /calendar —
  // every Next page provides it — but it IS why this proof is structural and the
  // rendering proof is the live screenshot pass, not a stubbed renderToStaticMarkup.
  assert.throws(
    () => renderToStaticMarkup(createElement(HubCalendar, { demoEvents: [] } as never)),
    /app router/,
    'the router is the one thing it needs, and a page is the only place that has one',
  );
  for (const f of ['src/components/shared/CalendarGrid.tsx', 'src/components/hub/HubEventCard.tsx']) {
    assert.match(code(f), /useRouter\(\)/, `${f} is where the dependency lives`);
  }
});

test('the three sources are the three routes — unchanged, no new data path', () => {
  const hub = code('src/components/hub/HubCalendar.tsx');
  for (const route of ['/api/calendar?', '/api/operations/daily-plan/items?', '/api/hub/operations-routines?']) {
    assert.ok(hub.includes(route), `${route} is still one of the three`);
  }
  // Read-only: three GETs, no write anywhere in the GRID itself.
  assert.ok(!/method:\s*'(POST|PATCH|PUT|DELETE)'/.test(hub), 'the grid writes nothing');
  // TRUTH-CAL: this used to assert the bare `source === 'trip'` filter and the
  // registry note that described it. DAY-01 DELETED that filter — the only two
  // mentions left in HubCalendar are comments saying it is gone, which is why the
  // old assertion kept passing against a behaviour that no longer existed. It now
  // reads the code with comments stripped, and asserts the allowlist that replaced
  // it, in both places.
  assert.doesNotMatch(code('src/components/hub/HubCalendar.tsx'), /source === 'trip'/);
  assert.match(code('src/components/hub/HubCalendar.tsx'), /isRenderedCalendarSource\(e\.source\)/);
  assert.match(TOOL_REGISTRY.find((t) => t.name === 'Calendar')!.note ?? '', /src\/lib\/calendar\/sources\.ts/);
});

test('Calendar opens /calendar and owns no agenda page; Budget owns all three', () => {
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const calendar = navToolByName('Calendar', TOOL_GATE);
  assert.equal(calendar.href, '/calendar');
  assert.equal(calendar.status, 'PARTIAL', 'the census does not move');
  assert.deepEqual(calendar.subRows.map((r) => r.door.href), [], 'no agenda row under Calendar');
  // PLAN-01: the routines pipe moved to Tasks — routines and projects are one
  // act of planning, and the calendar is the view they log to. Calendar owns no
  // pipe now; its page draws no strip, which no law forbids.
  assert.deepEqual(calendar.phases.map((p) => `${p.pipe} ${p.num}`), []);
  const tasks = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(tasks.phases.map((p) => `${p.pipe} ${p.num}`), [
    'routines 01', 'routines 02', 'routines 03', 'routines 04',
    'projects 01', 'projects 02', 'projects 03', 'projects 04', 'projects 05', 'projects 06',
  ]);

  const budget = navToolByName('Budget', TOOL_GATE);
  assert.ok(budget.subRows.some((r) => r.door.href === '/agenda'), 'the planner hangs under Budget');
  assert.equal(budget.subRows[0].label, 'Recurring plan · the agenda', 'labelled for what it is');
  assert.equal(budget.status, 'PARTIAL');
});

test('the agenda planner is untouched — the same pages, the same routes, the same tables', () => {
  // What made it Budget's: a cadence, a coa_code, a budget_amount, and a commit
  // that writes a `budgets` plan row.
  const commit = code('src/app/api/agenda/[id]/route.ts');
  assert.match(commit, /INSERT INTO calendar_events/);
  assert.match(commit, /INSERT INTO budgets/);
  assert.match(commit, /coa_code/);
  assert.match(commit, /budget_amount/);
  // Still raw SQL over tables Prisma does not model — nothing migrated here.
  assert.ok(!/model agenda/i.test(code('prisma/schema.prisma')), 'agenda_items is still not in the schema');
  // The three pages still exist and still mount their own bodies.
  for (const f of ['src/app/agenda/page.tsx', 'src/app/agenda/new/page.tsx', 'src/app/agenda/[id]/page.tsx']) {
    assert.ok(code(f).length > 0, `${f} still exists`);
  }
});
