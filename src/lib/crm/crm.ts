/**
 * CRM-01a (Alex, 2026-11-06, rulings B and C; 2026-11-07, rulings 3, 5 and 6; CRM-01b, 2026-11-07) — THE CRM'S RULES: the
 * people you sell to, in three flat tables. PURE: no fetch, no env, no clock, no React. GET /api/crm (src/app/api/crm/route.ts)
 * reads the rows and hands them in; the page (src/components/crm/CrmSection.tsx) prints the specs below through the shared
 * DataTable; the writes (src/app/api/crm/contacts/route.ts) name a row by its ContactRow.key, parsed by contactKeyOf.
 *
 *   needWords(need)            what a proposal asked for — SERVICES-01 (2026-11-08): the door's title (SERVICES in
 *                              src/lib/proposalNeeds.ts) for the six keys, LEGACY_NEED_TITLES for 'close' (the retired
 *                              close door's word, which old rows keep); any other word THROWS by name (the proposals
 *                              CHECK allows no other — one would be a data error);
 *   signedUpWith(user, providers)   "Email and password" for a password; for a provider signup (users.password '' —
 *                              nextAuthOptions.ts signIn creates such rows) the NextAuth Account.provider of the User whose
 *                              email is the same, case-insensitively; none THROWS by name;
 *   planWords(keys)            each ACTIVE entitlement key, never hidden, never replaced (the CRM-01a fix, ruling A): an
 *                              offer's key by the offer's label (src/lib/offer.ts OFFERS), then a tab key no offer names as
 *                              "tab: <key>",
 *                              then a legacy key (a Google category, or tab:operations) as "legacy: <key>" — " · "-joined;
 *                              none → "Free"; a key outside all of them THROWS by name;
 *   verifiedWords(instant)     "Yes — <the viewer's day>" or "Not yet";
 *   proposalRowsOf · signupRowsOf · contactsOf   the three tables' rows, newest first — contactsOf merges every
 *                              proposal and every signup handed in with the reader's working rows (crm_contacts): a
 *                              contact with no working row reads as new (nobody has touched it — not an imputed value);
 *   contactsTable · proposalsTable · signupsTable   the specs, in the ruled orders; their CSV file names;
 *   contactKeyOf(key)          CRM-01b: 'proposal:<id>' | 'signup:<id>' | 'manual:<id>' → { source, ref }, or a CrmLawError
 *                              by name — the writes' one way to name a row; CRM_NEXT_STEP_MAX the next step's length.
 *                              CRM-02 (2026-11-07): 'form:<submission id>' is the fourth shape — a submission of the
 *                              account's own intake form (src/lib/crm/forms.ts holds the form's own rules).
 *
 * DATES (ruling 5): created_at, email_verified_at and last_touch_at are EVENT INSTANTS — drawn as the viewer's day through
 * work.ts instantDayWords (instantColumn), sorted by the instant, written to the CSV as the instant; hard_deadline is a
 * DAY (@db.Date) — drawn through work.ts dayWords, written as the ISO day. The spec's text comes from work.ts, as Bill
 * Pay's does (billPay.ts) — no formatter here, none in the component.
 *
 * THE LAWS are at the functions, not at module scope: a record that contradicts itself is reported by name, never
 * smoothed (a password-less user with no provider account; an active key in no vocabulary; a need neither a door's nor legacy;
 * a working row that names a source row the read did not return; a stage outside the five; a list field that is not a
 * list of words; a contact touched after today; a manual working row with no name or no email — crm_contacts_manual_chk
 * forbids one, so its absence is a data error, never a blank on the row).
 */

import type { TableColumn } from '@/lib/table/columns';
import { dayWords, instantColumn, instantDayWords, textColumn, valueColumn } from '@/lib/operations/work';
import { OFFERS } from '@/lib/offer';
import { GOOGLE_CATEGORY_KEYS, TAB_ENTITLEMENT_KEYS } from '@/lib/categoryKeys';
import { LEGACY_NEED_TITLES, SERVICES, SERVICE_NEEDS, type LegacyNeed } from '@/lib/proposalNeeds';
import type { SubmissionRow } from './forms';
import {
  CONTACT_HEAD_WORDS, EMAIL_AND_PASSWORD_WORDS, FREE_PLAN_WORDS, FROM_WORDS, LEGACY_KEY_WORDS, LIST_JOIN, NOT_YET_WORDS,
  PROPOSAL_HEAD_WORDS, SIGNUP_HEAD_WORDS, STAGE_WORDS, TAB_KEY_WORDS, VERIFIED_PREFIX_WORDS, signedUpNeedWords,
} from './crmWords';

