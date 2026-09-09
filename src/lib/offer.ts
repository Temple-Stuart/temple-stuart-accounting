/**
 * SELL-02 — THE OFFER. One source for everything the product sells and
 * everything it gives away, derived from the tool registry (src/lib/toolRegistry.ts)
 * — never a retyped claim, never a second price.
 *
 *   OFFERS      — the sellable set: Books (tab:books — the four Answers, with
 *                 Trade, Tax and Compliance riding inside, each labeled by its
 *                 registry status) and the all-modules bundle. Each carries the
 *                 env var of its Stripe price id (the naming rule below) and the
 *                 price shown (`monthlyPrice` — Alex supplies the number; null
 *                 means nothing is shown and NOTHING IS SOLD: no buy button, a
 *                 declared line). A price renders only when BOTH the number and
 *                 the env price id exist (priceLineFor).
 *   TOOL_GATE   — the gate each tool's routes carry today (the SELL-01 census);
 *                 the free set is every LIVE tool with no gate (FREE_TOOLS).
 *   grants      — the tab keys a purchase satisfies at the gate. hasTabAccess
 *                 (server) and isTabLocked (client) consult keysGranting(), so a
 *                 Books buyer passes the tab:trade / tab:tax / tab:compliance
 *                 gates too — the offer is the ONE place that says so.
 *   claimLine   — the words a card may say about a tool: "built and running"
 *                 for LIVE only; "partial — <its beats>" for PARTIAL; a
 *                 NOT_BUILT tool throws — it cannot be sold.
 *
 * THE LAW (offerLaw — module scope, re-run at build by
 * scripts/assert-tool-registry.ts, which also scans the sources so the literal
 * "built and running" is typed nowhere but here): every offer tool is LIVE or
 * PARTIAL (a NOT_BUILT tool in an offer fails the build); an offer never lists a
 * tool its grants do not unlock; every gated tool is sold by some offer; the
 * bundle grants everything any offer grants; the purchasable keys are exactly
 * the offer keys — the nine Google category keys are not for sale (and
 * tab:operations left the vocabulary in SELL-05); every price env name follows
 * the naming rule; the free set holds no gated tool.
 *
 * Client- and server-safe: imports the registry (a leaf) and the key vocabulary.
 */
import { BUNDLE_ALL_KEY, GOOGLE_CATEGORY_KEYS, TAB_ENTITLEMENT_KEYS } from './categoryKeys';
import type { ToolName } from './problemSheet';
import { COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY, statusCounts, type Beats, type ToolEntry, type ToolStatus } from './toolRegistry';

export type TabKey = (typeof TAB_ENTITLEMENT_KEYS)[number];
export type OfferKey = 'tab:books' | typeof BUNDLE_ALL_KEY;

/**
 * The gate each tool's routes carry (SELL-01 census, main ce3c86da): null =
 * cookie only or public — free with an account; 'owner' = requireAdmin, the
 * founder's own surface, neither sold nor free.
 */
export const TOOL_GATE: Readonly<Record<ToolName, TabKey | 'owner' | null>> = {
  Calendar: null,
  Tasks: null,
  Time: null,
  CRM: 'owner',
  Contracts: null,
  Invoicing: null,
  Payments: null,
  'Bill Pay': null,
  Payroll: null,
  Expenses: null,
  Travel: null,
  Mileage: null,
  Budget: null,
  Banking: 'tab:books',
  'Fixed Assets': null,
  Retirement: null,
  Brokerage: 'tab:trade',
  'Trade Log': 'tab:books',
  Debt: null,
  'Sales Tax': null,
  'Ent Filings': null,
  Bookkeeping: 'tab:books',
  Tax: 'tab:tax',
  Compliance: 'tab:compliance',
  'FP&A': null,
};

export interface Offer {
  key: OfferKey;
  /** The `?module=` word (the door every selling surface links): books · all. */
  slug: string;
  label: string;
  /** What the buyer gets, by registry name — each labeled by its registry status at render (claimLine). */
  tools: readonly ToolName[];
  /** The four Answers (/answers) ride with it. */
  includesAnswers: boolean;
  /** The tab keys this purchase satisfies at the gate. */
  grants: readonly TabKey[];
  /** The price shown, USD per month — Alex supplies; null → no buy button, a declared line. */
  monthlyPrice: number | null;
}

