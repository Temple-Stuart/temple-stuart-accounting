/**
 * routineRekey — HISTORY FOLLOWS THE TIME (ROUTINE-02b, Alex, 2026-10-18).
 *
 * Four tables are keyed to a routine's occurrence instants: its completions
 * (expected_at), its stop records (occurrence_at), its single-occurrence plan
 * vendors (occurrence_at) and the postings linked to an occurrence
 * (planned_item_links.target_instant). When the routine's clock (the start
 * time → BYHOUR/BYMINUTE) or its zone changes, every one of those instants
 * would match no stop any more — the day cards, the ledger and the reel would
 * show the old clock's history stranded (STAYS-00 Q2). So the PATCH moves them,
 * day by day, old instant → new instant on the SAME local day, in one
 * transaction with the routine's own row. This file is the pure rule the route
 * applies: which instants move where, which are not on the old clock (left
 * where they are, counted — RETRO-01's attach is their repair), and the two
 * refusals, by name: a day the new rule has no occurrence on, and (the route's,
 * proven inside the transaction) a target already occupied.
 *
 * THE DAY is the instant's local day in the OLD zone; the new instant is the
 * NEW rule's occurrence on that calendar day in the NEW zone (routineDay — the
 * day card's own reader), so 18:00 Bangkok on Oct 14 becomes 18:00 Makassar on
 * Oct 14. An instant is on the old clock iff the old rule's occurrence on its
 * day IS that instant. Pure: no Prisma, no request, no clock but the caller's.
 *
 * EDIT-02 (Alex, 2026-11-28) — A ONE-OFF MOVES WITH ITS DATE (rekeyOneOffDate). A one-off happens once: every row keyed to it sits at its one
 * occurrence. When its date moves (a one-off staying a one-off), each of those rows moves to the one occurrence of the moved one-off — routineDay
 * over its new start day, with its new clock and zone — in the same transaction, with the same proof and the same writes as a clock's move. A row
 * that is not at the old one occurrence is refused by name, nothing moved. The plan is rekeyPlan's own shape.
 */
import { instantToZoned } from '@/lib/time';
import { routineDay, type RoutineDayInput } from './routineDay';
import { isOnceRRule } from './rruleHelpers';

/** What the rule reads of a routine's schedule — the day card's own input. */
export type RekeySchedule = RoutineDayInput;

/** One day's move: the old instant and the new, on the same local day — EDIT-02 (2026-11-28): a one-off's date move names the day it moves to. */
export interface RekeyMove {
  readonly day: string;
  readonly from: Date;
  readonly to: Date;
}

export type RekeyPlan =
  | { readonly ok: true; readonly moves: readonly RekeyMove[]; readonly notOnOldClock: readonly Date[] }
  | { readonly ok: false; readonly status: 400; readonly message: string };

/** The four tables, as the answer and the audit row count them. */
export interface RekeyCounts {
  readonly days: number;
  readonly completions: number;
  readonly stop_records: number;
  readonly plan_vendors: number;
  readonly plan_links: number;
  /** Rows at instants not on the old clock — left where they are. */
  readonly not_on_old_clock: number;
}

