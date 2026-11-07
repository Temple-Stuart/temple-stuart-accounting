/**
 * CRM-01a (Alex, 2026-11-06, ruling D) — THE WORDS the CRM page is shown in, typed once, here; none in the components.
 * PURE: no fetch, no env, no clock, no React. Plain words a fifth-grader reads; no sales words, no emoji.
 *
 *   the three table names · the column heads, in each table's order · the From words · the Signups words ("Free",
 *   "Email and password", "Not yet", "Yes — ") · the empty lines · the platform owner's honest lines for anyone else ·
 *   the loading and failed words (the bill-pay shape: BILL_PAY_LOADING_WORDS / billPayFailedWords).
 */

export const CONTACTS_TABLE_WORDS = 'Contacts';
export const PROPOSALS_TABLE_WORDS = 'Proposals — every answer from the form, as it came in';
export const SIGNUPS_TABLE_WORDS = 'Signups — the fields collected at signup';

/** CONTACTS, in the ruled order: Came in · Name · Business · Email · From · What they need · Budget · Start · Stage · Next step · Last touch. */
export const CONTACT_HEAD_WORDS = {
  came_in: 'Came in', name: 'Name', business: 'Business', email: 'Email', from: 'From', need: 'What they need',
  budget: 'Budget', start: 'Start', stage: 'Stage', next_step: 'Next step', last_touch: 'Last touch',
} as const;

/** PROPOSALS, every field of the form in the form's order. */
export const PROPOSAL_HEAD_WORDS = {
  came_in: 'Came in', name: 'Name', email: 'Email', business: 'Business', need: 'Need', modules: 'Modules', timeline: 'Timeline',
  budget: 'Budget', tools_today: 'Tools today', deadline: 'Deadline', why_that_date: 'Why that date', links: 'Links', team: 'Team',
  heard_from: 'Heard from', done: 'What does done look like',
} as const;

/** SIGNUPS: Signed up on · Name · Email · Signed up with · Email verified · Plan. */
export const SIGNUP_HEAD_WORDS = {
  signed_up_on: 'Signed up on', name: 'Name', email: 'Email', signed_up_with: 'Signed up with', email_verified: 'Email verified', plan: 'Plan',
} as const;

/** Where a contact came from — the source a working row names. */
export const FROM_WORDS = { proposal: 'Proposal', signup: 'Signup', manual: 'By hand' } as const;

/** A signup's "What they need" in CONTACTS: the plan it holds. */
export const signedUpNeedWords = (plan: string): string => `Signed up — ${plan}`;

/** A signup that holds no active plan. */
export const FREE_PLAN_WORDS = 'Free';
/** A signup that chose a password (not a provider). */
export const EMAIL_AND_PASSWORD_WORDS = 'Email and password';
/** An email not verified yet. */
export const NOT_YET_WORDS = 'Not yet';
/** An email verified on a day: "Yes — " and the day. */
export const VERIFIED_PREFIX_WORDS = 'Yes — ';
/** Two or more of one table's words, joined. */
export const LIST_JOIN = ' · ';

export const NO_CONTACTS_WORDS = 'No one yet. Your proposal form and your signups fill this table on their own.';
export const NO_PROPOSALS_WORDS = 'No proposals yet.';
export const NO_SIGNUPS_WORDS = 'No signups yet.';

/** Anyone but the platform owner: proposals from templestuart.com are the owner's. */
export const PROPOSALS_OWNER_ONLY_WORDS = 'Your own intake form is not built yet (CRM-02) — proposals from templestuart.com go to the platform owner.';
/** Anyone but the platform owner: signups are the owner's leads. */
export const SIGNUPS_OWNER_ONLY_WORDS = "Signups are the platform owner's leads.";

export const CRM_LOADING_WORDS = 'Reading your contacts…';
export const crmFailedWords = (words: string): string => `The CRM could not be read — ${words}`;
