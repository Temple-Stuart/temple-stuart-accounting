/**
 * VENDOR-03 (Alex, 2026-10-27) — STRANDED VENDORS HAVE A HOME ON THE DAY CARD.
 *
 *   A. A stranded vendor (planLines.ts dayPlanOf → plan.stranded, with its reason) is listed on the day card's FULL view,
 *      under the plate, in a section "STRANDED VENDORS": one line per row — "<vendor> — named for <label> (<line>) at
 *      <time> · <reason>" — and one control, "clear" (the plan-vendors DELETE at the row's address, VENDOR-01's route,
 *      through Budget's own writer). No row → no section; nothing says "none".
 *   B. The read is the report the card already holds (plans.stranded) — no new read; a failed report shows its failure
 *      words as today and no section.
 *   C. After a clear the card reads the report again (the report-reads counter), as the vendor box does. Nothing else on
 *      the card, the vendor box, /budget or the ledger changes. No schema, no route, no migration.
 *
 * The words are pure (src/lib/operations/strandedVendors.ts) and driven here, from rows dayPlanOf itself builds; the
 * clear's request is driven through Budget's writer with fetch stubbed; the screens are read through code().
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { STRANDED_WORDS, undatedWords, type DayPlan, type StrandedVendor } from '../budget/planLines';
import { STRANDED_CLEAR_WORD, STRANDED_VENDORS_HEAD, strandedKeyOf, strandedRowsOf, strandedVendorWords } from '../operations/strandedVendors';
import { clearVendor } from '@/components/budget/VendorBox';

const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const SECTION = 'src/components/workbench/operations/stops/StrandedVendors.tsx'; // with the card's other writers — the day folder writes nothing (daycard01 T5)
const WORDS = 'src/lib/operations/strandedVendors.ts';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const BOX = 'src/components/budget/VendorBox.tsx';
const STOP_VENDOR = 'src/components/workbench/operations/stops/StopVendor.tsx';
const BUDGET = 'src/components/budget/BudgetReport.tsx';
const ROUTE = 'src/app/api/operations/plan-vendors/route.ts';

const LUNCH_LINE = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';

const dated: StrandedVendor = {
  vendor: { id: 'v1', name: 'Warung Bu Kris', entityId: 'P' },
  label: 'Lunch',
  line: 'nasi campur',
  day: '2026-10-27',
  time: '12:30',
  address: { kind: 'routine_line', id: LUNCH_LINE, instant: '2026-10-27T05:30:00.000Z' },
  reason: STRANDED_WORDS,
};
const undated: StrandedVendor = {
  vendor: { id: 'v2', name: 'Gym Bali', entityId: 'P' },
  label: 'Gym',
  line: null,
  day: null,
  time: null,
  address: { kind: 'routine', id: ROUTINE, instant: '2026-10-27T10:00:00.000Z' },
  reason: undatedWords('Mars/Olympus', 'Invalid time zone specified: Mars/Olympus'),
};

// ── A · THE WORDS ─────────────────────────────────────────────────────────────

test('A the words: a dated row says its line and its time; an undated row (its zone unreadable) says no "at" — the reason says why', () => {
  assert.equal(STRANDED_VENDORS_HEAD, 'STRANDED VENDORS');
  assert.equal(STRANDED_CLEAR_WORD, 'clear');
  assert.equal(strandedVendorWords(dated), `Warung Bu Kris — named for Lunch (nasi campur) at 12:30 · ${STRANDED_WORDS}`);
  assert.equal(strandedVendorWords(dated), 'Warung Bu Kris — named for Lunch (nasi campur) at 12:30 · /budget builds no occurrence at this instant — the line or routine is inactive, carries no money, or its schedule or zone changed');
  assert.equal(strandedVendorWords(undated), 'Gym Bali — named for Gym · its routine\'s zone "Mars/Olympus" cannot be read (Invalid time zone specified: Mars/Olympus) — this vendor cannot be dated');
  // A dated routine-level row (no line) — its label alone, then its time.
  assert.equal(strandedVendorWords({ ...dated, line: null }), `Warung Bu Kris — named for Lunch at 12:30 · ${STRANDED_WORDS}`);
  assert.equal(strandedKeyOf(dated), `routine_line:${LUNCH_LINE}:2026-10-27T05:30:00.000Z`);
  assert.doesNotMatch(code(WORDS), /prisma|fetch\(|useState|new Date\(/, 'pure — no read, no write, no clock');
});

// ── B · THE READ ──────────────────────────────────────────────────────────────

test('B the rows are the report\'s plans.stranded — none while the report is unread or failed, none for a plan not listed, none when the report lists none', () => {
  const listed = (stranded: readonly StrandedVendor[]): DayPlan => ({ listed: true, days: ['2026-10-27'], lines: [], stranded });
  assert.deepEqual(strandedRowsOf(listed([dated, undated])), [dated, undated], 'in the report\'s order (dayPlanOf sorts them)');
  assert.deepEqual(strandedRowsOf(listed([])), []);
  assert.deepEqual(strandedRowsOf({ listed: false, words: 'a year lists no plan lines — open a day or a week' }), []);
  assert.deepEqual(strandedRowsOf(null), []);
  const c = code(CARD);
  assert.match(c, /const plans = report !== null && report\.ok \? report\.value\.plans : null;\n[^\n]*\n[^\n]*\n\s*const strandedRows = strandedRowsOf\(plans\);/, 'the card\'s own report — no new read');
  // No new read: the card's reads are the ones it had; the report is the BUDGET-02 day report.
  assert.match(code(READS), /export async function readDayReport\(day: string, asOf: string\): Promise<Read<BudgetReportResponse>> \{\n\s*const query = new URLSearchParams\(\{ view: 'day', day, asOf \}\);/);
  assert.doesNotMatch(code(SECTION), /\bfetch\(|readJson|readDayReport/, 'the section reads nothing');
  assert.doesNotMatch(c, /\bfetch\(/, 'the card fetches nothing (dayReads.ts and weekReads.ts are its reads)');
  // A failed report: its words in the foot, as today; the rows are none.
  assert.match(c, /\{report !== null && !report\.ok && <p className="text-brand-red" data-day-report-failed>\{report\.words\}<\/p>\}/);
  // The day report's response carries it: BudgetReportResponse.plans (a DayPlan; listed → .stranded), filled by budgetReportResponse from dayPlanOf.
  const inputs = code('src/lib/budget/reportInputs.ts');
  assert.match(inputs, /readonly plans: DayPlan;/);
  assert.match(inputs, /const plans = dayPlanOf\(\{/);
  assert.match(inputs, /plans: plans\.plan,/);
});

test('A the section: on the full card only, under the plate (after the hint, before the step view\'s vendor box), mounted only when there is a row; the component renders nothing for none', () => {
  const c = code(CARD);
  assert.match(c, /import StrandedVendors from '\.\.\/stops\/StrandedVendors';\nimport \{ strandedRowsOf \} from '@\/lib\/operations\/strandedVendors';/);
  assert.match(c, /\{loaded && focus === null && strandedRows\.length > 0 && \(\n\s*<StrandedVendors rows=\{strandedRows\} reload=\{\(\) => setReportReads\(\(n\) => n \+ 1\)\} \/>\n\s*\)\}/);
  const hintAt = c.indexOf('data-day-hint>');
  const sectionAt = c.indexOf('<StrandedVendors ');
  const vendorAt = c.indexOf('<StopVendor ');
  const footAt = c.indexOf('data-day-foot>');
  assert.ok(hintAt > -1 && sectionAt > hintAt && vendorAt > sectionAt && footAt > vendorAt, 'under the plate: the fine print, the hint, then the section — before the step view\'s blocks and the foot');
  assert.equal((c.match(/<StrandedVendors /g) ?? []).length, 1, 'mounted once');
  const s = code(SECTION);
  assert.match(s, /if \(rows\.length === 0\) return null;/, 'no row → nothing, nothing says "none"');
  assert.doesNotMatch(s + code(WORDS), /\bnone\b'|'no stranded|nothing stranded/i);
  assert.match(s, /<p className="[^"]*" data-day-stranded-head>\{STRANDED_VENDORS_HEAD\}<\/p>/);
  assert.match(s, /<span className="text-brand-amber" data-day-stranded-words>\{strandedVendorWords\(row\)\}<\/span>\n\s*<ClearVendor address=\{row\.address\} reload=\{reload\} label=\{STRANDED_CLEAR_WORD\} \/>/);
  assert.match(s, /style=\{underStyle\(bleed\)\}/, 'the card\'s width on screen, as everything under it (WIDTH-01)');
  assert.match(comments(CARD), /VENDOR-03 \(Alex, 2026-10-27\): BUDGET-02 \(2026-10-20\) took that list off\s*\n\s*\* \/budget/);
});

// ── C · THE CLEAR AND THE RE-READ ─────────────────────────────────────────────

test('C the clear: Budget\'s own writer — DELETE /api/operations/plan-vendors at exactly the row\'s address (kind, id, instant); a refusal keeps the route\'s words', async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const real = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify({ outcome: 'cleared' }), { status: 200, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), method: init?.method }); return answer(); }) as typeof fetch;
  try {
    const ok = await clearVendor(dated.address);
    assert.equal(ok.ok, true);
    assert.deepEqual(calls[0], { url: `/api/operations/plan-vendors?kind=routine_line&id=${LUNCH_LINE}&instant=2026-10-27T05%3A30%3A00.000Z`, method: 'DELETE' });
    await clearVendor(undated.address);
    assert.deepEqual(calls[1], { url: `/api/operations/plan-vendors?kind=routine&id=${ROUTINE}&instant=2026-10-27T10%3A00%3A00.000Z`, method: 'DELETE' });
    answer = () => new Response(JSON.stringify({ error: 'not-found', message: 'No vendor at that address' }), { status: 404, headers: { 'content-type': 'application/json' } });
    const refused = await clearVendor(dated.address);
    assert.equal(refused.ok, false);
  } finally {
    globalThis.fetch = real;
  }
  // The writer and the route are VENDOR-01's, unchanged: the DELETE clears exactly that address, for the caller's own plan.
  assert.match(code(BOX), /export async function clearVendor\(address: PlanAddressText\): Promise<Answer> \{\n\s*const query = new URLSearchParams\(\{ kind: address\.kind, id: address\.id \}\);\n\s*if \(address\.instant !== null\) query\.set\('instant', address\.instant\);/);
  assert.match(code(BOX), /if \(answer\.ok\) reload\(\);\n\s*else setWords\(answer\.words\);/, 'reload after a clear; the route\'s words on a refusal');
  assert.match(code(ROUTE), /export async function DELETE\(request: NextRequest\) \{/);
  assert.match(code(ROUTE), /const row = await prisma\.planned_item_vendors\.findFirst\(\{\n\s*where: \{ user_id: user\.id, \.\.\.addressWhere\(address\) \},/);
});

test('C the re-read: a clear bumps the report-reads counter, and the counter reads the day report again in place — as the vendor box\'s reload does', () => {
  const c = code(CARD);
  assert.equal((c.match(/reload=\{\(\) => setReportReads\(\(n\) => n \+ 1\)\}/g) ?? []).length, 2, 'the vendor box and the stranded section — the same counter');
  assert.match(c, /useEffect\(\(\) => \{\n\s*if \(day === null \|\| today === null \|\| reportReads === 0\) return;\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const r = await readDayReport\(day, today\);\n\s*if \(live\) setReport\(r\);/);
  // Nothing else changed: the vendor box's mount, the completeness line (no stranded count), /budget's page.
  assert.match(code(STOP_VENDOR), /export default function StopVendor\(\{ slot, bookName, reload \}: \{ slot: VendorSlot; bookName: string; reload: \(\) => void \}\) \{/);
  assert.match(c, /const completeness = completenessWords\(result, \{ day: !dayFailed, report: reportRead, records: recordsOk \}\);/);
  assert.doesNotMatch(code(BUDGET), /vendors-stranded|VENDORS STRANDED|ClearVendor|StrandedVendors/, '/budget unchanged — it lists none');
});
