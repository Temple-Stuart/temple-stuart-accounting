/**
 * JournalForm — the journal's questions, answered where the journal stop is shown (JOURNAL-01, 2026-10-13; JOURNAL-02, 2026-10-13; JOURNAL-03, 2026-10-15; JOURNAL-04, 2026-10-19).
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
 * appends them to the plan box (the draft only — saved on save).
 *
 * CLEAN-02 (2026-10-14): the prompt's yesterday is its row — "steps: 4 of 6
 * done", what was left over, and its note; END OF DAY now asks what was left
 * unfinished and why (journal.ts END_OF_DAY_QUESTION).
 *
 * JOURNAL-03 (Alex, 2026-10-15): END OF DAY is retired — its box is gone, and
 * END_OF_DAY_QUESTION with it. Three boxes now: TODAY's goals, BLOCKERS, the
 * PLAN; the plan's ticks say what got done. The draft holds no `shipped` and
 * the body never carries it (the rule refuses one that does, by name), so a
 * save writes the four answers alone and words typed there before stay in the
 * row. The prompt's yesterday is its steps and what was left over — no note.
 *
 * JOURNAL-04 (Alex, 2026-10-19): the form asks the morning's four and carries the evening's three —
 * audit, learned and next ride the save body AS HELD from the journal prop at save time (null when
 * there is no row), so a morning save never clears an evening typed before; JOURNAL-05's evening
 * card does the same in reverse. No box for them here, no words. Every writer sends the row as held.
 *
 * JOURNAL-06 (Alex, 2026-10-20): the evening's SEVEN ride AS HELD — audit, gaps, evolution, direction,
 * alignment, on_track and next (learned retired, JOURNAL-03's way: the body never carries it; the rule
 * refuses one that does, by name). The morning's save still never clears an evening typed before.
 *
 * JOURNAL-05 (Alex, 2026-10-19): THE MORNING FORM. The three questions are the MORNING's (journal.ts
 * MORNING_GOALS_QUESTION · MORNING_BLOCKER_QUESTION · MORNING_PLAN_QUESTION — "what must be true by
 * tonight"); the boxes, the save, "+ yesterday's open steps" and "copy plan prompt" are as they were.
 * "clear" stays here, and its question says it clears the whole day's journal — morning and evening
 * (clearJournalQuestion): the evening form (EveningForm.tsx) has no clear, so this is the one way a day is
 * forgotten.
 *
 * PLAN-01 (2026-10-13): each plan and goal line loses a pasted list's leading
 * marker ("1." "1)" "-" "•" "*" and a space — stripListMarker) after linesOf
 * and before carryTicks; the plate numbers and bullets them itself. "copy plan
 * prompt" beside the PLAN writes planPromptText — yesterday's END OF DAY and
 * not-finished steps, today's goals and blocker FROM THE DRAFT — to the
 * clipboard; it says "copied" or the clipboard's refusal in words, and tries
 * nothing else. It is offered only once yesterday's journal is read: an unread
 * or failed yesterday is said, never written as "nothing typed". No maxLength
 * on a box: it counts UTF-16 units and would stop a person short of the
 * column, which counts characters — the rule's refusal is the limit. Clear
 * asks first and is offered only while a journal exists. The caller keys this
 * form by the day and the journal's id, so another day or a cleared journal
 * starts a fresh draft from what is held. Nothing is stored in the browser.
 */

'use client';

import { useState } from 'react';
import {
  ADD_OPEN_STEPS_WORDS, COPY_PLAN_PROMPT_WORDS, GOALS_EXAMPLE, MORNING_BLOCKER_QUESTION, MORNING_GOALS_QUESTION, MORNING_PLAN_QUESTION, PLAN_EXAMPLE, PLAN_PROMPT_COPIED_WORDS,
  carryTicks, clearJournalQuestion, journalInput, linesOf, openSteps, planPromptFailedWords, planPromptText, planPromptWaitsWords, stripListMarker,
  type JournalRow, type YesterdayForPrompt,
} from '@/lib/operations/journal';
import { dayShortWords } from '../day/dayCard';
import { underStyle, useDeckBleed } from './DayDeck';
import { clearJournal, setJournal } from './journalWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'w-full px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const question = 'text-text-secondary font-semibold';

interface Draft {
  readonly goals: string;
  readonly blocker: string;
  readonly plan: string;
}

/** The held answers as the boxes show them — a list one line per item, '' for an unanswered question. */
const draftOf = (journal: JournalRow | null): Draft => ({
  goals: journal === null ? '' : journal.goals.join('\n'),
  blocker: journal === null || journal.blocker === null ? '' : journal.blocker,
  plan: journal === null ? '' : journal.plan_steps.join('\n'),
});

