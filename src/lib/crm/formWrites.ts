/**
 * CRM-02 (Alex, 2026-11-07) — THE FORM'S TWO BODIES, as zod shapes (the contactWrites.ts idiom): what PUT /api/crm/form
 * and POST /api/f/<slug> accept. PURE and tested on their own (src/lib/__tests__/intakeForm01.test.ts); each route parses
 * with one and answers 400 with the field on a miss (contactWrites.ts validationOf).
 *
 *   PUT { slug, title, line, questions } — slug FORM_SLUG_RE and 3 to 40 (its message the rule in words, SLUG_RULE_WORDS;
 *     nothing lowercased or trimmed); title 1–120 after trim; line at most 500 after trim, or null; questions at most
 *     twelve of { id? (a uuid — the server's, kept across saves), label 1–120 after trim, kind, required, shown }.
 *   POST { website?, name, email, business?, answers } — website the honeypot (read before this shape, by the route);
 *     name and email the proposal form's shapes, COPIED from src/app/api/proposals/route.ts:46-47 as contactWrites.ts
 *     copies them; business at most 5000 after trim, or absent; answers a record of question id → words or yes / no.
 *     The per-form check — which ids, what each kind takes, what is required — is forms.ts answersOf.
 */
import { z } from 'zod';
import { FORM_LABEL_MAX, FORM_LINE_MAX, FORM_MAX_QUESTIONS, FORM_QUESTION_KINDS, FORM_SLUG_MAX, FORM_SLUG_MIN, FORM_SLUG_RE } from './forms';
import { SLUG_RULE_WORDS } from './formWords';

export const putQuestionBody = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(FORM_LABEL_MAX),
    kind: z.enum(FORM_QUESTION_KINDS),
    required: z.boolean(),
    shown: z.boolean(),
  })
  .strict();

export const putFormBody = z
  .object({
    slug: z.string().min(FORM_SLUG_MIN, { message: SLUG_RULE_WORDS }).max(FORM_SLUG_MAX, { message: SLUG_RULE_WORDS }).regex(FORM_SLUG_RE, { message: SLUG_RULE_WORDS }),
    title: z.string().trim().min(1).max(FORM_LABEL_MAX),
    line: z.string().trim().max(FORM_LINE_MAX).nullable(),
    questions: z.array(putQuestionBody).max(FORM_MAX_QUESTIONS),
  })
  .strict();
export type PutFormBody = z.infer<typeof putFormBody>;

export const publicSubmissionBody = z
  .object({
    website: z.string().optional(),
    name: z.string().trim().min(1).max(255), // src/app/api/proposals/route.ts:46
    email: z.string().trim().email().max(255), // src/app/api/proposals/route.ts:47
    business: z.string().trim().max(5000).optional(),
    answers: z.record(z.string(), z.union([z.string(), z.boolean()])),
  })
  .strict();
export type PublicSubmissionBody = z.infer<typeof publicSubmissionBody>;
