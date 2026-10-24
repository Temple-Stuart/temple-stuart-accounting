/**
 * MoveControl — "I'M MOVING": THE CONTROL IS THE LIST (MOVE-01, Alex, 2026-10-19).
 *
 * Beside the day controls at the top of Tasks: "moving". It opens one form —
 * the first day there (a date, seeded with tomorrow), the new zone (the one
 * zone picker, ZoneSelect, no default), optionally the new place with its
 * last day (a stay) — then one row per current routine, grouped as the
 * routine list is: name · cadence · carry over ✓ · start time · end time
 * (editable, seeded with the routine's own) · "→ <the copy's first day> in
 * <zone>". A routine that starts on or after the date, a one-off included,
 * reads "re-zoned, same clock" with no box. Project tasks are not listed;
 * one line says they carry no zone. Under the list, the plan in words BEFORE
 * anything is written — the same planMove the route fires (no drift). Confirm
 * posts the move; on 200 the page loads the card's page for the date in full
 * (DAY_CARD_PATH?date=<date> — TIME-01, 2026-10-19: /time; HOME-01, 2026-10-24: /runway; no literal) so the
 * card, the list, the stays and the ledger all re-read (Alex 8 yes); a
 * refusal is shown in the route's own words. Cancel writes nothing. Nothing
 * is stored in the browser.
 *
 * ALLDAY-01 (Alex, 2026-10-19): the current all-day charges are not rows of
 * the list — they are listed under a line of their own, "n all-day charges
 * stay as they are (they hit the account on a date, wherever you are)", and
 * the plan neither ends, copies nor re-zones them (routineMove.ts leftAlone).
 */

'use client';

import { useState } from 'react';
import { shiftDay } from '@/lib/budget/reportView';
import { DAY_CARD_PATH } from '../day/dayCard';
import { MOVE_CHIP_WORDS, REZONED_WORDS, TASKS_WORDS, allDayStayWords, arrowWords, defaultEntry, leftAlone, listRows, planMove, type MoveEntry } from '@/lib/operations/routineMove';
import type { StayRow } from '@/lib/operations/stay';
import { CADENCE_GROUP_LABELS, CADENCE_GROUP_ORDER, type Routine } from '../routines/types';
import ZoneSelect from '../routines/ZoneSelect';
import { readJson, type Read } from '../week/weekReads';

export const MOVE_TITLE_WORDS = 'moving — from a day, every current routine ends the day before and its copy runs in the new zone';
export const PICK_ZONE_WORDS = 'pick the new zone';
export const CONFIRM_WORDS = 'confirm the move';
export const MOVE_FAILED_WORDS = 'the move was refused';
export const NO_ROUTINES_WORDS = 'no current routine on that day — nothing to move';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const label = 'text-text-faint uppercase tracking-wide text-[10px]';

interface Props {
  /** The viewer's day ('YYYY-MM-DD'), from the card; null until read. */
  readonly today: string | null;
}

