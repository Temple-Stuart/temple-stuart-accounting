import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts, type ToolEntry } from '../toolRegistry';
import { OWNER_UTILITIES } from '../shellMenu';
import { FREE_TOOLS } from '../offer';

// TRUTH-01 — status means the job is done, not that code exists. The rubric: NOT_BUILT ⇔ no
// beats; LIVE ⇒ four beats; a PARTIAL with four beats says why it is not LIVE. Census 2026-09-09.

const byName = (name: string): ToolEntry => {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  if (!t) throw new Error(`${name} is not in the registry`);
  return t;
};
const beats = (t: ToolEntry) => [t.beats.discover, t.beats.decide, t.beats.commit, t.beats.record].filter(Boolean).length;
const withTool = (name: string, patch: Partial<ToolEntry>): ToolEntry[] => TOOL_REGISTRY.map((t) => (t.name === name ? { ...t, ...patch } : t));

test('the counts are the dated census — 2 LIVE · 9 PARTIAL · 14 NOT_BUILT — and the law holds on the real registry', () => {
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 2, PARTIAL: 9, NOT_BUILT: 14 });
  assert.deepEqual(statusCounts(), { LIVE: 2, PARTIAL: 9, NOT_BUILT: 14 });
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.deepEqual(TOOL_REGISTRY.filter((t) => t.status === 'LIVE').map((t) => t.name), ['Travel', 'Bookkeeping']);
});

test('the four four-beat PARTIALs each carry the census note; no LIVE or NOT_BUILT tool carries one', () => {
  const fourBeatPartials = TOOL_REGISTRY.filter((t) => t.status === 'PARTIAL' && beats(t) === 4).map((t) => t.name);
  assert.deepEqual(fourBeatPartials, ['Calendar', 'Tasks', 'Time', 'Budget']);
  assert.equal(byName('Calendar').why, 'an agenda list whose commit lands on calendar_events; the calendar grid itself lives on /runway');
  assert.equal(byName('Tasks').why, "the founder's build pipeline — accepting a task fires a paid Claude Code build; not a customer's task tool");
  assert.equal(byName('Time').why, 'day blocks and a daily log inside the Narrative pipeline; no time tool');
  assert.equal(byName('Budget').why, 'actuals by entity plus recurring lines on module_expenses; no plan vs actual; no personal · trade · travel roll-up');
  for (const t of TOOL_REGISTRY) if (t.status !== 'PARTIAL') assert.equal(t.why, undefined, `${t.name} carries no why`);
});

test('the law rejects a four-beat PARTIAL without `why`, a `why` on a non-PARTIAL, a LIVE short of four beats, a PARTIAL or LIVE with no beats, and a NOT_BUILT with beats or a home', () => {
  const noWhy = registryLaw({ throwOnFail: false, registry: withTool('Calendar', { why: undefined }) }).join('\n');
  assert.match(noWhy, /Calendar: PARTIAL with four beats must say why it is not LIVE/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Calendar', { why: '   ' }) }).join('\n'), /Calendar: PARTIAL with four beats must say why/);
  assert.throws(() => registryLaw({ registry: withTool('Calendar', { why: undefined }) }), /TOOL REGISTRY LAW failed/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Travel', { why: 'not needed' }) }).join('\n'), /Travel: why belongs only to a PARTIAL tool/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Travel', { beats: { discover: true, decide: true, commit: true, record: false } }) }).join('\n'), /Travel: LIVE needs four beats and a home \(beats 3/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Banking', { beats: { discover: false, decide: false, commit: false, record: false } }) }).join('\n'), /Banking: PARTIAL with no beats — no beats is NOT_BUILT/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('CRM', { beats: { discover: true, decide: false, commit: false, record: false } }) }).join('\n'), /CRM: NOT_BUILT must have no beats, no home, no links/);
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Expenses', { home: '/budgets/trips' }) }).join('\n'), /Expenses: NOT_BUILT must have no beats, no home, no links/);
  // a wrong count is named (Calendar back to LIVE → 3/8/14)
  assert.match(registryLaw({ throwOnFail: false, registry: withTool('Calendar', { status: 'LIVE', why: undefined }) }).join('\n'), /LIVE count 3 ≠ census 2/);
});

test('CRM and Expenses are NOT_BUILT with the census citation, no home, no beats; their former pages keep a door — /owner in the owner utilities, /budgets/trips as Travel\'s link', () => {
  for (const name of ['CRM', 'Expenses']) {
    const t = byName(name);
    assert.equal(t.status, 'NOT_BUILT');
    assert.equal(t.home, null);
    assert.equal(beats(t), 0);
    assert.equal(t.links, undefined);
  }
  assert.match(byName('CRM').citation, /proposals inbox — no contact or deal object \(src\/app\/api\/owner\/proposals\/route\.ts\)/);
  assert.match(byName('Expenses').citation, /trip cost split on the trip planner \(src\/app\/api\/trips\/\[id\]\/expenses\/route\.ts:70\) is Travel's/);
  assert.ok(OWNER_UTILITIES.some((u) => u.href === '/owner'), '/owner keeps its door in the utilities menu');
  assert.ok(byName('Travel').links?.some((l) => l.href === '/budgets/trips'), '/budgets/trips keeps its door as Travel\'s link');
});

test('derived surfaces: the free set is Travel alone', () => {
  assert.deepEqual(FREE_TOOLS.map((t) => t.name), ['Travel']);
});
