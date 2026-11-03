/**
 * REBUILD-01 PR-1 — THE PROVIDER VOCABULARY. One list of the providers the
 * deck names and the resources each one sends, shared by the deck, the schema
 * and the code (ruling 10 of the README desk). The two deck consts below moved
 * out of Landing.tsx BYTE-IDENTICAL (the PROBLEM_SHEET / ANSWER_ROWS precedent):
 * PROVIDER_MENU is step 2's menu — [job, today, next] — and ROUTING_RULES is
 * step 4's rule book — [provider, resource, KIND, means]. The deck imports them;
 * nothing here is retyped.
 *
 * PROVIDERS derives from them: one entry per provider word the menu names
 * (today and next; '—' is deck content, not a provider; a ' · ' cell lists
 * several), `code` = the deck word with spaces as underscores — the value the
 * Prisma enum `arrival_provider` carries — and `resources` = the provider's
 * ROUTING_RULES rows, spelled as the deck spells them.
 *
 * RULEBOOK-01: THIS FILE IS THE RULE BOOK the system applies. RULE_BOOK is
 * every (provider, resource) with its KIND — the deck's ROUTING_RULES rows
 * verbatim plus ADDED_RULES, the rows the deck's twenty-row sample omits but
 * the store lands (plaid · security → reference, plaid · investment_transaction
 * → event, stripe · event → event, liteapi · cancellation → event; plaid ·
 * holding → snapshot is already a deck row). Landing consults
 * it (src/lib/arrivals/land.ts kindOf): every arrival carries its kind, and an
 * arrival with no rule is a loud failure — no default, ever. The six kinds are
 * the deck's HANDOFF_KINDS in the essay's order; nothing ever ARRIVES as a
 * posting (the deck's closed-set law), so no rule may carry it.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds the checks only the schema, the migration and the call sites can
 * answer — enum values === the code set, enum arrival_kind === ARRIVAL_KINDS,
 * every landing call site's resource is in the book): deck words and codes
 * unique; every ROUTING_RULES provider is a menu provider and every (provider,
 * resource) pair resolves; codes are snake_case identifiers; every
 * ROUTING_RULES row is in the book with the same kind; no (provider, resource)
 * has two kinds; every kind is one of the six and never posting.
 *
 * DATAFLOW-01 (Alex, 2026-11-02): A RETIRED PROVIDER is one the product no longer
 * calls. Its menu word, its rule-book rows and its `arrival_provider` enum value
 * STAY — dropping them is a migration (a hard gate, not this file). RETIRED_PROVIDERS
 * names it with the day it left and the commit that removed its last call site, and
 * the deck reads it to say whom it speaks to TODAY (LIVE_PROVIDERS, liveMenuCell) and
 * to count the live feeds (RULE_BOOK_COUNTS_LINE — "<n> feeds from <m> providers, per
 * the rule book", no typed date: this file is the date). The law adds: a retired word
 * names a TODAY provider and carries its day and commit; every menu row keeps one
 * live TODAY provider; every live provider sends at least one ruled feed.
 *
 * Zero imports: server- and client-safe.
 */

export const PROVIDER_MENU = [
  ['banks & accounts', 'plaid', 'teller'],
  ['card money', 'stripe', 'square'],
  ['trades & market data', 'tastytrade', 'schwab · ibkr · alpaca · tradier · snaptrade'],
  ['company numbers', 'finnhub', 'polygon'],
  ['the economy', 'fred', '—'],
  ['filings', 'sec', '—'],
  ['flights', 'liteapi', 'amadeus'],
  ['hotels', 'liteapi', 'amadeus'],
  ['activities', 'viator', '—'],
  ['locations', 'google places', '—'],
  ['visas', 'travel buddy', '—'],
  ['our AI', 'anthropic · openai · xai grok · voyage', '—'],
  ['the law itself', 'ecfr · us code · federal register · irs', '—'],
] as const;

