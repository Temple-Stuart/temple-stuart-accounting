'use client';

/**
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila) — THE PROPOSAL FORM'S HOOK, read by both forms: the panel's
 * (src/components/landing/ServicesForm.tsx, which the home page's short view draws) and /work-with-me's (src/app/work-with-me/WorkWithMeForm.tsx).
 * Ruling e: "ONE HOOK, READ BY BOTH FORMS. The answers, the button's rule, the body, the send and its errors leave WorkWithMeForm.tsx for src/hooks/useProposalForm.ts, with the picked need as their argument. The rule and the body are pure functions there, so the tests reach them. The core's answers carry from service to service, and each service keeps its own while another is looked at. The page keeps its own need, its markup and needChoices. No line of the form's logic is written twice." — useProposalForm(need) keeps the core's answers once, and every service's own beside them from the start (startAnswers),
 * so a look at another service keeps them; More details' state; the trap; the send and its errors. The rule (proposalHeld) and the body
 * (proposalBody) are pure, exported for the tests. Both read the list (src/lib/proposalNeeds.ts), whose check the route reads too.
 * Ruling h: "MORE DETAILS STARTS CLOSED, in both forms. Its words, More details (optional), replace Project details. Inside it stand the service's optional questions, then How did you find me." — moreOpen is false at first, in both forms.
 * The one request either form makes is the send: one POST to /api/proposals (PROPOSALS_API), on a press of Send proposal, never before.
 * This file joins the public pages' import closure (/professional-services draws the section, and the section reads this hook), the one
 * file of it allowed a fetch — Alex's answer to the audit's question (A); src/lib/__tests__/homePages01.test.ts T7 holds it to this one.
 * The send's reading of the route's error and its two error words are WorkWithMeForm.tsx's, moved here as they stood.
 */

import { useState, type FormEvent } from 'react';
import {
  CORE_COLUMNS, CORE_QUESTIONS, FORM_WORDS, FOUND_QUESTION, LINK_ROWS, SERVICE_NEEDS,
  answerPress, followOpen, partsOf, pressOne, proposalCheck, referralSource, rowsOf, setOf, startAnswers, textOf,
  type Answer, type Answers, type OneQuestion, type Question, type ServiceNeed,
} from '@/lib/proposalNeeds';

/** The route both forms post to: the one request either makes, on a press of Send proposal. */
export const PROPOSALS_API = '/api/proposals';

/** The core's answers: kept once, carried from service to service. found and detail travel as the referral's column. */
export type CoreAnswers = {
  readonly name: string;
  readonly email: string;
  readonly business: string;
  readonly site: string;
  readonly role: string;
  readonly found: string;
  readonly detail: string;
};

/** The core at first: nothing typed, nothing picked. */
export const CORE_START: CoreAnswers = { name: '', email: '', business: '', site: '', role: '', found: '', detail: '' };

/** The body the button sends — the panel's and /work-with-me's alike (ruling b). website is the trap, and only the trap (ruling n). */
export type ProposalBody = {
  readonly name: string;
  readonly email: string;
  readonly business: string;
  readonly need: ServiceNeed | null;
  readonly answers: Readonly<Record<string, Answer>>;
  readonly referralSource?: string;
  readonly website: string;
};

const isCore = (key: string): key is keyof CoreAnswers => Object.prototype.hasOwnProperty.call(CORE_START, key);

/** The core's two answers that travel under answers: the website (site) and the visitor's part in the decision (role). */
const CORE_ANSWERED = CORE_QUESTIONS.filter((q) => !(CORE_COLUMNS as readonly string[]).includes(q.key));

/** One answered question's answer, under its key, as the form shows it — a text trimmed; nothing for a question left unanswered. */
function put(into: Record<string, Answer>, q: Question, answers: Answers): void {
  switch (q.kind) {
    case 'one': {
      const answer = textOf(answers, q.key);
      if (answer !== '') into[q.key] = answer;
      return;
    }
    case 'many': {
      const picked = rowsOf(answers, q.key);
      if (picked.length > 0) into[q.key] = picked;
      return;
    }
    case 'links': {
      const rows = rowsOf(answers, q.key).map((row) => row.trim()).filter((row) => row !== '');
      if (rows.length > 0) into[q.key] = rows;
      return;
    }
    case 'counts':
    case 'dated': {
      const parts = Object.entries(partsOf(answers, q.key)).map(([part, value]) => [part, value.trim()] as const).filter(([, value]) => value !== '');
      if (parts.length > 0) into[q.key] = Object.fromEntries(parts);
      return;
    }
    default: {
      const text = textOf(answers, q.key).trim();
      if (text !== '') into[q.key] = text;
    }
  }
}

/** Each answered question of a set, and its follow-up while it is asked. */
function answered(asked: readonly Question[], answers: Answers): Record<string, Answer> {
  const into: Record<string, Answer> = {};
  for (const q of asked) {
    put(into, q, answers);
    if (q.follow !== undefined && followOpen(q, answers[q.key])) put(into, q.follow.question, answers);
  }
  return into;
}

