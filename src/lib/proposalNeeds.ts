/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE PROPOSAL FORM'S "WHAT DO YOU NEED?" VOCABULARY, typed once.
 *
 * SERVICES-01 (Alex, 2026-11-08 11:00 + 11:15) — THE SERVICES OFFER, ONE MODULE. The DONE-FOR-YOU panel holds six
 * equal doors; every door's key and words live HERE, and the panel (src/components/landing/Landing.tsx — ServicesSection.tsx since
 * HOME-SERVICES-01, 2026-11-12, which Landing.tsx mounts), the form
 * (src/app/work-with-me/WorkWithMeForm.tsx), the route (src/app/api/proposals/route.ts) and the CRM
 * (src/lib/crm/crm.ts needWords) read them. The 2026 close retired everywhere — its card, its leaf
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
 *   BOOKKEEPING_WORDS    the form's bookkeeping block (what it is, what it is not, the remedy) and the done
 *                        question's example when bookkeeping is picked;
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
 *   FORM_ASKS, formAsks  step 2: the form's questions by short name, in the form's order — "Timeline" and "Budget range" are
 *                        its labels as they stand (ASK_TIMELINE, ASK_BUDGET: the form reads them from here now) — less Modules
 *                        where the form asks none (NO_MODULES_NEEDS). Ruling e: "Step 2 follows the form's own rule (no
 *                        modules for bookkeeping): one rule read by both, or a test that renders the form for each door and
 *                        holds the two equal." — the test (src/lib/__tests__/homeServices01.test.ts): the form keeps its own
 *                        rule, isBookkeeping, as SERVICES-01 pinned it;
 *   PROPOSAL_CTA, SCOPED_BY_PROPOSAL, proposalFormHref
 *                        ruling f, in part: ""Send a project proposal →" and "Scoped by proposal" move from Landing.tsx into
 *                        a leaf." The form reads the second from here too. The gold button links to the form's page with the
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

/** HOME-SERVICES-01 (ruling f): the gold button's words and the note beside it, moved here from Landing.tsx — the form reads the note too. */
export const PROPOSAL_CTA = 'Send a project proposal →';
export const SCOPED_BY_PROPOSAL = 'Scoped by proposal';

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

/** SERVICES-01 (2026-11-08): the form's bookkeeping block and the done question's example; notTax and remedy verbatim from the retired closeWords. */
export const BOOKKEEPING_WORDS = {
  what: 'Catch-up on the months you fell behind, or monthly bookkeeping going forward: every bank and card account reconciled, every transaction categorized, and the statements whoever files your taxes needs.',
  notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
  remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
  done: 'e.g. 3 bank and card accounts, about 400 transactions a month, books current through March — caught up, then kept every month.',
} as const;

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