export const ROUTING_RULES = [
  ['plaid', 'transaction', 'EVENT', 'something that happened'],
  ['plaid', 'account', 'REGISTRY', 'one of your accounts'],
  ['plaid', 'holding', 'SNAPSHOT', 'how things stood at one moment'],
  ['stripe', 'payout', 'EVENT', ''],
  ['tastytrade', 'quote', 'REFERENCE', 'a fact about the world'],
  ['finnhub', 'fundamentals', 'REFERENCE', ''],
  ['fred', 'series', 'REFERENCE', ''],
  ['sec', 'filing', 'REFERENCE', ''],
  ['liteapi', 'booking', 'EVENT', ''],
  ['viator', 'activity', 'REFERENCE', ''],
  ['google places', 'place', 'REFERENCE', ''],
  ['travel buddy', 'visa', 'REFERENCE', ''],
  ['anthropic', 'classification', 'DERIVED', 'math we did — never a source'],
  ['openai', 'insight', 'DERIVED', ''],
  ['xai grok', 'sentiment', 'DERIVED', ''],
  ['voyage', 'embedding', 'DERIVED', ''],
  ['ecfr', 'title', 'REFERENCE', ''],
  ['us code', 'title', 'REFERENCE', ''],
  ['federal register', 'document', 'REFERENCE', ''],
  ['irs', 'bulletin', 'REFERENCE', ''],
] as const;

/**
 * RULEBOOK-01: the rows the deck's sample omits — the store lands them, so the
 * book must name them. Same shape as ROUTING_RULES: [provider, resource, KIND,
 * means]; MEANS is empty because each kind's first appearance is a deck row
 * (the deck's own convention for repeat rows). plaid · holding is NOT here: it
 * is already a ROUTING_RULES row (SNAPSHOT), and one pair may hold one rule.
 */
export const ADDED_RULES = [
  ['plaid', 'security', 'REFERENCE', ''],
  ['plaid', 'investment_transaction', 'EVENT', ''],
  // REBUILD-01 PR-4: the webhook delivers Stripe EVENTS (the deck's row names the payout the events carry).
  ['stripe', 'event', 'EVENT', ''],
  // REBUILD-01 PR-5: LiteAPI's cancel answer (PUT /bookings/{id}) is its own arrival — something that happened to a booking.
  ['liteapi', 'cancellation', 'EVENT', ''],
  // STATUS-01 (2026-09-26): a booking READ (GET /bookings/{id}, GET /flights/bookings/{id}) is the vendor's
  // CURRENT state of an object we hold — a snapshot, re-taken; their_id is composed (`read:<bookingId>`)
  // so an identical re-read is already_landed and a changed state is a corrected snapshot.
  ['liteapi', 'booking_read', 'SNAPSHOT', ''],
  // STATUS-01: a webhook delivery is something the vendor TOLD us happened — an event, landed before it is
  // parsed, keyed by the vendor's event_id. It is a hint: the read above is the truth.
  ['liteapi', 'webhook', 'EVENT', ''],
] as const;

/**
 * The six kinds, the deck's HANDOFF_KINDS order (the essay's Step 5 list; the
 * Prisma enum `arrival_kind` and the migration's CREATE TYPE list them in this
 * order — asserted at build). Five arrive; posting is written, never received.
 */
export const ARRIVAL_KINDS = ['reference', 'registry', 'event', 'derived', 'snapshot', 'posting'] as const;
export type ArrivalKind = (typeof ARRIVAL_KINDS)[number];

export interface Rule {
  /** The deck's provider word. */
  provider: string;
  /** The schema's word — the `arrival_provider` enum value (what a landing call passes). */
  code: string;
  resource: string;
  kind: ArrivalKind;
  /** The deck's MEANS cell — spoken on a kind's first appearance, empty on repeats. */
  means: string;
  /** 'deck' — a ROUTING_RULES row verbatim; 'added' — an ADDED_RULES row. */
  source: 'deck' | 'added';
}

export interface Provider {
  /** The deck's word — PROVIDER_MENU / ROUTING_RULES spelling. */
  deck: string;
  /** The schema's word — the `arrival_provider` enum value. */
  code: string;
  /** Named in the menu's TODAY column (true) or its NEXT column (false). */
  today: boolean;
  /** The resources this provider sends, as the rule book spells them (empty until the book names one). */
  resources: readonly string[];
}

/** deck word → enum code: spaces become underscores; nothing else changes. */
export function providerCode(deck: string): string {
  return deck.replace(/ /g, '_');
}

