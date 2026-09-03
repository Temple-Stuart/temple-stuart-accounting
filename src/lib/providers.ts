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
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds the check only the schema text can answer — enum values === the
 * code set): deck words and codes unique; every ROUTING_RULES provider is a
 * menu provider and every (provider, resource) pair resolves; codes are
 * snake_case identifiers.
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

export interface Provider {
  /** The deck's word — PROVIDER_MENU / ROUTING_RULES spelling. */
  deck: string;
  /** The schema's word — the `arrival_provider` enum value. */
  code: string;
  /** Named in the menu's TODAY column (true) or its NEXT column (false). */
  today: boolean;
  /** The resources this provider sends, as ROUTING_RULES spells them (empty until the rule book names one). */
  resources: readonly string[];
}

/** deck word → enum code: spaces become underscores; nothing else changes. */
export function providerCode(deck: string): string {
  return deck.replace(/ /g, '_');
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
          resources: ROUTING_RULES.filter(([p]) => p === deck).map(([, r]) => r),
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

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. */
export function providersLaw(opts: { throwOnFail?: boolean } = {}): string[] {
  const violations: string[] = [];
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
  if (violations.length && opts.throwOnFail !== false) throw new Error(`PROVIDER VOCABULARY LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

providersLaw();
