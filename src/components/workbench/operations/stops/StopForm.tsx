/**
 * StopForm — the record at a stop, typed where the stop is shown (STOP-01, 2026-10-12).
 *
 * Under the day card's plate on the step view, outside the recorded box: for a
 * line or a stepless routine, "✓ done now" (one tap: done at this moment, saved
 * at once with whatever else is typed), "skipped" (with its reason), the done
 * time in the routine's zone; then WHAT THE STOP'S ROLE ASKS (ROLE-01,
 * src/lib/operations/stopRole.ts): a PLACE stop asks for its vendor (Budget's
 * own vendor box on the matched plan line — a line with no amount has no vendor
 * to plan), the amount paid, the stars (the rubric in stopRecord.ts
 * RATING_WORDS), and "why" only once the amount differs from the plan; a WORK
 * stop (journal · plan · execute) asks for the minutes and one line, prompted
 * by its role ("finished up to here"); a stop with no role set asks everything,
 * as before. A field the role does not ask is still SHOWN whenever the held
 * record carries a value for it (a record written before the role was set, an
 * amount corrected back to the plan after a "why" was typed) — so it can be
 * read and corrected; a field neither asked nor shown is sent as null, never
 * carried along unseen. Save; clear when a record exists. A task has no form
 * here — its record is the task (the Tasks tab). Every RECORD write goes
 * through the one writer (stopWrites.ts); the vendor is planned through
 * Budget's own box (budget/DayPlanDrill.tsx VendorBox, its own writer), mounted
 * for a place stop only (PlaceVendor) so the directory is read only there, and
 * the route's refusal is shown in its own words under the form; after a write
 * the caller reads the records again — never an optimistic copy. The caller
 * keys this form by the stop AND its record, so another stop (‹ step ›), a
 * cleared record or a first save starts a fresh draft from what is held. The
 * amount is read by the Budget's own rule (centsFromDecimalString — string
 * arithmetic, never a float). Nothing is stored in the browser.
 *
 * VENDOR-02 (2026-10-14) — Alex's ruling: the vendor box shows for EVERY priced
 * stop, whatever its role, directly above this record row. PlaceVendor (the box
 * for a place stop only, mounted at the end of this form) is gone from here,
 * with the three props that fed it (bookName, reportRead, onPlanChanged): the
 * card mounts stops/StopVendor.tsx above this form, by day/dayCard.ts
 * vendorSlot. "A PLACE stop asks for its vendor" above now reads: every priced
 * stop shows its vendor box; a place stop with no line keeps its one reason.
 */

'use client';

import { useState } from 'react';
import { centsFromDecimalString } from '@/lib/budget/days';
import { NEGATIVE_AMOUNT_WORDS, RATING_WORDS, SKIP_REASON_WORDS, WHEN_WORDS, amountWords, clearStopQuestion, minutesTypedWords, timeBoxWords, type StopOutcome } from '@/lib/operations/stopRecord';
import { NOTE_PROMPT_WORDS, type StopRole } from '@/lib/operations/stopRole';
import { JOURNAL_RECORD_WORDS } from '@/lib/operations/journal';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import { statusWords, type Stop } from '../day/dayCard';
import { underStyle, useDeckBleed } from './DayDeck';
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