/** THE RULE BOOK: the deck's rows verbatim (kind lowercased — the enum's spelling), then the added rows. */
export const RULE_BOOK: readonly Rule[] = [
  ...ROUTING_RULES.map(([provider, resource, kind, means]): Rule => ({ provider, code: providerCode(provider), resource, kind: kind.toLowerCase() as ArrivalKind, means, source: 'deck' })),
  ...ADDED_RULES.map(([provider, resource, kind, means]): Rule => ({ provider, code: providerCode(provider), resource, kind: kind.toLowerCase() as ArrivalKind, means, source: 'added' })),
];

/** The rule for a (provider code, resource), or undefined when the book has none. */
export function ruleFor(providerCode: string, resource: string): Rule | undefined {
  return RULE_BOOK.find((r) => r.code === providerCode && r.resource === resource);
}

export class NoRuleError extends Error {
  constructor(providerCode: string, resource: string) {
    super(`rule book: no rule for ${providerCode} · ${resource} — every feed gets one written kind before it lands (src/lib/providers.ts RULE_BOOK); nothing is assumed`);
    this.name = 'NoRuleError';
  }
}

/** The kind the book assigns — the one legal way an arrival gets its kind. Throws when the book has no rule; never defaults. */
export function kindOf(providerCode: string, resource: string): ArrivalKind {
  const rule = ruleFor(providerCode, resource);
  if (!rule) throw new NoRuleError(providerCode, resource);
  return rule.kind;
}

const menuWords = (cell: string): string[] => (cell === '—' ? [] : cell.split(' · '));

/** Every provider the deck names, menu order (a row's TODAY word before its NEXT words), each once. */
export const PROVIDERS: readonly Provider[] = (() => {
  const out: Provider[] = [];
  for (const [, today, next] of PROVIDER_MENU) {
    for (const [words, isToday] of [[menuWords(today), true], [menuWords(next), false]] as const) {
      for (const deck of words) {
        if (out.some((p) => p.deck === deck)) continue;
        out.push({
          deck,
          code: providerCode(deck),
          today: isToday,
          resources: RULE_BOOK.filter((r) => r.provider === deck).map((r) => r.resource),
        });
      }
    }
  }
  return out;
})();

/** The enum's values, alphabetical — the order the migration's CREATE TYPE lists them. */
export const PROVIDER_CODES: readonly string[] = [...PROVIDERS.map((p) => p.code)].sort();

export function providerByDeck(deck: string): Provider | undefined {
  return PROVIDERS.find((p) => p.deck === deck);
}

export function providerByCode(code: string): Provider | undefined {
  return PROVIDERS.find((p) => p.code === code);
}

/** DATAFLOW-01: [deck word, the day it left, the commit that removed its last call site]. Its rows above stay. */
export const RETIRED_PROVIDERS = [
  // PIPE-01 (8358dc28, 2026-09-10) "drop Grok": the sentiment route and its callers went with the provider.
  ['xai grok', '2026-09-10', '8358dc28'],
] as const;

export function isRetired(deck: string): boolean {
  return RETIRED_PROVIDERS.some(([word]) => word === deck);
}

/** The providers the deck speaks to today: the menu's TODAY words, each once, in menu order, retired excluded. */
export const LIVE_PROVIDERS: readonly Provider[] = PROVIDERS.filter((p) => p.today && !isRetired(p.deck));

/** A menu TODAY cell as the deck speaks it today — its words minus the retired. The law keeps a live word in every row, so an empty cell is a loud failure. */
export function liveMenuCell(cell: string): string {
  const words = menuWords(cell).filter((w) => !isRetired(w));
  if (words.length === 0) throw new Error(`providers: the menu cell "${cell}" names no provider live today — every row keeps one (providersLaw)`);
  return words.join(' · ');
}

/**
 * DATAFLOW-01 C — the deck's size, derived: feeds are the rule book's rows whose
 * provider is live today; providers are the live providers. A retired provider's
 * rows stay in the book and leave both counts, so every counted feed comes from a
 * counted provider.
 */
export function ruleBookCounts(book: readonly Rule[] = RULE_BOOK, live: readonly Provider[] = LIVE_PROVIDERS): { feeds: number; providers: number } {
  const decks = new Set(live.map((p) => p.deck));
  return { feeds: book.filter((r) => decks.has(r.provider)).length, providers: live.length };
}

