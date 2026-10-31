/**
 * JOURNAL-07 (Alex, 2026-10-24) — THE JOURNALS DAY OVER DAY ON TIME.
 *
 * Rulings: A one new read-only route (GET /api/operations/journal/range?from&to — the ledger route's auth order, the
 * ledger's spanInput, findMany user-scoped in day order, each row through journalRowOf; the day GET and the PUT
 * untouched) plus, ruled 1(b), first_day so ALL can start at the first journal; B two sections on /time under the
 * ledger, MorningJournalTable then EveningJournalTable, each the ledger's shape (the period control copied verbatim,
 * DataTable with name journal-morning / journal-evening, filters, sort, CSV), read-only; C the columns — MORNING DAY ·
 * DATE · GOALS · BLOCKER · PLAN · DONE, EVENING DAY · DATE · ACCOMPLISHED · GAPS · EVOLUTION · DIRECTION · ALIGNMENT ·
 * ON TRACK · NEXT; D rows = the days that have a journal, the "<n> of <m> days" line, "—" for null and empty in the
 * CSV, zero rows loaded the ledger's idiom (ruled 2(a)); E long text — 160 code points, "… (<n> chars)", "all of it" /
 * "less" (ruled 5), the CSV whole, filters on the full text; F the registry prose untouched, TIME_MOUNTS gains the two.
 * Rulings 3 and 4: PLAN lines through the card's planStepWords (the index included), DONE "2 of 3" via doneWords.
 *
 * The pure builders (src/lib/operations/journalTables.ts) are DRIVEN over fixtures in JournalRow's shape; the route,
 * the sections, the page and the law are anchored to their source with comments stripped (TEST-TRUTH-01). The day
 * route is pinned byte for byte by the hash of its code — journal06 T11's intent restated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, comments } from '../sourceText';
import { EVENING_LABELS, EVENING_ORDER, RETIRED_FIELDS, planStepWords, type JournalRow } from '../operations/journal';
import { LEDGER_SPAN_MAX_DAYS, periodWords, spanInput } from '../operations/ledger';
import { TOOL_REGISTRY } from '../toolRegistry';
import { csvField, tableCsv } from '../table/csv';
import { filterRows, noFilters } from '../table/filters';
import { sortRows } from '../table/sort';
import { BLANK } from '../table/words';
import {
  COLLAPSE_WORDS, EVENING_COLUMNS, EVENING_HEAD_WORDS, EVENING_TABLE, EXPAND_WORDS, JOURNALS_LOADING_WORDS, JOURNAL_TABLES, JOURNAL_TABLE_KINDS, JOURNAL_TITLE_WORDS,
  MORNING_COLUMNS, MORNING_HEAD_WORDS, MORNING_TABLE, NO_FIRST_JOURNAL_WORDS, PREVIEW_CHARS, cellKeyOf, daysWithJournalWords, doneCellWords, doneWords, goalsText,
  journalCsvFileName, journalDayRows, journalsFailedWords, noJournalWords, planText, previewMoreWords, previewOf, ticksOf,
} from '../operations/journalTables';

const RANGE_ROUTE = 'src/app/api/operations/journal/range/route.ts';
const DAY_ROUTE = 'src/app/api/operations/journal/route.ts';
const RULES = 'src/lib/operations/journalTables.ts';
const READS = 'src/components/workbench/operations/journal/journalReads.ts';
const TABLE = 'src/components/workbench/operations/journal/JournalDayTable.tsx';
const MORNING = 'src/components/workbench/operations/journal/MorningJournalTable.tsx';
const EVENING = 'src/components/workbench/operations/journal/EveningJournalTable.tsx';
const LEDGER_SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const MIDDLEWARE = 'src/middleware.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
/** The day route's code as it stood on origin/main 024895cd (#1847 merged) — the file this PR does not touch (ruling A; journal06 T11). */
const DAY_ROUTE_SHA256 = '31ba6039f01d3c7e41dbc528830c8446f7fc0410cd98bcd30043e42541e6f793';

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── THE FIXTURE: four journal rows, in the route's day order ────────────────

