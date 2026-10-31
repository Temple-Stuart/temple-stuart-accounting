'use client';

/**
 * LiteApiFlightCheckoutPanel (PR-FL-4) — the LiteAPI flights checkout: passenger
 * form → POST /api/travel/liteapi/flights/prebook → THE VENDOR'S OWN DOCUMENTED
 * PAYMENT WRAPPER draws the card form and, on success, redirects to
 * /booking/flight-confirm, which completes the booking.
 *
 * ── FL-4c (2026-09-23) — THE DOCUMENTED RAIL, the one the hotel lane already uses.
 *
 * LiteAPI's User Payment guide (docs.liteapi.travel/docs/user-payment) documents
 * ONE way to take a card: load their wrapper, build
 * { publicKey, appearance, options, targetElement, secretKey, returnUrl } and call
 * handlePayment(). `publicKey` is the ENVIRONMENT — the guide's own words, "the
 * environment you are using, and must match your API key's environment" — the
 * literal 'live' or 'sandbox'. IT IS NOT A STRIPE KEY. The wrapper resolves it to
 * the real publishable key through its own /config endpoint.
 *
 * So the prebook's publishableKey being null was never a fault to route around.
 * The flights reference (docs.liteapi.travel/reference/post_flights-prebooks)
 * documents it as `string, nullable: true` — "Stripe publishable key (null if not
 * applicable)". NULL IS EXPECTED. The panel that threw on it was reporting the
 * documented shape as a failure. This panel does not read that field at all.
 *
 * THE ONE THING THE DOCS DO NOT SETTLE is whether that wrapper accepts a FLIGHT
 * prebook's secretKey — the guide covers hotels and never mentions flights. FL-4c
 * settled it before rebuilding anything: one real PRODUCTION flight prebook was
 * taken (a hold, no card, nothing charged) and its clientSecret handed to Stripe's
 * own GET /v1/payment_intents/{id}?client_secret=… authorized with the pk_live_
 * that the wrapper's /config returns for this account. Stripe answered HTTP 200,
 * livemode true, for that prebook's exact amount. Flights and hotels are the SAME
 * Stripe account, so the wrapper's key and this lane's secret belong together.
 *
 * WHAT THIS REPLACED: PR #1744 (merged) had this panel fetch the publishable key
 * from /config itself and mount raw @stripe/react-stripe-js Elements. That made a
 * card form appear, but it is not the documented rail — it hand-rolls what the
 * wrapper does, and it was the only lane in this app doing so. The wrapper is the
 * rail here now, and the hand-rolled Elements path is gone.
 *
 * WHAT THE RAIL CHANGES BESIDES THE KEY: the wrapper finishes with Stripe's
 * confirmPayment and REDIRECTS to `returnUrl`. So this panel no longer completes
 * the booking in-page — /booking/flight-confirm does, with the SAME book call and
 * the same idempotency (upstream is idempotent per prebookId). That is why
 * `onBooked` can no longer fire here, and why the booked / paid-but-not-booked
 * states live on that page.
 *
 * FL-4b — the form collects the EMPIRICAL prebook contract (proven live
 * 2026-08-04, HTTP 200): contact additionally REQUIRES phoneCountryCode
 * (numeric string, no '+'); the passenger additionally REQUIRES gender
 * ('M'|'F'), nationality (ISO-2) and the full passport block (documentType/
 * documentNumber/documentIssueCountry/documentExpiry). LiteAPI's fraud filter
 * (code 53099) rejects placeholder names like 'Test' — the form says so.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { TRAVEL_INPUT_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';

/** The vendor's wrapper — the same bytes the hotel lane loads (CheckoutPanel.tsx:34).
 *  `window.LiteAPIPayment`'s type is declared once, globally, there. */
const SDK_SRC = 'https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1';

/**
 * CHECKOUT-03 (2026-09-23), kept — STRIPE.JS IS A DEPENDENCY WE MUST SATISFY
 * OURSELVES. The vendor's Stripe loader short-circuits on `window.Stripe` when the
 * global is present; when it is NOT present but a js.stripe.com/v3 <script> tag is
 * already in the page, it keeps that finished tag and attaches `load`/`error`
 * listeners that can never fire. The promise never resolves, nothing is appended,
 * and NOTHING IS THROWN. So we load Stripe.js ourselves and wait on its real
 * readiness signal before handing off. If it genuinely cannot load, that is NAMED.
 *
 * FL-4c note: this panel is where CHECKOUT-03's stale tag came from — it used to
 * load Stripe.js through @stripe/stripe-js. It now loads the SAME src the hotel
 * panel does, through next/script, which de-duplicates the tag between them.
 */
const STRIPE_JS_SRC = 'https://js.stripe.com/v3';

