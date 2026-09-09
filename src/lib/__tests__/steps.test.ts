import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW_ORDER, ROOM_LABELS, STEPS, StepsLawError, stepBySlug, stepGates, stepHref, stepLinks, stepOfTool, stepStatus, stepsLaw, stepsOf, toolsOfStep, type Step } from '../steps';
import { TOOL_REGISTRY, type ToolEntry } from '../toolRegistry';
import { TOOL_GATE } from '../offer';

// SHELL-01 — the rail walks the sheet in flow order: six families, twelve steps, twenty-five jobs.
// Everything a step shows is derived; the law is what keeps it honest.

const withSteps = (patch: (steps: Step[]) => Step[]): Step[] => patch(STEPS.map((s) => ({ ...s, tools: [...s.tools] })));
const violations = (steps: Step[]) => stepsLaw({ throwOnFail: false, steps }).join('\n');

test('the law holds on the real steps: twelve, numbered 1..12, six families in flow order, twenty-five jobs walked once', () => {
  assert.deepEqual(stepsLaw({ throwOnFail: false }), []);
  assert.equal(STEPS.length, 12);
  assert.deepEqual(STEPS.map((s) => s.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual([...FLOW_ORDER], ['WHAT YOU OWN', 'THE PROOF', 'WHAT YOU OWE', 'MONEY IN', 'MONEY OUT', 'THE WORK']);
  assert.deepEqual(STEPS.map((s) => s.name), ['ACCOUNTS', 'TRADING', 'BOOKS', 'TAX', 'COMPLIANCE', 'FP&A', 'OWED', 'SALES', 'SPEND', 'TRAVEL', 'BUDGET', 'OPERATIONS']);
  assert.equal(STEPS.flatMap((s) => s.tools).length, TOOL_REGISTRY.length);
  assert.deepEqual([...new Set(STEPS.flatMap((s) => s.tools))].sort(), TOOL_REGISTRY.map((t) => t.name).sort());
  // every family's steps are contiguous and in flow order
  assert.deepEqual(FLOW_ORDER.map((f) => stepsOf(f).map((s) => s.number)), [[1, 2], [3, 4, 5, 6], [7], [8], [9, 10, 11], [12]]);
});

test('a step sits in one family, and its jobs are that family\'s — the registry decides which', () => {
  for (const s of STEPS) {
    for (const t of toolsOfStep(s)) assert.equal(t.family, s.family, `${t.name} in ${s.name}`);
  }
  assert.equal(stepOfTool('Bookkeeping').name, 'BOOKS');
  assert.equal(stepOfTool('Mileage').name, 'SPEND');
  assert.equal(stepBySlug('operations')?.name, 'OPERATIONS');
  assert.equal(stepBySlug('nope'), undefined);
  assert.throws(() => stepOfTool('Nothing' as never), StepsLawError);
});

test('status is derived: LIVE when every job is, NOT_BUILT when every job is, else PARTIAL', () => {
  assert.deepEqual(STEPS.map((s) => `${s.name}:${stepStatus(s)}`), [
    'ACCOUNTS:PARTIAL', 'TRADING:PARTIAL', 'BOOKS:LIVE', 'TAX:PARTIAL', 'COMPLIANCE:PARTIAL', 'FP&A:NOT_BUILT',
    'OWED:NOT_BUILT', 'SALES:NOT_BUILT', 'SPEND:NOT_BUILT', 'TRAVEL:LIVE', 'BUDGET:PARTIAL', 'OPERATIONS:PARTIAL',
  ]);
  const fake = (statuses: string[]) => statuses.map((status) => ({ status } as ToolEntry));
  const step = STEPS[0];
  assert.equal(stepStatus(step, fake(['LIVE', 'LIVE'])), 'LIVE');
  assert.equal(stepStatus(step, fake(['NOT_BUILT', 'NOT_BUILT'])), 'NOT_BUILT');
  assert.equal(stepStatus(step, fake(['LIVE', 'NOT_BUILT'])), 'PARTIAL');
  assert.equal(stepStatus(step, fake(['PARTIAL'])), 'PARTIAL');
});

test('a step with no room opens /step/<slug>; one with a room opens the room', () => {
  assert.deepEqual(STEPS.filter((s) => s.screen === null).map((s) => stepHref(s)), ['/step/fpa', '/step/owed', '/step/sales', '/step/spend']);
  assert.equal(stepHref(stepBySlug('books')!), '/books');
  assert.equal(stepHref(stepBySlug('budget')!), '/business');
});

test('sub-links are derived from the registry — every door the family navigation gave a page, the rail gives it too; the step\'s own screen is not repeated and an href is listed once', () => {
  const byStep = Object.fromEntries(STEPS.map((s) => [s.slug, stepLinks(s).map((l) => (l.door.kind === 'none' ? 'none' : l.door.href))]));
  assert.deepEqual(byStep.accounts, ['/books', '/trade', '/trading']);
  assert.deepEqual(byStep.books, ['/chart-of-accounts']);
  assert.deepEqual(byStep.tax, ['/dashboard/tax-filing']);
  assert.deepEqual(byStep.compliance, ['/?tab=compliance', '/soc2']);
  assert.deepEqual(byStep.travel, ['/budgets/trips']);
  assert.deepEqual(byStep.budget, ['/personal', '/home', '/auto', '/growth', '/health', '/shopping', '/hub/itinerary', '/runway']);
  assert.deepEqual(byStep.operations, ['/agenda', '/routines', '/operations/issues', '/operations/audit-log', '/content', '/operations']);
  for (const slug of ['fpa', 'owed', 'sales', 'spend']) assert.deepEqual(byStep[slug], [], `${slug} has no door to give`);
  // no step repeats its own screen, and no href twice within a step
  for (const s of STEPS) {
    const hrefs = stepLinks(s).map((l) => (l.door.kind === 'none' ? 'none' : l.door.href));
    assert.equal(new Set(hrefs).size, hrefs.length, `${s.name}: an href once`);
    if (s.screen) assert.ok(!hrefs.includes(s.screen), `${s.name}: the step row is the screen's door`);
  }
});

test('the room at /content is labelled Narrative — label only, the route is untouched', () => {
  assert.deepEqual(ROOM_LABELS, { '/content': 'Narrative' });
  const content = stepLinks(stepBySlug('operations')!).find((l) => l.door.kind !== 'none' && l.door.href === '/content');
  assert.equal(content?.label, 'Narrative');
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Time')?.home, '/content', 'the route the registry names is unchanged');
});

test('a step names the entitlement keys its jobs are gated by — the tab keys, from the offer\'s gate map', () => {
  assert.deepEqual(stepGates(stepBySlug('books')!, TOOL_GATE), ['tab:books']);
  assert.deepEqual(stepGates(stepBySlug('accounts')!, TOOL_GATE), ['tab:books', 'tab:trade']);
  assert.deepEqual(stepGates(stepBySlug('travel')!, TOOL_GATE), []);
  assert.deepEqual(stepGates(stepBySlug('sales')!, TOOL_GATE), [], 'CRM is the founder\'s own surface (gate "owner"), not a sold tab');
});

test('the law rejects: a job in two steps, a job in no step, a numbering gap, a family out of flow order, a job in the wrong family\'s step, and a screen-none step holding a LIVE tool', () => {
  const twice = withSteps((s) => s.map((x) => (x.slug === 'trading' ? { ...x, tools: [...x.tools, 'Bookkeeping'] } : x)));
  assert.match(violations(twice), /Bookkeeping sits in 2 steps \[TRADING, BOOKS\] — a job is walked once/);
  assert.match(violations(twice), /Bookkeeping is a THE PROOF tool but sits in TRADING, a WHAT YOU OWN step/);

  const dropped = withSteps((s) => s.map((x) => (x.slug === 'books' ? { ...x, tools: [] } : x)));
  assert.match(violations(dropped), /Bookkeeping sits in no step — every job is walked/);
  assert.match(violations(dropped), /BOOKS: holds no job/);

  const gap = withSteps((s) => s.map((x) => (x.number === 5 ? { ...x, number: 6 } : x)));
  assert.match(violations(gap), /COMPLIANCE: numbered 6 at position 5 — the steps are 1\.\.12 with no gaps/);

  const outOfFlow = withSteps((s) => [s[11], ...s.slice(0, 11)].map((x, i) => ({ ...x, number: i + 1 })));
  assert.match(violations(outOfFlow), /the steps walk the families as \[THE WORK, WHAT YOU OWN, THE PROOF, WHAT YOU OWE, MONEY IN, MONEY OUT\]/);

  const split = withSteps((s) => s.map((x) => (x.slug === 'travel' ? { ...x, family: 'THE WORK' as const } : x)));
  assert.match(violations(split), /a family's steps are contiguous, in flow order/);
  assert.match(violations(split), /Travel is a MONEY OUT tool but sits in TRAVEL, a THE WORK step/);

  const hidden = withSteps((s) => s.map((x) => (x.slug === 'books' ? { ...x, screen: null } : x)));
  assert.match(violations(hidden), /BOOKS: no screen, but Bookkeeping is LIVE — a finished job has a room/);

  const dupSlug = withSteps((s) => s.map((x) => (x.slug === 'tax' ? { ...x, slug: 'books' } : x)));
  assert.match(violations(dupSlug), /TAX: duplicate slug "books"/);

  const badScreen = withSteps((s) => s.map((x) => (x.slug === 'tax' ? { ...x, screen: 'tax' } : x)));
  assert.match(violations(badScreen), /TAX: screen "tax" is not a route/);

  // the flow list itself
  assert.match(stepsLaw({ throwOnFail: false, families: FLOW_ORDER.slice(0, 5) }).join('\n'), /FLOW_ORDER is missing the family/);
  assert.match(stepsLaw({ throwOnFail: false, families: [...FLOW_ORDER, 'THE WORK'] }).join('\n'), /FLOW_ORDER repeats a family/);

  // and it throws by default
  assert.throws(() => stepsLaw({ steps: dropped }), StepsLawError);
  assert.throws(() => stepsLaw({ steps: dropped }), /STEPS LAW: /);
});
