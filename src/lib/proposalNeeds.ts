/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE PROPOSAL FORM'S "WHAT DO YOU NEED?" VOCABULARY, typed once.
 *
 * SERVICES-01 (Alex, 2026-11-08 11:00 + 11:15) — THE SERVICES OFFER, ONE MODULE. The DONE-FOR-YOU panel holds six
 * equal doors; every door's key and words live HERE, and the panel (src/components/landing/Landing.tsx — ServicesSection.tsx since
 * HOME-SERVICES-01, 2026-11-12, which Landing.tsx mounts), the form
 * (src/app/work-with-me/WorkWithMeForm.tsx), the route (src/app/api/proposals/route.ts) and the CRM
 * (src/lib/crm/crm.ts needWords) read them (HOME-MENU-01, 2026-11-16: and the top bar's menu, src/components/landing/LandingHeader.tsx — its Professional Services column, each service's title and kind, to proposalFormHref; those four alone until then). The 2026 close retired everywhere — its card, its leaf
 * (src/lib/offer/close.ts), its words (src/lib/offer/closeWords.ts), its law and the form's close block; bookkeeping
 * is a door, a service billed monthly and priced by proposal. PURE: no import, no fetch, no env, no clock, no React —
 * server- and client-safe.
 *
 * The proposals table holds a door's key, CHECK-enforced in SQL (proposals_need_chk, last set by
 * prisma/migrations/20261108111500_services_01_bookkeeping_need): the six keys, and 'close' — kept for the rows the
 * old close door wrote, never offered on the form again and never accepted by the route.
 *
 *   SERVICES             the six doors, in the panel's order — { need, title, line }, and since HOME-SERVICES-01 (2026-11-12)
 *                        its kind — the one place a door's key
 *                        (the word proposals.need stores) and its words (the card's title and line; the title is
 *                        the form's chip and the CRM's words) live;
 *   SERVICE_NEEDS        the six keys, in order (ServiceNeed is one of them);
 *   PROPOSAL_NEEDS       what the route accepts — the six (a tuple, so zod's enum takes it as is); 'close' is not one;
 *   LEGACY_NEED_TITLES   the words for a key a stored row may hold that no door offers — 'close';
 *   PROPOSAL_FORM_PATH   the proposal form — moved here from the retired leaf;
 *   FORM_INTRO           the form's lead, one sentence;
 *   BOOKKEEPING_WORDS    the form's bookkeeping block (what it is, what it is not, the remedy) — the panel's form draws it too since
 *                        HOME-SERVICES-02 (2026-11-16); and, until that brief, the done question's example when bookkeeping was
 *                        picked (no form asks Bookkeeping the done question now);
 *   THE LIST             since HOME-SERVICES-02 (2026-11-16): every question the two proposal forms ask, its words and its rules
 *                        (below BOOKKEEPING_WORDS);
 *   servicesLaw(opts)    THE LAW, below.
 *
 * SERVICE_NEED_LABELS RETIRED (SERVICES-01, 2026-11-08): its two readers — the form's chips and the CRM's needWords — read the
 * doors' titles from SERVICES; no reader needs a Record of them.
 *
 * THE LAW (servicesLaw) refuses by name: a key that is not lower-case letters; a key twice (a door's or a legacy
 * one); an empty title or line; a `$` followed by a digit — a space between counts too — in any title, line, legacy
 * title or bookkeeping word (no fixed price on a door). Handed the migrations as { dir, sql } (the build hands it every
 * prisma/migrations/<dir>/migration.sql), it also finds the LAST migration by directory order whose SQL — its `--` and
 * slash-star comments stripped, its strings kept whole — adds proposals_need_chk; the LAST such ADD in that file is the
 * one in force. That CHECK must read `"need" IN (...)`: a shape the law cannot read is refused by name, never passed
 * over for an older migration. Its words must be exactly SERVICE_NEEDS and the legacy keys, each once. It runs at
 * module scope over the module alone (a browser has no migrations) and again at build over every migration
 * (scripts/assert-tool-registry.ts, the close offer law's old seat). No clock anywhere.
 *
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila: "do we have like a form under the table that adjusts questions
 * being asked by what you click? … remove that text about and replace with like an image that SHOWS what and why and how,
 * rather than telling with words"; the board approved on the design canvas, 15:41 Manila: "yea, I approve , this looks good,
 * lets build this for sure") — THE PROFESSIONAL SERVICES SECTION READS ITS WORDS HERE TOO (src/components/landing/
 * ServicesSection.tsx, as design-refs/home-services-01/Section-Reference.html draws it):
 *   SERVICE_KINDS        ruling c, "THE DOORS ARE SERVICES'. Titles, lines and order unchanged. Each door gains a kind:
 *                        Project (setup, custom, embed), Monthly (maintenance, bookkeeping), none (unsure). One home per door's
 *                        words is the aim; the audit proposes where." — where, as the audit proposed it: HERE. The two words
 *                        are typed once, in SERVICE_KINDS, and each door carries its kind beside its title and line
 *                        (ServiceDoor), so a door's words keep one home. The form, the route and the CRM read no kind;
 *   NEED_QUESTION        "What do you need?" — the panel's question over its tiles, and the form's over its chips (the form
 *                        typed it until now; ruling e: "The form changes only where it must read a word or a rule it now
 *                        shares with the landing ("What do you need?" is one).");
 *   PROPOSAL_STEPS       ruling e, whole: "THE STEPS' WORDS ARE NEW and live beside FORM_INTRO. Step 2 follows the form's own rule
 *                        (no modules for bookkeeping): one rule read by both, or a test that renders the form for each door and
 *                        holds the two equal. The form changes only where it must read a word or a rule it now shares with the
 *                        landing ("What do you need?" is one)." — how a proposal goes, in three steps.
 *                        The first two titles are FORM_INTRO's own two halves; the third is the form's thank-you, which the
 *                        form reads from here now; step 3's note is new;
 *   FORM_ASKS, formAsks  step 2: the form's questions by short name, in the form's order (the order it asked them in until HOME-SERVICES-02,
 *                        2026-11-16: each service asks its own set now, the list's below, and the whole view's step 2 names these still, as
 *                        main drew it — that brief's ruling l keeps the whole view's render — for a later PR to re-say) — "Timeline" and "Budget range" are
 *                        its labels as they stand (ASK_TIMELINE, ASK_BUDGET: the form reads them from here now) — less Modules
 *                        where the form asks none (NO_MODULES_NEEDS). Ruling e: "Step 2 follows the form's own rule (no
 *                        modules for bookkeeping): one rule read by both, or a test that renders the form for each door and
 *                        holds the two equal." — the test (src/lib/__tests__/homeServices01.test.ts): the form kept its own
 *                        rule, isBookkeeping, as SERVICES-01 pinned it, until HOME-SERVICES-02 (2026-11-16) gave each service its own
 *                        questions from the list;
 *   PROPOSAL_CTA, SCOPED_BY_PROPOSAL, proposalFormHref (and, since HOME-TRIM-03, 2026-11-15, SEE_HOW_A_PROPOSAL_WORKS — the short view's link, its note below)
 *                        ruling f, in part: ""Send a project proposal →" and "Scoped by proposal" move from Landing.tsx into
 *                        a leaf." The form read the second from here too. (HOME-SERVICES-02, 2026-11-16: SCOPED_BY_PROPOSAL and
 *                        SEE_HOW_A_PROPOSAL_WORKS left with the note and the link, by its rulings k and j; PROPOSAL_CTA and
 *                        proposalFormHref stay, the whole view's.) The gold button links to the form's page with the
 *                        pick — the brief's `${PROPOSAL_FORM_PATH}?need=<picked>`, "the link each card carried until now".
 * The pictures (ruling d) are files, public/brand/services/<need>.svg; the build holds them to the doors, by name, on the
 * services law's one line (scripts/assert-tool-registry.ts).
 */

/** One door of the DONE-FOR-YOU panel. */
export interface Service {
  /** The word proposals.need stores — the form's `?need=` key. */
  readonly need: string;
  /** The card's title; the form's chip; the CRM's words for the need. */
  readonly title: string;
  /** The card's line. */
  readonly line: string;
}

/** HOME-SERVICES-01 (ruling c): the kind of work a door is — its two words, typed once. Something else is neither. */
export const SERVICE_KINDS = { project: 'Project', monthly: 'Monthly' } as const;
export type ServiceKind = (typeof SERVICE_KINDS)[keyof typeof SERVICE_KINDS];

/** HOME-SERVICES-01: a door as the section draws it — its key and words (Service), and the kind of work it is, or none. */
export interface ServiceDoor extends Service {
  /** The tile's kind, under its title: Project, Monthly — or null, which the tile draws as nothing. */
  readonly kind: ServiceKind | null;
}

/** The six doors, in the panel's order (Alex, 2026-11-08: Alex is the voice; he vetoes words in chat). HOME-SERVICES-01 (2026-11-12): each gains its kind. */
export const SERVICES = [
  { need: 'setup', title: 'Full setup', line: 'Your own hosted copy, every API wired, you own everything.', kind: SERVICE_KINDS.project },
  { need: 'maintenance', title: 'Monthly maintenance', line: 'I keep it updated and running.', kind: SERVICE_KINDS.monthly },
  { need: 'custom', title: 'Custom builds', line: 'Need a feature? I build it.', kind: SERVICE_KINDS.project },
  { need: 'embed', title: 'Integration', line: 'One piece of this system (the booking engine, the books, the scanner) wired into the system you already run.', kind: SERVICE_KINDS.project },
  { need: 'bookkeeping', title: 'Bookkeeping', line: 'Fell behind, or need a bookkeeper? Catch-up and monthly bookkeeping, billed monthly — the price follows your volume.', kind: SERVICE_KINDS.monthly },
  { need: 'unsure', title: 'Something else', line: 'Out of scope, or not sure which fits? Tell me what you need.', kind: null },
] as const satisfies ReadonlyArray<ServiceDoor>;

export type ServiceNeed = (typeof SERVICES)[number]['need'];
type NeedsOf<T extends ReadonlyArray<Service>> = { readonly [K in keyof T]: T[K] extends { readonly need: infer N } ? N : never };

const doorKeys: readonly ServiceNeed[] = SERVICES.map((s) => s.need);
/** The six keys, in the doors' order — read off SERVICES, never typed twice (the tuple's type is SERVICES' own). */
export const SERVICE_NEEDS = doorKeys as NeedsOf<typeof SERVICES>;

/** Every word the route accepts on write: the six keys. 'close' is not one (SERVICES-01). */
export const PROPOSAL_NEEDS: readonly [ServiceNeed, ...ServiceNeed[]] = SERVICE_NEEDS;

/** The words for a key a stored row may hold that no door offers: 'close', which the retired close door wrote. */
export const LEGACY_NEED_TITLES = {
  close: 'Close my 2026 books (the old close door)',
} as const satisfies Readonly<Record<string, string>>;
export type LegacyNeed = keyof typeof LEGACY_NEED_TITLES;

/** The proposal form — the one way to book (src/app/work-with-me; PUBLIC_PATHS). SERVICES-01 (2026-11-08): moved here from src/lib/offer/close.ts. */
export const PROPOSAL_FORM_PATH = '/work-with-me';

/** The form's lead (SERVICES-01): the typed setup sentence (it restated the first door's line) and the close's sentence went. */
export const FORM_INTRO = 'Pick what fits below and tell me about your business.';

/** HOME-SERVICES-01 (ruling e): the need question — the panel's, over its six tiles, and the form's, over its six chips. */
export const NEED_QUESTION = 'What do you need?';

/**
 * HOME-SERVICES-01 (ruling e): HOW A PROPOSAL GOES — the panel's three steps, beside the lead they come from. `pick` and `tell` are
 * FORM_INTRO's two halves, as a title writes them; `read` is the form's thank-you ("Got it — I read every one of these myself."),
 * which the form reads from here; `note` is new.
 */
export const PROPOSAL_STEPS = {
  pick: 'Pick what fits',
  tell: 'Tell me about your business',
  read: 'I read every one of these myself',
  note: 'You’ll hear from me by email.',
} as const;

/** HOME-SERVICES-01: two of the form's labels, as they stand — step 2 names them, and the form reads them from here. */
export const ASK_TIMELINE = 'Timeline';
export const ASK_BUDGET = 'Budget range';

/** HOME-SERVICES-01 (ruling e): step 2 — what the form will ask, by short name, in the form's order. */
export const FORM_ASKS = [
  { ask: 'business', name: 'Your business' },
  { ask: 'modules', name: 'Modules' },
  { ask: 'timeline', name: ASK_TIMELINE },
  { ask: 'budget', name: ASK_BUDGET },
  { ask: 'done', name: 'What done looks like' },
] as const;

/** The doors whose form asks no modules question — the form's own rule, as SERVICES-01 wrote it ("no modules question for bookkeeping"). */
export const NO_MODULES_NEEDS: readonly ServiceNeed[] = ['bookkeeping'];

/** Step 2 for one door: the form's questions, less Modules where the form asks none. */
export function formAsks(need: ServiceNeed): readonly string[] {
  return FORM_ASKS.filter((a) => a.ask !== 'modules' || !NO_MODULES_NEEDS.includes(need)).map((a) => a.name);
}

/**
 * HOME-SERVICES-01 (ruling f): the gold button's words — and the note beside it, moved here from Landing.tsx with them and read by the form
 * too, until HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling k: "THE GREY NOTE LEAVES EVERY PAGE. Scoped by proposal goes from beside the whole view's gold button on /professional-services and from beside Send proposal on /work-with-me; SCOPED_BY_PROPOSAL and .ts-ps-note go with it." — SCOPED_BY_PROPOSAL left here with the note; the
 * gold button stays, the whole view's, on /professional-services.
 */
export const PROPOSAL_CTA = 'Send a project proposal →';
/**
 * HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila: "I would like to take this feedback, consider it deeply, review the home page in
 * its current state, and then come up with a mock up to meet the requests of the beta users feedback."; two of his four beta users'
 * notes, as he pasted them: "Cut the scrolling length of the landing page in half. Make the user explore to find the information behind
 * info pages" · "Make it exploratory. Click to learn more."; his approval of the boards on the design canvas, 2026-11-14 20:01 Manila:
 * "ALL LOOKS GOOD … OTHERWISE, LETS DO IT"; of the corrected boards, 20:41: "thats it!  yeet yeet!"; built 2026-11-15) — THE SHORT VIEW'S
 * ONE NEW WORD, until HOME-SERVICES-02 (2026-11-16, its ruling j) took the link away and the constant with it: the link under the panel,
 * on the home page, to the section's own page. Ruling d: "THE WORDS. Nothing is typed. "See how a
 * proposal works →" is new: one constant in src/lib/proposalNeeds.ts beside SCOPED_BY_PROPOSAL (:166), the arrow in the string, with a
 * dated note. Its link is a next/link Link, as the gold link is, to PROFESSIONAL_SERVICES_PATH (src/lib/homePages.ts:42). It carries no
 * state." — read by ServicesShortView (src/components/landing/ServicesSection.tsx), which drew it in the README's class, .ts-ps-how; the
 * path was the pages' leaf's, read there: this leaf imports nothing. Since HOME-SERVICES-02 (2026-11-16) the section sends nobody elsewhere:
 * SEE_HOW_A_PROPOSAL_WORKS is gone from here, .ts-ps-how from the port, and the section no longer reads the pages' leaf.
 */

/** The form's page with a door picked — the link each card carried, and the gold button's now (the page picks the door it names). */
export function proposalFormHref(need: ServiceNeed): string {
  return `${PROPOSAL_FORM_PATH}?need=${need}`;
}

/**
 * HOME-SERVICES-01 (ruling d): THE PICTURES ARE FILES, one per door, named by its key — public/brand/services/<need>.svg, served
 * at /brand/services/<need>.svg. Drawn as they were handed over (the README: "Never redraw, trace or edit them"). The build holds
 * the folder to the doors by name: a door with no picture, or a picture with no door, fails it (the services law's one line).
 */
export const SERVICE_PICTURES_PATH = '/brand/services';
export function servicePictureSrc(need: ServiceNeed): string {
  return `${SERVICE_PICTURES_PATH}/${need}.svg`;
}

/** The door a key names — the panel's pick. A key no door holds is refused by name, never mapped to another door. */
export function serviceDoor(need: ServiceNeed): (typeof SERVICES)[number] {
  const door = SERVICES.find((s) => s.need === need);
  if (door === undefined) throw new ServicesLawError(`services: no door holds the key "${need}" — the doors are ${SERVICE_NEEDS.join(', ')}`);
  return door;
}

/**
 * SERVICES-01 (2026-11-08): the form's bookkeeping block; notTax and remedy verbatim from the retired closeWords. The done question's example
 * stood here too, as done, until HOME-SERVICES-02 (2026-11-16): Bookkeeping's questions are its own set now (the list, below), and none is
 * the done question. The panel's form draws these three lines as the reference's ps-offer, /work-with-me as it drew them.
 */
export const BOOKKEEPING_WORDS = {
  what: 'Catch-up on the months you fell behind, or monthly bookkeeping going forward: every bank and card account reconciled, every transaction categorized, and the statements whoever files your taxes needs.',
  notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
  remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
} as const;

/**
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila) — THE LIST: the core, each service's own questions, the bands, and every other word
 * the two proposal forms show. Ruling d: "ONE LIST HOLDS THE QUESTIONS, AND BOTH FORMS DRAW THEM FROM IT. The core and the six sets are data in src/lib/proposalNeeds.ts, where NEED_QUESTION, ASK_TIMELINE and ASK_BUDGET already live: each question's key, words, kind, answers, whether it is required, its default and its follow-up, and every other word the forms show. ServicesForm.tsx draws the picked set in the panel's dress. WorkWithMeForm.tsx draws it with the page's own controls, as it draws today's questions, and its need question stays and picks the set. No question, word or answer is typed in a component. Close is a new word, one constant there." — the panel's form (src/components/landing/ServicesForm.tsx) and /work-with-me's
 * (src/app/work-with-me/WorkWithMeForm.tsx) draw the picked set from here; the hook both read (src/hooks/useProposalForm.ts) holds its
 * answers; the route (src/app/api/proposals/route.ts) and the CRM (src/lib/crm/crm.ts) read it too. Ruling c: "EACH SERVICE HAS ITS OWN QUESTIONS, AND THE README'S TABLES ARE THEM. Name, Email, the business, a website and the visitor's part in the decision open every form, and How did you find me closes it, last under More details. Between them, each service asks its own questions in the README's order, with their required answers, defaults, follow-ups and the answers that stand alone. Team size, What tools do you use today? and the hard deadline with No deadline — exploring are no longer asked." — the README's tables
 * (design-refs/home-services-02/README.md), as the reference's form draws them (Section-Reference.html): src/lib/__tests__/homeServices02.test.ts
 * holds the three equal, question by question.
 *   CORE_QUESTIONS        Name, Email, the business, a website and the visitor's part in the decision: every form opens on them;
 *   SERVICE_QUESTIONS     each service's own, in the README's order: under the core, then under More details (more: true);
 *   FOUND_QUESTION        How did you find me?, last under More details; its follow-up's words are the answer's that opens it;
 *   the bands             PROJECT_BANDS, MAINTENANCE_BANDS and BOOKKEEPING_BANDS (ruling g, at them), and TIMELINE;
 *   FORM_CLOSE, FORM_WORDS  every other word the forms show;
 *   setOf, startAnswers, pressOne, pressMany, answerPress, followOpen, followWords, referralSource, proposalCheck  the rules the
 *                         hook and the route share, pure as this leaf is.
 * A question's key is the reference's id for it, but for three: Bookkeeping's and Something else's first question (both "What do you need?")
 * are keyed scope and what, and the visitor's website is keyed site, so website stays the route's trap and nothing else. An answer is the
 * words the form shows: a pick's answer as it reads, a pick-any's answers in the list's order, a count by each part's key, a date and its
 * why, the links' rows.
 */

/** The kinds of question the forms draw. */
export type QuestionKind = Question['kind'];

/** What every question carries, whatever its kind. */
interface Asked {
  /** Where its answer is kept and sent: under answers, or in the column the core's three keep. */
  readonly key: string;
  /** Its label. */
  readonly words: string;
  /** A pick, a count or a follow-up the button waits for (ruling f); a text answer the browser requires, as Name and Email are. */
  readonly required: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
  /** The longest answer its field takes, drawn as its maxlength (a link's, the referral's follow-up). */
  readonly max?: number;
  /** It spans the form's two columns. */
  readonly wide: boolean;
  /** It stands under More details. */
  readonly more: boolean;
  /** Asked under it while one of its answers is pressed. */
  readonly follow?: Follow;
}

/** One question of the list, typed by its kind: a pick carries its answers, a count its parts. */
export type Question =
  | (Asked & { readonly kind: 'text' | 'email' | 'url' | 'area' | 'number' | 'month' | 'dated' | 'links' })
  | (Asked & {
      readonly kind: 'one';
      readonly answers: readonly string[];
      /** Its default: pressed at first and kept — a press moves it, and none clears it. Null: none at first, and a second press clears it. */
      readonly fixed: string | null;
    })
  | (Asked & {
      readonly kind: 'many';
      readonly answers: readonly string[];
      /** The answers that stand alone: pressed, one clears the others; any other pressed clears it. */
      readonly alone: readonly string[];
    })
  | (Asked & { readonly kind: 'counts'; readonly parts: readonly CountPart[] });

export type PickQuestion = Extract<Question, { kind: 'one' | 'many' }>;

/** A count's part: its key under the answer, and its words. */
export interface CountPart {
  readonly key: string;
  readonly words: string;
}

/** A follow-up: the answers that open it, its question, and — How did you find me?'s alone — its words by the answer that opened it. */
export interface Follow {
  readonly when: readonly string[];
  readonly question: Question;
  readonly wordsBy?: Readonly<Record<string, string>>;
}

/** An answer as the form holds it: a text or a pick's answer; a pick-any's answers or the links' rows; a count's parts or a date and its why. */
export type Answer = string | readonly string[] | Readonly<Record<string, string>>;
export type Answers = Readonly<Record<string, Answer>>;

/** Bookkeeping's three counts, each by its key. */
export const COUNT_PARTS: readonly CountPart[] = [
  { key: 'bank', words: 'Bank' },
  { key: 'cards', words: 'Cards' },
  { key: 'loans', words: 'Loans' },
];

/** Today's rows (WorkWithMeForm.tsx, until HOME-SERVICES-02): at most five links, each at most 500 characters. */
export const LINK_ROWS = 5;
export const LINK_MAX = 500;
/** The referral's follow-up at most, as the form held it. */
export const DETAIL_MAX = 90;
/** The longest text answer the route keeps: the business question's, as the route held it. */
export const ANSWER_MAX = 5000;

/**
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling g: "BUDGETS FOLLOW THE BILLING. The three project services keep today's bands under Budget range. Monthly maintenance and Bookkeeping ask Monthly budget with their own bands. Something else takes the monthly bands when Something ongoing is its answer, and the project bands otherwise. The monthly bands are Alex's placeholders: they live in the list and the route reads them there, so his prices will be a change in one place." — each set of bands with its label and its default.
 * PROJECT_BANDS are today's (the form's BUDGET_RANGES under ASK_BUDGET until that brief, and the route's). The two monthly ones are Alex's
 * placeholders, the README's, and stand here alone: the sets, Something else's swap (setOf) and the route read them here.
 */
export interface Bands {
  readonly words: string;
  readonly answers: readonly string[];
  readonly fixed: string;
}
export const MONTHLY_BUDGET = 'Monthly budget';
export const PROJECT_BANDS: Bands = { words: ASK_BUDGET, answers: ['<$2k', '$2–10k', '$10–50k', '$50k+', 'not sure'], fixed: 'not sure' };
export const MAINTENANCE_BANDS: Bands = { words: MONTHLY_BUDGET, answers: ['Under $250', '$250–750', '$750–2,000', 'More than $2,000', 'Not sure'], fixed: 'Not sure' };
export const BOOKKEEPING_BANDS: Bands = { words: MONTHLY_BUDGET, answers: ['Under $300', '$300–600', '$600–1,000', 'More than $1,000', 'Not sure'], fixed: 'Not sure' };
/** Something else's answer that asks Monthly maintenance's bands, under their monthly name. */
export const ONGOING = 'Something ongoing';

/** A set's budget question, from its bands. */
function budget(bands: Bands, wide: boolean): Question {
  return { key: 'budget', words: bands.words, kind: 'one', answers: bands.answers, fixed: bands.fixed, required: false, wide, more: false };
}

/** Timeline: today's four picks under ASK_TIMELINE, Exploring at first. The three project services and Something else ask it. */
export const TIMELINE: Question = { key: 'timeline', words: ASK_TIMELINE, kind: 'one', answers: ['Now', '2–4 weeks', '1–3 months', 'Exploring'], fixed: 'Exploring', required: false, wide: false, more: false };

/** The core: every form opens on these five. Name, Email and the business keep their columns; site and role travel under answers. */
export const CORE_QUESTIONS: readonly Question[] = [
  { key: 'name', words: 'Name', kind: 'text', required: true, wide: false, more: false },
  { key: 'email', words: 'Email', kind: 'email', required: true, wide: false, more: false },
  { key: 'business', words: "What's your business? (or: it's just for me)", kind: 'area', required: true, placeholder: 'e.g. I run a 12-unit property management company in Austin — we collect rent, pay vendors, file 1099s', hint: 'One or two sentences: what you do, who pays you.', wide: true, more: false },
  { key: 'site', words: 'Website (optional)', kind: 'url', required: false, placeholder: 'https://', wide: false, more: false },
  { key: 'role', words: 'Your part in the decision', kind: 'one', answers: ['I decide', 'I recommend, someone else approves', 'Just looking'], fixed: null, required: true, wide: false, more: false },
];

/** The core's answers that keep their own columns; the core's other two answers travel under answers. */
export const CORE_COLUMNS = ['name', 'email', 'business'] as const;

/** How did you find me?: last under More details, in every form. Its answer and its follow-up travel as the referral's column. */
export const FOUND_QUESTION: Question = {
  key: 'found', words: 'How did you find me?', kind: 'one', answers: ['Reddit', 'Instagram', 'TikTok', 'X', 'YouTube', 'Referral', 'Other'], fixed: null, required: false, wide: true, more: true,
  follow: { when: ['Referral', 'Other'], question: { key: 'detail', words: '', kind: 'text', required: true, max: DETAIL_MAX, wide: false, more: true }, wordsBy: { Referral: 'Who referred you? (name)', Other: "Where'd you find me?" } },
};

/** The referral's column, from the found answer and its follow-up: the answer, or `referral: {name}` / `other: {text}`, as the form wrote it. */
export const REFERRAL_TAGS: Readonly<Record<string, string>> = { Referral: 'referral', Other: 'other' };

/** Each service's own questions, in the README's order. */
export const SERVICE_QUESTIONS: { readonly [N in ServiceNeed]: readonly Question[] } = {
  setup: [
    { key: 'who', words: 'Who is it for?', kind: 'one', answers: ['Just me', 'My household', 'My business', 'Several businesses or entities'], fixed: null, required: true, wide: true, more: false,
      follow: { when: ['Several businesses or entities'], question: { key: 'entities', words: 'How many?', kind: 'number', required: false, wide: false, more: false } } },
    { key: 'modules', words: 'What should it run on day one?', kind: 'many', answers: ['Travel', 'Runway', 'Books', 'Trade', 'Tax', 'Compliance', 'Routines', 'Projects', 'Content', 'Other'], alone: [], required: true, hint: 'Pick Other if you need something custom-built that isn\'t listed.', wide: true, more: false,
      follow: { when: ['Other'], question: { key: 'other', words: 'What is it?', kind: 'area', required: true, placeholder: 'Describe what you need built.', wide: false, more: false } } },
    { key: 'accounts', words: 'How many bank, card and brokerage accounts should it connect?', kind: 'one', answers: ['1–3', '4–10', '11–25', 'More than 25'], fixed: null, required: true, wide: true, more: false },
    { key: 'moving', words: 'What are you moving off?', kind: 'many', answers: ['QuickBooks', 'Xero', 'Spreadsheets', 'Nothing', 'Other'], alone: ['Nothing'], required: true, wide: true, more: false },
    { key: 'host', words: 'Where should it run?', kind: 'one', answers: ['Host it for me', 'In my own cloud account', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    TIMELINE,
    budget(PROJECT_BANDS, false),
    { key: 'history', words: 'How much history should come across?', kind: 'one', answers: ['None', 'This year', '2–3 years', 'All of it'], fixed: null, required: false, wide: true, more: true },
    { key: 'after', words: 'Who keeps it running after launch?', kind: 'one', answers: ['Me or my team', 'You, monthly', 'Not sure'], fixed: null, required: false, wide: true, more: true },
    { key: 'security', words: 'Security or compliance needs', kind: 'area', required: false, placeholder: 'e.g. single sign-on, SOC 2, where data may be stored', wide: true, more: true },
    { key: 'done', words: 'What does done look like?', kind: 'area', required: false, placeholder: 'e.g. By March I can see all my rentals\' income in one dashboard and my CPA gets a clean export.', hint: 'Describe the finish line — what\'s true when this project is done?', wide: true, more: true },
  ],
  maintenance: [
    { key: 'copy', words: 'Which copy will I look after?', kind: 'one', answers: ['One you set up for me', 'One I set up myself', 'Not running yet'], fixed: null, required: true, wide: true, more: false },
    { key: 'runs', words: 'Where does it run?', kind: 'one', answers: ['Vercel', 'Azure', 'AWS', 'Google Cloud', 'My own server', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    { key: 'users', words: 'How many people use it?', kind: 'one', answers: ['Just me', '2–10', '11–50', 'More than 50'], fixed: null, required: true, wide: true, more: false },
    { key: 'stopped', words: 'If it stopped for a day', kind: 'one', answers: ['A nuisance', 'It slows us down', 'It stops the business'], fixed: null, required: true, wide: true, more: false },
    { key: 'reach', words: 'When should I be reachable?', kind: 'one', answers: ['Business hours in my time zone', 'Longer hours', 'Around the clock for outages'], fixed: null, required: true, wide: true, more: false },
    budget(MAINTENANCE_BANDS, true),
    { key: 'attention', words: 'What needs attention now?', kind: 'area', required: false, placeholder: 'What is broken, slow or out of date', wide: true, more: true },
    { key: 'change', words: 'How much change do you expect?', kind: 'one', answers: ['Updates and fixes only', 'A small feature a month', 'Ongoing development'], fixed: null, required: false, wide: true, more: true },
    { key: 'takeover', words: 'When should I take over?', kind: 'month', required: false, wide: false, more: true },
    { key: 'timezone', words: 'Your time zone', kind: 'text', required: false, placeholder: 'e.g. Manila, New York', wide: false, more: true },
  ],
  custom: [
    { key: 'problem', words: 'What should it let you do that you can\'t today?', kind: 'area', required: true, wide: true, more: false },
    { key: 'users', words: 'Who will use it?', kind: 'many', answers: ['Me', 'My team', 'My customers', 'The public'], alone: [], required: true, wide: true, more: false },
    { key: 'lives', words: 'Where should it live?', kind: 'one', answers: ['In my Temple Stuart copy', 'In another system', 'On its own', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    { key: 'worked', words: 'How will you know it worked?', kind: 'area', required: true, placeholder: 'e.g. Month-end takes an hour, not a day.', wide: true, more: false },
    TIMELINE,
    budget(PROJECT_BANDS, false),
    { key: 'data', words: 'What data does it touch?', kind: 'many', answers: ['Money', 'Personal details', 'Neither', 'Not sure'], alone: ['Neither', 'Not sure'], required: false, wide: true, more: true },
    { key: 'musts', words: 'Must-haves, and what can wait', kind: 'area', required: false, wide: true, more: true },
    { key: 'open', words: 'Can the code join the open-source core?', kind: 'one', answers: ['Yes', 'I\'d rather it stay mine', 'Not sure'], fixed: null, required: false, wide: true, more: true },
    { key: 'links', words: 'Designs, documents or examples', kind: 'links', required: false, max: LINK_MAX, wide: true, more: true },
    { key: 'date', words: 'A date it must exist by, and why', kind: 'dated', required: false, placeholder: 'Why that date?', wide: true, more: true },
  ],
  embed: [
    { key: 'piece', words: 'Which piece?', kind: 'many', answers: ['The booking engine', 'The books', 'The scanner', 'Something else'], alone: [], required: true, wide: true, more: false },
    { key: 'system', words: 'Into which system?', kind: 'text', required: true, placeholder: 'e.g. NetSuite, Shopify, our own app', wide: true, more: false },
    { key: 'direction', words: 'Which way does data move?', kind: 'one', answers: ['Into your system', 'Out of it', 'Both ways'], fixed: null, required: true, wide: true, more: false },
    { key: 'often', words: 'How often?', kind: 'one', answers: ['As it happens', 'Hourly', 'Daily', 'On demand'], fixed: null, required: true, wide: true, more: false },
    { key: 'volume', words: 'How much, on a busy day?', kind: 'one', answers: ['Under 100', '100–1,000', '1,000–10,000', 'More than 10,000 records'], fixed: null, required: true, wide: true, more: false },
    { key: 'reached', words: 'How can that system be reached?', kind: 'one', answers: ['An API with documentation', 'An API without it', 'Files only (CSV, SFTP)', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    TIMELINE,
    budget(PROJECT_BANDS, false),
    { key: 'test', words: 'Is there a test copy of it?', kind: 'one', answers: ['Yes', 'No', 'Not sure'], fixed: null, required: false, wide: false, more: true },
    { key: 'admin', words: 'Is there an admin or developer on that system?', kind: 'one', answers: ['Yes', 'No'], fixed: null, required: false, wide: false, more: true },
    { key: 'crosses', words: 'What data crosses?', kind: 'many', answers: ['Money', 'Personal details', 'Card numbers', 'Not sure'], alone: ['Not sure'], required: false, wide: true, more: true },
    { key: 'fails', words: 'If a sync fails', kind: 'one', answers: ['Alert me', 'Retry, then alert me', 'Not sure'], fixed: null, required: false, wide: true, more: true },
  ],
  bookkeeping: [
    { key: 'scope', words: 'What do you need?', kind: 'one', answers: ['Catch-up only', 'Monthly from now on', 'Catch-up, then monthly'], fixed: null, required: true, wide: true, more: false },
    { key: 'behind', words: 'How far behind are the books?', kind: 'one', answers: ['Up to date', '1–3 months', '4–6 months', '7–12 months', 'More than a year', 'Never kept'], fixed: null, required: true, wide: true, more: false },
    { key: 'entity', words: 'What kind of entity?', kind: 'one', answers: ['Sole proprietor', 'Single-member LLC', 'Partnership or multi-member LLC', 'S corporation', 'C corporation', 'Nonprofit', 'Personal or household', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    { key: 'accounts', words: 'How many accounts to reconcile?', kind: 'counts', parts: COUNT_PARTS, required: true, wide: true, more: false },
    { key: 'volume', words: 'Transactions a month, across all of them', kind: 'one', answers: ['Under 50', '50–150', '150–300', '300–600', 'More than 600'], fixed: null, required: true, wide: true, more: false },
    { key: 'kept', words: 'Where are the books kept now?', kind: 'one', answers: ['QuickBooks Online', 'Xero', 'Spreadsheets', 'Nowhere', 'Other'], fixed: null, required: true, wide: true, more: false },
    budget(BOOKKEEPING_BANDS, true),
    { key: 'platforms', words: 'Payment platforms', kind: 'many', answers: ['Stripe', 'PayPal', 'Square', 'Shopify', 'Venmo', 'Other'], alone: [], required: false, wide: true, more: true },
    { key: 'payroll', words: 'Payroll', kind: 'one', answers: ['None', 'Gusto', 'ADP', 'Rippling', 'Other'], fixed: null, required: false, wide: true, more: true },
    { key: 'adds', words: 'Anything that adds work', kind: 'many', answers: ['Inventory', 'Sales tax in more than one state', 'Contractors paid on 1099', 'More than one entity', 'Foreign currency', 'Investor reporting'], alone: [], required: false, wide: true, more: true },
    { key: 'basis', words: 'Cash or accrual?', kind: 'one', answers: ['Cash', 'Accrual', 'Not sure'], fixed: null, required: false, wide: false, more: true },
    { key: 'files', words: 'Who files your taxes?', kind: 'one', answers: ['A CPA or enrolled agent', 'I do', 'No one yet'], fixed: null, required: false, wide: false, more: true },
    { key: 'reports', words: 'Reports you want', kind: 'many', answers: ['Monthly P&L and balance sheet', 'Cash flow', 'Budget against actual', 'Investor package'], alone: [], required: false, wide: true, more: true },
    { key: 'open', words: 'Anything open?', kind: 'many', answers: ['Notices from the IRS or a state', 'Unfiled sales tax', 'Problems left by a previous bookkeeper', 'None'], alone: ['None'], required: false, wide: true, more: true },
    { key: 'date', words: 'A date the books must be ready by', kind: 'dated', required: false, placeholder: 'e.g. a tax deadline, a loan, an investor', wide: true, more: true },
    { key: 'pay', words: 'What do you pay for bookkeeping now?', kind: 'text', required: false, placeholder: 'e.g. $400 a month, or nothing', wide: false, more: true },
  ],
  unsure: [
    { key: 'what', words: 'What do you need?', kind: 'area', required: true, wide: true, more: false },
    { key: 'closer', words: 'Is it closer to', kind: 'one', answers: ['A one-time project', 'Something ongoing', 'Advice or a second opinion', 'Not sure'], fixed: null, required: true, wide: true, more: false },
    TIMELINE,
    budget(PROJECT_BANDS, false),
    { key: 'driver', words: 'What\'s driving it?', kind: 'text', required: false, wide: false, more: true },
    { key: 'links', words: 'Links', kind: 'links', required: false, max: LINK_MAX, wide: true, more: true },
  ],
};

/** HOME-SERVICES-02 (ruling d): Close, a new word, one constant. */
export const FORM_CLOSE = 'Close';

/** Every other word the two forms show: the panel's eyebrow and /work-with-me's bar; More details; the button; the thank-you; the links' and the date's words; the trap's label; the send's two errors, as the form typed them. */
export const FORM_WORDS = {
  eyebrow: 'WORK WITH ME',
  more: 'More details (optional)',
  send: 'Send proposal',
  sending: 'Sending…',
  sentLead: 'Got it —',
  sentHear: "You'll hear from me at",
  addLink: '＋ Add link',
  removeLink: 'Remove link',
  removeMark: '✕',
  linkPlaceholder: 'https:// — your site, a Google Doc, a Loom…',
  date: 'Date',
  why: 'Why',
  trap: 'Website',
  failed: 'Request failed',
  network: 'Network error — please try again.',
} as const;

export type OneQuestion = Extract<Question, { kind: 'one' }>;
export type ManyQuestion = Extract<Question, { kind: 'many' }>;

/** A set's questions, each followed by its follow-up's question. */
export function questionsOf(set: readonly Question[]): readonly Question[] {
  return set.flatMap((q) => (q.follow === undefined ? [q] : [q, q.follow.question]));
}

/** A service's questions as its form asks them now: Something else's budget asks Monthly maintenance's bands, under their monthly name, while Something ongoing is its answer (ruling g). */
export function setOf(need: ServiceNeed, answers: Answers): readonly Question[] {
  const set = SERVICE_QUESTIONS[need];
  if (need !== 'unsure' || answers.closer !== ONGOING) return set;
  return set.map((q) => (q.key === 'budget' ? budget(MAINTENANCE_BANDS, q.wide) : q));
}

/** A question's answer at first: its default, or none — no row, no part, no answer. */
export function startAnswer(q: Question): Answer {
  switch (q.kind) {
    case 'one':
      return q.fixed === null ? '' : q.fixed;
    case 'many':
      return [];
    case 'links':
      return [''];
    case 'counts':
      return Object.fromEntries(q.parts.map((part) => [part.key, '']));
    case 'dated':
      return { date: '', why: '' };
    default:
      return '';
  }
}

/** A service's answers at first: each of its questions', a follow-up's included, by key. */
export function startAnswers(need: ServiceNeed): Answers {
  return Object.fromEntries(questionsOf(SERVICE_QUESTIONS[need]).map((q) => [q.key, startAnswer(q)]));
}

/** The answer kept under a key, as a text — refused by name when it is not one. */
export function textOf(answers: Answers, key: string): string {
  const answer = answers[key];
  if (typeof answer !== 'string') throw new ServicesLawError(`list: the answer under "${key}" is not a text`);
  return answer;
}

/** The answers kept under a key, as a list (a pick-any's answers, the links' rows) — refused by name when they are not one. */
export function rowsOf(answers: Answers, key: string): readonly string[] {
  const answer = answers[key];
  if (!Array.isArray(answer)) throw new ServicesLawError(`list: the answer under "${key}" is not a list`);
  return answer as readonly string[];
}

/** The parts kept under a key (a count's, a date's and its why) — refused by name when they are not parts. */
export function partsOf(answers: Answers, key: string): Readonly<Record<string, string>> {
  const answer = answers[key];
  if (typeof answer !== 'object' || answer === null || Array.isArray(answer)) throw new ServicesLawError(`list: the answer under "${key}" is not a set of parts`);
  return answer as Readonly<Record<string, string>>;
}

/** A press on a pick-one's answer: it holds that answer; pressed again it holds none — but a default is kept (Timeline, the budget). */
export function pressOne(q: OneQuestion, now: string, answer: string): string {
  if (!q.answers.includes(answer)) throw new ServicesLawError(`list: "${answer}" is not an answer to "${q.words}"`);
  if (now !== answer) return answer;
  return q.fixed === null ? '' : now;
}

/** A press on a pick-any's answer: an answer that stands alone clears the others, and any other clears it; the answers keep the list's order. */
export function pressMany(q: ManyQuestion, now: readonly string[], answer: string): string[] {
  if (!q.answers.includes(answer)) throw new ServicesLawError(`list: "${answer}" is not an answer to "${q.words}"`);
  const kept = q.alone.includes(answer) ? [] : now.filter((a) => !q.alone.includes(a) && a !== answer);
  const next = now.includes(answer) ? kept : [...kept, answer];
  return q.answers.filter((a) => next.includes(a));
}

/** The question a set asks under a key, a follow-up's included — a key it does not ask is refused by name. */
export function questionAt(set: readonly Question[], key: string): Question {
  const q = questionsOf(set).find((asked) => asked.key === key);
  if (q === undefined) throw new ServicesLawError(`list: no question is keyed "${key}"`);
  return q;
}

/** A press on one of a service's picks: its answers after it. When Something else's answer moves to or from Something ongoing, its budget starts again on the new bands' default, as the reference redraws it (ruling g). */
export function answerPress(need: ServiceNeed, answers: Answers, key: string, answer: string): Answers {
  const q = questionAt(setOf(need, answers), key);
  if (q.kind !== 'one' && q.kind !== 'many') throw new ServicesLawError(`list: "${q.words}" is not a pick`);
  const next: Answers = { ...answers, [key]: q.kind === 'one' ? pressOne(q, textOf(answers, key), answer) : pressMany(q, rowsOf(answers, key), answer) };
  if (need !== 'unsure' || key !== 'closer' || (answers.closer === ONGOING) === (next.closer === ONGOING)) return next;
  return { ...next, budget: (next.closer === ONGOING ? MAINTENANCE_BANDS : PROJECT_BANDS).fixed };
}

/** A follow-up is asked while one of the answers that open it is pressed. */
export function followOpen(q: Question, answer: unknown): boolean {
  if (q.follow === undefined) return false;
  const { when } = q.follow;
  if (typeof answer === 'string') return when.includes(answer);
  return Array.isArray(answer) && answer.some((a) => when.includes(a));
}

/** A follow-up's words: those of the answer that opened it, where it has them (How did you find me?); its question's, where it has none; none while it is not asked (the reference's label at rest). */
export function followWords(follow: Follow, answer: Answer): string {
  if (follow.wordsBy === undefined) return follow.question.words;
  if (typeof answer !== 'string' || !follow.when.includes(answer)) return '';
  const words = follow.wordsBy[answer];
  if (words === undefined) throw new ServicesLawError(`list: the follow-up opened by "${answer}" has no words`);
  return words;
}

/** The referral's column, from the found answer and its follow-up, as the form wrote it: the answer, or `referral: {name}` / `other: {text}`. Undefined while nothing is picked: the body then carries none. */
export function referralSource(found: string, detail: string): string | undefined {
  if (found === '') return undefined;
  const tag = REFERRAL_TAGS[found];
  return tag === undefined ? found : `${tag}: ${detail.trim()}`;
}

/** What a body lacks, by name, and what it carries that no form sends. */
export interface ProposalCheck {
  /** The required picks, counts and follow-ups it lacks: what holds the button. */
  readonly held: string[];
  /** The required text answers it lacks: the browser's required fields. */
  readonly empty: string[];
  /** What no form sends: a key no question asks, an answer no question offers, a shape no field writes. */
  readonly wrong: string[];
  /** Its answers to keep, each under its key: texts trimmed, a pick-any's in the list's order. */
  readonly answers: Record<string, string | string[] | Record<string, string>>;
}

const WHOLE = /^\d{1,6}$/;
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const URL_SHAPE = /^[a-z][a-z0-9+.-]*:\S+$/i;
const TAGGED = /^(\w+):\s*([\s\S]*)$/;

/**
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling f: "THE BUTTON WAITS FOR WHAT A QUOTE NEEDS, AND THE ROUTE CHECKS THE SAME THINGS. The required picks, Bookkeeping's three counts, Other's description and the referral's follow-up hold the button; the required text answers are required fields, as Name and Email are. Nothing waits for a deadline. The hook's rule and the route's check read the same set, so the route refuses by name any body the button would have held back." — THE CHECK, one for both: the hook's rule is its held list
 * on the body the button would send (src/hooks/useProposalForm.ts, proposalHeld), and the route refuses by name any body it finds
 * anything in (src/app/api/proposals/route.ts). It reads the body and the list, nothing else; it imputes nothing — a question the body
 * leaves out is unanswered, a default included.
 */
export function proposalCheck(body: { readonly [field: string]: unknown }): ProposalCheck {
  const held: string[] = [];
  const empty: string[] = [];
  const wrong: string[] = [];
  const kept: Record<string, string | string[] | Record<string, string>> = {};
  for (const column of CORE_COLUMNS) {
    const value = body[column];
    if (typeof value !== 'string' || value.trim() === '') empty.push(questionAt(CORE_QUESTIONS, column).words);
  }
  const need = body.need;
  const door = SERVICES.find((s) => s.need === need);
  if (need === null || need === undefined) held.push(NEED_QUESTION);
  else if (door === undefined) wrong.push(`${NEED_QUESTION}: "${String(need)}" is no service`);
  const given = body.answers;
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    wrong.push('answers: not a set of answers');
    return { held, empty, wrong, answers: kept };
  }
  const answers = given as Readonly<Record<string, unknown>>;
  const asked = [...CORE_QUESTIONS.filter((q) => !(CORE_COLUMNS as readonly string[]).includes(q.key)), ...(door === undefined ? [] : setOf(door.need, answers as Answers))];
  const keys = new Set(questionsOf(asked).map((q) => q.key));
  for (const key of Object.keys(answers)) if (!keys.has(key)) wrong.push(`answers: no question asks "${key}"`);
  const take = (q: Question, words: string, holds: boolean): void => {
    const read = keptOf(q, answers[q.key]);
    if (read === null) {
      if (q.required) (holds ? held : empty).push(words);
    } else if ('wrong' in read) wrong.push(`${words}: ${read.wrong}`);
    else kept[q.key] = read.value;
  };
  for (const q of asked) {
    take(q, q.words, q.kind === 'one' || q.kind === 'many' || q.kind === 'counts');
    if (q.follow === undefined) continue;
    const answer = answers[q.key];
    if (followOpen(q, answer)) take(q.follow.question, followWords(q.follow, answer as Answer), true);
    else if (answers[q.follow.question.key] !== undefined) wrong.push(`${q.words}: a follow-up answered, though none of ${q.follow.when.join(', ')} is picked`);
  }
  const referral = body.referralSource;
  if (referral !== undefined) {
    const found = FOUND_QUESTION;
    const tagged = typeof referral === 'string' ? TAGGED.exec(referral.trim()) : null;
    const tag = tagged === null ? undefined : Object.keys(REFERRAL_TAGS).find((answer) => REFERRAL_TAGS[answer] === tagged[1]);
    if (typeof referral !== 'string') wrong.push(`${found.words}: not a text`);
    else if (found.kind === 'one' && found.answers.includes(referral) && REFERRAL_TAGS[referral] === undefined) return { held, empty, wrong, answers: kept }; // an answer that asks no follow-up: the referral's column holds it as it is
    else if (tagged === null || tag === undefined || found.follow === undefined) wrong.push(`${found.words}: "${referral}" is not one of its answers`);
    else if (tagged[2].trim() === '') held.push(followWords(found.follow, tag));
    else if (tagged[2].trim().length > DETAIL_MAX) wrong.push(`${followWords(found.follow, tag)}: longer than ${DETAIL_MAX} characters`);
  }
  // the referral keeps its own column: it is checked here, and the route keeps it there, never under answers
  return { held, empty, wrong, answers: kept };
}

/** A question's answer as the route reads it: null when unanswered (missing, an empty text, no row, a part missing); its reason when no form writes it; else the answer to keep. */
type Read = null | { readonly wrong: string } | { readonly value: string | string[] | Record<string, string> };

function keptOf(q: Question, value: unknown): Read {
  if (value === undefined) return null;
  const longest = q.max === undefined ? ANSWER_MAX : q.max;
  switch (q.kind) {
    case 'one':
      if (typeof value !== 'string') return { wrong: `not one of its answers` };
      if (value === '') return null;
      return q.answers.includes(value) ? { value } : { wrong: `"${value}" is not one of its answers` };
    case 'many': {
      if (!Array.isArray(value) || value.some((a) => typeof a !== 'string' || !q.answers.includes(a))) return { wrong: `an answer it does not offer` };
      const picked = q.answers.filter((a) => value.includes(a));
      if (picked.length !== value.length) return { wrong: `an answer twice` };
      if (picked.length > 1 && picked.some((a) => q.alone.includes(a))) return { wrong: `an answer that stands alone, with others` };
      return picked.length === 0 ? null : { value: picked };
    }
    case 'counts': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return { wrong: `not a count of each part` };
      const parts = value as Record<string, unknown>;
      const names = q.parts.map((part) => part.key);
      if (Object.keys(parts).some((key) => !names.includes(key))) return { wrong: `a part it does not ask` };
      if (names.some((key) => typeof parts[key] !== 'string' || (parts[key] as string).trim() === '')) return null;
      if (names.some((key) => !WHOLE.test((parts[key] as string).trim()))) return { wrong: `a count that is not a whole number` };
      return { value: Object.fromEntries(names.map((key) => [key, (parts[key] as string).trim()])) };
    }
    case 'dated': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return { wrong: `not a date and its why` };
      const parts = value as Record<string, unknown>;
      if (Object.keys(parts).some((key) => key !== 'date' && key !== 'why') || Object.values(parts).some((v) => typeof v !== 'string')) return { wrong: `not a date and its why` };
      const date = typeof parts.date === 'string' ? parts.date.trim() : '';
      const why = typeof parts.why === 'string' ? parts.why.trim() : '';
      if (date !== '' && !DAY.test(date)) return { wrong: `not a date` };
      if (why.length > ANSWER_MAX) return { wrong: `longer than ${ANSWER_MAX} characters` };
      if (date === '' && why === '') return null;
      return { value: Object.fromEntries([...(date === '' ? [] : [['date', date]]), ...(why === '' ? [] : [['why', why]])]) };
    }
    case 'links': {
      if (!Array.isArray(value) || value.some((row) => typeof row !== 'string')) return { wrong: `not a list of links` };
      const rows = (value as string[]).map((row) => row.trim()).filter((row) => row !== '');
      if (rows.length > LINK_ROWS) return { wrong: `more than ${LINK_ROWS} links` };
      if (rows.some((row) => row.length > longest || !URL_SHAPE.test(row))) return { wrong: `a link that is not one` };
      return rows.length === 0 ? null : { value: rows };
    }
    default: {
      if (typeof value !== 'string') return { wrong: `not a text` };
      const text = value.trim();
      if (text === '') return null;
      if (text.length > longest) return { wrong: `longer than ${longest} characters` };
      if (q.kind === 'url' && !URL_SHAPE.test(text)) return { wrong: `not a web address` };
      if (q.kind === 'number' && !WHOLE.test(text)) return { wrong: `not a whole number` };
      if (q.kind === 'month' && !MONTH.test(text)) return { wrong: `not a month` };
      return { value: text };
    }
  }
}


const KEY = /^[a-z]+$/;
const PRICE = /\$\s*\d/;
const ADDS_NEED_CONSTRAINT = /\bADD\s+CONSTRAINT\s+"?proposals_need_chk"?/i;
const NEED_IN_LIST = /\bADD\s+CONSTRAINT\s+"?proposals_need_chk"?\s+CHECK\s*\(\s*"?need"?\s+IN\s*\(([^)]*)\)\s*\)/gi;

export class ServicesLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServicesLawError';
  }
}

/**
 * SQL with its comments blanked — a comment that quotes the DDL is not the DDL. `--` runs to the end of its line; a
 * slash-star comment to its close (not nested), its newlines kept. A quoted string is kept whole: '' inside it is a quote, and in
 * an E'...' string a backslash escapes the next character.
 */
export function sqlCode(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      out += sql.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
      continue;
    }
    if (c === "'") {
      const escapes = /[eE]/.test(sql[i - 1] ?? '') && !/\w/.test(sql[i - 2] ?? '');
      let j = i + 1;
      while (j < sql.length) {
        if (escapes && sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * The CHECK in force: the LAST migration, by directory order, whose SQL (comments blanked) adds proposals_need_chk, and
 * the IN list of the LAST such ADD in it — `words` is null when that ADD is not written `"need" IN (...)` (the law then
 * refuses by name; it never looks back to an older migration). Null when no migration adds the CHECK. The caller's
 * order is not trusted: the migrations are sorted by `dir` here.
 */
export function needCheckWords(migrations: ReadonlyArray<{ dir: string; sql: string }>): { dir: string; words: string[] | null } | null {
  const adding = [...migrations]
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0))
    .map((m) => ({ dir: m.dir, sql: sqlCode(m.sql) }))
    .filter((m) => ADDS_NEED_CONSTRAINT.test(m.sql));
  const last = adding[adding.length - 1];
  if (last === undefined) return null;
  const addsAt = [...last.sql.matchAll(new RegExp(ADDS_NEED_CONSTRAINT.source, 'gi'))].map((m) => m.index);
  const lists = [...last.sql.matchAll(NEED_IN_LIST)];
  const inForce = lists[lists.length - 1];
  // the last ADD must be the one the IN-list reading found — an unreadable last ADD is refused, an older readable one is not used
  if (inForce === undefined || inForce.index !== addsAt[addsAt.length - 1]) return { dir: last.dir, words: null };
  return { dir: last.dir, words: [...inForce[1].matchAll(/'([^']*)'/g)].map((m) => m[1]) };
}

/** THE LAW. Throws on the first failure by default; returns the violations when asked not to throw. Every input is injectable for tests. */
export function servicesLaw(
  opts: {
    throwOnFail?: boolean;
    services?: ReadonlyArray<Service>;
    legacy?: Readonly<Record<string, string>>;
    bookkeeping?: Readonly<Record<string, string>>;
    migrations?: ReadonlyArray<{ dir: string; sql: string }>;
  } = {},
): string[] {
  const violations: string[] = [];
  const services = opts.services ?? SERVICES;
  const legacy = opts.legacy ?? LEGACY_NEED_TITLES;
  const bookkeeping = opts.bookkeeping ?? BOOKKEEPING_WORDS;
  const keys = [...services.map((s) => s.need), ...Object.keys(legacy)];
  const seen = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string' || !KEY.test(key)) violations.push(`services: the key "${String(key)}" is not lower-case letters`);
    if (seen.has(key)) violations.push(`services: the key "${key}" is held twice`);
    seen.add(key);
  }
  for (const s of services) {
    if (typeof s.title !== 'string' || s.title.trim() === '') violations.push(`services: the door "${s.need}" has no title`);
    if (typeof s.line !== 'string' || s.line.trim() === '') violations.push(`services: the door "${s.need}" has no line`);
  }
  for (const [key, title] of Object.entries(legacy)) {
    if (typeof title !== 'string' || title.trim() === '') violations.push(`services: the legacy key "${key}" has no title`);
  }
  const worded: Array<[string, unknown]> = [
    ...services.flatMap((s): Array<[string, unknown]> => [[`the door "${s.need}"'s title`, s.title], [`the door "${s.need}"'s line`, s.line]]),
    ...Object.entries(legacy).map(([key, title]): [string, unknown] => [`the legacy key "${key}"'s title`, title]),
    ...Object.entries(bookkeeping).map(([key, words]): [string, unknown] => [`BOOKKEEPING_WORDS.${key}`, words]),
  ];
  for (const [where, words] of worded) {
    if (typeof words === 'string' && PRICE.test(words)) violations.push(`services: ${where} carries a fixed price ("$" followed by a digit) — a door is priced by proposal`);
  }
  if (opts.migrations !== undefined) {
    const check = needCheckWords(opts.migrations);
    if (check === null) {
      violations.push('services: no migration adds proposals_need_chk');
    } else if (check.words === null) {
      violations.push(`services: ${check.dir} adds proposals_need_chk in a shape the law cannot read — write its last ADD as CHECK ("need" IN (...))`);
    } else {
      const words = check.words;
      const want = [...keys].sort();
      const have = [...words].sort();
      const missing = want.filter((w) => !words.includes(w));
      const extra = words.filter((w) => !keys.includes(w));
      const twice = words.filter((w, i) => words.indexOf(w) !== i);
      if (missing.length || extra.length || twice.length || want.join(',') !== have.join(',')) {
        violations.push(
          `services: proposals_need_chk (${check.dir}) holds [${words.join(', ')}]; the module holds [${keys.join(', ')}]` +
            `${missing.length ? ` — missing ${missing.join(', ')}` : ''}${extra.length ? ` — not in the module: ${extra.join(', ')}` : ''}${twice.length ? ` — twice: ${twice.join(', ')}` : ''}`,
        );
      }
    }
  }
  if (violations.length && opts.throwOnFail !== false) throw new ServicesLawError(`SERVICES LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

servicesLaw();
