/**
 * CRM-02 (Alex, 2026-11-07) — THE INTAKE FORM'S RULES. PURE: no fetch, no env, no clock, no React, no id minted here.
 * GET /api/crm (src/app/api/crm/route.ts) reads the caller's form and submissions and hands them in; PUT /api/crm/form
 * (src/app/api/crm/form/route.ts) re-keys the questions it saves; POST /api/f/<slug> (src/app/api/f/[slug]/route.ts)
 * freezes a submission's answers; the page (src/components/crm/CrmSection.tsx) prints the submissions spec below through
 * the shared DataTable.
 *
 *   THE FORM (CLOSED 3): three FIXED fields — name required, email required, business optional — the three the Contacts
 *   row shows, always first, never in `questions`; then up to FORM_MAX_QUESTIONS questions of the account's own, each
 *   { id, label (1–120), kind (FORM_QUESTION_KINDS), required, shown }. A hidden question is kept (its past answers still
 *   show) and not asked. The ids are the server's: rekeyQuestions gives one to a question that has none (through the
 *   minter it is handed — crypto's randomUUID in the route), keeps one across saves, and refuses by name an id the form
 *   does not hold today.
 *   THE SLUG (CLOSED 2): FORM_SLUG_RE is the migration's own pattern (crm_forms_slug_chk) — 3 to 40 characters, lowercase
 *   letters, digits and hyphens, starting and ending with a letter or digit. Nothing is lowercased or trimmed for it.
 *   A SUBMISSION (CLOSED 4): answersOf validates a public body against the form and returns the FROZEN answers — the
 *   questions AS ASKED, [{ id, label, kind, required, value }] — or throws a CrmLawError by name: every shown required
 *   question answered; a yesno a boolean, the others strings within their limit (SHORT_MAX · LONG_MAX · EMAIL_MAX), an
 *   email an email; no unknown id; no answer to a hidden question. Text is trimmed; a shown optional question left blank
 *   is frozen with '' (asked, not answered — an admitted empty, never a made-up word), and a yesno left unpicked the same.
 *   THE TABLE: submissionsTable(form) — came_in · name · email · business, then ONE column per question the form holds
 *   today (shown or hidden — their past answers exist): the submission's answer whose id matches (a yesno printed Yes /
 *   No; '' a blank cell), else NOT_ASKED_WORDS; then a last column, the answers whose question the form no longer holds
 *   ("<label>: <value>", LIST_JOIN-joined), "—" when none.
 *
 * THE LAWS are at the functions: a stored form or submission that contradicts its shape (questionsOf, frozenAnswersOf)
 * is a CrmLawError by name — reported, never smoothed.
 */

import { z } from 'zod';
import type { TableColumn } from '@/lib/table/columns';
import { instantColumn, textColumn, valueColumn } from '@/lib/operations/work';
import { CrmLawError } from './crm';
import { LIST_JOIN } from './crmWords';
import { NOT_ASKED_WORDS, NO_WORDS, REMOVED_HEAD_WORDS, SUBMISSION_HEAD_WORDS, YES_WORDS } from './formWords';

export const FORM_QUESTION_KINDS = ['short', 'long', 'email', 'yesno'] as const;
export type FormQuestionKind = (typeof FORM_QUESTION_KINDS)[number];
export const FORM_MAX_QUESTIONS = 12;
/** The migration's pattern (crm_forms_slug_chk): one character, or 3 to 40 — the CHECK's `length >= 3` is isFormSlug's second half. */
export const FORM_SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;
export const FORM_SLUG_MIN = 3;
export const FORM_SLUG_MAX = 40;
/** The answer limits, by kind. */
export const SHORT_MAX = 500;
export const LONG_MAX = 5000;
export const EMAIL_MAX = 255;
/** The label's and the title's length; the line's. */
export const FORM_LABEL_MAX = 120;
export const FORM_LINE_MAX = 500;

