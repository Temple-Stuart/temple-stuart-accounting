/**
 * CRM-01a (Alex, 2026-11-06; the CONTINUE rulings 1–10, 2026-11-07) — THE CRM PAGE: CONTACTS, PROPOSALS AND SIGNUPS, READ.
 *
 * Ruling A: /crm is CRM's one page — the bill-pay shell (the opener and one mount), no strip. Ruling B: three flat
 * DataTables, heads in the ruled orders. Ruling C: one GET — the caller first (401, 404), then whose rows, decided on the
 * server (the platform owner reads every proposal and every signup but their own; anyone else only their own contacts).
 * Ruling D: every word typed once (crmWords.ts). Ruling E: the working table AUTHORED, NOT APPLIED. Rulings 1–10: the census
 * 5 · 9 · 11 (1), no ownTable (2), the plan per signup (3), the 401 by code scan (4), the dates (5), the close's words (6),
 * the menu note (7), the plans row derived ◐ (10).
 *
 *   T1 the rows: contactsOf over fixtures — a proposal, a provider signup, a password signup, the reader left out, newest
 *      first, "—" for a blank, new for a contact with no working row, a working row's values, a contact typed by hand;
 *   T2 the rules: needWords (the form's chips; the close's words; a stranger throws), signedUpWith (both, and the throw),
 *      planWords (Free, one offer, two, a stranger throws), the laws contactsOf keeps;
 *   T3 the dates: instants through instantColumn (the viewer's day, the instant in the CSV), the deadline a day through dayWords;
 *   T4 the three tables: the heads in order, as the shared DataTable draws them; the section mounts three, in order;
 *   T5 the route: the caller first, the reads scoped, no client id, no write, no password column, not public;
 *   T6 the page: its own, the opener and the one mount, no strip, mounted nowhere else;
 *   T7 the registry row, the census, the gate, the rail, the plans row, the menu note;
 *   T8 the migration (the newest), the schema model, the client.
 *
 * Source is read through code() and comments() only (the reader law). No clock: every instant is a fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prisma } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  CRM_CONTACTS_TABLE_NAME, CRM_PROPOSALS_TABLE_NAME, CRM_SIGNUPS_TABLE_NAME, CRM_STAGES, CrmLawError, contactsOf, contactsTable, needWords, planWords,
  proposalRowsOf, proposalsTable, signedUpWith, signupRowsOf, signupsTable, verifiedWords,
  type ContactRow, type ProposalInput, type UserInput, type WorkingInput,
} from '../crm/crm';
import {
  CONTACT_HEAD_WORDS, CRM_LOADING_WORDS, EMAIL_AND_PASSWORD_WORDS, FREE_PLAN_WORDS, FROM_WORDS, NOT_YET_WORDS, PROPOSAL_HEAD_WORDS, SIGNUP_HEAD_WORDS,
  crmFailedWords,
} from '../crm/crmWords';
import { SERVICE_NEEDS, SERVICE_NEED_LABELS } from '../proposalNeeds';
import { CLOSE_OFFER } from '../offer/close';
import { closeChoiceWords } from '../offer/closeWords';
import { dayWords, instantDayWords } from '../operations/work';
import { BLANK } from '../budget/format';
import { noFilters, type TableFilters } from '../table/filters';
import type { TableColumn } from '../table/columns';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { FREE_TOOLS, TOOL_GATE } from '../offer';
import { PHASES_RENDERED_AT, navFamilies, navToolByName } from '../nav';
import { OWNER_UTILITIES } from '../shellMenu';
import { CAPABILITY_GROUPS, CELL_MARK, PLANS, capabilityNotes, cellState } from '../offer/plans';
import DataTable, { type DataTableProps } from '@/components/table/DataTable';
import CrmSection from '@/components/crm/CrmSection';

Object.assign(globalThis, { React });

const ROUTE = 'src/app/api/crm/route.ts';
const RULES = 'src/lib/crm/crm.ts';
const WORDS = 'src/lib/crm/crmWords.ts';
const SECTION = 'src/components/crm/CrmSection.tsx';
const PAGE = 'src/app/crm/page.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';
const MIDDLEWARE = 'src/middleware.ts';
const SHELL_MENU = 'src/lib/shellMenu.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261106150000_crm_01a_crm_contacts';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;

// ── FIXTURES ────────────────────────────────────────────────────────────────

const READER = 'u-reader';
const TODAY = '2026-11-07';

const proposal = (o: Partial<ProposalInput> & { id: string; created_at: string }): ProposalInput => ({
  name: 'Ada Lovelace', email: 'ada@example.com', business: 'Analytical Engines', need: 'setup', modules: ['books', 'tax'], start_window: 'now',
  budget_range: '$2–10k', current_stack: 'Spreadsheets and a shoebox', hard_deadline: null, deadline_driver: null, links: null, team_size: null,
  referral_source: null, notes_from_them: 'Every month closed by the 10th.', ...o,
});
const user = (o: Partial<UserInput> & { id: string; email: string; created_at: string }): UserInput => ({ name: 'Someone', passwordless: false, email_verified_at: null, ...o });
const workingRow = (o: Partial<WorkingInput> & { id: string; source: string }): WorkingInput => ({
  source_ref: null, name: null, business: null, email: null, stage: 'new', next_step: null, last_touch_at: null, created_at: '2026-11-04T08:00:00.000Z', ...o,
});

const P1 = proposal({ id: 'p-1', created_at: '2026-11-01T10:00:00.000Z' });
const P2 = proposal({
  id: 'p-2', created_at: '2026-11-03T09:00:00.000Z', name: 'Edsger Dijkstra', email: 'edsger@example.com', business: 'Shortest Paths', need: 'close', modules: [],
  start_window: '2-4wk', budget_range: '<$2k', hard_deadline: '2026-12-15', deadline_driver: 'The year closes', links: ['https://example.com/books'], team_size: '2-5',
  referral_source: 'A friend', notes_from_them: 'Twelve months closed.',
});
const USERS: UserInput[] = [
  user({ id: READER, email: 'owner@example.com', name: 'The Owner', created_at: '2026-01-01T00:00:00.000Z' }),
  user({ id: 'u-1', email: 'Grace@Example.com', name: 'Grace Hopper', created_at: '2026-11-02T15:30:00.000Z', passwordless: true, email_verified_at: '2026-11-02T15:30:05.000Z' }),
  user({ id: 'u-2', email: 'linus@example.com', name: 'Linus', created_at: '2026-10-30T07:00:00.000Z' }),
];
const PROVIDERS = new Map<string, readonly string[]>([['grace@example.com', ['github']]]);
const ACTIVE = new Map<string, readonly string[]>([['u-2', ['tab:books']]]);
const WORKING: WorkingInput[] = [
  workingRow({ id: 'w-1', source: 'proposal', source_ref: 'p-2', stage: 'reviewing', next_step: 'Send the quote', last_touch_at: '2026-11-05T12:00:00.000Z' }),
  workingRow({ id: 'w-2', source: 'manual', name: 'Barbara Liskov', email: 'barbara@example.com', business: 'Substitution LLC', stage: 'sent', next_step: 'Call on Monday', last_touch_at: '2026-11-06T09:00:00.000Z' }),
];

const proposals = () => proposalRowsOf([P1, P2]);
const signups = () => signupRowsOf({ users: USERS, providers: PROVIDERS, activeKeys: ACTIVE, readerId: READER });
const contacts = (working: readonly WorkingInput[] = WORKING) => contactsOf({ proposals: proposals(), signups: signups(), working, today: TODAY });
const byKey = (rows: readonly ContactRow[], key: string): ContactRow => { const r = rows.find((x) => x.key === key); assert.ok(r, key); return r; };
const cellOf = <Row, Key extends string>(columns: readonly TableColumn<Row, Key>[], key: Key, row: Row): string => {
  const c = columns.find((x) => x.key === key);
  assert.ok(c, key);
  return c.words(row);
};

// ── T1 · THE ROWS ───────────────────────────────────────────────────────────

test('T1 contactsOf: every proposal and every signup but the reader, and the contacts typed by hand — newest first, keyed by where each came from', () => {
  const rows = contacts();
  assert.deepEqual(rows.map((r) => r.key), ['manual:w-2', 'proposal:p-2', 'signup:u-1', 'proposal:p-1', 'signup:u-2'], 'newest first by the instant each came in; the reader is no one\'s lead');
  assert.ok(!rows.some((r) => r.key === `signup:${READER}`), 'the reader\'s own account is left out');
  // A proposal with a working row: its own words, the working row's stage, next step and last touch.
  assert.deepEqual(byKey(rows, 'proposal:p-2'), {
    key: 'proposal:p-2', came_in: '2026-11-03T09:00:00.000Z', name: 'Edsger Dijkstra', business: 'Shortest Paths', email: 'edsger@example.com', from: 'proposal',
    need: 'Close my 2026 books', budget: '<$2k', start: '2-4wk', stage: 'reviewing', next_step: 'Send the quote', last_touch: '2026-11-05T12:00:00.000Z',
  });
  // A proposal with no working row is new — nobody has touched it; no next step, no touch.
  assert.deepEqual(byKey(rows, 'proposal:p-1'), {
    key: 'proposal:p-1', came_in: '2026-11-01T10:00:00.000Z', name: 'Ada Lovelace', business: 'Analytical Engines', email: 'ada@example.com', from: 'proposal',
    need: 'Setup', budget: '$2–10k', start: 'now', stage: 'new', next_step: null, last_touch: null,
  });
  // A provider signup: "Signed up — <Plan>", no business, no budget, no start.
  assert.deepEqual(byKey(rows, 'signup:u-1'), {
    key: 'signup:u-1', came_in: '2026-11-02T15:30:00.000Z', name: 'Grace Hopper', business: null, email: 'Grace@Example.com', from: 'signup',
    need: 'Signed up — Free', budget: null, start: null, stage: 'new', next_step: null, last_touch: null,
  });
  assert.equal(byKey(rows, 'signup:u-2').need, 'Signed up — Books', 'a password signup holding Books');
  // A contact typed by hand: By hand, its own name, business and email; no need, budget or start.
  assert.deepEqual(byKey(rows, 'manual:w-2'), {
    key: 'manual:w-2', came_in: '2026-11-04T08:00:00.000Z', name: 'Barbara Liskov', business: 'Substitution LLC', email: 'barbara@example.com', from: 'manual',
    need: null, budget: null, start: null, stage: 'sent', next_step: 'Call on Monday', last_touch: '2026-11-06T09:00:00.000Z',
  });
  // On screen: a blank is "—", never an imputed word; the From words are the ruling's.
  const columns = contactsTable();
  const grace = byKey(rows, 'signup:u-1');
  for (const k of ['business', 'budget', 'start', 'next_step', 'last_touch'] as const) assert.equal(cellOf(columns, k, grace), BLANK, `${k} is "—"`);
  assert.equal(BLANK, '—');
  assert.equal(cellOf(columns, 'stage', grace), 'new');
  assert.deepEqual(rows.map((r) => cellOf(columns, 'from', r)), ['By hand', 'Proposal', 'Signup', 'Proposal', 'Signup']);
  assert.deepEqual(FROM_WORDS, { proposal: 'Proposal', signup: 'Signup', manual: 'By hand' });
  // With no working row at all, every contact is new.
  assert.ok(contacts([]).every((r) => r.stage === 'new' && r.next_step === null && r.last_touch === null));
  assert.deepEqual(contacts([]).map((r) => r.key), ['proposal:p-2', 'signup:u-1', 'proposal:p-1', 'signup:u-2']);
});

test('T1 proposalRowsOf and signupRowsOf: every field the form and the signup collected, newest first; never status, owner notes or the IP hash', () => {
  const p = proposals();
  assert.deepEqual(p.map((r) => r.id), ['p-2', 'p-1']);
  assert.deepEqual(p[0], {
    id: 'p-2', created_at: '2026-11-03T09:00:00.000Z', name: 'Edsger Dijkstra', email: 'edsger@example.com', business: 'Shortest Paths', need: 'close',
    need_words: 'Close my 2026 books', modules: [], start_window: '2-4wk', budget_range: '<$2k', current_stack: 'Spreadsheets and a shoebox', hard_deadline: '2026-12-15',
    deadline_driver: 'The year closes', links: ['https://example.com/books'], team_size: '2-5', referral_source: 'A friend', notes_from_them: 'Twelve months closed.',
  });
  for (const k of ['status', 'owner_notes', 'ownerNotes', 'ip_hash', 'ipHash']) assert.ok(!(k in p[0]), `no ${k}`);
  const s = signups();
  assert.deepEqual(s.map((r) => r.id), ['u-1', 'u-2'], 'every users row but the reader\'s, newest first');
  assert.deepEqual(s, [
    { id: 'u-1', created_at: '2026-11-02T15:30:00.000Z', name: 'Grace Hopper', email: 'Grace@Example.com', signed_up_with: 'github', email_verified_at: '2026-11-02T15:30:05.000Z', plan: 'Free' },
    { id: 'u-2', created_at: '2026-10-30T07:00:00.000Z', name: 'Linus', email: 'linus@example.com', signed_up_with: 'Email and password', email_verified_at: null, plan: 'Books' },
  ]);
  assert.ok(!s.some((r) => 'password' in r), 'no password field, ever');
});

// ── T2 · THE RULES ──────────────────────────────────────────────────────────

test('T2 needWords: the form\'s chip for each service need, the close offer\'s words on any day (ruling 6), and a stranger throws by name', () => {
  for (const need of SERVICE_NEEDS) assert.equal(needWords(need), SERVICE_NEED_LABELS[need]);
  assert.equal(needWords(CLOSE_OFFER.need), closeChoiceWords(CLOSE_OFFER));
  assert.equal(needWords('close'), 'Close my 2026 books');
  assert.throws(() => needWords('bookkeeping'), (e: unknown) => e instanceof CrmLawError && /"bookkeeping" is not a need the proposal form holds \(setup, maintenance, custom, embed, unsure, close\)/.test(e.message));
  assert.match(code(RULES), /if \(need === CLOSE_OFFER\.need\) return closeChoiceWords\(CLOSE_OFFER\);/);
});

test('T2 signedUpWith: "Email and password" for a password; a provider signup names its NextAuth provider, matched by email case-insensitively; none throws by name', () => {
  assert.equal(signedUpWith({ email: 'linus@example.com', passwordless: false }, new Map()), EMAIL_AND_PASSWORD_WORDS);
  assert.equal(EMAIL_AND_PASSWORD_WORDS, 'Email and password');
  assert.equal(signedUpWith({ email: 'Grace@Example.com', passwordless: true }, PROVIDERS), 'github');
  assert.equal(signedUpWith({ email: ' GRACE@example.com ', passwordless: true }, PROVIDERS), 'github');
  assert.equal(signedUpWith({ email: 'two@example.com', passwordless: true }, new Map([['two@example.com', ['google', 'github', 'google']]])), 'github · google', 'each provider once, in order');
  assert.throws(
    () => signedUpWith({ email: 'nobody@example.com', passwordless: true }, PROVIDERS),
    (e: unknown) => e instanceof CrmLawError && /nobody@example\.com has no password and no provider account — a record that contradicts itself/.test(e.message),
  );
  assert.throws(() => signupRowsOf({ users: [user({ id: 'u-9', email: 'nobody@example.com', created_at: '2026-11-01T00:00:00.000Z', passwordless: true })], providers: PROVIDERS, activeKeys: new Map(), readerId: READER }), CrmLawError);
});

test('T2 planWords: a signup\'s OWN active keys named by the offers (ruling 3); none is Free; a key no offer names throws by name', () => {
  assert.equal(planWords([]), FREE_PLAN_WORDS);
  assert.equal(FREE_PLAN_WORDS, 'Free');
  assert.equal(planWords(['tab:books']), 'Books');
  assert.equal(planWords(['bundle:all']), 'Everything');
  assert.equal(planWords(['bundle:all', 'tab:books']), 'Books · Everything', 'in the offers\' order, joined');
  assert.equal(planWords(['tab:books', 'tab:books']), 'Books', 'a key once');
  assert.throws(() => planWords(['tab:trade']), (e: unknown) => e instanceof CrmLawError && /the active key "tab:trade" is no offer's \(src\/lib\/offer\.ts OFFERS\)/.test(e.message));
  // Each signup's own: u-2's Books does not reach u-1.
  assert.deepEqual(signups().map((s) => s.plan), ['Free', 'Books']);
});

test('T2 contactsOf\'s laws: a record that contradicts itself is named, never smoothed', () => {
  const run = (working: readonly WorkingInput[], today = TODAY) => () => contactsOf({ proposals: proposals(), signups: signups(), working, today });
  const named = (re: RegExp) => (e: unknown) => e instanceof CrmLawError && re.test(e.message);
  assert.throws(run([workingRow({ id: 'w-9', source: 'proposal', source_ref: 'p-404' })]), named(/a working row names proposal:p-404, which the read did not return/));
  assert.throws(run([workingRow({ id: 'w-9', source: 'signup', source_ref: READER })]), named(/a working row names signup:u-reader, which the read did not return/), 'the reader is no contact of their own');
  assert.throws(run([workingRow({ id: 'w-9', source: 'proposal', source_ref: 'p-1', stage: 'maybe' })]), named(/working row w-9 says stage "maybe" — not one of new, reviewing, sent, won, lost/));
  assert.throws(run([workingRow({ id: 'w-9', source: 'lead', source_ref: 'p-1' })]), named(/working row w-9 says source "lead"/));
  assert.throws(run([workingRow({ id: 'w-9', source: 'proposal', source_ref: 'p-1', last_touch_at: '2026-11-08T00:30:00.000Z' })]), named(/last touched on 2026-11-08, after today \(2026-11-07\) — a record from the future/));
  assert.throws(run([workingRow({ id: 'w-8', source: 'proposal', source_ref: 'p-1' }), workingRow({ id: 'w-9', source: 'proposal', source_ref: 'p-1' })]), named(/two working rows name proposal:p-1/));
  assert.throws(run([], '11/07/2026'), named(/today "11\/07\/2026" is not YYYY-MM-DD/));
  assert.throws(() => proposalRowsOf([proposal({ id: 'p-9', created_at: '2026-11-01T00:00:00.000Z', modules: 'books' })]), named(/proposal p-9: modules is not a list of words/));
  assert.deepEqual([...CRM_STAGES], ['new', 'reviewing', 'sent', 'won', 'lost'], 'proposals.status\'s own five');
});

// ── T3 · THE DATES (ruling 5) ───────────────────────────────────────────────

test('T3 the dates: created_at, email_verified_at and last_touch_at are instants (the viewer\'s day, the instant in the CSV); the deadline is a day; experienceWords is not imported', () => {
  const rows = contacts();
  const p2 = byKey(rows, 'proposal:p-2');
  const c = contactsTable();
  const col = (key: string) => { const x = c.find((k) => k.key === key); assert.ok(x, key); return x; };
  assert.equal(col('came_in').words(p2), instantDayWords('2026-11-03T09:00:00.000Z'));
  assert.equal(col('came_in').csv(p2), '2026-11-03T09:00:00.000Z', 'the CSV writes the instant as stored');
  assert.equal(col('last_touch').words(p2), instantDayWords('2026-11-05T12:00:00.000Z'));
  assert.equal(col('last_touch').csv(p2), '2026-11-05T12:00:00.000Z');
  const p = proposalsTable();
  const deadline = p.find((k) => k.key === 'deadline');
  assert.ok(deadline);
  assert.equal(deadline.words(proposals()[0]), dayWords('2026-12-15'), 'a day, at local midnight');
  assert.equal(deadline.csv(proposals()[0]), '2026-12-15', 'written as the ISO day');
  assert.equal(deadline.words(proposals()[1]), BLANK);
  const s = signupsTable();
  const verified = s.find((k) => k.key === 'email_verified');
  assert.ok(verified);
  assert.equal(verified.words(signups()[0]), `Yes — ${instantDayWords('2026-11-02T15:30:05.000Z')}`);
  assert.equal(verified.csv(signups()[0]), '2026-11-02T15:30:05.000Z');
  assert.equal(verified.words(signups()[1]), NOT_YET_WORDS);
  assert.equal(verifiedWords(null), 'Not yet');
  const rules = code(RULES);
  for (const spec of [
    "instantColumn<ContactRow, ContactColumn>('came_in', h.came_in, (r) => r.came_in)",
    "instantColumn<ContactRow, ContactColumn>('last_touch', h.last_touch, (r) => r.last_touch)",
    "instantColumn<ProposalRow, ProposalColumn>('came_in', h.came_in, (r) => r.created_at)",
    "instantColumn<SignupRow, SignupColumn>('signed_up_on', h.signed_up_on, (r) => r.created_at)",
    "(r) => (r.hard_deadline === null ? null : dayWords(r.hard_deadline)), (r) => r.hard_deadline)",
    '`${VERIFIED_PREFIX_WORDS}${instantDayWords(emailVerifiedAt)}`',
  ]) assert.ok(rules.includes(spec), spec);
  for (const f of [RULES, WORDS, SECTION, ROUTE, PAGE]) {
    assert.doesNotMatch(code(f), /experienceWords/, `${f} does not import experienceWords (ruling 5)`);
    assert.doesNotMatch(code(f), /toLocale(Date|Time)?String|Intl\.DateTimeFormat/, `${f} formats no date of its own — work.ts draws every one`);
  }
});

// ── T4 · THE THREE TABLES (ruling B) ────────────────────────────────────────

/** The head row as the shared DataTable draws it: each sort button's column key and its words, in order. */
function headRow<Row, Key extends string>(name: string, columns: readonly TableColumn<Row, Key>[], rows: readonly Row[], keyOf: (r: Row) => string): string[] {
  const off = noFilters(columns);
  const props: DataTableProps<Row, Key, TableFilters> = {
    name, columns, rows, shown: rows, loaded: true, tableClassName: 'min-w-[60rem]', foot: null, filters: off, onFilters: () => undefined, noFilters: off,
    sort: null, onSort: () => undefined, openFilter: null, onOpenFilter: () => undefined, csv: null, controls: null,
    renderRow: (r: Row) => React.createElement('tr', { key: keyOf(r) }),
  };
  const html = renderToStaticMarkup(React.createElement(DataTable as (p: DataTableProps<Row, Key, TableFilters>) => React.ReactElement, props));
  const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
  return [...head.matchAll(new RegExp(`data-${name}-sort="([a-z_]+)"[^>]*>([^<]*)</button>`, 'g'))].map((m) => m[2]);
}

