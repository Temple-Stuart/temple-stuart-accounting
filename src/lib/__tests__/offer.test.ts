import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_TOOLS, OFFERS, OfferLawError, SELLABLE_KEYS, TOOL_GATE, claimForCockpit, claimLine, freeSetLine, heroCountsLine, keysGranting, moduleDoorPlan,
  numberWord, offerAvailabilityFromEnv, offerCard, offerFor, offerFromModuleParam, offerGranting, offerLaw, priceEnvName, priceLineFor, type Offer,
} from '../offer';
import { TOOL_REGISTRY, type ToolEntry } from '../toolRegistry';
import { GOOGLE_CATEGORY_KEYS, TAB_ENTITLEMENT_KEYS } from '../categoryKeys';
import { isTabLocked } from '../categoryLock';
import { startEntitlementCheckout } from '../checkoutDoor';

// SELL-02 — the offer: every sales claim from the registry, every price from one source, the law that keeps it so.

const tool = (name: string): ToolEntry => {
  const t = TOOL_REGISTRY.find((x) => x.name === name);
  if (!t) throw new Error(`no registry tool ${name}`);
  return t;
};
const books = (): Offer => offerFor('tab:books') as Offer;

test('the law passes on the real offer; the purchasable keys are exactly the offers\' (stripe.ts reads them); tab:operations is no key at all and the nine category keys are out', () => {
  assert.deepEqual(offerLaw({ throwOnFail: false }), []);
  assert.deepEqual([...SELLABLE_KEYS], ['tab:books', 'bundle:all']);
  assert.ok(!(TAB_ENTITLEMENT_KEYS as readonly string[]).includes('tab:operations'), 'SELL-05: gone from the vocabulary');
  for (const k of GOOGLE_CATEGORY_KEYS) assert.ok(!SELLABLE_KEYS.includes(k), k);
  // the purchasable set handed in must equal the offers; a key outside the vocabulary is named
  assert.match(offerLaw({ throwOnFail: false, purchasable: ['tab:books', 'bundle:all', 'tab:operations'] }).join('\n'), /tab:operations: not an entitlement key the store knows/);
  assert.match(offerLaw({ throwOnFail: false, purchasable: ['tab:books', 'bundle:all', 'brunch_coffee'] }).join('\n'), /brunch_coffee: a Google category key is not for sale/);
  assert.match(offerLaw({ throwOnFail: false, purchasable: ['tab:books'] }).join('\n'), /purchasable keys \[tab:books\] ≠ the offers/);
});

test('a NOT_BUILT tool in an offer fails the law (the build); so does a free tool, a tool the offer does not unlock, a bundle missing a grant, and a gated tool sold nowhere', () => {
  const b = books();
  const notBuilt = [{ ...b, tools: [...b.tools, 'Payroll' as const] }, OFFERS[1]];
  assert.match(offerLaw({ throwOnFail: false, offers: notBuilt }).join('\n'), /Payroll is NOT_BUILT — a tool that does not exist cannot be sold/);
  assert.throws(() => offerLaw({ offers: notBuilt }), OfferLawError);
  // TRUTH-01: Travel is the one LIVE tool with no gate — the free tool a seller may not list.
  const free = [{ ...b, tools: [...b.tools, 'Travel' as const] }, OFFERS[1]];
  const v = offerLaw({ throwOnFail: false, offers: free }).join('\n');
  assert.match(v, /Travel carries no tab gate/);
  assert.match(v, /Travel: free \(LIVE, no gate\) and also sold/);
  // a four-beat PARTIAL with no gate (Calendar since TRUTH-01) is not free and not sold: the gate line fires, the free line does not
  const partialUngated = offerLaw({ throwOnFail: false, offers: [{ ...b, tools: [...b.tools, 'Calendar' as const] }, OFFERS[1]] }).join('\n');
  assert.match(partialUngated, /Calendar carries no tab gate/);
  assert.doesNotMatch(partialUngated, /Calendar: free/);
  const narrow = [{ ...b, grants: ['tab:books' as const] }, OFFERS[1]];
  assert.match(offerLaw({ throwOnFail: false, offers: narrow }).join('\n'), /Brokerage is gated by tab:trade, which this offer does not grant/);
  const smallBundle = [b, { ...OFFERS[1], grants: ['tab:books' as const] }];
  assert.match(offerLaw({ throwOnFail: false, offers: smallBundle }).join('\n'), /bundle:all does not grant tab:trade/);
  const nobodySellsTax = [{ ...b, tools: b.tools.filter((t) => t !== 'Tax'), grants: ['tab:books', 'tab:trade', 'tab:compliance'] as const }, { ...OFFERS[1], grants: ['tab:books', 'tab:trade', 'tab:compliance', 'tab:travel'] as const }];
  const v2 = offerLaw({ throwOnFail: false, offers: nobodySellsTax }).join('\n');
  assert.match(v2, /Tax: gated by tab:tax, which no offer grants — sold nowhere/);
  // a key outside the store's vocabulary, a price that is not a positive number
  assert.match(offerLaw({ throwOnFail: false, offers: [{ ...b, key: 'tab:magic' as never }, OFFERS[1]] }).join('\n'), /tab:magic: not an entitlement key/);
  assert.match(offerLaw({ throwOnFail: false, offers: [{ ...b, monthlyPrice: 0 }, OFFERS[1]] }).join('\n'), /monthlyPrice must be a positive number or null/);
});

