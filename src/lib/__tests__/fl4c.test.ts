/**
 * FL-4c (2026-09-23) — the flights checkout uses the vendor's DOCUMENTED payment rail.
 *
 * LiteAPI documents one way to take a card (docs.liteapi.travel/docs/user-payment):
 * load their wrapper, hand it { publicKey, appearance, targetElement, secretKey,
 * returnUrl } and call handlePayment(). `publicKey` is the ENVIRONMENT — their
 * words, "the environment you are using, and must match your API key's environment"
 * — the literal 'live' or 'sandbox', which the wrapper resolves to a real Stripe
 * publishable key itself. And the flights reference documents the prebook's
 * publishableKey as `string, nullable: true`, "null if not applicable": the null
 * this panel used to throw on was the documented shape, not a failure.
 *
 * Neither the panel nor the confirm page can be executed here (they need Stripe,
 * the vendor's wrapper and a browser), so their contract is read from source the
 * way this repo proves a surface it cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
const CONFIRM = 'src/app/booking/flight-confirm/page.tsx';
const HOTEL = 'src/components/trips/CheckoutPanel.tsx';
const ROUTE = 'src/app/api/travel/liteapi/flights/prebook/route.ts';
const MIDDLEWARE = 'src/middleware.ts';

test('a prebook whose publishableKey is null still reaches a card form', () => {
  const src = code(PANEL);
  // THE WHOLE PR: the field is not read at all, so a null cannot dead-end anything.
  assert.ok(!src.includes('publishableKey'), 'the panel reads no publishable key');
  // What it DOES gate the card form on: a secretKey and a nameable environment.
  assert.match(src, /typeof data\?\.secretKey !== 'string' \|\| !data\.secretKey/, 'the secretKey gate is unchanged');
  assert.match(src, /env !== 'live' && env !== 'sandbox'/, 'and the environment must be one the vendor documents');
  // Nothing else stands between the prebook and the pay phase.
  // Scoped to the handler's OWN last statement before the pay phase, never a
  // character count: the two fail() branches each end in setPhase('pay') too.
  const handler = src.slice(src.indexOf('const submitPrebook'), src.indexOf('      setPrebook(data as PrebookEnvelope);'));
  assert.equal((handler.match(/fail\(\{/g) ?? []).length, 2, 'exactly two stated dead ends before payment');
  assert.ok(!/throw new Error\('Payment cannot start/.test(handler), 'the key throw is gone');
  // And the card form is rendered whenever the pay phase holds a prebook and no
  // failure — never conditioned on a key.
  assert.match(src, /\{phase === 'pay' && prebook && !failure && \(/, 'the card form is gated on the prebook and a clean run, nothing else');
  assert.match(src, /id=\{PAYMENT_TARGET_ID\}/, 'and the vendor is given a target to draw into');
});

test("publicKey is the ENVIRONMENT LABEL from the server — never a Stripe key, never a guess", () => {
  const src = code(PANEL);
  assert.match(src, /publicKey: paymentEnv,/, 'the label is what the wrapper is handed');
  assert.match(src, /data\?\.paymentEnv === 'string'/, 'read from the prebook response');
  assert.match(code(ROUTE), /paymentEnv: liteApiPaymentEnv\(\)/, 'which the SERVER derives');
  // It is never invented, defaulted or coerced.
  assert.ok(!/paymentEnv = '(live|sandbox)'/.test(src), 'the panel hardcodes no env');
  assert.ok(!/setPaymentEnv\('(live|sandbox)'\)/.test(src), 'and coerces an unknown label to neither');
  assert.match(src, /did not say which payment environment it is on/, 'an unnameable environment is stated, not defaulted');
  for (const banned of ['pk_live_', 'pk_test_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'process.env', '/config']) {
    assert.ok(!src.includes(banned), `the panel contains no ${banned}`);
  }
});

test('the wrapper is the rail — the hand-rolled Stripe mount is gone', () => {
  const src = code(PANEL);
  assert.match(src, /payment-wrapper\.liteapi\.travel\/dist\/liteAPIPayment\.js/, 'the vendor wrapper is loaded');
  assert.match(src, /new window\.LiteAPIPayment\(\{/, 'and constructed');
  assert.match(src, /payment\.handlePayment\(\);/, 'and asked for the card form');
  assert.match(src, /secretKey: prebook\.secretKey/, 'with the prebook secret it was given');
  for (const banned of ['@stripe/react-stripe-js', '@stripe/stripe-js', 'loadStripe', '<Elements', '<PaymentElement', 'useStripe(', 'useElements(', 'confirmPayment(']) {
    assert.ok(!src.includes(banned), `no hand-rolled Stripe left: ${banned}`);
  }
  // Its own target, not the hotel panel's — both live on /travel and the vendor
  // mounts by querySelector, which takes the first match.
  assert.match(src, /const PAYMENT_TARGET_ID = 'liteapi-flight-payment-target';/);
  assert.notEqual(
    /const PAYMENT_TARGET_ID = '([^']+)';/.exec(src)?.[1],
    /const PAYMENT_TARGET_ID = '([^']+)';/.exec(code(HOTEL))?.[1],
    'the two panels do not share a target id',
  );
});

test('the wrapper failing is a NAMED failure — no card asked for, and no hang', () => {
  const src = code(PANEL);
  for (const kind of ['payment_env', 'prebook', 'sdk_script', 'form_absent']) {
    assert.ok(src.includes(`'${kind}'`), `${kind} is named`);
  }
  // CHECKOUT-01's first-reason-wins, so a late CDN error cannot bury a specific one.
  assert.match(src, /setFailureState\(\(cur\) => cur \?\? next\)/);
  assert.ok(!/const \[error, setError\]/.test(src), 'no loose error string');
  // The vendor cannot report its own failure — its SDK swallows every error in two
  // empty catches — so the DOM is watched and a deadline states what did not come.
  assert.match(src, /const FORM_DEADLINE_MS = 12000;/);
  assert.match(src, /new MutationObserver/);
  // A panel that cannot take a card does not ask for one, and does not leave the
  // form up either.
  const ask = src.indexOf('Enter your card to pay');
  assert.ok(ask > 0, 'it does ask, when it can');
  assert.match(src.slice(ask - 400, ask), /&& !failure && \(/);
  assert.match(src, /\{\(phase === 'form' \|\| phase === 'prebooking'\) && !failure \?/, 'and the form is not left up beside a stated failure');
  assert.match(src, /data-flight-checkout-failure=\{failure\.kind\}/, 'the branch is nameable from the DOM');
  // No fallback of any kind: no retry, no poll, no second rail.
  for (const banned of ['setInterval', 'retry(', 'setTimeout(() => setStripeJsReady']) {
    assert.ok(!src.includes(banned), `no ${banned}`);
  }
  // Every detail line is fixed first-party text — never the vendor's body.
  for (const m of src.matchAll(/detail: ([^\n]+)/g)) {
    assert.match(m[1].trim(), /^['"`]/, `a detail is built from ${m[1].slice(0, 50)}`);
  }
});

test("CHECKOUT-03's Stripe.js path still holds — a settled tag cannot hang the loader", () => {
  const src = code(PANEL);
  assert.match(src, /const STRIPE_JS_SRC = 'https:\/\/js\.stripe\.com\/v3';/, 'we load Stripe.js ourselves');
  assert.match(src, /!sdkReady \|\| !stripeJsReady/, 'and wait on it before handing off');
  // Seeded from the global itself, once: next/script will not fire onLoad again for
  // a src the hotel panel already loaded, and the global is the truth either way.
  assert.match(
    src,
    /useState\(\s*\(\) => typeof window !== 'undefined' && typeof \(window as \{ Stripe\?: unknown \}\)\.Stripe === 'function',\s*\)/,
    'stripeJsReady is seeded from window.Stripe, not polled',
  );
  // The failure to load is NAMED, on this <Script>'s own element — scoped to its
  // closing tag, never a character count.
  const at = src.indexOf('STRIPE_JS_SRC}');
  const block = src.slice(at, src.indexOf('/>', at));
  assert.match(block, /onError=\{\(\) => fail\(/, 'a Stripe.js that cannot load says so');
  // And when the deadline passes, WHICH silence it was: two branches, two fixed
  // lines, never one line built from a condition.
  assert.match(src, /if \(typeof \(window as \{ Stripe\?: unknown \}\)\.Stripe !== 'function'\) \{/);
  assert.match(src, /library is not available in this browser/);
  assert.match(src, /returned no card form, and it reports no reason/);
});

test('the rail redirects, so the redirect lands where the booking is finished', () => {
  const src = code(PANEL);
  assert.match(src, /\/booking\/flight-confirm\?\$\{q\.toString\(\)\}/, 'the flights page, not the hotel one');
  const confirm = code(CONFIRM);
  assert.match(confirm, /'\/api\/travel\/liteapi\/flights\/book'/, 'which completes through the existing route');
  // SEC-03 (2026-09-25): the two references and the trip — the address the link
  // carried under FL-5b is stored at prebook and read by the route.
  assert.match(confirm, /body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/);
  // The paid-but-not-booked state never pretends: both references, and a retry of
  // the BOOK step only — idempotent per prebookId, so it can never re-pay.
  assert.match(confirm, /Your payment went through, but the booking did not complete\./);
  assert.match(confirm, /Retry booking/);
  assert.ok(!confirm.includes('prebook'.concat('/route')), 'it re-prebooks nothing');
  // And a guest who has already paid is not bounced off it.
  assert.match(code(MIDDLEWARE), /'\/booking\/flight-confirm',/);
  // The panel no longer books: that is the rail's consequence, stated.
  assert.ok(!src.includes("'/api/travel/liteapi/flights/book'"), 'the panel makes no book call');
});

test("CHECKOUT-01's hotel law is untouched — this ruling changed the flights lane only", () => {
  const hotel = code(HOTEL);
  // The four hotel failure kinds, its watchdog and its card gate all still read as
  // CHECKOUT-01 left them. FL-4c did not go near this file.
  for (const kind of ['missing_key', 'prebook', 'sdk_script', 'form_absent']) {
    assert.ok(hotel.includes(`'${kind}'`), `the hotel panel still names ${kind}`);
  }
  assert.match(hotel, /setFailureState\(\(cur\) => cur \?\? next\)/);
  assert.match(hotel, /data-checkout-failure=\{failure\.kind\}/);
  assert.match(hotel, /const PAYMENT_TARGET_ID = 'liteapi-payment-target';/);
});

test('the header says what the docs say, and what was measured', () => {
  const head = comments(PANEL);
  assert.match(head, /FL-4c/, 'the correction is dated in the header');
  assert.match(head, /docs\.liteapi\.travel\/docs\/user-payment/, 'the guide it follows');
  assert.match(head, /nullable: true/, "the reference's own words on the null");
  assert.match(head, /NULL IS EXPECTED/, 'said plainly');
  assert.match(head, /livemode true/, 'and the one thing the docs do not settle, measured');
});
