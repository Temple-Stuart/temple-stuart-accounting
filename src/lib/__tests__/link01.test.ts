import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_TEXT_RULE, linkedSourceLine, sumLinks, typedVsLinked, variance } from '../calendar/links';
import { LINKABLE_KINDS, isLinkableKind, parseRoutineTileId, requiresInstant } from '../calendar/linkKeys';
import { KIND_FACTS, buildChain, ChainLawError } from '../calendar/chain';
import { code } from '../sourceText';

// LINK-01 — the actual is linked, not guessed.

const ROUTE = 'src/app/api/calendar/links/route.ts';
const MIGRATION = 'prisma/migrations/20260917120000_link_01_planned_item_links/migration.sql';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';

test('linking a posting fills the actual and the state flips to PLANNED AND SETTLED', () => {
  const none = sumLinks([]);
  assert.equal(none.actual, null, 'zero links is NOT an actual of zero');
  assert.equal(buildChain({ kind: 'calendar_event', planned: 300, actual: none.actual })!.state, 'NOT_LINKED');

  const one = sumLinks([{ journalEntryId: 'je1', date: '2026-09-19', description: 'Barber', amountCents: 30000 }]);
  assert.equal(one.actual, 300);
  assert.equal(one.count, 1);
  assert.equal(one.complete, true);
  const chain = buildChain({ kind: 'calendar_event', planned: 350, actual: one.actual, actualSource: 'linked', linkLine: linkedSourceLine(one) })!;
  assert.equal(chain.state, 'PLANNED_AND_SETTLED');
  assert.equal(chain.actualSource, 'linked');
  assert.match(chain.line, /linked to 1 posting in Books/);
  assert.equal(variance(350, one.actual), 50, 'the variance is planned minus actual');
});

test('an item may have MANY postings — the actual is their sum', () => {
  const two = sumLinks([
    { journalEntryId: 'a', date: '2026-09-01', description: 'Hotel deposit', amountCents: 12000 },
    { journalEntryId: 'b', date: '2026-09-19', description: 'Hotel balance', amountCents: 30000 },
  ]);
  assert.equal(two.actual, 420);
  assert.equal(two.counted, 2);
  assert.match(linkedSourceLine(two), /linked to 2 postings in Books/);
});

test('unlinking returns the item to NOT LINKED, never $0', () => {
  const after = sumLinks([]);
  assert.equal(after.actual, null);
  const chain = buildChain({ kind: 'calendar_event', planned: 300, actual: after.actual })!;
  assert.equal(chain.state, 'NOT_LINKED');
  assert.notEqual(chain.state, 'PLANNED_AND_SETTLED');
  assert.doesNotMatch(chain.line, /\$0/);
});

test('a posting with no readable amount is REPORTED, not summed as zero (the EDGE-01 bug, inverted)', () => {
  const mixed = sumLinks([
    { journalEntryId: 'good', date: '2026-09-19', description: 'Barber', amountCents: 30000 },
    { journalEntryId: 'bad', date: '2026-09-19', description: 'Broken entry', amountCents: null },
  ]);
  assert.equal(mixed.actual, 300, 'the readable posting alone — the null did NOT add 0');
  assert.equal(mixed.count, 2);
  assert.equal(mixed.counted, 1);
  assert.deepEqual(mixed.unreadable, ['bad']);
  assert.equal(mixed.complete, false, 'a sum missing a posting is never called complete');
  assert.match(linkedSourceLine(mixed), /carry no readable amount and are NOT in this total \(bad\)/);
  // Every link unreadable → no actual at all, rather than 0.
  const allBad = sumLinks([{ journalEntryId: 'x', date: '2026-09-19', description: 'y', amountCents: null }]);
  assert.equal(allBad.actual, null);
  // And the source it must never copy is named in this repo, still.
  assert.match(code('src/app/api/trade-card-links/route.ts'), /realized_pl \?\? 0/, 'the EDGE-01 bug is still there to be avoided');
});