test('claim lines come from the registry: "built and running" for LIVE only, "partial — <beats>" for PARTIAL, a throw for NOT_BUILT; a PARTIAL card never says built and running', () => {
  assert.equal(claimLine(tool('Bookkeeping')), 'built and running');
  assert.equal(claimLine(tool('Tax')), 'partial — discover · decide');
  assert.equal(claimLine(tool('Compliance')), 'partial — discover · decide · record');
  assert.equal(claimLine(tool('Brokerage')), 'partial — discover · decide');
  assert.equal(claimLine(tool('Trade Log')), 'partial — discover · commit · record');
  assert.equal(claimLine(tool('Banking')), 'partial — discover');
  assert.throws(() => claimLine(tool('Payroll')), /Payroll is NOT_BUILT — it cannot be sold/);
  // TRUTH-01b: a four-beat PARTIAL says why — the registry's note verbatim, never the four beats
  for (const name of ['Calendar', 'Tasks', 'Time', 'Budget'] as const) {
    const t = tool(name);
    assert.equal(t.status, 'PARTIAL');
    assert.equal(claimLine(t), `partial — ${t.why}`);
    assert.ok(!claimLine(t).includes('discover'), `${name}: the why, not the beats`);
  }
  assert.equal(claimLine(tool('Calendar')), 'partial — a read-only grid over three feeds it does not own, beside a routine builder whose occurrences are the only thing on it this tool writes');
  // a four-beat PARTIAL with no why is thrown, not rendered as the beats form
  assert.throws(() => claimLine({ ...tool('Calendar'), why: undefined }), /Calendar is PARTIAL with four beats and no why/);
  assert.throws(() => claimLine({ ...tool('Calendar'), why: '  ' }), /Calendar is PARTIAL with four beats and no why/);
  // fewer than four beats keeps the beats form even when a why is present
  assert.equal(claimLine({ ...tool('Tax'), why: 'not used' }), 'partial — discover · decide');
  const card = offerCard(books(), {});
  assert.deepEqual(card.tools.map((t) => t.name), ['Banking', 'Brokerage', 'Trade Log', 'Bookkeeping', 'Tax', 'Compliance'], 'sheet order; Trade, Tax and Compliance ride inside Books');
  for (const t of card.tools) {
    if (t.status === 'PARTIAL') { assert.match(t.claim, /^partial — /); assert.ok(!t.claim.includes('built and running')); }
    if (t.status === 'LIVE') assert.equal(t.claim, 'built and running');
  }
  assert.equal(card.includesAnswers, true);
  // the free showcases' CTAs read the registry through the cockpit key
  // TRUTH-01: Tasks and Time are four-beat PARTIALs (the job is not done for a customer), so the showcase CTAs no longer say built and running.
  assert.equal(claimForCockpit('projects'), "partial — the founder's build pipeline — accepting a task fires a paid Claude Code build; not a customer's task tool");
  assert.equal(claimForCockpit('content'), 'partial — day blocks and a daily log inside the Narrative pipeline; no time tool');
  assert.equal(claimForCockpit('calendar'), 'partial — actuals by entity plus recurring lines on module_expenses; no plan vs actual; no personal · trade · travel roll-up'); // Budget, a four-beat PARTIAL since TRUTH-01
  assert.throws(() => claimForCockpit('nope'), OfferLawError);
});

