/**
 * weekReads — the week's four reads, and the one way their answers are read
 * (WEEK-01, 2026-09-30). Every fetch the week makes of its own is here; the
 * completion is the shared writer (routines/completeRoutine.ts) and the vendor
 * box's writes are Budget's own (DayPlanDrill.tsx VendorBox, useDirectory).
 *
 *   · GET /api/operations/routines?is_active=true         the rows
 *   · GET /api/operations/routines/today?date=<day>       one per day — seven
 *   · GET /api/budget/report?view=week&weekOf=&asOf=      the week's plan lines and their vendors
 *   · GET /api/operations/daily-plan/items?from=&to=      the week's scheduled tasks
 *
 * An answer is ok, or the route's own words: a redirect or a 401 is signed out;
 * a refusal is `<error>: <message>`; a request that never reached the server,
 * or an answer that is not JSON, says so. Nothing is filled in.
 */
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import type { DailyPlanItem } from '../dailyplan/types';
import type { RefusedRoutine, Routine, TodayRoutineEntry } from '../routines/types';

export type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly words: string };

export const SIGNED_OUT_WORDS = 'You are signed out — sign in to see this week.';

async function readJson(url: string): Promise<Read<Record<string, unknown>>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', redirect: 'manual' });
  } catch (error) {
    return { ok: false, words: `the request did not reach the server: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.type === 'opaqueredirect' || res.status === 401) return { ok: false, words: SIGNED_OUT_WORDS };
  const type = res.headers.get('content-type');
  if (type === null || !type.includes('application/json')) return { ok: false, words: `the route answered ${res.status} with no JSON` };
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch (error) {
    return { ok: false, words: `the answer could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.ok) return { ok: true, value: body };
  const words = typeof body.message === 'string'
    ? (typeof body.error === 'string' ? `${body.error}: ${body.message}` : body.message)
    : typeof body.error === 'string' ? body.error : `the route answered ${res.status}`;
  return { ok: false, words };
}

/** The rows: every active routine. */
export async function readRoutines(): Promise<Read<Routine[]>> {
  const read = await readJson('/api/operations/routines?is_active=true');
  if (!read.ok) return read;
  if (!Array.isArray(read.value.routines)) return { ok: false, words: 'the routines came back without their list' };
  return { ok: true, value: read.value.routines as Routine[] };
}

export interface DayAnswer {
  readonly entries: readonly TodayRoutineEntry[];
  readonly refused: readonly RefusedRoutine[];
}

/** One day: each routine's occurrence on that local day, and the routines it could not place. */
export async function readDay(day: string): Promise<Read<DayAnswer>> {
  const read = await readJson(`/api/operations/routines/today?date=${encodeURIComponent(day)}`);
  if (!read.ok) return read;
  if (!Array.isArray(read.value.entries) || !Array.isArray(read.value.refused)) return { ok: false, words: `the day ${day} came back without its entries or its refused list` };
  return { ok: true, value: { entries: read.value.entries as TodayRoutineEntry[], refused: read.value.refused as RefusedRoutine[] } };
}

/** The week's budget report — its plan lines and their vendors (asOf: the browser's date). */
export async function readReport(weekOf: string, asOf: string): Promise<Read<BudgetReportResponse>> {
  const query = new URLSearchParams({ view: 'week', weekOf, asOf });
  const read = await readJson(`/api/budget/report?${query.toString()}`);
  if (!read.ok) return { ok: false, words: `The week's amounts and places could not be read — ${read.words}` };
  return { ok: true, value: read.value as unknown as BudgetReportResponse };
}

/** The week's daily-plan items — the tasks scheduled on each day. */
export async function readItems(from: string, to: string): Promise<Read<DailyPlanItem[]>> {
  const read = await readJson(`/api/operations/daily-plan/items?${new URLSearchParams({ from, to }).toString()}`);
  if (!read.ok) return read;
  if (!Array.isArray(read.value.items)) return { ok: false, words: 'the daily plan came back without its items' };
  return { ok: true, value: read.value.items as DailyPlanItem[] };
}
