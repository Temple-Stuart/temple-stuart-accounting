'use client';

/**
 * PROPOSAL-FORM: /work-with-me — the public project-proposal intake form.
 * The SOW mailto's structured sibling: same questions (the mailto template's
 * fields, README:63-72 vocabulary), but landing in the proposals table via
 * POST /api/proposals (public BY RULING: DB-write only, rate-limited +
 * honeypot) instead of an email draft. README keeps its mailto — email folks
 * still exist; this page serves everyone else.
 *
 * ONE-FORM-01 (Alex, 2026-11-06): THE ONE FORM — "incorporate bookkeeping services
 * and done for you services ... all as one proposal form ... since email is wack."
 * SERVICES-01 (Alex, 2026-11-08): THE SIX DOORS. The choices are the DONE-FOR-YOU
 *   panel's six doors in its order, each chip the door's title, and the lead is one
 *   sentence — SERVICES and FORM_INTRO in src/lib/proposalNeeds.ts, the module the
 *   panel, the route and the CRM read; nothing typed here. The 2026 close retired:
 *   no close chip, no close block. Bookkeeping picked shows its own lines (what it
 *   is, what it is not, the remedy — BOOKKEEPING_WORDS) and the modules question
 *   leaves (bookkeeping has no modules — the submit sends none). So it stood until HOME-SERVICES-02 (2026-11-16): each door
 *   asks its own set now, from the list, and Bookkeeping's lines stay.
 *   · `?need=<key>` picks a door on arrival — the home page's doors. The server page
 *     (page.tsx) hands the query down; a word the form does not offer picks nothing,
 *     'close' from an old link included (no redirect, no error, nothing mapped — the
 *     form simply opens unpicked).
 * This file is the client half (the RSVPClient precedent): state, the submit, the
 * markup — the answers, the rule, the submit and its errors left for the hook in HOME-SERVICES-02 (2026-11-16); the
 * page keeps its need and its markup. It reads no clock.
 *
 * House shell throughout: SURFACE.page canvas, SURFACE.card panel,
 * SECTION_HEADER bar, CONTROL input family, SEGMENT single-picks, toggleChip
 * multi-pick, STATE.errorCard for failures (success card = errorCard with the
 * success tokens — the CheckoutResultBanner idiom). The optional block rides
 * the DISCLOSURE precedent (CoverageDeclaration.tsx:42,92-93 — useState +
 * aria-expanded button, default collapsed).
 *
 * HOME-SERVICES-02 (Alex, 2026-11-16 12:08 Manila: "have questions how its the same for a bunch of the categories"; 12:59: "ok lets do it,
 * lets build it") — EACH DOOR ASKS ITS OWN QUESTIONS, and the page draws them with its own controls: CONTROL's label, input and textarea,
 * SEGMENT for a pick-one, toggleChip for a pick-any; a count, a date with its why and a month are the new kinds of field, in the same
 * controls. Alex's brief, 2026-11-16 13:24 Manila, ruling d, in part: "WorkWithMeForm.tsx draws it with the page's own controls, as it
 * draws today's questions, and its need question stays and picks the set." — the need question (needChoices, the page's own state) picks
 * the set the hook reads; with no door picked the core and How did you find me? stand, and the button waits for the need. The answers,
 * the rule, the body, the send and its errors are the hook's (src/hooks/useProposalForm.ts), the panel's form reads the same; every word
 * is the list's (src/lib/proposalNeeds.ts). More details starts closed (the hook, ruling h); Project details, the stack question, the
 * hard deadline and its No deadline — exploring, Team size and the done question are asked no more (ruling c), and the note by Send
 * left with ruling k. The honeypot is the trap both forms draw (ProposalTrap, src/components/landing/ServicesForm.tsx).
 */

