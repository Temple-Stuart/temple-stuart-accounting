'use client';

/**
 * CRM-02 (Alex, 2026-11-07) — YOUR INTAKE FORM, the block on /crm: mounted by CrmTables (CrmSection.tsx) above the
 * Contacts table, fed by GET /api/crm's `form`.
 *   · NO FORM YET: the title, the slug (SLUG_RULE_WORDS under it), the line, the three fixed fields listed and not
 *     editable, the questions table (empty), "+ add a question", "Save the form".
 *   · A FORM: the link — `${window.location.origin}/f/<slug>`, the origin read in an effect; until it is read, the path
 *     alone, never a typed host — with Copy (navigator.clipboard; a refusal is said) and Open; the embed snippet with Copy;
 *     the editable title · slug (SLUG_CHANGE_WORDS beside the rule) · line; the questions table — Order (↑ ↓) · Question ·
 *     Kind (a <select> wearing CONTROL.input, the Stage select's way) · Required · Shown · Remove; "+ add a question"
 *     (disabled at twelve); Save → PUT /api/crm/form (a 400 or a 409 prints by its field — the route's words; Saved.);
 *     Preview (the link in a new tab).
 * Every word is src/lib/crm/formWords.ts's — none typed here. The questions keep the server's ids: the PUT's answer is the
 * block's state after a save, so a second save changes a question, never re-mints it. `onSaved` is the parent's re-read,
 * called after every save, failed or not. Reads no clock and no host; nothing stored in the browser; React state only.
 */
import { useEffect, useState } from 'react';
import { cellClass, chipClass, headClass } from '@/components/table/DataTable';
import { CHECKBOX, CONTROL } from '@/lib/ds';
import { FORM_LABEL_MAX, FORM_LINE_MAX, FORM_MAX_QUESTIONS, FORM_QUESTION_KINDS, FORM_SLUG_MAX, type FormQuestionKind, type IntakeForm } from '@/lib/crm/forms';
import { LIST_JOIN } from '@/lib/crm/crmWords';
import {
  ADD_QUESTION_WORDS, COPIED_WORDS, COPY_FAILED_WORDS, COPY_WORDS, EMBED_WORDS, FIXED_FIELDS_NOTE_WORDS, FIXED_FIELD_WORDS, FORM_FIELD_LABELS, INTAKE_FORM_WORDS,
  KIND_WORDS, LINK_LABEL_WORDS, MOVE_DOWN_WORDS, MOVE_UP_WORDS, OPEN_WORDS, PREVIEW_WORDS, QUESTION_HEAD_WORDS, REMOVE_WORDS, SAVED_WORDS, SAVE_FORM_WORDS,
  SLUG_CHANGE_WORDS, SLUG_RULE_WORDS, formSaveFailedWords, moveDownAriaWords, moveUpAriaWords, removeAriaWords,
} from '@/lib/crm/formWords';

const CRM_FORM_ROUTE = '/api/crm/form';
/** The fields a 400 or 409 names, each printed under its own box; any other field prints under the buttons. */
const NAMED_FIELDS = ['title', 'slug', 'line', 'questions'] as const;

/** A question as the block edits it: the server's id when it has one, the four fields. */
interface DraftQuestion {
  readonly id?: string;
  readonly label: string;
  readonly kind: FormQuestionKind;
  readonly required: boolean;
  readonly shown: boolean;
}
interface Failed {
  readonly field: string;
  readonly message: string;
}

/** The route refused the write: its field and its words (the 400 / 409 shape { error, field, message }). */
class WriteRefused extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'WriteRefused';
  }
}