export const isFormSlug = (slug: string): boolean => FORM_SLUG_RE.test(slug) && slug.length >= FORM_SLUG_MIN && slug.length <= FORM_SLUG_MAX;
const isKind = (kind: unknown): kind is FormQuestionKind => typeof kind === 'string' && (FORM_QUESTION_KINDS as readonly string[]).includes(kind);

export interface FormQuestion {
  readonly id: string;
  readonly label: string;
  readonly kind: FormQuestionKind;
  readonly required: boolean;
  readonly shown: boolean;
}

/** The form as the CRM holds it (the GET's `form`, the PUT's answer). */
export interface IntakeForm {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly line: string | null;
  readonly questions: readonly FormQuestion[];
}

/** What the public page gets: the form's title, line and the questions ASKED — nothing of the account beyond them. */
export interface PublicForm {
  readonly slug: string;
  readonly title: string;
  readonly line: string | null;
  readonly questions: readonly FormQuestion[];
}

/** One frozen answer: the question as it was asked, and what was said. */
export interface SubmissionAnswer {
  readonly id: string;
  readonly label: string;
  readonly kind: FormQuestionKind;
  readonly required: boolean;
  readonly value: string | boolean;
}

/** One submission as the CRM reads it (the GET's `submissions`). */
export interface SubmissionRow {
  /** 'form:<submission id>' — its ContactRow.key too. */
  readonly key: string;
  /** The instant it came in. */
  readonly came_in: string;
  readonly name: string;
  readonly email: string;
  readonly business: string | null;
  readonly answers: readonly SubmissionAnswer[];
}

/** A question of a PUT body: its id when it has one (the server gave it), the four fields. */
export interface PutQuestion {
  readonly id?: string;
  readonly label: string;
  readonly kind: FormQuestionKind;
  readonly required: boolean;
  readonly shown: boolean;
}

export const formKeyOf = (submissionId: string): string => `form:${submissionId}`;

// ── WHAT THE TABLE HOLDS, READ BACK ─────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** crm_forms.questions read back — the shape, or a CrmLawError by name. */
export function questionsOf(value: unknown): FormQuestion[] {
  if (!Array.isArray(value)) throw new CrmLawError('questionsOf: crm_forms.questions is not a list — a data error, reported');
  if (value.length > FORM_MAX_QUESTIONS) throw new CrmLawError(`questionsOf: the form holds ${value.length} questions — at most ${FORM_MAX_QUESTIONS} (crm_forms_questions_chk)`);
  const seen = new Set<string>();
  return value.map((q, i): FormQuestion => {
    if (!isRecord(q)) throw new CrmLawError(`questionsOf: question ${i + 1} is not a record — a data error, reported`);
    const { id, label, kind, required, shown } = q;
    if (typeof id !== 'string' || id === '') throw new CrmLawError(`questionsOf: question ${i + 1} has no id — a data error, reported`);
    if (seen.has(id)) throw new CrmLawError(`questionsOf: two questions hold the id ${id} — a data error, reported`);
    seen.add(id);
    if (typeof label !== 'string' || label.trim() === '' || label.length > FORM_LABEL_MAX) throw new CrmLawError(`questionsOf: question ${i + 1} has no label of 1 to ${FORM_LABEL_MAX} characters — a data error, reported`);
    if (!isKind(kind)) throw new CrmLawError(`questionsOf: question ${i + 1} has the kind "${String(kind)}" — not one of ${FORM_QUESTION_KINDS.join(', ')}`);
    if (typeof required !== 'boolean' || typeof shown !== 'boolean') throw new CrmLawError(`questionsOf: question ${i + 1} says required or shown in something other than true / false — a data error, reported`);
    return { id, label, kind, required, shown };
  });
}