/** Our own target. Distinct from the hotel panel's id: both panels live on /travel
 *  and the vendor mounts by querySelector, which takes the first match. */
const PAYMENT_TARGET_ID = 'liteapi-flight-payment-target';

/**
 * CHECKOUT-01 (2026-09-23), kept — HOW LONG WE WAIT FOR THE VENDOR'S FORM BEFORE
 * WE SAY IT DID NOT COME. LiteAPI's SDK swallows every error in two empty catches
 * (liteAPIPayment.js handlePayment and liteAPIPaymentStripe.js handlePayment, read
 * from the vendor's shipped bytes), so handlePayment() RESOLVES whether it drew a
 * card form or nothing at all. The only honest signal is the DOM.
 */
const FORM_DEADLINE_MS = 12000;

/** What went wrong, named. The first reason wins — see `fail()` below. */
type FailureKind = 'payment_env' | 'prebook' | 'sdk_script' | 'form_absent';
interface Failure {
  kind: FailureKind;
  /** The headline a customer reads. */
  message: string;
  /** One extra line of fixed, first-party text — never the vendor's body. */
  detail?: string;
}

interface Props {
  /** The searched offer to check out (from /api/travel/liteapi/flights/search). */
  offerId: string;
  /** Display-only price from the search result — the CHARGED amount is
   *  server-derived at prebook; the price is never sent anywhere. */
  price?: number | string | null;
  /** The currency the SEARCH was made in (the offer's currency). Displayed, and
   *  SEC-03 (2026-09-25): stated to the prebook route, which stores it beside the
   *  contact so the book route is handed it when the vendor's book answer states
   *  no currency — never a literal on the server. */
  currency?: string | null;
  /** LANE-01 (2026-09-25): the trip this booking attaches to, when the surface
   *  has one and the viewer is signed in (PublicFlightSearch passes it under the
   *  hotel lane's own rule: authed === true && currentTrip). It rides the
   *  returnUrl to /booking/flight-confirm, which hands it to the book route's
   *  owner gate. Absent → the booking is standalone (unattached). */
  tripId?: string;
  /** Kept for call-site compatibility. FL-4c: the documented rail REDIRECTS on
   *  payment success, so the booking now completes on /booking/flight-confirm and
   *  this no longer fires — exactly as CheckoutPanel's own onBooked has not fired
   *  since PR-B2. It is deliberately not destructured below. */
  onBooked?: (info: { prebookId: string; transactionId: string }) => void;
}

/** The prebook route's whitelisted envelope — names + nullability exactly as
 *  emitted (flights/prebook/route.ts), MINUS `publishableKey`: the route still
 *  returns it and it is documented nullable, but this panel does not read it, so
 *  it is not typed here either. The key is the wrapper's business. */
interface PrebookEnvelope {
  prebookId: string;
  transactionId: string;
  secretKey: string;
  /** 'live' | 'sandbox', server-derived (liteApiPaymentEnv()) — the label the
   *  wrapper resolves to a real key. Never the browser's guess. */
  paymentEnv?: string | null;
  price: number | null;
  currency: string | null;
}

// FL-6b: the panel uses the travel surface's own field vocabulary —
// TRAVEL_INPUT_CLASS (travelSection.tsx), the exact classes every readable
// form on this surface consumes (hotel/activity/transfer/visa inputs;
// ResultsFilterBar's select). REPAINT-4a: that shared const is the light
// CONTROL vocabulary now (white field, lavender hairline, aubergine ring),
// so this form converts with it. No new design language.
const LABEL = TRAVEL_LABEL_CLASS;
// Same validation the route enforces (flights/prebook/route.ts) — client-side
// mirror so a guest gets instant feedback instead of a 400 round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

type Phase = 'form' | 'prebooking' | 'pay' | 'expired';

