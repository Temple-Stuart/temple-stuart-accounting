'use client';

/**
 * FlightCheckoutPanel — flight Book (pay now) via Duffel Payments (PR-Duffel-Pay-2).
 *
 * Mirrors the hotel CheckoutPanel, in the phone-first TripFormModal shell:
 *   1. collect passenger details (name / DOB / gender / email / phone; optional
 *      passport for international itineraries),
 *   2. POST /api/flights/payment-intent → a Duffel Payment Intent client_token,
 *   3. mount Duffel's Card Payment component (@duffel/components) with that token —
 *      the card NEVER touches our server (PCI); the component confirms the payment,
 *   4. POST /api/flights/book with the paymentIntentId → the server verifies the
 *      intent succeeded and creates the order (type:'instant', paid from balance),
 *   5. show the booking reference, or a clear failure — never a fake success.
 *
 * TEST MODE only — the backend blocks live unless an explicit flag is set, and the
 * panel shows a "test mode" note. Nothing card-related is ever logged here.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import TripFormModal from './TripFormModal';

// DuffelPayments renders Stripe Elements (browser-only) — load it client-side only.
const DuffelPayments = dynamic(
  () => import('@duffel/components').then((m) => m.DuffelPayments),
  {
    ssr: false,
    loading: () => <p className="text-sm text-text-muted">Loading secure payment…</p>,
  },
);

interface OfferLite {
  id: string;
  price: number;
  currency: string;
}

interface Passenger {
  title: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: string;
  email: string;
  phone_number: string;
  // Optional passport (required by Duffel for international itineraries).
  passportNumber: string;
  passportExpiry: string;
  passportCountry: string;
}

interface Props {
  /** The selected offer (id drives the server re-fetch; price/currency for display). */
  offer: OfferLite;
  /** How many passengers the offer is for (adults). */
  passengerCount: number;
  onClose: () => void;
  /** Called with the booking reference after a successful order. */
  onBooked?: (bookingReference: string) => void;
  /** Offer-expired recovery: close the panel and re-run the ORIGINAL search so the
   *  user re-picks from fresh offers (prices may differ — that is visible truth).
   *  When absent (dev harness), the expired state offers Close instead. */
  onOfferExpired?: () => void;
}