/** The naming rule for a key's Stripe price id env var (was src/lib/stripe.ts entitlementPriceEnvName; stripe.ts re-exports this). */
export function priceEnvName(key: string): string {
  if (key === BUNDLE_ALL_KEY) return 'STRIPE_BUNDLE_ALL_PRICE_ID';
  if (key.startsWith('tab:')) return `STRIPE_TAB_${key.slice(4).toUpperCase()}_PRICE_ID`;
  return `STRIPE_CAT_${key.toUpperCase()}_PRICE_ID`;
}

/** The tools Books unlocks — every tab-gated tool in the registry, in sheet order (the bundle sells the same set; nothing else is sold). */
const BOOKS_TOOLS: readonly ToolName[] = TOOL_REGISTRY.filter((t) => {
  const g = TOOL_GATE[t.name];
  return g !== null && g !== 'owner';
}).map((t) => t.name);

export const OFFERS: readonly Offer[] = [
  {
    key: 'tab:books',
    slug: 'books',
    label: 'Books',
    tools: BOOKS_TOOLS,
    includesAnswers: true,
    grants: ['tab:books', 'tab:trade', 'tab:tax', 'tab:compliance'],
    monthlyPrice: null,
  },
  {
    key: BUNDLE_ALL_KEY,
    slug: 'all',
    label: 'Everything',
    tools: BOOKS_TOOLS,
    includesAnswers: true,
    grants: [...TAB_ENTITLEMENT_KEYS],
    monthlyPrice: null,
  },
];

/** The purchasable keys — exactly the offers'. src/lib/stripe.ts PURCHASABLE_ENTITLEMENT_KEYS is this. */
export const SELLABLE_KEYS: readonly string[] = OFFERS.map((o) => o.key);

export function offerFor(key: string | null | undefined): Offer | undefined {
  return OFFERS.find((o) => o.key === key);
}

/** `?module=books` or `?module=tab:books` — the door's word, either spelling. */
export function offerFromModuleParam(value: string | null | undefined): Offer | undefined {
  if (!value) return undefined;
  return OFFERS.find((o) => o.slug === value || o.key === value);
}

/** The offer to sell on a locked tab: the first (the cheapest by position) whose grants include the key. */
export function offerGranting(tabKey: string): Offer | undefined {
  return OFFERS.find((o) => (o.grants as readonly string[]).includes(tabKey));
}

/** Every entitlement key that satisfies a tab gate: the key itself and each offer that grants it (the bundle by its own grants). */
export function keysGranting(tabKey: string): string[] {
  const keys = [tabKey, ...OFFERS.filter((o) => (o.grants as readonly string[]).includes(tabKey)).map((o) => o.key)];
  return [...new Set(keys)];
}

/** The free set: LIVE tools with no gate — free with an account (Travel's search and booking are public). */
export const FREE_TOOLS: readonly ToolEntry[] = TOOL_REGISTRY.filter((t) => t.status === 'LIVE' && TOOL_GATE[t.name] === null);

export class OfferLawError extends Error {
  constructor(message: string) {
    super(`OFFER LAW: ${message}`);
    this.name = 'OfferLawError';
  }
}

const BEAT_NAMES: ReadonlyArray<keyof Beats> = ['discover', 'decide', 'commit', 'record'];

export function beatsOf(b: Beats): string[] {
  return BEAT_NAMES.filter((name) => b[name]);
}

/**
 * What a selling surface may say about a tool — from its registry status, never typed.
 * TRUTH-01b: a PARTIAL with all four beats cited says WHY it is not LIVE (the registry's
 * `why`, verbatim — "partial — <why>"); fewer than four beats keeps the beats form
 * ("partial — discover · decide"). A four-beat PARTIAL without a why is a registry-law
 * violation, thrown here too — never the beats form as a stand-in.
 */
export function claimLine(tool: Pick<ToolEntry, 'name' | 'status' | 'beats' | 'why'>): string {
  if (tool.status === 'LIVE') return 'built and running';
  if (tool.status === 'PARTIAL') {
    const beats = beatsOf(tool.beats);
    if (beats.length === BEAT_NAMES.length) {
      if (!tool.why?.trim()) throw new OfferLawError(`${tool.name} is PARTIAL with four beats and no why — the registry law requires one`);
      return `partial — ${tool.why}`;
    }
    return `partial — ${beats.join(' · ')}`;
  }
  throw new OfferLawError(`${tool.name} is NOT_BUILT — it cannot be sold, so it has no claim line`);
}

