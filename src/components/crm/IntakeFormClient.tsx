'use client';

/**
 * CRM-02 (Alex, 2026-11-07) — THE PUBLIC INTAKE FORM, the client half (WorkWithMeForm.tsx's idiom, the RSVPClient
 * precedent): the title, the line, the three fixed fields, each question ASKED by its kind (short → an input; long → a
 * textarea; email → an email input; yesno → two radios, Yes / No), the 'website' honeypot (WorkWithMeForm.tsx:371-380,
 * copied), Send → POST /api/f/<slug>. The sent words name the form's title; a failed send prints the route's own words
 * (its message, else its error), never swallowed; the goes-to line under the button; "Form by Temple Stuart" links home.
 * Every word is src/lib/crm/formWords.ts's — none typed here.
 *
 * Phone-first: one column at max-w-2xl, 44px fields, 16px gutters; `embed` drops the page's own padding beyond 16px and
 * draws the same content (the iframe on another site). The house tokens: CONTROL.label / CONTROL.input,
 * SURFACE.page / SURFACE.card, STATE.errorCard. Reads no clock and no host; nothing stored in the browser.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CONTROL, STATE, SURFACE } from '@/lib/ds';
import { EMAIL_MAX, LONG_MAX, SHORT_MAX, type FormQuestion, type PublicForm } from '@/lib/crm/forms';
import {
  FIXED_FIELD_WORDS, FORM_BY_WORDS, HONEYPOT_LABEL_WORDS, NO_WORDS, OPTIONAL_WORDS, SENDING_WORDS, SEND_WORDS, YES_WORDS, goesToWords, sendFailedWords, sentWords,
} from '@/lib/crm/formWords';

const FIELD_CLASS = `${CONTROL.input} mt-1 min-h-[44px] w-full`;
const TEXTAREA_CLASS = `${CONTROL.input} mt-1 min-h-[120px] w-full resize-y`;
const RADIO_CLASS = 'h-5 w-5 accent-brand-purple';

type Answer = string | boolean;

export default function IntakeFormClient({ form, embed }: { form: PublicForm; embed: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [answers, setAnswers] = useState<Readonly<Record<string, Answer>>>({});
  // Honeypot — humans never see or fill this.
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const answer = (id: string, value: Answer) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailed(null);
    setSending(true);
    try {
      const res = await fetch(`/api/f/${form.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, ...(business.trim() === '' ? {} : { business }), answers, website }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setFailed(String(data.message ?? data.error ?? `HTTP ${res.status}`));
        return;
      }
      setSent(true);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const optional = (q: FormQuestion) => (q.required ? '' : ` ${OPTIONAL_WORDS}`);

  const field = (q: FormQuestion) => {
    const id = `f-q-${q.id}`;
    const value = answers[q.id];
    if (q.kind === 'yesno') {
      return (
        <fieldset key={q.id} data-intake-question={q.id}>
          <legend className={CONTROL.label}>{q.label}{optional(q)}</legend>
          <div className="mt-1 flex gap-6">
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-primary">
              <input type="radio" name={id} value="yes" required={q.required} checked={value === true} onChange={() => answer(q.id, true)} className={RADIO_CLASS} />
              {YES_WORDS}
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-primary">
              <input type="radio" name={id} value="no" required={q.required} checked={value === false} onChange={() => answer(q.id, false)} className={RADIO_CLASS} />
              {NO_WORDS}
            </label>
          </div>
        </fieldset>
      );
    }
    const text = typeof value === 'string' ? value : '';
    return (
      <div key={q.id} data-intake-question={q.id}>
        <label htmlFor={id} className={CONTROL.label}>{q.label}{optional(q)}</label>
        {q.kind === 'long' ? (
          <textarea id={id} required={q.required} maxLength={LONG_MAX} value={text} onChange={(e) => answer(q.id, e.target.value)} className={TEXTAREA_CLASS} />
        ) : (
          <input id={id} type={q.kind === 'email' ? 'email' : 'text'} required={q.required} maxLength={q.kind === 'email' ? EMAIL_MAX : SHORT_MAX} value={text} onChange={(e) => answer(q.id, e.target.value)} className={FIELD_CLASS} />
        )}
      </div>
    );
  };

  return (
    <div className={`${SURFACE.page} ${embed ? 'p-4' : 'min-h-screen px-4 py-10'}`} data-intake-form={form.slug} data-intake-embed={embed ? '' : undefined}>
      <div className={`mx-auto max-w-2xl ${SURFACE.card} p-4 sm:p-6`}>
        <h1 className="text-lg font-semibold text-text-primary">{form.title}</h1>
        {form.line !== null && <p className="mt-1 text-sm text-text-secondary">{form.line}</p>}

        {sent ? (
          <div role="status" className="mt-4 rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-sm text-status-success" data-intake-sent>
            {sentWords(form.title)}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
            <div>
              <label htmlFor="f-name" className={CONTROL.label}>{FIXED_FIELD_WORDS.name}</label>
              <input id="f-name" type="text" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} data-intake-name />
            </div>
            <div>
              <label htmlFor="f-email" className={CONTROL.label}>{FIXED_FIELD_WORDS.email}</label>
              <input id="f-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD_CLASS} data-intake-email />
            </div>
            <div>
              <label htmlFor="f-business" className={CONTROL.label}>{FIXED_FIELD_WORDS.business} {OPTIONAL_WORDS}</label>
              <input id="f-business" type="text" maxLength={5000} value={business} onChange={(e) => setBusiness(e.target.value)} className={FIELD_CLASS} data-intake-business />
            </div>

            {form.questions.map((q) => field(q))}

            {/* Honeypot — off-screen, unreachable by keyboard, invisible to screen readers (WorkWithMeForm.tsx:371-380).
                A filled value marks the submit as a bot. */}
            <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="f-website">{HONEYPOT_LABEL_WORDS}</label>
              <input
                id="f-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {failed !== null && <div className={STATE.errorCard} data-intake-failed>{sendFailedWords(failed)}</div>}

            <div>
              <button type="submit" disabled={sending} className={`${CONTROL.primaryButton} min-h-[44px] w-full sm:w-auto`} data-intake-send>
                {sending ? SENDING_WORDS : SEND_WORDS}
              </button>
              <p className="mt-2 text-xs text-text-muted">{goesToWords(form.title)}</p>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs text-text-faint">
          <Link href="/" className="underline decoration-border hover:text-text-primary" target={embed ? '_blank' : undefined} rel={embed ? 'noopener' : undefined} data-intake-by>
            {FORM_BY_WORDS}
          </Link>
        </p>
      </div>
    </div>
  );
}
