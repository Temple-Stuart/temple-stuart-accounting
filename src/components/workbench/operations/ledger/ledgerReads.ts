/**
 * ledgerReads — the task ledger's one read (LEDGER-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 *   · GET /api/operations/ledger?from=&to=     readLedger, here
 *
 * Through the week's reader (week/weekReads.ts readJson — the one way an answer
 * is read: ok, or the route's own words; signed out by name; nothing filled in). LedgerSection.tsx fetches nothing itself.
 */
import { ledgerFailedWords, type AccountPlaces, type LedgerEditing, type LedgerRecording, type LedgerRow, type LedgerSaid, type LedgerSheetRow } from '@/lib/operations/ledger';
import { readJson, type Read } from '../week/weekReads';

export interface LedgerAnswer {
  readonly from: string;
  readonly to: string;
  /** The route's clock when it answered, ISO text. */
  readonly as_of: string;
  /** The caller's earliest record's day, for ALL; its reason when its zone could not be read; null when nothing was recorded. */
  readonly first_record: { readonly day: string } | { readonly words: string } | null;
  readonly rows: readonly LedgerRow[];
  readonly sheet: readonly LedgerSheetRow[]; // TIMESHEET-01 (Alex, 2026-11-24): the table's rows — every line of the period (SHEET-01, 2026-11-28: "every priced line" until then), planned and recorded; `rows` (the recorded expenses) is as it was
  readonly tones: AccountPlaces; // TIMESHEET-03 (Alex, 2026-11-24): an account's label → its place among the accounts the caller's active plans use — what the ACCOUNT NAME pill is toned by (ledger.ts toneOfPlace)
  readonly recording: Readonly<Record<string, LedgerRecording>>; readonly editing: Readonly<Record<string, LedgerEditing>>; // TIMESHEET-02 (Alex, 2026-11-24): by the sheet row's key, one entry for every row of `sheet` — whether the row takes a record, and what its form is given (no read when a form opens). EDIT-01 (Alex, 2026-11-28): and `editing` beside it — what each row's cells can change; on this line so the read the registry cites (:28) does not move
  readonly said: LedgerSaid;
}

/** The ledger for a span of days; an answer without its rows — or, TIMESHEET-01, without its sheet; or, TIMESHEET-03, without its tones; or, TIMESHEET-02, without its recording, or whose recording lacks a sheet row's key; or, EDIT-01, without its editing, or whose editing lacks a sheet row's key — is a failure in words, never read as an empty period, drawn in a guessed tone, shown as a row with no form, or a cell that guesses what it may change. */
export async function readLedger(from: string, to: string): Promise<Read<LedgerAnswer>> {
  const read = await readJson(`/api/operations/ledger?${new URLSearchParams({ from, to }).toString()}`);
  if (!read.ok) return { ok: false, words: ledgerFailedWords(read.words) };
  if (!Array.isArray(read.value.rows) || typeof read.value.said !== 'object' || read.value.said === null || !('first_record' in read.value)) {
    return { ok: false, words: ledgerFailedWords('the ledger came back without its rows') };
  }
  if (!Array.isArray(read.value.sheet)) return { ok: false, words: ledgerFailedWords('the ledger came back without its sheet') };
  // TIMESHEET-03 (Alex, 2026-11-24, ruling B.5): the accounts' places ride this one answer — an answer without them is a failure in words, as one without its sheet is.
  if (typeof read.value.tones !== 'object' || read.value.tones === null || Array.isArray(read.value.tones)) return { ok: false, words: ledgerFailedWords('the ledger came back without its tones') };
  // TIMESHEET-02 (Alex, 2026-11-24, ruling B): what every row's record form is given rides this one answer — an entry for each row of the sheet, by the row's key.
  const recording = read.value.recording;
  if (typeof recording !== 'object' || recording === null || Array.isArray(recording)) return { ok: false, words: ledgerFailedWords('the ledger came back without its recording') };
  for (const row of read.value.sheet as readonly { readonly key?: unknown }[]) {
    if (typeof row.key !== 'string' || !Object.prototype.hasOwnProperty.call(recording, row.key)) return { ok: false, words: ledgerFailedWords(`the ledger came back with no recording for the row ${JSON.stringify(row.key)}`) };
  }
  // EDIT-01 (Alex, 2026-11-28): what every row's cells can change rides it too — read as `recording` is: an object holding every sheet row's key, else the read fails by name.
  const editing = read.value.editing;
  if (typeof editing !== 'object' || editing === null || Array.isArray(editing)) return { ok: false, words: ledgerFailedWords('the ledger came back without its editing') };
  for (const row of read.value.sheet as readonly { readonly key?: unknown }[]) {
    if (typeof row.key !== 'string' || !Object.prototype.hasOwnProperty.call(editing, row.key)) return { ok: false, words: ledgerFailedWords(`the ledger came back with no editing for the row ${JSON.stringify(row.key)}`) };
  }
  return { ok: true, value: read.value as unknown as LedgerAnswer };
}
