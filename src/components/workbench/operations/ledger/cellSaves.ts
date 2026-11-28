/**
 * cellSaves — what a sheet cell's save writes (EDIT-01, Alex, 2026-11-28: "built like an excel table. Filterable, Editable, so I can clean my
 * data !!!").
 *
 * LedgerSection.tsx is the frame — the open cell, its keys, the line beneath it; this leaf is the one place a cell's text becomes a write. THE
 * RECORD'S CELLS (WENT, STARS, LOGGED MIN, ACTUAL, NOTES, and ITEMS on a row whose record is held) go through the record form's own rule and its
 * one writer, exactly as RecordForm.tsx does: the draft is ledger.ts's (recordCellDraft — rowDraftOf with the one box replaced), the rule
 * recordInput at the row's own address with its `recording` entry and the clock handed in, the write stops/stopWrites.ts setStopRecord; WENT
 * none on a held record is a clear, through the same writer (clearStopRecord), asked first by the frame. A refusal — the rule's, or the route's
 * in its own words — comes back as words for the line beneath; so does what the rule throws by name, and a request that never reached the route
 * (the writer throws then): said where the cell is, never left in the console. Nothing is retried, nothing rolled back, nothing stored.
 * This leaf names no route and sends no request of its own; every sentence is ledger.ts's, a rule file's or a route's.
 *
 * PART 3 (2026-11-28): THE PLAN'S CELLS AND THE VENDOR'S. A plan cell's text is read by ledger.ts planCellWrite — its write, or the rule's refusal
 * before any write — and the write goes through the writers that stand (ledgerWrites.ts patchRoutine, patchLine, setLineMinutes, setVendorTag,
 * setVendor). TYPE is two writes: the routine's name first — refused, nothing else is written — then the line's TYPE; refused there, the name is
 * put back by the same writer, so the row never holds two names (and a name that could not be put back is said with the refusal). VENDOR is the
 * blank row's typed box over the book's vendors, read once when a VENDOR cell opens (readCellVendors — ledgerWrites.ts readVendors): blank clears
 * the vendor at the row's address; else the paste's own rule (pasteRows.ts pastedVendorOf) decides one of the book's — set at the row's address
 * — or a new one — added to the book, then set. A name typed while the vendors are unread is refused, never guessed. saveCell sorts a cell to its
 * save by the rule's own test (ledger.ts isRecordCell) and the row's entries.
 *
 * PART 4 (2026-11-28): A ROW'S ✕, once the frame has asked: what it deletes is the rule's (ledger.ts rowDeleteOf) — the row's routine, through the
 * routines DELETE that stands (ledgerWrites.ts deleteRoutine), or a record with no plan, through the stops' one writer's clear (clearStopRecord). A
 * refusal — a posting linked in Books, said by name — comes back as the route's words, and nothing is changed.
 *
 * EDIT-02 (Alex, 2026-11-28): THE TRIP'S CELLS — CITY · REGION · COUNTRY on any row — read by ledger.ts tripCellWrite and written by the stays' one writer
 * (stays/stayWrites.ts changeStay for the trip covering the day, createStay for a day no trip covers); its refusals (an overlap, the place rule) said in
 * its words, and a request that never reached the route (that writer throws then) too. ITEMS with no record held, on a past row that takes one, writes its
 * FIRST record — the note typed — through the record form's rule and writer, as ACTUAL writes one (ledger.ts itemsWritesRecord decides it).
 */
import {
  VENDORS_LOADING_WORDS, isRecordCell, itemsWritesRecord, planCellWrite, recordCellDraft, recordInput, nameNotPutBackWords, tripCellWrite, vendorAddedNotSetWords,
  type LedgerEditing, type LedgerEditingPlan, type LedgerRecording, type LedgerRecordingTaken, type LedgerSheetRow, type PlanCellWrite, type RowDelete, type TypedColumn,
} from '@/lib/operations/ledger';
import { pastedVendorOf, type PasteVendor } from '@/lib/operations/pasteRows';
import type { StopRecordRow } from '@/lib/operations/stopRecord';
import { clearStopRecord, setStopRecord } from '../stops/stopWrites';
import { changeStay, createStay } from '../stays/stayWrites';
import { addVendor, clearVendor, deleteRoutine, patchLine, patchRoutine, readVendors, setLineMinutes, setVendor, setVendorTag, type WriteAnswer } from './ledgerWrites';

