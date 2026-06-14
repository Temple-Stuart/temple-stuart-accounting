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

import { useEffect, useState } from 'react';
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

interface Prebook {
  prebookId: string;
  transactionId: string;
  secretKey: string;
  price: number;
  currency: string;
  commission: number;
  cancellationPolicies?: unknown;
}

interface Props {
  /** PR-G3: optional. Present → account booking linked to the trip; absent →
   *  standalone/guest. Carried through the redirect so /booking/confirm finalizes
   *  the right kind of reservation. */
  tripId?: string;
  offerId: string;
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

export default function CheckoutPanel({ tripId, offerId, hotelName, checkin, checkout, onClose }: Props) {
  const [phase, setPhase] = useState<'prebooking' | 'pay'>('prebooking');
  const [error, setError] = useState('');
  const [prebook, setPrebook] = useState<Prebook | null>(null);
  const [paymentEnv, setPaymentEnv] = useState<'live' | 'sandbox' | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [started, setStarted] = useState(false); // guard: init the SDK once

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
        if (!res.ok) throw new Error(data.error || `Prebook failed (HTTP ${res.status})`);
        const p = data.prebook;
        if (!p?.prebookId || !p?.transactionId || !p?.secretKey) {
          throw new Error('This rate is no longer available — please pick another.');
        }
        if (!cancelled) {
          setPrebook(p as Prebook);
          setPaymentEnv(data.paymentEnv === 'live' ? 'live' : 'sandbox');
          setPhase('pay');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not hold this rate.');
      }
    })();
    return () => { cancelled = true; };
  }, [offerId]);

  // STEP 2 — once prebook + the SDK script are both ready, init the hosted SDK and
  // render the card form. handlePayment() collects the card and, on success,
  // REDIRECTS to our returnUrl (/booking/confirm) which finalizes the booking.
  useEffect(() => {
    if (started || phase !== 'pay' || !prebook || !paymentEnv || !sdkReady) return;
    if (typeof window === 'undefined' || typeof window.LiteAPIPayment !== 'function') return;
    if (!document.getElementById(PAYMENT_TARGET_ID)) return;

    const q = new URLSearchParams({
      prebookId: prebook.prebookId,
      transactionId: prebook.transactionId,
      hotelName,
      checkin,
      checkout,
      currency: prebook.currency,
      price: String(prebook.price),
      commission: String(prebook.commission),
      ...(tripId ? { tripId } : {}),
    });
    const returnUrl = `${window.location.origin}/booking/confirm?${q.toString()}`;

    try {
      setStarted(true);
      const payment = new window.LiteAPIPayment({
        publicKey: paymentEnv, // 'live' | 'sandbox' — matches the server's key env
        appearance: { theme: 'flat' },
        targetElement: `#${PAYMENT_TARGET_ID}`,
        secretKey: prebook.secretKey,
        returnUrl,
      });
      payment.handlePayment();
    } catch {
      setError('Could not start the payment form. Please close and try again.');
    }
  }, [started, phase, prebook, paymentEnv, sdkReady, tripId, hotelName, checkin, checkout]);

  const isSandbox = paymentEnv !== 'live';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <Script
        src={SDK_SRC}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError('Could not load the payment form. Please close and try again.')}
      />
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Book {hotelName}</h3>
            <p className="text-xs text-text-muted">{checkin} → {checkout}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">✕</button>
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

        {error && (
          <p className="mb-3 rounded border border-brand-red/40 bg-brand-red/5 px-3 py-2 text-sm text-brand-red">{error}</p>
        )}

        {phase === 'prebooking' && !error && (
          <p className="py-6 text-center text-sm text-text-muted">Holding this rate…</p>
        )}

        {phase === 'pay' && prebook && (
          <div className="space-y-4">
            <div className="rounded border border-border bg-bg-row p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-text-muted">Total</span>
                <span className="text-lg font-bold text-brand-green">{money(prebook.price, prebook.currency)}</span>
              </div>
              {prebook.commission > 0 && (
                <div className="mt-1 flex items-baseline justify-between text-xs text-text-faint">
                  <span>Service margin (included)</span>
                  <span>{money(prebook.commission, prebook.currency)}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-text-muted">
              Enter your card to pay. You&apos;ll add the guest&apos;s name on the next step, then we book the room.
            </p>

            {/* LiteAPI's hosted SDK fills this with the card form (client-side only —
                card details never reach our servers). */}
            <div id={PAYMENT_TARGET_ID} className="min-h-[40px] rounded border border-border p-2">
              {!sdkReady && <p className="text-center text-sm text-text-muted">Loading the secure payment form…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
