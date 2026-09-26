'use client';

/**
 * CheckoutPanel — real hotel checkout with LiteAPI's hosted Payment SDK (PR-B2).
 * The card is captured by LiteAPI's SDK (client-side; PAN/CVV never touch our
 * server), and the booking finalizes after a redirect:
 *
 *   prebook (returns secretKey + transactionId + paymentEnv)
 *     → load LiteAPI's hosted SDK + handlePayment() (customer enters card)
 *     → SDK REDIRECTS to /booking/confirm (our returnUrl, carrying the prebook
 *        context) → that page collects guest details + calls the EXISTING book
 *        route with the transactionId → real confirmation.
 *
 * publicKey is driven off the server's key env (paymentEnv from prebook) — never
 * hardcoded. SANDBOX uses test card 4242 4242 4242 4242 (no real charge);
 * PRODUCTION is a real charge — the banner says which, honestly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    LiteAPIPayment?: new (config: {
      publicKey: string;
      appearance: { theme: string };
      targetElement: string;
      secretKey: string;
      returnUrl: string;
    }) => { handlePayment: () => void };
  }
}

const SDK_SRC = 'https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1';
const PAYMENT_TARGET_ID = 'liteapi-payment-target';

/**
 * CHECKOUT-03 (2026-09-23) — STRIPE.JS IS A DEPENDENCY WE MUST SATISFY OURSELVES.
 *
 * CHECKOUT-02 proved the keys are fine: /config returns pk_live_, the prebook
 * secretKey is a real livemode PaymentIntent, and Stripe's own API resolves the
 * pair. The form still never drew. CHECKOUT-03 found why, by instrumenting the
 * vendor's own empty catches and driving the real panel:
 *
 *   THE VENDOR'S STRIPE LOADER HANGS FOREVER IF A js.stripe.com/v3 <script> TAG
 *   IS ALREADY IN THE PAGE AND THAT TAG FAILED.
 *
 * Its loader short-circuits on `window.Stripe` when the global is present. When it
 * is NOT present but a tag exists, it keeps that finished tag and attaches `load`
 * and `error` listeners to it — listeners that can never fire, because the tag
 * already settled. The promise never resolves, createPaymentElement is never
 * reached, nothing is appended, and NOTHING IS THROWN: the reproduction printed
 * zero output from either of its instrumented catches, and our watchdog fired at
 * the deadline saying the provider "reports no reason". That is the production
 * symptom, verbatim.
 *
 * A tag is already in the page because the FLIGHTS panel loads Stripe.js through
 * @stripe/stripe-js (LiteApiFlightCheckoutPanel.tsx:175), and both panels live on
 * /travel.
 *
 * THE FIX IS NOT A RETRY OR A TIMEOUT. We load Stripe.js ourselves, with next/script,
 * and WAIT ON ITS REAL READINESS SIGNAL before handing off. Then `window.Stripe`
 * exists, the vendor's loader takes its short-circuit, and the branch that hangs is
 * never entered. If Stripe.js genuinely cannot load, onError names it and the panel
 * declares a failure through fail() — it does not degrade, retry or substitute.
 */
const STRIPE_JS_SRC = 'https://js.stripe.com/v3';

/**
 * CHECKOUT-01 (2026-09-23) — HOW LONG WE WAIT FOR THE VENDOR'S FORM BEFORE WE SAY
 * IT DID NOT COME.
 *
 * LiteAPI's SDK cannot tell us it failed. Read its shipped source: BOTH layers
 * swallow every error in an empty catch —
 *   liteAPIPayment.js        handlePayment(){ try{ …getConfig…loadProviderFiles… }catch(e){} }
 *   liteAPIPaymentStripe.js  handlePayment(){ try{ …loadStripe…createPaymentElement… }catch(e){} }
 * so `handlePayment()` RESOLVES whether it drew a card form or nothing at all, and
 * the throw inside (`no public key`, `failed to get config`, `target element not
 * found`, or Stripe refusing the clientSecret) never reaches our try/catch.
 *
 * The only honest signal is the DOM: did a form actually appear in our target?
 * This is not a fallback and invents nothing — it observes, and when nothing came
 * it SAYS SO instead of leaving the founder a blank pane.
 */
const FORM_DEADLINE_MS = 12000;

