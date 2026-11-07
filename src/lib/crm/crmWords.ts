/**
 * CRM-01a (Alex, 2026-11-06, ruling D; CRM-01b, 2026-11-07, ruling B) — THE WORDS the CRM page is shown in, typed once, here;
 * none in the components.
 * PURE: no fetch, no env, no clock, no React. Plain words a fifth-grader reads; no sales words, no emoji.
 *
 *   the three table names · the column heads, in each table's order · the From words · the Signups words ("Free",
 *   "Email and password", "Not yet", "Yes — ", and the CRM-01a fix's "tab: " and "legacy: ") · the empty lines (the
 *   Contacts line in two voices: the owner's, and anyone else's) · the platform owner's honest lines for anyone else ·
 *   the loading and failed words (the bill-pay shape: BILL_PAY_LOADING_WORDS / billPayFailedWords) · CRM-01b: the five
 *   stage words on the row's select, the add-a-contact words, the two aria words, the failed-write prefix.
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

/**
 * CRM-01b (Alex, 2026-11-07, ruling B): the five stage words — the row's select shows them, the table, the CSV and the
 * filters print them (the spec's words). The keys are proposals.status's own five (crm.ts CRM_STAGES).
 */
export const STAGE_WORDS = { new: 'New', reviewing: 'Reviewing', sent: 'Sent', won: 'Won', lost: 'Lost' } as const;
/** The row's two controls, named for a screen reader: "Stage of <name>", "Next step for <name>". */
export const stageAriaWords = (name: string): string => `Stage of ${name}`;
export const nextStepAriaWords = (name: string): string => `Next step for ${name}`;

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
/**
 * CRM-01a fix (Alex, 2026-11-07, ruling A): a plan key no offer names is printed as itself, with its kind — a tab key
 * (TAB_ENTITLEMENT_KEYS) after "tab: ", a legacy key (a Google category, or the retired tab:operations) after "legacy: ".
 */
export const TAB_KEY_WORDS = 'tab: ';
export const LEGACY_KEY_WORDS = 'legacy: ';

export const NO_CONTACTS_WORDS = 'No one yet. Your proposal form and your signups fill this table on their own.';
/** CRM-01a fix (Alex, 2026-11-07, ruling B): the Contacts line for anyone but the platform owner — the owner's line is false for them. */
/** CRM-01b (Alex, 2026-11-07, ruling B): adding by hand is their first way in. */
export const NO_CONTACTS_OWN_WORDS = 'No one yet. Add someone by hand above; your own intake form comes in CRM-02.';
export const NO_PROPOSALS_WORDS = 'No proposals yet.';
export const NO_SIGNUPS_WORDS = 'No signups yet.';

/** Anyone but the platform owner: proposals from templestuart.com are the owner's. */
export const PROPOSALS_OWNER_ONLY_WORDS = 'Your own intake form is not built yet (CRM-02) — proposals from templestuart.com go to the platform owner.';
/** Anyone but the platform owner: signups are the owner's leads. */
export const SIGNUPS_OWNER_ONLY_WORDS = "Signups are the platform owner's leads.";

export const CRM_LOADING_WORDS = 'Reading your contacts…';
export const crmFailedWords = (words: string): string => `The CRM could not be read — ${words}`;

/**
 * CRM-01b (Alex, 2026-11-07, ruling B): the writes' words — the button that opens the add row, its three labels (the
 * Contacts heads' own words), its two buttons, and the line under the table when a write fails (the route's words after it).
 */
export const ADD_CONTACT_WORDS = 'Add a contact';
export const ADD_CONTACT_LABELS = { name: CONTACT_HEAD_WORDS.name, business: CONTACT_HEAD_WORDS.business, email: CONTACT_HEAD_WORDS.email } as const;
export const ADD_WORDS = 'Add';
export const CANCEL_WORDS = 'Cancel';
export const WRITE_FAILED_PREFIX_WORDS = 'Not saved — ';
export const crmWriteFailedWords = (words: string): string => `${WRITE_FAILED_PREFIX_WORDS}${words}`;
