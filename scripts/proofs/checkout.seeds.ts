/**
 * The checkout law's seeded regressions (CHECKOUT-01, 2026-09-23).
 *
 * The ruling says one thing: a checkout that fails SAYS WHAT HAPPENED. These
 * seeds put back, one at a time, each shape that left the founder a pane with
 * nothing to pay with when he pressed Book on Phuket:
 *
 *   · the SDK effect gives up on a one-line guard, rendering nothing (clause 1);
 *   · the named failure collapses back to one loose string, so the CDN's late
 *     onError buries the prebook's own, specific reason (clause 2);
 *   · fail() stops keeping the FIRST reason, same burial by another route (2);
 *   · the watchdog goes, so a form that never arrives is never noticed — the
 *     vendor cannot tell us, because its SDK swallows every error (clause 3);
 *   · the card ask escapes the failure gate and "Enter your card to pay" prints
 *     under a stated failure again, with no card field anywhere (clause 4).
 *
 * Each must fail THE CHECKOUT LAW by name. The anchors occur exactly once in
 * their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const PANEL = 'src/components/trips/CheckoutPanel.tsx';

const SEEDS: Seed[] = [
  {
    // Clause 1 — the exact shape the panel shipped with: a guard that returns and
    // renders nothing, so the customer watches an empty box.
    name: 'checkout-a the SDK effect gives up silently (clause 1)',
    file: PANEL,
    find: `    if (!document.getElementById(PAYMENT_TARGET_ID)) {
      fail({ kind: 'form_absent', message: 'The secure payment form could not start.', detail: 'The payment area was not on the page when the form was requested. Nothing was charged.' });
      return;
    }`,
    replace: '    if (!document.getElementById(PAYMENT_TARGET_ID)) return;',
    expect: 'a branch that gives up must open a block and say why',
  },
  {
    // Clause 2 — one loose string again. This is how the founder was told "Could
    // not load the payment form" when the truth was a missing key.
    name: 'checkout-b the failure collapses to one loose string (clause 2)',
    file: PANEL,
    find: '  const [failure, setFailureState] = useState<Failure | null>(null);',
    replace: '  const [error, setError] = useState(\'\');\n  const [failure, setFailureState] = useState<Failure | null>(null);',
    expect: 'holds a loose `error` string again',
  },
  {
    // Clause 2 again, by the other route: the last writer wins, so the script's
    // onError overwrites whatever the prebook had already established.
    name: 'checkout-c a late reason buries the first one (clause 2)',
    file: PANEL,
    find: '    setFailureState((cur) => cur ?? next);',
    replace: '    setFailureState(next);',
    expect: 'does not keep the FIRST reason',
  },
  {
    // Clause 3 — without the watchdog nothing observes the vendor's target, and a
    // form that never arrives is indistinguishable from one still loading.
    name: 'checkout-d the watchdog on the vendor\'s target goes (clause 3)',
    file: PANEL,
    find: '    const observer = new MutationObserver(() => {',
    replace: '    const observer = { observe: () => {}, disconnect: () => {} } as unknown as MutationObserver; void ((() => {',
    expect: 'does not watch its payment target',
  },
  {
    // Clause 4 — the three-claims-at-once screenshot: "Could not load the payment
    // form" above "Enter your card to pay" above "Loading the secure payment form…".
    name: 'checkout-e the card ask prints beside a stated failure (clause 4)',
    file: PANEL,
    find: `            {!failure && (
              <>
                <p className="text-sm text-text-faint">
                  Enter your card to pay.`,
    replace: `            {true && (
              <>
                <p className="text-sm text-text-faint">
                  Enter your card to pay.`,
    expect: 'asks for a card without first ruling out a failure',
  },
  {
    // CHECKOUT-03 — the readiness gate removed. Without it the panel hands off
    // before window.Stripe exists, and the vendor's loader hangs on a failed
    // pre-existing tag with nothing thrown for its empty catches to carry.
    name: 'checkout-f the panel hands off before Stripe.js is ready (CHECKOUT-03)',
    file: PANEL,
    find: '!sdkReady || !stripeJsReady || attachChoicePending) return;',
    replace: '!sdkReady || attachChoicePending) return;',
    expect: 'does not wait for Stripe.js',
  },
  {
    // CHECKOUT-03 — Stripe.js failing to load must be NAMED, never a silent wait
    // that the watchdog later reports as "no reason".
    name: 'checkout-g a Stripe.js that cannot load says nothing (CHECKOUT-03)',
    file: PANEL,
    find: `        onError={() => fail({ kind: 'sdk_script', message: 'The secure payment form could not be loaded.', detail: 'The card provider\\u2019s library could not be reached from this browser. Nothing was charged.' })}`,
    replace: '        onError={() => setStripeJsReady(false)}',
    expect: 'loads Stripe.js without naming',
  },
];

export default SEEDS;
