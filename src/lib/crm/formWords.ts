/**
 * CRM-02 (Alex, 2026-11-07) — THE WORDS of the intake form: the block on /crm (IntakeFormSetup.tsx), the public page
 * (/f/<slug>, IntakeFormClient.tsx) and the Form submissions table (forms.ts submissionsTable). Typed once, here; none in
 * the components. PURE: no fetch, no env, no clock, no React. Plain words a fifth-grader reads; no sales words, no emoji.
 *
 *   the block: its title, the link's label and its three buttons, the slug rule and the two slug lines, the form's three
 *   field labels, the fixed fields' note, the questions table's heads, the four kind words, the add / remove / move words,
 *   the embed words, the saved line and the failed line (the CRM's "Not saved — " prefix, crmWords.ts) ·
 *   the public page: the fixed fields as the sender sees them, "(optional)", Yes / No, Send, the sent line, the failed
 *   line, the goes-to line, the footer's "Form by Temple Stuart", the honeypot's label ·
 *   the table: its title, its four fixed heads (the Contacts heads' own words), the two empty lines, "not asked", the
 *   removed-questions head · the route's not-found words.
 */
import { CONTACT_HEAD_WORDS, WRITE_FAILED_PREFIX_WORDS } from './crmWords';

// ── THE BLOCK (IntakeFormSetup.tsx) ───────────────────────────────────────────

export const INTAKE_FORM_WORDS = 'Your intake form';
/** The link's label, and its three buttons. */
export const LINK_LABEL_WORDS = 'Your link';
export const COPY_WORDS = 'Copy';
export const OPEN_WORDS = 'Open';
export const PREVIEW_WORDS = 'Preview';
export const SAVE_FORM_WORDS = 'Save the form';
/** The slug's rule, in one sentence — under the field, and the 400's message when a slug misses it (formWrites.ts). */
export const SLUG_RULE_WORDS = 'The last part of your link: 3 to 40 characters — lowercase letters, digits and hyphens, starting and ending with a letter or digit.';
export const SLUG_CHANGE_WORDS = 'Changing it breaks the old link.';
/** The 409's message when the slug is another account's (the route's words, printed beside the field). */
export const SLUG_TAKEN_WORDS = 'That link is taken — pick another.';
/** The form's own three fields, as the block labels them. */
export const FORM_FIELD_LABELS = { title: 'Title', slug: 'Your link ends with', line: 'A line under the title (optional)' } as const;
/** The three fixed fields, listed in the block and never editable. */
export const FIXED_FIELDS_NOTE_WORDS = 'Asked first on every form, always — not editable:';
/** The questions table's heads, in order. */
export const QUESTION_HEAD_WORDS = { order: 'Order', question: 'Question', kind: 'Kind', required: 'Required', shown: 'Shown' } as const;
/** The four kinds, as the Kind select and the table show them (forms.ts FORM_QUESTION_KINDS, in order). */
export const KIND_WORDS = { short: 'Short answer', long: 'Long answer', email: 'Email', yesno: 'Yes / no' } as const;
export const ADD_QUESTION_WORDS = '+ add a question';
export const REMOVE_WORDS = 'Remove';
export const MOVE_UP_WORDS = '↑';
export const MOVE_DOWN_WORDS = '↓';
/** The two order buttons, named for a screen reader. */
export const moveUpAriaWords = (label: string): string => `Move "${label}" up`;
export const moveDownAriaWords = (label: string): string => `Move "${label}" down`;
export const removeAriaWords = (label: string): string => `Remove "${label}"`;
export const EMBED_WORDS = 'Embed it on your site';
export const SAVED_WORDS = 'Saved.';
/** A failed save, under the block: the CRM's prefix and the route's words. */
export const formSaveFailedWords = (words: string): string => `${WRITE_FAILED_PREFIX_WORDS}${words}`;
/** The clipboard refused (an insecure page, a browser without it): said, never swallowed. */
export const COPY_FAILED_WORDS = 'Could not copy — select it and copy by hand.';
export const COPIED_WORDS = 'Copied.';

// ── THE PUBLIC PAGE (IntakeFormClient.tsx) ────────────────────────────────────

/** The three fixed fields as the sender sees them. */
export const FIXED_FIELD_WORDS = { name: 'Your name', email: 'Your email', business: 'Your business' } as const;
export const OPTIONAL_WORDS = '(optional)';
export const YES_WORDS = 'Yes';
export const NO_WORDS = 'No';
export const SEND_WORDS = 'Send';
export const SENDING_WORDS = 'Sending…';
export const sentWords = (title: string): string => `Sent. ${title} has it.`;
export const SEND_FAILED_PREFIX_WORDS = 'Not sent — ';
export const sendFailedWords = (words: string): string => `${SEND_FAILED_PREFIX_WORDS}${words}`;
export const goesToWords = (title: string): string => `Goes straight to ${title}. Nothing else is done with it.`;
export const FORM_BY_WORDS = 'Form by Temple Stuart';
/** The honeypot's label — a human never sees it (WorkWithMeForm.tsx:371-380's idiom). */
export const HONEYPOT_LABEL_WORDS = 'Website';

// ── THE TABLE (forms.ts submissionsTable, CrmSection.tsx) ─────────────────────

export const FORM_SUBMISSIONS_TABLE_WORDS = 'Form submissions — every answer, as it came in';
/** The four fixed heads — the Contacts heads' own words (crmWords.ts). */
export const SUBMISSION_HEAD_WORDS = { came_in: CONTACT_HEAD_WORDS.came_in, name: CONTACT_HEAD_WORDS.name, email: CONTACT_HEAD_WORDS.email, business: CONTACT_HEAD_WORDS.business } as const;
export const NO_SUBMISSIONS_WORDS = 'No one has sent your form yet.';
export const NO_FORM_YET_WORDS = 'Make your intake form above — its submissions land here.';
/** A question the form holds today that this submission was never asked (added, or hidden then). */
export const NOT_ASKED_WORDS = 'not asked';
/** The last column: answers to questions the form no longer holds. */
export const REMOVED_HEAD_WORDS = 'Removed questions';

// ── THE ROUTES ───────────────────────────────────────────────────────────────

/** POST /api/f/<slug> with no form at that slug (and the page's 404). */
export const NOT_FOUND_WORDS = 'Not found';
