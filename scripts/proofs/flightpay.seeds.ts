/**
 * The flight payment-rail law's seeded regressions (FL-4c, 2026-09-23).
 *
 * The ruling says one thing: the flights checkout takes a card THE WAY THE VENDOR
 * DOCUMENTS IT. These seeds put back, one at a time, each shape that either stopped
 * a customer typing a card at all or would quietly put this lane back on a rail of
 * our own invention:
 *
 *   · the hand-rolled Stripe mount returns (clause 1);
 *   · publicKey stops being the environment label the server derived (clause 2);
 *   · an environment we cannot name is defaulted instead of stated (clause 2);
 *   · the prebook's documented-nullable publishableKey is read again (clause 3);
 *   · fail() stops keeping the FIRST reason (clause 4);
 *   · the card ask escapes the failure gate (clause 4);
 *   · the watchdog on the vendor's target goes (clause 4);
 *   · the Stripe.js readiness gate goes, so the vendor's loader can hang (clause 5);
 *   · a Stripe.js that cannot load says nothing (clause 5);
 *   · the rail's redirect lands on the HOTEL confirm page (clause 6);
 *   · the confirm page stops saying whether the email went out (clause 6);
 *   · the confirm page is no longer public, so a paid guest is bounced (clause 6).
 *
 * Each must fail THE FLIGHT PAYMENT-RAIL LAW by name. The anchors occur exactly once
 * in their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
const CONFIRM = 'src/app/booking/flight-confirm/page.tsx';
const MIDDLEWARE = 'src/middleware.ts';

const SEEDS: Seed[] = [
  {
    // Clause 1 — the exact shape PR #1744 shipped: our own Stripe, mounted by hand,
    // beside the rail the vendor documents.
    name: 'flightpay-a the hand-rolled Stripe mount returns (clause 1)',
    file: PANEL,
    find: "import Script from 'next/script';",
    replace: "import Script from 'next/script';\nimport { loadStripe } from '@stripe/stripe-js';",
    expect: 'still hand-rolls the card form (@stripe/stripe-js)',
  },
  {
    // Clause 2 — publicKey is the ENVIRONMENT, in the vendor's own words. A literal
    // here is the browser guessing what the server already knows.
    name: 'flightpay-b publicKey stops being the server\'s env label (clause 2)',
    file: PANEL,
    find: '        publicKey: paymentEnv,',
    replace: "        publicKey: 'live',",
    expect: 'does not pass the environment label as publicKey',
  },
  {
    // Clause 2 again — the environment is defaulted rather than stated. This is the
    // fallback the ruling forbids by name.
    name: 'flightpay-c an unnameable environment is defaulted, not stated (clause 2)',
    file: PANEL,
    find: "      if (env !== 'live' && env !== 'sandbox') {",
    replace: '      if (false) {',
    expect: 'does not check the environment label against the two the vendor documents',
  },
  {
    // Clause 3 — the documented null treated as a fault again. This is the defect:
    // the reference says "null if not applicable", and the panel dead-ended on it.
    name: 'flightpay-d the documented-nullable publishableKey is read again (clause 3)',
    file: PANEL,
    find: '      setPrebook(data as PrebookEnvelope);',
    replace: '      if (!data?.publishableKey) return;\n      setPrebook(data as PrebookEnvelope);',
    expect: 'reads publishableKey again',
  },
  {
    // Clause 4 — CHECKOUT-01's burial, by the other route: the last writer wins, so
    // the CDN's late onError overwrites the specific reason already established.
    name: 'flightpay-e a late reason buries the first one (clause 4)',
    file: PANEL,
    find: '    setFailureState((cur) => cur ?? next);',
    replace: '    setFailureState(next);',
    expect: 'does not keep the FIRST reason',
  },
  {
    // Clause 4 — a panel that cannot take a card asks for one anyway.
    name: 'flightpay-f the card ask escapes the failure gate (clause 4)',
    file: PANEL,
    find: "      {phase === 'pay' && prebook && !failure && (",
    replace: "      {phase === 'pay' && prebook && (",
    expect: 'asks for a card without first ruling out a failure',
  },
  {
    // Clause 4 — without the watchdog nothing observes the vendor's target, and the
    // SDK swallows every error in two empty catches, so nothing is ever said.
    name: 'flightpay-g the watchdog on the vendor target goes (clause 4)',
    file: PANEL,
    find: '    const observer = new MutationObserver(() => {',
    replace: '    const observer = { observe: () => {}, disconnect: () => {} } as unknown as MutationObserver; void ((() => {',
    expect: 'does not watch its payment target',
  },
  {
    // Clause 5 — CHECKOUT-03's gate removed: the hand-off happens before
    // window.Stripe exists and the vendor's loader hangs with nothing thrown.
    name: 'flightpay-h the panel hands off before Stripe.js is ready (clause 5)',
    file: PANEL,
    find: '!sdkReady || !stripeJsReady || failure) return;',
    replace: '!sdkReady || failure) return;',
    expect: 'does not wait for Stripe.js',
  },
  {
    // Clause 5 — Stripe.js failing to load must be NAMED, never a silent wait the
    // watchdog later reports as "no reason".
    name: 'flightpay-i a Stripe.js that cannot load says nothing (clause 5)',
    file: PANEL,
    find: "        onError={() => fail({ kind: 'sdk_script', message: 'The secure payment form could not be loaded.', detail: 'The card provider\\u2019s library could not be reached from this browser. Nothing was charged.' })}",
    replace: '        onError={() => setStripeJsReady(false)}',
    expect: 'loads Stripe.js without naming the failure',
  },
  {
    // Clause 6 — the rail redirects, and this is what happens when nobody notices:
    // a paid flight customer lands on the HOTEL confirmation page.
    name: 'flightpay-j the redirect lands on the hotel confirm page (clause 6)',
    file: PANEL,
    find: '    const returnUrl = `${window.location.origin}/booking/flight-confirm?${q.toString()}`;',
    replace: '    const returnUrl = `${window.location.origin}/booking/confirm?${q.toString()}`;',
    expect: 'returnUrl does not land on /booking/flight-confirm',
  },
  {
    // Clause 6 — FL-5b's rule moved here with the booking: a confirmation that did
    // not go out is said, and never dressed up as a failed booking.
    name: 'flightpay-k the confirm page stops saying the email outcome (clause 6)',
    file: CONFIRM,
    find: 'data-flight-email="sent"',
    replace: 'data-flight-email-removed="sent"',
    expect: 'does not say whether the confirmation email went out',
  },
  {
    // Clause 6 — without the public path a guest who has ALREADY PAID is 307-bounced
    // to the landing and the booking is never completed.
    name: 'flightpay-l the confirm page is no longer public (clause 6)',
    file: MIDDLEWARE,
    find: "  '/booking/flight-confirm',",
    replace: "  // '/booking/flight-confirm',",
    expect: 'does not list /booking/flight-confirm as public',
  },
];

export default SEEDS;