test('T4 the three tables: the heads in the ruled orders, every one drawn by the shared DataTable from crmWords', () => {
  const CONTACTS = ['Came in', 'Name', 'Business', 'Email', 'From', 'What they need', 'Budget', 'Start', 'Stage', 'Next step', 'Last touch'];
  const PROPOSALS = ['Came in', 'Name', 'Email', 'Business', 'Need', 'Modules', 'Timeline', 'Budget', 'Tools today', 'Deadline', 'Why that date', 'Links', 'Team', 'Heard from', 'What does done look like'];
  const SIGNUPS = ['Signed up on', 'Name', 'Email', 'Signed up with', 'Email verified', 'Plan'];
  assert.deepEqual(contactsTable().map((c) => c.label), CONTACTS);
  assert.deepEqual(proposalsTable().map((c) => c.label), PROPOSALS);
  assert.deepEqual(signupsTable().map((c) => c.label), SIGNUPS);
  assert.deepEqual(Object.values(CONTACT_HEAD_WORDS), CONTACTS, 'typed once, in crmWords, in order');
  assert.deepEqual(Object.values(PROPOSAL_HEAD_WORDS), PROPOSALS);
  assert.deepEqual(Object.values(SIGNUP_HEAD_WORDS), SIGNUPS);
  assert.deepEqual(headRow(CRM_CONTACTS_TABLE_NAME, contactsTable(), contacts(), (r) => r.key), CONTACTS);
  assert.deepEqual(headRow(CRM_PROPOSALS_TABLE_NAME, proposalsTable(), proposals(), (r) => r.id), PROPOSALS);
  assert.deepEqual(headRow(CRM_SIGNUPS_TABLE_NAME, signupsTable(), signups(), (r) => r.id), SIGNUPS);
  assert.ok(!proposalsTable().some((c) => /status|owner|ip/i.test(c.key)), 'no status, owner notes or IP hash column');
});