import { useState } from 'react';
import { CONTROL, SECTION_HEADER, SEGMENT, STATE, SURFACE, toggleChip } from '@/lib/ds';
// SERVICES-01 (2026-11-08): the six doors, the lead and the bookkeeping block's words — one module; the close's
// leaf and words retired with the close.
import {
  BOOKKEEPING_WORDS, CORE_QUESTIONS, FORM_INTRO, FORM_WORDS, FOUND_QUESTION, LINK_ROWS, NEED_QUESTION, PROPOSAL_STEPS, SERVICES,
  followOpen, followWords, type Question, type ServiceNeed,
} from '@/lib/proposalNeeds'; // HOME-SERVICES-01 (2026-11-12): the need question, two labels, the thank-you's words and the note by Send — the services section draws them too (its whole view, on /professional-services, all five; since HOME-TRIM-03, 2026-11-15, the home page's short view draws the need question and the note, and "the landing's section draws them too" stood until then), so both read them here (the brief's ruling e: "The form changes only where it must read a word or a rule it now shares with the landing ("What do you need?" is one).") HOME-SERVICES-02 (2026-11-16): the note left every page (its ruling k), and the short view draws the need question alone of these now; the two labels stand in the list's questions, which this form reads.
import { useProposalForm, type ProposalForm } from '@/hooks/useProposalForm';
import { ProposalTrap } from '@/components/landing/ServicesForm';

/**
 * ONE-FORM-01 → SERVICES-01 (Alex, 2026-11-08): the choices — the six doors, in the panel's order, each chip the
 * door's title (SERVICES in src/lib/proposalNeeds.ts). It takes no day: since the close retired, nothing on the
 * form depends on one. A word that is not a door's key — 'close' from an old link — is not a choice, so the
 * component below picks nothing for it; nothing maps a retired word onto a door.
 * Pure; the tests drive it.
 */
export function needChoices(): ReadonlyArray<{ value: ServiceNeed; label: string }> {
  return SERVICES.map(({ need, title }) => ({ value: need, label: title }));
}

const TEXTAREA_CLASS = `${CONTROL.input} min-h-[72px] w-full resize-y`;
const HINT_CLASS = 'mt-1 text-xs text-text-faint';

