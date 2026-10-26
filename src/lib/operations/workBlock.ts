/**
 * workBlock — THE WORK BLOCK'S RULES, PURE (WORK-02, Alex, 2026-10-26).
 *
 * On the day card's step view, when the focused stop's role is `execute`, THE WORK BLOCK mounts between the VENDOR row
 * and the stop's record form — for no other role, never on the journal card (ruling A; showsWorkBlock). Two parts:
 *
 *   · TO DO — the open tasks of the open projects from the card's EXISTING backlog read (dayReads.ts readBacklog — THE
 *     LOG's read, one truth), grouped under their project in THE LOG's order, each with one ✓: the existing quick-complete
 *     (projects/useTaskActions.ts completeTask — the one writer, lifted, never a copied fetch). After a write the card
 *     reads the backlog again, so TO DO and DONE both move (ruling B).
 *   · DONE IN THIS BLOCK — the tasks whose completed_at falls inside the block's window: [the stop's planned instant,
 *     that instant + the line's minutes] — the day card's own minutes rule (dayCard.ts `minutes`: a line's
 *     duration_minutes; a stepless routine none) and its clock (the stop's time in the routine's zone on the card's day,
 *     the lateness rule's planned instant). A block with no minutes lists nothing and says NO_LENGTH_WORDS — declared,
 *     never guessed. Each done row is "<title> · <HH:MM in the viewer's zone>" with ↩ (the existing uncomplete POST,
 *     uncompleteTask). DERIVED from completed_at and labelled so (DONE_BY_WORDS) (ruling C).
 *   · The read for DONE (ruling D): the projects GET takes ?done_from=&done_to= (ISO instants, both or neither — the
 *     refusals here, doneWindowInput) and answers done_tasks per project; the card asks for the DAY's bounds in the
 *     viewer's zone (dayWindowOf — the WHAT MOVED TODAY window) and the panel narrows to the block here (doneInBlockOf).
 *
 * WORK-03 (Alex, 2026-10-26) — THE BLOCK REACHES THE REEL. The day card hands the reel each execute stop's done tasks
 * (doneInBlocksOf — the day's done tasks from the backlog read, narrowed per stop by the two rules above); the reel's scene
 * and caption lines are dayCard.ts's. WORK-02 call 4 (ruled): a block of no minutes OR of ≤ 0 minutes has no length —
 * blockWindowOf answers null for both, the panel says the same words; the words gain nothing.
 *
 * Pure: no fetch, no React; the clocks are src/lib/time's. The tests drive every rule (work02.test.ts, work03.test.ts).
 */
import { zonedToInstant, instantToZoned } from '@/lib/time';
import { shiftDay } from '@/lib/budget/reportView';
import type { StopRole } from '@/lib/operations/stopRole';
import type { LogDoneTask, LogProject } from '@/lib/operations/morningLog';

// ── A · WHERE IT MOUNTS ──────────────────────────────────────────────────────

/** The one role the block mounts on. */
export const showsWorkBlock = (stop: { readonly role: StopRole }): boolean => stop.role === 'execute';

// ── C · THE WINDOW ───────────────────────────────────────────────────────────

/** What the window rule reads of a stop — the day card's Stop (dayCard.ts) satisfies it. */
export interface BlockStop {
  readonly key: string;
  readonly role: StopRole;
  /** 'HH:MM' in the routine's zone — the card's clock for the stop; null when nothing states a time. */
  readonly time: string | null;
  /** The routine's zone; null for a task. */
  readonly zone: string | null;
  /** The line's duration_minutes; null for a stepless routine, a line that states none, and a task. */
  readonly minutes: number | null;
}

export interface BlockWindow {
  readonly from: Date;
  readonly to: Date;
}

/**
 * [the stop's planned instant, + the line's minutes]: the planned instant is the stop's clock in the routine's zone on
 * the card's day (dayCard.ts draws the lateness from the same instant); null without minutes — the block has no length —
 * and (WORK-03, WORK-02 call 4 ruled 2026-10-26) null for ≤ 0 minutes too: a zero or negative length is no length.
 * A stop with minutes but no clock is the card's error, thrown by name.
 */
export function blockWindowOf(stop: BlockStop, day: string): BlockWindow | null {
  if (stop.minutes === null || stop.minutes <= 0) return null;
  if (!Number.isInteger(stop.minutes)) throw new Error(`workBlock: ${stop.key} has ${stop.minutes} minutes — a whole number of minutes, or none`);
  if (stop.time === null || stop.zone === null) throw new Error(`workBlock: ${stop.key} has minutes but no clock — a block starts at the stop's planned instant`);
  const from = zonedToInstant(day, stop.time, stop.zone);
  return { from, to: new Date(from.getTime() + stop.minutes * 60_000) };
}

/** The tasks done inside the window — completed_at in [from, to], both ends in — earliest first, then by title. A completed_at that is no instant is the route's error, thrown by name. */
export function doneInBlockOf<T extends LogDoneTask>(tasks: readonly T[], block: BlockWindow): T[] {
  const at = (t: T): number => {
    const ms = Date.parse(t.completedAt);
    if (Number.isNaN(ms)) throw new Error(`workBlock: task ${t.id} completed_at ${JSON.stringify(t.completedAt)} is not an instant`);
    return ms;
  };
  return tasks.filter((t) => at(t) >= block.from.getTime() && at(t) <= block.to.getTime()).sort((a, b) => at(a) - at(b) || a.title.localeCompare(b.title));
}