test('T4 the section: one read, three shared DataTables in order — contacts, proposals, signups — each in its own sideways box; no write, nothing stored, no strip', () => {
  const s = code(SECTION);
  assert.match(s, /^'use client';/);
  assert.match(s, /import DataTable from '@\/components\/table\/DataTable';/);
  assert.equal((s.match(/<DataTable\b/g) ?? []).length, 1, 'one DataTable, inside the one table component');
  assert.equal((s.match(/readJson\('\/api\/crm', 'The CRM'\)/g) ?? []).length, 1, 'one read');
  const mounts = [...s.matchAll(/<CrmTable\s+name=\{(CRM_[A-Z]+_TABLE_NAME)\}\s+title=\{([A-Z_]+)\}\s+columns=\{(\w+)\}\s+rows=\{read\.(\w+)\}/g)].map((m) => m.slice(1).join(' '));
  assert.deepEqual(mounts, [
    'CRM_CONTACTS_TABLE_NAME CONTACTS_TABLE_WORDS contactColumns contacts',
    'CRM_PROPOSALS_TABLE_NAME PROPOSALS_TABLE_WORDS proposalColumns proposals',
    'CRM_SIGNUPS_TABLE_NAME SIGNUPS_TABLE_WORDS signupColumns signups',
  ]);
  assert.match(s, /const contactColumns = useMemo\(\(\) => contactsTable\(\), \[\]\);/);
  assert.match(s, /const proposalColumns = useMemo\(\(\) => proposalsTable\(\), \[\]\);/);
  assert.match(s, /const signupColumns = useMemo\(\(\) => signupsTable\(\), \[\]\);/);
  assert.match(s, /empty=\{read\.ownerOnly \? PROPOSALS_OWNER_ONLY_WORDS : NO_PROPOSALS_WORDS\}/, 'anyone else reads the honest line for Proposals');
  assert.match(s, /empty=\{read\.ownerOnly \? SIGNUPS_OWNER_ONLY_WORDS : NO_SIGNUPS_WORDS\}/, 'and for Signups');
  assert.match(s, /<section className="min-w-0 space-y-2"/, 'a table scrolls in its own box (DataTable\'s overflow-x-auto); the section never widens the page');
  assert.match(s, /crmFailedWords\(read\.words\)/, 'a failed read says so with the route\'s words');
  assert.doesNotMatch(s, /method: '(POST|PATCH|PUT|DELETE)'|localStorage|sessionStorage|document\.cookie|StageStrip/, 'no write; nothing stored; no strip');
  for (const literal of ['Came in', 'What they need', 'Next step', 'Last touch', 'Signed up on', 'Signed up with', 'Email verified', 'What does done look like', 'Email and password', 'Not yet', 'By hand', 'Reading your contacts']) {
    assert.ok(!s.includes(`'${literal}`) && !s.includes(`>${literal}`), `"${literal}" is crmWords', not typed in the section`);
    assert.ok(!code(RULES).includes(`'${literal}'`), `"${literal}" is crmWords', not typed in the rules`);
  }
  // Before the read answers: the loading words, rendered on the server and the client alike.
  const html = renderToStaticMarkup(React.createElement(CrmSection));
  assert.match(html, /data-crm-loading/);
  assert.ok(html.includes(CRM_LOADING_WORDS));
  assert.equal(crmFailedWords('Unauthorized'), 'The CRM could not be read — Unauthorized');
});

