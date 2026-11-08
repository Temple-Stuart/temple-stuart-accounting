/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE PROPOSAL FORM'S "WHAT DO YOU NEED?" VOCABULARY, typed once.
 *
 * SERVICES-01 (Alex, 2026-11-08 11:00 + 11:15) — THE SERVICES OFFER, ONE MODULE. The DONE-FOR-YOU panel holds six
 * equal doors; every door's key and words live HERE, and the panel (src/components/landing/Landing.tsx), the form
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
 *   SERVICES             the six doors, in the panel's order — { need, title, line } — the one place a door's key
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

/** The six doors, in the panel's order (Alex, 2026-11-08: Alex is the voice; he vetoes words in chat). */
export const SERVICES = [
  { need: 'setup', title: 'Full setup', line: 'Your own hosted copy, every API wired, you own everything.' },
  { need: 'maintenance', title: 'Monthly maintenance', line: 'I keep it updated and running.' },
  { need: 'custom', title: 'Custom builds', line: 'Need a feature? I build it.' },
  { need: 'embed', title: 'Integration', line: 'One piece of this system (the booking engine, the books, the scanner) wired into the system you already run.' },
  { need: 'bookkeeping', title: 'Bookkeeping', line: 'Fell behind, or need a bookkeeper? Catch-up and monthly bookkeeping, billed monthly — the price follows your volume.' },
  { need: 'unsure', title: 'Something else', line: 'Out of scope, or not sure which fits? Tell me what you need.' },
] as const satisfies ReadonlyArray<Service>;

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
