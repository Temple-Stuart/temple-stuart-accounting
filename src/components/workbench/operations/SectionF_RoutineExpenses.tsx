/**
 * Section F · ROUTINE EXPENSES — one row per routine line (WORK-01d, Alex, 2026-10-25).
 *
 * /tasks is three tables: THE WORK (SectionE_Work), then PROJECTS, then this
 * section — one DataTable (IDIOM-01) named 'routine-expenses' over the routine
 * spec in src/lib/operations/work.ts — one row per routine LINE (a stepless
 * routine is one row), every book:
 *
 *   ROUTINE · BOOK · CADENCE · DAYS · TIME · AMOUNT · ACCOUNT · STATUS · controls
 *
 *   · THE READS — the routines GET as today (every routine, active or not, with
 *     its lines), then each book's chart (the ACCOUNT column names the account).
 *     Existing routes, no new one; a failed read is said in words, never an
 *     empty table. Everything comes in, so the STATUS filter is the only thing
 *     that narrows.
 *   · THE DEFAULT — "STATUS: active only" is a VISIBLE chip in the controls row,
 *     already applied, dropping ended and inactive; a click on it clears it
 *     (everything shows); "clear filters" clears it with the rest. Never a hidden
 *     default. ROUTINE-02a's archive is the ended rows under the cleared chip.
 *   · "+ routine" opens FORM-01's routine form, unchanged (RoutineCreateForm;
 *     Days = Once makes a one-off).
 *   · EDIT — a row's "edit" expands the EXISTING editor under the row
 *     (RoutineEditForm, WORK-01 ruling 2: name, book, amount, category, days,
 *     time, the lines); every row of the same routine edits the same routine.
 *     The row's other controls are RoutineRow's — deactivate / reactivate and
 *     delete; an ended routine keeps "edit" alone.
 *   · A routine change re-reads this table alone — no task changed, so the
 *     page's WorkChanges signal is not bumped.
 *
 * React state only: the filters, the sort, the open popover, the one editor open
 * and nothing else; nothing is stored in the browser.
 *
 * HISTORY. These rows were THE WORK's routine rows under WORK-01 (2026-10-24),
 * one table with the tasks and a KIND column; WORK-01d gave them their own table.
 */

'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOperationsEntity, type Entity } from './EntitySelector';
import DataTable, { cellClass as cell, chipClass as chip } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { filterOn, filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import { localToday } from '@/lib/localToday';
import { SETUP_DOOR } from '@/lib/entities/kinds';
import RoutineCreateForm from './routines/RoutineCreateForm';
import RoutineEditForm from './routines/RoutineEditForm';
import type { Routine } from './routines/types';
import { WorkCell, readJson, useBookCharts } from './workShared';
import {
  ADD_ROUTINE_WORDS, CLEAR_CHIP_MARK, EDIT_WORDS, NO_ROUTINE_EXPENSES_WORDS, ROUTINE_DEFAULT, ROUTINE_EXPENSES_LOADING_WORDS, ROUTINE_EXPENSES_TITLE_WORDS,
  ROUTINE_TABLE_NAME, routineDefaultFilters, routineExpensesCsvFileName, routineExpensesFailedWords, routineRowsOf, routineTable, rowCountWords, statusChipWords,
  statusDroppedOf, withoutStatusFilter, type RoutineColumn, type RoutineRow, type WorkCharts,
} from '@/lib/operations/work';

const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const actionClass = 'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';
const name = ROUTINE_TABLE_NAME;

type RoutinesRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly routines: Routine[] };