/** The landing's free line — the free set's names and a count-true noun ("tool" for one, "tools" otherwise); the rest of the sentence is the one the landing carried. */
export function freeSetLine(free: ReadonlyArray<Pick<ToolEntry, 'name'>> = FREE_TOOLS): string {
  return `Free with an account, no module to buy: ${free.map((t) => t.name).join(', ')} — the registry's live ${free.length === 1 ? 'tool' : 'tools'} with no tab gate.`;
}

/** The claim line for a cockpit section's primary tool (COCKPIT_PRIMARY_TOOL) — the free showcases' CTAs read this. */
export function claimForCockpit(cockpitKey: string): string {
  const name = COCKPIT_PRIMARY_TOOL[cockpitKey];
  const tool = name ? TOOL_REGISTRY.find((t) => t.name === name) : undefined;
  if (!tool) throw new OfferLawError(`claimForCockpit: ${cockpitKey} names no registry tool`);
  return claimLine(tool);
}

export type PriceLine =
  | { kind: 'live'; monthlyPrice: number; text: string }
  | { kind: 'unset'; text: string; missing: ReadonlyArray<'price' | 'stripe'> };

/** The price a card shows: the number only when the const has it AND the Stripe price id env is set; else the declared line — and no buy button. */
export function priceLineFor(offer: Pick<Offer, 'monthlyPrice'>, stripeConfigured: boolean): PriceLine {
  const missing: Array<'price' | 'stripe'> = [];
  if (offer.monthlyPrice === null) missing.push('price');
  if (!stripeConfigured) missing.push('stripe');
  if (missing.length === 0) return { kind: 'live', monthlyPrice: offer.monthlyPrice as number, text: `$${offer.monthlyPrice}/mo` };
  return { kind: 'unset', text: 'Not for sale yet — no price is set.', missing };
}

export interface OfferToolLine {
  name: ToolName;
  status: ToolStatus;
  claim: string;
}

/** The card every selling surface renders: label, the tools with their claim lines, the price line, and whether a buy button may render. */
export interface OfferCardModel {
  key: OfferKey;
  slug: string;
  label: string;
  includesAnswers: boolean;
  tools: OfferToolLine[];
  price: PriceLine;
  buyable: boolean;
}

export function offerCard(offer: Offer, availability: Readonly<Record<string, boolean>>): OfferCardModel {
  const price = priceLineFor(offer, availability[offer.key] === true);
  return {
    key: offer.key,
    slug: offer.slug,
    label: offer.label,
    includesAnswers: offer.includesAnswers,
    tools: offer.tools.map((name) => {
      const tool = TOOL_REGISTRY.find((t) => t.name === name);
      if (!tool) throw new OfferLawError(`${name} is not a registry tool`);
      return { name, status: tool.status, claim: claimLine(tool) };
    }),
    price,
    buyable: price.kind === 'live',
  };
}

/** Per offer key, is its Stripe price id set — an env-presence read, the value never leaves the server. */
export function offerAvailabilityFromEnv(env: Readonly<Record<string, string | undefined>>): Record<string, boolean> {
  return Object.fromEntries(OFFERS.map((o) => [o.key, typeof env[priceEnvName(o.key)] === 'string' && env[priceEnvName(o.key)] !== '']));
}

export type ModuleDoorPlan =
  | { kind: 'none' }
  | { kind: 'wait'; key: OfferKey }
  | { kind: 'register'; key: OfferKey }
  | { kind: 'checkout'; key: OfferKey };

/**
 * The `?module=<key>` door, read on both landings: a guest → the sign-up modal
 * with the key pending (after sign-up, checkout); a signed-in viewer → checkout
 * now; auth still resolving → wait. An unknown word is no door.
 */
