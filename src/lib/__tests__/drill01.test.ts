import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTUAL_SOURCES, CHAIN_STATES, ChainLawError, DRILL_KINDS, EVENT_SOURCE_OWNER,
  KIND_FACTS, buildChain, buildDrill, factsOf, kindOfSource, ownerOf,
} from '../calendar/chain';
import { ACTUALS_JOIN_SOUND, ACTUALS_NOT_JOINABLE_LINE } from '../calendar/actuals';
import { CALENDAR_SOURCES } from '../calendar/sources';
import { navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { code } from '../sourceText';

// DRILL-01 — click anything on the day and see its whole chain.

const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const DAYVIEW = 'src/components/hub/DayView.tsx';
const HUB = 'src/components/hub/HubCalendar.tsx';

test('the census covers every kind, and only a kind with an actual column names a source', () => {
  assert.deepEqual(KIND_FACTS.map((f) => f.kind), [...DRILL_KINDS]);
  for (const f of KIND_FACTS) {
    assert.equal(f.actualColumn === null, f.actualSource === null, `${f.kind}: an actual column and its source travel together`);
    if (f.actualSource) assert.ok(ACTUAL_SOURCES.includes(f.actualSource), `${f.kind}: ${f.actualSource} is a named source`);
    // DAY-01's verdict stands: NOTHING on the day links to a posted transaction.
    assert.equal(f.postedLink, null, `${f.kind}: no link to a posting exists — this PR invents none`);
  }
  // Exactly one kind can show an actual today, and it is hand-entered.
  const carriers = KIND_FACTS.filter((f) => f.actualColumn !== null);
  assert.deepEqual(carriers.map((f) => f.kind), ['project_task']);
  assert.equal(carriers[0].actualSource, 'hand-entered');
  assert.match(carriers[0].actualColumn!, /operations_project_tasks\.actual_cost_usd/);
});

test('a planned amount with no actual, on an object that can never carry one, reads NOT LINKED with DAY-01\'s reason', () => {
  for (const kind of ['calendar_event', 'routine', 'task'] as const) {
    const chain = buildChain({ kind, planned: 100, actual: null })!;
    assert.equal(chain.state, 'NOT_LINKED', `${kind} has no column an actual could live in`);
    assert.equal(chain.line, ACTUALS_NOT_JOINABLE_LINE, `${kind} quotes the verdict, never a guess`);
    assert.equal(chain.actualSource, null);
  }
  // The verdict itself is untouched by this PR.
  assert.equal(ACTUALS_JOIN_SOUND, false);
});

test('a project task reads PLANNED without an actual and PLANNED AND SETTLED with one, naming the writer\'s source', () => {
  const planned = buildChain({ kind: 'project_task', planned: 250, actual: null })!;
  assert.equal(planned.state, 'PLANNED');
  assert.match(planned.line, /actual_cost_usd/);
  assert.match(planned.line, /hand-entered/, 'it says in advance what such an actual would be');

  const settled = buildChain({ kind: 'project_task', planned: 250, actual: 219.4, actualSource: 'hand-entered' })!;
  assert.equal(settled.state, 'PLANNED_AND_SETTLED');
  assert.equal(settled.actualSource, 'hand-entered');
  assert.match(settled.line, /hand-entered/);
  assert.match(settled.line, /operations_project_tasks\.actual_cost_usd/);
});

test('no amount is ever rendered without its source — the leaf throws rather than guess', () => {
  assert.throws(() => buildChain({ kind: 'project_task', planned: 10, actual: 9 }), ChainLawError);
  assert.throws(() => buildChain({ kind: 'project_task', planned: 10, actual: 9 }), /an actual of 9 with no source/);
  assert.throws(() => buildChain({ kind: 'project_task', planned: 10, actual: null, actualSource: 'posted' }), /with no actual/);
  // A kind whose census says no column holds an actual may not be handed one.
  assert.throws(() => buildChain({ kind: 'calendar_event', planned: 10, actual: 9, actualSource: 'posted' }), /the census says no column holds one/);
});

test('a row with no amount has NO chain — a blank, never $0 and never a fourth state', () => {
  assert.equal(buildChain({ kind: 'calendar_event', planned: null, actual: null }), null);
  assert.equal(buildChain({ kind: 'project_task', planned: null, actual: null }), null);
  const row = buildDrill({ id: 'e1', source: 'manual', title: 'Walk', startDate: '2026-09-19', budgetAmount: null });
  assert.equal(row.planned, null);
  assert.equal(row.actual, null);
  assert.equal(row.chain, null);
  // Zero is a real amount and is NOT treated as absent.
  const zero = buildDrill({ id: 'e2', source: 'manual', title: 'Free', startDate: '2026-09-19', budgetAmount: 0 });
  assert.equal(zero.planned, 0);
  assert.equal(zero.chain?.state, 'NOT_LINKED');
});

test('each kind of row builds the columns STEP 0.2 says it has', () => {
  // A hand-entered event: planned + coa + pin, no actual.
  const manual = buildDrill({
    id: 'm1', source: 'manual', title: 'Dentist', startDate: '2026-09-19',
    startTime: '09:00', endTime: '10:00', location: 'Clinic', latitude: 13.7, longitude: 100.5,
    coaCode: '8210', budgetAmount: 80,
  });
  assert.equal(manual.kind, 'calendar_event');
  assert.equal(manual.owner, 'Calendar');
  assert.deepEqual(manual.pin, { lat: 13.7, lon: 100.5 });
  assert.equal(manual.planned, 80);
  assert.equal(manual.actual, null);
  assert.equal(manual.chain?.state, 'NOT_LINKED');

  // A trip event: Travel's, and its code is the PREFIXED form DAY-01 named.
  const trip = buildDrill({ id: 't1', source: 'trip', title: 'Hotel', startDate: '2026-09-19', endDate: '2026-09-22', coaCode: 'P-9200', budgetAmount: 420 });
  assert.equal(trip.owner, 'Travel');
  assert.equal(trip.coaCode, 'P-9200');
  assert.equal(trip.endDate, '2026-09-22');

  // A routine occurrence: Tasks', per-occurrence budget, no actual anywhere.
  const routine = buildDrill({ id: 'routine:r1:2026-09-19T00:00:00Z', source: 'routines', title: 'Gym', startDate: '2026-09-19', coaCode: '8210', budgetAmount: 100 });
  assert.equal(routine.kind, 'routine');
  assert.equal(routine.owner, 'Tasks');
  assert.equal(routine.planned, 100);
  assert.equal(routine.chain?.state, 'NOT_LINKED');

  // A project block: the two columns read APART, which the grid mapper collapses.
  const task = buildDrill(
    { id: 'b1', source: 'project', title: 'Ship the thing', startDate: '2026-09-19', coaCode: '6110', budgetAmount: 219.4 },
    { estimated: 250, actual: 219.4, coaCode: '6110' },
  );
  assert.equal(task.kind, 'project_task');
  assert.equal(task.owner, 'Tasks');
  assert.equal(task.planned, 250, 'planned is the ESTIMATE, not the collapsed budgetAmount');
  assert.equal(task.actual, 219.4);
  assert.equal(task.actualSource, 'hand-entered');
  assert.equal(task.coaCode, '6110', "the TASK's code, which the grid mapper never emits");
  assert.equal(task.chain?.state, 'PLANNED_AND_SETTLED');
  // With no costs supplied it falls back to what the grid gave it, and claims no actual.
  const bare = buildDrill({ id: 'b2', source: 'project', title: 'Other', startDate: '2026-09-19', budgetAmount: 50 });
  assert.equal(bare.planned, 50);
  assert.equal(bare.actual, null);
  assert.equal(bare.chain?.state, 'PLANNED');
});

test('every admitted calendar source names an owner, and every owner link resolves to a real door', () => {
  for (const s of CALENDAR_SOURCES) {
    assert.ok(EVENT_SOURCE_OWNER[s.source], `${s.source} names the tool that writes it`);
  }
  assert.equal(Object.keys(EVENT_SOURCE_OWNER).length, CALENDAR_SOURCES.length, 'no owner for a source the grid does not render');
  const owners = new Set([...Object.values(EVENT_SOURCE_OWNER), ...KIND_FACTS.map((f) => f.owner).filter((o) => o !== 'by source')]);
  for (const name of owners) {
    const tool = navToolByName(name, TOOL_GATE);
    assert.ok(tool, `${name} is a registry tool`);
    assert.ok(tool.href, `${name} has a door the panel can link to`);
  }
  assert.equal(ownerOf('calendar_event', 'trip'), 'Travel');
  assert.equal(ownerOf('routine', 'routines'), 'Tasks');
  assert.equal(ownerOf('project_task', 'project'), 'Tasks');
  assert.equal(ownerOf('trade', 'trade'), 'Trade Log');
  assert.throws(() => ownerOf('calendar_event', 'nonesuch'), /has no owner/);
});

test('the grid\'s source names map to the right kind', () => {
  assert.equal(kindOfSource('manual'), 'calendar_event');
  assert.equal(kindOfSource('trip'), 'calendar_event');
  assert.equal(kindOfSource('routines'), 'routine');
  assert.equal(kindOfSource('project'), 'project_task');
  assert.equal(kindOfSource('operations'), 'project_task', 'the /hub mount still emits the old name');
  assert.equal(kindOfSource('trade'), 'trade');
  for (const s of CALENDAR_SOURCES) assert.equal(kindOfSource(s.source), 'calendar_event', `${s.source} is a calendar_event`);
});

test('the panel renders a chain state from the named set and nothing else, and writes nothing', () => {
  const panel = code(PANEL);
  // It renders the leaf's label, never a typed state string.
  assert.match(panel, /row\.chain\.label/);
  assert.match(panel, /data-drill-chain-state=\{row\.chain\.state\}/);
  for (const forbidden of [/'PLANNED'/, /'NOT_LINKED'/, /'PLANNED_AND_SETTLED'/]) {
    assert.doesNotMatch(panel.replace(/STATE_CLASS[\s\S]*?\};/, ''), forbidden, 'a state is not typed into the render');
  }
  // Zero fetch, zero write.
  for (const w of [/fetch\s*\(/, /method:\s*'(POST|PATCH|PUT|DELETE)'/]) assert.doesNotMatch(panel, w, 'the panel reaches no route');
  // An amount is never rendered without its source label.
  assert.match(panel, /ACTUAL_SOURCE_LABEL\[row\.actualSource\]/);
  // The door comes from the registry, never a typed href.
  assert.match(panel, /navToolByName\(row\.owner, TOOL_GATE\)/);
  assert.doesNotMatch(panel, /href="\/(tasks|travel|trade-log|budget|calendar)"/, 'no typed door');
});

test('every row on the day opens the panel — none navigates away, none is inert', () => {
  const day = code(DAYVIEW);
  assert.match(day, /onRowOpen/, 'the day view can open a row');
  assert.match(day, /data-day-row-opens/);
  assert.match(day, /onClick: \(\) => onRowOpen\(r\.id\)/);
  // The two action buttons keep their own job.
  assert.match(day, /data-correct-event[\s\S]{0,120}ev\.stopPropagation\(\)/);
  assert.match(day, /data-delete-event[\s\S]{0,120}ev\.stopPropagation\(\)/);
  // The day view still writes nothing but EVENT-01's delete.
  assert.doesNotMatch(day, /method:\s*'(POST|PATCH|PUT)'/);

  const hub = code(HUB);
  assert.match(hub, /onRowOpen=\{\(id\) =>/, 'the calendar hands the day view the opener');
  assert.match(hub, /setDetailEvent\(drillOf\(e\)\)/);
  // A routine tile's href is still dropped so it opens the panel instead of navigating.
  assert.match(hub, /mapOperationsRoutines\(routinesWindow\)\.map\(\(e\) => \(\{ \.\.\.e, href: undefined \}\)\)/);
});

test('the mapper that collapses the two figures is untouched, and the panel reads around it', () => {
  // mapOperationsBlocks still emits ONE budgetAmount — the grid and every total
  // keep their numbers. DRILL-01 reads the task's two columns apart instead.
  const mapper = code('src/lib/hub/mapOperationsBlocks.ts');
  assert.match(mapper, /item\.task\?\.actual_cost_usd \?\? item\.task\?\.estimated_cost_usd/);
  const hub = code(HUB);
  assert.match(hub, /estimated: num\(item\.task\?\.estimated_cost_usd\)/);
  assert.match(hub, /actual: num\(item\.task\?\.actual_cost_usd\)/);
  assert.match(hub, /coaCode: item\.task\?\.coa_code \?\? null/);
});

test('the three states are the whole set, in the leaf and on the screen', () => {
  assert.deepEqual([...CHAIN_STATES], ['PLANNED', 'PLANNED_AND_SETTLED', 'NOT_LINKED']);
  for (const kind of DRILL_KINDS) {
    const f = factsOf(kind);
    const states = new Set<string>();
    for (const planned of [null, 100]) {
      for (const actual of [null, 50]) {
        if (actual !== null && f.actualColumn === null) continue;
        const c = buildChain({ kind, planned, actual, actualSource: actual === null ? null : f.actualSource });
        if (c) states.add(c.state);
      }
    }
    for (const s of states) assert.ok(CHAIN_STATES.includes(s as never), `${kind} produced ${s}, which is not a named state`);
  }
});