/** HOME-SERVICES-02: a question's control in the page's own dress, with its label — a follow-up's words may be its opening answer's. */
function PageControl({ q, id, words, form }: { q: Question; id: string; words: string; form: ProposalForm }) {
  const hint = q.hint === undefined ? null : <p className={HINT_CLASS}>{q.hint}</p>;
  switch (q.kind) {
    case 'one':
    case 'many': {
      const now = form.value(q.key);
      const on = (answer: string) => (typeof now === 'string' ? now === answer : (now as readonly string[]).includes(answer));
      return (
        <>
          <span id={`${id}-label`} className={CONTROL.label}>{words}</span>
          <div role="group" aria-labelledby={`${id}-label`} className={q.kind === 'one' ? `${SEGMENT.wrap} mt-1 max-w-full flex-wrap` : 'mt-1 flex flex-wrap gap-1.5'}>
            {q.answers.map((answer) => (
              <button key={answer} type="button" onClick={() => form.press(q.key, answer)} aria-pressed={on(answer)} className={q.kind === 'one' ? SEGMENT.item(on(answer)) : toggleChip(on(answer))}>
                {answer}
              </button>
            ))}
          </div>
          {hint}
        </>
      );
    }
    case 'counts': {
      const parts = form.parts(q.key);
      return (
        <>
          <span id={`${id}-label`} className={CONTROL.label}>{words}</span>
          <div role="group" aria-labelledby={`${id}-label`} className="mt-1 grid max-w-[420px] grid-cols-3 gap-3">
            {q.parts.map((part) => (
              <label key={part.key} className="block">
                <span className="text-xs text-text-muted">{part.words}</span>
                <input type="number" inputMode="numeric" min={0} required={q.required} value={parts[part.key]} onChange={(e) => form.writePart(q.key, part.key, e.target.value)} className={`${CONTROL.input} mt-1 w-full`} />
              </label>
            ))}
          </div>
        </>
      );
    }
    case 'dated': {
      const parts = form.parts(q.key);
      return (
        <>
          <span id={`${id}-label`} className={CONTROL.label}>{words}</span>
          <div role="group" aria-labelledby={`${id}-label`} className="mt-1 grid gap-2 sm:grid-cols-[220px_1fr]">
            <input type="date" aria-label={FORM_WORDS.date} value={parts.date} onChange={(e) => form.writePart(q.key, 'date', e.target.value)} className={`${CONTROL.input} w-full`} />
            <input type="text" aria-label={FORM_WORDS.why} placeholder={q.placeholder} value={parts.why} onChange={(e) => form.writePart(q.key, 'why', e.target.value)} className={`${CONTROL.input} w-full`} />
          </div>
        </>
      );
    }
    case 'links': {
      const rows = form.rows(q.key);
      return (
        <>
          <span className={CONTROL.label}>{words}</span>
          {rows.map((row, i) => (
            <div key={i} className="mt-1 flex items-center gap-2">
              <input type="url" maxLength={q.max} placeholder={FORM_WORDS.linkPlaceholder} value={row} onChange={(e) => form.writeRow(q.key, i, e.target.value)} className={`${CONTROL.input} w-full`} />
              {rows.length > 1 && (
                <button type="button" onClick={() => form.removeRow(q.key, i)} aria-label={FORM_WORDS.removeLink} className="shrink-0 text-text-faint hover:text-text-primary">
                  {FORM_WORDS.removeMark}
                </button>
              )}
            </div>
          ))}
          {rows.length < LINK_ROWS && (
            <button type="button" onClick={() => form.addRow(q.key)} className={`${CONTROL.ghostButton} mt-2 px-3 py-1 text-xs`}>
              {FORM_WORDS.addLink}
            </button>
          )}
        </>
      );
    }
    case 'area':
      return (
        <>
          <label htmlFor={id} className={CONTROL.label}>{words}</label>
          <textarea id={id} required={q.required} maxLength={q.max} placeholder={q.placeholder} value={form.text(q.key)} onChange={(e) => form.write(q.key, e.target.value)} className={`${TEXTAREA_CLASS} mt-1`} />
          {hint}
        </>
      );
    default:
      return (
        <>
          <label htmlFor={id} className={CONTROL.label}>{words}</label>
          <input id={id} type={q.kind} inputMode={q.kind === 'number' ? 'numeric' : undefined} min={q.kind === 'number' ? 0 : undefined} required={q.required} maxLength={q.max} placeholder={q.placeholder} value={form.text(q.key)} onChange={(e) => form.write(q.key, e.target.value)} className={`${CONTROL.input} mt-1 w-full`} />
          {hint}
        </>
      );
  }
}

/** HOME-SERVICES-02: one question, full width when the list says wide; its follow-up under it while asked, as the page drew What is it? and the referral's question. */
function PageField({ q, id, form }: { q: Question; id: string; form: ProposalForm }) {
  const follow = q.follow;
  const answer = form.value(q.key);
  return (
    <div className={q.wide ? 'sm:col-span-2' : undefined}>
      <PageControl q={q} id={id} words={q.words} form={form} />
      {follow !== undefined && followOpen(q, answer) && (
        <div className="mt-3">
          <PageControl q={follow.question} id={`${id}-${follow.question.key}`} words={followWords(follow, answer)} form={form} />
        </div>
      )}
    </div>
  );
}