export default function StopForm({ stop, day, viewerZone, onChanged }: { stop: Stop; day: string; viewerZone: string; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(stop, day));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // WIDTH-01 (2026-10-16): the row takes the card's width on screen (stops/DayDeck.tsx underStyle), as everything under a card does.
  const bleed = useDeckBleed();

  // A task's record is the task's own row — nothing to type here.
  if (stop.address === null || stop.zone === null) return null;
  const address = stop.address;
  const zone = stop.zone;
  // An all-day line is never a stop, so never this form's — the rule, not a case.
  if (stop.role === 'all_day') throw new Error(`StopForm: ${stop.key} is an all-day line — it takes no record`);
  const role: Exclude<StopRole, 'all_day'> = stop.role;
  // What this stop's role asks for. A place: the amount, the stars, and "why" once the typed amount differs from the plan —
  // or whenever the plan is unknown (nothing to differ from). A journal stop (JOURNAL-01): the minutes only — its words are
  // the journal's own questions (JournalForm.tsx), so the note is asked only for a skip's reason. A work stop (plan ·
  // execute): the minutes and one line. No role set: everything, as before.
  const typedCents = ((): number | null => {
    if (draft.amount.trim() === '') return null;
    try { const r = centsFromDecimalString(draft.amount); return r.ok ? r.cents : null; } catch { return null; }
  })();
  const differs = typedCents !== null && (stop.cents === null || typedCents !== stop.cents);
  const asks = role === 'place'
    ? { amount: true, rating: true, minutes: false, note: draft.outcome === 'skipped' || differs }
    : role === 'none'
      ? { amount: true, rating: true, minutes: true, note: true }
      : role === 'journal'
        ? { amount: false, rating: false, minutes: true, note: draft.outcome === 'skipped' }
        : { amount: false, rating: false, minutes: true, note: true };
  // A field the role does not ask is shown anyway while it holds a value — read, corrected, or cleared in the open.
  const shown = {
    amount: asks.amount || draft.amount !== '',
    rating: asks.rating || draft.rating !== null,
    minutes: asks.minutes || draft.minutes !== '',
    note: asks.note || draft.note !== '',
  };

  /** The body the route reads, or the form's own refusal — nothing guessed. */
  const bodyOf = (d: Draft): { ok: true; body: StopBody } | { ok: false; message: string } => {
    let doneAt: string | null = null;
    if (d.outcome === 'done') {
      if (!TIME_RE.test(d.doneTime)) return { ok: false, message: WHEN_WORDS };
      doneAt = zonedToInstant(d.doneDay, d.doneTime, zone).toISOString();
    }
    // Only what is on the screen is sent; a field neither asked nor shown goes as null — never carried along unseen.
    let actualCents: number | null = null;
    if (shown.amount && d.amount.trim() !== '') {
      let read: ReturnType<typeof centsFromDecimalString>;
      try {
        read = centsFromDecimalString(d.amount);
      } catch {
        return { ok: false, message: amountWords(d.amount) };
      }
      if (!read.ok) return { ok: false, message: amountWords(d.amount) };
      if (read.cents < 0) return { ok: false, message: NEGATIVE_AMOUNT_WORDS };
      actualCents = read.cents;
    }
    let actualMinutes: number | null = null;
    if (shown.minutes && d.minutes.trim() !== '') {
      if (!/^\d+$/.test(d.minutes.trim())) return { ok: false, message: minutesTypedWords(d.minutes) };
      actualMinutes = Number(d.minutes.trim());
    }
    const note = shown.note ? d.note.trim() : '';
    if (d.outcome === 'skipped' && note === '') return { ok: false, message: SKIP_REASON_WORDS };
    return {
      ok: true,
      body: { kind: address.kind, id: address.id, instant: address.instant, outcome: d.outcome, done_at: doneAt, actual_cents: actualCents, rating: shown.rating ? d.rating : null, note: note === '' ? null : note, actual_minutes: actualMinutes },
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
    <div className="mx-auto space-y-1" style={underStyle(bleed)} data-stop-form>
      <form className="flex flex-wrap items-center gap-1.5 text-xs" onSubmit={(e) => { e.preventDefault(); save(draft); }}>
        {/* JOURNAL-02 (2026-10-13): on a journal stop the label says what the record is — when the journal was done. */}
        {role === 'journal'
          ? <span className="text-text-faint tracking-wide" data-stop-record-label>{JOURNAL_RECORD_WORDS}</span>
          : <span className="text-text-faint uppercase tracking-wide" data-stop-record-label>Record</span>}
        <button type="button" className={chip} disabled={busy} onClick={doneNow} data-stop-done-now>✓ done now</button>
        <button type="button" className={`${chip} ${draft.outcome === 'done' ? 'font-bold' : ''}`} disabled={busy} onClick={() => setDraft({ ...draft, outcome: 'done' })} data-stop-outcome="done">done</button>
        <button type="button" className={`${chip} ${draft.outcome === 'skipped' ? 'font-bold' : ''}`} disabled={busy} onClick={() => setDraft({ ...draft, outcome: 'skipped' })} data-stop-outcome="skipped">skipped</button>
        {draft.outcome === 'done' && (
          <input type="text" inputMode="numeric" value={draft.doneTime} onChange={(e) => setDraft({ ...draft, doneTime: e.target.value })} placeholder={timeBoxWords(zone, viewerZone)} title={timeBoxWords(zone, viewerZone)} aria-label={`Done at (${zone})`} className={`${box} ${zone === viewerZone ? 'w-16' : 'w-56'} font-mono`} maxLength={5} data-stop-time />
        )}
        {shown.amount && (
          <>
            <span className="text-text-muted">$</span>
            <input type="text" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="paid" aria-label="Amount paid, dollars" className={`${box} w-20 font-mono`} data-stop-amount />
          </>
        )}
        {shown.rating && (
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
        )}
        {shown.minutes && (
          <input type="text" inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} placeholder="min" aria-label="Minutes" className={`${box} w-14 font-mono`} data-stop-minutes />
        )}
        {shown.note && (
          <input type="text" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={draft.outcome === 'skipped' ? 'why — required' : NOTE_PROMPT_WORDS[role]} aria-label="Note" className={`${box} w-56`} maxLength={280} data-stop-note />
        )}
        <button type="submit" className={chip} disabled={busy}>save</button>
        {stop.record !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-stop-clear>clear</button>}
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-stop-words>{words}</p>}
    </div>
  );
}
