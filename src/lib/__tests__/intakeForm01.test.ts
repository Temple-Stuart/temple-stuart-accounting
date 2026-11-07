/**
 * CRM-02 (Alex, 2026-11-07) — EVERY ACCOUNT'S OWN INTAKE FORM, at its own public link (/f/<slug>) and as an embed on
 * their own site; a submission is frozen as it came in and fills THAT account's CRM alone.
 *
 * THE HARD GATE, RULED (CLOSED 1): one public page prefix and one public writer — the proposal route's guards in the
 * proposal route's order; the ownership law's PUBLIC_WRITERS gains its 13th entry, pinned. CLOSED 2: one form per
 * account, the slug global. CLOSED 3: three fixed fields and up to twelve questions, the ids the server's. CLOSED 4: the
 * frozen snapshot, source 'form', key 'form:<id>', the PATCH proves the submission the caller's. CLOSED 5: no header
 * change. CLOSED 6: PARTIAL stays, the why and the customer sentence rewritten. CLOSED 7: the /crm order.
 *
 *   T1 the migration: the newest; both tables, every constraint by name, the widened source CHECK; authored, not applied;
 *   T2 forms.ts: the slug rule's edges; answersOf's refusals by name and the frozen snapshot; rekeyQuestions; the readers;
 *      the submissions table — a column per question the form holds, Yes / No, "not asked", the removed answers;
 *   T3 the two bodies (formWrites.ts) — the field on a miss, the slug rule in words;
 *   T4 the words — every one typed once, in formWords.ts, none in the three components;
 *   T5 contactsOf with a form row and its working row; the unused-working-row refusal for a form key; the fourth source;
 *   T6 the routes by code scan: the public POST's guard order by index; the PUT's gate and the ownership law's own judge
 *      (no list entry); the PATCH's form branch; the GET's two reads and its answer;
 *   T7 the middleware: '/f' and '/api/f' after '/api/proposals', each BY RULING; isPublic covers the form and nothing
 *      else; each prefix holds its one file; no header change;
 *   T8 the laws: GUEST_ROUTES' and PUBLIC_WRITERS' entries, SEC02_PINNED 13, the guest law's census sentence, the intake
 *      form law last — and the deck's by-number lines unmoved;
 *   T9 the registry row: PARTIAL, the why and customer verbatim, every re-cited line read back by number, zero line
 *      shift, the census unchanged; the deck's s08 agrees;
 *   T10 the section and the page: the block and the four tables in their order, the From words, the public form by kind,
 *       the embed, the honeypot, the words typed once;
 *   T11 the schema: both models, the users relations, the source comment, the client knows them; README unchanged.
 *
 * Source is read through code() and comments() only (the reader law). No clock: every instant is a fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  EMAIL_MAX, FORM_MAX_QUESTIONS, FORM_QUESTION_KINDS, FORM_SLUG_MAX, FORM_SLUG_MIN, FORM_SLUG_RE, LONG_MAX, SHORT_MAX, SUBMISSIONS_CSV, SUBMISSIONS_TABLE_NAME,
  answerWords, answersOf, askedQuestions, formKeyOf, frozenAnswersOf, intakeFormOf, isFormSlug, publicFormOf, questionsOf, rekeyQuestions, submissionsTable,
  type IntakeForm, type SubmissionRow,
} from '../crm/forms';
import { publicSubmissionBody, putFormBody } from '../crm/formWrites';
import { validationOf } from '../crm/contactWrites';
import {
  ADD_QUESTION_WORDS, COPIED_WORDS, COPY_FAILED_WORDS, COPY_WORDS, EMBED_WORDS, FIXED_FIELDS_NOTE_WORDS, FIXED_FIELD_WORDS, FORM_BY_WORDS, FORM_FIELD_LABELS,
  FORM_SUBMISSIONS_TABLE_WORDS, HONEYPOT_LABEL_WORDS, INTAKE_FORM_WORDS, KIND_WORDS, LINK_LABEL_WORDS, MOVE_DOWN_WORDS, MOVE_UP_WORDS, NOT_ASKED_WORDS, NOT_FOUND_WORDS,
  NO_FORM_YET_WORDS, NO_SUBMISSIONS_WORDS, NO_WORDS, OPEN_WORDS, OPTIONAL_WORDS, PREVIEW_WORDS, QUESTION_HEAD_WORDS, REMOVED_HEAD_WORDS, REMOVE_WORDS, SAVED_WORDS,
  SAVE_FORM_WORDS, SENDING_WORDS, SEND_FAILED_PREFIX_WORDS, SEND_WORDS, SLUG_CHANGE_WORDS, SLUG_RULE_WORDS, SLUG_TAKEN_WORDS, SUBMISSION_HEAD_WORDS, YES_WORDS,
  formSaveFailedWords, goesToWords, moveDownAriaWords, moveUpAriaWords, removeAriaWords, sendFailedWords, sentWords,
} from '../crm/formWords';
import { CONTACT_HEAD_WORDS, FROM_WORDS, LIST_JOIN, NO_CONTACTS_OWN_WORDS, PROPOSALS_OWNER_ONLY_WORDS, WRITE_FAILED_PREFIX_WORDS } from '../crm/crmWords';
import { CRM_SOURCES, CrmLawError, contactKeyOf, contactsOf, contactsTable, type ContactRow, type WorkingInput } from '../crm/crm';
import { BLANK } from '../budget/format';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { exportedMethods, handlerIdentity, inScope, judgeWrites } from '../security/ownershipLaw';
import { CrmTables, type CrmLoaded } from '@/components/crm/CrmSection';
import IntakeFormClient from '@/components/crm/IntakeFormClient';

Object.assign(globalThis, { React });

const MIGRATION_DIR = '20261107212000_crm_02_intake_forms';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;
const RULES = 'src/lib/crm/crm.ts';
const WORDS = 'src/lib/crm/formWords.ts';
const GET_ROUTE = 'src/app/api/crm/route.ts';
const CONTACTS_ROUTE = 'src/app/api/crm/contacts/route.ts';
const FORM_ROUTE = 'src/app/api/crm/form/route.ts';
const PUBLIC_ROUTE = 'src/app/api/f/[slug]/route.ts';
const PAGE = 'src/app/f/[slug]/page.tsx';
const CLIENT = 'src/components/crm/IntakeFormClient.tsx';
const SETUP = 'src/components/crm/IntakeFormSetup.tsx';
const SECTION = 'src/components/crm/CrmSection.tsx';
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const SCHEMA = 'prisma/schema.prisma';
const README = 'README.md';

const unescape = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const stops = (re: RegExp) => (e: unknown) => e instanceof CrmLawError && re.test(e.message);
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full.slice(process.cwd().length + 1)] : [];
  });
}

// ── FIXTURES ────────────────────────────────────────────────────────────────

const Q1 = { id: 'q-1', label: 'How many units do you manage?', kind: 'short', required: true, shown: true } as const;
const Q2 = { id: 'q-2', label: 'Tell me about the business', kind: 'long', required: false, shown: true } as const;
const Q3 = { id: 'q-3', label: 'Do you file 1099s?', kind: 'yesno', required: true, shown: true } as const;
const Q4 = { id: 'q-4', label: "Your accountant's email", kind: 'email', required: false, shown: false } as const;
const FORM: IntakeForm = { id: 'f-1', slug: 'acme-intake', title: 'Work with Acme', line: 'Tell us what you need.', questions: [Q1, Q2, Q3, Q4] };
const SUB: SubmissionRow = {
  key: 'form:s-1', came_in: '2026-11-07T10:00:00.000Z', name: 'Ada Lovelace', email: 'ada@example.com', business: null,
  answers: [
    { id: 'q-1', label: Q1.label, kind: 'short', required: true, value: '12' },
    { id: 'q-3', label: Q3.label, kind: 'yesno', required: true, value: false },
    { id: 'q-old', label: 'Old question', kind: 'short', required: false, value: 'kept' },
    { id: 'q-2', label: Q2.label, kind: 'long', required: false, value: '' },
  ],
};
const loaded = (o: Partial<CrmLoaded>): CrmLoaded => ({ kind: 'loaded', ownerOnly: true, contacts: [], form: null, submissions: [], proposals: [], signups: [], said: [], ...o });
const renderTables = (read: CrmLoaded) => unescape(renderToStaticMarkup(React.createElement(CrmTables, { read, onWritten: () => undefined })));

// ── T1 · THE MIGRATION ──────────────────────────────────────────────────────

test('T1 the migration: the newest; crm_forms and crm_form_submissions with every constraint by name; crm_contacts_source_chk widened to four words; authored, not applied', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261106150000_crm_01a_crm_contacts', 'right after CRM-01a\'s');
  const sql = code(MIGRATION);
  for (const name of [
    'crm_forms_pkey', 'crm_forms_user_id_key', 'crm_forms_slug_key', 'crm_forms_slug_chk', 'crm_forms_title_chk', 'crm_forms_line_chk', 'crm_forms_questions_chk', 'crm_forms_user_id_fkey',
    'crm_form_submissions_pkey', 'crm_form_submissions_name_chk', 'crm_form_submissions_email_chk', 'crm_form_submissions_answers_chk', 'crm_form_submissions_form_id_fkey',
    'crm_form_submissions_user_id_fkey', 'crm_form_submissions_user_created_idx', 'crm_form_submissions_form_id_idx',
  ]) assert.ok(sql.includes(`"${name}"`), name);
  assert.match(sql, /CREATE TABLE "crm_forms" \(\n\s+"id"\s+UUID NOT NULL DEFAULT gen_random_uuid\(\),\n\s+"user_id"\s+TEXT NOT NULL,\n\s+"slug"\s+VARCHAR\(40\) NOT NULL,\n\s+"title"\s+VARCHAR\(120\) NOT NULL,\n\s+"line"\s+VARCHAR\(500\),\n\s+"questions"\s+JSONB NOT NULL DEFAULT '\[\]'::jsonb,\n\s+"created_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT now\(\),\n\s+"updated_at"\s+TIMESTAMPTZ\(6\) NOT NULL,/);
  assert.match(sql, /CONSTRAINT "crm_forms_user_id_key" UNIQUE \("user_id"\)/, 'one form per account (CLOSED 2)');
  assert.match(sql, /CONSTRAINT "crm_forms_slug_key" UNIQUE \("slug"\)/, 'the slug is global');
  assert.match(sql, /CONSTRAINT "crm_forms_slug_chk" CHECK \("slug" ~ '\^\[a-z0-9\]\(\[a-z0-9-\]\{1,38\}\[a-z0-9\]\)\?\$' AND length\("slug"\) >= 3\)/);
  assert.match(sql, /CONSTRAINT "crm_forms_title_chk" CHECK \(btrim\("title"\) <> ''\)/);
  assert.match(sql, /CONSTRAINT "crm_forms_line_chk" CHECK \("line" IS NULL OR btrim\("line"\) <> ''\)/);
  assert.match(sql, /CONSTRAINT "crm_forms_questions_chk" CHECK \(jsonb_typeof\("questions"\) = 'array' AND jsonb_array_length\("questions"\) <= 12\)/);
  assert.match(sql, /CREATE TABLE "crm_form_submissions" \(\n\s+"id"\s+UUID NOT NULL DEFAULT gen_random_uuid\(\),\n\s+"form_id"\s+UUID NOT NULL,\n\s+"user_id"\s+TEXT NOT NULL,\n\s+"name"\s+VARCHAR\(255\) NOT NULL,\n\s+"email"\s+VARCHAR\(255\) NOT NULL,\n\s+"business"\s+TEXT,\n\s+"answers"\s+JSONB NOT NULL,\n\s+"created_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT now\(\),/);
  assert.match(sql, /CONSTRAINT "crm_form_submissions_answers_chk" CHECK \(jsonb_typeof\("answers"\) = 'array'\)/);
  assert.match(sql, /ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  assert.match(sql, /ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_form_id_fkey" FOREIGN KEY \("form_id"\) REFERENCES "crm_forms"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/, 'nothing is deleted under a submission');
  assert.match(sql, /ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  assert.match(sql, /CREATE INDEX "crm_form_submissions_user_created_idx" ON "crm_form_submissions" \("user_id", "created_at"\);\nCREATE INDEX "crm_form_submissions_form_id_idx" ON "crm_form_submissions" \("form_id"\);/);
  assert.match(sql, /ALTER TABLE "crm_contacts" DROP CONSTRAINT "crm_contacts_source_chk";\nALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_source_chk" CHECK \("source" IN \('proposal', 'signup', 'manual', 'form'\)\);/, 'the fourth source word');
  assert.equal((sql.match(/CHECK \(/g) ?? []).length, 8, 'seven CHECKs on the two tables, and the widened one');
  assert.equal((sql.match(/^(CREATE|ALTER) /gm) ?? []).length, 9, 'two tables, three keys, two indexes, one CHECK dropped and re-made — nothing else');
  assert.doesNotMatch(sql, /\bINSERT INTO\b|^\s*UPDATE\s|\bDELETE FROM\b|\bDROP TABLE\b|\bDROP COLUMN\b|\bTRUNCATE\b|ADD VALUE/m, 'no row written, no table or column dropped, no enum touched');
  assert.match(comments(MIGRATION).replace(/\n--\s*/g, ' '), /AUTHORED, NOT APPLIED to any shared database\. Claude Code cannot reach Azure Postgres\. It applies at the production deploy after the merge/);
  assert.equal(FORM_SLUG_RE.source, '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$', 'the migration\'s pattern and the code\'s are one');
});

