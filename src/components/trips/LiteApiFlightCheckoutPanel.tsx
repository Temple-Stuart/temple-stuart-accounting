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
 * PR-FL-6c: the panel COMPLETES THE BOOKING — payment success POSTs
 * /api/travel/liteapi/flights/book {prebookId, transactionId} and renders a
 * customer-grade booked state (ref/PNR/price; PENDING_CONFIRMATION is
 * success-shaped "ticket issuing", never an error). The critical
 * paid-but-not-booked state NEVER pretends: it names both references and
 * offers RETRY BOOKING only — the book call is idempotent per prebookId
 * (docs: "Returns the existing booking if one already exists"), so retrying
 * can never re-pay or double-book. No card data ever touches our server: the
 * browser talks to Stripe directly via Elements.
 *
 * FL-4b — the form collects the EMPIRICAL prebook contract (proven live
 * 2026-08-04, HTTP 200): contact additionally REQUIRES phoneCountryCode
 * (numeric string, no '+'); the passenger additionally REQUIRES gender
 * ('M'|'F'), nationality (ISO-2) and the full passport block (documentType/
 * documentNumber/documentIssueCountry/documentExpiry). LiteAPI's fraud filter
 * (code 53099) rejects placeholder names like 'Test' — the form says so.
 * publishableKey came back NULL in sandbox: per LiteAPI's own Stripe-Elements
 * doc the publishable keys are "Provided by LiteAPI" and "not exposed in the
 * dashboard — contact your account manager or customer support to request
 * them" — so null stays a DECLARED error naming that gap, never a fallback.
 */

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { TRAVEL_INPUT_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';

interface Props {
  /** The searched offer to check out (from /api/travel/liteapi/flights/search). */
  offerId: string;
  /** Display-only price/currency from the search result — the CHARGED amount is
   *  server-derived at prebook; these are never sent anywhere. */
  price?: number | string | null;
  currency?: string | null;
  /** Fired once, AFTER the booking completed (PR-FL-6c — not on mere payment
   *  success). Parents use it to refresh their booking lists. */
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

// FL-6b: the panel mounts INSIDE the dark travel strip, where the app's
// panel-theme tokens (text-text-primary on bg-panel-surface) resolve
// dark-on-dark — typed values were invisible (live-preview screenshots). The
// working reference is the surface's own vocabulary: TRAVEL_INPUT_CLASS
// (travelSection.tsx:31-32 — explicit text-white on bg-white/10 with
// placeholder-white/40), the exact classes every readable form on this
// surface consumes (hotel/activity/transfer/visa inputs; ResultsFilterBar's
// select). No new design language.
const LABEL = TRAVEL_LABEL_CLASS;
// Same validation the route enforces (flights/prebook/route.ts) — client-side
// mirror so a guest gets instant feedback instead of a 400 round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

type Phase = 'form' | 'prebooking' | 'pay' | 'booking' | 'booked' | 'bookFailed' | 'expired';

/** The book route's whitelisted envelope (FL-5, flights/book/route.ts). */
interface BookEnvelope {
  bookingId: string;
  bookingRef: string | null;
  status: string | null;
  paymentStatus: string | null;
  pnr: string | null;
  price: number | null;
  currency: string | null;
}

export default function LiteApiFlightCheckoutPanel({ offerId, price, currency, onBooked }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  // FL-6b: the field that failed validation — it gets focus + a visible red
  // ring (cleared on the next submit). Values are NEVER wiped on error: no
  // code path writes the form states except their own onChange handlers.
  const [errorField, setErrorField] = useState<string | null>(null);
  const fieldClass = (id: string) =>
    `w-full ${TRAVEL_INPUT_CLASS}${errorField === id ? ' border-brand-red ring-2 ring-brand-red/60' : ''}`;

  // Contact + one passenger — the FULL proven contract (FL-4b header).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCC, setPhoneCC] = useState('');
  const [paxType, setPaxType] = useState<0 | 1 | 2>(0);
  const [paxFirst, setPaxFirst] = useState('');
  const [paxLast, setPaxLast] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [nationality, setNationality] = useState('');
  const [docType, setDocType] = useState('passport');
  const [docNumber, setDocNumber] = useState('');
  const [docIssueCountry, setDocIssueCountry] = useState('');
  const [docExpiry, setDocExpiry] = useState('');

  const [prebook, setPrebook] = useState<PrebookEnvelope | null>(null);
  const [bookResult, setBookResult] = useState<BookEnvelope | null>(null);
  const [bookError, setBookError] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);

  // PR-FL-6c: payment succeeded → complete the booking. RETRY-SAFE BY THE
  // DOCS' OWN CONTRACT: /flights/bookings is idempotent per prebookId
  // ("Returns the existing booking if one already exists"), and this function
  // re-POSTs the BOOK step only — the payment is already confirmed and is
  // never touched again.
  const completeBooking = async (pb: PrebookEnvelope) => {
    setPhase('booking');
    setBookingBusy(true);
    setBookError('');
    try {
      const res = await fetch('/api/travel/liteapi/flights/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prebookId: pb.prebookId, transactionId: pb.transactionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410 || data?.code === 'offer_expired') {
        setPhase('expired');
        return;
      }
      if (!res.ok) throw new Error(data?.error || `Booking did not complete (HTTP ${res.status})`);
      setBookResult(data as BookEnvelope);
      setPhase('booked');
      onBooked?.({ prebookId: pb.prebookId, transactionId: pb.transactionId });
    } catch (err) {
      // THE CRITICAL STATE — paid but not booked. Never pretend: the failure
      // renders loudly with both references and a retry of the book step only.
      setBookError(err instanceof Error ? err.message : 'Booking did not complete.');
      setPhase('bookFailed');
    } finally {
      setBookingBusy(false);
    }
  };

  // Nuitee's publishable key ONLY — from the prebook response, never env. The
  // memo keys on the response value so a re-prebook with a different key would
  // re-init cleanly. loadStripe itself caches per key.
  const stripePromise = useMemo(
    () => (prebook?.publishableKey ? loadStripe(prebook.publishableKey) : null),
    [prebook?.publishableKey],
  );

  // Same proven rules as before (FL-4b) — now each failure names its FIELD so
  // the submit handler can focus + highlight it.
  const validate = (): { message: string; field: string } | null => {
    if (!firstName.trim() || !lastName.trim()) {
      return { message: 'Contact first and last name are required.', field: !firstName.trim() ? 'flck-co-first' : 'flck-co-last' };
    }
    if (!EMAIL_RE.test(email.trim())) return { message: 'Enter a valid email address.', field: 'flck-co-email' };
    if (!/^\d{1,4}$/.test(phoneCC.trim())) {
      return { message: "Phone country code must be numeric with no '+' (e.g. 1).", field: 'flck-co-cc' };
    }
    if (!phone.trim()) return { message: 'Contact phone number is required.', field: 'flck-co-phone' };
    if (!paxFirst.trim() || !paxLast.trim()) {
      return { message: 'Passenger first and last name are required.', field: !paxFirst.trim() ? 'flck-px-first' : 'flck-px-last' };
    }
    if (!DATE_RE.test(birthday.trim()) || birthday.trim() >= todayUtc()) {
      return { message: 'Passenger birthday must be YYYY-MM-DD and in the past.', field: 'flck-px-birthday' };
    }
    if (gender !== 'M' && gender !== 'F') return { message: 'Select the passenger gender.', field: 'flck-px-gender' };
    if (!/^[A-Za-z]{2}$/.test(nationality.trim())) {
      return { message: 'Nationality must be a 2-letter country code (e.g. US).', field: 'flck-px-nationality' };
    }
    if (!docType.trim()) return { message: 'Document type is required.', field: 'flck-doc-type' };
    if (!docNumber.trim()) return { message: 'Document number is required.', field: 'flck-doc-number' };
    if (!/^[A-Za-z]{2}$/.test(docIssueCountry.trim())) {
      return { message: 'Document issue country must be a 2-letter code (e.g. US).', field: 'flck-doc-issue' };
    }
    if (!DATE_RE.test(docExpiry.trim())) return { message: 'Document expiry must be YYYY-MM-DD.', field: 'flck-doc-expiry' };
    return null;
  };

  const submitPrebook = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      // Entered values stay exactly as typed — only the message + highlight
      // change, and the failing field takes focus.
      setError(v.message);
      setErrorField(v.field);
      document.getElementById(v.field)?.focus();
      return;
    }
    setError('');
    setErrorField(null);
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
            phoneCountryCode: phoneCC.trim(),
          },
          passengers: [{
            passengerType: paxType,
            firstName: paxFirst.trim(),
            lastName: paxLast.trim(),
            birthday: birthday.trim(),
            gender,
            nationality: nationality.trim().toUpperCase(),
            documentType: docType.trim(),
            documentNumber: docNumber.trim(),
            documentIssueCountry: docIssueCountry.trim().toUpperCase(),
            documentExpiry: docExpiry.trim(),
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
      if (typeof data?.secretKey !== 'string' || !data.secretKey) {
        console.error('[LiteAPI flights] prebook succeeded but returned no secretKey:', JSON.stringify({
          prebookId: data?.prebookId ?? null,
        }));
        throw new Error('Payment cannot start — the checkout session is missing its payment secret. This is a provider-side issue; nothing was charged.');
      }
      if (typeof data?.publishableKey !== 'string' || !data.publishableKey) {
        // FL-4b: the OBSERVED sandbox behavior — publishableKey: null. Their
        // Stripe-Elements doc says the publishable keys are "Provided by
        // LiteAPI" and "not exposed in the dashboard — contact your account
        // manager or customer support to request them", so this names the real
        // gap instead of pretending it's transient.
        console.error('[LiteAPI flights] prebook returned no publishableKey — Elements cannot mount; the per-env keys come from Nuitee support, not the response.');
        throw new Error('Sandbox prebook returned no publishable key — pending Nuitee guidance.');
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
    <div className="space-y-4 rounded-lg border border-panel-border bg-white/5 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-white">Flight checkout</h2>
        {displayPrice != null && (
          <span className="text-sm font-bold text-brand-green">
            {displayCurrency ?? ''} {displayPrice}
          </span>
        )}
      </div>

      {phase === 'form' || phase === 'prebooking' ? (
        <form onSubmit={submitPrebook} className="space-y-3">
          <p className="text-xs text-white/50">Contact</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className={LABEL}>First name</span>
              <input id="flck-co-first" className={fieldClass('flck-co-first')} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Last name</span>
              <input id="flck-co-last" className={fieldClass('flck-co-last')} value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
            <label className="col-span-2 space-y-1"><span className={LABEL}>Email</span>
              <input id="flck-co-email" className={fieldClass('flck-co-email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Country code (no +)</span>
              <input id="flck-co-cc" className={fieldClass('flck-co-cc')} inputMode="numeric" placeholder="1" value={phoneCC} onChange={(e) => setPhoneCC(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Phone</span>
              <input id="flck-co-phone" className={fieldClass('flck-co-phone')} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          </div>
          <p className="text-xs text-white/50">Passenger</p>
          {/* FL-4b: real-looking names required — LiteAPI's fraud filter (53099)
              rejects placeholders like 'Test'. */}
          <p className="text-[11px] text-white/50">
            Use a real name — the provider&apos;s fraud filter rejects placeholder names like &ldquo;Test&rdquo;.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className={LABEL}>Type</span>
              <select id="flck-px-type" className={fieldClass('flck-px-type')} value={paxType} onChange={(e) => setPaxType(Number(e.target.value) as 0 | 1 | 2)}>
                <option value={0}>Adult</option>
                <option value={1}>Child</option>
                <option value={2}>Infant</option>
              </select></label>
            <label className="space-y-1"><span className={LABEL}>Gender</span>
              <select id="flck-px-gender" className={fieldClass('flck-px-gender')} value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F' | '')}>
                <option value="">Select…</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select></label>
            <label className="space-y-1"><span className={LABEL}>First name</span>
              <input id="flck-px-first" className={fieldClass('flck-px-first')} value={paxFirst} onChange={(e) => setPaxFirst(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Last name</span>
              <input id="flck-px-last" className={fieldClass('flck-px-last')} value={paxLast} onChange={(e) => setPaxLast(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Birthday (YYYY-MM-DD)</span>
              <input id="flck-px-birthday" className={fieldClass('flck-px-birthday')} placeholder="1990-01-31" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Nationality (ISO-2)</span>
              <input id="flck-px-nationality" className={fieldClass('flck-px-nationality')} placeholder="US" maxLength={2} value={nationality} onChange={(e) => setNationality(e.target.value)} /></label>
          </div>
          <p className="text-xs text-white/50">Travel document</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className={LABEL}>Type</span>
              <input id="flck-doc-type" className={fieldClass('flck-doc-type')} value={docType} onChange={(e) => setDocType(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Number</span>
              <input id="flck-doc-number" className={fieldClass('flck-doc-number')} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Issue country (ISO-2)</span>
              <input id="flck-doc-issue" className={fieldClass('flck-doc-issue')} placeholder="US" maxLength={2} value={docIssueCountry} onChange={(e) => setDocIssueCountry(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Expiry (YYYY-MM-DD)</span>
              <input id="flck-doc-expiry" className={fieldClass('flck-doc-expiry')} placeholder="2030-01-31" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} /></label>
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
          <PayForm onSucceeded={() => { void completeBooking(prebook); }} />
        </Elements>
      )}

      {phase === 'booking' && (
        <div className="rounded border border-panel-border bg-white/5 p-3" aria-busy="true">
          <p className="text-sm text-white">Payment received — completing your booking…</p>
        </div>
      )}

      {/* PR-FL-6c: the customer-grade booked state. PENDING_CONFIRMATION /
          PENDING are SUCCESS-shaped (the provider is issuing the ticket) —
          never rendered as an error. No dev ids here; references live only in
          the failure state, where the customer actually needs them. */}
      {phase === 'booked' && bookResult && (
        <div className="space-y-1.5 rounded border border-brand-green/40 bg-brand-green/10 p-3">
          <p className="text-sm font-semibold text-brand-green">
            Booked · ref {bookResult.bookingRef ?? bookResult.bookingId}
          </p>
          <p className="text-xs text-white/70">
            {bookResult.status === 'PENDING_CONFIRMATION' || bookResult.status === 'PENDING'
              ? 'Booking confirmed — your ticket is being issued.'
              : 'Your ticket is confirmed.'}
          </p>
          {bookResult.pnr && (
            <p className="text-xs text-white">Airline confirmation (PNR): <span className="font-mono">{bookResult.pnr}</span></p>
          )}
          {bookResult.price != null && (
            <p className="text-xs text-white/70">
              Total charged: {bookResult.currency ?? ''} {bookResult.price.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {phase === 'bookFailed' && prebook && (
        <div className="space-y-2 rounded border border-brand-red/40 bg-brand-red/10 p-3">
          <p className="text-sm font-semibold text-brand-red">
            Your payment went through but the booking didn&apos;t complete — nothing is lost.
          </p>
          {bookError && <p className="text-xs text-white/70">{bookError}</p>}
          <p className="text-xs text-white/70">
            Retry below — retrying completes the SAME booking and never charges you again. If it keeps
            failing, contact support with these references:
          </p>
          <p className="break-all font-mono text-xs text-white">booking reference: {prebook.prebookId}</p>
          <p className="break-all font-mono text-xs text-white">payment reference: {prebook.transactionId}</p>
          <button
            type="button"
            onClick={() => { void completeBooking(prebook); }}
            disabled={bookingBusy}
            className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {bookingBusy ? 'Retrying…' : 'Retry booking'}
          </button>
        </div>
      )}

      {phase === 'expired' && (
        <div className="rounded border border-panel-border bg-white/5 p-3">
          <p className="text-sm text-white">This fare quote expired — airlines only hold prices for a few minutes.</p>
          <p className="mt-1 text-xs text-white/50">Run a new search and open checkout with a fresh offer.</p>
        </div>
      )}
    </div>
  );
}

/** Inner card form — must live inside <Elements>, so useStripe/useElements
 *  resolve. Retry policy (ruled): a failed confirmPayment retries the PAYMENT
 *  only, on the SAME clientSecret/Elements — never a silent re-prebook. */
function PayForm({ onSucceeded }: { onSucceeded: () => void }) {
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
    </div>
  );
}
