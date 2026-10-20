/**
 * MorningLog — THE LOG, on the morning card above the goals box (BACKLOG-02, Alex, 2026-10-20).
 *
 * Alex, 15:42: "the morning card — it's a running log of all the projects that are ongoing and tasks that need to be
 * executed, and I need a way to rank them, and also add to them if needed, or adjust the scope if things are evolving."
 *
 * A. Every OPEN project, every book, in rank order (unranked last, then title — morningLog.ts logOrder), each with its
 *    open tasks in display_order — from the card's ONE projects read (dayReads.ts readBacklog, the reflection prompt's
 *    read). In flight is said; a failed read prints its reason in words, never an empty log; none open is
 *    "— no open projects —".
 * B. ▲ ▼ move a project one place (moveInLog) and save the WHOLE ordered list (logWrites.ts reorderProjects → PATCH
 *    /api/operations/projects/reorder); the card reads the log again after. No drag library.
 * C. "+ project" is a LINK to /tasks?new=project — the capture form opens there, its one home; the form is Tasks' and
 *    is not mounted here (TOOL-LAW-01). "+ task" on a row posts the title alone (logWrites.ts addTask).
 * D. A project's title is a LINK to its row on /tasks (?project=<id>, opened and scrolled to) — scope lives on the
 *    row; there is no second editor here.
 * E. A tick per task; "use as today's goals" hands the picked titles to the morning form, which APPENDS them to the
 *    goals box draft (morningLog.ts picksToGoals — never replacing typed goals, duplicates skipped) and says what it
 *    did; saved only by the morning form's save. Picking does not schedule.
 *
 * A Time-owned component: it reads and writes through Tasks' routes and mounts nothing of Tasks'. Nothing is stored
 * in the browser.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ADD_PROJECT_WORDS, ADD_TASK_CANCEL_WORDS, ADD_TASK_SAVE_WORDS, ADD_TASK_WORDS, LOG_LOADING_WORDS, LOG_WORD, NO_OPEN_PROJECTS_WORDS, NO_OPEN_TASKS_WORDS,
  TASK_TITLE_PLACEHOLDER, USE_AS_GOALS_WORDS, canMove, logOrder, moveInLog, moveWords, newProjectHref, picksWords, projectHref, rankWords,
  type LogMove, type LogProject,
} from '@/lib/operations/morningLog';
import type { Read } from '../week/weekReads';
import { addTask, reorderProjects } from './logWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'w-full px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const question = 'text-text-secondary font-semibold';

export default function MorningLog({ log, disabled, onChanged, onUseAsGoals }: {
  log: Read<readonly LogProject[]> | null;
  /** The morning form is saving — nothing here writes meanwhile. */
  disabled: boolean;
  /** A rank or a task was written — the card reads the log again. */
  onChanged: () => void;
  /** The picked titles, in the log's order, to the goals box; answers how many were added and skipped. */
  onUseAsGoals: (titles: readonly string[]) => { readonly added: number; readonly skipped: number };
}) {
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState<{ readonly ok: boolean; readonly words: string } | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');

  const projects = log !== null && log.ok ? logOrder(log.value) : [];
  const ids = projects.map((p) => p.id);
  const locked = busy || disabled;

  const move = async (id: string, dir: LogMove) => {
    if (locked || !canMove(ids, id, dir)) return;
    setBusy(true);
    setWords(null);
    try {
      const answer = await reorderProjects(moveInLog(ids, id, dir));
      // A refusal is said — and the log is read again, so a project opened elsewhere since this read joins the list and the next move carries it.
      if (!answer.ok) { setWords({ ok: false, words: answer.message }); onChanged(); return; }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const saveTask = async (projectId: string) => {
    const title = taskTitle.trim();
    if (locked || title === '') return;
    setBusy(true);
    setWords(null);
    try {
      const answer = await addTask(projectId, title);
      if (!answer.ok) { setWords({ ok: false, words: answer.message }); return; }
      setAddingFor(null);
      setTaskTitle('');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (taskId: string) => {
    const next = new Set(picked);
    if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
    setPicked(next);
  };

  /** The picked tasks still in the log, in the log's order, to the goals box — then the picks clear and the form's answer is said. */
  const useAsGoals = () => {
    const titles = projects.flatMap((p) => p.tasks.filter((t) => picked.has(t.id)).map((t) => t.title));
    if (titles.length === 0) return;
    const { added, skipped } = onUseAsGoals(titles);
    setPicked(new Set());
    setWords({ ok: true, words: picksWords(added, skipped) });
  };
  const pickedCount = projects.reduce((n, p) => n + p.tasks.filter((t) => picked.has(t.id)).length, 0);

  return (
    <section className="flex flex-col gap-1 text-xs" data-morning-log>
      <div className="flex items-center justify-between gap-2">
        <span className={question} data-log-label>{LOG_WORD}</span>
        <Link href={newProjectHref} className={chip} data-log-new-project>{ADD_PROJECT_WORDS}</Link>
      </div>
      {log === null && <p className="text-text-muted" data-log-loading>{LOG_LOADING_WORDS}</p>}
      {log !== null && !log.ok && <p className="text-brand-red break-words" data-log-failed>{log.words}</p>}
      {log !== null && log.ok && projects.length === 0 && <p className="text-text-muted" data-log-empty>{NO_OPEN_PROJECTS_WORDS}</p>}
      {projects.length > 0 && (
        <ol className="flex flex-col gap-1.5" data-log-projects>
          {projects.map((p) => (
            <li key={p.id} className="flex flex-col gap-0.5" data-log-project={p.id}>
              <div className="flex items-center gap-1.5">
                <span className="text-text-faint tabular-nums" data-log-rank>{rankWords(p.rank)}</span>
                <Link href={projectHref(p.id)} className="font-semibold text-text-primary hover:underline break-words" data-log-project-link>{p.title}</Link>
                <span className="text-text-muted" data-log-status>{p.status}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" className={chip} disabled={locked || !canMove(ids, p.id, 'up')} onClick={() => move(p.id, 'up')} aria-label={moveWords(p.title, 'up')} data-log-up>▲</button>
                  <button type="button" className={chip} disabled={locked || !canMove(ids, p.id, 'down')} onClick={() => move(p.id, 'down')} aria-label={moveWords(p.title, 'down')} data-log-down>▼</button>
                  <button type="button" className={chip} disabled={locked} onClick={() => { setAddingFor(p.id); setTaskTitle(''); }} data-log-add-task>{ADD_TASK_WORDS}</button>
                </span>
              </div>
              {addingFor === p.id && (
                <form className="flex items-center gap-1 pl-6" onSubmit={(e) => { e.preventDefault(); saveTask(p.id); }} data-log-task-form>
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={TASK_TITLE_PLACEHOLDER} className={box} disabled={locked} autoFocus data-log-task-title />
                  <button type="submit" className={chip} disabled={locked || taskTitle.trim() === ''} data-log-task-save>{ADD_TASK_SAVE_WORDS}</button>
                  <button type="button" className={chip} disabled={locked} onClick={() => setAddingFor(null)} data-log-task-cancel>{ADD_TASK_CANCEL_WORDS}</button>
                </form>
              )}
              <ul className="flex flex-col gap-0.5 pl-6" data-log-tasks>
                {p.tasks.length === 0 && <li className="text-text-muted" data-log-no-tasks>{NO_OPEN_TASKS_WORDS}</li>}
                {p.tasks.map((t) => (
                  <li key={t.id} data-log-task={t.id}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} disabled={disabled} data-log-pick={t.id} />
                      <span className="text-text-primary break-words">{t.title}</span>
                      {t.status !== 'open' && <span className="text-text-muted" data-log-task-status>{t.status}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {projects.length > 0 && (
        <div className="flex items-center gap-1.5">
          <button type="button" className={chip} disabled={disabled || pickedCount === 0} onClick={useAsGoals} data-log-use-as-goals>{USE_AS_GOALS_WORDS}</button>
        </div>
      )}
      {words !== null && <p className={words.ok ? 'text-text-muted' : 'text-brand-red'} data-log-words>{words.words}</p>}
    </section>
  );
}
