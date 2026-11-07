/**
 * SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 rulings 2 and 4) — THE SUPERSESSION RULE AND THE PLANNED-MINUTES RULE LEAVE THE
 * DAY CARD FOR ONE LEAF (src/lib/operations/supersession.ts — one rule, one owner, one door); THE LOADER READS THE ROUTINE'S
 * start_time / end_time AND THE LINE'S duration_minutes, THE MAPPERS CARRY THEM, NOTHING CONSUMES THEM YET. Every pin finds its
 * line by content; no line number of a file this PR does not own is pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code } from '../sourceText';
import { plannedMinutesOf } from '../operations/supersession';
import { toRoutineBudgetInput, type RoutineBudgetRow } from '../operations/routineBudgetInputs';
import { toReportEntity, toRoutinePlanInput, type RoutineRow } from '../budget/reportInputs';
import type { RoutineLinePlanInput, RoutinePlanInput } from '../budget/days';

const LEAF = 'src/lib/operations/supersession.ts';
const CARD = 'src/components/workbench/operations/day/dayCard.ts';
const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const INPUTS = 'src/lib/budget/reportInputs.ts';
const DAYS = 'src/lib/budget/days.ts';
const RULE_NAMES = ['plannedMinutesOf', 'supersessionOf', 'cannotSupersedeWords', 'TravelBlock', 'OccurrenceWindow', 'PlannedMinutesPlan'] as const;

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
});

// ── A · THE LEAF: one import, the exported names, the private helpers ────────────────────────────────────────────────

test('A the leaf imports exactly the calendar\'s minutesOf; exports the rule\'s names and not its four private helpers; holds the moved text with the three permitted differences', () => {
  const leaf = code(LEAF);
  const imports = [...leaf.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['@/lib/calendar/day'], 'the only import');
  assert.doesNotMatch(code('src/lib/calendar/day.ts'), /^import /m, 'and that module imports nothing — the leaf stays a leaf');
  for (const exported of [
    'export type TravelKind =', 'export interface TravelBlock {', 'export interface Supersession {', 'export const clockOf =', 'export type PlannedMinutesPlan =',
    'export function plannedMinutesOf(plan: PlannedMinutesPlan): number | null {',
    "export const SUPERSEDED_BY_WORDS = 'superseded by';", "export const CANNOT_SUPERSEDE_NO_END_WORDS = 'cannot supersede — no end stated';",
    "export const CANNOT_SUPERSEDE_NO_INSTANT_WORDS = 'cannot supersede — no instant';", "export const SUPERSEDED_BY_TRAVEL_WORDS = 'superseded by travel';",
    'export const NOT_IN_PLAN_WORDS = "not in today\'s plan";', 'export const andMoreWords = (n: number): string => `and ${n} more`;',
    'export interface OccurrenceWindow {', 'export function cannotSupersedeWords(t: { readonly startAt: string | null; readonly endAt: string | null }): string | null {',
    'export function supersessionOf(blocks: readonly TravelBlock[], occurrences: readonly OccurrenceWindow[]): ReadonlyMap<string, Supersession> {',
  ]) assert.ok(leaf.includes(exported), `exports ${exported.slice(0, 50)}`);
  for (const priv of ['const windowMinutesOf = ', 'const clockMinutesOf = ', 'const instantMsOf = ', 'const firstDecidingOf = ']) {
    assert.ok(leaf.includes(priv), `${priv.trim()} is there`);
    assert.ok(!leaf.includes(`export ${priv}`), `${priv.trim()} stays private`);
  }
  assert.equal((leaf.match(/supersession: /g) ?? []).length, 4, 'the four thrown messages carry the leaf\'s prefix');
  assert.doesNotMatch(leaf, /dayCard: |TravelStop|Pick</, 'nothing of the card remains in the code');
  assert.doesNotMatch(leaf, /\?\? |\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client|instantToZoned|zonedToInstant/, 'pure: no default, no clock, no zone');
  assert.equal((leaf.match(/\|\|/g) ?? []).length, 1, 'the one boolean || — the planned-minutes rule\'s null check');
  assert.match(leaf, /if \(start === null \|\| end === null\) return null;/);
});

// ── B · THE CARD: imports from the leaf, defines none of it, re-exports nothing ──────────────────────────────────────

test('B dayCard.ts imports the names it uses from the leaf, defines none of the moved names, re-exports nothing, reads no minutesOf and has no clockOf of its own', () => {
  const card = code(CARD);
  assert.match(card, /import \{ NOT_IN_PLAN_WORDS, SUPERSEDED_BY_TRAVEL_WORDS, SUPERSEDED_BY_WORDS, andMoreWords, cannotSupersedeWords, clockOf, plannedMinutesOf, supersessionOf, type OccurrenceWindow, type Supersession, type TravelBlock, type TravelKind \} from '@\/lib\/operations\/supersession';/);
  assert.doesNotMatch(card, /export function (plannedMinutesOf|supersessionOf|cannotSupersedeWords)\(/, 'the rule is not defined here');
  for (const word of ['SUPERSEDED_BY_WORDS', 'CANNOT_SUPERSEDE_NO_END_WORDS', 'CANNOT_SUPERSEDE_NO_INSTANT_WORDS', 'SUPERSEDED_BY_TRAVEL_WORDS', 'NOT_IN_PLAN_WORDS', 'andMoreWords']) {
    assert.doesNotMatch(card, new RegExp(`export const ${word}\\b`), `${word} is the leaf's`);
  }
  assert.doesNotMatch(card, /export type (TravelKind|PlannedMinutesPlan)\b|export interface (TravelBlock|Supersession|OccurrenceWindow)\b/, 'the types are the leaf\'s');
  assert.doesNotMatch(card, /export \{[^}]*\} from |export \* from |export type \{[^}]*\} from /, 'no re-export — the leaf is the one door');
  assert.doesNotMatch(card, /import \{ minutesOf \}|const clockOf = /, 'the card neither reads minutesOf nor defines clockOf');
  // The card keeps its own side, byte for byte.
  for (const kept of ["export const BOOKING_HEAD_WORD = 'BOOKING';", 'export function travelBlocksOf(stops: readonly Stop[]): TravelBlock[] {', 'export function supersededWords(s: Pick<Stop, \'key\' | \'superseded\'>): string {', 'export function supersededTotals(', 'export function supersededLineWords(t: SupersededTotals): string | null {', 'export const withoutSuperseded = ']) assert.ok(card.includes(kept), `the card keeps ${kept.slice(0, 40)}`);
  assert.equal((card.match(/plannedMinutesOf\(/g) ?? []).length, 6, 'the six applications stay');
  assert.match(card, /const marks = supersessionOf\(travelBlocksOf\(\[\.\.\.timed, \.\.\.untimed\]\), occurrences\);/);
  assert.match(card, /const time = step\.time_of_day === null \? occurrenceTime : clockOf\(step\.time_of_day\);/);
});

// ── C · EVERY READER IMPORTS FROM THE LEAF ───────────────────────────────────────────────────────────────────────────

test('C across src (the leaf and the tests aside), every import of the rule\'s names names the leaf — none names dayCard', () => {
  const files = walk('src').filter((f) => !f.endsWith(LEAF) && !f.includes('/__tests__/'));
  const importers: string[] = [];
  for (const f of files) {
    const src = code(f);
    for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/g)) {
      const names = m[1].split(',').map((n) => n.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/)[0]);
      if (!names.some((n) => (RULE_NAMES as readonly string[]).includes(n))) continue;
      importers.push(f);
      assert.equal(m[2], '@/lib/operations/supersession', `${f} imports ${names.filter((n) => (RULE_NAMES as readonly string[]).includes(n)).join(', ')} from ${m[2]}`);
    }
  }
  assert.ok(importers.includes(CARD) && importers.includes('src/lib/operations/ledgerAnswer.ts'), `the card and the ledger answer import from the leaf (${importers.join(', ')})`);
  assert.match(code('src/lib/operations/ledgerAnswer.ts'), /import \{ plannedMinutesOf \} from '@\/lib\/operations\/supersession';/);
});

// ── D · THE LOADER READS THE THREE COLUMNS; THE MAPPERS CARRY THEM; THE PLAN INPUTS REQUIRE THEM ─────────────────────

test('D the select names start_time, end_time and the line\'s duration_minutes; the loaded row, the report row and the two mappers carry them as read; the plan inputs require them (nullable, never optional)', () => {
  const loader = code(LOADER);
  assert.match(loader, /start_date: true,\n\s*start_time: true, end_time: true,/, 'the two columns after the anchor');
  assert.match(loader, /steps: \{ where: \{ is_active: true \}, select: \{ id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true, duration_minutes: true \} \},/);
  assert.match(loader, /start_time: Date \| null; end_time: Date \| null;/, 'the loaded row\'s window, as read');
  assert.match(loader, /time_of_day: string \| null; duration_minutes: number \| null \}\[\];/, 'the loaded line\'s duration');
  assert.match(loader, /start_time: r\.start_time, end_time: r\.end_time,/, 'carried, no conversion');
  assert.match(loader, /time_of_day: s\.time_of_day === null \? null : s\.time_of_day\.toISOString\(\)\.slice\(11, 16\), duration_minutes: s\.duration_minutes \}\)\),/);
  assert.doesNotMatch(loader, /\?\? null|\|\| null/, 'no default');
  const inputs = code(INPUTS);
  assert.match(inputs, /readonly start_time: Date \| null;\n\s*readonly end_time: Date \| null;/, 'RoutineRow\'s window');
  assert.match(inputs, /readonly time_of_day: string \| null; readonly duration_minutes: number \| null \}\[\];/, 'RoutineRow\'s line duration');
  assert.match(inputs, /startTime: row\.start_time === null \? null : row\.start_time\.toISOString\(\),\n\s*endTime: row\.end_time === null \? null : row\.end_time\.toISOString\(\),/, 'the window as the @db.Time\'s JSON');
  assert.match(inputs, /coaCode: s\.coa_code, durationMinutes: s\.duration_minutes \}\)\),/, 'the line\'s duration, carried');
  const days = code(DAYS);
  assert.match(days, /readonly coaCode: string \| null; readonly durationMinutes: number \| null;\s*\n\}/, 'RoutineLinePlanInput requires it');
  assert.match(days, /readonly coaCode: string \| null; readonly startTime: string \| null; readonly endTime: string \| null;\s*\n\s*readonly steps: readonly RoutineLinePlanInput\[\];/, 'RoutinePlanInput requires both');
  assert.equal(days.split('\n').length, 497, 'days.ts keeps its line count — the fields sit on existing lines (days.ts:302 and :351-353 are cited by line elsewhere)');
  assert.doesNotMatch(days, /startTime\?:|endTime\?:|durationMinutes\?:/, 'required — null is stated, never absent');
  // tsc refuses a plan input that leaves them out (this file is type-checked).
  // @ts-expect-error — startTime and endTime are required
  const without: RoutinePlanInput = { id: 'r', name: 'R', entityId: 'e', entityType: 'personal', timezone: 'UTC', scheduleRrule: 'FREQ=DAILY', startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [] };
  // @ts-expect-error — durationMinutes is required
  const line: RoutineLinePlanInput = { id: 's', stepOrder: 1, budgetAmount: null, coaCode: null };
  assert.ok(without.id === 'r' && line.id === 's');
});

// ── E · THE ROUND TRIP: what 01b will read is what the rule already reads ───────────────────────────────────────────

test('E a loader row with start_time 10:00 and end_time 18:00 maps to the window\'s JSON, and plannedMinutesOf reads 480 from it; 22:00 → 02:00 is 240; null is null; a line\'s 45 is 45', () => {
  const t = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);
  const row = (start: Date | null, end: Date | null, duration: number | null) => toRoutineBudgetInput({
    id: 'r1', name: 'Work', is_active: true, role: 'execute', end_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0', timezone: 'UTC', start_date: null,
    start_time: start, end_time: end,
    steps: [{ id: 's1', is_active: true, budget_amount: null, coa_code: null, step_order: 1, activity: 'Write', time_of_day: null, duration_minutes: duration }],
  } as unknown as RoutineBudgetRow);
  const P = toReportEntity({ id: 'ent-p', name: 'Personal', entity_type: 'personal' });
  const plan = toRoutinePlanInput(row(t('10:00'), t('18:00'), 45) as RoutineRow, P);
  assert.deepEqual([plan.startTime, plan.endTime], ['1970-01-01T10:00:00.000Z', '1970-01-01T18:00:00.000Z']);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: plan.startTime, end_time: plan.endTime }), 480);
  assert.equal(plan.steps[0].durationMinutes, 45);
  assert.equal(plannedMinutesOf({ kind: 'line', duration_minutes: plan.steps[0].durationMinutes }), 45);
  const night = toRoutinePlanInput(row(t('22:00'), t('02:00'), null) as RoutineRow, P);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: night.startTime, end_time: night.endTime }), 240);
  assert.equal(plannedMinutesOf({ kind: 'line', duration_minutes: night.steps[0].durationMinutes }), null);
  const none = toRoutinePlanInput(row(null, null, null) as RoutineRow, P);
  assert.deepEqual([none.startTime, none.endTime], [null, null]);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: none.startTime, end_time: none.endTime }), null);
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan, 'the plan input stays wire-shaped — the window as text');
});

// ── F · CONSUMED BY NOTHING: the allowed sites, by file and regex; any other occurrence fails ─────────────────────────

test('F nothing consumes the three: under src/lib/budget, the loader and the plan leaves, and the five routes that read the loader, the names occur only at the declarations, the select, the types and the two mappers', () => {
  const ROUTES = ['src/app/api/budget/report/route.ts', 'src/app/api/budget/report/cell/route.ts', 'src/app/api/bill-pay/route.ts', 'src/app/api/operations/routines/month/route.ts', 'src/app/api/operations/plan-vendors/route.ts'];
  const LEAVES = ['src/lib/operations/routineBudget.ts', 'src/lib/operations/routineMonth.ts', 'src/lib/operations/billPay.ts', 'src/lib/operations/planVendor.ts', 'src/lib/operations/workBlock.ts'];
  const budgetFiles = walk('src/lib/budget');
  const allowed: Record<string, readonly RegExp[]> = {
    [DAYS]: [/readonly durationMinutes: number \| null;/, /readonly startTime: string \| null;/, /readonly endTime: string \| null;/],
    [INPUTS]: [/readonly start_time: Date \| null;/, /readonly end_time: Date \| null;/, /readonly duration_minutes: number \| null \}\[\];/, /startTime: row\.start_time === null \? null : row\.start_time\.toISOString\(\),/, /endTime: row\.end_time === null \? null : row\.end_time\.toISOString\(\),/, /durationMinutes: s\.duration_minutes \}\)\),/],
    [LOADER]: [/start_time: true, end_time: true,/, /time_of_day: true, duration_minutes: true \} \},/, /start_time: Date \| null; end_time: Date \| null;/, /duration_minutes: number \| null \}\[\];/, /start_time: r\.start_time, end_time: r\.end_time,/, /duration_minutes: s\.duration_minutes \}\)\),/],
  };
  const NAMES = /\b(startTime|endTime|durationMinutes|start_time|end_time|duration_minutes)\b/g;
  for (const f of [...budgetFiles, LOADER, ...LEAVES, ...ROUTES]) {
    let src = code(f);
    for (const re of allowed[f] ?? []) {
      assert.match(src, re, `${f}: the allowed site ${re} is there`);
      src = src.replace(re, '');
    }
    const left = [...src.matchAll(NAMES)].map((m) => m[1]);
    assert.deepEqual(left, [], `${f} reads ${left.join(', ')} — nothing consumes the three until 01b`);
  }
  // The travel leaf's own startTime/endTime/durationMinutes (travelDay.ts) and the ledger record input's durationMinutes
  // (ledger.ts, ledgerAnswer.ts's RECORD_PLAN) are other things by the same names — named here, not scanned.
});
