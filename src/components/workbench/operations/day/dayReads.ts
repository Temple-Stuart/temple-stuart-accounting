/**
 * dayReads — the day card's one read of its own (DAYCARD-01, 2026-10-11).
 *
 * The card reads three things for one day, all through the week's reader
 * (week/weekReads.ts readJson — the one way an answer is read: ok, or the
 * route's own words; signed out by name; nothing filled in):
 *
 *   · GET /api/operations/routines/today?date=<day>       weekReads.readDay
 *   · GET /api/operations/daily-plan/items?from=&to=      weekReads.readItems(day, day)
 *   · GET /api/budget/report?view=day&day=&asOf=          readDayReport, here
 *   · GET /api/operations/stays?day=<day>                 readStays, here (STAY-01)
 *
 * The report's answer is read exactly as the week reads its own (readReport):
 * the body as BudgetReportResponse, a failure in the card's words. Every fetch
 * the card makes is here or in weekReads.ts; DayCard.tsx fetches nothing.
 */
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import type { StayRow } from '@/lib/operations/stay';
import { readJson, type Read } from '../week/weekReads';

export const dayReportFailedWords = (words: string): string => `The day's amounts and places could not be read — ${words}`;

/** The day's budget report — its plan lines (amounts, vendors) and what it could not place (asOf: the browser's date). */
export async function readDayReport(day: string, asOf: string): Promise<Read<BudgetReportResponse>> {
  const query = new URLSearchParams({ view: 'day', day, asOf });
  const read = await readJson(`/api/budget/report?${query.toString()}`);
  if (!read.ok) return { ok: false, words: dayReportFailedWords(read.words) };
  return { ok: true, value: read.value as unknown as BudgetReportResponse };
}

export interface StaysAnswer {
  readonly stays: readonly StayRow[];
  readonly covering: StayRow | null;
}

export const staysFailedWords = (words: string): string => `The stay could not be read — ${words}`;

/** STAY-01: the caller's stays and the one covering the day — DAY n OF m and the place on the plate. */
export async function readStays(day: string): Promise<Read<StaysAnswer>> {
  const read = await readJson(`/api/operations/stays?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: staysFailedWords(read.words) };
  if (!Array.isArray(read.value.stays) || !('covering' in read.value)) return { ok: false, words: staysFailedWords('the stays came back without their list') };
  return { ok: true, value: { stays: read.value.stays as StayRow[], covering: read.value.covering as StayRow | null } };
}
