/**
 * WEEK-02 (2026-09-30) — THIS WEEK FOR THE VIDEO: Time is its own column and
 * filters the rows (from–to, both ends included, nothing hidden silently), and a
 * done's note can be edited through the one writer and an owned, audited PATCH.
 *
 * The filter and the note rule are pure and DRIVEN over fixtures; the writer's
 * edit is driven over a stubbed fetch; the route, the table and the cell are
 * anchored to their source with comments stripped (TEST-TRUTH-01); the route's
 * writes are judged by the SEC-02 ownership reader itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import { completionNote } from '../operations/completionNote';
import { handlerIdentity, inScope, judgeWrites } from '../security/ownershipLaw';
import { editCompletionNote } from '@/components/workbench/operations/routines/completeRoutine';
import {
  filterByStart, filterWindow, hiddenLine, orderRoutines, type TimeFilter, type WeekRoutine,
} from '@/components/workbench/operations/week/weekPlan';

const RULES = 'src/components/workbench/operations/week/weekPlan.ts';
const WEEK = 'src/components/workbench/operations/week/WeekSection.tsx';
const CELL = 'src/components/workbench/operations/week/WeekCell.tsx';
const WRITER = 'src/components/workbench/operations/routines/completeRoutine.ts';
const NOTE_RULE = 'src/lib/operations/completionNote.ts';
const POST = 'src/app/api/operations/routines/[id]/completions/route.ts';
const PATCH = 'src/app/api/operations/routines/[id]/completions/[completionId]/route.ts';
const MIDDLEWARE = 'src/middleware.ts';
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20260930210000_week_02_completion_note_edited';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

const at = (clock: string | null) => (clock === null ? null : `1970-01-01T${clock}:00.000Z`);
const r = (id: string, name: string, clock: string | null): WeekRoutine => ({ id, name, start_time: at(clock), steps: [] });

// The week's rows, in orderRoutines' order: by start, then name; no start time last.
const ROWS = orderRoutines([
  r('walk', 'Walk', '17:30'),
  r('read', 'Read', null),
  r('gym', 'Gym', '07:00'),
  r('lunch', 'Lunch', '12:00'),
  r('wake', 'Wake', '06:30'),
  r('journal', 'Journal', null),
  r('coffee', 'Coffee', '09:15'),
]);
const ids = (rows: readonly WeekRoutine[]) => rows.map((x) => x.id);
const f = (from: string, to: string): TimeFilter => ({ from, to });

// ── T1 · THE FILTER (PURE) ──────────────────────────────────────────────────

test('T1 both boxes empty → every routine, in order — exactly today’s rows', () => {
  assert.deepEqual(ids(ROWS), ['wake', 'gym', 'coffee', 'lunch', 'walk', 'journal', 'read']);
  const all = filterByStart(ROWS, f('', ''));
  assert.deepEqual(ids(all.shown), ids(ROWS));
  assert.deepEqual([all.hidden, all.hiddenNoStart, all.inverted], [0, 0, false]);
  assert.equal(hiddenLine(f('', ''), all), null);
  assert.equal(filterWindow(f('', '')), null);
});

test('T1 from–to, both ends included; a missing bound is open; the order kept', () => {
  // 07:00–12:00 keeps Gym (07:00, the from end) and Lunch (12:00, the to end).
  const both = filterByStart(ROWS, f('07:00', '12:00'));
  assert.deepEqual(ids(both.shown), ['gym', 'coffee', 'lunch']);
  assert.deepEqual([both.hidden, both.hiddenNoStart, both.inverted], [4, 2, false]);
  // Just inside and just outside each end.
  assert.deepEqual(ids(filterByStart(ROWS, f('07:01', '11:59')).shown), ['coffee']);
  assert.deepEqual(ids(filterByStart(ROWS, f('06:59', '12:01')).shown), ['gym', 'coffee', 'lunch']);
  // from == to: the one routine that starts then.
  assert.deepEqual(ids(filterByStart(ROWS, f('09:15', '09:15')).shown), ['coffee']);
  // from only → start ≥ from.
  const fromOnly = filterByStart(ROWS, f('12:00', ''));
  assert.deepEqual(ids(fromOnly.shown), ['lunch', 'walk']);
  assert.deepEqual([fromOnly.hidden, fromOnly.hiddenNoStart], [5, 2]);
  // to only → start ≤ to.
  const toOnly = filterByStart(ROWS, f('', '07:00'));
  assert.deepEqual(ids(toOnly.shown), ['wake', 'gym']);
  assert.deepEqual([toOnly.hidden, toOnly.hiddenNoStart], [5, 2]);
  // The rows are the ones given, in the order given — never re-sorted, never copied into new objects.
  assert.equal(both.shown[0], ROWS[1]);
});

test('T1 a routine with no start time does not show while a box is set — counted, never silently', () => {
  const noStart = [r('read', 'Read', null), r('journal', 'Journal', null)];
  assert.equal(filterByStart(noStart, f('', '')).shown.length, 2, 'no box set → shown');
  for (const box of [f('00:00', ''), f('', '23:59'), f('00:00', '23:59')]) {
    const out = filterByStart(noStart, box);
    assert.deepEqual([out.shown.length, out.hidden, out.hiddenNoStart], [0, 2, 2]);
  }
});

test('T1 from after to → no routine shows, and the line says why', () => {
  const inverted = filterByStart(ROWS, f('22:00', '02:00'));
  assert.deepEqual(inverted.shown, []);
  assert.deepEqual([inverted.hidden, inverted.hiddenNoStart, inverted.inverted], [7, 2, true]);
  assert.equal(hiddenLine(f('22:00', '02:00'), inverted), 'from 22:00 is after to 02:00 — no routine can start in that window');
  // Midnight to midnight is not inverted — the one minute holds.
  assert.equal(filterByStart(ROWS, f('00:00', '00:00')).inverted, false);
});

test('T1 a bound that is not HH:MM throws, naming it', () => {
  for (const bad of ['7:00', '24:00', '07:60', '07:00:00', 'noon', ' 07:00']) {
    assert.throws(() => filterByStart(ROWS, f(bad, '')), new RegExp(`the time filter's from "${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" is not HH:MM`));
    assert.throws(() => filterByStart(ROWS, f('', bad)), new RegExp(`the time filter's to "${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" is not HH:MM`));
  }
  // A bad bound throws even when the rows are empty — it is never quietly ignored.
  assert.throws(() => filterByStart([], f('25:00', '')), /from "25:00"/);
  for (const good of ['00:00', '09:05', '19:59', '23:59']) assert.doesNotThrow(() => filterByStart(ROWS, f(good, good)));
});

test('T1 the hidden line: the count, "1 routine", the no-start-time count, and the window’s three word forms', () => {
  assert.equal(hiddenLine(f('07:00', '12:00'), filterByStart(ROWS, f('07:00', '12:00'))), '4 routines hidden by the time filter (07:00–12:00) · 2 with no start time');
  assert.equal(hiddenLine(f('12:00', ''), filterByStart(ROWS, f('12:00', ''))), '5 routines hidden by the time filter (from 12:00) · 2 with no start time');
  assert.equal(hiddenLine(f('', '07:00'), filterByStart(ROWS, f('', '07:00'))), '5 routines hidden by the time filter (until 07:00) · 2 with no start time');
  // One hidden, none without a start time: "1 routine", and no " · 0 with no start time".
  const two = [r('gym', 'Gym', '07:00'), r('lunch', 'Lunch', '12:00')];
  assert.equal(hiddenLine(f('08:00', ''), filterByStart(two, f('08:00', ''))), '1 routine hidden by the time filter (from 08:00)');
  // A box set and nothing hidden → no line.
  assert.equal(hiddenLine(f('00:00', ''), filterByStart(two, f('00:00', ''))), null);
  // The window's words are the Time column's own (timeWindow).
  assert.equal(filterWindow(f('07:00', '12:00')), '07:00–12:00');
  assert.equal(filterWindow(f('07:00', '')), 'from 07:00');
  assert.equal(filterWindow(f('', '12:00')), 'until 12:00');
  assert.match(code(RULES), /export const filterWindow = \(filter: TimeFilter\): string \| null => timeWindow\(asTime\(filter\.from\), asTime\(filter\.to\)\);/);
});

// ── T2 · THE NOTE RULE (PURE) ───────────────────────────────────────────────

test('T2 the one note rule: trimmed; blank, whitespace only or not a string → no note; inner newlines kept; no length limit', () => {
  assert.equal(completionNote('  Clear head.  '), 'Clear head.');
  assert.equal(completionNote(''), null);
  assert.equal(completionNote('   \n\t  '), null);
  assert.equal(completionNote('Line one.\nLine two.'), 'Line one.\nLine two.');
  assert.equal(completionNote('\n  Line one.\n\n  Line two.  \n'), 'Line one.\n\n  Line two.');
  for (const notString of [undefined, null, 42, true, {}, ['a']]) assert.equal(completionNote(notString), null);
  const long = 'x'.repeat(20_000);
  assert.equal(completionNote(long), long, 'no length limit');
  // Pure: no fetch, no prisma, no clock.
  assert.doesNotMatch(code(NOTE_RULE), /\bfetch\s*\(|prisma|Date\.now|new Date/);
});

test('T2 the POST and the PATCH both call it; the POST’s old inline rule is gone', () => {
  const post = code(POST);
  assert.match(post, /import \{ completionNote \} from '@\/lib\/operations\/completionNote';/);
  assert.match(post, /const notes = completionNote\(body\.notes\);/);
  assert.doesNotMatch(post, /body\.notes\.trim\(\)|typeof body\.notes/, 'no second copy of the rule');
  const patch = code(PATCH);
  assert.match(patch, /import \{ completionNote \} from '@\/lib\/operations\/completionNote';/);
  assert.match(patch, /const notes = completionNote\(body\.notes\);/);
  assert.doesNotMatch(patch, /\.trim\(\)/, 'the PATCH trims only through the rule');
});

// ── T3 · THE WRITER ─────────────────────────────────────────────────────────

test('T3 the writer’s edit: the PATCH’s URL, method, headers and body; ok', async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify({ completion: { id: 'c1' }, changed: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    assert.deepEqual(await editCompletionNote('r1', 'c1', 'Clear head. Ship WEEK-02.'), { ok: true });
    assert.deepEqual(await editCompletionNote('r1', 'c1', ''), { ok: true });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(sent[0].url, '/api/operations/routines/r1/completions/c1');
  assert.equal(sent[0].init.method, 'PATCH');
  assert.deepEqual(sent[0].init.headers, { 'Content-Type': 'application/json' });
  assert.equal(sent[0].init.body, '{"notes":"Clear head. Ship WEEK-02."}');
  assert.equal(sent[1].init.body, '{"notes":""}', 'an empty box is sent as it is — the route removes the note');
});

test('T3 a refusal is the route’s own words, in the POST’s order: message, else error, else the writer’s words', async () => {
  const realFetch = globalThis.fetch;
  const answer = (body: object, status: number) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    return editCompletionNote('r1', 'c1', 'x');
  };
  try {
    assert.deepEqual(await answer({ error: 'Validation', field: 'notes', message: 'required (a string — an empty one removes the note)' }, 400), { ok: false, message: 'required (a string — an empty one removes the note)' });
    assert.deepEqual(await answer({ error: 'Not found' }, 404), { ok: false, message: 'Not found' });
    assert.deepEqual(await answer({}, 500), { ok: false, message: 'failed to save the note' });
  } finally {
    globalThis.fetch = realFetch;
  }
  // The two reads are one shape: the POST's line and the edit's differ only in the writer's own words.
  const w = code(WRITER);
  assert.match(w, /if \(!res\.ok\) return \{ ok: false, message: body\?\.message \?\? body\?\.error \?\? 'failed to mark complete' \};/);
  assert.match(w, /if \(!res\.ok\) return \{ ok: false, message: body\?\.message \?\? body\?\.error \?\? 'failed to save the note' \};/);
});

test('T3 completeRoutine.ts is the only screen file that names a completions route; its header describes both writes', () => {
  const screens = [...tsFilesUnder('src/components'), ...tsFilesUnder('src/app')].filter((f) => !f.startsWith('src/app/api/'));
  assert.deepEqual(screens.filter((f) => /\/completions/.test(code(f))), [WRITER]);
  const header = comments(WRITER);
  assert.match(header, /Record a done: POST \/api\/operations\/routines\/\[id\]\/completions/);
  assert.match(header, /Edit a done's note \(WEEK-02\) — PATCH \/api\/operations\/routines\/\[id\]\/completions\/\s*\n\s*\*\s*\[completionId\] with \{ notes \}/);
  assert.match(header, /This file is the only screen file that names a\s*\n\s*\*\s*completions route\./);
});

// ── T4 · THE ROUTE (SOURCE PINS) ────────────────────────────────────────────

test('T4 the route exports PATCH and nothing else; the caller before the user, the user before any routine read', () => {
  const p = code(PATCH);
  assert.deepEqual([...p.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)].map((m) => m[1]), ['PATCH']);
  assert.doesNotMatch(p, /^export\s+(?:default|\{)/m);
  const order = [
    p.indexOf('const userEmail = await getVerifiedEmail();'),
    p.indexOf("if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });"),
    p.indexOf('const user = await prisma.users.findFirst({'),
    p.indexOf("if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });"),
    p.indexOf('prisma.operations_routines.findFirst('),
    p.indexOf('prisma.operations_routine_completions.findFirst('),
    p.indexOf('await request.json()'),
  ];
  assert.ok(order.every((i) => i >= 0), `every step is there: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in that order');
  // The SEC-02 reader agrees: identity before the first write, and every write scoped.
  assert.equal(inScope(p), true);
  const [id] = handlerIdentity(p);
  assert.equal(id.method, 'PATCH');
  assert.ok(id.identityAt !== null && id.firstWriteAt !== null && id.identityAt < id.firstWriteAt);
  const verdicts = judgeWrites(p);
  assert.equal(verdicts.length, 1, 'one write');
  assert.ok(verdicts[0].ok, `the write is owned: ${JSON.stringify(verdicts[0].values)}`);
});

test('T4 the routine by { id, user_id }, the completion by { id, routine_id, user_id } — a miss is the same 404', () => {
  const p = code(PATCH);
  assert.match(p, /const routine = await prisma\.operations_routines\.findFirst\(\{\n\s*where: \{ id: routineId, user_id: user\.id \},\n\s*\}\);\n\s*if \(!routine\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/);
  assert.match(p, /const completion = await prisma\.operations_routine_completions\.findFirst\(\{\n\s*where: \{ id: completionId, routine_id: routine\.id, user_id: user\.id \},\n\s*\}\);\n\s*if \(!completion\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/);
  assert.doesNotMatch(p, /status: 403/, 'another user’s row is a 404, never a 403');
});

test('T4 notes must be a string (400 naming the field); unchanged → no update and no audit; the update writes notes only', () => {
  const p = code(PATCH);
  assert.match(p, /if \(typeof body\.notes !== 'string'\) \{\n\s*return NextResponse\.json\(\n\s*\{ error: 'Validation', field: 'notes', message: '[^']+' \},\n\s*\{ status: 400 \}\n\s*\);/);
  assert.match(p, /if \(notes === completion\.notes\) \{\n\s*return NextResponse\.json\(\{ completion, changed: false \}\);\n\s*\}/);
  const unchangedAt = p.indexOf('if (notes === completion.notes)');
  assert.ok(unchangedAt < p.indexOf('.update('), 'the unchanged answer comes before the update');
  assert.ok(unchangedAt < p.indexOf('writeAuditLog('), 'and before the audit');
  assert.ok(p.indexOf('if (typeof body.notes') < p.indexOf('const notes = completionNote(body.notes);'), 'the 400 before the rule');
  // One write: notes only.
  assert.equal((p.match(/prisma\.\w+\.(update|updateMany|create|createMany|delete|deleteMany|upsert)\(/g) ?? []).length, 1);
  assert.match(p, /const updated = await prisma\.operations_routine_completions\.update\(\{\n\s*where: \{ id: completion\.id \},\n\s*data: \{ notes \},\n\s*\}\);/);
  assert.match(p, /return NextResponse\.json\(\{ completion: updated, changed: true \}\);/);
});

test('T4 the audit: the new action type, the routine named, before → after; failClosedResponse; not public', () => {
  const p = code(PATCH);
  assert.equal((p.match(/writeAuditLog\(/g) ?? []).length, 1);
  assert.match(p, /type: 'human_user',/);
  assert.match(p, /type: 'operations_routine_completion_note_edited',\n\s*description: `Edited the note on "\$\{routine\.name\}" \(\$\{completion\.expected_at\.toISOString\(\)\}\)`,/);
  assert.match(p, /target: \{\n\s*table: 'operations_routine_completions',\n\s*id: completion\.id,\n\s*\},/);
  assert.match(p, /before: \{ notes: completion\.notes \},\n\s*after: \{ notes \},\n\s*metadata: \{\n\s*routine_id: routine\.id,\n\s*routine_name: routine\.name,\n\s*expected_at: completion\.expected_at\.toISOString\(\),\n\s*\},/);
  assert.ok(p.indexOf('.update(') < p.indexOf('writeAuditLog('), 'the audit follows the write');
  assert.match(p, /\} catch \(error\) \{\n\s*return failClosedResponse\('Completion note PATCH', 'Failed to save the note', error\);\n\s*\}/);
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(list !== null, 'the middleware still has its PUBLIC_PATHS list');
  const publics = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const path = '/api/operations/routines/r1/completions/c1';
  assert.deepEqual(publics.filter((pub) => path === pub || path.startsWith(`${pub}/`)), [], 'no public path covers it');
  assert.doesNotMatch(mw, /completions/);
});

// ── T5 · THE TABLE ──────────────────────────────────────────────────────────

test('T5 Time is its own column: the header after Routine, the cell from timeWindow or "—", the window gone from the head', () => {
  const w = code(WEEK);
  assert.match(w, /<th className="px-2 py-1\.5 font-normal">Routine<\/th>\n\s*<th className="px-2 py-1\.5 font-normal">Time<\/th>\n\s*\{days\.map\(\(day, i\) => \(/);
  assert.match(w, /const hours = timeWindow\(r\.start_time, r\.end_time\);/);
  assert.match(w, /<td className=\{`\$\{cellClass\} font-mono whitespace-nowrap text-text-primary`\} data-week-time>\n\s*\{hours === null \? <span className="text-text-muted">—<\/span> : hours\}\n\s*<\/td>/);
  // The head: the name, the book, the figure, the refused note — and no window.
  const head = /<td className=\{`\$\{cellClass\} w-56`\} data-week-row-head>([\s\S]*?)<\/td>/.exec(w);
  assert.ok(head !== null, 'the row head is there');
  assert.doesNotMatch(head[1], /hours|timeWindow/, 'the window left the head');
  assert.match(head[1], /\{r\.name\}/);
  assert.match(head[1], /\{bookName\(r\.entity_id\)\}/);
  assert.match(head[1], /\{plannedLine\(planned\)\}/);
  assert.match(head[1], /cannot be placed — named above/);
  // The Tasks row's Time cell is "—".
  assert.match(w, /<td className=\{`\$\{cellClass\} font-bold text-text-primary`\}>Tasks<\/td>\n\s*<td className=\{cellClass\} data-week-tasks-time><span className="text-text-muted">—<\/span><\/td>/);
  // Every full-width row spans the nine columns: Routine, Time and the seven days.
  assert.equal((w.match(/colSpan=\{9\}/g) ?? []).length, 3);
  assert.doesNotMatch(w, /colSpan=\{(?!9\})\d+\}/);
});

test('T5 the filter: Show [from] to [to] clear, under the week bar; React state only', () => {
  const w = code(WEEK);
  assert.match(w, /const \[timeFrom, setTimeFrom\] = useState\(''\);\n\s*const \[timeTo, setTimeTo\] = useState\(''\);/);
  assert.match(w, /<span className="text-text-muted">Show<\/span>\n\s*<input type="time" value=\{timeFrom\} onChange=\{\(e\) => setTimeFrom\(e\.target\.value\)\}[^>]*data-week-time-from \/>\n\s*<span className="text-text-muted">to<\/span>\n\s*<input type="time" value=\{timeTo\} onChange=\{\(e\) => setTimeTo\(e\.target\.value\)\}[^>]*data-week-time-to \/>\n\s*<button type="button" className=\{chip\} disabled=\{timeFrom === '' && timeTo === ''\} onClick=\{\(\) => \{ setTimeFrom\(''\); setTimeTo\(''\); \}\}>clear<\/button>/);
  // Under the week bar ("this week"), above the table.
  assert.ok(w.indexOf('>this week</button>') < w.indexOf('data-week-time-filter'));
  assert.ok(w.indexOf('data-week-time-filter') < w.indexOf('data-week-table'));
  // ‹ › keep it: only the boxes and "clear" set it.
  assert.equal((w.match(/setTimeFrom\(/g) ?? []).length, 2);
  assert.equal((w.match(/setTimeTo\(/g) ?? []).length, 2);
  for (const f of tsFilesUnder('src/components/workbench/operations/week')) {
    assert.doesNotMatch(code(f), /localStorage|sessionStorage|document\.cookie/, `${f} stores nothing`);
  }
});

test('T5 nothing hidden silently: the line above the table, the all-hidden row; the named lists read every routine', () => {
  const w = code(WEEK);
  assert.match(w, /const rows = routines !== null && routines\.ok \? orderRoutines\(routines\.value\) : \[\];/);
  assert.match(w, /const placed = placeLines\(listedLines, rows\);\n[\s\S]*?const filter = \{ from: timeFrom, to: timeTo \};\n\s*const filtered = filterByStart\(rows, filter\);\n\s*const hidden = hiddenLine\(filter, filtered\);/);
  assert.match(w, /\{hidden !== null && <p className="text-xs text-amber-900" data-week-hidden>\{hidden\}<\/p>\}\n\s*<div className="overflow-x-auto/);
  assert.match(w, /\{rows\.length > 0 && filtered\.shown\.length === 0 && \(\n\s*<tr><td colSpan=\{9\} className=\{`\$\{cellClass\} italic text-text-muted`\} data-week-all-hidden>no routine starts in this window<\/td><\/tr>\n\s*\)\}/);
  // The rows drawn are the filtered ones; the lines are placed over every ordered routine; the refused list comes from the day reads.
  assert.match(w, /\{filtered\.shown\.map\(\(r\) => \{/);
  assert.doesNotMatch(w, /\brows\.map\(/, 'no row is drawn from the unfiltered list');
  assert.doesNotMatch(w, /placeLines\(listedLines, filtered/);
  assert.match(w, /for \(const r of read\.value\.refused\) \{/);
  assert.equal((w.match(/filtered\./g) ?? []).length, 2, 'the filter reaches only the rows drawn and the all-hidden row');
  // The Tasks row always shows: no condition before it.
  assert.match(w, /\}\)\}\n\s*<tr data-week-tasks-row>/);
});

// ── T6 · THE CELL ───────────────────────────────────────────────────────────

test('T6 "edit note" on the done branch only; the box starts with the note; save through the writer; cancel sends nothing', () => {
  const c = code(CELL);
  const doneAt = c.indexOf('<div data-week-done>');
  const notDoneAt = c.indexOf('data-week-status={entry.status}');
  const editAt = c.indexOf('data-week-edit-note');
  assert.ok(doneAt > 0 && doneAt < editAt && editAt < notDoneAt, 'inside the done branch');
  assert.equal((c.match(/data-week-edit-note>\n\s*edit note\n\s*<\/button>/g) ?? []).length, 1, 'one "edit note" button');
  assert.equal((c.match(/data-week-edit-note\b/g) ?? []).length, 1);
  // The hooks sit above the early return.
  assert.ok(c.indexOf("const [draft, setDraft] = useState('');") < c.indexOf('if (entry === undefined) {'));
  assert.ok(c.indexOf('const [editing, setEditing] = useState(false);') < c.indexOf('if (entry === undefined) {'));
  // The box holds the note, empty when there is none.
  assert.match(c, /const editNote = \(\) => \{\n\s*if \(entry\.completion === null\) throw new Error\('[^']+'\);\n\s*setDraft\(entry\.completion\.notes \?\? ''\);\n\s*setWords\(null\);\n\s*setEditing\(true\);\n\s*\};/);
  assert.match(c, /<textarea\n\s*value=\{draft\}\n\s*onChange=\{\(e\) => setDraft\(e\.target\.value\)\}/);
  // Save: the one writer, the row's routine and completion; on ok the day is read again.
  assert.match(c, /const answer = await editCompletionNote\(entry\.routine\.id, entry\.completion\.id, draft\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n\s*setEditing\(false\);\n\s*onDone\(\);/);
  assert.match(c, /onClick=\{saveNote\}/);
  // Cancel: closes the box and sends nothing.
  assert.match(c, /const cancelNote = \(\) => \{\n\s*setEditing\(false\);\n\s*setWords\(null\);\n\s*\};/);
  assert.match(c, /onClick=\{cancelNote\}/);
  // Fetch-free, and names no route.
  assert.doesNotMatch(c, /\bfetch\s*\(|\/api\//);
  assert.match(c, /import \{ completeRoutine, editCompletionNote \} from '\.\.\/routines\/completeRoutine';/);
});

test('T6 a refusal’s words show in the done branch too', () => {
  const c = code(CELL);
  const doneBranch = c.slice(c.indexOf('<div data-week-done>'), c.indexOf('data-week-status={entry.status}'));
  assert.match(doneBranch, /\{words !== null && \(\n\s*<div className="[^"]*text-red-800" data-week-refused>\{words\}<\/div>\n\s*\)\}/);
  assert.equal((c.match(/data-week-refused/g) ?? []).length, 2, 'the done branch and the not-done branch');
});

// ── T7 · THE ENUM AND THE MIGRATION ─────────────────────────────────────────

test('T7 the migration: the one ADD VALUE line and nothing else, after the last applied one', () => {
  assert.equal(code(MIGRATION).trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_completion_note_edited';`);
  assert.equal(comments(MIGRATION).trim(), '', 'not even a comment');
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20260929190000');
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
});

test('T7 the schema’s enum holds the value, last; the client knows it; the audit log lists it under operations_', () => {
  const schema = code(SCHEMA);
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  assert.equal(values[values.length - 1], 'operations_routine_completion_note_edited');
  assert.equal(values.filter((v) => v === 'operations_routine_completion_note_edited').length, 1);
  assert.equal(AuditActionType.operations_routine_completion_note_edited, 'operations_routine_completion_note_edited', 'prisma generate ran');
  assert.match(code(AUDIT_LOG), /'operations_plan_vendor_cleared',\s*'operations_routine_completion_note_edited',\s*\],/);
});