/** WORK-03: every project carries its done tasks — the read was asked with the window (dayReads.ts readBacklog); false when the card read the backlog without one. */
export const carriesDoneTasks = (projects: readonly Pick<LogProject, 'title' | 'doneTasks'>[]): boolean => projects.every((p) => p.doneTasks !== undefined);
/** WORK-03: no execute stop's list yet — the reel's `done` until the backlog read is in (the reel waits on it by name). */
export const NO_DONE_IN_BLOCKS: ReadonlyMap<string, readonly LogDoneTask[]> = new Map();
/**
 * WORK-03 (Alex, 2026-10-26): the tasks done in EACH execute stop's block, by the stop's key — the day's done tasks (every
 * project's, from the backlog read with the day's window) narrowed per stop by blockWindowOf and doneInBlockOf, so a stop with
 * no length maps to none. Only the execute stops are keyed (showsWorkBlock). A project read without its done tasks is the
 * card's error, thrown by name — the card asks for the day's window on a day with an execute stop.
 */
export function doneInBlocksOf(stops: readonly BlockStop[], day: string, projects: readonly Pick<LogProject, 'title' | 'doneTasks'>[]): ReadonlyMap<string, readonly LogDoneTask[]> {
  const all: LogDoneTask[] = [];
  for (const p of projects) {
    if (p.doneTasks === undefined) throw new Error(`workBlock: "${p.title}" was read without its done tasks — the card asks for the day's window on a day with an execute stop`);
    all.push(...p.doneTasks);
  }
  const map = new Map<string, readonly LogDoneTask[]>();
  for (const s of stops) {
    if (!showsWorkBlock(s)) continue;
    const block = blockWindowOf(s, day);
    map.set(s.key, block === null ? [] : doneInBlockOf(all, block));
  }
  return map;
}
/** "HH:MM" — the completion's clock in the viewer's zone (the day card draws a record's done-at the same way). */
export const doneTimeWords = (completedAt: string, viewerZone: string): string => instantToZoned(new Date(completedAt), viewerZone).time;

// ── D · THE GET'S WINDOW ─────────────────────────────────────────────────────

export type DoneWindowField = 'done_from' | 'done_to';
export type DoneWindowInput =
  | { readonly kind: 'none' }
  | { readonly kind: 'window'; readonly from: Date; readonly to: Date }
  | { readonly kind: 'refused'; readonly field: DoneWindowField; readonly message: string };

/** An ISO instant as the card writes one — Date.toISOString(): 'YYYY-MM-DDTHH:MM:SS.sssZ' (the fraction optional), and a real moment. */
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
export const isIsoInstant = (value: string): boolean => INSTANT_RE.test(value) && !Number.isNaN(Date.parse(value));

export const withoutTheOtherWords = (given: DoneWindowField, missing: DoneWindowField): string => `${given} is given without ${missing} — both or neither`;
export const notAnInstantWords = (field: DoneWindowField, raw: string): string => `${field} ${JSON.stringify(raw)} is not an ISO instant (YYYY-MM-DDTHH:MM:SS.sssZ)`;
export const windowOrderWords = (from: string, to: string): string => `done_from ${from} is after done_to ${to}`;

/** The projects GET's two optional params: none → no window; both, ISO instants, in order → the window; anything else refused by name. */
export function doneWindowInput(fromRaw: string | null, toRaw: string | null): DoneWindowInput {
  if (fromRaw === null && toRaw === null) return { kind: 'none' };
  if (fromRaw === null) return { kind: 'refused', field: 'done_from', message: withoutTheOtherWords('done_to', 'done_from') };
  if (toRaw === null) return { kind: 'refused', field: 'done_to', message: withoutTheOtherWords('done_from', 'done_to') };
  if (!isIsoInstant(fromRaw)) return { kind: 'refused', field: 'done_from', message: notAnInstantWords('done_from', fromRaw) };
  if (!isIsoInstant(toRaw)) return { kind: 'refused', field: 'done_to', message: notAnInstantWords('done_to', toRaw) };
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (from.getTime() > to.getTime()) return { kind: 'refused', field: 'done_from', message: windowOrderWords(fromRaw, toRaw) };
  return { kind: 'window', from, to };
}

/** The day's bounds in the viewer's zone — midnight to the last millisecond before the next midnight (the card's WHAT MOVED TODAY window). */
export function dayWindowOf(day: string, viewerZone: string): BlockWindow {
  const from = zonedToInstant(day, '00:00', viewerZone);
  const to = new Date(zonedToInstant(shiftDay(day, 1), '00:00', viewerZone).getTime() - 1);
  return { from, to };
}

// ── THE WORDS ────────────────────────────────────────────────────────────────

export const WORK_BLOCK_WORD = 'THE WORK BLOCK';
export const TO_DO_WORD = 'TO DO';
export const DONE_IN_BLOCK_WORD = 'DONE IN THIS BLOCK';
/** The tooltip on DONE IN THIS BLOCK — the list is derived from completed_at, and says so. */
export const DONE_BY_WORDS = 'by completed_at';
/** A block with no minutes, or ≤ 0 (WORK-03, call 4): declared, never guessed. */
export const NO_LENGTH_WORDS = "this block has no length — set the line's minutes on /expenses to count what was done in it";
export const NOTHING_DONE_WORDS = '— nothing done in this block yet —';
/** The done tasks were not read with the backlog (the card asks for them on a day with an execute stop) — said, never an empty list. */
export const DONE_NOT_READ_WORDS = 'the tasks done today were not read with the backlog';
export const TICK_WORDS = '✓';
export const UNTICK_WORDS = '↩';
export const tickWords = (title: string): string => `done: ${title}`;
export const untickWords = (title: string): string => `not done after all: ${title}`;
/** The reason the uncomplete POST records — a mis-tick undone where it was made. */
export const UNTICK_REASON_WORDS = 'unticked on the work block';
/** "<task title> · <HH:MM>" */
export const doneRowWords = (title: string, time: string): string => `${title} · ${time}`;