test('the price: a number renders only when the const has it AND the Stripe price id env is set; otherwise the declared line and no buy button', () => {
  const b = books();
  assert.deepEqual(priceLineFor({ monthlyPrice: null }, false), { kind: 'unset', text: 'Not for sale yet — no price is set.', missing: ['price', 'stripe'] });
  assert.deepEqual(priceLineFor({ monthlyPrice: null }, true), { kind: 'unset', text: 'Not for sale yet — no price is set.', missing: ['price'] });
  assert.deepEqual(priceLineFor({ monthlyPrice: 20 }, false), { kind: 'unset', text: 'Not for sale yet — no price is set.', missing: ['stripe'] });
  assert.deepEqual(priceLineFor({ monthlyPrice: 20 }, true), { kind: 'live', monthlyPrice: 20, text: '$20/mo' });
  assert.equal(offerCard(b, {}).buyable, false, 'no price const → no button');
  assert.equal(offerCard(b, { 'tab:books': true }).buyable, false, 'env set but no price const → no button');
  assert.equal(offerCard({ ...b, monthlyPrice: 20 }, {}).buyable, false, 'price const but no env → no button');
  const live = offerCard({ ...b, monthlyPrice: 20 }, { 'tab:books': true });
  assert.equal(live.buyable, true);
  assert.equal(live.price.text, '$20/mo');
  // the env-presence map, the naming rule
  assert.deepEqual(offerAvailabilityFromEnv({ STRIPE_TAB_BOOKS_PRICE_ID: 'price_x' }), { 'tab:books': true, 'bundle:all': false });
  assert.deepEqual(offerAvailabilityFromEnv({ STRIPE_TAB_BOOKS_PRICE_ID: '' }), { 'tab:books': false, 'bundle:all': false });
  assert.equal(priceEnvName('tab:books'), 'STRIPE_TAB_BOOKS_PRICE_ID');
  assert.equal(priceEnvName('bundle:all'), 'STRIPE_BUNDLE_ALL_PRICE_ID');
  assert.equal(priceEnvName('brunch_coffee'), 'STRIPE_CAT_BRUNCH_COFFEE_PRICE_ID');
});

test('the grants: Books unlocks Trade, Tax and Compliance at both gates; the bundle unlocks every tab; a Google category unlocks nothing', () => {
  assert.deepEqual(keysGranting('tab:trade'), ['tab:trade', 'tab:books', 'bundle:all']);
  assert.deepEqual(keysGranting('tab:tax'), ['tab:tax', 'tab:books', 'bundle:all']);
  assert.deepEqual(keysGranting('tab:compliance'), ['tab:compliance', 'tab:books', 'bundle:all']);
  assert.deepEqual(keysGranting('tab:books'), ['tab:books', 'bundle:all']);
  assert.deepEqual(keysGranting('tab:travel'), ['tab:travel', 'bundle:all']);
  assert.equal(offerGranting('tab:trade')?.key, 'tab:books', 'the locked Trade tab sells Books');
  assert.equal(offerGranting('tab:travel')?.key, 'bundle:all');
  // the client twin
  assert.equal(isTabLocked('tab:trade', ['tab:books'], false), false, 'a Books holder is not locked out of Trade');
  assert.equal(isTabLocked('tab:trade', ['brunch_coffee'], false), true);
  assert.equal(isTabLocked('tab:books', [], false), true);
  assert.equal(isTabLocked('tab:tax', ['bundle:all'], false), false);
  assert.equal(isTabLocked('tab:books', [], true), false, "SELL-05b: the admin bypass is the server's isAdmin verdict");
});

