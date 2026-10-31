/**
 * DOCUMENTS-02 (Alex, 2026-10-30, ruling F) — A PERIOD IS A MONTH, SAID AS A STRING.
 *
 * On the wire a reconciliation's period is 'YYYY-MM' — in and out. A statement's address is the first
 * of that month, 'YYYY-MM-01' (source_documents.period_month, a DATE). The month's last day is calendar
 * arithmetic on the string — never `new Date(y, m, 0)` in the server's zone, never an ISO instant standing
 * for a day. year and month stay the row's storage, derived from the string (slice), never from
 * `new Date(...).getMonth()`. The month in words is en-US: "October 2026".
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock, no React.
 */

export interface Period {
  /** 'YYYY-MM' */
  readonly period: string;
  readonly year: number;
  readonly month: number;
  /** 'YYYY-MM-01' — the statement's address, a DATE. */
  readonly period_month: string;
  /** 'YYYY-MM-DD' — the month's last day. */
  readonly period_end: string;
  /** "October 2026" */
  readonly words: string;
}

export interface PeriodRefusal { readonly ok: false; readonly status: 400; readonly error: string }

export const MONTH_WORDS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const BAD_PERIOD_WORDS = "period is 'YYYY-MM' — a month";

const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The days in a month, by the calendar — February's by the leap rule. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const two = (n: number): string => String(n).padStart(2, '0');

/** A period from its parts. */
export function periodOf(year: number, month: number): Period {
  const period = `${year}-${two(month)}`;
  return {
    period, year, month,
    period_month: `${period}-01`,
    period_end: `${period}-${two(daysInMonth(year, month))}`,
    words: `${MONTH_WORDS[month - 1]} ${year}`,
  };
}

/** The wire's period, 'YYYY-MM', or a refusal by name. */
export function periodRule(raw: unknown): { ok: true; value: Period } | PeriodRefusal {
  if (typeof raw !== 'string') return { ok: false, status: 400, error: BAD_PERIOD_WORDS };
  const m = PERIOD.exec(raw.trim());
  if (m === null) return { ok: false, status: 400, error: BAD_PERIOD_WORDS };
  return { ok: true, value: periodOf(Number(m[1]), Number(m[2])) };
}

/** A @db.Date read back by Prisma is UTC midnight of its day; its period is that day's month. */
export function periodOfDay(day: string): Period {
  return periodOf(Number(day.slice(0, 4)), Number(day.slice(5, 7)));
}

/** The calendar month before the one holding `today` ('YYYY-MM-DD', the UTC day) — the month to reconcile. */
export function previousMonthOf(today: string): Period {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  return m === 1 ? periodOf(y - 1, 12) : periodOf(y, m - 1);
}

/** The UTC day of an instant, 'YYYY-MM-DD' — how a @db.Date column reads (reportInputs.ts:91). */
export const utcDayOf = (d: Date): string => d.toISOString().slice(0, 10);