// ── T2 · THE RULES (forms.ts) ───────────────────────────────────────────────

test('T2 forms.ts: the slug rule\'s edges; answersOf refuses by name and freezes the questions as asked; rekeyQuestions keeps and mints ids; the readers name a bad shape; the table', () => {
  // the slug (CLOSED 2): 3–40, lowercase letters, digits and hyphens, starting and ending with a letter or digit; never trimmed
  assert.equal(isFormSlug('ab'), false);
  assert.equal(isFormSlug('a-b'), true);
  assert.equal(isFormSlug('A-b'), false);
  assert.equal(isFormSlug('a'.repeat(41)), false);
  assert.equal(isFormSlug('a'.repeat(40)), true);
  assert.equal(isFormSlug('-ab'), false);
  assert.equal(isFormSlug('ab-'), false);
  assert.equal(isFormSlug('a b'), false);
  assert.equal(isFormSlug(' abc'), false);
  assert.equal(isFormSlug('acme-intake'), true);
  assert.equal(FORM_SLUG_RE.test('a'), true, 'the pattern alone allows one character — the CHECK\'s length >= 3 is isFormSlug\'s second half');
  assert.equal(isFormSlug('a'), false);
  assert.deepEqual([SHORT_MAX, LONG_MAX, EMAIL_MAX, FORM_MAX_QUESTIONS, FORM_SLUG_MIN, FORM_SLUG_MAX], [500, 5000, 255, 12, 3, 40]);
  assert.deepEqual([...FORM_QUESTION_KINDS], ['short', 'long', 'email', 'yesno']);

  // answersOf (CLOSED 4): the frozen snapshot — every question ASKED, in order, id · label · kind · required · value
  assert.deepEqual(answersOf(FORM, { answers: { 'q-1': ' 12 ', 'q-3': true } }), [
    { id: 'q-1', label: Q1.label, kind: 'short', required: true, value: '12' },
    { id: 'q-2', label: Q2.label, kind: 'long', required: false, value: '' },
    { id: 'q-3', label: Q3.label, kind: 'yesno', required: true, value: true },
  ], 'the hidden one absent; text trimmed; a blank optional one frozen as ""');
  assert.equal(answersOf(FORM, { answers: { 'q-1': '1', 'q-3': false } })[2].value, false, 'No is false, kept');
  assert.throws(() => answersOf(FORM, { answers: { 'q-3': true } }), stops(/^answersOf: "How many units do you manage\?" is required$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': '12' } }), stops(/^answersOf: "Do you file 1099s\?" is required — Yes or No$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': '12', 'q-3': true, 'q-9': 'x' } }), stops(/^answersOf: "q-9" is not a question of this form$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': '12', 'q-3': true, 'q-4': 'a@b.co' } }), stops(/^answersOf: "Your accountant's email" is not asked — the form hides it$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': '12', 'q-3': 'yes' } }), stops(/^answersOf: "Do you file 1099s\?" takes Yes or No$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': true, 'q-3': true } }), stops(/^answersOf: "How many units do you manage\?" takes words, not Yes or No$/));
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': '12', 'q-3': true, 'q-2': 'x'.repeat(5001) } }), stops(/^answersOf: "Tell me about the business" is longer than 5000 characters$/));
  assert.equal(answersOf(FORM, { answers: { 'q-1': '12', 'q-3': true, 'q-2': 'x'.repeat(5000) } })[1].value.toString().length, 5000);
  assert.throws(() => answersOf(FORM, { answers: { 'q-1': 'x'.repeat(501), 'q-3': true } }), stops(/is longer than 500 characters$/));
  const withEmail: IntakeForm = { ...FORM, questions: [{ ...Q4, shown: true }] };
  assert.throws(() => answersOf(withEmail, { answers: { 'q-4': 'nope' } }), stops(/^answersOf: "Your accountant's email" is not an email address$/));
  assert.throws(() => answersOf(withEmail, { answers: { 'q-4': `${'x'.repeat(250)}@example.com` } }), stops(/is longer than 255 characters$/));
  assert.equal(answersOf(withEmail, { answers: { 'q-4': 'cpa@example.com' } })[0].value, 'cpa@example.com');
  assert.equal(answersOf(withEmail, { answers: {} })[0].value, '', 'an optional email left blank');
  assert.deepEqual(answersOf({ questions: [] }, { answers: {} }), [], 'a form with no questions freezes nothing but the fixed three (the row\'s own columns)');

  // askedQuestions / publicFormOf: the hidden one never leaves the server
  assert.deepEqual(askedQuestions(FORM).map((q) => q.id), ['q-1', 'q-2', 'q-3']);
  assert.deepEqual(publicFormOf(FORM), { slug: 'acme-intake', title: 'Work with Acme', line: 'Tell us what you need.', questions: [Q1, Q2, Q3] });
  assert.ok(!('id' in publicFormOf(FORM)), 'no id, no owner');

  // rekeyQuestions (CLOSED 3): a kept id, a minted id, an unknown id refused, a duplicate refused, the minter checked, the count
  let n = 0;
  const mint = () => `m-${(n += 1)}`;
  assert.deepEqual(rekeyQuestions(FORM.questions, [{ id: 'q-3', label: 'Still', kind: 'yesno', required: false, shown: true }, { label: 'New', kind: 'short', required: true, shown: true }], mint), [
    { id: 'q-3', label: 'Still', kind: 'yesno', required: false, shown: true },
    { id: 'm-1', label: 'New', kind: 'short', required: true, shown: true },
  ]);
  assert.throws(() => rekeyQuestions(FORM.questions, [{ id: 'q-9', label: 'x', kind: 'short', required: false, shown: true }], mint), stops(/^rekeyQuestions: "q-9" is not a question this form holds — a question's id is the server's; leave it off a new question$/));
  assert.throws(() => rekeyQuestions(FORM.questions, [{ id: 'q-1', label: 'x', kind: 'short', required: false, shown: true }, { id: 'q-1', label: 'y', kind: 'short', required: false, shown: true }], mint), stops(/^rekeyQuestions: "q-1" is given twice — one question, one id$/));
  assert.throws(() => rekeyQuestions([], Array.from({ length: 13 }, () => ({ label: 'x', kind: 'short' as const, required: false, shown: true })), mint), stops(/^rekeyQuestions: 13 questions — at most 12$/));
  assert.throws(() => rekeyQuestions(FORM.questions, [{ label: 'x', kind: 'short', required: false, shown: true }], () => 'q-1'), stops(/^rekeyQuestions: the minter gave q-1, which is already a question's — refused$/));
  assert.deepEqual(rekeyQuestions([], [], mint), []);

  // the readers: a stored shape that contradicts itself is named, never smoothed
  assert.deepEqual(questionsOf([Q1, Q4]), [Q1, Q4]);
  assert.deepEqual(questionsOf([]), []);
  assert.throws(() => questionsOf('nope'), stops(/^questionsOf: crm_forms\.questions is not a list — a data error, reported$/));
  assert.throws(() => questionsOf([{ ...Q1, kind: 'date' }]), stops(/^questionsOf: question 1 has the kind "date" — not one of short, long, email, yesno$/));
  assert.throws(() => questionsOf([Q1, { ...Q2, id: 'q-1' }]), stops(/^questionsOf: two questions hold the id q-1 — a data error, reported$/));
  assert.throws(() => questionsOf([{ ...Q1, required: 'yes' }]), stops(/says required or shown in something other than true \/ false/));
  assert.throws(() => questionsOf([{ ...Q1, label: '' }]), stops(/question 1 has no label of 1 to 120 characters/));
  assert.throws(() => questionsOf(Array.from({ length: 13 }, (_, i) => ({ ...Q1, id: `q-${i}` }))), stops(/^questionsOf: the form holds 13 questions — at most 12 \(crm_forms_questions_chk\)$/));
  assert.deepEqual(frozenAnswersOf([{ id: 'q-1', label: 'L', kind: 'short', required: true, value: 'v' }], 's-1'), [{ id: 'q-1', label: 'L', kind: 'short', required: true, value: 'v' }]);
  assert.throws(() => frozenAnswersOf([{ id: 'q-1', label: 'L', kind: 'short', required: true, value: 7 }], 's-1'), stops(/^frozenAnswersOf: submission s-1: answer 1 \("L"\) holds a value that is neither words nor yes \/ no — a data error, reported$/));
  assert.throws(() => frozenAnswersOf({}, 's-1'), stops(/^frozenAnswersOf: submission s-1: answers is not a list — a data error, reported$/));
  assert.throws(() => frozenAnswersOf([{ id: 'q-1', label: 'L', kind: 'short', value: 'v' }], 's-1'), stops(/answer 1 is not \{ id, label, kind, required, value \}/));
  assert.deepEqual(intakeFormOf({ id: 'f-1', slug: 'acme-intake', title: 'Work with Acme', line: null, questions: [Q1] }), { id: 'f-1', slug: 'acme-intake', title: 'Work with Acme', line: null, questions: [Q1] });
  assert.equal(formKeyOf('s-1'), 'form:s-1');

  // the table: the four fixed columns, one per question the form holds today (shown or hidden), the removed answers last
  const cols = submissionsTable(FORM);
  assert.deepEqual(cols.map((c) => c.key), ['came_in', 'name', 'email', 'business', 'q:q-1', 'q:q-2', 'q:q-3', 'q:q-4', 'removed']);
  assert.deepEqual(cols.map((c) => c.label), ['Came in', 'Name', 'Email', 'Business', Q1.label, Q2.label, Q3.label, Q4.label, 'Removed questions']);
  assert.deepEqual(cols.map((c) => c.kind), ['value', 'value', 'value', 'text', 'value', 'text', 'value', 'value', 'text'], 'a long answer filters by contains-text');
  const cell = (key: string): string => { const c = cols.find((x) => x.key === key); assert.ok(c, key); return c.words(SUB); };
  const csv = (key: string): string => { const c = cols.find((x) => x.key === key); assert.ok(c, key); return c.csv(SUB); };
  assert.equal(cell('q:q-1'), '12');
  assert.equal(cell('q:q-3'), 'No');
  assert.equal(csv('q:q-3'), 'No');
  assert.equal(cell('q:q-2'), BLANK, 'asked and left blank — a blank cell, never a word');
  assert.equal(csv('q:q-2'), '');
  assert.equal(cell('q:q-4'), 'not asked', 'a question this submission was never asked');
  assert.equal(cell('removed'), 'Old question: kept');
  assert.equal(cell('business'), BLANK);
  assert.equal(cell('name'), 'Ada Lovelace');
  assert.equal(csv('came_in'), '2026-11-07T10:00:00.000Z', 'the instant, as stored');
  assert.deepEqual(submissionsTable(null).map((c) => c.key), ['came_in', 'name', 'email', 'business', 'removed'], 'no form yet: the four and the last');
  assert.equal(submissionsTable(null).find((c) => c.key === 'removed')!.words(SUB), [`${Q1.label}: 12`, `${Q3.label}: No`, 'Old question: kept', `${Q2.label}: `].join(LIST_JOIN));
  assert.equal(SUBMISSIONS_TABLE_NAME, 'crm-form-submissions');
  assert.equal(SUBMISSIONS_CSV, 'crm-form-submissions.csv');
  assert.equal(answerWords(true), 'Yes');
  assert.equal(answerWords(false), 'No');
  assert.equal(answerWords(''), null);
  assert.equal(answerWords('words'), 'words');
  assert.deepEqual(SUBMISSION_HEAD_WORDS, { came_in: CONTACT_HEAD_WORDS.came_in, name: CONTACT_HEAD_WORDS.name, email: CONTACT_HEAD_WORDS.email, business: CONTACT_HEAD_WORDS.business });
  // pure: no fetch, no env, no clock, no id minted
  const rules = code('src/lib/crm/forms.ts');
  assert.doesNotMatch(rules, /fetch\(|process\.env|new Date\(|Date\.now|randomUUID|from 'react'|@\/lib\/prisma/);
});

// ── T3 · THE BODIES (formWrites.ts) ─────────────────────────────────────────

test('T3 the two bodies: PUT { slug, title, line, questions } and the public { website?, name, email, business?, answers } — a miss names its field; the slug rule in words', () => {
  const field = (schema: typeof putFormBody | typeof publicSubmissionBody, body: unknown): string | null => {
    const p = schema.safeParse(body);
    return p.success ? null : validationOf(p.error).field;
  };
  const q = { label: 'Units', kind: 'short', required: true, shown: true };
  const put = { slug: 'acme-intake', title: 'Work with Acme', line: null, questions: [q] };
  assert.equal(field(putFormBody, put), null);
  assert.equal(field(putFormBody, { ...put, questions: [] }), null, 'the three fixed fields alone are a form');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, id: '0aa624f3-86e1-47c9-9bb4-3cee2e13e219' }] }), null, 'a server id rides along');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, id: 'q-1' }] }), 'questions.0.id', 'an id that is not a uuid');
  for (const slug of ['ab', 'A-b', 'a'.repeat(41), '-ab', 'ab-', ' acme ', 'acme intake', '']) assert.equal(field(putFormBody, { ...put, slug }), 'slug', `slug "${slug}"`);
  const miss = putFormBody.safeParse({ ...put, slug: 'ab' });
  assert.ok(!miss.success);
  assert.equal(validationOf(miss.error).message, SLUG_RULE_WORDS, 'the rule in words');
  assert.equal(field(putFormBody, { ...put, title: '  ' }), 'title');
  assert.equal(field(putFormBody, { ...put, title: 'x'.repeat(121) }), 'title');
  assert.equal(field(putFormBody, { ...put, line: 'x'.repeat(501) }), 'line');
  assert.equal(field(putFormBody, { ...put, line: 'A line' }), null);
  assert.equal(field(putFormBody, { ...put, line: undefined }), 'line', 'the line is sent, null or words');
  assert.equal(field(putFormBody, { ...put, questions: Array.from({ length: 13 }, () => q) }), 'questions');
  assert.equal(field(putFormBody, { ...put, questions: Array.from({ length: 12 }, () => q) }), null);
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, kind: 'date' }] }), 'questions.0.kind');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, label: '' }] }), 'questions.0.label');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, label: 'x'.repeat(121) }] }), 'questions.0.label');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, required: 'yes' }] }), 'questions.0.required');
  assert.equal(field(putFormBody, { ...put, questions: [{ ...q, extra: 1 }] }), 'questions.0', 'an unknown field on a question is refused');
  assert.equal(field(putFormBody, { ...put, user_id: 'x' }), 'body', 'nothing names the owner');
  assert.equal(field(putFormBody, { ...put, questions: undefined }), 'questions');
  const parsed = putFormBody.parse({ ...put, title: ' Work with Acme ', line: ' A line ', questions: [{ ...q, label: ' Units ' }] });
  assert.equal(parsed.title, 'Work with Acme');
  assert.equal(parsed.line, 'A line');
  assert.equal(parsed.questions[0].label, 'Units');
  // the public body — name and email the proposal form's shapes, business the contacts route's, answers a record
  const pub = { name: 'Ada', email: 'ada@example.com', answers: { 'q-1': '12', 'q-3': true } };
  assert.equal(field(publicSubmissionBody, pub), null);
  assert.equal(field(publicSubmissionBody, { ...pub, website: '' }), null, 'the honeypot rides, empty');
  assert.equal(field(publicSubmissionBody, { ...pub, business: 'x'.repeat(5000) }), null);
  assert.equal(field(publicSubmissionBody, { ...pub, answers: {} }), null, 'a form with no questions');
  assert.equal(field(publicSubmissionBody, { ...pub, name: ' ' }), 'name');
  assert.equal(field(publicSubmissionBody, { ...pub, name: 'x'.repeat(256) }), 'name');
  assert.equal(field(publicSubmissionBody, { ...pub, email: 'nope' }), 'email');
  assert.equal(field(publicSubmissionBody, { ...pub, business: 'x'.repeat(5001) }), 'business');
  assert.equal(field(publicSubmissionBody, { ...pub, answers: { 'q-1': 7 } }), 'answers.q-1');
  assert.equal(field(publicSubmissionBody, { ...pub, answers: [] }), 'answers');
  assert.equal(field(publicSubmissionBody, { ...pub, user_id: 'x' }), 'body', 'nothing names the owner — user_id is the form\'s');
  assert.equal(field(publicSubmissionBody, { ...pub, form_id: 'x' }), 'body');
  assert.deepEqual(publicSubmissionBody.parse({ ...pub, name: ' Ada ', email: ' ada@example.com ' }).name, 'Ada');
  assert.match(comments('src/lib/crm/formWrites.ts'), /COPIED from src\/app\/api\/proposals\/route\.ts:46-47/);
  const proposals = code('src/app/api/proposals/route.ts').split('\n');
  assert.match(proposals[45], /name: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(255\),/);
  assert.match(proposals[46], /email: z\.string\(\)\.trim\(\)\.email\(\)\.max\(255\),/);
});

