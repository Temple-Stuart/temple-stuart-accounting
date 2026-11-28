/**
 * pasteSave — THE SAVE: THE PASTED ROWS GO ONTO THE TIME SHEET, THROUGH THE WRITERS THAT EXIST (PASTE-02, Alex, 2026-11-27).
 *
 * "i gave you a spread sheet data i want to see, and im still seeing the old data" (2026-11-25).
 *
 * PASTE-01 reads the rows of his sheet on /time and shows where each lands (pasteRows.ts), and writes nothing. This is the write's
 * rule: one button over the preview (ledger/PasteRows.tsx), through the routes "+ expense" and a row's own forms already write to,
 * and the line route's PATCH — no new route, no migration, no column.
 *
 * PURE: no fetch, no clock, no Prisma — the writers are handed in. Here, in order:
 *   1. THE WRITES — the placed rows that have something to write, in the paste's order (pasteWritesOf).
 *   2. A ROW'S STEPS — on a stop that stands: the vendor added to the book (a new name), the vendor on the stop, the record. A new
 *      one-off: the stop, its line read back, the stop's minutes, the vendor added, the vendor on the stop, the record.
 *   3. THE ONE RUNNER (runPaste) — a row at a time. A write a route refuses STOPS the save: that row says the step and the route's
 *      own words, and every row after it is not tried. Nothing is retried and nothing is undone.
 *   4. THE WORDS — the button, the names a save would add, each row's outcome, the run's line.
 * A new vendor is added ONCE a save, however many rows name it. The paste never writes over what stands: pasteRows.ts places a row
 * so that it writes only what its stop lacks, so what is in is never written twice — a save that stopped is finished by reading
 * the rows and saving again. Every word the save prints is typed here, once.
 *
 * COALEVELS-01 (Alex, 2026-11-27) — THE SAVE WRITES FOUR THINGS MORE (it carries TIMESHEET-04c, which was written and never run on
 * its own): the additions to the chart — a sub-account for a Type that has none under its account — FIRST, before any row, and a refusal
 * of one is said on its line and stops nothing (a stop's name is its Type either way); a row's planned items, WITH its vendor's
 * write; its vendor's Instagram tag, after the vendor and before the record; and a one-off's record carries the row's notes. Nine
 * steps, eight writers. Still pure, still one runner.
 */
import { NOT_TRIED_WORDS, STEP_WORDS, oneOffBody, recordBody, vendorBody, type BookWord, type ExpenseValues, type LedgerAddress } from '@/lib/operations/ledger';
import type { PasteChartAdd, PastePlacement, PasteRecordBody, PasteRow, PasteShownRow, PastedTag, PastedVendor } from '@/lib/operations/pasteRows';
import { vendorNameKey } from '@/lib/operations/planVendor';

// ── 1 · THE WRITES ──────────────────────────────────────────────────────────

/** A book as a write names it: its id (the routes') and its word (the page's). */
export interface PasteWriteBook {
  readonly id: string;
  readonly word: BookWord;
}

/**
 * What ONE placed row writes. `stop`: a row on a stop that stands — the sheet row's own address, and the record's body or null.
 * `oneOff`: a new one-off — "+ expense"'s own values for it, its minutes or null, whether it is recorded went, and the notes of
 * that record. Both carry the row's number in the paste, its day, its book, its vendor (none · the book's own · new to the book ·
 * standing), the tag it sets on its vendor or null, and the planned items it writes or null.
 */
export type PasteWrite =
  | { readonly kind: 'stop'; readonly row: number; readonly day: string; readonly book: PasteWriteBook; readonly vendor: PastedVendor; readonly tag: PastedTag | null; readonly items: string | null; readonly address: LedgerAddress; readonly record: PasteRecordBody | null }
  | { readonly kind: 'oneOff'; readonly row: number; readonly day: string; readonly book: PasteWriteBook; readonly vendor: PastedVendor; readonly tag: PastedTag | null; readonly items: string | null; readonly values: ExpenseValues; readonly minutes: number | null; readonly went: boolean; readonly notes: string | null };

