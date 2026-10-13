/**
 * JournalForm — the morning's questions, answered where the journal stop is shown (JOURNAL-01, 2026-10-13).
 *
 * Under the day card's plate on the journal stop's step view, outside the
 * recorded box: one text box per answer in the plate's order — YESTERDAY's
 * adjustment ("→ so today"); TODAY's one thing, witness, blocker and shipped
 * (typed at the end of the day); PLAN's three "if … then …" pairs and the
 * obstacle's "if … → then …", each pair on one line. A blank box is null. No
 * maxLength on a box: it counts UTF-16 units and would stop a person short of
 * the column, which counts characters — the rule's refusal is the limit. Save
 * runs THE ROUTE'S OWN RULE first (src/lib/operations/journal.ts journalInput —
 * the same words the route would answer, no second rule), then the one writer
 * (journalWrites.ts); a refusal is shown in the route's words under the form;
 * after a write the caller reads the journal again — never an optimistic copy.
 * Clear asks first and is offered only while a journal exists. The caller keys
 * this form by the day and the journal's id, so another day or a cleared
 * journal starts a fresh draft from what is held. Nothing is stored in the
 * browser.
 */

'use client';

import { useState } from 'react';
import {
  ANSWER_FIELDS, PAIRS, PLAN_BLOCK_WORD, QUESTION_WORDS, SHIPPED_HINT_WORDS, TODAY_BLOCK_WORD, YESTERDAY_WORD, clearJournalQuestion, journalInput,
  type AnswerField, type JournalRow,
} from '@/lib/operations/journal';
import { dayShortWords } from '../day/dayCard';
import { clearJournal, setJournal } from './journalWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';
const head = 'text-text-faint uppercase tracking-wide w-20 shrink-0';

type Draft = Readonly<Record<AnswerField, string>>;

/** The held answers as the boxes show them — '' for an unanswered question. */
const draftOf = (journal: JournalRow | null): Draft =>
  Object.fromEntries(ANSWER_FIELDS.map((f) => [f, journal === null || journal[f] === null ? '' : journal[f]])) as Record<AnswerField, string>;

/** The question a box asks, by its field — the plate's label. */
function labelOf(field: AnswerField): string {
  if (field === 'obstacle_if') return QUESTION_WORDS.obstacle_if;
  if (field === 'obstacle_then') return QUESTION_WORDS.obstacle_then;
  if (field.endsWith('_if')) return QUESTION_WORDS.plan_if;
  if (field.endsWith('_then')) return QUESTION_WORDS.plan_then;
  return QUESTION_WORDS[field as 'adjustment' | 'one_thing' | 'witness' | 'blocker' | 'shipped'];
}

export default function JournalForm({ day, journal, onChanged }: { day: string; journal: JournalRow | null; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(journal));
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (field: AnswerField, value: string) => setDraft({ ...draft, [field]: value });

  const save = async () => {
    if (busy) return;
    // The route's rule, run first here: a blank box is null; a refusal is the words the route would answer.
    const read = journalInput({ day, ...Object.fromEntries(ANSWER_FIELDS.map((f) => [f, draft[f] === '' ? null : draft[f]])) });
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

  const input = (field: AnswerField, placeholder: string, width: string) => (
    <input type="text" value={draft[field]} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${box} ${width}`} disabled={busy} data-journal-field={field} />
  );

  return (
    <div className="mx-auto space-y-1" style={{ width: 540 }} data-journal-form>
      <form className="flex flex-col gap-1.5 text-xs" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="flex items-center gap-1.5" data-journal-block="yesterday">
          <span className={head}>{YESTERDAY_WORD}</span>
          {input('adjustment', labelOf('adjustment'), 'flex-1')}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" data-journal-block="today">
          <span className={head}>{TODAY_BLOCK_WORD}</span>
          {input('one_thing', labelOf('one_thing'), 'w-40')}
          {input('witness', labelOf('witness'), 'w-28')}
          {input('blocker', labelOf('blocker'), 'w-40')}
          {input('shipped', SHIPPED_HINT_WORDS, 'w-56')}
        </div>
        <div className="flex flex-col gap-1.5" data-journal-block="plan">
          {PAIRS.map(([ifField, thenField], i) => (
            <div key={ifField} className="flex items-center gap-1.5" data-journal-pair={ifField}>
              <span className={head}>{i === 0 ? PLAN_BLOCK_WORD : ''}</span>
              {input(ifField, labelOf(ifField), 'flex-1')}
              {input(thenField, labelOf(thenField), 'flex-1')}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={head} aria-hidden="true" />
          <button type="submit" className={chip} disabled={busy}>save</button>
          {journal !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-journal-clear>clear</button>}
        </div>
      </form>
      {words !== null && <p className="text-xs text-brand-red" data-journal-words>{words}</p>}
    </div>
  );
}
