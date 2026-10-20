/**
 * EveningForm — the evening's questions, under the evening plate (JOURNAL-05, Alex, 2026-10-19; JOURNAL-06, 2026-10-20).
 *
 * The JournalForm's shape, for the EVENING — reflection. SEVEN boxes, each
 * LABELLED WITH ITS QUESTION (src/lib/operations/journal.ts EVENING_QUESTIONS,
 * THE EVENING'S QUESTIONS verbatim), in the card's order: ACCOMPLISHED — the
 * narrative the chat writes from the reflection prompt, pasted back (the
 * `audit` column, one home); GAPS · EVOLUTION · DIRECTION · ALIGNMENT · ON
 * TRACK — each a BLOCK (its line breaks kept; the rule caps it at 4000 code
 * points and 200 lines, refused by name); NEXT (one sentence — the morning's
 * "Last night:" line and the reel's "Tomorrow:" read it, unchanged). LEARNED
 * retired (JOURNAL-06, JOURNAL-03's way): its box and question are gone.
 *
 * "copy reflection prompt" beside ACCOMPLISHED writes the reflection prompt the
 * card built (journal.ts reflectionPromptText — the day's lines, THE BACKLOG,
 * WHAT MOVED TODAY, THE ANSWERS as saved, then THE ASK — the same words every
 * day) to the clipboard — the PLAN-01 shape: it says "copied" or the
 * clipboard's refusal in words, and tries nothing else. It is offered only once
 * every read of the card is in (the same gating "copy script" uses, plus the
 * two reads the prompt adds): an unread or failed day is said, never written as
 * a partial prompt. Nothing is paid; nothing leaves the browser but the
 * clipboard. The prompt's THE ANSWERS are the STORED row's — save first.
 *
 * ONE ROW, TWO CARDS, NO LOSS (JOURNAL-04b): save builds the WHOLE row —
 * goals, blocker, plan_steps and plan_done AS HELD from the journal prop at
 * save time, and the evening's seven from the boxes — through THE ROUTE'S OWN
 * RULE (journalInput, the same words the route would answer) and the one
 * writer (journalWrites.ts setJournal); a refusal is shown in the route's
 * words; busy while writing; after a write the caller reads the journal again.
 * An answer is emptied by saving it blank: the rule turns nothing visible into
 * null (textOf, blockOf). There is NO "clear" here — a day with nothing left
 * anywhere is refused by name (NOTHING_TYPED_WORDS), and the morning form's
 * clear, which clears the whole day's journal, is the way out. No maxLength on
 * a box: the rule's refusal is the limit. The caller keys this form by the day
 * and the journal's id, so another day or a cleared journal starts a fresh
 * draft from what is held. Nothing is stored in the browser.
 */

'use client';

import { useState } from 'react';
import {
  COPY_REFLECTION_PROMPT_WORDS, EVENING_NEXT_PLACEHOLDER, EVENING_ORDER, EVENING_QUESTIONS, EVENING_SAVE_WORDS, REFLECTION_PROMPT_COPIED_WORDS,
  journalInput, reflectionPromptFailedWords,
  type EveningField, type JournalRow, type ReflectionPromptState,
} from '@/lib/operations/journal';
import { underStyle, useDeckBleed } from './DayDeck';
import { setJournal } from './journalWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'w-full px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const question = 'text-text-secondary font-semibold';

/** The seven boxes' text — '' for an unanswered question. */
type Draft = Readonly<Record<EveningField, string>>;

/** The held answers as the boxes show them — '' for an unanswered question. */
const draftOf = (journal: JournalRow | null): Draft =>
  Object.fromEntries(EVENING_ORDER.map((f) => [f, journal === null || journal[f] === null ? '' : journal[f]])) as Draft;

/** The rows each box shows: the narrative and the five blocks tall, NEXT one sentence. */
const ROWS: Readonly<Record<EveningField, number>> = { audit: 8, gaps: 4, evolution: 3, direction: 3, alignment: 3, on_track: 3, next: 2 };

export default function EveningForm({ day, journal, reflectionPrompt, onChanged }: {
  day: string; journal: JournalRow | null; reflectionPrompt: ReflectionPromptState; onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(journal));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyWords, setCopyWords] = useState<{ readonly ok: boolean; readonly words: string } | null>(null);
  // WIDTH-01 (2026-10-16): the form takes the card's width on screen (stops/DayDeck.tsx underStyle), as everything under a card does.
  const bleed = useDeckBleed();

  const save = async () => {
    if (busy) return;
    // The morning's four AS HELD from the journal prop at save time (empty when there is no row), the evening's seven from the boxes BY NAME, then the route's rule — a refusal is the words the route would answer.
    const read = journalInput({ day, goals: journal === null ? [] : journal.goals, blocker: journal === null ? null : journal.blocker, plan_steps: journal === null ? [] : journal.plan_steps, plan_done: journal === null ? [] : journal.plan_done, audit: draft.audit, gaps: draft.gaps, evolution: draft.evolution, direction: draft.direction, alignment: draft.alignment, on_track: draft.on_track, next: draft.next });
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

  /** The card's reflection prompt, to the clipboard — "copied", or the clipboard's refusal in words; nothing else is tried. */
  const copyPrompt = async () => {
    if (!reflectionPrompt.ok) return;
    setCopyWords(null);
    try {
      await navigator.clipboard.writeText(reflectionPrompt.text);
      setCopyWords({ ok: true, words: REFLECTION_PROMPT_COPIED_WORDS });
    } catch (error) {
      setCopyWords({ ok: false, words: reflectionPromptFailedWords(error instanceof Error ? error.message : String(error)) });
    }
  };

  return (
    <div className="mx-auto space-y-1" style={underStyle(bleed)} data-evening-form>
      <form className="flex flex-col gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {EVENING_ORDER.map((field) => (
          <div key={field} className="flex flex-col gap-0.5" data-evening-block={field}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`evening-${field}`} className={question}>{EVENING_QUESTIONS[field]}</label>
              {field === 'audit' && <button type="button" className={chip} disabled={!reflectionPrompt.ok} onClick={copyPrompt} data-evening-copy-prompt>{COPY_REFLECTION_PROMPT_WORDS}</button>}
            </div>
            {field === 'audit' && !reflectionPrompt.ok && <p className="text-text-muted" data-evening-copy-waits>{reflectionPrompt.words}</p>}
            {field === 'audit' && copyWords !== null && <p className={copyWords.ok ? 'text-text-muted' : 'text-brand-red'} data-evening-copy-words>{copyWords.words}</p>}
            <textarea id={`evening-${field}`} rows={ROWS[field]} value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} placeholder={field === 'next' ? EVENING_NEXT_PLACEHOLDER : undefined} className={box} disabled={busy} data-evening-field={field} />
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <button type="submit" className={chip} disabled={busy} data-evening-save>{EVENING_SAVE_WORDS}</button>
        </div>
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-evening-words>{words}</p>}
    </div>
  );
}