/**
 * THE WRITES of a paste: the placed rows that have something to write, in the paste's order. A row on a stop is one when it has a
 * vendor (the book's own, new, or the stop's standing one — named to carry planned items), a record's body, or a tag to set; every
 * new one-off is one. A row on a stop with none of the three — its vendor and its record already stand, or it holds none — is
 * not. The placements are placePaste's, row for row.
 */
export function pasteWritesOf(rows: readonly Pick<PasteRow, 'number'>[], placements: readonly PastePlacement[]): PasteWrite[] {
  if (placements.length !== rows.length) throw new Error(`pasteSave: ${placements.length} placements for ${rows.length} rows — one placement a row`);
  const writes: PasteWrite[] = [];
  placements.forEach((placement, i) => {
    const row = rows[i].number;
    if (placement.kind === 'plan') {
      if (placement.vendor.kind === 'none' && placement.record === null && placement.tag === null) return;
      writes.push({ kind: 'stop', row, day: placement.stop.day, book: { id: placement.book.id, word: placement.book.word }, vendor: placement.vendor, tag: placement.tag, items: placement.items, address: placement.stop.address, record: placement.record });
    } else if (placement.kind === 'oneOff') {
      writes.push({
        kind: 'oneOff', row, day: placement.values.day, book: { id: placement.book.id, word: placement.book.word }, vendor: placement.vendor, tag: placement.tag, items: placement.items,
        values: placement.values, minutes: placement.minutes, went: placement.happened.kind === 'went', notes: placement.happened.kind === 'went' ? placement.happened.notes : null,
      });
    }
  });
  return writes;
}

/** A sub-account a save adds to the chart: its account's id, that account as it renders, its code and its name. */
export interface PasteAdd {
  readonly accountId: string;
  readonly rendered: string;
  readonly code: string;
  readonly name: string;
}
/** THE ADDITIONS a save writes: those pasteRows.ts chartAddsOf listed that took a code — one with none (no ten is left) is said where it is listed, and not written. */
export const pasteAddsOf = (listed: readonly PasteChartAdd[]): PasteAdd[] =>
  listed.flatMap((add) => (add.code === null ? [] : [{ accountId: add.accountId, rendered: add.rendered, code: add.code, name: add.name }]));

// ── 2 · A ROW'S STEPS ───────────────────────────────────────────────────────

/** The save's steps, in the order they run — the chart's addition first, before any row; then a row's, each only when the row has it. COALEVELS-01 (2026-11-27): nine — 'sub-account' at the head, 'items' and 'tag' after 'vendor'; six until then. */
export const PASTE_STEPS = ['sub-account', 'stop', 'line', 'minutes', 'directory', 'vendor', 'items', 'tag', 'record'] as const;
export type PasteStep = (typeof PASTE_STEPS)[number];
/** Their words are "+ expense"'s own (ledger.ts STEP_WORDS), and four more. */
export const PASTE_STEP_WORDS: Readonly<Record<PasteStep, string>> = { ...STEP_WORDS, 'sub-account': 'the sub-account', minutes: "the stop's minutes", items: 'the planned items', tag: "the vendor's Instagram tag" };

/** A writer's answer: what came back, or the route's own words. */
export type PasteAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly words: string };

/**
 * THE WRITERS, handed in — the eight the leaf hands: ledger/ledgerWrites.ts's seven and the stops' one writer (stops/stopWrites.ts
 * setStopRecord). This file reads neither: their shapes are typed here from the bodies ledger.ts builds. (Six until COALEVELS-01.)
 */
