/**
 * RoutineList — the routines as ONE table + inline create form.
 *
 * Self-fetches via GET /api/operations/routines on mount. Filters to
 * is_active=true by default with a "show inactive" toggle.
 *
 * ROUTINES-01: one table — every line of every routine is on screen at once;
 * nothing collapses.
 *
 * FORM-01 (Alex, 2026-10-19): the CURRENT routines are ONE FLAT TABLE with no
 * cadence group headers, in CLOCK ORDER — by the rule's clock, a routine with
 * no clock last, then name (rruleHelpers.ts byClockThenName) — with the
 * columns Routine · Cadence · Days · Time · Amount · Account, and the
 * controls (RoutineStepList ROUTINE_TABLE_COLUMNS = 7). The ENDED group stays
 * at the bottom behind its toggle, as ROUTINE-02a built it.
 *
 * ALLDAY-01 (Alex, 2026-10-19): TWO TABLES — one per book, BUSINESS then
 * PERSONAL (the user's books in that order, src/lib/entities/kinds.ts; a third
 * book gets its own table after them; a book with no routines shows its
 * heading and "no routines"; a routine whose book the tab has not listed is
 * shown under "book not loaded", never dropped). In each: the timed rows in
 * clock order, then an ALL DAY band under its own sub-heading (the role's own
 * words, R4) listing that book's all-day charges by their next date — Days,
 * Amount and Account as every row, Time "—" (rruleHelpers.ts timeWords by
 * role). The ENDED group stays once, at the bottom of the page, in its own
 * table behind its toggle; "+ new routine" stays once at the top.
 *
 * "+ new routine" button opens an inline create form using the same
 * RRULEBuilder as the edit form.
 *
 * ROUTINE-02a (Alex, 2026-10-18) — THE ARCHIVE. The list shows CURRENT routines:
 * end_date null or not before today in the routine's own zone (rruleHelpers.ts
 * endedBy). The ended ones sit behind "show ended (n)", beside "show inactive",
 * in their own "ENDED (n)" group at the bottom, newest end first, each read-only
 * but for "edit" (to extend the end). Nothing is deleted or deactivated; the
 * fetch is unchanged. A routine whose zone Intl cannot read is current, shown
 * with the reason — never hidden, never judged by another zone.
 */

'use client';

import { Fragment, useEffect, useState } from 'react';
import RoutineRow from './RoutineRow';
import RoutineCreateForm from './RoutineCreateForm';
import { ROUTINE_TABLE_COLUMNS } from './RoutineStepList';
import type { Routine } from './types';
import type { Entity } from '../EntitySelector';
import { SETUP_DOOR, type EntityKindType } from '@/lib/entities/kinds';
import { ACCOUNT_CELL_WORDS } from '@/lib/coa/accountCell';
import { ROLE_WORDS, isStop } from '@/lib/operations/stopRole';
import { byClockThenName, byNextDateThenName, endedBy } from '@/lib/operations/rruleHelpers';

/** ROUTINE-02a: the toggle's words, with the count. */
export const showEndedWords = (n: number): string => `show ended (${n})`;
/** ROUTINE-02a: the group's label, with the count (the row's class upper-cases it like the cadence labels). */
export const endedGroupWords = (n: number): string => `ended (${n})`;
/** ALLDAY-01: a book with no current routine says so under its heading. */
export const NO_ROUTINES_WORDS = 'no routines';
/** ALLDAY-01: the ALL DAY band's sub-heading — the role's own words (one phrasing, R4), with the count. */
export const allDayHeadingWords = (n: number): string => `${ROLE_WORDS.all_day} (${n})`;

/** ALLDAY-01: the books' order — the business book, then the personal one, then any other book by name. */
const BOOK_KIND_ORDER: readonly EntityKindType[] = ['sole_prop', 'personal'];
const kindRank = (type: string): number => {
  const i = (BOOK_KIND_ORDER as readonly string[]).indexOf(type);
  return i === -1 ? BOOK_KIND_ORDER.length : i;
};
export function booksInOrder<T extends { readonly name: string; readonly entity_type: string }>(entities: readonly T[]): T[] {
  return [...entities].sort((a, b) => kindRank(a.entity_type) - kindRank(b.entity_type) || a.name.localeCompare(b.name));
}