export function moduleDoorPlan(search: string, authed: boolean | null): ModuleDoorPlan {
  const offer = offerFromModuleParam(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('module'));
  if (!offer) return { kind: 'none' };
  if (authed === null) return { kind: 'wait', key: offer.key };
  return { kind: authed ? 'checkout' : 'register', key: offer.key };
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five'] as const;

export function numberWord(n: number): string {
  const w = NUMBER_WORDS[n];
  if (w === undefined) throw new OfferLawError(`numberWord: ${n} is outside 0–${NUMBER_WORDS.length - 1}`);
  return w;
}

/** The hero's claim — the registry's counts in words, never typed. */
export function heroCountsLine(registry: readonly ToolEntry[] = TOOL_REGISTRY): string {
  const c = statusCounts(registry);
  const total = numberWord(registry.length);
  return `${total.charAt(0).toUpperCase()}${total.slice(1)} tools, counted: ${numberWord(c.LIVE)} live, ${numberWord(c.PARTIAL)} partial, ${numberWord(c.NOT_BUILT)} on the blueprint.`;
}

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. Everything is injectable for tests. */
export function offerLaw(opts: {
  throwOnFail?: boolean;
  offers?: readonly Offer[];
  gate?: Readonly<Record<string, TabKey | 'owner' | null>>;
  registry?: readonly ToolEntry[];
  purchasable?: readonly string[];
} = {}): string[] {
  const offers = opts.offers ?? OFFERS;
  const gate = opts.gate ?? TOOL_GATE;
  const registry = opts.registry ?? TOOL_REGISTRY;
  const purchasable = opts.purchasable ?? offers.map((o) => o.key);
  const violations: string[] = [];
  const byName = new Map(registry.map((t) => [t.name, t]));
  const vocabulary = new Set<string>([...TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY]);
  const keys = new Set<string>();
  const slugs = new Set<string>();
  for (const o of offers) {
    if (keys.has(o.key)) violations.push(`${o.key}: offered twice`);
    keys.add(o.key);
    if (slugs.has(o.slug)) violations.push(`${o.label}: the slug "${o.slug}" is used twice`);
    slugs.add(o.slug);
    if (!vocabulary.has(o.key)) violations.push(`${o.key}: not an entitlement key the store knows (categoryKeys.ts)`);
    if (o.monthlyPrice !== null && !(Number.isFinite(o.monthlyPrice) && o.monthlyPrice > 0)) violations.push(`${o.key}: monthlyPrice must be a positive number or null`);
    if (o.tools.length === 0) violations.push(`${o.key}: sells no tool`);
    for (const name of o.tools) {
      const t = byName.get(name);
      if (!t) { violations.push(`${o.key}: ${name} is not a registry tool`); continue; }
      if (t.status === 'NOT_BUILT') violations.push(`${o.key}: ${name} is NOT_BUILT — a tool that does not exist cannot be sold`);
      const g = gate[name];
      if (g === null || g === undefined || g === 'owner') violations.push(`${o.key}: ${name} carries no tab gate (${g ?? 'none'}) — an offer lists only what it unlocks`);
      else if (!(o.grants as readonly string[]).includes(g)) violations.push(`${o.key}: ${name} is gated by ${g}, which this offer does not grant`);
    }
    for (const g of o.grants) if (!(TAB_ENTITLEMENT_KEYS as readonly string[]).includes(g)) violations.push(`${o.key}: grants ${g}, not a tab key`);
  }
  const bundle = offers.find((o) => o.key === BUNDLE_ALL_KEY);
  if (bundle) {
    for (const o of offers) for (const g of o.grants) if (!(bundle.grants as readonly string[]).includes(g)) violations.push(`bundle:all does not grant ${g}, which ${o.key} grants`);
  }
  // every gated tool is sold somewhere (the founder's own surface excepted)
  for (const t of registry) {
    const g = gate[t.name];
    if (g === null || g === undefined || g === 'owner') continue;
    if (!offers.some((o) => (o.grants as readonly string[]).includes(g))) violations.push(`${t.name}: gated by ${g}, which no offer grants — sold nowhere`);
    if (!offers.some((o) => o.tools.includes(t.name))) violations.push(`${t.name}: gated by ${g} but listed in no offer — the buyer is not told`);
  }
  // the purchasable set is exactly the offers
  const offerKeys = offers.map((o) => o.key).sort();
  const sold = [...purchasable].sort();
  if (offerKeys.join(',') !== sold.join(',')) violations.push(`purchasable keys [${sold.join(', ')}] ≠ the offers [${offerKeys.join(', ')}]`);
  for (const k of purchasable) {
    if (!vocabulary.has(k)) violations.push(`${k}: not an entitlement key the store knows — not for sale`);
    if ((GOOGLE_CATEGORY_KEYS as readonly string[]).includes(k)) violations.push(`${k}: a Google category key is not for sale — no route gates on it`);
  }
  // the free set holds no gated tool
  for (const t of registry) {
    if (t.status === 'LIVE' && gate[t.name] === null && offers.some((o) => o.tools.includes(t.name))) violations.push(`${t.name}: free (LIVE, no gate) and also sold`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new OfferLawError(violations.join('\n  '));
  return violations;
}

offerLaw();