/** THE BODY (ruling e), pure: Name, Email, the business and the need in their columns; under answers, the core's two and the picked service's answered questions (ruling m); the referral's column; the trap, as typed. */
export function proposalBody(need: ServiceNeed | null, core: CoreAnswers, answers: Answers, trap: string): ProposalBody {
  const referral = referralSource(core.found, core.detail);
  return {
    name: core.name.trim(),
    email: core.email.trim(),
    business: core.business.trim(),
    need,
    answers: { ...answered(CORE_ANSWERED, core), ...answered(need === null ? [] : setOf(need, answers), answers) },
    ...(referral === undefined ? {} : { referralSource: referral }),
    website: trap,
  };
}

/** THE RULE (rulings e and f), pure: the button waits while the list's check finds a required pick, count or follow-up missing from the body it would send — the check the route refuses by. */
export function proposalHeld(body: ProposalBody): boolean {
  return proposalCheck(body).held.length > 0;
}

/** Every service's answers at first, by its key. */
function startSets(): Record<ServiceNeed, Answers> {
  return Object.fromEntries(SERVICE_NEEDS.map((need) => [need, startAnswers(need)])) as Record<ServiceNeed, Answers>;
}

/** The core's pick-one under a key: the decision role, or How did you find me? */
function corePick(key: keyof CoreAnswers): OneQuestion {
  const q = key === FOUND_QUESTION.key ? FOUND_QUESTION : CORE_QUESTIONS.find((asked) => asked.key === key);
  if (q === undefined || q.kind !== 'one') throw new Error(`proposal form: the core asks no pick under "${key}"`);
  return q;
}

const NONE: Answers = {};

export function useProposalForm(need: ServiceNeed | null) {
  const [core, setCore] = useState<CoreAnswers>(CORE_START);
  const [sets, setSets] = useState<Record<ServiceNeed, Answers>>(startSets);
  const [moreOpen, setMoreOpen] = useState(false);
  // the trap: no visitor sees or fills it
  const [trap, setTrap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answers = need === null ? NONE : sets[need];
  const body = proposalBody(need, core, answers, trap);

  /** The picked service's answers, changed — refused by name while none is picked: no service question is drawn then. */
  const change = (next: (now: Answers, picked: ServiceNeed) => Answers): void => {
    if (need === null) throw new Error('proposal form: no service is picked, so none of its questions is drawn');
    const picked = need;
    setSets((all) => ({ ...all, [picked]: next(all[picked], picked) }));
  };

  /** The answer kept under a key: the core's, or the picked service's — a key neither keeps is refused by name. */
  const value = (key: string): Answer => {
    if (isCore(key)) return core[key];
    const answer = answers[key];
    if (answer === undefined) throw new Error(`proposal form: no answer is kept under "${key}"`);
    return answer;
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(PROPOSALS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(data?.issues) ? ` (${data.issues.join('; ')})` : '';
        setError(`${data?.error ?? `${FORM_WORDS.failed} (${res.status})`}${issues}`);
        return;
      }
      setSentEmail(body.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : FORM_WORDS.network);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    need,
    /** The picked service's questions as its form asks them now (setOf: Something else's budget by its billing); none while none is picked. */
    questions: need === null ? [] : setOf(need, answers),
    value,
    /** The answer under a key as a text, a list (a pick-any's answers, the links' rows) or a set of parts (a count's, a date's) — refused by name when it is not one. */
    text: (key: string) => textOf({ [key]: value(key) }, key),
    rows: (key: string) => rowsOf({ [key]: value(key) }, key),
    parts: (key: string) => partsOf({ [key]: value(key) }, key),
    moreOpen,
    trap,
    submitting,
    error,
    sentEmail,
    /** The rule, on the body the button would send. */
    held: proposalHeld(body),
    /** A text: the core's (Name, Email, the business, the website, the referral's follow-up) or the picked service's. */
    write: (key: string, text: string) => {
      if (isCore(key)) setCore((now) => ({ ...now, [key]: text }));
      else change((now) => ({ ...now, [key]: text }));
    },
    /** A press on a pick: the core's (a new answer to How did you find me? clears its follow-up, as the form did) or the picked service's. */
    press: (key: string, answer: string) => {
      if (isCore(key)) {
        setCore((now) => {
          const picked = pressOne(corePick(key), now[key], answer);
          return key === FOUND_QUESTION.key && picked !== now.found ? { ...now, found: picked, detail: '' } : { ...now, [key]: picked };
        });
      } else change((now, picked) => answerPress(picked, now, key, answer));
    },
    /** One part of a count, or a date's or its why. */
    writePart: (key: string, part: string, text: string) => change((now) => ({ ...now, [key]: { ...partsOf(now, key), [part]: text } })),
    /** The links' rows: one written, one more (today's five at most), one less. */
    writeRow: (key: string, row: number, text: string) => change((now) => ({ ...now, [key]: rowsOf(now, key).map((was, i) => (i === row ? text : was)) })),
    addRow: (key: string) =>
      change((now) => {
        const rows = rowsOf(now, key);
        if (rows.length >= LINK_ROWS) throw new Error(`proposal form: "${key}" holds ${LINK_ROWS} links at most`);
        return { ...now, [key]: [...rows, ''] };
      }),
    removeRow: (key: string, row: number) => change((now) => ({ ...now, [key]: rowsOf(now, key).filter((_, i) => i !== row) })),
    toggleMore: () => setMoreOpen((open) => !open),
    setTrap,
    send,
  };
}

/** What the hook gives a form. */
export type ProposalForm = ReturnType<typeof useProposalForm>;