interface Props {
  /** The tab's entity list (useOperationsEntity) — each code is drawn against its book. */
  entities: Entity[];
  onCommitted?: () => void;
  /** TASKS-01: a change of this value refetches the list — the parent bumps it
   *  when Today marks an occurrence done, so next-due stays current. */
  refreshKey?: number;
  /** TASKS-01: a change of this value opens the create form — Today's
   *  zero-state "+ create a routine" lands on the list's own form. */
  createRequest?: number;
  // TASKS-ONE-02 (2026-10-14): Today (TodaysStrip.tsx) is deleted — Alex's ruling,
  // the day card replaces it — and SectionE_Routines, the one mount, passes only
  // entities now. refreshKey and createRequest keep their defaults (0): the list
  // refetches on mount and on "show inactive" only, the create-request effect never
  // opens the form, and onCommitted is called on nothing. Left unchanged.
}

export default function RoutineList({ entities, onCommitted, refreshKey = 0, createRequest = 0 }: Props & { }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  // ROUTINE-02a: whether the ended routines are shown — React state only.
  const [showEnded, setShowEnded] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  // Entity to seed the create form with, captured when the form is opened so it
  // stays stable while open (identical to the pre-extraction behavior).
  const [createDefaultEntityId, setCreateDefaultEntityId] = useState('');

  const fetchRoutines = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showInactive
        ? '/api/operations/routines'
        : '/api/operations/routines?is_active=true';
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? 'failed to load routines');
        setRoutines([]);
        return;
      }
      const rows: Routine[] = body.routines ?? [];
      setRoutines(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive, refreshKey]);

  const refresh = () => {
    fetchRoutines();
    onCommitted?.();
  };

  const startCreate = () => {
    const initialEntity = entities[0]?.id ?? '';
    setCreateDefaultEntityId(initialEntity);
    setShowCreate(true);
  };

  // TASKS-01: Today's zero-state asks for the create form; it opens here.
  useEffect(() => {
    if (createRequest > 0 && entities.length > 0) startCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequest]);

  // ROUTINE-02a: current and ended, judged now in each routine's own zone. The ended sit in their own group, newest end first.
  const now = new Date();
  const judged = routines.map((r) => ({ r, end: endedBy(r.end_date, r.timezone, now) }));
  const current = judged.filter((x) => !x.end.ended);
  const ended = judged
    .flatMap((x) => (x.end.ended ? [{ r: x.r, end: x.end, day: x.end.day }] : []))
    .sort((a, b) => b.day.localeCompare(a.day) || a.r.name.localeCompare(b.r.name));
  const shownCount = current.length + (showEnded ? ended.length : 0);
  // ALLDAY-01: one table per book, in the books' order; a routine whose book the tab has not listed is shown under
  // "book not loaded", never dropped. In each: the timed rows in clock order (FORM-01), then the all-day charges by next date.
  const unlisted = current.filter((x) => !entities.some((e) => e.id === x.r.entity_id));
  const books = [
    ...booksInOrder(entities).map((b) => ({ id: b.id, name: b.name })),
    ...(unlisted.length > 0 ? [{ id: '', name: ACCOUNT_CELL_WORDS.bookNotLoaded }] : []),
  ];
  const tables = books.map((book) => {
    const own = book.id === '' ? unlisted : current.filter((x) => x.r.entity_id === book.id);
    return {
      book,
      timed: own.filter((x) => isStop(x.r.role)).sort((a, b) => byClockThenName(a.r, b.r)),
      allDay: own.filter((x) => !isStop(x.r.role)).sort((a, b) => byNextDateThenName(a.r, b.r)),
    };
  });

  const row = ({ r, end }: { r: Routine; end: ReturnType<typeof endedBy> }) => (
    <RoutineRow
      key={r.id}
      routine={r}
      end={end}
      entities={entities}
      onUpdate={refresh}
      onDelete={refresh}
    />
  );
  // The one header every table carries: Routine · Cadence · Days · Time · Amount · Account · controls (FORM-01).
  const head = (
    <thead>
      <tr className="text-left text-text-faint uppercase tracking-wide">
        <th className="px-2 py-1.5 font-normal">Routine</th>
        <th className="px-2 py-1.5 font-normal">Cadence</th>
        <th className="px-2 py-1.5 font-normal">Days</th>
        <th className="px-2 py-1.5 font-normal">Time</th>
        <th className="px-2 py-1.5 font-normal">Amount</th>
        <th className="px-2 py-1.5 font-normal">Account</th>
        <th className="px-2 py-1.5 font-normal"><span className="sr-only">controls</span></th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-muted" data-routines-count>
            {shownCount} {shownCount === 1 ? 'routine' : 'routines'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="text-text-muted">show inactive</span>
          </label>
          {/* ROUTINE-02a: the ended routines, counted among those fetched, behind their own toggle. */}
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showEnded}
              onChange={(e) => setShowEnded(e.target.checked)}
              data-routines-show-ended
            />
            <span className="text-text-muted">{showEndedWords(ended.length)}</span>
          </label>
        </div>
        {!showCreate && (
          <div className="flex items-center gap-2">
            {/* ZERO-STATE-1: no silent disable — when no entity exists the
                reason renders beside the button. Truth source (SELL-04):
                entities are set up BY THE USER in Books — the first-run step
                on the Books tab and the chart page (POST /api/entities);
                nothing creates one automatically any more. */}
            {entities.length === 0 && (
              <span className="text-[11px] text-text-faint">
                no entity yet — set one up in Books › <a href={SETUP_DOOR} className="underline">Chart of accounts</a>.
              </span>
            )}
            <button
              type="button"
              onClick={startCreate}
              disabled={entities.length === 0}
              className={`px-3 py-1 rounded border text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 ${'border-brand-purple bg-brand-purple'}`}
            >
              + new routine
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <RoutineCreateForm
          entities={entities}
          defaultEntityId={createDefaultEntityId}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="text-xs text-text-muted">loading routines…</div>
      ) : routines.length === 0 ? (
        <div className="text-xs text-text-muted italic">
          no routines yet — click &quot;+ new routine&quot; to create your first one. Bridgewater&apos;s Principles operationalize through cadence; this is where you set yours.
        </div>
      ) : (
        <>
          {/* ALLDAY-01: one table per book — BUSINESS, PERSONAL, then any other; the timed rows, then the ALL DAY band. */}
          {tables.map(({ book, timed, allDay }) => (
            <div key={book.id || 'unlisted'} className="space-y-1" data-routines-book={book.id || 'unlisted'}>
              <div className="text-xs font-bold text-text-primary uppercase tracking-wide" data-routines-book-name>{book.name}</div>
              {timed.length === 0 && allDay.length === 0 ? (
                <div className="text-xs text-text-muted italic" data-routines-book-empty>{NO_ROUTINES_WORDS}</div>
              ) : (
                <div className="overflow-x-auto border border-border rounded bg-white">
                  <table className="w-full min-w-[56rem] border-collapse text-xs" data-routines-table>
                    {head}
                    {/* FORM-01: the timed routines, flat, in clock order. */}
                    {timed.map(row)}
                    {/* ALLDAY-01: the book's all-day charges, under their own sub-heading, by their next date. */}
                    {allDay.length > 0 && (
                      <Fragment key="all-day">
                        <tbody>
                          <tr data-all-day-band>
                            <td colSpan={ROUTINE_TABLE_COLUMNS} className="px-2 py-1 border-t border-border bg-bg-row text-xs text-text-faint uppercase tracking-wide">
                              {allDayHeadingWords(allDay.length)}
                            </td>
                          </tr>
                        </tbody>
                        {allDay.map(row)}
                      </Fragment>
                    )}
                  </table>
                </div>
              )}
            </div>
          ))}
          {/* ROUTINE-02a: the ended routines, once, at the bottom of the page, newest end first — only while shown. */}
          {showEnded && ended.length > 0 && (
            <div className="overflow-x-auto border border-border rounded bg-white">
              <table className="w-full min-w-[56rem] border-collapse text-xs" data-routines-table data-routines-ended>
                {head}
                <tbody>
                  <tr data-ended-group>
                    <td colSpan={ROUTINE_TABLE_COLUMNS} className="px-2 py-1 border-t border-border bg-bg-row text-xs text-text-faint uppercase tracking-wide">
                      {endedGroupWords(ended.length)}
                    </td>
                  </tr>
                </tbody>
                {ended.map(row)}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