export default function WorkWithMeForm({ initialNeed }: { initialNeed: string | null }) {
  // SERVICES-01 (2026-11-08): the six doors — the choices depend on no day, so the form takes none.
  const needs = needChoices();
  const isDoor = (word: string): word is ServiceNeed => needs.some((n) => n.value === word);
  // ONE-FORM-01: `?need=` picks a choice on arrival when it names a door — an old link's 'close' names none.
  const [need, setNeed] = useState<ServiceNeed | null>(initialNeed !== null && isDoor(initialNeed) ? initialNeed : null);
  const isBookkeeping = need === 'bookkeeping';
  // HOME-SERVICES-02 (2026-11-16): the answers, the rule, the body and the send — the hook both forms read, handed the picked need.
  const form = useProposalForm(need);
  const here = (q: Question) => (need === null ? `p-${q.key}` : `p-${need}-${q.key}`);

  return (
    <div className={`min-h-screen ${SURFACE.page} px-4 py-10 lg:px-8`}>
      <div className={`mx-auto max-w-2xl ${SURFACE.card}`}>
        <div className={SECTION_HEADER}>{FORM_WORDS.eyebrow}</div>
        <div className="p-4 sm:p-6">
          {/* ONE-FORM-01: one form for every door. SERVICES-01 (Alex, 2026-11-08): the lead is one sentence
              (FORM_INTRO in src/lib/proposalNeeds.ts) — the typed setup sentence, which restated the first door's line,
              and the close's sentence went. */}
          <p className="text-xs leading-relaxed text-text-muted">
            {FORM_INTRO}
          </p>

          {form.sentEmail !== null ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-xs text-status-success"
            >
              {FORM_WORDS.sentLead} {PROPOSAL_STEPS.read}. {FORM_WORDS.sentHear} {form.sentEmail}.
            </div>
          ) : (
            <form onSubmit={form.send} className="mt-5 flex flex-col gap-5">
              {/* HOME-SERVICES-02: the core's first two, Name and Email, side by side above the need question, as they stood. */}
              <div className="grid gap-5 sm:grid-cols-2">
                {CORE_QUESTIONS.slice(0, 2).map((q) => <PageField key={q.key} q={q} id={`p-${q.key}`} form={form} />)}
              </div>

              <div>
                <span className={CONTROL.label}>{NEED_QUESTION}</span>
                <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                  {needs.map((n) => (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => setNeed(n.value)}
                      className={SEGMENT.item(need === n.value)}
                      data-need={n.value}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
                {/* SERVICES-01 (Alex, 2026-11-08): bookkeeping picked — its own lines, every word from
                    BOOKKEEPING_WORDS (src/lib/proposalNeeds.ts), in the classes the close block's what, notTax
                    and remedy wore (ONE-FORM-01's close block retired with the close: no price, no book-by day). */}
                {isBookkeeping && (
                  <div className="mt-3 rounded bg-bg-row p-4 text-sm leading-relaxed text-text-primary" data-bookkeeping-offer>
                    <p>{BOOKKEEPING_WORDS.what}</p>
                    <p className="mt-2">{BOOKKEEPING_WORDS.notTax}</p>
                    <p className="mt-1 text-text-secondary">{BOOKKEEPING_WORDS.remedy}</p>
                  </div>
                )}
              </div>

              {/* HOME-SERVICES-02: the rest of the core, then the picked door's own questions — the list's, in its order. */}
              <div className="grid gap-5 sm:grid-cols-2">
                {CORE_QUESTIONS.slice(2).map((q) => <PageField key={q.key} q={q} id={`p-${q.key}`} form={form} />)}
                {form.questions.filter((q) => !q.more).map((q) => <PageField key={q.key} q={q} id={here(q)} form={form} />)}
              </div>

              {/* Honeypot — the trap both forms draw (ServicesForm.tsx). */}
              <ProposalTrap id="p-website" form={form} />

              <div>
                <button
                  type="button"
                  onClick={form.toggleMore}
                  aria-expanded={form.moreOpen}
                  className="font-mono text-xs text-text-muted underline decoration-border hover:text-text-primary"
                >
                  {FORM_WORDS.more}
                </button>
                {form.moreOpen && (
                  <div className="mt-4 grid gap-5 rounded bg-bg-row p-4 sm:grid-cols-2">
                    {form.questions.filter((q) => q.more).map((q) => <PageField key={q.key} q={q} id={here(q)} form={form} />)}
                    <PageField q={FOUND_QUESTION} id={`p-${FOUND_QUESTION.key}`} form={form} />
                  </div>
                )}
              </div>

              {form.error && <div className={STATE.errorCard}>{form.error}</div>}

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={form.submitting || form.held}
                  className="px-8 py-2 bg-brand-gold text-white font-bold text-sm rounded transition-colors hover:bg-brand-gold/90 whitespace-nowrap disabled:opacity-50"
                >
                  {form.submitting ? FORM_WORDS.sending : FORM_WORDS.send}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
