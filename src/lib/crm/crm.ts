/**
 * CRM-01a (Alex, 2026-11-06, rulings B and C; 2026-11-07, rulings 3, 5 and 6) — THE CRM'S RULES: the people you sell to,
 * in three flat tables. PURE: no fetch, no env, no clock, no React. GET /api/crm (src/app/api/crm/route.ts) reads the rows
 * and hands them in; the page (src/components/crm/CrmSection.tsx) prints the specs below through the shared DataTable.
 *
 *   needWords(need)            what a proposal asked for — the form's chip: SERVICE_NEED_LABELS for the five service
 *                              words, closeChoiceWords(CLOSE_OFFER) for the close's; any other word THROWS by name (the
 *                              proposals CHECK allows no other — one would be a data error);
 *   signedUpWith(user, providers)   "Email and password" for a password; for a provider signup (users.password '' —
 *                              nextAuthOptions.ts signIn creates such rows) the NextAuth Account.provider of the User whose
 *                              email is the same, case-insensitively; none THROWS by name;
 *   planWords(keys)            each ACTIVE entitlement key named by the offer that carries it (src/lib/offer.ts OFFERS),
 *                              " · "-joined; none → "Free"; a key no offer names THROWS by name;
 *   verifiedWords(instant)     "Yes — <the viewer's day>" or "Not yet";
 *   proposalRowsOf · signupRowsOf · contactsOf   the three tables' rows, newest first — contactsOf merges every
 *                              proposal and every signup handed in with the reader's working rows (crm_contacts): a
 *                              contact with no working row reads as new (nobody has touched it — not an imputed value);
 *   contactsTable · proposalsTable · signupsTable   the specs, in the ruled orders; their CSV file names.
 *
 * DATES (ruling 5): created_at, email_verified_at and last_touch_at are EVENT INSTANTS — drawn as the viewer's day through
 * work.ts instantDayWords (instantColumn), sorted by the instant, written to the CSV as the instant; hard_deadline is a
 * DAY (@db.Date) — drawn through work.ts dayWords, written as the ISO day. The spec's text comes from work.ts, as Bill
 * Pay's does (billPay.ts) — no formatter here, none in the component.
 *
 * THE LAWS are at the functions, not at module scope: a record that contradicts itself is reported by name, never
 * smoothed (a password-less user with no provider account; an active key no offer names; a need the form does not hold;
 * a working row that names a source row the read did not return; a stage outside the five; a list field that is not a
 * list of words; a contact touched after today).
 */

import type { TableColumn } from '@/lib/table/columns';
import { dayWords, instantColumn, instantDayWords, textColumn, valueColumn } from '@/lib/operations/work';
import { OFFERS } from '@/lib/offer';
import { PROPOSAL_NEEDS, SERVICE_NEEDS, SERVICE_NEED_LABELS, type ServiceNeed } from '@/lib/proposalNeeds';
import { CLOSE_OFFER } from '@/lib/offer/close';
import { closeChoiceWords } from '@/lib/offer/closeWords';
import {
  CONTACT_HEAD_WORDS, EMAIL_AND_PASSWORD_WORDS, FREE_PLAN_WORDS, FROM_WORDS, LIST_JOIN, NOT_YET_WORDS, PROPOSAL_HEAD_WORDS,
  SIGNUP_HEAD_WORDS, VERIFIED_PREFIX_WORDS, signedUpNeedWords,
} from './crmWords';

/** The five stage words — proposals.status's own (ruling E; the migration's crm_contacts_stage_chk). ONE vocabulary. */
export const CRM_STAGES = ['new', 'reviewing', 'sent', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];
/** Where a working row's contact came from (crm_contacts_source_chk). */
export const CRM_SOURCES = ['proposal', 'signup', 'manual'] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

export class CrmLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrmLawError';
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// ── WHAT THE ROUTE HANDS IN ─────────────────────────────────────────────────

