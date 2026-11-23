'use client';

/**
 * HOME-SERVICES-02 (Alex, 2026-11-16 09:58 Manila: "selecting the category acts as a toggler then a tailored form popus up under the section
 * to be filled out, and submit proposal button at bottom"; his approval of the boards, 10:26: "looks dope lets rick") — THE PROPOSAL FORM IN THE
 * PANEL, which the home page's short view draws under the six services (src/components/landing/ServicesSection.tsx). Its markup is the
 * reference's form, element for element (design-refs/home-services-02/Section-Reference.html, as its script paints it), its classes the
 * reference's with the house prefix (.ps-field → .ts-ps-field), their rules the port's (src/app/globals.css). PURE: it draws what the hook
 * hands it (src/hooks/useProposalForm.ts) and holds nothing; every word is the list's (src/lib/proposalNeeds.ts).
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling b: "THE FORM IN THE PANEL IS THE PROPOSAL FORM ITSELF. Its honeypot, the body it posts to /api/proposals and its thank-you are those of /work-with-me. It draws no need question, because the tiles are its need. Its head is the eyebrow with Close at the right, then the picked door's name and line, drawn by DoorWords, which ServicesSection.tsx hands the form, with aria-live kept; Send proposal comes last. After a send, the thank-you takes the place of the door's words and the fields for the rest of the visit." — the trap below is /work-with-me's honeypot (it draws this one
 * too), the body and the thank-you are the hook's, and the door's words are the node ServicesSection.tsx hands this form.
 * Ruling i, in part: "It is never unmounted, so a close keeps what was typed." — the form is drawn from the start, hidden while nothing is
 * picked; the answers are the hook's, which the section holds.
 * This file joins the public pages' import closure (/professional-services draws the section, which imports it).
 */

import type { MouseEvent, ReactNode } from 'react';
import type { ProposalForm } from '@/hooks/useProposalForm';
import {
  BOOKKEEPING_WORDS, CORE_QUESTIONS, FORM_CLOSE, FORM_WORDS, FOUND_QUESTION, LINK_ROWS, PROPOSAL_STEPS,
  followOpen, followWords, type Question,
} from '@/lib/proposalNeeds';

/** The form's id: what each tile of the short view names, ruling a's aria-controls="ps-form" (ServicesSection.tsx). */
export const FORM_ID = 'ps-form';

/** The reference's follow-up, 14px under its group: the margin written on the markup, as the reference writes it (ruling p). */
const FOLLOW_GAP = { marginTop: 14 } as const;

/**
 * THE TRAP — /work-with-me's honeypot, as WorkWithMeForm.tsx drew it, drawn by both forms now: off-screen, out of the Tab order, hidden from
 * screen readers. A filled value marks the send as a bot's, and the route drops it silently (src/app/api/proposals/route.ts, step 1). Its
 * name stays website (ruling n): the visitor's own website is the list's site question, sent under answers.
 */
export function ProposalTrap({ id, form }: { id: string; form: ProposalForm }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label htmlFor={id}>{FORM_WORDS.trap}</label>
      <input id={id} type="text" name="website" tabIndex={-1} autoComplete="off" value={form.trap} onChange={(e) => form.setTrap(e.target.value)} />
    </div>
  );
}

/**
 * A question's control in the panel's dress, with its label: words are the label's (a follow-up's may be its opening answer's). A follow-up's
 * control carries no required attribute, as the reference's carries none: it stands in the page while hidden, and a hidden required field
 * would hold every send. The button waits for it while it is asked (the hook's rule, ruling f).
 */
