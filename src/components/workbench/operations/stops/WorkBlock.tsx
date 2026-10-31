/**
 * WorkBlock — THE WORK BLOCK, on the step view of an execute stop (WORK-02, Alex, 2026-10-26).
 *
 * Between the VENDOR row and the stop's record form, for the role `execute` alone (workBlock.ts showsWorkBlock) and never
 * on the journal card. Two parts, in this order:
 *
 *   TO DO — the open tasks of the open projects from the card's ONE projects read (dayReads.ts readBacklog — THE LOG's
 *   read), grouped under their project in THE LOG's order (rank, then title), each row the task's title with one ✓: the
 *   existing quick-complete, the one writer the task row fires (projects/useTaskActions.ts completeTask — lifted, never
 *   a copied fetch). After a write the card reads the backlog again (onChanged → logReads), so TO DO and DONE both move.
 *   No other control: edit, schedule, archive stay on /tasks.
 *
 *   DONE IN THIS BLOCK — the tasks whose completed_at falls inside the block's window, [the stop's planned instant, +
 *   the line's minutes] (workBlock.ts blockWindowOf — the day card's minutes rule and its clock), narrowed here from the
 *   day's done tasks the read carries (doneInBlockOf). A block with no minutes — or, WORK-03 (call 4, ruled 2026-10-26), with
 *   ≤ 0 minutes — lists nothing and says so (NO_LENGTH_WORDS, blockWindowOf null for both).
 *   Each row "<title> · <HH:MM in the viewer's zone>" with ↩ — the existing uncomplete POST (uncompleteTask), the reason
 *   UNTICK_REASON_WORDS — so a mis-tick is undone where it was made. Derived from completed_at and labelled so (the
 *   tooltip DONE_BY_WORDS).
 *
 * In flight, a failed read and an answer missing the done tasks are each said in words — never an empty list. A write's
 * refusal prints beside its row, in the route's words. Nothing is stored in the browser.
 *
 * A Time-owned component: it reads through the card's one read and writes through Tasks' routes by Tasks' one writer; no
 * Tasks component is mounted on the card (TOOL-LAW-01 rule 5 — "a component belonging to tool A may not be mounted on
 * tool B's page").
 *
 * WORK-03 (Alex, 2026-10-26): the block reaches the reel — the execute stop's scene says what was done in it and the caption
 * counts it (dayCard.ts stopSceneLines, captionText; the card hands the reel the lists through workBlock.ts doneInBlocksOf).
 */

'use client';

import { useState } from 'react';
import {
  DONE_BY_WORDS, DONE_IN_BLOCK_WORD, DONE_NOT_READ_WORDS, NOTHING_DONE_WORDS, NO_LENGTH_WORDS, TICK_WORDS, TO_DO_WORD, UNTICK_REASON_WORDS, UNTICK_WORDS, WORK_BLOCK_WORD,
  blockWindowOf, doneInBlockOf, doneRowWords, doneTimeWords, showsWorkBlock, tickWords, untickWords,
} from '@/lib/operations/workBlock';
import { LOG_LOADING_WORDS, NO_OPEN_TASKS_WORDS, type LogDoneTask, type LogProject } from '@/lib/operations/morningLog';
import { completeTask, uncompleteTask, type TaskWriteAnswer } from '../projects/useTaskActions';
import type { Stop } from '../day/dayCard';
import type { Read } from '../week/weekReads';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const head = 'text-text-secondary font-semibold';

/** A done task with the project it belongs to — the ↩ needs both. */
interface DoneRow extends LogDoneTask {
  readonly projectId: string;
}