/** A proposals row as read — every field of the form; never status, owner_notes or ip_hash (ruling B.2). Instants and days as ISO strings. */
export interface ProposalInput {
  readonly id: string;
  readonly created_at: string;
  readonly name: string;
  readonly email: string;
  readonly business: string;
  readonly need: string;
  /** Json in the table — a list of module words. */
  readonly modules: unknown;
  readonly start_window: string;
  readonly budget_range: string;
  readonly current_stack: string;
  /** 'YYYY-MM-DD' or null. */
  readonly hard_deadline: string | null;
  readonly deadline_driver: string | null;
  /** Json in the table — a list of links, or null. */
  readonly links: unknown;
  readonly team_size: string | null;
  readonly referral_source: string | null;
  readonly notes_from_them: string;
}

/** A users row as read: `passwordless` is users.password === '' — the route asks the database, the hash never leaves it. */
export interface UserInput {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly created_at: string;
  readonly passwordless: boolean;
  readonly email_verified_at: string | null;
}

/** A crm_contacts row as read (the reader's own). */
export interface WorkingInput {
  readonly id: string;
  readonly source: string;
  readonly source_ref: string | null;
  readonly name: string | null;
  readonly business: string | null;
  readonly email: string | null;
  readonly stage: string;
  readonly next_step: string | null;
  readonly last_touch_at: string | null;
  readonly created_at: string;
}

// ── THE THREE TABLES' ROWS ──────────────────────────────────────────────────

export interface ProposalRow {
  readonly id: string;
  readonly created_at: string;
  readonly name: string;
  readonly email: string;
  readonly business: string;
  readonly need: string;
  /** The form's chip for the need (needWords). */
  readonly need_words: string;
  readonly modules: readonly string[];
  readonly start_window: string;
  readonly budget_range: string;
  readonly current_stack: string;
  readonly hard_deadline: string | null;
  readonly deadline_driver: string | null;
  readonly links: readonly string[] | null;
  readonly team_size: string | null;
  readonly referral_source: string | null;
  readonly notes_from_them: string;
}

export interface SignupRow {
  readonly id: string;
  readonly created_at: string;
  readonly name: string;
  readonly email: string;
  /** signedUpWith's words. */
  readonly signed_up_with: string;
  readonly email_verified_at: string | null;
  /** planWords' words. */
  readonly plan: string;
}

export interface ContactRow {
  /** 'proposal:<id>' · 'signup:<id>' · 'manual:<working row id>' — the row's own key. */
  readonly key: string;
  /** The instant the contact came in. */
  readonly came_in: string;
  readonly name: string | null;
  readonly business: string | null;
  readonly email: string | null;
  readonly from: CrmSource;
  readonly need: string | null;
  readonly budget: string | null;
  readonly start: string | null;
  readonly stage: CrmStage;
  readonly next_step: string | null;
  /** The instant of the last touch, or null. */
  readonly last_touch: string | null;
}

// ── THE WORDS OF ONE FACT ───────────────────────────────────────────────────

const isServiceNeed = (need: string): need is ServiceNeed => (SERVICE_NEEDS as readonly string[]).includes(need);

/** What a proposal asked for, in the form's own words — on any day (closeChoiceWords does not depend on bookBy). */
export function needWords(need: string): string {
  if (isServiceNeed(need)) return SERVICE_NEED_LABELS[need];
  if (need === CLOSE_OFFER.need) return closeChoiceWords(CLOSE_OFFER);
  throw new CrmLawError(`needWords: "${need}" is not a need the proposal form holds (${PROPOSAL_NEEDS.join(', ')}) — a data error, reported`);
}

/** How a signup signed up. `providers` maps a lower-case email to the NextAuth providers of the User with that email. */
export function signedUpWith(user: Pick<UserInput, 'email' | 'passwordless'>, providers: ReadonlyMap<string, readonly string[]>): string {
  if (!user.passwordless) return EMAIL_AND_PASSWORD_WORDS;
  const found = providers.get(user.email.trim().toLowerCase()) ?? [];
  if (found.length === 0) {
    throw new CrmLawError(`signedUpWith: ${user.email} has no password and no provider account — a record that contradicts itself (a password-less user is made only by a provider sign-in, nextAuthOptions.ts signIn)`);
  }
  return [...new Set(found)].sort().join(LIST_JOIN);
}