test('a routine occurrence is addressed on its INSTANT, and a link on the wrong instant does not match', () => {
  assert.equal(requiresInstant('routine'), true);
  assert.equal(requiresInstant('calendar_event'), false);
  assert.equal(requiresInstant('project_task'), false);

  const tile = parseRoutineTileId('routine:11111111-1111-1111-1111-111111111111:2026-09-19T00:00:00.000Z');
  assert.deepEqual(tile, { routineId: '11111111-1111-1111-1111-111111111111', instant: '2026-09-19T00:00:00.000Z' });
  // A DATE is not an instant: two occurrences of a daily routine share a date and
  // differ by instant, so a date key would match the wrong one.
  const monday = parseRoutineTileId('routine:r1:2026-09-19T00:00:00.000Z')!;
  const tuesday = parseRoutineTileId('routine:r1:2026-09-20T00:00:00.000Z')!;
  assert.equal(monday.routineId, tuesday.routineId);
  assert.notEqual(monday.instant, tuesday.instant, 'the instant is what tells them apart');
  assert.equal(parseRoutineTileId('routine:r1:not-a-time'), null, 'an unparseable instant links nothing');
  assert.equal(parseRoutineTileId('e-123'), null);
  // The completions table this borrows its key from is still keyed the same way.
  assert.match(code('prisma/schema.prisma'), /@@unique\(\[routine_id, expected_at\]\)/);
});

test('the kinds that can be linked are exactly the census\'s linkable ones', () => {
  const linkable = KIND_FACTS.filter((f) => f.linkable).map((f) => f.kind).sort();
  // LINES-01: 'routine_line' is a finer GRAIN of the 'routine' kind — a line of an
  // occurrence — not a kind of row on the day, so it has no census row of its own.
  // Every census-linkable kind is a link kind, and the one extra is that grain.
  for (const k of linkable) assert.ok((LINKABLE_KINDS as readonly string[]).includes(k), `${k} is a link kind`);
  assert.deepEqual([...LINKABLE_KINDS].filter((k) => !(linkable as string[]).includes(k)), ['routine_line']);
  for (const k of LINKABLE_KINDS) assert.ok(isLinkableKind(k));
  assert.equal(isLinkableKind('task'), false, 'a daily-plan task is a Json line with no id of its own');
  assert.equal(isLinkableKind('trade'), false, 'no trade row reaches the grid');
  // A linked actual on an unlinkable kind fails loud rather than rendering.
  assert.throws(() => buildChain({ kind: 'task', planned: 10, actual: 10, actualSource: 'linked' }), ChainLawError);
  assert.throws(() => buildChain({ kind: 'task', planned: 10, actual: 10, actualSource: 'linked' }), /nothing can be linked to it/);
});