export interface PasteWriters {
  /** The one-off stop with its one line; the new routine's id. */
  readonly createOneOff: (body: ReturnType<typeof oneOffBody>) => Promise<PasteAnswer<{ readonly routineId: string }>>;
  /** The line the create wrote, read back. */
  readonly readOneOffLine: (routineId: string) => Promise<PasteAnswer<{ readonly lineId: string }>>;
  /** The line's minutes. */
  readonly setLineMinutes: (lineId: string, minutes: number) => Promise<PasteAnswer<unknown>>;
  /** A new vendor in the book; its id. */
  readonly addVendor: (entityId: string, name: string) => Promise<PasteAnswer<{ readonly vendorId: string }>>;
  /** The vendor on the stop — a line's occurrence, or a routine's own — and, when the row writes any, its planned items with it. */
  readonly setVendor: (body: { readonly kind: LedgerAddress['kind']; readonly id: string; readonly instant: string; readonly vendorId: string; readonly items?: string }) => Promise<PasteAnswer<unknown>>;
  /** A vendor's Instagram tag. */
  readonly setVendorTag: (vendorId: string, tag: string) => Promise<PasteAnswer<unknown>>;
  /** A sub-account under an account of the chart. */
  readonly addSubAccount: (accountId: string, name: string, code: string) => Promise<PasteAnswer<unknown>>;
  /** The stop's record. It throws when the request never reached the route. */
  readonly setRecord: (body: PasteRecordBody) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }>;
}

/**
 * HOW A ROW CAME OUT. `written`: every step it had, in order. `failed`: the steps written before the refusal, the step a route
 * refused, and the route's own words. `not tried`: the save had stopped before it.
 */
export type PasteOutcome =
  | { readonly row: number; readonly state: 'written'; readonly steps: readonly PasteStep[] }
  | { readonly row: number; readonly state: 'failed'; readonly steps: readonly PasteStep[]; readonly step: PasteStep; readonly words: string }
  | { readonly row: number; readonly state: 'not tried' };

/** How an addition to the chart came out: written, or the route's own words. A refusal stops nothing — a stop's name is its Type either way. */
export type PasteAddOutcome = { readonly state: 'written' } | { readonly state: 'failed'; readonly words: string };

/** What the runner says as it goes: how each addition came out (they are written first — one outcome an addition, in their order); the rows' outcomes so far; and the row about to be written — its place among the writes, and its number in the paste — or null once, at the end. */
export interface PasteProgress {
  readonly adds: readonly PasteAddOutcome[];
  readonly outcomes: readonly PasteOutcome[];
  readonly at: { readonly i: number; readonly of: number; readonly row: number } | null;
}

// ── 3 · THE ONE RUNNER ──────────────────────────────────────────────────────

/** A new vendor, by its book and its name as the directory compares names (planVendor.ts vendorNameKey). */
const newVendorKey = (bookId: string, name: string): string => JSON.stringify([bookId, vendorNameKey(name)]);

