/**
 * WeekCell — one routine on one day of the week (WEEK-01, 2026-09-30).
 *
 * No occurrence that day → "—". Done → "✓ done", the time, and the note in full
 * beneath (a Daily Vision journal is the note on that routine's day). Not done,
 * on today or an earlier day, on a status Today lets you complete → a note box
 * and "✓ done": the note goes with the completion through the one writer
 * (routines/completeRoutine.ts). A later day offers no done. A refusal shows
 * the route's own words in the cell. Beneath: the day's plan lines for the
 * routine, each with its amount and Budget's own vendor box.
 *
 * WEEK-02 (2026-09-30): a done's note can be edited, on any day it is done —
 * "edit note" opens a box holding the note (empty when there is none); "save"
 * sends it through the same one writer (editCompletionNote) and the day is read
 * again; "cancel" closes the box and sends nothing. Saving an empty box removes
 * the note. A refusal shows the route's own words under the done.
 */

'use client';

import { useState } from 'react';
import { formatCents } from '@/lib/budget/format';
import type { PlanLine } from '@/lib/budget/planLines';
import { instantToZoned } from '@/lib/time';
import { VendorBox, type useDirectory } from '@/components/budget/DayPlanDrill';
import { completeRoutine, editCompletionNote } from '../routines/completeRoutine';
import type { TodayRoutineEntry } from '../routines/types';
import { TODAY_STATUS_LABEL } from '../routines/types';
import { offersDone } from './weekPlan';

export interface PlanLinesProps {
  lines: readonly PlanLine[];
  /** The line's book's name — the tab's entity list, "book not loaded" when it lacks it. */
  bookName: (entityId: string) => string;
  directory: ReturnType<typeof useDirectory>;
  /** Read the report again after a vendor write. */
  reload: () => void;
}

/** A day's plan lines: amount, the line's words, and the vendor box. */
export function DayPlanLines({ lines, bookName, directory, reload }: PlanLinesProps) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-1 space-y-1" data-week-plan-lines>
      {lines.map((line) => (
        <div key={JSON.stringify(line.address)} className="space-y-0.5" data-week-plan-line={line.address.kind}>
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-mono tabular-nums font-bold text-text-primary" data-week-amount>{formatCents(line.cents)}</span>
            {line.line !== null && <span className="text-text-muted">{line.line}</span>}
          </div>
          <VendorBox line={line} bookName={bookName(line.entityId)} directory={directory} reload={reload} />
        </div>
      ))}
    </div>
  );
}

export default function WeekCell({ entry, timezone, day, today, onDone, plan }: {
  /** The routine's occurrence that day, or undefined when it has none. */
  entry: TodayRoutineEntry | undefined;
  timezone: string;
  day: string;
  /** The browser's date. */
  today: string;
  /** Read the day again after a completion. */
  onDone: () => void;
  plan: PlanLinesProps;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (entry === undefined) {
    return (
      <>
        <span className="text-text-muted">—</span>
        <DayPlanLines {...plan} />
      </>
    );
  }

  const done = async () => {
    setBusy(true);
    setWords(null);
    try {
      const answer = await completeRoutine(entry.routine.id, entry.expected_at, note.trim() === '' ? undefined : note);
      if (!answer.ok) { setWords(answer.message); return; }
      setNote('');
      onDone();
    } catch (e) {
      setWords(e instanceof Error ? e.message : 'failed to mark complete');
    } finally {
      setBusy(false);
    }
  };

  const editNote = () => {
    if (entry.completion === null) throw new Error('WeekCell: "edit note" is offered on a done only');
    setDraft(entry.completion.notes ?? '');
    setWords(null);
    setEditing(true);
  };

  const saveNote = async () => {
    setBusy(true);
    setWords(null);
    try {
      if (entry.completion === null) throw new Error('WeekCell: "save" is offered on a done only');
      const answer = await editCompletionNote(entry.routine.id, entry.completion.id, draft);
      if (!answer.ok) { setWords(answer.message); return; }
      setEditing(false);
      onDone();
    } catch (e) {
      setWords(e instanceof Error ? e.message : 'failed to save the note');
    } finally {
      setBusy(false);
    }
  };

  const cancelNote = () => {
    setEditing(false);
    setWords(null);
  };

  return (
    <>
      {entry.status === 'completed' && entry.completion !== null ? (
        <div data-week-done>
          <span className="text-green-800">✓ done {instantToZoned(new Date(entry.completion.completed_at), timezone).time}</span>
          {entry.completion.notes !== null && (
            <div className="mt-0.5 whitespace-pre-wrap text-text-primary" data-week-note>{entry.completion.notes}</div>
          )}
          {editing ? (
            <div className="mt-1 space-y-1" data-week-note-edit>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="w-full min-w-[9rem] px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple"
                data-week-note-edit-box
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={busy}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs"
                  data-week-note-save
                >
                  {busy ? '…' : 'save'}
                </button>
                <button
                  type="button"
                  onClick={cancelNote}
                  disabled={busy}
                  className="px-2 py-0.5 border border-border rounded hover:bg-bg-row disabled:opacity-50 text-xs"
                  data-week-note-cancel
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={editNote} className="block mt-0.5 text-text-muted underline hover:text-brand-purple" data-week-edit-note>
              edit note
            </button>
          )}
          {words !== null && (
            <div className="mt-1 px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800" data-week-refused>{words}</div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-text-muted" data-week-status={entry.status}>{TODAY_STATUS_LABEL[entry.status]}</span>
          {offersDone(entry.status, day, today) && (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="note (optional)"
                className="w-full min-w-[9rem] px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple"
                data-week-note-box
              />
              <button
                type="button"
                onClick={done}
                disabled={busy}
                className="px-2 py-0.5 border border-green-300 text-green-800 rounded hover:bg-green-50 disabled:opacity-50 text-xs"
                data-week-mark-done
              >
                {busy ? '…' : '✓ done'}
              </button>
            </>
          )}
          {words !== null && (
            <div className="px-2 py-1 rounded border bg-red-50 border-red-200 text-red-800" data-week-refused>{words}</div>
          )}
        </div>
      )}
      <DayPlanLines {...plan} />
    </>
  );
}
