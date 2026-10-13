/**
 * JournalForm — the journal's questions, answered where the journal stop is shown (JOURNAL-01, 2026-10-13; JOURNAL-02, 2026-10-13).
 *
 * Under the day card's plate on the journal stop's step view, outside the
 * recorded box. JOURNAL-02 — four boxes in the plate's order, each LABELLED
 * WITH ITS QUESTION (src/lib/operations/journal.ts): TODAY's goals, one per
 * line; BLOCKERS; the PLAN's steps, one per line (pasted from chat); END OF
 * DAY, typed tonight. Save splits the goals and the plan into lines — trimmed,
 * blank lines dropped (linesOf) — carries each saved step's tick to the same
 * step in the new plan (carryTicks), then runs THE ROUTE'S OWN RULE
 * (journalInput — the same words the route would answer, no second rule), then
 * the one writer (journalWrites.ts); a refusal is shown in the route's words
 * under the form; after a write the caller reads the journal again — never an
 * optimistic copy. Next to the PLAN, when yesterday left steps open, a button
 * appends them to the plan box (the draft only — saved on save). No maxLength
 * on a box: it counts UTF-16 units and would stop a person short of the
 * column, which counts characters — the rule's refusal is the limit. Clear
 * asks first and is offered only while a journal exists. The caller keys this
 * form by the day and the journal's id, so another day or a cleared journal
 * starts a fresh draft from what is held. Nothing is stored in the browser.
 */

'use client';

import { useState } from 'react';
import {
  ADD_OPEN_STEPS_WORDS, BLOCKERS_QUESTION, END_OF_DAY_QUESTION, GOALS_EXAMPLE, PLAN_EXAMPLE, PLAN_QUESTION, TODAY_GOALS_QUESTION,
  carryTicks, clearJournalQuestion, journalInput, linesOf,
  type JournalRow,
} from '@/lib/operations/journal';
import { dayShortWords } from '../day/dayCard';
import { clearJournal, setJournal } from './journalWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'w-full px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const question = 'text-text-secondary font-semibold';

interface Draft {
  readonly goals: string;
  readonly blocker: string;
  readonly plan: string;
  readonly shipped: string;
}

/** The held answers as the boxes show them — a list one line per item, '' for an unanswered question. */
const draftOf = (journal: JournalRow | null): Draft => ({
  goals: journal === null ? '' : journal.goals.join('\n'),
  blocker: journal === null || journal.blocker === null ? '' : journal.blocker,
  plan: journal === null ? '' : journal.plan_steps.join('\n'),
  shipped: journal === null || journal.shipped === null ? '' : journal.shipped,
});

export default function JournalForm({ day, journal, yesterdayOpen, onChanged }: {
  day: string; journal: JournalRow | null; yesterdayOpen: readonly string[]; onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(journal));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    // The lines as typed (blank lines dropped), the saved ticks carried to the same steps, then the route's rule — a refusal is the words the route would answer.
    const steps = linesOf(draft.plan);
    const ticks = carryTicks(journal === null ? [] : journal.plan_steps, journal === null ? [] : journal.plan_done, steps);
    const read = journalInput({ day, goals: linesOf(draft.goals), blocker: draft.blocker === '' ? null : draft.blocker, plan_steps: steps, plan_done: ticks, shipped: draft.shipped === '' ? null : draft.shipped });
    if (!read.ok) { setWords(read.message); return; }
    setBusy(true);
    setWords(null);
    try {
      const answer = await setJournal(day, read.value.answers);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (journal === null || busy || !window.confirm(clearJournalQuestion(dayShortWords(day)))) return;
    setBusy(true);
    setWords(null);
    try {
      const answer = await clearJournal(journal.id);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  /** Yesterday's open steps, appended to the plan box — the draft only; saved on save. */
  const addOpen = () => setDraft({ ...draft, plan: [...linesOf(draft.plan), ...yesterdayOpen].join('\n') });

  return (
    <div className="mx-auto space-y-1" style={{ width: 540 }} data-journal-form>
      <form className="flex flex-col gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="flex flex-col gap-0.5" data-journal-block="goals">
          <span className={question}>{TODAY_GOALS_QUESTION}</span>
          <textarea rows={3} value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })} placeholder={GOALS_EXAMPLE} className={box} disabled={busy} data-journal-field="goals" />
        </label>
        <label className="flex flex-col gap-0.5" data-journal-block="blocker">
          <span className={question}>{BLOCKERS_QUESTION}</span>
          <textarea rows={2} value={draft.blocker} onChange={(e) => setDraft({ ...draft, blocker: e.target.value })} className={box} disabled={busy} data-journal-field="blocker" />
        </label>
        <div className="flex flex-col gap-0.5" data-journal-block="plan">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="journal-plan" className={question}>{PLAN_QUESTION}</label>
            {yesterdayOpen.length > 0 && <button type="button" className={chip} disabled={busy} onClick={addOpen} data-journal-add-open>{ADD_OPEN_STEPS_WORDS(yesterdayOpen.length)}</button>}
          </div>
          <textarea id="journal-plan" rows={5} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} placeholder={PLAN_EXAMPLE} className={box} disabled={busy} data-journal-field="plan_steps" />
        </div>
        <label className="flex flex-col gap-0.5" data-journal-block="shipped">
          <span className={question}>{END_OF_DAY_QUESTION}</span>
          <textarea rows={3} value={draft.shipped} onChange={(e) => setDraft({ ...draft, shipped: e.target.value })} className={box} disabled={busy} data-journal-field="shipped" />
        </label>
        <div className="flex items-center gap-1.5">
          <button type="submit" className={chip} disabled={busy}>save</button>
          {journal !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-journal-clear>clear</button>}
        </div>
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-journal-words>{words}</p>}
    </div>
  );
}
