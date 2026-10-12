/**
 * StopForm — the record at a stop, typed where the stop is shown (STOP-01, 2026-10-12).
 *
 * Under the day card's plate on the step view, outside the recorded box: for a
 * line or a stepless routine, "✓ done now" (one tap: done at this moment, saved
 * at once with whatever else is typed), "skipped" (with its reason), the done
 * time in the routine's zone, the amount in dollars, the rating 1–5 (the rubric
 * in src/lib/operations/stopRecord.ts RATING_WORDS), the minutes, a note; save;
 * clear when a record exists. A task has no form here — its record is the task
 * (the Tasks tab). Every write goes through the one writer (stopWrites.ts) and
 * the route's refusal is shown in its own words under the form; after a write
 * the caller reads the records again — never an optimistic copy. The caller
 * keys this form by the stop AND its record, so another stop (‹ step ›), a
 * cleared record or a first save starts a fresh draft from what is held. The
 * amount is read by the Budget's own rule (centsFromDecimalString — string
 * arithmetic, never a float). Nothing is stored in the browser.
 */

'use client';

import { useState } from 'react';
import { centsFromDecimalString } from '@/lib/budget/days';
import { RATING_WORDS, WHEN_WORDS, amountWords, clearStopQuestion, minutesTypedWords, type StopOutcome } from '@/lib/operations/stopRecord';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import { statusWords, type Stop } from '../day/dayCard';
import { clearStopRecord, setStopRecord, type StopBody } from './stopWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Draft {
  readonly outcome: StopOutcome;
  /** The done-at's local day in the routine's zone (the card's day until "now" or the record says otherwise). */
  readonly doneDay: string;
  readonly doneTime: string;
  readonly amount: string;
  readonly rating: number | null;
  readonly minutes: string;
  readonly note: string;
}

/** Cents as the dollars box shows them: '12.50', '12', '' for none. */
const dollarsOf = (cents: number | null): string => (cents === null ? '' : (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)));

function draftOf(stop: Stop, day: string): Draft {
  const r = stop.record;
  return {
    outcome: r === null ? 'done' : r.outcome,
    doneDay: stop.doneAt === null ? day : stop.doneAt.day,
    doneTime: stop.doneAt === null ? '' : stop.doneAt.time,
    amount: dollarsOf(r === null ? null : r.actual_cents),
    rating: r === null ? null : r.rating,
    minutes: r === null || r.actual_minutes === null ? '' : String(r.actual_minutes),
    note: r === null || r.note === null ? '' : r.note,
  };
}

export default function StopForm({ stop, day, onChanged }: { stop: Stop; day: string; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(stop, day));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A task's record is the task's own row — nothing to type here.
  if (stop.address === null || stop.zone === null) return null;
  const address = stop.address;
  const zone = stop.zone;

  /** The body the route reads, or the form's own refusal — nothing guessed. */
  const bodyOf = (d: Draft): { ok: true; body: StopBody } | { ok: false; message: string } => {
    let doneAt: string | null = null;
    if (d.outcome === 'done') {
      if (!TIME_RE.test(d.doneTime)) return { ok: false, message: WHEN_WORDS };
      doneAt = zonedToInstant(d.doneDay, d.doneTime, zone).toISOString();
    }
    let actualCents: number | null = null;
    if (d.amount.trim() !== '') {
      let read: ReturnType<typeof centsFromDecimalString>;
      try {
        read = centsFromDecimalString(d.amount);
      } catch {
        return { ok: false, message: amountWords(d.amount) };
      }
      if (!read.ok) return { ok: false, message: amountWords(d.amount) };
      actualCents = read.cents;
    }
    let actualMinutes: number | null = null;
    if (d.minutes.trim() !== '') {
      if (!/^\d+$/.test(d.minutes.trim())) return { ok: false, message: minutesTypedWords(d.minutes) };
      actualMinutes = Number(d.minutes.trim());
    }
    const note = d.note.trim();
    return {
      ok: true,
      body: { kind: address.kind, id: address.id, instant: address.instant, outcome: d.outcome, done_at: doneAt, actual_cents: actualCents, rating: d.rating, note: note === '' ? null : note, actual_minutes: actualMinutes },
    };
  };

  const save = async (d: Draft) => {
    if (busy) return;
    const read = bodyOf(d);
    if (!read.ok) { setWords(read.message); return; }
    setBusy(true);
    setWords(null);
    try {
      const answer = await setStopRecord(read.body);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } catch (error) {
      setWords(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  // One tap: done at this moment, in the routine's zone — saved with whatever else is typed.
  const doneNow = () => {
    const at = instantToZoned(new Date(), zone);
    const d: Draft = { ...draft, outcome: 'done', doneDay: at.date, doneTime: at.time };
    setDraft(d);
    save(d);
  };

  const clear = async () => {
    const r = stop.record;
    if (r === null || busy || !window.confirm(clearStopQuestion(statusWords(stop, day)))) return;
    setBusy(true);
    setWords(null);
    try {
      const answer = await clearStopRecord(r.id);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } catch (error) {
      setWords(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto space-y-1" style={{ width: 540 }} data-stop-form>
      <form className="flex flex-wrap items-center gap-1.5 text-xs" onSubmit={(e) => { e.preventDefault(); save(draft); }}>
        <span className="text-text-faint uppercase tracking-wide">Record</span>
        <button type="button" className={chip} disabled={busy} onClick={doneNow} data-stop-done-now>✓ done now</button>
        <button type="button" className={`${chip} ${draft.outcome === 'done' ? 'font-bold' : ''}`} disabled={busy} onClick={() => setDraft({ ...draft, outcome: 'done' })} data-stop-outcome="done">done</button>
        <button type="button" className={`${chip} ${draft.outcome === 'skipped' ? 'font-bold' : ''}`} disabled={busy} onClick={() => setDraft({ ...draft, outcome: 'skipped' })} data-stop-outcome="skipped">skipped</button>
        {draft.outcome === 'done' && (
          <input type="text" inputMode="numeric" value={draft.doneTime} onChange={(e) => setDraft({ ...draft, doneTime: e.target.value })} placeholder="HH:MM" aria-label={`Done at (${zone})`} className={`${box} w-16 font-mono`} maxLength={5} data-stop-time />
        )}
        <span className="text-text-muted">$</span>
        <input type="text" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="paid" aria-label="Amount paid, dollars" className={`${box} w-20 font-mono`} data-stop-amount />
        <span className="flex items-center" role="group" aria-label="Rating" data-stop-rating={draft.rating === null ? undefined : draft.rating}>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              type="button"
              key={n}
              className={`px-0.5 text-base leading-none ${draft.rating !== null && n <= draft.rating ? 'text-brand-gold' : 'text-text-faint'}`}
              disabled={busy}
              title={RATING_WORDS[n]}
              aria-label={`${n}: ${RATING_WORDS[n]}`}
              onClick={() => setDraft({ ...draft, rating: draft.rating === n ? null : n })}
            >★</button>
          ))}
        </span>
        <input type="text" inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} placeholder="min" aria-label="Minutes" className={`${box} w-14 font-mono`} data-stop-minutes />
        <input type="text" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={draft.outcome === 'skipped' ? 'why — required' : 'note — why the delta'} aria-label="Note" className={`${box} w-56`} maxLength={280} data-stop-note />
        <button type="submit" className={chip} disabled={busy}>save</button>
        {stop.record !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-stop-clear>clear</button>}
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-stop-words>{words}</p>}
    </div>
  );
}
