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
 *   · GET /api/operations/stops?day=<day>                 readStopRecords, here (STOP-01)
 *   · GET /api/operations/journal?day=<day>               readJournal, here (JOURNAL-01)
 *
 * The report's answer is read exactly as the week reads its own (readReport):
 * the body as BudgetReportResponse, a failure in the card's words. Every fetch
 * the card makes is here or in weekReads.ts; DayCard.tsx fetches nothing.
 */
import type { BudgetReportResponse } from '@/lib/budget/reportInputs';
import type { JournalRow } from '@/lib/operations/journal';
import type { StayRow } from '@/lib/operations/stay';
import type { StopRecordRow } from '@/lib/operations/stopRecord';
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

export interface StopRecordsAnswer {
  readonly records: readonly StopRecordRow[];
  /** Records whose routine's zone could not be read — named with the reason, never placed in UTC. */
  readonly unplaced: readonly { readonly record: StopRecordRow; readonly detail: string }[];
}

export const stopRecordsFailedWords = (words: string): string => `The stop records could not be read — ${words}`;

/** STOP-01: the day's stop records — done-at, what was paid, the rating, the note — each placed by its routine's own zone. */
export async function readStopRecords(day: string): Promise<Read<StopRecordsAnswer>> {
  const read = await readJson(`/api/operations/stops?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: stopRecordsFailedWords(read.words) };
  if (!Array.isArray(read.value.records) || !Array.isArray(read.value.unplaced)) return { ok: false, words: stopRecordsFailedWords('the records came back without their list') };
  return { ok: true, value: { records: read.value.records as StopRecordRow[], unplaced: read.value.unplaced as StopRecordsAnswer['unplaced'] } };
}

export interface JournalAnswer {
  /** The day's journal, or null when nothing was typed for the day. */
  readonly journal: JournalRow | null;
}

export const journalFailedWords = (words: string): string => `The journal could not be read — ${words}`;

/** JOURNAL-01: the day's journal — the morning's answers; a body without `journal` is a failure in words, never read as "none typed". */
export async function readJournal(day: string): Promise<Read<JournalAnswer>> {
  const read = await readJson(`/api/operations/journal?${new URLSearchParams({ day }).toString()}`);
  if (!read.ok) return { ok: false, words: journalFailedWords(read.words) };
  if (!('journal' in read.value)) return { ok: false, words: journalFailedWords('the journal came back without its row') };
  return { ok: true, value: { journal: read.value.journal as JournalRow | null } };
}
