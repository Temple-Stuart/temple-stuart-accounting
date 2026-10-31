/**
 * MorningJournalTable — THE MORNING JOURNAL, DAY OVER DAY (JOURNAL-07, Alex, 2026-10-24): the third section of
 * /time, under the task ledger. DAY · DATE · GOALS · BLOCKER · PLAN · DONE over the days that have a journal
 * (journalTables.ts MORNING_TABLE) — JournalDayTable.tsx with its kind; read-only.
 */

'use client';

import JournalDayTable from './JournalDayTable';

export default function MorningJournalTable() {
  return <JournalDayTable kind="morning" />;
}