/** A signup's plan: its active entitlement keys, each named by the offer that carries it; none is "Free". */
export function planWords(activeKeys: readonly string[]): string {
  const keys = [...new Set(activeKeys)];
  for (const key of keys) {
    if (!OFFERS.some((o) => o.key === key)) throw new CrmLawError(`planWords: the active key "${key}" is no offer's (src/lib/offer.ts OFFERS) — a key outside the offers is a data error, reported`);
  }
  if (keys.length === 0) return FREE_PLAN_WORDS;
  return OFFERS.filter((o) => keys.includes(o.key)).map((o) => o.label).join(LIST_JOIN);
}

/** "Yes — <the viewer's day>" or "Not yet". */
export function verifiedWords(emailVerifiedAt: string | null): string {
  return emailVerifiedAt === null ? NOT_YET_WORDS : `${VERIFIED_PREFIX_WORDS}${instantDayWords(emailVerifiedAt)}`;
}

/** A Json field that must be a list of words; null only where the column allows it. */
function wordsOf(value: unknown, what: string, nullable: boolean): string[] | null {
  if (value === null && nullable) return null;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw new CrmLawError(`${what} is not a list of words — a data error, reported`);
  return value as string[];
}

const newestFirst = <T>(rows: readonly T[], instantOf: (row: T) => string, keyOf: (row: T) => string): T[] =>
  [...rows].sort((a, b) => (instantOf(b) === instantOf(a) ? keyOf(a).localeCompare(keyOf(b)) : instantOf(b).localeCompare(instantOf(a))));

// ── THE ROWS ────────────────────────────────────────────────────────────────

/** PROPOSALS: one row per proposals row, newest first, each with its need in the form's words. */
export function proposalRowsOf(proposals: readonly ProposalInput[]): ProposalRow[] {
  return newestFirst(proposals.map((p): ProposalRow => ({
    id: p.id, created_at: p.created_at, name: p.name, email: p.email, business: p.business, need: p.need, need_words: needWords(p.need),
    modules: wordsOf(p.modules, `proposal ${p.id}: modules`, false) as string[], start_window: p.start_window, budget_range: p.budget_range,
    current_stack: p.current_stack, hard_deadline: p.hard_deadline, deadline_driver: p.deadline_driver, links: wordsOf(p.links, `proposal ${p.id}: links`, true),
    team_size: p.team_size, referral_source: p.referral_source, notes_from_them: p.notes_from_them,
  })), (r) => r.created_at, (r) => r.id);
}

/** SIGNUPS: one row per users row except the reader's own, newest first; each signup's plan is its OWN active keys (ruling 3). */
export function signupRowsOf(input: {
  readonly users: readonly UserInput[];
  readonly providers: ReadonlyMap<string, readonly string[]>;
  readonly activeKeys: ReadonlyMap<string, readonly string[]>;
  readonly readerId: string;
}): SignupRow[] {
  const rows = input.users.filter((u) => u.id !== input.readerId).map((u): SignupRow => ({
    id: u.id, created_at: u.created_at, name: u.name, email: u.email, signed_up_with: signedUpWith(u, input.providers),
    email_verified_at: u.email_verified_at, plan: planWords(input.activeKeys.get(u.id) ?? []),
  }));
  return newestFirst(rows, (r) => r.created_at, (r) => r.id);
}

const isStage = (stage: string): stage is CrmStage => (CRM_STAGES as readonly string[]).includes(stage);

/**
 * CONTACTS: every proposal and every signup handed in, and the reader's manual working rows, newest first. A contact's
 * Stage, Next step and Last touch are its working row's; with no working row it is new, with no next step and no touch.
 * `today` ('YYYY-MM-DD', handed in — no clock here) is the day a working row's last touch may not be after.
 */
