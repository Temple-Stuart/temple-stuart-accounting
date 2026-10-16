/**
 * AttachRecord — a record that matches no stop, and the stops it can attach to
 * (RETRO-01, Alex, 2026-10-16).
 *
 * One line under the day card's plate per stranded record: its plan's words,
 * its instant in the routine's zone, what it says (day/dayCard.ts
 * recordWithoutStopWords), then "attach to <stop>" for every stop of the day
 * that is the same plan and holds no record (attachableStops), or the one
 * sentence saying there is none — or that the plan's stop already holds a
 * record (planStops). A press moves the record through the one
 * writer (stopWrites.ts moveStopRecord — the stops/[id] PATCH proves the
 * instant is that plan's stop on the day and refuses a taken one by name);
 * then the card reads its records again (onChanged). A refusal is shown here,
 * in the route's words; a request that never reached the route too. Nothing
 * is stored in the browser; nothing is retried.
 */

'use client';

import { useState } from 'react';
import type { StopRecordPlan, StopRecordRow } from '@/lib/operations/stopRecord';
import { attachWords, attachableStops, noStopToAttachWords, planStops, recordWithoutStopWords, stopTakenWords, type Stop } from '../day/dayCard';
import { moveStopRecord } from './stopWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50 text-text-primary';

export default function AttachRecord({ record, plan, stops, onChanged }: {
  record: StopRecordRow; plan: StopRecordPlan; stops: readonly Stop[]; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const targets = attachableStops(record, stops);
  const taken = targets.length === 0 && planStops(record, stops).length > 0;

  const attach = async (stop: Stop) => {
    if (busy !== null || stop.address === null) return;
    setBusy(stop.key);
    setWords(null);
    try {
      const answer = await moveStopRecord(record.id, stop.address.instant);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } catch (error) {
      setWords(`the request did not reach the server: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-day-record-without-stop={record.id}>
      <span>{recordWithoutStopWords(record, plan)}</span>
      {targets.map((s) => (
        <button key={s.key} type="button" className={chip} disabled={busy !== null} aria-busy={busy === s.key} onClick={() => attach(s)} data-day-attach={s.key}>{attachWords(s)}</button>
      ))}
      {targets.length === 0 && <span data-day-no-attach={taken ? 'taken' : 'none'}>{taken ? stopTakenWords(plan.routine_name) : noStopToAttachWords(plan.routine_name)}</span>}
      {words !== null && <span className="text-brand-red" data-day-attach-failed>{words}</span>}
    </div>
  );
}
