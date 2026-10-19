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
import { SETUP_DOOR } from '@/lib/entities/kinds';
import { byClockThenName, endedBy } from '@/lib/operations/rruleHelpers';

/** ROUTINE-02a: the toggle's words, with the count. */
export const showEndedWords = (n: number): string => `show ended (${n})`;
/** ROUTINE-02a: the group's label, with the count (the row's class upper-cases it like the cadence labels). */
export const endedGroupWords = (n: number): string => `ended (${n})`;


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

  // ROUTINE-02a: current and ended, judged now in each routine's own zone. The cadence
  // groups hold the current ones; the ended sit in their own group, newest end first.
  const now = new Date();
  const judged = routines.map((r) => ({ r, end: endedBy(r.end_date, r.timezone, now) }));
  // FORM-01: the current routines in clock order — one flat table, no cadence groups.
  const current = judged.filter((x) => !x.end.ended).sort((a, b) => byClockThenName(a.r, b.r));
  const ended = judged
    .flatMap((x) => (x.end.ended ? [{ r: x.r, end: x.end, day: x.end.day }] : []))
    .sort((a, b) => b.day.localeCompare(a.day) || a.r.name.localeCompare(b.r.name));
  const shownCount = current.length + (showEnded ? ended.length : 0);

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
      ) : shownCount === 0 ? (
        <div className="text-xs text-text-muted italic">
          no routines yet — click &quot;+ new routine&quot; to create your first one. Bridgewater&apos;s Principles operationalize through cadence; this is where you set yours.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded bg-white">
          <table className="w-full min-w-[56rem] border-collapse text-xs" data-routines-table>
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
            {/* FORM-01: the current routines, flat, in clock order. */}
            {current.map(({ r, end }) => (
              <RoutineRow
                key={r.id}
                routine={r}
                end={end}
                entities={entities}
                onUpdate={refresh}
                onDelete={refresh}
              />
            ))}
            {/* ROUTINE-02a: the ended routines, at the bottom, newest end first — only while shown. */}
            {showEnded && ended.length > 0 && (
              <Fragment key="ended">
                <tbody>
                  <tr data-ended-group>
                    <td colSpan={ROUTINE_TABLE_COLUMNS} className="px-2 py-1 border-t border-border bg-bg-row text-xs text-text-faint uppercase tracking-wide">
                      {endedGroupWords(ended.length)}
                    </td>
                  </tr>
                </tbody>
                {ended.map(({ r, end }) => (
                  <RoutineRow
                    key={r.id}
                    routine={r}
                    end={end}
                    entities={entities}
                    onUpdate={refresh}
                    onDelete={refresh}
                  />
                ))}
              </Fragment>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