test('a second user can neither see, create nor delete a link', () => {
  const route = code(ROUTE);
  // Every verb scopes by the caller's id and answers 401 without one.
  for (const verb of ['GET', 'POST', 'DELETE']) {
    const at = route.indexOf(`export async function ${verb}(`);
    assert.ok(at > 0, `${verb} exists`);
    const next = route.indexOf('export async function', at + 1);
    const body = route.slice(at, next < 0 ? undefined : next);
    assert.match(body, /const user = await caller\(\)/, `${verb} identifies the caller`);
    assert.match(body, /status: 401/, `${verb} refuses an anonymous caller`);
    assert.match(body, /user_id: user\.id|userId: user\.id/, `${verb} is user-scoped`);
    assert.doesNotMatch(body, /status: 403/, `${verb} uses a defensive 404, not a 403`);
  }
  // The posting must be the caller's before a link is made at all.
  assert.match(route, /prisma\.journal_entries\.findFirst\(\{\s*where: \{ id: body\.journalEntryId, userId: user\.id \}/);
  assert.match(route, /'No such posting'[\s\S]{0,40}status: 404/);
  // The delete is scoped in its WHERE, so another user's link is simply not found.
  assert.match(route, /deleteMany\(\{\s*where: \{ journal_entry_id: journalEntryId, user_id: user\.id \}/);
});

test('nothing suggests a match — the candidate list is date-ordered and nothing is pre-selected', () => {
  const route = code(ROUTE);
  for (const banned of ['confidence', 'matchRationale', 'score', 'probable', 'suggest']) {
    assert.doesNotMatch(route, new RegExp(`\\b${banned}`, 'i'), `${banned} is a matcher word`);
  }
  assert.match(route, /orderBy: \{ date: 'desc' \}/);
  const panel = code(PANEL);
  assert.match(panel, /data-drill-no-suggestion/, 'the panel says outright that nothing is suggested');
  assert.doesNotMatch(panel, /defaultChecked|autoSelect|selected=\{true\}/, 'nothing is pre-selected');
  // The repo's OTHER link table does carry a matcher — the shape this refuses.
  assert.match(code('prisma/schema.prisma'), /model transaction_reservation_links[\s\S]{0,900}confidence/);
});

test('the cardinality is the database\'s: one item may have many postings, a posting at most one item', () => {
  const m = code(MIGRATION);
  assert.match(m, /CREATE UNIQUE INDEX "planned_item_links_one_item_per_posting"[\s\S]{0,120}\("journal_entry_id"\)/);
  // No unique on the TARGET — an item may have several postings.
  assert.doesNotMatch(m, /UNIQUE INDEX[^\n]*\("target_kind", "target_id"\)\s*;/);
  // The route states the rule before the database has to refuse it.
  assert.match(code(ROUTE), /status: 409/);
  assert.match(code(ROUTE), /ALLOC-01/, 'and names the ruling that a genuinely shared posting needs');
});

test('the migration is authored with its constraints, and nothing is backfilled', () => {
  const m = code(MIGRATION);
  assert.match(m, /CREATE TABLE "planned_item_links"/);
  assert.match(m, /CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine'\)\)/);
  assert.match(m, /CHECK \(\("target_kind" = 'routine'\) = \("target_instant" IS NOT NULL\)\)/);
  assert.match(m, /REFERENCES "journal_entries"\("id"\) ON DELETE RESTRICT/);
  assert.match(m, /REFERENCES "users"\("id"\) ON DELETE CASCADE/);
  for (const col of ['"user_id"', '"target_kind"', '"target_id"', '"journal_entry_id"']) {
    assert.match(m, new RegExp(`${col}\\s+\\w+[^,]*NOT NULL`), `${col} is NOT NULL`);
  }
  // No backfill, no UPDATE, no INSERT of invented links.
  assert.doesNotMatch(m, /INSERT INTO "planned_item_links"/);
  // A data UPDATE, not the FKs' `ON UPDATE CASCADE`.
  assert.doesNotMatch(m, /(^|\n)\s*UPDATE\s+"/);
  // The schema and the migration moved together.
  assert.match(code('prisma/schema.prisma'), /model planned_item_links/);
  assert.match(code('prisma/schema.prisma'), /journal_entry_id String\s+@unique/);
});

test('the free-text conflict is shown, named and never overwritten', () => {
  assert.equal(typedVsLinked(219.4, 300), true);
  assert.equal(typedVsLinked(300, 300), false);
  assert.equal(typedVsLinked(null, 300), false, 'no typed figure is no conflict');
  assert.equal(typedVsLinked(300, null), false, 'no links is no conflict');
  assert.match(FREE_TEXT_RULE, /the links are the actual/);
  assert.match(FREE_TEXT_RULE, /awaiting a ruling/, 'it is proposed, not decided');
  const panel = code(PANEL);
  assert.match(panel, /data-drill-conflict/);
  assert.match(panel, /FREE_TEXT_RULE/);
  // The typed column is never written by this PR.
  assert.doesNotMatch(panel, /actual_cost_usd/);
  assert.doesNotMatch(code(ROUTE), /actual_cost_usd/);
});

test('the variance is null unless BOTH figures are known', () => {
  assert.equal(variance(350, 300), 50);
  assert.equal(variance(null, 300), null);
  assert.equal(variance(350, null), null, 'a variance against an unknown actual would be the plan wearing a second name');
  assert.equal(variance(300, 300), 0, 'a real zero variance is a number, and is kept');
});