export default function JournalForm({ day, journal, yesterday, onChanged }: {
  day: string; journal: JournalRow | null; yesterday: YesterdayForPrompt; onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(journal));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyWords, setCopyWords] = useState<{ readonly ok: boolean; readonly words: string } | null>(null);
  // WIDTH-01 (2026-10-16): the form takes the card's width on screen (stops/DayDeck.tsx underStyle), as everything under a card does.
  const bleed = useDeckBleed();
  // CLEAN-02 (2026-10-14): yesterday's open steps from its row — openSteps, the card's own rule; none when there is no journal.
  const yesterdayOpen = yesterday.ok && yesterday.row !== null ? openSteps(yesterday.row) : [];

  const save = async () => {
    if (busy) return;
    // The lines as typed (blank lines dropped, a pasted list's marker off — PLAN-01), the saved ticks carried to the same steps, then the route's rule — a refusal is the words the route would answer.
    const steps = linesOf(draft.plan).map(stripListMarker);
    const ticks = carryTicks(journal === null ? [] : journal.plan_steps, journal === null ? [] : journal.plan_done, steps);
    // JOURNAL-04 (2026-10-19) / JOURNAL-06 (2026-10-20): the evening's seven ride AS HELD from the journal prop at save time (null when there is no row) — a save never clears an evening; learned is retired and never sent.
    const read = journalInput({ day, goals: linesOf(draft.goals).map(stripListMarker), blocker: draft.blocker === '' ? null : draft.blocker, plan_steps: steps, plan_done: ticks, audit: journal === null ? null : journal.audit, gaps: journal === null ? null : journal.gaps, evolution: journal === null ? null : journal.evolution, direction: journal === null ? null : journal.direction, alignment: journal === null ? null : journal.alignment, on_track: journal === null ? null : journal.on_track, next: journal === null ? null : journal.next });
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

  /** PLAN-01: yesterday and today's DRAFT, as the plan prompt, to the clipboard — "copied", or the clipboard's refusal in words; nothing else is tried. */
  const copyPrompt = async () => {
    if (!yesterday.ok) return;
    const blocker = linesOf(draft.blocker).join(' ');
    const text = planPromptText({ dayWords: dayShortWords(day), yesterday: yesterday.row, goals: linesOf(draft.goals).map(stripListMarker), blocker: blocker === '' ? null : blocker });
    setCopyWords(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyWords({ ok: true, words: PLAN_PROMPT_COPIED_WORDS });
    } catch (error) {
      setCopyWords({ ok: false, words: planPromptFailedWords(error instanceof Error ? error.message : String(error)) });
    }
  };

  /** Yesterday's open steps, appended to the plan box — the draft only; saved on save. */
  const addOpen = () => setDraft({ ...draft, plan: [...linesOf(draft.plan), ...yesterdayOpen].join('\n') });

  return (
    <div className="mx-auto space-y-1" style={underStyle(bleed)} data-journal-form>
      <form className="flex flex-col gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="flex flex-col gap-0.5" data-journal-block="goals">
          <span className={question}>{MORNING_GOALS_QUESTION}</span>
          <textarea rows={3} value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })} placeholder={GOALS_EXAMPLE} className={box} disabled={busy} data-journal-field="goals" />
        </label>
        <label className="flex flex-col gap-0.5" data-journal-block="blocker">
          <span className={question}>{MORNING_BLOCKER_QUESTION}</span>
          <textarea rows={2} value={draft.blocker} onChange={(e) => setDraft({ ...draft, blocker: e.target.value })} className={box} disabled={busy} data-journal-field="blocker" />
        </label>
        <div className="flex flex-col gap-0.5" data-journal-block="plan">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="journal-plan" className={question}>{MORNING_PLAN_QUESTION}</label>
            <div className="flex items-center gap-1.5">
              {yesterdayOpen.length > 0 && <button type="button" className={chip} disabled={busy} onClick={addOpen} data-journal-add-open>{ADD_OPEN_STEPS_WORDS(yesterdayOpen.length)}</button>}
              <button type="button" className={chip} disabled={!yesterday.ok} onClick={copyPrompt} data-journal-copy-prompt>{COPY_PLAN_PROMPT_WORDS}</button>
            </div>
          </div>
          {!yesterday.ok && <p className="text-text-muted" data-journal-copy-waits>{planPromptWaitsWords(yesterday.words)}</p>}
          {copyWords !== null && <p className={copyWords.ok ? 'text-text-muted' : 'text-brand-red'} data-journal-copy-words>{copyWords.words}</p>}
          <textarea id="journal-plan" rows={5} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} placeholder={PLAN_EXAMPLE} className={box} disabled={busy} data-journal-field="plan_steps" />
        </div>
        <div className="flex items-center gap-1.5">
          <button type="submit" className={chip} disabled={busy}>save</button>
          {journal !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-journal-clear>clear</button>}
        </div>
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-journal-words>{words}</p>}
    </div>
  );
}
