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
 */
import { recordCellDraft, recordInput, type LedgerRecordingTaken, type LedgerSheetRow, type TypedColumn } from '@/lib/operations/ledger';
import type { StopRecordRow } from '@/lib/operations/stopRecord';
import { clearStopRecord, setStopRecord } from '../stops/stopWrites';

/** A cell's save: accepted, or refused in words. */
export type CellSave = { readonly ok: true } | { readonly ok: false; readonly words: string };

const wordsOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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
