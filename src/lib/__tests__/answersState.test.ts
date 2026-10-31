import test from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_ROWS } from '../answers';
import { OFFERS, priceEnvName, priceLineFor } from '../offer';
import { SETUP_DOOR } from '../entities/kinds';
import {
  ANSWERS_OFFER,
  ANSWERS_TAB,
  BOOKS_DOOR,
  CARD_NEEDS,
  LINK_BANK_LINE,
  OFFER_PAGE,
  OFFER_VERB,
  SETUP_ENTITY_LINE,
  answersLocked,
  answersStateLaw,
  cardState,
  type CardState,
  type ViewerFacts,
} from '../answersState';

// SELL-04 — the four cards' states before any route is read. Hermetic: the facts are injected.

const QUESTIONS = ANSWER_ROWS.map(([q]) => q);
const NONE: Readonly<Record<string, boolean>> = Object.fromEntries(OFFERS.map((o) => [o.key, false]));
const ALL: Readonly<Record<string, boolean>> = Object.fromEntries(OFFERS.map((o) => [o.key, true]));
const free: ViewerFacts = { isAdmin: false, entitledKeys: [], accountsLinked: null, soleProp: null };
const paid = (over: Partial<ViewerFacts>): ViewerFacts => ({ isAdmin: false, entitledKeys: [ANSWERS_TAB], accountsLinked: 2, soleProp: true, ...over });
const states = (facts: ViewerFacts, availability = NONE): CardState[] => QUESTIONS.map((q) => cardState(q, facts, availability));

test('the law: CARD_NEEDS covers the four questions in order; the Answers ride with an offer whose key the gate resolves', () => {
  assert.deepEqual(answersStateLaw({ throwOnFail: false }), []);
  assert.deepEqual(Object.keys(CARD_NEEDS), QUESTIONS);
  assert.equal(ANSWERS_OFFER.includesAnswers, true);
  assert.equal(ANSWERS_OFFER.key, ANSWERS_TAB);
  assert.equal(ANSWERS_OFFER.label, 'Books');
  assert.equal(BOOKS_DOOR, '/books');
  assert.match(answersStateLaw({ throwOnFail: false, needs: { [QUESTIONS[0]]: CARD_NEEDS[QUESTIONS[0]] } })[0], /4\/4 in order/);
  assert.throws(() => answersStateLaw({ needs: {} }), /THE ANSWERS STATE LAW failed/);
});

test('a free account → four OFFER-line cards from offer.ts, no HTTP text, the offer page as the door while no price is live', () => {
  assert.equal(answersLocked(free), true);
  const s = states(free);
  assert.equal(s.length, 4);
  for (const st of s) {
    assert.equal(st.kind, 'offer');
    if (st.kind !== 'offer') continue;
    assert.equal(st.card.key, ANSWERS_OFFER.key);
    const price = priceLineFor(ANSWERS_OFFER, false);
    assert.equal(st.line, `Books — ${price.text} — ${OFFER_VERB}.`);
    assert.ok(st.line.includes('link a bank and this computes'));
    assert.doesNotMatch(st.line, /HTTP|403|Tab not unlocked/);
    assert.equal(st.card.buyable, false, 'no price is set today — nothing is for sale, so no checkout door');
    assert.deepEqual(st.door, { kind: 'link', href: OFFER_PAGE });
  }
  // the bundle unlocks the Answers too — the gate's own keysGranting
  assert.equal(answersLocked({ isAdmin: false, entitledKeys: ['bundle:all'] }), false);
  assert.equal(answersLocked({ isAdmin: false, entitledKeys: ['tab:tax'] }), true, 'a tab that does not carry the Answers does not unlock them');
  assert.equal(answersLocked({ isAdmin: true, entitledKeys: [] }), false, "the admin bypass is the server's verdict, never an id compared here");
});

test('with a live price the offer line carries the number and the door is the one checkout call', () => {
  const live = { ...ANSWERS_OFFER, monthlyPrice: 29 };
  const price = priceLineFor(live, true);
  assert.equal(price.kind, 'live');
  assert.equal(price.text, '$29/mo');
  assert.equal(priceEnvName(ANSWERS_OFFER.key), 'STRIPE_TAB_BOOKS_PRICE_ID');
  // cardState reads OFFERS' own price (null today) — prove the door rule on the card model directly
  const st = cardState(QUESTIONS[0], free, ALL);
  assert.equal(st.kind, 'offer');
  if (st.kind === 'offer') {
    assert.equal(st.card.price.kind, 'unset', 'the const holds no price yet — Stripe alone does not make it live');
    assert.equal(st.door.kind, 'link');
  }
});

test('paid, no bank → "link a bank" on all four, the door to Books; the routes are not read', () => {
  const s = states(paid({ accountsLinked: 0, soleProp: false }));
  for (const st of s) assert.deepEqual(st, { kind: 'line', why: 'bank', line: LINK_BANK_LINE, door: BOOKS_DOOR });
});

test('paid, a bank, no sole-prop → "set up your business entity" on the two cards that read one; the others read', () => {
  const s = states(paid({ soleProp: false }));
  const byQ = Object.fromEntries(QUESTIONS.map((q, i) => [q, s[i]]));
  assert.deepEqual(byQ['What do I owe in tax?'], { kind: 'line', why: 'entity', line: SETUP_ENTITY_LINE, door: SETUP_DOOR });
  assert.deepEqual(byQ['How is my business doing?'], { kind: 'line', why: 'entity', line: SETUP_ENTITY_LINE, door: SETUP_DOOR });
  assert.deepEqual(byQ['How long can I last?'], { kind: 'read' });
  assert.deepEqual(byQ['How is my trading doing?'], { kind: 'read' });
  assert.equal(SETUP_DOOR, '/chart-of-accounts');
});

test('paid, a bank, a sole-prop → every card reads its route; an unread fact is never guessed', () => {
  assert.deepEqual(states(paid({})), [{ kind: 'read' }, { kind: 'read' }, { kind: 'read' }, { kind: 'read' }]);
  assert.throws(() => cardState(QUESTIONS[0], paid({ accountsLinked: null }), NONE), /not read yet/);
  assert.throws(() => cardState(QUESTIONS[0], paid({ soleProp: null }), NONE), /not read yet/);
  assert.deepEqual(cardState('How long can I last?', paid({ soleProp: null }), NONE), { kind: 'read' }, 'a card that needs no sole-prop does not wait for that fact');
  assert.throws(() => cardState('Is this a question?', paid({}), NONE), /has no needs row/);
});