export default function SectionF_RoutineExpenses() {
  const { entities } = useOperationsEntity();
  const [read, setRead] = useState<RoutinesRead>({ kind: 'loading' });
  const chartsRead = useBookCharts(entities);
  // One filter per column — STATUS dropping the default at first (ruling C); the sort; the open popover; the one editor open; whether a routine is being created. React state only.
  const [filters, setFilters] = useState<TableFilters>(() => routineDefaultFilters(routineTable([], {})));
  const [sort, setSort] = useState<TableSort<RoutineColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<RoutineColumn | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The book the routine form opens on, captured when it opens (RoutineList's rule, kept).
  const [createEntityId, setCreateEntityId] = useState('');

  const readRoutines = async () => {
    setRead({ kind: 'loading' });
    try {
      const body = await readJson('/api/operations/routines', 'routines');
      setRead({ kind: 'loaded', routines: (body.routines ?? []) as Routine[] });
    } catch (e) {
      setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) });
    }
  };
  useEffect(() => { readRoutines(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const charts: WorkCharts = useMemo(() => (chartsRead.kind === 'loaded' ? chartsRead.charts : {}), [chartsRead]);
  const columns: readonly TableColumn<RoutineRow, RoutineColumn>[] = useMemo(() => routineTable(entities, charts), [entities, charts]);
  const off = useMemo(() => noFilters(columns), [columns]);
  const loaded = read.kind === 'loaded' && chartsRead.kind === 'loaded';
  // ROUTINE-02a: ended is judged now, in each routine's own zone (work.ts hands `now` to the rule).
  const rows: readonly RoutineRow[] = read.kind === 'loaded' ? routineRowsOf(read.routines, new Date()) : [];
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const csv = loaded && shown.length > 0 ? { name: routineExpensesCsvFileName(localToday()) } : null;
  const refresh = () => { readRoutines(); };

  const startRoutine = () => {
    setCreateEntityId(entities[0]?.id ?? '');
    setCreating(true);
  };

  const renderRow = (row: RoutineRow) => (
    <RoutineWorkRow key={row.id} row={row} columns={columns} entities={entities} editing={editing === row.id} setEditing={(on) => setEditing(on ? row.id : null)} onChanged={refresh} />
  );

  return (
    <section className="space-y-3" {...dataAttr(name, 'section')}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">{ROUTINE_EXPENSES_TITLE_WORDS}</h2>
      </div>
      <DataTable
        name={name}
        columns={columns}
        rows={rows}
        shown={shown}
        loaded={loaded}
        tableClassName="min-w-[80rem]"
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
            {/* ZERO-STATE-1: no silent disable — when no entity exists the reason renders beside the button (SELL-04: entities are set up by the user in Books). */}
            {entities.length === 0 && (
              <span className="text-[11px] text-text-faint" {...dataAttr(name, 'no-entity')}>
                no entity yet — set one up in Books › <a href={SETUP_DOOR} className="underline">Chart of accounts</a>.
              </span>
            )}
            <button type="button" className={chip} disabled={entities.length === 0 || creating} onClick={startRoutine} {...dataAttr(name, 'add-routine')}>{ADD_ROUTINE_WORDS}</button>
            {/* Ruling C: the STATUS filter is VISIBLE while it narrows — "STATUS: active only" at first, the values dropped otherwise; its click clears it. */}
            {filterOn(filters, 'status', 'value') && (
              <button type="button" className={chipOn} onClick={() => setFilters(withoutStatusFilter(filters))} {...dataAttr(name, 'status-chip')}>
                {statusChipWords(statusDroppedOf(filters), ROUTINE_DEFAULT)} {CLEAR_CHIP_MARK}
              </button>
            )}
          </>
        )}
        renderRow={renderRow}
        foot={null}
      >
        {creating && (
          <RoutineCreateForm
            entities={entities}
            defaultEntityId={createEntityId}
            onCreated={() => { setCreating(false); refresh(); }}
            onCancel={() => setCreating(false)}
          />
        )}
        {(read.kind === 'loading' || (read.kind === 'loaded' && chartsRead.kind === 'loading')) && <div className="text-xs text-text-muted" {...dataAttr(name, 'loading')}>{ROUTINE_EXPENSES_LOADING_WORDS}</div>}
        {read.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{routineExpensesFailedWords(read.words)}</div>}
        {chartsRead.kind === 'failed' && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" {...dataAttr(name, 'failed')}>{routineExpensesFailedWords(chartsRead.words)}</div>}
        {loaded && rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{NO_ROUTINE_EXPENSES_WORDS}</div>}
      </DataTable>
      {loaded && rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
    </section>
  );
}

interface RoutineWorkRowProps {
  row: RoutineRow;
  columns: readonly TableColumn<RoutineRow, RoutineColumn>[];
  entities: Entity[];
  editing: boolean;
  setEditing: (on: boolean) => void;
  onChanged: () => void;
}

/** A routine line's row: the cells, then edit · deactivate / reactivate · delete (RoutineRow's handlers, moved); its editor under it while open. */
function RoutineWorkRow({ row, columns, entities, editing, setEditing, onChanged }: RoutineWorkRowProps) {
  const { routine, end } = row;
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !routine.is_active }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to toggle');
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete routine "${routine.name}"? All completion history will also be deleted.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/routines/${routine.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to delete');
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Fragment>
      <tr className={'border-t border-border ' + (routine.is_active && !end.ended ? '' : 'opacity-60')} {...dataAttr(name, 'row', row.id)} {...dataAttr(name, 'routine', routine.id)}>
        {columns.map((c) => <WorkCell key={c.key} name={name} column={c} row={row} />)}
        <td className={cell}>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setEditing(!editing)} className={actionClass} aria-expanded={editing} {...dataAttr(name, 'edit')}>{EDIT_WORDS}</button>
            {/* ROUTINE-02a: an ended routine keeps "edit" alone — nothing is deactivated or deleted. */}
            {!end.ended && (
              <>
                <button type="button" onClick={handleToggleActive} disabled={toggling} className={actionClass} {...dataAttr(name, 'toggle-active')}>
                  {toggling ? '…' : routine.is_active ? 'deactivate' : 'reactivate'}
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="px-2 py-0.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs" {...dataAttr(name, 'delete')}>
                  {deleting ? 'deleting…' : 'delete'}
                </button>
              </>
            )}
          </div>
          {error && (
            <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800 text-xs" {...dataAttr(name, 'row-error')}>{error}</div>
          )}
        </td>
      </tr>
      {editing && (
        <tr {...dataAttr(name, 'editing', row.id)}>
          <td colSpan={columns.length + 1} className="p-2 border-t border-border-light bg-bg-row">
            <RoutineEditForm routine={routine} end={end} entities={entities} onChanged={onChanged} onClose={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
