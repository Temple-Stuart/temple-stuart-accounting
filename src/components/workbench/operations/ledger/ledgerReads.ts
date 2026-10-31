/**
 * ledgerReads — the task ledger's one read (LEDGER-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 *   · GET /api/operations/ledger?from=&to=     readLedger, here
 *
 * Through the week's reader (week/weekReads.ts readJson — the one way an answer
 * is read: ok, or the route's own words; signed out by name; nothing filled in).
 * LedgerSection.tsx fetches nothing itself.
 */
import type { LedgerRow, LedgerSaid } from '@/lib/operations/ledger';
import { ledgerFailedWords } from '@/lib/operations/ledger';
import { readJson, type Read } from '../week/weekReads';

export interface LedgerAnswer {
  readonly from: string;
  readonly to: string;
  /** The route's clock when it answered, ISO text. */
  readonly as_of: string;
  /** The caller's earliest record's day, for ALL; its reason when its zone could not be read; null when nothing was recorded. */
  readonly first_record: { readonly day: string } | { readonly words: string } | null;
  readonly rows: readonly LedgerRow[];
  readonly said: LedgerSaid;
}

/** The ledger for a span of days; an answer without its rows is a failure in words, never read as "no stop recorded". */
export async function readLedger(from: string, to: string): Promise<Read<LedgerAnswer>> {
  const read = await readJson(`/api/operations/ledger?${new URLSearchParams({ from, to }).toString()}`);
  if (!read.ok) return { ok: false, words: ledgerFailedWords(read.words) };
  if (!Array.isArray(read.value.rows) || typeof read.value.said !== 'object' || read.value.said === null || !('first_record' in read.value)) {
    return { ok: false, words: ledgerFailedWords('the ledger came back without its rows') };
  }
  return { ok: true, value: read.value as unknown as LedgerAnswer };
}