function Control({ q, id, words, form, follow = false }: { q: Question; id: string; words: string; form: ProposalForm; follow?: boolean }) {
  const hint = q.hint === undefined ? null : <p className="ts-ps-hint">{q.hint}</p>;
  const required = q.required && !follow;
  switch (q.kind) {
    case 'one':
    case 'many': {
      const now = form.value(q.key);
      const on = (answer: string) => (typeof now === 'string' ? now === answer : (now as readonly string[]).includes(answer));
      return (
        <>
          <span className="ts-ps-label" id={`${id}-label`}>{words}</span>
          <div className="ts-ps-picks" role="group" aria-labelledby={`${id}-label`}>
            {q.answers.map((answer) => <button key={answer} className="ts-ps-pick" type="button" aria-pressed={on(answer)} onClick={() => form.press(q.key, answer)}>{answer}</button>)}
          </div>
          {hint}
        </>
      );
    }
    case 'counts': {
      const parts = form.parts(q.key);
      return (
        <>
          <span className="ts-ps-label" id={`${id}-label`}>{words}</span>
          <div className="ts-ps-counts" role="group" aria-labelledby={`${id}-label`}>
            {q.parts.map((part) => (
              <label key={part.key} className="ts-ps-count"><span className="ts-ps-count__name">{part.words}</span><input className="ts-ps-input" type="number" inputMode="numeric" min="0" required={q.required} value={parts[part.key]} onChange={(e) => form.writePart(q.key, part.key, e.target.value)} /></label>
            ))}
          </div>
        </>
      );
    }
    case 'dated': {
      const parts = form.parts(q.key);
      return (
        <>
          <span className="ts-ps-label" id={`${id}-label`}>{words}</span>
          <div className="ts-ps-dated" role="group" aria-labelledby={`${id}-label`}>
            <input className="ts-ps-input" type="date" aria-label={FORM_WORDS.date} value={parts.date} onChange={(e) => form.writePart(q.key, 'date', e.target.value)} />
            <input className="ts-ps-input" type="text" aria-label={FORM_WORDS.why} placeholder={q.placeholder} value={parts.why} onChange={(e) => form.writePart(q.key, 'why', e.target.value)} />
          </div>
        </>
      );
    }
    case 'links': {
      const rows = form.rows(q.key);
      return (
        <>
          <span className="ts-ps-label">{words}</span>
          <div className="ts-ps-links">
            {rows.map((row, i) => (
              <div key={i} className="ts-ps-link"><input className="ts-ps-input" type="url" maxLength={q.max} placeholder={FORM_WORDS.linkPlaceholder} value={row} onChange={(e) => form.writeRow(q.key, i, e.target.value)} /><button className="ts-ps-link__remove" type="button" aria-label={FORM_WORDS.removeLink} hidden={rows.length === 1} onClick={() => form.removeRow(q.key, i)}>{FORM_WORDS.removeMark}</button></div>
            ))}
          </div>
          <button className="ts-ps-add" type="button" hidden={rows.length >= LINK_ROWS} onClick={() => form.addRow(q.key)}>{FORM_WORDS.addLink}</button>
        </>
      );
    }
    case 'area': {
      const text = form.text(q.key);
      return (
        <>
          <label className="ts-ps-label" htmlFor={id}>{words}</label>
          <textarea className="ts-ps-area" id={id} required={required} placeholder={q.placeholder} value={text} onChange={(e) => form.write(q.key, e.target.value)} />
          {hint}
        </>
      );
    }
    default: {
      const text = form.text(q.key);
      const number = q.kind === 'number';
      return (
        <>
          <label className="ts-ps-label" htmlFor={id}>{words}</label>
          <input className={number ? 'ts-ps-input ts-ps-input--short' : 'ts-ps-input'} id={id} type={q.kind} inputMode={number ? 'numeric' : undefined} min={number ? '0' : undefined} required={required} maxLength={q.max} placeholder={q.placeholder} value={text} onChange={(e) => form.write(q.key, e.target.value)} />
          {hint}
        </>
      );
    }
  }
}