// ── T5 · THE ROUTE (ruling C, ruling 4) ─────────────────────────────────────

test('T5 the route: the caller first — 401, then 404 — then whose rows, decided on the server; every read scoped; no client id; no write; not public', () => {
  const r = code(ROUTE);
  const at = (s: string) => { const i = r.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const order = [
    'export async function GET() {',
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    'const owner = isAdminUser(user.id);',
    'const workingRows = await prisma.crm_contacts.findMany({',
    'if (owner) {',
    'prisma.proposals.findMany({',
  ].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the cookie, the user, the owner question, then the reads');
  assert.ok(r.indexOf('prisma.') > at("if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });"), 'no read before the 401');
  assert.equal((r.match(/prisma\.users\.findFirst\(/g) ?? []).length, 1);
  // Never a client id: GET takes no request, and reads no query, body or header.
  assert.doesNotMatch(r, /searchParams|nextUrl|request\.json|headers\(\)|params/, 'nothing the client sends decides whose rows');
  // The reader's own working rows, every reader.
  assert.match(r, /prisma\.crm_contacts\.findMany\(\{\n\s*where: \{ user_id: user\.id \},/);
  // The owner's reads: every proposal; every users row but the reader's, without the password; the password question asked of the database.
  const ownerPart = r.slice(at('if (owner) {'));
  assert.match(ownerPart, /prisma\.users\.findMany\(\{\n\s*where: \{ id: \{ not: user\.id \} \},\n\s*orderBy: \{ createdAt: 'desc' \},\n\s*select: \{ id: true, email: true, name: true, createdAt: true, email_verified_at: true \},/);
  assert.match(ownerPart, /prisma\.users\.findMany\(\{ where: \{ id: \{ not: user\.id \}, password: '' \}, select: \{ id: true \} \}\)/);
  assert.doesNotMatch(r, /password: true|\.password\b/, 'the hash never leaves the database');
  assert.match(ownerPart, /prisma\.user\.findMany\(\{ where: \{ email: \{ not: null \} \}, select: \{ email: true, accounts: \{ select: \{ provider: true \} \} \} \}\)/, 'the NextAuth providers');
  assert.match(ownerPart, /where: \{ userId: \{ in: userRows\.map\(\(u\) => u\.id\) \}, status: 'active', OR: \[\{ currentPeriodEnd: null \}, \{ currentPeriodEnd: \{ gt: now \} \}\] \},/, 'each signup\'s own ACTIVE entitlements — entitlements.ts\'s rule');
  assert.doesNotMatch(r, /status: true|ownerNotes|owner_notes|ipHash|ip_hash/, 'never status, owner notes or the IP hash');
  assert.match(r, /return NextResponse\.json\(\{ ownerOnly: !owner, contacts, proposals, signups, said: \[\] as string\[\] \}\);/);
  // Reads only.
  assert.doesNotMatch(r, /\.(create|update|upsert|delete|deleteMany|createMany|updateMany)\(|export async function (POST|PATCH|PUT|DELETE)/, 'it writes nothing');
  // A failure is said: AdminConfigError (ADMIN_USER_ID unset) and a CrmLawError answer 500 with their words; anything else fails closed.
  assert.match(r, /if \(error instanceof AdminConfigError \|\| error instanceof CrmLawError\) return NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\);\n\s*return failClosedResponse\('CRM GET', 'Failed to load the CRM', error\);/);
  assert.doesNotMatch(code(MIDDLEWARE), /'\/api\/crm'|'\/crm'/, 'not in PUBLIC_PATHS — a cookie-less request is sent to / before the route runs');
});

// ── T6 · THE PAGE (ruling A) ────────────────────────────────────────────────

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return /\.tsx$/.test(name) ? [full] : [];
  });
}

test('T6 the page: CRM\'s own — the opener (family, name, registry line) and the one mount; no strip; the section mounted nowhere else', () => {
  const page = code(PAGE);
  assert.match(page, /^'use client';/);
  assert.match(page, /<AppLayout page>\n\s*<ToolOpener tools=\{\[navToolByName\('CRM', TOOL_GATE\)\]\} \/>\n\s*<div className="space-y-3" data-tool-page="CRM">\n\s*<CrmSection \/>\n\s*<\/div>\n\s*<\/AppLayout>/);
  assert.deepEqual(PHASES_RENDERED_AT['/crm'], [], 'no strip, no phase');
  const root = resolve(process.cwd(), 'src');
  const mounts = [...pageFiles(join(root, 'app')), ...pageFiles(join(root, 'components'))]
    .filter((f) => /<CrmSection\b/.test(code(f.slice(process.cwd().length + 1))))
    .map((f) => f.slice(process.cwd().length + 1));
  assert.deepEqual(mounts, [PAGE], 'one mount, on its own page');
});

// ── T7 · THE REGISTRY, THE CENSUS, THE GATE, THE RAIL, THE PLANS ROW ────────

test('T7 CRM is PARTIAL at /crm with discover and record, no ownTable, its why and customer verbatim; the citation\'s lines say what it says', () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'CRM');
  assert.ok(t);
  assert.equal(t.status, 'PARTIAL');
  assert.deepEqual(t.beats, { discover: true, decide: false, commit: false, record: true });
  assert.equal(t.home, '/crm');
  assert.equal(t.ownTable, null, 'ruling 2: no ownTable — the deck\'s step 6 does not move');
  assert.equal(t.ownTableRoute, undefined);
  assert.equal(t.links, undefined);
  assert.equal(t.why, 'the people you sell to — every proposal from your form and every signup, read in three tables; a stage or next step cannot be set yet, and no one can be added by hand (CRM-01b)');
  assert.equal(t.customer, 'See the people you sell to — every proposal from your form and every signup — in three tables; setting a stage or a next step, and adding someone by hand, are not built yet.');
  const reg = code(REGISTRY);
  assert.ok(reg.includes("slug: 'crm', status: 'PARTIAL', beats: some({ discover: true, record: true }), home: '/crm',"), 'the some() form on its slug line');
  assert.ok(comments(REGISTRY).includes("its own route, /api/crm, only reads; crm_contacts (CRM-01a's migration) is written by nothing until CRM-01b"), 'Bill Pay\'s shape (ruling 2)');
  const lineOf = (file: string, n: number): string => code(file).split('\n')[n - 1] ?? '';
  const n = (re: RegExp): number => { const m = t.citation.match(re); assert.ok(m, String(re)); return Number(m[1]); };
  assert.match(lineOf(ROUTE, n(/^discover: src\/app\/api\/crm\/route\.ts:(\d+) \(GET \/api\/crm/)), /^export async function GET\(/);
  assert.match(lineOf(SECTION, n(/record: src\/components\/crm\/CrmSection\.tsx:(\d+) \(the three tables/)), /name=\{CRM_CONTACTS_TABLE_NAME\}/);
  assert.match(t.citation, /\/owner stays the founder's proposals inbox until CRM-01b \(src\/app\/api\/owner\/proposals\/route\.ts\)$/);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
});

test('T7 the census: 5 · 9 · 11 — the constant, the two dated lines over it, the header\'s count line and its history (ruling 1)', () => {
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  assert.deepEqual(statusCounts(), { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  const notes = comments(REGISTRY);
  assert.ok(notes.includes('// CRM-01a census (Alex, 2026-11-07): CRM PARTIAL — contacts, proposals and signups read in three tables; nothing written yet.'));
  assert.ok(notes.includes('// One NOT_BUILT fewer, one PARTIAL more. 5 · 8 · 12 → 5 · 9 · 11.'));
  const header = notes.replace(/\s*\n\s*\*\s*/g, ' ');
  assert.ok(header.includes('5 LIVE · 9 PARTIAL · 11 NOT_BUILT — the counts are a LAW below; bump them only with a new dated census.'));
  assert.ok(header.includes('hours; 4 LIVE · 8 PARTIAL · 13 NOT_BUILT stood for the hours between. BILLPAY-01 census, Alex, 2026-10-28: Bill Pay NOT_BUILT → PARTIAL — the due list and the manual link; 5 LIVE · 7 PARTIAL · 13 NOT_BUILT stood from TIME-03 until then. CRM-01a census, Alex, 2026-11-07: CRM NOT_BUILT → PARTIAL — the three tables read; 5 LIVE · 8 PARTIAL · 12 NOT_BUILT stood from BILLPAY-01 until then.)'), 'after TIME-03\'s sentence, the two');
  assert.doesNotMatch(header, /5 LIVE · 7 PARTIAL · 13 NOT_BUILT — the counts are a LAW/, 'the stale count line is gone');
});

test('T7 the gate is null (the route is cookie-gated for every account); the rail opens /crm under MONEY IN; the opener prints the registry line; the free set does not move', () => {
  assert.equal(TOOL_GATE.CRM, null);
  const t = TOOL_REGISTRY.find((x) => x.name === 'CRM');
  assert.ok(t);
  const family = navFamilies(TOOL_GATE).find((f) => f.name === 'MONEY IN');
  assert.ok(family);
  const row = family.tools.find((x) => x.name === 'CRM');
  assert.ok(row);
  assert.equal(row.href, '/crm', 'the rail opens it, by derivation');
  assert.equal(row.status, 'PARTIAL');
  assert.equal(navToolByName('CRM', TOOL_GATE).line, t.why, 'the opener\'s line is the registry\'s why');
  assert.deepEqual(FREE_TOOLS.map((x) => x.name), ['Tasks', 'Time', 'Expenses', 'Travel'], 'a PARTIAL tool is not in the free set');
});

test('T7 the plans row derives ◐ with the customer line (ruling 10); /owner keeps its door, its menu note re-dated (ruling 7)', () => {
  const row = CAPABILITY_GROUPS.flatMap((g) => g.rows).find((r) => r.label === 'The people you sell to, and where each one stands');
  assert.ok(row, 'the row, its label unchanged');
  assert.deepEqual(row.tools, ['CRM']);
  assert.equal(row.module, 'business');
  const t = TOOL_REGISTRY.find((x) => x.name === 'CRM');
  assert.ok(t);
  for (const plan of PLANS.filter((p) => p.modules.includes('business'))) assert.equal(CELL_MARK[cellState(plan, row)], '◐', `${plan.name}: derived from the registry — PARTIAL`);
  assert.deepEqual(capabilityNotes(row), [{ name: 'CRM', status: 'PARTIAL', customer: t.customer }]);
  assert.ok(comments(SHELL_MENU).includes("// CRM-01a (2026-11-07): CRM is PARTIAL (read-only at /crm); /owner stays the founder's proposals inbox until CRM-01b retires it — it keeps its door here."));
  assert.doesNotMatch(comments(SHELL_MENU), /TRUTH-01: CRM is NOT_BUILT/);
  assert.deepEqual(OWNER_UTILITIES.find((u) => u.href === '/owner'), { label: 'Owner · proposals inbox', href: '/owner', why: "the founder's proposals inbox behind requireAdmin — src/app/api/owner/proposals/route.ts; not a customer's CRM" });
});

// ── T8 · THE WORKING TABLE: THE MIGRATION, THE SCHEMA, THE CLIENT (ruling E) ─

test('T8 the migration: the newest; one table — the four CHECKs by name, the partial unique index, the cascade to users — nothing written, nothing dropped; authored, not applied', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261106120000_one_form_01_close_need', 'right after ONE-FORM-01\'s');
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE TABLE "crm_contacts" \(\n\s+"id"\s+UUID NOT NULL DEFAULT gen_random_uuid\(\),\n\s+"user_id"\s+TEXT NOT NULL,\n\s+"source"\s+VARCHAR\(20\) NOT NULL,\n\s+"source_ref"\s+TEXT,\n\s+"name"\s+VARCHAR\(255\),\n\s+"business"\s+TEXT,\n\s+"email"\s+VARCHAR\(255\),\n\s+"stage"\s+VARCHAR\(20\) NOT NULL DEFAULT 'new',\n\s+"next_step"\s+TEXT,\n\s+"last_touch_at"\s+TIMESTAMPTZ\(6\),\n\s+"created_at"\s+TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\s+"updated_at"\s+TIMESTAMP\(3\) NOT NULL,\n\s+CONSTRAINT "crm_contacts_pkey" PRIMARY KEY \("id"\),/);
  assert.match(sql, /CONSTRAINT "crm_contacts_source_chk" CHECK \("source" IN \('proposal', 'signup', 'manual'\)\)/);
  assert.match(sql, /CONSTRAINT "crm_contacts_stage_chk"\s+CHECK \("stage" IN \('new', 'reviewing', 'sent', 'won', 'lost'\)\)/);
  assert.match(sql, /CONSTRAINT "crm_contacts_ref_chk"\s+CHECK \(\("source" = 'manual'\) = \("source_ref" IS NULL\)\)/);
  assert.match(sql, /CONSTRAINT "crm_contacts_manual_chk" CHECK \("source" <> 'manual' OR \("name" IS NOT NULL AND "email" IS NOT NULL\)\)/);
  assert.equal((sql.match(/CHECK \(/g) ?? []).length, 4, 'four CHECKs');
  assert.match(sql, /ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  assert.match(sql, /CREATE UNIQUE INDEX "crm_contacts_user_source_ref_key" ON "crm_contacts" \("user_id", "source", "source_ref"\) WHERE "source_ref" IS NOT NULL;/);
  assert.match(sql, /CREATE INDEX "crm_contacts_user_id_idx" ON "crm_contacts" \("user_id"\);/);
  assert.equal((sql.match(/^(CREATE|ALTER) /gm) ?? []).length, 4, 'one table, one key, two indexes — nothing else');
  assert.doesNotMatch(sql, /\bINSERT INTO\b|^\s*UPDATE\s|\bDELETE FROM\b|\bDROP\b|\bTRUNCATE\b|ADD VALUE/m, 'no row written, nothing dropped, no enum touched');
  assert.match(comments(MIGRATION).replace(/\n--\s*/g, ' '), /AUTHORED, NOT APPLIED to any shared database\. Claude Code cannot reach Azure Postgres\. It applies at the production deploy after the merge/);
});

test('T8 the schema: model crm_contacts column for column with the SQL, cascading to users, the plain index modeled, the partial one named; users names the relation; the client knows it', () => {
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model crm_contacts {'), schema.indexOf('@@map("crm_contacts")'));
  for (const field of [
    /^\s+id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid[ \t]*$/m,
    /^\s+user_id\s+String[ \t]*$/m,
    /^\s+source\s+String\s+@db\.VarChar\(20\)[ \t]*$/m,
    /^\s+source_ref\s+String\?[ \t]*$/m,
    /^\s+name\s+String\?\s+@db\.VarChar\(255\)[ \t]*$/m,
    /^\s+business\s+String\?[ \t]*$/m,
    /^\s+email\s+String\?\s+@db\.VarChar\(255\)[ \t]*$/m,
    /^\s+stage\s+String\s+@default\("new"\) @db\.VarChar\(20\)[ \t]*$/m,
    /^\s+next_step\s+String\?[ \t]*$/m,
    /^\s+last_touch_at\s+DateTime\?\s+@db\.Timestamptz\(6\)[ \t]*$/m,
    /^\s+created_at\s+DateTime\s+@default\(now\(\)\)[ \t]*$/m,
    /^\s+updated_at\s+DateTime\s+@updatedAt[ \t]*$/m,
    /^\s+users\s+users\s+@relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)[ \t]*$/m,
    /@@index\(\[user_id\], map: "crm_contacts_user_id_idx"\)/,
  ]) assert.match(model, field);
  assert.match(schema, /^\s+crm_contacts\s+crm_contacts\[\][ \t]*$/m, 'users names the relation');
  assert.ok(schema.trimEnd().endsWith('@@map("crm_contacts")\n}'), 'the schema\'s last model — no line above it moved');
  const notes = comments(SCHEMA);
  for (const check of ['crm_contacts_source_chk', 'crm_contacts_stage_chk', 'crm_contacts_ref_chk', 'crm_contacts_manual_chk', 'crm_contacts_user_source_ref_key']) assert.ok(notes.includes(check), `the schema names ${check}`);
  assert.ok(notes.includes(`prisma/migrations/${MIGRATION_DIR}`));
  assert.equal(Prisma.ModelName.crm_contacts, 'crm_contacts');
  assert.deepEqual(Object.keys(Prisma.Crm_contactsScalarFieldEnum), ['id', 'user_id', 'source', 'source_ref', 'name', 'business', 'email', 'stage', 'next_step', 'last_touch_at', 'created_at', 'updated_at']);
});