export default function WorkBlock({ stop, day, viewerZone, log, onChanged }: {
  stop: Stop;
  day: string;
  viewerZone: string;
  /** The card's backlog read — null while in flight. */
  log: Read<readonly LogProject[]> | null;
  /** After a write: the card reads the backlog again. */
  onChanged: () => void;
}) {
  // The rule, not a case: the card mounts this on an execute stop alone.
  if (!showsWorkBlock(stop)) throw new Error(`WorkBlock: ${stop.key} is a ${stop.role} stop — the work block mounts on an execute stop alone`);
  const block = blockWindowOf(stop, day);
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ readonly id: string; readonly words: string } | null>(null);

  const write = async (id: string, send: () => Promise<TaskWriteAnswer>): Promise<void> => {
    setBusy(id);
    setRefused(null);
    let answer: TaskWriteAnswer;
    try {
      answer = await send();
    } catch (e) {
      answer = { ok: false, words: e instanceof Error ? e.message : String(e) };
    }
    setBusy(null);
    if (!answer.ok) { setRefused({ id, words: answer.words }); return; }
    onChanged();
  };

  const projects: readonly LogProject[] | null = log !== null && log.ok ? log.value : null;
  const toDo = projects === null ? null : projects.filter((p) => p.tasks.length > 0);
  // The day's done tasks, each with its project — or the words when the read did not carry them.
  const doneToday: readonly DoneRow[] | 'not read' | null = ((): readonly DoneRow[] | 'not read' | null => {
    if (projects === null) return null;
    const rows: DoneRow[] = [];
    for (const p of projects) {
      if (p.doneTasks === undefined) return 'not read';
      for (const t of p.doneTasks) rows.push({ ...t, projectId: p.id });
    }
    return rows;
  })();
  const done = doneToday === null || doneToday === 'not read' || block === null ? null : doneInBlockOf(doneToday, block);

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-2 text-xs" data-day-work-block={stop.key}>
      <div className={head} data-day-work-head>{WORK_BLOCK_WORD}</div>

      <div className="space-y-1" data-day-work-todo>
        <div className={head}>{TO_DO_WORD}</div>
        {log === null && <div className="text-text-muted" data-day-work-loading>{LOG_LOADING_WORDS}</div>}
        {log !== null && !log.ok && <div className="text-brand-red" data-day-work-failed>{log.words}</div>}
        {toDo !== null && toDo.length === 0 && <div className="text-text-muted" data-day-work-none-to-do>{NO_OPEN_TASKS_WORDS}</div>}
        {toDo !== null && toDo.map((p) => (
          <div key={p.id} data-day-work-project={p.id}>
            <div className="font-semibold text-text-primary" data-day-work-project-title>{p.title}</div>
            <ul className="pl-3 space-y-0.5">
              {p.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2" data-day-work-task={t.id}>
                  <button type="button" className={chip} disabled={busy !== null} aria-label={tickWords(t.title)} onClick={() => write(t.id, () => completeTask(p.id, t.id))} data-day-work-tick={t.id}>{TICK_WORDS}</button>
                  <span data-day-work-task-title>{t.title}</span>
                  {refused !== null && refused.id === t.id && <span className="text-brand-red" data-day-work-refused={t.id}>{refused.words}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-1" data-day-work-done title={DONE_BY_WORDS}>
        <div className={head}>{DONE_IN_BLOCK_WORD}</div>
        {block === null && <div className="text-text-muted" data-day-work-no-length>{NO_LENGTH_WORDS}</div>}
        {block !== null && doneToday === 'not read' && <div className="text-brand-red" data-day-work-done-not-read>{DONE_NOT_READ_WORDS}</div>}
        {done !== null && done.length === 0 && <div className="text-text-muted" data-day-work-nothing-done>{NOTHING_DONE_WORDS}</div>}
        {done !== null && done.length > 0 && (
          <ul className="pl-3 space-y-0.5">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2" data-day-work-done-task={t.id}>
                <button type="button" className={chip} disabled={busy !== null} aria-label={untickWords(t.title)} onClick={() => write(t.id, () => uncompleteTask(t.projectId, t.id, UNTICK_REASON_WORDS))} data-day-work-untick={t.id}>{UNTICK_WORDS}</button>
                <span data-day-work-done-words>{doneRowWords(t.title, doneTimeWords(t.completedAt, viewerZone))}</span>
                {refused !== null && refused.id === t.id && <span className="text-brand-red" data-day-work-refused={t.id}>{refused.words}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
