import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { TOOL_REGISTRY } from '../toolRegistry';

/**
 * ORPHAN-01 — THE ROOM WAS DELETED AND SIX PAGES SURVIVED IT. Source reads strip
 * comment lines first, so a citation in a comment can never satisfy an
 * assertion about the code.
 */
const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

const MAPPER = 'src/lib/hub/mapOperationsRoutines.ts';
const CARD = 'src/components/hub/HubEventCard.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

// ───────────────────────────────────────────────────────────────────────────
// The two duplicates redirect, and nothing points at them any more.
// ───────────────────────────────────────────────────────────────────────────
test('the two duplicates of the deleted room are one hop to their owner', () => {
  for (const [page, home] of [
    ['src/app/operations/projects/page.tsx', '/tasks'],
    ['src/app/operations/routines/page.tsx', '/calendar'],
    ['src/app/operations/content/page.tsx', '/time'],
  ] as const) {
    assert.ok(existsSync(`${process.cwd()}/${page}`), `${page} must stay as the redirect that keeps old links working`);
    const body = code(page);
    assert.match(body, new RegExp(`redirect\\('${home}'\\)`), `${page} must hop to ${home}`);
    // A redirect carries no UI and no state — that is what makes it removable.
    assert.equal(/useState|useEffect|<[A-Z]/.test(body), false, `${page} must render nothing of its own`);
  }
});

test('a routine click lands on /calendar, not on the orphan', () => {
  const emitted = mapOperationsRoutines({
    routines: [{
      routine_id: 'r1', name: 'Gym', entity_id: 'e1', timezone: 'Asia/Bangkok',
      start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T09:00:00.000Z',
      occurrences: ['2026-08-14T00:00:00.000Z'], coa_code: '8210', budget_amount: 100,
    }],
    truncated: false,
  });
  assert.equal(emitted.length, 1);
  // The href the /hub calendar navigates a routine click with.
  assert.equal(emitted[0].href, '/calendar');
  assert.notEqual(emitted[0].href, '/operations/routines');

  // An untimed occurrence carries the same href — both branches of the mapper.
  const untimed = mapOperationsRoutines({
    routines: [{
      routine_id: 'r2', name: 'Post', entity_id: 'e1', timezone: 'UTC',
      start_time: null, end_time: null, occurrences: ['2026-08-14T00:00:00.000Z'],
      coa_code: null, budget_amount: null,
    }],
    truncated: false,
  });
  assert.equal(untimed[0].href, '/calendar');

  // And the source file holds no reference to the deleted room's page.
  assert.equal(code(MAPPER).includes('/operations/routines'), false);
});

test('the projects hop goes straight to Tasks', () => {
  const card = code(CARD);
  assert.match(card, /router\.push\('\/tasks'\)/);
  assert.equal(card.includes("'/operations/projects'"), false);
  // Tasks is the registered home of the projects pipe — the hop's destination
  // is the registry's, not a guess.
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Tasks')?.home, '/tasks');
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Calendar')?.home, '/calendar');
});

test('no code outside src/app/operations sends anyone into the deleted room', () => {
  // The registry's two links are the declared exception (issues, audit-log);
  // nothing else may point at an /operations page.
  const offenders: string[] = [];
  for (const f of [MAPPER, CARD, 'src/components/hub/HubCalendar.tsx', 'src/components/home/ModuleLauncher.tsx']) {
    const body = code(f);
    for (const m of body.matchAll(/['"`](\/operations\/[\w-]+)['"`]/g)) offenders.push(`${f} → ${m[1]}`);
  }
  assert.deepEqual(offenders, []);
});

// ───────────────────────────────────────────────────────────────────────────
// The law: registered, redirected, or named.
// ───────────────────────────────────────────────────────────────────────────
test('the law names every page: a home, a registry link, a redirect, a guest route, a shell page or an exception', () => {
  const law = code(LAW);
  assert.match(law, /const ORPHAN_EXCEPTIONS: readonly OrphanException\[\]/);
  assert.match(law, /const SHELL_PAGES: ReadonlyArray/);
  // The exception list is CLOSED and shrink-only, like the grandfather list.
  assert.match(law, /ORPHAN_EXCEPTIONS_MAX = 2/);
  assert.match(law, /it may only shrink, like the tool law's grandfather list/);
  // Every exception carries a reason AND the ruling that ends it.
  assert.match(law, /an exception without an end is a permanent one/);
  // A SHELL_PAGES entry cannot invent a door the shell does not give.
  assert.match(law, /the list may not invent a door/);
  // The two survivors are named with their TODO.
  assert.match(law, /route: '\/operations\/audit-log'/);
  assert.match(law, /route: '\/operations\/issues'/);
  assert.match(law, /ORPHAN-02/);
  // The repointed hops are held in place.
  assert.match(law, /const ORPHAN_REPOINTED/);
  assert.match(law, /gone: '\/operations\/routines', home: '\/calendar'/);
  assert.match(law, /gone: '\/operations\/projects', home: '\/tasks'/);
});

test('the survivors are the registry\'s, and the registry still says so', () => {
  // STEP 0.3's answer: Tasks owns both, by its own links — not Compliance,
  // not nothing.
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks');
  assert.deepEqual((tasks?.links ?? []).map((l) => l.href), ['/operations/issues', '/operations/audit-log']);
  // /operations itself is gone — no page, and no tool claims it.
  assert.equal(existsSync(`${process.cwd()}/src/app/operations/page.tsx`), false);
  assert.equal(TOOL_REGISTRY.some((t) => t.home === '/operations'), false);
});

test('why the law missed them, recorded where the next reader will look', () => {
  const law = src(LAW);
  // The predicate that made an unregistered page invisible, named in the law.
  assert.match(law, /screenTools` is built ONLY from registry rows/);
  assert.match(law, /not a tool's page/);
  // And the gap this law fills: reachability fires at the first gate, so a
  // page with no door never reaches here — the new case is a DOORED page that
  // belongs to nobody.
  assert.match(law, /fires at the FIRST gate/);
});