/** The five stage words — proposals.status's own (ruling E; the migration's crm_contacts_stage_chk). ONE vocabulary. */
export const CRM_STAGES = ['new', 'reviewing', 'sent', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];
/** Where a working row's contact came from (crm_contacts_source_chk). CRM-02 (2026-11-07): 'form' — a submission of the account's own intake form, source_ref its crm_form_submissions.id. */
export const CRM_SOURCES = ['proposal', 'signup', 'manual', 'form'] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];
/** CRM-01b (Alex, 2026-11-07, ruling A): a next step is at most this many characters. */
export const CRM_NEXT_STEP_MAX = 2000;

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
  /** The door's title for the need, or the legacy title for 'close' (needWords). */
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
  /** 'proposal:<id>' · 'signup:<id>' · 'manual:<working row id>' · 'form:<submission id>' (CRM-02) — the row's own key (contactKeyOf parses it). */
  readonly key: string;
  /** The instant the contact came in. */
  readonly came_in: string;
  /** Always present: a proposal's and a signup's by their tables, a manual row's by crm_contacts_manual_chk (CRM-01b). */
  readonly name: string;
  readonly business: string | null;
  readonly email: string;
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

const isLegacyNeed = (need: string): need is LegacyNeed => Object.keys(LEGACY_NEED_TITLES).includes(need);
const isSource = (source: string): source is CrmSource => (CRM_SOURCES as readonly string[]).includes(source);

/**
 * CRM-01b (Alex, 2026-11-07, ruling A): a ContactRow.key, read back — the one way a write names a row. The source is
 * the word before the first colon, the ref everything after it; anything else is refused by name.
 */
export function contactKeyOf(key: string): { readonly source: CrmSource; readonly ref: string } {
  if (typeof key !== 'string' || key === '') throw new CrmLawError('contactKeyOf: the key is empty — a row is named "<source>:<id>"');
  const at = key.indexOf(':');
  if (at === -1) throw new CrmLawError(`contactKeyOf: "${key}" has no colon — a row is named "<source>:<id>"`);
  const source = key.slice(0, at);
  const ref = key.slice(at + 1);
  if (!isSource(source)) throw new CrmLawError(`contactKeyOf: "${source}" is not a source — ${CRM_SOURCES.join(', ')}`);
  if (ref === '') throw new CrmLawError(`contactKeyOf: "${key}" names no row — the id after the colon is empty`);
  return { source, ref };
}

/**
 * What a proposal asked for — SERVICES-01 (Alex, 2026-11-08): the door's title for the six keys (an old row prints the
 * door's words today: 'setup' reads "Full setup"); the legacy title for 'close', the retired close door's word; any other
 * word throws by name. Nothing is mapped: 'close' is not read as any door.
 */