/** A cell's save: accepted, or refused in words. */
export type CellSave = { readonly ok: true } | { readonly ok: false; readonly words: string };

const wordsOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
/** A writer's answer as a cell's save — its words when refused. */
const savedOf = (answer: WriteAnswer<unknown>): CellSave => (answer.ok ? { ok: true } : { ok: false, words: answer.words });

/** A record's cell: the record form's draft with the cell's text in its box, read by the record form's rule, written by the one writer. */
export async function saveRecordCell(row: LedgerSheetRow, entry: LedgerRecordingTaken, column: TypedColumn, text: string, now: Date): Promise<CellSave> {
  let read: ReturnType<typeof recordInput>;
  try {
    read = recordInput(recordCellDraft(row, entry.held, column, text), row.address, entry, now);
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
  if (!read.ok) return { ok: false, words: read.message };
  try {
    const answer = await setStopRecord(read.body);
    return answer.ok ? { ok: true } : { ok: false, words: answer.message };
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}

/** WENT none on a held record — the record cleared through the one writer, once the frame has asked. */
export async function clearRecordCell(held: StopRecordRow): Promise<CellSave> {
  try {
    const answer = await clearStopRecord(held.id);
    return answer.ok ? { ok: true } : { ok: false, words: answer.message };
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}

/** A plan cell's write, through its writer. TYPE: the name, then the line's TYPE — refused there, the name put back. */
async function writePlan(write: PlanCellWrite): Promise<CellSave> {
  switch (write.to) {
    case 'routine': return savedOf(await patchRoutine(write.routineId, write.body));
    case 'minutes': return savedOf(await setLineMinutes(write.lineId, write.minutes));
    case 'line': return savedOf(await patchLine(write.lineId, write.body));
    case 'type': {
      const named = await patchRoutine(write.routineId, { name: write.name });
      if (!named.ok) return { ok: false, words: named.words };
      const typed = await patchLine(write.lineId, { activity: write.activity });
      if (typed.ok) return { ok: true };
      const back = await patchRoutine(write.routineId, { name: write.nameBack });
      return { ok: false, words: back.ok ? typed.words : `${typed.words} — ${nameNotPutBackWords(write.nameBack, back.words)}` };
    }
    case 'tag': return savedOf(await setVendorTag(write.vendorId, write.tag));
    case 'items': return savedOf(await setVendor({ ...write.address, vendorId: write.vendorId, items: write.items }));
    default: { const none: never = write; throw new Error(`cellSaves: no writer for ${JSON.stringify(none)}`); }
  }
}

/** A plan cell — START, END, LOCATION, CATEGORY, TYPE, BUDGET on a one-off; INSTAGRAM TAG and ITEMS with the row's vendor: read by the rule, written by its writer. */
export async function savePlanCell(row: LedgerSheetRow, editing: LedgerEditingPlan, column: TypedColumn, text: string): Promise<CellSave> {
  try {
    const read = planCellWrite(row, editing, column, text);
    if (!read.ok) return { ok: false, words: read.words };
    return await writePlan(read.write);
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}

/** The book's vendors for an open VENDOR cell: still reading, read, or not readable — said in the read's words, never taken as none. */
export type CellVendors = { readonly kind: 'reading' } | { readonly kind: 'read'; readonly vendors: readonly PasteVendor[] } | { readonly kind: 'failed'; readonly words: string };

/** The vendors, read once when a VENDOR cell opens — the directory's list by the paste's own rule. */
export async function readCellVendors(): Promise<CellVendors> {
  try {
    const read = await readVendors();
    return read.ok ? { kind: 'read', vendors: read.value } : { kind: 'failed', words: read.words };
  } catch (error) {
    return { kind: 'failed', words: wordsOf(error) };
  }
}

/** VENDOR, this row: blank → the vendor at the row's address cleared; one of the book's → set at the row's address; a new one → added to the book, then set. */
export async function saveVendorCell(row: LedgerSheetRow, editing: LedgerEditingPlan, text: string, vendors: CellVendors): Promise<CellSave> {
  const at = { kind: row.address.kind, id: row.address.id, instant: row.address.instant };
  const name = text.trim().replace(/\s+/g, ' ');
  try {
    if (name === '') return savedOf(await clearVendor(at));
    if (vendors.kind === 'reading') return { ok: false, words: VENDORS_LOADING_WORDS };
    if (vendors.kind === 'failed') return { ok: false, words: vendors.words };
    const picked = pastedVendorOf(name, { id: editing.entityId }, vendors.vendors);
    if (picked.kind === 'own') return savedOf(await setVendor({ ...at, vendorId: picked.id }));
    if (picked.kind !== 'new') throw new Error(`cellSaves: a typed vendor is the book's own or new — the rule answered ${picked.kind}`);
    const added = await addVendor(editing.entityId, picked.name);
    if (!added.ok) return { ok: false, words: added.words };
    const set = await setVendor({ ...at, vendorId: added.value.vendorId });
    return set.ok ? { ok: true } : { ok: false, words: vendorAddedNotSetWords(picked.name, set.words) };
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}

/** EDIT-02 (2026-11-28): a trip cell — the trip covering the row's day changed whole, or a new trip of the day — read by the rule, written by the stays' one writer. */
export async function saveTripCell(row: LedgerSheetRow, editing: LedgerEditing, column: 'city' | 'region' | 'country', text: string): Promise<CellSave> {
  try {
    const read = tripCellWrite(row, editing, column, text);
    if (!read.ok) return { ok: false, words: read.words };
    const answer = read.write.to === 'change' ? await changeStay(read.write.stayId, read.write.body) : await createStay(read.write.body);
    return answer.ok ? { ok: true } : { ok: false, words: answer.message };
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}

/** A cell's save, by its column and its row's entries — the trip's cells by the trip's rule; the record's cells, and ITEMS's first record, by the record's rule; VENDOR by its box; the rest by the plan's rule. A cell saved on a row that cannot take it is the frame's error, thrown by name. */
export function saveCell(row: LedgerSheetRow, recording: LedgerRecording, editing: LedgerEditing, column: TypedColumn, text: string, vendors: CellVendors, now: Date): Promise<CellSave> {
  if (column === 'city' || column === 'region' || column === 'country') return saveTripCell(row, editing, column, text);
  if (isRecordCell(column, recording) || (column === 'description' && itemsWritesRecord(row, recording))) {
    if (!recording.takes) throw new Error(`cellSaves: ${column} of ${row.key} is the record's, and the row takes no record`);
    return saveRecordCell(row, recording, column, text, now);
  }
  if (!editing.plan) throw new Error(`cellSaves: ${column} of ${row.key} is the plan's, and the row has none to change`);
  return column === 'vendor' ? saveVendorCell(row, editing, text, vendors) : savePlanCell(row, editing, column, text);
}

/** A row's ✕, asked and answered: its routine deleted, or its record cleared. A refusal is the route's words; nothing is changed then. */
export async function deleteRow(target: RowDelete): Promise<CellSave> {
  try {
    if (target.kind === 'routine') return savedOf(await deleteRoutine(target.routineId));
    const answer = await clearStopRecord(target.held.id);
    return answer.ok ? { ok: true } : { ok: false, words: answer.message };
  } catch (error) {
    return { ok: false, words: wordsOf(error) };
  }
}