export const REKEY_TABLE_WORDS: Readonly<Record<'completions' | 'stop_records' | 'plan_vendors' | 'plan_links', string>> = {
  completions: 'completion',
  stop_records: 'stop record',
  plan_vendors: 'plan vendor',
  plan_links: 'plan link',
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Day and time of an instant in a zone, for the words. */
const atWords = (instant: Date, zone: string): string => {
  try {
    const z = instantToZoned(instant, zone);
    return `${z.date} ${z.time} ${zone}`;
  } catch {
    return instant.toISOString();
  }
};

/** The new rule has no occurrence on a day that holds rows — refused by name. */
export const noOccurrenceWords = (day: string, rows: number): string =>
  `cannot move the routine's history: the new rule has no occurrence on ${day}, where ${rows} ${rows === 1 ? 'row sits' : 'rows sit'} — keep that day in the rule, or clear those rows first`;
/** A target already occupied — refused by name (the route proves it inside the transaction). */
export const occupiedWords = (table: keyof typeof REKEY_TABLE_WORDS, to: Date, zone: string): string =>
  `cannot move the routine's history: a ${REKEY_TABLE_WORDS[table]} already sits at ${atWords(to, zone)} — clear one of the two first`;
/** The old zone cannot be read — nothing can be placed on a day. */
export const oldZoneUnreadWords = (zone: string, detail: string): string =>
  `cannot move the routine's history: its zone ${JSON.stringify(zone)} is not one Intl reads (${detail}) — pick a listed zone first`;

/**
 * The plan: for every distinct instant, its day in the old zone; on the old
 * clock iff the old rule's occurrence that day is the instant; the new rule's
 * occurrence that day is where it goes. `now` is routineDay's — it reads it
 * only for a day of null, never here.
 */
export function rekeyPlan(before: RekeySchedule, after: RekeySchedule, instants: readonly Date[], now: Date): RekeyPlan {
  const distinct = [...new Map(instants.map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
  const moves: RekeyMove[] = [];
  const notOnOldClock: Date[] = [];
  const rowsByDay = new Map<string, number>();
  for (const instant of distinct) {
    let day: string;
    try {
      day = instantToZoned(instant, before.timezone).date;
    } catch (error) {
      return { ok: false, status: 400, message: oldZoneUnreadWords(before.timezone, messageOf(error)) };
    }
    const old = routineDay(before, day, now);
    if (old.kind === 'refused') return { ok: false, status: 400, message: `cannot move the routine's history: ${old.reason} — ${old.detail}` };
    if (old.kind === 'none' || old.expectedAt.getTime() !== instant.getTime()) {
      notOnOldClock.push(instant);
      continue;
    }
    rowsByDay.set(day, instants.filter((d) => d.getTime() === instant.getTime()).length);
    const next = routineDay(after, day, now);
    if (next.kind === 'refused') return { ok: false, status: 400, message: `cannot move the routine's history: ${next.reason} — ${next.detail}` };
    if (next.kind === 'none') return { ok: false, status: 400, message: noOccurrenceWords(day, rowsByDay.get(day) ?? 1) };
    // The same instant under the new rule is no move (a zone that only changed its spelling, a clock change on a day it does not touch).
    if (next.expectedAt.getTime() === instant.getTime()) continue;
    moves.push({ day, from: instant, to: next.expectedAt });
  }
  // Two days never share a target: a target is the new rule's one occurrence on its own day.
  const targets = new Set(moves.map((m) => m.to.getTime()));
  if (targets.size !== moves.length) return { ok: false, status: 400, message: "cannot move the routine's history: two days would share one instant under the new rule" };
  return { ok: true, moves, notOnOldClock };
}

/** EDIT-02 (2026-11-28): a row of a one-off that is not at its one occurrence — its date cannot carry it; refused by name. */
export const ONE_OFF_ROWS_OFF_DAY_WORDS = "cannot move the routine's history: a row sits off the one-off's day";

/**
 * EDIT-02 (Alex, 2026-11-28): the plan of a one-off's date move. Both schedules are one-offs (rruleHelpers.ts isOnceRRule) holding their date —
 * anything else is the caller's error, thrown by name: a rule that repeats moves by rekeyPlan. Every instant must be the old one occurrence
 * (routineDay over the old start day) — else ONE_OFF_ROWS_OFF_DAY_WORDS, nothing moved; each moves to the new one occurrence (routineDay over the new
 * start day, its clock, its zone), routineDay's own refusals said. routineDay reads its `now` only to prove the zone readable — the day is handed in —
 * so each schedule's own start date serves: no clock is read.
 */
export function rekeyOneOffDate(before: RekeySchedule, after: RekeySchedule, instants: readonly Date[]): RekeyPlan {
  if (!isOnceRRule(before.schedule_rrule) || !isOnceRRule(after.schedule_rrule)) throw new Error("routineRekey: a one-off's date move reads two one-offs — a rule that repeats moves by rekeyPlan");
  if (before.start_date === null || after.start_date === null) throw new Error("routineRekey: a one-off holds its date — a schedule with none has no day to move from or to");
  const distinct = [...new Map(instants.map((d) => [d.getTime(), d])).values()];
  const oldDay = before.start_date.toISOString().slice(0, 10);
  const old = routineDay(before, oldDay, before.start_date);
  if (old.kind === 'refused') return { ok: false, status: 400, message: `cannot move the routine's history: ${old.reason} — ${old.detail}` };
  if (distinct.length === 0) return { ok: true, moves: [], notOnOldClock: [] };
  if (old.kind === 'none' || distinct.some((d) => d.getTime() !== old.expectedAt.getTime())) return { ok: false, status: 400, message: ONE_OFF_ROWS_OFF_DAY_WORDS };
  const newDay = after.start_date.toISOString().slice(0, 10);
  const next = routineDay(after, newDay, after.start_date);
  if (next.kind === 'refused') return { ok: false, status: 400, message: `cannot move the routine's history: ${next.reason} — ${next.detail}` };
  if (next.kind === 'none') return { ok: false, status: 400, message: noOccurrenceWords(newDay, instants.length) };
  if (next.expectedAt.getTime() === old.expectedAt.getTime()) return { ok: true, moves: [], notOnOldClock: [] };
  return { ok: true, moves: [{ day: newDay, from: old.expectedAt, to: next.expectedAt }], notOnOldClock: [] };
}

/** The route's refusal, thrown inside the transaction so nothing is written: 400 (no occurrence) or 409 (a target occupied). */
export class RekeyRefused extends Error {
  constructor(readonly status: 400 | 409, message: string) {
    super(message);
    this.name = 'RekeyRefused';
  }
}

/** The audit row's and the answer's words. */
export const rekeyedWords = (name: string, fromClock: string, toClock: string, fromZone: string, toZone: string, counts: RekeyCounts): string =>
  `Moved the history of routine "${name}" with its time: ${fromClock} ${fromZone} → ${toClock} ${toZone} — ${counts.stop_records} stop records, ${counts.completions} completions, ${counts.plan_vendors} plan vendors, ${counts.plan_links} plan links on ${counts.days} days${counts.not_on_old_clock > 0 ? `; ${counts.not_on_old_clock} not on the old clock, left` : ''}`;