export function needWords(need: string): string {
  const door = SERVICES.find((s) => s.need === need);
  if (door !== undefined) return door.title;
  if (isLegacyNeed(need)) return LEGACY_NEED_TITLES[need];
  throw new CrmLawError(`needWords: "${need}" is neither a door of the proposal form (${SERVICE_NEEDS.join(', ')}) nor a word old rows keep (${Object.keys(LEGACY_NEED_TITLES).join(', ')}) — a data error, reported`);
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

/**
 * The one key the vocabulary retired that a row may still hold — src/lib/categoryKeys.ts:22-24 ("tab:operations is gone
 * from the vocabulary … A row a user still holds for it is inert"). No constant names it (it lives in comments only:
 * categoryKeys.ts:22, offer.ts:31, stripe.ts:38, RoutinesShowcaseSections.tsx:53), so it is typed here, once — the stop's
 * words below read this list.
 */
const RETIRED_TAB_KEYS = ['tab:operations'] as const;
const isOfferKey = (key: string): boolean => OFFERS.some((o) => o.key === key);
const isTabKey = (key: string): boolean => (TAB_ENTITLEMENT_KEYS as readonly string[]).includes(key);
/** A legacy key: a Google category key (not for sale, no route gates on it — offer.ts:342) or a retired tab key. */
const LEGACY_KEYS: readonly string[] = [...GOOGLE_CATEGORY_KEYS, ...RETIRED_TAB_KEYS];

/**
 * A signup's plan: EVERY active entitlement key it holds, each in the words of its kind (the CRM-01a fix, ruling A — a
 * legitimate row never stops the page). The Stripe webhook writes an offer's key (stripe/webhook/route.ts:95-99), but the
 * reader honours a tab key itself too (entitlements.ts:60 over offer.ts:144-145 keysGranting), and categoryKeys.ts records
 * the keys a row may still hold. So: an offer's key by the offer's label, in the offers' order; then a tab key no offer
 * names, as "tab: <key>", in TAB_ENTITLEMENT_KEYS' order; then a legacy key, as "legacy: <key>", in the vocabulary's
 * order — printed as itself, labeled, never hidden, never replaced. None is "Free". A key outside all of them THROWS.
 */
export function planWords(activeKeys: readonly string[]): string {
  const keys = [...new Set(activeKeys)];
  for (const key of keys) {
    if (!isOfferKey(key) && !isTabKey(key) && !LEGACY_KEYS.includes(key)) {
      throw new CrmLawError(`planWords: the active key "${key}" is in no vocabulary — no offer's (src/lib/offer.ts OFFERS), no tab key (TAB_ENTITLEMENT_KEYS), no legacy key (GOOGLE_CATEGORY_KEYS, ${RETIRED_TAB_KEYS.join(', ')} — src/lib/categoryKeys.ts) — a data error, reported`);
    }
  }
  if (keys.length === 0) return FREE_PLAN_WORDS;
  const offers = OFFERS.filter((o) => keys.includes(o.key)).map((o) => o.label);
  const tabs = TAB_ENTITLEMENT_KEYS.filter((k) => keys.includes(k) && !isOfferKey(k)).map((k) => `${TAB_KEY_WORDS}${k}`);
  const legacy = LEGACY_KEYS.filter((k) => keys.includes(k)).map((k) => `${LEGACY_KEY_WORDS}${k}`);
  return [...offers, ...tabs, ...legacy].join(LIST_JOIN);
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

/** PROPOSALS: one row per proposals row, newest first, each with its need in the door's title (the legacy title for 'close'). */
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
 * CONTACTS: every proposal and every signup handed in, every submission of the reader's own intake form (CRM-02 — from
 * 'form', its business the submission's, no need, budget or start), and the reader's manual working rows, newest first.
 * A contact's Stage, Next step and Last touch are its working row's; with no working row it is new, with no next step
 * and no touch. `today` ('YYYY-MM-DD', handed in — no clock here) is the day a working row's last touch may not be after.
 */
export function contactsOf(input: {
  readonly proposals: readonly ProposalRow[];
  readonly signups: readonly SignupRow[];
  readonly submissions: readonly SubmissionRow[];
  readonly working: readonly WorkingInput[];
  readonly today: string;
}): ContactRow[] {
  if (!ISO_DAY.test(input.today)) throw new CrmLawError(`contactsOf: today "${input.today}" is not YYYY-MM-DD`);
  const bySource = new Map<string, WorkingInput>();
  const manual: WorkingInput[] = [];
  for (const w of input.working) {
    if (!(CRM_SOURCES as readonly string[]).includes(w.source)) throw new CrmLawError(`contactsOf: working row ${w.id} says source "${w.source}" — not one of ${CRM_SOURCES.join(', ')}`);
    if (!isStage(w.stage)) throw new CrmLawError(`contactsOf: working row ${w.id} says stage "${w.stage}" — not one of ${CRM_STAGES.join(', ')}`);
    if (w.last_touch_at !== null && w.last_touch_at.slice(0, 10) > input.today) throw new CrmLawError(`contactsOf: working row ${w.id} was last touched on ${w.last_touch_at.slice(0, 10)}, after today (${input.today}) — a record from the future`);
    if (w.source === 'manual') {
      if (w.name === null || w.email === null) throw new CrmLawError(`contactsOf: working row ${w.id} was added by hand with no ${w.name === null ? 'name' : 'email'} — crm_contacts_manual_chk forbids it; a record that contradicts itself`);
      manual.push({ ...w, name: w.name, email: w.email });
      continue;
    }
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
    ...input.submissions.map((s): ContactRow => ({
      key: s.key, came_in: s.came_in, name: s.name, business: s.business, email: s.email, from: 'form',
      need: null, budget: null, start: null, ...working(s.key),
    })),
    ...manual.map((m): ContactRow => ({
      key: `manual:${m.id}`, came_in: m.created_at, name: m.name as string, business: m.business, email: m.email as string, from: 'manual',
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
    valueColumn<ContactRow, ContactColumn>('stage', h.stage, (r) => STAGE_WORDS[r.stage]), // CRM-01b: the words the row's select shows
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
