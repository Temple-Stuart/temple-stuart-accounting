'use client';

/**
 * LiteApiFlightCheckoutPanel (PR-FL-4) — the LiteAPI flights checkout: passenger
 * form → POST /api/travel/liteapi/flights/prebook → Stripe Elements card form on
 * NUITEE'S Stripe (the intent is created on their account at prebook; FLIGHT-LITE-1
 * recon + flight-booking-architecture docs: "The payment intent is created
 * server-side by Nuitee Connect during prebook").
 *
 * KEY INVARIANT — WHOSE STRIPE: Elements mounts with the `publishableKey` FROM THE
 * PREBOOK RESPONSE (prebook/route.ts:152), NEVER any env key and NEVER our own
 * Stripe (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is the SUBSCRIPTION/Duffel rail).
 * Mixing rails would confirm a card against the wrong Stripe account, so a
 * null/absent publishableKey or secretKey is a DECLARED error state — loud, no
 * fallback of any kind.
 *
 * Scope (PR-FL-4): payment proof only. Success renders the raw transactionId +
 * prebookId (and fires onBooked) — the /flights/bookings completion call is
 * FL-5's; the public search UI wiring is FL-6's. No card data ever touches our
 * server: the browser talks to Stripe directly via Elements.
 */

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface Props {
  /** The searched offer to check out (from /api/travel/liteapi/flights/search). */
  offerId: string;
  /** Display-only price/currency from the search result — the CHARGED amount is
   *  server-derived at prebook; these are never sent anywhere. */
  price?: number | string | null;
  currency?: string | null;
  /** FL-5 wires this to the booking completion; the panel also renders its raw
   *  success state regardless. */
  onBooked?: (info: { prebookId: string; transactionId: string }) => void;
}

/** The prebook route's whitelisted envelope — names + nullability exactly as
 *  emitted (prebook/route.ts:149-154; publishableKey/price/currency are
 *  null-able per liteapiFlightsClient.ts's FlightPrebookResult). */
interface PrebookEnvelope {
  prebookId: string;
  transactionId: string;
  secretKey: string;
  publishableKey: string | null;
  price: number | null;
  currency: string | null;
}

const FIELD = 'w-full rounded border border-panel-border bg-panel-surface px-3 py-2 text-sm text-text-primary';
const LABEL = 'text-[11px] font-medium text-brand-purple';
// Same validation the route enforces (flights/prebook/route.ts) — client-side
// mirror so a guest gets instant feedback instead of a 400 round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

type Phase = 'form' | 'prebooking' | 'pay' | 'succeeded' | 'expired';