const TITLES = ['mr', 'ms', 'mrs', 'miss', 'dr'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyPassenger(): Passenger {
  return {
    title: 'mr',
    given_name: '',
    family_name: '',
    born_on: '',
    gender: 'm',
    email: '',
    phone_number: '',
    passportNumber: '',
    passportExpiry: '',
    passportCountry: '',
  };
}

const fieldClass =
  'w-full rounded border border-brand-purple/40 bg-white px-3 py-2 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20';
const labelClass = 'text-[11px] font-medium text-brand-purple';

export default function FlightCheckoutPanel({ offer, passengerCount, onClose, onBooked, onOfferExpired }: Props) {
  const [phase, setPhase] = useState<'form' | 'payment' | 'booking' | 'booked'>('form');
  // The server declared this offer dead (410 offer_expired) — retrying the SAME
  // offer id can never succeed, so the retry button is replaced by Refresh.
  const [offerExpired, setOfferExpired] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>(() =>
    Array.from({ length: Math.max(1, passengerCount) }, emptyPassenger),
  );
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargedNoOrder, setChargedNoOrder] = useState(false);
  // PR-Flight-Panel-ErrorState: the "charged but no order" banner must NEVER show until a
  // real card-payment success has actually run the order step. This flag is the explicit
  // precondition — false on open and through the whole form + card-entry flow, set true
  // only inside finalizeOrder (which only runs from a genuine Duffel card success). Without
  // it the alarming banner is gated on chargedNoOrder alone, with no proof a charge happened.
  const [paymentAttempted, setPaymentAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const setPax = (i: number, patch: Partial<Passenger>) =>
    setPassengers((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const paxValid = (p: Passenger) =>
    p.given_name.trim() &&
    p.family_name.trim() &&
    p.born_on &&
    EMAIL_RE.test(p.email.trim()) &&
    p.phone_number.trim();
  const allValid = passengers.every(paxValid);

  // Build the API passenger payload — passport passed through only when filled.
  const passengerPayload = () =>
    passengers.map((p) => ({
      title: p.title,
      given_name: p.given_name.trim(),
      family_name: p.family_name.trim(),
      born_on: p.born_on,
      gender: p.gender,
      email: p.email.trim(),
      phone_number: p.phone_number.trim(),
      ...(p.passportNumber.trim()
        ? {
            identity_documents: [
              {
                type: 'passport',
                unique_identifier: p.passportNumber.trim(),
                expires_on: p.passportExpiry || undefined,
                issuing_country_code: p.passportCountry.trim().toUpperCase() || undefined,
              },
            ],
          }
        : {}),
    }));

  // STEP 1 — create the Payment Intent → client_token for the Card component.
  const startPayment = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/flights/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.code === 'offer_expired') {
        // Typed dead-offer signal (410): show the honest copy and swap the
        // same-offer retry for a Refresh action — retrying this id is futile.
        setOfferExpired(true);
        setError(data.error || 'This fare quote expired. Refresh to see current flights and prices.');
        return;
      }
      if (!res.ok || !data.clientToken) throw new Error(data.error || 'Could not start payment.');
      setClientToken(data.clientToken);
      setPaymentIntentId(data.paymentIntentId);
      setMode(data.mode ?? null);
      setPhase('payment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  };

  // STEP 4 — the Card component confirmed the payment; create the order from balance.
  const finalizeOrder = async () => {
    setPhase('booking');
    setPaymentAttempted(true); // a genuine card-payment success reached the order step
    setError(null);
    setChargedNoOrder(false);
    try {
      const res = await fetch('/api/flights/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer.id,
          paymentIntentId,
          passengers: passengerPayload(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Honest real-money case: card charged but order failed (PR-1 fail-loud state).
        if (data.paymentConfirmedNoOrder) setChargedNoOrder(true);
        throw new Error(data.error || 'Booking failed.');
      }
      setBookingRef(data.order?.bookingReference ?? null);
      setPhase('booked');
      onBooked?.(data.order?.bookingReference ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed.');
      // Back to the payment phase so the message shows; the card-charged-no-order
      // banner (if set) is rendered prominently below.
      setPhase('payment');
    }
  };

  const isTest = mode === 'test';

  return (
    <TripFormModal
      title="Book this flight"
      subtitle={`${offer.currency} ${offer.price.toLocaleString()} · pay now`}
      onClose={onClose}
    >
      {/* Test-mode note — makes it obvious no real charge happens. */}
      {phase !== 'booked' && (mode === null || isTest) && (
        <p className="mb-3 rounded border border-brand-purple/30 bg-brand-purple-wash px-3 py-2 text-xs text-brand-purple">
          Test mode — no real charge. Use a Duffel test card.
        </p>
      )}

      {paymentAttempted && chargedNoOrder && (
        <p className="mb-3 rounded border border-brand-red/40 bg-bg-row px-3 py-2 text-sm text-brand-red">
          Your card was charged but the booking did not finalize. Please contact support —
          we will refund or complete it. Do not pay again.
        </p>
      )}
      {error && !chargedNoOrder && (
        <p className="mb-3 rounded border border-brand-red/40 bg-bg-row px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      {/* ── PHASE: passenger form ──────────────────────────────────────────────── */}
      {phase === 'form' && (
        <div className="space-y-5">
          {passengers.map((p, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              {passengers.length > 1 && (
                <p className="text-xs font-semibold text-text-secondary">Passenger {i + 1}</p>
              )}
              <div className="flex gap-2">
                <label className="flex w-24 flex-col gap-1">
                  <span className={labelClass}>Title</span>
                  <select className={fieldClass} value={p.title} onChange={(e) => setPax(i, { title: e.target.value })}>
                    {TITLES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className={labelClass}>First name *</span>
                  <input className={fieldClass} value={p.given_name} onChange={(e) => setPax(i, { given_name: e.target.value })} />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className={labelClass}>Last name *</span>
                  <input className={fieldClass} value={p.family_name} onChange={(e) => setPax(i, { family_name: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className={labelClass}>Date of birth *</span>
                  <input type="date" className={fieldClass} value={p.born_on} onChange={(e) => setPax(i, { born_on: e.target.value })} />
                </label>
                <label className="flex w-28 flex-col gap-1">
                  <span className={labelClass}>Gender</span>
                  <select className={fieldClass} value={p.gender} onChange={(e) => setPax(i, { gender: e.target.value })}>
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className={labelClass}>Email *</span>
                  <input type="email" className={fieldClass} value={p.email} onChange={(e) => setPax(i, { email: e.target.value })} />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className={labelClass}>Phone (+1…) *</span>
                  <input type="tel" placeholder="+15551234567" className={fieldClass} value={p.phone_number} onChange={(e) => setPax(i, { phone_number: e.target.value })} />
                </label>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-text-muted">Passport — required for international flights</summary>
                <div className="mt-2 flex gap-2">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className={labelClass}>Passport no.</span>
                    <input className={fieldClass} value={p.passportNumber} onChange={(e) => setPax(i, { passportNumber: e.target.value })} />
                  </label>
                  <label className="flex w-32 flex-col gap-1">
                    <span className={labelClass}>Expires</span>
                    <input type="date" className={fieldClass} value={p.passportExpiry} onChange={(e) => setPax(i, { passportExpiry: e.target.value })} />
                  </label>
                  <label className="flex w-20 flex-col gap-1">
                    <span className={labelClass}>Country</span>
                    <input maxLength={2} placeholder="US" className={fieldClass} value={p.passportCountry} onChange={(e) => setPax(i, { passportCountry: e.target.value.toUpperCase() })} />
                  </label>
                </div>
              </details>
            </div>
          ))}
          {offerExpired ? (
            <button
              type="button"
              onClick={() => (onOfferExpired ? onOfferExpired() : onClose())}
              className="w-full rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
            >
              {onOfferExpired ? 'Refresh flights' : 'Close'}
            </button>
          ) : (
            <button
              type="button"
              onClick={startPayment}
              disabled={!allValid || busy}
              className="w-full rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90 disabled:opacity-50"
            >
              {busy ? 'Starting payment…' : 'Continue to payment'}
            </button>
          )}
        </div>
      )}

      {/* ── PHASE: payment (Duffel Card component) ─────────────────────────────── */}
      {phase === 'payment' && clientToken && (
        <div className="space-y-3">
          <DuffelPayments
            paymentIntentClientToken={clientToken}
            onSuccessfulPayment={finalizeOrder}
            onFailedPayment={(err) =>
              setError(err?.message || 'Your card was declined. Please try another card.')
            }
          />
        </div>
      )}

      {/* ── PHASE: creating the order ──────────────────────────────────────────── */}
      {phase === 'booking' && (
        <p className="py-6 text-center text-sm text-text-muted">Completing your booking…</p>
      )}

      {/* ── PHASE: booked ──────────────────────────────────────────────────────── */}
      {phase === 'booked' && (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm font-semibold text-brand-green">Booked!</p>
          {bookingRef ? (
            <p className="text-sm text-text-secondary">
              Booking reference: <span className="font-mono font-semibold text-text-primary">{bookingRef}</span>
            </p>
          ) : (
            <p className="text-sm text-text-secondary">Your flight is confirmed.</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
          >
            Done
          </button>
        </div>
      )}
    </TripFormModal>
  );
}
