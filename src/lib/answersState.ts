/**
 * SELL-04 — FIRST VALUE FOR A NEW ACCOUNT: what each Answers card shows
 * BEFORE its route is read, decided from the viewer's facts — pure, so the
 * ruled cases run in node:test:
 *
 *   free account (no key granting the Answers)  → the OFFER line from offer.ts
 *     — "<label> — <price line> — link a bank and this computes." — with the
 *     buy door (checkout when the price is live; the offer page otherwise);
 *     NEVER an HTTP line, and the gated routes are never read;
 *   paid, no bank linked                        → "Link a bank and this computes." + the door to Books;
 *   paid, a bank, no sole-prop entity           → on the cards whose route reads a
 *     sole-prop (Tax: Schedule C, Business: the statements on the sole-prop) —
 *     "Set up your business entity and this computes." + the door to the setup step;
 *   otherwise                                   → read the route (the existing figure).
 *
 * THE LAW (module scope, re-run by the test): CARD_NEEDS keys === ANSWER_ROWS
 * questions 4/4; the Answers' offer exists (the first offer that carries them,
 * offer.ts includesAnswers) and its key is a tab key the gate resolves — the
 * SAME isTabLocked the cockpit uses, so the card and the tab never disagree.
 * Client- and server-safe: leaves only (answers.ts, offer.ts, categoryLock.ts, the registry).
 */
import { ANSWER_ROWS } from './answers';
import { isTabLocked } from './categoryLock';
import { TAB_ENTITLEMENT_KEYS } from './categoryKeys';
import { OFFERS, offerCard, type Offer, type OfferCardModel, type TabKey } from './offer';
import { TOOL_REGISTRY } from './toolRegistry';
import { SETUP_DOOR } from './entities/kinds';

export interface CardNeeds {
  /** Every card computes from linked accounts (ledger rows come from committed bank transactions; positions from investment accounts). */
  bank: true;
  /** The route reads the user's sole-prop entity (Tax: Schedule C; Business: the statements on it). */
  soleProp: boolean;
}

export const CARD_NEEDS: Readonly<Record<string, CardNeeds>> = {
  'What do I owe in tax?': { bank: true, soleProp: true },
  'How long can I last?': { bank: true, soleProp: false },
  'How is my trading doing?': { bank: true, soleProp: false },
  'How is my business doing?': { bank: true, soleProp: true },
};

/** The offer the four Answers ride with (offer.ts: includesAnswers) — Books. */
export const ANSWERS_OFFER: Offer = (() => {
  const o = OFFERS.find((x) => x.includesAnswers);
  if (!o) throw new Error('THE ANSWERS: no offer includes the four Answers (offer.ts includesAnswers)');
  return o;
})();

/** The tab key the Answers are gated by — the offer's own key; isTabLocked resolves every key that grants it (the bundle too). */
export const ANSWERS_TAB: TabKey = ANSWERS_OFFER.key as TabKey;

export const OFFER_VERB = 'link a bank and this computes';
export const LINK_BANK_LINE = 'Link a bank and this computes.';
export const SETUP_ENTITY_LINE = 'Set up your business entity and this computes.';
export const OFFER_PAGE = '/pricing';

/** The door to Books — the registry's Bookkeeping home, never typed. */
export const BOOKS_DOOR: string = (() => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'Bookkeeping');
  if (!t || !t.home) throw new Error('THE ANSWERS: the registry has no home for Bookkeeping');
  return t.home;
})();

export type CardState =
  | { kind: 'offer'; line: string; card: OfferCardModel; door: { kind: 'checkout'; key: Offer['key'] } | { kind: 'link'; href: string } }
  | { kind: 'line'; why: 'bank' | 'entity'; line: string; door: string }
  | { kind: 'read' };

export interface ViewerFacts {
  /** The server's verdict on the admin bypass (/api/auth/me isAdmin) — SELL-05b: never an id compared here. */
  isAdmin: boolean;
  /** The viewer's active entitlement keys (/api/auth/me entitledCategories — every active row's key). */
  entitledKeys: readonly string[];
  /** Linked accounts on live Plaid items (/api/accounts); null until read. */
  accountsLinked: number | null;
  /** Whether a sole-prop entity exists (/api/entities); null until read. */
  soleProp: boolean | null;
}

/** "<label> — <price line> — link a bank and this computes." — the label and the price line are offer.ts's own words. */
export function offerLine(card: OfferCardModel): string {
  return `${card.label} — ${card.price.text} — ${OFFER_VERB}.`;
}

export function answersLocked(facts: Pick<ViewerFacts, 'isAdmin' | 'entitledKeys'>): boolean {
  return isTabLocked(ANSWERS_TAB, [...facts.entitledKeys], facts.isAdmin);
}

/**
 * The card's state. A locked viewer needs no other fact (the routes are not
 * read). An unlocked viewer's bank / entity facts must be READ before a card
 * decides — a null fact throws (the caller waits; nothing is assumed).
 */
export function cardState(question: string, facts: ViewerFacts, offerAvailability: Readonly<Record<string, boolean>>): CardState {
  const needs = CARD_NEEDS[question];
  if (!needs) throw new Error(`THE ANSWERS: "${question}" has no needs row (answersState.ts CARD_NEEDS)`);
  if (answersLocked(facts)) {
    const card = offerCard(ANSWERS_OFFER, offerAvailability);
    return {
      kind: 'offer',
      line: offerLine(card),
      card,
      door: card.buyable ? { kind: 'checkout', key: ANSWERS_OFFER.key } : { kind: 'link', href: OFFER_PAGE },
    };
  }
  if (facts.accountsLinked === null) throw new Error('THE ANSWERS: accountsLinked is not read yet — a card decides on facts, never on a guess');
  if (facts.accountsLinked === 0) return { kind: 'line', why: 'bank', line: LINK_BANK_LINE, door: BOOKS_DOOR };
  if (needs.soleProp) {
    if (facts.soleProp === null) throw new Error('THE ANSWERS: the entities are not read yet — a card decides on facts, never on a guess');
    if (!facts.soleProp) return { kind: 'line', why: 'entity', line: SETUP_ENTITY_LINE, door: SETUP_DOOR };
  }
  return { kind: 'read' };
}

/** THE LAW. Throws on the first violation; returns the violations when asked not to throw. */
export function answersStateLaw(opts: { throwOnFail?: boolean; needs?: Readonly<Record<string, CardNeeds>>; rows?: typeof ANSWER_ROWS } = {}): string[] {
  const needs = opts.needs ?? CARD_NEEDS;
  const rows = opts.rows ?? ANSWER_ROWS;
  const violations: string[] = [];
  const questions = rows.map(([q]) => q);
  const keys = Object.keys(needs);
  if (keys.length !== questions.length || keys.some((k, i) => k !== questions[i])) {
    violations.push(`CARD_NEEDS keys must equal ANSWER_ROWS questions 4/4 in order — got [${keys.join(' | ')}]`);
  }
  if (!(TAB_ENTITLEMENT_KEYS as readonly string[]).includes(ANSWERS_TAB)) violations.push(`the Answers' offer key ${ANSWERS_TAB} is not a tab key the gate resolves`);
  if (!ANSWERS_OFFER.includesAnswers) violations.push(`${ANSWERS_OFFER.key} does not carry the four Answers`);
  if (violations.length && opts.throwOnFail !== false) throw new Error(`THE ANSWERS STATE LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

answersStateLaw();