/** crm_form_submissions.answers read back — the frozen shape, or a CrmLawError by name. */
export function frozenAnswersOf(value: unknown, submissionId: string): SubmissionAnswer[] {
  if (!Array.isArray(value)) throw new CrmLawError(`frozenAnswersOf: submission ${submissionId}: answers is not a list — a data error, reported`);
  return value.map((a, i): SubmissionAnswer => {
    if (!isRecord(a)) throw new CrmLawError(`frozenAnswersOf: submission ${submissionId}: answer ${i + 1} is not a record — a data error, reported`);
    const { id, label, kind, required, value: v } = a;
    if (typeof id !== 'string' || id === '' || typeof label !== 'string' || !isKind(kind) || typeof required !== 'boolean') throw new CrmLawError(`frozenAnswersOf: submission ${submissionId}: answer ${i + 1} is not { id, label, kind, required, value } — a data error, reported`);
    if (typeof v !== 'string' && typeof v !== 'boolean') throw new CrmLawError(`frozenAnswersOf: submission ${submissionId}: answer ${i + 1} ("${label}") holds a value that is neither words nor yes / no — a data error, reported`);
    return { id, label, kind, required, value: v };
  });
}

/** A crm_forms row with its questions read back. */
export function intakeFormOf(row: { readonly id: string; readonly slug: string; readonly title: string; readonly line: string | null; readonly questions: unknown }): IntakeForm {
  return { id: row.id, slug: row.slug, title: row.title, line: row.line, questions: questionsOf(row.questions) };
}

/** A crm_form_submissions row as the CRM reads it. */
export function submissionRowOf(row: { readonly id: string; readonly created_at: string; readonly name: string; readonly email: string; readonly business: string | null; readonly answers: unknown }): SubmissionRow {
  return { key: formKeyOf(row.id), came_in: row.created_at, name: row.name, email: row.email, business: row.business, answers: frozenAnswersOf(row.answers, row.id) };
}

// ── THE FORM ────────────────────────────────────────────────────────────────

/** The questions the public page asks: the shown ones, in order. */
export const askedQuestions = (form: Pick<IntakeForm, 'questions'>): FormQuestion[] => form.questions.filter((q) => q.shown);

/** What the public page gets of a form: nothing of the account beyond its title, line and the questions asked. */
export const publicFormOf = (form: IntakeForm): PublicForm => ({ slug: form.slug, title: form.title, line: form.line, questions: askedQuestions(form) });

/**
 * The questions a PUT saves (CLOSED 3): a question with an id keeps it — the id must be one the form holds today, else
 * refused by name; a question with none is given one by the minter; an id given twice is refused. The order is the body's.
 */
export function rekeyQuestions(held: readonly FormQuestion[], given: readonly PutQuestion[], mint: () => string): FormQuestion[] {
  if (given.length > FORM_MAX_QUESTIONS) throw new CrmLawError(`rekeyQuestions: ${given.length} questions — at most ${FORM_MAX_QUESTIONS}`);
  const holds = new Set(held.map((q) => q.id));
  const used = new Set<string>();
  return given.map((q): FormQuestion => {
    let id: string;
    if (q.id === undefined) {
      id = mint();
      if (holds.has(id) || used.has(id)) throw new CrmLawError(`rekeyQuestions: the minter gave ${id}, which is already a question's — refused`);
    } else {
      if (!holds.has(q.id)) throw new CrmLawError(`rekeyQuestions: "${q.id}" is not a question this form holds — a question's id is the server's; leave it off a new question`);
      if (used.has(q.id)) throw new CrmLawError(`rekeyQuestions: "${q.id}" is given twice — one question, one id`);
      id = q.id;
    }
    used.add(id);
    return { id, label: q.label, kind: q.kind, required: q.required, shown: q.shown };
  });
}

// ── A SUBMISSION ────────────────────────────────────────────────────────────

const emailShape = z.string().email();

/**
 * A public body's answers against the form (CLOSED 4): every shown required question answered; a yesno a boolean, the
 * others strings within their limit, an email an email; no unknown id; no answer to a hidden question. Returns the
 * FROZEN answers — every question ASKED, in the form's order, with what was said ('' for a shown optional one left blank).
 */