export default function MoveControl({ today }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [zone, setZone] = useState('');
  const [place, setPlace] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [routines, setRoutines] = useState<Read<Routine[]> | null>(null);
  const [stays, setStays] = useState<Read<StayRow[]> | null>(null);
  const [edited, setEdited] = useState<ReadonlyMap<string, MoveEntry>>(new Map());
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const reset = () => { setOpen(false); setDate(''); setZone(''); setPlace(''); setLastDay(''); setRoutines(null); setStays(null); setEdited(new Map()); setBusy(false); setRefusal(null); };

  const start = async () => {
    if (today === null) return;
    setOpen(true);
    setDate(shiftDay(today, 1));
    const [r, s] = await Promise.all([readJson('/api/operations/routines?is_active=true'), readJson('/api/operations/stays')]);
    setRoutines(r.ok ? { ok: true, value: (r.value.routines as Routine[]) ?? [] } : r);
    setStays(s.ok ? { ok: true, value: (s.value.stays as StayRow[]) ?? [] } : s);
  };

  const active = routines !== null && routines.ok ? routines.value : [];
  const rows = date === '' ? [] : listRows(active, date);
  // ALLDAY-01: the charges the move leaves alone — their own line, no boxes.
  const charges = date === '' ? [] : leftAlone(active, date);
  const entryOf = (id: string): MoveEntry => edited.get(id) ?? defaultEntry(active.find((r) => r.id === id) as Routine);
  const entries = rows.map((row) => entryOf(row.id));
  const setEntry = (e: MoveEntry) => setEdited(new Map(edited).set(e.id, e));
  const stay = place.trim() === '' && lastDay === '' ? null : { place, ends_on: lastDay };
  const ready = routines !== null && routines.ok && stays !== null && stays.ok && date !== '';
  const plan = ready ? planMove({ date, timezone: zone, now: new Date(), stay, routines: active, entries, stays: stays.value }) : null;

  const confirm = async () => {
    if (plan === null || !plan.ok) return;
    setBusy(true);
    setRefusal(null);
    let res: Response;
    try {
      res = await fetch('/api/operations/routines/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: plan.date, timezone: plan.timezone, stay, routines: entries }),
      });
    } catch (error) {
      setBusy(false);
      setRefusal(`${MOVE_FAILED_WORDS}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    let body: { message?: string; error?: string } | null = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
      setBusy(false);
      setRefusal(`${MOVE_FAILED_WORDS}: ${body?.message ?? body?.error ?? `${res.status}`}`);
      return;
    }
    // Written: every surface reads the new day in full.
    window.location.assign(`${DAY_CARD_PATH}?date=${plan.date}`);
  };

  return (
    <div className="text-xs" data-move-control>
      <button type="button" className={chip} disabled={today === null || open} onClick={start} title={MOVE_TITLE_WORDS} data-move-open>{MOVE_CHIP_WORDS}</button>
      {open && (
        <form className="mt-2 p-2 border border-border rounded bg-bg-row space-y-2" data-move-form onSubmit={(e) => { e.preventDefault(); confirm(); }}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5"><span className={label}>first day there</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={box} required data-move-date />
            </label>
            <label className="flex flex-col gap-0.5"><span className={label}>new zone</span>
              <ZoneSelect value={zone} onChange={setZone} className={`${box} w-56`} unpickedWords={PICK_ZONE_WORDS} data-move-zone />
            </label>
            <label className="flex flex-col gap-0.5"><span className={label}>new place (optional — a stay)</span>
              <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="place — Makassar" className={`${box} w-44`} maxLength={80} data-move-place />
            </label>
            <label className="flex flex-col gap-0.5"><span className={label}>its last day</span>
              <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className={box} data-move-last-day />
            </label>
          </div>
          {routines !== null && !routines.ok && <p className="text-brand-red" data-move-read-failed>The routines could not be read — {routines.words}</p>}
          {stays !== null && !stays.ok && <p className="text-brand-red" data-move-read-failed>The stays could not be read — {stays.words}</p>}
          {ready && rows.length === 0 && <p className="text-text-muted" data-move-none>{NO_ROUTINES_WORDS}</p>}
          {ready && rows.length > 0 && (
            <table className="w-full text-xs" data-move-list>
              <thead><tr className="text-left text-text-faint uppercase tracking-wide text-[10px]"><th className="px-1 py-0.5">routine</th><th className="px-1 py-0.5">cadence</th><th className="px-1 py-0.5">carry over</th><th className="px-1 py-0.5">start</th><th className="px-1 py-0.5">end</th><th className="px-1 py-0.5" /></tr></thead>
              {CADENCE_GROUP_ORDER.map((g) => {
                const group = rows.filter((r) => r.cadence === g);
                if (group.length === 0) return null;
                return (
                  <tbody key={g}>
                    <tr data-move-group={g}><td colSpan={6} className="px-1 py-0.5 text-text-faint uppercase tracking-wide text-[10px]">{CADENCE_GROUP_LABELS[g]} ({group.length})</td></tr>
                    {group.map((row) => {
                      const e = entryOf(row.id);
                      const planned = plan !== null && plan.ok ? plan.rows.find((p) => p.id === row.id) ?? null : null;
                      return (
                        <tr key={row.id} data-move-row={row.id} data-move-kind={row.kind}>
                          <td className="px-1 py-0.5 font-semibold text-text-primary">{row.name}</td>
                          <td className="px-1 py-0.5 text-text-muted">{CADENCE_GROUP_LABELS[row.cadence]}</td>
                          {row.kind === 'rezoned' ? (
                            <td colSpan={4} className="px-1 py-0.5 text-text-muted" data-move-rezoned>{REZONED_WORDS}</td>
                          ) : (
                            <>
                              <td className="px-1 py-0.5"><input type="checkbox" checked={e.carry} onChange={(ev) => setEntry({ ...e, carry: ev.target.checked })} aria-label={`carry over ${row.name}`} data-move-carry /></td>
                              <td className="px-1 py-0.5"><input type="time" value={e.start_time} onChange={(ev) => setEntry({ ...e, start_time: ev.target.value })} disabled={!e.carry} className={box} data-move-start /></td>
                              <td className="px-1 py-0.5"><input type="time" value={e.end_time} onChange={(ev) => setEntry({ ...e, end_time: ev.target.value })} disabled={!e.carry} className={box} data-move-end /></td>
                              <td className="px-1 py-0.5 text-text-muted" data-move-arrow>{planned?.copy ? arrowWords(planned.copy.first_day, plan !== null && plan.ok ? plan.timezone : zone) : e.carry ? '' : 'no copy'}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          )}
          {ready && charges.length > 0 && (
            <div className="text-text-muted" data-move-all-day>
              <p data-move-all-day-words>{allDayStayWords(charges.length)}</p>
              <ul className="pl-4 list-disc">
                {charges.map((c) => <li key={c.id} data-move-all-day-row={c.id}>{c.name}</li>)}
              </ul>
            </div>
          )}
          <p className="text-text-faint" data-move-tasks>{TASKS_WORDS}</p>
          {zone === '' && <p className="text-brand-amber" data-move-zone-needed>{PICK_ZONE_WORDS}</p>}
          {plan !== null && plan.ok && <p className="font-semibold text-text-primary" data-move-plan>{plan.words}</p>}
          {plan !== null && !plan.ok && zone !== '' && <p className="text-brand-amber" data-move-refused>{plan.message}</p>}
          {refusal !== null && <p className="text-brand-red" data-move-answer>{refusal}</p>}
          <div className="flex gap-1.5">
            <button type="submit" className={chip} disabled={busy || plan === null || !plan.ok} data-move-confirm>{CONFIRM_WORDS}</button>
            <button type="button" className={chip} disabled={busy} onClick={reset} data-move-cancel>cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
