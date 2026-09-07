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
 * → event, stripe · event → event; plaid · holding → snapshot is already a deck
 * row). Landing consults
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
  if (violations.length && opts.throwOnFail !== false) throw new Error(`PROVIDER VOCABULARY LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

providersLaw();