// ── T4 · THE WORDS ──────────────────────────────────────────────────────────

test('T4 the words: every one of the block, the public page and the table, typed once in formWords.ts; the two crmWords lines rewritten', () => {
  assert.equal(INTAKE_FORM_WORDS, 'Your intake form');
  assert.equal(LINK_LABEL_WORDS, 'Your link');
  assert.deepEqual([COPY_WORDS, OPEN_WORDS, PREVIEW_WORDS, SAVE_FORM_WORDS], ['Copy', 'Open', 'Preview', 'Save the form']);
  assert.equal(SLUG_RULE_WORDS, 'The last part of your link: 3 to 40 characters — lowercase letters, digits and hyphens, starting and ending with a letter or digit.');
  assert.equal(SLUG_CHANGE_WORDS, 'Changing it breaks the old link.');
  assert.equal(SLUG_TAKEN_WORDS, 'That link is taken — pick another.');
  assert.deepEqual(FORM_FIELD_LABELS, { title: 'Title', slug: 'Your link ends with', line: 'A line under the title (optional)' });
  assert.equal(FIXED_FIELDS_NOTE_WORDS, 'Asked first on every form, always — not editable:');
  assert.deepEqual(FIXED_FIELD_WORDS, { name: 'Your name', email: 'Your email', business: 'Your business' });
  assert.deepEqual(Object.values(QUESTION_HEAD_WORDS), ['Order', 'Question', 'Kind', 'Required', 'Shown']);
  assert.deepEqual(KIND_WORDS, { short: 'Short answer', long: 'Long answer', email: 'Email', yesno: 'Yes / no' });
  assert.deepEqual(Object.keys(KIND_WORDS), [...FORM_QUESTION_KINDS], 'one word per kind, in order');
  assert.equal(ADD_QUESTION_WORDS, '+ add a question');
  assert.equal(REMOVE_WORDS, 'Remove');
  assert.deepEqual([MOVE_UP_WORDS, MOVE_DOWN_WORDS], ['↑', '↓']);
  assert.equal(moveUpAriaWords('Units'), 'Move "Units" up');
  assert.equal(moveDownAriaWords('Units'), 'Move "Units" down');
  assert.equal(removeAriaWords('Units'), 'Remove "Units"');
  assert.equal(EMBED_WORDS, 'Embed it on your site');
  assert.equal(SAVED_WORDS, 'Saved.');
  assert.equal(formSaveFailedWords('That link is taken — pick another.'), 'Not saved — That link is taken — pick another.');
  assert.equal(WRITE_FAILED_PREFIX_WORDS, 'Not saved — ');
  assert.equal(COPY_FAILED_WORDS, 'Could not copy — select it and copy by hand.');
  assert.equal(COPIED_WORDS, 'Copied.');
  assert.equal(OPTIONAL_WORDS, '(optional)');
  assert.deepEqual([YES_WORDS, NO_WORDS, SEND_WORDS, SENDING_WORDS], ['Yes', 'No', 'Send', 'Sending…']);
  assert.equal(sentWords('Work with Acme'), 'Sent. Work with Acme has it.');
  assert.equal(SEND_FAILED_PREFIX_WORDS, 'Not sent — ');
  assert.equal(sendFailedWords('Too many submissions — please try again later.'), 'Not sent — Too many submissions — please try again later.');
  assert.equal(goesToWords('Work with Acme'), 'Goes straight to Work with Acme. Nothing else is done with it.');
  assert.equal(FORM_BY_WORDS, 'Form by Temple Stuart');
  assert.equal(HONEYPOT_LABEL_WORDS, 'Website');
  assert.equal(FORM_SUBMISSIONS_TABLE_WORDS, 'Form submissions — every answer, as it came in');
  assert.equal(NO_SUBMISSIONS_WORDS, 'No one has sent your form yet.');
  assert.equal(NO_FORM_YET_WORDS, 'Make your intake form above — its submissions land here.');
  assert.equal(NOT_ASKED_WORDS, 'not asked');
  assert.equal(REMOVED_HEAD_WORDS, 'Removed questions');
  assert.equal(NOT_FOUND_WORDS, 'Not found');
  // crmWords: the From word, the non-owner's Contacts line, the Proposals line
  assert.equal(FROM_WORDS.form, 'Your form');
  assert.equal(NO_CONTACTS_OWN_WORDS, 'No one yet. Share your intake form (above) or add someone by hand.');
  assert.equal(PROPOSALS_OWNER_ONLY_WORDS, 'Proposals from templestuart.com go to the platform owner. Yours come in through your own form — the Form submissions table.');
  assert.doesNotMatch(code('src/lib/crm/crmWords.ts'), /comes in CRM-02|is not built yet \(CRM-02\)/, 'the two CRM-01b promises are kept, not repeated');
  // typed once: none of these in the three components or the rules
  for (const f of [SETUP, CLIENT, SECTION, RULES, 'src/lib/crm/forms.ts']) {
    const s = code(f);
    for (const literal of [
      'Your intake form', 'Save the form', 'Changing it breaks', 'That link is taken', '+ add a question', 'Embed it on your site', 'Form by Temple Stuart', 'No one has sent your form yet',
      'Make your intake form above', 'not asked', 'Removed questions', 'Goes straight to', 'Sent. ', 'Not sent', 'Short answer', 'Yes / no', 'Your business', 'Your name', 'Copied.',
      'Could not copy', 'Asked first on every form', 'Your link ends with', '(optional)', 'Not found',
    ]) {
      assert.ok(!s.includes(`'${literal}`) && !s.includes(`>${literal}`) && !s.includes(`\`${literal}`) && !s.includes(`"${literal}`), `"${literal}" is formWords', not typed in ${f}`);
    }
  }
  assert.doesNotMatch(code(WORDS), /fetch\(|process\.env|new Date\(|from 'react'/, 'pure');
});

// ── T5 · CONTACTS WITH A FORM ROW ───────────────────────────────────────────

test('T5 contactsOf: a submission is a Contacts row from "Your form" with its business and no need, budget or start; its working row on form:<id>; an unused form working row is refused; the fourth source', () => {
  const sub: SubmissionRow = { key: 'form:s-1', came_in: '2026-11-05T10:00:00.000Z', name: 'Ada Lovelace', email: 'ada@example.com', business: 'Analytical Engines', answers: [] };
  const w: WorkingInput = { id: 'w-1', source: 'form', source_ref: 's-1', name: null, business: null, email: null, stage: 'won', next_step: 'Invoice', last_touch_at: '2026-11-06T09:00:00.000Z', created_at: '2026-11-06T09:00:00.000Z' };
  const rows = contactsOf({ proposals: [], signups: [], submissions: [sub], working: [w], today: '2026-11-07' });
  assert.deepEqual(rows, [{
    key: 'form:s-1', came_in: '2026-11-05T10:00:00.000Z', name: 'Ada Lovelace', business: 'Analytical Engines', email: 'ada@example.com', from: 'form',
    need: null, budget: null, start: null, stage: 'won', next_step: 'Invoice', last_touch: '2026-11-06T09:00:00.000Z',
  }]);
  const columns = contactsTable();
  assert.equal(columns.find((c) => c.key === 'from')!.words(rows[0]), 'Your form');
  assert.equal(columns.find((c) => c.key === 'need')!.words(rows[0]), BLANK);
  const untouched = contactsOf({ proposals: [], signups: [], submissions: [sub], working: [], today: '2026-11-07' })[0];
  assert.deepEqual([untouched.stage, untouched.next_step, untouched.last_touch], ['new', null, null], 'no working row: new, nothing imputed');
  assert.throws(() => contactsOf({ proposals: [], signups: [], submissions: [], working: [w], today: '2026-11-07' }), stops(/^contactsOf: a working row names form:s-1, which the read did not return — a record that contradicts itself$/));
  assert.throws(() => contactsOf({ proposals: [], signups: [], submissions: [], working: [{ ...w, source: 'lead' }], today: '2026-11-07' }), stops(/^contactsOf: working row w-1 says source "lead" — not one of proposal, signup, manual, form$/));
  const two: SubmissionRow = { ...sub, key: 'form:s-2', came_in: '2026-11-06T10:00:00.000Z', name: 'Grace Hopper', email: 'grace@example.com', business: null };
  assert.deepEqual(contactsOf({ proposals: [], signups: [], submissions: [sub, two], working: [], today: '2026-11-07' }).map((r) => r.key), ['form:s-2', 'form:s-1'], 'newest first');
  assert.deepEqual(contactKeyOf('form:0aa624f3-86e1-47c9-9bb4-3cee2e13e219'), { source: 'form', ref: '0aa624f3-86e1-47c9-9bb4-3cee2e13e219' });
  assert.deepEqual([...CRM_SOURCES], ['proposal', 'signup', 'manual', 'form']);
  assert.deepEqual(FROM_WORDS, { proposal: 'Proposal', signup: 'Signup', manual: 'By hand', form: 'Your form' });
  assert.match(comments(RULES), /'form:<submission id>' \(CRM-02\)/, 'the key comment names the fourth shape');
  assert.match(code(RULES), /\.\.\.input\.submissions\.map\(\(s\): ContactRow => \(\{\n\s*key: s\.key, came_in: s\.came_in, name: s\.name, business: s\.business, email: s\.email, from: 'form',\n\s*need: null, budget: null, start: null, \.\.\.working\(s\.key\),/);
});

// ── T6 · THE ROUTES, BY CODE SCAN ───────────────────────────────────────────

test('T6 the routes: the public POST in CLOSED 1\'s order by index, one insert for the form owner, nothing of the account; the PUT behind the gate, judged by the ownership law with no list entry; the PATCH\'s form branch; the GET\'s two reads and its answer', () => {
  const r = code(PUBLIC_ROUTE);
  const at = (s: string) => { const i = r.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const order = [
    'const secret = process.env.JWT_SECRET;',
    'body = await request.json();',
    "?.['website']",
    'await rateLimit(`form:${ipHash}`, { limit: 5, windowSeconds: 3600 })',
    'const { slug } = await params;',
    'if (!isFormSlug(slug)) return notFound();',
    'prisma.crm_forms.findUnique({ where: { slug }',
    'publicSubmissionBody.safeParse(body)',
    'answersOf(form, d)',
    'prisma.crm_form_submissions.create({',
  ].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'JWT_SECRET → JSON → honeypot → rate limit → the form by slug → zod → the frozen answers → the one insert');
  assert.equal(r.indexOf('prisma.'), at('prisma.crm_forms.findUnique({ where: { slug }'), 'no read before the rate limit');
  assert.match(r, /if \(typeof website === 'string' && website\.trim\(\) !== ''\) \{\n\s*return NextResponse\.json\(\{ ok: true \}\);/, 'the silent drop BY RULING');
  assert.match(r, /const ipHash = createHmac\('sha256', secret\)\.update\(ip\)\.digest\('hex'\);/, 'the IP hashed, never stored');
  assert.match(r, /\{ status: 429, headers: \{ 'Retry-After': String\(error\.retryAfterSeconds\) \} \}/);
  assert.match(r, /if \(!row\) return notFound\(\);/);
  assert.match(r, /const notFound = \(\) => NextResponse\.json\(\{ error: NOT_FOUND_WORDS \}, \{ status: 404 \}\);/);
  assert.match(r, /return NextResponse\.json\(validationOf\(parsed\.error\), \{ status: 400 \}\);/);
  assert.match(r, /return NextResponse\.json\(\{ error: 'Validation', field: 'answers', message: error\.message \}, \{ status: 400 \}\);/);
  assert.match(r, /data: \{ form_id: row\.id, user_id: row\.user_id, name: d\.name, email: d\.email, business, answers: answers as unknown as Prisma\.InputJsonValue \},/, 'user_id is the form owner\'s, never the sender\'s');
  assert.equal((r.match(/\b(?:prisma|tx)\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? []).length, 1, 'the one insert (the HMAC\'s .update() is not a write)');
  assert.match(r, /return NextResponse\.json\(\{ ok: true \}\);\n  \} catch/, 'answers nothing of the row');
  assert.doesNotMatch(r, /ipHash: |ip_hash: /, 'the IP hash is the rate limiter\'s key only — the submission does not keep it');
  assert.doesNotMatch(r, /cookie-auth|getVerifiedEmail|getCurrentUser|requireAdmin|stripe|liteapi|duffel|plaid|anthropic|openai|resend|sendgrid|fetch\(/i);
  assert.match(r, /export const dynamic = 'force-dynamic';/);
  assert.deepEqual(exportedMethods(r).map((m) => m.method), ['POST']);
  assert.ok(inScope(r), 'in the ownership law\'s scope: POST and a write — a listed public writer (T8)');
  assert.deepEqual(judgeWrites(r), [], 'an insert has no WHERE to judge');
  assert.match(comments(PUBLIC_ROUTE), /PUBLIC BY RULING \(CLOSED 1/);

  // the PUT: the GET's gate, one transaction, the update WHERE { id, user_id }, the create with user_id, 409 on the slug, 400 on the questions
  const p = code(FORM_ROUTE);
  const pat = (s: string) => { const i = p.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const porder = [
    'export async function PUT(request: Request) {',
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    'await request.json()',
    'putFormBody.safeParse(json)',
    'await prisma.$transaction(async (tx) => {',
    'tx.crm_forms.findUnique({ where: { user_id: user.id }',
    'rekeyQuestions(',
    'tx.crm_forms.update({ where: { id: found.id, user_id: user.id }',
    'tx.crm_forms.create({ data: { user_id: user.id, ...data }',
  ].map(pat);
  assert.deepEqual(porder, [...porder].sort((a, b) => a - b), 'the cookie, the user, the body, then the one transaction');
  assert.equal(p.indexOf('prisma.'), pat('prisma.users.findFirst('), 'no read before the user');
  assert.match(p, /return NextResponse\.json\(validationOf\(parsed\.error\), \{ status: 400 \}\);/);
  assert.match(p, /if \(error instanceof QuestionsRefused\) return NextResponse\.json\(\{ error: 'Validation', field: 'questions', message: error\.message \}, \{ status: 400 \}\);/);
  assert.match(p, /if \(isSlugTaken\(error\)\) return NextResponse\.json\(\{ error: 'Conflict', field: 'slug', message: SLUG_TAKEN_WORDS \}, \{ status: 409 \}\);/);
  assert.match(p, /error\.code === 'P2002'/);
  assert.match(p, /\(error\.meta\.target as unknown\[\]\)\.includes\('slug'\)/, 'the slug\'s key, not any unique');
  assert.match(p, /rekeyQuestions\(found === null \? \[\] : questionsOf\(found\.questions\), d\.questions, randomUUID\)/, 'the ids are the server\'s');
  assert.match(p, /const line = d\.line === null \|\| d\.line === '' \? null : d\.line;/);
  assert.equal((p.match(/new Date\(\)/g) ?? []).length, 1, 'the server\'s instant, once');
  assert.doesNotMatch(p, /updated_at: d\.|json\.updated|id: d\.|slug: json|status: 403/);
  assert.doesNotMatch(p, /stripe|liteapi|anthropic|openai|resend|sendgrid|fetch\(/i);
  assert.match(p, /export const dynamic = 'force-dynamic';/);
  assert.deepEqual(exportedMethods(p).map((m) => m.method), ['PUT']);
  assert.ok(inScope(p));
  for (const h of handlerIdentity(p)) assert.ok(h.identityAt !== null && (h.firstWriteAt === null || h.identityAt < h.firstWriteAt), `${h.method} proves who is asking first`);
  const judged = judgeWrites(p);
  assert.equal(judged.length, 1, 'one WHERE write: the update');
  for (const v of judged) assert.ok(v.ok && v.how === 'caller', `${v.site.model}.${v.site.op}:${v.site.line} names the caller in its WHERE`);
  // no allowlist entry for the PUT: the law names the file once, as the intake form law's IF_FORM_ROUTE (the registry must cite it) — never in a table
  assert.equal((code(LAW).match(/api\/crm\/form/g) ?? []).length, 1, 'named once in the law');
  assert.match(code(LAW), /const IF_FORM_ROUTE = 'src\/app\/api\/crm\/form\/route\.ts';/);
  assert.doesNotMatch(code(LAW), /\{ file: 'src\/app\/api\/crm\/form\/route\.ts'/, 'no allowlist entry for the PUT');
  assert.doesNotMatch(code(MIDDLEWARE), /'\/api\/crm/, 'not public');
  assert.match(comments(FORM_ROUTE), /THE OWNERSHIP LAW \(SEC-02\): every write carries user_id = the caller's/);

  // the PATCH's form branch (CLOSED 4): the submission read by { id, user_id } → 404, never 403; then the partial-key pair as before
  const c = code(CONTACTS_ROUTE);
  assert.match(c, /if \(named\.source === 'form'\) \{\n\s*if \(!isValidUuid\(named\.ref\)\) return notFound\(\);\n\s*const submission = await prisma\.crm_form_submissions\.findFirst\(\{ where: \{ id: named\.ref, user_id: user\.id \}, select: \{ id: true \} \}\);\n\s*if \(!submission\) return notFound\(\);\n\s*\} else \{\n\s*if \(!owner\) return notFound\(\);/);
  assert.ok(c.indexOf("if (named.source === 'form')") > c.indexOf("if (named.source === 'manual')") && c.indexOf("if (named.source === 'form')") < c.indexOf('await prisma.$transaction(async (tx) => {'), 'after the manual branch, before the transaction');
  assert.doesNotMatch(c, /status: 403/);
  assert.equal(judgeWrites(c).filter((v) => !v.ok).length, 0);
  assert.match(comments(CONTACTS_ROUTE), /'form:<submission id>' — CRM-02 \(Alex, 2026-11-07, CLOSED 4\)/);

  // the GET: the form and its submissions beside the working rows, the caller's alone; the answer
  const g = code(GET_ROUTE);
  const gat = (s: string) => { const i = g.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const gorder = [
    'const workingRows = await prisma.crm_contacts.findMany({',
    'prisma.crm_forms.findUnique({ where: { user_id: user.id }',
    'prisma.crm_form_submissions.findMany({',
    'if (owner) {',
  ].map(gat);
  assert.deepEqual(gorder, [...gorder].sort((a, b) => a - b));
  assert.match(g, /prisma\.crm_form_submissions\.findMany\(\{\n\s*where: \{ user_id: user\.id \},\n\s*orderBy: \{ created_at: 'desc' \},\n\s*select: \{ id: true, created_at: true, name: true, email: true, business: true, answers: true \},/);
  assert.match(g, /const form: IntakeForm \| null = formRow === null \? null : intakeFormOf\(formRow\);/);
  assert.match(g, /const submissions: SubmissionRow\[\] = submissionRows\.map\(\(s\) => submissionRowOf\(\{ \.\.\.s, created_at: s\.created_at\.toISOString\(\) \}\)\);/);
  assert.match(g, /const contacts = contactsOf\(\{ proposals, signups, submissions, working, today \}\);/);
  assert.match(g, /return NextResponse\.json\(\{ ownerOnly: !owner, contacts, form, submissions, proposals, signups, said: \[\] as string\[\] \}\);/);
  assert.doesNotMatch(g, /crm_forms\.findMany|crm_form_submissions\.findFirst|form_id: /, 'by the caller, never by a form id the client could name');
});

// ── T7 · THE MIDDLEWARE ─────────────────────────────────────────────────────

test('T7 the middleware: \'/f\' and \'/api/f\' after \'/api/proposals\', each BY RULING; isPublic covers the form and nothing else; each prefix holds its one file; no header change (CLOSED 5)', () => {
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(list, 'PUBLIC_PATHS is declared');
  const paths = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const i = paths.indexOf('/api/proposals');
  assert.deepEqual(paths.slice(i, i + 3), ['/api/proposals', '/f', '/api/f'], 'after the proposals route');
  assert.equal(paths[paths.length - 1], '/my-trip', 'the trip posts stay last (tripPost01)');
  assert.match(mw, /return PUBLIC_PATHS\.some\(p => pathname === p \|\| pathname\.startsWith\(p \+ '\/'\)\);/, "isPublic's rule: p or p + '/'");
  const isPublic = (pathname: string) => paths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  for (const yes of ['/f/acme-intake', '/f/acme-intake/', '/api/f/acme-intake', '/f', '/api/f']) assert.equal(isPublic(yes), true, yes);
  for (const no of ['/form', '/fx', '/forms/x', '/api/form', '/api/fx', '/crm', '/api/crm', '/api/crm/form', '/api/crm/contacts']) assert.equal(isPublic(no), false, no);
  assert.equal(isPublic('/favicon.ico'), true, 'its own entry, above — not /f\'s');
  assert.equal(paths.filter((p) => p === '/f' || p.startsWith('/f/')).length, 1);
  assert.equal(paths.filter((p) => p === '/api/f' || p.startsWith('/api/f/')).length, 1);
  const notes = comments(MIDDLEWARE);
  assert.equal((notes.match(/CRM-02 \(Alex, 2026-11-07\): public BY RULING/g) ?? []).length, 2, 'two entries, two reasons');
  assert.match(notes, /The only file under src\/app\/f is \[slug\]\/page\.tsx/);
  assert.match(notes, /The only file under src\/app\/api\/f is \[slug\]\/route\.ts/);
  assert.deepEqual(sourceFiles(resolve(process.cwd(), 'src/app/f')), ['src/app/f/[slug]/page.tsx']);
  assert.deepEqual(sourceFiles(resolve(process.cwd(), 'src/app/api/f')), ['src/app/api/f/[slug]/route.ts']);
  assert.ok(existsSync(resolve(process.cwd(), CLIENT)), 'the client half sits beside the CRM\'s components');
  assert.ok(!readdirSync(resolve(process.cwd(), 'src/app')).some((d) => d !== 'f' && d !== 'favicon.ico' && d.startsWith('f')), 'nothing else under src/app starts with f');
  // CLOSED 5: the embed works with no header change
  assert.doesNotMatch(code('next.config.ts'), /frame-ancestors|X-Frame-Options/i);
  assert.doesNotMatch(mw, /frame-ancestors|X-Frame-Options/i);
});

// ── T8 · THE LAWS ───────────────────────────────────────────────────────────

test('T8 the laws: GUEST_ROUTES doors the page on :225; PUBLIC_WRITERS\' 13th entry after the proposals one with the two guards; SEC02_PINNED 13; the guest law\'s census sentence; the intake form law last; the deck\'s by-number lines unmoved', () => {
  const law = code(LAW);
  const lawLines = law.split('\n');
  assert.ok(lawLines[224].includes("{ route: '/work-with-me', why:") && lawLines[224].includes("{ route: '/f/[slug]', why: 'CRM-02 (2026-11-07): a customer\\u2019s own intake form — its door is the link on /crm (IntakeFormSetup.tsx), PUBLIC_PATHS' },"), 'on :225, TRIPPOST-01\'s way (the apostrophe as \\u2019 — the file\'s own idiom; an escaped quote there would unpair the activity law\'s string blanking)');
  assert.match(comments(LAW), /CRM-02 \(2026-11-07\): on this line, TRIPPOST-01's way — a new line here would move every line of this file the deck cites by number/);
  assert.match(lawLines[482], /ownTableLaw/, ':483 — the deck\'s s08 citation holds');
  assert.match(lawLines[741], /enumValues/, ':742 — the deck\'s s04 citation holds');
  const writers = /const PUBLIC_WRITERS: ReadonlyArray<[^\n]*= \[([\s\S]*?)\n\];/.exec(law);
  assert.ok(writers, 'PUBLIC_WRITERS is found');
  const files = [...writers[1].matchAll(/\{ file: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(files.length, 13, 'the census: 13');
  assert.equal(files[1], 'src/app/api/proposals/route.ts');
  assert.equal(files[2], 'src/app/api/f/[slug]/route.ts', 'after the proposals entry');
  assert.ok(law.includes("{ file: 'src/app/api/f/[slug]/route.ts', kind: 'public', reason: 'CRM-02 (Alex, 2026-11-07): public BY RULING — a DB write only, no paid call; the form owner\\u2019s own submissions', guards: [{ name: 'honeypot', re: /\\['website'\\]/ }, { name: 'per-ip_hash rate limit 5/hour', re: /await rateLimit\\(`form:\\$\\{ipHash\\}`, \\{ limit: 5, windowSeconds: 3600 \\}\\)/ }] },"), 'the entry, its reason and its two guards');
  // the two guards hold on the route, read by the law's own regexes
  for (const guard of [/\['website'\]/, /await rateLimit\(`form:\$\{ipHash\}`, \{ limit: 5, windowSeconds: 3600 \}\)/]) assert.match(code(PUBLIC_ROUTE), guard);
  assert.match(law, /const SEC02_PINNED = \{ publicWriters: 13, ownerConsole: 4, sharedRows: 1, derivedOwned: 4, helperPreconditions: 1, gatedFlows: 1, gatedCallers: 2 \} as const;/);
  assert.match(comments(LAW), /CRM-02 \(Alex, 2026-11-07\): publicWriters 12 → 13 — the intake form's POST \(src\/app\/api\/f\/\[slug\]\/route\.ts\), public BY RULING with the proposal route's guards in the proposal route's order/);
  assert.match(law, /if \(PUBLIC_WRITERS\.length !== SEC02_PINNED\.publicWriters \|\| SEC02_PINNED\.publicWriters !== 13\) guestFail\(`the ownership law’s public writers are \$\{PUBLIC_WRITERS\.length\} \(pinned \$\{SEC02_PINNED\.publicWriters\}\) — the census is 13: GUEST-01’s 11, the guest’s cancel, and CRM-02’s form POST`\);/);
  assert.doesNotMatch(law, /publicWriters !== 12\)/);
  const guards = [...law.matchAll(/^lawGuard\('([^']+)'/gm)].map((m) => m[1]);
  assert.equal(guards[guards.length - 1], 'The intake form law', 'at the END');
  assert.ok(law.indexOf("lawGuard('The intake form law'") < law.indexOf('if (violations.length > raised) {'), 'before the second gate');
  for (const must of [
    "const IF_PAGE = 'src/app/f/[slug]/page.tsx';", "const IF_CLIENT = 'src/components/crm/IntakeFormClient.tsx';", "const IF_ROUTE = 'src/app/api/f/[slug]/route.ts';", "const IF_FORM_ROUTE = 'src/app/api/crm/form/route.ts';",
    "for (const p of ['/f', '/api/f'])", 'if (!/BY RULING/.test(block) || !/CRM-02/.test(block))', "ifRoute.indexOf(\"['website']\")", "ifRoute.indexOf('prisma.crm_form_submissions.create({')",
    "for (const model of ['crm_forms', 'crm_form_submissions'])", 'if (!ifCrm.citation.includes(f))', 'cookie-auth|getVerifiedEmail|getCurrentUser|requireAdmin', "p.route !== '/f/[slug]' && (p.route === '/f' || p.route.startsWith('/f/'))",
  ]) assert.ok(law.includes(must), must);
  assert.match(comments(LAW), /THE INTAKE FORM LAW \(CRM-02, Alex, 2026-11-07\)/);
});

// ── T9 · THE REGISTRY ───────────────────────────────────────────────────────

test('T9 the registry row: PARTIAL with four beats (CLOSED 6), the why and the customer sentence verbatim, every re-cited line read back by number, zero line shift, the census unchanged; the deck\'s s08 agrees', () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'CRM');
  assert.ok(t);
  assert.equal(t.status, 'PARTIAL', 'four beats never imply LIVE (TRUTH-01)');
  assert.deepEqual(t.beats, { discover: true, decide: true, commit: true, record: true });
  assert.equal(t.home, '/crm');
  assert.equal(t.ownTable, 'crm_contacts');
  assert.equal(t.why, "the people you sell to: every proposal from the platform's form and every signup for the owner; anyone added by hand and every submission of their own intake form, at its own link or embedded, for every account; a stage and a next step on the row; nothing is sent from here; per-account stages and fields are not built (CRM-03)");
  assert.equal(t.customer, "The people you sell to, in flat tables. Your own intake form — at your own link, or embedded on your site — fills it; set each one's stage and next step; add someone by hand.");
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 }, 'no census change');
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  const lineOf = (file: string, k: number): string => code(file).split('\n')[k - 1] ?? '';
  const n = (re: RegExp): number => { const m = t.citation.match(re); assert.ok(m, String(re)); return Number(m[1]); };
  assert.match(lineOf(GET_ROUTE, n(/^discover: src\/app\/api\/crm\/route\.ts:(\d+) \(GET \/api\/crm/)), /^export async function GET\(/);
  assert.match(lineOf(SECTION, n(/decide: src\/components\/crm\/CrmSection\.tsx:(\d+) \(the Stage select and the Next step input/)), /^\s+<select$/);
  assert.match(lineOf(CONTACTS_ROUTE, n(/commit: src\/app\/api\/crm\/contacts\/route\.ts:(\d+) \(PATCH — the caller first/)), /^export async function PATCH\(/);
  assert.match(lineOf(CONTACTS_ROUTE, n(/· :(\d+) \(POST — a contact typed by hand/)), /^export async function POST\(/);
  assert.match(lineOf(FORM_ROUTE, n(/the form: src\/app\/api\/crm\/form\/route\.ts:(\d+) \(PUT — the caller first; crm_forms\.update WHERE \{ id, user_id \} or \.create with user_id; the slug global, the questions re-keyed by the server\)/)), /^export async function PUT\(/);
  assert.match(lineOf(PUBLIC_ROUTE, n(/src\/app\/api\/f\/\[slug\]\/route\.ts:(\d+) \(POST — public BY RULING: honeypot → rate limit → the form by slug → the one insert, user_id the form owner's\)/)), /^export async function POST\(/);
  assert.match(lineOf(SECTION, n(/record: src\/components\/crm\/CrmSection\.tsx:(\d+) \(the four tables — contacts, form submissions, proposals, signups — over src\/lib\/crm\/crm\.ts contactsTable · proposalsTable · signupsTable and src\/lib\/crm\/forms\.ts submissionsTable/)), /name=\{CRM_CONTACTS_TABLE_NAME\}/);
  const own = /^src\/app\/api\/crm\/contacts\/route\.ts:(\d+) \(crm_contacts\.create — the row a PATCH makes on the first touch, the row a POST adds by hand\)$/.exec(t.ownTableRoute ?? '');
  assert.ok(own, 'the ownTableRoute names the PATCH\'s create line');
  assert.match(lineOf(CONTACTS_ROUTE, Number(own[1])), /await tx\.crm_contacts\.create\(\{/);
  assert.match(t.citation, /\/owner is the accounts console — its proposals panel and the two \/api\/owner\/proposals routes retired into the CRM \(CRM-01b\)$/, 'the tail CRM-01b pinned stands');
  for (const beat of ['discover: ', 'decide: ', 'commit: ', 'the form: ', 'record: ']) assert.ok(t.citation.includes(beat), beat);
  // zero line shift: the row on :298-303, the lines the deck and the laws cite by number hold
  const reg = code(REGISTRY).split('\n');
  assert.equal(reg.length, 762, '761 lines');
  assert.match(reg[297], /^\s+CRM: \{$/);
  assert.match(reg[299], /^\s+ownTable: 'crm_contacts', ownTableRoute: 'src\/app\/api\/crm\/contacts\/route\.ts:121 \(crm_contacts\.create/);
  assert.match(reg[302], /^\s+\},$/);
  for (const [k, re] of [[218, /ownTable: 'operations_project_tasks'/], [290, /ownTable: 'operations_stop_records'/], [525, /ownTable: 'journal_entries'/], [531, /ownTable: 'tax_documents'/]] as const) assert.match(reg[k - 1], re, `toolRegistry.ts:${k}`);
  const notes = comments(REGISTRY);
  assert.match(notes, /CRM-02 \(Alex, 2026-11-07\): every account's own intake form at its own link and as an embed, its submissions frozen as they came in — PARTIAL stays \(CLOSED 6/);
  assert.match(notes, /re-cited by number, what each cites unchanged: discover :28 → :35 \(the GET's header grew\), decide :259 → :277 and record :289 → :308 \(the block, the fourth table and its remount key sit above them\), commit :55 → :58 and :123 → :133 \(the PATCH's form branch\), ownTableRoute :111 → :121/);
  assert.match(notes, /CRM-02 \(2026-11-07\): :111 → :121 — the PATCH grew a 'form:' branch above the create; what it cites unchanged/);
  assert.match(notes, /CRM-02 \(Alex, 2026-11-07\): the why and the customer sentence rewritten \(BUILD 14\)/);
  // the deck's s08 names the same create line
  const s08 = comments(LANDING).split('\n')[1806];
  assert.match(s08, /CRM-02 \(2026-11-07\) re-cited the create's line, 111 → 121; CRM's is src\/app\/api\/crm\/contacts\/route\.ts:121 crm_contacts\.create \(CRM-01b, 2026-11-07\)$/);
  assert.equal(Number(/route\.ts:(\d+) crm_contacts\.create/.exec(s08)![1]), Number(own[1]), 'the deck and the registry name the same line');
  assert.match(code(LANDING).split('\n')[1806], /^\s+s08: /, 'Landing.tsx:1807 is still the s08 line');
});

// ── T10 · THE SECTION AND THE PAGE ──────────────────────────────────────────

test('T10 the section: the block above Contacts, the Form submissions table between Contacts and Proposals (CLOSED 7); no form → the empty words; a form → the link, the embed, the questions; the public form by kind, the embed, the honeypot', () => {
  const none = renderTables(loaded({}));
  assert.match(none, /data-crm-form="none"/);
  for (const w of [INTAKE_FORM_WORDS, NO_FORM_YET_WORDS, NO_CONTACTS_OWN_WORDS, PROPOSALS_OWNER_ONLY_WORDS, SLUG_RULE_WORDS, FIXED_FIELDS_NOTE_WORDS, ADD_QUESTION_WORDS, SAVE_FORM_WORDS, FORM_SUBMISSIONS_TABLE_WORDS]) assert.ok(none.includes(w), w);
  assert.ok(none.includes(Object.values(FIXED_FIELD_WORDS).join(LIST_JOIN)), 'the three fixed fields, listed');
  assert.ok(!none.includes(SLUG_CHANGE_WORDS), 'no old link to break yet');
  assert.doesNotMatch(none, /data-crm-form-link|data-crm-form-embed|data-crm-form-preview|data-crm-form-question=/);
  assert.deepEqual([...none.matchAll(/<th class="[^"]*">([^<]*)<\/th>/g)].map((m) => m[1]).slice(0, 5), ['Order', 'Question', 'Kind', 'Required', 'Shown'], 'the questions table\'s heads');
  const at = (html: string, s: string) => { const i = html.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const order = ['data-crm-form=', 'data-crm-contacts-section', 'data-crm-form-submissions-section', 'data-crm-proposals-section', 'data-crm-signups-section'].map((s) => at(none, s));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the block · Contacts · Form submissions · Proposals · Signups');
  const contact: ContactRow = { key: 'form:s-1', came_in: '2026-11-07T10:00:00.000Z', name: 'Ada Lovelace', business: 'Analytical Engines', email: 'ada@example.com', from: 'form', need: null, budget: null, start: null, stage: 'new', next_step: null, last_touch: null };
  const html = renderTables(loaded({ form: FORM, submissions: [SUB], contacts: [contact] }));
  assert.match(html, /data-crm-form="acme-intake"/);
  assert.match(html, /data-crm-form-link="true">\/f\/acme-intake</, 'the path alone until the origin is read — no host typed, and no effect runs on the server');
  assert.match(html, /data-crm-form-embed="true"><iframe src="\/f\/acme-intake\?embed=1" width="100%" height="900" style="border:0" title="Work with Acme"><\/iframe></);
  assert.match(html, /data-crm-form-open="true">Open</);
  assert.match(html, /data-crm-form-preview="true">Preview</);
  assert.match(html, /data-crm-form-copy-link="true">Copy</);
  assert.ok(html.includes(SLUG_CHANGE_WORDS));
  assert.match(html, /data-crm-form-slug="true"[^>]*value="acme-intake"|value="acme-intake"[^>]*data-crm-form-slug/);
  assert.equal((html.match(/data-crm-form-question="q-/g) ?? []).length, 4, 'four question rows — the hidden one too');
  assert.match(html, /<option value="yesno" selected="">Yes \/ no<\/option>/);
  assert.match(html, /data-crm-form-shown="true"[^>]*\/>/);
  assert.ok(html.includes(NO_SUBMISSIONS_WORDS) === false && html.includes(SUB.name), 'a submission row');
  assert.ok(html.includes(Q4.label) && html.includes(REMOVED_HEAD_WORDS), 'a column per question the form holds, and the removed ones');
  assert.ok(html.includes('>not asked<') && html.includes('Old question: kept'));
  assert.ok(html.includes('>Your form<'), 'the From cell of a form contact');
  assert.doesNotMatch(html, /data-crm-form-failed|data-crm-form-saved|data-crm-form-copy-failed/, 'nothing failed, nothing saved yet');
  // the block's code: one write target, the origin read in an effect, nothing stored, no clock, no host typed
  const setup = code(SETUP);
  assert.deepEqual([...setup.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]), ['CRM_FORM_ROUTE']);
  assert.match(setup, /const CRM_FORM_ROUTE = '\/api\/crm\/form';/);
  assert.match(setup, /method: 'PUT'/);
  assert.match(setup, /useEffect\(\(\) => \{\n\s*setOrigin\(window\.location\.origin\);\n\s*\}, \[\]\);/);
  assert.match(setup, /const link = path === null \? null : origin === null \? path : `\$\{origin\}\$\{path\}`;/);
  assert.doesNotMatch(setup, /localStorage|sessionStorage|document\.cookie|new Date\(|Date\.now|https?:\/\//);
  assert.match(setup, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(setup, /setCopyFailed\(true\)/, 'a refused copy is said');
  assert.match(setup, /disabled=\{saving \|\| questions\.length >= FORM_MAX_QUESTIONS\}/, 'add disabled at twelve');
  assert.match(setup, /\} finally \{\n\s*setSaving\(false\);\n\s*onSaved\(\);\n\s*\}/, 'the re-read after every save');
  assert.match(setup, /setSaved\(answer\);\n\s*setTitle\(answer\.title\);\n\s*setSlug\(answer\.slug\);/, 'the PUT\'s answer is the state after a save — the ids stay the server\'s');
  assert.match(setup, /q\.id === undefined \? \{ label: q\.label, kind: q\.kind, required: q\.required, shown: q\.shown \} : \{ id: q\.id, label: q\.label, kind: q\.kind, required: q\.required, shown: q\.shown \}/, 'a new question is sent without an id');
  assert.match(setup, /<select className=\{CONTROL\.input\} value=\{q\.kind\}/, 'the Kind select wears CONTROL.input, the Stage select\'s way');
  const section = code(SECTION);
  assert.match(section, /<IntakeFormSetup form=\{read\.form\} onSaved=\{onWritten\} \/>/);
  assert.match(section, /empty=\{read\.form === null \? NO_FORM_YET_WORDS : NO_SUBMISSIONS_WORDS\}/);
  assert.match(section, /const submissionColumns = useMemo\(\(\) => submissionsTable\(read\.form\), \[read\.form\]\);/);
  // a changed column set is a new table: keyed by the form's question ids, so the per-column filter and sort state never outlives its columns (the browser proof found the stale map)
  assert.match(section, /const submissionsKey = read\.form === null \? 'no-form' : read\.form\.questions\.map\(\(q\) => q\.id\)\.join\(','\);/);
  assert.match(section, /name=\{SUBMISSIONS_TABLE_NAME\}[\s\S]{0,200}key=\{submissionsKey\}/, 'the Form submissions table remounts when the questions change');
  assert.match(section, /form: \(body\.form \?\? null\) as IntakeForm \| null,\n\s*submissions: \(body\.submissions \?\? \[\]\) as SubmissionRow\[\],/);
  assert.deepEqual([...section.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]), ['CRM_CONTACTS_ROUTE'], 'the section\'s one write target is still the contacts route — the form\'s is the block\'s');
  // the public page: the title, the line, the three fixed fields, the asked questions by kind, the honeypot, Send, the goes-to line, the footer
  const pub = unescape(renderToStaticMarkup(React.createElement(IntakeFormClient, { form: publicFormOf(FORM), embed: false })));
  assert.match(pub, /<h1[^>]*>Work with Acme<\/h1>/);
  assert.ok(pub.includes('Tell us what you need.'));
  for (const w of Object.values(FIXED_FIELD_WORDS)) assert.ok(pub.includes(w), w);
  assert.equal((pub.match(/data-intake-question="q-/g) ?? []).length, 3, 'the three asked; the hidden one never');
  assert.ok(!pub.includes(Q4.label));
  assert.match(pub, /<input id="f-q-q-1" type="text" required=""/);
  assert.match(pub, /<textarea id="f-q-q-2"/);
  assert.match(pub, /<input type="radio" name="f-q-q-3" required="" class="[^"]*" value="yes"\/>/, 'React writes a controlled value last');
  assert.match(pub, /<input type="radio" name="f-q-q-3" required="" class="[^"]*" value="no"\/>/);
  assert.equal((pub.match(/\(optional\)/g) ?? []).length, 2, 'business and the one optional question');
  assert.match(pub, /<div aria-hidden="true" class="absolute -left-\[9999px\] top-auto h-px w-px overflow-hidden"><label for="f-website">Website<\/label><input id="f-website" type="text" name="website" tabindex="-1" autoComplete="off" value=""\/><\/div>/, 'the honeypot, WorkWithMeForm.tsx:371-380\'s');
  assert.match(pub, /data-intake-send="true">Send</);
  assert.ok(pub.includes(goesToWords('Work with Acme')));
  assert.match(pub, /<a [^>]*href="\/"[^>]*>Form by Temple Stuart<\/a>/);
  assert.match(pub, /class="[^"]*min-h-screen px-4 py-10"/);
  assert.doesNotMatch(pub, /data-intake-sent|data-intake-failed|data-intake-embed/);
  const emb = unescape(renderToStaticMarkup(React.createElement(IntakeFormClient, { form: publicFormOf(FORM), embed: true })));
  assert.match(emb, /data-intake-embed=""/);
  assert.doesNotMatch(emb, /min-h-screen|py-10/);
  assert.match(emb, /class="[^"]*\bp-4"/, 'no padding beyond 16px');
  assert.match(emb, /<a [^>]*target="_blank" rel="noopener" data-intake-by="true" href="\/">/, 'out of the iframe');
  const same = (html: string) => html.replace(/ data-intake-embed=""|target="_blank" |rel="noopener" /g, '').replace(/^<div class="bg-bg-terminal[^"]*"/, '<div class=""');
  assert.equal(same(emb), same(pub), 'the same content');
  const client = code(CLIENT);
  assert.match(client, /fetch\(`\/api\/f\/\$\{form\.slug\}`, \{\n\s*method: 'POST',/);
  assert.match(client, /body: JSON\.stringify\(\{ name, email, \.\.\.\(business\.trim\(\) === '' \? \{\} : \{ business \}\), answers, website \}\),/);
  assert.match(client, /setFailed\(String\(data\.message \?\? data\.error \?\? `HTTP \$\{res\.status\}`\)\);/, 'the route\'s own words');
  assert.doesNotMatch(client, /<header|Sign out|cookie-auth|localStorage|sessionStorage|new Date\(|Date\.now|window\.location/);
  assert.match(client, /min-h-\[44px\]/);
  // the page file: force-dynamic, one row by its slug, notFound, nothing of the account beyond the public form
  const pg = code(PAGE);
  assert.match(pg, /export const dynamic = 'force-dynamic';/);
  assert.match(pg, /if \(!isFormSlug\(slug\)\) notFound\(\);/);
  assert.match(pg, /prisma\.crm_forms\.findUnique\(\{ where: \{ slug \}, select: \{ id: true, slug: true, title: true, line: true, questions: true \} \}\)/);
  assert.match(pg, /if \(row === null\) notFound\(\);/);
  assert.match(pg, /<IntakeFormClient form=\{publicFormOf\(intakeFormOf\(row\)\)\} embed=\{query\.embed === '1'\} \/>/);
  assert.doesNotMatch(pg, /cookie|getVerifiedEmail|getCurrentUser|user_id|AppLayout|ToolOpener|LandingHeader/);
  assert.match(comments(PAGE), /PUBLIC BY RULING \(src\/middleware\.ts PUBLIC_PATHS '\/f'\)/);
  assert.match(pg, /import IntakeFormClient from '@\/components\/crm\/IntakeFormClient';/);
});

// ── T11 · THE SCHEMA, THE CLIENT, THE README ────────────────────────────────

test('T11 the schema: model crm_forms and model crm_form_submissions column for column with the SQL, the users relations, the source comment widened; the client knows them; README unchanged (BUILD 16)', () => {
  const schema = code(SCHEMA);
  const forms = schema.slice(schema.indexOf('model crm_forms {'), schema.indexOf('@@map("crm_forms")'));
  for (const field of [
    /^\s+id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid[ \t]*$/m,
    /^\s+user_id\s+String\s+@unique\(map: "crm_forms_user_id_key"\)[ \t]*$/m,
    /^\s+slug\s+String\s+@unique\(map: "crm_forms_slug_key"\) @db\.VarChar\(40\)[ \t]*$/m,
    /^\s+title\s+String\s+@db\.VarChar\(120\)[ \t]*$/m,
    /^\s+line\s+String\?\s+@db\.VarChar\(500\)[ \t]*$/m,
    /^\s+questions\s+Json\s+@default\("\[\]"\)[ \t]*$/m,
    /^\s+created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)[ \t]*$/m,
    /^\s+updated_at\s+DateTime\s+@db\.Timestamptz\(6\)[ \t]*$/m,
    /^\s+users\s+users\s+@relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)[ \t]*$/m,
    /^\s+submissions crm_form_submissions\[\][ \t]*$/m,
  ]) assert.match(forms, field);
  const subs = schema.slice(schema.indexOf('model crm_form_submissions {'), schema.indexOf('@@map("crm_form_submissions")'));
  for (const field of [
    /^\s+form_id\s+String\s+@db\.Uuid[ \t]*$/m,
    /^\s+user_id\s+String[ \t]*$/m,
    /^\s+name\s+String\s+@db\.VarChar\(255\)[ \t]*$/m,
    /^\s+email\s+String\s+@db\.VarChar\(255\)[ \t]*$/m,
    /^\s+business\s+String\?[ \t]*$/m,
    /^\s+answers\s+Json[ \t]*$/m,
    /^\s+created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)[ \t]*$/m,
    /^\s+form\s+crm_forms\s+@relation\(fields: \[form_id\], references: \[id\], onDelete: Restrict, onUpdate: Cascade, map: "crm_form_submissions_form_id_fkey"\)[ \t]*$/m,
    /^\s+users\s+users\s+@relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade, onUpdate: Cascade, map: "crm_form_submissions_user_id_fkey"\)[ \t]*$/m,
    /@@index\(\[user_id, created_at\], map: "crm_form_submissions_user_created_idx"\)/,
    /@@index\(\[form_id\], map: "crm_form_submissions_form_id_idx"\)/,
  ]) assert.match(subs, field);
  assert.match(schema, /^\s+crm_forms\s+crm_forms\[\][ \t]*$/m, 'users names the form');
  assert.match(schema, /^\s+crm_form_submissions\s+crm_form_submissions\[\][ \t]*$/m, 'users names the submissions');
  assert.ok(schema.indexOf('model crm_contacts {') < schema.indexOf('model crm_forms {') && schema.indexOf('model crm_forms {') < schema.indexOf('model crm_form_submissions {'), 'after crm_contacts, the last two');
  const notes = comments(SCHEMA);
  for (const check of ['crm_forms_slug_chk', 'crm_forms_title_chk', 'crm_forms_line_chk', 'crm_forms_questions_chk', 'crm_form_submissions_name_chk', 'crm_form_submissions_email_chk', 'crm_form_submissions_answers_chk', `prisma/migrations/${MIGRATION_DIR}`, "'proposal' | 'signup' | 'manual' | 'form'", 'HELD BY THE DATABASE']) assert.ok(notes.includes(check), check);
  assert.equal(Prisma.ModelName.crm_forms, 'crm_forms');
  assert.equal(Prisma.ModelName.crm_form_submissions, 'crm_form_submissions');
  assert.deepEqual(Object.keys(Prisma.Crm_formsScalarFieldEnum), ['id', 'user_id', 'slug', 'title', 'line', 'questions', 'created_at', 'updated_at']);
  assert.deepEqual(Object.keys(Prisma.Crm_form_submissionsScalarFieldEnum), ['id', 'form_id', 'user_id', 'name', 'email', 'business', 'answers', 'created_at']);
  // README: nothing moves (BUILD 16) — the deck's step-7 sentence stays at 6 tools; the counts stay; no intake form named
  const readme = code(README) + comments(README);
  assert.match(readme, /Today 6 tools run all four beats — discover, decide, commit, record: Tasks, Time, CRM, Expenses, Travel, Bookkeeping\./);
  assert.match(readme, /19 of the 25 tools do not run all four beats yet\./);
  assert.doesNotMatch(readme, /intake form|\/f\/<slug>|crm_forms/);
});
