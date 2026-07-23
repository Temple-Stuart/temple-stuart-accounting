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

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import TripFormModal from './TripFormModal';
// BOOK-3: guest bookings append a session-only trip record (the landing's
// "YOUR TRIP SO FAR" strip). Guests only — authed bookings live server-side.
import { addGuestTripRecord } from '@/lib/guestTrip';

// DuffelPayments renders Stripe Elements (browser-only) — load it client-side only.
const DuffelPayments = dynamic(
  () => import('@duffel/components').then((m) => m.DuffelPayments),
  {
    ssr: false,
    loading: () => <p className="text-sm text-white/50">Loading secure payment…</p>,
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
  /** T2b: optional. Present → account booking born attached to this trip; absent →
   *  standalone/guest, unchanged. Mirrors the hotel CheckoutPanel (T2c). */
  tripId?: string;
  /** T2b: login state from the mount. Gates the case-(b) trips fetch — a guest
   *  NEVER fetches trips and never sees attach UI (case c). */
  authed?: boolean | null;
  /** T2b: display name for the already-selected trip (case a) — shown in the
   *  visible "Attaching to:" line so attachment is never silent. */
  tripName?: string;
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
  'w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40';
const labelClass = 'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50';

export default function FlightCheckoutPanel({ tripId, authed, tripName, offer, passengerCount, onClose, onBooked, onOfferExpired }: Props) {
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

  // ── T2b: attachment is VISIBLE and CHOSEN — never silent (mirrors T2c) ──────
  // (a) tripId prop present → "Attaching to: <name>" line, no choice needed.
  // (b) authed, no tripId → fetch the user's trips; ≥1 → ASK (chooser) and HOLD
  //     payment until an explicit pick or "Don't attach". No default-guessing.
  // (c) guest / zero trips → no attach UI, checkout exactly as before.
  // chosenTripId: undefined = not yet chosen (payment held in case b);
  // null = explicit "Don't attach"; string = the chosen trip.
  const [myTrips, setMyTrips] = useState<{ id: string; name: string }[] | null>(null);
  const [tripsFetch, setTripsFetch] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [chosenTripId, setChosenTripId] = useState<string | null | undefined>(undefined);

  // Case-(b) fetch: fires ONLY for an authed mount that arrived unattached.
  useEffect(() => {
    if (tripId || authed !== true) return;
    let cancelled = false;
    setTripsFetch('loading');
    fetch('/api/trips')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const rows = Array.isArray(data.trips) ? data.trips : [];
        setMyTrips(rows.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
        setTripsFetch('ok');
      })
      .catch(() => { if (!cancelled) setTripsFetch('error'); });
    return () => { cancelled = true; };
  }, [tripId, authed]);

  // Payment holds ONLY while case (b) is genuinely unresolved: the trips are
  // loading, or ≥1 trip exists and no explicit choice has been made yet. A
  // fetch error does NOT hold payment — it renders its own visible line below.
  // The hotel panel holds its SDK-init effect; THIS panel's payment entry point
  // is the "Continue to payment" button, so the hold disables that button —
  // same semantic (no payment until the choice exists), different entry point.
  const attachChoicePending =
    !tripId &&
    authed === true &&
    (tripsFetch === 'loading' ||
      (tripsFetch === 'ok' && (myTrips?.length ?? 0) > 0 && chosenTripId === undefined));

  // The tripId that actually rides the book POST: the prop (case a) or the
  // explicit choice (case b). "Don't attach" (null) and case (c) yield none.
  const resolvedTripId = tripId ?? (typeof chosenTripId === 'string' ? chosenTripId : undefined);

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
          // T2b: present ONLY on an explicit attach (prop or chooser pick) — the
          // server's ownership gate proves it before any Duffel call.
          ...(resolvedTripId ? { tripId: resolvedTripId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Honest real-money case: card charged but order failed (PR-1 fail-loud state).
        if (data.paymentConfirmedNoOrder) setChargedNoOrder(true);
        // T2b: a gate rejection (401 sign-in / 404 trip-not-found) on an
        // attach-requested finalize is ALSO post-charge — finalizeOrder only runs
        // after the card component confirmed the intent, and the server's ownership
        // gate returns BEFORE it verifies the intent, so paymentConfirmedNoOrder can
        // never be set on this path. Unlike the hotel lane (liteapi/book charges
        // inside the book request, so its gate is genuinely pre-charge), the Duffel
        // charge happened one request earlier. Without this, the 401 copy would
        // invite sign-in + a NEW intent = a second charge. Tell the truth instead:
        // charged, not booked, do not pay again.
        if (resolvedTripId && (res.status === 401 || res.status === 404)) setChargedNoOrder(true);
        throw new Error(data.error || 'Booking failed.');
      }
      setBookingRef(data.order?.bookingReference ?? null);
      // BOOK-3: guest success → the session trip record, from the booking
      // RESPONSE only (route from order.slices[0] under strict shape checks —
      // the book route's own extraction discipline; amount from the server's
      // reservation.finalPriceCents, null when absent — never a guess).
      if (authed !== true) {
        const slice0 = Array.isArray(data.order?.slices) ? data.order.slices[0] : undefined;
        const o = slice0?.origin?.iata_code;
        const d = slice0?.destination?.iata_code;
        const route =
          typeof o === 'string' && /^[A-Z]{3}$/.test(o) && typeof d === 'string' && /^[A-Z]{3}$/.test(d)
            ? `${o} → ${d}`
            : 'Flight';
        const cents = data.reservation?.finalPriceCents;
        addGuestTripRecord({
          type: 'flight',
          name: route,
          confirmationCode: typeof data.order?.bookingReference === 'string' ? data.order.bookingReference : null,
          amountUsd: typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : null,
          currency: typeof data.reservation?.currency === 'string' ? data.reservation.currency : offer.currency,
          ts: Date.now(),
        });
      }
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
        <p className="mb-3 rounded border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/70">
          Test mode — no real charge. Use a Duffel test card.
        </p>
      )}

      {paymentAttempted && chargedNoOrder && (
        <p className="mb-3 rounded border border-brand-red/40 bg-white/5 px-3 py-2 text-sm text-brand-red">
          Your card was charged but the booking did not finalize. Please contact support —
          we will refund or complete it. Do not pay again.
        </p>
      )}
      {error && !chargedNoOrder && (
        <p className="mb-3 rounded border border-brand-red/40 bg-white/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      {/* ── T2b: the attach state, ALWAYS visible before + during payment ────────
          (a) prop tripId → attached line. (b) chooser until an explicit choice;
          "Continue to payment" stays disabled until then. (c) guest / zero trips
          → nothing. Fetch failure → its own honest line (no hold, no guess). */}
      {(phase === 'form' || phase === 'payment') && (
        tripId ? (
          <div className="mb-3 rounded border border-brand-purple/40 bg-brand-purple/10 px-3 py-2 text-sm text-brand-purple">
            Attaching to: <span className="font-semibold">{tripName || 'your selected trip'}</span>
          </div>
        ) : authed === true && tripsFetch === 'loading' ? (
          <p className="mb-3 text-xs text-white/50">Checking your trips…</p>
        ) : authed === true && tripsFetch === 'error' ? (
          <div className="mb-3 rounded border border-panel-border bg-white/5 px-3 py-2 text-xs text-white/50">
            Couldn&apos;t load your trips — this booking won&apos;t attach to a trip.
          </div>
        ) : authed === true && tripsFetch === 'ok' && (myTrips?.length ?? 0) > 0 ? (
          chosenTripId === undefined ? (
            <div className="mb-3 rounded border border-brand-purple/40 p-3">
              <p className="text-sm font-medium text-white">Save this booking to a trip?</p>
              <p className="mt-0.5 text-xs text-white/50">
                Pick a trip or book without one — payment opens after you choose.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {myTrips!.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChosenTripId(t.id)}
                    className="rounded border border-brand-purple/40 px-3 py-1.5 text-sm text-brand-purple hover:bg-brand-purple/10"
                  >
                    {t.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setChosenTripId(null)}
                  className="rounded border border-white/30 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
                >
                  Don&apos;t attach
                </button>
              </div>
            </div>
          ) : chosenTripId ? (
            <div className="mb-3 rounded border border-brand-purple/40 bg-brand-purple/10 px-3 py-2 text-sm text-brand-purple">
              Attaching to: <span className="font-semibold">{myTrips!.find((t) => t.id === chosenTripId)?.name}</span>
            </div>
          ) : (
            <div className="mb-3 rounded border border-panel-border bg-white/5 px-3 py-2 text-sm text-white/50">
              Not attaching to a trip.
            </div>
          )
        ) : null
      )}

      {/* ── PHASE: passenger form ──────────────────────────────────────────────── */}
      {phase === 'form' && (
        <div className="space-y-5">
          {passengers.map((p, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-panel-border p-3">
              {passengers.length > 1 && (
                <p className="text-xs font-semibold text-white/70">Passenger {i + 1}</p>
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
                <summary className="cursor-pointer text-white/50">Passport — required for international flights</summary>
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
              disabled={!allValid || busy || attachChoicePending}
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
        <p className="py-6 text-center text-sm text-white/50">Completing your booking…</p>
      )}

      {/* ── PHASE: booked ──────────────────────────────────────────────────────── */}
      {phase === 'booked' && (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm font-semibold text-brand-green">Booked!</p>
          {bookingRef ? (
            <p className="text-sm text-white/70">
              Booking reference: <span className="font-mono font-semibold text-white">{bookingRef}</span>
            </p>
          ) : (
            <p className="text-sm text-white/70">Your flight is confirmed.</p>
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
