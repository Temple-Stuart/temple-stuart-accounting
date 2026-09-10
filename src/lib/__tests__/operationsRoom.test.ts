import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FOLDED_ROUTES, OPERATIONS_HOME, OPERATIONS_PHASES, OperationsPhasesLawError,
  operationsHref, operationsPhasesLaw, phaseFor,
} from '../operationsPhases';
import { navLaw, navToolByName, navToolsOfScreen } from '../nav';
import { TOOL_GATE } from '../offer';
// ROOM-02 — Operations is ONE room, read top down.
const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
/** The file with its comment lines stripped — a rule about CODE must not be satisfied, or broken, by prose. */
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
test('the six phases are one const, numbered top down, and the law holds on them', () => {
  assert.deepEqual(operationsPhasesLaw({ throwOnFail: false }), []);
  assert.equal(OPERATIONS_PHASES.length, 6);
  assert.deepEqual(OPERATIONS_PHASES.map((p) => p.key), ['plan', 'calendar', 'routines', 'projects', 'narrative', 'log']);
  assert.deepEqual(OPERATIONS_PHASES.map((p) => p.num), ['01', '02', '03', '04', '05', '06']);
  // A gap in the numbering, a repeated ?phase= word and a lower-case strip name all throw.
  assert.throws(() => operationsPhasesLaw({ phases: OPERATIONS_PHASES.slice(1) }), OperationsPhasesLawError);
  assert.throws(() => operationsPhasesLaw({
    phases: OPERATIONS_PHASES.map((p, i) => (i === 1 ? { ...p, key: 'plan' } : p)),
  }), OperationsPhasesLawError);
  assert.throws(() => operationsPhasesLaw({
    phases: OPERATIONS_PHASES.map((p, i) => (i === 0 ? { ...p, name: 'Plan' } : p)),
  }), OperationsPhasesLawError);
});
test('the phase named in ?phase= is the one the room renders', () => {
  for (const p of OPERATIONS_PHASES) {
    const got = phaseFor(p.key);
    assert.equal(got.phase.key, p.key);
    assert.equal(got.fellBack, false, `${p.key} is a real phase — nothing fell back`);
    assert.equal(operationsHref(p.key), `${OPERATIONS_HOME}?phase=${p.key}`);
  }
  // The strip and the body read the SAME const — no retyped phase list.
  const room = src('src/app/operations/OperationsRoom.tsx');
  assert.match(room, /OPERATIONS_PHASES\.map\(/, 'the strip maps the const');
  assert.match(room, /data-operations-phase=/);
  for (const p of OPERATIONS_PHASES) {
    assert.ok(room.includes(`case '${p.key}'`), `${p.key} has a body`);
  }
});
test('an unknown phase falls to 01 and the room says so — never a silent correction', () => {
  const missing = phaseFor(undefined);
  assert.equal(missing.phase.key, 'plan');
  assert.equal(missing.fellBack, false, 'no ?phase= at all is the default, not a fallback the viewer is told about');
  for (const bad of ['nope', 'PLAN2', 'audit-log']) {
    const got = phaseFor(bad);
    assert.equal(got.phase.key, 'plan', `${bad} falls to 01`);
    assert.equal(got.fellBack, true, `${bad} is REPORTED on screen`);
  }
  // Case is not a typo: ?phase=PLAN is phase 01, not a fallback.
  assert.deepEqual(phaseFor('PLAN'), { phase: OPERATIONS_PHASES[0], fellBack: false });
  const page = src('src/app/operations/page.tsx');
  assert.match(page, /data-phase-fellback/, 'the note has a marker the screenshot pass can count');
  assert.match(page, /There is no/, 'the note names the phase the viewer typed');
});
test('every folded route resolves — a redirect into the room, ten lines or fewer', () => {
  for (const r of FOLDED_ROUTES) {
    const file = `src/app${r.path}/page.tsx`;
    const body = src(file);
    assert.ok(body.split('\n').filter((l) => l.trim()).length <= 10, `${r.path} is a redirect, not a page`);
    assert.match(body, new RegExp(`redirect\\('${OPERATIONS_HOME}\\?phase=${r.phase}'\\)`), `${r.path} → phase ${r.phase}`);
  }
  // The /operations/* hops go straight to the room — one hop, not two.
  for (const [dir, phase] of [['projects', 'projects'], ['routines', 'routines'], ['content', 'narrative']] as const) {
    assert.match(src(`src/app/operations/${dir}/page.tsx`), new RegExp(`\\?phase=${phase}`), `/operations/${dir} skips the old cockpit hop`);
  }
  // The three left the cockpit allowlist — config that lies is config that rots.
  const tab = code('src/app/[tab]/page.tsx');
  for (const r of FOLDED_ROUTES) {
    assert.ok(!tab.includes(`'${r.path.slice(1)}'`), `${r.path} is out of TAB_PATHS`);
  }
});
test('Tasks and Time open the room, and no folded route is a door', () => {
  // NAV-25: the steps layer is gone; step 12 is now two tool rows, Tasks and Time.
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const inRoom = navToolsOfScreen(OPERATIONS_HOME, TOOL_GATE).map((t) => t.name);
  assert.deepEqual(inRoom, ['Tasks', 'Time'], 'both of the room\'s tools open it');
  for (const name of ['Tasks', 'Time'] as const) {
    const tool = navToolByName(name, TOOL_GATE);
    assert.equal(tool.href, OPERATIONS_HOME, `${name}'s door is the room`);
    for (const r of FOLDED_ROUTES) {
      assert.ok(!tool.subRows.some((s) => s.door.href === r.path), `${r.path} is a phase inside the room, not a door`);
    }
  }
  // CAL-01: /agenda was Calendar's home; it is Budget's sub-row now, and Calendar
  // opens the calendar. Neither is one of the room's folded routes.
  assert.equal(navToolByName('Calendar', TOOL_GATE).href, '/calendar');
  assert.ok(navToolByName('Budget', TOOL_GATE).subRows.some((r) => r.door.href === '/agenda'));
});
test('the room mounts the existing components — no interior rewritten, one shell', () => {
  const room = src('src/app/operations/OperationsRoom.tsx');
  for (const c of ['SectionB_NorthStar', 'SectionC_DailyPlan', 'HubCalendar', 'SectionE_Routines', 'SectionD_ProjectBacklog', 'ContentPipeline', 'SectionK_AuditTail']) {
    assert.ok(room.includes(`<${c} />`), `${c} is mounted, not reimplemented`);
  }
  // The shell belongs to the layout; the room never mounts a second one.
  for (const f of ['src/app/operations/OperationsRoom.tsx', 'src/app/operations/page.tsx']) {
    assert.ok(!/<AppLayout|<ShellBar|<Rail[\s/>]/.test(code(f)), `${f} mounts no shell of its own`);
  }
  assert.match(code('src/app/operations/layout.tsx'), /<AppLayout>/, 'the layout is where the one shell lives');
  // ONE phase control: the SubNav that duplicated the six phases is gone.
  assert.ok(!code('src/app/operations/layout.tsx').includes('SubNav'), 'the sub-nav did not survive alongside the strip');
});
