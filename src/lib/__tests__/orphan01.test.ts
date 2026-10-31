import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { TOOL_REGISTRY } from '../toolRegistry';
import { code, comments } from '../sourceText';

/**
 * ORPHAN-01 — THE ROOM WAS DELETED AND SIX PAGES SURVIVED IT. Source reads strip
 * comment lines first, so a citation in a comment can never satisfy an
 * assertion about the code.
 */

const MAPPER = 'src/lib/hub/mapOperationsRoutines.ts';
const CARD = 'src/components/hub/HubEventCard.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

// ───────────────────────────────────────────────────────────────────────────
// The two duplicates redirect, and nothing points at them any more.
// ───────────────────────────────────────────────────────────────────────────
test('the two duplicates of the deleted room are one hop to their owner', () => {
  for (const [page, home] of [
    ['src/app/operations/projects/page.tsx', '/tasks'],
    ['src/app/operations/routines/page.tsx', '/tasks'],  // PLAN-01: the builder moved
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
  // TASKS-ONE-01 (2026-10-14): it shrank — the issue log's page is deleted — and the maximum came down to the one
  // survivor with it (2 → 1, set that day), as TRIPS_PATH_TESTS_MAX came down when that list emptied.
  // TASKS-02 (2026-10-20): it emptied — the audit trail is Compliance's link (branch 2) — and the maximum came down
  // to 0, set that day. The list has nowhere left to go.
  assert.match(law, /const ORPHAN_EXCEPTIONS: readonly OrphanException\[\] = \[\] as const;/);
  assert.match(law, /ORPHAN_EXCEPTIONS_MAX = 0;/);
  assert.match(law, /ORPHAN_EXCEPTIONS_SET_ON = '2026-10-20';/);
  assert.match(law, /it may only shrink, like the tool law's grandfather list/);
  // Every exception carries a reason AND the ruling that ends it.
  assert.match(law, /an exception without an end is a permanent one/);
  // A SHELL_PAGES entry cannot invent a door the shell does not give.
  assert.match(law, /the list may not invent a door/);
  // The two survivors are named with their TODO.
  // TASKS-ONE-01 (2026-10-14): one survivor — ORPHAN-02's answer for the issue log was deletion, so its entry left
  // the list; the pin holds that it stays gone.
  // TASKS-02 (2026-10-20): no survivor — ORPHAN-02's answer for the audit trail is Compliance; its entry left the
  // list too, and the dated note records both answers. The pins hold that neither entry returns.
  assert.doesNotMatch(law, /route: '\/operations\/audit-log'/);
  assert.doesNotMatch(law, /route: '\/operations\/issues'/);
  // ORPHAN-02 was the `todo` of the last entry (code); with the list empty it is history (a comment).
  assert.doesNotMatch(law, /ORPHAN-02/);
  assert.match(comments(LAW), /ORPHAN-02/);
  assert.match(comments(LAW), /TASKS-02 \(Alex, 2026-10-20\): ORPHAN-02's answer for the audit trail — it\s*\n\s*\* belongs to Compliance\./);
  // The repointed hops are held in place.
  assert.match(law, /const ORPHAN_REPOINTED/);
  assert.match(law, /gone: '\/operations\/routines', home: '\/calendar'/);
  assert.match(law, /gone: '\/operations\/projects', home: '\/tasks'/);
});

test('the survivor is the registry\'s, and the registry still says so', () => {
  // STEP 0.3's answer: Tasks owns both, by its own links — not Compliance,
  // not nothing.
  // NORTH-01: the North Star is the third, reached the same way.
  // DAYCARD-01 (2026-10-11): the day card is the fourth, reached the same way.
  // TASKS-ONE-01 (2026-10-14): two — the Issue log's page is deleted; the day card is the first section of /tasks.
  // TASKS-02 (2026-10-20): STEP 0.3's answer is overruled — the one survivor, the audit trail, is COMPLIANCE's, by
  // its own link; Tasks links nothing and the North Star's page is deleted.
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks');
  const compliance = TOOL_REGISTRY.find((t) => t.name === 'Compliance');
  assert.deepEqual((tasks?.links ?? []).map((l) => l.href), []);
  assert.deepEqual((compliance?.links ?? []).map((l) => l.href), ['/soc2', '/operations/audit-log']);
  // /operations itself is gone — no page, and no tool claims it.
  assert.equal(existsSync(`${process.cwd()}/src/app/operations/page.tsx`), false);
  assert.equal(TOOL_REGISTRY.some((t) => t.home === '/operations'), false);
});

test('why the law missed them, recorded where the next reader will look', () => {
  // TEST-TRUTH-01: the law's RECORD of why it missed them is prose by nature —
  // read it as prose and say so. The law's behaviour is asserted from code below.
  // All three of these are the law's WRITTEN RECORD of why it missed the six —
  // every one lives in a comment, and every one was asserted against the raw file.
  const lawNotes = comments(LAW);
  // The predicate that made an unregistered page invisible, named in the law.
  assert.match(lawNotes, /screenTools` is built ONLY from registry rows/);
  assert.match(lawNotes, /not a tool's page/);
  // And the gap this law fills: reachability fires at the first gate, so a
  // page with no door never reaches here — the new case is a DOORED page that
  // belongs to nobody.
  assert.match(lawNotes, /fires at the FIRST gate/);
  // The record is not the law. What the law DOES is asserted from its code: the
  // orphan pass exists, and its two lists are the ones ORPHAN-01 named.
  const law = code(LAW);
  assert.match(law, /SHELL_PAGES/);
  assert.match(law, /ORPHAN_EXCEPTIONS/);
});