export default function LiteApiFlightCheckoutPanel({ offerId, price, currency, tripId }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  // The FORM's own validation message — it belongs to the form, is rendered only
  // inside it, and is cleared on the next submit. The PAYMENT's failure is a
  // different thing entirely and is named, below.
  const [formError, setFormError] = useState('');
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
  const [paymentEnv, setPaymentEnv] = useState<'live' | 'sandbox' | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  // CHECKOUT-03: Stripe.js readiness, the vendor's unstated prerequisite. Seeded
  // from the global itself, ONCE, on mount: if the hotel panel already loaded
  // Stripe.js, next/script will not fire onLoad again for the same src, and the
  // global is the truth either way. A read, not a poll.
  const [stripeJsReady, setStripeJsReady] = useState(
    () => typeof window !== 'undefined' && typeof (window as { Stripe?: unknown }).Stripe === 'function',
  );
  const [started, setStarted] = useState(false); // guard: init the SDK once
  const [formMounted, setFormMounted] = useState(false);

  // CHECKOUT-01: a NAMED failure, not a loose string, and the FIRST reason wins —
  // the CDN's onError fires late and would otherwise bury the specific reason the
  // prebook had already given.
  const [failure, setFailureState] = useState<Failure | null>(null);
  const fail = useCallback((next: Failure) => {
    setFailureState((cur) => cur ?? next);
  }, []);

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
      setFormError(v.message);
      setErrorField(v.field);
      document.getElementById(v.field)?.focus();
      return;
    }
    setFormError('');
    setErrorField(null);
    setPhase('prebooking');
    try {
      const res = await fetch('/api/travel/liteapi/flights/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          // SEC-03: the search currency, when the surface stated one.
          ...(currency ? { currency } : {}),
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
        // A route-level refusal is CORRECTABLE — a rejected name (fraud filter
        // 53099), a bad document, a lapsed session. It returns to the form with
        // the reason, values intact, rather than ending the checkout.
        throw new Error(data?.error || `Prebook failed (HTTP ${res.status})`);
      }
      // The SDK context is what the card form is built from. Without it there is
      // nothing to pay with, and that is SAID here rather than discovered as a
      // blank pane twelve seconds later. Not correctable by the customer, so it
      // is a stated dead end, not a message over a form.
      if (typeof data?.secretKey !== 'string' || !data.secretKey) {
        fail({
          kind: 'prebook',
          message: 'This fare could not be taken to payment.',
          detail: 'The hold came back without the payment context the card form is built from. Nothing was charged.',
        });
        setPhase('pay');
        return;
      }
      // FL-4c: the environment LABEL, from the server, is what the wrapper is
      // given as `publicKey`. It is not a key and it is never guessed: an
      // environment we cannot name is a stated dead end, never a default.
      const env = typeof data?.paymentEnv === 'string' ? data.paymentEnv.trim() : '';
      if (env !== 'live' && env !== 'sandbox') {
        fail({
          kind: 'payment_env',
          message: 'Payment is not available in this environment.',
          detail: 'This deployment did not say which payment environment it is on, so no card can be taken. Nothing was charged.',
        });
        setPhase('pay');
        return;
      }
      setPrebook(data as PrebookEnvelope);
      setPaymentEnv(env);
      setPhase('pay');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the checkout session.');
      setPhase('form');
    }
  };

  // ── FL-4c: THE DOCUMENTED HAND-OFF. Once the prebook, the env label and BOTH
  // scripts are ready, build the vendor's config and call handlePayment(). On
  // success the wrapper redirects to returnUrl, and /booking/flight-confirm
  // completes the booking with the same references.
  useEffect(() => {
    // CHECKOUT-03: stripeJsReady is in this guard because the vendor needs
    // window.Stripe and will hang silently forever rather than say so.
    if (started || phase !== 'pay' || !prebook || !paymentEnv || !sdkReady || !stripeJsReady || failure) return;
    if (typeof window === 'undefined' || typeof window.LiteAPIPayment !== 'function') {
      fail({ kind: 'sdk_script', message: 'The secure payment form could not start.', detail: 'The payment provider\u2019s script loaded but did not register. Nothing was charged.' });
      return;
    }
    if (!document.getElementById(PAYMENT_TARGET_ID)) {
      fail({ kind: 'form_absent', message: 'The secure payment form could not start.', detail: 'The payment area was not on the page when the form was requested. Nothing was charged.' });
      return;
    }

    // The references /booking/flight-confirm needs to finish the booking — IDS
    // ONLY. SEC-03 (2026-09-25): the contact email no longer rides this URL. The
    // prebook route stored the validated contact under this prebookId, and the
    // book route reads it from there; a redirect URL is browser history, referrer
    // headers and server logs, and a customer's email does not belong in any of
    // them. The redirect target is our own origin.
    const q = new URLSearchParams({
      prebookId: prebook.prebookId,
      transactionId: prebook.transactionId,
      // LANE-01: the owner's trip, only when the surface gave one.
      ...(tripId ? { tripId } : {}),
    });
    const returnUrl = `${window.location.origin}/booking/flight-confirm?${q.toString()}`;

    try {
      setStarted(true);
      const payment = new window.LiteAPIPayment({
        // 'live' | 'sandbox' — the ENVIRONMENT, the guide's own word. The wrapper
        // resolves it to the matching publishable key through its /config. It is
        // NOT a Stripe key, and the prebook's publishableKey is not read at all.
        publicKey: paymentEnv,
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
  }, [started, phase, prebook, paymentEnv, sdkReady, stripeJsReady, failure, tripId, fail]);

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
        // CHECKOUT-03: say WHICH silence this was. The vendor cannot report its
        // own hang, but the global it was waiting on is readable. Two branches,
        // two fixed lines — never one line built from a condition.
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

  // Display price: prefer the prebook's server-derived figure once we have it.
  const displayPrice = prebook?.price ?? price ?? null;
  const displayCurrency = prebook?.currency ?? currency ?? null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-bg-row p-4">
      {/* CHECKOUT-03: Stripe.js, loaded by US — the vendor's loader hangs forever
          on a failed pre-existing tag rather than report it. Then the wrapper. A
          real failure in either is NAMED; there is no retry and no degraded path. */}
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

      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text-primary">Flight checkout</h2>
        {displayPrice != null && (
          <span className="text-sm font-bold text-brand-gold">
            {displayCurrency ?? ''} {displayPrice}
          </span>
        )}
      </div>

      {/* CHECKOUT-01: the ONE stated outcome. It carries the kind so the walk and
          the law can name the branch, and it never sits beside a card ask — a
          panel that cannot take a card does not ask for one, and does not leave a
          form up that would only fail the same way. */}
      {failure && (
        <div
          className="rounded border border-brand-red/40 bg-brand-red/5 px-3 py-3 text-sm text-brand-red"
          role="alert"
          data-flight-checkout-failure={failure.kind}
        >
          <p className="font-semibold" data-flight-checkout-failure-message>{failure.message}</p>
          {failure.detail && <p className="mt-1 text-xs text-brand-red/90" data-flight-checkout-failure-detail>{failure.detail}</p>}
        </div>
      )}

      {(phase === 'form' || phase === 'prebooking') && !failure ? (
        <form onSubmit={submitPrebook} className="space-y-3">
          <p className="text-xs text-text-faint">Contact</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className={LABEL}>First name</span>
              <input id="flck-co-first" className={fieldClass('flck-co-first')} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Last name</span>
              <input id="flck-co-last" className={fieldClass('flck-co-last')} value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
            <label className="space-y-1 sm:col-span-2"><span className={LABEL}>Email</span>
              <input id="flck-co-email" className={fieldClass('flck-co-email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Country code (no +)</span>
              <input id="flck-co-cc" className={fieldClass('flck-co-cc')} inputMode="numeric" placeholder="1" value={phoneCC} onChange={(e) => setPhoneCC(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Phone</span>
              <input id="flck-co-phone" className={fieldClass('flck-co-phone')} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          </div>
          <p className="text-xs text-text-faint">Passenger</p>
          {/* FL-4b: real-looking names required — LiteAPI's fraud filter (53099)
              rejects placeholders like 'Test'. */}
          <p className="text-[11px] text-text-faint">
            Use a real name — the provider&apos;s fraud filter rejects placeholder names like &ldquo;Test&rdquo;.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          <p className="text-xs text-text-faint">Travel document</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className={LABEL}>Type</span>
              <input id="flck-doc-type" className={fieldClass('flck-doc-type')} value={docType} onChange={(e) => setDocType(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Number</span>
              <input id="flck-doc-number" className={fieldClass('flck-doc-number')} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Issue country (ISO-2)</span>
              <input id="flck-doc-issue" className={fieldClass('flck-doc-issue')} placeholder="US" maxLength={2} value={docIssueCountry} onChange={(e) => setDocIssueCountry(e.target.value)} /></label>
            <label className="space-y-1"><span className={LABEL}>Expiry (YYYY-MM-DD)</span>
              <input id="flck-doc-expiry" className={fieldClass('flck-doc-expiry')} placeholder="2030-01-31" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} /></label>
          </div>
          {formError && <p className="text-sm text-brand-red">{formError}</p>}
          <button
            type="submit"
            disabled={phase === 'prebooking'}
            className="rounded bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold/90 disabled:opacity-50"
          >
            {phase === 'prebooking' ? 'Holding fare…' : 'Continue to payment'}
          </button>
        </form>
      ) : null}

      {phase === 'pay' && prebook && !failure && (
        <div className="space-y-3">
          <p className="text-sm text-text-faint">
            Enter your card to pay. We&apos;ll confirm the ticket on the next screen.
          </p>
          {/* LiteAPI's hosted wrapper fills this with the card form (client-side
              only — card details never reach our servers). */}
          <div id={PAYMENT_TARGET_ID} className="min-h-[40px] rounded border border-border p-2" data-flight-payment-target data-form-mounted={formMounted}>
            {!formMounted && (
              <p className="text-center text-sm text-text-faint" data-flight-checkout-state="loading-form">Loading the secure payment form…</p>
            )}
          </div>
        </div>
      )}

      {phase === 'expired' && (
        <div className="rounded border border-border bg-bg-row p-3">
          <p className="text-sm text-text-primary">This fare quote expired — airlines only hold prices for a few minutes.</p>
          <p className="mt-1 text-xs text-text-faint">Run a new search and open checkout with a fresh offer.</p>
        </div>
      )}
    </div>
  );
}
