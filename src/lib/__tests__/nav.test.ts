import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  HOME_ANSWER, HOME_PHASES, NavLawError, THE_SORT,
  navFamilies, navLaw, navRows, navToolByName, navToolsOfScreen, phasesOf,
} from '../nav';
import { PIPE_PHASES } from '../pipePhases';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';

// NAV-25 — the rail is the sheet: six families, twenty-five tools, one pipe per tool.

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
const model = () => navFamilies(TOOL_GATE).map((f) => ({ name: f.name, tools: [...f.tools] }));

test('the rail IS the registry — twenty-five rows, six families, both in registry order', () => {
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const rows = navRows(TOOL_GATE);
  assert.equal(rows.length, 25);
  // Name AND order, against the registry itself — nothing retyped.
  assert.deepEqual(rows.map((t) => t.name), TOOL_REGISTRY.map((t) => t.name));
  assert.deepEqual(rows.map((t) => t.n), TOOL_REGISTRY.map((_, i) => i + 1));
  assert.deepEqual(
    navFamilies(TOOL_GATE).map((f) => f.name),
    [...new Set(TOOL_REGISTRY.map((t) => t.family))],
  );
  // The families the registry actually holds, in the order NAV-25 ruled.
  assert.deepEqual(navFamilies(TOOL_GATE).map((f) => f.name),
    ['THE WORK', 'MONEY IN', 'MONEY OUT', 'WHAT YOU OWN', 'WHAT YOU OWE', 'THE PROOF']);
});

test('a not-built tool is a row with a status chip and no link — never a placeholder page', () => {
  const unbuilt = navRows(TOOL_GATE).filter((t) => t.status === 'NOT_BUILT');
  assert.equal(unbuilt.length, 14, 'the census stands: 14 NOT_BUILT');
  for (const t of unbuilt) {
    assert.equal(t.href, null, `${t.name} opens nothing`);
    assert.equal(t.phases.length, 0, `${t.name} owns no phase`);
  }
  // The steps layer's honest page is gone with the steps.
  assert.ok(!existsSync(`${process.cwd()}/src/app/step`), '/step/[slug] is deleted');
  assert.ok(!existsSync(`${process.cwd()}/src/lib/steps.ts`), 'steps.ts is deleted');
  assert.ok(!existsSync(`${process.cwd()}/src/components/shell/StepOpener.tsx`), 'StepOpener is deleted');
});

test('every phase of every pipe belongs to exactly one owner', () => {
  const total = Object.values(PIPE_PHASES).reduce((n, ps) => n + ps.length, 0);
  assert.equal(total, 49);
  assert.equal(THE_SORT.length, 49, 'the sort covers every phase, once');
  const owned = navRows(TOOL_GATE).reduce((n, t) => n + t.phases.length, 0) + HOME_PHASES.length;
  assert.equal(owned, 49);
  // Every phase key appears exactly once across the sort.
  const keys = THE_SORT.map((a) => `${a.pipe} ${a.num}`);
  assert.equal(new Set(keys).size, 49);
  // The one non-tool owner, and what it serves.
  assert.deepEqual(HOME_PHASES.map((p) => `${p.pipe} ${p.num}`), ['runway 02', 'runway 03']);
  assert.equal(HOME_ANSWER, 'How long can I last?');
  assert.deepEqual(phasesOf('Tax', THE_SORT).map((p) => p.num), ['01', '02', '03', '04', '05', '06', '07']);
});

test('THE SORT splits a pipe only at an existing phase boundary — no phase cut, renamed or duplicated', () => {
  for (const [pid, phases] of Object.entries(PIPE_PHASES)) {
    const rows = THE_SORT.filter((a) => a.pipe === pid);
    // every number of the pipe, in the pipe's own order, unrenamed
    assert.deepEqual(rows.map((a) => a.num), phases.map((p) => p.num), `${pid} keeps its numbering`);
    // owners appear in contiguous runs — a split is a boundary, never interleaving
    const owners = rows.map((a) => a.owner);
    const runs = owners.filter((o, i) => o !== owners[i - 1]);
    assert.equal(new Set(runs).size, runs.length, `${pid} splits at a boundary, not into interleaved pieces`);
  }
  // The names a screen renders are pipePhases.ts's, never retyped.
  for (const t of navRows(TOOL_GATE)) {
    for (const p of t.phases) {
      const real = (PIPE_PHASES[p.pipe] as readonly { num: string; name: string }[]).find((x) => x.num === p.num);
      assert.equal(p.name, real?.name, `${p.pipe} ${p.num} keeps its name`);
    }
  }
});