/** One question's field: its control, and under a pick its follow-up, hidden while none of the answers that open it is pressed. */
function Field({ q, id, form }: { q: Question; id: string; form: ProposalForm }) {
  const follow = q.follow;
  const answer = form.value(q.key);
  return (
    <div className={q.wide ? 'ts-ps-field ts-ps-field--wide' : 'ts-ps-field'}>
      <Control q={q} id={id} words={q.words} form={form} />
      {follow === undefined ? null : (
        <div className="ts-ps-field" hidden={!followOpen(q, answer)} style={FOLLOW_GAP}>
          <Control q={follow.question} id={`${id}-${follow.question.key}`} words={followWords(follow, answer)} form={form} follow />
        </div>
      )}
    </div>
  );
}

export interface ServicesFormProps {
  /** What the hook gives the form: the pick, the answers, the rule, the send. */
  form: ProposalForm;
  /** The picked door's name and line (DoorWords, handed by ServicesSection.tsx); nothing while nothing is picked. */
  door: ReactNode;
  /** Close: no service is picked, and focus goes back to the one that was (ServicesSection.tsx). */
  onClose: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * THE FORM IN THE PANEL: the eyebrow and Close, the door's words, the core and the picked set, More details, Send proposal; after a send, the
 * thank-you — its sentence one run of text, as the reference writes it (a run per word would set the line 0.03px apart from it).
 */
export default function ServicesForm({ form, door, onClose }: ServicesFormProps) {
  const sent = form.sentEmail !== null;
  const need = form.need;
  const here = (q: Question) => (need === null ? `ps-${q.key}` : `ps-${need}-${q.key}`);
  return (
    <div className="ts-ps-form" id={FORM_ID} hidden={need === null}>
      <div className="ts-ps-form__head">
        <p className="ts-ps-form__eyebrow">{FORM_WORDS.eyebrow}</p>
        <button className="ts-ps-close" type="button" onClick={onClose}>{FORM_CLOSE}<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg></button>
      </div>
      <div className="ts-ps-form__door" hidden={sent}>{door}</div>
      <form className="ts-ps-fields" hidden={sent} onSubmit={form.send}>
        {CORE_QUESTIONS.slice(0, 2).map((q) => <Field key={q.key} q={q} id={`ps-${q.key}`} form={form} />)}
        {need === 'bookkeeping' ? <div className="ts-ps-offer"><p>{BOOKKEEPING_WORDS.what}</p><p>{BOOKKEEPING_WORDS.notTax}</p><p>{BOOKKEEPING_WORDS.remedy}</p></div> : null}
        {CORE_QUESTIONS.slice(2).map((q) => <Field key={q.key} q={q} id={`ps-${q.key}`} form={form} />)}
        {form.questions.filter((q) => !q.more).map((q) => <Field key={q.key} q={q} id={here(q)} form={form} />)}
        <ProposalTrap id="ps-trap" form={form} />
        <div className="ts-ps-field ts-ps-field--wide">
          <button className="ts-ps-more" type="button" aria-expanded={form.moreOpen} aria-controls="ps-more" onClick={form.toggleMore}>{FORM_WORDS.more}</button>
          <div className="ts-ps-fields ts-ps-fields--more" id="ps-more" hidden={!form.moreOpen}>
            {form.questions.filter((q) => q.more).map((q) => <Field key={q.key} q={q} id={here(q)} form={form} />)}
            <Field q={FOUND_QUESTION} id={`ps-${FOUND_QUESTION.key}`} form={form} />
          </div>
        </div>
        <div className="ts-ps-error" role="alert" hidden={form.error === null}>{form.error}</div>
        <div className="ts-ps-send"><button className="ts-ps-cta" type="submit" disabled={form.held || form.submitting}>{form.submitting ? FORM_WORDS.sending : FORM_WORDS.send}</button></div>
      </form>
      <div className="ts-ps-sent" role="status" hidden={!sent}><span className="ts-ps-step__mark" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg></span><p>{`${FORM_WORDS.sentLead} ${PROPOSAL_STEPS.read}. ${FORM_WORDS.sentHear} `}<span>{form.sentEmail}</span>.</p></div>
    </div>
  );
}