/** One row, written step by step. `added` holds the vendors this save has added — a name a row before it added is not added again. */
async function runWrite(write: PasteWrite, writers: PasteWriters, added: Map<string, string>): Promise<PasteOutcome> {
  const steps: PasteStep[] = [];
  const failed = (step: PasteStep, words: string): PasteOutcome => ({ row: write.row, state: 'failed', steps: [...steps], step, words });
  /** The vendor's id the vendor step ended on — what a tag on the vendor this row adds is set on. */
  let endedOn: string | null = null;

  /**
   * The vendor: added to the book when the name is new — once a save: a row before this one that added it is where its id comes from — then set on the stop, the row's planned items
   * WITH that write when it writes any (no `items` key otherwise): the step 'vendor' and, with items, the step 'items'. A STANDING vendor is ONE call — the stop's own vendor id and the
   * items: nothing of the vendor is written, so its step is 'items' alone and a refusal fails 'items'. The failure, or null.
   */
  const vendorOn = async (bodyOf: (vendorId: string) => Parameters<PasteWriters['setVendor']>[0]): Promise<PasteOutcome | null> => {
    if (write.vendor.kind === 'none') return null;
    let vendorId: string;
    if (write.vendor.kind === 'own' || write.vendor.kind === 'standing') {
      vendorId = write.vendor.id;
    } else {
      const key = newVendorKey(write.book.id, write.vendor.name);
      const earlier = added.get(key);
      if (earlier === undefined) {
        const answer = await writers.addVendor(write.book.id, write.vendor.name);
        if (!answer.ok) return failed('directory', answer.words);
        added.set(key, answer.value.vendorId);
        steps.push('directory');
        vendorId = answer.value.vendorId;
      } else {
        vendorId = earlier;
      }
    }
    const body = bodyOf(vendorId);
    if (write.vendor.kind === 'standing') {
      if (write.items === null) throw new Error(`pasteSave: row ${write.row} names its stop's standing vendor and writes no planned items — a standing vendor is named only to carry them`);
      const set = await writers.setVendor({ ...body, items: write.items });
      if (!set.ok) return failed('items', set.words);
      steps.push('items');
    } else {
      const set = await writers.setVendor(write.items === null ? body : { ...body, items: write.items });
      if (!set.ok) return failed('vendor', set.words);
      steps.push('vendor');
      if (write.items !== null) steps.push('items');
    }
    endedOn = vendorId;
    return null;
  };
  /** The tag, after the vendor and before the record: on the vendor it names — or, null, on the id the vendor step ended on (none there is this file's error). The failure, or null. */
  const tagOn = async (): Promise<PasteOutcome | null> => {
    if (write.tag === null) return null;
    const vendorId = write.tag.vendorId !== null ? write.tag.vendorId : endedOn;
    if (vendorId === null) throw new Error(`pasteSave: row ${write.row} sets a tag on the vendor it adds, and its vendor step ended on no vendor`);
    const set = await writers.setVendorTag(vendorId, write.tag.tag);
    if (!set.ok) return failed('tag', set.words);
    steps.push('tag');
    return null;
  };
  /** The record, when the row has one. The stops' writer throws when the request never reached the route: that is this row's refusal, with the error's words. The failure, or null. */
  const recordOf = async (record: PasteRecordBody | null): Promise<PasteOutcome | null> => {
    if (record === null) return null;
    let answer: Awaited<ReturnType<PasteWriters['setRecord']>>;
    try {
      answer = await writers.setRecord(record);
    } catch (error) {
      return failed('record', error instanceof Error ? error.message : String(error));
    }
    if (!answer.ok) return failed('record', answer.message);
    steps.push('record');
    return null;
  };

  if (write.kind === 'stop') {
    // ON A STOP THAT STANDS: the vendor at the sheet row's own address — the address that row's own vendor box plans "this day" at — its tag, then the record form's own body.
    const address = write.address;
    const vendorFailed = await vendorOn((vendorId) => ({ kind: address.kind, id: address.id, instant: address.instant, vendorId }));
    if (vendorFailed !== null) return vendorFailed;
    const tagFailed = await tagOn();
    if (tagFailed !== null) return tagFailed;
    const recordFailed = await recordOf(write.record);
    if (recordFailed !== null) return recordFailed;
    return { row: write.row, state: 'written', steps };
  }

  // A NEW ONE-OFF: the stop, its line read back, the stop's minutes — then its vendor, its vendor's tag and its record on that line's one occurrence, the record only when it is recorded went.
  const values = write.values;
  const created = await writers.createOneOff(oneOffBody(values));
  if (!created.ok) return failed('stop', created.words);
  steps.push('stop');
  const line = await writers.readOneOffLine(created.value.routineId);
  if (!line.ok) return failed('line', line.words);
  steps.push('line');
  const lineId = line.value.lineId;
  if (write.minutes !== null) {
    const timed = await writers.setLineMinutes(lineId, write.minutes);
    if (!timed.ok) return failed('minutes', timed.words);
    steps.push('minutes');
  }
  const vendorFailed = await vendorOn((vendorId) => vendorBody(values, lineId, vendorId));
  if (vendorFailed !== null) return vendorFailed;
  const tagFailed = await tagOn();
  if (tagFailed !== null) return tagFailed;
  // "+ expense"'s body holds no notes — it has no NOTES box; the row's own ride the record.
  const recordFailed = await recordOf(write.went ? { ...recordBody(values, lineId), notes: write.notes } : null);
  if (recordFailed !== null) return recordFailed;
  return { row: write.row, state: 'written', steps };
}

/**
 * THE ONE RUNNER — the additions to the chart first, one call each, then the writes, a row at a time, in the paste's order. An
 * addition a route refuses is said on its line and STOPS NOTHING: the rows are still saved — a stop's name is its Type either way.
 * A row's write a route refuses STOPS the save: that row's outcome is failed — the steps written before it, the step, the route's
 * own words — and every row after it is not tried: nothing after the refusal is asked. Nothing is retried and nothing is undone.
 * `said` is told before each row (the additions' outcomes, the rows' outcomes so far, and that row's place) and once at the end.
 * One outcome a write, in the writes' order. The additions are handed in whole — none is a save that adds none.
 */