/** The one write — PUT /api/crm/form; its answer is the form as saved. */
async function putForm(body: unknown): Promise<IntakeForm> {
  const res = await fetch(CRM_FORM_ROUTE, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const answer = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new WriteRefused(typeof answer.field === 'string' ? answer.field : 'form', String(answer.message ?? answer.error ?? `HTTP ${res.status}`));
  return answer as unknown as IntakeForm;
}

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export default function IntakeFormSetup({ form, onSaved }: { form: IntakeForm | null; onSaved: () => void }) {
  /** The server's form as this block last saw it — the prop at mount, then each PUT's answer. */
  const [saved, setSaved] = useState<IntakeForm | null>(form);
  const [title, setTitle] = useState(form === null ? '' : form.title);
  const [slug, setSlug] = useState(form === null ? '' : form.slug);
  const [line, setLine] = useState(form === null || form.line === null ? '' : form.line);
  const [questions, setQuestions] = useState<readonly DraftQuestion[]>(form === null ? [] : form.questions);
  const [origin, setOrigin] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  // The host, read once the page is in the browser — never typed.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = saved === null ? null : `/f/${saved.slug}`;
  const link = path === null ? null : origin === null ? path : `${origin}${path}`;
  const embed = saved === null || link === null ? null : `<iframe src="${link}?embed=1" width="100%" height="900" style="border:0" title="${escapeAttr(saved.title)}"></iframe>`;

  const copy = async (what: 'link' | 'embed', text: string) => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // The clipboard refused (an insecure page, a browser without it): said in words, never swallowed.
      setCopied(null);
      setCopyFailed(true);
    }
  };

  const save = async () => {
    setSaving(true);
    setFailed(null);
    setJustSaved(false);
    try {
      const answer = await putForm({
        slug,
        title,
        line: line.trim() === '' ? null : line,
        questions: questions.map((q) => (q.id === undefined ? { label: q.label, kind: q.kind, required: q.required, shown: q.shown } : { id: q.id, label: q.label, kind: q.kind, required: q.required, shown: q.shown })),
      });
      setSaved(answer);
      setTitle(answer.title);
      setSlug(answer.slug);
      setLine(answer.line === null ? '' : answer.line);
      setQuestions(answer.questions);
      setJustSaved(true);
    } catch (e: unknown) {
      setFailed(e instanceof WriteRefused ? { field: e.field, message: e.message } : { field: 'form', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
      onSaved();
    }
  };

  const setQ = (i: number, patch: Partial<Omit<DraftQuestion, 'id'>>) => setQuestions((prev) => prev.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: -1 | 1) =>
    setQuestions((prev) => {
      const j = i + by;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setQuestions((prev) => prev.filter((_, k) => k !== i));
  const add = () => setQuestions((prev) => (prev.length >= FORM_MAX_QUESTIONS ? prev : [...prev, { label: '', kind: 'short', required: false, shown: true }]));

  const fieldFailed = (field: (typeof NAMED_FIELDS)[number]) =>
    failed !== null && failed.field === field ? <p className="text-xs text-red-800" data-crm-form-failed={field}>{formSaveFailedWords(failed.message)}</p> : null;
  const elsewhereFailed = failed !== null && !(NAMED_FIELDS as readonly string[]).includes(failed.field);

  return (
    <section className="min-w-0 space-y-3 rounded border border-border bg-white p-3" data-crm-form={saved === null ? 'none' : saved.slug}>
      <h2 className="text-sm font-semibold text-text-primary">{INTAKE_FORM_WORDS}</h2>

      {saved !== null && path !== null && link !== null && embed !== null && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={CONTROL.label}>{LINK_LABEL_WORDS}</span>
            <code className="break-all text-xs text-text-primary" data-crm-form-link>{link}</code>
            <button type="button" className={chipClass} onClick={() => void copy('link', link)} data-crm-form-copy-link>{COPY_WORDS}</button>
            <a className={chipClass} href={path} target="_blank" rel="noopener" data-crm-form-open>{OPEN_WORDS}</a>
            {copied === 'link' && <span className="text-xs text-text-muted" data-crm-form-copied>{COPIED_WORDS}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={CONTROL.label}>{EMBED_WORDS}</span>
            <code className="break-all text-xs text-text-primary" data-crm-form-embed>{embed}</code>
            <button type="button" className={chipClass} onClick={() => void copy('embed', embed)} data-crm-form-copy-embed>{COPY_WORDS}</button>
            {copied === 'embed' && <span className="text-xs text-text-muted" data-crm-form-copied>{COPIED_WORDS}</span>}
          </div>
          {copyFailed && <p className="text-xs text-red-800" data-crm-form-copy-failed>{COPY_FAILED_WORDS}</p>}
        </div>
      )}

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={CONTROL.label}>{FORM_FIELD_LABELS.title}</span>
            <input type="text" className={CONTROL.input} value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} required maxLength={FORM_LABEL_MAX} data-crm-form-title />
            {fieldFailed('title')}
          </label>
          <label className="flex flex-col gap-1">
            <span className={CONTROL.label}>{FORM_FIELD_LABELS.slug}</span>
            <span className="flex items-center gap-1">
              <span className="text-xs text-text-muted">/f/</span>
              <input type="text" className={`${CONTROL.input} w-full`} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={saving} required maxLength={FORM_SLUG_MAX} data-crm-form-slug />
            </span>
            <span className="text-xs text-text-muted" data-crm-form-slug-rule>{SLUG_RULE_WORDS}{saved !== null ? ` ${SLUG_CHANGE_WORDS}` : ''}</span>
            {fieldFailed('slug')}
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className={CONTROL.label}>{FORM_FIELD_LABELS.line}</span>
          <input type="text" className={CONTROL.input} value={line} onChange={(e) => setLine(e.target.value)} disabled={saving} maxLength={FORM_LINE_MAX} data-crm-form-line />
          {fieldFailed('line')}
        </label>
        <p className="text-xs text-text-muted" data-crm-form-fixed>{FIXED_FIELDS_NOTE_WORDS} {Object.values(FIXED_FIELD_WORDS).join(LIST_JOIN)}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-crm-form-questions>
            <thead>
              <tr className="text-left text-text-muted">
                {Object.values(QUESTION_HEAD_WORDS).map((h) => <th key={h} className={headClass}>{h}</th>)}
                <th className={headClass} />
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={q.id === undefined ? `new-${i}` : q.id} className="border-t border-border" data-crm-form-question={q.id === undefined ? '' : q.id}>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    <button type="button" className={chipClass} onClick={() => move(i, -1)} disabled={saving || i === 0} aria-label={moveUpAriaWords(q.label)} data-crm-form-up>{MOVE_UP_WORDS}</button>
                    <button type="button" className={`${chipClass} ml-1`} onClick={() => move(i, 1)} disabled={saving || i === questions.length - 1} aria-label={moveDownAriaWords(q.label)} data-crm-form-down>{MOVE_DOWN_WORDS}</button>
                  </td>
                  <td className={cellClass}>
                    <input type="text" className={`${CONTROL.input} w-full min-w-[16rem]`} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} disabled={saving} required maxLength={FORM_LABEL_MAX} data-crm-form-label />
                  </td>
                  <td className={cellClass}>
                    <select className={CONTROL.input} value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value as FormQuestionKind })} disabled={saving} data-crm-form-kind>
                      {FORM_QUESTION_KINDS.map((k) => <option key={k} value={k}>{KIND_WORDS[k]}</option>)}
                    </select>
                  </td>
                  <td className={cellClass}><input type="checkbox" className={CHECKBOX} checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} disabled={saving} data-crm-form-required /></td>
                  <td className={cellClass}><input type="checkbox" className={CHECKBOX} checked={q.shown} onChange={(e) => setQ(i, { shown: e.target.checked })} disabled={saving} data-crm-form-shown /></td>
                  <td className={cellClass}><button type="button" className={chipClass} onClick={() => remove(i)} disabled={saving} aria-label={removeAriaWords(q.label)} data-crm-form-remove>{REMOVE_WORDS}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fieldFailed('questions')}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chipClass} onClick={add} disabled={saving || questions.length >= FORM_MAX_QUESTIONS} data-crm-form-add>{ADD_QUESTION_WORDS}</button>
          <button type="submit" className={CONTROL.primaryButton} disabled={saving} data-crm-form-save>{SAVE_FORM_WORDS}</button>
          {path !== null && <a className={CONTROL.ghostButton} href={path} target="_blank" rel="noopener" data-crm-form-preview>{PREVIEW_WORDS}</a>}
          {justSaved && <span className="text-xs text-text-muted" data-crm-form-saved>{SAVED_WORDS}</span>}
        </div>
        {elsewhereFailed && failed !== null && (
          <p className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-crm-form-failed={failed.field}>{formSaveFailedWords(failed.message)}</p>
        )}
      </form>
    </section>
  );
}