test('the free set is the registry\'s LIVE tools with no gate; the gate map covers every tool', () => {
  // TRUTH-01 (census 2026-09-09): Calendar, Tasks, Time and Budget are PARTIAL — four beats cited, the job not done for a customer — so the free set is Travel alone.
  assert.deepEqual(FREE_TOOLS.map((t) => t.name), ['Travel']);
  // TRUTH-01b: the landing's free line — singular for the one free tool, plural otherwise, the rest of the sentence unchanged
  assert.equal(freeSetLine(), "Free with an account, no module to buy: Travel — the registry's live tool with no tab gate.");
  assert.equal(freeSetLine([{ name: 'Travel' }, { name: 'Budget' }]), "Free with an account, no module to buy: Travel, Budget — the registry's live tools with no tab gate.");
  assert.equal(Object.keys(TOOL_GATE).length, TOOL_REGISTRY.length);
  for (const t of TOOL_REGISTRY) assert.ok(t.name in TOOL_GATE, t.name);
  assert.equal(TOOL_GATE.CRM, 'owner');
});

test('the hero line is the registry\'s counts in words — never typed', () => {
  assert.equal(heroCountsLine(), 'Twenty-five tools, counted: two live, nine partial, fourteen on the blueprint.');
  assert.equal(heroCountsLine(TOOL_REGISTRY.filter((t) => t.status !== 'NOT_BUILT')), 'Eleven tools, counted: two live, nine partial, zero on the blueprint.');
  assert.equal(numberWord(25), 'twenty-five');
  assert.throws(() => numberWord(26), OfferLawError);
});

test('the `?module=` door: books or tab:books → the register modal for a guest, checkout for a signed-in viewer, wait while auth resolves, nothing for an unknown word', () => {
  assert.equal(offerFromModuleParam('books')?.key, 'tab:books');
  assert.equal(offerFromModuleParam('tab:books')?.key, 'tab:books');
  assert.equal(offerFromModuleParam('all')?.key, 'bundle:all');
  assert.equal(offerFromModuleParam('tab:operations'), undefined);
  assert.deepEqual(moduleDoorPlan('?module=books', false), { kind: 'register', key: 'tab:books' });
  assert.deepEqual(moduleDoorPlan('?module=books&checkout=cancelled', true), { kind: 'checkout', key: 'tab:books' });
  assert.deepEqual(moduleDoorPlan('module=tab:books', null), { kind: 'wait', key: 'tab:books' });
  assert.deepEqual(moduleDoorPlan('?module=brunch_coffee', true), { kind: 'none' });
  assert.deepEqual(moduleDoorPlan('', true), { kind: 'none' });
});

test('after sign-up the resume makes ONE checkout call for the pending key and hands back Stripe\'s URL; the route\'s refusal comes out as the thrown message', async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const ok: typeof fetch = async (url, init) => { calls.push({ url: String(url), body: String(init?.body) }); return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/cs_1' }), { status: 200 }); };
  assert.equal(await startEntitlementCheckout('tab:books', ok), 'https://checkout.stripe.test/cs_1');
  assert.deepEqual(calls, [{ url: '/api/stripe/checkout-entitlement', body: JSON.stringify({ key: 'tab:books' }) }]);
  const refused: typeof fetch = async () => new Response(JSON.stringify({ error: 'This item is not purchasable yet (price not configured)' }), { status: 400 });
  await assert.rejects(startEntitlementCheckout('tab:books', refused), /not purchasable yet \(price not configured\)/);
  const noBody: typeof fetch = async () => new Response('', { status: 500 });
  await assert.rejects(startEntitlementCheckout('tab:books', noBody), /Could not start checkout \(HTTP 500\)/);
});