export async function runPaste(writes: readonly PasteWrite[], writers: PasteWriters, said: (progress: PasteProgress) => void, adds: readonly PasteAdd[]): Promise<PasteOutcome[]> {
  const addOutcomes: PasteAddOutcome[] = [];
  for (const add of adds) {
    const answer = await writers.addSubAccount(add.accountId, add.name, add.code);
    addOutcomes.push(answer.ok ? { state: 'written' } : { state: 'failed', words: answer.words });
  }
  const outcomes: PasteOutcome[] = [];
  const added = new Map<string, string>();
  let stopped = false;
  for (let i = 0; i < writes.length; i += 1) {
    const write = writes[i];
    if (stopped) {
      outcomes.push({ row: write.row, state: 'not tried' });
      continue;
    }
    said({ adds: [...addOutcomes], outcomes: [...outcomes], at: { i: i + 1, of: writes.length, row: write.row } });
    const outcome = await runWrite(write, writers, added);
    outcomes.push(outcome);
    if (outcome.state === 'failed') stopped = true;
  }
  said({ adds: [...addOutcomes], outcomes: [...outcomes], at: null });
  return outcomes;
}

/** Every day a write reached — the day of each write whose row is not "not tried" — each once, in the paste's order. The time sheet and the day's card read these again. */
export function daysReached(writes: readonly PasteWrite[], outcomes: readonly PasteOutcome[]): string[] {
  if (outcomes.length !== writes.length) throw new Error(`pasteSave: ${outcomes.length} outcomes for ${writes.length} writes — one outcome a write`);
  const days: string[] = [];
  writes.forEach((write, i) => {
    if (outcomes[i].state !== 'not tried' && !days.includes(write.day)) days.push(write.day);
  });
  return days;
}

/**
 * Whether the table's rows are no longer what was on screen at the press: the rows placed again, after the time sheet is read again,
 * against the rows he was looking at — row for row, its number, both halves' cells, where it lands and its tone. When they differ,
 * nothing is written.
 */
export function shownChanged(before: readonly PasteShownRow[], after: readonly PasteShownRow[]): boolean {
  if (before.length !== after.length) return true;
  const sameCells = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((cell, i) => cell === b[i]);
  return before.some((row, i) => {
    const next = after[i];
    return row.number !== next.number || row.lands !== next.lands || row.tone !== next.tone || !sameCells(row.yours, next.yours) || !sameCells(row.sheet, next.sheet);
  });
}

// ── 4 · THE WORDS ───────────────────────────────────────────────────────────

