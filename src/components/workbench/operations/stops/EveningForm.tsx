/**
 * EveningForm — the evening's questions, under the evening plate (JOURNAL-05, Alex, 2026-10-19).
 *
 * The JournalForm's shape, for the EVENING — reflection. Three boxes, each
 * LABELLED WITH ITS QUESTION (src/lib/operations/journal.ts): where did we
 * actually get to — the audit Claude writes from the day's own facts, pasted
 * back (a BLOCK: its line breaks kept; the rule caps it at 4000 code points and
 * 200 lines, refused by name); what did I learn, or what surprised me; where do
 * I want to take it next (one sentence — a line on the reel later, REEL-02).
 *
 * "copy audit prompt" beside the AUDIT box writes the audit prompt the card
 * built (journal.ts auditPromptText — the day's goals, blocker, the plan's
 * steps and ticks, every stop's budget and actual, the totals and the verdict,
 * then the ask) to the clipboard — the PLAN-01 shape: it says "copied" or the
 * clipboard's refusal in words, and tries nothing else. It is offered only once
 * every read of the card is in (the same gating "copy script" uses): an unread
 * or failed day is said, never written as a partial prompt. Nothing is paid;
 * nothing leaves the browser but the clipboard.
 *
 * ONE ROW, TWO CARDS, NO LOSS (JOURNAL-04b): save builds the WHOLE row —
 * goals, blocker, plan_steps and plan_done AS HELD from the journal prop at
 * save time, and audit, learned and next from the boxes — through THE ROUTE'S
 * OWN RULE (journalInput, the same words the route would answer) and the one
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
  AUDIT_PROMPT_COPIED_WORDS, COPY_AUDIT_PROMPT_WORDS, EVENING_AUDIT_QUESTION, EVENING_LEARNED_QUESTION, EVENING_NEXT_PLACEHOLDER, EVENING_NEXT_QUESTION, EVENING_SAVE_WORDS,
  auditPromptFailedWords, journalInput,
  type AuditPromptState, type JournalRow,
} from '@/lib/operations/journal';
import { underStyle, useDeckBleed } from './DayDeck';
import { setJournal } from './journalWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'w-full px-1.5 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const question = 'text-text-secondary font-semibold';

interface Draft {
  readonly audit: string;
  readonly learned: string;
  readonly next: string;
}

/** The held answers as the boxes show them — '' for an unanswered question. */
const draftOf = (journal: JournalRow | null): Draft => ({
  audit: journal === null || journal.audit === null ? '' : journal.audit,
  learned: journal === null || journal.learned === null ? '' : journal.learned,
  next: journal === null || journal.next === null ? '' : journal.next,
});

export default function EveningForm({ day, journal, auditPrompt, onChanged }: {
  day: string; journal: JournalRow | null; auditPrompt: AuditPromptState; onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(journal));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyWords, setCopyWords] = useState<{ readonly ok: boolean; readonly words: string } | null>(null);
  // WIDTH-01 (2026-10-16): the form takes the card's width on screen (stops/DayDeck.tsx underStyle), as everything under a card does.
  const bleed = useDeckBleed();

  const save = async () => {
    if (busy) return;
    // The morning's four AS HELD from the journal prop at save time (empty when there is no row), the evening's three from the boxes, then the route's rule — a refusal is the words the route would answer.
    const read = journalInput({ day, goals: journal === null ? [] : journal.goals, blocker: journal === null ? null : journal.blocker, plan_steps: journal === null ? [] : journal.plan_steps, plan_done: journal === null ? [] : journal.plan_done, audit: draft.audit, learned: draft.learned, next: draft.next });
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

  /** The card's audit prompt, to the clipboard — "copied", or the clipboard's refusal in words; nothing else is tried. */
  const copyPrompt = async () => {
    if (!auditPrompt.ok) return;
    setCopyWords(null);
    try {
      await navigator.clipboard.writeText(auditPrompt.text);
      setCopyWords({ ok: true, words: AUDIT_PROMPT_COPIED_WORDS });
    } catch (error) {
      setCopyWords({ ok: false, words: auditPromptFailedWords(error instanceof Error ? error.message : String(error)) });
    }
  };

  return (
    <div className="mx-auto space-y-1" style={underStyle(bleed)} data-evening-form>
      <form className="flex flex-col gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex flex-col gap-0.5" data-evening-block="audit">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="evening-audit" className={question}>{EVENING_AUDIT_QUESTION}</label>
            <button type="button" className={chip} disabled={!auditPrompt.ok} onClick={copyPrompt} data-evening-copy-prompt>{COPY_AUDIT_PROMPT_WORDS}</button>
          </div>
          {!auditPrompt.ok && <p className="text-text-muted" data-evening-copy-waits>{auditPrompt.words}</p>}
          {copyWords !== null && <p className={copyWords.ok ? 'text-text-muted' : 'text-brand-red'} data-evening-copy-words>{copyWords.words}</p>}
          <textarea id="evening-audit" rows={8} value={draft.audit} onChange={(e) => setDraft({ ...draft, audit: e.target.value })} className={box} disabled={busy} data-evening-field="audit" />
        </div>
        <label className="flex flex-col gap-0.5" data-evening-block="learned">
          <span className={question}>{EVENING_LEARNED_QUESTION}</span>
          <textarea rows={2} value={draft.learned} onChange={(e) => setDraft({ ...draft, learned: e.target.value })} className={box} disabled={busy} data-evening-field="learned" />
        </label>
        <label className="flex flex-col gap-0.5" data-evening-block="next">
          <span className={question}>{EVENING_NEXT_QUESTION}</span>
          <textarea rows={2} value={draft.next} onChange={(e) => setDraft({ ...draft, next: e.target.value })} placeholder={EVENING_NEXT_PLACEHOLDER} className={box} disabled={busy} data-evening-field="next" />
        </label>
        <div className="flex items-center gap-1.5">
          <button type="submit" className={chip} disabled={busy} data-evening-save>{EVENING_SAVE_WORDS}</button>
        </div>
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-evening-words>{words}</p>}
    </div>
  );
}