/** What went wrong, named. The first reason wins — see `fail()` below. */
type FailureKind = 'missing_key' | 'prebook' | 'sdk_script' | 'form_absent';
interface Failure {
  kind: FailureKind;
  /** The headline a customer reads. */
  message: string;
  /** One extra line of fixed, first-party text — never the vendor's body. */
  detail?: string;
}

interface Prebook {
  prebookId: string;
  transactionId: string;
  secretKey: string;
  price: number;
  currency: string;
  /** COMM-01 (2026-09-26): the vendor's stated prebook commission, or null when it stated none — rendered "not stated", never 0. */
  commission: number | null;
  cancellationPolicies?: unknown;
}

interface Props {
  /** PR-G3: optional. Present → account booking linked to the trip; absent →
   *  standalone/guest. Carried through the redirect so /booking/confirm finalizes
   *  the right kind of reservation. */
  tripId?: string;
  /** T2c: login state from the mount. Gates the case-(b) trips fetch — a guest
   *  NEVER fetches trips and never sees attach UI (case c). */
  authed?: boolean | null;
  /** T2c: display name for the already-selected trip (case a) — shown in the
   *  visible "Attaching to:" line so attachment is never silent. */
  tripName?: string;
  offerId: string;
  /** PR-RC2: LiteAPI hotelId — fetches rich content (photos/details/T&C) + reviews
   *  from the public RC1 routes. Optional: when absent those sections are skipped
   *  (cancellation + payment still work). */
  hotelId?: string;
  /** PR-RC2: search-result photo URLs — an instant gallery first paint while the
   *  richer content (HD images) loads. */
  images?: string[];
  hotelName: string;
  checkin: string;   // ISO YYYY-MM-DD
  checkout: string;  // ISO YYYY-MM-DD
  onClose: () => void;
  /** Kept for call-site compatibility; the booking now completes on the redirect
   *  target (/booking/confirm), so this no longer fires on the SDK path. */
  onBooked: (result: { confirmationCode: string | null; bookingId: string }) => void;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// PR-RC2: hotelDescription + hotelImportantInformation come as HTML — strip to
// plain text (NEVER inject raw upstream HTML; no dangerouslySetInnerHTML).
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rich-content shapes (RC1 route returns) — local, render only what's present.
interface HotelContentData {
  hotelImages?: Array<{ url?: string; urlHd?: string; defaultImage?: boolean }>;
  hotelDescription?: string;
  hotelImportantInformation?: string;
  facilities?: Array<{ name?: string }>;
  starRating?: number;
  rating?: number;        // 0-5 — the ONE scale the client types (liteapiClient.ts HotelContent.rating); HOTEL-02 (2026-09-22): "/10" was a second scale for the same number
  reviewCount?: number;
  address?: string;
  city?: string;
}
interface HotelReviewData {
  averageScore?: number;
  name?: string;
  date?: string;
  headline?: string;
  pros?: string;
  cons?: string;
  country?: string;
}
interface CancellationData {
  refundableTag?: string;          // 'RFN' | 'NRFN'
  hotelRemarks?: string[];
  cancelPolicyInfos?: unknown[];
}

export default function CheckoutPanel({ tripId, authed, tripName, offerId, hotelId, images, hotelName, checkin, checkout, onClose }: Props) {
  const [phase, setPhase] = useState<'prebooking' | 'pay'>('prebooking');
  // CHECKOUT-01: a NAMED failure, not a loose string. The panel used to hold one
  // `error`, so the <Script onError> handler — which fires on any CDN hiccup —
  // OVERWROTE the specific reason the prebook had already given ("This rate is no
  // longer available", "LITEAPI_SANDBOX_KEY is not configured"), and the founder
  // was told the wrong thing. The FIRST reason wins now.
  const [failure, setFailureState] = useState<Failure | null>(null);
  const [formMounted, setFormMounted] = useState(false);
  // CHECKOUT-03: Stripe.js readiness, the vendor's unstated prerequisite.
  // Seeded from the global itself, ONCE, on mount: if the flights panel already
  // loaded Stripe.js, next/script will not fire onLoad again for the same src, and
  // the global is the truth either way. This is a read, not a poll — it happens
  // exactly once and never again.
  const [stripeJsReady, setStripeJsReady] = useState(
    () => typeof window !== 'undefined' && typeof (window as { Stripe?: unknown }).Stripe === 'function',
  );
  const [prebook, setPrebook] = useState<Prebook | null>(null);
  const [paymentEnv, setPaymentEnv] = useState<'live' | 'sandbox' | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [started, setStarted] = useState(false); // guard: init the SDK once

  // ── T2c: attachment is VISIBLE and CHOSEN — never silent ──────────────────
  // (a) tripId prop present → "Attaching to: <name>" line, no choice needed.
  // (b) authed, no tripId → fetch the user's trips; ≥1 → ASK (chooser) and HOLD
  //     payment until an explicit pick or "Don't attach". No default-guessing.
  // (c) guest / zero trips → no attach UI, checkout exactly as before.
  // chosenTripId: undefined = not yet chosen (payment held in case b);
  // null = explicit "Don't attach"; string = the chosen trip.
  // A later, vaguer reason never displaces one we already have.
  const fail = useCallback((next: Failure) => {
    setFailureState((cur) => cur ?? next);
  }, []);

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
  const attachChoicePending =
    !tripId &&
    authed === true &&
    (tripsFetch === 'loading' ||
      (tripsFetch === 'ok' && (myTrips?.length ?? 0) > 0 && chosenTripId === undefined));

  // The tripId that actually rides the returnUrl: the prop (case a) or the
  // explicit choice (case b). "Don't attach" (null) and case (c) yield none.
  const resolvedTripId = tripId ?? (typeof chosenTripId === 'string' ? chosenTripId : undefined);

  // PR-RC2: rich content + reviews (fetched once on open by hotelId, in parallel).
  // These are DISPLAY ONLY — a fetch failure sets its own error and NEVER blocks
  // the payment below.
  const [content, setContent] = useState<HotelContentData | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);
  const [reviews, setReviews] = useState<HotelReviewData[] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;
    setContentLoading(true);
    setReviewsLoading(true);
    (async () => {
      const [cRes, rRes] = await Promise.allSettled([
        fetch(`/api/travel/hotels/content?hotelId=${encodeURIComponent(hotelId)}`),
        fetch(`/api/travel/hotels/reviews?hotelId=${encodeURIComponent(hotelId)}&limit=8`),
      ]);
      if (cancelled) return;
      try {
        if (cRes.status === 'fulfilled' && cRes.value.ok) {
          const d = await cRes.value.json();
          if (!cancelled) setContent((d?.content ?? null) as HotelContentData | null);
        } else if (!cancelled) setContentError(true);
      } catch { if (!cancelled) setContentError(true); } finally { if (!cancelled) setContentLoading(false); }
      try {
        if (rRes.status === 'fulfilled' && rRes.value.ok) {
          const d = await rRes.value.json();
          if (!cancelled) setReviews(Array.isArray(d?.reviews) ? (d.reviews as HotelReviewData[]) : []);
        } else if (!cancelled) setReviewsError(true);
      } catch { if (!cancelled) setReviewsError(true); } finally { if (!cancelled) setReviewsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [hotelId]);

  // STEP 1 — prebook on open (real price + the SDK secretKey + the key env).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/travel/liteapi/prebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (cancelled) return;
          // The route's own typed shape (prebook/route.ts:62-67). A key that is not
          // set is an ENVIRONMENT fact, and the panel says so in those words rather
          // than blaming the rate.
          if (data?.kind === 'missing_key') {
            fail({
              kind: 'missing_key',
              message: 'Payment is not available in this environment.',
              detail: `No LiteAPI ${data?.mode === 'production' ? 'production' : 'sandbox'} key is configured on this deployment, so no card can be taken. Nothing was charged.`,
            });
            return;
          }
          fail({ kind: 'prebook', message: data?.error || `We could not hold this rate (HTTP ${res.status}).`, detail: 'Nothing was charged.' });
          return;
        }
        const p = data.prebook;
        // The SDK context is what the card form is built from. Without it there is
        // nothing to pay with, and that is said here rather than discovered as a
        // blank pane twelve seconds later.
        const missing = (['prebookId', 'transactionId', 'secretKey'] as const).filter((k) => !p?.[k]);
        if (missing.length) {
          if (!cancelled) {
            fail({
              kind: 'prebook',
              message: 'This rate is no longer available — please pick another.',
              detail: `The hold came back without ${missing.join(', ')}. Nothing was charged.`,
            });
          }
          return;
        }
        if (!cancelled) {
          setPrebook(p as Prebook);
          setPaymentEnv(data.paymentEnv === 'live' ? 'live' : 'sandbox');
          setPhase('pay');
        }
      } catch (err) {
        if (!cancelled) fail({ kind: 'prebook', message: err instanceof Error ? err.message : 'Could not hold this rate.', detail: 'Nothing was charged.' });
      }
    })();
    return () => { cancelled = true; };
  }, [offerId, fail]);

  // STEP 2 — once prebook + the SDK script are both ready, init the hosted SDK and
  // render the card form. handlePayment() collects the card and, on success,
  // REDIRECTS to our returnUrl (/booking/confirm) which finalizes the booking.
  useEffect(() => {
    // T2c: attachChoicePending holds the SDK init until the user's explicit
    // attach choice exists — the returnUrl is built ONCE, so it must carry the
    // decided tripId, never a guess.
    // CHECKOUT-03 adds stripeJsReady: the vendor needs window.Stripe and will hang
    // silently forever rather than say so, so we do not hand off until it is there.
    if (started || phase !== 'pay' || !prebook || !paymentEnv || !sdkReady || !stripeJsReady || attachChoicePending) return;
    // CHECKOUT-01: these two were SILENT returns. The script reported itself loaded
    // and yet its global was not callable, or our own target was not in the DOM —
    // either way the effect gave up and the customer was left looking at an empty
    // box. Both are now stated.
    if (typeof window === 'undefined' || typeof window.LiteAPIPayment !== 'function') {
      fail({ kind: 'sdk_script', message: 'The secure payment form could not start.', detail: 'The payment provider\u2019s script loaded but did not register. Nothing was charged.' });
      return;
    }
    if (!document.getElementById(PAYMENT_TARGET_ID)) {
      fail({ kind: 'form_absent', message: 'The secure payment form could not start.', detail: 'The payment area was not on the page when the form was requested. Nothing was charged.' });
      return;
    }

    const q = new URLSearchParams({
      prebookId: prebook.prebookId,
      transactionId: prebook.transactionId,
      hotelName,
      checkin,
      checkout,
      currency: prebook.currency,
      price: String(prebook.price),
      commission: String(prebook.commission),
      ...(resolvedTripId ? { tripId: resolvedTripId } : {}),
    });
    const returnUrl = `${window.location.origin}/booking/confirm?${q.toString()}`;

    try {
      setStarted(true);
      const payment = new window.LiteAPIPayment({
        publicKey: paymentEnv, // 'live' | 'sandbox' — the wrapper resolves the env
        // label to the matching publishable key (verified against the vendor's
        // /config endpoint: 'sandbox' → a test key, 'live' → a live one, anything
        // else → HTTP 400 "invalid key"). It is NOT a key itself, and the flights
        // panel's publishableKey gap is a different rail — Stripe Elements on our
        // side there, LiteAPI's own hosted wrapper here.
        appearance: { theme: 'flat' },
        targetElement: `#${PAYMENT_TARGET_ID}`,
        secretKey: prebook.secretKey,
        returnUrl,
      });
      // This resolves whatever happens (see FORM_DEADLINE_MS above), so its result
      // is not evidence of anything. The watchdog below is.
      payment.handlePayment();
    } catch {
      fail({ kind: 'sdk_script', message: 'The secure payment form could not start.', detail: 'The payment provider refused the request to open a card form. Nothing was charged.' });
    }
  }, [started, phase, prebook, paymentEnv, sdkReady, stripeJsReady, attachChoicePending, resolvedTripId, hotelName, checkin, checkout, fail]);

  // ── CHECKOUT-01: THE WATCHDOG. Did a form actually appear? ─────────────────
  // The vendor cannot tell us, so we look. A card form means real elements inside
  // our target (the wrapper builds a <button class="lp-submit-button"> and Stripe
  // mounts <iframe>s). Our own "Loading…" paragraph is ours, so it is excluded by
  // looking for the vendor's nodes only. Nothing here retries or substitutes:
  // it observes, and on nothing it SAYS nothing came.
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!started || failure) return;
    const target = document.getElementById(PAYMENT_TARGET_ID);
    if (!target) return;
    const look = () => !!target.querySelector('iframe, .lp-submit-button, form, input');
    if (look()) { setFormMounted(true); return; }
    const observer = new MutationObserver(() => {
      if (!look()) return;
      setFormMounted(true);
      observer.disconnect();
      if (deadlineRef.current) clearTimeout(deadlineRef.current);
    });
    observer.observe(target, { childList: true, subtree: true });
    deadlineRef.current = setTimeout(() => {
      observer.disconnect();
      if (!look()) {
        // CHECKOUT-03: when the deadline passes, say WHICH silence this was. The
        // vendor cannot report its own hang, but the global it was waiting on is
        // readable, and that single word is what turned CHECKOUT-02's dead end
        // into a diagnosis.
        // Two branches, two fixed lines — not one line built from a condition.
        // The checkout law requires every `detail` to be first-party text written
        // out in full, and that is worth more than the brevity of a ternary.
        if (typeof (window as { Stripe?: unknown }).Stripe !== 'function') {
          fail({
            kind: 'form_absent',
            message: 'The secure payment form did not load.',
            detail: 'The card provider\u2019s library is not available in this browser, so the payment form could not be built. Nothing was charged — an ad or script blocker is the usual cause.',
          });
        } else {
          fail({
            kind: 'form_absent',
            message: 'The secure payment form did not load.',
            detail: 'The payment provider was reached but returned no card form, and it reports no reason. Nothing was charged — please close this and try again, or tell us if it keeps happening.',
          });
        }
      } else {
        setFormMounted(true);
      }
    }, FORM_DEADLINE_MS);
    return () => {
      observer.disconnect();
      if (deadlineRef.current) clearTimeout(deadlineRef.current);
    };
  }, [started, failure, fail]);

  const isSandbox = paymentEnv !== 'live';

  // ── PR-RC2 derived display values ──────────────────────────────────────────
  // Gallery: prefer content's HD images (defaultImage first), else the instant
  // search photos passed in.
  const galleryUrls: string[] = content?.hotelImages?.length
    ? [...content.hotelImages]
        .sort((a, b) => (b.defaultImage ? 1 : 0) - (a.defaultImage ? 1 : 0))
        .map((im) => im.urlHd || im.url || '')
        .filter(Boolean)
    : (images ?? []);
  const facilityNames = (content?.facilities ?? []).map((f) => f.name).filter((n): n is string => !!n);
  const description = content?.hotelDescription ? stripHtml(content.hotelDescription) : '';
  const importantInfo = content?.hotelImportantInformation ? stripHtml(content.hotelImportantInformation) : '';
  const cancellation =
    prebook?.cancellationPolicies && typeof prebook.cancellationPolicies === 'object'
      ? (prebook.cancellationPolicies as CancellationData)
      : null;
  const isNonRefundable = cancellation?.refundableTag === 'NRFN';
  const cancelConditionCount = Array.isArray(cancellation?.cancelPolicyInfos) ? cancellation!.cancelPolicyInfos!.length : 0;
  const hotelRemarks = (cancellation?.hotelRemarks ?? []).filter((r): r is string => typeof r === 'string' && r.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      {/* CHECKOUT-03: Stripe.js, loaded by US. The vendor's loader hangs forever on
          a failed pre-existing tag rather than report it; with window.Stripe already
          present it takes its short-circuit and that branch is never entered. A real
          failure here is NAMED — there is no retry and no degraded path. */}
      <Script
        src={STRIPE_JS_SRC}
        strategy="afterInteractive"
        onLoad={() => setStripeJsReady(true)}
        onError={() => fail({ kind: 'sdk_script', message: 'The secure payment form could not be loaded.', detail: 'The card provider\u2019s library could not be reached from this browser. Nothing was charged.' })}
      />
      <Script
        src={SDK_SRC}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => fail({ kind: 'sdk_script', message: 'The secure payment form could not be loaded.', detail: 'The payment provider\u2019s script could not be reached from this browser. Nothing was charged.' })}
      />
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Book {hotelName}</h3>
            <p className="text-xs text-text-faint">{checkin} → {checkout}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-faint hover:text-text-primary">✕</button>
        </div>

        {/* Env-honest banner — sandbox = test card, production = a real charge. */}
        {paymentEnv && (
          isSandbox ? (
            <div className="mb-4 rounded border border-brand-amber/40 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">
              Test mode — use card 4242 4242 4242 4242, any future date, any CVV. No real charge.
            </div>
          ) : (
            <div className="mb-4 rounded border border-brand-purple/40 bg-brand-purple/10 px-3 py-2 text-xs text-brand-purple">
              You&apos;re paying for real — your card will be charged when you confirm.
            </div>
          )
        )}

        {/* CHECKOUT-01: the ONE stated outcome. It carries the kind so the walk and
            the law can name the branch, and it never sits beside "Enter your card
            to pay" — a panel that cannot take a card does not ask for one. */}
        {failure && (
          <div
            className="mb-3 rounded border border-brand-red/40 bg-brand-red/5 px-3 py-3 text-sm text-brand-red"
            role="alert"
            data-checkout-failure={failure.kind}
          >
            <p className="font-semibold" data-checkout-failure-message>{failure.message}</p>
            {failure.detail && <p className="mt-1 text-xs text-brand-red/90" data-checkout-failure-detail>{failure.detail}</p>}
          </div>
        )}

        {/* ── PR-RC2: rich details ABOVE the payment (all scroll in this popup). A
              section failing only shows its own note — it never blocks payment. ── */}
        {hotelId && (
          <div className="mb-4 space-y-4">
            {/* 1. PHOTO GALLERY (instant from search photos → HD from content). */}
            {galleryUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {galleryUrls.slice(0, 12).map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${u}-${i}`} src={u} alt={`${hotelName} photo ${i + 1}`} loading="lazy" className="h-32 w-44 flex-shrink-0 rounded object-cover" />
                ))}
              </div>
            )}

            {/* 2. DETAILS. */}
            {content && (
              <div className="space-y-1">
                {(content.starRating || content.rating != null) && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    {content.starRating ? <span className="text-brand-gold" aria-label={`${content.starRating} star`}>{'★'.repeat(Math.min(5, Math.round(content.starRating)))}</span> : null}
                    {content.rating != null && (
                      <span><span className="font-semibold text-text-primary">{content.rating}</span>/5{content.reviewCount ? ` · ${content.reviewCount.toLocaleString()} reviews` : ''}</span>
                    )}
                  </div>
                )}
                {(content.address || content.city) && (
                  <p className="text-xs text-text-faint">{[content.address, content.city].filter(Boolean).join(', ')}</p>
                )}
                {facilityNames.length > 0 && (
                  <p className="text-xs text-text-faint">{facilityNames.slice(0, 6).join(' · ')}{facilityNames.length > 6 ? ` · +${facilityNames.length - 6} more` : ''}</p>
                )}
                {description && <p className="line-clamp-4 text-sm text-text-secondary">{description}</p>}
              </div>
            )}
            {contentLoading && !content && <p className="text-xs text-text-faint">Loading hotel details…</p>}
            {contentError && <p className="text-xs text-text-faint">Couldn&apos;t load hotel details.</p>}

            {/* 3. CANCELLATION (FREE from prebook) + T&C. Non-refundable is loud. */}
            {cancellation && (
              <div className="rounded border border-border p-3 text-sm">
                {isNonRefundable ? (
                  <p className="font-semibold text-brand-red">Non-refundable — this booking can&apos;t be cancelled or refunded.</p>
                ) : (
                  <p className="font-semibold text-brand-green">Refundable</p>
                )}
                {!isNonRefundable && cancelConditionCount > 0 && (
                  <p className="mt-1 text-xs text-text-faint">Cancellation deadlines apply — see the hotel terms below.</p>
                )}
                {hotelRemarks.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-text-faint">
                    {hotelRemarks.slice(0, 4).map((r, i) => <li key={i}>{stripHtml(r)}</li>)}
                  </ul>
                )}
              </div>
            )}
            {importantInfo && (
              <div className="text-xs text-text-faint">
                <button type="button" onClick={() => setShowTerms((v) => !v)} className="font-medium text-brand-purple underline">
                  {showTerms ? 'Hide' : 'Show'} hotel terms &amp; important info
                </button>
                {showTerms && <p className="mt-1 whitespace-pre-line">{importantInfo}</p>}
              </div>
            )}

            {/* 4. REVIEWS — render only non-empty headline/pros/cons; honest empty. */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Guest reviews</p>
              {reviewsLoading && !reviews && <p className="text-xs text-text-faint">Loading reviews…</p>}
              {reviewsError && <p className="text-xs text-text-faint">Couldn&apos;t load reviews.</p>}
              {reviews && reviews.length === 0 && <p className="text-xs text-text-faint">No reviews yet.</p>}
              {reviews && reviews.slice(0, 5).map((r, i) => (
                <div key={i} className="rounded border border-border bg-bg-row p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{r.name?.trim() || 'Guest'}{r.country ? ` · ${r.country.toUpperCase()}` : ''}</span>
                    {r.averageScore != null && <span className="font-semibold text-brand-green">{r.averageScore}/10</span>}
                  </div>
                  {r.headline?.trim() && <p className="mt-0.5 font-medium text-text-secondary">{r.headline.trim()}</p>}
                  {r.pros?.trim() && <p className="mt-0.5 text-text-faint">+ {r.pros.trim()}</p>}
                  {r.cons?.trim() && <p className="text-text-faint">− {r.cons.trim()}</p>}
                  {r.date?.trim() && <p className="mt-0.5 text-text-faint">{r.date.slice(0, 10)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'prebooking' && !failure && (
          <p className="py-6 text-center text-sm text-text-faint" data-checkout-state="holding">Holding this rate…</p>
        )}

        {phase === 'pay' && prebook && (
          <div className="space-y-4">
            {/* ── T2c: the attach state, ALWAYS visible before payment ──────────
                (a) prop tripId → attached line. (b) chooser until an explicit
                choice; then the chosen state renders and payment appears.
                (c) guest / zero trips → nothing. Fetch failure → its own honest
                line (no hold, no guess). */}
            {tripId ? (
              <div className="rounded border border-brand-purple/40 bg-brand-purple/10 px-3 py-2 text-sm text-brand-purple">
                Attaching to: <span className="font-semibold">{tripName || 'your selected trip'}</span>
              </div>
            ) : authed === true && tripsFetch === 'loading' ? (
              <p className="text-xs text-text-faint">Checking your trips…</p>
            ) : authed === true && tripsFetch === 'error' ? (
              <div className="rounded border border-border bg-bg-row px-3 py-2 text-xs text-text-faint">
                Couldn&apos;t load your trips — this booking won&apos;t attach to a trip.
              </div>
            ) : authed === true && tripsFetch === 'ok' && (myTrips?.length ?? 0) > 0 ? (
              chosenTripId === undefined ? (
                <div className="rounded border border-brand-purple/40 p-3">
                  <p className="text-sm font-medium text-text-primary">Save this booking to a trip?</p>
                  <p className="mt-0.5 text-xs text-text-faint">
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
                      className="rounded border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-row"
                    >
                      Don&apos;t attach
                    </button>
                  </div>
                </div>
              ) : chosenTripId ? (
                <div className="rounded border border-brand-purple/40 bg-brand-purple/10 px-3 py-2 text-sm text-brand-purple">
                  Attaching to: <span className="font-semibold">{myTrips!.find((t) => t.id === chosenTripId)?.name}</span>
                </div>
              ) : (
                <div className="rounded border border-border bg-bg-row px-3 py-2 text-sm text-text-faint">
                  Not attaching to a trip.
                </div>
              )
            ) : null}

            <div className="rounded border border-border bg-bg-row p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-text-faint">Total</span>
                <span className="text-lg font-bold text-brand-gold">{money(prebook.price, prebook.currency)}</span>
              </div>
              {/* COMM-01 (2026-09-26): the vendor's stated figure, or "not stated" — never a hidden 0. */}
              <div className="mt-1 flex items-baseline justify-between text-xs text-text-faint">
                <span>Service margin (included)</span>
                <span>{prebook.commission === null ? 'not stated' : money(prebook.commission, prebook.currency)}</span>
              </div>
            </div>

            {/* CHECKOUT-01: a failure replaces the card ask entirely. The panel used
                to print "Enter your card to pay" and "Loading the secure payment
                form…" UNDERNEATH "Could not load the payment form" — three claims
                at once, none of them a card field. */}
            {!failure && (
              <>
                <p className="text-sm text-text-faint">
                  Enter your card to pay. You&apos;ll add the guest&apos;s name on the next step, then we book the room.
                </p>

                {/* LiteAPI's hosted SDK fills this with the card form (client-side only —
                    card details never reach our servers). */}
                <div id={PAYMENT_TARGET_ID} className="min-h-[40px] rounded border border-border p-2" data-payment-target data-form-mounted={formMounted}>
                  {!formMounted && (
                    <p className="text-center text-sm text-text-faint" data-checkout-state="loading-form">Loading the secure payment form…</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