export function contactsOf(input: {
  readonly proposals: readonly ProposalRow[];
  readonly signups: readonly SignupRow[];
  readonly working: readonly WorkingInput[];
  readonly today: string;
}): ContactRow[] {
  if (!ISO_DAY.test(input.today)) throw new CrmLawError(`contactsOf: today "${input.today}" is not YYYY-MM-DD`);
  const bySource = new Map<string, WorkingInput>();
  const manual: WorkingInput[] = [];
  for (const w of input.working) {
    if (!(CRM_SOURCES as readonly string[]).includes(w.source)) throw new CrmLawError(`contactsOf: working row ${w.id} says source "${w.source}" — not proposal, signup or manual`);
    if (!isStage(w.stage)) throw new CrmLawError(`contactsOf: working row ${w.id} says stage "${w.stage}" — not one of ${CRM_STAGES.join(', ')}`);
    if (w.last_touch_at !== null && w.last_touch_at.slice(0, 10) > input.today) throw new CrmLawError(`contactsOf: working row ${w.id} was last touched on ${w.last_touch_at.slice(0, 10)}, after today (${input.today}) — a record from the future`);
    if (w.source === 'manual') { manual.push(w); continue; }
    const key = `${w.source}:${w.source_ref}`;
    if (bySource.has(key)) throw new CrmLawError(`contactsOf: two working rows name ${key} — one per source row`);
    bySource.set(key, w);
  }
  const used = new Set<string>();
  const working = (key: string): Pick<ContactRow, 'stage' | 'next_step' | 'last_touch'> => {
    const w = bySource.get(key);
    if (w === undefined) return { stage: 'new', next_step: null, last_touch: null };
    used.add(key);
    return { stage: w.stage as CrmStage, next_step: w.next_step, last_touch: w.last_touch_at };
  };
  const rows: ContactRow[] = [
    ...input.proposals.map((p): ContactRow => ({
      key: `proposal:${p.id}`, came_in: p.created_at, name: p.name, business: p.business, email: p.email, from: 'proposal',
      need: p.need_words, budget: p.budget_range, start: p.start_window, ...working(`proposal:${p.id}`),
    })),
    ...input.signups.map((s): ContactRow => ({
      key: `signup:${s.id}`, came_in: s.created_at, name: s.name, business: null, email: s.email, from: 'signup',
      need: signedUpNeedWords(s.plan), budget: null, start: null, ...working(`signup:${s.id}`),
    })),
    ...manual.map((m): ContactRow => ({
      key: `manual:${m.id}`, came_in: m.created_at, name: m.name, business: m.business, email: m.email, from: 'manual',
      need: null, budget: null, start: null, stage: m.stage as CrmStage, next_step: m.next_step, last_touch: m.last_touch_at,
    })),
  ];
  for (const key of bySource.keys()) {
    if (!used.has(key)) throw new CrmLawError(`contactsOf: a working row names ${key}, which the read did not return — a record that contradicts itself`);
  }
  return newestFirst(rows, (r) => r.came_in, (r) => r.key);
}

// ── THE TABLES (ruling B — the house's DataTable, work.ts's column factories) ─

export const CONTACT_COLUMNS = ['came_in', 'name', 'business', 'email', 'from', 'need', 'budget', 'start', 'stage', 'next_step', 'last_touch'] as const;
export type ContactColumn = (typeof CONTACT_COLUMNS)[number];
export const PROPOSAL_COLUMNS = ['came_in', 'name', 'email', 'business', 'need', 'modules', 'timeline', 'budget', 'tools_today', 'deadline', 'why_that_date', 'links', 'team', 'heard_from', 'done'] as const;
export type ProposalColumn = (typeof PROPOSAL_COLUMNS)[number];
export const SIGNUP_COLUMNS = ['signed_up_on', 'name', 'email', 'signed_up_with', 'email_verified', 'plan'] as const;
export type SignupColumn = (typeof SIGNUP_COLUMNS)[number];

export const CRM_CONTACTS_TABLE_NAME = 'crm-contacts';
export const CRM_PROPOSALS_TABLE_NAME = 'crm-proposals';
export const CRM_SIGNUPS_TABLE_NAME = 'crm-signups';
export const CRM_CONTACTS_CSV = 'crm-contacts.csv';
export const CRM_PROPOSALS_CSV = 'crm-proposals.csv';
export const CRM_SIGNUPS_CSV = 'crm-signups.csv';

const joinedOrNull = (list: readonly string[] | null): string | null => (list === null || list.length === 0 ? null : list.join(LIST_JOIN));