test('the two phases that render no surface say so, and cite where the code declares it', () => {
  const silent = THE_SORT.filter((a) => !a.rendersSurface);
  assert.deepEqual(silent.map((a) => `${a.pipe} ${a.num}`), ['runway 01', 'runway 02']);
  for (const a of silent) {
    assert.match(a.surfaceNote ?? '', /ModuleLauncher\.tsx:\d+/, 'the citation names the file and line');
  }
  // And the code still says it — the citation is not a memory of one.
  assert.match(src('src/components/home/ModuleLauncher.tsx'), /STATE-ONLY cells/);
});

test('a tool sharing a screen still has its own row and its own destination', () => {
  assert.deepEqual(navToolsOfScreen('/operations', TOOL_GATE).map((t) => t.name), ['Tasks', 'Time']);
  assert.deepEqual(navToolsOfScreen('/trading', TOOL_GATE).map((t) => t.name), ['Brokerage', 'Trade Log']);
  // Compliance opens its OWN page, not the cockpit carve-out — nine child pages hang off it.
  assert.equal(navToolByName('Compliance', TOOL_GATE).href, '/compliance');
  assert.throws(() => navToolByName('Chart of accounts', TOOL_GATE), NavLawError);
});

test('every legacy page hangs under the tool that OWNS it — never another tool\'s screen', () => {
  const subs = Object.fromEntries(navRows(TOOL_GATE).filter((t) => t.subRows.length).map((t) => [t.name, t.subRows.map((r) => r.door.href)]));
  assert.deepEqual(subs, {
    Travel: ['/budgets/trips'],
    Budget: ['/shopping', '/hub/itinerary', '/runway'],
    Bookkeeping: ['/chart-of-accounts'],
    Tax: ['/dashboard/tax-filing'],
    Compliance: ['/soc2'],
  });
  // The law that keeps it so: a sub-row may never point at another tool's screen.
  const hung = model();
  const banking = hung.flatMap((f) => f.tools).find((t) => t.name === 'Banking')!;
  banking.subRows = [{ label: 'Bookkeeping pipe', door: { kind: 'route', href: '/books' } }];
  assert.throws(() => navLaw({ gate: TOOL_GATE, families: hung }), NavLawError);
});

test('the law throws on a reordered family, a legacy row, and a phase owned by nothing, two things, or a second non-tool', () => {
  const reordered = model();
  const own = reordered.find((f) => f.name === 'WHAT YOU OWN')!;
  [own.tools[3], own.tools[4]] = [own.tools[4], own.tools[3]];
  assert.throws(() => navLaw({ gate: TOOL_GATE, families: reordered }), NavLawError, 'a reordered family');

  const legacy = model();
  legacy[0].tools.push({ ...legacy[0].tools[0], n: 26, name: 'Chart of accounts' as never });
  assert.throws(() => navLaw({ gate: TOOL_GATE, families: legacy }), NavLawError, 'a legacy row');

  assert.throws(() => navLaw({ sort: [...THE_SORT, { pipe: 'books', num: '01', owner: 'Bookkeeping', rendersSurface: true }] }), NavLawError, 'two owners');
  assert.throws(() => navLaw({ sort: THE_SORT.filter((a) => !(a.pipe === 'tax' && a.num === '07')) }), NavLawError, 'no owner');
  assert.throws(() => navLaw({ sort: THE_SORT.map((a) => (a.pipe === 'content' && a.num === '01' ? { ...a, owner: 'DECK' as never } : a)) }), NavLawError, 'a second non-tool owner');
  assert.throws(() => navLaw({ gate: TOOL_GATE, sort: THE_SORT.map((a) => (a.pipe === 'travel' && a.num === '04' ? { ...a, owner: 'Expenses' as never } : a)) }), NavLawError, 'a phase under a not-built tool');
  assert.throws(() => navLaw({ sort: THE_SORT.map((a) => (a.pipe === 'runway' && a.num === '01' ? { ...a, surfaceNote: undefined } : a)) }), NavLawError, 'an uncited surfaceless phase');
});

test('the rail and the sheet render from nav.ts, and "STEP N" is gone from the app', () => {
  for (const f of ['src/components/shell/Rail.tsx', 'src/components/shell/TheSheet.tsx']) {
    assert.match(code(f), /navFamilies\(/, `${f} maps the model`);
    assert.match(code(f), /from '@\/lib\/nav'/);
  }
  assert.ok(!/(?:local|session)Storage\s*[.[]/.test(code('src/components/shell/Rail.tsx')), 'no browser storage');
  // The opener names the TOOL now.
  const opener = code('src/components/shell/ToolOpener.tsx');
  assert.ok(!/Step \{/.test(opener) && !opener.includes('STEP N'), 'no step number in the opener');
  assert.match(opener, /data-tool-opener/);
});