export function answersOf(form: Pick<IntakeForm, 'questions'>, body: { readonly answers: Readonly<Record<string, string | boolean>> }): SubmissionAnswer[] {
  const byId = new Map(form.questions.map((q) => [q.id, q] as const));
  for (const id of Object.keys(body.answers)) {
    const q = byId.get(id);
    if (q === undefined) throw new CrmLawError(`answersOf: "${id}" is not a question of this form`);
    if (!q.shown) throw new CrmLawError(`answersOf: "${q.label}" is not asked — the form hides it`);
  }
  return askedQuestions(form).map((q): SubmissionAnswer => {
    const given = body.answers[q.id];
    const frozen = { id: q.id, label: q.label, kind: q.kind, required: q.required };
    if (q.kind === 'yesno') {
      if (given === undefined || given === '') {
        if (q.required) throw new CrmLawError(`answersOf: "${q.label}" is required — Yes or No`);
        return { ...frozen, value: '' };
      }
      if (typeof given !== 'boolean') throw new CrmLawError(`answersOf: "${q.label}" takes Yes or No`);
      return { ...frozen, value: given };
    }
    if (typeof given === 'boolean') throw new CrmLawError(`answersOf: "${q.label}" takes words, not Yes or No`);
    const text = (given ?? '').trim();
    if (text === '') {
      if (q.required) throw new CrmLawError(`answersOf: "${q.label}" is required`);
      return { ...frozen, value: '' };
    }
    const max = q.kind === 'long' ? LONG_MAX : q.kind === 'email' ? EMAIL_MAX : SHORT_MAX;
    if (text.length > max) throw new CrmLawError(`answersOf: "${q.label}" is longer than ${max} characters`);
    if (q.kind === 'email' && !emailShape.safeParse(text).success) throw new CrmLawError(`answersOf: "${q.label}" is not an email address`);
    return { ...frozen, value: text };
  });
}

// ── THE TABLE (the CRM tables' way: work.ts's column factories) ─────────────

export const SUBMISSIONS_TABLE_NAME = 'crm-form-submissions';
export const SUBMISSIONS_CSV = 'crm-form-submissions.csv';
/** The column key of a question's column. */
export const questionColumnKey = (questionId: string): string => `q:${questionId}`;
export const REMOVED_COLUMN_KEY = 'removed';

/** A frozen value as a cell: a boolean as Yes / No, words as themselves, '' a blank. */
export const answerWords = (value: string | boolean): string | null => (typeof value === 'boolean' ? (value ? YES_WORDS : NO_WORDS) : value === '' ? null : value);

/**
 * FORM SUBMISSIONS: Came in · Name · Email · Business, then one column per question the form holds today (shown or hidden),
 * then the removed questions. With no form, the four and the last.
 */
export function submissionsTable(form: Pick<IntakeForm, 'questions'> | null): readonly TableColumn<SubmissionRow, string>[] {
  const h = SUBMISSION_HEAD_WORDS;
  const held = form === null ? [] : form.questions;
  const heldIds = new Set(held.map((q) => q.id));
  const cell = (q: FormQuestion) => (r: SubmissionRow): string | null => {
    const a = r.answers.find((x) => x.id === q.id);
    return a === undefined ? NOT_ASKED_WORDS : answerWords(a.value);
  };
  const removed = (r: SubmissionRow): string | null => {
    const gone = r.answers.filter((a) => !heldIds.has(a.id)).map((a) => `${a.label}: ${answerWords(a.value) ?? ''}`);
    return gone.length === 0 ? null : gone.join(LIST_JOIN);
  };
  return [
    instantColumn<SubmissionRow, string>('came_in', h.came_in, (r) => r.came_in),
    valueColumn<SubmissionRow, string>('name', h.name, (r) => r.name),
    valueColumn<SubmissionRow, string>('email', h.email, (r) => r.email),
    textColumn<SubmissionRow, string>('business', h.business, (r) => r.business),
    ...held.map((q) => (q.kind === 'long' ? textColumn<SubmissionRow, string>(questionColumnKey(q.id), q.label, cell(q)) : valueColumn<SubmissionRow, string>(questionColumnKey(q.id), q.label, cell(q)))),
    textColumn<SubmissionRow, string>(REMOVED_COLUMN_KEY, REMOVED_HEAD_WORDS, removed),
  ];
}