/** CONTACTS: Came in · Name · Business · Email · From · What they need · Budget · Start · Stage · Next step · Last touch. */
export function contactsTable(): readonly TableColumn<ContactRow, ContactColumn>[] {
  const h = CONTACT_HEAD_WORDS;
  return [
    instantColumn<ContactRow, ContactColumn>('came_in', h.came_in, (r) => r.came_in),
    valueColumn<ContactRow, ContactColumn>('name', h.name, (r) => r.name),
    textColumn<ContactRow, ContactColumn>('business', h.business, (r) => r.business),
    valueColumn<ContactRow, ContactColumn>('email', h.email, (r) => r.email),
    valueColumn<ContactRow, ContactColumn>('from', h.from, (r) => FROM_WORDS[r.from]),
    textColumn<ContactRow, ContactColumn>('need', h.need, (r) => r.need),
    valueColumn<ContactRow, ContactColumn>('budget', h.budget, (r) => r.budget),
    valueColumn<ContactRow, ContactColumn>('start', h.start, (r) => r.start),
    valueColumn<ContactRow, ContactColumn>('stage', h.stage, (r) => r.stage),
    textColumn<ContactRow, ContactColumn>('next_step', h.next_step, (r) => r.next_step),
    instantColumn<ContactRow, ContactColumn>('last_touch', h.last_touch, (r) => r.last_touch),
  ];
}

/** PROPOSALS: every field of the form in the form's order. */
export function proposalsTable(): readonly TableColumn<ProposalRow, ProposalColumn>[] {
  const h = PROPOSAL_HEAD_WORDS;
  return [
    instantColumn<ProposalRow, ProposalColumn>('came_in', h.came_in, (r) => r.created_at),
    valueColumn<ProposalRow, ProposalColumn>('name', h.name, (r) => r.name),
    valueColumn<ProposalRow, ProposalColumn>('email', h.email, (r) => r.email),
    textColumn<ProposalRow, ProposalColumn>('business', h.business, (r) => r.business),
    valueColumn<ProposalRow, ProposalColumn>('need', h.need, (r) => r.need_words),
    textColumn<ProposalRow, ProposalColumn>('modules', h.modules, (r) => joinedOrNull(r.modules)),
    valueColumn<ProposalRow, ProposalColumn>('timeline', h.timeline, (r) => r.start_window),
    valueColumn<ProposalRow, ProposalColumn>('budget', h.budget, (r) => r.budget_range),
    textColumn<ProposalRow, ProposalColumn>('tools_today', h.tools_today, (r) => r.current_stack),
    valueColumn<ProposalRow, ProposalColumn>('deadline', h.deadline, (r) => (r.hard_deadline === null ? null : dayWords(r.hard_deadline)), (r) => r.hard_deadline),
    textColumn<ProposalRow, ProposalColumn>('why_that_date', h.why_that_date, (r) => r.deadline_driver),
    textColumn<ProposalRow, ProposalColumn>('links', h.links, (r) => joinedOrNull(r.links)),
    valueColumn<ProposalRow, ProposalColumn>('team', h.team, (r) => r.team_size),
    valueColumn<ProposalRow, ProposalColumn>('heard_from', h.heard_from, (r) => r.referral_source),
    textColumn<ProposalRow, ProposalColumn>('done', h.done, (r) => r.notes_from_them),
  ];
}

/** SIGNUPS: Signed up on · Name · Email · Signed up with · Email verified · Plan. */
export function signupsTable(): readonly TableColumn<SignupRow, SignupColumn>[] {
  const h = SIGNUP_HEAD_WORDS;
  return [
    instantColumn<SignupRow, SignupColumn>('signed_up_on', h.signed_up_on, (r) => r.created_at),
    valueColumn<SignupRow, SignupColumn>('name', h.name, (r) => r.name),
    valueColumn<SignupRow, SignupColumn>('email', h.email, (r) => r.email),
    valueColumn<SignupRow, SignupColumn>('signed_up_with', h.signed_up_with, (r) => r.signed_up_with),
    valueColumn<SignupRow, SignupColumn>('email_verified', h.email_verified, (r) => verifiedWords(r.email_verified_at), (r) => r.email_verified_at),
    valueColumn<SignupRow, SignupColumn>('plan', h.plan, (r) => r.plan),
  ];
}
