/**
 * JournalDayTable — ONE JOURNAL, DAY OVER DAY, on /time under the task ledger (JOURNAL-07, Alex, 2026-10-24).
 *
 * "Daily journals, morning and evening, should be tables of data collected day
 * over day, stacked rows." MorningJournalTable and EveningJournalTable are this
 * one component with its kind: the MORNING table (DAY · DATE · GOALS · BLOCKER ·
 * PLAN · DONE) and the EVENING table (DAY · DATE · ACCOMPLISHED · GAPS ·
 * EVOLUTION · DIRECTION · ALIGNMENT · ON TRACK · NEXT), each the ledger's shape
 * (ruling B) and READ-ONLY: no form, no PUT — the day card writes the journal.
 *
 *   · THE PERIOD — Month (the default, anchored today) · Week · Day · All, a
 *     date to anchor it and ‹ › to step: the ledger's own control, COPIED
 *     VERBATIM from ledger/LedgerSection.tsx (its state, its effects, its JSX;
 *     the attributes carry this table's name — data-journal-morning-period and
 *     so on — through dataAttr), so the ledger stays untouched and the two
 *     journal tables share one copy. ALL starts at the caller's first journal
 *     (the range route's first_day — ruling 1(b)); with none yet, its words.
 *   · THE READ — one read per period (journalReads.ts readJournalRange, the
 *     ledger's fetch pattern): the rows are the days that HAVE a journal; a
 *     failed read is said in words, never an empty table.
 *   · THE TABLE — the shared DataTable (IDIOM-01) over the pure spec
 *     (src/lib/operations/journalTables.ts): filters (a filter matches the FULL
 *     text — ruling E), sort, the one popover, "download CSV" (the full text,
 *     journal-<kind>_<from>_<to>.csv), the filters reset with the period. Zero
 *     rows loaded is the ledger's idiom (ruling 2(a)): "no journal ‹period›"
 *     and no table; rows loaded and all filtered out keeps the table.
 *   · THE CELLS — "—" for a null answer; a TEXT cell shows the first 160 code
 *     points then "… (<n> chars)" and "all of it", which opens the whole text
 *     with "less" to fold it (rulings E, 5) — one expanded state per cell key,
 *     React state only, folded again when the period changes.
 *   · UNDER THE TABLE one line: "<n> of <m> days in the period have a journal"
 *     (ruling D — n the rows loaded, m the span's days).
 *
 * Every word is journalTables.ts's or the ledger's; nothing is written here;
 * nothing is stored in the browser; the entity selector is not read.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { localToday } from '@/lib/localToday';
import type { Read } from '../week/weekReads';
import { readJournalRange, type JournalRangeAnswer } from './journalReads';
import DataTable, { cellClass as cell, chipClass as chip } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { NEXT_WORDS, PERIOD_KINDS, PERIOD_WORDS, PREVIOUS_WORDS, periodOf, periodWords, spanDays, stepAnchor, type Period, type PeriodKind } from '@/lib/operations/ledger';
import {
  COLLAPSE_WORDS, EXPAND_WORDS, JOURNALS_LOADING_WORDS, JOURNAL_TABLES, JOURNAL_TITLE_WORDS, NO_FIRST_JOURNAL_WORDS,
  cellKeyOf, daysWithJournalWords, journalCsvFileName, journalDayRows, noJournalWords, previewOf, type JournalDayRow, type JournalTableKind,
} from '@/lib/operations/journalTables';

const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const BLANK_CLASS = 'text-text-faint';
const link = 'underline text-brand-purple hover:text-text-primary';

/** A TEXT cell: the full text when it fits or when opened; else its first 160 code points, how many there are, and the control. */
function TextCell({ name, column, text, open, onToggle }: { name: string; column: string; text: string | null; open: boolean; onToggle: () => void }) {
  if (text === null) return <td className={`${cell} ${BLANK_CLASS}`} {...dataAttr(name, 'cell', column)}>{BLANK}</td>;
  const preview = previewOf(text);
  return (
    <td className={`${cell} max-w-[24rem] whitespace-pre-line break-words`} {...dataAttr(name, 'cell', column)} {...dataAttr(name, 'cell-open', open ? '' : undefined)}>
      {open || preview.more === null ? text : preview.shown}
      {preview.more !== null && (
        <>
          {!open && <span className="text-text-faint"> {preview.more}</span>}
          {' '}
          <button type="button" className={link} onClick={onToggle} {...dataAttr(name, 'cell-toggle')}>{open ? COLLAPSE_WORDS : EXPAND_WORDS}</button>
        </>
      )}
    </td>
  );
}