const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The names a save would add, by book: the books in the paste's order; a book's names each once, as its first row spells it, in name order (the directory's own key, compared as text). */
export function newVendorsOf(writes: readonly PasteWrite[]): { readonly book: PasteWriteBook; readonly names: readonly string[] }[] {
  const books: { readonly book: PasteWriteBook; readonly names: string[] }[] = [];
  const seen = new Set<string>();
  for (const write of writes) {
    if (write.vendor.kind !== 'new') continue;
    const key = newVendorKey(write.book.id, write.vendor.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const held = books.find((entry) => entry.book.id === write.book.id);
    if (held === undefined) books.push({ book: write.book, names: [write.vendor.name] });
    else held.names.push(write.vendor.name);
  }
  const byName = (a: string, b: string): number => {
    const [left, right] = [vendorNameKey(a), vendorNameKey(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  };
  return books.map((entry) => ({ book: entry.book, names: [...entry.names].sort(byName) }));
}

/** The names, a line a book: "new to Personal (2): Corner Cup · Pin Palace". */
export const newVendorLines = (writes: readonly PasteWrite[]): string[] => newVendorsOf(writes).map(({ book, names }) => `new to ${book.word} (${names.length}): ${names.join(' · ')}`);
export const VENDORS_STAY_WORDS = 'a vendor added to a book is never renamed or removed — read the names before you save';

/**
 * The button — what the save writes: its rows; the sub-accounts added to the chart; the vendors added to a book (a new name once a book); the vendors set on a stop — the book's own and
 * the new: a standing one is not set; the tags set on a vendor; the stops given planned items; the records; the one-offs.
 */
export function saveWords(writes: readonly PasteWrite[], adds: readonly PasteAdd[]): string {
  const added = newVendorsOf(writes).reduce((sum, entry) => sum + entry.names.length, 0);
  const set = writes.filter((write) => write.vendor.kind === 'own' || write.vendor.kind === 'new').length;
  const tags = writes.filter((write) => write.tag !== null).length;
  const items = writes.filter((write) => write.items !== null).length;
  const records = writes.filter((write) => (write.kind === 'oneOff' ? write.went : write.record !== null)).length;
  const oneOffs = writes.filter((write) => write.kind === 'oneOff').length;
  return `save ${counted(writes.length, 'row', 'rows')} — ${counted(adds.length, 'sub-account added to the chart', 'sub-accounts added to the chart')} · ${counted(added, 'vendor added to a book', 'vendors added to a book')} · ${counted(set, 'vendor set on a stop', 'vendors set on a stop')} · ${counted(tags, 'tag set on a vendor', 'tags set on a vendor')} · ${counted(items, 'stop given planned items', 'stops given planned items')} · ${counted(records, 'record', 'records')} · ${counted(oneOffs, 'one-off', 'one-offs')}`;
}
/** No write at all. */
export const NOTHING_TO_SAVE_WORDS = 'nothing to save — no placed row has a vendor to plan, a tag to set, planned items to write, a record to make or a one-off to add';
/** An addition's outcome, on its line: written, or not written and the route's own words. */
export const addOutcomeWords = (outcome: PasteAddOutcome): string => (outcome.state === 'written' ? `written: ${PASTE_STEP_WORDS['sub-account']}` : `not written: ${PASTE_STEP_WORDS['sub-account']} — ${outcome.words}`);

/** While it runs. */
export const CHECKING_WORDS = 'reading the time sheet again before anything is written…';
export const savingWords = (i: number, of: number, row: number): string => `saving ${i} of ${of} — row ${row}…`;
/** The time sheet read again is not the one the rows were placed against. */
export const CHANGED_WORDS = 'the time sheet changed since these rows were read — nothing was written; the rows are placed again below: look, then save';

/** A row's outcome, under where it lands: every step written; or the steps written and the one a route refused, in the route's own words; or not tried. */
export function pasteOutcomeWords(outcome: PasteOutcome): string {
  if (outcome.state === 'not tried') return NOT_TRIED_WORDS;
  const written = outcome.steps.length === 0 ? [] : [`written: ${outcome.steps.map((step) => PASTE_STEP_WORDS[step]).join(' · ')}`];
  if (outcome.state === 'failed') return [...written, `not written: ${PASTE_STEP_WORDS[outcome.step]} — ${outcome.words}`].join(' · ');
  if (written.length === 0) throw new Error(`pasteSave: row ${outcome.row} is written with no step — a write has at least one`);
  return written[0];
}

/** Whether the run stopped at a refusal. */
export const runStopped = (outcomes: readonly PasteOutcome[]): boolean => outcomes.some((outcome) => outcome.state === 'failed');
/** The run, one line: the rows saved — and, when it stopped, the row, the step and the route's own words, and the rows not tried. */
export function runWords(outcomes: readonly PasteOutcome[]): string {
  const saved = outcomes.filter((outcome) => outcome.state === 'written').length;
  const failed = outcomes.find((outcome): outcome is Extract<PasteOutcome, { readonly state: 'failed' }> => outcome.state === 'failed');
  if (failed === undefined) return `${saved} rows saved`;
  const notTried = outcomes.filter((outcome) => outcome.state === 'not tried').length;
  return `${saved} rows saved · stopped at row ${failed.row}: ${PASTE_STEP_WORDS[failed.step]} — ${failed.words} · ${notTried} rows not tried`;
}
/** After a run there is no save until the rows are read again. */
export const SPENT_WORDS = 'read the rows again before another save — what is in is never written twice';