export default function LiteApiFlightCheckoutPanel({ offerId, price, currency, onBooked }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');

  // Contact (the route's required four) + one adult passenger (contract minimum).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paxFirst, setPaxFirst] = useState('');
  const [paxLast, setPaxLast] = useState('');
  const [birthday, setBirthday] = useState('');

  const [prebook, setPrebook] = useState<PrebookEnvelope | null>(null);

  // Nuitee's publishable key ONLY — from the prebook response, never env. The
  // memo keys on the response value so a re-prebook with a different key would
  // re-init cleanly. loadStripe itself caches per key.
  const stripePromise = useMemo(
    () => (prebook?.publishableKey ? loadStripe(prebook.publishableKey) : null),
    [prebook?.publishableKey],
  );

  const validate = (): string => {
    if (!firstName.trim() || !lastName.trim()) return 'Contact first and last name are required.';
    if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
    if (!phone.trim()) return 'Contact phone number is required.';
    if (!paxFirst.trim() || !paxLast.trim()) return 'Passenger first and last name are required.';
    if (!DATE_RE.test(birthday.trim()) || birthday.trim() >= todayUtc()) {
      return 'Passenger birthday must be YYYY-MM-DD and in the past.';
    }
    return '';
  };

  const submitPrebook = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError('');
    setPhase('prebooking');
    try {
      const res = await fetch('/api/travel/liteapi/flights/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          contact: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phoneNumber: phone.trim(),
          },
          passengers: [{
            passengerType: 0,
            firstName: paxFirst.trim(),
            lastName: paxLast.trim(),
            birthday: birthday.trim(),
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410 || data?.code === 'offer_expired') {
        setPhase('expired');
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || `Prebook failed (HTTP ${res.status})`);
      }
      // RULED GATE: both Stripe fields must be present, or this is a declared
      // dead end — mounting Elements with any OTHER key (env, our Stripe)
      // would confirm the card against the wrong rail. No fallback exists.
      if (typeof data?.secretKey !== 'string' || !data.secretKey ||
          typeof data?.publishableKey !== 'string' || !data.publishableKey) {
        console.error('[LiteAPI flights] prebook succeeded but the Stripe context is incomplete:', JSON.stringify({
          hasSecretKey: !!data?.secretKey,
          hasPublishableKey: !!data?.publishableKey,
          prebookId: data?.prebookId ?? null,
        }));
        throw new Error('Payment cannot start — the checkout session is missing its payment keys. This is a provider-side issue; nothing was charged.');
      }
      setPrebook(data as PrebookEnvelope);
      setPhase('pay');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the checkout session.');
      setPhase('form');
    }
  };

  // Display price: prefer the prebook's server-derived figure once we have it.
  const displayPrice = prebook?.price ?? price ?? null;
  const displayCurrency = prebook?.currency ?? currency ?? null;

  return (
    <div className="space-y-4 rounded-lg border border-panel-border bg-panel p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text-primary">Flight checkout</h2>
        {displayPrice != null && (
          <span className="text-sm font-bold text-brand-green">
            {displayCurrency ?? ''} {displayPrice}
          </span>
        )}
      </div>

      {phase === 'form' || phase === 'prebooking' ? (
        <form onSubmit={submitPrebook} className="space-y-3">
          <p className="text-xs text-text-muted">Contact</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className={LABEL}>First name</span>
              <input className={FIELD} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Last name</span>
              <input className={FIELD} value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Email</span>
              <input className={FIELD} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Phone</span>
              <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          </div>
          <p className="text-xs text-text-muted">Passenger (adult)</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className={LABEL}>First name</span>
              <input className={FIELD} value={paxFirst} onChange={(e) => setPaxFirst(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Last name</span>
              <input className={FIELD} value={paxLast} onChange={(e) => setPaxLast(e.target.value)} /></label>
            <label className="col-span-2 space-y-1"><span className={LABEL}>Birthday (YYYY-MM-DD)</span>
              <input className={FIELD} placeholder="1990-01-31" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></label>
          </div>
          {error && <p className="text-sm text-brand-red">{error}</p>}
          <button
            type="submit"
            disabled={phase === 'prebooking'}
            className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {phase === 'prebooking' ? 'Holding fare…' : 'Continue to payment'}
          </button>
        </form>
      ) : null}

      {phase === 'pay' && prebook && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret: prebook.secretKey }}>
          <PayForm
            prebook={prebook}
            onSucceeded={() => {
              setPhase('succeeded');
              onBooked?.({ prebookId: prebook.prebookId, transactionId: prebook.transactionId });
            }}
          />
        </Elements>
      )}

      {phase === 'succeeded' && prebook && (
        <div className="space-y-2 rounded border border-brand-green/40 bg-brand-green/10 p-3">
          <p className="text-sm font-semibold text-brand-green">Payment succeeded (sandbox proof).</p>
          {/* FL-4 raw success state — FL-5 turns these into the /flights/bookings
              completion call. Shown raw on purpose: this is the dev-harness proof. */}
          <p className="break-all font-mono text-xs text-text-primary">transactionId: {prebook.transactionId}</p>
          <p className="break-all font-mono text-xs text-text-primary">prebookId: {prebook.prebookId}</p>
          <p className="text-xs text-text-muted">Booking completion (the /flights/bookings call) lands in FL-5 — no ticket was issued yet.</p>
        </div>
      )}

      {phase === 'expired' && (
        <div className="rounded border border-panel-border bg-panel-surface p-3">
          <p className="text-sm text-text-primary">This fare quote expired — airlines only hold prices for a few minutes.</p>
          <p className="mt-1 text-xs text-text-muted">Run a new search and open checkout with a fresh offer.</p>
        </div>
      )}
    </div>
  );
}

/** Inner card form — must live inside <Elements>, so useStripe/useElements
 *  resolve. Retry policy (ruled): a failed confirmPayment retries the PAYMENT
 *  only, on the SAME clientSecret/Elements — never a silent re-prebook. */
function PayForm({ prebook, onSucceeded }: { prebook: PrebookEnvelope; onSucceeded: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setPayError('');
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setPaying(false);
    if (result.error) {
      // Stripe's message VERBATIM — for sandbox card discovery this exact text
      // IS the finding (flights test cards are undocumented; FLIGHT-LITE-1).
      setPayError(result.error.message || `Payment failed (${result.error.type}).`);
      return;
    }
    const status = result.paymentIntent?.status;
    if (status === 'succeeded') {
      onSucceeded();
      return;
    }
    // Declared, not silent: surface the raw non-success status. Retry stays on
    // this same intent.
    setPayError(`Payment not completed — status '${status ?? 'unknown'}'.`);
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      {payError && <p className="text-sm text-brand-red">{payError}</p>}
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || !elements || paying}
        className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {paying ? 'Paying…' : 'Pay now'}
      </button>
      <p className="break-all font-mono text-[10px] text-text-muted">tx: {prebook.transactionId}</p>
    </div>
  );
}
