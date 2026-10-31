/**
 * journalReads — the journal tables' one read (JOURNAL-07, Alex, 2026-10-24).
 *
 *   · GET /api/operations/journal/range?from=&to=     readJournalRange, here
 *
 * Through the week's reader (week/weekReads.ts readJson — the one way an answer
 * is read: ok, or the route's own words; signed out by name; nothing filled in),
 * the ledger's pattern (ledger/ledgerReads.ts). JournalDayTable.tsx fetches
 * nothing itself; an answer without its list is a failure in words, never read
 * as "no journal".
 */
import type { JournalRow } from '@/lib/operations/journal';
import { journalsFailedWords } from '@/lib/operations/journalTables';
import { readJson, type Read } from '../week/weekReads';

export interface JournalRangeAnswer {
  readonly from: string;
  readonly to: string;
  /** The caller's earliest journal day, or null — ALL starts from it (ruling 1(b)). */
  readonly first_day: string | null;
  readonly journals: readonly JournalRow[];
}

/** The journals for a span of days; an answer without its list or its first day is a failure in words. */
export async function readJournalRange(from: string, to: string): Promise<Read<JournalRangeAnswer>> {
  const read = await readJson(`/api/operations/journal/range?${new URLSearchParams({ from, to }).toString()}`);
  if (!read.ok) return { ok: false, words: journalsFailedWords(read.words) };
  if (!Array.isArray(read.value.journals) || !('first_day' in read.value)) return { ok: false, words: journalsFailedWords('the journals came back without their list') };
  return { ok: true, value: read.value as unknown as JournalRangeAnswer };
}