const retired = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, null])) as JournalRow['retired'];
const row = (over: Partial<JournalRow> & { readonly id: string; readonly day: string }): JournalRow => ({
  goals: [], blocker: null, plan_steps: [], plan_done: [], audit: null, gaps: null, evolution: null, direction: null, alignment: null, on_track: null, next: null,
  typed_at: `${over.day}T22:00:00.000Z`, retired, ...over,
});
const LONG = 'A'.repeat(100) + 'é'.repeat(60) + 'B'.repeat(40); // 200 code points, 260 UTF-16 units? no — é is one unit; the point is code points
/** Friday: goals, a blocker, a plan of three with two ticks, a 200-code-point accomplished with a line break, gaps with a comma and a quote. */
const FRIDAY = row({ id: 'f', day: '2026-10-02', goals: ['perfect the day cards', 'book travel'], blocker: 'the flight sale ends', plan_steps: ['merge TABLE-01', 'book travel', 'record brunch'], plan_done: [true, true, false], audit: `${LONG}\nline two`, gaps: 'the vendor box, "stranded" vendors', next: 'HOME-01' });
/** Saturday: goals alone — no blocker, no plan, no evening. */
const SATURDAY = row({ id: 's', day: '2026-10-03', goals: ['rest'] });
/** Sunday: a plan all done, an evening without gaps. */
const SUNDAY = row({ id: 'u', day: '2026-10-04', plan_steps: ['walk'], plan_done: [true], audit: 'walked', on_track: 'yes' });
/** Monday: only a blocker. */
const MONDAY = row({ id: 'm', day: '2026-10-05', blocker: 'none' });
const JOURNALS: readonly JournalRow[] = [FRIDAY, SATURDAY, SUNDAY, MONDAY];
const ROWS = journalDayRows(JOURNALS);
const ids = (rows: readonly { readonly id: string }[]): string[] => rows.map((r) => r.id);

// ── T1 · THE RANGE ROUTE ────────────────────────────────────────────────────