/** Steps 3 and 5 render this: "<n> feeds from <m> providers, per the rule book". */
export function ruleBookCountsLine(counts: { feeds: number; providers: number } = ruleBookCounts()): string {
  return `${counts.feeds} feeds from ${counts.providers} providers, per the rule book`;
}

export const RULE_BOOK_COUNTS_LINE = ruleBookCountsLine();

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. `book` is injectable for tests. */
export function providersLaw(opts: { throwOnFail?: boolean; book?: readonly Rule[] } = {}): string[] {
  const violations: string[] = [];
  const book = opts.book ?? RULE_BOOK;
  const decks = PROVIDERS.map((p) => p.deck);
  const codes = PROVIDERS.map((p) => p.code);
  if (new Set(decks).size !== decks.length) violations.push('PROVIDERS: a deck word repeats');
  if (new Set(codes).size !== codes.length) violations.push('PROVIDERS: a code repeats');
  for (const p of PROVIDERS) {
    if (!/^[a-z][a-z0-9_]*$/.test(p.code)) violations.push(`${p.deck}: code "${p.code}" is not a snake_case identifier`);
    if (providerCode(p.deck) !== p.code) violations.push(`${p.deck}: code "${p.code}" is not the deck word`);
  }
  for (const [provider, resource] of ROUTING_RULES) {
    const p = providerByDeck(provider);
    if (!p) violations.push(`ROUTING_RULES: "${provider}" is not a provider the menu names`);
    else if (!p.resources.includes(resource)) violations.push(`ROUTING_RULES: ${provider} ${resource} does not resolve`);
  }
  // RULEBOOK-01: the book carries every deck row with the deck's kind; one rule per pair; six kinds, never posting.
  for (const [provider, resource, kind] of ROUTING_RULES) {
    const rule = book.find((r) => r.provider === provider && r.resource === resource);
    if (!rule) violations.push(`RULE_BOOK: the deck row ${provider} · ${resource} is missing`);
    else if (rule.kind !== kind.toLowerCase()) violations.push(`RULE_BOOK: ${provider} · ${resource} is ${rule.kind}; the deck says ${kind.toLowerCase()}`);
  }
  const pairs = new Map<string, ArrivalKind>();
  for (const r of book) {
    const key = `${r.provider} · ${r.resource}`;
    if (!(ARRIVAL_KINDS as readonly string[]).includes(r.kind)) violations.push(`RULE_BOOK: ${key} carries an unknown kind "${r.kind}"`);
    if (r.kind === 'posting') violations.push(`RULE_BOOK: ${key} is a posting — nothing ever arrives as a posting; the system writes postings from events`);
    if (!providerByDeck(r.provider)) violations.push(`RULE_BOOK: "${r.provider}" is not a provider the menu names`);
    if (r.code !== providerCode(r.provider)) violations.push(`RULE_BOOK: ${key} code "${r.code}" is not the deck word's code`);
    const prior = pairs.get(key);
    if (prior !== undefined) violations.push(`RULE_BOOK: ${key} has two rules (${prior}, ${r.kind}) — one pair, one kind`);
    pairs.set(key, r.kind);
  }
  // DATAFLOW-01: a retired word names a TODAY provider with its day and its commit; every menu row keeps
  // one live TODAY provider; every live provider sends at least one ruled feed (the size line counts both).
  for (const [word, day, commit] of RETIRED_PROVIDERS) {
    const p = providerByDeck(word);
    if (!p || !p.today) violations.push(`RETIRED_PROVIDERS: "${word}" is not a provider the menu's TODAY column names`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) violations.push(`RETIRED_PROVIDERS: ${word}'s day "${day}" is not YYYY-MM-DD`);
    if (!/^[0-9a-f]{7,40}$/.test(commit)) violations.push(`RETIRED_PROVIDERS: ${word}'s commit "${commit}" is not a commit id`);
  }
  for (const [job, today] of PROVIDER_MENU) {
    if (menuWords(today).every((w) => isRetired(w))) violations.push(`PROVIDER_MENU: "${job}" has no provider live today — every row keeps one`);
  }
  for (const p of LIVE_PROVIDERS) {
    if (!book.some((r) => r.provider === p.deck)) violations.push(`LIVE_PROVIDERS: ${p.deck} sends no feed the rule book names — the size line would count a provider with no feed`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new Error(`PROVIDER VOCABULARY LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

providersLaw();