export default function JournalDayTable({ kind: which }: { kind: JournalTableKind }) {
  const name = `journal-${which}`;
  const columns: readonly TableColumn<JournalDayRow, string>[] = JOURNAL_TABLES[which];
  // Every filter off, by the spec — the state at first, what a new period starts with, what "clear filters" hands back.
  const off = useMemo(() => noFilters(columns), [columns]);
  const [today, setToday] = useState<string | null>(null);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState<string | null>(null);
  // One filter per column (the spec's every-filter-off), the sort (one column, or the table's own order — day ascending), the column whose popover
  // is open, and the cells opened to all of their text — React state only, nothing stored.
  const [filters, setFilters] = useState<TableFilters>(off);
  const [sort, setSort] = useState<TableSort<string> | null>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  // The last answer and the period it was read for; the first journal's day rides every answer, so ALL can start from it.
  const [answer, setAnswer] = useState<{ readonly period: Period; readonly read: Read<JournalRangeAnswer> } | null>(null);
  const [firstDay, setFirstDay] = useState<string | null>(null);

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setAnchor(t);
  }, []);

  const period = today === null || anchor === null ? null : periodOf(kind, anchor, today, firstDay);

  useEffect(() => {
    if (period === null) return;
    let live = true;
    setAnswer(null);
    (async () => {
      const read = await readJournalRange(period.from, period.to);
      if (!live) return;
      setAnswer({ period, read });
      if (read.ok) setFirstDay(read.value.first_day);
    })();
    return () => { live = false; };
  }, [period?.from, period?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new period starts with every filter off, no popover open and every cell folded — the checklists are the period's own.
  useEffect(() => {
    setFilters(off);
    setOpenFilter(null);
    setOpened(new Set());
  }, [period?.from, period?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = answer !== null && answer.read.ok;
  const rows: readonly JournalDayRow[] = answer !== null && answer.read.ok ? journalDayRows(answer.read.value.journals) : [];
  // The rows filtered (every column, AND across), then sorted — the CSV and the body are these.
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csvPeriod: Period | null = loaded && shown.length > 0 ? answer.period : null;
  const csv = csvPeriod === null ? null : { name: journalCsvFileName(which, csvPeriod.from, csvPeriod.to) };
  const toggle = (key: string) => setOpened((held) => { const next = new Set(held); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  return (
    <section className="space-y-3" {...dataAttr(name, 'table-section')}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">{JOURNAL_TITLE_WORDS[which]}</h2>
      </div>
      <DataTable
        name={name}
        columns={columns}
        rows={rows}
        shown={shown}
        loaded={loaded}
        tableClassName={which === 'morning' ? 'min-w-[64rem]' : 'min-w-[96rem]'}
        filters={filters}
        onFilters={setFilters}
        noFilters={off}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={csv}
        controls={(
          <>
            {PERIOD_KINDS.map((k) => (
              <button key={k} type="button" className={kind === k ? chipOn : chip} onClick={() => setKind(k)} {...dataAttr(name, 'period', k)} aria-pressed={kind === k}>{PERIOD_WORDS[k]}</button>
            ))}
            <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, -1))} {...dataAttr(name, 'previous')} aria-label="previous">{PREVIOUS_WORDS}</button>
            <input type="date" value={anchor ?? ''} disabled={kind === 'all'} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setAnchor(e.target.value); }} className="px-1.5 py-0.5 border border-border rounded text-xs" {...dataAttr(name, 'anchor')} />
            <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, 1))} {...dataAttr(name, 'next')} aria-label="next">{NEXT_WORDS}</button>
            {period !== null && <span className="font-semibold text-text-secondary" {...dataAttr(name, 'period-words')}>{periodWords(period)}</span>}
          </>
        )}
        trailing={kind === 'all' && period === null && <span className="text-text-muted" {...dataAttr(name, 'no-first')}>{NO_FIRST_JOURNAL_WORDS}</span>}
        renderRow={(row) => (
          <tr key={row.id} className="border-t border-border" {...dataAttr(name, 'row', row.day)}>
            {columns.map((c) => (c.kind === 'text'
              ? <TextCell key={c.key} name={name} column={c.key} text={c.text(row)} open={opened.has(cellKeyOf(row, c.key))} onToggle={() => toggle(cellKeyOf(row, c.key))} />
              : <td key={c.key} className={`${cell} whitespace-nowrap ${c.words(row) === BLANK ? BLANK_CLASS : ''}`} {...dataAttr(name, 'cell', c.key)}>{c.words(row)}</td>))}
          </tr>
        )}
        foot={null}
      >
        {period !== null && answer === null && <div className="text-xs text-text-muted" {...dataAttr(name, 'loading')}>{JOURNALS_LOADING_WORDS}</div>}
        {answer !== null && !answer.read.ok && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{answer.read.words}</div>}
        {loaded && rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{noJournalWords(answer.period)}</div>}
      </DataTable>
      {loaded && <p className="text-xs text-text-muted" {...dataAttr(name, 'days')}>{daysWithJournalWords(rows.length, spanDays(answer.period.from, answer.period.to))}</p>}
    </section>
  );
}