test('T1 the range route: GET only; the ledger route’s auth order (401 → 404) before any read; the span by the ledger’s one rule (400 naming the field); every query by user_id; the rows in day order through journalRowOf; first_day the caller’s earliest or null; not public', () => {
  const r = code(RANGE_ROUTE);
  assert.match(r, /export async function GET\(request: NextRequest\)/);
  assert.doesNotMatch(r, /export async function (PUT|POST|PATCH|DELETE)\b/, 'read-only — the card writes');
  inOrder(r, [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));",
    "if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });",
    'prisma.operations_day_journals.findMany({ where: { user_id: user.id, day: { gte: asJournalDate(from), lte: asJournalDate(to) } }, orderBy: { day: \'asc\' } })',
    "prisma.operations_day_journals.findFirst({ where: { user_id: user.id }, orderBy: { day: 'asc' }, select: { day: true } })",
    "return NextResponse.json({ from, to, first_day: first === null ? null : first.day.toISOString().slice(0, 10), journals: rows.map(journalRowOf) });",
  ], 'the auth order, the span, the two user-scoped reads, the answer');
  assert.match(r, /import \{ spanInput \} from '@\/lib\/operations\/ledger';/, 'the ledger’s rule, not a second one');
  assert.doesNotMatch(r, /\$queryRaw|\$executeRaw|\.update\(|\.create\(|\.delete\(|writeAuditLog/, 'nothing written, nothing raw');
  assert.match(r, /failClosedResponse\('Journal range GET', 'Failed to load the journals', error\)/);
  assert.match(comments(RANGE_ROUTE), /JOURNAL-07, Alex, 2026-10-24/);
  // The span rule the route calls: real days, in order, at most 400 — the first bad one named.
  assert.deepEqual(spanInput('2025-01-01', '2026-06-01'), { ok: false, field: 'to', message: `from and to span 517 days — at most ${LEDGER_SPAN_MAX_DAYS}` });
  assert.deepEqual(spanInput('2026-10-01', '2026-10-31'), { ok: true, from: '2026-10-01', to: '2026-10-31' });
  // Not public: the middleware's list names no /api/operations path, so the cookie gate holds the range as it holds the day.
  const publicList = code(MIDDLEWARE).match(/const PUBLIC_PATHS = \[([\s\S]*?)\n\];/);
  assert.ok(publicList !== null);
  for (const m of publicList![1].matchAll(/'([^']+)'/g)) assert.ok(!('/api/operations/journal/range' === m[1] || '/api/operations/journal/range'.startsWith(`${m[1]}/`)), `not public (${m[1]})`);
  // The day route is untouched — byte for byte (its comments stripped) what main holds.
  assert.equal(createHash('sha256').update(code(DAY_ROUTE)).digest('hex'), DAY_ROUTE_SHA256, 'the day GET and the PUT are as they were (ruling A; journal06 T11)');
  assert.doesNotMatch(code(DAY_ROUTE), /range|first_day|findMany/, 'no range in the day route');
});

// ── T2 · THE COLUMNS, VERBATIM ──────────────────────────────────────────────

test('T2 the two specs verbatim: MORNING day · date · goals · blocker · plan · done (DAY · DATE · GOALS · BLOCKER · PLAN · DONE); EVENING day · date · the seven in EVENING_ORDER with the card’s labels; DAY/DATE/DONE value, the rest text; no retired field in either', () => {
  assert.deepEqual([...MORNING_COLUMNS], ['day', 'date', 'goals', 'blocker', 'plan', 'done']);
  assert.deepEqual([...MORNING_HEAD_WORDS], ['DAY', 'DATE', 'GOALS', 'BLOCKER', 'PLAN', 'DONE']);
  assert.deepEqual(MORNING_TABLE.map((c) => [c.key, c.label, c.kind]), [['day', 'DAY', 'value'], ['date', 'DATE', 'value'], ['goals', 'GOALS', 'text'], ['blocker', 'BLOCKER', 'text'], ['plan', 'PLAN', 'text'], ['done', 'DONE', 'value']]);
  assert.deepEqual([...EVENING_COLUMNS], ['day', 'date', 'audit', 'gaps', 'evolution', 'direction', 'alignment', 'on_track', 'next']);
  assert.deepEqual([...EVENING_HEAD_WORDS], ['DAY', 'DATE', 'ACCOMPLISHED', 'GAPS', 'EVOLUTION', 'DIRECTION', 'ALIGNMENT', 'ON TRACK', 'NEXT']);
  assert.deepEqual(EVENING_TABLE.map((c) => [c.key, c.label, c.kind]), [['day', 'DAY', 'value'], ['date', 'DATE', 'value'], ...EVENING_ORDER.map((f) => [f, EVENING_LABELS[f], 'text'])]);
  assert.deepEqual(MORNING_TABLE.map((c) => c.key), [...MORNING_COLUMNS]);
  assert.deepEqual(EVENING_TABLE.map((c) => c.key), [...EVENING_COLUMNS]);
  assert.deepEqual(MORNING_TABLE.map((c) => c.label), [...MORNING_HEAD_WORDS]);
  assert.deepEqual(EVENING_TABLE.map((c) => c.label), [...EVENING_HEAD_WORDS]);
  assert.deepEqual(JOURNAL_TABLE_KINDS, ['morning', 'evening']);
  assert.equal(JOURNAL_TABLES.morning, MORNING_TABLE);
  assert.equal(JOURNAL_TABLES.evening, EVENING_TABLE);
  for (const retiredField of RETIRED_FIELDS) {
    assert.ok(!MORNING_TABLE.some((c) => (c.key as string) === retiredField) && !EVENING_TABLE.some((c) => (c.key as string) === retiredField), `${retiredField} is in no spec`);
    assert.doesNotMatch(code(RULES), new RegExp(`\\b${retiredField}\\b`), `${retiredField} is read by nothing in the rules`);
    assert.doesNotMatch(code(TABLE), new RegExp(`\\b${retiredField}\\b`), `${retiredField} is read by nothing in the table`);
  }
  assert.doesNotMatch(code(RULES) + code(TABLE), /\.retired\b|'date'[^]*kind: 'date'/, 'the retired block is never opened; no date kind (IDIOM-01)');
});

// ── T3 · THE CELLS ──────────────────────────────────────────────────────────

test('T3 the cells: DAY the weekday, DATE the day; GOALS one per line; PLAN one step per line through the card’s planStepWords (✓ 1. … / ☐ 3. …); DONE "2 of 3" via doneWords, "—" with no plan; a null answer is "—" on screen and the empty field in the CSV; the sort keys', () => {
  const by = (key: string) => MORNING_TABLE.find((c) => c.key === key)!;
  const f = ROWS[0];
  assert.deepEqual(ROWS.map((r) => [r.id, r.day]), [['f', '2026-10-02'], ['s', '2026-10-03'], ['u', '2026-10-04'], ['m', '2026-10-05']], 'the route’s order kept');
  assert.deepEqual(ROWS.map((r) => by('day').words(r)), ['Friday', 'Saturday', 'Sunday', 'Monday']);
  assert.deepEqual(ROWS.map((r) => by('date').words(r)), ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  assert.equal(by('goals').words(f), 'perfect the day cards\nbook travel');
  assert.equal(goalsText(SATURDAY), 'rest');
  assert.equal(goalsText(MONDAY), null);
  assert.equal(by('plan').words(f), `${planStepWords(1, 'merge TABLE-01', true)}\n${planStepWords(2, 'book travel', true)}\n${planStepWords(3, 'record brunch', false)}`);
  assert.equal(planText(FRIDAY), '✓ 1. merge TABLE-01\n✓ 2. book travel\n☐ 3. record brunch', 'the card’s one rule, the index included (ruling 3)');
  assert.equal(planText(SUNDAY), '✓ 1. walk');
  assert.equal(planText(SATURDAY), null, 'no plan');
  assert.throws(() => planText(row({ id: 'x', day: '2026-10-06', plan_steps: ['a', 'b'], plan_done: [true] })), /journal 2026-10-06: 1 ticks for 2 steps — one tick per step/, 'a tick count that is not the steps’ is the database’s error, thrown');
  assert.deepEqual([ticksOf(FRIDAY), ticksOf(SUNDAY), ticksOf(SATURDAY)], [2, 1, 0]);
  assert.deepEqual([doneWords(2, 3), doneWords(0, 12), doneCellWords(FRIDAY), doneCellWords(SUNDAY), doneCellWords(SATURDAY)], ['2 of 3', '0 of 12', '2 of 3', '1 of 1', BLANK], '"2 of 3" (ruling 4); "—" with no plan');
  assert.equal(by('done').csv(ROWS[1]), '', 'no plan: an empty field');
  assert.equal(by('done').csv(f), '2 of 3');
  // Null answers: "—" on screen (BLANK), '' in the CSV, null to the filter.
  const blocker = by('blocker');
  assert.equal(blocker.words(ROWS[1]), BLANK);
  assert.equal(blocker.csv(ROWS[1]), '');
  assert.equal(blocker.kind === 'text' ? blocker.text(ROWS[1]) : 'not text', null);
  assert.equal(blocker.words(f), 'the flight sale ends');
  // The evening's seven read the row's own field.
  for (const field of EVENING_ORDER) {
    const c = EVENING_TABLE.find((col) => col.key === field)!;
    assert.equal(c.words(f), FRIDAY[field] ?? BLANK, `${field} words`);
    assert.equal(c.csv(f), FRIDAY[field] ?? '', `${field} csv`);
    if (c.kind === 'text') assert.equal(c.text(f), FRIDAY[field], `${field} text`);
  }
  // Sort keys: DAY by weekday number (Monday 1 … Sunday 7), DATE by its text, DONE by its words (numeric), the blank last; a text column by its text.
  assert.deepEqual(ROWS.map((r) => by('day').sortKey(r)), [{ kind: 'number', n: 5 }, { kind: 'number', n: 6 }, { kind: 'number', n: 7 }, { kind: 'number', n: 1 }]);
  assert.deepEqual(by('date').sortKey(f), { kind: 'text', t: '2026-10-02' });
  assert.deepEqual([by('done').sortKey(f), by('done').sortKey(ROWS[1])], [{ kind: 'text', t: '2 of 3' }, null]);
  assert.deepEqual(ids(sortRows(ROWS, { column: 'day', direction: 'asc' }, MORNING_TABLE)), ['m', 'f', 's', 'u'], 'Monday · Friday · Saturday · Sunday');
  assert.deepEqual(ids(sortRows(ROWS, { column: 'date', direction: 'desc' }, MORNING_TABLE)), ['m', 'u', 's', 'f']);
  assert.deepEqual(ids(sortRows(ROWS, { column: 'done', direction: 'asc' }, MORNING_TABLE)), ['u', 'f', 's', 'm'], '"1 of 1" · "2 of 3" · the blanks last, in the order given');
  assert.deepEqual(ids(sortRows(ROWS, { column: 'blocker', direction: 'asc' }, MORNING_TABLE)), ['m', 'f', 's', 'u'], 'none · the flight sale ends · the blanks');
  assert.equal(cellKeyOf(f, 'audit'), 'f:audit');
});

// ── T4 · FILTERS ON THE FULL TEXT; THE CSV WHOLE ────────────────────────────

test('T4 a filter matches the FULL text, never the preview; the CSV carries the full text with line breaks quoted (csvField), the heads in order, a null an empty field, CRLF; the file names', () => {
  const off = noFilters(EVENING_TABLE);
  assert.deepEqual(Object.keys(off), [...EVENING_COLUMNS]);
  // 'line two' sits past the 160th code point of FRIDAY's accomplished — the preview never shows it; the filter finds it.
  assert.ok(previewOf(FRIDAY.audit!).shown.includes('line two') === false);
  assert.deepEqual(ids(filterRows(ROWS, { ...off, audit: { contains: 'LINE TWO' } }, EVENING_TABLE)), ['f'], 'the full text, case-insensitive');
  assert.deepEqual(ids(filterRows(ROWS, { ...off, gaps: { contains: 'stranded' } }, EVENING_TABLE)), ['f']);
  assert.deepEqual(ids(filterRows(ROWS, { ...off, on_track: { contains: 'yes' } }, EVENING_TABLE)), ['u']);
  assert.deepEqual(ids(filterRows(ROWS, { ...off, gaps: { contains: 'zzz' } }, EVENING_TABLE)), [], 'none — the table stays, DataTable says no row matches');
  const morningOff = noFilters(MORNING_TABLE);
  assert.deepEqual(ids(filterRows(ROWS, { ...morningOff, done: { dropped: [BLANK] } }, MORNING_TABLE)), ['f', 'u'], 'DONE’s checklist: the blank dropped');
  assert.deepEqual(ids(filterRows(ROWS, { ...morningOff, day: { dropped: ['Friday', 'Saturday'] } }, MORNING_TABLE)), ['u', 'm']);
  // The CSV.
  const csv = tableCsv(EVENING_TABLE, ROWS);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'DAY,DATE,ACCOMPLISHED,GAPS,EVOLUTION,DIRECTION,ALIGNMENT,ON TRACK,NEXT');
  assert.ok(csv.includes(`"${LONG}\nline two"`), 'the full 200 code points and the line break, inside quotes');
  assert.ok(csv.includes('"the vendor box, ""stranded"" vendors"'), 'a comma and a quote — quoted, the quote doubled');
  assert.equal(csvField(`${LONG}\nline two`), `"${LONG}\nline two"`);
  assert.equal(lines[2], 'Saturday,2026-10-03,,,,,,,', 'a day with no evening: every answer an empty field');
  assert.equal(lines[lines.length - 1], '', 'the last line ends CRLF too');
  const morning = tableCsv(MORNING_TABLE, ROWS).split('\r\n');
  assert.equal(morning[0], 'DAY,DATE,GOALS,BLOCKER,PLAN,DONE');
  assert.equal(morning[1], 'Friday,2026-10-02,"perfect the day cards\nbook travel",the flight sale ends,"✓ 1. merge TABLE-01\n✓ 2. book travel\n☐ 3. record brunch",2 of 3');
  assert.equal(morning[2], 'Saturday,2026-10-03,rest,,,', 'no blocker, no plan: empty fields; DONE empty');
  assert.deepEqual([journalCsvFileName('morning', '2026-10-01', '2026-10-31'), journalCsvFileName('evening', '2026-10-01', '2026-10-31')], ['journal-morning_2026-10-01_2026-10-31.csv', 'journal-evening_2026-10-01_2026-10-31.csv']);
});

// ── T5 · LONG TEXT ──────────────────────────────────────────────────────────

test('T5 the preview: in full when it fits; else the first 160 code points and "… (<n> chars)" — counted in code points, never a character cut in half; the two controls’ words', () => {
  assert.equal(PREVIEW_CHARS, 160);
  assert.deepEqual(previewOf('short'), { shown: 'short', more: null });
  const exactly = 'x'.repeat(160);
  assert.deepEqual(previewOf(exactly), { shown: exactly, more: null }, '160 fits');
  const longer = `${exactly}y`;
  assert.deepEqual(previewOf(longer), { shown: exactly, more: '… (161 chars)' });
  const emoji = '🙂'.repeat(170);
  const cut = previewOf(emoji);
  assert.equal([...cut.shown].length, 160, '160 code points, not 160 UTF-16 units');
  assert.equal(cut.shown, '🙂'.repeat(160));
  assert.equal(cut.more, '… (170 chars)');
  assert.deepEqual(previewOf(FRIDAY.audit!), { shown: [...FRIDAY.audit!].slice(0, 160).join(''), more: previewMoreWords(209) }, '200 code points plus "\\nline two" = 209');
  assert.deepEqual([previewMoreWords(300), EXPAND_WORDS, COLLAPSE_WORDS], ['… (300 chars)', 'all of it', 'less']);
  // The precedent: the projects' notes, the same count, with "in edit" where the tables open "all of it".
  assert.match(code('src/components/workbench/operations/projects/projectsTableText.ts'), /export const NOTES_PREVIEW_CHARS = 160;/);
});

// ── T6 · THE WORDS ──────────────────────────────────────────────────────────

test('T6 the words: the titles, the loading and failed lines, "no journal ‹period›", ALL’s empty words, "<n> of <m> days in the period have a journal"', () => {
  assert.deepEqual(JOURNAL_TITLE_WORDS, { morning: 'Morning journal', evening: 'Evening journal' });
  assert.equal(JOURNALS_LOADING_WORDS, 'reading the journals…');
  assert.equal(journalsFailedWords('x'), 'The journals could not be read — x');
  assert.equal(noJournalWords({ from: '2026-09-01', to: '2026-09-30' }), `no journal ${periodWords({ from: '2026-09-01', to: '2026-09-30' })}`, 'the ledger’s period words');
  assert.equal(noJournalWords({ from: '2026-09-01', to: '2026-09-30' }), 'no journal Tue Sep 1 – Wed Sep 30');
  assert.equal(noJournalWords({ from: '2026-10-02', to: '2026-10-02' }), 'no journal Fri Oct 2', 'a day');
  assert.equal(NO_FIRST_JOURNAL_WORDS, 'no journal yet — ALL starts at the first journal');
  assert.deepEqual([daysWithJournalWords(3, 31), daysWithJournalWords(0, 31), daysWithJournalWords(1, 1)], ['3 of 31 days in the period have a journal', '0 of 31 days in the period have a journal', '1 of 1 days in the period have a journal']);
});

// ── T7 · THE SECTIONS, THE PAGE, THE LAW ────────────────────────────────────

test('T7 the sections: one component with its kind; the period control copied verbatim from the ledger (its state, its effects, its JSX — the attributes with the table’s name); DataTable named journal-morning / journal-evening; shown = filtered then sorted; the filters reset with the period; zero rows is the ledger’s idiom; the "n of m days" line; no form, no PUT, nothing stored; the page mounts the two under the ledger; the law holds the four', () => {
  const t = code(TABLE);
  assert.match(t, /^'use client';/m);
  assert.doesNotMatch(t, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|useOperationsEntity|useSearchParams|method:|<form|<textarea|PUT/, 'no fetch of its own, nothing stored, no entity, no URL, no form, no write');
  assert.match(t, /import \{ readJournalRange, type JournalRangeAnswer \} from '\.\/journalReads';/);
  assert.match(code(READS), /readJson\(`\/api\/operations\/journal\/range\?\$\{new URLSearchParams\(\{ from, to \}\)\.toString\(\)\}`\)/, 'the one read, through the week’s reader');
  assert.match(code(READS), /if \(!Array\.isArray\(read\.value\.journals\) \|\| !\('first_day' in read\.value\)\) return \{ ok: false, words: journalsFailedWords\('the journals came back without their list'\) \};/, 'an answer without its list is a failure in words');
  // The period control — the ledger's lines, copied (LedgerSection.tsx is untouched by this PR; its own pins stand).
  const ledger = code(LEDGER_SECTION);
  for (const line of [
    "const [kind, setKind] = useState<PeriodKind>('month');",
    'const [anchor, setAnchor] = useState<string | null>(null);',
    'const t = localToday();\n    setToday(t);\n    setAnchor(t);',
    "const period = today === null || anchor === null ? null : periodOf(kind, anchor, today, ",
    '{PERIOD_KINDS.map((k) => (',
    "<button type=\"button\" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, -1))}",
    "<input type=\"date\" value={anchor ?? ''} disabled={kind === 'all'} onChange={(e) => { if (/^\\d{4}-\\d{2}-\\d{2}$/.test(e.target.value)) setAnchor(e.target.value); }} className=\"px-1.5 py-0.5 border border-border rounded text-xs\"",
    "<button type=\"button\" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, 1))}",
    '{period !== null && <span className="font-semibold text-text-secondary"',
  ]) {
    assert.ok(t.includes(line), `the table carries the ledger’s control line ${JSON.stringify(line.slice(0, 60))}`);
    assert.ok(ledger.includes(line), `the ledger still carries ${JSON.stringify(line.slice(0, 60))} — the copy is verbatim`);
  }
  assert.match(t, /periodOf\(kind, anchor, today, firstDay\)/, 'ALL starts at the first journal (ruling 1(b))');
  assert.match(t, /if \(read\.ok\) setFirstDay\(read\.value\.first_day\);/);
  assert.match(t, /trailing=\{kind === 'all' && period === null && <span className="text-text-muted" \{\.\.\.dataAttr\(name, 'no-first'\)\}>\{NO_FIRST_JOURNAL_WORDS\}<\/span>\}/, 'ALL with no journal yet — its words');
  for (const attr of ["dataAttr(name, 'period', k)", "dataAttr(name, 'previous')", "dataAttr(name, 'anchor')", "dataAttr(name, 'next')", "dataAttr(name, 'period-words')", "dataAttr(name, 'row', row.day)", "dataAttr(name, 'cell', c.key)", "dataAttr(name, 'loading')", "dataAttr(name, 'failed')", "dataAttr(name, 'none')", "dataAttr(name, 'days')"]) {
    assert.ok(t.includes(`{...${attr}}`), `the table writes ${attr}`);
  }
  // COLUMNS-01 (Alex, 2026-10-25, ruling D): the cell's attributes are written by the shared TextCell now (components/table/TextCell.tsx).
  for (const attr of ["dataAttr(name, 'cell', column)", "dataAttr(name, 'cell-toggle')"]) assert.ok(code('src/components/table/TextCell.tsx').includes(`{...${attr}}`), `the shared text cell writes ${attr}`);
  assert.match(t, /const name = `journal-\$\{which\}`;/);
  assert.match(t, /<DataTable\n\s*name=\{name\}\n\s*columns=\{columns\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{loaded\}/, 'the shared table, by the table’s name');
  assert.match(t, /const shown = sortRows\(filterRows\(rows, filters, columns\), sort, columns\);/, 'filtered, then sorted');
  assert.match(t, /useEffect\(\(\) => \{\n\s*setFilters\(off\);\n\s*setOpenFilter\(null\);\n\s*setOpened\(new Set\(\)\);\n\s*\}, \[period\?\.from, period\?\.to\]\);/, 'a new period starts with every filter off, no popover, every cell folded');
  assert.match(t, /const rows: readonly JournalDayRow\[\] = answer !== null && answer\.read\.ok \? journalDayRows\(answer\.read\.value\.journals\) : \[\];/, 'the rows are the days that have a journal (ruling D)');
  assert.match(t, /\{loaded && rows\.length === 0 && <div className="text-xs text-text-muted" \{\.\.\.dataAttr\(name, 'none'\)\}>\{noJournalWords\(answer\.period\)\}<\/div>\}/, 'zero rows loaded: the ledger’s idiom (ruling 2(a))');
  assert.match(t, /\{loaded && <p className="text-xs text-text-muted" \{\.\.\.dataAttr\(name, 'days'\)\}>\{daysWithJournalWords\(rows\.length, spanDays\(answer\.period\.from, answer\.period\.to\)\)\}<\/p>\}/, 'under the table: n of m days');
  assert.match(t, /const csv = csvPeriod === null \? null : \{ name: journalCsvFileName\(which, csvPeriod\.from, csvPeriod\.to\) \};/);
  assert.match(t, /foot=\{null\}/, 'no TOTAL row');
  // The text cell: "—" for null; the preview, the count and the toggle; the full text when opened; one state per cell key.
  // COLUMNS-01 (Alex, 2026-10-25, ruling D): the cell moved, as it stood, to the shared idiom (components/table/TextCell.tsx) — the journal
  // tables render it (DOM byte-identical, proven in the PR) and PROJECTS renders the same one; its pins moved with it.
  const tc = code('src/components/table/TextCell.tsx');
  assert.match(t, /import TextCell from '@\/components\/table\/TextCell';/);
  assert.doesNotMatch(t, /function TextCell\(|previewOf|EXPAND_WORDS|COLLAPSE_WORDS/, 'no cell of its own');
  assert.match(tc, /if \(text === null\) return <td className=\{`\$\{cell\} \$\{BLANK_CLASS\}`\} \{\.\.\.dataAttr\(name, 'cell', column\)\}>\{BLANK\}<\/td>;/);
  assert.match(tc, /\{open \|\| preview\.more === null \? text : preview\.shown\}/);
  assert.match(tc, /\{!open && <span className="text-text-faint"> \{preview\.more\}<\/span>\}/);
  assert.match(tc, /<button type="button" className=\{link\} onClick=\{onToggle\} \{\.\.\.dataAttr\(name, 'cell-toggle'\)\}>\{open \? COLLAPSE_WORDS : EXPAND_WORDS\}<\/button>/);
  assert.match(t, /<TextCell key=\{c\.key\} name=\{name\} column=\{c\.key\} text=\{c\.text\(row\)\} open=\{opened\.has\(cellKeyOf\(row, c\.key\)\)\} onToggle=\{\(\) => toggle\(cellKeyOf\(row, c\.key\)\)\} \/>/);
  assert.match(tc, /whitespace-pre-line/, 'one goal, one step per line');
  // No sentence of its own.
  const printed = [...t.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length >= 8);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(t, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  // The two sections are the one component with its kind.
  assert.match(code(MORNING), /export default function MorningJournalTable\(\) \{\n\s*return <JournalDayTable kind="morning" \/>;\n\}/);
  assert.match(code(EVENING), /export default function EveningJournalTable\(\) \{\n\s*return <JournalDayTable kind="evening" \/>;\n\}/);
  // The page: the two under the ledger, in order, inside the provider, no boundary (they read no URL).
  const page = code(TIME_PAGE);
  assert.match(page, /import MorningJournalTable from '@\/components\/workbench\/operations\/journal\/MorningJournalTable';\nimport EveningJournalTable from '@\/components\/workbench\/operations\/journal\/EveningJournalTable';/);
  // HOME-01 (Alex, 2026-10-24): the card left for the dashboard — the container is the three tables, the ledger first.
  assert.match(page, /data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  const box = page.slice(page.indexOf('data-tool-page="Time"'), page.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['LedgerSection', 'MorningJournalTable', 'EveningJournalTable']);
  assert.match(comments(TIME_PAGE), /JOURNAL-07 \(Alex, 2026-10-24\) — THE JOURNALS DAY OVER DAY/);
  // The law: TIME_MOUNTS is the four, in order; the messages name the tables; dated.
  const law = code(LAW);
  // HOME-01 (Alex, 2026-10-24): TIME_MOUNTS is the three — the card is the Runway panel's.
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  assert.match(law, /timeMounts\.join\(' '\) !== 'LedgerSection MorningJournalTable EveningJournalTable'/);
  assert.match(law, /the ledger first, then the morning and the evening journal tables \(HOME-01; TIME-01; TIME-02; JOURNAL-07\)/);
  assert.match(comments(LAW), /JOURNAL-07 \(Alex, 2026-10-24\): two more mounts under the ledger — the MORNING and the EVENING journal tables/);
  // Ruling F: the Time registry row's prose was not changed by JOURNAL-07. HOME-01 (Alex, 2026-10-24, ruling C) rewrote it to the tables' — time02.test.ts pins the words.
  const time = TOOL_REGISTRY.find((tool) => tool.name === 'Time')!;
  assert.equal(time.why, undefined); // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. A LIVE row carries no why — the tables' line left with the status (time03.test.ts pins the row).
  // HOME-01 (Alex, 2026-10-24) rewrote the row once, to the tables — the citation names the tables and their range read now (home01.test.ts).
  assert.match(code(REGISTRY), /MorningJournalTable\.tsx · src\/components\/workbench\/operations\/journal\/EveningJournalTable\.tsx/);
  assert.match(code(REGISTRY), /journalReads\.ts:26 \(GET \/api\/operations\/journal\/range/);
  // Nothing else: the ledger's section, the card's journal forms and the day route are untouched by the tables.
  for (const f of [LEDGER_SECTION, 'src/components/workbench/operations/stops/JournalForm.tsx', 'src/components/workbench/operations/stops/EveningForm.tsx', 'src/components/workbench/operations/day/DayCard.tsx']) {
    assert.doesNotMatch(code(f), /journalTables|JournalDayTable|journal\/range|readJournalRange/, `${f} knows nothing of the tables`);
  }
});
